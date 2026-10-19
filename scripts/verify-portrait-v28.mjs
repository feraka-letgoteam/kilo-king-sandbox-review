// Source-derived geometry, real SSR markup, and production CSS cascade only.
// No browser automation, server, screenshot capture, gameplay, or deployment.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
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
  readFileSync("scripts/checkpoints/portrait-v28.json", "utf8"),
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
for (const [name, value] of Object.entries(baselineTokens))
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
  assert.deepEqual(d.balance, old.balance);
  assert.deepEqual(d.win, old.win);
  if (d.width < 320) assert.deepEqual(d, old, "Narrow fallback changed");
  if ([360, 390].includes(c.viewport[0])) {
    assert.equal(d.spin.w, 96);
    assert.equal(d.spin.x + d.spin.w / 2, d.width / 2);
    assert.equal(d.bet.w, 104);
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
      assert(betSpinGap >= 16);
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
const paint = [];
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
      assert.equal(p["background-color"], "#020c12");
      assert.equal(p["background-image"], "none");
      for (let a = n; a; a = a.parent) {
        const av = styles.get(a).values;
        assert.equal(av.opacity, "1");
        assert.equal(av.filter, "none");
        assert.equal(av["backdrop-filter"], "none");
      }
      if (p["box-shadow"] && p["box-shadow"] !== "none")
        for (const sh of declaration("box-shadow", p["box-shadow"]))
          assert.equal(sh.blur.value.value, 0);
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
const output = process.env.PORTRAIT_REVIEW_OUTPUT ?? "public/kilo-portrait-v28";
mkdirSync(output, { recursive: true });
const report = {
  checkpoint: checkpoint.commit,
  passed: true,
  method:
    "Source-derived pixel rectangles, checkpoint comparisons, real React server-rendered markup, and production CSS cascade resolution. No browser execution or live screenshots.",
  protectedSourceFiles: protectedFiles.length,
  protectedSourcePaths: protectedFiles,
  existingTokensUnchanged: true,
  unchangedDesktopLandscapeCompactCases: unchangedLayoutCases,
  productionStylesheet: cssFile,
  productionStylesheetSha256: hash(css),
  geometry,
  paint,
  limitations: [
    "CSS resolution uses the repository cascade evaluator, not browser computedStyle.",
    "Geometry includes a conservative 3px badge overflow on all secondary controls; font rasterization and browser painting are not observed.",
    "Safe-area insets are zero in these source-derived viewport checks.",
    "Narrow fallback below 320px control width retains its earlier 8px spacing and 80px Spin. Desktop and landscape remain byte-equivalent in computed layout outputs.",
  ],
};
writeFileSync(
  `${output}/portrait-layout-report.json`,
  JSON.stringify(report, null, 2) + "\n",
);
writeFileSync(
  `${output}/PORTRAIT_LAYOUT_VERIFICATION.md`,
  `# Portrait layout v28\n\n${report.method}\n\nCheckpoint: ${checkpoint.commit}. ${protectedFiles.length} protected source files unchanged. Only portrait control layout and new portrait spacing tokens changed. All existing tokens, control CSS, engine, wallet, settlement, reel sizing, collection, hook behavior, charge math and interaction markup match the checkpoint.\n\n| Viewport | State | Bet → Spin | Spin → secondary | Smallest painted gap | Smallest target | Allocation |\n|---|---|---:|---:|---:|---:|---:|\n${geometry.map((r) => `| ${r.viewport} | ${r.state} | ${r.betSpinGap}px | ${r.spinToolsGap}px | ${r.minimumPaintSeparation}px | ${r.minTarget}px | 160px |`).join("\n")}\n\nNo target or conservative painted module envelope overlaps. The primary 360/390 cases retain a 96px centered Spin and 104×88px compact Bet. The 2×2 secondary group uses 44px circles and 12px spacing. Badges remain within the dock.\n\n${unchangedLayoutCases} desktop, landscape, and compact layout comparisons exactly match the checkpoint. Twenty real SSR state/viewport cases, each checked at rest and pressed, retain opaque #020c12 faces, 8px Spin / 2px secondary solid rims, 14px labels, opaque badges and ≥3px white icons. The disabled reason and cost remain children of the Spin group; the charge rectangle stays within the Spin bounds. Font rasterization inside the circular face is not browser-verified.\n\n## Cause\n\nThe old portrait formula let the Bet well expand into unused width and anchored the secondary grid to Spin with the shared 8px gap. With an 8px Spin rim, its equal-width spacing made the three groups appear crowded. Geometry is inline from layout.ts; changing a host CSS gap cannot alter those absolute positions. This pass bounds the Bet well and reserves separate lanes and badge space. No material cascade override was changed or needed.\n\n## Limits\n\n${report.limitations.map((s) => "- " + s).join("\n")}\n`,
);
console.log(
  JSON.stringify(
    {
      passed: true,
      geometryCases: geometry.length,
      paintStates: cases.length,
      unchangedDesktopLandscapeCompactCases: unchangedLayoutCases,
      protectedSourceFiles: protectedFiles.length,
      report: `${output}/PORTRAIT_LAYOUT_VERIFICATION.md`,
    },
    null,
    2,
  ),
);
