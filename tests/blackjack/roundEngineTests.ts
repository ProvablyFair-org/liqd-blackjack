/**
 * BINDING TEST for `src/round-engine.ts`.
 *
 * That module is a deliberate SECOND copy of the round logic inside `src/simulate.ts` — the
 * original cannot be imported (simulate.ts runs a 30M-round Monte-Carlo on import) and cannot be
 * refactored either, because the artifact it produced is frozen and hash-pinned, so a refactor
 * could not be re-run to prove it behaviour-preserving. See that module's header.
 *
 * A duplicate that nothing checks is a duplicate that drifts. This test pins it to the exact
 * 8-deck TD solve — the same quantity, computed by a completely different method (dynamic
 * programming over the shoe composition rather than dealt rounds). If the copy stopped playing
 * the audited strategy, or mis-settled a double, a split or a natural, this fails.
 *
 * THE SHOE. Cards are drawn from a LAZY Fisher-Yates shuffle (`src/shuffle.ts`, the same
 * implementation `src/simulate.ts` uses) fed by `crypto.randomInt`, which is exactly uniform.
 * The frontier advances on demand, so every index the engine reads was shuffled for that round
 * at any depth. This replaces a fixed 24-card pre-shuffle that rested on the stated premise
 * "a round never consumes more" — round-4 QA-03 executed the counterexample below and that
 * premise is false, so the old version could read an UNSHUFFLED tail and the "fair shuffle"
 * behind this binding was not held on deep rounds. It is also cheaper: ~5.7 draws per round
 * instead of 24.
 *
 * THE GATE, stated as implemented (round-4 QA-05). Fresh entropy each run (never a pinned seed
 * array), so the estimate carries real sampling error. The test compares the run's point estimate
 * of the edge PER INITIAL BET — one convention, not two — against `solveExact(...).edgePerInitialBet`,
 * and fails when the deviation exceeds 5 × SIM_SD_PER_ROUND / √ROUNDS. With SIM_SD_PER_ROUND =
 * 1.15 (the CONFIGURED constant in src/config.ts — the per-round SD measured at 1.146718922176392
 * and rounded up, never re-measured by this run) and ROUNDS = 2,000,000, the acceptance window is
 *
 *     5 × 1.15 / √2,000,000 × 100  =  0.4065864 percentage points.
 *
 * That is the WIDTH of the window, and it is a false-failure budget (5σ ≈ 1 in 1.7 million), not a
 * detection guarantee: a true drift of exactly that size would be caught only about half the time.
 * A claim about power would need a power calculation, and none is made here.
 */

import * as assert from 'assert';
import { randomInt } from 'crypto';

import { settleShoeAt } from '../../src/round-engine';
import { solveExact } from '../../src/exact-play';
import { buildShoeTemplate } from '../../src/rng';
import { createLazyShuffler } from '../../src/shuffle';
import { SIM_SD_PER_ROUND, DECKS } from '../../src/config';

