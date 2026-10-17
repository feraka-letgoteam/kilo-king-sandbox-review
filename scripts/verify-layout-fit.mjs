import assert from "node:assert/strict";
import { fitGameLayout } from "../src/components/kilo/layout.ts";

const screens = [
  [320, 568],
  [360, 800],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1280, 720],
  [1440, 900],
  [1920, 1080],
  [844, 390],
  [667, 375],
  [568, 320],
];
for (const [width, height] of screens) {
  const availableWidth = width - 24;
  const availableHeight = height - 68;
  const fit = fitGameLayout(availableWidth, availableHeight);
  assert.ok(
    fit.width <= availableWidth,
    `${width}×${height}: horizontal overflow`,
  );
  assert.ok(
    fit.reelWidth >= 280 && fit.reelHeight >= 160,
    `${width}×${height}: renderer minimum`,
  );
  assert.ok(
    Math.abs(fit.reelWidth / fit.reelHeight - 1.66) < 0.01,
    `${width}×${height}: reel aspect ratio`,
  );
  if (fit.mode === "wide")
    assert.ok(
      fit.width >= 800,
      "Desktop console has enough room for full-sized controls",
    );
  console.log(
    `${width}×${height}: ${fit.mode}, ${fit.reelWidth}×${Math.round(fit.reelHeight)} reels${fit.height > availableHeight ? ", vertical scrolling available" : ""}`,
  );
  if (fit.artLeft) {
    assert.equal(fit.width, fit.artLeft + fit.reelWidth + fit.artRight);
    assert.ok(fit.artLeft >= 150 && fit.artRight >= 190);
  }
}
// Check breakpoint transitions, not just the named devices.
for (let width = 280; width <= 1920; width += 10) {
  for (let height = 200; height <= 1080; height += 10) {
    const fit = fitGameLayout(width, height);
    assert.ok(Number.isFinite(fit.width) && Number.isFinite(fit.height));
    assert.ok(fit.width <= width, `Horizontal overflow at ${width}×${height}`);
    assert.ok(fit.height > 0 && fit.reelHeight >= 160);
    if (fit.mode === "wide")
      assert.ok(fit.width >= 800, `Console too narrow at ${width}×${height}`);
    assert.ok(fit.artLeft + fit.reelWidth + fit.artRight <= fit.width);
    if (fit.mode !== "wide") assert.equal(fit.artLeft + fit.artRight, 0);
  }
}
console.log(
  "PASS: device matrix and 14,685 viewport combinations. Feature state is not an input to viewport geometry.",
);
