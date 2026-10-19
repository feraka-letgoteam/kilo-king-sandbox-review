// Non-browser checks for pricing, persisted preferences and rendered panel content.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";
registerHooks({
  resolve(specifier, context, next) {
    const candidate = specifier.startsWith("@/")
      ? new URL(`../src/${specifier.slice(2)}`, import.meta.url)
      : specifier.startsWith(".") && context.parentURL
        ? new URL(specifier, context.parentURL)
        : null;
    if (candidate && !/\.[a-z]+$/i.test(candidate.pathname)) {
      for (const ext of [".ts", ".tsx"]) {
        const file = new URL(candidate.href + ext);
        if (existsSync(file)) return next(file.href, context);
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".css"))
      return { format: "module", shortCircuit: true, source: "export {};" };
    if (url.endsWith(".tsx"))
      return {
        format: "module",
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
            jsx: ts.JsxEmit.ReactJSX,
          },
        }).outputText,
      };
    return next(url, context);
  },
});
const m = await import("../src/components/kilo/control-model.ts");
const { createElement } = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const {
  BetPanel,
  FeaturesPanel,
  FeatureCard,
  SettingsPanel,
  BonusArtwork,
  preloadFeatureArtwork,
} = await import("../src/components/kilo/control-panels.tsx");
const { Paytable } = await import("../src/components/kilo/paytable.tsx");
const { PAY } = await import("../src/lib/kilo/engine.ts");

assert.deepEqual(m.purchaseQuote(10000, "buy", 1000000), {
  cost: 1000000,
  reason: null,
  allowed: true,
});
assert.equal(
  m.purchaseQuote(10000, "chopper", 1e9).reason,
  "Above the 1,000,000 purchase limit",
);
assert.equal(
  m.purchaseQuote(1000, "buy", 99999).reason,
  "Insufficient balance",
);
assert.equal(m.purchaseQuote(1000, "buy", 100000).allowed, true);
assert.equal(m.purchaseQuote(1000, "ante", 1500).cost, 1500);
assert.equal(m.purchaseQuote(1000, "spin", 1000).cost, 1000);
assert.equal(m.purchaseQuote(0, "buy", 1e9).allowed, false);

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, value),
};
for (const speed of ["normal", "turbo", "super"]) {
  for (const motion of ["system", "reduce", "full"]) {
    const pref = { speed, motion };
    m.savePreferences(pref);
    assert.deepEqual(m.readPreferences(), pref);
  }
}
store.set("kilo-presentation-v2", "{broken");
assert.deepEqual(m.readPreferences(), m.DEFAULT_PREFERENCES);
assert.deepEqual(
  m.parsePreferences({ speed: "instant", motion: "sometimes" }),
  m.DEFAULT_PREFERENCES,
);
for (const system of [true, false]) {
  assert.equal(m.resolveMotion("system", system), system);
  assert.equal(m.resolveMotion("reduce", system), true);
  assert.equal(m.resolveMotion("full", system), false);
}
globalThis.localStorage = {
  getItem() {
    throw Error("blocked");
  },
  setItem() {
    throw Error("blocked");
  },
};
assert.deepEqual(m.readPreferences(), m.DEFAULT_PREFERENCES);
assert.doesNotThrow(() =>
  m.savePreferences({ speed: "turbo", motion: "reduce" }),
);
for (let reel = 0; reel < 5; reel++) {
  const durations = ["normal", "turbo", "super"].map(
    (speed) =>
      m.SPIN_TIMING[speed].duration + reel * m.SPIN_TIMING[speed].stagger,
  );
  assert.ok(durations[0] > durations[1] && durations[1] > durations[2]);
}
let actions = 0;
const action = () => {
  actions++;
};
const render = (Component, props) =>
  renderToStaticMarkup(createElement(Component, props));
const panelProps = {
  stake: 10000,
  bank: 1e9,
  ante: false,
  locked: false,
  onAnte: action,
  onEditBet: action,
  onStake: action,
  onBuy: action,
  onClose: action,
};
const panel = render(FeaturesPanel, panelProps);
const { FEATURES, FEATURE_GROUPS, featuresForGroup } =
  await import("../src/components/kilo/feature-catalog.ts");
const renderCards = (group) =>
  featuresForGroup(group)
    .map((feature) =>
      render(FeatureCard, {
        feature,
        stake: 10000,
        bank: 1e9,
        locked: false,
        onSelect: action,
      }),
    )
    .join("");
