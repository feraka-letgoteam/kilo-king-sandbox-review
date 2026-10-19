// Checks the actual React markup for availability and selected-state semantics.
// This is server rendering, not browser layout or interaction verification.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
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
const { execFileSync } = await import("node:child_process");
const { mkdirSync, writeFileSync } = await import("node:fs");
const { createElement: element } = await import("react");
const { renderToStaticMarkup: render } = await import("react-dom/server");
const { SlotControls } =
  await import("../src/components/slot-controls/SlotControls.tsx");
const { controlReadoutTextStyle } =
  await import("../src/components/slot-controls/typography.ts");
const { KILO_CONTROL_THEME } =
  await import("../src/components/kilo/control-theme.ts");
const { FeatureMark } =
  await import("../src/components/kilo/StageSurround.tsx");
const {
  createControlLayout,
  controlTargets,
  controlAmountSize,
  controlChargeLayout,
} = await import("../src/components/slot-controls/layout.ts");
const { fitGameLayout } = await import("../src/components/kilo/layout.ts");
const { controlAvailability, CONTROL_TOKENS, DEFAULT_CONTROL_THEME } =
  await import("../src/components/slot-controls/tokens.ts");
const { SettingsPanel, FeatureCard } =
  await import("../src/components/kilo/control-panels.tsx");
const { FEATURES } = await import("../src/components/kilo/feature-catalog.ts");
const { purchaseQuote } =
  await import("../src/components/kilo/control-model.ts");
const checkpoint = "4b21e2535fd1c10036b2ab487ddca8dd9b1daafc";
const outputDirectory =
  process.env.CONTROL_REVIEW_OUTPUT ?? "public/kilo-material-finish-v25";
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
const sizes = [
  [360, 800],
  [390, 844],
  [844, 390],
  [1440, 900],
];
const scenarios = [
  ["base-idle", {}],
  ["ante-off", {}],
  ["armed-free-spins", { charge: { amount: "100,000" } }],
  ["armed-chopper", { charge: { amount: "250,000" } }],
  [
    "maximum-valid-purchase",
    { balance: "1,000,000", bet: "10,000", charge: { amount: "1,000,000" } },
  ],
  [
    "long-charge-insufficient",
    {
      balance: "400",
      spinDisabled: true,
      spinDisabledReason: "Insufficient balance",
      charge: { amount: "1,000,000" },
    },
  ],
  ["ante-on", { ante: true, charge: { amount: "1,500" } }],
  [
    "new-spin",
    { busy: true, locked: true, win: "0", charge: { label: "Spinning" } },
  ],
  [
    "feature-entry",
    {
      feature: { remaining: 10, multiplier: 1 },
      busy: true,
      locked: true,
      charge: { label: "Free spins" },
    },
  ],
  [
    "collection",
    {
      feature: { remaining: 8, multiplier: 2 },
      busy: true,
      locked: true,
      win: "48,000",
      awardLanded: true,
      charge: { label: "Free spins" },
    },
  ],
  [
    "retrigger",
    {
      feature: { remaining: 15, multiplier: 3 },
      busy: true,
      locked: true,
      win: "96,000",
      charge: { label: "Free spins" },
    },
  ],
  [
    "completion-long",
    {
      feature: { remaining: 0, multiplier: 5 },
      locked: true,
      spinDisabled: true,
      win: "5,000,000",
    },
  ],
  ["long-balance", { balance: "1,234,567,890" }],
  [
    "insufficient-balance",
    {
      balance: "400",
      spinDisabled: true,
      spinDisabledReason: "Insufficient balance",
    },
  ],
  [
    "bet-unavailable",
    {
      spinDisabled: true,
      spinDisabledReason: "Bet unavailable",
    },
  ],
  [
    "loading",
    {
      ready: false,
      spinDisabled: true,
      spinDisabledReason: "Loading",
    },
  ],
  ["turbo", { speed: "turbo" }],
  ["super-turbo", { speed: "super" }],
  [
    "auto-running",
    {
      autoRemaining: 9,
      busy: true,
      locked: true,
      charge: { label: "Spinning" },
    },
  ],
];
const getLayout = (w, h) => {
  const small = h <= 380 && w / h >= 1.4,
    pad = small ? 16 : w <= 620 ? 24 : 32;
  const game = fitGameLayout(w - pad, h - (small ? 16 : w <= 620 ? 32 : 40));
  const dock = createControlLayout({
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
  });
  return { game, dock };
};
const fonts = JSON.parse(
  execFileSync("python", [
    "-c",
    `from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
import json
f=TTFont('public/kilo-ui-v11/fonts/SourceSans3-700.woff2'); c=f.getBestCmap()
g=f.getGlyphSet(); bounds={}
for s in '0123456789,':
 p=BoundsPen(g); g[c[ord(s)]].draw(p); bounds[s]=p.bounds
print(json.dumps({'em':f['head'].unitsPerEm,'bounds':bounds,'width':{s:f['hmtx'][c[ord(s)]][0] for s in '0123456789,CostInsufficientbalanceBetunavailableLoading'}}))`,
  ]).toString(),
);
const overlap = (a, b) =>
  a.x < b.x + b.w - 0.001 &&
  b.x < a.x + a.w - 0.001 &&
  a.y < b.y + b.h - 0.001 &&
  b.y < a.y + a.h - 0.001;
