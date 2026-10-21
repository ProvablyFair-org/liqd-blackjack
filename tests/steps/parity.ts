/**
 * Steps 6–7: Recomputation parity + client-seed dependence.
 *
 * Step 6 is the core proof: for every hand, rebuild the 416-card shoe from the
 * revealed server seed + client seed + nonce and confirm the exact cards LIQD dealt.
 *
 *  - Non-split hands: the full dealt sequence is deterministic —
 *      [player[0], dealer[0], player[1], dealer[1], ...player draws..., ...dealer draws...]
 *    (player plays fully, then the dealer). This must equal shoe[0..k] exactly.
 *  - Split hands: the two initial pair cards go to separate hands, and the post-split
 *    draw order is interleaved but deterministic —
 *      shoe[0..3] = main[0], dealer[0], split[0], dealer[1]
 *      shoe[4..5] = main[1], split[1]          (one auto card to each split hand)
 *      then the split hand plays out, then the main hand, then the dealer.
 *    This too must equal shoe[0..k] exactly. (An earlier revision verified splits only
 *    as a multiset of shoe[0..k]; that accepted any reordering of the post-split draws.
 *    See `splitDealtSequence` — the order is now pinned card-for-card.)
 */

import { step } from './context';
import type { StepResult, VerifyContext } from './context';
import * as path from 'path';
import {
  blackjackShoe, generateProvablyFairNumber, expectedFirstChunkRejections, SHOE_SIZE,
} from '../../src/rng';
import { drawBias } from '../../src/bias';
import type { DrawCensus } from '../../src/rng';
import {
  handValue, isBlackjack, rankOf, EXPECTED_HANDS, EXPECTED_SEEDS, REJECTION_VECTOR,
} from '../../src/config';
import { loadSiteVerifier, toSiteCard } from '../../src/site-verifier';
import { CAPTURE_RIG_SHA256 } from '../../src/config';
import { checkCaptureRig, CAPTURE_RIG_FILE, CAPTURE_RIG_SOURCE_MTIME } from '../../src/capture-rig';
import { unitsOf } from '../../src/money';
import type { Bet } from '../../src/types';

/**
 * The draw design this package declares for the operator's shuffle: REJECTION sampling (maxFair =
 * the largest multiple of the range ≤ 2³², chunks at or above it discarded, the next of the
 * digest's eight chunks tried; docs/ALGORITHM.md §2 Step 2). If all eight are rejected the written
 * spec gives no rule (O1) and src/rng.ts throws; LIQD's own code moves to cursor + 1,000,000, a path
 * no captured draw reaches. For that design every draw is exactly uniform on its range, and Step 6
 * requires exactly zero bias.
 */
const DECLARED_DRAW = 'rejection' as const;

/** Main-bet return per unit stake that the cards and rules give a hand — 0, 1, 2 or 5/2. */
function returnRatio(cards: string[], dealer: string[], isSplitHand: boolean): number {
  const pt = handValue(cards).total;
  if (pt > 21) return 0;
  const dBJ = dealer.length === 2 && handValue(dealer).total === 21;
  const pBJ = !isSplitHand && isBlackjack(cards);
  if (pBJ && dBJ) return 1;
  if (pBJ) return 2.5;
  if (dBJ) return 0;
  const dt = handValue(dealer).total;
  if (dt > 21 || pt > dt) return 2;
  return pt === dt ? 1 : 0;
}

/**
 * Wrong-seed collision model for the first card. Under a client seed other than the one used, the
 * recomputed shoe is an independent uniform shuffle of the 416-card shoe, so its first card is
 * uniform over the 52 card identities (8 copies each) and matches the recorded first card with
 * probability exactly 1/52. Over n tested rounds the expected number of chance survivors is n/52
 * with variance n·(1/52)(51/52). A survivor count above E + 5σ means the client seed is not doing
 * what the model says; 0 % change is the degenerate case of the same failure.
 */
function collisionModel(n: number): { expected: number; sd: number; bound: number } {
  const p = 1 / 52;
  const expected = n * p;
  const sd = Math.sqrt(n * p * (1 - p));
  return { expected, sd, bound: expected + 5 * sd };
}

