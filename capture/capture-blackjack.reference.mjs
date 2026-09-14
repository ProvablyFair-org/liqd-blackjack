// ============================================================================
//  REFERENCE RECORD — NOT A RUNNABLE TOOL
//
//  This file documents how the audited dataset (data/blackjack-6000hands.json)
//  was produced. Authentication, session handling, and all credential material
//  have been REMOVED: the constants below are placeholders and the transport
//  layer is reduced to a stub. It is published so a reader can see the capture
//  methodology — the phase plan, the request/response shape, the seed-rotation
//  discipline, the strategy that drove play, and the inline verification
//  performed at capture time — not so the capture can be replayed.
//
//  The dataset itself is the audited artifact; every computational claim in this
//  report is reproducible from it via `npm test`. Capture provenance (that these
//  are real rounds settled on the operator's system) is attested by the auditor,
//  not re-derivable from this repository. See scope-and-methodology.md
//  (Limitations) and evidence.md (E01 provenance note).
//
//  Verification helpers referenced here (blackjackShoe / commitHash) are the same
//  functions shipped in src/rng.ts, which the verifier uses.
// ============================================================================

// ── Capture plan (as executed: 6,000 hands, 50 per seed epoch, 120 epochs) ───
//   A  3,300  $0.10  basic strategy (S17)          + side bets   baseline volume
//   B  1,000  $0.10  aggressive (hit/double heavy) + side bets   deep draw paths
//   C    500  $0.10  split-forcing                 + side bets   split settlement
//   D    500  $0.10  basic, 10 auditor-controlled client seeds (pfaudit-…)
//   E    200  $10    basic, NO side bets                         stake independence
//   F    500  $0.10  split-forcing                 + side bets   multi-split depth
//
//   Every hand is played to settlement through the operator's session endpoints:
//   place-bet deals PDPD, then hit / stand / double / split drive the hand, and
//   the settle response carries the full dealt cards, dealer hand, per-hand
//   betAmount / winningAmount, the side-bet records, and the round's nonce.
//   Insurance is FUNDED on every dealer-Ace round where the player did not hold a
//   natural (446 of 462 dealer-Ace rounds; the 16 uninsured are player-natural
//   rounds that settle before any action), 433 at $0.05 and 13 at $5.00. It is a −EV side wager
//   and is reported separately from the main line so the main-line RTP reading
//   stays clean. The action token recorded on these rounds is `no-ins`, which is
//   a legacy label — it marks an insurance-settled round, NOT a declined one.

const EPOCH = 50;                                        // hands per seed pair
const AMT_LOW = 0.10, AMT_STAKE = 10, AMT_SIDE = 0.10;
const TOTAL_HANDS = 6000;

// ── Endpoints (paths as observed; host redacted) ─────────────────────────────
const BASE = 'https://<redacted-host>/api/v1';
const EP = {
  active:     `${BASE}/fast-games/provably-fair/active`,
  rotate:     `${BASE}/fast-games/provably-fair/rotate`,
  place:      `${BASE}/fast-games/blackjack-game/place-bet`,
  hit:        `${BASE}/fast-games/blackjack-game/hit`,
  stand:      `${BASE}/fast-games/blackjack-game/stand`,
  double:     `${BASE}/fast-games/blackjack-game/place-double-bet`,
  split:      `${BASE}/fast-games/blackjack-game/place-split-bet`,
  insurance:  `${BASE}/fast-games/blackjack-game/place-insurance-bet`,
  unfinished: `${BASE}/fast-games/blackjack-game/get-unfinished-bet`,
};

// ── Transport: stubbed ───────────────────────────────────────────────────────
// The live rig signed each request with an authenticated session cookie and
// handled auth expiry, transient retries and rate-limit backoff. All of that is
// removed here; this stub exists only so the call sites below stay readable.
async function http(_method, _url, _body) {
  throw new Error('reference record — transport removed; this file does not run');
}

// ── SIDE-BET FIELD NAMES — the asymmetry that matters ────────────────────────
// The request and response use DIFFERENT names for the same side bet:
//
//   request   perfectPairsBetAmount        (PLURAL "Pairs")
//   response  perfectPairSideBet           (SINGULAR "Pair")
//
//   request   twentyOnePlusThreeBetAmount
//   response  twentyOnePlusThreeSideBet
//
// An earlier capture sent the SINGULAR form on the request. The API accepted the
// bet, charged only the main stake, and returned no Perfect Pairs record — a
// silent drop, with no error. The dataset that resulted contained zero Perfect
// Pairs rounds while 21+3 (correctly named in the same request) worked normally.
// The rig therefore asserts, per hand, that a FUNDED side bet comes back PRESENT,
// and aborts the run rather than accumulating hands with a silently-dropped bet.
function placeBetBody(amount, side) {
  const body = { betAmount: amount, currencyId: '<redacted>' };
  if (side) {
    if (side.perfectPair)        body.perfectPairsBetAmount       = side.perfectPair;
    if (side.twentyOnePlusThree) body.twentyOnePlusThreeBetAmount = side.twentyOnePlusThree;
  }
  return body;
}

