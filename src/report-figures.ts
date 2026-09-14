/**
 * Derived report figures — the numbers the report cites that are neither a scored step's verdict,
 * nor a simulation statistic, nor a leaf of the exact-RTP artifact. Computed here from the
 * hash-pinned dataset and the exact engines, and written to `outputs/report-figures.json` by
 * `npm run verify`.
 *
 * WHY THIS FILE EXISTS. A figure that appears only in prose has no producing artifact, and a
 * reader cannot re-derive it without reimplementing the auditor's reasoning. That is the class the
 * framework's prose check calls an "orphan figure", and it is how a hand-typed number survives a
 * review: it looks like a measurement and is actually a memory. Every figure below is quoted in a
 * chapter — the live money-path reconciliation, the insurance breakdown, the natural-blackjack
 * frequency, the live Perfect Pairs return, the exact side-bet edges, the infinite-deck TD
 * comparison — so it is computed by committed code from the pinned capture and emitted, not typed.
 *
 * THESE ARE NOT VERDICTS — but the artifact IS scored, by re-derivation. The audit's verdict rests
 * on the scored steps in `tests/verify.ts`; nothing below grades the game. What scored Step 25 does
 * is rebuild this artifact through `buildReportFiguresArtifact()` and compare it field for field
 * against the copy on disk, so a hand-edited or absent `outputs/report-figures.json` hard-FAILs.
 * Before that binding existed the file could be emptied, duplicated, shrunk, set to 0.5 throughout
 * or deleted and the suite still printed 31/31 · PROVABLY FAIR — Full Pass. A pin would not do the
 * job: `npm run verify` rewrites this file on every run, so the pin would cover a file the same
 * command replaces. What the re-derivation proves is that the published figures are a deterministic
 * function of the pinned dataset and the committed engines — not that the shipped file was
 * independently produced. The external anchors carry that weight.
 *
 * Money is summed in INTEGER accounting units (1e-8, the capture grid Step 8 already proves every
 * recorded amount sits on). A float sum over 42,894 amounts reports its own accumulated error in
 * the 10th decimal; the reconciliation these figures support is exact, and must be summed exactly.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { loadDataset } from './loader';
import { DATASET_SHA256 } from './config';
import { solveExact, LIQD_RULES } from './exact-play';
import {
  perfectPairsEdgeExact, twentyOnePlusThreeEdgeExact,
  SHOE_PAIR_COMBINATIONS, SHOE_TRIPLE_COMBINATIONS,
} from './sidebet-edges';
import type { Bet, Dataset } from './types';

/** Capture accounting precision: every recorded amount is an exact multiple of 1e-8 (Step 8). */
const USDC_UNITS = 100_000_000n;

/** Parse a recorded amount onto the integer settlement grid. Throws if it is off-grid. */
function units(x: number | string | undefined): bigint {
  if (x === undefined || x === null) return 0n;
  const s = typeof x === 'number' ? x.toFixed(10) : String(x);
  const neg = s.startsWith('-');
  const [wholeRaw, fracRaw = ''] = (neg ? s.slice(1) : s).split('.');
  const frac = (fracRaw + '00000000000').slice(0, 11);
  const scaled = BigInt(wholeRaw) * 100_000_000_000n + BigInt(frac);
  if (scaled % 1000n !== 0n) throw new Error(`amount off the 1e-8 settlement grid: ${s}`);
  const v = scaled / 1000n;
  return neg ? -v : v;
}

const pct = (n: bigint, d: bigint): number => (d === 0n ? 0 : (Number(n) / Number(d)) * 100);
const usdc = (n: bigint): number => Number(n) / Number(USDC_UNITS);

/**
 * The published exact 8-deck TD edge, read from its artifact of record.
 * `outputs/exact-rtp.json` is hash-pinned in scored Step 25 AND re-derived field by field against
 * a live `buildExactArtifact()` in `tests/blackjack/exactSolverTests.ts`, so it is a stronger
 * source than a second solve here would be — and it keeps this file from becoming a second place
 * the headline edge is computed.
 */
function exactArtifactFinite8TdEdge(): number {
  const p = join(__dirname, '..', 'outputs', 'exact-rtp.json');
  const a = JSON.parse(readFileSync(p, 'utf8')) as {
    finite8TD?: { edgePerInitialBet?: number };
  };
  const e = a.finite8TD?.edgePerInitialBet;
  if (typeof e !== 'number' || !Number.isFinite(e)) {
    throw new Error(`outputs/exact-rtp.json has no finite8TD.edgePerInitialBet — cannot derive the card-removal lift`);
  }
  return e;
}

