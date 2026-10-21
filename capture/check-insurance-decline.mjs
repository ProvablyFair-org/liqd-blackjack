#!/usr/bin/env node
// LIQD Blackjack — checks the insurance-decline recording (evidence E18). Prepared 2026-10-05.
//
//   node capture/check-insurance-decline.mjs <recording.json>   # read a dump from the console recorder
//   node capture/check-insurance-decline.mjs --selftest         # offline: fake LIQD page + fake server, no network
//
// Input: the JSON that  copy(__pfBjIns.dump())  puts on the clipboard, written by the console recorder
// capture/console/insurance-decline-recorder.console.js. Read-only: it opens the file, prints, exits.
//
// It answers, from the recording alone:
//   1. was insurance offered (the casino's canBetInsured flag) on a hand whose dealer up-card is an Ace;
//   2. did the page send LIQD's decline, place-insurance-bet { acceptInsurance: false } with no betAmount,
//      and which on-screen button was clicked right before it;
//   3. did that hand settle, and does the settled hand carry an insurance bet (insuranceBet) or not;
//   4. if the seed was revealed after the hand: does SHA-256(revealed seed) equal the hash the hands
//      were played under, and do the hand's cards re-deal from (revealed seed, client seed, nonce).
// Exit 0 = E18 ready (a decline was sent and the settled hand is recorded — whatever the casino did with
// it). Exit 1 = not ready (play another hand) or the seed check failed.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { blackjackShoe, dealtSequence, commitHash, handValue } from './capture-blackjack-v2.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const RECORDER = join(HERE, 'console', 'insurance-decline-recorder.console.js');
const CRED = /cookie|token|authori[sz]ation|session|password|passwd|secret|api[-_]?key|jwt|bearer|csrf|e-?mail/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

const dataOf = (r) => (r && r.data !== undefined ? r.data : r);
const roundOf = (d) => (d && d.round != null ? d.round : (d && d.mainBet ? d : null));
const errorsOf = (r) => (r && Array.isArray(r.errors) && r.errors.length ? r.errors : null);
const settled = (round) => { if (!round) return false; const h = [round.mainBet, round.splitBet].filter(Boolean); return h.length > 0 && h.every((x) => x.result && x.result !== 'pending'); };
const ok2xx = (e) => e.status >= 200 && e.status < 300 && !errorsOf(e.response);
const rank = (c) => Number(String(c).split(':')[1]);
const cardName = (c) => { const [s, r] = String(c).split(':'); const n = Number(r); return `${n === 1 ? 'A' : n === 11 ? 'J' : n === 12 ? 'Q' : n === 13 ? 'K' : r}${s ? s[0] : ''}`; };
const cards = (a) => (Array.isArray(a) ? a.map(cardName).join(' ') : '-');
const pick = (o, ...k) => { for (const x of k) if (o && o[x] != null) return o[x]; return undefined; };
const seedState = (d) => ({ hash: pick(d, 'activeServerSeedHash', 'hashedServerSeed'), clientSeed: pick(d, 'activeClientSeed', 'clientSeed'), nonce: pick(d, 'nonce'), revealed: pick(d, 'revealedServerSeed', 'serverSeed') });

function privacyScan(dump) {
  const hits = [];
  const walk = (v, path) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (CRED.test(k)) hits.push(`key ${path}.${k}`); walk(x, `${path}.${k}`); }
    else if (typeof v === 'string' && EMAIL.test(v)) hits.push(`e-mail-like text at ${path}`);
  };
  walk(dump.entries, 'entries');
  return hits;
}

