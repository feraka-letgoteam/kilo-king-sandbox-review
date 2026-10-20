import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLaunch, normaliseRgsUrl, normaliseLang } from "./launch.ts";
import { formatAmount, exactDecimals, glyphsNeeded } from "./currency.ts";
import { createRgsClient, errorCodeFor, needsEndRound, RgsError, winFor, costFor } from "./client.ts";
import { rulesFromConfig, playableLevels, modeRule, missingModes } from "./config.ts";
import { gameModesFrom } from "./client.ts";
import {
  roundStateToScript, BookAdapterError, winMatchesServer, splashModeFor, scriptUnitsToMicro, animatedWinMicro, engineModeForRecord,
} from "./book-adapter.ts";
import { rgsHostsFrom, hostAllowed, launchOptionsFor } from "./launch.ts";
import { CurrencyError, resetCurrencyWarnings, isKnownCurrency } from "./currency.ts";
import {
  controlsFromJurisdiction, toControlJurisdiction, spinShortcutAllowed, slamStopAllowed, superTurboAllowed, turboAllowed,
  autoplayAllowed, buyFeatureAllowed, fullscreenAllowed, roundMinDurationMs, remainingRoundDelayMs, sessionDisplay,
  netPosition, formatSessionTime,
} from "./controls.ts";

const M = 1_000_000;

test("currency: reviewer set, symbol and placement", () => {
  assert.equal(formatAmount(1234_560_000, "USD"), "$1,234.56");
  assert.equal(formatAmount(1234_560_000, "EUR"), "€1,234.56");
  assert.equal(formatAmount(1234_560_000, "CAD"), "CA$1,234.56");
  assert.equal(formatAmount(1234_560_000, "MXN"), "MX$1,234.56");
  assert.equal(formatAmount(1235 * M, "JPY"), "¥1,235");
  assert.equal(formatAmount(1234_560_000, "XSC"), "1,234.56 SC");
  assert.equal(formatAmount(1234_560_000, "XGC"), "1,234.56 GC");
  assert.equal(formatAmount(1234_560_000, "usd"), "$1,234.56");
  assert.equal(formatAmount(1234_560_000, "ABC"), "1,234.56 ABC");
  assert.equal(formatAmount(0, "USD"), "$0.00");
});

test("currency: small bets and sub-cent wins are exact", () => {
  assert.equal(formatAmount(10_000, "USD"), "$0.01");
  assert.equal(formatAmount(20_000, "USD"), "$0.02");
  assert.equal(formatAmount(5_000, "USD"), "$0.005");
  assert.equal(formatAmount(1, "USD"), "$0.000001");
  assert.equal(formatAmount(1_500_000, "JPY"), "¥1.5");
  assert.equal(exactDecimals(1_230_000, 2), 2);
  assert.equal(exactDecimals(1_234_500, 2), 4);
});

test("currency: unit none and negatives", () => {
  assert.equal(formatAmount(2_500_000, "XSC", { unit: "none" }), "2.50");
  assert.equal(formatAmount(-2_500_000, "USD"), "-$2.50");
  assert.equal(formatAmount(-2_500_000, "XSC"), "-2.50 SC");
  assert.throws(() => formatAmount(1.5, "USD"));
  assert.ok(glyphsNeeded(["CAD", "XSC"]).includes("$"));
});

test("launch: live, replay, sandbox and errors", () => {
  const live = parseLaunch("?sessionID=abc&rgs_url=rgs.stake-engine.com&lang=fr&currency=usd&device=mobile&social=true");
  assert.deepEqual(live, {
    kind: "live", sessionID: "abc", rgsUrl: "https://rgs.stake-engine.com", lang: "en",
    device: "mobile", social: true, demo: false, currency: "USD",
  });
  const replay = parseLaunch("replay=true&game=g&version=3&mode=BASE&event=55&rgs_url=https://rgs.example.com/&amount=1000000");
  assert.equal(replay.kind, "replay");
  if (replay.kind === "replay") {
    assert.equal(replay.rgsUrl, "https://rgs.example.com");
    assert.equal(replay.amount, 1_000_000);
    assert.equal(replay.event, "55");
  }
  assert.deepEqual(parseLaunch("replay=true&game=g&rgs_url=x.com"), { kind: "error", reason: "replay-incomplete" });
  assert.equal(parseLaunch("replay=true&game=g&version=1&mode=B&event=1&rgs_url=x.com&amount=1.5").kind, "error");
  assert.deepEqual(parseLaunch("", { allowSandbox: true }), { kind: "sandbox" });
  assert.deepEqual(parseLaunch(""), { kind: "error", reason: "missing-rgs-url" });
  assert.deepEqual(parseLaunch("sessionID=a", { allowSandbox: true }), { kind: "error", reason: "missing-rgs-url" });
  assert.deepEqual(parseLaunch("rgs_url=x.com"), { kind: "error", reason: "missing-session" });
  assert.equal(parseLaunch("sessionID=a&rgs_url=http://evil.com").kind, "error");
  assert.equal(normaliseRgsUrl("http://localhost:8105", true), "http://localhost:8105");
  assert.equal(normaliseRgsUrl("http://localhost:8105"), null);
  assert.equal(normaliseRgsUrl("https://a.com/?x=1"), null);
  assert.equal(normaliseLang("en-GB"), "en");
  assert.equal(normaliseLang(null), "en");
});

