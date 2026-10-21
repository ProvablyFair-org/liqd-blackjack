/**
 * LIQD Blackjack — Monte-Carlo simulation (Pass 1 + Pass 2).
 *
 * Finite 8-deck RTP consistency simulation.
 *
 * EVERY RANDOM INPUT IS RECORDED. One master seed per run, 32 random bytes, written into
 * `outputs/simulation-results.json` and `outputs/simulation-provenance.json` before anything is
 * measured; each experiment's stream is addressed beneath it by domain and index (`src/seed-derivation.ts`).
 * The pass implementations are pure functions of that seed (`src/replay.ts`), so
 * `MASTER_SEED=<hex> npm run simulate` reproduces a published run and
 * `npx ts-node src/deep-replay.ts` reproduces it and compares field by field. The Pass-1 seed
 * pair and the bootstrap random inputs are therefore retained instead of discarded; this does not
 * recover the inputs of the superseded run, which were never recorded — the
 * superseded artifact is kept, frozen, as `tests/fixtures/legacy-simulation-results.json`.
 *
 * NOTE ON SHOE SOURCE — the two passes differ, deliberately:
 *   • Pass 1 (1,000,000 rounds) deals from the REAL `blackjackShoe` algorithm (backward in-place
 *     Fisher-Yates over the HMAC-SHA256 stream), on a seed pair derived from the master seed.
 *     This is the pass that validates the shoe as a fair shuffle.
 *   • The 30,000,000-round reference pass (Pass 0, `replayPass0`) uses a fair shuffle driven by a
 *     deterministic xoshiro128** stream (`src/prng.ts`), also keyed from the master seed. It
 *     measures the RTP of the RULE SET at scale, where the shoe algorithm is not the object under
 *     test and per-card HMAC hashing would make 30M rounds impractical. It used to read
 *     `Math.random()`, whose seed the process never sees — which is what made that experiment
 *     unreplayable.
 * Both are played with complete optimal basic strategy for the
 * confirmed rule set (S17, DAS, split-aces-one-card, no-resplit, dealer peek/OBO,
 * blackjack 3:2, no surrender). This is the finite-shoe counterpart to the analytical
 * infinite-deck engine in `optimal-play.ts`; both are cross-checked against Wizard of
 * Odds for the same rule set.
 *
 * Pass 1 — one derived, recorded seed pair per run, single-stream:
 *   • baseGame RTP is emitted in BOTH conventions: per initial bet (edge = (W−R)/rounds, the
 *     standard house-edge convention, ≈0.4877% edge — matches the exact solver) and per total
 *     amount wagered (edge = (W−R)/W, the element of risk, ≈0.4324%). The
 *     two differ by the average wager per round (doubles + split stakes), so they are not
 *     interchangeable. The per-initial figure sits just above the infinite-deck 99.4296% limit.
 *   • First-card uniformity (scored): shoe[0] rank over 13 ranks, χ² vs N·32/416, df=12.
 *   • Serial independence (scored): lag-1 autocorrelation + runs test on the sequence of
 *     first-card rank values across nonces.
 *
 * Pass 2 — casino seeds from the captured dataset's revealed serverSeeds (cherry-pick), each carried
 *   to 10,000 nonces. PRIMARY (since 2026-09-24): the MONEY statistic — every nonce settled under the
 *   declared basic strategy, net summed per 50-round window; the served window (nonces 0..49) ranked
 *   against the seed's own 199 later windows, one-sided, and pooled over all seeds against the exact
 *   8-deck mean (rule: src/config.ts PASS2_MONEY_ALPHA / PASS2_FAMILY_ALPHA / PASS2_POOLED_Z).
 *   SECONDARY: early window = nonces 0..49 (real served depth per epoch); late = 50..9,999. Statistic
 *   = first-card rank uniformity χ² over the window. At n=50 the two end bins are pooled
 *   (A with 2, Q with K; df 10) because their expected count (50/13 = 3.85) is below 5, so the
 *   early-window statistic is an 11-bin χ² rather than the 13-rank test; the bootstrap null uses
 *   the identical statistic, so the comparison is valid. At n=50 with 13 ranks the analytic χ²
 *   is weak, so the early-window null is a PARAMETRIC BOOTSTRAP (fair replicates of 50
 *   first-cards). Flag if earlyBootstrapP<0.05 AND lateP≥0.05. This is a gross-RNG-bias
 *   check on the served window; the primary cherry-pick defence is the client-seed-after-
 *   commitment mitigation (the player sets the client seed, so the operator cannot
 *   precompute a favourable server seed) — see MANIFEST.md#limitations-and-trust.
 *
 * Output: outputs/simulation-results.json, outputs/rtp-convergence.html
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'node:crypto';

import { blackjackShoe } from './rng';
import { isMasterSeed, SEED_DERIVATION_VERSION, SEED_DOMAINS } from './seed-derivation';
import {
  PASS2_P0, cherryPickFlag, BOOTSTRAP_NULL_FILE, RANKS, SIM_MASTER_SEED, SIM_PASS1_ROUNDS,
  PASS2_TOTAL_NONCES, PASS2_WINDOW, PASS2_MONEY_ALPHA, PASS2_FAMILY_ALPHA, PASS2_POOLED_Z,
  PASS2_POWER_SHORTFALLS, SIM_SD_PER_ROUND, EXPECTED_SEEDS,
} from './config';
import { runWorkerIfRequested, runReplayJobs } from './replay-pool';
import type { Pass1Chunk, Pass2SeedCensus } from './replay';
import { PASS1_ROW_NONCES } from './config';
import { fieldDiff, beyondTolerance, maxima, DIFF_ATOL, DIFF_RTOL } from './diff';
import {
  replayPass0, replayBootstrapNulls, pass1Jobs, pass1Statistics, pass1RowOf, pass1SeedPair, moneyP,
  encodeNulls, sortedCopy, bootstrapP,
} from './replay';
import { chiSquaredTest, combination, binomialTailThreshold, normalCDF } from './stats';

// A replay worker (src/replay-pool.ts) is this script re-run with PF_REPLAY_WORKER=1: it runs its
// jobs and exits before anything below executes.
runWorkerIfRequested();
import { computeOptimalRTP } from './optimal-play';
import { solveExact, solveMoments } from './exact-play';

const ROUNDS = Number(process.env.ROUNDS) || SIM_PASS1_ROUNDS;  // real-shoe pass: 1,000,000 since 2026-09-24 (BLACKJACK-20 floor)
const REF_ROUNDS = Number(process.env.REF_ROUNDS) || 30_000_000; // fast fair-shuffle pass: finite 8-deck RTP consistency estimate
const PASS2_NONCES = Number(process.env.PASS2_NONCES) || PASS2_TOTAL_NONCES; // 10,000 since 2026-09-24 (BLACKJACK-21 floor)
const PASS2_EARLY = 50;
const BOOTSTRAP_REPS = Number(process.env.BOOTSTRAP_REPS) || 2_000;
const DATASET_PATH = path.join(__dirname, '..', 'data', 'blackjack-6000hands.json');

// ══════════════════════════════════════════════════════════════════════════════
//  THE RUN'S MASTER SEED — the one input everything else is derived from
//
//  Before this release the three experiments drew their randomness fresh and discarded it:
//  Pass 0 read `Math.random()`, Pass 1 took a `crypto.randomBytes` seed pair that was never
//  written down, and each of the 2,000 Pass-2 bootstrap replicates did the same. The published
//  statistics could be read but not reproduced, which for a Monte-Carlo result is a material
//  evidence gap.
//
//  Now: 32 random bytes, generated once, RECORDED in `outputs/simulation-results.json` and
//  `outputs/simulation-provenance.json`, and every stream addressed beneath it by domain and
//  index (`src/seed-derivation.ts`). `MASTER_SEED=<hex>` in the environment re-runs an exact replay of a
//  published run; omitted, a fresh seed makes this a genuinely new experiment.
//
//  WHAT THIS DOES NOT DO, said plainly: it does not recover the inputs of the superseded
//  2026-09-02 run. Those were never recorded and are gone. That artifact is retained, frozen and
//  digest-pinned, as `tests/fixtures/legacy-simulation-results.json` — a test input, not a
//  reproducible result.
// ══════════════════════════════════════════════════════════════════════════════
//
//  PINNED SINCE 2026-09-24 (BLACKJACK-20/27). The master seed of the committed run is a code
//  constant, SIM_MASTER_SEED in src/config.ts — the value the 2026-09-12 run generated and
//  recorded — so `npm run simulate` with no environment REPRODUCES the committed experiment
//  instead of drawing a new one. The run writes to outputs/run/ and compares itself field by field
//  with the committed artifacts (outputs/run/simulation-diff.json); only `PF_EMIT=1` writes the
//  committed paths. `MASTER_SEED=<hex>` still runs a different experiment, to outputs/run/, and its
//  diff then records every field it moved.
const MASTER_SEED: string = (() => {
  const supplied = process.env.MASTER_SEED;
  if (supplied === undefined || supplied === '') return SIM_MASTER_SEED;
  if (!isMasterSeed(supplied)) {
    throw new Error(`MASTER_SEED must be 16-64 bytes of lowercase hex; got ${JSON.stringify(supplied)}`);
  }
  return supplied;
})();
const PF_EMIT = process.env.PF_EMIT === '1';
console.log(`  master seed ${MASTER_SEED} (${SEED_DERIVATION_VERSION})${MASTER_SEED === SIM_MASTER_SEED ? ' — the PINNED seed of the committed run (src/config.ts SIM_MASTER_SEED)' : ' — NOT the pinned seed: a different experiment'}\n`);

// ── card helpers (cards are "SUIT:rank", rank 1=A..13=K) ─────────────────────────
const rankOf = (card: string): number => Number(card.slice(card.indexOf(':') + 1));

// The pass implementations live in `src/replay.ts` — pure functions of the master seed, with no
// import-time side effects — so the replay tooling and the scored steps run the SAME code that
// produced the artifact rather than a second copy of it. The basic-strategy table is imported by
// `src/round-engine.ts` from `src/strategy.ts`, shared verbatim with the exact solver.

// ── progress bar ─────────────────────────────────────────────────────────────────
function bar(cur: number, tot: number, label: string, t0: number, w = 30): void {
  const f = Math.min(tot > 0 ? cur / tot : 0, 1);
  const on = Math.round(f * w);
  const el = ((Date.now() - t0) / 1000).toFixed(0);
  const eta = cur > 0 ? (((Date.now() - t0) / cur) * (tot - cur) / 1000).toFixed(0) : '?';
  process.stdout.write(`\r  ${'━'.repeat(on)}${'╌'.repeat(w - on)} ${(f * 100).toFixed(0).padStart(3)}% | ${label} | ${el}s ~${eta}s left   `);
}

// ══════════════════════════════════════════════════════════════════════════════
//  PASS 0 — finite 8-deck RTP consistency estimate over a fast fair shuffle (±0.02% MC error)
// ══════════════════════════════════════════════════════════════════════════════
console.log('═'.repeat(62));
console.log('  LIQD BLACKJACK — PASS 0: finite 8-deck RTP consistency estimate (fast fair shuffle)');
console.log(`  ${REF_ROUNDS.toLocaleString()} rounds — finite 8-deck consistency estimate (±0.02% MC error)`);
console.log('═'.repeat(62) + '\n');
const ref0 = Date.now();
const reference = replayPass0(MASTER_SEED, REF_ROUNDS, (n, rtpSoFar) => bar(n, REF_ROUNDS, `RTP ${(rtpSoFar * 100).toFixed(3)}%`, ref0));
process.stdout.write('\n');
console.log(`  RTP per initial bet:   ${(reference.rtpInitial * 100).toFixed(4)}%  (edge ${(reference.edgeInitial * 100).toFixed(4)}%, ±${(reference.se * 100).toFixed(4)}% 1σ) — WoO/analytical convention`);
console.log(`  RTP per total wagered: ${(reference.rtpPerTotalWagered * 100).toFixed(4)}%  (edge ${(reference.edgePerTotalWagered * 100).toFixed(4)}%) — element of risk; avg wager/round ${reference.avgWager.toFixed(4)}`);
console.log(`  Time: ${((Date.now() - ref0) / 1000).toFixed(1)}s\n`);

// ══════════════════════════════════════════════════════════════════════════════
//  PASS 1 — real blackjackShoe algorithm: fairness validation + RTP consistency
// ══════════════════════════════════════════════════════════════════════════════
console.log('═'.repeat(62));
console.log('  LIQD BLACKJACK — PASS 1: real-shoe fairness + RTP consistency');
console.log(`  ${ROUNDS.toLocaleString()} rounds, optimal basic strategy (S17/DAS/SPA1/no-resplit/peek)`);
console.log('═'.repeat(62) + '\n');

// Pass 1 is ONE seed pair, both halves DERIVED from the run's master seed under the domains
// `pass1-shoe-server` / `pass1-shoe-client` at index 0, driving a single ROUNDS-nonce stream.
// (A valid fair-shuffle test: the shoe is re-derived independently for every nonce.) The pair is
// recorded in the artifact below — it used to be a `crypto.randomBytes` value that existed only
// inside this process, so the experiment could not be replayed.
// Since 2026-09-24 the stream is recorded as its DECLARED census rows (src/config.ts PASS1_ROW_NONCES,
// 100 rows of 10,000 nonces, each an exact integer census — src/replay.ts Pass1Row), dealt in
// parallel worker processes (src/replay-pool.ts). Every statistic is `pass1Statistics` of the rows, the
// same function scored Step 18 re-derives them with from the artifact.
const p1Start = Date.now();
const p1Seeds = pass1SeedPair(MASTER_SEED);
const p1Rows = (runReplayJobs(pass1Jobs(MASTER_SEED, ROUNDS)) as Pass1Chunk[]).map(pass1RowOf);
const pass1 = pass1Statistics(p1Seeds.serverSeed, p1Seeds.clientSeed, ROUNDS, p1Rows);

const serverSeed = pass1.serverSeed;
const clientSeed = pass1.clientSeed;
// Report the real-shoe cross-check in the SAME (per-initial-bet) convention as the reference,
// so the two are compared like-to-like.
const rtp = pass1.rtp;                             // per initial bet
const edge = pass1.edge;
const rtpPerTotalWagered = pass1.rtpPerTotalWagered; // element of risk (reported for completeness)
const rtpSE = SIM_SD_PER_ROUND / Math.sqrt(ROUNDS);   // gate constant (measured per-round SD ≈1.147, rounded up)
const playerBJs = pass1.playerBJs;
const dealerBJs = pass1.dealerBJs;

// First-card rank uniformity (df=12) and serial independence on first-card rank values.
const fd = { chi2: pass1.firstCardChi2, df: pass1.firstCardDf, pValue: pass1.firstCardPValue };
const r1 = pass1.serialR1;
const r1z = pass1.serialR1Z;
const runsZ = pass1.serialRunsZ;
const runsP = pass1.serialRunsPValue;

const analytical = computeOptimalRTP('stand', true);
// The exact 8-deck TD solve — the engine the real-shoe RTP (below) and the Pass-2 money test are
// held against (BLACKJACK-20 / -21). Deterministic; `npm run rtp` emits it of record.
const exactTD = solveExact({ kind: 'finite', decks: 8 }, 'TD');
const rtpSigmaVsExact = (rtp - exactTD.rtpPerInitialBet) / rtpSE;
// Engine-drift guard: the analytical figure anchors Step 17's consistency gate. Refuse to
// write a sim artifact if the optimal-play engine has drifted from its pinned value, so a
// broken engine cannot silently recalibrate the gate it feeds. (Guard mirrors optimalPlayTests.ts.)
if (Math.abs(analytical.rtp - 0.994296) > 0.0002) {
  throw new Error(`optimal-play engine drift: rtp ${analytical.rtp.toFixed(8)} != 0.994296 ±2e-4 — aborting simulation`);
}

console.log('');
console.log(`  Consistency-sim RTP: ${(reference.rtpInitial * 100).toFixed(4)}%  (Pass 0, ${REF_ROUNDS.toLocaleString()} rounds, ±${(reference.se * 100).toFixed(4)}% 1σ, per initial bet) — fair-shuffle estimate`);
console.log(`  Real-shoe RTP:       ${(rtp * 100).toFixed(4)}%  (edge ${(edge * 100).toFixed(4)}%, ±${(rtpSE * 100).toFixed(4)}% 1σ over ${ROUNDS.toLocaleString()}, per initial bet) — ${rtpSigmaVsExact.toFixed(2)}σ from the exact solve ${(exactTD.rtpPerInitialBet * 100).toFixed(4)}%`);
console.log(`  Analytical infinite: ${(analytical.rtp * 100).toFixed(4)}%  (edge ${(analytical.edge * 100).toFixed(4)}%, per initial bet) — finite sits above, as removal predicts`);
console.log(`  Player BJ freq:      ${(playerBJs / ROUNDS * 100).toFixed(3)}%   Dealer BJ freq: ${(dealerBJs / ROUNDS * 100).toFixed(3)}%`);
console.log(`  First-card rank χ²:  ${fd.chi2.toFixed(2)} (df ${fd.df}), p=${fd.pValue.toFixed(4)}`);
console.log(`  Serial: |r₁z|=${Math.abs(r1z).toFixed(2)}  runs p=${runsP.toFixed(4)}`);
console.log(`  Time: ${((Date.now() - p1Start) / 1000).toFixed(1)}s\n`);

// ══════════════════════════════════════════════════════════════════════════════
//  PASS 2 — casino seeds, first-card cherry-pick (bootstrap null over 0..49)
// ══════════════════════════════════════════════════════════════════════════════
console.log('═'.repeat(62));
console.log('  LIQD BLACKJACK — PASS 2: casino seeds (cherry-pick: money primary, rank screen secondary)');
console.log('═'.repeat(62) + '\n');

const ds = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8')) as {
  seeds: { epoch: number; hashedServerSeed: string; serverSeed: string | null; clientSeed: string }[];
};
const revealed = ds.seeds.filter(s => s.serverSeed);

function firstRankChi2(freq: number[], n: number) { return chiSquaredTest([...freq], new Array(RANKS).fill(n / RANKS)); }

// ── The bootstrap null, and the bytes that make it replayable ──────────────────
// Each replicate's fair seed pair is DERIVED from the master seed under the domains
// `pass2-bootstrap-server` / `pass2-bootstrap-client` at index = the replicate number, so
// replicate r is addressable on its own. The 2,000 statistics are then RETAINED, in generation
// order, as `outputs/bootstrap-nulls.float64le`.
//
// Retaining them is the point. `earlyBootstrapP` was previously documented — correctly, at the
// time — as "not reproducible by construction", because the null it was measured against had
// been drawn from fresh entropy and thrown away. It is now a function of a committed file and a
// recomputable χ², so scored Step 19 recomputes all 120 p-values from the retained bytes, and
// `replay/replay-bootstrap.py` reproduces the bytes themselves from the master seed in code that
// imports nothing from this repository.
const bootStart = Date.now();
const bootStats = replayBootstrapNulls(MASTER_SEED, BOOTSTRAP_REPS, PASS2_EARLY, (rep) => bar(rep, BOOTSTRAP_REPS, 'bootstrap null', bootStart));
bar(BOOTSTRAP_REPS, BOOTSTRAP_REPS, 'null ready', bootStart);
process.stdout.write('\n');

const COMMITTED = path.join(__dirname, '..', 'outputs');
// PF_EMIT=1 is the ONLY thing that rewrites the committed artifacts; a plain run writes outputs/run/.
const OUT = PF_EMIT ? COMMITTED : path.join(COMMITTED, 'run');
fs.mkdirSync(OUT, { recursive: true });
const nullBuf = encodeNulls(bootStats);                 // generation order, float64 little-endian
fs.writeFileSync(path.join(OUT, BOOTSTRAP_NULL_FILE), nullBuf);
const nullSHA256 = createHash('sha256').update(nullBuf).digest('hex');
// The p-value uses a SORTED COPY; the retained file keeps generation order so that replicate r
// stays addressable (see src/replay.ts, `encodeNulls`).
const sortedNulls = sortedCopy(bootStats);

interface Pass2Result {
  epoch: number; hashedServerSeed: string;
  earlyChi2: number; earlyBootstrapP: number; lateChi2: number; latePValue: number; cherryPickFlag: boolean;
  earlyNet: number; moneyP: number; moneyFlag: boolean;
  /** THE CENSUS of this seed: first-card rank counts of the two windows, and the net of every money window. */
  earlyFreq: number[]; lateFreq: number[]; windowNet2: number[];
}
const pass2Results: Pass2Result[] = [];
let cherryPickFlags = 0;
const p2Start = Date.now();
// Every revealed seed replayed over nonces 0 … PASS2_NONCES−1 in parallel worker processes
// (src/replay.ts pass2Seed — the same function scored Step 19 replays in verify).
const p2Census = runReplayJobs(revealed.map((s) => ({
  kind: 'p2' as const, epoch: s.epoch, serverSeed: s.serverSeed as string, clientSeed: s.clientSeed,
  nonces: PASS2_NONCES, early: PASS2_EARLY, window: PASS2_WINDOW,
}))) as Pass2SeedCensus[];
for (let si = 0; si < revealed.length; si++) {
  const s = revealed[si];
  const c = p2Census[si];
  const earlyChi2 = firstRankChi2(c.earlyFreq, PASS2_EARLY).chi2;
  const earlyP = bootstrapP(sortedNulls, earlyChi2);
  const lateRes = firstRankChi2(c.lateFreq, PASS2_NONCES - PASS2_EARLY);
  // ONE definition of the predicate, in src/config.ts — shared with tests/steps/simulation.ts
  // (scored Step 19) and src/cherry-pick-attack.ts, so the three cannot drift apart.
  const flag = cherryPickFlag(earlyP, lateRes.pValue);
  if (flag) cherryPickFlags++;
  const mp = moneyP(c.windowNet2);
  pass2Results.push({
    epoch: s.epoch, hashedServerSeed: s.hashedServerSeed, earlyChi2, earlyBootstrapP: earlyP,
    lateChi2: lateRes.chi2, latePValue: lateRes.pValue, cherryPickFlag: flag,
    earlyNet: c.windowNet2[0] / 2, moneyP: mp, moneyFlag: mp <= PASS2_MONEY_ALPHA,
    earlyFreq: c.earlyFreq, lateFreq: c.lateFreq, windowNet2: c.windowNet2,
  });
}

