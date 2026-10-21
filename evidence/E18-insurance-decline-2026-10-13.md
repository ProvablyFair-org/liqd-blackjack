# LIQD blackjack insurance decline, played on qa, 2026-10-13 14:03–14:07 UTC (E18)
Page: https://qa.liqd.com/originals/blackjack, Standard tab, bet 0.10 USDC per hand, QA account (logged in by the account holder).
Purpose: the server's answer to the request LIQD's own UI sends to decline insurance, `{acceptInsurance: false}` (E24), which the
5 August capture never sent (DL-17).

What was done:
1. The recorder `capture/console/insurance-decline-recorder.console.js` (SHA-256 `d7a2edd048c7c076681d4b7f8ebb47aad577431e29fa38769557f10782bf6161`)
   was run in the page. It was injected through the browser extension's JavaScript tool rather than pasted into DevTools: the same
   code with its header comments removed, version string `liqd-blackjack-insurance-decline-recorder 2026-10-05`. It records the page's
   own `fast-games/blackjack-game/*` and `fast-games/provably-fair/*` requests and LIQD's answers, no headers and no cookies, and drops
   credential-like keys. Its own calls: `GET provably-fair/active` at install and `POST provably-fair/rotate` at the end.
2. Hands were played with the page's own buttons (BET, then Stand) until the dealer showed an Ace: hand 10 (round
   `qnFa4tnTJlBS9mHY0o0T9`, nonce 9), dealer up-card A♥, player 4♠ Q♣.
3. Insurance was declined with a real mouse click on LIQD's own **NO** button. The recording shows the request
   `POST fast-games/blackjack-game/place-insurance-bet {"acceptInsurance":false}` (no `betAmount`) answered 200, the last click
   before it on the button "NO", and no key press. The hand was then finished with Stand.
4. The pair was rotated (`await __pfBjIns.reveal()`, a fresh random client seed) to reveal the server seed the hands were dealt from.
5. The two pictures were taken with the browser extension's screenshot tool, cropped to the game panel and table (no balance,
   no username).

Files:
- `E18-insurance-decline-2026-10-13.json`: the recording (19 requests, 10 hands, 1 insurance offer, 1 insurance request),
  SHA-256 `6e1e3865fde80520984116c5e2402a19532cf988309babf70d2964d6abf6821a`. One edit from the file as dumped: the account's
  `userId` value is replaced by `"redacted"` in its 17 occurrences (text substitution; every other byte as dumped).
- `E18-insurance-offered-2026-10-13.png` (SHA-256 `e0f5bf33…dba1`): the offer, "Insurance? YES / NO", dealer A♥ and a face-down card, player 4♠ Q♣ = 14.
- `E18-insurance-declined-hand-settled-2026-10-13.png` (SHA-256 `3ba7f828…2449`): the settled hand, dealer A♥ A♦ 2♦ 2♥ 3♣ = 19, player 14, lost.

Check (`node capture/check-insurance-decline.mjs evidence/E18-insurance-decline-2026-10-13.json`, checker SHA-256 `2824c479…2b6f` as run on 13 October 2026; on 19 October 2026 three failure messages and one self-test fixture were reworded, SHA-256 now `1fef5eca…3c11`, and the same command prints the same lines below):
```
recording: 19 requests, 10 hands, 1 insurance offers, 1 insurance requests (recorder liqd-blackjack-insurance-decline-recorder 2026-10-05, installed 2026-10-13T14:03:14.473Z)
offer: request 16 (blackjack-game/place-bet), hand qnFa4tnTJlBS9mHY0o0T9, dealer up-card AH (Ace), canBetInsured true
decline: request 17 POST /api/v1/fast-games/blackjack-game/place-insurance-bet body {"acceptInsurance":false} (no betAmount) -> status 200, no errors
button: "NO" (BUTTON) clicked 272 ms before the request
settled: request 18, nonce 9, you [4S QC] 14, dealer [AH AD 2D 2H 3C] 19, result lost, stake 0.10000000, credited 0
insurance on the settled hand: no insuranceBet record
decline response: hand qnFa4tnTJlBS9mHY0o0T9, insuranceBet none, canBetInsured undefined
seed: SHA-256(revealed) = hash read before the hands (d3428de9164e…) — commit OK
re-deal: (revealed seed, client seed auditff78d5b3c1fb, nonce 9) -> 4S AH QC AD 2D 2H 3C = the cards dealt
E18 READY — DECLINE WORKED — LIQD booked no insurance bet on the hand after its own decline button.
```
Both pictures match the recorded cards of requests 16 and 18.

Scope: one declined offer, on qa, on 13 October 2026. It shows what the server did with `{acceptInsurance: false}` on that hand;
it does not change the 446 insurance bets in the 5 August dataset, whose rounds carry insurance because the capture sent a different
request (DL-17). The dealer did not hold a natural on this hand (hole card A♦), so the decline's effect on a dealer-natural
settlement was not exercised.