let layouts = 0,
  targets = 0,
  comparisons = 0,
  amounts = 0;
for (const [w, h] of [
  ...sizes,
  [400, 225],
  [480, 270],
  ...[320, 352, 375, 620, 739, 740, 899, 900, 1180, 1600, 1920].flatMap((w) =>
    [390, 568, 660, 900].map((h) => [w, h]),
  ),
]) {
  const { game, dock: d } = getLayout(w, h);
  layouts++;
  for (const feature of [false, true]) {
    const entries = Object.entries(controlTargets(d, feature));
    for (const [name, r] of entries) {
      targets++;
      assert(r.w >= 44 && r.h >= 44, `${w}x${h}: small ${name}`);
      assert(
        r.x >= 0 &&
          r.y >= 0 &&
          r.x + r.w <= d.width + 0.01 &&
          r.y + r.h <= d.height + 0.01,
        `${w}x${h}: bounds ${name}`,
      );
      if (game.mode === "landscape")
        assert(
          !overlap(r, {
            x: game.compact ? 0 : game.controlLeft + game.dockGap,
            y: game.header,
            w: game.reelWidth,
            h: game.reelHeight,
          }),
          `${name} crosses reels`,
        );
    }
    for (let i = 0; i < entries.length; i++)
      for (let j = i + 1; j < entries.length; j++) {
        comparisons++;
        assert(
          !overlap(entries[i][1], entries[j][1]),
          `${w}x${h}: ${entries[i][0]}/${entries[j][0]} overlap`,
        );
      }
  }
  for (const key of ["balance", "win"])
    for (const value of ["0", "500,000", "5,000,000", "1,234,567,890"]) {
      const r = d[key],
        available = r.w - (d.variant === "compact" ? 8 : 20),
        text = controlReadoutTextStyle(
          value,
          available,
          d.variant === "desktop" ? 28 : d.variant === "landscape" ? 20 : 22,
        ),
        size = text.fontSize,
        lineHeight = Number.parseFloat(text.lineHeight);
      const actual =
        ([...value].reduce((a, c) => a + fonts.width[c], 0) / fonts.em) * size;
      amounts++;
      assert(actual <= available, `number width ${w} ${key}`);
      assert(
        size >= (sizes.some(([a, b]) => a === w && b === h) ? 14 : 10),
        `number too small ${w} ${h}`,
      );
      assert(
        (d.variant === "compact" ? 10 : CONTROL_TOKENS.labelSize) +
          2 +
          lineHeight +
          6 <=
          r.h,
        `number height ${w} ${h}`,
      );
      const inkHeight =
        ((Math.max(...[...value].map((c) => fonts.bounds[c][3])) -
          Math.min(...[...value].map((c) => fonts.bounds[c][1]))) /
          fonts.em) *
        size;
      assert(
        inkHeight <= lineHeight,
        `numeric ink exceeds preserved line box ${w} ${h}`,
      );
      assert.equal(
        lineHeight,
        controlAmountSize(
          value,
          available,
          d.variant === "desktop" ? 28 : d.variant === "landscape" ? 20 : 22,
        ),
      );
    }
  for (const value of ["100", "1,000", "10,000", "1,000,000"]) {
    const text = controlReadoutTextStyle(
      value,
      d.betButton.w - 8,
      d.variant === "desktop" ? 26 : 22,
    );
    const actual =
      ([...value].reduce((sum, c) => sum + fonts.width[c], 0) / fonts.em) *
      text.fontSize;
    assert(actual <= d.betButton.w - 8, `bet digits cross steppers ${w}x${h}`);
    assert(
      14 + 3 + Number.parseFloat(text.lineHeight) <= d.betButton.h,
      `bet text height ${w}x${h}`,
    );
  }
  for (const value of ["100", "1,000", "15,000", "1,000,000", "2,500,000"]) {
    const charge = controlChargeLayout(d, value);
    const amountWidth =
      ([...value].reduce((sum, c) => sum + fonts.width[c], 0) / fonts.em) *
      charge.amountSize;
    const costWidth =
      ([..."Cost"].reduce((sum, c) => sum + fonts.width[c], 0) / fonts.em) * 10;
    assert(charge.amountSize >= 10, `charge too small ${w}x${h}`);
    const amountTop = charge.stacked
      ? charge.y + (charge.h - 11 - charge.amountSize) / 2 + 11
      : charge.y + (charge.h - charge.amountSize) / 2;
    const width =
      amountWidth +
      (!charge.stacked && d.variant !== "compact" ? costWidth + 3 : 0);
    const radius =
      d.spin.w / 2 - (d.variant === "compact" ? 4 : CONTROL_TOKENS.spinRim);
    // Check the whole text line rectangle against the circular face, not just the dock box.
    for (const y of [amountTop, amountTop + charge.amountSize]) {
      assert(
        Math.hypot(width / 2, y - d.spin.y - d.spin.h / 2) <= radius + 0.01,
        `charge touches Spin rim ${w}x${h}: ${value}`,
      );
    }
  }

  const reasonSize = d.spin.w < 80 ? 9 : d.spin.w < 96 ? 11 : 12;
  for (const message of [
    "Insufficient balance",
    "Bet unavailable",
    "Loading",
  ]) {
    for (const word of message.split(" ")) {
      const actual =
        ([...word].reduce((sum, c) => sum + fonts.width[c], 0) / fonts.em) *
        reasonSize;
      assert(actual <= d.spin.w * 0.76, `${w}x${h}: clipped disabled reason`);
    }
    assert(
      d.spin.y +
        d.spin.h * 0.2 +
        message.split(" ").length * reasonSize * 1.15 <
        d.charge.y,
      `${w}x${h}: disabled reason crosses charge`,
    );
  }
  if (d.variant === "desktop")
    for (const [i, k] of [
      "turbo",
      "menu",
      "balance",
      "win",
      "bet",
      "auto",
      "spin",
      "buy",
    ].entries())
      if (i) {
        const prev =
          d[
            ["turbo", "menu", "balance", "win", "bet", "auto", "spin", "buy"][
              i - 1
            ]
          ];
        assert(d[k].x - prev.x - prev.w >= 7.99, "modules have open gaps");
      }
  if (d.variant === "portrait") {
    assert(!d.drawer.turbo && !d.drawer.auto);
    assert.equal(d.turbo.w, 44);
    assert.equal(d.menu.w, 44);
    assert.equal(d.turbo.y, d.menu.y);
    assert.equal(d.featureTurbo.y, d.featureMenu.y);
    assert(d.featureMenu.x > d.featureTurbo.x + d.featureTurbo.w);
    assert(d.balance.y + d.balance.h < d.spin.y);
    assert(d.win.y + d.win.h < d.spin.y);
    assert(d.bet.w <= 124 && d.bet.h <= 88, "portrait bet remains compact");
    assert(
      Math.abs(d.spin.x + d.spin.w / 2 - d.width / 2) <= 4,
      "portrait Spin stays central even on narrower fallback sizes",
    );
    if (w === 360 || w === 390) {
      assert.equal(d.spin.x + d.spin.w / 2, d.width / 2);
      assert.equal(d.spin.w, 96);
    }
    assert(d.auto.x > d.spin.x + d.spin.w && d.buy.x > d.auto.x);
    assert(d.menu.y + d.menu.h <= d.spin.y + 96);
    assert(d.height - (d.menu.y + d.menu.h) <= 12, "no extra control rows");
  }
}
const matrix = [];
const cascadeCases = [];
for (const [w, h] of sizes)
  for (const [name, patch] of scenarios) {
    const { game, dock } = getLayout(w, h),
      state = { ...base, ...patch };
    const html = render(
      element(SlotControls, {
        layout: dock,
        state,
        actions,
        theme: KILO_CONTROL_THEME,
        icons: { buy: element(FeatureMark) },
        bonusAnchorClassName: "kk-bonus-win",
      }),
    );
    cascadeCases.push({ viewport: [w, h], state: name, game, dock, html });
    assert.doesNotMatch(html, /LAST WIN|last win|kk-dock-skin/);
    assert.match(html, /data-testid="spin-button"/);
    const actionGroup = html
      .split('<div class="sc-spin-group"')[1]
      ?.split("</div>")[0];
    assert(actionGroup, "Missing Spin face group");
    const chargeDescription = actionGroup.match(
      /<span[^>]*class="sc-charge"[^>]*\sid="([^"]+)"/,
    )[1];
    const spinTag = actionGroup.match(
      /<button[^>]*data-testid="spin-button"[^>]*>/,
    )[0];
    assert(
      spinTag.includes(chargeDescription),
      "Spin describes its in-face cost",
    );
    if ("amount" in state.charge) {
      assert(actionGroup.includes(">Cost</small>"));
      assert(
        actionGroup.includes(`>${state.charge.amount}</b>`),
        "Full charge stays in the Spin group",
      );
    }
    if (state.spinDisabledReason) {
      assert.match(html, /class="sc-action-reason"/);
      assert(html.includes(state.spinDisabledReason));
      const reason = html.match(
        /<span[^>]*id="([^"]+)"[^>]*class="sc-action-reason"/,
      );
      const spin = html.match(/<button[^>]*data-testid="spin-button"[^>]*>/)[0];
      assert(spin.includes('disabled=""'));
      assert(
        spin.includes(reason[1]),
        "Spin describes its attached disabled reason",
      );
      assert(
        actionGroup.includes(`id="${reason[1]}"`),
        "Disabled reason is inside the same Spin face group",
      );
    }
    if (dock.drawer.turbo) {
      assert.match(html, /sc-badge-speed/);
      assert.match(html, /Spin speed:/);
    }
    if (dock.variant === "portrait") {
      assert.match(html, /data-control="turbo"/);
      assert.match(html, /data-control="menu"/);
      if (!state.feature) assert.match(html, /data-control="auto"/);
    }
    if (state.feature) {
      assert.match(html, /data-module="free-spins"/);
      assert.doesNotMatch(
        html,
        /data-module="bet"|data-control="auto"|data-control="buy"/,
      );
      assert.match(html, /data-testid="bonus-win"/);
      assert.match(html, /kk-bonus-win/);
    } else {
      assert.match(html, /data-module="bet"/);
      assert.match(html, /aria-label="Ante (?:Off|On)"/);
    }
    // Same geometry is recomputed at each requested feature phase and resize size.
    assert.deepEqual(game, getLayout(w, h).game);
    matrix.push({
      viewport: `${w}x${h}`,
      state: name,
      sourceGeometry: "pass",
      serverMarkup: "pass",
      browserScreenshot: "unavailable",
      liveInteraction: "unverified",
    });
  }
