#!/usr/bin/env node
// ============================================================================
//  LIQD Blackjack — NEXT-CAPTURE SCRIPT (planned 2026-09-25; NOT YET RUN)
//
//  capture-blackjack.reference.mjs records the capture that produced the audited
//  dataset (data/blackjack-6000hands.json, 2026-08-05). THIS file is the script for
//  the next capture. The plan is the SAME — phases A–F, hands per phase, stakes,
//  side bets, 50 hands per seed epoch, the v1 dataset field names (v2 appends two) —
//  so a v2 dataset can replace the v1 dataset. What changes (items 7–10 added
//  before any v2 run):
//
//   1. BLACKJACK-06 (generator clause). Every epoch's client seed is drawn by
//      newClientSeed() below from node:crypto randomBytes (a CSPRNG), AFTER the
//      next-seed commitment it will be paired with was published. The dataset
//      carries the generator: meta.clientSeedGenerator (form, primitive, the
//      function's own source text, and the SHA-256 of this file), and every seed
//      record carries clientSeedGenerator, clientSeedSubmitted and the commitment
//      it was drawn after. Non-D seeds keep the executed form `audit` + 12 hex
//      (Step 7 binds them to /^audit[0-9a-f]{12}$/). Phase D seeds become
//      `pfaudit-` + 16 hex — player-set, distinct, and no longer the predictable
//      `pfaudit-<stamp>-<epoch>` that MANIFEST DL-15 discloses.
//   2. The client seed the operator reports active after each rotation must equal
//      the one submitted; the run aborts before betting if it does not.
//   3. The pre-capture anchor (meta.preCapture: active hash AND next hash, read
//      before the first bet) is REQUIRED — the run aborts if the operator does not
//      expose a next hash. v1 recorded it too; v2 adds the capture-side link flag.
//   4. Per-rotation nonceStart / nonceEnd are recorded as in v1 (unchanged).
//   5. Credentials: every object is scrubbed of credential-like keys before it is
//      written, and the serialised output is refused if it contains the cookie.
//   6. Ctrl-C finishes the current epoch and stops between epochs; --resume then continues
//      under the seed the last rotation activated, so the chain has no seam. Any resume
//      that cannot do that rotates, drops unfinished epochs, and records the seam in
//      meta.resumes[] (BLACKJACK-02 reads a capture-side seam as a FLAG, never a PASS).
//   7. INSURANCE. v1 sent `place-insurance-bet { betAmount: 0 }` on every offer,
//      meaning to decline, and logged `no-ins`; the casino booked and settled a
//      half-stake insurance bet on 446 of 446 (433 × $0.05, 13 × $5.00; MANIFEST
//      DL-17). LIQD's own UI declines with `{ acceptInsurance: false }` (evidence
//      E24, the client code read 2026-10-02). v2 sends that request and logs the
//      token `decline-ins`, so a v2 round says which request was sent; whatever
//      insurance record comes back is stored as in v1. The verifier's action
//      grammar reads `no-ins` only, so it must learn `decline-ins` before it scores
//      a v2 dataset (MANIFEST.md#limitations-and-trust, "Next capture script").
//   8. SPLIT-HAND ORDER. After a split the casino plays the SPLIT hand first, then
//      the main hand, and the main hand stays 'pending' meanwhile. v1 picked the
//      first pending hand (main), so every split-round decision was taken from the
//      main hand's cards while the casino applied it to the split hand (a replay of
//      the 401 v1 split rounds on that reading reproduces 401/401 token streams;
//      MANIFEST DL-18). v2 tracks the active hand itself (splitHandDone below).
//   9. BASIC TABLE. v1's table hit soft 13–15 where src/strategy.ts doubles (soft
//      13/14 vs 5–6, soft 15 vs 4–6; 28 v1 rounds). v2 doubles them, so the basic
//      phases play the table the audit's RTP is computed for.
//  10. WHAT THE CASINO OFFERED, AND WHAT IT CREDITED. Every decision is recorded in
//      `decisions` with the hand it was taken on, its cards and the casino's offered
//      flags (canBetInsured / canBetDoubled / canBetSplitted) — so re-split and
//      surrender availability can be read off the capture rather than assumed — and
//      the casino's double-bet records (mainDoubleBet / splitDoubleBet), which v1
//      summed into the round total without storing, are kept in `doubleBets`. A
//      second split is still not attempted (the record has two hand slots); an
//      offered one shows as canBetSplitted on a post-split decision.
//
//  Transport: LIQD_BASE (e.g. https://<host>/api/v1) and LIQD_COOKIE come from the
//  environment. Nothing is defaulted and no credential is stored in this file.
//
//  Usage (the auditor runs every capture):
//    node capture/capture-blackjack-v2.mjs --plan                          # print the plan, no network
//    LIQD_BASE=… LIQD_COOKIE=… node capture/capture-blackjack-v2.mjs --probe   # 2 hands, then stop
//    LIQD_BASE=… LIQD_COOKIE=… node capture/capture-blackjack-v2.mjs           # full capture, 6,000 hands
//    LIQD_BASE=… LIQD_COOKIE=… node capture/capture-blackjack-v2.mjs --resume  # continue after an interruption
// ============================================================================
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes, createHmac, createHash } from 'node:crypto';

const SELF = fileURLToPath(import.meta.url);
const HERE = dirname(SELF);
const OUT_DIR = join(HERE, 'out');
const CHECKPOINT = join(OUT_DIR, 'liqd-blackjack-capture-v2-checkpoint.json');
const PROBE_CHECKPOINT = join(OUT_DIR, 'liqd-blackjack-capture-v2-probe-checkpoint.json');

