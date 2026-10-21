import { strict as assert } from 'node:assert';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  DATASET_SHA256, SIMULATION_SHA256, SIMULATION_HTML_SHA256, EXACT_RTP_SHA256,
  ATTACK_SHA256, RNG_BRANCH_SHA256,
  SIMULATION_PROVENANCE_SHA256, BOOTSTRAP_NULLS_SHA256, BOOTSTRAP_NULL_FILE, DEEP_REPLAY_METHOD,
  SIM_BASE_ROUNDS, SIM_PASS1_ROUNDS, RANKS, FIRST_CARD_DF, EXPECTED_SEEDS, PASS2_EARLY_NONCES,
  PASS2_ALPHA, PASS2_P0, cherryPickFlag,
} from '../../src/config';
import { unitsOf, unitsOr0, asMoney, GRID, GRID_TOL } from '../../src/money';

/**
 * Artifact-integrity guards.
 *
 * TWO KINDS, and the repo needs both.
 *
 * 1. FORMATTING. The generators write canonical 2-space JSON, so any hand edit that changes a
 *    value or the formatting breaks a round-trip against JSON.stringify(..., null, 2).
 *    simulate.ts writes NO trailing newline; exact-play.ts writes one. This catches the exact
 *    failure mode that once shipped — edit a value in place, re-serialise part of the file,
 *    forget the twin — but it does NOT catch a value edit that stays canonical.
 *
 * 2. VALUE. Ten committed artifacts are hash-pinned in src/config.ts. Eight of those pins are
 *    asserted here — DATASET_SHA256, SIMULATION_SHA256, SIMULATION_HTML_SHA256, EXACT_RTP_SHA256,
 *    ATTACK_SHA256, RNG_BRANCH_SHA256, SIMULATION_PROVENANCE_SHA256 and BOOTSTRAP_NULLS_SHA256; the
 *    two replay reports (DEEP_REPLAY_SHA256, BOOTSTRAP_REPLAY_SHA256) are reconciled in scored
 *    Step 25 only, with the other eight. exact-rtp.json is pinned because a
 *    forged-artifact probe planted self-consistent nonsense in it and the verifier scored its
 *    full 31 steps without ever reading the file.
 *
 * exact-rtp.json carries a SECOND, stronger guard on top of its pin: a field-by-field live
 * re-derivation in tests/blackjack/exactSolverTests.ts. A hash says the bytes have not moved;
 * the re-derivation says the numbers are the real solve.
 *
 * 3. POPULATION SHAPE. The simulation artifact's declared experiment — base-game round count,
 *    Pass-1 round count and df, Pass-2 seed count — is bound to the pins in src/config.ts here
 *    as well as in the scored steps. A block that only the step it parameterises ever reads is
 *    a block that can be rewritten into a looser gate without anything noticing.
 *
 * outputs/verification-results.json is the suite's OUTPUT, not an input, and is deliberately
 * unpinned — pinning a file the run rewrites would only pin the last run.
 *
 * NOTE on where the pins are ENFORCED at run time: enforcement lives in scored Step 25 (Artifact
 * Hash Integrity), which asserts presence and hash for all ten. Aborting the process on a
 * mismatch before a single step printed would instead make an artifact forgery look like a crash
 * to any harness reading the run — scored NOT RUN rather than CAUGHT — and would let a DELETED
 * artifact skip the guard entirely.
 */
const OUT = path.join(__dirname, '..', '..', 'outputs');
const DATA = path.join(__dirname, '..', '..', 'data', 'blackjack-6000hands.json');
const sha256 = (p: string): string => createHash('sha256').update(fs.readFileSync(p)).digest('hex');

