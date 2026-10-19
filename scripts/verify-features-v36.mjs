// v36 controls + Features: built CSS cascade + real React markup. No browser or pixel proof.
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
const checkpoint = "13bae8f24c2f0c5a3b9d262e1693ffefa459a8fc";
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
  featureLayout.push({
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
    }
    const barLeft = Math.min(
        d.turbo.w ? d.turbo.x : Infinity,
        d.balance.x,
        d.bet.x,
      ),
      barRight = Math.max(d.buy.x + d.buy.w, d.spin.x + d.spin.w);
    controlLayout.push({
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
  version: "v36",
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
mkdirSync("public/kilo-features-v36", { recursive: true });
writeFileSync(
  "public/kilo-features-v36/check.json",
  JSON.stringify(report, null, 2) + "\n",
);
writeFileSync(
  "public/kilo-features-v36/VERIFICATION.md",
  `# Kilo King v36 — control proportions and Features\n\nCheckpoint: ${checkpoint}\n\n## What changed\n\n- Wide desktop controls use 84% of the available stage width (maximum 1,536px), with a 128px Spin, 64px secondary controls, 88px wells and 28px figures. A short desktop retains the 100px dock if the taller version would exceed available height. Reels and symbols are unchanged.\n- Features is a full-screen takeover with a centered bet selector, large close control, isolated Kilo artwork and a two-column/four-card layout. Ante and scatter information occupy the upper row; the two existing purchases occupy the lower row. The fourth card is informational, not a new purchasable mode.\n- Cards use a flat dark fill, teal actions and gold purchase actions. No outer frame, category tabs or detached footer. Phone cards retain two columns, readable prices, full disabled reasons, 44px buttons and vertical scrolling when needed.\n- Buying a card still opens a separate confirmation. No charge occurs on selection. Ante is only on Features. Spin remains arrow-only, joined to Auto.\n\n## Checks\n\n- Typecheck and production build passed.\n- ${purchaseChecks} purchase guard cases passed; exact-limit Free Spins at 1,000,000 remains valid, Chopper at 2,500,000 is unavailable. Duplicate confirmation does not submit twice. Locked/restricted purchases do not submit.\n- ${featureCases.length} real React views checked, including all stakes, insufficient balance, Ante states, restrictions, previews and confirmation.\n- Control targets checked at 1440×900, 390×844, 360×800, 844×390, 1920×1080 and 1180×660, both with and without the review toolbar. No target intersections or readout intersections. Portrait/landscape geometry matches v35 exactly; portrait allocation remains 160px.\n- Built CSS resolves to full-screen Features and two-column grids; close and bet controls are separated. Disabled Spin retains its 3px rim, solid face and opacity 1.\n- ${Object.keys(protectedSources).length} protected sources hash-identical to v35, including engine, wallet, director, Pixi stage, reel geometry, quote model, autoplay and Info. Host runtime differs only in presentation integration.\n\n## Reference and remaining gap\n\nCompared the four supplied screenshots (8.04.26, 8.04.37, 8.05.16 and 8.05.42 PM). No video file was available to measure. Reference structure and proportions are adapted to the existing Kilo mechanics and artwork; this is not a claim of pixel identity. The reference has four paid offerings; Kilo has two bonus purchases plus Ante, so its fourth card opens scatter information.\n\nNo browser automation, live screenshots, live touch/resize testing or visual pixel comparison was performed. Typography wrapping and final perceived weight still need review in the private preview. Short landscape scrolls the two-row Features grid deliberately.\n\n## Asset provenance\n\nImage-generation background extraction from public/kilo-features-v12/chopper.webp. Prompt: isolate the existing black-and-brass helicopter and suspended wrapped cargo, retain style/materials/teal edge light, remove marina/sky/water/reflection, transparent alpha, complete silhouette, no text/frame/floor. Output: public/kilo-features-v36/chopper-cutout.png (1280×1280 RGBA). Existing Kilo crown and case art retained.\n\nBuilt CSS: ${cssFile}\nSHA-256: ${sha(css)}\nDetailed rectangles and results: check.json\n`,
);
console.log(
  JSON.stringify(
    {
      result: "PASS",
      purchaseChecks,
      featureCases: featureCases.length,
      viewportCases: controlLayout.length,
      cssFile,
      report: "public/kilo-features-v36/VERIFICATION.md",
    },
    null,
    2,
  ),
);
