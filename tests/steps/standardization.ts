/**
 * Steps 22–31: Standardization-parity steps.
 *
 * Every property below is derivable from the committed capture with no new data —
 * each recomputes its own numbers from the raw dataset (or the shoe engine) rather
 * than trusting a summary field. They bring this audit's scored-step coverage to
 * parity with the published baseline blackjack report (which numbers these as discrete
 * steps) without padding: each asserts a distinct property and carries a coverage
 * assertion so a pass over an empty set cannot occur.
 *
 * SCOPE OF THAT LAST SENTENCE. It is true of the ten steps in THIS file, and must not be stated
 * of the whole scored suite: Step 21, `No FX haircut observed in this capture`
 * (tests/steps/houseedge.ts), once had no coverage assertion at all — both its conditions are
 * "expected 0", which an empty set satisfies for free — so with `exchangeRate` stripped from
 * all 12,046 side-bet records the step printed its full assurance paragraph over zero records,
 * 31/31 Full Pass. It carries one now.
 *
 *   22  Bet-Size Invariance          (baseline 9)   — outcome independent of wager
 *   23  Side-Bet Config Completeness  (baseline 11) — every paytable category exercised
 *   24  Phase Coverage & Labels       (baseline 13) — declared phases present, counts match
 *   25  Artifact Hash Integrity       (baseline 14) — all ten pinned artifacts, present + matching,
 *                                                    plus report-figures.json re-derived field for field
 *   26  Phase D Client-Seed Variation (baseline 15) — custom seeds used, recompute, change outcomes
 *   27  Split Rules Verification      (baseline 23) — value-based split, aces one card, no re-split
 *   28  Insurance Offer Condition     (baseline 25) — insurance records only on a dealer Ace upcard,
 *                                                    one per capture insurance request (no-ins)
 *   29  Side-Bet Deal-Time Invariance (baseline 27) — side-bet cards fixed at the deal, never mutate
 *   30  Deck-Model Confirmation       (baseline 29) — finite 8-deck shoe (duplicates, within 8 copies)
 *   31  Stake Bracket Bounds          (baseline 33) — observed stakes match the declared brackets
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { step } from './context';
import type { StepResult, VerifyContext } from './context';
import { initialTwo } from './hands';
import { blackjackShoe } from '../../src/rng';
import {
  rankOf, cardValueFromRank, DATASET_SHA256, DECKS,
  PERFECT_PAIRS, TWENTY_ONE_PLUS_THREE,
  SIMULATION_SHA256, SIMULATION_HTML_SHA256, EXACT_RTP_SHA256,
  ATTACK_SHA256, RNG_BRANCH_SHA256,
  SIMULATION_PROVENANCE_SHA256, BOOTSTRAP_NULLS_SHA256, BOOTSTRAP_NULL_FILE, DEEP_REPLAY_SHA256, BOOTSTRAP_REPLAY_SHA256,
  EXPECTED_HANDS, PHASE_PLAN, COVERAGE_FLOORS, RANKS, FIRST_CARD_DF, handValue,
  RULES, BLACKJACK_PAYS, ratioLabel,
} from '../../src/config';
import { LIQD_RULES } from '../../src/exact-play';
import { DOMAIN_TABLES, checkArtifactDomains, runMetadataPaths } from '../../src/domains';
import { chiSquaredTest, chiSquaredPValue } from '../../src/stats';
import { evaluatePerfectPairs, evaluate21Plus3 } from '../../src/sidebets';
import { insuranceEveryOfferExact, SHOE_DEAL4_ORDERED } from '../../src/sidebet-edges';
import { DATA_PATH } from '../../src/loader';
import { buildReportFiguresArtifact } from '../../src/report-figures';
import type { Bet } from '../../src/types';

/**
 * Field-for-field comparison of two JSON values, used by Step 25 to reconcile
 * `outputs/report-figures.json` against a fresh recomputation. Returns the differing paths, capped
 * so a wholesale forgery reports a readable sample instead of a wall of text.
 *
 * Order-INSENSITIVE across object keys — a re-serialisation is not a forgery. Order-SENSITIVE
 * inside arrays: a reordered population is a different population, and a forgery can attack
 * populations by emptying, duplicating and shrinking them.
 *
 * A non-finite value produced by OUR OWN recomputation is reported as its own defect rather than
 * compared. `NaN !== NaN`, so a corrupt engine would otherwise register as one ordinary mismatch
 * and read like a doctored file; it is the opposite fault — the verifier is broken. (Same class as
 * the framework's F7 probe, which planted a NaN in a reference formula and got a Full Pass.)
 */
function jsonDiffs(actual: unknown, expected: unknown, at = '', acc: string[] = [], cap = 8): string[] {
  if (acc.length >= cap) return acc;
  const label = at || '(root)';
  const kind = (v: unknown): string => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
  const ta = kind(actual);
  const te = kind(expected);
  if (ta !== te) { acc.push(`${label}: ${ta} where the recomputation gives ${te}`); return acc; }
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) {
      acc.push(`${label}: ${actual.length} element(s) where the recomputation gives ${expected.length}`);
      return acc;
    }
    for (let i = 0; i < actual.length && acc.length < cap; i++) jsonDiffs(actual[i], expected[i], `${label}[${i}]`, acc, cap);
    return acc;
  }
  if (ta === 'object') {
    const a = actual as Record<string, unknown>;
    const e = expected as Record<string, unknown>;
    const ka = Object.keys(a);
    const ke = Object.keys(e);
    const child = (k: string): string => (at ? `${at}.${k}` : k);
    for (const k of ke) if (!ka.includes(k) && acc.length < cap) acc.push(`${child(k)}: MISSING from the shipped file`);
    for (const k of ka) if (!ke.includes(k) && acc.length < cap) acc.push(`${child(k)}: present in the shipped file, not produced by the recomputation`);
    for (const k of ke) {
      if (acc.length >= cap) break;
      if (ka.includes(k)) jsonDiffs(a[k], e[k], child(k), acc, cap);
    }
    return acc;
  }
  if (te === 'number' && !Number.isFinite(expected as number)) {
    acc.push(`${label}: the recomputation itself produced ${String(expected)} — a non-finite figure from our own engine`);
    return acc;
  }
  if (actual !== expected) acc.push(`${label}: ${JSON.stringify(actual)} where the recomputation gives ${JSON.stringify(expected)}`);
  return acc;
}

