/**
 * Steps 1–5: Commitment, pre-commitment chain, epoch consistency, nonce continuity, epoch size.
 *
 * POPULATION BINDING. Every expected count in this file comes from
 * `src/config.ts` — EXPECTED_SEEDS / EXPECTED_EPOCH_SIZE / EXPECTED_HANDS — and NOT from
 * `seeds.length`, `bets.length` or any `meta.*` field of the dataset under test.
 * `expectedReveals = seeds.length` would be a tautology: delete an epoch and the expectation
 * shrinks with it, so Step 1 prints "119/119 epochs" and passes. The dataset's own header
 * fields are scored AGAINST the constants (Step 5) instead of being trusted as the plan.
 */

import { step } from './context';
import type { StepResult, VerifyContext } from './context';
import { commitHash } from '../../src/rng';
import { EXPECTED_SEEDS, EXPECTED_EPOCH_SIZE, EXPECTED_HANDS, NONCE_BASE, EXPECTED_CAPTURE_RETRY_GAPS } from '../../src/config';

export function run(ctx: VerifyContext): StepResult[] {
  const { seeds, byHash, bets } = ctx;
  const revealed = seeds.filter((s) => s.serverSeed != null);

  // ── Step 1: Commitment reveal — SHA-256(utf8(serverSeed hex)) == hashedServerSeed ──
  let commitChecked = 0;
  let commitBad = 0;
  for (const s of revealed) {
    commitChecked++;
    if (commitHash(s.serverSeed as string) !== s.hashedServerSeed) commitBad++;
  }
  // COVERAGE ASSERTION: the audit claims 100% of the capture plan's EXPECTED_SEEDS epochs
  // revealed. The expected N is the code constant, not `seeds.length` — that was the hole:
  // `seeds.length` shrinks with the file, so deleting an epoch made the expectation agree with
  // the forgery and the step printed "119/119 epochs … PASS". Two failures are now distinct:
  // a missing epoch RECORD (population) and an unrevealed seed (coverage).
  const expectedReveals = EXPECTED_SEEDS;
  const populationOk = seeds.length === EXPECTED_SEEDS;
  const s1 = step(1, 'Commitment Reveal', commitBad === 0 && commitChecked === expectedReveals && populationOk ? 'PASS' : 'FAIL',
    `${commitChecked}/${expectedReveals} epochs have a revealed server seed that hashes to its commitment (SHA-256 utf8); ${commitBad} mismatches` +
    (populationOk ? '' : `; POPULATION FAIL: the dataset carries ${seeds.length} seed record(s), the capture plan declares ${EXPECTED_SEEDS} (src/config.ts EXPECTED_SEEDS) — this is a different population, not a different result`) +
    (commitChecked !== expectedReveals && populationOk ? `; COVERAGE FAIL: ${expectedReveals - commitChecked} epoch(s) not revealed (expected 100%)` : ''));

  // ── Step 2: Pre-commitment chain — each epoch's nextHashedServerSeed == next epoch's hash ──
  const ordered = [...seeds].sort((a, b) => a.epoch - b.epoch);
  let links = 0;
  let linkBad = 0;
  for (let i = 0; i + 1 < ordered.length; i++) {
    if (ordered[i].nextHashedServerSeed == null) continue;
    links++;
    if (ordered[i].nextHashedServerSeed !== ordered[i + 1].hashedServerSeed) linkBad++;
  }
  // Expected link count is EXPECTED_SEEDS − 1 from src/config.ts, not `seeds.length - 1`:
  // a chain of 119 epochs is a complete chain over the wrong population.
  const expectedLinks = EXPECTED_SEEDS - 1; // every epoch but the last pre-commits the next
  // ── Step 2, pre-capture anchor ─────────────────────────────────────────────────
  // The chain above starts at epoch 0, so nothing in it says that epoch 0's commitment was
  // published BEFORE the capture began — a chain can be complete and still start wherever the
  // file starts. The capture rig recorded the seed pair that was active when it connected and
  // rotated it before the first captured round (`meta.preCapture`): its revealed seed must hash to
  // its own commitment, and the next-seed hash it published must be epoch 0's commitment. Both
  // are recomputed here from the raw fields; the record's own `commitVerified` boolean is not
  // read. An ABSENT anchor is a FAIL, not a skip.
  const pre = (ctx.meta.preCapture ?? null) as { revealedServerSeed?: unknown; hashedServerSeed?: unknown; nextHashedServerSeed?: unknown } | null;
  const preRevealOk = !!pre && typeof pre.revealedServerSeed === 'string'
    && commitHash(pre.revealedServerSeed) === pre.hashedServerSeed;
  const preLinkOk = !!pre && ordered.length > 0 && pre.nextHashedServerSeed === ordered[0].hashedServerSeed;
  const anchorOk = preRevealOk && preLinkOk;
  const s2 = step(2, 'Pre-Commitment Chain', linkBad === 0 && links === expectedLinks && anchorOk ? 'PASS' : 'FAIL',
    `${links - linkBad}/${links} next-seed links verified (expected ${expectedLinks} = EXPECTED_SEEDS−1); ${linkBad} broken` +
    (links !== expectedLinks ? `; COVERAGE FAIL: ${expectedLinks - links} link(s) missing` : '') +
    `; pre-capture anchor (meta.preCapture): ${!pre ? 'ABSENT — the chain is not anchored before epoch 0' : `revealed pre-capture seed hashes to its commitment ${preRevealOk ? 'OK' : 'FAIL'}, its published next-seed hash equals epoch 0's commitment ${preLinkOk ? 'OK' : 'FAIL'}`}` +
    ` — ${EXPECTED_SEEDS} links in all, recomputed from the raw hash fields (the capture's commitVerified / chainLinkOk booleans are not read)`);

  // ── Step 3: Within-epoch hash consistency — every bet's epoch label maps to the seed
  // record whose commitment it carries. Grouping by the numeric `epoch` label (not by the
  // hash) and checking each group's bets all carry the ONE hash committed by seeds[epoch]
  // makes the step do real work: swapping the epoch labels of two bets — or relabelling a
  // bet into an epoch it did not belong to — now breaks the map and FAILs. (The earlier
  // form grouped by hash and asked whether a member's hash differed from its own group key,
  // which is a tautology; only the group count did anything.)
  const seedByEpoch = new Map(seeds.map((s) => [s.epoch, s]));
  const byEpoch = new Map<number, typeof bets>();
  for (const b of bets) {
    const arr = byEpoch.get(b.epoch) ?? [];
    arr.push(b);
    byEpoch.set(b.epoch, arr);
  }
  let epochViolations = 0;
  let clientSeedViolations = 0;
  const clientFails: string[] = [];
  for (const [epoch, epochBets] of byEpoch) {
    const sd = seedByEpoch.get(epoch);
    if (!sd || epochBets.some((b) => b.hashedServerSeed !== sd.hashedServerSeed)) epochViolations++;
    // The same-client-seed half: every round of an epoch was dealt under ONE client seed, and it
    // is the client seed the epoch's seed record carries.
    const clients = new Set(epochBets.map((b) => b.clientSeed));
    if (clients.size !== 1 || !sd || !clients.has(sd.clientSeed)) {
      clientSeedViolations++;
      if (clientFails.length < 3) clientFails.push(`epoch ${epoch}: ${clients.size} client seed(s) ${JSON.stringify([...clients].slice(0, 3))} vs seed record ${JSON.stringify(sd?.clientSeed)}`);
    }
  }
  const s3 = step(3, 'Within-Epoch Hash Consistency',
    epochViolations === 0 && clientSeedViolations === 0 && byEpoch.size === EXPECTED_SEEDS && seeds.length === EXPECTED_SEEDS ? 'PASS' : 'FAIL',
    `${byEpoch.size}/${EXPECTED_SEEDS} epochs carry bets; every bet's epoch label maps to the seed record whose commitment it carries; ${epochViolations} epoch(s) with a mismatch` +
    `; every round of an epoch carries ONE client seed, the one on the epoch's seed record: ${byEpoch.size - clientSeedViolations}/${byEpoch.size} epochs, ${clientSeedViolations} with more than one or a different one` +
    (clientFails.length ? ` (${clientFails.join('; ')})` : '') +
    (byEpoch.size !== EXPECTED_SEEDS || seeds.length !== EXPECTED_SEEDS
      ? `; POPULATION FAIL: ${byEpoch.size} epoch(s) with bets and ${seeds.length} seed record(s) against the declared ${EXPECTED_SEEDS}` : '') +
    '. Scope: the per-round hashedServerSeed and clientSeed are the capture script\'s stamps (the commitment it tracked for the epoch, and the epoch\'s client seed written onto each round after the reveal), not values LIQD returned per round, so this step checks that bookkeeping against the seed records');

  // ── Step 4: Nonce continuity + nonce-window closure ─────────────────────────
  // SCOPE. On most rounds the nonce is the one LIQD returned. On the rounds recorded from the partial
  // insurance response (an Ace-up dealer natural found at the peek, after the capture's insurance
  // request; they carry no serverSeedId) that response
  // omits the nonce, and the capture script wrote its own count instead (epoch start + hand index).
  // Two properties, because continuity alone cannot see a TRUNCATED epoch: drop the last
  // round of an epoch and the surviving nonces are still contiguous from nonceStart.
  //
  //   (a) continuity — nonces run contiguously from `nonceStart`.
  //   (b) closure    — the epoch's declared nonce WINDOW is exactly the window the plan
  //                    declares (`nonceEnd == nonceStart + EXPECTED_EPOCH_SIZE − 1`) and the
  //                    highest nonce actually present equals `nonceEnd`.
  //
  // `seeds[].nonceEnd` is read HERE and would otherwise be a dead field, matched only by
  // `src/types.ts`. It is the per-epoch record of how far the epoch was served, written by the
  // capture rig at rotation time and independent of the bet rows, so it is exactly the witness
  // a trailing-round deletion has to survive — and a witness nothing reads is no witness.
  // The window is DECLARED (src/config.ts NONCE_BASE, EXPECTED_EPOCH_SIZE): 0 … 49 for every
  // epoch. The seed record's own `nonceStart`/`nonceEnd` are checked AGAINST the declaration rather
  // than used as it, so a record that restates its own window cannot move the window.
  //
  // GAP POLICY (Framework 1.0, decided 2026-09-17). A missing nonce is counted, never derived
  // around. Gaps above EXPECTED_CAPTURE_RETRY_GAPS (declared 0) are undeclared — the operator-side
  // case, a settled or voided game that is not in the dataset — and FAIL; a gap count equal to a
  // non-zero declaration is an auditor-side capture retry and is a capture-origin FLAG (disclosed,
  // verdict-neutral). A repeat or a reorder is always a FAIL.
  let missingNonces = 0;
  let repeats = 0;
  let outOfWindow = 0;
  let reorders = 0;
  let windowBad = 0;
  let tailBad = 0;
  const gapDetail: string[] = [];
  const winDetail: string[] = [];
  const declaredEnd = NONCE_BASE + EXPECTED_EPOCH_SIZE - 1;
  for (const s of seeds) {
    const epochBets = byHash.get(s.hashedServerSeed) || [];
    if (epochBets.length === 0) continue;
    const nonces = epochBets.map((b) => b.nonce);
    // Reorder: the capture sequence (dataset order) must be strictly increasing within an epoch.
    for (let i = 1; i < nonces.length; i++) if (!(nonces[i] > nonces[i - 1])) { reorders++; break; }
    const present = new Set(nonces);
    repeats += nonces.length - present.size;
    for (const n of present) if (n < NONCE_BASE || n > declaredEnd) outOfWindow++;
    for (let n = NONCE_BASE; n <= declaredEnd; n++) {
      if (!present.has(n)) { missingNonces++; if (gapDetail.length < 3) gapDetail.push(`epoch ${s.epoch} nonce ${n}`); }
    }
    // The record's window must be the declared window, and the round AT nonceEnd must be present.
    if (s.nonceStart !== NONCE_BASE || s.nonceEnd !== declaredEnd) {
      windowBad++;
      if (winDetail.length < 3) winDetail.push(`epoch ${s.epoch}: record window ${String(s.nonceStart)}…${String(s.nonceEnd)} != declared ${NONCE_BASE}…${declaredEnd}`);
    } else if (!present.has(declaredEnd)) {
      tailBad++;
      if (winDetail.length < 3) winDetail.push(`epoch ${s.epoch}: no round at the declared nonceEnd ${declaredEnd}`);
    }
  }
  const hardBad = repeats > 0 || outOfWindow > 0 || reorders > 0 || windowBad > 0 || tailBad > 0;
  const captureCountNonces = bets.filter((b) => b.serverSeedId === undefined).length;
  const undeclaredGaps = missingNonces > EXPECTED_CAPTURE_RETRY_GAPS;
  const declaredCaptureGaps = missingNonces > 0 && missingNonces === EXPECTED_CAPTURE_RETRY_GAPS;
  const s4Status = hardBad || undeclaredGaps || missingNonces !== EXPECTED_CAPTURE_RETRY_GAPS ? 'FAIL' : declaredCaptureGaps ? 'FLAG' : 'PASS';
  const s4 = step(4, 'Nonce Continuity', s4Status,
    `declared window NONCE_BASE…NONCE_BASE+EXPECTED_EPOCH_SIZE−1 = ${NONCE_BASE}…${declaredEnd} (src/config.ts) on every epoch; ` +
    `${missingNonces} missing nonce(s) against ${EXPECTED_CAPTURE_RETRY_GAPS} declared capture-retry gap(s)${gapDetail.length ? ` (${gapDetail.join('; ')})` : ''}, ` +
    `${repeats} repeat(s), ${reorders} epoch(s) out of capture order, ${outOfWindow} nonce(s) outside the window; ` +
    `nonce window closed against the seed record: ${seeds.length - windowBad - tailBad}/${seeds.length} epochs have nonceStart == ${NONCE_BASE}, nonceEnd == ${declaredEnd} and a round present AT nonceEnd ` +
    `(${windowBad} wrong window, ${tailBad} truncated tail)` +
    (winDetail.length ? `; e.g. ${winDetail.join('; ')}` : '') +
    (declaredCaptureGaps ? '; CAPTURE-ORIGIN FLAG: every missing nonce is a declared auditor-side capture retry — disclosed, verdict-neutral' : '') +
    (undeclaredGaps ? '; UNDECLARED GAP(S): a game the operator settled or voided is not in the dataset — no would-be card is derived for a missing nonce' : '') +
    `. Limit: the window is what the capture requested and recorded, not an operator-side counter; ${captureCountNonces} of the nonces (the rounds recorded from the partial insurance response, which carry no serverSeedId) are the capture's own count (epoch start + hand index), because that response omits the nonce`,
    declaredCaptureGaps && !hardBad ? 'capture' : undefined);

  // ── Step 5: Epoch size + declared population ────────────────────────────────
  // FAIL, not FLAG. A short epoch used to FLAG, which resolves to "PROVABLY FAIR —
  // Conditional Pass" and exit 2 — deleting trailing rounds produced exactly that, and it
  // still reads as a pass. Rounds missing from the audited population is not a
  // disclosable irregularity in an otherwise-sound audit; it is a different audit.
  //
  // This step is also where the dataset's OWN header fields get scored. `meta.epochSize`,
  // `meta.plannedTotal`, `meta.progress.bets` and `meta.progress.seeds` sat in the file and
  // no step read any of them, so a forger could restate the plan to match a shrunken capture
  // for free. They now have to agree with src/config.ts.
  const sizes = [...byHash.values()].map((b) => b.length);
  const wrong = sizes.filter((n) => n !== EXPECTED_EPOCH_SIZE).length;
  const progress = (ctx.meta.progress ?? {}) as { bets?: unknown; seeds?: unknown };
  const headerRows: string[] = [];
  const headerCheck = (label: string, got: unknown, want: number): boolean => {
    const ok = Number(got) === want;
    if (!ok) headerRows.push(`${label}=${String(got)} (declared ${want})`);
    return ok;
  };
  const headerOk = [
    headerCheck('meta.epochSize', ctx.meta.epochSize, EXPECTED_EPOCH_SIZE),
    headerCheck('meta.plannedTotal', ctx.meta.plannedTotal, EXPECTED_HANDS),
    headerCheck('meta.progress.bets', progress.bets, EXPECTED_HANDS),
    headerCheck('meta.progress.seeds', progress.seeds, EXPECTED_SEEDS),
  ].every(Boolean);
  const sizeOk = wrong === 0 && sizes.length === EXPECTED_SEEDS && bets.length === EXPECTED_HANDS;
  const s5 = step(5, 'Epoch Size', sizeOk && headerOk ? 'PASS' : 'FAIL',
    `${sizes.length}/${EXPECTED_SEEDS} epochs; min=${sizes.length ? Math.min(...sizes) : 0} max=${sizes.length ? Math.max(...sizes) : 0}; ${wrong} not exactly ${EXPECTED_EPOCH_SIZE}; ` +
    `${bets.length}/${EXPECTED_HANDS} rounds total. Expected counts come from src/config.ts (EXPECTED_SEEDS/EXPECTED_EPOCH_SIZE/EXPECTED_HANDS), not from the dataset header` +
    (sizeOk ? '' : '; POPULATION FAIL: the audited population is not the population the capture plan declares') +
    (headerOk
      ? `; the dataset's own header agrees (meta.epochSize, meta.plannedTotal, meta.progress.bets, meta.progress.seeds)`
      : `; HEADER FAIL: ${headerRows.join(', ')} — the dataset restates a plan the code does not declare`));

  return [s1, s2, s3, s4, s5];
}
