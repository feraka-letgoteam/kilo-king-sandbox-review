// No browser, screenshot, server, deployment or gameplay execution.
// v26: run after the production build. Reuses the independent markup/font suite,
// then resolves that markup against the complete bundled stylesheet.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { transformStyleAttribute } from "lightningcss";

import { MATERIAL_STYLE } from "../src/components/kilo/material.ts";
import {
  prepareTree,
  productionCascade,
  resolveTree,
  variables,
} from "./control-css-cascade.mjs";

const directory =
  process.env.CONTROL_REVIEW_OUTPUT ?? "public/kilo-composition-v26";
const checkpoint = JSON.parse(
  readFileSync("scripts/checkpoints/composition-v26.json"),
);

const allowed = new Set([
  "src/components/slot-controls/SlotControls.tsx",
  "src/components/slot-controls/controls.css",
  "src/components/slot-controls/layout.ts",
  "src/components/kilo/base-scene.css",
  "src/components/kilo/feature-panel.css",
  "src/styles.css",
]);
// All click handlers, disabled gates, selected-state bindings, dialog contracts
// and the Spin ref must match 36df2d3 even when the visible icons are replaced.
const controlsSource = readFileSync(
  "src/components/slot-controls/SlotControls.tsx",
  "utf8",
);
const controlAst = ts.createSourceFile(
  "SlotControls.tsx",
  controlsSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const printer = ts.createPrinter({ removeComments: true });
const actionBindings = [];
function collectBindings(n) {
  if (
    ts.isJsxAttribute(n) &&
    (/^on[A-Z]/.test(n.name.text) ||
      [
        "disabled",
        "aria-disabled",
        "aria-pressed",
        "aria-haspopup",
        "aria-describedby",
        "ref",
      ].includes(n.name.text))
  )
    actionBindings.push(
      printer.printNode(ts.EmitHint.Unspecified, n, controlAst),
    );
  ts.forEachChild(n, collectBindings);
}
collectBindings(controlAst);
assert.equal(
  createHash("sha256").update(JSON.stringify(actionBindings)).digest("hex"),
  "cf97865df1f6b9aa5987ed731bf855a7f8a5c167d7558d39be69fa2abc6e8c2d",
  "Control action/gating bindings changed",
);
const protectedFiles = [];
for (const [path, hash] of Object.entries(checkpoint.sourceFiles))
  if (!allowed.has(path)) {
    assert.equal(
      createHash("sha256").update(readFileSync(path)).digest("hex"),
      hash,
      `${path} changed`,
    );
    protectedFiles.push(path);
  }
const html = readFileSync("dist/index.html", "utf8");
const cssFile = "dist" + html.match(/href="([^\"]+\.css)"/)[1];
const cssText = readFileSync(cssFile, "utf8"),
  cascade = productionCascade(
    cssText.replaceAll(":first-of-type", ":nth-of-type(1)"),
  );
// The established suite covers 50 viewport layouts, real shipped-font metrics,
// charge/reason containment, 76 SSR states and purchase/jurisdiction semantics.
const modular = execFileSync(
  process.execPath,
  ["scripts/verify-modular-controls.mjs"],
  {
    env: { ...process.env, CONTROL_REVIEW_OUTPUT: directory },
    encoding: "utf8",
  },
);
const sheetPath = `${directory}/control-state-review.html`;
writeFileSync(
  sheetPath,
  readFileSync(sheetPath, "utf8")
    .replaceAll("Modular controls v25", "Modular controls v26")
    .replace(
      "No deployment.</p>",
      "Published as an inert source review sheet.</p>",
    ),
);
const cases = JSON.parse(readFileSync(`${directory}/cascade-cases.json`));
// This v25 snapshot predates only the verified 4px landscape spacing correction.
// All four acceptance viewports must retain those final v25 control rectangles.
const originalLayouts = JSON.parse(
  readFileSync("scripts/checkpoints/contrast-v25.json"),
).layouts;
for (const c of cases) {
  const expected = structuredClone(originalLayouts[c.viewport.join("x")]);
  if (expected.variant === "landscape")
    for (const name of ["spin", "turbo", "featureTurbo", "charge"])
      expected[name].y += 4;
  assert.deepEqual(
    c.dock,
    expected,
    `Acceptance control geometry changed at ${c.viewport}`,
  );
}

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/"))
      specifier = new URL(`../src/${specifier.slice(2)}`, import.meta.url).href;
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
        source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
          compilerOptions: {
            target: ts.ScriptTarget.ESNext,
            module: ts.ModuleKind.ESNext,
            jsx: ts.JsxEmit.ReactJSX,
          },
        }).outputText,
      };
    return next(url, context);
  },
});
const { createElement: element } = await import("react");
const { renderToStaticMarkup: render } = await import("react-dom/server");
const { SlotControls } =
  await import("../src/components/slot-controls/SlotControls.tsx");