// ── The money statistic (BLACKJACK-21 primary) — the rule is src/config.ts, fixed before first run ──
const moneyFlags = pass2Results.filter((r) => r.moneyFlag).length;
const moneyGate = binomialTailThreshold(revealed.length, PASS2_MONEY_ALPHA, PASS2_FAMILY_ALPHA);
const servedRounds = revealed.length * PASS2_EARLY;
const pooledEarlyNet = pass2Results.reduce((a, r) => a + r.windowNet2[0], 0) / 2;
const pooledExpectedNet = -exactTD.edgePerInitialBet * servedRounds;
// The per-round SD is the EXACT one (BLACKJACK-21, 2026-09-25): the square root of the exact
// variance of the per-round return under the declared table (src/exact-play.ts moments(), splits
// played sequentially), no longer the measured Pass-0 SD rounded up to SIM_SD_PER_ROUND.
const exactMoments = solveMoments({ kind: 'finite', decks: 8 });
const pooledSD = exactMoments.sd * Math.sqrt(servedRounds);
const pooledZ = (pooledEarlyNet - pooledExpectedNet) / pooledSD;
const nWin = pass2Results.length ? pass2Results[0].windowNet2.length : 0;
let pooledLe = 0;
for (let w = 1; w < nWin; w++) {
  const lateW = pass2Results.reduce((a, r) => a + r.windowNet2[w], 0) / 2;
  if (lateW <= pooledEarlyNet) pooledLe++;
}
const pooledBootstrapP = (1 + pooledLe) / nWin;
const pooledPower = PASS2_POWER_SHORTFALLS.map((d) => ({
  rtpShortfall: d, detectionPower: normalCDF((d * servedRounds) / pooledSD - PASS2_POOLED_Z),
}));
const seedsTested = revealed.length;
// p₀ = α(1−α): a seed must be early-extreme AND late-quiet. Declared in src/config.ts, never
// restated as a literal here — Step 19 refuses to read this field and recomputes from the pin.
const expectedFlags = seedsTested * PASS2_P0;
function binomSurvival(k: number, n: number, p: number): number {
  let cum = 0; for (let i = 0; i < k; i++) cum += combination(n, i) * Math.pow(p, i) * Math.pow(1 - p, n - i);
  return 1 - cum;
}
const cherryPickSurvival = binomSurvival(cherryPickFlags, seedsTested, PASS2_P0);
console.log('');
console.log(`  Seeds tested: ${seedsTested} × ${PASS2_NONCES.toLocaleString()} nonces (early 0..${PASS2_EARLY - 1}, late ${PASS2_EARLY}..${PASS2_NONCES - 1})`);
console.log(`  MONEY (primary): ${moneyFlags}/${seedsTested} seeds flagged at p ≤ ${PASS2_MONEY_ALPHA} (family gate ≤ ${moneyGate}); pooled served-window net ${pooledEarlyNet} vs exact ${pooledExpectedNet.toFixed(4)}, z = ${pooledZ.toFixed(3)} (gate −${PASS2_POOLED_Z}), pooled bootstrap p = ${pooledBootstrapP}`);
console.log(`  Rank screen (secondary) flags: ${cherryPickFlags} (expected ~${expectedFlags.toFixed(1)} by chance; binomial survival P=${cherryPickSurvival.toFixed(4)})`);
console.log(`  Time: ${((Date.now() - p2Start) / 1000).toFixed(1)}s\n`);

