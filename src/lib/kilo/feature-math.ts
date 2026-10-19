import type { Rng, SplashCell, SplashFree } from "./engine";
import type { ReelFeature } from "./reel-feature-math";

export type FeatureKind = "dock" | "yacht" | "route" | "getaway";
export type Cargo = { id: number; reel: number; row: number; value: number };
export type FeatureEvent = {
  /** v52 reel-based features. Historical events retain their v51 contract. */
  reel?: ReelFeature;
  id: string;
  kind: FeatureKind;
  action:
    | "carry"
    | "expire"
    | "hold"
    | "duel"
    | "shipment"
    | "pickup"
    | "delivery"
    | "load"
    | "checkpoint"
    | "extract";
  sources: Cargo[];
  heldBefore: Cargo[];
  heldAfter: Cargo[];
  pendingBefore: number;
  pendingAfter: number;
  beforeCap: number;
  credited: number;
  multiplier: number;
  nextMultiplier: number;
  quality: number;
  shipments: number;
  route: number;
  nextRoute: number;
  casesBefore: number[];
  casesAfter: number[];
  checkpoint: number;
  targetCase: number | null;
  final: boolean;
  /** Rare full-load outcome distribution, selected once for this paid round. */
  fullLoad?: boolean;
};
export const FEATURE_NAMES: Record<FeatureKind, string> = {
  dock: "Dockside Catch",
  yacht: "Yacht Stash",
  route: "Chopper Route",
  getaway: "The Getaway",
};
export const FEATURE_SPINS = {
  dock: 10,
  yacht: 15,
  route: 20,
  getaway: 5,
} as const;
export const CARGO_FLOORS = [2, 5, 10] as const;
export const ROUTE_MAX_MULT = 5;
export const GETAWAY_CASE_VALUES = [5, 10, 20, 50, 100] as const;
export const GETAWAY_EXTRACT_VALUES = [2, 4, 8, 12, 20, 50] as const;
/** Sandbox candidate weights. Measured by scripts/verify-features-v51.mjs, not certified RTP. */
export const FEATURE_PROFILE = {
  baseScatterWeight: 20.8,
  anteScatterWeight: 26.1,
  dockCollectorWeight: 8.4,
  dockCargoWeight: 60,
  baseCollectorChance: 0.018,
  yachtCargoChance: 0.2709410628464237,
  yachtDispatchChance: 0.3,
  routeCargoChance: 0.2569668157408761,
  fullLoadChance: 1 / 100_000,
  cargoValues: [
    [2, 64],
    [5, 28],
    [10, 7],
    [20, 0.8],
    [50, 0.18],
    [100, 0.02],
  ] as [number, number][],
  caseValues: [
    [5, 30],
    [10, 40],
    [20, 20],
    [50, 9],
    [100, 1],
  ] as [number, number][],
  extraction: [
    [2, 8.92692865567757],
    [4, 24],
    [8, 36],
    [12, 20],
    [20, 10],
    [50, 1.0730713443224313],
  ] as [number, number][],
};
export function weighted(
  rng: Rng,
  table: readonly (readonly [number, number])[],
) {
  let r = rng() * table.reduce((sum, [, w]) => sum + w, 0);
  for (const [v, w] of table) {
    r -= w;
    if (r < 0) return v;
  }
  return table.at(-1)![0];
}
function blank(rng: Rng): SplashCell[][] {
  const symbols = [
    "10",
    "J",
    "Q",
    "K",
    "A",
    "cuffs",
    "keys",
    "lamp",
    "duffel",
  ] as const;
  return Array.from({ length: 5 }, () =>
    Array.from({ length: 3 }, () => ({
      s: symbols[Math.floor(rng() * symbols.length)]!,
    })),
  );
}
export function cargoAt(grid: SplashCell[][], stake: number): Cargo[] {
  return grid.flatMap((col, reel) =>
    col.flatMap((c, row) =>
      c.s === "brick" && !c.part && c.v != null
        ? [
            {
              id: c.id ?? reel * 3 + row,
              reel,
              row,
              value: Math.round(c.v * stake),
            },
          ]
        : [],
    ),
  );
}
function place(grid: SplashCell[][], p: Cargo, stake: number) {
  grid[p.reel]![p.row] = {
    s: "brick",
    v: p.value / stake,
    id: p.id,
    w: 1,
    h: 1,
  };
}
export function featureEvent(kind: FeatureKind, id: string): FeatureEvent {
  return {
    id,
    kind,
    action: "hold",
    sources: [],
    heldBefore: [],
    heldAfter: [],
    pendingBefore: 0,
    pendingAfter: 0,
    beforeCap: 0,
    credited: 0,
    multiplier: 1,
    nextMultiplier: 1,
    quality: 0,
    shipments: 0,
    route: 0,
    nextRoute: 0,
    casesBefore: [],
    casesAfter: [],
    checkpoint: 0,
    targetCase: null,
    final: false,
  };
}
/** A complete finite recorded feature. No state escapes this paid round. */
export function runCargoFeature(
  kind: Exclude<FeatureKind, "dock">,
  stake: number,
  rng: Rng,
  room: number,
) {
  const free: SplashFree[] = [];
  let total = 0,
    capped = false,
    id = 1000;
  let cargo: Cargo[] = [],
    shipments = 0,
    quality = 0,
    route = 0,
    stops = 0,
    cases = [0, 0, 0];
  const count = FEATURE_SPINS[kind];
  // A fixed, player-independent outcome mixture gives a rare complete full-load
  // run real probability. All progression still uses the ordinary mechanics;
  // no new values or payments are injected by the renderer. Like a weighted
  // Engine outcome book, these correlated outcomes are chosen before animation.
  const fullLoad = kind !== "getaway" && rng() < FEATURE_PROFILE.fullLoadChance;
  for (let i = 0; i < count && total < room; i++) {
    const grid = blank(rng),
      event = featureEvent(kind, `${kind}:${i}`);
    event.quality = quality;
    event.shipments = shipments;
    event.route = route;
    event.pendingBefore = cargo.reduce((n, c) => n + c.value, 0);
    event.casesBefore = [...cases];
    event.final = i === count - 1;
    event.fullLoad = fullLoad;
    if (kind === "yacht") {
      event.heldBefore = structuredClone(cargo);
      for (const c of cargo) place(grid, c, stake);
      for (let reel = 0; reel < 4; reel++)
        for (let row = 0; row < 3; row++) {
          if (grid[reel]![row]!.s === "brick") continue;
          const lands = rng() < FEATURE_PROFILE.yachtCargoChance;
          if (!fullLoad && !lands) continue;
          const rolled = weighted(rng, FEATURE_PROFILE.cargoValues);
          const value =
            (fullLoad ? 100 : Math.max(CARGO_FLOORS[quality]!, rolled)) * stake;
          const p = { id: id++, reel, row, value };
          cargo.push(p);
          place(grid, p, stake);
        }
      const dispatch = rng() < FEATURE_PROFILE.yachtDispatchChance || fullLoad;
      if (dispatch) grid[4]![Math.floor(rng() * 3)] = { s: "splash" };
      if ((dispatch || event.final) && cargo.length) {
        event.action = "shipment";
        event.sources = structuredClone(cargo);
        event.beforeCap = cargo.reduce((n, c) => n + c.value, 0);
        cargo = [];
        shipments++;
        quality = Math.min(2, Math.floor(shipments / 2));
      } else {
        event.action = "hold";
        event.sources = cargo.filter(
          (c) => !event.heldBefore.some((p) => p.id === c.id),
        );
      }
      event.heldAfter = structuredClone(cargo);
      event.quality = quality;
      event.shipments = shipments;
    } else if (kind === "route") {
      for (let reel = 0; reel < 5; reel++)
        for (let row = 0; row < 3; row++) {
          const lands = rng() < FEATURE_PROFILE.routeCargoChance;
          if (lands || fullLoad) {
            const rolled = weighted(rng, FEATURE_PROFILE.cargoValues);
            const p = {
              id: id++,
              reel,
              row,
              value: (fullLoad ? 100 : rolled) * stake,
            };
            place(grid, p, stake);
            if (reel === route) event.sources.push(p);
          }
        }
      cargo.push(...event.sources);
      if (event.sources.length) stops++;
      event.multiplier = Math.min(ROUTE_MAX_MULT, 1 + stops);
      event.action = "pickup";
      if (route === 4 || event.final) {
        event.action = "delivery";
        event.beforeCap =
          cargo.reduce((n, c) => n + c.value, 0) * event.multiplier;
        cargo = [];
        route = 0;
        stops = 0;
      } else route++;
      event.nextMultiplier = Math.min(ROUTE_MAX_MULT, 1 + stops);
      event.nextRoute = route;
    } else {
      if (i === 0) {
        event.action = "load";
        cases = Array.from(
          { length: 3 },
          () => weighted(rng, FEATURE_PROFILE.caseValues) * stake,
        );
      } else if (i < 4) {
        event.action = "checkpoint";
        event.checkpoint = i;
        event.targetCase = Math.floor(rng() * 3);
        cases[event.targetCase]! *= 2;
      } else {
        event.action = "extract";
        event.checkpoint = 3;
        event.multiplier = weighted(rng, FEATURE_PROFILE.extraction);
        event.beforeCap = cases.reduce((a, b) => a + b, 0) * event.multiplier;
      }
      cargo = cases.map((value, index) => ({
        id: 2000 + index,
        reel: index * 2,
        row: 1,
        value,
      }));
      for (const c of cargo) place(grid, c, stake);
      event.sources =
        event.action === "checkpoint"
          ? cargo.filter((c) => c.reel === (event.targetCase ?? 0) * 2)
          : structuredClone(cargo);
      event.casesAfter = [...cases];
      event.heldBefore = i
        ? event.casesBefore.map((value, index) => ({
            id: 2000 + index,
            reel: index * 2,
            row: 1,
            value,
          }))
        : [];
      event.heldAfter = structuredClone(cargo);
    }
    event.pendingAfter =
      kind === "getaway" && event.action === "extract"
        ? 0
        : cargo.reduce((n, c) => n + c.value, 0);
    event.credited = Math.min(event.beforeCap, Math.max(0, room - total));
    total += event.credited;
    if (total >= room) {
      capped = true;
      event.final = true;
    }
    free.push({
      grid,
      lines: [],
      scatters: 0,
      scatterPay: 0,
      wilds: 0,
      mult: event.multiplier,
      got: event.credited,
      left: capped ? 0 : count - i - 1,
      level: quality,
      extra: 0,
      mechanic: event,
    });
  }
  return { free, total, capped };
}
