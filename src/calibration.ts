/**
 * Step 18 calibration study — is the first-card uniformity test correctly calibrated?
 *
 * The verifier's Pass 1 (Step 18) runs a single first-card rank chi-squared test (df = 12) on
 * one fresh-seed simulation. At its nominal significance level (`p < 0.01`) a *fair* shoe will
 * flag roughly one regenerated run in a hundred. This study confirms that a low single-run
 * p-value is that expected tail behaviour and not evidence of bias in the shoe.
 *
 * Method: run the SAME test on REPLICATES independent fresh seed pairs, ROUNDS rounds each, and
 * collect the p-values. Under a fair shuffle the p-values must be Uniform(0,1):
 *   - a Kolmogorov–Smirnov test of the p-value sample against Uniform(0,1);
 *   - the observed rate of p < 0.01 (must be ≈1%) and p < 0.05 (≈5%);
 *   - a pooled high-power chi-squared over all REPLICATES × ROUNDS first cards.
 * Uniform p-values ⇒ the test is calibrated; a left-skewed sample ⇒ a real first-card bias.
 *
 * Run: `npm run calibrate`  (env: REPS, default 300; ROUNDS, default 5000).
 * This is an auditor-side analysis: it draws fresh seeds each run, so the exact figures move
 * within their own sampling error while the conclusion (calibrated) is stable.
 */

import { randomBytes } from 'crypto';
import { blackjackShoe } from './rng';
import { chiSquaredTest } from './stats';

const REPLICATES = Number(process.env.REPS || 300);
const ROUNDS = Number(process.env.ROUNDS || 5000);
const RANKS = 13;

/** Rank (1..13) of a "SUIT:rank" card literal. */
function rankOf(card: string): number {
  return Number(card.slice(card.indexOf(':') + 1));
}

/** Two-sided Kolmogorov–Smirnov test of a sample against Uniform(0,1). */
function ksUniform(sample: number[]): { d: number; pValue: number } {
  const x = [...sample].sort((a, b) => a - b);
  const n = x.length;
  let d = 0;
  for (let i = 0; i < n; i++) d = Math.max(d, (i + 1) / n - x[i], x[i] - i / n);
  const en = Math.sqrt(n);
  const lam = (en + 0.12 + 0.11 / en) * d;
  let p = 0;
  for (let j = 1; j <= 100; j++) p += 2 * Math.pow(-1, j - 1) * Math.exp(-2 * j * j * lam * lam);
  return { d, pValue: Math.min(1, Math.max(0, p)) };
}

const pValues: number[] = [];
const pooled = new Array(RANKS).fill(0);
const started = Date.now();

for (let r = 0; r < REPLICATES; r++) {
  const serverSeed = randomBytes(16).toString('hex');
  const clientSeed = randomBytes(16).toString('hex');
  const freq = new Array(RANKS).fill(0);
  for (let nonce = 0; nonce < ROUNDS; nonce++) {
    freq[rankOf(blackjackShoe(serverSeed, clientSeed, nonce)[0]) - 1]++;
  }
  const res = chiSquaredTest([...freq], new Array(RANKS).fill(ROUNDS / RANKS));
  pValues.push(res.pValue);
  for (let i = 0; i < RANKS; i++) pooled[i] += freq[i];
  if ((r + 1) % 25 === 0) {
    process.stdout.write(`  ${r + 1}/${REPLICATES} replicates (${((Date.now() - started) / 1000).toFixed(0)}s)\n`);
  }
}

const below01 = pValues.filter((p) => p < 0.01).length;
const below05 = pValues.filter((p) => p < 0.05).length;
const ks = ksUniform(pValues);
const totalRounds = REPLICATES * ROUNDS;
const pooledTest = chiSquaredTest([...pooled], new Array(RANKS).fill(totalRounds / RANKS));
const calibrated = ks.pValue >= 0.05 && pooledTest.pValue >= 0.01;

console.log('\n══════════════════════════════════════════════════════════');
console.log('  STEP 18 CALIBRATION — first-card rank uniformity');
console.log('══════════════════════════════════════════════════════════');
console.log(`  replicates         : ${REPLICATES} × ${ROUNDS.toLocaleString()} rounds = ${totalRounds.toLocaleString()} first cards`);
console.log(`  p < 0.01           : ${below01}/${REPLICATES} (${(100 * below01 / REPLICATES).toFixed(2)}%, expected ~1%)`);
console.log(`  p < 0.05           : ${below05}/${REPLICATES} (${(100 * below05 / REPLICATES).toFixed(2)}%, expected ~5%)`);
console.log(`  KS vs Uniform(0,1) : D=${ks.d.toFixed(5)}, p=${ks.pValue.toFixed(4)}`);
console.log(`  pooled chi²        : ${pooledTest.chi2.toFixed(3)} (df ${pooledTest.df}), p=${pooledTest.pValue.toFixed(4)}`);
console.log('──────────────────────────────────────────────────────────');
console.log(`  VERDICT: ${calibrated
  ? 'CALIBRATED — p-values uniform; a low single-run p is a routine tail draw'
  : 'NOT CALIBRATED — p-values depart from uniform; investigate the shoe'}`);
console.log('══════════════════════════════════════════════════════════');