export interface ReportFigures {
  /**
   * Live money path over the whole capture. A RECONCILIATION, not an RTP measurement — at 6,000
   * hands there is no statistical power for RTP and phases B/C/F play deliberately suboptimally.
   */
  moneyPath: {
    mainWageredUsdc: number;
    sideWageredUsdc: number;
    insuranceWageredUsdc: number;
    /** Main + side, the denominator of the ex-insurance figure. */
    wageredExInsuranceUsdc: number;
    wageredInclInsuranceUsdc: number;
    /** Σ of every round's top-level `winningAmount` — main hands, side bets and insurance. */
    returnedUsdc: number;
    returnedExInsuranceUsdc: number;
    realizedRtpInclInsurancePct: number;
    realizedRtpExInsurancePct: number;
  };
  /** Insurance, the sub-ledger the ex-insurance figure removes. */
  insurance: {
    rounds: number;
    atLowStake: number;
    atHighStake: number;
    wageredUsdc: number;
    returnedUsdc: number;
    settledAt3x: number;
    settledAt0x: number;
  };
  /** Player two-card 21s. Split hands cannot make a natural, so this is the unsplit population. */
  naturals: {
    total: number;
    won: number;
    pushed: number;
    ofAllRoundsPct: number;
  };
  /** Live Perfect Pairs settlement — variance illustration only, at a 457-win sample. */
  perfectPairsLive: {
    bets: number;
    wins: number;
    wageredUsdc: number;
    returnedUsdc: number;
    returnPct: number;
    hitRatePct: number;
    /** P(the two dealt cards pair) on a fresh 8-deck shoe = 31/415. */
    expectedHitRatePct: number;
  };
  /** Exact side-bet edges, from `src/sidebet-edges.ts` (same evaluator as Steps 15/16). */
  sideBetEdges: {
    perfectPairsRational: string;
    perfectPairsEdgePct: number;
    perfectPairsRtpPct: number;
    perfectPairsAt12to1EdgePct: number;
    perfectPairsAt12to1RtpPct: number;
    /** Return difference against a hypothetical 12:1 coloured-pair payout, in percentage points. */
    coloredPairPipGainPP: number;
    twentyOnePlusThreeRational: string;
    twentyOnePlusThreeEdgePct: number;
    pairEnumerationWeight: string;
    tripleEnumerationWeight: string;
  };
  /**
   * The two rounds the report walks through by hand, pulled from the dataset so the worked
   * arithmetic in `payout-verification.md` and `game-logic-verifiability.md` is quoted from the
   * capture rather than retyped. Each `components` array sums to `credited`.
   */
  workedExamples: {
    epoch: number;
    nonce: number;
    what: string;
    credited: number;
    components: { label: string; amountUsdc: number }[];
    componentsSumUsdc: number;
    reconciles: boolean;
  }[];
  /**
   * The infinite-deck comparison the RTP chapter uses to separate card removal from table cost.
   * `outputs/exact-rtp.json` publishes the infinite deck under CD only; the TD solve below is what
   * makes the +0.0827 pp headline lift decomposable into a like-for-like part and a table part.
   */
  infiniteDeck: {
    edgeTdPct: number;
    edgeCdPct: number;
    /** TD-vs-CD table cost on the infinite deck. */
    tableCostPP: number;
    finite8TdEdgePct: number;
    /** Like-for-like (TD − TD) card-removal lift. */
    cardRemovalLiftTdVsTdPP: number;
  };
}

