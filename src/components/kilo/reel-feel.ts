import { Container, Graphics, Sprite, type Text, type Ticker } from 'pixi.js';
import { createWinNumeral, connectedNumberScale, WIN_TYPE } from './win-type';

/**
 * Reel-feel presentation pass (w Bo). Pure presentation: nothing here reads
 * or writes an award, a stored result, the RNG or the event order. Every
 * curve is a deterministic function of elapsed time since a recorded beat.
 */
export const REEL_FEEL = {
  /** Brightness of non-winning symbols while a win is presented (0..1). */
  dimLevel: 0.33,
  /** Dim tween length, normal / turbo (ms). Reduced motion applies instantly. */
  dimMs: 150,
  dimTurboMs: 80,
  /** Winner pop: peak scale, ease-out length normal / turbo (ms). */
  popScale: 1.12,
  popMs: 180,
  popTurboMs: 100,
  /** Looping pulse after the pop: scale dip below the peak and period (ms). */
  pulseDepth: 0.025,
  pulseMs: 1100,
  /** Additive glow copy of the winning drawing: peak alpha of the pulse. */
  glowAlpha: 0.22,
  /** Fraction of the cell the popped cell content may fill (reel mask safety). */
  fitInset: 0.99,
  /** On-symbol amounts: size as a fraction of the cell, CSS-px floor, and the
   * label centre below the cell centre (fraction of the cell). */
  amountCell: 0.19,
  amountMinCss: 12,
  amountDrop: 0.33,
  /** Slim full-radius pill behind each amount: fill alpha, horizontal
   * padding and total height in ems (0.7x the 0003 plate), a mint edge so it
   * never reads as a gold-edged fish-value plaque, and the type colour. */
  plateAlpha: 0.8,
  platePadX: 0.36,
  plateHeight: 0.81,
  plateFill: 0x041a1d,
  plateEdge: 0x3cf2c8,
  plateEdgeAlpha: 0.95,
  amountInk: 0xfffbea,
  /** Smaller centre total (Kilo Win numeral, outlined, no plate) shown with
   * the on-symbol amounts: size as a fraction of the cell and a CSS-px floor.
   * Placed at whichever low/between-row slot covers the fewest winners. */
  totalCell: 0.29,
  totalMinCss: 14,
  /** Stamp-in length for the amounts (ms); static with reduced motion. */
  amountMs: 260,
} as const;

/**
 * Where each recorded line's amount sits: on the last winning symbol of that
 * line (a non-wild one when the line has one, so the WILD tag stays clear).
 * Lines ending on the same symbol share one label showing their sum, so
 * every label is a component of the recorded total and the labels add up to
 * it exactly. Amounts are bare numbers; the caller formats them.
 */
export function amountSpots<L extends { pay: number }>(
  lines: readonly L[],
  cellsOf: (line: L) => readonly Spot[],
  symAt: (reel: number, row: number) => string | undefined,
) {
  const out = new Map<string, Spot & { value: number }>();
  for (const line of lines) {
    if (!(line.pay > 0)) continue;
    const spots = cellsOf(line);
    const plain = spots.filter(p => symAt(p.reel, p.row) !== 'splash');
    const at = (plain.length ? plain : spots).at(-1);
    if (!at) continue;
    const key = `${at.reel}:${at.row}`;
    const hit = out.get(key) ?? { reel: at.reel, row: at.row, value: 0 };
    hit.value += line.pay; out.set(key, hit);
  }
  return [...out.values()];
}

type Box = { x: number; y: number; w: number; h: number };
const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2))
  * Math.max(0, Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2));

/**
 * Where the centre total sits: candidates on the grid's bottom edge and on
 * the two row seams, at the grid centre, each reel gap and each reel centre.
 * The chosen slot covers the least winning-symbol area (and none of the
 * on-symbol amounts if it can), then the least symbol area overall, then
 * stays nearest the low centre. Pure geometry; deterministic.
 */
