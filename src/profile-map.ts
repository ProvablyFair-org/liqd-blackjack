/**
 * Which ProvablyFair.org Blackjack profile check each scored step implements.
 *
 * WHY THIS FILE EXISTS. The framework's Blackjack game profile (Framework 1.1, profile
 * 1.0.2) declares checks BLACKJACK-01 … BLACKJACK-30. This suite scores 31 steps under its
 * own numbering, which every chapter cites by number and which therefore cannot be renumbered to
 * match. The mapping is declared here, emitted into `outputs/verification-results.json` beside the
 * step results, and read back by `pf-audit matrix`, which prints the conformance matrix and exits 1
 * when a HARD_FAIL check has nothing implementing it.
 *
 * THIS FILE LABELS; IT DOES NOT CHECK. Nothing here can make a step pass or fail. An id claimed for
 * a step the step does not implement is a false statement in a published artifact, so the rule is
 * the profile's own `asserts` text: claim the check only if the step's assertion actually decides it.
 *
 * COVERAGE DESCRIBES THE PACKAGE, NOT THE STEP.
 *   full    — nothing the profile's `asserts` requires is unimplemented; where a check is split
 *             across two or more steps every one of them says `full` and each note says which part
 *             it carries.
 *   partial — something the profile requires is implemented nowhere in this package, and the note
 *             says what. `partial` is a disclosure, never a softer word for `full`.
 *
 * EVERY COUNT BELOW WAS PRODUCED BY A RUN of this suite over the committed capture (2026-09-24),
 * and every `full` claim has a mutation in tests/mutations.json that makes the claiming step fire.
 */

export type Coverage = 'full' | 'partial';

export interface CheckClaim {
  id: string;
  coverage: Coverage;
  /** For `partial`: what the profile requires that this package does not do. */
  note?: string;
}

export interface StepClaims {
  claims: CheckClaim[];
  /** Required when `claims` is empty: why the step answers no profile check. */
  reason?: string;
}

export const PROFILE_GAME = 'blackjack';
export const PROFILE_VERSION = '1.0.2';

/** The audit ID (src/config.ts) — re-exported so the record's label block and verify.ts share one value. */
export { AUDIT_ID } from './config';

const B13 = 'the profile\'s settlement check is carried by Steps 8 (per-hand return from the cards in exact '
  + '1e-8 units, the operator\'s won/lost label reconciled against it 6,401/6,401, 27 two-card 21s on '
  + 'split hands settled as an ordinary 21, 1,448 doubled hands at 2× per hand through the money path, '
  + 'split hands summed per hand), 9 (3:2 isolated — 243 winning naturals at 2×credit == 5×stake) and '
  + '10 (insurance 2:1 iff dealer natural on the 446 insurance bets the casino booked on the capture\'s '
  + 'decline request, stake 0.5× main; MANIFEST DL-17)';
const B14 = 'the side-bet check is carried by Steps 15 and 16 (5,800 + 5,800 bets re-derived from the '
  + 'split-aware initial snapshot, category and exact payout = stake × (paytable + 1), each side stake '
  + '1× the main stake), 23 (every paytable category exercised: 3/3 Perfect Pairs, 5/5 21+3) and 29 '
  + '(11,600 snapshots equal the initial deal — invariant to later play). No forfeit-on-split exists at '
  + 'LIQD: split rounds settle both side bets on the original pair (Step 15/16 score them with the rest)';
const B15 = 'the rule-and-coverage check is carried by Step 27 (coverage floors asserted as floors — splits '
  + '401/200, ace splits 35/20, DAS 165/100, doubles 1,448/500, insurance records on a dealer Ace 446/100, a '
  + 'shortfall FLAGs — and the rule table: nine rules OBSERVED with witness counts, three ASSUMED: re-split and '
  + 'surrender (MANIFEST DL-5) and insurance can be declined (MANIFEST DL-17)), 12 (DAS from the token stream), '
  + '14 (0 surrender tokens; the capture script has no surrender call), 28 (insurance records only on a dealer '
  + 'Ace, one per capture insurance request) and 31 (every round staked at its phase\'s planned stake); '
  + 'uncaptured/voided games are Step 4\'s gap count (0 against 0 declared)';
