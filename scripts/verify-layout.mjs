// Presentation regression coverage for the defects found in the uploaded source.
// Run: BROWSER_EXECUTABLE=/path/to/chromium node scripts/verify-layout.mjs
import { createServer } from "vite";
import { chromium } from "playwright";
import assert from "node:assert/strict";
const server = await createServer({
  configFile: "vite.review.config.ts",
  server: { port: 8083 },
});
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
try {
  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
    [1024, 768],
    [800, 700],
    [600, 844],
    [390, 844],
    [390, 600],
    [320, 568],
    [844, 390],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:8083/review.html");
    await page.getByTestId("spin-button").filter({ hasText: "SPIN" }).waitFor();
    const controls = await page
      .locator(".kk-deck button,.kk-deck select,.kk-feature-button")
      .evaluateAll((nodes) =>
        nodes.map((n) => {
          const b = n.getBoundingClientRect();
          return {
            label: n.getAttribute("aria-label") || n.textContent.trim(),
            x: b.x,
            y: b.y,
            w: b.width,
            h: b.height,
          };
        }),
      );
    for (const b of controls) {
      assert.ok(
        b.x >= -1 &&
          b.y >= -1 &&
          b.x + b.w <= width + 1 &&
          b.y + b.h <= height + 1,
        `${width}x${height}: ${b.label} is visible: ${JSON.stringify(b)}`,
      );
      assert.ok(
        b.w >= 44 && b.h >= 36,
        `${width}x${height}: usable ${b.label} control`,
      );
    }
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth),
      width,
    );
    const host = await page.getByTestId("reel-host").boundingBox();
    if (width <= 740 && height > 550)
      assert.ok(
        host.height / host.width < 0.7,
        "Portrait frame must fit three reel rows, not the whole screen",
      );
    const before = await page.getByTestId("balance").innerText();
    await page
      .getByRole("button", { name: "BUY FEATURE", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Feature selection" });
    const b = await dialog.boundingBox();
    assert.ok(
      Math.abs(b.x + b.width / 2 - width / 2) < 2,
      "Purchase dialog centered",
    );
    assert.ok(
      b.y >= 0 && b.y + b.height <= height + 1,
      "Purchase dialog bounded",
    );
    assert.equal(await page.locator(".kk-shell").getAttribute("inert"), "");
    for (const card of await page.locator(".kk-purchase").all()) {
      await card.scrollIntoViewIfNeeded();
      const contained = await card.evaluate((n) => {
        const b = n.getBoundingClientRect();
        const p = n.querySelector("b").getBoundingClientRect();
        return (
          p.left >= b.left &&
          p.right <= b.right &&
          p.top >= b.top &&
          p.bottom <= b.bottom
        );
      });
      assert.ok(contained, "Price and currency remain inside purchase card");
    }
    await dialog.getByRole("button", { name: "Close" }).click();
    assert.equal(
      await page.getByTestId("balance").innerText(),
      before,
      "Opening and closing a dialog cannot charge",
    );
    await page.getByRole("button", { name: "Rules", exact: true }).click();
    await page.getByRole("dialog", { name: "Game rules" }).waitFor();
    await page.keyboard.press("Escape");
    assert.equal(
      await page
        .getByRole("button", { name: "Rules", exact: true })
        .evaluate((n) => n === document.activeElement),
      true,
      "Restore focus",
    );
    // Largest offered buy price; select only, never place a paid bet in this layout check.
    await page.locator("#base-bet").selectOption("10000");
    await page
      .getByRole("button", { name: "BUY FEATURE", exact: true })
      .click();
    await page.locator(".kk-purchase").filter({ hasText: "100×" }).click();
    assert.equal(
      await page.getByTestId("balance").innerText(),
      before,
      "Feature selection is not a debit",
    );
    assert.match(
      await page.getByTestId("spin-button").innerText(),
      /1,000,000/,
    );
    results.push(
      `${width}x${height}: controls, frame proportions, dialogs, price containment, focus, purchase selection`,
    );
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ results, errors }, null, 2));
} finally {
  await browser.close();
  await server.close();
}
