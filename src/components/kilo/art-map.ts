/** Artwork only. Keep the current engine, result script, bank and settlement. */
export const ART_ROOT = "/kilo-night-v3/";
export const ART = {
  "10": "sym-10.png",
  J: "sym-j.png",
  Q: "sym-q.png",
  K: "sym-k.png",
  A: "sym-a.png",
  cuffs: "sym-bobber.png",
  keys: "sym-can.png",
  lamp: "sym-reel.png",
  duffel: "sym-case.png",
  brick: "sym-bass.png",
  bars: "sym-scatter.png",
  splash: "sym-wild.png",
} as const;
export const HERO = {
  idle: "hero-idle.png",
  cast: "hero-cast.png",
  cheer: "hero-cheer.png",
  slump: "hero-slump.png",
  bust: "hero-bust.png",
} as const;
export const SOURCE_SLICES = {
  reel: {
    width: 1800,
    height: 1120,
    left: 150,
    top: 130,
    right: 150,
    bottom: 170,
  },
  panel: { width: 900, height: 600, left: 80, top: 80, right: 80, bottom: 80 },
} as const;
export const TOOL_PIVOTS = {
  hook: { file: "tool-hook.png", width: 512, height: 768, x: 256, y: 48 },
  dynamite: {
    file: "tool-dynamite.png",
    width: 512,
    height: 512,
    x: 256,
    y: 256,
  },
  bazooka: {
    file: "tool-bazooka.png",
    width: 768,
    height: 384,
    x: 700,
    y: 192,
  },
} as const;
export const HERO_BASELINE = {
  width: 1536,
  height: 2304,
  x: 768,
  y: 2166,
} as const;
/** Visible alpha bounds as left, top, right, bottom on the 1024 canvas. Bass and wild use the full canvas. */
export const SYMBOL_ALPHA: Record<string, [number, number, number, number]> = {
  "10": [82, 200, 942, 823],
  J: [117, 82, 907, 942],
  Q: [82, 109, 942, 915],
  K: [82, 161, 942, 863],
  A: [82, 150, 942, 874],
  cuffs: [145, 82, 879, 942],
  keys: [191, 82, 833, 942],
  lamp: [82, 138, 942, 886],
  duffel: [82, 110, 942, 914],
  bars: [82, 196, 942, 827],
};
export const artUrl = (file: string) => ART_ROOT + file;
