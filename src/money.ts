/**
 * MONEY, in exact integer settlement units. One definition, every money check.
 *
 * WHY THIS EXISTS.
 *
 * Comparing amounts with `Math.abs(a - b) <= 1e-6` is the wrong SHAPE of check, not merely a
 * loose one: it rejects an amount that cannot exist on the settlement grid, but it ACCEPTS a
 * wrong amount that can. Executed counterexample: rewriting the epoch-0 nonce-0 per-hand credit
 * from `0.20` to `0.1999995` — a legal grid amount, 50 whole settlement units short of what the
 * cards and rules require, i.e. a real underpayment — is invisible to such a check, because
 * 5e-7 < 1e-6. Nothing below 1e-6 can be seen.
 *
 * The capture uses an eight-decimal accounting grid. Every recorded amount is an integer number of 1e-8 units, and so is
 * every rule-derived return (the multipliers are 0, 1, 2, 5/2 and 3 on integer stakes, and the
 * side-bet paytables are whole numbers to one). Comparisons are therefore INTEGER EQUALITY in
 * those units, and the only tolerance in the system sits where float noise genuinely lives:
 * reading a JSON double back onto the grid.
 *
 * It lives in its own module rather than being written out in each step file, because two copies
 * of a rule are two rules, and the second copy is the one that drifts unnoticed.
 */

/** 8 decimals — the captured game-accounting precision. */
export const GRID = 1e8;

/**
 * Tolerance for snapping a JSON double onto the grid, IN GRID UNITS.
 *
 * Measured over the committed dataset: 42,894 amounts, worst deviation 1.2e-7 units. The largest
 * offenders are the round credits `winningAmount: 4.299999999999999` at epoch 25 nonce 38 and
 * `winningAmount: 5.800000000000001` at epoch 68 nonce 38, each approximately 1.19e-7 grid units off
 * 4.30 and 5.80, which must therefore read as exactly 430,000,000 and 580,000,000 units. 1e-3 is ~8,400× the measured noise
 * and 1/1000 of the smallest error that can actually exist — one unit — so representation noise
 * and a real money error can never be confused for one another.
 */
export const GRID_TOL = 1e-3;

/** A recorded money amount in exact integer settlement units, or null if it is OFF the 1e-8 grid. */
export function unitsOf(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const x = Number(v);
  if (!Number.isFinite(x)) return null;
  const u = x * GRID;
  const r = Math.round(u);
  return Math.abs(u - r) > GRID_TOL ? null : r;
}

/** Same, but an absent or off-grid amount counts as zero — for summing optional components. */
export const unitsOr0 = (v: unknown): number => unitsOf(v) ?? 0;

/** Grid units rendered back as a decimal amount, for failure messages. */
export const asMoney = (units: number): string => (units / GRID).toFixed(8);
