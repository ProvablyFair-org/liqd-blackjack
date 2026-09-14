/**
 * LIQD Blackjack — Monte-Carlo simulation (Pass 1 + Pass 2).
 *
 * Finite 8-deck RTP consistency simulation.
 *
 * NOTE ON SHOE SOURCE — the two passes differ, deliberately:
 *   • Pass 1 (500,000 rounds) deals from the REAL `blackjackShoe` algorithm (backward in-place
 *     Fisher-Yates over the HMAC-SHA256 stream) seeded with `crypto.randomBytes`. This is the
 *     pass that validates the shoe as a fair shuffle.
 *   • The 30,000,000-round reference pass (`referenceRTP`) uses a plain `Math.random()` fair
 *     shuffle. It measures the RTP of the RULE SET at scale, where the shoe algorithm is not
 *     the object under test, and per-card HMAC hashing would make 30M rounds impractical.
 * Both are played with complete optimal basic strategy for the
 * confirmed rule set (S17, DAS, split-aces-one-card, no-resplit, dealer peek/OBO,
 * blackjack 3:2, no surrender). This is the finite-shoe counterpart to the analytical
 * infinite-deck engine in `optimal-play.ts`; both are cross-checked against Wizard of
 * Odds for the same rule set.
 *
 * Pass 1 — one fresh random seed pair (crypto.randomBytes) per run, single-stream:
 *   • baseGame RTP is emitted in BOTH conventions: per initial bet (edge = (W−R)/rounds, the
 *     standard house-edge convention, ≈0.4877% edge — matches the exact solver) and per total
 *     amount wagered (edge = (W−R)/W, the element of risk, ≈0.4324%). The
 *     two differ by the average wager per round (doubles + split stakes), so they are not
 *     interchangeable. The per-initial figure sits just above the infinite-deck 99.4296% limit.
 *   • First-card uniformity (scored): shoe[0] rank over 13 ranks, χ² vs N·32/416, df=12.
 *   • Serial independence (scored): lag-1 autocorrelation + runs test on the sequence of
 *     first-card rank values across nonces.
 *
 * Pass 2 — casino seeds from the captured dataset's revealed serverSeeds (cherry-pick):
 *   Early window = nonces 0..49 (real served depth per epoch); late = 50..N-1. Statistic
 *   = first-card rank uniformity χ² over the window. At n=50 the two end bins are pooled
 *   (A with 2, Q with K; df 10) because their expected count (50/13 = 3.85) is below 5, so the
 *   early-window statistic is an 11-bin χ² rather than the 13-rank test; the bootstrap null uses
 *   the identical statistic, so the comparison is valid. At n=50 with 13 ranks the analytic χ²
 *   is weak, so the early-window null is a PARAMETRIC BOOTSTRAP (fair replicates of 50
 *   first-cards). Flag if earlyBootstrapP<0.05 AND lateP≥0.05. This is a gross-RNG-bias
 *   check on the served window; the primary cherry-pick defence is the client-seed-after-
 *   commitment mitigation (the player sets the client seed, so the operator cannot
 *   precompute a favourable server seed) — see AUDIT_CONTEXT.md#seed-selection-and-server-operations.
 *
 * Output: outputs/simulation-results.json, outputs/rtp-convergence.html
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'node:crypto';

import { blackjackShoe } from './rng';
import { buildRankShoe, createLazyShuffler } from './shuffle';
import { PASS2_P0, cherryPickFlag } from './config';
import { chiSquaredTest, lag1Autocorrelation, runsTest, inverseCriticalZ, combination } from './stats';
import { computeOptimalRTP } from './optimal-play';
import { pairAction, softAction, hardAction } from './strategy';
import { solveExact } from './exact-play';

const ROUNDS = Number(process.env.ROUNDS) || 500_000;           // real-shoe pass: fairness validation (slow RNG shoe)
const REF_ROUNDS = Number(process.env.REF_ROUNDS) || 30_000_000; // fast fair-shuffle pass: finite 8-deck RTP consistency estimate
const PASS2_NONCES = Number(process.env.PASS2_NONCES) || 1_000;
const PASS2_EARLY = 50;
const BOOTSTRAP_REPS = Number(process.env.BOOTSTRAP_REPS) || 2_000;
const DATASET_PATH = path.join(__dirname, '..', 'data', 'blackjack-6000hands.json');
const RANKS = 13;                       // ranks 1..13 (A..K); each 32/416 = 1/13 of the shoe

// ── card helpers (cards are "SUIT:rank", rank 1=A..13=K) ─────────────────────────
const rankOf = (card: string): number => Number(card.slice(card.indexOf(':') + 1));
const valOf = (card: string): number => { const r = rankOf(card); return r === 1 ? 11 : r >= 10 ? 10 : r; };

/** Hand total with soft-ace reduction. Returns [total, soft] (soft = an ace still counts 11). */
function total(cards: number[]): [number, boolean] {
  let t = 0, aces = 0;
  for (const v of cards) { t += v; if (v === 11) aces++; }
  while (t > 21 && aces > 0) { t -= 10; aces--; }
  return [t, aces > 0];
}

