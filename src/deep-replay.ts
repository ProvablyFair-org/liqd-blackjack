/**
 * DEEP REPLAY — re-run the three simulation passes from the committed master seed and
 * compare every published statistic, field by field.
 *
 *     npx ts-node src/deep-replay.ts            → outputs/run/deep-replay-report.json
 *     npx ts-node src/deep-replay.ts --commit   → outputs/deep-replay-report.json (artifact of record)
 *
 * WHY IT IS NOT PART OF `npm run verify`. Pass 0 is 30,000,000 rounds, Pass 1 is 1,000,000
 * HMAC-shuffled shoes and Pass 2 is 120 revealed seeds × 10,000 more (≈18 core-minutes of shoes,
 * run here in parallel worker processes, src/replay-pool.ts). The scored run binds these passes
 * with a DECLARED SAMPLE — Step 17 re-draws the first convergence checkpoint, Step 18 re-deals the
 * first and last Pass-1 census rows, Step 19 re-deals every seed's served window and one declared
 * later window — and re-derives every statistic from the rows; this tool re-deals ALL of it.
 *
 * WHAT A PASS PROVES. That the committed Pass-0, Pass-1 and Pass-2 census figures are exactly what this repo's
 * code produces from the recorded master seed and the revealed seeds: the inputs are retained and sufficient. It does
 * not, on its own, establish that the METHOD is what the report describes — that is what the
 * independent Python replay (`replay/replay-bootstrap.py`) is for on the Pass-2 half, and what
 * the exact-solver and Wizard of Odds anchors are for on the RTP half.
 *
 * EXACT EQUALITY on all but two of the 282 values. All three passes are deterministic functions of
 * the seed and run the same IEEE-754 operations in the same order, so every comparison is `===`
 * except the two libm-derived Pass-1 p-values (firstCardPValue, serialRunsPValue), which are held to
 * the reproduction bound 1e-14 absolute + 1e-12 relative (see sameLibm below). A wider tolerance
 * would only mask a real divergence.
 *
 * READ-ONLY on everything it checks: it never rewrites the simulation artifact, the provenance
 * record or the retained nulls. `--commit` writes the report and nothing else.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'node:crypto';

import { isMasterSeed, SEED_DERIVATION_VERSION, deriveSeedHex, SEED_DOMAINS } from './seed-derivation';
import { replayPass0, pass1Jobs, pass1RowOf, pass1Statistics, Checkpoint } from './replay';
import type { Pass1Chunk, Pass2SeedCensus } from './replay';
import { SIM_BASE_ROUNDS, SIM_PASS1_ROUNDS, PASS2_TOTAL_NONCES, PASS2_EARLY_NONCES, PASS2_WINDOW, EXPECTED_SEEDS, DEEP_REPLAY_METHOD } from './config';
import { runWorkerIfRequested, runReplayJobs } from './replay-pool';
import { numbersAgree } from './diff';

// A replay worker (src/replay-pool.ts) is this script re-run with PF_REPLAY_WORKER=1.
runWorkerIfRequested();

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'outputs');
const commit = process.argv.includes('--commit');
const reportPath = commit
  ? path.join(OUT, 'deep-replay-report.json')
  : path.join(OUT, 'run', 'deep-replay-report.json');

const mismatches: string[] = [];
function same(label: string, actual: unknown, expected: unknown): void {
  if (actual !== expected) mismatches.push(`${label}: replay ${String(actual)} != artifact ${String(expected)}`);
}
/**
 * The two Pass-1 p-values go through Math.exp / Math.log (incomplete gamma; erf), and libm is not
 * guaranteed bit-identical across platforms — 1-ulp drift on Linux has been measured for exactly
 * this class in another audit package (2026-09-28). They are held to the reproduction bound, 1e-14 absolute +
 * 1e-12 relative (src/diff.ts numbersAgree), so a replay on another machine is not reported as a
 * mismatch for drift in the last bit; anything beyond the bound still is. Every other field stays
 * exact: it is integer or pure IEEE arithmetic (+, −, ×, ÷, √), which is deterministic.
 */
function sameLibm(label: string, actual: unknown, expected: unknown): void {
  if (!(typeof actual === 'number' && typeof expected === 'number' && numbersAgree(actual, expected))) {
    mismatches.push(`${label}: replay ${String(actual)} != artifact ${String(expected)} (beyond 1e-14 abs + 1e-12 rel)`);
  }
}

const simPath = path.join(OUT, 'simulation-results.json');
const provPath = path.join(OUT, 'simulation-provenance.json');
if (!fs.existsSync(simPath)) throw new Error(`missing ${simPath} — run \`npm run simulate\` first`);
if (!fs.existsSync(provPath)) throw new Error(`missing ${provPath} — run \`npm run simulate\` first`);
const simRaw = fs.readFileSync(simPath);
const provRaw = fs.readFileSync(provPath);
const sim = JSON.parse(simRaw.toString('utf8'));
const prov = JSON.parse(provRaw.toString('utf8'));