const { KILO_CONTROL_THEME } =
  await import("../src/components/kilo/control-theme.ts");
const { FeatureMark } =
  await import("../src/components/kilo/StageSurround.tsx");
const { fitGameLayout } = await import("../src/components/kilo/layout.ts");
const { createControlLayout } =
  await import("../src/components/slot-controls/layout.ts");
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
for (const [w, h] of [
  [320, 568],
  [352, 640],
  [375, 667],
  [1920, 1080],
]) {
  const game = fitGameLayout(
    w - (w <= 620 ? 24 : 32),
    h - (w <= 620 ? 32 : 40),
  );
  const dock = createControlLayout({
    variant: game.mode === "wide" ? "desktop" : game.mode,
    width:
      game.mode === "landscape"
        ? game.width
        : game.mode === "portrait"
          ? game.reelWidth
          : Math.max(760, game.reelWidth),
    height: game.dock,
    footerWidth: game.reelWidth,
  });
  if (w === 1920) {
    assert.equal(
      dock.buy.x + dock.buy.w - dock.turbo.x,
      888,
      "Wide desktop control group must cap at888px",
    );
    assert.equal(
      dock.turbo.x,
      (dock.width - 888) / 2,
      "Wide desktop group must remain centered",
    );
  }
  for (const [name, patch] of [
    ["base-idle", {}],
    ["ante-on", { ante: true, charge: { amount: "1,500" } }],
    [
      "insufficient-balance",
      {
        balance: "400",
        spinDisabled: true,
        spinDisabledReason: "Insufficient balance",
      },
    ],
    [
      "feature-entry",
      {
        feature: { remaining: 10, multiplier: 2 },
        busy: true,
        locked: true,
        charge: { label: "Free spins" },
      },
    ],
  ])
    cases.push({
      viewport: [w, h],
      state: name,
      game,
      dock,
      html: render(
        element(SlotControls, {
          layout: dock,
          state: { ...base, ...patch },
          actions,
          theme: KILO_CONTROL_THEME,
          icons: { buy: element(FeatureMark) },
          bonusAnchorClassName: "kk-bonus-win",
        }),
      ),
    });
}
// Real SSR markup placed under the host's actual ancestor classes/attributes.
// No simulated modal overlay is added: this audit concerns the control system.
const trees = JSON.parse(
  execFileSync(
    "python",
    [
      "-c",
      `
import json,sys
from lxml import html
def node(e):
 return {'tag':e.tag, 'attrs':dict(e.attrib), 'text':e.text or '', 'children':[node(c) for c in e if isinstance(c.tag,str)]}
print(json.dumps([node(html.fromstring(s)) for s in json.load(sys.stdin)]))
`,
    ],
    {
      input: JSON.stringify(
        cases.map(
          (c) =>
            `<html><body><div id="root"><div class="kk-app" data-review="false"><main class="kk-stage"><div class="kk-shell${c.state.startsWith("feature") || ["collection", "retrigger", "completion-long"].includes(c.state) ? " is-feature" : ""}" data-layout="${c.game.mode}" data-framing="${c.game.artLeft ? "sides" : "header"}"><div class="kk-modular-controls">${c.html}</div></div></main></div></div></body></html>`,
        ),
      ),
      maxBuffer: 16 * 1024 * 1024,
    },
  ).toString(),
);
const classes = (n) => (n.attrs.class ?? "").split(/\s+/),
  has = (n, c) => classes(n).includes(c);
const walk = (n) => [n, ...n.children.flatMap(walk)];
const value = (s, n, p) => {
  const v = s.get(n).values;
  // The production minifier folds align/justify-items into place-items.
  if (
    p.startsWith("padding-") &&
    v.padding &&
    v[p] &&
    [...v[p]].reduce(
      (depth, ch) => depth + (ch === "(" ? 1 : ch === ")" ? -1 : 0),
      0,
    ) !== 0
  ) {
    const terms = [];
    let depth = 0,
      term = "";
    for (const ch of v.padding) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (/\s/.test(ch) && depth === 0) {
        if (term) terms.push(term);
        term = "";
      } else term += ch;
    }
    if (term) terms.push(term);
    const i = ["top", "right", "bottom", "left"].indexOf(p.slice(8));
    return terms[i] ?? terms[i === 2 ? 0 : 1] ?? terms[0];
  }
  if (v[p] !== undefined) return v[p];
  if ((p === "overflow-x" || p === "overflow-y") && v.overflow) {
    const parts = v.overflow.split(/\s+/);
    return p === "overflow-x" ? parts[0] : (parts[1] ?? parts[0]);
  }
  if ((p === "align-items" || p === "justify-items") && v["place-items"]) {
    const parts = v["place-items"].split(/\s+/);
    return p === "align-items" ? parts[0] : (parts[1] ?? parts[0]);
  }
  return undefined;
};
const number = (v) => parseFloat(v ?? "0") || 0;
const identity = (n) =>
  n.attrs["data-control"] ??
  n.attrs["data-module"] ??
  n.attrs["data-testid"] ??
  n.attrs.class;
