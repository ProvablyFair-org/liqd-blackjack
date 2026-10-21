/**
 * RETAINED SIMULATION INPUTS — the unit half of the retained-inputs guard.
 *
 * Without a recorded seed pair and bootstrap random inputs, the simulation's experiments cannot
 * be replayed. Scored Steps 17–19 bind the
 * retained inputs inside `npm run verify`. These tests cover what a scored step cannot:
 *
 *   - the DERIVATION itself (domain separation, version binding, determinism, rejection of a bad
 *     master seed) — properties of the mechanism, not of one artifact;
 *   - the deterministic Pass-0 stream (uniformity, exact reproducibility, refusal of a degenerate
 *     seed);
 *   - the retained null file's round-trip encoding and the bootstrap p-value arithmetic;
 *   - NEGATIVE CONTROLS: corrupt one retained input and show the checks FAIL. A replay that has
 *     never been seen to fail is not evidence that anything was checked;
 *   - the frozen superseded artifact, asserted to be exactly what it was and to carry none of the
 *     replay fields this release adds.
 */

import { strict as assert } from 'node:assert';
import { createHmac, createHash } from 'node:crypto';
import * as fs from 'fs';
import * as path from 'path';

import { blackjackShoe } from '../../src/rng';
import {
  deriveSeedHex, isMasterSeed, SEED_DERIVATION_VERSION, SEED_DOMAINS,
} from '../../src/seed-derivation';
import { xoshiro128ss } from '../../src/prng';
import {
  replayPass0, replayPass1, replayBootstrapNull, replayBootstrapNulls,
  encodeNulls, decodeNulls, sortedCopy, bootstrapP, checkpointMarks,
} from '../../src/replay';
import {
  LEGACY_SIMULATION_SHA256, SIM_BASE_ROUNDS, SIM_BOOTSTRAP_REPS, BOOTSTRAP_NULL_FILE,
  PASS2_EARLY_NONCES, RANKS,
} from '../../src/config';

const ROOT = path.join(__dirname, '..', '..');
const OUTPUTS = path.join(ROOT, 'outputs');
const MASTER_A = 'a'.repeat(64);
const MASTER_B = `${'a'.repeat(63)}b`;   // differs from MASTER_A in one nibble

const sha256File = (p: string): string => createHash('sha256').update(fs.readFileSync(p)).digest('hex');

describe('blackjack: versioned seed derivation', () => {
  it('is deterministic, and a different master seed gives a different seed', () => {
    assert.equal(deriveSeedHex(MASTER_A, 'd', 0), deriveSeedHex(MASTER_A, 'd', 0));
    assert.notEqual(deriveSeedHex(MASTER_A, 'd', 0), deriveSeedHex(MASTER_B, 'd', 0));
  });

  it('separates domains and indices — no stream is reachable from another', () => {
    const seen = new Set<string>();
    for (const domain of Object.values(SEED_DOMAINS)) {
      for (let i = 0; i < 8; i++) seen.add(deriveSeedHex(MASTER_A, domain, i));
    }
    assert.equal(seen.size, Object.values(SEED_DOMAINS).length * 8);
  });

  it('follows the formula the provenance record publishes, version included', () => {
    // Recomputed from the documented rule rather than by calling the function twice, so this
    // asserts the published formula and not merely self-consistency.
    const expected = createHmac('sha256', Buffer.from(MASTER_A, 'hex'))
      .update(`${SEED_DERIVATION_VERSION}:${SEED_DOMAINS.pass1Server}:0`, 'utf8')
      .digest().subarray(0, 16).toString('hex');
    assert.equal(deriveSeedHex(MASTER_A, SEED_DOMAINS.pass1Server, 0), expected);
    assert.equal(expected.length, 32, '16 bytes of hex');
  });

  it('refuses a master seed that is not usable hex, and a negative index', () => {
    assert.equal(isMasterSeed('not-hex'), false);
    assert.equal(isMasterSeed('abc'), false);                    // too short
    assert.equal(isMasterSeed(MASTER_A.toUpperCase()), false);   // upper case is not the recorded form
    assert.equal(isMasterSeed(MASTER_A), true);
    assert.throws(() => deriveSeedHex('zz', 'd', 0), /invalid master seed/);
    assert.throws(() => deriveSeedHex(MASTER_A, 'd', -1), /non-negative integer/);
  });
});

