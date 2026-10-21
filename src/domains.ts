/**
 * VALUE DOMAINS for every numeric leaf of every JSON artifact of record (BLACKJACK-27).
 *
 * A pin proves an artifact is the committed one; it says nothing about whether the committed one
 * could be true. A negative count, a probability of 1.3 or a census row summing to more nonces than
 * it covers, re-pinned by a forger, is exactly as "identical to its pin" as the real file. So scored
 * Step 25 walks every numeric leaf of every JSON artifact of record and requires two things:
 *
 *   1. the leaf's path is DECLARED below — there is no silent fallback, so a numeric field added to
 *      an artifact without saying what it physically admits fails the step; and
 *   2. the value lies inside that domain.
 *
 * EVERY BOUND COMES FROM CODE (src/config.ts), NEVER FROM THE ARTIFACT BEING CHECKED. The domains
 * encode PHYSICAL POSSIBILITY, not plausibility: nothing here rejects a value for being surprising,
 * extreme or equal to its own expectation (a z-score is any finite number). Whether a value is RIGHT
 * is the job of the step that re-derives it (Steps 17–19, 20, 25).
 *
 * Paths: array elements become `[*]`. Ported in shape from the LIQD Mines package (src/domains.ts).
 */
import {
  EXPECTED_SEEDS, EXPECTED_HANDS, EXPECTED_EPOCH_SIZE, SHOE_SIZE, RANKS, FIRST_CARD_DF,
  SIM_BASE_ROUNDS, SIM_PASS1_ROUNDS, SIM_BOOTSTRAP_REPS, PASS1_ROW_NONCES,
  PASS2_TOTAL_NONCES, PASS2_WINDOW, PASS2_WINDOWS, BLACKJACK_PAYS,
} from './config';

interface Domain { label: string; ok: (v: number) => boolean }
const D = (label: string, ok: (v: number) => boolean): Domain => ({ label, ok });

const FINITE = D('a finite number', (v) => Number.isFinite(v));
const NONNEG = D('a non-negative real', (v) => Number.isFinite(v) && v >= 0);
const POS = D('a strictly positive real', (v) => Number.isFinite(v) && v > 0);
const PROB = D('a probability in [0,1]', (v) => Number.isFinite(v) && v >= 0 && v <= 1);
const PROB_POS = D('a probability in (0,1]', (v) => Number.isFinite(v) && v > 0 && v <= 1);
const CORR = D('a correlation in [-1,1]', (v) => Number.isFinite(v) && v >= -1 && v <= 1);
const PCT = D('a percentage in [0,100]', (v) => Number.isFinite(v) && v >= 0 && v <= 100);
const PCT_ANY = D('a percentage ≥ 0', (v) => Number.isFinite(v) && v >= 0);
const INT = D('a non-negative integer', (v) => Number.isInteger(v) && v >= 0);
const intIn = (lo: number, hi: number, what: string): Domain =>
  D(`an integer in [${lo}, ${hi}] (${what})`, (v) => Number.isInteger(v) && v >= lo && v <= hi);
const exactly = (x: number, what: string): Domain => D(`exactly ${x} (${what})`, (v) => v === x);
/** A multiple of 0.5 in [lo, hi] — every settled blackjack amount in initial-bet units is one. */
const halfIn = (lo: number, hi: number, what: string): Domain =>
  D(`a multiple of 0.5 in [${lo}, ${hi}] (${what})`, (v) => Number.isInteger(2 * v) && v >= lo && v <= hi);

