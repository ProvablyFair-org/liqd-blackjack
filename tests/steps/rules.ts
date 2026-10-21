/**
 * Steps 11–14: House rules, read directly off the dataset (not assumed).
 *   11  Dealer stands on soft 17 (S17)
 *   12  Double-after-split allowed (DAS)
 *   13  Dealer peeks for blackjack on Ace/10 upcards
 *   14  No surrender
 */

import { step } from './context';
import type { StepResult, VerifyContext } from './context';
import { handValue, isBlackjack, dealerDrawsOn } from '../../src/config';

export function run(ctx: VerifyContext): StepResult[] {
  const { bets } = ctx;

  // ── Step 11: Dealer draw-rule compliance, replayed decision by decision ──────
  // Not merely "did any hand end on soft 17" — the dealer's every draw/stand is
  // replayed against S17 and both failure directions are tested:
  //
  //   over-draw : the dealer took a card while already holding 17 or more.
  //   under-draw: the dealer stopped below 17 while a live player hand remained.
  //
  // One legitimate exemption to the under-draw rule: a player natural blackjack
  // settles the round at 3:2 immediately, so the dealer never completes its hand.
  // That exemption is counted and reported, never silently applied.
  let dealerSoft17Final = 0;
  let overDraw = 0;
  let underDraw = 0;
  let earlySettle = 0;
  let replayed = 0;
  const violations: string[] = [];
  for (const b of bets) {
    const d = b.dealerHand || [];
    if (d.length < 2) continue;
    replayed++;
    const hv = handValue(d);
    if (hv.soft && hv.total === 17) dealerSoft17Final++;

    // Over-draw: before each drawn card the running hand must have been one the draw rule draws on
    // (src/config.ts dealerDrawsOn — below 17, S17 per RULES.s17).
    for (let i = 2; i < d.length; i++) {
      const before = handValue(d.slice(0, i));
      if (!dealerDrawsOn(before.total, before.soft)) {
        overDraw++;
        if (violations.length < 5) violations.push(`nonce ${b.nonce}: drew on ${handValue(d.slice(0, i)).total}`);
        break;
      }
    }

    // Under-draw: stopping on a hand the draw rule draws on is only legitimate when no live hand remained.
    if (dealerDrawsOn(hv.total, hv.soft)) {
      const live = b.playerHands.some((h) => handValue(h.cards).total <= 21);
      const playerNatural = !b.split && isBlackjack(b.playerHands[0]?.cards || []);
      if (!live) continue; // every player hand busted — nothing left to beat
      if (playerNatural) { earlySettle++; continue; } // 3:2 settled before the dealer drew
      underDraw++;
      if (violations.length < 5) violations.push(`nonce ${b.nonce}: stood on ${hv.total} vs a live hand`);
    }
  }
  // An over-draw (dealer took a card on 17+) or under-draw (stood below 17 with a live player
  // hand) is a dealing-rule VIOLATION, not a soft warning — it must not resolve to a
  // "Conditional Pass". Absence of soft-17 evidence is merely insufficient coverage (FLAG).
  const s11Violation = overDraw > 0 || underDraw > 0;
  const s11Ok = dealerSoft17Final > 0 && !s11Violation;
  const s11 = step(11, 'Dealer Stands on Soft 17 (S17)', s11Ok ? 'PASS' : s11Violation ? 'FAIL' : 'FLAG',
    `${replayed} dealer hands replayed against S17: ${overDraw} over-draws (took a card on 17+), ${underDraw} under-draws (stood below 17 with a live player hand); ` +
    `${dealerSoft17Final} hands finished on soft 17 — the dealer stood, confirming S17 rather than H17; ` +
    `${earlySettle} hands exempt (player natural blackjack settles 3:2 before the dealer draws)` +
    (violations.length ? `; e.g. ${violations.slice(0, 3).join('; ')}` : ''));

  // ── Step 12: Double-after-split (DAS) ───────────────────────────────────────
  // Derived from the ACTION TOKENS, not from `b.split && b.doubled`.
  //
  // `split` and `doubled` are SUMMARY booleans the capture script computed when it wrote the round
  // (split = two hand records, doubled = a double-bet record present), and establishing a house rule
  // by reading two of them contradicts this audit's own standing rule about summary fields — the
  // rule stated for `dealerPoints` on the very next page of the report. A summary flag is the
  // capture script's assertion about the round; the token stream is the log of what happened. So the
  // rule is read off the tokens (`split` present AND `double` present) and the two summary
  // booleans are then required to AGREE. They agree on every round of this capture: 165 rounds
  // carry both tokens, 165 rounds carry both booleans; 401 rounds carry the `split` token and
  // 401 carry `split: true`.
  //
  // Step 6's grammar (G1, G6) independently binds each boolean to its token, so a disagreement
  // also fails there; this step states the derivation locally instead of relying on that.
  const hasTok = (b: (typeof bets)[number], t: string): boolean => (b.actions || []).includes(t);
  const dasHands = bets.filter((b) => hasTok(b, 'split') && hasTok(b, 'double')).length;
  const splits = bets.filter((b) => hasTok(b, 'split')).length;
  const dasByFlags = bets.filter((b) => b.split && b.doubled).length;
  const splitsByFlags = bets.filter((b) => b.split).length;
  const flagsAgree = dasHands === dasByFlags && splits === splitsByFlags;
  const s12 = step(12, 'Double-After-Split Allowed (DAS)', dasHands > 0 && flagsAgree ? 'PASS' : 'FLAG',
    `${dasHands} of ${splits} split rounds carry both a \`split\` and a \`double\` action token ⇒ DAS allowed. ` +
    `Derived from the action stream, not from the capture script's \`split\`/\`doubled\` summary booleans; those booleans are required to agree and do (${dasByFlags} of ${splitsByFlags})` +
    (flagsAgree ? '' : `; FLAG: summary booleans disagree with the token stream`) +
    (dasHands === 0 ? '; COVERAGE FLAG: no doubled split round observed — DAS availability not witnessed' : ''));

  // ── Step 13: Dealer peek ────────────────────────────────────────────────────
  const dealerBJ = bets.filter((b) => (b.dealerHand || []).length === 2 && handValue(b.dealerHand).total === 21);
  const peeked = dealerBJ.filter((b) => (b.actions || []).filter((a) => a !== 'no-ins').length === 0);
  const s13 = step(13, 'Dealer Peeks for Blackjack', dealerBJ.length > 0 && peeked.length === dealerBJ.length ? 'PASS' : 'FLAG',
    `${dealerBJ.length} dealer blackjacks, all settled with no player play action (peek on Ace/10) — ${peeked.length}/${dealerBJ.length}`);

  // ── Step 14: No surrender action observed ───────────────────────────────────
  // This proves that no `surrender` token appears across the capture — NOT that surrender was
  // unavailable. The capture script has no surrender call (neither its endpoint list nor its
  // strategy has one), so "never offered" cannot be separated from "offered and never used".
  // The action vocabulary in the dataset is hit, stand, double, no-ins, split. `no-ins` is the
  // capture's decline request, `place-insurance-bet {betAmount: 0}`; the casino booked a funded,
  // settled insurance bet on every round that carries it. LIQD's own UI declines with
  // `{acceptInsurance: false}` (evidence E24), a request the capture never sent (MANIFEST DL-17).
  const surrender = bets.filter((b) => (b.actions || []).some((a) => /surrender/i.test(a))).length;
  const noIns = bets.filter((b) => (b.actions || []).some((a) => /no-ins/i.test(a))).length;
  const noInsFunded = bets.filter((b) =>
    (b.actions || []).some((a) => /no-ins/i.test(a)) && !!(b.sideBets && (b.sideBets as Record<string, unknown>).insurance)).length;
  const s14 = step(14, 'No Surrender Action Observed', surrender === 0 ? 'PASS' : 'FLAG',
    `${surrender} surrender actions across ${bets.length} rounds; the capture script has no surrender call, so this step shows only that surrender was never TAKEN, not whether the casino offers it. ` +
    `The action vocabulary is hit, stand, double, no-ins, split. no-ins is the capture's decline request (place-insurance-bet {betAmount: 0}); ` +
    `the casino booked a funded bet on ${noInsFunded} of ${noIns}. LIQD's own UI declines with {acceptInsurance: false} (E24), which the capture never sent (MANIFEST DL-17).`);

  return [s11, s12, s13, s14];
}
