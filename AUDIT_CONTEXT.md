# LIQD Blackjack Technical Audit Report

**Audit ID:** PF-2026-LQ01 · **Auditor:** ProvablyFair.org · **Operator:** LIQD.com  
**Result:** PASS for the assessed pre-production sample · **Certification:** provisional pending production verification

The audit independently reproduces the captured Blackjack outcomes, checks their recorded payouts, verifies the seed commitments and derives the base-game and side-bet mathematics. The assessed sample contains **6,000 rounds, 6,401 player hands and 34,734 cards**. All captured rounds reproduce, all reconstructed payouts reconcile, and all **31 defined verification checks pass**.

The source implementation, evidence and executable checks are included so these findings can be examined and reproduced. This report describes the current assessment and its scope. Planned production work is identified separately in §9.

## 1. Assessment and findings

### Captured environment

The auditor records the capture as one authenticated account on **`qa.liqd.com`**, LIQD's pre-production environment, on **5 August 2026, 18:31–20:18 UTC**. The game is Blackjack, `gameId: fast-games-11`, and the accounting currency is USDC. Origin, environment and capture timing are auditor-attested facts supported by the capture record and images; they are not established by hashing the dataset.

The capture contains **120 seed epochs of 50 rounds**, with a contiguous nonce window of 0–49 in each epoch. Its phase plan exercises ordinary strategy, deeper draw paths, splits, custom client seeds and a higher stake:

| Phase | Rounds | Initial stake | Play and side-bet coverage |
|---|---:|---:|---|
| A | 3,300 | $0.10 | Basic strategy; both side bets |
| B | 1,000 | $0.10 | Hit/double-heavy play; both side bets |
| C | 500 | $0.10 | Split-focused play; both side bets |
| D | 500 | $0.10 | Basic strategy under 10 custom client seeds; both side bets |
| E | 200 | $10.00 | Basic strategy; neither side bet |
| F | 500 | $0.10 | Split-focused play; both side bets |

The plan is recorded in `data/blackjack-6000hands.json` and `capture/capture-blackjack.reference.mjs`; Step 24 checks phase counts. Side-bet coverage is checked against the capture's request-side declarations. Insurance is present on 446 rounds and is accounted for separately.

### Results and player-facing findings

No card-reconstruction or payout discrepancies were identified in the assessed sample. The reference implementation is auditor-authored: it reproduces observed behavior without importing LIQD's game code. Its agreement with the sample is evidence about that behavior, not a deployment attestation for other environments.

| Finding | Evidence and interpretation |
|---|---|
| House-edge presentation | The capture's nominal 1% configuration label differs from the calculated edge. The storefront image E16 shows **0.48%**. The calculated edge is **0.4876748223% per initial bet**, a difference of **+0.0076748223 percentage points**, or **0.4324350654% per total wagered**. Rounded to two decimals, these are **0.49%** and **0.43%**, respectively. Neither convention rounds to 0.48%; the operator's intended convention is not established by the capture. |
| Perfect Pairs paytable | The captured paytable awards **25:1 for a perfect pair, 13:1 for a coloured pair, and 6:1 for a mixed pair**. All **5,800 captured bets** reconcile, including **123 coloured-pair wins**. Its calculated house edge is **2.168675%**. |
| 21+3 paytable | All **5,800 captured bets** reconcile, with every winning category exercised. Its calculated house edge is **3.703913%**. The full paytable and exact enumeration are in §5. |
| Exchange-rate reporting | All **12,046** recorded side-bet/insurance entries carry `exchangeRate = 1.00000000`; base-hand entries do not carry it, and recorded `fiat*` values are zero. Recorded payouts reconcile at face value. The data cannot distinguish applying a rate of 1 from not applying the field. |
| Seed verification | All 120 reveals and 119 next-seed links reconcile. The first-card rank test finds no significant excess of early-window flags. Its scope does not establish absence of return-based seed selection; see §8. |

The recommended player disclosures are the applicable base-game edge and wager convention, the side-bet edges, and a clear explanation of the client-seed workflow. Production inspection will check the published rules and figures against the production capture.

## 2. Claim-to-evidence map

**Recomputed** means the check derives the result from the supplied inputs. **Modelled** identifies mathematical results for the declared rules and strategy. **Simulated** identifies generated experiments. **Recorded** identifies capture observations or auditor attestations. A hash check establishes an artifact's integrity, not independent reproduction of its experiment.

