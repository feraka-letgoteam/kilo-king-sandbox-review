// No browser, screenshot, server, deployment or gameplay execution.
// Run after build and verify-modular-controls.mjs.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { transformStyleAttribute } from "lightningcss";
import { CONTROL_TOKENS } from "../src/components/slot-controls/tokens.ts";
import { MATERIAL_STYLE } from "../src/components/kilo/material.ts";
import {
  prepareTree,
  productionCascade,
  resolveTree,
  variables,
} from "./control-css-cascade.mjs";

const directory =
  process.env.CONTROL_REVIEW_OUTPUT ?? "public/kilo-contrast-v25";
const checkpoint = JSON.parse(
  readFileSync("scripts/checkpoints/contrast-v25.json"),
);
assert.deepEqual(CONTROL_TOKENS, checkpoint.controlTokens);
const allowed = new Set([
  "src/components/slot-controls/controls.css",
  "src/components/slot-controls/tokens.ts",
  "src/components/slot-controls/layout.ts",
  "src/components/kilo/control-theme.ts",
  "src/components/slot-controls/README.md",
]);
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
  cascade = productionCascade(cssText);
const cases = JSON.parse(readFileSync(`${directory}/cascade-cases.json`));
for (const c of cases) {
  const expected = structuredClone(checkpoint.layouts[c.viewport.join("x")]);
  if (expected.variant === "landscape")
    for (const name of ["spin", "turbo", "featureTurbo", "charge"])
      expected[name].y += 4;
  assert.deepEqual(
    c.dock,
    expected,
    `Unexpected geometry change at ${c.viewport}`,
  );
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
const value = (s, n, p) => s.get(n).values[p];
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
  resolved = [];
for (let index = 0; index < cases.length; index++) {
  const c = cases[index],
    tree = prepareTree(trees[index]),
    nodes = walk(tree);
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
        assert.equal(value(styles, n, "color"), "#fff8e8");
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
    "Only landscape: Spin and Turbo move down 4px, replacing the 4px Auto–Spin gap with the existing 8px spacing token. All sizes, other positions, reel geometry and 160px portrait allocation unchanged.",
  matrix,
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