/** A round stakes at most 4 initial bets (one split, both hands doubled) and returns at most 8. */
const MAX_WAGER = 4, MAX_RETURN = 8;
const AVG_WAGER = D(`an average wager in [1, ${MAX_WAGER}] initial bets`, (v) => Number.isFinite(v) && v >= 1 && v <= MAX_WAGER);
const RTP = D(`an RTP in [0, ${MAX_RETURN}] per initial bet`, (v) => Number.isFinite(v) && v >= 0 && v <= MAX_RETURN);
const MASS = D('a probability mass within 1e-12 of 1', (v) => Math.abs(v - 1) <= 1e-12);
const EPOCH = intIn(0, EXPECTED_SEEDS - 1, 'an epoch index');
const SEEDS = intIn(0, EXPECTED_SEEDS, 'at most the declared epochs, src/config.ts EXPECTED_SEEDS');
const HANDS = intIn(0, EXPECTED_HANDS, 'at most the declared hands, src/config.ts EXPECTED_HANDS');
const RANK = intIn(1, RANKS, 'a card rank 1..13');
const P1_NONCE = intIn(0, SIM_PASS1_ROUNDS, 'a Pass-1 nonce bound');
const ROW_N = intIn(0, PASS1_ROW_NONCES, 'at most one row\'s nonces, src/config.ts PASS1_ROW_NONCES');
const P2_NONCE = intIn(0, PASS2_TOTAL_NONCES - 1, 'a Pass-2 nonce');
const REPS = intIn(0, SIM_BOOTSTRAP_REPS - 1, 'a bootstrap replicate index');
const EARLY = intIn(0, EXPECTED_EPOCH_SIZE, 'at most the served window');
const LATE = intIn(0, PASS2_TOTAL_NONCES - EXPECTED_EPOCH_SIZE, 'at most the late window');
/** A money window's net in HALF initial-bet units: −2·4·50 … +2·(8−1)·50. */
const WINDOW_NET2 = intIn(-2 * MAX_WAGER * PASS2_WINDOW, 2 * (MAX_RETURN - 1) * PASS2_WINDOW, 'a 50-round net in half units');
const SERVED_NET = halfIn(-MAX_WAGER * PASS2_WINDOW, (MAX_RETURN - 1) * PASS2_WINDOW, 'a 50-round net in initial bets');
const POOLED_NET = halfIn(-MAX_WAGER * EXPECTED_HANDS, (MAX_RETURN - 1) * EXPECTED_HANDS, 'a net over the served rounds');
const MONEY = D('a money amount ≥ 0', (v) => Number.isFinite(v) && v >= 0);

