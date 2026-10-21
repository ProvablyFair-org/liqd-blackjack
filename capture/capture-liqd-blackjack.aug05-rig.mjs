#!/usr/bin/env node
// ============================================================================
//  liqd Blackjack — terminal capture rig  (multi-step: place → hit/stand/double → settle)
//  Run:  source ./set-cookie.sh  &&  npm run probe  →  npm run capture
// ============================================================================
//
//  Algorithm (reverse-engineered + validated — see rng.mjs / PHASE0-FINDINGS.md):
//    8-deck (416) shoe, backward in-place Fisher-Yates, cursor=i range=i+1, same HMAC
//    core as Mines (key=bytes(serverSeed hex), msg=`clientSeed:nonce:cursor`, uint32
//    rejection). Deal PDPD: player=shoe[0],shoe[2]; dealer=shoe[1],shoe[3]; draws shoe[4:].
//
//  Play: basic strategy (S17). Insurance always declined. Double per basic strategy.
//    Split is OFF by default (ENABLE_SPLIT) — enable only after the probe confirms its
//    payload. Side bets (Perfect Pairs + 21+3) only in Phase D.
//
//  Endpoints (place-bet/hit/stand confirmed live; double/split/insurance/side-bet
//  payloads are best-guess and MUST be confirmed by `npm run probe` before a full run):
//    place-bet { betAmount, currencyId:'2' [, perfectPairBetAmount, twentyOnePlusThreeBetAmount] }
//    hit / stand / place-double-bet / place-split-bet   (session round, no body)
//    get-unfinished-bet  → { round:{ dealerHand, mainBet{playerHand,result,...}, ... }, canBet* }
//
//  Each epoch's seed is revealed on rotation; every hand's full card sequence
//  [p0,d0,p1,d1, player-hits…, dealer-draws…] is recomputed from the revealed seed
//  and matched against shoe[0..k] → self-verifying.
// ============================================================================

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { blackjackShoe, commitHash } from './rng.mjs';
import { decideAction, handValue } from './strategy.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, 'outputs');
const CHECKPOINT = join(OUT_DIR, 'blackjack-capture-checkpoint.json');

// ── CLI ───────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (n, d) => { const h = argv.find((a) => a === `--${n}` || a.startsWith(`--${n}=`)); if (!h) return d; const eq = h.indexOf('='); return eq === -1 ? true : h.slice(eq + 1); };
const PROBE = !!flag('probe', false);
const RESUME = !!flag('resume', false);
const DEMO = !!flag('demo', false);
const ENABLE_DOUBLE = flag('no-double', false) ? false : true;
let ENABLE_SPLIT = flag('no-split', false) ? false : true;   // confirmed on probe; --no-split to disable
const CURRENCY = 'USDC', CURRENCY_ID = '2';
// Pacing defaults to 0 — run as fast as the server allows. The adaptive governor
// below engages only if the server actually pushes back. Override with
// --delay=N --step-delay=N --rotate-delay=N if a run needs hand-held pacing.
const DELAY_BET = Number(flag('delay', 0));        // ms after each settled hand
const DELAY_STEP = Number(flag('step-delay', 0));  // ms between actions within a hand
const DELAY_ROTATE = Number(flag('rotate-delay', 250));
const TOTAL_OVERRIDE = flag('total', null);

const EPOCH = 50;
const AMT_LOW = 0.10, AMT_STAKE = 10, AMT_SIDE = 0.10;
const MAX_TRANSIENT = 40, REQ_TIMEOUT = 20000, SAVE_EVERY = 10, MAX_ACTIONS = 40;

const BASE = 'https://qa.liqd.com/api/v1';
const EP = {
  active: `${BASE}/fast-games/provably-fair/active`,
  rotate: `${BASE}/fast-games/provably-fair/rotate`,
  place: `${BASE}/fast-games/blackjack-game/place-bet`,
  hit: `${BASE}/fast-games/blackjack-game/hit`,
  stand: `${BASE}/fast-games/blackjack-game/stand`,
  double: `${BASE}/fast-games/blackjack-game/place-double-bet`,
  split: `${BASE}/fast-games/blackjack-game/place-split-bet`,
  insurance: `${BASE}/fast-games/blackjack-game/place-insurance-bet`,
  unfinished: `${BASE}/fast-games/blackjack-game/get-unfinished-bet`,
};
const COOKIE = process.env.LIQD_COOKIE || '';
const STAMP = Date.now();

// ── Plan: epochs of ≤50 hands. Each hand = { amount, side, strategy } ──────────────
// Mirrors the Duel Blackjack audit standard: 6,000 hands, 6 phases (A–F), side bets on
// every phase except E (bet-size invariance). Amounts use liqd's $0.10 min bet.
const SIDE = { perfectPair: AMT_SIDE, twentyOnePlusThree: AMT_SIDE };
function buildEpochs() {
  const epochs = [];
  const ep = (phase, seedTag, hands) => epochs.push({ phase, seedTag, hands });
  const fill = (n, amount, side, strategy) => Array.from({ length: n }, () => ({ amount, side, strategy }));
  for (let e = 0; e < 66; e++) ep('A', 'audit', fill(EPOCH, AMT_LOW, SIDE, 'basic'));       // A  3,300 basic
  for (let e = 0; e < 20; e++) ep('B', 'audit', fill(EPOCH, AMT_LOW, SIDE, 'aggressive'));   // B  1,000 aggressive
  for (let e = 0; e < 10; e++) ep('C', 'audit', fill(EPOCH, AMT_LOW, SIDE, 'splitforce'));   // C    500 split-force
  for (let e = 0; e < 10; e++) ep('D', 'pfaudit', fill(EPOCH, AMT_LOW, SIDE, 'basic'));      // D    500 custom seeds (10×50)
  for (let e = 0; e < 4; e++) ep('E', 'audit', fill(EPOCH, AMT_STAKE, null, 'basic'));       // E    200 stake-invariance, no side
  for (let e = 0; e < 10; e++) ep('F', 'audit', fill(EPOCH, AMT_LOW, SIDE, 'splitforce'));   // F    500 multi-split
  return epochs;
}
function buildSmoke(total) {
  const epochs = []; let made = 0;
  while (made < total) { const n = Math.min(EPOCH, total - made); epochs.push({ phase: 'A', seedTag: 'audit', hands: Array.from({ length: n }, () => ({ amount: AMT_LOW, side: SIDE, strategy: 'basic' })) }); made += n; }
  return epochs;
}
let EPOCHS = TOTAL_OVERRIDE != null ? buildSmoke(Number(TOTAL_OVERRIDE)) : buildEpochs();
const TOTAL_HANDS = EPOCHS.reduce((s, e) => s + e.hands.length, 0);

