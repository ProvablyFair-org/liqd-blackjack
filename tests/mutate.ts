/**
 * Declared-mutation runner — `npm run mutate`.
 *
 * Runs every entry in `tests/mutations.json` against a throwaway copy of this repo and
 * checks that each one BREAKS THE GUARD IT NAMES. A registry nobody executes is a list of
 * claims; this makes it a battery. The source tree is never modified.
 *
 * Two layers per entry, because the repo has two:
 *
 *   OUTER — apply the entry's `edits` and run `runner`. For a dataset edit this is the
 *           SHA-256 pin in `src/loader.ts`, which aborts any run before a step executes.
 *   ALSO  — optional: a SECOND guard on the same un-repinned edit, in the other runner. Used
 *           where a pin is asserted in mocha AND enforced in the scored verify path, so both
 *           are executed rather than one being described. (`runner` stays the mocha one, because
 *           a fail-fast pin cannot be expressed under a non-mocha runner: the mutation harness
 *           demands a "Step N" in the guard, and a pin aborts before any step prints.)
 *   INNER — only for entries with `repin: true`. Re-apply the edits, RE-PIN
 *           `DATASET_SHA256` to the mutated file (exactly what a forger would do to get
 *           past the outer layer), then run `innerRunner` and require `innerExpect`.
 *           This is what proves the scored step itself catches the edit.
 *
 * Every entry declares the marker it expects in the runner's output, so "it failed" is
 * never accepted as "it failed for the right reason".
 *
 * Usage:  npm run mutate            — all mutations
 *         npm run mutate -- 4 7     — only those indices
 */

import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

/**
 * One edit. `find`/`replace` is the common case; two extra shapes exist because executed
 * counterexamples could not be expressed without them, and a registry that cannot
 * express the attack that was actually run is a registry of the attacks that are easy to type.
 *   `delete: true`     — remove the file entirely (the "delete a pinned artifact" family).
 *   `replaceAll: true` — replace EVERY occurrence, not the first (the "strip a field from all
 *                        12,046 records" family; a single-record edit does not empty a set).
 *   `pattern` + `count` — a regular expression (global, source text) replaced by `replace` at every
 *                        match, where the number of matches must equal the declared `count` or the
 *                        entry is NOT RUN. For a set defined by content rather than by one fixed
 *                        string — "delete the 301 LOSING insurance records" (R80) — which neither a
 *                        single find nor replaceAll can express. The declared count keeps it from
 *                        silently matching more, fewer or none.
 */
interface Edit { file: string; find?: string; replace?: string; after?: string; delete?: boolean; replaceAll?: boolean; pattern?: string; count?: number }
interface Mutation {
  name: string;
  file: string; find?: string; replace?: string;    // outer layer, single edit (also read by
  runner?: 'mocha' | 'verify';                       // the external mutation harness)
  spec?: string;                                     // narrow the mocha run to the guard's own file
  expect: string;
  guard: string;
  edits?: Edit[];                                    // full edit list; defaults to [{file,find,replace}]
  alsoRunner?: 'mocha' | 'verify';                   // a SECOND guard on the same un-repinned edit
  alsoSpec?: string;
  alsoExpect?: string;
  repin?: boolean;
  innerRunner?: 'mocha' | 'verify';
  innerSpec?: string;
  innerExpect?: string;
  note?: string;
  /**
   * RTP FIGURE OVERSTATED route (FIXPASS2 C3, 2026-10-14). `regen: true` does in the sandbox what an
   * auditor does after a change to the paytable or the published figure: re-writes
   * outputs/rtp-claim-table.json (`ts-node src/rtp-settings.ts`), re-pins RTP_CLAIM_TABLE_SHA256 and
   * re-emits the scored record (PF_EMIT=1), so the judged run reproduces its own committed artifacts and
   * only the rule decides it. `expectExit` is then required EXACTLY (the OUTER layer otherwise accepts
   * any non-zero exit), together with `expect` (the `[RTP FIGURE OVERSTATED] Step 20` marker) and
   * `expectVerdict` (the printed `Verdict:` line). Before regenerating, a STALE layer runs the edited tree
   * as it is and requires exit 1 with `[FAIL] Step N` (N = the first step the guard names): a committed
   * table that no longer matches is a reproduction failure even under a miss.
   */
  regen?: boolean;
  expectExit?: number;
  expectVerdict?: string;
}