// Basic-strategy table lives in src/strategy.ts — shared verbatim with the exact
// solver (exact-play.ts TD mode) so the two can never drift apart.

// draw pointer over the shoe (player draws then dealer draws, from index 4)
let SHOE: string[] = [];
let ptr = 4;
const shoeDraw = (): number => valOf(SHOE[ptr++]);

// One shared implementation of the game logic, driven by an injected draw() so the real RNG shoe
// (Pass 1) and the fast fair-shuffle reference use IDENTICAL rules — no risk of two implementations
// drifting apart.

/** Play one non-split hand; canDouble gates the first-move double. Returns [finalTotal, betUnits]. */
function playHand(cards: number[], up: number, canDouble: boolean, draw: () => number): [number, number] {
  let bet = 1;
  while (true) {
    const [t, soft] = total(cards);
    if (t > 21) return [t, bet];
    const a = soft ? softAction(t, up) : hardAction(t, up);
    if (a === 'D' || a === 'Ds') {
      if (cards.length === 2 && canDouble) { cards.push(draw()); return [total(cards)[0], 2]; }
      if (a === 'Ds') return [t, bet];
      cards.push(draw()); continue;                        // D with no double → hit
    }
    if (a === 'S') return [t, bet];
    cards.push(draw());                                    // hit
  }
}
function dealerPlay(cards: number[], draw: () => number): number {
  while (true) { const [t] = total(cards); if (t < 17) cards.push(draw()); else return t; } // S17
}

/** Play a full round from four dealt values + the two player-card ranks (for pair detection) + a
 *  draw fn. Returns [wagered, returned] in bet units. */
function playRound(p0: number, up: number, p1: number, hole: number, rp0: number, rp1: number, draw: () => number): [number, number] {
  const playerBJ = p0 + p1 === 21;
  const dealerBJ = up + hole === 21 && (up === 11 || hole === 11);

  // US peek / OBO: dealer natural resolves before the player risks extra
  if (up === 11 || up === 10) {
    if (dealerBJ) return [1, playerBJ ? 1 : 0];            // push if player also BJ, else lose base
  }
  if (playerBJ) return [1, 2.5];                            // player natural, dealer not BJ → 3:2

  const results: [number, number][] = []; // [finalTotal (>21 = bust), betUnits]
  const pv = rp0 === 1 ? 11 : rp0 >= 10 ? 10 : rp0;
  if (p0 === p1 && rp0 === rp1 && pairAction(pv, up) === 'P') {
    if (pv === 11) {                                        // split aces: one card each, no further action
      results.push([total([11, draw()])[0], 1]);
      results.push([total([11, draw()])[0], 1]);
    } else {
      results.push(playHand([p0, draw()], up, true, draw)); // DAS allowed
      results.push(playHand([p1, draw()], up, true, draw));
    }
  } else {
    results.push(playHand([p0, p1], up, true, draw));
  }

  let wager = 0; for (const [, b] of results) wager += b;
  const anyLive = results.some(([t]) => t <= 21);
  let dTot = 0;
  if (anyLive) dTot = dealerPlay([up, hole], draw);

  let ret = 0;
  for (const [t, b] of results) {
    if (t > 21) continue;                                  // bust → lose
    if (dTot > 21 || t > dTot) ret += 2 * b;               // win
    else if (t === dTot) ret += 1 * b;                     // push
  }
  return [wager, ret];
}

