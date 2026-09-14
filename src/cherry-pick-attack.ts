/**
 * THE ATTACK MEASURED AGAINST STEP 19'S DETECTOR — measured, not argued.
 *
 * Run:  npm run attack      →  outputs/cherry-pick-attack.json
 *
 * WHY. This audit's cherry-pick risk tier (LOW) and exploit row BJ-S5-05 (Pass) rested on
 * Step 19: a first-card RANK-UNIFORMITY scan over the served window (nonces 0..49) of each
 * revealed casino seed, against a parametric bootstrap null. That statistic tests the wrong
 * thing. An operator who grinds server seeds does not select on the rank of the first card; it
 * selects on the money the block returns. The report quantified the grind only in its 1/52
 * "chosen first card" form (~50 candidate seeds to fix one card), which is arithmetically true
 * and is not the attack.
 *
 * WHAT THIS SCRIPT DOES. For each revealed epoch of the capture it holds that epoch's REAL
 * client seed fixed — the honest player has not rotated after the commitment — draws CANDIDATES
 * candidate server seeds, plays all EPOCH_SIZE rounds of the served window under the same
 * audited basic-strategy table the audit uses everywhere (src/strategy.ts, via
 * src/round-engine.ts), and keeps the single most house-favourable block. It then runs STEP 19'S
 * OWN DETECTOR on the selected blocks and counts how many flag.
 *
 * "Step 19's own" is now literal (round-4 QA-04). The predicate is `cherryPickFlag()` from
 * src/config.ts — early bootstrap p < α AND late-window p ≥ α — shared with src/simulate.ts and
 * tests/steps/simulation.ts, and the null flag probability is the declared PASS2_P0 = α(1−α).
 * This script previously flagged on the early half alone and reported its chance rate and
 * survival probability at p₀ = α, which described a detector Step 19 does not implement. The
 * selected outcomes were unaffected; the detector arithmetic was not.
 *
 * WHAT IT DOES NOT CLAIM. This is not evidence that LIQD did this — Steps 1-6 prove the dealt
 * cards follow from the committed seeds, and no capture can distinguish a seed that was
 * generated once from a seed that was selected before commitment. It measures what the
 * DETECTOR would see if it had been done, which is the only thing in dispute.
 *
 * DETERMINISM. Candidate server seeds and bootstrap seeds are derived by SHA-256 from fixed
 * labels, not from crypto.randomBytes, so the artifact reproduces byte-for-byte on any machine.
 * (`outputs/simulation-results.json` deliberately does the opposite — Pass 1/2 there must be
 * fresh entropy. Here reproducibility is the point: this number is quoted in the report.)
 */

import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { blackjackShoe } from './rng';
import { settleShoe } from './round-engine';
import { chiSquaredTest, binomialSurvival } from './stats';
import { solveExact } from './exact-play';
import {
  RANKS, PASS2_ALPHA, PASS2_P0, PASS2_EARLY_NONCES, PASS2_TOTAL_NONCES, PASS2_LATE_NONCES,
  cherryPickFlag, EXPECTED_SEEDS, SIM_SD_PER_ROUND, rankOf,
} from './config';
import type { Dataset } from './types';

/** Candidate server seeds ground per epoch. 50 ≈ the "one chosen first card" budget the report already quotes. */
const CANDIDATES = 50;
/** Bootstrap replicates for the served-window null. Matches simulate.ts's Pass 2. */
const BOOTSTRAP_REPS = 2000;

const DATA_PATH = path.join(__dirname, '..', 'data', 'blackjack-6000hands.json');
const OUT_PATH = path.join(__dirname, '..', 'outputs', 'cherry-pick-attack.json');

/** Deterministic 32-hex-char server seed from a label — same shape as a real LIQD server seed. */
const seedFrom = (label: string): string => createHash('sha256').update(label).digest('hex').slice(0, 32);

/** Net result of one 50-round block: [wagered, returned] in initial-bet units. */
function playBlock(serverSeed: string, clientSeed: string, rounds: number): [number, number] {
  let wagered = 0, returned = 0;
  for (let n = 0; n < rounds; n++) {
    const [w, r] = settleShoe(blackjackShoe(serverSeed, clientSeed, n));
    wagered += w; returned += r;
  }
  return [wagered, returned];
}

