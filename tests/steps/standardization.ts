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
 * SCOPE OF THAT LAST SENTENCE (corrected 2026-09-09). It is true of the ten steps in THIS file.
 * It was written in game-logic-verifiability.md as if it held of the whole scored suite, and it
 * did not: Step 21, `No FX haircut observed in this capture` (tests/steps/houseedge.ts), had no
 * coverage assertion at all — both its conditions are "expected 0", which an empty set satisfies
 * for free — so a reviewer stripped `exchangeRate` from all 12,046 side-bet records and the step
 * printed its full assurance paragraph over zero records, 31/31 Full Pass. Fixed there; the
 * chapter's universal phrasing is fixed with it.
 *
 *   22  Captured $10 Round Reconstruction (baseline 9) — sampled high-stake card parity
 *   23  Side-Bet Config Completeness  (baseline 11) — every paytable category exercised
 *   24  Phase Coverage & Labels       (baseline 13) — declared phases present, counts match
 *   25  Artifact Hash Integrity       (baseline 14) — all six pinned artifacts, present + matching,
 *                                                    plus report-figures.json re-derived field for field
 *   26  Phase D Client-Seed Variation (baseline 15) — custom seeds used, recompute, change outcomes
 *   27  Split Rules Verification      (baseline 23) — value-based split, aces one card, no re-split
 *   28  Insurance Offer Condition     (baseline 25) — insurance offered only on a dealer Ace upcard
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
  EXPECTED_HANDS,
} from '../../src/config';
import { evaluatePerfectPairs, evaluate21Plus3 } from '../../src/sidebets';
import { DATA_PATH } from '../../src/loader';
import { buildReportFiguresArtifact } from '../../src/report-figures';
import type { Bet } from '../../src/types';

