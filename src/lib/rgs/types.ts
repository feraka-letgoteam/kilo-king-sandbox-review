/**
 * Stake Engine RGS wire types. Amounts are integer micro-units (1,000,000 = 1 unit).
 * Source: engineio/docs api/{authenticate,play,end-round,bet-replay} and the live /docs/rgs pages.
 * Presentation-free: nothing in src/lib/rgs imports game or scene code.
 */

export const MICRO = 1_000_000;

export type RgsBalance = { amount: number; currency: string };

export type RgsJurisdiction = {
  socialCasino?: boolean;
  disabledFullscreen?: boolean;
  disabledTurbo?: boolean;
  disabledSuperTurbo?: boolean;
  disabledAutoplay?: boolean;
  disabledSlamstop?: boolean;
  disabledSpacebar?: boolean;
  disabledBuyFeature?: boolean;
  displayNetPosition?: boolean;
  displayRTP?: boolean;
  displaySessionTimer?: boolean;
  /** Milliseconds. 0 or missing means no minimum. */
  minimumRoundDuration?: number;
};

export type RgsBetMode = { costMultiplier?: number; maxBet?: number; [key: string]: unknown };

export type RgsConfig = {
  gameID: string;
  minBet: number;
  maxBet: number;
  stepBet: number;
  defaultBetLevel: number;
  betLevels: number[];
  betModes: Record<string, RgsBetMode>;
  jurisdiction: RgsJurisdiction;
};

export type RgsRound = {
  /** Float multiple of the base amount, e.g. 2.5. */
  payoutMultiplier: number;
  costMultiplier: number;
  /** Game-specific book events from the math export. */
  state: unknown;
  /** Present on some responses; true while the round still needs end-round. */
  active?: boolean;
  mode?: string;
  amount?: number;
  [key: string]: unknown;
};

export type AuthenticateResponse = {
  balance: RgsBalance;
  round: RgsRound | null;
  config: RgsConfig;
  meta?: unknown;
};

export type PlayResponse = { balance: RgsBalance; round: RgsRound };
export type BalanceResponse = { balance: RgsBalance };
export type ReplayResponse = { payoutMultiplier: number; costMultiplier: number; state: unknown };

export type RgsErrorCode =
  | "ERR_IS" // invalid or expired session (401)
  | "ERR_IPB" // insufficient player balance
  | "ERR_VAL" // invalid request values
  | "ERR_GLE" // gambling limits exceeded
  | "ERR_ACT" // too many requests (429)
  | "ERR_PAUSED" // 423, play paused on the platform side
  | "NOT_FOUND" // replay data missing
  | "ERR_GEN" // anything else from the server
  | "ERR_NETWORK" // fetch failed or timed out
  | "ERR_BAD_RESPONSE"; // response did not match the documented shape