export function totalSpot(
  center: (reel: number, row: number) => { x: number; y: number },
  cell: number,
  winners: ReadonlySet<string>,
  tags: readonly Box[],
  w: number,
  h: number,
) {
  const left = center(0, 0).x - cell / 2, right = center(4, 0).x + cell / 2, mid = (left + right) / 2;
  const top = center(0, 0).y - cell / 2, bottom = center(0, 2).y + cell / 2;
  const xs = [mid];
  for (let r = 0; r < 5; r++) { xs.push(center(r, 0).x); if (r < 4) xs.push((center(r, 0).x + center(r + 1, 0).x) / 2); }
  const ys = [bottom, (center(0, 1).y + center(0, 2).y) / 2, (center(0, 0).y + center(0, 1).y) / 2];
  let best = { x: mid, y: bottom, score: Infinity, win: 0 };
  ys.forEach((y0, yi) => xs.forEach((x0) => {
    const x = Math.max(left + w / 2, Math.min(right - w / 2, x0));
    const y = Math.max(top + h / 2, y0), me = { x, y, w, h };
    let win = 0, any = 0, tag = 0;
    for (let reel = 0; reel < 5; reel++) for (let row = 0; row < 3; row++) {
      const c = center(reel, row), a = overlap(me, { x: c.x, y: c.y, w: cell, h: cell });
      any += a; if (winners.has(`${reel}:${row}`)) win += a;
    }
    for (const t of tags) tag += overlap(me, t);
    const score = (win + tag) * 50 + any + Math.abs(x - mid) * h * 0.02 + yi * w * h * 0.05;
    if (score < best.score) best = { x, y, score, win };
  }));
  return { x: best.x, y: best.y, coversWinners: best.win > 1e-6 };
}

const unit = (n: number) => Math.max(0, Math.min(1, n));
export const easeOutCubic = (t: number) => 1 - (1 - unit(t)) ** 3;

/** Grey multiply tint for a brightness level; 1 = untouched (0xffffff). */
export function dimTint(level: number) {
  const c = Math.round(255 * unit(level));
  return (c << 16) | (c << 8) | c;
}

/** Brightness of a non-winning symbol `elapsed` ms after the win begins. */
export function dimLevelAt(elapsed: number, ms: number) {
  const p = ms <= 0 ? 1 : easeOutCubic(elapsed / ms);
  return 1 - (1 - REEL_FEEL.dimLevel) * p;
}

type Spot = { reel: number; row: number };

/** Reel stop overshoot. Depth is a fraction of a symbol height; length is
 * kept inside the existing lock window (170 / 110 / 70 ms) so no reel stops
 * later and the stop order and spin clock are unchanged. Super speed: off. */
export const REEL_BOUNCE = {
  depth: { normal: 0.09, turbo: 0.05, super: 0 },
  ms: { normal: 170, turbo: 80, super: 0 },
} as const;
const springRaw = (t: number) => Math.exp(-3 * t) * Math.sin(2 * Math.PI * 0.75 * t) * (1 - t);
const SPRING_PEAK = Math.max(...Array.from({ length: 201 }, (_, i) => springRaw(i / 200)));
/** Damped spring: 0 at the stop, +1 at the overshoot peak (~t 0.25), a small
 * undershoot on the way back, exactly 0 again at t = 1. Positive = past rest
 * in the direction of travel. */
export function reelBounceAt(t: number) {
  return t <= 0 || t >= 1 ? 0 : springRaw(t) / SPRING_PEAK;
}

/** Largest scale about the cell centre that keeps `view`'s current content
 * inside its own cell, so a pop never clips on the reel mask or covers a
 * neighbouring cell. Measured at the view's home (unscaled) pose. */
export function fitScale(view: Container, cell: number, want: number) {
  const b = view.getLocalBounds(), c = cell / 2, edge = cell * (1 - REEL_FEEL.fitInset) / 2;
  let s = want;
  const lim = (d: number) => { if (d > 1e-3) s = Math.min(s, (c - edge) / d); };
  lim(c - b.minX); lim(b.maxX - c); lim(c - b.minY); lim(b.maxY - c);
  return Math.max(1, s);
}

/** Pop to the peak with ease-out, then a gentle dip-and-return pulse that
 * never exceeds the peak. Returns scale and a 0..1 glow phase. */
export function winPoseAt(elapsed: number, popMs: number, peak: number, reduced: boolean) {
  if (reduced) return { scale: 1, glow: 0 };
  if (elapsed < popMs) return { scale: 1 + (peak - 1) * easeOutCubic(elapsed / popMs), glow: unit(elapsed / popMs) };
  const wave = (1 - Math.cos((2 * Math.PI * (elapsed - popMs)) / REEL_FEEL.pulseMs)) / 2;
  return { scale: peak - (peak - 1) / (REEL_FEEL.popScale - 1) * REEL_FEEL.pulseDepth * wave, glow: 1 - wave };
}