const SIMULATION: Record<string, Domain> = {
  'baseGame.rtp': RTP, 'baseGame.edge': FINITE, 'baseGame.rtpInitial': RTP, 'baseGame.edgeInitial': FINITE,
  'baseGame.rtpPerTotalWagered': RTP, 'baseGame.edgePerTotalWagered': FINITE, 'baseGame.avgWager': AVG_WAGER,
  'baseGame.rounds': exactly(SIM_BASE_ROUNDS, 'src/config.ts SIM_BASE_ROUNDS'), 'baseGame.standardError': POS,
  'baseGame.rngSeedIndex': INT, 'baseGame.sdPerRound': POS,
  'baseGame.convergence[*].rounds': intIn(1, SIM_BASE_ROUNDS, 'a checkpoint size'),
  'baseGame.convergence[*].rtp': RTP, 'baseGame.convergence[*].se': POS,
  'realShoeConsistency.rtp': RTP, 'realShoeConsistency.edge': FINITE, 'realShoeConsistency.rtpPerTotalWagered': RTP,
  'realShoeConsistency.rounds': exactly(SIM_PASS1_ROUNDS, 'src/config.ts SIM_PASS1_ROUNDS'),
  'realShoeConsistency.standardError': POS, 'realShoeConsistency.deviationSigma': NONNEG,
  'realShoeConsistency.exactRtpPerInitialBet': RTP, 'realShoeConsistency.deviationSigmaVsExact': FINITE,
  'realShoeConsistency.playerBJFreq': PROB, 'realShoeConsistency.dealerBJFreq': PROB,
  'analyticalInfiniteDeck': RTP, 'analyticalInfiniteDeckEdge': FINITE, 'cardRemovalLiftPP': FINITE,
  'pass1_fresh_seeds.rounds': exactly(SIM_PASS1_ROUNDS, 'src/config.ts SIM_PASS1_ROUNDS'),
  'pass1_fresh_seeds.seedIndex': INT,
  'pass1_fresh_seeds.rowNonces': exactly(PASS1_ROW_NONCES, 'src/config.ts PASS1_ROW_NONCES'),
  'pass1_fresh_seeds.rankFreq[*]': intIn(0, SIM_PASS1_ROUNDS, 'at most the stream'),
  'pass1_fresh_seeds.playerBJs': intIn(0, SIM_PASS1_ROUNDS, 'at most the stream'),
  'pass1_fresh_seeds.dealerBJs': intIn(0, SIM_PASS1_ROUNDS, 'at most the stream'),
  'pass1_fresh_seeds.wagered': halfIn(SIM_PASS1_ROUNDS, MAX_WAGER * SIM_PASS1_ROUNDS, 'Σ wagered over the stream'),
  'pass1_fresh_seeds.returned': halfIn(0, MAX_RETURN * SIM_PASS1_ROUNDS, 'Σ returned over the stream'),
  'pass1_fresh_seeds.runs': intIn(1, SIM_PASS1_ROUNDS, 'runs in the stream'),
  'pass1_fresh_seeds.highs': intIn(0, SIM_PASS1_ROUNDS, 'at most the stream'),
  'pass1_fresh_seeds.firstCardChi2': NONNEG,
  'pass1_fresh_seeds.firstCardDf': exactly(FIRST_CARD_DF, 'RANKS − 1'),
  'pass1_fresh_seeds.firstCardPValue': PROB,
  'pass1_fresh_seeds.serialR1': CORR, 'pass1_fresh_seeds.serialR1Z': FINITE,
  'pass1_fresh_seeds.serialRunsZ': FINITE, 'pass1_fresh_seeds.serialRunsPValue': PROB,
  'pass1_fresh_seeds.rtpPerInitialBet': RTP, 'pass1_fresh_seeds.exactRtpPerInitialBet': RTP,
  'pass1_fresh_seeds.sigmaPerRound': POS, 'pass1_fresh_seeds.standardError': POS,
  'pass1_fresh_seeds.deviationSigmaVsExact': FINITE,
  'pass1_fresh_seeds.rows[*].from': P1_NONCE, 'pass1_fresh_seeds.rows[*].to': P1_NONCE,
  'pass1_fresh_seeds.rows[*].rankFreq[*]': ROW_N,
  'pass1_fresh_seeds.rows[*].sumX': intIn(0, RANKS * PASS1_ROW_NONCES, 'Σ rank over a row'),
  'pass1_fresh_seeds.rows[*].sumX2': intIn(0, RANKS * RANKS * PASS1_ROW_NONCES, 'Σ rank² over a row'),
  'pass1_fresh_seeds.rows[*].lagSum': intIn(0, RANKS * RANKS * PASS1_ROW_NONCES, 'Σ rank·next over a row'),
  'pass1_fresh_seeds.rows[*].firstX': RANK, 'pass1_fresh_seeds.rows[*].lastX': RANK,
  'pass1_fresh_seeds.rows[*].runs': intIn(1, PASS1_ROW_NONCES, 'runs in a row'),
  'pass1_fresh_seeds.rows[*].highs': ROW_N,
  'pass1_fresh_seeds.rows[*].wagered': halfIn(0, MAX_WAGER * PASS1_ROW_NONCES, 'Σ wagered over a row'),
  'pass1_fresh_seeds.rows[*].returned': halfIn(0, MAX_RETURN * PASS1_ROW_NONCES, 'Σ returned over a row'),
  'pass1_fresh_seeds.rows[*].playerBJs': ROW_N, 'pass1_fresh_seeds.rows[*].dealerBJs': ROW_N,
  'pass2_casino_seeds.noncesPerSeed': exactly(PASS2_TOTAL_NONCES, 'src/config.ts PASS2_TOTAL_NONCES'),
  'pass2_casino_seeds.earlyWindow[*]': P2_NONCE, 'pass2_casino_seeds.lateWindow[*]': P2_NONCE,
  'pass2_casino_seeds.bootstrapReps': exactly(SIM_BOOTSTRAP_REPS, 'src/config.ts SIM_BOOTSTRAP_REPS'),
  'pass2_casino_seeds.bootstrapReplicateIndex[*]': REPS,
  'pass2_casino_seeds.seeds_tested': SEEDS, 'pass2_casino_seeds.cherryPickFlags': SEEDS,
  'pass2_casino_seeds.expectedFlagsByChance': NONNEG, 'pass2_casino_seeds.cherryPickSurvivalP': PROB,
  'pass2_casino_seeds.money.window': exactly(PASS2_WINDOW, 'src/config.ts PASS2_WINDOW'),
  'pass2_casino_seeds.money.windows': exactly(PASS2_WINDOWS, 'src/config.ts PASS2_WINDOWS'),
  'pass2_casino_seeds.money.alpha': PROB_POS, 'pass2_casino_seeds.money.familyAlpha': PROB_POS,
  'pass2_casino_seeds.money.familyGate': SEEDS, 'pass2_casino_seeds.money.seedsFlagged': SEEDS,
  'pass2_casino_seeds.money.servedRounds': exactly(EXPECTED_HANDS, 'seeds × served window'),
  'pass2_casino_seeds.money.pooledEarlyNet': POOLED_NET, 'pass2_casino_seeds.money.pooledExpectedNet': FINITE,
  'pass2_casino_seeds.money.exactEdgePerInitialBet': FINITE, 'pass2_casino_seeds.money.sdPerRound': POS,
  'pass2_casino_seeds.money.pooledSD': POS, 'pass2_casino_seeds.money.pooledZ': FINITE,
  'pass2_casino_seeds.money.pooledZGate': FINITE, 'pass2_casino_seeds.money.pooledBootstrapP': PROB_POS,
  'pass2_casino_seeds.money.pooledPower[*].rtpShortfall': PROB_POS,
  'pass2_casino_seeds.money.pooledPower[*].detectionPower': PROB,
  'pass2_casino_seeds.results[*].epoch': EPOCH,
  'pass2_casino_seeds.results[*].earlyChi2': NONNEG, 'pass2_casino_seeds.results[*].earlyBootstrapP': PROB_POS,
  'pass2_casino_seeds.results[*].lateChi2': NONNEG, 'pass2_casino_seeds.results[*].latePValue': PROB,
  'pass2_casino_seeds.results[*].earlyNet': SERVED_NET, 'pass2_casino_seeds.results[*].moneyP': PROB_POS,
  'pass2_casino_seeds.results[*].earlyFreq[*]': EARLY, 'pass2_casino_seeds.results[*].lateFreq[*]': LATE,
  'pass2_casino_seeds.results[*].windowNet2[*]': WINDOW_NET2,
};

