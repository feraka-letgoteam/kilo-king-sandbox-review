import type { Graphics } from 'pixi.js';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Deterministic 0..1 hash: a fixed pattern, never a source of results. */
const hash = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const SMOKE = [0x1c262d, 0x232e36, 0x2d3840, 0x353a3c, 0x3a332e] as const;
const DUST = [0x56616a, 0x66706f, 0x77705f] as const;
type Puff = { x: number; y: number; r: number; sx: number; color: number; edge: boolean; seed: number; layer: 0 | 1 | 2 };
type Target = Pick<Graphics, 'clear' | 'ellipse' | 'rect'>;

/** Soft ellipse: eight faint stacked rings, densest at the centre. The outer
 * edge is ~8% opaque, so billows have soft transparent edges, no outline.
 * alpha 1 adds an opaque core (used only while the burst must hide the reel). */
function soft(g: Target, x: number, y: number, r: number, sx: number, color: number, alpha: number, core: number) {
  if (alpha <= .002 || r <= .5) return;
  for (let i = 0; i < 8; i++) {
    const k = 1 - i * (1 - core) / 8;
    g.ellipse(x, y, r * k * sx, r * k).fill({ color, alpha: Math.min(1, alpha) * .11 });
  }
  if (alpha >= 1) g.ellipse(x, y, r * core * sx, r * core).fill({ color, alpha: 1 });
}
const shade = (c: number, f: number) => {
  const ch = (s: number) => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * f)));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};
/** A billow with volume: shadowed underside, body, lit top. */
function billow(g: Target, x: number, y: number, r: number, sx: number, color: number, alpha: number, core: number) {
  soft(g, x + r * .12, y + r * .16, r * .92, sx, shade(color, .62), alpha * .9, core);
  soft(g, x, y, r * .9, sx, color, alpha, core);
  soft(g, x - r * .2, y - r * .26, r * .56, sx, shade(color, 1.3), alpha * .5, .3);
}

/** Procedural smoke/dust burst over the rectangle (x0,y0)-(x1,y1).
 * cover 0..1: a muzzle flash opens into layered billows (varied size, tone and
 * shape, warm rim from the flash). At cover 1 an opaque block sits under the
 * billows, so the area is fully hidden for the swap.
 * clearing 0..1: the billows drift up and outward, swell and thin, edges first. */
export function paintSmokeBurst(g: Target, x0: number, y0: number, x1: number, y1: number,
  cover: number, clearing: number, tone: number) {
  g.clear();
  if (cover <= 0 || clearing >= 1) return;
  const w = x1 - x0, h = y1 - y0, cx = x0 + w / 2, cy = y0 + h * .56, reach = Math.hypot(w, h) * .5;
  const grow = cover < 1 ? 1 - (1 - cover) ** 3 : 1, fade = (1 - clearing) ** .75;
  const rows = 5, cols = Math.max(3, Math.round(w / (h / rows))), step = Math.max(w / cols, h / rows);
  const puffs: Puff[] = [];
  // Back billows: few, large, dark.
  for (let i = 0; i < Math.max(4, Math.round(cols * rows * .35)); i++) {
    const a = hash(i + 101), b = hash(i + 151);
    puffs.push({ x: x0 + w * a, y: y0 + h * b, r: step * (1.5 + hash(i + 201) * .7), sx: 1 + hash(i + 251) * .35,
      color: SMOKE[Math.floor(hash(i + 301) * 3)]!, edge: false, seed: hash(i + 351), layer: 0 });
  }
  // Mid puffs on a loose lattice; the edge ring is unjittered so the opaque
  // block's straight edges always sit under puff cores.
  for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) {
    const n = i * 17 + j * 5, edge = i === 0 || j === 0 || i === cols || j === rows, jit = edge ? 0 : step * .8;
    puffs.push({ x: x0 + w * (i / cols) + (hash(n) - .5) * jit, y: y0 + h * (j / rows) + (hash(n + 3) - .5) * jit,
      r: step * (edge ? .95 + hash(n + 7) * .3 : .7 + hash(n + 7) * .7), sx: .9 + hash(n + 9) * .45,
      color: SMOKE[Math.floor(hash(n + 11) * SMOKE.length)]!, edge, seed: hash(n + 13), layer: 1 });
  }
  // Lit dust tufts on top.
  for (let i = 0; i < Math.round(cols * rows * .6); i++) {
    puffs.push({ x: x0 + w * hash(i + 501), y: y0 + h * hash(i + 551), r: step * (.35 + hash(i + 601) * .4), sx: 1.1 + hash(i + 651) * .5,
      color: DUST[Math.floor(hash(i + 701) * DUST.length)]!, edge: false, seed: hash(i + 751), layer: 2 });
  }
  const lift = clearing * h * .26, spread = 1 + clearing * .5;
  const place = (p: Puff) => {
    const d = Math.hypot(p.x - cx, p.y - cy) / reach, k = clamp01((grow - d * .7) / .3);
    // Clearing: up and out, swell, thin; the outside clears before the middle.
    const thin = clamp01(fade * (1.3 - d * .45 * clearing) - clearing * .06);
    return { x: cx + (p.x - cx) * spread + (p.seed - .5) * step * .6 * clearing, y: cy + (p.y - cy) * spread - lift * (.5 + p.seed),
      r: p.r * (.35 + .65 * k) * (1 + clearing * (.3 + p.seed * .4)), a: thin * Math.min(1, k * 1.6), d };
  };
  const placed = puffs.map(p => ({ p, q: place(p) }));
  // Muzzle flash at the heart of the burst while it opens.
  const flash = clamp01(1 - cover * 1.2);
  if (flash > 0) soft(g, cx, cy, reach * (.2 + .55 * grow), 1.15, 0xfff0c8, flash, .25);
  // Warm rim: flash-lit edge behind the outer billows, cooling as it clears.
  const warm = (1 - clearing) ** 2 * (.45 + .4 * flash);
  for (const { p, q } of placed) if ((p.edge || p.layer === 0) && q.a > 0) {
    const ux = (q.x - cx) / (Math.hypot(q.x - cx, q.y - cy) || 1), uy = (q.y - cy) / (Math.hypot(q.x - cx, q.y - cy) || 1);
    soft(g, q.x + ux * q.r * .22, q.y + uy * q.r * .22, q.r * .8, p.sx, tone, warm * q.a * .55, .4);
  }
  if (cover >= 1 && clearing <= 0) g.rect(x0, y0, w, h).fill({ color: SMOKE[0], alpha: 1 });
  const solid = clearing <= 0 && cover >= 1;
  for (const layer of [0, 1] as const)
    for (const { p, q } of placed) if (p.layer === layer && q.a > 0)
      billow(g, q.x, q.y, q.r, p.sx, p.color, solid && p.edge ? 1 : q.a * (layer === 0 ? .9 : 1), p.edge ? .66 : .42);
  for (const { p, q } of placed) if (p.layer === 2 && q.a > 0) {
    const warmTuft = q.d < .45 && clearing < .5;
    billow(g, q.x - q.r * .15, q.y - q.r * .2, q.r, p.sx, warmTuft ? 0x9a8468 : p.color, q.a * .45, .3);
  }
}
