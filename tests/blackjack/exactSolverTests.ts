/**
 * Exact solver — publication gate for the engine.
 *
 * The engine replaces an infinite-deck anchor that modelled the wrong game, so
 * these tests exist to prove it is right *and* falsifiable, not merely that it
 * produces a number. Solves are cached across tests: an 8-deck solve takes tens of seconds.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import {
  solveExact, LIQD_RULES, Rules, ShoeModel, Strategy, ExactResult,
  buildExactArtifact, serializeExactArtifact,
} from '../../src/exact-play';
import { computeOptimalRTP } from '../../src/optimal-play';
import { SIM_BASE_ROUNDS, SIM_SD_PER_ROUND } from '../../src/config';
import * as simResults from '../../outputs/simulation-results.json';

const cache = new Map<string, ExactResult>();
function solve(model: ShoeModel, strategy: Strategy, rules: Rules = LIQD_RULES, tag = ''): ExactResult {
  const k = JSON.stringify(model) + strategy + tag;
  let r = cache.get(k);
  if (!r) { r = solveExact(model, strategy, rules); cache.set(k, r); }
  return r;
}
const pct = (r: ExactResult) => r.edgePerInitialBet * 100;

describe('Exact solver — infinite mode reproduces the published infinite-deck reference engine', () => {
  it('matches the legacy infinite-deck solver to floating-point precision', () => {
    const legacy = computeOptimalRTP('stand', true).rtp;
    const fresh  = solve({ kind: 'infinite' }, 'CD').rtpPerInitialBet;
    // NOT asserted bit-for-bit. The two engines sum the same quantities in a
    // different order, so they differ in the last ~2 ULP (~1.1e-15). That is
    // float summation order, not a modelling difference; asserting exact equality
    // would be asserting an accident of iteration order.
    assert.ok(Math.abs(legacy - fresh) < 1e-12,
      `infinite mode drifted from the published infinite-deck reference figure: ${legacy} vs ${fresh}`);
    assert.strictEqual(fresh.toFixed(12), (0.994296119877263).toFixed(12));
  });

  it('a very large finite shoe converges to the infinite-deck limit', () => {
    const inf   = solve({ kind: 'infinite' }, 'CD').edgePerInitialBet * 100;
    const big   = solve({ kind: 'finite', decks: 5000 }, 'CD').edgePerInitialBet * 100;
    assert.ok(Math.abs(big - inf) < 0.01,
      `finite(5000) should approach infinite: ${big.toFixed(6)} vs ${inf.toFixed(6)}`);
  });
});

describe('Exact solver — finite 8-deck, the figure LIQD publishes', () => {
  it('the enumeration is a proper probability distribution', () => {
    const r = solve({ kind: 'finite', decks: 8 }, 'TD');
    assert.ok(Math.abs(r.probabilityMass - 1) < 1e-9,
      `initial-deal probabilities must sum to 1, got ${r.probabilityMass}`);
  });

  it('exact 8-deck TD edge is pinned to 0.004876748223247249 (±1e-12) — internal drift guard', () => {
    // Deterministic solve → the double reproduces bit-for-bit. This 1e-12 pin is the ENGINE drift
    // guard (distinct from the external WoO anchor, which resolves only to ~1e-4 pp). A regression
    // in the solver moves this and fails the build rather than silently recalibrating the headline.
    const r = solve({ kind: 'finite', decks: 8 }, 'TD');
    assert.ok(Math.abs(r.edgePerInitialBet - 0.004876748223247249) < 1e-12,
      `exact 8-deck TD edge drifted: got ${r.edgePerInitialBet}, expected 0.004876748223247249 ±1e-12`);
  });

  it('EVERY field of the committed outputs/exact-rtp.json is re-derived by buildExactArtifact()', () => {
    // Round-1 fix pinned three fields of finite8TD by hand. Round-2 QA item 1: that is a guard
    // over ~3 of ~60 key paths — `rtpPerTotalWagered` (README headline 0.432435%), `avgWager`
    // (README headline 1.127741), `finite1TD`, `infiniteCD`, `cardRemovalLiftPP`,
    // `wooAnchor.sixDeckExact` and the whole wooAnchor block were unguarded, and a hand-edit of
    // any of them passed 45/45 + 31/31 + exit 0.
    //
    // The artifact is now built by ONE exported function (src/exact-play.ts buildExactArtifact),
    // which `npm run rtp` writes and this test re-derives. deepStrictEqual binds every key path
    // that exists, and any field added to the builder later is covered the moment it exists —
    // no per-field list to keep in sync. The solves are injected from this file's cache, so this
    // costs no extra solve time (the 1-deck and 6-deck solves are reused by the mutation battery).
    const artifactPath = path.join(__dirname, '..', '..', 'outputs', 'exact-rtp.json');
    const raw = fs.readFileSync(artifactPath, 'utf8');
    const fresh = buildExactArtifact((model, strategy, rules) => solve(model, strategy, rules ?? LIQD_RULES));
    // deepStrictEqual first: it names the differing key path, which a byte diff cannot.
    assert.deepStrictEqual(JSON.parse(raw), JSON.parse(JSON.stringify(fresh)),
      'outputs/exact-rtp.json differs from a fresh buildExactArtifact() — the committed artifact was hand-edited, or the solver drifted');
    // …then byte identity, which additionally pins key ORDER and the serialisation the CLI writes.
    assert.strictEqual(raw, serializeExactArtifact(fresh),
      'outputs/exact-rtp.json is not byte-identical to serializeExactArtifact(buildExactArtifact()) — re-run `npm run rtp`');
  });

  it('natural frequency matches the closed form 2*(32/416)*(128/415)', () => {
    const r = solve({ kind: 'finite', decks: 8 }, 'TD');
    const closed = 2 * (32 / 416) * (128 / 415);
    assert.ok(Math.abs(r.playerBlackjackFreq - closed) < 1e-6,
      `player natural ${r.playerBlackjackFreq} vs closed form ${closed}`);
  });

  it('agrees with the 30M-round simulation within 3 sigma (per initial bet)', () => {
    const r = solve({ kind: 'finite', decks: 8 }, 'TD');
    const sim: any = simResults;
    const rounds = sim.baseGame.rounds;
    // sigma is computed from the PINNED round count, not from the artifact's own `rounds`.
    // Reading `rounds` out of the file being gated let the artifact set its own tolerance:
    // a reviewer forged baseGame to claim 1,000,000 rounds and 99.20% RTP, re-pinned
    // SIMULATION_SHA256, and both this test and scored Step 17 passed on a 5.5x wider
    // window that hid a 0.31 pp miss. The claimed count must EQUAL the pin, and the pin is
    // what sets the gate. (Same fix, same reason, in tests/steps/simulation.ts.)
    assert.equal(rounds, SIM_BASE_ROUNDS,
      `simulation-results.json claims ${rounds} rounds but SIM_BASE_ROUNDS is pinned at ${SIM_BASE_ROUNDS} ` +
      '— a claimed round count cannot set its own acceptance window');
    const simEdge = sim.baseGame.edgeInitial * 100;
    const sigma = (SIM_SD_PER_ROUND / Math.sqrt(SIM_BASE_ROUNDS)) * 100;   // pinned; measured per-round SD 1.146718922176392, rounded up
    const delta = Math.abs(pct(r) - simEdge);
    assert.ok(delta <= 3 * sigma,
      `exact ${pct(r).toFixed(6)}% vs sim ${simEdge.toFixed(6)}% over ${SIM_BASE_ROUNDS} pinned rounds ` +
      `= ${(delta / sigma).toFixed(2)} sigma (limit 3)`);
  });

  it('agrees with the simulation on average wager per round', () => {
    const r = solve({ kind: 'finite', decks: 8 }, 'TD');
    const simWager = (simResults as any).baseGame.avgWager;
    assert.ok(Math.abs(r.avgWager - simWager) < 1e-3,
      `exact avg wager ${r.avgWager} vs sim ${simWager}`);
  });

  it('sits ABOVE the infinite-deck limit, as card removal predicts', () => {
    const inf = solve({ kind: 'infinite' }, 'CD').rtpPerInitialBet;
    const fin = solve({ kind: 'finite', decks: 8 }, 'TD').rtpPerInitialBet;
    const liftPP = (fin - inf) * 100;
    assert.ok(liftPP > 0, `finite must exceed infinite, lift was ${liftPP.toFixed(4)} pp`);
    assert.ok(liftPP > 0.05 && liftPP < 0.10,
      `card-removal lift expected 0.05-0.10 pp, got ${liftPP.toFixed(4)} pp`);
  });
});

describe('Exact solver — CD is a COARSE diagnostic on the strategy table, not a figure', () => {
  // DEMOTED (decision-6, 2026-08-23). Finite-shoe CD under peek still carries the
  // peek-conditioning approximation: it cannot use the hole-explicit architecture,
  // because an argmax evaluated inside a fixed-hole branch lets the player choose as
  // if the hole were visible (measured: +5.5 pp — a peeking player). The correct CD
  // form is a per-node posterior mixture and is not implemented.
  //
  // So CD keeps exactly one job: catching a GROSS error in the shared strategy table,
  // which the simulation and the TD solver both read and could therefore both be wrong
  // about together. The tolerance below is sized for that job, and deliberately NOT for
  // precision — CD cannot confirm anything below its own error, so no CD figure and no
  // CD-TD gap may be published. Fine-grained validation of TD lives in the tiny-shoe
  // exact-rational oracle, not here.
  it('is flagged approximate, so it can never be mistaken for a publishable figure', () => {
    const cd = solve({ kind: 'finite', decks: 8 }, 'CD');
    const td = solve({ kind: 'finite', decks: 8 }, 'TD');
    assert.strictEqual(cd.cdPeekIsApproximate, true,
      'finite CD under peek must self-identify as approximate');
    assert.strictEqual(td.cdPeekIsApproximate, false,
      'TD is hole-explicit and exact — it must NOT carry the approximation flag');
  });

  it('shows no GROSS strategy-table error (coarse bound, not a precision claim)', () => {
    const td = pct(solve({ kind: 'finite', decks: 8 }, 'TD'));
    const cd = pct(solve({ kind: 'finite', decks: 8 }, 'CD'));
    assert.ok(cd <= td, `CD edge ${cd.toFixed(6)}% must not exceed TD edge ${td.toFixed(6)}%`);
    // 0.05 pp is ~15x CD's own residual error and ~10x the true CD-TD gap, so it can
    // only fire on a real table defect — which is the whole and only point of this check.
    assert.ok(td - cd < 0.05,
      `CD-TD gap ${(td - cd).toFixed(6)} pp exceeds the coarse 0.05 pp bound — ` +
      `that magnitude means a genuine strategy-table error, not the CD approximation`);
  });
});

describe('Exact solver — mutation battery (falsifiability)', () => {
  // Flipping a rule must move the exact figure by roughly the published amount.
  // A mutation that does NOT move it is a finding. Where our figure and the
  // published constant disagree, the reason is recorded rather than the
  // tolerance quietly widened.
  const base = () => pct(solve({ kind: 'finite', decks: 8 }, 'TD'));

  it('H17 costs the player about +0.22 pp', () => {
    const d = pct(solve({ kind: 'finite', decks: 8 }, 'TD', { ...LIQD_RULES, s17: false }, 'h17')) - base();
    assert.ok(Math.abs(d - 0.22) <= 0.03, `H17 delta ${d.toFixed(4)} pp, expected ~+0.22`);
  });

  it('removing DAS costs about +0.14 pp', () => {
    const d = pct(solve({ kind: 'finite', decks: 8 }, 'TD', { ...LIQD_RULES, das: false }, 'nodas')) - base();
    assert.ok(Math.abs(d - 0.14) <= 0.03, `no-DAS delta ${d.toFixed(4)} pp, expected ~+0.14`);
  });

  it('6 decks is very slightly better for the player than 8', () => {
    const d = pct(solve({ kind: 'finite', decks: 6 }, 'TD')) - base();
    assert.ok(Math.abs(d - (-0.02)) <= 0.03, `6-deck delta ${d.toFixed(4)} pp, expected ~-0.02`);
  });

  it('6:5 blackjack matches the closed form for EIGHT decks, not the single-deck constant', () => {
    // Commonly quoted as +1.39 pp, but that constant is a SINGLE-DECK figure.
    // The cost is exactly (1.5 - 1.2) x P(player natural) x P(dealer not natural | player natural),
    // where the conditional dealer-natural probability draws from the 414 cards left after the
    // player's ace+ten are removed: 2*31*127/(414*413). Conditioning is what makes it exact —
    // the unconditional form (1 - dealerBlackjackFreq) is ~0.002 pp high. P(natural) is lower at
    // 8 decks, so ~1.358 pp is the correct 8-deck value.
    const r8 = solve({ kind: 'finite', decks: 8 }, 'TD');
    const d = pct(solve({ kind: 'finite', decks: 8 }, 'TD', { ...LIQD_RULES, blackjackPays: 1.2 }, 'bj65')) - base();
    const dealerNatGivenPlayerNat = 2 * 31 * 127 / (414 * 413);   // 8 decks, ace+ten already removed
    const closed = 0.3 * r8.playerBlackjackFreq * (1 - dealerNatGivenPlayerNat) * 100;
    assert.ok(Math.abs(d - closed) < 1e-6,
      `6:5 delta ${d.toFixed(6)} pp must match the conditional closed form ${closed.toFixed(6)} pp`);
    assert.ok(d > 1.3 && d < 1.4, `6:5 delta ${d.toFixed(4)} pp out of range`);
  });

  it('removing the peek moves the figure against the player', () => {
    // Modelled as: the player uses the SAME peek-optimal table and loses every
    // wagered unit to a dealer natural. The natural penalty is applied outside
    // the recursion, so CD cannot adapt to it either — this is an UPPER BOUND on
    // the cost, and it runs above the ~+0.11 pp usually published for ENHC with
    // re-optimised strategy. LIQD peeks, so this mutation is a probe only.
    const d = pct(solve({ kind: 'finite', decks: 8 }, 'TD', { ...LIQD_RULES, peek: false }, 'nopeek')) - base();
    assert.ok(d > 0.10 && d < 0.25, `no-peek delta ${d.toFixed(4)} pp out of the expected band`);
  });

  it('a single deck moves strongly in the player\'s favour', () => {
    // Delta -0.571 pp vs the 8-deck figure. Accounted for: the published 1-deck csm edge at this
    // rule set is -0.11442% (0.602 pp below 8 decks); the remaining 0.031 pp is the cost of playing
    // the 8-deck total-dependent table on a single deck instead of a 1-deck-optimised table.
    // See rtp-analysis.md. LIQD deals 8 decks, so this does not affect the published figure.
    const d = pct(solve({ kind: 'finite', decks: 1 }, 'TD')) - base();
    assert.ok(d < -0.35 && d > -0.75, `1-deck delta ${d.toFixed(4)} pp out of the expected band`);
  });
});