const PROVENANCE: Record<string, Domain> = {
  'pass0_reference.rounds': exactly(SIM_BASE_ROUNDS, 'src/config.ts SIM_BASE_ROUNDS'),
  'pass0_reference.seedIndex': INT, 'pass0_reference.seedBytes': intIn(1, 64, 'bytes'),
  'pass0_reference.checkpoints': intIn(1, 64, 'convergence checkpoints'),
  'pass1_real_shoe.rounds': exactly(SIM_PASS1_ROUNDS, 'src/config.ts SIM_PASS1_ROUNDS'),
  'pass1_real_shoe.seedIndex': INT, 'pass1_real_shoe.derivedSeedBytes': intIn(1, 64, 'bytes'),
  'pass2_bootstrap.seedsTested': SEEDS,
  'pass2_bootstrap.noncesPerSeed': exactly(PASS2_TOTAL_NONCES, 'src/config.ts PASS2_TOTAL_NONCES'),
  'pass2_bootstrap.earlyWindow[*]': P2_NONCE, 'pass2_bootstrap.lateWindow[*]': P2_NONCE,
  'pass2_bootstrap.bootstrapReps': exactly(SIM_BOOTSTRAP_REPS, 'src/config.ts SIM_BOOTSTRAP_REPS'),
  'pass2_bootstrap.replicateIndex[*]': REPS, 'pass2_bootstrap.derivedSeedBytes': intIn(1, 64, 'bytes'),
  'pass2_bootstrap.nullStatistics': exactly(SIM_BOOTSTRAP_REPS, 'src/config.ts SIM_BOOTSTRAP_REPS'),
};

