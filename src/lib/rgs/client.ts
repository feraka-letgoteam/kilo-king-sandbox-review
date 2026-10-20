/**
 * Thin, typed RGS client. It only moves data; it never decides outcomes, never
 * touches the local sandbox bank, and is not wired into play() yet (patch 4 does
 * that, after Feraka's go-ahead). Amounts are integer micro-units.
 */
import type {
  RgsGameMode,
  AuthenticateResponse,
  BalanceResponse,
  PlayResponse,
  ReplayResponse,
  RgsBalance,
  RgsConfig,
  RgsErrorCode,
  RgsRound,
} from "./types.ts";

export class RgsError extends Error {
  readonly code: RgsErrorCode;
  readonly status: number;
  constructor(code: RgsErrorCode, status: number, message?: string) {
    super(message || code);
    this.name = "RgsError";
    this.code = code;
    this.status = status;
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type RgsClientOptions = {
  fetch?: FetchLike;
  /** Per-request timeout. Default 15 s. */
  timeoutMs?: number;
};

const KNOWN: ReadonlySet<string> = new Set([
  "ERR_IS", "ERR_IPB", "ERR_VAL", "ERR_GLE", "ERR_ACT", "NOT_FOUND", "ERR_GEN",
]);

/** Maps an HTTP status and documented error body to one error code. */
export function errorCodeFor(status: number, body: unknown): RgsErrorCode {
  // 423 and 429 mean the same thing whatever the body says.
  if (status === 423) return "ERR_PAUSED";
  if (status === 429) return "ERR_ACT";
  const raw = body && typeof body === "object" ? (body as { error?: unknown }).error : undefined;
  if (typeof raw === "string" && KNOWN.has(raw)) return raw as RgsErrorCode;
  if (status === 401) return "ERR_IS";
  if (status === 404) return "NOT_FOUND";
  if (status === 400) return "ERR_VAL";
  return "ERR_GEN";
}

const isInt = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n);
const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

function checkBalance(b: unknown): RgsBalance {
  const v = b as RgsBalance | undefined;
  if (!v || !isInt(v.amount) || v.amount < 0 || typeof v.currency !== "string" || !v.currency) {
    throw new RgsError("ERR_BAD_RESPONSE", 200, "balance");
  }
  return { amount: v.amount, currency: v.currency.toUpperCase() };
}

function checkRound(r: unknown): RgsRound {
  const v = r as RgsRound | undefined;
  if (!v || typeof v !== "object" || !isNum(v.payoutMultiplier) || v.payoutMultiplier < 0) {
    throw new RgsError("ERR_BAD_RESPONSE", 200, "round");
  }
  return { ...v, costMultiplier: isNum(v.costMultiplier) ? v.costMultiplier : 1 };
}

function checkConfig(c: unknown): RgsConfig {
  const v = c as Partial<RgsConfig> | undefined;
  if (!v || !isInt(v.minBet) || !isInt(v.maxBet) || !Array.isArray(v.betLevels)) {
    throw new RgsError("ERR_BAD_RESPONSE", 200, "config");
  }
  const betLevels = v.betLevels.filter(isInt).filter((n) => n > 0).sort((a, b) => a - b);
  if (!betLevels.length) throw new RgsError("ERR_BAD_RESPONSE", 200, "config.betLevels");
  return {
    gameID: typeof v.gameID === "string" ? v.gameID : "",
    minBet: v.minBet,
    maxBet: v.maxBet,
    stepBet: isInt(v.stepBet) ? v.stepBet : 0,
    defaultBetLevel: isInt(v.defaultBetLevel) ? v.defaultBetLevel : betLevels[0]!,
    betLevels,
    gameModes: gameModesFrom(v as { gameModes?: unknown; betModes?: unknown }),
    jurisdiction: v.jurisdiction && typeof v.jurisdiction === "object" ? v.jurisdiction : {},
  };
}

/**
 * config.gameModes (array of {mode, costMultiplier, maxBet}) is the live shape. A legacy
 * `betModes` map ({NAME: {costMultiplier, maxBet}}) is folded in only when gameModes is absent.
 * Entries without a positive cost are dropped, so a mode we can't price is never offered.
 */
export function gameModesFrom(c: { gameModes?: unknown; betModes?: unknown }): RgsGameMode[] {
  const raw: unknown[] = Array.isArray(c.gameModes)
    ? c.gameModes
    : c.betModes && typeof c.betModes === "object"
      ? Object.entries(c.betModes as Record<string, unknown>).map(([mode, m]) => ({ ...(m as object), mode }))
      : [];
  const out: RgsGameMode[] = [];
  const seen = new Set<string>();
  for (const e of raw) {
    const m = e as Partial<RgsGameMode> | null;
    if (!m || typeof m.mode !== "string" || !m.mode.trim() || !isNum(m.costMultiplier) || m.costMultiplier <= 0) continue;
    const key = m.mode.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ mode: m.mode.trim(), costMultiplier: m.costMultiplier, ...(isInt(m.maxBet) && m.maxBet > 0 ? { maxBet: m.maxBet } : {}) });
  }
  return out;
}

