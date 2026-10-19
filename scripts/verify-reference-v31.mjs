// v31 reference corrections: source geometry, React SSR and production CSS.
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
  readFileSync("scripts/checkpoints/reference-v31.json", "utf8"),
);
const baselineTokens = (
  await dataModule(checkpoint.sources["src/components/slot-controls/tokens.ts"])
).CONTROL_TOKENS;
const baselineLayout = (
  await dataModule(
    checkpoint.sources["src/components/slot-controls/layout.ts"].replace(
      /^import[^\n]+\n/,
      `const T = ${JSON.stringify(baselineTokens)};\n`,
    ),
  )
).createControlLayout;
const hash = (data) => createHash("sha256").update(data).digest("hex");
const allowed = new Set([
  "src/components/slot-controls/SlotControls.tsx",
  "src/components/slot-controls/controls.css",
  "src/components/slot-controls/layout.ts",
  "src/components/slot-controls/tokens.ts",
  "src/components/slot-controls/typography.ts",
  "src/components/kilo/play.tsx",
  "src/components/kilo/control-panels.tsx",
  "src/components/kilo/feature-panel.css",
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
for (const [key, value] of Object.entries(baselineTokens))
  assert.deepEqual(
    CONTROL_TOKENS[key],
    value,
    `Existing token changed: ${key}`,
  );
const printer = ts.createPrinter({ removeComments: true });
const parse = (source) =>
  ts.createSourceFile(
    "component.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
const print = (n, file) => printer.printNode(ts.EmitHint.Unspecified, n, file);
const collect = (file, predicate) => {
  const result = [];
  function visit(n) {
    if (predicate(n)) result.push(print(n, file));
    ts.forEachChild(n, visit);
  }
  visit(file);
  return result;
};
// Runtime functions, state/effects and handlers before the presentation return
// must remain identical. This also covers wallet writes and settlement guards.
for (const [path, owner] of [
  ["src/components/kilo/play.tsx", "KiloTable"],
  ["src/components/kilo/control-panels.tsx", "FeaturesPanel"],
]) {
  const before = parse(checkpoint.sources[path]),
    after = parse(readFileSync(path, "utf8"));
  const prefix = (file) =>
    file.statements.filter(ts.isFunctionDeclaration).map((fn) => [
      fn.name.text,
      fn.name.text === owner
        ? fn.body.statements
            .filter((n) => !ts.isReturnStatement(n))
            .map((n) => print(n, file))
            .join("\n")
        : print(fn, file),
    ]);
  assert.deepEqual(
    prefix(after),
    prefix(before),
    `${owner}: runtime code changed`,
  );
  if (owner === "FeaturesPanel")
    assert.deepEqual(
      collect(
        after,
        (n) =>
          ts.isJsxAttribute(n) && ["onClick", "disabled"].includes(n.name.text),
      ),
      collect(
        before,
        (n) =>
          ts.isJsxAttribute(n) && ["onClick", "disabled"].includes(n.name.text),
      ),
      "Feature handlers changed",
    );
  if (owner === "KiloTable")
    for (const key of [
      "spin",
      "auto",
      "buy",
      "bet",
      "plus",
      "minus",
      "turbo",
      "menu",
    ])
      assert.deepEqual(
        collect(
          after,
          (n) =>
            ts.isPropertyAssignment(n) &&
            n.name.getText(after) === key &&
            ts.isArrowFunction(n.initializer),
        ),
        collect(
          before,
          (n) =>
            ts.isPropertyAssignment(n) &&
            n.name.getText(before) === key &&
            ts.isArrowFunction(n.initializer),
        ),
        `${key} host action changed`,
      );
}
const html = readFileSync("dist/index.html", "utf8");
const cssFile = "dist" + html.match(/href="([^\"]+\.css)"/)[1];
const css = readFileSync(cssFile, "utf8");
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
  [1440, 900],
  [390, 844],
  [360, 800],
  [844, 390],
].map(dimensions);
const geometry = [];
for (const c of layouts) {
  const d = c.dock,
    old = baselineLayout(c.input);
  for (const name of ["balance", "win", "spin", "buy", "menu", "counter"])
    assert.deepEqual(
      d[name],
      old[name],
      `${c.viewport}: ${name} rectangle changed`,
    );
  if (d.variant !== "portrait")
    for (const name of ["auto", "turbo", "featureMenu", "featureTurbo"])
      assert.deepEqual(d[name], old[name], `${name} anchor changed`);
  assert.equal(d.bet.h, 64);
  assert.equal(d.ante.w, 0);
  assert.equal(d.drawer.ante, false);
  for (const name of ["minus", "plus"]) {
    assert.equal(d.bet.x + d[name].x, old.bet.x + old[name].x);
    assert.equal(d.bet.y + d[name].y, old.bet.y + old[name].y);
    // Chevron path y=9..15 in a 24-unit viewBox, with 3px stroke,
    // is contained in this conservative centered 12px ink envelope.
    assert(d[name].y + 16 >= 0 && d[name].y + 28 <= d.bet.h);
  }
  if (d.variant === "portrait") {
    assert.equal(d.height, 160);
    assert.equal(d.bet.w, 112);
    assert.equal(d.spin.x + d.spin.w / 2, d.width / 2);
    assert.equal(d.drawer.turbo, true);
    assert.equal(d.auto.y + d.auto.h / 2, d.spin.y + d.spin.h / 2);
    assert.equal(d.spin.x - d.bet.x - d.bet.w, 8);
    assert.equal(d.auto.x - d.spin.x - d.spin.w, 16);
    assert.equal(d.buy.x - d.auto.x - d.auto.w, 12);
  }
  for (const feature of [false, true]) {
    const targets = controlTargets(d, feature),
      list = Object.entries(targets);
    for (const [name, r] of list) {
      assert(r.w >= 44 && r.h >= 44, `${name}: target below 44`);
      assert(within(r, d.width, d.height), `${name}: outside dock`);
    }
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++)
        assert(
          !overlap(list[i][1], list[j][1]),
          `${c.viewport}: ${list[i][0]}/${list[j][0]} overlap`,
        );
    const modules = Object.fromEntries(
      Object.entries({
        balance: d.balance,
        win: d.win,
        bet: feature ? d.counter : d.bet,
        spin: d.spin,
        auto: feature ? null : d.auto,
        buy: feature ? null : d.buy,
        turbo: feature ? d.featureTurbo : d.turbo,
        menu: feature ? d.featureMenu : d.menu,
      }).filter(([, r]) => r?.w),
    );
    const rows = Object.entries(modules);
    for (let i = 0; i < rows.length; i++)
      for (let j = i + 1; j < rows.length; j++)
        assert(
          !overlap(rows[i][1], rows[j][1]),
          `${rows[i][0]}/${rows[j][0]} paint overlap`,
        );
    if (!feature) {
      assert(within(d.actionPlate, d.width, d.height));
      assert(overlap(d.actionPlate, d.spin) && overlap(d.actionPlate, d.auto));
      for (const [name, r] of rows.filter(
        ([name]) => !["spin", "auto"].includes(name),
      ))
        assert(
          !overlap(d.actionPlate, r),
          `Joined action plate overlaps ${name}`,
        );
    }
    geometry.push({
      viewport: c.viewport.join("x"),
      variant: d.variant,
      feature,
      targets,
      betPlate: feature ? null : d.bet,
      actionPlate: feature ? null : d.actionPlate,
      portraitAllocation: d.variant === "portrait" ? d.height : null,
      bottomClearance: d.height - Math.max(...list.map(([, r]) => r.y + r.h)),
    });
  }
}

const {
  controlReadoutTextStyle,
  controlReadoutOverflows,
  controlNumberAdvance,
  controlBetInset,
} = await import("../src/components/slot-controls/typography.ts");
const font = JSON.parse(
  execFileSync("python", [
    "-c",
    `from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
import json
f=TTFont('src/components/slot-controls/fonts/SourceSans3-700.woff2'); c=f.getBestCmap(); g=f.getGlyphSet(); bounds={}
for char in '0123456789,.':
 p=BoundsPen(g); g[c[ord(char)]].draw(p); bounds[char]=p.bounds
print(json.dumps({'em':f['head'].unitsPerEm,'weight':f['OS/2'].usWeightClass,'ascent':f['hhea'].ascent,'descent':-f['hhea'].descent,'bounds':bounds,'advances':{s:f['hmtx'][c[ord(s)]][0] for s in '0123456789,.'}}))`,
  ]).toString(),
);
assert.equal(font.weight, 700);
assert.equal(
  new Set("0123456789".split("").map((ch) => font.advances[ch])).size,
  1,
);
assert(css.includes("SourceSans3-700") && !css.includes("SourceSans3-900"));
const typography = [];
for (const c of layouts) {
  const d = c.dock,
    size = d.variant === "desktop" ? 22 : 20,
    line = d.variant === "desktop" ? 26 : 23;
  for (const [name, width, samples] of [
    ["balance", d.balance.w - 20, ["500,000", "1,234,567,890"]],
    ["win", d.win.w - 20, ["0", "48,000", "5,000,000"]],
    ["bet", d.betButton.w, ["1,000", "10,000", "15,000"]],
  ]) {
    for (const value of samples) {
      const available =
        width - (name === "bet" ? controlBetInset(value, width, size) : 0);
      const advance =
        ([...value].reduce((n, ch) => n + font.advances[ch], 0) / font.em) *
        size;
      assert(Math.abs(controlNumberAdvance(value, size) - advance) < 0.001);
      const overflow = controlReadoutOverflows(value, available, size);
      assert.equal(overflow, advance > available);
      if (name === "bet")
        assert(!overflow, `${c.viewport}: wager ${value} does not fit`);
      assert.deepEqual(controlReadoutTextStyle(value, width, size, line), {
        fontSize: size,
        lineHeight: `${line}px`,
        fontWeight: 700,
      });
      const baseline =
        (line - (size * (font.ascent + font.descent)) / font.em) / 2 +
        (size * font.ascent) / font.em;
      const top =
        baseline -
        (Math.max(...[...value].map((ch) => font.bounds[ch][3])) / font.em) *
          size;
      const bottom =
        baseline -
        (Math.min(...[...value].map((ch) => font.bounds[ch][1])) / font.em) *
          size;
      assert(top >= 0 && bottom <= line, `${value}: ink leaves line box`);
      typography.push({
        viewport: c.viewport.join("x"),
        name,
        value,
        size,
        line,
        weight: 700,
        advance,
        available,
        overflow,
      });
    }
  }
}

const noop = () => {};
const actions = Object.fromEntries(
  ["menu", "turbo", "bet", "plus", "minus", "auto", "spin", "buy"].map((k) => [
    k,
    noop,
  ]),
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
  ["ante-on", { ante: true, wager: "1,500", charge: { amount: "1,500" } }],
  [
    "maximum-ante",
    {
      bet: "10,000",
      ante: true,
      wager: "15,000",
      charge: { amount: "15,000" },
    },
  ],
  [
    "insufficient-balance",
    {
      balance: "400",
      spinDisabled: true,
      spinDisabledReason: "Insufficient balance",
    },
  ],
  ["busy", { busy: true, locked: true }],
  ["auto-active", { autoRemaining: 10, locked: true }],
  [
    "feature",
    {
      feature: { remaining: 8, multiplier: 2 },
      charge: { label: "Free spins" },
    },
  ],
  ["long-amount", { balance: "1,234,567,890", win: "1,234,567,890" }],
  [
    "restricted-hidden",
    {},
    {
      disabledTurbo: true,
      disabledAutoplay: true,
      disabledBuyFeature: true,
      disabledAnte: true,
    },
  ],
  [
    "restricted-disabled",
    {},
    {
      disabledTurbo: true,
      disabledAutoplay: true,
      disabledBuyFeature: true,
      disabledAnte: true,
      restrictedPresentation: "disable",
    },
  ],
];
const styleText = (o) =>
  Object.entries(o)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
const cases = layouts.flatMap((c) =>
  states.map(([state, delta, jurisdiction]) => {
    const g = c.game;
    const vars = Object.fromEntries(
      Object.entries({
        "game-width": g.width,
        "game-height": g.height,
        "reel-width": g.reelWidth,
        "reel-height": g.reelHeight,
        "header-height": g.header,
        "dock-height": g.dock,
        "strip-height": g.strip,
        "side-width": g.side,
        "control-left": g.controlLeft,
        "art-left": g.artLeft,
        "art-right": g.artRight,
        "dock-gap": g.dockGap,
      }).map(([k, v]) => ["--" + k, v + "px"]),
    );
    const markup = render(
      element(SlotControls, {
        layout: c.dock,
        state: { ...base, ...delta },
        actions,
        theme: KILO_CONTROL_THEME,
        bonusAnchorClassName: "kk-bonus-win",
        jurisdiction,
      }),
    );
    return {
      ...c,
      state,
      delta,
      markup,
      html: `<html><body><div class="kk-app" style='${styleText(MATERIAL_STYLE)}'><main class="kk-stage"><div class="kk-shell${delta.feature ? " is-feature" : ""}" data-layout="${g.mode}" data-framing="${g.artLeft ? "sides" : "header"}" style='${styleText(vars)}'><div class="kk-modular-controls">${markup}</div></div></main></div></body></html>`,
    };
  }),
);
function parseHtml(markup) {
  return JSON.parse(
    execFileSync(
      "python",
      [
        "-c",
        `import json,sys
from lxml import html
def node(e):
 return {'tag':e.tag,'attrs':dict(e.attrib),'text':e.text or '', 'children':[node(c) for c in e if isinstance(c.tag,str)]}
print(json.dumps([node(html.fromstring(s)) for s in json.load(sys.stdin)]))`,
      ],
      { input: JSON.stringify(markup), maxBuffer: 16 * 1024 * 1024 },
    ).toString(),
  );
}
const trees = parseHtml(cases.map((c) => c.html));
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
  assert.notEqual(result, undefined, `${property}:${value}`);
  return result;
}
const paint = [];
for (let i = 0; i < cases.length; i++) {
  const c = cases[i],
    tree = prepareTree(trees[i]),
    nodes = walk(tree),
    buttons = nodes.filter((n) => has(n, "sc-button"));
  const find = (cls) => nodes.find((n) => has(n, cls));
  const spin = find("sc-spin"),
    spinIcon = spin.children.find((n) => has(n, "sc-icon"));
  assert(spinIcon && spinIcon.children.some((n) => n.tag === "svg"));
  assert(spin.children.every((n) => has(n, "sc-icon") || has(n, "sc-sr-only")));
  assert(!find("sc-ante") && !find("sc-charge") && !find("sc-action-reason"));
  assert.equal(nodes.filter((n) => has(n, "sc-readout-card")).length, 1);
  assert(
    !nodes
      .filter((n) => has(n, "sc-label"))
      .some((n) => n.text.includes("LGC")),
  );
  const note = nodes.find((n) => n.attrs["data-testid"] === "charge-note");
  assert(
    has(note, "sc-sr-only") &&
      spin.attrs["aria-describedby"].includes(note.attrs.id),
  );
  if (c.state === "insufficient-balance") {
    assert("disabled" in spin.attrs);
    assert.equal(spin.attrs.title, "Insufficient balance");
    const reason = nodes.find((n) => n.attrs.role === "status");
    assert(has(reason, "sc-sr-only"));
    assert(spin.attrs["aria-describedby"].includes(reason.attrs.id));
  }
  if (c.delta.ante) assert.equal(find("sc-bet-number").text, c.delta.wager);
  if (c.state === "busy")
    assert.equal(spin.attrs["aria-label"], "Skip animation");
  if (c.state === "auto-active")
    assert.equal(spin.attrs["aria-label"], "Stop auto spins");
  if (c.delta.feature || c.state === "restricted-hidden")
    assert(!find("sc-action-plate") && !find("sc-auto-joined"));
  else assert(find("sc-action-plate") && find("sc-auto-joined"));
  if (c.dock.variant === "portrait" && !c.state.startsWith("restricted"))
    assert(find("sc-badge-speed"));
  for (const event of ["rest", "pressed"]) {
    const context = {
      viewport: c.viewport,
      hover: false,
      states:
        event === "rest"
          ? new Map()
          : new Map(
              buttons
                .filter((n) => !("disabled" in n.attrs))
                .map((n) => [n, new Set(["active", "focus-visible"])]),
            ),
    };
    const styles = resolveTree(tree, cascade, context);
    const spinValues = styles.get(spin).values;
    assert.equal(styles.get(spin.parent).values.position, "absolute");
    assert.equal(spinValues.width, "100%");
    assert.equal(spinValues.height, "100%");
    assert.equal(styles.get(spinIcon).values.width, "76%");
    for (const n of nodes.filter(
      (n) => has(n, "sc-circle") || has(n, "sc-spin") || has(n, "sc-well"),
    )) {
      const s = styles.get(n),
        v = s.values;
      let p = has(n, "sc-bet")
        ? Object.fromEntries(
            Object.entries(
              cascade(n, { ...context, pseudo: "before" }).values,
            ).map(([k, v]) => [k, variables(v, s.vars)]),
          )
        : v;
      const fill =
        has(n, "sc-readout") || has(n, "sc-auto-joined")
          ? "transparent"
          : has(n, "sc-spin") ||
              has(n, "sc-circle") ||
              has(n, "sc-action-plate")
            ? "#020c12"
            : "#01070b";
      const bg = declaration("background", p.background);
      assert.deepEqual(
        bg.at(-1).color,
        declaration("color", fill),
        `${c.state} ${n.attrs.class}: background`,
      );
      assert(bg.every((layer) => layer.image.type === "none"));
      for (let a = n; a; a = a.parent) {
        const av = styles.get(a).values;
        assert.equal(av.opacity, "1");
        assert.equal(av.filter, "none");
        assert.equal(av["backdrop-filter"], "none");
      }
      if (
        has(n, "sc-spin") ||
        (has(n, "sc-circle") && !has(n, "sc-auto-joined"))
      ) {
        assert.equal(v["border-top-width"], has(n, "sc-spin") ? "8px" : "2px");
        assert.equal(v["border-top-style"], "solid");
        assert.equal(declaration("color", v["border-top-color"]).alpha, 1);
      }
      const coating = Object.fromEntries(
        Object.entries(cascade(n, { ...context, pseudo: "after" }).values).map(
          ([k, v]) => [k, variables(v, s.vars)],
        ),
      );
      if (has(n, "sc-readout") || has(n, "sc-auto-joined"))
        assert.equal(coating.display, "none");
      else {
        assert.equal(coating["pointer-events"], "none");
        assert.equal(coating["z-index"], "-1");
        for (const layer of declaration("background", coating.background))
          for (const stop of layer.image.value?.items ?? [])
            if (stop.type === "color-stop") assert(stop.color.alpha <= 0.08);
      }
      if (event === "rest")
        paint.push({
          viewport: c.viewport.join("x"),
          state: c.state,
          element:
            n.attrs["data-control"] ??
            n.attrs["data-module"] ??
            n.attrs["data-testid"],
          fill,
          rim: v["border-top-width"],
          opacity: v.opacity,
        });
    }
    for (const n of nodes.filter((n) => has(n, "sc-number"))) {
      const v = styles.get(n).values,
        p = styles.get(n.parent).values;
      assert.equal(v["font-weight"], "700");
      assert.equal(num(v["font-size"]), c.dock.variant === "desktop" ? 22 : 20);
      assert.equal(v.color, "#fff8e8");
      assert.equal(v["font-variant-numeric"], "tabular-nums");
      assert(
        14 + num(p.gap) + num(v["line-height"]) <=
          num(p.height) -
            num(p["border-top-width"]) -
            num(p["border-bottom-width"]),
      );
    }
    for (const n of nodes.filter((n) => has(n, "sc-label")))
      assert.match(styles.get(n).values.font, /14px\s*\/\s*1\b/);
    for (const n of nodes.filter((n) => has(n, "sc-sr-only"))) {
      const v = styles.get(n).values;
      assert.equal(v.width, "1px");
      assert.equal(v["clip-path"], "inset(50%)");
    }
    for (const n of nodes.filter((n) => has(n, "sc-badge"))) {
      const v = styles.get(n).values;
      assert.equal(
        declaration("background", v.background).at(-1).color.alpha,
        1,
      );
    }
    for (const n of nodes.filter(
      (n) =>
        has(n, "sc-icon") &&
        (has(n.parent, "sc-circle") || has(n.parent, "sc-spin")),
    )) {
      assert.equal(styles.get(n).values.color, "#ffffff");
      for (const svg of n.children.filter((n) => n.tag === "svg"))
        assert(num(styles.get(svg).values["stroke-width"]) >= 3);
    }
    if (c.dock.variant === "portrait")
      assert.equal(
        styles.get(nodes.find((n) => has(n, "kk-shell"))).values["row-gap"],
        "18px",
      );
  }
}
const { FeaturesPanel } =
  await import("../src/components/kilo/control-panels.tsx");
