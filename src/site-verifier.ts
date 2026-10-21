/**
 * Loader for the vendored ProvablyFair.org site verifier (BLACKJACK-24, player-verifier parity).
 *
 * The site's VerifyBets component ships `games/blackjack/derive.js` as an ES module that imports
 * `hmacSha256Hex` and `hexToBytes` from `../../lib/hmac-sha256` (no extension — a bundler import).
 * This package runs those exact bytes without a bundler and without npm install:
 *
 *   1. read each vendored file's bytes and hash them against src/config.ts SITE_VERIFIER_PINS;
 *   2. strip ONLY the ES-module syntax — the `export ` keyword at the start of a declaration line,
 *      and derive.js's one import line, which must match IMPORT_LINE exactly — so any other change
 *      to the file's module surface is a load error rather than a silent rewrite;
 *   3. evaluate the result in a fresh node:vm context whose only injected names are the two
 *      imported functions (and TextEncoder, which derive.js reads for non-hex seeds).
 *
 * The digests are taken over the UNMODIFIED bytes, so the code that runs is the pinned code minus
 * module keywords. Nothing here compares cards; Step 6 does that.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import { createHash } from 'crypto';
import { SITE_VERIFIER_PINS, SITE_VERIFIER_DIR } from './config';

export const IMPORT_LINE = "import { hmacSha256Hex, hexToBytes } from '../../lib/hmac-sha256';";

export interface SiteHand { cards: string[]; outcome: string; doubled: boolean; wager: number; payout: number }
export interface SiteDerived {
  initialCards: { player: string[]; dealer: string[] };
  hands: SiteHand[];
  dealer: { cards: string[] };
  isSplit: boolean;
  cardsDealt: number;
  _shoePreview: string[];
}
export interface SiteVerifier {
  blackjackShoe: (serverSeed: string, clientSeed: string, nonce: number) => string[];
  deriveBlackjackSync: (p: {
    serverSeed: string; clientSeed: string; nonce: number; actions: string[];
    sideBets: { perfectPairs?: boolean; twentyOnePlus3?: boolean };
  }) => SiteDerived;
}

export interface SiteVerifierLoad {
  files: Array<{ file: string; sha256: string; pinned: string; ok: boolean }>;
  hashesOk: boolean;
  verifier: SiteVerifier | null;
  error: string | null;
}

function stripExports(src: string, label: string): string {
  const out = src.replace(/^export (function|const|let|class) /gm, '$1 ');
  if (/^\s*export\b/m.test(out)) throw new Error(`${label}: an export form other than "export function/const" remains`);
  return out;
}

export function loadSiteVerifier(packageRoot: string): SiteVerifierLoad {
  const dir = path.join(packageRoot, SITE_VERIFIER_DIR);
  const bytes = new Map<string, Buffer>();
  const files = SITE_VERIFIER_PINS.map((p) => {
    const fp = path.join(dir, p.file);
    const buf = fs.existsSync(fp) ? fs.readFileSync(fp) : null;
    if (buf) bytes.set(p.file, buf);
    const sha256 = buf ? createHash('sha256').update(buf).digest('hex') : 'ABSENT';
    return { file: p.file, sha256, pinned: p.sha256, ok: sha256 === p.sha256 };
  });
  const hashesOk = files.length > 0 && files.every((f) => f.ok);
  if (!hashesOk) return { files, hashesOk, verifier: null, error: 'vendored bytes do not match the pinned digests' };
  try {
    const lib = stripExports(bytes.get('lib/hmac-sha256.js')!.toString('utf8'), 'lib/hmac-sha256.js');
    if (/^\s*import\b/m.test(lib)) throw new Error('lib/hmac-sha256.js: unexpected import');
    const libExports = vm.runInNewContext(`${lib}\n;({ hmacSha256Hex, hexToBytes });`, {}, { filename: 'lib/hmac-sha256.js' });
    let derive = bytes.get('games/blackjack/derive.js')!.toString('utf8');
    const lines = derive.split('\n');
    const imports = lines.filter((l) => /^\s*import\b/.test(l));
    if (imports.length !== 1 || imports[0] !== IMPORT_LINE)
      throw new Error(`games/blackjack/derive.js: expected exactly one import line "${IMPORT_LINE}", found ${JSON.stringify(imports)}`);
    derive = stripExports(lines.filter((l) => l !== IMPORT_LINE).join('\n'), 'games/blackjack/derive.js');
    const verifier = vm.runInNewContext(`${derive}\n;({ blackjackShoe, deriveBlackjackSync });`, {
      hmacSha256Hex: libExports.hmacSha256Hex, hexToBytes: libExports.hexToBytes, TextEncoder,
    }, { filename: 'games/blackjack/derive.js' }) as SiteVerifier;
    if (typeof verifier.blackjackShoe !== 'function' || typeof verifier.deriveBlackjackSync !== 'function')
      throw new Error('games/blackjack/derive.js: blackjackShoe/deriveBlackjackSync not defined');
    return { files, hashesOk, verifier, error: null };
  } catch (e) {
    return { files, hashesOk, verifier: null, error: (e as Error).message };
  }
}

/**
 * The site renders a card as rank + suit letter (`AC`, `10H`, `QS`); this package and the operator
 * use `SUIT:rank` (`CLUB:1`, `HEART:10`, `SPADE:12`). One mapping, used for every comparison.
 */
export function toSiteCard(card: string): string {
  const [suit, r] = card.split(':');
  const rank = Number(r);
  const face = rank === 1 ? 'A' : rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : String(rank);
  return face + suit[0];
}
