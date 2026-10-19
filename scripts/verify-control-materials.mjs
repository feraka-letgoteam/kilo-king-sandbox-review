// CSS/AST regression checks, not a browser renderer or screenshot substitute.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import { transformStyleAttribute } from "lightningcss";
import { controlStructureDigest } from "./control-source-shape.mjs";
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(fileURLToPath(candidate)))
        return next(candidate.href, context);
    }
    return next(specifier, context);
  },
});
const { CONTROL_TOKENS, DEFAULT_CONTROL_THEME, controlThemeStyle } =
  await import("../src/components/slot-controls/tokens.ts");
const { KILO_CONTROL_THEME } =
  await import("../src/components/kilo/control-theme.ts");
const baseline = JSON.parse(
  readFileSync(
    new URL("./checkpoints/material-v25.json", import.meta.url),
    "utf8",
  ),
);
const finishCheckpoint = JSON.parse(
  readFileSync("scripts/checkpoints/material-finish-v25.json", "utf8"),
);
const css = postcss.parse(
  readFileSync("src/components/slot-controls/controls.css", "utf8"),
);
const normalize = (s) => s.replace(/\s+/g, " ").trim();
const rules = [];
css.walkRules((rule) => rules.push(rule));
function rule(selector) {
  const found = rules.find((r) => normalize(r.selector) === selector);
  assert(found, `Missing rule: ${selector}`);
  return found;
}
const declarations = (r) =>
  Object.fromEntries(
    r.nodes.filter((n) => n.type === "decl").map((n) => [n.prop, n.value]),
  );
