#!/usr/bin/env node
/**
 * DEV-ONLY mock Stake Engine RGS for Kilo King. Never bundled; not imported by the game.
 * Implements /wallet/{authenticate,balance,play,end-round}, /bet/event and /bet/replay.
 *
 *   node scripts/mock-rgs.mjs [--port 8105] [--math /workspace/kilo-math/phase2]
 *   game URL: /?sessionID=dev&rgs_url=http://localhost:8105
 *   replay:   /?replay=true&game=kilo&version=1&mode=base&event=2&rgs_url=http://localhost:8105&currency=USD&amount=1000000
 *
 * Books come from the math export (index.json + books_<mode>.jsonl[.zst] + lookUpTable_<mode>_0.csv)
 * when it exists; otherwise from a few built-in EXAMPLE books whose state is placeholder data only.
 * The mock's weighted pick uses Math.random: it stands in for the server and never runs in the game.
 *
 * sessionID options, joined with ":" (e.g. "dev:JPY:resume"):
 *   USD|EUR|CAD|MXN|JPY|XSC|XGC  currency (default USD)
 *   social      config.jurisdiction.socialCasino = true
 *   restricted  every jurisdiction disable/display flag on, minimumRoundDuration 2500
 *   broke       balance starts at 0
 *   expired     every call returns 401 ERR_IS
 *   paused | ratelimit | gle | gen   /wallet/play returns 423 | 429 ERR_ACT | 400 ERR_GLE | 500 ERR_GEN
 *   resume      authenticate returns an unfinished winning round
 *   force=<mode>/<bookId>   (mode names as in index.json: base, ante, dockside, yacht, mystery, getaway)
 *     play always returns that book
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const PORT = Number(arg("port", process.env.MOCK_RGS_PORT || 8105));
const MATH_DIR = arg("math", process.env.MOCK_RGS_MATH || "/workspace/kilo-math/phase2/out/books");
// Node 20 has no zstd; fall back to the math venv's python-zstandard (Bot 3's exporter uses it too).
const ZSTD_PY = process.env.KILO_ZSTD_PYTHON || "/workspace/kilo-math/phase2/.venv/bin/python";
const MICRO = 1_000_000;

// ---------- books ----------
/** Built-in EXAMPLE books (not real math). payoutMultiplier is in hundredths, as in math-sdk books. */
function exampleBooks() {
  const STAKE = 1000;
  const SPLASH = { base: "spin", ante: "ante", dockside: "buy", yacht: "yacht", mystery: "mystery", getaway: "getaway" };
  const grid = Array.from({ length: 5 }, () => [{ s: "10" }, { s: "J" }, { s: "Q" }]);
  const mk = (mode) => (id, payoutMultiplier, note) => ({
    id, payoutMultiplier,
    events: [{ index: 0, type: "kiloRound", key: { example: note }, record: {
      version: 3, mode: SPLASH[mode], stake: STAKE, cost: STAKE, awarded: 0, banked: 0, mods: [],
      payout: (payoutMultiplier * STAKE) / 100, capped: false,
      base: { grid, lines: [], scatters: 0, scatterPay: 0 }, free: [], example: true,
    } }],
  });
  const modes = [
    ["base", 1, [[1, 0, "loss"], [2, 150, "small win"], [3, 2500, "big win"], [4, 12000, "bonus trigger"], [5, 2500000, "max win"]]],
    ["ante", 1.5, [[1, 0, "loss"], [2, 300, "small win"], [3, 4000, "bonus trigger"]]],
    ["dockside", 100, [[1, 1500, "low"], [2, 9000, "average"], [3, 2500000, "max win"]]],
    ["yacht", 200, [[1, 3000, "low"], [2, 21000, "average"], [3, 1800000, "max win"]]],
    ["mystery", 200, [[1, 4000, "dock"], [2, 22000, "yacht"]]],
    ["getaway", 1000, [[1, 0, "miss"], [2, 2500000, "25,000x"]]],
  ].map(([name, cost, rows]) => [name, cost, rows.map((r) => mk(name)(...r))]);
  return Object.fromEntries(
    modes.map(([name, cost, books]) => [name, { cost, books, weights: books.map((b) => [b.id, 1]), source: "example" }]),
  );
}