/**
 * Field-for-field comparison of two JSON values, used by Step 25 to reconcile
 * `outputs/report-figures.json` against a fresh recomputation. Returns the differing paths, capped
 * so a wholesale forgery reports a readable sample instead of a wall of text.
 *
 * Order-INSENSITIVE across object keys — a re-serialisation is not a forgery. Order-SENSITIVE
 * inside arrays: a reordered population is a different population, and the forged-artifact battery
 * attacks populations by emptying, duplicating and shrinking them.
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

  // ── Step 22: Captured $10 Round Reconstruction ──────────────────────────────
  // Reconstruct the captured Phase E rounds at $10 with the same reference shoe
  // algorithm used for the $0.10 rounds. Agreement is limited to the sampled inputs;
  // this check does not test stake-dependent seed selection, selective aborts, or
  // server behavior outside the sample.
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
    out.push(step(22, 'Captured $10 Round Reconstruction', ok ? 'PASS' : 'FAIL',
      `${chk}/${e.length} Phase E rounds at $10.00 recompute card-for-card from the revealed seed — ${bad} mismatch. ` +
      `The captured $10.00 rounds reproduce using the same reference shoe algorithm as the $0.10 rounds (stakes present: ${stakes.map((s) => `$${s}`).join(', ')}). This checks reconstruction for the sampled inputs; it does not test stake-dependent seed selection, selective aborts, or behavior outside the sample` +
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
  // reviewers' epoch-deletion counterexample; the first half is Steps 1/3/5/6.
  {
    const declared = meta.phases || {};
    const observed: Record<string, number> = {};
    for (const b of bets) observed[b.phase] = (observed[b.phase] || 0) + 1;
    const rows: string[] = [];
    let bad = 0;
    let declaredTotal = 0;
    for (const [ph, cfg] of Object.entries(declared)) {
      const want = (cfg as { hands: number }).hands;
      const got = observed[ph] || 0;
      declaredTotal += Number(want) || 0;
      rows.push(`${ph}:${got}/${want}`);
      if (got !== want) bad++;
    }
    const observedTotal = Object.values(observed).reduce((s, n) => s + n, 0);
    const undeclared = Object.keys(observed).filter((p) => !(p in declared));
    const totalsOk = declaredTotal === EXPECTED_HANDS && observedTotal === EXPECTED_HANDS;
    const ok = rows.length > 0 && bad === 0 && undeclared.length === 0 && totalsOk;
    out.push(step(24, 'Phase Coverage & Labels', ok ? 'PASS' : 'FAIL',
      `${Object.keys(declared).length} declared phases, all present with matching counts (${rows.join(', ')}); ` +
      `declared total ${declaredTotal} and observed total ${observedTotal} both equal the ${EXPECTED_HANDS} rounds the capture plan declares in src/config.ts` +
      (bad ? `; ${bad} count mismatch` : '') +
      (undeclared.length ? `; undeclared phase(s): ${undeclared.join(', ')}` : '') +
      (totalsOk ? '' : `; POPULATION FAIL: declared ${declaredTotal}, observed ${observedTotal}, plan ${EXPECTED_HANDS} — the phase table has been restated to agree with a different population`) +
      (rows.length === 0 ? '; COVERAGE FAIL: no declared phases' : '')));
  }

  // ── Step 25: Artifact Hash Integrity ────────────────────────────────────────
  // Was "Dataset Hash Integrity" and covered ONE of the pinned artifacts. Two changes,
  // for two different defects a reviewer executed.
  //
  // (1) PRESENCE. `tests/verify.ts` guarded the three output artifacts inside
  //     `if (fs.existsSync(...))`, so DELETING outputs/exact-rtp.json and
  //     outputs/rtp-convergence.html produced 31/31 · PROVABLY FAIR — Full Pass · exit 0.
  //     An artifact that is pinned is load-bearing by definition: its absence is a FAIL, not
  //     a silent skip. (We had hardened exactly this for simulation-results.json — missing →
  //     Steps 17-19 FLAG — and not for its two siblings. Same class, three artifacts, one
  //     of them fixed. The same shape was found in mines and plinko in the same round.)
  //
  // (2) SCORED, NOT FAIL-FAST. verify.ts used to `process.exit(1)` on a pin mismatch before
  //     any step printed. That is a real guard, but it makes an artifact forgery indis-
  //     tinguishable from a crash to anything reading the run: `gate-forgery.sh` scored its
  //     own artifact-substitution probes as NOT RUN rather than CAUGHT, because a run that
  //     dies before a scored step never emits a verdict. The pins are now reconciled INSIDE
  //     this scored step (the shape LIQD dice adopted for its own Step 19), so a substituted
  //     or deleted artifact produces `[FAIL] Step 25` and a NOT PROVABLY FAIR verdict that a gate,
  //     a CI job or a reader can actually see.
  //
  // (3) RE-DERIVED, NOT PINNED: outputs/report-figures.json. Added 2026-09-09 to source the
  //     report's prose figures, and bound to nothing — so the framework's forged-artifact battery
  //     emptied its populations (F1), duplicated its rows (F2), shrank them with the header made
  //     consistent (F3), set every rtp/edge field to 0.5 (F4) and deleted the file outright (F11),
  //     and every one of those runs returned 31/31 · PROVABLY FAIR — Full Pass. That is the same
  //     class as (1) and (2), one level further out: a new emission is created to give figures a
  //     producing artifact, and no scored step re-derives it. Mines closed it for
  //     audit-figures.json, dice for its own report-figures.json, plinko for calibration-results /
  //     coverage-results / verification-stats. This is blackjack's.
  //
  //     A HASH PIN WOULD BE THE WRONG INSTRUMENT here, which is why this file is handled below
  //     instead of joining the six above. The file is rewritten by every `npm run verify` (at the
  //     end of tests/verify.ts, after the steps have run), so a pin would either be enforced
  //     against a file the same command is about to replace, or would have to be re-pinned on
  //     every run — a pin the auditor updates on every run proves nothing. The stronger check is
  //     available and cheap: RECOMPUTE the figures from the pinned dataset and the exact engines
  //     through `buildReportFiguresArtifact()` — the same builder verify.ts writes with — and
  //     compare the result field for field against the copy on disk.
  //
  //     WHY ABSENCE MUST FAIL. Checked, not assumed, in the three places dice settled the same
  //     question: `.gitignore` un-ignores it explicitly (`!outputs/report-figures.json`),
  //     `evidence.md` carries it as evidence item **E21**, and the report cites it by name as the
  //     trace for published figures (MANIFEST.md §Artifacts, reproducibility.md). It is an artifact
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
    const simFresh = process.env.SIM_FRESH === '1';
    const sha256 = (p: string): string => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    const rows: string[] = [];
    const problems: string[] = [];
    const pinned: { name: string; file: string; pin: string; fresh: boolean }[] = [
      { name: 'data/blackjack-6000hands.json', file: DATA_PATH, pin: DATASET_SHA256, fresh: false },
      { name: 'outputs/simulation-results.json', file: path.join(ctx.outputsDir, 'simulation-results.json'), pin: SIMULATION_SHA256, fresh: true },
      { name: 'outputs/rtp-convergence.html', file: path.join(ctx.outputsDir, 'rtp-convergence.html'), pin: SIMULATION_HTML_SHA256, fresh: true },
      { name: 'outputs/exact-rtp.json', file: path.join(ctx.outputsDir, 'exact-rtp.json'), pin: EXACT_RTP_SHA256, fresh: false },
      { name: 'outputs/cherry-pick-attack.json', file: path.join(ctx.outputsDir, 'cherry-pick-attack.json'), pin: ATTACK_SHA256, fresh: false },
      { name: 'outputs/rng-branch-coverage.json', file: path.join(ctx.outputsDir, 'rng-branch-coverage.json'), pin: RNG_BRANCH_SHA256, fresh: false },
    ];
    for (const a of pinned) {
      if (!fs.existsSync(a.file)) {
        problems.push(`${a.name} is MISSING — a pinned artifact is load-bearing; its absence cannot score as a pass`);
        rows.push(`${a.name}: ABSENT`);
        continue;
      }
      const actual = sha256(a.file);
      if (actual === a.pin) { rows.push(`${a.name}: ${actual.slice(0, 12)}… matches`); continue; }
      if (a.fresh && simFresh) {
        rows.push(`${a.name}: ${actual.slice(0, 12)}… FRESH RUN (SIM_FRESH=1, pin not enforced — re-pin in src/config.ts to publish)`);
        continue;
      }
      const label = a.name === 'outputs/exact-rtp.json' ? 'Exact-RTP artifact hash mismatch' : `${a.name} hash mismatch`;
      problems.push(`${label} — expected ${a.pin}, got ${actual}`);
      rows.push(`${a.name}: ${actual.slice(0, 12)}… ≠ pinned ${a.pin.slice(0, 12)}…`);
    }
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
    const ok = chk === d.length && chk > 0 && bad === 0 && seeds.size > 1;
    out.push(step(26, 'Phase D Client-Seed Variation', ok ? 'PASS' : 'FLAG',
      `${chk}/${d.length} Phase D hands recompute under ${seeds.size} distinct auditor client seeds — ${bad} mismatch; ` +
      `${changed}/${chk} deal a different first card under a canonical baseline seed (client seed genuinely feeds the derivation)` +
      (chk === 0 ? '; COVERAGE FAIL: 0 Phase D hands' : seeds.size <= 1 ? '; FLAG: only one distinct client seed' : '')));
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
    const ok = sp.length > 0 && valBad === 0 && aceBad === 0 && resplit === 0;
    // DETAIL-STRING WORDING (S-DETAIL). `outputs/verification-results.json` is published prose:
    // it ships to the client and gets quoted back. This string used to end "(re-split is off)",
    // the one assertive phrasing of a rule that EVERY chapter marks ASSUMED — no third hand ever
    // appears in the capture, which shows re-split was never TAKEN, not that it was unavailable.
    // No chapter-level prose check reads this file, so the contradiction sat inside the artifact.
    out.push(step(27, 'Split Rules Verification', ok ? 'PASS' : 'FAIL',
      `${sp.length} split rounds: ${valBad} value-mismatched pairs (value-based split rule), ` +
      `${aceSplits} ace splits — ${aceBad} that did not draw exactly one card each (splitAcesOneCard), ` +
      `${resplit} rounds with >2 player hands. No re-split was observed; availability was not probed, ` +
      `so "no re-split" is ASSUMED of the rule set rather than demonstrated` +
      (sp.length === 0 ? '; COVERAGE FAIL: no split rounds' : '')));
  }

  // ── Step 28: Insurance Offer Condition ──────────────────────────────────────
  // Every insurance decision (taken or declined) occurs only when the dealer's
  // upcard is an Ace — insurance is never offered otherwise.
  {
    const ins = bets.filter((b) => b.sideBets.insurance);
    let offAce = 0;
    for (const b of ins) if (rankOf((b.dealerHand || [])[0] || 'X:0') !== 1) offAce++;
    const ok = ins.length > 0 && offAce === 0;
    out.push(step(28, 'Insurance Offer Condition', ok ? 'PASS' : 'FAIL',
      `${ins.length} insurance decisions, all on a dealer Ace upcard — ${offAce} on a non-Ace upcard` +
      (ins.length === 0 ? '; COVERAGE FAIL: no insurance decisions' : '')));
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
    const ok = bets.length > 0 && dupRounds > 0 && maxCopies <= bound;
    out.push(step(30, 'Deck-Model Confirmation', ok ? 'PASS' : 'FLAG',
      `${dupRounds}/${bets.length} rounds contain an exact-duplicate card (refutes single-deck); ` +
      `max copies of any exact card within a round = ${maxCopies} (within the ${bound}-deck bound)` +
      (dupRounds === 0 ? '; FLAG: no duplicates observed' : maxCopies > bound ? `; FLAG: ${maxCopies} exceeds ${bound}-copy bound` : '')));
  }

  // ── Step 31: Stake Bracket Bounds ───────────────────────────────────────────
  // Every observed stake is one of the brackets the capture plan declares — no bet
  // slipped outside the intended stake set.
  {
    const declaredAmts = new Set<number>(
      Object.values(meta.phases || {}).map((p) => Number((p as { amount: number }).amount)).filter((n) => Number.isFinite(n)));
    const observed = [...new Set(bets.map((b) => Number(b.playerHands[0]?.betAmount)))].sort((a, z) => a - z);
    const outside = observed.filter((s) => !declaredAmts.has(s));
    const ok = observed.length > 0 && outside.length === 0 && declaredAmts.size > 0;
    out.push(step(31, 'Stake Bracket Bounds', ok ? 'PASS' : 'FAIL',
      `observed stakes ${observed.map((s) => `$${s}`).join(', ')} — all within the declared brackets ${[...declaredAmts].sort((a, z) => a - z).map((s) => `$${s}`).join(', ')}` +
      (outside.length ? `; outside declared: ${outside.map((s) => `$${s}`).join(', ')}` : '') +
      (declaredAmts.size === 0 ? '; COVERAGE FAIL: no declared stake brackets' : '')));
  }

  return out;
}
