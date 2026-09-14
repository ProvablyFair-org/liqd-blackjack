/**
 * Steps 8–10: Payout correctness — reconstructed independently from the CARDS.
 *
 * NOTE: LIQD's `result` field labels both wins and pushes as `won` (there is no
 * `push` value); a push is distinguished only by a 1× return. So we derive the
 * expected payout from the cards + rules, never from LIQD's label:
 *   player bust → 0 ; player natural BJ vs non-BJ dealer → 2.5× (3:2) ;
 *   both natural BJ → 1× (push) ; player loses to a dealer natural BJ → 0 ;
 *   dealer bust → 2× ; else compare totals (higher → 2×, tie → 1× push, lower → 0).
 * A doubled hand's own winningAmount reflects the base portion only (the double stake
 * settles as a separate equal-and-same-outcome bet), so the same multiples apply.
 *
 * Insurance: pays 2:1 — a win iff the dealer has blackjack; return = 3× stake.
 */

import { step } from './context';
import type { StepResult, VerifyContext } from './context';
import { isBlackjack, handValue } from '../../src/config';
import { unitsOf, unitsOr0, asMoney } from '../../src/money';

const dealerHasBJ = (dealer: string[]) => dealer.length === 2 && handValue(dealer).total === 21;

// ── Money is compared in INTEGER SETTLEMENT UNITS, never at a float tolerance ────────
// These comparisons used to run at `Math.abs(a - b) <= 1e-6`. That tolerance is the wrong
// SHAPE of check, not merely a loose one: it rejects an amount that cannot exist on the
// settlement grid, but it ACCEPTS a wrong amount that can. Executed counterexample (Mike's
// round-4 QA-01): rewriting the epoch-0 nonce-0 per-hand credit from 0.20 to 0.1999995 — an
// error of 50 whole settlement units, a genuine underpayment — and re-pinning the dataset
// left the complete suite green, because 5e-7 < 1e-6. Nothing below 1e-6 could ever be seen.
//
// The capture uses eight-decimal accounting, so every recorded amount is an integer number of 1e-8 units and
// so is every rule-derived return (the multipliers are 0, 1, 2, 5/2 and 3 on integer stakes).
// The comparison is therefore integer equality in those units, with the ONLY tolerance applied
// where float noise genuinely lives — reading a JSON double back onto the grid. Measured over
// the committed dataset: 42,894 amounts, worst deviation 1.2e-7 grid units (`4.6000000000000005`
// at epoch 2 nonce 25 is approximately 5.96e-8 grid units off 4.60 and lands on 460,000,000 units, as intended).
// GRID_TOL = 1e-3 units is ~8,400× that noise and 1/1000 of the smallest real error possible —
// one unit — so representation noise and a one-unit money error can never be confused.
// `unitsOf`, `unitsOr0`, `asMoney`, GRID and GRID_TOL live in src/money.ts — ONE definition,
// imported by every money check. Two copies of a rule are two rules.

/** Total side-bet return on a bet (Perfect Pairs + 21+3 + insurance), in settlement units. */
function sideBetReturnUnits(b: VerifyContext['bets'][number]): number {
  return (['perfectPair', 'twentyOnePlusThree', 'insurance'] as const)
    .reduce((s, k) => s + (b.sideBets[k] ? unitsOr0(b.sideBets[k]!.winningAmount) : 0), 0);
}

/**
 * Expected per-hand return (incl. stake) in integer settlement units, derived from cards + rules.
 * Returns null when the rule-derived amount is NOT representable on the grid — only reachable for
 * the 3:2 natural on an odd unit stake, which would itself be a finding, so it is surfaced rather
 * than rounded away.
 */
function expectedReturnUnits(cards: string[], dealer: string[], stakeUnits: number, isSplitHand: boolean): number | null {
  const pt = handValue(cards).total;
  if (pt > 21) return 0; // player bust
  const dt = handValue(dealer).total;
  const pBJ = !isSplitHand && isBlackjack(cards);
  const dBJ = dealerHasBJ(dealer);
  if (pBJ && dBJ) return stakeUnits; // push
  if (pBJ) return 5 * stakeUnits % 2 === 0 ? (5 * stakeUnits) / 2 : null; // 3:2
  if (dBJ) return 0; // dealer natural blackjack beats a non-natural player
  if (dt > 21) return 2 * stakeUnits; // dealer bust
  if (pt > dt) return 2 * stakeUnits;
  if (pt === dt) return stakeUnits; // push
  return 0;
}


