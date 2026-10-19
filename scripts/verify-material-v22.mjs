import assert from "node:assert/strict";
import { acceptsSpinShortcut } from "../src/components/kilo/keyboard.ts";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fitGameLayout } from "../src/components/kilo/layout.ts";
import {
  createDockDesign,
  dockAmountSize,
  dockChargeSize,
} from "../src/components/kilo/dock-design.ts";
import { createAutoSpins } from "../src/components/kilo/auto-spins.ts";
const fonts = JSON.parse(
  execFileSync("python", [
    "-c",
    `from fontTools.ttLib import TTFont
import json
out={}
for weight in (600,700):
 f=TTFont('public/kilo-ui-v11/fonts/SourceSans3-'+str(weight)+'.woff2');c=f.getBestCmap()
 out[weight]={'em':f['head'].unitsPerEm,'width':{s:f['hmtx'][c[ord(s)]][0] for s in '0123456789,Cost'}}
print(json.dumps(out))`,
  ]).toString(),
);
const failures = [],
  screens = [],
  checks = { layouts: 0, targets: 0, overlaps: 0, amounts: 0, auto: 0 };
const overlapping = (a, b) =>
  a.x < b.x + b.w - 0.01 &&
  b.x < a.x + a.w - 0.01 &&
  a.y < b.y + b.h - 0.01 &&
  b.y < a.y + a.h - 0.01;
function audit(w, h) {
  const small = h <= 380 && w / h >= 1.4;
  const inset = small ? 16 : w <= 620 ? 24 : 32,
    fit = fitGameLayout(w - inset, h - (small ? 16 : w <= 620 ? 32 : 40)),
    d = createDockDesign(fit);
  checks.layouts++;
  assert(
    d.charge.x >= d.spin.x && d.charge.x + d.charge.w <= d.spin.x + d.spin.w,
  );
  assert(
    d.charge.y >= d.spin.y && d.charge.y + d.charge.h <= d.spin.y + d.spin.h,
  );

  for (const value of ["100", "1,000", "15,000", "1,000,000", "2,500,000"]) {
    const size = dockChargeSize(d, value),
      font = fonts[700];
    const number =
      ([...value].reduce((sum, ch) => sum + font.width[ch], 0) * size) /
      font.em;
    const label = fit.compact
      ? 0
      : ([..."Cost"].reduce((sum, ch) => sum + font.width[ch], 0) *
          (fit.mode === "portrait" ? 9 : 10)) /
          font.em +
        3;
    assert(
      number + label <= d.charge.w,
      `Charge ${value} clipped at ${w}x${h}`,
    );
    assert(size >= 10, `Charge text too small at ${w}x${h}`);
  }
  if (!fit.compact) {
    assert(d.ante.x >= d.bet.x && d.ante.x + d.ante.w <= d.bet.x + d.bet.w);
    assert(d.ante.y >= d.bet.y && d.ante.y + d.ante.h <= d.bet.y + d.bet.h);
  }
  const targets = {
    ...(!fit.compact ? { turbo: d.turbo } : {}),
    menu: d.menu,
    bet: {
      ...d.betButton,
      x: d.bet.x + d.betButton.x,
      y: d.bet.y + d.betButton.y,
    },
    ...(d.steps
      ? {
          minus: { ...d.minus, x: d.bet.x + d.minus.x, y: d.bet.y + d.minus.y },
          plus: { ...d.plus, x: d.bet.x + d.plus.x, y: d.bet.y + d.plus.y },
        }
      : {}),
    ...(!fit.compact ? { auto: d.auto } : {}),
    spin: d.spin,
    buy: d.feature,
    ...(!fit.compact ? { ante: d.ante } : {}),
  };
  for (const [name, r] of Object.entries(targets)) {
    checks.targets++;
    if (r.w < 44 || r.h < 44)
      failures.push({ w, h, name, type: "small target", r });
    if (
      r.x < -0.01 ||
      r.y < -0.01 ||
      r.x + r.w > d.width + 0.01 ||
      r.y + r.h > d.height + 0.01
    )
      failures.push({ w, h, name, type: "target bounds", r });
  }
  const entries = Object.entries(targets);
  for (let i = 0; i < entries.length; i++)
    for (let j = i + 1; j < entries.length; j++) {
      checks.overlaps++;
      if (overlapping(entries[i][1], entries[j][1]))
        failures.push({
          w,
          h,
          type: "target overlap",
          names: [entries[i][0], entries[j][0]],
        });
    }
  for (const key of ["balance", "win"])
    for (const value of [
      "0",
      "500,000",
      "5,000,000",
      "500,000,000",
      "1,234,567,890",
    ]) {
      const r = d[key],
        size = dockAmountSize(
          value,
          { ...r, w: r.w - d.readInset * 2 },
          fit.mode === "wide" ? (key === "win" ? 30 : 28) : 22,
        ),
        font = fonts[key === "win" ? 700 : 600];
      const actual =
        ([...value].reduce((a, ch) => a + font.width[ch], 0) * size) / font.em;
      checks.amounts++;
      if (actual > r.w || size < 14)
        failures.push({
          w,
          h,
          type: "amount width",
          key,
          value,
          size,
          actual,
          width: r.w,
        });
      const block = (fit.mode === "wide" ? 18 : fit.compact ? 12 : 13) + size;
      if (block > r.h)
        failures.push({ w, h, type: "amount height", key, block, height: r.h });
    }
  if (fit.compact)
    assert(fit.height <= h - 16, `popout vertical fit ${w}x${h}`);
  if (fit.mode === "wide") {
    const order = [
      "turbo",
      "menu",
      "balance",
      "win",
      "bet",
      "auto",
      "spin",
      "feature",
    ];
    for (let i = 1; i < order.length; i++)
      assert(
        d[order[i]].x >= d[order[i - 1]].x + d[order[i - 1]].w - 1e-6,
        `canonical order ${w}x${h}`,
      );
  }
  if (fit.mode === "landscape") {
    const reels = {
      x: fit.compact ? 0 : fit.controlLeft + fit.dockGap,
      y: fit.header,
      w: fit.reelWidth,
      h: fit.reelHeight,
    };
    for (const [name, r] of entries)
      assert(!overlapping(r, reels), `${name} overlaps reels`);
    assert(fit.width <= w - inset + 0.01, `landscape horizontal bounds ${w}`);
  }
  if (
    [
      [360, 800],
      [390, 844],
      [844, 390],
      [1440, 900],
    ].some(([a, b]) => a === w && b === h)
  )
    screens.push({ viewport: { w, h }, fit, dock: d });
}
for (const [w, h] of [
  [400, 225],
  [480, 270],
  [640, 360],
  [360, 800],
  [390, 844],
  [844, 390],
  [1440, 900],
])
  audit(w, h);
