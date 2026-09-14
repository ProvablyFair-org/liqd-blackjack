/**
 * Step 20 — House-edge reconciliation (nominal config vs actual).
 * Step 21 — No FX haircut observed in this capture (the mechanism is NOT ruled out; see below).
 *
 * LIQD's internal game config reports houseEdge = 0.01 ("1.00%"); the player-facing game
 * surface advertises "Edge: 0.48%" [E16]. The config figure is a NOMINAL internal label, not
 * the game-theoretic edge: blackjack is rule-driven, and the exact basic-strategy edge from the
 * confirmed rule set is RECOMPUTED in-step by the deterministic exact 8-deck solver
 * (`src/exact-play.ts`, TD) under both conventions — per initial bet and per total amount
 * wagered — and never read from the simulation artifact or from a literal in this file. (The
 * published values of both live in `outputs/exact-rtp.json`, the producing artifact; S-CONST:
 * a scored step must not carry a private copy of a figure the report quotes.) The exact edge
 * is well under the 1.00% nominal config label under either convention, so the player is not
 * worse off than that label — a disclosure, not a fairness defect (outcome integrity is proven
 * by Steps 1–16).
 *
 * Separately, side-bet records carry an `exchangeRate` field. This step rules it out as a
 * hidden rake by reporting the field's ACTUAL distribution over the capture (the August 2026
 * dataset carries `exchangeRate = 1.00` on all 12,046 side-bet records; an earlier July capture
 * carried 0.99). Under either value the field only ever appears alongside the `fiat*` fields,
 * which are zero throughout — so its purpose is schema-inferred (a fiat display conversion,
 * crypto→USD) from its name and shape, not demonstrated on any non-zero amount.
 *
 * SCOPE OF THE CLAIM (round-2 QA item 2). What this step establishes is that NO HAIRCUT IS
 * OBSERVABLE: every crypto payout in the capture reconciles at face value from the cards
 * (Step 8), with no fx factor anywhere in the reconstruction. It does NOT establish that the
 * field "never touches" the crypto amounts — at `exchangeRate = 1.00`, a field applied at 1.00
 * and a field not applied at all produce byte-identical data, so the two are indistinguishable
 * from this capture by construction. Ruling the mechanism out (rather than its effect) would
 * need a capture at a rate other than 1.00, or source access.
 */

import * as fs from 'fs';
import * as path from 'path';
import { step } from './context';
import type { StepResult, VerifyContext } from './context';
import { NOMINAL_HOUSE_EDGE } from '../../src/config';
import { solveExact } from '../../src/exact-play';