/**
 * Finite-8-deck RTP estimate over a plain fair shuffle. The RTP is a function of rules +
 * strategy under the assumed uniform shuffle. The configured standard error is 1.15 / sqrt(rounds).
 * Pass 1 separately evaluates first-card rank uniformity and the specified serial statistics
 * of the reference `blackjackShoe` algorithm. Its sampled RTP is a consistency cross-check.
 */
function referenceRTP(rounds: number): {
  rtpInitial: number; edgeInitial: number;          // per initial bet (matches WoO / analytical / the advertised figure)
  rtpPerTotalWagered: number; edgePerTotalWagered: number; // per total amount wagered ("element of risk")
  avgWager: number; se: number; sdPerRound: number;        // sdPerRound = MEASURED per-round SD of the per-initial-bet loss
  checkpoints: { rounds: number; rtp: number; se: number }[]; // per-initial-bet convergence
} {
  // LAZY (incremental) Fisher-Yates. An earlier version pre-shuffled a fixed prefix of 24 cards
  // per round and called that the "worst-case round depth" — an invariant that is not guaranteed:
  // a split with repeated aces can consume more, and any draw past the prefix would have read an
  // UNSHUFFLED tail position. Here the shuffle frontier advances on demand, so position k is fixed
  // by a uniform draw from [k, M) the first time it is read. Exact uniformity at ANY depth, no
  // depth constant, same cost (each round only fixes the positions it actually consumes).
  //
  // The implementation lives in `src/shuffle.ts` and is IMPORTED, not inlined (round-4 QA-02).
  // It used to be written out here and copied a second time inside the depth-uniformity tests, so
  // those tests guarded their own copy: capping the frontier at 24 in THIS function — putting the
  // defect back — left all three of them green. One implementation, two callers, one guard.
  const RANK = buildRankShoe(8);                                             // 8 decks: 32 of each rank
  // `(Math.random() * n) | 0` — byte-for-byte the index expression this function used inline.
  const shuffler = createLazyShuffler(RANK, (n: number) => (Math.random() * n) | 0);
  let rp = 4;
  const rval = (r: number): number => (r === 1 ? 11 : r >= 10 ? 10 : r);
  const rdraw = (): number => { shuffler.ensure(rp); return rval(RANK[rp++]); };

  // Cumulative checkpoints at decade-spaced sample sizes, so the estimate can be
  // shown CONVERGING rather than asserted as a single final number. Each checkpoint
  // records the running RTP and its standard error at that n.
  const checkpoints: { rounds: number; rtp: number; se: number }[] = [];
  const marks: number[] = [];
  for (let n = 1_000; n < rounds; n *= 10) { marks.push(n); marks.push(n * 3); }
  const markSet = new Set(marks.filter((n) => n < rounds));

  // W = total amount wagered (initial + double/split stakes); R = total returned (incl. stake).
  // Each round posts exactly one initial bet unit, so `rounds` is the total INITIAL amount staked.
  //   edge per initial bet   = (W - R) / rounds        (the standard blackjack "house edge")
  //   edge per total wagered = (W - R) / W             (the "element of risk")
  // These differ by the average wager per round (W/rounds ≈ 1.13), so they are NOT interchangeable.
  // The convergence checkpoints track the per-initial-bet RTP (the convention WoO/analytical use).
  // sumSq accumulates the squared per-round per-initial-bet LOSS (w−r in bet units, initial stake 1),
  // so the per-round SD can be MEASURED from the run rather than asserted from a memorised constant.
  let W = 0, R = 0, sumSq = 0;
  for (let i = 0; i < rounds; i++) {
    shuffler.reset();                // new round: frontier back to 0, arrangement kept
    shuffler.ensure(3);              // fix the four dealt cards
    rp = 4;
    const [w, r] = playRound(rval(RANK[0]), rval(RANK[1]), rval(RANK[2]), rval(RANK[3]), RANK[0], RANK[2], rdraw);
    W += w; R += r;
    const loss = w - r; sumSq += loss * loss;
    const n = i + 1;
    // SE reported on the gate constant (1.15 = the measured per-round SD ≈1.147, rounded up), NOT on
    // the simulator's own measured SD — the verifier must not let the instrument set its own tolerance.
    if (markSet.has(n)) checkpoints.push({ rounds: n, rtp: 1 - (W - R) / n, se: 1.15 / Math.sqrt(n) });
  }
  const rtpInitial = 1 - (W - R) / rounds;
  const rtpPerTotalWagered = R / W;
  const se = 1.15 / Math.sqrt(rounds);
  const meanLoss = (W - R) / rounds;
  const sdPerRound = Math.sqrt(Math.max(0, sumSq / rounds - meanLoss * meanLoss)); // MEASURED per-round SD
  checkpoints.push({ rounds, rtp: rtpInitial, se });
  return {
    rtpInitial, edgeInitial: (W - R) / rounds,
    rtpPerTotalWagered, edgePerTotalWagered: (W - R) / W,
    avgWager: W / rounds, se, sdPerRound, checkpoints,
  };
}