export function check(dump) {
  const out = [], E = Array.isArray(dump && dump.entries) ? dump.entries : null;
  if (!E) return { exit: 1, verdict: 'NOT READY — this is not a recorder dump (no entries). Type copy(__pfBjIns.dump()) in the console and paste again.', lines: out };
  const isPath = (e, re) => re.test(String(e.path || ''));
  const offers = E.map((e, i) => ({ e, i, d: dataOf(e.response) })).filter((x) => x.d && x.d.canBetInsured === true);
  const insReqs = E.map((e, i) => ({ e, i })).filter((x) => isPath(x.e, /place-insurance-bet$/));
  const hands = new Set(E.map((e) => roundOf(dataOf(e.response))?.id).filter(Boolean));
  out.push(`recording: ${E.length} requests, ${hands.size} hands, ${offers.length} insurance offers, ${insReqs.length} insurance requests (recorder ${dump.version || '?'}, installed ${dump.installedAt || '?'})`);

  const priv = privacyScan(dump);
  if (priv.length) out.push(`WARNING privacy: ${priv.length} item(s) to remove before this becomes evidence: ${priv.slice(0, 5).join('; ')}`);

  let chosen = null; const why = [];
  for (const { e, i } of insReqs) {
    const req = e.request || {};
    const offer = [...offers].reverse().find((o) => o.i < i);
    const rid = roundOf(dataOf(e.response))?.id || roundOf(offer?.d)?.id || null;
    if (req.acceptInsurance !== false) { why.push(`request ${i + 1} was not a decline: ${JSON.stringify(req)}`); continue; }
    if (!ok2xx(e)) { why.push(`request ${i + 1} (decline) failed: status ${e.status}${errorsOf(e.response) ? ' ' + JSON.stringify(errorsOf(e.response)).slice(0, 120) : ''}`); continue; }
    const after = E.map((x, j) => ({ x, j })).filter(({ x, j }) => j >= i && roundOf(dataOf(x.response))?.id === rid);
    const fin = [...after].reverse().find(({ x }) => settled(roundOf(dataOf(x.response))));
    if (!rid || !fin) { why.push(`request ${i + 1} (decline) sent, but its hand never settled in the recording`); continue; }
    chosen = { e, i, req, offer, rid, fin }; break;
  }
  if (!offers.length && !insReqs.length) return { exit: 1, verdict: 'NOT READY — no hand with the dealer showing an Ace was recorded. Keep playing hands until the console says INSURANCE OFFERED.', lines: out };
  if (!chosen) return { exit: 1, verdict: `NOT READY — no declined hand that settled. ${why.join(' | ') || 'Insurance was offered but no insurance button was clicked.'} Play until the next Ace and click NO / REJECT.`, lines: out };

  const { e, i, req, offer, rid, fin } = chosen;
  const offerRound = roundOf(offer?.d), up = offerRound?.dealerHand?.[0];
  out.push(`offer: request ${offer ? offer.i + 1 : '?'} (${offer?.e.path?.replace(/.*fast-games\//, '') || '?'}), hand ${rid}, dealer up-card ${up ? cardName(up) : '?'}${up && rank(up) === 1 ? ' (Ace)' : ' (NOT an Ace)'}, canBetInsured true`);
  const click = e.lastClick, gap = click ? Date.parse(e.at) - Date.parse(click.at) : null;
  out.push(`decline: request ${i + 1} POST ${e.path} body ${JSON.stringify(req)}${'betAmount' in req ? ' (carries betAmount!)' : ' (no betAmount)'} -> status ${e.status}, no errors`);
  out.push(`button: ${click ? `"${click.text}" (${click.tag}) clicked ${gap} ms before the request` : 'no click recorded'}${e.lastKey && (!click || Date.parse(e.lastKey.at) > Date.parse(click.at)) ? `; last key "${e.lastKey.key}" ${Date.parse(e.at) - Date.parse(e.lastKey.at)} ms before` : ''}`);
  const buttonOk = !!click && gap >= 0 && gap <= 5000 && !(e.lastKey && Date.parse(e.lastKey.at) > Date.parse(click.at));
  if (!buttonOk) out.push('WARNING button: the decline was not clearly triggered by a click on the table (keyboard shortcut, or a click more than 5 s earlier).');

  const r = roundOf(dataOf(fin.x.response)), m = r.mainBet || {};
  out.push(`settled: request ${fin.j + 1}, nonce ${r.nonce ?? '?'}, you [${cards(m.playerHand)}] ${m.playerPoints ?? ''}, dealer [${cards(r.dealerHand)}] ${r.dealerPoints ?? ''}, result ${m.result}, stake ${m.betAmount}, credited ${m.winningAmount}${r.splitBet ? ' (split hand present)' : ''}`);
  const ins = r.insuranceBet, insAmt = ins ? Number(ins.betAmount) : 0;
  out.push(`insurance on the settled hand: ${ins ? `insuranceBet record, betAmount ${ins.betAmount}, result ${ins.result}, winningAmount ${ins.winningAmount}` : 'no insuranceBet record'}`);
  const declineResp = roundOf(dataOf(e.response));
  if (declineResp) out.push(`decline response: hand ${declineResp.id}, insuranceBet ${declineResp.insuranceBet ? 'betAmount ' + declineResp.insuranceBet.betAmount : 'none'}, canBetInsured ${dataOf(e.response)?.canBetInsured}`);
  const outcome = insAmt > 0
    ? `INSURANCE BOOKED ANYWAY — LIQD put a ${ins.betAmount} insurance bet on the hand after the decline. This is a finding (RTP 99.24% with insurance, not 99.51%).`
    : 'DECLINE WORKED — LIQD booked no insurance bet on the hand after its own decline button.';

  // Seed: the pair the hand was played under = latest seed state read before the offer; reveal = first rotate after settling.
  let pair = null;
  for (let j = 0; j < (offer ? offer.i : i); j++) {
    const x = E[j]; if (!ok2xx(x)) continue;
    if (isPath(x, /provably-fair\/active$/) || isPath(x, /provably-fair\/rotate$/)) { const s = seedState(dataOf(x.response)); if (s.hash) pair = s; }
  }
  const rot = E.map((x, j) => ({ x, j })).find(({ x, j }) => j > fin.j && isPath(x, /provably-fair\/rotate$/) && ok2xx(x));
  let exit = 0;
  if (!rot) out.push('seed: not revealed in the recording (the reveal step was skipped) — the hand\'s cards are not re-dealt.');
  else if (!pair) out.push('seed: revealed, but the recording has no seed read from before the hand — not re-dealt.');
  else {
    const revealed = seedState(dataOf(rot.x.response)).revealed;
    const commitOk = !!revealed && commitHash(revealed) === pair.hash;
    out.push(`seed: SHA-256(revealed) ${commitOk ? '=' : '!='} hash read before the hands (${String(pair.hash).slice(0, 12)}…)${commitOk ? ' — commit OK' : ''}`);
    if (!commitOk) { exit = 1; out.push('SEED CHECK FAILED — the revealed seed does not match the hash the hand was played under (another rotation in between?).'); }
    else if (r.splitBet) out.push('re-deal: split hand, not re-dealt by this check (the package verifier does it).');
    else {
      const seq = dealtSequence(m.playerHand, r.dealerHand), shoe = blackjackShoe(revealed, pair.clientSeed, r.nonce);
      const match = seq.length > 0 && seq.every((c, k) => c === shoe[k]);
      out.push(`re-deal: (revealed seed, client seed ${pair.clientSeed}, nonce ${r.nonce}) -> ${shoe.slice(0, seq.length).map(cardName).join(' ')} ${match ? '= the cards dealt' : '!= the cards dealt'}`);
      if (!match) { exit = 1; out.push('SEED CHECK FAILED — the cards do not re-deal from the revealed seed.'); }
    }
  }
  return { exit, verdict: exit ? `CHECK FAILED — see the SEED line. ${outcome}` : `E18 READY — ${outcome}`, lines: out, outcome: insAmt > 0 ? 'booked' : 'declined', buttonOk };
}