/**
 * Action-grammar check.
 *
 * The count-only cross-check below (#hit + #double == extra cards) is necessary but not
 * sufficient: `["hit"]` rewritten to `["stand","hit"]` leaves the count intact and passes it.
 * So the token stream is also checked as a GRAMMAR. Returns a list of
 * violations (empty = consistent).
 *
 * The stream is a flat log for the whole round; on a split it is the two hands' tokens
 * concatenated, and which hand a given `hit` belongs to is NOT recoverable from the log (a
 * hand that busts emits no terminal). So the grammar deliberately asserts only what holds
 * without that mapping:
 *
 *   G1  `no-ins` only as the very first token; `split` only at the head (after any `no-ins`),
 *       at most once, and present iff `bet.split`.
 *   G2  at most one terminal (`stand`/`double`) per hand, and NO token after the last hand's
 *       terminal — this is the check that rejects `["stand","hit"]`.
 *   G3  inside a hand's segment (greedy: a terminal closes a hand), every token before the
 *       terminal is a `hit`, and `double` is never preceded by a `hit` — LIQD allows doubling
 *       on the first two cards only (`doubleAnyTwo`), so a `hit` then `double` is impossible.
 *   G4  a hand may end WITHOUT a terminal only when it could not act again: it busted, it
 *       reached 21, it is a split-ace one-card hand (`splitAcesOneCard`), or the dealer turned
 *       a natural and the round ended at the peek before the player acted.
 *   G5  the MIRROR of G4 — a terminal that could not have been emitted. G4 catches a missing
 *       `stand`; nothing caught a `stand` that cannot exist, so a `stand` appended to a hand
 *       which had already auto-ended at 21 scored 31/31 Full Pass. Two tiers, each witnessed:
 *         G5a (all rounds) a `stand` can never belong to a BUSTED hand, so
 *             #stand ≤ #hands finishing ≤ 21. Measured 0 violations in 6,000/6,000.
 *         G5b (single-hand rounds only) a hand that reaches exactly 21 auto-ends and emits no
 *             terminal, so #stand ≤ #hands finishing ≤ 20. Measured 0 violations in
 *             5,599/5,599 single-hand rounds: `stand` appears only at totals ≤ 20 (2,869
 *             rounds), never at 21 (467 rounds, all terminal-free) and never on a bust (872
 *             rounds, all terminal-free); the 123 rounds finishing on 21 and the 244 busting
 *             after a `double` carry `double`, not `stand`.
 *       G5b is deliberately NOT applied to split rounds. It is FALSE there: 14 of the 401
 *       split rounds carry a `stand` on a hand that finished at exactly 21 (e.g. epoch 67
 *       nonce 47, `["split","stand","stand"]`, totals 20 and 21). All 14 are two-card 21s on a
 *       split hand, which the casino does not end by itself (a replay of all 401 split rounds
 *       reproduces their token streams only on that reading, MANIFEST DL-18), and the capture
 *       script sent `stand` (the token stream is the script's log of its requests, not an
 *       operator field). Asserting the tidy universal rule would have manufactured 14 false
 *       violations against real captured play.
 *   G6  `bet.doubled` is BOUND to the token stream: (#double > 0) === bet.doubled. `doubled`
 *       is a summary boolean the capture script computed and was checked against nothing, so relabelling a lost
 *       doubled round's `["double"]` to `["hit","stand"]` — leaving `doubled: true` — passed
 *       31/31 (Step 8b's m-factor is unidentifiable at base credit 0), and relabelling a
 *       busted round's `["hit"]` to `["double"]` also passed 31/31 while silently moving the
 *       money-path total from 4152.60 to 4152.70. Measured 0 violations in 6,000/6,000.
 *
 * All six hold on the captured rounds at the counts stated above (measured: 0 violations of each).
 */