const desktop = getLayout(1440, 900).dock;
for (const [w, h] of sizes)
  for (const presentation of ["hide", "disable"])
    for (const name of ["turbo", "auto", "buy", "ante"]) {
      const flag = {
        turbo: "disabledTurbo",
        auto: "disabledAutoplay",
        buy: "disabledBuyFeature",
        ante: "disabledAnte",
      }[name];
      const flags = { [flag]: true, restrictedPresentation: presentation };
      const html = render(
        element(SlotControls, {
          layout: getLayout(w, h).dock,
          state: base,
          actions,
          jurisdiction: flags,
        }),
      );
      const tag =
        name === "ante"
          ? html.match(/<button[^>]*class="sc-button sc-ante"[^>]*>/)?.[0]
          : html.match(
              new RegExp(`<button[^>]*data-control="${name}"[^>]*>`),
            )?.[0];
      assert.equal(!!tag, presentation === "disable");
      if (tag) {
        assert(tag.includes('aria-disabled="true"'));
        assert(
          !tag.includes(' disabled=""'),
          "restricted controls remain focusable to explain why",
        );
        const description = tag.match(/aria-describedby="([^"]+)"/)[1];
        assert(html.includes(`id="${description}" role="tooltip"`));
        assert(html.includes("Unavailable in this jurisdiction"));
      }
      assert.equal(controlAvailability(name, flags).disabled, true);
    }
