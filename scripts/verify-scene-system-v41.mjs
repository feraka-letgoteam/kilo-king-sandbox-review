// Source/production-CSS verification only. This script never launches a browser.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import postcss from "postcss";
import {
  SCENES,
  SCENE_SPRITES,
  sceneForRound,
  phaseForPresentation,
  sceneAssetUrls,
  preloadScene,
  preloadScenes,
  ENVIRONMENT_FRAME_MS,
  ENVIRONMENT_MAX_PIXELS,
} from "../src/components/kilo/scene-system.ts";
import { fitGameLayout } from "../src/components/kilo/layout.ts";
import {
  createControlLayout,
  controlTargets,
} from "../src/components/slot-controls/layout.ts";
import {
  prepareTree,
  productionCascade,
  resolveTree,
  variables,
} from "./control-css-cascade.mjs";

const checkpoint = "16e9f4050bcbd6c162733129480f8287477a9c93";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const protectedPaths = [
  "src/lib/kilo/engine.ts",
  "src/lib/kilo/bank.ts",
  "src/components/kilo/director.ts",
  "src/components/kilo/pixiStage.ts",
  "src/components/kilo/ReelStage.tsx",
  "src/components/kilo/layout.ts",
  "src/components/kilo/control-model.ts",
  "src/components/kilo/auto-spins.ts",
  "src/components/kilo/modular-controls.css",
  "src/components/slot-controls/SlotControls.tsx",
  "src/components/slot-controls/controls.css",
  "src/components/slot-controls/layout.ts",
  "src/components/slot-controls/tokens.ts",
];
const protectedSources = {};
for (const path of protectedPaths) {
  const before = execFileSync("git", ["show", `${checkpoint}:${path}`]);
  const after = readFileSync(path);
  assert.equal(
    sha(after),
    sha(before),
    `Protected gameplay/geometry source changed: ${path}`,
  );
  protectedSources[path] = sha(after);
}

const cases = [];
const makeRound = (mode, scatters, awarded, free = [{}]) => ({
  mode,
  base: { scatters },
  awarded,
  free,
});
for (const [name, round, expected] of [
  ["base", makeRound("spin", 2, 0, []), "base"],
  ["three natural", makeRound("spin", 3, 10), "scatter-3"],
  ["three plus extra spins", makeRound("ante", 3, 12), "scatter-3"],
  ["four natural", makeRound("spin", 4, 15), "scatter-4"],
  ["four plus extra spins", makeRound("ante", 4, 17), "scatter-4"],
  ["five natural", makeRound("spin", 5, 20), "scatter-5"],
  ["five plus extra spins", makeRound("ante", 5, 22), "scatter-5"],
  ["purchased free spins", makeRound("buy", 3, 12), "scatter-3"],
  ["Chopper precedence", makeRound("chopper", 5, 12), "chopper"],
  [
    "cap does not activate preview mode",
    { ...makeRound("spin", 5, 20), capped: true },
    "scatter-5",
  ],
  ["no round", null, "base"],
]) {
  assert.equal(sceneForRound(round), expected, name);
  cases.push({ name, scene: expected });
}
const fixtures = Object.values(
  JSON.parse(readFileSync("src/lib/kilo/fixtures.json", "utf8")),
);
for (const fixture of fixtures) {
  const r = fixture.script;
  const expected = !r.free.length
    ? "base"
    : r.mode === "chopper"
      ? "chopper"
      : r.mode === "buy"
        ? "scatter-3"
        : r.base.scatters >= 5
          ? "scatter-5"
          : r.base.scatters >= 4
            ? "scatter-4"
            : "scatter-3";
  assert.equal(sceneForRound(r), expected, fixture.id);
}
const script = makeRound("spin", 4, 17);
const state = {
  booted: true,
  summary: null,
  hud: { active: true, note: "17 free spins · starts at ×2" },
  round: script,
};
for (const [name, input, expected] of [
  ["entry before intro", state, "entry"],
  [
    "feature spin",
    { ...state, hud: { active: true, note: "Free spin" } },
    "feature",
  ],
  [
    "restored prior feature",
    { ...state, hud: { active: false, note: "Last result" } },
    "base",
  ],
  ["zero-return completion", { ...state, summary: { payout: 0 } }, "complete"],
  [
    "loading takes precedence",
    { ...state, summary: { payout: 100 }, booted: false },
    "loading",
  ],
]) {
  assert.equal(phaseForPresentation(input), expected, name);
  cases.push({ name, phase: expected });
}
assert.equal(SCENES.mystery.previewOnly, true);
assert.equal(SCENES["god-mode"].previewOnly, true);
assert.equal(SCENES["max-win"].previewOnly, true);
assert.equal(
  sceneAssetUrls("max-win", { portrait: false }).includes(
    SCENE_SPRITES.getaway,
  ),
  true,
);
assert(
  Object.values(SCENES).every(
    (scene) => !scene.desktop.lantern && !scene.phone.lantern,
  ),
  "A lantern requires an authored mounting point before it can be enabled",
);
assert(
  SCENES.base.desktop.boat.mooring && SCENES.base.phone.boat.mooring,
  "Base boat must be physically moored",
);
assert.equal(
  SCENES["scatter-4"].waterMask.length,
  0,
  "Teak deck must stay static",
);
for (const framing of [
  SCENES["scatter-4"].desktop,
  SCENES["scatter-4"].phone,
]) {
  assert.equal(
    framing.waterRegions.length,
    2,
    "Yacht needs two separate outer water windows",
  );
  assert(framing.waterRegions.every((region) => region.length >= 3));
}
assert.equal(ENVIRONMENT_FRAME_MS, 1000 / 24);
assert.equal(ENVIRONMENT_MAX_PIXELS, 680000);

