/**
 * STANDALONE VERIFIER — generated, do not edit.
 *
 *     node verify.js
 *
 * Runs the full scored verification with no `npm install`: this file contains the package's own
 * compiled verification code and reaches nothing outside Node's built-in modules. It reads the
 * committed artifacts from their normal locations and, exactly like `npm run verify`, writes
 * `outputs/verification-results.json` and `outputs/report-figures.json` directly.
 *
 * It is a BUILD PRODUCT of `tests/verify.ts` and the sources it imports — not a second implementation.
 * Rebuild with `audit-framework/tools/build-standalone-verifier.mjs <package>`;
 * `check-standalone.sh` fails the gate if this file and the TypeScript have drifted apart.
 *
 * Source entry : tests/verify.ts
 * Linked modules: 23
 */
'use strict';

var __PF_ROOT__ = __dirname;
var __nodeRequire = require;
var __modules = {
  "src/config.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * LIQD Blackjack — game configuration.
 *
 * Every value here was confirmed from the live game surface and/or read off the
 * 6,000-hand captured dataset (see verify.ts rules steps and live-parity-testing.md).
 * There is no external multiplier table to pin (blackjack is rule-driven, not
 * table-driven); the side-bet paytables are LIQD client constants, cross-checked
 * against live side-bet wins in the capture.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBlackjack = exports.suitOf = exports.rankOf = exports.TWENTY_ONE_PLUS_THREE = exports.PERFECT_PAIRS = exports.PASS2_LATE_NONCES = exports.PASS2_TOTAL_NONCES = exports.PASS2_EARLY_NONCES = exports.PASS2_P0 = exports.PASS2_ALPHA = exports.FIRST_CARD_DF = exports.RANKS = exports.SIM_SD_PER_ROUND = exports.SIM_PASS1_ROUNDS = exports.SIM_BASE_ROUNDS = exports.EXPECTED_HANDS = exports.EXPECTED_EPOCH_SIZE = exports.EXPECTED_SEEDS = exports.NOMINAL_HOUSE_EDGE = exports.SHOE_SIZE = exports.DECKS = exports.RNG_BRANCH_SHA256 = exports.ATTACK_SHA256 = exports.EXACT_RTP_SHA256 = exports.SIMULATION_HTML_SHA256 = exports.SIMULATION_SHA256 = exports.DATASET_SHA256 = void 0;
exports.cherryPickFlag = cherryPickFlag;
exports.cardValueFromRank = cardValueFromRank;
exports.handValue = handValue;
/** SHA-256 of the captured dataset — the verifier aborts if this does not match. */
exports.DATASET_SHA256 = 'c2a28c5164a546105963ffb4ff8e7c422a68802df47afcdcfa0b4fdbad1fdbf7';
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
exports.SIMULATION_SHA256 = '782c056164982d76879225c2e4059d1d7ee29f176e095ee78105386759574686';
/**
 * SHA-256 of the committed convergence chart (`outputs/rtp-convergence.html`). The chart and the
 * JSON are two outputs of ONE `npm run simulate` and must move together — pinning only the JSON
 * let a stale chart (labelling a pre-fix figure "AUTHORITATIVE") survive a full gate. Reconciled
 * in scored Step 25 alongside the JSON pin, with the same SIM_FRESH=1 record-and-label bypass on
 * the hash (its PRESENCE is required unconditionally).
 */
exports.SIMULATION_HTML_SHA256 = '321d58a6609efb00e52c69c56c5d0ecc245d6da83f3a06f70c07a6c2da827c66';
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
exports.EXACT_RTP_SHA256 = 'db26864d6a7272cbc069e85a961b231b3937332a291822215612dc79060a5fff';
/**
 * SHA-256 of `outputs/cherry-pick-attack.json` — the measured return-based seed grind against
 * this audit's own Step-19 detector (`npm run attack`, src/cherry-pick-attack.ts).
 *
 * It is the producing artifact for every figure the report quotes about cherry-pick DETECTION
 * POWER, so it is pinned like any other. Deterministic by construction — candidate and bootstrap
 * seeds are SHA-256 of fixed labels and the file carries no timestamp — so `npm run attack`
 * reproduces it byte-for-byte and the pin needs no SIM_FRESH-style bypass.
 */
exports.ATTACK_SHA256 = 'd69da9086664be838677cfc4da146b66e56b69f00f1d755b4a8d38d0ef08d4ad';
/**
 * SHA-256 of `outputs/rng-branch-coverage.json` — which paths of the draw primitive the capture
 * actually exercised (`npm run branches`, src/rng-branch-audit.ts). Producing artifact for the
 * "the rejection branch is ASSUMED, not witnessed" figures in rng-algorithm-analysis.md.
 * Deterministic: it replays the committed dataset and evaluates closed forms.
 */
exports.RNG_BRANCH_SHA256 = 'eb2c74a1ecf84d3dbf3c1cc3a490b9c04ad1a24d201c4f58efc4403bbacb4593';
exports.DECKS = 8;
exports.SHOE_SIZE = exports.DECKS * 52; // 416
exports.NOMINAL_HOUSE_EDGE = 0.01; // internal config field houseEdge=1.00% (NOT the surface figure: the game surface advertises 0.48% [E16])
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
exports.EXPECTED_SEEDS = 120;
/** Rounds served per epoch before rotation. */
exports.EXPECTED_EPOCH_SIZE = 50;
/** Total captured rounds. 120 × 50 = 6,000 — the population every headline figure rests on. */
exports.EXPECTED_HANDS = exports.EXPECTED_SEEDS * exports.EXPECTED_EPOCH_SIZE;
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
exports.SIM_BASE_ROUNDS = 30000000;
/** Rounds in the committed Pass-1 real-shoe fairness run (`pass1_fresh_seeds.rounds`). */
exports.SIM_PASS1_ROUNDS = 500000;
/** Per-round SD of the per-initial-bet loss, measured 1.146718922176392, rounded up. */
exports.SIM_SD_PER_ROUND = 1.15;
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
exports.RANKS = 13;
/**
 * Degrees of freedom for the first-card rank χ². DERIVED from RANKS, never read from the
 * artifact: a reviewer set `firstCardChi2=9999, firstCardDf=100000, firstCardPValue=1`,
 * re-pinned, and Step 18 printed "RECOMPUTED … p=1.0000" and PASSed — because the step
 * recomputed p from a df the artifact supplied.
 */
exports.FIRST_CARD_DF = exports.RANKS - 1;
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
exports.PASS2_ALPHA = 0.05;
/** Per-seed flag probability under the null: α × (1 − α). */
exports.PASS2_P0 = exports.PASS2_ALPHA * (1 - exports.PASS2_ALPHA);
/** Served window scored by the Pass-2 early statistic — nonces 0..49, the rounds actually dealt. */
exports.PASS2_EARLY_NONCES = exports.EXPECTED_EPOCH_SIZE;
/**
 * Total nonces derived per seed by the Pass-2 experiment: the served window plus the LATE control
 * window (nonces 50..999, 950 of them). Declared here rather than left as a local in
 * `src/simulate.ts` because `src/cherry-pick-attack.ts` has to score the SAME two windows — see
 * `cherryPickFlag` below.
 */
exports.PASS2_TOTAL_NONCES = 1000;
/** Nonces in the late control window: 950, expected count per rank 73, so no bin pooling (df 12). */
exports.PASS2_LATE_NONCES = exports.PASS2_TOTAL_NONCES - exports.PASS2_EARLY_NONCES;
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
function cherryPickFlag(earlyP, lateP) {
    return earlyP < exports.PASS2_ALPHA && lateP >= exports.PASS2_ALPHA;
}
// NOTE: the enforced rule set is NOT a single object here. Each consumer carries its own
// rule constants — the exact solver (`src/exact-play.ts` LIQD_RULES), the simulator
// (`src/simulate.ts`), the payout evaluator (`tests/steps/payouts.ts`), and the rational
// oracle (`anchor/oracle.py`) — and each is exercised by the verification suite. A former
// `RULES` object lived here but nothing imported it, so it could drift from the rules the
// code actually applies; it was removed to avoid pointing the reader at dead code.
/** Perfect Pairs side-bet paytable (payout-to-1). LIQD client constants. */
exports.PERFECT_PAIRS = {
    PERFECT_PAIR: 25, // same rank + same suit
    COLORED_PAIR: 13, // same rank + same colour, different suit
    MIXED_PAIR: 6, // same rank, different colour
};
/** 21+3 side-bet paytable (payout-to-1) on the player's two cards + dealer upcard. */
exports.TWENTY_ONE_PLUS_THREE = {
    SUITED_THREE_OF_A_KIND: 100,
    STRAIGHT_FLUSH: 40,
    THREE_OF_A_KIND: 30,
    STRAIGHT: 10,
    FLUSH: 5,
};
/** Card value: A=11 (soft), 10/J/Q/K=10, else pip. rank is 1..13 (1=A..13=K). */
function cardValueFromRank(rank) {
    return rank === 1 ? 11 : rank >= 10 ? 10 : rank;
}
const rankOf = (card) => Number(card.split(':')[1]);
exports.rankOf = rankOf;
const suitOf = (card) => card.split(':')[0];
exports.suitOf = suitOf;
/** Hand total with soft-ace reduction. */
function handValue(cards) {
    let total = 0;
    let aces = 0;
    for (const c of cards) {
        const v = cardValueFromRank((0, exports.rankOf)(c));
        total += v;
        if (v === 11)
            aces++;
    }
    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }
    return { total, soft: aces > 0 };
}
const isBlackjack = (cards) => cards.length === 2 && handValue(cards).total === 21;
exports.isBlackjack = isBlackjack;

  },
  "src/exact-play.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * LIQD Blackjack — exact EV solver, parameterised on the shoe model.
 *
 * One engine, two modes:
 *   {kind:'infinite'}          — each draw independent at 1/13 (4/13 for T).
 *                                Exact for a with-replacement RNG that picks `value % 52`.
 *   {kind:'finite', decks: 8}  — a real 416-card shoe dealt WITHOUT replacement,
 *                                reshuffled every hand. Exact for LIQD, whose
 *                                RNG is a Fisher-Yates shuffle over 8 decks.
 *
 * and two strategies:
 *   'TD' — actions read from src/strategy.ts, the table simulate.ts plays.
 *          This is the simulation's exact target.
 *   'CD' — actions chosen by argmax at every state (composition-dependent
 *          optimal). The true optimal floor, and the independent check on the
 *          table: sim and solver share strategy.ts and could share a bug in it,
 *          but CD ignores the table entirely.
 *
 * ── The split EV: one scoped derivation, and what it does and does not assume ──
 *
 * The identity this solver uses for a split is
 *
 *     EV_split(x,x vs u) = 2 × EV_hand(start = [x], up = u, comp − {x,x,u})
 *
 * Round-4 QA-06 replaced two conflicting paragraphs here — one asserting the identity was
 * "exact, not an approximation", the next hedging it as an approximation with no stated error
 * bound. Neither is a derivation, and agreement with `anchor/oracle.py` cannot settle it: that
 * oracle plays splits SEQUENTIALLY against a physically depleted shoe, but the two engines were
 * written by the same team, so the argument has to stand on its own. It is set out here with its
 * assumptions named, and the numerical results are unchanged.
 *
 * ASSUMPTIONS, in the order they are used:
 *
 *   A1. NO RE-SPLIT. LIQD splits to two hands only, so the number of hands is fixed at 2 and
 *       there is no branching over how many hands exist. This is a confirmed rule of the game
 *       (and, where it is not directly observed, a disclosed limitation — see L5); it is not a
 *       modelling convenience.
 *   A2. FIXED, TOTAL-DEPENDENT STRATEGY, and the INFORMATION each hand may use. Both hands are
 *       played by the same policy read from `src/strategy.ts`, whose argument is (own total,
 *       soft/hard, dealer upcard). No decision on the second hand may depend on which cards the
 *       first hand drew. This is what makes the second hand's decision rule identical to the
 *       first's, and it is a MODELLING CHOICE that matches the headline figure's definition
 *       (basic strategy), not an unavoidable truth about blackjack.
 *   A3. EXCHANGEABILITY of the shoe. In a shuffled shoe, the cards dealt after any stopping time
 *       are exchangeable with the cards dealt first, so — under A2 — the second hand faces the
 *       same predictive distribution over its next card as the first hand did. The two hands are
 *       CORRELATED (shared dealer, shared shoe), but correlation does not move the expectation of
 *       a SUM: E[X₁ + X₂] = E[X₁] + E[X₂] holds without independence, and A2 plus A3 give
 *       E[X₂] = E[X₁]. That is the whole of the "× 2".
 *   A4. HOLE-CARD CONDITIONING. Under peek/OBO with upcard A or T, the hole is a single unseen
 *       card restricted to the non-natural ranks. Its posterior stays proportional to the current
 *       unseen counts over those ranks whatever the player draws (the draw likelihoods cancel),
 *       so composition remains sufficient state and the hole is mixed over only at settlement.
 *       See the section below.
 *
 * WHAT IS EXACT AND WHAT IS NOT, kept separate.
 *
 *   • The HEADLINE model is TOTAL-DEPENDENT over a finite 8-deck shoe. Within that model the
 *     identity above is EXACT: A1 removes the branching, A2 fixes the policy, A3 equates the two
 *     hands' expectations, and linearity of expectation does the rest. `edgePerInitialBet` and
 *     `edgePerTotalWagered` are exact values OF THIS MODEL, computed by dynamic programming over
 *     the shoe composition with no sampling error.
 *   • A COMPOSITION-DEPENDENT model is a different model. There, a second hand that could see
 *     the first hand's cards would sometimes deviate, so 2 × EV_hand is a LOWER BOUND on an
 *     optimal composition-dependent split rather than an identity. This solver does not claim
 *     that model's value, and the CD mode it does offer is a coarse diagnostic on the strategy
 *     table (see 'CD' above), not a bound on the split residual.
 *   • THE ERROR THIS AUDIT DOES NOT BOUND: the difference between the two models on split rounds.
 *     No error bound is asserted for it and none is derived. What is stated instead is scope —
 *     splits are ~2.5 % of rounds, and every published figure is labelled as the total-dependent
 *     basic-strategy edge, which is also the convention the external Wizard of Odds anchor uses.
 *
 * CORROBORATION, at its real strength: `anchor/oracle.py` reaches the same numbers for specified
 * split cases by SEQUENTIAL physical play (a concrete hole card, a genuinely depleted shoe, no
 * conditional probability anywhere). That is evidence the identity is being APPLIED correctly and
 * that the arithmetic is right. It is not independent evidence for A2 or A3, because the oracle
 * assumes the same policy and the same information rule. Recorded as L13.
 *
 * ── Peek, handled exactly ─────────────────────────────────────────────────────
 * With upcard u in {A,T} the hole card is a single unseen card constrained to the
 * non-natural ranks. The hole-card posterior stays proportional to the current
 * unseen counts over those ranks no matter what the player draws (the draw
 * likelihoods cancel), so the composition is sufficient state and no mixture has
 * to be carried through the recursion. The hole is only mixed over at settlement.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExactSolver = exports.LIQD_RULES = exports.RIDX = exports.RANKS = void 0;
exports.solveExact = solveExact;
exports.exactSolves = exactSolves;
exports.buildExactArtifact = buildExactArtifact;
exports.serializeExactArtifact = serializeExactArtifact;
const strategy_1 = require("./strategy");
exports.RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'A'];
exports.RIDX = {
    '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, T: 8, A: 9,
};
/** Blackjack value of each rank index; A counts 11 here and is demoted as needed. */
const VAL = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const T_IDX = 8, A_IDX = 9;
exports.LIQD_RULES = {
    s17: true, das: true, peek: true, blackjackPays: 1.5,
    splitAcesOneCard: true, doubleAnyTwo: true,
};
function fullShoe(model) {
    const c = new Int32Array(10);
    if (model.kind === 'infinite') {
        // Nominal 1-deck shape; probabilities never consult it in infinite mode.
        for (let i = 0; i < 10; i++)
            c[i] = i === T_IDX ? 16 : 4;
        return c;
    }
    const d = model.decks;
    for (let i = 0; i < 10; i++)
        c[i] = (i === T_IDX ? 16 : 4) * d;
    return c;
}
const sum = (c) => {
    let n = 0;
    for (let i = 0; i < 10; i++)
        n += c[i];
    return n;
};
/**
 * Probability of drawing rank i from the current shoe. Infinite mode ignores the
 * counts entirely — that is the whole difference between the two models.
 */
function pDraw(c, n, i, model) {
    if (model.kind === 'infinite')
        return i === T_IDX ? 4 / 13 : 1 / 13;
    return n > 0 ? c[i] / n : 0;
}
/** Add a card to a running (total, soft) pair, demoting an ace if it busts. */
function addCard(total, soft, i) {
    let t = total, s = soft;
    if (i === A_IDX) {
        if (t + 11 <= 21) {
            t += 11;
            s = true;
        }
        else {
            t += 1;
        }
    }
    else {
        t += VAL[i];
        if (t > 21 && s) {
            t -= 10;
            s = false;
        }
    }
    return [t, s];
}
// ── Engine ────────────────────────────────────────────────────────────────────
class ExactSolver {
    constructor(model, strategy, rules = exports.LIQD_RULES) {
        this.dealerMemo = new Map();
        this.handMemo = new Map();
        this.outcomeMemo = new Map();
        this.model = model;
        this.rules = rules;
        this.strategy = strategy;
        this.shoe = fullShoe(model);
    }
    /** Memo key for the shoe state. Infinite mode has no state, so a constant. */
    key(c) {
        if (this.model.kind === 'infinite')
            return '';
        let k = '';
        for (let i = 0; i < 10; i++)
            k += c[i].toString(36) + '.';
        return k;
    }
    /**
     * Dealer final-total distribution as a 24-slot array indexed by total
     * (17..21 used, 22 = bust; index 23 = natural, handled by the caller).
     * Drawn without replacement from `c`, S17 or H17 per rules.
     */
    dealerDist(c, total, soft) {
        const k = `${this.key(c)}|${total}|${soft ? 1 : 0}`;
        const hit = this.dealerMemo.get(k);
        if (hit)
            return hit;
        const out = new Float64Array(24);
        if (total > 21) {
            out[22] = 1;
            this.dealerMemo.set(k, out);
            return out;
        }
        const standsHere = total >= 18
            || (total === 17 && (!soft || this.rules.s17));
        if (standsHere && total >= 17) {
            out[total] = 1;
            this.dealerMemo.set(k, out);
            return out;
        }
        const n = sum(c);
        for (let i = 0; i < 10; i++) {
            const p = pDraw(c, n, i, this.model);
            if (p <= 0)
                continue;
            const [t2, s2] = addCard(total, soft, i);
            if (this.model.kind === 'finite')
                c[i]--;
            const sub = this.dealerDist(c, t2, s2);
            if (this.model.kind === 'finite')
                c[i]++;
            for (let j = 17; j <= 22; j++)
                if (sub[j])
                    out[j] += p * sub[j];
        }
        this.dealerMemo.set(k, out);
        return out;
    }
    /**
     * Dealer outcome distribution given an upcard, mixing over the unseen hole card.
     * Returns { pNatural, dist } where dist is conditional on NO dealer natural.
     */
    dealerOutcome(c, up) {
        const k = `${this.key(c)}|up${up}`;
        const cached = this.outcomeMemo.get(k);
        if (cached)
            return cached;
        const n = sum(c);
        const natRank = up === A_IDX ? T_IDX : up === T_IDX ? A_IDX : -1;
        const pNat = natRank >= 0 ? pDraw(c, n, natRank, this.model) : 0;
        const dist = new Float64Array(24);
        // Hole is a single unseen card. If the dealer could have a natural and does
        // not, it is constrained to the non-completing ranks; the posterior is
        // proportional to the remaining counts over those ranks.
        const denom = natRank >= 0 ? 1 - pNat : 1;
        for (let h = 0; h < 10; h++) {
            if (h === natRank)
                continue;
            const pH = pDraw(c, n, h, this.model) / (denom > 0 ? denom : 1);
            if (pH <= 0)
                continue;
            const [t, s] = addCard(...addCard(0, false, up), h);
            if (this.model.kind === 'finite')
                c[h]--;
            const sub = this.dealerDist(c, t, s);
            if (this.model.kind === 'finite')
                c[h]++;
            for (let j = 17; j <= 22; j++)
                if (sub[j])
                    dist[j] += pH * sub[j];
        }
        const res = { pNatural: pNat, dist };
        this.outcomeMemo.set(k, res);
        return res;
    }
    /**
     * EV of standing on `total`.
     *
     * `hole >= 0` means the dealer's hole card is a KNOWN concrete card that has
     * already been removed from `c` — the hole-explicit peek branch (see `solve`).
     * The dealer then simply plays out from (up + hole) against the depleted shoe
     * and no conditioning appears anywhere below this point.
     *
     * `hole < 0` is the unpeeked path: the hole is unseen and mixed at settlement.
     * That is only sound when nothing has been conditioned on, which is why it is
     * now reached exclusively for upcards that cannot make a natural.
     */
    standEV(c, total, up, hole) {
        if (total > 21)
            return -1;
        if (hole >= 0) {
            const [dt, ds] = addCard(...addCard(0, false, up), hole);
            const dist = this.dealerDist(c, dt, ds);
            let ev = 0;
            for (let j = 17; j <= 22; j++) {
                const p = dist[j];
                if (!p)
                    continue;
                if (j === 22)
                    ev += p;
                else if (total > j)
                    ev += p;
                else if (total < j)
                    ev -= p;
            }
            return ev;
        }
        const { dist } = this.dealerOutcome(c, up);
        let ev = 0;
        for (let j = 17; j <= 22; j++) {
            const p = dist[j];
            if (!p)
                continue;
            if (j === 22)
                ev += p;
            else if (total > j)
                ev += p;
            else if (total < j)
                ev -= p;
        }
        return ev;
    }
    /**
     * EV of playing out a hand. `canDouble` gates the first-move double;
     * `oneCardOnly` implements split aces.
     */
    handEV(c, total, soft, up, canDouble, oneCardOnly, hole) {
        if (total > 21)
            return -1;
        if (oneCardOnly)
            return this.standEV(c, total, up, hole);
        const k = `${this.key(c)}|${total}|${soft ? 1 : 0}|${up}|${canDouble ? 1 : 0}|h${hole}`;
        const hit = this.handMemo.get(k);
        if (hit !== undefined)
            return hit;
        const evStand = this.standEV(c, total, up, hole);
        const n = sum(c);
        // Hit EV
        let evHit = 0;
        for (let i = 0; i < 10; i++) {
            const p = pDraw(c, n, i, this.model);
            if (p <= 0)
                continue;
            const [t2, s2] = addCard(total, soft, i);
            if (this.model.kind === 'finite')
                c[i]--;
            evHit += p * (t2 > 21 ? -1 : this.handEV(c, t2, s2, up, false, false, hole));
            if (this.model.kind === 'finite')
                c[i]++;
        }
        // Double EV (one card, then stand, two units)
        let evDouble = -Infinity;
        if (canDouble) {
            let e = 0;
            for (let i = 0; i < 10; i++) {
                const p = pDraw(c, n, i, this.model);
                if (p <= 0)
                    continue;
                const [t2] = addCard(total, soft, i);
                if (this.model.kind === 'finite')
                    c[i]--;
                e += p * (t2 > 21 ? -1 : this.standEV(c, t2, up, hole));
                if (this.model.kind === 'finite')
                    c[i]++;
            }
            evDouble = 2 * e;
        }
        let ev;
        if (this.strategy === 'CD') {
            ev = Math.max(evStand, evHit, canDouble ? evDouble : -Infinity);
        }
        else {
            const a = (0, strategy_1.resolvedAction)(total, soft, VAL[up], canDouble);
            ev = a === 'S' ? evStand : a === 'D' ? evDouble : evHit;
        }
        this.handMemo.set(k, ev);
        return ev;
    }
    /** Total units wagered by a hand played to completion (1, or 2 if it doubles). */
    handWager(c, total, soft, up, canDouble, oneCardOnly, hole) {
        if (total > 21 || oneCardOnly)
            return 1;
        const n = sum(c);
        if (this.strategy === 'CD') {
            // Re-derive the CD action to know whether it doubles.
            const evStand = this.standEV(c, total, up, hole);
            let evHit = 0, evDouble = -Infinity;
            for (let i = 0; i < 10; i++) {
                const p = pDraw(c, n, i, this.model);
                if (p <= 0)
                    continue;
                const [t2, s2] = addCard(total, soft, i);
                if (this.model.kind === 'finite')
                    c[i]--;
                evHit += p * (t2 > 21 ? -1 : this.handEV(c, t2, s2, up, false, false, hole));
                if (this.model.kind === 'finite')
                    c[i]++;
            }
            if (canDouble) {
                let e = 0;
                for (let i = 0; i < 10; i++) {
                    const p = pDraw(c, n, i, this.model);
                    if (p <= 0)
                        continue;
                    const [t2] = addCard(total, soft, i);
                    if (this.model.kind === 'finite')
                        c[i]--;
                    e += p * (t2 > 21 ? -1 : this.standEV(c, t2, up, hole));
                    if (this.model.kind === 'finite')
                        c[i]++;
                }
                evDouble = 2 * e;
            }
            if (canDouble && evDouble >= evStand && evDouble >= evHit)
                return 2;
            if (evStand >= evHit)
                return 1;
        }
        else {
            const a = (0, strategy_1.resolvedAction)(total, soft, VAL[up], canDouble);
            if (a === 'D')
                return 2;
            if (a === 'S')
                return 1;
        }
        // Hitting: wager stays 1 regardless of how many cards follow.
        return 1;
    }
    /** EV of splitting a pair of rank `r`, exact under no-resplit (see header). */
    splitEV(c, r, up, hole) {
        const acesOneCard = r === A_IDX && this.rules.splitAcesOneCard;
        const canDouble = this.rules.das && !acesOneCard;
        const n = sum(c);
        let ev = 0, wager = 0;
        for (let i = 0; i < 10; i++) {
            const p = pDraw(c, n, i, this.model);
            if (p <= 0)
                continue;
            const [t2, s2] = addCard(...addCard(0, false, r), i);
            if (this.model.kind === 'finite')
                c[i]--;
            ev += p * this.handEV(c, t2, s2, up, canDouble, acesOneCard, hole);
            wager += p * this.handWager(c, t2, s2, up, canDouble, acesOneCard, hole);
            if (this.model.kind === 'finite')
                c[i]++;
        }
        return { ev: 2 * ev, wager: 2 * wager };
    }
    /** EV and wager for the player's two cards against an upcard, no naturals. */
    initialEV(c, p1, p2, up, hole) {
        const [t, s] = addCard(...addCard(0, false, p1), p2);
        let best = {
            ev: this.handEV(c, t, s, up, true, false, hole),
            wager: this.handWager(c, t, s, up, true, false, hole),
        };
        if (p1 === p2) {
            const pv = p1 === A_IDX ? 11 : VAL[p1];
            const splits = this.strategy === 'CD'
                ? true // CD decides by EV
                : (0, strategy_1.pairAction)(pv, VAL[up]) === 'P'; // TD reads the table
            if (splits) {
                const sp = this.splitEV(c, p1, up, hole);
                if (this.strategy === 'CD') {
                    if (sp.ev > best.ev)
                        best = sp;
                }
                else {
                    best = sp;
                }
            }
        }
        return best;
    }
    /**
     * Exact result over every initial deal, enumerated without replacement.
     * Returns EV per initial bet, per total wagered, and E[total wager].
     */
    solve() {
        const c = Int32Array.from(this.shoe);
        const bjPays = this.rules.blackjackPays;
        let evSum = 0, wagerSum = 0, pSum = 0;
        let pPlayerBJ = 0, pDealerBJ = 0;
        const N0 = sum(c);
        for (let p1 = 0; p1 < 10; p1++) {
            if (c[p1] === 0)
                continue;
            const pp1 = pDraw(c, N0, p1, this.model);
            if (this.model.kind === 'finite')
                c[p1]--;
            const N1 = sum(c);
            for (let up = 0; up < 10; up++) {
                if (c[up] === 0)
                    continue;
                const pUp = pDraw(c, N1, up, this.model);
                if (this.model.kind === 'finite')
                    c[up]--;
                const N2 = sum(c);
                for (let p2 = 0; p2 < 10; p2++) {
                    if (c[p2] === 0)
                        continue;
                    const pp2 = pDraw(c, N2, p2, this.model);
                    if (this.model.kind === 'finite')
                        c[p2]--;
                    const pCombo = pp1 * pUp * pp2;
                    pSum += pCombo;
                    const playerBJ = (p1 === T_IDX && p2 === A_IDX) || (p1 === A_IDX && p2 === T_IDX);
                    if (playerBJ)
                        pPlayerBJ += pCombo;
                    // Dealer natural probability given the three exposed cards.
                    const { pNatural } = this.dealerOutcome(c, up);
                    if (up === A_IDX || up === T_IDX)
                        pDealerBJ += pCombo * pNatural;
                    let ev, wager;
                    if (playerBJ) {
                        // Peek: a dealer natural pushes; otherwise the player is paid 3:2.
                        // Under peek/OBO the dealer's natural is revealed immediately, so a player
                        // natural pushes against it with probability pNatural either way; the rule flag
                        // does not change this branch. Kept explicit rather than as a dead ternary.
                        const pd = pNatural;
                        ev = pd * 0 + (1 - pd) * bjPays;
                        wager = 1;
                    }
                    else if ((up === A_IDX || up === T_IDX) && this.rules.peek && this.strategy === 'TD') {
                        // ── Hole-explicit peek branch ────────────────────────────────────
                        // Conditioning happens ONCE, here, and never again below.
                        //
                        // The old form computed `Sum_d P(d) * E[return | E, d]` — player draw
                        // paths weighted by the UNCONDITIONAL shoe law with the hole still in
                        // the drawable pool — and applied the no-natural conditioning only at
                        // the settlement leaf. That is not the conditional expectation: given
                        // "no natural", the player's own draw law shifts (knowing the hole is
                        // not a Ten leaves more Tens drawable), so the path weights are wrong.
                        // Verified against an exact-rational physical enumerator: the error is
                        // algebraic, not numerical, and scales ~1/N.
                        //
                        // Here the hole is a CONCRETE card, drawn and removed from the shoe
                        // before the player acts. Inside each branch the dealer's hand is known
                        // and every player draw is the plain physical law on the depleted shoe.
                        // The `Sum_h w_h = 1` mixture is Bayes as an identity.
                        // In infinite mode the draw law is composition-free, so P(E | draws)
                        // is constant and this branch collapses to the old one — identical
                        // results, which is why the infinite regression test is unaffected.
                        const natRank = up === A_IDX ? T_IDX : A_IDX;
                        const N = sum(c);
                        const pNat = pDraw(c, N, natRank, this.model);
                        const denomP = 1 - pNat;
                        let evPlay = 0, wagerPlay = 0;
                        for (let h = 0; h < 10; h++) {
                            if (h === natRank || c[h] === 0)
                                continue;
                            const w = denomP > 0 ? pDraw(c, N, h, this.model) / denomP : 0;
                            if (w <= 0)
                                continue;
                            if (this.model.kind === 'finite')
                                c[h]--; // the hole is a real card
                            const r = this.initialEV(c, p1, p2, up, h);
                            if (this.model.kind === 'finite')
                                c[h]++;
                            evPlay += w * r.ev;
                            wagerPlay += w * r.wager;
                        }
                        // OBO: a dealer natural takes the initial bet only.
                        ev = pNat * -1 + (1 - pNat) * evPlay;
                        wager = pNat * 1 + (1 - pNat) * wagerPlay;
                    }
                    else if (up === A_IDX || up === T_IDX) {
                        // Two cases land here.
                        //
                        // 1. No peek (OBO off): nothing is conditioned on, so the unseen-hole
                        //    mixture at settlement is sound and the player commits everything.
                        //
                        // 2. CD under peek: KNOWN BIASED — see `cdPeekIsApproximate`. CD cannot
                        //    use the hole-explicit branch, because an argmax evaluated inside a
                        //    fixed-hole branch lets the player choose as if the hole were
                        //    visible (measured: +5.5 pp, a peeking player). The correct CD form
                        //    is a per-node posterior mixture, not yet implemented, so CD keeps
                        //    the old conditioning here and carries the ~1/N error the TD path
                        //    just shed. CD is an internal diagnostic on the strategy table; its
                        //    figure must NOT be published as exact until the mixture form lands.
                        const inner = this.initialEV(c, p1, p2, up, -1);
                        if (this.rules.peek) {
                            ev = pNatural * -1 + (1 - pNatural) * inner.ev;
                            wager = pNatural * 1 + (1 - pNatural) * inner.wager;
                        }
                        else {
                            ev = pNatural * -inner.wager + (1 - pNatural) * inner.ev;
                            wager = inner.wager;
                        }
                    }
                    else {
                        // Upcard cannot make a natural: no conditioning, unseen hole is fine.
                        const inner = this.initialEV(c, p1, p2, up, -1);
                        ev = inner.ev;
                        wager = inner.wager;
                    }
                    evSum += pCombo * ev;
                    wagerSum += pCombo * wager;
                    if (this.model.kind === 'finite')
                        c[p2]++;
                }
                if (this.model.kind === 'finite')
                    c[up]++;
            }
            if (this.model.kind === 'finite')
                c[p1]++;
        }
        // In infinite mode the enumeration is already normalised; in finite mode the
        // three-card probabilities sum to 1 by construction. Guard anyway.
        const norm = pSum > 0 ? pSum : 1;
        const evPerInitial = evSum / norm;
        const avgWager = wagerSum / norm;
        return {
            model: this.model,
            strategy: this.strategy,
            rules: this.rules,
            evPerInitialBet: evPerInitial,
            rtpPerInitialBet: 1 + evPerInitial,
            edgePerInitialBet: -evPerInitial,
            avgWager,
            evPerTotalWagered: evPerInitial / avgWager,
            rtpPerTotalWagered: 1 + evPerInitial / avgWager,
            edgePerTotalWagered: -evPerInitial / avgWager,
            playerBlackjackFreq: pPlayerBJ / norm,
            dealerBlackjackFreq: pDealerBJ / norm,
            probabilityMass: pSum,
            cdPeekIsApproximate: this.strategy === 'CD' && this.model.kind === 'finite' && this.rules.peek,
        };
    }
}
exports.ExactSolver = ExactSolver;
function solveExact(model, strategy, rules = exports.LIQD_RULES) {
    return new ExactSolver(model, strategy, rules).solve();
}
/** Run (or look up, if `solver` caches) the four solves the artifact is built from. */
function exactSolves(solver = solveExact) {
    return {
        infiniteCD: solver({ kind: 'infinite' }, 'CD', exports.LIQD_RULES),
        finite8TD: solver({ kind: 'finite', decks: 8 }, 'TD', exports.LIQD_RULES),
        finite1TD: solver({ kind: 'finite', decks: 1 }, 'TD', exports.LIQD_RULES),
        // 6-deck exact solve, all other rule inputs identical — used only to record, in the artifact,
        // the precision of the published WoO reference (its 6-deck csm figure differs from this exact
        // solve by ~1e-4 pp, so WoO's csm figures resolve to ~1e-4 pp, not 1e-5 pp).
        finite6TD: solver({ kind: 'finite', decks: 6 }, 'TD', exports.LIQD_RULES),
    };
}
/**
 * Build the artifact of record for the exact figures (`outputs/exact-rtp.json`).
 *
 * Deterministic — no timestamp, no randomness — so the file and its hash are stable
 * across runs. This is the producing artifact for every exact TD number the report
 * cites; the simulation artifact's own exactTD block is a point-in-time copy and is
 * NOT the citation source.
 *
 * EXPORTED ON PURPOSE (round-2 QA item 1). `npm run rtp` writes what this returns, and
 * `tests/blackjack/exactSolverTests.ts` deep-compares the COMMITTED file against a fresh
 * call. Before that, the test gated three fields of `finite8TD` by hand, so a hand-edit of
 * `rtpPerTotalWagered`, `avgWager`, `finite1TD`, `infiniteCD`, `cardRemovalLiftPP`,
 * `sixDeckExact` or anything in `wooAnchor` passed the whole suite. One builder, two
 * readers: every key path in the artifact is now bound to the code that produces it, and
 * a field added here is covered the moment it exists.
 */