// ── Dataset ─────────────────────────────────────────────────────────────────────
let dataset = {
  meta: {
    audit: 'liqd Blackjack', platform: 'qa.liqd.com', gameId: 'fast-games-11', schema: 'liqd-blackjack-capture-v1',
    houseEdge: 0.01, currency: CURRENCY, decks: 8, epochSize: EPOCH, plannedTotal: TOTAL_HANDS,
    payout: { blackjack: '3:2', insurance: '2:1', perfectPairs: { perfect: 25, colored: 13, mixed: 6 }, twentyOnePlusThree: { flush: 5, straight: 10, threeOfAKind: 30, straightFlush: 40, suitedTrips: 100 } },
    phases: {
      A: { hands: 3300, amount: AMT_LOW, strategy: 'basic', side: true },
      B: { hands: 1000, amount: AMT_LOW, strategy: 'aggressive', side: true },
      C: { hands: 500, amount: AMT_LOW, strategy: 'splitforce', side: true },
      D: { hands: 500, amount: AMT_LOW, strategy: 'basic', side: true, customSeeds: true },
      E: { hands: 200, amount: AMT_STAKE, strategy: 'basic', side: false },
      F: { hands: 500, amount: AMT_LOW, strategy: 'splitforce', side: true },
    },
    startedAt: null, finishedAt: null, progress: {}, preCapture: null,
  },
  seeds: [], bets: [],
};

