# LIQD Blackjack — Audit Overview

**Audit ID:** `PF-2026-LQ01` · **Auditor:** ProvablyFair.org · **Release:** `v1.0.1` (errata to `v1.0.0`, the first public release) · **Framework:** 1.1

Game: Blackjack (`gameId` `fast-games-11`) on LIQD.com, captured against `qa.liqd.com` in USDC from an authenticated browser session. Audited August 2026. Dataset of record: one session on **5 August 2026**, from `2026-08-05T18:31:22.042Z` to `2026-08-05T20:18:54.442Z`. Publication date: 21 October 2026 (release `v1.0.0`). Report: `https://audit.provablyfair.org/casino/liqd/games/blackjack/overview`. The audit ID is confirmed by ProvablyFair.org. The machine-readable release identity is [RELEASE-MANIFEST.json](RELEASE-MANIFEST.json).

## Conclusion and scope

**PROVABLY FAIR — Full Pass, provisional — pre-launch capture (31/31 scored steps, 0 flags, 0 hard fails).** Every one of the 6,000 captured hands recomputes card-for-card from its `(serverSeed, clientSeed, nonce)` inputs; the commit-reveal chain is intact across all 120 seed epochs (120/120 revealed); every payout matches the blackjack result reconstructed from the cards. Nine rules are read directly off the dealt cards. Three are ASSUMED, not observed: re-split and surrender, which the capture never attempted, and that insurance can be declined, which the capture never did with LIQD's own decline request.

"Pre-launch" means the dataset was captured on 5 August 2026 on `qa.liqd.com`, LIQD's pre-production host, not on the public `liqd.com`. It does not refer to the "Released: June 2026" label LIQD's game page shows (read 1 October 2026, [evidence/rtp-page-labels-2026-10-01.json](evidence/rtp-page-labels-2026-10-01.json)). The certification applies to the audited build; that `liqd.com` production serves the same game build is not established by this capture (DL-7). Production parity will be confirmed by an anonymous post-launch capture, and the certification page reflects provisional status until that verification completes.

**Return to player.** The 8-deck basic-strategy house edge is **0.487675% per initial bet (0.432435% per total amount wagered)**, RTP **99.512325% / 99.567565%**. It is an **exact** solve of the real 416-card shoe, anchored to an exact-rational tiny-shoe oracle at 1e-12 and agreeing with the published Wizard of Odds figure for this rule set (0.48768%) to within one unit of its last published digit (exact 0.4876748%, delta −5.2e-6 pp). That agreement checks that the engine lands on the published figure; it does not certify the published fifth decimal, since Wizard of Odds' continuous-shuffler figures resolve only to about 1e-4 pp. A 30,000,000-round fair-shuffle simulation is consistent at 0.51σ; at σ = 0.0210 pp it is a 3σ sanity harness, not the precision instrument. The headline assumes insurance is declined, as basic strategy does. With insurance on every offer, as the capture's rounds carried it, the house edge is **0.7612%** per initial bet (Step 28, DL-17).

**Scope.** In scope: the RNG (HMAC-SHA256 draw and backward Fisher-Yates over an 8-deck shoe; the modulo-bias rejection branch is ASSUMED, not witnessed), the commit-reveal protocol (commitment, client seed, nonce, next-seed pre-commitment chain, rotation and reveal), the rule set split by how it is evidenced, per-hand payout reconstruction, both side bets against 5,800 live settled bets each, RTP and structured adversarial testing. Out of scope: platform security, account systems, deposits, withdrawals, KYC, responsible-gambling features, other LIQD games, and the server-side entropy source (bounded by the commitment). LIQD is a centralized platform: verifiability rests on commit-reveal, not a blockchain. All hands come from one account and one session, at stakes of $0.10 and $10. LIQD's maximum-profit cap and its Face-Down Double setting were not exercised (DL-19).

