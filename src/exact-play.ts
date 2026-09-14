/**
 * LIQD Blackjack — exact EV solver, parameterised on the shoe model.
 *
 * One engine, two modes:
 *   {kind:'infinite'}          — each draw independent at 1/13 (4/13 for T).
 *                                Exact for a with-replacement RNG that picks `value % 52`.
 *   {kind:'finite', decks: 8}  — a real 416-card shoe dealt WITHOUT replacement,
 *                                reshuffled every hand. Exact for LIQD, whose
 *                                RNG is a Fisher-Yates shuffle over 8 decks.
 *
 * and two strategies:
 *   'TD' — actions read from src/strategy.ts, the table simulate.ts plays.
 *          This is the simulation's exact target.
 *   'CD' — actions chosen by argmax at every state (composition-dependent
 *          optimal). The true optimal floor, and the independent check on the
 *          table: sim and solver share strategy.ts and could share a bug in it,
 *          but CD ignores the table entirely.
 *
 * ── The split EV: one scoped derivation, and what it does and does not assume ──
 *
 * The identity this solver uses for a split is
 *
 *     EV_split(x,x vs u) = 2 × EV_hand(start = [x], up = u, comp − {x,x,u})
 *
 * Round-4 QA-06 replaced two conflicting paragraphs here — one asserting the identity was
 * "exact, not an approximation", the next hedging it as an approximation with no stated error
 * bound. Neither is a derivation, and agreement with `anchor/oracle.py` cannot settle it: that
 * oracle plays splits SEQUENTIALLY against a physically depleted shoe, but the two engines were
 * written by the same team, so the argument has to stand on its own. It is set out here with its
 * assumptions named, and the numerical results are unchanged.
 *
 * ASSUMPTIONS, in the order they are used:
 *
 *   A1. NO RE-SPLIT. LIQD splits to two hands only, so the number of hands is fixed at 2 and
 *       there is no branching over how many hands exist. This is a confirmed rule of the game
 *       (and, where it is not directly observed, a disclosed limitation — see L5); it is not a
 *       modelling convenience.
 *   A2. FIXED, TOTAL-DEPENDENT STRATEGY, and the INFORMATION each hand may use. Both hands are
 *       played by the same policy read from `src/strategy.ts`, whose argument is (own total,
 *       soft/hard, dealer upcard). No decision on the second hand may depend on which cards the
 *       first hand drew. This is what makes the second hand's decision rule identical to the
 *       first's, and it is a MODELLING CHOICE that matches the headline figure's definition
 *       (basic strategy), not an unavoidable truth about blackjack.
 *   A3. EXCHANGEABILITY of the shoe. In a shuffled shoe, the cards dealt after any stopping time
 *       are exchangeable with the cards dealt first, so — under A2 — the second hand faces the
 *       same predictive distribution over its next card as the first hand did. The two hands are
 *       CORRELATED (shared dealer, shared shoe), but correlation does not move the expectation of
 *       a SUM: E[X₁ + X₂] = E[X₁] + E[X₂] holds without independence, and A2 plus A3 give
 *       E[X₂] = E[X₁]. That is the whole of the "× 2".
 *   A4. HOLE-CARD CONDITIONING. Under peek/OBO with upcard A or T, the hole is a single unseen
 *       card restricted to the non-natural ranks. Its posterior stays proportional to the current
 *       unseen counts over those ranks whatever the player draws (the draw likelihoods cancel),
 *       so composition remains sufficient state and the hole is mixed over only at settlement.
 *       See the section below.
 *
 * WHAT IS EXACT AND WHAT IS NOT, kept separate.
 *
 *   • The HEADLINE model is TOTAL-DEPENDENT over a finite 8-deck shoe. Within that model the
 *     identity above is EXACT: A1 removes the branching, A2 fixes the policy, A3 equates the two
 *     hands' expectations, and linearity of expectation does the rest. `edgePerInitialBet` and
 *     `edgePerTotalWagered` are exact values OF THIS MODEL, computed by dynamic programming over
 *     the shoe composition with no sampling error.
 *   • A COMPOSITION-DEPENDENT model is a different model. There, a second hand that could see
 *     the first hand's cards would sometimes deviate, so 2 × EV_hand is a LOWER BOUND on an
 *     optimal composition-dependent split rather than an identity. This solver does not claim
 *     that model's value, and the CD mode it does offer is a coarse diagnostic on the strategy
 *     table (see 'CD' above), not a bound on the split residual.
 *   • THE ERROR THIS AUDIT DOES NOT BOUND: the difference between the two models on split rounds.
 *     No error bound is asserted for it and none is derived. What is stated instead is scope —
 *     splits are ~2.5 % of rounds, and every published figure is labelled as the total-dependent
 *     basic-strategy edge, which is also the convention the external Wizard of Odds anchor uses.
 *
 * CORROBORATION, at its real strength: `anchor/oracle.py` reaches the same numbers for specified
 * split cases by SEQUENTIAL physical play (a concrete hole card, a genuinely depleted shoe, no
 * conditional probability anywhere). That is evidence the identity is being APPLIED correctly and
 * that the arithmetic is right. It is not independent evidence for A2 or A3, because the oracle
 * assumes the same policy and the same information rule. Recorded as L13.
 *
 * ── Peek, handled exactly ─────────────────────────────────────────────────────
 * With upcard u in {A,T} the hole card is a single unseen card constrained to the
 * non-natural ranks. The hole-card posterior stays proportional to the current
 * unseen counts over those ranks no matter what the player draws (the draw
 * likelihoods cancel), so the composition is sufficient state and no mixture has
 * to be carried through the recursion. The hole is only mixed over at settlement.
 */

