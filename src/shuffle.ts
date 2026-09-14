/**
 * The lazy (incremental) Fisher-Yates shuffle — ONE importable, side-effect-free implementation,
 * so that the thing the regression tests exercise is the thing the simulator and the binding test
 * actually run.
 *
 * WHY THIS MODULE EXISTS.
 *
 * `tests/blackjack/rngTests.ts` carries three depth-uniformity tests whose stated purpose is to
 * guard against the fixed-24-card-prefix defect: an earlier `src/simulate.ts` pre-shuffled only
 * the first 24 positions per round and then read past them, sampling UNSHUFFLED tail positions on
 * deep rounds. Those tests contained their OWN private copy of the shuffle loop, so they guarded
 * a copy nothing shipped. Executed counterexample (round-4 QA-02): changing the real simulator's
 * loop condition from `frontier <= k` to `frontier <= k && frontier < 24` — reintroducing exactly
 * the defect — left all three depth tests green. A regression guard that cannot see the
 * regression is not a guard.
 *
 * The same 24-card premise had also been written into `tests/blackjack/roundEngineTests.ts` as a
 * fact ("a round never consumes more"). It is false: a valid eight-deck round of two 12-card
 * split hands and a nine-card dealer hand reads through index 32 (round-4 QA-03). Because the
 * shuffle here is on demand, a caller that reads index 32 gets index 32 shuffled — there is no
 * depth constant left to be wrong about.
 *
 * WHY EXTRACTING THIS IS SAFE, where extracting the round logic was not.
 *
 * `src/round-engine.ts` documents why the round logic was deliberately COPIED rather than lifted
 * out of `simulate.ts`: `outputs/simulation-results.json` is frozen and hash-pinned, so a refactor
 * of the instrument that produced it could not be re-run to prove it behaviour-preserving. That
 * argument does not apply here, because this extraction is provably equivalent without re-running
 * anything: the shuffler is a pure function of its injected random source, and `rngTests.ts`
 * asserts that the same source produces the same permutation. The frozen artifact is not
 * regenerated and its pin does not move.
 *
 * SIDE-EFFECT FREE. Importing this module allocates nothing, draws no randomness and starts no
 * simulation — the property `simulate.ts` lacks (it runs 30M rounds on import), and the reason
 * the tests could not simply import the original.
 *
 * BEHAVIOUR, stated precisely because three call sites depend on it:
 *   - `items` is held IN PLACE; nothing is copied.
 *   - `ensure(k)` advances the frontier so positions 0..k are FIXED: position f is settled by a
 *     uniform draw from [f, size), the standard Fisher-Yates step. A settled position is never
 *     re-drawn, so `at(k)` is idempotent.
 *   - `reset()` returns the frontier to 0 WITHOUT restoring the array. The next round therefore
 *     re-shuffles from the current arrangement, exactly as a continuous shuffler does and exactly
 *     as the inline loop did. Uniformity at every depth comes from the draw, not from the
 *     starting arrangement.
 *   - RANDOMNESS IS INJECTED as `randBelow(n) -> integer in [0, n)`, not as a float source. That
 *     keeps each caller's existing statistics exactly: `simulate.ts` passes
 *     `(n) => (Math.random() * n) | 0`, the depth tests pass a seeded PRNG in the same shape, and
 *     `roundEngineTests.ts` passes `crypto.randomInt`, which is exactly uniform with no modulo
 *     bias. A shared float-to-index conversion here would have silently changed one of them.
 */

/** Uniform integer in [0, n). `crypto.randomInt` satisfies this exactly. */
export type RandBelow = (n: number) => number;

/** An 8-deck (by default) rank multiset: 1..13, `4 × decks` copies of each, in order. */
export function buildRankShoe(decks = 8): number[] {
  const ranks: number[] = [];
  for (let r = 1; r <= 13; r++) for (let k = 0; k < 4 * decks; k++) ranks.push(r);
  return ranks;
}

export interface LazyShuffler<T> {
  /** The live arrangement. Positions below `frontier()` are settled. */
  readonly items: T[];
  /** Number of positions, i.e. `items.length`. */
  readonly size: number;
  /** Fix every position up to and including `k`. Draws exactly `k + 1 − frontier()` randoms. */
  ensure(k: number): void;
  /** `ensure(k)` then read position `k`. */
  at(k: number): T;
  /** Begin a new round: frontier back to 0, arrangement kept (a continuous shuffler). */
  reset(): void;
  /** Current frontier — the first position not yet settled. */
  frontier(): number;
}

/**
 * Build a lazy Fisher-Yates shuffler over `items`, driven by the injected `randBelow`.
 * Constructing one draws no randomness; only `ensure`/`at` do.
 */
export function createLazyShuffler<T>(items: T[], randBelow: RandBelow): LazyShuffler<T> {
  const size = items.length;
  let f = 0;
  const ensure = (k: number): void => {
    while (f <= k) {
      const j = f + randBelow(size - f);
      const t = items[f]; items[f] = items[j]; items[j] = t;
      f++;
    }
  };
  return {
    items,
    size,
    ensure,
    at: (k: number): T => { ensure(k); return items[k]; },
    reset: (): void => { f = 0; },
    frontier: (): number => f,
  };
}
