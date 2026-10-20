/**
 * Launch parameters. Read once at boot; never hardcode rgs_url.
 * Live:   ?sessionID&rgs_url&lang&currency&device&social&demo
 * Replay: ?replay=true&game&version&mode&event&rgs_url[&currency&amount&lang&device&social&demo]
 */

export type Device = "desktop" | "mobile";

type Common = {
  rgsUrl: string;
  lang: string;
  device: Device;
  social: boolean;
  demo: boolean;
  /** Currency hint from the URL. Live play uses the currency the server returns. */
  currency?: string;
};

export type LiveLaunch = Common & { kind: "live"; sessionID: string };
export type ReplayLaunch = Common & {
  kind: "replay";
  game: string;
  version: string;
  mode: string;
  event: string;
  /** Base amount in micro-units, when the platform passes it. */
  amount?: number;
};
/** No rgs_url and no replay flag: only valid in local dev/review builds. */
export type SandboxLaunch = { kind: "sandbox" };
export type LaunchError = {
  kind: "error";
  reason: "missing-session" | "missing-rgs-url" | "invalid-rgs-url" | "replay-incomplete" | "invalid-amount";
  detail?: string;
};
export type Launch = LiveLaunch | ReplayLaunch | SandboxLaunch | LaunchError;

const SUPPORTED_LANGS = new Set(["en"]);

/** English is the only required language; unknown codes fall back to it. */
export function normaliseLang(raw: string | null): string {
  const code = (raw ?? "").trim().toLowerCase().split(/[-_]/)[0] ?? "";
  return SUPPORTED_LANGS.has(code) ? code : "en";
}

function flag(raw: string | null): boolean {
  return raw != null && /^(1|true|yes)$/i.test(raw.trim());
}

/**
 * Accepts a bare host ("rgs.stake-engine.com") or a full URL. Only https, except
 * http on localhost/127.0.0.1 when allowLocalHttp is set (mock RGS in dev).
 * Returns an origin-plus-path base with no trailing slash, or null.
 */
export function normaliseRgsUrl(raw: string, allowLocalHttp = false): string | null {
  const text = raw.trim();
  if (!text) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(allowLocalHttp && local && url.protocol === "http:")) return null;
  if (url.username || url.password || url.search || url.hash) return null;
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}

export function parseLaunch(
  search: string,
  opts: { allowSandbox?: boolean; allowLocalHttp?: boolean } = {},
): Launch {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const rawUrl = q.get("rgs_url");
  const replay = flag(q.get("replay"));

  if (rawUrl == null || rawUrl.trim() === "") {
    if (!replay && !q.get("sessionID") && opts.allowSandbox) return { kind: "sandbox" };
    return { kind: "error", reason: "missing-rgs-url" };
  }
  const rgsUrl = normaliseRgsUrl(rawUrl, opts.allowLocalHttp);
  if (!rgsUrl) return { kind: "error", reason: "invalid-rgs-url", detail: rawUrl };

  const device: Device = (q.get("device") ?? "").toLowerCase() === "mobile" ? "mobile" : "desktop";
  const currency = q.get("currency")?.trim().toUpperCase() || undefined;
  const common: Common = {
    rgsUrl,
    lang: normaliseLang(q.get("lang")),
    device,
    social: flag(q.get("social")),
    demo: flag(q.get("demo")),
    ...(currency ? { currency } : {}),
  };

  if (replay) {
    const game = q.get("game")?.trim();
    const version = q.get("version")?.trim();
    const mode = q.get("mode")?.trim();
    const event = q.get("event")?.trim();
    if (!game || !version || !mode || !event) {
      return { kind: "error", reason: "replay-incomplete" };
    }
    const rawAmount = q.get("amount");
    let amount: number | undefined;
    if (rawAmount != null && rawAmount.trim() !== "") {
      amount = Number(rawAmount);
      if (!Number.isSafeInteger(amount) || amount < 0) {
        return { kind: "error", reason: "invalid-amount", detail: rawAmount };
      }
    }
    return { kind: "replay", ...common, game, version, mode, event, ...(amount != null ? { amount } : {}) };
  }

  const sessionID = q.get("sessionID")?.trim();
  if (!sessionID) return { kind: "error", reason: "missing-session" };
  return { kind: "live", ...common, sessionID };
}