// ── Deal-order helpers (mirror parity.ts — the pinned, order-strict reconstruction) ──
function dealtSequence(playerHand: string[], dealerHand: string[]): string[] {
  const seq: string[] = [];
  if (playerHand?.[0]) seq.push(playerHand[0]);
  if (dealerHand?.[0]) seq.push(dealerHand[0]);
  if (playerHand?.[1]) seq.push(playerHand[1]);
  if (dealerHand?.[1]) seq.push(dealerHand[1]);
  for (let i = 2; i < (playerHand?.length || 0); i++) seq.push(playerHand[i]);
  for (let i = 2; i < (dealerHand?.length || 0); i++) seq.push(dealerHand[i]);
  return seq;
}
function splitDealtSequence(main: string[], split: string[], dealer: string[]): string[] {
  return [main[0], dealer[0], split[0], dealer[1], main[1], split[1],
    ...split.slice(2), ...main.slice(2), ...dealer.slice(2)].filter((c) => c !== undefined);
}

/** Recompute a hand's full dealt order from its revealed seed and confirm card-for-card. */
function recomputes(b: Bet, serverSeed: string): boolean {
  const shoe = blackjackShoe(serverSeed, b.clientSeed as string, b.nonce);
  if (b.split) {
    const main = b.playerHands[0]?.cards || [];
    const spl = b.playerHands[1]?.cards || [];
    const d = b.dealerHand || [];
    const seq = splitDealtSequence(main, spl, d);
    return seq.length === main.length + spl.length + d.length && seq.every((c, i) => c === shoe[i]);
  }
  const seq = dealtSequence(b.playerHands[0]?.cards || [], b.dealerHand || []);
  return seq.length >= 4 && seq.every((c, i) => c === shoe[i]);
}

// `initialTwo` now lives in ./hands so Steps 15/16 use the same split-aware definition
// instead of their own `playerHands[0].cards` fallback (which is the wrong pair of cards on
// 392 of the 401 split rounds).

