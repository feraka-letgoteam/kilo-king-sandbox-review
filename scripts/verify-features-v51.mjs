import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import { execFileSync } from "node:child_process";
import ts from "typescript";
registerHooks({
  resolve(s, c, next) {
    return next(
      s.startsWith("@/")
        ? new URL(`../src/${s.slice(2)}.ts`, import.meta.url).href
        : s,
      c,
    );
  },
});
let clock = 0;
Object.defineProperty(globalThis, "performance", {
  value: { now: () => clock },
  configurable: true,
});
globalThis.window = Object.assign(new EventTarget(), {
  setTimeout: (fn, ms) => {
    clock += ms;
    queueMicrotask(fn);
    return 0;
  },
  matchMedia: () => ({ matches: true }),
});
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({ sprites: {} }),
});
const storage = () => {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
};
globalThis.localStorage = storage();
globalThis.sessionStorage = storage();
const {
  playSplash,
  playLegacySplash,
  splashCost,
  splashStakeOk,
  splashRoundCap,
  SPLASH_MAX_MULT,
  SPLASH_MODE_MAX_MULT,
  collectMult,
  isPurchaseMode,
} = await import("../src/lib/kilo/engine.ts");
const { FEATURE_PROFILE, cargoAt, runCargoFeature } =
  await import("../src/lib/kilo/feature-math.ts");
const { presentScript, finalHud } =
  await import("../src/components/kilo/director.ts");
const { purchaseQuote } =
  await import("../src/components/kilo/control-model.ts");
const { sceneForRound } =
  await import("../src/components/kilo/scene-system.ts");
