// v37 measured typography + Features: built CSS cascade + real React markup. No browser or pixel proof.
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
const { FeatureTakeoverView } =
  await import("../src/components/kilo/feature-takeover.tsx");
const { SlotControls } =
  await import("../src/components/slot-controls/SlotControls.tsx");
const { createControlLayout, controlTargets } =
  await import("../src/components/slot-controls/layout.ts");
const { fitGameLayout } = await import("../src/components/kilo/layout.ts");
const { KILO_CONTROL_THEME } =
  await import("../src/components/kilo/control-theme.ts");
const { STAKES, purchaseQuote } =
  await import("../src/components/kilo/control-model.ts");
const { splashCost } = await import("../src/lib/kilo/engine.ts");
const checkpoint = "59601c744bbfa7cafe43925eecc6d99a00c1f2d1";
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
  "src/components/slot-controls/layout.ts",
  "src/components/slot-controls/controls.css",
  "src/components/kilo/modular-controls.css",
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
const featureSource = readFileSync(
  "src/components/kilo/feature-takeover.tsx",
  "utf8",
);
const featureAst = ts.createSourceFile(
  "feature.tsx",
  featureSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const confirmExpression = declaration(
  featureAst,
  "confirm",
).initializer.getText(featureAst);
const getConfirm = Function(
  "view",
  "submitted",
  "props",
  "purchaseQuote",
  `return ${confirmExpression}`,
);
const noop = () => {};
const baseProps = {
  stake: 1000,
  bank: 5000000,
  ante: false,
  locked: false,
  onAnte: noop,
  onStake: noop,
  onEditBet: noop,
  onBuy: noop,
  onClose: noop,
};
let purchaseChecks = 0;
for (const stake of STAKES)
  for (const mode of ["buy", "chopper"])
    for (const bank of [0, 5000000]) {
      const quote = purchaseQuote(stake, mode, bank);
      let calls = 0;
      const confirm = getConfirm(
        mode,
        { current: false },
        {
          ...baseProps,
          stake,
          bank,
          onBuy: (chosen) => {
            assert.equal(chosen, mode);
            calls++;
          },
        },
        purchaseQuote,
      );
      confirm();
      confirm();
      assert.equal(
        calls,
        quote.allowed ? 1 : 0,
        "Purchase must remain validated and single-submit",
      );
      purchaseChecks++;
    }
for (const extra of [{ locked: true }, { anteOnly: true }]) {
  let calls = 0;
  const confirm = getConfirm(
    "buy",
    { current: false },
    { ...baseProps, ...extra, onBuy: () => calls++ },
    purchaseQuote,
  );
  confirm();
  assert.equal(calls, 0);
  purchaseChecks++;
}
assert(purchaseQuote(10000, "buy", 5000000).allowed);
assert.equal(purchaseQuote(10000, "buy", 5000000).cost, 1000000);
assert.match(
  purchaseQuote(10000, "chopper", 5000000).reason,
  /1,000,000 purchase limit/,
);
// Execute the actual pure view's event handlers. Selecting an offer only changes
// the presentation view; only the guarded confirmation above can call onBuy.
function expand(node) {
  if (node == null || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(expand);
  if (typeof node.type === "function") return expand(node.type(node.props));
  return [node, ...expand(node.props?.children)];
}
let selected = null,
  charged = 0,
  anteState = null;
const pure = expand(
  FeatureTakeoverView({
    ...baseProps,
    view: "features",
    onView: (v) => (selected = v),
    onConfirm: () => charged++,
    onAnte: (v) => (anteState = v),
  }),
);
pure.find((n) => n.props?.["data-feature-action"] === "buy").props.onClick();
assert.equal(selected, "buy");
assert.equal(charged, 0);
pure.find((n) => n.props?.["data-feature-action"] === "ante").props.onClick();
assert.equal(anteState, true);
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
const modal = (markup) =>
  wrap(
    `<div id="kilo-features-takeover" class="kk-modal-root is-blocking"><div class="kk-scrim"></div><div class="kk-dialog kk-feature-takeover" role="dialog">${markup}</div></div>`,
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
const featureCases = [];
for (const stake of STAKES)
  for (const bank of [0, 5000000])
    for (const ante of [false, true]) {
      featureCases.push({ ...baseProps, stake, bank, ante, view: "features" });
    }
for (const view of ["buy", "chopper", "scatter", "development"])
  featureCases.push({ ...baseProps, view });
featureCases.push({ ...baseProps, view: "features", anteOnly: true });
featureCases.push({
  ...baseProps,
  view: "features",
  anteRestriction: { hidden: true, disabled: true },
});
featureCases.push({
  ...baseProps,
  view: "features",
  anteRestriction: {
    hidden: false,
    disabled: true,
    reason: "Unavailable in this jurisdiction",
  },
});
const featureTrees = parse(
  featureCases.map((props) =>
    modal(
      render(
        el(FeatureTakeoverView, { ...props, onView: noop, onConfirm: noop }),
      ),
    ),
  ),
).map((tree) => prepareTree(tree));
for (let i = 0; i < featureCases.length; i++) {
  const props = featureCases[i],
    nodes = walk(featureTrees[i]);
  for (const img of nodes.filter((n) => n.tag === "img"))
    assert(existsSync("public" + img.attrs.src), img.attrs.src);
  if (props.view === "features") {
    const purchases = nodes.filter((n) =>
      ["buy", "chopper"].includes(n.attrs["data-feature"]),
    );
    assert.equal(purchases.length, props.anteOnly ? 0 : 2);
    for (const card of purchases) {
      const quote = purchaseQuote(
        props.stake,
        card.attrs["data-feature"],
        props.bank,
      );
      const price = walk(card).find((n) => has(n, "kf-price"));
      assert(price.allText.includes(quote.cost.toLocaleString("en-US")));
      const button = walk(card).find((n) => n.tag === "button");
      assert.equal("disabled" in button.attrs, !quote.allowed || props.locked);
      if (quote.reason) assert(button.allText.includes(quote.reason));
    }
    const ante = nodes.find((n) => n.attrs["data-feature-action"] === "ante");
    if (props.anteRestriction?.hidden) assert(!ante);
    else assert.equal(ante.attrs["aria-pressed"], String(props.ante));
  }
}
function length(value, safe = { top: 0, right: 0, bottom: 0, left: 0 }) {
  const v = value
    .replace(/env\(safe-area-inset-(top|right|bottom|left)\)/g, (_, s) =>
      String(safe[s]),
    )
    .replace(/px/g, "")
    .replace(/calc\(/g, "(")
    .replace(/max\(/g, "Math.max(")
    .replace(/min\(/g, "Math.min(");
  assert(
    /^[\d\s.,()+\-*/]+$/.test(v.replace(/Math\.(?:max|min)/g, "")),
    `Unsupported length ${value}`,
  );
  return Function(`return (${v});`)();
}
const viewports = [
  [1440, 900],
  [390, 844],
  [360, 800],
  [844, 390],
  [1920, 1080],
  [1180, 660],
];
const featureLayout = [];
for (const viewport of viewports) {
  const tree = featureTrees[1],
    nodes = walk(tree),
    styles = resolveTree(tree, cascade, { viewport, hover: false });
  const node = (c) => nodes.find((n) => has(n, c)),
    val = (c) => styles.get(node(c)).values;
  const panel = val("kk-feature-takeover"),
    grid = val("kf-grid"),
    scroll = val("kf-scroll"),
    close = val("kf-close"),
    bet = val("kf-bet"),
    card = val("kf-card");
  assert.equal(panel.width, "100%");
  assert.equal(panel.height, "100%");
  assert.equal(panel["max-width"], "none");
  assert.equal(panel["border-top-width"], "0");
  assert.equal(
    scroll["overflow-y"] ?? scroll.overflow?.split(/\s+/).at(-1),
    "auto",
  );
  assert.match(grid["grid-template-columns"], /repeat\(2,/);
  const gridWidth = Math.min(
    viewport[0] -
      length(scroll["padding-left"]) -
      length(scroll["padding-right"]),
    length(grid["max-width"]),
  );
  const gap = length(grid.gap),
    cardWidth = (gridWidth - gap) / 2;
  assert(cardWidth >= 158, "Cards too narrow at required viewport");
  const closeX = viewport[0] - length(close.right) - length(close.width);
  const betWidths = bet["grid-template-columns"].match(/\d+px/g).map(length);
  const betWidth = betWidths.reduce((a, b) => a + b, 0) + 2;
  assert(closeX > (viewport[0] + betWidth) / 2, "Bet header touches Close");
  assert(length(close.width) >= 44 && length(close.height) >= 44);
  assert(length(scroll.top) >= length(close.top) + length(close.height) + 4);
  const art = val("kf-art"),
    action = val("kf-action");
  assert(length(action["min-height"]) >= 44);
  const fontSize = (v) =>
    Number.parseFloat(v["font-size"] ?? v.font?.match(/([0-9.]+)px/)[1]);
  const heading = styles.get(nodes.find((n) => n.tag === "h2")).values;
  const price = styles.get(
    node("kf-price").children.find((n) => n.tag === "strong"),
  ).values;
  assert.equal(fontSize(heading), viewport[0] <= 600 ? 18 : 22);
  assert.equal(fontSize(price), viewport[0] <= 600 ? 23 : 28);
  assert.equal(fontSize(action), viewport[0] <= 600 ? 14 : 15);
  assert.equal(length(grid["max-width"]), 620);
  featureLayout.push({
    headingSize: fontSize(heading),
    priceSize: fontSize(price),
    actionSize: fontSize(action),
    viewport,
    gridWidth,
    cardWidth,
    gridGap: gap,
    cardMinHeight: length(card["min-height"]),
    artHeight: length(art.height),
    scrollTop: length(scroll.top),
    closeTarget: [length(close.width), length(close.height)],
    columns: 2,
    overflow: "vertical when required",
  });
}
const controlLayout = [];
const oldLayout = await import(
  "data:text/javascript;base64," +
    Buffer.from(
      transpile(original("src/components/slot-controls/layout.ts")).replace(
        'from "./tokens.ts"',
        `from "data:text/javascript;base64,${Buffer.from(transpile(original("src/components/slot-controls/tokens.ts"))).toString("base64")}"`,
      ),
    ).toString("base64")
);
const state = {
  balance: "5,000,000",
  win: "400",
  bet: "1,000",
  currency: "LGC",
  ante: false,
  speed: "super",
  busy: false,
  autoRemaining: 0,
  ready: true,
  locked: false,
  spinDisabled: false,
  minimumBet: false,
  maximumBet: false,
  charge: { amount: "1,000" },
};
const actions = Object.fromEntries(
  ["menu", "turbo", "bet", "minus", "plus", "auto", "spin", "buy"].map((k) => [
    k,
    noop,
  ]),
);
const intersects = (a, b) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.01 &&
  Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.01;
for (const viewport of viewports)
  for (const reviewHeight of [0, 44]) {
    const small = viewport[0] <= 900;
    const vw = viewport[0] - (small ? 24 : 32),
      vh = viewport[1] - reviewHeight - (small ? 32 : 40);
    const game = fitGameLayout(vw, vh),
      d = hostDock(createControlLayout, game, vh, vw);
    if (d.variant !== "desktop")
      assert.deepEqual(
        d,
        oldLayout.createControlLayout({
          variant: d.variant,
          width: d.width,
          height: d.height,
          footerWidth: d.footerWidth,
        }),
        "Mobile/landscape geometry changed",
      );
    for (const feature of [false, true]) {
      const targets = Object.entries(controlTargets(d, feature));
      for (const [key, r] of targets) {
        assert(r.w >= 44 && r.h >= 44, `${key} too small`);
        assert(
          r.x >= -0.1 &&
            r.y >= -0.1 &&
            r.x + r.w <= d.width + 0.1 &&
            r.y + r.h <= d.height + 0.1,
          `${key} outside allocation`,
        );
        for (const [other, s] of targets)
          if (key < other)
            assert(!intersects(r, s), `${key} overlaps ${other}`);
        for (const r2 of [d.balance, d.win])
          assert(!intersects(r, r2), `${key} overlaps readout`);
      }
      if (d.variant === "portrait") assert.equal(d.height, 160);
      const markup = wrap(
        render(
          el(SlotControls, {
            layout: d,
            state: {
              ...state,
              spinDisabled: !feature,
              spinDisabledReason: "Insufficient balance",
              ...(feature ? { feature: { remaining: 8, multiplier: 2 } } : {}),
            },
            actions,
            theme: KILO_CONTROL_THEME,
          }),
        ),
      );
      const tree = prepareTree(parse([markup])[0]),
        nodes = walk(tree),
        styles = resolveTree(tree, cascade, { viewport, hover: false });
      const find = (c) => nodes.find((n) => has(n, c));
      const spin = styles.get(find("sc-spin")).values;
      assert.equal(spin["background-color"], "#020c12");
      assert.equal(spin.opacity, "1");
      assert.equal(spin["border-top-width"], "3px");
      assert.equal(
        nodes.filter((n) => n.attrs["data-control"] === "buy").length,
        feature ? 0 : 1,
      );
      assert.equal(
        nodes.filter((n) => n.attrs["data-control"] === "auto").length,
        feature ? 0 : 1,
      );
      const label = styles.get(find("sc-label")).values;
      assert((label["font-size"] ?? label.font).includes("14px"));
      const number = styles.get(find("sc-number")).values;
      assert(Number.parseFloat(number["font-size"]) > 14);
      if (d.variant === "desktop" && d.spin.w === 128)
        assert.equal(Number.parseFloat(number["font-size"]), 24);
      if (d.variant === "portrait")
        assert.equal(Number.parseFloat(number["font-size"]), 20);
    }
    const barLeft = Math.min(
        d.turbo.w ? d.turbo.x : Infinity,
        d.balance.x,
        d.bet.x,
      ),
      barRight = Math.max(d.buy.x + d.buy.w, d.spin.x + d.spin.w);
    const old = oldLayout.createControlLayout({
      variant: d.variant,
      width: d.width,
      height: d.height,
      footerWidth: d.footerWidth,
    });
    const oldWidth =
      Math.max(old.buy.x + old.buy.w, old.spin.x + old.spin.w) -
      Math.min(old.turbo.w ? old.turbo.x : Infinity, old.balance.x, old.bet.x);
    assert.equal(d.spin.w, old.spin.w);
    assert.equal(d.spin.h, old.spin.h);
    if (d.variant === "desktop" && d.spin.w === 128)
      assert(barRight - barLeft < oldWidth);
    controlLayout.push({
      previousBarWidth: oldWidth,
      screenWidthPercent:
        Math.round(((barRight - barLeft) / viewport[0]) * 1000) / 10,
      viewport,
      reviewHeight,
      variant: d.variant,
      reel: [game.reelWidth, game.reelHeight],
      dock: [d.width, d.height],
      barWidth: barRight - barLeft,
      spin: d.spin,
      bet: d.bet,
      numericWell: d.balance,
      minimumTarget: 44,
      overlap: false,
      portraitUnchanged: d.variant === "portrait",
    });
  }
// Verify the generated asset is RGBA with true transparent space, without editing it.
const alpha = JSON.parse(
  execFileSync(
    "python",
    [
      "-c",
      `import json
from PIL import Image
im=Image.open('public/kilo-features-v36/chopper-cutout.png')
a=im.getchannel('A');h=a.histogram()
print(json.dumps({'mode':im.mode,'size':im.size,'transparentPixels':h[0],'visiblePixels':sum(h[1:])}))`,
    ],
    { encoding: "utf8" },
  ),
);
assert(
  alpha.mode === "RGBA" &&
    alpha.transparentPixels > 100000 &&
    alpha.visiblePixels > 100000,
);
const report = {
  version: "v37",
  checkpoint,
  verification:
    "Production CSS cascade, React markup, exact layout rectangles and actual confirmation closure. No browser screenshots or live interaction proof.",
  cssFile,
  cssSha256: sha(css),
  protectedSources,
  purchaseChecks,
  featureCaseCount: featureCases.length,
  featureLayout,
  controlLayout,
  asset: alpha,
};
mkdirSync("public/kilo-features-v37", { recursive: true });
writeFileSync(
  "public/kilo-features-v37/check.json",
  JSON.stringify(report, null, 2) + "\n",
);
writeFileSync(
  "public/kilo-features-v37/VERIFICATION.md",
  `# Kilo King v37 — measured type and Features polish

Checkpoint: ${checkpoint}

## Screenshot measurements

Approximate visible bounds measured from the supplied screenshots, normalized to each image width. Different capture sizes make raw pixel comparison misleading.

| Element | Kilo screenshot (2048px wide) | Reference (1672px wide) | Decision |
|---|---:|---:|---|
| Full command group | 1702px / 83.1% | 1294px / 77.4% | Reduce desktop coverage from 84% to 78% of available stage width |
| Spin diameter | 164px / 8.0% | 134px / 8.0% | Keep 128px CSS Spin and its 3px rim |
| Balance/Win card | 865px / 42.2% | 534px / 31.9% | Take width out of the shared numeric card, preserving controls and spacing |

Features grid: approximately 847/2048px (41.4%) in Kilo versus 646/1674px (38.6%) in the earlier reference. Its maximum CSS width is reduced from 660px to 620px. The desktop card height is retained; the issue was width and text density, not uniformly oversized controls.

## Changes

- Wide desktop amount size 28 → 24px; labels stay 14px. Full command coverage 84% → 78%, maximum width 1536 → 1424px. At 1440×900 the group now spans about 76% of the viewport after outer insets. Spin, well heights, touch sizes and separation gaps remain unchanged.
- Features headings 28 → 22px, prices 32 → 28px, action labels 17 → 15px and top bet amount 24 → 22px. Phone headings are 18px and prices 23px; actions remain at least 44px high.
- The crown trio is restrained to a bounded art area. Chopper is fitted by its visible silhouette rather than its larger transparent margin. All existing artwork is retained.
- Quieter teal/brass fills, a subtle upper light catch on cards, and a lighter blurred marina backdrop separate the cards without a heavy enclosing frame.
- Ante uses a short action label plus a distinct Ante Off / Ante On state. Unavailable offers retain their full reason and visible price.

## Verification

- Typecheck and production build passed. The built stylesheet was used for the cascade checks, not a hand-authored mockup.
- ${purchaseChecks} purchase guard cases passed and ${featureCases.length} React views checked. Selection still opens confirmation, not a charge. Repeated confirmation submits once. Exact-limit Free Spins remains allowed; over-limit Chopper remains unavailable.
- Targets and separation checked at 1440×900, 390×844, 360×800, 844×390, 1920×1080 and 1180×660, with and without the review toolbar. No intersections; at least 44×44 targets. Phone/landscape control geometry is identical to v36, including the 160px portrait allocation.
- ${Object.keys(protectedSources).length} protected source hashes match v36, including the entire play host, engine, bank, director, Pixi renderer, reel geometry, autoplay, quote model and Info.
- Price/title/action sizes, two-column Features layout, scrollable overflow, close-button separation and full-opacity disabled Spin verified from production CSS.

## Limits

No browser automation or live screenshots were performed. Source and rectangle checks do not establish final live typography wrapping, touch behavior or perceived visual polish. Long disabled reasons may increase card height; the takeover scrolls vertically rather than clipping them. The fourth card remains scatter information because the game still has only two bonus purchases plus Ante.

CSS: ${cssFile}
SHA-256: ${sha(css)}
Detailed dimensions: check.json
`,
);
console.log(
  JSON.stringify(
    {
      result: "PASS",
      purchaseChecks,
      featureCases: featureCases.length,
      viewportCases: controlLayout.length,
      cssFile,
      report: "public/kilo-features-v37/VERIFICATION.md",
    },
    null,
    2,
  ),
);
