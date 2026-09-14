// Types mirror the exact capture schema in data/blackjack-6000hands.json
// (liqd-blackjack-capture-v1). Field names match the dataset verbatim.

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
  nonce: number;
  clientSeed?: string; // filled in by verify from the epoch seed
  /**
   * Opaque operator-side identifier for the epoch's server-seed record — one distinct value per
   * epoch across all 120. OPTIONAL because the property is genuinely ABSENT on 145 of the 6,000
   * rounds (not null, not empty): exactly the insurance-winning rounds. Measured; the cause is
   * not established here and is not guessed at. Nothing in the audit reads it — the seed↔bet
   * join is on `hashedServerSeed`.
   */
  serverSeedId?: string;
  hashedServerSeed: string;
  playerHands: HandRecord[]; // 1 hand, or 2 for a split
  /** FULL dealer hand as revealed at settlement, hole card included (a settled-bet record). */
  dealerHand: string[];
  dealerPoints: number;
  split: boolean;
  doubled: boolean;
  actions: string[]; // e.g. ['no-ins','hit','stand'] or ['split','double','double']
  sideBets: { perfectPair: SideBet | null; twentyOnePlusThree: SideBet | null; insurance: SideBet | null };
  /**
   * What the capture rig's own REQUEST funded for this round — auditor-recorded, not operator
   * -supplied. Present on all 6,000 rounds: 5,800 fund both, 200 fund neither (phase E, declared
   * `side: false`), none funds only one. Being independent of the side-bet records themselves is
   * exactly why Steps 15, 16 and 29 use it as their coverage denominator: a shrunken set of
   * records contradicts it rather than quietly shrinking the denominator with itself. It is a
   * funding DECLARATION, not wallet evidence — the capture carries no balance field at all (L4).
   *
   * Typed here (round-4 QA-08) because the consumers used to reach it through an inline
   * `as unknown as { sideFunded?: ... }` cast — a field load-bearing enough to set a scored
   * step's denominator must be in the schema, not smuggled past it.
   */
  sideFunded: SideDeclaration;
  /**
   * The rig's record that each funded side bet came back PRESENT in the settle response
   * (`assertSideBetsHonoured`). It exists because an earlier capture sent the singular request
   * field name, which the API accepted while silently dropping the bet. Identical to
   * `sideFunded` on all 6,000 rounds of this capture. Read by no check; kept for provenance.
   */
  sideReturned: SideDeclaration;
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
  status: 'PASS' | 'FLAG' | 'FAIL';
  detail: string;
}
export interface InfoItem {
  label: string;
  detail: string;
}