// ── Self-test: run the real recorder file inside a fake LIQD page against a fake server ──────────────
export function fakeServer({ bookOnDecline = false, wrongReveal = false, emailInRound = false } = {}) {
  const s = { serverSeed: randomBytes(32).toString('hex'), clientSeed: 'e1387c218cb4d548a84c67ea1fad893f', nonce: 0, round: null };
  const shoeFor = (n) => blackjackShoe(s.serverSeed, s.clientSeed, n);
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const view = (extra = {}) => {
    const R = s.round, done = R.mainBet.result !== 'pending';
    const round = { id: R.id, nonce: R.nonce, serverSeedId: 'sid', dealerHand: done ? R.dealer : [R.dealer[0]], dealerPoints: done ? handValue(R.dealer).total : null,
      mainBet: { playerHand: R.player, playerPoints: handValue(R.player).total, result: R.mainBet.result, winningAmount: R.mainBet.winningAmount, betAmount: '0.10000000', betType: 'main' },
      splitBet: null, insuranceBet: R.insuranceBet, perfectPairSideBet: null, twentyOnePlusThreeSideBet: null };
    if (emailInRound) round.note = 'player someone@example.com';
    return { data: { round, canBetInsured: !done && R.insOpen, canBetDoubled: false, canBetSplitted: false, ...extra } };
  };
  const settle = () => {
    const R = s.round, p = handValue(R.player).total;
    while (handValue(R.dealer).total < 17) R.dealer.push(R.shoe[R.next++]);
    const d = handValue(R.dealer).total;
    const res = p > 21 ? 'lost' : d > 21 || p > d ? 'won' : p === d ? 'push' : 'lost';
    R.mainBet = { result: res, winningAmount: res === 'won' ? 0.2 : res === 'push' ? 0.1 : 0 };
    if (R.insuranceBet) Object.assign(R.insuranceBet, { result: R.dealer.length === 2 && d === 21 ? 'won' : 'lost' });
    s.nonce++;
  };
  return async (url, init = {}) => {
    const path = new URL(url, 'https://qa.liqd.com').pathname.replace('/api/v1/fast-games/', '');
    const body = init.body ? JSON.parse(init.body) : null;
    if (path === 'provably-fair/active') return json(200, { data: { activeServerSeedHash: commitHash(s.serverSeed), nextServerSeedHash: 'n', clientSeed: s.clientSeed, nonce: s.nonce, gamesInProgress: [] } });
    if (path === 'provably-fair/rotate') {
      if (s.round && s.round.mainBet.result === 'pending') return json(400, { errors: [{ errorCode: 1, message: 'CannotRotateDuringActiveGame' }] });
      const revealed = wrongReveal ? randomBytes(32).toString('hex') : s.serverSeed;
      s.serverSeed = randomBytes(32).toString('hex'); s.clientSeed = body.clientSeed; s.nonce = 0;
      return json(200, { data: { revealedServerSeed: revealed, activeServerSeedHash: commitHash(s.serverSeed), clientSeed: s.clientSeed, nonce: 0 } });
    }
    if (path === 'blackjack-game/place-bet') {
      const shoe = shoeFor(s.nonce);
      s.round = { id: 'r' + s.nonce, nonce: s.nonce, shoe, next: 4, player: [shoe[0], shoe[2]], dealer: [shoe[1], shoe[3]], mainBet: { result: 'pending', winningAmount: 0 }, insuranceBet: null, insOpen: false };
      const R = s.round, pBJ = handValue(R.player).total === 21, dBJ = handValue(R.dealer).total === 21;
      if (rank(R.dealer[0]) === 1 && !pBJ) R.insOpen = true;
      else if (pBJ || dBJ) { R.mainBet = { result: pBJ && !dBJ ? 'won' : pBJ && dBJ ? 'push' : 'lost', winningAmount: pBJ && !dBJ ? 0.25 : pBJ ? 0.1 : 0 }; s.nonce++; }
      return json(200, view());
    }
    if (path === 'blackjack-game/place-insurance-bet') {
      const R = s.round; R.insOpen = false;
      if (body.acceptInsurance === true || bookOnDecline) R.insuranceBet = { id: 'i1', betAmount: '0.05000000', winningAmount: '0.00000000', betType: 'insurance', result: 'pending' };
      if (handValue(R.dealer).total === 21) { R.mainBet = { result: 'lost', winningAmount: 0 }; if (R.insuranceBet) Object.assign(R.insuranceBet, { result: 'won', winningAmount: '0.15000000' }); s.nonce++; }
      return json(200, view());
    }
    if (path === 'blackjack-game/stand') { settle(); return json(200, view()); }
    return json(404, { errors: [{ errorCode: 404 }] });
  };
}

