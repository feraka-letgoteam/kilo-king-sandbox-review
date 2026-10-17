// Run with Node 24+. Pure presentation checks; no browser or bank writes.
import { createHash } from "node:crypto";
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
const {
  presentScript,
  presentEventPreview,
  featureSummary,
  spinControl,
  collectionShares,
  groupRounds,
  ledgerBefore,
  winningCells,
  findPairCollection,
  presentSettledCollection,
} = await import("../src/components/kilo/director.ts");
const { collectMult } = await import("../src/lib/kilo/engine.ts");
const fixtures = Object.values(
  JSON.parse(
    readFileSync(new URL("../src/lib/kilo/fixtures.json", import.meta.url)),
  ),
);
let passed = 0;
for (const fixture of fixtures) {
  for (const speed of ["normal", "turbo", "super"]) {
    for (const skipAt of [Infinity, 1, 4, 12]) {
      const round = fixture.script,
        before = JSON.stringify(round);
      let hud,
        totalAtCollect,
        actions = 0,
        shown,
        freeIndex = 0,
        preWilds = round.banked;
      let expectedRemaining = round.awarded;
      const event = async () => {
        actions++;
      };
      const scene = {
        setStake() {},
        setPace(turbo, reduced, actualSpeed) {
          assert.equal(actualSpeed, speed);
          assert.equal(turbo, speed !== "normal");
          assert.equal(reduced, true);
        },
        setMood() {},
        setCopy() {},
        setTally() {},
        setMeter() {},
        setLocks() {},
        spinTo: async (grid) => {
          shown = grid;
          actions++;
        },
        show: (grid) => {
          shown = grid;
        },
        highlight: event,
        tool: async (spin) => {
          shown = spin.grid;
          actions++;
        },
        intro: event,
        retrigger: event,
        finishPlate() {},
        collect: async (spin) => {
          assert.equal(
            hud.mult,
            spin.mult,
            `${fixture.id}: collection uses pre-spin multiplier`,
          );
          totalAtCollect = hud.total;
          actions++;
        },
      };
      let lastTotal = 0;
      await presentScript(scene, round, {
        turbo: speed !== "normal",
        speed,
        reduced: true,
        skipped: () => actions >= skipAt,
        onHud(next) {
          assert.ok(
            next.total >= lastTotal && next.total <= round.payout,
            `${fixture.id}: monotonic capped total`,
          );
          if (next.note === "Free spin") {
            assert.equal(
              next.left,
              expectedRemaining,
              `${fixture.id}: no advance announcement of retrigger spins`,
            );
            assert.equal(next.wilds, preWilds);
            const spin = round.free[freeIndex++];
            expectedRemaining = spin.left;
            preWilds += spin.wilds;
          }
          if (
            next.note.startsWith("Collected ") &&
            hud?.note.startsWith("Collecting ")
          )
            assert.equal(
              next.total - totalAtCollect,
              next.spinCollect,
              `${fixture.id}: collect credited after animation`,
            );
          lastTotal = next.total;
          hud = next;
        },
      });
      assert.equal(hud.total, round.payout, `${fixture.id}: final payout`);
      assert.equal(
        hud.line + hud.collect + hud.scatter,
        round.payout,
        `${fixture.id}: components reconcile`,
      );
      assert.equal(
        hud.mult,
        collectMult(round.banked + round.free.reduce((n, s) => n + s.wilds, 0)),
      );
      assert.deepEqual(
        shown,
        round.free.at(-1)?.grid ?? round.base.grid,
        `${fixture.id}: final board`,
      );
      assert.equal(
        JSON.stringify(round),
        before,
        `${fixture.id}: immutable script`,
      );
      passed++;
    }
  }
  const summary = featureSummary(fixture.script);
  assert.equal(summary.feature, fixture.script.free.length > 0);
  assert.equal(summary.payout, fixture.script.payout);
  assert.equal(summary.chargeOnContinue, 0);
  assert.equal(summary.creditOnContinue, 0);
  assert.equal(summary.returnMode, "spin");
  assert.equal(summary.celebrate, fixture.script.payout > fixture.script.cost);
  if (fixture.script.mode === "buy" || fixture.script.mode === "chopper")
    assert.equal(summary.purchaseCost, fixture.script.cost);
  else assert.equal(summary.purchaseCost, null);
}
const armed = spinControl({
  ready: true,
  busy: false,
  summary: false,
  mode: "chopper",
  cost: 250000,
});
assert.equal(armed.label, "BUY 250,000");
assert.equal(armed.purchase, true);
const after = spinControl({
  ready: true,
  busy: false,
  summary: true,
  mode: "chopper",
  cost: 250000,
});
assert.equal(after.label, "SPIN");
assert.equal(after.purchase, false);
const skipped = spinControl({
  ready: true,
  busy: true,
  summary: false,
  mode: "buy",
  cost: 100000,
});
assert.equal(skipped.label, "SKIP");
assert.equal(skipped.purchase, false);
const returned = spinControl({
  ready: true,
  busy: false,
  summary: false,
  mode: "spin",
  cost: 1000,
});
assert.equal(returned.label, "SPIN");
assert.equal(returned.purchase, false);
const shares = collectionShares([2, 5, 10], 10000, 2);
assert.equal(shares.length, 2);
assert.equal(
  shares.flat().reduce((n, v) => n + v, 0),
  10000,
  "collection shares sum to the capped award",
);
assert.equal(
  shares[0].reduce((n, v) => n + v, 0),
  5000,
);
assert.equal(
  shares[1].reduce((n, v) => n + v, 0),
  5000,
);
const hookRound = fixtures.find(
  (fixture) => fixture.id === "hook-upgrade",
).script;
const order = [];
await presentScript(
  {
    setStake() {},
    setPace() {},
    setMood() {},
    setCopy() {},
    setTally() {},
    setMeter() {},
    setLocks() {},
    spinTo: async () => {
      order.push("spin");
    },
    show() {},
    highlight: async () => {
      order.push("line");
    },
    tool: async (spin) => {
      order.push(spin.tool);
    },
    intro: async () => {
      order.push("entry");
    },
    retrigger: async () => {
      order.push("upgrade");
    },
    finishPlate() {},
    collect: async () => {
      order.push("collect");
    },
    deliverCollectors: async (count) => {
      order.push(`meter:${count}`);
    },
  },
  hookRound,
  { turbo: true, reduced: true, skipped: () => false },
);
const firstHook = order.indexOf("hook");
assert.ok(order.indexOf("entry") < firstHook, "entry before the hook");
assert.deepEqual(order.slice(firstHook, firstHook + 5), [
  "hook",
  "line",
  "collect",
  "meter:1",
  "spin",
]);
const secondHook = order.indexOf("hook", firstHook + 1);
assert.deepEqual(order.slice(secondHook, secondHook + 4), [
  "hook",
  "collect",
  "meter:1",
  "upgrade",
]);
assert.ok(order.includes("meter:2"), "two collectors transfer together");
const buy = featureSummary(
  fixtures.find((fixture) => fixture.id === "buy").script,
);
assert.equal(buy.celebrate, false);
assert.equal(buy.purchaseCost, 100000);
const chopper = featureSummary(
  fixtures.find((fixture) => fixture.id === "chopper").script,
);
assert.equal(chopper.celebrate, false);
assert.equal(chopper.purchaseCost, 250000);
const natural = featureSummary(
  fixtures.find((fixture) => fixture.id === "natural").script,
);
assert.equal(natural.celebrate, true);
assert.equal(natural.purchaseCost, null);
console.log(
  `PASS: ${passed} fixture/skip/speed cases across ${fixtures.length} saved rounds and three speed profiles.`,
);
console.log(
  "Verified totals, cap, final boards, collector timing, remaining-spin timing and script immutability.",
);

