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

import * as fs from 'fs';
import * as path from 'path';

import { createHash } from 'crypto';

import { loadDataset, datasetHash, DATA_PATH } from '../src/loader';
import {
  DATASET_SHA256, SIMULATION_SHA256, SIMULATION_HTML_SHA256, EXACT_RTP_SHA256,
  ATTACK_SHA256, RNG_BRANCH_SHA256,
} from '../src/config';
import { buildReportFiguresArtifact, REPORT_FIGURES_HEADER } from '../src/report-figures';
import type { Bet, Seed, StepResult, InfoItem } from '../src/types';
import type { VerifyContext } from './steps/context';

import * as commitment from './steps/commitment';
import * as parity from './steps/parity';
import * as payouts from './steps/payouts';
import * as rules from './steps/rules';
import * as sidebets from './steps/sidebets';
import * as simulation from './steps/simulation';
import * as houseedge from './steps/houseedge';
import * as standardization from './steps/standardization';

const OUTPUTS_DIR = path.join(__dirname, '../outputs');

console.log('\n══════════════════════════════════════════════════════════');
console.log('  LIQD BLACKJACK — VERIFICATION SUITE');
console.log('══════════════════════════════════════════════════════════\n');

const ds = loadDataset();
const bets: Bet[] = ds.bets;
const seeds: Seed[] = ds.seeds;

// seedMap: hashedServerSeed → revealed serverSeed; seedByHash: → the Seed record
const seedMap = new Map<string, string>();
const seedByHash = new Map<string, Seed>();
for (const s of seeds) {
  seedByHash.set(s.hashedServerSeed, s);
  if (s.serverSeed) seedMap.set(s.hashedServerSeed, s.serverSeed);
}

// Ensure every bet carries its epoch client seed (fill from the Seed record if absent).
for (const b of bets) {
  if (!b.clientSeed) b.clientSeed = seedByHash.get(b.hashedServerSeed)?.clientSeed;
}

const byHash = new Map<string, Bet[]>();
for (const b of bets) {
  const arr = byHash.get(b.hashedServerSeed) ?? [];
  arr.push(b);
  byHash.set(b.hashedServerSeed, arr);
}

const ctx: VerifyContext = {
  bets, seeds, seedMap, seedByHash, byHash, meta: ds.meta,
  phaseA: bets.filter((b) => b.phase === 'A'),
  phaseB: bets.filter((b) => b.phase === 'B'),
  phaseC: bets.filter((b) => b.phase === 'C'),
  phaseD: bets.filter((b) => b.phase === 'D'),
  phaseE: bets.filter((b) => b.phase === 'E'),
  phaseF: bets.filter((b) => b.phase === 'F'),
  outputsDir: OUTPUTS_DIR,
};

const results: StepResult[] = [];
const info: InfoItem[] = [];

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
const hashIfPresent = (p: string): string | undefined =>
  fs.existsSync(p) ? createHash('sha256').update(fs.readFileSync(p)).digest('hex') : undefined;
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
  for (const it of info) console.log(`    • ${it.label}: ${it.detail}`);
  console.log('');
}
const verdict = failed > 0 ? 'NOT PROVABLY FAIR' : flags > 0 ? 'PROVABLY FAIR — Conditional Pass' : 'PROVABLY FAIR — Full Pass';
console.log(`  Passed: ${passed}/${results.length}${flags ? `  (${flags} flag)` : ''}${failed ? `  (${failed} FAIL)` : ''}`);
console.log(`  Verdict: ${verdict}`);
console.log('══════════════════════════════════════════════════════════\n');

// artifact hashes
const artifactHashes: Record<string, string> = { dataset: datasetHash() };
if (simArtifactHash) {
  artifactHashes['simulation'] = simArtifactHash;
  artifactHashes['simulationPinned'] = SIMULATION_SHA256;
  artifactHashes['simulationFreshRun'] = String(simFresh);
}
if (simHtmlHash) {
  artifactHashes['simulationHtml'] = simHtmlHash;
  artifactHashes['simulationHtmlPinned'] = SIMULATION_HTML_SHA256;
}
if (exactRtpHash) {
  artifactHashes['exactRtp'] = exactRtpHash;
  artifactHashes['exactRtpPinned'] = EXACT_RTP_SHA256;
}
if (attackHash) {
  artifactHashes['cherryPickAttack'] = attackHash;
  artifactHashes['cherryPickAttackPinned'] = ATTACK_SHA256;
}
if (branchHash) {
  artifactHashes['rngBranchCoverage'] = branchHash;
  artifactHashes['rngBranchCoveragePinned'] = RNG_BRANCH_SHA256;
}

fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
fs.writeFileSync(path.join(OUTPUTS_DIR, 'verification-results.json'),
  JSON.stringify({ audit: 'LIQD Blackjack', datasetSha256: DATASET_SHA256, artifactHashes, verdict, passed, total: results.length, flags, failed, results, info }, null, 2));

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
  fs.writeFileSync(path.join(OUTPUTS_DIR, 'report-figures.json'),
    JSON.stringify(buildReportFiguresArtifact(ds), null, 2));
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.log(`  (report-figures.json NOT emitted: ${message} — see Step 25, which scores the same recomputation)`);
  fs.writeFileSync(path.join(OUTPUTS_DIR, 'report-figures.json'),
    JSON.stringify({
      audit: REPORT_FIGURES_HEADER.audit,
      what: 'Figures cited in the report chapters. NOT PRODUCED on this run.',
      datasetSha256: DATASET_SHA256,
      error: message,
    }, null, 2));
}

// Exit status encodes the verdict for CI / pre-publish hooks / anyone reading $?:
//   0 = Full Pass   ·   2 = Conditional Pass (one or more FLAG steps)   ·   1 = FAIL.
// A FLAG previously exited 0, so a 5σ RTP miss or a doctored χ² printed "Conditional Pass" and
// still returned success. See README (Reproducibility) for the code table.
if (failed > 0) process.exit(1);
if (flags > 0) process.exit(2);
