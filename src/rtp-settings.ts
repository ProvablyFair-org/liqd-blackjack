/**
 * RTP-CLAIM wiring — LIQD Blackjack: the per-setting RTP table and the claim it is held to.
 *
 * The rule is src/rtp-claim.ts, a byte-identical copy of the framework's core/rtp-claim.ts (its
 * SHA-256 is compared by conformance C-13), and the enforcement switch RTP_CLAIM_RULE_ENFORCED is
 * this package's src/rtp-claim-switch.ts, read by that copy. Rule 1.2.0 (Methodology v1.1) 2026-10-14: the claim
 * source names the game page, one of the rule's six places (decision D3); an enforced miss would be RTP FIGURE OVERSTATED. Rule RTP-CLAIM 1.0.0
 * agreed 2026-09-29; 1.1.0 (no-claim kind) agreed 2026-10-01.
 *
 * SETTINGS. One: the main game under LIQD's single rule set on the 8-deck shoe (S17, DAS, peek,
 * 3:2, double any two), played by the total-dependent basic strategy the package exports
 * (anchor/policy.json). The side bets (Perfect Pairs, 21+3) are separate wagers with their own
 * exact edges (Step 20) and no published figure of their own; they are not in this table.
 * RTP. rtpPerInitialBet of the finite 8-deck solve in outputs/exact-rtp.json (pinned by
 * EXACT_RTP_SHA256 in src/config.ts) — an exact DP evaluated in double precision, anchored to the
 * exact-rational tiny-shoe oracle (anchor/oracle.py); the rule takes that double's exact binary
 * value. The per-total-wagered convention (99.567565 %) is higher still.
 * CLAIM. The figure the game surface publishes: "Edge: 0.48%" (E16; src/config.ts
 * STOREFRONT_EDGE) = RTP 99.52 %, still the header of the live page read 2026-10-01
 * (evidence/rtp-page-labels-2026-10-01.json), which also shows "RTP (optimal play) 99.51%". The config field houseEdge 1% (LIQD's game-settings response, E23) is an internal label the player
 * never sees (src/config.ts NOMINAL_HOUSE_EDGE; declaration gameModel.edge.claimed 0.01) — against it every
 * setting is player-favourable.
 *
 *   npm run rtp-claim:write    rewrite outputs/rtp-claim-table.json and print its SHA-256 to pin
 */
import * as path from 'path';
import * as fs from 'fs';
import { createHash } from 'crypto';
import { RtpClaim, RtpClaimAccumulator, RtpClaimResult, rtpClaimTable, rtpClaimGate, RtpClaimGate, rationalFromDouble } from './rtp-claim';
import { EXACT_RTP_SHA256, STOREFRONT_EDGE, NOMINAL_HOUSE_EDGE } from './config';

/**
 * The figure held is DERIVED from the two published edges this package carries, never typed a
 * second time (FIXPASS2 C3, 2026-10-14): the storefront "Edge: 0.48%" (src/config.ts
 * STOREFRONT_EDGE, which Step 20 also reconciles) and the game-settings houseEdge 1 % (src/config.ts
 * NOMINAL_HOUSE_EDGE, E23), which RTP-CLAIM 1.2.0 counts as published. The claim is the HIGHER of the
 * two RTPs, so a published figure raised at either source moves the claim the rule holds, and the run
 * ends RTP FIGURE OVERSTATED, exit 5, instead of Step 20's own FLAG (exit 2) deciding it. Until this
 * change the claim was the literal '0.9952', a hand copy of STOREFRONT_EDGE: raising the storefront
 * figure alone gave a Conditional Pass.
 */
function rtpOfEdge(edge: number, name: string): string {
  const e = Math.round(edge * 1e8);
  if (!Number.isInteger(e) || e < 0 || e >= 1e8 || e / 1e8 !== edge) throw new Error(`${name} ${edge} is not an exact 8-decimal edge`);
  return String((1e8 - e) / 1e8);
}
const PUBLISHED_RTPS = [rtpOfEdge(STOREFRONT_EDGE, 'STOREFRONT_EDGE'), rtpOfEdge(NOMINAL_HOUSE_EDGE, 'NOMINAL_HOUSE_EDGE')];
const HELD_RTP = PUBLISHED_RTPS.reduce((a, b) => (Number(b) > Number(a) ? b : a));

export const RTP_CLAIM: RtpClaim = {
  kind: 'flat',
  rtp: HELD_RTP,
  source: 'LIQD Blackjack: the game page liqd.com/originals/blackjack shows "Released: June 2026 | Edge: 0.48%" = RTP 99.52 %, the figure held here, and its structured data gives RTP 99.52% (read 2026-10-01, evidence/rtp-page-labels-2026-10-01.json; first seen as "Edge: 0.48%" on the game surface, E16; src/config.ts STOREFRONT_EDGE). The same page also shows "RTP (optimal play) 99.51%" and "House Edge 0.49%". The config label houseEdge 1% (LIQD\'s game-settings response, E23; src/config.ts NOMINAL_HOUSE_EDGE) is a second, lower figure (RTP 99 %); RTP-CLAIM 1.2.0 counts a stated edge in the game settings as published, and a setting within the band of 99.52 % is also above 99 % less the band, so holding 99.52 % covers it',
};

/** The scored step that carries BLACKJACK-19 (src/profile-map.ts). */
export const RTP_CLAIM_STEP = 20;

export const RTP_CLAIM_TABLE = path.join(__dirname, '..', 'outputs', 'rtp-claim-table.json');
/** SHA-256 of the committed table — re-pin with the run that rewrote it (npm run rtp-claim:write). */
export const RTP_CLAIM_TABLE_SHA256 = '9e447e3bfb9514d6f01adf90af4e366c17bb1b5431ad632ea7bd753ad990cb27';

export function computeRtpClaim(): RtpClaimResult {
  const buf = fs.readFileSync(path.join(__dirname, '..', 'outputs', 'exact-rtp.json'));
  if (createHash('sha256').update(buf).digest('hex') !== EXACT_RTP_SHA256) throw new Error('outputs/exact-rtp.json does not match its pin');
  const x = JSON.parse(buf.toString('utf8')).finite8TD;
  const r = rationalFromDouble(x.rtpPerInitialBet);
  const acc = new RtpClaimAccumulator(RTP_CLAIM);
  acc.add('main game, 8-deck basic strategy (TD), per initial bet', r.n, r.d);
  return acc.result();
}

export function rtpClaimTableText(r: RtpClaimResult): string {
  return rtpClaimTable(r, {
    package: 'liqd/blackjack', game: 'blackjack',
    settingSpace: 'one setting: the main game under the single rule set, 8-deck shoe, basic strategy (side bets are separate wagers, not in this table)',
    rtpMethod: 'outputs/exact-rtp.json finite8TD.rtpPerInitialBet (exact finite-shoe DP in double precision, oracle-anchored); the rule is exact on that double',
  });
}

export function runRtpClaimGate(): RtpClaimGate {
  const r = computeRtpClaim();
  return rtpClaimGate(r, rtpClaimTableText(r), RTP_CLAIM_TABLE, RTP_CLAIM_TABLE_SHA256);
}

if (require.main === module) {
  const text = rtpClaimTableText(computeRtpClaim());
  fs.writeFileSync(RTP_CLAIM_TABLE, text);
  console.log(`wrote outputs/rtp-claim-table.json sha256 ${createHash('sha256').update(text).digest('hex')}`);
}