const engineHash = createHash("sha256")
  .update(readFileSync(new URL("../src/lib/kilo/engine.ts", import.meta.url)))
  .digest("hex");
const bankHash = createHash("sha256")
  .update(readFileSync(new URL("../src/lib/kilo/bank.ts", import.meta.url)))
  .digest("hex");
assert.equal(
  engineHash,
  "7f858c685015593c6938b86808c2e628cce1c3aa459ab7d6fe22f5e6955c9add",
);
assert.equal(
  bankHash,
  "445eec53123b54010fd0ded7b085bc6a04b8fefd11b1fc9a89f3c80b4af30504",
);

const small = fixtures.find((fixture) => fixture.id === "small-line").script;
assert.equal(small.payout, 200);
assert.equal(small.base.lines.length, 1);
assert.deepEqual(winningCells(small.base.lines[0]), [
  { reel: 0, row: 2 },
  { reel: 1, row: 1 },
  { reel: 2, row: 0 },
]);
assert.equal(small.base.lines[0].pay, 200);
assert.equal(small.base.lines[0].s, "10");
assert.equal(small.base.lines[0].n, 3);

const groups = groupRounds(fixtures);
const hookGroup = groups.find((group) => group.id === "hook-upgrade");
assert.deepEqual(hookGroup.aliases.map((alias) => alias.id).sort(), [
  "meter-4",
  "multi-collect",
  "tool-hook",
]);
assert.equal(
  groups.filter((group) => group.id === "tool-hook").length,
  0,
  "aliases are not listed as their own rounds",
);
assert.deepEqual(
  hookGroup.previews.map((preview) => preview.kind),
  ["hook", "collectors", "upgrade"],
);
const dynamite = groups.find((group) => group.id === "tool-dynamite");
assert.equal(dynamite.previews[0].kind, "dynamite");
assert.equal(dynamite.previews[0].spinIndex, 9);
const bazooka = groups.find((group) => group.id === "tool-bazooka");
assert.equal(bazooka.previews[0].kind, "bazooka");
assert.equal(bazooka.previews[0].spinIndex, 16);

