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
import { labelFor, profileCoverageBlock, AUDIT_ID } from '../src/profile-map';
import { runRtpClaimGate, RTP_CLAIM_STEP } from '../src/rtp-settings';
import { rtpClaimVerdict, RTP_FIGURE_OVERSTATED } from '../src/rtp-claim';
import { fieldDiff, beyondTolerance, maxima, DIFF_ATOL, DIFF_RTOL } from '../src/diff';
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
/** This run's results. Never a committed artifact; gitignored. */
const RUN_DIR     = path.join(OUTPUTS_DIR, 'run');
/** PF_EMIT=1 is the ONLY thing that rewrites a committed artifact. */
const PF_EMIT     = process.env.PF_EMIT === '1';
const readJsonOrNull = (p: string): unknown => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
};

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
// src/config.ts. They are NOT enforced here, by printing an error and calling process.exit(1)
// before a single step prints.
//
// That would be a real guard and it would stop substituted artifacts — but it makes a forgery
// indistinguishable from a crash to anything reading the run. A harness scores a run that dies
// before reaching a scored step as NOT RUN, never as CAUGHT, because there is no verdict to
// read; a forgery test would report "not run" against probes this repo is in fact
// rejecting. Worse, a pin sitting inside `if (fs.existsSync(...))` lets DELETING the artifact
// skip the guard entirely and produce 31/31 · PROVABLY FAIR — Full Pass · exit 0.
//
// Both defects have one fix: reconcile the pins inside a SCORED step. Step 25 (Artifact Hash
// Integrity, tests/steps/standardization.ts) asserts presence AND hash for all ten pinned
// artifacts and hard-FAILs on either, which produces a visible `[FAIL] Step 25`, a
// NOT PROVABLY FAIR verdict and exit 1 — a result a gate, a CI job or a reader can act on.
// This block only computes the hashes for the artifactHashes record below.
//
// The DATASET pin keeps its fail-fast guard in src/loader.ts: scoring the wrong data at all is
// not something to do and then report on. Step 25 states it a second time, visibly.
const simPath = path.join(OUTPUTS_DIR, 'simulation-results.json');
const htmlPath = path.join(OUTPUTS_DIR, 'rtp-convergence.html');
const exactRtpPath = path.join(OUTPUTS_DIR, 'exact-rtp.json');
const attackPath = path.join(OUTPUTS_DIR, 'cherry-pick-attack.json');
const branchPath = path.join(OUTPUTS_DIR, 'rng-branch-coverage.json');
const hashIfPresent = (p: string): string | undefined =>
  fs.existsSync(p) ? createHash('sha256').update(fs.readFileSync(p)).digest('hex') : undefined;
const simArtifactHash = hashIfPresent(simPath);
const simHtmlHash = hashIfPresent(htmlPath);
const exactRtpHash = hashIfPresent(exactRtpPath);
const attackHash = hashIfPresent(attackPath);
const branchHash = hashIfPresent(branchPath);

{
  const { scored, info: si } = simulation.run(ctx);
  results.push(...scored);
  info.push(...si);
}
results.push(...houseedge.run(ctx));
results.push(...standardization.run(ctx));

// ── Profile labels ──────────────────────────────────────────────────────────────
// Each scored step says which ProvablyFair.org Blackjack profile check it implements, so the
// conformance matrix is DERIVED from the artifact rather than written by hand and left to go stale.
// The label is attached to the emitted record only: src/profile-map.ts cannot change what any step
// asserts, and a claim it makes that a step does not decide is a false statement in a published
// artifact, not a passing check.
const labelled = results.map((r) => ({ ...r, ...labelFor(r.step) }));

