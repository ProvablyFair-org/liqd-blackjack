# LIQD Blackjack — Provably Fair Audit

**Auditor:** [ProvablyFair.org](https://www.provablyfair.org) · **Audit ID:** `PF-2026-LQ01` · **Release:** `v1.0.0` (the first public release) · **Capture:** 5 August 2026, `qa.liqd.com`

**Result: PROVABLY FAIR — Full Pass** *(provisional — pre-launch capture)*. 31/31 scored steps pass, with 0 flags and 0 hard fails. All 6,000 captured hands recompute card-for-card from their `(serverSeed, clientSeed, nonce)` inputs, all 120 seed epochs were revealed and hash to their commitments, and every payout matches the result reconstructed from the cards. "Pre-launch" means the dataset was captured on LIQD's pre-production host `qa.liqd.com`, not the public `liqd.com`; that production serves the same build is not established (DL-7).

**Scope:** Blackjack (`gameId` `fast-games-11`) in USDC: 8 decks, reshuffled every hand, dealer stands on soft 17, blackjack 3:2, insurance 2:1, double on any two, double after split, split on matching value, one card to split aces, US peek. Re-split, surrender and declining insurance are ASSUMED in the captured hands, not observed; one insurance offer declined with LIQD's own button on 13 October 2026 booked no insurance bet (E18). The exact basic-strategy house edge is **0.487675% per initial bet (0.432435% per total amount wagered)**, RTP 99.512325%, assuming insurance is declined; with insurance on every offer, as the capture's rounds carried it, it is 0.7612%. Side bets: Perfect Pairs 2.17%, 21+3 3.70%. Stakes of $0.10 and $10 were tested; LIQD's maximum-profit cap and its Face-Down Double setting were not exercised. Theoretical RTP is not a promise about an individual session's return.

## What was verified

| Check | Captured evidence |
|---|---|
| Card reproduction | 6,000 of 6,000 hands, including all 401 split rounds, card-for-card from the revealed seeds. The RNG code, `src/rng.ts`, was rebuilt from a written specification ([docs/ALGORITHM.md](docs/ALGORITHM.md)) by an implementer who never opened LIQD's code; LIQD's own code (the validation vectors from the specification it supplied privately) is run as a second check, not used as the source |
| Seed records | 120/120 commitments match their reveals; 119/119 next-seed links; nonces 0–49 in every epoch |
| Payouts | 6,401 of 6,401 per-hand credits reconstructed from the cards; 243 naturals at 3:2; 446 insurance bets at 2:1 iff dealer natural |
| Rules | nine rules observed on the cards; re-split, surrender and the insurance decline ASSUMED |
| Side bets | 5,800 Perfect Pairs (25/13/6) and 5,800 21+3 (100/40/30/10/5) bets, 0 mismatches |
| Theoretical RTP | exact 8-deck solve, anchored to a tiny-shoe oracle at 1e-12 and the published Wizard of Odds figure (0.48768%) |
| Simulation evidence | 30,000,000-round sanity harness at 0.51σ; 1,000,000-round real-shoe pass; 120 revealed seeds × 10,000 nonces cherry-pick screen |
| Observed return | 98.0209% over the capture, a reconciliation reported separately from theoretical RTP |

The largest open residual is server-seed selection: Step 19 detects a strong grind but has little power against mild selection, so a player is protected by setting a fresh client seed after the commitment is published. All nineteen declared limitations are in the [overview's limitations](MANIFEST.md#limitations-and-trust).

## Run the audit

Open a terminal in the package directory. Use **Node 22.x**, as declared in [.nvmrc](.nvmrc) and [package.json](package.json).

```sh
npm ci
npm test
```

Expected: **117 unit tests pass; 31/31 PASS · PROVABLY FAIR — Full Pass; REPRODUCED; exit 0.** `npm test` runs the staleness gate, the compiled unit suite (`node test.js`), the scored verification (`node verify.js`) and `node scripts/release-manifest.mjs --check`. It replays every captured hand and scores the committed simulation; it does not rerun the simulation. `test.js` and `verify.js` need nothing but Node and are build products of the TypeScript in `src/` and `tests/`.

```sh
npm run test:toolchain            # build check, Mocha and verification from source
npm run test:full                 # replays the simulation from its pinned master seed into outputs/run/
```

Exit 0 is a Full Pass, 2 a Conditional Pass (any FLAG), 5 RTP FIGURE OVERSTATED (the enforced RTP-CLAIM 1.2.0 rule finds the published RTP figure overstated; not a draw fail), 1 a FAIL or a reproduction beyond tolerance. Ordinary runs write only to `outputs/run/`. See [reproduction details](MANIFEST.md#reproduce-the-audit) for the commands, the comparison rule, the replay tools, the mutation battery and the deliberate artifact-refresh procedure.

## Verify a bet

Rotate your seed pair to reveal the server seed, then check that SHA-256 of the seed's hex text equals the commitment you saw before playing, rebuild the 416-card shoe and read the deal off it. The [ProvablyFair.org LIQD verifier](https://audit.provablyfair.org/casino/liqd/tools/verify-bets) does this in the browser; the [complete instructions](MANIFEST.md#verify-a-bet) give the field names, the split draw order and a runnable Node script with a worked split round from this dataset.

## Files and evidence

There are two documentation files: this README and [MANIFEST.md, the audit overview](MANIFEST.md). The overview contains the rules, algorithm, RTP calculation, verification results, evidence register, limitations and release history.

- [Captured hands](data/blackjack-6000hands.json) — SHA-256 `c2a28c5164a546105963ffb4ff8e7c422a68802df47afcdcfa0b4fdbad1fdbf7`. Blackjack has no paytable file; the rules are declared in `src/config.ts`.
- [Verification results](outputs/verification-results.json), [exact RTP](outputs/exact-rtp.json), [simulation results](outputs/simulation-results.json), [RTP claim table](outputs/rtp-claim-table.json) and [release manifest](RELEASE-MANIFEST.json).
- [Evidence images and records](evidence/), including LIQD's game-settings response (E23), the read of its insurance request (E24) and one hand with insurance declined through LIQD's own button (E18).
- [Audit report](https://audit.provablyfair.org/casino/liqd/games/blackjack/overview) · [Public repository](https://github.com/ProvablyFair-org/liqd-blackjack) · [MIT license](LICENSE).

The audit ID is confirmed by ProvablyFair.org. The release commit and tag are signed with the ProvablyFair.org release key (SSH, `SHA256:gEujiJm2pRyq7lQsfYQfQ1r97H/J7GdaKHbOW8GtikY`), which the release manifest records.
