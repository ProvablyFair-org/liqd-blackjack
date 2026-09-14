/**
 * Hand-shape helpers shared by the scored steps.
 *
 * `initialTwo` lived only in `tests/steps/standardization.ts`, so Steps 15 and 16 carried
 * their own fallback — `sb.playerHand || b.playerHands[0]?.cards` — for a side-bet record
 * with no card snapshot. On a SPLIT round that fallback is wrong: `playerHands[0].cards`
 * is the MAIN hand after the split and its second card is a post-split draw, not the card
 * the side bet was settled on. It differs from the true initial two on 392 of the 401 split
 * rounds. The fallback is inert on the committed capture (all 5,800 Perfect Pairs and all
 * 5,800 21+3 records carry `playerHand`, and Step 29 binds every one of the 11,600 snapshots
 * to the initial two cards), but "inert because another step happens to cover it" is not a
 * property a reader can see, and a re-capture that dropped the snapshot would silently score
 * the wrong cards. One split-aware definition, used everywhere.
 */

import type { Bet } from '../../src/types';

/** The two cards the player was originally dealt, split-aware. */
export function initialTwo(b: Bet): string[] {
  return b.split
    ? [b.playerHands[0]?.cards[0], b.playerHands[1]?.cards[0]]
    : (b.playerHands[0]?.cards || []).slice(0, 2);
}
