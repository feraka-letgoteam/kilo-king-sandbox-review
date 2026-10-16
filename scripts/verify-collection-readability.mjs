// Normal-speed two-collector acceptance clip, plus resize during gather and transfer.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const out = "/workspace/screenshots/collection-readability";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const errors = [];
try {
  const resize = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await resize.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
  await page.getByTestId("spin-button").filter({ hasText: "SPIN" }).waitFor();
  await page.evaluate(() => localStorage.setItem("kilo-sandbox-bank-v1", "500000"));
  const samples = [];
  await page.exposeFunction("kkSample", (row) => samples.push(row));
  await page.evaluate(() => {
    window.setInterval(() => {
      const host = document.querySelector("[data-testid=reel-host]");
      window.kkSample({
        step: host?.dataset.collectStep || "",
        phase: host?.dataset.phase || "",
        bonus: document.querySelector("[data-testid=bonus-win]")?.textContent || "",
        spin: document.querySelector("[data-testid=spin-win]")?.textContent || "",
        left: document.querySelector("[data-testid=spins-left]")?.textContent || "",
      });
    }, 80);
  });
  const playing = page.evaluate(() => window.__kkPresentFrom("tool-bazooka", 15));
  await page.waitForFunction(
    () => document.querySelector("[data-testid=reel-host]")?.dataset.collectStep === "gather",
    null,
    { timeout: 20000 },
  );
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.waitForFunction(
    () => document.querySelector("[data-testid=reel-host]")?.dataset.collectStep === "transfer",
    null,
    { timeout: 30000 },
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForFunction(
    () =>
      (document.querySelector("[data-testid=bonus-win]")?.textContent || "").includes(
        "133,500",
      ),
    null,
    { timeout: 20000 },
  );
  await page.waitForFunction(
    () => document.querySelector("[data-testid=reel-host]")?.dataset.phase === "upgrade",
    null,
    { timeout: 15000 },
  );
  page.evaluate(() => window.__kkPresentFrom && document.querySelector("[data-testid=spin-button]")?.click());
  await playing;
  const bonuses = [];
  for (const row of samples) {
    if (bonuses[bonuses.length - 1] !== row.bonus && row.bonus) bonuses.push(row.bonus);
  }
  assert.ok(bonuses.includes("85,500"), `missing pre-collect bonus ${bonuses.join(" > ")}`);
  assert.ok(bonuses.includes("133,500"), `missing settled bonus ${bonuses.join(" > ")}`);
  const before = bonuses.indexOf("85,500");
  const after = bonuses.indexOf("133,500");
  assert.ok(before >= 0 && after === before + 1, `bonus updated more than once: ${bonuses.join(" > ")}`);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ bonuses, errors, tail: samples.slice(-8) }, null, 2));
  await resize.close();

  const clip = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: out, size: { width: 1280, height: 800 } },
  });
  const film = await clip.newPage();
  const filmErrors = [];
  film.on("pageerror", (error) => filmErrors.push(error.message));
  await film.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
  await film.getByTestId("spin-button").filter({ hasText: "SPIN" }).waitFor();
  await film.evaluate(() => localStorage.setItem("kilo-sandbox-bank-v1", "500000"));
  await film.reload();
  await film.getByTestId("spin-button").filter({ hasText: "SPIN" }).waitFor();
  const run = film.evaluate(() => window.__kkPresentFrom("tool-bazooka", 15));
  await film.waitForFunction(
    () => document.querySelector("[data-testid=reel-host]")?.dataset.phase === "upgrade",
    null,
    { timeout: 40000 },
  );
  await film.waitForTimeout(1100);
  await film.screenshot({ path: `${out}/retrigger.png` });
  await clip.close();
  await run.catch(() => {});
  assert.deepEqual(filmErrors, []);
  console.log("clip recorded");
} finally {
  await browser.close();
}
