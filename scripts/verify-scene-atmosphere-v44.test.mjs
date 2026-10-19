import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";
import {
  integratedBirdOutline,
  integratedBirdPose,
  integratedLightOpacity,
  integratedSceneAtmosphere,
} from "../src/components/kilo/scene-atmosphere.ts";

test("birds occupy the authored clear sky and remain clear of the character and lights", () => {
  for (const portrait of [false, true]) {
    const definition = integratedSceneAtmosphere("base", portrait);
    assert.equal(definition.birds.length, 2);
    const sky = portrait
      ? { left: -.06, right: .86, top: .025, bottom: .115 }
      : { left: -.04, right: .5, top: .02, bottom: .1 };
    for (const bird of definition.birds) {
      assert.ok(bird.cycleMs > bird.flightMs + 10_000);
      assert.ok(bird.flapMs >= 1000);
      for (let time = 0; time < bird.cycleMs * 2; time += 71) {
        const pose = integratedBirdPose(time, bird);
        assert.ok(pose.x >= sky.left && pose.x <= sky.right);
        assert.ok(pose.y >= sky.top && pose.y <= sky.bottom);
        assert.ok(pose.opacity >= 0 && pose.opacity <= .84);
        assert.ok(Number.isFinite(pose.flap));
        assert.equal(integratedBirdPose(time, bird, true).opacity, 0);
      }
      assert.equal(integratedBirdPose(bird.delayMs - 1, bird).opacity, 0);
      assert.equal(integratedBirdPose(bird.delayMs + bird.flightMs, bird).opacity, 0);
      assert.deepEqual(integratedBirdPose(7000, bird), integratedBirdPose(7000, bird));
    }
  }
});

test("wing outlines articulate independently of path translation", () => {
  const high = integratedBirdOutline(-1);
  const low = integratedBirdOutline(1);
  assert.notEqual(high, low);
  assert.ok(high.startsWith("M-12,") && low.startsWith("M-12,"));
  assert.ok(high.endsWith("Z") && low.endsWith("Z"));
  assert.equal(integratedBirdOutline(-100), high);
  assert.equal(integratedBirdOutline(100), low);
});

test("native SVG parsing draws the complete left and right wing silhouette", async () => {
  const sharp = createRequire(import.meta.url)("sharp");
  for (const flap of [-1, 0, 1]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="200" viewBox="-14 -10 28 20"><path d="${integratedBirdOutline(flap)}" fill="#fff"/></svg>`;
    const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let left = info.width;
    let right = 0;
    let top = info.height;
    let bottom = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 1) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    assert.ok(left <= 35 && right >= 245, "both articulated wings must draw");
    assert.ok(bottom - top >= 25 && bottom - top <= 100);
  }
});

test("fitted lights retain source coordinates and only slow bounded brightening", () => {
  const desktop = integratedSceneAtmosphere("base", false);
  const portrait = integratedSceneAtmosphere("base", true);
  assert.deepEqual(desktop.lights[0].center, [1302 / 1920, 12 / 1080]);
  assert.deepEqual(desktop.lights[1].center, [1086 / 1920, 53 / 1080]);
  assert.deepEqual(portrait.lights[0].center, [677 / 768, 356 / 1708]);
  assert.deepEqual(portrait.lights[1].center, [521 / 768, 452 / 1708]);
  for (const definition of [desktop, portrait]) {
    for (const light of definition.lights) {
      assert.ok(light.periodMs >= 7300);
      assert.ok(light.maxOpacity <= (light.kind === "beacon" ? .8 : .12));
      const points = light.polygon ?? [light.center];
      points.forEach(([x, y]) => assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1));
      for (let time = 0; time < light.periodMs * 2; time += 41) {
        const opacity = integratedLightOpacity(time, light);
        assert.ok(opacity >= 0 && opacity <= light.maxOpacity);
        assert.equal(integratedLightOpacity(time, light, true), 0);
        // Neighboring frame changes are smooth; no rapid flashes or strobe.
        assert.ok(Math.abs(integratedLightOpacity(time + 16, light) - opacity) < .02);
      }
    }
  }
});

test("unfitted locations never receive generic lights or a repeated bird overlay", () => {
  for (const scene of ["loading", "scatter-3", "scatter-4", "scatter-5", "chopper", "completion", "mystery", "god-mode", "max-win"]) {
    assert.equal(integratedSceneAtmosphere(scene, false), null);
    assert.equal(integratedSceneAtmosphere(scene, true), null);
  }
});

test("atmosphere uses the registered plane and existing paused visibility-safe clock", () => {
  const source = fs.readFileSync(new URL("../src/components/kilo/IntegratedScene.tsx", import.meta.url), "utf8");
  assert.ok(source.includes("outgoingAtmosphere.current"));
  assert.ok(source.includes("if (liveAtmosphere.current) liveAtmosphere.current.elapsed = elapsed"));
  assert.ok(source.includes("!paused && !document.hidden && inView"));
  assert.ok(source.includes("integratedBirdPose(elapsed, bird, reducedMotion)"));
  assert.ok(source.includes("stageSize,"));
  assert.ok(!fs.readFileSync(new URL("../src/components/kilo/scene-atmosphere.ts", import.meta.url), "utf8").match(/wallet|settlement|setTimeout|setInterval|requestAnimationFrame/));
});