function buildExactArtifact(solver = solveExact) {
    const { infiniteCD: inf, finite8TD: td, finite1TD: oneDeck, finite6TD: sixDeck } = exactSolves(solver);
    return {
        generatedBy: 'npm run rtp (src/exact-play.ts)',
        deterministic: true,
        finite8TD: td,
        finite1TD: oneDeck,
        infiniteCD: inf,
        cardRemovalLiftPP: (td.rtpPerInitialBet - inf.rtpPerInitialBet) * 100,
        note: 'finite8TD is the headline: exact EV of the src/strategy.ts table on a real ' +
            '416-card shoe, hole-explicit peek branch, anchored to the tiny-shoe ' +
            'exact-rational oracle (anchor/oracle.py, tests/blackjack/exactOracleTests.ts). ' +
            'Finite-shoe CD is a demoted internal diagnostic (cdPeekIsApproximate) and is ' +
            'deliberately absent from this artifact. Base game only — side bets and ' +
            'insurance are excluded.',
        wooAnchor: {
            source: 'https://wizardofodds.com/games/blackjack/calculator/',
            capturedAt: '2026-08-23',
            settings: '8 decks, S17, DAS, double any two, split to 2 hands, no resplit aces, ' +
                'no hit split aces, OBO peek, no surrender, blackjack 3:2',
            basicStrategyContinuousShuffler: 0.0048768,
            basicStrategyContinuousShufflerNote: 'total-dependent basic strategy, reshuffle every hand — the LIQD regime; ' +
                'published at 5 decimal places of percent (0.48768%)',
            deltaVsFinite8TD: td.edgePerInitialBet - 0.0048768,
            sixDeckPublished: 0.0045999,
            sixDeckExact: sixDeck.edgePerInitialBet,
            sixDeckNote: 'Same rule set at 6 decks: WoO publishes 0.45999% (sixDeckPublished) while this engine ' +
                'solves to sixDeckExact. The differences are about 0.00005441 pp at six decks and ' +
                '0.00000518 pp at eight decks. This supports close agreement at the available ' +
                'reference precision; it does not certify every digit of the internal solve.',
        },
    };
}
/** Byte-for-byte serialisation of the artifact as `npm run rtp` writes it to disk. */
function serializeExactArtifact(artifact) {
    return JSON.stringify(artifact, null, 2) + '\n';
}
if (require.main === module) {
    /* eslint-disable @typescript-eslint/no-var-requires */
    const fs = require('fs');
    const path = require('path');
    // Cache the four solves so the console summary below and the artifact are the SAME numbers.
    const cache = new Map();
    const t = {};
    const timedSolver = (model, strategy, rules) => {
        const key = JSON.stringify(model) + strategy;
        let r = cache.get(key);
        if (!r) {
            const t0 = Date.now();
            r = solveExact(model, strategy, rules);
            t[key] = Date.now() - t0;
            cache.set(key, r);
        }
        return r;
    };
    const artifact = buildExactArtifact(timedSolver);
    const { infiniteCD: inf, finite8TD: td, finite1TD: oneDeck, finite6TD: sixDeck } = exactSolves(timedSolver);
    const secs = (model, strategy) => ((t[JSON.stringify(model) + strategy] ?? 0) / 1000).toFixed(2);
    console.log('\n  Infinite deck, CD (with-replacement model)');
    console.log(`    RTP per initial bet : ${(inf.rtpPerInitialBet * 100).toFixed(6)}%`);
    console.log(`    edge                : ${(inf.edgePerInitialBet * 100).toFixed(6)}%`);
    console.log(`    time                : ${secs({ kind: 'infinite' }, 'CD')}s`);
    console.log('\n  Finite 8-deck, TD (the table simulate.ts plays)');
    console.log(`    RTP per initial bet : ${(td.rtpPerInitialBet * 100).toFixed(6)}%   edge ${(td.edgePerInitialBet * 100).toFixed(6)}%`);
    console.log(`    RTP per total wager : ${(td.rtpPerTotalWagered * 100).toFixed(6)}%   avg wager ${td.avgWager.toFixed(6)}`);
    console.log(`    time                : ${secs({ kind: 'finite', decks: 8 }, 'TD')}s`);
    console.log('\n  Finite 1-deck, TD (deck-sensitivity reference, same 8-deck table)');
    console.log(`    edge per initial bet: ${(oneDeck.edgePerInitialBet * 100).toFixed(6)}%\n`);
    console.log(`  Finite 6-deck, TD (WoO precision reference): edge ${(sixDeck.edgePerInitialBet * 100).toFixed(6)}%\n`);
    const outPath = path.join(__dirname, '..', 'outputs', 'exact-rtp.json');
    fs.writeFileSync(outPath, serializeExactArtifact(artifact));
    console.log(`  Wrote ${outPath}\n`);
}

  },
  "src/loader.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * Dataset loader with a mandatory SHA-256 hash guard.
 *
 * The guard runs BEFORE any verification so the suite can never validate the wrong
 * file. Prints expected + actual and exits non-zero on mismatch.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAPTURE_SIDE_FIELDS = exports.DATA_PATH = void 0;
exports.datasetHash = datasetHash;
exports.stripCaptureSideFields = stripCaptureSideFields;
exports.loadDataset = loadDataset;
exports.revealedSeedMap = revealedSeedMap;
const fs_1 = require("fs");
const crypto_1 = require("crypto");
const path_1 = require("path");
const config_1 = require("./config");
exports.DATA_PATH = (0, path_1.join)(__dirname, '..', 'data', 'blackjack-6000hands.json');
function datasetHash(path = exports.DATA_PATH) {
    return (0, crypto_1.createHash)('sha256').update((0, fs_1.readFileSync)(path)).digest('hex');
}
/**
 * Fields the capture rig wrote from its OWN recomputation of the game, not from anything
 * LIQD returned: the rig's reconstructed shoe prefix and its own pass/fail verdicts.
 *
 * They are DELETED here, at the single entry point every scored step loads through, so the
 * verification path cannot read them by any access pattern — dotted, bracketed, destructured
 * or computed. `tests/blackjack/antiCircularityTests.ts` is a lint-style regex over source
 * text and cannot see a computed key (`const K = 'veri' + 'fied'; b[K]`); this makes the
 * independence guarantee structural instead of stylistic (round-2 QA item 22).
 *
 * The stripping happens AFTER the hash guard and only in memory. `datasetHash()` reads the
 * file from disk, so the committed dataset — fields and all — is unchanged and still hashes
 * to DATASET_SHA256; the fields remain in the shipped artifact for a third party to inspect.
 */
exports.CAPTURE_SIDE_FIELDS = ['localSequence', 'commitVerified', 'chainLinkOk', 'verified'];
/** Delete every capture-side field from every bet and seed. Computed keys — no literal access. */
function stripCaptureSideFields(ds) {
    const strip = (o) => {
        for (const f of exports.CAPTURE_SIDE_FIELDS)
            delete o[f];
    };
    for (const b of ds.bets)
        strip(b);
    for (const s of ds.seeds)
        strip(s);
    return ds;
}
/**
 * Hash-guard first, then parse, then strip the capture-side fields.
 * On hash mismatch: print both hashes and process.exit(1).
 */
function loadDataset(path = exports.DATA_PATH) {
    const actual = datasetHash(path);
    if (actual !== config_1.DATASET_SHA256) {
        console.error('\n❌ Dataset hash mismatch — refusing to run.');
        console.error(`   expected: ${config_1.DATASET_SHA256}`);
        console.error(`   actual:   ${actual}`);
        process.exit(1);
    }
    return stripCaptureSideFields(JSON.parse((0, fs_1.readFileSync)(path, 'utf8')));
}
/** O(1) revealed-seed lookup: Map<hashedServerSeed, Seed>. */
function revealedSeedMap(ds) {
    const m = new Map();
    for (const s of ds.seeds)
        m.set(s.hashedServerSeed, s);
    return m;
}

  },
  "src/money.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * MONEY, in exact integer settlement units. One definition, every money check.
 *
 * WHY THIS EXISTS (round-4 QA-01).
 *
 * The payout checks used to compare amounts with `Math.abs(a - b) <= 1e-6`. That is the wrong
 * SHAPE of check, not merely a loose one: it rejects an amount that cannot exist on the settlement
 * grid, but it ACCEPTS a wrong amount that can. Executed counterexample: rewriting the epoch-0
 * nonce-0 per-hand credit from `0.20` to `0.1999995` — a legal grid amount, 50 whole settlement
 * units short of what the cards and rules require, i.e. a real underpayment — and re-pinning the
 * dataset left the complete suite green, because 5e-7 < 1e-6. Nothing below 1e-6 could be seen.
 *
 * The capture uses an eight-decimal accounting grid. Every recorded amount is an integer number of 1e-8 units, and so is
 * every rule-derived return (the multipliers are 0, 1, 2, 5/2 and 3 on integer stakes, and the
 * side-bet paytables are whole numbers to one). Comparisons are therefore INTEGER EQUALITY in
 * those units, and the only tolerance in the system sits where float noise genuinely lives:
 * reading a JSON double back onto the grid.
 *
 * It lives in its own module rather than being written out in each step file, because two copies
 * of a rule are two rules — the defect class QA-02 was raised about.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.asMoney = exports.unitsOr0 = exports.GRID_TOL = exports.GRID = void 0;
exports.unitsOf = unitsOf;
/** 8 decimals — the captured game-accounting precision. */
exports.GRID = 1e8;
/**
 * Tolerance for snapping a JSON double onto the grid, IN GRID UNITS.
 *
 * Measured over the committed dataset: 42,894 amounts, worst deviation 1.2e-7 units. The largest
 * offender is `winningAmount: 4.6000000000000005` at epoch 2 nonce 25, which is approximately 5.96e-8 grid units off
 * 4.60 and must therefore read as exactly 460,000,000 units. 1e-3 is ~8,400× the measured noise
 * and 1/1000 of the smallest error that can actually exist — one unit — so representation noise
 * and a real money error can never be confused for one another.
 */
