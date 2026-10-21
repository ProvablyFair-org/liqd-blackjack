#!/usr/bin/env node
// Offline self-test for capture-blackjack-v2.mjs — pure helpers only, no network.
//   node capture/capture-blackjack-v2.selftest.mjs
// Checks the v2 script against the executed v1 capture (data/blackjack-6000hands.json):
// same plan, same record shape, same shoe/verification, plus the new seed generator and scrubber.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import {
  newClientSeed, buildEpochs, EPOCH, decideAction, handValue, blackjackShoe, commitHash,
  verifyEpochBets, recordBet, scrub, serialiseSafe, cookieNeedles, splitHandDone,
} from './capture-blackjack-v2.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(readFileSync(join(HERE, '..', 'data', 'blackjack-6000hands.json'), 'utf8'));
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`ok ${n} - ${name}`); };

t('client seeds: forms Step 7 / Step 26 read, CSPRNG-distinct over 20,000 draws', () => {
  const a = Array.from({ length: 10000 }, () => newClientSeed('audit'));
  const d = Array.from({ length: 10000 }, () => newClientSeed('pfaudit'));
  assert.ok(a.every((s) => /^audit[0-9a-f]{12}$/.test(s)));
  assert.ok(d.every((s) => /^pfaudit-[0-9a-f]{16}$/.test(s)));
  assert.ok(d.every((s) => !/^pfaudit-(\d{13})-(\d+)$/.test(s)), 'a v2 Phase D seed must not look like the predictable v1 form');
  assert.equal(new Set([...a, ...d]).size, 20000);
});

t('plan: phase runs, stakes, side bets and seed tags equal the executed v1 capture', () => {
  const E = buildEpochs();
  assert.equal(E.length, DATA.seeds.length);
  assert.deepEqual(E.map((e) => e.phase), DATA.seeds.map((s) => s.phase));
  assert.ok(E.every((e) => e.hands.length === EPOCH && EPOCH === DATA.meta.epochSize));
  assert.equal(E.reduce((s, e) => s + e.hands.length, 0), DATA.meta.plannedTotal);
  for (const [ph, m] of Object.entries(DATA.meta.phases)) {
    const hs = E.filter((e) => e.phase === ph).flatMap((e) => e.hands);
    assert.equal(hs.length, m.hands, ph);
    assert.ok(hs.every((h) => h.amount === m.amount && h.strategy === m.strategy && !!h.side === m.side), ph);
    assert.ok(E.filter((e) => e.phase === ph).every((e) => e.seedTag === (m.customSeeds ? 'pfaudit' : 'audit')), ph);
  }
  // every v1 bet was staked at its phase amount on the main line
  for (const b of DATA.bets) assert.ok(b.playerHands.every((h) => Number(h.betAmount) === DATA.meta.phases[b.phase].amount), `bet ${b.id}`);
});

t('shoe + inline verification: v2 reproduces v1 localSequence and verified on all 6,000 hands', () => {
  const seedByHash = new Map(DATA.seeds.map((s) => [s.hashedServerSeed, s]));
  let checked = 0;
  for (const s of DATA.seeds) {
    assert.equal(commitHash(s.serverSeed), s.hashedServerSeed);
    const bets = DATA.bets.filter((b) => b.epoch === s.epoch).map((b) => ({ ...b, localSequence: null, verified: null }));
    const v = verifyEpochBets(bets, s.hashedServerSeed, s.serverSeed, s.clientSeed);
    assert.ok(v.commitOk && v.bad === 0, `epoch ${s.epoch}`);
    for (const b of bets) {
      const orig = DATA.bets.find((x) => x.id === b.id && x.epoch === b.epoch);
      assert.deepEqual(b.localSequence, orig.localSequence); assert.equal(b.verified, orig.verified); checked++;
    }
    assert.ok(seedByHash.get(s.hashedServerSeed));
  }
  assert.equal(checked, 6000);
  // a wrong server seed must fail
  const b = [{ ...DATA.bets[0] }];
  assert.equal(verifyEpochBets(b, DATA.seeds[0].hashedServerSeed, DATA.seeds[1].serverSeed, DATA.seeds[0].clientSeed).bad, 1);
});