for (let w = 320; w <= 1920; w += 20)
  for (const h of [390, 568, 660, 800, 900]) audit(w, h);
// Finite scheduling, duplicate confirm, stop during a round, rejected charge,
// feature stop and stale completion after a restart are independent behaviors.
const flush = async () => {
  for (let i = 0; i < 120; i++) await Promise.resolve();
};
let calls = 0,
  seen = [];
let runner = createAutoSpins(
  (n) => seen.push(n),
  async () => {},
);
assert(
  runner.start(10, async () => {
    calls++;
    return { feature: false };
  }),
);
assert.equal(
  runner.start(10, async () => ({ feature: false })),
  false,
);
await flush();
assert.equal(calls, 10);
assert.equal(runner.remaining, 0);
checks.auto += 3;
for (const count of [0, -1, Infinity, 100, 1e9])
  assert.equal(
    runner.start(count, async () => ({ feature: false })),
    false,
  );
checks.auto += 5;
for (const end of ["feature", "rejected", "throw"]) {
  calls = 0;
  runner = createAutoSpins(
    () => {},
    async () => {},
  );
  runner.start(25, async () => {
    calls++;
    if (end === "throw") throw Error("interrupted");
    return end === "rejected" ? undefined : { feature: true };
  });
  await flush();
  assert.equal(calls, 1);
  assert.equal(runner.remaining, 0);
  checks.auto += 2;
}
let finish;
calls = 0;
runner = createAutoSpins(
  () => {},
  async () => {},
);
runner.start(50, () => {
  calls++;
  return new Promise((resolve) => (finish = resolve));
});
runner.stop();
finish({ feature: false });
await flush();
assert.equal(calls, 1);
assert.equal(runner.remaining, 0);
checks.auto += 2;
let oldFinish;
runner = createAutoSpins(
  () => {},
  async () => {},
);
runner.start(10, () => new Promise((resolve) => (oldFinish = resolve)));
runner.stop();
let newFinish;
runner.start(10, () => new Promise((resolve) => (newFinish = resolve)));
oldFinish({ feature: true });
await flush();
assert.equal(runner.remaining, 10);
runner.stop();
newFinish({ feature: false });
await flush();
checks.auto++;
const protectedPaths = [
  "src/lib/kilo/engine.ts",
  "src/lib/kilo/bank.ts",
  "src/lib/kilo/fixtures.json",
  "src/components/kilo/layout.ts",
  "src/components/kilo/director.ts",
  "src/components/kilo/pixiStage.ts",
  "src/components/kilo/motion-atlas.ts",
  "src/components/kilo/FishermanScene.tsx",
  "src/components/kilo/MarinaBackdrop.tsx",
  "src/components/kilo/control-model.ts",
];
for (const p of protectedPaths)
  assert.deepEqual(
    fs.readFileSync(p),
    execFileSync("git", [
      "show",
      `4a90ec895eb53a5260bf1b481e641f988380c8ad:${p}`,
    ]),
    `${p} differs from checkpoint`,
  );