const B10 = 'the rules replay is carried by Steps 6 (deal structure PDPD and the whole action stream: grammar '
  + 'G1–G6 plus hit+double tokens = extra cards, 6,000/6,000), 11 (S17 replayed both directions — '
  + 'over-draw and under-draw — with the 3:2-natural exemptions counted) and 13 (peek: 283 dealer '
  + 'naturals settled before any player action). Per-response card counts: the capture recorded settled '
  + 'rounds only, so there are no per-action responses to count (MANIFEST DL-10)';

/** Scored step number → the profile checks it implements. Every step 1..31 has an entry. */
export const STEP_CLAIMS: Record<number, StepClaims> = {
  1: { claims: [{
    id: 'BLACKJACK-01', coverage: 'full',
    note: 'per-seed SHA-256(utf8(serverSeed hex string)) == hashedServerSeed, 120/120, the one declared '
      + 'encoding (src/rng.ts commitHash); the denominator is EXPECTED_SEEDS in src/config.ts and '
      + 'seeds.length must equal it, so a capture shipping fewer seed records FAILs',
  }] },
  2: { claims: [{
    id: 'BLACKJACK-02', coverage: 'full',
    note: '119/119 next-seed links recomputed from the raw hash fields (seeds[i].nextHashedServerSeed == '
      + 'seeds[i+1].hashedServerSeed, count bound to EXPECTED_SEEDS−1) PLUS the pre-capture anchor: '
      + 'meta.preCapture.revealedServerSeed hashes to its commitment and its nextHashedServerSeed equals '
      + 'epoch 0\'s commitment; an absent anchor FAILs. The capture\'s commitVerified / chainLinkOk '
      + 'booleans are deleted on load and never read. No resume seam exists in this capture',
  }] },
  3: { claims: [{
    id: 'BLACKJACK-03', coverage: 'full',
    note: 'both halves: bets grouped by their epoch label carry the ONE hash on that epoch\'s seed record '
      + '(120/120), and every round of an epoch carries ONE client seed, the one on the seed record '
      + '(120/120); epoch count bound to EXPECTED_SEEDS',
  }] },
  4: { claims: [{
    id: 'BLACKJACK-04', coverage: 'full',
    note: 'the window is DECLARED (src/config.ts NONCE_BASE 0, EXPECTED_EPOCH_SIZE 50 → 0…49); each seed '
      + 'record\'s nonceStart/nonceEnd is checked AGAINST it and a round must be present at nonceEnd; '
      + 'repeats, reorders and out-of-window nonces FAIL; missing nonces are counted against '
      + 'EXPECTED_CAPTURE_RETRY_GAPS (declared 0): an undeclared gap FAILs and no would-be card is '
      + 'derived for it, a gap count equal to a non-zero declaration is a capture-origin FLAG '
      + '(verdict-neutral, printed as a disclosed limitation). Measured 0 missing, 0 repeats, 120/120 '
      + 'windows closed. The operator-side gap is scored stricter than the profile (FAIL, not FLAG)',
  }] },
  5: { claims: [{
    id: 'BLACKJACK-05', coverage: 'full',
    note: 'the seeds / epoch-size / hands half: 120 epochs × 50 = 6,000 against EXPECTED_SEEDS, '
      + 'EXPECTED_EPOCH_SIZE, EXPECTED_HANDS in src/config.ts, and the dataset header (meta.epochSize, '
      + 'meta.plannedTotal, meta.progress.*) scored against them. Per-phase counts are Step 24, stakes '
      + 'Step 31 — both from src/config.ts PHASE_PLAN',
  }] },
  6: { claims: [
    {
      id: 'BLACKJACK-07', coverage: 'full',
      note: '6,000/6,000 hands recomputed card for card in strict draw order — 5,599 single-hand rounds '
        + 'PDPD then player then dealer, 401 split rounds in the declared split order (main[0], dealer[0], '
        + 'split[0], dealer[1], main[1], split[1], split plays out, main plays out, dealer) — coverage bound '
        + 'to EXPECTED_HANDS, a skipped hand FAILs',
    },
    {
      id: 'BLACKJACK-08', coverage: 'full',
      note: 'the bound is IN THE STEP DETAIL as computed quantities: maxFair for each of the 415 ranges the '
        + 'shuffle draws over (src/rng.ts maxFairFor, the one definition the draw reads), 415/415 exact '
        + 'multiples so the per-value bias is exactly 0, the worst first-chunk rejection probability '
        + '9.453e-8 (range 410), and the rejection census counted on the draws that produced the compared '
        + 'shoes — 0 first-chunk rejections and 0 cursor advances in 2,490,000 draws against 0.0569 '
        + 'expected. The unexercised branch is shown on a vector (Pass-1 seed pair, nonce 5,591,308, cursor '
        + '409, range 410: draws 116, deletion gives 312). That the operator\'s server takes the branch is '
        + 'ASSUMED (MANIFEST DL-2)',
    },
    { id: 'BLACKJACK-10', coverage: 'full', note: B10 },
    {
      id: 'BLACKJACK-24', coverage: 'full',
      note: 'the ProvablyFair.org site verifier (VerifyBets games/blackjack/derive.js + lib/hmac-sha256.js) '
        + 'is vendored byte-for-byte in verifier-parity/, its SHA-256 recorded in src/config.ts '
        + 'SITE_VERIFIER_PINS and re-hashed on every run, and EXECUTED: deriveBlackjackSync on a declared '
        + 'sample of 515 rounds (all 401 splits + the nonce-0 round of all 120 epochs) reproduces the '
        + 'recorded hands card for card and the per-hand return this package derives (916 hands), and its '
        + 'full 416-card shoe equals this package\'s on 121 shoes incl. the rejection vector. Its pure-JS '
        + 'SHA-256 (~50 ms/round) is why the other 5,485 rounds are not run through it. '
        + 'scripts/check-site-verifier.mjs compares a site checkout with the pins',
    },
  ] },
  7: { claims: [{
    id: 'BLACKJACK-06', coverage: 'full',
    note: 'the wrong-seed and generator half: 1,000 rounds re-derived under a WRONG and under an EMPTY client '
      + 'seed, first-card survivors gated at the model rate E + 5σ (E = n/52 = 19.23, gate 40.95; measured 26 '
      + 'and 18), a hard FAIL above it or at 0 % change. "The A–C generator is disclosed and is a CSPRNG" — met '
      + 'since 2026-09-25 on CIRCUMSTANTIAL provenance: the capture rig is shipped byte-for-byte '
      + '(capture/capture-liqd-blackjack.aug05-rig.mjs, SHA-256 pinned as CAPTURE_RIG_SHA256) and Step 7 binds '
      + 'it to the data — randHex = crypto.getRandomValues (the global Web Crypto CSPRNG, not rebound), '
      + 'clientSeedFor = \'audit\' + randHex(6) for A–C/E/F and pfaudit-STAMP-E for D, 4/4 rotate() calls '
      + 'through it, Math.random only in the demo renderer, the rig\'s phase plan equal to the dataset on '
      + '120/120 epochs, 110/110 non-D seeds in the randHex(6) shape (all distinct), 10/10 D seeds carrying '
      + 'their own epoch and one stamp 1785954682036, 6 ms before meta.startedAt. The rig was never committed '
      + '(untracked workspace file, mtime 2026-08-05T18:30:54Z) — MANIFEST DL-16 says so. Phase D is Step 26. '
      + 'FAIL probed: rig randHex swapped to Math.random and re-pinned; rig plan shifted and re-pinned (R78, R79)',
  }] },
  8: { claims: [
    {
      id: 'BLACKJACK-11', coverage: 'full',
      note: 'every per-hand credit reconstructed from the cards (Step 8); round credit == (Σ per-hand credit) × m '
        + '+ Σ side-bet credit (insurance included) as EXACT integer equality in 1e-8 settlement units on '
        + '6,000/6,000 rounds, with partial-double splits bounded (Step 8b). The round credit is the capture '
        + 'script\'s own sum of the casino\'s credit records, so 8b carries information on the 1,283 doubled '
        + 'rounds only (each double bet credited like its hand) and cannot detect a skim by the casino; '
        + '42,894/42,894 recorded amounts on-grid; no float tolerance anywhere',
    },
    { id: 'BLACKJACK-13', coverage: 'full', note: B13 },
  ] },
  9: { claims: [{ id: 'BLACKJACK-13', coverage: 'full', note: B13 }] },
  10: { claims: [{ id: 'BLACKJACK-13', coverage: 'full', note: B13 }] },
  11: { claims: [{ id: 'BLACKJACK-10', coverage: 'full', note: B10 }] },
  12: { claims: [{ id: 'BLACKJACK-15', coverage: 'full', note: B15 }] },
  13: { claims: [{ id: 'BLACKJACK-10', coverage: 'full', note: B10 }] },
  14: { claims: [{ id: 'BLACKJACK-15', coverage: 'full', note: B15 }] },
  15: { claims: [{ id: 'BLACKJACK-14', coverage: 'full', note: B14 }] },
  16: { claims: [{ id: 'BLACKJACK-14', coverage: 'full', note: B14 }] },
  17: { claims: [
    {
      id: 'BLACKJACK-18', coverage: 'full',
      note: 'the exact 8-deck TD solve (src/exact-play.ts) is recomputed in-step and reads no operator '
        + 'figure (the capture-side fields are deleted on load); anchored by the exact-rational reduced-shoe '
        + 'oracle at 1e-12 (tests/blackjack/exactOracleTests.ts) and Wizard of Odds with settings and date '
        + '(wooAnchorTests.ts); the negative control that a corrupted rule set moves the figure is the '
        + 'mutation battery in exactSolverTests.ts',
    },
  ] },
  18: { claims: [{
    id: 'BLACKJACK-20', coverage: 'full',
    note: '1,000,000 hands (SIM_PASS1_ROUNDS, the profile floor) of the REAL blackjackShoe under the declared '
      + 'basic strategy, on the seed pair derived from the PINNED master seed (SIM_MASTER_SEED). The artifact carries '
      + 'the stream\'s census as 100 exact integer rows of 10,000 nonces, and Step 18 RE-DERIVES every statistic from '
      + 'those rows with the function the simulator used: first-card χ² 6.73 (df 12 pinned, p = 0.8752), serial '
      + 'r₁ 5.73e-4 (|z| 0.57) and runs p 0.6387, and RTP 99.4977 % per initial bet against the exact 8-deck solve '
      + '99.5123 % (recomputed in-step) at the stated σ = 1.15/√1,000,000 → −0.13σ, limit 3σ. Rows 0 and 99 are '
      + 're-dealt from the seed pair in verify (exact); the whole census is reproduced byte for byte by `npm run '
      + 'simulate` (outputs/run/simulation-diff.json) and by src/deep-replay.ts (100/100 rows, '
      + 'outputs/deep-replay-report.json, pinned). FAIL probed: a census row edited and re-pinned; a derived '
      + 'statistic edited and re-pinned (tests/mutations.json R67, R68)',
  }] },
  19: { claims: [{
    id: 'BLACKJACK-21', coverage: 'full',
    note: 'every revealed seed × 10,000 nonces; early window = nonces 0..49, the captured range; PRIMARY statistic '
      + 'money — the declared strategy\'s net per 50-round window, the served window ranked against the seed\'s own '
      + '199 later windows (bootstrap null, one-sided, rule fixed in src/config.ts before first computed: p ≤ 0.01 per '
      + 'seed, family gate 6 at 0.001) — 1/120 flagged; the pooled served-window net against the EXACT mean AND the '
      + 'EXACT variance (since 2026-09-25): σ = √(E[R²] − E[R]²) = 1.146686160256228 per round from the exact '
      + '8-deck solve with split hands played sequentially (src/exact-play.ts moments()), recomputed in-step, its '
      + 'sequential mean equal to the exact mean (|Δ| 4e-17), bound to outputs/exact-rtp.json finite8TDMoments, '
      + 'and E[R²] anchored to anchor/oracle.py exact fractions on three reduced shoes at 1e-12 — pooled z −0.746 '
      + '(gate −3.090); first-card rank uniformity kept as the secondary screen (7/120, P = 0.3444); every window\'s '
      + 'statistic re-derived in verify from the rows, the served window and one declared later window of every '
      + 'seed re-dealt from the revealed seeds (120/120), the whole census by src/deep-replay.ts (120/120); power '
      + 'printed with the result and MEASURED against a return-selecting attacker at the same σ (npm run attack: 50 '
      + 'candidates per epoch → 34/120 seeds flagged, pooled z −23.555, detected). FAIL probed: R69, R70, and the '
      + 'SD itself — the artifact\'s sdPerRound put back to 1.15, the exact-rtp.json SD edited, the split cross '
      + 'term dropped from the solver (R75, R76, R77)',
  }] },
  20: { claims: [{
    id: 'BLACKJACK-19', coverage: 'full',
    note: 'RTP under both conventions from the exact solve with the average wager (99.512325 % per '
      + 'initial bet, 99.567565 % per total wagered, 1.127741); both side-bet edges by exact enumeration '
      + 'over the 416-card shoe (9/415 and 4596/124085, weights checked against C(416,2) and C(416,3)); '
      + 'every operator edge figure reconciled — the config label 1% (LIQD\'s game-settings response, E23; bound to the dataset\'s '
      + 'meta.houseEdge) against the modelled 0.4877 %, the storefront "Edge: 0.48%" within one display '
      + 'unit of the per-initial-bet edge (the exact edge truncated to two decimals), and a sweep of the '
      + 'whole dataset for any other /edge|rtp/i field (none); a contradicting figure FLAGs with origin '
      + 'operator. The FX field is Step 21',
  }] },
  21: { claims: [{
    id: 'BLACKJACK-19', coverage: 'full',
    note: 'the FX-field half: exchangeRate 1.00 on 12,046 side-bet records, 0 main hands carry it, 0 '
      + 'non-zero fiat amounts, every crypto payout reconciled at face value; unidentifiable at rate 1.00 '
      + '(MANIFEST DL-8). The edge figures are Step 20',
  }] },
  22: { claims: [{
    id: 'BLACKJACK-12', coverage: 'full',
    note: '200/200 Phase E hands at $10 (100× the $0.10 base) recompute card for card under the same engine; '
      + 'the shoe derivation takes no wager argument; Phase E size and stake bound to PHASE_PLAN (Steps 24, 31)',
  }] },
  23: { claims: [{ id: 'BLACKJACK-14', coverage: 'full', note: B14 }] },
  24: { claims: [{
    id: 'BLACKJACK-05', coverage: 'full',
    note: 'the per-phase half: every phase\'s count equals src/config.ts PHASE_PLAN (A 3,300 · B 1,000 · C '
      + '500 · D 500 · E 200 · F 500), and the dataset\'s own phase table must agree with the plan on count '
      + 'AND stake — it is scored, not trusted; plan total bound to EXPECTED_HANDS',
  }] },
  25: { claims: [
    {
      id: 'BLACKJACK-26', coverage: 'full',
      note: 'the dataset SHA-256 guard aborts before any step (src/loader.ts) and is restated here; the RULE SET is '
        + 'single-sourced as src/config.ts RULES (11 rules) — the exact solver\'s LIQD_RULES, the round engine, the '
        + 'payout evaluator and Step 11\'s draw rule read it, the Python oracle reads anchor/rules.json, and Step 25 '
        + 'requires LIQD_RULES, anchor/rules.json and DECKS to equal it field for field; the side-bet paytables are '
        + 'single-sourced in src/config.ts, and the dataset\'s own config block (meta.payout — 3:2, 2:1, all eight '
        + 'paytable entries — and meta.decks) is scored against them: 11/11 agree. FAIL probed: anchor/rules.json '
        + 'S17 flipped, the solver\'s DAS restated as false (R71, R72)',
    },
    {
      id: 'BLACKJACK-27', coverage: 'full',
      note: 'ten artifacts pinned in src/config.ts, present and matching — since 2026-09-24 including '
        + 'outputs/deep-replay-report.json and outputs/bootstrap-replay-report.json, which no longer carry '
        + 'generatedAt/seconds; outputs/report-figures.json re-derived field for field; all un-ignored by name; '
        + 'every numeric leaf of the nine JSON artifacts of record (32,848 leaves) sits on a path with a declared '
        + 'value domain in src/domains.ts, bounds taken from src/config.ts, and inside it; no run-metadata key in '
        + 'any of them; verify and simulate write only outputs/run/; the chart is inline SVG with no script. FAIL '
        + 'probed: an impossible p-value re-pinned, a seconds field added to a replay report and re-pinned (R73, R74)',
    },
  ] },
  26: { claims: [{
    id: 'BLACKJACK-06', coverage: 'full',
    note: 'the Phase D half: 500/500 Phase D rounds recompute under the 10 player-set seeds actually '
      + 'used (≥ 2 distinct required), 490/500 deal a different first card under a baseline seed, and the '
      + 'predictable construction pfaudit-<stamp>-<epoch> is enumerated from the data — epochs 96–105, '
      + 'one stamp 1785954682036 — as MANIFEST DL-15. The wrong-seed sample and the generator clause are Step 7',
  }] },
  27: { claims: [{ id: 'BLACKJACK-15', coverage: 'full', note: B15 }] },
  28: { claims: [{ id: 'BLACKJACK-15', coverage: 'full', note: B15 }] },
  29: { claims: [{ id: 'BLACKJACK-14', coverage: 'full', note: B14 }] },
  30: { claims: [
    {
      id: 'BLACKJACK-17', coverage: 'full',
      note: 'the finite 8-deck shoe is confirmed from the data (1,269/6,000 rounds carry an exact duplicate '
        + 'card, never more than 3 copies — within the 8-copy bound). The hole-card, mid-round rotation and '
        + 'hidden-state items are declared, not probed: MANIFEST DL-9 (mid-round rotation never driven) and '
        + 'DL-10 (pre-settlement sweep not performed), each with its closing production item',
    },
    {
      id: 'BLACKJACK-22', coverage: 'full',
      note: 'scored, informational (policy INFORMATIONAL, decided 2026-09-29: a misfit is INFO — reported, never '
        + 'counted, verdict unchanged): the 6,000 captured first cards fit the uniform rank distribution (χ² 13.401, '
        + 'df 12 pinned, p = 0.3406, threshold 0.01) and the player- and dealer-natural frequencies fit the '
        + '8-deck probability 4.7451 % (253 and 283 of 6,000, z −1.93 and −0.10, threshold |z| ≤ 3); the '
        + 'live money path is reported as a reconciliation (informational block, report-figures.json '
        + 'moneyPath), never as RTP',
    },
  ] },
  31: { claims: [
    {
      id: 'BLACKJACK-05', coverage: 'full',
      note: 'the stakes half: every hand of every round is staked at its own phase\'s planned stake in '
        + 'src/config.ts PHASE_PLAN ($0.10, and $10 for Phase E) — 6,000/6,000',
    },
    { id: 'BLACKJACK-15', coverage: 'full', note: B15 },
  ] },
};