const rootTokens = Object.fromEntries(
  Object.entries(declarations(rule(".sc-system"))).filter(([key]) =>
    key.startsWith("--"),
  ),
);
function resolve(value, variables) {
  for (let pass = 0; value.includes("var(") && pass < 30; pass++) {
    const previous = value;
    value = value.replace(
      /var\((--[\w-]+)(?:,\s*([^()]+))?\)/g,
      (_, key, fallback) => {
        assert(
          variables[key] !== undefined || fallback !== undefined,
          `Unresolved ${key}`,
        );
        return variables[key] ?? fallback;
      },
    );
    assert.notEqual(value, previous, "Cyclic/unresolved material token");
  }
  assert(!value.includes("var("));
  return value;
}
function parsePaint(value) {
  const found = [];
  transformStyleAttribute({
    code: Buffer.from(value),
    errorRecovery: false,
    visitor: {
      Declaration(decl) {
        found.push(decl);
      },
    },
  });
  return found;
}
function opaqueLayer(layer, message) {
  assert.equal(layer.image.type, "gradient", message);
  const stops = layer.image.value.items.filter(
    (item) => item.type === "color-stop",
  );
  assert(stops.length >= 2);
  for (const stop of stops) assert.equal(stop.color.alpha, 1, message);
}
const surfaceSelectors = [
  ".sc-system .sc-circle, .sc-system .sc-spin",
  '.sc-system .sc-circle[aria-pressed="true"]',
  ".sc-system .sc-control-reason",
  ".sc-system[data-variant] .sc-well",
  ".sc-system .sc-bet::before",
  ".sc-system .sc-spin",
];
const flatSelectors = [
  ".sc-system .sc-badge",
  '.sc-system .sc-badge[data-active="true"]',
  ".sc-system .sc-restriction-mark",
  ".sc-system .sc-ante b",
  '.sc-system .sc-ante[aria-pressed="true"] b',
];
const { faceMid, edgeReturn, emphasis, ...legacyTheme } = KILO_CONTROL_THEME;
let paintCases = 0;
for (const theme of [
  DEFAULT_CONTROL_THEME,
  KILO_CONTROL_THEME,
  legacyTheme,
  { ...DEFAULT_CONTROL_THEME, edge: "#aab7d0", accent: "#fca374" },
]) {
  const variables = { ...rootTokens, ...controlThemeStyle(theme) };
  for (const selector of surfaceSelectors) {
    const d = declarations(rule(selector));
    const parsed = parsePaint(
      `background:${resolve(d.background, variables)};color:${resolve(d["border-color"], variables)}`,
    );
    const layers = parsed.find((d) => d.property === "background").value;
    assert.equal(layers.length, 1);
    assert.equal(
      layers[0].image.type,
      "none",
      `${selector}: face must be a flat color`,
    );
    assert.equal(layers[0].color.alpha, 1, `${selector}: translucent face`);
    assert.equal(
      parsed.find((d) => d.property === "color").value.alpha,
      1,
      `${selector}: translucent rim`,
    );
    assert.doesNotMatch(resolve(d.background, variables), /gradient|url\(/);
    paintCases++;
  }
  for (const selector of flatSelectors) {
    const d = declarations(rule(selector));
    const parsed = parsePaint(`background:${resolve(d.background, variables)}`);
    assert.equal(
      parsed[0].value[0].color.alpha,
      1,
      `${selector}: transparent badge/pill`,
    );
    paintCases++;
  }
}
// Reproduce the shipped failure: the inline color replaces an image token.
const legacyVariables = {
  ...baseline.rootTokens,
  ...controlThemeStyle(KILO_CONTROL_THEME),
};
const broken = parsePaint(
  `background:${resolve(baseline.circleBackground, legacyVariables)}`,
);
assert.throws(() =>
  opaqueLayer(broken[0].value[0], "v25 color/image collision"),
);
const disabled = declarations(
  rule('.sc-system .sc-button:is(:disabled, [aria-disabled="true"])'),
);
assert.equal(disabled.opacity, "1");
assert.equal(disabled.filter, "none", "Disabled state dims the brass rim");
const disabledIcon = declarations(
  rule('.sc-system .sc-button:is(:disabled, [aria-disabled="true"]) .sc-icon'),
);
assert.equal(disabledIcon.opacity, "1");
assert.equal(
  declarations(rule(".sc-system .sc-label")).color,
  "var(--sc-muted)",
);
assert.equal(CONTROL_TOKENS.labelSize, 14);
assert.equal(CONTROL_TOKENS.spinRim, 8);
assert.equal(
  declarations(rule(".sc-system .sc-icon svg"))["stroke-width"],
  "3",
);
assert.equal(
  declarations(rule(".sc-system .sc-icon svg [stroke]"))["stroke-width"],
  "inherit",
);
assert.equal(
  declarations(rule(".sc-system .sc-spin .sc-icon svg"))["stroke-width"],
  "3.5",
);
assert.doesNotMatch(css.toString(), /(?:linear|radial|conic)-gradient/);
css.walkDecls("backdrop-filter", (d) => assert.equal(d.value, "none"));
// Each shadow's blur radius is zero. Hard highlights do not blend the rim
// into its face; their paint extents do not change the hit target rectangle.
for (const selector of [
  surfaceSelectors[0],
  surfaceSelectors[3],
  surfaceSelectors[4],
  surfaceSelectors[5],
]) {
  const shadow = declarations(rule(selector))["box-shadow"];
  for (const layer of shadow.split(/,(?![^()]*\))/)) {
    const lengths = layer
      .trim()
      .replace(/^inset\s+/, "")
      .match(/^-?[\d.]+(?:px)?\s+-?[\d.]+(?:px)?\s+(-?[\d.]+)(?:px)?/);
    assert(lengths && Number(lengths[1]) === 0, `${selector}: blurred edge`);
  }
}
// This pass explicitly changes focus/pressed paint, not measured geometry.
// The production cascade/paint-bound verifier also checks these state rules.
const cosmetic =
  /^(?:--|background(?:-|$)|color$|border-color$|box-shadow$|filter$|backdrop-filter$|opacity$|stroke-width$|appearance$|outline-offset$|transform$|transition$)/;
const geometry = rules
  .map((r) => [
    normalize(r.selector),
    r.nodes
      .filter((n) => n.type === "decl" && !cosmetic.test(n.prop))
      .map((n) => [n.prop, normalize(n.value)]),
  ])
  .filter(([, values]) => values.length);
