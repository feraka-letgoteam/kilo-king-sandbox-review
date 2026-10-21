import { OVERHAUL_SYMBOL_IDS, overhaulSymbol, overhaulSymbolUrl } from './overhaul-symbols';
/** Artwork only. Keep the current engine, result script, bank and settlement. */
export const ART_ROOT = "/kilo-night-v3/";
export const ART = Object.fromEntries(Object.entries(OVERHAUL_SYMBOL_IDS).map(([key,id])=>[key,overhaulSymbolUrl(id)])) as Record<keyof typeof OVERHAUL_SYMBOL_IDS,string>;
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
export const SYMBOL_ALPHA: Record<string, [number,number,number,number]> = Object.fromEntries(
  Object.entries(OVERHAUL_SYMBOL_IDS).map(([key,id])=>[key,overhaulSymbol(id).runtimeAlphaBounds.map(n=>n*2) as [number,number,number,number]]),
);
export const artUrl = (file: string) => file.startsWith('/') ? file : ART_ROOT + file;
