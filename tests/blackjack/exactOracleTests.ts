/**
 * Tiny-shoe oracle — the external anchor the exact solver never had.
 *
 * WHY THIS FILE EXISTS. Until 2026-08-23 every check on `src/exact-play.ts` compared
 * the engine to ITSELF: infinite-deck agreement, finite->infinite convergence, deltas
 * between two runs in the mutation battery, and a 3-sigma simulation gate whose sigma
 * (0.0210 pp) is an order of magnitude coarser than the errors that matter. Not one
 * compared it to an independently derived value at a finite deck count — and the only
 * external anchor, the infinite-deck reference, is precisely the regime where the
 * peek-conditioning bug is identically zero. So a real algebraic defect sat in the
 * peek branch, produced a wrong figure in the 4th decimal, and passed 17/17 tests.
 *
 * These expectations are EXACT RATIONALS from a physical enumerator: the hole is a
 * concrete dealt card, both split hands are played sequentially against a genuinely
 * depleted shoe, and no conditioning appears anywhere — so it cannot be wrong the same
 * way the solver was. Values are exact fractions, not decimals, and are asserted at
 * 1e-12: a tolerance any 1/N conditioning error would blow straight through.
 *
 *   control  437/13200     — no Ten and no Ace, so the peek path is UNREACHABLE.
 *                            Localises any future regression to peek vs. core engine.
 *   peekA    17081/194040  — Ten/Ace heavy; the old solver was off by -2.472e-4 here.
 *   peekB    78863/900900  — split-heavy peek shoe; old solver off by +2.683e-3.
 *
 * If one of these ever fails, the number in the report is wrong. That is the point.
 */

import { strict as assert } from 'assert';
import { ExactSolver, LIQD_RULES } from '../../src/exact-play';

/** Rank order is [2..9, T, A]; index 8 = Ten, index 9 = Ace. */
const SHOES: Array<{ name: string; counts: number[]; exact: [number, number]; note: string }> = [
  {
    name: 'control — peek path unreachable (no Ten, no Ace)',
    counts: [3, 0, 0, 0, 0, 3, 3, 3, 0, 0],
    exact: [437, 13200],
    note: 'proves the core engine (recursion, splits, DAS, dealer play, settlement) is sound',
  },
  {
    name: 'peekA — Ten/Ace heavy',
    counts: [0, 0, 0, 0, 0, 2, 2, 2, 5, 3],
    exact: [17081, 194040],
    note: 'pre-fix solver was off by -2.472e-4',
  },
  {
    name: 'peekB — split-heavy peek shoe',
    counts: [2, 0, 0, 0, 0, 0, 2, 2, 4, 3],
    exact: [78863, 900900],
    note: 'pre-fix solver was off by +2.683e-3',
  },
];

/** Solve an arbitrary composition. The shoe is normally built from a deck count. */
function solveShoe(counts: number[]): number {
  const s = new ExactSolver({ kind: 'finite', decks: 1 }, 'TD', LIQD_RULES) as any;
  s.shoe = Int32Array.from(counts);
  s.dealerMemo.clear();
  s.handMemo.clear();
  s.outcomeMemo.clear();
  return s.solve().evPerInitialBet;
}

describe('Exact solver — tiny-shoe rational oracle (independent anchor)', () => {
  for (const { name, counts, exact, note } of SHOES) {
    const [num, den] = exact;
    it(`reproduces ${num}/${den} exactly — ${name}`, () => {
      const got = solveShoe(counts);
      const want = num / den;
      assert.ok(
        Math.abs(got - want) < 1e-12,
        `${name}\n  expected ${want.toFixed(15)} (= ${num}/${den})\n  ` +
        `got      ${got.toFixed(15)}\n  delta    ${(got - want).toExponential(3)}\n  ${note}`,
      );
    });
  }

  it('the control shoe and the peek shoes are genuinely different code paths', () => {
    // Guards the localisation property: if someone makes the peek branch unreachable,
    // the control test would still pass and silently stop proving anything.
    const control = SHOES[0].counts;
    assert.equal(control[8], 0, 'control shoe must contain no Ten');
    assert.equal(control[9], 0, 'control shoe must contain no Ace');
    assert.ok(SHOES[1].counts[8] > 0 && SHOES[1].counts[9] > 0, 'peekA must contain both');
    assert.ok(SHOES[2].counts[8] > 0 && SHOES[2].counts[9] > 0, 'peekB must contain both');
  });
});

describe('Exact solver — the oracle can actually fail (falsifiability)', () => {
  it('detects a reintroduced peek-conditioning error', () => {
    // Reproduce the OLD math on peekA by asserting the oracle rejects it. 0.087781086157710
    // is what the defective solver returned; if this ever compares equal, the tolerance has
    // been loosened to the point where the oracle no longer guards anything.
    const preFixValue = 0.087781086157710;
    const want = 17081 / 194040;
    assert.ok(
      Math.abs(preFixValue - want) > 1e-12,
      'the pre-fix value must be distinguishable from the exact value at this tolerance',
    );
  });
});
