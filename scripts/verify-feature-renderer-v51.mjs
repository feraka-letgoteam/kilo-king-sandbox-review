// Runs the production effect controller with instrumented display objects.
// This verifies sequencing, cleanup and geometry; it is not browser/GPU QA.
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import {
  connectionAnchor,
  connectionValue,
} from "../src/components/kilo/connection-win.ts";
import { fitGameLayout } from "../src/components/kilo/layout.ts";
const source = fs.readFileSync(
  "src/components/kilo/feature-effects.ts",
  "utf8",
);
const stage = fs.readFileSync("src/components/kilo/pixiStage.ts", "utf8");
function declaration(text, name) {
  const tree = ts.createSourceFile("s.ts", text, ts.ScriptTarget.Latest, true);
  let found;
  function visit(n) {
    if (ts.isFunctionDeclaration(n) && n.name?.getText(tree) === name)
      found = n;
    ts.forEachChild(n, visit);
  }
  visit(tree);
  assert(found);
  return found.getText(tree);
}
const js = (s) =>
  ts.transpile(s, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
  });
const fitReels = new Function(
  js(
    ["edgeFor", "frameBorders", "fitReels"]
      .map((n) => declaration(stage, n))
      .join("\n"),
  ) + ";return fitReels;",
)();
const geometries = [
  [1440, 900],
  [390, 844],
  [360, 800],
  [844, 390],
].map(([w, h]) => {
  const pad = w < 900 ? 12 : 24,
    l = fitGameLayout(w - pad * 2, h - pad * 2);
  return {
    viewport: [w, h],
    ...fitReels(Math.round(l.reelWidth), Math.round(l.reelHeight)),
  };
});
const point = () => ({
  x: 0,
  y: 0,
  set(x, y = x) {
    this.x = x;
    this.y = y;
  },
});
class Container {
  constructor() {
    this.children = [];
    this.position = point();
    this.scale = point();
    this.scale.set(1);
    this.alpha = 1;
    this.visible = true;
    this.destroyed = false;
  }
  addChild(...nodes) {
    for (const n of nodes) {
      n.parent = this;
      this.children.push(n);
    }
    return nodes[0];
  }
  addChildAt(n, i) {
    n.parent = this;
    this.children.splice(i, 0, n);
    return n;
  }
  removeChildren() {
    const old = this.children;
    this.children = [];
    old.forEach((n) => (n.parent = null));
    return old;
  }
  destroy() {
    this.destroyed = true;
    this.removeChildren().forEach((n) => n.destroy());
    if (this.parent)
      this.parent.children = this.parent.children.filter((n) => n !== this);
  }
  get width() {
    return this._width ?? Math.max(0, ...this.children.map((c) => c.width));
  }
  set width(v) {
    this._width = v;
  }
  get height() {
    return this._height ?? Math.max(0, ...this.children.map((c) => c.height));
  }
  set height(v) {
    this._height = v;
  }
}
class Graphics extends Container {
  rect() {
    return this;
  }
  roundRect() {
    return this;
  }
  fill() {
    return this;
  }
  stroke() {
    return this;
  }
  circle() {
    return this;
  }
  ellipse() {
    return this;
  }
  poly() {
    return this;
  }
  moveTo() {
    return this;
  }
  lineTo() {
    return this;
  }
  clear() {
    return this;
  }
}
class Text extends Container {
  constructor({ text, style }) {
    super();
    this.text = text;
    this.style = style;
    this.anchor = point();
  }
  get width() {
    return String(this.text).length * Number(this.style.fontSize) * 0.62;
  }
  get height() {
    return Number(this.style.fontSize) * 1.3;
  }
}
class Sprite extends Container {
  constructor(texture) {
    super();
    this.texture = texture;
    this.anchor = point();
  }
}
class Texture {
  constructor(o) {
    Object.assign(this, o);
  }
  destroy() {}
}
class Rectangle {
  constructor(x, y, w, h) {
    Object.assign(this, { x, y, width: w, height: h });
  }
}
const exports = {};
new Function("require", "exports", js(source))(
  (id) =>
    id === "pixi.js"
      ? {
          Container,
          Graphics,
          Text,
          Sprite,
          Texture,
          Rectangle,
          Assets: { load: async () => ({ source: {} }) },
        }
      : id === "./connection-win"
        ? { connectionAnchor }
        : assert.fail(id),
  exports,
);
const examples = JSON.parse(
  fs.readFileSync("art/kilo-features-v51/playable-examples.json", "utf8"),
);
const maximumExamples=JSON.parse(fs.readFileSync('art/kilo-features-v51/maximum-feature-examples.json','utf8'));
const cases = [...Object.values(examples),...Object.values(maximumExamples)]
  .flatMap((s) => s.free.map((f) => f.mechanic))
  .filter((e) => e && (e.kind !== "dock" || e.credited === 0));