test("client: error mapping and helpers", () => {
  assert.equal(errorCodeFor(400, { error: "ERR_IPB" }), "ERR_IPB");
  assert.equal(errorCodeFor(401, null), "ERR_IS");
  assert.equal(errorCodeFor(423, {}), "ERR_PAUSED");
  assert.equal(errorCodeFor(429, {}), "ERR_ACT");
  assert.equal(errorCodeFor(502, "x"), "ERR_GEN");
  assert.equal(needsEndRound({ payoutMultiplier: 0 }), false);
  assert.equal(needsEndRound({ payoutMultiplier: 2.5 }), true);
  assert.equal(needsEndRound({ payoutMultiplier: 2.5, active: false }), false);
  assert.equal(winFor(1_000_000, 2.5), 2_500_000);
  assert.equal(costFor(100_000, 1.5), 150_000);
  assert.ok(winMatchesServer(2_500_000, 1_000_000, 2.5));
});

const cfg0 = {
  gameID: "g", minBet: 100_000, maxBet: 10_000_000, stepBet: 100_000, defaultBetLevel: 100_000,
  betLevels: [100_000], gameModes: [], jurisdiction: {},
};

test("config: levels, mode costs and flags", () => {
  const rules = rulesFromConfig({
    gameID: "g", minBet: 100_000, maxBet: 10_000_000, stepBet: 100_000, defaultBetLevel: 999,
    betLevels: [50_000, 100_000, 1_000_000, 10_000_000, 20_000_000],
    gameModes: [{ mode: "BASE", costMultiplier: 1 }, { mode: "BONUS", costMultiplier: 100, maxBet: 1_000_000 }],
    jurisdiction: { disabledAutoplay: true, minimumRoundDuration: 2500, socialCasino: true },
  });
  assert.deepEqual(rules.betLevels, [100_000, 1_000_000, 10_000_000]);
  assert.equal(rules.defaultBet, 100_000);
  assert.equal(rules.modeCost.bonus, 100);
  assert.deepEqual(modeRule(rules, "bonus"), { mode: "BONUS", costMultiplier: 100, maxBet: 1_000_000 });
  assert.deepEqual(modeRule(rules, "Base"), { mode: "BASE", costMultiplier: 1, maxBet: 10_000_000 });
  assert.equal(rules.controls.disabledAutoplay, true);
  assert.equal(rules.jurisdiction.minimumRoundDurationMs, 2500);
  assert.equal(rules.jurisdiction.disabledAutoplay, true);
  assert.equal(rules.jurisdiction.disabledSpacebar, false);
  assert.equal(rules.social, true);
  assert.equal(rules.jurisdiction.social, true);
  assert.equal(rulesFromConfig({ ...cfg0, jurisdiction: {} }, true).social, true);
  assert.equal(rulesFromConfig({ ...cfg0, jurisdiction: {} }).social, false);
  assert.deepEqual(playableLevels(rules, "BONUS", 100_000_000), [100_000, 1_000_000]);
  assert.deepEqual(playableLevels(rules, "BONUS", 50_000_000), [100_000]);
});