function readMaybeZst(file) {
  if (fs.existsSync(file) && file.endsWith(".zst")) {
    try {
      return execFileSync("zstd", ["-dc", file], { maxBuffer: 1 << 30, stdio: ["ignore", "pipe", "ignore"] }).toString("utf8");
    } catch {
      try {
        const py = "import sys,zstandard;sys.stdout.buffer.write(zstandard.ZstdDecompressor().stream_reader(open(sys.argv[1],'rb')).read())";
        return execFileSync(ZSTD_PY, ["-c", py, file], { maxBuffer: 1 << 30 }).toString("utf8");
      } catch {
        const plain = file.replace(/\.zst$/, "");
        if (fs.existsSync(plain)) return fs.readFileSync(plain, "utf8");
        throw new Error(`${file}: needs the zstd CLI, python-zstandard, or an uncompressed ${path.basename(plain)} beside it`);
      }
    }
  }
  const plain = file.replace(/\.zst$/, "");
  if (fs.existsSync(plain)) return fs.readFileSync(plain, "utf8");
  throw new Error(`${file} not found`);
}

function loadMath(dir) {
  const indexFile = path.join(dir, "index.json");
  if (!fs.existsSync(indexFile)) return null;
  const index = JSON.parse(fs.readFileSync(indexFile, "utf8"));
  const out = {};
  for (const m of index.modes ?? []) {
    const books = readMaybeZst(path.join(dir, m.events))
      .split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const weights = fs.readFileSync(path.join(dir, m.weights), "utf8")
      .split("\n").filter(Boolean)
      .map((l) => l.split(",").map(Number))
      .filter(([id, w]) => Number.isFinite(id) && Number.isFinite(w))
      .map(([id, w]) => [id, w]);
    out[m.name] = { cost: Number(m.cost), books, weights, source: dir };
  }
  return out;
}

let MODES;
try {
  MODES = loadMath(MATH_DIR) ?? exampleBooks();
} catch (e) {
  console.error(`mock-rgs: could not load ${MATH_DIR} (${e.message}); using example books`);
  MODES = exampleBooks();
}
/** Mode names match case-insensitively, like the live RGS (docs show "BASE"). */
const modeKey = (mode) => (typeof mode === "string" ? Object.keys(MODES).find((k) => k.toLowerCase() === mode.toLowerCase()) : undefined);
const bookById = (mode, id) => MODES[modeKey(mode)]?.books.find((b) => String(b.id) === String(id));
function pickBook(mode) {
  const { weights } = MODES[mode];
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total; // mock server only
  for (const [id, w] of weights) if ((r -= w) <= 0) return bookById(mode, id);
  return bookById(mode, weights.at(-1)[0]);
}

// ---------- sessions ----------
const CURRENCIES = new Set(["USD", "EUR", "CAD", "MXN", "JPY", "XSC", "XGC"]);
const USD_LEVELS = [10_000, 20_000, 50_000, 100_000, 200_000, 400_000, 600_000, 800_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000, 20_000_000, 50_000_000, 100_000_000];
const sessions = new Map();

function session(id) {
  if (sessions.has(id)) return sessions.get(id);
  const opts = new Set(String(id).split(":"));
  const currency = [...opts].find((o) => CURRENCIES.has(o)) ?? "USD";
  const scale = currency === "JPY" ? 100 : 1;
  const force = [...opts].find((o) => o.startsWith("force="))?.slice(6).split("/");
  const s = {
    id, opts, currency, scale, force,
    balance: opts.has("broke") ? 0 : 1_000 * MICRO * scale,
    round: null, lastRound: null, events: [],
  };
  if (opts.has("resume")) {
    const mode = MODES.base ? "base" : Object.keys(MODES)[0];
    const book = MODES[mode].books.find((b) => b.payoutMultiplier > 0) ?? MODES[mode].books[0];
    s.round = roundFor(mode, book, 1_000_000 * scale);
  }
  sessions.set(id, s);
  return s;
}

let betSeq = 0;
/** Same shape as the documented /wallet/play round: betID, amount, payout, payoutMultiplier, active, mode, state (+ event). */
function roundFor(mode, book, amount) {
  const payoutMultiplier = book.payoutMultiplier / 100;
  return {
    betID: ++betSeq, mode: mode.toUpperCase(), amount, payout: Math.round(amount * payoutMultiplier), eventID: String(book.id),
    payoutMultiplier, costMultiplier: MODES[mode].cost,
    active: payoutMultiplier > 0, state: book.events,
  };
}

function config(s) {
  const flags = s.opts.has("restricted");
  return {
    gameID: "kilo-king-mock",
    minBet: USD_LEVELS[0] * s.scale,
    maxBet: USD_LEVELS.at(-1) * s.scale,
    stepBet: 10_000 * s.scale,
    defaultBetLevel: 1_000_000 * s.scale,
    betLevels: USD_LEVELS.map((n) => n * s.scale),
    // Live RGS shape (stake-engine.com/docs/rgs/wallet, per Bot 3): an array, mode names uppercase like the docs.
    gameModes: Object.entries(MODES).map(([k, m]) => ({ mode: k.toUpperCase(), costMultiplier: m.cost, maxBet: USD_LEVELS.at(-1) * s.scale })),
    jurisdiction: {
      socialCasino: s.opts.has("social") || ["XSC", "XGC"].includes(s.currency),
      disabledFullscreen: flags, disabledTurbo: flags, disabledSuperTurbo: flags, disabledAutoplay: flags,
      disabledSlamstop: flags, disabledSpacebar: flags, disabledBuyFeature: flags,
      displayNetPosition: flags, displayRTP: flags, displaySessionTimer: flags,
      minimumRoundDuration: flags ? 2500 : 0,
    },
  };
}

