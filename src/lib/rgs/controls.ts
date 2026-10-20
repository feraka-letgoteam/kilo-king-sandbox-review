/**
 * Typed jurisdiction controls from /wallet/authenticate config.jurisdiction, plus the pure
 * helpers a later wiring patch calls. Every documented flag lands here as a named field;
 * nothing is left in an untyped bag. Pure: no DOM, no timers, no game imports.
 *
 * Flags per Stake Engine docs (engineio/docs src/routes/docs/example/api/+page.svx and
 * docs/api/authenticate): socialCasino, disabledFullscreen, disabledTurbo, disabledSuperTurbo,
 * disabledAutoplay, disabledSlamstop, disabledSpacebar, disabledBuyFeature, displayNetPosition,
 * displayRTP, displaySessionTimer, minimumRoundDuration (integer milliseconds, 0 = none).
 */
import type { ControlJurisdiction } from "@/components/slot-controls/tokens";
import type { RgsJurisdiction } from "./types.ts";

export type JurisdictionControls = {
  /** stake.us social mode: launch `social=true` or jurisdiction.socialCasino. */
  social: boolean;
  disabledTurbo: boolean;
  disabledSuperTurbo: boolean;
  disabledAutoplay: boolean;
  disabledSlamstop: boolean;
  disabledSpacebar: boolean;
  disabledBuyFeature: boolean;
  disabledFullscreen: boolean;
  displayNetPosition: boolean;
  displayRTP: boolean;
  displaySessionTimer: boolean;
  /** Whole milliseconds, never negative. 0 means no minimum. */
  minimumRoundDurationMs: number;
};

/** Most restrictive defaults are NOT assumed: Stake sends every flag; missing means off / 0. */
export function controlsFromJurisdiction(j: RgsJurisdiction | null | undefined, launchSocial = false): JurisdictionControls {
  const v: RgsJurisdiction = j && typeof j === "object" ? j : {};
  const ms = Number(v.minimumRoundDuration);
  return {
    social: launchSocial || v.socialCasino === true,
    disabledTurbo: v.disabledTurbo === true,
    disabledSuperTurbo: v.disabledSuperTurbo === true,
    disabledAutoplay: v.disabledAutoplay === true,
    disabledSlamstop: v.disabledSlamstop === true,
    disabledSpacebar: v.disabledSpacebar === true,
    disabledBuyFeature: v.disabledBuyFeature === true,
    disabledFullscreen: v.disabledFullscreen === true,
    displayNetPosition: v.displayNetPosition === true,
    displayRTP: v.displayRTP === true,
    displaySessionTimer: v.displaySessionTimer === true,
    minimumRoundDurationMs: Number.isFinite(ms) && ms > 0 ? Math.ceil(ms) : 0,
  };
}

/**
 * Every Stake flag, in the control bar's ControlJurisdiction (slot-controls/tokens). controlAvailability()
 * still reads only turbo/autoplay/buy; the rest ride along for the wiring patches (Builder 4: control flags,
 * Builder 2: display flags). `social` is not a control flag and stays on SessionRules.
 */
export function toControlJurisdiction(c: JurisdictionControls): ControlJurisdiction {
  return {
    disabledTurbo: c.disabledTurbo,
    disabledAutoplay: c.disabledAutoplay,
    disabledBuyFeature: c.disabledBuyFeature,
    disabledSuperTurbo: c.disabledSuperTurbo,
    disabledSlamstop: c.disabledSlamstop,
    disabledSpacebar: c.disabledSpacebar,
    disabledFullscreen: c.disabledFullscreen,
    minimumRoundDurationMs: c.minimumRoundDurationMs,
    displayRTP: c.displayRTP,
    displayNetPosition: c.displayNetPosition,
    displaySessionTimer: c.displaySessionTimer,
  };
}

/** Space (and any other keyboard spin shortcut) may start a spin. */
export const spinShortcutAllowed = (c: JurisdictionControls): boolean => !c.disabledSpacebar;
/** Tap/click/Space during reels may skip or stop the animation early. */
export const slamStopAllowed = (c: JurisdictionControls): boolean => !c.disabledSlamstop;
export const turboAllowed = (c: JurisdictionControls): boolean => !c.disabledTurbo;
/** Super turbo also needs turbo: a jurisdiction that bans turbo bans the faster tier too. */
export const superTurboAllowed = (c: JurisdictionControls): boolean => !c.disabledSuperTurbo && !c.disabledTurbo;
export const autoplayAllowed = (c: JurisdictionControls): boolean => !c.disabledAutoplay;
export const buyFeatureAllowed = (c: JurisdictionControls): boolean => !c.disabledBuyFeature;
export const fullscreenAllowed = (c: JurisdictionControls): boolean => !c.disabledFullscreen;

export function roundMinDurationMs(c: JurisdictionControls): number {
  return c.minimumRoundDurationMs;
}

/**
 * How long to wait before the round may finish (result settles / next spin unlocks), given when
 * it started. A clock that runs backwards counts as no time elapsed, so the minimum is never cut short.
 */
export function remainingRoundDelayMs(startedAt: number, now: number, c: JurisdictionControls): number {
  const min = roundMinDurationMs(c);
  if (min <= 0) return 0;
  const elapsed = Number.isFinite(now - startedAt) ? Math.max(0, now - startedAt) : 0;
  return Math.max(0, Math.ceil(min - elapsed));
}

export type SessionDisplay = { netPosition: boolean; rtp: boolean; sessionTimer: boolean };

/** Which session readouts the HUD must show. */
export function sessionDisplay(c: JurisdictionControls): SessionDisplay {
  return { netPosition: c.displayNetPosition, rtp: c.displayRTP, sessionTimer: c.displaySessionTimer };
}

/**
 * Net win/loss for the session in micro-units: current balance minus the balance at authenticate.
 * Format with formatAmount(..., { signed: true }); a positive value is a session gain.
 */
export function netPosition(sessionStartBalance: number, balance: number): number {
  if (!Number.isSafeInteger(sessionStartBalance) || !Number.isSafeInteger(balance)) {
    throw new RangeError("balances must be integer micro-units");
  }
  return balance - sessionStartBalance;
}

/** Session timer text: "m:ss" under an hour, "h:mm:ss" from one hour. Negative/invalid -> "0:00". */
export function formatSessionTime(elapsedMs: number): string {
  const total = Number.isFinite(elapsedMs) && elapsedMs > 0 ? Math.floor(elapsedMs / 1000) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
