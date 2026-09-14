/**
 * Step 17: Simulation — finite 8-deck RTP consistency estimate + statistical validation.
 *
 * Reads outputs/simulation-results.json (produced by `npm run simulate`, Monte-Carlo
 * on the real blackjackShoe algorithm with optimal basic strategy). Until the
 * simulation has been run, this step is informational only. The live-bet money path is ALWAYS
 * informational (a reconciliation, NOT an RTP estimate — n=6,000 has no statistical power for
 * RTP); authoritative RTP is the EXACT 8-deck solve (src/exact-play.ts), which this simulation
 * confirms rather than establishes; stated per initial bet.
 */

import * as fs from 'fs';
import * as path from 'path';
import { step } from './context';
import type { StepResult, InfoItem, VerifyContext } from './context';
import {
  isBlackjack, rankOf,
  SIM_BASE_ROUNDS, SIM_PASS1_ROUNDS, SIM_SD_PER_ROUND,
  RANKS, FIRST_CARD_DF, PASS2_ALPHA, PASS2_P0, PASS2_EARLY_NONCES, EXPECTED_SEEDS, cherryPickFlag,
} from '../../src/config';
import { blackjackShoe } from '../../src/rng';
import { solveExact } from '../../src/exact-play';
import { computeOptimalRTP } from '../../src/optimal-play';
import { chiSquaredPValue, chiSquaredTest, binomialSurvival } from '../../src/stats';

