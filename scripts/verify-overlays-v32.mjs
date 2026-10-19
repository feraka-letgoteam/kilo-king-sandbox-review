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
const { AutoSpinsPanel, QuickSettingsView } =
  await import("../src/components/kilo/control-overlays.tsx");
const { quickMenuLayout, QUICK_MENU: T } =
  await import("../src/components/kilo/control-overlays-layout.ts");
const { AUTO_COUNTS } = await import("../src/components/kilo/auto-spins.ts");
const checkpoint = JSON.parse(
  readFileSync("scripts/checkpoints/overlays-v32.json", "utf8"),
);
const hash = (data) => createHash("sha256").update(data).digest("hex");
const permitted = new Set([
  "src/components/kilo/play.tsx",
  "src/components/kilo/control-panels.tsx",
  "src/components/slot-controls/SlotControls.tsx",
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
assert.deepEqual(AUTO_COUNTS, [10, 25, 50]);
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
        assert.equal(p.height, 174 + (p.inline && expanded ? 60 : 0));
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
  if (v.height === 180) assert(p.scroll && p.inline);
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
          stake: 10000,
          cost: 15000,
          ante: true,
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
    const start = find("kk-auto-start");
    assert.equal("disabled" in start.attrs, c.disabled);
    assert(num(styles.get(start).values["min-height"]) >= 44);
    assert(num(val("kk-auto-close").width) >= 44);
    assert(num(val("kk-auto-close").height) >= 44);
    assert(!c.markup.includes("∞"));
    assert(c.markup.includes((15000 * c.count).toLocaleString("en-US")));
    if (c.disabled)
      assert.equal(start.attrs["aria-describedby"], "kk-auto-disabled-reason");
    if (c.viewport[1] === 390)
      assert.match(card["grid-template-columns"], /repeat\(2/);
    paint.push({
      kind: "auto",
      viewport: c.viewport,
      count: c.count,
      disabled: c.disabled,
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
      assert.equal(num(styles.get(row).values.height), 52);
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
      assert.equal(num(val("kk-quick-volume").height), 60);
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
const output = "public/kilo-overlays-v32";
mkdirSync(output, { recursive: true });
const report = {
  passed: true,
  checkpoint: checkpoint.commit,
  method:
    "React SSR, production CSS cascade, deterministic popup bounds, UI callbacks and protected source/AST comparison. No browser screenshots or live interaction.",
  protectedSourceFiles: protectedFiles.length,
  geometryCases: geometry.length,
  renderCases: cases.length,
  geometry,
  paint,
  cssFile,
  cssSha256: hash(css),
};
writeFileSync(
  `${output}/overlay-report.json`,
  JSON.stringify(report, null, 2) + "\n",
);
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