describe('round-engine — the duplicated round logic still plays the audited game', () => {
  it('its Monte-Carlo RTP agrees with the exact 8-deck TD solve within 5 sigma', () => {
    const ROUNDS = 2_000_000;
    // `randomInt` is a uniform integer source with no modulo bias; the shuffler asks it for an
    // index in [f, size) one position at a time, so no depth constant appears anywhere here.
    const shuffler = createLazyShuffler(buildShoeTemplate(), randomInt);

    let wagered = 0;
    let returned = 0;
    for (let r = 0; r < ROUNDS; r++) {
      shuffler.reset();
      const [w, ret] = settleShoeAt((i) => shuffler.at(i));
      wagered += w; returned += ret;
    }

    const exact = solveExact({ kind: 'finite', decks: DECKS }, 'TD');
    // Per INITIAL bet: total net loss divided by the number of rounds, matching
    // `edgePerInitialBet` (NOT divided by total wagered, which is the other convention).
    const simEdgePerInitial = (wagered - returned) / ROUNDS;
    const se = SIM_SD_PER_ROUND / Math.sqrt(ROUNDS);
    const dev = Math.abs(simEdgePerInitial - exact.edgePerInitialBet);

    assert.ok(dev <= 5 * se,
      `round-engine edge ${(simEdgePerInitial * 100).toFixed(4)}% per initial bet vs exact ` +
      `${(exact.edgePerInitialBet * 100).toFixed(6)}% = ${(dev / se).toFixed(2)} sigma (limit 5, ` +
      `window ±${(5 * se * 100).toFixed(7)} pp). ` +
      `Over ${ROUNDS.toLocaleString()} rounds, wagered ${wagered.toFixed(0)}, returned ${returned.toFixed(0)}. ` +
      'The duplicated round logic in src/round-engine.ts has drifted from the audited strategy.');
  });

  it('every card the engine reads was shuffled for that round — instrumented, at real depths', () => {
    // The property the 24-card pre-shuffle silently lost, checked per access rather than argued.
    // The frontier is read immediately AFTER each access: `at(i)` must have advanced it past `i`,
    // so `i >= frontier()` means the engine consumed a position this round never settled. Under a
    // capped frontier (mutation R38's edit) that is exactly what happens the moment a round reads
    // past the cap, so the assertion is not vacuous — it is the frontier-cap detector.
    const shuffler = createLazyShuffler(buildShoeTemplate(), randomInt);
    let unshuffled = 0;
    let deepest = 0;
    for (let r = 0; r < 200_000; r++) {
      shuffler.reset();
      settleShoeAt((i) => {
        const card = shuffler.at(i);
        if (i >= shuffler.frontier()) unshuffled++;
        if (i > deepest) deepest = i;
        return card;
      });
    }
    assert.equal(unshuffled, 0, `${unshuffled} card(s) were read from a position the round had not shuffled`);
    assert.ok(deepest >= 4, `instrumented run only ever reached index ${deepest}`);

    // HOW DEEP A REAL ROUND ACTUALLY GOES, measured rather than assumed — and why sampling alone
    // could never have refuted the 24-card premise. Over 200,000 rounds of this run the deepest
    // index read is typically ~13 (measured 13 on 2026-09-10, with 3 rounds reaching it); indices
    // at or past 24 did not occur once. The old bound was therefore empirically comfortable and
    // still wrong, which is why the refutation below is a CONSTRUCTED witness, not a longer run.
    //
    // The deterministic half of the guard, which does not depend on hitting a deep round by luck:
    // asking for a deep index must settle it, at any depth. A capped frontier fails here every run.
    shuffler.reset();
    shuffler.at(40);
    assert.equal(shuffler.frontier(), 41,
      'ensure() must settle every index up to and including the one requested — a capped shuffle frontier fails here');
    shuffler.reset();
    shuffler.at(415);
    assert.equal(shuffler.frontier(), 416, 'the last position of the shoe must be reachable and settled');
  });

  it('reconstructs a valid round that reads through shoe index 32', () => {
    // The counterexample the reviewer executed. Player splits a pair of 2s; each hand runs
    // [2,A,A,A,A,A,5,A,A,A,A,A] to a hard 17 (12 cards); the dealer runs [7,2,2,A,A,A,A,A,A] to
    // 17 (9 cards). 4 dealt + 11 + 11 + 7 = 33 cards, indices 0..32 — nine past the bound the
    // old test asserted as a fact. Both hands push, so [wagered, returned] = [2, 2].
    const witness = [
      'CLUB:2', 'CLUB:7', 'DIAMOND:2', 'HEART:2',                                   // PDPD
      'CLUB:1', 'CLUB:1', 'CLUB:1', 'CLUB:1', 'CLUB:1', 'CLUB:5',                   // split hand 1
      'DIAMOND:1', 'DIAMOND:1', 'DIAMOND:1', 'DIAMOND:1', 'DIAMOND:1',
      'HEART:1', 'HEART:1', 'HEART:1', 'HEART:1', 'HEART:1', 'DIAMOND:5',           // split hand 2
      'SPADE:1', 'SPADE:1', 'SPADE:1', 'SPADE:1', 'SPADE:1',
      'SPADE:2', 'CLUB:1', 'CLUB:1', 'CLUB:1', 'CLUB:1', 'CLUB:1', 'CLUB:1',        // dealer
    ];
    assert.equal(witness.length, 33);
    const read: number[] = [];
    const [wagered, returned] = settleShoeAt((i) => {
      read.push(i);
      assert.ok(i < witness.length, `the engine read index ${i}, past the ${witness.length}-card witness`);
      return witness[i];
    });
    assert.equal(Math.max(...read), 32, 'the witness must reach index 32 or it does not refute the 24-card bound');
    assert.equal(new Set(read).size, 33, 'the round must consume 33 distinct positions');
    assert.deepEqual([wagered, returned], [2, 2], 'both split hands push against a dealer 17');
    // The bound this test used to assert. Stated as a refutation so it cannot creep back.
    assert.ok(Math.max(...read) >= 24, 'a round CAN consume more than 24 cards — the old premise was false');
  });

  it('the gate is tight enough to see a 3:2 -> 1:1 downgrade of the natural', () => {
    // Falsifiability of the gate itself, stated in the units the gate uses. A player natural
    // occurs on ~4.75% of rounds and returns 2.5x; returning 2x instead removes about
    // 0.5 x 0.0475 of a unit per round from the player, which is far outside 5 sigma at the
    // round count above.
    //
    // SCOPE, corrected in round 4 (QA-10): this is a MATHEMATICAL SANITY CHECK on the gate's
    // width, not an execution of the faulty payout path. It reads a live `solveExact()` result
    // (playerBlackjackFreq), so it is not merely an inequality between literals — but it does
    // not mutate `playRound`'s natural settlement, and it would not notice if that settlement
    // were wrong. The executed demonstration that a 2.5x -> 2x change in the ENGINE is caught is
    // mutation R37 in tests/mutations.json, run by `npm run mutate`.
    const exact = solveExact({ kind: 'finite', decks: DECKS }, 'TD');
    const shift = 0.5 * exact.playerBlackjackFreq;
    const se = SIM_SD_PER_ROUND / Math.sqrt(2_000_000);
    assert.ok(shift > 5 * se,
      `a 3:2 -> 1:1 downgrade shifts the edge by ${(shift * 100).toFixed(4)} pp, which must exceed ` +
      `the ${(5 * se * 100).toFixed(7)} pp gate above`);
  });
});
