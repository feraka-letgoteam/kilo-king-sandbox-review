/** Actual-size, code-native composition proofs. These are not browser screenshots.
 * Run: node scripts/render-composition-proofs.mjs
 * Requires TypeScript, Python/fontTools and Sharp (runtime bundle or local).
 * SVG uses existing artwork by relative reference; PNG is self-contained.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "public/kilo-composition-v17");
const read = (p) => fs.readFile(path.join(root, p), "utf8");
const fromTs = async (p) =>
  import(
    "data:text/javascript;base64," +
      Buffer.from(
        ts.transpile(await read(p), {
          target: ts.ScriptTarget.ESNext,
          module: ts.ModuleKind.ESNext,
        }),
      ).toString("base64")
  );
const { fitGameLayout } = await fromTs("src/components/kilo/layout.ts");
const { ART, SYMBOL_ALPHA } = await fromTs("src/components/kilo/art-map.ts");
const { fishTier, PACKAGE_META, V8_META, SCATTER_KING } = await fromTs(
  "src/components/kilo/fish-art.ts",
);
const { featuresForGroup } = await fromTs(
  "src/components/kilo/feature-catalog.ts",
);
const stageSource = await read("src/components/kilo/pixiStage.ts");
const geometrySource = stageSource.slice(
  stageSource.indexOf("function edgeFor("),
  stageSource.indexOf("function geomFor("),
);
const fitReels = new Function(
  ts.transpile(geometrySource, { target: ts.ScriptTarget.ESNext }) +
    "; return fitReels;",
)();
const boardSource = stageSource.match(
  /let board: SplashCell\[\]\[\] = (\[[\s\S]*?\n  \]);/,
)[1];
const board = new Function("return " + boardSource)();
// Fail visibly if the manually mirrored symbol policy changes in the renderer.
for (const policy of [
  /\?\s*0\.66\s*:\s*0\.78/,
  /boxW:\s*0\.9/,
  /boxH:\s*0\.9/,
  /const vx0 = 10;/,
  /const vy0 = 46;/,
  /const vx1 = 424;/,
  /const vy1 = 392;/,
]) {
  if (!policy.test(stageSource))
    throw new Error(
      `Symbol placement changed: update proof renderer (${policy}).`,
    );
}
let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  const runtimeRequire = createRequire(
    path.join(
      process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ||
        "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules",
      "package.json",
    ),
  );
  sharp = runtimeRequire("sharp");
}

// Keep typography deterministic: glyph outlines are read from the shipped fonts.
const fonts = JSON.parse(
  execFileSync(
    "python",
    [
      "-c",
      String.raw`
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
import json,sys
out={}
for key,file in [('s400','SourceSans3-400.woff2'),('s600','SourceSans3-600.woff2'),('s700','SourceSans3-700.woff2'),('b600','BarlowCondensed-600.woff2')]:
 f=TTFont(sys.argv[1]+'/'+file);gs=f.getGlyphSet();cm=f.getBestCmap();g={}
 for ch in ''.join(chr(i) for i in range(32,127))+'×·':
  name=cm.get(ord(ch),'space');pen=SVGPathPen(gs);gs[name].draw(pen);g[ch]={'d':pen.getCommands(),'advance':f['hmtx'][name][0]}
 out[key]={'units':f['head'].unitsPerEm,'glyphs':g}
print(json.dumps(out))
`,
      path.join(root, "public/kilo-ui-v11/fonts"),
    ],
    { maxBuffer: 5_000_000 },
  ).toString(),
);
const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
const n = (v) => Number(v.toFixed(4));
const assets = new Set();
const image = (asset, x, y, w, h, extra = "") => {
  assets.add(asset);
  return `<image href="../${asset}" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" ${extra}/>`;
};
const rect = (x, y, w, h, fill, extra = "") =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}" ${extra}/>`;
function text(
  s,
  x,
  y,
  size = 12,
  fill = "#f2efdf",
  font = "s600",
  anchor = "start",
  spacing = 0,
) {
  const f = fonts[font],
    scale = size / f.units;
  const width =
    [...s].reduce((sum, c) => sum + f.glyphs[c].advance * scale + spacing, 0) -
    spacing;
  let cursor = anchor === "middle" ? -width / 2 : anchor === "end" ? -width : 0;
  let out = `<g aria-label="${esc(s)}" fill="${fill}" transform="translate(${n(x)} ${n(y)})">`;
  for (const c of s) {
    const glyph = f.glyphs[c];
    out += `<path d="${glyph.d}" transform="translate(${n(cursor)} 0) scale(${scale} ${-scale})"/>`;
    cursor += glyph.advance * scale + spacing;
  }
  return out + "</g>";
}
const line = (x1, y1, x2, y2, stroke, width = 1, opacity = 1) =>
  `<path d="M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}" stroke="${stroke}" stroke-width="${width}" opacity="${opacity}"/>`;
const svgIcon = (name, x, y, size, color = "#e2c98c") => {
  const paths = {
    menu: "M4 6h16M4 12h16M4 18h16",
    crown: "m2 8 5 3 5-7 5 7 5-3-3 12H5L2 8ZM5 22h14",
    rotate: "M3 11a9 9 0 1 1 2.7 6.4M3 3v8h8",
    minus: "M5 12h14",
    plus: "M5 12h14M12 5v14",
    down: "m6 9 6 6 6-6",
    close: "M6 6l12 12M6 18 18 6",
    next: "m9 6 6 6-6 6",
    previous: "m15 6-6 6 6 6",
  };
  return `<svg x="${n(x)}" y="${n(y)}" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${paths[name]}" fill="none" stroke="${color}" stroke-width="${name === "rotate" ? 2.4 : 1.8}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
};
const defs = `<defs>
 <linearGradient id="backdropShade" x2="0" y2="1"><stop stop-color="#030d1b" stop-opacity=".149"/><stop offset=".32" stop-color="#030d1b" stop-opacity="0"/><stop offset=".7" stop-color="#030d1b" stop-opacity=".141"/><stop offset="1" stop-color="#020911" stop-opacity=".502"/></linearGradient>
 <radialGradient id="edgeShade" cx=".5" cy=".48"><stop offset=".38" stop-color="#030b18" stop-opacity="0"/><stop offset="1" stop-color="#030b18" stop-opacity=".239"/></radialGradient>
 <radialGradient id="brandShade"><stop offset=".25" stop-color="#031321" stop-opacity=".95"/><stop offset=".54" stop-color="#031321" stop-opacity=".72"/><stop offset=".74" stop-color="#031321" stop-opacity="0"/></radialGradient>
 <linearGradient id="pierShade"><stop stop-color="#020b15" stop-opacity=".44"/><stop offset=".34" stop-color="#06121d" stop-opacity=".14"/><stop offset="1" stop-color="#020b15" stop-opacity=".30"/></linearGradient>
 <linearGradient id="dock" x2="0" y2="1"><stop stop-color="#263b43"/><stop offset=".25" stop-color="#142830"/><stop offset="1" stop-color="#08151d"/></linearGradient>
 <linearGradient id="button" x2="0" y2="1"><stop stop-color="#2d434a"/><stop offset=".7" stop-color="#172b34"/><stop offset="1" stop-color="#11232c"/></linearGradient>
 <linearGradient id="feature" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#eed7a0"/><stop offset=".48" stop-color="#d1b274"/><stop offset="1" stop-color="#bd9655"/></linearGradient>
 <linearGradient id="bet" x2="0" y2="1"><stop stop-color="#071821"/><stop offset="1" stop-color="#122a34"/></linearGradient>
 <linearGradient id="spin" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#f0d99d"/><stop offset=".33" stop-color="#b59a62"/><stop offset=".7" stop-color="#7d6744"/><stop offset="1" stop-color="#c1a571"/></linearGradient>
 <linearGradient id="enamel" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#31484b"/><stop offset=".55" stop-color="#172f36"/><stop offset="1" stop-color="#0b202a"/></linearGradient>
 <linearGradient id="fade"><stop stop-color="white" offset=".88"/><stop stop-color="black" offset="1"/></linearGradient>
 <linearGradient id="portraitFade" gradientUnits="userSpaceOnUse" x1="160" x2="160" y1="110" y2="1280"><stop offset=".88" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient>
 <mask id="portraitMask" maskUnits="userSpaceOnUse" x="160" y="110" width="1140" height="1170"><rect x="160" y="110" width="1140" height="1170" fill="url(#portraitFade)"/></mask>
 <filter id="grade"><feColorMatrix type="saturate" values=".68"/><feComponentTransfer><feFuncR type="linear" slope=".8"/><feFuncG type="linear" slope=".8"/><feFuncB type="linear" slope=".8"/></feComponentTransfer></filter>
 <filter id="characterGrade"><feColorMatrix type="saturate" values=".9"/></filter>
 <filter id="wellTint"><feComponentTransfer><feFuncR type="linear" slope=".392157"/><feFuncG type="linear" slope=".545098"/><feFuncB type="linear" slope=".568627"/></feComponentTransfer></filter>
 <filter id="shadow" x="-.2" y="-.2" width="1.4" height="1.5"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000000" flood-opacity=".65"/></filter>
 <filter id="backdropBlur"><feGaussianBlur stdDeviation="3"/></filter>
 <linearGradient id="featureHeroShade" x2="0" y2="1"><stop stop-color="#020a13" stop-opacity=".85"/><stop offset=".3" stop-color="#020a13" stop-opacity=".2"/><stop offset=".66" stop-color="#0d2029" stop-opacity="0"/><stop offset="1" stop-color="#0d2029"/></linearGradient>
 <linearGradient id="purchaseButton" x2="0" y2="1"><stop stop-color="#f0d79b"/><stop offset="1" stop-color="#c7a361"/></linearGradient>
 </defs>`;

function fitted(asset, meta, size, boxW, boxH, cx = 0.5, cy = 0.5) {
  const [x0, y0, x1, y1] = meta.bounds;
  const fit = Math.min((size * boxW) / (x1 - x0), (size * boxH) / (y1 - y0));
  return image(
    asset,
    size * cx - ((x0 + x1) / 2) * fit,
    size * cy - ((y0 + y1) / 2) * fit,
    meta.width * fit,
    meta.height * fit,
  );
}
function symbol(cell, size) {
  let out = "";
  if (cell.s === "brick") {
    const tier = fishTier(cell.v);
    out += fitted(
      "kilo-contraband-v1/" + PACKAGE_META[tier.asset].file,
      PACKAGE_META[tier.asset],
      size,
      tier.width,
      tier.height,
      0.5,
      tier.centerY,
    );
    out += image(
      "kilo-motion-v7/value-plaque.svg",
      size * 0.045,
      size * 0.76,
      size * 0.91,
      size * 0.2,
      'preserveAspectRatio="none"',
    );
    out += text(
      (1000 * cell.v).toLocaleString("en-US"),
      size * 0.5,
      size * 0.86 + Math.floor(size * 0.16) * 0.31,
      Math.max(8, Math.floor(size * 0.16)),
      "#f5ead1",
      "s700",
      "middle",
    );
  } else if (cell.s === "bars")
    out += fitted(
      "kilo-contraband-v1/" + SCATTER_KING.file,
      SCATTER_KING,
      size,
      0.82,
      0.82,
    );
  else if (cell.s === "lamp" || cell.s === "duffel") {
    const meta = V8_META[cell.s === "lamp" ? "sym-reel-v8" : "sym-case-v8"];
    out += fitted("kilo-symbols-v8/" + meta.file, meta, size, 0.9, 0.9);
  } else if (cell.s === "splash") {
    const fit = Math.min((size * 0.98) / 414, (size * 0.8) / 346);
    out += `<svg x="${n(size * 0.5 - 217 * fit)}" y="${n(size * 0.425 - 219 * fit)}" width="${n(444 * fit)}" height="${n(444 * fit)}" viewBox="0 0 444 444">${image("kilo-motion-v7/collector-reaction-atlas.png", 0, 0, 1774, 887)}</svg>`;
    const tagW = size * 0.36,
      tagH = Math.max(12, size * 0.07),
      tagY = size * 0.7;
    out += rect(
      (size - tagW) / 2,
      tagY,
      tagW,
      tagH,
      "#10262c",
      `rx="${tagH / 2}" stroke="#e7c56a" stroke-width="${Math.max(1, size * 0.008)}"`,
    );
    out += text(
      "WILD",
      size * 0.5,
      tagY + tagH / 2 + Math.max(9, size * 0.046) * 0.32,
      Math.max(9, size * 0.046),
      "#ffe7b0",
      "s700",
      "middle",
    );
  } else {
    const b = SYMBOL_ALPHA[cell.s];
    const target = ["10", "J", "Q", "K", "A"].includes(cell.s) ? 0.66 : 0.78;
    const scale = (size * target) / Math.max(b[2] - b[0], b[3] - b[1]);
    out += image(
      "kilo-night-v3/" + ART[cell.s],
      size / 2 - ((b[0] + b[2]) / 2) * scale,
      size / 2 - ((b[1] + b[3]) / 2) * scale,
      1024 * scale,
      1024 * scale,
    );
  }
  return out;
}
function cabinet(g) {
  const { cab, cell, gap, gx, gy } = g,
    edge = gx - cab.x,
    gridW = cell * 5 + gap * 4,
    gridH = cell * 3,
    { x, y, w, h } = cab,
    right = x + w,
    bottom = y + h;
  let out = rect(
    x + 1,
    y + 1,
    w - 2,
    h - 2,
    "#08151d",
    'rx="5" stroke="#020a10" stroke-width="2"',
  );
  out += rect(gx - 2, gy - 2, gridW + 4, gridH + 4, "#030c12");
  out +=
    rect(x + 2, y + 2, w - 4, edge - 3, "#263b43") +
    rect(x + 2, y + edge - 1, edge - 3, h - edge * 2 + 2, "#142830") +
    rect(
      right - edge + 1,
      y + edge - 1,
      edge - 3,
      h - edge * 2 + 2,
      "#142830",
    ) +
    rect(x + 2, bottom - edge + 1, w - 4, edge - 3, "#101f27");
  out +=
    line(x + 6, y + 2.5, right - 6, y + 2.5, "#78939a", 1, 0.45) +
    line(x + 2.5, y + 6, x + 2.5, bottom - 6, "#506a71", 1, 0.4) +
    line(right - 2.5, y + 6, right - 2.5, bottom - 6, "#030a0f") +
    line(x + 6, bottom - 2.5, right - 6, bottom - 2.5, "#030a0f");
  out +=
    rect(
      gx - 1.5,
      gy - 1.5,
      gridW + 3,
      gridH + 3,
      "none",
      'stroke="#02090e" stroke-width="3"',
    ) +
    line(gx - 1.5, gy + gridH + 1.5, gx - 1.5, gy - 1.5, "#b69a62", 1, 0.78) +
    line(gx - 1.5, gy - 1.5, gx + gridW + 1.5, gy - 1.5, "#b69a62", 1, 0.78) +
    line(
      gx + gridW + 1.5,
      gy - 1.5,
      gx + gridW + 1.5,
      gy + gridH + 1.5,
      "#b69a62",
      1,
      0.3,
    ) +
    line(
      gx - 1.5,
      gy + gridH + 1.5,
      gx + gridW + 1.5,
      gy + gridH + 1.5,
      "#b69a62",
      1,
      0.3,
    );
  const cap = Math.max(6, edge - 3),
    screw = Math.max(1.15, Math.min(1.8, edge * 0.1));
  for (const [cx, cy] of [
    [x + 1.5, y + 1.5],
    [right - cap - 1.5, y + 1.5],
    [x + 1.5, bottom - cap - 1.5],
    [right - cap - 1.5, bottom - cap - 1.5],
  ]) {
    out += rect(cx, cy, cap, cap, "#34464a", 'rx="1.5" stroke="#060f15"');
    out += line(cx + 1.5, cy + 1, cx + cap - 1.5, cy + 1, "#e2c98c", 1, 0.5);
    out += `<circle cx="${cx + cap / 2}" cy="${cy + cap / 2}" r="${screw + 0.7}" fill="#081219"/><circle cx="${cx + cap / 2}" cy="${cy + cap / 2 - 0.2}" r="${screw}" fill="#b69a62" opacity=".8"/>`;
    out += line(
      cx + cap / 2 - screw * 0.6,
      cy + cap / 2 + screw * 0.45,
      cx + cap / 2 + screw * 0.6,
      cy + cap / 2 - screw * 0.45,
      "#142128",
      0.8,
    );
  }
  // Grain and recess shading use the same source texture and alpha budgets.
  const tile = 1024 * Math.max(1.2, cell / 110);
  out += `<defs><pattern id="well" patternUnits="userSpaceOnUse" width="${tile}" height="${tile}">${image("kilo-night-v3/reel-well.png", 0, 0, tile, tile, 'filter="url(#wellTint)"')}</pattern></defs>`;
  out +=
    rect(gx, gy, gridW, gridH, "url(#well)") +
    rect(gx, gy, gridW, gridH, "#08151d", 'opacity=".76"');
  for (let col = 0; col < 5; col++) {
    const xx = gx + col * (cell + gap);
    out += rect(xx, gy, cell, gridH, "#24474d", 'opacity=".12"');
    for (let step = 0; step < 12; step++) {
      const f = (1 - (step + 0.5) / 12) ** 2,
        sd = Math.min(24, cell * 0.12),
        ed = Math.min(48, cell * 0.24),
        sx = (sd * step) / 12,
        sw = sd / 12,
        sy = (ed * step) / 12,
        sh = ed / 12;
      out +=
        rect(xx + sx, gy, sw, gridH, "#020b11", `opacity="${0.38 * f}"`) +
        rect(
          xx + cell - sx - sw,
          gy,
          sw,
          gridH,
          "#020b11",
          `opacity="${0.38 * f}"`,
        ) +
        rect(xx, gy + sy, cell, sh, "#01070c", `opacity="${0.66 * f}"`) +
        rect(
          xx,
          gy + gridH - sy - sh,
          cell,
          sh,
          "#01070c",
          `opacity="${0.42 * f}"`,
        );
    }
    if (col < 4)
      out +=
        rect(xx + cell, gy, gap, gridH, "#040e15", 'opacity=".78"') +
        line(
          xx + cell + gap / 2 + 0.5,
          gy,
          xx + cell + gap / 2 + 0.5,
          gy + gridH,
          "#6d8d91",
          1,
          0.16,
        );
    for (let row = 0; row < 3; row++)
      out += `<g transform="translate(${xx} ${gy + row * cell})">${symbol(board[col][row], cell)}</g>`;
  }
  return out;
}
function dock(x, y, width, phone) {
  const featureBox = phone ? [x, y + 56, 56, 74] : [x - 84, y + 19, 72, 82];
  if (phone) {
    x += 64;
    width -= 64;
  }
  let out =
    `<g transform="translate(${n(x)} ${n(y)})">` +
    rect(
      0,
      0,
      width,
      phone ? 144 : 120,
      "url(#dock)",
      'rx="8" stroke="#b69a62" stroke-opacity=".35"',
    );
  out +=
    line(8, 0.5, width - 8, 0.5, "#e2c98c", 1, 0.6) +
    line(8, phone ? 141 : 117, width - 8, phone ? 141 : 117, "#020a0f", 3, 0.6);
  const button = (xx, yy, ww, hh) =>
    rect(
      xx,
      yy,
      ww,
      hh,
      "url(#button)",
      'rx="5" stroke="#b69a62" stroke-opacity=".35"',
    );
  const label = (s, xx, yy, col = "#a5b6bc", anchor = "start") =>
    text(s, xx, yy, phone ? 11 : 13, col, "b600", anchor, 0.9);
  let menu, bet, spin;
  if (phone) {
    menu = [7, 71];
    bet = [55, 65, 156, 56];
    spin = [217, 49, 76];
    out +=
      label("BALANCE", 9, 17) +
      text("LGC", 63, 17, 9, "#8499a2", "s400") +
      text("500,000", 9, 40, 24);
    out +=
      label("WIN", width - 42, 17, "#e2c98c", "end") +
      text("LGC", width - 9, 17, 9, "#8499a2", "s400", "end") +
      text("0", width - 9, 41, 26, "#f5dfaa", "s700", "end");
    out += line(12, 45, width - 12, 45, "#b69a62", 1, 0.25);
  } else {
    menu = [15, 38];
    bet = [541, 28, 124, 64];
    spin = [725, 3, 100];
    out +=
      line(71, 28, 71, 92, "#d4c99d", 1, 0.14) +
      label("BALANCE", 150, 49, "#b8c8cd") +
      text("LGC", 211, 49, 9, "#8499a2", "s400") +
      text("500,000", 183, 83, 28, "#f2efdf", "s600", "middle");
    out +=
      line(306, 28, 306, 92, "#d4b66a", 1, 0.2) +
      label("WIN", 396, 47, "#b8c8cd") +
      text("LGC", 425, 47, 9, "#8499a2", "s400") +
      text("0", 418, 84, 32, "#f5dfaa", "s700", "middle");
    for (const [xx, kind] of [
      [677, "minus"],
      [829, "plus"],
    ])
      out +=
        button(xx, 31, 44, 44) + svgIcon(kind, xx + 12.5, 43.5, 19, "#c6d0cf");
  }
  out +=
    button(menu[0], menu[1], 44, 44) +
    svgIcon("menu", menu[0] + 10.5, menu[1] + 10.5, 23, "#c6d0cf");
  out +=
    rect(...bet, "url(#bet)", 'rx="5" stroke="#b69a62" stroke-opacity=".29"') +
    label(
      "BET",
      bet[0] + (phone ? bet[2] / 2 : 11),
      bet[1] + 17,
      "#a5b6bc",
      phone ? "middle" : "start",
    ) +
    text(
      "1,000",
      bet[0] + bet[2] / 2 - 5,
      bet[1] + 43,
      phone ? 22 : 26,
      "#f2efdf",
      "s600",
      "middle",
      -0.25,
    ) +
    svgIcon("down", bet[0] + bet[2] / 2 + 26, bet[1] + 29, 14, "#b69a62");
  const [sx, sy, ss] = spin,
    cx = sx + ss / 2,
    cy = sy + ss / 2;
  out += `<circle cx="${cx}" cy="${cy}" r="${ss / 2 - 0.5}" fill="url(#spin)" stroke="#efd9a0"/><circle cx="${cx}" cy="${cy}" r="${ss / 2 - 6}" fill="url(#enamel)" stroke="#eed399" stroke-opacity=".5"/>`;
  const icon = phone ? 27 : 36;
  out +=
    svgIcon(
      "rotate",
      cx - icon / 2,
      cy - (phone ? 22 : 28.5),
      icon,
      "#f0d69a",
    ) +
    text(
      "SPIN",
      cx,
      cy + (phone ? 23 : 27),
      phone ? 14 : 18,
      "#f1dfa9",
      "b600",
      "middle",
      1.1,
    ) +
    text(
      "Cost 1,000",
      cx,
      phone ? 135 : 115,
      phone ? 10 : 11,
      "#a5b6bc",
      "s600",
      "middle",
    );
  out += "</g>";
  const [fx, fy, fw, fh] = featureBox;
  out +=
    rect(fx, fy, fw, fh, "url(#feature)", 'rx="7" stroke="#f7e2ac"') +
    rect(
      fx + 3,
      fy + 3,
      fw - 6,
      fh - 6,
      "none",
      'rx="4" stroke="#7d633a" stroke-width="1"',
    ) +
    line(fx + 7, fy + 4, fx + fw - 7, fy + 4, "#f2dc9e", 1, 0.14) +
    svgIcon(
      "crown",
      fx + fw / 2 - 11.5,
      fy + (phone ? 15 : 17),
      23,
      "#132c35",
    ) +
    text(
      "Features",
      fx + fw / 2,
      fy + (phone ? 55 : 62),
      phone ? 13 : 15,
      "#132c35",
      "b600",
      "middle",
      0.6,
    );
  return out;
}

function featuresPanel(W, H) {
  const phone = W < 620;
  const width = phone ? W - 24 : 920;
  const header = 60;
  const paddingX = phone ? 12 : 20;
  const paddingTop = 12;
  const paddingBottom = phone ? 12 : 14;
  const gutter = phone ? 0 : 8;
  const contentW = width - 2 - paddingX * 2 - gutter;
  const tabsH = phone ? 50 : 52;
  const tabsMargin = phone ? 12 : 14;
  const heroH = phone ? 190 : 200;
  const cardH = heroH + 40 + 52 + 24 + 46 + (phone ? 12 : 14) + 2;
  const cardsY = header + paddingTop + tabsH + tabsMargin;
  const pagerH = phone ? 52 : 0;
  const anteY = cardsY + cardH + pagerH + (phone ? 10 : 14);
  const anteH = 58;
  const toolbarY = phone ? anteY + anteH + 12 : anteY + 6;
  const toolbarH = 46;
  const noteY = phone ? toolbarY + toolbarH + 10 : anteY + anteH + 10;
  const height = 2 + noteY + 16 + paddingBottom;
  const x = (W - width) / 2,
    y = (H - height) / 2;
  const contentX = 1 + paddingX;
  const art = featuresForGroup("buy");
  const cards = phone ? art.slice(0, 1) : art;
  const cardW = phone ? contentW : (contentW - 16) / 2;
  let body = rect(0, 0, W, H, "#020b13", 'opacity=".66"');
  body += `<g transform="translate(${n(x)} ${n(y)})">`;
  body += rect(
    0,
    0,
    width,
    height,
    "#08151d",
    'rx="12" stroke="#b69a62" stroke-opacity=".44"',
  );
  body += `<defs><clipPath id="featurePanelClip"><rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="11"/></clipPath></defs><g clip-path="url(#featurePanelClip)">`;
  body +=
    rect(1, 1, width - 2, header, "#152830") +
    line(1, header, width - 1, header, "#b69a62", 1, 0.18);
  body += text(
    "FEATURES",
    phone ? 13 : 21,
    (header - 27) / 2 + 24,
    27,
    "#f0dec1",
    "b600",
    "start",
    1,
  );
  const closeX = width - 1 - paddingX - 44;
  body +=
    rect(
      closeX,
      (header - 44) / 2,
      44,
      44,
      "#0b1c24",
      'rx="8" stroke="#b69a62" stroke-opacity=".35"',
    ) +
    svgIcon("close", closeX + 11.5, (header - 44) / 2 + 11.5, 21, "#c1d1c9");
  const tabY = header + paddingTop;
  body += rect(
    contentX,
    tabY,
    contentW,
    tabsH,
    "#041017",
    'rx="7" stroke="#9eacaa" stroke-opacity=".16"',
  );
  const tabPad = phone ? 3 : 4,
    tabGap = phone ? 2 : 4;
  const tabW = (contentW - tabPad * 2 - tabGap * 2) / 3;
  for (const [i, title] of [
    "Buy features",
    "Scatter bonuses",
    "In development",
  ].entries()) {
    const tx = contentX + tabPad + i * (tabW + tabGap);
    if (!i)
      body += rect(
        tx,
        tabY + tabPad,
        tabW,
        44,
        "#243a42",
        'rx="4" stroke="#d7bd7c" stroke-opacity=".41"',
      );
    body += text(
      title,
      tx + tabW / 2,
      tabY + tabPad + 28,
      phone ? 15 : 17,
      i === 0 ? "#f1dcac" : "#a5b6bc",
      "b600",
      "middle",
      0.25,
    );
  }
  const cardBoxes = [];
  for (const [i, feature] of cards.entries()) {
    const cx = contentX + i * (cardW + 16),
      cy = cardsY;
    const accent = feature.id === "chopper" ? "#8edff2" : "#74dfc2";
    cardBoxes.push({
      id: feature.id,
      x: x + cx,
      y: y + cy,
      width: cardW,
      height: cardH,
      art: { x: x + cx + 1, y: y + cy + 1, width: cardW - 2, height: heroH },
    });
    body += rect(
      cx,
      cy,
      cardW,
      cardH,
      "#0d2029",
      `rx="8" stroke="${accent}" stroke-opacity=".42"`,
    );
    body += `<defs><clipPath id="featureCard-${i}"><rect x="${cx + 1}" y="${cy + 1}" width="${cardW - 2}" height="${cardH - 2}" rx="7"/></clipPath></defs><g clip-path="url(#featureCard-${i})">`;
    const imageW = cardW - 2,
      imageH = heroH,
      sourceRatio = 1.5;
    const scaledH = imageW / sourceRatio,
      overflowY = Math.max(0, scaledH - imageH);
    body += `<svg x="${cx + 1}" y="${cy + 1}" width="${imageW}" height="${imageH}" overflow="hidden">${image(feature.art.slice(1), 0, -overflowY * 0.52, imageW, Math.max(imageH, scaledH), 'preserveAspectRatio="xMidYMid slice"')}</svg>`;
    body += rect(cx + 1, cy + 1, imageW, imageH, "url(#featureHeroShade)");
    const inset = phone ? 14 : 16;
    body += text(
      "BONUS BUY",
      cx + 1 + inset,
      cy + 1 + (phone ? 14 : 15) + 10,
      10,
      accent,
      "s600",
      "start",
      1.1,
    );
    body += text(
      feature.title.toUpperCase(),
      cx + 1 + inset,
      cy + 1 + (phone ? 14 : 15) + 16 + (phone ? 30 : 32),
      phone ? 30 : 32,
      "#fff1d4",
      "b600",
      "start",
      0.5,
    );
    const copyX = cx + 1 + inset,
      copyW = cardW - 2 - inset * 2,
      rewardY = cy + 1 + heroH;
    body +=
      text(String(feature.spins), copyX, rewardY + 28, 30, "#f4e9cd", "s600") +
      text("free spins", copyX + 37, rewardY + 28, 13, "#f4e9cd", "s600");
    body += text(
      `Starts at ×${feature.multiplier}`,
      copyX + copyW,
      rewardY + 28,
      13,
      "#bac8ca",
      "s400",
      "end",
    );
    const offerY = rewardY + 40,
      cost = (1000 * feature.multiple).toLocaleString("en-US");
    body +=
      text(cost, copyX, offerY + 27, 28, "#ffe7b4", "s700") +
      text(
        "LGC",
        copyX + (cost.length === 7 ? 111 : 96),
        offerY + 27,
        11,
        "#b4c2ca",
        "s400",
      );
    body += text(
      `${feature.multiple}× base bet`,
      copyX,
      offerY + 46,
      12,
      "#a5b6bc",
      "s400",
    );
    const actionY = offerY + 52 + 24;
    body +=
      rect(
        copyX,
        actionY,
        copyW,
        46,
        "url(#purchaseButton)",
        'rx="4" stroke="#ecd294"',
      ) +
      text(
        "BUY FEATURE",
        copyX + copyW / 2 - 10,
        actionY + 30,
        19,
        "#132329",
        "b600",
        "middle",
        0.7,
      ) +
      svgIcon("next", copyX + copyW / 2 + 53, actionY + 14.5, 17, "#132329");
    body += "</g>";
  }
  if (phone) {
    const py = cardsY + cardH + 8;
    for (const [bx, icon, opacity] of [
      [contentX, "previous", 0.4],
      [contentX + contentW - 44, "next", 1],
    ])
      body += `<g opacity="${opacity}">${rect(bx, py, 44, 44, "#04151c", 'rx="8" stroke="#aec5bc" stroke-opacity=".16"')}${svgIcon(icon, bx + 12, py + 12, 20, "#c1d1c9")}</g>`;
    body +=
      `<circle cx="${contentX + contentW / 2 - 25}" cy="${py + 22}" r="3" fill="#d8bf83"/><circle cx="${contentX + contentW / 2 - 13}" cy="${py + 22}" r="3" fill="#52686d"/>` +
      text(
        "1 / 2",
        contentX + contentW / 2 + 18,
        py + 26,
        12,
        "#a5b6bc",
        "s400",
        "middle",
      );
  }
  const toolbarW = phone ? contentW : 294,
    anteW = phone ? contentW : contentW - toolbarW - 16;
  const toolbarX = phone ? contentX : contentX + anteW + 16;
  body += rect(
    contentX,
    anteY,
    anteW,
    anteH,
    "#11232b",
    'rx="6" stroke="#a5b6bc" stroke-opacity=".16"',
  );
  const antePad = phone ? 8 : 12,
    switchW = phone ? 78 : 94,
    switchX = contentX + anteW - 1 - antePad - switchW;
  body +=
    text(
      "Ante bet",
      contentX + 1 + antePad,
      anteY + 25,
      20,
      "#f3e7cd",
      "b600",
      "start",
      0.2,
    ) +
    text(
      "1.5× base bet · 1,500 LGC / spin",
      contentX + 1 + antePad,
      anteY + 43,
      phone ? 11 : 12,
      "#a5b6bc",
      "s400",
    );
  body +=
    rect(
      switchX,
      anteY + 7,
      switchW,
      44,
      "#1a3038",
      'rx="5" stroke="#b69a62" stroke-opacity=".33"',
    ) +
    rect(
      switchX + 10,
      anteY + 21,
      28,
      16,
      "#070f15",
      'rx="9" stroke="#697a7d"',
    ) +
    `<circle cx="${switchX + 18}" cy="${anteY + 29}" r="5" fill="#afbebc"/>` +
    text(
      "Off",
      switchX + switchW - 12,
      anteY + 34,
      phone ? 14 : 16,
      "#d7dfd9",
      "s600",
      "end",
    );
  body +=
    text(
      "BALANCE",
      toolbarX,
      toolbarY + 12,
      10,
      "#c3d0d6",
      "s400",
      "start",
      0.7,
    ) +
    text(
      "500,000",
      toolbarX,
      toolbarY + 35,
      phone ? 17 : 19,
      "#fff0cb",
      "s700",
    ) +
    text(
      "LGC",
      toolbarX + (phone ? 62 : 69),
      toolbarY + 35,
      10,
      "#c3d0d6",
      "s400",
    );
  const betW = phone ? 154 : 190,
    betX = contentX + contentW - betW;
  body +=
    rect(
      betX,
      toolbarY,
      betW,
      46,
      "#041017",
      'rx="4" stroke="#b6a674" stroke-opacity=".26"',
    ) +
    svgIcon("minus", betX + 13, toolbarY + 14, 18, "#c1d1c9") +
    svgIcon("plus", betX + betW - 31, toolbarY + 14, 18, "#c1d1c9") +
    text(
      "BASE BET",
      betX + betW / 2,
      toolbarY + 13,
      10,
      "#9db1bd",
      "s400",
      "middle",
      0.7,
    ) +
    text(
      "1,000",
      betX + betW / 2 - 7,
      toolbarY + 35,
      phone ? 18 : 20,
      "#fff0cb",
      "s700",
      "middle",
    ) +
    text("LGC", betX + betW / 2 + 18, toolbarY + 35, 10, "#9db1bd", "s400");
  body += text(
    "Purchases require confirmation. Preview cards place no bet.",
    phone ? contentX : width / 2,
    noteY + 12,
    phone ? 10 : 11,
    "#9fb2bf",
    "s400",
    phone ? "start" : "middle",
  );
  body += "</g></g>";
  return {
    body,
    coordinates: {
      name: phone ? "features-phone" : "features-desktop",
      viewport: { width: W, height: H },
      modal: { x, y, width, height },
      scrollbarGutterAssumed: gutter,
      activeTab: "buy",
      cards: cardBoxes,
      ante: { x: x + contentX, y: y + anteY, width: anteW, height: anteH },
      state: { stake: 1000, balance: 500000, ante: false },
      kind: "static code-rendered design proof, not a browser screenshot",
    },
  };
}

async function saveFrame(stem, svg) {
  await fs.writeFile(path.join(output, `${stem}.svg`), svg);
  let embedded = svg;
  for (const asset of assets) {
    let data = await fs.readFile(path.join(root, "public", asset));
    const mime = asset.endsWith(".svg") ? "image/svg+xml" : "image/png";
    if (asset.endsWith(".webp")) data = await sharp(data).png().toBuffer();
    embedded = embedded.replaceAll(
      `../${asset}`,
      `data:${mime};base64,${data.toString("base64")}`,
    );
  }
  await sharp(Buffer.from(embedded), { limitInputPixels: false })
    .png()
    .toFile(path.join(output, `${stem}.png`));
}

await fs.mkdir(output, { recursive: true });
const manifests = [];
for (const [name, W, H] of [
  ["desktop", 1440, 900],
  ["phone", 390, 844],
]) {
  const phone = W < 620,
    pad = phone
      ? { top: 12, right: 12, bottom: 20, left: 12 }
      : { top: 16, right: 16, bottom: 24, left: 16 };
  const availableWidth = W - pad.left - pad.right,
    availableHeight = H - pad.top - pad.bottom;
  const layout = fitGameLayout(availableWidth, availableHeight);
  const shellX = pad.left + (availableWidth - layout.width) / 2,
    shellY = pad.top + (availableHeight - layout.height) / 2;
  const reelX = shellX + layout.artLeft,
    reelY = shellY + layout.header,
    dockY = reelY + layout.reelHeight + layout.dockGap;
  const geom = fitReels(
    Math.max(280, Math.round(layout.reelWidth)),
    Math.max(160, Math.round(layout.reelHeight)),
  );
  let body = rect(0, 0, W, H, "#06111d");
  body += `<g filter="url(#grade)">${image("kilo-scene-v14/marina-night.webp", 0, 0, W, H, 'preserveAspectRatio="xMidYMid slice"')}${rect(0, 0, W, H, "url(#backdropShade)")}${rect(0, 0, W, H, "url(#edgeShade)")}</g>`;
  const pierH = phone ? 190 : Math.max(190, Math.min(280, layout.width * 0.18)),
    pierX = shellX - layout.width * (phone ? 0.1 : 0.05),
    pierY = shellY + layout.height + 24 - pierH,
    pierW = layout.width * (phone ? 1.2 : 1.1);
  body += `<g opacity="${phone ? 0.85 : 1}">${image("kilo-scene-v14/pier-foreground.webp", pierX, pierY, pierW, pierH, 'preserveAspectRatio="none"')}${rect(pierX, pierY, pierW, pierH, "url(#pierShade)")}</g>`;
  let logoBox, characterBox;
  if (phone) {
    const rise = Math.max(
        0,
        Math.min(88, (availableHeight - layout.height) / 2 - 16),
      ),
      brandW = Math.min(350, layout.reelWidth),
      brandH = layout.header + rise - 14,
      bx = reelX + (layout.reelWidth - brandW) / 2,
      by = shellY - rise;
    logoBox = {
      x: bx + brandW * 0.02,
      y: by,
      width: brandW * 0.48,
      height: brandH,
    };
    characterBox = {
      x: bx + brandW * 0.52,
      y: by,
      width: brandW * 0.48,
      height: brandH,
      viewBox: [160, 110, 1140, 1170],
    };
    body += rect(reelX, shellY - 8, layout.reelWidth, 112, "url(#brandShade)");
    body += image(
      "kilo-scene-v15/logo-stacked.webp",
      logoBox.x,
      logoBox.y,
      logoBox.width,
      logoBox.height,
      'preserveAspectRatio="xMidYMid meet"',
    );
    body += `<svg x="${n(characterBox.x)}" y="${n(characterBox.y)}" width="${n(characterBox.width)}" height="${n(characterBox.height)}" viewBox="160 110 1140 1170" preserveAspectRatio="xMidYMax meet" filter="url(#characterGrade)"><g mask="url(#portraitMask)">${image("kilo-night-v3/hero-idle.png", 0, 0, 1536, 2304)}</g></svg>`;
    body += text(
      "PLACE A BET",
      W / 2,
      reelY - 5,
      10,
      "#a5b6bc",
      "s600",
      "middle",
      1.5,
    );
  } else {
    logoBox = {
      x: shellX + layout.artLeft * 0.03,
      y: shellY + layout.header + 4,
      width: layout.artLeft * 0.94,
      height: layout.artLeft * 0.94,
    };
    characterBox = {
      x: reelX + layout.reelWidth,
      y: shellY,
      width: layout.artRight,
      height: layout.header + layout.reelHeight,
      viewBox: [160, 110, 1140, 2056],
    };
    body +=
      rect(
        shellX - layout.artLeft * 0.12,
        shellY + layout.header - 8,
        layout.artLeft * 1.24,
        layout.artLeft * 1.24,
        "url(#brandShade)",
      ) +
      image(
        "kilo-scene-v15/logo-stacked.webp",
        logoBox.x,
        logoBox.y,
        logoBox.width,
        logoBox.height,
      );
    const cargoH = (layout.header + layout.reelHeight) * 0.38;
    body += image(
      "kilo-night-v3/prop-dock-left.png",
      shellX + layout.artLeft * 0.02,
      shellY + layout.header + layout.reelHeight + 8 - cargoH,
      layout.artLeft * 0.88,
      cargoH,
      'preserveAspectRatio="xMidYMax meet"',
    );
    body += `<svg x="${n(characterBox.x)}" y="${n(characterBox.y)}" width="${n(characterBox.width)}" height="${n(characterBox.height)}" viewBox="160 110 1140 2056" preserveAspectRatio="xMidYMax meet" filter="url(#characterGrade)">${image("kilo-night-v3/hero-idle.png", 0, 0, 1536, 2304)}</svg>`;
    body += text(
      "PLACE A BET",
      reelX + layout.reelWidth / 2,
      reelY - 15,
      12,
      "#a5b6bc",
      "s600",
      "middle",
      1.1,
    );
  }
  const postLeft = phone ? 82 : 18;
  const postWidth = layout.reelWidth - postLeft - 18;
  for (const percent of [0.15, 0.78])
    body += rect(
      reelX + postLeft + postWidth * percent,
      reelY + layout.reelHeight - 1,
      postWidth * 0.07,
      layout.dockGap + 2,
      "#13252d",
    );
  body +=
    `<g transform="translate(${n(reelX)} ${n(reelY)})" filter="url(#shadow)">${cabinet(geom)}</g>` +
    dock(reelX, dockY, layout.reelWidth, phone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><title>Kilo King ${name} composition v17 — static design proof, not a browser screenshot</title>${defs}${body}</svg>`;
  await saveFrame(`${name}-${W}x${H}`, svg);
  const coords = {
    name,
    kind: "static design proof, not a browser screenshot",
    viewport: { width: W, height: H },
    stageInsets: pad,
    available: { width: availableWidth, height: availableHeight },
    layout,
    shell: { x: shellX, y: shellY, width: layout.width, height: layout.height },
    reelHost: {
      x: reelX,
      y: reelY,
      width: layout.reelWidth,
      height: layout.reelHeight,
    },
    cabinet: {
      x: reelX + geom.cab.x,
      y: reelY + geom.cab.y,
      width: geom.cab.w,
      height: geom.cab.h,
    },
    reelGeometry: geom,
    controlGroup: {
      x: reelX,
      y: dockY,
      width: layout.reelWidth,
      height: layout.dock,
    },
    dock: {
      x: reelX + (phone ? 64 : 0),
      y: dockY,
      width: layout.reelWidth - (phone ? 64 : 0),
      height: layout.dock,
    },
    featureLauncher: {
      x: reelX - (phone ? 0 : 84),
      y: dockY + (phone ? 56 : 19),
      width: phone ? 56 : 72,
      height: phone ? 74 : 82,
    },
    logoBox,
    characterBox,
    board,
    stake: 1000,
    balance: 500000,
    win: 0,
  };
  manifests.push(coords);
  await fs.writeFile(
    path.join(output, `${name}-coordinates.json`),
    JSON.stringify(coords, null, 2) + "\n",
  );
  const panel = featuresPanel(W, H);
  const featureSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><title>Kilo King ${name} feature panel v17 — static code-rendered design proof, not a browser screenshot</title>${defs}<g filter="url(#backdropBlur)">${body}</g>${panel.body}</svg>`;
  await saveFrame(`features-${name}-${W}x${H}`, featureSvg);
  await fs.writeFile(
    path.join(output, `features-${name}-coordinates.json`),
    JSON.stringify(panel.coordinates, null, 2) + "\n",
  );
  manifests.push(panel.coordinates);
  console.log(
    `${name}: ${W}×${H}, reel cell ${geom.cell}px, cabinet ${geom.cab.w}×${geom.cab.h}, dock ${layout.reelWidth}×${layout.dock}`,
  );
}
const assetManifest = [];
for (const asset of [...assets].sort()) {
  const data = await fs.readFile(path.join(root, "public", asset));
  assetManifest.push({
    path: asset,
    sha256: createHash("sha256").update(data).digest("hex"),
  });
}
await fs.writeFile(
  path.join(output, "manifest.json"),
  JSON.stringify(
    {
      version: 17,
      kind: "static design proof, not a browser screenshot",
      renderer: "Sharp/libvips SVG rasterizer; no browser",
      fontOutlines:
        "Source Sans 3 and Barlow Condensed from shipped WOFF2 fonts",
      geometry:
        "fitGameLayout is imported from source; fitReels and default board are extracted from pixiStage.ts",
      reelGeometrySourceSha256: createHash("sha256")
        .update(geometrySource)
        .digest("hex"),
      symbolGeometry:
        "Existing alpha bounds and cell fit factors; no symbol resizing or artwork edits",
      approximations: [
        "Static idle frame only; does not demonstrate animation, gameplay, interaction or browser text rasterization.",
        "SVG cabinet paint reproduces code primitives; texture tint, CSS box shadows, masks and blend details can differ from browser/Pixi rendering.",
        "Control text baselines are composed from the specified line boxes, not captured from browser layout.",
        "Feature panel is manually composed from current CSS. Desktop assumes an 8px thin scrollbar gutter; font intrinsic widths and browser flex sizing may differ slightly.",
      ],
      screens: manifests,
      assets: assetManifest,
    },
    null,
    2,
  ) + "\n",
);
await fs.writeFile(
  path.join(output, "README.md"),
  `# Kilo King — composition v17\n\nThese are actual-size **static design proofs**, not browser screenshots or interaction QA. The desktop proof is 1440 × 900 px; the phone proof is 390 × 844 px. PNGs are standalone. SVGs reference existing repository artwork using relative paths.\n\nThe generator reads the live layout function, the exact reel fitting function and initial board, plus existing symbol alpha bounds and fit factors. It preserves the 5 × 3 grid and current symbol sizes. Source Sans 3 and Barlow Condensed are converted to vector outlines for deterministic typography. Coordinate JSON files record exact stage, reel, cabinet, title, character and dock boxes.\n\nThe proof depicts a fresh base game: balance 500,000 LGC, bet 1,000 LGC, win 0. Cabinet paint, controls and the environment grade are represented in SVG. Fine material shading, shadows, masks and browser text rasterization may differ from the implementation. This does not verify responsive interactions, animation, runtime performance or keyboard/touch behavior.\n\nRegenerate from the repo root with:\n\n\`\`\`sh\nnode scripts/render-composition-proofs.mjs\n\`\`\`\n\nSee manifest.json for artwork hashes, geometry, typography and limitations.\n`,
);

await fs.writeFile(
  path.join(output, "index.html"),
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kilo King · Composition 17</title>
<style>
*{box-sizing:border-box}html{color-scheme:dark}body{margin:0;background:#0d1117;color:#e7e9ed;font:15px/1.5 system-ui,sans-serif}header{padding:24px clamp(16px,4vw,48px) 18px;border-bottom:1px solid #303640}h1{margin:0 0 6px;font-size:clamp(23px,3vw,32px);letter-spacing:-.04em;font-weight:600}p{margin:0;color:#a8b0bb}.toolbar{display:flex;flex-wrap:wrap;justify-content:space-between;gap:14px;padding:16px clamp(16px,4vw,48px)}.group{display:flex;gap:4px;padding:3px;border:1px solid #303640;border-radius:9px;background:#141a22}button{border:0;border-radius:5px;padding:9px 15px;min-height:44px;background:transparent;color:#bac2cc;font:inherit;cursor:pointer}button[aria-pressed=true]{background:#34424f;color:white}button:focus-visible,a:focus-visible{outline:2px solid #e2c98c;outline-offset:3px}.links{display:flex;align-items:center;gap:18px;flex-wrap:wrap}.links a{color:#c8d7e3;text-underline-offset:4px}.viewport{overflow:auto;margin:0 clamp(12px,3vw,40px);padding:12px;background:#070a0f;border:1px solid #2a313a;border-radius:8px;min-height:320px}.viewport img{display:block;height:auto;margin:auto;box-shadow:0 8px 25px #0006}.viewport[data-scale=fit] img{width:auto;max-width:100%;max-height:calc(100vh - 255px)}.viewport[data-scale=actual] img{max-width:none;max-height:none}.note{padding:14px clamp(16px,4vw,48px) 24px;font-size:13px}.note span{color:#e4d2a6} @media(max-width:560px){header{padding-top:18px}.toolbar{gap:10px}.links{font-size:13px;gap:13px}.viewport[data-scale=fit] img{max-height:none}}
</style>
</head>
<body>
<header><h1>Kilo King · Composition 17</h1><p>Static design frames · 1440×900 and 390×844</p></header>
<div class="toolbar">
 <div class="group" aria-label="Composition"><button id="desktop" type="button" aria-pressed="true">Desktop</button><button id="phone" type="button" aria-pressed="false">Phone</button></div>
 <div class="group" aria-label="Game view"><button id="base" type="button" aria-pressed="true">Base game</button><button id="features" type="button" aria-pressed="false">Features</button></div>
 <div class="group" aria-label="Display size"><button id="fit" type="button" aria-pressed="true">Fit</button><button id="actual" type="button" aria-pressed="false">Actual size</button></div>
 <nav class="links" aria-label="Frame downloads"><a id="png" href="desktop-1440x900.png">PNG</a><a id="svg" href="desktop-1440x900.svg">SVG</a><a id="coords" href="desktop-coordinates.json">Coordinates</a></nav>
</div>
<main class="viewport" data-scale="fit" aria-label="Composition preview"><img id="frame" src="desktop-1440x900.png" width="1440" height="900" alt="Kilo King desktop composition at 1440 by 900 pixels"></main>
<p class="note">These are static design frames, <span>not browser screenshots</span>. Actual size displays one design pixel per CSS pixel; scroll to inspect the full frame.</p>
<script>
const frames={desktop:{file:'desktop-1440x900',width:1440,height:900},phone:{file:'phone-390x844',width:390,height:844}};
const image=document.getElementById('frame');
let device='desktop',view='base';
function render(){const frame=frames[device],prefix=view==='features'?'features-':'',stem=prefix+frame.file;for(const option of Object.keys(frames))document.getElementById(option).setAttribute('aria-pressed',String(option===device));for(const option of ['base','features'])document.getElementById(option).setAttribute('aria-pressed',String(option===view));image.src=stem+'.png';image.width=frame.width;image.height=frame.height;image.alt='Kilo King '+device+' '+view+' composition at '+frame.width+' by '+frame.height+' pixels';document.getElementById('png').href=stem+'.png';document.getElementById('svg').href=stem+'.svg';document.getElementById('coords').href=prefix+device+'-coordinates.json';document.querySelector('.viewport').scrollTo(0,0)}
for(const name of Object.keys(frames))document.getElementById(name).addEventListener('click',()=>{device=name;render()});
for(const name of ['base','features'])document.getElementById(name).addEventListener('click',()=>{view=name;render()});
for(const size of ['fit','actual'])document.getElementById(size).addEventListener('click',()=>{document.querySelector('.viewport').dataset.scale=size;for(const option of ['fit','actual'])document.getElementById(option).setAttribute('aria-pressed',String(option===size))});
</script>
</body></html>\n`,
);
await fs.appendFile(
  path.join(output, "README.md"),
  "\nThe index.html review page provides Desktop/Phone, Base game/Features and Fit/Actual size controls. It does not run the game. Feature frames show the Buy features tab: two purchase cards on desktop and the first card on phone, with the pager and compact Ante utility. Desktop panel composition assumes an 8px thin scrollbar gutter; browser flex sizing and intrinsic text widths may differ slightly.\n\nDependencies: installed project TypeScript, Python 3 with fontTools and WOFF2/Brotli support, and Sharp available either in node_modules or CODEX_PRIMARY_RUNTIME_NODE_MODULES. The generator only reads existing artwork and uses lossless in-memory PNG decoding where the SVG rasterizer cannot decode WebP.\n",
);
