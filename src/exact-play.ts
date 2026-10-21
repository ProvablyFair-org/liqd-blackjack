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
 * It is neither asserted as "exact, not an approximation" nor hedged as an approximation with no
 * stated error bound: neither is a derivation. Agreement with `anchor/oracle.py` cannot settle it
 * either — that oracle plays splits SEQUENTIALLY against a physically depleted shoe, but the two
 * engines were written by the same team, so the argument has to stand on its own. It is set out
 * here with its assumptions named.
 *
 * ASSUMPTIONS, in the order they are used:
 *
 *   A1. NO RE-SPLIT. LIQD splits to two hands only, so the number of hands is fixed at 2 and
 *       there is no branching over how many hands exist. This is a confirmed rule of the game
 *       (and, where it is not directly observed, a disclosed limitation — see DL-5); it is not a
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
 * assumes the same policy and the same information rule. Recorded as DL-13.
 *
 * ── The second moment (BLACKJACK-21, 2026-09-25) ──────────────────────────────
 * moments() gives E[R²] of the per-round return, which the split identity above CANNOT give: the
 * two split hands share the dealer and the shoe, so E[(X₁+X₂)²] carries a cross term E[X₁X₂] that
 * linearity says nothing about. moments() uses no identity: splits are played sequentially, hand 2
 * from the shoe hand 1 left, the dealer from the shoe both left. The dealer's law at each such shoe
 * is summed over its draw paths grouped by multiset (dealerPaths), because the recursive dealerDist
 * memo exhausts the heap at 8 decks on this workload; the recursive form was run once to completion
 * (630 s, 2026-09-25) and agreed to 5e-16 in E[R²]. Its sequential mean reproduces solve()'s mean,
 * and its E[R²] reproduces anchor/oracle.py's exact fractions on three reduced shoes at 1e-12.
 *
 * ── Peek, handled exactly ─────────────────────────────────────────────────────
 * With upcard u in {A,T} the hole card is a single unseen card constrained to the
 * non-natural ranks. The hole-card posterior stays proportional to the current
 * unseen counts over those ranks no matter what the player draws (the draw
 * likelihoods cancel), so the composition is sufficient state and no mixture has
 * to be carried through the recursion. The hole is only mixed over at settlement.
 */

import { pairAction, resolvedAction } from './strategy';
import { RULES, BLACKJACK_PAYS } from './config';

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

