import type { Bet, Seed, StepResult, InfoItem, Dataset } from '../../src/types';

export type { StepResult, InfoItem };

export interface VerifyContext {
  bets: Bet[];
  seeds: Seed[];
  /** Dataset metadata (declared phases, stakes, decks) — for label/stake parity steps. */
  meta: Dataset['meta'];
  /** hashedServerSeed → revealed serverSeed (revealed epochs only). */
  seedMap: Map<string, string>;
  /** hashedServerSeed → the epoch's Seed record. */
  seedByHash: Map<string, Seed>;
  /** hashedServerSeed → bets in that epoch. */
  byHash: Map<string, Bet[]>;
  phaseA: Bet[]; // 3,300 basic
  phaseB: Bet[]; // 1,000 aggressive
  phaseC: Bet[]; //   500 split-force
  phaseD: Bet[]; //   500 custom client seeds
  phaseE: Bet[]; //   200 stake-invariance, no side bets
  phaseF: Bet[]; //   500 split-force
  outputsDir: string;
}

export function step(
  num: number,
  name: string,
  status: 'PASS' | 'FLAG' | 'FAIL' | 'INFO',
  detail: string,
  origin?: 'capture' | 'operator',
): StepResult {
  const tag = status === 'PASS' ? '[PASS]' : status === 'INFO' ? '[INFO]' : status === 'FLAG' ? (origin === 'capture' ? '[FLAG:capture]' : '[FLAG]') : '[FAIL]';
  console.log(`  ${tag} Step ${num} — ${name}`);
  if (status !== 'PASS') console.log(`         ${detail}`);
  return origin && status === 'FLAG' ? { step: num, name, status, detail, origin } : { step: num, name, status, detail };
}