const registry: Mutation[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'mutations.json'), 'utf8'));

// ── sandbox ────────────────────────────────────────────────────────────────────────────
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'bj-mutate-'));
process.on('exit', () => { try { fs.rmSync(sandbox, { recursive: true, force: true }); } catch { /* best effort */ } });

for (const entry of fs.readdirSync(ROOT)) {
  if (entry === 'node_modules' || entry === '.git') continue;
  fs.cpSync(path.join(ROOT, entry), path.join(sandbox, entry), { recursive: true });
}
fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(sandbox, 'node_modules'), 'dir');

const DATASET_REL = path.relative(ROOT, path.join(ROOT, 'data', 'blackjack-6000hands.json'));

/**
 * Files a RUN writes, which therefore have to be restored between mutations even though no
 * mutation edits them.
 *
 * `outputs/report-figures.json` is a scored artifact (Step 25 re-derives it) and its committed
 * sha is 5678c639…. M11 (`COLORED_PAIR 13 -> 12`) runs `npm run verify`, which rewrites
 * report-figures.json from the MUTATED paytable, so that sha moves. Restoring only
 * `src/config.ts` leaves the forged file behind, and the very next verify-runner mutation gets
 * `[FAIL] Step 25` for free: it passes its declared assertion without its own edit having done
 * anything.
 *
 * A mutation battery that can pass on the previous mutation's leftovers measures nothing, so both
 * run products go back to their committed state before every layer.
 */
const RUN_PRODUCTS = ['outputs/report-figures.json', 'outputs/verification-results.json'];

function restore(files: Set<string>): void {
  for (const f of files) fs.cpSync(path.join(ROOT, f), path.join(sandbox, f));
  for (const f of RUN_PRODUCTS) {
    const src = path.join(ROOT, f);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(sandbox, f));
  }
}

function applyEdits(edits: Edit[]): string | null {
  for (const e of edits) {
    const p = path.join(sandbox, e.file);
    if (e.delete) {
      if (!fs.existsSync(p)) return `file ${e.file} not found — cannot delete what is not there`;
      fs.rmSync(p);
      continue;
    }
    if (!fs.existsSync(p)) return `file ${e.file} not found`;
    if (e.pattern !== undefined) {
      if (e.replace === undefined || e.count === undefined) return `pattern edit on ${e.file} needs replace and a declared count`;
      const text = fs.readFileSync(p, 'utf8');
      const re = new RegExp(e.pattern, 'g');
      const n = (text.match(re) ?? []).length;
      if (n !== e.count) return `pattern matched ${n} time(s) in ${e.file}, declared ${e.count}`;
      fs.writeFileSync(p, text.replace(re, e.replace));
      continue;
    }
    if (e.find === undefined || e.replace === undefined) return `edit on ${e.file} has neither delete nor find/replace`;
    const src = fs.readFileSync(p, 'utf8');
    if (e.replaceAll) {
      if (!src.includes(e.find)) return `find string not present in ${e.file}: ${JSON.stringify(e.find.slice(0, 60))}`;
      if (e.find === e.replace) return `find === replace in ${e.file} — nothing would be mutated`;
      fs.writeFileSync(p, src.split(e.find).join(e.replace));
      continue;
    }
    let from = 0;
    if (e.after !== undefined) {
      const a = src.indexOf(e.after);
      if (a < 0) return `anchor not present in ${e.file}: ${JSON.stringify(e.after.slice(0, 60))}`;
      from = a + e.after.length;
    }
    const i = src.indexOf(e.find, from);
    if (i < 0) return `find string not present in ${e.file}: ${JSON.stringify(e.find.slice(0, 60))}`;
    if (e.find === e.replace) return `find === replace in ${e.file} — nothing would be mutated`;
    fs.writeFileSync(p, src.slice(0, i) + e.replace + src.slice(i + e.find.length));
  }
  return null;
}

