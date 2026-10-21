/**
 * PROVENANCE (header added on integration, 20 Oct 2026; everything below this comment is the
 * clean-room module byte for byte).
 *
 * This module was REBUILT FROM A WRITTEN SPECIFICATION, not ported from LIQD's code:
 *   spec      docs/ALGORITHM.md, a copy of games/liqd-blackjack/ALGORITHM.md in the ProvablyFair.org
 *             audit framework (SHA-256 90e6dbc1…0ffad6). Written from LIQD's public pages and screens,
 *             the standard provably-fair construction and the 6,000 live rounds (plus the 10 rounds of
 *             E18), without opening LIQD's code, its client bundle or any port of it (its §8 lists every
 *             file read).
 *   rebuild   written by an implementer who read ONLY that spec and a module-interface file, and
 *             never opened LIQD's code, its client bundle, or this package's earlier src/rng.ts.
 *   self-test tests/blackjack/rngSpecTests.ts (the spec's five worked rounds and properties).
 *
 * LIQD's own code is NOT the source of this module. It is run as a SECOND CHECK: the validation
 * vectors from the RNG specification LIQD supplied to the auditor (tests/blackjack/rngTests.ts).
 * The audit's draw-bias bound is src/bias.ts and the simulation's seed derivation is
 * src/seed-derivation.ts; both are this audit's own tooling and sit outside the RNG module.
 *
 * Three-way agreement measured on integration (20 Oct 2026): this module vs the live rounds, every
 * card of every hand and of the dealer on 6,000/6,000 rounds (34,734/34,734 cards; rounds paired to
 * revealed seeds by hashing, recorded actions replayed, split rounds included) and on the 10/10 E18
 * rounds;
 * vs LIQD's backend code as given in its private specification, the 34-card deck it returns on
 * 6,000/6,000 rounds, its 3/3 validation vectors and one verify-endpoint reply (29 June 2026, 34/34
 * cards; an auditor workspace record, not shipped in this package); vs the ProvablyFair.org site verifier vendored in verifier-parity/, the full 416-card shoe
 * and the replayed round on 6,000/6,000. Step 6 of `npm run verify` re-measures the first on every run.
 *
 * Where this module and LIQD's code differ on inputs no captured round reaches: when all eight
 * chunks of a digest are rejected (spec O1, continuation unspecified) this module throws, while
 * LIQD's code, the earlier ported module and the site verifier move to cursor + 1,000,000. This
 * module also throws on a malformed server seed, a negative or fractional nonce and an invalid
 * range, where LIQD's code computes a value. 0 of the 2,490,000 captured draws had even their first
 * chunk rejected (DL-2).
 */
// LIQD Blackjack shoe derivation, written from ALGORITHM.md alone (clean room).
// Scope per INTERFACE.md: commitment, the per-step draw, the 416-card shuffle and
// the initial deal. Round play, side bets and payouts are deliberately absent.

import { createHash, createHmac } from 'crypto';

const TWO_POW_32 = 4294967296; // 2^32, the size of the unsigned 32-bit space read per chunk (§2 Step 2)
const CHUNKS_PER_DIGEST = 8;   // a SHA-256 digest is 32 bytes = 8 four-byte chunks (§2 Step 2, offsets 0..28)

export const SUITS = ['CLUB', 'HEART', 'SPADE', 'DIAMOND'] as const; // §2 Step 3, suit order inside a deck
export const DECKS: number = 8;                                       // §2 Step 3, "eight-deck shoe"
export const SHOE_SIZE: number = DECKS * 52;                          // 416 cards, §2 Step 3

// Counter for the shuffle's draws. Supplying one only records; it never alters a result.
export interface DrawCensus {
  draws: number;              // one per shuffle swap
  firstChunkRejected: number; // draws whose first 4-byte chunk was at or above the fair limit
  cursorAdvanced: number;     // always 0: the spec defines no "all chunks rejected, move on" path (§6 O1)
}

// §2 Step 1: the HMAC message is clientSeed, nonce and cursor joined by ':' with the
// numbers in plain base 10 (no padding, no sign).
export const salt = (clientSeed: string, nonce: number, cursor: number): string => {
  assertNonNegativeInteger(nonce, 'nonce');
  assertNonNegativeInteger(cursor, 'cursor');
  return `${clientSeed}:${nonce.toString(10)}:${cursor.toString(10)}`;
};

// §2 Step 2: LIMIT = floor(2^32 / r) * r. Chunk values below it are accepted; it is the
// largest multiple of r that fits in 32 bits, so the accepted window maps evenly onto [0, r).
export function maxFairFor(range: number): number {
  assertRange(range);
  return Math.floor(TWO_POW_32 / range) * range;
}

// §1.2 / §2 Step 1: the HMAC key is the server seed's hex string decoded to raw bytes
// (16 bytes for the 32-character seeds the spec describes). Node's hex decoder silently
// stops at the first bad character, so the string is validated first.
function hmacKey(serverSeed: string): Buffer {
  if (serverSeed.length === 0 || serverSeed.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(serverSeed)) {
    throw new Error('serverSeed must be a non-empty, even-length hex string');
  }
  return Buffer.from(serverSeed, 'hex');
}

