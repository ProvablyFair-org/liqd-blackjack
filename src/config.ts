/**
 * LIQD Blackjack — game configuration.
 *
 * Every value here was confirmed from the live game surface and/or read off the
 * 6,000-hand captured dataset (see verify.ts rules steps and live-parity-testing.md).
 * There is no external multiplier table to pin (blackjack is rule-driven, not
 * table-driven); the side-bet paytables are LIQD client constants, cross-checked
 * against live side-bet wins in the capture.
 */

/** SHA-256 of the captured dataset — the verifier aborts if this does not match. */
export const DATASET_SHA256 = 'c2a28c5164a546105963ffb4ff8e7c422a68802df47afcdcfa0b4fdbad1fdbf7';

/**
 * SHA-256 of the committed simulation artifact (`outputs/simulation-results.json`).
 * Steps 17–19 score whatever that file contains, so the repo pins it. The pin is reconciled in
 * SCORED Step 25 (Artifact Hash Integrity) — presence AND hash, both hard FAILs. It used to be
 * enforced by `tests/verify.ts` aborting the process before any step printed, which made a
 * substituted artifact indistinguishable from a crash to a gate harness, and made a DELETED
 * artifact skip the guard entirely. `npm run test:full` regenerates the file with fresh seeds
 * and sets SIM_FRESH=1, which switches the hash half of the guard (never the presence half) to
 * record-and-label instead of enforce. Scope note: this pin protects third parties against artifact drift/substitution; it
 * cannot make the repo self-proving against its own publisher, who could re-pin at will.
 */
export const SIMULATION_SHA256 = '782c056164982d76879225c2e4059d1d7ee29f176e095ee78105386759574686';

/**
 * SHA-256 of the committed convergence chart (`outputs/rtp-convergence.html`). The chart and the
 * JSON are two outputs of ONE `npm run simulate` and must move together — pinning only the JSON
 * let a stale chart (labelling a pre-fix figure "AUTHORITATIVE") survive a full gate. Reconciled
 * in scored Step 25 alongside the JSON pin, with the same SIM_FRESH=1 record-and-label bypass on
 * the hash (its PRESENCE is required unconditionally).
 */
export const SIMULATION_HTML_SHA256 = '321d58a6609efb00e52c69c56c5d0ecc245d6da83f3a06f70c07a6c2da827c66';

/**
 * SHA-256 of the committed exact-RTP artifact (`outputs/exact-rtp.json`).
 *
 * This file is fully deterministic — `npm run rtp` regenerates it byte-identically — so the pin
 * needs no `SIM_FRESH`-style bypass: it only ever moves when the solver itself changes, which is
 * exactly when a human should have to look.
 *
 * TWO guards, deliberately, because they fail for different reasons:
 *   - `tests/blackjack/exactSolverTests.ts` re-derives the artifact from live solves via
 *     `buildExactArtifact()` and deep-compares every field. That proves the committed NUMBERS are
 *     the real solve, which a hash can never do — but it lives in mocha, so the scored `npm run
 *     verify` path could not see a forged artifact at all.
 *   - This pin, reconciled in scored Step 25 beside the other artifact pins, binds the artifact
 *     in the SCORED run at zero cost. Added after the forged-artifact battery (Gate 10 F4) planted
 *     self-consistent nonsense in this file and the verifier scored 31/31 without reading it.
 *     Round 3 moved it out of verify.ts's fail-fast abort and into the scored step, and added the
 *     PRESENCE assertion — deleting this file used to produce 31/31 Full Pass, exit 0.
 */
export const EXACT_RTP_SHA256 = 'db26864d6a7272cbc069e85a961b231b3937332a291822215612dc79060a5fff';

/**
 * SHA-256 of `outputs/cherry-pick-attack.json` — the measured return-based seed grind against
 * this audit's own Step-19 detector (`npm run attack`, src/cherry-pick-attack.ts).
 *
 * It is the producing artifact for every figure the report quotes about cherry-pick DETECTION
 * POWER, so it is pinned like any other. Deterministic by construction — candidate and bootstrap
 * seeds are SHA-256 of fixed labels and the file carries no timestamp — so `npm run attack`
 * reproduces it byte-for-byte and the pin needs no SIM_FRESH-style bypass.
 */
export const ATTACK_SHA256 = 'd69da9086664be838677cfc4da146b66e56b69f00f1d755b4a8d38d0ef08d4ad';

/**
 * SHA-256 of `outputs/rng-branch-coverage.json` — which paths of the draw primitive the capture
 * actually exercised (`npm run branches`, src/rng-branch-audit.ts). Producing artifact for the
 * "the rejection branch is ASSUMED, not witnessed" figures in rng-algorithm-analysis.md.
 * Deterministic: it replays the committed dataset and evaluates closed forms.
 */
export const RNG_BRANCH_SHA256 = 'eb2c74a1ecf84d3dbf3c1cc3a490b9c04ad1a24d201c4f58efc4403bbacb4593';

