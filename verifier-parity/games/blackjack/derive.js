import { hmacSha256Hex, hexToBytes } from '../../lib/hmac-sha256';

/**
 * LIQD.com Blackjack RNG — port of the canonical HMAC-SHA256 Fisher-Yates
 * shoe generator plus deterministic action replay.
 *
 * Source of truth (audit repo):
 *   https://github.com/ProvablyFair-org/liqd-blackjack/blob/main/src/rng.ts
 *
 * Verified against the full 6,000-hand live audit dataset — every bet
 * replayed through this exact engine in Node:
 *
 *   Shoe order (strict):  6,000 / 6,000  (100.00% — incl. all 401 splits)
 *   Cards + outcomes:     6,000 / 6,000  (100.00% — full action replay)
 *   Round money:          6,000 / 6,000  (100.00%, max delta $0.00000000)
 *   Perfect Pairs:        5,800 / 5,800  (category + payout)
 *   21+3:                 5,800 / 5,800  (category + payout)
 *
 * Algorithm:
 *
 *   The 416-card shoe (8 decks) starts in suit-major template order —
 *   for each of 8 decks, suits [C, H, S, D] × ranks A,2..10,J,Q,K — and is
 *   shuffled by a BACKWARD in-place Fisher-Yates:
 *
 *     for i = 415 down to 1:
 *       message = `${clientSeed}:${nonce}:${i}`          ; cursor = i
 *       hash    = HMAC-SHA256(keyBytes(serverSeed), message)   ; 32 bytes
 *       scan 4-byte big-endian chunks (up to 8):
 *         maxFair = floor(2^32 / (i+1)) * (i+1)
 *         if value < maxFair:  j = value % (i+1)  ; break
 *       (if all 8 chunks rejected: cursor += 1,000,000 and re-HMAC — a ≈10⁻⁵⁸-per-digest
 *        event at range 416, retried transparently like the reference implementation)
 *       swap(shoe[i], shoe[j])
 *
 *   Deal is PDPD from the shuffled shoe:
 *     player = shoe[0], shoe[2] · dealer = shoe[1] (up), shoe[3] (hole)
 *     All later draws come from shoe[4:], in order.
 *
 *   Split rounds (pinned draw order, verified card-for-card in the audit):
 *     shoe[4] = main hand 2nd card, shoe[5] = split hand 2nd card, then the
 *     SPLIT hand plays out fully, then the MAIN hand, then the dealer.
 *     Split is allowed on matching VALUE (any two ten-value cards — Q+10,
 *     K+J, … — 134 such splits in the dataset). Split aces receive exactly
 *     one card each. No re-split (no third hand in 401 observed splits).
 *
 *   Dealer: stands on soft 17 (S17); peeks for blackjack on Ace/10 upcards
 *   (US peek / OBO — a dealer natural ends the round before any player
 *   action); ALWAYS plays out to 17+ otherwise, even when every player
 *   hand has busted (confirmed on 720 all-bust rounds in the dataset).
 *
 * Side bets (evaluated on the initial deal only — deal-time invariant):
 *   Perfect Pairs (P1, P2):  perfect = 26×, colored = 14×, mixed = 7×
 *   21+3 (P1, P2, D_up):     suited_trips = 101×, straight_flush = 41×,
 *                            three_kind = 31×, straight = 11×, flush = 6×
 *   Multipliers are gross-return ratios (paytable-to-1 plus the stake):
 *   amount_won = stake × multiplier. Paytables 25/13/6 and 100/40/30/10/5
 *   to-1, confirmed against 11,600 live settled side bets.
 *
 * Payouts (main bet, gross return per unit stake):
 *   blackjack   = 2.5    (3:2 — return 1.5× profit + 1× stake)
 *   win         = 2.0
 *   push        = 1.0
 *   lose / bust = 0
 *   double      = 2× the above per doubled hand (4 on win, 0 on bust).
 *   Note: in the 6,000-hand capture, doubles after a split always occurred
 *   on both hands or neither, so per-hand and round-level double scaling
 *   are indistinguishable on observed data; this engine scales per hand
 *   (the standard convention).
 */