export async function fakeSession({ server, insuranceChoice = false, useKeyboard = false, skipReveal = false, maxHands = 400, transport = 'fetch' }) {
  const listeners = { click: [], keydown: [] }, logs = [];
  const ctx = {
    location: { origin: 'https://qa.liqd.com', pathname: '/originals/blackjack', href: 'https://qa.liqd.com/originals/blackjack' },
    navigator: { userAgent: 'selftest' }, crypto: globalThis.crypto, URL, Request, Response,
    console: { log: (...a) => logs.push(a.filter((x) => !/^font-size/.test(String(x))).join(' ').replace(/%c/g, '')) },
    document: { addEventListener: (t, fn) => (listeners[t] || (listeners[t] = [])).push(fn) },
    // axios-style XHR; responseType 'json' makes responseText throw, as browsers do
    XMLHttpRequest: class { constructor() { this.l = []; this.responseType = 'json'; } open(m, u) { this.m = m; this.u = u; } addEventListener(t, f) { if (t === 'loadend') this.l.push(f); }
      get responseText() { if (this.responseType === 'json') throw new Error('InvalidStateError'); return this.raw; }
      send(body) { server(this.u, { method: this.m, body }).then(async (res) => { this.status = res.status; this.raw = await res.text(); this.response = JSON.parse(this.raw); this.l.forEach((f) => f()); this.onload && this.onload(); }); } },
    fetch: server, setTimeout, Promise,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(RECORDER, 'utf8'), ctx, { filename: 'insurance-decline-recorder.console.js' });
  const tick = () => new Promise((r) => setTimeout(r, 2));
  await tick(); await tick();
  const click = (text) => { const el = { tagName: 'BUTTON', innerText: text, getAttribute: () => null, closest() { return this; } }; for (const f of listeners.click) f({ target: el }); };
  const key = (k) => { for (const f of listeners.keydown) f({ key: k, target: { tagName: 'DIV' } }); };
  const viaXhr = (path, body) => new Promise((resolve) => { const x = new ctx.XMLHttpRequest(); x.onload = () => resolve(x.response); x.open('POST', '/api/v1/fast-games/' + path); x.send(body ? JSON.stringify(body) : null); });
  const call = async (path, body) => { if (transport === 'xhr') { const j = await viaXhr(path, body); await tick(); await tick(); return j.data; } const res = await ctx.window.fetch('/api/v1/fast-games/' + path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }); const j = await res.json(); await tick(); await tick(); return j.data; };
  let declined = false;
  for (let h = 0; h < maxHands && !declined; h++) {
    click('BET'); let d = await call('blackjack-game/place-bet', { betAmount: 0.1, currencyId: '2' });
    if (d && d.canBetInsured) {
      if (insuranceChoice === null) { declined = false; }
      else {
        if (useKeyboard) key('n'); else { await new Promise((r) => setTimeout(r, 5)); click(insuranceChoice ? 'Yes' : 'No'); }
        d = await call('blackjack-game/place-insurance-bet', { acceptInsurance: insuranceChoice });
        declined = true;
      }
    }
    if (d && d.round && d.round.mainBet.result === 'pending') { click('Stand'); await call('blackjack-game/stand'); }
    if (insuranceChoice === null && d && d.canBetInsured) break;
  }
  if (!skipReveal) await vm.runInContext('__pfBjIns.reveal()', ctx);
  await tick();
  return { dump: JSON.parse(vm.runInContext('__pfBjIns.dump()', ctx)), logs };
}