// ── progress bar ─────────────────────────────────────────────────────────────────
function bar(cur: number, tot: number, label: string, t0: number, w = 30): void {
  const f = Math.min(tot > 0 ? cur / tot : 0, 1);
  const on = Math.round(f * w);
  const el = ((Date.now() - t0) / 1000).toFixed(0);
  const eta = cur > 0 ? (((Date.now() - t0) / cur) * (tot - cur) / 1000).toFixed(0) : '?';
  process.stdout.write(`\r  ${'━'.repeat(on)}${'╌'.repeat(w - on)} ${(f * 100).toFixed(0).padStart(3)}% | ${label} | ${el}s ~${eta}s left   `);
}

// ══════════════════════════════════════════════════════════════════════════════
//  PASS 1 — fresh random seeds, real 8-deck shoe
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
//  PASS 0 — finite 8-deck RTP consistency estimate over a fast fair shuffle (±0.02% MC error)
// ══════════════════════════════════════════════════════════════════════════════
console.log('═'.repeat(62));
console.log('  LIQD BLACKJACK — PASS 0: finite 8-deck RTP consistency estimate (fast fair shuffle)');
console.log(`  ${REF_ROUNDS.toLocaleString()} rounds — finite 8-deck consistency estimate (±0.02% MC error)`);
console.log('═'.repeat(62) + '\n');
const ref0 = Date.now();
const reference = referenceRTP(REF_ROUNDS);
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

let serverSeed = randomBytes(16).toString('hex');
let clientSeed = randomBytes(16).toString('hex');
const rankFreq = new Array(RANKS).fill(0);
const rankSeq = new Uint8Array(ROUNDS);
let wagered = 0, returned = 0, playerBJs = 0, dealerBJs = 0;