function decl(property, value) {
  let result;
  transformStyleAttribute({
    code: Buffer.from(`${property}:${value}`),
    visitor: {
      Declaration(d) {
        if (d.property === property) result = d.value;
      },
    },
  });
  assert(result !== undefined, `Unparsed ${property}:${value}`);
  return result;
}
function opaque(color) {
  const parsed = decl("color", color);
  assert.equal(parsed.alpha, 1, `Translucent ${color}`);
}
function noBlur(shadow) {
  if (shadow === "none") return;
  for (const s of decl("box-shadow", shadow))
    assert.equal(s.blur.value.value, 0, `Blurred shadow ${shadow}`);
}
function lengths(shadow) {
  const b = { l: 0, r: 0, t: 0, b: 0 };
  if (shadow === "none") return b;
  for (const s of decl("box-shadow", shadow)) {
    if (s.inset) continue;
    const num = (x) => x.value.value;
    const x = num(s.xOffset),
      y = num(s.yOffset),
      spread = num(s.spread),
      blur = num(s.blur);
    assert.equal(blur, 0);
    b.l = Math.max(b.l, spread - x);
    b.r = Math.max(b.r, spread + x);
    b.t = Math.max(b.t, spread - y);
    b.b = Math.max(b.b, spread + y);
  }
  return b;
}
const intersect = (a, b) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.001 &&
  Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.001;
const separation = (a, b) =>
  Math.max(b.x - a.x - a.w, a.x - b.x - b.w, b.y - a.y - a.h, a.y - b.y - b.h);
function positions(nodes, styles, dock) {
  const boxes = new Map();
  function rect(n) {
    if (boxes.has(n)) return boxes.get(n);
    const v = styles.get(n).values;
    let containing = n.parent;
    while (
      containing &&
      !has(containing, "sc-system") &&
      value(styles, containing, "position") !== "absolute" &&
      value(styles, containing, "position") !== "relative"
    )
      containing = containing.parent;
    const parent =
      !containing || has(containing, "sc-system")
        ? { x: 0, y: 0, w: dock.width, h: dock.height }
        : rect(containing);
    const px = (v, axis) =>
      v?.endsWith("%") ? (parseFloat(v) / 100) * parent[axis] : number(v);
    assert.equal(
      v["box-sizing"],
      "border-box",
      `${identity(n)} must include its rim in the measured size`,
    );
    assert.equal(v.transform, "none");
    const r = {
      x: parent.x + px(v.left ?? "0", "w"),
      y: parent.y + px(v.top ?? "0", "h"),
      w: px(v.width, "w"),
      h: px(v.height, "h"),
    };
    boxes.set(n, r);
    return r;
  }
  for (const n of nodes.filter(
    (n) => has(n, "sc-well") || has(n, "sc-button") || has(n, "sc-spin-group"),
  ))
    rect(n);
  return boxes;
}
let paintCases = 0,
  comparisons = 0,
  targetCases = 0;
const matrix = [],
  resolved = [],
  composition = [];
