// Types mirror the exact capture schema in data/blackjack-6000hands.json
// (liqd-blackjack-capture-v1). Field names match the dataset verbatim.
//
// CAPTURE-WRITTEN FIELDS THAT SCORED STEPS READ. Most of a round is
// copied from LIQD's response, but some fields were written by the capture script itself. Each is
// marked `CAPTURE-WRITTEN` below with what it is and why reading it is acceptable. The four fields
// that are the script's own RECOMPUTATION of the game (localSequence, verified, commitVerified,
// chainLinkOk) are a different class: loader.ts deletes them before any step runs.

export interface Seed {
  epoch: number;
  phase: string; // A | B | C | D | E | F
  at: string;
  clientSeed: string;
  hashedServerSeed: string; // SHA-256(utf8(serverSeed)) commitment
  nextHashedServerSeed: string; // pre-commitment for the next epoch (chain link)
  serverSeed: string | null; // revealed on rotation
  nonceStart: number;
  nonceEnd: number | null;
  // Capture-side flags. Present in the committed dataset; DELETED by loader.ts on load, so
  // they are never present on a Seed a scored step can see (see CAPTURE_SIDE_FIELDS).
  commitVerified?: boolean | null;
  chainLinkOk?: boolean | null;
}

export interface HandRecord {
  cards: string[]; // "SUIT:rank"
  points: number;
  result: string; // won | lost | push | pending
  winningAmount: number | string;
  betAmount: number | string;
  betType?: string;
}

export interface SideBet {
  winningAmount?: number | string;
  amount?: number | string;
  betAmount?: number | string;
  [k: string]: unknown;
}

/**
 * The two side bets a round can declare as funded. Both `sideFunded` and `sideReturned` carry
 * this shape; insurance is NOT among them (it is offered mid-round, never pre-funded).
 */
export interface SideDeclaration {
  perfectPair: boolean;
  twentyOnePlusThree: boolean;
}

