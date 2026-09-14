/**
 * LIQD Blackjack provably-fair RNG — canonical reference implementation.
 *
 * Node.js `crypto` only; no LIQD dependency. Reverse-engineered from the live
 * verify endpoint and validated against 6,000 captured hands (every card recomputed).
 *
 * Crypto core is identical to LIQD Mines (independently confirmed against the mines
 * verify endpoint): HMAC-SHA256, key = bytes(serverSeed hex), message
 * `${clientSeed}:${nonce}:${cursor}`, big-endian uint32 chunks with rejection sampling,
 * `chunk % range`.
 *
 * Game logic: BACKWARD in-place Fisher-Yates over an 8-deck (416-card) shoe.
 * Deal is PDPD: player = shoe[0], shoe[2]; dealer = shoe[1], shoe[3]; further cards
 * are dealt from shoe[4:] (all player draws, then all dealer draws).
 */

import { createHmac, createHash } from 'crypto';

export const salt = (clientSeed: string, nonce: number, cursor: number): string =>
  `${clientSeed}:${nonce}:${cursor}`;

/** Bias-free uniform integer in [0, range). Same primitive as Mines/Plinko. */
export function generateProvablyFairNumber(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  cursor: number,
  range: number,
): number {
  const key = Buffer.from(serverSeed, 'hex');
  const digest = createHmac('sha256', key).update(salt(clientSeed, nonce, cursor)).digest();
  const maxFair = Math.floor(0x1_0000_0000 / range) * range;
  for (let offset = 0; offset + 4 <= digest.length; offset += 4) {
    const chunk = digest.readUInt32BE(offset);
    if (chunk < maxFair) return chunk % range;
  }
  return generateProvablyFairNumber(serverSeed, clientSeed, nonce, cursor + 1_000_000, range);
}

/** Suits and rank range; card string form is "SUIT:rank" (rank 1=A..13=K). */
export const SUITS = ['CLUB', 'HEART', 'SPADE', 'DIAMOND'] as const;
export const DECKS = 8;
export const SHOE_SIZE = DECKS * 52; // 416

/** 52-card template repeated across 8 decks: suit-major [CLUB,HEART,SPADE,DIAMOND] × ranks 1..13. */
export function buildShoeTemplate(): string[] {
  const shoe: string[] = [];
  for (let d = 0; d < DECKS; d++) for (const s of SUITS) for (let r = 1; r <= 13; r++) shoe.push(`${s}:${r}`);
  return shoe;
}

/**
 * Backward in-place Fisher-Yates: for i = SHOE_SIZE-1 .. 1,
 *   j = generateProvablyFairNumber(cursor=i, range=i+1) ∈ [0, i]; swap(shoe[i], shoe[j]).
 * Returns the full 416-card shuffled shoe.
 */
export function blackjackShoe(serverSeed: string, clientSeed: string, nonce: number): string[] {
  const a = buildShoeTemplate();
  for (let i = a.length - 1; i >= 1; i--) {
    const j = generateProvablyFairNumber(serverSeed, clientSeed, nonce, i, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deal mapping (PDPD): player = shoe[0],shoe[2]; dealer = shoe[1],shoe[3]; rest from shoe[4:]. */
export function dealtHands(shoe: string[]): { player: string[]; dealer: string[]; rest: string[] } {
  return { player: [shoe[0], shoe[2]], dealer: [shoe[1], shoe[3]], rest: shoe.slice(4) };
}

/** Commitment (Stake convention): SHA-256(utf8(serverSeed hex string)). */
export function commitHash(serverSeedHexString: string): string {
  return createHash('sha256').update(serverSeedHexString, 'utf8').digest('hex');
}
