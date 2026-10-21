/**
 * THE SIMULATION'S THREE EXPERIMENTS, AS PURE FUNCTIONS OF A MASTER SEED.
 *
 * Every random input the simulation consumes is derived here from one recorded master seed
 * (`src/seed-derivation.ts` deriveSeedHex), so each experiment is a deterministic function `(master, size) →
 * statistics`. `src/simulate.ts` calls these to PRODUCE `outputs/simulation-results.json`;
 * `src/deep-replay.ts` and scored Steps 17–19 call the same functions to REPRODUCE it from the
 * master seed the artifact carries.
 *
 * ONE IMPLEMENTATION, TWO CALLERS — deliberately. A replay that runs a second copy of the pass
 * logic tests two things at once and cannot tell a genuine artifact mismatch from a drifted
 * copy; `src/round-engine.ts` documents what that costs. The claim this module supports is
 * narrow and exact: **the committed statistics are what this repo's code produces from the
 * recorded seed.** The INDEPENDENT claim — that the statistics are what the stated method
 * produces, in code that shares nothing with this repo — is carried by
 * `replay/replay-bootstrap.py`, a Python standard-library re-implementation that imports
 * nothing from here.
 *
 * SIDE-EFFECT FREE. Importing this module runs no simulation and draws no randomness. That is
 * why the pass logic lives here rather than in `src/simulate.ts`, which is a top-level script:
 * a test or a replay tool could not import a function out of a file that starts a 30M-round
 * Monte-Carlo on import.
 */

import { blackjackShoe } from './rng';
import { deriveSeedHex, SEED_DOMAINS } from './seed-derivation';
import { buildRankShoe, createLazyShuffler } from './shuffle';
import { playRound, settleShoe } from './round-engine';
import { xoshiro128ss } from './prng';
import { chiSquaredTest, runsFromCounts } from './stats';
import { RANKS, SIM_SD_PER_ROUND, PASS1_ROW_NONCES } from './config';

/** Card value from a rank 1..13: A=11, 10/J/Q/K=10, else pip. */
const rval = (r: number): number => (r === 1 ? 11 : r >= 10 ? 10 : r);
const rankOf = (card: string): number => Number(card.slice(card.indexOf(':') + 1));
const valOf = (card: string): number => rval(rankOf(card));

export interface Checkpoint { rounds: number; rtp: number; se: number }

export interface Pass0Result {
  /** Per initial bet — the convention Wizard of Odds, the exact solver and the advertised figure use. */
  rtpInitial: number; edgeInitial: number;
  /** Per total amount wagered — the "element of risk". */
  rtpPerTotalWagered: number; edgePerTotalWagered: number;
  avgWager: number; se: number;
  /** MEASURED per-round SD of the per-initial-bet loss (the gate uses the rounded-up constant). */
  sdPerRound: number;
  checkpoints: Checkpoint[];
}

/**
 * The decade-spaced cumulative checkpoints the convergence chart plots. Derived from `rounds`
 * alone so a replay of a prefix and the full run agree on where the marks are.
 */
export function checkpointMarks(rounds: number): Set<number> {
  const marks: number[] = [];
  for (let n = 1_000; n < rounds; n *= 10) { marks.push(n); marks.push(n * 3); }
  return new Set(marks.filter((n) => n < rounds));
}

/**
 * PASS 0 — finite-8-deck RTP over a fair shuffle, `rounds` rounds, driven by the deterministic
 * xoshiro128** stream seeded from `master` under domain `pass0-reference-shuffle`.
 *
 * LAZY (incremental) Fisher-Yates: the shuffle frontier advances on demand, so position k is
 * fixed by a uniform draw from [k, M) the first time it is read — exact uniformity at ANY depth,
 * no round-depth constant to be wrong about. (An earlier version pre-shuffled a fixed 24-card
 * prefix and read past it; `src/shuffle.ts` carries that history.)
 *
 * Determinism note: the number of draws a round consumes depends on the cards it sees, so the
 * stream position after round i is itself a function of the seed — which is exactly why a prefix
 * replay (`rounds` smaller) reproduces the committed checkpoint at that same `rounds` and not
 * the later ones. Step 17 uses that property as a cheap binding.
 */
