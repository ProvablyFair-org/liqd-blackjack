/**
 * The audit's draw-bias bound for LIQD Blackjack (BLACKJACK-08, scored in Step 6).
 *
 * OUR audit helper, not part of the RNG: moved here from src/rng.ts on 20 Oct 2026, when src/rng.ts
 * was replaced by the module rebuilt from docs/ALGORITHM.md. The function body is unchanged; it reads
 * the rebuilt module's own `maxFairFor`, so the bound describes the window the shuffle's draw applies,
 * and nothing here re-implements the draw.
 */
import { maxFairFor } from './rng';

/**
 * The exact per-value bias of one draw over `range`, conditional on acceptance, computed from
 * `maxFairFor` in integer arithmetic: the accepted chunks are 0 … maxFair−1, each residue gets
 * floor(maxFair/range) or that plus one of them, and the bias is the largest
 * |count(r)/maxFair − 1/range|. Zero exactly when maxFair is a whole multiple of `range`.
 */
export function drawBias(range: number): { maxFair: number; rejectProbability: number; bias: number; exact: boolean } {
  const TWO32 = 0x1_0000_0000;
  const maxFair = maxFairFor(range);
  const mf = BigInt(maxFair), r = BigInt(range);
  const q = mf / r, rem = mf % r;
  // count(residue) ∈ {q, q+1}; deviation of each from maxFair/range, scaled by range·maxFair.
  const devLo = mf - q * r;                          // |q·range − maxFair|
  const devHi = rem === 0n ? 0n : (q + 1n) * r - mf; // |(q+1)·range − maxFair|
  const worst = devLo > devHi ? devLo : devHi;
  const bias = Number(worst) / (range * maxFair);
  return { maxFair, rejectProbability: (TWO32 - maxFair) / TWO32, bias, exact: worst === 0n };
}