export function computeReportFigures(ds: Dataset = loadDataset()): ReportFigures {
  const bets: Bet[] = ds.bets;

  let mainWagered = 0n;
  let sideWagered = 0n;
  let insWagered = 0n;
  let insReturned = 0n;
  let returned = 0n;
  let ppWagered = 0n;
  let ppReturned = 0n;

  let insRounds = 0;
  let insLow = 0;
  let insHigh = 0;
  let ins3x = 0;
  let ins0x = 0;
  let ppBets = 0;
  let ppWins = 0;
  let naturals = 0;
  let naturalsWon = 0;
  let naturalsPushed = 0;

  for (const b of bets) {
    returned += units(b.winningAmount);

    // A doubled round stakes twice the recorded per-hand betAmount. Step 8's money path uses the
    // same factor and binds `bet.doubled` to the action stream (grammar G6), so this is the
    // dataset's own doubling, not an assumption about it.
    const factor = b.doubled ? 2n : 1n;
    for (const h of b.playerHands) mainWagered += units(h.betAmount) * factor;

    const pp = b.sideBets?.perfectPair;
    if (pp) {
      ppBets += 1;
      const w = units(pp.betAmount as string | number | undefined);
      const r = units(pp.winningAmount as string | number | undefined);
      ppWagered += w;
      ppReturned += r;
      sideWagered += w;
      if (r > 0n) ppWins += 1;
    }
    const t3 = b.sideBets?.twentyOnePlusThree;
    if (t3) sideWagered += units(t3.betAmount as string | number | undefined);

    const ins = b.sideBets?.insurance;
    if (ins) {
      insRounds += 1;
      const w = units(ins.betAmount as string | number | undefined);
      const r = units(ins.winningAmount as string | number | undefined);
      insWagered += w;
      insReturned += r;
      if (r > 0n) ins3x += 1; else ins0x += 1;
      if (w >= 100_000_000n) insHigh += 1; else insLow += 1;
    }

    // Natural = the initial two cards total 21. A split round deals its hands from one pair, so by
    // rule neither resulting hand is a natural; the population is the unsplit rounds.
    //
    // Won-vs-pushed is decided from the CREDIT, never from the operator's `result` string. That
    // string carries only 'won'/'lost' across the whole capture — a push against a dealer natural
    // is recorded as 'won' with a 1x return — so reading it would report 253 wins and 0 pushes and
    // silently contradict Step 9's 243. A 3:2 natural returns 2.5x the stake; a push returns 1x.
    if (!b.split && b.playerHands.length === 1) {
      const h = b.playerHands[0];
      if (h.cards.length === 2 && h.points === 21) {
        naturals += 1;
        const stake = units(h.betAmount);
        const credit = units(h.winningAmount);
        if (credit * 2n === stake * 5n) naturalsWon += 1;
        else if (credit === stake) naturalsPushed += 1;
        else throw new Error(`natural settled at neither 2.5x nor 1x: credit ${credit} on stake ${stake}`);
      }
    }
  }

  const wageredEx = mainWagered + sideWagered;
  const wageredIncl = wageredEx + insWagered;
  const returnedEx = returned - insReturned;

  // The rounds the chapters walk through by hand. Quoted from the capture, not retyped: each
  // component is read off the record and the sum is asserted against the credited total, so a
  // worked example cannot drift from the dataset it claims to describe.
  const worked = ([
    [2, 19, 'insurance-only credit: the insurance return is the whole credit'],
    [2, 25, 'split + double + both side bets: four components in one credit'],
  ] as [number, number, string][]).map(([epoch, nonce, what]) => {
    const b = bets.find((x) => x.epoch === epoch && x.nonce === nonce);
    if (!b) throw new Error(`worked example e${epoch}/n${nonce} is not in the dataset`);
    const components: { label: string; amountUsdc: number }[] = [];
    const factor = b.doubled ? 2n : 1n;
    b.playerHands.forEach((h, i) => {
      const v = units(h.winningAmount) * factor;
      if (v > 0n) components.push({ label: `hand ${i + 1}${b.doubled ? ' (doubled)' : ''}`, amountUsdc: usdc(v) });
    });
    for (const [label, sb] of [
      ['perfectPair', b.sideBets?.perfectPair],
      ['twentyOnePlusThree', b.sideBets?.twentyOnePlusThree],
      ['insurance', b.sideBets?.insurance],
    ] as [string, { winningAmount?: number | string } | null | undefined][]) {
      if (!sb) continue;
      const v = units(sb.winningAmount);
      if (v > 0n) components.push({ label, amountUsdc: usdc(v) });
    }
    const sum = components.reduce((a, c) => a + units(c.amountUsdc), 0n);
    return {
      epoch, nonce, what,
      credited: usdc(units(b.winningAmount)),
      components,
      componentsSumUsdc: usdc(sum),
      reconciles: sum === units(b.winningAmount),
    };
  });

  const ppEdge = perfectPairsEdgeExact();
  const ppEdge12 = perfectPairsEdgeExact(12);
  const t3Edge = twentyOnePlusThreeEdgeExact();

  // The infinite-deck solves are composition-free and cost ~10 ms each, so they are re-solved
  // here. The 8-deck finite solve costs ~12 s and is ALREADY the artifact of record: it is read
  // from `outputs/exact-rtp.json`, which Step 25 hash-pins and `exactSolverTests.ts` re-derives
  // field by field against a live `buildExactArtifact()`. Re-solving it here would be a second
  // copy of a number that already has a stronger guard than a hash.
  const infTD = solveExact({ kind: 'infinite' }, 'TD', LIQD_RULES);
  const infCD = solveExact({ kind: 'infinite' }, 'CD', LIQD_RULES);
  const fin8TdEdge = exactArtifactFinite8TdEdge();

  return {
    moneyPath: {
      mainWageredUsdc: usdc(mainWagered),
      sideWageredUsdc: usdc(sideWagered),
      insuranceWageredUsdc: usdc(insWagered),
      wageredExInsuranceUsdc: usdc(wageredEx),
      wageredInclInsuranceUsdc: usdc(wageredIncl),
      returnedUsdc: usdc(returned),
      returnedExInsuranceUsdc: usdc(returnedEx),
      realizedRtpInclInsurancePct: pct(returned, wageredIncl),
      realizedRtpExInsurancePct: pct(returnedEx, wageredEx),
    },
    insurance: {
      rounds: insRounds,
      atLowStake: insLow,
      atHighStake: insHigh,
      wageredUsdc: usdc(insWagered),
      returnedUsdc: usdc(insReturned),
      settledAt3x: ins3x,
      settledAt0x: ins0x,
    },
    naturals: {
      total: naturals,
      won: naturalsWon,
      pushed: naturalsPushed,
      ofAllRoundsPct: (naturals / bets.length) * 100,
    },
    perfectPairsLive: {
      bets: ppBets,
      wins: ppWins,
      wageredUsdc: usdc(ppWagered),
      returnedUsdc: usdc(ppReturned),
      returnPct: pct(ppReturned, ppWagered),
      hitRatePct: (ppWins / ppBets) * 100,
      expectedHitRatePct: (31 / 415) * 100,
    },
    sideBetEdges: {
      perfectPairsRational: ppEdge.rational,
      perfectPairsEdgePct: ppEdge.edge * 100,
      perfectPairsRtpPct: ppEdge.rtp * 100,
      perfectPairsAt12to1EdgePct: ppEdge12.edge * 100,
      perfectPairsAt12to1RtpPct: ppEdge12.rtp * 100,
      coloredPairPipGainPP: (ppEdge12.edge - ppEdge.edge) * 100,
      twentyOnePlusThreeRational: t3Edge.rational,
      twentyOnePlusThreeEdgePct: t3Edge.edge * 100,
      pairEnumerationWeight: SHOE_PAIR_COMBINATIONS,
      tripleEnumerationWeight: SHOE_TRIPLE_COMBINATIONS,
    },
    workedExamples: worked,
    infiniteDeck: {
      edgeTdPct: infTD.edgePerInitialBet * 100,
      edgeCdPct: infCD.edgePerInitialBet * 100,
      tableCostPP: (infTD.edgePerInitialBet - infCD.edgePerInitialBet) * 100,
      finite8TdEdgePct: fin8TdEdge * 100,
      cardRemovalLiftTdVsTdPP: (infTD.edgePerInitialBet - fin8TdEdge) * 100,
    },
  };
}