/** LIQD's rules — READ from the single source, src/config.ts RULES (BLACKJACK-26); never restated here. */
export const LIQD_RULES: Rules = {
  s17: RULES.s17, das: RULES.das, peek: RULES.peek, blackjackPays: BLACKJACK_PAYS,
  splitAcesOneCard: RULES.splitAcesOneCard, doubleAnyTwo: RULES.doubleAnyTwo,
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

  // ── Second moment of the per-round return (BLACKJACK-21) ──────────────────────
  //
  // R = returned − wagered for one round, in initial-bet units, under the declared TD strategy —
  // the quantity src/round-engine.ts settles and Pass 2 sums per window. solve() above gives E[R]
  // through the split identity E[X₁+X₂] = 2·E[X₁], which is linearity of expectation and says
  // NOTHING about E[(X₁+X₂)²]: the two split hands share the dealer and the shoe, so their cross
  // term E[X₁X₂] is not a product. This computation therefore uses NO split identity at all.
  // Splits are played SEQUENTIALLY: hand 1 to completion, its exact law over (final total class,
  // stake, shoe after) enumerated; hand 2 then from THAT depleted shoe; the dealer from the shoe
  // after both; and (X₁ + X₂)² settled against the same dealer total. The hole card is handled the
  // way solve() handles it (a concrete card, removed first, under peek on A/T; an unseen card mixed
  // at settlement otherwise). The sequential first moment is returned beside the second so the
  // split identity used by solve() is CHECKED against a computation that does not assume it.
  //
  // Float64 dynamic programming over the shoe composition, the same arithmetic as solve(): no
  // sampling. The exact-rational anchor is anchor/oracle.py (moments mode), which computes E[R²] as
  // a Fraction by physical play on reduced shoes; tests/blackjack/exactOracleTests.ts holds this
  // code to those fractions at 1e-12.

  /**
   * The dealer's draw paths from a start hand, grouped by (multiset of cards drawn, final total).
   * Every ordered draw sequence the dealer rule allows is enumerated once; sequences with the same
   * multiset have the same probability on any shoe (Π_r c_r(c_r−1)…/N(N−1)…, the falling factorials
   * do not depend on the order), so a group carries its sequence count as a multiplicity. With the
   * hole unseen (hole < 0) the hole is simply the dealer's first draw.
   */
  private dealerPaths(up: number, hole: number): DealerPaths {
    const k0 = `${up}|${hole}`;
    const hit = this.dealerPathCache.get(k0);
    if (hit) return hit;
    const groups = new Map<string, { m: number[]; k: number; d: number; mult: number }>();
    const m = new Array<number>(10).fill(0);
    const walk = (total: number, soft: boolean, k: number): void => {
      const stands = total > 21 || total >= 18 || (total === 17 && (!soft || this.rules.s17));
      if (stands && total >= 17) {
        const d = total > 21 ? 22 : total;
        const key = `${m.join(',')}|${d}`;
        const g = groups.get(key);
        if (g) g.mult++; else groups.set(key, { m: m.slice(), k, d, mult: 1 });
        return;
      }
      for (let i = 0; i < 10; i++) {
        m[i]++;
        const [t2, s2] = addCard(total, soft, i);
        walk(t2, s2, k + 1);
        m[i]--;
      }
    };
    const [t0, s0] = addCard(0, false, up);
    if (hole >= 0) { const [t1, s1] = addCard(t0, s0, hole); walk(t1, s1, 0); } else walk(t0, s0, 0);
    // Flattened, sparse: group g's drawn ranks are idx[off[g] .. off[g+1]), each entry r·16 + m_r
    // (m_r ≥ 1 cards of rank r), so the probability is mult · Π ff[r·16 + m_r] / N(N−1)…(N−k+1).
    const G = groups.size;
    const entries: number[] = [];
    const out: DealerPaths = { n: G, idx: new Int16Array(0), off: new Int32Array(G + 1), k: new Int16Array(G), d: new Int8Array(G), mult: new Float64Array(G), maxK: 0, maxM: 0 };
    let g = 0;
    for (const v of groups.values()) {
      out.off[g] = entries.length;
      for (let i = 0; i < 10; i++) if (v.m[i] > 0) { entries.push(i * 16 + v.m[i]); if (v.m[i] > out.maxM) out.maxM = v.m[i]; }
      out.k[g] = v.k; out.d[g] = v.d; out.mult[g] = v.mult;
      if (v.k > out.maxK) out.maxK = v.k;
      g++;
    }
    out.off[G] = entries.length;
    out.idx = Int16Array.from(entries);
    if (out.maxM > 15) throw new Error('dealerPaths: a dealer path draws more than 15 cards of one rank');
    this.dealerPathCache.set(k0, out);
    return out;
  }
  private dealerPathCache = new Map<string, DealerPaths>();
  private finalMemo = new Map<string, Float64Array>();
  private ffScratch = new Float64Array(10 * 16);

  /** Dealer final-total law (17..21, 22 = bust) for the settlement leaf, drawn from `c`. */
  private dealerFinal(c: Counts, up: number, hole: number): Float64Array {
    if (this.model.kind !== 'finite') {
      if (hole >= 0) {
        const [dt, ds] = addCard(...(addCard(0, false, up) as [number, boolean]), hole);
        return this.dealerDist(c, dt, ds);
      }
      return this.dealerOutcome(c, up).dist;
    }
    const key = `${this.key(c)}|${up}|${hole}`;
    const hit = this.finalMemo.get(key);
    if (hit) return hit;
    const P = this.dealerPaths(up, hole);
    const N = sum(c);
    const den = new Float64Array(P.maxK + 1);
    den[0] = 1;
    for (let i = 1; i <= P.maxK; i++) den[i] = den[i - 1] * (N - i + 1);
    // ff[r·16 + j] = c_r (c_r − 1) … (c_r − j + 1): the falling factorial of rank r's count.
    const ff = this.ffScratch;
    for (let r = 0; r < 10; r++) {
      let f = 1;
      ff[r * 16] = 1;
      for (let j = 1; j <= P.maxM; j++) { f *= (c[r] - j + 1); ff[r * 16 + j] = f; }
    }
    const dist = new Float64Array(24);
    for (let g = 0; g < P.n; g++) {
      let num = P.mult[g];
      for (let e = P.off[g]; e < P.off[g + 1]; e++) num *= ff[P.idx[e]];
      if (num === 0) continue;
      dist[P.d[g]] += num / den[P.k[g]];
    }
    this.finalMemo.set(key, dist);
    return dist;
  }

  /**
   * [E[R], E[R²]] at settlement: this hand stands on `t` (22 = bust) with `w` units against a
   * dealer drawn from `c`; `t1`/`w1` are hand 1 of a split (t1 = 0: no first hand).
   */
  private leafMoments(c: Counts, t: number, w: number, up: number, hole: number, t1: number, w1: number): [number, number] {
    const dist = this.dealerFinal(c, up, hole);
    const g = (x: number, j: number): number =>
      (x > 21 ? -1 : j === 22 ? 1 : x > j ? 1 : x < j ? -1 : 0);
    let m1 = 0, m2 = 0;
    for (let j = 17; j <= 22; j++) {
      const p = dist[j];
      if (!p) continue;
      const r = w * g(t, j) + (t1 > 0 ? w1 * g(t1, j) : 0);
      m1 += p * r; m2 += p * r * r;
    }
    return [m1, m2];
  }

  private momentMemo = new Map<string, [number, number]>();

  /**
   * Bound the memo tables during moments(). The sequential split visits far more shoe compositions
   * than solve() does (hand 1 × hand 2 × dealer), and an unbounded memo exhausts the heap at 8 decks.
   * A memo is a cache of a deterministic function, so clearing it changes no value, only time.
   */
  private trimMemos(limit = 1_500_000): void {
    if (this.dealerMemo.size > limit) this.dealerMemo.clear();
    if (this.outcomeMemo.size > limit) this.outcomeMemo.clear();
    if (this.finalMemo.size > limit) this.finalMemo.clear();
    if (this.momentMemo.size > limit) this.momentMemo.clear();
  }

  /** [E[R], E[R²]] of playing out one hand under the TD table (optionally as hand 2 of a split). */
  private handMoments(
    c: Counts, total: number, soft: boolean, up: number,
    canDouble: boolean, oneCardOnly: boolean, hole: number, t1: number, w1: number,
  ): [number, number] {
    if (total > 21) return this.leafMoments(c, 22, 1, up, hole, t1, w1);
    if (oneCardOnly) return this.leafMoments(c, total, 1, up, hole, t1, w1);
    const k = `${this.key(c)}|${total}|${soft ? 1 : 0}|${up}|${canDouble ? 1 : 0}|h${hole}|${t1}.${w1}`;
    const hit = this.momentMemo.get(k);
    if (hit) return hit;
    const a = resolvedAction(total, soft, VAL[up], canDouble);
    let res: [number, number];
    if (a === 'S') {
      res = this.leafMoments(c, total, 1, up, hole, t1, w1);
    } else {
      const n = sum(c);
      let m1 = 0, m2 = 0;
      for (let i = 0; i < 10; i++) {
        const p = pDraw(c, n, i, this.model);
        if (p <= 0) continue;
        const [t2, s2] = addCard(total, soft, i);
        if (this.model.kind === 'finite') c[i]--;
        const [a1, a2] = a === 'D'
          ? this.leafMoments(c, t2 > 21 ? 22 : t2, 2, up, hole, t1, w1)
          : this.handMoments(c, t2, s2, up, false, false, hole, t1, w1);
        if (this.model.kind === 'finite') c[i]++;
        m1 += p * a1; m2 += p * a2;
      }
      res = [m1, m2];
    }
    this.momentMemo.set(k, res);
    return res;
  }

  /**
   * Hand 1 of a split played to completion: accumulates its exact law over (shoe after, final total
   * class, stake) into `out`. Total class: 22 = bust, 16 = any total ≤ 16 (loses to every dealer
   * standing total), else the total itself.
   */
  private enumHand(
    c: Counts, total: number, soft: boolean, up: number, canDouble: boolean, oneCardOnly: boolean,
    p: number, out: Map<string, { counts: Int32Array; t: number; w: number; p: number }>,
  ): void {
    const put = (t: number, w: number): void => {
      const cls = t > 21 ? 22 : t <= 16 ? 16 : t;
      const k = `${this.key(c)}|${cls}|${w}`;
      const e = out.get(k);
      if (e) e.p += p; else out.set(k, { counts: Int32Array.from(c), t: cls, w, p });
    };
    if (total > 21) { put(22, 1); return; }
    if (oneCardOnly) { put(total, 1); return; }
    const a = resolvedAction(total, soft, VAL[up], canDouble);
    if (a === 'S') { put(total, 1); return; }
    const n = sum(c);
    for (let i = 0; i < 10; i++) {
      const q = pDraw(c, n, i, this.model);
      if (q <= 0) continue;
      const [t2, s2] = addCard(total, soft, i);
      if (this.model.kind === 'finite') c[i]--;
      if (a === 'D') {
        const cls = t2 > 21 ? 22 : t2 <= 16 ? 16 : t2;
        const k = `${this.key(c)}|${cls}|2`;
        const e = out.get(k);
        if (e) e.p += p * q; else out.set(k, { counts: Int32Array.from(c), t: cls, w: 2, p: p * q });
      } else {
        this.enumHand(c, t2, s2, up, false, false, p * q, out);
      }
      if (this.model.kind === 'finite') c[i]++;
    }
  }

  /** [E[R], E[R²]] of a split of rank r, the two hands played SEQUENTIALLY (no split identity). */
  private splitMoments(c: Counts, r: number, up: number, hole: number): [number, number] {
    const acesOneCard = r === A_IDX && this.rules.splitAcesOneCard;
    const canDouble = this.rules.das && !acesOneCard;
    const [r0, rs] = addCard(0, false, r);
    const first = new Map<string, { counts: Int32Array; t: number; w: number; p: number }>();
    const n = sum(c);
    for (let i = 0; i < 10; i++) {
      const p = pDraw(c, n, i, this.model);
      if (p <= 0) continue;
      const [t2, s2] = addCard(r0, rs, i);
      if (this.model.kind === 'finite') c[i]--;
      this.enumHand(c, t2, s2, up, canDouble, acesOneCard, p, first);
      if (this.model.kind === 'finite') c[i]++;
    }
    let m1 = 0, m2 = 0;
    for (const e of first.values()) {
      this.trimMemos();
      const cc = e.counts;
      const n1 = sum(cc);
      for (let j = 0; j < 10; j++) {
        const q = pDraw(cc, n1, j, this.model);
        if (q <= 0) continue;
        const [t2, s2] = addCard(r0, rs, j);
        if (this.model.kind === 'finite') cc[j]--;
        const [a1, a2] = this.handMoments(cc, t2, s2, up, canDouble, acesOneCard, hole, e.t, e.w);
        if (this.model.kind === 'finite') cc[j]++;
        m1 += e.p * q * a1; m2 += e.p * q * a2;
      }
    }
    return [m1, m2];
  }

  /** [E[R], E[R²]] for the player's two cards against an upcard, no naturals. */
  private initialMoments(c: Counts, p1: number, p2: number, up: number, hole: number): [number, number] {
    if (p1 === p2) {
      const pv = p1 === A_IDX ? 11 : VAL[p1];
      if (pairAction(pv, VAL[up]) === 'P') return this.splitMoments(c, p1, up, hole);
    }
    const [t, s] = addCard(...(addCard(0, false, p1) as [number, boolean]), p2);
    return this.handMoments(c, t, s, up, true, false, hole, 0, 0);
  }

  /**
   * Exact first and second moment of the per-round return R under the TD table, every initial
   * deal enumerated without replacement exactly as solve() enumerates it. TD only: the CD mode's
   * argmax has no fixed policy to take a second moment of.
   */
  moments(): ExactMoments {
    if (this.strategy !== 'TD') throw new Error('moments(): the second moment is defined for the declared (TD) strategy only');
    if (!this.rules.peek) throw new Error('moments(): implemented for the peek/OBO rule set only (src/config.ts RULES.peek)');
    const c = Int32Array.from(this.shoe);
    const bjPays = this.rules.blackjackPays;
    let m1Sum = 0, m2Sum = 0, pSum = 0;
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
          const natRank = up === A_IDX ? T_IDX : up === T_IDX ? A_IDX : -1;
          const N = sum(c);
          const pNat = natRank >= 0 ? pDraw(c, N, natRank, this.model) : 0;
          let m1: number, m2: number;
          if (playerBJ) {
            // A dealer natural pushes (R = 0); otherwise R = +blackjackPays.
            m1 = (1 - pNat) * bjPays; m2 = (1 - pNat) * bjPays * bjPays;
          } else if (natRank >= 0) {
            // Peek/OBO: a dealer natural takes the initial bet only (R = −1). Otherwise the hole is
            // a concrete non-natural card, removed before the player acts (as in solve()).
            let e1 = 0, e2 = 0;
            const denomP = 1 - pNat;
            for (let h = 0; h < 10; h++) {
              if (h === natRank || c[h] === 0) continue;
              const w = denomP > 0 ? pDraw(c, N, h, this.model) / denomP : 0;
              if (w <= 0) continue;
              if (this.model.kind === 'finite') c[h]--;
              const [a1, a2] = this.initialMoments(c, p1, p2, up, h);
              if (this.model.kind === 'finite') c[h]++;
              e1 += w * a1; e2 += w * a2;
            }
            m1 = -pNat + (1 - pNat) * e1; m2 = pNat + (1 - pNat) * e2;
          } else {
            [m1, m2] = this.initialMoments(c, p1, p2, up, -1);
          }
          m1Sum += pCombo * m1; m2Sum += pCombo * m2;
          this.trimMemos();
          if (this.model.kind === 'finite') c[p2]++;
        }
        if (this.model.kind === 'finite') c[up]++;
      }
      if (this.model.kind === 'finite') c[p1]++;
    }
    const norm = pSum > 0 ? pSum : 1;
    const mean = m1Sum / norm, secondMoment = m2Sum / norm;
    const variance = secondMoment - mean * mean;
    return { model: this.model, strategy: this.strategy, meanSequential: mean, secondMoment, variance, sd: Math.sqrt(variance), probabilityMass: pSum };
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

