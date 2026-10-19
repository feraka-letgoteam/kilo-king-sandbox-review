// Checks the actual React markup for availability and selected-state semantics.
// This is server rendering, not browser layout or interaction verification.
import assert from "node:assert/strict";
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
const { createElement: h } = await import("react");
const { renderToStaticMarkup: render } = await import("react-dom/server");
const { SettingsPanel, FeatureCard } =
  await import("../src/components/kilo/control-panels.tsx");
const { FEATURES } = await import("../src/components/kilo/feature-catalog.ts");
const noop = () => {};
for (const [audioAvailable, mute] of [
  [false, false],
  [true, false],
  [true, true],
]) {
  const html = render(
    h(SettingsPanel, {
      preferences: { speed: "super", motion: "system" },
      onChange: noop,
      locked: false,
      mute,
      onMute: noop,
      audioAvailable,
      musicVolume: 65,
      effectsVolume: 80,
      onVolume: noop,
      onRules: noop,
      onClose: noop,
    }),
  );
  assert.equal(
    (html.match(/type="range"/g) || []).length,
    audioAvailable ? 2 : 0,
  );
  assert.match(html, /aria-pressed="true"[^>]*>Super turbo/);
  assert.match(html, /aria-pressed="true"[^>]*>System/);
  if (!audioAvailable) {
    assert.match(html, /Audio files did not load\. This session is muted\./);
    assert.doesNotMatch(
      html,
      /Sound unavailable|aria-label="(?:Mute|Unmute) sound"/,
    );
  } else {
    assert.match(html, /65%/);
    assert.equal(
      (html.match(/type="range"[^>]*disabled=""/g) || []).length,
      mute ? 2 : 0,
    );
  }
}
for (const item of [
  {
    id: "scatter-3",
    stake: 1000,
    bank: 100000,
    allowed: true,
    price: "100,000",
  },
  {
    id: "scatter-3",
    stake: 1000,
    bank: 99999,
    allowed: false,
    price: "100,000",
    reason: "Insufficient balance",
  },
  {
    id: "scatter-3",
    stake: 10000,
    bank: 3000000,
    allowed: true,
    price: "1,000,000",
  },
  {
    id: "chopper",
    stake: 10000,
    bank: 3000000,
    allowed: false,
    price: "2,500,000",
    reason: "Above the 1,000,000 purchase limit",
  },
]) {
  const html = render(
    h(FeatureCard, {
      feature: FEATURES.find((f) => f.id === item.id),
      stake: item.stake,
      bank: item.bank,
      locked: false,
      onSelect: noop,
    }),
  );
  assert(html.includes(item.price));
  const button = html.match(/<button[^>]*class="kk-feature-action[^>]*>/)?.[0];
  assert(button);
  assert.equal(button.includes('disabled=""'), !item.allowed);
  if (item.reason) {
    assert(html.includes(item.reason));
    assert(button.includes(`aria-describedby="feature-${item.id}-reason"`));
    assert(
      html.indexOf("kk-feature-decision") <
        html.indexOf("kk-feature-availability"),
    );
    assert(
      html.indexOf("kk-feature-action") <
        html.indexOf("kk-feature-availability"),
    );
  }
}
console.log(
  "PASS: actual React markup for 3 sound states and 4 purchase boundaries; selected states and disabled-reason associations intact. Browser QA separate.",
);