// ── RTP-CLAIM rule (1.2.0, Methodology v1.1; agreed 2026-09-29, 1.2.0 2026-10-14) ───────────────
// The per-setting exact RTP table held to the published claim (src/rtp-settings.ts). While the
// package switch RTP_CLAIM_RULE_ENFORCED (src/rtp-claim-switch.ts) is false this is printed only and no step moves; when it
// is true a miss (gate status OVERSTATED) marks the step carrying BLACKJACK-19 OVERSTATED: not a draw FAIL, not counted
// as failed, verdict RTP FIGURE OVERSTATED, exit 5 (decision D3, 2026-10-14). A committed table that no longer equals this
// run (or its pin) is a reproduction failure either way (gate status FAIL → step FAIL, exit 1).
const rtpClaim = runRtpClaimGate();
console.log('');
for (const line of rtpClaim.lines) console.log(`  ${line}`);
if (rtpClaim.status === 'FAIL' || rtpClaim.status === 'OVERSTATED') {
  // `labelled` (the emitted record) was copied from `results` above: mark the step in both, or the
  // artifact would carry it as PASS under another verdict.
  const status = rtpClaim.status;
  for (const list of [results, labelled] as any[][]) {
    const s = list.find(r => r.step === RTP_CLAIM_STEP);
    if (s) {
      s.status = status;
      s.detail += status === 'FAIL' ? ' — RTP-CLAIM: the committed table does not match this run or its pin (reproduction failure)'
        : ` — ${RTP_FIGURE_OVERSTATED} (RTP-CLAIM 1.2.0, enforced): ${rtpClaim.result.minimalFix}`;
    }
  }
  console.log(`  [${status === 'FAIL' ? 'FAIL' : RTP_FIGURE_OVERSTATED}] Step ${RTP_CLAIM_STEP} — re-scored by the enforced RTP-CLAIM rule (outcome ${rtpClaim.result.outcome})`);
}

// ── Summary ──────────────────────────────────────────────────────────────────
const passed = results.filter((r) => r.status === 'PASS').length;
const flags = results.filter((r) => r.status === 'FLAG').length;
const failed = results.filter((r) => r.status === 'FAIL').length;
const overstated = results.filter((r) => r.status === 'OVERSTATED').length;
// A capture-origin FLAG (a DECLARED auditor-side capture-retry nonce gap, Step 4) is disclosed on
// every run but is verdict-neutral; only an operator-origin FLAG downgrades to Conditional Pass
// (Framework 1.0 FLAG origin, decided 2026-09-17).
// INFO (profile policy INFORMATIONAL — the live-sample fit, decided 2026-09-29): reported, never counted
// as a flag, never enters the verdict or the exit code.
const informational = results.filter((r) => r.status === 'INFO');
const captureFlags = results.filter((r) => r.status === 'FLAG' && r.origin === 'capture');
const operatorFlags = results.filter((r) => r.status === 'FLAG' && r.origin !== 'capture');

console.log('\n──────────────────────────────────────────────────────────');
if (info.length) {
  console.log('  Informational (not scored):');
  for (const it of info) console.log(`    • ${it.label}: ${it.detail}`);
  console.log('');
}
// The rule's ranking (src/rtp-claim.ts rtpClaimVerdict): draw fail 1 > INCOMPLETE 3 > RTP FIGURE OVERSTATED 5 >
// Conditional Pass 2 > Full Pass 0. Every step has run by this line, so the run is complete.
const { verdict, exit: verdictExit } = rtpClaimVerdict({ fails: failed, complete: true, overstated: overstated > 0, opFlags: operatorFlags.length });
// An INFO step is neither passed nor failed, so "Passed: 30/31" beside "Full Pass" would read as a
// missing step: the informational count is printed on the same line.
console.log(`  Passed: ${passed}/${results.length}${informational.length ? `  (${informational.length} informational: reported, not counted)` : ''}${flags ? `  (${flags} flag: ${operatorFlags.length} verdict-affecting, ${captureFlags.length} capture-origin)` : ''}${failed ? `  (${failed} FAIL)` : ''}${overstated ? `  (RTP figure overstated: Step ${RTP_CLAIM_STEP}, not a draw fail)` : ''}`);
if (captureFlags.length) {
  console.log('  CAPTURE-ORIGIN LIMITATIONS (disclosed, verdict-neutral):');
  for (const r of captureFlags) console.log(`    ⚑ Step ${r.step}: ${r.name}`);
}
if (informational.length) {
  console.log('  INFORMATIONAL DEVIATIONS (reported, not counted, verdict unchanged):');
  for (const r of informational) console.log(`    ℹ Step ${r.step}: ${r.name}`);
}
console.log(`  Verdict: ${verdict}`);
console.log('══════════════════════════════════════════════════════════\n');

