# Module interface the audit package expects (written by the auditor, not from the casino)

Write `rng.ts` (TypeScript, strict, Node `crypto` only, no dependencies) exporting exactly these names.
Semantics come from ALGORITHM.md; this file only fixes names, types and the package's own conventions.
Card strings are `${SUIT}:${rank}` with SUIT in CLUB, HEART, SPADE, DIAMOND and rank 1..13 (1 = ace, 11 = J, 12 = Q, 13 = K), e.g. "SPADE:1".

```ts
// The HMAC message for (clientSeed, nonce, cursor), exactly as the spec builds it.
export const salt: (clientSeed: string, nonce: number, cursor: number) => string;
// Exclusive upper end of the accepted 32-bit window for a draw over `range` outcomes.
export function maxFairFor(range: number): number;
// Optional counter; passing one changes nothing computed.
export interface DrawCensus {
  draws: number;              // draws made (one per shuffle swap)
  firstChunkRejected: number; // draws whose first 4-byte chunk was rejected
  cursorAdvanced: number;     // draws where every chunk was rejected and the spec moved on (0 if the spec defines no such path)
}
// One accepted draw in [0, range) for (seeds, nonce, cursor) per the spec. Throw if none accepted.
export function generateProvablyFairNumber(serverSeed: string, clientSeed: string, nonce: number, cursor: number, range: number): number;
// Expected number of first-chunk rejections over `shoes` full shuffles under the spec's rule (exact arithmetic).
export function expectedFirstChunkRejections(shoes: number): number;
export const SUITS: readonly ['CLUB', 'HEART', 'SPADE', 'DIAMOND'];
export const DECKS: number;        // 8
export const SHOE_SIZE: number;    // 416
// The unshuffled shoe in the spec's layout order (card strings as above).
export function buildShoeTemplate(): string[];
// The full shuffled shoe (416 cards) for a round, per the spec's shuffle.
export function blackjackShoe(serverSeed: string, clientSeed: string, nonce: number, census?: DrawCensus): string[];
// The initial deal from a shuffled shoe, per the spec's deal order: player 2 cards, dealer 2 cards (up card first), rest = remaining shoe from the next card on.
export function dealtHands(shoe: string[]): { player: string[]; dealer: string[]; rest: string[] };
// The commitment the casino publishes for a server seed, lowercase hex (per the spec).
export function commitHash(serverSeedHexString: string): string;
```
Round play, side bets and payouts are NOT part of this module; implement only the above.
