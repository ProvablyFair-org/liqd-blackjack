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
 * dataset carries `exchangeRate = 1.00` on all 12,046 side-bet records; 0.99 has been seen
 * outside this dataset). Under either value the field only ever appears alongside the `fiat*` fields,
 * which are zero throughout — so its purpose is schema-inferred (a fiat display conversion,
 * crypto→USD) from its name and shape, not demonstrated on any non-zero amount.
 *
 * SCOPE OF THE CLAIM. What this step establishes is that NO HAIRCUT IS
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
import { NOMINAL_HOUSE_EDGE, STOREFRONT_EDGE } from '../../src/config';
import { solveExact } from '../../src/exact-play';
import {
  perfectPairsEdgeExact, twentyOnePlusThreeEdgeExact, SHOE_PAIR_COMBINATIONS, SHOE_TRIPLE_COMBINATIONS,
} from '../../src/sidebet-edges';

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

  // The STOREFRONT figure (E16, "Edge: 0.48%") is reconciled at the surface's own resolution —
  // two decimals of a percent, so one display unit is 0.01 pp: the exact per-initial-bet edge must
  // lie within one display unit of it. A storefront figure the model contradicts is a FLAG with
  // origin = operator (BLACKJACK-19). Measured: the exact 0.4877% ROUNDS to 0.49% and TRUNCATES to
  // 0.48%, so the surface shows the truncated figure — 0.0077 pp below the exact edge, inside one
  // display unit. Stated in the detail, not scored as a contradiction.
  const DISPLAY_UNIT = 0.0001;
  const storefrontGap = actualEdgeInitial - STOREFRONT_EDGE;
  const storefrontMatches = Math.abs(storefrontGap) < DISPLAY_UNIT;

  // Side-bet edges by EXACT ENUMERATION over the 8-deck shoe (src/sidebet-edges.ts, the evaluator
  // the live bets are scored with and the paytables in src/config.ts), never simulated. Each
  // enumeration's total weight must equal C(416,k), so a bug in the weights cannot pass.
  const pp = perfectPairsEdgeExact();
  const t3 = twentyOnePlusThreeEdgeExact();
  const enumOk = pp.total === SHOE_PAIR_COMBINATIONS && t3.total === SHOE_TRIPLE_COMBINATIONS
    && pp.edge > 0 && pp.edge < 1 && t3.edge > 0 && t3.edge < 1;

  // The dataset's own config label (meta.houseEdge) must be the label reconciled here — the constant in
  // src/config.ts is not allowed to drift from it. meta.houseEdge is the capture script's copy of the
  // value, typed into the script (0.01); the operator's own figure is LIQD's game-settings response,
  // `houseEdge: 1` (percent) for fast-games-11, saved 2026-06-29 as evidence/E23. Both say 1%.
  const labelInData = Number((ctx.meta as { houseEdge?: unknown }).houseEdge);
  const labelBound = labelInData === NOMINAL_HOUSE_EDGE;
  // Any OTHER operator edge figure in the capture (a served effective-edge field, an RTP field)
  // would have to be reconciled too, so the dataset is swept for one rather than assumed free of it.
  const edgeKeys = new Set<string>();
  const sweep = (o: unknown, at: string): void => {
    if (Array.isArray(o)) { for (const x of o) sweep(x, `${at}[]`); return; }
    if (o && typeof o === 'object') {
      for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
        if (/edge|rtp/i.test(k)) edgeKeys.add(`${at}.${k}`);
        sweep(v, `${at}.${k}`);
      }
    }
  };
  sweep({ meta: ctx.meta, seeds: ctx.seeds, bets: ctx.bets }, '');
  const otherEdgeKeys = [...edgeKeys].filter((k) => k !== '.meta.houseEdge');
  const s20Status = !enumOk || !labelBound ? 'FAIL'
    : playerNotWorse && storefrontMatches && otherEdgeKeys.length === 0 ? 'PASS' : 'FLAG';
  out.push(step(20, 'House-edge reconciliation (nominal config vs actual)', s20Status,
    `RTP under both conventions from the exact solve: ${(exact.rtpPerInitialBet * 100).toFixed(6)}% per initial bet, ${(exact.rtpPerTotalWagered * 100).toFixed(6)}% per total amount wagered, average wager ${exact.avgWager.toFixed(6)} initial bets per round. ` +
    `Operator figures reconciled: (1) config houseEdge ${(NOMINAL_HOUSE_EDGE * 100).toFixed(0)}% (nominal internal label; LIQD's game-settings response, E23; the dataset's meta.houseEdge, the capture script's typed copy, ${labelBound ? 'agrees' : `= ${String(labelInData)} DISAGREES — FAIL`}) vs exact basic-strategy edge ${(actualEdgeInitial * 100).toFixed(4)}% per initial bet${simNote} [${source}] — ` +
    (playerNotWorse
      ? `the measured edge is well under the ${(NOMINAL_HOUSE_EDGE * 100).toFixed(0)}% label under both conventions, so the player is not worse off than it; a disclosure, not a fairness defect (outcome integrity proven by Steps 1–16); `
      : 'the measured edge EXCEEDS the nominal config label — FLAG, origin operator; ') +
    `(2) storefront "Edge: ${(STOREFRONT_EDGE * 100).toFixed(2)}%" (E16) vs the exact per-initial-bet edge ${(actualEdgeInitial * 100).toFixed(4)}%: gap ${(storefrontGap * 100).toFixed(4)} pp, ${storefrontMatches ? 'inside one display unit (0.01 pp)' : 'MORE than one display unit — CONTRADICTS the model — FLAG, origin operator'} — the surface figure is the exact edge truncated to two decimals (rounding would show ${(Math.round(actualEdgeInitial * 10000) / 100).toFixed(2)}%), and it matches the per-initial-bet convention, not the per-total-wagered one (${(exact.edgePerTotalWagered * 100).toFixed(4)}%); ` +
    `(3) the exchangeRate field is Step 21; the dataset swept for any other key matching /edge|rtp/i (a served effective-edge or RTP field): ${otherEdgeKeys.length === 0 ? 'none — meta.houseEdge is the only one' : `FOUND ${otherEdgeKeys.join(', ')} — FLAG, not reconciled`}. ` +
    `Side-bet edges by exact enumeration over the 416-card shoe: Perfect Pairs ${pp.rational} = ${(pp.edge * 100).toFixed(4)}% (weights sum to C(416,2) = ${pp.total}), 21+3 ${t3.rational} = ${(t3.edge * 100).toFixed(4)}% (weights sum to C(416,3) = ${t3.total})` +
    (enumOk ? '' : ' — ENUMERATION FAIL: a weight total does not equal the shoe combination count')));

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
  // COVERAGE ASSERTION. Without one this is the only scored step in the suite that can pass
  // over an empty set. With `exchangeRate` stripped from all
  // 12,046 side-bet records and the dataset re-pinned, it printed
  //   "[PASS] 21 … over 0 side-bet records: ; 0 main-game hands carry it (expected 0);
  //    0 nonzero fiat amounts (expected 0). No haircut is observable…"
  // — 31/31 Full Pass. The step's entire subject had been deleted and it still printed its
  // assurance paragraph, because both of its assertions are "expected 0" and an empty set
  // satisfies them for free. `fxRecords > 0` is the denominator this step was missing: the
  // claim is about a field that EXISTS and does not bite, so no records means no claim.
  const distStr = [...fxDist.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => `${n}×${r}`).join(', ');
  const fxCoverageOk = fxRecords > 0;
  const fxIsDisplayOnly = fxCoverageOk && mainHandsWithFx === 0 && nonzeroFiat === 0;
  // TITLE. This step does NOT rule the fx field out as a hidden rake, and its title must not say
  // it does: every record carries exchangeRate = 1.00, and at a rate of 1 'applied' and 'not
  // applied' produce identical data. What the step establishes is an OBSERVATION over this
  // capture — no haircut is present — which is what the title says, and the limitation is stated
  // in the detail below.
  out.push(step(21, 'No FX haircut observed in this capture', fxIsDisplayOnly ? 'PASS' : 'FLAG',
    `exchangeRate distribution over ${fxRecords} side-bet records: ${distStr || '(none)'}; ${mainHandsWithFx} main-game hands carry it (expected 0); ${nonzeroFiat} nonzero fiat amounts (expected 0). ` +
    (fxCoverageOk
      ? 'No haircut is observable: the fiat* fields are zero throughout and every crypto payout reconciles at face value from the cards (Step 8), with no fx factor in the reconstruction — so the field is not acting as a house-edge mechanism over this capture. '
      : 'COVERAGE FLAG: 0 side-bet records carry an exchangeRate field, so this step has no subject and asserts nothing. Its two conditions ("expected 0") are satisfied vacuously by an empty set; it does NOT license the no-haircut statement. ') +
    'It is NOT proven that the field never touches the crypto betAmount/winningAmount: at rate 1.00, applied-at-1.00 and not-applied are indistinguishable in the data. Schema-inferred fiat display field; ruling out the mechanism itself would need a capture at a rate other than 1.00, or source access.'));

  return out;
}
