/**
 * LIQD Blackjack — game configuration.
 *
 * Every value here was confirmed from the live game surface and/or read off the
 * 6,000-hand captured dataset (see verify.ts rules steps and MANIFEST.md#game-and-algorithm).
 * There is no external multiplier table to pin (blackjack is rule-driven, not
 * table-driven); the side-bet paytables are LIQD client constants, cross-checked
 * against live side-bet wins in the capture.
 */

/** The audit ID — README.md and MANIFEST.md carry it, the scored record emits it, check-standalone.mjs binds them. */
export const AUDIT_ID = 'PF-2026-LQ01';

/**
 * Unit specs the suite declares. The zero-install runner (test.js, scripts/standalone-runtime.cjs)
 * counts every spec that ran to completion and exits 1 unless the count equals this — Node's runner
 * exits 0 when every spec that RAN passed, so a block that was skipped or never registered would
 * otherwise leave the run green with fewer specs. Changed only in a diff.
 */
export const EXPECTED_UNIT_TESTS = 117;

/** SHA-256 of the captured dataset — the verifier aborts if this does not match. */
export const DATASET_SHA256 = 'c2a28c5164a546105963ffb4ff8e7c422a68802df47afcdcfa0b4fdbad1fdbf7';

/**
 * SHA-256 of the committed simulation artifact (`outputs/simulation-results.json`).
 * Steps 17–19 score whatever that file contains, so the repo pins it. The pin is reconciled in
 * SCORED Step 25 (Artifact Hash Integrity) — presence AND hash, both hard FAILs. It used to be
 * enforced by `tests/verify.ts` aborting the process before any step printed, which made a
 * substituted artifact indistinguishable from a crash to a gate harness, and made a DELETED
 * artifact skip the guard entirely. `npm run test:full` regenerates the simulation from the
 * PINNED master seed into outputs/run/ and diffs it against this file (the former SIM_FRESH=1
 * hash bypass is gone: nothing regenerates a committed artifact in place). Scope note: this pin protects third parties against artifact drift/substitution; it
 * cannot make the repo self-proving against its own publisher, who could re-pin at will.
 */
export const SIMULATION_SHA256 = '26ab1574ced2a1e59ca653a582951dac304ca62ea621e96b2b6de1e08a193567';

/**
 * SHA-256 of the committed convergence chart (`outputs/rtp-convergence.html`). The chart and the
 * JSON are two outputs of ONE `npm run simulate` and must move together — pinning only the JSON
 * let a stale chart (labelling a pre-fix figure "AUTHORITATIVE") survive a full gate. Reconciled
 * in scored Step 25 alongside the JSON pin (presence and hash, unconditionally).
 */
export const SIMULATION_HTML_SHA256 = '45ce9d7ad631d600adfb526b68646c5c90434806f449aada193640bf90d8d4bb';

/**
 * SHA-256 of the committed exact-RTP artifact (`outputs/exact-rtp.json`).
 *
 * This file is fully deterministic — `npm run rtp` regenerates it byte-identically — so the pin
 * needs no `SIM_FRESH`-style bypass: it only ever moves when the solver itself changes, which is
 * exactly when a human should have to look.
 *
 * TWO guards, deliberately, because they fail for different reasons:
 *   - `tests/blackjack/exactSolverTests.ts` re-derives the artifact from live solves via
 *     `buildExactArtifact()` and deep-compares every field. That proves the committed NUMBERS are
 *     the real solve, which a hash can never do — but it lives in mocha, so the scored `npm run
 *     verify` path could not see a forged artifact at all.
 *   - This pin, reconciled in scored Step 25 beside the other artifact pins, binds the artifact
 *     in the SCORED run at zero cost: without it, self-consistent nonsense planted in this file
 *     scores 31/31, because the verifier never reads the file. The pin is checked inside the
 *     scored step, not in a fail-fast abort, and carries a PRESENCE assertion, so a forged or
 *     deleted file is a visible Step 25 FAIL, not an abort before scoring or a silent 31/31.
 */
export const EXACT_RTP_SHA256 = 'f89b1920086bf0af17dbf5f30350bfef259a6fa0f934631a7ffa41e34cec4611';