import { pairAction, resolvedAction } from './strategy';

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'A'] as const;
export type Rank = typeof RANKS[number];
export const RIDX: Record<Rank, number> = {
  '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, T: 8, A: 9,
};
/** Blackjack value of each rank index; A counts 11 here and is demoted as needed. */
const VAL = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const T_IDX = 8, A_IDX = 9;

export type ShoeModel = { kind: 'infinite' } | { kind: 'finite'; decks: number };
export type Strategy = 'TD' | 'CD';

export interface Rules {
  s17: boolean;          // dealer stands on soft 17
  das: boolean;          // double after split
  peek: boolean;         // dealer peeks for blackjack on A/T (OBO if false)
  blackjackPays: number; // 1.5 = 3:2, 1.2 = 6:5
  splitAcesOneCard: boolean;
  doubleAnyTwo: boolean;
}

export const LIQD_RULES: Rules = {
  s17: true, das: true, peek: true, blackjackPays: 1.5,
  splitAcesOneCard: true, doubleAnyTwo: true,
};

/** Remaining-card counts by rank index. Infinite mode carries a nominal shoe. */
type Counts = Int32Array;

function fullShoe(model: ShoeModel): Counts {
  const c = new Int32Array(10);
  if (model.kind === 'infinite') {
    // Nominal 1-deck shape; probabilities never consult it in infinite mode.
    for (let i = 0; i < 10; i++) c[i] = i === T_IDX ? 16 : 4;
    return c;
  }
  const d = model.decks;
  for (let i = 0; i < 10; i++) c[i] = (i === T_IDX ? 16 : 4) * d;
  return c;
}

const sum = (c: Counts): number => {
  let n = 0;
  for (let i = 0; i < 10; i++) n += c[i];
  return n;
};

/**
 * Probability of drawing rank i from the current shoe. Infinite mode ignores the
 * counts entirely — that is the whole difference between the two models.
 */
function pDraw(c: Counts, n: number, i: number, model: ShoeModel): number {
  if (model.kind === 'infinite') return i === T_IDX ? 4 / 13 : 1 / 13;
  return n > 0 ? c[i] / n : 0;
}

/** Add a card to a running (total, soft) pair, demoting an ace if it busts. */
function addCard(total: number, soft: boolean, i: number): [number, boolean] {
  let t = total, s = soft;
  if (i === A_IDX) {
    if (t + 11 <= 21) { t += 11; s = true; } else { t += 1; }
  } else {
    t += VAL[i];
    if (t > 21 && s) { t -= 10; s = false; }
  }
  return [t, s];
}

// ── Engine ────────────────────────────────────────────────────────────────────

export class ExactSolver {
  private readonly model: ShoeModel;
  private readonly rules: Rules;
  private readonly strategy: Strategy;
  private readonly shoe: Counts;

  private dealerMemo = new Map<string, Float64Array>();
  private handMemo = new Map<string, number>();