t('pre-capture anchor + nonce windows present in v1 (the fields v2 keeps)', () => {
  const p = DATA.meta.preCapture;
  assert.equal(commitHash(p.revealedServerSeed), p.hashedServerSeed);
  assert.equal(p.nextHashedServerSeed, DATA.seeds[0].hashedServerSeed);
  assert.ok(DATA.seeds.every((s) => s.nonceStart === 0 && s.nonceEnd === EPOCH - 1));
});

t('record shape: recordBet emits the v1 key set in v1 order, then doubleBets and decisions', () => {
  const round = {
    id: 'r1', nonce: 7, serverSeedId: 'x', dealerHand: ['CLUB:10', 'HEART:7'], dealerPoints: 17,
    mainBet: { playerHand: ['SPADE:10', 'HEART:9'], playerPoints: 19, result: 'won', winningAmount: 0.2, betAmount: '0.10000000', betType: 'main' },
    perfectPairSideBet: { betAmount: '0.10000000', winningAmount: '0.00000000' }, twentyOnePlusThreeSideBet: { betAmount: '0.10000000', winningAmount: '0.00000000' },
  };
  const r = recordBet(0, 'A', round, ['stand'], 'h', 0, { perfectPair: 0.1, twentyOnePlusThree: 0.1 }, 'T');
  assert.deepEqual(Object.keys(r), [...Object.keys(DATA.bets[0]), 'doubleBets', 'decisions']);
  assert.equal(r.nonce, 7); assert.equal(r.winningAmount, 0.2);
  assert.deepEqual(r.sideFunded, { perfectPair: true, twentyOnePlusThree: true });
  assert.equal(recordBet(0, 'A', { ...round, nonce: undefined }, [], 'h', 42, null, 'T').nonce, 42, 'nonce falls back to epoch start + index as v1');
});

t('scrubber: credential keys removed at any depth; cookie material refused', () => {
  const cookie = 'sid=abcdefghijklmnop1234; cf=zzzzzzzzzzzzzzzzzzzz';
  const obj = { meta: { a: 1, Cookie: cookie, nested: [{ accessToken: 't', authorization: 'Bearer x', ok: 2, sessionId: 's' }] }, seeds: [{ serverSeed: 'keep', hashedServerSeed: 'keep' }] };
  const s = scrub(obj);
  assert.deepEqual(s, { meta: { a: 1, nested: [{ ok: 2 }] }, seeds: [{ serverSeed: 'keep', hashedServerSeed: 'keep' }] });
  assert.deepEqual(cookieNeedles(cookie), [cookie, 'abcdefghijklmnop1234', 'zzzzzzzzzzzzzzzzzzzz']);
  assert.throws(() => serialiseSafe({ x: { raw: 'abcdefghijklmnop1234' } }, cookie), /cookie material/);
  assert.doesNotThrow(() => serialiseSafe(DATA.seeds.slice(0, 2), cookie));
  // the v1 record shape itself carries no credential-like key
  const keys = new Set(); const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { keys.add(k); walk(x); } };
  walk({ meta: DATA.meta, seeds: DATA.seeds.slice(0, 3), bets: DATA.bets.slice(0, 200) });
  assert.deepEqual([...keys].filter((k) => /cookie|token|authori[sz]ation|session|password|secret|api[-_]?key|jwt|bearer|csrf/i.test(k)), []);
});

