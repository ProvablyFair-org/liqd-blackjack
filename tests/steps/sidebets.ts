/**
 * Steps 15–16: Side-bet correctness.
 *
 * For every placed side bet, re-derive the outcome from the cards alone (src/sidebets.ts,
 * LIQD's confirmed paytables) and confirm the recorded category + payout match. Payout is
 * a total return incl. stake: win → betAmount × (payoutToOne + 1); loss → 0.
 */

import { step } from './context';
import type { StepResult, VerifyContext } from './context';
import { initialTwo } from './hands';
import { evaluatePerfectPairs, evaluate21Plus3 } from '../../src/sidebets';
import type { SideDeclaration } from '../../src/types';
import { unitsOf, asMoney } from '../../src/money';

// Money is compared in INTEGER 1e-8 SETTLEMENT UNITS, not at a float tolerance — the same
// policy as tests/steps/payouts.ts, and for the same reason (round-4 QA-01): a 1e-6 tolerance
// rejects an impossible amount but ACCEPTS a wrong on-grid one, and a side-bet return is a
// whole-number multiple of the stake (paytables are 6/13/25 and 5/10/30/40/100 to one), so
// there is nothing here for a tolerance to absorb. GRID_TOL only covers reading a JSON double
// back onto the grid; measured worst noise over the capture is 1.2e-7 units.
// `unitsOf`/`asMoney` live in src/money.ts — ONE definition, shared with tests/steps/payouts.ts.

interface SB { playerHand?: string[]; betAmount?: number | string; winningAmount?: number | string; result?: string; gameResult?: string | null; }

/**
 * Expected record count for a side bet, taken from each round's `sideFunded`
 * declaration rather than from the side-bet records themselves.
 *
 * COVERAGE: guarding only against ZERO records is not enough — dropping all but one
 * record left Steps 15/16 printing "1 bets re-derived ... 0 mismatches" and PASSing,
 * so the suite asserted nothing while the report's headline rested on 5,800. Because
 * `sideFunded` is an independent per-round field, `checked === expected` catches a
 * shrunken denominator the way Steps 1, 6, 8, 22, 24 and 26 already do.
 *
 * PROVENANCE, stated because it changes what this denominator is worth (round-4 QA-08):
 * `sideFunded` is AUDITOR-RECORDED — the capture rig's record of what its own request funded
 * (`placeBetBody` in capture/capture-blackjack.reference.mjs), not a field the operator sent.
 * That is precisely why it is a usable denominator here — it cannot shrink along with the
 * operator's records — but it is a funding DECLARATION, not wallet evidence: no balance field
 * exists anywhere in the capture (L4). It is now typed on `Bet` in src/types.ts rather than
 * reached through an inline cast.
 */
function fundedCount(bets: VerifyContext['bets'], key: keyof SideDeclaration): number {
  return bets.filter((b) => !!b.sideFunded?.[key]).length;
}

