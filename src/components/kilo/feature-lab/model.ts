/** Isolated design simulator. Integer example credits, no RNG, engine or wallet imports. */
export type Mode = "base" | "dock" | "yacht" | "airbridge" | "getaway";
export type Package = { id: string; cell: number; value: number };
export type Step = {
  id: string;
  title: string;
  cash?: Package[];
  collectors?: number[];
  mark?: string;
  checkpoint?: 0 | 1 | 2;
  extract?: number;
  finish?: boolean;
};
export type Award = {
  reason: string;
  beforeCap: number;
  credited: number;
  formula: string;
};
export type LabState = {
  mode: Mode;
  processed: string[];
  total: number;
  cap: number;
  ended: boolean;
  cash: Package[];
  collectors: number[];
  highlights: number[];
  carry?: Package;
  cargo: Package[];
  portraits: number;
  multiplier: number;
  dispatches: number;
  quality: number;
  route: number;
  routeStops: number;
  cases: number[];
  checkpoints: number;
  phase: "load" | "checkpoints" | "extracted";
  awards: Award[];
  note: string;
};
const sum = (packages: Package[]) => packages.reduce((n, p) => n + p.value, 0);
export const amount = (n: number) => n.toLocaleString("en-US");
export function initialState(mode: Mode, cap = 500_000): LabState {
  if (!Number.isSafeInteger(cap) || cap <= 0) throw new Error("Invalid cap");
  return {
    mode,
    processed: [],
    total: 0,
    cap,
    ended: false,
    cash: [],
    collectors: [],
    highlights: [],
    cargo: [],
    portraits: 0,
    multiplier: 1,
    dispatches: 0,
    quality: 1,
    route: 0,
    routeStops: 0,
    cases: [0, 0, 0],
    checkpoints: 0,
    phase: "load",
    awards: [],
    note: "Step through the fixed example. No bet is placed.",
  };
}
function pay(s: LabState, beforeCap: number, reason: string, formula: string) {
  if (!Number.isSafeInteger(beforeCap) || beforeCap < 0)
    throw new Error("Invalid award");
  const credited = Math.min(beforeCap, s.cap - s.total);
  s.awards.push({ beforeCap, credited, reason, formula });
  s.total += credited;
  if (s.total === s.cap) {
    s.ended = true;
    s.note += " Round cap reached; stop.";
  }
}
function validPackages(packages: Package[]) {
  const ids = new Set<string>(),
    cells = new Set<number>();
  for (const p of packages) {
    if (
      !p.id ||
      ids.has(p.id) ||
      cells.has(p.cell) ||
      !Number.isInteger(p.cell) ||
      p.cell < 0 ||
      p.cell > 14 ||
      !Number.isSafeInteger(p.value) ||
      p.value <= 0
    )
      throw new Error("Invalid package");
    ids.add(p.id);
    cells.add(p.cell);
  }
}
export function advance(previous: LabState, step: Step): LabState {
  // Replaying an already-applied record cannot pay twice. The renderer never creates outcomes.
  if (previous.processed.includes(step.id) || previous.ended) return previous;
  if (!step.id) throw new Error("Missing event ID");
  const cash = structuredClone(step.cash ?? []),
    collectors = [...(step.collectors ?? [])];
  validPackages(cash);
  if (
    new Set(collectors).size !== collectors.length ||
    collectors.some(
      (c) =>
        !Number.isInteger(c) ||
        c < 0 ||
        c > 14 ||
        cash.some((p) => p.cell === c),
    )
  )
    throw new Error("Invalid collector");
  const s: LabState = structuredClone(previous);
  s.processed.push(step.id);
  s.cash = cash;
  s.collectors = collectors;
  s.highlights = [];
  s.awards = [];
  s.note = step.title;
  if (s.mode === "base") {
    if (collectors.length && cash.length) {
      s.highlights = cash.map((p) => p.cell);
      pay(
        s,
        sum(cash),
        "Dockside deal",
        `${cash.map((p) => amount(p.value)).join(" + ")} = ${amount(sum(cash))}`,
      );
      s.note =
        "One collector event pays every visible package once. No meter survives the spin.";
    }
  } else if (s.mode === "dock") {
    if (s.carry) {
      if (
        cash.some((p) => p.id === s.carry!.id || p.cell === s.carry!.cell) ||
        collectors.includes(s.carry.cell)
      )
        throw new Error("Reserved carry cell overwritten");
      s.cash.push(s.carry);
    }
    const oldCarry = s.carry;
    delete s.carry;
    if (collectors.length) {
      const pot = sum(s.cash),
        mult = s.multiplier;
      s.highlights = s.cash.map((p) => p.cell);
      for (let i = 0; i < collectors.length && !s.ended; i++)
        pay(
          s,
          pot * mult,
          `Collector ${i + 1}`,
          `${amount(pot)} × ${mult} = ${amount(pot * mult)}`,
        );
      const before = Math.floor(s.portraits / 4);
      s.portraits += collectors.length;
      s.multiplier = [1, 2, 3, 10][Math.min(3, Math.floor(s.portraits / 4))];
      if (Math.floor(s.portraits / 4) > before)
        s.note += ` · Retrigger: +10 spins, next collect ×${s.multiplier}.`;
    } else if (!step.finish && step.mark) {
      const marked = cash.find((p) => p.id === step.mark);
      if (!marked || marked.id === oldCarry?.id)
        throw new Error("Only a newly landed package may be marked");
      s.carry = marked;
      s.note = `${amount(marked.value)} is held for ONE next spin. It expires if no collector lands.`;
    } else if (oldCarry)
      s.note =
        "The held package expires after its one extra opportunity. Nothing is credited.";
  } else if (s.mode === "yacht") {
    if (
      cash.some((p) => p.cell % 5 === 4) ||
      collectors.some((c) => c % 5 !== 4)
    )
      throw new Error("Dispatch reel must remain free");
    if (
      cash.some((p) => s.cargo.some((q) => q.cell === p.cell || q.id === p.id))
    )
      throw new Error("Locked cargo overwritten");
    s.cargo.push(
      ...cash.map((p) => ({ ...p, value: Math.max(p.value, s.quality * 100) })),
    );
    s.cash = structuredClone(s.cargo);
    if ((collectors.length || step.finish) && s.cargo.length) {
      const pot = sum(s.cargo);
      s.highlights = s.cargo.map((p) => p.cell);
      pay(
        s,
        pot,
        step.finish ? "Final shipment" : "Shipment",
        `${s.cargo.length} packages = ${amount(pot)}`,
      );
      s.cargo = [];
      s.dispatches++;
      s.quality = Math.min(3, 1 + Math.floor(s.dispatches / 2));
      s.note = `Cargo shipped once; holds clear. New packages now have a ${amount(s.quality * 100)} floor.`;
    } else
      s.note = `${s.cargo.length}/12 holds loaded. The fifth reel remains open for the captain.`;
  } else if (s.mode === "airbridge") {
    const pickup = cash.filter((p) => p.cell % 5 === s.route);
    if (pickup.some((p) => s.cargo.some((q) => p.id === q.id)))
      throw new Error("Cargo ID reused");
    s.highlights = pickup.map((p) => p.cell);
    s.cargo.push(...pickup);
    if (pickup.length) s.routeStops++;
    s.multiplier = Math.min(5, 1 + s.routeStops);
    s.note = `Column ${s.route + 1} pickup: ${amount(sum(pickup))}. Other columns do not enter this route.`;
    if (s.route === 4 || step.finish) {
      const pot = sum(s.cargo);
      pay(
        s,
        pot * s.multiplier,
        step.finish && s.route !== 4 ? "Final extraction" : "Route delivered",
        `${amount(pot)} × ${s.multiplier} = ${amount(pot * s.multiplier)}`,
      );
      s.cargo = [];
      s.route = 0;
      s.routeStops = 0;
      s.multiplier = 1;
      s.note += " Route delivered; the next route starts at ×1.";
    } else s.route++;
  } else {
    if (cash.length) {
      if (s.phase !== "load") throw new Error("Getaway cargo already loaded");
      for (const p of cash) s.cases[Math.floor(p.cell / 5)] += p.value;
      s.cargo = cash;
      s.phase = "checkpoints";
      s.note = "Three cases loaded. Values remain pending until extraction.";
    }
    if (step.checkpoint !== undefined) {
      if (
        s.phase !== "checkpoints" ||
        s.checkpoints >= 3 ||
        ![0, 1, 2].includes(step.checkpoint)
      )
        throw new Error("Invalid checkpoint");
      s.cases[step.checkpoint] *= 2;
      s.checkpoints++;
      s.highlights = s.cargo
        .filter((p) => Math.floor(p.cell / 5) === step.checkpoint)
        .map((p) => p.cell);
      s.note = `Checkpoint cleared: case ${step.checkpoint + 1} doubles. No credited win is put at risk.`;
    }
    if (step.extract !== undefined) {
      if (
        s.phase !== "checkpoints" ||
        s.checkpoints !== 3 ||
        !Number.isSafeInteger(step.extract) ||
        step.extract < 1
      )
        throw new Error("Invalid extraction");
      const pot = s.cases.reduce((a, b) => a + b, 0);
      s.multiplier = step.extract;
      s.note =
        "Getaway complete. Apply the recorded extraction multiplier, then the round cap.";
      pay(
        s,
        pot * step.extract,
        "Getaway",
        `${s.cases.map(amount).join(" + ")} = ${amount(pot)}; × ${step.extract} = ${amount(pot * step.extract)}`,
      );
      s.phase = "extracted";
      s.ended = true;
    }
    s.cash = structuredClone(s.cargo);
  }
  if (step.finish) {
    s.ended = true;
    delete s.carry;
  }
  return s;
}
