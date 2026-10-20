/**
 * Converts an RGS round state (a book from Bot 3's export, /workspace/kilo-math/phase2/out/books/)
 * into the SplashScript the existing director plays. Live play and Bet Replay both use this one
 * function, so they can't drift.
 *
 * Book line (export-books.mjs): {id, payoutMultiplier, events:[{index:0, type:"kiloRound", key, record}]}
 * where record is a complete SplashScript generated at record.stake (1000 script units) and the
 * book payoutMultiplier is in hundredths of the BASE amount. The RGS returns state = events and
 * payoutMultiplier as a float multiple.
 *
 * The script is never rescaled or edited. Script amounts are in script units; to show money,
 * multiply by `unitScale` (micro-units per script unit) and pass to formatAmount().
 */
import type { SplashMode, SplashScript } from "@/lib/kilo/engine";
import { winFor } from "./client.ts";

/** RGS mode names (index.json, social-safe) -> the engine's SplashMode. */
export const RGS_MODE_TO_SPLASH: Readonly<Record<string, SplashMode>> = {
  base: "spin",
  ante: "ante",
  dockside: "buy",
  yacht: "yacht",
  mystery: "mystery",
  getaway: "getaway",
};

export function splashModeFor(rgsMode: string): SplashMode | null {
  return RGS_MODE_TO_SPLASH[rgsMode.toLowerCase()] ?? null;
}

export class BookAdapterError extends Error {
  readonly reason: "no-round-event" | "bad-record" | "mode-mismatch" | "payout-mismatch";
  constructor(reason: BookAdapterError["reason"], detail?: string) {
    super(detail ? `${reason}: ${detail}` : reason);
    this.name = "BookAdapterError";
    this.reason = reason;
  }
}

export type AdaptedRound = {
  script: SplashScript;
  /** Micro-units per script unit: playerAmount / record.stake. */
  unitScale: number;
  /** What the server pays, in micro-units. This, not the animation, is the settled amount. */
  win: number;
  /** Book key from the export (e.g. the seed), for logs and replay IDs. */
  key: unknown;
};

type RoundEvent = { type?: unknown; record?: unknown; key?: unknown };

function findRoundEvent(state: unknown): RoundEvent | null {
  const list = Array.isArray(state)
    ? state
    : state && typeof state === "object" && Array.isArray((state as { events?: unknown }).events)
      ? (state as { events: unknown[] }).events
      : null;
  if (!list) return null;
  for (const e of list) {
    if (e && typeof e === "object" && (e as RoundEvent).type === "kiloRound") return e as RoundEvent;
  }
  return null;
}

function isScript(r: unknown): r is SplashScript {
  if (!r || typeof r !== "object") return false;
  const s = r as Partial<SplashScript> & { stake?: unknown; payout?: unknown; base?: unknown; free?: unknown };
  return (
    typeof s.mode === "string" &&
    typeof s.stake === "number" && s.stake > 0 &&
    typeof s.payout === "number" && Number.isFinite(s.payout) && s.payout >= 0 &&
    !!s.base && typeof s.base === "object" && Array.isArray((s.base as { grid?: unknown }).grid) &&
    Array.isArray(s.free)
  );
}

/**
 * @param state           round.state from /wallet/play, authenticate (resume) or /bet/replay
 * @param amount          base amount in micro-units (not multiplied by the mode cost)
 * @param payoutMultiplier float multiple of the base amount, from the RGS
 * @param rgsMode         optional RGS mode name, checked against the record's mode
 */
export function roundStateToScript(
  state: unknown,
  amount: number,
  payoutMultiplier: number,
  rgsMode?: string,
): AdaptedRound {
  const event = findRoundEvent(state);
  if (!event) throw new BookAdapterError("no-round-event");
  const record = event.record;
  if (!isScript(record)) throw new BookAdapterError("bad-record");
  if (rgsMode != null) {
    const expected = splashModeFor(rgsMode);
    if (!expected || expected !== record.mode) {
      throw new BookAdapterError("mode-mismatch", `${rgsMode} vs ${record.mode}`);
    }
  }
  // The animated total must equal what the server settles: payout / stake === payoutMultiplier.
  const animated = record.payout / record.stake;
  if (Math.abs(animated - payoutMultiplier) > 1e-9) {
    throw new BookAdapterError("payout-mismatch", `${animated} vs ${payoutMultiplier}`);
  }
  return {
    script: record,
    unitScale: amount / record.stake,
    win: winFor(amount, payoutMultiplier),
    key: event.key ?? null,
  };
}

/** Script units (e.g. a line amount of 200 at stake 1000) to micro-units for formatAmount(). */
export function scriptUnitsToMicro(units: number, unitScale: number): number {
  return Math.round(units * unitScale);
}

/**
 * The guard the adapter enforces: the animated final win equals the server's
 * payoutMultiplier × base amount (both in micro-units), within one micro-unit.
 */
export function winMatchesServer(animatedWin: number, amount: number, payoutMultiplier: number): boolean {
  return Math.abs(animatedWin - winFor(amount, payoutMultiplier)) <= 1;
}