**A Full Pass states what was tested, not that nothing is left.** Nineteen residuals are named, measured and left open in the [declared limitations register](#declared-limitations-register). The largest is **DL-1**: return-based server-seed selection is detected only when it is strong. `npm run attack` grinds 50 candidate server seeds per epoch against a non-rotating client seed and takes the capture's served windows from 98.5950% to **68.5331%** RTP per total wagered (98.408% to 64.642% per initial bet); Step 19's money rule flags 34 of the 120 attacked seeds and puts the pooled served-window return at **z = −23.56**, so that grind is detected. A milder one is not: the pooled rule's power is 4.1% against a 2% shortfall in served-window RTP and 61.3% against 5%. What defeats selection is a player action, not a test: **set a fresh client seed after the commitment is published.**

The audit found **no fairness defects**. Its five findings are informational: two player-favourable (F-1, F-2) and three standard disclosures with no player impact (F-3, F-4, F-5); see [Findings](#findings). The improvement items are transparency recommendations, not corrections to fairness.

## Contents

- [Dataset and capture](#dataset-and-capture)
- [Game and algorithm](#game-and-algorithm)
- [Payouts and RTP](#payouts-and-rtp)
- [Verification results](#verification-results)
- [Reproduce the audit](#reproduce-the-audit)
- [Verify a bet](#verify-a-bet)
- [Evidence](#evidence)
- [Limitations and trust](#limitations-and-trust)
- [Terms](#terms)
- [Release history](#release-history)

## Dataset and capture

The auditor records the capture as one authenticated account on **`qa.liqd.com`**, LIQD's pre-production environment, on **5 August 2026, 18:31–20:18 UTC**. Origin, environment and capture timing are auditor-attested facts supported by the capture record and images; they are not established by hashing the dataset. The dataset is [data/blackjack-6000hands.json](data/blackjack-6000hands.json), schema `liqd-blackjack-capture-v1`, structure `{ meta, seeds, bets }`: **6,000 rounds, 6,401 player hands and 34,734 cards** in **120 seed epochs of 50 rounds**, nonces 0–49 in each epoch, all 120 revealed.

| Phase | Hands | Initial stake | Strategy | Side bets | Purpose |
|---|---:|---:|---|---|---|
| A | 3,300 | $0.10 | basic | on | base sample |
| B | 1,000 | $0.10 | aggressive (hits to 17, never doubles) | on | multi-card and dealer-draw lines |
| C | 500 | $0.10 | split-force | on | splits, DAS and split aces; re-split was not attempted (ASSUMED rule) |
| D | 500 | $0.10 | basic, 10 custom client seeds (`pfaudit-…`) | on | client-seed variation |
| E | 200 | $10.00 | basic | off | stake independence (100× the base stake) |
| F | 500 | $0.10 | split-force (one split per round) | on | more split and double coverage |

The plan is recorded in the dataset and in [capture/capture-blackjack.reference.mjs](capture/capture-blackjack.reference.mjs); Step 24 checks phase counts against `src/config.ts`. Side-bet coverage is checked against the capture's request-side declarations. Insurance is present on 446 rounds and is accounted for separately (DL-17).

The play is not always the phase strategy (DL-18). 119 of the 401 split rounds contain an action the phase strategy would not choose, because the capture script took every split-round decision from the main hand's cards while the casino plays the split hand first. The capture's basic table also hits soft 13 to 15 where `src/strategy.ts` doubles (28 rounds). No scored step depends on which action was chosen: every step re-derives from the cards that were dealt.

**Method.** The RNG code, [src/rng.ts](src/rng.ts) (`generateProvablyFairNumber`, `blackjackShoe`, `dealtHands`, `commitHash`, Node.js `crypto` only), was rebuilt from a written specification, [docs/ALGORITHM.md](docs/ALGORITHM.md), by an implementer who never opened LIQD's code. The specification was itself written without LIQD's code, from LIQD's pages, the standard provably-fair construction and the captured rounds, and names the source of every step (its §4). LIQD's own code is run as a second check, not used as the source: the validation vectors from the RNG specification LIQD supplied to the auditor privately are unit tests in `tests/blackjack/rngTests.ts`. The shoe was also matched against verify-endpoint samples during the capture session (not archived) and every revealed commitment was confirmed. Every captured hand is then recomputed card-for-card, every payout reconstructed from the cards and the rules, the RTP solved exactly and simulated, and the structured attack matrix run.

| Input | Identity |
|---|---|
| [data/blackjack-6000hands.json](data/blackjack-6000hands.json) | SHA-256 `c2a28c5164a546105963ffb4ff8e7c422a68802df47afcdcfa0b4fdbad1fdbf7` |

Blackjack is rule-driven, not table-driven: there is no multiplier configuration file to pin. The rule set is single-sourced in `src/config.ts` `RULES`; the solver reads it and `anchor/rules.json` must equal it field for field (Step 25). `src/loader.ts` verifies the dataset bytes against the pin before loading; a mismatch aborts before any step runs.

| Record or field | Meaning and how the steps may read it |
|---|---|
| Seed epoch | `serverSeed` is the revealed hex seed string; `hashedServerSeed` its commitment; `nextHashedServerSeed` the recorded next commitment; `clientSeed` the epoch's client input; `nonceStart`/`nonceEnd` capture-recorded bounds checked against the declared population |
| Round | `id`, `epoch`, `nonce`, `hashedServerSeed`, `phase`, `actions`, `playerHands`, `dealerHand`, `winningAmount`, `sideBets`. Use `bets[].clientSeed` where present, else the seed record's |
| Player hand | `cards`, `betAmount`, `winningAmount`, `result`. The recorded `won` label includes pushes, so payout reconstruction derives the result from the cards. For a doubled hand its own `winningAmount` is the base portion |
| Dealer hand | complete cards revealed at settlement, including the hole card; this does not describe what was exposed during play |
| Side bet | Perfect Pairs, 21+3 or insurance, with stake, return and result/category |
| Round `winningAmount` | written by the capture script: its own sum of the casino's credit records, including double-bet records it did not store. Step 8b claims only that each double bet was credited like its hand on the 1,283 doubled rounds; it cannot detect a skim by the casino |
| `split`, `doubled` | capture-script summaries; no rule is read from them; they must agree with the action tokens (Steps 6 and 12) |
| `actions` | the requests the script sent, in order (`no-ins` = its insurance request, DL-17); bound to the cards: hit plus double tokens equal the cards drawn, and the grammar must hold (Step 6) |
| Per-round `hashedServerSeed`, `clientSeed` | script stamps, bound to the seed records by Step 3 and to the revealed seed and the cards by Steps 1 and 6 |
| `nonce` on 145 rounds | the script's own count, on rounds recorded from the partial insurance response (an Ace-up dealer natural settles at the peek), which omits the nonce and `serverSeedId`; each still reproduces its cards (Step 6) inside the window Step 4 closes |
| `meta.houseEdge`, `meta.payout` | values typed into the script (`meta.houseEdge: 0.01` copies the nominal 1% label); bound to `src/config.ts`; the operator's own figure is E23 |
| `sideFunded`, `sideReturned` | request-side declaration (both side bets on 5,800 rounds, neither on the 200 Phase E rounds) and response-presence flags; a coverage denominator, not wallet evidence (DL-4) |
| `localSequence`, `verified`, `commitVerified`, `chainLinkOk` | the script's own recomputation; deleted by `src/loader.ts` before any step runs |

```js
const seed = dataset.seeds.find(s => s.hashedServerSeed === bet.hashedServerSeed);
const clientSeed = bet.clientSeed ?? seed.clientSeed;
```

`serverSeedId` is an optional operator identifier, not the join key. `dealerPoints` is an operator summary and reads 0 in **381** rounds: 138 dealer two-card naturals, 253 rounds where the player held a natural, 10 both. The round ended before the dealer played out. Epoch 0 nonce 12 reports `dealerPoints = 0` while the dealer holds 17. Every dealer total in this audit is computed from `dealerHand`; a verifier that filtered on `dealerPoints == 21` would miss 131 ten-up naturals and wrongly conclude the game does not peek on a ten. [src/types.ts](src/types.ts) states each script-written field and why the steps may read it.

## Game and algorithm

### Rules: nine observed, three assumed

| Rule | Basis | Finding | Evidence in the dataset |
|---|---|---|---|
| Decks | OBSERVED | 8 (416-card shoe), reshuffled each hand | shoe reproduced card-for-card for 6,000/6,000 hands |
| Blackjack pays | OBSERVED | 3:2 | 243 winning player naturals returned exactly 2.5× |
| Insurance | OBSERVED | 2:1 | 145 insurance wins returned exactly 3.0×, only on a dealer natural |
| Dealer soft 17 | OBSERVED | stands (S17) | finished on soft 17 without drawing in 108 rounds (106 where the dealer played the hand out, 2 settled early on a player natural); never drew on 17 or more |
| Peek | OBSERVED | US peek / OBO on Ace and ten upcards | across 152 Ace-up and 131 ten-up dealer naturals, 0 hands lost a double or split wager to the natural |
| Double | OBSERVED | any first two cards | 1,283 rounds doubled; on non-split hands doubles accepted on every two-card total 5–20 (16 totals); the non-strategic doubles are in phases C and F; Phase B has none |
| Double after split | OBSERVED | allowed (DAS) | 165 rounds both split and doubled |
| Split | OBSERVED | on matching value | 401 splits, including 134 mixed ten-value pairs (Q+10, K+10, J+K …) |
| Split aces | OBSERVED | one card only | 35 split-ace rounds (70 hands), each the ace plus one card |
| Re-split | **ASSUMED** (never exercised) | no third hand observed; the RTP engine assumes no re-split | of 401 split rounds, 141 post-split hands re-paired (63 same-rank, 78 mixed ten-value) and every round settled with 2 hands. Re-split was not attempted: the capture script splits once; whether the casino offered it was not recorded. LIQD's game page states "split once" ([evidence/rtp-page-labels-2026-10-01.json](evidence/rtp-page-labels-2026-10-01.json)), an operator statement, not an observation |
| Surrender | **ASSUMED** (never exercised) | no surrender action observed; the RTP engine assumes no surrender | no `surrender` token in 6,000 rounds; vocabulary `hit`, `stand`, `double`, `no-ins`, `split`. The capture script has no surrender call, so "not offered" cannot be distinguished from "offered and never used" |
| Insurance can be declined | **ASSUMED** in the dataset (never sent by the capture); witnessed once outside it (E18) | the RTP (99.512325%) assumes insurance is declined | the capture sent `place-insurance-bet {betAmount: 0}` (logged `no-ins`); the casino booked and settled a half-stake insurance bet on all 446 offers. LIQD's UI declines with `{acceptInsurance: false}` (E24), which the capture never sent (DL-17). On 13 October 2026 one offer on qa was declined with LIQD's own NO button: the page sent `{acceptInsurance: false}`, LIQD answered 200 and the settled hand carries no insurance bet (E18) |

This is a mainstream **8-deck / S17 / DAS / split-aces-one-card / dealer-peek** game plus the three ASSUMED rules, which are working RTP-engine assumptions, not findings. The game surface states two headline payouts on the felt, *"BLACKJACK PAYS TO 3 TO 2"* [sic] and *"INSURANCE PAYS 2 TO 1"*, beside the two side-bet spots (E12). Peek is shown structurally: across all 283 two-card dealer naturals no hand shows a double, a split or a third player card. Under a no-peek rule those extra-wager losses would appear. The hole card exists at `shoe[3]` from the moment the shoe is shuffled, so the peek reveals a card already fixed.

### Commitment and seed lifecycle

LIQD Blackjack is a commit-reveal, no-beacon game: no drand, no block hash. The server seed is a hex string committed as `SHA-256(utf8(serverSeed hex string))` (the Stake convention), not the hash of the decoded bytes. For the first epoch, `SHA-256(utf8("6dca5e36b6b9dc56730e282ab3c2bae6")) = 948eff896b5521c1064402dcd5557342210e03e0c4e864d0b83418bfb5e12f42`, the recorded `hashedServerSeed` (Step 1, 120/120). Each epoch also publishes `nextHashedServerSeed`, a pre-commitment to the next epoch's hash (Step 2, 119/119 links).

That each hash was published before the hands it governs cannot be proven from the dataset alone. It is evidenced by the pre-capture rotation probe in `meta.preCapture` (the seed active when the capture connected hashes to its commitment, and its published next-seed hash is epoch 0's commitment) and by the next-seed chain. E13 and E14 show the panel and the commit-reveal identity, but no seed from the dataset. The seed pair is account-wide, shared across Mines, Blackjack and Plinko.

An epoch is 50 hands under one (serverSeed, clientSeed) pair: commit (LIQD publishes the hash and next hash; the player sets or keeps a client seed), deal (for nonce 0–49 a fresh 416-card shoe per hand), rotate (the previous server seed is revealed), verify (hash check, then replay all 50 shoes). The shoe is reshuffled every hand, so there is no card-counting surface.

### Seed-to-shoe calculation

```text
HMAC key = hex-decode(serverSeed)
message  = UTF-8(clientSeed + ':' + nonce + ':' + cursor)
digest   = HMAC-SHA256(key, message)

draw(range, cursor):
    maxFair = floor(2^32 / range) * range
    read the digest as eight unsigned 32-bit BIG-ENDIAN chunks
    return chunk % range for the first chunk < maxFair
    if all eight are rejected: not defined by the written spec (O1); src/rng.ts throws

shoe = 8 decks, each suits CLUB, HEART, SPADE, DIAMOND × ranks 1..13 (Ace = 1), "SUIT:rank"
for i = 415 down to 1:
    j = draw(range = i + 1, cursor = i)
    swap(shoe[i], shoe[j])

commitment = SHA-256(UTF-8(serverSeed hex STRING))
```

The HMAC key is the decoded seed bytes; the commitment hashes the seed's text. These are deliberately different encodings. This is the same primitive LIQD Mines uses; here it is anchored on the 6,000 dealt hands reproduced bit-for-bit from their revealed seeds (Step 6), not on a live endpoint. When all eight chunks of a digest are rejected, LIQD's code (its private specification) draws again at `cursor + 1,000,000`; the written spec leaves that case open (O1) and `src/rng.ts` throws instead. No captured draw comes near it (DL-2), and `src/rng-branch-audit.ts`, which produces the table below, still counts LIQD's fallback path.

### Deal and action order

The initial deal is PDPD: player `shoe[0]`, `shoe[2]`; dealer `shoe[1]` (upcard) and `shoe[3]` (hole card). In an unsplit round every player draw (hits, the double card) follows in order, then every dealer draw. In a split round:

```text
shoe[0..3]   main[0], dealer[0], split[0], dealer[1]     the initial deal, PDPD
shoe[4]      main[1]                                     one automatic card to the MAIN hand
shoe[5]      split[1]                                    one automatic card to the SPLIT hand
then         the SPLIT hand plays out, then the MAIN hand, then the dealer
```

An implementation that feeds `shoe[4:]` to the hands in the obvious order reproduces every unsplit round and **fails 255 of the 401 split rounds**. `tests/steps/parity.ts` (`splitDealtSequence`) implements the order above, and Step 6 checks all 401 split rounds card-for-card in strict order, so swapping two post-split draws between hands is rejected. Step 6 also requires hit plus double tokens to equal the cards drawn beyond each hand's two-card start; that is a token/card consistency check, not a re-derivation of the strategy decisions. Insurance and the side bets use cards from the deal and introduce no separate draw.

### The rejection branch is ASSUMED, not witnessed

The 6,000-hand recomputation proves the server produced the same cards as this implementation on the paths the data visited. Instrumenting all **2,490,000** draws (6,000 shoes × 415) in [outputs/rng-branch-coverage.json](outputs/rng-branch-coverage.json):

| Measurement | Result |
|---|---|
| Draws needing more than the first 4-byte chunk | **0** |
| Analytic expectation of such draws across the capture | **0.0569** |
| Draws taking the `cursor += 1,000,000` fallback | **0** |
| Analytic probability of that fallback anywhere in the capture | **2.0 × 10⁻⁵²** |

A server doing a plain `chunk % range` with no rejection would have produced byte-identical data with probability **94.47%**, so the reproduction evidences the accept path only and modulo-bias rejection sampling is ASSUMED of the server (DL-2). If rejection were omitted, the exposure over the 415 ranges a shoe consumes is ≤ **2.3 × 10⁻¹⁰** maximum point bias (range 257) and ≤ **2.4 × 10⁻⁸** total-variation distance per draw (range 413): immaterial to any EV figure quoted at six decimals, and recorded because "immaterial" is not "proven".

### Independent validation and client-seed influence

The algorithm is validated on the accept path by commit-reveal parity on every revealed epoch (Step 1) and by full recomputation of all 6,000 hands (Step 6) with `src/rng.ts`, which was rebuilt from [docs/ALGORITHM.md](docs/ALGORITHM.md), not from LIQD's code. LIQD's code is a second check: its validation vectors are unit tests (`tests/blackjack/rngTests.ts`), and a live verify-endpoint cross-check was made during the capture session (request/response pairs not archived). Example: server seed `6dca5e36…`, client seed `audita6d2…`, nonce 0 gives `shoe[0..3] = HEART:7, CLUB:10, HEART:9, HEART:11`, so player `HEART:7, HEART:9` against dealer `CLUB:10, HEART:11`; the player draws `shoe[4] = HEART:5` to 21 and wins, as recorded.

The client seed enters every draw. Under a wrong and an empty client seed, 974 of 1,000 sampled hands deal a different first card; the rest are the ≈1/52 expected collisions (Step 7). A changed seed reshuffles the deck; it does not guarantee that every card differs. Step 7 shows dependence, not when the seed was chosen.

## Payouts and RTP

### Settlement rules

A return includes the stake. The evaluator derives totals and naturals from the cards rather than the operator's outcome label.

| Condition, evaluated in this order | Total return |
|---|---:|
| Player bust | 0 |
| Player natural and dealer natural | 1 × stake |
| Player natural, dealer not natural | 2.5 × stake |
| Dealer natural, player not natural | 0 |
| Dealer bust | 2 × stake |
| Player total exceeds dealer | 2 × stake |
| Equal totals | 1 × stake |
| Player total below dealer | 0 |
| Insurance with dealer natural | 3 × insurance stake |
| Insurance without dealer natural | 0 |

A two-card 21 after a split is not a natural; each split hand is settled on its own stake. Side bets pay Perfect Pairs 25 / 13 / 6 and 21+3 100 / 40 / 30 / 10 / 5 to 1.

**Doubles.** A doubled hand's own `winningAmount` records the base portion only, because the doubled stake settles as a separate bet with the same outcome. Of the 1,448 doubled hands, scaling per hand would fail the **638** credited a nonzero amount; the 810 that lost are credited 0 either way. The double is therefore reconciled at round level by Step 8b: the round credit must equal `(Σ per-hand winningAmount) × m + Σ side-bet winningAmount`, with `m = 2` when every hand doubled and `m = 1` when none did. A split where only one hand doubled cannot be attributed from the flat action log and is bounded rather than solved (0 outside bounds); no captured split round doubles only one hand, because the capture took both decisions from the main hand's cards (DL-18). On a round with no double the total is compared with its own parts, so the identity cannot detect a skim by the casino.

**Accounting precision.** [src/money.ts](src/money.ts) reads amounts into integer units of **1e-8**, the captured records' grid (not a claim about USDC's on-chain precision). Steps 8–10 and 15–16 compare money by exact integer equality; 42,894/42,894 checked amounts lie on the grid. Mutations R34 (a credit 50 units short) and R35 (one unit short) must fail; R11 perturbs a credit by 1e-9 and the grid assertion rejects it. The only tolerance, `GRID_TOL`, is 1e-3 grid units for reading a JSON double back onto the grid; the worst representation deviation is 1.2 × 10⁻⁷ units (epoch 68 nonce 38, `5.800000000000001`; epoch 25 nonce 38, `4.299999999999999`), which read as exactly 5.80 and 4.30. At the sample's stakes of $0.10 and $10 every payout lands exactly on the grid.

### Base-game RTP

The headline is the expected return of the total-dependent (TD) basic-strategy table in [src/strategy.ts](src/strategy.ts) on an eight-deck shoe reshuffled each round, with 3:2 naturals, S17, DAS, peek/OBO and one card to each split ace. It assumes no surrender and no re-split (both ASSUMED, DL-5) and insurance declined (ASSUMED, DL-17). It does not claim this policy is optimal among composition-dependent strategies. [src/exact-play.ts](src/exact-play.ts) enumerates the initial rank draws without replacement (drawing rank `r` from counts `c` has probability `c[r] / sum(c)` and decrements the count), then evaluates the declared policy and dealer play by dynamic programming, including the hole-card conditioning after a negative peek. "Exact" means deterministic evaluation of this model without Monte Carlo error; the implementation uses floating point. With `G` the net profit and `W` the total base-game wager per round, in initial stakes:

```text
E[G] = -0.004876748223247249
E[W] =  1.1277411600701008

House edge per initial bet = -E[G]          = 0.4876748223247249%
RTP per initial bet        = 1 + E[G]       = 99.51232517767528%
House edge per total wager = -E[G] / E[W]   = 0.43243506541377884%
RTP per total wager        = 1 + E[G]/E[W]  = 99.56756493458622%
```

The two conventions differ by the average wager per round (1.127741, from doubles and split stakes). Neither includes side bets or insurance. With insurance on every offer the house edge is **0.7612%** per initial bet (RTP 99.2388%), by exact enumeration over the 416-card shoe (Step 28). Split valuation uses linearity of expectation under the fixed policy and the two-hand limit; the shared-shoe hands need not be independent for their expected returns to add. The solver's composition-dependent (CD) mode carries a known ≈1/N conditioning approximation under peek (flagged `cdPeekIsApproximate`), so it is a coarse internal diagnostic and no finite-shoe CD figure is published.

| Method | RTP | House edge | Convention / source |
|---|---:|---:|---|
| **Exact 8-deck, basic strategy (authoritative)** | **99.512325%** | **0.487675%** | per initial bet; [outputs/exact-rtp.json](outputs/exact-rtp.json), `finite8TD` |
| Same solve, element of risk | 99.567565% | 0.432435% | per total amount wagered |
| Wizard of Odds, published, same rule set | — | 0.48768% | per initial bet; basic strategy with continuous shuffler |
| Fair-shuffle simulation (sanity harness) | 99.5230% | 0.4770% | per initial bet; 30,000,000 rounds, ±0.0210 pp 1σ; 99.5771% per total wagered |
| Infinite-deck limit (regression anchor only) | 99.4296% | 0.5704% | with replacement; not LIQD's RTP |

**Simulation.** Stored simulated edge 0.4769583333% against the exact 0.4876748223%. The standard error is `1.15 / sqrt(30,000,000)` = 0.0209960314 pp, where 1.15 is the configured gate constant (the per-round SD measured on the run is 1.146621, shipped as `sdPerRound`, so the verifier never takes its tolerance from the simulator). Difference over SE is 0.51040546, reported as 0.51σ within the 3σ check; per total wagered the run reads 0.4229% against 0.432435%, also 0.51σ. The master seed is pinned, so `npm run simulate` reproduces this run; a different seed would land elsewhere inside the ±0.0210 pp band, which is why the exact solve is the published figure.

**Why an exact solve and not an infinite-deck bound.** An infinite-deck solver (99.4296% / 0.5704%) models dealing with replacement and only bounds the true value from below; a gate against it would have to allow the card-removal lift plus Monte Carlo error, a 0.32 pp window on a 0.49% quantity. Against an exact target the gate is Monte Carlo error alone (Step 17). [src/optimal-play.ts](src/optimal-play.ts) keeps the infinite-deck value as a regression anchor, pinned at 1e-9; the solver in infinite mode reproduces 99.429612% to 1.1e-15.

**Card removal.** The exact 8-deck value sits **+0.0827 pp** above the infinite-deck limit (`cardRemovalLiftPP`), the direction card removal predicts; a finite solve below the limit would signal an error. Two caveats: `exact-rtp.json` computes it via `solveExact({infinite},'CD')` (0.08271318994886867) and the simulation artifact via `computeOptimalRTP` (0.08271318994897969), equal to float-summation order; and it is a mixed-convention gap (finite TD minus infinite CD). Solving the infinite deck under TD gives 0.571192% against 0.570388% (CD), so the like-for-like TD−TD lift is ≈0.0835 pp.

**Deck-count sensitivity.** One deck under the same rules and table gives **−0.083726%** (`finite1TD`), a 0.571 pp swing. Wizard of Odds' own 8-deck → 1-deck delta at this rule set is 0.602 pp (its 1-deck figure is −0.11442%). The remaining **0.031 pp** is *consistent with* playing the 8-deck TD table on one deck instead of a single-deck table, and is **not computed here** (DL-11). No published figure depends on it.

The real-shoe Pass 1 reading (99.4977% per initial bet, ±0.1150 pp 1σ, −0.13σ from the exact solve, Step 18) checks that the real RNG plays to the engine; with that error it is not an RTP method.

### House-edge label and storefront figure (F-1)

| Source | Figure | What it is |
|---|---|---|
| LIQD's game-settings response (`/api/v1/fast-games/system/get-game-settings`, saved 2026-06-29, E23), `houseEdge: 1` for `fast-games-11` | 1% | nominal internal config label |
| Game surface (storefront, E16) | **0.48%** | the figure shown to players |
| This audit, per initial bet | **0.4876748223%** | exact 8-deck basic-strategy edge |
| This audit, per total amount wagered | **0.4324350654%** | element of risk, average wager 1.127741 |

The exact edge is well under the 1% label under both conventions, so that field over-states the edge (player-favourable). Against the 0.48% surface figure: per initial bet the edge is 0.0076748223 pp above it; it rounds to 0.49% and **truncates** to 0.48%; per total wagered it shows 0.43% either way. Step 20 reconciles the surface figure at its own resolution (one display unit = 0.01 pp) and records a **note, not a flag**. How LIQD's copy arrives at 0.48% is not visible from the client and is not claimed. The live `liqd.com` page read on 1 October 2026 shows `Edge: 0.48%` in its header and `House Edge 0.49%`, `RTP (optimal play) 99.51%` in its stats panel ([evidence/rtp-page-labels-2026-10-01.json](evidence/rtp-page-labels-2026-10-01.json)).

### Side bets

Perfect Pairs uses the player's initial two cards; 21+3 adds the dealer upcard. Odds are profit to stake; a winner also receives its stake.

| Perfect Pairs category | Profit odds | Total return | 2-card combinations | Probability given the first card |
|---|---:|---:|---:|---:|
| Perfect pair (same rank and suit) | 25:1 | 26 | 1,456 | 7/415 |
| Coloured pair (same rank and colour) | 13:1 | 14 | 1,664 | 8/415 |
| Mixed pair (same rank, other colour) | 6:1 | 7 | 3,328 | 16/415 |
| No pair | — | 0 | 79,872 | 384/415 |

```text
Perfect Pairs RTP = (7 × 26 + 8 × 14 + 16 × 7) / 415 = 406/415 = 97.8313253012%
House edge        = 9/415 = 2.1686746988%
```

The coloured-pair 13:1 is one pip richer than the common 12:1, which roughly halves the edge: at 12:1 the edge would be 4.096% (return 95.904% against 97.831%). All 5,800 Perfect Pairs bets reconcile (Step 15): 100 perfect at 25:1, 123 coloured at 13:1, 234 mixed at 6:1, 5,343 no pair; 457 wins, a 7.88% hit rate against 31/415 = 7.47%, each category paid with zero variance. The live return was 596.00 on 580.00 wagered (102.76%), a variance illustration only.

| 21+3 category | Profit odds | Total return | Combinations |
|---|---:|---:|---:|
| Suited three of a kind | 100:1 | 101 | 2,912 |
| Straight flush | 40:1 | 41 | 24,576 |
| Three of a kind | 30:1 | 31 | 61,568 |
| Straight | 10:1 | 11 | 368,640 |
| Flush | 5:1 | 6 | 700,928 |
| No match | — | 0 | 10,753,536 |

```text
Weighted total return = 2,912 × 101 + 24,576 × 41 + 61,568 × 31 + 368,640 × 11 + 700,928 × 6 = 11,470,944
21+3 RTP              = 11,470,944 / 11,912,160 = 96.2960873595%
House edge            = 441,216 / 11,912,160 = 4596/124085 = 3.7039126405%
```

[src/sidebet-edges.ts](src/sidebet-edges.ts) enumerates the 52 card identities with eight copies each, checking total weights against `C(416,2) = 86,320` and `C(416,3) = 11,912,160`, with the same [src/sidebets.ts](src/sidebets.ts) evaluator Steps 15–16 use. All 5,800 21+3 bets reconcile, with 1 / 14 / 32 / 166 / 345 wins in paytable order; example epoch 19 nonce 32, `DIAMOND:4, DIAMOND:8` with upcard `DIAMOND:12`, settles `FLUSH` and returns `0.60` on `0.10`.

**Live page figures.** The `liqd.com/originals/blackjack` page read 1 October 2026 shows Perfect Pairs "House edge 2.17%" (9/415 rounded) and 21+3 "House edge 3.63%" beside the same 100/40/30/10/5 paytable and an eight-deck shoe. 3.63% is not the exact edge of that paytable: the same method over 7, 8 and 9 copies of each card gives 4.099567%, 3.703913% and 3.393463%, so no whole deck count yields it; counting K-A-2 as a straight gives 0.265409% at eight decks and not counting Q-K-A gives 7.142416%. The page does not say how 3.63% was obtained. The package keeps 4596/124085 = 3.703913%, the exact edge of the paytable the page states, which the 5,800 captured settlements follow (Step 16). No step or verdict changes.

### The exchangeRate field (F-3)

Side-bet records carry `exchangeRate` = `1.00` on all **12,046** of them (5,800 Perfect Pairs + 5,800 21+3 + 446 insurance). It appears only beside the `fiat*` fields, which are zero throughout; 0 main-game hands carry it. Its role as a fiat display conversion is inferred from its name and shape, not demonstrated. What is proven is that no haircut is observable: every crypto payout reconciles at face value from the cards (Steps 8, 21). At 1.00, "applied at 1.00" and "not applied" are indistinguishable; a rate ≠ 1.00 would settle it; a `0.99` value seen on LIQD side-bet records outside this dataset is not archived here (DL-8).

### Observed sample return

```text
Base-game stakes $2,992.60 + side-bet stakes $1,160 + insurance stakes $86.65 = $4,239.25; returns $4,155.35
Observed return including insurance = 4,155.35 / 4,239.25 = 98.0208763343%
Observed return excluding insurance = 4,089.05 / 4,152.60 = 98.4696334826%
```

These are a reconciliation, not an RTP measurement: blackjack's per-hand SD is ≈1.14, so over 6,000 hands the RTP error is roughly ±1.5 pp equal-weighted and ±6 pp money-weighted (an effective ~332 rounds once the $10 Phase E stakes dominate), and phases B, C and F deliberately play suboptimally. Insurance here is the 446 half-stake bets the casino booked on the capture's decline request (86.65 wagered, 66.30 returned; DL-17). Player naturals: 253 of 6,000 = 4.22% against the 8-deck expectation of ≈4.75%, a −1.9σ shortfall within normal range for one capture.

## Verification results

The 31 scored steps in `tests/verify.ts` evaluate the 6,000 rounds captured on 5 August 2026. All 31 PASS, with 0 flags and 0 hard fails: `PROVABLY FAIR — Full Pass` *(provisional — pre-launch capture)*, exit 0. Each step carries the ProvablyFair.org Blackjack profile checks it implements (`profileIds`, from `src/profile-map.ts`) in [outputs/verification-results.json](outputs/verification-results.json).

| Step | Check | Result |
|---:|---|---|
| 1 | Commitment reveal | PASS: 120/120 revealed seeds hash to their commitment (`SHA-256(utf8(serverSeed))`) |
| 2 | Pre-commitment chain | PASS: 119/119 next-seed links recomputed from the raw hash fields, plus the pre-capture anchor |
| 3 | Within-epoch hash consistency | PASS: 120 epochs, 0 hash violations; every round carries its epoch's one client seed |
| 4 | Nonce continuity | PASS: every epoch is exactly 0…49 (`NONCE_BASE`): 0 missing, 0 repeated, 0 out of order, window closed at nonceEnd on 120/120 |
| 5 | Epoch size | PASS: 120 epochs, all exactly 50 hands |
| 6 | Recomputation parity | PASS: 6,000/6,000 hands card-for-card (5,599 unsplit, 401 split). Draw-bias bound printed: maxFair for all 415 ranges, bias exactly 0, rejection census 0 in 2,490,000 draws against 0.0569 expected, the branch shown on a vector. The vendored ProvablyFair.org site verifier reproduces all 401 split rounds and the first round of every epoch |
| 7 | Client-seed dependence | PASS: over 1,000 rounds the first card survives a wrong and an empty seed 26 and 18 times against the 1/52 model (gate E + 5σ = 40.9). The pinned capture rig is bound to the data on 120/120 epochs; its provenance is circumstantial (DL-16) |
| 8 | Per-hand payout | PASS: 6,401/6,401 per-hand credits reconstruct from the cards and rules; Step 8b: 6,000/6,000 round totals equal their parts |
| 9 | Blackjack pays 3:2 | PASS: 243 winning naturals return 2.5× |
| 10 | Insurance pays 2:1 iff dealer natural | PASS: 446 insurance bets, 145 wins at 3.0× only on a dealer natural; 0 false wins, 0 missed wins |
| 11 | Dealer stands on soft 17 | PASS: 108 soft-17 stands; 0 over-draws, 0 under-draws; 177 early player-natural settlements exempt and counted |
| 12 | Double after split | PASS: 165 of 401 split rounds carry both `split` and `double` tokens, derived from the action stream; the script's summary booleans must agree, and do |
| 13 | Dealer peeks | PASS: 283 dealer naturals (152 Ace-up, 131 ten-up); no player lost split or double money to one |
| 14 | No surrender action observed | PASS: no `surrender` token in 6,000 rounds; this shows surrender was never taken, not whether it is offered (ASSUMED rule) |
| 15 | Perfect Pairs | PASS: 5,800 bets from the initial two cards, 0 category and 0 payout mismatches; 25/13/6 reproduced (100 perfect, 123 coloured, 234 mixed) |
| 16 | 21+3 | PASS: 5,800 bets match the 100/40/30/10/5 paytable |
| 17 | Basic-strategy RTP vs exact solver | PASS: exact TD edge 0.487675% per initial bet (0.432435% per total wagered), recomputed in-step; simulation 0.4770%, 0.51σ against a 3σ limit; first convergence checkpoint (1,000 rounds) re-drawn from the master seed |
| 18 | Simulation Pass 1 | PASS: 1,000,000 real-shoe rounds, every statistic re-derived from 100 census rows: first-card χ² 6.73 (df 12, p = 0.8752), serial \|r₁z\| 0.57, runs p 0.6387, RTP 99.4977% vs exact 99.5123% at −0.13σ; rows 0 and 99 re-dealt |
| 19 | Simulation Pass 2, cherry-pick | PASS: 120 revealed seeds × 10,000 nonces. Money rule: 1/120 seeds at p ≤ 0.01 (family gate 6); pooled served-window net −95.5 vs exact mean −29.26 at per-round SD 1.146686, z = −0.746 (gate −3.09); casino split order gives −112.5 and z = −0.94. Power 0.8 / 4.1 / 61.3 / 100.0% at a 1 / 2 / 5 / 10% shortfall; against the 50-candidate grind 34/120 flag, pooled z −23.56. Rank screen: 7 flags vs 5.7 (P = 0.3444). Fresh client seed after commitment in 110 of 120 epochs, so this cannot show whether the casino selects seeds (BJ-S5-05) |
| 20 | House-edge reconciliation | PASS: 1% label (E23) is nominal; exact edge under it in both conventions; storefront 0.48% is the per-initial-bet edge truncated, within one display unit; side-bet edges 9/415 and 4596/124085 |
| 21 | No FX haircut observed | PASS: `exchangeRate` = `1.00` on all 12,046 side-bet records; no haircut observable; requires `fxRecords > 0` |
| 22 | Bet-size invariance | PASS: 200 Phase E hands at $10.00 recompute; the shoe derivation takes no wager argument |
| 23 | Side-bet config completeness | PASS: all 3 Perfect Pairs and all 5 21+3 categories exercised |
| 24 | Phase coverage and labels | PASS: A 3,300 · B 1,000 · C 500 · D 500 · E 200 · F 500, as planned in `src/config.ts`; the dataset's phase table agrees on count and stake |
| 25 | Artifact hash integrity | PASS: ten pinned artifacts present and matching; every numeric leaf of the nine JSON artifacts of record inside its declared domain, none carrying run metadata; rules single-sourced; `outputs/report-figures.json` re-derived field for field |
| 26 | Phase D client-seed variation | PASS: 500 hands under 10 auditor seeds; 490/500 change the first card vs a baseline seed; the seeds were predictable, epochs 96–105 (DL-15) |
| 27 | Split rules | PASS: 401 splits, 0 value-mismatched pairs, 35 ace splits drawing one card, 0 rounds above two hands (re-split ASSUMED). Floors met: splits 401/200, ace splits 35/20, DAS 165/100, doubles 1,448/500, insurance on a dealer Ace 446/100 |
| 28 | Insurance offer condition | PASS: 446 records, every one on a dealer Ace and one per capture insurance request; insurance booked on all 446 offers (DL-17); edge with insurance on every offer 0.7612% |
| 29 | Side-bet deal-time invariance | PASS: 11,600 side-bet card snapshots equal the initial two cards |
| 30 | Deck-model confirmation | PASS: 1,269 rounds contain a duplicate card (refutes single-deck), maximum 3 copies (within 8 decks). Informational: first-card χ² 13.401 (df 12, p = 0.3406); naturals 253 player and 283 dealer against 284.7 expected |
| 31 | Stake bracket bounds | PASS: every round at its phase's planned stake ($0.10; $10.00 in Phase E) |

**Edge-case coverage.** Insurance was offered on 446 of the 462 Ace-up rounds; the 16 without an offer are player naturals, and 7 of the 152 Ace-up dealer naturals were on player naturals. Of 253 player naturals, 243 won at 3:2 and 10 pushed against a dealer natural (example: epoch 7 nonce 26, player `SPADE:13, SPADE:1` against dealer `DIAMOND:1, CLUB:12`, credited `0.10`). Split aces: epoch 4 nonce 48 settles as `[CLUB:1, SPADE:2]` and `[CLUB:1, HEART:3]`. The S17 replay tests over-draw and under-draw; it closes the gap Step 6 leaves, since Step 6 compares dealt cards against a prefix of the shoe and cannot know how many cards a round should consume.

**Coverage assertions.** Steps 22–31 each carry a coverage assertion, so a pass over an empty set cannot occur. Step 21 requires `fxRecords > 0` and FLAGs without it (R23). Expected counts in Steps 1–6 and 24 come from `src/config.ts`, not the dataset header, because a count the file under test supplies shrinks with the file.

**Statistics.** Pass 1 first-card uniformity (df 12) and lag-1/runs serial independence over 1,000,000 real-shoe rounds are consistent with a fair shuffle; they cannot see suit bias or later-position bias. Fairness of the shoe is established by construction (backward Fisher-Yates over an HMAC-SHA256 stream, reproduced card-for-card); the statistics are its negative control. Step 30's live-sample fit is informational under the profile policy decided on 29 September 2026: a misfit prints **INFO**, never counted and never a change to the verdict or exit code. On the committed run the fit holds.

### Adversarial matrix

| ID | Category | Result | Detail |
|---|---|---|---|
| BJ-S5-01 | Outcome integrity | Pass | 6,000/6,000 reproduce (Step 6) |
| BJ-S5-02 | Commitment binding | Pass | 120/120 (Step 1) |
| BJ-S5-03 | Seed substitution | Pass | next-seed chain intact (Step 2) |
| BJ-S5-04 | Nonce manipulation | Pass | no reuse or gaps (Step 4) |
| BJ-S5-05 | Server-seed cherry-picking | **Not closed: detected only when strong** | Step 19 money rule finds no anomaly on the capture and detects the 50-candidate grind; power 0.8 / 4.1 / 61.3 / 100.0% at a 1 / 2 / 5 / 10% shortfall; the rank screen alone does not detect the grind (8 flags vs 5.7, P = 0.2117). The working defence is the client seed set after the commitment, for a player who rotates (DL-1) |
| BJ-S5-06 | Client-seed neutering | Pass | changing the seed changes the shoe; Phase D seeds reproduce (Steps 7, 26) |
| BJ-S5-07 | RNG bias, marginal | Pass | χ² 6.73 (df 12, p = 0.8752) over 1,000,000 rounds (Step 18) |
| BJ-S5-08 | RNG bias, serial | Pass | r₁ = 0.000573 (\|r₁z\| = 0.57), runs p = 0.6387 (Step 18) |
| BJ-S5-09 | Payout manipulation | Pass | 6,000/6,000; no fx factor on any crypto payout (Steps 8, 21) |
| BJ-S5-10 | Hidden rake via fx | Pass | no observable haircut; applied-at-1.00 and not-applied indistinguishable (DL-8) |
| BJ-S5-11 | Side-bet manipulation | Pass | both side bets fixed at the deal, 0 mismatches (Steps 15, 16, 29) |
| BJ-S5-12 | Rule drift | Pass | S17, peek, DAS consistent (Steps 11–14); surrender ASSUMED, the capture has no surrender call (DL-5) |
| BJ-S5-13 | Edge misrepresentation | Pass | exact edge under the 1% label; 0.48% is the truncated per-initial-bet edge (Step 20) |
| BJ-S5-14 | Money-path integrity | **Pass, credit side only** | per-hand credits reconstruct (Step 8); the stake side has no `balance` or `delta` field anywhere, so a mis-recorded stake on a losing hand leaves no trace (DL-4) |
| BJ-S5-15 | Post-split draw order | Pass | swapping two post-split draws between hands is rejected (Step 6) |
| BJ-S5-16 | Dealer draw-rule deviation | Pass | 0 over-draws, 0 under-draws (Step 11) |
| BJ-S5-17 | Verifier circularity | Pass | `src/loader.ts` deletes the four capture-side recomputation fields on load, asserted in `antiCircularityTests.ts`; a source grep is a second, weaker lint layer |
| BJ-S5-18 | Mid-round seed rotation | **Not tested: disclosed** | the rig settles every hand before rotating, so the race was never driven (DL-9, R-RACE) |

No house-favourable exploit was found. BJ-S5-05 → DL-1, BJ-S5-10 → DL-8, BJ-S5-12 → DL-5, BJ-S5-14 → DL-4, BJ-S5-18 → DL-9. Blackjack keeps a round open across hit, stand, double and split, so it has a time-of-check-to-time-of-use surface that single-call games do not: if the pair could be rotated mid-round, the active server seed would be revealed before the remaining cards were dealt. ProvablyFair.org has found this bug class on another operator's game, so it is recorded as open rather than assumed closed.

S5: fairness-integrity matrix; game-integrity testing not commissioned.

### Findings

| ID | Finding | Severity | Player impact |
|---|---|---|---|
| F-1 | Config `houseEdge` label (1%, E23) is a nominal internal field; exact edge 0.487675% per initial bet (0.432435% per total wagered), well under it | Informational | player-favourable vs the 1% label |
| F-2 | Coloured pair pays 13:1 (common: 12:1), confirmed on 123 live coloured-pair wins | Informational | player-favourable, verified |
| F-3 | `exchangeRate` field on side-bet records, `1.00` on all 12,046 | Informational | none observable |
| F-4 | LIQD's own verification is server-side: its verify button POSTs to a server endpoint and the shuffle is not in the client bundle | Informational | none: this audit ships a verifier rebuilt from a written specification (docs/ALGORITHM.md) |
| F-5 | Seed cherry-picking not structurally preventable (no beacon) | Informational | low for a player who rotates the client seed after the commitment; not bounded otherwise |

F-1 and F-3 are worked through in [Payouts and RTP](#payouts-and-rtp). F-2: the 25/13/6 table was wagered on every eligible hand and is an observed constant; its 2.17% edge is combinatorial. F-4 is a transparency limitation, not a fairness defect. F-5 is detailed in [Limitations and trust](#limitations-and-trust); the structural fix is an external beacon or a public seed-generation commitment.

**Baseline-deviation review.** Re-derivation shows the game behaves as the operator's model says; it cannot notice that the model departs from what a player would assume. This comparison is the review class that catches the both-naturals and hole-card-leak family.

| Standard 8-deck baseline | LIQD observed | Disposition |
|---|---|---|
| 8 decks, S17, DAS, split aces one card, peek/OBO, 3:2 | confirmed off the dealt cards (Steps 9–14, 27–30) | conforms |
| Blackjack pays 3:2 | 243 winning naturals returned exactly 2.5× | conforms |
| Both naturals push | under OBO the dealer natural is revealed first; a player natural pushes against it (Step 8 reconciles all 6,000) | conforms; the both-naturals overpay class was checked and is absent |
| Hole card concealed until the player's turn resolves | no hole card in any pre-settlement field the capture recorded | conforms as captured; the mid-round disclosure sweep is a live-testing item, a scope boundary (DL-10) |
| Insurance 2:1, offered only on a dealer Ace | 145 wins at 3.0×; all 446 records on a dealer Ace; booked on all offers | conforms; the decline itself was not observed (DL-17) |
| Re-split and surrender availability | no third hand and no surrender in 6,000 rounds; neither was attempted | deviation unresolved (availability), ASSUMED rows (DL-5) |
| Advertised edge ≈ derived edge | 0.48% advertised; 0.487675% per initial bet; label 1% | reconciled at the surface's resolution (Step 20), a note; label over-states (F-1) |
| Standard side-bet paytables | coloured pair 13:1 | disclosed, player-favourable (F-2) |

No undisclosed house-favourable deviation was found.

## Reproduce the audit

Use **Node.js 22.x**, pinned in `package.json` `engines` and `.nvmrc`; a derived statistic's last bits are runtime-dependent. From the package directory:

```sh
npm ci
npm test
```

`npm test` needs nothing but Node 22 and runs four stages: (1) `node scripts/check-standalone.mjs`, a dependency-free staleness gate that re-hashes every TypeScript source, the tsconfig, the lockfile and the build scripts against `standalone-manifest.json`, and requires the audit ID and the counts quoted in this file and the README to equal `src/config.ts` and the committed results; (2) `node test.js`, the unit suite; (3) `node verify.js`, the 31-step verification, which also compares its output with the committed artifacts and runs the RTP-CLAIM rule against `outputs/rtp-claim-table.json`; (4) `node scripts/release-manifest.mjs --check`. Expected: **117 unit tests pass; 31/31 PASS · PROVABLY FAIR — Full Pass; REPRODUCED; exit 0.** `test.js` and `verify.js` are build products of `src/` and `tests/` (`npm run build`, `scripts/build-standalone.mjs`), not a second implementation; `npm run check:build` recompiles and compares the emitted bytes. `npm run test:toolchain` (build check, Mocha, `npm run verify`) is the source path.

The unit suite is Mocha, **117 tests** across eleven files under `tests/blackjack/`, and the zero-install runner exits 1 unless that many ran: `rngSpecTests.ts` (the spec self-test the clean-room implementer wrote with `src/rng.ts`: the five worked rounds of [docs/ALGORITHM.md](docs/ALGORITHM.md) §5 and 142 vector and property checks); `rngTests.ts` (a real captured shoe, the PDPD deal, the commitment hash, the operator's validation vectors from the RNG specification LIQD supplied to the auditor, run as a second check, and the depth-uniformity guard driving the shared shuffler); `optimalPlayTests.ts` (infinite-deck drift guard at 1e-9); `exactSolverTests.ts` (solver mutation battery, 8-deck drift pin at 1e-12, and a deep-compare plus byte identity of `exact-rtp.json` against a live `buildExactArtifact()`); `exactOracleTests.ts` (tiny-shoe oracle at 1e-12); `wooAnchorTests.ts`; `antiCircularityTests.ts`; `sideBetEdgeTests.ts` (9/415 and 4596/124085); `roundEngineTests.ts` (binds `src/round-engine.ts` to the exact TD solve within 5σ per initial bet, a window of 5 × 1.15 / √2,000,000 × 100 = **0.4065864 pp**, with a companion test proving the gate can fail and a depth witness, a valid round consuming 33 cards); `replayTests.ts` (the retained simulation inputs and five negative controls); and `artifactTests.ts`, which (a) asserts eight SHA-256 pins (`DATASET_SHA256`, `SIMULATION_SHA256`, `SIMULATION_HTML_SHA256`, `EXACT_RTP_SHA256`, `ATTACK_SHA256`, `RNG_BRANCH_SHA256`, `SIMULATION_PROVENANCE_SHA256`, `BOOTSTRAP_NULLS_SHA256`) and that the deep-replay report carries the shipped method sentence, (b) round-trips the JSON artifacts against canonical `JSON.stringify(..., null, 2)`, which catches formatting only, and (c) binds the simulation's declared experiment to `src/config.ts`.

| Command | Purpose |
|---|---|
| `npm run verify` | the 31-step verification from source; writes `outputs/run/` and rewrites `outputs/run/report-figures.json`, which Step 25 reconciles |
| `npm run simulate` | replay the committed simulation from `SIM_MASTER_SEED` into `outputs/run/` with a field-by-field diff (`outputs/run/simulation-diff.json`) |
| `npm run test:full` | Mocha, the simulation replay, then verification |
| `npm run rtp` | regenerate `outputs/exact-rtp.json`, byte-identical every run |
| `npm run attack` | measure the return-based seed grind against Step 19 (deterministic) |
| `npm run branches` | replay every draw through an instrumented draw primitive (deterministic) |
| `npm run calibrate` | fresh-seed calibration of the Step 18 uniformity test; writes no committed artifact |
| `npm run mutate` | the declared mutation battery in a disposable copy |
| `npx ts-node src/deep-replay.ts` | re-deal all three passes; 282 values, all exact except two Pass-1 p-values held to 1e-14 absolute + 1e-12 relative |
| `python3 replay/replay-bootstrap.py` | independent Python standard-library reconstruction of the Pass-2 bootstrap |
| `python3 replay/replay-capture-play.py` | how the capture was played: 5,599/5,599 unsplit and 401/401 split rounds reproduced, 119 off the phase strategy, 28 soft 13–15 hits (DL-18); not scored |
| `python3 replay/replay-served-split-order.py` | the served rounds in both split orders: −95.5 and −112.5; not scored |

**Reproduction gate.** `npm run verify` compares fresh results with the committed artifacts field by field and writes `outputs/run/diff.json` with the runtime. Exact content (dataset, seeds) must be byte-identical; derived floats agree within **1e-14 absolute + 1e-12 relative** (`|a-b| <= atol + rtol*max(|a|,|b|)`), and distinct integers never agree. Exit **0** = Full Pass; **2** = Conditional Pass (any FLAG); **5** = RTP FIGURE OVERSTATED (the enforced RTP-CLAIM 1.2.0 rule finds the published figure overstated; not a draw fail); **1** = any FAIL or a reproduction beyond tolerance. Only `PF_EMIT=1` rewrites a committed artifact.

**The simulation is not rerun by `npm test`** (it takes about eight minutes). The pin protects a third party against drift or substitution; it does not make the repo self-proving against its publisher, who could regenerate and re-pin. Every random input derives from one 32-byte master seed generated for the 12 September 2026 run, recorded as `masterSeed` and pinned since 24 September as `SIM_MASTER_SEED`:

```text
seed(domain, i) = first 16 bytes of HMAC-SHA256(key = hex-decoded masterSeed,
                                                message = "blackjack-seed-derivation-v1:<domain>:<i>")
```

| Experiment | Derivation domain | Retained as |
|---|---|---|
| Pass 0, 30,000,000-round fair-shuffle reference | `pass0-reference-shuffle`, index 0 → xoshiro128\*\* stream (`src/prng.ts`) | the master seed plus `baseGame.rngStream`/`rngSeedDomain` |
| Pass 1, 1,000,000-round real-shoe pass | `pass1-shoe-server` / `pass1-shoe-client`, index 0 | the seed pair, and 100 exact census rows of 10,000 nonces |
| Pass 2, 120 revealed seeds × 10,000 nonces | none: the dataset's revealed seeds | per-seed rank counts and the net of all 200 money windows (`earlyFreq`, `lateFreq`, `windowNet2`) |
| Pass 2, 2,000 bootstrap replicates | `pass2-bootstrap-server` / `-client`, index = replicate | the 2,000 statistics in `outputs/bootstrap-nulls.float64le` |

Measured runtimes: `npm run simulate` 5 min 7 s on 24 September 2026 on a 12-core machine; `src/deep-replay.ts` 3 min 18 s; `replay-bootstrap.py` 2 min 9 s on 6 workers. The scored run re-deals a declared sample: Step 17 the first checkpoint, Step 18 rows 0 and 99 (20,000 shoes), Step 19 every seed's served window and one declared later window, with 41 of the 2,000 bootstrap replicates re-derived in place and all 120 `earlyBootstrapP` values recomputed from the retained bytes. About 1 regenerated simulation in 100 will show a single-run uniformity flag by chance; `npm run calibrate` over 300 fresh-seed replicates found the p-values uniform (a representative run read Kolmogorov–Smirnov p ≈ 0.28 and pooled p ≈ 0.06; illustrative, not pinned).

**Mutations.** [tests/mutations.json](tests/mutations.json) declares **86** mutations (84 until 14 October 2026; the last full run, 2 October 2026, executed 133 layers with 0 failures; the two added on 14 October 2026, M84 and M85, were run on their own, see the release history), each naming the guard it must break, run by `npm run mutate` in a throwaway copy. Entries with `repin: true` run two layers: the edit alone, which the hash pin rejects, then the edit with the pin moved, which proves the scored step itself catches it. Example: index 13, R10, changes the epoch 0 nonce 12 natural's return from 0.25 to 0.20 on a 0.10 stake; after re-pinning, Step 8 must fail. Index 12, R9, changes the epoch 0 revealed seed; Step 1 must fail. R37 changes `src/round-engine.ts`'s natural settlement from 2.5 to 2 and turns a named assertion red; R34/R35 (50-unit and one-unit underpayments), R36 (6:5) and R38 (the shuffle frontier capped at 24 in the shared implementation) must also fail. The registry count is not an execution claim, and `npm run mutate` is not inside `npm test`.

For deliberate artifact maintenance only:

```sh
PF_EMIT=1 npm run verify          # rewrites outputs/verification-results.json and outputs/report-figures.json
PF_EMIT=1 npm run simulate        # rewrites the simulation outputs; the four simulation pins must then move in a diff
npm run rtp-claim:write           # then update RTP_CLAIM_TABLE_SHA256 in src/rtp-settings.ts
npm run build                     # after any source edit, then npm test
node scripts/release-manifest.mjs
node scripts/release-manifest.mjs --check
```

The release generator requires README.md and MANIFEST.md and checks that both carry the audit ID. Only the Node.js `crypto` module is trusted: no LIQD code, no network call.

## Verify a bet

The steps use the field names of [data/blackjack-6000hands.json](data/blackjack-6000hands.json) and need only Node.js.

1. **Where the seed is revealed.** Before play, LIQD's provably-fair **Seeds** panel shows the **Active Server Seed (Hashed)** (`hashedServerSeed`) beside the **Active Client Seed**, and under **Rotate Seed Pair** the next seed's hash (E13). Rotating the pair reveals the retiring server seed; all 120 retired seeds in this capture were recorded from the rotate response (`seeds[].serverSeed`). The player-facing screen that displays a revealed seed was not captured (E14 is an auditor-rendered card). Rotate first, then verify hands from the retired pair.
2. **Which fields to take.** From the round: `clientSeed`, `nonce` (0 for the first round after a rotation), `hashedServerSeed`, `playerHands[].cards`, `dealerHand`, `actions`. After rotation: `serverSeed`.
3. **Check the commitment.** SHA-256 of the `serverSeed` hex **string** as UTF-8 text, not of the 16 bytes it decodes to, must equal `hashedServerSeed`.
4. **Rebuild the shoe.** 8 decks in the order CLUB, HEART, SPADE, DIAMOND × ranks 1 (ace) … 13 (king), 416 cards `SUIT:rank`. Backward Fisher-Yates: for `i` = 415 down to 1, draw `j` over `range = i + 1` with `cursor = i` and swap. One draw: `HMAC-SHA256(key = hex-decoded serverSeed, "clientSeed:nonce:cursor")`, eight 4-byte big-endian integers, the first below `maxFair = floor(2^32 / range) × range`, taken mod `range` (this rejection step is in the written spec, [docs/ALGORITHM.md](docs/ALGORITHM.md) §2 Step 2, ASSUMED of LIQD's server and never exercised by a captured draw); if all eight reject, the spec gives no rule (O1) and the script stops with an error. No captured draw rejected even its first chunk.
5. **Read the deal off the shoe.** Without a split: player `shoe[0]`, `shoe[2]`; dealer `shoe[1]`, `shoe[3]`; then the player's draws, then the dealer's. With a split: main `shoe[0]`, dealer `shoe[1]`, split `shoe[2]`, dealer `shoe[3]`; `shoe[4]` to main, `shoe[5]` to split; then the split hand's draws, the main hand's, the dealer's (`playerHands[0]` is the main hand).

Filled in with a split round from this dataset (epoch 0, nonce 17, bet `3m23L83zl9B5BKXg2HE3o`: main `DIAMOND:8 SPADE:8`, split `CLUB:8 HEART:10`, dealer `HEART:6 DIAMOND:11 CLUB:9`):

```js
// save as check-hand.mjs and run: node check-hand.mjs
import { createHash, createHmac } from 'node:crypto';
const serverSeed = '6dca5e36b6b9dc56730e282ab3c2bae6';   // seeds[].serverSeed, revealed after rotation
const hashedServerSeed = '948eff896b5521c1064402dcd5557342210e03e0c4e864d0b83418bfb5e12f42';
const clientSeed = 'audita6d2fe11bb1f', nonce = 17;

console.log('commitment ok:', createHash('sha256').update(serverSeed, 'utf8').digest('hex') === hashedServerSeed);
const key = Buffer.from(serverSeed, 'hex');
function draw(cursor, range) {
  const d = createHmac('sha256', key).update(`${clientSeed}:${nonce}:${cursor}`).digest();
  const limit = Math.floor(2 ** 32 / range) * range;      // docs/ALGORITHM.md §2 Step 2; rejection unexercised by the capture
  for (let o = 0; o < 32; o += 4) { const v = d.readUInt32BE(o); if (v < limit) return v % range; }
  throw new Error('all 8 chunks rejected: the spec defines no rule (O1)');
}
const shoe = [];
for (let x = 0; x < 416; x++) shoe.push(`${['CLUB', 'HEART', 'SPADE', 'DIAMOND'][Math.floor((x % 52) / 13)]}:${(x % 13) + 1}`);   // §2 Step 3, deck-major
for (let i = shoe.length - 1; i >= 1; i--) { const j = draw(i, i + 1); [shoe[i], shoe[j]] = [shoe[j], shoe[i]]; }
console.log('shoe[0..7]:', shoe.slice(0, 8).join(' '));
// No split: player = shoe[0], shoe[2]; dealer = shoe[1], shoe[3]; then player draws, then dealer draws.
// Split:    main[0] = shoe[0], dealer = shoe[1], shoe[3], split[0] = shoe[2]; main[1] = shoe[4],
//           split[1] = shoe[5]; then the SPLIT hand's draws, then the MAIN hand's, then the dealer's.
```

It prints `commitment ok: true` and `shoe[0..7]: DIAMOND:8 HEART:6 CLUB:8 DIAMOND:11 SPADE:8 HEART:10 CLUB:9 DIAMOND:4`: main `shoe[0]`, `shoe[4]`; split `shoe[2]`, `shoe[5]`; dealer `shoe[1]`, `shoe[3]`, `shoe[6]`, as recorded. The [ProvablyFair.org LIQD verifier](https://audit.provablyfair.org/casino/liqd/tools/verify-bets) runs the same derivation in the browser; Step 6 runs its vendored code (E22) on every split round and the first round of every epoch. LIQD's own verifier (`POST /api/v1/fast-games/provably-fair/verify/blackjack`) was cross-checked live during the capture session; those pairs were not archived and the calculation above does not depend on it. Payouts follow the settlement table in [Payouts and RTP](#payouts-and-rtp).

Worked captured rounds, each matching the recorded cards and returns (first HMAC message `clientSeed:nonce:415`):

| Bet | Epoch / nonce | Server seed · client seed | First digest · first uint32 → j | Dealt sequence | Recorded return |
|---|---|---|---|---|---|
| `6hBu_VAq-lMp3UKjYMS1a` | 0 / 0 | `6dca5e36b6b9dc56730e282ab3c2bae6` · `audita6d2fe11bb1f` | `d1b4e0facbbbc71d6214329ea062281a590b3cc14a2653707bb318a85e306d2f` · 3518292218 → 90 | HEART:7 CLUB:10 HEART:9 HEART:11 HEART:5 | 0.20 (hand 0.20; both side bets 0) |
| `mpWMQllDG1ErqaG6SQR8T` | 0 / 12 | same pair | `f6e45442fcf8453471068cb0e74290eb366cac70b1e8d00ddc18dd803d2c163e` · 4142158914 → 322 | HEART:1 SPADE:8 CLUB:13 DIAMOND:9 | 0.25 (natural 3:2) |
| `FschhjKZOHdrZ6TrMT4So` | 2 / 19 | `462b3034c052f3b381faf7a9df8786c2` · `audit9d3a9fbe9f01` | `133dabd6ed708a2531331c6299ff619172de5121e95e8137fd1ff507f6a19112` · 322808790 → 278 | DIAMOND:12 HEART:1 DIAMOND:6 DIAMOND:10 | 0.15 (insurance 0.05 × 3; hand and side bets 0) |
| `8Kory8RWLJJjAwIhJ1LI5` | 2 / 25 | same pair | `381e244b4a6303dcaa186b2cea436cdb29b0b7da1d8b131a3dd3e045ff064094` · 941499467 → 363 | CLUB:6 CLUB:6 HEART:6 SPADE:13 CLUB:1 CLUB:13 DIAMOND:1 CLUB:1 HEART:7 | 4.60 = 0.40 × 2 + 0.70 (MIXED_PAIR) + 3.10 (THREE_OF_A_KIND) |
| `wJ_oClDC8vPtwpha0-ORM` | 4 / 48 | `60809980f132fd93d87ce744cad6724d` · `audita6c57ff5dc82` | `c008a20b07971832add3e1a86d5357a71efe8b29c594b8812c3fa131b0acd528` · 3221791243 → 203 | CLUB:1 DIAMOND:4 CLUB:1 SPADE:6 SPADE:2 HEART:3 HEART:7 | 2.60 (PERFECT_PAIR; both split-ace hands 0) |

Commitments: epoch 0 `948eff896b5521c1064402dcd5557342210e03e0c4e864d0b83418bfb5e12f42`; epoch 2 `9e7871e9e10b395a061d187faaab96c7d2f7516d3699b525fc956f513bfbbd73`; epoch 4 `f11e19d58373b3d8a583409ffc99d9e251c2556e873a38fff493ec349bbf5f86`. In epoch 2 nonce 19 the player holds hard 16 against an Ace-up dealer natural: the casino booked a `0.05` insurance bet on the capture's `no-ins` request (DL-17), the dealer peeks and the round settles at once. In epoch 2 nonce 25 the sixes are split and both hands doubled (`["split","double","double"]`): hands `CLUB:6 CLUB:1 CLUB:1` (18) and `HEART:6 CLUB:13 DIAMOND:1` (17) win against the dealer's bust 23; the stored total `4.6000000000000005` reads as 460,000,000 units. A matching round verifies that record against its inputs; it does not by itself establish when the commitment was published.

## Evidence

The primary evidence is the 5 August 2026 capture of 6,000 hands and its 120 revealed seeds. Screenshots illustrate interface states; they do not replace the recorded responses.

| ID | File | Evidence and role |
|---|---|---|
| E01 | [data/blackjack-6000hands.json](data/blackjack-6000hands.json) | master dataset, 6,000 hands, 120 epochs, schema `liqd-blackjack-capture-v1`, SHA-256 `c2a28c51…`, guarded by `src/loader.ts` |
| E02 | [outputs/verification-results.json](outputs/verification-results.json) | 31 scored results, 31/31 PASS, with dataset and simulation hashes, step details and informational items |
| E03 | [outputs/simulation-results.json](outputs/simulation-results.json) | the Monte Carlo harness and infinite-deck anchor; carries `exactFiguresSource` pointing at E06e and its own replay inputs; regenerates byte-identical from the pinned master seed. Its `pass2_casino_seeds.description` field cites `operator-trust-analysis.md`, a former file whose content is now [Limitations and trust](#limitations-and-trust) |
| E03a | [outputs/simulation-provenance.json](outputs/simulation-provenance.json) | what produced E03: master seed, derivation `blackjack-seed-derivation-v1` and rule, modules, digests of dataset, E03 and nulls, per-pass sizes, domains and replay commands; names the superseded artifact |
| E03b | [outputs/bootstrap-nulls.float64le](outputs/bootstrap-nulls.float64le) | the 2,000 retained Pass-2 bootstrap statistics, float64 little-endian in generation order, 16,000 bytes |
| E03c | [outputs/bootstrap-replay-report.json](outputs/bootstrap-replay-report.json) | independent Python reconstruction of Pass 2's rank half: all 2,000 statistics byte for byte, both window χ² for 120 epochs (1,300,000 shoes), all p-values and the exact binomial survival; verdict PASS, 0 mismatches; does not replay money windows |
| E03d | [outputs/deep-replay-report.json](outputs/deep-replay-report.json) | in-repo re-deal of all three passes (24,000 money windows), 282 values compared, verdict PASS |
| E03e | [tests/fixtures/legacy-simulation-results.json](tests/fixtures/legacy-simulation-results.json) | an earlier simulation run that predates the pinned master seed, frozen with `LEGACY_SIMULATION_SHA256` for reference only; no figure in this report depends on it. It cites `AUDIT_CONTEXT.md`, a former file now merged into this one. `replayTests.ts` asserts its digest and the absence of every replay field the current release adds |
| E04 | [outputs/rtp-convergence.html](outputs/rtp-convergence.html) | self-contained convergence chart |
| E05 | [src/rng.ts](src/rng.ts) | the RNG, shoe, deal and commitment hash, rebuilt from E05a by an implementer who never opened LIQD's code; Node `crypto` only. Three-way agreement measured on integration (20 October 2026): every card of the 6,000 captured rounds, LIQD's code as given in its private specification, and the site verifier (E22) |
| E05a | [docs/ALGORITHM.md](docs/ALGORITHM.md) | the written specification `src/rng.ts` was rebuilt from (copy of the ProvablyFair.org framework's `games/liqd-blackjack/ALGORITHM.md`, SHA-256 `90e6dbc1…0ffad6`); written without LIQD's code, it names the source of every step (§4), five worked rounds (§5) and the open points (§6) |
| E05b | [src/bias.ts](src/bias.ts), [src/seed-derivation.ts](src/seed-derivation.ts) | this audit's own tooling, moved out of `src/rng.ts` unchanged: the draw-bias bound Step 6 prints (on `src/rng.ts` `maxFairFor`) and the simulation's seed derivation (`blackjack-seed-derivation-v1`) |
| E06 | [src/exact-play.ts](src/exact-play.ts) | exact solver; no operator figure as input; CD mode a demoted diagnostic |
| E06b | [src/strategy.ts](src/strategy.ts) | the basic-strategy table shared by simulation and solver |
| E06c | [src/optimal-play.ts](src/optimal-play.ts) | infinite-deck engine, regression anchor only (99.4296% / 0.5704%) |
| E06d | [anchor/oracle.py](anchor/oracle.py) + [anchor/policy.json](anchor/policy.json) | exact-rational tiny-shoe oracle; fractions control 437/13200, peekA 17081/194040, peekB 78863/900900; since 25 September 2026 second moments E[R²] 9149/4400, 149794/135135, 684923/540540 (BLACKJACK-21) |
| E06e | [outputs/exact-rtp.json](outputs/exact-rtp.json) | artifact of record for the exact figures, including `finite8TDMoments` (per-round SD 1.146686160256228, used by Step 19) and the `wooAnchor` block |
| E07 | [src/sidebets.ts](src/sidebets.ts) | independent side-bet evaluators |
| E08 | [src/simulate.ts](src/simulate.ts) | the simulation; writes E03 and E04 |
| E08a | [src/shuffle.ts](src/shuffle.ts) | the one lazy Fisher-Yates implementation, shared by every simulation path (R38 caps its frontier at 24 and must fail) |
| E08b | [src/money.ts](src/money.ts) | integer 1e-8 settlement units (R34, R35, R11) |
| E09 | [tests/verify.ts](tests/verify.ts) | the 31-step suite; writes E02 |
| E10 | [tests/blackjack/rngTests.ts](tests/blackjack/rngTests.ts) + [tests/blackjack/rngSpecTests.ts](tests/blackjack/rngSpecTests.ts) | captured shoe (epoch 0 → `HEART:7, CLUB:10, HEART:9, HEART:11`), PDPD deal, `commitHash(6dca5e36…) = 948eff89…`, LIQD's validation vectors as a second check, depth uniformity; the spec self-test (E05a §5 rounds and properties) |
| E10a | `tests/blackjack/replayTests.ts`, `src/replay.ts`, `src/prng.ts`, `src/deep-replay.ts`, `replay/replay-bootstrap.py` | the retained-inputs machinery; five negative controls (a flipped null bit, an altered statistic, a one-nibble master-seed change, a wrong domain, a truncated file) each FAIL |
| E11 | Wizard of Odds house-edge calculator, captured 2026-08-23 | rule inputs pinned (8 decks, S17, DAS, double any two, split to 2 hands, no hit split aces, peek/OBO, 3:2, plus the ASSUMED no re-split aces and no surrender); "basic strategy with continuous shuffler" edge 0.48768%; a check on the solver's output, never an input; recorded in `exact-rtp.json` |
| E12 | [Table and side bets](evidence/E12-blackjack-table-sidebets.png) | QA table in side-bet mode with the felt labels |
| E13 | [Seeds panel](evidence/E13-provably-fair-panel.png) | active client seed `auditc0f3fb21d244`, commitment `6116a05b…8692bb`, next-seed hash |
| E14 | [Reveal card](evidence/E14-seed-rotation-reveal.png) | auditor-rendered card, not a live screenshot: seed `18739e26…ba437` and commitment `c9b62c5409…c7ff` recompute exactly; the seed is outside the 120-epoch dataset |
| E15 | [Settled hand](evidence/E15-settled-hand.png) | a settled losing round (player 9, dealer 17), card backs rendered; documents the flow, not a payout |
| E16 | [Storefront edge](evidence/E16-storefront-edge-0.48.png) | captured 2026-08-05: *"Released: November 2025 \| Edge: 0.48%"*; the live page on 1 October 2026 reads *"Released: June 2026 \| Edge: 0.48%"* |
| E17 | [capture/capture-blackjack.reference.mjs](capture/capture-blackjack.reference.mjs) | sanitized capture record: phases, endpoints (host redacted), rotation discipline, fields, inline checks, the request/response side-bet field asymmetry and the funded-but-absent abort; transport stubbed, no credentials |
| E17a | [capture/capture-liqd-blackjack.aug05-rig.mjs](capture/capture-liqd-blackjack.aug05-rig.mjs) | the unsanitized rig that generated the client seeds, copied byte-for-byte from an untracked workspace file (mtime 2026-08-05T18:30:54Z), SHA-256 `4a214c87176467dc62d7586ed971c9c361878b817ed2f8ee2417b7e2cfc033e2` (`CAPTURE_RIG_SHA256`); kept unchanged, comments included. It is evidence, not a runnable tool: it imports `rng.mjs` and `strategy.mjs`, which are not shipped, and its header comments predate the final plan (they describe side bets in Phase D only and split off by default); the plan in its code is what ran, and Step 7 binds it to the data on 120/120 epochs. It reads its cookie from an environment variable (DL-16) |
| E18 | [evidence/E18-insurance-decline-2026-10-13.md](evidence/E18-insurance-decline-2026-10-13.md) + [recording](evidence/E18-insurance-decline-2026-10-13.json) + pictures [offer](evidence/E18-insurance-offered-2026-10-13.png), [settled](evidence/E18-insurance-declined-hand-settled-2026-10-13.png) | one insurance offer on qa declined with LIQD's own NO button, 13 October 2026 14:03–14:07 UTC, 0.10 USDC hands: the page sent `place-insurance-bet {"acceptInsurance":false}` (no `betAmount`), answered 200; the settled hand (round `qnFa4tnTJlBS9mHY0o0T9`, nonce 9, player 4♠ Q♣, dealer A♥ A♦ 2♦ 2♥ 3♣, lost) carries no insurance bet; the revealed seed hashes to the commitment read before the hands and re-deals the cards. Recording SHA-256 `6e1e3865fde80520984116c5e2402a19532cf988309babf70d2964d6abf6821a` (account `userId` redacted); checked by `capture/check-insurance-decline.mjs` (*E18 READY — DECLINE WORKED*; `--selftest` runs it offline against a fake page and server). Recorder `capture/console/insurance-decline-recorder.console.js`, injected through the browser extension's JavaScript tool; pictures by its screenshot tool. Role: what the server does with the UI's decline (DL-17), outside the scored dataset |
| E19 | [outputs/cherry-pick-attack.json](outputs/cherry-pick-attack.json) | the 50-candidate money grind measured against Step 19: 34/120 flag, pooled net −2,121.5 vs exact −29.26, z = −23.555; honest 98.5950% (mean −0.7958, 0.75σ) vs ground 68.5331% (mean −17.6792, 23.6σ below); rank screen 8 flags, P = 0.2117; worst block epoch 108, RTP 51.96%, net −24.50, not flagged by the rank screen (early p 0.2499, late p 0.8202). Not a claim that LIQD selected seeds |
| E20 | [outputs/rng-branch-coverage.json](outputs/rng-branch-coverage.json) | branch coverage of the draw primitive (DL-2) |
| E20a | `src/cherry-pick-attack.ts`, `src/round-engine.ts`, `src/rng-branch-audit.ts` | producers of E19/E20; `round-engine.ts` is a disclosed second copy of the round logic in `src/simulate.ts` (which runs a 30M-round simulation on import and must not be refactored, its artifact being pinned), bound by `roundEngineTests.ts`; all three import `src/strategy.ts` |
| E21 | [outputs/report-figures.json](outputs/report-figures.json) | the prose figures: money-path reconciliation, the insurance sub-ledger (446 rounds: 433 at $0.05, 13 at $5.00; 145 at 3×, 301 at 0×), naturals (253 = 4.22%; 243 won and 10 pushed, from the credit, not the operator's `result` string), live Perfect Pairs return, exact side-bet edges and the 12:1 counterfactual, the infinite-deck TD comparison; scored by re-derivation |
| E22 | `verifier-parity/games/blackjack/derive.js` + `verifier-parity/lib/hmac-sha256.js` | the ProvablyFair.org site verifier vendored byte-for-byte (site commit `fbfe985`, 2026-08-25), pinned in `SITE_VERIFIER_PINS` (`38792bc4…`, `2095571f…`); Step 6 runs `deriveBlackjackSync` on 515 rounds (916 hands) and its full shoe on 121 shoes including the rejection vector (BLACKJACK-24); `scripts/check-site-verifier.mjs` compares a site checkout |
| E23 | [evidence/E23-game-settings-2026-06-29.json](evidence/E23-game-settings-2026-06-29.json) | LIQD's game-settings response saved 29 June 2026 during a read-only scout (no bet placed), SHA-256 `70daecef0241ec205dfc1a251276a1523fd66ba94a0f8abbe27846a5d96841bd`; `houseEdge: 1` for `fast-games-11`; `activePF` holds a `/provably-fair/active` body outside the dataset. Role: the source of the 1% label |
| E24 | [evidence/E24-insurance-client-code-read-2026-10-02.md](evidence/E24-insurance-client-code-read-2026-10-02.md) | LIQD's insurance request read from its client code on 2 October 2026 (logged in, read-only, no bet placed), SHA-256 `8829192444e86e920c17499a4fe0ba1faf860d797e5e2ea03cfb399a6d74d27b` (1,455 bytes); a copy of the auditor's note with the account holder's name replaced in two places. The bundles post `fast-games/blackjack-game/place-insurance-bet` with `{ acceptInsurance: true \| false }` and no `betAmount`. Role: the capture's decline request is not the UI's (DL-17); it records what the client sends, not what the server does |

[evidence/rtp-page-labels-2026-10-01.json](evidence/rtp-page-labels-2026-10-01.json) holds the live page labels read on 1 October 2026. The live verify-endpoint cross-check and a `0.99` `exchangeRate` seen outside this dataset are **not archived**; they are recorded so they are not mistaken for evidence.

### Artifacts of record

| Artifact | SHA-256 | Guard |
|---|---|---|
| `data/blackjack-6000hands.json` | `c2a28c5164a546105963ffb4ff8e7c422a68802df47afcdcfa0b4fdbad1fdbf7` | `loadDataset()` aborts on mismatch; also asserted in `artifactTests.ts` |
| `outputs/simulation-results.json` | `26ab1574ced2a1e59ca653a582951dac304ca62ea621e96b2b6de1e08a193567` | `SIMULATION_SHA256`, Step 25 presence and hash |
| `outputs/rtp-convergence.html` | `45ce9d7ad631d600adfb526b68646c5c90434806f449aada193640bf90d8d4bb` | `SIMULATION_HTML_SHA256`, Step 25 presence and hash |
| `outputs/exact-rtp.json` | `f89b1920086bf0af17dbf5f30350bfef259a6fa0f934631a7ffa41e34cec4611` | `EXACT_RTP_SHA256` in Step 25, plus the field-by-field live re-derivation in `exactSolverTests.ts` |
| `outputs/simulation-provenance.json` | `5ad0e673045c4b26ae0dd63fff3b3fbfb96b5cf8778039254261238a89571b4c` | `SIMULATION_PROVENANCE_SHA256`, Step 25 presence and hash |
| `outputs/bootstrap-nulls.float64le` | `c69eeb27b6e0679658c5f2bf1f3d5c60481ee6de062ae16e1cc901bcbac87916` | `BOOTSTRAP_NULLS_SHA256`; used as evidence by Step 19 |
| `outputs/cherry-pick-attack.json` | `44d45d84a8cd7d54dee3fca146be7e146f4e1fa65385cd34d33fa611ee9d1e78` | `ATTACK_SHA256`; deterministic (seeds are SHA-256 of fixed labels) |
| `outputs/rng-branch-coverage.json` | `eb2c74a1ecf84d3dbf3c1cc3a490b9c04ad1a24d201c4f58efc4403bbacb4593` | `RNG_BRANCH_SHA256`; deterministic |
| `outputs/deep-replay-report.json` | `44f2c8377f14df3e996ee2f753b7ec38faae97edd20497772cdd04c992b2ccbe` | `DEEP_REPLAY_SHA256` (BLACKJACK-27), Step 25 presence and hash |
| `outputs/bootstrap-replay-report.json` | `c4cf022c5d34bdfba86829f87551591baba694e1bf8351b99f138738deae4e05` | `BOOTSTRAP_REPLAY_SHA256`, Step 25 presence and hash |
| `capture/capture-liqd-blackjack.aug05-rig.mjs` | `4a214c87176467dc62d7586ed971c9c361878b817ed2f8ee2417b7e2cfc033e2` | `CAPTURE_RIG_SHA256` (BLACKJACK-06), re-hashed in Step 7; not an output, so not among Step 25's artifacts |

The ten run-time pins are reconciled inside **Step 25**, which asserts presence as well as hash and hard-FAILs on either. A substituted or missing artifact produces a visible `[FAIL] Step 25`, NOT PROVABLY FAIR and exit 1. Step 25 also walks every numeric leaf of the nine JSON artifacts of record (the seven pinned JSON outputs, `report-figures.json` and `verification-results.json`) and requires each to sit inside a domain declared in `src/domains.ts` (bounds from `src/config.ts`, never from the artifact): 32,848 leaves on the committed run; a new undeclared numeric field, a p-value outside [0,1] or a run-metadata key is a hard FAIL (R73, R74).

**Report figures, scored by re-derivation.** `outputs/report-figures.json` (E21) is rewritten by every `npm run verify`, so a pin would be enforced against a file the same command replaces. Step 25 rebuilds it through the same `buildReportFiguresArtifact()` against the pinned dataset and the exact engines and compares it field for field, header included; absence, an unparseable file, a throwing recomputation or any differing field is a hard FAIL. Mutations R28–R33 forge one figure (R28), empty, duplicate or shrink the worked example (R29–R31), set three return and edge fields to 0.5 (R32) and delete the file (R33); each must fail. The file must be committed. The recomputation proves determinism, not independent production: what guards the engines is the Wizard of Odds anchor and the `exact-rtp.json` re-derivation. The `exact-rtp.json` guard compares the whole artifact with a live rebuild, not a list of fields.

All verification is deterministic and produces 31/31 on every run and machine; the simulation derives every random input from the pinned master seed. Recompute the dataset hash with `shasum -a 256 data/blackjack-6000hands.json`.

## Limitations and trust

The Full Pass describes reproduction and consistency within the captured pre-production build. LIQD Blackjack uses the client seed + server seed commit-reveal model with no external beacon. The cryptography removes post-hoc alteration (a revealed seed that did not match would fail Step 1) and dependence on LIQD's verifier. It removes targeted outcomes **only for a player who sets a fresh client seed after the commitment is published**: the seed the operator would have to grind against did not exist when it committed. Step 7 shows the seed feeds the derivation, not that ordering, which is attested by the capture record. A player whose seed is known and unchanged is not protected: each candidate server seed hits a chosen first card with probability 1/52, so about 50 candidates suffice. **Cherry-pick risk tier: LOW for a player who rotates the client seed after the commitment; NOT ESTABLISHED otherwise.**

Step 19's family gate is the binomial upper tail at 0.001 (6 of 120); its rank screen is an 11-bin χ² on df 10 at n = 50 (the two end bins pool). More power needs more served rounds per client seed, a limit of the evidence rather than a tuning problem.

### Declared limitations register

Each row is a known residual, measured where a magnitude exists and not closed. A finding that is not on this list is a genuine gap in the audit. The mutation column names the nearest demonstrated guard, or records that none can exist.

| ID | Limitation and measured magnitude | Why it cannot be closed offline | Mutation |
|---|---|---|---|
| **DL-1** | **Return-based server-seed selection is detected only when it is strong.** BJ-S5-05 is Not closed. Grinding 50 candidates per epoch against the real client seeds moves the served windows from **98.5950%** to **68.5331%** (mean **−17.6792** units per epoch against exact **−0.2438**, **23.6σ** below the exact expectation). Step 19's money rule detects it: 34/120 flag, pooled z **−23.555**. Power **0.8% / 4.1% / 61.3% / 100.0%** at a **1% / 2% / 5% / 10%** served-window shortfall over 6,000 served rounds. The rank screen flags 8 (chance 5.7, p₀ = α(1−α) = 0.0475, **P = 0.2117**); the worst block (**epoch 108, RTP 51.96%**, net −24.50) passes it (early p 0.2499, late p 0.8202). RTPs per total wagered (98.408% and 64.642% per initial bet). Fresh client seed after commitment in 110 of 120 capture epochs, so the clean result cannot show whether the casino selects seeds | No capture separates a seed generated once from one selected before commitment; a statistic bounds only selection large enough to move the money it sees. The bound is a player action. Risk tier: LOW only for a player who rotates; NOT ESTABLISHED otherwise | R69, R70 (forged per-seed p, widened gate); `ATTACK_SHA256` pinned |
| **DL-2** | **The modulo-bias rejection branch is ASSUMED of the server, never witnessed.** All **2,490,000** draws accepted their first chunk; expectation of a later-chunk draw **0.0569**, of the fallback **2.0 × 10⁻⁵²**; a plain `chunk % range` server gives byte-identical data with probability **94.47%**. Exposure if absent: ≤ **2.3 × 10⁻¹⁰** point bias (range 257), ≤ **2.4 × 10⁻⁸** total variation per draw (range 413) | The branch fires only on a chunk ≥ `maxFair`; the expectation over 2.49M draws is 0.057 events. Closing it needs source access or a probe that forces the branch | none; `RNG_BRANCH_SHA256` pinned; no mutation can manufacture a rejection the server never produced |
| **DL-3** | **Most Pass-2 windows are re-derived from census rows in the scored run, not re-dealt.** Re-dealt in `npm run verify`: every served window (6,000 rounds) and one declared later window per seed (6,000 rounds). Re-derived from the rows: late rank counts (9,950 nonces per seed), 198 of 200 money windows per seed, `earlyBootstrapP` for 120/120 from the retained nulls (41 replicates re-derived), `lateChi2`/`latePValue` at df 12, every money p, flag counts, gate and pooled z. | A cost boundary, closed outside the scored run: re-dealing all 1,200,000 Pass-2 shoes costs ≈10 core-minutes per run. `src/deep-replay.ts` re-deals the census, `npm run simulate` regenerates it byte for byte, `replay-bootstrap.py` re-derives the rank statistics independently (both reports pinned, 0 mismatches) | R19, R20, R69, R70; negative controls in `replayTests.ts` |
| **DL-4** | **The stake side of the money path is unobservable.** BJ-S5-14 is Pass on the credit side only. The capture contains **0** occurrences of `balance` or `delta`; a mis-recorded stake on a losing hand leaves no trace. Every per-hand credit is reconstructed (Step 8); Step 8b shows each double bet was credited like its hand on 1,283 doubled rounds and cannot detect a skim | No before/after wallet reading exists. Needs a capture that records the balance either side of every round | R10, R11 (credit side); none reaches the stake side |
| **DL-5** | **Re-split and surrender are ASSUMED, not observed.** 141 post-split hands re-paired (63 same-rank, 78 mixed ten-value) and none produced a third hand, including phases C and F; re-split was not attempted. **0** surrender tokens in 6,000 rounds; the script has no surrender call. The rule set is nine observed, three assumed (the third is DL-17) | Play, not interrogation: "not offered" and "offered and never taken" look the same. Needs the casino's offered-action flags recorded at every decision (the next capture script records them) | R6, R7, R24, R25, R26 (action grammar); none can create an action the server never emitted |
| **DL-6** | **Dataset provenance is not provable offline.** A categorical limit | Every check is internal; nothing offline proves the rounds were settled by LIQD's system rather than manufactured with the same algorithm. That binding comes from the capture session | R5, R9, R13–R16, R23, R27 (internal-consistency attacks) |
| **DL-7** | **qa build == production build is ASSUMED, with no witness.** The widest limitation and the reason the verdict is provisional | All evidence comes from `qa.liqd.com` before launch. Closed only by an anonymous post-launch recapture against `liqd.com` | none |
| **DL-8** | **`exchangeRate` is unidentifiable at 1.00.** BJ-S5-10 passes on "no observable haircut". **1.00** on all **12,046** side-bet records; 0 main-game hands carry it; every `fiat*` field zero | Applied at 1.00 and not applied are the same data. Needs a capture at another rate (a `0.99` value seen outside this dataset is not archived here) or source access | R23 (stripping the field fails Step 21's coverage assertion) |
| **DL-9** | **Mid-round seed rotation (TOCTOU) was never exercised.** BJ-S5-18 is Not tested | The rig settles every hand before rotating, the same discipline that keeps the nonce chain intact. Needs a live probe | none |
| **DL-10** | **The mid-round hidden-state disclosure sweep was not performed.** | The dataset records settled rounds; whether a pre-settlement response leaks the hole card or deck order is a property of the live wire. No such field appears in what was recorded. ProvablyFair.org has found this class live on other operators. Needs a live endpoint sweep | none |
| **DL-11** | **The 1-deck residual of 0.031 pp is NOT computed.** Published 1-deck **−0.11442%** vs exact **−0.083726%**, on top of the 0.602 pp deck delta that is externally accounted for | The table-mismatch reading is consistent with the sign and magnitude and is not our measurement. No published figure depends on it | R1, R2, R3 pin `finite1TD` exactly |
| **DL-12** | **The Wizard of Odds anchor certifies to ~1e-4 pp, not 1e-5 pp.** At 6 decks the engine reads **0.459936%** against a published **0.45999%**; the 8-deck delta −5.2e-6 pp checks the engine lands on the published number | Wizard of Odds publishes 5 decimals and resolves to about 1e-4 pp; finer precision rests on the oracle and the solver's determinism | R1, R2 (the whole `wooAnchor` block, including `sixDeckPublished`/`sixDeckExact`) |
| **DL-13** | **The oracle shares the strategy table, rules reading and implementer with the solver.** Agreement at 1e-12 on shared inputs | It anchors arithmetic, not the table's optimality; a shared misreading would move both. The organisationally independent leg is Wizard of Odds, bounded by DL-12 | R1–R3 pin arithmetic; nothing pins a table both read the same way |
| **DL-14** | **Server-side infrastructure is outside the capture.** Seed-generation entropy, key custody and selective aborts are trusted per the commit-reveal model | Nothing client-side carries evidence about how a seed was generated or stored; the standard commit-reveal residual | none |
| **DL-15** | **The Phase D client seeds were predictable** (`pfaudit-<stamp>-<epoch>`). An auditor-side hygiene limit, not an operator defect. Step 26 enumerates all **10** epochs, **96–105**, **500** rounds, one stamp `1785954682036` (2026-08-05T18:31:22.036Z); those rounds rest on recomputation (Steps 6 and 26: 500/500), not on the client-seed mitigation | Historical seeds can only be replaced by capturing again with CSPRNG Phase D seeds | none |
| **DL-16** | **The A–C/E/F seed generator is shipped, with circumstantial provenance.** Since 2026-09-25 the rig is in the package (E17a). Its seed lines are `randHex = (n) => Buffer.from(crypto.getRandomValues(new Uint8Array(n))).toString('hex')` and ``clientSeedFor = (E, tag) => tag === 'pfaudit' ? `pfaudit-${STAMP}-${E}` : 'audit' + randHex(6)``. Step 7 binds it: 4/4 `rotate()` calls pass `clientSeedFor(...)`; `Math.random` appears once, in the demo renderer only; the phase plan matches **120/120** epochs; **110/110** non-D seeds have the `audit` + randHex(6) shape and are distinct; **10/10** Phase D seeds carry their epoch and the stamp `1785954682036`, **6 ms** before `meta.startedAt` and 28 s after the file's modification time | The file was not in git; a different generator producing the same shapes is not excluded offline. Closing it needs the generator committed with the next capture and each seed record carrying the generator and the commitment it was drawn after | R78, R79 (generator swapped to `Math.random`, phase plan shifted: Step 7 FAILs) |
| **DL-17** | **The capture's insurance decline was not the UI's, so its rounds carry insurance on every offer.** A capture limitation, not an operator finding. The capture sent `place-insurance-bet {betAmount: 0}` and logged `no-ins`; the UI sends `{acceptInsurance: true \| false}` (E24). The casino booked a half-stake bet on all **446** offers (433 at $0.05, 13 at $5.00; 145 won at 3×, 301 lost), **86.65** wagered, **66.30** returned. With insurance on every offer the edge is **0.7612%** (RTP 99.2388%) against the **0.487675%** headline (Step 28 prints both). The 16 dealer-Ace rounds without an offer are all player naturals | One hand played with the UI's decline on 13 October 2026 (E18): the page sent `{acceptInsurance: false}`, LIQD answered 200 and booked no insurance bet on the settled hand. That is one offer on qa, outside the scored dataset; the dataset's rounds keep their insurance until a capture that sends the UI's decline (`decline-ins`). The headline stands on the rule that basic strategy declines insurance | R80 (the 301 losing records deleted and re-pinned: Step 28 FAILs) |
| **DL-18** | **The capture's split-round play is not the phase strategy, and its basic table is not `src/strategy.ts`.** A capture limitation. **119 of 401** split rounds contain an off-strategy action: the script took every decision from the main hand while the casino plays the split hand first; replaying on that reading reproduces **401/401** token streams, and explains why no split round doubles only one hand. The capture's table hits soft 13–15 where `src/strategy.ts` doubles (soft 13/14 against 5–6, soft 15 against 4–6): **28** rounds | No scored step depends on the action chosen; the RTP comes from the exact solve. The next capture script tracks the hand the casino plays and doubles soft 13–15 | none |
| **DL-19** | **Two LIQD settings were not exercised: the maximum-profit cap and Face-Down Double.** LIQD's game settings (E23, read 29 June 2026) give `fast-games-11` a maximum bet of 125,000 USDC and a maximum profit of 250,000 USDC. A round that splits, doubles both hands and wins both returns 4× its stake in profit, so above 62,500 USDC a round can exceed the cap; a 21+3 suited three of a kind (100:1) would exceed it on a side stake above 2,500 USDC, if one that large is accepted. The capture's largest stake was $10, so how LIQD applies the cap (refusing the bet, refusing the split or double, or limiting the credit) was not observed; the headline RTP holds at stakes where no round can reach it. LIQD's game page also describes Face-Down Double, a setting that deals the double card face down ([evidence/rtp-page-labels-2026-10-01.json](evidence/rtp-page-labels-2026-10-01.json)); the capture did not use it, so whether it changes the deal order or settlement was not observed | The cap binds only at stakes far above the capture's; it needs LIQD's statement of how it is enforced, or play at a stake where it binds. Face-Down Double needs one doubled hand with the setting on, replayed from its revealed seed | none |

**How figures should be read.** The live money path (98.0209% including side bets and the booked insurance, 98.4696% excluding insurance) is a reconciliation with no statistical power for RTP and is not scored; RTP evidence is the exact solve, its two anchors and the simulation. The Pass-1 statistics are consistent with a fair shuffle and cannot see suit or later-position bias; the shoe is fair by construction. `npm run calibrate` writes no committed artifact, so its figures are illustrative.

### Premises

| Premise | Witness | Could the captured data contradict it? |
|---|---|---|
| RNG = HMAC-SHA256, hex-decoded key, `clientSeed:nonce:cursor`, backward Fisher-Yates over 416 cards | dataset | yes: 6,000/6,000 dealt sequences reproduce bit for bit (Step 6) |
| Commitment = SHA-256(utf8(hex string)) | dataset | yes: 120/120 |
| Next-seed pre-commitment chain | dataset | yes: 119/119 links |
| Settlement: 3:2, S17, doubles, splits and insurance as recorded | dataset | yes: 6,401/6,401 per-hand credits, incl. 401 splits (Step 8); Step 8b cannot detect a skim |
| Side-bet paytables | dataset | yes: 5,800 + 5,800 re-derived, 0 mismatches |
| Exact 8-deck edge = 0.487675% | E11 Wizard of Odds (delta −5.2e-6 pp), the reduced-scale enumeration, and the storefront 0.48% (E16) | partial: the hands cannot measure the exact-strategy EV (DL-12) |
| Rule set S17, DAS, no surrender, no re-split aces, peek/OBO, 3:2 | dataset, E11 | partial: unused rules' availability not exercised (ASSUMED, DL-5) |
| Insurance can be declined | ASSUMED in the dataset: the UI sends `{acceptInsurance: false}` (E24), never sent by the capture; witnessed once outside the dataset (E18: one hand, no insurance bet booked) | no: on the request sent, insurance was booked 446/446 (DL-17) |
| Server applies the rejection guard | ASSUMED: branch unexercised (DL-2) | no |
| A credited win reconciles against a wallet change | ASSUMED: no balance captured (DL-4) | no |
| qa build == production build | ASSUMED: pre-launch capture (DL-7) | no |
| The maximum-profit cap does not alter a credit at the stakes certified | E23 limits; captured stakes $0.10 and $10 | yes, at the captured stakes: every credit reconstructs (Step 8); above 62,500 USDC not tested (DL-19) |

### Model anchors

| Modelled figure | Anchor | Tolerance | Enforcing test |
|---|---|---|---|
| 8-deck TD edge 0.487675% / RTP 99.512325% | (1) exact-rational tiny-shoe physical enumerator, no conditioning anywhere; (2) Wizard of Odds 0.48768% at the pinned rule set | (1) 1e-12; (2) 1e-7 (published 5 dp) | `exactOracleTests.ts`; `wooAnchorTests.ts`; Step 17 |
| Infinite-deck value 99.4296% | independent with-replacement engine, drift-pinned | 1e-9 | `optimalPlayTests.ts` |
| Edge per total wagered 0.432435% (RTP 99.567565%) | derived as edge per initial bet / `avgWager`; `avgWager = 1.127741` anchored against the 30M-round simulation (`baseGame.avgWager`), which shares no code path with the solver | 1e-3 on `avgWager` | `exactSolverTests.ts` and the `exact-rtp.json` re-derivation |
| Perfect Pairs edge 2.169% (9/415) | exact enumeration of the 8-deck two-card distribution with the Step 15 evaluator | exact rational | `sideBetEdgeTests.ts` |
| 21+3 edge 3.704% (4596/124085) | same method over three cards, evaluator shared with Step 16 | exact rational | `sideBetEdgeTests.ts` |
| 1-deck sensitivity −0.083726% (not an offered game) | Wizard of Odds 1-deck −0.11442%; 0.031 pp gap disclosed, not computed (DL-11) | engine side pinned exactly | `exactSolverTests.ts` |
| Shoe composition and deck count | recomputation against a declared 416-card shoe | exact | Step 6, Step 30 |

**Residuals, declared.** The oracle shares the policy (`src/strategy.ts` → `anchor/policy.json`), the rules reading and the implementer with the solver, so it anchors arithmetic at 1e-12 but not optimality; it is a physical enumeration, so the error class it is blind to is a rules misreading, not an arithmetic slip. Wizard of Odds does not share the table and checks it independently to the precision it publishes, so a cell that differs from the published chart but is EV-neutral at ~1e-4 pp cannot be excluded. The rules reading is one declaration since 24 September 2026 (`src/config.ts` RULES = `anchor/rules.json`, Step 25), plus the ASSUMED no-re-split and no-surrender rules; a shared misreading, for instance of re-split availability, would move all three engines together.

### Recommendations

| ID | Recommendation |
|---|---|
| R-1 | Align the config `houseEdge` value with the rules-derived edge, or document it as a nominal cap, and state the surface figure with its convention |
| R-2 | Ship a client-side or open-source verifier (closes F-4) |
| R-3 | Document what `exchangeRate` is and whether it is ever applied to crypto settlement |
| R-4 | Publish the per-side-bet house edges (Perfect Pairs 2.17%, 21+3 3.70%) beside the base-game RTP |
| R-5 | Record the wallet balance before and after every round, so `Δbalance == credit − stake` is checkable (closes DL-4 on the audit side; a capture-side limitation, not an operator defect) |
| R-6 | Reject a `place-insurance-bet` request that carries no explicit `acceptInsurance` value rather than book a wager on it; the next capture sends the UI's decline |
| R-RACE | Attempt a rotation against an open round and record the response (DL-9) |
| R-DETECT | Step 19's power against mild selection is low because a 50-round window carries little return information; until R-SELECT lands the defence is the player's rotation |
| R-MULTI | Cross-account seed or bonus interactions were not exercised |
| R-SELECT | A source review reduces the seed-selection residual but cannot make it structurally prevented; that needs an external beacon or a commit-to-the-client-seed step before the server seed is chosen |
| Annual | Re-run the full suite against a fresh capture to confirm rules, RTP and paytables have not drifted |

### Production verification plan

The QA assessment is complete; the next uses ordinary authenticated play on the public production site, without the QA whitelist or a special audit setup. Planned, not completed:

| Workstream | Planned capture and check | Completion evidence |
|---|---|---|
| Production outcomes | production domain, game ID, time, displayed rules, build identifiers; repeat seed, card and payout reconstruction | published production dataset and results |
| Wallet reconciliation | wagers, balance changes, transaction references, returns, refunds | rule-derived debits and credits reconcile for every round (DL-4) |
| Rules and action attribution | offered actions and each action's target hand; re-split and surrender availability (ASSUMED today), split aces, partial doubles, insurance choices, the Face-Down Double setting | observed rule table and updated model (DL-5, DL-17, DL-19) |
| Mid-round protection | deal, action and recovery responses; rotation during an open round, including shared-seed paths | evidence of hidden-information and reveal-timing protections (DL-9, DL-10) |
| Commitment and client seed | record the commitment, then submit an independent fresh client seed; track commitment, nonce, failures, reveal | ordered transcript and consistent replay (DL-1) |
| Coverage and provenance | ordered requests/responses and extraction records; more sessions, stakes, accounts | inventory of included, failed, cancelled and unresolved attempts (DL-6) |
| Player disclosures | production paytables, edge convention, side-bet edges, maximum bet and maximum profit for Blackjack and its side bets | recorded figures compared with the model; how the cap is applied (DL-19) |

If a planned check cannot be exercised, its scope stays excluded rather than inheriting a pass. Production capture cannot by itself certify internal server security, every user's seed-selection workflow or future behaviour.

**Next capture script (v2, planned 2026-09-25, not yet run).** `capture/capture-blackjack-v2.mjs` with an offline self-test (`capture/capture-blackjack-v2.selftest.mjs`) keeps the v1 phases, endpoints and record keys and changes: the insurance request becomes the UI's `{ acceptInsurance: false }`, logged `decline-ins`; it tracks the hand the casino is playing (the self-test checks the order against all 401 v1 split rounds); it doubles soft 13–15 as `src/strategy.ts` does (237,989 of 238,056 decisions identical to v1, the other 67 all soft 13–15 doubles); it records every decision with the casino's offered flags and keeps the `mainDoubleBet`/`splitDoubleBet` records; client seeds come from `node:crypto randomBytes` (non-D `audit` + 12 hex; Phase D ten distinct `pfaudit-` + 16 hex seeds) with the generator recorded in `meta.clientSeedGenerator` and per seed record. A probe (`--probe`) spends two rotations and about $0.60 of stake. v1 took 1 h 47 min; its recorded stake was $3,926.15 (Phase E $2,125.00, a lower bound without double stakes), largest round $20; about $500 of balance is indicated for Phase E. After a v2 capture, Step 7 must read `meta.clientSeedGenerator`, Step 6 must accept `decline-ins`, Step 28's coverage rule applies to v1 only, Steps 14 and 27 can read availability from `decisions`, and `DATASET_SHA256` and the report figures must be re-pinned.

## Terms

**Natural:** a two-card 21 on the initial deal; pays 3:2 unless the dealer also has one (push). **Soft / hard total:** an Ace counted as 11 / no Ace or every Ace as 1. **S17 / H17:** dealer stands / hits on soft 17. **Double:** double the stake for one more card. **DAS:** double after split. **Split:** play a pair (by value) as two hands. **Re-split:** splitting a split hand (ASSUMED unavailable). **Insurance:** a 2:1 side wager that the dealer holds a natural, offered on an Ace upcard, −EV under optimal play. **Peek / OBO:** the dealer checks for blackjack before the player commits additional money. **Surrender:** forfeit half the stake (no surrender action observed). **Push:** a tie; the stake returns. **PDPD:** player, dealer, player, dealer. **RTP / house edge:** long-run return / one minus RTP, in a declared convention (per initial bet or per total wagered, the element of risk). **Commit-reveal:** publish a seed hash, reveal the seed later. **Epoch:** one seed pair, 50 hands here. **Nonce:** per-hand counter. **Cursor:** per-swap counter in the HMAC message. **Modulo-bias rejection:** discarding values at or above `floor(2^32 / range) × range` so the result is uniform (ASSUMED of the server). **Cherry-picking:** an operator choosing a favourable server seed before committing. **Standard error:** `σ/√n`. **G-BIND:** the framework guard requiring every population assertion to bind to source records and `src/config.ts` constants, never to a count the artifact supplies about itself.

## Release history

- **v1.0.0**, released 21 October 2026: the first public release, published as one commit. Dataset of record: the 5 August 2026 capture (SHA-256 `c2a28c51…`). Recorded result: **31/31 PASS, 0 flags, 0 hard fails**, `PROVABLY FAIR — Full Pass`, provisional (pre-launch capture, DL-7). The release manifest records `supersedes: null` and the fingerprint of the key that signs the release; the audit ID is confirmed by ProvablyFair.org. The dated entries below record the audit work that led to it.
- **v1.0.1** (errata): adds `.gitattributes` (`* -text`) so a Windows git clone keeps every file byte-identical; no audit content changed.
- **14 October 2026 — Methodology v1.1.** RTP-CLAIM 1.1.0 → 1.2.0 (Methodology v1.1, Mike, 14 October 2026; `src/rtp-claim.ts` re-vendored byte for byte, SHA-256 `c9a9c1c4…`; switch still on): an enforced miss would now mark the RTP-claim step RTP FIGURE OVERSTATED and make the verdict RTP FIGURE OVERSTATED, exit 5, instead of NOT PROVABLY FAIR; the claim's source restated to name the game page, one of the rule's six places (no figure changed). Framework 1.0 → 1.1 (D1), the profile version's suffix dropped as approved (D6), the S5 line added (D5). The game-settings figure (houseEdge 1 %, E23), which 1.2.0 counts as published, is lower than the 99.52 % held, so holding 99.52 % covers it; the source says so. `outputs/rtp-claim-table.json` re-written and re-pinned (`9e447e3b…`); `outputs/verification-results.json` re-emitted with `PF_EMIT=1` (only `profileVersion` changed) and emitted a second time with the same bytes (`92937d4d…`); bundles rebuilt; `RELEASE-MANIFEST.json` regenerated. Verdict unchanged: `npm test` on Node 22.23.1 exits 0 — 116/116 unit specs, 31/31, PROVABLY FAIR — Full Pass, REPRODUCED, release manifest OK. `npm run mutate`: 84 mutations, 133 layers run, 0 failures.
- **14 October 2026, later — RTP FIGURE OVERSTATED route (FIXPASS2 C3).** Two mutations added to `tests/mutations.json`, each run with `regen` (the RTP table re-written and re-pinned and the record re-emitted in the sandbox, as an auditor would after the change) and judged by the exact exit code: M84 lowers the one setting's RTP by 0.3 pp where the RTP table reads it (99.212325 % against 99.52 %), M85 raises the published storefront figure at its source (`STOREFRONT_EDGE` 0.48 % → 0.25 %, RTP 99.75 %). Before this change the claim was the literal 99.52 %, a hand copy of `STOREFRONT_EDGE`; with the storefront figure raised alone, Step 20 FLAGged on its own while the rule passed, and the run ended **PROVABLY FAIR — Conditional Pass, exit 2** (measured in a temporary copy with the table and record regenerated). `src/rtp-settings.ts` now derives the figure held from the two published edges this package carries — the higher RTP of `STOREFRONT_EDGE` and the game-settings `NOMINAL_HOUSE_EDGE` — so a raised figure at either source moves the claim. The held figure is still 99.52 % and `outputs/rtp-claim-table.json` was re-written byte-identical (`9e447e3b…`); bundles rebuilt. `npm run mutate -- 58 84 85` (the two new entries and R55, the other entry naming Step 20): M84 and M85 exited 5, `Verdict: RTP FIGURE OVERSTATED`, `[RTP FIGURE OVERSTATED] Step 20`; R55 still prints `[FLAG] Step 20` and now exits 1, because moving `STOREFRONT_EDGE` also moves the held claim and the committed table no longer matches; "3 layer(s) run, 0 failure(s)". The other 83 entries were not re-run after this change. Re-run after the runner's last edit, `npx ts-node tests/mutate.ts 84 85`: M84 and M85 STALE (exit 1, `[FAIL] Step 20`) and OUTER (exit 5, `Verdict: RTP FIGURE OVERSTATED`, `[RTP FIGURE OVERSTATED] Step 20`), "4 layer(s) run, 0 failure(s)", exit 0.
- **19 October 2026.** Documents and one capture tool only; no step, figure, pinned file or verdict changed. The method paragraph states that the RNG was also checked against LIQD's private specification (as `src/rng.ts` already cited); the E18 row names the recorder file and the checker's self-test; three failure messages and one self-test fixture in `capture/check-insurance-decline.mjs` were reworded, and its output on the E18 recording is unchanged (the E18 record gives both SHA-256 values).
- **20 October 2026.** RNG code rebuilt from a written specification instead of ported from LIQD's code (decision of 20 October 2026). `src/rng.ts` is now the module a clean-room implementer wrote from [docs/ALGORITHM.md](docs/ALGORITHM.md) (added, a copy of the framework's `games/liqd-blackjack/ALGORITHM.md`, SHA-256 `90e6dbc1…0ffad6`) and a module-interface file alone, never having opened LIQD's code, its client bundle or the earlier `src/rng.ts`; its logic is byte for byte that module, with a provenance header. Three-way agreement measured before integration: every card of every hand and of the dealer on 6,000/6,000 captured rounds (34,734/34,734 cards, recorded actions replayed, split rounds included) and on the 10/10 E18 rounds; LIQD's code as given in its private specification 6,000/6,000 (34-card deck), its validation vectors 3/3; the site verifier (E22) 6,000/6,000, full shoe and replayed round. Where they differ, on inputs no captured round reaches: when all eight chunks of a digest are rejected the rebuilt module throws (the spec leaves the case open, O1) where LIQD's code and the site verifier draw again at `cursor + 1,000,000`; the rebuilt module also refuses a malformed server seed, a negative or fractional nonce and an invalid range. The draw-bias bound (`drawBias`) moved unchanged to `src/bias.ts` and the simulation's seed derivation (`SEED_DERIVATION_VERSION`, `SEED_DOMAINS`, `isMasterSeed`, `deriveSeedHex`) unchanged to `src/seed-derivation.ts`; no pinned simulation artifact moved. The spec self-test is a unit test (`tests/blackjack/rngSpecTests.ts`, 142 checks), so the suite is 117 tests. Mutations R42 and R43 retargeted to the rebuilt `maxFairFor` and draw. BLACKJACK-09 restated (no operator line is cited because nothing is ported; still partial). `outputs/verification-results.json` re-emitted with `PF_EMIT=1` (only that BLACKJACK-09 entry changed) and emitted a second time with the same bytes (`bc469ac2…`); bundles rebuilt; `RELEASE-MANIFEST.json` regenerated. Verdict unchanged: `npm test` on Node 22.23.1 exits 0 — 117/117 unit specs, 31/31, PROVABLY FAIR — Full Pass, REPRODUCED, release manifest OK. `npx ts-node tests/mutate.ts 41 45 46 47 48` (R38, R42–R45, the entries on the shuffle, the draw and the site verifier): 5 layers run, 0 failures.
- **21 October 2026 — release `v1.0.0`.** Release wording only; no step status, figure, pinned dataset or verdict changed. The release lines name `v1.0.0`, the first public release, and the BLACKJACK-09 note dates the rebuild instead of naming a version. `outputs/verification-results.json` re-emitted with `PF_EMIT=1` (only that note changed) and emitted a second time with the same bytes (`f57cfb40…`); bundles rebuilt; `RELEASE-MANIFEST.json` regenerated (`release` `v1.0.0`, `supersedes` null, `signature` the release key's fingerprint).