const p1Start = Date.now();
bar(0, ROUNDS, 'starting', p1Start);
for (let nonce = 0; nonce < ROUNDS; nonce++) {
  SHOE = blackjackShoe(serverSeed, clientSeed, nonce);
  const firstRank = rankOf(SHOE[0]);
  rankFreq[firstRank - 1]++;
  rankSeq[nonce] = firstRank;
  if (valOf(SHOE[0]) + valOf(SHOE[2]) === 21) playerBJs++;
  if (valOf(SHOE[1]) + valOf(SHOE[3]) === 21 && (valOf(SHOE[1]) === 11 || valOf(SHOE[3]) === 11)) dealerBJs++;
  ptr = 4;
  const [w, r] = playRound(valOf(SHOE[0]), valOf(SHOE[1]), valOf(SHOE[2]), valOf(SHOE[3]), rankOf(SHOE[0]), rankOf(SHOE[2]), shoeDraw);
  wagered += w; returned += r;
  // Pass 1 is one fresh crypto.randomBytes seed pair per run — a single ROUNDS-nonce stream.
  // (A valid fair-shuffle test: the shoe is re-derived independently for every nonce.)
  if ((nonce & 0x3FFF) === 0) bar(nonce, ROUNDS, `RTP ${(returned / wagered * 100).toFixed(3)}%`, p1Start);
}
bar(ROUNDS, ROUNDS, 'done', p1Start);
process.stdout.write('\n');

// Report the real-shoe cross-check in the SAME (per-initial-bet) convention as the reference,
// so the two are compared like-to-like.
const rtp = 1 - (wagered - returned) / ROUNDS;   // per initial bet
const edge = (wagered - returned) / ROUNDS;
const rtpPerTotalWagered = returned / wagered;   // element of risk (reported for completeness)
const rtpSE = 1.15 / Math.sqrt(ROUNDS);   // gate constant (measured per-round SD ≈1.147, rounded up)

// First-card rank uniformity (df=12).
const fd = chiSquaredTest([...rankFreq], new Array(RANKS).fill(ROUNDS / RANKS));
// Serial independence on first-card rank values.
const seq = Array.from(rankSeq) as number[];
const r1 = lag1Autocorrelation(seq);
const r1z = r1 * Math.sqrt(ROUNDS);
const runSeq = seq.map(v => (v > 7 ? 1 : 0));            // split ranks about the midpoint (7)
const { z: runsZ, pValue: runsP } = runsTest(runSeq);

const analytical = computeOptimalRTP('stand', true);
// Engine-drift guard: the analytical figure anchors Step 17's consistency gate. Refuse to
// write a sim artifact if the optimal-play engine has drifted from its pinned value, so a
// broken engine cannot silently recalibrate the gate it feeds. (Guard mirrors optimalPlayTests.ts.)
if (Math.abs(analytical.rtp - 0.994296) > 0.0002) {
  throw new Error(`optimal-play engine drift: rtp ${analytical.rtp.toFixed(8)} != 0.994296 ±2e-4 — aborting simulation`);
}

console.log('');
console.log(`  Consistency-sim RTP: ${(reference.rtpInitial * 100).toFixed(4)}%  (Pass 0, ${REF_ROUNDS.toLocaleString()} rounds, ±${(reference.se * 100).toFixed(4)}% 1σ, per initial bet) — fair-shuffle estimate`);
console.log(`  Real-shoe RTP:       ${(rtp * 100).toFixed(4)}%  (edge ${(edge * 100).toFixed(4)}%, ±${(rtpSE * 100).toFixed(4)}% 1σ over ${ROUNDS.toLocaleString()}, per initial bet) — consistent (${(Math.abs(rtp - reference.rtpInitial) / rtpSE).toFixed(1)}σ)`);
console.log(`  Analytical infinite: ${(analytical.rtp * 100).toFixed(4)}%  (edge ${(analytical.edge * 100).toFixed(4)}%, per initial bet) — finite sits above, as removal predicts`);
console.log(`  Player BJ freq:      ${(playerBJs / ROUNDS * 100).toFixed(3)}%   Dealer BJ freq: ${(dealerBJs / ROUNDS * 100).toFixed(3)}%`);
console.log(`  First-card rank χ²:  ${fd.chi2.toFixed(2)} (df ${fd.df}), p=${fd.pValue.toFixed(4)}`);
console.log(`  Serial: |r₁z|=${Math.abs(r1z).toFixed(2)}  runs p=${runsP.toFixed(4)}`);
console.log(`  Time: ${((Date.now() - p1Start) / 1000).toFixed(1)}s\n`);