const pair = findPairCollection(fixtures);
assert.equal(pair.fixtureId, "tool-bazooka");
assert.equal(pair.spinIndex, 15);
const pairRound = fixtures.find(
  (fixture) => fixture.id === pair.fixtureId,
).script;
const pairSpin = pairRound.free[pair.spinIndex];
const pairLedger = ledgerBefore(pairRound, pair.spinIndex);
const pairFingerprint = JSON.stringify(pairRound);
const pairCalls = [];
let pairHud = null;
await presentSettledCollection(
  {
    setStake(stake) {
      pairCalls.push(`stake:${stake}`);
    },
    setPace() {},
    setMood() {},
    setCopy() {},
    setTally() {},
    setMeter() {},
    setLocks() {},
    spinTo: async () => pairCalls.push("spin"),
    show(grid) {
      pairCalls.push("show");
      assert.equal(grid, pairSpin.grid);
    },
    highlight: async () => pairCalls.push("line"),
    tool: async () => pairCalls.push("tool"),
    intro: async () => pairCalls.push("entry"),
    finishPlate() {},
    collect: async (spin) => pairCalls.push(`collect:${spin.got}`),
    deliverCollectors: async (count, onLand) => {
      pairCalls.push(`deliver:${count}`);
      for (let i = 0; i < count; i++) await onLand?.(i);
    },
    retrigger: async (extra, nextMult, onAward) => {
      pairCalls.push(`upgrade:${extra}:${nextMult}`);
      onAward?.();
    },
  },
  pairRound,
  pair.spinIndex,
  {
    turbo: false,
    reduced: true,
    skipped: () => false,
    onHud: (hud) => {
      pairHud = hud;
    },
  },
);
assert.equal(JSON.stringify(pairRound), pairFingerprint);
assert.equal(pairCalls[0], "stake:" + pairRound.stake);
assert.equal(pairCalls.includes("spin"), false);
assert.equal(pairCalls.includes("entry"), false);
assert.equal(pairCalls.includes("collect:" + pairSpin.got), true);
assert.ok(
  pairCalls.indexOf("show") < pairCalls.indexOf("collect:" + pairSpin.got),
);
assert.ok(
  pairCalls.indexOf("collect:" + pairSpin.got) <
    pairCalls.indexOf("deliver:" + pairSpin.wilds),
);
assert.ok(
  pairCalls.indexOf("deliver:" + pairSpin.wilds) <
    pairCalls.indexOf(
      "upgrade:" +
        pairSpin.extra +
        ":" +
        collectMult(pairLedger.wilds + pairSpin.wilds),
    ),
);
assert.equal(
  pairHud.bonusWin,
  pairLedger.line -
    pairRound.base.lines.reduce((n, line) => n + line.pay, 0) +
    pairLedger.collect +
    pairSpin.got,
);
assert.equal(pairHud.left, pairSpin.left);
assert.equal(pairHud.mult, collectMult(pairLedger.wilds + pairSpin.wilds));

