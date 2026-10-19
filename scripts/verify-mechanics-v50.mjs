import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import {
  advance,
  initialState,
} from "../src/components/kilo/feature-lab/model.ts";
import { concepts } from "../src/components/kilo/feature-lab/examples.ts";
import {
  routineCharacterPose,
  earnedCharacterCelebration,
} from "../src/components/kilo/character-performance.ts";
let checks = 0;
const check = (name, run) => {
  run();
  checks++;
};
const replay = (mode, cap = 500_000) =>
  concepts[mode].steps.reduce(advance, initialState(mode, cap));
const totals = {
  base: 1200,
  dock: 5800,
  yacht: 1100,
  airbridge: 9700,
  getaway: 192000,
};
for (const mode of Object.keys(concepts)) {
  check(`${mode}: example total`, () =>
    assert.equal(replay(mode).total, totals[mode]),
  );
  check(`${mode}: skip / incremental / restore agree`, () => {
    const steps = concepts[mode].steps;
    let s = initialState(mode);
    for (const step of steps) {
      const before = JSON.stringify(s);
      const after = advance(s, step);
      assert.equal(JSON.stringify(s), before);
      s = JSON.parse(JSON.stringify(after));
    }
    assert.deepEqual(s, replay(mode));
  });
  check(`${mode}: events idempotent`, () => {
    let s = initialState(mode);
    for (const step of concepts[mode].steps) {
      s = advance(s, step);
      assert.strictEqual(advance(s, step), s);
    }
  });
  check(`${mode}: capped accounting`, () => {
    let s = initialState(mode, 700),
      credited = 0;
    for (const step of concepts[mode].steps) {
      if (s.ended) break;
      s = advance(s, step);
      for (const a of s.awards) {
        assert(a.credited <= a.beforeCap);
        credited += a.credited;
      }
      assert(s.total <= 700);
    }
    assert.equal(s.total, 700);
    assert.equal(credited, s.total);
  });
  check(`${mode}: no cross-round progression`, () => {
    const previous = replay(mode),
      fresh = initialState(mode);
    previous.cargo.push({ id: "old", cell: 0, value: 999 });
    previous.cases[0] = 999;
    assert.equal(fresh.total, 0);
    assert.equal(fresh.cargo.length, 0);
    assert.equal(fresh.cases[0], 0);
    assert.equal(fresh.processed.length, 0);
  });
}
check("Carry gets exactly one extra opportunity", () => {
  let s = advance(initialState("dock"), concepts.dock.steps[0]);
  assert(s.carry);
  s = advance(s, { id: "empty" });
  assert(!s.carry);
  assert.equal(s.total, 0);
  s = advance(s, { id: "late", collectors: [0] });
  assert.equal(s.total, 0);
});
check("Reserved carry cell cannot be overwritten", () => {
  const s = advance(initialState("dock"), concepts.dock.steps[0]);
  assert.throws(() => advance(s, { id: "collision", collectors: [6] }));
});
check("Exact collection acceptance: 12,000 ×2, two collectors =48,000", () => {
  const s = initialState("dock");
  s.multiplier = 2;
  const result = advance(s, {
    id: "acceptance",
    cash: [
      { id: "a", cell: 1, value: 2000 },
      { id: "b", cell: 8, value: 10000 },
    ],
    collectors: [0, 14],
  });
  assert.equal(result.total, 48000);
  assert.deepEqual(
    result.awards.map((a) => a.credited),
    [24000, 24000],
  );
});
check(
  "Exact acceptance cap: second collector only credits remaining allowance",
  () => {
    const s = initialState("dock", 30000);
    s.multiplier = 2;
    const result = advance(s, {
      id: "cap",
      cash: [
        { id: "a", cell: 1, value: 2000 },
        { id: "b", cell: 8, value: 10000 },
      ],
      collectors: [0, 14],
    });
    assert.equal(result.total, 30000);
    assert.deepEqual(
      result.awards.map((a) => [a.beforeCap, a.credited]),
      [
        [24000, 24000],
        [24000, 6000],
      ],
    );
  },
);
check(
  "Yacht: full holds cannot block dispatch; multiple captains pay once",
  () => {
    const cash = Array.from({ length: 15 }, (_, cell) => ({
      id: `c${cell}`,
      cell,
      value: 100,
    })).filter((p) => p.cell % 5 !== 4);
    let s = advance(initialState("yacht"), { id: "full", cash });
    assert.equal(s.cargo.length, 12);
    s = advance(s, { id: "dispatch", collectors: [4, 9, 14] });
    assert.equal(s.total, 1200);
    assert.equal(s.awards.length, 1);
    assert.equal(s.cargo.length, 0);
  },
);
check("Yacht: locked IDs and positions cannot be replaced", () => {
  const s = advance(initialState("yacht"), concepts.yacht.steps[0]);
  assert.throws(() =>
    advance(s, {
      id: "overwrite",
      cash: [{ id: "new", cell: 0, value: 1000 }],
    }),
  );
  assert.throws(() =>
    advance(s, {
      id: "dispatch-block",
      cash: [{ id: "new", cell: 4, value: 1000 }],
    }),
  );
});
check(
  "Route: only active column collects, empty stop does not grow multiplier",
  () => {
    let s = advance(initialState("airbridge"), concepts.airbridge.steps[0]);
    assert.equal(s.cargo.length, 1);
    assert.equal(s.cargo[0].value, 200);
    s = advance(s, concepts.airbridge.steps[1]);
    s = advance(s, concepts.airbridge.steps[2]);
    assert.equal(s.multiplier, 3);
    assert.equal(s.route, 3);
  },
);
check("Getaway cannot extract before three checkpoints", () => {
  const s = advance(initialState("getaway"), concepts.getaway.steps[0]);
  assert.throws(() => advance(s, { id: "early", extract: 8 }));
});
check("Getaway cap is chance, not guaranteed by mode", () => {
  assert(replay("getaway").total < 500000);
  assert.equal(replay("getaway", 10000).total, 10000);
});
check(
  "Character does not celebrate generic line/settlement cues or losses",
  () => {
    assert.equal(routineCharacterPose("cheer"), null);
    assert.equal(routineCharacterPose("slump"), "idle");
    assert.equal(routineCharacterPose("cast"), "cast");
    assert.equal(
      earnedCharacterCelebration(200, 100, 100, false, false),
      false,
    );
    assert.equal(
      earnedCharacterCelebration(1000, 100, 100, false, false),
      true,
    );
    assert.equal(
      earnedCharacterCelebration(1000, 100, 100, true, false),
      false,
    );
    assert.equal(
      earnedCharacterCelebration(1000, 100, 100, false, true),
      false,
    );
    assert.equal(
      earnedCharacterCelebration(1000, 100, 1000, false, false),
      false,
    );
  },
);
check(
  "Production engine, wallet, controller, geometry and control files unchanged",
  () => {
    const protectedPaths = [
      "public",
      "src/lib/kilo",
      "src/components/slot-controls",
      "src/components/kilo/director.ts",
      "src/components/kilo/layout.ts",
      "src/components/kilo/scene-system.ts",
      "src/components/kilo/integrated-scene-model.ts",
    ];
    const changes = execFileSync(
      "git",
      [
        "diff",
        "--name-only",
        "19821a6acc80ebca225535314550a4801e1b917d",
        "--",
        ...protectedPaths,
      ],
      { encoding: "utf8" },
    ).trim();
    assert.equal(changes, "");
  },
);
check(
  "Prototype has no wallet, random outcome or production engine dependencies",
  () => {
    const source = fs
      .readdirSync("src/components/kilo/feature-lab")
      .filter((f) => /\.tsx?$/.test(f))
      .map((f) =>
        fs.readFileSync("src/components/kilo/feature-lab/" + f, "utf8"),
      )
      .join("\n");
    assert(
      !/from\s*['"][^'"]*(?:engine|bank|wallet)|Math\.random\(|fetch\(/.test(
        source,
      ),
    );
  },
);
check("Every prototype image exists", () => {
  for (const c of Object.values(concepts))
    assert(fs.existsSync(`public/kilo-scenes-v43/${c.scene}.webp`));
  for (const f of [
    "sym-a.webp",
    "sym-j.webp",
    "sym-k.webp",
    "sym-q.webp",
    "sym-10.webp",
    "package-king.webp",
    "package-trophy.webp",
    "package-medium.webp",
    "package-small.webp",
    "collector-idle.png",
  ])
    assert(fs.existsSync("public/kilo-symbols-v47/" + f));
});
fs.writeFileSync(
  "art/kilo-design-v50/mechanics-verification.json",
  JSON.stringify(
    {
      checks,
      exampleTotals: totals,
      method:
        "Deterministic model and protected-source tests. No browser/GPU verification.",
      engineChanged: false,
      mathValidated: false,
      deployed: false,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `PASS ${checks} mechanics, accounting, idempotency, cap, character-policy and source-isolation checks.`,
);