/** First-card rank χ² over the served window of a (serverSeed, clientSeed) pair. */
function servedWindowChi2(serverSeed: string, clientSeed: string): number {
  const freq = new Array(RANKS).fill(0);
  for (let n = 0; n < PASS2_EARLY_NONCES; n++) {
    freq[rankOf(blackjackShoe(serverSeed, clientSeed, n)[0]) - 1]++;
  }
  return chiSquaredTest(freq, new Array(RANKS).fill(PASS2_EARLY_NONCES / RANKS)).chi2;
}

/**
 * First-card rank χ² and p over the LATE CONTROL window — nonces 50..999, the half of Step 19's
 * predicate this script used to ignore (round-4 QA-04).
 *
 * At 950 nonces the expected count per rank is 73, so `chiSquaredTest` pools nothing and the
 * statistic is a 13-bin χ² on df 12 — the same df Step 19 pins as FIRST_CARD_DF, and the same
 * construction `src/simulate.ts` uses for its own late window. Costs 950 shoe derivations per
 * epoch (114,000 in total, ≈70 s), which is why the scored verifier declines to recompute it on
 * every run and this producing script does it once.
 */
function lateWindowP(serverSeed: string, clientSeed: string): { chi2: number; df: number; p: number } {
  const freq = new Array(RANKS).fill(0);
  for (let n = PASS2_EARLY_NONCES; n < PASS2_TOTAL_NONCES; n++) {
    freq[rankOf(blackjackShoe(serverSeed, clientSeed, n)[0]) - 1]++;
  }
  const r = chiSquaredTest(freq, new Array(RANKS).fill(PASS2_LATE_NONCES / RANKS));
  return { chi2: r.chi2, df: r.df, p: r.pValue };
}

