/**
 * LIQD Blackjack — Optimal-Play RTP Engine (analytical)
 *
 * Independent recursive EV solver for optimal basic strategy. Computes the
 * theoretical RTP WITHOUT referencing any LIQD-supplied figure. Wizard of Odds is
 * used only for cross-validation, never as an input.
 *
 * This engine is the INFINITE-DECK limit (each draw independent). LIQD deals from a
 * finite 8-deck (416-card) shoe reshuffled every hand, so the finite-shoe removal
 * effect makes the true RTP marginally different. The AUTHORITATIVE finite 8-deck
 * RTP is the deterministic exact solve in `src/exact-play.ts` (the Monte-Carlo
 * simulation confirms it, but does not establish it); this analytical value is the
 * independent theoretical
 * cross-check, and both are compared to the published Wizard of Odds 8-deck figure.
 *
 * Rules (read off the 6,000-hand dataset — see verify.ts rules steps):
 *   - Dealer stands on soft 17 (S17)
 *   - Blackjack pays 3:2 (2.5× return)
 *   - Double on any two cards; double after split (DAS)
 *   - Split on matching VALUE (any two ten-valued cards may be split); one card on split
 *     aces; NO re-split. Basic strategy never splits tens, so rank-equality detection is
 *     sufficient for the RTP engine — see the note at the pair check in src/simulate.ts.
 *   - Dealer peeks for blackjack on Ace / 10 upcards
 *   - No surrender
 *
 * Card probabilities (infinite deck, suit-agnostic):
 *   2..9, A: 1/13 each;  T (10/J/Q/K): 4/13
 */

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'A'] as const;
type Rank = typeof RANKS[number];

const P: Record<Rank, number> = {
  '2': 1 / 13, '3': 1 / 13, '4': 1 / 13, '5': 1 / 13, '6': 1 / 13,
  '7': 1 / 13, '8': 1 / 13, '9': 1 / 13, T: 4 / 13, A: 1 / 13,
};
const V: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 10, A: 11,
};

interface State { total: number; soft: boolean; }

function add(s: State, r: Rank): State {
  let total = s.total;
  let soft = s.soft;
  if (r === 'A') {
    if (total + 11 <= 21) { total += 11; soft = true; } else { total += 1; }
  } else {
    total += V[r];
    if (total > 21 && soft) { total -= 10; soft = false; }
  }
  return { total, soft };
}

type S17 = 'hit' | 'stand';
const dealerCache = new Map<string, Map<number, number>>();

/** Dealer final-total distribution (22 = bust). */
function dealerDist(state: State, s17: S17): Map<number, number> {
  const key = `${state.total}-${state.soft}-${s17}`;
  const cached = dealerCache.get(key);
  if (cached) return cached;
  if (state.total > 21) { const m = new Map([[22, 1]]); dealerCache.set(key, m); return m; }
  const stands = state.total >= 18 || (state.total === 17 && (!state.soft || s17 === 'stand'));
  if (stands) { const m = new Map([[state.total, 1]]); dealerCache.set(key, m); return m; }
  const m = new Map<number, number>();
  for (const r of RANKS) {
    const sub = dealerDist(add(state, r), s17);
    for (const [t, p] of sub) m.set(t, (m.get(t) || 0) + P[r] * p);
  }
  dealerCache.set(key, m);
  return m;
}

/** Dealer distribution from an upcard, applying the peek rule. */
function dealerStartDist(upcard: Rank, s17: S17): { pBJ: number; distNoBJ: Map<number, number> } {
  const afterUp = add({ total: 0, soft: false }, upcard);
  if (upcard !== 'T' && upcard !== 'A') return { pBJ: 0, distNoBJ: dealerDist(afterUp, s17) };
  const pBJ = upcard === 'A' ? P.T : P.A;
  const distNoBJ = new Map<number, number>();
  for (const hole of RANKS) {
    const isBJHole = (upcard === 'A' && hole === 'T') || (upcard === 'T' && hole === 'A');
    if (isBJHole) continue;
    const sub = dealerDist(add(afterUp, hole), s17);
    const pHoleCond = P[hole] / (1 - pBJ);
    for (const [t, pt] of sub) distNoBJ.set(t, (distNoBJ.get(t) || 0) + pHoleCond * pt);
  }
  return { pBJ, distNoBJ };
}

const standCache = new Map<string, number>();
function standEV(playerTotal: number, dealerUp: Rank, s17: S17): number {
  if (playerTotal > 21) return -1;
  const key = `${playerTotal}-${dealerUp}-${s17}`;
  const c = standCache.get(key);
  if (c !== undefined) return c;
  const { distNoBJ } = dealerStartDist(dealerUp, s17);
  let ev = 0;
  for (const [t, pt] of distNoBJ) {
    if (t === 22) ev += pt; else if (playerTotal > t) ev += pt; else if (playerTotal < t) ev -= pt;
  }
  standCache.set(key, ev);
  return ev;
}