// ---------- http ----------
const fail = (status, error, message) => ({ status, body: { error, message } });
const bal = (s) => ({ amount: s.balance, currency: s.currency });

function handle(method, url, body) {
  const replay = url.pathname.match(/^\/bet\/replay\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (method === "GET" && replay) {
    const [, , , mode, event] = replay.map(decodeURIComponent);
    const book = bookById(mode, event);
    if (!book) return fail(404, "NOT_FOUND", "Replay data not found.");
    return { status: 200, body: { payoutMultiplier: book.payoutMultiplier / 100, costMultiplier: MODES[modeKey(mode)].cost, state: book.events } };
  }
  if (method !== "POST") return fail(404, "NOT_FOUND", "Unknown route.");
  if (!body || typeof body.sessionID !== "string" || !body.sessionID) return fail(401, "ERR_IS", "Invalid or expired sessionID.");
  const s = session(body.sessionID);
  if (s.opts.has("expired")) return fail(401, "ERR_IS", "Invalid or expired sessionID.");

  switch (url.pathname) {
    case "/wallet/authenticate":
      s.authed = true;
      // round is only present while a round is unfinished.
      return { status: 200, body: { balance: bal(s), ...(s.round ? { round: { ...s.round, event: s.events.at(-1) } } : {}), config: config(s), meta: null } };
    case "/wallet/balance":
      if (!s.authed) return fail(401, "ERR_IS", "Authenticate first.");
      return { status: 200, body: { balance: bal(s) } };
    case "/wallet/play": {
      if (!s.authed) return fail(401, "ERR_IS", "Authenticate first.");
      if (s.opts.has("paused")) return fail(423, "ERR_GEN", "Play is paused.");
      if (s.opts.has("ratelimit")) return fail(429, "ERR_ACT", "Too many requests.");
      if (s.opts.has("gle")) return fail(400, "ERR_GLE", "Limit exceeded.");
      if (s.opts.has("gen")) return fail(500, "ERR_GEN", "An unexpected error occurred.");
      const { amount } = body;
      const mode = modeKey(body.mode);
      if (!mode) return fail(400, "ERR_VAL", "Unknown mode.");
      if (!config(s).betLevels.includes(amount)) return fail(400, "ERR_VAL", "Amount is not a bet level.");
      if (s.round?.active) return fail(400, "ERR_VAL", "A round is still active.");
      const cost = Math.round(amount * MODES[mode].cost);
      if (cost > s.balance) return fail(400, "ERR_IPB", "Insufficient player balance.");
      s.events = [];
      const book = s.force && s.force[0] === mode ? bookById(mode, s.force[1]) ?? pickBook(mode) : pickBook(mode);
      s.balance -= cost;
      s.round = roundFor(mode, book, amount);
      if (!s.round.active) { s.lastRound = s.round; s.round = null; }
      return { status: 200, body: { balance: bal(s), round: s.round ?? s.lastRound } };
    }
    case "/wallet/end-round": {
      if (!s.authed) return fail(401, "ERR_IS", "Authenticate first.");
      if (s.round?.active) {
        s.balance += Math.round(s.round.amount * s.round.payoutMultiplier);
        s.lastRound = { ...s.round, active: false };
        s.round = null;
      }
      return { status: 200, body: { balance: bal(s) } };
    }
    case "/bet/event":
      if (!s.authed) return fail(401, "ERR_IS", "Authenticate first.");
      if (typeof body.event !== "string" || Buffer.byteLength(body.event) > 32) return fail(400, "ERR_VAL", "event must be at most 32 bytes.");
      s.events.push(body.event);
      return { status: 200, body: { event: body.event } };
    default:
      return fail(404, "NOT_FOUND", "Unknown route.");
  }
}

export function createMockRgs() {
  return http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      let body = null;
      try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
      const out = handle(req.method, new URL(req.url, "http://mock"), body);
      res.writeHead(out.status, { "Content-Type": "application/json" }).end(JSON.stringify(out.body));
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createMockRgs().listen(PORT, "0.0.0.0", () => {
    const src = Object.values(MODES)[0]?.source;
    console.log(`mock-rgs on http://localhost:${PORT} (books: ${src === "example" ? "built-in EXAMPLE books" : src}; modes: ${Object.keys(MODES).join(", ")})`);
  });
}