/** Dealer draw paths grouped by (multiset drawn, final total), flattened (see dealerPaths). */
interface DealerPaths {
  n: number; idx: Int16Array; off: Int32Array; k: Int16Array; d: Int8Array; mult: Float64Array; maxK: number; maxM: number;
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
 * First and second moment of the per-round return R (returned − wagered, initial-bet units) under
 * the declared TD table — see ExactSolver.moments(). `meanSequential` is E[R] computed with the
 * split hands played sequentially (no split identity); it must equal −edgePerInitialBet of solve().
 */
export interface ExactMoments {
  model: ShoeModel;
  strategy: Strategy;
  meanSequential: number;
  secondMoment: number;
  variance: number;
  sd: number;
  probabilityMass: number;
}

export function solveMoments(model: ShoeModel, rules: Rules = LIQD_RULES): ExactMoments {
  return new ExactSolver(model, 'TD', rules).moments();
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
 * EXPORTED ON PURPOSE. `npm run rtp` writes what this returns, and
 * `tests/blackjack/exactSolverTests.ts` deep-compares the COMMITTED file against a fresh
 * call. A test that gated three fields of `finite8TD` by hand would let a hand-edit of
 * `rtpPerTotalWagered`, `avgWager`, `finite1TD`, `infiniteCD`, `cardRemovalLiftPP`,
 * `sixDeckExact` or anything in `wooAnchor` pass the whole suite. One builder, two
 * readers: every key path in the artifact is bound to the code that produces it, and
 * a field added here is covered the moment it exists.
 */
/** A moments function with the shape of `solveMoments` — injectable so callers can cache. */
export type MomentSolver = (model: ShoeModel, rules?: Rules) => ExactMoments;

export function buildExactArtifact(solver: Solver = solveExact, momentSolver: MomentSolver = solveMoments): Record<string, unknown> {
  const { infiniteCD: inf, finite8TD: td, finite1TD: oneDeck, finite6TD: sixDeck } = exactSolves(solver);
  const mom = momentSolver({ kind: 'finite', decks: 8 }, LIQD_RULES);
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
    // BLACKJACK-21 (2026-09-25): the exact second moment of the per-round return under the same
    // table and shoe, so the Pass-2 pooled money test (scored Step 19) holds the served windows
    // against the exact mean AND the exact variance, not a measured SD rounded up.
    finite8TDMoments: {
      ...mom,
      note:
        'R = returned − wagered per round, in initial bets, under the src/strategy.ts table on the ' +
        '416-card shoe. secondMoment = E[R²], variance = E[R²] − E[R]², sd = √variance. Splits are ' +
        'played SEQUENTIALLY (hand 1, then hand 2 from the shoe hand 1 left, then the dealer from the ' +
        'shoe both left, both hands settled against the same dealer total), so the cross term of the ' +
        'two split hands is enumerated, not assumed; meanSequential is E[R] by that path and must ' +
        'equal −finite8TD.edgePerInitialBet. Anchored to anchor/oracle.py (exact Fractions) on three ' +
        'reduced shoes at 1e-12 (tests/blackjack/exactOracleTests.ts). Base game only.',
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

  let momentsCache: ExactMoments | undefined;
  const cachedMoments: MomentSolver = (model, rules) => {
    if (!momentsCache) { const t0 = Date.now(); momentsCache = solveMoments(model, rules); t.moments = Date.now() - t0; }
    return momentsCache;
  };
  const artifact = buildExactArtifact(timedSolver, cachedMoments);
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

  const mom = momentsCache as ExactMoments;
  console.log('  Finite 8-deck, TD — per-round return moments (splits played sequentially)');
  console.log(`    E[R] (sequential)   : ${mom.meanSequential}   (solve(): ${td.evPerInitialBet})`);
  console.log(`    E[R²]               : ${mom.secondMoment}`);
  console.log(`    exact per-round SD  : ${mom.sd}`);
  console.log(`    time                : ${((t.moments ?? 0) / 1000).toFixed(2)}s\n`);

  const outPath = path.join(__dirname, '..', 'outputs', 'exact-rtp.json');
  fs.writeFileSync(outPath, serializeExactArtifact(artifact));
  console.log(`  Wrote ${outPath}\n`);
}