// artifact hashes
const artifactHashes: Record<string, string> = { dataset: datasetHash() };
if (simArtifactHash) {
  artifactHashes['simulation'] = simArtifactHash;
  artifactHashes['simulationPinned'] = SIMULATION_SHA256;
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

// A VERIFICATION RUN MUST NOT REWRITE THE ARTIFACT IT SCORES.
// Writing both artifacts below on top of their committed copies on every run, failing runs
// included, would let a run that disagreed with the committed evidence destroy the evidence of
// the disagreement, and the next run would compare the repo against what the failing run had
// just written. This run writes under outputs/run/; the committed copies are refreshed only by
// the explicit `PF_EMIT=1 npm run verify`.
const RESULTS_DIR = PF_EMIT ? OUTPUTS_DIR : RUN_DIR;
fs.mkdirSync(RESULTS_DIR, { recursive: true });
// ONE SUMMARY SHAPE (Framework 1.0 review item 14, F20): the counts and the verdict live in
// `summary`, in the key order scripts/release-bar.mjs declares, and nowhere else in the file.
// `hardFail` is the FAIL count; the step total is `steps.length`.
const verificationBody = {
  audit: 'LIQD Blackjack', auditId: AUDIT_ID, datasetSha256: DATASET_SHA256, artifactHashes,
  summary: {
    passed, flags, operatorFlags: operatorFlags.length, captureFlags: captureFlags.length,
    hardFail: failed, verdict,
  },
  steps: labelled, profileCoverage: profileCoverageBlock(), info,
};
fs.writeFileSync(path.join(RESULTS_DIR, 'verification-results.json'),
  JSON.stringify(verificationBody, null, 2));

// Derived report figures — the numbers chapters quote that are neither a step verdict nor a leaf
// of a pinned artifact (the live money-path reconciliation, the insurance sub-ledger, the natural
// frequency, the exact side-bet edges, the infinite-deck TD comparison). Emitted so every prose
// figure has a producing artifact instead of living only in a sentence.
//
// WRITTEN HERE, SCORED IN STEP 25. The write happens AFTER the steps have run, so Step 25 reads
// the copy that was shipped with the repo, re-derives it through the SAME builder used below, and
// fails on absence or on any field that disagrees. With nothing re-deriving it, emptying this file,
// duplicating its rows, shrinking it, setting every rtp/edge field to 0.5 or deleting it outright
// still printed 31/31 · PROVABLY FAIR — Full Pass.
// The file is an artifact of record — `.gitignore` un-ignores it, MANIFEST.md#evidence carries it
// as E21, and the overview cites it by name — so an unbound emission is exactly the shape a forger
// deletes to see whether anything notices.
//
// STILL FENCED. This emitter runs in the same process as the scored suite, so a throw in here (e.g.
// `units()` refusing an off-grid amount planted by a mutation) must never turn a scored FAIL into a
// crash, or a scored PASS into a non-zero exit. The verdict and the exit code above are decided by
// the steps alone — including Step 25, which does its own recomputation and records the same throw
// as a scored FAIL rather than as a silent gap.
let figuresBody: unknown;
try {
  figuresBody = buildReportFiguresArtifact(ds);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.log(`  (report-figures.json NOT produced: ${message} — see Step 25, which scores the same recomputation)`);
  figuresBody = {
    audit: REPORT_FIGURES_HEADER.audit,
    what: 'Figures cited in the report chapters. NOT PRODUCED on this run.',
    datasetSha256: DATASET_SHA256,
    error: message,
  };
}
fs.writeFileSync(path.join(RESULTS_DIR, 'report-figures.json'), JSON.stringify(figuresBody, null, 2));

// ── Reproduction check ────────────────────────────────────────────────────────────────────────
// THE GATE IS "BEYOND TOLERANCE", NOT "ANY FIELD". The last bits of a derived floating-point
// statistic are a property of the machine, not of the result: regenerated on other hardware a
// p-value moves by a unit in the last place. Scoring that as a disagreement trains a reader to
// ignore the diff, which is the one outcome that makes it useless. The bound is declared in
// src/diff.ts and sits far below the precision of any figure this audit publishes; outside it
// is a DIFFERENT result, and the run exits 1.
let reproductionFailures = 0;
if (!PF_EMIT) {
  const committedVerification = readJsonOrNull(path.join(OUTPUTS_DIR, 'verification-results.json'));
  const committedFigures      = readJsonOrNull(path.join(OUTPUTS_DIR, 'report-figures.json'));
  const verificationDiff = fieldDiff(committedVerification, verificationBody, []);
  const figuresDiff      = fieldDiff(committedFigures, figuresBody, []);
  const realVerification = beyondTolerance(verificationDiff);
  const realFigures      = beyondTolerance(figuresDiff);
  const realTotal        = realVerification.length + realFigures.length;
  const allDiffs         = [...verificationDiff, ...figuresDiff];
  const gap              = maxima(allDiffs);

  fs.writeFileSync(path.join(RUN_DIR, 'diff.json'), JSON.stringify({
    runtime: process.versions.node,
    verdict,
    tolerance: { atol: DIFF_ATOL, rtol: DIFF_RTOL, rule: '|a-b| <= atol + rtol*max(|a|,|b|); two distinct integers never agree' },
    reproduced: realTotal === 0,
    beyondToleranceCount: realTotal,
    withinToleranceCount: allDiffs.length - realTotal,
    largestGap: gap,
    note: 'Field-level diff between the COMMITTED artifacts and THIS RUN. Entries marked '
      + '`withinTolerance` are the same result computed on different hardware and are recorded, '
      + 'not scored. Any entry NOT so marked means this run disagrees with the committed evidence '
      + '— investigate it; do not re-run until it goes away, and do not regenerate the committed '
      + 'artifact to make it go away.',
    committedReadable: {
      'outputs/verification-results.json': committedVerification !== null,
      'outputs/report-figures.json': committedFigures !== null,
    },
    verificationResultsDiff: verificationDiff,
    reportFiguresDiff: figuresDiff,
  }, null, 2));

  console.log('  Output (this run only): outputs/run/verification-results.json, outputs/run/report-figures.json, outputs/run/diff.json');
  console.log('  Committed artifacts NOT modified. Use `PF_EMIT=1 npm run verify` to propose replacements.');
  console.log(`  Reproduction vs the committed artifacts on Node ${process.versions.node}: `
    + `${realTotal === 0 ? 'REPRODUCED' : `${realTotal} field(s) BEYOND TOLERANCE`}`
    + `${allDiffs.length - realTotal > 0 ? ` (${allDiffs.length - realTotal} within tolerance` + (gap ? `, largest ${gap.absDiff.toExponential(2)} at ${gap.path}` : '') + ')' : ''}`);
  if (realTotal > 0) {
    console.log(`  ⚠ THIS RUN DISAGREES WITH THE COMMITTED EVIDENCE — ${realVerification.length} field(s) in verification-results.json, ${realFigures.length} in report-figures.json. See outputs/run/diff.json.`);
    for (const d of [...realVerification, ...realFigures].slice(0, 6)) {
      console.log(`      ${d.path}: committed ${JSON.stringify(d.committed)} vs this run ${JSON.stringify(d.thisRun)}`);
    }
  }
  reproductionFailures = realTotal;
} else {
  console.log('  REPORT GENERATION: rewrote outputs/verification-results.json and outputs/report-figures.json');
  console.log('  Review the diff before publishing — these are artifacts of record.');
}

// Exit status encodes the verdict for CI / pre-publish hooks / anyone reading $?:
//   0 = Full Pass   ·   2 = Conditional Pass (one or more FLAG steps)   ·   5 = RTP FIGURE OVERSTATED
//   (enforced RTP-CLAIM 1.2.0 miss; not a draw fail)   ·   1 = FAIL.
// A FLAG previously exited 0, so a 5σ RTP miss or a doctored χ² printed "Conditional Pass" and
// still returned success. See README (Reproducibility) for the code table.
// Reproduction beyond tolerance is a FAIL, not a warning: a gate that only prints is not one.
if (failed > 0 || reproductionFailures > 0 || !rtpClaim.tableMatches) process.exit(1);
// 5 RTP FIGURE OVERSTATED, 2 Conditional Pass, 0 Full Pass — the code rtpClaimVerdict ranked above.
if (verdictExit !== 0) process.exit(verdictExit);