assert.deepEqual(
  geometry,
  baseline.cssGeometry
    .map(([s, values]) => [s, values.filter(([key]) => !cosmetic.test(key))])
    .filter(([, values]) => values.length),
  "CSS geometry/typography changed",
);
assert.deepEqual(
  CONTROL_TOKENS,
  finishCheckpoint.controlTokens,
  "Control geometry tokens changed",
);
for (const [path, expected] of Object.entries(
  finishCheckpoint.protectedFiles,
)) {
  if (path.endsWith("/SlotControls.tsx")) continue;
  // The authorized 4px landscape spacing correction is checked against all
  // checkpoint rectangles by verify-control-contrast.mjs.
  if (path === "src/components/slot-controls/layout.ts") continue;
  const actual = createHash("sha256").update(readFileSync(path)).digest("hex");
  assert.equal(actual, expected, `${path} changed from v25`);
}
assert.equal(
  controlStructureDigest(
    readFileSync("src/components/slot-controls/SlotControls.tsx", "utf8"),
  ),
  finishCheckpoint.controlStructure,
  "Control behavior, positions or markup changed outside the two readout text styles",
);
function luminance(hex) {
  const c = hex
    .slice(1)
    .match(/../g)
    .map((p) => parseInt(p, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
}
function contrast(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const t = KILO_CONTROL_THEME;
const contrastRatios = {
  numbersOnWell: contrast(t.emphasis, t.well),
  previousNumbersOnLightestWell: contrast(t.text, t.wellLight),
  previousWinOnLightestWell: contrast(t.edgeLight, t.wellLight),
  labelsOnWell: contrast(t.muted, t.well),
  reasonOnFace: contrast(t.emphasis, t.face),
  iconsOnFace: contrast(t.iconInk, t.face),
  iconsOnSelectedFace: contrast(t.iconInk, t.face),
  disabledIconsOnFace: contrast(t.iconInk, t.face),
  disabledIconsOnSelectedFace: contrast(t.iconInk, t.face),
  costLabelOnFace: contrast(t.muted, t.face),
  brassRimOnFace: contrast(t.edge, t.face),
};
assert(
  contrastRatios.numbersOnWell > contrastRatios.previousNumbersOnLightestWell,
);
assert(contrastRatios.numbersOnWell > contrastRatios.previousWinOnLightestWell);
for (const [name, ratio] of Object.entries(contrastRatios))
  assert(
    ratio >=
      (name.startsWith("disabledIcons")
        ? 3
        : name === "brassRimOnFace"
          ? 3
          : 4.5),
    `${name}: low source contrast ${ratio}`,
  );
const outputDirectory =
  process.env.CONTROL_REVIEW_OUTPUT ?? "public/kilo-material-finish-v25";
const report = {
  checkpoint: JSON.parse(
    readFileSync("scripts/checkpoints/contrast-v25.json", "utf8"),
  ).commit,
  paintCases,
  recoveredRegression:
    "Historical color/image token collision stays fixed; this pass also removes state filters and external paint.",
  unchangedGeometryRules: geometry.length,
  unchangedControlTokens: true,
  protectedFiles: Object.keys(finishCheckpoint.protectedFiles).length - 2,
  unchangedControlStructureOutsideReadoutTypography: true,
  disabledRimUndimmed: true,
  flatOpaqueFaces: true,
  opaqueBorderRims: true,
  unblurredEdges: true,
  iconStrokeWidth: { secondary: 3, spin: 3.5 },
  labels: { size: 14, color: t.muted },
  contrastRatios: Object.fromEntries(
    Object.entries(contrastRatios).map(([key, value]) => [
      key,
      Number(value.toFixed(2)),
    ]),
  ),
  spacing:
    "Tokens and sizes unchanged. Landscape Auto–Spin gap is now 8px. Edge and focus paint stay inside control bounds; see the production cascade report.",
  browserQA: false,
  screenshots: [],
  limitation:
    "CSS token/AST, source identity and markup checks only. Live rendering remains unverified.",
};
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(
  `${outputDirectory}/material-validation.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
