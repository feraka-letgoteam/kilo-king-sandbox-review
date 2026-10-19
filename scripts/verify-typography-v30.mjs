// Source-derived geometry, real SSR markup, and production CSS cascade only.
// No browser automation, server, screenshot capture, gameplay, or deployment.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import postcss from "postcss";
import { transformStyleAttribute } from "lightningcss";
import {
  prepareTree,
  productionCascade,
  resolveTree,
  variables,
} from "./control-css-cascade.mjs";
registerHooks({
  resolve(specifier, context, next) {
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
const dataModule = (source) =>
  import(
    "data:text/javascript;base64," +
      Buffer.from(transpile(source)).toString("base64")
  );
const { createElement: element } = await import("react");
const { renderToStaticMarkup: render } = await import("react-dom/server");
const { SlotControls } =
  await import("../src/components/slot-controls/SlotControls.tsx");
const { createControlLayout, controlTargets } =
  await import("../src/components/slot-controls/layout.ts");
const { CONTROL_TOKENS } =
  await import("../src/components/slot-controls/tokens.ts");
const { fitGameLayout } = await import("../src/components/kilo/layout.ts");
const { KILO_CONTROL_THEME } =
  await import("../src/components/kilo/control-theme.ts");
const { MATERIAL_STYLE } = await import("../src/components/kilo/material.ts");
const checkpoint = JSON.parse(
  readFileSync("scripts/checkpoints/typography-v30.json", "utf8"),
);
const baselineTokens = (await dataModule(checkpoint.tokensSource))
  .CONTROL_TOKENS;
const baselineLayout = (
  await dataModule(
    checkpoint.layoutSource.replace(
      /^import[^\n]+\n/,
      `const T = ${JSON.stringify(baselineTokens)};\n`,
    ),
  )
).createControlLayout;
const hash = (data) => createHash("sha256").update(data).digest("hex");
const allowed = new Set([
  "src/components/slot-controls/layout.ts",
  "src/components/slot-controls/tokens.ts",
  "src/components/slot-controls/controls.css",
  "src/components/slot-controls/typography.ts",
  "src/components/slot-controls/SlotControls.tsx",
  "src/components/kilo/modular-controls.css",
]);
const protectedFiles = Object.keys(checkpoint.sourceFiles).filter(
  (p) => !allowed.has(p) && !p.endsWith(".md"),
);
for (const path of protectedFiles)
  assert.equal(
    hash(readFileSync(path)),
    checkpoint.sourceFiles[path],
    `Protected source changed: ${path}`,
  );
for (const [name, value] of Object.entries(baselineTokens).filter(
  ([name]) => name !== "portraitBet",
))
  assert.deepEqual(
    CONTROL_TOKENS[name],
    value,
    `Existing geometry token changed: ${name}`,
  );
// Compare all outputs over an explicit width/height grid; checkpoint sources are
// embedded so this verification also runs from the source archive without Git.
let unchangedLayoutCases = 0;
for (const variant of ["desktop", "landscape", "compact"]) {
  const widths =
    variant === "desktop"
      ? [760, 800, 888, 960, 1040, 1200]
      : variant === "landscape"
        ? [600, 700, 732, 812, 900, 1040]
        : [352, 432, 503, 600, 680];
  for (const width of widths)
    for (const height of variant === "desktop"
      ? [100]
      : [280, 304, 350, 390, 440, 560]) {
      const input = { variant, width, height, footerWidth: width - 72 };
      assert.deepEqual(
        createControlLayout(input),
        baselineLayout(input),
        `${variant} geometry changed at ${width}x${height}`,
      );
      unchangedLayoutCases++;
    }
}
const html = readFileSync("dist/index.html", "utf8");
const cssFile = "dist" + html.match(/href="([^\"]+\.css)"/)[1];
const css = readFileSync(cssFile, "utf8");
let numericFace;
postcss.parse(css).walkAtRules("font-face", (rule) => {
  const values = Object.fromEntries(
    rule.nodes.filter((n) => n.type === "decl").map((n) => [n.prop, n.value]),
  );
  if (
    values["font-weight"] === "900" &&
    values.src?.includes("SourceSans3-900")
  )
    numericFace = values;
});
assert(numericFace, "Production build must contain the actual Black font");
assert.equal(numericFace["ascent-override"], "70%");
assert.equal(numericFace["descent-override"], "26%");
assert.equal(numericFace["line-gap-override"], "0%");
const cascade = productionCascade(
  css
    .replaceAll(":first-of-type", ":nth-of-type(1)")
    .replace(/,\s+(?=env\()/g, ","),
);
const node = (tag, cls, children = [], attrs = {}) => ({
  tag,
  attrs: { class: cls, ...attrs },
  children,
});
const walk = (n) => [n, ...n.children.flatMap(walk)];
const has = (n, cls) => (n.attrs.class ?? "").split(/\s+/).includes(cls);
const num = (v) => Number.parseFloat(v ?? "0") || 0;
const overlap = (a, b) =>
  a.x < b.x + b.w - 0.001 &&
  b.x < a.x + a.w - 0.001 &&
  a.y < b.y + b.h - 0.001 &&
  b.y < a.y + a.h - 0.001;
const separation = (a, b) =>
  Math.max(a.x - b.x - b.w, b.x - a.x - a.w, a.y - b.y - b.h, b.y - a.y - a.h);
const within = (r, w, h) =>
  r.x >= 0 && r.y >= 0 && r.x + r.w <= w + 0.001 && r.y + r.h <= h + 0.001;
function px(value, viewport) {
  if (value === undefined || value === "auto" || value === "normal") return 0;
  const expression = String(value)
    .replace(/env\([^)]*\)/g, "0")
    .replace(/(-?[\d.]+)d?vh/g, (_, n) =>
      String((Number(n) * viewport[1]) / 100),
    )
    .replace(/(-?[\d.]+)d?vw/g, (_, n) =>
      String((Number(n) * viewport[0]) / 100),
    )
    .replaceAll("px", "")
    .replaceAll("calc(", "(")
    .replace(/\b(min|max)\(/g, "Math.$1(");
  assert(
    /^[\d\s+*/().,\-Mathminax]+$/.test(expression),
    `Unsupported length ${value}`,
  );
  return Function(`"use strict"; return (${expression})`)();
}
function dimensions(viewport) {
  const stage = node("main", "kk-stage");
  const tree = prepareTree(
    node("html", "", [node("body", "", [node("div", "kk-app", [stage])])]),
  );
  const values = resolveTree(tree, cascade, { viewport, hover: false }).get(
    stage,
  ).values;
  const insets = Object.fromEntries(
    ["top", "right", "bottom", "left"].map((k) => [
      k,
      px(values["padding-" + k], viewport),
    ]),
  );
  const game = fitGameLayout(
    viewport[0] - insets.left - insets.right,
    viewport[1] - insets.top - insets.bottom,
  );
  const input = {
    variant: game.compact
      ? "compact"
      : game.mode === "wide"
        ? "desktop"
        : game.mode,
    width:
      game.mode === "landscape"
        ? game.width
        : game.mode === "portrait"
          ? game.reelWidth
          : Math.max(760, game.reelWidth),
    height: game.dock,
    footerWidth: game.reelWidth,
  };
  return { viewport, insets, game, input, dock: createControlLayout(input) };
}
const layouts = [
  [360, 800],
  [390, 844],
  [320, 568],
  [344, 800],
  [485, 902],
  [1440, 900],
  [844, 390],
].map(dimensions);
for (const c of layouts.filter((c) => [360, 390].includes(c.viewport[0]))) {
  assert.deepEqual(c.insets, { top: 12, right: 12, bottom: 20, left: 12 });
  assert.equal(c.dock.width, c.viewport[0] - 24);
}
const geometry = [];
for (const c of layouts.filter((c) => c.input.variant === "portrait")) {
  const { dock: d } = c,
    old = baselineLayout(c.input);
  assert.equal(d.height, 160);
  if (d.width < 320) assert.deepEqual(d, old, "Narrow fallback changed");
  if ([360, 390].includes(c.viewport[0])) {
    assert.equal(d.spin.w, 96);
    assert.equal(d.spin.x + d.spin.w / 2, d.width / 2);
    assert.equal(d.bet.w, 112);
  }
  for (const feature of [false, true]) {
    const targets = controlTargets(d, feature);
    for (const [name, r] of Object.entries(targets)) {
      assert(r.w >= 44 && r.h >= 44, `${c.viewport} ${name} target <44`);
      assert(within(r, d.width, d.height), `${name} outside dock`);
    }
    const targetEntries = Object.entries(targets);
    for (let i = 0; i < targetEntries.length; i++)
      for (let j = i + 1; j < targetEntries.length; j++)
        assert(
          !overlap(targetEntries[i][1], targetEntries[j][1]),
          `Targets overlap: ${targetEntries[i][0]}/${targetEntries[j][0]}`,
        );
    const modules = {
      balance: d.balance,
      win: d.win,
      [feature ? "free-spins" : "bet"]: feature ? d.counter : d.bet,
      spin: d.spin,
      turbo: feature ? d.featureTurbo : d.turbo,
      menu: feature ? d.featureMenu : d.menu,
      ...(feature ? {} : { auto: d.auto, buy: d.buy }),
    };
    const entries = Object.entries(modules),
      painted = Object.fromEntries(
        entries.map(([name, r]) => [
          name,
          ["auto", "turbo", "menu", "buy"].includes(name)
            ? { x: r.x, y: r.y - 3, w: r.w + 3, h: r.h + 3 }
            : r,
        ]),
      );
    let minPaint = Infinity;
    for (const [name, r] of Object.entries(painted))
      assert(
        within(r, d.width, d.height),
        `${name} badge envelope outside dock`,
      );
    for (let i = 0; i < entries.length; i++)
      for (let j = i + 1; j < entries.length; j++) {
        const a = painted[entries[i][0]],
          b = painted[entries[j][0]];
        assert(
          !overlap(a, b),
          `Paint overlaps: ${entries[i][0]}/${entries[j][0]}`,
        );
        minPaint = Math.min(minPaint, separation(a, b));
      }
    const betSpinGap = d.spin.x - d.bet.x - d.bet.w,
      spinToolsGap =
        (feature ? d.featureTurbo : d.auto).x - d.spin.x - d.spin.w;
    if (d.width >= 320) {
      assert(betSpinGap >= 8);
      assert(spinToolsGap >= 16);
      assert(d.buy.x - d.auto.x - d.auto.w >= 12);
      assert(d.turbo.y - d.auto.y - d.auto.h >= 12);
    }
    geometry.push({
      viewport: c.viewport.join("x"),
      stageInsets: c.insets,
      state: feature ? "feature" : "base",
      dock: d,
      modules,
      conservativePaintBounds: painted,
      minimumPaintSeparation: minPaint,
      betSpinGap,
      spinToolsGap,
      minTarget: Math.min(...Object.values(targets).flatMap((r) => [r.w, r.h])),
      bottomClearance:
        160 - Math.max(...Object.values(modules).map((r) => r.y + r.h)),
    });
  }
}
// Action callbacks, charge placement and disabled reason presentation are
// unchanged. Only number rendering gains native read-only overflow navigation.
const component = readFileSync(
  "src/components/slot-controls/SlotControls.tsx",
  "utf8",
);
const callbacks = (source) => {
  const file = ts.createSourceFile(
      "component.tsx",
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    ),
    out = [];
  function visit(n) {
    if (
      ts.isJsxAttribute(n) &&
      ["onClick", "disabled", "aria-disabled"].includes(n.name.getText(file))
    )
      out.push(n.getText(file));
    ts.forEachChild(n, visit);
  }
  visit(file);
  return out;
};
assert.deepEqual(callbacks(component), callbacks(checkpoint.componentSource));
const beforeSpin = checkpoint.componentSource.slice(
  checkpoint.componentSource.indexOf('className="sc-spin-group"'),
);
assert.equal(
  component.slice(component.indexOf('className="sc-spin-group"')),
  beforeSpin,
);
const fonts = JSON.parse(
  execFileSync("python", [
    "-c",
    `from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
import json
f=TTFont('src/components/slot-controls/fonts/SourceSans3-900.woff2');c=f.getBestCmap();g=f.getGlyphSet();bounds={}
for char in '0123456789,':
 p=BoundsPen(g);g[c[ord(char)]].draw(p);bounds[char]=p.bounds
print(json.dumps({'em':f['head'].unitsPerEm,'weight':f['OS/2'].usWeightClass,'advances':{s:f['hmtx'][c[ord(s)]][0] for s in '0123456789,'},'bounds':bounds}))`,
  ]).toString(),
);
assert.equal(fonts.weight, 900);
assert.equal(
  new Set("0123456789".split("").map((ch) => fonts.advances[ch])).size,
  1,
);
const typographyChecks = [];
const { controlReadoutTextStyle, controlReadoutOverflows, controlBetInset } =
  await import("../src/components/slot-controls/typography.ts");
const composition = [];
for (const c of layouts.filter((c) =>
  [360, 390, 1440, 844].includes(c.viewport[0]),
)) {
  const d = c.dock,
    old = baselineLayout(c.input);
  if (d.variant !== "portrait") assert.deepEqual(d, old);
  const size = d.variant === "desktop" ? 32 : 26;
  const betSize =
    d.variant === "desktop" ? 30 : d.variant === "landscape" ? 26 : 22;
  for (const [name, width, fontSize, samples] of [
    ["balance", d.balance.w - 20, size, ["0", "500,000", "1,234,567,890"]],
    ["win", d.win.w - 20, size, ["0", "48,000", "5,000,000"]],
    ["bet", d.betButton.w, betSize, ["1,000", "10,000"]],
  ]) {
    for (const value of samples) {
      const textWidth =
        name === "bet"
          ? width - controlBetInset(value, width, fontSize)
          : width;
      const lineHeight =
        name === "bet"
          ? d.variant === "desktop"
            ? 26
            : d.variant === "landscape"
              ? 23
              : 22
          : d.variant === "desktop"
            ? 32
            : 23;
      const style = controlReadoutTextStyle(value, width, fontSize, lineHeight);
      assert.equal(style.fontSize, fontSize);
      assert.equal(style.fontWeight, 900);
      assert(fontSize > 14);
      const inkHeight =
        ((Math.max(...[...value].map((ch) => fonts.bounds[ch][3])) -
          Math.min(...[...value].map((ch) => fonts.bounds[ch][1]))) /
          fonts.em) *
        fontSize;
      assert(inkHeight <= lineHeight);
      const baseline =
        (lineHeight - fontSize * (0.7 + 0.26)) / 2 + fontSize * 0.7;
      const inkTop =
        baseline -
        (Math.max(...[...value].map((ch) => fonts.bounds[ch][3])) / fonts.em) *
          fontSize;
      const inkBottom =
        baseline -
        (Math.min(...[...value].map((ch) => fonts.bounds[ch][1])) / fonts.em) *
          fontSize;
      assert(
        inkTop >= 0 && inkBottom <= lineHeight,
        `${name}: numeric ink leaves its line box`,
      );
      const advance =
        ([...value].reduce((n, ch) => n + fonts.advances[ch], 0) / fonts.em) *
        fontSize;
      const overflow = controlReadoutOverflows(value, textWidth, fontSize);
      assert.equal(overflow, advance > textWidth);
      if (name === "bet")
        assert(
          !overflow,
          `${c.viewport}: maximum Bet needs horizontal overflow`,
        );
      typographyChecks.push({
        viewport: c.viewport.join("x"),
        name,
        value,
        fontSize,
        lineHeight,
        weight: 900,
        width,
        textWidth,
        advance,
        inkHeight,
        inkTop,
        inkBottom,
        overflow,
      });
    }
  }
  for (const feature of [false, true]) {
    const targets = controlTargets(d, feature),
      entries = Object.entries(targets);
    for (const [name, r] of entries)
      assert(r.w >= 44 && r.h >= 44, `${name}: target below44`);
    const groups = {
      balance: d.balance,
      win: d.win,
      bet: feature ? d.counter : d.bet,
      spin: d.spin,
      menu: feature ? d.featureMenu : d.menu,
      turbo: feature ? d.featureTurbo : d.turbo,
      ...(feature ? {} : { auto: d.auto, buy: d.buy }),
    };
    for (const collection of [targets, groups]) {
      const rows = Object.entries(collection);
      for (let i = 0; i < rows.length; i++)
        for (let j = i + 1; j < rows.length; j++)
          assert(
            !overlap(rows[i][1], rows[j][1]),
            `${c.viewport}: overlap ${rows[i][0]}/${rows[j][0]}`,
          );
    }
    for (const [name, r] of Object.entries(groups))
      if (name !== "spin") assert(separation(d.spin, r) > 0);
  }
  composition.push({
    viewport: c.viewport.join("x"),
    variant: d.variant,
    readoutSize: size,
    betSize,
    unchangedControls: d.variant !== "portrait",
    betSpinGap: d.variant === "portrait" ? d.spin.x - d.bet.x - d.bet.w : null,
    spinToolsGap:
      d.variant === "portrait" ? d.auto.x - d.spin.x - d.spin.w : null,
  });
}
const anchoring = [];
const noop = () => {};
const actions = Object.fromEntries(
  ["menu", "turbo", "bet", "minus", "plus", "ante", "auto", "spin", "buy"].map(
    (k) => [k, noop],
  ),
);
const base = {
  balance: "500,000",
  win: "0",
  bet: "1,000",
  currency: "LGC",
  ante: false,
  speed: "normal",
  busy: false,
  autoRemaining: 0,
  ready: true,
  locked: false,
  spinDisabled: false,
  minimumBet: false,
  maximumBet: false,
  charge: { amount: "1,000" },
};
const states = [
  ["idle", {}],
  ["ante-on", { ante: true }],
  ["speed-super", { speed: "super" }],
  [
    "long-amount",
    { balance: "1,234,567,890", win: "1,234,567,890", bet: "10,000" },
  ],
  [
    "insufficient-balance",
    {
      balance: "400",
      spinDisabled: true,
      spinDisabledReason: "Insufficient balance",
    },
  ],
  [
    "feature",
    {
      feature: { remaining: 8, multiplier: 2 },
      charge: { label: "Free spins" },
    },
  ],
];
const styleText = (o) =>
  Object.entries(o)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
const cases = layouts
  .filter((c) => [360, 390, 1440, 844].includes(c.viewport[0]))
  .flatMap((c) =>
    states.map(([name, delta]) => {
      const game = c.game,
        vars = Object.fromEntries(
          Object.entries({
            "game-width": game.width,
            "game-height": game.height,
            "reel-width": game.reelWidth,
            "reel-height": game.reelHeight,
            "header-height": game.header,
            "dock-height": game.dock,
            "strip-height": game.strip,
            "side-width": game.side,
            "control-left": game.controlLeft,
            "art-left": game.artLeft,
            "art-right": game.artRight,
            "dock-gap": game.dockGap,
          }).map(([k, v]) => ["--" + k, v + "px"]),
        );
      const markup = render(
        element(SlotControls, {
          layout: c.dock,
          state: { ...base, ...delta },
          actions,
          theme: KILO_CONTROL_THEME,
          bonusAnchorClassName: "kk-bonus-win",
        }),
      );
      return {
        ...c,
        state: name,
        markup,
        html: `<html><body><div class="kk-app" style='${styleText(MATERIAL_STYLE)}'><main class="kk-stage"><div class="kk-shell${delta.feature ? " is-feature" : ""}" data-layout="${game.mode}" data-framing="${game.artLeft ? "sides" : "header"}" style='${styleText(vars)}'><div class="kk-modular-controls">${markup}</div></div></main></div></body></html>`,
      };
    }),
  );
const trees = JSON.parse(
  execFileSync(
    "python",
    [
      "-c",
      `import json,sys\nfrom lxml import html\ndef node(e):\n return {'tag':e.tag,'attrs':dict(e.attrib),'children':[node(c) for c in e if isinstance(c.tag,str)]}\nprint(json.dumps([node(html.fromstring(s)) for s in json.load(sys.stdin)]))`,
    ],
    {
      input: JSON.stringify(cases.map((c) => c.html)),
      maxBuffer: 16 * 1024 * 1024,
    },
  ).toString(),
);
function declaration(property, value) {
  let result;
  transformStyleAttribute({
    code: Buffer.from(`${property}:${value}`),
    visitor: {
      Declaration(d) {
        if (d.property === property) result = d.value;
      },
    },
  });
  assert.notEqual(result, undefined);
  return result;
}
const paint = [],
  glass = [];
for (let i = 0; i < cases.length; i++) {
  const c = cases[i],
    tree = prepareTree(trees[i]),
    nodes = walk(tree),
    buttons = nodes.filter((n) => has(n, "sc-button"));
  const events = [
    ["rest", new Map()],
    [
      "pressed",
      new Map(
        buttons
          .filter((n) => !("disabled" in n.attrs))
          .map((n) => [n, new Set(["active", "focus-visible"])]),
      ),
    ],
  ];
  for (const [event, state] of events) {
    const context = { viewport: c.viewport, state, hover: false },
      styles = resolveTree(tree, cascade, context);
    for (const n of nodes.filter(
      (n) => has(n, "sc-circle") || has(n, "sc-spin") || has(n, "sc-well"),
    )) {
      const s = styles.get(n),
        v = s.values,
        p = has(n, "sc-bet")
          ? Object.fromEntries(
              Object.entries(
                cascade(n, { ...context, pseudo: "before" }).values,
              ).map(([k, v]) => [k, variables(v, s.vars)]),
            )
          : v;
      // Parse the complete shorthand: the minifier writes transparent resets
      // as `background:0 0`, which is a position plus default transparent fill.
      const backgrounds = declaration("background", p.background);
      const expectedFill = has(n, "sc-readout")
        ? "transparent"
        : has(n, "sc-well")
          ? "#01070b"
          : "#020c12";
      assert.deepEqual(
        backgrounds.at(-1).color,
        declaration("color", expectedFill),
      );
      assert(backgrounds.every((layer) => layer.image.type === "none"));
      p["background-color"] = expectedFill;
      p["background-image"] = "none";
      for (let a = n; a; a = a.parent) {
        const av = styles.get(a).values;
        assert.equal(av.opacity, "1");
        assert.equal(av.filter, "none");
        assert.equal(av["backdrop-filter"], "none");
      }
      if (p["box-shadow"] && p["box-shadow"] !== "none")
        for (const sh of declaration("box-shadow", p["box-shadow"]))
          assert.equal(sh.blur.value.value, 0);
      const coating = Object.fromEntries(
        Object.entries(cascade(n, { ...context, pseudo: "after" }).values).map(
          ([k, value]) => [k, variables(value, s.vars)],
        ),
      );
      assert.equal(v.isolation, "isolate");
      if (has(n, "sc-readout")) {
        assert.equal(coating.display, "none");
        assert.equal(declaration("color", v["border-top-color"]).alpha, 0);
      }
      assert.equal(coating["z-index"], "-1");
      assert.equal(coating["pointer-events"], "none");
      for (const side of ["top", "right", "bottom", "left"])
        assert.equal(coating[side], "1px");
      assert.match(coating.background, /linear-gradient/);
      for (const layer of declaration("background", coating.background))
        for (const stop of layer.image.value?.items ?? [])
          if (stop.type === "color-stop") assert(stop.color.alpha <= 0.08);
      assert.equal(coating.opacity ?? "1", "1");
      assert.equal(coating.filter ?? "none", "none");
      assert.equal(coating["backdrop-filter"] ?? "none", "none");
      for (const sh of declaration("box-shadow", coating["box-shadow"])) {
        assert.equal(sh.inset, true);
        assert.equal(sh.blur.value.value, 0);
        assert(sh.color.alpha <= 0.15);
      }
      if (has(n, "sc-bet")) assert.equal(p["z-index"], "-2");
      if (event === "rest")
        glass.push({
          viewport: c.viewport.join("x"),
          state: c.state,
          module:
            n.attrs["data-control"] ??
            n.attrs["data-module"] ??
            n.attrs["data-testid"],
          values: coating,
        });
      if (has(n, "sc-circle") || has(n, "sc-spin"))
        for (const side of ["top", "right", "bottom", "left"]) {
          assert.equal(
            v[`border-${side}-width`],
            has(n, "sc-spin") ? "8px" : "2px",
          );
          assert.equal(v[`border-${side}-style`], "solid");
          assert.equal(
            declaration("color", v[`border-${side}-color`]).alpha,
            1,
          );
        }
      if (event === "rest")
        paint.push({
          viewport: c.viewport.join("x"),
          state: c.state,
          module:
            n.attrs["data-control"] ??
            n.attrs["data-module"] ??
            n.attrs["data-testid"],
          values: Object.fromEntries(
            [
              "background-color",
              "background-image",
              "border-top-width",
              "border-top-style",
              "border-top-color",
              "opacity",
              "filter",
              "box-shadow",
            ].map((k) => [k, p[k] ?? v[k]]),
          ),
        });
    }
    if (
      event === "rest" &&
      c.state === "idle" &&
      c.input.variant === "portrait"
    ) {
      const shell = nodes.find((n) => has(n, "kk-shell"));
      const v = styles.get(shell).values;
      assert.equal(v["row-gap"], "18px");
      anchoring.push({
        viewport: c.viewport.join("x"),
        reelToDock: 18,
        paintedCabinetOutset: 14,
        cabinetToDock: 4,
        previousCabinetToDock: 6,
        dockAllocation: 160,
        unusedInsideDock: 4,
        viewportSpaceBelowChange: 2,
      });
    }
    for (const n of nodes.filter(
      (n) => n.tag === "strong" && has(n.parent, "sc-well"),
    ))
      assert.equal(styles.get(n).values.color, "#fff8e8");
    for (const n of nodes.filter((n) => has(n, "sc-number"))) {
      const v = styles.get(n).values;
      assert.equal(v["font-weight"], "900");
      assert(num(v["font-size"]) > 14);
      assert.equal(v["font-variant-numeric"], "tabular-nums");
      const parent = styles.get(n.parent).values;
      const stack = 14 + num(parent.gap) + num(v["line-height"]);
      const height =
        num(parent.height) -
        num(parent["border-top-width"]) -
        num(parent["border-bottom-width"]);
      assert(
        stack <= height,
        `${c.viewport}: numeric stack needs ${stack}px in ${height}px`,
      );
      if (has(n, "sc-bet-number")) {
        assert.equal(parent["align-items"], "flex-start");
        assert.equal(parent["text-align"], "left");
        assert(
          num(parent["padding-left"]) + num(v["max-width"]) <=
            num(parent.width) + 0.001,
        );
      }
    }
    const readoutCards = nodes.filter((n) => has(n, "sc-readout-card"));
    assert.equal(readoutCards.length, 1);
    const surface = styles.get(readoutCards[0]).values;
    const surfaceRect = {
      x: num(surface.left),
      y: num(surface.top),
      w: num(surface.width),
      h: num(surface.height),
    };
    const pair = [c.dock.balance, c.dock.win];
    assert.equal(surfaceRect.x, Math.min(...pair.map((r) => r.x)));
    assert.equal(surfaceRect.y, Math.min(...pair.map((r) => r.y)));
    assert.equal(
      surfaceRect.x + surfaceRect.w,
      Math.max(...pair.map((r) => r.x + r.w)),
    );
    assert.equal(
      surfaceRect.y + surfaceRect.h,
      Math.max(...pair.map((r) => r.y + r.h)),
    );
    for (const [name, r] of Object.entries(
      controlTargets(c.dock, c.state === "feature"),
    ))
      assert(
        !overlap(surfaceRect, r),
        `${name}: shared readout card overlaps an action`,
      );
    for (const n of nodes.filter((n) => has(n, "sc-readout"))) {
      assert(
        !walk(n).some((child) => child.tag === "small"),
        "Visible currency abbreviation remains",
      );
      const expected =
        n.attrs["data-module"] === "balance" || c.dock.variant === "landscape"
          ? "left"
          : "right";
      assert.equal(styles.get(n).values["text-align"], expected);
    }
    for (const n of nodes.filter((n) => has(n, "sc-step"))) {
      const v = styles.get(n).values;
      if (event === "rest") assert.equal(v["box-shadow"], "none");
      assert.equal(
        declaration("background", v.background).at(-1).color.alpha,
        0,
      );
    }
    for (const n of nodes.filter(
      (n) => has(n, "sc-ante") && n.attrs["data-tight"] !== "true",
    )) {
      const v = styles.get(n).values;
      const pill = styles.get(
        n.children.find((child) => child.tag === "b"),
      ).values;
      const occupied =
        24.552 + num(v.gap) + num(pill["min-width"]) + num(v["padding-left"]);
      assert(
        occupied <= num(v.width),
        `Ante pill needs ${occupied}px in ${v.width}px`,
      );
    }
    for (const n of nodes.filter((n) => has(n, "sc-overflow-amount"))) {
      assert("readonly" in n.attrs);
      assert.equal(n.attrs.value, "1,234,567,890");
      assert.equal(styles.get(n).values["font-weight"], "900");
    }
    if (c.state === "long-amount")
      assert.equal(nodes.filter((n) => has(n, "sc-overflow-amount")).length, 2);
    for (const n of nodes.filter((n) => has(n, "sc-label")))
      assert.match(styles.get(n).values.font, /14px\s*\/\s*1\b/);
    for (const n of nodes.filter((n) => has(n, "sc-badge"))) {
      const v = styles.get(n).values;
      assert.equal(declaration("color", v["background-color"]).alpha, 1);
      assert.equal(v.opacity, "1");
    }
    for (const n of nodes.filter(
      (n) =>
        has(n, "sc-icon") &&
        (has(n.parent, "sc-spin") || has(n.parent, "sc-circle")),
    )) {
      assert.equal(styles.get(n).values.color, "#ffffff");
      for (const svg of walk(n).filter((n) => n.tag === "svg"))
        assert(num(styles.get(svg).values["stroke-width"]) >= 3);
    }
    if (c.state === "insufficient-balance") {
      const reason = nodes.find((n) => has(n, "sc-action-reason")),
        charge = nodes.find((n) => has(n, "sc-charge")),
        spin = nodes.find((n) => has(n, "sc-spin"));
      assert.equal(reason.parent, spin.parent);
      assert.equal(charge.parent, spin.parent);
      assert(has(spin.parent, "sc-spin-group"));
      assert(c.markup.includes("Insufficient balance"));
      assert(c.markup.includes("1,000"));
      const rv = styles.get(reason).values;
      assert.equal(rv.left, "12%");
      assert.equal(rv.width, "76%");
      assert(
        within(
          {
            x: c.dock.charge.x - c.dock.spin.x,
            y: c.dock.charge.y - c.dock.spin.y,
            w: c.dock.charge.w,
            h: c.dock.charge.h,
          },
          c.dock.spin.w,
          c.dock.spin.h,
        ),
      );
    }
  }
}
const output = "public/kilo-typography-v30";
mkdirSync(output, { recursive: true });
const report = {
  checkpoint: checkpoint.commit,
  passed: true,
  method:
    "Source-derived geometry, production CSS cascade on actual React SSR markup, and shipped font advances/ink bounds. No browser screenshots or live execution.",
  protectedSourceFiles: protectedFiles.length,
  unchangedDesktopLandscapeCompactCases: unchangedLayoutCases,
  composition,
  anchoring,
  typographyChecks,
  geometry,
  paint,
  glass,
  numericFace,
  productionStylesheet: cssFile,
  productionStylesheetSha256: hash(css),
  limitations: [
    "Native navigation within oversized read-only amount fields is not browser-tested. These preserve exact text and fixed size; the entire number is not simultaneously visible when wider than the fixed well.",
    "The 160px portrait dock retains 4px below its targets. Pulling it 2px upward increases the background below the game by 2px. Reducing that remaining viewport area is incompatible with the retained reel sizes and top anchoring.",
    "Device safe-area insets are modeled as zero. The glass finish and final font rasterization have not been assessed in a live browser.",
  ],
};
writeFileSync(
  `${output}/typography-report.json`,
  JSON.stringify(report, null, 2) + "\n",
);
writeFileSync(
  `${output}/TYPOGRAPHY_VERIFICATION.md`,
  `# Typography, portrait anchoring and glass finish — v30

${report.method}

Presentation-only changes, prepared for the private preview. Checkpoint: ${checkpoint.commit}.

| Viewport | Balance / Win size | Bet size | Weight | Label size |
|---|---:|---:|---:|---:|
${composition.map((c) => `| ${c.viewport} | ${c.readoutSize}px | ${c.betSize}px | 900 | 14px |`).join("\n")}

## Layout

Portrait: 160px allocation, 96px centered Spin, 112×88px compact Bet, 8px Bet-to-Spin and 16px Spin-to-secondary gaps, 12px secondary grid gaps. All action targets are at least 44×44px. Cabinet-to-controls clearance is 4px, reduced from 6px. Source-derived rectangles have no overlaps at all four requested sizes, in base or feature mode. ${unchangedLayoutCases} desktop, landscape and compact layout outputs match the checkpoint exactly.

## Type

Numbers use the shipped Source Sans 3 Black font at weight 900; all 10 digits have equal advances. Sizes stay fixed regardless of amount length. The maximum 10,000 Bet fits at all four target sizes. Numeric line boxes accommodate the comma descenders, using explicit font metrics and 23px readout lines on phones/landscape. Long Balance/Win values use a native read-only text field retaining the exact full value and fixed type size. No abbreviations or ellipses are inserted, but horizontal navigation is required when the amount exceeds its well. The existing Spin cost and disabled-reason subtree is byte-for-byte unchanged.

## Glass and material

Resolved production CSS retains opaque #020c12 circular faces, #01070b wells, hard 8px Spin and 2px secondary rims, warm-white numeric ink and full disabled opacity. The latest requested glass polish is a separate, contained reflection layer: a neutral sheen with approximately 7% maximum alpha and crisp inset edge reflections of approximately 15% alpha. Its gradient does not replace the opaque base. It is behind text and icons, cannot receive input, has no blur, and stays inside the existing bounds. Theme options glassHighlight and glassEdge allow the neutral reflection to be retinted or removed. No geometry or hit area is added by the finish.

## Supplied reference changes

Balance and Win now share one opaque card. Balance aligns left and Win right on desktop and portrait; short landscape stacks both in the existing left rail. Visible LGC labels are removed. The two underlying number rectangles and collection destination remain in their previous positions. The shared card's bounds contain both readouts and do not overlap any action target.

Bet uses a left-aligned label and amount with plain chevrons on the right, without separate arrow compartments or divider shadows. Ante remains a compact attached pill. Padding adapts to the available text width, while the font size stays fixed; the maximum bet fits. The new reference styling changes no target rectangles or callbacks.

## Preservation and cause

${protectedFiles.length} protected source files, including engine, wallet, settlement, reel renderer and collection code, are unchanged. All existing action callbacks and disabled guards are unchanged.

The former amount-width fitter reduced type size for long strings, so hierarchy varied with the amount. It now uses fixed sizes and an actual heavier font. Portrait Bet needed 8px more width for the unshrunk maximum bet; it remains separated from Spin. The previous line box was also too short for larger figures containing commas. The bonus-win host selector's spacing was aligned with the other readouts. No overriding material rule was found in the production cascade.

## Remaining limitations

${report.limitations.map((s) => "- " + s).join("\n")}
`,
);
console.log(
  JSON.stringify(
    {
      passed: true,
      protectedSourceFiles: protectedFiles.length,
      geometryCases: geometry.length,
      paintCases: cases.length,
      typographyChecks: typographyChecks.length,
      report: `${output}/TYPOGRAPHY_VERIFICATION.md`,
    },
    null,
    2,
  ),
);
