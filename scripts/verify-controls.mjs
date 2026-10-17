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
const { BetPanel, FeaturesPanel, SettingsPanel, BonusArtwork } =
  await import("../src/components/kilo/control-panels.tsx");
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
const features = render(FeaturesPanel, {
  stake: 10000,
  bank: 1e9,
  ante: false,
  locked: false,
  onAnte: action,
  onEditBet: action,
  onStake: action,
  onBuy: action,
  onClose: action,
});
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
const { FEATURES } = await import("../src/components/kilo/feature-catalog.ts");
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
  assert.match(features, new RegExp(`data-feature="${feature.id}"`));
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
    assert.match(features, new RegExp(`aria-label="Preview ${feature.title}"`));
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
assert.equal((features.match(/class="kk-feature-card"/g) || []).length, 6);
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
assert.match(settings, /Sound unavailable/);
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