// ── the inputs the artifact claims, checked for self-agreement before anything is re-run ──
const master: string = sim.masterSeed;
if (!isMasterSeed(master)) throw new Error(`simulation-results.json carries no usable masterSeed: ${JSON.stringify(master)}`);
same('seedDerivation (artifact)', sim.seedDerivation, SEED_DERIVATION_VERSION);
same('seedDerivation (provenance)', prov.codeVersion?.seedDerivation, SEED_DERIVATION_VERSION);
same('masterSeed (provenance)', prov.masterSeed, master);
same('provenance.simulation.sha256', prov.simulation?.sha256, createHash('sha256').update(simRaw).digest('hex'));

const refRounds: number = sim.baseGame.rounds;
const p1Rounds: number = sim.pass1_fresh_seeds.rounds;
same('baseGame.rounds vs SIM_BASE_ROUNDS pin', refRounds, SIM_BASE_ROUNDS);
same('pass1.rounds vs SIM_PASS1_ROUNDS pin', p1Rounds, SIM_PASS1_ROUNDS);

// ── Pass 1 first: cheaper, and it fails fast if the seed derivation itself is wrong ──
console.log(`Deep replay of LIQD Blackjack from master seed ${master}`);
console.log(`  Pass 1 — ${p1Rounds.toLocaleString()} real-shoe rounds ...`);
const a1 = sim.pass1_fresh_seeds;
const p1Rows = (runReplayJobs(pass1Jobs(master, p1Rounds)) as Pass1Chunk[]).map(pass1RowOf);
const p1 = pass1Statistics(deriveSeedHex(master, SEED_DOMAINS.pass1Server, 0), deriveSeedHex(master, SEED_DOMAINS.pass1Client, 0), p1Rounds, p1Rows);
same('pass1.rows.length', p1Rows.length, Array.isArray(a1.rows) ? a1.rows.length : -1);
let p1RowsBad = 0;
for (let i = 0; i < p1Rows.length; i++) {
  if (JSON.stringify(p1Rows[i]) !== JSON.stringify(a1.rows?.[i] ? pass1RowOf(a1.rows[i]) : null)) {
    p1RowsBad++;
    if (p1RowsBad <= 3) mismatches.push(`pass1.rows[${i}] (nonces ${p1Rows[i].from}…${p1Rows[i].to - 1}): re-dealt census differs from the artifact's row`);
  }
}
same('pass1.serverSeed', p1.serverSeed, a1.serverSeed);
same('pass1.clientSeed', p1.clientSeed, a1.clientSeed);
same('pass1.serverSeed (provenance)', p1.serverSeed, prov.pass1_real_shoe?.serverSeed);
same('pass1.clientSeed (provenance)', p1.clientSeed, prov.pass1_real_shoe?.clientSeed);
same('pass1.firstCardChi2', p1.firstCardChi2, a1.firstCardChi2);
same('pass1.firstCardDf', p1.firstCardDf, a1.firstCardDf);
sameLibm('pass1.firstCardPValue', p1.firstCardPValue, a1.firstCardPValue);
same('pass1.serialR1', p1.serialR1, a1.serialR1);
same('pass1.serialR1Z', p1.serialR1Z, a1.serialR1Z);
same('pass1.serialRunsZ', p1.serialRunsZ, a1.serialRunsZ);
sameLibm('pass1.serialRunsPValue', p1.serialRunsPValue, a1.serialRunsPValue);
same('pass1.rtpPerInitialBet', p1.rtp, a1.rtpPerInitialBet);
const rs = sim.realShoeConsistency;
same('realShoeConsistency.rtp', p1.rtp, rs.rtp);
same('realShoeConsistency.edge', p1.edge, rs.edge);
same('realShoeConsistency.rtpPerTotalWagered', p1.rtpPerTotalWagered, rs.rtpPerTotalWagered);
same('realShoeConsistency.playerBJFreq', p1.playerBJFreq, rs.playerBJFreq);
same('realShoeConsistency.dealerBJFreq', p1.dealerBJFreq, rs.dealerBJFreq);
console.log(`    ${p1Rows.length - p1RowsBad}/${p1Rows.length} census rows re-dealt identical`);