// ── Utils / rendering (same engine as mines/plinko rigs) ──────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Adaptive pacing governor ──────────────────────────────────────────────────
// With the fixed delays at 0 the rig is bounded by round-trip latency alone. The
// only thing that should slow it down is the server saying so: a 429 engages a
// floor delay that doubles on each further rejection, and decays back to 0 after
// a run of clean requests. Self-correcting, so an unthrottled run stays safe.
const gov = { floor: 0, clean: 0, hits: 0, onEngage: null };
function govPenalise() {
  const prev = gov.floor;
  gov.floor = Math.min(gov.floor ? gov.floor * 2 : 250, 4000);
  gov.clean = 0; gov.hits++;
  if (gov.onEngage && gov.floor !== prev) gov.onEngage(`server pushed back (429 #${gov.hits}) — pacing floor now ${gov.floor}ms`);
}
function govReward() {
  if (!gov.floor) return;
  if (++gov.clean < 50) return;
  gov.clean = 0;
  gov.floor = gov.floor <= 250 ? 0 : Math.floor(gov.floor / 2);
  if (gov.onEngage) gov.onEngage(gov.floor ? `pacing floor relaxed to ${gov.floor}ms` : 'pacing floor cleared — back to full speed');
}
const pace = (ms) => { const w = Math.max(ms, gov.floor); return w > 0 ? sleep(w) : Promise.resolve(); };
const now = () => new Date().toISOString();
const randHex = (n) => Buffer.from(crypto.getRandomValues(new Uint8Array(n))).toString('hex');
const clientSeedFor = (E, tag) => tag === 'pfaudit' ? `pfaudit-${STAMP}-${E}` : 'audit' + randHex(6);
const isTTY = !!process.stdout.isTTY;
const cols = () => process.stdout.columns || 100;
const comma = (n) => Number(n).toLocaleString('en-US');
const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', gray: '\x1b[90m', green: '\x1b[92m', cyan: '\x1b[96m', mag: '\x1b[95m', yellow: '\x1b[93m', blue: '\x1b[94m', red: '\x1b[91m', orange: '\x1b[38;5;208m' };
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
const CLR = '\r\x1b[2K';
function fmtTime(s) { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}h${String(m).padStart(2, '0')}m` : m ? `${m}m${String(x).padStart(2, '0')}s` : `${x}s`; }
function smoothBar(frac, width) { frac = Math.max(0, Math.min(1, frac)); const parts = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']; const exact = frac * width, full = Math.floor(exact), partial = parts[Math.floor((exact - full) * 8)] || ''; const empty = Math.max(0, width - full - (partial ? 1 : 0)); return C.green + '█'.repeat(full) + partial + C.reset + C.gray + '·'.repeat(empty) + C.reset; }
const phaseBadge = (p) => (({ A: C.cyan, B: C.mag, C: C.blue, D: C.green, E: C.yellow, F: C.orange }[p]) || C.cyan) + C.bold + `[${p}]` + C.reset;
function logAbove(msg) { if (isTTY) process.stdout.write(CLR); console.log(msg); }
let lastDraw = 0;
function draw(i, phase, label, rate, t0, last) {
  const t = Date.now(); if (t - lastDraw < 80 && i < TOTAL_HANDS) return; lastDraw = t;
  const frac = i / TOTAL_HANDS, el = (t - t0) / 1000, eta = rate > 0 ? (TOTAL_HANDS - i) / rate : 0, pct = (frac * 100).toFixed(1) + '%';
  if (!isTTY) { if (i % 100 === 0 || i === TOTAL_HANDS) console.log(`${pct}  ${i}/${TOTAL_HANDS}  [${phase}] ${label}  ${rate.toFixed(1)}/s  ETA ${fmtTime(eta)}`); return; }
  const left = `${phaseBadge(phase)} ${C.bold}${pct.padStart(6)}${C.reset} ${C.gray}${comma(i)}/${comma(TOTAL_HANDS)}${C.reset} `;
  const meta = `${C.dim}${label}  ${rate.toFixed(1)}/s  ${fmtTime(el)}${C.reset}${C.gray}·ETA ${C.reset}${C.dim}${fmtTime(eta)}${C.reset}`;
  let drop = `  ${C.gray}${last}${C.reset}`, w = cols() - 1;
  let barW = w - strip(left).length - strip(meta).length - strip(drop).length - 3;
  if (barW < 12) { drop = ''; barW = w - strip(left).length - strip(meta).length - 3; }
  barW = Math.max(8, barW);
  process.stdout.write(`${CLR}${left}${smoothBar(frac, barW)}  ${meta}${drop}`);
}

// ── HTTP with error classification + patient retry ───────────────────────────────
class HttpError extends Error { constructor(m, k) { super(m); this.kind = k; } }
async function http(method, url, body) {
  if (!COOKIE) throw new HttpError('LIQD_COOKIE empty — source ./set-cookie.sh', 'AUTH');
  const headers = { 'Accept': 'application/json', 'Cookie': COOKIE, 'Origin': 'https://qa.liqd.com', 'Referer': 'https://qa.liqd.com/originals/blackjack', 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36' };
  if (body) headers['Content-Type'] = 'application/json';
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), REQ_TIMEOUT);
  let res, text;
  try { res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal }); text = await res.text(); }
  catch (e) { throw new HttpError('network ' + (e.name === 'AbortError' ? 'timeout' : (e.cause?.code || e.message)), 'TRANSIENT'); }
  finally { clearTimeout(to); }
  if (res.status === 401 || res.status === 403) throw new HttpError(`${res.status} auth rejected`, 'AUTH');
  if (/Cloudflare Access|<!DOCTYPE html|<html/i.test(text)) throw new HttpError('Cloudflare Access sign-in — cookie expired', 'AUTH');
  if (res.status === 429) { govPenalise(); throw new HttpError('429 rate limited', 'TRANSIENT'); }
  if (res.status >= 500) throw new HttpError(`${res.status} server error`, 'TRANSIENT');
  govReward();
  let json; try { json = JSON.parse(text); } catch { throw new HttpError(`${res.status} non-JSON: ${text.slice(0, 120)}`, 'TRANSIENT'); }
  if (json && Array.isArray(json.errors) && json.errors.length) {
    const code = json.errors[0]?.errorCode;
    const e = new HttpError('api error: ' + JSON.stringify(json.errors).slice(0, 160), code === 3116 ? 'TRANSIENT' : 'API');
    e.code = code; throw e;
  }
  return json && json.data !== undefined ? json.data : json;
}
async function retry(fn, label, onStatus) {
  let attempt = 0;
  for (;;) {
    try { return await fn(); }
    catch (e) { if (e.kind === 'AUTH' || e.kind === 'API') throw e; attempt++; if (attempt >= MAX_TRANSIENT) throw new HttpError(`${label} failed after ${attempt} retries: ${e.message}`, 'TRANSIENT'); const wait = Math.min(2000 * attempt, 30000); if (onStatus) onStatus(`${label} hiccup: ${e.message.slice(0, 40)} — retry ${attempt}/${MAX_TRANSIENT} in ${Math.round(wait / 1000)}s`); await sleep(wait); }
  }
}
async function stepCall(fn, label, onStatus) {
  let a = 0;
  for (;;) {
    try { return await fn(); }
    catch (e) { if (e.kind === 'AUTH') throw e; if (e.kind === 'API' && e.code !== 3116) throw e; a++; if (a >= MAX_TRANSIENT) throw e; const wait = Math.min(400 * a, 6000); if (onStatus) onStatus(`${label} retry ${a} (${String(e.message).slice(0, 36)}) in ${Math.round(wait / 1000)}s`); await sleep(wait); }
  }
}
const pick = (o, ...k) => { for (const x of k) if (o && o[x] != null) return o[x]; return undefined; };
const readActive = (a) => ({ hashedServerSeed: pick(a, 'activeServerSeedHash', 'hashedServerSeed'), nextHashedServerSeed: pick(a, 'nextServerSeedHash', 'nextHashedServerSeed'), clientSeed: pick(a, 'activeClientSeed', 'clientSeed'), nonce: pick(a, 'nonce') });
const readRotate = (r) => ({ revealedServerSeed: pick(r, 'revealedServerSeed', 'serverSeed'), hashedServerSeed: pick(r, 'activeServerSeedHash', 'hashedServerSeed'), nextHashedServerSeed: pick(r, 'nextServerSeedHash', 'nextHashedServerSeed'), clientSeed: pick(r, 'clientSeed', 'activeClientSeed'), nonce: pick(r, 'nonce') });
const getActive = async () => readActive(await http('GET', EP.active));
const rotate = async (clientSeed) => readRotate(await http('POST', EP.rotate, { clientSeed }));

// ── Blackjack round state + play loop ─────────────────────────────────────────────
const extract = (d) => ({ round: d && d.round != null ? d.round : (d && d.mainBet ? d : null), canIns: !!(d && d.canBetInsured), canDbl: !!(d && d.canBetDoubled), canSpl: !!(d && d.canBetSplitted) });
function activeHand(round) {
  // main hand first, then split hand (split deferred by default)
  if (round?.mainBet && round.mainBet.result === 'pending') return round.mainBet;
  if (round?.splitBet && round.splitBet.result === 'pending') return round.splitBet;
  return null;
}
function isSettled(round) {
  if (!round) return true;
  const hands = [round.mainBet, round.splitBet].filter(Boolean);
  return hands.length > 0 && hands.every((h) => h.result && h.result !== 'pending');
}
async function placeBet(amount, side, clientSeed, onStatus) {
  const body = { betAmount: amount, currencyId: CURRENCY_ID, clientSeed };
  // SIDE-BET FIELD NAMES — verified against the live client bundle 2026-08-05:
  //   request  -> perfectPairsBetAmount   (PLURAL 'Pairs')  |  twentyOnePlusThreeBetAmount
  //   response -> perfectPairSideBet      (SINGULAR)        |  twentyOnePlusThreeSideBet
  // The July run sent the SINGULAR request field. The API accepted the call and silently
  // dropped the bet: 5,800 hands produced ZERO Perfect Pairs records while 21+3 — sent in
  // the same request — worked. Confirmed live: funding PP via the UI deducts 0.10 + 0.10.
  if (side) {
    if (side.perfectPair) body.perfectPairsBetAmount = side.perfectPair;
    if (side.twentyOnePlusThree) body.twentyOnePlusThreeBetAmount = side.twentyOnePlusThree;
  }
  for (let attempt = 0; ; attempt++) {
    try { return extract(await stepCall(() => http('POST', EP.place, body), 'place-bet', onStatus)); }
    catch (e) {
      // 3103 previous-round-not-completed: a prior hand was left open — settle it and retry.
      if (e.code === 3103 && attempt < 3) { if (onStatus) onStatus('place-bet 3103 — settling leftover hand'); await finishAnyOpenHand(onStatus).catch(() => {}); continue; }
      throw e;
    }
  }
}
async function playHand(amount, side, clientSeed, strategy, onStatus) {
  let cur = await placeBet(amount, side, clientSeed, onStatus);
  const actions = [];
  let guard = 0;
  while (guard++ < MAX_ACTIONS) {
    if (!cur.round) { const u = extract(await stepCall(() => http('GET', EP.unfinished), 'unfinished', onStatus)); if (!u.round) break; cur = u; }
    if (isSettled(cur.round)) break;
    // Insurance MUST be explicitly resolved before any play action (server enforces this,
    // error 3115). We always DECLINE: POST place-insurance-bet { betAmount: 0 }. The deny
    // response is a partial round (no nonce, transient result), so re-fetch the canonical
    // state; if the deny already settled the hand (dealer blackjack on peek), use it.
    if (cur.canIns) {
      actions.push('no-ins');
      const denied = extract(await stepCall(() => http('POST', EP.insurance, { betAmount: 0 }), 'deny-ins', onStatus));
      const fresh = extract(await stepCall(() => http('GET', EP.unfinished), 'unfinished', onStatus));
      cur = fresh.round ? fresh : denied;
      continue;
    }
    const hand = activeHand(cur.round);
    if (!hand) break;
    // Split only once (no resplit) — keeps to the mainBet/splitBet schema.
    const canSplitNow = cur.canSpl && ENABLE_SPLIT && !cur.round.splitBet;
    const dec = decideAction(hand.playerHand, cur.round.dealerHand[0], { canDouble: cur.canDbl && ENABLE_DOUBLE, canSplit: canSplitNow, strategy });
    const url = dec === 'stand' ? EP.stand : dec === 'double' ? EP.double : dec === 'split' ? EP.split : EP.hit;
    actions.push(dec);
    cur = extract(await stepCall(() => http('POST', url, undefined), dec, onStatus));
    await pace(DELAY_STEP);
  }
  return { round: cur.round, actions };
}

// Resolve any hand left open on the account (deny insurance if pending, then stand until
// settled) so we can rotate / place fresh. Prevents "CannotRotateDuringActiveGame".
async function finishAnyOpenHand(onStatus) {
  for (let guard = 0; guard < MAX_ACTIONS; guard++) {
    const u = extract(await stepCall(() => http('GET', EP.unfinished), 'unfinished', onStatus));
    if (!u.round || isSettled(u.round)) return u.round ? true : false;
    if (u.canIns) { await stepCall(() => http('POST', EP.insurance, { betAmount: 0 }), 'deny-ins', onStatus); continue; }
    await stepCall(() => http('POST', EP.stand, undefined), 'stand', onStatus);
  }
  return true;
}

// ── Record a settled hand ─────────────────────────────────────────────────────────
function recordBet(E, phase, round, actions, hashedServerSeed, expectedNonce, sideArg) {
  const r = round || {};
  const hands = [r.mainBet, r.splitBet].filter(Boolean).map((h) => ({ cards: h.playerHand, points: h.playerPoints, result: h.result, winningAmount: h.winningAmount, betAmount: h.betAmount, betType: h.betType }));
  const win = hands.reduce((s, h) => s + Number(h.winningAmount || 0), 0)
    + Number(r.perfectPairSideBet?.winningAmount || 0) + Number(r.twentyOnePlusThreeSideBet?.winningAmount || 0)
    + Number(r.mainDoubleBet?.winningAmount || 0) + Number(r.splitDoubleBet?.winningAmount || 0) + Number(r.insuranceBet?.winningAmount || 0);
  // Dealer-blackjack-on-peek hands settle via the (partial) insurance-deny response, which
  // omits the nonce. The nonce is deterministic — epoch start + hand index — so fall back to it.
  const bet = {
    at: now(), epoch: E, phase, id: r.id, nonce: r.nonce ?? expectedNonce, clientSeed: undefined, serverSeedId: r.serverSeedId,
    hashedServerSeed, playerHands: hands, dealerHand: r.dealerHand, dealerPoints: r.dealerPoints,
    split: hands.length > 1, doubled: !!(r.mainDoubleBet || r.splitDoubleBet), actions,
    sideBets: { perfectPair: r.perfectPairSideBet || null, twentyOnePlusThree: r.twentyOnePlusThreeSideBet || null, insurance: r.insuranceBet || null },
    // Side-bet funding audit: what the rig ASKED for vs what the operator RETURNED.
    // A funded side bet that comes back absent means the request field was ignored.
    sideFunded: { perfectPair: !!(sideArg && sideArg.perfectPair), twentyOnePlusThree: !!(sideArg && sideArg.twentyOnePlusThree) },
    sideReturned: { perfectPair: !!r.perfectPairSideBet, twentyOnePlusThree: !!r.twentyOnePlusThreeSideBet },
    winningAmount: win, localSequence: null, verified: null,
  };
  return bet;
}

// ── Inline verify: recompute the shoe and match the full dealt card sequence ───────
function dealtSequence(playerHand, dealerHand) {
  const seq = [];
  if (playerHand?.[0]) seq.push(playerHand[0]);
  if (dealerHand?.[0]) seq.push(dealerHand[0]);
  if (playerHand?.[1]) seq.push(playerHand[1]);
  if (dealerHand?.[1]) seq.push(dealerHand[1]);
  for (let i = 2; i < (playerHand?.length || 0); i++) seq.push(playerHand[i]);
  for (let i = 2; i < (dealerHand?.length || 0); i++) seq.push(dealerHand[i]);
  return seq;
}
function verifyEpoch(E, hashedServerSeed, revealedServerSeed, clientSeed) {
  const commitOk = commitHash(revealedServerSeed) === hashedServerSeed;
  let checked = 0, bad = 0;
  for (const b of dataset.bets) {
    if (b.epoch !== E) continue;
    b.clientSeed = clientSeed;
    const shoe = blackjackShoe(revealedServerSeed, clientSeed, b.nonce);
    if (b.split) {
      // After a split the two pair cards go to SEPARATE hands, so the initial deal is
      // shoe[0]=main[0], shoe[1]=dealer[0], shoe[2]=split[0], shoe[3]=dealer[1]. Verify that
      // exact 4-card deal + that ALL dealt cards are a permutation of shoe[0..k] (no injected
      // cards). Exact post-split draw order is verified in the deliverable's verify.ts.
      const main = b.playerHands[0]?.cards || [], split = b.playerHands[1]?.cards || [], d = b.dealerHand || [];
      const all = [...main, ...split, ...d];
      const ms = (a) => a.slice().sort().join(',');
      const initOk = shoe[0] === main[0] && shoe[1] === d[0] && shoe[2] === split[0] && shoe[3] === d[1];
      const msOk = ms(all) === ms(shoe.slice(0, all.length));
      b.localSequence = shoe.slice(0, all.length); b.verified = initOk && msOk; checked++; if (!b.verified) bad++;
      continue;
    }
    const seq = dealtSequence(b.playerHands[0]?.cards, b.dealerHand);
    const ok = seq.every((c, i) => c === shoe[i]);
    b.localSequence = shoe.slice(0, seq.length); b.verified = ok; checked++; if (!ok) bad++;
  }
  return { commitOk, checked, bad };
}

// ── Checkpoint ─────────────────────────────────────────────────────────────────
function save() { dataset.meta.progress.savedAt = now(); dataset.meta.progress.bets = dataset.bets.length; dataset.meta.progress.seeds = dataset.seeds.length; writeFileSync(CHECKPOINT, JSON.stringify(dataset, null, 2)); }
function load() { if (!existsSync(CHECKPOINT)) { console.log('No checkpoint — starting fresh.'); return 0; } dataset = JSON.parse(readFileSync(CHECKPOINT, 'utf8')); const done = dataset.seeds.filter((s) => s.serverSeed != null).length; dataset.seeds = dataset.seeds.slice(0, done); dataset.bets = dataset.bets.filter((b) => b.epoch < done); console.log(`Resumed: ${done} revealed epochs, ${dataset.bets.length} hands. Continuing at epoch ${done}.`); return done; }

// ── Probe ────────────────────────────────────────────────────────────────────────
async function runProbe() {
  const PROBE_HANDS = Number(flag('hands', 20));
  ENABLE_SPLIT = true;   // force split ON during the probe so its payload gets exercised
  console.log(`\n── PROBE ── ${PROBE_HANDS} hands (split + double + side bets exercised), then reveal + verify\n`);
  if (await finishAnyOpenHand((m) => console.log('   ' + m))) console.log('   (cleared a leftover open hand)');
  const a = await getActive();
  console.log(`GET /active → hash=${a.hashedServerSeed?.slice(0, 16)}… clientSeed=${a.clientSeed} nonce=${a.nonce}\n`);
  const seen = { double: 0, split: 0, insuranceHands: 0, side: 0 };
  for (let i = 0; i < PROBE_HANDS; i++) {
    const side = i % 3 === 2 ? SIDE : null;   // every 3rd hand tries side bets
    const { round, actions } = await playHand(AMT_LOW, side, a.clientSeed, 'splitforce', (m) => console.log('   ' + m));
    if (!round) { console.log(`  hand ${i}: no settled round returned — inspect place-bet/stand response shape.`); continue; }
    const p = round.mainBet?.playerHand || [], d = round.dealerHand || [];
    const dealerAce = d[0] && Number(d[0].split(':')[1]) === 1;
    if (actions.includes('double')) seen.double++;
    if (actions.includes('split')) seen.split++;
    if (dealerAce) seen.insuranceHands++;
    if (side) seen.side++;
    const splitStr = round.splitBet ? `  split=[${round.splitBet.playerHand.join(' ')}]→${round.splitBet.result}` : '';
    const sideStr = round.perfectPairSideBet || round.twentyOnePlusThreeSideBet ? `  side:pp=${round.perfectPairSideBet?.winningAmount ?? '-'}/213=${round.twentyOnePlusThreeSideBet?.winningAmount ?? '-'}` : '';
    console.log(`  hand ${String(i).padStart(2)}: n=${round.nonce} [${actions.join(',')}]${dealerAce ? ' INS?' : ''} player=[${p.join(' ')}]=${round.mainBet?.playerPoints} dealer=[${d.join(' ')}]=${round.dealerPoints} → ${round.mainBet?.result}${splitStr}${sideStr}`);
    dataset.bets.push(recordBet(0, 'A', round, actions, a.hashedServerSeed, (a.nonce ?? 0) + i, side));
    await pace(DELAY_BET);
  }
  console.log(`\n  exercised: double=${seen.double}  split=${seen.split}  dealer-Ace(insurance)=${seen.insuranceHands}  side-bet hands=${seen.side}`);
  console.log('\nRotating to reveal + verify...');
  const r = await rotate(clientSeedFor(1, 'audit'));
  const v = verifyEpoch(0, a.hashedServerSeed, r.revealedServerSeed, a.clientSeed);
  console.log('\n── VERIFY ──');
  console.log(`  commit SHA256(utf8(serverSeed)) == active hash : ${v.commitOk ? '✅ MATCH' : '❌ MISMATCH'}`);
  console.log(`  full card-sequence recompute : ${v.checked - v.bad}/${v.checked} MATCH ${v.bad ? '❌' : '✅'}`);
  const dealerFinals = dataset.bets.map((b) => `${handValue(b.dealerHand).total}${handValue(b.dealerHand).soft ? 's' : ''}`);
  console.log(`  dealer finals observed: ${dealerFinals.join(', ')}  (watch for soft-17 stand/hit across the full run)`);

  // ── SIDE-BET FUNDING CHECK (the July run's blind spot) ────────────────────────────
  // Every probe hand funds BOTH side bets. If either was funded but no record came back,
  // the request field name is wrong and the full run must NOT start.
  const funded = { perfectPair: 0, twentyOnePlusThree: 0 };
  const returned = { perfectPair: 0, twentyOnePlusThree: 0 };
  for (const b of dataset.bets) {
    for (const k of ['perfectPair', 'twentyOnePlusThree']) {
      if (b.sideFunded?.[k]) funded[k]++;
      if (b.sideReturned?.[k]) returned[k]++;
    }
  }
  const ppOk = funded.perfectPair === 0 || returned.perfectPair === funded.perfectPair;
  const tpOk = funded.twentyOnePlusThree === 0 || returned.twentyOnePlusThree === funded.twentyOnePlusThree;
  console.log(`  side bet Perfect Pairs  : funded ${funded.perfectPair}, returned ${returned.perfectPair} ${ppOk ? '✅' : '❌ REQUEST FIELD IGNORED'}`);
  console.log(`  side bet 21+3           : funded ${funded.twentyOnePlusThree}, returned ${returned.twentyOnePlusThree} ${tpOk ? '✅' : '❌ REQUEST FIELD IGNORED'}`);
  if (!ppOk || !tpOk) {
    console.log('\n❌ A funded side bet did not come back. Do NOT run the capture — fix the payload field name first.');
    console.log('   (July 2026: `perfectPairBetAmount` was silently ignored; the client sends `perfectPairsBetAmount`.)\n');
    process.exit(3);
  }
  console.log(v.commitOk && v.bad === 0 ? '\n✅ Confirmed end-to-end. Adjust payloads if any action looked wrong, then `npm run capture`.\n' : '\n⚠️  Not green — inspect the responses above before capturing.\n');
}

// ── Capture ──────────────────────────────────────────────────────────────────────
async function runCapture(startEpoch) {
  if (!dataset.meta.startedAt) dataset.meta.startedAt = now();
  const done = dataset.bets.length;
  console.log(`\n── CAPTURE ── ${TOTAL_HANDS} hands · ${EPOCHS.length} epochs · ${EPOCH}/seed  (Duel Blackjack standard)`);
  console.log(`   A 3,300 basic · B 1,000 aggressive · C 500 split-force · D 500 pfaudit · E 200@$${AMT_STAKE} no-side · F 500 split-force   double=${ENABLE_DOUBLE} split=${ENABLE_SPLIT}\n`);
  let t0 = Date.now(), placed = done, lastResult = '';
  const onStatus = (msg) => { if (isTTY) process.stdout.write(`${CLR}  ${C.yellow}⟳${C.reset} ${C.dim}${msg}${C.reset}`); else console.log(msg); };
  gov.onEngage = (msg) => logAbove(`${C.yellow}⚑${C.reset} ${C.dim}${msg}${C.reset}`);

  // Clear any hand left open from a prior interrupted run before rotating.
  if (await retry(() => finishAnyOpenHand(onStatus), 'finish-open', onStatus)) logAbove(`${C.dim}resolved a leftover open hand before continuing${C.reset}`);

  let cur;
  if (startEpoch === 0) {
    const pre = await retry(() => getActive(), 'active', onStatus);
    dataset.meta.preCapture = { at: now(), hashedServerSeed: pre.hashedServerSeed, clientSeed: pre.clientSeed, nonce: pre.nonce, nextHashedServerSeed: pre.nextHashedServerSeed, revealedServerSeed: null, commitVerified: null };
    logAbove(`${C.dim}current seed snapshot — hash ${String(pre.hashedServerSeed).slice(0, 12)}… nonce ${pre.nonce}${C.reset}`);
    cur = await retry(() => rotate(clientSeedFor(0, EPOCHS[0].seedTag)), 'rotate', onStatus);
    dataset.meta.preCapture.revealedServerSeed = cur.revealedServerSeed;
    dataset.meta.preCapture.commitVerified = cur.revealedServerSeed ? commitHash(cur.revealedServerSeed) === dataset.meta.preCapture.hashedServerSeed : null;
    logAbove(`${C.dim}rotated to a fresh seed; starting clean at epoch 0 nonce 0${C.reset}`);
  } else {
    cur = await retry(() => getActive(), 'active', onStatus);
    logAbove(`${C.dim}resume: continuing from the current active seed (chain-preserving) at epoch ${startEpoch}${C.reset}`);
  }
  const startSeed = (E) => { dataset.seeds[E] = { epoch: E, phase: EPOCHS[E].phase, at: now(), clientSeed: cur.clientSeed, hashedServerSeed: cur.hashedServerSeed, nextHashedServerSeed: cur.nextHashedServerSeed, serverSeed: null, nonceStart: cur.nonce ?? 0, nonceEnd: null, commitVerified: null, chainLinkOk: null }; };
  startSeed(startEpoch);

  for (let E = startEpoch; E < EPOCHS.length; E++) {
    const epc = EPOCHS[E];
    for (let j = 0; j < epc.hands.length; j++) {
      const { amount, side, strategy } = epc.hands[j];
      const expectedNonce = (dataset.seeds[E].nonceStart ?? 0) + j;
      const { round, actions } = await playHand(amount, side, cur.clientSeed, strategy, onStatus);
      if (!round) { logAbove(`  ${C.red}✘${C.reset} epoch ${E} hand ${j}: no settled round — stopping to inspect.`); save(); throw new HttpError('hand returned no settled round', 'API'); }
      dataset.bets.push(recordBet(E, epc.phase, round, actions, cur.hashedServerSeed, expectedNonce, side));
      {
        // HARD GUARD (added after the July silent-drop). If a side bet was funded but the
        // settle carries no record for it, the operator ignored the request field — stop the
        // run at hand 1 instead of discovering it 5,800 hands later.
        const L = dataset.bets[dataset.bets.length - 1];
        for (const k of ['perfectPair', 'twentyOnePlusThree']) {
          if (L.sideFunded[k] && !L.sideReturned[k]) {
            save();
            throw new HttpError(`side bet '${k}' was FUNDED but is ABSENT from the settle — the API ignored the request field. Stopping.`, 'API');
          }
        }
      }
      placed++;
      const mb = round.mainBet || {};
      lastResult = `n=${round.nonce} ${mb.playerPoints}v${round.dealerPoints} ${mb.result}`;
      const el = (Date.now() - t0) / 1000, rate = (placed - done) / Math.max(0.001, el);
      draw(placed, epc.phase, `$${amount}${side ? '+side' : ''}`, rate, t0, lastResult);
      if (placed % SAVE_EVERY === 0) save();
      await pace(DELAY_BET);
    }
    await pace(DELAY_ROTATE);
    const nextTag = E + 1 < EPOCHS.length ? EPOCHS[E + 1].seedTag : 'audit';
    const next = await retry(() => rotate(clientSeedFor(E + 1, nextTag)), 'rotate', onStatus);
    const sd = dataset.seeds[E];
    sd.serverSeed = next.revealedServerSeed;
    sd.nonceEnd = dataset.bets[dataset.bets.length - 1].nonce;
    const v = verifyEpoch(E, sd.hashedServerSeed, next.revealedServerSeed, cur.clientSeed);
    sd.chainLinkOk = sd.nextHashedServerSeed != null ? sd.nextHashedServerSeed === next.hashedServerSeed : null;
    sd.commitVerified = v.commitOk && v.bad === 0;
    const mark = (ok, na) => na ? `${C.gray}n/a${C.reset}` : ok ? `${C.green}OK${C.reset}` : `${C.red}FAIL${C.reset}`;
    logAbove(`  ${v.commitOk && !v.bad && sd.chainLinkOk !== false ? C.green + '✔' : C.red + '✘'}${C.reset} epoch ${String(E).padStart(3)} ${phaseBadge(epc.phase)} ${C.dim}commit${C.reset} ${mark(v.commitOk)}  ${C.dim}chain${C.reset} ${mark(sd.chainLinkOk, sd.chainLinkOk == null)}  ${C.dim}recompute${C.reset} ${v.checked - v.bad}/${v.checked} ${v.bad ? C.red + '✘' : C.green + '✓'}${C.reset}`);
    if (sd.chainLinkOk === false) logAbove(`  ${C.red}⚠️  CHAIN BROKEN${C.reset} at epoch ${E}. Do not ship.`);
    save(); cur = next; if (E + 1 < EPOCHS.length) startSeed(E + 1);
  }
  finalize(t0);
}

function finalize(t0) {
  const verified = dataset.bets.filter((b) => b.verified === true).length;
  const failed = dataset.bets.filter((b) => b.verified === false).length;
  dataset.meta.progress.status = dataset.bets.length >= TOTAL_HANDS ? 'completed' : 'partial';
  dataset.meta.finishedAt = now();
  const outFile = join(OUT_DIR, `liqd-blackjack-${dataset.bets.length}hands.json`);
  writeFileSync(outFile, JSON.stringify(dataset, null, 2)); save();
  const byPhase = {}; for (const b of dataset.bets) byPhase[b.phase] = (byPhase[b.phase] || 0) + 1;
  if (isTTY) process.stdout.write(CLR);
  const nullSeeds = dataset.seeds.filter((s) => s.serverSeed == null).length;
  const chainBroken = dataset.seeds.filter((s) => s.chainLinkOk === false).length;
  console.log('\n── DONE ──');
  console.log(`  hands  : ${dataset.bets.length}/${TOTAL_HANDS}   by phase: ${JSON.stringify(byPhase)}`);
  console.log(`  epochs : ${dataset.seeds.length} (${dataset.seeds.filter((s) => s.commitVerified).length} commit-verified)`);
  console.log(`  chain  : ${dataset.seeds.filter((s) => s.chainLinkOk === true).length} links OK${chainBroken ? `   ❌ ${chainBroken} BROKEN` : '  ✅'}`);
  console.log(`  local-verified hands : ${verified}${failed ? `   ❌ FAILED ${failed}` : '  ✅'}`);
  console.log(`  dataset: ${outFile}`);
  if (!nullSeeds && !failed && !chainBroken) console.log('\n  ✅ 100% verifiable: every seed revealed, every card sequence recomputed, chain intact.');
  else console.log('\n  ❌ Integrity issue — do NOT ship. Run --resume.');
}

// ── Closeout + SIGINT ──────────────────────────────────────────────────────────
async function closeout(reason) {
  const E = dataset.seeds.length - 1; if (E < 0) { save(); return; }
  const sd = dataset.seeds[E]; const n = dataset.bets.filter((b) => b.epoch === E).length;
  if (sd && sd.serverSeed == null && n > 0) {
    try {
      console.log(`\nCloseout (${reason}): revealing epoch ${E} (${n} hands)...`);
      await finishAnyOpenHand().catch(() => {});   // settle any open hand so rotate is allowed
      const next = await rotate(clientSeedFor(E + 1, 'audit'));
      sd.serverSeed = next.revealedServerSeed; sd.nonceEnd = dataset.bets.filter((b) => b.epoch === E).slice(-1)[0]?.nonce ?? sd.nonceEnd;
      const v = verifyEpoch(E, sd.hashedServerSeed, next.revealedServerSeed, sd.clientSeed);
      sd.chainLinkOk = sd.nextHashedServerSeed != null ? sd.nextHashedServerSeed === next.hashedServerSeed : null;
      sd.commitVerified = v.commitOk && v.bad === 0;
      console.log(`  epoch ${E} revealed: commit ${v.commitOk ? 'OK' : 'FAIL'}, ${v.checked - v.bad}/${v.checked} recomputed ${v.bad ? '❌' : '✅'}`);
    } catch (e) { console.log(`  ⚠️  closeout reveal failed: ${e.message} — --resume to re-capture epoch ${E}.`); }
  }
  save();
}
let closing = false;
process.on('SIGINT', async () => { if (closing) { console.log('\nForce quit.'); process.exit(1); } closing = true; console.log('\n\nInterrupted — closing the chain (Ctrl-C again to force)...'); try { await closeout('interrupt'); } catch (e) { console.log('closeout error: ' + e.message); } console.log('Resume with --resume.'); process.exit(0); });

// ── Demo ────────────────────────────────────────────────────────────────────────
async function runDemo() {
  console.log(`${C.dim}DEMO — synthetic render, no bets, no auth${C.reset}\n`);
  const t0 = Date.now(); let i = 0;
  for (let E = 0; E < EPOCHS.length; E++) { const epc = EPOCHS[E]; for (let j = 0; j < epc.hands.length; j++) { i++; const rate = i / Math.max(0.001, (Date.now() - t0) / 1000); const r = Math.random(); draw(i, epc.phase, `$${epc.hands[j].amount}${epc.hands[j].side ? '+side' : ''}`, rate, t0, `n=${i} ${r < 0.44 ? 'lost' : r < 0.48 ? 'push' : 'won'}`); await sleep(1); } logAbove(`  ${C.green}✔${C.reset} epoch ${String(E).padStart(3)} ${phaseBadge(epc.phase)} ${C.dim}commit${C.reset} ${C.green}OK${C.reset}  ${C.dim}chain${C.reset} ${C.green}OK${C.reset}  ${C.dim}recompute${C.reset} ${epc.hands.length}/${epc.hands.length} ${C.green}✓${C.reset}`); }
  if (isTTY) process.stdout.write(CLR);
  console.log(`\n${C.green}✅ demo complete${C.reset} — the live run renders exactly like this.\n`);
}

// ── Main ──────────────────────────────────────────────────────────────────────────
(async () => {
  console.log('='.repeat(64) + '\n  liqd Blackjack capture\n' + '='.repeat(64));
  if (DEMO) { await runDemo(); return; }
  if (!COOKIE) { console.log('\n❌ LIQD_COOKIE not set. Run:  source ./set-cookie.sh\n'); process.exit(1); }
  try {
    if (PROBE) { await runProbe(); return; }
    const startEpoch = RESUME ? load() : 0;
    await runCapture(startEpoch);
  } catch (e) {
    if (e.kind === 'AUTH') { logAbove(`\n${C.yellow}⏸  Auth lost${C.reset} — ${e.message}`); try { await closeout('auth'); } catch {} console.log(`\n${C.bold}Cookie expired. Refresh + resume:${C.reset}\n  source ./set-cookie.sh\n  npm run resume\n`); process.exit(2); }
    logAbove(`\n${C.red}FATAL${C.reset} — ${e.message}`); try { await closeout('fatal'); } catch {} console.log(`\nResume with:  npm run resume\n`); process.exit(1);
  }
})();