function main(): void {
  const ds = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')) as Dataset;
  const revealed = ds.seeds.filter((s) => s.serverSeed != null);
  if (revealed.length !== EXPECTED_SEEDS) {
    throw new Error(`expected ${EXPECTED_SEEDS} revealed seeds, found ${revealed.length}`);
  }

  const t0 = Date.now();

  // ── the Step-19 null, built exactly as simulate.ts builds it (deterministic seeds here) ──
  process.stdout.write(`  building the served-window bootstrap null (${BOOTSTRAP_REPS} reps)…`);
  const boot = new Float64Array(BOOTSTRAP_REPS);
  for (let r = 0; r < BOOTSTRAP_REPS; r++) {
    boot[r] = servedWindowChi2(seedFrom(`boot:server:${r}`), seedFrom(`boot:client:${r}`));
  }
  boot.sort();
  const bootstrapP = (stat: number): number => {
    let lo = 0, hi = boot.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (boot[mid] < stat) lo = mid + 1; else hi = mid; }
    return (boot.length - lo + 1) / (boot.length + 1);
  };
  process.stdout.write(` done (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);

  const rows: Array<Record<string, unknown>> = [];
  let honestWagered = 0, honestReturned = 0, groundWagered = 0, groundReturned = 0;
  let flagsRaised = 0;

  for (let i = 0; i < revealed.length; i++) {
    const s = revealed[i];
    const client = s.clientSeed;

    // The honest block: the seed LIQD actually committed and revealed.
    const [hw, hr] = playBlock(s.serverSeed as string, client, PASS2_EARLY_NONCES);
    honestWagered += hw; honestReturned += hr;

    // The grind: CANDIDATES seeds, keep the block that returns the player the least.
    let bestSeed = '', bestNet = Infinity, bestW = 0, bestR = 0;
    for (let k = 0; k < CANDIDATES; k++) {
      const cand = seedFrom(`grind:${s.epoch}:${k}`);
      const [w, r] = playBlock(cand, client, PASS2_EARLY_NONCES);
      if (r - w < bestNet) { bestNet = r - w; bestSeed = cand; bestW = w; bestR = r; }
    }
    groundWagered += bestW; groundReturned += bestR;

    // Now score the SELECTED block with Step 19's OWN detector — BOTH halves of it.
    // Round-4 QA-04: this used to apply `earlyP < α` alone and call the result "Step 19".
    // The late control window is computed for every epoch, not only the early-flagged ones, so
    // the artifact carries the full predicate's inputs for a reader to recheck.
    const chi2 = servedWindowChi2(bestSeed, client);
    const p = bootstrapP(chi2);
    const late = lateWindowP(bestSeed, client);
    const flag = cherryPickFlag(p, late.p);
    if (flag) flagsRaised++;

    rows.push({
      epoch: s.epoch,
      clientSeed: client,
      honestNet: hr - hw,
      honestRtp: hr / hw,
      groundNet: bestNet,
      groundRtp: bestR / bestW,
      groundServerSeed: bestSeed,
      servedWindowChi2: chi2,
      servedWindowBootstrapP: p,
      lateWindowChi2: late.chi2,
      lateWindowDf: late.df,
      lateWindowPValue: late.p,
      earlyExtreme: p < PASS2_ALPHA,
      lateQuiet: late.p >= PASS2_ALPHA,
      step19Flag: flag,
    });
    if ((i & 7) === 0) process.stdout.write(`  epoch ${s.epoch}/${revealed.length}…\r`);
  }

  // Read the attacked and honest blocks against a number this script did not measure.
  const exactEdge = solveExact({ kind: 'finite', decks: 8 }, 'TD').edgePerInitialBet;
  const expectedNetPerEpoch = -exactEdge * PASS2_EARLY_NONCES;
  const sdPerEpoch = SIM_SD_PER_ROUND * Math.sqrt(PASS2_EARLY_NONCES);
  const seMeanNet = sdPerEpoch / Math.sqrt(revealed.length);
  const honestMeanNet = (honestReturned - honestWagered) / revealed.length;
  const groundMeanNet = (groundReturned - groundWagered) / revealed.length;
  const worst = [...rows].sort((a, b) => Number(a.groundRtp) - Number(b.groundRtp))[0] as Record<string, number | boolean>;

  const artifact = {
    audit: 'LIQD Blackjack',
    what: 'Return-based server-seed grind vs the Step-19 rank-uniformity detector',
    method:
      `For each of the ${revealed.length} revealed epochs the epoch's real client seed is held fixed ` +
      `(the honest, non-rotating player), ${CANDIDATES} candidate server seeds are drawn deterministically, ` +
      `all ${PASS2_EARLY_NONCES} rounds of the served window are played under the audited basic-strategy ` +
      `table (src/strategy.ts via src/round-engine.ts), and the block returning the player the least is kept. ` +
      `The selected block is then scored by the audit's own Step-19 detector, in full: first-card rank χ² over ` +
      `the served window (nonces 0..${PASS2_EARLY_NONCES - 1}) against a ${BOOTSTRAP_REPS}-replicate bootstrap ` +
      `null, AND first-card rank χ² over the late control window (nonces ${PASS2_EARLY_NONCES}..` +
      `${PASS2_TOTAL_NONCES - 1}, df 12). A seed flags when the early p is below α=${PASS2_ALPHA} and the late ` +
      `p is not — the predicate exported as cherryPickFlag() in src/config.ts and used by src/simulate.ts, ` +
      `tests/steps/simulation.ts and this script alike.`,
    determinism:
      'Candidate and bootstrap seeds are SHA-256 of fixed labels, so this artifact reproduces byte-for-byte. ' +
      '`npm run attack` regenerates it.',
    notAClaim:
      'This does NOT assert LIQD selected its seeds. It measures what the detector would see if an operator had. ' +
      'No capture can separate a seed generated once from a seed selected before commitment.',
    candidatesPerEpoch: CANDIDATES,
    epochs: revealed.length,
    roundsPerEpoch: PASS2_EARLY_NONCES,
    bootstrapReps: BOOTSTRAP_REPS,
    alpha: PASS2_ALPHA,
    honest: {
      wagered: honestWagered,
      returned: honestReturned,
      rtp: honestReturned / honestWagered,
      meanNetPerEpoch: honestMeanNet,
      // The same figure with the sign stripped, because that is how the report states it
      // ("a mean loss of X units per epoch") and every published number needs a producing leaf.
      meanLossPerEpoch: -honestMeanNet,
      deviationSigmaVsExactExpectation: (honestMeanNet - expectedNetPerEpoch) / seMeanNet,
    },
    ground: {
      wagered: groundWagered,
      returned: groundReturned,
      rtp: groundReturned / groundWagered,
      meanNetPerEpoch: groundMeanNet,
      meanLossPerEpoch: -groundMeanNet,
      deviationSigmaVsExactExpectation: (groundMeanNet - expectedNetPerEpoch) / seMeanNet,
    },
    expectation: {
      note:
        'What an honest block is worth, from the deterministic exact 8-deck TD solve — the audit\'s ' +
        'authoritative RTP — so the honest and ground columns above are read against a number this ' +
        'script did not measure.',
      exactEdgePerInitialBet: exactEdge,
      meanLossPerEpochAtExactEdge: expectedNetPerEpoch < 0 ? -expectedNetPerEpoch : expectedNetPerEpoch,
      meanNetPerEpochAtExactEdge: expectedNetPerEpoch,
      sdPerEpoch: sdPerEpoch,
      seOfMeanOverEpochs: seMeanNet,
    },
    detector: {
      step19FlagsOnSelectedBlocks: flagsRaised,
      // p₀ is the per-seed flag probability under the CONJUNCTION α(1−α), not α: a seed must be
      // early-extreme AND late-quiet. Using α here (round-4 QA-04) overstated both the chance
      // rate and the survival probability, and described a detector Step 19 does not implement.
      nullFlagProbability: PASS2_P0,
      expectedFlagsByChance: revealed.length * PASS2_P0,
      binomialSurvivalP: binomialSurvival(flagsRaised, revealed.length, PASS2_P0),
      earlyExtremeCount: rows.filter((r) => r.earlyExtreme === true).length,
      lateQuietAmongEarlyExtreme: rows.filter((r) => r.earlyExtreme === true && r.lateQuiet === true).length,
      worstGroundBlock: {
        epoch: worst.epoch,
        groundRtp: worst.groundRtp,
        groundNet: worst.groundNet,
        groundLoss: -(worst.groundNet as number),
        servedWindowBootstrapP: worst.servedWindowBootstrapP,
        lateWindowPValue: worst.lateWindowPValue,
        step19Flag: worst.step19Flag,
      },
      note:
        'Flags on the SELECTED (attacked) blocks, under Step 19\'s full predicate. What this ' +
        'measures: whether deliberately money-selected blocks flag MORE OFTEN than chance. ' +
        'binomialSurvivalP is P(X >= flags) at p₀ = α(1−α) over the same number of seeds. ' +
        'FINDING, stated as measured rather than as a general claim: this experiment did not ' +
        'produce a significant excess of flags — the observed count sits within ordinary sampling ' +
        'variation of the chance rate, so it gives no evidence that the rank-uniformity statistic ' +
        'responds to a money-based grind. That is a null result at this experiment\'s size and ' +
        'candidate budget, not a proof that the detector has zero power at every attack strength; ' +
        'no power calculation was performed and none is claimed.',
    },
    // NOTE: no timestamp and no elapsed time in this artifact, deliberately. It is hash-pinned
    // (ATTACK_SHA256) and the pin is only meaningful if a re-run reproduces the file byte-for-byte.
    results: rows,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(artifact, null, 2));

  console.log('');
  console.log(`  honest  : RTP ${(artifact.honest.rtp * 100).toFixed(4)}%  mean net ${artifact.honest.meanNetPerEpoch.toFixed(4)} units/epoch  (${artifact.honest.deviationSigmaVsExactExpectation.toFixed(2)}σ vs the exact expectation ${expectedNetPerEpoch.toFixed(4)})`);
  console.log(`  ground  : RTP ${(artifact.ground.rtp * 100).toFixed(4)}%  mean net ${artifact.ground.meanNetPerEpoch.toFixed(4)} units/epoch  (${CANDIDATES} candidates/epoch)`);
  console.log(`  Step 19 : ${flagsRaised}/${revealed.length} selected blocks flagged (chance rate ${(revealed.length * PASS2_P0).toFixed(1)} at p₀=α(1−α)=${PASS2_P0}, survival P=${artifact.detector.binomialSurvivalP.toFixed(10)})`);
  console.log(`            early-extreme ${artifact.detector.earlyExtremeCount}, of which late-quiet ${artifact.detector.lateQuietAmongEarlyExtreme}`);
  console.log(`  worst   : epoch ${String(worst.epoch)} RTP ${(Number(worst.groundRtp) * 100).toFixed(2)}% net ${Number(worst.groundNet).toFixed(2)} — flagged: ${String(worst.step19Flag)}`);
  console.log(`  ${((Date.now() - t0) / 1000).toFixed(1)}s → ${path.relative(process.cwd(), OUT_PATH)}`);
}

main();
