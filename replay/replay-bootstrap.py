#!/usr/bin/env python3
"""Independently replay the published LIQD Blackjack Pass-2 bootstrap.

    python3 replay/replay-bootstrap.py             -> outputs/run/bootstrap-replay-report.json
    python3 replay/replay-bootstrap.py --commit    -> outputs/bootstrap-replay-report.json

WHY THIS FILE EXISTS, AND WHY IT IS PYTHON.

Without the bootstrap random inputs behind `pass2_casino_seeds.results[].earlyBootstrapP`,
those p-values cannot be reproduced. The repository derives every bootstrap replicate from a recorded master seed and
retains the 2,000 statistics it produced (`outputs/bootstrap-nulls.float64le`). Re-deriving them
with the repository's own code would show only that the code is deterministic. This script
re-derives them with NOTHING from the repository: Python's standard library, the algorithm as the
report describes it, and the four committed files as read-only input.

WHAT IT RECONSTRUCTS, from the master seed and the captured dataset alone:
  * all 2,000 retained bootstrap statistics, compared BYTE FOR BYTE against the committed file;
  * all 120 early-window chi-squared statistics, from the dataset's own revealed server seeds;
  * all 120 late-window chi-squared statistics (1,194,000 further shoes over nonces 50..9,999;
    the scored verify run re-derives them from each row's rank counts, this re-deals the counts);
  * all 120 bootstrap p-values, from the retained nulls;
  * all 120 late p-values, by an independent closed form (df=12 chi-squared survival) rather than
    the repository's series implementation;
  * the cherry-pick flag on each seed, the flag count, and its exact binomial survival probability
    in rational arithmetic.

WHAT IT DOES NOT DO. It does not reconstruct the SUPERSEDED 2026-09-02 simulation: that run's
random inputs were never recorded and are gone. It is retained as a frozen fixture
(`tests/fixtures/legacy-simulation-results.json`) and is not claimed to be reproducible.

Read-only on the dataset, the simulation artifact, the provenance record and the retained nulls.
Only the report destination is written.
"""
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor
from fractions import Fraction
from bisect import bisect_left
import argparse
import hashlib
import hmac
import json
import math
import struct
import sys

SEED_DERIVATION = 'blackjack-seed-derivation-v1'
RANKS = 13
SHOE_SIZE = 416          # 8 decks x 52


def check(condition, message):
    if not condition:
        raise ValueError(message)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def derive(master, domain, index):
    """seed(domain, i) = first 16 bytes of HMAC-SHA256(master, "<version>:<domain>:<i>")."""
    message = '%s:%s:%d' % (SEED_DERIVATION, domain, index)
    return hmac.digest(bytes.fromhex(master), message.encode('utf-8'), 'sha256')[:16].hex()


