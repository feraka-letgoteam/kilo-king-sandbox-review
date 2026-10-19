/** Artwork only. Keep the current engine, result script, bank and settlement. */
export const ART_ROOT = "/kilo-night-v3/";
export const ART = {
  // Restore the approved open letter silhouettes and their original colors.
  // The shared illustrated win motion still gives these a short squash/settle.
  "10": "/kilo-symbols-v47/sym-10.webp",
  "J": "/kilo-symbols-v47/sym-j.webp",
  "Q": "/kilo-symbols-v47/sym-q.webp",
  "K": "/kilo-symbols-v47/sym-k.webp",
  "A": "/kilo-symbols-v47/sym-a.webp",
  "cuffs": "/kilo-v79/symbols/sym-bobber.webp",
  "keys": "/kilo-v79/symbols/sym-cash-roll.webp",
  "lamp": "/kilo-v79/symbols/sym-reel-v8.webp",
  "duffel": "/kilo-v79/symbols/sym-case-v8.webp",
  "brick": "/kilo-v79/symbols/package-small.webp",
  "bars": "/kilo-v79/symbols/scatter-king.webp",
  "splash": "/kilo-v79/characters/collector-idle.webp",
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
  hook: { file: "/kilo-v79/symbols/tool-hook.webp", width: 512, height: 768, x: 256, y: 48 },
  dynamite: {
    file: "/kilo-v79/symbols/tool-dynamite.webp",
    width: 512,
    height: 512,
    x: 256,
    y: 256,
  },
  bazooka: {
    file: "/kilo-v79/symbols/tool-bazooka.webp",
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
  "10": [148, 201, 876, 822],
  J: [119, 132, 906, 892],
  Q: [102, 110, 922, 913],
  K: [143, 162, 883, 862],
  A: [136, 151, 889, 872],
  cuffs: [160, 66, 877, 964],
  keys: [170, 243, 840, 791],
  lamp: [82, 138, 942, 886],
  duffel: [82, 110, 942, 914],
  bars: [82, 196, 942, 827],
};
export const artUrl = (file: string) => file.startsWith('/') ? file : ART_ROOT + file;