| ID | Claim | Supporting artifact and check | Evidence type |
|---|---|---|---|
| C01 | 6,000 rounds; 120 epochs; 50 rounds per epoch; nonces 0–49 | Dataset `bets`/`seeds`; pins in `src/config.ts`; Steps 4–5 | Recomputed against declared counts |
| C02 | 120/120 commitments match reveals | `seeds[].serverSeed` and `hashedServerSeed`; Step 1, `tests/steps/commitment.ts` | Recomputed |
| C03 | 119/119 next-seed links match | `seeds[].nextHashedServerSeed`; Step 2 | Recomputed |
| C04 | One recorded commitment per epoch | Bet/seed join; Step 3 | Recomputed |
| C05 | 6,000/6,000 rounds reproduce: 5,599 unsplit and 401 split | `src/rng.ts`; `tests/steps/parity.ts`, Step 6 | Recomputed |
| C06 | 6,401 player hands and 34,734 cards | Sum `playerHands.length`; sum all player-card lengths plus dealer-card lengths; Step 8 supplies the hand count | Recomputed from dataset; card total is an aggregate, not a separate scored step |
| C07 | Substituting the client seed changes 974/1,000 sampled first cards | Step 7 | Recomputed; matching first cards can occur by chance |
| C08 | 6,401/6,401 player-hand payouts and 6,000/6,000 round credits reconcile | `expectedReturnUnits`, `tests/steps/payouts.ts`, Step 8 | Recomputed in accounting units |
| C09 | 42,894/42,894 checked amounts lie on the 1e-8 accounting grid | `src/money.ts`; Step 8 grid check | Recomputed |
| C10 | 243 winning naturals return 2.5 times the initial stake | Step 9; dataset cards and payouts | Recomputed |
| C11 | 446 insurance records reconcile, with 145 wins and 301 losses | Steps 10 and 28; `outputs/report-figures.json` | Recomputed |
| C12 | Dealer stands on soft 17: 108 observed stands and no checked draw violations | Step 11; 177 early player-natural settlements are exempt from further dealer play | Recomputed |
| C13 | Double after split is exercised in 165/401 split rounds | Step 12; action tokens checked against recorded flags | Recomputed |
| C14 | 283 dealer naturals: 152 Ace-up and 131 ten-up; no extra player stake committed in those rounds | Step 13 | Recomputed; behavior consistent with peek/original-bets-only settlement |
| C15 | No surrender action occurs in the sample | Step 14; action vocabulary | Recomputed; availability was not probed |
| C16 | Perfect Pairs: 5,800 bets, 0 category/payout mismatches; 100 perfect, 123 coloured, 234 mixed wins | `src/sidebets.ts`; Step 15 | Recomputed |
| C17 | 21+3: 5,800 bets, 0 category/payout mismatches; 1/14/32/166/345 wins in paytable order | `src/sidebets.ts`; Step 16 | Recomputed |
| C18 | Base-game RTP 99.512325% per initial bet; edge 0.487675% / 0.432435% by wager convention | `outputs/exact-rtp.json`, `finite8TD`; `src/exact-play.ts`; Step 17 | Modelled and recomputed |
| C19 | 30-million-round simulation agrees with the exact result at 0.04 standard errors, rounded | `outputs/simulation-results.json`, `baseGame`; Step 17 recalculates the comparison | Simulated; stored experiment, recomputed comparison |
| C20 | First-card rank and specified serial tests pass over 500,000 reference-shoe rounds | Simulation `pass1_fresh_seeds`; Step 18 | Simulated locally; not 500,000 casino bets |
| C21 | 5/120 seed-window flags versus nominal expectation 5.7; aggregate survival P = 0.6789 | Simulation `pass2_casino_seeds`; Step 19 | Partly recomputed; scope in §8 |
| C22 | Nominal 1% configuration edge differs from the exact model | Dataset `meta.houseEdge`; Step 20 | Recorded versus modelled |
| C23 | Exchange-rate coverage: 12,046 side records at 1.00 | Step 21 | Recomputed; field effect unidentifiable at rate 1 |
| C24 | 200 $10 Phase-E rounds reproduce | Step 22; the reference shoe function takes no stake argument | Recomputed and source inspection; scoped to the tested inputs |
| C25 | All 3 Perfect Pairs and all 5 21+3 winning categories occur | Step 23 | Recomputed |
| C26 | Phase counts match the plan | Step 24 and dataset phase labels | Recomputed |
| C27 | Six artifact hashes match; report figures reproduce | `src/config.ts`; Step 25 | Recomputed hashes and report fields |
| C28 | 500 custom-seed rounds, 10 custom seeds; 490/500 first cards change under substitution | Step 26 | Recomputed |
| C29 | 401 splits, including 35 ace splits drawing one card each; no round above two hands | Step 27 | Recomputed; re-split availability not probed |
| C30 | 11,600 side-bet card snapshots match the initial deal | Step 29 | Recomputed |
| C31 | 1,269 rounds contain duplicate card identities; observed maximum is 3 copies in a round | Step 30 | Recomputed; compatible with the eight-deck reconstruction |
| C32 | Captured main-game initial stakes are $0.10 and $10.00 | Step 31 | Recomputed; not an exhaustive limit test |
| C33 | Exact side-bet edges: 9/415 and 4596/124085 | `src/sidebet-edges.ts`; `sideBetEdgeTests.ts`; report figures | Modelled by weighted enumeration |
| C34 | $4,239.25 recorded wagered including insurance; $4,155.35 returned; observed return 98.020876% | `outputs/report-figures.json`, `moneyPath` | Recomputed accounting summary, not the theoretical base-game RTP |
| C35 | 0 later-chunk draws among 2,490,000 reconstructed RNG draws | `outputs/rng-branch-coverage.json`; `src/rng-branch-audit.ts`; Step 25 hash | Computed experiment; artifact integrity checked by verifier |
| C36 | Return-selection experiment: 8/120 flags against nominal expectation 5.7, P = 0.2117 | `outputs/cherry-pick-attack.json`; `src/cherry-pick-attack.ts`; Step 25 hash | Modelled attack and measured detector response |
| C37 | 31/31 verification checks and 77 unit tests pass | `outputs/verification-results.json`; `tests/verify.ts`; nine `*Tests.ts` files under `tests/blackjack/`; standalone bundles | Executable verification and tests |
| C38 | 42 mutation specifications | `tests/mutations.json`; runner `tests/mutate.ts` | Registry count; executed separately from ordinary tests |
| C39 | Capture identity, environment, date and phase design | Dataset metadata, reference capture record and evidence images | Recorded / auditor-attested |
| C40 | Provisional status and planned production scope | README and §9 | Audit scope and future work; not a claim of completed production tests |

## 3. Dataset and provenance

The dataset is `data/blackjack-6000hands.json`, with schema `liqd-blackjack-capture-v1` and structure `{ meta, seeds, bets }`.

```text
SHA-256  c2a28c5164a546105963ffb4ff8e7c422a68802df47afcdcfa0b4fdbad1fdbf7
```

`src/loader.ts` verifies the file's bytes against the pin before loading it. Matching that pin identifies this published dataset. The capture's origin and timing remain auditor attestations, supported by the capture record and images.

### Field meanings

| Record | Relevant fields and meaning |
|---|---|
| Seed epoch | `serverSeed` is the revealed hexadecimal seed string; `hashedServerSeed` is its commitment; `nextHashedServerSeed` is the recorded next commitment; `clientSeed` is the epoch's client input |
| Seed bounds | `nonceStart` and `nonceEnd` are capture-recorded bounds checked against the declared population |
| Round | `id`, `epoch`, `nonce`, `hashedServerSeed`, `phase`, `actions`, `playerHands`, `dealerHand`, `winningAmount`, `sideBets` |
| Client seed on a round | Use `bets[].clientSeed` where present; otherwise use the matching seed record's `clientSeed` |
| Player hand | `cards`, `betAmount`, `winningAmount`, `result`; the recorded `won` label includes pushes, so payout reconstruction derives the result from cards |
| Dealer hand | Complete cards revealed at settlement, including the hole card; this does not describe what was exposed during play |
| Per-hand amount | For a doubled hand, its own `winningAmount` represents the base portion; the round total includes the corresponding additional return |
| Side bet | Perfect Pairs, 21+3 or insurance, including recorded stake, return and result/category |
| `sideFunded` | Auditor-recorded request-side declaration: both side bets on 5,800 rounds, neither on the 200 Phase-E rounds. It provides a coverage denominator; it is not a wallet debit record |
| `sideReturned` | Capture-recorded response-presence flags; matches `sideFunded` in the sample and is not used as a verification verdict |
| Capture calculations | `localSequence`, `verified`, `commitVerified`, `chainLinkOk`; stripped in memory by the loader before verification so the scored checks cannot rely on them |