const EXACT_SOLVE = (prefix: string, decks: number | null): Record<string, Domain> => ({
  ...(decks === null ? {} : { [`${prefix}.model.decks`]: exactly(decks, 'the modelled shoe') }),
  [`${prefix}.rules.blackjackPays`]: exactly(BLACKJACK_PAYS, 'src/config.ts RULES.blackjackPays'),
  [`${prefix}.evPerInitialBet`]: FINITE, [`${prefix}.rtpPerInitialBet`]: RTP, [`${prefix}.edgePerInitialBet`]: FINITE,
  [`${prefix}.avgWager`]: AVG_WAGER, [`${prefix}.evPerTotalWagered`]: FINITE, [`${prefix}.rtpPerTotalWagered`]: RTP,
  [`${prefix}.edgePerTotalWagered`]: FINITE, [`${prefix}.playerBlackjackFreq`]: PROB,
  [`${prefix}.dealerBlackjackFreq`]: PROB, [`${prefix}.probabilityMass`]: MASS,
});

const EXACT_RTP: Record<string, Domain> = {
  ...EXACT_SOLVE('finite8TD', 8), ...EXACT_SOLVE('finite1TD', 1), ...EXACT_SOLVE('infiniteCD', null),
  'cardRemovalLiftPP': FINITE,
  'wooAnchor.basicStrategyContinuousShuffler': FINITE, 'wooAnchor.deltaVsFinite8TD': FINITE,
  'wooAnchor.sixDeckPublished': FINITE, 'wooAnchor.sixDeckExact': FINITE,
  // BLACKJACK-21: the exact moments of the per-round return. |R| ≤ MAX_WAGER on every round (a
  // round loses at most its 4 staked units and nets at most 4 on a doubled split), so E[R²] ≤ 16.
  'finite8TDMoments.model.decks': exactly(8, 'the modelled shoe'),
  'finite8TDMoments.meanSequential': FINITE,
  'finite8TDMoments.secondMoment': D(`E[R²] in (0, ${MAX_WAGER * MAX_WAGER}]`, (v) => Number.isFinite(v) && v > 0 && v <= MAX_WAGER * MAX_WAGER),
  'finite8TDMoments.variance': D(`a variance in (0, ${MAX_WAGER * MAX_WAGER}]`, (v) => Number.isFinite(v) && v > 0 && v <= MAX_WAGER * MAX_WAGER),
  'finite8TDMoments.sd': D(`an SD in (0, ${MAX_WAGER}]`, (v) => Number.isFinite(v) && v > 0 && v <= MAX_WAGER),
  'finite8TDMoments.probabilityMass': MASS,
};

const DRAWS = EXPECTED_HANDS * (SHOE_SIZE - 1);
const RNG_BRANCH: Record<string, Domain> = {
  'observed.shoes': exactly(EXPECTED_HANDS, 'src/config.ts EXPECTED_HANDS'),
  'observed.drawsTotal': exactly(DRAWS, 'hands × 415 draws'),
  'observed.firstChunkAccept': intIn(0, DRAWS, 'draws'), 'observed.laterChunkAccept': intIn(0, DRAWS, 'draws'),
  'observed.cursorAdvanceFallback': intIn(0, DRAWS, 'draws'), 'observed.individualChunkRejections': INT,
  'analytic.expectedLaterChunkDrawsOverCapture': NONNEG, 'analytic.probabilityNoRejectionAnywhereInCapture': PROB,
  'analytic.expectedCursorAdvanceEventsOverCapture': NONNEG,
  'exposureIfRejectionOmitted.maxAbsPointBias': PROB,
  'exposureIfRejectionOmitted.maxAbsPointBiasAtRange': intIn(2, SHOE_SIZE, 'a shuffle range'),
  'exposureIfRejectionOmitted.maxTotalVariationDistance': PROB,
  'exposureIfRejectionOmitted.maxTotalVariationDistanceAtRange': intIn(2, SHOE_SIZE, 'a shuffle range'),
};