export const EPOCH = 50;                                        // hands per seed epoch (as v1)
export const AMT_LOW = 0.10, AMT_STAKE = 10, AMT_SIDE = 0.10;   // as v1
const CURRENCY = 'USDC', CURRENCY_ID = '2';                     // as v1
const MAX_TRANSIENT = 40, REQ_TIMEOUT = 20000, SAVE_EVERY = 10, MAX_ACTIONS = 40;
const DELAY_BET = 0, DELAY_STEP = 0, DELAY_ROTATE = 250;        // v1 defaults; the governor paces on 429

// ── 1. Client-seed generator (BLACKJACK-06) ──────────────────────────────────────
export const CLIENT_SEED_GENERATOR = {
  audit: 'audit + node:crypto randomBytes(6).toString("hex")',
  pfaudit: 'pfaudit- + node:crypto randomBytes(8).toString("hex")',
};
export function newClientSeed(tag) {
  return tag === 'pfaudit' ? `pfaudit-${randomBytes(8).toString('hex')}` : `audit${randomBytes(6).toString('hex')}`;
}

// ── Plan: identical to the executed v1 plan (reference file header) ────────────────
//   A 66 epochs basic · B 20 aggressive · C 10 splitforce · D 10 basic, player-set seeds
//   E 4 at $10, no side bets · F 10 splitforce  → 120 epochs × 50 = 6,000 hands
export const SIDE = { perfectPair: AMT_SIDE, twentyOnePlusThree: AMT_SIDE };
export function buildEpochs() {
  const epochs = [];
  const ep = (phase, seedTag, hands) => epochs.push({ phase, seedTag, hands });
  const fill = (n, amount, side, strategy) => Array.from({ length: n }, () => ({ amount, side, strategy }));
  for (let e = 0; e < 66; e++) ep('A', 'audit', fill(EPOCH, AMT_LOW, SIDE, 'basic'));
  for (let e = 0; e < 20; e++) ep('B', 'audit', fill(EPOCH, AMT_LOW, SIDE, 'aggressive'));
  for (let e = 0; e < 10; e++) ep('C', 'audit', fill(EPOCH, AMT_LOW, SIDE, 'splitforce'));
  for (let e = 0; e < 10; e++) ep('D', 'pfaudit', fill(EPOCH, AMT_LOW, SIDE, 'basic'));
  for (let e = 0; e < 4; e++) ep('E', 'audit', fill(EPOCH, AMT_STAKE, null, 'basic'));
  for (let e = 0; e < 10; e++) ep('F', 'audit', fill(EPOCH, AMT_LOW, SIDE, 'splitforce'));
  return epochs;
}
export const PHASES_META = {
  A: { hands: 3300, amount: AMT_LOW, strategy: 'basic', side: true },
  B: { hands: 1000, amount: AMT_LOW, strategy: 'aggressive', side: true },
  C: { hands: 500, amount: AMT_LOW, strategy: 'splitforce', side: true },
  D: { hands: 500, amount: AMT_LOW, strategy: 'basic', side: true, customSeeds: true },
  E: { hands: 200, amount: AMT_STAKE, strategy: 'basic', side: false },
  F: { hands: 500, amount: AMT_LOW, strategy: 'splitforce', side: true },
};

// ── Strategy (the v1 rig's strategy module, with the basic table's soft 13–15 doubles ─
//    aligned to src/strategy.ts — header item 9; every other cell is v1's) ─────────────
const rankOf = (card) => Number(card.split(':')[1]);
const cardValue = (card) => { const r = rankOf(card); return r === 1 ? 11 : r >= 10 ? 10 : r; };
const norm = (card) => { const r = rankOf(card); return r === 1 ? 'A' : r >= 10 ? '10' : String(r); };
export function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) { const v = cardValue(c); total += v; if (v === 11) aces++; }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}
const IN = (x, arr) => arr.includes(x);
export function decideAction(playerCards, dealerUpCard, { canDouble = false, canSplit = false, strategy = 'basic' } = {}) {
  const { total, soft } = handValue(playerCards);
  const du = norm(dealerUpCard);
  if (strategy === 'aggressive') { if (canSplit) return 'split'; return total < 17 ? 'hit' : 'stand'; }
  if (strategy === 'splitforce') { if (canSplit) return 'split'; if (canDouble) return 'double'; return total < 17 ? 'hit' : 'stand'; }
  if (canSplit && playerCards.length === 2) {
    const r = norm(playerCards[0]);
    let should = false;
    if (r === 'A' || r === '8') should = true;
    else if (r === '9' && !IN(du, ['7', '10', 'A'])) should = true;
    else if (r === '7' && IN(du, ['2', '3', '4', '5', '6', '7'])) should = true;
    else if (r === '6' && IN(du, ['2', '3', '4', '5', '6'])) should = true;
    else if (r === '4' && IN(du, ['5', '6'])) should = true;
    else if ((r === '3' || r === '2') && IN(du, ['2', '3', '4', '5', '6', '7'])) should = true;
    if (should) return 'split';
  }
  if (soft) {
    if (total >= 19) return 'stand';
    if (total === 18) {
      if (IN(du, ['3', '4', '5', '6'])) return canDouble ? 'double' : 'stand';
      if (IN(du, ['2', '7', '8'])) return 'stand';
      return 'hit';
    }
    if (total === 17 && IN(du, ['3', '4', '5', '6']) && canDouble) return 'double';
    if ((total === 16 || total === 15) && IN(du, ['4', '5', '6']) && canDouble) return 'double';
    if ((total === 14 || total === 13) && IN(du, ['5', '6']) && canDouble) return 'double';   // v1 hit these
    return 'hit';
  }
  if (total >= 17) return 'stand';
  if (total >= 13 && IN(du, ['2', '3', '4', '5', '6'])) return 'stand';
  if (total === 12 && IN(du, ['4', '5', '6'])) return 'stand';
  if (total === 11 && du !== 'A' && canDouble) return 'double';
  if (total === 10 && !IN(du, ['10', 'A']) && canDouble) return 'double';
  if (total === 9 && IN(du, ['3', '4', '5', '6']) && canDouble) return 'double';
  return 'hit';
}

