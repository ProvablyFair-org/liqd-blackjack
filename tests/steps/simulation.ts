/**
 * Step 17: Simulation — finite 8-deck RTP consistency estimate + statistical validation.
 *
 * Reads outputs/simulation-results.json (produced by `npm run simulate`, Monte-Carlo
 * on the real blackjackShoe algorithm with optimal basic strategy). Until the
 * simulation has been run, this step is informational only. The live-bet money path is ALWAYS
 * informational (a reconciliation, NOT an RTP estimate — n=6,000 has no statistical power for
 * RTP); authoritative RTP is the EXACT 8-deck solve (src/exact-play.ts), with which this simulation
 * is consistent (it does not establish it); stated per initial bet.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { step } from './context';
import type { StepResult, InfoItem, VerifyContext } from './context';
import {
  isBlackjack, rankOf,
  SIM_BASE_ROUNDS, SIM_PASS1_ROUNDS, SIM_SD_PER_ROUND,
  SIM_BOOTSTRAP_REPS, BOOTSTRAP_NULL_FILE, BOOTSTRAP_SAMPLE_STRIDE,
  RANKS, FIRST_CARD_DF, PASS2_ALPHA, PASS2_P0, PASS2_EARLY_NONCES, EXPECTED_SEEDS, cherryPickFlag,
  SIM_MASTER_SEED, PASS1_ROW_NONCES, PASS1_REPLAYED_ROWS,
  PASS2_TOTAL_NONCES, PASS2_LATE_NONCES, PASS2_WINDOW, PASS2_WINDOWS, PASS2_MONEY_ALPHA, PASS2_FAMILY_ALPHA,
  PASS2_POOLED_Z, PASS2_POWER_SHORTFALLS,
} from '../../src/config';
import { blackjackShoe } from '../../src/rng';
import { deriveSeedHex, isMasterSeed, SEED_DERIVATION_VERSION, SEED_DOMAINS } from '../../src/seed-derivation';
import {
  replayPass0, replayBootstrapNull, checkpointMarks, decodeNulls, sortedCopy, bootstrapP,
  pass1Statistics, pass1RowsProblem, pass1Chunk, pass1RowOf, pass2Seed, moneyP,
} from '../../src/replay';
import type { Pass1Row } from '../../src/replay';
import { numbersAgree } from '../../src/diff';
import { solveExact, solveMoments } from '../../src/exact-play';
import { computeOptimalRTP } from '../../src/optimal-play';
import { chiSquaredTest, binomialSurvival, binomialTailThreshold, normalCDF } from '../../src/stats';
import { settleShoe } from '../../src/round-engine';

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
  // excluding it: the half-stake insurance bet the casino booked on every dealer-Ace offer when the
  // capture sent its decline request (`no-ins`, place-insurance-bet {betAmount: 0}; MANIFEST DL-17).
  //
  // This is NOT a return-to-player estimate: at n=6,000 the sample has no statistical power for
  // RTP — the money-weighted effective size is only ~332 rounds once the $10 phase-E stakes
  // dominate (SE ≈ ±6pp; even equal-weighted it is ≈ ±1.5pp) — and the phases deliberately
  // include suboptimal strategies. The percentages below reconcile the money path; they are not
  // an RTP figure. Authoritative RTP is the exact 8-deck solve (Step 17, RTP Analysis); the
  // simulation is consistent with it.
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
  info.push({ label: 'Money-path reconciliation (excl. insurance)', detail: `${(reconExcl * 100).toFixed(4)}% — insurance (${insWager.toFixed(2)} wagered, ${insReturn.toFixed(2)} returned) was booked by the casino on every offer in response to the capture's decline request (no-ins, place-insurance-bet {betAmount: 0}), which is not the request LIQD's UI sends — MANIFEST DL-17` });
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
    // in the repo. Both the anchor and that allowance are now gone: the simulation is
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
    // artifact set its own acceptance window. Forging the file to claim 1,000,000
    // rounds and 99.20% RTP and re-pinning SIMULATION_SHA256 made this step print
    //   [PASS] 17 … simulation 0.8000% over 1,000,000 rounds (±0.1150 pp 1σ) → 2.72σ, limit 3σ
    // — 56 passing (the suite's size on that run; a historical record, not the current
    // test count), 31/31, Full Pass. Claiming 30× fewer rounds bought a 5.5× wider gate and
    // hid a 0.31 pp miss. σ comes from SIM_BASE_ROUNDS in src/config.ts, and the
    // artifact's own round count must EQUAL that pin or the step hard-FAILs. A forger who
    // wants a looser gate has to widen it in source, in a diff a human reads.
    const roundsPinned = Number(rounds) === SIM_BASE_ROUNDS;
    const se = SIM_SD_PER_ROUND / Math.sqrt(SIM_BASE_ROUNDS);   // pinned; the committed run's measured SD is 1.14662130892236 (baseGame.sdPerRound), rounded up
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

    // ── RETAINED INPUT, RE-DRAWN ───────────────────────────────────────────────────────────
    //
    // This pass used to draw from `Math.random()`. The engine seeds that from entropy the program
    // never sees, so the 30,000,000-round figure above described a stream that ceased to exist
    // when the process exited: reproducible only in distribution, never in fact. That is a
    // material evidence gap.
    //
    // The stream is now a xoshiro128** generator (src/prng.ts) keyed by
    // deriveSeedHex(masterSeed, 'pass0-reference-shuffle', 0), and the master seed is IN the
    // artifact. So this step can do something it could not do before: re-run the pass and check.
    //
    // It re-runs a PREFIX — the first convergence checkpoint, 1,000 rounds, ~10 ms. That is not a
    // weaker check than it looks. The number of draws a round consumes depends on the cards it
    // sees, so the stream position at round 1,000 is already a function of the whole seed; a
    // forged master seed, a forged checkpoint or a shuffle that is not this one fails here. The
    // FULL 30M-round reconstruction is `npx ts-node src/deep-replay.ts`, which compares every
    // scalar and all 11 checkpoints and writes outputs/deep-replay-report.json. Stated plainly so
    // the boundary is not overclaimed: what is re-run here is the first 1,000 rounds, and the
    // later checkpoints are bound by that tool, not by this step.
    const masterSeed: unknown = sim.masterSeed;
    // The artifact's master seed must be the PINNED one (src/config.ts SIM_MASTER_SEED): the
    // committed experiment is the one this repo declares, not whichever seed the file carries.
    const masterPinned = masterSeed === SIM_MASTER_SEED;
    const masterOk = isMasterSeed(masterSeed) && masterPinned;
    const derivationOk = sim.seedDerivation === SEED_DERIVATION_VERSION;
    const streamOk = sim.baseGame?.rngStream === 'xoshiro128**'
      && sim.baseGame?.rngSeedDomain === SEED_DOMAINS.pass0Shuffle
      && Number(sim.baseGame?.rngSeedIndex) === 0;
    const firstMark = Math.min(...checkpointMarks(SIM_BASE_ROUNDS));   // 1,000 — derived from the PIN
    const ck0 = Array.isArray(sim.baseGame?.convergence) ? sim.baseGame.convergence[0] : undefined;
    let prefixOk = false;
    let prefixDetail: string;
    if (!masterOk || !derivationOk || !streamOk) {
      prefixDetail = `NOT re-drawn: the artifact does not carry usable retained inputs (masterSeed ${masterOk ? 'ok' : masterPinned ? 'missing/invalid' : 'NOT the pinned SIM_MASTER_SEED'}, seedDerivation ${derivationOk ? 'ok' : String(sim.seedDerivation)}, Pass-0 stream ${streamOk ? 'ok' : 'undeclared'})`;
    } else if (!ck0 || Number(ck0.rounds) !== firstMark) {
      prefixDetail = `NOT re-drawn: convergence[0] is ${ck0 ? `at ${String(ck0.rounds)} rounds` : 'absent'}, expected the first decade mark ${firstMark.toLocaleString()} derived from the pinned round count`;
    } else {
      const redrawn = replayPass0(masterSeed as string, firstMark).checkpoints[0];
      prefixOk = redrawn.rounds === Number(ck0.rounds)
        && redrawn.rtp === Number(ck0.rtp)
        && redrawn.se === Number(ck0.se);
      prefixDetail = prefixOk
        ? `retained input VERIFIED: the artifact's masterSeed is the pinned SIM_MASTER_SEED (src/config.ts), and re-running the first ${firstMark.toLocaleString()} rounds from it reproduces convergence[0] exactly (RTP ${redrawn.rtp}, SE ${redrawn.se}) — the full ${SIM_BASE_ROUNDS.toLocaleString()}-round reconstruction is \`npx ts-node src/deep-replay.ts\``
        : `— RE-DRAW MISMATCH at ${firstMark.toLocaleString()} rounds: artifact rtp=${String(ck0.rtp)} se=${String(ck0.se)}, re-drawn from masterSeed rtp=${redrawn.rtp} se=${redrawn.se}. The committed figures are not what this master seed produces`;
    }

    // A round count that disagrees with the pin is a FAIL, not a FLAG: it means the artifact
    // is not the run this repo publishes, and every σ printed below would be about a
    // different experiment. The same applies to a retained input that does not reproduce its
    // own published checkpoint.
    const status17 = (!liftOk || !roundsPinned || !prefixOk) ? 'FAIL' : (consistent ? 'PASS' : 'FLAG');
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
        : ` — ARTIFACT cardRemovalLiftPP=${sim.cardRemovalLiftPP} DISAGREES with the recomputed ${liftRecomputed.toFixed(9)} pp (hand-edited or stale artifact).`) +
      ` ${prefixDetail}.`));

    // Step 18 — Pass 1 RNG validation on the real shoe (first-card uniformity + serial independence).
    //
    // HARDENING: the verdict is RECOMPUTED from the raw statistics. It previously read
    // `firstCardUniformFail` / `serialFail` — booleans the simulator wrote about itself —
    // so an artifact carrying χ²=9999 with the flags left false still scored PASS. A scalar
    // the simulator asserts about its own output cannot check the simulator. The p-value is
    // re-derived from (χ², df) via the exact regularized incomplete gamma, and the
    // pre-registered thresholds are applied to the numbers directly.
    // THE df WAS ARTIFACT-SUPPLIED AND UNBOUND. Recomputing p from (χ², df) is only a
    // recomputation if BOTH inputs are bound. With
    //   firstCardChi2 = 9999, firstCardDf = 100000, firstCardPValue = 1
    // set and re-pinned, this step printed "p=1.0000 RECOMPUTED from χ²/df" and PASSed, because
    // χ²=9999 on 100,000 df really is p≈1. The df of a 13-bin rank test is RANKS−1 and
    // nothing else, so it comes from src/config.ts (FIRST_CARD_DF) and the artifact's own
    // `firstCardDf` must agree with it. `rounds` is pinned for the same reason as Step 17's.
    const p1 = sim.pass1_fresh_seeds;
    if (p1 && Number(p1.rounds) > 0) {
      // ── STEP 18 (BLACKJACK-20), SINCE 2026-09-24 ────────────────────────────────────────────
      // The artifact now carries the stream's CENSUS — 100 rows of 10,000 nonces, each an exact
      // integer record (src/replay.ts Pass1Row) — and every statistic is RE-DERIVED here from those
      // rows by the SAME function the simulator used (pass1Statistics): first-card χ², lag-1 r₁ and
      // its z, the runs test, and the RTP per initial bet, which is held against the exact 8-deck TD
      // solve recomputed above at σ = SIM_SD_PER_ROUND/√n from the PINNED round count. The rows
      // themselves are bound three ways: (1) they must tile 0 … SIM_PASS1_ROUNDS−1 in PASS1_ROW_NONCES
      // ranges and each must be internally consistent (Σx, Σx², highs agree with its own rank
      // counts); (2) the DECLARED rows (PASS1_REPLAYED_ROWS: the first and the last) are RE-DEALT from
      // the recorded seed pair and must equal the artifact's rows field for field, exactly; (3) the full
      // census is reproduced byte for byte by `npm run simulate` (outputs/run/simulation-diff.json) and
      // by `npx ts-node src/deep-replay.ts`. What is NOT re-dealt in this step: the other 98 rows
      // (≈490 core-seconds of HMAC shoes) — stated so the boundary is not overclaimed.
      const rounds1 = Number(p1.rounds);
      const roundsOk = rounds1 === SIM_PASS1_ROUNDS;
      const dfArtifact = Number(p1.firstCardDf);
      const dfOk = dfArtifact === FIRST_CARD_DF;
      const seedPairRecorded = typeof p1.serverSeed === 'string' && typeof p1.clientSeed === 'string';
      const seedPairDerived = masterOk && derivationOk && seedPairRecorded
        && p1.serverSeed === deriveSeedHex(masterSeed as string, SEED_DOMAINS.pass1Server, 0)
        && p1.clientSeed === deriveSeedHex(masterSeed as string, SEED_DOMAINS.pass1Client, 0)
        && p1.seedDerivation === SEED_DERIVATION_VERSION;

      const rows: Pass1Row[] = Array.isArray(p1.rows) ? p1.rows : [];
      const rowNoncesOk = Number(p1.rowNonces) === PASS1_ROW_NONCES;
      const expectedRows = Math.ceil(SIM_PASS1_ROUNDS / PASS1_ROW_NONCES);
      const rowsProblem = !roundsOk ? 'rounds disagree with the pin'
        : rows.length !== expectedRows ? `${rows.length} rows, expected ${expectedRows} (SIM_PASS1_ROUNDS / PASS1_ROW_NONCES)`
          : pass1RowsProblem(rows, SIM_PASS1_ROUNDS);

      // Re-derivation from the rows, and agreement with every scalar the artifact states.
      let st: ReturnType<typeof pass1Statistics> | null = null;
      const scalarBad: string[] = [];
      if (!rowsProblem && seedPairRecorded) {
        st = pass1Statistics(String(p1.serverSeed), String(p1.clientSeed), SIM_PASS1_ROUNDS, rows);
        const exactFields: Array<[string, unknown, unknown]> = [
          ['rankFreq', JSON.stringify(p1.rankFreq), JSON.stringify(st.rankFreq)],
          ['playerBJs', p1.playerBJs, st.playerBJs], ['dealerBJs', p1.dealerBJs, st.dealerBJs],
          ['wagered', p1.wagered, st.wagered], ['returned', p1.returned, st.returned],
          ['runs', p1.runs, st.runs], ['highs', p1.highs, st.highs],
        ];
        for (const [k, a, b] of exactFields) if (a !== b) scalarBad.push(`${k} ${String(a)} ≠ re-derived ${String(b)}`);
        const derived: Array<[string, unknown, number]> = [
          ['firstCardChi2', p1.firstCardChi2, st.firstCardChi2], ['firstCardPValue', p1.firstCardPValue, st.firstCardPValue],
          ['serialR1', p1.serialR1, st.serialR1], ['serialR1Z', p1.serialR1Z, st.serialR1Z],
          ['serialRunsZ', p1.serialRunsZ, st.serialRunsZ], ['serialRunsPValue', p1.serialRunsPValue, st.serialRunsPValue],
          ['rtpPerInitialBet', p1.rtpPerInitialBet, st.rtp],
        ];
        for (const [k, a, b] of derived) if (typeof a !== 'number' || !numbersAgree(a, b)) scalarBad.push(`${k} ${String(a)} ≠ re-derived ${b}`);
      }

      // The declared rows re-dealt from the seed pair — the census itself, not only its arithmetic.
      let replayed = 0;
      const replayBad: string[] = [];
      if (!rowsProblem && seedPairDerived) {
        for (const idx of PASS1_REPLAYED_ROWS) {
          const row = rows[idx < 0 ? rows.length + idx : idx];
          const fresh = pass1RowOf(pass1Chunk({ kind: 'p1', serverSeed: String(p1.serverSeed), clientSeed: String(p1.clientSeed), from: row.from, to: row.to }));
          replayed++;
          if (JSON.stringify(fresh) !== JSON.stringify(pass1RowOf(row))) replayBad.push(`row ${row.from}…${row.to - 1}: re-dealt ${JSON.stringify(fresh).slice(0, 120)}… ≠ artifact`);
        }
      }

      // RTP through the real RNG against the engine, at a stated σ from the PINNED round count.
      const rtpSE1 = SIM_SD_PER_ROUND / Math.sqrt(SIM_PASS1_ROUNDS);
      const rtpZ = st ? (st.rtp - exactTD.rtpPerInitialBet) / rtpSE1 : NaN;
      const rtpOk = Number.isFinite(rtpZ) && Math.abs(rtpZ) <= 3;
      const pRe = st ? st.firstCardPValue : NaN;
      const uniformOk = st !== null && st.firstCardDf === FIRST_CARD_DF && pRe >= 0.01;
      const serialOk = st !== null && Math.abs(st.serialR1Z) < 3 && st.serialRunsPValue >= 0.01;

      // A statistic outside its threshold is a FLAG (a finding about the RNG); an artifact that
      // contradicts a pin, its own rows or the re-dealt rows is a FAIL (a finding about the artifact).
      const contradiction18 = !dfOk || !roundsOk || !rowNoncesOk || !!rowsProblem || !seedPairDerived
        || scalarBad.length > 0 || replayBad.length > 0 || replayed !== PASS1_REPLAYED_ROWS.length || st === null;
      const ok18 = uniformOk && serialOk && rtpOk && !contradiction18;

      scored.push(step(18, 'Simulation Pass 1 — first-card uniformity, serial independence, RTP vs the exact solve',
        contradiction18 ? 'FAIL' : ok18 ? 'PASS' : 'FLAG',
        (st
          ? `${SIM_PASS1_ROUNDS.toLocaleString()} rounds of the REAL blackjackShoe played under the declared basic strategy, RE-DERIVED from the artifact's ${rows.length} census rows of ${PASS1_ROW_NONCES.toLocaleString()} nonces: ` +
            `first-card rank χ²=${st.firstCardChi2.toFixed(2)} (df ${FIRST_CARD_DF} PINNED as RANKS−1, p=${pRe.toFixed(4)}, threshold ≥0.01); ` +
            `serial r₁=${st.serialR1.toExponential(3)} (|z|=${Math.abs(st.serialR1Z).toFixed(2)}, threshold <3), runs ${st.runs.toLocaleString()} (z=${st.serialRunsZ.toFixed(2)}, p=${st.serialRunsPValue.toFixed(4)}, threshold ≥0.01); ` +
            `RTP ${(st.rtp * 100).toFixed(4)}% per initial bet vs the exact 8-deck solve ${(exactTD.rtpPerInitialBet * 100).toFixed(4)}% (recomputed in-step) at σ = ${SIM_SD_PER_ROUND}/√${SIM_PASS1_ROUNDS.toLocaleString()} = ${(rtpSE1 * 100).toFixed(4)} pp → ${rtpZ.toFixed(2)}σ, limit 3σ; ` +
            `player naturals ${st.playerBJs.toLocaleString()}, dealer naturals ${st.dealerBJs.toLocaleString()}. ` +
            `${scalarBad.length === 0 ? 'Every census total and every derived statistic the artifact states agrees with the re-derivation (census exact, statistics within the reproduction tolerance 1e-14 + 1e-12·max)' : ''}. `
          : '') +
        `RE-DEALT from the recorded seed pair: ${replayed - replayBad.length}/${replayed} declared rows (the first and the last, ${(replayed * PASS1_ROW_NONCES).toLocaleString()} shoes) equal the artifact's rows field for field; the other ${Math.max(0, rows.length - replayed)} rows are reproduced in full by \`npm run simulate\` (byte-for-byte diff) and \`npx ts-node src/deep-replay.ts\`, not in this step. ` +
        (seedPairDerived
          ? `The seed pair (server ${String(p1.serverSeed)}, client ${String(p1.clientSeed)}) re-derives from the PINNED master seed under ${SEED_DOMAINS.pass1Server}/${SEED_DOMAINS.pass1Client} at index 0`
          : ` — RETAINED INPUT FAIL: the Pass-1 seed pair is ${seedPairRecorded ? 'recorded but does NOT re-derive from the pinned master seed under the declared domains' : 'ABSENT from the artifact'}`) +
        (dfOk ? '' : ` — ARTIFACT firstCardDf=${dfArtifact} DISAGREES with the pinned ${FIRST_CARD_DF}`) +
        (roundsOk ? '' : ` — ARTIFACT rounds=${rounds1} DISAGREES with the pinned SIM_PASS1_ROUNDS=${SIM_PASS1_ROUNDS}`) +
        (rowNoncesOk ? '' : ` — ARTIFACT rowNonces=${String(p1.rowNonces)} DISAGREES with the declared PASS1_ROW_NONCES=${PASS1_ROW_NONCES}`) +
        (rowsProblem ? ` — CENSUS FAIL: ${rowsProblem}` : '') +
        (scalarBad.length ? ` — ARTIFACT DISAGREES with its own rows: ${scalarBad.slice(0, 4).join('; ')}` : '') +
        (replayBad.length ? ` — RE-DEAL MISMATCH: ${replayBad.join('; ')}` : '') +
        (st && !rtpOk ? ` — RTP ${rtpZ.toFixed(2)}σ from the exact solve, beyond 3σ` : '')));
    } else {
      // A block that is ABSENT from a pinned artifact is not "cannot score", it is a pinned
      // artifact that does not contain what the repo says it contains. FAIL.
      scored.push(step(18, 'Simulation Pass 1 — first-card uniformity, serial independence, RTP vs the exact solve', 'FAIL',
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
    //   (d) `lateChi2` and `latePValue` are RECOMPUTED from the row's own late-window rank counts
    //       (`lateFreq`, 9,950 nonces since 2026-09-24: expected 765 per rank, so NO pooling — 13
    //       bins, df = RANKS−1 = FIRST_CARD_DF).
    //   (e) `cherryPickFlags` is RECOMPUTED as the count of rows satisfying the test's own
    //       predicate, and the artifact's scalar must agree with it.
    //
    //   (f) `earlyBootstrapP` is RECOMPUTED from the RETAINED bootstrap null statistics. See the
    //       block below — this is the half of the retained-inputs defect that lived
    //       here, and the sentence it replaces used to read "the bootstrap null is drawn from
    //       fresh crypto.randomBytes entropy on each npm run simulate, so it is not reproducible
    //       by construction". That was true and it was a defect, not a property.
    //
    // WHAT IS NOT RE-DEALT HERE, stated rather than implied: the late rank counts and 198 of the 200
    // money windows per seed are re-derived from the rows, not re-dealt from the seeds, in this step
    // (≈1.2M shoes). They are re-dealt in full by src/deep-replay.ts and `npm run simulate`, and the
    // rank counts independently by `python3 replay/replay-bootstrap.py`.
    // That is disclosed because a step that says RECOMPUTED must be exact about what it
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

      // ── (f) THE RETAINED BOOTSTRAP NULL ────────────────────────────────────────────────
      //
      // `outputs/bootstrap-nulls.float64le` holds the 2,000 statistics the null was measured
      // against, IEEE-754 float64 little-endian, in GENERATION ORDER — index r is replicate r.
      // Three checks, cheapest first:
      //
      //   1. The file is present, is exactly SIM_BOOTSTRAP_REPS × 8 bytes (the replicate count
      //      comes from src/config.ts, never from the artifact — an artifact that could shrink
      //      its own denominator could coarsen every p-value it has to match), and its SHA-256
      //      equals the digest the artifact carries.
      //   2. A deterministic SAMPLE of replicates is RE-DERIVED from the artifact's own master
      //      seed — every BOOTSTRAP_SAMPLE_STRIDE-th one plus the last — and compared IN PLACE
      //      against the retained bytes. Generation order is what makes this possible at all:
      //      sorted, the array could only be checked by regenerating all 2,000. ~1.3 s.
      //   3. Every one of the 120 `earlyBootstrapP` values is RECOMPUTED from a sorted copy of
      //      the retained nulls and the χ² re-derived in (c), and must match exactly.
      //
      // HONEST BOUNDARY, because (2) is a sample: 40 of 2,000 replicates are re-derived here.
      // The complete reconstruction — all 2,000, byte for byte, in code that imports nothing
      // from this repository — is `python3 replay/replay-bootstrap.py`, whose report is
      // outputs/bootstrap-replay-report.json.
      const nullPath = path.join(ctx.outputsDir, BOOTSTRAP_NULL_FILE);
      const nullPresent = fs.existsSync(nullPath);
      const nullRaw = nullPresent ? fs.readFileSync(nullPath) : Buffer.alloc(0);
      const nullSizeOk = nullPresent && nullRaw.length === SIM_BOOTSTRAP_REPS * 8;
      const nullDigest = nullPresent ? createHash('sha256').update(nullRaw).digest('hex') : '';
      const nullDigestOk = nullSizeOk && nullDigest === String(p2.nullSHA256);
      const repsPinned = Number(p2.bootstrapReps) === SIM_BOOTSTRAP_REPS;
      const nulls = nullSizeOk ? decodeNulls(nullRaw) : new Float64Array(0);
      const sortedNulls = sortedCopy(nulls);

      let sampleChecked = 0, sampleBad = 0;
      const sampleFails: string[] = [];
      if (nullSizeOk && masterOk && derivationOk && p2.bootstrapSeedDerivation === SEED_DERIVATION_VERSION
        && p2.bootstrapServerDomain === SEED_DOMAINS.pass2BootstrapServer
        && p2.bootstrapClientDomain === SEED_DOMAINS.pass2BootstrapClient) {
        const sample: number[] = [];
        for (let r = 0; r < SIM_BOOTSTRAP_REPS; r += BOOTSTRAP_SAMPLE_STRIDE) sample.push(r);
        if (sample[sample.length - 1] !== SIM_BOOTSTRAP_REPS - 1) sample.push(SIM_BOOTSTRAP_REPS - 1);
        for (const r of sample) {
          const redrawn = replayBootstrapNull(masterSeed as string, r, PASS2_EARLY_NONCES);
          sampleChecked++;
          if (redrawn !== nulls[r]) {
            sampleBad++;
            if (sampleFails.length < 3) sampleFails.push(`replicate ${r}: retained ${nulls[r]} vs re-derived ${redrawn}`);
          }
        }
      }
      const sampleOk = sampleChecked > 0 && sampleBad === 0;

      // ── SINCE 2026-09-24 (BLACKJACK-21) ─────────────────────────────────────────────────────
      // Every revealed seed is carried to PASS2_TOTAL_NONCES = 10,000 nonces, and each result row
      // carries its CENSUS: the first-card rank counts of the served window (0..49) and of the late
      // window (50..9,999), and the net return of every 50-round money window (windowNet2, in HALF
      // initial-bet units so it is an exact integer; window 0 = nonces 0..49 = the captured range).
      //   PRIMARY  — the MONEY statistic, its rule fixed in src/config.ts before it was first computed:
      //              per seed p = (1 + #{later windows with net ≤ served}) / 200 (a bootstrap null over
      //              the seed's own 199 later windows, one-sided: low return is house-favourable),
      //              flagged at p ≤ PASS2_MONEY_ALPHA; family FLAG when flagged seeds exceed the binomial
      //              upper-tail gate at PASS2_FAMILY_ALPHA; pooled FLAG when the served windows' summed
      //              net sits below the EXACT 8-deck mean by more than PASS2_POOLED_Z σ.
      //   SECONDARY — the first-card rank screen (unchanged rule; its late window is now 9,950 nonces).
      // Everything is RE-DERIVED here from the rows; the SERVED window of every seed (6,000 rounds,
      // ranks and money) and one DECLARED later window per seed (window 1 + epoch mod 199, another
      // 6,000 rounds) are RE-DEALT from the revealed seeds and must equal the rows exactly. The other
      // 198 windows per seed are reproduced in full by `npm run simulate` and src/deep-replay.ts.
      const expectedBins = new Array(RANKS).fill(PASS2_EARLY_NONCES / RANKS);
      const lateBins = new Array(RANKS).fill(PASS2_LATE_NONCES / RANKS);
      const money = (p2.money ?? {}) as Record<string, unknown>;
      const familyGate = binomialTailThreshold(EXPECTED_SEEDS, PASS2_MONEY_ALPHA, PASS2_FAMILY_ALPHA);
      const constBad: string[] = [];
      const cmp = (k: string, a: unknown, b: unknown): void => { if (a !== b) constBad.push(`${k}=${JSON.stringify(a)} (code ${JSON.stringify(b)})`); };
      cmp('noncesPerSeed', Number(p2.noncesPerSeed), PASS2_TOTAL_NONCES);
      cmp('money.window', money.window, PASS2_WINDOW); cmp('money.windows', money.windows, PASS2_WINDOWS);
      cmp('money.alpha', money.alpha, PASS2_MONEY_ALPHA); cmp('money.familyAlpha', money.familyAlpha, PASS2_FAMILY_ALPHA);
      cmp('money.familyGate', money.familyGate, familyGate); cmp('money.pooledZGate', money.pooledZGate, -PASS2_POOLED_Z);
      // THE EXACT PER-ROUND SD (BLACKJACK-21, since 2026-09-25), RECOMPUTED IN-STEP: the square root of
      // E[R²] − E[R]² of the per-round return under the declared table on the 416-card shoe, splits played
      // sequentially (src/exact-play.ts moments(); ~12 s). It replaces the measured Pass-0 SD rounded up to
      // SIM_SD_PER_ROUND = 1.15. Three bindings: the sequential mean must reproduce the exact mean Step 17
      // recomputed (the split identity checked by a path that does not use it); the artifact of record
      // outputs/exact-rtp.json must carry exactly these moments; and the simulation artifact's
      // money.sdPerRound must be exactly this SD.
      const moments = solveMoments({ kind: 'finite', decks: 8 });
      const exactSd = moments.sd;
      const meanGap = Math.abs(moments.meanSequential - exactTD.evPerInitialBet);
      const momentsBad: string[] = [];
      if (!(moments.variance > 0) || !(Math.abs(moments.probabilityMass - 1) <= 1e-12)) momentsBad.push(`in-step moments degenerate (variance ${moments.variance}, mass ${moments.probabilityMass})`);
      if (!(meanGap <= 1e-12)) momentsBad.push(`sequential E[R] ${moments.meanSequential} vs solve() ${exactTD.evPerInitialBet}: |Δ| ${meanGap.toExponential(3)} > 1e-12`);
      let exactRtpMoments: Record<string, unknown> = {};
      try { exactRtpMoments = (JSON.parse(fs.readFileSync(path.join(ctx.outputsDir, 'exact-rtp.json'), 'utf8')).finite8TDMoments ?? {}) as Record<string, unknown>; } catch { /* absent → mismatch below; presence is Step 25's */ }
      for (const k of ['meanSequential', 'secondMoment', 'variance', 'sd'] as const) {
        if (exactRtpMoments[k] !== moments[k]) momentsBad.push(`outputs/exact-rtp.json finite8TDMoments.${k}=${JSON.stringify(exactRtpMoments[k])} vs in-step ${moments[k]}`);
      }
      cmp('money.sdPerRound', money.sdPerRound, exactSd);

      const intArr = (v: unknown, len: number): v is number[] => Array.isArray(v) && v.length === len && v.every((x) => Number.isInteger(x));
      const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0);
      let earlyBad = 0, earlyChecked = 0, lateBad = 0, bootPBad = 0, bootPChecked = 0, flagsRecomputed = 0;
      let censusBad = 0, redealt = 0, redealBad = 0, moneyBad = 0, moneyFlagsRe = 0, pooledNet2 = 0, lowFlags = 0;
      const earlyFails: string[] = [], bootPFails: string[] = [], censusFails: string[] = [], redealFails: string[] = [], moneyFails: string[] = [];
      const windowSums = new Array<number>(PASS2_WINDOWS).fill(0);
      for (const r of rows) {
        const ef = r.earlyFreq, lf = r.lateFreq, wn = r.windowNet2;
        if (!intArr(ef, RANKS) || !intArr(lf, RANKS) || !intArr(wn, PASS2_WINDOWS)
          || sum(ef as number[]) !== PASS2_EARLY_NONCES || sum(lf as number[]) !== PASS2_LATE_NONCES) {
          censusBad++;
          if (censusFails.length < 3) censusFails.push(`epoch ${String(r.epoch)}: census arrays absent, wrong length or not summing to ${PASS2_EARLY_NONCES}/${PASS2_LATE_NONCES} nonces`);
          continue;
        }
        const earlyFreq = ef as number[], lateFreq = lf as number[], windowNet2 = wn as number[];
        for (let w = 0; w < PASS2_WINDOWS; w++) windowSums[w] += windowNet2[w];
        pooledNet2 += windowNet2[0];

        // RE-DEAL from the revealed seed: the served window (ranks + money) and one declared later window.
        const sd = revealedByHash.get(String(r.hashedServerSeed ?? ''));
        if (sd && sd.serverSeed) {
          const freq = new Array(RANKS).fill(0);
          let net2 = 0;
          for (let n = 0; n < PASS2_EARLY_NONCES; n++) {
            const shoe = blackjackShoe(sd.serverSeed, sd.clientSeed, n);
            freq[rankOf(shoe[0]) - 1]++;
            const [w, ret] = settleShoe(shoe);
            net2 += 2 * (ret - w);
          }
          const lw = 1 + (sd.epoch % (PASS2_WINDOWS - 1));
          let lateNet2 = 0;
          for (let n = lw * PASS2_WINDOW; n < (lw + 1) * PASS2_WINDOW; n++) {
            const [w, ret] = settleShoe(blackjackShoe(sd.serverSeed, sd.clientSeed, n));
            lateNet2 += 2 * (ret - w);
          }
          redealt++;
          if (JSON.stringify(freq) !== JSON.stringify(earlyFreq) || net2 !== windowNet2[0] || lateNet2 !== windowNet2[lw]) {
            redealBad++;
            if (redealFails.length < 3) redealFails.push(`epoch ${sd.epoch}: re-dealt served ranks ${JSON.stringify(freq)} net2 ${net2}, window ${lw} net2 ${lateNet2} vs the row's ${JSON.stringify(earlyFreq)} / ${windowNet2[0]} / ${windowNet2[lw]}`);
          }
          const chi2 = chiSquaredTest(freq, expectedBins).chi2;
          earlyChecked++;
          if (!(Math.abs(chi2 - Number(r.earlyChi2)) < 1e-9)) {
            earlyBad++;
            if (earlyFails.length < 3) earlyFails.push(`epoch ${String(r.epoch)}: artifact ${String(r.earlyChi2)} vs recomputed ${chi2.toFixed(6)}`);
          }
          // (f) the bootstrap p-value, from the RETAINED nulls and the χ² just re-derived. EXACT.
          if (sortedNulls.length === SIM_BOOTSTRAP_REPS) {
            const pBoot = bootstrapP(sortedNulls, chi2);
            bootPChecked++;
            if (pBoot !== Number(r.earlyBootstrapP)) {
              bootPBad++;
              if (bootPFails.length < 3) bootPFails.push(`epoch ${String(r.epoch)}: artifact ${String(r.earlyBootstrapP)} vs recomputed ${pBoot}`);
            }
          }
        }
        // The late control statistic, RE-DERIVED from the row's counts (no longer an artifact scalar).
        const late = chiSquaredTest([...lateFreq], lateBins);
        if (!numbersAgree(late.chi2, Number(r.lateChi2)) || !numbersAgree(late.pValue, Number(r.latePValue)) || late.df !== FIRST_CARD_DF) lateBad++;
        if (cherryPickFlag(Number(r.earlyBootstrapP), late.pValue)) flagsRecomputed++;

        // The money statistic, RE-DERIVED from the row's windows.
        const mp = moneyP(windowNet2);
        const mf = mp <= PASS2_MONEY_ALPHA;
        if (mf) moneyFlagsRe++;
        if (mp !== Number(r.moneyP) || mf !== r.moneyFlag || windowNet2[0] / 2 !== Number(r.earlyNet)) {
          moneyBad++;
          if (moneyFails.length < 3) moneyFails.push(`epoch ${String(r.epoch)}: artifact moneyP ${String(r.moneyP)} / flag ${String(r.moneyFlag)} / earlyNet ${String(r.earlyNet)} vs re-derived ${mp} / ${mf} / ${windowNet2[0] / 2}`);
        }
        if (windowNet2[0] < 0) lowFlags++;
      }

      // Pooled served-window net against the EXACT 8-deck mean (exactTD, recomputed in Step 17 above).
      const servedRounds = EXPECTED_SEEDS * PASS2_EARLY_NONCES;
      const pooledNet = pooledNet2 / 2;
      const pooledExpected = -exactTD.edgePerInitialBet * servedRounds;
      const pooledSD = exactSd * Math.sqrt(servedRounds);
      const pooledZ = (pooledNet - pooledExpected) / pooledSD;
      let pooledLe = 0;
      for (let w = 1; w < PASS2_WINDOWS; w++) if (windowSums[w] <= pooledNet2) pooledLe++;
      const pooledBootP = (1 + pooledLe) / PASS2_WINDOWS;
      const power = PASS2_POWER_SHORTFALLS.map((d) => ({ d, pw: normalCDF((d * servedRounds) / pooledSD - PASS2_POOLED_Z) }));
      const pooledAgrees = numbersAgree(Number(money.pooledZ), pooledZ) && Number(money.pooledEarlyNet) === pooledNet
        && Number(money.seedsFlagged) === moneyFlagsRe && Number(money.pooledBootstrapP) === pooledBootP
        && numbersAgree(Number(money.pooledExpectedNet), pooledExpected);

      // Measured power against a return-selecting attacker: outputs/cherry-pick-attack.json (npm run
      // attack), hash-pinned in Step 25, runs THIS money rule on blocks ground to be house-favourable.
      const attackPath = path.join(ctx.outputsDir, 'cherry-pick-attack.json');
      const attack = fs.existsSync(attackPath) ? JSON.parse(fs.readFileSync(attackPath, 'utf8')) : null;
      const am = attack?.moneyDetector as Record<string, unknown> | undefined;
      const attackOk = !!am && am.alpha === PASS2_MONEY_ALPHA && am.familyGate === familyGate && am.window === PASS2_WINDOW
        && Number(am.seedsTested) === EXPECTED_SEEDS && am.sdPerRound === exactSd;

      const flagsClaimed = Number(p2.cherryPickFlags);
      const flagsAgree = flagsClaimed === flagsRecomputed;
      const expectedByChance = EXPECTED_SEEDS * PASS2_P0;
      const survivalRecomputed = binomialSurvival(flagsRecomputed, EXPECTED_SEEDS, PASS2_P0);
      const claimed = Number(p2.cherryPickSurvivalP);
      const agrees = Number.isFinite(claimed) && Math.abs(claimed - survivalRecomputed) < 1e-6;
      const retainedNullOk = nullPresent && nullSizeOk && nullDigestOk && repsPinned && sampleOk
        && bootPChecked === EXPECTED_SEEDS && bootPBad === 0;
      const contradiction19 = !populationOk || earlyChecked !== EXPECTED_SEEDS || earlyBad !== 0
        || lateBad !== 0 || !flagsAgree || !agrees || !retainedNullOk || constBad.length > 0 || censusBad !== 0
        || redealt !== EXPECTED_SEEDS || redealBad !== 0 || moneyBad !== 0 || !pooledAgrees || !attackOk || momentsBad.length > 0;
      const moneyFlagged = moneyFlagsRe > familyGate || pooledZ < -PASS2_POOLED_Z;
      // WHAT THIS RESULT CAN SHOW ON THIS CAPTURE. Selection needs the client seed to be known when the
      // server seed is committed. On this capture the A–C/E/F epochs used a fresh CSPRNG client seed
      // (Step 7: the 'audit' + 12-hex form), submitted on the rotation that activated a server seed whose
      // hash the previous epoch had already published (Step 2), so on those epochs there was nothing to
      // select against, and a clean result cannot show whether the casino selects seeds.
      const freshAfterCommit = ctx.seeds.filter((s) => /^audit[0-9a-f]{12}$/.test(String(s.clientSeed))).length;
      const ok19 = !contradiction19 && !moneyFlagged && survivalRecomputed >= 0.01;

      scored.push(step(19, 'Simulation Pass 2 — cherry-pick detection (casino seeds)',
        contradiction19 ? 'FAIL' : ok19 ? 'PASS' : 'FLAG',
        `${rows.length}/${EXPECTED_SEEDS} revealed seeds × ${PASS2_TOTAL_NONCES.toLocaleString()} nonces, each row bound one-to-one to a revealed seed record by (epoch, hashedServerSeed). ` +
        `PRIMARY — MONEY (rule fixed in src/config.ts before first computed): the declared basic strategy's net return per ${PASS2_WINDOW}-round window, served window = nonces 0..${PASS2_EARLY_NONCES - 1} (the captured range) ranked against the seed's own ${PASS2_WINDOWS - 1} later windows (bootstrap null, one-sided): ` +
        `${moneyFlagsRe} seed(s) at p ≤ ${PASS2_MONEY_ALPHA} RE-DERIVED from the rows (family gate: FLAG above ${familyGate}, the binomial upper tail at ${PASS2_FAMILY_ALPHA}); ${lowFlags} of ${rows.length} served windows returned less than staked; ` +
        `pooled served-window net ${pooledNet} initial bets over ${servedRounds.toLocaleString()} rounds vs the exact 8-deck mean ${pooledExpected.toFixed(4)} (exact TD solve, recomputed in-step), σ = ${exactSd.toFixed(6)}·√${servedRounds.toLocaleString()} = ${pooledSD.toFixed(3)} — the EXACT per-round SD, √(E[R²] − E[R]²) = √(${moments.secondMoment.toFixed(6)} − ${(moments.meanSequential * moments.meanSequential).toExponential(3)}) from the exact 8-deck solve with splits played sequentially, recomputed in-step (sequential mean vs the exact mean |Δ| ${meanGap.toExponential(1)}; equal to outputs/exact-rtp.json finite8TDMoments, anchored to the rational oracle at 1e-12) → z = ${pooledZ.toFixed(3)} (FLAG below −${PASS2_POOLED_Z}); pooled bootstrap p over the ${PASS2_WINDOWS - 1} later pooled windows = ${pooledBootP.toFixed(4)}. ` +
        `Power of the pooled rule at a served-window RTP shortfall of ${power.map((x) => `${(x.d * 100).toFixed(0)} %: ${(x.pw * 100).toFixed(1)} %`).join(', ')}. ` +
        (am ? `MEASURED against a return-selecting attacker (outputs/cherry-pick-attack.json, npm run attack — ${String(am.candidatesPerEpoch)} candidate server seeds per epoch, the most house-favourable served block kept): ${String(am.seedsFlagged)}/${String(am.seedsTested)} selected seeds flagged by this rule, pooled z = ${Number(am.pooledZ).toFixed(3)} → ${am.detected ? 'DETECTED' : 'NOT detected'} at the family gate or the pooled gate. ` : 'MEASURED power: outputs/cherry-pick-attack.json carries no moneyDetector block. ') +
        `RE-DEALT from the revealed seeds: ${redealt - redealBad}/${redealt} served windows (ranks and money, ${(redealt * PASS2_EARLY_NONCES).toLocaleString()} rounds) and ${redealt - redealBad}/${redealt} declared later windows (window 1 + epoch mod ${PASS2_WINDOWS - 1}) equal the rows exactly; the other ${PASS2_WINDOWS - 2} windows per seed are reproduced in full by \`npm run simulate\` and \`npx ts-node src/deep-replay.ts\`, not in this step. ` +
        `SECONDARY — first-card rank screen: ${flagsRecomputed} flag(s) RECOMPUTED (expected ~${expectedByChance.toFixed(1)} by chance at p₀=${PASS2_P0.toFixed(4)} = α(1−α), α=${PASS2_ALPHA} PINNED); binomial survival P=${survivalRecomputed.toFixed(4)}, threshold ≥0.01; ` +
        `earlyChi2 re-derived from the revealed seeds ${earlyChecked - earlyBad}/${earlyChecked}; lateChi2 and latePValue re-derived from each row's ${PASS2_LATE_NONCES.toLocaleString()}-nonce rank counts at df ${FIRST_CARD_DF}: ${rows.length - lateBad - censusBad}/${rows.length} agree. ` +
        `RETAINED BOOTSTRAP NULL: ${nullPresent ? `${BOOTSTRAP_NULL_FILE} present, ${nullRaw.length.toLocaleString()} bytes = ${SIM_BOOTSTRAP_REPS.toLocaleString()} float64 statistics in generation order, SHA-256 ${nullDigest.slice(0, 12)}…${nullDigestOk ? ' matching the artifact\'s nullSHA256' : ' NOT matching the artifact'}` : 'ABSENT'}; ` +
        `${sampleChecked} of ${SIM_BOOTSTRAP_REPS.toLocaleString()} replicates re-derived and compared in place: ${sampleChecked - sampleBad}/${sampleChecked} reproduce exactly; all ${bootPChecked}/${EXPECTED_SEEDS} earlyBootstrapP values RECOMPUTED from the retained statistics (the other replicates: \`python3 replay/replay-bootstrap.py\`). ` +
        `Primary defence remains the client-seed-after-commitment mitigation. ` +
        `${freshAfterCommit} of ${ctx.seeds.length} epochs used a fresh client seed set after the commitment (Steps 2 and 7), so this result cannot show seed selection.` +
        (constBad.length ? ` — ARTIFACT CONSTANTS DISAGREE WITH CODE: ${constBad.join(', ')}` : '') +
        (censusBad ? ` — CENSUS FAIL on ${censusBad} row(s): ${censusFails.join('; ')}` : '') +
        (redealBad || redealt !== EXPECTED_SEEDS ? ` — RE-DEAL MISMATCH on ${redealBad} of ${redealt} seed(s) (declared ${EXPECTED_SEEDS}): ${redealFails.join('; ')}` : '') +
        (moneyBad ? ` — ARTIFACT money fields DISAGREE with the rows on ${moneyBad} row(s): ${moneyFails.join('; ')}` : '') +
        (pooledAgrees ? '' : ` — ARTIFACT pooled money block DISAGREES with the re-derivation (pooledZ ${String(money.pooledZ)} vs ${pooledZ}, seedsFlagged ${String(money.seedsFlagged)} vs ${moneyFlagsRe}, pooledEarlyNet ${String(money.pooledEarlyNet)} vs ${pooledNet}, pooledBootstrapP ${String(money.pooledBootstrapP)} vs ${pooledBootP})`) +
        (attackOk ? '' : ` — ATTACK ARTIFACT does not measure THIS rule (moneyDetector absent or its α / gate / window / seed count / sdPerRound ${String(am?.sdPerRound)} differ from code)`) +
        (momentsBad.length ? ` — EXACT MOMENTS FAIL: ${momentsBad.join('; ')}` : '') +
        (moneyFlagged && !contradiction19 ? ` — MONEY FLAG: ${moneyFlagsRe > familyGate ? `${moneyFlagsRe} flagged seeds exceed the family gate ${familyGate}` : ''}${pooledZ < -PASS2_POOLED_Z ? ` pooled z ${pooledZ.toFixed(3)} below −${PASS2_POOLED_Z}` : ''}` : '') +
        (populationOk ? '' : ` — POPULATION FAIL: seeds_tested=${seedsClaimed}, rows=${rows.length}, revealed seed records=${revealed.length}, ${rowsUnbound} row(s) not matched to a revealed seed record (declared ${EXPECTED_SEEDS})`) +
        (earlyBad === 0 ? '' : ` — ARTIFACT earlyChi2 DISAGREES with the re-derivation on ${earlyBad} seed(s): ${earlyFails.join('; ')}`) +
        (lateBad === 0 ? '' : ` — ARTIFACT lateChi2/latePValue DISAGREE with the re-derivation from the row's counts on ${lateBad} row(s)`) +
        (flagsAgree ? '' : ` — ARTIFACT cherryPickFlags=${flagsClaimed} DISAGREES with the ${flagsRecomputed} recomputed from the rows' own predicate`) +
        (agrees ? '' : ` — ARTIFACT P=${claimed} DISAGREES with the recomputed value`) +
        (nullPresent ? '' : ` — RETAINED NULL MISSING: outputs/${BOOTSTRAP_NULL_FILE} is the evidence behind every earlyBootstrapP`) +
        (!nullPresent || nullSizeOk ? '' : ` — RETAINED NULL WRONG SIZE: ${nullRaw.length} bytes, expected ${SIM_BOOTSTRAP_REPS * 8}`) +
        (!nullSizeOk || nullDigestOk ? '' : ` — RETAINED NULL DIGEST MISMATCH: file is ${nullDigest}, artifact claims ${String(p2.nullSHA256)}`) +
        (repsPinned ? '' : ` — ARTIFACT bootstrapReps=${String(p2.bootstrapReps)} DISAGREES with the pinned SIM_BOOTSTRAP_REPS=${SIM_BOOTSTRAP_REPS}`) +
        (sampleOk ? '' : ` — RETAINED NULL NOT RE-DERIVABLE: ${sampleChecked === 0 ? 'no replicate could be re-derived' : `${sampleBad}/${sampleChecked} sampled replicates differ from the retained bytes: ${sampleFails.join('; ')}`}`) +
        (bootPChecked === EXPECTED_SEEDS && bootPBad === 0 ? '' : ` — ARTIFACT earlyBootstrapP DISAGREES with the recomputation from the retained nulls on ${bootPBad} of ${bootPChecked} row(s): ${bootPFails.join('; ')}`)));
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
    // The same fix was NOT applied to the two other pinned outputs, and deleting
    // outputs/exact-rtp.json and outputs/rtp-convergence.html gave 31/31 · Full Pass · exit 0.
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