// Decode lifecycle tests use a small image stub; no browser automation or remote requests.
const originalImage = globalThis.Image;
const loads = new Map();
const failures = new Set();
const stalls = new Set();
globalThis.Image = class {
  naturalWidth = 1536;
  naturalHeight = 1024;
  set src(url) {
    this.url = url;
    loads.set(url, (loads.get(url) ?? 0) + 1);
    if (stalls.has(url)) return;
    queueMicrotask(() =>
      failures.has(url) ? this.onerror?.() : this.onload?.(),
    );
  }
  get src() {
    return this.url;
  }
  decode() {
    return Promise.resolve();
  }
};
try {
  const options = { portrait: false, includeLayers: false };
  const first = await preloadScene("base", options);
  const second = await preloadScene("base", options);
  assert.equal(
    first.image,
    second.image,
    "Repeated scene should reuse decoded image",
  );
  await preloadScenes(
    Object.keys(SCENES).filter((id) => id !== "base"),
    options,
  );
  await preloadScene("base", options);
  assert.equal(
    loads.get(SCENES.base.plate),
    2,
    "Eight-item cache should evict oldest image",
  );
  failures.add(SCENES.loading.portrait);
  await assert.rejects(() =>
    preloadScene("loading", { portrait: true, includeLayers: false }),
  );
  failures.delete(SCENES.loading.portrait);
  await preloadScene("loading", { portrait: true, includeLayers: false });
  assert.equal(
    loads.get(SCENES.loading.portrait),
    2,
    "Failed image should remain retryable",
  );
  failures.add(SCENE_SPRITES.boat);
  const optional = await preloadScene("base", { portrait: true });
  assert.equal(optional.id, "base");
  assert.equal(
    optional.sprites.boat,
    undefined,
    "Failed optional boat should not block plate",
  );
  const originalTimeout = globalThis.setTimeout;
  stalls.add(SCENES.completion.portrait);
  try {
    globalThis.setTimeout = (fn, delay, ...args) =>
      originalTimeout(fn, delay === 15000 ? 1 : delay, ...args);
    await assert.rejects(
      () =>
        preloadScene("completion", { portrait: true, includeLayers: false }),
      /timed out/,
    );
  } finally {
    globalThis.setTimeout = originalTimeout;
    stalls.delete(SCENES.completion.portrait);
  }
  await preloadScene("completion", { portrait: true, includeLayers: false });
} finally {
  if (originalImage === undefined) delete globalThis.Image;
  else globalThis.Image = originalImage;
}

