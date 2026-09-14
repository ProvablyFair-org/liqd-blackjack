import { strict as assert } from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { blackjackShoe, dealtHands, commitHash } from '../../src/rng';
import { buildRankShoe, createLazyShuffler } from '../../src/shuffle';

// Real LIQD Blackjack validation vectors — taken from the captured dataset
// (epoch 0, revealed serverSeed). Every value below is reproduced independently
// by the reference RNG and matches the recorded live hand.
const SERVER_SEED = '6dca5e36b6b9dc56730e282ab3c2bae6';
const CLIENT_SEED = 'audita6d2fe11bb1f';

describe('blackjack: real captured shoe reproduction', () => {
  it('serverSeed 6dca5e36… clientSeed audita6d2… nonce=0 -> shoe[0..3] = HEART:7,CLUB:10,HEART:9,HEART:11', () => {
    const shoe = blackjackShoe(SERVER_SEED, CLIENT_SEED, 0);
    assert.deepEqual(shoe.slice(0, 4), ['HEART:7', 'CLUB:10', 'HEART:9', 'HEART:11'], `got ${JSON.stringify(shoe.slice(0, 4))}`);
  });

  it('deal is PDPD: player = HEART:7,HEART:9 ; dealer = CLUB:10,HEART:11 (matches the recorded live hand)', () => {
    const { player, dealer } = dealtHands(blackjackShoe(SERVER_SEED, CLIENT_SEED, 0));
    assert.deepEqual(player, ['HEART:7', 'HEART:9'], `player ${JSON.stringify(player)}`);
    assert.deepEqual(dealer, ['CLUB:10', 'HEART:11'], `dealer ${JSON.stringify(dealer)}`);
  });
});

describe('blackjack: commitment hash (SHA-256 of utf8 hex string)', () => {
  it('commitHash(6dca5e36…) -> 948eff89… (== recorded hashedServerSeed)', () => {
    assert.equal(
      commitHash(SERVER_SEED),
      '948eff896b5521c1064402dcd5557342210e03e0c4e864d0b83418bfb5e12f42',
    );
  });
});

// ── Negative controls ────────────────────────────────────────────────────────────
// A test suite that only asserts correct inputs produce correct outputs cannot fail
// when the implementation is wrong in the ways that matter. These assert the reverse.

describe('blackjack: negative controls (the suite must be able to fail)', () => {
  it('a tampered server seed does NOT reproduce the recorded commitment', () => {
    const tampered = 'a' + SERVER_SEED.slice(1);
    assert.notEqual(tampered, SERVER_SEED);
    assert.notEqual(commitHash(tampered), commitHash(SERVER_SEED));
  });

  it('a one-nibble change in the server seed yields a completely different shoe', () => {
    const tampered = SERVER_SEED.slice(0, -1) + (SERVER_SEED.slice(-1) === '0' ? '1' : '0');
    const a = blackjackShoe(SERVER_SEED, CLIENT_SEED, 0);
    const b = blackjackShoe(tampered, CLIENT_SEED, 0);
    assert.notDeepEqual(a.slice(0, 8), b.slice(0, 8));
  });

  it('a wrong client seed yields a different shoe (the client seed genuinely feeds the draw)', () => {
    const a = blackjackShoe(SERVER_SEED, CLIENT_SEED, 0);
    const b = blackjackShoe(SERVER_SEED, 'wrong-client-seed-test', 0);
    assert.notDeepEqual(a.slice(0, 8), b.slice(0, 8));
  });

  it('a different nonce yields a different shoe', () => {
    const a = blackjackShoe(SERVER_SEED, CLIENT_SEED, 0);
    const b = blackjackShoe(SERVER_SEED, CLIENT_SEED, 1);
    assert.notDeepEqual(a.slice(0, 8), b.slice(0, 8));
  });

  it('the shoe is a valid 8-deck multiset: 416 cards, 32 of each rank, 104 of each suit', () => {
    const shoe = blackjackShoe(SERVER_SEED, CLIENT_SEED, 0);
    assert.equal(shoe.length, 416);
    const byRank = new Map<string, number>();
    const bySuit = new Map<string, number>();
    for (const c of shoe) {
      const [suit, rank] = c.split(':');
      byRank.set(rank, (byRank.get(rank) ?? 0) + 1);
      bySuit.set(suit, (bySuit.get(suit) ?? 0) + 1);
    }
    assert.equal(byRank.size, 13);
    assert.equal(bySuit.size, 4);
    for (const [, n] of byRank) assert.equal(n, 32);
    for (const [, n] of bySuit) assert.equal(n, 104);
  });

  it('the deal is a permutation of the shoe prefix — no card is invented or dropped', () => {
    const shoe = blackjackShoe(SERVER_SEED, CLIENT_SEED, 0);
    const { player, dealer, rest } = dealtHands(shoe);
    assert.deepEqual([...player, ...dealer, ...rest].sort(), [...shoe].sort());
  });
});