for (let index = 0; index < cases.length; index++) {
  const c = cases[index],
    tree = prepareTree(trees[index]),
    nodes = walk(tree);
  const stage = nodes.find((n) => has(n, "kk-stage"));
  const app = nodes.find((n) => has(n, "kk-app")),
    shell = nodes.find((n) => has(n, "kk-shell")),
    host = nodes.find((n) => has(n, "kk-modular-controls"));
  app.attrs["data-material"] = "marina";
  app.attrs["data-reduced"] = "0";
  app.attrs.style = Object.entries(MATERIAL_STYLE)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  shell.attrs.style = Object.entries({
    "game-width": c.game.width,
    "game-height": c.game.height,
    "reel-width": c.game.reelWidth,
    "reel-height": c.game.reelHeight,
    "header-height": c.game.header,
    "dock-height": c.game.dock,
    "strip-height": c.game.strip,
    "side-width": c.game.side,
    "control-left": c.game.controlLeft,
    "art-left": c.game.artLeft,
    "art-right": c.game.artRight,
    "dock-gap": c.game.dockGap,
  })
    .map(([k, v]) => `--${k}:${v}px`)
    .join(";");
  host.attrs.style = `width:${c.dock.width}px;height:${c.dock.height}px`;
  const circleNodes = nodes.filter(
    (n) => has(n, "sc-circle") || has(n, "sc-spin"),
  );
  const wells = nodes.filter((n) => has(n, "sc-well"));
  const buttons = nodes.filter((n) => has(n, "sc-button"));
  const modes = [
    { name: "rest", target: null, events: [] },
    ...buttons
      .filter((n) => !("disabled" in n.attrs))
      .flatMap((n) => [
        { name: `hover:${identity(n)}`, target: n, events: ["hover"] },
        {
          name: `pressed:${identity(n)}`,
          target: n,
          events: ["hover", "active", "focus", "focus-visible"],
        },
        {
          name: `focus:${identity(n)}`,
          target: n,
          events: ["focus", "focus-visible"],
        },
      ]),
  ];
  let minimum = Infinity;
  let firstBoxes;
  for (const mode of modes) {
    const state = new Map(
      mode.target ? [[mode.target, new Set(mode.events)]] : [],
    );
    for (const hover of [true, false]) {
      const context = { viewport: c.viewport, state, hover },
        styles = resolveTree(tree, cascade, context);
      if (mode.name === "rest" && hover) {
        assert.equal(
          value(styles, stage, "align-items"),
          "start",
          "Stage must align to viewport top",
        );
        assert.equal(
          value(styles, stage, "justify-items"),
          "center",
          "Stage retains horizontal centering",
        );
        if (c.game.mode === "portrait") {
          assert.equal(
            styles.get(shell).vars["--crest-rise"],
            "0px",
            "Portrait crest must not reserve a second header row",
          );
          assert.equal(c.game.dock, 160, "Portrait control allocation changed");
        }
        composition.push({
          viewport: c.viewport.join("x"),
          state: c.state,
          alignItems: value(styles, stage, "align-items"),
          justifyItems: value(styles, stage, "justify-items"),
          stagePadding: ["top", "right", "bottom", "left"].map((side) =>
            value(styles, stage, "padding-" + side),
          ),
          crestRise: styles.get(shell).vars["--crest-rise"] ?? null,
          reel: { width: c.game.reelWidth, height: c.game.reelHeight },
          dockHeight: c.dock.height,
        });
      }
      for (const n of [...circleNodes, ...wells]) {
        const s = styles.get(n),
          v = s.values;
        const paint = has(n, "sc-bet")
          ? Object.fromEntries(
              Object.entries(
                cascade(n, { ...context, pseudo: "before" }).values,
              ).map(([k, v]) => [k, variables(v, s.vars)]),
            )
          : v;
        assert.equal(
          paint["background-color"],
          "#020c12",
          `${c.state}:${identity(n)} face`,
        );
        assert.equal(paint["background-image"], "none");
        opaque(paint["background-color"]);
        for (let a = n; a; a = a.parent) {
          assert.equal(
            value(styles, a, "opacity"),
            "1",
            `Ancestor dims ${identity(n)}`,
          );
          assert.equal(
            value(styles, a, "filter"),
            "none",
            `Ancestor filters ${identity(n)}`,
          );
          assert.equal(value(styles, a, "backdrop-filter"), "none");
        }
        noBlur(paint["box-shadow"] ?? "none");
        if (has(n, "sc-circle") || has(n, "sc-spin")) {
          assert.equal(
            v["border-top-width"],
            has(n, "sc-spin") ? "8px" : "2px",
          );
          assert.equal(v["border-top-style"], "solid");
          opaque(v["border-top-color"]);
          if (has(n, "sc-circle") && n.attrs["aria-pressed"] === "true")
            assert.equal(
              v["border-top-color"],
              s.vars["--sc-accent"],
              "Selected rim must remain teal, including hover",
            );
          const icons = walk(n).filter(
            (x) => has(x, "sc-icon") && x.parent === n,
          );
          for (const icon of icons) {
            assert.equal(value(styles, icon, "color"), "#ffffff");
            for (const svg of walk(icon).filter((x) => x.tag === "svg")) {
              assert(number(value(styles, svg, "stroke-width")) >= 3);
              for (const p of walk(svg).filter((x) => x.attrs.stroke))
                assert(number(value(styles, p, "stroke-width")) >= 3);
            }
          }
        }
        if (
          mode.name === "rest" &&
          hover &&
          [
            "base-idle",
            "ante-on",
            "insufficient-balance",
            "feature-entry",
          ].includes(c.state)
        )
          resolved.push({
            viewport: c.viewport.join("x"),
            state: c.state,
            control: identity(n),
            values: Object.fromEntries(
              [
                "background-color",
                "background-image",
                "border-top-width",
                "border-top-style",
                "border-top-color",
                "box-shadow",
                "opacity",
                "filter",
                "backdrop-filter",
                "box-sizing",
              ].map((k) => [k, paint[k] ?? v[k]]),
            ),
            winningSelectors: Object.fromEntries(
              Object.entries(s.winners).filter(([k]) =>
                /^(background|border|box-shadow|opacity|filter|backdrop-filter|box-sizing)/.test(
                  k,
                ),
              ),
            ),
          });
        paintCases++;
      }
      // Badges retain opaque paint in normal and selected speed states.
      for (const badge of nodes.filter((n) => has(n, "sc-badge"))) {
        opaque(value(styles, badge, "background-color"));
        assert.equal(value(styles, badge, "opacity"), "1");
      }
      for (const n of nodes.filter((n) => has(n, "sc-label")))
        assert.match(
          value(styles, n, "font"),
          /14px\s*\/\s*1\b/,
          "Label must stay 14px",
        );
      for (const n of nodes.filter(
        (n) => n.tag === "strong" && n.parent && has(n.parent, "sc-well"),
      )) {
        assert.equal(
          value(styles, n, "color"),
          n.parent.attrs["data-module"] === "win"
            ? styles.get(n).vars["--sc-edgeLight"]
            : "#fff8e8",
        );
        if (n.attrs.style)
          assert(
            number(value(styles, n, "font-size")) > 14,
            "Amounts must be larger than labels",
          );
      }
      const boxes = positions(nodes, styles, c.dock);
      firstBoxes ??= boxes;
      const modules = [...circleNodes, ...wells].map((n) => {
        const r = { ...boxes.get(n) },
          v = styles.get(n).values,
          ext = lengths(v["box-shadow"]),
          outline = Math.max(
            0,
            number(v["outline-width"]) + number(v["outline-offset"]),
          );
        for (const k of ["l", "r", "t", "b"])
          ext[k] = Math.max(ext[k], outline);
        // Conservative bounds for the small speed/lock badge. The real bounds
        // are smaller because their parent border is part of the containing box.
        if (
          walk(n).some(
            (b) => has(b, "sc-badge") || has(b, "sc-restriction-mark"),
          )
        ) {
          ext.r = Math.max(ext.r, 3);
          ext.t = Math.max(ext.t, 3);
        }
        return {
          n,
          r: {
            x: r.x - ext.l,
            y: r.y - ext.t,
            w: r.w + ext.l + ext.r,
            h: r.h + ext.t + ext.b,
          },
        };
      });
      for (let i = 0; i < modules.length; i++)
        for (const b of modules.slice(i + 1)) {
          const a = modules[i];
          assert(
            !intersect(a.r, b.r),
            `${c.viewport} ${c.state} ${mode.name}: painted overlap ${identity(a.n)} / ${identity(b.n)}`,
          );
          comparisons++;
          minimum = Math.min(minimum, separation(a.r, b.r));
        }
      for (let i = 0; i < buttons.length; i++) {
        const r = boxes.get(buttons[i]);
        assert(r.w >= 44 && r.h >= 44, `Small target ${identity(buttons[i])}`);
        targetCases++;
        for (const b of buttons.slice(i + 1))
          assert(
            !intersect(r, boxes.get(b)),
            `Hit target overlap ${identity(buttons[i])}/${identity(b)}`,
          );
      }
      if (c.dock.variant === "portrait") {
        assert.equal(c.dock.height, 160);
        for (const { r } of modules)
          assert(
            r.y >= 0 && r.y + r.h <= 160,
            `Portrait paint exceeds allocation`,
          );
      }
    }
  }
  const get = (name) => {
    const n = nodes.find((n) => n.attrs["data-module"] === name);
    return n ? firstBoxes.get(n) : undefined;
  };
  matrix.push({
    viewport: c.viewport.join("x"),
    state: c.state,
    spin: firstBoxes.get(nodes.find((n) => has(n, "sc-spin"))),
    balance: get("balance"),
    win: get("win"),
    bet: get("bet") ?? get("free-spins"),
    minimumPaintedSeparation: Number(minimum.toFixed(2)),
    modes: modes.length,
    overlaps: 0,
  });
}
// Actual shipped-font ink bounds for the newly added captions and the
// repositioned disabled reason. No canvas/browser text approximation is used.
const font = JSON.parse(
  execFileSync(
    "python",
    [
      "-c",
      `
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
import json,string
f=TTFont('src/components/slot-controls/fonts/SourceSans3-700.woff2'); c=f.getBestCmap(); g=f.getGlyphSet(); glyphs={}
for ch in string.ascii_letters+' ': 
 p=BoundsPen(g); g[c[ord(ch)]].draw(p); glyphs[ch]={'advance':f['hmtx'][c[ord(ch)]][0], 'bounds':p.bounds}
print(json.dumps({'em':f['head'].unitsPerEm,'ascent':f['hhea'].ascent,'descent':f['hhea'].descent,'glyphs':glyphs}))
`,
    ],
    { encoding: "utf8" },
  ),
);
function textInk(text, size, lineHeight, top, center, spacing = 0) {
  const scale = size / font.em;
  const width = [...text].reduce(
    (sum, ch) => sum + font.glyphs[ch].advance * scale + spacing,
    0,
  );
  let x = center - width / 2;
  const baseline =
    top +
    (lineHeight - (font.ascent - font.descent) * scale) / 2 +
    font.ascent * scale;
  const boxes = [];
  for (const ch of text) {
    const g = font.glyphs[ch];
    if (g.bounds)
      boxes.push({
        x: x + g.bounds[0] * scale,
        y: baseline - g.bounds[3] * scale,
        w: (g.bounds[2] - g.bounds[0]) * scale,
        h: (g.bounds[3] - g.bounds[1]) * scale,
      });
    x += g.advance * scale + spacing;
  }
  return boxes;
}
function insideFace(boxes, size, rim, label) {
  const radius = size / 2 - rim;
  for (const box of boxes)
    for (const x of [box.x, box.x + box.w])
      for (const y of [box.y, box.y + box.h])
        assert(
          Math.hypot(x - size / 2, y - size / 2) <= radius + 0.01,
          `${label}: ink crosses inner rim`,
        );
}
let captionChecks = 0,
  reasonChecks = 0;
