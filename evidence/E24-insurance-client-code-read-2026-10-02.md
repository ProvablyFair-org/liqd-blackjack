# LIQD blackjack insurance — client code read, 2026-10-02 ~11:20 UTC
Page: https://qa.liqd.com/originals/blackjack (the auditor's logged-in Chrome, read-only; no bet placed).
Method: fetched the page's own loaded JS bundles in the tab and searched them.

Findings (minified code, tokens as printed by the extraction):
1. Endpoint: createAsyncThunk "blackjack-game/place-insurance" -> POST "fast-games/blackjack-game/place-insurance-bet" (only insurance endpoint found; searched place-insurance, placeInsurance, declineInsurance|decline-insurance|noInsurance|skipInsurance).
2. Keyboard actions declared by the game: "Accept insurance" -> acceptInsurance, "Reject insurance" -> rejectInsurance.
3. The handler that dispatches it:
   tK = useCallback(async t => { let a = await e( placeInsuranceBlackjackGame({ payload: { data: { acceptInsurance: t } } }) ) ...
   i.e. the UI sends a BOOLEAN acceptInsurance (true = accept, false = reject). It sends no betAmount.

Implication: the capture's decline request place-insurance-bet {betAmount: 0} (logged "no-ins") is not the request LIQD's UI sends. On all 446 offers in data/blackjack-6000hands.json the server booked a 0.05 insurance bet (checked 2026-10-02: 446 "no-ins" rounds, all 446 carry an "insurance" side record: betAmount 0.05 on 433 and 5.00 on 13 (half the stake each time)).
NOT verified: the server's response to {acceptInsurance: false} — needs one played hand with Reject (the auditor).