export function run(ctx: VerifyContext): StepResult[] {
  const { bets, seedMap, meta } = ctx;
  const out: StepResult[] = [];

  // ── Step 22: Bet-Size Invariance ────────────────────────────────────────────
  // The shoe derivation blackjackShoe(serverSeed, clientSeed, nonce) takes no wager
  // parameter, so the outcome cannot depend on stake. Proven empirically at the
  // isolated $10 stake: Phase E is 200 hands at $10 (no side bets), recomputed here
  // card-for-card, alongside the $0.10 hands scored in Step 6 — same engine, both
  // stakes, identical determinism. Deterministic proof; no distributional test at n=200.
  {
    const e = ctx.phaseE;
    let chk = 0, bad = 0;
    for (const b of e) {
      const ss = seedMap.get(b.hashedServerSeed);
      if (!ss || !b.clientSeed) continue;
      chk++;
      if (!recomputes(b, ss)) bad++;
    }
    const stakes = [...new Set(bets.map((b) => Number(b.playerHands[0]?.betAmount)))].sort((a, z) => a - z);
    const ok = chk === e.length && chk > 0 && bad === 0;
    out.push(step(22, 'Bet-Size Invariance', ok ? 'PASS' : 'FAIL',
      `${chk}/${e.length} Phase E hands at $10.00 recompute card-for-card from the revealed seed — ${bad} mismatch. ` +
      `The shoe derivation takes no wager argument (serverSeed, clientSeed, nonce only); outcomes at $10.00 are produced by the identical engine as the $0.10 hands (stakes present: ${stakes.map((s) => `$${s}`).join(', ')}), so the deal cannot depend on bet size` +
      (chk === 0 ? '; COVERAGE FAIL: 0 Phase E hands recomputed' : '')));
  }

  // ── Step 23: Side-Bet Config Completeness ───────────────────────────────────
  // Every category in each paytable is actually exercised by the capture, re-derived
  // from the cards (not read from the operator's gameResult field).
  {
    const ppSeen = new Set<string>();
    const t3Seen = new Set<string>();
    let ppChk = 0, t3Chk = 0;
    for (const b of bets) {
      const init = initialTwo(b);
      if (b.sideBets.perfectPair && init.length === 2) {
        ppChk++;
        const cat = evaluatePerfectPairs(init[0], init[1]).category;
        if (cat !== 'NO_PAIR') ppSeen.add(cat);
      }
      const up = (b.dealerHand || [])[0];
      if (b.sideBets.twentyOnePlusThree && init.length === 2 && up) {
        t3Chk++;
        const cat = evaluate21Plus3(init[0], init[1], up).category;
        if (cat !== 'NO_MATCH') t3Seen.add(cat);
      }
    }
    const ppExpected = Object.keys(PERFECT_PAIRS);
    const t3Expected = Object.keys(TWENTY_ONE_PLUS_THREE);
    const ppComplete = ppExpected.every((c) => ppSeen.has(c));
    const t3Complete = t3Expected.every((c) => t3Seen.has(c));
    const ok = ppChk > 0 && t3Chk > 0 && ppComplete && t3Complete;
    out.push(step(23, 'Side-Bet Config Completeness', ok ? 'PASS' : 'FLAG',
      `Perfect Pairs: ${ppSeen.size}/${ppExpected.length} paytable categories observed across ${ppChk} bets [${[...ppSeen].join(', ')}]; ` +
      `21+3: ${t3Seen.size}/${t3Expected.length} observed across ${t3Chk} bets [${[...t3Seen].join(', ')}]` +
      (ppChk === 0 || t3Chk === 0 ? '; COVERAGE FAIL: a side bet has no records' : '')));
  }

  // ── Step 24: Phase Coverage & Labels ────────────────────────────────────────
  // Every phase the capture plan declares is present, and its bet count matches the
  // declared size — the phase labels are not decorative.
  //
  // The phase table alone is self-referential: `meta.phases` lives in the file being scored,
  // so deleting 50 rounds and decrementing `meta.phases.F.hands` by 50 satisfied every
  // comparison here. The declared table must therefore also SUM to EXPECTED_HANDS, which is
  // in src/config.ts and does not move when the data does. This is the second half of the
  // defence against epoch deletion; the first half is Steps 1/3/5/6.
  {
    const declared = (meta.phases || {}) as Record<string, { hands?: unknown; amount?: unknown }>;
    const observed: Record<string, number> = {};
    for (const b of bets) observed[b.phase] = (observed[b.phase] || 0) + 1;
    const rows: string[] = [];
    let bad = 0;
    let planTotal = 0;
    for (const [ph, plan] of Object.entries(PHASE_PLAN)) {
      planTotal += plan.hands;
      const got = observed[ph] || 0;
      const d = declared[ph];
      // Three sources must agree: the plan in src/config.ts, the dataset's own phase table, and the
      // rounds actually labelled with the phase.
      const headerOk = !!d && Number(d.hands) === plan.hands && Number(d.amount) === plan.stake;
      if (got !== plan.hands || !headerOk) bad++;
      rows.push(`${ph}:${got}/${plan.hands}${headerOk ? '' : ` (dataset table says ${d ? `${String(d.hands)} @ $${String(d.amount)}` : 'nothing'})`}`);
    }
    const observedTotal = Object.values(observed).reduce((n, v) => n + v, 0);
    const undeclared = [...new Set([...Object.keys(observed), ...Object.keys(declared)])].filter((p) => !(p in PHASE_PLAN));
    const totalsOk = planTotal === EXPECTED_HANDS && observedTotal === EXPECTED_HANDS;
    const ok = rows.length > 0 && bad === 0 && undeclared.length === 0 && totalsOk;
    out.push(step(24, 'Phase Coverage & Labels', ok ? 'PASS' : 'FAIL',
      `${Object.keys(PHASE_PLAN).length} phases in the capture plan (src/config.ts PHASE_PLAN), each present with the planned count and the dataset's own phase table agreeing on count and stake (${rows.join(', ')}); ` +
      `plan total ${planTotal} and observed total ${observedTotal} both equal EXPECTED_HANDS ${EXPECTED_HANDS}` +
      (bad ? `; ${bad} phase(s) disagree` : '') +
      (undeclared.length ? `; phase(s) not in the plan: ${undeclared.join(', ')}` : '') +
      (totalsOk ? '' : `; POPULATION FAIL: plan ${planTotal}, observed ${observedTotal}, declared ${EXPECTED_HANDS}`) +
      (rows.length === 0 ? '; COVERAGE FAIL: no planned phases' : '')));
  }

  // ── Step 25: Artifact Hash Integrity ────────────────────────────────────────
  // Was "Dataset Hash Integrity" and covered ONE of the pinned artifacts. Two changes,
  // for two different defects.
  //
  // (1) PRESENCE. `tests/verify.ts` guarded the three output artifacts inside
  //     `if (fs.existsSync(...))`, so DELETING outputs/exact-rtp.json and
  //     outputs/rtp-convergence.html produced 31/31 · PROVABLY FAIR — Full Pass · exit 0.
  //     An artifact that is pinned is load-bearing by definition: its absence is a FAIL, not
  //     a silent skip. (simulation-results.json was hardened for exactly this — missing →
  //     Steps 17-19 FLAG — and its two siblings were not: same class, three artifacts, one
  //     of them covered.)
  //
  // (2) SCORED, NOT FAIL-FAST. Calling `process.exit(1)` on a pin mismatch before any step
  //     printed is a real guard, but it makes an artifact forgery indistinguishable from a
  //     crash to anything reading the run: an artifact-substitution probe then scores NOT RUN
  //     rather than CAUGHT, because a run that dies before a scored step never emits a verdict.
  //     The pins are reconciled INSIDE this scored step, so a substituted or deleted artifact
  //     produces `[FAIL] Step 25` and a NOT PROVABLY FAIR verdict that a gate, a CI job or a
  //     reader can actually see.
  //
  // (3) RE-DERIVED, NOT PINNED: outputs/report-figures.json. It sources the report's prose
  //     figures. Bound to nothing, its populations could be emptied, its rows duplicated or
  //     shrunk with the header made consistent, every rtp/edge field set to 0.5 or the file
  //     deleted outright, and each of those runs would return
  //     31/31 · PROVABLY FAIR — Full Pass. That is the same class as (1) and (2), one level
  //     further out: a new emission is created to give figures a producing artifact, and no
  //     scored step re-derives it.
  //
  //     A HASH PIN WOULD BE THE WRONG INSTRUMENT here, which is why this file is handled below
  //     instead of joining the ten pinned artifacts listed below. The file is rewritten by every `npm run verify` (at the
  //     end of tests/verify.ts, after the steps have run), so a pin would either be enforced
  //     against a file the same command is about to replace, or would have to be re-pinned on
  //     every run — a pin the auditor updates on every run proves nothing. The stronger check is
  //     available and cheap: RECOMPUTE the figures from the pinned dataset and the exact engines
  //     through `buildReportFiguresArtifact()` — the same builder verify.ts writes with — and
  //     compare the result field for field against the copy on disk.
  //
  //     WHY ABSENCE MUST FAIL. Checked, not assumed, in three places:
  //     `.gitignore` un-ignores it explicitly (`!outputs/report-figures.json`),
  //     MANIFEST.md#evidence carries it as evidence item **E21**, and the report cites it by name as the
  //     trace for published figures (MANIFEST.md#evidence, MANIFEST.md#reproduce-the-audit). It is an artifact
  //     of record, not a run product, so its absence means the shipped copy of the report's derived
  //     figures is gone and nobody can check the published numbers against the file that produced
  //     them. Regenerating it silently — which is what an unguarded run does — would prove only
  //     that the figures are a deterministic function of the pinned dataset, which a repo with a
  //     genuine missing-artifact defect satisfies just as well. CONSEQUENCE, stated so it is not a
  //     surprise: outputs/report-figures.json MUST be committed; a clone that does not carry it
  //     fails Step 25 on its first run, by design.
  //
  //     WHAT THIS DOES NOT PROVE, stated plainly. Recomputing an artifact inside the same process
  //     that would otherwise write it establishes that the published figures are a deterministic
  //     function of the pinned dataset and the committed engines — real, and enough to reject every
  //     forgery above. It does NOT establish that the shipped file was independently produced: an
  //     auditor who changes the builder and re-runs gets agreement again. That is what the external
  //     anchors are for (the Wizard of Odds 8-deck comparison in tests/blackjack/wooAnchorTests.ts
  //     and the exact-RTP artifact's own field-by-field re-derivation), not this step.
  //
  // The dataset pin keeps its fail-fast guard in src/loader.ts as well — scoring the wrong
  // data at all is not something to do and then report on — so for the dataset this step is
  // a second, visible statement of a check that already ran.
  {
    const sha256 = (p: string): string => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    const rows: string[] = [];
    const problems: string[] = [];
    const pinned: { name: string; file: string; pin: string }[] = [
      { name: 'data/blackjack-6000hands.json', file: DATA_PATH, pin: DATASET_SHA256 },
      { name: 'outputs/simulation-results.json', file: path.join(ctx.outputsDir, 'simulation-results.json'), pin: SIMULATION_SHA256 },
      { name: 'outputs/rtp-convergence.html', file: path.join(ctx.outputsDir, 'rtp-convergence.html'), pin: SIMULATION_HTML_SHA256 },
      { name: 'outputs/exact-rtp.json', file: path.join(ctx.outputsDir, 'exact-rtp.json'), pin: EXACT_RTP_SHA256 },
      { name: 'outputs/cherry-pick-attack.json', file: path.join(ctx.outputsDir, 'cherry-pick-attack.json'), pin: ATTACK_SHA256 },
      { name: 'outputs/rng-branch-coverage.json', file: path.join(ctx.outputsDir, 'rng-branch-coverage.json'), pin: RNG_BRANCH_SHA256 },
      // The two RETAINED-INPUT artifacts that make the simulation's random inputs replayable.
      // They are outputs of the same `npm run simulate` as the two
      // above them; their PRESENCE and hash are required unconditionally, because a release that claims replayable inputs and ships no record of
      // them, or no retained statistics, has simply restated the defect in a nicer voice.
      { name: 'outputs/simulation-provenance.json', file: path.join(ctx.outputsDir, 'simulation-provenance.json'), pin: SIMULATION_PROVENANCE_SHA256 },
      { name: `outputs/${BOOTSTRAP_NULL_FILE}`, file: path.join(ctx.outputsDir, BOOTSTRAP_NULL_FILE), pin: BOOTSTRAP_NULLS_SHA256 },
      // The two replay reports the chapters quote (E03c / E03d), pinned since 2026-09-24 (BLACKJACK-27).
      { name: 'outputs/deep-replay-report.json', file: path.join(ctx.outputsDir, 'deep-replay-report.json'), pin: DEEP_REPLAY_SHA256 },
      { name: 'outputs/bootstrap-replay-report.json', file: path.join(ctx.outputsDir, 'bootstrap-replay-report.json'), pin: BOOTSTRAP_REPLAY_SHA256 },
    ];
    for (const a of pinned) {
      if (!fs.existsSync(a.file)) {
        problems.push(`${a.name} is MISSING — a pinned artifact is load-bearing; its absence cannot score as a pass`);
        rows.push(`${a.name}: ABSENT`);
        continue;
      }
      const actual = sha256(a.file);
      if (actual === a.pin) { rows.push(`${a.name}: ${actual.slice(0, 12)}… matches`); continue; }
      const label = a.name === 'outputs/exact-rtp.json' ? 'Exact-RTP artifact hash mismatch' : `${a.name} hash mismatch`;
      problems.push(`${label} — expected ${a.pin}, got ${actual}`);
      rows.push(`${a.name}: ${actual.slice(0, 12)}… ≠ pinned ${a.pin.slice(0, 12)}…`);
    }
    // ── VALUE DOMAINS and RUN METADATA (BLACKJACK-27) ─────────────────────────
    // Every numeric leaf of every JSON artifact of record must have a DECLARED domain in
    // src/domains.ts and lie inside it, and none may carry a run-metadata key. A pin proves the file
    // is the committed one; a domain proves the committed one could be true. The verification record
    // is read as committed (this run's own record is written to outputs/run/, never here).
    let domainLeaves = 0, domainFiles = 0;
    for (const rel of Object.keys(DOMAIN_TABLES)) {
      const abs = path.join(ctx.outputsDir, '..', rel);
      if (!fs.existsSync(abs)) { problems.push(`${rel} is MISSING — it has a declared domain table, so it is an artifact of record`); continue; }
      let parsed: unknown;
      try { parsed = JSON.parse(fs.readFileSync(abs, 'utf8')); } catch { problems.push(`${rel} does not parse as JSON`); continue; }
      const dc = checkArtifactDomains(rel, parsed);
      domainLeaves += dc.checked; domainFiles++;
      if (dc.undeclared.length) problems.push(`${rel}: numeric leaf path(s) with NO declared domain — ${dc.undeclared.slice(0, 4).join(', ')}`);
      if (dc.violations.length) problems.push(`${rel}: value(s) OUTSIDE their declared domain — ${dc.violations.slice(0, 4).join('; ')}`);
      const meta = runMetadataPaths(parsed);
      if (meta.length) problems.push(`${rel} carries run metadata — ${meta.slice(0, 4).join(', ')}`);
    }
    rows.push(`value domains: ${domainLeaves.toLocaleString()} numeric leaves in ${domainFiles} JSON artifacts of record, each on a declared path (src/domains.ts) and inside its domain; no run-metadata key in any of them`);

    // ── outputs/report-figures.json — re-derived, field for field ─────────────
    // Four outcomes, deliberately distinct:
    //   • the file is ABSENT                      → FAIL (see the note above);
    //   • the recomputation THROWS                → FAIL — the artifact of record cannot be
    //     re-derived at all, so nothing certifies the published figures. `units()` throws on an
    //     amount off the 1e-8 settlement grid and the natural-blackjack branch throws on a credit
    //     that is neither 2.5x nor 1x, so this arm fires on a doctored dataset as well;
    //   • any field DISAGREES with the recomputation → FAIL, with the differing paths named;
    //   • agreement, header included               → PASS.
    //
    // The provenance label `datasetSha256` is compared with everything else rather than being
    // treated as a licence to skip the comparison. Reading it first and calling a mismatch "stale,
    // regenerated by this run" is a bypass: set it to anything and the body is never checked. If
    // this repo is ever re-captured, the first `npm run verify` after the re-pin FAILs this arm and
    // writes the new file, and the second passes — the same one-run lag the absence rule carries.
    const rfPath = path.join(ctx.outputsDir, 'report-figures.json');
    let rfRow: string;
    if (!fs.existsSync(rfPath)) {
      problems.push('outputs/report-figures.json is MISSING — the artifact of record for the report\'s '
        + 'derived figures (evidence E21) is absent, so the published numbers cannot be checked against '
        + 'the file that produced them; regenerating it here would show only that they are a '
        + 'deterministic function of the pinned dataset');
      rfRow = 'outputs/report-figures.json: ABSENT';
    } else {
      let stored: unknown;
      let parseErr = '';
      try { stored = JSON.parse(fs.readFileSync(rfPath, 'utf8')); } catch (err) {
        parseErr = err instanceof Error ? err.message : String(err);
      }
      let fresh: unknown;
      let freshErr = '';
      try {
        fresh = buildReportFiguresArtifact({ meta: ctx.meta, seeds: ctx.seeds, bets: ctx.bets });
      } catch (err) {
        freshErr = err instanceof Error ? err.message : String(err);
      }
      if (parseErr) {
        problems.push(`outputs/report-figures.json does not parse as JSON (${parseErr})`);
        rfRow = 'outputs/report-figures.json: UNPARSEABLE';
      } else if (freshErr) {
        problems.push(`outputs/report-figures.json could NOT be re-derived — the recomputation threw: ${freshErr}`);
        rfRow = 'outputs/report-figures.json: RECOMPUTATION FAILED';
      } else {
        const diffs = jsonDiffs(stored, JSON.parse(JSON.stringify(fresh)));
        const fields = Object.keys(fresh as Record<string, unknown>).length;
        if (diffs.length === 0) {
          rfRow = `outputs/report-figures.json: re-derived from the pinned dataset and reconciles field for field (${fields} top-level fields, incl. ${(stored as { workedExamples?: unknown[] }).workedExamples?.length ?? 0} worked examples)`;
        } else {
          problems.push(`outputs/report-figures.json DISAGREES with a fresh recomputation from the pinned dataset — ${diffs.join(' | ')}`);
          rfRow = `outputs/report-figures.json: ${diffs.length} field(s) differ from the recomputation`;
        }
      }
    }
    rows.push(rfRow);

    // ── The dataset's own config block (meta.payout) scored against the single source ──
    // The paytables are single-sourced in src/config.ts; meta.payout is the capture script's own copy of
    // the payout configuration, typed into the script and written into the dataset header (it is not a
    // field LIQD returned). Every figure in it must be the figure the steps apply.
    const pay = ((meta as { payout?: Record<string, unknown> }).payout ?? null) as {
      blackjack?: unknown; insurance?: unknown;
      perfectPairs?: Record<string, unknown>; twentyOnePlusThree?: Record<string, unknown>;
    } | null;
    const payRows: string[] = [];
    const payCheck = (label: string, got: unknown, want: unknown): void => { if (got !== want) payRows.push(`${label}=${JSON.stringify(got)} (src/config.ts ${JSON.stringify(want)})`); };
    if (!pay) payRows.push('meta.payout ABSENT');
    else {
      payCheck('blackjack', pay.blackjack, ratioLabel(RULES.blackjackPays));
      payCheck('insurance', pay.insurance, ratioLabel(RULES.insurancePays));
      payCheck('perfectPairs.perfect', pay.perfectPairs?.perfect, PERFECT_PAIRS.PERFECT_PAIR);
      payCheck('perfectPairs.colored', pay.perfectPairs?.colored, PERFECT_PAIRS.COLORED_PAIR);
      payCheck('perfectPairs.mixed', pay.perfectPairs?.mixed, PERFECT_PAIRS.MIXED_PAIR);
      payCheck('21+3.suitedTrips', pay.twentyOnePlusThree?.suitedTrips, TWENTY_ONE_PLUS_THREE.SUITED_THREE_OF_A_KIND);
      payCheck('21+3.straightFlush', pay.twentyOnePlusThree?.straightFlush, TWENTY_ONE_PLUS_THREE.STRAIGHT_FLUSH);
      payCheck('21+3.threeOfAKind', pay.twentyOnePlusThree?.threeOfAKind, TWENTY_ONE_PLUS_THREE.THREE_OF_A_KIND);
      payCheck('21+3.straight', pay.twentyOnePlusThree?.straight, TWENTY_ONE_PLUS_THREE.STRAIGHT);
      payCheck('21+3.flush', pay.twentyOnePlusThree?.flush, TWENTY_ONE_PLUS_THREE.FLUSH);
      payCheck('decks', (meta as { decks?: unknown }).decks, RULES.decks);
    }
    if (payRows.length) problems.push(`the dataset's recorded payout configuration disagrees with src/config.ts — ${payRows.join(', ')}`);
    rows.push(`dataset config block meta.payout + meta.decks: ${payRows.length ? `${payRows.length} disagreement(s)` : 'all 11 figures (3:2, 2:1, the three Perfect Pairs and five 21+3 paytable entries, 8 decks) equal src/config.ts'}`);

    // ── THE RULE SET, single-sourced (BLACKJACK-26) ─────────────────────────────
    // src/config.ts RULES is the one declaration. Its consumers either import it (the exact solver's
    // LIQD_RULES, the round engine, the payout evaluator, Step 11's draw rule) or — for the Python
    // oracle, which cannot import TypeScript — read anchor/rules.json, which must equal it field for
    // field. A consumer that restates a rule is a second rule set; these three checks make one visible.
    const ruleRows: string[] = [];
    const anchorRulesPath = path.join(ctx.outputsDir, '..', 'anchor', 'rules.json');
    if (!fs.existsSync(anchorRulesPath)) ruleRows.push('anchor/rules.json ABSENT');
    else {
      let anchorRules: unknown = null;
      try { anchorRules = JSON.parse(fs.readFileSync(anchorRulesPath, 'utf8')); } catch { ruleRows.push('anchor/rules.json unparseable'); }
      if (anchorRules !== null) {
        const diffs = jsonDiffs(anchorRules, JSON.parse(JSON.stringify(RULES)));
        if (diffs.length) ruleRows.push(`anchor/rules.json differs from src/config.ts RULES at ${diffs.slice(0, 4).join(', ')}`);
      }
    }
    const solverView: Record<string, unknown> = {
      s17: RULES.s17, das: RULES.das, peek: RULES.peek, blackjackPays: BLACKJACK_PAYS,
      splitAcesOneCard: RULES.splitAcesOneCard, doubleAnyTwo: RULES.doubleAnyTwo,
    };
    for (const [k, v] of Object.entries(solverView)) {
      if ((LIQD_RULES as unknown as Record<string, unknown>)[k] !== v) ruleRows.push(`src/exact-play.ts LIQD_RULES.${k}=${JSON.stringify((LIQD_RULES as unknown as Record<string, unknown>)[k])} ≠ RULES ${JSON.stringify(v)}`);
    }
    if (DECKS !== RULES.decks) ruleRows.push(`src/config.ts DECKS=${DECKS} ≠ RULES.decks=${RULES.decks}`);
    if (ruleRows.length) problems.push(`the rule set is not single-sourced — ${ruleRows.join('; ')}`);
    rows.push(`rule set single-sourced in src/config.ts RULES (${Object.keys(RULES).length} rules): ${ruleRows.length ? `${ruleRows.length} disagreement(s)` : 'the exact solver\'s LIQD_RULES, anchor/rules.json (the Python oracle\'s copy) and DECKS equal it; the round engine, the payout evaluator and Step 11 import it'}`);

    out.push(step(25, 'Artifact Hash Integrity', problems.length === 0 ? 'PASS' : 'FAIL',
      `${pinned.length} pinned artifacts, present and matching their SHA-256 pins in src/config.ts, ` +
      `plus outputs/report-figures.json RE-DERIVED field for field (it is rewritten by every run, so a hash pin ` +
      `would be enforced against a file the same command replaces; recomputation proves the published figures are a ` +
      `deterministic function of the pinned dataset and the committed engines — NOT that the shipped file was ` +
      `independently produced, which is what the Wizard of Odds anchor is for) — ${rows.join('; ')}` +
      (problems.length ? `; INTEGRITY FAIL: ${problems.join(' | ')}` : '')));
  }

  // ── Step 26: Phase D Client-Seed Variation ──────────────────────────────────
  // Phase D uses auditor-chosen client seeds. Assert they are genuinely custom (>1
  // distinct), that every Phase D hand still recomputes, and that the auditor seed
  // changes the deal (a canonical baseline seed yields a different first card).
  {
    const d = ctx.phaseD;
    const seeds = new Set<string>();
    let chk = 0, bad = 0, changed = 0;
    for (const b of d) {
      const ss = seedMap.get(b.hashedServerSeed);
      if (!ss || !b.clientSeed) continue;
      chk++;
      seeds.add(b.clientSeed);
      if (!recomputes(b, ss)) bad++;
      const base = blackjackShoe(ss, 'baseline-default-seed', b.nonce);
      if (base[0] !== (b.playerHands[0]?.cards || [])[0]) changed++;
    }
    // PREDICTABLE PHASE D SEEDS, enumerated from the data (MANIFEST DL-15). The auditor's Phase D
    // client seeds were built as pfaudit-<13-digit millisecond stamp>-<epoch>, which a CSPRNG seed
    // would not be. Every such seed is listed by epoch here, so the exposure is a measured list, not
    // a sentence.
    const predictable = new Map<number, string>();
    for (const sd of ctx.seeds.filter((x) => x.phase === 'D')) {
      const m = /^pfaudit-(\d{13})-(\d+)$/.exec(sd.clientSeed);
      if (m && Number(m[2]) === sd.epoch) predictable.set(sd.epoch, m[1]);
    }
    const stamps = [...new Set(predictable.values())];
    const epochsD = [...predictable.keys()].sort((a, z) => a - z);
    const ok = chk === d.length && chk > 0 && bad === 0 && seeds.size >= 2;
    out.push(step(26, 'Phase D Client-Seed Variation', ok ? 'PASS' : 'FLAG',
      `${chk}/${d.length} Phase D hands recompute under ${seeds.size} distinct auditor client seeds — ${bad} mismatch; ` +
      `${changed}/${chk} deal a different first card under a canonical baseline seed (client seed genuinely feeds the derivation). ` +
      `DISCLOSED — predictable Phase D seeds: ${predictable.size} of the ${ctx.seeds.filter((x) => x.phase === 'D').length} Phase D epochs use pfaudit-<stamp>-<epoch> — epochs ${epochsD.length ? `${epochsD[0]}–${epochsD[epochsD.length - 1]}` : 'none'} (${epochsD.join(', ')}), ${chk} rounds, stamp(s) ${stamps.map((t) => `${t} (${new Date(Number(t)).toISOString()})`).join(', ') || 'none'}; for those epochs the rounds rest on the recomputation, not on the client-seed-after-commitment mitigation (MANIFEST DL-15)` +
      (chk === 0 ? '; COVERAGE FAIL: 0 Phase D hands' : seeds.size < 2 ? '; FLAG: fewer than two distinct client seeds' : '')));
  }

  // ── Step 27: Split Rules Verification ───────────────────────────────────────
  // Value-based split (the two split cards share a blackjack value), split aces draw
  // exactly one card each, and no re-split (never more than two player hands).
  {
    const sp = bets.filter((b) => b.split);
    let valBad = 0, aceSplits = 0, aceBad = 0, resplit = 0;
    for (const b of sp) {
      const a = b.playerHands[0]?.cards[0];
      const c = b.playerHands[1]?.cards[0];
      if (a && c && cardValueFromRank(rankOf(a)) !== cardValueFromRank(rankOf(c))) valBad++;
      if (a && rankOf(a) === 1) {
        aceSplits++;
        if (b.playerHands[0]?.cards.length !== 2 || b.playerHands[1]?.cards.length !== 2) aceBad++;
      }
      if (b.playerHands.length > 2) resplit++;
    }
    const ruleOk = sp.length > 0 && valBad === 0 && aceBad === 0 && resplit === 0;
    // COVERAGE FLOORS (BLACKJACK-15), asserted as floors — a shortfall is a FLAG with a limitation
    // row, never a silent pass — and the rule table: every declared rule OBSERVED with its witness
    // count, or ASSUMED where the capture never attempted the action.
    const tok = (b: Bet, t: string): number => (b.actions || []).filter((a) => a === t).length;
    const das = sp.filter((b) => tok(b, 'double') > 0).length;
    const doubles = bets.reduce((n, b) => n + tok(b, 'double'), 0);
    const fundedInsAce = bets.filter((b) => b.sideBets.insurance && rankOf((b.dealerHand || [])[0] || 'X:0') === 1).length;
    const soft17Stands = bets.filter((b) => { const hv = handValue(b.dealerHand || []); return hv.soft && hv.total === 17; }).length;
    const dealerNaturals = bets.filter((b) => (b.dealerHand || []).length === 2 && handValue(b.dealerHand).total === 21).length;
    const surrenders = bets.filter((b) => (b.actions || []).some((a) => /surrender/i.test(a))).length;
    const doubleTotals = new Set<number>();
    for (const b of bets) {
      if (b.split || tok(b, 'double') === 0) continue;
      doubleTotals.add(handValue((b.playerHands[0]?.cards || []).slice(0, 2)).total);
    }
    const dt = [...doubleTotals].sort((a, z) => a - z);
    const floors: Array<[string, number, number]> = [
      ['splits', sp.length, COVERAGE_FLOORS.splits],
      ['ace splits', aceSplits, COVERAGE_FLOORS.aceSplits],
      ['DAS', das, COVERAGE_FLOORS.das],
      ['doubles', doubles, COVERAGE_FLOORS.doubles],
      ['insurance records on a dealer Ace', fundedInsAce, COVERAGE_FLOORS.fundedInsuranceDealerAce],
    ];
    const short = floors.filter(([, got, floor]) => got < floor);
    const status = !ruleOk ? 'FAIL' : short.length ? 'FLAG' : 'PASS';
    // DETAIL-STRING WORDING (S-DETAIL). `outputs/verification-results.json` is published prose:
    // it ships to the client and gets quoted back. This string used to end "(re-split is off)",
    // the one assertive phrasing of a rule that EVERY chapter marks ASSUMED — no third hand ever
    // appears in the capture, which shows re-split was never TAKEN, not that it was unavailable.
    out.push(step(27, 'Split Rules Verification', status,
      `${sp.length} split rounds: ${valBad} value-mismatched pairs (value-based split rule), ` +
      `${aceSplits} ace splits — ${aceBad} that did not draw exactly one card each (splitAcesOneCard), ` +
      `${resplit} rounds with >2 player hands. No re-split was observed: the capture never requests a second split and records two hands at most, ` +
      `so "no re-split" is ASSUMED of the rule set rather than demonstrated. ` +
      `Coverage floors: ${floors.map(([n, got, floor]) => `${n} ${got} (floor ${floor})`).join(', ')} — ${short.length ? `SHORT: ${short.map(([n]) => n).join(', ')} — FLAG` : 'all met'}. ` +
      `Rule table — OBSERVED: S17 (${soft17Stands} dealer hands stood on soft 17; draw rule replayed both ways in Step 11), DAS (${das} rounds), dealer peek (${dealerNaturals} dealer naturals settled before player action, Step 13), split pairing by value (${sp.length} splits, ${valBad} off-value), split aces one card (${aceSplits}), double on any two (initial totals ${dt.length ? `${dt[0]}–${dt[dt.length - 1]}` : 'none'} observed), insurance 2:1 on a dealer Ace (${fundedInsAce} insurance records, Steps 10 and 28), 8-deck shoe (Step 30), naturals 3:2 (Step 9); ` +
      `ASSUMED (never attempted by the capture): re-split (0 third hands in ${sp.length} splits; the capture never requests a second split), surrender (${surrenders} surrender tokens; the capture script has no surrender call) — MANIFEST DL-5 — and insurance can be declined (the capture never sent LIQD's decline request, {acceptInsurance: false}; the casino booked insurance on every offer it did send — MANIFEST DL-17). ` +
      `Uncaptured, voided or aborted games are counted as nonce gaps by Step 4 against the declared 0` +
      (sp.length === 0 ? '; COVERAGE FAIL: no split rounds' : '')));
  }

  // ── Step 28: Insurance Offer Condition ──────────────────────────────────────
  // Every insurance record sits on a dealer Ace upcard — insurance is never offered otherwise.
  //
  // THE CAPTURE'S INSURANCE REQUEST (MANIFEST DL-17, origin: capture). On every offer the capture
  // sent place-insurance-bet {betAmount: 0} and logged `no-ins`, meaning to decline; LIQD's own UI
  // declines with {acceptInsurance: false} (evidence E24), a request the capture never sent. The
  // casino booked and settled a half-stake insurance bet on every request the capture did send.
  // That count is printed here, with the exact cost of insurance on every offer, because the
  // headline RTP assumes insurance is declined and the capture's rounds did not decline it.
  //
  // The same count is this step's COVERAGE denominator: every `no-ins` round must carry an insurance
  // record, and every record must sit on a `no-ins` round. `no-ins` is the capture script's own
  // per-round record of the request it sent, independent of the records the casino returned, so a
  // dropped or added record contradicts it instead of shrinking the set with itself (the role
  // `sideFunded` plays for Steps 15, 16 and 29). Without it, deleting the 301 losing insurance
  // records, re-pinning the dataset and regenerating the figures file scored 31/31 Full Pass on
  // code without this check; mutation R80 keeps that edit executed.
  {
    const ins = bets.filter((b) => b.sideBets.insurance);
    let offAce = 0;
    for (const b of ins) if (rankOf((b.dealerHand || [])[0] || 'X:0') !== 1) offAce++;
    const noIns = bets.filter((b) => (b.actions || []).includes('no-ins'));
    const funded = (b: Bet): boolean => {
      const r = b.sideBets.insurance as { betAmount?: unknown } | null;
      return !!r && Number(r.betAmount) > 0;
    };
    const noInsFunded = noIns.filter(funded).length;
    const noInsNoRecord = noIns.filter((b) => !b.sideBets.insurance).length;
    const recordNoIns = ins.filter((b) => !(b.actions || []).includes('no-ins')).length;
    const coverageOk = noIns.length > 0 && noInsNoRecord === 0 && recordNoIns === 0;
    // Insurance on every offer, exactly (src/sidebet-edges.ts), added to the pinned basic-strategy edge.
    const iev = insuranceEveryOfferExact();
    const enumOk = iev.total === SHOE_DEAL4_ORDERED;
    let baseEdge = NaN;
    try {
      baseEdge = Number(JSON.parse(fs.readFileSync(path.join(ctx.outputsDir, 'exact-rtp.json'), 'utf8')).finite8TD.edgePerInitialBet);
    } catch { /* absent → NaN printed; presence is Step 25's */ }
    const withIns = baseEdge - iev.netPerInitialBet;
    const ok = ins.length > 0 && offAce === 0 && coverageOk && enumOk;
    out.push(step(28, 'Insurance Offer Condition', ok ? 'PASS' : 'FAIL',
      `${ins.length} insurance records, all on a dealer Ace upcard — ${offAce} on a non-Ace upcard. ` +
      `CAPTURE ORIGIN (MANIFEST DL-17; disclosed, verdict-neutral): the capture sent its decline request (no-ins, place-insurance-bet {betAmount: 0}) on ${noIns.length} offers ` +
      `and a funded insurance record came back on ${noInsFunded} of them; LIQD's own UI declines with {acceptInsurance: false} (E24), which the capture never sent, so the capture's rounds carry insurance on every offer. ` +
      `Coverage: ${noInsNoRecord} no-ins round(s) without an insurance record, ${recordNoIns} insurance record(s) without a no-ins token. ` +
      `Insurance on every offer, by exact enumeration of the deal over the 416-card shoe (offered on a dealer Ace without a player natural, as on this capture; ${(iev.offerProbability * 100).toFixed(4)}% of rounds): ` +
      `${(iev.netPerInitialBet * 100).toFixed(6)}% per initial bet (${iev.rational}), so the capture's rounds carried a house edge of ${(withIns * 100).toFixed(6)}% per initial bet (RTP ${((1 - withIns) * 100).toFixed(6)}%) ` +
      `against the basic-strategy ${(baseEdge * 100).toFixed(6)}%, which assumes insurance is declined` +
      (enumOk ? '' : ` — ENUMERATION FAIL: deal weight ${iev.total} != 416·415·414·413 = ${SHOE_DEAL4_ORDERED}`) +
      (coverageOk ? '' : `; COVERAGE FAIL: the insurance records do not cover the capture's ${noIns.length} insurance requests one to one`) +
      (ins.length === 0 ? '; COVERAGE FAIL: no insurance records' : '')));
  }

  // ── Step 29: Side-Bet Deal-Time Invariance ──────────────────────────────────
  // Each side bet's recorded card snapshot equals the player's initial two cards, so
  // the side-bet result is fixed at the deal and cannot mutate as the hand plays out.
  {
    let chk = 0, bad = 0;
    const fails: string[] = [];
    for (const b of bets) {
      const init = initialTwo(b);
      if (init.length !== 2) continue;
      for (const k of ['perfectPair', 'twentyOnePlusThree'] as const) {
        const sb = b.sideBets[k] as { playerHand?: string[] } | null;
        if (!sb?.playerHand) continue;
        chk++;
        if (sb.playerHand[0] !== init[0] || sb.playerHand[1] !== init[1]) {
          bad++;
          if (fails.length < 4) fails.push(`nonce ${b.nonce} ${k}`);
        }
      }
    }
    // COVERAGE: `chk > 0` alone let this PASS on 2 snapshots out of 11,600. Expected is
    // derived from each round's independent `sideFunded` declaration, so a shrunken
    // denominator fails instead of reading as a clean pass.
    let expected = 0;
    for (const b of bets) {
      if (initialTwo(b).length !== 2) continue;
      for (const k of ['perfectPair', 'twentyOnePlusThree'] as const) if (b.sideFunded?.[k]) expected++;
    }
    const coverageOk = expected > 0 && chk === expected;
    const ok = chk > 0 && bad === 0 && coverageOk;
    out.push(step(29, 'Side-Bet Deal-Time Invariance', ok ? 'PASS' : 'FAIL',
      `${chk}/${expected} side-bet card snapshots (Perfect Pairs + 21+3) all equal the player's initial two dealt cards — ${bad} mismatch` +
      (fails.length ? `; e.g. ${fails.join(', ')}` : '') +
      (chk === 0 ? '; COVERAGE FAIL: no side-bet snapshots'
        : coverageOk ? '' : `; COVERAGE FAIL: ${expected} funded side-bet snapshot(s) declared but only ${chk} verified`)));
  }

  // ── Step 30: Deck-Model Confirmation (finite 8-deck) ────────────────────────
  // The shoe is a finite 8-deck: exact-duplicate cards appear within single rounds
  // (refuting a single-deck model) and no exact card exceeds the 8-copy bound.
  {
    let dupRounds = 0, maxCopies = 0;
    for (const b of bets) {
      const seq = [...b.playerHands.flatMap((h) => h.cards), ...(b.dealerHand || [])];
      const m = new Map<string, number>();
      for (const c of seq) m.set(c, (m.get(c) || 0) + 1);
      const mx = Math.max(0, ...m.values());
      if (mx > 1) dupRounds++;
      if (mx > maxCopies) maxCopies = mx;
    }
    const bound = DECKS; // ≤ 8 copies of any exact card exist in the shoe
    const deckOk = bets.length > 0 && dupRounds > 0 && maxCopies <= bound;

    // LIVE-SAMPLE FIT (BLACKJACK-22) — profile policy INFORMATIONAL (decided 2026-09-29): a misfit is
    // reported as INFO — never a FLAG, never counted, verdict unchanged. The deck-model half and the
    // fit's population still FLAG. The
    // captured first cards (shoe[0], the player's first card on every round, split or not) must fit
    // the uniform rank distribution, and the player- and dealer-natural frequencies must fit the
    // 8-deck model: P(two-card 21) = 2 · (32/416) · (128/415). Pre-registered thresholds: rank χ²
    // p ≥ 0.01 at df RANKS−1 (pinned), and |z| ≤ 3 for each natural frequency. The money path over
    // these rounds is a RECONCILIATION, not an RTP estimate — it is reported in
    // outputs/report-figures.json (moneyPath) and in the run's informational block, never scored as RTP.
    const ranks = new Array(RANKS).fill(0);
    let pNat = 0, dNat = 0;
    for (const b of bets) {
      const init = initialTwo(b);
      if (init[0]) ranks[rankOf(init[0]) - 1]++;
      if (init.length === 2 && !b.split && handValue(init).total === 21) pNat++;
      const dl = (b.dealerHand || []).slice(0, 2);
      if (dl.length === 2 && handValue(dl).total === 21) dNat++;
    }
    const n = bets.length;
    const fit = chiSquaredTest(ranks, new Array(RANKS).fill(n / RANKS));
    const pFit = chiSquaredPValue(fit.chi2, FIRST_CARD_DF);
    const pBJ = (2 * (4 * DECKS) * (16 * DECKS)) / (52 * DECKS * (52 * DECKS - 1));
    const zOf = (k: number): number => (k - n * pBJ) / Math.sqrt(n * pBJ * (1 - pBJ));
    const zP = zOf(pNat), zD = zOf(dNat);
    const fitPopOk = n === EXPECTED_HANDS;
    const fitOk = fitPopOk && pFit >= 0.01 && Math.abs(zP) <= 3 && Math.abs(zD) <= 3;
    out.push(step(30, 'Deck-Model Confirmation', !(deckOk && fitPopOk) ? 'FLAG' : fitOk ? 'PASS' : 'INFO',
      `${dupRounds}/${bets.length} rounds contain an exact-duplicate card (refutes single-deck); ` +
      `max copies of any exact card within a round = ${maxCopies} (within the ${bound}-deck bound)` +
      (dupRounds === 0 ? '; FLAG: no duplicates observed' : maxCopies > bound ? `; FLAG: ${maxCopies} exceeds ${bound}-copy bound` : '') +
      `. Live-sample fit over the ${n} captured rounds: first-card rank counts [${ranks.join(', ')}] (A…K) against ${(n / RANKS).toFixed(2)} each — χ² = ${fit.chi2.toFixed(3)}, df ${FIRST_CARD_DF} (pinned), p = ${pFit.toFixed(4)} (threshold ≥ 0.01); ` +
      `player naturals ${pNat}/${n} and dealer naturals ${dNat}/${n} against the 8-deck probability ${(pBJ * 100).toFixed(4)}% (expected ${(n * pBJ).toFixed(1)}) — z = ${zP.toFixed(2)} and ${zD.toFixed(2)} (threshold |z| ≤ 3)` +
      (fitOk ? '' : fitPopOk
        ? ' — INFO (informational: reported, not counted, verdict unchanged): the live sample does not fit the declared deck model at the pre-registered thresholds'
        : ` — FLAG: ${n} rounds, ${EXPECTED_HANDS} declared`) +
      '. The live money path is a reconciliation, not RTP (outputs/report-figures.json moneyPath; informational block)'));
  }

  // ── Step 31: Stake Bracket Bounds ───────────────────────────────────────────
  // Every observed stake is one of the brackets the capture plan declares — no bet
  // slipped outside the intended stake set.
  {
    // Every round's main stake must be the stake the capture plan declares for ITS phase
    // (src/config.ts PHASE_PLAN) — the brackets are code constants, not the dataset's own table.
    const plannedAmts = new Set<number>(Object.values(PHASE_PLAN).map((p) => p.stake));
    const observed = [...new Set(bets.map((b) => Number(b.playerHands[0]?.betAmount)))].sort((a, z) => a - z);
    const outside = observed.filter((st) => !plannedAmts.has(st));
    let wrongPhaseStake = 0;
    for (const b of bets) {
      const plan = PHASE_PLAN[b.phase];
      if (!plan || (b.playerHands || []).some((h) => Number(h.betAmount) !== plan.stake)) wrongPhaseStake++;
    }
    const ok = observed.length > 0 && outside.length === 0 && wrongPhaseStake === 0;
    out.push(step(31, 'Stake Bracket Bounds', ok ? 'PASS' : 'FAIL',
      `observed stakes ${observed.map((st) => `$${st}`).join(', ')} — all within the brackets the capture plan declares in src/config.ts PHASE_PLAN (${[...plannedAmts].sort((a, z) => a - z).map((st) => `$${st}`).join(', ')}); ` +
      `${bets.length - wrongPhaseStake}/${bets.length} rounds staked every hand at their own phase's planned stake` +
      (outside.length ? `; outside the plan: ${outside.map((st) => `$${st}`).join(', ')}` : '') +
      (wrongPhaseStake ? `; ${wrongPhaseStake} round(s) at a stake their phase does not plan` : '')));
  }

  return out;
}
