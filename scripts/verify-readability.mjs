// Focused presentation checks for paylines, event previews, close controls and loads.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";

const out = "/workspace/screenshots/readability";
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
async function boot(width, height, video) {
  const context = await browser.newContext({
    viewport: { width, height },
    ...(video
      ? { recordVideo: { dir: out, size: { width, height } } }
      : {}),
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const images = [];
  page.on("request", (request) => {
    const url = request.url();
    if (/\.(png|webp|jpe?g)(\?|$)/.test(url))
      images.push(`${request.resourceType()} ${url.split("/").pop()}`);
  });
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
  await page.getByTestId("spin-button").filter({ hasText: "SPIN" }).waitFor();
  await page.evaluate(() => localStorage.setItem("kilo-sandbox-bank-v1", "500000"));
  await page.reload();
  await page.getByTestId("spin-button").filter({ hasText: "SPIN" }).waitFor();
  return { context, page, images };
}

const results = [];
try {
  const desktop = await boot(1440, 900, false);
  const page = desktop.page;
  const beforeImages = [...desktop.images];
  const pixiHidden = [
    "hero-idle.png",
    "hero-cast.png",
    "hero-cheer.png",
    "hero-slump.png",
    "fg-rail.png",
    "prop-dock-left.png",
    "prop-dock-right.png",
    "ui-plaque.png",
  ];
  for (const file of pixiHidden)
    assert.equal(
      beforeImages.some((row) => row.endsWith(file)),
      false,
      `${file} was requested`,
    );
  const marina = beforeImages.filter((row) => row.endsWith("bg-marina.png"));
  assert.ok(marina.length >= 1);
  assert.ok(
    marina.every((row) => row.startsWith("image ")),
    `marina requests ${marina.join(", ")}`,
  );
  assert.ok(beforeImages.some((row) => row.includes("modal-panel.png")));
  assert.ok(beforeImages.some((row) => row.includes("tool-hook.png")));
  const bytes = await page.evaluate(() => {
    const rows = performance
      .getEntriesByType("resource")
      .filter((row) => /\.(png|webp|jpe?g)(\?|$)/.test(row.name));
    return {
      count: rows.length,
      transfer: rows.reduce((sum, row) => sum + row.transferSize, 0),
      decoded: rows.reduce((sum, row) => sum + row.decodedBodySize, 0),
    };
  });
  results.push(
    `Image resource entries ${bytes.count}, transfer ${bytes.transfer}, decoded ${bytes.decoded}. Pixi no longer requests hidden heroes, props, rail or plaque. Marina requests: ${marina.join(", ")}.`,
  );

  const rules = page.getByRole("button", { name: "Rules", exact: true });
  await rules.focus();
  await rules.click();
  const close = page.getByRole("button", { name: "Close", exact: true });
  await close.waitFor();
  assert.equal(await close.getAttribute("aria-label"), "Close");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "Game rules" }).waitFor({ state: "hidden" });
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute("aria-label")),
    "Rules",
    "focus returns to Rules",
  );
  results.push("Close control has an accessible name. Escape restores focus to Rules.");

  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Small line", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector("[data-testid=reel-host]")?.dataset.payline ===
      "3x10=200@0.2-1.1-2.0",
  );
  await page.getByTestId("round-total").filter({ hasText: "200" }).waitFor();
  await page.screenshot({ path: `${out}/small-line.png` });
  assert.equal(await page.getByTestId("balance").innerText(), "500,000");
  assert.equal(await page.locator("[data-testid=feature-summary]").count(), 0);
  results.push("Small line draws 3x10 through rows 2-1-0 and pays 200. No profit panel.");

  async function preview(name, phase, shot) {
    const bank = await page.evaluate(() => localStorage.getItem("kilo-sandbox-bank-v1"));
    await page.getByRole("button", { name: "Review", exact: true }).click();
    const started = Date.now();
    await page.getByRole("button", { name, exact: true }).click();
    await page.waitForFunction(
      (expected) =>
        document.querySelector("[data-testid=reel-host]")?.dataset.phase === expected,
      phase,
      { timeout: 8000 },
    );
    const waited = Date.now() - started;
    assert.ok(waited < 8000, `${name} took ${waited}ms to reach ${phase}`);
    if (shot) await page.screenshot({ path: `${out}/${shot}` });
    await page.getByTestId("spin-button").filter({ hasText: "SPIN" }).waitFor({
      timeout: 20000,
    });
    assert.equal(
      await page.evaluate(() => localStorage.getItem("kilo-sandbox-bank-v1")),
      bank,
      `${name} changed the bank`,
    );
    assert.equal(await page.getByTestId("preview-banner").innerText(), "Event preview — no balance changes.");
    results.push(`${name} reached ${phase} in ${waited}ms. Bank unchanged.`);
  }

  await preview("Preview: Hook contact, pull and release", "hook", "hook.png");
  await preview("Preview: Dynamite", "dynamite", "dynamite.png");
  await preview("Preview: Bazooka", "bazooka", "bazooka.png");
  await preview("Preview: Multiple collectors", "collect", "collectors.png");
  await preview("Preview: Fourth collector upgrade", "meter", "upgrade.png");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Preview: Fourth collector upgrade", exact: true }).click();
  await page.waitForFunction(
    () =>
      (document.querySelector("[data-testid=reel-host]")?.dataset.phaseLog || "").includes(
        "upgrade",
      ),
    { timeout: 15000 },
  );
  await page.screenshot({ path: `${out}/upgrade-banner.png` });
  await page.getByTestId("spin-button").filter({ hasText: "SPIN" }).waitFor();
  await preview("Preview: Capped collection", "collect", "capped.png");

  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Hook upgrade", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("[data-testid=reel-host]")?.dataset.phase === "entry",
    { timeout: 20000 },
  );
  await page.screenshot({ path: `${out}/entry.png` });
  await page.getByTestId("spin-button").click();
  await page.getByTestId("feature-summary").waitFor({ timeout: 20000 });
  assert.equal(await page.getByTestId("balance").innerText(), "500,000");
  await page.getByTestId("continue-feature").click();
  results.push("Feature entry still draws after texture cleanup. Skip did not change the bank.");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Small line", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector("[data-testid=reel-host]")?.dataset.payline ===
      "3x10=200@0.2-1.1-2.0",
  );
  await page.getByTestId("round-total").filter({ hasText: "200" }).waitFor();
  results.push("Reduced motion still explains the 200 line.");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.__kiloWrites = [];
    Storage.prototype.setItem = function (key, value) {
      if (key === "kilo-sandbox-bank-v1" || key === "kilo-sandbox-last-v1")
        window.__kiloWrites.push(`${key}=${value}`);
      return original.call(this, key, value);
    };
  });
  const other = await desktop.context.newPage();
  await other.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
  await other.getByTestId("spin-button").filter({ hasText: "SPIN" }).waitFor();
  await other.evaluate(() => localStorage.setItem("kilo-sandbox-bank-v1", "424242"));
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page
    .getByRole("button", { name: "Preview: Hook contact, pull and release", exact: true })
    .click();
  await page.getByTestId("spin-button").filter({ hasText: "SPIN" }).waitFor({ timeout: 20000 });
  assert.equal(
    await other.evaluate(() => localStorage.getItem("kilo-sandbox-bank-v1")),
    "424242",
    "hook preview overwrote the other tab",
  );
  assert.equal(await page.getByTestId("balance").innerText(), "500,000");
  assert.deepEqual(await page.evaluate(() => window.__kiloWrites), []);
  assert.equal(await page.locator("[data-testid=storage-fault]").count(), 0);
  results.push("Hook preview did not write the bank or the saved round, and left the other tab's balance.");

  await other.evaluate(() => localStorage.setItem("kilo-sandbox-bank-v1", "333333"));
  const roundBefore = await page.evaluate(() => sessionStorage.getItem("kilo-sandbox-last-v1"));
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Preview: Dynamite", exact: true }).click();
  await page.getByTestId("spin-button").filter({ hasText: "SKIP" }).waitFor();
  await page.getByTestId("spin-button").click();
  await page.getByTestId("spin-button").filter({ hasText: "SPIN" }).waitFor();
  assert.equal(
    await other.evaluate(() => localStorage.getItem("kilo-sandbox-bank-v1")),
    "333333",
    "skip overwrote the other tab",
  );
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("kilo-sandbox-last-v1")),
    roundBefore,
  );
  assert.deepEqual(await page.evaluate(() => window.__kiloWrites), []);
  assert.equal(await page.locator("[data-testid=storage-fault]").count(), 0);
  results.push("Skip on a preview wrote neither the bank nor the saved round.");

  await other.evaluate(() => localStorage.setItem("kilo-sandbox-bank-v1", "222222"));
  await page.evaluate(() => {
    window.__kiloForcePreviewError = false;
  });
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Preview: Bazooka", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("[data-testid=reel-host]")?.dataset.phase === "board",
    { timeout: 8000 },
  );
  await page.evaluate(() => {
    window.__kiloForcePreviewError = true;
  });
  await page.getByTestId("spin-button").filter({ hasText: "SPIN" }).waitFor({ timeout: 10000 });
  assert.equal(await page.locator("[data-testid=storage-fault]").count(), 0);
  assert.equal(
    await other.evaluate(() => localStorage.getItem("kilo-sandbox-bank-v1")),
    "222222",
    "preview error overwrote the other tab",
  );
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("kilo-sandbox-last-v1")),
    roundBefore,
  );
  assert.deepEqual(await page.evaluate(() => window.__kiloWrites), []);
  await page.evaluate(() => {
    window.__kiloForcePreviewError = false;
  });
  results.push("A failed preview reported no settlement write and did not roll the bank back.");
  await other.close();

  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Meter ×3", exact: true }).click();
  const firstLine = await page.waitForFunction(
    () => {
      const host = document.querySelector("[data-testid=reel-host]");
      if (
        host?.dataset.payline !==
          "3x10=200@0.1-1.1-2.1|3x10=200@0.2-1.1-2.0" ||
        host.dataset.paylineFocus !== "0"
      )
        return false;
      return host.dataset.payline;
    },
    { timeout: 25000 },
  );
  assert.equal(
    await firstLine.jsonValue(),
    "3x10=200@0.1-1.1-2.1|3x10=200@0.2-1.1-2.0",
  );
  const secondLine = page.waitForFunction(() => {
    const host = document.querySelector("[data-testid=reel-host]");
    if (host?.dataset.paylineFocus !== "1") return false;
    if (host.dataset.payline !== "3x10=200@0.1-1.1-2.1|3x10=200@0.2-1.1-2.0")
      return false;
    return host.dataset.payline;
  });
  await page.screenshot({ path: `${out}/multi-line-0.png` });
  assert.equal(
    await (await secondLine).jsonValue(),
    "3x10=200@0.1-1.1-2.1|3x10=200@0.2-1.1-2.0",
  );
  await page.screenshot({ path: `${out}/multi-line-1.png` });
  await page.getByTestId("spin-button").click();
  await page.getByTestId("feature-summary").waitFor({ timeout: 20000 });
  assert.equal(await page.getByTestId("balance").innerText(), "500,000");
  await page.getByTestId("continue-feature").click();
  results.push("Two recorded 200 lines cycle one at a time. Amounts stay 200 and 200.");

  await desktop.context.close();

  const phone = await boot(390, 844, false);
  const phoneSpin = await phone.page.getByTestId("spin-button").boundingBox();
  assert.ok(phoneSpin.y + phoneSpin.height <= 844);
  await phone.page.screenshot({ path: `${out}/phone.png` });
  await phone.context.close();

  const land = await boot(844, 390, false);
  const style = await land.page.evaluate(() => {
    const bust = document.querySelector(".kk-bust");
    const reel = document.querySelector("[data-testid=reel-host]").getBoundingClientRect();
    const spin = document.querySelector("[data-testid=spin-button]").getBoundingClientRect();
    return {
      display: getComputedStyle(bust).display,
      crest: document.querySelector(".kk-crest").getBoundingClientRect().height,
      reelH: reel.height,
      spinInside: spin.bottom <= 390 && spin.right <= 844,
    };
  });
  assert.equal(style.display, "none");
  assert.equal(style.crest, 48);
  assert.equal(style.spinInside, true);
  await land.page.screenshot({ path: `${out}/landscape.png` });
  results.push(
    `Short landscape bust display=${style.display}, crest ${style.crest}px, reel height ${Math.round(style.reelH)}. Hero stays hidden.`,
  );
  await land.context.close();

  assert.deepEqual(errors, []);
  console.log(results.join("\n"));
} finally {
  await browser.close();
}