exports.GRID_TOL = 1e-3;
/** A recorded money amount in exact integer settlement units, or null if it is OFF the 1e-8 grid. */
function unitsOf(v) {
    if (v === null || v === undefined)
        return null;
    const x = Number(v);
    if (!Number.isFinite(x))
        return null;
    const u = x * exports.GRID;
    const r = Math.round(u);
    return Math.abs(u - r) > exports.GRID_TOL ? null : r;
}
/** Same, but an absent or off-grid amount counts as zero — for summing optional components. */
const unitsOr0 = (v) => unitsOf(v) ?? 0;
exports.unitsOr0 = unitsOr0;
/** Grid units rendered back as a decimal amount, for failure messages. */
const asMoney = (units) => (units / exports.GRID).toFixed(8);
exports.asMoney = asMoney;

  },
  "src/optimal-play.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * LIQD Blackjack — Optimal-Play RTP Engine (analytical)
 *
 * Independent recursive EV solver for optimal basic strategy. Computes the
 * theoretical RTP WITHOUT referencing any LIQD-supplied figure. Wizard of Odds is
 * used only for cross-validation, never as an input.
 *
 * This engine is the INFINITE-DECK limit (each draw independent). LIQD deals from a
 * finite 8-deck (416-card) shoe reshuffled every hand, so the finite-shoe removal
 * effect makes the true RTP marginally different. The AUTHORITATIVE finite 8-deck
 * RTP is the deterministic exact solve in `src/exact-play.ts` (the Monte-Carlo
 * simulation confirms it, but does not establish it); this analytical value is the
 * independent theoretical
 * cross-check, and both are compared to the published Wizard of Odds 8-deck figure.
 *
 * Rules (read off the 6,000-hand dataset — see verify.ts rules steps):
 *   - Dealer stands on soft 17 (S17)
 *   - Blackjack pays 3:2 (2.5× return)
 *   - Double on any two cards; double after split (DAS)
 *   - Split on matching VALUE (any two ten-valued cards may be split); one card on split
 *     aces; NO re-split. Basic strategy never splits tens, so rank-equality detection is
 *     sufficient for the RTP engine — see the note at the pair check in src/simulate.ts.
 *   - Dealer peeks for blackjack on Ace / 10 upcards
 *   - No surrender
 *
 * Card probabilities (infinite deck, suit-agnostic):
 *   2..9, A: 1/13 each;  T (10/J/Q/K): 4/13
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeOptimalRTP = computeOptimalRTP;
exports.clearCaches = clearCaches;
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'A'];
const P = {
    '2': 1 / 13, '3': 1 / 13, '4': 1 / 13, '5': 1 / 13, '6': 1 / 13,
    '7': 1 / 13, '8': 1 / 13, '9': 1 / 13, T: 4 / 13, A: 1 / 13,
};
const V = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 10, A: 11,
};
function add(s, r) {
    let total = s.total;
    let soft = s.soft;
    if (r === 'A') {
        if (total + 11 <= 21) {
            total += 11;
            soft = true;
        }
        else {
            total += 1;
        }
    }
    else {
        total += V[r];
        if (total > 21 && soft) {
            total -= 10;
            soft = false;
        }
    }
    return { total, soft };
}
const dealerCache = new Map();
/** Dealer final-total distribution (22 = bust). */
function dealerDist(state, s17) {
    const key = `${state.total}-${state.soft}-${s17}`;
    const cached = dealerCache.get(key);
    if (cached)
        return cached;
    if (state.total > 21) {
        const m = new Map([[22, 1]]);
        dealerCache.set(key, m);
        return m;
    }
    const stands = state.total >= 18 || (state.total === 17 && (!state.soft || s17 === 'stand'));
    if (stands) {
        const m = new Map([[state.total, 1]]);
        dealerCache.set(key, m);
        return m;
    }
    const m = new Map();
    for (const r of RANKS) {
        const sub = dealerDist(add(state, r), s17);
        for (const [t, p] of sub)
            m.set(t, (m.get(t) || 0) + P[r] * p);
    }
    dealerCache.set(key, m);
    return m;
}
/** Dealer distribution from an upcard, applying the peek rule. */
function dealerStartDist(upcard, s17) {
    const afterUp = add({ total: 0, soft: false }, upcard);
    if (upcard !== 'T' && upcard !== 'A')
        return { pBJ: 0, distNoBJ: dealerDist(afterUp, s17) };
    const pBJ = upcard === 'A' ? P.T : P.A;
    const distNoBJ = new Map();
    for (const hole of RANKS) {
        const isBJHole = (upcard === 'A' && hole === 'T') || (upcard === 'T' && hole === 'A');
        if (isBJHole)
            continue;
        const sub = dealerDist(add(afterUp, hole), s17);
        const pHoleCond = P[hole] / (1 - pBJ);
        for (const [t, pt] of sub)
            distNoBJ.set(t, (distNoBJ.get(t) || 0) + pHoleCond * pt);
    }
    return { pBJ, distNoBJ };
}
const standCache = new Map();
function standEV(playerTotal, dealerUp, s17) {
    if (playerTotal > 21)
        return -1;
    const key = `${playerTotal}-${dealerUp}-${s17}`;
    const c = standCache.get(key);
    if (c !== undefined)
        return c;
    const { distNoBJ } = dealerStartDist(dealerUp, s17);
    let ev = 0;
    for (const [t, pt] of distNoBJ) {
        if (t === 22)
            ev += pt;
        else if (playerTotal > t)
            ev += pt;
        else if (playerTotal < t)
            ev -= pt;
    }
    standCache.set(key, ev);
    return ev;
}
const hitCache = new Map();
function hitEV(state, dealerUp, s17) {
    const key = `${state.total}-${state.soft}-${dealerUp}-${s17}`;
    const c = hitCache.get(key);
    if (c !== undefined)
        return c;
    let ev = 0;
    for (const r of RANKS) {
        const next = add(state, r);
        if (next.total > 21)
            ev += P[r] * -1;
        else
            ev += P[r] * Math.max(standEV(next.total, dealerUp, s17), hitEV(next, dealerUp, s17));
    }
    hitCache.set(key, ev);
    return ev;
}
function doubleEV(state, dealerUp, s17) {
    let ev = 0;
    for (const r of RANKS) {
        const next = add(state, r);
        ev += P[r] * (next.total > 21 ? -1 : standEV(next.total, dealerUp, s17));
    }
    return 2 * ev;
}
/** EV of one post-split hand from a single card (split aces: one card then stand). */
function postSplitHandEV(rank, dealerUp, s17, das) {
    const start = add({ total: 0, soft: false }, rank);
    let ev = 0;
    for (const r of RANKS) {
        const next = add(start, r);
        if (rank === 'A') {
            ev += P[r] * (next.total > 21 ? -1 : standEV(next.total, dealerUp, s17));
        }
        else {
            let best = Math.max(next.total > 21 ? -1 : standEV(next.total, dealerUp, s17), hitEV(next, dealerUp, s17));
            if (das)
                best = Math.max(best, doubleEV(next, dealerUp, s17));
            ev += P[r] * best;
        }
    }
    return ev;
}
const splitEV = (rank, up, s17, das) => 2 * postSplitHandEV(rank, up, s17, das);
function playerOptimalEV(p1, p2, up, s17, das) {
    const state = add(add({ total: 0, soft: false }, p1), p2);
    let best = Math.max(standEV(state.total, up, s17), hitEV(state, up, s17), doubleEV(state, up, s17));
    if (p1 === p2)
        best = Math.max(best, splitEV(p1, up, s17, das));
    return best;
}
/** Optimal-play RTP = E[return / wager] over all (P1, P2, dealerUp) with peek + BJ handling. */
function computeOptimalRTP(s17 = 'stand', das = true) {
    let rtpSum = 0;
    let playerBJProb = 0;
    for (const p1 of RANKS) {
        for (const p2 of RANKS) {
            const playerBJ = (p1 === 'T' && p2 === 'A') || (p1 === 'A' && p2 === 'T');
            if (playerBJ)
                playerBJProb += P[p1] * P[p2];
            for (const up of RANKS) {
                const pCombo = P[p1] * P[p2] * P[up];
                const upPeeks = up === 'A' || up === 'T';
                const pDealerBJ = up === 'A' ? P.T : up === 'T' ? P.A : 0;
                let ret;
                if (playerBJ && upPeeks)
                    ret = pDealerBJ * 1 + (1 - pDealerBJ) * 2.5;
                else if (playerBJ)
                    ret = 2.5;
                else if (upPeeks)
                    ret = pDealerBJ * 0 + (1 - pDealerBJ) * (1 + playerOptimalEV(p1, p2, up, s17, das));
                else
                    ret = 1 + playerOptimalEV(p1, p2, up, s17, das);
                rtpSum += pCombo * ret;
            }
        }
    }
    return { rtp: rtpSum, edge: 1 - rtpSum, playerBJFreq: playerBJProb, dealerBJFreq: 2 * P.T * P.A, s17, das };
}
function clearCaches() { dealerCache.clear(); standCache.clear(); hitCache.clear(); }
if (require.main === module) {
    const t0 = Date.now();
    const r = computeOptimalRTP('stand', true);
    console.log('\n  LIQD Blackjack — optimal-play RTP (analytical, infinite-deck limit)\n');
    console.log('  Rules:           S17, DAS, no surrender, no re-split, dealer peek');
    console.log(`  Optimal RTP:     ${(r.rtp * 100).toFixed(6)}%`);
    console.log(`  House edge:      ${(r.edge * 100).toFixed(6)}%`);
    console.log(`  Player BJ freq:  ${(r.playerBJFreq * 100).toFixed(4)}%  (infinite-deck 8/169 = ${(8 / 169 * 100).toFixed(4)}%)`);
    console.log(`  Dealer BJ freq:  ${(r.dealerBJFreq * 100).toFixed(4)}%`);
    console.log(`  Time:            ${((Date.now() - t0) / 1000).toFixed(2)}s`);
    console.log(`\n  This engine is the infinite-deck (with-replacement) limit only: ${(r.rtp * 100).toFixed(6)}% RTP / ${(r.edge * 100).toFixed(6)}% edge.`);
    console.log('  Authoritative finite 8-deck RTP and the pinned Wizard of Odds anchor: see the exact solve (npm run rtp -> outputs/exact-rtp.json).\n');
}

  },
  "src/report-figures.js": function (module, exports, require, __filename, __dirname) {
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPORT_FIGURES_HEADER = void 0;
exports.computeReportFigures = computeReportFigures;
exports.buildReportFiguresArtifact = buildReportFiguresArtifact;
const fs_1 = require("fs");
const path_1 = require("path");
const loader_1 = require("./loader");
const config_1 = require("./config");
const exact_play_1 = require("./exact-play");
const sidebet_edges_1 = require("./sidebet-edges");
/** Capture accounting precision: every recorded amount is an exact multiple of 1e-8 (Step 8). */
const USDC_UNITS = 100000000n;
/** Parse a recorded amount onto the integer settlement grid. Throws if it is off-grid. */
function units(x) {
    if (x === undefined || x === null)
        return 0n;
    const s = typeof x === 'number' ? x.toFixed(10) : String(x);
    const neg = s.startsWith('-');
    const [wholeRaw, fracRaw = ''] = (neg ? s.slice(1) : s).split('.');
    const frac = (fracRaw + '00000000000').slice(0, 11);
    const scaled = BigInt(wholeRaw) * 100000000000n + BigInt(frac);
    if (scaled % 1000n !== 0n)
        throw new Error(`amount off the 1e-8 settlement grid: ${s}`);
    const v = scaled / 1000n;
    return neg ? -v : v;
}
const pct = (n, d) => (d === 0n ? 0 : (Number(n) / Number(d)) * 100);
const usdc = (n) => Number(n) / Number(USDC_UNITS);
/**
 * The published exact 8-deck TD edge, read from its artifact of record.
 * `outputs/exact-rtp.json` is hash-pinned in scored Step 25 AND re-derived field by field against
 * a live `buildExactArtifact()` in `tests/blackjack/exactSolverTests.ts`, so it is a stronger
 * source than a second solve here would be — and it keeps this file from becoming a second place
 * the headline edge is computed.
 */
function exactArtifactFinite8TdEdge() {
    const p = (0, path_1.join)(__dirname, '..', 'outputs', 'exact-rtp.json');
    const a = JSON.parse((0, fs_1.readFileSync)(p, 'utf8'));
    const e = a.finite8TD?.edgePerInitialBet;
    if (typeof e !== 'number' || !Number.isFinite(e)) {
        throw new Error(`outputs/exact-rtp.json has no finite8TD.edgePerInitialBet — cannot derive the card-removal lift`);
    }
    return e;
}
function computeReportFigures(ds = (0, loader_1.loadDataset)()) {
    const bets = ds.bets;
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
        for (const h of b.playerHands)
            mainWagered += units(h.betAmount) * factor;
        const pp = b.sideBets?.perfectPair;
        if (pp) {
            ppBets += 1;
            const w = units(pp.betAmount);
            const r = units(pp.winningAmount);
            ppWagered += w;
            ppReturned += r;
            sideWagered += w;
            if (r > 0n)
                ppWins += 1;
        }
        const t3 = b.sideBets?.twentyOnePlusThree;
        if (t3)
            sideWagered += units(t3.betAmount);
        const ins = b.sideBets?.insurance;
        if (ins) {
            insRounds += 1;
            const w = units(ins.betAmount);
            const r = units(ins.winningAmount);
            insWagered += w;
            insReturned += r;
            if (r > 0n)
                ins3x += 1;
            else
                ins0x += 1;
            if (w >= 100000000n)
                insHigh += 1;
            else
                insLow += 1;
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
                if (credit * 2n === stake * 5n)
                    naturalsWon += 1;
                else if (credit === stake)
                    naturalsPushed += 1;
                else
                    throw new Error(`natural settled at neither 2.5x nor 1x: credit ${credit} on stake ${stake}`);
            }
        }
    }
    const wageredEx = mainWagered + sideWagered;
    const wageredIncl = wageredEx + insWagered;
    const returnedEx = returned - insReturned;
    // The rounds the chapters walk through by hand. Quoted from the capture, not retyped: each
    // component is read off the record and the sum is asserted against the credited total, so a
    // worked example cannot drift from the dataset it claims to describe.
    const worked = [
        [2, 19, 'insurance-only credit: the insurance return is the whole credit'],
        [2, 25, 'split + double + both side bets: four components in one credit'],
    ].map(([epoch, nonce, what]) => {
        const b = bets.find((x) => x.epoch === epoch && x.nonce === nonce);
        if (!b)
            throw new Error(`worked example e${epoch}/n${nonce} is not in the dataset`);
        const components = [];
        const factor = b.doubled ? 2n : 1n;
        b.playerHands.forEach((h, i) => {
            const v = units(h.winningAmount) * factor;
            if (v > 0n)
                components.push({ label: `hand ${i + 1}${b.doubled ? ' (doubled)' : ''}`, amountUsdc: usdc(v) });
        });
        for (const [label, sb] of [
            ['perfectPair', b.sideBets?.perfectPair],
            ['twentyOnePlusThree', b.sideBets?.twentyOnePlusThree],
            ['insurance', b.sideBets?.insurance],
        ]) {
            if (!sb)
                continue;
            const v = units(sb.winningAmount);
            if (v > 0n)
                components.push({ label, amountUsdc: usdc(v) });
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
    const ppEdge = (0, sidebet_edges_1.perfectPairsEdgeExact)();
    const ppEdge12 = (0, sidebet_edges_1.perfectPairsEdgeExact)(12);
    const t3Edge = (0, sidebet_edges_1.twentyOnePlusThreeEdgeExact)();
    // The infinite-deck solves are composition-free and cost ~10 ms each, so they are re-solved
    // here. The 8-deck finite solve costs ~12 s and is ALREADY the artifact of record: it is read
    // from `outputs/exact-rtp.json`, which Step 25 hash-pins and `exactSolverTests.ts` re-derives
    // field by field against a live `buildExactArtifact()`. Re-solving it here would be a second
    // copy of a number that already has a stronger guard than a hash.
    const infTD = (0, exact_play_1.solveExact)({ kind: 'infinite' }, 'TD', exact_play_1.LIQD_RULES);
    const infCD = (0, exact_play_1.solveExact)({ kind: 'infinite' }, 'CD', exact_play_1.LIQD_RULES);
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
            pairEnumerationWeight: sidebet_edges_1.SHOE_PAIR_COMBINATIONS,
            tripleEnumerationWeight: sidebet_edges_1.SHOE_TRIPLE_COMBINATIONS,
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
exports.REPORT_FIGURES_HEADER = {
    audit: 'LIQD Blackjack',
    what: 'Figures cited in the report chapters, recomputed from the hash-pinned dataset and the exact engines. Not scored — see outputs/verification-results.json for the verdict.',
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
function buildReportFiguresArtifact(ds = (0, loader_1.loadDataset)()) {
    return {
        ...exports.REPORT_FIGURES_HEADER,
        datasetSha256: config_1.DATASET_SHA256,
        ...computeReportFigures(ds),
    };
}

  },
  "src/rng.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * LIQD Blackjack provably-fair RNG — canonical reference implementation.
 *
 * Node.js `crypto` only; no LIQD dependency. Reverse-engineered from the live
 * verify endpoint and validated against 6,000 captured hands (every card recomputed).
 *
 * Crypto core is identical to LIQD Mines (independently confirmed against the mines
 * verify endpoint): HMAC-SHA256, key = bytes(serverSeed hex), message
 * `${clientSeed}:${nonce}:${cursor}`, big-endian uint32 chunks with rejection sampling,
 * `chunk % range`.
 *
 * Game logic: BACKWARD in-place Fisher-Yates over an 8-deck (416-card) shoe.
 * Deal is PDPD: player = shoe[0], shoe[2]; dealer = shoe[1], shoe[3]; further cards
 * are dealt from shoe[4:] (all player draws, then all dealer draws).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHOE_SIZE = exports.DECKS = exports.SUITS = exports.salt = void 0;
exports.generateProvablyFairNumber = generateProvablyFairNumber;
exports.buildShoeTemplate = buildShoeTemplate;
exports.blackjackShoe = blackjackShoe;
exports.dealtHands = dealtHands;
exports.commitHash = commitHash;
const crypto_1 = require("crypto");
const salt = (clientSeed, nonce, cursor) => `${clientSeed}:${nonce}:${cursor}`;
exports.salt = salt;
/** Bias-free uniform integer in [0, range). Same primitive as Mines/Plinko. */
function generateProvablyFairNumber(serverSeed, clientSeed, nonce, cursor, range) {
    const key = Buffer.from(serverSeed, 'hex');
    const digest = (0, crypto_1.createHmac)('sha256', key).update((0, exports.salt)(clientSeed, nonce, cursor)).digest();
    const maxFair = Math.floor(4294967296 / range) * range;
    for (let offset = 0; offset + 4 <= digest.length; offset += 4) {
        const chunk = digest.readUInt32BE(offset);
        if (chunk < maxFair)
            return chunk % range;
    }
    return generateProvablyFairNumber(serverSeed, clientSeed, nonce, cursor + 1000000, range);
}
/** Suits and rank range; card string form is "SUIT:rank" (rank 1=A..13=K). */
exports.SUITS = ['CLUB', 'HEART', 'SPADE', 'DIAMOND'];
exports.DECKS = 8;
exports.SHOE_SIZE = exports.DECKS * 52; // 416
/** 52-card template repeated across 8 decks: suit-major [CLUB,HEART,SPADE,DIAMOND] × ranks 1..13. */
function buildShoeTemplate() {
    const shoe = [];
    for (let d = 0; d < exports.DECKS; d++)
        for (const s of exports.SUITS)
            for (let r = 1; r <= 13; r++)
                shoe.push(`${s}:${r}`);
    return shoe;
}
/**
 * Backward in-place Fisher-Yates: for i = SHOE_SIZE-1 .. 1,
 *   j = generateProvablyFairNumber(cursor=i, range=i+1) ∈ [0, i]; swap(shoe[i], shoe[j]).
 * Returns the full 416-card shuffled shoe.
 */
function blackjackShoe(serverSeed, clientSeed, nonce) {
    const a = buildShoeTemplate();
    for (let i = a.length - 1; i >= 1; i--) {
        const j = generateProvablyFairNumber(serverSeed, clientSeed, nonce, i, i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
/** Deal mapping (PDPD): player = shoe[0],shoe[2]; dealer = shoe[1],shoe[3]; rest from shoe[4:]. */
function dealtHands(shoe) {
    return { player: [shoe[0], shoe[2]], dealer: [shoe[1], shoe[3]], rest: shoe.slice(4) };
}
/** Commitment (Stake convention): SHA-256(utf8(serverSeed hex string)). */
function commitHash(serverSeedHexString) {
    return (0, crypto_1.createHash)('sha256').update(serverSeedHexString, 'utf8').digest('hex');
}

  },
  "src/sidebet-edges.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * Exact side-bet house edges, in integer arithmetic, from the SAME evaluator the verifier
 * scores live bets with (`src/sidebets.ts`, paytables from `src/config.ts`).
 *
 * WHY THIS FILE EXISTS. The enumeration lived only inside `tests/blackjack/sideBetEdgeTests.ts`,
 * so the published figures (Perfect Pairs 2.169%, 21+3 3.704%, and the 12:1 counterfactual
 * 4.096%) had a producer that no artifact could quote — the framework's prose check calls that an
 * orphan figure. The enumeration now lives here, has exactly one implementation, and is consumed
 * by two readers: the mocha anchor gate and `src/report-figures.ts`, which emits the numbers into
 * `outputs/report-figures.json` so every prose citation traces to a producing artifact (S-CONST).
 *
 * The enumeration is over the 52 distinct card TYPES with multiplicity 8, not over 416 physical
 * cards: both evaluators are symmetric in their arguments, so the hypergeometric weights below
 * give the exact unordered draw distribution.
 *
 *   2 cards:  C(52,2)·8·8            + 52·C(8,2)                       = 86,320     = C(416,2)
 *   3 cards:  C(52,3)·8·8·8 + 52·51·C(8,2)·8 + 52·C(8,3)               = 11,912,160 = C(416,3)
 *
 * Each result carries its own `total`, and callers assert it against C(416,k) so a bug in the
 * weights cannot pass silently.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHOE_TRIPLE_COMBINATIONS = exports.SHOE_PAIR_COMBINATIONS = exports.TYPES = void 0;
exports.binom = binom;
exports.reduce = reduce;
exports.perfectPairsEdgeExact = perfectPairsEdgeExact;
exports.twentyOnePlusThreeEdgeExact = twentyOnePlusThreeEdgeExact;
const sidebets_1 = require("./sidebets");
const config_1 = require("./config");
const SUITS = ['HEART', 'DIAMOND', 'CLUB', 'SPADE'];
/** The 52 distinct card types, in the encoding `src/sidebets.ts` parses. */
exports.TYPES = (() => {
    const t = [];
    for (const s of SUITS)
        for (let r = 1; r <= 13; r++)
            t.push(`${s}:${r}`);
    return t;
})();
/** Exact binomial C(n,k) in BigInt. */
function binom(n, k) {
    let num = 1n;
    let den = 1n;
    for (let i = 0n; i < k; i++) {
        num *= n - i;
        den *= i + 1n;
    }
    return num / den;
}
const COPIES = BigInt(config_1.DECKS); // 8 physical copies of each of the 52 types
const PAIR_SAME = binom(COPIES, 2n); // C(8,2) = 28
const TRIPLE_SAME = binom(COPIES, 3n); // C(8,3) = 56
/** gcd-reduced fraction, so an assertion can be on the exact rational rather than a float. */
function reduce(n, d) {
    const g = (a, b) => (b === 0n ? (a < 0n ? -a : a) : g(b, a % b));
    const k = g(n, d);
    return [n / k, d / k];
}
function finish(surplus, total) {
    const [n, d] = reduce(surplus, total);
    return {
        num: Number(n),
        den: Number(d),
        rational: `${n}/${d}`,
        edge: Number(n) / Number(d),
        rtp: 1 - Number(n) / Number(d),
        total: total.toString(),
    };
}
/**
 * Perfect Pairs over the player's first two cards.
 *
 * `coloredPairOverride` replaces the COLORED_PAIR payout without touching `src/config.ts` — used
 * for a hypothetical 12:1 sensitivity calculation, not an observed LIQD paytable. Omit it and
 * the paytable is read from config, unmodified.
 */
function perfectPairsEdgeExact(coloredPairOverride) {
    let returned = 0n; // Σ weight × units returned (stake + win; a loser returns 0)
    let total = 0n;
    const unitsBack = (a, b) => {
        const r = (0, sidebets_1.evaluatePerfectPairs)(a, b);
        const pay = coloredPairOverride !== undefined && r.category === 'COLORED_PAIR'
            ? coloredPairOverride
            : r.payout;
        return BigInt(pay > 0 ? pay + 1 : 0);
    };
    for (let i = 0; i < 52; i++) {
        total += PAIR_SAME;
        returned += PAIR_SAME * unitsBack(exports.TYPES[i], exports.TYPES[i]); // two copies of one type
        for (let j = i + 1; j < 52; j++) {
            const w = COPIES * COPIES;
            total += w;
            returned += w * unitsBack(exports.TYPES[i], exports.TYPES[j]);
        }
    }
    return finish(total - returned, total);
}
/** 21+3 over the player's first two cards plus the dealer upcard. */
function twentyOnePlusThreeEdgeExact() {
    let returned = 0n;
    let total = 0n;
    const add = (w, a, b, c) => {
        total += w;
        const pay = (0, sidebets_1.evaluate21Plus3)(a, b, c).payout;
        returned += w * BigInt(pay > 0 ? pay + 1 : 0);
    };
    for (let i = 0; i < 52; i++) {
        add(TRIPLE_SAME, exports.TYPES[i], exports.TYPES[i], exports.TYPES[i]); // three copies of one type
        for (let j = 0; j < 52; j++) {
            if (j === i)
                continue;
            add(PAIR_SAME * COPIES, exports.TYPES[i], exports.TYPES[i], exports.TYPES[j]); // a pair of i plus one j
        }
        for (let j = i + 1; j < 52; j++) {
            for (let k = j + 1; k < 52; k++)
                add(COPIES ** 3n, exports.TYPES[i], exports.TYPES[j], exports.TYPES[k]);
        }
    }
    return finish(total - returned, total);
}
/** C(416,2) and C(416,3) — the totals every enumeration above must reproduce. */
exports.SHOE_PAIR_COMBINATIONS = binom(BigInt(config_1.SHOE_SIZE), 2n).toString();
exports.SHOE_TRIPLE_COMBINATIONS = binom(BigInt(config_1.SHOE_SIZE), 3n).toString();

  },
  "src/sidebets.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * Independent evaluators for the two blackjack side bets, using LIQD's confirmed
 * paytables (src/config.ts). Used by verify.ts to re-derive every recorded side-bet
 * outcome from the cards alone, and by simulate.ts for side-bet RTP.
 *
 * Perfect Pairs — the player's first two cards.
 * 21+3 — the player's first two cards + the dealer upcard.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluatePerfectPairs = evaluatePerfectPairs;
exports.evaluate21Plus3 = evaluate21Plus3;
const config_1 = require("./config");
const isRed = (card) => (0, config_1.suitOf)(card) === 'HEART' || (0, config_1.suitOf)(card) === 'DIAMOND';
/** Perfect Pairs on two cards. */
function evaluatePerfectPairs(c1, c2) {
    // LIQD labels a losing Perfect Pairs bet `NO_PAIR`, but a losing 21+3 bet `NO_MATCH`.
    // The two side bets genuinely use different vocabulary; the category comparison in
    // Step 15 is against LIQD's own `gameResult`, so this string must match exactly.
    if ((0, config_1.rankOf)(c1) !== (0, config_1.rankOf)(c2))
        return { category: 'NO_PAIR', payout: 0 };
    if ((0, config_1.suitOf)(c1) === (0, config_1.suitOf)(c2))
        return { category: 'PERFECT_PAIR', payout: config_1.PERFECT_PAIRS.PERFECT_PAIR };
    if (isRed(c1) === isRed(c2))
        return { category: 'COLORED_PAIR', payout: config_1.PERFECT_PAIRS.COLORED_PAIR };
    return { category: 'MIXED_PAIR', payout: config_1.PERFECT_PAIRS.MIXED_PAIR };
}
function isThreeStraight(a, b, c) {
    const consec = (rs) => {
        const s = [...rs].sort((x, y) => x - y);
        return s[0] + 1 === s[1] && s[1] + 1 === s[2];
    };
    if (consec([a, b, c]))
        return true;
    // Ace-high: A(1) counts as 14 for Q-K-A
    return consec([a, b, c].map((r) => (r === 1 ? 14 : r)));
}
/** 21+3 on the player's two cards + the dealer upcard. */
function evaluate21Plus3(c1, c2, dealerUp) {
    const cards = [c1, c2, dealerUp];
    const ranks = cards.map(config_1.rankOf);
    const suits = cards.map(config_1.suitOf);
    const flush = suits[0] === suits[1] && suits[1] === suits[2];
    const trips = ranks[0] === ranks[1] && ranks[1] === ranks[2];
    const straight = isThreeStraight(ranks[0], ranks[1], ranks[2]);
    if (trips && flush)
        return { category: 'SUITED_THREE_OF_A_KIND', payout: config_1.TWENTY_ONE_PLUS_THREE.SUITED_THREE_OF_A_KIND };
    if (straight && flush)
        return { category: 'STRAIGHT_FLUSH', payout: config_1.TWENTY_ONE_PLUS_THREE.STRAIGHT_FLUSH };
    if (trips)
        return { category: 'THREE_OF_A_KIND', payout: config_1.TWENTY_ONE_PLUS_THREE.THREE_OF_A_KIND };
    if (straight)
        return { category: 'STRAIGHT', payout: config_1.TWENTY_ONE_PLUS_THREE.STRAIGHT };
    if (flush)
        return { category: 'FLUSH', payout: config_1.TWENTY_ONE_PLUS_THREE.FLUSH };
    return { category: 'NO_MATCH', payout: 0 };
}

  },
  "src/stats.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * Statistical helpers for the LIQD Blackjack simulation + verify steps.
 * Chi-squared p-values via exact regularized incomplete gamma.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.combination = combination;
exports.regularizedGamma = regularizedGamma;
exports.logGamma = logGamma;
exports.chiSquaredPValue = chiSquaredPValue;
exports.chiSquaredTest = chiSquaredTest;
exports.lag1Autocorrelation = lag1Autocorrelation;
exports.runsTest = runsTest;
exports.binomialSurvival = binomialSurvival;
exports.inverseCriticalZ = inverseCriticalZ;
function combination(n, k) {
    if (k < 0 || k > n)
        return 0;
    if (k === 0 || k === n)
        return 1;
    k = Math.min(k, n - k);
    let c = 1;
    for (let i = 0; i < k; i++) {
        c = (c * (n - i)) / (i + 1);
    }
    return c;
}
function regularizedGamma(a, x) {
    if (x < 0 || a <= 0)
        return NaN;
    if (x === 0)
        return 0;
    const gln = logGamma(a);
    if (x < a + 1) {
        let ap = a;
        let sum = 1 / a;
        let del = sum;
        for (let n = 0; n < 200; n++) {
            ap += 1;
            del *= x / ap;
            sum += del;
            if (Math.abs(del) < Math.abs(sum) * 1e-14)
                break;
        }
        return sum * Math.exp(-x + a * Math.log(x) - gln);
    }
    else {
        let b = x + 1 - a;
        let c = 1 / 1e-300;
        let d = 1 / b;
        let h = d;
        for (let i = 1; i <= 200; i++) {
            const an = -i * (i - a);
            b += 2;
            d = an * d + b;
            if (Math.abs(d) < 1e-300)
                d = 1e-300;
            c = b + an / c;
            if (Math.abs(c) < 1e-300)
                c = 1e-300;
            d = 1 / d;
            const delta = d * c;
            h *= delta;
            if (Math.abs(delta - 1) < 1e-14)
                break;
        }
        return 1 - Math.exp(-x + a * Math.log(x) - gln) * h;
    }
}
function logGamma(x) {
    const c = [
        76.18009172947146, -86.50532032941677, 24.01409824083091,
        -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
    ];
    let y = x;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++)
        ser += c[j] / ++y;
    return -tmp + Math.log((2.5066282746310005 * ser) / x);
}
function chiSquaredPValue(chiSq, df) {
    return 1 - regularizedGamma(df / 2, chiSq / 2);
}
function chiSquaredTest(observed, expected) {
    if (observed.length !== expected.length)
        throw new Error('length mismatch');
    const obs = [...observed];
    const exp = [...expected];
    while (obs.length > 2 && exp[0] < 5) {
        obs[1] += obs[0];
        exp[1] += exp[0];
        obs.shift();
        exp.shift();
    }
    while (obs.length > 2 && exp[exp.length - 1] < 5) {
        const n = obs.length;
        obs[n - 2] += obs[n - 1];
        exp[n - 2] += exp[n - 1];
        obs.pop();
        exp.pop();
    }
    let chi2 = 0;
    for (let i = 0; i < obs.length; i++) {
        if (exp[i] > 0)
            chi2 += (obs[i] - exp[i]) ** 2 / exp[i];
    }
    const df = obs.length - 1;
    return { chi2, df, pValue: chiSquaredPValue(chi2, df) };
}
function lag1Autocorrelation(series) {
    const n = series.length;
    let mean = 0;
    for (let i = 0; i < n; i++)
        mean += series[i];
    mean /= n;
    let num = 0, den = 0;
    for (let i = 0; i < n - 1; i++)
        num += (series[i] - mean) * (series[i + 1] - mean);
    for (let i = 0; i < n; i++)
        den += (series[i] - mean) ** 2;
    return den === 0 ? 0 : num / den;
}
function runsTest(series) {
    const n = series.length;
    let n1 = 0, runs = 1;
    let prev = series[0];
    if (prev === 1)
        n1++;
    for (let i = 1; i < n; i++) {
        if (series[i] === 1)
            n1++;
        if (series[i] !== prev) {
            runs++;
            prev = series[i];
        }
    }
    const n2 = n - n1;
    const expected = (2 * n1 * n2) / n + 1;
    const varRuns = (2 * n1 * n2 * (2 * n1 * n2 - n)) / (n * n * (n - 1));
    const z = varRuns > 0 ? (runs - expected) / Math.sqrt(varRuns) : 0;
    const pValue = 2 * (1 - normalCDF(Math.abs(z)));
    return { runs, expected, z, pValue };
}
/**
 * Upper-tail binomial survival: P(X >= k) for X ~ Binomial(n, p).
 *
 * Summed in log space via logGamma so it stays exact for the seed counts used in
 * Pass 2 (no normal approximation, no overflow). Exists so a scored step can
 * RECOMPUTE the cherry-pick survival probability instead of reading the scalar
 * the simulator wrote about itself.
 */
function binomialSurvival(k, n, p) {
    if (k <= 0)
        return 1;
    if (k > n)
        return 0;
    if (p <= 0)
        return 0;
    if (p >= 1)
        return 1;
    let total = 0;
    for (let i = k; i <= n; i++) {
        const logC = logGamma(n + 1) - logGamma(i + 1) - logGamma(n - i + 1);
        total += Math.exp(logC + i * Math.log(p) + (n - i) * Math.log(1 - p));
    }
    return Math.min(1, Math.max(0, total));
}
function inverseCriticalZ(alpha) {
    const p = alpha / 2;
    const t = Math.sqrt(-2 * Math.log(p));
    const c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
    const d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
    return t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
}
function normalCDF(z) {
    return 0.5 * (1 + erf(z / Math.SQRT2));
}
function erf(x) {
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
        - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return Math.sign(x) * y;
}

  },
  "src/strategy.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * LIQD Blackjack — total-dependent basic strategy table.
 *
 * Single source of truth, imported by BOTH `simulate.ts` (which plays it) and
 * `exact-play.ts` (which computes its exact EV in TD mode). They must never
 * drift apart: the whole point of the exact TD figure is that it is the EV of
 * *this* table, so a second copy would silently invalidate the comparison.
 *
 * Because sim and solver now share this module they can also share a bug in it.
 * That is what the composition-dependent (CD) figure is for — CD chooses actions
 * by argmax and ignores this table entirely, so a mistake here shows up as an
 * abnormally large CD − TD gap.
 *
 * Rules encoded: S17, DAS, no re-split, split aces one card, double on any two.
 * `up` is the dealer upcard value (11 = A, 10 = T/J/Q/K, 2..9).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.pairAction = pairAction;
exports.softAction = softAction;
exports.hardAction = hardAction;
exports.resolvedAction = resolvedAction;
/** Pair split decision. `null` = not a pair decision (5,5 is played as hard 10). */
function pairAction(rankVal, up) {
    switch (rankVal) {
        case 11: return 'P'; // A,A
        case 10: return 'H'; // 10,10 → never split (falls to hard 20 stand)
        case 9: return (up === 7 || up === 10 || up === 11) ? 'H' : 'P';
        case 8: return 'P';
        case 7: return (up >= 2 && up <= 7) ? 'P' : 'H';
        case 6: return (up >= 2 && up <= 6) ? 'P' : 'H'; // DAS
        case 5: return null; // treat as hard 10
        case 4: return (up === 5 || up === 6) ? 'P' : 'H'; // DAS
        case 3: return (up >= 2 && up <= 7) ? 'P' : 'H';
        case 2: return (up >= 2 && up <= 7) ? 'P' : 'H';
        default: return 'H';
    }
}
function softAction(t, up) {
    if (t >= 19)
        return 'S'; // A,8 A,9 — S17 stands
    if (t === 18) {
        if (up >= 3 && up <= 6)
            return 'Ds';
        if (up === 2 || up === 7 || up === 8)
            return 'S';
        return 'H';
    }
    if (t === 17)
        return (up >= 3 && up <= 6) ? 'D' : 'H'; // A,6
    if (t === 16 || t === 15)
        return (up >= 4 && up <= 6) ? 'D' : 'H'; // A,5 A,4
    if (t === 14 || t === 13)
        return (up >= 5 && up <= 6) ? 'D' : 'H'; // A,3 A,2
    return 'H';
}
function hardAction(t, up) {
    if (t >= 17)
        return 'S';
    if (t >= 13)
        return (up >= 2 && up <= 6) ? 'S' : 'H';
    if (t === 12)
        return (up >= 4 && up <= 6) ? 'S' : 'H';
    if (t === 11)
        return up === 11 ? 'H' : 'D'; // S17: double 2-10, hit vs A
    if (t === 10)
        return (up >= 2 && up <= 9) ? 'D' : 'H';
    if (t === 9)
        return (up >= 3 && up <= 6) ? 'D' : 'H';
    return 'H';
}
/**
 * The action for a non-pair hand, with the same fallbacks the simulation applies:
 * `D` on a hand of 3+ cards (or when doubling is not allowed) degrades to a hit,
 * and `Ds` degrades to a stand. The solver must mirror this exactly or the exact
 * TD figure would be the EV of a strategy nobody plays.
 */
function resolvedAction(total, soft, up, canDouble) {
    const a = soft ? softAction(total, up) : hardAction(total, up);
    if (a === 'D')
        return canDouble ? 'D' : 'H';
    if (a === 'Ds')
        return canDouble ? 'D' : 'S';
    return a;
}

  },
  "src/types.js": function (module, exports, require, __filename, __dirname) {
"use strict";
// Types mirror the exact capture schema in data/blackjack-6000hands.json
// (liqd-blackjack-capture-v1). Field names match the dataset verbatim.
Object.defineProperty(exports, "__esModule", { value: true });

  },
  "tests/steps/commitment.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * Steps 1–5: Commitment, pre-commitment chain, epoch consistency, nonce continuity, epoch size.
 *
 * POPULATION BINDING (G-BIND, 2026-09-09). Every expected count in this file comes from
 * `src/config.ts` — EXPECTED_SEEDS / EXPECTED_EPOCH_SIZE / EXPECTED_HANDS — and NOT from
 * `seeds.length`, `bets.length` or any `meta.*` field of the dataset under test. Before this,
 * `expectedReveals = seeds.length` was a tautology: delete an epoch and the expectation
 * shrinks with it, so Step 1 printed "119/119 epochs" and passed. The dataset's own header
 * fields are now scored AGAINST the constants (Step 5) instead of being trusted as the plan.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const context_1 = require("./context");