const features = renderCards("buy");
assert.match(panel, /id="feature-tab-buy"[^>]*aria-selected="true"/);
assert.match(
  panel,
  /Loading features/,
  "Cold artwork has one visible loading state",
);
assert.doesNotMatch(panel, /data-testid="confirm-purchase"/);
assert.deepEqual(
  FEATURE_GROUPS.map((group) => group.id),
  ["buy", "scatter", "development"],
);
assert.deepEqual(
  featuresForGroup("buy").map((feature) => feature.id),
  ["scatter-3", "chopper"],
);
assert.deepEqual(
  featuresForGroup("scatter").map((feature) => feature.id),
  ["scatter-3", "scatter-4", "scatter-5"],
);
assert.deepEqual(
  featuresForGroup("development").map((feature) => feature.id),
  ["mystery", "god-mode"],
);
for (const group of ["scatter", "development"]) {
  for (const feature of featuresForGroup(group)) {
    assert.equal(
      "mode" in feature,
      false,
      "Preview grouping must remove purchase modes",
    );
    assert.equal(
      "multiple" in feature,
      false,
      "Preview grouping must remove purchase prices",
    );
  }
  const previewCards = renderCards(group);
  assert.doesNotMatch(
    previewCards,
    /Review .* purchase|Buy feature|confirm-purchase/,
  );
  assert.equal(
    (previewCards.match(/class="kk-feature-card"/g) || []).length,
    group === "scatter" ? 3 : 2,
  );
}
assert.match(features, /Above the 1,000,000 purchase limit/);
assert.match(
  features,
  /aria-label="Review 3 Scatters purchase for 1,000,000 LGC"/,
);
assert.match(
  features,
  /aria-label="Review Chopper purchase for 2,500,000 LGC" disabled/,
);
assert.doesNotMatch(features, /data-testid="confirm-purchase"/); // Selection is not confirmation.
assert.equal(FEATURES.length, 6);
assert.equal(
  new Set(FEATURES.map((f) => f.art)).size,
  6,
  "Every feature has its own illustration",
);
assert.deepEqual(
  FEATURES.filter((f) => f.kind === "purchase").map((f) => f.mode),
  ["buy", "chopper"],
);
for (const feature of FEATURES) {
  assert.ok(
    existsSync(new URL(`../public${feature.art}`, import.meta.url)),
    `Missing art: ${feature.art}`,
  );
  const group =
    feature.kind === "purchase"
      ? "buy"
      : feature.kind === "trigger"
        ? "scatter"
        : "development";
  assert.match(renderCards(group), new RegExp(`data-feature="${feature.id}"`));
  const preview = render(BonusArtwork, { feature });
  assert.ok(preview.includes(feature.title));
  assert.doesNotMatch(
    preview,
    /confirm-purchase|<button/,
    "Artwork cannot start a purchase",
  );
  if (feature.kind !== "purchase") {
    assert.equal(
      "mode" in feature,
      false,
      "Unpurchasable features must not expose an engine purchase mode",
    );
    assert.equal(
      "multiple" in feature,
      false,
      "Unpurchasable features must not invent prices",
    );
  }
  if (feature.kind === "preview") {
    assert.equal("spins" in feature, false);
    assert.equal("multiplier" in feature, false);
    assert.match(preview, /In development/);
    assert.match(
      renderCards("development"),
      new RegExp(`aria-label="Preview ${feature.title}"`),
    );
  }
}
assert.deepEqual(
  FEATURES.filter((f) => f.id.startsWith("scatter-")).map((f) => [
    f.scatters,
    f.spins,
  ]),
  [
    [3, 10],
    [4, 15],
    [5, 20],
  ],
);
assert.equal((features.match(/class="kk-feature-card"/g) || []).length, 2);
// Prewarming is cached, decoded images render immediately, and an artwork
// failure resolves into a usable fallback rather than an endless busy panel.
const loadedImages = [];
globalThis.window = { setTimeout, clearTimeout };
globalThis.Image = class {
  naturalWidth = 1536;
  set src(value) {
    loadedImages.push(value);
    queueMicrotask(() => {
      if (value.endsWith("/mystery.webp")) this.onerror?.();
      else this.onload?.();
    });
  }
  decode() {
    return Promise.resolve();
  }
};
const preload = preloadFeatureArtwork();
assert.equal(
  preloadFeatureArtwork(),
  preload,
  "Repeated prewarm must reuse the in-flight decode",
);
await preload;
assert.equal(loadedImages.length, 6);
const warmedPanel = render(FeaturesPanel, panelProps);
assert.doesNotMatch(warmedPanel, /Loading features/);
assert.equal((warmedPanel.match(/class="kk-feature-card"/g) || []).length, 2);
assert.match(renderCards("development"), /Artwork unavailable/);
const bet = render(BetPanel, {
  stake: 1000,
  ante: false,
  onApply: action,
  onClose: action,
});
assert.match(bet, /Apply bet/);
assert.doesNotMatch(bet, /<select/);
assert.doesNotMatch(bet, /1,500/); // Ante charge must not appear while off.
assert.match(
  render(BetPanel, {
    stake: 1000,
    ante: true,
    onApply: action,
    onClose: action,
  }),
  /1,500/,
);
const settings = render(SettingsPanel, {
  preferences: m.DEFAULT_PREFERENCES,
  onChange: action,
  locked: true,
  mute: false,
  onMute: action,
  audioAvailable: false,
  musicVolume: 70,
  effectsVolume: 70,
  onVolume: action,
  onRules: action,
  onClose: action,
});
assert.match(settings, /Normal/);
assert.match(settings, /Super turbo/);
assert.match(settings, /<fieldset disabled/);
assert.match(settings, /Audio files did not load\. This session is muted\./);
assert.doesNotMatch(settings, /type="range"/);
const table = render(Paytable, { stake: 1000 });
assert.equal(
  (table.match(/scope="row"/g) || []).length,
  Object.keys(PAY).length,
);
assert.equal(
  actions,
  0,
  "Opening a panel cannot debit, select, change a bet or enable ante",
);
console.log(
  "PASS: purchase caps and balance boundaries, preference persistence/fallbacks, three timing profiles, panel content and paytable coverage. Browser interaction/visual QA remains separate.",
);