export function run(ctx: VerifyContext): StepResult[] {
  const out: StepResult[] = [];

  // Actual edge: the EXACT 8-deck solve of the strategy the game is played with —
  // deterministic, reproducing to the last digit on every clone. It replaces both
  // the old infinite-deck default (which modelled a with-replacement game LIQD does
  // not deal) and the Monte-Carlo figure (which moved run to run, and which LIQD
  // would have quoted in marketing).
  const exact = solveExact({ kind: 'finite', decks: 8 }, 'TD');
  const actualEdgeInitial = exact.edgePerInitialBet;
  const actualEdgeTotal: number | null = exact.edgePerTotalWagered;
  const source = 'exact 8-deck solver (TD, per initial bet)';
  let simNote = ` (${(actualEdgeTotal * 100).toFixed(4)}% per total amount wagered)`;

  // The simulation is quoted alongside as corroboration, never as the source.
  const simPath = path.join(ctx.outputsDir, 'simulation-results.json');
  if (fs.existsSync(simPath)) {
    const sim = JSON.parse(fs.readFileSync(simPath, 'utf8'));
    if (sim.baseGame?.edgeInitial != null) {
      simNote += `; ${Number(sim.baseGame.rounds).toLocaleString()}-round simulation reads ` +
        `${(sim.baseGame.edgeInitial * 100).toFixed(4)}% per initial bet`;
    }
  }

  // Nominal config vs actual. PASS iff the player is NOT worse off than the 1.00% config label,
  // which holds under BOTH conventions (the larger per-initial figure is the binding one).
  const playerNotWorse = actualEdgeInitial <= NOMINAL_HOUSE_EDGE + 1e-9;
  out.push(step(20, 'House-edge reconciliation (nominal config vs actual)', playerNotWorse ? 'PASS' : 'FLAG',
    `config houseEdge = ${(NOMINAL_HOUSE_EDGE * 100).toFixed(2)}% (nominal internal label) vs exact basic-strategy edge ${(actualEdgeInitial * 100).toFixed(4)}% per initial bet${simNote} [${source}]. ` +
    (playerNotWorse
      ? 'Measured edge is well under the 1.00% config label under both conventions — the player is not worse off than that label; a disclosure, not a fairness defect (outcome integrity proven by Steps 1–16).'
      : 'Measured edge EXCEEDS the nominal config label — investigate.')));

  // Rule out the exchangeRate field as a hidden rake: report its ACTUAL distribution and keep the
  // display-only assertions (0 main-game hands carry it, 0 nonzero fiat amounts). Value-neutral —
  // no value is hardcoded; the field is read straight off the dataset.
  const fxDist = new Map<string, number>();
  let fxRecords = 0, nonzeroFiat = 0, mainHandsWithFx = 0;
  for (const b of ctx.bets) {
    for (const h of b.playerHands) if ('exchangeRate' in h) mainHandsWithFx++;
    for (const key of ['perfectPair', 'twentyOnePlusThree', 'insurance'] as const) {
      const sb = b.sideBets[key] as Record<string, unknown> | null;
      if (sb && sb.exchangeRate != null) {
        fxRecords++;
        const r = String(sb.exchangeRate);
        fxDist.set(r, (fxDist.get(r) ?? 0) + 1);
        if (Number(sb.fiatBetAmount ?? 0) !== 0 || Number(sb.fiatWinningAmount ?? 0) !== 0) nonzeroFiat++;
      }
    }
  }
  // COVERAGE ASSERTION (added 2026-09-09). This step had none — the only scored step in the
  // suite that could pass over an empty set. A reviewer stripped `exchangeRate` from all
  // 12,046 side-bet records, re-pinned, and it printed
  //   "[PASS] 21 … over 0 side-bet records: ; 0 main-game hands carry it (expected 0);
  //    0 nonzero fiat amounts (expected 0). No haircut is observable…"
  // — 31/31 Full Pass. The step's entire subject had been deleted and it still printed its
  // assurance paragraph, because both of its assertions are "expected 0" and an empty set
  // satisfies them for free. `fxRecords > 0` is the denominator this step was missing: the
  // claim is about a field that EXISTS and does not bite, so no records means no claim.
  const distStr = [...fxDist.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => `${n}×${r}`).join(', ');
  const fxCoverageOk = fxRecords > 0;
  const fxIsDisplayOnly = fxCoverageOk && mainHandsWithFx === 0 && nonzeroFiat === 0;
  // TITLE, corrected round 4 (QA-07). This step was called 'fx field ruled out as a hidden rake'.
  // It cannot rule the mechanism out: every record carries exchangeRate = 1.00, and at a rate of 1
  // 'applied' and 'not applied' produce identical data. What the step establishes is an OBSERVATION
  // over this capture — no haircut is present — which is what the title now says. The limitation in
  // the detail below was always correct and is unchanged.
  out.push(step(21, 'No FX haircut observed in this capture', fxIsDisplayOnly ? 'PASS' : 'FLAG',
    `exchangeRate distribution over ${fxRecords} side-bet records: ${distStr || '(none)'}; ${mainHandsWithFx} main-game hands carry it (expected 0); ${nonzeroFiat} nonzero fiat amounts (expected 0). ` +
    (fxCoverageOk
      ? 'No haircut is observable: the fiat* fields are zero throughout and every crypto payout reconciles at face value from the cards (Step 8), with no fx factor in the reconstruction — so the field is not acting as a house-edge mechanism over this capture. '
      : 'COVERAGE FLAG: 0 side-bet records carry an exchangeRate field, so this step has no subject and asserts nothing. Its two conditions ("expected 0") are satisfied vacuously by an empty set; it does NOT license the no-haircut statement. ') +
    'It is NOT proven that the field never touches the crypto betAmount/winningAmount: at rate 1.00, applied-at-1.00 and not-applied are indistinguishable in the data. Schema-inferred fiat display field; ruling out the mechanism itself would need a capture at a rate other than 1.00, or source access.'));

  return out;
}
