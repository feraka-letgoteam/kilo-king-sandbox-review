// Focused SOURCE verification, not a browser or screenshot test. Run after build.
// Include the cabinet artwork's overflow: control-only boxes missed this boundary.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fitGameLayout } from "../src/components/kilo/layout.ts";
import { stageArtLayout } from "../src/components/kilo/stage-art.ts";
import { createControlLayout, controlTargets } from "../src/components/slot-controls/layout.ts";
import { prepareTree, productionCascade, resolveTree } from "./control-css-cascade.mjs";

const baseline = "8e8c72b";
const checkpoint = JSON.parse(readFileSync("scripts/checkpoints/cabinet-v27.json", "utf8"));
assert.equal(checkpoint.commit, baseline);
const directory = process.env.CABINET_REVIEW_OUTPUT ?? "public/kilo-clearance-v27";
const allowed = new Set([
  "src/components/kilo/stage-art.ts",
  "src/components/kilo/base-scene.css",
  "src/components/kilo/stage-theme.css",
  "src/components/kilo/modular-controls.css",
  "src/components/kilo/MarinaBackdrop.tsx",
  "src/components/kilo/marina-backdrop.css",
  "src/components/slot-controls/controls.css",
]);
const hash = (data) => createHash("sha256").update(data).digest("hex");
const protectedFiles = Object.keys(checkpoint.sourceFiles).filter((path) => !allowed.has(path));
for (const path of protectedFiles)
  assert.equal(hash(readFileSync(path)), checkpoint.sourceFiles[path], `${path} changed`);