/** /bet/event payloads are limited to 32 bytes. */
export const MAX_EVENT_BYTES = 32;

export function createRgsClient(baseUrl: string, opts: RgsClientOptions = {}) {
  const doFetch: FetchLike = opts.fetch ?? ((input, init) => fetch(input, init));
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const base = baseUrl.replace(/\/+$/, "");

  async function request<T>(method: "GET" | "POST", path: string, body?: object): Promise<T> {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller?.signal,
      });
    } catch {
      throw new RgsError("ERR_NETWORK", 0);
    } finally {
      if (timer) clearTimeout(timer);
    }
    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      parsed = null;
    }
    if (!res.ok) {
      const message =
        parsed && typeof parsed === "object" && typeof (parsed as { message?: unknown }).message === "string"
          ? (parsed as { message: string }).message
          : undefined;
      throw new RgsError(errorCodeFor(res.status, parsed), res.status, message);
    }
    if (parsed == null) throw new RgsError("ERR_BAD_RESPONSE", res.status);
    return parsed as T;
  }

  return {
    async authenticate(sessionID: string): Promise<AuthenticateResponse> {
      const r = await request<AuthenticateResponse>("POST", "/wallet/authenticate", { sessionID });
      return {
        balance: checkBalance(r.balance),
        round: r.round == null ? null : checkRound(r.round),
        config: checkConfig(r.config),
        meta: r.meta ?? null,
      };
    },

    async balance(sessionID: string): Promise<BalanceResponse> {
      const r = await request<BalanceResponse>("POST", "/wallet/balance", { sessionID });
      return { balance: checkBalance(r.balance) };
    },

    /** Debits amount × the mode's cost multiplier on the server and returns the round. */
    async play(args: { sessionID: string; amount: number; mode: string }): Promise<PlayResponse> {
      if (!isInt(args.amount) || args.amount <= 0) throw new RgsError("ERR_VAL", 0, "amount");
      if (!args.mode) throw new RgsError("ERR_VAL", 0, "mode");
      const r = await request<PlayResponse>("POST", "/wallet/play", args);
      return { balance: checkBalance(r.balance), round: checkRound(r.round) };
    },

    /** Only for rounds with payoutMultiplier > 0; the RGS closes zero-win rounds itself. */
    async endRound(sessionID: string): Promise<BalanceResponse> {
      const r = await request<BalanceResponse>("POST", "/wallet/end-round", { sessionID });
      return { balance: checkBalance(r.balance) };
    },

    /** Saves in-round progress (e.g. free-spin index) so a reload can resume. */
    async event(sessionID: string, event: string): Promise<void> {
      if (new TextEncoder().encode(event).length > MAX_EVENT_BYTES) {
        throw new RgsError("ERR_VAL", 0, "event longer than 32 bytes");
      }
      await request<unknown>("POST", "/bet/event", { sessionID, event });
    },

    /** Bet Replay. Unauthenticated: never sends a sessionID. */
    async replay(game: string, version: string, mode: string, event: string): Promise<ReplayResponse> {
      const seg = (s: string) => encodeURIComponent(s);
      const r = await request<ReplayResponse>(
        "GET",
        `/bet/replay/${seg(game)}/${seg(version)}/${seg(mode)}/${seg(event)}`,
      );
      const round = checkRound(r);
      return { payoutMultiplier: round.payoutMultiplier, costMultiplier: round.costMultiplier, state: round.state };
    },
  };
}

export type RgsClient = ReturnType<typeof createRgsClient>;

/**
 * The only way boot code should get a client: from a parsed launch. A launch error (bad or missing
 * rgs_url, host not allowed, bad device ...) or a sandbox launch returns no client, so no request
 * can be made; the caller shows the error screen for `error.reason`.
 */
export function clientForLaunch(
  launch: { kind: "live" | "replay"; rgsUrl: string } | { kind: "sandbox" } | { kind: "error"; reason: string; detail?: string },
  opts: RgsClientOptions = {},
): { client: RgsClient; error: null } | { client: null; error: { kind: "error"; reason: string; detail?: string } | null } {
  if (launch.kind === "error") return { client: null, error: launch };
  if (launch.kind === "sandbox") return { client: null, error: null };
  return { client: createRgsClient(launch.rgsUrl, opts), error: null };
}

/**
 * True when the round needs /wallet/end-round: any round paying more than 0x (prompt [221]).
 * `active` is deliberately ignored: a paying round reported as active:false still gets end-round
 * until a real Stake session confirms what active:false means. A 0x round is closed by the RGS.
 */
export function needsEndRound(round: Pick<RgsRound, "payoutMultiplier" | "active">): boolean {
  return typeof round.payoutMultiplier === "number" && Number.isFinite(round.payoutMultiplier) && round.payoutMultiplier > 0;
}

/** Server-side win in micro-units for a base amount, rounded to the nearest micro-unit. */
export function winFor(amount: number, payoutMultiplier: number): number {
  return Math.round(amount * payoutMultiplier);
}

/** What the player is charged for a base amount in a mode. */
export function costFor(amount: number, costMultiplier: number): number {
  return Math.round(amount * costMultiplier);
}