Join a bet to its revealed seed using `hashedServerSeed`:

```js
const seed = dataset.seeds.find(s => s.hashedServerSeed === bet.hashedServerSeed);
const clientSeed = bet.clientSeed ?? seed.clientSeed;
```

`serverSeedId` is an optional operator identifier and is absent on 145 insurance-winning rounds; it is not the join key. `dealerPoints` is an operator summary and is zero on 381 early-settled rounds. Dealer totals in the audit are calculated from `dealerHand`. `meta.houseEdge` records the nominal configuration label, not the calculated edge.

The reference capture script documents the endpoints, requests, phase plan and rotation discipline. Its transport is intentionally stubbed and credentials are absent; replaying the published evidence does not require running that script or accessing the operator.

## 4. Algorithm and settlement

### Seed-to-shoe calculation

The independent implementation is `src/rng.ts`. It uses Node's built-in cryptographic functions.

```text
HMAC key = hex-decode(serverSeed)
message  = UTF-8(clientSeed + ':' + nonce + ':' + cursor)
digest   = HMAC-SHA256(key, message)

For draw(range, cursor):
    maxFair = floor(2^32 / range) * range
    Read the digest as eight unsigned 32-bit BIG-ENDIAN chunks.
    Return chunk % range for the first chunk < maxFair.
    If all eight are rejected, repeat with cursor + 1,000,000.

Build 416 cards:
    8 decks, each with suits CLUB, HEART, SPADE, DIAMOND,
    each suit containing ranks 1..13 (Ace = 1).

For i = 415 down to 1:
    j = draw(range = i + 1, cursor = i)
    swap(shoe[i], shoe[j])

Commitment = SHA-256(UTF-8(serverSeed hexadecimal STRING))
```

The HMAC key is decoded seed bytes; the commitment hashes the seed's text. These are deliberately different encodings. Rejection-branch coverage is described in §8.

### Deal and action order

The initial deal is player, dealer, player, dealer: player receives `shoe[0]` and `shoe[2]`; dealer receives `shoe[1]` as upcard and `shoe[3]` as hole card.

For an unsplit round, subsequent cards go to the player in action order, then to the dealer. For a split:

```text
shoe[0], shoe[2]  become the original cards of the main and split hands
shoe[4]          is the main hand's automatic second card
shoe[5]          is the split hand's automatic second card
then             the split hand plays out, then the main hand, then the dealer
```

Step 6 checks this order against all recorded player and dealer cards, including all 401 split rounds. Shoe order is fixed by the inputs; actions determine how it is consumed. Insurance and the side bets use cards from the deal and do not introduce a separate random draw.

### Base-game and insurance returns

A return includes the stake. The evaluator derives totals and naturals from the cards rather than trusting the operator's outcome label.

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

A two-card 21 after a split is not a natural. Each split hand is evaluated separately. The sampled behavior supports dealer stand on soft 17, double after split, one-card-only split aces, and early dealer-natural settlement consistent with peek/original-bets-only protection. Doubles are observed on initial two-card totals 5–20; that observed range does not establish the full accepted input contract. Surrender and re-split availability are model assumptions pending direct inspection.

### Accounting precision and round reconciliation

`src/money.ts` reads recorded amounts into integer units of **1e-8**. This is the accounting grid used by the captured game records; it is not a claim about USDC's on-chain token precision. Steps 8–10 and 15–16 compare applicable payouts exactly in those units. The separate grid check allows only a small tolerance for converting binary floating-point representations back to the grid.

For the current sample:

```text
round return = sum(base hand returns) × m + sum(side-bet and insurance returns)
m = 1 when no hand doubles; m = 2 when every hand doubles
```

All 6,000 rounds reconcile exactly. No captured split round doubles only one of its two hands. For that uncaptured case the current verifier checks an interval because the flat action list cannot attribute the double to a hand; the production plan adds per-hand action records before claiming exact coverage of that case.

The one-unit and 50-unit payout mutations test errors on the accounting grid. An off-grid perturbation is tested separately. At the sample's initial stakes of $0.10 and $10, the assessed payout multipliers produce amounts exactly on the grid, so the model requires no payout rounding adjustment for those stakes.

## 5. Game mathematics

### Base-game RTP

The headline is the expected return of the total-dependent strategy table in `src/strategy.ts` on an eight-deck shoe, reshuffled each round. The model uses 3:2 naturals, dealer stand on soft 17, double after split, dealer peek/original-bets-only treatment and one additional card to each split ace. It assumes no surrender and no re-splitting. It does not claim a proof that this policy is optimal among all composition-dependent strategies.

`src/exact-play.ts` enumerates the initial rank draws without replacement. On a composition with counts `c`, drawing rank `r` has probability `c[r] / sum(c)` and decrements that count. Dynamic programming then evaluates the declared player policy and dealer play, including the hole-card conditioning after a negative peek. The calculation sums probability-weighted returns and wagers across these paths. "Exact" describes deterministic evaluation of this model, without Monte Carlo sampling error; the implementation uses floating-point arithmetic.

Let `G` be net profit per round and `W` be total base-game wager, each in units of one initial stake. The committed calculation gives:

```text
E[G] = -0.004876748223247249
E[W] =  1.1277411600701008

House edge per initial bet = -E[G]
                          = 0.4876748223247249%
RTP per initial bet        = 1 + E[G]
                          = 99.51232517767528%

House edge per total wager = -E[G] / E[W]
                          = 0.43243506541377884%
RTP per total wager        = 1 + E[G] / E[W]
                          = 99.56756493458622%
```

The per-initial convention expresses expected profit/loss relative to the initial stake. The per-total convention divides by all base-game money wagered, including splits and doubles. Neither includes side bets or insurance.

Split valuation uses linearity of expected return under the declared fixed policy and two-hand limit. Both hands follow the same total-dependent policy, without adjusting decisions to exploit the other hand's drawn cards. The shared-shoe hands need not be independent for their expected returns to add. This result is scoped to that model; it does not establish the value of a composition-dependent split strategy.

### Mathematical cross-checks

