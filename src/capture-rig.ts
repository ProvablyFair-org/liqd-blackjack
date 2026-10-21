/**
 * THE CAPTURE RIG THAT GENERATED THE CLIENT SEEDS (BLACKJACK-06, since 2026-09-25).
 *
 * `capture/capture-liqd-blackjack.aug05-rig.mjs` is a byte-for-byte copy of the terminal capture rig
 * found, untracked, in the auditor's workspace (capture-liqd-blackjack.mjs,
 * file modification time 2026-08-05T18:30:54Z). Its SHA-256 is pinned in src/config.ts
 * (CAPTURE_RIG_SHA256). Its comments name another audit standard; they are kept unchanged as
 * evidence of what ran. It is the only file in this package that shows HOW the epoch client seeds
 * were made:
 *
 *     const randHex = (n) => Buffer.from(crypto.getRandomValues(new Uint8Array(n))).toString('hex');
 *     const clientSeedFor = (E, tag) => tag === 'pfaudit' ? `pfaudit-${STAMP}-${E}` : 'audit' + randHex(6);
 *
 * `crypto` there is not imported, so it is the runtime's global Web Crypto object, whose
 * getRandomValues is a cryptographically secure generator. A–C/E/F seeds are therefore
 * 'audit' + 12 hex characters of CSPRNG output; Phase D seeds are the predictable
 * `pfaudit-<STAMP>-<epoch>` with STAMP = Date.now() at rig start (MANIFEST DL-15).
 *
 * PROVENANCE IS CIRCUMSTANTIAL, and the step says so. The rig was never committed, so nothing
 * cryptographic ties it to the run. What ties it is the data: the rig's phase plan reproduces the
 * dataset's phase of every one of the 120 epochs, every non-D seed has the randHex(6) shape, every
 * D seed carries one stamp and its own epoch index, and that stamp is 6 ms before the dataset's own
 * `meta.startedAt` (which the rig sets at capture start) and 28 s after the file's recorded
 * modification time. A different generator that produced the same shapes is not excluded by any of
 * this; it is the most specific evidence available offline.
 *
 * checkCaptureRig() reads the pinned file and the dataset and returns every measured value, so the
 * scored step (Step 7) can FAIL on any disagreement and print what it measured.
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/** Package-relative path of the pinned rig. */
export const CAPTURE_RIG_FILE = 'capture/capture-liqd-blackjack.aug05-rig.mjs';
/** Modification time of the untracked original, read on 2026-09-25 (disclosed, not re-checkable here). */
export const CAPTURE_RIG_SOURCE_MTIME = '2026-08-05T18:30:54Z';

/** The three generator lines, as the rig carries them (whitespace-trimmed). */
export const RIG_LINES = {
  randHex: "const randHex = (n) => Buffer.from(crypto.getRandomValues(new Uint8Array(n))).toString('hex');",
  clientSeedFor: "const clientSeedFor = (E, tag) => tag === 'pfaudit' ? `pfaudit-${STAMP}-${E}` : 'audit' + randHex(6);",
  stamp: 'const STAMP = Date.now();',
} as const;

export interface RigSeed { epoch: number; phase: string; clientSeed: string; at?: string | null }
export interface RigMeta { startedAt?: string | null; preCapture?: Record<string, unknown> | null }

export interface RigCheck {
  ok: boolean;
  present: boolean;
  sha256: string;
  pinOk: boolean;
  generatorLines: { randHex: number; clientSeedFor: number; stamp: number };
  generatorDefinitions: number;
  cryptoRebound: number;
  rotateCalls: number;
  rotateCallsWithGenerator: number;
  mathRandomTotal: number;
  mathRandomOutsideDemo: number;
  planEpochs: number;
  planPhaseMatches: number;
  auditSeeds: number;
  auditShapeOk: number;
  pfauditSeeds: number;
  pfauditShapeOk: number;
  stamps: string[];
  stampIso: string;
  stampToStartMs: number;
  timeOrderOk: boolean;
  problems: string[];
}

