/**
 * Anti-circularity gate.
 *
 * The capture rig writes several fields that are its OWN recomputation of the game,
 * not observations of what LIQD returned:
 *
 *   Bet.localSequence   = shoe.slice(0, k)  — the rig's reconstructed shoe prefix
 *   Bet.verified        = the rig's own pass/fail verdict for that hand
 *   Seed.commitVerified = the rig's own commitment check
 *   Seed.chainLinkOk    = the rig's own next-seed chain check
 *
 * If any scored verification step read one of these, it would be comparing our
 * recomputation against our recomputation and reporting the tautology as proof.
 *
 * WHAT THE STEPS DO READ THAT THE CAPTURE WROTE. The claim is narrower than "only fields LIQD
 * sent". The steps also read capture-written fields that are records, not recomputations, each
 * bound to something LIQD did return (src/types.ts states each one):
 *   - round `winningAmount` — the capture's own sum of the casino's credit records; Step 8b
 *     claims only what that sum can show (the 1,283 doubled rounds; no skim detection), and
 *     every hand's credit is reconstructed from the cards in Step 8;
 *   - `split`, `doubled` — the capture's summaries; no rule is read from them, they are
 *     required to agree with the action tokens (Steps 6 and 12);
 *   - `actions` — the requests the capture sent; bound to the dealt cards (hit + double
 *     tokens = cards drawn) and the grammar G1–G6 in Step 6;
 *   - per-round `hashedServerSeed` and `clientSeed` — the capture's stamps; Step 3 binds them
 *     to the seed records, and Steps 1 and 6 to the revealed seed and the dealt cards;
 *   - the 145 fallback nonces on rounds recorded from the partial insurance response — the
 *     capture's own count; each must still reproduce its round's cards (Step 6) inside the
 *     epoch window Step 4 closes.
 * Everything else a step reads is a field LIQD sent (dealt cards, per-hand and side-bet
 * credits and stakes, seeds and their commitments, the other nonces), re-derived in
 * `src/rng.ts` (rebuilt from docs/ALGORITHM.md) where it is derivable.
 *
 * TWO LAYERS, and they are not equally strong:
 *
 *  1. STRUCTURAL — `src/loader.ts` DELETES all four fields from every bet and seed as it
 *     loads the dataset. Every scored step loads through that one entry point, so no access
 *     pattern of any kind can read them. This is the guarantee; it is asserted below against
 *     the real dataset.
 *  2. LINT — the regex sweep below catches ACCIDENTAL use in source (dotted, literal-bracket
 *     and destructured access) and names the file. It is a style guard, not a proof: a
 *     computed key (`const K = 'veri' + 'fied'; b[K]`) is invisible to it. It exists to fail
 *     the build early and with a good message, not to establish independence.
 *
 * Independence of the audit's numbers rests on recomputing every scored figure from the
 * dataset alone, not on this lint.
 */

import { strict as assert } from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { loadDataset, CAPTURE_SIDE_FIELDS as STRIPPED } from '../../src/loader';

/** Fields written by the capture rig from its own recomputation — never evidence. */
const CAPTURE_SIDE_FIELDS = ['localSequence', 'verified', 'commitVerified', 'chainLinkOk'];

const ROOT = path.resolve(__dirname, '..', '..');

/** Every source file that contributes to a scored verification result. */
function verificationSources(): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); }
      else if (e.name.endsWith('.ts') && !e.name.endsWith('Tests.ts')) files.push(p);
    }
  };
  walk(path.join(ROOT, 'tests', 'steps'));
  walk(path.join(ROOT, 'src'));
  files.push(path.join(ROOT, 'tests', 'verify.ts'));
  return files.filter((f) => fs.existsSync(f) && !f.endsWith(path.join('src', 'types.ts')));
}

