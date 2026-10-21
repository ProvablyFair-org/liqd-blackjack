/**
 * REPLAY WORKER POOL — runs src/replay.ts jobs in parallel child processes of the producing script.
 *
 * The replay is the 1,000,000-round Pass-1 stream (cut into contiguous nonce ranges) plus 120
 * revealed seeds × 10,000 Pass-2 nonces — every one a full 416-card HMAC shoe, ~0.5 ms each, so
 * ~18 core-minutes: it is fanned out. Scored steps are synchronous, so the parent runs a small orchestrator
 * synchronously (`node -e`, below); the orchestrator starts `width` worker children and collects
 * their results. A worker is THIS SAME ENTRY SCRIPT re-run with PF_REPLAY_WORKER=1, so the job code
 * is the code of the script that asked for it. Jobs travel in over stdin; each worker writes its
 * results to a file the orchestrator names and exits (see runWorkerIfRequested). The scored verify
 * does NOT use this pool: Step 18/19 re-derive every statistic from the artifact's census rows and
 * re-deal a declared sample from the seeds in-process (see tests/steps/simulation.ts).
 *
 * Ported from the LIQD Mines package (src/replay-pool.ts). Entry scripts that call runWorkerIfRequested() before any work: src/simulate.ts,
 * src/deep-replay.ts, src/cherry-pick-attack.ts.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { pass1Chunk, pass2Seed } from './replay';
import type { Pass1Job, Pass1Chunk, Pass2Job, Pass2SeedCensus } from './replay';

export type ReplayJob = Pass1Job | Pass2Job;
export type ReplayResult = Pass1Chunk | Pass2SeedCensus;

/** Worker side: if this process is a replay worker, run the jobs on stdin, print the results, exit. */
export function runWorkerIfRequested(): void {
  if (process.env.PF_REPLAY_WORKER !== '1') return;
  const jobs: Array<{ id: number; job: ReplayJob }> = JSON.parse(fs.readFileSync(0, 'utf8'));
  const out = jobs.map(({ id, job }) => ({
    id, result: job.kind === 'p1' ? pass1Chunk(job) : pass2Seed(job),
  }));
  // The result goes to the file the orchestrator named, SYNCHRONOUSLY, and only then does the worker
  // exit. (Writing it to stdout and exiting truncated it at the 64 KiB pipe buffer: stdout to a pipe
  // is asynchronous in Node, and this function must not return — the rest of the entry script would run.)
  const outFile = process.env.PF_REPLAY_OUT;
  if (!outFile) { process.stderr.write('replay worker: PF_REPLAY_OUT not set\n'); process.exit(1); }
  fs.writeFileSync(outFile, JSON.stringify(out));
  process.exit(0);
}

/** How to re-run the entry script that is running now — ts-node source or the zero-install bundle. */
function selfInvocation(): { cmd: string; args: string[] } {
  const script = path.resolve(process.argv[1]);
  const execArgv = process.execArgv.filter(a => !a.startsWith('--inspect'));
  const hasTsNode = execArgv.some(a => a.includes('ts-node'));
  const args = script.endsWith('.ts') && !hasTsNode
    ? ['-r', 'ts-node/register/transpile-only', ...execArgv, script]
    : [...execArgv, script];
  return { cmd: process.execPath, args };
}

const ORCHESTRATOR = `
const { spawn } = require('child_process');
let input = '';
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  const { self, buckets, dir } = JSON.parse(input);
  const fs = require('fs'), path = require('path');
  Promise.all(buckets.filter(b => b.length).map((b, i) => new Promise((resolve, reject) => {
    const outFile = path.join(dir, 'worker-' + i + '.json');
    const child = spawn(self.cmd, self.args, { env: { ...process.env, PF_REPLAY_WORKER: '1', PF_REPLAY_OUT: outFile }, stdio: ['pipe', 'ignore', 'inherit'] });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(JSON.parse(fs.readFileSync(outFile, 'utf8'))) : reject(new Error('replay worker exited ' + code)));
    child.stdin.end(JSON.stringify(b));
  }))).then(r => { fs.writeFileSync(path.join(dir, 'all.json'), JSON.stringify(r.flat())); })
    .catch(e => { process.stderr.write(String(e) + '\\n'); process.exit(1); });
});
`;

/** Relative cost of a job: one full shoe per nonce either way. */
function cost(job: ReplayJob): number {
  return job.kind === 'p1' ? job.to - job.from : job.nonces;
}

/**
 * Parent side: run every job to completion, synchronously, and return the results in job order.
 * Buckets are balanced longest-job-first. Throws if any worker fails or a result is missing — the
 * caller turns that into a FAIL, never into a smaller replay.
 */
export function runReplayJobs(jobs: ReplayJob[], width = Number(process.env.PF_REPLAY_WIDTH) || Math.max(1, os.cpus().length - 2)): ReplayResult[] {
  if (jobs.length === 0) return [];
  const w = Math.max(1, Math.min(jobs.length, width));
  const buckets: Array<Array<{ id: number; job: ReplayJob }>> = Array.from({ length: w }, () => []);
  const load = new Array<number>(w).fill(0);
  const order = jobs.map((job, id) => ({ id, job })).sort((a, b) => cost(b.job) - cost(a.job));
  for (const item of order) {
    let k = 0;
    for (let i = 1; i < w; i++) if (load[i] < load[k]) k = i;
    buckets[k].push(item);
    load[k] += cost(item.job);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-replay-'));
  try {
    const r = spawnSync(process.execPath, ['-e', ORCHESTRATOR], {
      input: JSON.stringify({ self: selfInvocation(), buckets, dir }),
      encoding: 'utf8', stdio: ['pipe', 'inherit', 'inherit'],
    });
    if (r.status !== 0) throw new Error(`replay orchestrator exited ${r.status}${r.error ? `: ${r.error.message}` : ''}`);
    const flat: Array<{ id: number; result: ReplayResult }> = JSON.parse(fs.readFileSync(path.join(dir, 'all.json'), 'utf8'));
    return collect(jobs, flat);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function collect(jobs: ReplayJob[], flat: Array<{ id: number; result: ReplayResult }>): ReplayResult[] {
  const byId = new Map(flat.map(x => [x.id, x.result]));
  return jobs.map((_, id) => {
    const res = byId.get(id);
    if (!res) throw new Error(`replay job ${id} returned no result`);
    return res;
  });
}