// ── Shoe template ────────────────────────────────────────────────────────────

const SUIT_ORDER = ['C', 'H', 'S', 'D']; // CLUB, HEART, SPADE, DIAMOND — audit order
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const DECKS = 8;
export const SHOE_SIZE = DECKS * 52; // 416

function buildShoeTemplate() {
  const shoe = [];
  for (let d = 0; d < DECKS; d++) {
    for (const s of SUIT_ORDER) {
      for (const r of RANKS) shoe.push(r + s);
    }
  }
  return shoe;
}

// ── Seed handling ────────────────────────────────────────────────────────────

/**
 * Decode a serverSeed string to a Uint8Array. Real LIQD seeds are 32-char
 * hex (16 bytes); any even-length hex decodes as bytes, and non-hex inputs
 * fall through to UTF-8 so the verifier still produces a deterministic
 * result (the shell shows a soft warning for non-32-hex seeds).
 */
function keyBytes(serverSeed) {
  if (typeof serverSeed !== 'string' || serverSeed.length === 0) {
    return new Uint8Array(0);
  }
  if (serverSeed.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(serverSeed)) {
    return hexToBytes(serverSeed);
  }
  return utf8Bytes(serverSeed);
}

function utf8Bytes(s) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return new Uint8Array(out);
}

// ── Provably fair uniform integer ────────────────────────────────────────────

/**
 * Bias-free uniform integer in [0, range) for the Fisher-Yates swap at
 * `cursor`. Reads the 32-byte HMAC digest as 8 big-endian uint32 chunks and
 * takes the first below maxFair (modulo-bias rejection); if all 8 are
 * rejected, the cursor advances by 1,000,000 and the HMAC is recomputed —
 * identical to the audit repo's generateProvablyFairNumber.
 */
export function fyRand(key, clientSeed, nonce, cursor, range) {
  const maxFair = Math.floor(0x100000000 / range) * range;
  let cur = cursor;
  for (;;) {
    const hmac = hmacSha256Hex(key, `${clientSeed}:${nonce}:${cur}`);
    for (let off = 0; off + 8 <= hmac.length; off += 8) {
      const value = parseInt(hmac.substring(off, off + 8), 16);
      if (value < maxFair) return value % range;
    }
    cur += 1000000; // all 8 chunks rejected — ≈1.6×10⁻⁵⁸ per digest at range 416; retried like src/rng.ts
  }
}

/**
 * Build the full 416-card shuffled shoe for (serverSeed, clientSeed, nonce).
 * Backward in-place Fisher-Yates: for i = 415..1, j = fyRand(cursor=i,
 * range=i+1) ∈ [0, i]; swap(shoe[i], shoe[j]).
 */
