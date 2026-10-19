// v39 portrait grouping: actual production cascade, DOM bounds and painted bounds. No browser QA.
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
const { SlotControls } =
  await import("../src/components/slot-controls/SlotControls.tsx");
const { createControlLayout, controlTargets } =
  await import("../src/components/slot-controls/layout.ts");
const { fitGameLayout } = await import("../src/components/kilo/layout.ts");
const { KILO_CONTROL_THEME } =
  await import("../src/components/kilo/control-theme.ts");
const checkpoint = "de4abe70aa06d32feac8bdfa3c80be1c18ee016c";
const sha = (x) => createHash("sha256").update(x).digest("hex");
const original = (path) =>
  execFileSync("git", ["show", `${checkpoint}:${path}`], { encoding: "utf8" });
const protectedSources = {};
for (const path of [
  "src/lib/kilo/engine.ts",
  "src/lib/kilo/bank.ts",
  "src/components/kilo/director.ts",
  "src/components/kilo/pixiStage.ts",
  "src/components/kilo/layout.ts",
  "src/components/kilo/stage-art.ts",
  "src/components/kilo/base-scene.css",
  "src/components/kilo/control-model.ts",
  "src/components/kilo/feature-catalog.ts",
  "src/components/kilo/auto-spins.ts",
  "src/components/kilo/control-panels.tsx",
  "src/components/kilo/control-overlays.tsx",
  "src/components/kilo/info-panel.tsx",
  "src/components/kilo/info-panel.css",
  "src/components/kilo/play.tsx",
  "src/components/slot-controls/tokens.ts",
  "src/components/kilo/feature-takeover.tsx",
  "src/components/kilo/feature-takeover.css",
]) {
  assert.equal(
    sha(readFileSync(path)),
    sha(original(path)),
    `Protected source changed: ${path}`,
  );
  protectedSources[path] = sha(original(path));
}
const play = readFileSync("src/components/kilo/play.tsx", "utf8");
const normalizePlay = (text) =>
  text
    .replace(/import \{ FeatureTakeover \} from "\.\/feature-takeover";\n/, "")
    .replace(/  FeaturesPanel,\n/, "")
    .replace("<FeatureTakeover", "<FeaturesPanel")
    .replace(/\s+rootId="kilo-features-takeover"/, "")
    .replace("kk-dialog kk-feature-takeover", "kk-dialog kk-purchases")
    .replace(/  const \[stageHeight, setStageHeight\] = useState\(800\);\n/, "")
    .replace(/  const \[stageWidth, setStageWidth\] = useState\(1100\);\n/, "")
    .replace(/\s+setStageHeight\(entry.contentRect.height\);/, "")
    .replace(/\s+setStageWidth\(entry.contentRect.width\);/, "")
    .replace(
      /const dock = createControlLayout\(\{[\s\S]*?\n  \}\);/,
      "const dock = PRESENTATION_LAYOUT;",
    )
    .replace("layout.height + dock.height - layout.dock", "layout.height")
    .replace(
      '"--dock-height": `${dock.height}px`',
      '"--dock-height": `${layout.dock}px`',
    )
    .replace(/data-control-system="v\d+"/, 'data-control-system="VERSION"')
    .replace(/\s+/g, "");
assert.equal(
  normalizePlay(play),
  normalizePlay(original("src/components/kilo/play.tsx")),
  "Runtime changed outside presentation integration",
);
const playAst = ts.createSourceFile(
  "play.tsx",
  play,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
function declaration(ast, name) {
  let found;
  function visit(n) {
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name) found = n;
    ts.forEachChild(n, visit);
  }
  visit(ast);
  assert(found, name);
  return found;
}
const dockExpression = declaration(playAst, "dock").initializer.getText(
  playAst,
);
const hostDock = Function(
  "createControlLayout",
  "layout",
  "stageHeight",
  "stageWidth",
  `return ${dockExpression}`,
);
const builtDoc = readFileSync("dist/index.html", "utf8");
const cssFile = "dist" + builtDoc.match(/href="([^\"]+\.css)"/)[1];
const css = readFileSync(cssFile, "utf8");
const cascade = productionCascade(
  css
    .replaceAll(":first-of-type", ":nth-of-type(1)")
    .replace(/,\s+(?=env\()/g, ","),
);
const parse = (markups) =>
  JSON.parse(
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
      { input: JSON.stringify(markups), maxBuffer: 32 * 1024 * 1024 },
    ),
  );