describe('artifact integrity — every committed input matches its pin in src/config.ts', () => {
  it('data/blackjack-6000hands.json hash matches DATASET_SHA256', () => {
    const actual = sha256(DATA);
    assert.equal(actual, DATASET_SHA256,
      `blackjack-6000hands.json hash ≠ the pinned DATASET_SHA256 — expected ${DATASET_SHA256}, got ${actual}`);
  });

  it('outputs/simulation-results.json hash matches SIMULATION_SHA256', () => {
    const actual = sha256(path.join(OUT, 'simulation-results.json'));
    assert.equal(actual, SIMULATION_SHA256,
      `simulation-results.json hash ≠ the pinned SIMULATION_SHA256 — expected ${SIMULATION_SHA256}, got ${actual}. ` +
      'Re-run `npm run simulate` and re-pin, or restore the committed artifact.');
  });

  it('outputs/rtp-convergence.html hash matches SIMULATION_HTML_SHA256', () => {
    const actual = sha256(path.join(OUT, 'rtp-convergence.html'));
    assert.equal(actual, SIMULATION_HTML_SHA256,
      `rtp-convergence.html hash ≠ the pinned SIMULATION_HTML_SHA256 — expected ${SIMULATION_HTML_SHA256}, got ${actual}. ` +
      'The chart and the JSON are one `npm run simulate` and must move together.');
  });

  it('outputs/cherry-pick-attack.json hash matches ATTACK_SHA256', () => {
    const actual = sha256(path.join(OUT, 'cherry-pick-attack.json'));
    assert.equal(actual, ATTACK_SHA256,
      `cherry-pick-attack.json hash ≠ the pinned ATTACK_SHA256 — expected ${ATTACK_SHA256}, got ${actual}. ` +
      'It is deterministic: re-run `npm run attack`.');
  });

  it('outputs/rng-branch-coverage.json hash matches RNG_BRANCH_SHA256', () => {
    const actual = sha256(path.join(OUT, 'rng-branch-coverage.json'));
    assert.equal(actual, RNG_BRANCH_SHA256,
      `rng-branch-coverage.json hash ≠ the pinned RNG_BRANCH_SHA256 — expected ${RNG_BRANCH_SHA256}, got ${actual}. ` +
      'It is deterministic: re-run `npm run branches`.');
  });

  it('outputs/simulation-provenance.json hash matches SIMULATION_PROVENANCE_SHA256', () => {
    const actual = sha256(path.join(OUT, 'simulation-provenance.json'));
    assert.equal(actual, SIMULATION_PROVENANCE_SHA256,
      `simulation-provenance.json hash \u2260 the pinned SIMULATION_PROVENANCE_SHA256 — expected ${SIMULATION_PROVENANCE_SHA256}, got ${actual}. ` +
      'The provenance record and the simulation are one `npm run simulate` and must move together.');
  });

  it('outputs/bootstrap-nulls.float64le hash matches BOOTSTRAP_NULLS_SHA256', () => {
    const actual = sha256(path.join(OUT, BOOTSTRAP_NULL_FILE));
    assert.equal(actual, BOOTSTRAP_NULLS_SHA256,
      `${BOOTSTRAP_NULL_FILE} hash \u2260 the pinned BOOTSTRAP_NULLS_SHA256 — expected ${BOOTSTRAP_NULLS_SHA256}, got ${actual}. ` +
      'These 2,000 retained statistics are the evidence behind every published earlyBootstrapP.');
  });

  // STALENESS GUARD. The deep-replay report is pinned, so a report written
  // by an OLDER replay passes its pin: until 2026-10-02 the committed report said "Exact equality on
  // every field; no tolerance" while src/deep-replay.ts had held two fields to the reproduction bound
  // since 2026-09-28. The method sentence is declared once (src/config.ts DEEP_REPLAY_METHOD), the
  // replay writes it, and the committed report must carry it.
  it('outputs/deep-replay-report.json carries the method sentence src/deep-replay.ts writes', () => {
    const report = JSON.parse(fs.readFileSync(path.join(OUT, 'deep-replay-report.json'), 'utf8'));
    assert.equal(report.method, DEEP_REPLAY_METHOD,
      'deep-replay-report.json was written by a different deep-replay.ts than the one shipped — re-run `npx ts-node src/deep-replay.ts --commit` and re-pin DEEP_REPLAY_SHA256');
  });

  it('outputs/exact-rtp.json hash matches EXACT_RTP_SHA256', () => {
    const actual = sha256(path.join(OUT, 'exact-rtp.json'));
    assert.equal(actual, EXACT_RTP_SHA256,
      `exact-rtp.json hash ≠ the pinned EXACT_RTP_SHA256 — expected ${EXACT_RTP_SHA256}, got ${actual}. ` +
      'The file is deterministic: re-run `npm run rtp`. If it still differs, the solver changed.');
  });
});

describe('artifact integrity — the simulation artifact declares the experiment the code pins', () => {
  // Reading gate parameters OUT of these blocks — sigma from `baseGame.rounds` for Step 17, the
  // chi-squared df from `pass1_fresh_seeds.firstCardDf` for Step 18, p0 from
  // `pass2_casino_seeds.expectedFlagsByChance / seeds_tested` for Step 19 — would make each
  // forgeable into a looser test. They are pinned in src/config.ts, and the artifact has to
  // agree with the pins, asserted here as well as in the scored steps so the binding does not
  // depend on the step that consumes the block.
  const sim = JSON.parse(fs.readFileSync(path.join(OUT, 'simulation-results.json'), 'utf8'));

  it('baseGame.rounds equals the pinned SIM_BASE_ROUNDS (the tolerance is not the artifact\'s to set)', () => {
    assert.equal(sim.baseGame.rounds, SIM_BASE_ROUNDS);
  });

  it('pass1_fresh_seeds declares the pinned round count and RANKS-1 degrees of freedom', () => {
    assert.equal(sim.pass1_fresh_seeds.rounds, SIM_PASS1_ROUNDS);
    assert.equal(sim.pass1_fresh_seeds.firstCardDf, FIRST_CARD_DF,
      `a first-card rank test over ${RANKS} ranks has ${FIRST_CARD_DF} df; the artifact does not get to choose`);
  });

  it('pass2_casino_seeds covers exactly EXPECTED_SEEDS epochs, one result row each', () => {
    assert.equal(sim.pass2_casino_seeds.seeds_tested, EXPECTED_SEEDS);
    assert.equal(sim.pass2_casino_seeds.results.length, EXPECTED_SEEDS);
    const uniq = new Set(sim.pass2_casino_seeds.results.map((r: { hashedServerSeed: string }) => r.hashedServerSeed));
    assert.equal(uniq.size, EXPECTED_SEEDS, 'duplicate hashedServerSeed among the Pass-2 result rows');
  });

  it('the Pass-2 early window is the served window the capture plan declares', () => {
    assert.deepEqual(sim.pass2_casino_seeds.earlyWindow, [0, PASS2_EARLY_NONCES - 1]);
  });
});

