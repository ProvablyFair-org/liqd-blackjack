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
import { DECKS, SHOE_SIZE, RULES, SIDE_STAKE_RATIO } from './config';

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

/**
 * INSURANCE TAKEN ON EVERY OFFER — the insurance the capture's rounds carried (MANIFEST DL-17).
 *
 * The capture sent `place-insurance-bet {betAmount: 0}` on every offer and the casino booked a
 * half-stake insurance bet each time (446 of 446). This is the exact expected net of that policy,
 * per initial bet, over the 416-card shoe — the amount it adds to the basic-strategy edge, whose
 * headline (99.512325 %) assumes insurance is declined.
 *
 * Enumerated over the ordered PDPD deal: player shoe[0], dealer upcard shoe[1], player shoe[2],
 * hole shoe[3], by rank (32 copies each, ranks 10–13 ten-valued). The offer condition is the one
 * this capture shows (Step 28): a dealer Ace upcard and no player natural (446 offers on the 462
 * dealer-Ace rounds; the 16 without one are all player naturals). The stake is
 * SIDE_STAKE_RATIO.insurance of the main stake and the bet pays RULES.insurancePays iff the hole
 * card is ten-valued. Integer arithmetic throughout; `total` must equal 416·415·414·413.
 */
export interface InsuranceEveryOffer {
  /** Expected insurance net per initial bet (negative = to the house). */
  netPerInitialBet: number;
  /** The same as a reduced rational, numerator/denominator. */
  rational: string;
  /** Probability that a round offers insurance under the observed condition. */
  offerProbability: number;
  /** Ordered-deal weight total, 416·415·414·413. */
  total: string;
}
export function insuranceEveryOfferExact(): InsuranceEveryOffer {
  const PER_RANK = BigInt(DECKS * 4);                       // 32 copies of each rank
  const N = BigInt(SHOE_SIZE);
  const [payNum, payDen] = RULES.insurancePays.map((x) => BigInt(x));
  // The stake ratio (0.5) as an exact rational stakeNum/stakeDen; 1e6 resolves any ratio a paytable uses.
  const stakeDen = 1_000_000n;
  const stakeNum = BigInt(Math.round(SIDE_STAKE_RATIO.insurance * 1_000_000));
  const isTen = (r: number): boolean => r >= 10;
  let num = 0n;                                             // Σ weight × net, in units of 1/(stakeDen·payDen) initial bets
  let offered = 0n;
  let total = 0n;
  for (let r1 = 1; r1 <= 13; r1++) {
    for (let up = 1; up <= 13; up++) {
      for (let r2 = 1; r2 <= 13; r2++) {
        const n1 = PER_RANK;
        const nUp = PER_RANK - (up === r1 ? 1n : 0n);
        const n2 = PER_RANK - (r2 === r1 ? 1n : 0n) - (r2 === up ? 1n : 0n);
        const w3 = n1 * nUp * n2;                           // ordered weight of (shoe[0], shoe[1], shoe[2])
        total += w3 * (N - 3n);
        const natural = (r1 === 1 && isTen(r2)) || (isTen(r1) && r2 === 1);
        if (up !== 1 || natural) continue;                  // offered only on an Ace upcard without a player natural
        const tens = BigInt(DECKS * 16) - (isTen(r1) ? 1n : 0n) - (isTen(r2) ? 1n : 0n);
        const wTen = w3 * tens;                             // hole ten-valued: insurance wins
        const wAll = w3 * (N - 3n);
        offered += wAll;
        // win: stake × payNum/payDen; lose: −stake. Scaled by stakeDen·payDen.
        num += stakeNum * (wTen * payNum - (wAll - wTen) * payDen);
      }
    }
  }
  const den = total * stakeDen * payDen;
  const [rn, rd] = reduce(num, den);
  return {
    netPerInitialBet: Number(rn) / Number(rd),
    rational: `${rn}/${rd}`,
    offerProbability: Number(offered) / Number(total),
    total: total.toString(),
  };
}
/** 416·415·414·413 — the ordered four-card deal total insuranceEveryOfferExact must reproduce. */
export const SHOE_DEAL4_ORDERED = (BigInt(SHOE_SIZE) * BigInt(SHOE_SIZE - 1) * BigInt(SHOE_SIZE - 2) * BigInt(SHOE_SIZE - 3)).toString();

/** C(416,2) and C(416,3) — the totals every enumeration above must reproduce. */
export const SHOE_PAIR_COMBINATIONS = binom(BigInt(SHOE_SIZE), 2n).toString();
export const SHOE_TRIPLE_COMBINATIONS = binom(BigInt(SHOE_SIZE), 3n).toString();