export function replayPass0(
  master: string,
  rounds: number,
  onProgress?: (done: number, rtpSoFar: number) => void,
): Pass0Result {
  const stream = xoshiro128ss(deriveSeedHex(master, SEED_DOMAINS.pass0Shuffle, 0, 16));
  const RANK = buildRankShoe(8);
  const shuffler = createLazyShuffler(RANK, (n: number) => stream.below(n));
  let rp = 4;
  const rdraw = (): number => { shuffler.ensure(rp); return rval(RANK[rp++]); };

  const markSet = checkpointMarks(rounds);
  const checkpoints: Checkpoint[] = [];

  // W = total amount wagered (initial + double/split stakes); R = total returned (incl. stake).
  // Each round posts exactly one initial bet unit, so `rounds` is the total INITIAL amount staked.
  //   edge per initial bet   = (W - R) / rounds        (the standard blackjack "house edge")
  //   edge per total wagered = (W - R) / W             (the "element of risk")
  // sumSq accumulates the squared per-round per-initial-bet LOSS so the per-round SD is MEASURED.
  let W = 0, R = 0, sumSq = 0;
  for (let i = 0; i < rounds; i++) {
    shuffler.reset();                // new round: frontier back to 0, arrangement kept
    shuffler.ensure(3);              // fix the four dealt cards
    rp = 4;
    const [w, r] = playRound(rval(RANK[0]), rval(RANK[1]), rval(RANK[2]), rval(RANK[3]), RANK[0], RANK[2], rdraw);
    W += w; R += r;
    const loss = w - r; sumSq += loss * loss;
    const n = i + 1;
    // SE reported on the gate constant (SIM_SD_PER_ROUND), NOT on the simulator's own measured
    // SD — the verifier must not let the instrument set its own tolerance.
    if (markSet.has(n)) checkpoints.push({ rounds: n, rtp: 1 - (W - R) / n, se: SIM_SD_PER_ROUND / Math.sqrt(n) });
    if (onProgress && (n & 0x3F_FFFF) === 0) onProgress(n, 1 - (W - R) / n);
  }
  const rtpInitial = 1 - (W - R) / rounds;
  const se = SIM_SD_PER_ROUND / Math.sqrt(rounds);
  const meanLoss = (W - R) / rounds;
  checkpoints.push({ rounds, rtp: rtpInitial, se });
  return {
    rtpInitial, edgeInitial: (W - R) / rounds,
    rtpPerTotalWagered: R / W, edgePerTotalWagered: (W - R) / W,
    avgWager: W / rounds, se,
    sdPerRound: Math.sqrt(Math.max(0, sumSq / rounds - meanLoss * meanLoss)),
    checkpoints,
  };
}

export interface Pass1Result {
  serverSeed: string; clientSeed: string;
  rtp: number; edge: number; rtpPerTotalWagered: number;
  playerBJFreq: number; dealerBJFreq: number;
  rankFreq: number[];
  /** Census, exact: rounds with a player natural / a dealer natural; Σ wagered and Σ returned in initial-bet units. */
  playerBJs: number; dealerBJs: number; wagered: number; returned: number;
  /** Runs of the bit x > 7 over the whole stream, and nonces with the bit set. */
  runs: number; highs: number;
  firstCardChi2: number; firstCardDf: number; firstCardPValue: number;
  serialR1: number; serialR1Z: number; serialRunsZ: number; serialRunsPValue: number;
}

/** One contiguous nonce range of the Pass-1 stream — the unit a replay worker runs. */
export interface Pass1Job { kind: 'p1'; serverSeed: string; clientSeed: string; from: number; to: number }

/**
 * THE PASS-1 CENSUS ROW — what one contiguous nonce range [from, to) produces, as EXACT integers
 * (and sums of multiples of 0.5, exact in float64). Every Pass-1 statistic is a function of the
 * rows alone (`pass1Statistics`), so scored Step 18 re-derives all of them from the artifact's rows
 * without the 1,000,000-card first-rank sequence, and ranges add exactly, so the split cannot move a
 * figure. `x` is the first card's rank 1..13; the runs bit is x > 7 (split about the midpoint).
 */
