// v35 Info: built CSS cascade + real React markup. No browser or pixel proof.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  prepareTree,
  productionCascade,
  resolveTree,
} from "./control-css-cascade.mjs";
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/"))
      specifier = new URL("../src/" + specifier.slice(2), import.meta.url).href;
    if (
      (specifier.startsWith(".") || specifier.startsWith("file:")) &&
      !/\.(tsx?|css|m?js)$/.test(specifier)
    ) {
      const url = new URL(specifier, context.parentURL);
      for (const ext of [".ts", ".tsx"])
        if (existsSync(fileURLToPath(url) + ext))
          return next(url.href + ext, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".css"))
      return { format: "module", source: "export {};", shortCircuit: true };
    if (/\.tsx?$/.test(url))
      return {
        format: "module",
        shortCircuit: true,
        source: transpile(readFileSync(fileURLToPath(url), "utf8")),
      };
    return next(url, context);
  },
});
function transpile(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
}
const { createElement: el } = await import("react");
const { renderToStaticMarkup: render } = await import("react-dom/server");
const { InfoPanel } = await import("../src/components/kilo/info-panel.tsx");
const { PAY_SYMBOLS } = await import("../src/components/kilo/paytable.tsx");
const {
  PAY,
  PAYLINES,
  MONEY_LADDER,
  SPLASH_MODES,
  splashCost,
  splashRoundCap,
} = await import("../src/lib/kilo/engine.ts");
const { STAKES } = await import("../src/components/kilo/control-model.ts");
const checkpoint = "ac3e25bb9b2eeaa9c4c193764a7e9d9944d45431";
const sha = (text) => createHash("sha256").update(text).digest("hex");
const changed = execFileSync(
  "git",
  ["diff", "--name-only", checkpoint, "--", "src"],
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);
assert(
  changed.every((path) =>
    [
      "src/components/kilo/play.tsx",
      "src/components/kilo/paytable.tsx",
      "src/components/kilo/info-panel.tsx",
      "src/components/kilo/info-panel.css",
    ].includes(path),
  ),
  "Application changes escaped Info scope",
);
const normalizePlay = (text) => {
  const a = text.indexOf("        {help ? (\n"),
    b = text.indexOf("        {buyPanel &&", a);
  assert(a > 0 && b > a);
  return (text.slice(0, a) + text.slice(b))
    .replace(
      /import \{ (Paytable|InfoPanel) \} from "\.\/(paytable|info-panel)";\n/,
      "",
    )
    .replace(
      "/** KING emblem is the live scatter. Packages carry the cash plaque. */\nconst SCATTER_IS_KING = true;\n",
      "",
    );
};
assert.equal(
  normalizePlay(readFileSync("src/components/kilo/play.tsx", "utf8")),
  normalizePlay(
    execFileSync(
      "git",
      ["show", `${checkpoint}:src/components/kilo/play.tsx`],
      { encoding: "utf8" },
    ),
  ),
  "Runtime or unrelated UI changed",
);
const protectedPaths = [
  "src/lib/kilo/engine.ts",
  "src/lib/kilo/bank.ts",
  "src/components/kilo/director.ts",
  "src/components/kilo/pixiStage.ts",
  "src/components/kilo/layout.ts",
  "src/components/slot-controls/layout.ts",
  "src/components/slot-controls/SlotControls.tsx",
  "src/components/slot-controls/controls.css",
  "src/components/kilo/control-panels.tsx",
  "src/components/kilo/auto-spins.ts",
];
const protectedSources = {};
for (const path of protectedPaths) {
  const before = execFileSync("git", ["show", `${checkpoint}:${path}`]);
  assert.equal(
    sha(readFileSync(path)),
    sha(before),
    `Protected source changed: ${path}`,
  );
  protectedSources[path] = sha(before);
}
const doc = readFileSync("dist/index.html", "utf8");
const cssFile = "dist" + doc.match(/href="([^\"]+\.css)"/)[1];
const css = readFileSync(cssFile, "utf8");
const cascade = productionCascade(
  css
    .replaceAll(":first-of-type", ":nth-of-type(1)")
    .replace(/,\s+(?=env\()/g, ","),
);
const noop = () => {};
const wrap = (markup) =>
  `<html><body><div class="kk-app" data-material="marina" data-reduced="0"><div id="kilo-info-takeover" class="kk-modal-root is-blocking"><div class="kk-scrim"></div><div class="kk-dialog kk-info-panel" role="dialog" aria-modal="true" aria-label="Game information" tabindex="-1">${markup}</div></div></div></body></html>`;
const cases = STAKES.map((stake) => ({
  stake,
  markup: render(
    el(InfoPanel, {
      stake,
      round: { line: 12000, collect: 48000, scatter: 500 },
      onClose: noop,
      onSettings: noop,
    }),
  ),
}));
const trees = JSON.parse(
  execFileSync(
    "python",
    [
      "-c",
      `import json,sys
from lxml import html
def node(e):
 return {'tag':e.tag,'attrs':dict(e.attrib),'text':e.text or '', 'allText':e.text_content(), 'children':[node(c) for c in e if isinstance(c.tag,str)]}
print(json.dumps([node(html.fromstring(s)) for s in json.load(sys.stdin)]))`,
    ],
    {
      input: JSON.stringify(cases.map((c) => wrap(c.markup))),
      maxBuffer: 16 * 1024 * 1024,
    },
  ).toString(),
);
const walk = (n) => [n, ...n.children.flatMap(walk)];
const has = (n, c) => (n.attrs.class ?? "").split(/\s+/).includes(c);
const checks = [];
for (let i = 0; i < cases.length; i++) {
  const tree = prepareTree(trees[i]),
    nodes = walk(tree),
    find = (c) => nodes.find((n) => has(n, c)),
    text = tree.allText.replace(/\s+/g, " ");
  const symbols = nodes.filter((n) => n.attrs["data-symbol"]);
  assert.deepEqual(
    symbols.map((n) => n.attrs["data-symbol"]).sort(),
    Object.keys(PAY).sort(),
  );
  for (const symbol of symbols) {
    for (const award of walk(symbol).filter((n) => n.attrs["data-match"])) {
      assert.equal(
        award.children.find((n) => n.tag === "dd").allText,
        PAY[symbol.attrs["data-symbol"]][
          Number(award.attrs["data-match"]) - 3
        ].toLocaleString("en-US") + "×",
      );
    }
  }
  const lines = walk(find("kk-info-paylines")).filter((n) => n.tag === "svg");
  assert.equal(lines.length, PAYLINES.length);
  lines.forEach((line, index) => {
    const cells = line.children.filter((n) => n.tag === "rect");
    assert.equal(cells.length, 15);
    assert.deepEqual(
      cells.flatMap((cell, j) =>
        cell.attrs["data-active"] === "1" ? [Math.floor(j / 3), j % 3] : [],
      ),
      PAYLINES[index].flatMap((row, col) => [col, row]),
    );
  });
  for (const value of MONEY_LADDER)
    assert(text.includes(`${value.toLocaleString("en-US")}×`));
  for (const mode of SPLASH_MODES) {
    const node = nodes.find((n) => n.attrs["data-mode"] === mode);
    assert(
      node.allText.includes(
        splashCost(cases[i].stake, mode).toLocaleString("en-US"),
      ),
    );
    assert(
      node.allText.includes(
        splashRoundCap(cases[i].stake).toLocaleString("en-US"),
      ),
    );
  }
  assert.equal(
    walk(find("kk-info-rtp")).filter(
      (n) => n.tag === "dd" && n.allText === "Not verified",
    ).length,
    4,
  );
  assert(!/96\.7%|90%/.test(text), "Unverified RTP published");
  assert(text.includes("still advances the meter"));
  assert(text.includes("Neither can currently be played or purchased"));
  for (const img of nodes.filter((n) => n.tag === "img"))
    assert(
      existsSync("public" + img.attrs.src),
      `Missing artwork: ${img.attrs.src}`,
    );
  checks.push({
    stake: cases[i].stake,
    symbols: symbols.length,
    payoutEntries: symbols.length * 3,
    paylines: lines.length,
    modes: SPLASH_MODES.length,
    allArtworkPresent: true,
  });
}
const tree = prepareTree(trees[0]),
  nodes = walk(tree),
  find = (c) => nodes.find((n) => has(n, c));
// Evaluate the small set of px/safe-area CSS length expressions in the layout.
// This is authored box arithmetic, not browser layout or text rendering.
function length(value, safe = { top: 0, right: 0, bottom: 0, left: 0 }) {
  let v = value
    .replace(/env\(safe-area-inset-(top|right|bottom|left)\)/g, (_, side) =>
      String(safe[side]),
    )
    .replace(/px/g, "")
    .replace(/calc\(/g, "(")
    .replace(/max\(/g, "Math.max(")
    .replace(/min\(/g, "Math.min(");
  assert(
    /^[\d\s.,()+\-*/]+$/.test(v.replace(/Math\.(?:max|min)/g, "")),
    `Unhandled length ${value}`,
  );
  return Function(`"use strict";return (${v});`)();
}
const viewports = [
  [1440, 900],
  [390, 844],
  [360, 800],
  [844, 390],
  [320, 568],
];
const layout = [];
for (const viewport of viewports) {
  const styles = resolveTree(tree, cascade, { viewport, hover: false });
  const val = (c) => styles.get(find(c)).values;
  const root = val("kk-modal-root"),
    panel = val("kk-info-panel"),
    scroll = val("kk-info-scroll"),
    close = val("kk-info-close"),
    content = val("kk-info-content"),
    symbols = val("kk-info-symbols");
  assert.equal(root.position, "fixed");
  for (const edge of ["top", "right", "bottom", "left"])
    assert.equal(Number.parseFloat(root[edge]), 0);
  assert.equal(root.padding, "0");
  assert.equal(panel.width, "100%");
  assert.equal(panel.height, "100%");
  assert.equal(panel["max-width"], "none");
  assert.equal(panel["max-height"], "none");
  assert.equal(panel["border-radius"], "0");
  assert.equal(panel["border-top-width"], "0");
  assert.equal(
    scroll["overflow-y"] ?? scroll.overflow?.split(/\s+/).at(-1),
    "auto",
  );
  assert.equal(scroll["overscroll-behavior"], "contain");
  assert.equal(close.position, "absolute");
  assert(length(close.width) >= 44 && length(close.height) >= 44);
  const image = styles.get(
    find("kk-info-symbol").children.find((n) => n.tag === "img"),
  ).values;
  const columns = Number(
    symbols["grid-template-columns"].match(/repeat\((\d)/)[1],
  );
  const gap = length(symbols["column-gap"] ?? symbols.gap.split(/\s+/).at(-1));
  const outerWidth = Math.min(viewport[0], length(content["max-width"]));
  const innerWidth =
    outerWidth -
    length(content["padding-left"]) -
    length(content["padding-right"]);
  const cellWidth = (innerWidth - (columns - 1) * gap) / columns;
  assert(cellWidth >= length(image.width), "Symbol artwork exceeds grid cell");
  assert(cellWidth >= 92, "Pay amounts exceed grid cell");
  const gapBelowClose =
    length(scroll.top) - (length(close.top) + length(close.height));
  assert(gapBelowClose >= 8, "Close overlaps scrollable content");
  // A notched device still keeps close and content in separate vertical regions.
  assert(
    length(scroll.top, { top: 44, right: 0, bottom: 34, left: 0 }) >=
      length(close.top, { top: 44, right: 0, bottom: 34, left: 0 }) +
        length(close.height) +
        8,
  );
  layout.push({
    viewport,
    contentWidth: innerWidth,
    symbolColumns: columns,
    symbolCellWidth: cellWidth,
    symbolSize: length(image.width),
    scrollTop: length(scroll.top),
    scrollHeight: viewport[1] - length(scroll.top),
    closeTarget: [length(close.width), length(close.height)],
    closeToContentGap: gapBelowClose,
    featureColumns: val("kk-info-feature")["grid-template-columns"],
    bodyFont: panel.font,
    bodySizeOverride: panel["font-size"] ?? null,
    sectionHeading: styles.get(nodes.find((n) => n.tag === "h2")).values.font,
    sectionSizeOverride:
      styles.get(nodes.find((n) => n.tag === "h2")).values["font-size"] ?? null,
  });
}
const result = {
  version: "v35",
  checkpoint,
  method:
    "Production CSS author cascade, React server-rendered markup, asset existence, and source-derived responsive box arithmetic. No live browser verification.",
  cssFile,
  cssSha256: sha(css),
  markupChecks: checks,
  layout,
  protectedSources,
  remaining: [
    "Verified theoretical RTP per mode is not supplied by the current sandbox. Existing baseline simulations are estimates, not an approved theoretical declaration.",
    "The sandbox has no Stake Engine RGS integration; production recovery/settlement disclaimer must be finalized with that integration.",
    "Live touch, focus, font rendering and visual equivalence remain unverified; browser QA was unavailable.",
  ],
};
mkdirSync("public/kilo-info-v35", { recursive: true });
writeFileSync(
  "public/kilo-info-v35/info-check.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      result: "pass",
      viewports: layout,
      contentChecks: checks.length,
      protectedSourceCount: protectedPaths.length,
      report: "public/kilo-info-v35/info-check.json",
    },
    null,
    2,
  ),
);