const source = readFileSync("src/components/kilo/EnvironmentScene.tsx", "utf8");
assert(
  source.includes("currentRef.current") &&
    source.includes("setLayers({ current: next, previous:"),
  "Decoded outgoing scene retention missing",
);
assert(
  source.includes("visibilitychange") &&
    source.includes("IntersectionObserver") &&
    source.includes("!document.hidden"),
);
assert(source.includes("!reducedMotion && !paused"));
assert(source.includes("setTimeout(tick, ENVIRONMENT_FRAME_MS)"));
assert(
  source.includes("Math.sqrt(ENVIRONMENT_MAX_PIXELS / (cssWidth * cssHeight))"),
);
assert(source.includes("waterRegions.length > 0"));
assert(source.includes("framing.waterMask ?? definition.waterMask"));
assert(source.includes("framing.waterline ?? definition.waterline"));
assert(source.includes("clocks.set(decoded.id, elapsedRef.current)"));
assert(source.includes("syncMotion.current?.()"));
assert(source.includes('aria-hidden="true"') && source.includes("inert"));
const environmentCss = readFileSync(
  "src/components/kilo/environment-scene.css",
  "utf8",
);
postcss.parse(environmentCss).walkRules((rule) => {
  assert(
    rule.selector
      .split(",")
      .every((selector) => selector.trim().startsWith(".kk-environment")),
    `Unscoped environment selector: ${rule.selector}`,
  );
});
assert(
  !/@keyframes/.test(environmentCss),
  "Ambient animation must use stoppable bounded timer",
);
assert(
  !/animation\s*:/.test(environmentCss),
  "No unstopped ambient CSS animations",
);

const index = readFileSync("dist/index.html", "utf8");
const cssFile = "dist" + index.match(/href="([^\"]+\.css)"/)[1];
const css = readFileSync(cssFile, "utf8");
assert(
  css.includes(".kk-environment"),
  "Build does not contain the new environment stylesheet",
);
const cascade = productionCascade(
  css
    .replaceAll(":first-of-type", ":nth-of-type(1)")
    .replace(/,\s+(?=env\()/g, ","),
);
const node = (tag, attrs = {}, children = []) => ({ tag, attrs, children });
const overlaps = (a, b) =>
  Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) + 0.01 &&
  Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y) + 0.01;
