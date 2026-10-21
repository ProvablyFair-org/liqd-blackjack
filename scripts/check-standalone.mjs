#!/usr/bin/env node
/** Detect stale compiled code without requiring the development dependencies. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fail = message => {
  console.error(`[standalone] FAIL: ${message}`);
  console.error('After an intentional source edit, run npm ci --include=dev and npm run build.');
  process.exit(1);
};
function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const rel = dir + '/' + entry.name;
    return entry.isDirectory() ? walk(rel) : [rel];
  }).sort();
}
try {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'standalone-manifest.json'), 'utf8'));
  if (manifest.format !== 1 || !manifest.inputs || !manifest.outputs) fail('Invalid build manifest.');
  const sourcePaths = ['src', 'tests'].flatMap(walk).filter(p => p.endsWith('.ts')).sort();
  const expectedInputs = [...sourcePaths, 'tsconfig.json', '.mocharc.yml', 'package-lock.json',
    'scripts/build-standalone.mjs', 'scripts/check-standalone.mjs', 'scripts/standalone-runtime.cjs'].sort();
  if (JSON.stringify(Object.keys(manifest.inputs).sort()) !== JSON.stringify(expectedInputs)) {
    fail('Source inventory differs from the bundled build.');
  }
  if (JSON.stringify(manifest.unitEntries) !== JSON.stringify(sourcePaths.filter(p => p.endsWith('Tests.ts')))) {
    fail('Unit-test inventory differs from the bundled build.');
  }
  if (JSON.stringify(Object.keys(manifest.outputs).sort()) !== JSON.stringify(['test.js', 'verify.js'])) {
    fail('Bundled entry-point inventory is incomplete.');
  }
  for (const files of [manifest.inputs, manifest.outputs]) {
    for (const [name, expected] of Object.entries(files)) {
      const actual = createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
      if (actual !== expected) fail(`${name} differs from the bundled build.`);
    }
  }
  console.log('[standalone] Source inventory, unit-test inventory and both compiled entry points match the build manifest.');

  // RELEASE-GATE PARITY (BLACKJACK-28). The numbers the report states about the suite must be the
  // suite's own: the audit ID in MANIFEST.md and README.md is the one the run emits, the unit-spec
  // count MANIFEST.md quotes is the one the zero-install runner enforces, and the scored-step count
  // MANIFEST.md and README.md quote is the number of steps in the committed scored record.
  const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
  const cfg = read('src/config.ts');
  const auditId = (/export const AUDIT_ID = '([^']+)'/.exec(cfg) ?? [])[1];
  const unitCount = Number((/export const EXPECTED_UNIT_TESTS = (\d+);/.exec(cfg) ?? [])[1]);
  if (!auditId) fail('src/config.ts declares no AUDIT_ID.');
  if (!Number.isInteger(unitCount)) fail('src/config.ts declares no EXPECTED_UNIT_TESTS.');
  const manifestMd = read('MANIFEST.md');
  const readme = read('README.md');
  if (!manifestMd.includes(`**Audit ID:** \`${auditId}\``)) fail(`MANIFEST.md does not carry the audit ID ${auditId} declared in src/config.ts.`);
  if (!readme.includes(`**Audit ID:** \`${auditId}\``)) fail(`README.md does not carry the audit ID ${auditId} declared in src/config.ts.`);
  const record = JSON.parse(read('outputs/verification-results.json'));
  if (record.auditId !== auditId) fail(`outputs/verification-results.json carries audit ID ${record.auditId}, src/config.ts declares ${auditId}.`);
  const scored = Array.isArray(record.steps) ? record.steps.length : NaN;
  const quotedUnits = [...manifestMd.matchAll(/\*\*(\d+) tests\*\* across/g)].map(m => Number(m[1]));
  if (quotedUnits.length === 0 || quotedUnits.some(n => n !== unitCount)) fail(`unit-spec count quoted in MANIFEST.md (${quotedUnits.join(', ') || 'none'}) != EXPECTED_UNIT_TESTS ${unitCount}.`);
  const quotedSteps = [...manifestMd.matchAll(/\((\d+)\/(\d+) scored steps/g), ...readme.matchAll(/(\d+)\/(\d+) scored steps pass/g)]
    .flatMap(m => m.slice(1).map(Number));
  if (quotedSteps.length === 0 || quotedSteps.some(n => n !== scored)) fail(`scored-step count quoted in MANIFEST.md/README.md (${quotedSteps.join(', ') || 'none'}) != ${scored} steps in outputs/verification-results.json.`);
  console.log(`[standalone] Audit ID ${auditId}, ${unitCount} unit specs and ${scored} scored steps: MANIFEST.md, README.md and outputs/verification-results.json agree with src/config.ts.`);
} catch (error) {
  fail(error.message);
}