export interface Pass1Row {
  from: number; to: number;
  /** First-card rank counts, A..K. */
  rankFreq: number[];
  /** Σx, Σx², and Σ x_i·x_(i+1) over consecutive nonces INSIDE the range. */
  sumX: number; sumX2: number; lagSum: number;
  /** x at `from` and at `to − 1` — joins the lag sum across a range boundary. */
  firstX: number; lastX: number;
  /** Runs of the bit x > 7 inside the range, and how many nonces have the bit set. */
  runs: number; highs: number;
  /** Σ wagered and Σ returned in initial-bet units; rounds with a player / a dealer natural. */
  wagered: number; returned: number; playerBJs: number; dealerBJs: number;
}
export type Pass1Chunk = Pass1Row & { kind: 'p1' };

/**
 * PASS 1, one nonce range [from, to) — the REAL `blackjackShoe` algorithm, played to settlement
 * under the declared basic strategy. A full Pass 1 is `pass1Statistics` over the rows that tile
 * 0 … rounds−1 in PASS1_ROW_NONCES ranges; `replayPass1` runs them in-process, the worker pool
 * (src/replay-pool.ts) in parallel.
 */
export function pass1Chunk(job: Pass1Job, onProgress?: (done: number, rtpSoFar: number) => void): Pass1Chunk {
  const { serverSeed, clientSeed, from, to } = job;
  const rankFreq = new Array<number>(RANKS).fill(0);
  let wagered = 0, returned = 0, playerBJs = 0, dealerBJs = 0;
  let sumX = 0, sumX2 = 0, lagSum = 0, firstX = 0, prevX = 0, runs = 0, highs = 0;
  let prevBit = -1;
  let SHOE: string[] = [];
  let ptr = 4;
  const shoeDraw = (): number => valOf(SHOE[ptr++]);

  for (let nonce = from; nonce < to; nonce++) {
    SHOE = blackjackShoe(serverSeed, clientSeed, nonce);
    const x = rankOf(SHOE[0]);
    rankFreq[x - 1]++;
    sumX += x; sumX2 += x * x;
    if (nonce === from) firstX = x; else lagSum += prevX * x;
    prevX = x;
    const bit = x > 7 ? 1 : 0;
    if (bit === 1) highs++;
    if (bit !== prevBit) { runs++; prevBit = bit; }
    if (valOf(SHOE[0]) + valOf(SHOE[2]) === 21) playerBJs++;
    if (valOf(SHOE[1]) + valOf(SHOE[3]) === 21 && (valOf(SHOE[1]) === 11 || valOf(SHOE[3]) === 11)) dealerBJs++;
    ptr = 4;
    const [w, r] = playRound(valOf(SHOE[0]), valOf(SHOE[1]), valOf(SHOE[2]), valOf(SHOE[3]), rankOf(SHOE[0]), rankOf(SHOE[2]), shoeDraw);
    wagered += w; returned += r;
    if (onProgress && (nonce & 0x3FFF) === 0) onProgress(nonce, returned / wagered);
  }
  return {
    kind: 'p1', from, to, rankFreq, sumX, sumX2, lagSum, firstX, lastX: prevX, runs, highs,
    wagered, returned, playerBJs, dealerBJs,
  };
}

/** A row as the artifact records it — the census fields only, in a fixed key order. */
export function pass1RowOf(c: Pass1Row): Pass1Row {
  return {
    from: c.from, to: c.to, rankFreq: [...c.rankFreq], sumX: c.sumX, sumX2: c.sumX2, lagSum: c.lagSum,
    firstX: c.firstX, lastX: c.lastX, runs: c.runs, highs: c.highs,
    wagered: c.wagered, returned: c.returned, playerBJs: c.playerBJs, dealerBJs: c.dealerBJs,
  };
}

