// Read-only derived rail fit audit. No DOM/browser/layout engine is used.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
const repo = fileURLToPath(new URL("../", import.meta.url)).replace(/\/$/, "");
const require = createRequire(`${repo}/package.json`),
  postcss = require("postcss"),
  ts = require("typescript");
const layoutCode = ts.transpileModule(
  fs.readFileSync(`${repo}/src/components/kilo/layout.ts`, "utf8"),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  },
).outputText;
const { fitGameLayout } = await import(
  `data:text/javascript;base64,${Buffer.from(layoutCode).toString("base64")}`
);
const fonts = JSON.parse(
  execFileSync("python", [
    "-c",
    `from fontTools.ttLib import TTFont
import json,sys
out={}
for weight in (600,700):
 f=TTFont(sys.argv[1]+'/SourceSans3-'+str(weight)+'.woff2');c=f.getBestCmap()
 out[weight]={'em':f['head'].unitsPerEm,'width':{s:f['hmtx'][c[ord(s)]][0] for s in '0123456789,'}}
print(json.dumps(out))`,
    `${repo}/public/kilo-ui-v11/fonts`,
  ]).toString(),
);
let order = 0;
const rules = [];
// base-dock is imported before the legacy declarations in styles.css.
for (const file of ["src/components/kilo/base-dock.css", "src/styles.css"])
  postcss
    .parse(fs.readFileSync(`${repo}/${file}`, "utf8"))
    .walkRules((rule) => {
      if (rule.selector.includes(":")) return;
      const conditions = [];
      let parent = rule.parent;
      while (parent) {
        if (parent.type === "atrule")
          conditions.push([parent.name, parent.params]);
        parent = parent.parent;
      }
      const declarations = [];
      rule.walkDecls((d) => {
        if (
          ["padding", "padding-inline", "padding-block", "gap"].includes(d.prop)
        ) {
          const p = d.value.split(/\s+/);
          const expanded =
            d.prop === "padding"
              ? {
                  "padding-top": p[0],
                  "padding-right": p[1] ?? p[0],
                  "padding-bottom": p[2] ?? p[0],
                  "padding-left": p[3] ?? p[1] ?? p[0],
                }
              : d.prop === "padding-inline"
                ? { "padding-left": p[0], "padding-right": p[1] ?? p[0] }
                : d.prop === "padding-block"
                  ? { "padding-top": p[0], "padding-bottom": p[1] ?? p[0] }
                  : { "row-gap": p[0], "column-gap": p[1] ?? p[0] };
          for (const [prop, value] of Object.entries(expanded))
            declarations.push({ prop, value });
        } else declarations.push({ prop: d.prop, value: d.value });
      });
      for (const selector of rule.selector.split(",")) {
        const s = selector.trim();
        rules.push({
          selector: s,
          parts: s.split(/\s+/),
          specificity:
            (s.match(/\.[\w-]+|\[[^\]]+\]/g)?.length ?? 0) * 10 +
            (s.match(/(?:^|\s)(?:strong|b|div|aside)\b/g)?.length ?? 0),
          conditions,
          declarations,
          order: order++,
        });
      }
    });