/** Every hash pin in src/config.ts, and the file each one covers. */
const PINS: Array<{ constant: string; file: string }> = [
  { constant: 'DATASET_SHA256', file: DATASET_REL },
  { constant: 'SIMULATION_SHA256', file: path.join('outputs', 'simulation-results.json') },
  { constant: 'SIMULATION_HTML_SHA256', file: path.join('outputs', 'rtp-convergence.html') },
  { constant: 'EXACT_RTP_SHA256', file: path.join('outputs', 'exact-rtp.json') },
  { constant: 'ATTACK_SHA256', file: path.join('outputs', 'cherry-pick-attack.json') },
  { constant: 'RNG_BRANCH_SHA256', file: path.join('outputs', 'rng-branch-coverage.json') },
  { constant: 'SIMULATION_PROVENANCE_SHA256', file: path.join('outputs', 'simulation-provenance.json') },
  { constant: 'BOOTSTRAP_NULLS_SHA256', file: path.join('outputs', 'bootstrap-nulls.float64le') },
  { constant: 'DEEP_REPLAY_SHA256', file: path.join('outputs', 'deep-replay-report.json') },
  { constant: 'BOOTSTRAP_REPLAY_SHA256', file: path.join('outputs', 'bootstrap-replay-report.json') },
  { constant: 'CAPTURE_RIG_SHA256', file: path.join('capture', 'capture-liqd-blackjack.aug05-rig.mjs') },
];

/**
 * Re-pin every hash constant whose file the mutation touched — i.e. do what a forger would
 * do to get past the fail-fast pins, so the INNER layer measures the scored steps instead of
 * the pin that fires first.
 */
function repinArtifacts(editedFiles: Set<string>): void {
  const cfgPath = path.join(sandbox, 'src', 'config.ts');
  let cfg = fs.readFileSync(cfgPath, 'utf8');
  for (const { constant, file } of PINS) {
    if (!editedFiles.has(file)) continue;
    const abs = path.join(sandbox, file);
    if (!fs.existsSync(abs)) continue;   // a DELETED artifact cannot be re-pinned — that is the point
    const h = createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
    const re = new RegExp(`export const ${constant} = '[0-9a-f]{64}';`);
    if (!re.test(cfg)) throw new Error(`re-pin failed: ${constant} declaration not found in src/config.ts`);
    cfg = cfg.replace(re, `export const ${constant} = '${h}';`);
  }
  fs.writeFileSync(cfgPath, cfg);
}

/** C3 `regen`: re-write and re-pin the rule table, then re-emit the scored record. An error, or null. */
function regenerate(): string | null {
  const w = run('table');
  const h = w.out.match(/sha256 ([0-9a-f]{64})/);
  if (w.code !== 0 || !h) return `rtp-claim:write exited ${w.code}`;
  const rs = path.join(sandbox, 'src', 'rtp-settings.ts');
  const src = fs.readFileSync(rs, 'utf8');
  if (!/export const RTP_CLAIM_TABLE_SHA256 = '[0-9a-f]{64}';/.test(src)) return 'RTP_CLAIM_TABLE_SHA256 not found in src/rtp-settings.ts';
  fs.writeFileSync(rs, src.replace(/export const RTP_CLAIM_TABLE_SHA256 = '[0-9a-f]{64}';/, `export const RTP_CLAIM_TABLE_SHA256 = '${h[1]}';`));
  const e = run('verify', undefined, { PF_EMIT: '1' });
  if (!/Verdict:|VERDICT:/.test(e.out)) return `PF_EMIT=1 verify exited ${e.code} without a verdict line`;
  return null;
}

