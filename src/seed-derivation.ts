/**
 * The simulation's versioned, domain-separated seed derivation.
 *
 * OUR audit tooling, not part of the RNG: moved here unchanged from src/rng.ts on 20 Oct 2026, when
 * src/rng.ts was replaced by the module rebuilt from docs/ALGORITHM.md. The code below is the earlier
 * file's lines 147–209 byte for byte (only the import line above them is new), so every derived seed,
 * and with it the pinned simulation artifacts, is unchanged. It derives the simulation's own inputs
 * from the recorded master seed; it does not touch any casino round.
 */

import { createHmac } from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
//  VERSIONED, DOMAIN-SEPARATED SEED DERIVATION — the simulation's retained inputs
//
//  WHY. Until this release every random input the simulation consumed was drawn fresh and
//  thrown away: the Pass-1 server/client seed pair came from `crypto.randomBytes` and was
//  never written down, the 2,000 Pass-2 bootstrap replicates likewise, and the Pass-0
//  reference shuffle read `Math.random()`. The published statistics could be read but not
//  re-derived, and `tests/steps/simulation.ts` said so in as many words — "the bootstrap null
//  is drawn from fresh crypto.randomBytes entropy on each npm run simulate, so it is not
//  reproducible by construction". That is a material evidence gap: the outcomes were not
//  contradicted, but the experiments behind them could not be replayed.
//
//  WHAT REPLACES IT. One master seed per run (32 random bytes, recorded in the artifact), and
//  every sub-experiment's stream addressed by a DOMAIN and an INDEX beneath it:
//
//      seed(domain, i) = first 16 bytes of HMAC-SHA256( master , "<version>:<domain>:<i>" )
//
//  The master seed is decoded from hex and used as the HMAC key; the message is UTF-8. Distinct
//  domains keep the Pass-0 shuffle stream, the Pass-1 seed pair and each Pass-2 bootstrap
//  replicate independent while all of them remain reachable from the one recorded value. Every
//  domain in use is listed in `outputs/simulation-provenance.json`, so a reader does not have to
//  read this file to know which streams exist.
//
//  SCOPE, STATED PLAINLY. This makes FUTURE runs replayable. It does not recover the discarded
//  inputs of the superseded run — those are gone, and the superseded artifact is retained as a
//  frozen test fixture (`tests/fixtures/legacy-simulation-results.json`) rather than described as
//  reproducible.
// ─────────────────────────────────────────────────────────────────────────────

/** Bump this if the derivation formula ever changes; it is part of the HMAC message. */
export const SEED_DERIVATION_VERSION = 'blackjack-seed-derivation-v1';

/** True iff `s` is a syntactically usable master seed (>= 16 bytes of lowercase hex). */
export function isMasterSeed(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{32,128}$/.test(s) && s.length % 2 === 0;
}

/** `seed(domain, index)` — see the block above. Returns `bytes` bytes as lowercase hex. */
export function deriveSeedHex(masterSeedHex: string, domain: string, index: number, bytes = 16): string {
  if (!isMasterSeed(masterSeedHex)) {
    throw new Error(`deriveSeedHex: invalid master seed ${JSON.stringify(masterSeedHex)}`);
  }
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`deriveSeedHex: index must be a non-negative integer, got ${String(index)}`);
  }
  const key = Buffer.from(masterSeedHex, 'hex');
  const msg = `${SEED_DERIVATION_VERSION}:${domain}:${index}`;
  return createHmac('sha256', key).update(msg, 'utf8').digest().subarray(0, bytes).toString('hex');
}

/** The four derivation domains this audit uses. Mirrored in outputs/simulation-provenance.json. */
export const SEED_DOMAINS = {
  /** Pass 0 — the 30M-round fair-shuffle reference stream (one 16-byte xoshiro128** seed). */
  pass0Shuffle: 'pass0-reference-shuffle',
  /** Pass 1 — the single real-shoe server seed. */
  pass1Server: 'pass1-shoe-server',
  /** Pass 1 — the single real-shoe client seed. */
  pass1Client: 'pass1-shoe-client',
  /** Pass 2 — bootstrap replicate r's server seed. */
  pass2BootstrapServer: 'pass2-bootstrap-server',
  /** Pass 2 — bootstrap replicate r's client seed. */
  pass2BootstrapClient: 'pass2-bootstrap-client',
} as const;