/** Strip comments only — string literals are kept. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');
}

/** Strip comments AND string literals so prose mentions don't register as usage. */
function codeOnly(src: string): string {
  return stripComments(src)
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

describe('blackjack: anti-circularity — no capture-side field feeds a scored step', () => {
  const sources = verificationSources();

  it('finds the verification sources to scan', () => {
    assert.ok(sources.length > 3, `only found ${sources.length} sources`);
  });

  for (const field of CAPTURE_SIDE_FIELDS) {
    it(`no verification source reads \`.${field}\``, () => {
      const offenders: string[] = [];
      for (const file of sources) {
        const raw = fs.readFileSync(file, 'utf8');
        const code = codeOnly(raw);
        // Indexed access `b['localSequence']` must be matched on the comment-stripped-but-
        // string-KEPT source: codeOnly() blanks string literals, which would turn
        // `b['verified']` into `b['']` and hide the very access this guard exists to catch.
        const withStrings = stripComments(raw);
        // property access (`b.localSequence`) and destructuring (`const { localSequence } = bet`)
        // run on the fully stripped source; indexed access runs on withStrings.
        const patterns: Array<[RegExp, string]> = [
          [new RegExp(`\\.\\s*${field}\\b`), code],
          [new RegExp(`\\[\\s*['"\`]${field}['"\`]\\s*\\]`), withStrings],
          [new RegExp(`\\{[^}]*\\b${field}\\b[^}]*\\}\\s*=`), code],
        ];
        if (patterns.some(([re, hay]) => re.test(hay))) offenders.push(path.relative(ROOT, file));
      }
      assert.deepEqual(offenders, [], `capture-side field \`${field}\` read by: ${offenders.join(', ')}`);
    });
  }

  it('the dataset does carry these fields (so the guard is not vacuous)', () => {
    const datasetDir = path.join(ROOT, 'data');
    const file = fs.readdirSync(datasetDir).find((f) => f.endsWith('.json'));
    assert.ok(typeof file === 'string', 'dataset present');
    const raw = fs.readFileSync(path.join(datasetDir, file as string), 'utf8');
    // Guarding fields that are absent would prove nothing; confirm they exist to be misused.
    for (const field of CAPTURE_SIDE_FIELDS) {
      assert.ok(raw.includes(`"${field}"`), `dataset should contain ${field}`);
    }
  });

  // ── The structural layer. This is the one that makes the guarantee true. ────────────────
  it('loader.ts declares exactly the four capture-side fields as strippable', () => {
    assert.deepEqual([...STRIPPED].sort(), [...CAPTURE_SIDE_FIELDS].sort(),
      'src/loader.ts CAPTURE_SIDE_FIELDS has drifted from the list this guard scans for');
  });

  it('loadDataset() returns bets and seeds with NO capture-side field present at all', () => {
    // Not "no source reads them" — literally not there. A computed key, a bracket access, a
    // destructure, JSON.stringify: none of them can recover a deleted property.
    const ds = loadDataset();
    assert.ok(ds.bets.length > 0 && ds.seeds.length > 0, 'dataset loaded non-empty');
    const offenders: string[] = [];
    for (const field of CAPTURE_SIDE_FIELDS) {
      const nBets = ds.bets.filter((b) => Object.prototype.hasOwnProperty.call(b, field)).length;
      const nSeeds = ds.seeds.filter((s) => Object.prototype.hasOwnProperty.call(s, field)).length;
      if (nBets || nSeeds) offenders.push(`${field}: ${nBets} bet(s), ${nSeeds} seed(s)`);
    }
    assert.deepEqual(offenders, [], `loadDataset() left capture-side fields in place — ${offenders.join('; ')}`);
  });

  it('the strip is not vacuous: the same fields ARE present before stripping', () => {
    // If the raw records did not carry them, the previous test would pass on an empty premise.
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data',
      fs.readdirSync(path.join(ROOT, 'data')).find((f) => f.endsWith('.json')) as string), 'utf8'));
    for (const field of CAPTURE_SIDE_FIELDS) {
      const n = [...raw.bets, ...raw.seeds].filter((r: Record<string, unknown>) =>
        Object.prototype.hasOwnProperty.call(r, field)).length;
      assert.ok(n > 0, `no raw record carries ${field} — the strip would be vacuous`);
    }
  });
});