const ATTACK: Record<string, Domain> = {
  'candidatesPerEpoch': intIn(1, 1_000_000, 'candidate seeds'), 'epochs': SEEDS,
  'roundsPerEpoch': exactly(EXPECTED_EPOCH_SIZE, 'src/config.ts EXPECTED_EPOCH_SIZE'),
  'bootstrapReps': exactly(SIM_BOOTSTRAP_REPS, 'src/config.ts SIM_BOOTSTRAP_REPS'), 'alpha': PROB_POS,
  'honest.wagered': halfIn(0, MAX_WAGER * EXPECTED_HANDS, 'Σ wagered'), 'honest.returned': halfIn(0, MAX_RETURN * EXPECTED_HANDS, 'Σ returned'),
  'honest.rtp': RTP, 'honest.meanNetPerEpoch': FINITE, 'honest.meanLossPerEpoch': FINITE,
  'honest.deviationSigmaVsExactExpectation': FINITE,
  'ground.wagered': halfIn(0, MAX_WAGER * EXPECTED_HANDS, 'Σ wagered'), 'ground.returned': halfIn(0, MAX_RETURN * EXPECTED_HANDS, 'Σ returned'),
  'ground.rtp': RTP, 'ground.meanNetPerEpoch': FINITE, 'ground.meanLossPerEpoch': FINITE,
  'ground.deviationSigmaVsExactExpectation': FINITE,
  'expectation.exactEdgePerInitialBet': FINITE, 'expectation.meanLossPerEpochAtExactEdge': NONNEG,
  'expectation.meanNetPerEpochAtExactEdge': FINITE, 'expectation.sdPerRound': POS, 'expectation.sdPerEpoch': POS, 'expectation.seOfMeanOverEpochs': POS,
  'moneyDetector.window': exactly(PASS2_WINDOW, 'src/config.ts PASS2_WINDOW'),
  'moneyDetector.windows': exactly(PASS2_WINDOWS, 'src/config.ts PASS2_WINDOWS'),
  'moneyDetector.alpha': PROB_POS, 'moneyDetector.familyAlpha': PROB_POS, 'moneyDetector.familyGate': SEEDS,
  'moneyDetector.candidatesPerEpoch': intIn(1, 1_000_000, 'candidate seeds'),
  'moneyDetector.seedsTested': SEEDS, 'moneyDetector.seedsFlagged': SEEDS,
  'moneyDetector.servedRounds': exactly(EXPECTED_HANDS, 'seeds × served window'),
  'moneyDetector.pooledNet': POOLED_NET, 'moneyDetector.pooledExpectedNet': FINITE, 'moneyDetector.sdPerRound': POS, 'moneyDetector.pooledSD': POS,
  'moneyDetector.pooledZ': FINITE, 'moneyDetector.pooledZGate': FINITE,
  'detector.step19FlagsOnSelectedBlocks': SEEDS, 'detector.nullFlagProbability': PROB,
  'detector.expectedFlagsByChance': NONNEG, 'detector.binomialSurvivalP': PROB,
  'detector.earlyExtremeCount': SEEDS, 'detector.lateQuietAmongEarlyExtreme': SEEDS,
  'detector.worstGroundBlock.epoch': EPOCH, 'detector.worstGroundBlock.groundRtp': RTP,
  'detector.worstGroundBlock.groundNet': SERVED_NET, 'detector.worstGroundBlock.groundLoss': FINITE,
  'detector.worstGroundBlock.servedWindowBootstrapP': PROB_POS, 'detector.worstGroundBlock.lateWindowPValue': PROB,
  'results[*].epoch': EPOCH, 'results[*].honestNet': SERVED_NET, 'results[*].honestRtp': RTP,
  'results[*].groundNet': SERVED_NET, 'results[*].groundRtp': RTP, 'results[*].moneyP': PROB_POS,
  'results[*].servedWindowChi2': NONNEG, 'results[*].servedWindowBootstrapP': PROB_POS,
  'results[*].lateWindowChi2': NONNEG, 'results[*].lateWindowDf': exactly(FIRST_CARD_DF, 'RANKS − 1'),
  'results[*].lateWindowPValue': PROB,
};

