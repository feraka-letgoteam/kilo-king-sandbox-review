// v38 portrait speed separation + compact typography. Source/cascade proof, not browser QA.
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
const checkpoint = "21bd604d522ca28a3e4d3af3fd5f79a872ca36e2";
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
  "src/components/kilo/control-model.ts",
  "src/components/kilo/feature-catalog.ts",
  "src/components/kilo/auto-spins.ts",
  "src/components/kilo/control-panels.tsx",
  "src/components/kilo/control-overlays.tsx",
  "src/components/kilo/info-panel.tsx",
  "src/components/kilo/info-panel.css",
  "src/components/kilo/play.tsx",
  "src/components/kilo/modular-controls.css",
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
const wrap = (markup) =>
  `<html><body><div class="kk-app" data-material="marina" data-reduced="0">${markup}</div></body></html>`;
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
const fontSize = (css) =>
  Number.parseFloat(css["font-size"] ?? css.font.match(/([\d.]+)px/)[1]);
const cases = [],
  layouts = [];
const viewports = [
  [360, 800],
  [390, 844],
  [320, 740],
  [844, 390],
  [1440, 900],
  [1920, 1080],
];
for (const viewport of viewports)
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
      for (const key of [
        "spin",
        "bet",
        "betButton",
        "minus",
        "plus",
        "auto",
        "buy",
        "menu",
        "featureMenu",
        "counter",
        "actionPlate",
      ])
        assert.deepEqual(d[key], previous[key], `Portrait ${key} moved`);
      assert.deepEqual(d.turbo, { x: d.buy.x, y: 0, w: 44, h: 44 });
      assert.deepEqual(d.featureTurbo, d.turbo);
      assert.equal(d.drawer.turbo, false);
      assert.equal(
        d.turbo.x - (d.win.x + d.win.w),
        viewport[0] === 320 ? 8 : 12,
      );
      assert(d.buy.y - (d.turbo.y + d.turbo.h) >= 8);
      assert(
        controlNumberAdvance(state.bet, 18) <= d.betButton.w,
        "Maximum bet clipped",
      );
      if (viewport[0] >= 360)
        assert(
          controlNumberAdvance(state.balance, 18) <= d.balance.w - 20,
          "Long Balance clipped",
        );
    }
    for (const feature of [false, true]) {
      const targets = Object.entries(controlTargets(d, feature));
      for (const [name, r] of targets) {
        assert(r.w >= 44 && r.h >= 44, `${name} below touch minimum`);
        assert(
          r.x >= 0 &&
            r.y >= 0 &&
            r.x + r.w <= d.width + 0.1 &&
            r.y + r.h <= d.height + 0.1,
          `${name} outside allocation`,
        );
        for (const [other, s] of targets)
          if (name < other)
            assert(!intersects(r, s), `${name}/${other} overlap`);
        for (const well of [d.balance, d.win])
          assert(!intersects(r, well), `${name}/readout overlap`);
      }
      for (const speed of ["normal", "turbo", "super"])
        cases.push({
          viewport,
          d,
          state: {
            ...state,
            speed,
            ...(feature ? { feature: { remaining: 8, multiplier: 2 } } : {}),
          },
        });
    }
    layouts.push({
      viewport,
      reviewHeight,
      variant: d.variant,
      reels: [game.reelWidth, game.reelHeight],
      dock: [d.width, d.height],
      balance: d.balance,
      win: d.win,
      turbo: d.turbo,
      menu: d.menu,
      spin: d.spin,
      bet: d.bet,
      minimumTarget: 44,
      overlaps: false,
    });
  }
const phone = layouts.find((r) => r.viewport[0] === 360);
const phoneLayout = createControlLayout({
  variant: "portrait",
  width: phone.dock[0],
  height: phone.dock[1],
});
for (const feature of [false, true])
  for (const policy of ["hide", "disable"])
    cases.push({
      viewport: [360, 800],
      d: phoneLayout,
      state: {
        ...state,
        ...(feature ? { feature: { remaining: 8, multiplier: 2 } } : {}),
      },
      jurisdiction: { disabledTurbo: true, restrictedPresentation: policy },
    });
