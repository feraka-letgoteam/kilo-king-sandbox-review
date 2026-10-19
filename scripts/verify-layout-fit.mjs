import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fitGameLayout } from "../src/components/kilo/layout.ts";

// Product contracts in CSS pixels. Scrolling is allowed only below these
// deliberately retained renderer/control minimums, never as a blanket waiver.
const MIN_REEL_WIDTH = 280;
const MIN_LANDSCAPE_REEL_HEIGHT = 280 / 1.66;
const REEL_RATIO = 1.66;
const DOCK_GAP = 0;
const REVIEW_HEADER = 44;
const EPSILON = 0.01;
const zeroInsets = { top: 0, right: 0, bottom: 0, left: 0 };
let checks = 0;
let shortViewportChecks = 0;

// Match the viewport CSS media query, not the selected child layout. Device
// safe areas are additional lower bounds, rather than padding added twice.
function availableSpace(width, height, review, insets = zeroInsets) {
  const phone = width <= 620;
  const compact = height <= 380 && width / height >= 1.4;
  const horizontal = compact ? 8 : phone ? 12 : 16;
  return {
    width:
      width -
      Math.max(horizontal, insets.left) -
      Math.max(horizontal, insets.right),
    height:
      height -
      (review ? REVIEW_HEADER : 0) -
      Math.max(compact ? 8 : phone ? 12 : 16, insets.top) -
      Math.max(compact ? 8 : phone ? 20 : 24, insets.bottom),
  };
}

function verifyAvailable(width, height, label) {
  const fit = fitGameLayout(width, height);
  checks += 1;
  for (const [key, value] of Object.entries(fit)) {
    if (key !== "mode" && key !== "compact")
      assert.ok(
        Number.isFinite(value) && value >= 0,
        `${label}: invalid ${key}`,
      );
  }
  assert.ok(fit.width <= width + EPSILON, `${label}: horizontal overflow`);
  assert.ok(fit.reelWidth >= MIN_REEL_WIDTH, `${label}: renderer too narrow`);
  assert.ok(
    fit.compact || Math.abs(fit.reelWidth / fit.reelHeight - REEL_RATIO) < 0.01,
    `${label}: distorted reels`,
  );
  assert.equal(
    fit.dockGap,
    fit.compact ? 8 : fit.mode === "landscape" ? 10 : DOCK_GAP,
    `${label}: explicit cabinet/control gap`,
  );
  assert.equal(fit.strip, 0, `${label}: no unbudgeted totals row`);
  let minimumHeight;
  if (fit.compact) {
    assert.equal(fit.header, 0);
    assert(fit.reelHeight >= 160);
    assert.equal(fit.height, fit.reelHeight + 44);
    assert.equal(fit.width, fit.reelWidth + 72);
    minimumHeight = 204;
  } else if (fit.mode === "landscape") {
    assert.equal(fit.header, 56, `${label}: landscape title/HUD height`);
    assert.equal(fit.side, 96, `${label}: action-column width`);
    assert.equal(fit.controlLeft, 128, `${label}: left bet controls`);
    assert.equal(fit.artLeft + fit.artRight, 0);
    assert.ok(fit.reelHeight >= MIN_LANDSCAPE_REEL_HEIGHT);
    assert.equal(
      fit.width,
      fit.controlLeft + fit.reelWidth + fit.side + fit.dockGap * 2,
    );
    assert.equal(fit.height, Math.max(280, fit.header + fit.reelHeight));
    assert.equal(fit.dock, fit.height, `${label}: full side rail`);
    assert.ok(fit.dock >= 280, `${label}: side controls need full height`);
    minimumHeight = 280;
  } else {
    const portrait = fit.mode === "portrait";
    const framed = fit.artLeft > 0;
    assert.equal(fit.side, 0);
    assert.equal(fit.dock, portrait ? 160 : 100, `${label}: full control rail`);
    assert.equal(
      fit.header,
      portrait ? 104 : framed ? 64 : 112,
      `${label}: title/HUD reservation`,
    );
    assert.equal(
      fit.height,
      fit.header + fit.reelHeight + fit.dockGap + fit.dock,
      `${label}: vertical budget`,
    );
    if (portrait) {
      assert.equal(fit.artLeft + fit.artRight, 0);
      assert.ok(
        fit.width >= 276,
        `${label}: phone controls need their full width`,
      );
      assert.ok(fit.reelWidth <= 680);
    } else {
      assert.ok(
        fit.width >= 800,
        `${label}: desktop rail needs 780px plus room`,
      );
      assert.ok(fit.reelWidth <= (framed ? 1040 : 1000));
    }
    if (framed) {
      assert.ok(
        width >= 1180 && height >= 660,
        `${label}: side art needs space`,
      );
      assert.ok(fit.artLeft >= 200 && fit.artRight >= 236);
      assert.equal(fit.width, fit.artLeft + fit.reelWidth + fit.artRight);
    } else assert.equal(fit.artLeft + fit.artRight, 0);
    minimumHeight =
      fit.header + fit.dockGap + fit.dock + MIN_REEL_WIDTH / REEL_RATIO;
  }
  if (height >= minimumHeight - EPSILON) {
    assert.ok(
      fit.height <= height + EPSILON,
      `${label}: unexpected vertical overflow ${fit.height.toFixed(2)} > ${height}`,
    );
  } else {
    assert.ok(
      fit.height <= minimumHeight + EPSILON,
      `${label}: excess scrolling`,
    );
    assert.ok(fit.height > height, `${label}: minimum-height policy changed`);
    shortViewportChecks += 1;
  }
  return fit;
}