export function blackjackShoe(serverSeed, clientSeed, nonce) {
  const key = keyBytes(serverSeed);
  const a = buildShoeTemplate();
  for (let i = a.length - 1; i >= 1; i--) {
    const j = fyRand(key, clientSeed, nonce, i, i + 1);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// ── Card helpers ─────────────────────────────────────────────────────────────

function cardRank(card) {
  return card.slice(0, card.length - 1);
}

function cardSuit(card) {
  return card[card.length - 1];
}

function cardColor(card) {
  const s = cardSuit(card);
  return s === 'H' || s === 'D' ? 'red' : 'black';
}

/** Blackjack VALUE of a rank — split matching is value-based on LIQD. */
function rankValue(rank) {
  if (rank === 'A') return 11;
  if (rank === 'J' || rank === 'Q' || rank === 'K' || rank === '10') return 10;
  return parseInt(rank, 10);
}

export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const v = rankValue(cardRank(c));
    total += v;
    if (v === 11) aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { best: total, isSoft: aces > 0 };
}

function isNaturalBlackjack(cards) {
  return cards.length === 2 && handValue(cards).best === 21;
}

// ── Side bets ────────────────────────────────────────────────────────────────

// Perfect Pairs — gross-return multipliers (25 / 13 / 6 to-1, confirmed
// against 5,800 live bets; coloured 13:1 is above the market-standard 12:1).
const PP_MULT = {
  perfect_pair: 26,
  colored_pair: 14,
  mixed_pair: 7,
};

// 21+3 — gross-return multipliers (100 / 40 / 30 / 10 / 5 to-1, confirmed
// against 5,800 live bets including the dataset's single 100:1 suited-trips hit).
const T3_MULT = {
  suited_trips: 101,
  straight_flush: 41,
  three_kind: 31,
  straight: 11,
  flush: 6,
};

// Rank order for straight detection in 21+3. Ace can be low (A,2,3) or
// high (Q,K,A) — handled below by trying both orderings.
const RANK_ORDER = {
  A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7,
  8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13,
};

export function classifyPerfectPairs(c1, c2) {
  if (cardRank(c1) !== cardRank(c2)) return null;
  if (cardSuit(c1) === cardSuit(c2)) return 'perfect_pair';
  if (cardColor(c1) === cardColor(c2)) return 'colored_pair';
  return 'mixed_pair';
}

function isStraight(r1, r2, r3) {
  const vals = [RANK_ORDER[r1], RANK_ORDER[r2], RANK_ORDER[r3]].sort((a, b) => a - b);
  if (vals[2] - vals[1] === 1 && vals[1] - vals[0] === 1) return true;
  if (vals.includes(1)) {
    const aceHigh = vals.map(v => (v === 1 ? 14 : v)).sort((a, b) => a - b);
    if (aceHigh[2] - aceHigh[1] === 1 && aceHigh[1] - aceHigh[0] === 1) return true;
  }
  return false;
}

export function classifyTwentyOnePlus3(c1, c2, c3) {
  const r1 = cardRank(c1), r2 = cardRank(c2), r3 = cardRank(c3);
  const s1 = cardSuit(c1), s2 = cardSuit(c2), s3 = cardSuit(c3);
  const sameRank = r1 === r2 && r2 === r3;
  const sameSuit = s1 === s2 && s2 === s3;
  const straight = isStraight(r1, r2, r3);
  if (sameRank && sameSuit) return 'suited_trips';
  if (straight && sameSuit) return 'straight_flush';
  if (sameRank) return 'three_kind';
  if (straight) return 'straight';
  if (sameSuit) return 'flush';
  return null;
}

// ── Main derive ──────────────────────────────────────────────────────────────

/**
 * Reproduce a LIQD blackjack hand from seeds + replayed actions.
 *
 * @param {Object} p
 * @param {string} p.serverSeed     32-char hex post-reveal, or any string for testing
 * @param {string} p.clientSeed
 * @param {number} p.nonce
 * @param {string[]} p.actions      sequence as recorded by the casino: any
 *                                  combination of 'hit'|'stand'|'double'|'split',
 *                                  plus 'no-ins' (the legacy token the capture records
 *                                  on insurance-settled rounds — NOT a decline; consumed
 *                                  but draws no card; insurance itself is a separate
 *                                  wager channel that never touches the shoe)
 * @param {{perfectPairs?:boolean, twentyOnePlus3?:boolean}} p.sideBets
 *
 * @returns {Object} result — same shape contract as the other game modules
 */
export function deriveBlackjackSync({ serverSeed, clientSeed, nonce, actions, sideBets }) {
  const acts = Array.isArray(actions) ? actions : [];
  const sb = sideBets || {};

  // Full shoe up front — the whole hand is determined here.
  const shoe = blackjackShoe(serverSeed, clientSeed, nonce);
  let ptr = 0;
  const take = () => shoe[ptr++];

  // Display hash: the digest that drove the FIRST Fisher-Yates swap (i=415).
  const hashes = {
    fy415: hmacSha256Hex(keyBytes(serverSeed), `${clientSeed}:${nonce}:415`),
  };

  // ── Initial deal — PDPD from the shuffled shoe ─────────────────────────────
  const p1 = take();    // shoe[0] — Player card 1
  const dUp = take();   // shoe[1] — Dealer upcard
  const p2 = take();    // shoe[2] — Player card 2
  const dHole = take(); // shoe[3] — Dealer hole card

  const initialPlayer = [p1, p2];
  const dealerCards = [dUp, dHole];

  // ── Side bets (fixed at the deal, regardless of later branching) ──────────
  const sideBetOut = {};
  if (sb.perfectPairs) {
    const result = classifyPerfectPairs(p1, p2);
    const multiplier = result ? PP_MULT[result] : 0;
    sideBetOut.perfectPairs = { placed: true, result, multiplier, payout: multiplier };
  } else {
    sideBetOut.perfectPairs = { placed: false, result: null, multiplier: 0, payout: 0 };
  }
  if (sb.twentyOnePlus3) {
    const result = classifyTwentyOnePlus3(p1, p2, dUp);
    const multiplier = result ? T3_MULT[result] : 0;
    sideBetOut.twentyOnePlus3 = { placed: true, result, multiplier, payout: multiplier };
  } else {
    sideBetOut.twentyOnePlus3 = { placed: false, result: null, multiplier: 0, payout: 0 };
  }

  // ── Naturals (dealer peeks on Ace/10 upcards — US peek / OBO) ──────────────
  const playerBJ = isNaturalBlackjack(initialPlayer);
  const dealerBJ = isNaturalBlackjack(dealerCards);

  // Filter out the insurance token — it appears on insurance-settled rounds
  // (dealer Ace upcard), consumes no card, and has no effect on this verifier
  // (insurance is a separate wager settled off the same two dealer cards).
  const realActions = acts.filter(a => a !== 'no-ins' && a !== 'no_insurance');
  let aIdx = 0;

  // Play a single hand to completion against the shoe. A DRAWN card that
  // brings the hand to 21+ ends it without consuming another token (matches
  // the capture: hit-to-21 and busts carry no trailing 'stand'); a hand
  // sitting on 21 after the deal/auto card still consumes its explicit
  // 'stand' (matches the capture's split rounds).
  function playHand(h) {
    while (aIdx < realActions.length) {
      const a = realActions[aIdx++];
      if (a === 'hit') {
        h.cards.push(take());
        if (handValue(h.cards).best >= 21) break;
      } else if (a === 'stand') {
        break;
      } else if (a === 'double') {
        h.cards.push(take());
        h.doubled = true;
        break;
      } else {
        break; // unknown action — stop this hand
      }
    }
  }

  let hands = [{ cards: [p1, p2], doubled: false, fromSplitAces: false, isSplit: false }];
  let isSplit = false;

  if (playerBJ || dealerBJ) {
    // No player actions on either natural; the round resolves on the hole
    // card. On a dealer natural the peek pre-empts all further wagers.
  } else if (realActions[0] === 'split' && rankValue(cardRank(p1)) === rankValue(cardRank(p2))) {
    // ── Split (value-based: any two ten-value cards may split) ─────────────
    isSplit = true;
    aIdx = 1;
    const main2 = take();  // shoe[4] — MAIN hand 2nd card first
    const split2 = take(); // shoe[5] — SPLIT hand 2nd card
    const fromSplitAces = cardRank(p1) === 'A' && cardRank(p2) === 'A';
    const mainHand = { cards: [p1, main2], doubled: false, fromSplitAces, isSplit: false };
    const splitHand = { cards: [p2, split2], doubled: false, fromSplitAces, isSplit: true };
    hands = [mainHand, splitHand];

    if (!fromSplitAces) {
      // Pinned LIQD order: the SPLIT hand plays out fully first, then the
      // MAIN hand — matching the shoe draw order verified card-for-card
      // across all 401 split rounds in the audit. (Split aces take exactly
      // one card each and consume no further actions.)
      playHand(splitHand);
      playHand(mainHand);
    }
  } else {
    // ── No split — single hand ──────────────────────────────────────────────
    playHand(hands[0]);
  }

  // ── Dealer play ─────────────────────────────────────────────────────────────
  // LIQD's dealer plays out to 17+ (standing on soft 17) whenever neither
  // side has a natural — including when every player hand has busted
  // (confirmed on 720 all-bust rounds: the dealer still drew to 17+).
  if (!playerBJ && !dealerBJ) {
    for (;;) {
      const { best } = handValue(dealerCards);
      if (best >= 17) break; // hard or soft 17+ stands (S17)
      dealerCards.push(take());
    }
  }
  const dealerHv = handValue(dealerCards);

  // ── Resolve outcomes ─────────────────────────────────────────────────────────
  const handResults = [];

  if (playerBJ && dealerBJ) {
    handResults.push({
      cards: initialPlayer, finalValue: 21, isSoft: true,
      outcome: 'push', doubled: false, wager: 1, payout: 1,
    });
  } else if (playerBJ) {
    handResults.push({
      cards: initialPlayer, finalValue: 21, isSoft: true,
      outcome: 'blackjack', doubled: false, wager: 1, payout: 2.5,
    });
  } else if (dealerBJ) {
    const v = handValue(initialPlayer);
    handResults.push({
      cards: initialPlayer, finalValue: v.best, isSoft: v.isSoft,
      outcome: 'lose', doubled: false, wager: 1, payout: 0,
    });
  } else {
    for (const h of hands) {
      const v = handValue(h.cards);
      const wager = h.doubled ? 2 : 1;
      let outcome, payout;
      if (v.best > 21) {
        outcome = 'bust'; payout = 0;
      } else if (dealerHv.best > 21 || v.best > dealerHv.best) {
        outcome = 'win'; payout = 2 * wager;
      } else if (v.best === dealerHv.best) {
        outcome = 'push'; payout = 1 * wager;
      } else {
        outcome = 'lose'; payout = 0;
      }
      handResults.push({
        cards: h.cards, finalValue: v.best, isSoft: v.isSoft,
        outcome, doubled: h.doubled, wager, payout,
      });
    }
  }
  const firstOutcome = handResults[0].outcome;

  let overall;
  if (handResults.length === 1) {
    overall = firstOutcome;
  } else {
    const outcomes = new Set(handResults.map(h => h.outcome));
    overall = outcomes.size === 1 ? firstOutcome : 'mixed';
  }

  // Total return on the main bet, in units where the original wager = 1.
  const mainPayoutUnits = handResults.reduce((s, h) => s + h.payout, 0);
  const totalWager = handResults.reduce((s, h) => s + h.wager, 0);
  const multiplier = mainPayoutUnits;

  return {
    multiplier,
    outcome: overall,
    initialCards: {
      player: initialPlayer,
      dealer: [dUp, dHole],
    },
    hands: handResults,
    dealer: {
      cards: dealerCards,
      finalValue: dealerHv.best,
      isSoft: dealerHv.isSoft,
      busted: dealerHv.best > 21,
    },
    sideBets: sideBetOut,
    cardsDealt: ptr,
    totalWager,
    isSplit,
    playerBlackjack: playerBJ,
    dealerBlackjack: dealerBJ,
    hashes,
    // Echo the seeds and the top of the shoe so the Viz can render the
    // "next 20 cards in the shoe" strip without re-deriving. Read-only.
    _seeds: { serverSeed, clientSeed, nonce },
    _shoePreview: shoe.slice(0, 24),
  };
}
