import { Container, type Ticker } from 'pixi.js';

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
export type WinFeelHost = {
  /** Standing cell container at a board position, or null while rebuilding. */
  view: (reel: number, row: number) => Container | null;
  pace: () => { turbo: boolean; reduced: boolean };
  ticker: Ticker;
};

/**
 * Persistent win state: dims the losers while the win shows and restores on
 * clear() (next spin / collection / skip). It rebinds to fresh cell views
 * every frame, so a resize that repaints the board keeps the same state.
 */
export function createWinFeel(host: WinFeelHost) {
  let active: { winners: Set<string>; t0: number } | null = null;
  const touched = new Set<Container>();
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
      view.tint = active.winners.has(`${reel}:${row}`) ? 0xffffff : dimTint(level);
    }
  };
  return {
    /** Begin presenting a win on these recorded winning cells. */
    start(cells: readonly Spot[]) {
      this.clear();
      active = { winners: new Set(cells.map(p => `${p.reel}:${p.row}`)), t0: performance.now() };
      host.ticker.add(frame);
      frame();
    },
    clear() {
      if (active) host.ticker.remove(frame);
      active = null;
      for (const view of touched) if (!view.destroyed) view.tint = 0xffffff;
      touched.clear();
    },
  };
}
