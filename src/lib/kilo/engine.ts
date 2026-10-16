const CASINO_MIN_STAKE = 100;
const CASINO_MAX_STAKE = 100_000;
/** The Kilo King. Base lines stay quiet. The feature follows Big Bass Splash: the fisherman only appears in free spins, every money bass is one cell up to a 5,000× fish, any two scatters lock and respin, and the tools only fire on a mismatch. The ladder stops at ×10. Weights aim at about 90% of the stake charged. */

export type SplashMode = "spin" | "ante" | "buy" | "chopper";

export type Sym =
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A"
  | "cuffs"
  | "keys"
  | "lamp"
  | "duffel"
  | "brick"
  | "splash"
  | "bars";

export interface SplashCell {
  s: Sym;
  /** Brick cash, as a multiple of the base stake. Anchor cells only. */
  v?: number;
  /** How many reels and rows this bass covers. Anchor only. */
  w?: number;
  h?: number;
  /** This cell is covered by a bass anchored somewhere else. */
  part?: boolean;
  id?: number;
}

export interface SplashLine {
  i: number;
  s: Sym;
  n: number;
  pay: number;
}

export interface SplashDrop {
  grid: SplashCell[][];
  lines: SplashLine[];
  scatters: number;
  /** Anywhere scatter award. Zero when the feature was bought. */
  scatterPay: number;
  /** Reels that spun again after two scatters locked. */
  hook?: number[];
  /** Board before that respin. */
  primed?: SplashCell[][];
}

/** Upgrades drawn once, before the free spins start. */
export type SplashMod = "moreFish" | "moreWilds" | "level2" | "extraSpins" | "moreTools";

/** A save that only fires on a mismatch. Dynamite and bazooka need Splash and no bass. The hook needs bass and no Splash. */
export type SplashTool = "dynamite" | "hook" | "bazooka";

export interface SplashFree extends SplashDrop {
  wilds: number;
  mult: number;
  got: number;
  left: number;
  level: number;
  extra: number;
  tool?: SplashTool;
  /** Reel the hook pulled, or the first reel dynamite planted. */
  toolReel?: number;
  /** Hook only. Which way that reel was pulled. */
  toolShift?: "up" | "down";
}

export interface SplashScript {
  mode: SplashMode;
  stake: number;
  cost: number;
  awarded: number;
  banked: number;
  payout: number;
  capped: boolean;
  /** Empty when the spin did not open free spins. */
  mods: SplashMod[];
  base: SplashDrop;
  free: SplashFree[];
}

export type Rng = () => number;

export const SPLASH_MAX_MULT = 5000;
export const SPLASH_MAX_WIN = 5_000_000;
export const SPLASH_COST_MAX = 1_000_000;

/** Ten lines, row index top to bottom. */
export const PAYLINES: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0],
];

/** 3 / 4 / 5 of a kind, as a multiple of the base stake. Royals stay small. The gold reel is the truck. */
export const PAY: Record<string, readonly [number, number, number]> = {
  "10": [0.2, 1, 5],
  J: [0.2, 1, 5],
  Q: [0.2, 1, 5],
  K: [0.2, 2.5, 10],
  A: [0.2, 2.5, 10],
  cuffs: [2, 10, 50],
  keys: [2, 10, 50],
  lamp: [3, 15, 100],
  duffel: [5, 20, 200],
  brick: [1, 5, 20],
};

export const LEVEL_MULT = [1, 2, 3, 10] as const;

/** Anywhere scatter award, as a multiple of the base stake. Index is the scatter count. */
export const SCATTER_PAY = [0, 0, 0.5, 5, 20, 200] as const;

/** Cash on a money bass, as a multiple of the base stake. The 5,000× is the cap fish. */
export const MONEY_LADDER = [2, 5, 10, 15, 20, 25, 50, 100, 200, 500, 1000, 2000, 5000] as const;