// ── Inline reference (capture-time self-check only; the audit verifier is src/rng.ts) ──
export const commitHash = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
function pfNumber(serverSeed, clientSeed, nonce, cursor, range) {
  const key = Buffer.from(serverSeed, 'hex');
  const maxFair = Math.floor(0x1_0000_0000 / range) * range;
  for (let c = cursor; ; c += 1_000_000) {
    const d = createHmac('sha256', key).update(`${clientSeed}:${nonce}:${c}`).digest();
    for (let o = 0; o + 4 <= d.length; o += 4) { const v = d.readUInt32BE(o); if (v < maxFair) return v % range; }
  }
}
const SUITS = ['CLUB', 'HEART', 'SPADE', 'DIAMOND'];
export function blackjackShoe(serverSeed, clientSeed, nonce) {
  const a = [];
  for (let d = 0; d < 8; d++) for (const s of SUITS) for (let r = 1; r <= 13; r++) a.push(`${s}:${r}`);
  for (let i = a.length - 1; i >= 1; i--) { const j = pfNumber(serverSeed, clientSeed, nonce, i, i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function dealtSequence(playerHand, dealerHand) {
  const seq = [];
  if (playerHand?.[0]) seq.push(playerHand[0]);
  if (dealerHand?.[0]) seq.push(dealerHand[0]);
  if (playerHand?.[1]) seq.push(playerHand[1]);
  if (dealerHand?.[1]) seq.push(dealerHand[1]);
  for (let i = 2; i < (playerHand?.length || 0); i++) seq.push(playerHand[i]);
  for (let i = 2; i < (dealerHand?.length || 0); i++) seq.push(dealerHand[i]);
  return seq;
}
// Sets b.clientSeed, b.localSequence, b.verified on every hand of the epoch (as v1).
export function verifyEpochBets(bets, hashedServerSeed, revealedServerSeed, clientSeed) {
  const commitOk = !!revealedServerSeed && commitHash(revealedServerSeed) === hashedServerSeed;
  let checked = 0, bad = 0;
  for (const b of bets) {
    b.clientSeed = clientSeed;
    if (!revealedServerSeed) { b.verified = false; checked++; bad++; continue; }
    const shoe = blackjackShoe(revealedServerSeed, clientSeed, b.nonce);
    if (b.split) {
      const main = b.playerHands[0]?.cards || [], split = b.playerHands[1]?.cards || [], d = b.dealerHand || [];
      const all = [...main, ...split, ...d];
      const ms = (a) => a.slice().sort().join(',');
      const initOk = shoe[0] === main[0] && shoe[1] === d[0] && shoe[2] === split[0] && shoe[3] === d[1];
      b.localSequence = shoe.slice(0, all.length);
      b.verified = initOk && ms(all) === ms(b.localSequence);
    } else {
      const seq = dealtSequence(b.playerHands[0]?.cards, b.dealerHand);
      b.localSequence = shoe.slice(0, seq.length);
      b.verified = seq.every((c, i) => c === shoe[i]);
    }
    checked++; if (!b.verified) bad++;
  }
  return { commitOk, checked, bad };
}

// ── 5. Credential scrubbing ───────────────────────────────────────────────────────
export const CREDENTIAL_KEY = /cookie|token|authori[sz]ation|session|password|passwd|secret|api[-_]?key|jwt|bearer|csrf/i;
export function scrub(value) {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) if (!CREDENTIAL_KEY.test(k)) out[k] = scrub(v);
    return out;
  }
  return value;
}
// Every cookie value long enough to be a credential, so the output can be grepped for it.
export function cookieNeedles(cookie) {
  if (!cookie) return [];
  const parts = cookie.split(';').map((p) => p.trim()).filter(Boolean);
  const vals = parts.map((p) => p.slice(p.indexOf('=') + 1)).filter((v) => v.length >= 16);
  return [cookie, ...vals].filter((v) => v.length >= 16);
}
export function serialiseSafe(obj, cookie) {
  const text = JSON.stringify(scrub(obj), null, 2);
  for (const n of cookieNeedles(cookie)) if (text.includes(n)) throw Object.assign(new Error('refusing to write: output contains cookie material'), { kind: 'CRED' });
  return text;
}

// ── Recorded per hand (v1 field set, v1 order) ────────────────────────────────────
export function recordBet(E, phase, round, actions, hashedServerSeed, expectedNonce, sideArg, at, decisions = []) {
  const r = round || {};
  const hands = [r.mainBet, r.splitBet].filter(Boolean).map((h) => ({ cards: h.playerHand, points: h.playerPoints, result: h.result, winningAmount: h.winningAmount, betAmount: h.betAmount, betType: h.betType }));
  const win = hands.reduce((s, h) => s + Number(h.winningAmount || 0), 0)
    + Number(r.perfectPairSideBet?.winningAmount || 0) + Number(r.twentyOnePlusThreeSideBet?.winningAmount || 0)
    + Number(r.mainDoubleBet?.winningAmount || 0) + Number(r.splitDoubleBet?.winningAmount || 0) + Number(r.insuranceBet?.winningAmount || 0);
  return {
    at, epoch: E, phase, id: r.id, nonce: r.nonce ?? expectedNonce, clientSeed: undefined, serverSeedId: r.serverSeedId,
    hashedServerSeed, playerHands: hands, dealerHand: r.dealerHand, dealerPoints: r.dealerPoints,
    split: hands.length > 1, doubled: !!(r.mainDoubleBet || r.splitDoubleBet), actions,
    sideBets: { perfectPair: r.perfectPairSideBet || null, twentyOnePlusThree: r.twentyOnePlusThreeSideBet || null, insurance: r.insuranceBet || null },
    sideFunded: { perfectPair: !!(sideArg && sideArg.perfectPair), twentyOnePlusThree: !!(sideArg && sideArg.twentyOnePlusThree) },
    sideReturned: { perfectPair: !!r.perfectPairSideBet, twentyOnePlusThree: !!r.twentyOnePlusThreeSideBet },
    winningAmount: win, localSequence: null, verified: null,
    // v2 additions (header item 10), after the v1 keys: the casino's own double-bet credit records,
    // and every decision with the hand it was taken on and what the casino offered at that moment.
    doubleBets: { main: r.mainDoubleBet || null, split: r.splitDoubleBet || null },
    decisions,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
//  Everything below touches the network and runs only when this file is executed.
// ════════════════════════════════════════════════════════════════════════════════
const argv = process.argv.slice(2);
const PLAN = argv.includes('--plan'), PROBE = argv.includes('--probe'), RESUME = argv.includes('--resume');
const BASE = (process.env.LIQD_BASE || '').replace(/\/+$/, '');
const COOKIE = process.env.LIQD_COOKIE || '';
const EPOCHS = buildEpochs();
const TOTAL_HANDS = EPOCHS.reduce((s, e) => s + e.hands.length, 0);
const EP = {
  active: '/fast-games/provably-fair/active',
  rotate: '/fast-games/provably-fair/rotate',
  place: '/fast-games/blackjack-game/place-bet',
  hit: '/fast-games/blackjack-game/hit',
  stand: '/fast-games/blackjack-game/stand',
  double: '/fast-games/blackjack-game/place-double-bet',
  split: '/fast-games/blackjack-game/place-split-bet',
  insurance: '/fast-games/blackjack-game/place-insurance-bet',
  unfinished: '/fast-games/blackjack-game/get-unfinished-bet',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const STOP = { requested: false, now: false, count: 0 };

// Adaptive pacing (as v1): a 429 engages a doubling floor that decays after 50 clean calls.
const gov = { floor: 0, clean: 0, hits: 0 };
const govPenalise = () => { gov.floor = Math.min(gov.floor ? gov.floor * 2 : 250, 4000); gov.clean = 0; gov.hits++; console.log(`  server pushed back (429 #${gov.hits}) — pacing floor ${gov.floor}ms`); };
const govReward = () => { if (!gov.floor || ++gov.clean < 50) return; gov.clean = 0; gov.floor = gov.floor <= 250 ? 0 : Math.floor(gov.floor / 2); };
const pace = (ms) => { const w = Math.max(ms, gov.floor); return w > 0 ? sleep(w) : Promise.resolve(); };

class HttpError extends Error { constructor(m, k, code) { super(m); this.kind = k; this.code = code; } }
async function http(method, path, body) {
  const origin = new URL(BASE).origin;
  const headers = { Accept: 'application/json', Cookie: COOKIE, Origin: origin, Referer: `${origin}/originals/blackjack` };
  if (body) headers['Content-Type'] = 'application/json';
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), REQ_TIMEOUT);
  let res, text;
  try { res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal }); text = await res.text(); }
  catch (e) { throw new HttpError('network ' + (e.name === 'AbortError' ? 'timeout' : (e.cause?.code || e.message)), 'TRANSIENT'); }
  finally { clearTimeout(to); }
  if (res.status === 401 || res.status === 403) throw new HttpError(`${res.status} auth rejected`, 'AUTH');
  if (/Cloudflare Access|<!DOCTYPE html|<html/i.test(text)) throw new HttpError('HTML sign-in page — cookie expired', 'AUTH');
  if (res.status === 429) { govPenalise(); throw new HttpError('429 rate limited', 'TRANSIENT'); }
  if (res.status >= 500) throw new HttpError(`${res.status} server error`, 'TRANSIENT');
  govReward();
  let json; try { json = JSON.parse(text); } catch { throw new HttpError(`${res.status} non-JSON response`, 'TRANSIENT'); }
  if (json && Array.isArray(json.errors) && json.errors.length) {
    const code = json.errors[0]?.errorCode;
    throw new HttpError('api error: ' + JSON.stringify(json.errors).slice(0, 160), code === 3116 ? 'TRANSIENT' : 'API', code);
  }
  return json && json.data !== undefined ? json.data : json;
}
async function retry(fn, label) {
  for (let attempt = 1; ; attempt++) {
    try { return await fn(); }
    catch (e) {
      if (e.kind === 'AUTH' || e.kind === 'API') throw e;
      if (attempt >= MAX_TRANSIENT) throw new HttpError(`${label} failed after ${attempt} retries: ${e.message}`, 'TRANSIENT');
      const wait = Math.min(2000 * attempt, 30000); console.log(`  ${label}: ${e.message.slice(0, 40)} — retry ${attempt} in ${wait / 1000}s`); await sleep(wait);
    }
  }
}
async function stepCall(fn, label) {
  for (let a = 1; ; a++) {
    try { return await fn(); }
    catch (e) {
      if (e.kind === 'AUTH' || (e.kind === 'API' && e.code !== 3116) || a >= MAX_TRANSIENT) throw e;
      await sleep(Math.min(400 * a, 6000));
      if (a % 5 === 0) console.log(`  ${label} retry ${a} (${String(e.message).slice(0, 36)})`);
    }
  }
}
const pick = (o, ...k) => { for (const x of k) if (o && o[x] != null) return o[x]; return undefined; };
const readSeedState = (a) => ({
  hashedServerSeed: pick(a, 'activeServerSeedHash', 'hashedServerSeed'),
  nextHashedServerSeed: pick(a, 'nextServerSeedHash', 'nextHashedServerSeed'),
  clientSeed: pick(a, 'activeClientSeed', 'clientSeed'), nonce: pick(a, 'nonce'),
  revealedServerSeed: pick(a, 'revealedServerSeed', 'serverSeed'),
});
const getActive = async () => readSeedState(await http('GET', EP.active));
const rotateRaw = async (clientSeed) => readSeedState(await http('POST', EP.rotate, { clientSeed }));