export function run(ctx: VerifyContext): { scored: StepResult[]; info: InfoItem[] } {
  const { bets } = ctx;
  const scored: StepResult[] = [];
  const info: InfoItem[] = [];

  // ── Money-path reconciliation (informational — NOT an RTP measurement) ──────────
  // Total wagered = every stake placed (line 21 definition). Each hand contributes its own
  // stake; a DOUBLE adds one further stake for THAT hand. A doubled split doubles BOTH hands,
  // so the number of extra stakes is the count of `double` actions in the round — not one per
  // round. (An earlier version added a single matching stake per doubled round, which
  // understated total wagered by 26.40 across the 165 doubled-split rounds, all of which
  // doubled both hands.) Insurance is tracked separately so we can also show the figure
  // excluding the −EV insurance the capture placed on dealer-Ace hands.
  //
  // This is NOT a return-to-player estimate: at n=6,000 the sample has no statistical power for
  // RTP — the money-weighted effective size is only ~332 rounds once the $10 phase-E stakes
  // dominate (SE ≈ ±6pp; even equal-weighted it is ≈ ±1.5pp) — and the phases deliberately
  // include suboptimal strategies. The percentages below reconcile the money path; they are not
  // an RTP figure. Authoritative RTP is the exact 8-deck solve (Step 17, RTP Analysis); the
  // simulation confirms it.
  let wagered = 0, returned = 0, insWager = 0, insReturn = 0;
  for (const b of bets) {
    for (const h of b.playerHands) wagered += Number(h.betAmount);          // each hand's own stake
    const nDoubles = b.actions.filter((a) => a === 'double').length;        // one extra stake per doubled hand
    wagered += nDoubles * Number(b.playerHands[0].betAmount);
    for (const key of ['perfectPair', 'twentyOnePlusThree'] as const) {
      const sb = b.sideBets[key] as { betAmount?: number | string } | null;
      if (sb && sb.betAmount != null) wagered += Number(sb.betAmount);
    }
    const ins = b.sideBets.insurance as { betAmount?: number | string; winningAmount?: number | string } | null;
    if (ins && ins.betAmount != null) { insWager += Number(ins.betAmount); insReturn += Number(ins.winningAmount || 0); }
    returned += Number(b.winningAmount);
  }
  const reconIncl = returned / (wagered + insWager);
  const reconExcl = (returned - insReturn) / wagered;
  info.push({ label: 'Money-path reconciliation (all wagers incl. side bets + insurance)', detail: `${wagered.toFixed(2)} wagered + ${insWager.toFixed(2)} insurance, ${returned.toFixed(2)} returned = ${(reconIncl * 100).toFixed(4)}% over ${bets.length} hands — RECONCILIATION ONLY, not an RTP estimate (n=6,000 has ~±6pp money-weighted power)` });
  info.push({ label: 'Money-path reconciliation (excl. insurance)', detail: `${(reconExcl * 100).toFixed(4)}% — insurance (${insWager.toFixed(2)} wagered, ${insReturn.toFixed(2)} returned) is a −EV side wager the capture placed on dealer-Ace hands` });
  const naturals = bets.filter((b) => !b.split && isBlackjack(b.playerHands[0].cards)).length;
  info.push({ label: 'Player natural blackjacks', detail: `${naturals}/${bets.length} = ${(naturals / bets.length * 100).toFixed(2)}% (8-deck expectation ≈ 4.75%)` });

  // Scored steps from the simulation, if it has been run.
  const simPath = path.join(ctx.outputsDir, 'simulation-results.json');
  if (fs.existsSync(simPath)) {
    const sim = JSON.parse(fs.readFileSync(simPath, 'utf8'));

    // Step 17 — finite 8-deck RTP, gated against the EXACT solver.
    //
    // Previously this compared the simulation against the infinite-deck limit with a
    // hand-picked `MAX_REMOVAL_LIFT = 0.0015` on top of the Monte-Carlo tolerance —
    // a 0.32 pp acceptance window on a 0.49% quantity, wide enough for a 0.15 pp
    // strategy bug to pass unnoticed, and the constant was not derived from anything
    // in the repo. Both the anchor and the slack are now gone: the simulation is
    // compared like-for-like against the exact 8-deck EV of the very strategy table
    // it plays, with only Monte-Carlo error allowed.
    //
    // The exact figure is RECOMPUTED here rather than read from the simulation
    // artifact. A scalar the simulator wrote about itself cannot check the simulator.
    const exactTD = solveExact({ kind: 'finite', decks: 8 }, 'TD');
    const exactEdge = exactTD.edgePerInitialBet;
    const exactPerTotal = exactTD.edgePerTotalWagered;

    const rtpInitial = sim.baseGame?.rtpInitial ?? sim.baseGame?.rtp ?? sim.rtp;
    const rtpPerTotal = sim.baseGame?.rtpPerTotalWagered;
    const rounds = sim.baseGame?.rounds ?? sim.rounds;

    // ── The tolerance is NOT read from the artifact it gates (G-BIND) ──────────
    // `se = SD / sqrt(rounds)` with `rounds` taken from simulation-results.json let the
    // artifact set its own acceptance window. A reviewer forged the file to claim 1,000,000
    // rounds and 99.20% RTP, re-pinned SIMULATION_SHA256, and this step printed
    //   [PASS] 17 … simulation 0.8000% over 1,000,000 rounds (±0.1150 pp 1σ) → 2.72σ, limit 3σ
    // — 56 passing (the suite's size on that 2026-09-09 run; a historical record, not the current
    // test count), 31/31, Full Pass. Claiming 30× fewer rounds bought a 5.5× wider gate and
    // hid a 0.31 pp miss. σ now comes from SIM_BASE_ROUNDS in src/config.ts, and the
    // artifact's own round count must EQUAL that pin or the step hard-FAILs. A forger who
    // wants a looser gate has to widen it in source, in a diff a human reads.
    const roundsPinned = Number(rounds) === SIM_BASE_ROUNDS;
    const se = SIM_SD_PER_ROUND / Math.sqrt(SIM_BASE_ROUNDS);   // pinned; measured SD 1.146718922176392, rounded up
    const TOL = 3 * se;                                          // Monte-Carlo error only

    const simEdge = rtpInitial != null ? 1 - rtpInitial : NaN;
    const dev = Math.abs(simEdge - exactEdge);
    // The per-total-wagered statistic is the per-initial one divided by the average wager, so
    // its sampling error scales the same way. Dividing it by the per-INITIAL SE made this half
    // of the gate ~13% looser than the stated 3σ.
    const sePerTotal = se / exactTD.avgWager;
    const TOL_PER_TOTAL = 3 * sePerTotal;
    const devPerTotal = rtpPerTotal != null ? Math.abs((1 - rtpPerTotal) - exactPerTotal) : NaN;
    const consistent = roundsPinned && rtpInitial != null && dev <= TOL
      && (rtpPerTotal == null || devPerTotal <= TOL_PER_TOTAL);

    // ARTIFACT-INTEGRITY GUARD (hard FAIL, not a flag): the card-removal lift carried in the
    // artifact must equal the value recomputed here from two independent engines. A hand-pasted
    // scalar (the exact failure mode that once shipped) cannot survive this — the recomputation
    // is (exact finite-8 TD RTP) − (infinite-deck optimal RTP), the same quantity simulate.ts writes.
    const liftRecomputed = (exactTD.rtpPerInitialBet - computeOptimalRTP('stand', true).rtp) * 100;
    const liftArtifact = Number(sim.cardRemovalLiftPP);
    const liftOk = Number.isFinite(liftArtifact) && Math.abs(liftArtifact - liftRecomputed) < 1e-9;

    // A round count that disagrees with the pin is a FAIL, not a FLAG: it means the artifact
    // is not the run this repo publishes, and every σ printed below would be about a
    // different experiment.
    const status17 = (!liftOk || !roundsPinned) ? 'FAIL' : (consistent ? 'PASS' : 'FLAG');
    scored.push(step(17, 'Basic-strategy RTP vs exact 8-deck solver', status17,
      `exact TD edge ${(exactEdge * 100).toFixed(6)}% per initial bet ` +
      `(${(exactPerTotal * 100).toFixed(6)}% per total wagered, avg wager ${exactTD.avgWager.toFixed(6)}); ` +
      `simulation ${(simEdge * 100).toFixed(4)}% over ${Number(rounds).toLocaleString()} rounds ` +
      `(±${(se * 100).toFixed(4)} pp 1σ, σ computed from the PINNED ${SIM_BASE_ROUNDS.toLocaleString()} rounds in src/config.ts, never from the artifact) → ${(dev / se).toFixed(2)}σ, limit 3σ` +
      (rtpPerTotal != null ? `; per total wagered ${(devPerTotal / sePerTotal).toFixed(2)}σ (±${(sePerTotal * 100).toFixed(4)} pp 1σ)` : '') +
      `. Exact figure recomputed in-step, not read from the artifact.` +
      (roundsPinned
        ? ''
        : ` — ARTIFACT baseGame.rounds=${String(rounds)} DISAGREES with the pinned SIM_BASE_ROUNDS=${SIM_BASE_ROUNDS}: a claimed round count cannot set its own tolerance.`) +
      (liftOk
        ? ` Card-removal lift ${liftArtifact.toFixed(6)} pp matches the in-step recomputation.`
        : ` — ARTIFACT cardRemovalLiftPP=${sim.cardRemovalLiftPP} DISAGREES with the recomputed ${liftRecomputed.toFixed(9)} pp (hand-edited or stale artifact).`)));

    // Step 18 — Pass 1 RNG validation on the real shoe (first-card uniformity + serial independence).
    //
    // HARDENING: the verdict is RECOMPUTED from the raw statistics. It previously read
    // `firstCardUniformFail` / `serialFail` — booleans the simulator wrote about itself —
    // so an artifact carrying χ²=9999 with the flags left false still scored PASS. A scalar
    // the simulator asserts about its own output cannot check the simulator. The p-value is
    // re-derived from (χ², df) via the exact regularized incomplete gamma, and the
    // pre-registered thresholds are applied to the numbers directly.
    // THE df WAS ARTIFACT-SUPPLIED AND UNBOUND. Recomputing p from (χ², df) is only a
    // recomputation if BOTH inputs are bound. A reviewer set
    //   firstCardChi2 = 9999, firstCardDf = 100000, firstCardPValue = 1
    // and re-pinned: this step printed "p=1.0000 RECOMPUTED from χ²/df" and PASSed, because
    // χ²=9999 on 100,000 df really is p≈1. The df of a 13-bin rank test is RANKS−1 and
    // nothing else, so it comes from src/config.ts (FIRST_CARD_DF) and the artifact's own
    // `firstCardDf` must agree with it. `rounds` is pinned for the same reason as Step 17's.
    const p1 = sim.pass1_fresh_seeds;
    if (p1 && Number(p1.rounds) > 0) {
      const rounds1 = Number(p1.rounds);
      const chi2 = Number(p1.firstCardChi2);
      const dfArtifact = Number(p1.firstCardDf);
      const dfOk = dfArtifact === FIRST_CARD_DF;
      const pRecomputed = chiSquaredPValue(chi2, FIRST_CARD_DF); // df PINNED, not read
      const z1 = Math.abs(Number(p1.serialR1Z));
      const runsP = Number(p1.serialRunsPValue);
      const roundsOk = rounds1 === SIM_PASS1_ROUNDS;

      const uniformOk = Number.isFinite(chi2) && pRecomputed >= 0.01;
      const serialOk = Number.isFinite(z1) && z1 < 3 && Number.isFinite(runsP) && runsP >= 0.01;
      // The artifact's own p must agree with the recomputation, or it has been doctored.
      const pAgrees = Number.isFinite(Number(p1.firstCardPValue))
        && Math.abs(Number(p1.firstCardPValue) - pRecomputed) < 1e-6;
      // A statistic outside its threshold is a FLAG — that is a finding about the RNG.
      // An artifact field that CONTRADICTS a pin or a recomputation is a FAIL — that is a
      // finding about the artifact, and it must not resolve to "Conditional Pass".
      const contradiction18 = !dfOk || !roundsOk || !pAgrees;
      const ok18 = uniformOk && serialOk && !contradiction18;

      scored.push(step(18, 'Simulation Pass 1 — first-card uniformity + serial independence',
        contradiction18 ? 'FAIL' : ok18 ? 'PASS' : 'FLAG',
        `first-card rank χ²=${chi2.toFixed(2)} (df ${FIRST_CARD_DF} PINNED as RANKS−1 in src/config.ts, p=${pRecomputed.toFixed(4)} RECOMPUTED from χ² at that df, threshold ≥0.01); ` +
        `serial |r₁z|=${z1.toFixed(2)} (threshold <3), runs p=${runsP.toFixed(4)} (threshold ≥0.01) ` +
        `over ${rounds1.toLocaleString()} rounds` +
        (dfOk ? '' : ` — ARTIFACT firstCardDf=${dfArtifact} DISAGREES with the pinned ${FIRST_CARD_DF}: a rank test on ${RANKS} bins has ${FIRST_CARD_DF} degrees of freedom and the artifact does not get to choose`) +
        (roundsOk ? '' : ` — ARTIFACT rounds=${rounds1} DISAGREES with the pinned SIM_PASS1_ROUNDS=${SIM_PASS1_ROUNDS}`) +
        (pAgrees ? '' : ` — ARTIFACT p=${Number(p1.firstCardPValue)} DISAGREES with the recomputed value`)));
    } else {
      // A block that is ABSENT from a pinned artifact is not "cannot score", it is a pinned
      // artifact that does not contain what the repo says it contains. FAIL, for the same reason
      // a missing artifact FAILs (Step 25): the alternative resolves to Conditional Pass, which
      // reads as a pass.
      scored.push(step(18, 'Simulation Pass 1 — first-card uniformity + serial independence', 'FAIL',
        'pass1_fresh_seeds missing or zero rounds in the PINNED outputs/simulation-results.json — the artifact does not contain the experiment this step scores; a step that vanishes from the scored set would shrink the denominator and still print a Full Pass'));
    }

    // Step 19 — Pass 2 cherry-pick detection over casino seeds (bootstrap null).
    //
    // WHAT WAS WRONG. The step said "RECOMPUTED" and was not. It read `cherryPickFlags` and
    // `expectedFlagsByChance` straight out of the artifact and derived p₀ = expected / seeds
    // from them, so setting `cherryPickFlags = 120, expectedFlagsByChance = 120,
    // cherryPickSurvivalP = 1` made p₀ = 1, the survival probability 1, and the step printed
    // "120 flag(s) over 120 seeds … RECOMPUTED … PASS" — a dataset in which every epoch had
    // flagged, scored as clean, 31/31 Full Pass. No mocha test read `pass2_casino_seeds` at
    // all, so nothing else looked.
    //
    // WHAT IT DOES NOW, in order of how much it costs to forge:
    //   (a) p₀ is PASS2_P0 = α(1−α) from src/config.ts — the declared significance level of
    //       the test, never an artifact field.
    //   (b) `seeds_tested` and `results.length` must equal EXPECTED_SEEDS, and the population
    //       of `results[]` is BOUND to the dataset: every row's (epoch, hashedServerSeed)
    //       pair must be a revealed seed record of the capture, and every revealed seed record
    //       must appear exactly once. A row count is not an identity (G-BIND).
    //   (c) `earlyChi2` is RECOMPUTED from the revealed serverSeed + clientSeed, re-deriving
    //       the shoe for each of the served nonces 0..PASS2_EARLY_NONCES−1 and running the same
    //       rank χ² through the same `chiSquaredTest` the simulator used. NOTE the bin count:
    //       at n=50 the expected count per rank is 50/13 = 3.85, below 5, so `chiSquaredTest`
    //       pools the two end bins (A with 2, Q with K) and the early statistic is an 11-bin χ²
    //       on df 10 — not 13 bins. That is why the early half is compared as a RAW χ² against
    //       the re-derivation rather than through a pinned df: the recomputation reproduces the
    //       simulator's statistic exactly (120/120), which is a stronger binding than agreeing
    //       on a df would be. Costs ~6,000 shoe derivations (~4 s).
    //   (d) `latePValue` is recomputed from the artifact's `lateChi2` at the PINNED df. The LATE
    //       window is 950 nonces, so its expected count per rank is 73 and NO pooling happens —
    //       13 bins, df = RANKS−1 = 12, which is exactly FIRST_CARD_DF. Verified against the
    //       committed artifact: row 0's lateChi2 8.934736842105263 gives p = 0.7084944471544968
    //       at df 12, which is the value the artifact carries (df 10 and 11 give 0.5383 and
    //       0.6279 and would not match).
    //   (e) `cherryPickFlags` is RECOMPUTED as the count of rows satisfying the test's own
    //       predicate, and the artifact's scalar must agree with it.
    //
    // WHAT REMAINS ARTIFACT-SUPPLIED, stated rather than implied:
    //   • `lateChi2` — the 950-nonce control window. Recomputing it costs 114,000 further shoe
    //     derivations (~70 s) on every scored run and every gate replay. Its p-value, its
    //     df and its role in the flag predicate are all bound; the raw statistic is not.
    //   • `earlyBootstrapP` — the bootstrap null is drawn from fresh `crypto.randomBytes`
    //     entropy on each `npm run simulate`, so it is not reproducible by construction. This
    //     is a property of the test, not an omission.
    // Both are disclosed here because a step that says RECOMPUTED must be exact about what it
    // recomputed; that overstatement is the defect this rewrite exists to fix.
    const p2 = sim.pass2_casino_seeds;
    if (p2 && Number(p2.seeds_tested) > 0) {
      const seedsClaimed = Number(p2.seeds_tested);
      const rows: Array<Record<string, unknown>> = Array.isArray(p2.results) ? p2.results : [];

      // (b) population binding against the dataset's own revealed seed records.
      const revealed = ctx.seeds.filter((s) => s.serverSeed != null);
      const revealedByHash = new Map(revealed.map((s) => [s.hashedServerSeed, s]));
      const seenHashes = new Set<string>();
      let rowsUnbound = 0;
      for (const r of rows) {
        const h = String(r.hashedServerSeed ?? '');
        const sd = revealedByHash.get(h);
        if (!sd || Number(r.epoch) !== sd.epoch || seenHashes.has(h)) rowsUnbound++;
        else seenHashes.add(h);
      }
      const populationOk = seedsClaimed === EXPECTED_SEEDS
        && rows.length === EXPECTED_SEEDS
        && revealed.length === EXPECTED_SEEDS
        && rowsUnbound === 0
        && seenHashes.size === EXPECTED_SEEDS;

      // (c)+(d)+(e) recompute the early statistic from seeds, the late p from the pinned df,
      // and the flag decision from the test's predicate.
      const expectedBins = new Array(RANKS).fill(PASS2_EARLY_NONCES / RANKS);
      let earlyBad = 0;
      let earlyChecked = 0;
      let lateBad = 0;
      let flagsRecomputed = 0;
      const earlyFails: string[] = [];
      for (const r of rows) {
        const sd = revealedByHash.get(String(r.hashedServerSeed ?? ''));
        if (sd && sd.serverSeed) {
          const freq = new Array(RANKS).fill(0);
          for (let n = 0; n < PASS2_EARLY_NONCES; n++) {
            freq[rankOf(blackjackShoe(sd.serverSeed, sd.clientSeed, n)[0]) - 1]++;
          }
          const chi2 = chiSquaredTest(freq, expectedBins).chi2;
          earlyChecked++;
          if (!(Math.abs(chi2 - Number(r.earlyChi2)) < 1e-9)) {
            earlyBad++;
            if (earlyFails.length < 3) earlyFails.push(`epoch ${String(r.epoch)}: artifact ${String(r.earlyChi2)} vs recomputed ${chi2.toFixed(6)}`);
          }
        }
        const lateP = chiSquaredPValue(Number(r.lateChi2), FIRST_CARD_DF);
        if (!(Math.abs(lateP - Number(r.latePValue)) < 1e-6)) lateBad++;
        // ONE definition of the predicate — src/config.ts `cherryPickFlag`, shared verbatim with
        // src/simulate.ts (which wrote the artifact) and src/cherry-pick-attack.ts (QA-04).
        if (cherryPickFlag(Number(r.earlyBootstrapP), lateP)) flagsRecomputed++;
      }

      const flagsClaimed = Number(p2.cherryPickFlags);
      const flagsAgree = flagsClaimed === flagsRecomputed;
      const expectedByChance = EXPECTED_SEEDS * PASS2_P0;
      const survivalRecomputed = binomialSurvival(flagsRecomputed, EXPECTED_SEEDS, PASS2_P0);
      const claimed = Number(p2.cherryPickSurvivalP);
      const agrees = Number.isFinite(claimed) && Math.abs(claimed - survivalRecomputed) < 1e-6;
      // Same split as Step 18: a survival probability below threshold is a FLAG (evidence of
      // selection); a population or recomputation contradiction is a FAIL (evidence about the
      // artifact). The reviewers' 120/120-flags forgery has to land in the second bucket.
      const contradiction19 = !populationOk || earlyChecked !== EXPECTED_SEEDS || earlyBad !== 0
        || lateBad !== 0 || !flagsAgree || !agrees;
      const ok19 = !contradiction19 && survivalRecomputed >= 0.01;

      scored.push(step(19, 'Simulation Pass 2 — cherry-pick detection (casino seeds)',
        contradiction19 ? 'FAIL' : ok19 ? 'PASS' : 'FLAG',
        `${flagsRecomputed} flag(s) RECOMPUTED over ${EXPECTED_SEEDS} seeds (expected ~${expectedByChance.toFixed(1)} by chance at p₀=${PASS2_P0.toFixed(4)} = α(1−α), α=${PASS2_ALPHA} PINNED in src/config.ts — never derived from the artifact's own expectedFlagsByChance); ` +
        `binomial survival P=${survivalRecomputed.toFixed(4)}, threshold ≥0.01. ` +
        `Population bound to the dataset: ${rows.length}/${EXPECTED_SEEDS} result rows, each matched one-to-one to a revealed seed record by (epoch, hashedServerSeed). ` +
        `earlyChi2 re-derived from the revealed seeds over the served nonces 0..${PASS2_EARLY_NONCES - 1}: ${earlyChecked - earlyBad}/${earlyChecked} reproduce exactly. ` +
        `latePValue re-derived from lateChi2 at the pinned df ${FIRST_CARD_DF}: ${rows.length - lateBad}/${rows.length} agree. ` +
        `NOT recomputed here, and stated so: the raw lateChi2 over the 950-nonce control window (≈70 s of shoe derivations per run) and earlyBootstrapP (the bootstrap null is drawn from fresh entropy each simulate run and is not reproducible by construction). ` +
        `This statistic tests first-card RANK UNIFORMITY over the served window — it does not read settled MONEY at all, and the measured experiment (npm run attack, outputs/cherry-pick-attack.json) found no significant excess of flags on deliberately money-selected blocks: 8 over 120 against a chance rate of 5.7, survival P=0.2117. That is a null result at that experiment's size, not a proof of zero power — see AUDIT_CONTEXT.md#seed-selection-and-server-operations. ` +
        `Primary defence is the client-seed-after-commitment mitigation.` +
        (populationOk ? '' : ` — POPULATION FAIL: seeds_tested=${seedsClaimed}, rows=${rows.length}, revealed seed records=${revealed.length}, ${rowsUnbound} row(s) not matched to a revealed seed record (declared ${EXPECTED_SEEDS})`) +
        (earlyBad === 0 ? '' : ` — ARTIFACT earlyChi2 DISAGREES with the re-derivation on ${earlyBad} seed(s): ${earlyFails.join('; ')}`) +
        (lateBad === 0 ? '' : ` — ARTIFACT latePValue DISAGREES with the recomputation on ${lateBad} row(s)`) +
        (flagsAgree ? '' : ` — ARTIFACT cherryPickFlags=${flagsClaimed} DISAGREES with the ${flagsRecomputed} recomputed from the rows' own predicate`) +
        (agrees ? '' : ` — ARTIFACT P=${claimed} DISAGREES with the recomputed value`)));
    } else {
      scored.push(step(19, 'Simulation Pass 2 — cherry-pick detection (casino seeds)', 'FAIL',
        'pass2_casino_seeds missing or zero seeds tested in the PINNED outputs/simulation-results.json — the artifact does not contain the experiment this step scores'));
    }
  } else {
    // A MISSING PINNED artifact is a FAIL, not a flag and certainly not a skip.
    //
    // History of this branch, because it is the repo's own worked example of the class:
    // originally the three steps were omitted entirely when the file was absent, and the suite
    // printed "18/18 PASS — PROVABLY FAIR — Full Pass" while three scored steps had never run.
    // That was fixed to FLAG. FLAG resolves to "Conditional Pass" and exit 2, which still
    // reads as a pass. But `outputs/simulation-results.json` is HASH-PINNED in src/config.ts:
    // the repo asserts it is a specific file. A pinned artifact that is not there is not an
    // incomplete run, it is a missing piece of the evidence the verdict rests on.
    //
    // The same fix was NOT applied to the two sibling artifacts, and a reviewer deleted
    // outputs/exact-rtp.json and outputs/rtp-convergence.html for 31/31 · Full Pass · exit 0.
    // Presence of every pinned artifact is now asserted in Step 25 (Artifact Hash
    // Integrity), so this branch and that step fail together rather than separately.
    const missing = 'outputs/simulation-results.json is HASH-PINNED in src/config.ts and is NOT PRESENT — a pinned artifact is load-bearing evidence, so its absence FAILs rather than flagging. Run `npm run test:full` to regenerate and re-pin, or restore the committed artifact. See also Step 25.';
    scored.push(step(17, 'Basic-strategy RTP (finite 8-deck)', 'FAIL', missing));
    scored.push(step(18, 'Simulation Pass 1 — first-card uniformity + serial independence', 'FAIL', missing));
    scored.push(step(19, 'Simulation Pass 2 — cherry-pick detection (casino seeds)', 'FAIL', missing));
    info.push({ label: 'Simulation', detail: 'pinned artifact absent — steps 17-19 FAIL; `npm run simulate` regenerates it' });
  }

  return { scored, info };
}