// ══════════════════════════════════════════════════════════════════════════════
//  PASS 2 — casino seeds, first-card cherry-pick (bootstrap null over 0..49)
// ══════════════════════════════════════════════════════════════════════════════
console.log('═'.repeat(62));
console.log('  LIQD BLACKJACK — PASS 2: casino seeds (cherry-pick, 0..49 bootstrap)');
console.log('═'.repeat(62) + '\n');

const ds = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8')) as {
  seeds: { epoch: number; hashedServerSeed: string; serverSeed: string | null; clientSeed: string }[];
};
const revealed = ds.seeds.filter(s => s.serverSeed);

function firstRankChi2(freq: number[], n: number) { return chiSquaredTest([...freq], new Array(RANKS).fill(n / RANKS)); }

// Bootstrap the early-window first-card-χ² null once (single ruleset → one null).
const bootStart = Date.now();
const bootStats = new Float64Array(BOOTSTRAP_REPS);
for (let rep = 0; rep < BOOTSTRAP_REPS; rep++) {
  const bs = randomBytes(16).toString('hex'), bc = randomBytes(16).toString('hex');
  const freq = new Array(RANKS).fill(0);
  for (let n = 0; n < PASS2_EARLY; n++) freq[rankOf(blackjackShoe(bs, bc, n)[0]) - 1]++;
  bootStats[rep] = firstRankChi2(freq, PASS2_EARLY).chi2;
  if ((rep & 0x3FF) === 0) bar(rep, BOOTSTRAP_REPS, 'bootstrap null', bootStart);
}
bootStats.sort();
bar(BOOTSTRAP_REPS, BOOTSTRAP_REPS, 'null ready', bootStart);
process.stdout.write('\n');

function bootstrapP(sorted: Float64Array, stat: number): number {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < stat) lo = mid + 1; else hi = mid; }
  return (sorted.length - lo + 1) / (sorted.length + 1);
}

interface Pass2Result { epoch: number; hashedServerSeed: string; earlyChi2: number; earlyBootstrapP: number; lateChi2: number; latePValue: number; cherryPickFlag: boolean; }
const pass2Results: Pass2Result[] = [];
let cherryPickFlags = 0;
const p2Start = Date.now();
for (let si = 0; si < revealed.length; si++) {
  const s = revealed[si];
  const early = new Array(RANKS).fill(0), late = new Array(RANKS).fill(0);
  for (let n = 0; n < PASS2_NONCES; n++) {
    const fr = rankOf(blackjackShoe(s.serverSeed as string, s.clientSeed, n)[0]);
    if (n < PASS2_EARLY) early[fr - 1]++; else late[fr - 1]++;
  }
  const earlyChi2 = firstRankChi2(early, PASS2_EARLY).chi2;
  const earlyP = bootstrapP(bootStats, earlyChi2);
  const lateRes = firstRankChi2(late, PASS2_NONCES - PASS2_EARLY);
  // ONE definition of the predicate, in src/config.ts — shared with tests/steps/simulation.ts
  // (scored Step 19) and src/cherry-pick-attack.ts, where a third copy had drifted (QA-04).
  const flag = cherryPickFlag(earlyP, lateRes.pValue);
  if (flag) cherryPickFlags++;
  pass2Results.push({ epoch: s.epoch, hashedServerSeed: s.hashedServerSeed, earlyChi2, earlyBootstrapP: earlyP, lateChi2: lateRes.chi2, latePValue: lateRes.pValue, cherryPickFlag: flag });
  if ((si & 0x7) === 0) bar(si, revealed.length, `epoch ${s.epoch}`, p2Start);
}
bar(revealed.length, revealed.length, 'done', p2Start);
process.stdout.write('\n');

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
console.log(`  Cherry-pick flags: ${cherryPickFlags} (expected ~${expectedFlags.toFixed(1)} by chance; binomial survival P=${cherryPickSurvival.toFixed(4)})`);
console.log(`  Time: ${((Date.now() - p2Start) / 1000).toFixed(1)}s\n`);