// ── Round play (as v1, except header items 7, 8 and 10) ────────────────────────────
const extract = (d) => ({ round: d && d.round != null ? d.round : (d && d.mainBet ? d : null), canIns: !!(d && d.canBetInsured), canDbl: !!(d && d.canBetDoubled), canSpl: !!(d && d.canBetSplitted) });
// The hand the casino is playing (header item 8). After a split it plays the split hand first; the
// main hand stays 'pending' while the split hand is played, so `result` cannot say which is active and v1's
// first-pending-hand rule picked the main hand throughout. A hand ends on stand, double, bust, or on
// reaching 21 with a drawn card; a two-card 21 on a split hand waits for an action.
export function splitHandDone(cards, lastAction) {
  const { total } = handValue(cards || []);
  return lastAction === 'stand' || lastAction === 'double' || total > 21 || (total === 21 && (cards || []).length > 2);
}
const activeHand = (round, splitDone) => {
  if (!round || isSettled(round)) return null;
  if (round.splitBet && !splitDone) return round.splitBet;
  return round.mainBet || null;
};
const isSettled = (round) => { if (!round) return true; const h = [round.mainBet, round.splitBet].filter(Boolean); return h.length > 0 && h.every((x) => x.result && x.result !== 'pending'); };
async function finishAnyOpenHand() {
  for (let guard = 0; guard < MAX_ACTIONS; guard++) {
    const u = extract(await stepCall(() => http('GET', EP.unfinished), 'unfinished'));
    if (!u.round || isSettled(u.round)) return !!u.round && guard > 0;
    if (u.canIns) { await stepCall(() => http('POST', EP.insurance, { acceptInsurance: false }), 'insurance'); continue; }
    await stepCall(() => http('POST', EP.stand, undefined), 'stand');
  }
  return true;
}
async function placeBet(amount, side, clientSeed) {
  const body = { betAmount: amount, currencyId: CURRENCY_ID, clientSeed };
  // Request field names: perfectPairsBetAmount (PLURAL) and twentyOnePlusThreeBetAmount — see the reference file.
  if (side) {
    if (side.perfectPair) body.perfectPairsBetAmount = side.perfectPair;
    if (side.twentyOnePlusThree) body.twentyOnePlusThreeBetAmount = side.twentyOnePlusThree;
  }
  for (let attempt = 0; ; attempt++) {
    try { return extract(await stepCall(() => http('POST', EP.place, body), 'place-bet')); }
    catch (e) { if (e.code === 3103 && attempt < 3) { await finishAnyOpenHand().catch(() => {}); continue; } throw e; }
  }
}
async function playHand(amount, side, clientSeed, strategy) {
  let cur = await placeBet(amount, side, clientSeed);
  const actions = [];
  const decisions = [];
  let splitDone = false;
  for (let guard = 0; guard < MAX_ACTIONS; guard++) {
    if (!cur.round) { const u = extract(await stepCall(() => http('GET', EP.unfinished), 'unfinished')); if (!u.round) break; cur = u; }
    if (isSettled(cur.round)) break;
    if (cur.canIns) {
      actions.push('decline-ins');   // LIQD's UI decline (header item 7); v1 sent { betAmount: 0 } as no-ins
      decisions.push({ hand: 'insurance', cards: cur.round?.mainBet?.playerHand || null, offered: { insurance: cur.canIns, double: cur.canDbl, split: cur.canSpl }, action: 'decline-ins' });
      const resp = extract(await stepCall(() => http('POST', EP.insurance, { acceptInsurance: false }), 'insurance'));
      const fresh = extract(await stepCall(() => http('GET', EP.unfinished), 'unfinished'));
      cur = fresh.round ? fresh : resp;
      continue;
    }
    const hand = activeHand(cur.round, splitDone);
    if (!hand) break;
    const onSplit = !!cur.round.splitBet && hand === cur.round.splitBet;
    const dec = decideAction(hand.playerHand, cur.round.dealerHand[0], { canDouble: cur.canDbl, canSplit: cur.canSpl && !cur.round.splitBet, strategy });
    actions.push(dec);
    decisions.push({ hand: onSplit ? 'split' : 'main', cards: hand.playerHand, offered: { insurance: cur.canIns, double: cur.canDbl, split: cur.canSpl }, action: dec });
    const path = dec === 'stand' ? EP.stand : dec === 'double' ? EP.double : dec === 'split' ? EP.split : EP.hit;
    cur = extract(await stepCall(() => http('POST', path, undefined), dec));
    if (onSplit && splitHandDone(cur.round?.splitBet?.playerHand, dec)) splitDone = true;
    await pace(DELAY_STEP);
  }
  return { round: cur.round, actions, decisions };
}

