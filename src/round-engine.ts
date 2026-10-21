/**
 * One round of LIQD blackjack, played to settlement under the audited basic-strategy table.
 *
 * WHY THIS MODULE EXISTS — AND WHY IT IS NO LONGER A SECOND COPY.
 *
 * This logic used to be written out twice: here, and again inside `src/simulate.ts`. That was a
 * deliberate, disclosed duplicate. `src/simulate.ts` is a top-level script — it starts a 30M-round
 * Monte-Carlo on import, so nothing could import a function out of it — and
 * `outputs/simulation-results.json` was FROZEN and hash-pinned, so a refactor of the instrument
 * that produced the frozen artifact could not be re-run to prove it behaviour-preserving. A copy
 * that a test binds was the lesser risk of the two.
 *
 * That trade-off expired when the artifact was regenerated to close the missing-replay-inputs
 * finding (September 2026). The simulation is now produced by pure, importable pass functions in
 * `src/replay.ts`, which call THIS `playRound` — so the simulator, the replay tool, the scored
 * steps and `src/cherry-pick-attack.ts` all settle rounds through one implementation, and the
 * agreement between a run and its replay is a statement about the artifact rather than about
 * whether two copies of the rules drifted.
 *
 * The engine is still BOUND rather than trusted: `tests/blackjack/roundEngineTests.ts`
 * runs this engine over a fair 8-deck shuffle and requires its RTP to agree with the exact 8-deck
 * TD solve (`src/exact-play.ts`) within **5σ, per initial bet** — ONE convention, an acceptance
 * window of 5 × 1.15 / √2,000,000 × 100 = 0.4065864 percentage points. If this engine drifted
 * from the audited strategy, that test fails. The strategy table itself is
 * imported from `src/strategy.ts`, the single source of truth that `exact-play.ts` also uses.
 *
 * Rules encoded: 8 decks, S17, DAS, split-aces-one-card, no re-split, dealer peek/OBO, double on
 * any two, blackjack 3:2.
 */

import { pairAction, softAction, hardAction } from './strategy';
import { RULES, BLACKJACK_PAYS, dealerDrawsOn } from './config';

// The engine implements the rule VALUES below; a RULES entry it has no code path for is refused at
// load, never silently played under a different rule (BLACKJACK-26: the rule set is single-sourced
// in src/config.ts, so a change there must either take effect here or stop the run).
if (!RULES.peek || RULES.maxHandsAfterSplit !== 2 || RULES.splitTwentyOneIsNatural || RULES.surrender) {
  throw new Error('src/round-engine.ts implements peek, one split, split-21-is-not-a-natural and no surrender only — src/config.ts RULES asks for a rule it has no code path for');
}
/** Natural return per unit staked, stake included: 1 + 3/2 = 2.5. */
const NATURAL_RETURN = 1 + BLACKJACK_PAYS;

/** Hand total with soft-ace reduction. Returns [total, soft]. */
export function totalOf(cards: number[]): [number, boolean] {
  let t = 0, aces = 0;
  for (const v of cards) { t += v; if (v === 11) aces++; }
  while (t > 21 && aces > 0) { t -= 10; aces--; }
  return [t, aces > 0];
}

/** Play one non-split hand; canDouble gates the first-move double. Returns [finalTotal, betUnits]. */
function playHand(cards: number[], up: number, canDouble: boolean, draw: () => number): [number, number] {
  const bet = 1;
  for (;;) {
    const [t, soft] = totalOf(cards);
    if (t > 21) return [t, bet];
    const a = soft ? softAction(t, up) : hardAction(t, up);
    if (a === 'D' || a === 'Ds') {
      if (cards.length === 2 && canDouble) { cards.push(draw()); return [totalOf(cards)[0], 2]; }
      if (a === 'Ds') return [t, bet];
      cards.push(draw()); continue;                        // D with no double → hit
    }
    if (a === 'S') return [t, bet];
    cards.push(draw());                                    // hit
  }
}