/**
 * SHA-256 of `outputs/cherry-pick-attack.json` — the measured return-based seed grind against
 * this audit's own Step-19 detector (`npm run attack`, src/cherry-pick-attack.ts).
 *
 * It is the producing artifact for every figure the report quotes about cherry-pick DETECTION
 * POWER, so it is pinned like any other. Deterministic by construction — candidate and bootstrap
 * seeds are SHA-256 of fixed labels and the file carries no timestamp — so `npm run attack`
 * reproduces it byte-for-byte and the pin needs no SIM_FRESH-style bypass.
 */
export const ATTACK_SHA256 = '44d45d84a8cd7d54dee3fca146be7e146f4e1fa65385cd34d33fa611ee9d1e78';

/**
 * SHA-256 of `outputs/rng-branch-coverage.json` — which paths of the draw primitive the capture
 * actually exercised (`npm run branches`, src/rng-branch-audit.ts). Producing artifact for the
 * "the rejection branch is ASSUMED, not witnessed" figures in MANIFEST.md#game-and-algorithm (DL-2).
 * Deterministic: it replays the committed dataset and evaluates closed forms.
 */
export const RNG_BRANCH_SHA256 = 'eb2c74a1ecf84d3dbf3c1cc3a490b9c04ad1a24d201c4f58efc4403bbacb4593';

/**
 * SHA-256 of `outputs/simulation-provenance.json` — the record of WHICH inputs produced the
 * committed simulation: master seed, derivation version and domains, sizes, and the digests of
 * the dataset, the simulation artifact and the retained bootstrap nulls.
 *
 * It is regenerated by `npm run simulate` (into outputs/run/, and diffed). Its PRESENCE and hash
 * are required unconditionally: a release that claims replayable inputs and ships no record of
 * them is the defect this file exists to close, not a smaller version of it.
 */
export const SIMULATION_PROVENANCE_SHA256 = '5ad0e673045c4b26ae0dd63fff3b3fbfb96b5cf8778039254261238a89571b4c';

/**
 * SHA-256 of `outputs/bootstrap-nulls.float64le` — the 2,000 retained Pass-2 bootstrap statistics,
 * IEEE-754 float64 little-endian in GENERATION ORDER (index r = replicate r), 16,000 bytes.
 *
 * This file IS the evidence. `earlyBootstrapP` used to be documented as "not reproducible by
 * construction" because the null was drawn from fresh entropy and discarded; it is now a function
 * of these bytes plus a recomputed χ², and scored Step 19 recomputes all 120 of them from it.
 */
export const BOOTSTRAP_NULLS_SHA256 = 'c69eeb27b6e0679658c5f2bf1f3d5c60481ee6de062ae16e1cc901bcbac87916';

/**
 * SHA-256 of the two REPLAY REPORTS the chapters quote (evidence E03c / E03d), pinned since
 * 2026-09-24 (BLACKJACK-27): `outputs/deep-replay-report.json` (src/deep-replay.ts --commit — every
 * pass re-dealt from the recorded seeds) and `outputs/bootstrap-replay-report.json`
 * (replay/replay-bootstrap.py --commit — the Python standard-library re-derivation). Neither carries
 * run metadata (no timestamp, no elapsed seconds), so a re-run reproduces them byte for byte.
 */
export const DEEP_REPLAY_SHA256 = '44f2c8377f14df3e996ee2f753b7ec38faae97edd20497772cdd04c992b2ccbe';
/**
 * The method sentence src/deep-replay.ts writes into outputs/deep-replay-report.json. Declared here,
 * not in that script, because importing the script runs the replay. artifactTests.ts asserts the
 * committed report carries exactly this sentence, so a report written by an older replay (the one
 * committed until 2026-10-02 said "Exact equality on every field; no tolerance" after the code had
 * moved two fields to the reproduction bound) fails a unit test instead of shipping.
 */
