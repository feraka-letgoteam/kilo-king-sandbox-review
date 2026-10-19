import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import {
  ASSETS,
  RIG,
  CLIPS,
  MARINA,
  motionAt,
  reactionAt,
  drawFisherman,
  drawMarina,
} from "../public/kilo-motion-v18/motion.mjs";
import { collectorAtlas } from "../src/components/kilo/motion-atlas.ts";
const require = createRequire(import.meta.url);
const { createCanvas, loadImage } = require(
  require.resolve("@napi-rs/canvas", {
    paths: [process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || process.cwd()],
  }),
);
const sharp = require(
  require.resolve("sharp", {
    paths: [process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || process.cwd()],
  }),
);
const dir = path.resolve("public/kilo-motion-v18");
const assets = {};
let assetBytes = 0;
for (const [name, url] of Object.entries(ASSETS)) {
  const p = path.resolve("public" + url),
    meta = await sharp(p).metadata();
  assetBytes += (await fs.stat(p)).size;
  assert(meta.width > 0 && meta.height > 0, name);
  if (name !== "marina-clean.webp")
    assert(meta.hasAlpha, `${name} has genuine alpha`);
  assets[name] = await loadImage(p);
}
let sampledPoses = 0;
for (const pose of ["idle", "cast", "cheer", "slump"])
  for (let t = 0; t <= 5000; t += 10) {
    const sample = motionAt(pose, t);
    for (const value of Object.values(sample))
      if (typeof value === "number") assert(Number.isFinite(value));
    assert.deepEqual(motionAt(pose, t, true), motionAt("idle", 0, true));
    sampledPoses++;
  }
for (const pose of ["cast", "cheer", "slump"])
  assert.deepEqual(motionAt(pose, CLIPS[pose].duration), motionAt("idle", 0));
for (const kind of ["collector", "package", "scatter"])
  for (const time of [-1, NaN, Infinity, 800, 1e9])
    assert.equal(reactionAt(kind, time).alpha, 0);
for (let time = 0; time < 800; time++)
  assert.equal(
    reactionAt("collector", time).frame,
    collectorAtlas.sequence[Math.floor(time / collectorAtlas.frameMs)],
  );
assert.equal(collectorAtlas.sequence.length * collectorAtlas.frameMs, 800);
const base = createCanvas(768, 1152),
  ctx = base.getContext("2d");
const render = (pose, t, reduced = false) => {
  ctx.clearRect(0, 0, 768, 1152);
  ctx.save();
  ctx.scale(0.5, 0.5);
  drawFisherman(ctx, assets, { pose, elapsed: t, reduced });
  ctx.restore();
  return Buffer.from(ctx.getImageData(0, 700, 768, 400).data);
};
const feet = render("idle", 0);
let fixedFootFrames = 0;
for (const pose of ["cast", "cheer", "slump"])
  for (let time = 0; time <= CLIPS[pose].duration; time += 50) {
    assert.deepEqual(render(pose, time), feet, `${pose} feet at ${time}ms`);
    fixedFootFrames++;
  }
let viewChecks = 0;
for (const [width, height] of [
  [320, 568],
  [390, 844],
  [844, 390],
  [1440, 900],
  [1920, 1080],
]) {
  const c = createCanvas(width, height),
    g = c.getContext("2d");
  drawMarina(g, assets, width, height, 0, true);
  const a = c.toBuffer("image/png");
  g.clearRect(0, 0, width, height);
  drawMarina(g, assets, width, height, 3600, true);
  assert.deepEqual(
    c.toBuffer("image/png"),
    a,
    "Reduced-motion marina remains static",
  );
  g.clearRect(0, 0, width, height);
  drawMarina(g, assets, width, height, 3600, false);
  assert.notDeepEqual(
    c.toBuffer("image/png"),
    a,
    "Layered marina changes under normal motion",
  );
  viewChecks++;
}
let symbolChecks = 0;
for (const size of [72, 98, 158, 210])
  for (const kind of ["package", "scatter"])
    for (let t = 0; t <= 420; t += 10) {
      const r = reactionAt(kind, t),
        w = size * (kind === "package" ? 0.18 : r.scale),
        x = size * r.x,
        y = size * (kind === "package" ? 0.34 : 0.25);
      if (r.alpha > 0) {
        assert(x - w / 2 >= 0 && x + w / 2 <= size);
        assert(
          y - w / 2 >= 0 && y + w / 2 < size * 0.72,
          "Highlight clears stationary label zone",
        );
      }
      symbolChecks++;
    }
const hierarchy = {
  legs: null,
  torso: null,
  head: "torso",
  leftUpper: "torso",
  leftFore: "leftUpper",
  rightUpper: "torso",
  rightFore: "rightUpper",
  rod: "rightFore",
};
await fs.writeFile(
  path.join(dir, "rig-manifest.json"),
  JSON.stringify(
    {
      version: 18,
      format: "Kilo Canvas2D authoring manifest; not a Spine export",
      coordinateSystem: "source pixels / top-left",
      rig: RIG,
      hierarchy,
      clips: CLIPS,
      animationSource: "motion.mjs",
      marina: MARINA,
      assets: ASSETS,
      limits: { fps: 24, marinaPixels: 680000, fishermanPixels: 600000 },
      integration: {
        fisherman: "FishermanScene pose/tick",
        marina: "MarinaBackdrop decorative clock",
        collector: "existing collect() reaction slot",
        package: "existing 420ms acknowledgement",
        scatter: "recorded standing board; no extra awaited delay",
      },
    },
    null,
    2,
  ) + "\n",
);
const report = {
  assetCount: Object.keys(assets).length,
  assetBytes,
  sampledPoses,
  fixedFootFrames,
  marinaViewports: viewChecks,
  symbolPlacementChecks: symbolChecks,
  collectorTimingChecks: 800,
  browserQA: false,
};
await fs.writeFile(
  path.join(dir, "validation.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log("PASS", JSON.stringify(report));
