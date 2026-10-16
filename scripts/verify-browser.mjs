// Starts its own local Vite server. Run after installing a Playwright Chromium browser.
import { createServer } from "vite";
import { chromium } from "playwright";
import assert from "node:assert/strict";

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
const errors = [],
  results = [];
async function shownAmount(page) {
  const round = (await page.getByTestId("round-total").innerText()).trim();
  if (round) return round;
  return (await page.getByTestId("bonus-win").innerText()).trim();
}
try {
  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["phone", 390, 844],
    ["landscape", 844, 390],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on("pageerror", (e) => errors.push(name + ": " + e.message));
    await page.goto("http://127.0.0.1:8082/review.html");
    await page.getByTestId("spin-button").filter({ hasText: "SPIN" }).waitFor();
    const before = await page.getByTestId("reel-host").boundingBox();
    const spinBox = await page.getByTestId("spin-button").boundingBox();
    assert.ok(
      spinBox.y + spinBox.height <= height &&
        spinBox.x + spinBox.width <= width,
      `${name}: spin visible`,
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth),
      width,
      `${name}: no horizontal overflow`,
    );
    if (name === "desktop") {
      await page.getByTestId("spin-button").evaluate((b) => {
        b.click();
        b.click();
      });
      await page
        .getByTestId("spin-button")
        .filter({ hasText: "SKIP" })
        .waitFor();
      await page.getByTestId("spin-button").evaluate((b) => b.click());
      await page
        .getByTestId("spin-button")
        .filter({ hasText: "SPIN" })
        .waitFor();
      const saved = await page.evaluate(() =>
        JSON.parse(sessionStorage.getItem("kilo-sandbox-last-v1")),
      );
      const bank = await page.evaluate(() =>
        Number(localStorage.getItem("kilo-sandbox-bank-v1")),
      );
      assert.equal(
        bank,
        500000 - saved.script.cost + saved.script.payout,
        "double click and skip: one debit/credit",
      );
      assert.equal(saved.credited, true);
      await page.reload();
      await page
        .getByTestId("spin-button")
        .filter({ hasText: "SPIN" })
        .waitFor();
      assert.equal(
        await page.evaluate(() =>
          Number(localStorage.getItem("kilo-sandbox-bank-v1")),
        ),
        bank,
        "refresh: no second credit",
      );
      results.push(
        "Local play: double-click lock, Skip, final balance, reload without recredit passed.",
      );
    }
    await page.getByRole("button", { name: "Review", exact: true }).click();
    await page
      .getByRole("button", { name: "Chopper", exact: true })
      .click();
    await page.getByTestId("spins-left").waitFor();
    assert.deepEqual(
      await page.getByTestId("reel-host").boundingBox(),
      before,
      `${name}: same host in feature`,
    );
    await page.waitForTimeout(1800);
    await page.getByTestId("spin-button").click();
    await page.getByTestId("spin-button").filter({ hasText: "SPIN" }).waitFor();
    assert.equal(await shownAmount(page), "124,000");
    assert.equal(await page.getByTestId("spins-left").innerText(), "0");
    assert.deepEqual(
      await page.getByTestId("reel-host").boundingBox(),
      before,
      `${name}: stable after feature`,
    );
    if (name !== "desktop")
      assert.equal(await page.getByTestId("balance").innerText(), "500,000");
    await page.getByTestId("feature-summary").waitFor();
    assert.equal(await page.getByTestId("summary-return").innerText(), "124,000");
    assert.equal(
      await page.getByTestId("summary-cost").innerText(),
      "Feature cost: 250,000",
    );
    assert.match(
      await page.getByTestId("feature-summary").getAttribute("class"),
      /is-neutral/,
    );
    assert.equal(
      await page.getByTestId("charge-note").innerText(),
      "SUMMARY · NO CHARGE",
    );
    assert.equal(await page.getByTestId("spin-button").isEnabled(), false);
    const bankBefore = await page.getByTestId("balance").innerText();
    const stored = await page.evaluate(() =>
      localStorage.getItem("kilo-sandbox-bank-v1"),
    );
    await page.getByTestId("continue-feature").click();
    await page.locator("[data-testid=spins-left]").waitFor({ state: "detached" });
    assert.equal(await page.getByTestId("balance").innerText(), bankBefore);
    assert.equal(
      await page.evaluate(() => localStorage.getItem("kilo-sandbox-bank-v1")),
      stored,
      `${name}: Continue does not charge or credit`,
    );
    assert.equal(await page.getByTestId("round-total").innerText(), "124,000");
    assert.equal(await page.getByTestId("spin-button").innerText(), "SPIN");
    assert.equal(await page.getByTestId("spin-button").isEnabled(), true);
    assert.match(await page.getByTestId("charge-note").innerText(), /CHARGE 1,000/);
    const hud = await page.getByTestId("game-hud").innerText();
    assert.match(hud, /LAST RESULT/);
    assert.doesNotMatch(hud, /REMAINING|NEXT \+/);
    assert.equal(
      await page.getByRole("button", { name: "BUY FEATURE" }).count(),
      1,
    );
    results.push(
      `${name} ${width}x${height}: fixed reel host, controls in view, no overflow, feature intro and Skip passed.`,
    );
    await page.close();
  }
  // Full recorded feature, through collection and completion, normal motion.
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.on("pageerror", (e) => errors.push("full: " + e.message));
  await page.goto("http://127.0.0.1:8082/review.html?review");
  await page
    .getByRole("button", { name: "Chopper", exact: true })
    .click();
  await page.locator('[data-event^="Collected"]').waitFor({ timeout: 60000 });
  await page
    .getByTestId("spin-button")
    .filter({ hasText: "SPIN" })
    .waitFor({ timeout: 60000 });
  assert.equal(await shownAmount(page), "124,000");
  assert.equal(await page.getByTestId("balance").innerText(), "500,000");
  results.push(
    "Full normal-speed Chopper: collection, finish, exact total and unchanged replay bank passed.",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Natural feature", exact: true }).click();
  await page
    .getByTestId("spin-button")
    .filter({ hasText: "SPIN" })
    .waitFor({ timeout: 45000 });
  assert.equal(await shownAmount(page), "49,200");
  assert.match(
    await page.getByTestId("feature-summary").getAttribute("class"),
    /is-profit/,
  );
  const naturalBank = await page.getByTestId("balance").innerText();
  await page.getByTestId("continue-feature").click();
  assert.equal(await page.getByTestId("balance").innerText(), naturalBank);
  assert.equal(await page.getByTestId("spin-button").innerText(), "SPIN");
  results.push("Reduced-motion natural feature: exact total passed.");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator(".kk-turbo").click();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page
    .getByRole("button", { name: "Hook upgrade", exact: true })
    .click();
  await page.getByTestId("spin-button").filter({ hasText: "SKIP" }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByTestId("spin-button")
    .filter({ hasText: "SPIN" })
    .waitFor({ timeout: 60000 });
  assert.equal(await shownAmount(page), "29,000");
  assert.equal(await page.getByTestId("balance").innerText(), "500,000");
  results.push(
    "Turbo, hook, multiple collectors, retrigger and resize during travel: exact final payout passed.",
  );
  const purchase = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  purchase.on("pageerror", (e) => errors.push("purchase: " + e.message));
  await purchase.goto("http://127.0.0.1:8082/review.html");
  await purchase.getByTestId("spin-button").filter({ hasText: "SPIN" }).waitFor();
  await purchase.getByRole("button", { name: "BUY FEATURE" }).click();
  await purchase.locator(".kk-purchase").filter({ hasText: "100×" }).click();
  await purchase
    .getByTestId("spin-button")
    .filter({ hasText: "BUY 100,000" })
    .waitFor();
  assert.match(
    await purchase.getByTestId("charge-note").innerText(),
    /CHARGE 100,000/,
  );
  const armedBank = await purchase.getByTestId("balance").innerText();
  await purchase.getByRole("button", { name: "Review", exact: true }).click();
  await purchase.getByRole("button", { name: "Buy", exact: true }).click();
  await purchase.getByTestId("spin-button").filter({ hasText: "SKIP" }).waitFor();
  await purchase.getByTestId("spin-button").click();
  await purchase.getByTestId("feature-summary").waitFor();
  assert.equal(await purchase.getByTestId("summary-return").innerText(), "11,400");
  assert.equal(
    await purchase.getByTestId("summary-cost").innerText(),
    "Feature cost: 100,000",
  );
  assert.match(
    await purchase.getByTestId("feature-summary").getAttribute("class"),
    /is-neutral/,
  );
  assert.equal(await purchase.getByTestId("balance").innerText(), armedBank);
  await purchase.getByTestId("continue-feature").click();
  assert.equal(await purchase.getByTestId("balance").innerText(), armedBank);
  assert.equal(await purchase.getByTestId("spin-button").innerText(), "SPIN");
  assert.equal(await purchase.getByTestId("spin-button").isEnabled(), true);
  assert.match(
    await purchase.getByTestId("charge-note").innerText(),
    /CHARGE 1,000/,
  );
  assert.equal(await purchase.locator("[data-testid=spins-left]").count(), 0);
  assert.match(await purchase.getByTestId("game-hud").innerText(), /LAST RESULT/);
  results.push(
    "One-time purchase: cost is shown, Continue returns to Spin and does not charge or credit.",
  );
  await purchase.close();

  const seq = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  seq.on("pageerror", (e) => errors.push("sequence: " + e.message));
  await seq.goto("http://127.0.0.1:8082/review.html?review");
  await seq.locator(".kk-turbo").click();
  await seq.evaluate(() => {
    const host = document.querySelector("[data-testid=reel-host]");
    if (host) host.dataset.phaseLog = "";
  });
  await seq.getByRole("button", { name: "Hook upgrade", exact: true }).click();
  await seq.waitForFunction(
    () =>
      (document.querySelector("[data-testid=reel-host]")?.dataset.phaseLog ||
        "").includes("|collect") ||
      (document.querySelector("[data-testid=reel-host]")?.dataset.phaseLog ||
        "").startsWith("collect"),
    { timeout: 30000 },
  );
  await seq.setViewportSize({ width: 390, height: 844 });
  await seq.getByTestId("feature-summary").waitFor({ timeout: 70000 });
  assert.equal(await shownAmount(seq), "29,000");
  assert.equal(await seq.getByTestId("balance").innerText(), "500,000");
  const log = (
    (await seq.getByTestId("reel-host").getAttribute("data-phase-log")) || ""
  ).split("|");
  const firstHook = log.indexOf("hook");
  assert.ok(log.indexOf("entry") !== -1 && log.indexOf("entry") < firstHook);
  assert.deepEqual(log.slice(firstHook, firstHook + 5), [
    "hook",
    "hook-landed",
    "line",
    "collect",
    "meter",
  ]);
  const secondHook = log.indexOf("hook", firstHook + 1);
  assert.deepEqual(log.slice(secondHook, secondHook + 5), [
    "hook",
    "hook-landed",
    "collect",
    "meter",
    "upgrade",
  ]);
  await seq.getByTestId("continue-feature").click();
  assert.equal(await seq.getByTestId("spin-button").innerText(), "SPIN");
  assert.equal(await seq.getByTestId("balance").innerText(), "500,000");
  assert.equal(await seq.locator("[data-testid=spins-left]").count(), 0);
  results.push(
    "Hook, line, collection, meter, upgrade, resize during collection, then Continue passed.",
  );
  await seq.close();
  assert.deepEqual(errors, [], "no browser runtime errors");
  console.log(JSON.stringify({ results, errors }, null, 2));
} finally {
  await browser.close();
  await server.close();
}