const DEEP_REPLAY: Record<string, Domain> = {
  'pass0.rounds': exactly(SIM_BASE_ROUNDS, 'src/config.ts SIM_BASE_ROUNDS'),
  'pass0.checkpointsChecked': intIn(0, 64, 'checkpoints'),
  'pass1.rounds': exactly(SIM_PASS1_ROUNDS, 'src/config.ts SIM_PASS1_ROUNDS'),
  'pass1.rowsReplayed': intIn(0, Math.ceil(SIM_PASS1_ROUNDS / PASS1_ROW_NONCES), 'census rows'),
  'pass1.rowMismatches': intIn(0, Math.ceil(SIM_PASS1_ROUNDS / PASS1_ROW_NONCES), 'census rows'),
  'pass2.seeds': SEEDS, 'pass2.noncesPerSeed': exactly(PASS2_TOTAL_NONCES, 'src/config.ts PASS2_TOTAL_NONCES'),
  'pass2.windowsPerSeed': exactly(PASS2_WINDOWS, 'src/config.ts PASS2_WINDOWS'), 'pass2.seedMismatches': SEEDS,
  'comparisons': INT, 'mismatches': INT,
};

const BOOTSTRAP_REPLAY: Record<string, Domain> = {
  'bootstrapStatisticsChecked': intIn(0, SIM_BOOTSTRAP_REPS, 'replicates'),
  'bootstrapStatisticMismatches': intIn(0, SIM_BOOTSTRAP_REPS, 'replicates'),
  'earlyChiSquareRowsChecked': SEEDS, 'earlyChiSquareMismatches': SEEDS,
  'lateChiSquareRowsChecked': SEEDS, 'lateChiSquareMismatches': SEEDS,
  'bootstrapPValuesChecked': SEEDS, 'bootstrapPValueMismatches': SEEDS,
  'latePMaxAbsoluteDifference': NONNEG,
  'shoesDerived': intIn(0, SIM_BOOTSTRAP_REPS * EXPECTED_EPOCH_SIZE + EXPECTED_SEEDS * PASS2_TOTAL_NONCES, 'null + Pass-2 shoes'),
  'flagEpochs[*]': EPOCH, 'cherryPickFlags': SEEDS, 'expectedFlagsByChance': NONNEG, 'binomialSurvival': PROB,
  'results[*].epoch': EPOCH, 'results[*].earlyChi2': NONNEG, 'results[*].earlyBootstrapP': PROB_POS,
  'results[*].lateChi2': NONNEG, 'results[*].latePValue': PROB,
};

const FIGURES: Record<string, Domain> = {
  'moneyPath.mainWageredUsdc': MONEY, 'moneyPath.sideWageredUsdc': MONEY, 'moneyPath.insuranceWageredUsdc': MONEY,
  'moneyPath.wageredExInsuranceUsdc': MONEY, 'moneyPath.wageredInclInsuranceUsdc': MONEY,
  'moneyPath.returnedUsdc': MONEY, 'moneyPath.returnedExInsuranceUsdc': MONEY,
  'moneyPath.realizedRtpInclInsurancePct': PCT_ANY, 'moneyPath.realizedRtpExInsurancePct': PCT_ANY,
  'insurance.rounds': HANDS, 'insurance.atLowStake': HANDS, 'insurance.atHighStake': HANDS,
  'insurance.wageredUsdc': MONEY, 'insurance.returnedUsdc': MONEY,
  'insurance.settledAt3x': HANDS, 'insurance.settledAt0x': HANDS,
  'naturals.total': HANDS, 'naturals.won': HANDS, 'naturals.pushed': HANDS, 'naturals.ofAllRoundsPct': PCT,
  'perfectPairsLive.bets': HANDS, 'perfectPairsLive.wins': HANDS, 'perfectPairsLive.wageredUsdc': MONEY,
  'perfectPairsLive.returnedUsdc': MONEY, 'perfectPairsLive.returnPct': PCT_ANY,
  'perfectPairsLive.hitRatePct': PCT, 'perfectPairsLive.expectedHitRatePct': PCT,
  'sideBetEdges.perfectPairsEdgePct': FINITE, 'sideBetEdges.perfectPairsRtpPct': PCT_ANY,
  'sideBetEdges.perfectPairsAt12to1EdgePct': FINITE, 'sideBetEdges.perfectPairsAt12to1RtpPct': PCT_ANY,
  'sideBetEdges.coloredPairPipGainPP': FINITE, 'sideBetEdges.twentyOnePlusThreeEdgePct': FINITE,
  'workedExamples[*].epoch': EPOCH, 'workedExamples[*].nonce': intIn(0, EXPECTED_EPOCH_SIZE - 1, 'a served nonce'),
  'workedExamples[*].credited': MONEY, 'workedExamples[*].components[*].amountUsdc': MONEY,
  'workedExamples[*].componentsSumUsdc': MONEY,
  'infiniteDeck.edgeTdPct': FINITE, 'infiniteDeck.edgeCdPct': FINITE, 'infiniteDeck.tableCostPP': FINITE,
  'infiniteDeck.finite8TdEdgePct': FINITE, 'infiniteDeck.cardRemovalLiftTdVsTdPP': FINITE,
};

