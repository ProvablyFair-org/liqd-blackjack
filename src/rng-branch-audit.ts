/**
 * BRANCH COVERAGE OF THE DRAW PRIMITIVE — which paths of src/rng.ts the capture actually took.
 *
 * Run:  npm run branches      →  outputs/rng-branch-coverage.json
 *
 * WHY. "Validated by reproducing all 6,000 captured hands card-for-card" is the strongest claim
 * this audit makes about the RNG, and it is a claim about the paths the DATA visited. The draw
 * primitive has three: accept the first 4-byte chunk, accept a later chunk after rejecting one
 * or more (modulo-bias rejection), and — if all eight chunks are rejected — recurse with
 * `cursor += 1_000_000`. The capture takes the first and only the first.
 *
 * This script replays every draw of every captured hand through an INSTRUMENTED copy of
 * `generateProvablyFairNumber` and counts which branch each one took, then states the analytic
 * expectation over exactly the same population of ranges (a 416-card backward Fisher-Yates
 * consumes range = 2..416 once per shoe). It is the producing artifact for the figures in
 * rng-algorithm-analysis.md, "The rejection branch is ASSUMED, not witnessed".
 *
 * Deterministic: it reads the committed dataset and computes closed forms. No entropy, no
 * timestamp — the artifact is hash-pinned (RNG_BRANCH_SHA256) and reproduces byte-for-byte.
 */

import { createHmac } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { SHOE_SIZE } from './config';
import type { Dataset } from './types';

const DATA_PATH = path.join(__dirname, '..', 'data', 'blackjack-6000hands.json');
const OUT_PATH = path.join(__dirname, '..', 'outputs', 'rng-branch-coverage.json');
const TWO32 = 0x1_0000_0000;

let drawsTotal = 0;
let firstChunkDraws = 0;
let laterChunkDraws = 0;
let cursorAdvanceDraws = 0;
let chunkRejections = 0;

/** Instrumented mirror of src/rng.ts generateProvablyFairNumber. Same arithmetic, plus counters. */
function instrumentedDraw(serverSeed: string, clientSeed: string, nonce: number, cursor: number, range: number): number {
  const key = Buffer.from(serverSeed, 'hex');
  const digest = createHmac('sha256', key).update(`${clientSeed}:${nonce}:${cursor}`).digest();
  const maxFair = Math.floor(TWO32 / range) * range;
  drawsTotal++;
  let rejected = 0;
  for (let offset = 0; offset + 4 <= digest.length; offset += 4) {
    const chunk = digest.readUInt32BE(offset);
    if (chunk < maxFair) {
      if (rejected === 0) firstChunkDraws++;
      else { laterChunkDraws++; chunkRejections += rejected; }
      return chunk % range;
    }
    rejected++;
  }
  cursorAdvanceDraws++;
  chunkRejections += rejected;
  return instrumentedDraw(serverSeed, clientSeed, nonce, cursor + 1_000_000, range);
}

