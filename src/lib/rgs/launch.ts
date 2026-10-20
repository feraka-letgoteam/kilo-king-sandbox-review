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
  reason:
    | "missing-session"
    | "missing-rgs-url"
    | "invalid-rgs-url"
    | "rgs-host-not-allowed"
    | "invalid-device"
    | "replay-incomplete"
    | "invalid-amount";
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
 * RGS hosts shown in Stake's own sources (verified 20 Oct 2026):
 * - rgs.stake-engine.com: every rgs_url example in engineio/docs (docs/reference/url-structure,
 *   docs/api/*, changelog/replay-mode) and engineio/ts-client src/client.ts.
 * - rgs-us.stake-engine.com: engineio/ts-client src/client.ts comment ("This URL could change
 *   based on the environment or Jurisdiction (e.g., rgs.stake-engine.com, rgs-us.stake-engine.com)").
 * The docs say rgs_url differs between staging, production and replay and give no complete list,
 * so production builds take the list from VITE_RGS_HOSTS at build time (see rgsHostsFrom()).
 */
export const DEFAULT_RGS_HOSTS: readonly string[] = Object.freeze(["rgs.stake-engine.com", "rgs-us.stake-engine.com"]);

const HOST_PATTERN = /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/**
 * Parses a comma/space separated host list ("rgs.stake-engine.com, *.stake-engine.com").
 * Entries are exact hosts or "*.suffix" (any subdomain of suffix, not suffix itself).
 * Empty/missing input -> DEFAULT_RGS_HOSTS. Invalid entries throw, so a bad build config fails loudly.
 */
export function rgsHostsFrom(raw: string | null | undefined): readonly string[] {
  const list = (raw ?? "").split(/[\s,]+/).map((h) => h.trim().toLowerCase()).filter(Boolean);
  if (!list.length) return DEFAULT_RGS_HOSTS;
  for (const h of list) if (!HOST_PATTERN.test(h)) throw new Error(`invalid RGS host pattern: ${h}`);
  return Object.freeze(list);
}

/** Exact match, or "*.suffix" matching a strict subdomain on a label boundary. */
export function hostAllowed(hostname: string, patterns: readonly string[]): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return patterns.some((p) => {
    const pat = p.toLowerCase();
    if (pat.startsWith("*.")) {
      const suffix = pat.slice(1); // ".stake-engine.com"
      return host.length > suffix.length && host.endsWith(suffix);
    }
    return host === pat;
  });
}

const isLocal = (host: string) => host === "localhost" || host === "127.0.0.1";

/**
 * Accepts a bare host ("rgs.stake-engine.com") or a full URL. Only https, except
 * http on localhost/127.0.0.1 when allowLocalHttp is set (mock RGS in dev).
 * With allowedHosts (production builds), the host must match the list; localhost passes
 * only when allowLocalHttp is also set. Returns an origin-plus-path base with no trailing slash, or null.
 */
export function normaliseRgsUrl(raw: string, allowLocalHttp = false, allowedHosts?: readonly string[]): string | null {
  return checkRgsUrl(raw, allowLocalHttp, allowedHosts).url;
}

function checkRgsUrl(
  raw: string,
  allowLocalHttp: boolean,
  allowedHosts?: readonly string[],
): { url: string | null; notAllowed?: boolean } {
  const text = raw.trim();
  if (!text) return { url: null };
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { url: null };
  }
  const local = isLocal(url.hostname);
  if (url.protocol !== "https:" && !(allowLocalHttp && local && url.protocol === "http:")) return { url: null };
  if (url.username || url.password || url.search || url.hash) return { url: null };
  if (allowedHosts && !(allowLocalHttp && local) && !hostAllowed(url.hostname, allowedHosts)) {
    return { url: null, notAllowed: true };
  }
  return { url: `${url.origin}${url.pathname}`.replace(/\/+$/, "") };
}

export type LaunchOptions = {
  /** Dev/review only: no rgs_url and no session -> sandbox. */
  allowSandbox?: boolean;
  /** Dev only: http://localhost / 127.0.0.1 for the mock RGS. */
  allowLocalHttp?: boolean;
  /**
   * Production: host allow-list for rgs_url, e.g. rgsHostsFrom(import.meta.env.VITE_RGS_HOSTS).
   * Omitted = no host check (dev/review builds only). An empty list rejects every host.
   */
  allowedHosts?: readonly string[];
};

export function parseLaunch(
  search: string,
  opts: LaunchOptions = {},
): Launch {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const rawUrl = q.get("rgs_url");
  const replay = flag(q.get("replay"));

  if (rawUrl == null || rawUrl.trim() === "") {
    if (!replay && !q.get("sessionID") && opts.allowSandbox) return { kind: "sandbox" };
    return { kind: "error", reason: "missing-rgs-url" };
  }
  const checked = checkRgsUrl(rawUrl, !!opts.allowLocalHttp, opts.allowedHosts);
  if (!checked.url) {
    return { kind: "error", reason: checked.notAllowed ? "rgs-host-not-allowed" : "invalid-rgs-url", detail: rawUrl };
  }
  const rgsUrl = checked.url;

  // Missing device defaults to desktop (as the official ts-client does); anything else
  // except desktop/mobile is rejected, matching ts-client's "Unsupported device type".
  const rawDevice = (q.get("device") ?? "").trim().toLowerCase();
  if (rawDevice && rawDevice !== "desktop" && rawDevice !== "mobile") {
    return { kind: "error", reason: "invalid-device", detail: q.get("device") ?? "" };
  }
  const device: Device = rawDevice === "mobile" ? "mobile" : "desktop";
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