  constructor(model: ShoeModel, strategy: Strategy, rules: Rules = LIQD_RULES) {
    this.model = model;
    this.rules = rules;
    this.strategy = strategy;
    this.shoe = fullShoe(model);
  }

  /** Memo key for the shoe state. Infinite mode has no state, so a constant. */
  private key(c: Counts): string {
    if (this.model.kind === 'infinite') return '';
    let k = '';
    for (let i = 0; i < 10; i++) k += c[i].toString(36) + '.';
    return k;
  }

  /**
   * Dealer final-total distribution as a 24-slot array indexed by total
   * (17..21 used, 22 = bust; index 23 = natural, handled by the caller).
   * Drawn without replacement from `c`, S17 or H17 per rules.
   */
  private dealerDist(c: Counts, total: number, soft: boolean): Float64Array {
    const k = `${this.key(c)}|${total}|${soft ? 1 : 0}`;
    const hit = this.dealerMemo.get(k);
    if (hit) return hit;

    const out = new Float64Array(24);
    if (total > 21) { out[22] = 1; this.dealerMemo.set(k, out); return out; }
    const standsHere = total >= 18
      || (total === 17 && (!soft || this.rules.s17));
    if (standsHere && total >= 17) { out[total] = 1; this.dealerMemo.set(k, out); return out; }

    const n = sum(c);
    for (let i = 0; i < 10; i++) {
      const p = pDraw(c, n, i, this.model);
      if (p <= 0) continue;
      const [t2, s2] = addCard(total, soft, i);
      if (this.model.kind === 'finite') c[i]--;
      const sub = this.dealerDist(c, t2, s2);
      if (this.model.kind === 'finite') c[i]++;
      for (let j = 17; j <= 22; j++) if (sub[j]) out[j] += p * sub[j];
    }
    this.dealerMemo.set(k, out);
    return out;
  }

  /**
   * Dealer outcome distribution given an upcard, mixing over the unseen hole card.
   * Returns { pNatural, dist } where dist is conditional on NO dealer natural.
   */
  private dealerOutcome(c: Counts, up: number): { pNatural: number; dist: Float64Array } {
    const k = `${this.key(c)}|up${up}`;
    const cached = this.outcomeMemo.get(k);
    if (cached) return cached;

    const n = sum(c);
    const natRank = up === A_IDX ? T_IDX : up === T_IDX ? A_IDX : -1;
    const pNat = natRank >= 0 ? pDraw(c, n, natRank, this.model) : 0;

    const dist = new Float64Array(24);
    // Hole is a single unseen card. If the dealer could have a natural and does
    // not, it is constrained to the non-completing ranks; the posterior is
    // proportional to the remaining counts over those ranks.
    const denom = natRank >= 0 ? 1 - pNat : 1;
    for (let h = 0; h < 10; h++) {
      if (h === natRank) continue;
      const pH = pDraw(c, n, h, this.model) / (denom > 0 ? denom : 1);
      if (pH <= 0) continue;
      const [t, s] = addCard(...(addCard(0, false, up) as [number, boolean]), h);
      if (this.model.kind === 'finite') c[h]--;
      const sub = this.dealerDist(c, t, s);
      if (this.model.kind === 'finite') c[h]++;
      for (let j = 17; j <= 22; j++) if (sub[j]) dist[j] += pH * sub[j];
    }
    const res = { pNatural: pNat, dist };
    this.outcomeMemo.set(k, res);
    return res;
  }
  private outcomeMemo = new Map<string, { pNatural: number; dist: Float64Array }>();

  /**
   * EV of standing on `total`.
   *
   * `hole >= 0` means the dealer's hole card is a KNOWN concrete card that has
   * already been removed from `c` — the hole-explicit peek branch (see `solve`).
   * The dealer then simply plays out from (up + hole) against the depleted shoe
   * and no conditioning appears anywhere below this point.
   *
   * `hole < 0` is the unpeeked path: the hole is unseen and mixed at settlement.
   * That is only sound when nothing has been conditioned on, which is why it is
   * now reached exclusively for upcards that cannot make a natural.
   */
  private standEV(c: Counts, total: number, up: number, hole: number): number {
    if (total > 21) return -1;
    if (hole >= 0) {
      const [dt, ds] = addCard(...(addCard(0, false, up) as [number, boolean]), hole);
      const dist = this.dealerDist(c, dt, ds);
      let ev = 0;
      for (let j = 17; j <= 22; j++) {
        const p = dist[j];
        if (!p) continue;
        if (j === 22) ev += p;
        else if (total > j) ev += p;
        else if (total < j) ev -= p;
      }
      return ev;
    }
    const { dist } = this.dealerOutcome(c, up);
    let ev = 0;
    for (let j = 17; j <= 22; j++) {
      const p = dist[j];
      if (!p) continue;
      if (j === 22) ev += p;
      else if (total > j) ev += p;
      else if (total < j) ev -= p;
    }
    return ev;
  }