// ── Dataset ────────────────────────────────────────────────────────────────────────
function freshDataset(plannedTotal) {
  return {
    meta: {
      audit: 'liqd Blackjack', platform: BASE ? new URL(BASE).host : null, gameId: 'fast-games-11', schema: 'liqd-blackjack-capture-v2',
      houseEdge: 0.01, currency: CURRENCY, decks: 8, epochSize: EPOCH, plannedTotal,
      payout: { blackjack: '3:2', insurance: '2:1', perfectPairs: { perfect: 25, colored: 13, mixed: 6 }, twentyOnePlusThree: { flush: 5, straight: 10, threeOfAKind: 30, straightFlush: 40, suitedTrips: 100 } },
      phases: PHASES_META,
      clientSeedGenerator: {
        ...CLIENT_SEED_GENERATOR,
        primitive: 'node:crypto randomBytes (CSPRNG)',
        drawnAfter: 'each epoch seed is drawn after the nextHashedServerSeed it is paired with was published, and submitted on the rotation that activates that seed',
        source: newClientSeed.toString(),
        script: 'capture/capture-blackjack-v2.mjs',
        scriptSha256: createHash('sha256').update(readFileSync(SELF)).digest('hex'),
      },
      insuranceRequest: 'place-insurance-bet { acceptInsurance: false } on every offer — LIQD\'s own UI decline (evidence E24); action token decline-ins. v1 sent { betAmount: 0 } (token no-ins), which the casino booked as a half-stake insurance bet on 446 of 446 offers (MANIFEST DL-17)',
      startedAt: null, finishedAt: null, progress: {}, preCapture: null, resumes: [], lastRotation: null,
    },
    seeds: [], bets: [],
  };
}
let dataset = freshDataset(TOTAL_HANDS);
function save(file = PROBE ? PROBE_CHECKPOINT : CHECKPOINT) {
  mkdirSync(OUT_DIR, { recursive: true });
  Object.assign(dataset.meta.progress, { savedAt: now(), bets: dataset.bets.length, seeds: dataset.seeds.length });
  writeFileSync(file, serialiseSafe(dataset, COOKIE));
}

