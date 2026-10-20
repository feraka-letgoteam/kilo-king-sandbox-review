import { PAYLINES, lineHit, type Rng, type SplashCell, type SplashFree, type SplashLine, type Sym } from './engine.ts';
import { featureEvent, weighted, type Cargo, type FeatureEvent } from './feature-math.ts';
import { maxRevealFromDraw, type MaxReveal } from './max-spin-reveal.ts';
import { groupVsReels, vsLineMultiplier, VS_COMBINING_RULE, type VsCombiningRule, type VsGroup } from './vs-groups.ts';
import { planVsProgression, planSuperVsProgression, vsSeeded } from './vs-progression.ts';
import { VS_OUTCOME_CATALOGUE, VS_CATALOGUE_TOTAL_WEIGHT, VS_CATALOGUE_VERSION } from './vs-outcome-catalogue.ts';

export type Grid = SplashCell[][];
export type Spot = { reel: number; row: number };
export type Duelist = 'king' | 'vice';
export type ReelWild = { reel: number; multiplier: number; duelist?: Duelist };
export type Award = { beforeCap: number; credited: number };
export type VsConversion = Award & ReelWild & { sources: Cargo[]; duel?: { kingMultiplier: number; viceMultiplier: number; winner: Duelist } };
export type Cluster = Award & { symbol: Sym; cells: Spot[]; multiple: number; baseMultiple: number };
export type Drop = Spot & { fromRow: number; cell: SplashCell; spawn?: boolean };
export type Cascade = {
  before: Grid; after: Grid; clusters: Cluster[]; drops: Drop[];
  multiplierBefore: number; multiplierAfter: number;
  marksBefore: number[][]; marksAfter: number[][];
};
export type YachtReels = {
  distribution?: 'pacing-v60' | 'progression-v82' | 'progression-p2' | 'super-vs-v86';
  catalogueSeed?: number;
  /** Absent on historical additive-per-reel records; never infer from sides. */
  combining?: VsCombiningRule;
  groupsBefore?: VsGroup[];
  groupsAfter?: VsGroup[];
  type: 'vs'; rules?: 'pure-vs'; before: ReelWild[]; after: ReelWild[];
  conversions: VsConversion[]; collectGrid: Grid;
  collectors: number; collection: Award; finalCash: Award;
  finalSources: Cargo[]; lines: SplashLine[]; lineBeforeCap: number;
  finalGrid: Grid;
};
export type TumbleReels = {
  distribution?: 'pacing-v60';
  type: 'tumble'; initial: Grid; afterDrop: Grid; finalGrid: Grid;
  dropped: Cargo[]; globalBefore: number; globalAfterDrop: number; globalAfter: number;
  marksBefore: number[][]; marksAfterDrop: number[][]; marksAfter: number[][];
  cascades: Cascade[]; finalSources: (Cargo & { multiplier: number })[]; finalCash: Award;
};
export type BinaryReels = { type: 'binary'; won: boolean; result: Award; finalGrid: Grid; maxMultiple: 25000; reveal?: MaxReveal };
export type ReelFeature = YachtReels | TumbleReels | BinaryReels;

