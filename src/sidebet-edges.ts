/**
 * Exact side-bet house edges, in integer arithmetic, from the SAME evaluator the verifier
 * scores live bets with (`src/sidebets.ts`, paytables from `src/config.ts`).
 *
 * WHY THIS FILE EXISTS. The enumeration lived only inside `tests/blackjack/sideBetEdgeTests.ts`,
 * so the published figures (Perfect Pairs 2.169%, 21+3 3.704%, and the 12:1 counterfactual
 * 4.096%) had a producer that no artifact could quote — the framework's prose check calls that an
 * orphan figure. The enumeration now lives here, has exactly one implementation, and is consumed
 * by two readers: the mocha anchor gate and `src/report-figures.ts`, which emits the numbers into
 * `outputs/report-figures.json` so every prose citation traces to a producing artifact (S-CONST).
 *
 * The enumeration is over the 52 distinct card TYPES with multiplicity 8, not over 416 physical
 * cards: both evaluators are symmetric in their arguments, so the hypergeometric weights below
 * give the exact unordered draw distribution.
 *
 *   2 cards:  C(52,2)·8·8            + 52·C(8,2)                       = 86,320     = C(416,2)
 *   3 cards:  C(52,3)·8·8·8 + 52·51·C(8,2)·8 + 52·C(8,3)               = 11,912,160 = C(416,3)
 *
 * Each result carries its own `total`, and callers assert it against C(416,k) so a bug in the
 * weights cannot pass silently.
 */

import { evaluatePerfectPairs, evaluate21Plus3 } from './sidebets';
import { DECKS, SHOE_SIZE } from './config';

const SUITS = ['HEART', 'DIAMOND', 'CLUB', 'SPADE'];

/** The 52 distinct card types, in the encoding `src/sidebets.ts` parses. */
export const TYPES: string[] = (() => {
  const t: string[] = [];
  for (const s of SUITS) for (let r = 1; r <= 13; r++) t.push(`${s}:${r}`);
  return t;
})();

/** Exact binomial C(n,k) in BigInt. */
export function binom(n: bigint, k: bigint): bigint {
  let num = 1n;
  let den = 1n;
  for (let i = 0n; i < k; i++) { num *= n - i; den *= i + 1n; }
  return num / den;
}

const COPIES = BigInt(DECKS);          // 8 physical copies of each of the 52 types
const PAIR_SAME = binom(COPIES, 2n);   // C(8,2) = 28
const TRIPLE_SAME = binom(COPIES, 3n); // C(8,3) = 56

/** gcd-reduced fraction, so an assertion can be on the exact rational rather than a float. */
export function reduce(n: bigint, d: bigint): [bigint, bigint] {
  const g = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : g(b, a % b));
  const k = g(n, d);
  return [n / k, d / k];
}

export interface ExactEdge {
  /** Reduced numerator of the exact edge (1 − RTP). */
  num: number;
  /** Reduced denominator. */
  den: number;
  /** `num/den` as a string, e.g. "9/415" — the form the anchor gate asserts. */
  rational: string;
  /** Edge as a fraction of one unit staked. */
  edge: number;
  /** Return to player, 1 − edge. */
  rtp: number;
  /** Total enumeration weight, asserted against C(416,k) by the caller. */
  total: string;
}

function finish(surplus: bigint, total: bigint): ExactEdge {
  const [n, d] = reduce(surplus, total);
  return {
    num: Number(n),
    den: Number(d),
    rational: `${n}/${d}`,
    edge: Number(n) / Number(d),
    rtp: 1 - Number(n) / Number(d),
    total: total.toString(),
  };
}

/**
 * Perfect Pairs over the player's first two cards.
 *
 * `coloredPairOverride` replaces the COLORED_PAIR payout without touching `src/config.ts` — used
 * for a hypothetical 12:1 sensitivity calculation, not an observed LIQD paytable. Omit it and
 * the paytable is read from config, unmodified.
 */
export function perfectPairsEdgeExact(coloredPairOverride?: number): ExactEdge {
  let returned = 0n; // Σ weight × units returned (stake + win; a loser returns 0)
  let total = 0n;
  const unitsBack = (a: string, b: string): bigint => {
    const r = evaluatePerfectPairs(a, b);
    const pay = coloredPairOverride !== undefined && r.category === 'COLORED_PAIR'
      ? coloredPairOverride
      : r.payout;
    return BigInt(pay > 0 ? pay + 1 : 0);
  };
  for (let i = 0; i < 52; i++) {
    total += PAIR_SAME;
    returned += PAIR_SAME * unitsBack(TYPES[i], TYPES[i]);          // two copies of one type
    for (let j = i + 1; j < 52; j++) {
      const w = COPIES * COPIES;
      total += w;
      returned += w * unitsBack(TYPES[i], TYPES[j]);
    }
  }
  return finish(total - returned, total);
}

/** 21+3 over the player's first two cards plus the dealer upcard. */
export function twentyOnePlusThreeEdgeExact(): ExactEdge {
  let returned = 0n;
  let total = 0n;
  const add = (w: bigint, a: string, b: string, c: string): void => {
    total += w;
    const pay = evaluate21Plus3(a, b, c).payout;
    returned += w * BigInt(pay > 0 ? pay + 1 : 0);
  };
  for (let i = 0; i < 52; i++) {
    add(TRIPLE_SAME, TYPES[i], TYPES[i], TYPES[i]);                 // three copies of one type
    for (let j = 0; j < 52; j++) {
      if (j === i) continue;
      add(PAIR_SAME * COPIES, TYPES[i], TYPES[i], TYPES[j]);        // a pair of i plus one j
    }
    for (let j = i + 1; j < 52; j++) {
      for (let k = j + 1; k < 52; k++) add(COPIES ** 3n, TYPES[i], TYPES[j], TYPES[k]);
    }
  }
  return finish(total - returned, total);
}

/** C(416,2) and C(416,3) — the totals every enumeration above must reproduce. */
export const SHOE_PAIR_COMBINATIONS = binom(BigInt(SHOE_SIZE), 2n).toString();
export const SHOE_TRIPLE_COMBINATIONS = binom(BigInt(SHOE_SIZE), 3n).toString();