export const DECKS = 8;
export const SHOE_SIZE = DECKS * 52; // 416
export const NOMINAL_HOUSE_EDGE = 0.01; // internal config field houseEdge=1.00% (NOT the surface figure: the game surface advertises 0.48% [E16])

// ─────────────────────────────────────────────────────────────────────────────
// POPULATION PINS (G-BIND). The audit's population is declared HERE, in code, and
// never read out of the artifact being scored.
//
// WHY. Two independent Stage 8 reviewers, on 2026-09-09, ran the same attack against
// this repo: delete one epoch (50 rounds + its `seeds[]` record) and decrement
// `meta.phases.F.hands` by 50. Every count the suite checked — `seeds.length`,
// `bets.length`, `meta.plannedTotal`, `meta.epochSize`, `meta.phases[*].hands` — was read
// from INSIDE the file under test, so shrinking the data and doctoring the header left the
// file internally consistent: `56 passing` (the suite's size on 2026-09-09 — a historical record
// of that run, NOT the current test count; take that from your own `npx mocha`), `31/31`,
// PROVABLY FAIR — Full Pass, exit 0,
// with Step 1 printing "119/119 epochs" and Step 6 "5950/5950 hands". The SHA-256 pin does
// not help — it proves the bytes have not moved since WE pinned them, not that the file is
// the capture. A row COUNT is not an identity.
//
// `meta.plannedTotal`, `meta.progress.bets`, `meta.progress.seeds` and `seeds[].nonceEnd`
// were, before this, present in the dataset and read by NOTHING (grep: `nonceEnd` appeared
// only in `src/types.ts`). They are now all asserted against the constants below — Steps 4
// and 5 — so a doctored header is a contradiction rather than a dead field.
//
// These three numbers are the capture plan, fixed at Phase 0 and reproduced in MANIFEST.md.
// Changing one is a deliberate act that a human has to perform in source, in a diff.
// ─────────────────────────────────────────────────────────────────────────────
/** Epochs (server-seed rotations) the capture plan declares. */
export const EXPECTED_SEEDS = 120;
/** Rounds served per epoch before rotation. */
export const EXPECTED_EPOCH_SIZE = 50;
/** Total captured rounds. 120 × 50 = 6,000 — the population every headline figure rests on. */
export const EXPECTED_HANDS = EXPECTED_SEEDS * EXPECTED_EPOCH_SIZE;

// ─────────────────────────────────────────────────────────────────────────────
// SIMULATION SHAPE PINS (G-BIND, second half).
//
// The Monte-Carlo tolerance used to be read from the artifact it gates:
// `se = 1.15 / sqrt(rounds)` with `rounds` taken from `outputs/simulation-results.json`,
// in both scored Step 17 and the mocha 3σ anchor. A reviewer forged the artifact to claim
// 1,000,000 rounds and 99.20% RTP, re-pinned SIMULATION_SHA256, and Step 17 printed
// `[PASS] … simulation 0.8000% over 1,000,000 rounds (±0.1150 pp 1σ) → 2.72σ, limit 3σ`
// — a 5.5× wider gate, bought by claiming fewer rounds, missing the true edge by 0.31 pp.
//
// The round counts are therefore pinned beside the hash. σ is computed from the PINNED
// count, so a claimed-smaller run cannot widen its own acceptance window, and the artifact's
// own `rounds` must equal the pin or the step hard-FAILs.
// ─────────────────────────────────────────────────────────────────────────────
/** Rounds in the committed base-game fair-shuffle Monte-Carlo (`baseGame.rounds`). */
export const SIM_BASE_ROUNDS = 30_000_000;
/** Rounds in the committed Pass-1 real-shoe fairness run (`pass1_fresh_seeds.rounds`). */
export const SIM_PASS1_ROUNDS = 500_000;
/** Per-round SD of the per-initial-bet loss, measured 1.146718922176392, rounded up. */
export const SIM_SD_PER_ROUND = 1.15;

/**
 * Card ranks (A..K). An UNPOOLED first-card uniformity χ² has RANKS−1 = 12 degrees of freedom.
 *
 * Bin pooling matters here and is easy to get wrong: `chiSquaredTest` (src/stats.ts) merges the
 * end bins while their expected count is below 5. Pass 1 runs 500,000 rounds (expected 38,461
 * per rank) and Pass 2's LATE window 950 nonces (expected 73), so neither pools and both are
 * df 12. Pass 2's EARLY window is only 50 nonces (expected 3.85), so it pools to 11 bins on
 * df 10 — which is why Step 19 binds the early half by reproducing the raw χ² from the seeds
 * rather than by pinning a df.
 */
export const RANKS = 13;
/**
 * Degrees of freedom for the first-card rank χ². DERIVED from RANKS, never read from the
 * artifact: a reviewer set `firstCardChi2=9999, firstCardDf=100000, firstCardPValue=1`,
 * re-pinned, and Step 18 printed "RECOMPUTED … p=1.0000" and PASSed — because the step
 * recomputed p from a df the artifact supplied.
 */