describe('blackjack: deterministic Pass-0 stream', () => {
  it('reproduces exactly from the same seed and diverges from a different one', () => {
    const a = xoshiro128ss(deriveSeedHex(MASTER_A, SEED_DOMAINS.pass0Shuffle, 0));
    const b = xoshiro128ss(deriveSeedHex(MASTER_A, SEED_DOMAINS.pass0Shuffle, 0));
    const c = xoshiro128ss(deriveSeedHex(MASTER_B, SEED_DOMAINS.pass0Shuffle, 0));
    const first = Array.from({ length: 64 }, () => a.nextUint32());
    assert.deepEqual(Array.from({ length: 64 }, () => b.nextUint32()), first);
    assert.notDeepEqual(Array.from({ length: 64 }, () => c.nextUint32()), first);
  });

  it('refuses the degenerate all-zero state and a malformed seed', () => {
    assert.throws(() => xoshiro128ss('0'.repeat(32)), /degenerate/);
    assert.throws(() => xoshiro128ss('abc'), /lowercase hex/);
  });

  it('below(n) is uniform on [0, n): 260,000 draws over 13 bins, under the df=12 0.1% critical value', () => {
    const s = xoshiro128ss(deriveSeedHex(MASTER_A, 'uniformity-probe', 0));
    const N = 260_000;
    const freq = new Array<number>(RANKS).fill(0);
    for (let i = 0; i < N; i++) {
      const v = s.below(RANKS);
      assert.ok(Number.isInteger(v) && v >= 0 && v < RANKS, `below(13) returned ${v}`);
      freq[v]++;
    }
    const e = N / RANKS;
    const chi2 = freq.reduce((acc, o) => acc + ((o - e) ** 2) / e, 0);
    assert.ok(chi2 < 32.91, `chi-squared ${chi2} is at or above the df=12 0.1% critical value 32.91`);
  });

  it('rejects an out-of-range request rather than returning a biased index', () => {
    const s = xoshiro128ss(deriveSeedHex(MASTER_A, 'range-probe', 0));
    assert.throws(() => s.below(0), /range must be an integer/);
    assert.throws(() => s.below(2.5), /range must be an integer/);
  });
});

describe('blackjack: the passes are pure functions of the master seed', () => {
  it('Pass 0 replays identically, and a prefix agrees with the full run at the shared checkpoint', () => {
    const full = replayPass0(MASTER_A, 3_000);
    assert.deepEqual(replayPass0(MASTER_A, 3_000), full);
    // The first checkpoint of a 3,000-round run is the 1,000-round mark; running only 1,000 rounds
    // must land on exactly the same numbers — the property scored Step 17 relies on.
    const prefix = replayPass0(MASTER_A, 1_000);
    const shared = full.checkpoints.find((c) => c.rounds === 1_000);
    assert.ok(shared, 'the 1,000-round checkpoint must exist in a 3,000-round run');
    assert.deepEqual(prefix.checkpoints[0], shared);
  });

  it('checkpointMarks derives the decade marks from the round count alone', () => {
    assert.equal(Math.min(...checkpointMarks(SIM_BASE_ROUNDS)), 1_000);
    assert.equal(checkpointMarks(1_000).size, 0);
  });

  it('Pass 1 derives and returns its seed pair, and replays identically', () => {
    const a = replayPass1(MASTER_A, 300);
    assert.equal(a.serverSeed, deriveSeedHex(MASTER_A, SEED_DOMAINS.pass1Server, 0));
    assert.equal(a.clientSeed, deriveSeedHex(MASTER_A, SEED_DOMAINS.pass1Client, 0));
    assert.deepEqual(replayPass1(MASTER_A, 300), a);
    assert.notEqual(replayPass1(MASTER_B, 300).firstCardChi2, a.firstCardChi2);
  });

  it('a bootstrap replicate is ADDRESSABLE — replicate r alone reproduces the r-th retained value', () => {
    const all = replayBootstrapNulls(MASTER_A, 6, PASS2_EARLY_NONCES);
    for (let r = 0; r < 6; r++) {
      assert.equal(replayBootstrapNull(MASTER_A, r, PASS2_EARLY_NONCES), all[r], `replicate ${r}`);
    }
  });

  it('each replicate draws its own fair seed pair — the null does not collapse to one stream', () => {
    assert.notEqual(
      replayBootstrapNull(MASTER_A, 0, PASS2_EARLY_NONCES),
      replayBootstrapNull(MASTER_A, 1, PASS2_EARLY_NONCES),
    );
    const shoe = blackjackShoe(
      deriveSeedHex(MASTER_A, SEED_DOMAINS.pass2BootstrapServer, 0),
      deriveSeedHex(MASTER_A, SEED_DOMAINS.pass2BootstrapClient, 0), 0,
    );
    assert.equal(shoe.length, 416);
  });
});