  /**
   * EV of playing out a hand. `canDouble` gates the first-move double;
   * `oneCardOnly` implements split aces.
   */
  private handEV(
    c: Counts, total: number, soft: boolean, up: number,
    canDouble: boolean, oneCardOnly: boolean, hole: number,
  ): number {
    if (total > 21) return -1;
    if (oneCardOnly) return this.standEV(c, total, up, hole);

    const k = `${this.key(c)}|${total}|${soft ? 1 : 0}|${up}|${canDouble ? 1 : 0}|h${hole}`;
    const hit = this.handMemo.get(k);
    if (hit !== undefined) return hit;

    const evStand = this.standEV(c, total, up, hole);
    const n = sum(c);

    // Hit EV
    let evHit = 0;
    for (let i = 0; i < 10; i++) {
      const p = pDraw(c, n, i, this.model);
      if (p <= 0) continue;
      const [t2, s2] = addCard(total, soft, i);
      if (this.model.kind === 'finite') c[i]--;
      evHit += p * (t2 > 21 ? -1 : this.handEV(c, t2, s2, up, false, false, hole));
      if (this.model.kind === 'finite') c[i]++;
    }

    // Double EV (one card, then stand, two units)
    let evDouble = -Infinity;
    if (canDouble) {
      let e = 0;
      for (let i = 0; i < 10; i++) {
        const p = pDraw(c, n, i, this.model);
        if (p <= 0) continue;
        const [t2] = addCard(total, soft, i);
        if (this.model.kind === 'finite') c[i]--;
        e += p * (t2 > 21 ? -1 : this.standEV(c, t2, up, hole));
        if (this.model.kind === 'finite') c[i]++;
      }
      evDouble = 2 * e;
    }

    let ev: number;
    if (this.strategy === 'CD') {
      ev = Math.max(evStand, evHit, canDouble ? evDouble : -Infinity);
    } else {
      const a = resolvedAction(total, soft, VAL[up], canDouble);
      ev = a === 'S' ? evStand : a === 'D' ? evDouble : evHit;
    }
    this.handMemo.set(k, ev);
    return ev;
  }

  /** Total units wagered by a hand played to completion (1, or 2 if it doubles). */
  private handWager(
    c: Counts, total: number, soft: boolean, up: number,
    canDouble: boolean, oneCardOnly: boolean, hole: number,
  ): number {
    if (total > 21 || oneCardOnly) return 1;
    const n = sum(c);
    if (this.strategy === 'CD') {
      // Re-derive the CD action to know whether it doubles.
      const evStand = this.standEV(c, total, up, hole);
      let evHit = 0, evDouble = -Infinity;
      for (let i = 0; i < 10; i++) {
        const p = pDraw(c, n, i, this.model);
        if (p <= 0) continue;
        const [t2, s2] = addCard(total, soft, i);
        if (this.model.kind === 'finite') c[i]--;
        evHit += p * (t2 > 21 ? -1 : this.handEV(c, t2, s2, up, false, false, hole));
        if (this.model.kind === 'finite') c[i]++;
      }
      if (canDouble) {
        let e = 0;
        for (let i = 0; i < 10; i++) {
          const p = pDraw(c, n, i, this.model);
          if (p <= 0) continue;
          const [t2] = addCard(total, soft, i);
          if (this.model.kind === 'finite') c[i]--;
          e += p * (t2 > 21 ? -1 : this.standEV(c, t2, up, hole));
          if (this.model.kind === 'finite') c[i]++;
        }
        evDouble = 2 * e;
      }
      if (canDouble && evDouble >= evStand && evDouble >= evHit) return 2;
      if (evStand >= evHit) return 1;
    } else {
      const a = resolvedAction(total, soft, VAL[up], canDouble);
      if (a === 'D') return 2;
      if (a === 'S') return 1;
    }
    // Hitting: wager stays 1 regardless of how many cards follow.
    return 1;
  }

