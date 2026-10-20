import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLaunch, normaliseRgsUrl, normaliseLang } from "./launch.ts";
import { formatAmount, exactDecimals, glyphsNeeded } from "./currency.ts";
import { createRgsClient, errorCodeFor, needsEndRound, RgsError, winFor, costFor } from "./client.ts";
import { rulesFromConfig, playableLevels } from "./config.ts";
import { roundStateToScript, BookAdapterError, winMatchesServer, splashModeFor, scriptUnitsToMicro } from "./book-adapter.ts";

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

test("config: levels, mode costs and flags", () => {
  const rules = rulesFromConfig({
    gameID: "g", minBet: 100_000, maxBet: 10_000_000, stepBet: 100_000, defaultBetLevel: 999,
    betLevels: [50_000, 100_000, 1_000_000, 10_000_000, 20_000_000],
    betModes: { BASE: { costMultiplier: 1 }, BONUS: { costMultiplier: 100, maxBet: 1_000_000 } },
    jurisdiction: { disabledAutoplay: true, minimumRoundDuration: 2500, socialCasino: true },
  });
  assert.deepEqual(rules.betLevels, [100_000, 1_000_000, 10_000_000]);
  assert.equal(rules.defaultBet, 100_000);
  assert.equal(rules.modeCost.BONUS, 100);
  assert.equal(rules.controls.disabledAutoplay, true);
  assert.equal(rules.extra.minimumRoundDurationMs, 2500);
  assert.equal(rules.extra.social, true);
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
    const play = await rgs.play({ sessionID: id, amount: M, mode: "base" });
    assert.equal(play.balance.amount, 999 * M);
    assert.equal(play.round.payoutMultiplier, 25);
    assert.ok(needsEndRound(play.round));
    const end = await rgs.endRound(id);
    assert.equal(end.balance.amount, 1024 * M);

    const loss = `l${Date.now()}:force=base/1`;
    await rgs.authenticate(loss);
    const lp = await rgs.play({ sessionID: loss, amount: M, mode: "base" });
    assert.equal(needsEndRound(lp.round), false);

    const jpy = await rgs.authenticate(`j${Date.now()}:JPY`);
    assert.equal(formatAmount(jpy.balance.amount, jpy.balance.currency), "¥100,000");

    for (const [opt, code] of [["broke", "ERR_IPB"], ["paused", "ERR_PAUSED"], ["ratelimit", "ERR_ACT"], ["gen", "ERR_GEN"]] as const) {
      const sid = `${opt}${Date.now()}:${opt}`;
      await rgs.authenticate(sid);
      await assert.rejects(rgs.play({ sessionID: sid, amount: M, mode: "base" }), (e: RgsError) => e.code === code);
    }
    await assert.rejects(rgs.authenticate("x:expired"), (e: RgsError) => e.code === "ERR_IS");
    const resume = await rgs.authenticate(`r${Date.now()}:resume`);
    assert.ok(resume.round && needsEndRound(resume.round));
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