// ── write outputs ────────────────────────────────────────────────────────────────
// (OUT was created above, before the retained bootstrap nulls were written.)

console.log('  Solving the exact 8-deck EV (CD diagnostic)...');
const exactCD = solveExact({ kind: 'finite', decks: 8 }, 'CD');

// Pinned Wizard of Odds anchor, read from the exact-rtp.json artifact of record (npm run rtp) so the
// chart cannot drift from the pinned figure. Every rule input is fixed in that file's wooAnchor block.
const wooAnchor = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'outputs', 'exact-rtp.json'), 'utf8')).wooAnchor;
const wooEdge = wooAnchor.basicStrategyContinuousShuffler as number; // 0.0048768
const wooDate = wooAnchor.capturedAt as string;
console.log(`    exact TD edge ${(exactTD.edgePerInitialBet * 100).toFixed(6)}%  CD ${(exactCD.edgePerInitialBet * 100).toFixed(6)}%  avg wager ${exactTD.avgWager.toFixed(6)}`);

const output = {
  audit: 'LIQD Blackjack',
  // ── THE RUN'S RETAINED INPUTS ────────────────────────────────────────────────
  // Everything random in this file is a function of these two values. The master seed is pinned
  // in src/config.ts (SIM_MASTER_SEED), so `npm run simulate` reproduces the run and diffs it field
  // by field against this file; `npx ts-node src/deep-replay.ts` does the same for Passes 0 and 1.
  // Each experiment's domain and index are listed in outputs/simulation-provenance.json. No run
  // metadata (timestamp, host, timing) is written: the file is an artifact of record.
  masterSeed: MASTER_SEED,
  seedDerivation: SEED_DERIVATION_VERSION,
  provenance: 'outputs/simulation-provenance.json',
  algorithm: 'HMAC-SHA256 (key = hex-decoded serverSeed); backward in-place Fisher-Yates over 416 cards; deal PDPD; optimal basic strategy S17/DAS/SPA1/no-resplit/dealer-peek; blackjack 3:2',
  baseGame: {
    // PRIMARY convention = per initial bet (matches the analytical solver, Wizard of Odds, and
    // the figure advertised to players). `rtp`/`edge` mirror the per-initial-bet fields.
    rtp: reference.rtpInitial, edge: reference.edgeInitial,
    rtpInitial: reference.rtpInitial, edgeInitial: reference.edgeInitial,
    // SECONDARY convention = per total amount wagered (element of risk). Differs from the
    // per-initial figure by the average wager per round (doubles + split stakes in the denominator).
    rtpPerTotalWagered: reference.rtpPerTotalWagered, edgePerTotalWagered: reference.edgePerTotalWagered,
    avgWager: reference.avgWager,
    rounds: REF_ROUNDS, standardError: reference.se,
    // The Pass-0 shuffle stream, named so it can be re-created. It used to be `Math.random()`,
    // whose seed the process never sees — so this pass's input was destroyed on exit and the
    // 30M-round figure could be read but never reproduced. It is now a xoshiro128** stream keyed
    // by deriveSeedHex(masterSeed, 'pass0-reference-shuffle', 0) — see src/prng.ts.
    rngStream: 'xoshiro128**', rngSeedDomain: SEED_DOMAINS.pass0Shuffle, rngSeedIndex: 0,
    // MEASURED per-round SD of the per-initial-bet loss over this run (≈1.147). The reported
    // standardError above and the 3σ gate use the constant 1.15 (this measured value, rounded up);
    // the verifier deliberately keeps its tolerance on a constant rather than a simulator-supplied SD.
    sdPerRound: reference.sdPerRound, sdPerRoundNote: 'Measured per-round SD of the per-initial-bet loss. standardError/gate use the constant 1.15 (this value rounded up).',
    // Cumulative checkpoints backing the convergence chart (per initial bet), so every plotted
    // value has a producing artifact rather than living only inside the generated HTML.
    convergence: reference.checkpoints,
    method: 'Fair-shuffle consistency simulation for the declared rules and strategy. Fresh-run estimates vary with Monte Carlo sampling error. Results use per-initial-bet and per-total-wager conventions; the verifier compares the estimates with the exact finite eight-deck model. Pass 1 separately checks first-card rank uniformity and the specified serial statistics of blackjackShoe.',
    note: 'Finite 8-deck RTP under optimal basic strategy (S17/DAS/SPA1/no-resplit/peek, blackjack 3:2). Per initial bet the finite figure sits just above the analytical infinite-deck limit, as card removal predicts.',
  },
  realShoeConsistency: {
    rtp, edge, rtpPerTotalWagered, rounds: ROUNDS, standardError: rtpSE,
    deviationSigma: Math.abs(rtp - reference.rtpInitial) / rtpSE,
    // Since 2026-09-24 (BLACKJACK-20): the real-RNG RTP against the EXACT 8-deck TD solve at the
    // stated σ = SIM_SD_PER_ROUND/√rounds; scored Step 18 recomputes it from its replay.
    exactRtpPerInitialBet: exactTD.rtpPerInitialBet, deviationSigmaVsExact: rtpSigmaVsExact,
    playerBJFreq: playerBJs / ROUNDS, dealerBJFreq: dealerBJs / ROUNDS,
    note: 'RTP (per initial bet) over the actual blackjackShoe RNG algorithm, held against the exact 8-deck TD solve at the stated σ (scored Step 18). Fewer rounds than Pass 0 (the real shoe is HMAC-hashed per card), so the Monte-Carlo error is wider; baseGame is the fair-shuffle consistency estimate.',
  },
  // The deterministic exact 8-deck EV (TD headline + CD diagnostic) is NOT embedded
  // here. It is emitted, of record, by `npm run rtp` → outputs/exact-rtp.json, which
  // regenerates byte-identically every run. Embedding a copy here is how a pre-fix
  // value once survived a full gate inside this hash-pinned artifact (the exactTD
  // block read a pre-fix edge labelled "Exact" long after the engine was corrected to
  // `0.487675%`). One source of truth for the exact figures; this file carries only
  // the Monte-Carlo sanity harness and the infinite-deck regression anchor.
  exactFiguresSource:
    'outputs/exact-rtp.json (regenerate with `npm run rtp`) — deterministic exact 8-deck ' +
    'EV of record: finite-8 TD headline (anchored to the tiny-shoe oracle + Wizard of Odds), ' +
    'finite-8 CD is a demoted internal diagnostic (cdPeekIsApproximate, never published), ' +
    'finite-1 deck-sensitivity, infinite-deck regression value, card-removal lift, WoO anchor.',
  // Retained here ONLY as the infinite-deck regression anchor and to document the card-removal
  // lift. NOT the LIQD figure — the reference model draws with replacement, LIQD does not.
  analyticalInfiniteDeck: analytical.rtp,
  analyticalInfiniteDeckEdge: analytical.edge,
  cardRemovalLiftPP: (exactTD.rtpPerInitialBet - analytical.rtp) * 100,
  pass1_fresh_seeds: {
    description: 'One server/client seed pair, both halves derived from this run\'s recorded master seed, drives a 1,000,000-nonce stream of the reference blackjackShoe algorithm. The retained results cover first-card rank uniformity (df=12), lag-1 correlation and the runs test. These are specified statistical checks; the finite eight-deck RTP is evaluated separately by the deterministic model and a simulation consistency check. The seed pair is RETAINED below, so this experiment can be replayed exactly (npx ts-node src/deep-replay.ts).',
    rounds: ROUNDS,
    // THE RETAINED REPLAY INPUT for this experiment. Previously a crypto.randomBytes pair that
    // was never written down: the statistics below described a stream nobody could re-create.
    serverSeed, clientSeed,
    seedDerivation: SEED_DERIVATION_VERSION,
    serverSeedDomain: SEED_DOMAINS.pass1Server, clientSeedDomain: SEED_DOMAINS.pass1Client, seedIndex: 0,
    // THE CENSUS — exact integers and exact half-unit sums, one row per PASS1_ROW_NONCES nonces.
    // Every statistic below is src/replay.ts pass1Statistics(rows); scored Step 18 re-derives each of
    // them from these rows and re-deals the declared rows (the first and the last) from the seed pair.
    rowNonces: PASS1_ROW_NONCES,
    rankFreq: pass1.rankFreq, playerBJs: pass1.playerBJs, dealerBJs: pass1.dealerBJs,
    wagered: pass1.wagered, returned: pass1.returned, runs: pass1.runs, highs: pass1.highs,
    firstCardChi2: fd.chi2, firstCardDf: fd.df, firstCardPValue: fd.pValue,
    serialR1: r1, serialR1Z: r1z, serialRunsZ: runsZ, serialRunsPValue: runsP,
    firstCardUniformFail: fd.pValue < 0.01,
    serialFail: Math.abs(r1z) > 3 || runsP < 0.01,
    // RTP through the real RNG against the exact 8-deck TD solve at σ = SIM_SD_PER_ROUND/√rounds
    // (BLACKJACK-20) — the same figures as realShoeConsistency, here beside the rows they come from.
    rtpPerInitialBet: rtp, exactRtpPerInitialBet: exactTD.rtpPerInitialBet, sigmaPerRound: SIM_SD_PER_ROUND,
    standardError: rtpSE, deviationSigmaVsExact: rtpSigmaVsExact,
    rows: p1Rows,
  },
  pass2_casino_seeds: {
    description: 'Casino seeds (revealed serverSeeds), each replayed over nonces 0..9,999 with its epoch client seed. PRIMARY (since 2026-09-24): the MONEY statistic — every nonce played to settlement under the declared basic strategy, net return summed per 50-round window; the served window (nonces 0..49, the captured range) is ranked against the seed\'s own 199 later windows (one-sided, low return flags) and pooled over all seeds against the exact 8-deck mean. SECONDARY: first-card rank uniformity over the served window vs a parametric bootstrap null, with the late window as control. Neither is the primary cherry-pick defence, which is the client-seed-after-commitment mitigation (see operator-trust-analysis.md#residual-trust-seed-selection-cherry-picking).',
    noncesPerSeed: PASS2_NONCES, earlyWindow: [0, PASS2_EARLY - 1], lateWindow: [PASS2_EARLY, PASS2_NONCES - 1],
    bootstrapReps: BOOTSTRAP_REPS,
    // THE RETAINED REPLAY INPUTS for this experiment. The replicate seed pairs are addressable
    // (domain + replicate index under the master seed) and the 2,000 statistics they produced are
    // committed as bytes, so `earlyBootstrapP` is reproducible rather than — as this artifact's
    // predecessor had to say — "not reproducible by construction".
    bootstrapSeedDerivation: SEED_DERIVATION_VERSION,
    bootstrapServerDomain: SEED_DOMAINS.pass2BootstrapServer,
    bootstrapClientDomain: SEED_DOMAINS.pass2BootstrapClient,
    bootstrapReplicateIndex: [0, BOOTSTRAP_REPS - 1],
    nullFile: `outputs/${BOOTSTRAP_NULL_FILE}`,
    nullSHA256,
    nullFormat: 'IEEE-754 float64 little-endian, GENERATION order (index r = replicate r), one value per bootstrap replicate',
    pValueRule: '(count(null statistic >= observed statistic) + 1) / (bootstrapReps + 1), evaluated on a sorted copy of the retained nulls',
    seeds_tested: seedsTested, cherryPickFlags, expectedFlagsByChance: expectedFlags, cherryPickSurvivalP: cherryPickSurvival,
    money: {
      rule: 'per seed p = (1 + #{later windows with net <= served window net}) / windows, flagged at p <= alpha; family: flagged seeds > gate (binomial upper tail at familyAlpha) FLAGs; pooled z = (sum of served-window net - exact mean) / (sdPerRound * sqrt(served rounds)) < -zGate FLAGs. Fixed in src/config.ts before the statistic was first computed (2026-09-24). Since 2026-09-25 sdPerRound is the EXACT per-round SD (outputs/exact-rtp.json finite8TDMoments.sd), not a measured SD rounded up.',
      strategy: 'declared basic strategy (src/strategy.ts) via src/round-engine.ts settleShoe',
      window: PASS2_WINDOW, windows: nWin, alpha: PASS2_MONEY_ALPHA, familyAlpha: PASS2_FAMILY_ALPHA,
      familyGate: moneyGate, seedsFlagged: moneyFlags,
      servedRounds, pooledEarlyNet, pooledExpectedNet, exactEdgePerInitialBet: exactTD.edgePerInitialBet,
      sdPerRound: exactMoments.sd, pooledSD, pooledZ, pooledZGate: -PASS2_POOLED_Z, pooledBootstrapP,
      pooledPower,
    },
    results: pass2Results,
  },
};
const simJson = JSON.stringify(output, null, 2);
fs.writeFileSync(path.join(OUT, 'simulation-results.json'), simJson);