  /** EV of splitting a pair of rank `r`, exact under no-resplit (see header). */
  private splitEV(c: Counts, r: number, up: number, hole: number): { ev: number; wager: number } {
    const acesOneCard = r === A_IDX && this.rules.splitAcesOneCard;
    const canDouble = this.rules.das && !acesOneCard;
    const n = sum(c);
    let ev = 0, wager = 0;
    for (let i = 0; i < 10; i++) {
      const p = pDraw(c, n, i, this.model);
      if (p <= 0) continue;
      const [t2, s2] = addCard(...(addCard(0, false, r) as [number, boolean]), i);
      if (this.model.kind === 'finite') c[i]--;
      ev += p * this.handEV(c, t2, s2, up, canDouble, acesOneCard, hole);
      wager += p * this.handWager(c, t2, s2, up, canDouble, acesOneCard, hole);
      if (this.model.kind === 'finite') c[i]++;
    }
    return { ev: 2 * ev, wager: 2 * wager };
  }

  /** EV and wager for the player's two cards against an upcard, no naturals. */
  private initialEV(c: Counts, p1: number, p2: number, up: number, hole: number): { ev: number; wager: number } {
    const [t, s] = addCard(...(addCard(0, false, p1) as [number, boolean]), p2);

    let best = {
      ev: this.handEV(c, t, s, up, true, false, hole),
      wager: this.handWager(c, t, s, up, true, false, hole),
    };

    if (p1 === p2) {
      const pv = p1 === A_IDX ? 11 : VAL[p1];
      const splits = this.strategy === 'CD'
        ? true                                   // CD decides by EV
        : pairAction(pv, VAL[up]) === 'P';       // TD reads the table
      if (splits) {
        const sp = this.splitEV(c, p1, up, hole);
        if (this.strategy === 'CD') {
          if (sp.ev > best.ev) best = sp;
        } else {
          best = sp;
        }
      }
    }
    return best;
  }