// A rotation: draw the next client seed from the CSPRNG, submit it, and require it back.
// The rotation is remembered in meta.lastRotation so a --resume can continue under the seed it
// activated (no seam) when nothing was played under it.
async function rotateWithFreshSeed(tag, drawnAfter) {
  const submitted = newClientSeed(tag);
  const r = await retry(() => rotateRaw(submitted), 'rotate');
  const cur = { ...r, submitted, tag };   // honoured-or-not is checked in openSeed, before any bet under it
  dataset.meta.lastRotation = { at: now(), tag, submitted, drawnAfter: drawnAfter ?? null, hashedServerSeed: r.hashedServerSeed ?? null, nextHashedServerSeed: r.nextHashedServerSeed ?? null, clientSeed: r.clientSeed ?? null };
  return cur;
}
function openSeed(E, epc, cur, drawnAfter) {
  if (cur.clientSeed !== cur.submitted) throw new HttpError(`epoch ${E}: operator reports active client seed ${cur.clientSeed}, submitted ${cur.submitted} — not honoured; no bet placed under it`, 'API');
  dataset.seeds[E] = {
    epoch: E, phase: epc.phase, at: now(), clientSeed: cur.clientSeed, hashedServerSeed: cur.hashedServerSeed,
    nextHashedServerSeed: cur.nextHashedServerSeed, serverSeed: null, nonceStart: cur.nonce ?? 0, nonceEnd: null,
    commitVerified: null, chainLinkOk: null,
    clientSeedSubmitted: cur.submitted, clientSeedGenerator: CLIENT_SEED_GENERATOR[cur.tag], clientSeedDrawnAfterNextHash: drawnAfter,
  };
}
function closeSeed(E, next) {
  const sd = dataset.seeds[E];
  const bets = dataset.bets.filter((b) => b.epoch === E);
  sd.serverSeed = next.revealedServerSeed ?? null;
  sd.nonceEnd = bets.length ? bets[bets.length - 1].nonce : null;
  const v = verifyEpochBets(bets, sd.hashedServerSeed, sd.serverSeed, sd.clientSeed);
  sd.chainLinkOk = sd.nextHashedServerSeed != null ? sd.nextHashedServerSeed === next.hashedServerSeed : null;
  sd.commitVerified = v.commitOk && v.bad === 0;
  console.log(`  epoch ${String(E).padStart(3)} [${sd.phase}] commit ${v.commitOk ? 'OK' : 'FAIL'}  chain ${sd.chainLinkOk === null ? 'n/a' : sd.chainLinkOk ? 'OK' : 'FAIL'}  recompute ${v.checked - v.bad}/${v.checked}  nonce ${sd.nonceStart}…${sd.nonceEnd}`);
  if (sd.chainLinkOk === false) console.log(`  CHAIN BROKEN at epoch ${E}`);
  return v;
}
function sideGuard(L) {
  for (const k of ['perfectPair', 'twentyOnePlusThree']) if (L.sideFunded[k] && !L.sideReturned[k]) throw new HttpError(`side bet '${k}' FUNDED but ABSENT from the settle — request field ignored. Stopping.`, 'API');
}

// ── 3. Pre-capture anchor: read before any bet, required ────────────────────────────
async function anchor(firstTag) {
  if (await retry(() => finishAnyOpenHand(), 'finish-open')) console.log('  resolved a leftover open hand before the anchor');
  const pre = await retry(() => getActive(), 'active');
  if (!pre.hashedServerSeed || !pre.nextHashedServerSeed) throw new HttpError('operator exposes no active/next hash before epoch 0 — the pre-capture anchor cannot be recorded', 'ANCHOR');
  dataset.meta.preCapture = { at: now(), hashedServerSeed: pre.hashedServerSeed, clientSeed: pre.clientSeed, nonce: pre.nonce, nextHashedServerSeed: pre.nextHashedServerSeed, revealedServerSeed: null, commitVerified: null, anchorLinkOk: null };
  save();   // the anchor is on disk before the first bet
  const cur = await rotateWithFreshSeed(firstTag, pre.nextHashedServerSeed);
  const p = dataset.meta.preCapture;
  p.revealedServerSeed = cur.revealedServerSeed ?? null;
  p.commitVerified = !!p.revealedServerSeed && commitHash(p.revealedServerSeed) === p.hashedServerSeed;
  p.anchorLinkOk = p.nextHashedServerSeed === cur.hashedServerSeed;
  console.log(`  pre-capture anchor: commit ${p.commitVerified ? 'OK' : 'FAIL'}  next-hash → epoch 0 ${p.anchorLinkOk ? 'OK' : 'FAIL'}`);
  if (!p.commitVerified || !p.anchorLinkOk) throw new HttpError('pre-capture anchor did not verify — stopping before the first bet', 'ANCHOR');
  return { cur, drawnAfter: pre.nextHashedServerSeed };
}