/** The header the artifact carries above the figures. */
export const REPORT_FIGURES_HEADER = {
  audit: 'LIQD Blackjack',
  what: 'Figures cited in the report chapters, recomputed from the hash-pinned dataset and the exact engines. Not scored — see outputs/verification-results.json for the verdict.',
} as const;

export type ReportFiguresArtifact = ReportFigures & {
  audit: string;
  what: string;
  datasetSha256: string;
};

/**
 * THE artifact `outputs/report-figures.json` holds — header and figures together, in the order
 * they are written.
 *
 * ONE builder, TWO callers, deliberately. `tests/verify.ts` calls it to WRITE the file at the end
 * of a run; scored Step 25 (`tests/steps/standardization.ts`) calls it to RE-DERIVE the figures
 * and compare them, field for field, against the copy already on disk. Before this existed the
 * two lived apart: verify.ts assembled the header inline and nothing re-derived the body, so the
 * file was an unbound emission — the framework's forged-artifact battery emptied it, duplicated
 * its rows, shrank it, set every rtp/edge field to 0.5 and deleted it outright, and the suite
 * still returned 31/31 PROVABLY FAIR — Full Pass (gate-forgery F1–F4 and F11, 2026-09-09).
 * A second, hand-maintained copy of the header in the step would have reintroduced the same drift
 * one level down, so both callers use this.
 */
export function buildReportFiguresArtifact(ds: Dataset = loadDataset()): ReportFiguresArtifact {
  return {
    ...REPORT_FIGURES_HEADER,
    datasetSha256: DATASET_SHA256,
    ...computeReportFigures(ds),
  };
}