const walk = (n) => [n, ...n.children.flatMap(walk)];
const has = (n, c) => (n.attrs.class ?? "").split(/\s+/).includes(c);
const { controlNumberAdvance } =
  await import("../src/components/slot-controls/typography.ts");
const oldLayout = await import(
  "data:text/javascript;base64," +
    Buffer.from(
      transpile(original("src/components/slot-controls/layout.ts")).replace(
        'from "./tokens.ts"',
        `from "data:text/javascript;base64,${Buffer.from(transpile(original("src/components/slot-controls/tokens.ts"))).toString("base64")}"`,
      ),
    ).toString("base64")
);
const { stageArtLayout } = await import("../src/components/kilo/stage-art.ts");
const noop = () => {};
const actions = Object.fromEntries(
  ["menu", "turbo", "bet", "minus", "plus", "auto", "spin", "buy"].map(
    (key) => [key, noop],
  ),
);
const state = {
  balance: "1,234,567,890",
  win: "5,000,000",
  bet: "10,000",
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
  charge: { amount: "10,000" },
};
const intersects = (a, b) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.01 &&
  Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.01;
const fontSize = (s) =>
  Number.parseFloat(s["font-size"] ?? s.font.match(/([\d.]+)px/)[1]);
function px(value) {
  const expression = String(value)
    .replace(/env\(safe-area-inset-(?:top|right|bottom|left)\)/g, "0")
    .replace(/px/g, "")
    .replace(/calc\(/g, "(")
    .replace(/max\(/g, "Math.max(")
    .replace(/min\(/g, "Math.min(");
  assert(
    /^[\d\s.,()+\-*/]+$/.test(expression.replace(/Math\.(?:min|max)/g, "")),
    `Unexpected length ${value}`,
  );
  return Function(`return (${expression})`)();
}
const cssRect = (s) => ({
  x: px(s.left),
  y: px(s.top),
  w: px(s.width),
  h: px(s.height),
});
const cases = [],
  layouts = [];
for (const viewport of [
  [360, 800],
  [390, 844],
  [320, 740],
  [844, 390],
  [1440, 900],
  [1920, 1080],
])
  for (const reviewHeight of [0, 44]) {
    const small = viewport[0] <= 900,
      width = viewport[0] - (small ? 24 : 32),
      height = viewport[1] - reviewHeight - (small ? 32 : 40),
      game = fitGameLayout(width, height),
      d = hostDock(createControlLayout, game, height, width),
      previous = oldLayout.createControlLayout({
        variant: d.variant,
        width: d.width,
        height: d.height,
        footerWidth: d.footerWidth,
      });
    if (d.variant !== "portrait")
      assert.deepEqual(d, previous, "Desktop/landscape geometry changed");
    else {
      assert.equal(d.height, 160);
      assert.equal(d.spin.w, previous.spin.w);
      assert.equal(d.bet.w, previous.bet.w);
      assert.equal(d.actionPlate.w, 0, "Joined Auto plate remains in portrait");
      assert.equal(d.spin.x + d.spin.w / 2, d.width / 2, "Spin not centered");
      assert.equal(d.auto.x, d.turbo.x);
      assert.equal(d.buy.x, d.menu.x);
      assert.equal(d.auto.y, d.buy.y);
      assert.equal(d.turbo.y, d.menu.y);
      assert.equal(
        d.buy.x - d.auto.x - 44,
        d.turbo.y - d.auto.y - 44,
        "Secondary row/column gaps differ",
      );
      const gap = viewport[0] === 320 ? 8 : 12;
      assert.equal(d.buy.x - d.auto.x - 44, gap);
      assert(d.spin.x - d.bet.x - d.bet.w >= 8);
      assert(d.auto.x - d.spin.x - d.spin.w >= 8);
      assert(d.auto.y - d.balance.y - d.balance.h >= 8);
      assert.equal(d.featureTurbo.y, d.featureMenu.y);
      assert.equal(d.featureTurbo.x, d.auto.x);
      assert.equal(d.featureMenu.x, d.buy.x);
      assert.equal(d.featureTurbo.y + 22, d.spin.y + d.spin.h / 2);
      assert.equal(d.counter.y + d.counter.h / 2, d.spin.y + d.spin.h / 2);
      assert(controlNumberAdvance(state.bet, 18) <= d.betButton.w);
      assert(controlNumberAdvance(state.balance, 18) <= d.balance.w - 20);
    }
    for (const feature of [false, true]) {
      const targets = Object.entries(controlTargets(d, feature));
      for (const [key, r] of targets) {
        assert(r.w >= 44 && r.h >= 44, `${key} too small`);
        assert(
          r.x >= 0 &&
            r.y >= 0 &&
            r.x + r.w <= d.width + 0.1 &&
            r.y + r.h <= d.height + 0.1,
          `${key} outside dock`,
        );
        for (const [other, s] of targets)
          if (key < other)
            assert(!intersects(r, s), `${key}/${other} hit overlap`);
        for (const readout of [d.balance, d.win])
          assert(!intersects(r, readout), `${key}/readout overlap`);
        if (feature)
          assert(!intersects(r, d.counter), `${key}/feature counter overlap`);
      }
      for (const speed of ["normal", "turbo", "super"])
        cases.push({
          viewport,
          reviewHeight,
          game,
          d,
          state: {
            ...state,
            speed,
            ...(feature ? { feature: { remaining: 8, multiplier: 2 } } : {}),
          },
        });
    }
    layouts.push({ viewport, reviewHeight, game, d, previous });
  }
const phone = cases.find((c) => c.viewport[0] === 360);
for (const extra of [
  { menuOpen: true },
  {
    spinDisabled: true,
    spinDisabledReason: "Insufficient balance",
    charge: { amount: "1,000" },
  },
  { ante: true, wager: "20,000" },
  { autoRemaining: 25 },
  { reducedMotion: true },
])
  cases.push({ ...phone, state: { ...state, ...extra } });
for (const control of [
  "disabledTurbo",
  "disabledAutoplay",
  "disabledBuyFeature",
])
  for (const policy of ["hide", "disable"])
    cases.push({
      ...phone,
      jurisdiction: { [control]: true, restrictedPresentation: policy },
    });
function wrap(markup, c) {
  const g = c.game,
    d = c.d;
  return `<html><body><div class="kk-app" data-material="marina" data-review="${!!c.reviewHeight}" data-reduced="0"><main class="kk-stage"><div class="kk-shell ${c.state.feature ? "is-feature" : ""}" data-layout="${g.mode}" data-framing="${g.artLeft ? "sides" : "header"}" style="--game-width:${g.width}px;--game-height:${g.height + d.height - g.dock}px;--reel-height:${g.reelHeight}px;--reel-width:${g.reelWidth}px;--header-height:${g.header}px;--dock-height:${d.height}px;--dock-gap:${g.dockGap}px;--strip-height:${g.strip}px;--side-width:${g.side}px;--control-left:${g.controlLeft}px;--art-left:${g.artLeft}px;--art-right:${g.artRight}px"><div class="kk-scene-pier"></div><div class="kk-playfield"></div><div class="kk-modular-controls" style="width:${d.width}px;height:${d.height}px">${markup}</div></div></main></div></body></html>`;
}
const trees = parse(
  cases.map((c) =>
    wrap(
      render(
        el(SlotControls, {
          layout: c.d,
          state: c.state,
          actions,
          theme: KILO_CONTROL_THEME,
          jurisdiction: c.jurisdiction,
          bonusAnchorClassName: "kk-bonus-win",
        }),
      ),
      c,
    ),
  ),
).map((tree) => prepareTree(tree));
let cssChecks = 0;
const resolved = [];
for (let i = 0; i < cases.length; i++) {
  const c = cases[i],
    nodes = walk(trees[i]),
    find = (cl) => nodes.find((n) => has(n, cl)),
    menu = nodes.find((n) => n.attrs["data-control"] === "menu"),
    turbo = nodes.find((n) => n.attrs["data-control"] === "turbo"),
    auto = nodes.find((n) => n.attrs["data-control"] === "auto");
  assert(
    !walk(menu).some((n) => has(n, "sc-badge")),
    "Speed still combined with Menu",
  );
  if (c.d.variant === "portrait") {
    const group = nodes.find(
      (n) => n.attrs["aria-label"] === "Secondary controls",
    );
    assert(group);
    for (const control of ["auto", "buy", "turbo", "menu"]) {
      const n = nodes.find((n) => n.attrs["data-control"] === control);
      if (n)
        assert(
          group.children.includes(n),
          `${control} scattered outside group`,
        );
    }
    assert(!find("sc-action-plate"), "Auto backing still touches Spin");
    if (auto) assert(!has(auto, "sc-auto-joined"));
  }
  for (const control of ["turbo", "auto", "buy"]) {
    const n = nodes.find((n) => n.attrs["data-control"] === control),
      flag = {
        turbo: "disabledTurbo",
        auto: "disabledAutoplay",
        buy: "disabledBuyFeature",
      }[control],
      hidden =
        !!(c.state.feature && control !== "turbo") ||
        !!(
          c.jurisdiction?.[flag] &&
          c.jurisdiction.restrictedPresentation === "hide"
        );
    assert.equal(!!n, !hidden);
    if (n && c.jurisdiction?.[flag])
      assert.equal(n.attrs["aria-disabled"], "true");
  }
  if (turbo && !c.jurisdiction?.disabledTurbo) {
    const names = { normal: "Normal", turbo: "Turbo", super: "Super turbo" };
    assert.equal(
      turbo.attrs["aria-label"],
      `Spin speed: ${names[c.state.speed]}. Change speed`,
    );
    assert.equal(
      walk(turbo).find((n) => has(n, "sc-badge")).allText,
      { normal: "1", turbo: "2", super: "3" }[c.state.speed],
    );
  }
  if (c.state.speed !== "normal") continue;
  const context = { viewport: c.viewport, hover: false },
    styles = resolveTree(trees[i], cascade, context),
    v = (n) => styles.get(n).values,
    spin = find("sc-spin"),
    spinGroup = find("sc-spin-group"),
    card = find("sc-readout-card");
  assert.deepEqual(cssRect(v(spinGroup)), c.d.spin, "CSS changed Spin bounds");
  assert.equal(v(spin).width, "100%");
  assert.equal(v(spin).height, "100%");
  assert.equal(v(spin)["border-top-width"], "3px");
  const paints = [
    { name: "spin", ...cssRect(v(spinGroup)) },
    { name: "readout", ...cssRect(v(card)) },
  ];
  if (c.d.variant === "portrait") {
    const shell = find("kk-shell"),
      pier = find("kk-scene-pier");
    assert.equal(px(v(shell)["row-gap"]), 16);
    assert(Math.abs(px(v(shell).height) - (c.game.height + 16)) < 0.001);
    assert.equal(px(v(pier).bottom), 0);
    assert.equal(px(v(pier).height), 160);
    const stageStyle = v(find("kk-stage"));
    assert.equal(
      stageStyle["align-items"] ?? stageStyle["place-items"]?.split(/\s+/)[0],
      "start",
    );
    const frame = stageArtLayout(
        c.game.reelWidth,
        c.game.reelHeight,
        "portrait",
      ),
      paintOverhang = frame.y + frame.h - c.game.reelHeight;
    assert(Math.abs(paintOverhang - 14) < 0.001);
    assert.equal(
      px(v(shell)["row-gap"]) - paintOverhang,
      2,
      "Readouts touch cabinet paint",
    );
    assert.equal(cssRect(v(card)).w, Math.min(336, c.d.width));
    const bet = nodes.find(
      (n) =>
        n.attrs["data-module"] === (c.state.feature ? "free-spins" : "bet"),
    );
    paints.push({ name: "bet", ...cssRect(v(bet)) });
    for (const name of ["auto", "buy", "turbo", "menu"]) {
      const n = nodes.find((n) => n.attrs["data-control"] === name);
      if (!n) continue;
      const expected =
        name === "turbo" && c.state.feature
          ? c.d.featureTurbo
          : name === "menu" && c.state.feature
            ? c.d.featureMenu
            : c.d[name];
      assert.deepEqual(
        cssRect(v(n)),
        expected,
        `${name} inline positions overridden`,
      );
      assert.equal(v(n)["border-top-width"], "2px");
      assert.equal(v(n)["border-radius"], "50%");
      paints.push({ name, ...cssRect(v(n)) });
      const badge = walk(n).find(
        (child) => has(child, "sc-badge") || has(child, "sc-restriction-mark"),
      );
      if (badge) {
        const s = v(badge),
          bw = has(badge, "sc-badge")
            ? Math.max(
                px(s["min-width"]),
                controlNumberAdvance(badge.allText, fontSize(s)) + 8,
              )
            : 18;
        // Deliberately conservative: place the badge against the outside
        // border box, covering both text and rim rather than only its hit area.
        paints.push({
          name: `${name}-badge`,
          owner: name,
          x: expected.x + expected.w - px(s.right) - bw,
          y: expected.y + px(s.top),
          w: bw,
          h: px(s.height),
        });
      }
    }
    for (const p of paints) {
      assert(
        p.x >= 0 &&
          p.y >= 0 &&
          p.x + p.w <= c.d.width + 0.1 &&
          p.y + p.h <= 160.1,
        `${p.name} paint outside dock`,
      );
      for (const other of paints)
        if (
          p.name < other.name &&
          p.owner !== other.name &&
          other.owner !== p.name
        )
          assert(
            !intersects(p, other),
            `${p.name}/${other.name} painted overlap`,
          );
    }
    const bottom = Math.max(...paints.map((p) => p.y + p.h));
    assert(
      160 - bottom <=
        (c.viewport[0] === 320 ? 20 : c.state.feature ? 6 : 4) + 0.1,
      "Extra empty dock footer",
    );
    for (const n of [
      spin,
      card,
      bet,
      ...nodes.filter((n) => has(n, "sc-circle")),
    ]) {
      const after = cascade(n, { ...context, pseudo: "after" });
      assert.equal(after.values.display, "none");
      assert(!JSON.stringify(after.values).includes("gradient("));
    }
  }
  const paintedCircles = nodes.filter(
    (n) => has(n, "sc-circle") && !has(n, "sc-auto-joined"),
  );
  for (const n of [spin, ...paintedCircles]) {
    assert.equal(v(n)["background-color"], "#020c12");
    assert(!v(n)["background-image"] || v(n)["background-image"] === "none");
    assert.equal(v(n).opacity, "1");
    assert.equal(v(n).filter, "none");
    assert.equal(v(n)["backdrop-filter"], "none");
    assert(
      !(v(n)["box-shadow"] ?? "")
        .split(/,(?![^()]*\))/)
        .some((s) => s.trim() !== "none" && !s.includes("inset")),
      "Paint extends outside control",
    );
  }
  for (const n of nodes.filter((n) => has(n, "sc-number"))) {
    const expected =
      c.d.variant === "portrait"
        ? 18
        : c.d.variant === "desktop"
          ? c.d.spin.w === 128
            ? 24
            : 22
          : 20;
    assert.equal(fontSize(v(n)), expected);
    assert.equal(v(n)["font-weight"], "700");
  }
  for (const n of nodes.filter((n) => has(n, "sc-label")))
    assert.equal(fontSize(v(n)), 14);
  cssChecks++;
  resolved.push({
    viewport: c.viewport,
    feature: !!c.state.feature,
    reviewHeight: c.reviewHeight,
    paintedBounds: c.d.variant === "portrait" ? paints : undefined,
    spin: v(spin),
    auto: auto ? v(auto) : undefined,
    label: v(find("sc-label")),
    number: v(find("sc-number")),
  });
}
// Every non-portrait layout definition is identical, not just the four named screens.
for (const [variant, widths] of Object.entries({
  desktop: [800, 1000, 1100, 1408, 1600, 1920],
  landscape: [620, 740, 820, 900, 1024, 1280],
  compact: [352, 400, 500, 568, 640, 700],
}))
  for (const width of widths) {
    const viewport = {
      variant,
      width,
      height: variant === "desktop" ? 128 : 314,
      footerWidth: width - 72,
    };
    assert.deepEqual(
      createControlLayout(viewport),
      oldLayout.createControlLayout(viewport),
    );
  }
// Only portrait-scoped CSS changed; later host styles cannot regress other modes.
const { default: postcss } = await import("postcss");
function outsidePortrait(source) {
  const root = postcss.parse(source);
  root.walkRules((rule) => {
    if (
      rule.selectors.every((selector) =>
        /\[data-(?:variant|layout)="portrait"\]/.test(selector),
      )
    )
      rule.remove();
  });
  root.walkComments((comment) => comment.remove());
  return root.toString().replace(/\s+/g, "");
}
for (const path of [
  "src/components/slot-controls/controls.css",
  "src/components/kilo/modular-controls.css",
])
  assert.equal(
    outsidePortrait(readFileSync(path, "utf8")),
    outsidePortrait(original(path)),
    `Non-portrait CSS changed: ${path}`,
  );
// Markup grouping changes cannot alter action handlers or charge descriptions.
function handlers(source) {
  const ast = ts.createSourceFile(
      "controls.tsx",
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    ),
    out = [];
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === "onClick")
      out.push(node.initializer.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return out;
}
assert.deepEqual(
  handlers(
    readFileSync("src/components/slot-controls/SlotControls.tsx", "utf8"),
  ),
  handlers(original("src/components/slot-controls/SlotControls.tsx")),
);
const report = {
  version: "v39-local",
  checkpoint,
  method:
    "Production CSS cascade + server-rendered markup + layout and painted bounds; no browser screenshots.",
  cssFile,
  cssSha256: sha(css),
  protectedSources,
  reactCases: cases.length,
  cssChecks,
  layouts,
  resolved,
};
mkdirSync("public/kilo-portrait-v39", { recursive: true });
writeFileSync(
  "public/kilo-portrait-v39/check.json",
  JSON.stringify(report, null, 2) + "\n",
);
const phones = layouts.filter(
  (c) => [360, 390].includes(c.viewport[0]) && c.reviewHeight === 44,
);
const rectText = (r) => `${r.x}, ${r.y} · ${r.w}×${r.h}`;
writeFileSync(
  "public/kilo-portrait-v39/VERIFICATION.md",
  `# Kilo King v39 — local portrait regrouping

Checkpoint: ${checkpoint}. No source push or deployment.

## What caused the problem

The earlier overlap checks covered click targets. They missed the painted Auto backing plate extending from the Spin center into the adjacent module. Portrait also placed Speed beside the readouts and Buy/Menu in a column, so the four secondary controls did not share a group.

The new portrait-only layout removes that backing plate. Auto is an independent 44px circle. Auto/Buy form the first row; Turbo/Menu form the second, with 12px gaps in both directions. Spin remains centered and 96px. Balance and Win share the full-width upper well. During features, Turbo/Menu form a centered horizontal pair and the free-spin well replaces Bet.

The built CSS also exposed a cascade conflict: the later base-scene portrait rule kept the pier at bottom: -24px despite the initial host override. The placement rule now includes the stage scope, so its bottom: 0 and 160px height win without !important.

## Measured portrait bounds

Coordinates are local to the 160px control allocation, in CSS pixels; columns show x, y · width×height.

| Viewport | Bet | Spin | Auto | Buy | Turbo | Menu |
|---|---|---|---|---|---|---|
${phones.map((c) => `| ${c.viewport.join("×")} | ${["bet", "spin", "auto", "buy", "turbo", "menu"].map((k) => rectText(c.d[k])).join(" | ")} |`).join("\n")}

- Bet → Spin: 8px; Spin → secondary grid: 16px; internal secondary row/column gaps: 12px.
- Connected readout row: 336×44px. Secondary group: 100×100px. Four pixels remain below the last control, within the unchanged 160px allocation.
- Cabinet clearance is 16px: 14px of existing painted frame plus 2px clear. Previously it was 18px. Reel dimensions, header and reel position are unchanged.
- The portrait pier now ends with the allocation; its former 24px overhang is removed. The painted shelf below the last button shrinks from 28px to 4px.
- Portrait numbers remain 18px/21px and labels return to the requested 14px. All amounts retain the same tabular font and exact value. The existing icon-only Spin keeps its charge and disabled explanation linked accessibly; no new face copy is introduced.
- Solid near-black control faces, hard 3px Spin/2px secondary rims and full opacity. The portrait clearcoat pseudo-elements are disabled, so no gradients or blur remain on those controls. Desktop/landscape paint is unchanged.

## Verification

- TypeScript and production build passed.
- ${cases.length} real React states, ${cssChecks} emitted CSS checks, and 12 viewport/toolbar combinations. Includes 360×800, 390×844, narrow fallback, desktop, short landscape, feature mode, all three speeds, disabled Spin, Ante, active Auto and jurisdiction flags.
- Both interactive rectangles and painted bounds checked, including numeric wells, Spin rim, secondary circles and badges. No intersections at the required phones; targets remain at least 44×44.
- Desktop, landscape and compact rectangles match v38 exactly, including an 18-case width sweep. Feature controls reuse the same reel and Spin geometry. All action callback bodies are unchanged.
- ${Object.keys(protectedSources).length} protected source hashes match the checkpoint: engine, wallet/bank, settlement host, collection director, Pixi renderer, hook/reel geometry, purchase guards, autoplay, Info and Features.

## Remaining limits

No browser screenshots or live interaction checks were performed. CSS and geometry checks do not establish final font rasterization or device gesture behavior.

Unused viewport height still exists below the fixed-size game on tall phones. At these reel dimensions and a 160px dock, it cannot be removed while also keeping the stage near the top and avoiding scale changes. This pass removes the extra shelf inside the composition; it does not claim to fill the entire portrait viewport. Tiny compact popouts keep their existing fallback, as landscape/compact geometry is outside this pass.

CSS: ${cssFile}
SHA-256: ${sha(css)}
Detailed resolved styles, dimensions and protected hashes: check.json
`,
);
console.log(
  JSON.stringify({
    result: "PASS",
    reactCases: cases.length,
    cssChecks,
    layoutCases: layouts.length,
    report: "public/kilo-portrait-v39/VERIFICATION.md",
  }),
);