const hitCache = new Map<string, number>();
function hitEV(state: State, dealerUp: Rank, s17: S17): number {
  const key = `${state.total}-${state.soft}-${dealerUp}-${s17}`;
  const c = hitCache.get(key);
  if (c !== undefined) return c;
  let ev = 0;
  for (const r of RANKS) {
    const next = add(state, r);
    if (next.total > 21) ev += P[r] * -1;
    else ev += P[r] * Math.max(standEV(next.total, dealerUp, s17), hitEV(next, dealerUp, s17));
  }
  hitCache.set(key, ev);
  return ev;
}

function doubleEV(state: State, dealerUp: Rank, s17: S17): number {
  let ev = 0;
  for (const r of RANKS) {
    const next = add(state, r);
    ev += P[r] * (next.total > 21 ? -1 : standEV(next.total, dealerUp, s17));
  }
  return 2 * ev;
}

/** EV of one post-split hand from a single card (split aces: one card then stand). */
function postSplitHandEV(rank: Rank, dealerUp: Rank, s17: S17, das: boolean): number {
  const start = add({ total: 0, soft: false }, rank);
  let ev = 0;
  for (const r of RANKS) {
    const next = add(start, r);
    if (rank === 'A') {
      ev += P[r] * (next.total > 21 ? -1 : standEV(next.total, dealerUp, s17));
    } else {
      let best = Math.max(next.total > 21 ? -1 : standEV(next.total, dealerUp, s17), hitEV(next, dealerUp, s17));
      if (das) best = Math.max(best, doubleEV(next, dealerUp, s17));
      ev += P[r] * best;
    }
  }
  return ev;
}
const splitEV = (rank: Rank, up: Rank, s17: S17, das: boolean): number => 2 * postSplitHandEV(rank, up, s17, das);

function playerOptimalEV(p1: Rank, p2: Rank, up: Rank, s17: S17, das: boolean): number {
  const state = add(add({ total: 0, soft: false }, p1), p2);
  let best = Math.max(standEV(state.total, up, s17), hitEV(state, up, s17), doubleEV(state, up, s17));
  if (p1 === p2) best = Math.max(best, splitEV(p1, up, s17, das));
  return best;
}

export interface OptimalPlayResult {
  rtp: number;
  edge: number;
  playerBJFreq: number;
  dealerBJFreq: number;
  s17: S17;
  das: boolean;
}

/** Optimal-play RTP = E[return / wager] over all (P1, P2, dealerUp) with peek + BJ handling. */
export function computeOptimalRTP(s17: S17 = 'stand', das = true): OptimalPlayResult {
  let rtpSum = 0;
  let playerBJProb = 0;
  for (const p1 of RANKS) {
    for (const p2 of RANKS) {
      const playerBJ = (p1 === 'T' && p2 === 'A') || (p1 === 'A' && p2 === 'T');
      if (playerBJ) playerBJProb += P[p1] * P[p2];
      for (const up of RANKS) {
        const pCombo = P[p1] * P[p2] * P[up];
        const upPeeks = up === 'A' || up === 'T';
        const pDealerBJ = up === 'A' ? P.T : up === 'T' ? P.A : 0;
        let ret: number;
        if (playerBJ && upPeeks) ret = pDealerBJ * 1 + (1 - pDealerBJ) * 2.5;
        else if (playerBJ) ret = 2.5;
        else if (upPeeks) ret = pDealerBJ * 0 + (1 - pDealerBJ) * (1 + playerOptimalEV(p1, p2, up, s17, das));
        else ret = 1 + playerOptimalEV(p1, p2, up, s17, das);
        rtpSum += pCombo * ret;
      }
    }
  }
  return { rtp: rtpSum, edge: 1 - rtpSum, playerBJFreq: playerBJProb, dealerBJFreq: 2 * P.T * P.A, s17, das };
}

export function clearCaches(): void { dealerCache.clear(); standCache.clear(); hitCache.clear(); }

if (require.main === module) {
  const t0 = Date.now();
  const r = computeOptimalRTP('stand', true);
  console.log('\n  LIQD Blackjack — optimal-play RTP (analytical, infinite-deck limit)\n');
  console.log('  Rules:           S17, DAS, no surrender, no re-split, dealer peek');
  console.log(`  Optimal RTP:     ${(r.rtp * 100).toFixed(6)}%`);
  console.log(`  House edge:      ${(r.edge * 100).toFixed(6)}%`);
  console.log(`  Player BJ freq:  ${(r.playerBJFreq * 100).toFixed(4)}%  (infinite-deck 8/169 = ${(8 / 169 * 100).toFixed(4)}%)`);
  console.log(`  Dealer BJ freq:  ${(r.dealerBJFreq * 100).toFixed(4)}%`);
  console.log(`  Time:            ${((Date.now() - t0) / 1000).toFixed(2)}s`);
  console.log(`\n  This engine is the infinite-deck (with-replacement) limit only: ${(r.rtp * 100).toFixed(6)}% RTP / ${(r.edge * 100).toFixed(6)}% edge.`);
  console.log('  Authoritative finite 8-deck RTP and the pinned Wizard of Odds anchor: see the exact solve (npm run rtp -> outputs/exact-rtp.json).\n');
}