const featureCases = [
  { ante: false },
  { ante: true },
  { ante: false, anteOnly: true },
  { ante: true, anteOnly: true },
  { ante: false, anteRestriction: { hidden: true, disabled: true } },
];
for (const props of featureCases) {
  const markup = render(
    element(FeaturesPanel, {
      stake: 1000,
      bank: 500000,
      locked: false,
      onAnte: noop,
      onEditBet: noop,
      onStake: noop,
      onBuy: noop,
      onClose: noop,
      ...props,
    }),
  );
  assert.equal(
    markup.includes("kk-ante-action"),
    !props.anteRestriction?.hidden,
  );
  if (props.anteOnly) {
    assert(!markup.includes("kk-feature-tabs"));
    assert(!markup.includes("kk-purchase-card"));
  } else assert(markup.includes("kk-feature-tabs"));
  if (!props.anteRestriction?.hidden)
    assert(markup.includes(props.ante ? "Ante On" : "Ante Off"));
}
const output = "public/kilo-reference-v31";
mkdirSync(output, { recursive: true });
const report = {
  checkpoint: checkpoint.commit,
  passed: true,
  method:
    "Source-derived layout, production CSS cascade on actual React SSR markup, font metrics and protected-runtime AST/hash checks. No browser screenshots or live interaction.",
  protectedSourceFiles: protectedFiles.length,
  geometry,
  typography,
  paint,
  cssFile,
  cssSha256: hash(css),
  states: cases.length,
  featurePageCases: featureCases.length,
};
writeFileSync(
  `${output}/reference-report.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      passed: true,
      protectedSourceFiles: protectedFiles.length,
      layouts: geometry.length,
      states: cases.length,
      fontCases: typography.length,
      featurePageCases: featureCases.length,
      report: `${output}/reference-report.json`,
    },
    null,
    2,
  ),
);