for (let i = 0; i < cases.length; i++) {
  const c = cases[i],
    tree = prepareTree(trees[i]),
    nodes = walk(tree);
  const styles = resolveTree(tree, cascade, {
    viewport: c.viewport,
    hover: false,
  });
  for (const caption of nodes.filter((n) => has(n, "sc-control-caption"))) {
    const button = caption.parent;
    const size = number(value(styles, button, "width"));
    const icon = walk(button).find((n) => n.tag === "svg");
    const iconHeight = number(value(styles, icon, "height"));
    const gap = number(value(styles, button, "gap"));
    const fontDeclaration = value(styles, caption, "font");
    const [, fontSize, lineHeight] = fontDeclaration.match(
      / ([\d.]+)px\/([\d.]+)px /,
    );
    const top =
      (size - iconHeight - gap - Number(lineHeight)) / 2 + iconHeight + gap;
    insideFace(
      textInk(
        caption.text.toUpperCase(),
        Number(fontSize),
        Number(lineHeight),
        top,
        size / 2,
        number(value(styles, caption, "letter-spacing")),
      ),
      size,
      2,
      `${c.viewport} ${caption.text}`,
    );
    captionChecks++;
  }
  const reason = nodes.find((n) => has(n, "sc-action-reason"));
  if (!reason) continue;
  const size = c.dock.spin.w,
    fontSize = number(value(styles, reason, "font-size"));
  const topValue = value(styles, reason, "top");
  const top = topValue.endsWith("%")
    ? (number(topValue) * size) / 100
    : number(topValue);
  const lineHeight = fontSize * 1.15;
  const boxes = reason.text
    .split(" ")
    .flatMap((word, line) =>
      textInk(word, fontSize, lineHeight, top + line * lineHeight, size / 2),
    );
  insideFace(boxes, size, 8, `${c.viewport} ${c.state}: ${reason.text}`);
  const charge = nodes.find((n) => has(n, "sc-charge"));
  assert(
    Math.max(...boxes.map((b) => b.y + b.h)) <
      number(value(styles, charge, "top")),
    "Disabled reason ink overlaps charge container",
  );
  reasonChecks++;
}
// Responsive modal contracts are checked against the same production cascade.
// These are static markup/style checks; scroll reachability is not claimed as
// browser-tested without an actual layout engine.
const { BetPanel, SettingsPanel, FeatureCard, PanelHeader } =
  await import("../src/components/kilo/control-panels.tsx");
