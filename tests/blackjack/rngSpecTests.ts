/**
 * Spec self-test: docs/ALGORITHM.md vectors and properties, run against src/rng.ts.
 *
 * Written by the clean-room implementer together with src/rng.ts, from docs/ALGORITHM.md and the module
 * interface alone (never from LIQD's code). Integrated 20 Oct 2026: the checks are unchanged; only the
 * import path, the mocha wrapper and the reporting (failures collected instead of printed) were adapted.
 */
import * as assert from 'assert';
// Self-test for rng.ts against the worked vectors in ALGORITHM.md §5 plus properties.
import { createHmac, createHash } from 'crypto';
import {
  salt, maxFairFor, generateProvablyFairNumber, expectedFirstChunkRejections,
  SUITS, DECKS, SHOE_SIZE, buildShoeTemplate, blackjackShoe, dealtHands, commitHash, DrawCensus,
} from '../../src/rng';

const EXPECTED_CHECKS = 142;

function runSelftest(): { pass: number; total: number; failed: string[] } {
  let pass = 0;
  let total = 0;
  const failed: string[] = [];
  function check(name: string, ok: boolean, detail = ''): void {
    total++;
    if (ok) pass++;
    if (!ok) failed.push(`${name}${detail ? '  (' + detail + ')' : ''}`);
  }
  interface Step { cursor: number; digest: string; u32: number; j: number }
  interface Dealt { k: number; a: number; card: string }
  interface Vector { id: string; seed: string; commitment: string; client: string; nonce: number; steps: Step[]; dealt: Dealt[] }

  // Transcribed from ALGORITHM.md §5 (V1..V5).
  const VECTORS: Vector[] = [
    {
      id: 'V1', seed: '6dca5e36b6b9dc56730e282ab3c2bae6',
      commitment: '948eff896b5521c1064402dcd5557342210e03e0c4e864d0b83418bfb5e12f42',
      client: 'audita6d2fe11bb1f', nonce: 0,
      steps: [
        { cursor: 415, digest: 'd1b4e0facbbbc71d6214329ea062281a590b3cc14a2653707bb318a85e306d2f', u32: 3518292218, j: 90 },
        { cursor: 414, digest: '2b43ce94c51668d09d8ee76b16ce1f94bd4a1bdebf4b95fc48ef2f7203418735', u32: 725864084, j: 34 },
        { cursor: 413, digest: '438a8d5ac49ff072ff73294c7771991a4990645b2a7ed12fcf86a7f6f32b74fe', u32: 1133153626, j: 22 },
      ],
      dealt: [
        { k: 0, a: 227, card: 'HEART:7' }, { k: 1, a: 269, card: 'CLUB:10' }, { k: 2, a: 21, card: 'HEART:9' },
        { k: 3, a: 231, card: 'HEART:11' }, { k: 4, a: 225, card: 'HEART:5' },
      ],
    },
    {
      id: 'V2', seed: '462b3034c052f3b381faf7a9df8786c2',
      commitment: '9e7871e9e10b395a061d187faaab96c7d2f7516d3699b525fc956f513bfbbd73',
      client: 'audit9d3a9fbe9f01', nonce: 19,
      steps: [
        { cursor: 415, digest: '133dabd6ed708a2531331c6299ff619172de5121e95e8137fd1ff507f6a19112', u32: 322808790, j: 278 },
        { cursor: 414, digest: '868b89e825ad5ac1d9ddab85175413d6411932015bc71e4f226df8e883b52e11', u32: 2257291752, j: 97 },
        { cursor: 413, digest: '7220e113fe98735b6879af58111eaf3f855b2aa6f070146d92201d6ac449ee8e', u32: 1914757395, j: 357 },
      ],
      dealt: [
        { k: 0, a: 154, card: 'DIAMOND:12' }, { k: 1, a: 65, card: 'HEART:1' }, { k: 2, a: 200, card: 'DIAMOND:6' },
        { k: 3, a: 204, card: 'DIAMOND:10' },
      ],
    },
    {
      id: 'V3', seed: '20c94c68c99bd6b63ebf71593745a8d5',
      commitment: 'a5dd969e1a8cb2e87dc84f2067cb042a9501a570b840ecb5636f84ffc562574a',
      client: 'audit8cfd067445ca', nonce: 44,
      steps: [
        { cursor: 415, digest: 'eb283fa7bf9f568d244747c8052d1ba81fbbe19455f17f9f651784af25e32db9', u32: 3945283495, j: 231 },
        { cursor: 414, digest: '923fb028281f6123fd840041d7a126cf057569e84af5acd106fd12f7d6b95b9b', u32: 2453647400, j: 155 },
        { cursor: 413, digest: '13ad42bca48c88e28153767013041ab387f89848c7c060a26841c33d82f9d3e1', u32: 330121916, j: 386 },
      ],
      dealt: [
        { k: 0, a: 317, card: 'CLUB:6' }, { k: 1, a: 145, card: 'DIAMOND:3' }, { k: 2, a: 122, card: 'HEART:6' },
        { k: 3, a: 204, card: 'DIAMOND:10' }, { k: 4, a: 144, card: 'DIAMOND:2' }, { k: 5, a: 314, card: 'CLUB:3' },
        { k: 6, a: 282, card: 'HEART:10' }, { k: 7, a: 259, card: 'DIAMOND:13' }, { k: 8, a: 86, card: 'SPADE:9' },
        { k: 9, a: 132, card: 'SPADE:3' }, { k: 10, a: 409, card: 'DIAMOND:7' },
      ],
    },
    {
      id: 'V4', seed: 'b5a13d1d053850ca56be486dbae5311c',
      commitment: '3ea4964c5bb6f44823863d8acc2269d904154f74a41e64d7e93db80d431bc2fc',
      client: 'audit2ec7bbca207a', nonce: 6,
      steps: [
        { cursor: 415, digest: '306cf647f9b1dfe4dad79f1b362e5a51eb56b9027b0f05a64ba701fd86397df3', u32: 812447303, j: 135 },
        { cursor: 414, digest: '052cc08e56eb8059c11dd351dd2d37df10db769618777f098682e56d3c9098d7', u32: 86818958, j: 128 },
        { cursor: 413, digest: 'fba3f60a5ef846ba66e5bd7fcab6aaa8a7e877f1eb3ed6842d060377f1134180', u32: 4221826570, j: 298 },
      ],
      dealt: [
        { k: 0, a: 32, card: 'SPADE:7' }, { k: 1, a: 315, card: 'CLUB:4' }, { k: 2, a: 3, card: 'CLUB:4' },
        { k: 3, a: 308, card: 'DIAMOND:10' }, { k: 4, a: 272, card: 'CLUB:13' }, { k: 5, a: 182, card: 'SPADE:1' },
        { k: 6, a: 236, card: 'SPADE:3' },
      ],
    },
    {
      id: 'V5', seed: '9e04ebf43f093011b6b8c9287e255ed1',
      commitment: 'a9f9c99c9115159a510ff3edb145b920ce365d89dcc64a5ea0e12ed96f47b43e',
      client: 'pfaudit-1785954682036-96', nonce: 8,
      steps: [
        { cursor: 415, digest: 'a9fd779dc7f3bfe902ec5f78365d21832cc305b10aadbd4dc78d34ba415f6175', u32: 2851960733, j: 349 },
        { cursor: 414, digest: '083834f33f3566cd7862cd352b21c0dba8376b10be8e549f80d3c45baa23d996', u32: 137901299, j: 119 },
        { cursor: 413, digest: '5d6c8e167f2991fb666ec8e1cb7319d5352d04951fe9139015209ed599c44801', u32: 1567395350, j: 44 },
      ],
      dealt: [
        { k: 0, a: 13, card: 'HEART:1' }, { k: 1, a: 331, card: 'HEART:7' }, { k: 2, a: 387, card: 'HEART:11' },
        { k: 3, a: 393, card: 'SPADE:4' },
      ],
    },
  ];

  // Rebuild the position array with the exported draw only, so a[k] (not just the card
  // string, which repeats 8 times per shoe) can be compared to the spec.
  function positions(seed: string, client: string, nonce: number): number[] {
    const a = Array.from({ length: SHOE_SIZE }, (_, x) => x);
    for (let i = SHOE_SIZE - 1; i >= 1; i--) {
      const j = generateProvablyFairNumber(seed, client, nonce, i, i + 1);
      const t = a[i] as number; a[i] = a[j] as number; a[j] = t;
    }
    return a;
  }

  const template = buildShoeTemplate();

  for (const v of VECTORS) {
    check(`${v.id} commitment`, commitHash(v.seed) === v.commitment);
    const key = Buffer.from(v.seed, 'hex');
    for (const s of v.steps) {
      const msg = salt(v.client, v.nonce, s.cursor);
      const d = createHmac('sha256', key).update(msg, 'utf8').digest();
      check(`${v.id} cursor ${s.cursor} digest`, d.toString('hex') === s.digest, msg);
      check(`${v.id} cursor ${s.cursor} u32`, d.readUInt32BE(0) === s.u32);
      const j = generateProvablyFairNumber(v.seed, v.client, v.nonce, s.cursor, s.cursor + 1);
      check(`${v.id} cursor ${s.cursor} j`, j === s.j, `got ${j}`);
    }
    const shoe = blackjackShoe(v.seed, v.client, v.nonce);
    const a = positions(v.seed, v.client, v.nonce);
    for (const c of v.dealt) {
      check(`${v.id} k=${c.k} a[k]`, a[c.k] === c.a, `got ${a[c.k]}`);
      check(`${v.id} k=${c.k} card`, shoe[c.k] === c.card && template[c.a] === c.card, `got ${shoe[c.k]}`);
    }
    const card = (k: number): string => (v.dealt.find((d) => d.k === k) as Dealt).card;
    const h = dealtHands(shoe);
    check(`${v.id} dealtHands player/dealer/rest`,
      h.player.join() === [card(0), card(2)].join() && h.dealer.join() === [card(1), card(3)].join()
        && h.rest.length === SHOE_SIZE - 4 && h.rest[0] === shoe[4]);
  }

  // The first message the spec quotes verbatim (§2 Step 1).
  check('salt example audita6d2fe11bb1f:0:415', salt('audita6d2fe11bb1f', 0, 415) === 'audita6d2fe11bb1f:0:415');

  // Hash check true / false.
  const v1 = VECTORS[0] as Vector;
  check('commitHash true for revealed seed', commitHash(v1.seed) === v1.commitment);
  check('commitHash false for altered seed', commitHash('7dca5e36b6b9dc56730e282ab3c2bae6') !== v1.commitment);
  check('commitHash false for other vector seed', commitHash((VECTORS[1] as Vector).seed) !== v1.commitment);
  check('commitment is over ASCII, not decoded bytes',
    createHash('sha256').update(Buffer.from(v1.seed, 'hex')).digest('hex') !== v1.commitment);
  check('commitHash lowercase 64 hex', /^[0-9a-f]{64}$/.test(commitHash(v1.seed)));

  // Constants and template.
  check('SUITS order', SUITS.join() === 'CLUB,HEART,SPADE,DIAMOND');
  check('DECKS 8, SHOE_SIZE 416', DECKS === 8 && SHOE_SIZE === 416);
  check('template layout', template.length === 416 && template[0] === 'CLUB:1' && template[12] === 'CLUB:13'
    && template[13] === 'HEART:1' && template[51] === 'DIAMOND:13' && template[52] === 'CLUB:1' && template[415] === 'DIAMOND:13');

  // Shoe is a permutation of the template (8 of each card) and deterministic.
  const counts = new Map<string, number>();
  const shoe1 = blackjackShoe(v1.seed, v1.client, v1.nonce);
  for (const c of shoe1) counts.set(c, (counts.get(c) ?? 0) + 1);
  check('shoe is 416 cards, 52 distinct, 8 each',
    shoe1.length === 416 && counts.size === 52 && [...counts.values()].every((n) => n === 8));
  check('shoe deterministic', blackjackShoe(v1.seed, v1.client, v1.nonce).join() === shoe1.join());
  check('shoe changes with nonce', blackjackShoe(v1.seed, v1.client, 1).join() !== shoe1.join());

  // Ranges.
  let inRange = true;
  for (let n = 0; n < 50; n++) {
    for (const r of [1, 2, 3, 52, 415, 416, 1000003]) {
      const x = generateProvablyFairNumber(v1.seed, v1.client, n, r, r);
      if (!(Number.isInteger(x) && x >= 0 && x < r)) inRange = false;
    }
  }
  check('draws in [0, range) over 350 samples', inRange);
  let threw = 0;
  for (const bad of [0, -1, 1.5, 4294967297]) {
    try { generateProvablyFairNumber(v1.seed, v1.client, 0, 0, bad); } catch { threw++; }
  }
  check('invalid range rejected (0, -1, 1.5, 2^32+1)', threw === 4);
  let badSeed = false;
  try { blackjackShoe('zz' + v1.seed.slice(2), v1.client, 0); } catch { badSeed = true; }
  check('non-hex server seed rejected', badSeed);

  // Rejection rule: a range of 3*2^30 makes LIMIT = 3*2^30, so a quarter of chunks reject;
  // find a cursor whose first chunk rejects and confirm the draw comes from the next accepted chunk.
  const bigRange = 3 * 2 ** 30;
  check('maxFairFor(3*2^30) = 3*2^30', maxFairFor(bigRange) === bigRange);
  let rejectionChecked = false;
  for (let cur = 0; cur < 200 && !rejectionChecked; cur++) {
    const d = createHmac('sha256', Buffer.from(v1.seed, 'hex')).update(salt(v1.client, 0, cur), 'utf8').digest();
    if (d.readUInt32BE(0) >= bigRange) {
      let expected = -1;
      for (let c = 1; c < 8; c++) { const w = d.readUInt32BE(c * 4); if (w < bigRange) { expected = w % bigRange; break; } }
      const got = generateProvablyFairNumber(v1.seed, v1.client, 0, cur, bigRange);
      check(`rejected first chunk falls through to next chunk (cursor ${cur})`, got === expected, `got ${got}`);
      rejectionChecked = true;
    }
  }
  if (!rejectionChecked) check('rejected first chunk falls through to next chunk', false, 'no rejecting cursor found');

  // Bias report consistency.
  let limitsOk = true;
  for (let r = 1; r <= 416; r++) {
    const L = maxFairFor(r);
    if (L % r !== 0 || L > 2 ** 32 || 2 ** 32 - L >= r) limitsOk = false;
    if ((r & (r - 1)) === 0 && L !== 2 ** 32) limitsOk = false;
  }
  check('maxFairFor(r): multiple of r, 2^32 - L < r, = 2^32 for powers of two (r = 1..416)', limitsOk);
  let manual = 0;
  for (let r = 2; r <= 416; r++) manual += (2 ** 32 - maxFairFor(r)) / 2 ** 32;
  const e6000 = expectedFirstChunkRejections(6000);
  check('expectedFirstChunkRejections(6000) rounds to 0.0569 (spec §6 O1)', e6000.toFixed(4) === '0.0569', `got ${e6000}`);
  check('expected(1) equals sum over r=2..416 of (2^32 - maxFairFor(r))/2^32', Math.abs(expectedFirstChunkRejections(1) - manual) < 1e-15);
  check('expected is linear in shoes; expected(0) = 0',
    expectedFirstChunkRejections(0) === 0 && expectedFirstChunkRejections(6000) === 6000 * expectedFirstChunkRejections(1));

  const census: DrawCensus = { draws: 0, firstChunkRejected: 0, cursorAdvanced: 0 };
  const shoes = 200;
  let sameWithCensus = true;
  for (let n = 0; n < shoes; n++) {
    const withC = blackjackShoe(v1.seed, v1.client, n, census);
    if (n < 5 && withC.join() !== blackjackShoe(v1.seed, v1.client, n).join()) sameWithCensus = false;
  }
  check('census does not change the shoe', sameWithCensus);
  check(`census draws = 415 x ${shoes}`, census.draws === 415 * shoes, `got ${census.draws}`);
  check('census cursorAdvanced = 0 (spec defines no such path)', census.cursorAdvanced === 0);
  check(`census firstChunkRejected ${census.firstChunkRejected} plausible vs expected ${expectedFirstChunkRejections(shoes).toExponential(3)}`,
    census.firstChunkRejected >= 0 && census.firstChunkRejected <= 2);

  return { pass, total, failed };
}

describe('LIQD Blackjack RNG, spec self-test (docs/ALGORITHM.md)', () => {
  it(`passes all ${EXPECTED_CHECKS} spec vector and property checks`, () => {
    const r = runSelftest();
    assert.deepStrictEqual(r.failed, []);
    assert.strictEqual(r.total, EXPECTED_CHECKS);
    assert.strictEqual(r.pass, EXPECTED_CHECKS);
  });
});