test("client against the mock RGS", async (t) => {
  const mockPath = process.env.MOCK_RGS_PATH;
  if (!mockPath) return t.skip("MOCK_RGS_PATH not set");
  const { createMockRgs } = await import(mockPath);
  const server = createMockRgs();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const port = (server.address() as { port: number }).port;
  const rgs = createRgsClient(`http://127.0.0.1:${port}`);
  try {
    const id = `t${Date.now()}:force=base/3`;
    const auth = await rgs.authenticate(id);
    assert.equal(auth.balance.currency, "USD");
    assert.equal(auth.balance.amount, 1000 * M);
    assert.equal(auth.round, null); // no unfinished round -> no round
    const mrules = rulesFromConfig(auth.config);
    assert.equal(modeRule(mrules, "base")!.mode, "BASE");
    assert.equal(modeRule(mrules, "dockside")!.costMultiplier, 100);
    const play = await rgs.play({ sessionID: id, amount: M, mode: modeRule(mrules, "base")!.mode });
    assert.equal(play.balance.amount, 999 * M);
    assert.equal(play.round.payoutMultiplier, 25);
    assert.ok(needsEndRound(play.round));
    assert.equal(play.round.payout, 25 * M);
    assert.ok(play.round.betID != null);
    await rgs.event(id, "fs:3");
    const mid = await rgs.authenticate(id); // unfinished round comes back, play shape + last event
    assert.equal(mid.round?.payoutMultiplier, 25);
    assert.equal(mid.round?.event, "fs:3");
    const end = await rgs.endRound(id);
    assert.equal(end.balance.amount, 1024 * M);

    const loss = `l${Date.now()}:force=base/1`;
    await rgs.authenticate(loss);
    const lp = await rgs.play({ sessionID: loss, amount: M, mode: "base" });
    assert.equal(needsEndRound(lp.round), false);
    assert.equal((await rgs.authenticate(loss)).round, null);
    await assert.rejects(rgs.play({ sessionID: loss, amount: M, mode: "nope" }), (e: RgsError) => e.code === "ERR_VAL");

    const jpy = await rgs.authenticate(`j${Date.now()}:JPY`);
    assert.equal(formatAmount(jpy.balance.amount, jpy.balance.currency), "¥100,000");

    for (const [opt, code] of [["broke", "ERR_IPB"], ["paused", "ERR_PAUSED"], ["ratelimit", "ERR_ACT"], ["gen", "ERR_GEN"]] as const) {
      const sid = `${opt}${Date.now()}:${opt}`;
      await rgs.authenticate(sid);
      await assert.rejects(rgs.play({ sessionID: sid, amount: M, mode: "base" }), (e: RgsError) => e.code === code);
    }
    await assert.rejects(rgs.authenticate("x:expired"), (e: RgsError) => e.code === "ERR_IS");
    const rid = `r${Date.now()}:resume`;
    const resume = await rgs.authenticate(rid);
    assert.ok(resume.round && needsEndRound(resume.round));
    await rgs.endRound(rid);
    assert.equal((await rgs.authenticate(rid)).round, null); // finished -> no round on authenticate
    await assert.rejects(rgs.event(id, "x".repeat(33)), (e: RgsError) => e.code === "ERR_VAL");

    const adapted = roundStateToScript(play.round.state, M, play.round.payoutMultiplier, "base");
    assert.equal(adapted.win, 25 * M);
    const rp = await rgs.replay("kilo", "1", "dockside", "3");
    assert.equal(rp.payoutMultiplier, 25000);
    assert.equal(rp.costMultiplier, 100);
    await assert.rejects(rgs.replay("kilo", "1", "base", "999"), (e: RgsError) => e.code === "NOT_FOUND");
  } finally {
    server.close();
  }
  const dead = createRgsClient("http://127.0.0.1:1", { timeoutMs: 2000 });
  await assert.rejects(dead.authenticate("x"), (e: RgsError) => e.code === "ERR_NETWORK");
});

// A real base-mode book line from Bot 3's export (books_base.jsonl.zst, id 2), trimmed to the record.
const REAL_BOOK = {
  id: 2, payoutMultiplier: 20,
  events: [{ index: 0, type: "kiloRound", key: { seed: 83000002 }, record: {
    version: 3, mode: "spin", stake: 1000, cost: 1000, awarded: 0, banked: 0, mods: [], payout: 200, capped: false,
    base: { grid: [[{ s: "J" }, { s: "10" }, { s: "A" }], [{ s: "duffel" }, { s: "J" }, { s: "lamp" }], [{ s: "10" }, { s: "10" }, { s: "J" }], [{ s: "Q" }, { s: "lamp" }, { s: "K" }], [{ s: "keys" }, { s: "K" }, { s: "Q" }]],
      lines: [{ i: 3, s: "J", n: 3, pay: 200 }], scatters: 0, scatterPay: 0 }, free: [] } }],
};