export const DEEP_REPLAY_METHOD = 'EXECUTED: every pass re-dealt from the committed master seed and the revealed seeds through the same pure pass functions the simulator uses (src/replay.ts). Exact equality on every field except the two libm-derived Pass-1 p-values (firstCardPValue, serialRunsPValue), which are held to the reproduction bound 1e-14 abs + 1e-12 rel (since 2026-09-28).';
export const BOOTSTRAP_REPLAY_SHA256 = 'c4cf022c5d34bdfba86829f87551591baba694e1bf8351b99f138738deae4e05';

/**
 * SHA-256 of `tests/fixtures/legacy-simulation-results.json` — the SUPERSEDED simulation artifact,
 * frozen as an immutable test input.
 *
 * WHY IT IS KEPT. The 2026-09-02 run is the artifact several historical statements were pinned to,
 * and deleting it would quietly rewrite what those statements referred to. Its random inputs were
 * never recorded and cannot be recovered, so it is NOT presented as reproducible and is NOT the
 * artifact of record: it is a fixture, its byte digest is pinned here, and the only thing asserted
 * about it is byte identity and the absence of the replay fields this release adds.
 */
export const LEGACY_SIMULATION_SHA256 = '782c056164982d76879225c2e4059d1d7ee29f176e095ee78105386759574686';

/**
 * The ProvablyFair.org site verifier a player uses for this game (BLACKJACK-24), vendored
 * byte-for-byte into verifier-parity/ from the site repository's VerifyBets component and pinned
 * here. Step 6 loads the pinned bytes (src/site-verifier.ts) and runs them against this package's
 * recomputation; `scripts/check-site-verifier.mjs` compares a site checkout with these digests.
 */
export const SITE_VERIFIER_PINS: ReadonlyArray<{ file: string; sitePath: string; sha256: string }> = [
  { file: 'games/blackjack/derive.js', sitePath: 'src/components/VerifyBets/games/blackjack/derive.js',
    sha256: '38792bc400640ea4b95ec9f0afc88ae31a5cf4d46130febbeb8eb6f3ae8ac59b' },
  { file: 'lib/hmac-sha256.js', sitePath: 'src/components/VerifyBets/lib/hmac-sha256.js',
    sha256: '2095571fecd77f536bb3363c801cd70786856e687d108e0ff2102a4e2a18b847' },
];
export const SITE_VERIFIER_DIR = 'verifier-parity';

/**
 * SHA-256 of `capture/capture-liqd-blackjack.aug05-rig.mjs` (BLACKJACK-06, pinned 2026-09-25) — the
 * capture rig that generated the epoch client seeds, copied byte-for-byte from an untracked workspace
 * file. Step 7 re-hashes it and binds its generator lines and phase plan to the dataset
 * (src/capture-rig.ts). Provenance is circumstantial — MANIFEST DL-16.
 */
export const CAPTURE_RIG_SHA256 = '4a214c87176467dc62d7586ed971c9c361878b817ed2f8ee2417b7e2cfc033e2';

/**
 * A deterministic vector on which the rejection branch of the draw IS taken (it never is in the
 * capture — MANIFEST DL-2): the committed Pass-1 seed pair at nonce 5,591,308, cursor 409,
 * range 410 — range 410 has the largest rejection zone of the 415 ranges a shoe uses
 * (2³² mod 410 = 406). The first 4-byte chunk 4,294,967,202 is ≥ maxFair 4,294,966,890 and is
 * rejected; the second chunk gives 116. A draw with the branch deleted gives 312. Found by a
 * sequential search over nonces 0, 1, 2, … (2026-09-24). Step 6 checks it against the SAME draw
 * function the shoes are recomputed with, and runs the site verifier's shoe on this nonce too.
 */
export const REJECTION_VECTOR = {
  serverSeed: 'c3b8b8d6b50b6796b56cd6a7f4484f35', clientSeed: 'df0a6fb592b2813da9d8c1cad1c98dfe',
  nonce: 5591308, cursor: 409, range: 410, expected: 116, withoutRejection: 312,
} as const;

export const DECKS = 8; // scored Step 25 requires it to equal RULES.decks (below)
export const SHOE_SIZE = DECKS * 52; // 416
export const NOMINAL_HOUSE_EDGE = 0.01; // internal config label 1% (LIQD's game-settings response `houseEdge: 1`, E23; NOT the surface figure: the game surface advertises 0.48% [E16])