  /**
   * Exact result over every initial deal, enumerated without replacement.
   * Returns EV per initial bet, per total wagered, and E[total wager].
   */
  solve(): ExactResult {
    const c = Int32Array.from(this.shoe);
    const bjPays = this.rules.blackjackPays;

    let evSum = 0, wagerSum = 0, pSum = 0;
    let pPlayerBJ = 0, pDealerBJ = 0;

    const N0 = sum(c);
    for (let p1 = 0; p1 < 10; p1++) {
      if (c[p1] === 0) continue;
      const pp1 = pDraw(c, N0, p1, this.model);
      if (this.model.kind === 'finite') c[p1]--;

      const N1 = sum(c);
      for (let up = 0; up < 10; up++) {
        if (c[up] === 0) continue;
        const pUp = pDraw(c, N1, up, this.model);
        if (this.model.kind === 'finite') c[up]--;

        const N2 = sum(c);
        for (let p2 = 0; p2 < 10; p2++) {
          if (c[p2] === 0) continue;
          const pp2 = pDraw(c, N2, p2, this.model);
          if (this.model.kind === 'finite') c[p2]--;

          const pCombo = pp1 * pUp * pp2;
          pSum += pCombo;

          const playerBJ = (p1 === T_IDX && p2 === A_IDX) || (p1 === A_IDX && p2 === T_IDX);
          if (playerBJ) pPlayerBJ += pCombo;

          // Dealer natural probability given the three exposed cards.
          const { pNatural } = this.dealerOutcome(c, up);
          if (up === A_IDX || up === T_IDX) pDealerBJ += pCombo * pNatural;

          let ev: number, wager: number;
          if (playerBJ) {
            // Peek: a dealer natural pushes; otherwise the player is paid 3:2.
            // Under peek/OBO the dealer's natural is revealed immediately, so a player
            // natural pushes against it with probability pNatural either way; the rule flag
            // does not change this branch. Kept explicit rather than as a dead ternary.
            const pd = pNatural;
            ev = pd * 0 + (1 - pd) * bjPays;
            wager = 1;
          } else if ((up === A_IDX || up === T_IDX) && this.rules.peek && this.strategy === 'TD') {
            // ── Hole-explicit peek branch ────────────────────────────────────
            // Conditioning happens ONCE, here, and never again below.
            //
            // The old form computed `Sum_d P(d) * E[return | E, d]` — player draw
            // paths weighted by the UNCONDITIONAL shoe law with the hole still in
            // the drawable pool — and applied the no-natural conditioning only at
            // the settlement leaf. That is not the conditional expectation: given
            // "no natural", the player's own draw law shifts (knowing the hole is
            // not a Ten leaves more Tens drawable), so the path weights are wrong.
            // Verified against an exact-rational physical enumerator: the error is
            // algebraic, not numerical, and scales ~1/N.
            //
            // Here the hole is a CONCRETE card, drawn and removed from the shoe
            // before the player acts. Inside each branch the dealer's hand is known
            // and every player draw is the plain physical law on the depleted shoe.
            // The `Sum_h w_h = 1` mixture is Bayes as an identity.
            // In infinite mode the draw law is composition-free, so P(E | draws)
            // is constant and this branch collapses to the old one — identical
            // results, which is why the infinite regression test is unaffected.
            const natRank = up === A_IDX ? T_IDX : A_IDX;
            const N = sum(c);
            const pNat = pDraw(c, N, natRank, this.model);
            const denomP = 1 - pNat;

            let evPlay = 0, wagerPlay = 0;
            for (let h = 0; h < 10; h++) {
              if (h === natRank || c[h] === 0) continue;
              const w = denomP > 0 ? pDraw(c, N, h, this.model) / denomP : 0;
              if (w <= 0) continue;
              if (this.model.kind === 'finite') c[h]--;  // the hole is a real card
              const r = this.initialEV(c, p1, p2, up, h);
              if (this.model.kind === 'finite') c[h]++;
              evPlay += w * r.ev;
              wagerPlay += w * r.wager;
            }
            // OBO: a dealer natural takes the initial bet only.
            ev = pNat * -1 + (1 - pNat) * evPlay;
            wager = pNat * 1 + (1 - pNat) * wagerPlay;
          } else if (up === A_IDX || up === T_IDX) {
            // Two cases land here.
            //
            // 1. No peek (OBO off): nothing is conditioned on, so the unseen-hole
            //    mixture at settlement is sound and the player commits everything.
            //
            // 2. CD under peek: KNOWN BIASED — see `cdPeekIsApproximate`. CD cannot
            //    use the hole-explicit branch, because an argmax evaluated inside a
            //    fixed-hole branch lets the player choose as if the hole were
            //    visible (measured: +5.5 pp, a peeking player). The correct CD form
            //    is a per-node posterior mixture, not yet implemented, so CD keeps
            //    the old conditioning here and carries the ~1/N error the TD path
            //    just shed. CD is an internal diagnostic on the strategy table; its
            //    figure must NOT be published as exact until the mixture form lands.
            const inner = this.initialEV(c, p1, p2, up, -1);
            if (this.rules.peek) {
              ev = pNatural * -1 + (1 - pNatural) * inner.ev;
              wager = pNatural * 1 + (1 - pNatural) * inner.wager;
            } else {
              ev = pNatural * -inner.wager + (1 - pNatural) * inner.ev;
              wager = inner.wager;
            }
          } else {
            // Upcard cannot make a natural: no conditioning, unseen hole is fine.
            const inner = this.initialEV(c, p1, p2, up, -1);
            ev = inner.ev;
            wager = inner.wager;
          }

          evSum += pCombo * ev;
          wagerSum += pCombo * wager;

          if (this.model.kind === 'finite') c[p2]++;
        }
        if (this.model.kind === 'finite') c[up]++;
      }
      if (this.model.kind === 'finite') c[p1]++;
    }

    // In infinite mode the enumeration is already normalised; in finite mode the
    // three-card probabilities sum to 1 by construction. Guard anyway.
    const norm = pSum > 0 ? pSum : 1;
    const evPerInitial = evSum / norm;
    const avgWager = wagerSum / norm;

    return {
      model: this.model,
      strategy: this.strategy,
      rules: this.rules,
      evPerInitialBet: evPerInitial,
      rtpPerInitialBet: 1 + evPerInitial,
      edgePerInitialBet: -evPerInitial,
      avgWager,
      evPerTotalWagered: evPerInitial / avgWager,
      rtpPerTotalWagered: 1 + evPerInitial / avgWager,
      edgePerTotalWagered: -evPerInitial / avgWager,
      playerBlackjackFreq: pPlayerBJ / norm,
      dealerBlackjackFreq: pDealerBJ / norm,
      probabilityMass: pSum,
      cdPeekIsApproximate:
        this.strategy === 'CD' && this.model.kind === 'finite' && this.rules.peek,
    };
  }
}