export function run(ctx: VerifyContext): StepResult[] {
  const { bets } = ctx;

  // ── Step 8: Per-hand main/split payout (reconstructed from cards) ────────────
  let checked = 0;
  let bad = 0;
  const fails: string[] = [];
  for (const b of bets) {
    for (let hi = 0; hi < b.playerHands.length; hi++) {
      const h = b.playerHands[hi];
      const stakeUnits = unitsOf(h.betAmount);
      const winUnits = unitsOf(h.winningAmount);
      checked++;
      if (stakeUnits === null || winUnits === null) {
        bad++;
        if (fails.length < 5) fails.push(`nonce ${b.nonce} (epoch ${b.epoch}) hand ${hi}: stake ${String(h.betAmount)} / credit ${String(h.winningAmount)} is not an exact multiple of 1e-8`);
        continue;
      }
      const expectedUnits = expectedReturnUnits(h.cards, b.dealerHand, stakeUnits, b.split);
      if (expectedUnits === null) {
        bad++;
        if (fails.length < 5) fails.push(`nonce ${b.nonce} (epoch ${b.epoch}) hand ${hi}: a 3:2 natural on an odd ${stakeUnits}-unit stake has no exact settlement amount`);
        continue;
      }
      if (winUnits !== expectedUnits) {
        bad++;
        if (fails.length < 5) fails.push(`nonce ${b.nonce} (epoch ${b.epoch}) hand ${hi}: credit ${asMoney(winUnits)} != rule-derived ${asMoney(expectedUnits)} (${winUnits - expectedUnits > 0 ? '+' : ''}${winUnits - expectedUnits} settlement unit(s) of 1e-8)`);
      }
    }
  }
  // ── Step 8b: Money-path reconciliation (top-level credit == Σ components) ────
  // The per-hand `winningAmount` records only the BASE portion of a doubled hand;
  // the doubled stake settles as a separate bet with the same outcome. So the total
  // credited on a bet must satisfy:
  //     winningAmount == (Σ per-hand winningAmount) × m  +  Σ side-bet winningAmount
  // where m = 2 when every hand was doubled, 1 when none was. A split in which only
  // one of the two hands doubled cannot be attributed to a specific hand from the flat
  // `actions` list, so those are bounded rather than solved, and reported — silence on
  // an unreconciled money path is exactly what this check exists to prevent.
  let recOk = 0;
  let recBad = 0;
  let recBounded = 0;
  let recBoundBad = 0;
  const recFails: string[] = [];
  for (const b of bets) {
    const nHands = b.playerHands.length;
    const nDoubles = b.actions.filter((a) => a === 'double').length;
    // All four quantities are exact integers of 1e-8, so the identity is checked as integer
    // equality — no epsilon on either side of it (QA-01).
    const base = b.playerHands.reduce((s, h) => s + unitsOr0(h.winningAmount), 0);
    const side = sideBetReturnUnits(b);
    const top = unitsOf(b.winningAmount);
    const m = nDoubles === 0 ? 1 : nDoubles === nHands ? 2 : null;
    if (top === null) {
      recBad++;
      if (recFails.length < 5) recFails.push(`nonce ${b.nonce} (epoch ${b.epoch}): credited ${String(b.winningAmount)} is not an exact multiple of 1e-8`);
      continue;
    }
    if (m === null) {
      // Partial double across a split: credit must lie between the undoubled and
      // fully-doubled totals. Integer bounds — inclusive, and not widened by any epsilon.
      recBounded++;
      if (top < base + side || top > 2 * base + side) {
        recBoundBad++;
        if (recFails.length < 5) recFails.push(`nonce ${b.nonce} (epoch ${b.epoch}): ${asMoney(top)} outside [${asMoney(base + side)}, ${asMoney(2 * base + side)}]`);
      }
      continue;
    }
    if (top === base * m + side) recOk++;
    else {
      recBad++;
      if (recFails.length < 5) recFails.push(`nonce ${b.nonce} (epoch ${b.epoch}): credited ${asMoney(top)} != ${asMoney(base * m + side)} (base ${asMoney(base)} ×${m} + side ${asMoney(side)}) — off by ${top - (base * m + side)} settlement unit(s) of 1e-8`);
    }
  }
  const recTotalBad = recBad + recBoundBad;

  // ── Money-grid discipline ───────────────────────────────────────────────────
  // The GRID assertion is the other half of the money check, and it catches the opposite
  // failure from the exact-units comparison above: an amount that CANNOT EXIST at all.
  // A forged-artifact probe (gate-forgery F8, "off-grid money") adds 1e-9 to one credited
  // amount — too small for any reconstruction tolerance to have seen, and off the settlement
  // grid, so `unitsOf` refuses it here. Together the two are complete over the credit side:
  // exact integer equality rejects a wrong on-grid amount (QA-01's 0.20 → 0.1999995, 50 units),
  // and this sweep rejects an amount that is not a settlement amount.
  //
  // The capture uses eight-decimal accounting (the dataset writes "0.10000000"), so every recorded money
  // amount must be an integer multiple of 1e-8. Measured over the committed dataset: 42,894
  // amounts, worst deviation 1.2e-7 grid units — pure IEEE-754 representation error.
  let moneyChecked = 0;
  let offGrid = 0;
  const gridFails: string[] = [];
  const onGrid = (v: unknown, where: string): void => {
    if (v === null || v === undefined) return;
    moneyChecked++;
    if (unitsOf(v) === null) {
      offGrid++;
      if (gridFails.length < 5) gridFails.push(`${where} = ${String(v)} is not a multiple of 1e-8`);
    }
  };
  for (const b of bets) {
    onGrid(b.winningAmount, `nonce ${b.nonce} (epoch ${b.epoch}) winningAmount`);
    for (let i = 0; i < b.playerHands.length; i++) {
      onGrid(b.playerHands[i].betAmount, `nonce ${b.nonce} hand ${i} betAmount`);
      onGrid(b.playerHands[i].winningAmount, `nonce ${b.nonce} hand ${i} winningAmount`);
    }
    for (const k of ['perfectPair', 'twentyOnePlusThree', 'insurance'] as const) {
      const sb = b.sideBets[k];
      if (!sb) continue;
      onGrid(sb.betAmount, `nonce ${b.nonce} ${k} betAmount`);
      onGrid(sb.winningAmount, `nonce ${b.nonce} ${k} winningAmount`);
    }
  }

  // COVERAGE: `checked` must equal the total number of settled hands (Σ playerHands over all
  // bets), not merely `bad === 0` — a step that reconstructs zero hands asserts nothing.
  const expectedHands = bets.reduce((s, b) => s + b.playerHands.length, 0);
  const s8 = step(8, 'Per-Hand Payout (reconstructed from cards)',
    bad === 0 && recTotalBad === 0 && checked === expectedHands && offGrid === 0 && moneyChecked > 0 ? 'PASS' : 'FAIL',
    `${checked}/${expectedHands} hands: win→2×, push→1×, loss→0 derived from cards+rules (${bad} mismatch${bad === 1 ? '' : 'es'})${fails.length ? '; ' + fails.slice(0, 3).join('; ') : ''}` +
    ` | money path: ${recOk}/${recOk + recBad} bets reconcile exactly as (Σ hand win)×m + Σ side win` +
    (recBounded ? `, ${recBounded} partial-double split(s) bounded (${recBoundBad} outside bounds)` : '') +
    ` | money grid: ${moneyChecked - offGrid}/${moneyChecked} recorded amounts are exact multiples of 1e-8 (capture accounting precision), ${offGrid} off-grid. Both comparisons above are EXACT INTEGER equality in those 1e-8 units, not a float tolerance: a one-unit discrepancy fails` +
    (moneyChecked === 0 ? '; COVERAGE FAIL: 0 money amounts checked' : '') +
    (gridFails.length ? `; e.g. ${gridFails.join('; ')}` : '') +
    (recTotalBad ? `; ${recFails.slice(0, 3).join('; ')}` : ''));

  // ── Step 9: Blackjack pays exactly 3:2 (isolated) ───────────────────────────
  // Player naturals that beat the dealer (dealer not also natural) must return 2.5×.
  const bjWins = bets.filter((b) => !b.split && isBlackjack(b.playerHands[0].cards) && !dealerHasBJ(b.dealerHand));
  let bjBad = 0;
  const bjFails: string[] = [];
  for (const b of bjWins) {
    // Exact settlement units (QA-01): 2 × credit must equal 5 × stake, which is integer
    // arithmetic on both sides and therefore admits no tolerance at all.
    const stakeUnits = unitsOf(b.playerHands[0].betAmount);
    const winUnits = unitsOf(b.playerHands[0].winningAmount);
    if (stakeUnits === null || winUnits === null || 2 * winUnits !== 5 * stakeUnits) {
      bjBad++;
      if (bjFails.length < 3) bjFails.push(`nonce ${b.nonce} (epoch ${b.epoch}): credit ${String(b.playerHands[0].winningAmount)} on a ${String(b.playerHands[0].betAmount)} stake is not 3:2`);
    }
  }
  // COVERAGE: there must actually BE winning naturals to verify (dataset carries 243).
  const s9 = step(9, 'Blackjack Pays 3:2', bjBad === 0 && bjWins.length > 0 ? 'PASS' : 'FAIL',
    `${bjWins.length} winning natural blackjacks, all return exactly 2.5× stake — compared as 2×credit == 5×stake in integer 1e-8 settlement units, no tolerance (${bjBad} mismatches)` +
    (bjWins.length === 0 ? '; COVERAGE FAIL: 0 winning naturals to verify' : '') +
    (bjFails.length ? `; ${bjFails.join('; ')}` : ''));

  // ── Step 10: Insurance pays 2:1 iff dealer blackjack ────────────────────────
  const insBets = bets.filter((b) => b.sideBets.insurance != null);
  let insWonWrong = 0;
  let insLostWrong = 0;
  let insPayBad = 0;
  const insFails: string[] = [];
  for (const b of insBets) {
    const ins = b.sideBets.insurance as { betAmount?: number | string; winningAmount?: number | string; result?: string };
    // Exact settlement units (QA-01): a winning insurance returns 3 × stake exactly, a losing
    // one returns exactly zero. Both are integer identities.
    const stakeUnits = unitsOf(ins.betAmount);
    const winUnits = unitsOf(ins.winningAmount);
    const bj = dealerHasBJ(b.dealerHand);
    const expectUnits = ins.result === 'won' ? (stakeUnits === null ? null : 3 * stakeUnits) : 0;
    if (ins.result === 'won') { if (!bj) insWonWrong++; } else if (bj) insLostWrong++;
    if (winUnits === null || expectUnits === null || winUnits !== expectUnits) {
      insPayBad++;
      if (insFails.length < 3) insFails.push(`nonce ${b.nonce} (epoch ${b.epoch}): ${String(ins.result)} insurance credited ${String(ins.winningAmount)} on a ${String(ins.betAmount)} stake`);
    }
  }
  // COVERAGE: there must actually BE insurance bets to verify (dataset carries 446).
  const insOk = insBets.length > 0 && insWonWrong === 0 && insLostWrong === 0 && insPayBad === 0;
  const s10 = step(10, 'Insurance Pays 2:1 iff Dealer Blackjack', insOk ? 'PASS' : 'FAIL',
    `${insBets.length} insurance bets: wins occur on exactly the dealer-blackjack hands and return exactly 3× stake, losses exactly 0 — integer 1e-8 settlement units, no tolerance ` +
    `(${insWonWrong} false wins, ${insLostWrong} missed wins, ${insPayBad} wrong payouts)` +
    (insFails.length ? `; ${insFails.join('; ')}` : ''));

  return [s8, s9, s10];
}