const originalStage = execFileSync("git", [
  "show",
  "22a1d3bb4df1f18c98c7ce331520b25b8ff14b1e:src/components/kilo/pixiStage.ts",
]).toString();
const stage = fs.readFileSync("src/components/kilo/pixiStage.ts", "utf8");
const stripped = stage
  .replace("async highlight(lines, onLineStart)", "async highlight(lines)")
  .replace("        onLineStart?.(line, index);\n", "")
  .replace(
    /^[ \t]*\/\/ v20-art-begin\n[\s\S]*?^[ \t]*\/\/ v20-art-end\n/gm,
    "",
  );
assert.equal(
  stripped,
  originalStage,
  "Only declared art insertions and the line-start notification may change Pixi",
);
assert(
  stage.indexOf("world.addChild(marinaFrame.root)") <
    stage.indexOf("world.addChild(fx, lineArt, locks, title, transient)"),
  "Frame must be below every collection and hook effect",
);
const director = fs.readFileSync("src/components/kilo/director.ts", "utf8");
const oldDirector = execFileSync("git", [
  "show",
  "bf206d678f0ef40a426e82505d6180a7cb4462fd:src/components/kilo/director.ts",
]).toString();
const collectionStart = "    if (spin.got > 0) {";
assert.equal(
  director.slice(director.indexOf(collectionStart)),
  oldDirector.slice(oldDirector.indexOf(collectionStart)),
  "Collection, retrigger, replay and completion choreography remains unchanged",
);
const play = fs.readFileSync("src/components/kilo/play.tsx", "utf8");
const oldPlay = execFileSync("git", [
  "show",
  "bf206d678f0ef40a426e82505d6180a7cb4462fd:src/components/kilo/play.tsx",
]).toString();
const credit = (source) =>
  source.slice(
    source.indexOf("  function credit("),
    source.indexOf("  function continueFeature("),
  );
assert.equal(
  credit(play),
  credit(oldPlay),
  "Debit/credit and settlement path remains unchanged",
);
const key = {
  code: "Space",
  repeat: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
};
assert(acceptsSpinShortcut(key, false, false));
assert(!acceptsSpinShortcut(key, true, false));
assert(!acceptsSpinShortcut(key, false, true));
for (const modifier of ["repeat", "altKey", "ctrlKey", "metaKey", "shiftKey"])
  assert(!acceptsSpinShortcut({ ...key, [modifier]: true }, false, false));
assert(!acceptsSpinShortcut({ ...key, code: "Enter" }, false, false));
checks.keyboard = 9;
checks.unchangedRenderer = 1;
checks.effectLayerOrder = 1;
const report = {
  checkpoint: "9d83f8ee5d69ba34589c5746c849ac407b1824ea",
  checks,
  failures,
  screens,
  protectedPaths,
  browserQA: false,
  scope:
    "Source geometry, real font advances, finite scheduling and protected-file identity. Not browser screenshots or interaction QA.",
};
fs.mkdirSync("public/kilo-material-v22", { recursive: true });
fs.writeFileSync(
  "public/kilo-material-v22/validation.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      checks,
      failures: failures.slice(0, 8),
      failureCount: failures.length,
      protectedFiles: protectedPaths.length,
      browserQA: false,
    },
    null,
    2,
  ),
);
assert.equal(failures.length, 0);