/** Independent local candidate distribution. Publication needs an approved outcome book. */
export const REEL_FEATURE_PROFILE = {
  // VS uses the versioned weighted catalogue; these remaining parameters
  // preserve Max and historical Chopper replay generation.
  // The Getaway: 1,000x cost, 25,000x or zero. RTP = 25000 * p / 1000 = 96.7%.
  getawayWinChance: 967 / 25000,
  clusterWeights: [64, 15, 8, 6, 4, 3],
  clusterLeadWeights: [[0, 4], [1, 4], [2, 2]] as [number, number][],
  tumbleCargoValues: [[0.5, 44], [1, 48], [2, 7], [5, 0.8], [10, 0.18], [25, 0.02]] as [number, number][],
};
export const TUMBLE_MAX_MULTIPLIER = 128;
export const TUMBLE_MAX_LOCKS = 4;
export const REEL_FEATURE_SPINS = { yacht: 15, yacht25: 15, route: 20, getaway: 1 } as const;
export const CLUSTER_SYMBOLS: Sym[] = ['10', 'J', 'Q', 'K', 'A', 'duffel'];
function clusterSymbol(rng: Rng, lead = 0): Sym {
  const index = weighted(rng, REEL_FEATURE_PROFILE.clusterWeights.map((weight, index) => [index, weight]));
  return CLUSTER_SYMBOLS[index === 0 ? lead : index === lead ? 0 : index]!;
}
export const CLUSTER_PAY: Partial<Record<Sym, readonly number[]>> = {
  '10': [0.7, 1.4, 3.5, 7], J: [0.7, 1.4, 3.5, 7], Q: [1, 2, 5, 10],
  K: [1.4, 2.8, 7, 14], A: [1.8, 3.5, 9, 18], duffel: [3.5, 7, 18, 35],
};
const clone = <T>(x: T): T => structuredClone(x);
const sum = (cargo: Cargo[]) => cargo.reduce((n, c) => n + c.value, 0);
const spotKey = (s: Spot) => s.reel * 3 + s.row;
const sameSpot = (a: Spot, b: Spot) => a.reel === b.reel && a.row === b.row;
const pick = <T>(items: readonly T[], rng: Rng) => items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!;
function normalGrid(rng: Rng, cluster = false, lead = 0): Grid {
  const symbols: Sym[] = cluster ? CLUSTER_SYMBOLS : ['10', 'J', 'Q', 'K', 'A', 'cuffs', 'keys', 'lamp', 'duffel'];
  const regularWeights = [96, 76, 68, 60, 50, 32, 24, 16, 9].map((weight, index) => [index, weight] as [number, number]);
  return Array.from({ length: 5 }, () => Array.from({ length: 3 }, () => ({ s: cluster ? clusterSymbol(rng, lead) : symbols[weighted(rng, regularWeights)]! })));
}
function putCash(grid: Grid, cargo: Cargo, stake: number) {
  grid[cargo.reel]![cargo.row] = { s: 'brick', v: cargo.value / stake, id: cargo.id, w: 1, h: 1 };
}
function putWilds(grid: Grid, wilds: ReelWild[]) {
  for (const wild of wilds) grid[wild.reel] = Array.from({ length: 3 }, () => ({ s: 'splash' }));
}
function freeSpin(grid: Grid, e: FeatureEvent, left: number): SplashFree {
  return { grid, lines: [], scatters: 0, scatterPay: 0, wilds: 0, mult: e.multiplier,
    got: e.credited, left, level: 0, extra: 0, mechanic: e };
}
function budget(room: number) {
  let total = 0;
  return {
    pay(beforeCap: number): Award {
      const credited = Math.min(Math.max(0, room - total), Math.max(0, Math.round(beforeCap)));
      total += credited;
      return { beforeCap: Math.round(beforeCap), credited };
    },
    get total() { return total; },
    get capped() { return total >= room; },
  };
}

/** Orthogonal connected groups. Cash is an immovable blocker, never a matching symbol. */
export function connectedClusters(grid: Grid): { symbol: Sym; cells: Spot[] }[] {
  const visited = new Set<number>(), result: { symbol: Sym; cells: Spot[] }[] = [];
  for (let reel = 0; reel < 5; reel++) for (let row = 0; row < 3; row++) {
    const symbol = grid[reel]![row]!.s, origin = { reel, row };
    if (visited.has(spotKey(origin)) || !CLUSTER_PAY[symbol]) continue;
    const cells: Spot[] = [], stack = [origin];
    while (stack.length) {
      const p = stack.pop()!, key = spotKey(p);
      if (visited.has(key) || grid[p.reel]?.[p.row]?.s !== symbol) continue;
      visited.add(key); cells.push(p);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const x = p.reel + dx!, y = p.row + dy!;
        if (x >= 0 && x < 5 && y >= 0 && y < 3) stack.push({ reel: x, row: y });
      }
    }
    if (cells.length >= 5) result.push({ symbol, cells });
  }
  return result;
}
export function clusterBaseMultiple(symbol: Sym, size: number) {
  return CLUSTER_PAY[symbol]?.[size >= 12 ? 3 : size >= 9 ? 2 : size >= 7 ? 1 : 0] ?? 0;
}