const STEPS = 31;
const RESULTS: Record<string, Domain> = {
  'summary.passed': intIn(0, STEPS, 'scored steps'),
  'summary.flags': intIn(0, STEPS, 'scored steps'), 'summary.operatorFlags': intIn(0, STEPS, 'scored steps'),
  'summary.captureFlags': intIn(0, STEPS, 'scored steps'), 'summary.hardFail': intIn(0, STEPS, 'scored steps'),
  'steps[*].step': intIn(1, STEPS, 'a scored step number'),
};

/** Domain table per JSON artifact of record, keyed by its path relative to the package root. */
export const DOMAIN_TABLES: Readonly<Record<string, Record<string, Domain>>> = {
  'outputs/simulation-results.json': SIMULATION,
  'outputs/simulation-provenance.json': PROVENANCE,
  'outputs/exact-rtp.json': EXACT_RTP,
  'outputs/rng-branch-coverage.json': RNG_BRANCH,
  'outputs/cherry-pick-attack.json': ATTACK,
  'outputs/deep-replay-report.json': DEEP_REPLAY,
  'outputs/bootstrap-replay-report.json': BOOTSTRAP_REPLAY,
  'outputs/report-figures.json': FIGURES,
  'outputs/verification-results.json': RESULTS,
};

/**
 * Walk every numeric leaf of `value`. `undeclared` lists normalised paths with no domain (a FAIL);
 * `violations` lists values outside their domain (a FAIL).
 */
export function checkArtifactDomains(file: string, value: unknown): { checked: number; undeclared: string[]; violations: string[] } {
  const table = DOMAIN_TABLES[file];
  const undeclared = new Set<string>();
  const violations: string[] = [];
  let checked = 0;
  const walk = (v: unknown, p: string): void => {
    if (Array.isArray(v)) { v.forEach((x) => walk(x, `${p}[*]`)); return; }
    if (v && typeof v === 'object') { for (const [k, x] of Object.entries(v as Record<string, unknown>)) walk(x, p ? `${p}.${k}` : k); return; }
    if (typeof v !== 'number') return;
    checked++;
    const d = table?.[p];
    if (!d) { undeclared.add(p); return; }
    if (!d.ok(v)) violations.push(`${p} = ${v} is not ${d.label}`);
  };
  walk(value, '');
  if (!table) return { checked, undeclared: ['<no domain table for this artifact>'], violations };
  return { checked, undeclared: [...undeclared], violations };
}

/**
 * RUN METADATA — key names that are a property of a run (when, how long), never of the evidence.
 * An artifact of record carrying one fails Step 25: run metadata is absent, not excluded.
 */
export const RUN_METADATA_KEY = /^(generatedAt|timestamp|createdAt|recordedAt|analysisRecordedAt|inputsRecordedAt|artifactGeneratedAt|executionTimeMs|elapsedMs|seconds|durationMs|runtimeMs)$/;

/** Every key path in `value` whose final key is run metadata. */
export function runMetadataPaths(value: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown, p: string): void => {
    if (Array.isArray(v)) { v.forEach((x) => walk(x, `${p}[*]`)); return; }
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        const q = p ? `${p}.${k}` : k;
        if (RUN_METADATA_KEY.test(k)) out.push(q);
        walk(x, q);
      }
    }
  };
  walk(value, '');
  return [...new Set(out)];
}