async function runEpochs(epochs, startEpoch, cur, drawnAfter) {
  let placed = dataset.bets.length; const t0 = Date.now(), done0 = placed;
  for (let E = startEpoch; E < epochs.length; E++) {
    const epc = epochs[E];
    // Ctrl-C is honoured only here, between epochs: every played epoch is complete and revealed,
    // and the seed just activated has had no bet, so --resume continues under it without a seam.
    if (STOP.requested) throw new HttpError(`stopped cleanly before epoch ${E}`, 'STOP');
    openSeed(E, epc, cur, drawnAfter);
    for (let j = 0; j < epc.hands.length; j++) {
      if (STOP.now) throw new HttpError(`stopped mid-epoch ${E} after ${j} hands`, 'INTERRUPT');
      const { amount, side, strategy } = epc.hands[j];
      const { round, actions, decisions } = await playHand(amount, side, cur.clientSeed, strategy);
      if (!round) throw new HttpError(`epoch ${E} hand ${j}: no settled round returned`, 'API');
      const L = recordBet(E, epc.phase, round, actions, cur.hashedServerSeed, (dataset.seeds[E].nonceStart ?? 0) + j, side, now(), decisions);
      dataset.bets.push(L);
      sideGuard(L);
      placed++;
      if (placed % SAVE_EVERY === 0) save();
      if (placed % 100 === 0) { const rate = (placed - done0) / Math.max(0.001, (Date.now() - t0) / 1000); console.log(`  ${placed}/${dataset.meta.plannedTotal} [${epc.phase}] ${rate.toFixed(1)}/s  ETA ${Math.round((dataset.meta.plannedTotal - placed) / Math.max(rate, 0.01) / 60)} min`); }
      await pace(DELAY_BET);
    }
    await pace(DELAY_ROTATE);
    drawnAfter = cur.nextHashedServerSeed;   // the next epoch's seed is drawn after THIS was published
    const next = await rotateWithFreshSeed(epochs[E + 1]?.seedTag ?? 'audit', drawnAfter);
    closeSeed(E, next);
    save();
    cur = next;
  }
}

async function runProbe() {
  // 2 hands at the minimum main stake ($0.10), side bets funded (confirms the request field names),
  // split-force so a split/double payload is exercised if the cards allow, then reveal and stop.
  dataset = freshDataset(2);
  dataset.meta.probe = true;
  const epochs = [{ phase: 'A', seedTag: 'audit', hands: [{ amount: AMT_LOW, side: SIDE, strategy: 'splitforce' }, { amount: AMT_LOW, side: SIDE, strategy: 'splitforce' }] }];
  dataset.meta.startedAt = now();
  const { cur, drawnAfter } = await anchor('audit');
  await runEpochs(epochs, 0, cur, drawnAfter);
  dataset.meta.finishedAt = now();
  const file = join(OUT_DIR, 'liqd-blackjack-capture-v2-PROBE.json');
  save(file);
  const sd = dataset.seeds[0], p = dataset.meta.preCapture;
  console.log('\n── PROBE RESULT ──');
  console.log(`  pre-capture anchor : hash ${p.hashedServerSeed?.slice(0, 16)}…  next ${p.nextHashedServerSeed?.slice(0, 16)}…  commit ${p.commitVerified}  link ${p.anchorLinkOk}`);
  console.log(`  epoch 0 client seed: submitted ${sd.clientSeedSubmitted}  active ${sd.clientSeed}  generator "${sd.clientSeedGenerator}"`);
  console.log(`  nonce window       : ${sd.nonceStart}…${sd.nonceEnd}   commit ${sd.commitVerified}  chain ${sd.chainLinkOk}`);
  for (const b of dataset.bets) console.log(`  hand n=${b.nonce} [${b.actions.join(',')}] player=${JSON.stringify(b.playerHands.map((h) => h.cards))} dealer=[${(b.dealerHand || []).join(' ')}] verified=${b.verified} side funded/returned PP ${b.sideFunded.perfectPair}/${b.sideReturned.perfectPair} 21+3 ${b.sideFunded.twentyOnePlusThree}/${b.sideReturned.twentyOnePlusThree} ins=${b.sideBets.insurance?.betAmount ?? '-'}`);
  const ok = p.commitVerified && p.anchorLinkOk && sd.commitVerified && sd.chainLinkOk && sd.clientSeed === sd.clientSeedSubmitted && dataset.bets.every((b) => b.verified);
  console.log(ok ? '\n  GREEN — the full capture can start.' : '\n  NOT GREEN — do not start the full capture; inspect the lines above.');
  console.log(`  saved ${file}`);
}