/** Gravity operates independently in each segment above/below a locked cell. */
export function refillTumble(before: Grid, cleared: Spot[], rng: Rng, lead = 0): { grid: Grid; drops: Drop[] } {
  const removed = new Set(cleared.map(spotKey)), grid = clone(before), drops: Drop[] = [];
  for (let reel = 0; reel < 5; reel++) {
    let start = 0;
    for (let boundary = 0; boundary <= 3; boundary++) {
      if (boundary < 3 && before[reel]![boundary]!.s !== 'brick') continue;
      const survivors: { cell: SplashCell; row: number }[] = [];
      for (let row = start; row < boundary; row++) if (!removed.has(reel * 3 + row)) survivors.push({ cell: clone(before[reel]![row]!), row });
      let target = boundary - 1;
      for (let index = survivors.length - 1; index >= 0; index--) {
        const item = survivors[index]!;
        grid[reel]![target] = item.cell;
        if (target !== item.row) drops.push({ reel, row: target, fromRow: item.row, cell: clone(item.cell) });
        target--;
      }
      let spawned = 0;
      while (target >= start) {
        const cell: SplashCell = { s: clusterSymbol(rng, lead) };
        grid[reel]![target] = cell;
        drops.push({ reel, row: target, fromRow: start - 1 - spawned++, cell: clone(cell), spawn: true });
        target--;
      }
      start = boundary + 1;
    }
  }
  return { grid, drops };
}

/** Complete immutable feature record. RNG never runs in the renderer or after settlement. */
export function runReelFeature(kind: 'yacht' | 'yacht25' | 'route' | 'getaway', stake: number, rng: Rng, room: number, vsSeed?: number) {
  if (kind !== 'yacht' && kind !== 'yacht25') return runReelFeatureCandidate(kind, stake, rng, room);
  // Phase 2: a book entry may name its VS seed directly (bought Yacht, Mystery picks).
  const seed = vsSeed ?? drawVsSeed(rng);
  const record = runReelFeatureCandidate(kind, stake, vsSeeded(seed), room);
  for (const spin of record.free) if (spin.mechanic?.reel?.type === 'vs') spin.mechanic.reel.catalogueSeed = seed;
  return record;
}

/** Weighted draw of one VS book seed. */
export function drawVsSeed(rng: Rng): number {
  const draw = Math.min(VS_CATALOGUE_TOTAL_WEIGHT - 1, Math.floor(rng() * VS_CATALOGUE_TOTAL_WEIGHT));
  let lo = 0, hi = VS_OUTCOME_CATALOGUE.length / 2 - 1;
  while (lo < hi) { const mid = (lo + hi) >>> 1;
    if (draw < VS_OUTCOME_CATALOGUE[mid * 2 + 1]!) hi = mid; else lo = mid + 1; }
  return VS_OUTCOME_CATALOGUE[lo * 2]!;
}