let runs = 0,
  skips = 0,
  resizes = 0,
  transfers = 0;
const actions = new Set();
for (const speed of ["normal", "turbo", "super"])
  for (const reduced of [false, true])
    for (const initial of geometries)
      for (const change of ["none", "resize", "skip"]) {
        for (const e of cases) {
          let geom = { ...initial },
            live = true,
            frames = 0,
            changed = false,
            bankCount = 0,
            dom = [];
          const host = new EventTarget(),
            world = new Container();
          globalThis.document = {
            body: { appendChild: (node) => dom.push(node) },
            createElement: () => ({
              style: {},
              offsetHeight: 34,
              setAttribute() {},
              remove() {
                dom = dom.filter((n) => n !== this);
              },
            }),
          };
          let controller;
          const inspect = () => {
            for (const node of dom) {
              if (Number(node.style.opacity) > 0) {
                assert(Number.parseFloat(node.style.top) + 17 <= geom.dh + 111);
                transfers++;
              }
            }
          };
          const adapter = {
            host,
            world,
            geom: () => geom,
            cell: (c, size) => {
              const n = new Container();
              n.width = size;
              n.height = size;
              return n;
            },
            stake: () => 1000,
            pace: () => ({ speed, reduced }),
            live: () => live,
            readout() {},
            screen: (x, y) => ({ x, y }),
            landing: () => ({ x: geom.dw / 2, y: geom.dh + 75 }),
            bankCue: (v, capped) => {
              assert.equal(v, e.credited);
              assert.equal(capped, e.beforeCap > e.credited);
              bankCount++;
              assert.equal(dom.length, 0, "flyer removed before bank cue");
            },
            hold: async () => {},
            tween: async (ms, paint) => {
              for (const t of reduced ? [1] : [0, 0.25, 0.5, 0.75, 1]) {
                frames++;
                paint(t);
                inspect();
                if (!changed && frames >= 2 && change !== "none") {
                  changed = true;
                  if (change === "resize") {
                    geom =
                      initial.viewport[0] > 800 ? geometries[2] : geometries[0];
                    host.dispatchEvent(new Event("kilo-relayout"));
                    resizes++;
                  } else {
                    live = false;
                    controller.cancel();
                    skips++;
                  }
                }
                await Promise.resolve();
              }
            },
          };
          controller = exports.createFeatureEffects(adapter);
          await Promise.resolve();
          await Promise.resolve();
          controller.set(e, "before");
          const before = JSON.stringify(e);
          await controller.step(e);
          assert.equal(
            JSON.stringify(e),
            before,
            "animation mutated recorded event",
          );
          assert.equal(dom.length, 0, "transfer leak");
          if (change === "skip" && changed)
            assert.equal(bankCount, 0, "interruption cannot emit bank");
          else
            assert.equal(
              bankCount,
              e.credited > 0 ? 1 : 0,
              "one bank event per credited award",
            );
          controller.destroy();
          assert(
            world.children.every((c) => c.destroyed),
            "effect roots remain after destruction",
          );
          actions.add(e.action);
          runs++;
        }
      }
for (const g of geometries)
  for (const cells of [
    [{ reel: 0, row: 0 }],
    [{ reel: 4, row: 2 }],
    [
      { reel: 0, row: 0 },
      { reel: 1, row: 1 },
      { reel: 2, row: 2 },
    ],
  ]) {
    const width = Math.max(20, g.cell * 0.29) * 0.62 * 9,
      height = 38,
      at = connectionAnchor(cells, g, width, height);
    assert(
      at.x - width / 2 >= g.gx &&
        at.x + width / 2 <= g.gx + g.cell * 5 + g.gap * 4,
    );
    assert(at.y - height / 2 >= g.gy && at.y + height / 2 <= g.gy + g.cell * 3);
  }
assert.equal(connectionValue(48000, 0), 0);
assert.equal(connectionValue(48000, 1), 48000);
assert.equal(connectionValue(48000, 2), 48000);
const result = {
  runs,
  skips,
  resizes,
  transferFrames: transfers,
  actions: [...actions],
  maximumAwardTested:Math.max(...cases.map(e=>e.credited)),
  maximumRawAwardTested:Math.max(...cases.map(e=>e.beforeCap)),
  viewports: geometries.map((g) => g.viewport),
  method:
    "Production feature effects executed with instrumented Pixi objects, conservative text metrics and injected resize/Skip. No browser, GPU, screenshots or frame-rate verification.",
};
fs.writeFileSync(
  "art/kilo-features-v51/renderer-verification.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  `PASS ${runs} effect sequences; ${resizes} resizes; ${skips} interruptions; exact bank cues, cleanup and bounded local win anchors.`,
);