/** Why a set of rows is not a Pass-1 census of 0 … rounds−1 (tiling, internal consistency), or null. */
export function pass1RowsProblem(rows: Pass1Row[], rounds: number): string | null {
  let at = 0;
  for (const c of rows) {
    const n = c.to - c.from;
    if (c.from !== at || !(n > 0)) return `rows do not tile 0…${rounds - 1}: gap, overlap or reorder at nonce ${at}`;
    if (!Array.isArray(c.rankFreq) || c.rankFreq.length !== RANKS || c.rankFreq.some((v) => !Number.isInteger(v) || v < 0)) return `row ${c.from}: rankFreq is not ${RANKS} non-negative integers`;
    if (c.rankFreq.reduce((a, b) => a + b, 0) !== n) return `row ${c.from}: rankFreq sums to ${c.rankFreq.reduce((a, b) => a + b, 0)}, not the row's ${n} nonces`;
    const sx = c.rankFreq.reduce((a, v, i) => a + v * (i + 1), 0);
    const sx2 = c.rankFreq.reduce((a, v, i) => a + v * (i + 1) * (i + 1), 0);
    if (c.sumX !== sx || c.sumX2 !== sx2) return `row ${c.from}: sumX/sumX2 disagree with its own rankFreq`;
    const hi = c.rankFreq.slice(7).reduce((a, b) => a + b, 0);
    if (c.highs !== hi) return `row ${c.from}: highs ${c.highs} disagrees with its own rankFreq (${hi})`;
    if (!(c.runs >= 1 && c.runs <= n) || !Number.isInteger(c.firstX) || !Number.isInteger(c.lastX)) return `row ${c.from}: runs/firstX/lastX out of range`;
    at = c.to;
  }
  return at === rounds ? null : `rows cover ${at} nonces, expected ${rounds}`;
}

/**
 * EVERY Pass-1 statistic, from the census rows alone (exact integer sums; the only floating point is
 * the final arithmetic). ONE implementation for src/simulate.ts (which writes the artifact), scored
 * Step 18 (which re-derives from the artifact's rows) and src/deep-replay.ts.
 *   lag-1 r₁ = Σ(x_i − m)(x_(i+1) − m) / Σ(x_i − m)², expanded over the sums so no sequence is needed:
 *     numerator   = L − m·(2·Σx − x_0 − x_(n−1)) + (n−1)·m²,  L = Σ x_i·x_(i+1) incl. the range joins
 *     denominator = Σx² − n·m²
 *   runs = Σ row runs − #(joins where the bit does not change); the runs test is src/stats.ts runsFromCounts.
 */
export function pass1Statistics(serverSeed: string, clientSeed: string, rounds: number, rowsIn: Pass1Row[]): Pass1Result {
  const rows = [...rowsIn].sort((a, b) => a.from - b.from);
  const problem = pass1RowsProblem(rows, rounds);
  if (problem) throw new Error(`Pass-1 census: ${problem}`);
  const rankFreq = new Array<number>(RANKS).fill(0);
  let wagered = 0, returned = 0, playerBJs = 0, dealerBJs = 0, S1 = 0, S2 = 0, L = 0, runs = 0, n1 = 0;
  for (let k = 0; k < rows.length; k++) {
    const c = rows[k];
    for (let i = 0; i < RANKS; i++) rankFreq[i] += c.rankFreq[i];
    wagered += c.wagered; returned += c.returned; playerBJs += c.playerBJs; dealerBJs += c.dealerBJs;
    S1 += c.sumX; S2 += c.sumX2; L += c.lagSum; runs += c.runs; n1 += c.highs;
    if (k > 0) {
      const prev = rows[k - 1];
      L += prev.lastX * c.firstX;
      if ((prev.lastX > 7) === (c.firstX > 7)) runs--;       // the run continues across the join
    }
  }
  const n = rounds;
  const m = S1 / n;
  const x0 = rows[0].firstX, xn = rows[rows.length - 1].lastX;
  const num = L - m * (2 * S1 - x0 - xn) + (n - 1) * m * m;
  const den = S2 - n * m * m;
  const r1 = den === 0 ? 0 : num / den;
  const { z: runsZ, pValue: runsP } = runsFromCounts(runs, n1, n);
  const fd = chiSquaredTest([...rankFreq], new Array<number>(RANKS).fill(rounds / RANKS));

  return {
    serverSeed, clientSeed,
    rtp: 1 - (wagered - returned) / rounds,            // per initial bet
    edge: (wagered - returned) / rounds,
    rtpPerTotalWagered: returned / wagered,            // element of risk
    playerBJFreq: playerBJs / rounds, dealerBJFreq: dealerBJs / rounds,
    rankFreq: [...rankFreq],
    playerBJs, dealerBJs, wagered, returned, runs, highs: n1,
    firstCardChi2: fd.chi2, firstCardDf: fd.df, firstCardPValue: fd.pValue,
    serialR1: r1, serialR1Z: r1 * Math.sqrt(rounds), serialRunsZ: runsZ, serialRunsPValue: runsP,
  };
}

