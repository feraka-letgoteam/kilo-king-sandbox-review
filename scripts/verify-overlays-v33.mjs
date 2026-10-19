// v33 simplified Auto and compact quick menu: source geometry, React SSR and production CSS.
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
const { AutoSpinsPanel, QuickSettingsView } =
  await import("../src/components/kilo/control-overlays.tsx");
const { quickMenuLayout, QUICK_MENU: T } =
  await import("../src/components/kilo/control-overlays-layout.ts");
const { AUTO_COUNTS } = await import("../src/components/kilo/auto-spins.ts");
const checkpoint = JSON.parse(
  readFileSync("scripts/checkpoints/overlays-v33.json", "utf8"),
);
const hash = (data) => createHash("sha256").update(data).digest("hex");
const permitted = new Set([
  "src/components/kilo/play.tsx",
  "src/components/kilo/control-overlays.tsx",
  "src/components/kilo/control-overlays.css",
  "src/components/kilo/control-overlays-layout.ts",
  "src/components/kilo/auto-spins.ts",
]);
const protectedFiles = Object.keys(checkpoint.sourceFiles).filter(
  (p) => !permitted.has(p) && !p.endsWith(".md"),
);
for (const p of protectedFiles)
  assert.equal(
    hash(readFileSync(p)),
    checkpoint.sourceFiles[p],
    `Protected source changed: ${p}`,
  );