export const FIRST_CARD_DF = RANKS - 1;

/**
 * Pass-2 cherry-pick significance level. A seed flags when its early-window (served
 * nonces 0..49) first-card χ² sits in the top α of the bootstrap null AND its late window
 * does not, so the per-seed flag probability under the null is α(1−α) = 0.0475.
 *
 * Step 19 previously computed that probability as `expectedFlagsByChance / seeds_tested`,
 * both artifact fields: setting `cherryPickFlags=120, expectedFlagsByChance=120` made
 * p₀ = 1, the survival probability 1, and the step PASSed on a dataset where every single
 * epoch had flagged. p₀ is now this declared constant and nothing else.
 */
export const PASS2_ALPHA = 0.05;
/** Per-seed flag probability under the null: α × (1 − α). */
export const PASS2_P0 = PASS2_ALPHA * (1 - PASS2_ALPHA);
/** Served window scored by the Pass-2 early statistic — nonces 0..49, the rounds actually dealt. */
export const PASS2_EARLY_NONCES = EXPECTED_EPOCH_SIZE;
/**
 * Total nonces derived per seed by the Pass-2 experiment: the served window plus the LATE control
 * window (nonces 50..999, 950 of them). Declared here rather than left as a local in
 * `src/simulate.ts` because `src/cherry-pick-attack.ts` has to score the SAME two windows — see
 * `cherryPickFlag` below.
 */
export const PASS2_TOTAL_NONCES = 1_000;
/** Nonces in the late control window: 950, expected count per rank 73, so no bin pooling (df 12). */
export const PASS2_LATE_NONCES = PASS2_TOTAL_NONCES - PASS2_EARLY_NONCES;

/**
 * THE cherry-pick flag predicate. One definition, three callers.
 *
 * A seed flags when its early (served) window is extreme under the bootstrap null AND its late
 * control window is not — an early-only excess, which is the shape a selected seed would have.
 * Both halves matter: the conjunction is why the per-seed null probability is α(1−α) = PASS2_P0
 * and not α.
 *
 * ROUND-4 QA-04. This used to be written out three times: in `src/simulate.ts` (Pass 2, which
 * produced the pinned artifact), in `tests/steps/simulation.ts` (scored Step 19, which recomputes
 * the flag count from the artifact's rows), and in `src/cherry-pick-attack.ts` — where the third
 * copy had drifted. The attack script scored its selected blocks on `earlyP < α` ALONE and then
 * labelled that "Step 19", reporting a chance rate of 120 × α = 6.0 and a survival probability
 * computed at p₀ = α. Both numbers describe a detector Step 19 does not implement. The predicate
 * and the null parameter now live here and nothing restates them.
 */
export function cherryPickFlag(earlyP: number, lateP: number): boolean {
  return earlyP < PASS2_ALPHA && lateP >= PASS2_ALPHA;
}

// NOTE: the enforced rule set is NOT a single object here. Each consumer carries its own
// rule constants — the exact solver (`src/exact-play.ts` LIQD_RULES), the simulator
// (`src/simulate.ts`), the payout evaluator (`tests/steps/payouts.ts`), and the rational
// oracle (`anchor/oracle.py`) — and each is exercised by the verification suite. A former
// `RULES` object lived here but nothing imported it, so it could drift from the rules the
// code actually applies; it was removed to avoid pointing the reader at dead code.

/** Perfect Pairs side-bet paytable (payout-to-1). LIQD client constants. */
export const PERFECT_PAIRS = {
  PERFECT_PAIR: 25, // same rank + same suit
  COLORED_PAIR: 13, // same rank + same colour, different suit
  MIXED_PAIR: 6, // same rank, different colour
} as const;

/** 21+3 side-bet paytable (payout-to-1) on the player's two cards + dealer upcard. */
export const TWENTY_ONE_PLUS_THREE = {
  SUITED_THREE_OF_A_KIND: 100,
  STRAIGHT_FLUSH: 40,
  THREE_OF_A_KIND: 30,
  STRAIGHT: 10,
  FLUSH: 5,
} as const;

/** Card value: A=11 (soft), 10/J/Q/K=10, else pip. rank is 1..13 (1=A..13=K). */
export function cardValueFromRank(rank: number): number {
  return rank === 1 ? 11 : rank >= 10 ? 10 : rank;
}

export const rankOf = (card: string): number => Number(card.split(':')[1]);
export const suitOf = (card: string): string => card.split(':')[0];

/** Hand total with soft-ace reduction. */
export function handValue(cards: string[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const v = cardValueFromRank(rankOf(c));
    total += v;
    if (v === 11) aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export const isBlackjack = (cards: string[]): boolean => cards.length === 2 && handValue(cards).total === 21;