const { FEATURES } = await import("../src/components/kilo/feature-catalog.ts");
const modalSamples = [
  [
    "bet",
    "kk-bet-dialog",
    element(BetPanel, {
      stake: 1000,
      ante: true,
      onApply: noop,
      onClose: noop,
    }),
  ],
  [
    "settings",
    "kk-settings",
    element(SettingsPanel, {
      preferences: { speed: "super", motion: "system" },
      onChange: noop,
      locked: false,
      mute: false,
      onMute: noop,
      audioAvailable: true,
      musicVolume: 65,
      effectsVolume: 80,
      onVolume: noop,
      onRules: noop,
      onClose: noop,
    }),
  ],
  [
    "features",
    "kk-purchases",
    element(
      "div",
      null,
      element(PanelHeader, { title: "Features", onClose: noop }),
      element(
        "div",
        { className: "kk-dialog-body kk-features-body" },
        element(
          "div",
          { className: "kk-feature-gallery" },
          ...["scatter-3", "chopper"].map((id) =>
            element(FeatureCard, {
              key: id,
              feature: FEATURES.find((f) => f.id === id),
              stake: 10000,
              bank: 3000000,
              locked: false,
              onSelect: noop,
            }),
          ),
        ),
      ),
    ),
  ],
];
const modalTrees = JSON.parse(
  execFileSync(
    "python",
    [
      "-c",
      `
import json,sys
from lxml import html
def node(e):
 return {'tag':e.tag, 'attrs':dict(e.attrib), 'text':e.text or '', 'children':[node(c) for c in e if isinstance(c.tag,str)]}
print(json.dumps([node(html.fromstring(s)) for s in json.load(sys.stdin)]))
`,
    ],
    {
      input: JSON.stringify(
        modalSamples.map(
          ([, className, content]) =>
            `<html><body><div id="root">${render(element("div", { className: "kk-app", "data-material": "marina", style: MATERIAL_STYLE }, element("div", { className: "kk-modal-root is-blocking" }, element("div", { className: `kk-dialog ${className}`, role: "dialog" }, content))))}</div></body></html>`,
        ),
      ),
      maxBuffer: 16 * 1024 * 1024,
    },
  ).toString(),
);
const modalMatrix = [];
for (const viewport of [
  [1440, 900],
  [390, 844],
  [360, 800],
  [844, 390],
  [320, 568],
])
  for (let i = 0; i < modalTrees.length; i++) {
    const tree = prepareTree(modalTrees[i]),
      nodes = walk(tree);
    const styles = resolveTree(tree, cascade, { viewport, hover: false });
    const dialog = nodes.find((n) => has(n, "kk-dialog"));
    const body = nodes.find((n) => has(n, "kk-dialog-body"));
    const header = nodes.find((n) => has(n, "kk-dialog-head"));
    const root = nodes.find((n) => has(n, "kk-modal-root"));
    const footer = nodes.find((n) => has(n, "kk-dialog-foot"));
    assert.equal(
      value(styles, dialog, "background-color"),
      "#071820",
      "Modal enamel is opaque",
    );
    assert.equal(value(styles, dialog, "background-image"), "none");
    assert.equal(value(styles, dialog, "border-top-width"), "3px");
    assert.equal(value(styles, body, "min-height"), "0");
    assert.equal(value(styles, body, "min-width"), "0");
    assert(
      ["auto", "1 1 auto"].includes(value(styles, body, "flex")),
      "Modal body must flex and shrink",
    );
    assert.equal(
      value(styles, body, "overflow-y") ?? value(styles, body, "overflow"),
      "auto",
    );
    assert.equal(value(styles, header, "flex-shrink"), "0");
    assert(
      number(value(styles, header, "min-height")) >=
        (viewport[1] < 540 && viewport[0] > viewport[1] ? 50 : 58),
    );
    assert.match(
      value(styles, root, "padding-top"),
      /safe-area-inset-top/,
      "Modal respects top safe area",
    );
    if (footer) assert.equal(value(styles, footer, "flex-shrink"), "0");
    let buttonChecks = 0;
    for (const n of nodes.filter(
      (n) =>
        n.tag === "button" || (n.tag === "input" && n.attrs.type === "range"),
    )) {
      assert(
        Math.max(
          number(value(styles, n, "height")),
          number(value(styles, n, "min-height")),
        ) >= 44,
        `${modalSamples[i][0]} ${n.attrs.class ?? n.attrs["aria-label"]}: short target`,
      );
      buttonChecks++;
    }
    for (const n of nodes.filter(
      (n) => has(n, "kk-unavailable") || has(n, "kk-feature-offer"),
    )) {
      assert.notEqual(
        value(styles, n, "text-overflow"),
        "ellipsis",
        "Required price/reason copy truncates",
      );
      assert.notEqual(
        value(styles, n, "white-space"),
        "nowrap",
        "Required price/reason copy cannot wrap",
      );
    }
    if (modalSamples[i][0] === "features") {
      const disabledReason = nodes.find(
        (n) => n.attrs.id === "feature-chopper-reason",
      );
      assert(
        disabledReason?.text.includes("Above the 1,000,000 purchase limit"),
      );
      if (viewport[0] <= 390) {
        const decision = nodes.find(
          (n) =>
            has(n, "kk-feature-decision") &&
            n.attrs["data-unavailable"] === "true",
        );
        assert.match(
          value(styles, decision, "grid-template-columns"),
          /^minmax\(0,\s*1fr\)$/,
        );
      }
      if (viewport[0] > viewport[1] && viewport[1] < 540) {
        const gallery = nodes.find((n) => has(n, "kk-feature-gallery"));
        assert.equal(value(styles, gallery, "overflow-x"), "auto");
        assert.equal(value(styles, gallery, "grid-auto-columns"), "100%");
      }
    }
    modalMatrix.push({
      viewport: viewport.join("x"),
      panel: modalSamples[i][0],
      bodyOverflow:
        value(styles, body, "overflow-y") ?? value(styles, body, "overflow"),
      headerMinHeight: value(styles, header, "min-height"),
      verifiedButtonHeights: buttonChecks,
      footerFixedInFlex:
        !footer || value(styles, footer, "flex-shrink") === "0",
      browserScrollVerified: false,
    });
  }