const MONEY: [number, number][] = [
  [2, 6400],
  [5, 2800],
  [10, 700],
  [15, 180],
  [20, 50],
  [25, 24],
  [50, 8],
  [100, 3],
  [200, 1],
  [500, 1],
  [1000, 1],
  [2000, 1],
  [5000, 1],
];

/** Dynamite plants real bass, but not the cap fish. */
const DYNAMITE_CASH: [number, number][] = [
  [2, 40],
  [5, 28],
  [10, 16],
  [15, 8],
  [20, 5],
  [25, 3],
  [50, 2],
  [100, 1],
  [200, 1],
];

type Weight = [Sym, number];

const BASE: Weight[] = [
  ["10", 148],
  ["J", 136],
  ["Q", 124],
  ["K", 112],
  ["A", 100],
  ["cuffs", 62],
  ["keys", 44],
  ["lamp", 28],
  ["duffel", 16],
  ["brick", 36],
  ["bars", 24],
];

const ANTE: Weight[] = BASE.map(([s, w]) => (s === "bars" ? [s, 29] : [s, w]));

const HOOK: Weight[] = BASE.map(([s, w]) => (s === "bars" ? [s, 8] : [s, w]));

const BASE_QUIET: Weight[] = BASE.filter(([s]) => s !== "bars");

const FS: Weight[] = [
  ["10", 96],
  ["J", 76],
  ["Q", 68],
  ["K", 60],
  ["A", 50],
  ["cuffs", 32],
  ["keys", 24],
  ["lamp", 16],
  ["duffel", 9],
  ["brick", 46],
  ["splash", 4.08],
];

const BUY_FS: Weight[] = [
  ["10", 88],
  ["J", 70],
  ["Q", 62],
  ["K", 54],
  ["A", 44],
  ["cuffs", 28],
  ["keys", 20],
  ["lamp", 14],
  ["duffel", 8],
  ["brick", 55],
  ["splash", 3.82],
];

const CHOPPER_FS: Weight[] = [
  ["10", 84],
  ["J", 66],
  ["Q", 58],
  ["K", 50],
  ["A", 42],
  ["cuffs", 26],
  ["keys", 18],
  ["lamp", 12],
  ["duffel", 7],
  ["brick", 92],
  ["splash", 4.65],
];

const MOD_CHANCE: Record<SplashMod, number> = {
  moreFish: 0.2,
  moreWilds: 0.16,
  extraSpins: 0.12,
  moreTools: 0.14,
  level2: 0.06,
};

const TOOL_CHANCE: Record<SplashTool, number> = {
  dynamite: 0.14,
  hook: 0.08,
  bazooka: 0.045,
};

const PAYING = new Set<Sym>(["10", "J", "Q", "K", "A", "cuffs", "keys", "lamp", "duffel", "brick"]);

export function splashCost(stake: number, mode: SplashMode): number {
  if (mode === "ante") return Math.round(stake * 1.5);
  if (mode === "buy") return stake * 100;
  if (mode === "chopper") return stake * 250;
  return stake;
}

export function splashRoundCap(stake: number): number {
  return Math.min(SPLASH_MAX_WIN, stake * SPLASH_MAX_MULT);
}

export function splashStakeOk(stake: number, mode: SplashMode): boolean {
  if (!Number.isInteger(stake) || stake < CASINO_MIN_STAKE || stake > CASINO_MAX_STAKE) return false;
  const cost = splashCost(stake, mode);
  return cost >= 100 && cost <= SPLASH_COST_MAX;
}

function pick<T>(rng: Rng, table: [T, number][]): T {
  let total = 0;
  for (const [, w] of table) total += w;
  let r = rng() * total;
  for (const [item, w] of table) {
    r -= w;
    if (r <= 0) return item;
  }
  return table[table.length - 1][0];
}

