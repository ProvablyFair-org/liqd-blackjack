# LIQD Blackjack Fairness Audit

**Auditor:** [ProvablyFair.org](https://www.provablyfair.org)  
**Operator:** LIQD.com · **Game:** Blackjack (`fast-games-11`) · **Audit ID:** PF-2026-LQ01

**Audit result: PASS for the assessed pre-production sample. Certification status: provisional pending production verification.**

This repository contains the independent reference implementation, captured game records, mathematical analysis and executable checks for LIQD Blackjack. All **6,000 captured rounds** reproduce card for card, all **120 server-seed commitments** match their reveals, and all checked payouts match the assessed rules. The **31 defined verification checks pass**.

The capture was collected on **5 August 2026, 18:31–20:18 UTC**, through one authenticated account on **`qa.liqd.com`**, using USDC. This is the completed audit of that sample. The provisional certification identifies the next stage: an anonymous capture through the public production site, with the additional checks described below. Production behavior is not assumed to match the QA environment.

## What the audit verifies

| Verified result | Evidence |
|---|---|
| **6,000 / 6,000 rounds reproduce**, covering **34,734 cards**, 5,599 unsplit rounds and 401 split rounds | Independent seed-to-card reconstruction and recorded action order; verification Step 6 |
| **120 / 120 revealed seeds match their SHA-256 commitments**; **119 / 119 next-seed links reconcile** | Recorded commitments and reveals; Steps 1–2 |
| **6,401 / 6,401 player-hand payouts match the rules**; **6,000 / 6,000 round totals reconcile** | Card-derived settlement calculations compared with API-reported amounts; Step 8 |
| **5,800 Perfect Pairs**, **5,800 21+3** and **446 insurance** payouts reconcile | Independent category and payout calculations; Steps 10, 15–16 and 28 |
| **Custom client seeds influence results** | In the 500-round custom-seed phase, substituting the client seed changes the first card in **490 / 500** rounds; Step 26 |
| **99.512325% base-game RTP per initial bet** | Deterministic evaluation of the declared eight-deck basic-strategy model; [exact RTP artifact](outputs/exact-rtp.json) |
| **0.487675% house edge per initial bet**, or **0.432435% per total wagered** | The same mathematical solve, expressed using two wager denominators |
| **Specified shuffle statistics pass on 500,000 locally generated rounds** | First-card rank uniformity and lag-1/runs tests of the reference shoe algorithm; Step 18 |
| **31 / 31 verification checks pass** and **77 unit tests pass** | [Verification results](outputs/verification-results.json), `tests/verify.ts` and `tests/blackjack/` |

The seed inputs determine the reference shoe order. Player actions determine how that shoe is consumed; captured split, double and dealer draw sequences are checked against the dealing rules. Payout verification concerns the recorded game settlements, with exact comparisons in the capture's 1e-8 accounting units.

The headline RTP evaluates the strategy in `src/strategy.ts`, excluding side bets and insurance. The model assumes surrender and re-splitting are unavailable; their availability was not independently probed. Its arithmetic is checked against an exact-rational small-shoe oracle and the recorded Wizard of Odds reference. The committed **30-million-round simulation** differs by **0.04 standard errors (rounded)**, inside the defined 3-standard-error check. Full derivation and qualifications are in [AUDIT_CONTEXT.md](AUDIT_CONTEXT.md#5-game-mathematics).

## Findings

No card-reconstruction or payout discrepancies were identified in the assessed sample. The following game disclosures are relevant to players:

- **House-edge presentation:** The captured nominal 1% configuration label differs from the calculated base-game edge. The storefront's **0.48%** figure also differs: the calculated **0.487675% per initial bet rounds to 0.49%**, while the **0.432435% per total wagered rounds to 0.43%**. The operator should state the applicable figure and convention.
- **Perfect Pairs:** The captured paytable pays **25:1 for a perfect pair, 13:1 for a coloured pair, and 6:1 for a mixed pair**. All **5,800 captured bets** match the independently calculated categories and payouts. The calculated house edge is **2.168675%**.
- **21+3:** All **5,800 captured bets** match the independently calculated categories and payouts. The calculated house edge is **3.703913%**.

Matching commitments establish consistency with recorded seeds. They do not establish that the operator selected those seeds without considering prospective returns. The audit's first-card statistic does not demonstrate reliable detection of return-based seed selection. This distinction and the player-controlled client-seed workflow are explained in [the scope section](AUDIT_CONTEXT.md#8-scope-and-technical-qualifications).

## What the audit excludes

- Production behavior, other games, and accounts, periods or configurations outside the captured sample.
- Independent wallet-balance reconciliation, deposits, withdrawals, custody and account systems.
- Server infrastructure, seed-generation entropy, key custody and assurance against return-based seed selection.
- Hidden-information exposure or seed rotation while a round remains open.
- Promotional, bonus and loyalty behavior, and limits not exercised by the capture.

Dataset provenance rests on the auditor's capture record. File hashes establish the identity and integrity of the published evidence; they do not independently authenticate its real-world origin. Technical coverage and model qualifications are consolidated in [AUDIT_CONTEXT.md](AUDIT_CONTEXT.md#8-scope-and-technical-qualifications).

## Production verification and provisional certification

The planned anonymous production capture will repeat the existing verification through the public site and extend the evidence collected during play.

| Production work | Evidence added and certification effect |
|---|---|
| Capture through the ordinary public game flow, recording environment, date, rules and available version identifiers | Establishes production coverage for the tested sample; removes reliance on the QA environment for the production assessment |
| Record wallet balances and available transaction records around initial wagers, splits, doubles, insurance and settlement | Enables expected debits and credits to be reconciled with wallet movements |
| Record each action and its target hand; exercise surrender/re-split availability and insurance choices | Confirms model inputs and supports exact settlement attribution for partially doubled split rounds |
| Inspect pre-settlement responses and test rotation while a round is open | Adds evidence about hidden-card protection and seed-reveal timing on the tested paths |
| Record the commitment before submitting a freshly generated client seed; preserve failed requests and nonce transitions | Tests the player-controlled protection against advance seed selection and improves visibility of interrupted play |
| Preserve the ordered request/response record across multiple sessions and accounts where feasible | Strengthens capture provenance and broadens coverage |

These are planned checks, not results of this release. The production assessment will be issued after its results are reviewed and any material discrepancies are resolved. Each extension will state what was actually exercised. Internal server operations, unbiased selection for every player workflow and behavior outside the tested sample remain separate scope questions.

## Reproduce the results

With **Node.js 22 or later**, install the locked development dependencies and run the source tests and full-dataset verifier:

```sh
npm ci
npm test
```

Expected: **77 tests passed**, then **Passed: 31/31** and **PROVABLY FAIR — Full Pass**, with exit code **0**. The verifier's Full Pass describes its defined checks; the certification scope above remains provisional for production. Verifier exit code **2** means a Conditional Pass with a flagged check; **1** means failure.

The included JavaScript bundles also run without installing dependencies:

```sh
node test.js       # 77 unit tests from the standalone snapshot
node verify.js     # 31 scored verification checks from the standalone snapshot
```

`npm test` exercises the current TypeScript sources. The standalone files are executable snapshots of the release. Additional analyses, including `npm run rtp` and `npm run mutate -- 13`, use the installed source toolchain.

| Command | Behavior |
|---|---|
| `npm test` | Tests the TypeScript sources through `test:toolchain` |
| `npm run test:standalone` | Tests the included JavaScript bundles without dependency installation |
| `npm run test:toolchain` | Tests the TypeScript sources; use this when reviewing source changes |
| `npm run verify` | Runs source verification; rewrites `outputs/verification-results.json` and `outputs/report-figures.json` |
| `npm run rtp` | Recomputes `outputs/exact-rtp.json` deterministically |
| `npm run attack` / `npm run branches` | Recomputes the seed-selection experiment / RNG branch-coverage artifact |
| `npm run mutate` | Runs the **42-entry** mutation registry in a disposable copy; separate from `npm test` |
| `npm run simulate` / `npm run test:full` | Runs a new simulation and replaces the simulation JSON and convergence chart; use a disposable copy when comparing with published results |

`node verify.js` and the source verifier both write directly to `outputs/`. The deterministic verification products reproduce from the included evidence. A new Monte Carlo run uses fresh randomness and will produce different figures. The deterministic solve supplies the headline RTP.

## Dataset integrity

```text
data/blackjack-6000hands.json
SHA-256  c2a28c5164a546105963ffb4ff8e7c422a68802df47afcdcfa0b4fdbad1fdbf7
```

```sh
shasum -a 256 data/blackjack-6000hands.json
```

The loader verifies this hash before using the data. The full [claim-to-evidence map](AUDIT_CONTEXT.md#2-claim-to-evidence-map), algorithm, worked bets and scope are in **[AUDIT_CONTEXT.md](AUDIT_CONTEXT.md)**.

Licensed under the [MIT License](LICENSE).