const rng_1 = require("../../src/rng");
const config_1 = require("../../src/config");
function run(ctx) {
    const { seeds, byHash, bets } = ctx;
    const revealed = seeds.filter((s) => s.serverSeed != null);
    // ── Step 1: Commitment reveal — SHA-256(utf8(serverSeed hex)) == hashedServerSeed ──
    let commitChecked = 0;
    let commitBad = 0;
    for (const s of revealed) {
        commitChecked++;
        if ((0, rng_1.commitHash)(s.serverSeed) !== s.hashedServerSeed)
            commitBad++;
    }
    // COVERAGE ASSERTION: the audit claims 100% of the capture plan's EXPECTED_SEEDS epochs
    // revealed. The expected N is the code constant, not `seeds.length` — that was the hole:
    // `seeds.length` shrinks with the file, so deleting an epoch made the expectation agree with
    // the forgery and the step printed "119/119 epochs … PASS". Two failures are now distinct:
    // a missing epoch RECORD (population) and an unrevealed seed (coverage).
    const expectedReveals = config_1.EXPECTED_SEEDS;
    const populationOk = seeds.length === config_1.EXPECTED_SEEDS;
    const s1 = (0, context_1.step)(1, 'Commitment Reveal', commitBad === 0 && commitChecked === expectedReveals && populationOk ? 'PASS' : 'FAIL', `${commitChecked}/${expectedReveals} epochs have a revealed server seed that hashes to its commitment (SHA-256 utf8); ${commitBad} mismatches` +
        (populationOk ? '' : `; POPULATION FAIL: the dataset carries ${seeds.length} seed record(s), the capture plan declares ${config_1.EXPECTED_SEEDS} (src/config.ts EXPECTED_SEEDS) — this is a different population, not a different result`) +
        (commitChecked !== expectedReveals && populationOk ? `; COVERAGE FAIL: ${expectedReveals - commitChecked} epoch(s) not revealed (expected 100%)` : ''));
    // ── Step 2: Pre-commitment chain — each epoch's nextHashedServerSeed == next epoch's hash ──
    const ordered = [...seeds].sort((a, b) => a.epoch - b.epoch);
    let links = 0;
    let linkBad = 0;
    for (let i = 0; i + 1 < ordered.length; i++) {
        if (ordered[i].nextHashedServerSeed == null)
            continue;
        links++;
        if (ordered[i].nextHashedServerSeed !== ordered[i + 1].hashedServerSeed)
            linkBad++;
    }
    // Expected link count is EXPECTED_SEEDS − 1 from src/config.ts, not `seeds.length - 1`:
    // a chain of 119 epochs is a complete chain over the wrong population.
    const expectedLinks = config_1.EXPECTED_SEEDS - 1; // every epoch but the last pre-commits the next
    const s2 = (0, context_1.step)(2, 'Pre-Commitment Chain', linkBad === 0 && links === expectedLinks ? 'PASS' : 'FAIL', `${links - linkBad}/${links} next-seed links verified (expected ${expectedLinks} = EXPECTED_SEEDS−1); ${linkBad} broken` +
        (links !== expectedLinks ? `; COVERAGE FAIL: ${expectedLinks - links} link(s) missing` : ''));
    // ── Step 3: Within-epoch hash consistency — every bet's epoch label maps to the seed
    // record whose commitment it carries. Grouping by the numeric `epoch` label (not by the
    // hash) and checking each group's bets all carry the ONE hash committed by seeds[epoch]
    // makes the step do real work: swapping the epoch labels of two bets — or relabelling a
    // bet into an epoch it did not belong to — now breaks the map and FAILs. (The earlier
    // form grouped by hash and asked whether a member's hash differed from its own group key,
    // which is a tautology; only the group count did anything.)
    const seedByEpoch = new Map(seeds.map((s) => [s.epoch, s]));
    const byEpoch = new Map();
    for (const b of bets) {
        const arr = byEpoch.get(b.epoch) ?? [];
        arr.push(b);
        byEpoch.set(b.epoch, arr);
    }
    let epochViolations = 0;
    for (const [epoch, epochBets] of byEpoch) {
        const sd = seedByEpoch.get(epoch);
        if (!sd || epochBets.some((b) => b.hashedServerSeed !== sd.hashedServerSeed))
            epochViolations++;
    }
    const s3 = (0, context_1.step)(3, 'Within-Epoch Hash Consistency', epochViolations === 0 && byEpoch.size === config_1.EXPECTED_SEEDS && seeds.length === config_1.EXPECTED_SEEDS ? 'PASS' : 'FAIL', `${byEpoch.size}/${config_1.EXPECTED_SEEDS} epochs carry bets; every bet's epoch label maps to the seed record whose commitment it carries; ${epochViolations} epoch(s) with a mismatch` +
        (byEpoch.size !== config_1.EXPECTED_SEEDS || seeds.length !== config_1.EXPECTED_SEEDS
            ? `; POPULATION FAIL: ${byEpoch.size} epoch(s) with bets and ${seeds.length} seed record(s) against the declared ${config_1.EXPECTED_SEEDS}` : ''));
    // ── Step 4: Nonce continuity + nonce-window closure ─────────────────────────
    // Two properties, because continuity alone cannot see a TRUNCATED epoch: drop the last
    // round of an epoch and the surviving nonces are still contiguous from nonceStart.
    //
    //   (a) continuity — nonces run contiguously from `nonceStart`.
    //   (b) closure    — the epoch's declared nonce WINDOW is exactly the window the plan
    //                    declares (`nonceEnd == nonceStart + EXPECTED_EPOCH_SIZE − 1`) and the
    //                    highest nonce actually present equals `nonceEnd`.
    //
    // `seeds[].nonceEnd` was, until 2026-09-09, a dead field: `grep -rn nonceEnd src tests`
    // matched `src/types.ts` and nothing else. It is the per-epoch record of how far the epoch
    // was served, written by the capture rig at rotation time and independent of the bet rows,
    // so it is exactly the witness a trailing-round deletion has to survive — and it did not
    // have to, because nothing read it.
    let nonceGaps = 0;
    let windowBad = 0;
    let tailBad = 0;
    const gapDetail = [];
    const winDetail = [];
    for (const s of seeds) {
        const epochBets = (byHash.get(s.hashedServerSeed) || []).slice().sort((a, b) => a.nonce - b.nonce);
        if (epochBets.length === 0)
            continue;
        const start = s.nonceStart ?? epochBets[0].nonce;
        for (let i = 0; i < epochBets.length; i++) {
            if (epochBets[i].nonce !== start + i) {
                nonceGaps++;
                if (gapDetail.length < 3)
                    gapDetail.push(`epoch ${s.epoch} at nonce ${epochBets[i].nonce}`);
                break;
            }
        }
        // (b) closure — declared window width, then the tail actually present.
        const expectedEnd = start + config_1.EXPECTED_EPOCH_SIZE - 1;
        if (s.nonceEnd !== expectedEnd) {
            windowBad++;
            if (winDetail.length < 3)
                winDetail.push(`epoch ${s.epoch}: nonceEnd ${String(s.nonceEnd)} != nonceStart ${start} + ${config_1.EXPECTED_EPOCH_SIZE - 1}`);
        }
        else if (epochBets[epochBets.length - 1].nonce !== s.nonceEnd) {
            tailBad++;
            if (winDetail.length < 3)
                winDetail.push(`epoch ${s.epoch}: highest nonce present ${epochBets[epochBets.length - 1].nonce} != declared nonceEnd ${s.nonceEnd}`);
        }
    }
    // A gap means rounds are missing from the nonce chain, i.e. the capture is not the
    // complete epoch it claims to be. That is a coverage FAILURE, not a soft warning.
    const s4 = (0, context_1.step)(4, 'Nonce Continuity', nonceGaps === 0 && windowBad === 0 && tailBad === 0 ? 'PASS' : 'FAIL', `contiguous from nonceStart within each epoch; ${nonceGaps} epoch(s) with a gap${gapDetail.length ? ` (${gapDetail.join('; ')})` : ''}` +
        `; nonce window closed against the seed record: ${seeds.length - windowBad - tailBad}/${seeds.length} epochs have nonceEnd == nonceStart+${config_1.EXPECTED_EPOCH_SIZE - 1} and a round present AT nonceEnd ` +
        `(${windowBad} wrong window, ${tailBad} truncated tail)` +
        (winDetail.length ? `; e.g. ${winDetail.join('; ')}` : ''));
    // ── Step 5: Epoch size + declared population ────────────────────────────────
    // FAIL, not FLAG. A short epoch used to FLAG, which resolves to "PROVABLY FAIR —
    // Conditional Pass" and exit 2 — a reviewer's trailing-round deletion produced exactly
    // that and it still reads as a pass. Rounds missing from the audited population is not a
    // disclosable irregularity in an otherwise-sound audit; it is a different audit.
    //
    // This step is also where the dataset's OWN header fields get scored. `meta.epochSize`,
    // `meta.plannedTotal`, `meta.progress.bets` and `meta.progress.seeds` sat in the file and
    // no step read any of them, so a forger could restate the plan to match a shrunken capture
    // for free. They now have to agree with src/config.ts.
    const sizes = [...byHash.values()].map((b) => b.length);
    const wrong = sizes.filter((n) => n !== config_1.EXPECTED_EPOCH_SIZE).length;
    const progress = (ctx.meta.progress ?? {});
    const headerRows = [];
    const headerCheck = (label, got, want) => {
        const ok = Number(got) === want;
        if (!ok)
            headerRows.push(`${label}=${String(got)} (declared ${want})`);
        return ok;
    };
    const headerOk = [
        headerCheck('meta.epochSize', ctx.meta.epochSize, config_1.EXPECTED_EPOCH_SIZE),
        headerCheck('meta.plannedTotal', ctx.meta.plannedTotal, config_1.EXPECTED_HANDS),
        headerCheck('meta.progress.bets', progress.bets, config_1.EXPECTED_HANDS),
        headerCheck('meta.progress.seeds', progress.seeds, config_1.EXPECTED_SEEDS),
    ].every(Boolean);
    const sizeOk = wrong === 0 && sizes.length === config_1.EXPECTED_SEEDS && bets.length === config_1.EXPECTED_HANDS;
    const s5 = (0, context_1.step)(5, 'Epoch Size', sizeOk && headerOk ? 'PASS' : 'FAIL', `${sizes.length}/${config_1.EXPECTED_SEEDS} epochs; min=${sizes.length ? Math.min(...sizes) : 0} max=${sizes.length ? Math.max(...sizes) : 0}; ${wrong} not exactly ${config_1.EXPECTED_EPOCH_SIZE}; ` +
        `${bets.length}/${config_1.EXPECTED_HANDS} rounds total. Expected counts come from src/config.ts (EXPECTED_SEEDS/EXPECTED_EPOCH_SIZE/EXPECTED_HANDS), not from the dataset header` +
        (sizeOk ? '' : '; POPULATION FAIL: the audited population is not the population the capture plan declares') +
        (headerOk
            ? `; the dataset's own header agrees (meta.epochSize, meta.plannedTotal, meta.progress.bets, meta.progress.seeds)`
            : `; HEADER FAIL: ${headerRows.join(', ')} — the dataset restates a plan the code does not declare`));
    return [s1, s2, s3, s4, s5];
}

  },
  "tests/steps/context.js": function (module, exports, require, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.step = step;
function step(num, name, status, detail) {
    const tag = status === 'PASS' ? '[PASS]' : status === 'FLAG' ? '[FLAG]' : '[FAIL]';
    console.log(`  ${tag} Step ${num} — ${name}`);
    if (status !== 'PASS')
        console.log(`         ${detail}`);
    return { step: num, name, status, detail };
}

  },
  "tests/steps/hands.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * Hand-shape helpers shared by the scored steps.
 *
 * `initialTwo` lived only in `tests/steps/standardization.ts`, so Steps 15 and 16 carried
 * their own fallback — `sb.playerHand || b.playerHands[0]?.cards` — for a side-bet record
 * with no card snapshot. On a SPLIT round that fallback is wrong: `playerHands[0].cards`
 * is the MAIN hand after the split and its second card is a post-split draw, not the card
 * the side bet was settled on. It differs from the true initial two on 392 of the 401 split
 * rounds. The fallback is inert on the committed capture (all 5,800 Perfect Pairs and all
 * 5,800 21+3 records carry `playerHand`, and Step 29 binds every one of the 11,600 snapshots
 * to the initial two cards), but "inert because another step happens to cover it" is not a
 * property a reader can see, and a re-capture that dropped the snapshot would silently score
 * the wrong cards. One split-aware definition, used everywhere.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialTwo = initialTwo;