/** The Pass-1 seed pair of a master seed (domains `pass1-shoe-server` / `pass1-shoe-client`, index 0). */
export function pass1SeedPair(master: string): { serverSeed: string; clientSeed: string } {
  return {
    serverSeed: deriveSeedHex(master, SEED_DOMAINS.pass1Server, 0),
    clientSeed: deriveSeedHex(master, SEED_DOMAINS.pass1Client, 0),
  };
}

/** The Pass-1 stream cut into the DECLARED rows (src/config.ts PASS1_ROW_NONCES) — the census the artifact records. */
export function pass1Jobs(master: string, rounds: number, rowNonces = PASS1_ROW_NONCES): Pass1Job[] {
  const { serverSeed, clientSeed } = pass1SeedPair(master);
  const jobs: Pass1Job[] = [];
  for (let from = 0; from < rounds; from += rowNonces) {
    jobs.push({ kind: 'p1', serverSeed, clientSeed, from, to: Math.min(rounds, from + rowNonces) });
  }
  return jobs;
}

/**
 * PASS 1 — the REAL `blackjackShoe` algorithm over `rounds` nonces of one seed pair, both halves
 * of which are derived from `master` (domains `pass1-shoe-server` / `pass1-shoe-client`, index 0).
 * This is the pass that validates the operator's shoe as a fair shuffle and — since 2026-09-24 —
 * measures RTP through the real RNG against the exact solve (BLACKJACK-20).
 *
 * The seed pair is returned so the caller can RECORD it. Before this release it was generated by
 * `crypto.randomBytes` inside the simulator and never written anywhere, so the pass could not be
 * replayed.
 */
export function replayPass1(
  master: string,
  rounds: number,
  onProgress?: (done: number, rtpSoFar: number) => void,
): Pass1Result {
  const { serverSeed, clientSeed } = pass1SeedPair(master);
  const rows = pass1Jobs(master, rounds).map((j) => pass1Chunk(j, onProgress));
  return pass1Statistics(serverSeed, clientSeed, rounds, rows);
}

// ─────────────────────────────────────────────────────────────────────────────
// PASS 2 — one revealed casino seed over PASS2_TOTAL_NONCES nonces (BLACKJACK-21).
// ─────────────────────────────────────────────────────────────────────────────

/** One revealed seed's Pass-2 replay — the unit a replay worker runs. */
export interface Pass2Job { kind: 'p2'; epoch: number; serverSeed: string; clientSeed: string; nonces: number; early: number; window: number }
/** What one seed produces: the first-card rank counts of the two windows and the net return of every money window. */
export interface Pass2SeedCensus {
  kind: 'p2'; epoch: number;
  earlyFreq: number[]; lateFreq: number[];
  /**
   * Net result (returned − wagered) of each window of `window` consecutive nonces, in HALF
   * initial-bet units so it is an exact integer: window 0 = nonces 0 … window−1 (the served range),
   * windows 1 … nonces/window − 1 the seed's later windows.
   */
  windowNet2: number[];
}

/**
 * Deal nonces 0 … nonces−1 of one revealed seed from the real shoe and play each to settlement under
 * the declared basic strategy (src/round-engine.ts settleShoe): the first card feeds the rank screen,
 * the settled net feeds the money windows. ONE implementation for src/simulate.ts (which writes the
 * artifact), scored Step 19 (which replays every seed in verify) and src/cherry-pick-attack.ts.
 */
export function pass2Seed(job: Pass2Job): Pass2SeedCensus {
  const { serverSeed, clientSeed, nonces, early, window } = job;
  const earlyFreq = new Array<number>(RANKS).fill(0);
  const lateFreq = new Array<number>(RANKS).fill(0);
  const windowNet2 = new Array<number>(Math.ceil(nonces / window)).fill(0);
  for (let n = 0; n < nonces; n++) {
    const shoe = blackjackShoe(serverSeed, clientSeed, n);
    const fr = rankOf(shoe[0]);
    if (n < early) earlyFreq[fr - 1]++; else lateFreq[fr - 1]++;
    const [w, r] = settleShoe(shoe);
    windowNet2[Math.floor(n / window)] += 2 * (r - w);
  }
  return { kind: 'p2', epoch: job.epoch, earlyFreq, lateFreq, windowNet2 };
}