describe('blackjack: the retained null file', () => {
  it('round-trips through the committed little-endian float64 encoding', () => {
    const values = replayBootstrapNulls(MASTER_A, 12, PASS2_EARLY_NONCES);
    const buf = encodeNulls(values);
    assert.equal(buf.length, 12 * 8);
    assert.deepEqual(Array.from(decodeNulls(buf)), Array.from(values));
  });

  it('is stored in GENERATION order — sorting happens on a copy, at read time', () => {
    const values = replayBootstrapNulls(MASTER_A, 24, PASS2_EARLY_NONCES);
    const before = Array.from(values);
    const sorted = sortedCopy(values);
    assert.deepEqual(Array.from(values), before, 'sortedCopy must not reorder the caller');
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(sorted[i] >= sorted[i - 1], `sorted copy is out of order at ${i}`);
    }
  });

  it('refuses a truncated file rather than silently reading fewer replicates', () => {
    const buf = encodeNulls(replayBootstrapNulls(MASTER_A, 4, PASS2_EARLY_NONCES));
    assert.throws(() => decodeNulls(buf.subarray(0, buf.length - 3)), /not a multiple of 8/);
  });

  it('bootstrapP is (count at or above the statistic + 1) / (reps + 1)', () => {
    const sorted = Float64Array.from([1, 2, 3, 4]);
    assert.equal(bootstrapP(sorted, 0), 5 / 5);   // all four are >= 0
    assert.equal(bootstrapP(sorted, 3), 3 / 5);   // 3 and 4 are >= 3
    assert.equal(bootstrapP(sorted, 9), 1 / 5);   // none are
  });
});

describe('blackjack: NEGATIVE CONTROLS — a corrupted retained input must be rejected', () => {
  // Each of these perturbs ONE retained input and asserts the check that exists to catch it
  // actually does. Without them, "the replay passes" is a statement about a procedure nobody has
  // ever seen fail.

  it('a single flipped bit in the retained nulls changes the file digest', () => {
    const good = encodeNulls(replayBootstrapNulls(MASTER_A, 16, PASS2_EARLY_NONCES));
    const bad = Buffer.from(good);
    bad[0] ^= 0x01;
    assert.notEqual(
      createHash('sha256').update(bad).digest('hex'),
      createHash('sha256').update(good).digest('hex'),
    );
  });

  it('a retained null value altered in place no longer matches its re-derivation', () => {
    const tampered = Float64Array.from(replayBootstrapNulls(MASTER_A, 16, PASS2_EARLY_NONCES));
    tampered[7] = tampered[7] + 1e-9;                  // an edit far too small to look wrong
    let mismatches = 0;
    for (let r = 0; r < tampered.length; r++) {
      if (replayBootstrapNull(MASTER_A, r, PASS2_EARLY_NONCES) !== tampered[r]) mismatches++;
    }
    assert.equal(mismatches, 1, 'exactly the tampered replicate must fail re-derivation');
  });

  it('a tampered null moves the bootstrap p-value it feeds', () => {
    const values = replayBootstrapNulls(MASTER_A, 32, PASS2_EARLY_NONCES);
    const sorted = sortedCopy(values);
    const median = sorted[Math.floor(sorted.length / 2)];
    const inflated = sortedCopy(Float64Array.from(values, (v) => v + 1e6));
    assert.ok(bootstrapP(inflated, median) > bootstrapP(sorted, median),
      'pushing every null above the observed statistic must raise its p-value');
  });

  it('a master seed altered by one nibble reproduces nothing, in any of the three passes', () => {
    const values = replayBootstrapNulls(MASTER_A, 8, PASS2_EARLY_NONCES);
    let mismatches = 0;
    for (let r = 0; r < values.length; r++) {
      if (replayBootstrapNull(MASTER_B, r, PASS2_EARLY_NONCES) !== values[r]) mismatches++;
    }
    assert.equal(mismatches, values.length);
    assert.notEqual(replayPass1(MASTER_B, 200).serverSeed, replayPass1(MASTER_A, 200).serverSeed);
    assert.notEqual(
      replayPass0(MASTER_B, 1_000).checkpoints[0].rtp,
      replayPass0(MASTER_A, 1_000).checkpoints[0].rtp,
    );
  });

  it('a wrong derivation domain reproduces nothing — domain separation is load-bearing', () => {
    assert.notEqual(
      deriveSeedHex(MASTER_A, SEED_DOMAINS.pass2BootstrapServer, 3),
      deriveSeedHex(MASTER_A, SEED_DOMAINS.pass2BootstrapClient, 3),
    );
  });
});