function actionGrammarViolations(b: Bet): string[] {
  const v: string[] = [];
  const acts = b.actions || [];
  const hands = b.playerHands || [];
  const H = hands.length;

  // ── G1: prefix ────────────────────────────────────────────────────────────
  let i = 0;
  if (acts[i] === 'no-ins') i++;
  const hasSplitToken = acts[i] === 'split';
  if (hasSplitToken) i++;
  if (hasSplitToken !== Boolean(b.split)) {
    v.push(`split token ${hasSplitToken ? 'present' : 'absent'} but bet.split=${Boolean(b.split)}`);
  }
  const rest = acts.slice(i);
  if (rest.includes('no-ins')) v.push('`no-ins` appears after the first token');
  if (rest.includes('split')) v.push('`split` appears outside the head of the stream');

  const isTerminal = (a: string): boolean => a === 'stand' || a === 'double';

  // ── G2: no token after the last hand's terminal ───────────────────────────
  let terminalsSeen = 0;
  for (let k = 0; k < rest.length; k++) {
    if (terminalsSeen >= H) { v.push(`token \`${rest[k]}\` follows terminal #${H} — the round was already over`); break; }
    if (isTerminal(rest[k])) terminalsSeen++;
  }
  const terminals = rest.filter(isTerminal).length;
  if (terminals > H) v.push(`${terminals} terminal token(s) for ${H} hand(s)`);

  // ── G3: segment shape ─────────────────────────────────────────────────────
  const segs: string[][] = [];
  let cur: string[] = [];
  for (const a of rest) { cur.push(a); if (isTerminal(a)) { segs.push(cur); cur = []; } }
  if (cur.length) segs.push(cur);
  for (const s of segs) {
    const last = s[s.length - 1];
    const body = isTerminal(last) ? s.slice(0, -1) : s;
    if (!body.every((a) => a === 'hit')) v.push(`segment ${JSON.stringify(s)} contains a non-\`hit\` before its terminal`);
    if (last === 'double' && body.length > 0) v.push(`\`double\` after ${body.length} \`hit\`(s) — doubling is first-two-cards only`);
  }

  // ── G4: a hand may go unterminated only if it could not act again ─────────
  const unterminated = H - terminals;
  if (unterminated > 0 && !isBlackjack(b.dealerHand || [])) {
    const couldNotAct = hands.filter((h) => {
      const cards = h.cards || [];
      const splitAceOneCard = Boolean(b.split) && cards.length === 2 && rankOf(cards[0]) === 1;
      return handValue(cards).total >= 21 || splitAceOneCard;
    }).length;
    if (unterminated > couldNotAct) {
      v.push(`${unterminated} hand(s) end with no \`stand\`/\`double\` but only ${couldNotAct} busted / reached 21 / were split aces (dealer had no natural)`);
    }
  }

  // ── G5: a terminal that could not have been emitted ───────────────────────
  // Each `stand` must be attributable to SOME hand that was legally able to stand, and a
  // hand carries at most one terminal (G2). So the count of `stand` tokens is bounded by the
  // count of hands that could have stood. Order-free, which is what makes it work on a flat
  // log where a token cannot be mapped to a hand.
  const standTokens = rest.filter((a) => a === 'stand').length;
  const notBusted = hands.filter((h) => handValue(h.cards || []).total <= 21).length;
  if (standTokens > notBusted) {
    v.push(`${standTokens} \`stand\` token(s) but only ${notBusted} hand(s) finished at 21 or under — a busted hand cannot stand`);
  }
  // G5b — single-hand rounds only. See the header: a split hand at exactly 21 DOES log a
  // stand in this capture (14 rounds), so the ≤20 bound is scoped to H === 1, where it is
  // witnessed on all 5,599 rounds.
  if (H === 1) {
    const canStand = hands.filter((h) => handValue(h.cards || []).total <= 20).length;
    if (standTokens > canStand) {
      v.push(`single-hand round: \`stand\` on a hand that finished at ${handValue(hands[0]?.cards || []).total} — a single hand reaching 21 auto-ends and emits no terminal`);
    }
  }

  // ── G6: `doubled` bound to the tokens that would have produced it ─────────
  const doubleTokens = rest.filter((a) => a === 'double').length;
  if ((doubleTokens > 0) !== Boolean(b.doubled)) {
    v.push(`bet.doubled=${Boolean(b.doubled)} but the action stream carries ${doubleTokens} \`double\` token(s) — the capture script's summary flag disagrees with the log it summarises`);
  }
  return v;
}

function dealtSequence(playerHand: string[], dealerHand: string[]): string[] {
  const seq: string[] = [];
  if (playerHand?.[0]) seq.push(playerHand[0]);
  if (dealerHand?.[0]) seq.push(dealerHand[0]);
  if (playerHand?.[1]) seq.push(playerHand[1]);
  if (dealerHand?.[1]) seq.push(dealerHand[1]);
  for (let i = 2; i < (playerHand?.length || 0); i++) seq.push(playerHand[i]);
  for (let i = 2; i < (dealerHand?.length || 0); i++) seq.push(dealerHand[i]);
  return seq;
}

/**
 * Exact draw order for a split round. Derived empirically from the capture and
 * confirmed against every split hand in the dataset:
 *
 *   shoe[0..3]  main[0], dealer[0], split[0], dealer[1]   (the pinned initial deal)
 *   shoe[4..5]  main[1], split[1]                         (one auto card to each hand)
 *   then        the SPLIT hand plays out fully (split[2..]),
 *   then        the MAIN hand plays out fully (main[2..]),
 *   then        the dealer draws (dealer[2..]).
 *
 * This makes a split verifiable in strict order rather than only as a multiset —
 * a reordering of post-split draws no longer passes.
 */
function splitDealtSequence(main: string[], split: string[], dealer: string[]): string[] {
  return [main[0], dealer[0], split[0], dealer[1], main[1], split[1],
    ...split.slice(2), ...main.slice(2), ...dealer.slice(2)].filter((c) => c !== undefined);
}

