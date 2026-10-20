import {
  splashCost,
  splashStakeOk,
  SPLASH_COST_MAX,
  type SplashMode,
} from "@/lib/kilo/engine";
import { t } from "@/lib/kilo/copy";

export const STAKES = [100, 500, 1000, 2500, 10000] as const;
export type SpinSpeed = "normal" | "turbo" | "super";
export type MotionPreference = "system" | "reduce" | "full";
export type GamePreferences = { speed: SpinSpeed; motion: MotionPreference };
export const DEFAULT_PREFERENCES: GamePreferences = {
  speed: "normal",
  motion: "system",
};
const KEY = "kilo-presentation-v2";

export function parsePreferences(value: unknown): GamePreferences {
  const p =
    value && typeof value === "object"
      ? (value as Partial<GamePreferences>)
      : {};
  return {
    speed: p.speed === "turbo" || p.speed === "super" ? p.speed : "normal",
    motion: p.motion === "reduce" || p.motion === "full" ? p.motion : "system",
  };
}
export function readPreferences(): GamePreferences {
  try {
    return parsePreferences(JSON.parse(localStorage.getItem(KEY) || "null"));
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}
export function savePreferences(p: GamePreferences) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* Session still works. */
  }
}
export function resolveMotion(preference: MotionPreference, system: boolean) {
  return preference === "system" ? system : preference === "reduce";
}
export const SPIN_TIMING = {
  normal: {
    travel: 18,
    duration: 700,
    stagger: 160,
    delay: 36,
    anticipation: true,
    hold: 1,
  },
  turbo: {
    travel: 12,
    duration: 340,
    stagger: 50,
    delay: 16,
    anticipation: true,
    hold: 0.4,
  },
  super: {
    travel: 8,
    duration: 170,
    stagger: 20,
    delay: 5,
    anticipation: false,
    hold: 0.22,
  },
} as const;

export function purchaseQuote(
  stake: number,
  mode: SplashMode,
  balance: number,
) {
  const cost = splashCost(stake, mode);
  const reason = mode === 'chopper' ? t('quote.notAvailable') : !splashStakeOk(stake, mode)
    ? cost > SPLASH_COST_MAX
      ? t("quote.aboveLimit")(SPLASH_COST_MAX.toLocaleString("en-US"))
      : t("quote.outsideLimits")
    : cost > balance
      ? "Insufficient balance"
      : null;
  return { cost, reason, allowed: reason == null };
}