export interface ExactResult {
  model: ShoeModel;
  strategy: Strategy;
  rules: Rules;
  evPerInitialBet: number;
  rtpPerInitialBet: number;
  edgePerInitialBet: number;
  avgWager: number;
  evPerTotalWagered: number;
  rtpPerTotalWagered: number;
  edgePerTotalWagered: number;
  playerBlackjackFreq: number;
  dealerBlackjackFreq: number;
  probabilityMass: number;
  /**
   * TRUE when this figure carries the known peek-conditioning approximation —
   * i.e. CD strategy, finite shoe, dealer peeks. TD is exact (hole-explicit,
   * anchored to an exact-rational enumerator). A result with this flag set is an
   * internal diagnostic and MUST NOT be published as an exact figure.
   */
  cdPeekIsApproximate: boolean;
}

export function solveExact(
  model: ShoeModel, strategy: Strategy, rules: Rules = LIQD_RULES,
): ExactResult {
  return new ExactSolver(model, strategy, rules).solve();
}

/**
 * The four solves that `outputs/exact-rtp.json` is made of. Kept as one named
 * structure so the artifact builder, the CLI's console summary and the test that
 * re-derives the artifact all read the SAME solves.
 */
export interface ExactSolves {
  infiniteCD: ExactResult;
  finite8TD: ExactResult;
  finite1TD: ExactResult;
  finite6TD: ExactResult;
}

/** A solve function with the shape of `solveExact` — injectable so callers can cache. */
export type Solver = (model: ShoeModel, strategy: Strategy, rules?: Rules) => ExactResult;

/** Run (or look up, if `solver` caches) the four solves the artifact is built from. */
export function exactSolves(solver: Solver = solveExact): ExactSolves {
  return {
    infiniteCD: solver({ kind: 'infinite' }, 'CD', LIQD_RULES),
    finite8TD: solver({ kind: 'finite', decks: 8 }, 'TD', LIQD_RULES),
    finite1TD: solver({ kind: 'finite', decks: 1 }, 'TD', LIQD_RULES),
    // 6-deck exact solve, all other rule inputs identical — used only to record, in the artifact,
    // the precision of the published WoO reference (its 6-deck csm figure differs from this exact
    // solve by ~1e-4 pp, so WoO's csm figures resolve to ~1e-4 pp, not 1e-5 pp).
    finite6TD: solver({ kind: 'finite', decks: 6 }, 'TD', LIQD_RULES),
  };
}

/**
 * Build the artifact of record for the exact figures (`outputs/exact-rtp.json`).
 *
 * Deterministic — no timestamp, no randomness — so the file and its hash are stable
 * across runs. This is the producing artifact for every exact TD number the report
 * cites; the simulation artifact's own exactTD block is a point-in-time copy and is
 * NOT the citation source.
 *
 * EXPORTED ON PURPOSE (round-2 QA item 1). `npm run rtp` writes what this returns, and
 * `tests/blackjack/exactSolverTests.ts` deep-compares the COMMITTED file against a fresh
 * call. Before that, the test gated three fields of `finite8TD` by hand, so a hand-edit of
 * `rtpPerTotalWagered`, `avgWager`, `finite1TD`, `infiniteCD`, `cardRemovalLiftPP`,
 * `sixDeckExact` or anything in `wooAnchor` passed the whole suite. One builder, two
 * readers: every key path in the artifact is now bound to the code that produces it, and
 * a field added here is covered the moment it exists.
 */