function run(runner: 'mocha' | 'verify' | 'table', spec?: string, env: Record<string, string> = {}): { out: string; code: number } {
  // `spec` narrows the run to the file that carries the NAMED guard, so "the suite went red"
  // can never stand in for "the declared guard fired". .mocharc.yml's own `spec` is additive,
  // so it has to be switched off explicitly (--no-config) and its settings restated.
  const [cmd, args] = runner === 'mocha'
    ? ['npx', spec
      ? ['mocha', '--no-config', '--no-package', '--require', 'ts-node/register', '--timeout', '3600000', spec]
      : ['mocha']]
    : runner === 'table' ? ['npx', ['ts-node', 'src/rtp-settings.ts']]
    : ['npx', ['ts-node', 'tests/verify.ts']];
  try {
    const out = execFileSync(cmd, args as string[], { env: { ...process.env, ...env }, cwd: sandbox, encoding: 'utf8', stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 });
    return { out, code: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return { out: `${e.stdout ?? ''}${e.stderr ?? ''}`, code: e.status ?? 1 };
  }
}

// ── run ────────────────────────────────────────────────────────────────────────────────
const only = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
let failures = 0;
let layers = 0;

console.log(`\n  Declared-mutation battery — ${registry.length} mutation(s), sandbox ${sandbox}\n`);

for (let i = 0; i < registry.length; i++) {
  if (only.length && !only.includes(i)) continue;
  const m = registry[i];
  const edits: Edit[] = m.edits ?? [{ file: m.file, find: m.find, replace: m.replace }];
  // `restore` copies the pristine file back; a deleted file needs that too, and it works
  // because `touched` is keyed on the path, not on how the edit changed it.
  const touched = new Set<string>([...edits.map((e) => e.file), 'src/config.ts',
    ...(m.regen ? ['src/rtp-settings.ts', path.join('outputs', 'rtp-claim-table.json')] : [])]);

  const check = (label: string, runner: 'mocha' | 'verify', spec: string | undefined, marker: string): void => {
    layers++;
    const { out, code } = run(runner, spec);
    const hit = out.includes(marker);
    // C3 entries: the exact exit code and the printed verdict are part of the declaration.
    const exitOk = label === 'STALE' ? code === 1 : (label !== 'OUTER' || m.expectExit === undefined || code === m.expectExit);
    const verdictSeen = (out.match(/(?:Verdict|VERDICT): (.*)/) ?? [])[1]?.trim() ?? '(none)';
    const verdictOk = label !== 'OUTER' || m.expectVerdict === undefined || verdictSeen === m.expectVerdict;
    if (code !== 0 && hit && exitOk && verdictOk) {
      console.log(`  M${i} ${label.padEnd(5)} ✓  ${m.name}`);
      console.log(`         ${runner}${spec ? ` ${spec}` : ''} exited ${code}${label === 'OUTER' && m.expectExit !== undefined ? ` (expected ${m.expectExit}), Verdict: ${verdictSeen}` : ''} and printed ${JSON.stringify(marker)}`);
    } else {
      failures++;
      console.log(`  M${i} ${label.padEnd(5)} ✗  ${m.name}`);
      console.log(`         ${runner}${spec ? ` ${spec}` : ''} exited ${code}${label === 'OUTER' && m.expectExit !== undefined ? ` (expected ${m.expectExit}), Verdict: ${verdictSeen}` : ''}; expected marker ${JSON.stringify(marker)} ${hit ? 'found' : 'NOT FOUND'}`);
      console.log(out.split('\n').filter((l) => /FAIL|✗|failing|Error|mismatch|AssertionError/.test(l)).slice(0, 8)
        .map((l) => `           ${l.trim()}`).join('\n'));
    }
  };

  restore(touched);
  const err = applyEdits(edits);
  if (err) { failures++; console.log(`  M${i} OUTER ✗  ${m.name}\n         NOT RUN — ${err}`); restore(touched); continue; }
  if (m.regen) {
    // STALE layer (framework rule: a committed RTP table that no longer matches is a reproduction failure,
    // exit 1, even under a miss): the same edit WITHOUT regenerating must exit 1 and print the step's FAIL.
    const named = (m.guard.match(/Step\s+(\d+)/) ?? [])[1] ?? '?';
    check('STALE', 'verify', undefined, `[FAIL] Step ${named}`);
    const rerr = regenerate();
    if (rerr) { failures++; console.log(`  M${i} OUTER ✗  ${m.name}\n         NOT RUN — regen failed: ${rerr}`); restore(touched); continue; }
  }
  check('OUTER', m.runner ?? 'verify', m.spec, m.expect);
  if (m.alsoRunner && m.alsoExpect) check('ALSO', m.alsoRunner, m.alsoSpec, m.alsoExpect);
  restore(touched);

  if (m.repin) {
    const err2 = applyEdits(edits);
    if (err2) { failures++; console.log(`  M${i} INNER ✗  ${m.name}\n         NOT RUN — ${err2}`); restore(touched); continue; }
    repinArtifacts(new Set(edits.map((e) => e.file)));
    check('INNER', m.innerRunner ?? 'verify', m.innerSpec, m.innerExpect ?? m.expect);
    restore(touched);
  }
}

console.log(`\n  ${layers} layer(s) run, ${failures} failure(s)\n`);
process.exit(failures > 0 ? 1 : 0);