/**
 * THE CHERRY-PICK FLAG PREDICATE — one definition, and the attack artifact obeys it.
 *
 * Step 19 requires early-extreme AND late-quiet, whose per-seed null probability is α(1−α).
 * Scoring selected blocks on the EARLY half alone (`p < α`) and labelling that "Step 19" would
 * report a chance rate of epochs × α and a binomial survival at p₀ = α — the wrong detector and
 * the wrong null. The predicate lives once, in `src/config.ts`; these tests execute it, including
 * the case an early-only version gets wrong, and bind the artifact's own flag column to it, so a
 * drift is a red test rather than a paragraph.
 */
describe('cherry-pick detector — the flag predicate and the attack artifact agree', () => {
  const atk = JSON.parse(fs.readFileSync(path.join(OUT, 'cherry-pick-attack.json'), 'utf8'));

  it('flags only when the early window is extreme AND the late window is not', () => {
    assert.equal(cherryPickFlag(0.01, 0.40), true, 'early-extreme, late-quiet must flag');
    assert.equal(cherryPickFlag(0.40, 0.40), false, 'a quiet early window must not flag');
    assert.equal(cherryPickFlag(PASS2_ALPHA, 0.40), false, 'the early test is strict (<α), not ≤α');
    assert.equal(cherryPickFlag(0.01, PASS2_ALPHA), true, 'the late test is ≥α, so exactly α is quiet');
  });

  it('does NOT flag when BOTH windows are extreme — the case the early-only version got wrong', () => {
    // A seed whose late control window is ALSO significant is a seed with a persistent
    // irregularity, not the early-only signature of a selected block. Step 19 declines to flag
    // it; the attack script's old `p < α` test would have flagged it, which is precisely why its
    // reported chance rate and survival probability described a different detector.
    assert.equal(cherryPickFlag(0.01, 0.01), false, 'both windows extreme must NOT flag');
    assert.equal(cherryPickFlag(0.0001, 0.049), false, 'a late p just under α must NOT flag');
  });

  it('the per-seed null probability is α(1−α), and the artifact uses it', () => {
    assert.equal(PASS2_P0, PASS2_ALPHA * (1 - PASS2_ALPHA));
    assert.equal(atk.detector.nullFlagProbability, PASS2_P0,
      'the attack artifact scored its flags against a null other than the declared one');
    assert.equal(atk.detector.expectedFlagsByChance, EXPECTED_SEEDS * PASS2_P0);
  });

  it('every row of the attack artifact carries both windows and obeys the shared predicate', () => {
    const rows = atk.results as Array<Record<string, number | boolean>>;
    assert.equal(rows.length, EXPECTED_SEEDS);
    let flags = 0;
    for (const r of rows) {
      assert.equal(typeof r.servedWindowBootstrapP, 'number', `epoch ${String(r.epoch)} has no early p`);
      assert.equal(typeof r.lateWindowPValue, 'number', `epoch ${String(r.epoch)} has no late p — the late window was not computed`);
      assert.equal(r.lateWindowDf, FIRST_CARD_DF,
        `the late window is ${RANKS} unpooled bins, so it must carry df ${FIRST_CARD_DF}`);
      const expected = cherryPickFlag(Number(r.servedWindowBootstrapP), Number(r.lateWindowPValue));
      assert.equal(r.step19Flag, expected, `epoch ${String(r.epoch)}: recorded flag disagrees with the predicate`);
      if (expected) flags++;
    }
    assert.equal(atk.detector.step19FlagsOnSelectedBlocks, flags,
      'the artifact\'s flag total disagrees with the count recomputed from its own rows');
  });
});

