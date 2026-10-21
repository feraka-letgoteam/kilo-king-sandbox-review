import { overhaulSymbol } from './overhaul-symbols';
/** Symbol pass. Tier comes from the recorded cell value, never stake or payout.
 *  Cash packages and the KING scatter use the illustrated v79 delivery.
 *  New canvases are uniformly registered into the accepted symbol ink budgets.
 */
export const FISH_LADDER = [
  2, 5, 10, 15, 20, 25, 50, 100, 200, 500, 1000, 2000, 5000,
] as const;

export const V8_ROOT = "/kilo-symbols-v8/";
export const CONTRABAND_ROOT = "/kilo-overhaul-v1/symbols/runtime/base/";

export type V8Key =
  | "fish-small"
  | "fish-medium"
  | "fish-trophy"
  | "fish-king"
  | "sym-reel-v8"
  | "sym-case-v8";

export type PackageKey =
  | "package-small"
  | "package-medium"
  | "package-trophy"
  | "package-king";

type Bounds = readonly [number, number, number, number];

type ArtMeta = { file: string; width: number; height: number; bounds: Bounds };
const drawingMeta=(id:string):ArtMeta=>({file:id+'.webp',width:512,height:512,bounds:overhaulSymbol(id).runtimeAlphaBounds as unknown as Bounds});

export const V8_META: Record<V8Key, ArtMeta> = {
  "fish-small": {
    file: "fish-small.png",
    width: 1254,
    height: 1254,
    bounds: [43, 234, 1213, 878],
  },
  "fish-medium": {
    file: "fish-medium.png",
    width: 1254,
    height: 1254,
    bounds: [33, 172, 1239, 881],
  },
  "fish-trophy": {
    file: "fish-trophy.png",
    width: 1254,
    height: 1254,
    bounds: [20, 151, 1238, 1046],
  },
  "fish-king": {
    file: "fish-king.png",
    width: 1254,
    height: 1254,
    bounds: [21, 152, 1237, 951],
  },
  "sym-reel-v8": drawingMeta('sym-reel-v8'),
  "sym-case-v8": drawingMeta('sym-case-v8'),
};

/** Measured from the delivered canvases. Placement only; the PNG alpha stays whole. */
export const PACKAGE_META: Record<PackageKey, ArtMeta> = {
  'package-small':drawingMeta('package-small'),
  'package-medium':drawingMeta('package-medium'),
  'package-trophy':drawingMeta('package-trophy'),
  'package-king':drawingMeta('package-king'),
};

export const SCATTER_KING: ArtMeta & {
  boxW: number;
  boxH: number;
  cx: number;
  cy: number;
} = {
  ...drawingMeta('scatter-king'),
  boxW: 0.82,
  boxH: 0.82,
  cx: 0.5,
  cy: 0.5,
};

const TIERS = [
  // Width is the binding fit. Each step is wider and taller than the last.
  // The 1.035 reaction still stays inside the cell and above the value plaque.
  { key: "small", max: 5, asset: "package-small" as const, width: 0.64, height: 0.46, centerY: 0.37 },
  { key: "medium", max: 25, asset: "package-medium" as const, width: 0.74, height: 0.56, centerY: 0.37 },
  { key: "trophy", max: 200, asset: "package-trophy" as const, width: 0.8, height: 0.7, centerY: 0.37 },
  { key: "king", max: 5000, asset: "package-king" as const, width: 0.92, height: 0.72, centerY: 0.37 },
] as const;

export type FishTier = (typeof TIERS)[number];

export function fishTier(value: number): FishTier {
  // The recorded Chopper book also contains 0.5x and 1x cargo. They share
  // the lowest visual tier; this does not add values to the base-game ladder.
  if (!(FISH_LADDER as readonly number[]).includes(value) && value !== .5 && value !== 1) {
    throw new RangeError(`Unknown recorded package value: ${value}`);
  }
  return TIERS.find((tier) => value <= tier.max)!;
}

/** Full-source destination. Visible bounds fit the budget; aspect ratio stays intact. */
export function placement(
  meta: { width: number; height: number; bounds: Bounds },
  cellSize: number,
  boxWidth: number,
  boxHeight: number,
  centerY = 0.39,
) {
  const [x0, y0, x1, y1] = meta.bounds;
  const scale = Math.min(
    (cellSize * boxWidth) / (x1 - x0),
    (cellSize * boxHeight) / (y1 - y0),
  );
  return {
    x: cellSize / 2 - ((x0 + x1) * scale) / 2,
    y: cellSize * centerY - ((y0 + y1) * scale) / 2,
    width: meta.width * scale,
    height: meta.height * scale,
    scale,
  };
}

/** Short compression, release and weighted settle inside the existing 420ms.
 * Printed values remain separate and still. This is deformation, not new art. */
export function fishReaction(elapsedMs: number, reducedMotion = false) {
  if (reducedMotion || elapsedMs < 0 || elapsedMs >= 420) {
    return { scale: 1, rotation: 0 };
  }
  const p = elapsedMs / 420;
  const smooth = (v: number) => { const t = Math.max(0, Math.min(1, v)); return t*t*(3-2*t); };
  const load = smooth(p / .16) * (1 - smooth((p - .16) / .13));
  const release = Math.sin(Math.PI * Math.max(0, Math.min(1, (p - .19) / .81))) ** 2;
  const recoil = p < .58 ? 0 : Math.sin((p - .58) / .42 * Math.PI * 2) * (1-p) ** 2;
  return {
    scale: 1 - .024 * load + .035 * release + .018 * recoil,
    rotation: .016 * load - .033 * release * Math.sin(Math.PI * p) + .04 * recoil,
  };
}