export function buildExactArtifact(solver: Solver = solveExact): Record<string, unknown> {
  const { infiniteCD: inf, finite8TD: td, finite1TD: oneDeck, finite6TD: sixDeck } = exactSolves(solver);
  return {
    generatedBy: 'npm run rtp (src/exact-play.ts)',
    deterministic: true,
    finite8TD: td,
    finite1TD: oneDeck,
    infiniteCD: inf,
    cardRemovalLiftPP: (td.rtpPerInitialBet - inf.rtpPerInitialBet) * 100,
    note:
      'finite8TD is the headline: exact EV of the src/strategy.ts table on a real ' +
      '416-card shoe, hole-explicit peek branch, anchored to the tiny-shoe ' +
      'exact-rational oracle (anchor/oracle.py, tests/blackjack/exactOracleTests.ts). ' +
      'Finite-shoe CD is a demoted internal diagnostic (cdPeekIsApproximate) and is ' +
      'deliberately absent from this artifact. Base game only — side bets and ' +
      'insurance are excluded.',
    wooAnchor: {
      source: 'https://wizardofodds.com/games/blackjack/calculator/',
      capturedAt: '2026-08-23',
      settings: '8 decks, S17, DAS, double any two, split to 2 hands, no resplit aces, ' +
        'no hit split aces, OBO peek, no surrender, blackjack 3:2',
      basicStrategyContinuousShuffler: 0.0048768,
      basicStrategyContinuousShufflerNote:
        'total-dependent basic strategy, reshuffle every hand — the LIQD regime; ' +
        'published at 5 decimal places of percent (0.48768%)',
      deltaVsFinite8TD: td.edgePerInitialBet - 0.0048768,
      sixDeckPublished: 0.0045999,
      sixDeckExact: sixDeck.edgePerInitialBet,
      sixDeckNote:
        'Same rule set at 6 decks: WoO publishes 0.45999% (sixDeckPublished) while this engine ' +
        'solves to sixDeckExact. The differences are about 0.00005441 pp at six decks and ' +
        '0.00000518 pp at eight decks. This supports close agreement at the available ' +
        'reference precision; it does not certify every digit of the internal solve.',
    },
  };
}

/** Byte-for-byte serialisation of the artifact as `npm run rtp` writes it to disk. */
export function serializeExactArtifact(artifact: Record<string, unknown>): string {
  return JSON.stringify(artifact, null, 2) + '\n';
}

if (require.main === module) {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');

  // Cache the four solves so the console summary below and the artifact are the SAME numbers.
  const cache = new Map<string, ExactResult>();
  const t: Record<string, number> = {};
  const timedSolver: Solver = (model, strategy, rules) => {
    const key = JSON.stringify(model) + strategy;
    let r = cache.get(key);
    if (!r) {
      const t0 = Date.now();
      r = solveExact(model, strategy, rules);
      t[key] = Date.now() - t0;
      cache.set(key, r);
    }
    return r;
  };

  const artifact = buildExactArtifact(timedSolver);
  const { infiniteCD: inf, finite8TD: td, finite1TD: oneDeck, finite6TD: sixDeck } = exactSolves(timedSolver);
  const secs = (model: ShoeModel, strategy: Strategy): string =>
    ((t[JSON.stringify(model) + strategy] ?? 0) / 1000).toFixed(2);

  console.log('\n  Infinite deck, CD (with-replacement model)');
  console.log(`    RTP per initial bet : ${(inf.rtpPerInitialBet * 100).toFixed(6)}%`);
  console.log(`    edge                : ${(inf.edgePerInitialBet * 100).toFixed(6)}%`);
  console.log(`    time                : ${secs({ kind: 'infinite' }, 'CD')}s`);

  console.log('\n  Finite 8-deck, TD (the table simulate.ts plays)');
  console.log(`    RTP per initial bet : ${(td.rtpPerInitialBet * 100).toFixed(6)}%   edge ${(td.edgePerInitialBet * 100).toFixed(6)}%`);
  console.log(`    RTP per total wager : ${(td.rtpPerTotalWagered * 100).toFixed(6)}%   avg wager ${td.avgWager.toFixed(6)}`);
  console.log(`    time                : ${secs({ kind: 'finite', decks: 8 }, 'TD')}s`);

  console.log('\n  Finite 1-deck, TD (deck-sensitivity reference, same 8-deck table)');
  console.log(`    edge per initial bet: ${(oneDeck.edgePerInitialBet * 100).toFixed(6)}%\n`);

  console.log(`  Finite 6-deck, TD (WoO precision reference): edge ${(sixDeck.edgePerInitialBet * 100).toFixed(6)}%\n`);

  const outPath = path.join(__dirname, '..', 'outputs', 'exact-rtp.json');
  fs.writeFileSync(outPath, serializeExactArtifact(artifact));
  console.log(`  Wrote ${outPath}\n`);
}