test("book adapter: real export book", () => {
  const pm = REAL_BOOK.payoutMultiplier / 100; // RGS float
  const r = roundStateToScript(REAL_BOOK.events, 1_000_000, pm, "base");
  assert.equal(r.script.mode, "spin");
  assert.equal(r.win, 200_000); // 0.2 × $1.00
  assert.equal(formatAmount(scriptUnitsToMicro(r.script.base.lines![0]!.pay, r.unitScale), "USD"), "$0.20");
  assert.equal(formatAmount(scriptUnitsToMicro(200, 10_000 / 1000), "USD"), "$0.002");
  assert.deepEqual(r.key, { seed: 83000002 });
  assert.ok(winMatchesServer(r.win, 1_000_000, pm));
  assert.equal(splashModeFor("dockside"), "buy");
  assert.equal(splashModeFor("buy"), null);
  assert.throws(() => roundStateToScript(REAL_BOOK.events, 1_000_000, 0.3, "base"), (e: BookAdapterError) => e.reason === "payout-mismatch");
  assert.throws(() => roundStateToScript(REAL_BOOK.events, 1_000_000, pm, "ante"), (e: BookAdapterError) => e.reason === "mode-mismatch");
  assert.throws(() => roundStateToScript([], 1, 1), (e: BookAdapterError) => e.reason === "no-round-event");
  assert.throws(() => roundStateToScript([{ type: "kiloRound", record: { mode: "spin" } }], 1, 1), (e: BookAdapterError) => e.reason === "bad-record");
});

// ---- RGS patch 3: review fixes ----

const ALL_ON = {
  socialCasino: true, disabledFullscreen: true, disabledTurbo: true, disabledSuperTurbo: true, disabledAutoplay: true,
  disabledSlamstop: true, disabledSpacebar: true, disabledBuyFeature: true, displayNetPosition: true, displayRTP: true,
  displaySessionTimer: true, minimumRoundDuration: 2500,
};

test("controls: every jurisdiction flag is typed and consumable", () => {
  const off = controlsFromJurisdiction({});
  const on = controlsFromJurisdiction(ALL_ON);
  assert.deepEqual(off, {
    social: false, disabledTurbo: false, disabledSuperTurbo: false, disabledAutoplay: false, disabledSlamstop: false,
    disabledSpacebar: false, disabledBuyFeature: false, disabledFullscreen: false, displayNetPosition: false,
    displayRTP: false, displaySessionTimer: false, minimumRoundDurationMs: 0,
  });
  assert.equal(Object.values(on).filter((v) => v === true).length, 11);
  for (const [allowed, name] of [
    [spinShortcutAllowed, "spacebar"], [slamStopAllowed, "slamstop"], [superTurboAllowed, "superTurbo"], [turboAllowed, "turbo"],
    [autoplayAllowed, "autoplay"], [buyFeatureAllowed, "buy"], [fullscreenAllowed, "fullscreen"],
  ] as const) {
    assert.equal(allowed(off), true, name);
    assert.equal(allowed(on), false, name);
  }
  // Single flags only switch off their own control.
  const space = controlsFromJurisdiction({ disabledSpacebar: true });
  assert.equal(spinShortcutAllowed(space), false);
  assert.equal(slamStopAllowed(space), true);
  assert.equal(slamStopAllowed(controlsFromJurisdiction({ disabledSlamstop: true })), false);
  assert.equal(fullscreenAllowed(controlsFromJurisdiction({ disabledFullscreen: true })), false);
  assert.equal(superTurboAllowed(controlsFromJurisdiction({ disabledSuperTurbo: true })), false);
  assert.equal(turboAllowed(controlsFromJurisdiction({ disabledSuperTurbo: true })), true);
  assert.equal(superTurboAllowed(controlsFromJurisdiction({ disabledTurbo: true })), false);
  // Only literal true counts; strings or 1 from a bad payload don't flip a flag.
  assert.equal(controlsFromJurisdiction({ disabledSpacebar: "true" as unknown as boolean }).disabledSpacebar, false);
  assert.equal(controlsFromJurisdiction(null).social, false);
  assert.equal(controlsFromJurisdiction({}, true).social, true);
  assert.deepEqual(toControlJurisdiction(on), { disabledTurbo: true, disabledAutoplay: true, disabledBuyFeature: true });
});

test("controls: minimum round duration", () => {
  const c = controlsFromJurisdiction({ minimumRoundDuration: 2500 });
  assert.equal(roundMinDurationMs(c), 2500);
  assert.equal(remainingRoundDelayMs(1000, 1000, c), 2500);
  assert.equal(remainingRoundDelayMs(1000, 2200, c), 1300);
  assert.equal(remainingRoundDelayMs(1000, 3500, c), 0);
  assert.equal(remainingRoundDelayMs(1000, 9000, c), 0);
  assert.equal(remainingRoundDelayMs(5000, 1000, c), 2500); // clock went backwards: never shortens
  assert.equal(remainingRoundDelayMs(0, 100, controlsFromJurisdiction({})), 0);
  assert.equal(roundMinDurationMs(controlsFromJurisdiction({ minimumRoundDuration: -5 })), 0);
  assert.equal(roundMinDurationMs(controlsFromJurisdiction({ minimumRoundDuration: NaN })), 0);
  assert.equal(roundMinDurationMs(controlsFromJurisdiction({ minimumRoundDuration: 1500.2 })), 1501);
});

