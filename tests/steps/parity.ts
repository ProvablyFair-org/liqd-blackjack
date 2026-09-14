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
import { blackjackShoe } from '../../src/rng';
import { handValue, isBlackjack, rankOf, EXPECTED_HANDS } from '../../src/config';
import type { Bet } from '../../src/types';

/**
 * Action-grammar check (round-2 QA item 21).
 *
 * The count-only cross-check below (#hit + #double == extra cards) is necessary but not
 * sufficient: the reviewers showed `["hit"]` rewritten to `["stand","hit"]` leaves the count
 * intact and passed. So the token stream is also checked as a GRAMMAR. Returns a list of
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
 *       nonce 47, `["split","stand","stand"]`, totals 20 and 21), so LIQD's split UI logs a
 *       stand at 21 where the single-hand path does not. Asserting the tidy universal rule
 *       would have manufactured 14 false violations against real captured play.
 *   G6  `bet.doubled` is BOUND to the token stream: (#double > 0) === bet.doubled. `doubled`
 *       is an operator summary boolean and was checked against nothing, so relabelling a lost
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
    v.push(`bet.doubled=${Boolean(b.doubled)} but the action stream carries ${doubleTokens} \`double\` token(s) — the operator's summary flag disagrees with the log it summarises`);
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

    // ── Action GRAMMAR (round-2 QA item 21) ─────────────────────────────────────
    // The count above is order-blind: `["hit"]` rewritten to `["stand","hit"]` keeps the count
    // and passed. The grammar rejects a token after the round's last terminal, a `double` that
    // follows a `hit`, a misplaced `no-ins`/`split`, and a hand that stops without standing when
    // it could still have acted. See actionGrammarViolations() above.
    const gv = actionGrammarViolations(b);
    if (gv.length) {
      grammarBad++;
      if (grammarFailures.length < 5) grammarFailures.push(`nonce ${b.nonce} (epoch ${b.epoch}): ${gv[0]}`);
    }

    const serverSeed = seedMap.get(b.hashedServerSeed);
    if (!serverSeed || !b.clientSeed) { skipped++; continue; }
    const shoe = blackjackShoe(serverSeed, b.clientSeed, b.nonce);
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
  const s6 = step(6, 'Recomputation Parity',
    bad === 0 && skipped === 0 && checked === EXPECTED_HANDS && bets.length === EXPECTED_HANDS && actionInconsistent === 0 && grammarBad === 0 ? 'PASS' : 'FAIL',
    `${checked}/${EXPECTED_HANDS} hands recomputed from revealed seeds in exact draw order (${nonSplit} single-hand, ${splits} split) — ${bad} mismatch${bad === 1 ? '' : 'es'}` +
    (bets.length === EXPECTED_HANDS ? '' : `; POPULATION FAIL: the dataset carries ${bets.length} rounds, the capture plan declares ${EXPECTED_HANDS}`) +
    `; action/card cross-check: ${bets.length - actionInconsistent}/${bets.length} hands have hit+double tokens matching drawn cards, ${actionInconsistent} inconsistent` +
    `; action grammar (no token after a hand's last terminal, no \`double\` after a \`hit\`, \`no-ins\`/\`split\` only at the head, a hand ends without standing only on bust/21/split-ace/dealer natural, no \`stand\` on a busted hand — nor on a single hand that reached 21 — and \`bet.doubled\` agrees with the \`double\` tokens): ${bets.length - grammarBad}/${bets.length} rounds consistent, ${grammarBad} inconsistent` +
    (splitOrderBad ? `; ${splitOrderBad} split(s) failed strict order` : '') +
    (skipped ? `; COVERAGE FAIL: ${skipped} hand(s) skipped (unrevealed/nulled seed) — cannot Full Pass with < 100% recomputed` : '') +
    (actionFailures.length ? `; e.g. ${actionFailures.join('; ')}` : '') +
    (grammarFailures.length ? `; grammar e.g. ${grammarFailures.join('; ')}` : '') +
    (failures.length ? `; e.g. ${failures.join(', ')}` : ''));

  // ── Step 7: Client-seed dependence ──────────────────────────────────────────
  // Re-run sampled hands under a deliberately wrong client seed: the initial deal
  // should change (the client seed genuinely feeds the derivation).
  let sampled = 0;
  let changed = 0;
  const bettable = bets.filter((b) => seedMap.get(b.hashedServerSeed) && b.clientSeed);
  const stride = Math.max(1, Math.floor(bettable.length / 1000));
  for (let i = 0; i < bettable.length; i += stride) {
    const b = bettable[i];
    const serverSeed = seedMap.get(b.hashedServerSeed) as string;
    const wrong = blackjackShoe(serverSeed, b.clientSeed + '_x', b.nonce);
    const realFirst = (b.playerHands[0]?.cards || [])[0];
    sampled++;
    if (wrong[0] !== realFirst) changed++;
  }
  // COVERAGE: an empty sample (e.g. no revealed seeds) must not pass vacuously.
  const s7 = step(7, 'Client-Seed Dependence', sampled > 0 && changed >= sampled * 0.95 ? 'PASS' : 'FLAG',
    `${changed}/${sampled} sampled hands deal a different first card under a wrong client seed (collisions expected ~1/52)` +
    (sampled === 0 ? '; COVERAGE FAIL: 0 hands sampled (no revealed seeds)' : ''));

  return [s6, s7];
}
