import { Container, Sprite, type Ticker } from 'pixi.js';

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
} as const;

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
    clear() {
      if (active) host.ticker.remove(frame);
      active = null;
      for (const view of touched) { drop(view); if (!view.destroyed) view.tint = 0xffffff; }
      touched.clear();
    },
  };
}
