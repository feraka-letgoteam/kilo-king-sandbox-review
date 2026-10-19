// Recorded-result presentation checks. No result generation or wallet writes.
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/"))
      return next(
        new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href,
        context,
      );
    return next(specifier, context);
  },
});
globalThis.window = { setTimeout, matchMedia: () => ({ matches: true }) };
globalThis.localStorage = {
  setItem() {
    throw new Error("Presentation must not write a wallet");
  },
};
const { presentScript } = await import("../src/components/kilo/director.ts");
const fixtures = Object.values(
  JSON.parse(readFileSync("src/lib/kilo/fixtures.json", "utf8")),
);
const base = structuredClone(fixtures.find((f) => f.id === "base-loss").script);
// Deliberate two-line presentation fixture: the recorded amount is authoritative.
const lines = [
  { i: 0, s: "10", n: 3, pay: 200 },
  { i: 1, s: "10", n: 3, pay: 200 },
];
base.base.lines = lines;
base.payout = 400;
let cases = 0;
for (const speed of ["normal", "turbo", "super"]) {
  for (const variant of [
    "base",
    "cap",
    "feature",
    "skip-first",
    "no-callback",
  ]) {
    const round = structuredClone(base);
    if (variant === "cap") {
      round.payout = 300;
      round.capped = true;
    }
    if (variant === "feature") {
      round.base.lines = [];
      round.awarded = 1;
      round.free = [
        { grid: round.base.grid, lines, got: 0, mult: 1, wilds: 0, left: 0 },
      ];
    }
    const before = JSON.stringify(round);
    let hud,
      skip = false;
    const atReveal = [],
      bonusAtReveal = [];
    const scene = {
      setStake() {},
      setPace() {},
      setMood() {},
      setCopy() {},
      setTally() {},
      setMeter() {},
      setLocks() {},
      show() {},
      finishPlate() {},
      async spinTo() {},
      async intro() {},
      async collect() {},
      async tool() {},
      async retrigger() {},
      async highlight(recorded, onLineStart) {
        assert.equal(
          hud.total,
          0,
          "WIN is zero before the first recorded line starts",
        );
        if (variant === "no-callback") return;
        for (let index = 0; index < recorded.length; index++) {
          onLineStart(recorded[index], index);
          atReveal.push(hud.total);
          bonusAtReveal.push(hud.bonusWin);
          assert.equal(
            hud.total,
            Math.min(round.payout, (index + 1) * 200),
            "WIN changes at line start, before its hold",
          );
          // A repeated focus notification cannot add the same line twice.
          onLineStart(recorded[index], index);
          assert.equal(hud.total, atReveal.at(-1));
          if (variant === "skip-first") {
            skip = true;
            return;
          }
        }
      },
    };
    await presentScript(scene, round, {
      turbo: speed !== "normal",
      speed,
      reduced: true,
      skipped: () => skip,
      onHud(next) {
        hud = next;
      },
    });
    assert.equal(
      hud.total,
      round.payout,
      "Final display equals the recorded result",
    );
    assert.equal(
      JSON.stringify(round),
      before,
      "Stored result remains immutable",
    );
    if (variant === "base") assert.deepEqual(atReveal, [200, 400]);
    if (variant === "cap") assert.deepEqual(atReveal, [200, 300]);
    if (variant === "feature") assert.deepEqual(bonusAtReveal, [200, 400]);
    if (variant === "skip-first") assert.deepEqual(atReveal, [200]);
    cases++;
  }
}
console.log(
  `${cases} line-start cases passed: 0 → 200 → 400, cap, feature, duplicate focus, skip and nonvisual fallback at all speeds.`,
);