// ─────────────────────────────────────────────────────────────────────────────
// POPULATION PINS (G-BIND). The audit's population is declared HERE, in code, and
// never read out of the artifact being scored.
//
// WHY. The attack this blocks, as executed against
// this repo: delete one epoch (50 rounds + its `seeds[]` record) and decrement
// `meta.phases.F.hands` by 50. Every count the suite checked — `seeds.length`,
// `bets.length`, `meta.plannedTotal`, `meta.epochSize`, `meta.phases[*].hands` — was read
// from INSIDE the file under test, so shrinking the data and doctoring the header left the
// file internally consistent: `56 passing` (the suite's size on that run — a historical record
// of it, NOT the current test count; take that from your own `npx mocha`), `31/31`,
// PROVABLY FAIR — Full Pass, exit 0,
// with Step 1 printing "119/119 epochs" and Step 6 "5950/5950 hands". The SHA-256 pin does
// not help — it proves the bytes have not moved since WE pinned them, not that the file is
// the capture. A row COUNT is not an identity.
//
// `meta.plannedTotal`, `meta.progress.bets`, `meta.progress.seeds` and `seeds[].nonceEnd`
// were, before this, present in the dataset and read by NOTHING (grep: `nonceEnd` appeared
// only in `src/types.ts`). They are now all asserted against the constants below — Steps 4
// and 5 — so a doctored header is a contradiction rather than a dead field.
//
// These three numbers are the capture plan, fixed at Phase 0 and reproduced in MANIFEST.md.
// Changing one is a deliberate act that a human has to perform in source, in a diff.
// ─────────────────────────────────────────────────────────────────────────────
/** Epochs (server-seed rotations) the capture plan declares. */
export const EXPECTED_SEEDS = 120;
/** Rounds served per epoch before rotation. */
export const EXPECTED_EPOCH_SIZE = 50;
/** Total captured rounds. 120 × 50 = 6,000 — the population every headline figure rests on. */
export const EXPECTED_HANDS = EXPECTED_SEEDS * EXPECTED_EPOCH_SIZE;

/**
 * The first nonce of every epoch, DECLARED. LIQD restarts the nonce at 0 on every seed rotation,
 * so an epoch's window is exactly NONCE_BASE … NONCE_BASE + EXPECTED_EPOCH_SIZE − 1 = 0 … 49.
 * Step 4 checks each seed record's `nonceStart` AGAINST this constant rather than taking the
 * record's own value as the window: a window read from the file under test moves with the file.
 */
export const NONCE_BASE = 0;

/**
 * Auditor-side capture-retry nonce gaps the capture DECLARES. 0 — the capture rig settles every
 * round before rotating and never retried a nonce. Step 4 counts gaps against this: a gap count
 * above the declaration is an undeclared gap and FAILs; a gap count equal to a non-zero
 * declaration is a capture-origin FLAG (verdict-neutral, printed as a disclosed limitation).
 */
export const EXPECTED_CAPTURE_RETRY_GAPS = 0;

/**
 * THE CAPTURE PLAN, per phase — hands and main-bet stake, in code. Steps 24 and 31 used to read
 * both from `meta.phases`, which lives inside the file under test; a phase table restated inside
 * the dataset could then agree with any population. The dataset's own table is now scored AGAINST
 * this one, field for field. Stakes are USDC; E is the elevated-stake phase (100× the $0.10 base).
 */
export const PHASE_PLAN: Readonly<Record<string, { hands: number; stake: number }>> = {
  A: { hands: 3300, stake: 0.1 },
  B: { hands: 1000, stake: 0.1 },
  C: { hands: 500, stake: 0.1 },
  D: { hands: 500, stake: 0.1 },
  E: { hands: 200, stake: 10 },
  F: { hands: 500, stake: 0.1 },
};

/**
 * Side-stake relations the capture plan declares, as a fraction of the round's main-bet stake:
 * Perfect Pairs and 21+3 are staked at the main stake; insurance at half of it (the standard
 * insurance wager). Steps 10, 15 and 16 score every side stake against these.
 */
