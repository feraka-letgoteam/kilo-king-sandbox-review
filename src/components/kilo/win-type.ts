import { Text } from 'pixi.js';

/** Broad illustrated numerals, a warm face and short hard extrusion. No plate.
 * The font is shipped locally; controls retain their tabular numeric face. */
export const WIN_TYPE = {
  fontFamily: 'Kilo Win', fontWeight: '700' as const,
  face: 0xffdc73, ink: 0x28130c, coolFace: 0xe9fff4,
} as const;

export function createWinNumeral(value: string, size: number, color: number = WIN_TYPE.face) {
  const text = new Text({ text: value, style: {
    fontFamily: WIN_TYPE.fontFamily, fontWeight: WIN_TYPE.fontWeight,
    fontSize: size, fill: color, align: 'center',
    stroke: { color: WIN_TYPE.ink, width: Math.max(1.5, size * .060), join: 'round' },
    dropShadow: { color: 0x8d451b, alpha: 1, angle: Math.PI / 2,
      blur: 0, distance: Math.max(1.5, size * .045) },
  }});
  text.anchor.set(.5);
  return text;
}

/** A quick ink-stamp arrival, with one overshoot and one weighted settle. */
export function connectedNumberScale(progress: number, reduced = false) {
  if (reduced) return 1;
  const t = Math.max(0, Math.min(1, progress));
  const smooth = (u: number) => { const n = Math.max(0, Math.min(1, u)); return n * n * (3 - 2 * n); };
  if (t < .12) return .69 - .05 * smooth(t / .12);
  if (t < .35) return .64 + .61 * smooth((t-.12) / .23);
  if (t < .75) return 1.25 - .295 * smooth((t - .35) / .40);
  return .955 + .045 * smooth((t - .75) / .25);
}