assert.deepEqual(AUTO_COUNTS, [10, 25, 50, 75, 100, 250, 500, 1000]);
const autoSource = readFileSync("src/components/kilo/auto-spins.ts", "utf8");
assert.equal(
  autoSource.replace(/export const AUTO_COUNTS = \[[^;]+;/, "COUNTS"),
  checkpoint.sources["src/components/kilo/auto-spins.ts"].replace(
    /export const AUTO_COUNTS = \[[^;]+;/,
    "COUNTS",
  ),
  "Scheduler changed beyond the requested finite count choices",
);
const { createAutoSpins } =
  await import("../src/components/kilo/auto-spins.ts");
for (const count of [10, 75, 1000]) {
  let calls = 0;
  let finish;
  const done = new Promise((resolve) => {
    finish = resolve;
  });
  const runner = createAutoSpins(
    (remaining) => {
      if (!remaining) finish();
    },
    async () => {},
  );
  assert(
    runner.start(count, async () => {
      calls++;
      return { feature: false };
    }),
  );
  await done;
  assert.equal(calls, count);
  assert.equal(runner.remaining, 0);
}
for (const invalid of [0, 1, 51, 1001, Infinity, NaN]) {
  const runner = createAutoSpins(() => {});
  assert.equal(
    runner.start(invalid, async () => {
      throw Error("Invalid run started");
    }),
    false,
  );
}

const parse = (s) =>
  ts.createSourceFile(
    "component.tsx",
    s,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
const printer = ts.createPrinter({ removeComments: true }),
  print = (n, f) => printer.printNode(ts.EmitHint.Unspecified, n, f);
const collect = (f, predicate) => {
  const all = [];
  function visit(n) {
    if (predicate(n)) all.push(n);
    ts.forEachChild(n, visit);
  }
  visit(f);
  return all;
};
const previous = parse(checkpoint.sources["src/components/kilo/play.tsx"]),
  current = parse(readFileSync("src/components/kilo/play.tsx", "utf8"));
const gameplayFunctions = (f) =>
  collect(
    f,
    (n) =>
      ts.isFunctionDeclaration(n) &&
      !["KiloTable", "Dialog"].includes(n.name?.text),
  ).map((n) => print(n, f));
assert.deepEqual(
  gameplayFunctions(current),
  gameplayFunctions(previous),
  "Gameplay/settlement functions changed",
);
const startHandler = (f) =>
  collect(
    f,
    (n) =>
      ts.isArrowFunction(n) &&
      n.body.getText(f).includes("const fixedMode = mode;"),
  ).map((n) => print(n, f));
assert.equal(startHandler(current).length, 1);
assert.deepEqual(
  startHandler(current),
  startHandler(previous),
  "Auto start guard changed",
);
const startDisabled = (f) =>
  collect(
    f,
    (n) =>
      ts.isJsxAttribute(n) &&
      n.name.text === "disabled" &&
      n.getText(f).includes("splashStakeOk(stake, mode)"),
  ).map((n) => print(n, f));
assert.deepEqual(
  startDisabled(current),
  startDisabled(previous),
  "Auto eligibility changed",
);
for (const name of ["spin", "auto", "buy", "bet", "plus", "minus", "turbo"]) {
  const actions = (f) =>
    collect(
      f,
      (n) =>
        ts.isPropertyAssignment(n) &&
        n.name.getText(f) === name &&
        ts.isArrowFunction(n.initializer),
    ).map((n) => print(n, f));
  assert.deepEqual(
    actions(current),
    actions(previous),
    `${name} action changed`,
  );
}
// The only pre-render changes are a menu anchor, preferences-open state and
// adding that state to the same shortcut-blocking / Auto-pause predicates.
const runtime = (f) => {
  const fn = f.statements.find(
    (n) => ts.isFunctionDeclaration(n) && n.name?.text === "KiloTable",
  );
  const nodes = fn.body.statements
    .filter((n) => !ts.isReturnStatement(n))
    .filter(
      (n) =>
        !(
          ts.isVariableStatement(n) &&
          n.declarationList.declarations.some((d) =>
            ["menuButton", "[preferencesOpen, setPreferencesOpen]"].includes(
              d.name.getText(f),
            ),
          )
        ),
    );
  const transformed = ts.transform(nodes, [
    (context) => (root) => {
      const visit = (n) => {
        if (
          ts.isBinaryExpression(n) &&
          n.operatorToken.kind === ts.SyntaxKind.BarBarToken &&
          ts.isIdentifier(n.right) &&
          n.right.text === "preferencesOpen"
        )
          return ts.visitNode(n.left, visit);
        if (ts.isArrayLiteralExpression(n))
          return ts.factory.updateArrayLiteralExpression(
            n,
            n.elements.filter(
              (e) => !(ts.isIdentifier(e) && e.text === "preferencesOpen"),
            ),
          );
        return ts.visitEachChild(n, visit, context);
      };
      return ts.visitNode(root, visit);
    },
  ]);
  const tokens = (text) => {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, true);
    scanner.setText(text);
    const out = [];
    while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken)
      out.push(scanner.getTokenText());
    return out;
  };
  const result = transformed.transformed.map((n) => tokens(print(n, f)));
  transformed.dispose();
  return result;
};
assert.deepEqual(
  runtime(current),
  runtime(previous),
  "Unexpected pre-render runtime change",
);
const beforeControls = parse(
    checkpoint.sources["src/components/slot-controls/SlotControls.tsx"],
  ),
  afterControls = parse(
    readFileSync("src/components/slot-controls/SlotControls.tsx", "utf8"),
  );
for (const attr of ["onClick", "disabled", "aria-disabled"])
  assert.deepEqual(
    collect(
      afterControls,
      (n) => ts.isJsxAttribute(n) && n.name.text === attr,
    ).map((n) => print(n, afterControls)),
    collect(
      beforeControls,
      (n) => ts.isJsxAttribute(n) && n.name.text === attr,
    ).map((n) => print(n, beforeControls)),
  );

const inside = (r, v) =>
  r.x >= v.x + 12 - 0.01 &&
  r.y >= v.y + 12 - 0.01 &&
  r.x + r.width <= v.x + v.width - 12 + 0.01 &&
  r.y + r.height <= v.y + v.height - 12 + 0.01;
const viewports = [
  [1440, 900],
  [390, 844],
  [360, 800],
  [844, 390],
];
const geometry = [];
for (const [w, h] of viewports) {
  const v = { x: 0, y: 0, width: w, height: h };
  for (const x of [0, w * 0.25, w * 0.5, w - 44])
    for (const y of [0, h * 0.25, h * 0.5, h - 44])
      for (const expanded of [false, true]) {
        const p = quickMenuLayout(v, { x, y, width: 44, height: 44 }, expanded);
        assert(inside(p, v), `${w}x${h}: menu leaves viewport`);
        assert(p.width >= 44 && p.height >= 44);
        assert.equal(p.height, 146 + (p.inline && expanded ? 56 : 0));
        if (w <= 390) assert(p.inline, "Phone sliders must stay inside popup");
        if (expanded && !p.inline)
          for (const index of [1, 2]) {
            const flyout = {
              x:
                p.side === "right"
                  ? p.x + p.width + T.gap
                  : p.x - T.gap - T.flyoutWidth,
              y:
                p.y +
                T.padding +
                T.border +
                index * T.row +
                (T.row - T.sliderHeight) / 2,
              width: T.flyoutWidth,
              height: T.sliderHeight,
            };
            assert(inside(flyout, v), "Flyout leaves viewport");
          }
        geometry.push({
          viewport: `${w}x${h}`,
          anchor: { x, y, width: 44, height: 44 },
          expanded,
          ...p,
        });
      }
}
// Offset visual viewport (zoom/browser chrome) and tiny-height scroll fallback.
for (const v of [
  { x: 40, y: 80, width: 360, height: 500 },
  { x: 0, y: 0, width: 320, height: 180 },
]) {
  const p = quickMenuLayout(
    v,
    { x: v.x + 220, y: v.y + 120, width: 44, height: 44 },
    true,
  );
  assert(inside(p, v));
  if (v.height === 180 && p.inline) assert(p.scroll);
}
const separation = (a, b) =>
  Math.max(
    a.x - b.x - b.width,
    b.x - a.x - a.width,
    a.y - b.y - b.height,
    b.y - a.y - a.height,
  );
const dockGeometry = [];
for (const [w, h] of viewports) {
  const pad = w <= 620 ? 12 : 16;
  const g = fitGameLayout(w - pad * 2, h - pad - (w <= 620 ? 20 : 24));
  const d = createControlLayout({
    variant: g.mode === "wide" ? "desktop" : g.mode,
    width:
      g.mode === "landscape"
        ? g.width
        : g.mode === "portrait"
          ? g.reelWidth
          : Math.max(760, g.reelWidth),
    height: g.dock,
    footerWidth: g.reelWidth,
  });
  if (d.variant === "portrait") assert.equal(d.height, 160);
  const sx = (w - g.width) / 2;
  const dx =
    d.variant === "landscape"
      ? sx
      : g.artLeft
        ? sx + g.artLeft + (g.reelWidth - d.width) / 2
        : (w - d.width) / 2;
  const dy =
    d.variant === "landscape"
      ? pad
      : pad + g.header + g.reelHeight + (d.variant === "portrait" ? 18 : 32);
  for (const feature of [false, true]) {
    const boxes = [
      d.balance,
      d.win,
      d.spin,
      feature ? d.counter : d.bet,
      ...Object.values(controlTargets(d, feature)),
      ...(!feature && d.actionPlate.w ? [d.actionPlate] : []),
    ]
      .filter((r) => r.w > 0 && r.h > 0)
      .map((r) => ({ x: dx + r.x, y: dy + r.y, width: r.w, height: r.h }));
    // The shared Balance/Win card covers the gap between its two amounts.
    boxes.push({
      x: dx + Math.min(d.balance.x, d.win.x),
      y: dy + Math.min(d.balance.y, d.win.y),
      width:
        Math.max(d.balance.x + d.balance.w, d.win.x + d.win.w) -
        Math.min(d.balance.x, d.win.x),
      height:
        Math.max(d.balance.y + d.balance.h, d.win.y + d.win.h) -
        Math.min(d.balance.y, d.win.y),
    });
    const menu = feature ? d.featureMenu : d.menu;
    const speed = (feature ? d.featureTurbo : d.turbo).w
      ? feature
        ? d.featureTurbo
        : d.turbo
      : menu;
    boxes.push({
      x: dx + speed.x + speed.w - 25,
      y: dy + speed.y - 3,
      width: 28,
      height: 18,
    });
    const anchor = {
      x: dx + menu.x,
      y: dy + menu.y,
      width: menu.w,
      height: menu.h,
    };
    for (const expanded of [false, true]) {
      const v = { x: 0, y: 0, width: w, height: h };
      const p = quickMenuLayout(v, anchor, expanded, boxes);
      assert(p.clear, `${w}x${h}: no clear popup placement`);
      assert(inside(p, v));
      const footprint = [p];
      if (expanded && !p.inline)
        for (const index of [1, 2])
          footprint.push({
            x:
              p.side === "right"
                ? p.x + p.width + T.gap
                : p.x - T.gap - T.flyoutWidth,
            y:
              p.y +
              T.padding +
              T.border +
              index * T.row +
              (T.row - T.sliderHeight) / 2,
            width: T.flyoutWidth,
            height: T.sliderHeight,
          });
      const clearance = Math.min(
        ...footprint.flatMap((r) => boxes.map((b) => separation(r, b))),
      );
      assert(
        clearance >= 12 - 0.001,
        `${w}x${h}: popup/slider crowds controls: ${clearance}`,
      );
      for (const r of footprint) assert(inside(r, v));
      dockGeometry.push({
        viewport: [w, h],
        feature,
        expanded,
        anchor,
        placement: p,
        clearance,
        controlRectangles: boxes,
      });
    }
  }
}
const noop = () => {};
const walkElements = (node) =>
  Array.isArray(node)
    ? node.flatMap(walkElements)
    : node && typeof node === "object" && node.props
      ? [node, ...walkElements(node.props.children)]
      : [];
let changes = [],
  expandedChanges = [],
  info = 0,
  closed = 0;
const props = {
  audioAvailable: true,
  musicVolume: 70,
  effectsVolume: 85,
  onVolume: (...v) => changes.push(v),
  onInfo: () => info++,
  onClose: () => closed++,
  onExpand: (v) => expandedChanges.push(v),
  placement: quickMenuLayout(
    { x: 0, y: 0, width: 390, height: 844 },
    { x: 315, y: 450, width: 44, height: 44 },
    true,
  ),
};
for (const channel of ["music", "effects"]) {
  let tree = walkElements(QuickSettingsView({ ...props, expanded: channel }));
  const input = tree.find((n) => n.type === "input");
  assert.equal(input.props.step, "5");
  input.props.onChange({ target: { value: "0" } });
  input.props.onChange({ target: { value: "100" } });
  tree
    .find((n) => n.type === "button" && n.props["data-channel"] === channel)
    .props.onClick();
}
assert.deepEqual(
  changes,
  [
    [0, 85],
    [100, 85],
    [70, 0],
    [70, 100],
  ],
  "Slider changes the other channel",
);
assert.deepEqual(expandedChanges, [null, null]);
const closedTree = walkElements(
  QuickSettingsView({ ...props, expanded: null }),
);
closedTree
  .find((n) => n.type === "button" && n.props["data-channel"] === "music")
  .props.onClick();
closedTree
  .find((n) => n.type === "button" && !n.props["data-channel"])
  .props.onClick();
closedTree
  .find((n) => n.props.className === "kk-quick-dismiss")
  .props.onClick();
assert.equal(expandedChanges.at(-1), "music");
assert.equal(info, 1);
assert.equal(closed, 1);
const unavailable = walkElements(
  QuickSettingsView({ ...props, audioAvailable: false, expanded: null }),
);
const before = expandedChanges.length;
unavailable.find((n) => n.props["data-channel"] === "music").props.onClick();
assert.equal(expandedChanges.length, before);

const html = readFileSync("dist/index.html", "utf8");
const cssFile = "dist" + html.match(/href="([^\"]+\.css)"/)[1];
const css = readFileSync(cssFile, "utf8");
const cascade = productionCascade(
  css
    .replaceAll(":first-of-type", ":nth-of-type(1)")
    .replace(/,\s+(?=env\()/g, ","),
);
const walk = (n) => [n, ...n.children.flatMap(walk)];
const has = (n, cls) => (n.attrs.class ?? "").split(/\s+/).includes(cls);
const num = (v) => parseFloat(v ?? "0") || 0;
const styleText = (o) =>
  Object.entries(o)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
const wrap = (content) =>
  `<html><body><div class="kk-app" data-material="marina" data-reduced="0" style='${styleText(MATERIAL_STYLE)}'>${content}</div></body></html>`;
const cases = [];
for (const viewport of viewports) {
  for (const count of AUTO_COUNTS)
    for (const disabled of [false, true]) {
      const markup = render(
        element(AutoSpinsPanel, {
          count,
          cost: 15000,
          disabled,
          disabledReason: disabled ? "Insufficient balance" : undefined,
          onCount: noop,
          onStart: noop,
          onClose: noop,
        }),
      );
      cases.push({
        kind: "auto",
        viewport,
        count,
        disabled,
        markup,
        html: wrap(
          `<div id="kilo-auto-takeover" class="kk-modal-root is-blocking"><div class="kk-scrim"></div><div class="kk-dialog kk-auto-takeover" role="dialog" aria-modal="true">${markup}</div></div>`,
        ),
      });
    }
  for (const expanded of [null, "music", "effects"]) {
    const p = quickMenuLayout(
      { x: 0, y: 0, width: viewport[0], height: viewport[1] },
      { x: viewport[0] * 0.6, y: viewport[1] * 0.7, width: 44, height: 44 },
      !!expanded,
    );
    const markup = render(
      element(QuickSettingsView, { ...props, placement: p, expanded }),
    );
    cases.push({
      kind: "menu",
      viewport,
      expanded,
      placement: p,
      markup,
      html: wrap(markup),
    });
  }
}
const trees = JSON.parse(
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
    {
      input: JSON.stringify(cases.map((c) => c.html)),
      maxBuffer: 16 * 1024 * 1024,
    },
  ).toString(),
);
function declaration(property, value) {
  let out;
  transformStyleAttribute({
    code: Buffer.from(`${property}:${value}`),
    visitor: {
      Declaration(d) {
        if (d.property === property) out = d.value;
      },
    },
  });
  assert.notEqual(out, undefined, `${property}:${value}`);
  return out;
}
const paint = [];
for (let i = 0; i < cases.length; i++) {
  const c = cases[i],
    tree = prepareTree(trees[i]),
    nodes = walk(tree),
    styles = resolveTree(tree, cascade, { viewport: c.viewport, hover: false });
  const find = (cls) => nodes.find((n) => has(n, cls)),
    val = (cls) => styles.get(find(cls)).values;
  if (c.kind === "auto") {
    const root = val("kk-modal-root"),
      dialog = val("kk-auto-takeover"),
      card = val("kk-autoplay-card");
    assert.equal(root.position, "fixed");
    for (const edge of ["top", "right", "bottom", "left"])
      assert.equal(num(root[edge]), 0);
    assert.equal(root["padding-top"], "0");
    assert.equal(root["align-items"], "center");
    assert.equal(dialog.width, "100%");
    assert.equal(dialog.height, "100%");
    assert.equal(dialog["border-radius"], "0");
    assert.equal(dialog["border-bottom-width"], "0");
    assert.equal(dialog["overflow-y"], "auto");
    assert.equal(val("kk-scrim")["backdrop-filter"], "blur(12px)");
    assert.equal(
      declaration("background", card.background).at(-1).color.alpha,
      1,
    );
    const counts = nodes.filter(
      (n) => n.tag === "button" && has(n.parent, "kk-auto-count-grid"),
    );
    assert.deepEqual(
      counts.map((n) => Number(n.text)),
      AUTO_COUNTS,
    );
    assert.equal(
      counts.filter((n) => n.attrs["aria-pressed"] === "true").length,
      1,
    );
    for (const n of counts) assert(num(styles.get(n).values.height) >= 44);
    // Bound the actual CSS grid and flow, including the disabled reason, at
    // each target viewport. Font ascent/painting still needs live review.
    const w = c.viewport[0],
      h = c.viewport[1];
    const landscape = h <= 500 && w > h;
    const cardWidth = Math.min(
      landscape ? 560 : 600,
      w - (landscape ? 96 : w <= 620 ? 24 : 32),
    );
    const cp = num(card["padding-top"]),
      cb = num(card["border-top-width"]);
    const gridGap = num(val("kk-auto-count-grid").gap);
    const countWidth = (cardWidth - cp * 2 - cb * 2 - gridGap * 3) / 4;
    assert(countWidth >= 44);
    const countStyle = styles.get(counts[0]).values;
    const font = declaration("font", countStyle.font);
    const countFontSize =
      num(countStyle["font-size"]) || font.size.value.value.value;
    // 1000 is the longest choice; 0.55 em is above this font's tabular advance.
    assert(
      countWidth - num(countStyle["padding-left"]) * 2 - 4 >=
        countFontSize * 0.55 * 4,
    );
    const roundsHeight =
      22 +
      num(val("kk-auto-rounds")["margin-bottom"]) +
      num(
        styles.get(nodes.find((n) => n.tag === "h2")).values["margin-bottom"],
      ) +
      num(countStyle.height) * 2 +
      gridGap;
    const stopHeight = num(val("kk-auto-stop-policy")["padding-top"]) + 1 + 36;
    const startHeight = Math.max(
      num(val("kk-auto-start")["min-height"]),
      24 + num(val("kk-auto-start")["padding-top"]) * 2 + 4,
    );
    const footerHeight =
      startHeight +
      18 +
      num(val("kk-auto-cost")["margin-top"]) +
      (c.disabled ? 28 : 0);
    const cardHeight =
      cp * 2 +
      cb * 2 +
      num(card.gap) * 2 +
      roundsHeight +
      stopHeight +
      footerHeight;
    const availableHeight = h - (landscape ? 32 : w <= 620 ? 76 : 100);
    assert(
      cardHeight <= availableHeight,
      `${w}x${h}: Auto card ${cardHeight} > ${availableHeight}`,
    );
    c.cardBounds = {
      width: cardWidth,
      height: cardHeight,
      countWidth,
      availableHeight,
    };
    const start = find("kk-auto-start");
    assert.equal("disabled" in start.attrs, c.disabled);
    assert(num(styles.get(start).values["min-height"]) >= 44);
    assert(num(val("kk-auto-close").width) >= 44);
    assert(num(val("kk-auto-close").height) >= 44);
    assert(!c.markup.includes("∞"));
    assert(c.markup.includes("15,000"));
    assert(
      !/Maximum total charge|Base bet|LGC|Each spin is charged/.test(c.markup),
    );
    assert.equal(start.attrs["aria-label"], `Start ${c.count} auto spins`);
    assert.match(
      val("kk-auto-count-grid")["grid-template-columns"],
      /repeat\(4/,
    );
    if (c.disabled)
      assert.equal(
        start.attrs["aria-describedby"],
        "kk-auto-cost kk-auto-disabled-reason",
      );

    paint.push({
      kind: "auto",
      viewport: c.viewport,
      count: c.count,
      disabled: c.disabled,
      cardBounds: c.cardBounds,
      root: { position: root.position, top: root.top, padding: root.padding },
      dialog: {
        width: dialog.width,
        height: dialog.height,
        overflow: dialog["overflow-y"],
      },
      card: {
        width: card.width,
        padding: card.padding,
        gap: card.gap,
        columns: card["grid-template-columns"],
      },
      blur: val("kk-scrim")["backdrop-filter"],
    });
  } else {
    const rows = nodes.filter((n) => has(n, "kk-quick-row"));
    assert.equal(rows.length, 3);
    for (const row of rows)
      assert.equal(num(styles.get(row).values.height), 44);
    assert.equal(
      declaration("font", val("kk-quick-row").font).size.value.value.value,
      17,
    );
    assert.equal(val("kk-quick-menu").width, "168px");
    assert.equal(find("kk-quick-menu").attrs.tabindex, "-1");
    assert(!c.markup.includes("Unavailable</small>"));
    assert.equal(
      declaration("background", val("kk-quick-dismiss").background).at(-1).color
        .alpha,
      0,
    );
    assert.equal(val("kk-quick-menu").position, "absolute");
    assert.equal(val("kk-quick-menu").visibility, "visible");
    if (c.expanded) {
      const slider = nodes.find((n) => n.tag === "input");
      assert.equal(slider.attrs.type, "range");
      assert.equal(styles.get(slider).values.height, "44px");
      assert.equal(
        val("kk-quick-volume").position,
        c.placement.inline ? "relative" : "absolute",
      );
      assert.equal(num(val("kk-quick-volume").height), 56);
      if (c.placement.inline)
        assert.equal(val("kk-quick-volume").width, "100%");
    }
    paint.push({
      kind: "menu",
      viewport: c.viewport,
      expanded: c.expanded,
      placement: c.placement,
      rows: rows.map((n) => styles.get(n).values.height),
    });
  }
}
const output = "public/kilo-overlays-v33";
mkdirSync(output, { recursive: true });
const report = {
  passed: true,
  checkpoint: checkpoint.commit,
  method:
    "React SSR, production CSS cascade, deterministic popup bounds, UI callbacks and protected source/AST comparison. No browser screenshots or live interaction.",
  protectedSourceFiles: protectedFiles.length,
  geometryCases: geometry.length,
  dockGeometry,
  renderCases: cases.length,
  finiteSchedulerChecks: [10, 75, 1000],
  geometry,
  paint,
  cssFile,
  cssSha256: hash(css),
};
writeFileSync(
  `${output}/overlay-report.json`,
  JSON.stringify(report, null, 2) + "\n",
);
for (const root of ["dist", "dist-review"]) {
  if (!existsSync(root)) continue;
  const destination = `${root}/kilo-overlays-v33`;
  mkdirSync(destination, { recursive: true });
  for (const name of ["overlay-report.json", "OVERLAY_VERIFICATION.md"]) {
    if (existsSync(`${output}/${name}`))
      writeFileSync(
        `${destination}/${name}`,
        readFileSync(`${output}/${name}`),
      );
  }
}
console.log(
  JSON.stringify(
    {
      passed: true,
      protectedSourceFiles: protectedFiles.length,
      geometryCases: geometry.length,
      renderCases: cases.length,
      report: `${output}/overlay-report.json`,
    },
    null,
    2,
  ),
);