const bank = await import("../src/lib/kilo/bank.ts");
export function seeded(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let checks = 0;
const check = (condition, message) => {
  assert(condition, message);
  checks++;
};
const modes = ["spin", "ante", "buy", "yacht", "chopper", "getaway"];
const sum = (a) => a.reduce((n, x) => n + x, 0);
const examples = {};
let marked = 0,
  baseCollect = 0,
  natural = new Set(),
  capModes = new Set();
for (const mode of modes) {
  check(splashStakeOk(1000, mode), "valid affordable charge");
  check(
    !splashStakeOk(99, mode) && !splashStakeOk(1000.5, mode),
    "invalid stake rejected",
  );
  check(
    purchaseQuote(1000, mode, splashCost(1000, mode)).allowed,
    "exact available balance allowed",
  );
  check(
    !purchaseQuote(1000, mode, splashCost(1000, mode) - 1).allowed,
    "insufficient balance rejected",
  );
  for (let seed = 1; seed <= 3000; seed++) {
    const round = playSplash(1000, mode, seeded(seed)),
      before = JSON.stringify(round);
    if (seed < 5)
      check(
        JSON.stringify(playSplash(1000, mode, seeded(seed))) === before,
        "seeded replay deterministic",
      );
    const ledger =
      sum(round.base.lines.map((l) => l.pay)) +
      round.base.scatterPay +
      (round.base.collect?.got ?? 0) +
      sum(round.free.map((s) => s.got + sum(s.lines.map((l) => l.pay))));
    check(
      round.payout === ledger && Number.isInteger(ledger),
      "ledger equals recorded payout",
    );
    check(
      round.payout <= splashRoundCap(round.stake, mode) && round.payout >= 0,
      "round cap",
    );
    check(round.cost === splashCost(1000, mode), "one declared cost");
    if (round.capped) capModes.add(mode);
    if (round.feature && !isPurchaseMode(mode)) natural.add(round.feature);
    if (!examples[mode] && round.free.length) examples[mode] = round;
    if (round.base.collect) {
      baseCollect++;
      check(!round.free.length, "base collect is separate from feature");
      check(
        round.base.grid.flat().filter((c) => c.s === "splash").length === 1,
        "one base collector",
      );
      check(
        round.base.collect.beforeCap ===
          sum(cargoAt(round.base.grid, 1000).map((c) => c.value)),
        "visible base cargo exact",
      );
    }
    let previous = null,
      seenPaid = new Set(),
      wilds = round.banked,
      remaining = round.awarded;
    for (const spin of round.free) {
      const e = spin.mechanic;
      check(!!e, "every new feature has an event");
      check(
        spin.got === e.credited && e.credited <= e.beforeCap,
        "raw and credited awards separated",
      );
      check(
        spin.left >= 0 && Number.isInteger(spin.left),
        "finite remaining count",
      );
      if (e.kind === "dock") {
        check(
          spin.mult === collectMult(wilds),
          "pre-spin collector multiplier",
        );
        wilds += spin.wilds;
        check(
          spin.left ===
            (round.capped && spin === round.free.at(-1)
              ? 0
              : remaining - 1 + spin.extra),
          "remaining spins include retriggers once",
        );
        remaining = spin.left;
        if (e.heldBefore.length) {
          marked++;
          check(
            previous?.heldAfter[0]?.id === e.heldBefore[0].id,
            "marked cargo continuity",
          );
          const h = e.heldBefore[0],
            cell = spin.grid[h.reel][h.row];
          check(
            cell.id === h.id && cell.v * 1000 === h.value,
            "reserved cell and value unchanged",
          );
          check(
            !e.heldAfter.some((c) => c.id === h.id),
            "same package cannot carry twice",
          );
        }
        if (e.heldAfter.length)
          check(
            !spin.wilds && spin.left > 0,
            "only a noncollected package may carry",
          );
      } else if (e.kind === "yacht") {
        check(
          spin.lines.length === 0 && e.heldAfter.length <= 12,
          "cargo-only yacht with twelve holds",
        );
        for (const c of e.heldBefore)
          check(
            spin.grid[c.reel][c.row].id === c.id,
            "locked cargo cannot be overwritten",
          );
        check(
          e.sources.every((c) => c.reel < 4),
          "dispatch reel remains open",
        );
        if (e.action === "shipment") {
          check(
            e.beforeCap === sum(e.sources.map((c) => c.value)),
            "shipment pays whole load once",
          );
          for (const c of e.sources) {
            check(!seenPaid.has(c.id), "cargo cannot ship twice");
            seenPaid.add(c.id);
          }
          check(!e.heldAfter.length, "holds clear after shipment");
        }
        if (previous)
          check(
            e.heldBefore.length === previous.heldAfter.length,
            "hold continuity",
          );
        if (spin.left === 0)
          check(e.pendingAfter === 0, "last spin ships remaining cargo");
      } else if (e.kind === "route") {
        check(spin.lines.length === 0, "route is cargo-only");
        check(
          e.sources.every((c) => c.reel === e.route),
          "only active column is collected",
        );
        const expected = sum(
          cargoAt(spin.grid, 1000)
            .filter((c) => c.reel === e.route)
            .map((c) => c.value),
        );
        check(
          expected === sum(e.sources.map((c) => c.value)),
          "all cargo in active column is collected",
        );
        const oldMult = previous?.nextMultiplier ?? 1;
        check(
          e.multiplier === Math.min(5, oldMult + (e.sources.length ? 1 : 0)),
          "only nonempty stops raise multiplier",
        );
        if (e.action === "delivery")
          check(
            e.beforeCap === (e.pendingBefore + expected) * e.multiplier &&
              e.pendingAfter === 0 &&
              e.nextMultiplier === 1 &&
              e.nextRoute === 0,
            "route delivery and reset",
          );
        else
          check(
            e.credited === 0 && e.pendingAfter === e.pendingBefore + expected,
            "pending cargo is not early credit",
          );
      } else {
        check(
          spin.lines.length === 0 && e.casesAfter.length === 3,
          "three cases; no line awards",
        );
        if (e.action === "checkpoint")
          e.casesAfter.forEach((v, i) =>
            check(
              v === e.casesBefore[i] * (i === e.targetCase ? 2 : 1),
              "exactly one selected case doubles",
            ),
          );
        if (e.action === "extract")
          check(
            e.beforeCap === sum(e.casesAfter) * e.multiplier,
            "extraction multiplies whole haul",
          );
        else check(e.credited === 0, "Getaway pays only at extraction");
      }
      previous = e;
    }
    check(
      JSON.stringify(round) === before,
      "verification does not mutate records",
    );
  }
}
check(
  marked > 0 && baseCollect > 0,
  "generated marked cargo and base collections observed",
);
for (const mode of ["buy", "yacht", "chopper", "getaway"]) {
  const maxBet = Math.floor(1_000_000 / splashCost(1, mode));
  check(splashStakeOk(maxBet, mode), "exact purchase limit allowed");
  check(
    !purchaseQuote(maxBet + 1, mode, 100_000_000).allowed,
    "genuine over-limit purchase rejected",
  );
}
check(
  examples.getaway.payout < splashRoundCap(examples.getaway.stake, "getaway"),
  "Getaway does not guarantee a cap",
);
const maximumHeist = runCargoFeature("getaway", 1000, () => 0.999999, splashRoundCap(1000,"getaway"));
check(maximumHeist.capped && maximumHeist.total === 25_000_000,
  "production Getaway logic reaches 25,000x");
check(maximumHeist.free.at(-1).mechanic.beforeCap === 50_000_000,
  "50,000x raw extraction is separately capped to 25,000x");
check(
  sceneForRound(examples.yacht) === "scatter-4" &&
    sceneForRound(examples.chopper) === "chopper" &&
    sceneForRound(examples.getaway) === "max-win",
  "actual mode environments selected",
);

// The same RNG stream must produce the same base-bet multiplier at every legal
// stake. An absolute currency ceiling would break this at the higher stakes.
let scaledRounds = 0;
let highWin;
for (const mode of modes) {
  const highStake = Math.min(100_000, Math.floor(1_000_000 / splashCost(1, mode)));
  check(splashRoundCap(highStake,mode) === highStake * SPLASH_MODE_MAX_MULT[mode], "bet-relative mode maximum");
  for (let seed = 1; seed <= 1000; seed++) {
    const low = playSplash(100, mode, seeded(seed));
    const high = playSplash(highStake, mode, seeded(seed));
    check(low.payout * highStake === high.payout * 100, "payout scales with base bet");
    check(low.cost * highStake === high.cost * 100, "charge scales with base bet");
    check(low.capped === high.capped && low.free.length === high.free.length,
      "cap timing and feature duration are currency independent");
    for (let i = 0; i < low.free.length; i++) {
      check(low.free[i].got * highStake === high.free[i].got * 100,
        "each credited collection scales");
      const a = low.free[i].mechanic, b = high.free[i].mechanic;
      if (a && b) {
        check(a.beforeCap * highStake === b.beforeCap * 100,
          "uncapped award scales independently of credited award");
        check(a.action === b.action && a.multiplier === b.multiplier,
          "mechanic progression is stake independent");
      }
    }
    if (!highWin && high.payout > 5_000_000) highWin = high;
    scaledRounds += 2;
  }
}
check(!!highWin, "a real generated legal round pays above the former absolute ceiling");
check(highWin.payout <= splashRoundCap(highWin.stake), "large win obeys declared multiplier maximum");

// Constrained remaining allowance exercises caps in every new cargo mode.
for(const kind of ['yacht','route','getaway']) {
  const result=runCargoFeature(kind,1000,seeded(197),500);
  check(result.capped&&result.total===500,'partial allowance is credited exactly');
  check(result.free.at(-1).left===0,'cap ends remaining feature actions');
  const e=result.free.at(-1).mechanic;
  check(e.beforeCap>e.credited&&e.credited===500,'raw cargo remains distinct from capped credit');
}

// Preserve old saved rounds and legacy outcome generation, including tool/hook ordering.
const old = execFileSync("git", ["show", "19139a6:src/lib/kilo/engine.ts"], {
    encoding: "utf8",
  }),
  oldExports = {};
new Function(
  "exports",
  ts.transpile(old, {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  }),
)(oldExports);
for (const stake of [1000,10000])
for (const mode of ["spin", "ante", "buy", "chopper"])
  for (let seed = 1; seed <= 80; seed++)
    check(
      JSON.stringify(playLegacySplash(stake, mode, seeded(seed))) ===
        JSON.stringify(oldExports.playSplash(stake, mode, seeded(seed))),
      "legacy generator preserved",
    );

// Real director with an instrumented scene: all speeds, reduced motion, interruption at each event.
let presentations = 0;
for (const mode of ["buy", "yacht", "chopper", "getaway"])
  for (const speed of ["normal", "turbo", "super"])
    for (const reduced of [false, true]) {
      const round = examples[mode];
      for (const skipAt of [
        Infinity,
        ...Array.from({ length: round.free.length + 3 }, (_, i) => i + 1),
      ]) {
        const before = JSON.stringify(round);
        let count = 0,
          hud,
          shown,
          state;
        const tick = async () => {
          count++;
        };
        const scene = {
          setStake() {},
          setPace(t, r, s) {
            check(
              r === reduced && s === speed,
              "speed and reduced-motion forwarded",
            );
          },
          setMood() {},
          setCopy() {},
          setTally() {},
          setMeter() {},
          setLocks() {},
          setFeatureState(e) {
            state = e;
          },
          show(g) {
            shown = g;
          },
          spinTo: async (g) => {
            shown = g;
            await tick();
          },
          highlight: async (lines, fn) => {
            lines.forEach((l, i) => fn?.(l, i));
            await tick();
          },
          collect: tick,
          tool: tick,
          intro: tick,
          featureIntro: tick,
          featureStep: async (e) => {
            check(hud.total <= round.payout, "presentation never overcredits");
            if(e.kind!=="dock") {
              check(hud.mechanic.credited===0&&hud.mechanic.pendingAfter===e.pendingBefore,'before-animation HUD contains no future award');
              check(JSON.stringify(hud.mechanic.heldAfter)===JSON.stringify(e.heldBefore),'new yacht holds are not announced before landing');
            }
            await tick();
          },
          retrigger: async (a, m, fn) => {
            fn?.();
            await tick();
          },
          finishPlate() {},
        };
        await presentScript(scene, round, {
          speed,
          turbo: speed !== "normal",
          reduced,
          skipped: () => count >= skipAt,
          onHud: (h) => (hud = h),
        });
        check(
          hud.total === round.payout && hud.left === 0,
          "full and skipped presentations finish at recorded ledger",
        );
        check(
          JSON.stringify(round) === before,
          "director leaves script immutable",
        );
        presentations++;
      }
      const end = finalHud(round);
      check(end.total === round.payout, "recovery HUD reconciles");
    }

// The unchanged sandbox bank debits one declared charge and credits one recorded return.
for (const mode of ["buy", "yacht", "chopper", "getaway"]) {
  const round = examples[mode];
  bank.writeBank(2_000_000);
  check(bank.settle(round.cost, 0).ok, "single debit");
  bank.rememberRound(JSON.stringify({ v: 2, script: round, credited: false }));
  const restored = JSON.parse(bank.recallRound());
  check(restored.script.payout === round.payout, "pending round restores");
  check(bank.settle(0, restored.script.payout).ok, "single credit");
  restored.credited = true;
  bank.rememberRound(JSON.stringify(restored));
  const replay = JSON.parse(bank.recallRound());
  if (!replay.credited) bank.settle(0, replay.script.payout);
  check(
    bank.readBank() === 2_000_000 - round.cost + round.payout,
    "replay does not double-credit",
  );
}
bank.writeBank(highWin.cost);
check(bank.settle(highWin.cost, 0).ok, "large-win charge is debited once");
check(bank.settle(0, highWin.payout).ok && bank.readBank() === highWin.payout,
  "sandbox settlement does not reintroduce a currency ceiling");
fs.mkdirSync("art/kilo-features-v51", { recursive: true });
fs.writeFileSync("art/kilo-features-v51/high-win-example.json", JSON.stringify(highWin,null,2)+"\n");
fs.writeFileSync(
  "art/kilo-features-v51/playable-examples.json",
  JSON.stringify(examples, null, 2) + "\n",
);
const report = {
  checks,
  presentations,
  marked,
  baseCollect,
  natural: [...natural],
  capModes: [...capModes],
  scaledRounds,
  highWin: { mode: highWin.mode, stake: highWin.stake, payout: highWin.payout, maximum: splashRoundCap(highWin.stake,highWin.mode) },
  overallMaximumMultiplier:SPLASH_MAX_MULT,
  maximumHeist:{raw:maximumHeist.free.at(-1).mechanic.beforeCap,credited:maximumHeist.total},
  profile: FEATURE_PROFILE,
  method:
    "Seeded production outcome generator and director with instrumented scene. Not browser/GPU QA.",
};
fs.writeFileSync(
  "art/kilo-features-v51/logic-verification.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  `PASS ${checks} assertions; ${presentations} generated-round presentations; legacy generation and sandbox debit/credit/replay.`,
);