test("controls: session readouts, net position and timer", () => {
  assert.deepEqual(sessionDisplay(controlsFromJurisdiction({})), { netPosition: false, rtp: false, sessionTimer: false });
  assert.deepEqual(sessionDisplay(controlsFromJurisdiction(ALL_ON)), { netPosition: true, rtp: true, sessionTimer: true });
  assert.deepEqual(sessionDisplay(controlsFromJurisdiction({ displayRTP: true })), { netPosition: false, rtp: true, sessionTimer: false });
  assert.equal(netPosition(1000 * M, 1024 * M), 24 * M);
  assert.equal(netPosition(1000 * M, 999 * M), -M);
  assert.equal(formatAmount(netPosition(1000 * M, 997_500_000), "USD"), "-$2.50");
  assert.throws(() => netPosition(1.5, 2));
  assert.equal(formatSessionTime(0), "0:00");
  assert.equal(formatSessionTime(59_999), "0:59");
  assert.equal(formatSessionTime(61_000), "1:01");
  assert.equal(formatSessionTime(3_600_000), "1:00:00");
  assert.equal(formatSessionTime(3_725_000), "1:02:05");
  assert.equal(formatSessionTime(-5), "0:00");
});

test("launch: RGS host allow-list (build-time config, fail closed)", () => {
  assert.deepEqual([...rgsHostsFrom(undefined)], []);
  assert.deepEqual([...rgsHostsFrom("  ")], []);
  const hosts = rgsHostsFrom("RGS.stake-engine.com, *.engine.io");
  assert.deepEqual([...hosts], ["rgs.stake-engine.com", "*.engine.io"]);
  assert.throws(() => rgsHostsFrom("https://rgs.stake-engine.com"));
  assert.throws(() => rgsHostsFrom("*"));
  assert.throws(() => rgsHostsFrom("*.com x"));
  assert.ok(hostAllowed("rgs.stake-engine.com", hosts));
  assert.ok(hostAllowed("RGS.stake-engine.com", hosts));
  assert.equal(hostAllowed("rgs.stake-engine.com.evil.com", hosts), false);
  assert.equal(hostAllowed("evilrgs.stake-engine.com", hosts), false);
  assert.equal(hostAllowed("rgs-us.stake-engine.com", hosts), false);
  assert.ok(hostAllowed("rgs.engine.io", hosts));
  assert.equal(hostAllowed("engine.io", hosts), false);
  assert.equal(hostAllowed("evilengine.io", hosts), false);
  // Likely candidate from Engine's self-review prompt ({team}.live.engine.io), unconfirmed.
  const liveEngine = rgsHostsFrom("*.live.engine.io");
  assert.ok(hostAllowed("acme-games.live.engine.io", liveEngine));
  assert.ok(hostAllowed("a.b.live.engine.io", liveEngine));
  assert.equal(hostAllowed("live.engine.io", liveEngine), false);
  assert.equal(hostAllowed("rgs.engine.io", liveEngine), false);
  assert.equal(hostAllowed("acme.live.engine.io.evil.com", liveEngine), false);
  assert.equal(hostAllowed("acmelive.engine.io", liveEngine), false);
  assert.equal(parseLaunch("sessionID=a&rgs_url=acme.live.engine.io", launchOptionsFor({ sandboxBuild: false, rgsHosts: "*.live.engine.io" })).kind, "live");

  const prod = launchOptionsFor({ sandboxBuild: false, rgsHosts: "rgs.stake-engine.com, *.engine.io" });
  assert.equal(parseLaunch("sessionID=a&rgs_url=rgs.stake-engine.com", prod).kind, "live");
  assert.equal(parseLaunch("sessionID=a&rgs_url=https://rgs.engine.io/", prod).kind, "live");
  assert.deepEqual(parseLaunch("sessionID=a&rgs_url=rgs.example.com", prod), {
    kind: "error", reason: "rgs-host-not-allowed", detail: "rgs.example.com",
  });
  assert.equal(parseLaunch("replay=true&game=g&version=1&mode=base&event=1&rgs_url=evil.com", prod).kind, "error");
  assert.equal((parseLaunch("sessionID=a&rgs_url=http://rgs.stake-engine.com", prod) as { reason?: string }).reason, "invalid-rgs-url");
  assert.equal(parseLaunch("", prod).kind, "error"); // no sandbox outside sandbox builds
  // Unset / empty build config: every host is refused.
  for (const rgsHosts of [undefined, "", "  "]) {
    const closed = launchOptionsFor({ sandboxBuild: false, rgsHosts });
    assert.deepEqual(parseLaunch("sessionID=a&rgs_url=rgs.stake-engine.com", closed), {
      kind: "error", reason: "rgs-hosts-unconfigured", detail: "rgs.stake-engine.com",
    });
    assert.equal(parseLaunch("sessionID=a&rgs_url=http://localhost:8105", closed).kind, "error");
  }
  // Production never takes localhost; sandbox dev keeps http://localhost behind allowLocalHttp.
  assert.equal(parseLaunch("sessionID=a&rgs_url=http://localhost:8105", prod).kind, "error");
  assert.equal(parseLaunch("sessionID=a&rgs_url=https://localhost:8105", prod).kind, "error");
  const dev = launchOptionsFor({ sandboxBuild: true });
  assert.deepEqual(dev, { allowSandbox: true, allowLocalHttp: true });
  assert.equal(parseLaunch("sessionID=a&rgs_url=http://localhost:8105", dev).kind, "live");
  assert.deepEqual(parseLaunch("", dev), { kind: "sandbox" });
  assert.equal(normaliseRgsUrl("rgs.example.com", false, hosts), null);
  assert.equal(normaliseRgsUrl("rgs.stake-engine.com", false, hosts), "https://rgs.stake-engine.com");
});