export const SIDE_STAKE_RATIO = { perfectPair: 1, twentyOnePlusThree: 1, insurance: 0.5 } as const;

/**
 * Coverage floors of the Blackjack profile (BLACKJACK-15), asserted as floors by Step 27. A
 * shortfall is a FLAG with a limitation row, never a silent pass.
 */
export const COVERAGE_FLOORS = {
  splits: 200, aceSplits: 20, das: 100, doubles: 500, fundedInsuranceDealerAce: 100,
} as const;

/**
 * The storefront edge the game surface shows the player (E16, `Edge: 0.48%`), as a fraction.
 * Step 20 reconciles it against the exact per-initial-bet edge at the surface's own precision
 * (two decimals of a percent).
 */
export const STOREFRONT_EDGE = 0.0048;

// ─────────────────────────────────────────────────────────────────────────────
// SIMULATION SHAPE PINS (G-BIND, second half).
//
// The Monte-Carlo tolerance used to be read from the artifact it gates:
// `se = 1.15 / sqrt(rounds)` with `rounds` taken from `outputs/simulation-results.json`,
// in both scored Step 17 and the mocha 3σ anchor. Forging the artifact to claim
// 1,000,000 rounds and 99.20% RTP and re-pinning SIMULATION_SHA256 made Step 17 print
// `[PASS] … simulation 0.8000% over 1,000,000 rounds (±0.1150 pp 1σ) → 2.72σ, limit 3σ`
// — a 5.5× wider gate, bought by claiming fewer rounds, missing the true edge by 0.31 pp.
//
// The round counts are therefore pinned beside the hash. σ is computed from the PINNED
// count, so a claimed-smaller run cannot widen its own acceptance window, and the artifact's
// own `rounds` must equal the pin or the step hard-FAILs.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * THE MASTER SEED OF THE COMMITTED SIMULATION, pinned (BLACKJACK-20). Every random input of the
 * three passes — the Pass-0 shuffle stream, the Pass-1 seed pair, every Pass-2 bootstrap replicate —
 * derives from it (src/rng.ts deriveSeedHex). It is the value the 2026-09-12 run generated from 32
 * random bytes and recorded in outputs/simulation-results.json; pinning it here makes `npm run
 * simulate` regenerate the committed experiment instead of drawing a new one, and Steps 17-19
 * require the artifact's own `masterSeed` to equal it. Pinning an existing recorded seed moved no
 * figure: the regeneration reproduced every field (outputs/run/simulation-diff.json).
 */
export const SIM_MASTER_SEED = '1565e5dec973a1df4a09967b69a12e0a21ab8d4cdfe8d8fc26ae08c1512501af';

/** Rounds in the committed base-game fair-shuffle Monte-Carlo (`baseGame.rounds`). */
export const SIM_BASE_ROUNDS = 30_000_000;
/** Rounds in the committed Pass-1 real-shoe fairness run (`pass1_fresh_seeds.rounds`). */
export const SIM_PASS1_ROUNDS = 1_000_000;
/**
 * Nonces per Pass-1 census row: the 1,000,000-round stream is recorded as 100 rows of 10,000, each
 * row its exact integer census (src/replay.ts Pass1Row). Declared, so the rows the artifact carries
 * never depend on the machine that produced them, and scored Step 18 replays whole rows.
 */
export const PASS1_ROW_NONCES = 10_000;
/** Pass-1 rows scored Step 18 re-deals from the seed pair in verify: the first and the last. */
export const PASS1_REPLAYED_ROWS = [0, -1] as const;
/**
 * Per-round SD of the per-initial-bet loss — the committed run's measured value is 1.14662130892236
 * (outputs/simulation-results.json baseGame.sdPerRound; the superseded run measured 1.146718922176392),
 * rounded up — the σ of the
 * Pass-0 and Pass-1 RTP gates (Steps 17, 18). NOT the σ of the Pass-2 pooled money test: since
 * 2026-09-25 (BLACKJACK-21) that is the EXACT per-round SD, 1.146686160256228, recomputed by
 * src/exact-play.ts moments() and carried in outputs/exact-rtp.json finite8TDMoments.
 */