type Home = { px: number; py: number; x: number; y: number; peak: number; glow: Sprite | null };
export type WinFeelHost = {
  /** Standing cell container at a board position, or null while rebuilding. */
  view: (reel: number, row: number) => Container | null;
  pace: () => { turbo: boolean; reduced: boolean };
  cell: () => number;
  /** Cell centre in world units, the grid's x extent, and world→CSS scale. */
  center: (reel: number, row: number) => { x: number; y: number };
  gridX: () => { left: number; right: number };
  cssScale: () => number;
  /** Parent for the on-symbol amounts (cleared with the presentation). */
  labels: () => Container;
  format: (value: number) => string;
  ticker: Ticker;
};

/**
 * Persistent win state: dims the losers while the win shows and restores on
 * clear() (next spin / collection / skip). It rebinds to fresh cell views
 * every frame, so a resize that repaints the board keeps the same state.
 */
export function createWinFeel(host: WinFeelHost) {
  let active: { winners: Set<string>; t0: number; popAt: number | null } | null = null;
  const touched = new Set<Container>();
  let tags: { root: Container; plate: Graphics; text: Text; reel: number; row: number; at: number }[] = [];
  let total: { text: Text; at: number } | null = null;
  const paintTags = (now: number, reduced: boolean) => {
    const cell = host.cell(), css = Math.max(.01, host.cssScale());
    const size = Math.max(REEL_FEEL.amountMinCss / css, cell * REEL_FEEL.amountCell);
    const { left, right } = host.gridX();
    for (const tag of tags) {
      const n = tag.text;
      if (n.destroyed || tag.root.destroyed) continue;
      if (n.style.fontSize !== size) {
        n.style.fontSize = size;
        n.style.stroke = { color: 0x0b1f1f, width: Math.max(2, size * .1), join: 'round' };
        // A slim mint-edged pill keeps the amount readable over any drawing
        // and reads differently from the gold-edged fish-value plaque.
        const w = n.width + size * REEL_FEEL.platePadX * 2, h = size * REEL_FEEL.plateHeight;
        tag.plate.clear().roundRect(-w / 2, -h / 2, w, h, h / 2)
          .fill({ color: REEL_FEEL.plateFill, alpha: REEL_FEEL.plateAlpha })
          .stroke({ color: REEL_FEEL.plateEdge, alpha: REEL_FEEL.plateEdgeAlpha, width: Math.max(1, size * .07) });
      }
      const c = host.center(tag.reel, tag.row), half = tag.plate.width / 2 + 1;
      // Bottom of the winning cell, clamped inside the grid.
      tag.root.position.set(Math.max(left + half, Math.min(right - half, c.x)), c.y + cell * REEL_FEEL.amountDrop);
      tag.root.scale.set(reduced ? 1 : connectedNumberScale(unit((now - tag.at) / REEL_FEEL.amountMs)));
    }
    if (total && !total.text.destroyed && active) {
      const n = total.text, tsize = Math.max(REEL_FEEL.totalMinCss / css, cell * REEL_FEEL.totalCell);
      if (n.style.fontSize !== tsize) {
        n.style.fontSize = tsize;
        n.style.stroke = { color: WIN_TYPE.ink, width: Math.max(2, tsize * .07), join: 'round' };
      }
      const boxes = tags.filter(t => !t.root.destroyed).map(t => ({ x: t.root.x, y: t.root.y, w: t.plate.width, h: t.plate.height }));
      const spot = totalSpot(host.center, cell, active.winners, boxes, n.width + 4, n.height * .8);
      n.position.set(spot.x, spot.y);
      n.scale.set(reduced ? 1 : connectedNumberScale(unit((now - total.at) / REEL_FEEL.amountMs)));
    }
  };
  const homes = new WeakMap<Container, Home>();
  const art = (view: Container) => view.children.find((c): c is Sprite => c instanceof Sprite && c.label !== 'kk-win-glow');
  const lift = (view: Container) => {
    let home = homes.get(view);
    if (!home) {
      const cell = host.cell();
      home = { px: view.pivot.x, py: view.pivot.y, x: view.x, y: view.y, peak: fitScale(view, cell, REEL_FEEL.popScale), glow: null };
      homes.set(view, home);
      // Scale about the cell centre; with no scale this is the same placement.
      view.pivot.set(cell / 2, cell / 2);
      view.position.set(home.x + cell / 2 - home.px, home.y + cell / 2 - home.py);
      const source = art(view);
      if (source) {
        const glow = new Sprite(source.texture);
        glow.label = 'kk-win-glow'; glow.blendMode = 'add'; glow.alpha = 0; glow.eventMode = 'none';
        view.addChild(glow); home.glow = glow;
      }
    }
    return home;
  };
  const drop = (view: Container) => {
    const home = homes.get(view);
    if (!home) return;
    homes.delete(view);
    if (view.destroyed) return;
    view.scale.set(1); view.pivot.set(home.px, home.py); view.position.set(home.x, home.y);
    if (home.glow && !home.glow.destroyed) home.glow.destroy();
  };
  const frame = () => {
    if (!active) return;
    const now = performance.now();
    const { turbo, reduced } = host.pace();
    paintTags(now, reduced);
    const level = reduced ? REEL_FEEL.dimLevel
      : dimLevelAt(now - active.t0, turbo ? REEL_FEEL.dimTurboMs : REEL_FEEL.dimMs);
    for (let reel = 0; reel < 5; reel++) for (let row = 0; row < 3; row++) {
      const view = host.view(reel, row);
      if (!view || view.destroyed) continue;
      touched.add(view);
      const winner = active.winners.has(`${reel}:${row}`);
      view.tint = winner ? 0xffffff : dimTint(level);
      if (!winner || active.popAt === null || reduced) continue;
      const home = lift(view);
      const pose = winPoseAt(now - active.popAt, turbo ? REEL_FEEL.popTurboMs : REEL_FEEL.popMs, home.peak, reduced);
      view.scale.set(pose.scale);
      const source = art(view), glow = home.glow;
      if (glow && !glow.destroyed && source) {
        // Follow the drawing's current frame/pose (authored reactions swap it).
        glow.texture = source.texture; glow.anchor.copyFrom(source.anchor);
        glow.scale.copyFrom(source.scale); glow.position.copyFrom(source.position);
        glow.rotation = source.rotation; glow.alpha = REEL_FEEL.glowAlpha * pose.glow;
      }
    }
  };
  return {
    /** Begin presenting a win on these recorded winning cells. */
    start(cells: readonly Spot[]) {
      this.clear();
      active = { winners: new Set(cells.map(p => `${p.reel}:${p.row}`)), t0: performance.now(), popAt: null };
      host.ticker.add(frame);
      frame();
    },
    /** The recorded win is credited: winners pop, then pulse until clear(). */
    pop() {
      if (active && active.popAt === null) active.popAt = performance.now();
    },
    /** Show each line's recorded amount on its winning symbol. */
    amounts(spots: readonly (Spot & { value: number })[]) {
      if (!active) return;
      const parent = host.labels(), now = performance.now();
      for (const spot of spots) {
        const root = new Container(), plate = new Graphics();
        const text = createWinNumeral(host.format(spot.value), 16, REEL_FEEL.amountInk);
        text.style.dropShadow = false;
        root.label = 'kk-symbol-amount'; root.eventMode = 'none';
        root.addChild(plate, text); parent.addChild(root);
        tags.push({ root, plate, text, reel: spot.reel, row: spot.row, at: now });
      }
      paintTags(now, host.pace().reduced);
    },
    /** Smaller centre total alongside the on-symbol amounts (team spec). */
    total(value: number) {
      if (!active) return;
      if (total && !total.text.destroyed) total.text.destroy();
      const text = createWinNumeral(host.format(value), 16);
      text.label = 'kk-centre-total'; text.eventMode = 'none';
      host.labels().addChild(text);
      total = { text, at: performance.now() };
      paintTags(total.at, host.pace().reduced);
    },
    clear() {
      if (total && !total.text.destroyed) total.text.destroy();
      total = null;
      for (const tag of tags) if (!tag.root.destroyed) tag.root.destroy({ children: true });
      tags = [];
      if (active) host.ticker.remove(frame);
      active = null;
      for (const view of touched) { drop(view); if (!view.destroyed) view.tint = 0xffffff; }
      touched.clear();
    },
  };
}