test("launch: device values", () => {
  const dev = (q: string) => parseLaunch(`sessionID=a&rgs_url=rgs.example.com${q}`);
  assert.equal((dev("") as { device?: string }).device, "desktop");
  assert.equal((dev("&device=") as { device?: string }).device, "desktop");
  assert.equal((dev("&device=desktop") as { device?: string }).device, "desktop");
  assert.equal((dev("&device=Mobile") as { device?: string }).device, "mobile");
  assert.equal((dev("&device=tablet") as { device?: string }).device, "tablet");
  assert.deepEqual(dev("&device=phone"), { kind: "error", reason: "invalid-device", detail: "phone" });
  assert.equal(dev("&device=mobile2").kind, "error");
  assert.equal(parseLaunch("replay=true&game=g&version=1&mode=base&event=1&rgs_url=x.com&device=tv").kind, "error");
});

test("client: needsEndRound edge cases", () => {
  assert.equal(needsEndRound({ payoutMultiplier: 2.5, active: false }), false);
  assert.equal(needsEndRound({ payoutMultiplier: 0.01, active: false }), false);
  assert.equal(needsEndRound({ payoutMultiplier: 2.5, active: true }), true);
  assert.equal(needsEndRound({ payoutMultiplier: 0.01 }), true);
  for (const active of [undefined, true, false]) {
    assert.equal(needsEndRound({ payoutMultiplier: 0, ...(active === undefined ? {} : { active }) }), false, `zero, active=${active}`);
  }
});

test("currency: social mode never shows a real-money symbol", (t) => {
  resetCurrencyWarnings();
  const warn = t.mock.method(console, "warn", () => {});
  for (const code of ["USD", "EUR", "GBP", "CAD", "MXN", "JPY", "BRL", "INR", "KRW", "AUD", "NZD", "ABC", "", "usd"]) {
    const text = formatAmount(1234_560_000, code, { social: true });
    assert.doesNotMatch(text, /[$€£¥₩₹]|[A-Z]{3}/, `${code} -> ${text}`);
  }
  assert.equal(formatAmount(1234_560_000, "USD", { social: true }), "1,234.56");
  assert.equal(formatAmount(1235 * M, "JPY", { social: true }), "1,235");
  assert.equal(formatAmount(1234_560_000, "XSC", { social: true }), "1,234.56 SC");
  assert.equal(formatAmount(1234_560_000, "XGC", { social: true }), "1,234.56 GC");
  assert.equal(formatAmount(-2_500_000, "USD", { social: true }), "-2.50");
  assert.equal(glyphsNeeded(["USD", "CAD", "XSC"], true).includes("$"), false);
  // Warn once per code, not per call.
  const before = warn.mock.callCount();
  formatAmount(M, "USD", { social: true });
  formatAmount(M, "ABC", { social: true });
  assert.equal(warn.mock.callCount(), before);
  assert.throws(() => formatAmount(M, "USD", { social: true, strict: true }), CurrencyError);
  assert.doesNotThrow(() => formatAmount(M, "XSC", { social: true, strict: true }));
});