export function run(ctx: VerifyContext): StepResult[] {
  const { bets } = ctx;
  const ppExpected = fundedCount(bets, 'perfectPair');
  const t3Expected = fundedCount(bets, 'twentyOnePlusThree');

  // ── Step 15: Perfect Pairs ──────────────────────────────────────────────────
  let ppChecked = 0, ppCatBad = 0, ppPayBad = 0;
  const ppCatCount: Record<string, number> = {};
  const ppFails: string[] = [];
  for (const b of bets) {
    const sb = b.sideBets.perfectPair as SB | null;
    if (!sb) continue;
    // Fallback is `initialTwo(b)`, NOT `playerHands[0].cards`: on a split round the main
    // hand's second card is a post-split draw, so the old fallback fed the evaluator the
    // wrong pair on 392 of the 401 split rounds. Inert on this capture (all 5,800 records
    // carry `playerHand`) but wrong where it would have been reached. See ./hands.ts.
    const cards = sb.playerHand || initialTwo(b);
    if (cards.length < 2) continue;
    const ev = evaluatePerfectPairs(cards[0], cards[1]);
    ppChecked++;
    ppCatCount[ev.category] = (ppCatCount[ev.category] || 0) + 1;
    const stakeUnits = unitsOf(sb.betAmount);
    const winUnits = unitsOf(sb.winningAmount);
    const expectUnits = stakeUnits === null ? null : ev.payout > 0 ? stakeUnits * (ev.payout + 1) : 0;
    if (sb.gameResult && ev.category !== sb.gameResult) { ppCatBad++; if (ppFails.length < 4) ppFails.push(`nonce ${b.nonce}: ${ev.category} != ${sb.gameResult}`); }
    if (winUnits === null || expectUnits === null || winUnits !== expectUnits) { ppPayBad++; if (ppFails.length < 4) ppFails.push(`nonce ${b.nonce}: pay ${String(sb.winningAmount)} != ${expectUnits === null ? 'off-grid stake' : asMoney(expectUnits)}`); }
  }
  // A scored step that passes over ZERO records asserts nothing. An earlier capture sent
  // the wrong request field name (`perfectPairBetAmount` — singular), which the API accepted
  // and silently dropped, so no Perfect Pairs bet was ever placed and this step "passed" on
  // an empty set. It now FLAGs when the dataset carries no Perfect Pairs record, so that
  // failure mode announces itself instead of reading as a clean pass.
  const ppCats = Object.entries(ppCatCount).filter(([k]) => k !== 'NO_PAIR').map(([k, v]) => `${k}:${v}`).join(', ');
  const ppCoverageOk = ppExpected > 0 && ppChecked === ppExpected;
  const s15 = step(15, 'Perfect Pairs Side Bet',
    ppChecked === 0 ? 'FLAG' : !ppCoverageOk ? 'FAIL' : ppCatBad === 0 && ppPayBad === 0 ? 'PASS' : 'FAIL',
    ppChecked === 0
      ? 'no Perfect Pairs bets present in the dataset — nothing to verify; this step asserts nothing until the side bet is actually wagered'
      : `${ppChecked}/${ppExpected} Perfect Pairs bets re-derived from the initial two cards against the 25/13/6 paytable, payouts compared as exact integer 1e-8 settlement units: ` +
        `${ppCatBad} category, ${ppPayBad} payout mismatch` +
        (ppCats ? `; winning categories ${ppCats}` : '') +
        (ppCoverageOk ? '' : `; COVERAGE FAIL: ${ppExpected} round(s) declare a funded Perfect Pairs bet but only ${ppChecked} record(s) were verified`) +
        (ppFails.length ? `; ${ppFails.slice(0, 3).join('; ')}` : ''));

  // ── Step 16: 21+3 ───────────────────────────────────────────────────────────
  let t3Checked = 0, t3CatBad = 0, t3PayBad = 0;
  const t3Fails: string[] = [];
  const catCount: Record<string, number> = {};
  for (const b of bets) {
    const sb = b.sideBets.twentyOnePlusThree as SB | null;
    if (!sb) continue;
    const cards = sb.playerHand || initialTwo(b); // split-aware — see Step 15's note
    const up = (b.dealerHand || [])[0];
    if (cards.length < 2 || !up) continue;
    const ev = evaluate21Plus3(cards[0], cards[1], up);
    t3Checked++;
    catCount[ev.category] = (catCount[ev.category] || 0) + 1;
    const stakeUnits = unitsOf(sb.betAmount);
    const winUnits = unitsOf(sb.winningAmount);
    const expectUnits = stakeUnits === null ? null : ev.payout > 0 ? stakeUnits * (ev.payout + 1) : 0;
    if (sb.gameResult && ev.category !== sb.gameResult) { t3CatBad++; if (t3Fails.length < 4) t3Fails.push(`nonce ${b.nonce}: ${ev.category} != ${sb.gameResult}`); }
    if (winUnits === null || expectUnits === null || winUnits !== expectUnits) { t3PayBad++; if (t3Fails.length < 4) t3Fails.push(`nonce ${b.nonce}: pay ${String(sb.winningAmount)} != ${expectUnits === null ? 'off-grid stake' : asMoney(expectUnits)}`); }
  }
  // COVERAGE: like Step 15, a pass over ZERO 21+3 records asserts nothing — FLAG if none present.
  const wins = Object.entries(catCount).filter(([k]) => k !== 'NO_MATCH').map(([k, v]) => `${k}:${v}`).join(', ');
  const t3CoverageOk = t3Expected > 0 && t3Checked === t3Expected;
  const s16 = step(16, '21+3 Side Bet',
    t3Checked === 0 ? 'FLAG' : !t3CoverageOk ? 'FAIL' : t3CatBad === 0 && t3PayBad === 0 ? 'PASS' : 'FAIL',
    t3Checked === 0
      ? 'no 21+3 bets present in the dataset — nothing to verify; this step asserts nothing until the side bet is actually wagered'
      : `${t3Checked}/${t3Expected} 21+3 bets re-derived (5/10/30/40/100), payouts compared as exact integer 1e-8 settlement units: ${t3CatBad} category, ${t3PayBad} payout mismatch` +
        (wins ? ` [${wins}]` : '') +
        (t3CoverageOk ? '' : `; COVERAGE FAIL: ${t3Expected} round(s) declare a funded 21+3 bet but only ${t3Checked} record(s) were verified`) +
        (t3Fails.length ? '; ' + t3Fails.slice(0, 3).join('; ') : ''));

  return [s15, s16];
}