| Check | Evidence and interpretation |
|---|---|
| Small-shoe exact-rational oracle | `anchor/oracle.py` physically enumerates reduced shoes. `exactOracleTests.ts` compares the solver with **437/13200**, **17081/194040** and **78863/900900**, at an absolute tolerance of **1e-12**. The oracle shares the strategy table and the audit team; it checks arithmetic on specified cases, not independent rule discovery or policy optimality. |
| Recorded external reference | The Wizard of Odds calculator reference in `exact-rtp.json` records **0.48768%** for the stated eight-deck inputs. The solver differs by **−0.000005177675 percentage points**. This is a close external cross-check, not certification of every displayed decimal. |
| 30-million-round simulation | Stored simulated edge **0.4885883333%** versus exact **0.4876748223%**. The comparison uses `1.15 / sqrt(30,000,000)` as standard error: **0.0209960314 percentage points**. Difference / standard error = **0.04350875**, reported as **0.04σ**, within the **3σ** check. |
| Round-engine binding | `roundEngineTests.ts` compares two million generated rounds with the exact model using a **5σ** window of **0.4065864 percentage points per initial bet**. This is a separate test from the 30-million-round comparison. Its payout mutation is R37. |

The recorded external reference is [Wizard of Odds' Blackjack calculator](https://wizardofodds.com/games/blackjack/calculator/), captured by the auditor on 23 August 2026 with its settings stored in `outputs/exact-rtp.json`. The one-deck and six-deck comparisons are diagnostic cross-checks, not alternative estimates of LIQD's eight-deck RTP. The external comparison's precision and shared model assumptions are consolidated in §8.

### Side-bet RTP

The evaluators use the player's initial two cards for Perfect Pairs and those cards plus the dealer upcard for 21+3. Odds below are profit-to-stake; a winner also receives its stake back.

| Perfect Pairs category | Profit odds | Total return | Probability conditional on the first card |
|---|---:|---:|---:|
| Identical rank and suit | 25:1 | 26 | 7/415 |
| Same rank and colour, other suit | 13:1 | 14 | 8/415 |
| Same rank, opposite colour | 6:1 | 7 | 16/415 |
| No pair | — | 0 | 384/415 |

```text
Perfect Pairs RTP = (7 × 26 + 8 × 14 + 16 × 7) / 415
                  = 406/415 = 97.8313253012%
House edge        = 9/415 = 2.1686746988%
```

The 21+3 enumeration counts unordered physical three-card combinations. There are `C(416,3) = 11,912,160`. Categories are mutually exclusive and evaluated in the following priority:

| 21+3 category | Profit odds | Total return | Combinations |
|---|---:|---:|---:|
| Suited three of a kind | 100:1 | 101 | 2,912 |
| Straight flush | 40:1 | 41 | 24,576 |
| Three of a kind | 30:1 | 31 | 61,568 |
| Straight | 10:1 | 11 | 368,640 |
| Flush | 5:1 | 6 | 700,928 |
| No match | — | 0 | 10,753,536 |

```text
Weighted total return = 2,912 × 101 + 24,576 × 41 + 61,568 × 31
                      + 368,640 × 11 + 700,928 × 6
                      = 11,470,944
21+3 RTP              = 11,470,944 / 11,912,160 = 96.2960873595%
House edge            = 441,216 / 11,912,160
                      = 4596/124085 = 3.7039126405%
```

`src/sidebet-edges.ts` performs the weighted enumeration over the 52 card identities, with eight copies of each. It checks total weights against `C(416,2) = 86,320` and `C(416,3) = 11,912,160`. `sideBetEdgeTests.ts` tests the exact rational edges; `outputs/report-figures.json` records the resulting figures.

### Observed sample return

The recorded money totals are **$2,992.60 base-game stakes**, **$1,160 side-bet stakes** and **$86.65 insurance stakes**, against **$4,155.35 total returns**. Consequently:

```text
Observed return including insurance = 4,155.35 / 4,239.25 = 98.0208763343%
Observed return excluding insurance = 4,089.05 / 4,152.60 = 98.4696334826%
```

These are accounting summaries. The capture combines different stakes and deliberately non-basic-strategy phases, so it is not an experiment designed to estimate the basic-strategy RTP. The report takes its theoretical RTP from the deterministic model. No confidence claim about a small RTP deviation is inferred from these observed totals.

## 6. Worked captured bets

The examples below use the committed dataset and the algorithm in §4. Epoch and nonce identify a round; `hashedServerSeed` joins it to its revealed seed. All amounts are USDC accounting amounts and include returned stake.

### Example 1: epoch 0, nonce 0

Bet `6hBu_VAq-lMp3UKjYMS1a`.

```text
serverSeed: 6dca5e36b6b9dc56730e282ab3c2bae6
clientSeed: audita6d2fe11bb1f
nonce: 0
SHA-256 of seed text: 948eff896b5521c1064402dcd5557342210e03e0c4e864d0b83418bfb5e12f42
recorded commitment: 948eff896b5521c1064402dcd5557342210e03e0c4e864d0b83418bfb5e12f42
first HMAC message: audita6d2fe11bb1f:0:415
first HMAC digest: d1b4e0facbbbc71d6214329ea062281a590b3cc14a2653707bb318a85e306d2f
first uint32: 3518292218; accepted j for range 416: 90
```
The full shuffle and the action order in §4 give this dealt-card sequence, which matches the recorded sequence:

```text
HEART:7 CLUB:10 HEART:9 HEART:11 HEART:5
```
| Settlement component | Calculated return | Recorded return |
|---|---:|---:|
| Hand 1, base portion | 0.20 | 0.20 |
| perfectPair (NO_PAIR) | 0.00 | 0.00 |
| twentyOnePlusThree (NO_MATCH) | 0.00 | 0.00 |
| **Round total, including any double returns** | **0.20** | **0.20** |

### Example 2: epoch 0, nonce 12

Bet `mpWMQllDG1ErqaG6SQR8T`.

```text
serverSeed: 6dca5e36b6b9dc56730e282ab3c2bae6
clientSeed: audita6d2fe11bb1f
nonce: 12
SHA-256 of seed text: 948eff896b5521c1064402dcd5557342210e03e0c4e864d0b83418bfb5e12f42
recorded commitment: 948eff896b5521c1064402dcd5557342210e03e0c4e864d0b83418bfb5e12f42
first HMAC message: audita6d2fe11bb1f:12:415
first HMAC digest: f6e45442fcf8453471068cb0e74290eb366cac70b1e8d00ddc18dd803d2c163e
first uint32: 4142158914; accepted j for range 416: 322
```
The full shuffle and the action order in §4 give this dealt-card sequence, which matches the recorded sequence:

```text
HEART:1 SPADE:8 CLUB:13 DIAMOND:9
```
| Settlement component | Calculated return | Recorded return |
|---|---:|---:|
| Hand 1, base portion | 0.25 | 0.25 |
| perfectPair (NO_PAIR) | 0.00 | 0.00 |
| twentyOnePlusThree (NO_MATCH) | 0.00 | 0.00 |
| **Round total, including any double returns** | **0.25** | **0.25** |

### Example 3: epoch 2, nonce 19

Bet `FschhjKZOHdrZ6TrMT4So`.

```text
serverSeed: 462b3034c052f3b381faf7a9df8786c2
clientSeed: audit9d3a9fbe9f01
nonce: 19
SHA-256 of seed text: 9e7871e9e10b395a061d187faaab96c7d2f7516d3699b525fc956f513bfbbd73
recorded commitment: 9e7871e9e10b395a061d187faaab96c7d2f7516d3699b525fc956f513bfbbd73
first HMAC message: audit9d3a9fbe9f01:19:415
first HMAC digest: 133dabd6ed708a2531331c6299ff619172de5121e95e8137fd1ff507f6a19112
first uint32: 322808790; accepted j for range 416: 278
```
The full shuffle and the action order in §4 give this dealt-card sequence, which matches the recorded sequence:

```text
DIAMOND:12 HEART:1 DIAMOND:6 DIAMOND:10
```
| Settlement component | Calculated return | Recorded return |
|---|---:|---:|
| Hand 1, base portion | 0.00 | 0.00 |
| perfectPair (NO_PAIR) | 0.00 | 0.00 |
| twentyOnePlusThree (NO_MATCH) | 0.00 | 0.00 |
| insurance (insurance) | 0.15 | 0.15 |
| **Round total, including any double returns** | **0.15** | **0.15** |

### Example 4: epoch 2, nonce 25

Bet `8Kory8RWLJJjAwIhJ1LI5`.

```text
serverSeed: 462b3034c052f3b381faf7a9df8786c2
clientSeed: audit9d3a9fbe9f01
nonce: 25
SHA-256 of seed text: 9e7871e9e10b395a061d187faaab96c7d2f7516d3699b525fc956f513bfbbd73
recorded commitment: 9e7871e9e10b395a061d187faaab96c7d2f7516d3699b525fc956f513bfbbd73
first HMAC message: audit9d3a9fbe9f01:25:415
first HMAC digest: 381e244b4a6303dcaa186b2cea436cdb29b0b7da1d8b131a3dd3e045ff064094
first uint32: 941499467; accepted j for range 416: 363
```
The full shuffle and the action order in §4 give this dealt-card sequence, which matches the recorded sequence:

```text
CLUB:6 CLUB:6 HEART:6 SPADE:13 CLUB:1 CLUB:13 DIAMOND:1 CLUB:1 HEART:7
```
| Settlement component | Calculated return | Recorded return |
|---|---:|---:|
| Hand 1, base portion | 0.20 | 0.20 |
| Hand 2, base portion | 0.20 | 0.20 |
| perfectPair (MIXED_PAIR) | 0.70 | 0.70 |
| twentyOnePlusThree (THREE_OF_A_KIND) | 3.10 | 3.10 |
| **Round total, including any double returns** | **4.60** | **4.60** |

Both player hands double. Their base returns sum to 0.40; doubling contributes another 0.40. Perfect Pairs returns 0.70 and 21+3 returns 3.10: `0.40 × 2 + 0.70 + 3.10 = 4.60`. The stored JSON number is `4.6000000000000005`, which reads as 460,000,000 accounting units.

### Example 5: epoch 4, nonce 48

Bet `wJ_oClDC8vPtwpha0-ORM`.

```text
serverSeed: 60809980f132fd93d87ce744cad6724d
clientSeed: audita6c57ff5dc82
nonce: 48
SHA-256 of seed text: f11e19d58373b3d8a583409ffc99d9e251c2556e873a38fff493ec349bbf5f86
recorded commitment: f11e19d58373b3d8a583409ffc99d9e251c2556e873a38fff493ec349bbf5f86
first HMAC message: audita6c57ff5dc82:48:415
first HMAC digest: c008a20b07971832add3e1a86d5357a71efe8b29c594b8812c3fa131b0acd528
first uint32: 3221791243; accepted j for range 416: 203
```
The full shuffle and the action order in §4 give this dealt-card sequence, which matches the recorded sequence:

```text
CLUB:1 DIAMOND:4 CLUB:1 SPADE:6 SPADE:2 HEART:3 HEART:7
```
| Settlement component | Calculated return | Recorded return |
|---|---:|---:|
| Hand 1, base portion | 0.00 | 0.00 |
| Hand 2, base portion | 0.00 | 0.00 |
| perfectPair (PERFECT_PAIR) | 2.60 | 2.60 |
| twentyOnePlusThree (NO_MATCH) | 0.00 | 0.00 |
| **Round total, including any double returns** | **2.60** | **2.60** |

## 7. Reproduction and test coverage

### Running the assessment

With Node.js 22 or later, install the locked dependencies and execute the TypeScript sources:

```sh
npm ci
npm test
```

`npm test` invokes `test:toolchain`, which runs Mocha followed by `npm run verify`. The expected result is **77 unit tests passed** and **31/31 verification checks passed**, exit **0**. The displayed `PROVABLY FAIR — Full Pass` is the result of the defined checks. Certification remains scoped as stated in the README. `npm ci` installs the dependencies pinned in `package-lock.json` and may require network access.

The standalone JavaScript files use Node's built-in modules and read evidence from this package, without dependency installation:

```sh
node test.js
node verify.js
```

`npm run test:standalone` runs these two commands in sequence, with the same expected test and verification counts. The standalone bundles are snapshots of executable code; source edits must be tested through the source toolchain and reflected in the bundles before release. The external bundle-generation tools named in bundle headers are not included in this package.

The verifier writes `outputs/verification-results.json` and `outputs/report-figures.json`. Both are deterministic for the included inputs. `npm run rtp` regenerates `outputs/exact-rtp.json`. `npm run attack` and `npm run branches` regenerate their respective artifacts. Source and standalone verification read the committed simulation results; neither reruns the full 30-million-round experiment.

`npm run simulate` creates a new experiment with fresh randomness and overwrites `outputs/simulation-results.json` and `outputs/rtp-convergence.html`. `npm run test:full` runs the source unit tests, a fresh simulation, then verification with `SIM_FRESH=1`. That setting records and labels the fresh simulation hashes while retaining required-artifact presence checks. Use a disposable copy for new experiments so the published evidence remains available for comparison. `npm run calibrate` runs fresh statistical calibration replicates; this package does not include a pinned calibration result.

### Unit and verification coverage

| Test area | Files and checks |
|---|---|
| Seed and card reconstruction | `rngTests.ts`; Steps 1–7 |
| Card-derived settlements and side bets | Steps 8–16, 27–29; `sideBetEdgeTests.ts` |
| Exact mathematics | `exactSolverTests.ts`, `exactOracleTests.ts`, `optimalPlayTests.ts`, `wooAnchorTests.ts`; Step 17 |
| Reference shuffle and round engine | `rngTests.ts`, `roundEngineTests.ts`; instrumented shuffle use, deep draw cases and RTP consistency |
| Capture independence | `antiCircularityTests.ts`; capture-computed result fields are removed before verification |
| Artifact integrity and consistency | `artifactTests.ts`; Step 25; required files, hash pins and recalculated report fields |
| Statistical interpretation and population checks | Steps 17–19, 22–26 and 30–31 |

The 77 unit tests are distributed across nine files under `tests/blackjack/`. Full-dataset verification has 31 scored steps and separate informational outputs. A stored result file is a record of a run; executing the corresponding check independently verifies the stated result against the supplied inputs.

### Deliberate mutations

`tests/mutations.json` declares **42 mutations**. The registry names the input change, target test or verification step, and required failure marker. `tests/mutate.ts` runs selected entries or the full registry in a disposable copy:

```sh
npm run mutate           # all registry entries
npm run mutate -- 12 13  # seed and payout examples
```

This command is separate from `npm test`. A successful mutation-runner exit means its selected corruptions were detected as specified, not that the corrupted data passed verification.

The payout example at registry index **13**, R10, changes the epoch-0 nonce-12 natural's recorded return from **0.25 to 0.20** on a **0.10** stake. The rules require `0.10 × 2.5 = 0.25`; the changed return is even money, a **0.05** shortfall. The outer check rejects the dataset's changed hash. The inner check updates the pin in the disposable source copy, then requires **Step 8** to fail on the payout itself.

Index **12**, R9, changes the epoch-0 revealed server seed. After re-pinning, **Step 1** must fail because the seed no longer hashes to its recorded commitment. Other registry cases include a one-accounting-unit payout discrepancy and changing the round engine's own natural return from 2.5 to 2. These test different failure mechanisms: byte integrity, semantic consistency and source behavior.

The registry count alone is not an execution claim. Results depend on the entries and runners actually invoked. Seed and payout mutations can fail independently of the integrity pin because the runner includes the re-pinned checks.

### Artifact checks

Six artifacts are pinned in `src/config.ts`: the dataset, simulation JSON, convergence HTML, exact RTP JSON, seed-selection experiment and RNG branch-coverage JSON. Step 25 checks required presence and matching hashes. The exact RTP artifact also has a source unit test that regenerates it. Report figures are recalculated and compared field by field rather than merely hashed.

Steps 17–19 use stored simulation evidence. Step 17 recalculates the exact edge, declared sample size, standard error and comparison. Step 18 recalculates the p-value at the declared degrees of freedom. Step 19 recalculates seed-row identity, early-window statistics, late-window p-values and flag aggregation. Its stored `lateChi2` and `earlyBootstrapP` inputs have the qualifications in §8.

## 8. Scope and technical qualifications

The result applies to the tested records, declared model and named checks. The following tables consolidate the boundaries so they can be interpreted alongside the findings. IDs provide stable references for the source and artifacts.

### Capture scope and production extensions

| ID | Current scope | What production work can establish |
|---|---|---|
| L7 | The capture covers QA, not production. No identity between backend deployments is assumed. | A direct production capture can establish the tested production behavior. Identifying a particular backend release additionally requires deployment evidence. |
| L4 | Recorded game returns reconcile; wallet balances and transaction deltas were not captured. | Before/after balances and transaction records can verify expected debits and credits. Per-hand action records can resolve partially doubled splits. |
| L5 | Surrender and re-split availability were not probed. The model assumes neither is available. | Record rules, available actions and relevant responses in applicable states; update the model if the production rules differ. |
| L9 | Seed rotation during an open round was not exercised. | Test that rotation blocks or defers disclosure of a seed still used by unresolved rounds, including shared-seed paths. |
| L10 | Only settled-round cards are captured; pre-settlement hidden-state disclosure was not tested. | Inspect the responses delivered during the deal, actions and recovery to assess hole-card and future-card protection on those paths. |
| L6 | Origin is auditor-attested. The dataset hash supplies byte integrity, not independent proof of an operator response. | Preserve ordered requests/responses, time records, capture identity and extraction provenance. Independent witnessing or operator signatures can strengthen authenticity; self-generated hashes alone cannot establish it. |
| L8 | The exchange-rate field is observed only at 1.00, so its application cannot be distinguished from non-application. | Reconcile wallet movements and game returns. A non-unit rate, if available within scope, or implementation evidence can clarify the field's behavior. |

The sample covers one account and one session. Cross-account treatment, later changes, other games, promotional/bonus/loyalty behavior, unexercised limits and platform services are outside the current findings. Additional accounts and sessions broaden production coverage but do not establish behavior for every player or all future periods.

### Seed selection and server operations

**L1 — Server-seed selection.** Commitments and reveals establish matching inputs, not how a server seed was chosen before its commitment. The first-card rank statistic reports **5 flagged epochs out of 120**, against a nominal expectation of **5.7**, with aggregate survival **P = 0.6789**. This is not a test of settled financial return.

The included experiment selects from **50 candidate server seeds per epoch**, using the corresponding recorded client seed. Its honest comparison returns **98.5950%**, while the selected windows return **68.5331%**. The same first-card detector flags **8/120** selected windows against nominal expectation **5.7**, with **P = 0.2117**. That experiment does not demonstrate useful detection of this return-selection attack at the tested budget and sample size. It neither establishes zero power under every attack nor alleges that LIQD selected seeds this way.

A fresh, independently generated client seed supplied **after the server commitment is recorded** addresses advance selection against an already-known client input, subject to the cryptographic assumptions and correct use of the recorded commitment and nonce sequence. The planned production capture tests that sequence and records failed or interrupted requests. It does not certify unbiased seed selection for every default or retained-client-seed workflow.

**L14 — Server operations.** Seed-generation entropy, key custody and internal selection mechanisms are outside a client-side capture. Capturing failed requests and interrupted rounds can reveal some anomalies or support later investigation; it does not establish the complete absence of selective aborts. Stronger assurance about server operations requires implementation and operational evidence or changes to the protocol.

### Technical coverage and numerical interpretation

| ID | Qualification | Interpretation |
|---|---|---|
| L2 | The reconstructed 6,000 shoes contain **2,490,000** draws, all accepting the first 32-bit chunk. Expected later-chunk draws: **0.0569**; probability of no such event under the model: **94.47%**. | The sample does not distinguish rejection sampling from simple modulo on those inputs. If rejection were omitted, the published per-draw bounds are **2.32 × 10^-10** maximum point bias and **2.38 × 10^-8** total variation. Targeted implementation tests or source evidence are more suitable than ordinary capture for this branch. |
| L3 | Steps 17–19 check retained simulation evidence. Step 19 recomputes the early statistic and later p-value, while reading stored `lateChi2` and `earlyBootstrapP`. The original 500,000-round seed pair, 30-million-round random stream and bootstrap random inputs are not preserved. | The seed-based control window can be replayed from the included casino seeds. Fresh simulations generate new experiments; preserving their replay inputs and bootstrap null statistics would support exact replay of those future runs without new gameplay. |
| L11 | The one-deck diagnostic differs from the recorded external one-deck reference by approximately **0.031 percentage points**. | Its attribution to a different strategy policy is not independently calculated here. The headline evaluates eight decks and does not depend on explaining this diagnostic difference. |
| L12 | The external reference is finite-precision. The six-deck comparison differs by approximately **0.000054 percentage points**; the eight-deck comparison differs by approximately **0.0000052 percentage points**. | Close agreement supports the model at the reference's available precision. It does not certify all digits of the internal solve. |
| L13 | The small-shoe oracle shares the policy, rule interpretation and implementer with the solver, while using a different physical enumeration method. | Agreement at **1e-12** tests specified arithmetic cases. It is not an independent discovery of the rules or a proof of policy optimality. |

The first-card rank and lag-1/runs statistics cover their named quantities. Passing them does not test every card position, suit pattern or possible dependence. The observed card reconstruction and the construction of the reference algorithm are separate evidence. Likewise, a statistical acceptance window describes a check's tolerance; it is not a guarantee of detecting every deviation within that window.


### Load-bearing premises

Every premise the verdict rests on, the artifact that witnesses it, and the question that decides how much scrutiny it needs: whether the captured data could have contradicted it. A premise the data cannot contradict carries a witness from outside this repository's own pipeline, or is marked ASSUMED. Agreement between the audit's own checks is not evidence for a premise the data cannot see.

| Premise | Witness artifact | Could the captured data contradict it? |
|---|---|---|
| The RNG is HMAC-SHA256 with a hex-decoded key over `clientSeed:nonce:cursor`, feeding a backward Fisher-Yates shuffle of the 416-card shoe. The modulo-bias rejection guard is ASSUMED and listed as a separate premise below | `data/blackjack-6000hands.json` | Yes — all 6,000 dealt sequences reproduce bit for bit from the raw revealed seeds (Step 6 — Recomputation Parity); a single wrong constant breaks every round at once |
| The commitment convention is SHA-256 over the UTF-8 server-seed hex string | `data/blackjack-6000hands.json` | Yes — 120 of 120 revealed seeds hash to their recorded commitments; a different convention fails all 120 |
| The next-seed pre-commitment chain is intact | `data/blackjack-6000hands.json` | Yes — 119 of 119 successive links reconcile (Step 2) |
| Settlement follows the recorded rules: naturals at 3:2, dealer stands on soft 17, with doubles, splits and insurance as recorded | `data/blackjack-6000hands.json` | Yes — all 6,000 top-level settled amounts reconcile from the recomputed cards, including 401 split rounds (Steps 8-13, 27) |
| The side-bet paytables are as configured for Perfect Pairs and 21+3 | `data/blackjack-6000hands.json` | Yes — both side bets are re-derived from the initial cards across every round that carries them, with no category or payout mismatch (Steps 15, 16) |
| The exact eight-deck basic-strategy edge is 0.4876748223% | `evidence/E16-storefront-edge-0.48.png` — the operator's own storefront figure of 0.48%, corroborated by the external calculator reference recorded in `outputs/exact-rtp.json`, which differs from the solver by about −5.2e-6 percentage points | Partial — the captured hands cannot measure the exact-strategy expectation, because 6,000 rounds of ordinary variance cannot resolve a figure at this precision. The number is anchored externally and by reduced-scale exact enumeration, never derived from the dataset (**L12**) |
| The rule set is S17, double after split, no surrender, no re-split of aces, dealer peek with original bets only, naturals 3:2 | `data/blackjack-6000hands.json` | Partial — the dataset exhibits each of these wherever a round arises that exercises it, but the *availability* of the unused rules is a different claim: no surrender action occurs in the sample and no round goes above two hands, so neither availability was probed (**L5**) |
| The operator applies a modulo-bias rejection guard equivalent to the reference implementation | ASSUMED — the branch is unexercised. All 2,490,000 draws across the reconstructed shoes accept their first 32-bit chunk, so no captured round distinguishes a guarded server from an unguarded one (**L2**) | **No** |
| A credited win can be reconciled against a wallet balance change | ASSUMED — recorded game returns reconcile, but wallet balances and transaction deltas were not captured (**L4**) | **No** |
| The `qa` build is the production build | ASSUMED — nothing in this package establishes it, and nothing is claimed about production (**L7**) | **No** |

### Model anchors

Every modelled headline number and the independent anchor that guards it. The reference value comes from outside the engine's own method, which is what makes it an anchor rather than the suite agreeing with itself.

| Modelled figure | Anchor method | Tolerance | Enforcing step |
|---|---|---|---|
| The eight-deck total-dependent edge, and the return derived from it | Two independent anchors. First, an exact-rational enumerator over physically reduced shoes, which holes a concrete card and conditions nowhere, so a conditioning error is inexpressible in it. Second, the recorded external calculator reference for the same eight-deck inputs | 1e-12 against the enumerator; the external reference agrees to about 5.2e-6 percentage points | `tests/blackjack/exactOracleTests.ts`, `tests/blackjack/wooAnchorTests.ts`; Step 17 |
| The infinite-deck regression value | An independent with-replacement analytical engine, pinned against drift | 1e-9 | `tests/blackjack/optimalPlayTests.ts` |
| The Perfect Pairs side-bet edge | Exact integer enumeration of the full eight-deck two-card draw distribution, classified by the same evaluator that reconstructs every live Perfect Pairs settlement | Exact rational, no tolerance | `tests/blackjack/sideBetEdgeTests.ts`; Step 15 |
| The 21+3 side-bet edge | The same method over the three-card distribution, with the evaluator shared with the live settlement check | Exact rational, no tolerance | `tests/blackjack/sideBetEdgeTests.ts`; Step 16 |
| Shoe composition and deck count | Recomputation of the dealt sequence against a declared 416-card shoe, so a wrong deck count fails the parity check rather than being assumed | Exact | `tests/steps/parity.ts` (Step 6), Step 30 — Deck-Model Confirmation |

**Residual, declared.** The small-shoe oracle shares its policy input, its reading of the rules and its implementer with the solver it checks (**L13**), so it establishes arithmetic correctness on the cases it enumerates rather than independent discovery of the rules or optimality of the policy. That residual is real and is not argued away. What narrows it: the enumerator is a physical enumeration over concrete reduced shoes rather than a second pass of the same conditioning logic, so the error class it is blind to is a rules misreading, not an arithmetic slip; and the headline edge additionally agrees with an external reference obtained outside this project. A second residual, named: the external reference is finite-precision, so agreement with it is bounded by its own published precision (**L12**). Certification remains provisional pending the production capture (**L7**).

## 9. Production verification plan

The provisional certification marks the environment boundary. The QA assessment is complete; the next assessment will use ordinary authenticated play through the public production site, without the QA whitelist or a special audit game setup.

| Workstream | Planned capture and check | Completion evidence |
|---|---|---|
| Production outcomes | Record production domain, game ID, time, displayed rules and available build identifiers; repeat seed, card and payout reconstruction | Published production dataset and verification results; actual scope and versions identified where observable |
| Wallet reconciliation | Record initial and additional wagers, balance changes, transaction references, returns and refunds; account for unrelated wallet movements | Rule-derived debits and credits reconcile with the available wallet records for every included round |
| Rules and action attribution | Record the offered actions and each action's target hand; exercise re-split/surrender availability, split aces, partial doubles and insurance choices | Observed rule table, explicit coverage counts, updated model where necessary and exact reconciliation for the added cases |
| Mid-round protection | Inspect deal/action/recovery responses and attempt seed rotation while a round remains unresolved | Evidence of the tested hidden-information and reveal-timing protections; discrepancies documented and rechecked after correction |
| Commitment and client seed | Record the server commitment, then generate and submit an independent fresh client seed; track expected commitment, nonce, failures and reveal | Ordered transcript demonstrating the tested commitment/client-input sequence and consistent replay |
| Coverage and provenance | Preserve ordered requests/responses and extraction records; extend sessions, stakes and ordinary accounts where feasible | A capture inventory that accounts for included, failed, cancelled and unresolved attempts, with the actual coverage reported |
| Player disclosures | Recheck the production paytables, base-game edge convention and side-bet edges | Recorded player-facing rules and figures compared with the confirmed model |

These workstreams are planned extensions, not completed checks. A production certification decision follows review of the new evidence and resolution of material discrepancies. If a planned check cannot be exercised or its evidence is unavailable, its scope remains explicitly excluded rather than inheriting a pass from the QA capture.

Production capture can resolve the environment boundary and add direct evidence for wallet movements, rule availability and mid-round behavior. It can strengthen provenance and breadth of observation. It cannot, by itself, certify internal server security, every user's seed-selection workflow or future behavior. Those boundaries remain tied to the actual certification scope.

## 10. Evidence and repository reference

| Path | Purpose |
|---|---|
| `README.md` | Assessment, headline findings, scope, production plan and reproduction commands |
| `data/blackjack-6000hands.json` | Hash-pinned capture |
| `src/rng.ts` | Seed-to-shoe reference algorithm and commitment hash |
| `src/config.ts`, `src/types.ts`, `src/loader.ts` | Declared constants, schema and dataset loading |
| `src/money.ts`, `tests/steps/payouts.ts` | Accounting units and card-derived settlement |
| `src/sidebets.ts`, `src/sidebet-edges.ts` | Side-bet categories, payouts and exact edge enumeration |
| `src/exact-play.ts`, `src/strategy.ts` | Deterministic basic-strategy model |
| `src/optimal-play.ts` | Infinite-deck analytical cross-check |
| `anchor/oracle.py`, `anchor/policy.json` | Reduced-shoe physical enumeration and its policy input |
| `src/shuffle.ts`, `src/round-engine.ts`, `src/simulate.ts` | Shared simulation shuffle, separately testable round engine and simulation producer |
| `src/stats.ts`, `src/calibration.ts` | Statistical helpers and fresh calibration experiments |
| `src/cherry-pick-attack.ts`, `src/rng-branch-audit.ts` | Seed-selection experiment and RNG branch-coverage calculation |
| `src/report-figures.ts` | Produces the report's derived accounting and mathematical figures |
| `tests/verify.ts`, `tests/steps/` | Scored verification |
| `tests/blackjack/` | Unit tests |
| `tests/mutations.json`, `tests/mutate.ts` | Mutation registry and runner |
| `test.js`, `verify.js` | Standalone JavaScript test and verification snapshots |
| `outputs/verification-results.json` | Recorded scored results |
| `outputs/exact-rtp.json`, `outputs/report-figures.json` | Deterministic mathematical and accounting figures |
| `outputs/simulation-results.json`, `outputs/rtp-convergence.html` | Committed simulation and convergence chart |
| `outputs/cherry-pick-attack.json`, `outputs/rng-branch-coverage.json` | Detector-response and branch-coverage artifacts |
| `capture/capture-blackjack.reference.mjs` | Capture methodology reference; transport stubbed |
| `evidence/` | Images described below |

### Images

| File | Evidence classification |
|---|---|
| [E12 blackjack table](evidence/E12-blackjack-table-sidebets.png) | Auditor-attested QA interface capture showing the table and side-bet positions; displayed blackjack and insurance payout text |
| [E13 seed panel](evidence/E13-provably-fair-panel.png) | Auditor-attested QA interface capture showing the client seed and current/next commitments |
| [E14 commitment illustration](evidence/E14-seed-rotation-reveal.png) | Auditor-rendered verification illustration, not a live interface screenshot. Its seed pair is outside the 120-epoch dataset and is not counted as sample commitment evidence |
| [E15 settled round](evidence/E15-settled-hand.png) | Auditor-attested QA interface capture of a settled losing round; documents the interface rather than an independently witnessed wallet movement |
| [E16 storefront edge](evidence/E16-storefront-edge-0.48.png) | Auditor-attested QA storefront capture showing the 0.48% advertised edge |

The mathematical external reference is recorded with its input settings in `outputs/exact-rtp.json`. The auditor's live verification-endpoint cross-check is not separately archived; the published, reproducible evidence is the dataset and independent reference reconstruction. The capture and screenshot descriptions identify their origin without treating an illustration or an auditor-authored record as an independent server signature.
