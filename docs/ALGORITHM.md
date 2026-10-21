# LIQD Blackjack: clean-room algorithm specification

Copy of the framework spec (SHA-256 90e6dbc16a4a12646c36a1a185fdf9c793041232d31593394095f200706ffad6, the hash cited in src/rng.ts); local workspace paths and tool names replaced by neutral wording, nothing else changed.

Written 20 Oct 2026 for the ProvablyFair.org audit of LIQD Blackjack (LIQD
Originals, `qa.liqd.com` / `liqd.com`, game id `fast-games-11`).

This document is the only input an implementer needs to rebuild LIQD
Blackjack's shoe, round replay and settlement. It was written without opening
any LIQD source code, any LIQD JS bundle, any port of it, any audit-package
code, any capture of LIQD's Verify tab, or the package's own notes (§8 lists
every file and URL opened, and what was deliberately not opened). Every step
names where it came from:

- **PAGE**: LIQD's own screens and pages: the evidence images in
  `repositories/liqd/blackjack/evidence/` (E12, E13, E15, E16, E18 PNGs) and
  `evidence/rtp-page-labels-2026-10-01.json` (verbatim text of
  `https://liqd.com/originals/blackjack`, read logged out on 1 Oct 2026).
- **STANDARD**: the standard provably-fair construction (SHA-256 commitment to a
  server seed; HMAC-SHA256 keyed by the server seed over
  `clientSeed:nonce:cursor`; 4 bytes to an unsigned integer; Fisher–Yates
  shuffle; rejection sampling against modulo bias).
- **DATA**: fixed by testing standard candidates against every one of the
  **6,000** live rounds in `repositories/liqd/blackjack/data/blackjack-6000hands.json`
  (`qa.liqd.com`, 5 Aug 2026 18:31–20:18 UTC, schema
  `liqd-blackjack-capture-v1`, 120 seed epochs of 50 rounds, phases A–F), plus
  the 10 rounds of the 13 Oct 2026 probe `evidence/E18-insurance-decline-2026-10-13.json`
  (captured API responses). The data chose; LIQD's code did not.
- **API**: fields of LIQD's own API responses as captured in E18 / E23 (data,
  not prose).

No public page found states the algorithm. The pages state the table rules in
one sentence (eight-deck shoe, S17, double any two, split once, 3:2, insurance
2:1); everything in §2 and the settlement arithmetic in §3 was settled by DATA.

---

## 1. Inputs and commitment

### 1.1 Inputs

| Input | Form | Source |
|---|---|---|
| `serverSeed` | **32 lowercase hex characters**; secret until the pair is rotated | PAGE: "Active Server Seed (Hashed)", "Next Server Seed", "Rotate Seed Pair" (E13). DATA: all 121 revealed seeds (120 epochs + `meta.preCapture`) are 32 hex chars; E18 rotate reveals `c2cddb2bbbc39d1c74d466b798c62079` |
| `clientSeed` | text string | PAGE: "Active Client Seed" / "Next Client Seed" with CHANGE (E13; default shown as 32 hex chars). DATA: `audit` + 12 hex on 5,500 rounds; player-set seeds of the form `pfaudit-<digits>-<digits>` (e.g. `pfaudit-1785954682036-96`) on the 500 phase-D rounds |
| `nonce` | integer ≥ 0; 0 on the first round after a rotation, +1 per round | PAGE: "Total bets made with pair 0" on a fresh pair (E13). API: `"nonce": 0` after rotate (E18). DATA: every epoch holds nonces 0…49 (120 / 120) |
| `actions` | the player's decisions in order: `hit`, `stand`, `double`, `split`, and the insurance answer (token `no-ins` in the dataset, see O2) | DATA (`bets[].actions`); PAGE: Hit / Stand / Split / Double buttons and "Insurance? YES / NO" (E12, E15, E18-insurance-offered) |
| main stake `S` | decimal, 8 dp (`betAmount` "0.10000000") | DATA / API |
| side stakes | Perfect Pairs and 21 + 3 amounts, optional | DATA (`sideBets.*.betAmount`); PAGE: "Side bet (Perfect pairs)", "Side bet (21 + 3)" fields (E12) |
| insurance stake | 0 or `S / 2`, depending on the player's answer | DATA (`sideBets.insurance.betAmount`), see §3.4 and O2 |

One round = one nonce. The stakes and the actions are **not** inputs to the
shoe; the actions only decide how many cards are dealt and where each goes.
E14 (an audit-made reveal sheet, not a LIQD page) records the rotate endpoint
`POST /api/v1/fast-games/provably-fair/rotate` and that the seed pair is
account-wide, shared with Mines and Plinko.

### 1.2 Commitment

PAGE shows the hashed active seed and the hash of the next seed before it is
used (E13). No page read says which hash or which bytes. Spec:

```
commitment = lowercase_hex( SHA-256( UTF-8(serverSeed) ) )
```

