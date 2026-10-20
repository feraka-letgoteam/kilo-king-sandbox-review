/**
 * Turns the authenticate config into what the controls need: bet levels, mode
 * costs and restriction flags. The front end must use these and never hardcode them.
 * Read-only mapping; it changes no control behaviour until patch 4 wires it in.
 */
import type { ControlJurisdiction } from "@/components/slot-controls/tokens";
import type { RgsConfig, RgsJurisdiction } from "./types.ts";

export type SessionRules = {
  betLevels: number[];
  defaultBet: number;
  minBet: number;
  maxBet: number;
  /** Mode name -> cost multiplier, from config.betModes. */
  modeCost: Record<string, number>;
  /** Mode name -> highest base amount allowed in that mode, when the server sets one. */
  modeMaxBet: Record<string, number>;
  controls: ControlJurisdiction;
  extra: {
    disabledFullscreen: boolean;
    disabledSuperTurbo: boolean;
    disabledSlamstop: boolean;
    disabledSpacebar: boolean;
    displayNetPosition: boolean;
    displayRTP: boolean;
    displaySessionTimer: boolean;
    minimumRoundDurationMs: number;
    social: boolean;
  };
};

export function rulesFromConfig(config: RgsConfig, launchSocial = false): SessionRules {
  const levels = config.betLevels.filter((n) => n >= config.minBet && n <= config.maxBet);
  const betLevels = levels.length ? levels : config.betLevels;
  const defaultBet = betLevels.includes(config.defaultBetLevel) ? config.defaultBetLevel : betLevels[0]!;
  const modeCost: Record<string, number> = {};
  const modeMaxBet: Record<string, number> = {};
  for (const [name, m] of Object.entries(config.betModes)) {
    if (typeof m?.costMultiplier === "number" && m.costMultiplier > 0) modeCost[name] = m.costMultiplier;
    if (typeof m?.maxBet === "number" && m.maxBet > 0) modeMaxBet[name] = m.maxBet;
  }
  const j: RgsJurisdiction = config.jurisdiction ?? {};
  return {
    betLevels,
    defaultBet,
    minBet: config.minBet,
    maxBet: config.maxBet,
    modeCost,
    modeMaxBet,
    controls: {
      disabledTurbo: !!j.disabledTurbo,
      disabledAutoplay: !!j.disabledAutoplay,
      disabledBuyFeature: !!j.disabledBuyFeature,
    },
    extra: {
      disabledFullscreen: !!j.disabledFullscreen,
      disabledSuperTurbo: !!j.disabledSuperTurbo,
      disabledSlamstop: !!j.disabledSlamstop,
      disabledSpacebar: !!j.disabledSpacebar,
      displayNetPosition: !!j.displayNetPosition,
      displayRTP: !!j.displayRTP,
      displaySessionTimer: !!j.displaySessionTimer,
      minimumRoundDurationMs: Math.max(0, Number(j.minimumRoundDuration) || 0),
      social: launchSocial || !!j.socialCasino,
    },
  };
}

/** Base amounts the player can pick in a mode: within limits and affordable at its cost. */
export function playableLevels(rules: SessionRules, mode: string, balance: number): number[] {
  const cost = rules.modeCost[mode] ?? 1;
  const cap = rules.modeMaxBet[mode] ?? rules.maxBet;
  return rules.betLevels.filter((n) => n <= cap && Math.round(n * cost) <= balance);
}