async function runCapture() {
  let startEpoch = 0, cur, drawnAfter;
  if (RESUME && existsSync(CHECKPOINT)) {
    dataset = JSON.parse(readFileSync(CHECKPOINT, 'utf8'));
    // Keep only epochs that were played in full AND revealed; anything after is dropped and
    // re-played under a fresh seed. The seam is recorded, never hidden (BLACKJACK-02: FLAG, origin capture).
    let keep = 0;
    while (keep < dataset.seeds.length && dataset.seeds[keep].serverSeed != null && dataset.bets.filter((b) => b.epoch === keep).length === EPOCHS[keep].hands.length) keep++;
    const dropped = dataset.bets.filter((b) => b.epoch >= keep);
    const droppedSeeds = dataset.seeds.slice(keep).map((s) => ({ epoch: s.epoch, hashedServerSeed: s.hashedServerSeed, serverSeed: s.serverSeed, hands: dropped.filter((b) => b.epoch === s.epoch).length }));
    dataset.seeds = dataset.seeds.slice(0, keep);
    dataset.bets = dataset.bets.filter((b) => b.epoch < keep);
    if (await retry(() => finishAnyOpenHand(), 'finish-open')) console.log('  resolved a leftover open hand');
    const before = await retry(() => getActive(), 'active');
    const last = dataset.meta.lastRotation, prev = dataset.seeds[keep - 1];
    // Seamless continuation: the active seed is the one the last recorded rotation activated, it is
    // the commitment the last kept epoch published, it carries our submitted seed for the right phase,
    // and nothing has been played under it.
    const seamless = !!last && !dropped.length && !!prev && before.hashedServerSeed === last.hashedServerSeed
      && prev.nextHashedServerSeed === before.hashedServerSeed && before.clientSeed === last.submitted
      && last.tag === EPOCHS[keep].seedTag && (before.nonce ?? 0) === 0;
    if (seamless) {
      cur = { ...before, submitted: last.submitted, tag: last.tag };
      drawnAfter = last.drawnAfter;
      dataset.meta.resumes.push({ at: now(), resumedAtEpoch: keep, seam: false });
      console.log(`  RESUME at epoch ${keep}: continuing under the seed the last rotation activated — no seam`);
    } else {
      cur = await rotateWithFreshSeed(EPOCHS[keep].seedTag, before.nextHashedServerSeed);   // reveal whatever was active, start clean at nonce 0
      drawnAfter = before.nextHashedServerSeed;
      dataset.meta.resumes.push({ at: now(), resumedAtEpoch: keep, seam: true, droppedSeeds, droppedHands: dropped.length,
        revealedOnResume: { hashedServerSeed: before.hashedServerSeed, revealedServerSeed: cur.revealedServerSeed ?? null, nonce: before.nonce ?? null } });
      console.log(`  RESUME at epoch ${keep}: SEAM — ${dropped.length} hands of unfinished epochs dropped, active seed rotated out; recorded in meta.resumes`);
    }
    startEpoch = keep;
  } else {
    if (RESUME) console.log('  no checkpoint — starting fresh');
    dataset.meta.startedAt = now();
    ({ cur, drawnAfter } = await anchor(EPOCHS[0].seedTag));
  }
  console.log(`\n── CAPTURE ── ${TOTAL_HANDS} hands · ${EPOCHS.length} epochs · ${EPOCH}/seed (plan identical to 2026-08-05)`);
  await runEpochs(EPOCHS, startEpoch, cur, drawnAfter);
  dataset.meta.progress.status = dataset.bets.length >= TOTAL_HANDS ? 'completed' : 'partial';
  dataset.meta.finishedAt = now();
  const file = join(OUT_DIR, `liqd-blackjack-capture-v2-${dataset.bets.length}hands.json`);
  save(file); save();
  const failed = dataset.bets.filter((b) => b.verified !== true).length, broken = dataset.seeds.filter((s) => s.chainLinkOk === false).length;
  const byPhase = {}; for (const b of dataset.bets) byPhase[b.phase] = (byPhase[b.phase] || 0) + 1;
  console.log(`\n── DONE ── ${dataset.bets.length}/${TOTAL_HANDS} hands ${JSON.stringify(byPhase)}  epochs ${dataset.seeds.length}  chain breaks ${broken}  unverified hands ${failed}  resumes ${dataset.meta.resumes.length}`);
  console.log(`  dataset: ${file}`);
}

// Reveal the open epoch on interrupt/fatal so its hands stay verifiable (as v1).
async function closeout(reason) {
  const E = dataset.seeds.length - 1;
  const sd = dataset.seeds[E];
  if (sd && sd.serverSeed == null && dataset.bets.some((b) => b.epoch === E)) {
    try {
      console.log(`\nCloseout (${reason}): revealing epoch ${E}`);
      await finishAnyOpenHand().catch(() => {});
      closeSeed(E, await rotateWithFreshSeed(EPOCHS[E]?.seedTag ?? 'audit', sd.nextHashedServerSeed));
    } catch (e) { console.log(`  closeout reveal failed: ${e.message}`); }
  }
  try { save(); } catch (e) { console.log(`  checkpoint not written: ${e.message}`); }
}

async function main() {
  console.log(`LIQD Blackjack next capture (v2) — ${TOTAL_HANDS} hands, ${EPOCHS.length} epochs`);
  if (PLAN) {
    for (const [i, e] of EPOCHS.entries()) if (i === 0 || EPOCHS[i - 1].phase !== e.phase) {
      const n = EPOCHS.filter((x) => x.phase === e.phase).length;
      console.log(`  epochs ${i}–${i + n - 1}: phase ${e.phase}  ${n * EPOCH} hands  $${e.hands[0].amount}${e.hands[0].side ? ' + side bets' : ''}  ${e.hands[0].strategy}  seed ${CLIENT_SEED_GENERATOR[e.seedTag]}`);
    }
    return;
  }
  if (!BASE || !COOKIE) { console.error('LIQD_BASE and LIQD_COOKIE must be set (no defaults).'); process.exit(2); }
  // First Ctrl-C: finish the current epoch (≤ 50 hands), rotate, save, stop. Second: stop after the
  // current hand and reveal the partial epoch (that epoch is dropped and re-played on --resume — a seam).
  process.on('SIGINT', () => {
    STOP.count++;
    if (STOP.count === 1) { STOP.requested = true; console.log('\n  Ctrl-C: finishing this epoch, then stopping cleanly (Ctrl-C again to stop after this hand; a third time kills).'); }
    else if (STOP.count === 2) { STOP.now = true; console.log('\n  Ctrl-C x2: stopping after this hand; the partial epoch will be revealed and re-played on --resume.'); }
    else process.exit(1);
  });
  try { if (PROBE) await runProbe(); else await runCapture(); }
  catch (e) {
    if (e.kind === 'STOP') { save(); console.log(`\n  ${e.message}. Resume with --resume.`); process.exit(0); }
    console.error(`\nFATAL (${e.kind ?? 'error'}): ${e.message}`);
    if (e.kind !== 'ANCHOR' && e.kind !== 'CRED') await closeout(e.kind ?? 'fatal');
    const betsPlaced = dataset.bets.length > 0;
    console.error(e.kind === 'AUTH' ? 'Refresh LIQD_COOKIE, then run with --resume.' : betsPlaced ? 'Inspect, then --resume.' : 'No bet was placed. Fix the cause and start again (no --resume needed).');
    process.exit(1);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