const capped = groups.find((group) => group.id === "capped-ante");
assert.equal(capped.previews[0].kind, "capped");
assert.equal(capped.previews[0].spinIndex, 25);

const hookPreview = hookGroup.previews.find(
  (preview) => preview.kind === "hook",
);
const hookLedger = ledgerBefore(hookRound, hookPreview.spinIndex);
assert.equal(hookLedger.wilds, 0);
assert.equal(hookLedger.total, 5000);
assert.equal(hookLedger.mult, 1);

async function playPreview(preview, script) {
  const fingerprint = JSON.stringify(script);
  const calls = [];
  let hud = null;
  let shown = null;
  await presentEventPreview(
    {
      setStake() {},
      setPace() {},
      setMood() {},
      setCopy(text) {
        calls.push(`copy:${text}`);
      },
      setTally() {},
      setMeter(wilds, _feature, left) {
        calls.push(`meter:${wilds}:${left}`);
      },
      setLocks() {},
      spinTo: async () => {
        calls.push("spin");
      },
      show(grid) {
        shown = grid;
        calls.push("show");
      },
      highlight: async () => {
        calls.push("line");
      },
      tool: async (spin) => {
        calls.push(`tool:${spin.tool}`);
        shown = spin.grid;
      },
      intro: async () => {
        calls.push("entry");
      },
      retrigger: async (extra, nextMult, onAward) => {
        calls.push(`upgrade:${extra}:${nextMult}`);
        onAward?.();
      },
      finishPlate() {},
      collect: async (spin) => {
        calls.push(`collect:${spin.got}`);
      },
      deliverCollectors: async (count, onLand) => {
        calls.push(`deliver:${count}`);
        for (let i = 0; i < count; i++) await onLand?.(i);
      },
    },
    script,
    preview,
    {
      turbo: false,
      reduced: true,
      skipped: () => false,
      onHud(next) {
        hud = next;
      },
    },
  );
  assert.equal(
    JSON.stringify(script),
    fingerprint,
    `${preview.kind}: immutable`,
  );
  assert.equal(
    calls.includes("spin"),
    false,
    `${preview.kind}: does not walk the feature`,
  );
  assert.equal(
    calls.includes("entry"),
    false,
    `${preview.kind}: does not open a purchase`,
  );
  return { calls, hud, shown };
}

const hookPlay = await playPreview(hookPreview, hookRound);
assert.deepEqual(
  hookPlay.calls.filter((call) => call.startsWith("tool")),
  ["tool:hook"],
);
assert.equal(hookPlay.calls[0], "show");
assert.equal(hookPlay.hud.wilds, 0);
assert.equal(hookPlay.hud.total, 5000);
assert.equal(hookPlay.hud.mult, 1);
assert.equal(hookPlay.hud.note, "Event preview — no balance changes.");

const collectPreview = hookGroup.previews.find(
  (preview) => preview.kind === "collectors",
);
const collectPlay = await playPreview(collectPreview, hookRound);
assert.deepEqual(
  collectPlay.calls.filter((call) => call.startsWith("collect")),
  ["collect:10000"],
);
assert.equal(collectPlay.hud.total, 20600);
assert.equal(collectPlay.hud.mult, 1);