/** The two cards the player was originally dealt, split-aware. */
function initialTwo(b) {
    return b.split
        ? [b.playerHands[0]?.cards[0], b.playerHands[1]?.cards[0]]
        : (b.playerHands[0]?.cards || []).slice(0, 2);
}

  },
  "tests/steps/houseedge.js": function (module, exports, require, __filename, __dirname) {
"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const context_1 = require("./context");
const config_1 = require("../../src/config");
const exact_play_1 = require("../../src/exact-play");
function run(ctx) {
    const out = [];
    // Actual edge: the EXACT 8-deck solve of the strategy the game is played with —
    // deterministic, reproducing to the last digit on every clone. It replaces both
    // the old infinite-deck default (which modelled a with-replacement game LIQD does
    // not deal) and the Monte-Carlo figure (which moved run to run, and which LIQD
    // would have quoted in marketing).
    const exact = (0, exact_play_1.solveExact)({ kind: 'finite', decks: 8 }, 'TD');
    const actualEdgeInitial = exact.edgePerInitialBet;
    const actualEdgeTotal = exact.edgePerTotalWagered;
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
    const playerNotWorse = actualEdgeInitial <= config_1.NOMINAL_HOUSE_EDGE + 1e-9;
    out.push((0, context_1.step)(20, 'House-edge reconciliation (nominal config vs actual)', playerNotWorse ? 'PASS' : 'FLAG', `config houseEdge = ${(config_1.NOMINAL_HOUSE_EDGE * 100).toFixed(2)}% (nominal internal label) vs exact basic-strategy edge ${(actualEdgeInitial * 100).toFixed(4)}% per initial bet${simNote} [${source}]. ` +
        (playerNotWorse
            ? 'Measured edge is well under the 1.00% config label under both conventions — the player is not worse off than that label; a disclosure, not a fairness defect (outcome integrity proven by Steps 1–16).'
            : 'Measured edge EXCEEDS the nominal config label — investigate.')));
    // Rule out the exchangeRate field as a hidden rake: report its ACTUAL distribution and keep the
    // display-only assertions (0 main-game hands carry it, 0 nonzero fiat amounts). Value-neutral —
    // no value is hardcoded; the field is read straight off the dataset.
    const fxDist = new Map();
    let fxRecords = 0, nonzeroFiat = 0, mainHandsWithFx = 0;
    for (const b of ctx.bets) {
        for (const h of b.playerHands)
            if ('exchangeRate' in h)
                mainHandsWithFx++;
        for (const key of ['perfectPair', 'twentyOnePlusThree', 'insurance']) {
            const sb = b.sideBets[key];
            if (sb && sb.exchangeRate != null) {
                fxRecords++;
                const r = String(sb.exchangeRate);
                fxDist.set(r, (fxDist.get(r) ?? 0) + 1);
                if (Number(sb.fiatBetAmount ?? 0) !== 0 || Number(sb.fiatWinningAmount ?? 0) !== 0)
                    nonzeroFiat++;
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
    out.push((0, context_1.step)(21, 'No FX haircut observed in this capture', fxIsDisplayOnly ? 'PASS' : 'FLAG', `exchangeRate distribution over ${fxRecords} side-bet records: ${distStr || '(none)'}; ${mainHandsWithFx} main-game hands carry it (expected 0); ${nonzeroFiat} nonzero fiat amounts (expected 0). ` +
        (fxCoverageOk
            ? 'No haircut is observable: the fiat* fields are zero throughout and every crypto payout reconciles at face value from the cards (Step 8), with no fx factor in the reconstruction — so the field is not acting as a house-edge mechanism over this capture. '
            : 'COVERAGE FLAG: 0 side-bet records carry an exchangeRate field, so this step has no subject and asserts nothing. Its two conditions ("expected 0") are satisfied vacuously by an empty set; it does NOT license the no-haircut statement. ') +
        'It is NOT proven that the field never touches the crypto betAmount/winningAmount: at rate 1.00, applied-at-1.00 and not-applied are indistinguishable in the data. Schema-inferred fiat display field; ruling out the mechanism itself would need a capture at a rate other than 1.00, or source access.'));
    return out;
}

  },
  "tests/steps/parity.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * Steps 6–7: Recomputation parity + client-seed dependence.
 *
 * Step 6 is the core proof: for every hand, rebuild the 416-card shoe from the
 * revealed server seed + client seed + nonce and confirm the exact cards LIQD dealt.
 *
 *  - Non-split hands: the full dealt sequence is deterministic —
 *      [player[0], dealer[0], player[1], dealer[1], ...player draws..., ...dealer draws...]
 *    (player plays fully, then the dealer). This must equal shoe[0..k] exactly.
 *  - Split hands: the two initial pair cards go to separate hands, and the post-split
 *    draw order is interleaved but deterministic —
 *      shoe[0..3] = main[0], dealer[0], split[0], dealer[1]
 *      shoe[4..5] = main[1], split[1]          (one auto card to each split hand)
 *      then the split hand plays out, then the main hand, then the dealer.
 *    This too must equal shoe[0..k] exactly. (An earlier revision verified splits only
 *    as a multiset of shoe[0..k]; that accepted any reordering of the post-split draws.
 *    See `splitDealtSequence` — the order is now pinned card-for-card.)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const context_1 = require("./context");
const rng_1 = require("../../src/rng");
const config_1 = require("../../src/config");
/**
 * Action-grammar check (round-2 QA item 21).
 *
 * The count-only cross-check below (#hit + #double == extra cards) is necessary but not
 * sufficient: the reviewers showed `["hit"]` rewritten to `["stand","hit"]` leaves the count
 * intact and passed. So the token stream is also checked as a GRAMMAR. Returns a list of
 * violations (empty = consistent).
 *
 * The stream is a flat log for the whole round; on a split it is the two hands' tokens
 * concatenated, and which hand a given `hit` belongs to is NOT recoverable from the log (a
 * hand that busts emits no terminal). So the grammar deliberately asserts only what holds
 * without that mapping:
 *
 *   G1  `no-ins` only as the very first token; `split` only at the head (after any `no-ins`),
 *       at most once, and present iff `bet.split`.
 *   G2  at most one terminal (`stand`/`double`) per hand, and NO token after the last hand's
 *       terminal — this is the check that rejects `["stand","hit"]`.
 *   G3  inside a hand's segment (greedy: a terminal closes a hand), every token before the
 *       terminal is a `hit`, and `double` is never preceded by a `hit` — LIQD allows doubling
 *       on the first two cards only (`doubleAnyTwo`), so a `hit` then `double` is impossible.
 *   G4  a hand may end WITHOUT a terminal only when it could not act again: it busted, it
 *       reached 21, it is a split-ace one-card hand (`splitAcesOneCard`), or the dealer turned
 *       a natural and the round ended at the peek before the player acted.
 *   G5  the MIRROR of G4 — a terminal that could not have been emitted. G4 catches a missing
 *       `stand`; nothing caught a `stand` that cannot exist, so a `stand` appended to a hand
 *       which had already auto-ended at 21 scored 31/31 Full Pass. Two tiers, each witnessed:
 *         G5a (all rounds) a `stand` can never belong to a BUSTED hand, so
 *             #stand ≤ #hands finishing ≤ 21. Measured 0 violations in 6,000/6,000.
 *         G5b (single-hand rounds only) a hand that reaches exactly 21 auto-ends and emits no
 *             terminal, so #stand ≤ #hands finishing ≤ 20. Measured 0 violations in
 *             5,599/5,599 single-hand rounds: `stand` appears only at totals ≤ 20 (2,869
 *             rounds), never at 21 (467 rounds, all terminal-free) and never on a bust (872
 *             rounds, all terminal-free); the 123 rounds finishing on 21 and the 244 busting
 *             after a `double` carry `double`, not `stand`.
 *       G5b is deliberately NOT applied to split rounds. It is FALSE there: 14 of the 401
 *       split rounds carry a `stand` on a hand that finished at exactly 21 (e.g. epoch 67
 *       nonce 47, `["split","stand","stand"]`, totals 20 and 21), so LIQD's split UI logs a
 *       stand at 21 where the single-hand path does not. Asserting the tidy universal rule
 *       would have manufactured 14 false violations against real captured play.
 *   G6  `bet.doubled` is BOUND to the token stream: (#double > 0) === bet.doubled. `doubled`
 *       is an operator summary boolean and was checked against nothing, so relabelling a lost
 *       doubled round's `["double"]` to `["hit","stand"]` — leaving `doubled: true` — passed
 *       31/31 (Step 8b's m-factor is unidentifiable at base credit 0), and relabelling a
 *       busted round's `["hit"]` to `["double"]` also passed 31/31 while silently moving the
 *       money-path total from 4152.60 to 4152.70. Measured 0 violations in 6,000/6,000.
 *
 * All six hold on the captured rounds at the counts stated above (measured: 0 violations of each).
 */
function actionGrammarViolations(b) {
    const v = [];
    const acts = b.actions || [];
    const hands = b.playerHands || [];
    const H = hands.length;
    // ── G1: prefix ────────────────────────────────────────────────────────────
    let i = 0;
    if (acts[i] === 'no-ins')
        i++;
    const hasSplitToken = acts[i] === 'split';
    if (hasSplitToken)
        i++;
    if (hasSplitToken !== Boolean(b.split)) {
        v.push(`split token ${hasSplitToken ? 'present' : 'absent'} but bet.split=${Boolean(b.split)}`);
    }
    const rest = acts.slice(i);
    if (rest.includes('no-ins'))
        v.push('`no-ins` appears after the first token');
    if (rest.includes('split'))
        v.push('`split` appears outside the head of the stream');
    const isTerminal = (a) => a === 'stand' || a === 'double';
    // ── G2: no token after the last hand's terminal ───────────────────────────
    let terminalsSeen = 0;
    for (let k = 0; k < rest.length; k++) {
        if (terminalsSeen >= H) {
            v.push(`token \`${rest[k]}\` follows terminal #${H} — the round was already over`);
            break;
        }
        if (isTerminal(rest[k]))
            terminalsSeen++;
    }
    const terminals = rest.filter(isTerminal).length;
    if (terminals > H)
        v.push(`${terminals} terminal token(s) for ${H} hand(s)`);
    // ── G3: segment shape ─────────────────────────────────────────────────────
    const segs = [];
    let cur = [];
    for (const a of rest) {
        cur.push(a);
        if (isTerminal(a)) {
            segs.push(cur);
            cur = [];
        }
    }
    if (cur.length)
        segs.push(cur);
    for (const s of segs) {
        const last = s[s.length - 1];
        const body = isTerminal(last) ? s.slice(0, -1) : s;
        if (!body.every((a) => a === 'hit'))
            v.push(`segment ${JSON.stringify(s)} contains a non-\`hit\` before its terminal`);
        if (last === 'double' && body.length > 0)
            v.push(`\`double\` after ${body.length} \`hit\`(s) — doubling is first-two-cards only`);
    }
    // ── G4: a hand may go unterminated only if it could not act again ─────────
    const unterminated = H - terminals;
    if (unterminated > 0 && !(0, config_1.isBlackjack)(b.dealerHand || [])) {
        const couldNotAct = hands.filter((h) => {
            const cards = h.cards || [];
            const splitAceOneCard = Boolean(b.split) && cards.length === 2 && (0, config_1.rankOf)(cards[0]) === 1;
            return (0, config_1.handValue)(cards).total >= 21 || splitAceOneCard;
        }).length;
        if (unterminated > couldNotAct) {
            v.push(`${unterminated} hand(s) end with no \`stand\`/\`double\` but only ${couldNotAct} busted / reached 21 / were split aces (dealer had no natural)`);
        }
    }
    // ── G5: a terminal that could not have been emitted ───────────────────────
    // Each `stand` must be attributable to SOME hand that was legally able to stand, and a
    // hand carries at most one terminal (G2). So the count of `stand` tokens is bounded by the
    // count of hands that could have stood. Order-free, which is what makes it work on a flat
    // log where a token cannot be mapped to a hand.
    const standTokens = rest.filter((a) => a === 'stand').length;
    const notBusted = hands.filter((h) => (0, config_1.handValue)(h.cards || []).total <= 21).length;
    if (standTokens > notBusted) {
        v.push(`${standTokens} \`stand\` token(s) but only ${notBusted} hand(s) finished at 21 or under — a busted hand cannot stand`);
    }
    // G5b — single-hand rounds only. See the header: a split hand at exactly 21 DOES log a
    // stand in this capture (14 rounds), so the ≤20 bound is scoped to H === 1, where it is
    // witnessed on all 5,599 rounds.
    if (H === 1) {
        const canStand = hands.filter((h) => (0, config_1.handValue)(h.cards || []).total <= 20).length;
        if (standTokens > canStand) {
            v.push(`single-hand round: \`stand\` on a hand that finished at ${(0, config_1.handValue)(hands[0]?.cards || []).total} — a single hand reaching 21 auto-ends and emits no terminal`);
        }
    }
    // ── G6: `doubled` bound to the tokens that would have produced it ─────────
    const doubleTokens = rest.filter((a) => a === 'double').length;
    if ((doubleTokens > 0) !== Boolean(b.doubled)) {
        v.push(`bet.doubled=${Boolean(b.doubled)} but the action stream carries ${doubleTokens} \`double\` token(s) — the operator's summary flag disagrees with the log it summarises`);
    }
    return v;
}
function dealtSequence(playerHand, dealerHand) {
    const seq = [];
    if (playerHand?.[0])
        seq.push(playerHand[0]);
    if (dealerHand?.[0])
        seq.push(dealerHand[0]);
    if (playerHand?.[1])
        seq.push(playerHand[1]);
    if (dealerHand?.[1])
        seq.push(dealerHand[1]);
    for (let i = 2; i < (playerHand?.length || 0); i++)
        seq.push(playerHand[i]);
    for (let i = 2; i < (dealerHand?.length || 0); i++)
        seq.push(dealerHand[i]);
    return seq;
}
/**
 * Exact draw order for a split round. Derived empirically from the capture and
 * confirmed against every split hand in the dataset:
 *
 *   shoe[0..3]  main[0], dealer[0], split[0], dealer[1]   (the pinned initial deal)
 *   shoe[4..5]  main[1], split[1]                         (one auto card to each hand)
 *   then        the SPLIT hand plays out fully (split[2..]),
 *   then        the MAIN hand plays out fully (main[2..]),
 *   then        the dealer draws (dealer[2..]).
 *
 * This makes a split verifiable in strict order rather than only as a multiset —
 * a reordering of post-split draws no longer passes.
 */
function splitDealtSequence(main, split, dealer) {
    return [main[0], dealer[0], split[0], dealer[1], main[1], split[1],
        ...split.slice(2), ...main.slice(2), ...dealer.slice(2)].filter((c) => c !== undefined);
}
function run(ctx) {
    const { bets, seedMap } = ctx;
    // ── Step 6: Recomputation parity ────────────────────────────────────────────
    let checked = 0;
    let bad = 0;
    let skipped = 0;
    let nonSplit = 0;
    let splits = 0;
    let splitOrderBad = 0;
    let actionInconsistent = 0;
    let grammarBad = 0;
    const actionFailures = [];
    const grammarFailures = [];
    const failures = [];
    for (const b of bets) {
        // ── Action/card cross-check ─────────────────────────────────────────────────
        // The recorded `actions` tokens must account for every card the player drew:
        // each `hit` and each `double` draws exactly one card, and nothing else adds a
        // player card, so (# hit + # double) must equal the number of cards drawn beyond
        // the two-card start of each hand. Without this, an action token could be relabelled
        // (e.g. a `hit` rewritten to `stand`) while the third card is left in place and the
        // card-recomputation below would still pass. (`stand`/`no-ins`/`split` draw no card to
        // the player; the split hand's one auto card per hand is covered by the 2-per-hand base.)
        const acts = b.actions || [];
        const drawTokens = acts.filter((a) => a === 'hit' || a === 'double').length;
        const nHands = b.playerHands?.length || 0;
        const playerCards = (b.playerHands || []).reduce((s, h) => s + (h.cards?.length || 0), 0);
        const extraCards = playerCards - 2 * nHands;
        if (drawTokens !== extraCards) {
            actionInconsistent++;
            if (actionFailures.length < 5)
                actionFailures.push(`nonce ${b.nonce} (epoch ${b.epoch}): ${drawTokens} hit/double vs ${extraCards} extra card(s)`);
        }
        // ── Action GRAMMAR (round-2 QA item 21) ─────────────────────────────────────
        // The count above is order-blind: `["hit"]` rewritten to `["stand","hit"]` keeps the count
        // and passed. The grammar rejects a token after the round's last terminal, a `double` that
        // follows a `hit`, a misplaced `no-ins`/`split`, and a hand that stops without standing when
        // it could still have acted. See actionGrammarViolations() above.
        const gv = actionGrammarViolations(b);
        if (gv.length) {
            grammarBad++;
            if (grammarFailures.length < 5)
                grammarFailures.push(`nonce ${b.nonce} (epoch ${b.epoch}): ${gv[0]}`);
        }
        const serverSeed = seedMap.get(b.hashedServerSeed);
        if (!serverSeed || !b.clientSeed) {
            skipped++;
            continue;
        }
        const shoe = (0, rng_1.blackjackShoe)(serverSeed, b.clientSeed, b.nonce);
        let ok;
        if (b.split) {
            splits++;
            const main = b.playerHands[0]?.cards || [];
            const spl = b.playerHands[1]?.cards || [];
            const d = b.dealerHand || [];
            const seq = splitDealtSequence(main, spl, d);
            ok = seq.length === main.length + spl.length + d.length && seq.every((c, i) => c === shoe[i]);
            if (!ok)
                splitOrderBad++;
        }
        else {
            nonSplit++;
            const seq = dealtSequence(b.playerHands[0]?.cards || [], b.dealerHand || []);
            // The comparison is prefix-wise, so an EMPTY sequence would pass vacuously.
            // A real round always has at least the initial PDPD deal. (Truncation at the
            // TAIL of a hand is not detectable here — the shoe cannot say how many cards
            // the round should have consumed — and is caught instead by the dealer
            // draw-rule replay in Step 11.)
            ok = seq.length >= 4 && seq.every((c, i) => c === shoe[i]);
        }
        checked++;
        if (!ok) {
            bad++;
            if (failures.length < 5)
                failures.push(`nonce ${b.nonce} (epoch ${b.epoch})`);
        }
    }
    // COVERAGE ASSERTION: `checked` must equal EXPECTED_HANDS — every hand of the DECLARED
    // population recomputed. It used to compare against `bets.length`, which is the file's own
    // row count: delete 50 rounds and the target moves with them, so the step printed
    // "5950/5950 hands … PASS". The expected N is the capture plan in src/config.ts.
    // An unrevealed (or nulled) server seed makes `seedMap.get` miss and the hand is skipped;
    // that is a hard FAIL, not a FLAG, because a partially-recomputed dataset cannot carry a
    // Full Pass. Previously a skip only FLAGged (→ "Conditional Pass"), which still reads as a
    // pass to a coverage-mutation gate.
    const s6 = (0, context_1.step)(6, 'Recomputation Parity', bad === 0 && skipped === 0 && checked === config_1.EXPECTED_HANDS && bets.length === config_1.EXPECTED_HANDS && actionInconsistent === 0 && grammarBad === 0 ? 'PASS' : 'FAIL', `${checked}/${config_1.EXPECTED_HANDS} hands recomputed from revealed seeds in exact draw order (${nonSplit} single-hand, ${splits} split) — ${bad} mismatch${bad === 1 ? '' : 'es'}` +
        (bets.length === config_1.EXPECTED_HANDS ? '' : `; POPULATION FAIL: the dataset carries ${bets.length} rounds, the capture plan declares ${config_1.EXPECTED_HANDS}`) +
        `; action/card cross-check: ${bets.length - actionInconsistent}/${bets.length} hands have hit+double tokens matching drawn cards, ${actionInconsistent} inconsistent` +
        `; action grammar (no token after a hand's last terminal, no \`double\` after a \`hit\`, \`no-ins\`/\`split\` only at the head, a hand ends without standing only on bust/21/split-ace/dealer natural, no \`stand\` on a busted hand — nor on a single hand that reached 21 — and \`bet.doubled\` agrees with the \`double\` tokens): ${bets.length - grammarBad}/${bets.length} rounds consistent, ${grammarBad} inconsistent` +
        (splitOrderBad ? `; ${splitOrderBad} split(s) failed strict order` : '') +
        (skipped ? `; COVERAGE FAIL: ${skipped} hand(s) skipped (unrevealed/nulled seed) — cannot Full Pass with < 100% recomputed` : '') +
        (actionFailures.length ? `; e.g. ${actionFailures.join('; ')}` : '') +
        (grammarFailures.length ? `; grammar e.g. ${grammarFailures.join('; ')}` : '') +
        (failures.length ? `; e.g. ${failures.join(', ')}` : ''));
    // ── Step 7: Client-seed dependence ──────────────────────────────────────────
    // Re-run sampled hands under a deliberately wrong client seed: the initial deal
    // should change (the client seed genuinely feeds the derivation).
    let sampled = 0;
    let changed = 0;
    const bettable = bets.filter((b) => seedMap.get(b.hashedServerSeed) && b.clientSeed);
    const stride = Math.max(1, Math.floor(bettable.length / 1000));
    for (let i = 0; i < bettable.length; i += stride) {
        const b = bettable[i];
        const serverSeed = seedMap.get(b.hashedServerSeed);
        const wrong = (0, rng_1.blackjackShoe)(serverSeed, b.clientSeed + '_x', b.nonce);
        const realFirst = (b.playerHands[0]?.cards || [])[0];
        sampled++;
        if (wrong[0] !== realFirst)
            changed++;
    }
    // COVERAGE: an empty sample (e.g. no revealed seeds) must not pass vacuously.
    const s7 = (0, context_1.step)(7, 'Client-Seed Dependence', sampled > 0 && changed >= sampled * 0.95 ? 'PASS' : 'FLAG', `${changed}/${sampled} sampled hands deal a different first card under a wrong client seed (collisions expected ~1/52)` +
        (sampled === 0 ? '; COVERAGE FAIL: 0 hands sampled (no revealed seeds)' : ''));
    return [s6, s7];
}

  },
  "tests/steps/payouts.js": function (module, exports, require, __filename, __dirname) {
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const context_1 = require("./context");
const config_1 = require("../../src/config");
const money_1 = require("../../src/money");
const dealerHasBJ = (dealer) => dealer.length === 2 && (0, config_1.handValue)(dealer).total === 21;
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
function sideBetReturnUnits(b) {
    return ['perfectPair', 'twentyOnePlusThree', 'insurance']
        .reduce((s, k) => s + (b.sideBets[k] ? (0, money_1.unitsOr0)(b.sideBets[k].winningAmount) : 0), 0);
}
/**
 * Expected per-hand return (incl. stake) in integer settlement units, derived from cards + rules.
 * Returns null when the rule-derived amount is NOT representable on the grid — only reachable for
 * the 3:2 natural on an odd unit stake, which would itself be a finding, so it is surfaced rather
 * than rounded away.
 */
function expectedReturnUnits(cards, dealer, stakeUnits, isSplitHand) {
    const pt = (0, config_1.handValue)(cards).total;
    if (pt > 21)
        return 0; // player bust
    const dt = (0, config_1.handValue)(dealer).total;
    const pBJ = !isSplitHand && (0, config_1.isBlackjack)(cards);
    const dBJ = dealerHasBJ(dealer);
    if (pBJ && dBJ)
        return stakeUnits; // push
    if (pBJ)
        return 5 * stakeUnits % 2 === 0 ? (5 * stakeUnits) / 2 : null; // 3:2
    if (dBJ)
        return 0; // dealer natural blackjack beats a non-natural player
    if (dt > 21)
        return 2 * stakeUnits; // dealer bust
    if (pt > dt)
        return 2 * stakeUnits;
    if (pt === dt)
        return stakeUnits; // push
    return 0;
}
function run(ctx) {
    const { bets } = ctx;
    // ── Step 8: Per-hand main/split payout (reconstructed from cards) ────────────
    let checked = 0;
    let bad = 0;
    const fails = [];
    for (const b of bets) {
        for (let hi = 0; hi < b.playerHands.length; hi++) {
            const h = b.playerHands[hi];
            const stakeUnits = (0, money_1.unitsOf)(h.betAmount);
            const winUnits = (0, money_1.unitsOf)(h.winningAmount);
            checked++;
            if (stakeUnits === null || winUnits === null) {
                bad++;
                if (fails.length < 5)
                    fails.push(`nonce ${b.nonce} (epoch ${b.epoch}) hand ${hi}: stake ${String(h.betAmount)} / credit ${String(h.winningAmount)} is not an exact multiple of 1e-8`);
                continue;
            }
            const expectedUnits = expectedReturnUnits(h.cards, b.dealerHand, stakeUnits, b.split);
            if (expectedUnits === null) {
                bad++;
                if (fails.length < 5)
                    fails.push(`nonce ${b.nonce} (epoch ${b.epoch}) hand ${hi}: a 3:2 natural on an odd ${stakeUnits}-unit stake has no exact settlement amount`);
                continue;
            }
            if (winUnits !== expectedUnits) {
                bad++;
                if (fails.length < 5)
                    fails.push(`nonce ${b.nonce} (epoch ${b.epoch}) hand ${hi}: credit ${(0, money_1.asMoney)(winUnits)} != rule-derived ${(0, money_1.asMoney)(expectedUnits)} (${winUnits - expectedUnits > 0 ? '+' : ''}${winUnits - expectedUnits} settlement unit(s) of 1e-8)`);
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
    const recFails = [];
    for (const b of bets) {
        const nHands = b.playerHands.length;
        const nDoubles = b.actions.filter((a) => a === 'double').length;
        // All four quantities are exact integers of 1e-8, so the identity is checked as integer
        // equality — no epsilon on either side of it (QA-01).
        const base = b.playerHands.reduce((s, h) => s + (0, money_1.unitsOr0)(h.winningAmount), 0);
        const side = sideBetReturnUnits(b);
        const top = (0, money_1.unitsOf)(b.winningAmount);
        const m = nDoubles === 0 ? 1 : nDoubles === nHands ? 2 : null;
        if (top === null) {
            recBad++;
            if (recFails.length < 5)
                recFails.push(`nonce ${b.nonce} (epoch ${b.epoch}): credited ${String(b.winningAmount)} is not an exact multiple of 1e-8`);
            continue;
        }
        if (m === null) {
            // Partial double across a split: credit must lie between the undoubled and
            // fully-doubled totals. Integer bounds — inclusive, and not widened by any epsilon.
            recBounded++;
            if (top < base + side || top > 2 * base + side) {
                recBoundBad++;
                if (recFails.length < 5)
                    recFails.push(`nonce ${b.nonce} (epoch ${b.epoch}): ${(0, money_1.asMoney)(top)} outside [${(0, money_1.asMoney)(base + side)}, ${(0, money_1.asMoney)(2 * base + side)}]`);
            }
            continue;
        }
        if (top === base * m + side)
            recOk++;
        else {
            recBad++;
            if (recFails.length < 5)
                recFails.push(`nonce ${b.nonce} (epoch ${b.epoch}): credited ${(0, money_1.asMoney)(top)} != ${(0, money_1.asMoney)(base * m + side)} (base ${(0, money_1.asMoney)(base)} ×${m} + side ${(0, money_1.asMoney)(side)}) — off by ${top - (base * m + side)} settlement unit(s) of 1e-8`);
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
    const gridFails = [];
    const onGrid = (v, where) => {
        if (v === null || v === undefined)
            return;
        moneyChecked++;
        if ((0, money_1.unitsOf)(v) === null) {
            offGrid++;
            if (gridFails.length < 5)
                gridFails.push(`${where} = ${String(v)} is not a multiple of 1e-8`);
        }
    };
    for (const b of bets) {
        onGrid(b.winningAmount, `nonce ${b.nonce} (epoch ${b.epoch}) winningAmount`);
        for (let i = 0; i < b.playerHands.length; i++) {
            onGrid(b.playerHands[i].betAmount, `nonce ${b.nonce} hand ${i} betAmount`);
            onGrid(b.playerHands[i].winningAmount, `nonce ${b.nonce} hand ${i} winningAmount`);
        }
        for (const k of ['perfectPair', 'twentyOnePlusThree', 'insurance']) {
            const sb = b.sideBets[k];
            if (!sb)
                continue;
            onGrid(sb.betAmount, `nonce ${b.nonce} ${k} betAmount`);
            onGrid(sb.winningAmount, `nonce ${b.nonce} ${k} winningAmount`);
        }
    }
    // COVERAGE: `checked` must equal the total number of settled hands (Σ playerHands over all
    // bets), not merely `bad === 0` — a step that reconstructs zero hands asserts nothing.
    const expectedHands = bets.reduce((s, b) => s + b.playerHands.length, 0);
    const s8 = (0, context_1.step)(8, 'Per-Hand Payout (reconstructed from cards)', bad === 0 && recTotalBad === 0 && checked === expectedHands && offGrid === 0 && moneyChecked > 0 ? 'PASS' : 'FAIL', `${checked}/${expectedHands} hands: win→2×, push→1×, loss→0 derived from cards+rules (${bad} mismatch${bad === 1 ? '' : 'es'})${fails.length ? '; ' + fails.slice(0, 3).join('; ') : ''}` +
        ` | money path: ${recOk}/${recOk + recBad} bets reconcile exactly as (Σ hand win)×m + Σ side win` +
        (recBounded ? `, ${recBounded} partial-double split(s) bounded (${recBoundBad} outside bounds)` : '') +
        ` | money grid: ${moneyChecked - offGrid}/${moneyChecked} recorded amounts are exact multiples of 1e-8 (capture accounting precision), ${offGrid} off-grid. Both comparisons above are EXACT INTEGER equality in those 1e-8 units, not a float tolerance: a one-unit discrepancy fails` +
        (moneyChecked === 0 ? '; COVERAGE FAIL: 0 money amounts checked' : '') +
        (gridFails.length ? `; e.g. ${gridFails.join('; ')}` : '') +
        (recTotalBad ? `; ${recFails.slice(0, 3).join('; ')}` : ''));
    // ── Step 9: Blackjack pays exactly 3:2 (isolated) ───────────────────────────
    // Player naturals that beat the dealer (dealer not also natural) must return 2.5×.
    const bjWins = bets.filter((b) => !b.split && (0, config_1.isBlackjack)(b.playerHands[0].cards) && !dealerHasBJ(b.dealerHand));
    let bjBad = 0;
    const bjFails = [];
    for (const b of bjWins) {
        // Exact settlement units (QA-01): 2 × credit must equal 5 × stake, which is integer
        // arithmetic on both sides and therefore admits no tolerance at all.
        const stakeUnits = (0, money_1.unitsOf)(b.playerHands[0].betAmount);
        const winUnits = (0, money_1.unitsOf)(b.playerHands[0].winningAmount);
        if (stakeUnits === null || winUnits === null || 2 * winUnits !== 5 * stakeUnits) {
            bjBad++;
            if (bjFails.length < 3)
                bjFails.push(`nonce ${b.nonce} (epoch ${b.epoch}): credit ${String(b.playerHands[0].winningAmount)} on a ${String(b.playerHands[0].betAmount)} stake is not 3:2`);
        }
    }
    // COVERAGE: there must actually BE winning naturals to verify (dataset carries 243).
    const s9 = (0, context_1.step)(9, 'Blackjack Pays 3:2', bjBad === 0 && bjWins.length > 0 ? 'PASS' : 'FAIL', `${bjWins.length} winning natural blackjacks, all return exactly 2.5× stake — compared as 2×credit == 5×stake in integer 1e-8 settlement units, no tolerance (${bjBad} mismatches)` +
        (bjWins.length === 0 ? '; COVERAGE FAIL: 0 winning naturals to verify' : '') +
        (bjFails.length ? `; ${bjFails.join('; ')}` : ''));
    // ── Step 10: Insurance pays 2:1 iff dealer blackjack ────────────────────────
    const insBets = bets.filter((b) => b.sideBets.insurance != null);
    let insWonWrong = 0;
    let insLostWrong = 0;
    let insPayBad = 0;
    const insFails = [];
    for (const b of insBets) {
        const ins = b.sideBets.insurance;
        // Exact settlement units (QA-01): a winning insurance returns 3 × stake exactly, a losing
        // one returns exactly zero. Both are integer identities.
        const stakeUnits = (0, money_1.unitsOf)(ins.betAmount);
        const winUnits = (0, money_1.unitsOf)(ins.winningAmount);
        const bj = dealerHasBJ(b.dealerHand);
        const expectUnits = ins.result === 'won' ? (stakeUnits === null ? null : 3 * stakeUnits) : 0;
        if (ins.result === 'won') {
            if (!bj)
                insWonWrong++;
        }
        else if (bj)
            insLostWrong++;
        if (winUnits === null || expectUnits === null || winUnits !== expectUnits) {
            insPayBad++;
            if (insFails.length < 3)
                insFails.push(`nonce ${b.nonce} (epoch ${b.epoch}): ${String(ins.result)} insurance credited ${String(ins.winningAmount)} on a ${String(ins.betAmount)} stake`);
        }
    }
    // COVERAGE: there must actually BE insurance bets to verify (dataset carries 446).
    const insOk = insBets.length > 0 && insWonWrong === 0 && insLostWrong === 0 && insPayBad === 0;
    const s10 = (0, context_1.step)(10, 'Insurance Pays 2:1 iff Dealer Blackjack', insOk ? 'PASS' : 'FAIL', `${insBets.length} insurance bets: wins occur on exactly the dealer-blackjack hands and return exactly 3× stake, losses exactly 0 — integer 1e-8 settlement units, no tolerance ` +
        `(${insWonWrong} false wins, ${insLostWrong} missed wins, ${insPayBad} wrong payouts)` +
        (insFails.length ? `; ${insFails.join('; ')}` : ''));
    return [s8, s9, s10];
}

  },
  "tests/steps/rules.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * Steps 11–14: House rules, read directly off the dataset (not assumed).
 *   11  Dealer stands on soft 17 (S17)
 *   12  Double-after-split allowed (DAS)
 *   13  Dealer peeks for blackjack on Ace/10 upcards
 *   14  No surrender
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const context_1 = require("./context");
const config_1 = require("../../src/config");
function run(ctx) {
    const { bets } = ctx;
    // ── Step 11: Dealer draw-rule compliance, replayed decision by decision ──────
    // Not merely "did any hand end on soft 17" — the dealer's every draw/stand is
    // replayed against S17 and both failure directions are tested:
    //
    //   over-draw : the dealer took a card while already holding 17 or more.
    //   under-draw: the dealer stopped below 17 while a live player hand remained.
    //
    // One legitimate exemption to the under-draw rule: a player natural blackjack
    // settles the round at 3:2 immediately, so the dealer never completes its hand.
    // That exemption is counted and reported, never silently applied.
    let dealerSoft17Final = 0;
    let overDraw = 0;
    let underDraw = 0;
    let earlySettle = 0;
    let replayed = 0;
    const violations = [];
    for (const b of bets) {
        const d = b.dealerHand || [];
        if (d.length < 2)
            continue;
        replayed++;
        const hv = (0, config_1.handValue)(d);
        if (hv.soft && hv.total === 17)
            dealerSoft17Final++;
        // Over-draw: before each drawn card the running total must have been < 17.
        for (let i = 2; i < d.length; i++) {
            if ((0, config_1.handValue)(d.slice(0, i)).total >= 17) {
                overDraw++;
                if (violations.length < 5)
                    violations.push(`nonce ${b.nonce}: drew on ${(0, config_1.handValue)(d.slice(0, i)).total}`);
                break;
            }
        }
        // Under-draw: stopping below 17 is only legitimate when no live hand remained.
        if (hv.total < 17) {
            const live = b.playerHands.some((h) => (0, config_1.handValue)(h.cards).total <= 21);
            const playerNatural = !b.split && (0, config_1.isBlackjack)(b.playerHands[0]?.cards || []);
            if (!live)
                continue; // every player hand busted — nothing left to beat
            if (playerNatural) {
                earlySettle++;
                continue;
            } // 3:2 settled before the dealer drew
            underDraw++;
            if (violations.length < 5)
                violations.push(`nonce ${b.nonce}: stood on ${hv.total} vs a live hand`);
        }
    }
    // An over-draw (dealer took a card on 17+) or under-draw (stood below 17 with a live player
    // hand) is a dealing-rule VIOLATION, not a soft warning — it must not resolve to a
    // "Conditional Pass". Absence of soft-17 evidence is merely insufficient coverage (FLAG).
    const s11Violation = overDraw > 0 || underDraw > 0;
    const s11Ok = dealerSoft17Final > 0 && !s11Violation;
    const s11 = (0, context_1.step)(11, 'Dealer Stands on Soft 17 (S17)', s11Ok ? 'PASS' : s11Violation ? 'FAIL' : 'FLAG', `${replayed} dealer hands replayed against S17: ${overDraw} over-draws (took a card on 17+), ${underDraw} under-draws (stood below 17 with a live player hand); ` +
        `${dealerSoft17Final} hands finished on soft 17 — the dealer stood, confirming S17 rather than H17; ` +
        `${earlySettle} hands exempt (player natural blackjack settles 3:2 before the dealer draws)` +
        (violations.length ? `; e.g. ${violations.slice(0, 3).join('; ')}` : ''));
    // ── Step 12: Double-after-split (DAS) ───────────────────────────────────────
    // Derived from the ACTION TOKENS, not from `b.split && b.doubled`.
    //
    // `split` and `doubled` are operator SUMMARY booleans, and establishing a house rule by
    // reading two of them contradicts this audit's own standing rule about summary fields — the
    // rule stated for `dealerPoints` on the very next page of the report. A summary flag is the
    // operator's assertion about the round; the token stream is the log of what happened. So the
    // rule is read off the tokens (`split` present AND `double` present) and the two summary
    // booleans are then required to AGREE. They agree on every round of this capture: 165 rounds
    // carry both tokens, 165 rounds carry both booleans; 401 rounds carry the `split` token and
    // 401 carry `split: true`.
    //
    // Step 6's grammar (G1, G6) independently binds each boolean to its token, so a disagreement
    // also fails there; this step states the derivation locally instead of relying on that.
    const hasTok = (b, t) => (b.actions || []).includes(t);
    const dasHands = bets.filter((b) => hasTok(b, 'split') && hasTok(b, 'double')).length;
    const splits = bets.filter((b) => hasTok(b, 'split')).length;
    const dasByFlags = bets.filter((b) => b.split && b.doubled).length;
    const splitsByFlags = bets.filter((b) => b.split).length;
    const flagsAgree = dasHands === dasByFlags && splits === splitsByFlags;
    const s12 = (0, context_1.step)(12, 'Double-After-Split Allowed (DAS)', dasHands > 0 && flagsAgree ? 'PASS' : 'FLAG', `${dasHands} of ${splits} split rounds carry both a \`split\` and a \`double\` action token ⇒ DAS allowed. ` +
        `Derived from the action stream, not from the operator's \`split\`/\`doubled\` summary booleans; those booleans are required to agree and do (${dasByFlags} of ${splitsByFlags})` +
        (flagsAgree ? '' : `; FLAG: summary booleans disagree with the token stream`) +
        (dasHands === 0 ? '; COVERAGE FLAG: no doubled split round observed — DAS availability not witnessed' : ''));
    // ── Step 13: Dealer peek ────────────────────────────────────────────────────
    const dealerBJ = bets.filter((b) => (b.dealerHand || []).length === 2 && (0, config_1.handValue)(b.dealerHand).total === 21);
    const peeked = dealerBJ.filter((b) => (b.actions || []).filter((a) => a !== 'no-ins').length === 0);
    const s13 = (0, context_1.step)(13, 'Dealer Peeks for Blackjack', dealerBJ.length > 0 && peeked.length === dealerBJ.length ? 'PASS' : 'FLAG', `${dealerBJ.length} dealer blackjacks, all settled with no player play action (peek on Ace/10) — ${peeked.length}/${dealerBJ.length}`);
    // ── Step 14: No surrender action observed ───────────────────────────────────
    // This proves that no `surrender` token appears across the capture — NOT that surrender was
    // unavailable. The action vocabulary in the dataset is hit, stand, double, no-ins, split.
    // `no-ins` is NOT a decline marker: every round carrying it also carries a funded, settled
    // insurance record, so the capture contains no confirmed decline vocabulary of any kind and
    // "never offered" cannot be separated from "offered and never used". Availability of a
    // surrender action was not probed from this capture.
    const surrender = bets.filter((b) => (b.actions || []).some((a) => /surrender/i.test(a))).length;
    const noIns = bets.filter((b) => (b.actions || []).some((a) => /no-ins/i.test(a))).length;
    const noInsFunded = bets.filter((b) => (b.actions || []).some((a) => /no-ins/i.test(a)) && !!(b.sideBets && b.sideBets.insurance)).length;
    const s14 = (0, context_1.step)(14, 'No Surrender Action Observed', surrender === 0 ? 'PASS' : 'FLAG', `${surrender} surrender actions across ${bets.length} rounds. The action vocabulary is hit, stand, double, no-ins, split. ` +
        `no-ins is not a decline token — ${noInsFunded}/${noIns} rounds carrying it also carry a funded, settled insurance record — ` +
        `so this step shows only that surrender was never TAKEN; availability was not probed from this capture.`);
    return [s11, s12, s13, s14];
}

  },
  "tests/steps/sidebets.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * Steps 15–16: Side-bet correctness.
 *
 * For every placed side bet, re-derive the outcome from the cards alone (src/sidebets.ts,
 * LIQD's confirmed paytables) and confirm the recorded category + payout match. Payout is
 * a total return incl. stake: win → betAmount × (payoutToOne + 1); loss → 0.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const context_1 = require("./context");
const hands_1 = require("./hands");
const sidebets_1 = require("../../src/sidebets");
const money_1 = require("../../src/money");
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
function fundedCount(bets, key) {
    return bets.filter((b) => !!b.sideFunded?.[key]).length;
}
function run(ctx) {
    const { bets } = ctx;
    const ppExpected = fundedCount(bets, 'perfectPair');
    const t3Expected = fundedCount(bets, 'twentyOnePlusThree');
    // ── Step 15: Perfect Pairs ──────────────────────────────────────────────────
    let ppChecked = 0, ppCatBad = 0, ppPayBad = 0;
    const ppCatCount = {};
    const ppFails = [];
    for (const b of bets) {
        const sb = b.sideBets.perfectPair;
        if (!sb)
            continue;
        // Fallback is `initialTwo(b)`, NOT `playerHands[0].cards`: on a split round the main
        // hand's second card is a post-split draw, so the old fallback fed the evaluator the
        // wrong pair on 392 of the 401 split rounds. Inert on this capture (all 5,800 records
        // carry `playerHand`) but wrong where it would have been reached. See ./hands.ts.
        const cards = sb.playerHand || (0, hands_1.initialTwo)(b);
        if (cards.length < 2)
            continue;
        const ev = (0, sidebets_1.evaluatePerfectPairs)(cards[0], cards[1]);
        ppChecked++;
        ppCatCount[ev.category] = (ppCatCount[ev.category] || 0) + 1;
        const stakeUnits = (0, money_1.unitsOf)(sb.betAmount);
        const winUnits = (0, money_1.unitsOf)(sb.winningAmount);
        const expectUnits = stakeUnits === null ? null : ev.payout > 0 ? stakeUnits * (ev.payout + 1) : 0;
        if (sb.gameResult && ev.category !== sb.gameResult) {
            ppCatBad++;
            if (ppFails.length < 4)
                ppFails.push(`nonce ${b.nonce}: ${ev.category} != ${sb.gameResult}`);
        }
        if (winUnits === null || expectUnits === null || winUnits !== expectUnits) {
            ppPayBad++;
            if (ppFails.length < 4)
                ppFails.push(`nonce ${b.nonce}: pay ${String(sb.winningAmount)} != ${expectUnits === null ? 'off-grid stake' : (0, money_1.asMoney)(expectUnits)}`);
        }
    }
    // A scored step that passes over ZERO records asserts nothing. An earlier capture sent
    // the wrong request field name (`perfectPairBetAmount` — singular), which the API accepted
    // and silently dropped, so no Perfect Pairs bet was ever placed and this step "passed" on
    // an empty set. It now FLAGs when the dataset carries no Perfect Pairs record, so that
    // failure mode announces itself instead of reading as a clean pass.
    const ppCats = Object.entries(ppCatCount).filter(([k]) => k !== 'NO_PAIR').map(([k, v]) => `${k}:${v}`).join(', ');
    const ppCoverageOk = ppExpected > 0 && ppChecked === ppExpected;
    const s15 = (0, context_1.step)(15, 'Perfect Pairs Side Bet', ppChecked === 0 ? 'FLAG' : !ppCoverageOk ? 'FAIL' : ppCatBad === 0 && ppPayBad === 0 ? 'PASS' : 'FAIL', ppChecked === 0
        ? 'no Perfect Pairs bets present in the dataset — nothing to verify; this step asserts nothing until the side bet is actually wagered'
        : `${ppChecked}/${ppExpected} Perfect Pairs bets re-derived from the initial two cards against the 25/13/6 paytable, payouts compared as exact integer 1e-8 settlement units: ` +
            `${ppCatBad} category, ${ppPayBad} payout mismatch` +
            (ppCats ? `; winning categories ${ppCats}` : '') +
            (ppCoverageOk ? '' : `; COVERAGE FAIL: ${ppExpected} round(s) declare a funded Perfect Pairs bet but only ${ppChecked} record(s) were verified`) +
            (ppFails.length ? `; ${ppFails.slice(0, 3).join('; ')}` : ''));
    // ── Step 16: 21+3 ───────────────────────────────────────────────────────────
    let t3Checked = 0, t3CatBad = 0, t3PayBad = 0;
    const t3Fails = [];
    const catCount = {};
    for (const b of bets) {
        const sb = b.sideBets.twentyOnePlusThree;
        if (!sb)
            continue;
        const cards = sb.playerHand || (0, hands_1.initialTwo)(b); // split-aware — see Step 15's note
        const up = (b.dealerHand || [])[0];
        if (cards.length < 2 || !up)
            continue;
        const ev = (0, sidebets_1.evaluate21Plus3)(cards[0], cards[1], up);
        t3Checked++;
        catCount[ev.category] = (catCount[ev.category] || 0) + 1;
        const stakeUnits = (0, money_1.unitsOf)(sb.betAmount);
        const winUnits = (0, money_1.unitsOf)(sb.winningAmount);
        const expectUnits = stakeUnits === null ? null : ev.payout > 0 ? stakeUnits * (ev.payout + 1) : 0;
        if (sb.gameResult && ev.category !== sb.gameResult) {
            t3CatBad++;
            if (t3Fails.length < 4)
                t3Fails.push(`nonce ${b.nonce}: ${ev.category} != ${sb.gameResult}`);
        }
        if (winUnits === null || expectUnits === null || winUnits !== expectUnits) {
            t3PayBad++;
            if (t3Fails.length < 4)
                t3Fails.push(`nonce ${b.nonce}: pay ${String(sb.winningAmount)} != ${expectUnits === null ? 'off-grid stake' : (0, money_1.asMoney)(expectUnits)}`);
        }
    }
    // COVERAGE: like Step 15, a pass over ZERO 21+3 records asserts nothing — FLAG if none present.
    const wins = Object.entries(catCount).filter(([k]) => k !== 'NO_MATCH').map(([k, v]) => `${k}:${v}`).join(', ');
    const t3CoverageOk = t3Expected > 0 && t3Checked === t3Expected;
    const s16 = (0, context_1.step)(16, '21+3 Side Bet', t3Checked === 0 ? 'FLAG' : !t3CoverageOk ? 'FAIL' : t3CatBad === 0 && t3PayBad === 0 ? 'PASS' : 'FAIL', t3Checked === 0
        ? 'no 21+3 bets present in the dataset — nothing to verify; this step asserts nothing until the side bet is actually wagered'
        : `${t3Checked}/${t3Expected} 21+3 bets re-derived (5/10/30/40/100), payouts compared as exact integer 1e-8 settlement units: ${t3CatBad} category, ${t3PayBad} payout mismatch` +
            (wins ? ` [${wins}]` : '') +
            (t3CoverageOk ? '' : `; COVERAGE FAIL: ${t3Expected} round(s) declare a funded 21+3 bet but only ${t3Checked} record(s) were verified`) +
            (t3Fails.length ? '; ' + t3Fails.slice(0, 3).join('; ') : ''));
    return [s15, s16];
}

  },
  "tests/steps/simulation.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * Step 17: Simulation — finite 8-deck RTP consistency estimate + statistical validation.
 *
 * Reads outputs/simulation-results.json (produced by `npm run simulate`, Monte-Carlo
 * on the real blackjackShoe algorithm with optimal basic strategy). Until the
 * simulation has been run, this step is informational only. The live-bet money path is ALWAYS
 * informational (a reconciliation, NOT an RTP estimate — n=6,000 has no statistical power for
 * RTP); authoritative RTP is the EXACT 8-deck solve (src/exact-play.ts), which this simulation
 * confirms rather than establishes; stated per initial bet.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const context_1 = require("./context");
const config_1 = require("../../src/config");
const rng_1 = require("../../src/rng");
const exact_play_1 = require("../../src/exact-play");
const optimal_play_1 = require("../../src/optimal-play");
const stats_1 = require("../../src/stats");
function run(ctx) {
    const { bets } = ctx;
    const scored = [];
    const info = [];
    // ── Money-path reconciliation (informational — NOT an RTP measurement) ──────────
    // Total wagered = every stake placed (line 21 definition). Each hand contributes its own
    // stake; a DOUBLE adds one further stake for THAT hand. A doubled split doubles BOTH hands,
    // so the number of extra stakes is the count of `double` actions in the round — not one per
    // round. (An earlier version added a single matching stake per doubled round, which
    // understated total wagered by 26.40 across the 165 doubled-split rounds, all of which
    // doubled both hands.) Insurance is tracked separately so we can also show the figure
    // excluding the −EV insurance the capture placed on dealer-Ace hands.
    //
    // This is NOT a return-to-player estimate: at n=6,000 the sample has no statistical power for
    // RTP — the money-weighted effective size is only ~332 rounds once the $10 phase-E stakes
    // dominate (SE ≈ ±6pp; even equal-weighted it is ≈ ±1.5pp) — and the phases deliberately
    // include suboptimal strategies. The percentages below reconcile the money path; they are not
    // an RTP figure. Authoritative RTP is the exact 8-deck solve (Step 17, RTP Analysis); the
    // simulation confirms it.
    let wagered = 0, returned = 0, insWager = 0, insReturn = 0;
    for (const b of bets) {
        for (const h of b.playerHands)
            wagered += Number(h.betAmount); // each hand's own stake
        const nDoubles = b.actions.filter((a) => a === 'double').length; // one extra stake per doubled hand
        wagered += nDoubles * Number(b.playerHands[0].betAmount);
        for (const key of ['perfectPair', 'twentyOnePlusThree']) {
            const sb = b.sideBets[key];
            if (sb && sb.betAmount != null)
                wagered += Number(sb.betAmount);
        }
        const ins = b.sideBets.insurance;
        if (ins && ins.betAmount != null) {
            insWager += Number(ins.betAmount);
            insReturn += Number(ins.winningAmount || 0);
        }
        returned += Number(b.winningAmount);
    }
    const reconIncl = returned / (wagered + insWager);
    const reconExcl = (returned - insReturn) / wagered;
    info.push({ label: 'Money-path reconciliation (all wagers incl. side bets + insurance)', detail: `${wagered.toFixed(2)} wagered + ${insWager.toFixed(2)} insurance, ${returned.toFixed(2)} returned = ${(reconIncl * 100).toFixed(4)}% over ${bets.length} hands — RECONCILIATION ONLY, not an RTP estimate (n=6,000 has ~±6pp money-weighted power)` });
    info.push({ label: 'Money-path reconciliation (excl. insurance)', detail: `${(reconExcl * 100).toFixed(4)}% — insurance (${insWager.toFixed(2)} wagered, ${insReturn.toFixed(2)} returned) is a −EV side wager the capture placed on dealer-Ace hands` });
    const naturals = bets.filter((b) => !b.split && (0, config_1.isBlackjack)(b.playerHands[0].cards)).length;
    info.push({ label: 'Player natural blackjacks', detail: `${naturals}/${bets.length} = ${(naturals / bets.length * 100).toFixed(2)}% (8-deck expectation ≈ 4.75%)` });
    // Scored steps from the simulation, if it has been run.
    const simPath = path.join(ctx.outputsDir, 'simulation-results.json');
    if (fs.existsSync(simPath)) {
        const sim = JSON.parse(fs.readFileSync(simPath, 'utf8'));
        // Step 17 — finite 8-deck RTP, gated against the EXACT solver.
        //
        // Previously this compared the simulation against the infinite-deck limit with a
        // hand-picked `MAX_REMOVAL_LIFT = 0.0015` on top of the Monte-Carlo tolerance —
        // a 0.32 pp acceptance window on a 0.49% quantity, wide enough for a 0.15 pp
        // strategy bug to pass unnoticed, and the constant was not derived from anything
        // in the repo. Both the anchor and the slack are now gone: the simulation is
        // compared like-for-like against the exact 8-deck EV of the very strategy table
        // it plays, with only Monte-Carlo error allowed.
        //
        // The exact figure is RECOMPUTED here rather than read from the simulation
        // artifact. A scalar the simulator wrote about itself cannot check the simulator.
        const exactTD = (0, exact_play_1.solveExact)({ kind: 'finite', decks: 8 }, 'TD');
        const exactEdge = exactTD.edgePerInitialBet;
        const exactPerTotal = exactTD.edgePerTotalWagered;
        const rtpInitial = sim.baseGame?.rtpInitial ?? sim.baseGame?.rtp ?? sim.rtp;
        const rtpPerTotal = sim.baseGame?.rtpPerTotalWagered;
        const rounds = sim.baseGame?.rounds ?? sim.rounds;
        // ── The tolerance is NOT read from the artifact it gates (G-BIND) ──────────
        // `se = SD / sqrt(rounds)` with `rounds` taken from simulation-results.json let the
        // artifact set its own acceptance window. A reviewer forged the file to claim 1,000,000
        // rounds and 99.20% RTP, re-pinned SIMULATION_SHA256, and this step printed
        //   [PASS] 17 … simulation 0.8000% over 1,000,000 rounds (±0.1150 pp 1σ) → 2.72σ, limit 3σ
        // — 56 passing (the suite's size on that 2026-09-09 run; a historical record, not the current
        // test count), 31/31, Full Pass. Claiming 30× fewer rounds bought a 5.5× wider gate and
        // hid a 0.31 pp miss. σ now comes from SIM_BASE_ROUNDS in src/config.ts, and the
        // artifact's own round count must EQUAL that pin or the step hard-FAILs. A forger who
        // wants a looser gate has to widen it in source, in a diff a human reads.
        const roundsPinned = Number(rounds) === config_1.SIM_BASE_ROUNDS;
        const se = config_1.SIM_SD_PER_ROUND / Math.sqrt(config_1.SIM_BASE_ROUNDS); // pinned; measured SD 1.146718922176392, rounded up
        const TOL = 3 * se; // Monte-Carlo error only
        const simEdge = rtpInitial != null ? 1 - rtpInitial : NaN;
        const dev = Math.abs(simEdge - exactEdge);
        // The per-total-wagered statistic is the per-initial one divided by the average wager, so
        // its sampling error scales the same way. Dividing it by the per-INITIAL SE made this half
        // of the gate ~13% looser than the stated 3σ.
        const sePerTotal = se / exactTD.avgWager;
        const TOL_PER_TOTAL = 3 * sePerTotal;
        const devPerTotal = rtpPerTotal != null ? Math.abs((1 - rtpPerTotal) - exactPerTotal) : NaN;
        const consistent = roundsPinned && rtpInitial != null && dev <= TOL
            && (rtpPerTotal == null || devPerTotal <= TOL_PER_TOTAL);
        // ARTIFACT-INTEGRITY GUARD (hard FAIL, not a flag): the card-removal lift carried in the
        // artifact must equal the value recomputed here from two independent engines. A hand-pasted
        // scalar (the exact failure mode that once shipped) cannot survive this — the recomputation
        // is (exact finite-8 TD RTP) − (infinite-deck optimal RTP), the same quantity simulate.ts writes.
        const liftRecomputed = (exactTD.rtpPerInitialBet - (0, optimal_play_1.computeOptimalRTP)('stand', true).rtp) * 100;
        const liftArtifact = Number(sim.cardRemovalLiftPP);
        const liftOk = Number.isFinite(liftArtifact) && Math.abs(liftArtifact - liftRecomputed) < 1e-9;
        // A round count that disagrees with the pin is a FAIL, not a FLAG: it means the artifact
        // is not the run this repo publishes, and every σ printed below would be about a
        // different experiment.
        const status17 = (!liftOk || !roundsPinned) ? 'FAIL' : (consistent ? 'PASS' : 'FLAG');
        scored.push((0, context_1.step)(17, 'Basic-strategy RTP vs exact 8-deck solver', status17, `exact TD edge ${(exactEdge * 100).toFixed(6)}% per initial bet ` +
            `(${(exactPerTotal * 100).toFixed(6)}% per total wagered, avg wager ${exactTD.avgWager.toFixed(6)}); ` +
            `simulation ${(simEdge * 100).toFixed(4)}% over ${Number(rounds).toLocaleString()} rounds ` +
            `(±${(se * 100).toFixed(4)} pp 1σ, σ computed from the PINNED ${config_1.SIM_BASE_ROUNDS.toLocaleString()} rounds in src/config.ts, never from the artifact) → ${(dev / se).toFixed(2)}σ, limit 3σ` +
            (rtpPerTotal != null ? `; per total wagered ${(devPerTotal / sePerTotal).toFixed(2)}σ (±${(sePerTotal * 100).toFixed(4)} pp 1σ)` : '') +
            `. Exact figure recomputed in-step, not read from the artifact.` +
            (roundsPinned
                ? ''
                : ` — ARTIFACT baseGame.rounds=${String(rounds)} DISAGREES with the pinned SIM_BASE_ROUNDS=${config_1.SIM_BASE_ROUNDS}: a claimed round count cannot set its own tolerance.`) +
            (liftOk
                ? ` Card-removal lift ${liftArtifact.toFixed(6)} pp matches the in-step recomputation.`
                : ` — ARTIFACT cardRemovalLiftPP=${sim.cardRemovalLiftPP} DISAGREES with the recomputed ${liftRecomputed.toFixed(9)} pp (hand-edited or stale artifact).`)));
        // Step 18 — Pass 1 RNG validation on the real shoe (first-card uniformity + serial independence).
        //
        // HARDENING: the verdict is RECOMPUTED from the raw statistics. It previously read
        // `firstCardUniformFail` / `serialFail` — booleans the simulator wrote about itself —
        // so an artifact carrying χ²=9999 with the flags left false still scored PASS. A scalar
        // the simulator asserts about its own output cannot check the simulator. The p-value is
        // re-derived from (χ², df) via the exact regularized incomplete gamma, and the
        // pre-registered thresholds are applied to the numbers directly.
        // THE df WAS ARTIFACT-SUPPLIED AND UNBOUND. Recomputing p from (χ², df) is only a
        // recomputation if BOTH inputs are bound. A reviewer set
        //   firstCardChi2 = 9999, firstCardDf = 100000, firstCardPValue = 1
        // and re-pinned: this step printed "p=1.0000 RECOMPUTED from χ²/df" and PASSed, because
        // χ²=9999 on 100,000 df really is p≈1. The df of a 13-bin rank test is RANKS−1 and
        // nothing else, so it comes from src/config.ts (FIRST_CARD_DF) and the artifact's own
        // `firstCardDf` must agree with it. `rounds` is pinned for the same reason as Step 17's.
        const p1 = sim.pass1_fresh_seeds;
        if (p1 && Number(p1.rounds) > 0) {
            const rounds1 = Number(p1.rounds);
            const chi2 = Number(p1.firstCardChi2);
            const dfArtifact = Number(p1.firstCardDf);
            const dfOk = dfArtifact === config_1.FIRST_CARD_DF;
            const pRecomputed = (0, stats_1.chiSquaredPValue)(chi2, config_1.FIRST_CARD_DF); // df PINNED, not read
            const z1 = Math.abs(Number(p1.serialR1Z));
            const runsP = Number(p1.serialRunsPValue);
            const roundsOk = rounds1 === config_1.SIM_PASS1_ROUNDS;
            const uniformOk = Number.isFinite(chi2) && pRecomputed >= 0.01;
            const serialOk = Number.isFinite(z1) && z1 < 3 && Number.isFinite(runsP) && runsP >= 0.01;
            // The artifact's own p must agree with the recomputation, or it has been doctored.
            const pAgrees = Number.isFinite(Number(p1.firstCardPValue))
                && Math.abs(Number(p1.firstCardPValue) - pRecomputed) < 1e-6;
            // A statistic outside its threshold is a FLAG — that is a finding about the RNG.
            // An artifact field that CONTRADICTS a pin or a recomputation is a FAIL — that is a
            // finding about the artifact, and it must not resolve to "Conditional Pass".
            const contradiction18 = !dfOk || !roundsOk || !pAgrees;
            const ok18 = uniformOk && serialOk && !contradiction18;
            scored.push((0, context_1.step)(18, 'Simulation Pass 1 — first-card uniformity + serial independence', contradiction18 ? 'FAIL' : ok18 ? 'PASS' : 'FLAG', `first-card rank χ²=${chi2.toFixed(2)} (df ${config_1.FIRST_CARD_DF} PINNED as RANKS−1 in src/config.ts, p=${pRecomputed.toFixed(4)} RECOMPUTED from χ² at that df, threshold ≥0.01); ` +
                `serial |r₁z|=${z1.toFixed(2)} (threshold <3), runs p=${runsP.toFixed(4)} (threshold ≥0.01) ` +
                `over ${rounds1.toLocaleString()} rounds` +
                (dfOk ? '' : ` — ARTIFACT firstCardDf=${dfArtifact} DISAGREES with the pinned ${config_1.FIRST_CARD_DF}: a rank test on ${config_1.RANKS} bins has ${config_1.FIRST_CARD_DF} degrees of freedom and the artifact does not get to choose`) +
                (roundsOk ? '' : ` — ARTIFACT rounds=${rounds1} DISAGREES with the pinned SIM_PASS1_ROUNDS=${config_1.SIM_PASS1_ROUNDS}`) +
                (pAgrees ? '' : ` — ARTIFACT p=${Number(p1.firstCardPValue)} DISAGREES with the recomputed value`)));
        }
        else {
            // A block that is ABSENT from a pinned artifact is not "cannot score", it is a pinned
            // artifact that does not contain what the repo says it contains. FAIL, for the same reason
            // a missing artifact FAILs (Step 25): the alternative resolves to Conditional Pass, which
            // reads as a pass.
            scored.push((0, context_1.step)(18, 'Simulation Pass 1 — first-card uniformity + serial independence', 'FAIL', 'pass1_fresh_seeds missing or zero rounds in the PINNED outputs/simulation-results.json — the artifact does not contain the experiment this step scores; a step that vanishes from the scored set would shrink the denominator and still print a Full Pass'));
        }
        // Step 19 — Pass 2 cherry-pick detection over casino seeds (bootstrap null).
        //
        // WHAT WAS WRONG. The step said "RECOMPUTED" and was not. It read `cherryPickFlags` and
        // `expectedFlagsByChance` straight out of the artifact and derived p₀ = expected / seeds
        // from them, so setting `cherryPickFlags = 120, expectedFlagsByChance = 120,
        // cherryPickSurvivalP = 1` made p₀ = 1, the survival probability 1, and the step printed
        // "120 flag(s) over 120 seeds … RECOMPUTED … PASS" — a dataset in which every epoch had
        // flagged, scored as clean, 31/31 Full Pass. No mocha test read `pass2_casino_seeds` at
        // all, so nothing else looked.
        //
        // WHAT IT DOES NOW, in order of how much it costs to forge:
        //   (a) p₀ is PASS2_P0 = α(1−α) from src/config.ts — the declared significance level of
        //       the test, never an artifact field.
        //   (b) `seeds_tested` and `results.length` must equal EXPECTED_SEEDS, and the population
        //       of `results[]` is BOUND to the dataset: every row's (epoch, hashedServerSeed)
        //       pair must be a revealed seed record of the capture, and every revealed seed record
        //       must appear exactly once. A row count is not an identity (G-BIND).
        //   (c) `earlyChi2` is RECOMPUTED from the revealed serverSeed + clientSeed, re-deriving
        //       the shoe for each of the served nonces 0..PASS2_EARLY_NONCES−1 and running the same
        //       rank χ² through the same `chiSquaredTest` the simulator used. NOTE the bin count:
        //       at n=50 the expected count per rank is 50/13 = 3.85, below 5, so `chiSquaredTest`
        //       pools the two end bins (A with 2, Q with K) and the early statistic is an 11-bin χ²
        //       on df 10 — not 13 bins. That is why the early half is compared as a RAW χ² against
        //       the re-derivation rather than through a pinned df: the recomputation reproduces the
        //       simulator's statistic exactly (120/120), which is a stronger binding than agreeing
        //       on a df would be. Costs ~6,000 shoe derivations (~4 s).
        //   (d) `latePValue` is recomputed from the artifact's `lateChi2` at the PINNED df. The LATE
        //       window is 950 nonces, so its expected count per rank is 73 and NO pooling happens —
        //       13 bins, df = RANKS−1 = 12, which is exactly FIRST_CARD_DF. Verified against the
        //       committed artifact: row 0's lateChi2 8.934736842105263 gives p = 0.7084944471544968
        //       at df 12, which is the value the artifact carries (df 10 and 11 give 0.5383 and
        //       0.6279 and would not match).
        //   (e) `cherryPickFlags` is RECOMPUTED as the count of rows satisfying the test's own
        //       predicate, and the artifact's scalar must agree with it.
        //
        // WHAT REMAINS ARTIFACT-SUPPLIED, stated rather than implied:
        //   • `lateChi2` — the 950-nonce control window. Recomputing it costs 114,000 further shoe
        //     derivations (~70 s) on every scored run and every gate replay. Its p-value, its
        //     df and its role in the flag predicate are all bound; the raw statistic is not.
        //   • `earlyBootstrapP` — the bootstrap null is drawn from fresh `crypto.randomBytes`
        //     entropy on each `npm run simulate`, so it is not reproducible by construction. This
        //     is a property of the test, not an omission.
        // Both are disclosed here because a step that says RECOMPUTED must be exact about what it
        // recomputed; that overstatement is the defect this rewrite exists to fix.
        const p2 = sim.pass2_casino_seeds;
        if (p2 && Number(p2.seeds_tested) > 0) {
            const seedsClaimed = Number(p2.seeds_tested);
            const rows = Array.isArray(p2.results) ? p2.results : [];
            // (b) population binding against the dataset's own revealed seed records.
            const revealed = ctx.seeds.filter((s) => s.serverSeed != null);
            const revealedByHash = new Map(revealed.map((s) => [s.hashedServerSeed, s]));
            const seenHashes = new Set();
            let rowsUnbound = 0;
            for (const r of rows) {
                const h = String(r.hashedServerSeed ?? '');
                const sd = revealedByHash.get(h);
                if (!sd || Number(r.epoch) !== sd.epoch || seenHashes.has(h))
                    rowsUnbound++;
                else
                    seenHashes.add(h);
            }
            const populationOk = seedsClaimed === config_1.EXPECTED_SEEDS
                && rows.length === config_1.EXPECTED_SEEDS
                && revealed.length === config_1.EXPECTED_SEEDS
                && rowsUnbound === 0
                && seenHashes.size === config_1.EXPECTED_SEEDS;
            // (c)+(d)+(e) recompute the early statistic from seeds, the late p from the pinned df,
            // and the flag decision from the test's predicate.
            const expectedBins = new Array(config_1.RANKS).fill(config_1.PASS2_EARLY_NONCES / config_1.RANKS);
            let earlyBad = 0;
            let earlyChecked = 0;
            let lateBad = 0;
            let flagsRecomputed = 0;
            const earlyFails = [];
            for (const r of rows) {
                const sd = revealedByHash.get(String(r.hashedServerSeed ?? ''));
                if (sd && sd.serverSeed) {
                    const freq = new Array(config_1.RANKS).fill(0);
                    for (let n = 0; n < config_1.PASS2_EARLY_NONCES; n++) {
                        freq[(0, config_1.rankOf)((0, rng_1.blackjackShoe)(sd.serverSeed, sd.clientSeed, n)[0]) - 1]++;
                    }
                    const chi2 = (0, stats_1.chiSquaredTest)(freq, expectedBins).chi2;
                    earlyChecked++;
                    if (!(Math.abs(chi2 - Number(r.earlyChi2)) < 1e-9)) {
                        earlyBad++;
                        if (earlyFails.length < 3)
                            earlyFails.push(`epoch ${String(r.epoch)}: artifact ${String(r.earlyChi2)} vs recomputed ${chi2.toFixed(6)}`);
                    }
                }
                const lateP = (0, stats_1.chiSquaredPValue)(Number(r.lateChi2), config_1.FIRST_CARD_DF);
                if (!(Math.abs(lateP - Number(r.latePValue)) < 1e-6))
                    lateBad++;
                // ONE definition of the predicate — src/config.ts `cherryPickFlag`, shared verbatim with
                // src/simulate.ts (which wrote the artifact) and src/cherry-pick-attack.ts (QA-04).
                if ((0, config_1.cherryPickFlag)(Number(r.earlyBootstrapP), lateP))
                    flagsRecomputed++;
            }
            const flagsClaimed = Number(p2.cherryPickFlags);
            const flagsAgree = flagsClaimed === flagsRecomputed;
            const expectedByChance = config_1.EXPECTED_SEEDS * config_1.PASS2_P0;
            const survivalRecomputed = (0, stats_1.binomialSurvival)(flagsRecomputed, config_1.EXPECTED_SEEDS, config_1.PASS2_P0);
            const claimed = Number(p2.cherryPickSurvivalP);
            const agrees = Number.isFinite(claimed) && Math.abs(claimed - survivalRecomputed) < 1e-6;
            // Same split as Step 18: a survival probability below threshold is a FLAG (evidence of
            // selection); a population or recomputation contradiction is a FAIL (evidence about the
            // artifact). The reviewers' 120/120-flags forgery has to land in the second bucket.
            const contradiction19 = !populationOk || earlyChecked !== config_1.EXPECTED_SEEDS || earlyBad !== 0
                || lateBad !== 0 || !flagsAgree || !agrees;
            const ok19 = !contradiction19 && survivalRecomputed >= 0.01;
            scored.push((0, context_1.step)(19, 'Simulation Pass 2 — cherry-pick detection (casino seeds)', contradiction19 ? 'FAIL' : ok19 ? 'PASS' : 'FLAG', `${flagsRecomputed} flag(s) RECOMPUTED over ${config_1.EXPECTED_SEEDS} seeds (expected ~${expectedByChance.toFixed(1)} by chance at p₀=${config_1.PASS2_P0.toFixed(4)} = α(1−α), α=${config_1.PASS2_ALPHA} PINNED in src/config.ts — never derived from the artifact's own expectedFlagsByChance); ` +
                `binomial survival P=${survivalRecomputed.toFixed(4)}, threshold ≥0.01. ` +
                `Population bound to the dataset: ${rows.length}/${config_1.EXPECTED_SEEDS} result rows, each matched one-to-one to a revealed seed record by (epoch, hashedServerSeed). ` +
                `earlyChi2 re-derived from the revealed seeds over the served nonces 0..${config_1.PASS2_EARLY_NONCES - 1}: ${earlyChecked - earlyBad}/${earlyChecked} reproduce exactly. ` +
                `latePValue re-derived from lateChi2 at the pinned df ${config_1.FIRST_CARD_DF}: ${rows.length - lateBad}/${rows.length} agree. ` +
                `NOT recomputed here, and stated so: the raw lateChi2 over the 950-nonce control window (≈70 s of shoe derivations per run) and earlyBootstrapP (the bootstrap null is drawn from fresh entropy each simulate run and is not reproducible by construction). ` +
                `This statistic tests first-card RANK UNIFORMITY over the served window — it does not read settled MONEY at all, and the measured experiment (npm run attack, outputs/cherry-pick-attack.json) found no significant excess of flags on deliberately money-selected blocks: 8 over 120 against a chance rate of 5.7, survival P=0.2117. That is a null result at that experiment's size, not a proof of zero power — see AUDIT_CONTEXT.md#seed-selection-and-server-operations. ` +
                `Primary defence is the client-seed-after-commitment mitigation.` +
                (populationOk ? '' : ` — POPULATION FAIL: seeds_tested=${seedsClaimed}, rows=${rows.length}, revealed seed records=${revealed.length}, ${rowsUnbound} row(s) not matched to a revealed seed record (declared ${config_1.EXPECTED_SEEDS})`) +
                (earlyBad === 0 ? '' : ` — ARTIFACT earlyChi2 DISAGREES with the re-derivation on ${earlyBad} seed(s): ${earlyFails.join('; ')}`) +
                (lateBad === 0 ? '' : ` — ARTIFACT latePValue DISAGREES with the recomputation on ${lateBad} row(s)`) +
                (flagsAgree ? '' : ` — ARTIFACT cherryPickFlags=${flagsClaimed} DISAGREES with the ${flagsRecomputed} recomputed from the rows' own predicate`) +
                (agrees ? '' : ` — ARTIFACT P=${claimed} DISAGREES with the recomputed value`)));
        }
        else {
            scored.push((0, context_1.step)(19, 'Simulation Pass 2 — cherry-pick detection (casino seeds)', 'FAIL', 'pass2_casino_seeds missing or zero seeds tested in the PINNED outputs/simulation-results.json — the artifact does not contain the experiment this step scores'));
        }
    }
    else {
        // A MISSING PINNED artifact is a FAIL, not a flag and certainly not a skip.
        //
        // History of this branch, because it is the repo's own worked example of the class:
        // originally the three steps were omitted entirely when the file was absent, and the suite
        // printed "18/18 PASS — PROVABLY FAIR — Full Pass" while three scored steps had never run.
        // That was fixed to FLAG. FLAG resolves to "Conditional Pass" and exit 2, which still
        // reads as a pass. But `outputs/simulation-results.json` is HASH-PINNED in src/config.ts:
        // the repo asserts it is a specific file. A pinned artifact that is not there is not an
        // incomplete run, it is a missing piece of the evidence the verdict rests on.
        //
        // The same fix was NOT applied to the two sibling artifacts, and a reviewer deleted
        // outputs/exact-rtp.json and outputs/rtp-convergence.html for 31/31 · Full Pass · exit 0.
        // Presence of every pinned artifact is now asserted in Step 25 (Artifact Hash
        // Integrity), so this branch and that step fail together rather than separately.
        const missing = 'outputs/simulation-results.json is HASH-PINNED in src/config.ts and is NOT PRESENT — a pinned artifact is load-bearing evidence, so its absence FAILs rather than flagging. Run `npm run test:full` to regenerate and re-pin, or restore the committed artifact. See also Step 25.';
        scored.push((0, context_1.step)(17, 'Basic-strategy RTP (finite 8-deck)', 'FAIL', missing));
        scored.push((0, context_1.step)(18, 'Simulation Pass 1 — first-card uniformity + serial independence', 'FAIL', missing));
        scored.push((0, context_1.step)(19, 'Simulation Pass 2 — cherry-pick detection (casino seeds)', 'FAIL', missing));
        info.push({ label: 'Simulation', detail: 'pinned artifact absent — steps 17-19 FAIL; `npm run simulate` regenerates it' });
    }
    return { scored, info };
}

  },
  "tests/steps/standardization.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * Steps 22–31: Standardization-parity steps.
 *
 * Every property below is derivable from the committed capture with no new data —
 * each recomputes its own numbers from the raw dataset (or the shoe engine) rather
 * than trusting a summary field. They bring this audit's scored-step coverage to
 * parity with the published baseline blackjack report (which numbers these as discrete
 * steps) without padding: each asserts a distinct property and carries a coverage
 * assertion so a pass over an empty set cannot occur.
 *
 * SCOPE OF THAT LAST SENTENCE (corrected 2026-09-09). It is true of the ten steps in THIS file.
 * It was written in game-logic-verifiability.md as if it held of the whole scored suite, and it
 * did not: Step 21, `No FX haircut observed in this capture` (tests/steps/houseedge.ts), had no
 * coverage assertion at all — both its conditions are "expected 0", which an empty set satisfies
 * for free — so a reviewer stripped `exchangeRate` from all 12,046 side-bet records and the step
 * printed its full assurance paragraph over zero records, 31/31 Full Pass. Fixed there; the
 * chapter's universal phrasing is fixed with it.
 *
 *   22  Captured $10 Round Reconstruction (baseline 9) — sampled high-stake card parity
 *   23  Side-Bet Config Completeness  (baseline 11) — every paytable category exercised
 *   24  Phase Coverage & Labels       (baseline 13) — declared phases present, counts match
 *   25  Artifact Hash Integrity       (baseline 14) — all six pinned artifacts, present + matching,
 *                                                    plus report-figures.json re-derived field for field
 *   26  Phase D Client-Seed Variation (baseline 15) — custom seeds used, recompute, change outcomes
 *   27  Split Rules Verification      (baseline 23) — value-based split, aces one card, no re-split
 *   28  Insurance Offer Condition     (baseline 25) — insurance offered only on a dealer Ace upcard
 *   29  Side-Bet Deal-Time Invariance (baseline 27) — side-bet cards fixed at the deal, never mutate
 *   30  Deck-Model Confirmation       (baseline 29) — finite 8-deck shoe (duplicates, within 8 copies)
 *   31  Stake Bracket Bounds          (baseline 33) — observed stakes match the declared brackets
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const context_1 = require("./context");
const hands_1 = require("./hands");
const rng_1 = require("../../src/rng");
const config_1 = require("../../src/config");
const sidebets_1 = require("../../src/sidebets");
const loader_1 = require("../../src/loader");
const report_figures_1 = require("../../src/report-figures");
/**
 * Field-for-field comparison of two JSON values, used by Step 25 to reconcile
 * `outputs/report-figures.json` against a fresh recomputation. Returns the differing paths, capped
 * so a wholesale forgery reports a readable sample instead of a wall of text.
 *
 * Order-INSENSITIVE across object keys — a re-serialisation is not a forgery. Order-SENSITIVE
 * inside arrays: a reordered population is a different population, and the forged-artifact battery
 * attacks populations by emptying, duplicating and shrinking them.
 *
 * A non-finite value produced by OUR OWN recomputation is reported as its own defect rather than
 * compared. `NaN !== NaN`, so a corrupt engine would otherwise register as one ordinary mismatch
 * and read like a doctored file; it is the opposite fault — the verifier is broken. (Same class as
 * the framework's F7 probe, which planted a NaN in a reference formula and got a Full Pass.)
 */
function jsonDiffs(actual, expected, at = '', acc = [], cap = 8) {
    if (acc.length >= cap)
        return acc;
    const label = at || '(root)';
    const kind = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
    const ta = kind(actual);
    const te = kind(expected);
    if (ta !== te) {
        acc.push(`${label}: ${ta} where the recomputation gives ${te}`);
        return acc;
    }
    if (Array.isArray(actual) && Array.isArray(expected)) {
        if (actual.length !== expected.length) {
            acc.push(`${label}: ${actual.length} element(s) where the recomputation gives ${expected.length}`);
            return acc;
        }
        for (let i = 0; i < actual.length && acc.length < cap; i++)
            jsonDiffs(actual[i], expected[i], `${label}[${i}]`, acc, cap);
        return acc;
    }
    if (ta === 'object') {
        const a = actual;
        const e = expected;
        const ka = Object.keys(a);
        const ke = Object.keys(e);
        const child = (k) => (at ? `${at}.${k}` : k);
        for (const k of ke)
            if (!ka.includes(k) && acc.length < cap)
                acc.push(`${child(k)}: MISSING from the shipped file`);
        for (const k of ka)
            if (!ke.includes(k) && acc.length < cap)
                acc.push(`${child(k)}: present in the shipped file, not produced by the recomputation`);
        for (const k of ke) {
            if (acc.length >= cap)
                break;
            if (ka.includes(k))
                jsonDiffs(a[k], e[k], child(k), acc, cap);
        }
        return acc;
    }
    if (te === 'number' && !Number.isFinite(expected)) {
        acc.push(`${label}: the recomputation itself produced ${String(expected)} — a non-finite figure from our own engine`);
        return acc;
    }
    if (actual !== expected)
        acc.push(`${label}: ${JSON.stringify(actual)} where the recomputation gives ${JSON.stringify(expected)}`);
    return acc;
}
// ── Deal-order helpers (mirror parity.ts — the pinned, order-strict reconstruction) ──
function dealtSequence(playerHand, dealerHand) {
    const seq = [];
    if (playerHand?.[0])
        seq.push(playerHand[0]);
    if (dealerHand?.[0])
        seq.push(dealerHand[0]);
    if (playerHand?.[1])
        seq.push(playerHand[1]);
    if (dealerHand?.[1])
        seq.push(dealerHand[1]);
    for (let i = 2; i < (playerHand?.length || 0); i++)
        seq.push(playerHand[i]);
    for (let i = 2; i < (dealerHand?.length || 0); i++)
        seq.push(dealerHand[i]);
    return seq;
}
function splitDealtSequence(main, split, dealer) {
    return [main[0], dealer[0], split[0], dealer[1], main[1], split[1],
        ...split.slice(2), ...main.slice(2), ...dealer.slice(2)].filter((c) => c !== undefined);
}
/** Recompute a hand's full dealt order from its revealed seed and confirm card-for-card. */
function recomputes(b, serverSeed) {
    const shoe = (0, rng_1.blackjackShoe)(serverSeed, b.clientSeed, b.nonce);
    if (b.split) {
        const main = b.playerHands[0]?.cards || [];
        const spl = b.playerHands[1]?.cards || [];
        const d = b.dealerHand || [];
        const seq = splitDealtSequence(main, spl, d);
        return seq.length === main.length + spl.length + d.length && seq.every((c, i) => c === shoe[i]);
    }
    const seq = dealtSequence(b.playerHands[0]?.cards || [], b.dealerHand || []);
    return seq.length >= 4 && seq.every((c, i) => c === shoe[i]);
}
// `initialTwo` now lives in ./hands so Steps 15/16 use the same split-aware definition
// instead of their own `playerHands[0].cards` fallback (which is the wrong pair of cards on
// 392 of the 401 split rounds).
function run(ctx) {
    const { bets, seedMap, meta } = ctx;
    const out = [];
    // ── Step 22: Captured $10 Round Reconstruction ──────────────────────────────
    // Reconstruct the captured Phase E rounds at $10 with the same reference shoe
    // algorithm used for the $0.10 rounds. Agreement is limited to the sampled inputs;
    // this check does not test stake-dependent seed selection, selective aborts, or
    // server behavior outside the sample.
    {
        const e = ctx.phaseE;
        let chk = 0, bad = 0;
        for (const b of e) {
            const ss = seedMap.get(b.hashedServerSeed);
            if (!ss || !b.clientSeed)
                continue;
            chk++;
            if (!recomputes(b, ss))
                bad++;
        }
        const stakes = [...new Set(bets.map((b) => Number(b.playerHands[0]?.betAmount)))].sort((a, z) => a - z);
        const ok = chk === e.length && chk > 0 && bad === 0;
        out.push((0, context_1.step)(22, 'Captured $10 Round Reconstruction', ok ? 'PASS' : 'FAIL', `${chk}/${e.length} Phase E rounds at $10.00 recompute card-for-card from the revealed seed — ${bad} mismatch. ` +
            `The captured $10.00 rounds reproduce using the same reference shoe algorithm as the $0.10 rounds (stakes present: ${stakes.map((s) => `$${s}`).join(', ')}). This checks reconstruction for the sampled inputs; it does not test stake-dependent seed selection, selective aborts, or behavior outside the sample` +
            (chk === 0 ? '; COVERAGE FAIL: 0 Phase E hands recomputed' : '')));
    }
    // ── Step 23: Side-Bet Config Completeness ───────────────────────────────────
    // Every category in each paytable is actually exercised by the capture, re-derived
    // from the cards (not read from the operator's gameResult field).
    {
        const ppSeen = new Set();
        const t3Seen = new Set();
        let ppChk = 0, t3Chk = 0;
        for (const b of bets) {
            const init = (0, hands_1.initialTwo)(b);
            if (b.sideBets.perfectPair && init.length === 2) {
                ppChk++;
                const cat = (0, sidebets_1.evaluatePerfectPairs)(init[0], init[1]).category;
                if (cat !== 'NO_PAIR')
                    ppSeen.add(cat);
            }
            const up = (b.dealerHand || [])[0];
            if (b.sideBets.twentyOnePlusThree && init.length === 2 && up) {
                t3Chk++;
                const cat = (0, sidebets_1.evaluate21Plus3)(init[0], init[1], up).category;
                if (cat !== 'NO_MATCH')
                    t3Seen.add(cat);
            }
        }
        const ppExpected = Object.keys(config_1.PERFECT_PAIRS);
        const t3Expected = Object.keys(config_1.TWENTY_ONE_PLUS_THREE);
        const ppComplete = ppExpected.every((c) => ppSeen.has(c));
        const t3Complete = t3Expected.every((c) => t3Seen.has(c));
        const ok = ppChk > 0 && t3Chk > 0 && ppComplete && t3Complete;
        out.push((0, context_1.step)(23, 'Side-Bet Config Completeness', ok ? 'PASS' : 'FLAG', `Perfect Pairs: ${ppSeen.size}/${ppExpected.length} paytable categories observed across ${ppChk} bets [${[...ppSeen].join(', ')}]; ` +
            `21+3: ${t3Seen.size}/${t3Expected.length} observed across ${t3Chk} bets [${[...t3Seen].join(', ')}]` +
            (ppChk === 0 || t3Chk === 0 ? '; COVERAGE FAIL: a side bet has no records' : '')));
    }
    // ── Step 24: Phase Coverage & Labels ────────────────────────────────────────
    // Every phase the capture plan declares is present, and its bet count matches the
    // declared size — the phase labels are not decorative.
    //
    // The phase table alone is self-referential: `meta.phases` lives in the file being scored,
    // so deleting 50 rounds and decrementing `meta.phases.F.hands` by 50 satisfied every
    // comparison here. The declared table must therefore also SUM to EXPECTED_HANDS, which is
    // in src/config.ts and does not move when the data does. This is the second half of the
    // reviewers' epoch-deletion counterexample; the first half is Steps 1/3/5/6.
    {
        const declared = meta.phases || {};
        const observed = {};
        for (const b of bets)
            observed[b.phase] = (observed[b.phase] || 0) + 1;
        const rows = [];
        let bad = 0;
        let declaredTotal = 0;
        for (const [ph, cfg] of Object.entries(declared)) {
            const want = cfg.hands;
            const got = observed[ph] || 0;
            declaredTotal += Number(want) || 0;
            rows.push(`${ph}:${got}/${want}`);
            if (got !== want)
                bad++;
        }
        const observedTotal = Object.values(observed).reduce((s, n) => s + n, 0);
        const undeclared = Object.keys(observed).filter((p) => !(p in declared));
        const totalsOk = declaredTotal === config_1.EXPECTED_HANDS && observedTotal === config_1.EXPECTED_HANDS;
        const ok = rows.length > 0 && bad === 0 && undeclared.length === 0 && totalsOk;
        out.push((0, context_1.step)(24, 'Phase Coverage & Labels', ok ? 'PASS' : 'FAIL', `${Object.keys(declared).length} declared phases, all present with matching counts (${rows.join(', ')}); ` +
            `declared total ${declaredTotal} and observed total ${observedTotal} both equal the ${config_1.EXPECTED_HANDS} rounds the capture plan declares in src/config.ts` +
            (bad ? `; ${bad} count mismatch` : '') +
            (undeclared.length ? `; undeclared phase(s): ${undeclared.join(', ')}` : '') +
            (totalsOk ? '' : `; POPULATION FAIL: declared ${declaredTotal}, observed ${observedTotal}, plan ${config_1.EXPECTED_HANDS} — the phase table has been restated to agree with a different population`) +
            (rows.length === 0 ? '; COVERAGE FAIL: no declared phases' : '')));
    }
    // ── Step 25: Artifact Hash Integrity ────────────────────────────────────────
    // Was "Dataset Hash Integrity" and covered ONE of the pinned artifacts. Two changes,
    // for two different defects a reviewer executed.
    //
    // (1) PRESENCE. `tests/verify.ts` guarded the three output artifacts inside
    //     `if (fs.existsSync(...))`, so DELETING outputs/exact-rtp.json and
    //     outputs/rtp-convergence.html produced 31/31 · PROVABLY FAIR — Full Pass · exit 0.
    //     An artifact that is pinned is load-bearing by definition: its absence is a FAIL, not
    //     a silent skip. (We had hardened exactly this for simulation-results.json — missing →
    //     Steps 17-19 FLAG — and not for its two siblings. Same class, three artifacts, one
    //     of them fixed. The same shape was found in mines and plinko in the same round.)
    //
    // (2) SCORED, NOT FAIL-FAST. verify.ts used to `process.exit(1)` on a pin mismatch before
    //     any step printed. That is a real guard, but it makes an artifact forgery indis-
    //     tinguishable from a crash to anything reading the run: `gate-forgery.sh` scored its
    //     own artifact-substitution probes as NOT RUN rather than CAUGHT, because a run that
    //     dies before a scored step never emits a verdict. The pins are now reconciled INSIDE
    //     this scored step (the shape LIQD dice adopted for its own Step 19), so a substituted
    //     or deleted artifact produces `[FAIL] Step 25` and a NOT PROVABLY FAIR verdict that a gate,
    //     a CI job or a reader can actually see.
    //
    // (3) RE-DERIVED, NOT PINNED: outputs/report-figures.json. Added 2026-09-09 to source the
    //     report's prose figures, and bound to nothing — so the framework's forged-artifact battery
    //     emptied its populations (F1), duplicated its rows (F2), shrank them with the header made
    //     consistent (F3), set every rtp/edge field to 0.5 (F4) and deleted the file outright (F11),
    //     and every one of those runs returned 31/31 · PROVABLY FAIR — Full Pass. That is the same
    //     class as (1) and (2), one level further out: a new emission is created to give figures a
    //     producing artifact, and no scored step re-derives it. Mines closed it for
    //     audit-figures.json, dice for its own report-figures.json, plinko for calibration-results /
    //     coverage-results / verification-stats. This is blackjack's.
    //
    //     A HASH PIN WOULD BE THE WRONG INSTRUMENT here, which is why this file is handled below
    //     instead of joining the six above. The file is rewritten by every `npm run verify` (at the
    //     end of tests/verify.ts, after the steps have run), so a pin would either be enforced
    //     against a file the same command is about to replace, or would have to be re-pinned on
    //     every run — a pin the auditor updates on every run proves nothing. The stronger check is
    //     available and cheap: RECOMPUTE the figures from the pinned dataset and the exact engines
    //     through `buildReportFiguresArtifact()` — the same builder verify.ts writes with — and
    //     compare the result field for field against the copy on disk.
    //
    //     WHY ABSENCE MUST FAIL. Checked, not assumed, in the three places dice settled the same
    //     question: `.gitignore` un-ignores it explicitly (`!outputs/report-figures.json`),
    //     `evidence.md` carries it as evidence item **E21**, and the report cites it by name as the
    //     trace for published figures (MANIFEST.md §Artifacts, reproducibility.md). It is an artifact
    //     of record, not a run product, so its absence means the shipped copy of the report's derived
    //     figures is gone and nobody can check the published numbers against the file that produced
    //     them. Regenerating it silently — which is what an unguarded run does — would prove only
    //     that the figures are a deterministic function of the pinned dataset, which a repo with a
    //     genuine missing-artifact defect satisfies just as well. CONSEQUENCE, stated so it is not a
    //     surprise: outputs/report-figures.json MUST be committed; a clone that does not carry it
    //     fails Step 25 on its first run, by design.
    //
    //     WHAT THIS DOES NOT PROVE, stated plainly. Recomputing an artifact inside the same process
    //     that would otherwise write it establishes that the published figures are a deterministic
    //     function of the pinned dataset and the committed engines — real, and enough to reject every
    //     forgery above. It does NOT establish that the shipped file was independently produced: an
    //     auditor who changes the builder and re-runs gets agreement again. That is what the external
    //     anchors are for (the Wizard of Odds 8-deck comparison in tests/blackjack/wooAnchorTests.ts
    //     and the exact-RTP artifact's own field-by-field re-derivation), not this step.
    //
    // The dataset pin keeps its fail-fast guard in src/loader.ts as well — scoring the wrong
    // data at all is not something to do and then report on — so for the dataset this step is
    // a second, visible statement of a check that already ran.
    {
        const simFresh = process.env.SIM_FRESH === '1';
        const sha256 = (p) => (0, crypto_1.createHash)('sha256').update(fs.readFileSync(p)).digest('hex');
        const rows = [];
        const problems = [];
        const pinned = [
            { name: 'data/blackjack-6000hands.json', file: loader_1.DATA_PATH, pin: config_1.DATASET_SHA256, fresh: false },
            { name: 'outputs/simulation-results.json', file: path.join(ctx.outputsDir, 'simulation-results.json'), pin: config_1.SIMULATION_SHA256, fresh: true },
            { name: 'outputs/rtp-convergence.html', file: path.join(ctx.outputsDir, 'rtp-convergence.html'), pin: config_1.SIMULATION_HTML_SHA256, fresh: true },
            { name: 'outputs/exact-rtp.json', file: path.join(ctx.outputsDir, 'exact-rtp.json'), pin: config_1.EXACT_RTP_SHA256, fresh: false },
            { name: 'outputs/cherry-pick-attack.json', file: path.join(ctx.outputsDir, 'cherry-pick-attack.json'), pin: config_1.ATTACK_SHA256, fresh: false },
            { name: 'outputs/rng-branch-coverage.json', file: path.join(ctx.outputsDir, 'rng-branch-coverage.json'), pin: config_1.RNG_BRANCH_SHA256, fresh: false },
        ];
        for (const a of pinned) {
            if (!fs.existsSync(a.file)) {
                problems.push(`${a.name} is MISSING — a pinned artifact is load-bearing; its absence cannot score as a pass`);
                rows.push(`${a.name}: ABSENT`);
                continue;
            }
            const actual = sha256(a.file);
            if (actual === a.pin) {
                rows.push(`${a.name}: ${actual.slice(0, 12)}… matches`);
                continue;
            }
            if (a.fresh && simFresh) {
                rows.push(`${a.name}: ${actual.slice(0, 12)}… FRESH RUN (SIM_FRESH=1, pin not enforced — re-pin in src/config.ts to publish)`);
                continue;
            }
            const label = a.name === 'outputs/exact-rtp.json' ? 'Exact-RTP artifact hash mismatch' : `${a.name} hash mismatch`;
            problems.push(`${label} — expected ${a.pin}, got ${actual}`);
            rows.push(`${a.name}: ${actual.slice(0, 12)}… ≠ pinned ${a.pin.slice(0, 12)}…`);
        }
        // ── outputs/report-figures.json — re-derived, field for field ─────────────
        // Four outcomes, deliberately distinct:
        //   • the file is ABSENT                      → FAIL (see the note above);
        //   • the recomputation THROWS                → FAIL — the artifact of record cannot be
        //     re-derived at all, so nothing certifies the published figures. `units()` throws on an
        //     amount off the 1e-8 settlement grid and the natural-blackjack branch throws on a credit
        //     that is neither 2.5x nor 1x, so this arm fires on a doctored dataset as well;
        //   • any field DISAGREES with the recomputation → FAIL, with the differing paths named;
        //   • agreement, header included               → PASS.
        //
        // The provenance label `datasetSha256` is compared with everything else rather than being
        // treated as a licence to skip the comparison. Reading it first and calling a mismatch "stale,
        // regenerated by this run" is a bypass: set it to anything and the body is never checked. If
        // this repo is ever re-captured, the first `npm run verify` after the re-pin FAILs this arm and
        // writes the new file, and the second passes — the same one-run lag the absence rule carries.
        const rfPath = path.join(ctx.outputsDir, 'report-figures.json');
        let rfRow;
        if (!fs.existsSync(rfPath)) {
            problems.push('outputs/report-figures.json is MISSING — the artifact of record for the report\'s '
                + 'derived figures (evidence E21) is absent, so the published numbers cannot be checked against '
                + 'the file that produced them; regenerating it here would show only that they are a '
                + 'deterministic function of the pinned dataset');
            rfRow = 'outputs/report-figures.json: ABSENT';
        }
        else {
            let stored;
            let parseErr = '';
            try {
                stored = JSON.parse(fs.readFileSync(rfPath, 'utf8'));
            }
            catch (err) {
                parseErr = err instanceof Error ? err.message : String(err);
            }
            let fresh;
            let freshErr = '';
            try {
                fresh = (0, report_figures_1.buildReportFiguresArtifact)({ meta: ctx.meta, seeds: ctx.seeds, bets: ctx.bets });
            }
            catch (err) {
                freshErr = err instanceof Error ? err.message : String(err);
            }
            if (parseErr) {
                problems.push(`outputs/report-figures.json does not parse as JSON (${parseErr})`);
                rfRow = 'outputs/report-figures.json: UNPARSEABLE';
            }
            else if (freshErr) {
                problems.push(`outputs/report-figures.json could NOT be re-derived — the recomputation threw: ${freshErr}`);
                rfRow = 'outputs/report-figures.json: RECOMPUTATION FAILED';
            }
            else {
                const diffs = jsonDiffs(stored, JSON.parse(JSON.stringify(fresh)));
                const fields = Object.keys(fresh).length;
                if (diffs.length === 0) {
                    rfRow = `outputs/report-figures.json: re-derived from the pinned dataset and reconciles field for field (${fields} top-level fields, incl. ${stored.workedExamples?.length ?? 0} worked examples)`;
                }
                else {
                    problems.push(`outputs/report-figures.json DISAGREES with a fresh recomputation from the pinned dataset — ${diffs.join(' | ')}`);
                    rfRow = `outputs/report-figures.json: ${diffs.length} field(s) differ from the recomputation`;
                }
            }
        }
        rows.push(rfRow);
        out.push((0, context_1.step)(25, 'Artifact Hash Integrity', problems.length === 0 ? 'PASS' : 'FAIL', `${pinned.length} pinned artifacts, present and matching their SHA-256 pins in src/config.ts, ` +
            `plus outputs/report-figures.json RE-DERIVED field for field (it is rewritten by every run, so a hash pin ` +
            `would be enforced against a file the same command replaces; recomputation proves the published figures are a ` +
            `deterministic function of the pinned dataset and the committed engines — NOT that the shipped file was ` +
            `independently produced, which is what the Wizard of Odds anchor is for) — ${rows.join('; ')}` +
            (problems.length ? `; INTEGRITY FAIL: ${problems.join(' | ')}` : '')));
    }
    // ── Step 26: Phase D Client-Seed Variation ──────────────────────────────────
    // Phase D uses auditor-chosen client seeds. Assert they are genuinely custom (>1
    // distinct), that every Phase D hand still recomputes, and that the auditor seed
    // changes the deal (a canonical baseline seed yields a different first card).
    {
        const d = ctx.phaseD;
        const seeds = new Set();
        let chk = 0, bad = 0, changed = 0;
        for (const b of d) {
            const ss = seedMap.get(b.hashedServerSeed);
            if (!ss || !b.clientSeed)
                continue;
            chk++;
            seeds.add(b.clientSeed);
            if (!recomputes(b, ss))
                bad++;
            const base = (0, rng_1.blackjackShoe)(ss, 'baseline-default-seed', b.nonce);
            if (base[0] !== (b.playerHands[0]?.cards || [])[0])
                changed++;
        }
        const ok = chk === d.length && chk > 0 && bad === 0 && seeds.size > 1;
        out.push((0, context_1.step)(26, 'Phase D Client-Seed Variation', ok ? 'PASS' : 'FLAG', `${chk}/${d.length} Phase D hands recompute under ${seeds.size} distinct auditor client seeds — ${bad} mismatch; ` +
            `${changed}/${chk} deal a different first card under a canonical baseline seed (client seed genuinely feeds the derivation)` +
            (chk === 0 ? '; COVERAGE FAIL: 0 Phase D hands' : seeds.size <= 1 ? '; FLAG: only one distinct client seed' : '')));
    }
    // ── Step 27: Split Rules Verification ───────────────────────────────────────
    // Value-based split (the two split cards share a blackjack value), split aces draw
    // exactly one card each, and no re-split (never more than two player hands).
    {
        const sp = bets.filter((b) => b.split);
        let valBad = 0, aceSplits = 0, aceBad = 0, resplit = 0;
        for (const b of sp) {
            const a = b.playerHands[0]?.cards[0];
            const c = b.playerHands[1]?.cards[0];
            if (a && c && (0, config_1.cardValueFromRank)((0, config_1.rankOf)(a)) !== (0, config_1.cardValueFromRank)((0, config_1.rankOf)(c)))
                valBad++;
            if (a && (0, config_1.rankOf)(a) === 1) {
                aceSplits++;
                if (b.playerHands[0]?.cards.length !== 2 || b.playerHands[1]?.cards.length !== 2)
                    aceBad++;
            }
            if (b.playerHands.length > 2)
                resplit++;
        }
        const ok = sp.length > 0 && valBad === 0 && aceBad === 0 && resplit === 0;
        // DETAIL-STRING WORDING (S-DETAIL). `outputs/verification-results.json` is published prose:
        // it ships to the client and gets quoted back. This string used to end "(re-split is off)",
        // the one assertive phrasing of a rule that EVERY chapter marks ASSUMED — no third hand ever
        // appears in the capture, which shows re-split was never TAKEN, not that it was unavailable.
        // No chapter-level prose check reads this file, so the contradiction sat inside the artifact.
        out.push((0, context_1.step)(27, 'Split Rules Verification', ok ? 'PASS' : 'FAIL', `${sp.length} split rounds: ${valBad} value-mismatched pairs (value-based split rule), ` +
            `${aceSplits} ace splits — ${aceBad} that did not draw exactly one card each (splitAcesOneCard), ` +
            `${resplit} rounds with >2 player hands. No re-split was observed; availability was not probed, ` +
            `so "no re-split" is ASSUMED of the rule set rather than demonstrated` +
            (sp.length === 0 ? '; COVERAGE FAIL: no split rounds' : '')));
    }
    // ── Step 28: Insurance Offer Condition ──────────────────────────────────────
    // Every insurance decision (taken or declined) occurs only when the dealer's
    // upcard is an Ace — insurance is never offered otherwise.
    {
        const ins = bets.filter((b) => b.sideBets.insurance);
        let offAce = 0;
        for (const b of ins)
            if ((0, config_1.rankOf)((b.dealerHand || [])[0] || 'X:0') !== 1)
                offAce++;
        const ok = ins.length > 0 && offAce === 0;
        out.push((0, context_1.step)(28, 'Insurance Offer Condition', ok ? 'PASS' : 'FAIL', `${ins.length} insurance decisions, all on a dealer Ace upcard — ${offAce} on a non-Ace upcard` +
            (ins.length === 0 ? '; COVERAGE FAIL: no insurance decisions' : '')));
    }
    // ── Step 29: Side-Bet Deal-Time Invariance ──────────────────────────────────
    // Each side bet's recorded card snapshot equals the player's initial two cards, so
    // the side-bet result is fixed at the deal and cannot mutate as the hand plays out.
    {
        let chk = 0, bad = 0;
        const fails = [];
        for (const b of bets) {
            const init = (0, hands_1.initialTwo)(b);
            if (init.length !== 2)
                continue;
            for (const k of ['perfectPair', 'twentyOnePlusThree']) {
                const sb = b.sideBets[k];
                if (!sb?.playerHand)
                    continue;
                chk++;
                if (sb.playerHand[0] !== init[0] || sb.playerHand[1] !== init[1]) {
                    bad++;
                    if (fails.length < 4)
                        fails.push(`nonce ${b.nonce} ${k}`);
                }
            }
        }
        // COVERAGE: `chk > 0` alone let this PASS on 2 snapshots out of 11,600. Expected is
        // derived from each round's independent `sideFunded` declaration, so a shrunken
        // denominator fails instead of reading as a clean pass.
        let expected = 0;
        for (const b of bets) {
            if ((0, hands_1.initialTwo)(b).length !== 2)
                continue;
            for (const k of ['perfectPair', 'twentyOnePlusThree'])
                if (b.sideFunded?.[k])
                    expected++;
        }
        const coverageOk = expected > 0 && chk === expected;
        const ok = chk > 0 && bad === 0 && coverageOk;
        out.push((0, context_1.step)(29, 'Side-Bet Deal-Time Invariance', ok ? 'PASS' : 'FAIL', `${chk}/${expected} side-bet card snapshots (Perfect Pairs + 21+3) all equal the player's initial two dealt cards — ${bad} mismatch` +
            (fails.length ? `; e.g. ${fails.join(', ')}` : '') +
            (chk === 0 ? '; COVERAGE FAIL: no side-bet snapshots'
                : coverageOk ? '' : `; COVERAGE FAIL: ${expected} funded side-bet snapshot(s) declared but only ${chk} verified`)));
    }
    // ── Step 30: Deck-Model Confirmation (finite 8-deck) ────────────────────────
    // The shoe is a finite 8-deck: exact-duplicate cards appear within single rounds
    // (refuting a single-deck model) and no exact card exceeds the 8-copy bound.
    {
        let dupRounds = 0, maxCopies = 0;
        for (const b of bets) {
            const seq = [...b.playerHands.flatMap((h) => h.cards), ...(b.dealerHand || [])];
            const m = new Map();
            for (const c of seq)
                m.set(c, (m.get(c) || 0) + 1);
            const mx = Math.max(0, ...m.values());
            if (mx > 1)
                dupRounds++;
            if (mx > maxCopies)
                maxCopies = mx;
        }
        const bound = config_1.DECKS; // ≤ 8 copies of any exact card exist in the shoe
        const ok = bets.length > 0 && dupRounds > 0 && maxCopies <= bound;
        out.push((0, context_1.step)(30, 'Deck-Model Confirmation', ok ? 'PASS' : 'FLAG', `${dupRounds}/${bets.length} rounds contain an exact-duplicate card (refutes single-deck); ` +
            `max copies of any exact card within a round = ${maxCopies} (within the ${bound}-deck bound)` +
            (dupRounds === 0 ? '; FLAG: no duplicates observed' : maxCopies > bound ? `; FLAG: ${maxCopies} exceeds ${bound}-copy bound` : '')));
    }
    // ── Step 31: Stake Bracket Bounds ───────────────────────────────────────────
    // Every observed stake is one of the brackets the capture plan declares — no bet
    // slipped outside the intended stake set.
    {
        const declaredAmts = new Set(Object.values(meta.phases || {}).map((p) => Number(p.amount)).filter((n) => Number.isFinite(n)));
        const observed = [...new Set(bets.map((b) => Number(b.playerHands[0]?.betAmount)))].sort((a, z) => a - z);
        const outside = observed.filter((s) => !declaredAmts.has(s));
        const ok = observed.length > 0 && outside.length === 0 && declaredAmts.size > 0;
        out.push((0, context_1.step)(31, 'Stake Bracket Bounds', ok ? 'PASS' : 'FAIL', `observed stakes ${observed.map((s) => `$${s}`).join(', ')} — all within the declared brackets ${[...declaredAmts].sort((a, z) => a - z).map((s) => `$${s}`).join(', ')}` +
            (outside.length ? `; outside declared: ${outside.map((s) => `$${s}`).join(', ')}` : '') +
            (declaredAmts.size === 0 ? '; COVERAGE FAIL: no declared stake brackets' : '')));
    }
    return out;
}

  },
  "tests/verify.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * LIQD Blackjack — Verification suite
 * Run: npm run verify
 *
 * Loads the captured master dataset (SHA-256 guarded), runs all scored steps, and
 * emits outputs/verification-results.json.
 *
 * Blackjack is rule-driven, not table-driven — there is no external multiplier config
 * to pin; artifactHashes contains the dataset and (when present) the simulation output.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const loader_1 = require("../src/loader");
const config_1 = require("../src/config");
const report_figures_1 = require("../src/report-figures");
const commitment = __importStar(require("./steps/commitment"));
const parity = __importStar(require("./steps/parity"));
const payouts = __importStar(require("./steps/payouts"));
const rules = __importStar(require("./steps/rules"));
const sidebets = __importStar(require("./steps/sidebets"));
const simulation = __importStar(require("./steps/simulation"));
const houseedge = __importStar(require("./steps/houseedge"));
const standardization = __importStar(require("./steps/standardization"));
const OUTPUTS_DIR = path.join(__dirname, '../outputs');
console.log('\n══════════════════════════════════════════════════════════');
console.log('  LIQD BLACKJACK — VERIFICATION SUITE');
console.log('══════════════════════════════════════════════════════════\n');
const ds = (0, loader_1.loadDataset)();
const bets = ds.bets;
const seeds = ds.seeds;
// seedMap: hashedServerSeed → revealed serverSeed; seedByHash: → the Seed record
const seedMap = new Map();
const seedByHash = new Map();
for (const s of seeds) {
    seedByHash.set(s.hashedServerSeed, s);
    if (s.serverSeed)
        seedMap.set(s.hashedServerSeed, s.serverSeed);
}
// Ensure every bet carries its epoch client seed (fill from the Seed record if absent).
for (const b of bets) {
    if (!b.clientSeed)
        b.clientSeed = seedByHash.get(b.hashedServerSeed)?.clientSeed;
}
const byHash = new Map();
for (const b of bets) {
    const arr = byHash.get(b.hashedServerSeed) ?? [];
    arr.push(b);
    byHash.set(b.hashedServerSeed, arr);
}
const ctx = {
    bets, seeds, seedMap, seedByHash, byHash, meta: ds.meta,
    phaseA: bets.filter((b) => b.phase === 'A'),
    phaseB: bets.filter((b) => b.phase === 'B'),
    phaseC: bets.filter((b) => b.phase === 'C'),
    phaseD: bets.filter((b) => b.phase === 'D'),
    phaseE: bets.filter((b) => b.phase === 'E'),
    phaseF: bets.filter((b) => b.phase === 'F'),
    outputsDir: OUTPUTS_DIR,
};
const results = [];
const info = [];
results.push(...commitment.run(ctx));
results.push(...parity.run(ctx));
results.push(...payouts.run(ctx));
results.push(...rules.run(ctx));
results.push(...sidebets.run(ctx));
// ── Artifact pins: RECORDED here, SCORED in Step 25 ────────────────────────────
//
// The output artifacts (simulation json, its twin convergence chart, the exact-RTP solve, the
// cherry-pick attack measurement and the RNG branch-coverage replay) are hash-pinned in
// src/config.ts. Until 2026-09-09 the pins were enforced HERE, by
// printing an error and calling process.exit(1) before a single step printed.
//
// That is a real guard and it did stop substituted artifacts — but it made a forgery
// indistinguishable from a crash to anything reading the run. `audit-framework/checks/
// gate-forgery.sh` scores a run that dies before reaching a scored step as NOT RUN, never as
// CAUGHT, because there is no verdict to read; so our own forged-artifact battery reported
// "not run" against probes this repo was in fact rejecting. Worse, each pin sat inside
// `if (fs.existsSync(...))`, so DELETING the artifact skipped the guard entirely and produced
// 31/31 · PROVABLY FAIR — Full Pass · exit 0.
//
// Both defects have one fix: reconcile the pins inside a SCORED step. Step 25 (Artifact Hash
// Integrity, tests/steps/standardization.ts) now asserts presence AND hash for all six pinned
// artifacts and hard-FAILs on either, which produces a visible `[FAIL] Step 25`, a
// NOT PROVABLY FAIR verdict and exit 1 — a result a gate, a CI job or a reader can act on.
// (LIQD dice made the same move for the same reason.) This block only computes the hashes for
// the artifactHashes record below.
//
// The DATASET pin keeps its fail-fast guard in src/loader.ts: scoring the wrong data at all is
// not something to do and then report on. Step 25 states it a second time, visibly.
const simPath = path.join(OUTPUTS_DIR, 'simulation-results.json');
const htmlPath = path.join(OUTPUTS_DIR, 'rtp-convergence.html');
const exactRtpPath = path.join(OUTPUTS_DIR, 'exact-rtp.json');
const attackPath = path.join(OUTPUTS_DIR, 'cherry-pick-attack.json');
const branchPath = path.join(OUTPUTS_DIR, 'rng-branch-coverage.json');
const simFresh = process.env.SIM_FRESH === '1';
const hashIfPresent = (p) => fs.existsSync(p) ? (0, crypto_1.createHash)('sha256').update(fs.readFileSync(p)).digest('hex') : undefined;
const simArtifactHash = hashIfPresent(simPath);
const simHtmlHash = hashIfPresent(htmlPath);
const exactRtpHash = hashIfPresent(exactRtpPath);
const attackHash = hashIfPresent(attackPath);
const branchHash = hashIfPresent(branchPath);
if (simFresh) {
    console.log(`  Simulation artifact: FRESH run (SIM_FRESH=1) — sha256 ${simArtifactHash ?? 'ABSENT'}`);
    console.log(`  Convergence chart:   FRESH run (SIM_FRESH=1) — sha256 ${simHtmlHash ?? 'ABSENT'}`);
    console.log('    pins NOT enforced for these two; re-pin SIMULATION_SHA256 / SIMULATION_HTML_SHA256 in src/config.ts to publish this run\n');
}
{
    const { scored, info: si } = simulation.run(ctx);
    results.push(...scored);
    info.push(...si);
}
results.push(...houseedge.run(ctx));
results.push(...standardization.run(ctx));
// ── Summary ──────────────────────────────────────────────────────────────────
const passed = results.filter((r) => r.status === 'PASS').length;
const flags = results.filter((r) => r.status === 'FLAG').length;
const failed = results.filter((r) => r.status === 'FAIL').length;
console.log('\n──────────────────────────────────────────────────────────');
if (info.length) {
    console.log('  Informational (not scored):');
    for (const it of info)
        console.log(`    • ${it.label}: ${it.detail}`);
    console.log('');
}
const verdict = failed > 0 ? 'NOT PROVABLY FAIR' : flags > 0 ? 'PROVABLY FAIR — Conditional Pass' : 'PROVABLY FAIR — Full Pass';
console.log(`  Passed: ${passed}/${results.length}${flags ? `  (${flags} flag)` : ''}${failed ? `  (${failed} FAIL)` : ''}`);
console.log(`  Verdict: ${verdict}`);
console.log('══════════════════════════════════════════════════════════\n');
// artifact hashes
const artifactHashes = { dataset: (0, loader_1.datasetHash)() };
if (simArtifactHash) {
    artifactHashes['simulation'] = simArtifactHash;
    artifactHashes['simulationPinned'] = config_1.SIMULATION_SHA256;
    artifactHashes['simulationFreshRun'] = String(simFresh);
}
if (simHtmlHash) {
    artifactHashes['simulationHtml'] = simHtmlHash;
    artifactHashes['simulationHtmlPinned'] = config_1.SIMULATION_HTML_SHA256;
}
if (exactRtpHash) {
    artifactHashes['exactRtp'] = exactRtpHash;
    artifactHashes['exactRtpPinned'] = config_1.EXACT_RTP_SHA256;
}
if (attackHash) {
    artifactHashes['cherryPickAttack'] = attackHash;
    artifactHashes['cherryPickAttackPinned'] = config_1.ATTACK_SHA256;
}
if (branchHash) {
    artifactHashes['rngBranchCoverage'] = branchHash;
    artifactHashes['rngBranchCoveragePinned'] = config_1.RNG_BRANCH_SHA256;
}
fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
fs.writeFileSync(path.join(OUTPUTS_DIR, 'verification-results.json'), JSON.stringify({ audit: 'LIQD Blackjack', datasetSha256: config_1.DATASET_SHA256, artifactHashes, verdict, passed, total: results.length, flags, failed, results, info }, null, 2));
// Derived report figures — the numbers chapters quote that are neither a step verdict nor a leaf
// of a pinned artifact (the live money-path reconciliation, the insurance sub-ledger, the natural
// frequency, the exact side-bet edges, the infinite-deck TD comparison). Emitted so every prose
// figure has a producing artifact instead of living only in a sentence.
//
// WRITTEN HERE, SCORED IN STEP 25. The write happens AFTER the steps have run, so Step 25 reads
// the copy that was shipped with the repo, re-derives it through the SAME builder used below, and
// fails on absence or on any field that disagrees. Until 2026-09-09 nothing re-derived it: the
// framework's forged-artifact battery emptied this file, duplicated its rows, shrank it, set every
// rtp/edge field to 0.5 and deleted it outright, and the suite still printed 31/31 · PROVABLY FAIR
// — Full Pass (gate-forgery F1–F4, F11). The file is an artifact of record — `.gitignore` un-ignores
// it, `evidence.md` carries it as E21, and the chapters cite it by name — so an unbound emission is
// exactly the shape a reviewer deletes to see whether anything notices.
//
// STILL FENCED. This emitter runs in the same process as the scored suite, so a throw in here (e.g.
// `units()` refusing an off-grid amount planted by a mutation) must never turn a scored FAIL into a
// crash, or a scored PASS into a non-zero exit. The verdict and the exit code above are decided by
// the steps alone — including Step 25, which does its own recomputation and records the same throw
// as a scored FAIL rather than as a silent gap.
try {
    fs.writeFileSync(path.join(OUTPUTS_DIR, 'report-figures.json'), JSON.stringify((0, report_figures_1.buildReportFiguresArtifact)(ds), null, 2));
}
catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  (report-figures.json NOT emitted: ${message} — see Step 25, which scores the same recomputation)`);
    fs.writeFileSync(path.join(OUTPUTS_DIR, 'report-figures.json'), JSON.stringify({
        audit: report_figures_1.REPORT_FIGURES_HEADER.audit,
        what: 'Figures cited in the report chapters. NOT PRODUCED on this run.',
        datasetSha256: config_1.DATASET_SHA256,
        error: message,
    }, null, 2));
}
// Exit status encodes the verdict for CI / pre-publish hooks / anyone reading $?:
//   0 = Full Pass   ·   2 = Conditional Pass (one or more FLAG steps)   ·   1 = FAIL.
// A FLAG previously exited 0, so a 5σ RTP miss or a doctored χ² printed "Conditional Pass" and
// still returned success. See README (Reproducibility) for the code table.
if (failed > 0)
    process.exit(1);
if (flags > 0)
    process.exit(2);

  },
};
var __cache = {};

function __flatten(from, spec) {
  var base = from ? from.split('/').slice(0, -1).join('/') : '';
  var parts = (base ? base + '/' + spec : spec).split('/');
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (p === '' || p === '.') continue;
    if (p === '..') { out.pop(); continue; }
    out.push(p);
  }
  return out.join('/');
}

function __resolve(from, spec) {
  var joined = __flatten(from, spec);
  var candidates = [joined, joined + '.js', joined + '.json', joined + '/index.js'];
  for (var c = 0; c < candidates.length; c++) {
    if (Object.prototype.hasOwnProperty.call(__modules, candidates[c])) return candidates[c];
  }
  return null;
}

function __require(from, spec) {
  if (!spec.startsWith('.')) return __nodeRequire(spec);
  var id = __resolve(from, spec);
  if (!id) {
    // Not TypeScript, so tsc never emitted it — a .mjs/.cjs/.json asset the package SHIPS, such as
    // a capture reference module. Load the real file off disk relative to the package root. The
    // bundle stays self-contained for compiled code without pretending the package has no other
    // files; if the asset is genuinely missing, the error names it rather than hiding it.
    var abs = __PF_ROOT__ + '/' + __flatten(from, spec);
    try { return __nodeRequire(abs); } catch (e) {
      throw new Error('standalone verifier: unresolved module "' + spec + '" from "' + from + '" (' + e.message + ')');
    }
  }
  if (__cache[id]) return __cache[id].exports;
  var module = { exports: {} };
  __cache[id] = module;
  var dir = id.split('/').slice(0, -1).join('/');
  __modules[id](
    module,
    module.exports,
    function (s) { return __require(id, s); },
    __PF_ROOT__ + '/' + id,
    dir ? __PF_ROOT__ + '/' + dir : __PF_ROOT__
  );
  return module.exports;
}

__require('', './tests/verify.js');