const layouts = [];
for (const viewport of [
  [360, 800],
  [390, 844],
  [844, 390],
  [1440, 900],
]) {
  for (const review of [false, true])
    for (const feature of [false, true]) {
      let percentage = 0;
      const px = (value) => {
        const expression = String(value)
          .replace(/env\(safe-area-inset-(top|right|bottom|left)\)/g, "0")
          .replace(/100d?vh/g, String(viewport[1]))
          .replace(/100vw/g, String(viewport[0]))
          .replace(/([\d.]+)%/g, (_, p) =>
            String((percentage * Number(p)) / 100),
          )
          .replace(/px/g, "")
          .replace(/calc\(/g, "(")
          .replace(/max\(/g, "Math.max(")
          .replace(/min\(/g, "Math.min(");
        assert(
          /^[\d\s.,()+\-*/]+$/.test(
            expression.replace(/Math\.(?:min|max)/g, ""),
          ),
          `Unsupported length ${value}`,
        );
        return Function(`return (${expression})`)();
      };
      const app = node("div", {
        class: "kk-app",
        "data-review": String(review),
        "data-environment": feature ? "scatter-4" : "base",
      });
      const environment = node("div", {
        class: "kk-environment",
        "data-scene": feature ? "scatter-4" : "base",
      });
      const stage = node("main", { class: "kk-stage" }, [environment]);
      app.children = [stage];
      const tree = prepareTree(node("html", {}, [node("body", {}, [app])]));
      const context = { viewport, hover: false };
      let styles = resolveTree(tree, cascade, context);
      const stageStyle = styles.get(stage).values;
      const pad = Object.fromEntries(
        ["top", "right", "bottom", "left"].map((side) => [
          side,
          px(stageStyle["padding-" + side]),
        ]),
      );
      const reviewHeight = px(styles.get(app).vars["--review-height"]);
      const availableWidth = viewport[0] - pad.left - pad.right;
      const availableHeight = viewport[1] - reviewHeight - pad.top - pad.bottom;
      const g = fitGameLayout(availableWidth, availableHeight);
      const d = createControlLayout({
        variant: g.compact
          ? "compact"
          : g.mode === "portrait"
            ? "portrait"
            : g.mode === "landscape"
              ? "landscape"
              : "desktop",
        width:
          g.mode === "landscape"
            ? g.width
            : g.mode === "portrait"
              ? g.reelWidth
              : g.artLeft
                ? availableWidth
                : g.width,
        height:
          g.mode === "wide" &&
          g.width >= 1100 &&
          g.height + 60 <= availableHeight
            ? 128
            : g.dock,
        footerWidth: g.reelWidth,
      });
      const shell = node("div", {
        class: `kk-shell${feature ? " is-feature" : ""}`,
        "data-layout": g.mode,
        "data-framing": g.artLeft ? "sides" : "header",
        style: `--game-width:${g.width}px;--game-height:${g.height + d.height - g.dock}px;--header-height:${g.header}px;--reel-width:${g.reelWidth}px;--reel-height:${g.reelHeight}px;--dock-height:${d.height}px;--dock-gap:${g.dockGap}px;--art-left:${g.artLeft}px;--art-right:${g.artRight}px;--control-left:${g.controlLeft}px;--side-width:${g.side}px;--strip-height:${g.strip}px`,
      });
      stage.children = [environment, shell];
      prepareTree(tree);
      styles = resolveTree(tree, cascade, context);
      const environmentPaint = styles.get(environment).values;
      assert.equal(environmentPaint.position, "absolute");
      assert.equal(environmentPaint["pointer-events"], "none");
      assert.equal(environmentPaint.contain, "paint");
      const targets = controlTargets(d, feature);
      for (const [name, box] of Object.entries(targets))
        assert(box.w >= 44 && box.h >= 44, `${name} target below 44px`);
      for (const [name, box] of Object.entries(targets)) {
        if (name === "spin") continue;
        assert(
          !overlaps(targets.spin, box),
          `Spin overlaps ${name} at ${viewport.join("×")}`,
        );
      }
      const shellStyle = styles.get(shell);
      const shellHeight = px(shellStyle.values.height);
      const row = {
        viewport,
        reviewHeight,
        feature,
        mode: g.mode,
        reel: { width: g.reelWidth, height: g.reelHeight },
        dockHeight: d.height,
        shellHeight,
        controls: targets,
      };
      if (g.mode === "portrait") {
        assert.equal(d.height, 160);
        const raw = cascade(shell, { ...context, pseudo: "after" });
        const vars = {
          ...shellStyle.vars,
          ...Object.fromEntries(
            Object.entries(raw.values).filter(([key]) => key.startsWith("--")),
          ),
        };
        const paint = Object.fromEntries(
          Object.entries(raw.values)
            .filter(([key]) => !key.startsWith("--"))
            .map(([key, value]) => [key, variables(value, vars)]),
        );
        percentage = shellHeight;
        const frame = {
          x: 0,
          y: reviewHeight + pad.top + px(paint.top),
          w: px(paint.width),
          h: px(paint.height),
        };
        const allocationBottom = reviewHeight + pad.top + shellHeight;
        assert(frame.y >= allocationBottom + 4 - 0.001);
        assert(frame.y + frame.h <= viewport[1] + 0.001);
        assert.equal(paint["pointer-events"], "none");
        if (feature)
          assert.equal(
            paint["background-image"],
            "none",
            "Yacht deck must not receive the base foreground overlay",
          );
        else
          assert(
            paint["background-image"].includes(
              "/kilo-portrait-v40/dock-continuation.webp",
            ),
          );
        row.portraitFraming = frame;
        row.portraitFramingPaint = paint["background-image"];
        row.framingClearance = frame.y - allocationBottom;
      }
      layouts.push(row);
    }
}
for (const base of layouts.filter((row) => !row.feature)) {
  const feature = layouts.find(
    (row) =>
      row.feature &&
      row.viewport.join() === base.viewport.join() &&
      row.reviewHeight === base.reviewHeight,
  );
  assert.deepEqual(base.reel, feature.reel);
  assert.equal(base.shellHeight, feature.shellHeight);
  assert.deepEqual(base.controls.spin, feature.controls.spin);
}

const assetUrls = new Set([
  "/kilo-scenes-v41/loading-hero.webp",
  "/kilo-scenes-v41/entry-frame.webp",
  ...Object.values(SCENE_SPRITES),
  ...Object.keys(SCENES).flatMap((id) => [
    ...sceneAssetUrls(id, { portrait: false }),
    ...sceneAssetUrls(id, { portrait: true }),
  ]),
]);
const assets = [];
for (const url of assetUrls) {
  const path = "public" + url;
  assert(existsSync(path), `Missing environment asset ${path}`);
  const bytes = readFileSync(path);
  const dimensions = execFileSync(
    "identify",
    ["-format", "%w %h %[channels]", path],
    { encoding: "utf8" },
  ).trim();
  const [width, height, channels] = dimensions.split(" ");
  if (url.includes("-portrait.webp"))
    assert(
      Number(height) > Number(width),
      `Portrait plate is not portrait: ${url}`,
    );
  assets.push({
    url,
    bytes: bytes.length,
    width: Number(width),
    height: Number(height),
    channels,
    sha256: sha(bytes),
  });
}
const report = {
  version: "v41",
  checkpoint,
  method:
    "Source checks, mocked decode lifecycle, production author CSS cascade and calculated layout. No browser screenshots or live-browser interaction claims.",
  cssFile,
  cssSha256: sha(css),
  protectedSources,
  syntheticStateCases: cases,
  recordedFixtureCases: fixtures.length,
  decodeCases: [
    "cache reuse",
    "eight-image cache eviction",
    "failure retry",
    "optional ornament failure",
    "15-second timeout and retry",
  ],
  layouts,
  assets,
  totalEnvironmentBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
};
const out = "public/kilo-scenes-v41";
mkdirSync(out, { recursive: true });
writeFileSync(
  `${out}/scene-verification.json`,
  JSON.stringify(report, null, 2) + "\n",
);
writeFileSync(
  `${out}/VERIFICATION.md`,
  `# Kilo King v41 — scene system verification\n\n${report.method}\n\n- ${cases.length} synthetic phase/tier cases and ${fixtures.length} recorded fixtures pass. Extra-spin modifiers do not change the scatter environment. Mystery, God Mode and The Getaway remain visual previews; capped outcomes do not activate The Getaway.\n- The decode cache retains at most eight image promises. Reuse, eviction, failed-load retry and optional ornament failure checks pass. The current decoded scene remains until replacement decoding completes.\n- Ambient motion is capped at 24 frames/second and 680,000 canvas pixels, stops while hidden/offscreen/paused, and becomes static with reduced motion. No ambient CSS keyframes run independently of that lifecycle.\n- The Gilded Yacht teak foreground is static and excluded from water refraction. Base boats have a fixed shore mooring and a hull-tracked rope endpoint; wake and reflection move with the hull. Free-floating lanterns are omitted pending authored mounting points.\n- ${protectedPaths.length} engine, bank, presentation, reel, control and layout sources match checkpoint ${checkpoint} byte-for-byte.\n- ${layouts.length} calculated cases cover 360×800, 390×844, 844×390 and 1440×900, base/feature, with and without the review toolbar. Spin remains separate from every other target; targets remain at least 44×44; the portrait dock remains 160px.\n- Portrait foreground remains 4px below the full control allocation and does not extend below the viewport. Reel size, shell height and Spin position remain identical between base and feature.\n- ${assets.length} runtime environment assets verified; total ${(report.totalEnvironmentBytes / 1048576).toFixed(2)} MiB across the complete catalogue. Only the active environment and likely next scenes are requested, not all states at first entry.\n\n## Remaining visual verification\n\nNo browser screenshots or interaction automation were attempted. Artwork fit and source-level safety were reviewed separately; live transition timing, image decode speed on slow devices, fine layer alignment and actual device GPU/rendering behavior still require visual playback review. This report does not claim Stake Engine certification.\n\nProduction CSS: ${cssFile}\nSHA-256: ${sha(css)}\n\nRun: node --experimental-strip-types scripts/verify-scene-system-v41.mjs\n`,
);
console.log(
  JSON.stringify({
    result: "PASS",
    stateCases: cases.length,
    fixtures: fixtures.length,
    layoutCases: layouts.length,
    assets: assets.length,
    report: `${out}/VERIFICATION.md`,
  }),
);
