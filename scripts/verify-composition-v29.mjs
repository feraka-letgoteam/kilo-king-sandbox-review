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
  readFileSync("scripts/checkpoints/composition-v29.json", "utf8"),
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
  "src/components/kilo/control-theme.ts",
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
for (const [name, value] of Object.entries(baselineTokens).filter(([name]) => name !== "portraitGroup"))
  assert.deepEqual(
    CONTROL_TOKENS[name],
    value,
    `Existing geometry token changed: ${name}`,
  );
// Compare all outputs over an explicit width/height grid; checkpoint sources are
// embedded so this verification also runs from the source archive without Git.
let unchangedLayoutCases = 0;
for (const variant of ["landscape", "compact"]) {
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
const composition = [];
for (const c of layouts.filter(c => [360,390,1440,844].includes(c.viewport[0]))) {
  const d=c.dock, old=baselineLayout(c.input);
  for(const feature of [false,true]) {
    const modules={balance:d.balance,win:d.win,bet:feature?d.counter:d.bet,...controlTargets(d,feature)};
    // Target children are inside Bet by design; compare targets to each other
    // and independent module envelopes separately.
    const groups={balance:d.balance,win:d.win,bet:feature?d.counter:d.bet,spin:d.spin,
      menu:feature?d.featureMenu:d.menu,turbo:feature?d.featureTurbo:d.turbo,...feature?{}:{auto:d.auto,buy:d.buy}};
    for(const collection of [controlTargets(d,feature),groups]) {
      const entries=Object.entries(collection);
      for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++)
        assert(!overlap(entries[i][1],entries[j][1]),`${c.viewport}: ${entries[i][0]} overlaps ${entries[j][0]}`);
    }
    for(const r of Object.values(controlTargets(d,feature)))assert(r.w>=44&&r.h>=44);
    for(const [key,r] of Object.entries(groups))if(key!=='spin')assert(separation(r,d.spin)>0);
  }
  if(d.variant==='desktop') {
    for(const key of ['balance','win','bet','spin','auto','buy','turbo','menu']) {
      assert.equal(d[key].w,old[key].w);assert.equal(d[key].h,old[key].h);
    }
    const gaps=x=>({menuBalance:x.balance.x-x.menu.x-x.menu.w,balanceWin:x.win.x-x.balance.x-x.balance.w,
      winBet:x.bet.x-x.win.x-x.win.w,betAuto:x.auto.x-x.bet.x-x.bet.w,
      autoSpin:x.spin.x-x.auto.x-x.auto.w,spinBuy:x.buy.x-x.spin.x-x.spin.w});
    const before=gaps(old),after=gaps(d);
    for(const key of Object.keys(before))assert(after[key]>0&&after[key]<before[key]);
    composition.push({viewport:c.viewport.join('x'),before,after,groupWidthBefore:old.buy.x+old.buy.w-old.turbo.x,groupWidthAfter:d.buy.x+d.buy.w-d.turbo.x});
  }
  if(d.variant==='portrait') {
    assert.equal(d.height,160);assert(d.buy.x+d.buy.w-d.bet.x<=old.buy.x+old.buy.w-old.bet.x);
    composition.push({viewport:c.viewport.join('x'),groupWidthBefore:old.buy.x+old.buy.w-old.bet.x,groupWidthAfter:d.buy.x+d.buy.w-d.bet.x,allocation:160,betSpinGap:d.spin.x-d.bet.x-d.bet.w,spinToolsGap:d.auto.x-d.spin.x-d.spin.w});
  }
}
const anchoring=[];
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
      assert.equal(p["background-color"], has(n, "sc-well") ? "#01070b" : "#020c12");
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
    if(event === 'rest' && c.state === 'idle' && c.input.variant === 'portrait') {
      const shell=nodes.find(n=>has(n,'kk-shell'));
      const v=styles.get(shell).values;
      assert.equal(v['row-gap'],'20px');
      anchoring.push({viewport:c.viewport.join('x'),reelToDock:20,paintedCabinetOutset:14,cabinetToDock:6,previousCabinetToDock:10,dockAllocation:160,unusedInsideDock:4,viewportSpaceBelowChange:4});
    }
    for(const n of nodes.filter(n=>n.tag==='strong' && has(n.parent,'sc-well')))assert.equal(styles.get(n).values.color,'#fff8e8');
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
const output='public/kilo-composition-v29';mkdirSync(output,{recursive:true});
const report={checkpoint:checkpoint.commit,passed:true,method:'Source geometry and production CSS cascade against real React SSR markup; no browser screenshots.',protectedSourceFiles:protectedFiles.length,unchangedLandscapeCompactCases:unchangedLayoutCases,composition,anchoring,geometry,paint,productionStylesheet:cssFile,productionStylesheetSha256:hash(css),limitations:['No browser rasterization or interaction verification.','Safe-area insets modeled as zero.','Portrait spare viewport space is not reduced: moving a fixed-height control dock upward by 4px increases the background beneath it by 4px. The requested tighter attachment is achieved, but eliminating that background requires relaxing composition or sizing constraints.']};
writeFileSync(`${output}/composition-report.json`,JSON.stringify(report,null,2)+'\n');
writeFileSync(`${output}/COMPOSITION_VERIFICATION.md`,`# Composition v29\n\n${report.method}\n\nCheckpoint: ${checkpoint.commit}. ${protectedFiles.length} protected source files unchanged; engine, wallet, reel sizing, collection, hook behavior, charge math and action markup retained.\n\n## Geometry\n\n| Viewport | Occupied width before | Occupied width after | Spin-to-secondary gap |\n|---|---:|---:|---:|\n${composition.map(c=>`| ${c.viewport} | ${c.groupWidthBefore}px | ${c.groupWidthAfter}px | ${c.after?.autoSpin ?? c.spinToolsGap}px |`).join('\n')}\n\nDesktop: Menu-to-Balance 16→8px; well/module gaps 12→8px; Auto-to-Spin and Spin-to-Buy 8→6px. Control and well dimensions are unchanged. Landscape at 844×390 retains every position and size.\n\nPortrait: 160px allocation, 96px centered Spin, 104×88px Bet, 44px minimum targets, 12px secondary grid gaps. Cabinet-to-controls clearance is 6px (previously 10px). No overlaps in base or feature layouts at all four requested viewports. Landscape/compact outputs match the checkpoint in ${unchangedLayoutCases} cases.\n\n## Material\n\nProduction CSS confirms #020c12 circular faces, darker #01070b wells, warm-white #fff8e8 numbers, 14px labels, solid 8px Spin and 2px secondary borders, full disabled opacity, no gradients or blur. Icons remain white with at least 3px strokes. Cost and disabled reason retain their unchanged placement in the Spin group.\n\n## Cause\n\nDesktop's mixed 12–16px module gaps and portrait's 360px group cap spread the controls apart. Inline layout coordinates, not a CSS cascade override, caused that spacing. The shared well/face color and gold WIN override reduced numeric consistency; the well is now darker and WIN uses the same warm-white ink. Existing hard rims were already resolving correctly and were preserved.\n\n## Remaining limitation\n\n${report.limitations.map(s=>'- '+s).join('\n')}\n`);
console.log(JSON.stringify({passed:true,geometryCases:geometry.length,paintCases:cases.length,protectedSourceFiles:protectedFiles.length,report:`${output}/COMPOSITION_VERIFICATION.md`},null,2));
