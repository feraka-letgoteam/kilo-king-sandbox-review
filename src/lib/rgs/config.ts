/**
 * Turns the authenticate config into what the controls need: bet levels, mode
 * costs and restriction flags. The front end must use these and never hardcode them.
 * Read-only mapping; it changes no control behaviour until a later wiring patch calls controls.ts.
 */
import type { ControlJurisdiction } from "@/components/slot-controls/tokens";
import type { RgsConfig } from "./types.ts";
import { controlsFromJurisdiction, toControlJurisdiction, type JurisdictionControls } from "./controls.ts";

export type SessionRules = {
  betLevels: number[];
  defaultBet: number;
  minBet: number;
  maxBet: number;
  /** Mode name -> cost multiplier, from config.betModes. */
  modeCost: Record<string, number>;
  /** Mode name -> highest base amount allowed in that mode, when the server sets one. */
  modeMaxBet: Record<string, number>;
  /** Existing control-bar subset (turbo, autoplay, buy feature), for controlState(). */
  controls: ControlJurisdiction;
  /** Every jurisdiction flag, typed. Use the helpers in controls.ts to act on them. */
  jurisdiction: JurisdictionControls;
  social: boolean;
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
  const jurisdiction = controlsFromJurisdiction(config.jurisdiction, launchSocial);
  return {
    betLevels,
    defaultBet,
    minBet: config.minBet,
    maxBet: config.maxBet,
    modeCost,
    modeMaxBet,
    controls: toControlJurisdiction(jurisdiction),
    jurisdiction,
    social: jurisdiction.social,
  };
}

/** Base amounts the player can pick in a mode: within limits and affordable at its cost. */
export function playableLevels(rules: SessionRules, mode: string, balance: number): number[] {
  const cost = rules.modeCost[mode] ?? 1;
  const cap = rules.modeMaxBet[mode] ?? rules.maxBet;
  return rules.betLevels.filter((n) => n <= cap && Math.round(n * cost) <= balance);
}