// ── Pass 2 — every revealed seed re-dealt over all PASS2_TOTAL_NONCES nonces ──
const ds = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'blackjack-6000hands.json'), 'utf8')) as {
  seeds: Array<{ epoch: number; hashedServerSeed: string; serverSeed: string | null; clientSeed: string }>;
};
const revealed = ds.seeds.filter((x) => x.serverSeed);
const a2 = sim.pass2_casino_seeds;
console.log(`  Pass 2 — ${revealed.length} revealed seeds × ${PASS2_TOTAL_NONCES.toLocaleString()} nonces ...`);
same('pass2.noncesPerSeed', a2.noncesPerSeed, PASS2_TOTAL_NONCES);
same('pass2.revealed seeds', revealed.length, EXPECTED_SEEDS);
const p2 = runReplayJobs(revealed.map((x) => ({
  kind: 'p2' as const, epoch: x.epoch, serverSeed: x.serverSeed as string, clientSeed: x.clientSeed,
  nonces: PASS2_TOTAL_NONCES, early: PASS2_EARLY_NONCES, window: PASS2_WINDOW,
}))) as Pass2SeedCensus[];
const rowByEpoch = new Map<number, Record<string, unknown>>((a2.results ?? []).map((r: Record<string, unknown>) => [Number(r.epoch), r]));
let p2Bad = 0;
for (const c of p2) {
  const r = rowByEpoch.get(c.epoch);
  const ok = !!r && JSON.stringify(c.earlyFreq) === JSON.stringify(r.earlyFreq)
    && JSON.stringify(c.lateFreq) === JSON.stringify(r.lateFreq) && JSON.stringify(c.windowNet2) === JSON.stringify(r.windowNet2);
  if (!ok) { p2Bad++; if (p2Bad <= 3) mismatches.push(`pass2 epoch ${c.epoch}: re-dealt census (earlyFreq, lateFreq, windowNet2) differs from the artifact's row`); }
}
console.log(`    ${p2.length - p2Bad}/${p2.length} seed censuses re-dealt identical (${(p2.length * PASS2_TOTAL_NONCES / PASS2_WINDOW).toLocaleString()} money windows)`);

// ── Pass 0 — the 30M-round reference stream ──
console.log(`  Pass 0 — ${refRounds.toLocaleString()} fair-shuffle rounds ...`);
const p0 = replayPass0(master, refRounds);
const bg = sim.baseGame;
same('baseGame.rtpInitial', p0.rtpInitial, bg.rtpInitial);
same('baseGame.edgeInitial', p0.edgeInitial, bg.edgeInitial);
same('baseGame.rtp', p0.rtpInitial, bg.rtp);
same('baseGame.edge', p0.edgeInitial, bg.edge);
same('baseGame.rtpPerTotalWagered', p0.rtpPerTotalWagered, bg.rtpPerTotalWagered);
same('baseGame.edgePerTotalWagered', p0.edgePerTotalWagered, bg.edgePerTotalWagered);
same('baseGame.avgWager', p0.avgWager, bg.avgWager);
same('baseGame.standardError', p0.se, bg.standardError);
same('baseGame.sdPerRound', p0.sdPerRound, bg.sdPerRound);
const ck: Checkpoint[] = bg.convergence;
same('baseGame.convergence.length', p0.checkpoints.length, ck.length);
for (let i = 0; i < Math.min(p0.checkpoints.length, ck.length); i++) {
  same(`baseGame.convergence[${i}].rounds`, p0.checkpoints[i].rounds, ck[i].rounds);
  same(`baseGame.convergence[${i}].rtp`, p0.checkpoints[i].rtp, ck[i].rtp);
  same(`baseGame.convergence[${i}].se`, p0.checkpoints[i].se, ck[i].se);
}

const comparisons =
  19                                  // Pass-1 scalars + seed-pair identities above
  + 1 + p1Rows.length                 // Pass-1 row count + every census row
  + 2 + p2.length                     // Pass-2 depth, seed count + every seed's census
  + 9                                 // Pass-0 scalars
  + 1 + 3 * Math.min(p0.checkpoints.length, ck.length); // checkpoint count + 3 fields each

const report = {
  method: DEEP_REPLAY_METHOD,
  scope: 'Pass 0 (fair-shuffle reference RTP), Pass 1 (all census rows of the real-shoe stream and every statistic derived from them) and Pass 2 (every revealed seed over every nonce: served and late rank counts, every money window). The Pass-2 bootstrap null and the rank statistics are also replayed INDEPENDENTLY, in Python, by replay/replay-bootstrap.py.',
  simulationSha256: createHash('sha256').update(simRaw).digest('hex'),
  provenanceSha256: createHash('sha256').update(provRaw).digest('hex'),
  masterSeed: master,
  seedDerivation: SEED_DERIVATION_VERSION,
  pass0: { rounds: refRounds, checkpointsChecked: ck.length },
  pass1: { rounds: p1Rounds, serverSeed: p1.serverSeed, clientSeed: p1.clientSeed, rowsReplayed: p1Rows.length, rowMismatches: p1RowsBad },
  pass2: { seeds: p2.length, noncesPerSeed: PASS2_TOTAL_NONCES, windowsPerSeed: PASS2_TOTAL_NONCES / PASS2_WINDOW, seedMismatches: p2Bad },
  comparisons,
  mismatches: mismatches.length,
  mismatchDetail: mismatches,
  verdict: mismatches.length === 0 ? 'PASS' : 'FAIL',
};
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');

console.log('');
if (mismatches.length === 0) {
  console.log(`PASS: ${comparisons} published values reproduced from master seed ${master} — all at exact equality except the two libm-derived Pass-1 p-values, within 1e-14 abs + 1e-12 rel.`);
} else {
  console.log(`FAIL: ${mismatches.length} of ${comparisons} values did not reproduce:`);
  for (const m of mismatches.slice(0, 20)) console.log(`  - ${m}`);
}
console.log(`Report: ${reportPath}`);
if (mismatches.length !== 0) process.exitCode = 1;

export {};