function tableForReel(table: Weight[], reel: number, edgeWilds = false): Weight[] {
  if (edgeWilds || (reel !== 0 && reel !== 4)) return table;
  const quiet = table.filter(([s]) => s !== "splash");
  return quiet.length ? quiet : table;
}

/** Every money bass is one cell. The cash is the number on the fish, not how many squares it covers. */
export function fishSpan(_v: number): { w: number; h: number } {
  return { w: 1, h: 1 };
}

function stampFish(grid: (SplashCell | null)[][], reel: number, row: number, v: number, id: number) {
  if (grid[reel]?.[row]) return;
  grid[reel][row] = { s: "brick", v, w: 1, h: 1, id };
}

function fillOpen(rng: Rng, grid: (SplashCell | null)[][], table: Weight[], money: [number, number][], edgeWilds = false, locked?: Set<number>) {
  let nextId = 1;
  for (const col of grid) for (const cell of col) if (cell?.id && cell.id >= nextId) nextId = cell.id + 1;
  for (let reel = 0; reel < 5; reel++) {
    if (locked?.has(reel)) continue;
    let barred = grid[reel].some((cell) => cell?.s === "bars");
    for (let row = 0; row < 3; row++) {
      if (grid[reel][row]) continue;
      const reelTable = tableForReel(barred ? table.filter(([s]) => s !== "bars") : table, reel, edgeWilds);
      const fallback = tableForReel(table.filter(([s]) => s !== "bars" && s !== "brick"), reel, edgeWilds);
      let s = pick(rng, reelTable.length ? reelTable : table);
      if ((s === "bars" && barred) || (s === "splash" && !edgeWilds && (reel === 0 || reel === 4))) {
        s = pick(rng, fallback.length ? fallback : reelTable);
      }
      if (s === "bars") barred = true;
      if (s === "brick") {
        stampFish(grid, reel, row, pick(rng, money), nextId);
        nextId += 1;
        continue;
      }
      grid[reel][row] = { s };
    }
  }
}

function blankGrid(): (SplashCell | null)[][] {
  return Array.from({ length: 5 }, () => Array.from({ length: 3 }, () => null));
}

function solid(grid: (SplashCell | null)[][]): SplashCell[][] {
  return grid.map((col) => col.map((cell) => cell ?? { s: "10" }));
}

function fillGrid(rng: Rng, table: Weight[], money: [number, number][], edgeWilds = false): SplashCell[][] {
  const grid = blankGrid();
  fillOpen(rng, grid, table, money, edgeWilds);
  return solid(grid);
}

function wipeFish(grid: (SplashCell | null)[][], id: number) {
  for (let reel = 0; reel < grid.length; reel++) {
    for (let row = 0; row < grid[reel].length; row++) if (grid[reel][row]?.id === id) grid[reel][row] = null;
  }
}

function scatterReels(grid: SplashCell[][]): number {
  let n = 0;
  for (const col of grid) if (col.some((cell) => cell.s === "bars")) n += 1;
  return n;
}

function scatterReelList(grid: SplashCell[][]): number[] {
  const locked: number[] = [];
  for (let reel = 0; reel < grid.length; reel++) {
    if (grid[reel].some((cell) => cell.s === "bars")) locked.push(reel);
  }
  return locked;
}

/** Any two scatters lock those reels. The other reels respin once. Locked reels are copied back untouched. */
function hookRespin(
  rng: Rng,
  grid: SplashCell[][],
  money: [number, number][],
): { primed: SplashCell[][]; hook: number[] } | null {
  const locked = scatterReelList(grid);
  if (locked.length !== 2) return null;
  const lockedSet = new Set(locked);
  const hook = [0, 1, 2, 3, 4].filter((reel) => !lockedSet.has(reel));
  const primed = grid.map((col) => col.map((cell) => ({ ...cell })));
  const work: (SplashCell | null)[][] = grid.map((col) => col.map((cell) => ({ ...cell })));
  for (const reel of hook) {
    for (let row = 0; row < 3; row++) work[reel][row] = null;
  }
  fillOpen(rng, work, HOOK, money, false, lockedSet);
  const next = solid(work);
  for (let reel = 0; reel < 5; reel++) {
    for (let row = 0; row < 3; row++) {
      grid[reel][row] = lockedSet.has(reel) ? primed[reel][row] : next[reel][row];
    }
  }
  return { primed, hook };
}