/** One-sided money p-value of a seed: (1 + #{later windows with net ≤ the served window's}) / windows. */
export function moneyP(windowNet2: number[]): number {
  const served = windowNet2[0];
  let le = 0;
  for (let i = 1; i < windowNet2.length; i++) if (windowNet2[i] <= served) le++;
  return (1 + le) / windowNet2.length;
}

/**
 * PASS 2 — one bootstrap replicate of the early-window first-card χ² null.
 *
 * Replicate `rep` derives its own fair seed pair from `master` under the two bootstrap domains at
 * index `rep`, draws `earlyNonces` shoes from it, and returns the first-card rank χ². The
 * replicates are therefore ADDRESSABLE: replicate 1,317 of a published run can be recomputed on
 * its own, by anyone holding the master seed, without re-running the other 1,999.
 *
 * BIN POOLING. At `earlyNonces` = 50 the expected count per rank is 50/13 = 3.85, below 5, so
 * `chiSquaredTest` pools the two end bins and the statistic is an 11-bin χ² on df 10. The null
 * and the observed statistic go through the SAME function, so the comparison is valid; this is
 * also why the retained nulls are compared as raw χ² values and never through a pinned df.
 */
export function replayBootstrapNull(master: string, rep: number, earlyNonces: number): number {
  const bs = deriveSeedHex(master, SEED_DOMAINS.pass2BootstrapServer, rep);
  const bc = deriveSeedHex(master, SEED_DOMAINS.pass2BootstrapClient, rep);
  const freq = new Array<number>(RANKS).fill(0);
  for (let n = 0; n < earlyNonces; n++) freq[rankOf(blackjackShoe(bs, bc, n)[0]) - 1]++;
  return chiSquaredTest(freq, new Array<number>(RANKS).fill(earlyNonces / RANKS)).chi2;
}

/** Every bootstrap replicate, in GENERATION ORDER (index r = replicate r). */
export function replayBootstrapNulls(
  master: string,
  reps: number,
  earlyNonces: number,
  onProgress?: (done: number) => void,
): Float64Array {
  const out = new Float64Array(reps);
  for (let rep = 0; rep < reps; rep++) {
    out[rep] = replayBootstrapNull(master, rep, earlyNonces);
    if (onProgress && (rep & 0x3FF) === 0) onProgress(rep);
  }
  return out;
}

/**
 * The retained null file's byte layout: IEEE-754 float64, LITTLE-ENDIAN, in GENERATION ORDER.
 *
 * Generation order, not sorted order, is the deliberate choice and it is what makes the file
 * checkable cheaply. Sorted, the array can only be verified by regenerating all 2,000 replicates;
 * in generation order, index r IS replicate r, so scored Step 19 can re-derive a deterministic
 * sample of replicates and compare them in place (~1 s) while `replay/replay-bootstrap.py`
 * reproduces the whole array. The p-value uses a sorted COPY, made at read time.
 */
export function encodeNulls(values: ArrayLike<number>): Buffer {
  const buf = Buffer.alloc(values.length * 8);
  for (let i = 0; i < values.length; i++) buf.writeDoubleLE(values[i], i * 8);
  return buf;
}

/** Inverse of `encodeNulls`. Throws if the buffer is not a whole number of float64 values. */
export function decodeNulls(buf: Buffer): Float64Array {
  if (buf.length % 8 !== 0) throw new Error(`retained null file length ${buf.length} is not a multiple of 8`);
  const out = new Float64Array(buf.length / 8);
  for (let i = 0; i < out.length; i++) out[i] = buf.readDoubleLE(i * 8);
  return out;
}

/**
 * Bootstrap p-value: (#{null ≥ observed} + 1) / (reps + 1), computed on a SORTED copy of the
 * retained nulls. Identical arithmetic to the producer's binary search, which is the point —
 * `earlyBootstrapP` is now a function of the retained file, so it can be recomputed rather than
 * taken on trust.
 */
export function bootstrapP(sortedNulls: Float64Array, stat: number): number {
  let lo = 0, hi = sortedNulls.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sortedNulls[mid] < stat) lo = mid + 1; else hi = mid; }
  return (sortedNulls.length - lo + 1) / (sortedNulls.length + 1);
}

/** A sorted ascending copy — never sorts the caller's generation-order array in place. */
export function sortedCopy(nulls: Float64Array): Float64Array {
  const c = Float64Array.from(nulls);
  c.sort();
  return c;
}
