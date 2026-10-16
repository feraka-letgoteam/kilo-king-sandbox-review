// Exercise the actual Pixi collection animation, including real timed flights.
// Uses recorded outcomes only; no bets, RNG or local-bank writes.
import { createServer } from "vite";
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const fixtures = JSON.parse(
  await readFile("src/lib/kilo/fixtures.json", "utf8"),
);
const cases = [];
const seen = new Set();
for (const [name, fixture] of Object.entries(fixtures)) {
  for (const [index, spin] of fixture.script.free.entries()) {
    if (spin.got <= 0) continue;
    const key = JSON.stringify([
      fixture.script.stake,
      spin.grid,
      spin.got,
      spin.mult,
    ]);
    if (seen.has(key)) continue;
    seen.add(key);
    const cells = spin.grid.flat();
    const collectors = cells.filter((c) => c.s === "splash").length;
    const nominal =
      cells
        .filter((c) => c.s === "brick" && !c.part)
        .reduce((n, c) => n + (c.v || 0), 0) *
      fixture.script.stake *
      spin.mult *
      collectors;
    cases.push({
      name: `${name}:${index}`,
      stake: fixture.script.stake,
      spin,
      collectors,
      capped: spin.got < nominal,
    });
  }
}
const server = await createServer({ configFile: "vite.review.config.ts" });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE
    ? { executablePath: process.env.BROWSER_EXECUTABLE }
    : {}),
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:8082/review.html");
  await page.getByTestId("spin-button").filter({ hasText: "SPIN" }).waitFor();
  const result = await page.evaluate(async (cases) => {
    const { mountScene } = await import("/src/components/kilo/pixiStage.ts");
    const host = document.createElement("div");
    host.style.cssText =
      "position:fixed;left:0;top:0;width:1000px;height:540px;z-index:100";
    document.body.appendChild(host);
    const scene = await mountScene(host);
    let events = [];
    host.addEventListener("kilo-collection", (e) => events.push(e.detail));
    const before = localStorage.getItem("kilo-sandbox-bank-v1");
    const run = async (c, reduced, turbo) => {
      scene.setStake(c.stake);
      scene.setPace(turbo, reduced);
      scene.show(c.spin.grid);
      events = [];
      await scene.collect(c.spin);
      const final = events.filter((e) => e?.phase === "bank").at(-1);
      if (final?.completed !== c.spin.got)
        throw new Error(
          `${c.name}: displayed ${final?.completed}, expected ${c.spin.got}`,
        );
      if (events.at(-1) !== null)
        throw new Error(`${c.name}: collection panel was not cleared`);
      return { name: c.name, got: final.completed };
    };
    const reducedResults = [];
    for (const c of cases) reducedResults.push(await run(c, true, false));
    const multi = cases.find((c) => c.collectors > 1),
      capped = cases.find((c) => c.capped);
    if (!multi || !capped)
      throw new Error("Missing representative multi-collector/cap fixture");
    const normal = [
      await run(multi, false, false),
      await run(capped, false, false),
    ];
    const turbo = [await run(multi, false, true)];
    scene.setPace(false, false);
    scene.show(multi.spin.grid);
    events = [];
    const active = scene.collect(multi.spin);
    await new Promise((r) => setTimeout(r, 240));
    scene.show(multi.spin.grid);
    await active;
    if (events.at(-1) !== null || events.some((e) => e?.phase === "bank"))
      throw new Error("Cancelled collection left a stale or completed display");
    const after = localStorage.getItem("kilo-sandbox-bank-v1");
    scene.destroy();
    host.remove();
    return {
      reducedCases: reducedResults.length,
      normal,
      turbo,
      cancelled: true,
      bankUnchanged: before === after,
    };
  }, cases);
  assert.equal(result.bankUnchanged, true);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
  await server.close();
}