const upgradePreview = hookGroup.previews.find(
  (preview) => preview.kind === "upgrade",
);
const upgradeLedger = ledgerBefore(hookRound, upgradePreview.spinIndex);
assert.equal(upgradeLedger.wilds, 3);
const upgradePlay = await playPreview(upgradePreview, hookRound);
assert.ok(upgradePlay.calls.includes("deliver:1"));
assert.equal(
  upgradePlay.calls.some((call) => call.startsWith("tool:")),
  false,
  "upgrade preview does not replay the hook on that spin",
);
assert.ok(upgradePlay.calls.includes("upgrade:10:2"));
assert.equal(
  upgradePlay.calls.indexOf("deliver:1") <
    upgradePlay.calls.indexOf("upgrade:10:2"),
  true,
);
assert.equal(upgradePlay.hud.wilds, 4);
assert.equal(upgradePlay.hud.left, 10);
assert.equal(upgradePlay.hud.mult, 2);

const cappedPlay = await playPreview(
  capped.previews[0],
  fixtures.find((fixture) => fixture.id === "capped-ante").script,
);
assert.ok(cappedPlay.calls.includes("collect:4770000"));
assert.equal(cappedPlay.hud.total, 5000000);
assert.match(cappedPlay.hud.note, /Capped at 5,000,000/);

const dynamitePlay = await playPreview(
  dynamite.previews[0],
  fixtures.find((fixture) => fixture.id === "tool-dynamite").script,
);
assert.deepEqual(
  dynamitePlay.calls.filter((call) => call.startsWith("tool")),
  ["tool:dynamite"],
);
const bazookaPlay = await playPreview(
  bazooka.previews[0],
  fixtures.find((fixture) => fixture.id === "tool-bazooka").script,
);
assert.deepEqual(
  bazookaPlay.calls.filter((call) => call.startsWith("tool")),
  ["tool:bazooka"],
);

let faulted = false;
const faultCalls = [];
try {
  await presentEventPreview(
    {
      setStake() {},
      setPace() {},
      setMood() {},
      setCopy() {},
      setTally() {},
      setMeter() {},
      setLocks() {},
      spinTo: async () => faultCalls.push("spin"),
      show() {
        faultCalls.push("show");
      },
      highlight: async () => faultCalls.push("line"),
      tool: async () => faultCalls.push("tool"),
      intro: async () => faultCalls.push("entry"),
      retrigger: async () => faultCalls.push("upgrade"),
      finishPlate() {},
      collect: async () => faultCalls.push("collect"),
      deliverCollectors: async () => faultCalls.push("deliver"),
      armPreview(kind) {
        faultCalls.push(`board:${kind}`);
      },
    },
    hookRound,
    hookPreview,
    {
      turbo: false,
      reduced: true,
      skipped: () => false,
      fault: () => true,
    },
  );
} catch (error) {
  faulted = true;
  assert.match(error.message, /event preview failed/);
}
assert.equal(faulted, true, "fault stops the preview");
assert.deepEqual(faultCalls, ["show", "board:hook"]);
assert.equal(
  JSON.stringify(hookRound),
  JSON.stringify(
    fixtures.find((fixture) => fixture.id === "hook-upgrade").script,
  ),
);

const meter8 = fixtures.find((fixture) => fixture.id === "meter-8").script;
assert.equal(meter8.free[0].lines.length, 2);
assert.deepEqual(
  meter8.free[0].lines.map((line) => line.pay),
  [200, 200],
);
assert.deepEqual(winningCells(meter8.free[0].lines[0]), [
  { reel: 0, row: 1 },
  { reel: 1, row: 1 },
  { reel: 2, row: 1 },
]);
assert.deepEqual(winningCells(meter8.free[0].lines[1]), [
  { reel: 0, row: 2 },
  { reel: 1, row: 1 },
  { reel: 2, row: 0 },
]);
console.log(
  "Verified payline cells, duplicate grouping, and event-preview restoration.",
);

const stageSource = readFileSync(
  new URL("../src/components/kilo/pixiStage.ts", import.meta.url),
  "utf8",
);
assert.equal(stageSource.includes("BONUS TOTAL"), false);
assert.equal(stageSource.includes('"COLLECTED"'), false);
assert.ok(stageSource.includes('"BEFORE CAP"'));
assert.ok(stageSource.includes('"MAX WIN REACHED"'));

const bazookaRound = fixtures.find(
  (fixture) => fixture.id === "tool-bazooka",
).script;
const bazookaBefore = JSON.stringify(bazookaRound);