// ── Provenance record ─────────────────────────────────────────────────────────
// WHAT produced the artifact, from WHICH inputs, at what size — the thing a reader needs in
// order to re-run the experiment rather than re-read its conclusions. Written last so it can
// carry the digests of the files it describes.
//
// It is a RECORD OF METHOD, not an attestation of time or authorship: `inputsRecordedAt` says
// when this process generated the master seed, and nothing in a repository can independently
// prove that. The digests, by contrast, are checkable by anyone holding the files.
const datasetSHA256 = createHash('sha256').update(fs.readFileSync(DATASET_PATH)).digest('hex');
const provenance = {
  format: 'liqd-blackjack-simulation-provenance-v1',
  codeVersion: {
    producer: 'src/simulate.ts',
    passImplementations: 'src/replay.ts',
    roundEngine: 'src/round-engine.ts',
    shoe: 'src/rng.ts (blackjackShoe)',
    referenceShuffle: 'src/shuffle.ts (lazy Fisher-Yates) over src/prng.ts (xoshiro128**)',
    seedDerivation: SEED_DERIVATION_VERSION,
    seedDerivationRule: 'seed(domain, i) = first 16 bytes of HMAC-SHA256(key = hex-decoded masterSeed, message = "<seedDerivation>:<domain>:<i>")',
    independentReplay: 'replay/replay-bootstrap.py (Python standard library only; imports nothing from this repository)',
    inRepoReplay: 'src/deep-replay.ts (npx ts-node src/deep-replay.ts)',
  },
  dataset: { file: 'data/blackjack-6000hands.json', sha256: datasetSHA256 },
  simulation: { file: 'outputs/simulation-results.json', sha256: createHash('sha256').update(simJson).digest('hex') },
  masterSeed: MASTER_SEED,
  masterSeedScope: 'ALL THREE passes of this run. Pass 0, Pass 1 and every Pass-2 bootstrap replicate derive from it.',
  masterSeedPin: 'src/config.ts SIM_MASTER_SEED',
  recordingNote: 'The master seed was generated once, as 32 random bytes, for the 2026-09-12 run and recorded before any experiment ran; since 2026-09-24 it is pinned in src/config.ts, so the committed experiment is regenerated rather than redrawn. This statement describes the procedure; repository metadata cannot independently authenticate when the seed was first generated.',
  pass0_reference: {
    experiment: 'Finite 8-deck RTP of the rule set over a fair shuffle',
    rounds: REF_ROUNDS,
    stream: 'xoshiro128**',
    seedDomain: SEED_DOMAINS.pass0Shuffle, seedIndex: 0, seedBytes: 16,
    drawRule: 'uniform index in [0, n) by rejection: reject any 32-bit word >= floor(2^32 / n) * n, then take the remainder',
    checkpoints: reference.checkpoints.length,
    replayCommand: 'npx ts-node src/deep-replay.ts',
    report: 'outputs/deep-replay-report.json',
  },
  pass1_real_shoe: {
    experiment: 'First-card rank uniformity and serial independence of the real blackjackShoe algorithm',
    rounds: ROUNDS,
    serverSeed, clientSeed,
    serverSeedDomain: SEED_DOMAINS.pass1Server, clientSeedDomain: SEED_DOMAINS.pass1Client,
    seedIndex: 0, derivedSeedBytes: 16,
    replayCommand: 'npx ts-node src/deep-replay.ts',
    report: 'outputs/deep-replay-report.json',
  },
  pass2_bootstrap: {
    experiment: 'Cherry-pick detection on the served window: the money statistic (primary, every nonce settled under the declared basic strategy, 50-round windows) and the first-card rank screen against a parametric bootstrap null (secondary)',
    seedsTested: seedsTested,
    noncesPerSeed: PASS2_NONCES,
    earlyWindow: [0, PASS2_EARLY - 1],
    lateWindow: [PASS2_EARLY, PASS2_NONCES - 1],
    bootstrapReps: BOOTSTRAP_REPS,
    serverDomain: SEED_DOMAINS.pass2BootstrapServer,
    clientDomain: SEED_DOMAINS.pass2BootstrapClient,
    replicateIndex: [0, BOOTSTRAP_REPS - 1],
    derivedSeedBytes: 16,
    statistic: 'first-card rank chi-squared over the early window; at n=50 the expected count per rank is 50/13 = 3.85, so chiSquaredTest pools the two end bins and the statistic is an 11-bin chi-squared on df 10. The null uses the identical statistic.',
    pValueRule: '(count(null statistic >= observed statistic) + 1) / (bootstrapReps + 1)',
    nullStatistics: BOOTSTRAP_REPS,
    nullFile: `outputs/${BOOTSTRAP_NULL_FILE}`,
    nullSHA256,
    nullFormat: 'IEEE-754 float64 little-endian, GENERATION order (index r = replicate r), one value per replicate',
    replayCommand: 'python3 replay/replay-bootstrap.py',
    report: 'outputs/bootstrap-replay-report.json',
  },
  supersededArtifact: {
    file: 'tests/fixtures/legacy-simulation-results.json',
    note: 'The 2026-09-02 simulation this release replaces. Its random inputs were never recorded and cannot be recovered, so it is retained as a FROZEN TEST FIXTURE with its digest pinned in src/config.ts (LEGACY_SIMULATION_SHA256) — not as a reproducible result, and not as the artifact of record.',
  },
};
fs.writeFileSync(path.join(OUT, 'simulation-provenance.json'), JSON.stringify(provenance, null, 2) + '\n');