test("currency: unknown codes warn once, strict throws", (t) => {
  resetCurrencyWarnings();
  const warn = t.mock.method(console, "warn", () => {});
  assert.equal(formatAmount(M, "ZZZ"), "1.00 ZZZ");
  assert.equal(formatAmount(2 * M, "ZZZ"), "2.00 ZZZ");
  assert.equal(formatAmount(M, "QQQ"), "1.00 QQQ");
  assert.equal(warn.mock.callCount(), 2);
  assert.match(String(warn.mock.calls[0]!.arguments[0]), /ZZZ/);
  formatAmount(M, "USD");
  assert.equal(warn.mock.callCount(), 2);
  assert.throws(() => formatAmount(M, "ZZZ", { strict: true }), (e: CurrencyError) => e.code === "ZZZ");
  assert.doesNotThrow(() => formatAmount(M, "EUR", { strict: true }));
  assert.equal(isKnownCurrency("eur"), true);
  assert.equal(isKnownCurrency("toString"), false);
});

// Real-shaped records (field layout copied from Bot 3's phase2 books), at stake 1000 script units.
const rec = (mode: string, payout: number, extra: Record<string, unknown> = {}) => ({
  version: 3, mode, stake: 1000, cost: 1000, awarded: 0, banked: 0, mods: [], payout, capped: false,
  base: REAL_BOOK.events[0]!.record.base, free: [], ...extra,
});
const ev = (record: object) => [{ index: 0, type: "kiloRound", key: { seed: 1 }, record }];

test("book adapter: final animated win == payoutMultiplier x bet within 1 micro", () => {
  const cases: Array<[string, number]> = [["base", 200], ["base", 1_234_560], ["ante", 30], ["dockside", 25_000_000], ["getaway", 10]];
  let checked = 0;
  for (const bet of [10_000, 100_000, 200_000, 1_000_000, 1_230_000, 100_000_000]) {
    for (const [mode, payout] of cases) {
      const bookPM = Math.round((payout / 1000) * 100); // book payoutMultiplier, hundredths of base
      assert.equal(bookPM * 10, payout); // books store whole hundredths of the base bet
      const pm = bookPM / 100;
      const r = roundStateToScript(ev(rec(mode === "base" ? "spin" : mode === "dockside" ? "buy" : mode, payout)), bet, pm, mode);
      assert.ok(winMatchesServer(animatedWinMicro(r), bet, pm), `${mode} ${payout} @ ${bet}`);
      assert.ok(Math.abs(animatedWinMicro(r) - Math.round(bet * pm)) <= 1);
      checked += 1;
    }
  }
  assert.equal(checked, 30);
  const top = roundStateToScript(ev(rec("buy", 25_000_000)), M, 25_000, "dockside");
  assert.equal(animatedWinMicro(top), 25_000 * M);
  assert.equal(formatAmount(top.win, "USD"), "$25,000.00");
  const real = roundStateToScript(REAL_BOOK.events, M, 0.2, "base");
  assert.equal(animatedWinMicro(real), 200_000);
  assert.ok(winMatchesServer(animatedWinMicro(real), M, 0.2));
  assert.equal(winMatchesServer(animatedWinMicro(real) + 2, M, 0.2), false);
});

test("book adapter: old and new record mode names", () => {
  // Legacy books: engine names. New books: RGS names. Script mode is always the engine name.
  const pairs: Array<[string, string, string]> = [
    ["base", "spin", "spin"], ["base", "base", "spin"],
    ["dockside", "buy", "buy"], ["dockside", "dockside", "buy"],
    ["ante", "ante", "ante"], ["yacht", "yacht", "yacht"], ["getaway", "getaway", "getaway"],
  ];
  for (const [rgs, recordMode, engine] of pairs) {
    const input = rec(recordMode, 200);
    const frozen = JSON.stringify(input);
    const r = roundStateToScript(ev(input), M, 0.2, rgs);
    assert.equal(r.script.mode, engine, `${rgs}/${recordMode}`);
    assert.equal(JSON.stringify(input), frozen, "input record not mutated");
    assert.equal(r.script.payout, 200);
    assert.equal(r.script.base, input.base);
  }
  assert.equal(engineModeForRecord("dockside"), "buy");
  assert.equal(engineModeForRecord("buy"), "buy");
  assert.equal(engineModeForRecord("chopper"), null);
  // Without an RGS mode the record mode still maps.
  assert.equal(roundStateToScript(ev(rec("dockside", 200)), M, 0.2).script.mode, "buy");
  // Cross-mode records are refused.
  for (const [rgs, recordMode] of [["dockside", "yacht"], ["base", "buy"], ["yacht", "dockside"], ["ante", "spin"], ["nope", "spin"]]) {
    assert.throws(() => roundStateToScript(ev(rec(recordMode!, 200)), M, 0.2, rgs), (e: BookAdapterError) => e.reason === "mode-mismatch", `${rgs}/${recordMode}`);
  }
  assert.throws(() => roundStateToScript(ev(rec("chopper", 200)), M, 0.2), (e: BookAdapterError) => e.reason === "bad-record");
});

