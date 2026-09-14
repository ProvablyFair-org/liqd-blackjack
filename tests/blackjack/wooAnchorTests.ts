import { strict as assert } from 'node:assert';
import { solveExact } from '../../src/exact-play';

/**
 * Published external anchor — Wizard of Odds house-edge calculator.
 *
 * The tiny-shoe rational oracle (exactOracleTests.ts) anchors the ENGINE; this test
 * anchors the HEADLINE against a reference produced entirely outside this repo.
 *
 * Source:   https://wizardofodds.com/games/blackjack/calculator/  (captured 2026-08-23)
 * Settings: 8 decks, dealer stands soft 17, double after split, double on any first
 *           two cards, split to 2 hands (no re-split), no re-split aces, no hit split
 *           aces, player loses only original bet vs dealer BJ (peek/OBO), no
 *           surrender, blackjack pays 3:2 — the confirmed LIQD rule set.
 * Figure:   "Basic strategy with continuous shuffler" = 0.48768% house edge. That is
 *           total-dependent basic strategy with a reshuffle every hand — exactly the
 *           regime of our finite 8-deck TD solve (LIQD reshuffles every hand).
 *
 * Tolerance: one ulp of the published figure. WoO publishes 5 decimal places of
 * percent, so the underlying value is known only to ±1e-5 pp (1e-7 in fraction); our
 * exact 0.4876748% sits 5.2e-8 from the rounded 0.0048768. The pre-fix defective
 * solver was 1.48e-5 away — two orders of magnitude outside this gate — so the test
 * demonstrably fails on the error class it exists to catch.
 *
 * NOTE: this 1e-7 gate is a REGRESSION PIN on the observed 8-deck agreement, not a claim that WoO
 * resolves to 1e-7. WoO's published continuous-shuffler figures are good to ~1e-4 pp (see the
 * precision residual in reproducibility.md; at 6 decks the same engine reads 0.459936% vs a
 * published 0.45999%). The engine's own 1e-12 pin (exactSolverTests.ts) is the PRIMARY drift guard;
 * if WoO republishes with a >1e-5 pp change while the engine is unmoved, re-pin this constant.
 */
const WOO_BASIC_CSM_EDGE = 0.0048768; // 0.48768% per initial bet, published at 5 dp
const ONE_ULP = 1e-7;                 // resolution of the published figure, in fraction

describe('blackjack: published external anchor (Wizard of Odds, 8-deck LIQD rule set)', () => {
  it('exact 8-deck TD edge matches the published 0.48768% at published precision', function () {
    this.timeout(300_000);
    const td = solveExact({ kind: 'finite', decks: 8 }, 'TD');
    const delta = td.edgePerInitialBet - WOO_BASIC_CSM_EDGE;
    assert.ok(
      Math.abs(delta) <= ONE_ULP,
      `exact 8-deck TD edge ${(td.edgePerInitialBet * 100).toFixed(6)}% vs published ` +
      `0.48768% — delta ${(delta * 100).toExponential(3)} pp exceeds one ulp of the ` +
      'published figure. Either the engine regressed or the anchor is stale.',
    );
  });

  it('the anchor can fail: the pre-fix defective edge is far outside the gate', () => {
    // SCOPE, stated in round 4 (QA-10). This is a MATHEMATICAL SANITY CHECK on the anchor's
    // WIDTH: it shows that a historically real wrong value — the peek-conditioning-defective
    // solve this repo once shipped — sits two orders of magnitude outside the tolerance above,
    // so the anchor is not a gate that cannot fail. It is an inequality between two constants.
    // It does NOT execute any faulty code path and would not notice a payout regression in the
    // round engine; the executed demonstration of that is mutation R37 (`npm run mutate -- 40`),
    // which changes the engine's own natural settlement and turns a named assertion red.
    const preFixEdge = 0.004862001075398866; // the peek-conditioning-defective figure
    assert.ok(
      Math.abs(preFixEdge - WOO_BASIC_CSM_EDGE) > ONE_ULP * 100,
      'the pre-fix value must sit well outside the anchor tolerance, or this gate guards nothing',
    );
  });
});