async function selftest() {
  let n = 0; const t = async (name, fn) => { await fn(); n++; console.log(`ok ${n} - ${name}`); };
  await t('decline with the table button, hand settles, seed revealed: E18 READY / DECLINE WORKED, cards re-deal', async () => {
    const { dump, logs } = await fakeSession({ server: fakeServer() });
    const r = check(dump);
    assert.equal(r.exit, 0, r.verdict + '\n' + r.lines.join('\n'));
    assert.match(r.verdict, /^E18 READY — DECLINE WORKED/);
    assert.ok(r.buttonOk);
    assert.ok(r.lines.some((l) => /commit OK/.test(l)) && r.lines.some((l) => /= the cards dealt/.test(l)));
    assert.ok(r.lines.some((l) => /dealer up-card A. \(Ace\)/.test(l)));
    assert.ok(logs.some((l) => /INSURANCE OFFERED/.test(l)) && logs.some((l) => /DECLINE SENT/.test(l)) && logs.some((l) => /E18 HAND SETTLED/.test(l)) && logs.some((l) => /Seed revealed/.test(l)));
    assert.equal(dump.entries[0].path, '/api/v1/fast-games/provably-fair/active');
    assert.ok(!JSON.stringify(dump).match(/cookie/i));
  });
  await t('casino books insurance despite the decline: E18 READY / INSURANCE BOOKED ANYWAY (a finding, not a capture failure)', async () => {
    const r = check((await fakeSession({ server: fakeServer({ bookOnDecline: true }) })).dump);
    assert.equal(r.exit, 0); assert.match(r.verdict, /INSURANCE BOOKED ANYWAY/); assert.equal(r.outcome, 'booked');
  });
  await t('Yes clicked by mistake: NOT READY', async () => {
    const r = check((await fakeSession({ server: fakeServer(), insuranceChoice: true })).dump);
    assert.equal(r.exit, 1); assert.match(r.verdict, /NOT READY — no declined hand.*not a decline/);
  });
  await t('offer seen but no insurance button clicked: NOT READY', async () => {
    const r = check((await fakeSession({ server: fakeServer(), insuranceChoice: null, skipReveal: true })).dump);
    assert.equal(r.exit, 1); assert.match(r.verdict, /NOT READY/);
  });
  await t('no Ace at all (two hands only): NOT READY, keep playing', async () => {
    const r = check((await fakeSession({ server: fakeServer(), maxHands: 0 })).dump);
    assert.equal(r.exit, 1); assert.match(r.verdict, /no hand with the dealer showing an Ace/);
  });
  await t('decline by keyboard shortcut: READY but the button warning is printed', async () => {
    const r = check((await fakeSession({ server: fakeServer(), useKeyboard: true })).dump);
    assert.equal(r.exit, 0); assert.equal(r.buttonOk, false); assert.ok(r.lines.some((l) => /WARNING button/.test(l)));
  });
  await t('reveal skipped: READY, says the cards are not re-dealt', async () => {
    const r = check((await fakeSession({ server: fakeServer(), skipReveal: true })).dump);
    assert.equal(r.exit, 0); assert.ok(r.lines.some((l) => /not revealed/.test(l)));
  });
  await t('revealed seed does not match the hash: CHECK FAILED, exit 1', async () => {
    const r = check((await fakeSession({ server: fakeServer({ wrongReveal: true }) })).dump);
    assert.equal(r.exit, 1); assert.match(r.verdict, /CHECK FAILED/);
  });
  await t('e-mail text in a response body is flagged for removal', async () => {
    const r = check((await fakeSession({ server: fakeServer({ emailInRound: true }) })).dump);
    assert.ok(r.lines.some((l) => /WARNING privacy/.test(l)));
  });
  await t('credential-like keys are dropped by the recorder itself', async () => {
    const srv = fakeServer();
    const wrapped = async (u, i) => { const res = await srv(u, i); if (!/active$/.test(new URL(u, 'https://x').pathname)) return res; const j = await res.json(); j.data.sessionToken = 'SECRET-VALUE-123'; return new Response(JSON.stringify(j), { status: 200 }); };
    const { dump } = await fakeSession({ server: wrapped });
    assert.ok(!JSON.stringify(dump).includes('SECRET-VALUE-123'));
  });
  await t('page using XHR (axios, responseType json): same result as fetch', async () => {
    const r = check((await fakeSession({ server: fakeServer(), transport: 'xhr' })).dump);
    assert.equal(r.exit, 0, r.verdict + '\n' + r.lines.join('\n')); assert.match(r.verdict, /DECLINE WORKED/); assert.ok(r.lines.some((l) => /= the cards dealt/.test(l)));
  });
  await t('not a dump: NOT READY with the copy instruction', async () => {
    const r = check({ hello: 1 }); assert.equal(r.exit, 1); assert.match(r.verdict, /copy\(__pfBjIns\.dump\(\)\)/);
  });
  console.log(`selftest: ${n}/12 ok`);
}

async function main() {
  const arg = process.argv[2];
  if (!arg || arg === '--help' || arg === '-h') { console.log('usage: node capture/check-insurance-decline.mjs <recording.json> | --selftest'); process.exit(arg ? 0 : 2); }
  if (arg === '--selftest') { await selftest(); return; }
  let dump; try { dump = JSON.parse(readFileSync(arg, 'utf8')); } catch (e) { console.log(`NOT READY — could not read ${arg} as JSON (${e.message.slice(0, 80)}). In the console type copy(__pfBjIns.dump()) and run the paste command again.`); process.exit(1); }
  const r = check(dump);
  for (const l of r.lines) console.log(l);
  console.log(r.verdict);
  process.exit(r.exit);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