export const SIM_SD_PER_ROUND = 1.15;
/**
 * Bootstrap replicates in the committed Pass-2 null (`pass2_casino_seeds.bootstrapReps`).
 *
 * Pinned for the same reason the round counts are: the retained null file's LENGTH and the
 * denominator of every bootstrap p-value are both this number, so an artifact that claimed fewer
 * replicates would shrink the file it has to produce and coarsen the p-values it has to match.
 */
export const SIM_BOOTSTRAP_REPS = 2_000;
/** Filename of the retained Pass-2 null statistics, under outputs/. */
export const BOOTSTRAP_NULL_FILE = 'bootstrap-nulls.float64le';
/**
 * Replicates scored Step 19 RE-DERIVES from the master seed and compares in place against the
 * retained file, every `BOOTSTRAP_SAMPLE_STRIDE`-th one plus the last. 40 of 2,000 at stride 50,
 * about 1.3 s. The FULL 2,000 are reproduced by `replay/replay-bootstrap.py`, independently, in
 * Python's standard library; this sample is the cheap in-run binding, not the whole proof, and
 * the step says so in its own detail string.
 */
export const BOOTSTRAP_SAMPLE_STRIDE = 50;

/**
 * Card ranks (A..K). An UNPOOLED first-card uniformity χ² has RANKS−1 = 12 degrees of freedom.
 *
 * Bin pooling matters here and is easy to get wrong: `chiSquaredTest` (src/stats.ts) merges the
 * end bins while their expected count is below 5. Pass 1 runs 1,000,000 rounds (expected 76,923
 * per rank) and Pass 2's LATE window 9,950 nonces (expected 765), so neither pools and both are
 * df 12. Pass 2's EARLY window is only 50 nonces (expected 3.85), so it pools to 11 bins on
 * df 10 — which is why Step 19 binds the early half by reproducing the raw χ² from the seeds
 * rather than by pinning a df.
 */
export const RANKS = 13;
/**
 * Degrees of freedom for the first-card rank χ². DERIVED from RANKS, never read from the
 * artifact: with `firstCardChi2=9999, firstCardDf=100000, firstCardPValue=1` set and the
 * artifact re-pinned, Step 18 printed "RECOMPUTED … p=1.0000" and PASSed — because the step
 * recomputed p from a df the artifact supplied.
 */
export const FIRST_CARD_DF = RANKS - 1;

/**
 * Pass-2 cherry-pick significance level. A seed flags when its early-window (served
 * nonces 0..49) first-card χ² sits in the top α of the bootstrap null AND its late window
 * does not, so the per-seed flag probability under the null is α(1−α) = 0.0475.
 *
 * Step 19 previously computed that probability as `expectedFlagsByChance / seeds_tested`,
 * both artifact fields: setting `cherryPickFlags=120, expectedFlagsByChance=120` made
 * p₀ = 1, the survival probability 1, and the step PASSed on a dataset where every single
 * epoch had flagged. p₀ is now this declared constant and nothing else.
 */
export const PASS2_ALPHA = 0.05;
/** Per-seed flag probability under the null: α × (1 − α). */
export const PASS2_P0 = PASS2_ALPHA * (1 - PASS2_ALPHA);
/** Served window scored by the Pass-2 early statistic — nonces 0..49, the rounds actually dealt. */
export const PASS2_EARLY_NONCES = EXPECTED_EPOCH_SIZE;
/**
 * Total nonces derived per revealed seed by the Pass-2 experiment: the served window (nonces 0..49)
 * plus the LATE control nonces 50..9,999. 10,000 — the BLACKJACK-21 floor. It was 1,000 until
 * 2026-09-24 (the late window was 950 nonces). Declared here rather than left as a local in
 * `src/simulate.ts` because `src/cherry-pick-attack.ts` has to score the SAME windows.
 */
export const PASS2_TOTAL_NONCES = 10_000;
/** Nonces in the late control window: 9,950, expected count per rank 765, so no bin pooling (df 12). */
export const PASS2_LATE_NONCES = PASS2_TOTAL_NONCES - PASS2_EARLY_NONCES;

