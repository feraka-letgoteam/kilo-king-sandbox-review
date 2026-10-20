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

/**
 * One entry of authenticate config.gameModes (live docs, stake-engine.com/docs/rgs/wallet, per Bot 3).
 * `mode` is the server's spelling (docs show "BASE"); send /wallet/play `mode` exactly as given here.
 */
export type RgsGameMode = { mode: string; costMultiplier: number; maxBet?: number };
/** Legacy map shape (engineio/docs repo, March 2026: `betModes: {}`). Read only as a fallback. */
export type RgsBetMode = { costMultiplier?: number; maxBet?: number; [key: string]: unknown };

export type RgsConfig = {
  gameID: string;
  minBet: number;
  maxBet: number;
  stepBet: number;
  defaultBetLevel: number;
  betLevels: number[];
  /** Server bet modes and costs. checkConfig() also folds a legacy `betModes` map in here. */
  gameModes: RgsGameMode[];
  jurisdiction: RgsJurisdiction;
};

/**
 * /wallet/play round. Authenticate returns the same shape, only while a round is unfinished
 * (resume, then /wallet/end-round). `amount` is the base bet; the debit was amount × costMultiplier.
 */
export type RgsRound = {
  betID?: number | string;
  /** Win in micro-units, when the server sends it. */
  payout?: number;
  /** Last /bet/event value saved for this round (resume point). */
  event?: string;
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
  /** null when the response has no round (nothing to resume). */
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
