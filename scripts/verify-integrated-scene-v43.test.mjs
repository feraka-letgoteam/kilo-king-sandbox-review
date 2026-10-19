import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { fitGameLayout } from "../src/components/kilo/layout.ts";
import * as model from "../src/components/kilo/integrated-scene-model.ts";
import * as atmosphere from "../src/components/kilo/scene-atmosphere.ts";

const require = createRequire(import.meta.url);
const rendererPath = new URL(
  "../src/components/kilo/IntegratedScene.tsx",
  import.meta.url,
);

/** Evaluate the actual exported decoder with a controllable Image implementation.
 * This exercises deduplication, decode readiness, failures and LRU races without
 * requiring browser automation or a running server. No component is simulated. */
async function withDecoder(run) {
  const oldImage = Object.getOwnPropertyDescriptor(globalThis, "Image");
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const images = [];
  const timers = new Map();
  let timerId = 0;
  class ControlledImage {
    complete = false;
    naturalWidth = 0;
    naturalHeight = 0;
    onload = null;
    onerror = null;
    decodeFailure = false;
    constructor() {
      images.push(this);
    }
    set src(value) {
      this.url = value;
    }
    get src() {
      return this.url;
    }
    decode() {
      return this.decodeFailure
        ? Promise.reject(new Error("decode"))
        : Promise.resolve();
    }
    load() {
      this.complete = true;
      this.naturalWidth = 1920;
      this.naturalHeight = 1080;
      this.onload?.();
    }
    fail() {
      this.onerror?.();
    }
  }
  globalThis.Image = ControlledImage;
  globalThis.window = {
    setTimeout: (callback) => {
      const id = ++timerId;
      timers.set(id, callback);
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  try {
    const compiled = ts.transpileModule(fs.readFileSync(rendererPath, "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText;
    const module = { exports: {} };
    const localRequire = (id) => {
      if (id === "./integrated-scene-model") return model;
      if (id === "./scene-atmosphere") return atmosphere;
      if (id === "./scene-system")
        return {
          SCENE_PORTRAIT_MEDIA:
            "(max-width: 620px) and (orientation: portrait)",
        };
      if (id.endsWith(".css")) return {};
      return require(id);
    };
    new Function("require", "module", "exports", compiled)(
      localRequire,
      module,
      module.exports,
    );
    await run({
      preload: module.exports.preloadIntegratedScene,
      preloadBase: module.exports.preloadIntegratedBase,
      images,
      timers,
    });
  } finally {
    if (oldImage) Object.defineProperty(globalThis, "Image", oldImage);
    else delete globalThis.Image;
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else delete globalThis.window;
  }
}

test("registered opening follows unchanged reels at target sizes and compact popouts", () => {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [360, 800],
    [844, 390],
    [620, 320],
  ]) {
    const layout = fitGameLayout(width - 24, height - 24);
    const frozen = structuredClone(layout);
    const camera = model.integratedSceneCamera(layout);
    const opening = camera.master.opening;
    const reelLeft =
      layout.mode === "landscape" && !layout.compact
        ? layout.controlLeft + layout.dockGap
        : layout.artLeft;
    assert.ok(
      Math.abs(camera.left + opening.x * camera.scale - reelLeft) < 1e-8,
    );
    assert.ok(
      Math.abs(camera.top + opening.y * camera.scale - layout.header) < 1e-8,
    );
    assert.ok(Math.abs(opening.width * camera.scale - layout.reelWidth) < 1e-8);
    // The original landscape width is integer-floored; supplied portrait
    // master opening is rounded. Both keep their existing subpixel residual.
    assert.ok(Math.abs(opening.height * camera.scale - layout.reelHeight) < 1);
    assert.deepEqual(layout, frozen);
  }
});

test("retained wide art keeps a wide camera during a portrait resize", () => {
  const phone = fitGameLayout(366, 820);
  const retained = model.integratedSceneCamera(phone, { portrait: false });
  const next = model.integratedSceneCamera(phone, { portrait: true });
  assert.equal(retained.master.width / retained.master.height, 1920 / 1080);
  assert.equal(next.master.width / next.master.height, 1080 / 2400);
  for (const camera of [retained, next]) {
    assert.equal(
      camera.left + camera.master.opening.x * camera.scale,
      phone.artLeft,
    );
    assert.equal(
      camera.top + camera.master.opening.y * camera.scale,
      phone.header,
    );
  }
});

test("stale 3D eyelid drawing is not enabled for the illustrated master", () => {
  assert.equal(
    model.INTEGRATED_SCENES.base.desktopBlink.requiresCharacterLayer,
    true,
  );
  assert.equal(
    model.INTEGRATED_SCENES.base.portraitBlink.requiresCharacterLayer,
    true,
  );
  assert.ok(
    !fs
      .readFileSync(
        new URL(
          "../src/components/kilo/integrated-scene-model.ts",
          import.meta.url,
        ),
        "utf8",
      )
      .includes("base-blink.webp"),
  );
});

test("actual portrait source ratios retain the same reel anchor without fill compression", () => {
  const phone = fitGameLayout(366, 820);
  for (const sourceSize of [
    { width: 768, height: 1800 },
    { width: 768, height: 1708 },
  ]) {
    const framed = model.integratedSceneCamera(phone, {
      portrait: true,
      sourceSize,
    });
    assert.ok(
      Math.abs(
        framed.width / framed.height - sourceSize.width / sourceSize.height,
      ) < 1e-12,
    );
    assert.equal(framed.left + framed.master.opening.x * framed.scale, 0);
    assert.equal(
      framed.top + framed.master.opening.y * framed.scale,
      phone.header,
    );
    assert.equal(framed.master.opening.width * framed.scale, phone.reelWidth);
  }
});

test("optional articulated motion stays bounded, finite and reduced-motion safe", () => {
  const rig = model.INTEGRATED_SCENES.base.desktopCharacter;
  assert.equal(rig.registered, true);
  assert.deepEqual(
    rig.bones.map((bone) => bone.id),
    ["head", "reelArm"],
  );
  assert.equal(rig.contactShadows.length, 2);
  const placement = model.integratedCharacterRegistration(rig);
  const soleY = ((817 / 941) * placement.scale + placement.top) * 941;
  assert.ok(Math.abs(soleY - 770.3) < 1e-8);
  for (const bone of ["head", "reelArm"]) {
    const limit = bone === "head" ? 0.6 : 1;
    for (const pose of ["idle", "cast", "cheer", "slump"]) {
      for (let elapsed = 0; elapsed < 10000; elapsed += 17) {
        const angle = model.integratedCharacterAngle(
          bone,
          elapsed,
          pose,
          elapsed % 1200,
        );
        assert.ok(Number.isFinite(angle) && Math.abs(angle) <= limit);
        assert.equal(
          model.integratedCharacterAngle(bone, elapsed, pose, 200, true),
          0,
        );
      }
      assert.equal(
        model.integratedCharacterAngle(bone, 1600, pose, 1600),
        model.integratedCharacterAngle(bone, 1600, "idle"),
      );
    }
  }
});

test("plate requests deduplicate and resolve only after usable image preparation", () =>
  withDecoder(async ({ preload, images, timers }) => {
    const first = preload("base");
    const second = preload("base");
    assert.equal(first, second);
    assert.equal(images.length, 1);
    let resolved = false;
    void first.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    assert.equal(resolved, false);
    images[0].load();
    const decoded = await first;
    assert.equal(decoded.scene, "base");
    assert.equal(decoded.portrait, false);
    assert.equal(decoded.image, images[0]);
    assert.equal(timers.size, 0);
    const portrait = preload("base", { portrait: true });
    assert.equal(images.length, 2);
    images[1].load();
    assert.equal((await portrait).url, "/kilo-scenes-v43/base-portrait.webp");
  }));

test("cloud drift remains bounded and continuous at the required playing sizes", () => {
  for (const [definition, worldWidth] of [
    [model.INTEGRATED_SCENES.base.desktopClouds, 1633],
    [model.INTEGRATED_SCENES.base.portraitClouds, 412],
  ]) {
    const peakSpeed =
      (definition.driftRange * Math.PI * worldWidth) /
      (definition.driftPeriodMs / 1000);
    assert.ok(peakSpeed >= 0.5 && peakSpeed <= 0.8);
    for (
      let elapsed = 0;
      elapsed < definition.driftPeriodMs * 2;
      elapsed += 1001
    ) {
      const shift = model.integratedCloudOffset(elapsed, definition);
      assert.ok(shift <= 0 && shift >= -definition.driftRange);
    }
    assert.ok(
      Math.abs(
        model.integratedCloudOffset(0, definition) -
          model.integratedCloudOffset(definition.driftPeriodMs, definition),
      ) < 1e-12,
    );
  }
});

test("failed requests can retry and usable older decoders retain their image", () =>
  withDecoder(async ({ preload, images }) => {
    const failed = preload("base");
    const rejection = assert.rejects(failed, /Scene loading failed/);
    images[0].fail();
    await rejection;
    const retry = preload("base");
    assert.equal(images.length, 2);
    images[1].decodeFailure = true;
    images[1].load();
    assert.equal((await retry).image, images[1]);
  }));

test("boot presentation pack waits for registered actor and cloud layers before becoming ready", () =>
  withDecoder(async ({ preloadBase, images }) => {
    const pack = preloadBase();
    let ready = false;
    void pack.then(() => {
      ready = true;
    });
    images[0].load();
    await new Promise(setImmediate);
    assert.equal(images.length, 3);
    assert.ok(images[1].url.endsWith("/base-clean.webp"));
    assert.ok(images[2].url.endsWith("/base-actor.webp"));
    images[1].load();
    await new Promise(setImmediate);
    assert.equal(ready, false);
    images[2].load();
    await new Promise(setImmediate);
    assert.equal(images.length, 5);
    assert.ok(images[3].url.endsWith("/base-sky-clean.webp"));
    assert.ok(images[4].url.endsWith("/base-clouds.webp"));
    images[3].load();
    await new Promise(setImmediate);
    assert.equal(ready, false);
    images[4].load();
    assert.equal((await pack).scene, "base");
    assert.equal(ready, true);
  }));

test("a failed cloud pack retains a usable complete illustration", () =>
  withDecoder(async ({ preloadBase, images }) => {
    const pack = preloadBase();
    images[0].load();
    await new Promise(setImmediate);
    images[1].load();
    images[2].load();
    await new Promise(setImmediate);
    images[3].load();
    images[4].fail();
    const fallback = await pack;
    assert.equal(fallback.image, images[0]);
    assert.equal(fallback.url, "/kilo-scenes-v43/base.webp");
  }));

test("a failed registered pair keeps the complete original boot illustration usable", () =>
  withDecoder(async ({ preloadBase, images }) => {
    const pack = preloadBase();
    images[0].load();
    await new Promise(setImmediate);
    images[1].fail();
    images[2].load();
    const fallback = await pack;
    assert.equal(fallback.image, images[0]);
    assert.equal(fallback.url, "/kilo-scenes-v43/base.webp");
  }));

test("an evicted old request failing cannot evict its newer replacement", () =>
  withDecoder(async ({ preload, images }) => {
    const old = preload("base");
    const caughtOld = old.catch(() => null);
    const otherScenes = [
      "loading",
      "scatter-3",
      "scatter-4",
      "scatter-5",
      "chopper",
      "mystery",
      "god-mode",
      "max-win",
    ];
    const others = otherScenes.map((scene) => preload(scene));
    const replacement = preload("base");
    assert.equal(images.length, 10);
    images[0].fail();
    await caughtOld;
    assert.equal(preload("base"), replacement);
    for (const image of images.slice(1)) image.load();
    await Promise.all([...others, replacement]);
  }));
