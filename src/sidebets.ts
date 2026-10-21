/**
 * Independent evaluators for the two blackjack side bets, using LIQD's confirmed
 * paytables (src/config.ts). Used by verify.ts to re-derive every recorded side-bet
 * outcome from the cards alone, and by simulate.ts for side-bet RTP.
 *
 * Perfect Pairs — the player's first two cards.
 * 21+3 — the player's first two cards + the dealer upcard.
 */

import { rankOf, suitOf, PERFECT_PAIRS, TWENTY_ONE_PLUS_THREE } from './config';

const isRed = (card: string): boolean => suitOf(card) === 'HEART' || suitOf(card) === 'DIAMOND';

export interface SideResult { category: string; payout: number; } // payout-to-1 (0 = lose)

/** Perfect Pairs on two cards. */
export function evaluatePerfectPairs(c1: string, c2: string): SideResult {
  // LIQD labels a losing Perfect Pairs bet `NO_PAIR`, but a losing 21+3 bet `NO_MATCH`.
  // The two side bets genuinely use different vocabulary; the category comparison in
  // Step 15 is against LIQD's own `gameResult`, so this string must match exactly.
  if (rankOf(c1) !== rankOf(c2)) return { category: 'NO_PAIR', payout: 0 };
  if (suitOf(c1) === suitOf(c2)) return { category: 'PERFECT_PAIR', payout: PERFECT_PAIRS.PERFECT_PAIR };
  if (isRed(c1) === isRed(c2)) return { category: 'COLORED_PAIR', payout: PERFECT_PAIRS.COLORED_PAIR };
  return { category: 'MIXED_PAIR', payout: PERFECT_PAIRS.MIXED_PAIR };
}

function isThreeStraight(a: number, b: number, c: number): boolean {
  const consec = (rs: number[]): boolean => {
    const s = [...rs].sort((x, y) => x - y);
    return s[0] + 1 === s[1] && s[1] + 1 === s[2];
  };
  if (consec([a, b, c])) return true;
  // Ace-high: A(1) counts as 14 for Q-K-A
  return consec([a, b, c].map((r) => (r === 1 ? 14 : r)));
}

/** 21+3 on the player's two cards + the dealer upcard. */
export function evaluate21Plus3(c1: string, c2: string, dealerUp: string): SideResult {
  const cards = [c1, c2, dealerUp];
  const ranks = cards.map(rankOf);
  const suits = cards.map(suitOf);
  const flush = suits[0] === suits[1] && suits[1] === suits[2];
  const trips = ranks[0] === ranks[1] && ranks[1] === ranks[2];
  const straight = isThreeStraight(ranks[0], ranks[1], ranks[2]);
  if (trips && flush) return { category: 'SUITED_THREE_OF_A_KIND', payout: TWENTY_ONE_PLUS_THREE.SUITED_THREE_OF_A_KIND };
  if (straight && flush) return { category: 'STRAIGHT_FLUSH', payout: TWENTY_ONE_PLUS_THREE.STRAIGHT_FLUSH };
  if (trips) return { category: 'THREE_OF_A_KIND', payout: TWENTY_ONE_PLUS_THREE.THREE_OF_A_KIND };
  if (straight) return { category: 'STRAIGHT', payout: TWENTY_ONE_PLUS_THREE.STRAIGHT };
  if (flush) return { category: 'FLUSH', payout: TWENTY_ONE_PLUS_THREE.FLUSH };
  return { category: 'NO_MATCH', payout: 0 };
}