function meterSnap(hud, extra = {}) {
  return {
    mult: hud.mult,
    wilds: hud.wilds,
    filled: hud.filled,
    holding: hud.holding,
    maxed: hud.maxed,
    nextMult: hud.nextMult,
    left: hud.left,
    ...extra,
  };
}

async function playBazooka(opts) {
  const states = [];
  let hud = null;
  let spinIndex = -1;
  let captureAdvance = false;
  const watch = new Set([15, 16, 20]);
  const scene = {
    setStake() {},
    setPace() {},
    setMood() {},
    setCopy() {},
    setTally() {},
    setMeter() {},
    setLocks() {},
    spinTo: async () => {},
    show() {},
    highlight: async () => {},
    tool: async () => {},
    intro: async () => {},
    finishPlate() {},
    collect: async (spin) => {
      if (!watch.has(spinIndex)) return;
      states.push({
        at: "collect",
        spinIndex,
        got: spin.got,
        spinMult: spin.mult,
        ...meterSnap(hud),
      });
    },
    deliverCollectors: async (count, onLand) => {
      for (let index = 0; index < count; index++) {
        await onLand?.(index);
        if (!watch.has(spinIndex)) continue;
        states.push({
          at: "deliver",
          spinIndex,
          index,
          ...meterSnap(hud),
        });
      }
    },
    retrigger: async (extra, nextMult, onAward) => {
      if (watch.has(spinIndex)) {
        states.push({
          at: "before-award",
          spinIndex,
          extra,
          announced: nextMult,
          note: hud.note,
          ...meterSnap(hud),
        });
      }
      onAward?.();
      if (watch.has(spinIndex)) {
        states.push({
          at: "on-award",
          spinIndex,
          extra,
          announced: nextMult,
          note: hud.note,
          ...meterSnap(hud),
        });
        captureAdvance = true;
      }
    },
  };
  await presentScript(scene, bazookaRound, {
    ...opts,
    onHud(next) {
      hud = next;
      if (next.note === "Free spin") {
        spinIndex += 1;
        if (watch.has(spinIndex)) {
          states.push({ at: "free-spin", spinIndex, ...meterSnap(next) });
        }
      }
      if (captureAdvance) {
        states.push({
          at: "after-award",
          spinIndex,
          note: next.note,
          ...meterSnap(next),
        });
        captureAdvance = false;
      }
    },
  });
  return { states, hud };
}