// ── Convergence chart (inline SVG — no external library, renders offline) ──────
// The estimate is plotted against cumulative sample size with a ±2·SE band, so a
// reader can see it converge on the reference rather than take the final number on
// faith. SE = σ/√n (a STANDARD ERROR of the mean, not a standard deviation).
// Per-initial-bet convergence, plotted against the ANALYTICAL infinite-deck limit (a
// deterministic in-repo reference in the same convention) — the finite figure sits just
// above it, as card removal predicts. Anchoring on the analytical (rather than the Wizard
// of Odds 8-deck figure) keeps the comparison like-to-like: WoO's exact calculator rule
// inputs (notably re-split) are not pinned here, so it is cited in prose, not gated.
const CK = reference.checkpoints;
const CW = 640, CH = 300, CPAD = { l: 66, r: 16, t: 16, b: 40 };
const plotW = CW - CPAD.l - CPAD.r, plotH = CH - CPAD.t - CPAD.b;
const ANALYTIC = analytical.rtp;   // infinite-deck limit, per initial bet
const lo = Math.min(ANALYTIC, ...CK.map((c) => c.rtp - 2 * c.se));
const hi = Math.max(ANALYTIC, ...CK.map((c) => c.rtp + 2 * c.se));
const yPad = (hi - lo) * 0.08 || 0.001;
const yMin = lo - yPad, yMax = hi + yPad;
const xOf = (i: number): number => CPAD.l + (CK.length === 1 ? plotW / 2 : (i / (CK.length - 1)) * plotW);
const yOf = (v: number): number => CPAD.t + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
const bandTop = CK.map((c, i) => `${xOf(i).toFixed(1)},${yOf(c.rtp + 2 * c.se).toFixed(1)}`).join(' ');
const bandBot = CK.map((c, i) => `${xOf(i).toFixed(1)},${yOf(c.rtp - 2 * c.se).toFixed(1)}`).reverse().join(' ');
const line = CK.map((c, i) => `${xOf(i).toFixed(1)},${yOf(c.rtp).toFixed(1)}`).join(' ');
const yTicks = Array.from({ length: 5 }, (_, k) => yMin + (k / 4) * (yMax - yMin));
const fmtN = (n: number): string => (n >= 1e6 ? `${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M` : n >= 1e3 ? `${n / 1e3}K` : String(n));
const svg = `<svg viewBox="0 0 ${CW} ${CH}" width="100%" role="img" aria-label="RTP convergence with two-standard-error band">
  <rect x="${CPAD.l}" y="${CPAD.t}" width="${plotW}" height="${plotH}" fill="#fff" stroke="#e0e0e0"/>
  ${yTicks.map((v) => `<line x1="${CPAD.l}" y1="${yOf(v).toFixed(1)}" x2="${CPAD.l + plotW}" y2="${yOf(v).toFixed(1)}" stroke="#f0f0f0"/><text x="${CPAD.l - 8}" y="${(yOf(v) + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#666">${(v * 100).toFixed(3)}%</text>`).join('')}
  <polygon points="${bandTop} ${bandBot}" fill="#2e7d32" fill-opacity="0.13"/>
  <line x1="${CPAD.l}" y1="${yOf(ANALYTIC).toFixed(1)}" x2="${CPAD.l + plotW}" y2="${yOf(ANALYTIC).toFixed(1)}" stroke="#c62828" stroke-width="1.5" stroke-dasharray="5,4"/>
  <text x="${CPAD.l + plotW - 4}" y="${(yOf(ANALYTIC) - 6).toFixed(1)}" text-anchor="end" font-size="10" fill="#c62828">Analytical infinite-deck limit ${(ANALYTIC * 100).toFixed(4)}% (per initial bet)</text>
  <polyline points="${line}" fill="none" stroke="#2e7d32" stroke-width="2"/>
  ${CK.map((c, i) => `<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(c.rtp).toFixed(1)}" r="3" fill="#2e7d32"/>`).join('')}
  ${CK.map((c, i) => (i % 2 === 0 || i === CK.length - 1 ? `<text x="${xOf(i).toFixed(1)}" y="${CH - 22}" text-anchor="middle" font-size="10" fill="#666">${fmtN(c.rounds)}</text>` : '')).join('')}
  <text x="${CPAD.l + plotW / 2}" y="${CH - 6}" text-anchor="middle" font-size="11" fill="#444">cumulative rounds simulated</text>