export function run(ctx: VerifyContext): StepResult[] {
  const { bets, seedMap } = ctx;

  // ── Step 6: Recomputation parity ────────────────────────────────────────────
  let checked = 0;
  let bad = 0;
  let skipped = 0;
  let nonSplit = 0;
  let splits = 0;
  let splitOrderBad = 0;
  let actionInconsistent = 0;
  let grammarBad = 0;
  const actionFailures: string[] = [];
  const grammarFailures: string[] = [];
  const failures: string[] = [];
  // The draw census is taken DURING the recomputation, from the same draw calls that produced the
  // shoes being compared — not from a second, instrumented copy of the primitive.
  const census: DrawCensus = { draws: 0, firstChunkRejected: 0, cursorAdvanced: 0 };
  let censusShoes = 0;
  for (const b of bets) {
    // ── Action/card cross-check ─────────────────────────────────────────────────
    // The recorded `actions` tokens must account for every card the player drew:
    // each `hit` and each `double` draws exactly one card, and nothing else adds a
    // player card, so (# hit + # double) must equal the number of cards drawn beyond
    // the two-card start of each hand. Without this, an action token could be relabelled
    // (e.g. a `hit` rewritten to `stand`) while the third card is left in place and the
    // card-recomputation below would still pass. (`stand`/`no-ins`/`split` draw no card to
    // the player; the split hand's one auto card per hand is covered by the 2-per-hand base.)
    const acts = b.actions || [];
    const drawTokens = acts.filter((a) => a === 'hit' || a === 'double').length;
    const nHands = b.playerHands?.length || 0;
    const playerCards = (b.playerHands || []).reduce((s, h) => s + (h.cards?.length || 0), 0);
    const extraCards = playerCards - 2 * nHands;
    if (drawTokens !== extraCards) {
      actionInconsistent++;
      if (actionFailures.length < 5) actionFailures.push(`nonce ${b.nonce} (epoch ${b.epoch}): ${drawTokens} hit/double vs ${extraCards} extra card(s)`);
    }

    // ── Action GRAMMAR ──────────────────────────────────────────────────────────
    // The count above is order-blind: `["hit"]` rewritten to `["stand","hit"]` keeps the count
    // and passes. The grammar rejects a token after the round's last terminal, a `double` that
    // follows a `hit`, a misplaced `no-ins`/`split`, and a hand that stops without standing when
    // it could still have acted. See actionGrammarViolations() above.
    const gv = actionGrammarViolations(b);
    if (gv.length) {
      grammarBad++;
      if (grammarFailures.length < 5) grammarFailures.push(`nonce ${b.nonce} (epoch ${b.epoch}): ${gv[0]}`);
    }

    const serverSeed = seedMap.get(b.hashedServerSeed);
    if (!serverSeed || !b.clientSeed) { skipped++; continue; }
    const shoe = blackjackShoe(serverSeed, b.clientSeed, b.nonce, census);
    censusShoes++;
    let ok: boolean;
    if (b.split) {
      splits++;
      const main = b.playerHands[0]?.cards || [];
      const spl = b.playerHands[1]?.cards || [];
      const d = b.dealerHand || [];
      const seq = splitDealtSequence(main, spl, d);
      ok = seq.length === main.length + spl.length + d.length && seq.every((c, i) => c === shoe[i]);
      if (!ok) splitOrderBad++;
    } else {
      nonSplit++;
      const seq = dealtSequence(b.playerHands[0]?.cards || [], b.dealerHand || []);
      // The comparison is prefix-wise, so an EMPTY sequence would pass vacuously.
      // A real round always has at least the initial PDPD deal. (Truncation at the
      // TAIL of a hand is not detectable here — the shoe cannot say how many cards
      // the round should have consumed — and is caught instead by the dealer
      // draw-rule replay in Step 11.)
      ok = seq.length >= 4 && seq.every((c, i) => c === shoe[i]);
    }
    checked++;
    if (!ok) { bad++; if (failures.length < 5) failures.push(`nonce ${b.nonce} (epoch ${b.epoch})`); }
  }
  // COVERAGE ASSERTION: `checked` must equal EXPECTED_HANDS — every hand of the DECLARED
  // population recomputed. It used to compare against `bets.length`, which is the file's own
  // row count: delete 50 rounds and the target moves with them, so the step printed
  // "5950/5950 hands … PASS". The expected N is the capture plan in src/config.ts.
  // An unrevealed (or nulled) server seed makes `seedMap.get` miss and the hand is skipped;
  // that is a hard FAIL, not a FLAG, because a partially-recomputed dataset cannot carry a
  // Full Pass. Previously a skip only FLAGged (→ "Conditional Pass"), which still reads as a
  // pass to a coverage-mutation gate.
  // ── Step 6, draw-bias arm (BLACKJACK-08) ─────────────────────────────────────────────
  // A backward Fisher-Yates over 416 cards draws once over every range 416, 415, …, 2. For every
  // range: maxFair (the rejection ceiling), the probability a chunk is rejected, and the EXACT
  // per-value bias conditional on acceptance — all from src/rng.ts maxFairFor, the one definition
  // the draw reads. The declared design is rejection sampling, so every range must be exactly
  // unbiased (bias 0, within 2⁻³² a fortiori). Then the census of the draws just made.
  const TWO_POW_M32 = 2 ** -32;
  const perRange = Array.from({ length: SHOE_SIZE - 1 }, (_, i) => ({ range: SHOE_SIZE - i, ...drawBias(SHOE_SIZE - i) }));
  const biased = perRange.filter((r) => !r.exact || r.bias > TWO_POW_M32);
  const worstBias = perRange.reduce((mx, r) => Math.max(mx, r.bias), 0);
  const worstReject = perRange.reduce((w, r) => (r.rejectProbability > w.rejectProbability ? r : w), perRange[0]);
  const vec = REJECTION_VECTOR;
  const vecGot = generateProvablyFairNumber(vec.serverSeed, vec.clientSeed, vec.nonce, vec.cursor, vec.range);
  const vecCensus: DrawCensus = { draws: 0, firstChunkRejected: 0, cursorAdvanced: 0 };
  const vecShoe = blackjackShoe(vec.serverSeed, vec.clientSeed, vec.nonce, vecCensus);
  const vecOk = vecGot === vec.expected && vecCensus.firstChunkRejected >= 1;
  const censusExpected = expectedFirstChunkRejections(censusShoes);
  const censusOk = censusShoes === EXPECTED_HANDS && census.draws === EXPECTED_HANDS * (SHOE_SIZE - 1);
  const biasOk = DECLARED_DRAW === 'rejection' && perRange.length === SHOE_SIZE - 1 && biased.length === 0 && vecOk && censusOk;
  const biasDetail = `Draw bias bound (declared design: ${DECLARED_DRAW} sampling, src/rng.ts maxFairFor): `
    + `maxFair per range [range:maxFair] ${perRange.map((r) => `${r.range}:${r.maxFair}`).join(' ')}; `
    + `${perRange.length - biased.length}/${perRange.length} ranges have maxFair a whole multiple of the range, so the per-value bias conditional on acceptance is exactly 0 (worst over all ranges ${worstBias === 0 ? '0' : worstBias.toExponential(3)}; bound 2^-32 = ${TWO_POW_M32.toExponential(3)})`
    + (biased.length ? ` — BIASED: ${biased.slice(0, 4).map((r) => `range ${r.range} maxFair ${r.maxFair} bias ${r.bias.toExponential(3)}`).join('; ')}` : '')
    + `; per-draw first-chunk rejection probability (2^32 − maxFair)/2^32 is at most ${worstReject.rejectProbability.toExponential(3)} (range ${worstReject.range}). `
    + `Rejection census over this population, counted on the draws that produced the shoes compared above: ${census.firstChunkRejected} first-chunk rejection(s) and ${census.cursorAdvanced} cursor advance(s) in ${census.draws.toLocaleString()} draws (${censusShoes.toLocaleString()} shoes × ${SHOE_SIZE - 1}), against ${censusExpected.toFixed(4)} expected — the capture does not exercise the branch, so it is shown on a vector instead: `
    + `nonce ${vec.nonce}, cursor ${vec.cursor}, range ${vec.range} (the committed Pass-1 seed pair) rejects its first chunk and draws ${vecGot} (expected ${vec.expected}; deleting the branch gives ${vec.withoutRejection}), and its full shoe records ${vecCensus.firstChunkRejected} first-chunk rejection(s) — ${vecOk ? 'OK' : 'FAIL'}. `
    + `This bounds the AUDITOR'S draw; that the operator's server takes the same branch is ASSUMED (MANIFEST DL-2).`;

  // ── Step 6, player-verifier parity arm (BLACKJACK-24) ────────────────────────────────────
  // The Blackjack verifier a player uses on the ProvablyFair.org site (VerifyBets
  // games/blackjack/derive.js + lib/hmac-sha256.js) is vendored byte-for-byte in verifier-parity/
  // and pinned by SHA-256 in src/config.ts SITE_VERIFIER_PINS. Its pure-JavaScript SHA-256 runs at
  // about 50 ms per round here, so it is NOT run on all 6,000 rounds; it is run on a declared,
  // deterministic sample chosen from the data before anything is compared: EVERY split round (the
  // order-sensitive case) and the first round (nonce 0) of EVERY epoch. On each, the site's
  // deriveBlackjackSync — the full action replay a player runs — must reproduce the recorded
  // player hands and dealer hand card for card, return per unit stake per hand equal to what this
  // package derives from the cards, and show the same first 24 shoe cards; on every epoch's first
  // round and on the rejection vector the site's full 416-card shoe must equal this package's.
  // A digest mismatch, a load error or one differing round FAILs the step.
  const site = loadSiteVerifier(path.join(__dirname, '../..'));
  const sample = bets.filter((b) => b.split || b.nonce === 0);
  let siteRounds = 0, siteBad = 0, siteShoes = 0, siteShoeBad = 0, siteHands = 0;
  const siteFirstBad: string[] = [];
  if (site.verifier) {
    for (const b of sample) {
      const ss = seedMap.get(b.hashedServerSeed);
      if (!ss || !b.clientSeed) { siteBad++; continue; }
      const got = site.verifier.deriveBlackjackSync({
        serverSeed: ss, clientSeed: b.clientSeed, nonce: b.nonce, actions: b.actions || [],
        sideBets: { perfectPairs: !!b.sideBets.perfectPair, twentyOnePlus3: !!b.sideBets.twentyOnePlusThree },
      });
      siteRounds++;
      const ours = blackjackShoe(ss, b.clientSeed, b.nonce).map(toSiteCard);
      const recHands = (b.playerHands || []).map((h) => (h.cards || []).map(toSiteCard));
      const recDealer = (b.dealerHand || []).map(toSiteCard);
      let ok = got.hands.length === recHands.length
        && got.hands.every((h, i) => JSON.stringify(h.cards) === JSON.stringify(recHands[i]))
        && JSON.stringify(got.dealer.cards) === JSON.stringify(recDealer)
        && got.isSplit === Boolean(b.split)
        && JSON.stringify(got._shoePreview) === JSON.stringify(ours.slice(0, got._shoePreview.length));
      if (ok) {
        for (let i = 0; i < got.hands.length; i++) {
          siteHands++;
          const h = b.playerHands[i];
          const want = returnRatio(h.cards, b.dealerHand || [], Boolean(b.split));
          if (got.hands[i].payout / got.hands[i].wager !== want) ok = false;
          // The recorded per-hand credit is the base portion; it must be the same ratio of the stake.
          const st = unitsOf(h.betAmount), cr = unitsOf(h.winningAmount);
          if (st === null || cr === null || cr * 2 !== Math.round(want * 2) * st) ok = false;
        }
      }
      if (b.nonce === 0) {
        siteShoes++;
        const full = site.verifier.blackjackShoe(ss, b.clientSeed, b.nonce);
        if (JSON.stringify(full) !== JSON.stringify(ours)) { siteShoeBad++; ok = false; }
      }
      if (!ok) { siteBad++; if (siteFirstBad.length < 3) siteFirstBad.push(`epoch ${b.epoch} nonce ${b.nonce}`); }
    }
    siteShoes++;
    const vecSite = site.verifier.blackjackShoe(vec.serverSeed, vec.clientSeed, vec.nonce);
    if (JSON.stringify(vecSite) !== JSON.stringify(vecShoe.map(toSiteCard))) { siteShoeBad++; siteBad++; siteFirstBad.push('rejection vector'); }
  }
  const sampleSplits = sample.filter((b) => b.split).length;
  const sampleEpochs = sample.filter((b) => b.nonce === 0).length;
  const siteOk = site.hashesOk && !!site.verifier && siteRounds === sample.length && siteBad === 0
    && sampleEpochs === EXPECTED_SEEDS && sampleSplits > 0;
  const siteDetail = `Player-verifier parity (ProvablyFair.org site VerifyBets games/blackjack/derive.js + lib/hmac-sha256.js, vendored in verifier-parity/ and pinned in src/config.ts SITE_VERIFIER_PINS): `
    + site.files.map((f) => `${f.file} sha256 ${f.sha256.slice(0, 16)}… ${f.ok ? 'matches its pin' : `≠ pin ${f.pinned.slice(0, 16)}…`}`).join('; ')
    + (site.verifier
      ? `; the site's deriveBlackjackSync replayed on a declared sample of ${siteRounds}/${sample.length} rounds (all ${sampleSplits} split rounds + the nonce-0 round of all ${sampleEpochs} epochs): recorded player and dealer hands card for card, the first 24 shoe cards, and return per unit stake on ${siteHands} hands equal to this package's derivation from the cards — ${siteBad} disagreement(s)${siteFirstBad.length ? ` (${siteFirstBad.join(', ')})` : ''}; the site's full 416-card shoe equals this package's on ${siteShoes - siteShoeBad}/${siteShoes} shoes (the ${sampleEpochs} epoch-first rounds and the rejection vector). Not run on the other ${(bets.length - sample.length).toLocaleString()} rounds (its pure-JavaScript SHA-256 costs ~50 ms per round); those are recomputed by this package's own engine above`
      : `; NOT RUN — ${site.error}`);

  // COVERAGE ASSERTION: `checked` must equal EXPECTED_HANDS — every hand of the DECLARED
  // population recomputed. It used to compare against `bets.length`, which is the file's own
  // row count: delete 50 rounds and the target moves with them, so the step printed
  // "5950/5950 hands … PASS". The expected N is the capture plan in src/config.ts.
  // An unrevealed (or nulled) server seed makes `seedMap.get` miss and the hand is skipped;
  // that is a hard FAIL, not a FLAG, because a partially-recomputed dataset cannot carry a
  // Full Pass. Previously a skip only FLAGged (→ "Conditional Pass"), which still reads as a
  // pass to a coverage-mutation gate.
  const s6 = step(6, 'Recomputation Parity',
    bad === 0 && skipped === 0 && checked === EXPECTED_HANDS && bets.length === EXPECTED_HANDS && actionInconsistent === 0 && grammarBad === 0 && biasOk && siteOk ? 'PASS' : 'FAIL',
    `${checked}/${EXPECTED_HANDS} hands recomputed from revealed seeds in exact draw order (${nonSplit} single-hand, ${splits} split) — ${bad} mismatch${bad === 1 ? '' : 'es'}` +
    (bets.length === EXPECTED_HANDS ? '' : `; POPULATION FAIL: the dataset carries ${bets.length} rounds, the capture plan declares ${EXPECTED_HANDS}`) +
    `; action/card cross-check: ${bets.length - actionInconsistent}/${bets.length} hands have hit+double tokens matching drawn cards, ${actionInconsistent} inconsistent` +
    `; action grammar (no token after a hand's last terminal, no \`double\` after a \`hit\`, \`no-ins\`/\`split\` only at the head, a hand ends without standing only on bust/21/split-ace/dealer natural, no \`stand\` on a busted hand — nor on a single hand that reached 21 — and \`bet.doubled\` agrees with the \`double\` tokens): ${bets.length - grammarBad}/${bets.length} rounds consistent, ${grammarBad} inconsistent` +
    (splitOrderBad ? `; ${splitOrderBad} split(s) failed strict order` : '') +
    (skipped ? `; COVERAGE FAIL: ${skipped} hand(s) skipped (unrevealed/nulled seed) — cannot Full Pass with < 100% recomputed` : '') +
    (actionFailures.length ? `; e.g. ${actionFailures.join('; ')}` : '') +
    (grammarFailures.length ? `; grammar e.g. ${grammarFailures.join('; ')}` : '') +
    (failures.length ? `; e.g. ${failures.join(', ')}` : '') +
    `. ${biasDetail} ${siteDetail}.`);

  // ── Step 7: Client-seed dependence, gated at the rate the model predicts ──────────────
  // Re-run a ≥ 1,000-round sample under a deliberately WRONG client seed and under an EMPTY client
  // seed (the control: a derivation that ignored the client seed would reproduce the deal under
  // both). The first card must change at the model rate — survivors ≤ E + 5σ with E = n/52 — and a
  // 0 % change is the degenerate case. Both are HARD FAILs: a client seed that does not feed the
  // derivation is a methodology-S2 failure, not a disclosable irregularity. (This replaced a fixed
  // "≥ 95 % changed" gate, which is not derived from anything.)
  //
  // The A–C epoch client seeds are bound to their declared form: every non-Phase-D epoch's client
  // seed must be `audit` + 12 lowercase hex and all must be distinct. SINCE 2026-09-25 the GENERATOR
  // is in the package too (BLACKJACK-06): capture/capture-liqd-blackjack.aug05-rig.mjs, pinned by
  // SHA-256 in src/config.ts, and src/capture-rig.ts binds it to the data — its generator lines
  // (crypto.getRandomValues → 'audit' + randHex(6); Phase D `pfaudit-${STAMP}-${E}`), every rotate()
  // call passing through it, Math.random confined to the demo renderer, its phase plan equal to the
  // dataset's phase of all 120 epochs, every seed in the generator's shape, one D stamp that is the
  // rig's start. The provenance is circumstantial (the rig was never committed) — MANIFEST DL-16.
  // The Phase D half is Step 26.
  let sampled = 0;
  let survivedWrong = 0;
  let survivedEmpty = 0;
  const bettable = bets.filter((b) => seedMap.get(b.hashedServerSeed) && b.clientSeed);
  const stride = Math.max(1, Math.floor(bettable.length / 1000));
  for (let i = 0; i < bettable.length; i += stride) {
    const b = bettable[i];
    const serverSeed = seedMap.get(b.hashedServerSeed) as string;
    const realFirst = (b.playerHands[0]?.cards || [])[0];
    sampled++;
    if (blackjackShoe(serverSeed, b.clientSeed + '_x', b.nonce)[0] === realFirst) survivedWrong++;
    if (blackjackShoe(serverSeed, '', b.nonce)[0] === realFirst) survivedEmpty++;
  }
  const model = collisionModel(sampled);
  const nonD = ctx.seeds.filter((sd) => sd.phase !== 'D');
  const formBad = nonD.filter((sd) => !/^audit[0-9a-f]{12}$/.test(sd.clientSeed)).length;
  const distinct = new Set(nonD.map((sd) => sd.clientSeed)).size;
  const formOk = nonD.length > 0 && formBad === 0 && distinct === nonD.length;
  const rig = checkCaptureRig(path.join(ctx.outputsDir, '..'), CAPTURE_RIG_SHA256, ctx.seeds, ctx.meta);
  const s7Ok = sampled >= 1000 && survivedWrong < sampled && survivedEmpty < sampled
    && survivedWrong <= model.bound && survivedEmpty <= model.bound && formOk && rig.ok;
  const s7 = step(7, 'Client-Seed Dependence', s7Ok ? 'PASS' : 'FAIL',
    `${sampled} rounds (every ${stride}th recomputable round) re-derived under a WRONG client seed and under an EMPTY client seed: the first card survives on ${survivedWrong} (wrong) and ${survivedEmpty} (empty), ` +
    `against the model rate 1/52 for an independent shoe — E = ${model.expected.toFixed(3)}, σ = ${model.sd.toFixed(3)}, gate E + 5σ = ${model.bound.toFixed(3)} — so the deal changes on ${sampled - survivedWrong}/${sampled} and ${sampled - survivedEmpty}/${sampled}` +
    (sampled < 1000 ? `; COVERAGE FAIL: ${sampled} < 1,000 sampled rounds` : '') +
    (survivedWrong > model.bound || survivedEmpty > model.bound ? '; FAIL: more first cards survive a changed client seed than an independent shoe allows — the client seed is not feeding the derivation as modelled' : '') +
    `; A–C/E/F epoch client seeds bound to their declared form: ${nonD.length - formBad}/${nonD.length} match /^audit[0-9a-f]{12}$/, ${distinct} distinct` +
    (formOk ? '' : ' — FORM FAIL') +
    `. THE GENERATOR: ${CAPTURE_RIG_FILE} ${rig.present ? `SHA-256 ${rig.sha256.slice(0, 12)}…${rig.pinOk ? ' = the src/config.ts pin' : ' ≠ the pin'}` : 'ABSENT'}; ` +
    `generator lines found ${rig.generatorLines.randHex}/1 randHex = crypto.getRandomValues (the global Web Crypto CSPRNG, \`crypto\` rebound ${rig.cryptoRebound}×), ${rig.generatorLines.clientSeedFor}/1 clientSeedFor = 'audit' + randHex(6) | pfaudit-STAMP-E, ${rig.generatorLines.stamp}/1 STAMP = Date.now(); ` +
    `${rig.rotateCallsWithGenerator}/${rig.rotateCalls} rotate() calls pass clientSeedFor(...); Math.random ${rig.mathRandomTotal}× in the file, ${rig.mathRandomOutsideDemo} outside the demo renderer; ` +
    `the rig's phase plan (${rig.planEpochs} epochs) equals the dataset's phase and seed tag on ${rig.planPhaseMatches}/${ctx.seeds.length} epochs; ` +
    `${rig.auditShapeOk}/${rig.auditSeeds} audit-tagged seeds have the randHex(6) shape, ${rig.pfauditShapeOk}/${rig.pfauditSeeds} Phase D seeds carry their own epoch and ${rig.stamps.length} stamp (${rig.stamps.join(', ')} = ${rig.stampIso}), ` +
    `${rig.timeOrderOk ? `${rig.stampToStartMs} ms before` : 'NOT before'} the dataset's meta.startedAt. Provenance CIRCUMSTANTIAL: the rig was never committed; the copy is byte-for-byte of an untracked workspace file modified ${CAPTURE_RIG_SOURCE_MTIME} (MANIFEST DL-16). Phase D is Step 26` +
    (rig.ok ? '' : ` — GENERATOR FAIL: ${rig.problems.join('; ')}`));

  return [s6, s7];
}