// ─────────────────────────────────────────────────────────────────────────────
// PASS 2 — THE MONEY STATISTIC (BLACKJACK-21 primary). FIXED IN CODE BEFORE IT WAS FIRST COMPUTED
// (2026-09-24).
//
// For each revealed seed, nonces 0..9,999 are dealt from the real shoe with the epoch's own client
// seed and played to settlement under the declared basic strategy (src/strategy.ts via
// src/round-engine.ts). Each round's NET result (returned − wagered, in initial-bet units) is summed
// over windows of PASS2_WINDOW rounds: window 0 is nonces 0..49 — the captured nonce range — and
// windows 1..199 are the seed's own later windows. The statistic is the served window's net return.
//   per seed : p = (1 + #{late windows with net ≤ the served window's}) / PASS2_WINDOWS (one-sided,
//              low return = house-favourable), flagged at p ≤ PASS2_MONEY_ALPHA;
//   family   : flagged seeds > binomialTailThreshold(EXPECTED_SEEDS, PASS2_MONEY_ALPHA,
//              PASS2_FAMILY_ALPHA) → FLAG;
//   pooled   : z = (Σ served-window net − exact mean) / (σ · √(EXPECTED_HANDS)), the exact mean from
//              the exact 8-deck TD solve (−edge per round) and, since 2026-09-25, σ the EXACT per-round
//              SD √(E[R²] − E[R]²) from the same solve with splits played sequentially (src/exact-play.ts
//              moments(), 1.146686160256228) — until then the measured Pass-0 SD rounded up to 1.15;
//              z < −PASS2_POOLED_Z → FLAG.
// First-card rank uniformity (cherryPickFlag, below) is kept as the SECONDARY screen.
// ─────────────────────────────────────────────────────────────────────────────
/** Rounds per money window — the epoch size, so window 0 is exactly the served nonce range. */
export const PASS2_WINDOW = EXPECTED_EPOCH_SIZE;
/** Windows per seed: 10,000 / 50 = 200 — the served window and 199 later ones. */
export const PASS2_WINDOWS = PASS2_TOTAL_NONCES / PASS2_WINDOW;
/** Per-seed one-sided significance of the money statistic. */
export const PASS2_MONEY_ALPHA = 0.01;
/** Family-wise false-alarm budget for the flagged-seed count and for the pooled test. */
export const PASS2_FAMILY_ALPHA = 0.001;
/** One-sided normal critical value at PASS2_FAMILY_ALPHA (Φ(−3.090) = 0.001). */
export const PASS2_POOLED_Z = 3.090;
/** Relative shortfalls of the served window's RTP at which the pooled test's power is printed. */
export const PASS2_POWER_SHORTFALLS = [0.01, 0.02, 0.05, 0.10] as const;

/**
 * THE cherry-pick flag predicate. One definition, three callers.
 *
 * A seed flags when its early (served) window is extreme under the bootstrap null AND its late
 * control window is not — an early-only excess, which is the shape a selected seed would have.
 * Both halves matter: the conjunction is why the per-seed null probability is α(1−α) = PASS2_P0
 * and not α.
 *
 * ONE DEFINITION, because three copies are three predicates. The callers are `src/simulate.ts`
 * (Pass 2, which produced the pinned artifact), `tests/steps/simulation.ts` (scored Step 19,
 * which recomputes the flag count from the artifact's rows) and `src/cherry-pick-attack.ts`.
 * A copy that scored its selected blocks on `earlyP < α` ALONE and then labelled that "Step 19"
 * would report a chance rate of epochs × α and a survival probability computed at p₀ = α — both
 * describing a detector Step 19 does not implement. The predicate and the null parameter live
 * here and nothing restates them.
 */
export function cherryPickFlag(earlyP: number, lateP: number): boolean {
  return earlyP < PASS2_ALPHA && lateP >= PASS2_ALPHA;
}

