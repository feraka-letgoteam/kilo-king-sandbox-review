/**
 * Turns the authenticate config into what the controls need: bet levels, mode
 * costs and restriction flags. The front end must use these and never hardcode them.
 * Modes come from config.gameModes; names match case-insensitively and the server's spelling
 * is what /wallet/play gets. A mode the server didn't list is unavailable (fail closed).
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
  /** Lowercased mode name -> cost multiplier, from config.gameModes. */
  modeCost: Record<string, number>;
  /** Lowercased mode name -> highest base amount allowed in that mode, when the server sets one. */
  modeMaxBet: Record<string, number>;
  /** Lowercased mode name -> the server's spelling, to send as /wallet/play `mode`. */
  modeName: Record<string, string>;
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
  const modeName: Record<string, string> = {};
  for (const m of config.gameModes ?? []) {
    if (typeof m?.mode !== "string" || typeof m.costMultiplier !== "number" || !(m.costMultiplier > 0)) continue;
    const key = m.mode.trim().toLowerCase();
    if (!key || key in modeName) continue;
    modeName[key] = m.mode.trim();
    modeCost[key] = m.costMultiplier;
    if (typeof m.maxBet === "number" && m.maxBet > 0) modeMaxBet[key] = m.maxBet;
  }
  const jurisdiction = controlsFromJurisdiction(config.jurisdiction, launchSocial);
  return {
    betLevels,
    defaultBet,
    minBet: config.minBet,
    maxBet: config.maxBet,
    modeCost,
    modeMaxBet,
    modeName,
    controls: toControlJurisdiction(jurisdiction),
    jurisdiction,
    social: jurisdiction.social,
  };
}

export type ModeRule = {
  /** Server spelling, to send as /wallet/play `mode`. */
  mode: string;
  costMultiplier: number;
  maxBet: number;
};

/** The server's rule for a mode (any case), or null when the server didn't offer it. */
export function modeRule(rules: SessionRules, mode: string): ModeRule | null {
  const key = mode.trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(rules.modeName, key)) return null;
  return { mode: rules.modeName[key]!, costMultiplier: rules.modeCost[key]!, maxBet: rules.modeMaxBet[key] ?? rules.maxBet };
}

/** Our modes (e.g. index.json names) the server didn't list. The UI must not offer these. */
export function missingModes(rules: SessionRules, ours: readonly string[]): string[] {
  return ours.filter((m) => !modeRule(rules, m));
}

/** Base amounts the player can pick in a mode: within limits and affordable at its cost. Unknown mode: none. */
export function playableLevels(rules: SessionRules, mode: string, balance: number): number[] {
  const rule = modeRule(rules, mode);
  if (!rule) return [];
  return rules.betLevels.filter((n) => n <= rule.maxBet && Math.round(n * rule.costMultiplier) <= balance);
}