const el = (tag, classes = [], attrs = {}) => ({ tag, classes, attrs });
function matches(part, node) {
  if (part === ">") return false;
  const tag = part.match(/^[a-z]+/)?.[0];
  if (tag && tag !== node.tag) return false;
  for (const [, c] of part.matchAll(/\.([\w-]+)/g))
    if (!node.classes.includes(c)) return false;
  for (const [, a, v] of part.matchAll(/\[([\w-]+)(?:="([^"]+)")?\]/g))
    if (!(a in node.attrs) || (v !== undefined && node.attrs[a] !== v))
      return false;
  return true;
}
function cascade(chain, environment) {
  const values = {},
    wins = {};
  for (const rule of rules) {
    if (
      !rule.conditions.every(([name, param]) => {
        if (name === "container" || name === "media") {
          for (const [, minmax, axis, value] of param.matchAll(
            /(min|max)-(width|height):\s*(\d+)px/g,
          )) {
            const n =
              name === "container" ? environment.game : environment[axis];
            if (minmax === "min" ? n < +value : n > +value) return false;
          }
          return (
            !param.includes("prefers-reduced-motion") &&
            !param.includes("hover")
          );
        }
        return false;
      })
    )
      continue;
    let i = chain.length - 1;
    if (!matches(rule.parts.at(-1), chain[i])) continue;
    let okay = true;
    for (let p = rule.parts.length - 2; p >= 0; p--) {
      if (rule.parts[p] === ">") {
        continue;
      }
      while (--i >= 0 && !matches(rule.parts[p], chain[i])) {}
      if (i < 0) {
        okay = false;
        break;
      }
    }
    if (!okay) continue;
    for (const d of rule.declarations) {
      const win = wins[d.prop];
      if (
        !win ||
        rule.specificity > win.specificity ||
        (rule.specificity === win.specificity && rule.order >= win.order)
      ) {
        values[d.prop] = d.value;
        wins[d.prop] = rule;
      }
    }
  }
  return values;
}
const px = (v, fallback = 0) => Number.parseFloat(v ?? fallback);
const textWidth = (text, size, weight, spacing) =>
  ([...text].reduce((sum, c) => sum + fonts[weight].width[c], 0) * size) /
    fonts[weight].em +
  Math.max(0, text.length - 1) * spacing;
function splitTracks(s) {
  const out = [];
  let depth = 0,
    start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    if (s[i] === ")") depth--;
    if (s[i] === " " && !depth) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out.filter(Boolean);
}
function tracksFor(template, width, gap) {
  const tracks = splitTracks(template).map((s) =>
    s.startsWith("minmax")
      ? { min: px(s.slice(7)), flex: true }
      : { min: px(s), flex: false },
  );
  let remain =
      width -
      gap * (tracks.length - 1) -
      tracks.filter((t) => !t.flex).reduce((s, t) => s + t.min, 0),
    free = tracks.filter((t) => t.flex);
  while (free.length) {
    const avg = remain / free.length;
    const pinned = free.filter((t) => t.min > avg);
    if (!pinned.length) {
      free.forEach((t) => (t.size = avg));
      break;
    }
    for (const t of pinned) {
      t.size = t.min;
      remain -= t.min;
    }
    free = free.filter((t) => !pinned.includes(t));
  }
  return tracks.map((t) => t.size ?? t.min);
}
const samples = [],
  failures = [],
  checks = { amount: 0, grid: 0, vertical: 0 };
function check(layout, environment, origin) {
  const railWidth =
      layout.mode === "landscape"
        ? 172
        : layout.reelWidth -
          (layout.mode === "portrait" ? 64 : layout.artLeft ? 0 : 84),
    dock = railWidth >= 860 ? "inline" : "compact";
  const chain = [
    el("main", ["kk-app"]),
    el("div", ["kk-shell"], {
      "data-layout": layout.mode,
      "data-framing": layout.artLeft ? "sides" : "header",
    }),
    el("aside", ["kk-console"], { "data-dock-layout": dock }),
  ];
  environment = { ...environment, game: layout.width };
  const css = cascade(chain, environment);
  const content =
    railWidth - px(css["padding-left"]) - px(css["padding-right"]) - 2;
  const columns = tracksFor(
    css["grid-template-columns"],
    content,
    px(css["column-gap"]),
  );
  const gridWidth =
    columns.reduce((a, b) => a + b, 0) +
    (columns.length - 1) * px(css["column-gap"]);
  checks.grid++;
  if (gridWidth > content + 0.01)
    failures.push({
      kind: "grid",
      origin,
      mode: layout.mode,
      railWidth,
      content,
      gridWidth,
    });
  for (const kind of ["balance", "win"])
    for (const text of [
      "0",
      "99,750",
      "500,000",
      "5,000,000",
      "50,000,000",
      "500,000,000",
      "1,234,567,890",
    ]) {
      const attrs = {
        ...(text.length >= 10 ? { "data-long-amount": "true" } : {}),
        ...(text.length >= 13 ? { "data-extra-long-amount": "true" } : {}),
      };
      const read = el(
          "div",
          ["kk-read", kind === "balance" ? "kk-balance" : "kk-last-win"],
          attrs,
        ),
        node = [...chain, read],
        readCSS = cascade(node, environment),
        fontCSS = cascade([...node, el("strong")], environment);
      const size = px(fontCSS["font-size"]),
        weight = px(fontCSS["font-weight"], 600),
        spacing = px(fontCSS["letter-spacing"]);
      let available;
      if (layout.mode === "portrait" && layout.width < 560)
        available = content / 2 - 3 - 4;
      else if (layout.mode === "landscape") available = content;
      else
        available =
          columns[kind === "balance" ? 1 : 2] -
          px(readCSS["padding-left"]) -
          px(readCSS["padding-right"]) -
          (layout.mode === "wide" && dock === "inline" ? 1 : 0);
      const actual = textWidth(text, size, weight, spacing);
      checks.amount++;
      if (actual > available + 0.01)
        failures.push({
          kind: "amount",
          origin,
          mode: layout.mode,
          game: layout.width,
          railWidth,
          field: kind,
          text,
          size,
          weight,
          actual: +actual.toFixed(3),
          available: +available.toFixed(3),
        });
      const labelCSS = cascade(
        [...node, el("span", ["kk-eyebrow"])],
        environment,
      );
      const requiredHeight =
        px(labelCSS["line-height"]) + size + px(readCSS["row-gap"]);
      const availableHeight =
        layout.mode === "landscape"
          ? 36
          : layout.mode === "portrait"
            ? 38
            : px(readCSS.height);
      checks.vertical++;
      if (requiredHeight > availableHeight + 0.01)
        failures.push({
          kind: "height",
          origin,
          mode: layout.mode,
          field: kind,
          text,
          requiredHeight,
          availableHeight,
        });
    }
  samples.push({
    origin,
    mode: layout.mode,
    game: layout.width,
    railWidth,
    dock,
  });
}
// Every possible portrait reel width, and every desktop rail width where that
// configuration is used, including values between common device presets.
for (let width = 280; width <= 680; width++)
  check(
    { ...fitGameLayout(width, 1600), width },
    { width, height: 1600 },
    `portrait-width-${width}`,
  );
for (let width = 578; width <= 1040; width++)
  check(
    { mode: "wide", width: width + 400, reelWidth: width, artLeft: 200 },
    { width: width + 400, height: 900 },
    `desktop-rail-${width}`,
  );
// Actual layout output across viewport sizes, review toolbar and safe insets.
for (const width of [
  280, 300, 320, 360, 375, 390, 414, 540, 620, 768, 844, 900, 1024, 1180, 1280,
  1440, 1700, 1920,
])
  for (const height of [320, 390, 568, 650, 660, 700, 844, 900, 1080])
    for (const inset of [0, 44]) {
      const availableW = Math.max(280, width - (width <= 700 ? 24 : 32)),
        availableH = Math.max(200, height - inset - (width <= 700 ? 32 : 40));
      const layout = fitGameLayout(availableW, availableH);
      check(
        layout,
        { width, height },
        `viewport-${width}x${height}-toolbar${inset}`,
      );
    }
const grouped = {};
for (const failure of failures) {
  const key = [failure.mode, failure.kind, failure.field, failure.text]
    .filter(Boolean)
    .join(" / ");
  grouped[key] = (grouped[key] ?? 0) + 1;
}
const report = {
  scope:
    "Derived real-font and CSS cascade checks. Not a browser rendering test.",
  checks,
  configurations: samples.length,
  failures,
  failureCount: failures.length,
  grouped,
};
fs.writeFileSync(
  new URL(
    "../public/kilo-composition-v17/rail-fit-report.json",
    import.meta.url,
  ),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({ ...report, failures: report.failures.slice(0, 4) }, null, 2),
);

if (failures.length) process.exitCode = 1;