t('split-hand order: casino plays the split hand first; splitHandDone reproduces all v1 split rounds', () => {
  // Assign each recorded hit/double card to the hand the casino plays — the split hand until
  // splitHandDone, then the main hand — and require the per-hand card counts the capture recorded.
  let ok = 0, n = 0;
  for (const b of DATA.bets) {
    if (!b.split) continue;
    n++;
    const S = b.playerHands[1].cards, M = b.playerHands[0].cards;
    if (S[0].endsWith(':1')) { if (S.length === 2 && M.length === 2) ok++; continue; }   // split aces: one card each
    const toks = b.actions.filter((a) => a !== 'no-ins' && a !== 'split');
    const got = [2, 2];
    let h = 0;
    for (const t of toks) {
      if (h > 1) { h = -1; break; }
      if (t === 'hit' || t === 'double') got[h]++;
      const cards = (h === 0 ? S : M).slice(0, got[h]);
      if (h === 0 ? splitHandDone(cards, t) : (t === 'stand' || t === 'double' || handValue(cards).total >= 21)) h++;
    }
    if (h !== -1 && got[0] === S.length && got[1] === M.length) ok++;
  }
  assert.equal(n, 401);
  assert.equal(ok, n, `${ok}/${n} split rounds assign their drawn cards to the recorded hands in the casino's order`);
});

t('basic table: soft 13–15 double where src/strategy.ts doubles (v1 hit them)', () => {
  const S = (r) => `SPADE:${r}`;
  for (const [x, ups] of [[2, [5, 6]], [3, [5, 6]], [4, [4, 5, 6]]]) for (let u = 2; u <= 10; u++) {
    const want = ups.includes(u) ? 'double' : 'hit';
    assert.equal(decideAction([S(1), S(x)], S(u), { canDouble: true, strategy: 'basic' }), want, `soft ${11 + x} vs ${u}`);
    assert.equal(decideAction([S(1), S(x)], S(u), { canDouble: false, strategy: 'basic' }), 'hit', `soft ${11 + x} vs ${u}, no double`);
  }
});

// strategy equivalence — async import of the v1 module, then exhaustive comparison. Since 2026-10-02
// the only permitted difference is header item 9: soft 13–15, basic strategy, doubling allowed (the
// casino offers it on two cards only), at the upcards where src/strategy.ts doubles (v2 'double', v1 'hit').
const v1Path = process.env.V1_STRATEGY_MJS ? join(process.env.V1_STRATEGY_MJS) : ''; // the v1 rig's strategy.mjs (not shipped here), when supplied
if (v1Path && existsSync(v1Path)) {
  const v1 = await import(pathToFileURL(v1Path).href);
  const ranks = Array.from({ length: 13 }, (_, i) => `SPADE:${i + 1}`);
  let cmp = 0, diff = 0;
  for (const up of ranks) for (const a of ranks) for (const b of ranks) for (const c of [null, ...ranks])
    for (const strategy of ['basic', 'aggressive', 'splitforce']) for (const canDouble of [false, true]) for (const canSplit of [false, true]) {
      const hand = c ? [a, b, c] : [a, b];
      if (handValue(hand).total > 21) continue;
      const d2 = decideAction(hand, up, { canDouble, canSplit, strategy }), d1 = v1.decideAction(hand, up, { canDouble, canSplit, strategy });
      cmp++;
      if (d2 === d1) continue;
      const hv = handValue(hand), u = Number(up.split(':')[1]);
      const item9 = strategy === 'basic' && canDouble && hv.soft && d2 === 'double' && d1 === 'hit'
        && ((hv.total >= 13 && hv.total <= 14 && (u === 5 || u === 6)) || (hv.total === 15 && u >= 4 && u <= 6));
      assert.ok(item9, `undeclared strategy difference: ${hand.join(' ')} vs ${up} ${strategy} canDouble=${canDouble} canSplit=${canSplit}: v2 ${d2}, v1 ${d1}`);
      diff++;
    }
  n++; console.log(`ok ${n} - strategy: ${cmp - diff}/${cmp} decisions identical to the v1 rig module; ${diff} differ, all soft 13–15 doubles (header item 9)`);
}
console.log(`# ${n} passed`);