i.e. hash the **32 ASCII characters**, not the 16 bytes they encode. (The HMAC
key in §2 is the decoded 16 bytes: the two steps use different forms of the
same seed, as in LIQD Mines.)

- SOURCE: STANDARD (SHA-256, hex output) + DATA (byte form).
- Candidates: SHA-256 over the ASCII string → **120 / 120** distinct round
  commitments, **6,000 / 6,000** rounds; over the hex-decoded 16 bytes →
  **0 / 120**. E18: the revealed seed hashes to the probe's
  `activeServerSeedHash` `d3428de9…` (true).
- Pairing: by hashing (build `{commitment(seed): seed}` over all revealed seeds
  and look up each round's `hashedServerSeed`), never by record position.
- Forward chain: `nextHashedServerSeed` before rotation *i* equals the active
  hash of epoch *i+1* on **119 / 119** links; `meta.preCapture.nextHashedServerSeed`
  equals epoch 0's active hash.

---

## 2. Outcome derivation

### Step 1: one HMAC per shuffle step (cursor = array index)

```
key        = hex_decode(serverSeed)                                   # 16 bytes
digest(i)  = HMAC-SHA256(key, UTF-8(clientSeed + ":" + dec(nonce) + ":" + dec(i)))
```

`dec(x)` is plain base 10, no padding, no sign. The cursor `i` is the **array
index being filled** in Step 3, so it runs **415, 414, …, 1** (not 0, 1, …).
Example first message: `audita6d2fe11bb1f:0:415`.

- SOURCE: STANDARD (HMAC-SHA256, server seed key, `client:nonce:cursor`) +
  DATA for key form, separator and cursor numbering.

### Step 2: bytes to an index in [0, i]

```
draw(i):                         # r = i + 1 values
    r     = i + 1
    LIMIT = floor(2^32 / r) * r
    for off in 0, 4, 8, …, 28:
        v = digest(i)[off .. off+3] as unsigned 32-bit BIG-ENDIAN
        if v < LIMIT: return v mod r
    # all 8 chunks rejected: see O1
```

- SOURCE: DATA for "first 4 bytes, big-endian, mod r"; STANDARD for the
  rejection loop. The data **cannot** separate rejection from plain `v mod r`:
  the expected number of rejected first chunks over the 6,000 shuffles
  (2,490,000 draws) is **0.0569**, and **0** occurred. Both forms give
  6,000 / 6,000 (O1).

### Step 3: the shoe and the shuffle (backward Fisher–Yates)

```
SUITS = [CLUB, HEART, SPADE, DIAMOND]
BASE[x] for x = 0 … 415:  deck = x div 52            # 8 decks, deck-major
                          suit = SUITS[(x mod 52) div 13]
                          rank = (x mod 13) + 1      # 1 = Ace, 2…10, 11 = J, 12 = Q, 13 = K
a = [0, 1, …, 415]
for i = 415 down to 1:
    j = draw(i)                  # 0 ≤ j ≤ i
    swap a[i], a[j]
card k of the round = BASE[a[k]]  for k = 0, 1, 2, …   # dealt from the FRONT
```

Card strings in the records are `SUIT:rank`, e.g. `HEART:1` = A♥, `CLUB:12` =
Q♣ (API: `"HEART:1","SPADE:3"` has `playerPoints` 14, E18).

- SOURCE: PAGE for the shoe size: "dealt from an eight-deck shoe" (blackjack
  page, 1 Oct 2026); also dataset header `decks: 8`. STANDARD for Fisher–Yates.
  DATA for direction, cursor, dealing end and the base order.
- Finite shoe, not infinite deck: over 88,431 same-round card pairs, identical
  cards occur 1,419 times; an 8-deck shoe without replacement predicts 1,492,
  an infinite deck 1,701 (DATA).
- Base order: with the shuffle fixed, each base position `a[0]` was learned
  from the first card dealt; all **416 / 416** positions were seen (4–25 times
  each), each always mapped to one card, and the table equals the deck-major
  formula above on **416 / 416**. The full replay then reproduces every dealt
  card of all 6,000 rounds (Step 5).
- How the candidates were settled (first card, scratchpad `cand1`–`cand8`):
  1. Independent per-card draws (infinite-deck style), first card as a
     function of the first digest: key {ASCII, hex-decoded, plain SHA-256 of
     concatenation} × message {`c:n:k`, `c:n` 8 chunks, Stake-style 8 floats per
     block, `n:c:k`, `c-n-k`, `c:n:0`, `c:n:1`, `n:c`, `cn`, `n+1`, HMAC-SHA512 …}
     × mapping {u32 BE / LE mod 52 or 416, float × 52 / 416, 52-bit float} and
     moduli 2…1199: best functional consistency **0.141–0.25**, no candidate
     functional.
  2. Full 416-card shuffles (first 1,500 rounds, 168 combinations): key
     {ASCII, bytes} × message {`c:n:i`, `c-n-i`, `n:c:i`} × index {u32 mod,
     u32 × r >> 32} × shuffle {backward FY cursor = i, backward FY cursor = step
     t, forward FY, inside-out, Sattolo, naive, sort-by-key} × end {front,
     back}. Exactly one combination scored **1.000**: bytes key, `c:n:i`, u32
     mod, backward FY with cursor = i, dealt from the front. Next best 0.319.
  3. Full dataset, full-round card match (§7): the spec **6,000 / 6,000**;
     ASCII key, cursor = step t, u32 little-endian, float index, message
     `c:n-i`, forward FY: **0 / 6,000** each.

### Step 4: deal order

```
k = 0  player card 1 (P1)
k = 1  dealer up card
k = 2  player card 2 (P2)
k = 3  dealer hole card (drawn now, shown face down)
k = 4… every later card, in the order it enters play (Step 5)
```

- SOURCE: DATA. P1, up, P2, hole: 6,000 / 6,000 after Step 5; P1, P2, up, hole:
  at most 89 / 6,000; hole card drawn only when the dealer plays: at most
  2,123 / 6,000 (`replay.py`).

### Step 5: round replay (where each later card goes)

Totals: 2–10 face value, J/Q/K = 10, A = 11 or 1 (count 11, subtract 10 per
Ace while over 21). "Natural" = two-card 21 in the unsplit hand.

1. **Insurance step.** If the up card is an Ace **and the player has no
   natural**, the next action is the insurance answer. No card is drawn. With an
   Ace up and a player natural there is no insurance step (16 rounds, no token).
2. **Naturals end the round at the deal.** If the dealer (up + hole) or the
   player has a natural, the round ends: no further cards for anyone. Dealer
   naturals: 273 rounds (128 with a ten up and no action; 145 with an Ace up
   after the insurance answer); player naturals 253 (10 of them vs a dealer
   natural).
3. **Split** (only as the first play action, on any two cards of equal value:
   pairs, and any two ten-value cards, e.g. K-Q, 134 rounds). Hand 1 (`main`)
   = [P1], hand 2 (`split`) = [P2]. **Hand 1 gets the next card, then hand 2
   gets the next card; then hand 2 is played first, then hand 1.**
   - Split Aces: each hand keeps its two cards, no action (70 hands).
   - A two-card 21 after a split does **not** end the hand: the player still
     acts on it (stand, hit or double; 10 doubles on 21 witnessed).
   - One split only: no round has more than two hands; `split` appears only as
     the first play action (401 / 401).
4. **Play a hand**: consume actions until it stands, doubles or busts; a hand
   that reaches 21 by drawing ends without an action.
   - `hit`: one card to this hand. `stand`: hand ends.
   - `double`: exactly one card, a second bet equal to the hand's stake, hand
     ends. Allowed on any first two cards (two-card totals 4 to 21 witnessed,
     1,448 doubled hands, 164 soft) and after a split (165 rounds).
5. **Dealer** (unless the round ended at the deal): draws while the total is
   below 17, **stands on all 17s including soft 17**, and draws **even when
   every player hand has busted** (720 such rounds).

- SOURCE: PAGE for S17, double, split once: "the dealer standing on soft 17.
  You can double on any first two cards, split once" (blackjack page, 1 Oct
  2026). DATA for everything else. Candidates (§7, all 6,000 rounds, cards and
  exact action consumption):

  | Variant | Cards match |
  |---|---|
  | **spec** | **6,000 / 6,000** (actions consumed exactly 6,000 / 6,000) |
  | split: hand 1 played first | 5,747 |
  | split: hand 2's second card dealt only when hand 2 is played | 5,604 |
  | two-card 21 after a split ends the hand | 5,989 |
  | no hand ever ends automatically at 21 (`replay3.py`) | 5,769 |
  | dealer does not draw when all hands bust | 5,280 |
  | dealer hits soft 17 | 5,894 (108 soft-17 stands witnessed) |
  | split Aces playable | 5,965 |
  | insurance step also when the player has a natural (`replay3.py`) | 5,984 |