describe('blackjack: the committed simulation carries its retained inputs', () => {
  const simPath = path.join(OUTPUTS, 'simulation-results.json');
  const provPath = path.join(OUTPUTS, 'simulation-provenance.json');
  const nullPath = path.join(OUTPUTS, BOOTSTRAP_NULL_FILE);

  it('records a usable master seed and the derivation version', () => {
    const sim = JSON.parse(fs.readFileSync(simPath, 'utf8'));
    assert.ok(isMasterSeed(sim.masterSeed), `masterSeed ${String(sim.masterSeed)} is not usable`);
    assert.equal(sim.seedDerivation, SEED_DERIVATION_VERSION);
  });

  it('records the Pass-1 seed pair, and it re-derives from the master seed', () => {
    const sim = JSON.parse(fs.readFileSync(simPath, 'utf8'));
    assert.equal(sim.pass1_fresh_seeds.serverSeed, deriveSeedHex(sim.masterSeed, SEED_DOMAINS.pass1Server, 0));
    assert.equal(sim.pass1_fresh_seeds.clientSeed, deriveSeedHex(sim.masterSeed, SEED_DOMAINS.pass1Client, 0));
  });

  it('ships the retained nulls at the pinned size, digest-matched to the artifact and the provenance', () => {
    const sim = JSON.parse(fs.readFileSync(simPath, 'utf8'));
    const prov = JSON.parse(fs.readFileSync(provPath, 'utf8'));
    const raw = fs.readFileSync(nullPath);
    assert.equal(raw.length, SIM_BOOTSTRAP_REPS * 8);
    const digest = createHash('sha256').update(raw).digest('hex');
    assert.equal(digest, sim.pass2_casino_seeds.nullSHA256);
    assert.equal(digest, prov.pass2_bootstrap.nullSHA256);
    assert.equal(prov.simulation.sha256, sha256File(simPath));
    assert.equal(prov.dataset.sha256, sha256File(path.join(ROOT, 'data', 'blackjack-6000hands.json')));
  });

  it('re-derives a sample of the retained replicates from the committed master seed', () => {
    const sim = JSON.parse(fs.readFileSync(simPath, 'utf8'));
    const nulls = decodeNulls(fs.readFileSync(nullPath));
    for (const r of [0, 1, 499, 1_000, SIM_BOOTSTRAP_REPS - 1]) {
      assert.equal(replayBootstrapNull(sim.masterSeed, r, PASS2_EARLY_NONCES), nulls[r],
        `retained replicate ${r} does not re-derive from the committed master seed`);
    }
  });

  it('recomputes every published earlyBootstrapP from the retained nulls', () => {
    const sim = JSON.parse(fs.readFileSync(simPath, 'utf8'));
    const sorted = sortedCopy(decodeNulls(fs.readFileSync(nullPath)));
    for (const row of sim.pass2_casino_seeds.results) {
      assert.equal(bootstrapP(sorted, row.earlyChi2), row.earlyBootstrapP, `epoch ${row.epoch}`);
    }
  });

  it('the provenance record names every derivation domain the run used', () => {
    const prov = JSON.parse(fs.readFileSync(provPath, 'utf8'));
    assert.equal(prov.pass0_reference.seedDomain, SEED_DOMAINS.pass0Shuffle);
    assert.equal(prov.pass1_real_shoe.serverSeedDomain, SEED_DOMAINS.pass1Server);
    assert.equal(prov.pass1_real_shoe.clientSeedDomain, SEED_DOMAINS.pass1Client);
    assert.equal(prov.pass2_bootstrap.serverDomain, SEED_DOMAINS.pass2BootstrapServer);
    assert.equal(prov.pass2_bootstrap.clientDomain, SEED_DOMAINS.pass2BootstrapClient);
    assert.equal(prov.codeVersion.seedDerivation, SEED_DERIVATION_VERSION);
  });
});

describe('blackjack: the superseded artifact, frozen', () => {
  const legacyPath = path.join(ROOT, 'tests', 'fixtures', 'legacy-simulation-results.json');

  it('is byte-identical to the artifact it was when it was superseded', () => {
    assert.equal(sha256File(legacyPath), LEGACY_SIMULATION_SHA256);
  });

  it('carries NONE of the replay fields this release adds — which is why the finding was raised', () => {
    const legacy = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
    assert.equal(legacy.masterSeed, undefined);
    assert.equal(legacy.seedDerivation, undefined);
    assert.equal(legacy.pass1_fresh_seeds.serverSeed, undefined);
    assert.equal(legacy.pass1_fresh_seeds.clientSeed, undefined);
    assert.equal(legacy.pass2_casino_seeds.nullSHA256, undefined);
    // Its statistics are still real numbers; what is missing is the means to re-create them.
    assert.equal(legacy.pass2_casino_seeds.results.length, 120);
  });

  it('is NOT the artifact of record — the committed simulation is a different file', () => {
    assert.notEqual(sha256File(path.join(OUTPUTS, 'simulation-results.json')), sha256File(legacyPath));
  });
});
