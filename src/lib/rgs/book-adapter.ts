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
 * The script's amounts are never rescaled or edited; only `mode` is mapped to the engine name
 * (dockside -> buy, base -> spin) and Mystery gets `mystery.selected` from `landed`, on a shallow copy. Script amounts are in script units; to show money,
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
  const key = rgsMode.toLowerCase();
  return Object.prototype.hasOwnProperty.call(RGS_MODE_TO_SPLASH, key) ? RGS_MODE_TO_SPLASH[key]! : null;
}

/**
 * record.mode values accepted for each RGS mode. New books (Bot 3, Oct 20) write the RGS name
 * (base, dockside, mystery ...); current books still write the engine name (spin, buy). Mystery
 * accepts only "mystery": a Mystery round labelled with the landed feature's mode is rejected.
 */
export const RECORD_MODES_FOR_RGS: Readonly<Record<string, readonly string[]>> = {
  base: ["base", "spin"],
  ante: ["ante"],
  dockside: ["dockside", "buy"],
  yacht: ["yacht"],
  mystery: ["mystery"],
  getaway: ["getaway"],
};

const ENGINE_MODES: ReadonlySet<string> = new Set(["spin", "ante", "buy", "yacht", "getaway", "mystery"]);

/** A record.mode (new RGS name or legacy engine name) -> the engine's SplashMode, or null. */
export function engineModeForRecord(recordMode: string): SplashMode | null {
  return splashModeFor(recordMode) ?? (ENGINE_MODES.has(recordMode) ? (recordMode as SplashMode) : null);
}

type MysteryInfo = NonNullable<SplashScript["mystery"]>;
/** New Mystery books: landed = the RGS mode of the feature it landed on. */
const LANDED_TO_SELECTED: Readonly<Record<string, MysteryInfo["selected"]>> = { dockside: "dock", yacht: "yacht" };
/** Which landed value each engine selection is consistent with (yacht25 is the Super Yacht variant). */
const SELECTED_FAMILY: Readonly<Record<string, string>> = { dock: "dockside", yacht: "yacht", yacht25: "yacht" };

/**
 * The engine shows a Mystery round from script.mystery.selected. New books carry landed instead,
 * so build it from that; keep an existing mystery block if the record has one and it agrees.
 */
function mysteryFor(record: Record<string, unknown>): MysteryInfo {
  const existing = record.mystery as MysteryInfo | undefined;
  const landed = record.landed;
  if (landed !== undefined && (typeof landed !== "string" || !(landed in LANDED_TO_SELECTED))) {
    throw new BookAdapterError("bad-record", `mystery landed ${String(landed)}`);
  }
  if (existing && typeof existing === "object" && typeof existing.selected === "string" && existing.selected in SELECTED_FAMILY) {
    if (landed !== undefined && SELECTED_FAMILY[existing.selected] !== landed) {
      throw new BookAdapterError("bad-record", `mystery landed ${landed} vs selected ${existing.selected}`);
    }
    return existing;
  }
  if (landed === undefined) throw new BookAdapterError("bad-record", "mystery record without landed feature");
  return { version: "mystery-v86", selected: LANDED_TO_SELECTED[landed as string]! };
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
  const recordMode = record.mode as string;
  const engineMode = engineModeForRecord(recordMode);
  if (!engineMode) throw new BookAdapterError("bad-record", `unknown record mode ${recordMode}`);
  if (rgsMode != null) {
    const accepted = RECORD_MODES_FOR_RGS[rgsMode.toLowerCase()];
    if (!accepted || !accepted.includes(recordMode)) {
      throw new BookAdapterError("mode-mismatch", `${rgsMode} vs ${recordMode}`);
    }
  }
  // The animated total must equal what the server settles: payout / stake === payoutMultiplier.
  const animated = record.payout / record.stake;
  if (Math.abs(animated - payoutMultiplier) > 1e-9) {
    throw new BookAdapterError("payout-mismatch", `${animated} vs ${payoutMultiplier}`);
  }
  // Shallow copy: the engine sees its own mode names; the input record is never mutated.
  const script: SplashScript = { ...record, mode: engineMode };
  if (engineMode === "mystery") script.mystery = mysteryFor(record as unknown as Record<string, unknown>);
  return {
    script,
    unitScale: amount / record.stake,
    win: winFor(amount, payoutMultiplier),
    key: event.key ?? null,
  };
}

/** Script units (e.g. a line amount of 200 at stake 1000) to micro-units for formatAmount(). */
export function scriptUnitsToMicro(units: number, unitScale: number): number {
  return Math.round(units * unitScale);
}

/** The final win the animation shows, in micro-units: the script's total payout at the player's amount. */
export function animatedWinMicro(round: Pick<AdaptedRound, "script" | "unitScale">): number {
  return scriptUnitsToMicro(round.script.payout, round.unitScale);
}

/**
 * The guard the adapter enforces: the animated final win equals the server's
 * payoutMultiplier × base amount (both in micro-units), within one micro-unit.
 */
export function winMatchesServer(animatedWin: number, amount: number, payoutMultiplier: number): boolean {
  return Math.abs(animatedWin - winFor(amount, payoutMultiplier)) <= 1;
}
