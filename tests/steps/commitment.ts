/**
 * Steps 1–5: Commitment, pre-commitment chain, epoch consistency, nonce continuity, epoch size.
 *
 * POPULATION BINDING (G-BIND, 2026-09-09). Every expected count in this file comes from
 * `src/config.ts` — EXPECTED_SEEDS / EXPECTED_EPOCH_SIZE / EXPECTED_HANDS — and NOT from
 * `seeds.length`, `bets.length` or any `meta.*` field of the dataset under test. Before this,
 * `expectedReveals = seeds.length` was a tautology: delete an epoch and the expectation
 * shrinks with it, so Step 1 printed "119/119 epochs" and passed. The dataset's own header
 * fields are now scored AGAINST the constants (Step 5) instead of being trusted as the plan.
 */

import { step } from './context';
import type { StepResult, VerifyContext } from './context';
import { commitHash } from '../../src/rng';
import { EXPECTED_SEEDS, EXPECTED_EPOCH_SIZE, EXPECTED_HANDS } from '../../src/config';

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
  const s2 = step(2, 'Pre-Commitment Chain', linkBad === 0 && links === expectedLinks ? 'PASS' : 'FAIL',
    `${links - linkBad}/${links} next-seed links verified (expected ${expectedLinks} = EXPECTED_SEEDS−1); ${linkBad} broken` +
    (links !== expectedLinks ? `; COVERAGE FAIL: ${expectedLinks - links} link(s) missing` : ''));

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
  for (const [epoch, epochBets] of byEpoch) {
    const sd = seedByEpoch.get(epoch);
    if (!sd || epochBets.some((b) => b.hashedServerSeed !== sd.hashedServerSeed)) epochViolations++;
  }
  const s3 = step(3, 'Within-Epoch Hash Consistency',
    epochViolations === 0 && byEpoch.size === EXPECTED_SEEDS && seeds.length === EXPECTED_SEEDS ? 'PASS' : 'FAIL',
    `${byEpoch.size}/${EXPECTED_SEEDS} epochs carry bets; every bet's epoch label maps to the seed record whose commitment it carries; ${epochViolations} epoch(s) with a mismatch` +
    (byEpoch.size !== EXPECTED_SEEDS || seeds.length !== EXPECTED_SEEDS
      ? `; POPULATION FAIL: ${byEpoch.size} epoch(s) with bets and ${seeds.length} seed record(s) against the declared ${EXPECTED_SEEDS}` : ''));

  // ── Step 4: Nonce continuity + nonce-window closure ─────────────────────────
  // Two properties, because continuity alone cannot see a TRUNCATED epoch: drop the last
  // round of an epoch and the surviving nonces are still contiguous from nonceStart.
  //
  //   (a) continuity — nonces run contiguously from `nonceStart`.
  //   (b) closure    — the epoch's declared nonce WINDOW is exactly the window the plan
  //                    declares (`nonceEnd == nonceStart + EXPECTED_EPOCH_SIZE − 1`) and the
  //                    highest nonce actually present equals `nonceEnd`.
  //
  // `seeds[].nonceEnd` was, until 2026-09-09, a dead field: `grep -rn nonceEnd src tests`
  // matched `src/types.ts` and nothing else. It is the per-epoch record of how far the epoch
  // was served, written by the capture rig at rotation time and independent of the bet rows,
  // so it is exactly the witness a trailing-round deletion has to survive — and it did not
  // have to, because nothing read it.
  let nonceGaps = 0;
  let windowBad = 0;
  let tailBad = 0;
  const gapDetail: string[] = [];
  const winDetail: string[] = [];
  for (const s of seeds) {
    const epochBets = (byHash.get(s.hashedServerSeed) || []).slice().sort((a, b) => a.nonce - b.nonce);
    if (epochBets.length === 0) continue;
    const start = s.nonceStart ?? epochBets[0].nonce;
    for (let i = 0; i < epochBets.length; i++) {
      if (epochBets[i].nonce !== start + i) { nonceGaps++; if (gapDetail.length < 3) gapDetail.push(`epoch ${s.epoch} at nonce ${epochBets[i].nonce}`); break; }
    }
    // (b) closure — declared window width, then the tail actually present.
    const expectedEnd = start + EXPECTED_EPOCH_SIZE - 1;
    if (s.nonceEnd !== expectedEnd) {
      windowBad++;
      if (winDetail.length < 3) winDetail.push(`epoch ${s.epoch}: nonceEnd ${String(s.nonceEnd)} != nonceStart ${start} + ${EXPECTED_EPOCH_SIZE - 1}`);
    } else if (epochBets[epochBets.length - 1].nonce !== s.nonceEnd) {
      tailBad++;
      if (winDetail.length < 3) winDetail.push(`epoch ${s.epoch}: highest nonce present ${epochBets[epochBets.length - 1].nonce} != declared nonceEnd ${s.nonceEnd}`);
    }
  }
  // A gap means rounds are missing from the nonce chain, i.e. the capture is not the
  // complete epoch it claims to be. That is a coverage FAILURE, not a soft warning.
  const s4 = step(4, 'Nonce Continuity', nonceGaps === 0 && windowBad === 0 && tailBad === 0 ? 'PASS' : 'FAIL',
    `contiguous from nonceStart within each epoch; ${nonceGaps} epoch(s) with a gap${gapDetail.length ? ` (${gapDetail.join('; ')})` : ''}` +
    `; nonce window closed against the seed record: ${seeds.length - windowBad - tailBad}/${seeds.length} epochs have nonceEnd == nonceStart+${EXPECTED_EPOCH_SIZE - 1} and a round present AT nonceEnd ` +
    `(${windowBad} wrong window, ${tailBad} truncated tail)` +
    (winDetail.length ? `; e.g. ${winDetail.join('; ')}` : ''));

  // ── Step 5: Epoch size + declared population ────────────────────────────────
  // FAIL, not FLAG. A short epoch used to FLAG, which resolves to "PROVABLY FAIR —
  // Conditional Pass" and exit 2 — a reviewer's trailing-round deletion produced exactly
  // that and it still reads as a pass. Rounds missing from the audited population is not a
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
