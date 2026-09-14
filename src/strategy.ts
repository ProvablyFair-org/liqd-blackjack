/**
 * LIQD Blackjack — total-dependent basic strategy table.
 *
 * Single source of truth, imported by BOTH `simulate.ts` (which plays it) and
 * `exact-play.ts` (which computes its exact EV in TD mode). They must never
 * drift apart: the whole point of the exact TD figure is that it is the EV of
 * *this* table, so a second copy would silently invalidate the comparison.
 *
 * Because sim and solver now share this module they can also share a bug in it.
 * That is what the composition-dependent (CD) figure is for — CD chooses actions
 * by argmax and ignores this table entirely, so a mistake here shows up as an
 * abnormally large CD − TD gap.
 *
 * Rules encoded: S17, DAS, no re-split, split aces one card, double on any two.
 * `up` is the dealer upcard value (11 = A, 10 = T/J/Q/K, 2..9).
 */

export type PairAction = 'P' | 'H' | null;
export type SoftAction = 'H' | 'S' | 'D' | 'Ds';
export type HardAction = 'H' | 'S' | 'D';

/** Pair split decision. `null` = not a pair decision (5,5 is played as hard 10). */
export function pairAction(rankVal: number, up: number): PairAction {
  switch (rankVal) {
    case 11: return 'P';                                  // A,A
    case 10: return 'H';                                  // 10,10 → never split (falls to hard 20 stand)
    case 9: return (up === 7 || up === 10 || up === 11) ? 'H' : 'P';
    case 8: return 'P';
    case 7: return (up >= 2 && up <= 7) ? 'P' : 'H';
    case 6: return (up >= 2 && up <= 6) ? 'P' : 'H';      // DAS
    case 5: return null;                                  // treat as hard 10
    case 4: return (up === 5 || up === 6) ? 'P' : 'H';    // DAS
    case 3: return (up >= 2 && up <= 7) ? 'P' : 'H';
    case 2: return (up >= 2 && up <= 7) ? 'P' : 'H';
    default: return 'H';
  }
}

export function softAction(t: number, up: number): SoftAction {
  if (t >= 19) return 'S';                                // A,8 A,9 — S17 stands
  if (t === 18) { if (up >= 3 && up <= 6) return 'Ds'; if (up === 2 || up === 7 || up === 8) return 'S'; return 'H'; }
  if (t === 17) return (up >= 3 && up <= 6) ? 'D' : 'H';  // A,6
  if (t === 16 || t === 15) return (up >= 4 && up <= 6) ? 'D' : 'H'; // A,5 A,4
  if (t === 14 || t === 13) return (up >= 5 && up <= 6) ? 'D' : 'H'; // A,3 A,2
  return 'H';
}

export function hardAction(t: number, up: number): HardAction {
  if (t >= 17) return 'S';
  if (t >= 13) return (up >= 2 && up <= 6) ? 'S' : 'H';
  if (t === 12) return (up >= 4 && up <= 6) ? 'S' : 'H';
  if (t === 11) return up === 11 ? 'H' : 'D';             // S17: double 2-10, hit vs A
  if (t === 10) return (up >= 2 && up <= 9) ? 'D' : 'H';
  if (t === 9) return (up >= 3 && up <= 6) ? 'D' : 'H';
  return 'H';
}

/**
 * The action for a non-pair hand, with the same fallbacks the simulation applies:
 * `D` on a hand of 3+ cards (or when doubling is not allowed) degrades to a hit,
 * and `Ds` degrades to a stand. The solver must mirror this exactly or the exact
 * TD figure would be the EV of a strategy nobody plays.
 */
export function resolvedAction(
  total: number, soft: boolean, up: number, canDouble: boolean,
): 'H' | 'S' | 'D' {
  const a = soft ? softAction(total, up) : hardAction(total, up);
  if (a === 'D') return canDouble ? 'D' : 'H';
  if (a === 'Ds') return canDouble ? 'D' : 'S';
  return a;
}