describe('artifact integrity — committed outputs are canonical, un-hand-edited JSON', () => {
  it('cherry-pick-attack.json and rng-branch-coverage.json round-trip canonical 2-space JSON', () => {
    for (const f of ['cherry-pick-attack.json', 'rng-branch-coverage.json']) {
      const raw = fs.readFileSync(path.join(OUT, f), 'utf8');
      assert.equal(JSON.stringify(JSON.parse(raw), null, 2), raw,
        `${f} is not byte-identical to its canonical re-serialisation — hand-edited or reformatted`);
    }
  });

  it('simulation-results.json round-trips canonical 2-space JSON with NO trailing newline (simulate.ts)', () => {
    const raw = fs.readFileSync(path.join(OUT, 'simulation-results.json'), 'utf8');
    assert.equal(JSON.stringify(JSON.parse(raw), null, 2), raw,
      'simulation-results.json is not byte-identical to its canonical re-serialisation — hand-edited or reformatted');
  });

  it('exact-rtp.json round-trips canonical 2-space JSON PLUS one trailing newline (exact-play.ts)', () => {
    const raw = fs.readFileSync(path.join(OUT, 'exact-rtp.json'), 'utf8');
    assert.equal(JSON.stringify(JSON.parse(raw), null, 2) + '\n', raw,
      'exact-rtp.json is not byte-identical to its canonical re-serialisation + trailing newline — hand-edited');
  });
});

/**
 * MONEY ON THE SETTLEMENT GRID — the conversion every payout check runs on.
 *
 * A 1e-6 float tolerance accepts a wrong amount that happens to sit on the grid: `0.20 →
 * 0.1999995` is 50 whole settlement units short and passes such a comparison. The payout checks
 * are integer equality in 1e-8 units, and the only tolerance left is `GRID_TOL`, which exists
 * solely to read a JSON double back onto the grid. These tests pin
 * the two things that constant has to do at once: absorb the real IEEE-754 noise in the committed
 * dataset, and never absorb a one-unit money error.
 */
describe('money — recorded amounts convert to exact 1e-8 settlement units', () => {
  it('reads the dataset\'s worst float artifact as the amount it is meant to be', () => {
    // The largest representation deviations in the committed capture: the round credits at epoch 25
    // nonce 38 (4.299999999999999) and epoch 68 nonce 38 (5.800000000000001), each approximately
    // 1.19e-7 grid units off, which must read as exactly 430,000,000 and 580,000,000 units. Epoch 2
    // nonce 25's 4.6000000000000005 (5.96e-8 units off) is the worked example in the report.
    assert.equal(unitsOf(4.299999999999999), 430_000_000);
    assert.equal(unitsOf(5.800000000000001), 580_000_000);
    assert.equal(unitsOf(4.6000000000000005), 460_000_000);
    assert.equal(asMoney(unitsOf(4.6000000000000005) as number), '4.60000000');
    assert.equal(unitsOf('0.10000000'), 10_000_000, 'string amounts convert the same way');
    assert.equal(unitsOf(0.25), 25_000_000);
    assert.equal(unitsOf(0), 0);
  });

  it('separates a ONE-UNIT money error from float noise', () => {
    // The smallest discrepancy the grid admits. If GRID_TOL ever absorbed this, the exact
    // comparison would silently become a tolerance again.
    assert.notEqual(unitsOf(0.19999999), unitsOf(0.2));
    assert.equal((unitsOf(0.2) as number) - (unitsOf(0.19999999) as number), 1);
    // And the on-grid underpayment R34 executes: 50 units, far below the retired 1e-6 tolerance.
    assert.equal((unitsOf(0.2) as number) - (unitsOf(0.1999995) as number), 50);
    assert.ok(Math.abs(0.2 - 0.1999995) < 1e-6, 'the old tolerance really was blind to it');
  });

  it('refuses an OFF-grid amount rather than rounding it', () => {
    assert.equal(unitsOf(0.250000001), null, 'a +1e-9 perturbation is not a settlement amount');
    assert.equal(unitsOf(Number.NaN), null);
    assert.equal(unitsOf(Number.POSITIVE_INFINITY), null);
    assert.equal(unitsOf(null), null);
    assert.equal(unitsOf(undefined), null);
    assert.equal(unitsOr0(null), 0, 'an absent optional component sums as zero');
  });

  it('GRID_TOL sits far above the dataset\'s measured noise and far below one unit', () => {
    // Both directions asserted, so neither can be widened without a red test.
    const worstMeasuredNoise = Math.max(Math.abs(4.299999999999999 * GRID - 430_000_000), Math.abs(5.800000000000001 * GRID - 580_000_000));
    assert.ok(worstMeasuredNoise < GRID_TOL / 100,
      `measured noise ${worstMeasuredNoise} must sit well inside GRID_TOL ${GRID_TOL}`);
    assert.ok(GRID_TOL < 0.5, 'GRID_TOL must be far below the half-unit that would round a real error away');
  });
});