- E18 (13 Oct 2026, two months later, seed `c2cddb2b…`, client
  `auditff78d5b3c1fb`): all **10 / 10** rounds' player and dealer cards match
  this spec, so the algorithm was unchanged on that date.

---

## 3. Win condition and payout

### 3.1 Main bet (per hand)

`s` = the hand's stake (= `S`). Return as a multiple of `s`, first match wins:

| Case | Return | Record `result` |
|---|---|---|
| unsplit natural vs dealer non-natural | 5/2 (3:2) | `won` |
| unsplit natural vs dealer natural | 1 (push) | `won` |
| dealer natural | 0 | `lost` |
| player total > 21 | 0 | `lost` |
| dealer total > 21, or player total > dealer total | 2 | `won` |
| equal totals | 1 (push) | `won` |
| otherwise | 0 | `lost` |

- A two-card 21 after a split is an ordinary 21, paid 2 (27 hands).
- **Double**: the doubled bet is settled with the same multiple as the base
  bet. The hand record keeps `betAmount` = `s` and `winningAmount` = the base
  bet's return only; the round total includes both (see 3.5).
- `result` is `won` whenever the return is > 0, pushes included.
- SOURCE: PAGE: "Blackjack pays 3:2" (blackjack page), felt "BLACKJACK PAYS 3
  TO 2" (E18-insurance-offered; E12 reads "PAYS TO 3 TO 2"). STANDARD for the
  rest. DATA: hand `winningAmount` exact **6,401 / 6,401**, `result` 6,401 /
  6,401, `points` 6,401 / 6,401. Witnesses: 3:2 243, dealer natural vs
  non-natural 273, push 422 (10 of them natural vs natural; +100 doubled), win
  1,806 (+538 doubled).