// §2 Step 1: digest(i) = HMAC-SHA256(decoded seed, UTF-8(salt)). UTF-8 for the client
// seed is the spec's assumption (§6 O6).
function digestFor(key: Buffer, clientSeed: string, nonce: number, cursor: number): Buffer {
  return createHmac('sha256', key).update(Buffer.from(salt(clientSeed, nonce, cursor), 'utf8')).digest();
}

// §2 Step 2: walk the 8 big-endian u32 chunks of one digest, return the first accepted
// one reduced mod range. If every chunk is rejected the spec gives no rule (§6 O1), so
// this throws rather than invent one.
function drawFromDigest(digest: Buffer, range: number, census?: DrawCensus): number {
  const limit = maxFairFor(range);
  if (census) census.draws += 1;
  for (let c = 0; c < CHUNKS_PER_DIGEST; c++) {
    const v = digest.readUInt32BE(c * 4);
    if (v < limit) return v % range;
    if (c === 0 && census) census.firstChunkRejected += 1;
  }
  throw new Error(`all ${CHUNKS_PER_DIGEST} chunks rejected for range ${range}; the spec defines no fallback (O1)`);
}

// One accepted draw in [0, range) for (serverSeed, clientSeed, nonce, cursor): §2 Steps 1-2.
export function generateProvablyFairNumber(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  cursor: number,
  range: number,
): number {
  assertRange(range);
  return drawFromDigest(digestFor(hmacKey(serverSeed), clientSeed, nonce, cursor), range);
}

// Expected first-chunk rejections over `shoes` shuffles (§6 O1 quotes 0.0569 for 6,000).
// A shuffle draws once for each r = i + 1 with i = 415..1 (§2 Step 3), i.e. r = 2..416.
// For one draw, P(first chunk >= LIMIT) = (2^32 - LIMIT) / 2^32 = (2^32 mod r) / 2^32.
// The numerators are summed exactly as integers; the single division by a power of two
// is exact in binary floating point while the numerator stays below 2^53.
export function expectedFirstChunkRejections(shoes: number): number {
  assertNonNegativeInteger(shoes, 'shoes');
  const big32 = BigInt(TWO_POW_32);
  let perShoe = 0n;
  for (let r = 2; r <= SHOE_SIZE; r++) perShoe += big32 % BigInt(r);
  return Number(perShoe * BigInt(shoes)) / TWO_POW_32;
}

// §2 Step 3: BASE[x] for x = 0..415 is deck-major; inside a deck the suit is
// SUITS[(x mod 52) div 13] and the rank is (x mod 13) + 1 (1 = Ace ... 13 = King).
export function buildShoeTemplate(): string[] {
  const shoe: string[] = [];
  for (let x = 0; x < SHOE_SIZE; x++) {
    const suit = SUITS[Math.floor((x % 52) / 13)];
    const rank = (x % 13) + 1;
    shoe.push(`${suit}:${rank}`);
  }
  return shoe;
}

// §2 Step 3: backward Fisher-Yates over positions a = [0..415]. For i = 415 down to 1 the
// cursor is i itself (§2 Step 1) and j = draw over i + 1 outcomes; swap a[i], a[j].
// Card k of the round is BASE[a[k]], dealt from the front of the array.
export function blackjackShoe(serverSeed: string, clientSeed: string, nonce: number, census?: DrawCensus): string[] {
  const key = hmacKey(serverSeed);
  const base = buildShoeTemplate();
  const a: number[] = Array.from({ length: SHOE_SIZE }, (_, x) => x);
  for (let i = SHOE_SIZE - 1; i >= 1; i--) {
    const j = drawFromDigest(digestFor(key, clientSeed, nonce, i), i + 1, census);
    const t = a[i] as number;
    a[i] = a[j] as number;
    a[j] = t;
  }
  return a.map((x) => base[x] as string);
}

// §2 Step 4: k = 0 player card 1, k = 1 dealer up card, k = 2 player card 2,
// k = 3 dealer hole card; everything from k = 4 on is what later play draws from.
export function dealtHands(shoe: string[]): { player: string[]; dealer: string[]; rest: string[] } {
  if (shoe.length < 4) throw new Error('a deal needs at least 4 cards');
  return {
    player: [shoe[0] as string, shoe[2] as string],
    dealer: [shoe[1] as string, shoe[3] as string],
    rest: shoe.slice(4),
  };
}

// §1.2: commitment = lowercase hex SHA-256 of the seed's characters as UTF-8 text
// (the 32 ASCII characters, NOT the 16 bytes they encode; the key form differs on purpose).
export function commitHash(serverSeedHexString: string): string {
  return createHash('sha256').update(Buffer.from(serverSeedHexString, 'utf8')).digest('hex');
}

function assertNonNegativeInteger(x: number, name: string): void {
  if (!Number.isSafeInteger(x) || x < 0) throw new Error(`${name} must be a non-negative safe integer`);
}

function assertRange(range: number): void {
  if (!Number.isInteger(range) || range < 1 || range > TWO_POW_32) {
    throw new Error('range must be an integer in [1, 2^32]');
  }
}
