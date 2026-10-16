/** Symbol pass. Tier comes from the recorded cell value, never stake or payout.
 *  Cash packages and the KING scatter live in /kilo-contraband-v1/.
 *  Bounds are that delivery's own alpha. Do not reuse the fish rectangles.
 */
export const FISH_LADDER = [
  2, 5, 10, 15, 20, 25, 50, 100, 200, 500, 1000, 2000, 5000,
] as const;

export const V8_ROOT = "/kilo-symbols-v8/";
export const CONTRABAND_ROOT = "/kilo-contraband-v1/";

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
  "sym-reel-v8": {
    file: "sym-reel-v8.png",
    width: 1254,
    height: 1254,
    bounds: [39, 249, 1221, 1075],
  },
  "sym-case-v8": {
    file: "sym-case-v8.png",
    width: 1254,
    height: 1254,
    bounds: [44, 56, 1234, 1209],
  },
};

/** Measured from the delivered canvases. Placement only; the PNG alpha stays whole. */
export const PACKAGE_META: Record<PackageKey, ArtMeta> = {
  "package-small": {
    file: "package-small.png",
    width: 1254,
    height: 1254,
    bounds: [50, 335, 1211, 992],
  },
  "package-medium": {
    file: "package-medium.png",
    width: 1254,
    height: 1254,
    bounds: [27, 292, 1237, 1016],
  },
  "package-trophy": {
    file: "package-trophy.png",
    width: 1254,
    height: 1254,
    bounds: [20, 203, 1236, 1113],
  },
  "package-king": {
    file: "package-king.png",
    width: 1254,
    height: 1254,
    bounds: [15, 152, 1237, 1095],
  },
};

export const SCATTER_KING: ArtMeta & {
  boxW: number;
  boxH: number;
  cx: number;
  cy: number;
} = {
  file: "scatter-king.png",
  width: 1254,
  height: 1254,
  bounds: [32, 26, 1223, 1220],
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
  if (!(FISH_LADDER as readonly number[]).includes(value)) {
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

/** Whole-sprite acknowledgement. Not a frame animation. Identity outside 0–420ms. */
export function fishReaction(elapsedMs: number, reducedMotion = false) {
  if (reducedMotion || elapsedMs < 0 || elapsedMs >= 420) {
    return { scale: 1, rotation: 0 };
  }
  const p = elapsedMs / 420;
  const wave = Math.sin(Math.PI * p);
  return {
    scale: 1 + 0.035 * wave,
    rotation: -0.025 * Math.sin(2 * Math.PI * p) * wave,
  };
}