### 3.2 Perfect Pairs (player cards P1, P2; k = 0, 2)

| Category (`gameResult`) | Rule | Return × stake |
|---|---|---|
| `PERFECT_PAIR` | same rank, same suit | 26 (25:1) |
| `COLORED_PAIR` | same rank, other suit, same colour (♥♦ red, ♣♠ black) | 14 (13:1) |
| `MIXED_PAIR` | same rank, other colour | 7 (6:1) |
| `NO_PAIR` | else | 0 |

### 3.3 21 + 3 (P1, P2 and the dealer up card; k = 0, 2, 1)

Precedence top to bottom:

| Category (`gameResult`) | Rule | Return × stake |
|---|---|---|
| `SUITED_THREE_OF_A_KIND` | same rank, same suit | 101 (100:1) |
| `STRAIGHT_FLUSH` | straight and flush | 41 (40:1) |
| `THREE_OF_A_KIND` | same rank | 31 (30:1) |
| `STRAIGHT` | three consecutive ranks; A low (A-2-3) and high (Q-K-A); no wrap | 11 (10:1) |
| `FLUSH` | same suit | 6 (5:1) |
| `NO_MATCH` | else | 0 |

- Both side bets read the **original** P1, P2 even after a split (395 / 395
  split rounds with side bets; hand 1's own two cards give 123 / 395 for
  Perfect Pairs).
- SOURCE: PAGE names the bets only ("take two optional side bets on every
  hand", E12 field labels). Categories: STANDARD + DATA (labels **5,800 /
  5,800** each). Return multiples: DATA, `winningAmount / betAmount`, exact on
  **5,800 / 5,800** each; every category is witnessed (PP 100 / 123 / 234;
  21+3 suited trips 1, SF 14, trips 32, straight 166, flush 345). Straight
  edges: A-2-3 → STRAIGHT 12, Q-K-A → STRAIGHT 13, K-A-2 → NO_MATCH 12, FLUSH 1.
  The dataset header's `payout` block lists the same figures as odds
  (`perfect 25 … suitedTrips 100`); it is the capture's own header, not a LIQD
  source.

### 3.4 Insurance

Offered iff the up card is an Ace and the player has no natural (446 / 446
rounds, never otherwise). If taken, the insurance stake is `S / 2` (446 / 446:
0.05 on 0.1, 5 on 10) and returns **3 × insurance stake** (2:1) iff the dealer
has a natural, else 0 (exact 446 / 446; 145 paid, 301 lost). A declined offer
creates no insurance bet (API: `place-insurance-bet` `{"acceptInsurance":false}`
→ `"insuranceBet": null`, E18 nonce 9). PAGE: "INSURANCE PAYS 2 TO 1" (E12,
E18-insurance-offered), "Insurance? YES / NO" (E18-insurance-offered).

### 3.5 Round total

```
roundWin = Σ_hands  s × m(hand) × (2 if doubled else 1)
         + PerfectPairs return + 21+3 return + insurance return
```

DATA: equals the dataset's round `winningAmount` on **6,000 / 6,000** (field
is a binary float, e.g. `0.7999999999999999`; compared at |Δ| < 1e-9). Without
the doubled bet's return: 5,386 / 6,000.

### 3.6 Limits and edge figures (context, not used by the derivation)

API (E18 `currentGameSettings`, 13 Oct): `minBet 0.01`, `maxBetData main 2500,
perfectPairs 250, twentyOnePlusThree 250`. E23 (29 Jun) game settings for
`fast-games-11`: `houseEdge: 1`. PAGE: header "Edge: 0.48%" (E16, and page
1 Oct), stats panel "RTP (optimal play) 99.51%", "House Edge 0.49%",
structured-data RTP 99.52% (page 1 Oct). These are claims for profile check
BLACKJACK-19; none enters the derivation.

### 3.7 Fields an implementation must not read

