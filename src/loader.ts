/**
 * Dataset loader with a mandatory SHA-256 hash guard.
 *
 * The guard runs BEFORE any verification so the suite can never validate the wrong
 * file. Prints expected + actual and exits non-zero on mismatch.
 */

import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';
import { DATASET_SHA256 } from './config';
import type { Dataset } from './types';

export const DATA_PATH = join(__dirname, '..', 'data', 'blackjack-6000hands.json');

export function datasetHash(path: string = DATA_PATH): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/**
 * Fields the capture rig wrote from its OWN recomputation of the game, not from anything
 * LIQD returned: the rig's reconstructed shoe prefix and its own pass/fail verdicts.
 *
 * They are DELETED here, at the single entry point every scored step loads through, so the
 * verification path cannot read them by any access pattern — dotted, bracketed, destructured
 * or computed. `tests/blackjack/antiCircularityTests.ts` is a lint-style regex over source
 * text and cannot see a computed key (`const K = 'veri' + 'fied'; b[K]`); this makes the
 * independence guarantee structural instead of stylistic (round-2 QA item 22).
 *
 * The stripping happens AFTER the hash guard and only in memory. `datasetHash()` reads the
 * file from disk, so the committed dataset — fields and all — is unchanged and still hashes
 * to DATASET_SHA256; the fields remain in the shipped artifact for a third party to inspect.
 */
export const CAPTURE_SIDE_FIELDS = ['localSequence', 'commitVerified', 'chainLinkOk', 'verified'] as const;

/** Delete every capture-side field from every bet and seed. Computed keys — no literal access. */
export function stripCaptureSideFields(ds: Dataset): Dataset {
  const strip = (o: Record<string, unknown>): void => {
    for (const f of CAPTURE_SIDE_FIELDS) delete o[f];
  };
  for (const b of ds.bets as unknown as Record<string, unknown>[]) strip(b);
  for (const s of ds.seeds as unknown as Record<string, unknown>[]) strip(s);
  return ds;
}

/**
 * Hash-guard first, then parse, then strip the capture-side fields.
 * On hash mismatch: print both hashes and process.exit(1).
 */
export function loadDataset(path: string = DATA_PATH): Dataset {
  const actual = datasetHash(path);
  if (actual !== DATASET_SHA256) {
    console.error('\n❌ Dataset hash mismatch — refusing to run.');
    console.error(`   expected: ${DATASET_SHA256}`);
    console.error(`   actual:   ${actual}`);
    process.exit(1);
  }
  return stripCaptureSideFields(JSON.parse(readFileSync(path, 'utf8')) as Dataset);
}

/** O(1) revealed-seed lookup: Map<hashedServerSeed, Seed>. */
export function revealedSeedMap(ds: Dataset): Map<string, Dataset['seeds'][number]> {
  const m = new Map<string, Dataset['seeds'][number]>();
  for (const s of ds.seeds) m.set(s.hashedServerSeed, s);
  return m;
}