function forceBars(rng: Rng, grid: SplashCell[][], n: number) {
  const reels = [0, 1, 2, 3, 4];
  for (let i = reels.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const swap = reels[i];
    reels[i] = reels[j];
    reels[j] = swap;
  }
  const count = Math.min(n, reels.length);
  const work: (SplashCell | null)[][] = grid.map((col) => col.map((cell) => ({ ...cell })));
  for (let i = 0; i < count; i++) {
    const reel = reels[i];
    for (let row = 0; row < 3; row++) {
      const cell = work[reel][row];
      if (cell?.s === "bars") work[reel][row] = { s: "10" };
    }
    const row = Math.floor(rng() * 3);
    const cell = work[reel][row];
    if (cell?.id != null) wipeFish(work, cell.id);
    work[reel][row] = { s: "bars" };
  }
  const next = solid(work);
  for (let reel = 0; reel < 5; reel++) for (let row = 0; row < 3; row++) grid[reel][row] = next[reel][row];
}

function countSym(grid: SplashCell[][], sym: Sym): number {
  let n = 0;
  for (const col of grid) for (const cell of col) if (cell.s === sym) n += 1;
  return n;
}

function countAnchors(grid: SplashCell[][]): number {
  let n = 0;
  for (const col of grid) for (const cell of col) if (cell.s === "brick" && !cell.part && cell.v != null) n += 1;
  return n;
}

function brickSum(grid: SplashCell[][]): number {
  let n = 0;
  for (const col of grid) for (const cell of col) if (cell.s === "brick" && !cell.part) n += cell.v ?? 0;
  return n;
}

function drawMods(rng: Rng): SplashMod[] {
  const mods: SplashMod[] = [];
  const order: SplashMod[] = ["moreFish", "moreWilds", "level2", "extraSpins", "moreTools"];
  for (const mod of order) if (rng() < MOD_CHANCE[mod]) mods.push(mod);
  return mods;
}

function tuneTable(table: Weight[], mods: SplashMod[]): Weight[] {
  const fish = mods.includes("moreFish") ? 2.6 : 1;
  const wild = mods.includes("moreWilds") ? 2.8 : 1;
  if (fish === 1 && wild === 1) return table;
  return table.map(([s, w]) => {
    if (s === "brick") return [s, w * fish];
    if (s === "splash") return [s, w * wild];
    return [s, w];
  });
}

function nextFishId(grid: SplashCell[][]): number {
  let next = 1;
  for (const col of grid) for (const cell of col) if (cell.id != null && cell.id >= next) next = cell.id + 1;
  return next;
}

function openCells(grid: (SplashCell | null)[][]): [number, number][] {
  const out: [number, number][] = [];
  for (let reel = 0; reel < 5; reel++) {
    for (let row = 0; row < 3; row++) {
      const cell = grid[reel][row];
      if (!cell || cell.s === "splash" || cell.s === "bars" || cell.s === "brick") continue;
      out.push([reel, row]);
    }
  }
  return out;
}

function takeCell(rng: Rng, cells: [number, number][]): [number, number] | null {
  if (!cells.length) return null;
  const i = Math.floor(rng() * cells.length);
  return cells.splice(i, 1)[0];
}

function cloneGrid(grid: SplashCell[][]): SplashCell[][] {
  return grid.map((col) => col.map((cell) => ({ ...cell })));
}