const count = (lines: string[], want: string): number => lines.filter((l) => l.trim() === want).length;

export function checkCaptureRig(root: string, pin: string, seeds: RigSeed[], meta: RigMeta): RigCheck {
  const problems: string[] = [];
  const abs = path.join(root, CAPTURE_RIG_FILE);
  const present = fs.existsSync(abs);
  const raw = present ? fs.readFileSync(abs) : Buffer.alloc(0);
  const sha256 = present ? createHash('sha256').update(raw).digest('hex') : '';
  const pinOk = present && sha256 === pin;
  if (!present) problems.push(`${CAPTURE_RIG_FILE} absent`);
  else if (!pinOk) problems.push(`${CAPTURE_RIG_FILE} SHA-256 ${sha256} ≠ pinned ${pin}`);

  const src = raw.toString('utf8');
  const lines = src.split('\n');

  // (1) The generator, exactly as the rig states it — one definition each, nothing rebinding them.
  const generatorLines = {
    randHex: count(lines, RIG_LINES.randHex),
    clientSeedFor: count(lines, RIG_LINES.clientSeedFor),
    stamp: count(lines, RIG_LINES.stamp),
  };
  const generatorDefinitions = (src.match(/\b(?:const|let|var|function)\s+(?:randHex|clientSeedFor|STAMP)\b/g) ?? []).length;
  // `crypto` must be the runtime global (Web Crypto), not a local binding or an import.
  const cryptoRebound = (src.match(/\b(?:const|let|var|function|class)\s+crypto\b|import\s[^;]*\bcrypto\b|\bcrypto\s*=/g) ?? []).length;
  if (generatorLines.randHex !== 1) problems.push(`randHex via crypto.getRandomValues: ${generatorLines.randHex} line(s), expected 1`);
  if (generatorLines.clientSeedFor !== 1) problems.push(`clientSeedFor ('audit' + randHex(6) | pfaudit-STAMP-E): ${generatorLines.clientSeedFor} line(s), expected 1`);
  if (generatorLines.stamp !== 1) problems.push(`STAMP = Date.now(): ${generatorLines.stamp} line(s), expected 1`);
  if (generatorDefinitions !== 3) problems.push(`${generatorDefinitions} definitions of randHex/clientSeedFor/STAMP, expected 3`);
  if (cryptoRebound !== 0) problems.push(`\`crypto\` is rebound or imported ${cryptoRebound} time(s) — it must be the global Web Crypto object`);

  // (2) Every seed the rig submits goes through the generator.
  const rotateSites = [...src.matchAll(/\brotate\(/g)].map((m) => m.index as number);
  let rotateCalls = 0, rotateCallsWithGenerator = 0;
  for (const i of rotateSites) {
    if (src.slice(Math.max(0, i - 13), i) === 'const rotate ') continue;   // not a call
    if (/async \(clientSeed\)/.test(src.slice(i, i + 40)) ) continue;
    rotateCalls++;
    if (src.startsWith('rotate(clientSeedFor(', i)) rotateCallsWithGenerator++;
  }
  if (rotateCalls === 0 || rotateCallsWithGenerator !== rotateCalls) problems.push(`${rotateCallsWithGenerator}/${rotateCalls} rotate() calls pass clientSeedFor(...)`);

  // (3) Math.random only in the synthetic demo renderer, never on the seed path.
  const demoStart = src.indexOf('async function runDemo()');
  const demoEnd = demoStart >= 0 ? src.indexOf('\n}\n', demoStart) : -1;
  const mr = [...src.matchAll(/Math\.random/g)].map((m) => m.index as number);
  const mathRandomOutsideDemo = mr.filter((i) => !(demoStart >= 0 && i > demoStart && i < demoEnd)).length;
  if (mathRandomOutsideDemo !== 0) problems.push(`${mathRandomOutsideDemo} Math.random use(s) outside runDemo()`);

  // (4) The rig's phase plan reproduces the dataset's phase of every epoch.
  const plan: Array<{ phase: string; tag: string }> = [];
  const planBody = src.slice(src.indexOf('function buildEpochs()'), src.indexOf('function buildSmoke('));
  for (const m of planBody.matchAll(/for \(let e = 0; e < (\d+); e\+\+\) ep\('([A-F])', '(audit|pfaudit)'/g)) {
    for (let k = 0; k < Number(m[1]); k++) plan.push({ phase: m[2], tag: m[3] });
  }
  const byEpoch = [...seeds].sort((a, b) => a.epoch - b.epoch);
  let planPhaseMatches = 0;
  for (const s of byEpoch) {
    const p = plan[s.epoch];
    if (p && p.phase === s.phase && (p.tag === 'pfaudit') === (s.phase === 'D')) planPhaseMatches++;
  }
  if (plan.length !== seeds.length || planPhaseMatches !== seeds.length) problems.push(`rig plan ${plan.length} epochs, ${planPhaseMatches}/${seeds.length} dataset epochs match its phase and seed tag`);

  // (5) The data carries the generator's shapes: audit + randHex(6), and pfaudit-<one STAMP>-<own epoch>.
  let auditSeeds = 0, auditShapeOk = 0, pfauditSeeds = 0, pfauditShapeOk = 0;
  const stampSet = new Set<string>();
  for (const s of byEpoch) {
    const tag = plan[s.epoch]?.tag;
    if (tag === 'pfaudit') {
      pfauditSeeds++;
      const m = /^pfaudit-(\d+)-(\d+)$/.exec(s.clientSeed);
      if (m && Number(m[2]) === s.epoch) { pfauditShapeOk++; stampSet.add(m[1]); }
    } else {
      auditSeeds++;
      if (/^audit[0-9a-f]{12}$/.test(s.clientSeed)) auditShapeOk++;
    }
  }
  const stamps = [...stampSet];
  if (auditShapeOk !== auditSeeds || auditSeeds === 0) problems.push(`${auditShapeOk}/${auditSeeds} audit-tagged seeds have the 'audit' + randHex(6) shape`);
  if (pfauditShapeOk !== pfauditSeeds || pfauditSeeds === 0 || stamps.length !== 1) problems.push(`${pfauditShapeOk}/${pfauditSeeds} pfaudit seeds carry their own epoch; ${stamps.length} distinct stamp(s), expected 1`);

  // (6) The stamp is the rig's start: STAMP ≤ meta.startedAt ≤ preCapture.at ≤ first epoch record.
  const stamp = stamps.length === 1 ? Number(stamps[0]) : NaN;
  const startedAt = Date.parse(String(meta.startedAt ?? ''));
  const preAt = Date.parse(String(meta.preCapture?.at ?? ''));
  const firstAt = Date.parse(String(byEpoch[0]?.at ?? ''));
  const timeOrderOk = Number.isFinite(stamp) && stamp <= startedAt && startedAt <= preAt && preAt <= firstAt;
  if (!timeOrderOk) problems.push(`time order STAMP ${stamp} ≤ startedAt ${meta.startedAt} ≤ preCapture.at ${String(meta.preCapture?.at)} ≤ epoch 0 ${String(byEpoch[0]?.at)} does not hold`);

  return {
    ok: problems.length === 0, present, sha256, pinOk, generatorLines, generatorDefinitions, cryptoRebound,
    rotateCalls, rotateCallsWithGenerator, mathRandomTotal: mr.length, mathRandomOutsideDemo,
    planEpochs: plan.length, planPhaseMatches, auditSeeds, auditShapeOk, pfauditSeeds, pfauditShapeOk,
    stamps, stampIso: Number.isFinite(stamp) ? new Date(stamp).toISOString() : 'n/a',
    stampToStartMs: startedAt - stamp, timeOrderOk, problems,
  };
}
