/**
 * Launch parameters. Read once at boot; never hardcode rgs_url.
 * Live:   ?sessionID&rgs_url&lang&currency&device&social&demo
 * Replay: ?replay=true&game&version&mode&event&rgs_url[&currency&amount&lang&device&social&demo]
 */

/** Engine's live review prompt lists mobile, desktop and tablet; the docs repo and ts-client list desktop/mobile. */
export type Device = "desktop" | "mobile" | "tablet";
const DEVICES: ReadonlySet<string> = new Set(["desktop", "mobile", "tablet"]);

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
    | "rgs-hosts-unconfigured"
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
 * RGS host allow-list (fail closed: any host not matching is refused).
 * In-code default: the two Engine suffixes from Stake's sources, `*.live.engine.io` (Engine's self-review
 * prompt) and `*.live.stake-engine.com` (engineio/docs url-structure). Builder 4's `build:stake` sets
 * VITE_RGS_HOSTS="*.live.engine.io,*.live.stake-engine.com" (comma-separated exact hosts and `*.suffix`);
 * the env value ADDS to these defaults, duplicates are dropped. Unconfirmed until a real Stake session.
 */
export const DEFAULT_RGS_HOSTS: readonly string[] = Object.freeze(["*.live.engine.io", "*.live.stake-engine.com"]);

const HOST_PATTERN = /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/**
 * Parses a comma-separated host list ("rgs.example.com,*.example.com"; spaces tolerated).
 * Entries are exact hosts or "*.suffix" (any subdomain of suffix, not suffix itself).
 * Empty/missing input -> []. Invalid entries throw, so a bad build config fails loudly.
 */
export function rgsHostsFrom(raw: string | null | undefined): readonly string[] {
  const list = (raw ?? "").split(/[\s,]+/).map((h) => h.trim().toLowerCase()).filter(Boolean);
  for (const h of list) if (!HOST_PATTERN.test(h)) throw new Error(`invalid RGS host pattern: ${h}`);
  return Object.freeze([...new Set(list)]);
}

/** DEFAULT_RGS_HOSTS plus whatever VITE_RGS_HOSTS adds, de-duplicated. */
export function allowedRgsHosts(viteRgsHosts: string | null | undefined): readonly string[] {
  return Object.freeze([...new Set([...DEFAULT_RGS_HOSTS, ...rgsHostsFrom(viteRgsHosts)])]);
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
    // An empty list also lands here: no configured host means no RGS (fail closed).
    return { url: null, notAllowed: true };
  }
  return { url: `${url.origin}${url.pathname}`.replace(/\/+$/, "") };
}

/**
 * Launch options for a build. Sandbox (local dev/review) builds: sandbox and localhost http allowed,
 * no host check. Every other build: DEFAULT_RGS_HOSTS + VITE_RGS_HOSTS; any other host is refused.
 * Boot code calls e.g. launchOptionsFor({ sandboxBuild: import.meta.env.DEV, rgsHosts: import.meta.env.VITE_RGS_HOSTS }).
 */
export function launchOptionsFor(build: { sandboxBuild: boolean; rgsHosts?: string | null }): LaunchOptions {
  if (build.sandboxBuild) return { allowSandbox: true, allowLocalHttp: true };
  return { allowedHosts: allowedRgsHosts(build.rgsHosts) };
}

export type LaunchOptions = {
  /** Dev/review only: no rgs_url and no session -> sandbox. */
  allowSandbox?: boolean;
  /** Dev only: http://localhost / 127.0.0.1 for the mock RGS. */
  allowLocalHttp?: boolean;
  /**
   * Production: host allow-list for rgs_url, from rgsHostsFrom(VITE_RGS_HOSTS) / launchOptionsFor().
   * Omitted = no host check (sandbox dev/review builds only). An empty list rejects every host.
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
    const reason = !checked.notAllowed ? "invalid-rgs-url" : opts.allowedHosts?.length ? "rgs-host-not-allowed" : "rgs-hosts-unconfigured";
    return { kind: "error", reason, detail: rawUrl };
  }
  const rgsUrl = checked.url;

  // Missing device defaults to desktop (as the official ts-client does); any value other than
  // desktop/mobile/tablet is rejected, like ts-client's "Unsupported device type".
  const rawDevice = (q.get("device") ?? "").trim().toLowerCase();
  if (rawDevice && !DEVICES.has(rawDevice)) {
    return { kind: "error", reason: "invalid-device", detail: q.get("device") ?? "" };
  }
  const device: Device = (rawDevice || "desktop") as Device;
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