/** Dynamite and bazooka: Splash is in, bass are not. Hook: bass are in, Splash is not. A failed roll leaves the board alone. */
function maybeTool(
  rng: Rng,
  grid: SplashCell[][],
  mods: SplashMod[],
  table: Weight[],
): { kind: SplashTool; reel?: number; shift?: "up" | "down" } | undefined {
  const wilds = countSym(grid, "splash");
  const fish = countAnchors(grid);
  const boost = mods.includes("moreTools") ? 1.8 : 1;
  const roll = (kind: SplashTool) => rng() < Math.min(0.62, TOOL_CHANCE[kind] * boost);
  const before = cloneGrid(grid);
  const commit = (work: (SplashCell | null)[][]) => {
    const next = solid(work);
    for (let reel = 0; reel < 5; reel++) for (let row = 0; row < 3; row++) grid[reel][row] = next[reel][row];
  };
  const revert = () => {
    for (let reel = 0; reel < 5; reel++) for (let row = 0; row < 3; row++) grid[reel][row] = before[reel][row];
  };

  if (wilds > 0 && fish === 0 && roll("bazooka")) {
    const work: (SplashCell | null)[][] = before.map((col) => col.map((cell) => (cell.s === "splash" ? { ...cell } : null)));
    fillOpen(rng, work, table, MONEY, true);
    commit(work);
    if (countAnchors(grid) > 0 && countSym(grid, "splash") > 0) return { kind: "bazooka" };
    revert();
  }
  if (wilds > 0 && fish === 0 && roll("dynamite")) {
    const work: (SplashCell | null)[][] = before.map((col) => col.map((cell) => ({ ...cell })));
    const cells = openCells(work);
    let id = nextFishId(before);
    let planted = 0;
    let reel: number | undefined;
    const n = 2 + (rng() < 0.45 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const spot = takeCell(rng, cells);
      if (!spot) break;
      work[spot[0]][spot[1]] = null;
      stampFish(work, spot[0], spot[1], pick(rng, DYNAMITE_CASH), id);
      id += 1;
      planted += 1;
      if (reel == null) reel = spot[0];
    }
    commit(work);
    if (planted > 0 && countAnchors(grid) > 0 && countSym(grid, "splash") > 0) return { kind: "dynamite", reel };
    revert();
  }
  if (fish > 0 && wilds === 0 && roll("hook")) {
    const ranked = [0, 1, 2, 3, 4].sort((a, b) => {
      const score = (reel: number) => before[reel].filter((cell) => cell.s === "brick" && !cell.part).length;
      return score(b) - score(a);
    });
    for (const reel of ranked) {
      const col = before[reel];
      const up = rng() < 0.5;
      const shifted: SplashCell[] = up
        ? [{ ...col[1] }, { ...col[2] }, { s: "splash" }]
        : [{ s: "splash" }, { ...col[0] }, { ...col[1] }];
      const work: (SplashCell | null)[][] = before.map((column, i) => (i === reel ? shifted : column.map((cell) => ({ ...cell }))));
      commit(work);
      if (countSym(grid, "splash") > 0 && countAnchors(grid) > 0) return { kind: "hook", reel, shift: up ? "up" : "down" };
      revert();
    }
  }
  return undefined;
}

export function meterLevel(wilds: number): number {
  if (wilds >= 12) return 3;
  if (wilds >= 8) return 2;
  if (wilds >= 4) return 1;
  return 0;
}

/** Multiplier already reached. Wilds landing this spin do not raise it until the next one. */
export function collectMult(wilds: number): number {
  return LEVEL_MULT[meterLevel(wilds)];
}

/** Ten extra spins when the catch crosses 4, 8, or 12. Nothing after ×10. `bonus` is the +2 upgrade, added on every retrigger. */
export function extraSpinsFor(before: number, after: number, bonus = 0): number {
  const cap = 12;
  const from = Math.floor(Math.min(cap, Math.max(0, before)) / 4);
  const to = Math.floor(Math.min(cap, Math.max(0, after)) / 4);
  return Math.max(0, to - from) * (10 + bonus);
}

