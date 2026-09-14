/**
 * One round of LIQD blackjack, played to settlement under the audited basic-strategy table.
 *
 * WHY THIS MODULE EXISTS, AND WHY IT IS A SECOND COPY.
 *
 * The same logic lives inside `src/simulate.ts`, which is a top-level script: it runs a 30M-round
 * Monte-Carlo on import, so nothing can import a function out of it. `src/cherry-pick-attack.ts`
 * needs to settle rounds too, and the honest options were (a) lift the logic out of simulate.ts
 * into this module and have simulate.ts import it, or (b) copy it.
 *
 * (a) is the better engineering and is NOT what was done, deliberately. `outputs/simulation-
 * results.json` is FROZEN and hash-pinned; regenerating it is forbidden after the freeze (it
 * would move every simulation figure the report cites, within Monte-Carlo error, for no reason).
 * So a refactor of simulate.ts could not be re-run to prove it was behaviour-preserving, and an
 * unverifiable refactor of the instrument that produced the frozen artifact is a worse risk than
 * a disclosed duplicate.
 *
 * The duplicate is therefore BOUND rather than trusted: `tests/blackjack/roundEngineTests.ts`
 * runs this engine over a fair 8-deck shuffle and requires its RTP to agree with the exact 8-deck
 * TD solve (`src/exact-play.ts`) within **5σ, per initial bet** — ONE convention, an acceptance
 * window of 5 × 1.15 / √2,000,000 × 100 = 0.4065864 percentage points. (This paragraph read "3σ,
 * in both conventions" through round 3, and the test had never done either: round-4 QA-05.) If
 * this copy drifted from the audited strategy, that test fails. The strategy table itself is NOT
 * duplicated — it is imported from `src/strategy.ts`, the single source of truth that
 * `simulate.ts` and `exact-play.ts` also import.
 *
 * Rules encoded, identical to simulate.ts: 8 decks, S17, DAS, split-aces-one-card, no re-split,
 * dealer peek/OBO, double on any two, blackjack 3:2.
 */

import { pairAction, softAction, hardAction } from './strategy';

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
  for (;;) { const [t] = totalOf(cards); if (t < 17) cards.push(draw()); else return t; }  // S17
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
  if (up === 11 || up === 10) {
    if (dealerBJ) return [1, playerBJ ? 1 : 0];
  }
  if (playerBJ) return [1, 2.5];                            // player natural, dealer not BJ → 3:2

  const results: [number, number][] = [];
  const pv = rp0 === 1 ? 11 : rp0 >= 10 ? 10 : rp0;
  if (p0 === p1 && rp0 === rp1 && pairAction(pv, up) === 'P') {
    if (pv === 11) {                                        // split aces: one card each, no further action
      results.push([totalOf([11, draw()])[0], 1]);
      results.push([totalOf([11, draw()])[0], 1]);
    } else {
      results.push(playHand([p0, draw()], up, true, draw)); // DAS allowed
      results.push(playHand([p1, draw()], up, true, draw));
    }
  } else {
    results.push(playHand([p0, p1], up, true, draw));
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
 * This entry point exists because a round has NO bounded depth (round-4 QA-03). The binding test
 * used to pre-shuffle a fixed 24-card prefix on the stated premise that "a round never consumes
 * more"; a valid eight-deck round of two 12-card split hands against a nine-card dealer hand
 * reads through index 32, so that premise is false and the tail it read was unshuffled. A caller
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