function verifyViewport(width, height, review, insets = zeroInsets) {
  const available = availableSpace(width, height, review, insets);
  return verifyAvailable(
    available.width,
    available.height,
    `${width}×${height}${review ? " review" : " game"} / ${JSON.stringify(insets)}`,
  );
}

const screens = [
  [320, 568],
  [360, 640],
  [390, 844],
  [430, 932],
  [620, 800],
  [621, 800],
  [768, 1024],
  [824, 640],
  [1024, 768],
  [1280, 720],
  [1440, 900],
  [1920, 1080],
  [844, 390],
  [667, 375],
  [568, 320],
];
for (const [width, height] of screens) {
  const modes = [];
  for (const review of [false, true]) {
    const fit = verifyViewport(width, height, review);
    modes.push(`${review ? "review" : "game"}: ${fit.mode}`);
  }
  console.log(`${width}×${height}: ${modes.join("; ")}`);
}
const safeAreaScreens = [
  [390, 844, { top: 47, right: 0, bottom: 34, left: 0 }],
  [430, 932, { top: 59, right: 0, bottom: 34, left: 0 }],
  [844, 390, { top: 0, right: 44, bottom: 21, left: 44 }],
  [932, 430, { top: 0, right: 59, bottom: 21, left: 59 }],
  [768, 1024, { top: 24, right: 0, bottom: 20, left: 0 }],
];
for (const [width, height, insets] of safeAreaScreens)
  for (const review of [false, true])
    verifyViewport(width, height, review, insets);

// Exact content-space boundaries supplement real browser viewport dimensions.
for (const width of [
  539, 540, 541, 739, 740, 741, 899, 900, 901, 1179, 1180, 1181,
])
  for (const height of [265, 266, 267, 499, 500, 501, 659, 660, 661])
    verifyAvailable(width, height, `boundary ${width}×${height}`);

// Formerly oscillated because portrait padding changed the observed height.
for (const review of [false, true]) {
  const content = availableSpace(824, 640, review);
  const first = verifyViewport(824, 640, review);
  assert.equal(
    first.mode,
    review ? "landscape" : "portrait",
    "former feedback-loop viewport is stable",
  );
  assert.deepEqual(fitGameLayout(content.width, content.height), first);
}
for (let width = 320; width <= 1920; width += 20)
  for (let height = 260; height <= 1080; height += 20)
    for (const review of [false, true]) verifyViewport(width, height, review);

// Guard the concrete CSS causes that pure geometry cannot observe. These do not
// replace a browser check of actual positions, loaded images or text rendering.
const styles = readFileSync(
  new URL("../src/styles.css", import.meta.url),
  "utf8",
);
const scene = readFileSync(
  new URL("../src/components/kilo/base-scene.css", import.meta.url),
  "utf8",
);
const dock = readFileSync(
  new URL("../src/components/kilo/base-dock.css", import.meta.url),
  "utf8",
);
assert.doesNotMatch(
  styles + scene,
  /\.kk-stage[^{}]*:has\([^)]*data-layout[^)]*\)[^{}]*\{[^}]*padding/s,
  "stage padding must not depend on the layout it is being measured to choose",
);
const stagePaddingRules = [
  ...(styles + scene).matchAll(/([^{}]+)\{([^{}]*)\}/g),
].filter(
  ([, selector, body]) =>
    selector.includes(".kk-stage") && /\bpadding(?:-[a-z]+)?:/.test(body),
);
assert.equal(
  stagePaddingRules.length,
  2,
  "only the desktop and viewport-width phone inset policies may change stage padding; remove legacy short-landscape overrides",
);
assert.match(
  scene,
  /place-items:\s*safe center/,
  "oversized scenes must stay scroll-accessible",
);
assert.match(
  dock,
  /\.kk-app\s+\.kk-shell\[data-layout\]\s+\.kk-console\s*\{[^}]*margin:\s*0\s*;/s,
  "explicit gap replaces hidden console margins",
);
assert.match(
  styles,
  /row-gap:\s*var\(--dock-gap\)/,
  "shell must use the measured gap",
);
console.log(
  `PASS: ${checks.toLocaleString()} geometry checks; ${shortViewportChecks.toLocaleString()} genuinely short cases use the declared minimum-height fallback. Normal/review headers, safe areas, breakpoints and CSS regression guards covered. This is not browser visual QA.`,
);