function main(): void {
  const ds = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')) as Dataset;
  const seedByHash = new Map(ds.seeds.map((s) => [s.hashedServerSeed, s]));

  for (const b of ds.bets) {
    const sd = seedByHash.get(b.hashedServerSeed);
    if (!sd || !sd.serverSeed) throw new Error(`no revealed seed for epoch ${b.epoch}`);
    const client = b.clientSeed ?? sd.clientSeed;
    for (let i = SHOE_SIZE - 1; i >= 1; i--) instrumentedDraw(sd.serverSeed, client, b.nonce, i, i + 1);
  }

  // ── analytic expectation over the same population of ranges ──────────────────
  const shoes = ds.bets.length;
  let pRejectPerShoe = 0;      // expected count of FIRST-chunk rejections in one shoe
  let logNoRejectPerShoe = 0;  // log P(no chunk rejected anywhere in one shoe)
  let pAllEightPerShoe = 0;    // expected count of cursor-advance events in one shoe
  let maxPointBias = 0, maxTV = 0, worstRangePoint = 0, worstRangeTV = 0;
  for (let range = 2; range <= SHOE_SIZE; range++) {
    const rem = TWO32 % range;                       // chunks at or above maxFair
    const pReject = rem / TWO32;
    pRejectPerShoe += pReject;
    logNoRejectPerShoe += Math.log1p(-pReject);
    pAllEightPerShoe += Math.pow(pReject, 8);
    // If the server omitted rejection and used a plain `chunk % range`: `rem` outcomes are
    // over-represented by one chunk each.
    const hi = Math.ceil(TWO32 / range) / TWO32;
    const lo = Math.floor(TWO32 / range) / TWO32;
    const point = Math.max(Math.abs(hi - 1 / range), Math.abs(lo - 1 / range));
    const tv = 0.5 * (rem * Math.abs(hi - 1 / range) + (range - rem) * Math.abs(lo - 1 / range));
    if (point > maxPointBias) { maxPointBias = point; worstRangePoint = range; }
    if (tv > maxTV) { maxTV = tv; worstRangeTV = range; }
  }

  const artifact = {
    audit: 'LIQD Blackjack',
    what: 'Branch coverage of src/rng.ts generateProvablyFairNumber over the committed capture',
    method:
      `Every draw of every captured hand (${shoes} shoes x ${SHOE_SIZE - 1} draws) replayed through an ` +
      'instrumented mirror of the draw primitive, counting which of its three paths each draw took. ' +
      'The analytic block states the closed-form expectation over the same population of ranges ' +
      `(a backward Fisher-Yates over ${SHOE_SIZE} cards consumes range = 2..${SHOE_SIZE} once per shoe).`,
    observed: {
      shoes,
      drawsTotal,
      firstChunkAccept: firstChunkDraws,
      laterChunkAccept: laterChunkDraws,
      cursorAdvanceFallback: cursorAdvanceDraws,
      individualChunkRejections: chunkRejections,
    },
    analytic: {
      expectedLaterChunkDrawsOverCapture: pRejectPerShoe * shoes,
      probabilityNoRejectionAnywhereInCapture: Math.exp(logNoRejectPerShoe * shoes),
      expectedCursorAdvanceEventsOverCapture: pAllEightPerShoe * shoes,
    },
    exposureIfRejectionOmitted: {
      note:
        'Upper bounds on how far a plain `chunk % range` (no rejection) could deviate from a uniform ' +
        'draw, over the 415 ranges a shoe consumes. Both are per draw.',
      maxAbsPointBias: maxPointBias,
      maxAbsPointBiasAtRange: worstRangePoint,
      maxTotalVariationDistance: maxTV,
      maxTotalVariationDistanceAtRange: worstRangeTV,
    },
    conclusion:
      'The modulo-bias rejection branch is unexercised by this capture: a server implementing a plain ' +
      '`chunk % range` would have produced byte-identical data with the probability recorded above. ' +
      'The card-for-card reproduction evidences the accept path only; rejection is ASSUMED of the server.',
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(artifact, null, 2));

  console.log(`  draws replayed          : ${drawsTotal.toLocaleString()}`);
  console.log(`  first-chunk accept      : ${firstChunkDraws.toLocaleString()}`);
  console.log(`  later-chunk accept      : ${laterChunkDraws} (expected ${(pRejectPerShoe * shoes).toFixed(4)} over the capture)`);
  console.log(`  cursor+=1e6 fallback    : ${cursorAdvanceDraws} (expected ${(pAllEightPerShoe * shoes).toExponential(3)})`);
  console.log(`  P(plain % range yields byte-identical data) = ${(Math.exp(logNoRejectPerShoe * shoes) * 100).toFixed(2)}%`);
  console.log(`  worst-case bias if rejection omitted: point ${maxPointBias.toExponential(3)}, TV ${maxTV.toExponential(3)} per draw`);
  console.log(`  → ${path.relative(process.cwd(), OUT_PATH)}`);
}

main();