def draw(key, client, nonce, cursor, rng_range):
    """Bias-free uniform integer in [0, rng_range): big-endian uint32 chunks, rejection sampling."""
    max_fair = (2**32 // rng_range) * rng_range
    while True:
        digest = hmac.digest(key, ('%s:%d:%d' % (client, nonce, cursor)).encode('utf-8'), 'sha256')
        for offset in range(0, 32, 4):
            chunk = int.from_bytes(digest[offset:offset + 4], 'big')
            if chunk < max_fair:
                return chunk % rng_range
        cursor += 1000000


def first_card_rank(key, client, nonce):
    """Rank of shoe[0] after the backward in-place Fisher-Yates over the 416-card shoe.

    The shoe template is suit-major within each deck, so position p holds rank (p % 13) + 1; only
    ranks matter for this statistic, so the template is built as ranks.
    """
    a = [(p % RANKS) + 1 for p in range(SHOE_SIZE)]
    for i in range(SHOE_SIZE - 1, 0, -1):
        j = draw(key, client, nonce, i, i + 1)
        a[i], a[j] = a[j], a[i]
    return a[0]


def chi_square(freq, n):
    """The audit's chi-squared statistic, including its end-bin pooling rule.

    Bins are pooled from each end while the expected count is below 5, which at n=50 leaves 11
    bins (df 10) and at n=9,950 leaves all 13 (df 12). Summation is strictly left to right so the
    IEEE-754 result is bit-identical to the producer's, which matters because the bootstrap
    p-value is decided by a `>=` comparison between two such sums.
    """
    observed, expected = list(freq), [n / RANKS] * RANKS
    while len(observed) > 2 and expected[0] < 5:
        observed[1] += observed[0]
        expected[1] += expected[0]
        del observed[0], expected[0]
    while len(observed) > 2 and expected[-1] < 5:
        observed[-2] += observed[-1]
        expected[-2] += expected[-1]
        observed.pop()
        expected.pop()
    total = 0.0
    for o, e in zip(observed, expected):
        total += (o - e) ** 2 / e
    return total, len(observed) - 1


def chi2_survival_even_df(chi2, df):
    """P(X > chi2) for an even number of degrees of freedom: exp(-x) * sum_{j<df/2} x^j / j!.

    Closed form, independent of the repository's regularized-incomplete-gamma series.
    """
    check(df % 2 == 0, 'this closed form requires an even number of degrees of freedom')
    x = chi2 / 2
    return math.exp(-x) * math.fsum(x ** j / math.factorial(j) for j in range(df // 2))


def null_worker(args):
    """Bootstrap replicates [lo, hi) as packed little-endian float64, in GENERATION order."""
    master, lo, hi, early_n = args
    stats = []
    for rep in range(lo, hi):
        key = bytes.fromhex(derive(master, 'pass2-bootstrap-server', rep))
        client = derive(master, 'pass2-bootstrap-client', rep)
        freq = [0] * RANKS
        for nonce in range(early_n):
            freq[first_card_rank(key, client, nonce) - 1] += 1
        stats.append(chi_square(freq, early_n)[0])
    return lo, struct.pack('<' + 'd' * len(stats), *stats)


def seed_worker(args):
    """One captured epoch: both window statistics, recomputed from its revealed server seed."""
    seed, early_n, nonces = args
    key = bytes.fromhex(seed['serverSeed'])
    client = seed['clientSeed']
    early, late = [0] * RANKS, [0] * RANKS
    for nonce in range(nonces):
        rank = first_card_rank(key, client, nonce)
        (early if nonce < early_n else late)[rank - 1] += 1
    early_chi, early_df = chi_square(early, early_n)
    late_chi, late_df = chi_square(late, nonces - early_n)
    return {
        'epoch': seed['epoch'], 'hashedServerSeed': seed['hashedServerSeed'],
        'earlyChi2': early_chi, 'earlyDf': early_df,
        'lateChi2': late_chi, 'lateDf': late_df,
        'latePValue': chi2_survival_even_df(late_chi, late_df),
    }


def main():
    root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--commit', action='store_true',
                        help='write outputs/bootstrap-replay-report.json (the artifact of record)')
    parser.add_argument('--out', type=Path, default=None)
    parser.add_argument('--workers', type=int, default=6)
    args = parser.parse_args()
    check(1 <= args.workers <= 16, '--workers must be between 1 and 16')
    destination = (args.out or (root / 'outputs/bootstrap-replay-report.json' if args.commit
                                else root / 'outputs/run/bootstrap-replay-report.json')).resolve()
    run_dir = (root / 'outputs/run').resolve()
    inside_repo = root == destination or root in destination.parents
    allowed = run_dir in destination.parents or destination.name == 'bootstrap-replay-report.json'
    check(not (inside_repo and destination.exists() and not allowed),
          '--out cannot overwrite an unrelated repository file')

    dataset_path = root / 'data/blackjack-6000hands.json'
    simulation_path = root / 'outputs/simulation-results.json'
    provenance_path = root / 'outputs/simulation-provenance.json'
    null_path = root / 'outputs/bootstrap-nulls.float64le'
    raw = dataset_path.read_bytes()
    sim_raw = simulation_path.read_bytes()
    prov_raw = provenance_path.read_bytes()
    reference_null = null_path.read_bytes()

    prov = json.loads(prov_raw)
    sim = json.loads(sim_raw)

    # ---- the provenance record must describe the files actually on disk ----
    check(prov['format'] == 'liqd-blackjack-simulation-provenance-v1', 'unsupported provenance format')
    check(sha(raw) == prov['dataset']['sha256'], 'dataset hash disagrees with provenance')
    check(sha(sim_raw) == prov['simulation']['sha256'], 'simulation hash disagrees with provenance')
    check(sha(reference_null) == prov['pass2_bootstrap']['nullSHA256'], 'retained null hash disagrees with provenance')

    master = sim['masterSeed']
    check(isinstance(master, str) and 32 <= len(master) <= 128 and len(master) % 2 == 0
          and all(c in '0123456789abcdef' for c in master), 'invalid master seed')
    check(master == prov['masterSeed'], 'master seed disagrees with provenance')
    p2, inputs = sim['pass2_casino_seeds'], prov['pass2_bootstrap']
    check(sim['seedDerivation'] == p2['bootstrapSeedDerivation']
          == prov['codeVersion']['seedDerivation'] == SEED_DERIVATION,
          'unsupported seed-derivation version')
    check(inputs['serverDomain'] == 'pass2-bootstrap-server'
          and inputs['clientDomain'] == 'pass2-bootstrap-client'
          and inputs['derivedSeedBytes'] == 16, 'seed-derivation parameters disagree with this implementation')
    for field in ['noncesPerSeed', 'earlyWindow', 'lateWindow']:
        check(p2[field] == inputs[field], '%s disagrees with provenance' % field)

    reps, nonces = p2['bootstrapReps'], p2['noncesPerSeed']
    check(isinstance(reps, int) and reps >= 1000 and reps == inputs['bootstrapReps'],
          'invalid bootstrap replicate count')
    check(inputs['replicateIndex'] == [0, reps - 1], 'replicate indices disagree with the replicate count')
    check(p2['bootstrapReplicateIndex'] == [0, reps - 1], 'artifact replicate indices disagree')
    check(p2['earlyWindow'][0] == 0, 'the early window must start at nonce 0')
    early_n = p2['earlyWindow'][1] + 1
    check(p2['lateWindow'] == [early_n, nonces - 1] and nonces - early_n >= 125, 'invalid nonce windows')
    check(len(reference_null) == reps * 8, 'retained null file is the wrong size')
    check(inputs['nullStatistics'] == reps, 'null-statistic count disagrees with the replicate count')

    ds = json.loads(raw)
    seeds = [s for s in ds['seeds'] if s.get('serverSeed')]
    rows = {r['hashedServerSeed']: r for r in p2['results']}
    check(len(rows) == len(p2['results']) == len(seeds) == p2['seeds_tested'], 'seed population mismatch')
    check(set(rows) == {s['hashedServerSeed'] for s in seeds}, 'seed identities mismatch')
    # The commitment binds each revealed seed to the epoch it was served in.
    for s in seeds:
        check(hashlib.sha256(s['serverSeed'].encode('utf-8')).hexdigest() == s['hashedServerSeed'],
              'revealed server seed does not match its commitment at epoch %d' % s['epoch'])

    # ---- 1. the retained nulls, re-derived from the master seed ----
    chunk = max(1, math.ceil(reps / args.workers))
    ranges = [(master, lo, min(lo + chunk, reps), early_n) for lo in range(0, reps, chunk)]
    rebuilt = bytearray(len(reference_null))
    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        for lo, binary in pool.map(null_worker, ranges):
            rebuilt[lo * 8:lo * 8 + len(binary)] = binary
            print('  replicates %d-%d reproduced' % (lo, lo + len(binary) // 8 - 1), flush=True)
        check(bytes(rebuilt) == reference_null,
              'the re-derived bootstrap statistics do not match outputs/bootstrap-nulls.float64le')
        print('  all %d bootstrap statistics matched byte for byte' % reps, flush=True)

        # ---- 2. every captured epoch, both windows ----
        actual_rows = list(pool.map(seed_worker, [(s, early_n, nonces) for s in seeds]))

    nulls = sorted(struct.unpack('<' + 'd' * reps, reference_null))

    alpha = 0.05
    p0 = Fraction(19, 400)                     # alpha * (1 - alpha)
    max_late_error = 0.0
    flags, comparisons = [], []
    for actual in actual_rows:
        ref = rows[actual['hashedServerSeed']]
        check(actual['epoch'] == ref['epoch'], 'row identity mismatch')
        check(actual['earlyDf'] == 10 and actual['lateDf'] == RANKS - 1,
              'unexpected degrees of freedom at epoch %d' % actual['epoch'])
        check(actual['earlyChi2'] == ref['earlyChi2'],
              'early chi-squared mismatch at epoch %d: %r vs %r' % (actual['epoch'], actual['earlyChi2'], ref['earlyChi2']))
        check(actual['lateChi2'] == ref['lateChi2'],
              'late chi-squared mismatch at epoch %d: %r vs %r' % (actual['epoch'], actual['lateChi2'], ref['lateChi2']))
        p = (reps - bisect_left(nulls, actual['earlyChi2']) + 1) / (reps + 1)
        check(p == ref['earlyBootstrapP'],
              'bootstrap p-value mismatch at epoch %d: %r vs %r' % (actual['epoch'], p, ref['earlyBootstrapP']))
        error = abs(actual['latePValue'] - ref['latePValue'])
        max_late_error = max(max_late_error, error)
        check(error < 1e-10, 'late p-value mismatch at epoch %d' % actual['epoch'])
        flag = p < alpha and actual['latePValue'] >= alpha
        check(flag == ref['cherryPickFlag'], 'flag mismatch at epoch %d' % actual['epoch'])
        if flag:
            flags.append(actual['epoch'])
        comparisons.append({'epoch': actual['epoch'], 'earlyChi2': actual['earlyChi2'],
                            'earlyBootstrapP': p, 'lateChi2': actual['lateChi2'],
                            'latePValue': actual['latePValue'], 'flag': flag})

    n, k = len(seeds), len(flags)
    survival = float(sum((Fraction(math.comb(n, i)) * p0 ** i * (1 - p0) ** (n - i)
                          for i in range(k, n + 1)), Fraction(0)))
    check(k == p2['cherryPickFlags'], 'flag-count mismatch')
    check(abs(n * float(p0) - p2['expectedFlagsByChance']) < 1e-12, 'expected-flags mismatch')
    check(abs(survival - p2['cherryPickSurvivalP']) < 1e-12, 'binomial-survival mismatch')

    report = {
        'method': 'EXECUTED: independent Python standard-library implementation; no repository-code imports',
        'datasetSha256': sha(raw),
        'simulationSha256': sha(sim_raw),
        'provenanceSha256': sha(prov_raw),
        'nullSha256': sha(reference_null),
        'masterSeed': master,
        'seedDerivation': SEED_DERIVATION,
        'bootstrapStatisticsChecked': reps,
        'bootstrapStatisticMismatches': 0,
        'earlyChiSquareRowsChecked': n,
        'earlyChiSquareMismatches': 0,
        'lateChiSquareRowsChecked': n,
        'lateChiSquareMismatches': 0,
        'bootstrapPValuesChecked': n,
        'bootstrapPValueMismatches': 0,
        'latePMethod': 'df=12 survival: exp(-chi2/2) * sum((chi2/2)^j/j!, j=0..5)',
        'latePMaxAbsoluteDifference': max_late_error,
        'shoesDerived': reps * early_n + n * nonces,
        'flagEpochs': flags,
        'cherryPickFlags': k,
        'expectedFlagsByChance': n * float(p0),
        'binomialSurvival': survival,
        'results': comparisons,
        'verdict': 'PASS',
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, indent=2) + '\n')
    print('PASS: %d bootstrap statistics reproduced byte for byte; %d/%d epochs reproduced both window '
          'statistics and their p-values; %d flagged seed(s).' % (reps, n, n, k))
    print('Report: %s' % destination)


if __name__ == '__main__':
    try:
        main()
    except ValueError as exc:
        print('FAIL: %s' % exc, file=sys.stderr)
        raise SystemExit(1)