/**
 * THE RULE SET, single-sourced (BLACKJACK-26). Every consumer reads this object and nothing else:
 *   - src/exact-play.ts   LIQD_RULES is built from it (the exact 8-deck solve);
 *   - src/round-engine.ts the simulator's / replay's round settlement (peek, 3:2, S17, DAS, split aces);
 *   - tests/steps/payouts.ts the per-hand settlement the capture is scored against (3:2, insurance 2:1);
 *   - tests/steps/rules.ts   the dealer draw rule replayed in Step 11 (S17);
 *   - anchor/rules.json      the rational oracle's copy (anchor/oracle.py reads it); Step 25 requires it
 *                            to equal this object field for field, so the Python anchor cannot drift;
 *   - Step 25 scores the dataset's own config block (meta.payout, meta.decks) against it.
 * Until 2026-09-24 each of those carried its own constants (the exact solver, the engine, the payout
 * evaluator and the oracle), which is what BLACKJACK-26 calls a rule set that is not single-sourced.
 * Payout ratios are carried as exact integer pairs because settlement is checked in integer 1e-8 units.
 */
export const RULES = {
  decks: 8,
  /** Dealer stands on soft 17 (S17). */
  s17: true,
  /** Double after split. */
  das: true,
  /** Double on any first two cards. */
  doubleAnyTwo: true,
  /** Dealer peeks for blackjack under an Ace or a ten-value up-card (US peek / OBO). */
  peek: true,
  /** A natural pays blackjackPays[0] : blackjackPays[1] — 3:2. */
  blackjackPays: [3, 2] as const,
  /** Insurance pays insurancePays[0] : insurancePays[1] — 2:1. */
  insurancePays: [2, 1] as const,
  /** Split aces receive one card each and take no further action. */
  splitAcesOneCard: true,
  /** Hands a round can hold after splitting — 2: one split, no re-split (ASSUMED, MANIFEST DL-5). */
  maxHandsAfterSplit: 2,
  /** A two-card 21 on a split hand settles as an ordinary 21, not as a natural. */
  splitTwentyOneIsNatural: false,
  /** Surrender offered (ASSUMED absent, MANIFEST DL-5). */
  surrender: false,
} as const;

/** THE dealer draw rule, from RULES.s17: draw below 17, and on a soft 17 only under H17. One definition,
 *  read by the round engine (src/round-engine.ts) and by Step 11's replay of every captured dealer hand. */
export function dealerDrawsOn(total: number, soft: boolean): boolean {
  return total < 17 || (total === 17 && soft && !RULES.s17);
}

/** The natural payout as a decimal (1.5 for 3:2), for the float engines. */
export const BLACKJACK_PAYS = RULES.blackjackPays[0] / RULES.blackjackPays[1];
/** The dataset's own notation for a ratio ("3:2"), used when its config block is scored. */
export const ratioLabel = (r: readonly [number, number]): string => `${r[0]}:${r[1]}`;

/** Perfect Pairs side-bet paytable (payout-to-1). LIQD client constants. */
export const PERFECT_PAIRS = {
  PERFECT_PAIR: 25, // same rank + same suit
  COLORED_PAIR: 13, // same rank + same colour, different suit
  MIXED_PAIR: 6, // same rank, different colour
} as const;

/** 21+3 side-bet paytable (payout-to-1) on the player's two cards + dealer upcard. */
export const TWENTY_ONE_PLUS_THREE = {
  SUITED_THREE_OF_A_KIND: 100,
  STRAIGHT_FLUSH: 40,
  THREE_OF_A_KIND: 30,
  STRAIGHT: 10,
  FLUSH: 5,
} as const;

/** Card value: A=11 (soft), 10/J/Q/K=10, else pip. rank is 1..13 (1=A..13=K). */
export function cardValueFromRank(rank: number): number {
  return rank === 1 ? 11 : rank >= 10 ? 10 : rank;
}

export const rankOf = (card: string): number => Number(card.split(':')[1]);
export const suitOf = (card: string): string => card.split(':')[0];

/** Hand total with soft-ace reduction. */
export function handValue(cards: string[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const v = cardValueFromRank(rankOf(c));
    total += v;
    if (v === 11) aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export const isBlackjack = (cards: string[]): boolean => cards.length === 2 && handValue(cards).total === 21;