const report = {
  checkpoint: checkpoint.commit,
  productionCss: cssFile,
  productionCssSha256: createHash("sha256").update(cssText).digest("hex"),
  method:
    "Production CSS cascade + server-rendered markup + absolute border-box/paint-bound calculation. No browser execution.",
  cases: cases.length,
  paintCases,
  paintedPairComparisons: comparisons,
  touchTargetCases: targetCases,
  unchangedControlTokens: true,
  unchangedSourceFiles: protectedFiles.length,
  unchangedSourcePaths: protectedFiles,
  geometryChange:
    "Stage alignment and control presentation only; protected game layout/reel sizing and 160px portrait control allocation retained.",
  actionBindingsUnchanged: true,
  existingModularSuite: JSON.parse(modular),
  composition,
  matrix,
  modalMatrix,
  typographyInkChecks: {
    captions: captionChecks,
    disabledReasons: reasonChecks,
    shippedFont: "SourceSans3-700.woff2",
  },
  resolved,
  browserVerified: false,
  screenshots: [],
  limitations: [
    "No browser getComputedStyle, live pointer interaction, device rasterization or screenshot comparison was performed.",
    "Restriction tooltips are intentional overlays and are excluded from module separation; speed/lock badges are included.",
    "Feature states are supplied to the real control component; no gameplay or settlement is executed.",
  ],
};
mkdirSync(directory, { recursive: true });
writeFileSync(
  `${directory}/resolved-css-layout.json`,
  JSON.stringify(report, null, 2) + "\n",
);
const samples = [
  [".sc-spin", "base-idle", "spin-button"],
  [".sc-spin:disabled", "insufficient-balance", "spin-button"],
  [".sc-circle", "base-idle", "auto"],
  [".sc-readout", "base-idle", "balance"],
  [".sc-bet::before", "base-idle", "bet"],
].map(([selector, state, control]) => {
  const row = resolved.find(
    (r) =>
      r.viewport === "1440x900" && r.state === state && r.control === control,
  );
  assert(row, `Missing resolved sample ${control}`);
  return `${selector} {\n${Object.entries(row.values)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n")}\n}`;
});
writeFileSync(
  `${directory}/resolved-controls.css`,
  `/* Inspection values from ${cssFile}; not a replacement stylesheet.\n   Source-resolved, not browser getComputedStyle. */\n\n${samples.join("\n\n")}\n`,
);
console.log(
  JSON.stringify(
    {
      productionCss: cssFile,
      cases: cases.length,
      modalCases: modalMatrix.length,
      captionChecks,
      reasonChecks,
      paintCases,
      paintedPairComparisons: comparisons,
      touchTargetCases: targetCases,
      unchangedSourceFiles: protectedFiles.length,
      minimumPaintedSeparation: Math.min(
        ...matrix.map((x) => x.minimumPaintedSeparation),
      ),
      browserVerified: false,
    },
    null,
    2,
  ),
);