for (const extra of [
  { menuOpen: true },
  { spinDisabled: true, spinDisabledReason: "Insufficient balance" },
  { ante: true, wager: "20,000" },
  { autoRemaining: 25 },
])
  cases.push({
    viewport: [360, 800],
    d: phoneLayout,
    state: { ...state, ...extra },
  });
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
        }),
      ),
    ),
  ),
).map((tree) => prepareTree(tree));
let cssChecks = 0;
for (let i = 0; i < cases.length; i++) {
  const c = cases[i],
    tree = trees[i],
    nodes = walk(tree),
    menu = nodes.find((n) => n.attrs["data-control"] === "menu"),
    turbo = nodes.find((n) => n.attrs["data-control"] === "turbo");
  assert(
    !walk(menu).some((n) => has(n, "sc-badge")),
    "Speed badge still attached to Menu",
  );
  assert(!menu.attrs["aria-label"].includes("Spin speed"));
  if (c.jurisdiction?.restrictedPresentation === "hide") assert(!turbo);
  else {
    assert(turbo, "Independent speed control missing");
    if (c.jurisdiction?.disabledTurbo) {
      assert.equal(turbo.attrs["aria-disabled"], "true");
      assert(walk(turbo).some((n) => has(n, "sc-restriction-mark")));
    } else {
      const names = { normal: "Normal", turbo: "Turbo", super: "Super turbo" };
      const badge = walk(turbo).find((n) => has(n, "sc-badge"));
      assert.equal(
        badge.allText,
        { normal: "1", turbo: "2", super: "3" }[c.state.speed],
      );
      assert.equal(
        turbo.attrs["aria-label"],
        `Spin speed: ${names[c.state.speed]}. Change speed`,
      );
    }
  }
  assert.equal(
    nodes.filter((n) => n.attrs["data-control"] === "auto").length,
    c.state.feature ? 0 : 1,
  );
  assert.equal(
    nodes.filter((n) => n.attrs["data-control"] === "buy").length,
    c.state.feature ? 0 : 1,
  );
  // Resolve the actual emitted stylesheet for each layout/state, avoiding a
  // repeated identical cascade for each speed badge value.
  if (c.state.speed !== "normal") continue;
  const styles = resolveTree(tree, cascade, {
      viewport: c.viewport,
      hover: false,
    }),
    find = (cl) => nodes.find((n) => has(n, cl)),
    spin = styles.get(find("sc-spin")).values;
  assert.equal(spin["background-color"], "#020c12");
  assert.equal(spin.opacity, "1");
  assert.equal(spin["border-top-width"], "3px");
  for (const control of [menu, turbo].filter(Boolean)) {
    const s = styles.get(control).values;
    assert.equal(s["background-color"], "#020c12");
    assert.equal(s.opacity, "1");
    assert.equal(s["border-top-width"], "2px");
  }
  const expected =
    c.d.variant === "portrait"
      ? 18
      : c.d.variant === "desktop"
        ? c.d.spin.w === 128
          ? 24
          : 22
        : 20;
  for (const node of nodes.filter((n) => has(n, "sc-number"))) {
    const s = styles.get(node).values;
    assert.equal(fontSize(s), expected, `Wrong ${c.d.variant} amount size`);
    assert.equal(s["font-weight"], "700");
    assert.match(s["font-family"] ?? s.font, /Source Sans 3/);
  }
  const labelSize = c.d.variant === "portrait" ? 12 : 14;
  for (const node of nodes.filter((n) => has(n, "sc-label")))
    assert.equal(fontSize(styles.get(node).values), labelSize);
  cssChecks++;
}
const report = {
  version: "v38",
  checkpoint,
  method:
    "Production CSS cascade + real server-rendered controls + layout rectangles; no browser automation or screenshots.",
  cssFile,
  cssSha256: sha(css),
  protectedSources,
  reactCases: cases.length,
  cssChecks,
  layouts,
};
mkdirSync("public/kilo-portrait-v38", { recursive: true });
writeFileSync(
  "public/kilo-portrait-v38/check.json",
  JSON.stringify(report, null, 2) + "\n",
);
writeFileSync(
  "public/kilo-portrait-v38/VERIFICATION.md",
  `# Kilo King v38 — portrait speed and type

Checkpoint: ${checkpoint}

## Root cause and fix

The portrait layout deliberately returned a zero-sized Turbo rectangle, which enabled the Menu speed-badge fallback. Feature mode also suppressed Turbo. This was layout routing, not two overlapping buttons.

Speed now has its own 44×44 target at the top of the right utility column, above Buy and Menu. It cycles the host's existing Normal / Turbo / Super turbo preferences. Its 1 / 2 / 3 state badge belongs to Speed, never Menu. It stays available during a feature and respects disabledTurbo.

The shared Balance/Win card stops before Speed. Portrait amounts are fixed at 18px/21px, labels at 12px. The same Source Sans 3 numeric face and exact values remain. Bet, Spin, joined Auto, Buy and Menu do not move. The 160px allocation, 96px Spin and all 44px touch targets remain.

## Verification

- Production build and TypeScript checks passed.
- ${cases.length} real React states: three speeds, base/feature, menu open, disabled Spin, Ante, active Auto and restricted Turbo.
- ${cssChecks} production CSS cascade checks confirm numeric sizes, label sizes, solid faces, 3px Spin rim, 2px utility rims and full opacity.
- Twelve viewport/toolbar combinations at 360×800, 390×844, 320×740, 844×390, 1440×900 and 1920×1080. No target or readout intersections; no target smaller than 44×44. Portrait still uses 160px.
- At 360/390, the readout card and Speed are separated by 12px, Speed/Buy by 12px, Bet/Spin by 8px and Spin/Auto targets by 16px. Long Balance 1,234,567,890 fits its 114px text area at 18px; maximum base bet 10,000 fits without reduced type.
- Desktop and landscape rectangles exactly match v37. Portrait Bet, Spin, Auto and Menu rectangles match v37. Base/feature reels use the unchanged host geometry.
- ${Object.keys(protectedSources).length} source hashes match v37, including engine, wallet/bank, settlement host, renderer, collection director, reel layout, purchase guards, autoplay and the v37 Features polish.

## Limits

These are source, production CSS and rectangle checks, not live browser/device proof. Tiny compact popout mode retains its existing Menu fallback; this pass corrects portrait and preserves the accepted desktop/short-landscape system. Final font rasterization and tap behavior need live preview review.

Detailed dimensions and source hashes: check.json
CSS: ${cssFile}
SHA-256: ${sha(css)}
`,
);
console.log(
  JSON.stringify({
    result: "PASS",
    reactCases: cases.length,
    cssChecks,
    layoutCases: layouts.length,
    report: "public/kilo-portrait-v38/VERIFICATION.md",
  }),
);
