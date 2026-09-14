/**
 * Side-bet house edges — exact, from the SAME evaluator the verifier scores live bets with.
 *
 * The report publishes Perfect Pairs 2.169% and 21+3 3.704%. Until round 2 those two figures were
 * derived by hand in `rtp-analysis.md` from a combination table typed into the prose, with no
 * code behind them and no row in the MANIFEST Model Anchors table (round-2 QA item 23).
 *
 * The enumeration itself now lives in `src/sidebet-edges.ts` — one implementation, two readers:
 * this anchor gate and `src/report-figures.ts`, which emits the same figures into
 * `outputs/report-figures.json` so the published percentages have a producing artifact instead of
 * living only inside a test (S-CONST). It enumerates the full 8-deck draw distribution and
 * classifies every combination with `src/sidebets.ts` — the evaluator Steps 15 and 16 use to
 * reconstruct all 11,600 live side-bet settlements, reading the paytables from `src/config.ts`.
 * So the published edge, the live-settlement check, the emitted artifact and the paytable
 * constants are one chain with no hand-copied number in it.
 *
 * The assertions below are on the exact REDUCED RATIONAL, not on a float, and each enumeration's
 * total weight is checked against C(416,k) so a bug in the hypergeometric weights cannot pass
 * silently.
 */

import { strict as assert } from 'node:assert';
import {
  perfectPairsEdgeExact, twentyOnePlusThreeEdgeExact, TYPES,
  SHOE_PAIR_COMBINATIONS, SHOE_TRIPLE_COMBINATIONS,
} from '../../src/sidebet-edges';
import { DECKS, SHOE_SIZE } from '../../src/config';

describe('side-bet house edges — exact enumeration through src/sidebets.ts', () => {
  it('the 8-deck shoe this enumerates is the shoe the game deals', () => {
    assert.equal(TYPES.length, 52);
    assert.equal(DECKS, 8);
    assert.equal(SHOE_SIZE, 416);
  });

  it('Perfect Pairs edge is exactly 9/415 (2.1687%)', () => {
    const e = perfectPairsEdgeExact();
    assert.equal(e.total, SHOE_PAIR_COMBINATIONS, 'enumeration weight ≠ C(416,2)');
    assert.equal(e.rational, '9/415',
      `Perfect Pairs edge is ${e.rational} (${e.edge}), expected 9/415 — the published 2.169% no longer follows from the paytable in src/config.ts`);
  });

  it('21+3 edge is exactly 4596/124085 (3.7039%)', () => {
    const e = twentyOnePlusThreeEdgeExact();
    assert.equal(e.total, SHOE_TRIPLE_COMBINATIONS, 'enumeration weight ≠ C(416,3)');
    assert.equal(e.rational, '4596/124085',
      `21+3 edge is ${e.rational} (${e.edge}), expected 4596/124085 — the published 3.704% no longer follows from the paytable in src/config.ts`);
  });

  it('the enumeration can fail: a richer coloured-pair payout moves the Perfect Pairs edge', () => {
    // Negative control. The published 13:1 coloured pair is one pip above the common 12:1;
    // the report says that one pip roughly halves the edge (4.096% -> 2.169%). Recompute the
    // 12:1 variant here so the claim is arithmetic, not assertion.
    const at12 = perfectPairsEdgeExact(12);
    assert.equal(at12.total, SHOE_PAIR_COMBINATIONS, 'enumeration weight ≠ C(416,2)');
    assert.ok(Math.abs(at12.edge - 0.04096) < 5e-5,
      `12:1 coloured pair should give ~4.096%, got ${(at12.edge * 100).toFixed(4)}%`);
    assert.ok(at12.edge > 2 * (9 / 415) * 0.9,
      'the 13:1 -> 12:1 change must move the edge, or this enumeration is not sensitive to the paytable');
  });
});