</svg>`;
const first = CK[0], last = CK[CK.length - 1];

const chartHTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>LIQD BLACKJACK — FINITE 8-DECK RTP CONVERGENCE</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#fafafa;padding:24px}.c{max-width:820px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e0e0e0;padding:32px}h1{text-align:center;font-size:15px;font-weight:600;color:#333;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:24px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:8px 10px;border:1px solid #e0e0e0;text-align:center}th{background:#f5f5f5;font-weight:600}.big{font-size:22px;font-weight:700;color:#2e7d32}.info{color:#555;font-size:12px;margin-top:16px;text-align:center}.cap{color:#555;font-size:12px;margin:10px 0 22px;text-align:center;line-height:1.5}</style>
</head><body><div class="c">
<h1>LIQD Blackjack — Finite 8-Deck RTP, per initial bet (exact solve, consistent with a ${REF_ROUNDS.toLocaleString()}-round fair-shuffle simulation)</h1>
${svg}
<p class="cap">Pooled optimal-play RTP <strong>per initial bet</strong> against cumulative sample size, with a &plusmn;2 &times; Standard Error band (SE = &sigma;/&radic;n). The band narrows from &plusmn;${(first.se * 2 * 100).toFixed(3)} pp at ${fmtN(first.rounds)} rounds to &plusmn;${(last.se * 2 * 100).toFixed(4)} pp at ${fmtN(last.rounds)}; the final interval is [${((last.rtp - 2 * last.se) * 100).toFixed(4)}%, ${((last.rtp + 2 * last.se) * 100).toFixed(4)}%], which sits <strong>${(last.rtp > ANALYTIC ? 'above' : 'below')}</strong> the analytical infinite-deck limit ${(ANALYTIC * 100).toFixed(4)}% — the direction card removal predicts.</p>
<table>
<tr><th>Method</th><th>RTP</th><th>House edge</th><th>Convention</th></tr>
<tr><td><strong>Exact 8-deck solve — AUTHORITATIVE</strong> (deterministic, no sampling error)</td><td class="big">${(exactTD.rtpPerInitialBet * 100).toFixed(4)}%</td><td>${(exactTD.edgePerInitialBet * 100).toFixed(4)}%</td><td>per initial bet</td></tr>
<tr><td>Exact 8-deck solve — same figure, element of risk</td><td>${(exactTD.rtpPerTotalWagered * 100).toFixed(4)}%</td><td>${(exactTD.edgePerTotalWagered * 100).toFixed(4)}%</td><td>per total wagered</td></tr>
<tr><td>Finite 8-deck — fair-shuffle estimate (consistency check)</td><td>${(reference.rtpInitial * 100).toFixed(4)}%</td><td>${(reference.edgeInitial * 100).toFixed(4)}%</td><td>per initial bet</td></tr>
<tr><td>Finite 8-deck — same estimate, element of risk</td><td>${(reference.rtpPerTotalWagered * 100).toFixed(4)}%</td><td>${(reference.edgePerTotalWagered * 100).toFixed(4)}%</td><td>per total wagered</td></tr>
<tr><td>Infinite-deck engine (with-replacement regression anchor, not LIQD's RTP)</td><td>${(analytical.rtp * 100).toFixed(4)}%</td><td>${(analytical.edge * 100).toFixed(4)}%</td><td>per initial bet</td></tr>
<tr><td>Real-shoe RNG cross-check (${ROUNDS.toLocaleString()} rounds)</td><td>${(rtp * 100).toFixed(4)}%</td><td>${(edge * 100).toFixed(4)}%</td><td>per initial bet</td></tr>
<tr><td>Wizard of Odds, basic strategy w/ continuous shuffler, rule inputs pinned (captured ${wooDate})</td><td>${((1 - wooEdge) * 100).toFixed(5)}%</td><td>${(wooEdge * 100).toFixed(5)}%</td><td>per initial bet</td></tr>
</table>
<p class="info">Rules: 8 decks, S17, DAS, split-aces-one-card, no-resplit, dealer peek/OBO, blackjack 3:2, no surrender. Average wager per round ${reference.avgWager.toFixed(4)} initial-bet units, which separates the two conventions. Real-shoe RTP over the actual blackjackShoe algorithm, optimal basic strategy, ±${(rtpSE * 100).toFixed(4)}% (1σ). Per initial bet the finite figure sits just above the infinite-deck limit, as card removal predicts. First-card rank χ² p=${fd.pValue.toFixed(3)}; serial |r₁z|=${Math.abs(r1z).toFixed(2)}, runs p=${runsP.toFixed(3)}. Pass 2 money rule (primary): ${moneyFlags}/${seedsTested} seeds flagged (family gate ${moneyGate}), pooled z=${pooledZ.toFixed(3)}; rank screen (secondary) flags ${cherryPickFlags}/${seedsTested} (survival P=${cherryPickSurvival.toFixed(3)}).</p>
</div></body></html>`;
fs.writeFileSync(path.join(OUT, 'rtp-convergence.html'), chartHTML);