export interface Bet {
  at: string;
  epoch: number;
  phase: string; // A | B | C | D | E | F
  id?: string;
  /**
   * LIQD's round nonce — except on the 145 rounds recorded from the partial insurance response (an
   * Ace-up dealer natural found at the peek; they carry no `serverSeedId`), where that response omits
   * it and the capture script wrote its own count, epoch start + hand index. CAPTURE-WRITTEN on those
   * 145. Acceptable because every nonce, fallback or not, must reproduce the round's recorded cards
   * from the revealed seed (Step 6), and Step 4 closes each epoch's window 0…49 against the seed record.
   */
  nonce: number;
  /**
   * CAPTURE-WRITTEN: the epoch's client seed, stamped onto each round by the capture script after the
   * reveal (not returned per round by LIQD). Acceptable because Step 3 requires it to equal the seed
   * record's client seed and Step 6 recomputes every round's cards with it.
   */
  clientSeed?: string;
  /**
   * Opaque operator-side identifier for the epoch's server-seed record — one distinct value per
   * epoch across all 120. OPTIONAL because the property is genuinely ABSENT on 145 of the 6,000
   * rounds (not null, not empty): exactly the insurance-winning rounds. The cause: those rounds were
   * recorded from the partial insurance response. On an Ace-up dealer natural the round settles at
   * the peek, in the response to the capture's insurance request; get-unfinished-bet then returns no
   * round, so the rig recorded the partial response, which carries neither serverSeedId nor nonce
   * (capture/capture-liqd-blackjack.aug05-rig.mjs, playHand and recordBet). No step reads its value;
   * Step 4 counts its absence to report how many nonces are the capture's own count. The seed↔bet
   * join is on `hashedServerSeed`.
   */
  serverSeedId?: string;
  /**
   * CAPTURE-WRITTEN: the commitment the capture script was tracking for the epoch when it played the
   * round (from the active/rotate responses), stamped onto each round — not a per-round value LIQD
   * returned. Acceptable because Step 3 requires every round of an epoch to carry the one commitment
   * of that epoch's seed record, and the revealed seed must hash to it (Step 1) and reproduce the
   * round's cards (Step 6).
   */
  hashedServerSeed: string;
  playerHands: HandRecord[]; // 1 hand, or 2 for a split
  /** FULL dealer hand as revealed at settlement, hole card included (a settled-bet record). */
  dealerHand: string[];
  dealerPoints: number;
  /**
   * CAPTURE-WRITTEN summaries: split = the script recorded two hands; doubled = a double-bet record
   * (mainDoubleBet / splitDoubleBet) was present in the response. Acceptable because no rule is read
   * from them: Step 12 derives DAS from the action tokens and requires these booleans to agree, and
   * Step 6's grammar (G6) binds `doubled` to the `double` tokens.
   */
  split: boolean;
  doubled: boolean;
  /**
   * CAPTURE-WRITTEN: the requests the capture script sent, in order (e.g. ['no-ins','hit','stand'] or
   * ['split','double','double']); `no-ins` is its insurance request place-insurance-bet {betAmount: 0},
   * which the casino booked as a funded bet on every offer (MANIFEST DL-17). Acceptable because the
   * tokens are bound to the dealt cards: hit + double tokens must equal the cards drawn beyond each
   * hand's first two (Step 6), and the grammar G1–G6 must hold.
   */
  actions: string[];
  sideBets: { perfectPair: SideBet | null; twentyOnePlusThree: SideBet | null; insurance: SideBet | null };
  /**
   * What the capture rig's own REQUEST funded for this round — auditor-recorded, not operator
   * -supplied. Present on all 6,000 rounds: 5,800 fund both, 200 fund neither (phase E, declared
   * `side: false`), none funds only one. Being independent of the side-bet records themselves is
   * exactly why Steps 15, 16 and 29 use it as their coverage denominator: a shrunken set of
   * records contradicts it rather than quietly shrinking the denominator with itself. It is a
   * funding DECLARATION, not wallet evidence — the capture carries no balance field at all (DL-4).
   *
   * Typed here rather than reached through an inline `as unknown as { sideFunded?: ... }` cast:
   * a field load-bearing enough to set a scored step's denominator must be in the schema, not
   * smuggled past it.
   */
  sideFunded: SideDeclaration;
  /**
   * The rig's record that each funded side bet came back PRESENT in the settle response
   * (`assertSideBetsHonoured`). It exists because the API has accepted the singular request
   * field name while silently dropping the bet. Identical to
   * `sideFunded` on all 6,000 rounds of this capture. Read by no check; kept for provenance.
   */
  sideReturned: SideDeclaration;
  /**
   * CAPTURE-WRITTEN: the round total is the capture script's own sum of the casino's credit records
   * (hands, side bets, insurance, and the double-bet records it did not store). Acceptable for what
   * Step 8b claims and no more: on the 1,283 doubled rounds it shows each double bet was credited like
   * its hand; it cannot detect a skim by the casino. Each hand's own credit is reconstructed from the
   * cards in Step 8.
   */
  winningAmount: number;
  // Capture-side self-verification. Present in the committed dataset; DELETED by loader.ts on
  // load, so they are never present on a Bet a scored step can see (see CAPTURE_SIDE_FIELDS).
  localSequence?: string[] | null;
  verified?: boolean | null;
}

export interface Dataset {
  meta: {
    audit: string;
    platform: string;
    gameId: string;
    schema: string;
    houseEdge: number;
    currency: string;
    decks: number;
    epochSize: number;
    plannedTotal: number;
    payout: Record<string, unknown>;
    phases: Record<string, { hands: number; amount: number; strategy?: string; side?: boolean; customSeeds?: boolean }>;
    startedAt: string | null;
    finishedAt: string | null;
    progress?: Record<string, unknown>;
    preCapture?: Record<string, unknown> | null;
  };
  seeds: Seed[];
  bets: Bet[];
}

export type Severity = 'HARD_FAIL' | 'FLAG' | 'INFO' | 'PASS';
export interface StepResult {
  step: number;
  name: string;
  /**
   * INFO: an informational deviation (profile policy INFORMATIONAL — the live-sample fit,
   * decided 2026-09-29): reported, never counted as a flag, never affects the verdict.
   */
  status: 'PASS' | 'FLAG' | 'FAIL' | 'INFO' | 'OVERSTATED';
  detail: string;
  /**
   * Who a FLAG is attributed to. `capture` = an auditor-side capture artefact (a declared retry
   * gap): disclosed on every run, verdict-neutral. Absent or `operator` = verdict-affecting.
   * Policy decided 2026-09-17 (Framework 1.0, FLAG origin).
   */
  origin?: 'capture' | 'operator';
}
export interface InfoItem {
  label: string;
  detail: string;
}