/**
 * Checks this casino's design makes inapplicable. Only ONE check earns this here.
 */
export const NOT_APPLICABLE: Array<{ id: string; reason: string }> = [
  {
    id: 'BLACKJACK-16',
    reason: 'applies={path: money.balanceField, notNull: true} is false — the capture has no balance field '
      + 'to reconcile against (0 occurrences of a balance or delta key in data/blackjack-6000hands.json), '
      + 'so the stake side of the money path is unobservable: MANIFEST DL-4. What IS verified is the credit '
      + 'side, exactly (Step 8), which the profile does not count as a balance ledger',
  },
];

/** Checks a package artifact answers rather than a scored step. */
export const PACKAGE_CHECKS: Array<{ id: string; artifact: string; coverage: Coverage | 'none'; note: string }> = [
  {
    id: 'BLACKJACK-09',
    artifact: 'docs/ALGORITHM.md + tests/blackjack/rngSpecTests.ts + tests/blackjack/rngTests.ts',
    coverage: 'partial',
    note: 'PARTIAL. REWRITTEN 2026-10-20: src/rng.ts is rebuilt from a written '
      + 'specification, docs/ALGORITHM.md (framework games/liqd-blackjack/ALGORITHM.md), by an implementer '
      + 'who never opened LIQD\'s code; it ports nothing, so it cites no operator line, and docs/ALGORITHM.md '
      + '§4 names the source of every step instead (LIQD\'s pages, the standard construction, or the 6,000 '
      + 'live rounds). Before 2026-10-20 src/rng.ts was an adapter matched to the RNG specification LIQD supplied '
      + 'privately and cited it generically. LIQD\'s code is not public, so no unit test here executes it: '
      + 'what IS here is tests/blackjack/rngSpecTests.ts (the spec\'s five worked rounds and properties), '
      + 'unit tests reproducing a real captured shoe and its PDPD deal from the revealed seed, and the '
      + 'operator\'s own validation vectors from its specification (the nonce-9 34-card shoe prefix and two '
      + 'draw vectors), run as a second check against src/rng.ts',
  },
  {
    id: 'BLACKJACK-23', artifact: 'MANIFEST.md#verification-results', coverage: 'full',
    note: 'the standardized matrix BJ-S5-01 … 18, each row Pass / Not closed / Not tested — disclosed and '
      + 'tied to a scored step or a limitation row (BJ-S5-05 cherry-picking Not closed, DL-1; BJ-S5-18 '
      + 'mid-round rotation Not tested, DL-9)',
  },
  {
    id: 'BLACKJACK-25',
    artifact: 'MANIFEST.md#verify-a-bet',
    coverage: 'full',
    note: 'MANIFEST "Verify a bet" carries the player path in the profile\'s order and in the dataset\'s field names: where '
      + 'the seed is revealed (rotation), which fields to take, the commitment encoding (SHA-256 of the '
      + 'serverSeed hex STRING as UTF-8), the draw and the backward Fisher-Yates, the PDPD deal and the '
      + 'split draw order; a node:crypto script performs it',
  },
  {
    id: 'BLACKJACK-28',
    artifact: 'package.json (npm test, test:full, engines 22.x) + .nvmrc + scripts/check-standalone.mjs + verify.js / test.js + src/diff.ts → outputs/run/diff.json + src/simulate.ts → outputs/run/simulation-diff.json',
    coverage: 'full',
    note: 'zero-install on a fresh clone: `npm test` is check-standalone && node test.js && node verify.js && release-manifest --check; '
      + 'verify writes only outputs/run/ with a field-level diff at 1e-14 + 1e-12·max (exit 1 beyond it); '
      + '`npm run test:full` regenerates the simulation from the pinned master seed into outputs/run/ and '
      + 'diffs it (simulation-diff.json, runtime recorded); FLAG exits 2 (capture-origin FLAGs are '
      + 'verdict-neutral); runtime pinned (engines 22.x, .nvmrc); audit ID PF-2026-LQ01 emitted in the '
      + 'record; check-standalone.mjs fails unless MANIFEST.md carries that ID and the unit-spec and '
      + 'scored-step counts quoted in MANIFEST.md/README.md equal the suite\'s own',
  },
  {
    id: 'BLACKJACK-29',
    artifact: 'tests/mutations.json + tests/mutate.ts',
    coverage: 'full',
    note: 'a step-named registry run in a disposable copy (node_modules symlinked, the working tree never '
      + 'touched), every entry naming the marker that must fire; since 2026-09-24 every scored step 1–31 has '
      + 'at least one mutation that kills it. Forged-evidence batteries included: relabelled result '
      + '(won→lost), shrunken dataset (R13, R16), hand-written simulation block (R17–R20), downgraded 3:2 '
      + '(R10, R36, R37), off-grid perturbation (R11), the 301 losing insurance records deleted (R80). No declared survivors',
  },
  {
    id: 'BLACKJACK-30',
    artifact: 'MANIFEST.md#limitations-and-trust (Declared limitations register DL-1–DL-19, Premises, Model anchors) + MANIFEST.md#evidence E01–E24',
    coverage: 'full',
    note: 'DL-1–DL-19 each carry a measured magnitude and what closes it; DL-15 enumerates the predictable Phase D '
      + 'epochs, DL-16 the circumstantial provenance of the A–C generator, DL-17 the capture\'s insurance request '
      + '(not the UI\'s decline; insurance booked on all 446 offers), DL-18 the capture\'s split-round play, DL-19 the profit cap and Face-Down Double, neither exercised; '
      + 'the premises table marks unwitnessed premises ASSUMED; '
      + 'MANIFEST Evidence numbers E01–E24 with an evidential role each',
  },
];

/** The block emitted alongside the step results. */
export function profileCoverageBlock(): Record<string, unknown> {
  return {
    game: PROFILE_GAME,
    profileVersion: PROFILE_VERSION,
    notApplicable: NOT_APPLICABLE,
    packageChecks: PACKAGE_CHECKS,
  };
}

/** The label fields for one scored step, to be merged into its emitted record. */
export function labelFor(step: number): Record<string, unknown> {
  const entry = STEP_CLAIMS[step];
  if (!entry) return { profileIds: [], profileChecks: [], profileNote: 'no mapping declared for this step' };
  return entry.claims.length
    ? { profileIds: entry.claims.map((c) => c.id), profileChecks: entry.claims }
    : { profileIds: [], profileChecks: [], profileNote: entry.reason ?? 'no reason given' };
}