// ── Reference-RTP shuffle: uniformity at depth ───────────────────────────────────
// Regression guard for the fixed-prefix pre-shuffle defect: the reference RTP engine
// once shuffled only the first 24 positions per round and read beyond them, which
// sampled UNSHUFFLED tail positions on deep rounds (split-with-aces chains). The
// lazy Fisher-Yates frontier must sample uniformly at ANY depth.
//
// ROUND-4 QA-02. These tests used to carry their own private copy of the shuffle loop, so
// they guarded a copy that nothing shipped: the reviewer changed the REAL simulator's loop
// condition from `frontier <= k` to `frontier <= k && frontier < 24` — reintroducing the exact
// defect named above — and all three of these tests stayed green. The loop now lives in
// `src/shuffle.ts`, `src/simulate.ts` imports it, and so does this file. The last test in this
// block binds that arrangement in source, so the guard cannot silently detach again.
describe('blackjack: reference-shuffle uniformity across shallow and deep draws', () => {
  // Deterministic PRNG (mulberry32) so this statistical guard is REPRODUCIBLE — a randomized
  // Math.random() version false-failed at its 0.1% bound roughly 0.3% of runs (3 depths), which
  // is unacceptable for a gate that must be green every run. A fixed seed removes the flake while
  // still exercising uniformity at depth: the fixed-prefix defect it guards against is grossly
  // non-uniform (an unshuffled tail position is deterministic → χ² in the thousands), so it fails
  // this bound under any seed. Randomness is INJECTED into the shared shuffler, which is why the
  // shared implementation can be driven deterministically here and by `Math.random` in production.
  function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** Rank landing on `depth` over `trials` rounds of THE SIMULATOR'S OWN shuffler. */
  function rankAtDepth(depth: number, trials: number, rand: () => number): number[] {
    const shuffler = createLazyShuffler(buildRankShoe(8), (n: number) => (rand() * n) | 0);
    const counts = new Array(14).fill(0);
    for (let t = 0; t < trials; t++) {
      shuffler.reset();              // exactly what simulate.ts does at the top of each round
      counts[shuffler.at(depth)]++;  // ensure(depth) then read — the draw path under test
    }
    return counts.slice(1);
  }

  for (const depth of [3, 23, 40]) {
    it(`position ${depth} is uniform over the 13 ranks`, () => {
      const trials = 60000;
      const counts = rankAtDepth(depth, trials, mulberry32(0x9e3779b9 ^ depth));
      const exp = trials / 13;
      const chi2 = counts.reduce((a, o) => a + ((o - exp) ** 2) / exp, 0);
      // chi2(12) upper 0.1% critical value = 32.91 — deterministic seed, so this is a fixed value.
      assert.ok(chi2 < 32.91, `depth ${depth}: chi2=${chi2.toFixed(2)} exceeds the 0.1% critical value`);
    });
  }

  it('the shuffler is a pure function of its injected stream — importing it draws no randomness', () => {
    // The property `src/simulate.ts` does not have (it runs 30M rounds on import) and the reason
    // the depth tests could not simply import the original. Constructing a shuffler must not
    // consume the stream; only `ensure`/`at` may.
    let draws = 0;
    const counting = (n: number): number => { draws++; return n >> 1; };
    const s = createLazyShuffler(buildRankShoe(8), counting);
    assert.equal(draws, 0, 'constructing a shuffler consumed randomness');
    assert.equal(s.frontier(), 0);
    s.ensure(3);
    assert.equal(draws, 4, 'ensure(3) must fix exactly positions 0..3');
    s.ensure(3);
    assert.equal(draws, 4, 'a settled position must never be re-drawn');
    // Same stream in, same permutation out — the equivalence that makes the extraction from
    // simulate.ts provably behaviour-preserving without regenerating the frozen artifact.
    const ra = mulberry32(12345), rb = mulberry32(12345);
    const a = createLazyShuffler(buildRankShoe(8), (n: number) => (ra() * n) | 0);
    const b = createLazyShuffler(buildRankShoe(8), (n: number) => (rb() * n) | 0);
    a.ensure(60); b.ensure(60);
    assert.deepEqual(a.items.slice(0, 61), b.items.slice(0, 61));
  });

  it('src/simulate.ts uses THIS implementation — no second copy of the shuffle loop', () => {
    // Source binding, not a behavioural one. Without it the tests above prove only that
    // src/shuffle.ts is uniform at depth, which is not the claim being made: the claim is that
    // the SIMULATOR is. QA-02's counterexample was possible precisely because that binding did
    // not exist. If simulate.ts ever re-inlines the loop, this fails and names the file.
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'simulate.ts'), 'utf8');
    assert.ok(/from '\.\/shuffle'/.test(src),
      'src/simulate.ts no longer imports the shared shuffler — the depth tests below would be guarding a copy');
    assert.ok(/createLazyShuffler\(/.test(src),
      'src/simulate.ts imports ./shuffle but does not construct a shuffler from it');
    assert.ok(!/while\s*\(\s*frontier\s*<=/.test(src),
      'src/simulate.ts has re-inlined a shuffle frontier loop — there are two implementations again');
  });
});