/** Offline catalogue producer and deterministic replay. No payout scaling or outcome mutation. */
export function runReelFeatureCandidate(kind: 'yacht' | 'yacht25' | 'route' | 'getaway', stake: number, rng: Rng, room: number) {
  const bank = budget(room), free: SplashFree[] = [];
  if (kind === 'getaway') {
    const outcomeDraw = rng();
    const won = outcomeDraw < REEL_FEATURE_PROFILE.getawayWinChance;
    const grid = normalGrid(rng);
    // The stopped board is the ordinary recorded grid, including on a max win.
    // Outcome, payout and reveal still derive from the same single draw; the
    // presentation must not force a staged row of five scatter symbols.
    const e = featureEvent(kind, 'getaway:result');
    e.action = 'extract'; e.final = true;
    const result = bank.pay(won ? stake * 25000 : 0);
    e.beforeCap = result.beforeCap; e.credited = result.credited;
    e.reel = { type: 'binary', won, result, finalGrid: clone(grid), maxMultiple: 25000,
      reveal: maxRevealFromDraw(outcomeDraw, REEL_FEATURE_PROFILE.getawayWinChance) };
    free.push(freeSpin(grid, e, 0));
    return { free, total: bank.total, capped: bank.capped };
  }
  let held: Cargo[] = [], wilds: ReelWild[] = [], global = 1, nextId = 10000;
  let marks = Array.from({ length: 5 }, () => [1, 1, 1]);
  const count = REEL_FEATURE_SPINS[kind];
  // Opening, development and closing encounters are committed together.
  const arrivals = kind === 'yacht25' ? planSuperVsProgression(rng) : kind === 'yacht' ? planVsProgression(rng) : [];
  for (let spin = 0; spin < count && !bank.capped; spin++) {
    const e = featureEvent(kind, `${kind}:reels:${spin}`), startTotal = bank.total;
    e.heldBefore = clone(held); e.pendingBefore = sum(held); e.final = spin === count - 1;
    // Rotate the leading low symbol per spin so a higher cluster frequency
    // does not turn every board into the same rank. Refills keep this spin's
    // palette; the complete landed/refill grids are recorded for playback.
    const lead = kind === 'route' ? weighted(rng, REEL_FEATURE_PROFILE.clusterLeadWeights) : 0;
    const landed = normalGrid(rng, kind === 'route', lead);
    held.forEach(p => putCash(landed, p, stake));
    if (kind === 'yacht' || kind === 'yacht25') {
      const before = clone(wilds), conversions: VsConversion[] = [];
      putWilds(landed, wilds);
      for (let reel = 0; reel < 5; reel++) {
        if (wilds.some(w => w.reel === reel)) continue;
        const arrival = arrivals.find(item => item.spin === spin && item.reel === reel);
        if (arrival) {
          const multiplier = arrival.multiplier;
          const rival = arrival.rival;
          const duelist: Duelist = arrival.side;
          const duel = { kingMultiplier: duelist === 'king' ? multiplier : rival,
            viceMultiplier: duelist === 'vice' ? multiplier : rival, winner: duelist };
          // A VS always locks, even on a non-winning spin. The two candidates
          // and winner are recorded here, never invented by the animation.
          landed[reel]![1] = { s: 'splash', duel: true };
          conversions.push({ reel, multiplier, duelist, duel, sources: [], beforeCap: 0, credited: 0 });
          wilds.push({ reel, multiplier, duelist });
        }
      }
      const collectGrid = clone(landed);
      // Legacy fields remain zero for saved-round compatibility. New Yacht
      // records contain only VS wilds and payline wins: no cash/collectors.
      for (const wild of wilds) collectGrid[wild.reel] = [{ s: 'bars' }, { s: 'bars' }, { s: 'bars' }];
      const collectors = 0, collection = { beforeCap: 0, credited: 0 };
      const finalSources: Cargo[] = [], finalCash = { beforeCap: 0, credited: 0 };
      const finalGrid = clone(landed); putWilds(finalGrid, wilds);
      const lines: SplashLine[] = []; let lineBeforeCap = 0;
      PAYLINES.forEach((rows, index) => {
        const hit = lineHit(finalGrid, rows); if (!hit) return;
        // Same-side adjacent members multiply inside one group. Separate
        // participating groups retain the prior additive cross-group rule.
        const multiple = vsLineMultiplier(wilds, hit.n, VS_COMBINING_RULE);
        const award = bank.pay(stake * hit.mult * multiple);
        lineBeforeCap += award.beforeCap;
        if (award.credited) lines.push({ i: index, s: hit.s, n: hit.n, pay: award.credited });
      });
      e.reel = { type: 'vs', distribution: kind === 'yacht25' ? 'super-vs-v86' : VS_CATALOGUE_VERSION, rules: 'pure-vs', before, after: clone(wilds), conversions, collectGrid,
        combining: VS_COMBINING_RULE, groupsBefore: groupVsReels(before), groupsAfter: groupVsReels(wilds),
        collectors, collection, finalCash, finalSources, lines, lineBeforeCap, finalGrid };
      e.action = 'duel'; e.sources = [];
      e.beforeCap = lineBeforeCap;
      e.multiplier = Math.max(1, ...groupVsReels(wilds).map(group => group.multiplier));
    } else {
      const initial = clone(landed), globalBefore = global, marksBefore = clone(marks);
      global = Math.min(TUMBLE_MAX_MULTIPLIER, global + 1);
      marks = marks.map(col => col.map(m => m > 1 ? Math.min(TUMBLE_MAX_MULTIPLIER, m + 1) : m));
      // Four durable cash positions leave room for matching clusters. Later drops
      // top up an existing locked package, without overwriting ordinary symbols.
      const dropped: Cargo[] = [];
      const value = Math.round(weighted(rng, REEL_FEATURE_PROFILE.tumbleCargoValues) * stake);
      if (held.length < TUMBLE_MAX_LOCKS) {
        const open: Spot[] = [];
        for (let reel = 0; reel < 5; reel++) for (let row = 0; row < 3; row++) if (!held.some(p => p.reel === reel && p.row === row)) open.push({ reel, row });
        const position = pick(open, rng);
        const p = { ...position, id: nextId++, value }; held.push(p); dropped.push(clone(p));
      } else {
        const target = pick(held, rng); target.value += value;
        dropped.push({ ...target, value });
      }
      held.forEach(p => putCash(landed, p, stake));
      const afterDrop = clone(landed), marksAfterDrop = clone(marks), globalAfterDrop = global;
      const cascades: Cascade[] = [];
      let grid = clone(landed);
      while (!bank.capped) {
        const matches = connectedClusters(grid); if (!matches.length) break;
        // Positive minimum award and finite room bound the sequence, even for
        // a pathological deterministic RNG. No winning board is silently discarded.
        const cascadeBefore = clone(grid), beforeMarks = clone(marks), beforeGlobal = global;
        const clusters = matches.map(match => {
          const baseMultiple = clusterBaseMultiple(match.symbol, match.cells.length);
          const multiple = Math.max(global, ...match.cells.map(p => marks[p.reel]![p.row]!));
          return { ...match, baseMultiple, multiple, ...bank.pay(stake * baseMultiple * multiple) };
        });
        const cleared = matches.flatMap(m => m.cells);
        for (const p of cleared) marks[p.reel]![p.row] = Math.min(TUMBLE_MAX_MULTIPLIER, marks[p.reel]![p.row]! * 2);
        global = Math.min(TUMBLE_MAX_MULTIPLIER, global + 1);
        const { grid: next, drops } = refillTumble(grid, cleared, rng, lead); grid = next;
        cascades.push({ before: cascadeBefore, after: clone(next), clusters, drops,
          multiplierBefore: beforeGlobal, multiplierAfter: global, marksBefore: beforeMarks, marksAfter: clone(marks) });
      }
      const finalSources = e.final && !bank.capped ? held.map(p => ({ ...p, multiplier: Math.max(global, marks[p.reel]![p.row]!) })) : [];
      const finalCash = bank.pay(finalSources.reduce((n, p) => n + p.value * p.multiplier, 0));
      e.reel = { type: 'tumble', distribution: 'pacing-v60', initial, afterDrop, finalGrid: grid, dropped, globalBefore, globalAfterDrop, globalAfter: global,
        marksBefore, marksAfterDrop, marksAfter: clone(marks), cascades, finalSources, finalCash };
      e.action = 'delivery'; e.sources = clone(dropped);
      e.beforeCap = cascades.reduce((n, c) => n + c.clusters.reduce((v, m) => v + m.beforeCap, 0), 0) + finalCash.beforeCap;
      e.multiplier = global;
      if (e.final || bank.capped) held = [];
    }
    e.credited = bank.total - startTotal;
    e.heldAfter = clone(held); e.pendingAfter = sum(held); e.nextMultiplier = e.multiplier;
    e.final ||= bank.capped;
    free.push(freeSpin(kind === 'route' ? (e.reel as TumbleReels).initial : landed, e, bank.capped ? 0 : count - spin - 1));
  }
  return { free, total: bank.total, capped: bank.capped };
}