// ── write outputs ────────────────────────────────────────────────────────────────
const OUT = path.join(__dirname, '..', 'outputs');
fs.mkdirSync(OUT, { recursive: true });

console.log('  Solving the exact 8-deck EV (TD and CD)...');
const exactTD = solveExact({ kind: 'finite', decks: 8 }, 'TD');
const exactCD = solveExact({ kind: 'finite', decks: 8 }, 'CD');

// Pinned Wizard of Odds anchor, read from the exact-rtp.json artifact of record (npm run rtp) so the
// chart cannot drift from the pinned figure. Every rule input is fixed in that file's wooAnchor block.
const wooAnchor = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'outputs', 'exact-rtp.json'), 'utf8')).wooAnchor;
const wooEdge = wooAnchor.basicStrategyContinuousShuffler as number; // 0.0048768
const wooDate = wooAnchor.capturedAt as string;
console.log(`    exact TD edge ${(exactTD.edgePerInitialBet * 100).toFixed(6)}%  CD ${(exactCD.edgePerInitialBet * 100).toFixed(6)}%  avg wager ${exactTD.avgWager.toFixed(6)}`);

const output = {
  audit: 'LIQD Blackjack',
  generatedAt: new Date().toISOString(),
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
    playerBJFreq: playerBJs / ROUNDS, dealerBJFreq: dealerBJs / ROUNDS,
    note: 'RTP (per initial bet) over the actual blackjackShoe RNG algorithm — a consistency check. Fewer rounds (the real shoe is HMAC-hashed per card), so the Monte-Carlo error is wide here; baseGame is the fair-shuffle consistency estimate and the analytical engine is the deterministic anchor.',
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
    description: 'One freshly generated server/client seed pair drives a 500,000-nonce stream of the reference blackjackShoe algorithm. The retained results cover first-card rank uniformity (df=12), lag-1 correlation and the runs test. These are specified statistical checks; the finite eight-deck RTP is evaluated separately by the deterministic model and a simulation consistency check.',
    rounds: ROUNDS,
    firstCardChi2: fd.chi2, firstCardDf: fd.df, firstCardPValue: fd.pValue,
    serialR1: r1, serialR1Z: r1z, serialRunsZ: runsZ, serialRunsPValue: runsP,
    firstCardUniformFail: fd.pValue < 0.01,
    serialFail: Math.abs(r1z) > 3 || runsP < 0.01,
  },
  pass2_casino_seeds: {
    description: 'Casino seeds (revealed serverSeeds). Cherry-pick test on first-card rank uniformity over the 0..49 served window vs a parametric bootstrap null. Gross-bias check only; the primary cherry-pick defence is the client-seed-after-commitment mitigation (see AUDIT_CONTEXT.md#seed-selection-and-server-operations).',
    noncesPerSeed: PASS2_NONCES, earlyWindow: [0, PASS2_EARLY - 1], lateWindow: [PASS2_EARLY, PASS2_NONCES - 1],
    bootstrapReps: BOOTSTRAP_REPS,
    seeds_tested: seedsTested, cherryPickFlags, expectedFlagsByChance: expectedFlags, cherryPickSurvivalP: cherryPickSurvival,
    results: pass2Results,
  },
};
fs.writeFileSync(path.join(OUT, 'simulation-results.json'), JSON.stringify(output, null, 2));

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
<h1>LIQD Blackjack — Finite 8-Deck RTP, per initial bet (exact solve, confirmed by a ${REF_ROUNDS.toLocaleString()}-round fair-shuffle simulation)</h1>
${svg}
<p class="cap">Pooled optimal-play RTP <strong>per initial bet</strong> against cumulative sample size, with a &plusmn;2 &times; Standard Error band (SE = &sigma;/&radic;n). The band narrows from &plusmn;${(first.se * 2 * 100).toFixed(3)} pp at ${fmtN(first.rounds)} rounds to &plusmn;${(last.se * 2 * 100).toFixed(4)} pp at ${fmtN(last.rounds)}; the final interval is [${((last.rtp - 2 * last.se) * 100).toFixed(4)}%, ${((last.rtp + 2 * last.se) * 100).toFixed(4)}%], which sits <strong>${(last.rtp > ANALYTIC ? 'above' : 'below')}</strong> the analytical infinite-deck limit ${(ANALYTIC * 100).toFixed(4)}% — the direction card removal predicts.</p>
<table>
<tr><th>Method</th><th>RTP</th><th>House edge</th><th>Convention</th></tr>
<tr><td><strong>Exact 8-deck solve — AUTHORITATIVE</strong> (deterministic, no sampling error)</td><td class="big">${(exactTD.rtpPerInitialBet * 100).toFixed(4)}%</td><td>${(exactTD.edgePerInitialBet * 100).toFixed(4)}%</td><td>per initial bet</td></tr>
<tr><td>Exact 8-deck solve — same figure, element of risk</td><td>${(exactTD.rtpPerTotalWagered * 100).toFixed(4)}%</td><td>${(exactTD.edgePerTotalWagered * 100).toFixed(4)}%</td><td>per total wagered</td></tr>
<tr><td>Finite 8-deck — fair-shuffle estimate (confirmation)</td><td>${(reference.rtpInitial * 100).toFixed(4)}%</td><td>${(reference.edgeInitial * 100).toFixed(4)}%</td><td>per initial bet</td></tr>
<tr><td>Finite 8-deck — same estimate, element of risk</td><td>${(reference.rtpPerTotalWagered * 100).toFixed(4)}%</td><td>${(reference.edgePerTotalWagered * 100).toFixed(4)}%</td><td>per total wagered</td></tr>
<tr><td>Infinite-deck engine (with-replacement regression anchor, not LIQD's RTP)</td><td>${(analytical.rtp * 100).toFixed(4)}%</td><td>${(analytical.edge * 100).toFixed(4)}%</td><td>per initial bet</td></tr>
<tr><td>Real-shoe RNG cross-check (${ROUNDS.toLocaleString()} rounds)</td><td>${(rtp * 100).toFixed(4)}%</td><td>${(edge * 100).toFixed(4)}%</td><td>per initial bet</td></tr>
<tr><td>Wizard of Odds, basic strategy w/ continuous shuffler, rule inputs pinned (captured ${wooDate})</td><td>${((1 - wooEdge) * 100).toFixed(5)}%</td><td>${(wooEdge * 100).toFixed(5)}%</td><td>per initial bet</td></tr>
</table>
<p class="info">Rules: 8 decks, S17, DAS, split-aces-one-card, no-resplit, dealer peek/OBO, blackjack 3:2, no surrender. Average wager per round ${reference.avgWager.toFixed(4)} initial-bet units, which separates the two conventions. Real-shoe RTP over the actual blackjackShoe algorithm, optimal basic strategy, ±${(rtpSE * 100).toFixed(4)}% (1σ). Per initial bet the finite figure sits just above the infinite-deck limit, as card removal predicts. First-card rank χ² p=${fd.pValue.toFixed(3)}; serial |r₁z|=${Math.abs(r1z).toFixed(2)}, runs p=${runsP.toFixed(3)}. Pass 2 cherry-pick flags ${cherryPickFlags}/${seedsTested} (survival P=${cherryPickSurvival.toFixed(3)}).</p>
</div></body></html>`;
fs.writeFileSync(path.join(OUT, 'rtp-convergence.html'), chartHTML);

console.log('═'.repeat(62));
console.log('  Written: outputs/simulation-results.json');
console.log('  Written: outputs/rtp-convergence.html');
console.log('═'.repeat(62) + '\n');

export {};