export function scatterPayFor(stake: number, scatters: number): number {
  const n = Math.max(0, Math.min(SCATTER_PAY.length - 1, scatters));
  return Math.round(stake * SCATTER_PAY[n]);
}

function awardFor(scatters: number): number {
  if (scatters >= 5) return 20;
  if (scatters >= 4) return 15;
  if (scatters >= 3) return 10;
  return 0;
}

export function lineHit(grid: SplashCell[][], rows: readonly number[]): { s: Sym; n: number; mult: number } | null {
  const seq = rows.map((row, reel) => grid[reel][row].s);
  let target: Sym | null = null;
  for (const sym of seq) {
    if (sym !== "splash") {
      target = sym;
      break;
    }
  }
  if (target == null) {
    return seq.length >= 3 ? { s: "duffel", n: seq.length, mult: PAY.duffel[seq.length - 3] } : null;
  }
  if (!PAYING.has(target)) {
    let n = 0;
    for (const sym of seq) {
      if (sym !== "splash") break;
      n += 1;
    }
    return n >= 3 ? { s: "duffel", n, mult: PAY.duffel[n - 3] } : null;
  }
  let n = 0;
  for (const sym of seq) {
    if (sym !== target && sym !== "splash") break;
    n += 1;
  }
  if (n < 3) return null;
  return { s: target, n, mult: PAY[target][n - 3] };
}

function fitPays(lines: SplashLine[], budget: number): SplashLine[] {
  const sum = lines.reduce((n, line) => n + line.pay, 0);
  if (budget >= sum) return lines;
  if (budget <= 0 || sum <= 0) return [];
  let left = budget;
  const pays = lines.map((line) => {
    const pay = Math.min(line.pay, left, Math.floor((line.pay * budget) / sum));
    left -= pay;
    return pay;
  });
  for (let i = pays.length - 1; i >= 0 && left > 0; i--) {
    const room = Math.min(lines[i].pay - pays[i], left);
    pays[i] += room;
    left -= room;
  }
  return lines.flatMap((line, index) => (pays[index] > 0 ? [{ ...line, pay: pays[index] }] : []));
}

/** Lines are kept first. Whatever is left of the room goes to the collect or scatter pay. */
export function fitAward(lines: SplashLine[], extra: number, room: number): { lines: SplashLine[]; extra: number } {
  const lineSum = lines.reduce((n, line) => n + line.pay, 0);
  if (lineSum + extra <= room) return { lines, extra };
  if (room <= 0) return { lines: [], extra: 0 };
  if (lineSum >= room) return { lines: fitPays(lines, room), extra: 0 };
  return { lines, extra: room - lineSum };
}

function linePays(stake: number, grid: SplashCell[][]): { lines: SplashLine[]; sum: number } {
  const lines: SplashLine[] = [];
  let sum = 0;
  PAYLINES.forEach((rows, i) => {
    const hit = lineHit(grid, rows);
    if (!hit) return;
    const pay = Math.round(stake * hit.mult);
    if (pay <= 0) return;
    sum += pay;
    lines.push({ i, s: hit.s, n: hit.n, pay });
  });
  return { lines, sum };
}