function assertOvershoot(states) {
  const at = (name, spinIndex, index) =>
    states.find(
      (state) =>
        state.at === name &&
        state.spinIndex === spinIndex &&
        (index == null || state.index === index),
    );
  const free15 = at("free-spin", 15);
  assert.deepEqual(
    [free15.wilds, free15.mult, free15.filled, free15.holding, free15.left],
    [7, 2, 3, false, 5],
    "spin 15 opens on the ×2 set, three sockets filled",
  );
  const eighth = at("deliver", 15, 0);
  assert.deepEqual(
    [eighth.wilds, eighth.mult, eighth.filled, eighth.holding, eighth.nextMult],
    [8, 2, 4, true, 3],
    "eighth collector completes the set and holds ×2",
  );
  const ninth = at("deliver", 15, 1);
  assert.deepEqual(
    [ninth.wilds, ninth.mult, ninth.filled, ninth.holding],
    [9, 2, 4, true],
    "ninth collector does not open the next set before the announcement",
  );
  const before = at("before-award", 15);
  assert.equal(before.extra, 10);
  assert.equal(before.announced, 3);
  assert.deepEqual(
    [before.wilds, before.mult, before.filled, before.holding, before.left],
    [9, 2, 4, true, 4],
    "before retrigger awards spins, the meter is still the completed ×2 set",
  );
  const awarded = at("on-award", 15);
  assert.equal(awarded.note, "+10 spins · next collection ×3");
  assert.deepEqual(
    [
      awarded.wilds,
      awarded.mult,
      awarded.filled,
      awarded.holding,
      awarded.left,
    ],
    [9, 2, 4, true, 14],
    "announcement keeps ×2 and then shows 14 spins remaining",
  );
  const after = at("after-award", 15);
  assert.deepEqual(
    [
      after.wilds,
      after.mult,
      after.filled,
      after.holding,
      after.maxed,
      after.left,
    ],
    [9, 3, 1, false, false, 14],
    "after the announcement the extra collector is the first socket at ×3",
  );
  const free16 = at("free-spin", 16);
  assert.deepEqual(
    [free16.wilds, free16.mult, free16.filled, free16.holding, free16.left],
    [9, 3, 1, false, 14],
    "the following spin keeps that one carried collector",
  );
  const collect16 = at("collect", 16);
  assert.equal(collect16.spinMult, 3);
  assert.equal(collect16.mult, 3);
  assert.equal(collect16.got, 36000);
  assert.equal(collect16.wilds, 9);
  const tenth = at("deliver", 16, 0);
  const eleventh = at("deliver", 16, 1);
  assert.deepEqual(
    [tenth.wilds, tenth.filled, tenth.mult, tenth.holding],
    [10, 2, 3, false],
  );
  assert.deepEqual(
    [eleventh.wilds, eleventh.filled, eleventh.mult, eleventh.holding],
    [11, 3, 3, false],
    "later collectors continue from 9, without a second copy of the ninth",
  );
  const free20 = at("free-spin", 20);
  assert.deepEqual(
    [free20.wilds, free20.mult, free20.filled, free20.holding],
    [11, 3, 3, false],
  );
  const twelfth = at("deliver", 20, 0);
  assert.deepEqual(
    [
      twelfth.wilds,
      twelfth.mult,
      twelfth.filled,
      twelfth.holding,
      twelfth.nextMult,
    ],
    [12, 3, 4, true, 10],
    "entry into ×10 holds the completed set at ×3",
  );
  const beforeMax = at("before-award", 20);
  assert.equal(beforeMax.announced, 10);
  assert.equal(beforeMax.mult, 3);
  assert.equal(beforeMax.holding, true);
  assert.equal(beforeMax.filled, 4);
  const onMax = at("on-award", 20);
  assert.equal(onMax.mult, 3);
  assert.equal(onMax.holding, true);
  assert.equal(onMax.left, bazookaRound.free[20].left);
  assert.match(onMax.note, /next collection ×10/);
  const afterMax = at("after-award", 20);
  assert.deepEqual(
    [
      afterMax.wilds,
      afterMax.mult,
      afterMax.filled,
      afterMax.holding,
      afterMax.maxed,
    ],
    [12, 10, 4, false, true],
    "×10 replaces ×3 only after the announcement",
  );
}

const reducedPlay = await playBazooka({
  turbo: false,
  reduced: true,
  skipped: () => false,
});
assertOvershoot(reducedPlay.states);
assert.equal(reducedPlay.hud.total, bazookaRound.payout);
const turboPlay = await playBazooka({
  turbo: true,
  reduced: false,
  skipped: () => false,
});
assert.deepEqual(turboPlay.states, reducedPlay.states);
const normalPlay = await playBazooka({
  turbo: false,
  reduced: false,
  skipped: () => false,
});
assert.deepEqual(normalPlay.states, reducedPlay.states);
const skipPlay = await playBazooka({
  turbo: false,
  reduced: false,
  skipped: () => true,
});
const bazookaWilds = bazookaRound.free.reduce((n, spin) => n + spin.wilds, 0);
assert.equal(skipPlay.hud.total, bazookaRound.payout);
assert.equal(skipPlay.hud.wilds, bazookaWilds);
assert.equal(skipPlay.hud.mult, collectMult(bazookaWilds));
assert.equal(skipPlay.hud.maxed, true);
assert.equal(
  skipPlay.states.some((state) => state.at === "before-award"),
  false,
  "skip does not play the retrigger ceremony",
);
assert.equal(JSON.stringify(bazookaRound), bazookaBefore);
console.log("Bazooka threshold states checked:");
for (const state of reducedPlay.states) {
  if (state.spinIndex === 16 && state.at === "deliver") continue;
  console.log(
    `  spin ${state.spinIndex} ${state.at}${state.index == null ? "" : `#${state.index}`}: wilds ${state.wilds}, filled ${state.filled}, ×${state.mult}, holding ${state.holding}, left ${state.left}`,
  );
}