function dealerPlay(cards: number[], draw: () => number): number {
  // The draw rule is src/config.ts dealerDrawsOn (S17 from RULES.s17), shared with Step 11.
  for (;;) { const [t, soft] = totalOf(cards); if (dealerDrawsOn(t, soft)) cards.push(draw()); else return t; }
}

/**
 * Play a full round from the four dealt values plus the two player-card RANKS (pair detection is
 * rank-based, matching Step 27's value-based split observation only where ranks coincide).
 * Returns [wagered, returned] in units of the initial bet.
 */
export function playRound(
  p0: number, up: number, p1: number, hole: number, rp0: number, rp1: number, draw: () => number,
): [number, number] {
  const playerBJ = p0 + p1 === 21;
  const dealerBJ = up + hole === 21 && (up === 11 || hole === 11);

  // US peek / OBO: a dealer natural resolves before the player risks anything extra.
  if (RULES.peek && (up === 11 || up === 10)) {
    if (dealerBJ) return [1, playerBJ ? 1 : 0];
  }
  if (playerBJ) return [1, NATURAL_RETURN];                 // player natural, dealer not BJ → 3:2 (RULES.blackjackPays)

  const results: [number, number][] = [];
  const pv = rp0 === 1 ? 11 : rp0 >= 10 ? 10 : rp0;
  if (p0 === p1 && rp0 === rp1 && pairAction(pv, up) === 'P') {
    if (pv === 11 && RULES.splitAcesOneCard) {              // split aces: one card each, no further action
      results.push([totalOf([11, draw()])[0], 1]);
      results.push([totalOf([11, draw()])[0], 1]);
    } else {
      results.push(playHand([p0, draw()], up, RULES.das, draw)); // DAS per RULES.das
      results.push(playHand([p1, draw()], up, RULES.das, draw));
    }
  } else {
    results.push(playHand([p0, p1], up, RULES.doubleAnyTwo, draw));
  }

  let wager = 0;
  for (const [, b] of results) wager += b;
  const anyLive = results.some(([t]) => t <= 21);
  const dTot = anyLive ? dealerPlay([up, hole], draw) : 0;

  let ret = 0;
  for (const [t, b] of results) {
    if (t > 21) continue;                                   // bust → lose
    if (dTot > 21 || t > dTot) ret += 2 * b;                // win
    else if (t === dTot) ret += 1 * b;                      // push
  }
  return [wager, ret];
}

const rankOfCard = (card: string): number => Number(card.slice(card.indexOf(':') + 1));
const valOfCard = (card: string): number => { const r = rankOfCard(card); return r === 1 ? 11 : r >= 10 ? 10 : r; };

/**
 * Settle one round dealt PDPD, reading each card ON DEMAND from `card(i)`.
 *
 * This entry point exists because a round has NO bounded depth. Pre-shuffling a fixed 24-card
 * prefix, on the premise that "a round never consumes more", would be unsound: a valid eight-deck
 * round of two 12-card split hands against a nine-card dealer hand reads through index 32, so the
 * tail beyond such a prefix would be read unshuffled. A caller
 * that supplies a lazily shuffled source here cannot have that problem at any depth: the card is
 * shuffled at the moment it is requested.
 */
export function settleShoeAt(card: (i: number) => string): [number, number] {
  let ptr = 4;
  const draw = (): number => valOfCard(card(ptr++));
  return playRound(
    valOfCard(card(0)), valOfCard(card(1)), valOfCard(card(2)), valOfCard(card(3)),
    rankOfCard(card(0)), rankOfCard(card(2)), draw,
  );
}

/** Settle one round dealt PDPD off an already-shuffled 416-card shoe. Returns [wagered, returned]. */
export function settleShoe(shoe: string[]): [number, number] {
  return settleShoeAt((i) => shoe[i]);
}