function runFeature(
  stake: number,
  rng: Rng,
  spins: number,
  table: Weight[],
  money: [number, number][],
  banked: number,
  room: number,
  mods: SplashMod[],
): { free: SplashFree[]; total: number; capped: boolean } {
  let left = spins;
  let wilds = banked;
  let total = 0;
  let capped = false;
  const free: SplashFree[] = [];
  while (left > 0 && free.length < 200) {
    if (total >= room) {
      capped = true;
      break;
    }
    left -= 1;
    const grid = fillGrid(rng, table, money, true);
    const primed = cloneGrid(grid);
    const saved = maybeTool(rng, grid, mods, table);
    const paid = linePays(stake, grid);
    const landed = countSym(grid, "splash");
    const mult = collectMult(wilds);
    const rawGot = landed > 0 ? Math.round(stake * brickSum(grid) * landed * mult) : 0;
    const roomLeft = Math.max(0, room - total);
    const fitted = fitAward(paid.lines, rawGot, roomLeft);
    const lineSum = fitted.lines.reduce((n, line) => n + line.pay, 0);
    const got = fitted.extra;
    const add = lineSum + got;
    const before = wilds;
    wilds += landed;
    let extra = extraSpinsFor(before, wilds, mods.includes("extraSpins") ? 2 : 0);
    const rawAdd = paid.sum + rawGot;
    if (add < rawAdd || total + add >= room) {
      extra = 0;
      left = 0;
      capped = true;
    } else {
      left += extra;
    }
    total += add;
    free.push({
      grid,
      lines: fitted.lines,
      scatters: 0,
      scatterPay: 0,
      wilds: landed,
      mult,
      got,
      left,
      level: meterLevel(wilds),
      extra,
      ...(saved ? { tool: saved.kind, primed, ...(saved.reel == null ? {} : { toolReel: saved.reel }), ...(saved.shift ? { toolShift: saved.shift } : {}) } : {}),
    });
    if (capped) break;
  }
  return { free, total, capped };
}

export function playSplash(stake: number, mode: SplashMode, rng: Rng = Math.random): SplashScript {
  const bought = mode === "buy" || mode === "chopper";
  const grid = fillGrid(rng, bought ? BASE_QUIET : mode === "ante" ? ANTE : BASE, MONEY, false);
  if (bought) forceBars(rng, grid, 3);
  const hooked = bought ? null : hookRespin(rng, grid, MONEY);
  const scatters = scatterReels(grid);
  let awarded = bought ? 10 : awardFor(scatters);
  const mods = awarded > 0 ? drawMods(rng) : [];
  if (mods.includes("extraSpins")) awarded += 2;
  const basePay = bought ? { lines: [] as SplashLine[], sum: 0 } : linePays(stake, grid);
  const rawScatter = bought ? 0 : scatterPayFor(stake, scatters);
  const room = splashRoundCap(stake);
  const baseFitted = fitAward(basePay.lines, rawScatter, room);
  const baseSum = baseFitted.lines.reduce((n, line) => n + line.pay, 0) + baseFitted.extra;
  let banked = mode === "chopper" ? 4 : 0;
  if (mods.includes("level2")) banked += 4;
  const feature = awarded
    ? runFeature(
        stake,
        rng,
        awarded,
        tuneTable(mode === "chopper" ? CHOPPER_FS : mode === "buy" ? BUY_FS : FS, mods),
        MONEY,
        banked,
        Math.max(0, room - baseSum),
        mods,
      )
    : { free: [] as SplashFree[], total: 0, capped: false };
  let payout = baseSum + feature.total;
  let capped = feature.capped || baseSum < basePay.sum + rawScatter;
  if (payout > room) {
    payout = room;
    capped = true;
  }
  return {
    mode,
    stake,
    cost: splashCost(stake, mode),
    awarded,
    banked,
    payout,
    capped,
    mods,
    base: {
      grid,
      lines: baseFitted.lines,
      scatters,
      scatterPay: baseFitted.extra,
      ...(hooked ? { hook: hooked.hook, primed: hooked.primed } : {}),
    },
    free: feature.free,
  };
}

export function cosmeticCell(rng: Rng = Math.random, reel = 2, feature = false): SplashCell {
  const table = tableForReel(feature ? FS : BASE, reel, feature);
  const s = pick(rng, table);
  return s === "brick" ? { s, v: pick(rng, MONEY), w: 1, h: 1 } : { s };
}

export const SPLASH_MODES: SplashMode[] = ["spin", "ante", "buy", "chopper"];