function assertSideBetsHonoured(sideRequested, roundResponse) {
  if (!sideRequested) return;
  const funded = Object.keys(sideRequested).filter((k) => sideRequested[k] > 0);
  for (const k of funded) {
    const responseKey = k === 'perfectPair' ? 'perfectPairSideBet' : 'twentyOnePlusThreeSideBet';
    if (roundResponse[responseKey] == null) {
      throw new Error(`funded ${k} absent from settle response — payload rejected silently; aborting run`);
    }
  }
}

// ── Seed-epoch discipline ────────────────────────────────────────────────────
// One rotation per 50 hands. Rotating both reveals the epoch's server seed AND
// returns the next epoch's commitment, so the chain is captured link by link:
//
//   active  -> { activeServerSeedHash, nextServerSeedHash, activeClientSeed, nonce }
//   rotate  -> { revealedServerSeed, activeServerSeedHash, nextServerSeedHash, ... }
//
// The revealed seed of epoch E is checked against the hash committed BEFORE epoch
// E was played, and the nextServerSeedHash recorded during epoch E is checked
// against the active hash of epoch E+1. Both checks are re-derived independently
// by the verifier (Steps 1 and 2) — the capture-side flags are not evidence.
async function rotateEpoch(nextClientSeed) {
  const r = await http('POST', EP.rotate, { clientSeed: nextClientSeed });
  return {
    revealedServerSeed: r.revealedServerSeed,
    hashedServerSeed: r.activeServerSeedHash,
    nextHashedServerSeed: r.nextServerSeedHash,
    clientSeed: r.activeClientSeed,
  };
}

// ── Inline verification at capture time ──────────────────────────────────────
// After each epoch was revealed, the rig immediately rebuilt every hand of that
// epoch from the revealed seed and compared it card-for-card with what had been
// dealt, so a broken chain would surface during the run rather than at analysis.
// This is a capture-side convenience check ONLY. The audit's verdict rests
// entirely on the independent re-derivation in tests/ — see
// tests/blackjack/antiCircularityTests.ts, which fails the build if any scored
// step ever reads a capture-side field.
//
//   import { blackjackShoe, commitHash } from '../src/rng.js';
//
//   const commitOk = commitHash(revealedServerSeed) === hashedServerSeed;
//   for (const hand of epochHands) {
//     const shoe = blackjackShoe(revealedServerSeed, hand.clientSeed, hand.nonce);
//     //  non-split : [p0, d0, p1, d1, ...player draws, ...dealer draws] === shoe[0..k]
//     //  split     : [main0, d0, split0, d1, main1, split1,
//     //               ...split draws, ...main draws, ...dealer draws] === shoe[0..k]
//   }

// ── Recorded per hand ────────────────────────────────────────────────────────
// The dataset schema (liqd-blackjack-capture-v1) stores, for every hand:
//   at, epoch, phase, id, nonce, clientSeed, serverSeedId, hashedServerSeed,
//   playerHands[{ cards, points, result, betAmount, winningAmount, betType }],
//   dealerHand, dealerPoints, split, doubled, actions[],
//   sideBets{ perfectPair, twentyOnePlusThree, insurance },
//   sideFunded{ perfectPair, twentyOnePlusThree },
//   sideReturned{ perfectPair, twentyOnePlusThree },
//   winningAmount, localSequence, verified
//
// ORIGIN of each of the three rig-written groups — stated rather than inferred
// from the field names (round-4 QA-08):
//
//   sideFunded    what THIS FILE's `placeBetBody` asked for on that round, i.e. a
//                 record of the rig's own REQUEST. It is a funding DECLARATION and
//                 nothing more: the capture carries no balance or delta field, so
//                 it is not evidence that a wallet was debited (declared limitation
//                 L4). Being independent of the operator's side-bet records is what
//                 makes it usable as the coverage denominator in verification
//                 Steps 15, 16 and 29 — a dropped record contradicts it instead of
//                 shrinking the denominator with itself. 5,800 rounds fund both
//                 side bets; 200 fund neither (phase E, declared `side: false`).
//   sideReturned  the result of `assertSideBetsHonoured` below: whether each funded
//                 side bet came back PRESENT in the settle response. It exists
//                 because of the singular/plural request-field trap documented
//                 above. Identical to sideFunded on all 6,000 rounds of this
//                 capture. No verification step reads it.
//   dealerHand    the FULL dealer hand as revealed at settlement, hole card
//                 included. A settled-bet record says nothing about what a live,
//                 mid-round response would expose (limitation L10).
//
// NOTE: `localSequence` and `verified` are the rig's OWN reconstruction and its
// own verdict. They are retained for provenance and debugging, and are excluded
// by construction from every scored verification step.
//
// NOTE on `serverSeedId`: the operator's opaque id for the epoch's server-seed
// record, one distinct value per epoch. The property is ABSENT — not null — on 145
// of the 6,000 rounds, exactly the insurance-winning ones. Recorded as observed;
// the cause is not established and is not guessed at. Nothing reads it; the
// seed-to-bet join is on `hashedServerSeed`.

export { EPOCH, TOTAL_HANDS, AMT_LOW, AMT_STAKE, AMT_SIDE, EP, placeBetBody, assertSideBetsHonoured, rotateEpoch };
