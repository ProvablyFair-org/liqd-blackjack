/**
 * A DETERMINISTIC, REPLAYABLE uniform-integer stream — the randomness the Pass-0 reference
 * shuffle consumes.
 *
 * WHY THIS MODULE EXISTS.
 *
 * The 30,000,000-round reference pass used to draw from `Math.random()`. `Math.random()` is
 * seeded by the engine from entropy the program never sees, so the input to that experiment was
 * destroyed the moment the process exited: the committed RTP, its standard error and every
 * convergence checkpoint could be read, but not reproduced. That is a material evidence gap: a
 * Monte-Carlo result whose input stream cannot be re-created is a claim about a run nobody else
 * can perform.
 *
 * The randomness of a simulation is an INPUT, not a by-product. So the reference pass now draws
 * from this stream, which is a pure function of a 16-byte seed derived from the run's master seed
 * (`src/rng.ts` deriveSeedHex, domain `pass0-reference-shuffle`). The master seed is recorded in
 * `outputs/simulation-results.json` and `outputs/simulation-provenance.json`, so re-running the
 * pass from the recorded seed reproduces the committed figures exactly — see `src/replay.ts`,
 * `src/deep-replay.ts`, and the first-checkpoint binding in scored Step 17.
 *
 * WHY NOT THE HMAC PRIMITIVE. `src/rng.ts` already has a bias-free draw, and Pass 1 and Pass 2 use
 * it because they are testing the operator's actual shoe. Pass 0 is not testing a shoe: it measures
 * the RTP of the RULE SET under an assumed-uniform shuffle, at a sample size (30M rounds ≈ 750M
 * draws) where a keyed hash per draw is not practical. This is therefore a fast, ordinary,
 * NON-CRYPTOGRAPHIC generator, and nothing in the audit rests on it being unpredictable — only on
 * it being uniform enough for a Monte-Carlo mean and, above all, on it being REPRODUCIBLE.
 *
 * WHY xoshiro128** SPECIFICALLY. It is a published, fully specified 32-bit algorithm (Blackman &
 * Vigna, 2018), it needs no 64-bit arithmetic, and it is short enough to be re-implemented from
 * this file in another language without ambiguity — which is the point: `replay/replay-bootstrap.py`
 * re-implements this repo's derivations in Python's standard library, and a generator that could
 * only be described as "whatever V8 does" could not be re-implemented at all.
 *
 * BIAS. `below(n)` uses the SAME rejection rule as the operator's own draw primitive
 * (`generateProvablyFairNumber`): reject any 32-bit word at or above `floor(2^32 / n) * n`, then
 * take the remainder. That is exact uniformity on [0, n), not the `(Math.random() * n) | 0`
 * float truncation the pass used before, whose bias is ~2^-53 relative and irrelevant here but
 * which is not reproducible across engines. Both properties are asserted in
 * `tests/blackjack/prngTests.ts`.
 */

/** A stream of uniform 32-bit words, plus the unbiased index draw the shuffler needs. */
export interface UniformStream {
  /** Next 32-bit word, as an unsigned integer in [0, 2^32). */
  nextUint32(): number;
  /** Uniform integer in [0, n), by rejection — no modulo bias. */
  below(n: number): number;
}

const rotl = (x: number, k: number): number => (((x << k) | (x >>> (32 - k))) >>> 0);

/**
 * xoshiro128** seeded from the first 16 bytes of `seedHex` (four big-endian 32-bit words).
 *
 * Throws on a seed that is not 32+ hex characters or whose first 16 bytes are all zero — the
 * all-zero state is the generator's single fixed point and would emit nothing but zeros, which
 * is the one input that must never pass silently.
 */
export function xoshiro128ss(seedHex: string): UniformStream {
  if (!/^[0-9a-f]{32,}$/.test(seedHex)) {
    throw new Error(`xoshiro128ss: seed must be at least 16 bytes of lowercase hex, got ${JSON.stringify(seedHex)}`);
  }
  const bytes = Buffer.from(seedHex.slice(0, 32), 'hex');
  const s = new Uint32Array(4);
  for (let i = 0; i < 4; i++) s[i] = bytes.readUInt32BE(i * 4);
  if (s[0] === 0 && s[1] === 0 && s[2] === 0 && s[3] === 0) {
    throw new Error('xoshiro128ss: the all-zero state is degenerate and is refused');
  }

  const nextUint32 = (): number => {
    const result = (Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9)) >>> 0;
    const t = (s[1] << 9) >>> 0;
    s[2] = (s[2] ^ s[0]) >>> 0;
    s[3] = (s[3] ^ s[1]) >>> 0;
    s[1] = (s[1] ^ s[2]) >>> 0;
    s[0] = (s[0] ^ s[3]) >>> 0;
    s[2] = (s[2] ^ t) >>> 0;
    s[3] = rotl(s[3], 11);
    return result;
  };

  const below = (n: number): number => {
    if (!Number.isInteger(n) || n < 1 || n > 0x1_0000_0000) {
      throw new Error(`xoshiro128ss.below: range must be an integer in [1, 2^32], got ${String(n)}`);
    }
    const limit = Math.floor(0x1_0000_0000 / n) * n;
    for (;;) {
      const v = nextUint32();
      if (v < limit) return v % n;
    }
  };

  return { nextUint32, below };
}