`cards`, `dealerHand`, `points`, `dealerPoints`, `result`, `winningAmount`,
`gameResult`, side-bet `playerHand`, `split`, `doubled`, `localSequence`,
`verified`, `commitVerified`, `chainLinkOk` are claims (the operator's or the
capture script's), to be checked. The derivation reads only `serverSeed`,
`clientSeed`, `nonce`, `actions`, and the stakes (main, side, insurance).
Note: `dealerPoints` is **0** on 381 of the 526 rounds that end at the deal
(every case except a dealer natural revealed after the insurance step, where it
is 21) and the dealer total on the other 5,619.

---

## 4. Source per step (summary)

| Step | Source | Evidence |
|---|---|---|
| Inputs: server seed, client seed, nonce | PAGE + API | E13 seed panel; E18 rotate response |
| Commitment SHA-256 hex | STANDARD + PAGE | E13 hashed seed shown |
| Hash input = 32 ASCII chars | DATA | 120/120 (decoded 0/120); E18 1/1 |
| Forward chain | PAGE + DATA | E13 "Next Server Seed"; 119/119 + pre-capture |
| HMAC-SHA256, key = hex-decoded 16 bytes | STANDARD + DATA | 6,000/6,000 (ASCII key 0) |
| Message `clientSeed:nonce:i`, cursor = index 415…1 | STANDARD + DATA | 6,000/6,000 (cursor = step 0; `c:n-i` 0) |
| First 4 bytes u32 BE mod (i+1) | DATA | 6,000/6,000 (LE 0, float 0) |
| Rejection ≥ floor(2³²/r)·r | STANDARD | 0 rejections (0.057 expected); O1 |
| 8-deck shoe, deck-major C,H,S,D × A…K | PAGE + DATA | "eight-deck shoe"; 416/416 positions |
| Backward Fisher–Yates, deal from a[0] | STANDARD + DATA | 1 of 168 on 1,500; 6,000/6,000 |
| Deal P1, up, P2, hole | DATA | 6,000/6,000 |
| Insurance step iff Ace up and no player natural | PAGE + DATA | E18 prompt; 446/446 |
| Naturals end the round (dealer peek) | DATA | 526 rounds |
| Split: both second cards, then hand 2 first | DATA | 6,000/6,000 (hand 1 first 5,747) |
| Split once, any equal-value pair, split Aces one card | PAGE + DATA | "split once"; 401 rounds, 134 K-Q type, 70 ace hands |
| Two-card 21 after split is playable | DATA | 6,000 vs 5,989 |
| Double any two, DAS | PAGE + DATA | "double on any first two cards"; 1,448 hands, 165 DAS rounds |
| Dealer S17, draws even if all hands bust | PAGE + DATA | "standing on soft 17"; 108 soft-17 stands; 720 |
| Main 3:2, push, 1:1 | PAGE + DATA | felt / page; 6,401/6,401 |
| Side-bet categories and multiples | STANDARD + DATA | 5,800/5,800 each |
| Insurance S/2, 2:1 | PAGE + DATA | felt; 446/446 |
| Round total, double counted twice | DATA | 6,000/6,000 |

---

## 5. Test vectors (from the dataset)

Seed found by hashing. For each: the first three shuffle steps (cursor, full
digest, u32, `j = u32 mod (cursor+1)`), then every dealt card as
`k: a[k] → card`.

**V1: round `6hBu_VAq-lMp3UKjYMS1a`** (phase A, epoch 0, nonce 0; hit, dealer stands)
```
serverSeed  6dca5e36b6b9dc56730e282ab3c2bae6
commitment  948eff896b5521c1064402dcd5557342210e03e0c4e864d0b83418bfb5e12f42
clientSeed  audita6d2fe11bb1f   nonce 0   stake 0.1   PP 0.1   21+3 0.1   actions hit
cursor 415  d1b4e0facbbbc71d6214329ea062281a590b3cc14a2653707bb318a85e306d2f  u32 3518292218  j 90
cursor 414  2b43ce94c51668d09d8ee76b16ce1f94bd4a1bdebf4b95fc48ef2f7203418735  u32 725864084   j 34
cursor 413  438a8d5ac49ff072ff73294c7771991a4990645b2a7ed12fcf86a7f6f32b74fe  u32 1133153626  j 22
dealt  0:227 HEART:7 (P1)  1:269 CLUB:10 (up)  2:21 HEART:9 (P2)  3:231 HEART:11 (hole)  4:225 HEART:5 (hit)
player 7+9+5 = 21 (ends on 21), dealer 10+J = 20 → win, 2 × 0.1 = 0.2
PP NO_PAIR 0; 21+3 (7♥ 9♥ 10♣) NO_MATCH 0;  round winningAmount 0.2 (served 0.2)
```

**V2: round `FschhjKZOHdrZ6TrMT4So`** (phase A, epoch 2; insurance taken, dealer natural)
```
serverSeed  462b3034c052f3b381faf7a9df8786c2
commitment  9e7871e9e10b395a061d187faaab96c7d2f7516d3699b525fc956f513bfbbd73
clientSeed  audit9d3a9fbe9f01   nonce 19   stake 0.1   PP 0.1   21+3 0.1   insurance 0.05   actions no-ins
cursor 415  133dabd6ed708a2531331c6299ff619172de5121e95e8137fd1ff507f6a19112  u32 322808790   j 278
cursor 414  868b89e825ad5ac1d9ddab85175413d6411932015bc71e4f226df8e883b52e11  u32 2257291752  j 97
cursor 413  7220e113fe98735b6879af58111eaf3f855b2aa6f070146d92201d6ac449ee8e  u32 1914757395  j 357
dealt  0:154 DIAMOND:12  1:65 HEART:1 (up = A → insurance step)  2:200 DIAMOND:6  3:204 DIAMOND:10 (A+10 natural, round ends)
player Q+6 = 16 → lost 0;  insurance 0.05 × 3 = 0.15;  PP 0;  21+3 0
round winningAmount 0.15 (served 0.15)
```

**V3: round `1EzGtog3e8juqrTYtoKMY`** (phase A, epoch 3; split, hand 2 played first, all-bust hand still sees the dealer draw)
```
serverSeed  20c94c68c99bd6b63ebf71593745a8d5
commitment  a5dd969e1a8cb2e87dc84f2067cb042a9501a570b840ecb5636f84ffc562574a
clientSeed  audit8cfd067445ca   nonce 44   stake 0.1   PP 0.1   21+3 0.1   actions split, hit, hit, hit, stand
cursor 415  eb283fa7bf9f568d244747c8052d1ba81fbbe19455f17f9f651784af25e32db9  u32 3945283495  j 231
cursor 414  923fb028281f6123fd840041d7a126cf057569e84af5acd106fd12f7d6b95b9b  u32 2453647400  j 155
cursor 413  13ad42bca48c88e28153767013041ab387f89848c7c060a26841c33d82f9d3e1  u32 330121916   j 386
dealt  0:317 CLUB:6 (P1)  1:145 DIAMOND:3 (up)  2:122 HEART:6 (P2)  3:204 DIAMOND:10 (hole)
       4:144 DIAMOND:2 (hand 1 2nd)  5:314 CLUB:3 (hand 2 2nd)
       6:282 HEART:10 (hand 2 hit)  7:259 DIAMOND:13 (hand 2 hit → 29 bust)
       8:86 SPADE:9 (hand 1 hit → 17, stand)  9:132 SPADE:3  10:409 DIAMOND:7 (dealer 3+10+3+7 = 23 bust)
hand 1 6♣ 2♦ 9♠ = 17 → won 0.2;  hand 2 6♥ 3♣ 10♥ K♦ = 29 → lost 0
PP 6♣/6♥ MIXED_PAIR 0.7;  21+3 (6♣ 6♥ 3♦) NO_MATCH 0
round winningAmount 0.9 (served 0.8999999999999999)
```

**V4: round `m17ToldpDkrSIf3SSQbqF`** (phase E, epoch 107; stake 10, double, win)
```
serverSeed  b5a13d1d053850ca56be486dbae5311c
commitment  3ea4964c5bb6f44823863d8acc2269d904154f74a41e64d7e93db80d431bc2fc
clientSeed  audit2ec7bbca207a   nonce 6   stake 10   no side bets   actions double
cursor 415  306cf647f9b1dfe4dad79f1b362e5a51eb56b9027b0f05a64ba701fd86397df3  u32 812447303   j 135
cursor 414  052cc08e56eb8059c11dd351dd2d37df10db769618777f098682e56d3c9098d7  u32 86818958    j 128
cursor 413  fba3f60a5ef846ba66e5bd7fcab6aaa8a7e877f1eb3ed6842d060377f1134180  u32 4221826570  j 298
dealt  0:32 SPADE:7  1:315 CLUB:4  2:3 CLUB:4  3:308 DIAMOND:10  4:272 CLUB:13 (double card → 21)
       5:182 SPADE:1  6:236 SPADE:3 (dealer 4+10+A+3 = 18)
hand 21 vs 18 → won: hand record betAmount 10, winningAmount 20; double bet returns another 20
round winningAmount 40 (served 40)
```

**V5: round `eO6yqsNR--NU1fQLaBn65`** (phase D, player-set seed; player natural 3:2, 21+3 flush)
```
serverSeed  9e04ebf43f093011b6b8c9287e255ed1
commitment  a9f9c99c9115159a510ff3edb145b920ce365d89dcc64a5ea0e12ed96f47b43e
clientSeed  pfaudit-1785954682036-96   nonce 8   stake 0.1   PP 0.1   21+3 0.1   actions (none)
cursor 415  a9fd779dc7f3bfe902ec5f78365d21832cc305b10aadbd4dc78d34ba415f6175  u32 2851960733  j 349
cursor 414  083834f33f3566cd7862cd352b21c0dba8376b10be8e549f80d3c45baa23d996  u32 137901299   j 119
cursor 413  5d6c8e167f2991fb666ec8e1cb7319d5352d04951fe9139015209ed599c44801  u32 1567395350  j 44
dealt  0:13 HEART:1  1:331 HEART:7  2:387 HEART:11  3:393 SPADE:4   (player natural, round ends)
player A♥ J♥ natural vs 7+4 → 2.5 × 0.1 = 0.25;  PP NO_PAIR 0;  21+3 (A♥ J♥ 7♥) FLUSH 0.1 × 6 = 0.6
round winningAmount 0.85 (served 0.85; served dealerPoints 0, see 3.7)
```

---

## 6. Open points the public sources do not settle

- **O1: rejection.** 0 rejected first chunks in 2,490,000 shuffle draws
  (0.057 expected), so rejection vs plain `v mod (i+1)` is unwitnessed. Plain mod
  would bias draw `i` by up to `(i+1)/2^32` (≤ 9.7 × 10⁻⁸ at i = 415), above
  the profile BLACKJACK-08 floor of 2⁻³² for every non-power-of-two range;
  which form LIQD uses therefore matters for that check. All-8-chunks-rejected
  behaviour is unspecified. To settle: search revealed seeds for a nonce whose
  digest(i) first chunk is ≥ LIMIT at a position that changes the dealt cards,
  and compare LIQD's result; or LIQD's written rules.
- **O2: the insurance token.** All 446 insurance answers in the dataset carry
  the token `no-ins`, yet every one of those rounds has a funded insurance bet
  (0.05 / 5, settled 2:1). The token name is the capture's and contradicts the
  records; the spec therefore takes the insurance stake as an input (like the
  side stakes) and treats the token only as "the insurance step happened". A
  declined offer is witnessed once, in E18 (no insurance bet created).
- **O3: rules outside the capture.** Resplitting, splitting after another
  action, hitting split Aces, surrender and even money were never seen and no
  page mentions them; "split once" is on the page. Doubling on three or more
  cards was never seen.
- **O4: "Face-Down Double".** The page says the game offers a setting "that
  deals your double card face down so you turn it over yourself". No captured
  round records the setting; this spec assumes it changes the display only, not
  the draw order.
- **O5: edge figures.** The page shows 0.48 % (header), 0.49 % / 99.51 %
  (panel) and 99.52 % (structured data); E23 game settings say `houseEdge: 1`.
  None is used here; reconciling them is BLACKJACK-19's job.
- **O6: client-seed encoding beyond ASCII.** UTF-8 assumed; all captured seeds
  are ASCII.
- **O7: no written algorithm.** No LIQD page read states HMAC, the key form
  (ASCII for the commitment, decoded bytes for the key), the cursor, the shoe
  order or the shuffle. Live pages could not be re-read on 20 Oct: plain GET
  returned 403 (Cloudflare) and the headless browser failed to load (§8). The
  Verify tab was not opened.

---

## 7. Reproduction of this spec

Throwaway scripts in the session scratchpad (`liqd-blackjack-spec/`:
`explore.py`, `cand1.py`–`cand8.py`, `learn.py`, `replay.py`, `replay2.py`,
`replay3.py`, `settle_explore.py`, `total_explore.py`, `spec_check.py`,
`vectors.py`, `misc.py`), run 20 Oct 2026. `python3 -I spec_check.py`, verbatim
(98 s):

```
revealed seeds 121; distinct round commitments 120
commitment SHA256(ascii 32-char seed) resolves 120/120 commitments, 6000/6000 rounds
commitment SHA256(hex-decoded 16 bytes) resolves 0/120
forward chain next(i)==active(i+1): 119/119; preCapture.next==epoch0 active: True
RNG candidate [SPEC hex-decoded key, c:n:i, cursor=i, u32BE mod (i+1) w/ rejection, backward FY, deal from a[0]]: full-round card match 6000/6000
  rejection census for the spec (first chunk >= LIMIT): 0 of 2490000 draws
RNG candidate [same, plain v mod (i+1) (no rejection)]: full-round card match 6000/6000
RNG candidate [ascii key]: full-round card match 0/6000
RNG candidate [cursor = step t (0..414) instead of i]: full-round card match 0/6000
RNG candidate [u32 little-endian]: full-round card match 0/6000
RNG candidate [float (u32/2^32)*(i+1) floor]: full-round card match 0/6000
RNG candidate [message c:n-i]: full-round card match 0/6000
RNG candidate [forward FY (j=i+u mod (416-i)), deal from a[0]]: full-round card match 0/6000
rules [SPEC rules]: cards 6000/6000, actions consumed exactly 6000/6000
rules [split: hand 1 played first]: cards 5747/6000, actions consumed exactly 5747/6000
rules [split: second cards dealt lazily]: cards 5604/6000, actions consumed exactly 5604/6000
rules [two-card 21 after split auto-stands]: cards 5989/6000, actions consumed exactly 5975/6000
rules [dealer does not draw when all hands bust]: cards 5280/6000, actions consumed exactly 5280/6000
rules [dealer hits soft 17]: cards 5894/6000, actions consumed exactly 5894/6000
rules [split aces playable]: cards 5965/6000, actions consumed exactly 5965/6000
  ALT round winningAmount without the double bet return (|diff|<1e-9): 5386
  dealerPoints == dealer total (rounds played out): 5474
  dealerPoints on rounds ended at deal: == 0: 381
  dealerPoints on rounds ended at deal: == dealer total: 145
  hand points: 6401
  hand result label: 6401
  hand winningAmount exact: 6401
  hands: 6401
  insurance amount exact: 446
  insurance offered (up=A, no player natural): 446
  insurance record present iff offered: 6000
  insurance stake == main/2: 446
  perfectPair amount exact: 5800
  perfectPair bets: 5800
  perfectPair label: 5800
  perfectPair on split rounds: 395
  perfectPair on split rounds: label from hand-1 own two cards matches: 123
  perfectPair on split rounds: label from original P1,P2 matches: 395
  round winningAmount (|diff|<1e-9): 6000
  rounds played out: 5474
  twentyOnePlusThree amount exact: 5800
  twentyOnePlusThree bets: 5800
  twentyOnePlusThree label: 5800
  twentyOnePlusThree on split rounds: 395
  twentyOnePlusThree on split rounds: label from original P1,P2 matches: 395
  w:21+3 A-2-3 -> STRAIGHT: 12
  w:21+3 K-A-2 -> FLUSH: 1
  w:21+3 K-A-2 -> NO_MATCH: 12
  w:21+3 Q-K-A -> STRAIGHT: 13
  w:all hands bust, dealer still drew: 720
  w:bj: 243
  w:bust: 983
  w:bust doubled: 403
  w:dbj: 273
  w:dealer stood on soft 17: 108
  w:double after split (rounds): 165
  w:lose: 1226
  w:lose doubled: 407
  w:perfectPair COLORED_PAIR: 123
  w:perfectPair MIXED_PAIR: 234
  w:perfectPair NO_PAIR: 5343
  w:perfectPair PERFECT_PAIR: 100
  w:push: 422
  w:push doubled: 100
  w:round ended at deal (a natural): 526
  w:split of two different ten-value ranks: 134
  w:split rounds: 401
  w:split-ace hands (no action): 70
  w:twentyOnePlusThree FLUSH: 345
  w:twentyOnePlusThree NO_MATCH: 5242
  w:twentyOnePlusThree STRAIGHT: 166
  w:twentyOnePlusThree STRAIGHT_FLUSH: 14
  w:twentyOnePlusThree SUITED_THREE_OF_A_KIND: 1
  w:twentyOnePlusThree THREE_OF_A_KIND: 32
  w:two-card 21 after split paid 1:1: 27
  w:win: 1806
  w:win doubled: 538
elapsed 97.9s
expected first-chunk rejections over 6000 shuffles (415 draws each): 0.0569; observed for the spec: 0
E18 revealed seed hashes to the round's active hash: True
E18 rounds (nonce 0..9): player cards + dealer cards match 10/10
```

("bj 243" = unsplit naturals paid 3:2; "dbj 273" = dealer natural against a
non-natural hand; "push 422" includes the 10 natural-vs-natural pushes.)

---

## 8. Files and URLs opened while writing this spec

Opened: the task brief; the framework spec folder's `games/blackjack/ALGORITHM.md`
(Duel spec), `games/dice/ALGORITHM.md` (Duel spec), `games/liqd-mines/ALGORITHM.md`
(clean-room LIQD Mines spec, read for the shared seed construction, no casino
code); `games/blackjack/profile.json`; `repositories/liqd/blackjack/evidence/`
E12, E13, E14, E15, E16, `E18-insurance-offered-2026-10-13.png` (PNG),
`E18-insurance-decline-2026-10-13.json`, `E23-game-settings-2026-06-29.json`,
`rtp-page-labels-2026-10-01.json`; `repositories/liqd/blackjack/data/blackjack-6000hands.json`
(loaded by script). Directory listings (names only) of
the framework spec folder (`games/`), `games/blackjack/`, and the blackjack
package's `evidence/` and `data/`.

URLs (GET, logged out, 20 Oct 2026): `curl` of `https://liqd.com/originals/blackjack`,
`https://liqd.com/provably-fair`, `https://qa.liqd.com/originals/blackjack` →
all **403** (bodies not saved or read). Headless browser navigation to
`https://liqd.com/originals/blackjack` → `net::ERR_ABORTED`, then timeouts; no
content returned.

Not opened: any `src/`, `tests/`, `scripts/`, `capture/`, `outputs/`,
`verifier-parity/`, `verify.js`, `test.js`, `MANIFEST.md`, `README.md`,
`AUDIT_CONTEXT.md`, `workshop-notes/` of any LIQD package; anything named
`*verify-tab*`; any LIQD JS bundle; the auditor's other LIQD working folders; the older
`repositories/liqd-blackjack` and sibling copies; the browser tool's snapshot folder;
`evidence/E18-insurance-decline-2026-10-13.md`,
`evidence/E24-insurance-client-code-read-2026-10-02.md` and
`E18-insurance-declined-hand-settled-2026-10-13.png` (the two `.md` files are
outside the allowed "images and JSON" and E24's name says it reads client
code); `games/blackjack/RECIPE.md`, `CHANGES.md`, `status.json`, `tools/`.
The dataset's `localSequence` field (a capture-side card order) was not used
to derive or test anything.
