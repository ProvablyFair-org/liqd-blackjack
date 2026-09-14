import { strict as assert } from 'node:assert';
import { computeOptimalRTP } from '../../src/optimal-play';

// Engine-drift guard.
//
// The analytical optimal-play RTP feeds Step 17's consistency gate in `src/simulate.ts`.
// Because that gate compares the simulator against this engine, a silent regression in the
// engine (a rule change, a cache bug, a rounding shift) would move BOTH sides together and
// pass unnoticed. This test pins the engine's output to its known value so a drift fails the
// build rather than quietly recalibrating the gate it anchors.
//
// Expected: computeOptimalRTP('stand', true).rtp = 0.994296119877263 (S17, DAS, no
// surrender, dealer peek; infinite-deck limit). The engine is deterministic — every run
// reproduces the same double — so the tolerance is 1e-9, not a "numerical variation"
// band. The previous ±2e-4 band was ~13× wider than the peek-conditioning defect this
// repo just shed (~1.5e-5): a drift guard looser than the drifts that matter guards
// nothing.

describe('blackjack: optimal-play engine drift guard', () => {
  it("computeOptimalRTP('stand', true).rtp is pinned to 0.994296119877263 (±1e-9)", () => {
    const { rtp } = computeOptimalRTP('stand', true);
    assert.ok(
      Math.abs(rtp - 0.994296119877263) <= 1e-9,
      `optimal-play RTP drifted: got ${rtp.toFixed(15)}, expected 0.994296119877263 ±1e-9`,
    );
  });
});