console.log('═'.repeat(62));
const rel = path.relative(path.join(__dirname, '..'), OUT);
console.log(`  Written: ${rel}/simulation-results.json, ${rel}/simulation-provenance.json, ${rel}/rtp-convergence.html, ${rel}/${BOOTSTRAP_NULL_FILE}`);

// ── Regeneration diff (rules.reproduction) ─────────────────────────────────────────
// A plain run is compared with the committed artifacts: the two JSON files field by field
// (integers and strings exact, non-integer numbers within |Δ| ≤ 1e-14 + 1e-12·max(|a|,|b|)), the
// chart and the retained nulls byte for byte (both are exact content). The diff and the runtime
// are recorded in outputs/run/simulation-diff.json; anything beyond tolerance exits 1.
let simExit = 0;
if (!PF_EMIT) {
  const readJson = (p: string): unknown => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
  const bytesEqual = (a: string, b: string): boolean => fs.existsSync(a) && fs.existsSync(b) && fs.readFileSync(a).equals(fs.readFileSync(b));
  const simDiff = fieldDiff(readJson(path.join(COMMITTED, 'simulation-results.json')), output, []);
  const provDiff = fieldDiff(readJson(path.join(COMMITTED, 'simulation-provenance.json')), provenance, []);
  const htmlSame = bytesEqual(path.join(COMMITTED, 'rtp-convergence.html'), path.join(OUT, 'rtp-convergence.html'));
  const nullsSame = bytesEqual(path.join(COMMITTED, BOOTSTRAP_NULL_FILE), path.join(OUT, BOOTSTRAP_NULL_FILE));
  const real = [...beyondTolerance(simDiff), ...beyondTolerance(provDiff)];
  const all = [...simDiff, ...provDiff];
  const reproduced = real.length === 0 && htmlSame && nullsSame;
  fs.writeFileSync(path.join(OUT, 'simulation-diff.json'), JSON.stringify({
    runtime: process.versions.node,
    masterSeed: MASTER_SEED,
    masterSeedIsPinned: MASTER_SEED === SIM_MASTER_SEED,
    tolerance: { atol: DIFF_ATOL, rtol: DIFF_RTOL, rule: '|a-b| <= atol + rtol*max(|a|,|b|); integers and strings exact' },
    reproduced,
    beyondToleranceCount: real.length,
    withinToleranceCount: all.length - real.length,
    largestGap: maxima(all),
    bytesEqual: { 'outputs/rtp-convergence.html': htmlSame, [`outputs/${BOOTSTRAP_NULL_FILE}`]: nullsSame },
    simulationResultsDiff: simDiff,
    simulationProvenanceDiff: provDiff,
  }, null, 2));
  console.log(`  Regeneration vs the committed artifacts on Node ${process.versions.node}: ${reproduced ? 'REPRODUCED' : 'DIFFERS'} — `
    + `${real.length} field(s) beyond tolerance, ${all.length - real.length} within; chart ${htmlSame ? 'byte-identical' : 'DIFFERS'}, retained nulls ${nullsSame ? 'byte-identical' : 'DIFFER'} (${rel}/simulation-diff.json)`);
  for (const d of real.slice(0, 6)) console.log(`      ${d.path}: committed ${JSON.stringify(d.committed)} vs this run ${JSON.stringify(d.thisRun)}`);
  if (!reproduced) simExit = 1;
} else {
  console.log('  PF_EMIT=1: rewrote the committed artifacts — re-pin SIMULATION_SHA256, SIMULATION_HTML_SHA256, SIMULATION_PROVENANCE_SHA256 and BOOTSTRAP_NULLS_SHA256 in src/config.ts, and review the diff.');
}
console.log('═'.repeat(62) + '\n');
process.exitCode = simExit;

export {};