/** Per-symbol landing accents, played on the cell container the moment its
 * reel locks. Self-contained (own tween, own restore), so anticipation or a
 * slow-down can wrap around it without sharing state. Reuses the landed
 * drawing; no new art. Every length is capped by the caller's window. */
export const LAND_ACCENT = {
  /** Fish/value packages: a small rotational flop. */
  flopMs: 160, flopTurn: 0.07,
  /** Bobber: a dip-and-rise bob, fraction of a cell. */
  bobMs: 160, bobDepth: 0.045,
  /** King scatter / collector wild: pop peak, glow alpha, lengths. */
  popScale: 1.07, glowAlpha: 0.5, scatterMs: 260, wildMs: 170,
  /** King scatter shine band: width as a fraction of the cell. */
  shineWidth: 0.2,
} as const;

export type LandAccent = 'flop' | 'bob' | 'scatter' | 'wild';
export function landAccentKind(sym: string | undefined): LandAccent | null {
  return sym === 'brick' ? 'flop' : sym === 'cuffs' ? 'bob' : sym === 'bars' ? 'scatter' : sym === 'splash' ? 'wild' : null;
}

type Tween = (ms: number, step: (t: number) => void) => Promise<void>;
const copyPose = (to: Sprite, from: Sprite) => {
  to.texture = from.texture; to.anchor.copyFrom(from.anchor); to.scale.copyFrom(from.scale);
  to.position.copyFrom(from.position); to.rotation = from.rotation;
};