const restrictedSettings = render(
  element(SettingsPanel, {
    preferences: { speed: "normal", motion: "system" },
    disabledTurbo: true,
    onChange: noop,
    locked: false,
    mute: false,
    onMute: noop,
    audioAvailable: false,
    musicVolume: 65,
    effectsVolume: 80,
    onVolume: noop,
    onRules: noop,
    onClose: noop,
  }),
);
assert.match(restrictedSettings, /disabled=""[^>]*>Turbo/);
assert.match(restrictedSettings, /disabled=""[^>]*>Super turbo/);
// Confirm the same component accepts a different palette and icon set without layout changes.
const swapped = render(
  element(SlotControls, {
    layout: desktop,
    state: base,
    actions,
    theme: { ...DEFAULT_CONTROL_THEME, edge: "#aab7d0", accent: "#fca374" },
    icons: { buy: element("span", null, "◇") },
  }),
);
assert.match(swapped, /--sc-edge:#aab7d0/);
assert.match(swapped, /◇/);
for (const [id, stake, bank, allowed, reason] of [
  ["scatter-3", 1000, 100000, true, null],
  ["chopper", 1000, 250000, true, null],
  ["scatter-3", 10000, 1000000, true, null],
  ["chopper", 10000, 3000000, false, "Above the 1,000,000 purchase limit"],
]) {
  const feature = FEATURES.find((f) => f.id === id);
  const q = purchaseQuote(stake, feature.mode, bank);
  assert.equal(q.allowed, allowed);
  assert.equal(q.reason, reason);
  const html = render(
    element(FeatureCard, {
      feature,
      stake,
      bank,
      locked: false,
      onSelect: noop,
    }),
  );
  const button = html.match(/<button[^>]*class="kk-feature-action[^>]*>/)[0];
  assert.equal(button.includes('disabled=""'), !allowed);
  if (reason) assert(html.includes(reason));
}
const protectedPaths = [
  "src/lib/kilo/engine.ts",
  "src/lib/kilo/bank.ts",
  "src/lib/kilo/fixtures.json",
  "src/components/kilo/layout.ts",
  "src/components/kilo/director.ts",
  "src/components/kilo/pixiStage.ts",
  "src/components/kilo/ReelStage.tsx",
  "src/components/kilo/motion-atlas.ts",
  "src/components/kilo/FishermanScene.tsx",
  "src/components/kilo/MarinaBackdrop.tsx",
  "src/components/kilo/control-model.ts",
  "src/components/kilo/auto-spins.ts",
  "src/components/kilo/keyboard.ts",
  "src/components/kilo/control-panels.tsx",
];
// Checked-in digests come from the named git checkpoint, so these guards also
// work from the complete source ZIP without requiring private git history.
const baseline = JSON.parse(
  readFileSync(
    new URL("./checkpoints/modular-v23.json", import.meta.url),
    "utf8",
  ),
);
assert.equal(baseline.sourceCommit, checkpoint);
const digest = (value) => createHash("sha256").update(value).digest("hex");
for (const p of protectedPaths)
  assert.equal(digest(readFileSync(p)), baseline.files[p], `${p} changed`);
const play = readFileSync("src/components/kilo/play.tsx", "utf8");
const credit = (s) =>
  s.slice(
    s.indexOf("  function credit("),
    s.indexOf("  const cost = splashCost(stake, mode);"),
  );
assert.equal(
  digest(credit(play)),
  baseline.hostCreditAndPlay,
  "presentation, zero reset and settlement changed",
);
assert.doesNotMatch(
  play,
  /className="kk-afford"/,
  "detached disabled reason returned",
);
const panels = readFileSync("src/components/kilo/control-panels.tsx", "utf8");
const confirmation = (s) =>
  s.slice(
    s.indexOf("      {choice && ("),
    s.indexOf("export function SettingsPanel"),
  );
assert.equal(
  digest(confirmation(panels)),
  baseline.purchaseConfirmation,
  "purchase confirmation changed",
);
for (const path of [
  "SlotControls.tsx",
  "layout.ts",
  "tokens.ts",
  "typography.ts",
  "controls.css",
])
  assert.doesNotMatch(
    readFileSync("src/components/slot-controls/" + path, "utf8"),
    /kilo|MARINA|\/kilo-/i,
    "shared system depends on Kilo",
  );
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(
  `${outputDirectory}/cascade-cases.json`,
  JSON.stringify(cascadeCases),
);
writeFileSync(
  `${outputDirectory}/validation.json`,
  JSON.stringify(
    {
      checkpoint,
      layouts,
      targets,
      comparisons,
      amounts,
      readoutTypography:
        "Digits grow by up to 2px; original line boxes and long-amount width fitting preserved. Checked against the shipped font's advances and ink bounds.",
      spinCostAndReason:
        "Both remain in the Spin face group and are linked by aria-describedby in every applicable state.",
      matrix,
      protectedPaths,
      browserQA: false,
      limit:
        "Geometry and actual server-rendered components only. Active-feature DOM resize, modal interaction and screenshots remain unverified.",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify(
    {
      layouts,
      targets,
      comparisons,
      amounts,
      markupStates: matrix.length,
      protectedFiles: protectedPaths.length,
      jurisdiction:
        "32 hide/disable cases across all four viewports + settings",
      browserQA: false,
    },
    null,
    2,
  ),
);
// Self-contained, actual React markup for inspecting the shared modules locally.
// This is a static DOM review sheet, not evidence of browser execution.
let css = readFileSync("src/components/slot-controls/controls.css", "utf8");
css = css.replace(
  /url\("\.\/fonts\/([^\"]+)"\)/g,
  (_, file) =>
    `url("data:font/woff2;base64,${readFileSync("src/components/slot-controls/fonts/" + file).toString("base64")}")`,
);
const cards = [];
for (const [w, height] of sizes)
  for (const [name, patch] of scenarios) {
    const d = getLayout(w, height).dock;
    cards.push(
      `<section data-size="${w}x${height}" data-state="${name}"><h2>${w}×${height} · ${name}</h2><div class="stage">${render(element(SlotControls, { layout: d, state: { ...base, ...patch }, actions, theme: KILO_CONTROL_THEME, icons: { buy: element(FeatureMark) } }), { identifierPrefix: `${w}-${height}-${name}-` })}</div></section>`,
    );
  }
for (const [w, height] of sizes)
  for (const presentation of ["hide", "disable"]) {
    const jurisdiction = {
      disabledTurbo: true,
      disabledAutoplay: true,
      disabledBuyFeature: true,
      disabledAnte: true,
      restrictedPresentation: presentation,
    };
    cards.push(
      `<section data-size="${w}x${height}" data-state="jurisdiction-${presentation}"><h2>${w}×${height} · jurisdiction ${presentation}</h2><div class="stage">${render(element(SlotControls, { layout: getLayout(w, height).dock, state: base, actions, jurisdiction, theme: KILO_CONTROL_THEME, icons: { buy: element(FeatureMark) } }), { identifierPrefix: `${w}-${height}-${presentation}-` })}</div></section>`,
    );
  }
const options = (items) =>
  items
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join("");
writeFileSync(
  `${outputDirectory}/control-state-review.html`,
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Modular controls v25 — source state review</title><style>${css}\nbody{margin:24px;background:#06141c;color:#eee5ce;font:16px/1.5 system-ui}h1{font-size:24px}h2{font-size:14px;font-weight:500}p{max-width:800px}.stage{width:max-content;padding:16px;background:linear-gradient(145deg,#26494d,#092a3c)}section{margin:24px 0}select{font:inherit;padding:8px;margin-right:12px}section[hidden]{display:none}</style><h1>Modular controls v25</h1><p>Actual server-rendered React components and the component stylesheet. Gameplay controls on this sheet are inert. Restricted controls expose their reason on hover or keyboard focus. This is not a browser screenshot or an interactive gameplay test. No deployment.</p><label>Viewport <select id="size">${options([["all", "All"], ...sizes.map(([w, h]) => [w + "x" + h, w + " × " + h])])}</select></label><label>State <select id="state">${options([["all", "All"], ...scenarios.map(([s]) => [s, s]), ["jurisdiction-hide", "Jurisdiction: hidden"], ["jurisdiction-disable", "Jurisdiction: disabled"]])}</select></label>${cards.join("")}<script>const size=document.getElementById('size'),state=document.getElementById('state');function filter(){document.querySelectorAll('section').forEach(el=>{el.hidden=(size.value!=='all'&&el.dataset.size!==size.value)||(state.value!=='all'&&el.dataset.state!==state.value)})}size.onchange=state.onchange=filter;</script></html>`,
);