test("book adapter: mystery records", () => {
  const dock = rec("mystery", 4000, { landed: "dockside" });
  const frozen = JSON.stringify(dock);
  const r = roundStateToScript(ev(dock), M, 4, "mystery");
  assert.equal(r.script.mode, "mystery");
  assert.deepEqual(r.script.mystery, { version: "mystery-v86", selected: "dock" });
  assert.equal(JSON.stringify(dock), frozen);
  assert.equal("mystery" in dock, false);
  assert.deepEqual(roundStateToScript(ev(rec("mystery", 0, { landed: "yacht" })), M, 0, "mystery").script.mystery,
    { version: "mystery-v86", selected: "yacht" });
  // A record that already carries the engine's selection keeps it (yacht25 is the Super Yacht variant).
  const sel = { version: "mystery-v86", selected: "yacht25" };
  assert.equal(roundStateToScript(ev(rec("mystery", 0, { landed: "yacht", mystery: sel })), M, 0, "mystery").script.mystery, sel);
  assert.equal(roundStateToScript(ev(rec("mystery", 0, { mystery: sel })), M, 0, "mystery").script.mystery, sel);
  const bad = (extra: Record<string, unknown>, mode = "mystery") =>
    assert.throws(() => roundStateToScript(ev(rec(mode, 0, extra)), M, 0, "mystery"), (e: BookAdapterError) => e.reason === "bad-record" || e.reason === "mode-mismatch");
  bad({}); // no landed, no selection
  bad({ landed: "getaway" });
  bad({ landed: "dockside", mystery: { version: "mystery-v86", selected: "yacht" } });
  // Mystery accepts only record.mode "mystery": the old buy-labelled Mystery books are refused.
  bad({ landed: "dockside" }, "buy");
  bad({ feature: "dock" }, "buy");
  bad({ landed: "dockside" }, "dockside");
});

test("config: gameModes from the server (array, any case, legacy betModes, fail closed)", () => {
  const live = gameModesFrom({ gameModes: [
    { mode: "BASE", costMultiplier: 1, maxBet: 10_000_000 }, { mode: "Dockside", costMultiplier: 100 },
    { mode: "ANTE", costMultiplier: 1.5 }, { mode: "base", costMultiplier: 9 }, { mode: "", costMultiplier: 1 },
    { mode: "FREE", costMultiplier: 0 }, { mode: "NOCOST" }, null,
  ] });
  assert.deepEqual(live, [
    { mode: "BASE", costMultiplier: 1, maxBet: 10_000_000 }, { mode: "Dockside", costMultiplier: 100 }, { mode: "ANTE", costMultiplier: 1.5 },
  ]);
  // Legacy map shape, only when gameModes is absent.
  assert.deepEqual(gameModesFrom({ betModes: { BASE: { costMultiplier: 1 }, BONUS: { costMultiplier: 100, maxBet: 1_000_000 } } }),
    [{ mode: "BASE", costMultiplier: 1 }, { mode: "BONUS", costMultiplier: 100, maxBet: 1_000_000 }]);
  assert.deepEqual(gameModesFrom({ gameModes: [], betModes: { BASE: { costMultiplier: 1 } } }), []);
  assert.deepEqual(gameModesFrom({}), []);

  const rules = rulesFromConfig({ ...cfg0, maxBet: 100_000_000, betLevels: [100_000, 1_000_000, 100_000_000], gameModes: live });
  assert.equal(modeRule(rules, "dockside")!.mode, "Dockside"); // play() gets the server spelling
  assert.equal(modeRule(rules, "base")!.maxBet, 10_000_000);
  assert.equal(modeRule(rules, "yacht"), null);
  assert.deepEqual(missingModes(rules, ["base", "ante", "dockside", "yacht", "mystery", "getaway"]), ["yacht", "mystery", "getaway"]);
  assert.deepEqual(playableLevels(rules, "yacht", 1e12), []); // not offered by the server: nothing playable
  assert.deepEqual(playableLevels(rules, "BASE", 1e12), [100_000, 1_000_000]);
  assert.deepEqual(playableLevels(rules, "ante", 1_500_000), [100_000, 1_000_000]);
  assert.deepEqual(playableLevels(rules, "ante", 1_499_999), [100_000]);
});