const html = readFileSync("dist/index.html", "utf8");
const cssFile = "dist" + html.match(/href="([^\"]+\.css)"/)[1];
const css = readFileSync(cssFile, "utf8");
const cascade = productionCascade(css.replaceAll(":first-of-type", ":nth-of-type(1)").replace(/,\s+(?=env\()/g, ","));
const node = (tag, cls, children = [], attrs = {}) => ({ tag, attrs: { class: cls, ...attrs }, children });
const values = (styles, n) => styles.get(n).values;
const translate = (r, x, y) => ({ ...r, x: r.x + x, y: r.y + y });
const overlaps = (a, b) => a.x < b.x + b.w - 0.01 && a.x + a.w > b.x + 0.01 && a.y < b.y + b.h - 0.01 && a.y + a.h > b.y + 0.01;
const separation = (a, b) => Math.max(a.x - b.x - b.w, b.x - a.x - a.w, a.y - b.y - b.h, b.y - a.y - a.h);
// Evaluate only the simple pixel/viewport/safe-area expressions used here.
// These are author-source values; no browser computed-layout claim is made.
function pixels(value, viewport, relative = 0) {
  if (value === undefined || value === "auto" || value === "normal") return 0;
  let expression = String(value)
    .replace(/env\([^)]*\)/g, "0")
    .replace(/(-?[\d.]+)d?vh/g, (_, n) => String(Number(n) * viewport[1] / 100))
    .replace(/(-?[\d.]+)d?vw/g, (_, n) => String(Number(n) * viewport[0] / 100))
    .replace(/(-?[\d.]+)%/g, (_, n) => String(Number(n) * relative / 100))
    .replaceAll("px", "").replaceAll("calc(", "(")
    .replace(/\b(min|max)\(/g, "Math.$1(");
  assert(/^[\d\s+*/().,\-Mathminax]+$/.test(expression), `Unsupported length ${value}`);
  return Function(`"use strict"; return (${expression})`)();
}
const failures = [], results = [];
const check = (condition, message, context) => { if (!condition) failures.push({ ...context, message }); };

for (const viewport of [[360, 800], [390, 844], [844, 390], [1440, 900], [320, 568], [485, 902], [1920, 1080], [640, 320]]) {
  const stageProbe = node("main", "kk-stage");
  const probeTree = prepareTree(node("html", "", [node("body", "", [node("div", "kk-app", [stageProbe])])]));
  const stageValues = values(resolveTree(probeTree, cascade, { viewport, hover: false }), stageProbe);
  const inset = Object.fromEntries(["top", "right", "bottom", "left"].map((side) => [side, pixels(stageValues[`padding-${side}`], viewport)]));
  const game = fitGameLayout(viewport[0] - inset.left - inset.right, viewport[1] - inset.top - inset.bottom);
  const dock = createControlLayout({
    variant: game.compact ? "compact" : game.mode === "wide" ? "desktop" : game.mode,
    width: game.mode === "landscape" ? game.width : game.mode === "portrait" ? game.reelWidth : Math.max(760, game.reelWidth),
    height: game.dock, footerWidth: game.reelWidth,
  });
  let baseReel;
  for (const feature of [false, true]) {
    const context = { viewport: viewport.join("x"), mode: game.compact ? "compact" : game.mode, feature };
    const art = node("svg", "kk-stage-surround");
    const canvas = node("div", "kk-canvas-wrap", [node("div", "", [node("canvas", "")]), art]);
    const event = node("p", "kk-event");
    const status = node("div", "kk-crest-status", [event]);
    const brand = node("div", "kk-portrait-brand", [node("img", "kk-portrait-logo"), node("div", "kk-portrait-character")]);
    const logo = node("img", "kk-logo");
    const bonusLabel = node("span", "kk-eyebrow"), bonusValue = node("b", "");
    const copy = node("div", "kk-plate-copy", [bonusLabel, bonusValue]);
    const socket = node("div", "kk-socket");
    const next = node("span", "kk-next");
    const bonus = node("div", "kk-bonus", [node("img", "kk-bonus-mark"), node("div", "kk-bonus-spins", [copy]), node("div", "kk-bonus-track", [node("div", "kk-sockets", [socket])]), node("div", "kk-bonus-pay"), next]);
    const crest = node("div", "kk-crest", feature ? [logo, bonus] : [...(game.mode === "portrait" ? [brand] : []), logo, status]);
    const playfield = node("div", "kk-playfield", [crest, canvas]);
    const controls = node("div", "kk-modular-controls");
    const vars = Object.entries({
      "game-width": game.width, "game-height": game.height, "reel-width": game.reelWidth, "reel-height": game.reelHeight,
      "header-height": game.header, "dock-height": game.dock, "strip-height": game.strip, "side-width": game.side,
      "control-left": game.controlLeft, "art-left": game.artLeft, "art-right": game.artRight, "dock-gap": game.dockGap,
    }).map(([key, value]) => `--${key}:${value}px`).join(";");
    const shell = node("div", `kk-shell${feature ? " is-feature" : ""}`, [playfield, controls], {
      "data-layout": game.mode, "data-framing": game.artLeft ? "sides" : "header", style: vars,
      ...(game.compact ? { "data-compact": "true" } : {}),
    });
    const stage = node("main", "kk-stage", [shell]);
    const tree = prepareTree(node("html", "", [node("body", "", [node("div", "kk-app", [stage])])]));
    const styles = resolveTree(tree, cascade, { viewport, hover: false });
    const s = values(styles, shell), c = values(styles, controls), p = values(styles, playfield);
    const gap = pixels(s["row-gap"], viewport);
    const shellHeight = pixels(s.height, viewport);
    const shellX = (viewport[0] - game.width) / 2, shellY = inset.top;
    const playX = game.mode === "landscape" ? game.compact ? 0 : game.controlLeft + game.dockGap : game.artLeft;
    const reel = { x: shellX + playX, y: shellY + game.header, w: game.reelWidth, h: game.reelHeight };
    baseReel ??= reel;
    check(JSON.stringify(reel) === JSON.stringify(baseReel), "Reel moves on feature transition", context);
    const frame = stageArtLayout(game.reelWidth, game.reelHeight, game.compact ? "mini" : game.mode);
    const hiddenSurround = values(styles, art).display === "none";
    const cabinet = hiddenSurround ? { ...reel } : { x: reel.x + frame.x, y: reel.y + frame.y, w: frame.w, h: frame.h };
    const dockX = game.mode === "landscape" ? shellX : reel.x + (game.reelWidth - dock.width) / 2;
    const dockY = game.mode === "landscape" ? shellY : reel.y + reel.h + gap;
    for (const n of [canvas, art]) check(values(styles, n).filter === "none", "Cabinet still casts an unreserved shadow", context);
    check(Number(c["z-index"]) > Number(p["z-index"]), "Controls lack an explicit layer above decorative cabinet", context);
    check((stageValues["place-items"]?.split(/\s+/)[0] ?? stageValues["align-items"]) === "start", "Stage is not top-aligned", context);
    check(cabinet.x >= -0.01 && cabinet.x + cabinet.w <= viewport[0] + 0.01, "Cabinet clips at a viewport side", context);
    check(cabinet.y >= -0.01 && cabinet.y + cabinet.h <= viewport[1] + 0.01, "Cabinet clips at a viewport top/bottom", context);
    if (game.mode !== "landscape") check(Math.abs(shellHeight - (game.height + gap)) < 0.01, "Shell height does not reserve the real cabinet-to-controls gap", context);
    check(shellY + shellHeight <= viewport[1] - inset.bottom + 0.01, "Shell exceeds available stage height", context);
    const modules = {
      ...controlTargets(dock, feature), balanceWell: dock.balance, winWell: dock.win,
      ...(feature ? { featureCounter: dock.counter } : { betWell: dock.bet }),
    };
    let minimumClearance = Infinity;
    for (const [name, rect] of Object.entries(modules)) {
      const actual = translate(rect, dockX, dockY);
      check(!overlaps(actual, cabinet), `Cabinet artwork overlaps ${name}`, context);
      minimumClearance = Math.min(minimumClearance, separation(actual, cabinet));
      check(actual.x >= 0 && actual.x + actual.w <= viewport[0] && actual.y >= 0 && actual.y + actual.h <= viewport[1], `${name} exceeds viewport`, context);
      if (!name.endsWith("Well") && name !== "featureCounter") check(rect.w >= 44 && rect.h >= 44, `${name} target below44px`, context);
    }
    let header = null;
    if (!feature && !game.compact) {
      const st = values(styles, status), ev = values(styles, event);
      const fs = pixels(ev["font-size"], viewport);
      const lh = ev["line-height"]?.endsWith("px") ? pixels(ev["line-height"], viewport) : fs * Number(ev["line-height"] ?? 1.3);
      const statusHeight = lh + pixels(ev["padding-top"], viewport) + pixels(ev["padding-bottom"], viewport);
      const statusBottom = shellY + game.header - pixels(st.bottom, viewport);
      const statusRect = { x: reel.x, y: statusBottom - statusHeight, w: reel.w, h: statusHeight };
      check(statusBottom <= cabinet.y + 0.01, "Base status line enters the cabinet top outset", context);
      header = { status: statusRect, cabinetClearance: cabinet.y - statusBottom };
      if (game.mode === "portrait") {
        const b = values(styles, brand), bh = pixels(b.height, viewport);
        const brandBottom = shellY + pixels(b.top, viewport) + bh;
        check(brandBottom <= statusRect.y, "Portrait title/character overlaps status row", context);
        header.brandHeight = bh;
        header.brandToStatusClearance = statusRect.y - brandBottom;
      }
    }
    let featureHeader = null;
    if (feature && !game.compact) {
      const b = values(styles, bonus), cp = values(styles, copy);
      const lineHeight = (n) => {
        const st = values(styles, n), size = pixels(st["font-size"], viewport);
        return st["line-height"]?.endsWith("px") ? pixels(st["line-height"], viewport) : size * Number(st["line-height"] ?? 1.2);
      };
      const top = pixels(b.top, viewport), bottom = pixels(b.bottom, viewport);
      const height = game.header - top - bottom;
      const padding = pixels(b["padding-top"], viewport) + pixels(b["padding-bottom"], viewport);
      const borders = pixels(b["border-top-width"], viewport) + pixels(b["border-bottom-width"], viewport);
      const stackGap = pixels(cp.gap ?? "0", viewport);
      const copyHeight = cp["flex-direction"] === "column" ? lineHeight(bonusLabel) + lineHeight(bonusValue) + stackGap : Math.max(lineHeight(bonusLabel), lineHeight(bonusValue));
      const firstRow = Math.max(copyHeight, pixels(values(styles, socket).height, viewport));
      const rowGap = pixels(b["row-gap"] ?? b.gap?.split(" ")[0] ?? "0", viewport);
      const contentHeight = firstRow + rowGap + lineHeight(next);
      check(shellY + top + height <= cabinet.y, "Feature header enters cabinet top outset", context);
      check(contentHeight <= height - padding - borders + 0.01, "Feature header intrinsic rows exceed available height", context);
      if (game.mode === "portrait") check(pixels(values(styles, logo).height, viewport) <= top, "Feature logo overlaps feature meter", context);
      featureHeader = { top, bottom, height, contentHeight, availableContentHeight: height - padding - borders, cabinetClearance: cabinet.y - (shellY + top + height) };
    }
    results.push({ ...context, game, dock, stageInsets: inset, shellHeight, cabinet, reel, hiddenSurround, dockOrigin: [dockX, dockY], gap, minimumCabinetControlClearance: minimumClearance, header, featureHeader });
  }
}
const report = {
  baseline, method: "Production CSS cascade plus source-derived layout and actual decorative-art outer bounds. No browser execution or live screenshot verification.",
  passed: failures.length === 0, protectedSourceFiles: protectedFiles.length, protectedSourcePaths: protectedFiles,
  productionStylesheet: cssFile, productionStylesheetSha256: hash(css), cases: results, failures,
  limitations: [
    "Safe-area expressions are evaluated with zero device insets; shipped env() declarations are preserved.",
    "Header checks cover base one-line statuses and feature-header vertical row budgets; they do not assert browser font rasterization or every possible localized string.",
    "Full artwork bounding envelopes are conservative; transparent pixels are not used to excuse collisions.",
    "Portrait viewport space below the fixed-size game still exists; background reframing changes its composition, not reel dimensions.",
  ],
};
mkdirSync(directory, { recursive: true });
writeFileSync(`${directory}/cabinet-clearance-report.json`, JSON.stringify(report, null, 2) + "\n");
const rows = results.map((r) => `| ${r.viewport} | ${r.feature ? "Feature" : "Base"} | ${r.mode} | ${r.minimumCabinetControlClearance.toFixed(1)}px | ${r.header ? r.header.cabinetClearance.toFixed(1) + "px" : "Not asserted"} |`).join("\n");
writeFileSync(`${directory}/CABINET_CLEARANCE_VERIFICATION.md`, `# Cabinet clearance v27\n\n${report.method}\n\nCheckpoint: ${baseline}. ${protectedFiles.length} source files, including control interaction/layout/tokens, engine, wallet, reel layout and rendering, match the checkpoint byte for byte. Control paint is an allowed presentation change.\n\n| Viewport | State | Layout | Minimum cabinet/control separation | Base status/cabinet separation |\n|---|---|---|---:|---:|\n${rows}\n\n## Result\n\n${report.passed ? "All targeted source checks passed." : failures.map((f) => `- ${f.viewport} ${f.feature ? "feature" : "base"}: ${f.message}`).join("\n")}\n\n## Limits\n\n${report.limitations.map((s) => `- ${s}`).join("\n")}\n`);
console.log(JSON.stringify({ passed: report.passed, cases: results.length, protectedSourceFiles: protectedFiles.length, failures, report: `${directory}/CABINET_CLEARANCE_VERIFICATION.md` }, null, 2));
if (failures.length) process.exitCode = 1;