export function playLandAccent(view: Container, sym: string | undefined, cell: number, maxMs: number, tween: Tween) {
  const kind = landAccentKind(sym);
  if (!kind || view.destroyed || view.label === 'duel-trigger') return Promise.resolve();
  const source = view.children.find((c): c is Sprite => c instanceof Sprite);
  const home = { y: view.y, rotation: view.rotation, sx: view.scale.x, sy: view.scale.y };
  const base = kind === 'flop' ? LAND_ACCENT.flopMs : kind === 'bob' ? LAND_ACCENT.bobMs
    : kind === 'scatter' ? LAND_ACCENT.scatterMs : LAND_ACCENT.wildMs;
  const ms = Math.min(base, maxMs);
  const extras: Container[] = [];
  let glow: Sprite | null = null, band: Graphics | null = null;
  const peak = kind === 'scatter' || kind === 'wild' ? fitScale(view, cell, LAND_ACCENT.popScale) : 1;
  if ((kind === 'scatter' || kind === 'wild') && source) {
    glow = new Sprite(source.texture); glow.blendMode = 'add'; glow.alpha = 0; glow.eventMode = 'none';
    view.addChild(glow); extras.push(glow);
  }
  if (kind === 'scatter' && source) {
    // A light band masked to the crown's own silhouette sweeps across it.
    const mask = new Sprite(source.texture); copyPose(mask, source);
    band = new Graphics(); band.blendMode = 'add'; band.eventMode = 'none';
    const w = cell * LAND_ACCENT.shineWidth;
    for (let i = 0; i < 6; i++) {
      const a = Math.sin(Math.PI * (i + .5) / 6) * .55;
      band.rect(-w / 2 + i * w / 6, -cell, w / 6 + .5, cell * 2).fill({ color: 0xfff3c4, alpha: a });
    }
    band.rotation = 0.42; band.mask = mask;
    view.addChild(mask, band); extras.push(mask, band);
  }
  return tween(ms, (t) => {
    if (view.destroyed) return;
    if (t >= 1) {
      view.y = home.y; view.rotation = home.rotation; view.scale.set(home.sx, home.sy);
      for (const item of extras) if (!item.destroyed) item.destroy();
      return;
    }
    if (kind === 'flop') view.rotation = home.rotation + LAND_ACCENT.flopTurn * Math.sin(3 * Math.PI * t) * (1 - t);
    else if (kind === 'bob') view.y = home.y + cell * LAND_ACCENT.bobDepth * Math.sin(2 * Math.PI * t) * (1 - t);
    else {
      const s = 1 + (peak - 1) * Math.sin(Math.PI * t);
      view.scale.set(home.sx * s, home.sy * s);
      if (glow && source && !glow.destroyed && !source.destroyed) {
        copyPose(glow, source); glow.scale.set(source.scale.x * (1 + .12 * t), source.scale.y * (1 + .12 * t));
        glow.alpha = LAND_ACCENT.glowAlpha * (1 - t);
      }
      if (band && !band.destroyed) band.x = cell * (-0.1 + 1.2 * t);
    }
  });
}
