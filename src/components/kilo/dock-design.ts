import { MARINA, materialDefs } from "./material.ts";
/** One geometry source for the HTML controls, decorative SVG and offline proofs.
 * Coordinates are CSS pixels; feature state never changes this geometry. */
export type DockRect = { x: number; y: number; w: number; h: number };
const box = (x: number, y: number, w: number, h: number): DockRect => ({
  x,
  y,
  w,
  h,
});
export function createDockDesign(layout: {
  mode: string;
  reelWidth: number;
  width?: number;
  artLeft: number;
  dock: number;
  compact?: boolean;
}) {
  const phone = layout.mode === "portrait",
    side = layout.mode === "landscape";
  const w = side
      ? layout.width!
      : phone
        ? layout.reelWidth
        : Math.max(760, layout.reelWidth),
    h = layout.dock;
  let turbo: DockRect,
    menu: DockRect,
    balance: DockRect,
    win: DockRect,
    bet: DockRect,
    auto: DockRect,
    spin: DockRect,
    charge: DockRect,
    feature: DockRect,
    ante: DockRect;
  if (layout.compact) {
    const footer = layout.reelWidth,
      read = (footer - 80) / 2;
    balance = box(0, h - 44, read, 44);
    win = box(read, h - 44, read, 44);
    bet = box(footer - 80, h - 44, 80, 44);
    menu = box(w - 54, 0, 44, 44);
    spin = box(w - 64, 51, 64, 64);
    feature = box(w - 54, 128, 44, 44);
    turbo = auto = ante = box(0, 0, 0, 0);
  } else if (phone) {
    balance = box(0, 0, w / 2 - 4, 36);
    win = box(w / 2 + 4, 0, w / 2 - 4, 36);
    bet = box(0, 44, w - 148, 100);
    spin = box(w - 136, 36, 80, 80);
    feature = box(w - 44, 52, 44, 44);
    turbo = box(w - 144, 116, 44, 44);
    menu = box(w - 96, 116, 44, 44);
    auto = box(w - 48, 116, 44, 44);
    ante = box(bet.x, bet.y + 56, bet.w, 44);
  } else if (side) {
    const rx = w - 96,
      sy = (h - 206) / 2;
    menu = box(0, 0, 44, 44);
    feature = box(84, 0, 44, 44);
    balance = box(8, 52, 112, 36);
    win = box(8, 94, 112, 36);
    bet = box(0, 140, 128, 132);
    ante = box(0, 228, 128, 44);
    auto = box(rx + 26, sy, 44, 44);
    spin = box(rx, sy + 48, 96, 96);
    turbo = box(rx + 26, sy + 148, 44, 44);
  } else {
    turbo = box(4, 28, 44, 44);
    menu = box(56, 28, 44, 44);
    feature = box(w - 56, 22, 56, 56);
    spin = box(w - 164, 0, 100, 100);
    auto = box(w - 216, 28, 44, 44);
    bet = box(w - 368, 6, 144, 88);
    const rw = (w - 504) / 2;
    balance = box(112, 20, rw, 60);
    win = box(124 + rw, 20, rw, 60);
    ante = box(bet.x, bet.y + 44, bet.w - 44, 44);
  }
  // The charge is engraved into the action face, never orphaned under the bet.
  charge = box(
    spin.x + spin.w * 0.1,
    spin.y + spin.h * 0.62,
    spin.w * 0.8,
    layout.compact ? 13 : 16,
  );
  const vertical = !phone;
  const betButton = layout.compact
    ? box(0, 0, bet.w, bet.h)
    : vertical
      ? box(0, 0, bet.w - 44, side ? 88 : 44)
      : box(44, 0, bet.w - 88, 56);
  const minus = vertical ? box(bet.w - 44, 44, 44, 44) : box(0, 6, 44, 44);
  const plus = vertical
    ? box(bet.w - 44, 0, 44, 44)
    : box(bet.w - 44, 6, 44, 44);
  return {
    width: w,
    height: h,
    offset: 0,
    variant: layout.compact
      ? "mini"
      : phone
        ? "phone"
        : side
          ? "side"
          : "inline",
    turbo,
    menu,
    balance,
    win,
    bet,
    betButton,
    minus,
    plus,
    auto,
    spin,
    charge,
    feature,
    ante,
    steps: !layout.compact,
    readInset: layout.compact ? 0 : phone ? 8 : side ? 4 : 12,
  };
}
export type DockDesign = ReturnType<typeof createDockDesign>;
export const dockPlacement = (r: DockRect) => ({
  left: r.x,
  top: r.y,
  width: r.w,
  height: r.h,
});
export function dockAmountSize(
  value: string,
  rect: DockRect,
  preferred: number,
) {
  // Conservative advances for the shipped tabular face, verified with its font metrics.
  const advance = [...value].reduce(
    (sum, ch) => sum + (ch === "," ? 0.26 : 0.55),
    0,
  );
  return Math.min(preferred, Math.floor((rect.w - 4) / Math.max(advance, 1)));
}
export function dockChargeSize(d: DockDesign, value: string) {
  return dockAmountSize(
    value,
    { ...d.charge, w: d.charge.w - (d.variant === "mini" ? 0 : 16) },
    d.variant === "mini" ? 10 : d.variant === "phone" ? 12 : 13,
  );
}
function cut(r: DockRect, c = 9) {
  const { x, y, w, h } = r;
  return `M${x + c} ${y}H${x + w - c}L${x + w} ${y + c}V${y + h - c}L${x + w - c} ${y + h}H${x + c}L${x} ${y + h - c}V${y + c}Z`;
}
/** Static, trusted artwork only. No player data or user text is interpolated. */
export function dockPaint(d: DockDesign, prefix = "kk-dock") {
  const { width: w, height: h, variant } = d;
  const mobile = variant === "phone",
    side = variant === "side";
  // Brushed brass lip, dark enamel face and recessed instrument wells.
  // Hardware stays outside the text safe areas; artwork never changes hit areas.
  let art = materialDefs(prefix);
  const plate = (r: DockRect) => {
    let p = `<path d="${cut(r, 8)}" fill="url(#${prefix}-metal)"/>`;
    const face = cut(box(r.x + 4, r.y + 4, r.w - 8, r.h - 8), 5);
    p += `<path d="${face}" fill="url(#${prefix}-enamel)" stroke="#020b10" stroke-width="1.5"/>`;
    p += `<path d="${face}" fill="url(#${prefix}-grain)"/>`;
    p += `<path d="M${r.x + 16} ${r.y + 7}H${r.x + r.w - 16}" stroke="${MARINA.teal}" stroke-opacity=".35"/>`;
    for (const x of [r.x + 7, r.x + r.w - 7]) {
      p += `<path d="M${x} ${r.y + 12}v${Math.min(10, r.h - 24)}" stroke="#bea16a" stroke-width="2"/>`;
    }
    return p;
  };
  if (variant === "mini") {
    art += plate(box(0, h - 44, d.bet.x + d.bet.w, 44));
    art += plate(box(w - 68, 0, 68, 122));
  } else if (side) {
    art += plate(box(0, 46, 128, 230));
    art += plate(box(w - 96, (h - 206) / 2 - 6, 96, 206));
  } else if (mobile) {
    art += plate(box(0, 0, w, 36));
    art += plate(box(0, 42, w - 50, 114));
    art += plate(box(w - 148, 112, 148, 48));
  } else {
    art += plate(box(0, 10, w - 64, 80));
  }
  for (const r of [d.balance, d.win, d.bet]) {
    const inset = variant === "mini" ? 0.5 : 1;
    art += `<path d="${cut(box(r.x + inset, r.y + inset, r.w - inset * 2, r.h - inset * 2), 4)}" fill="url(#${prefix}-well)" stroke="${MARINA.brassShade}" stroke-width="2"/>`;
    art += `<path d="M${r.x + 6} ${r.y + 3}H${r.x + r.w - 6}" stroke="#00070b" stroke-width="3"/>`;
    art += `<path d="M${r.x + 6} ${r.y + r.h - 2}H${r.x + r.w - 6}" stroke="${MARINA.brassReturn}" stroke-opacity=".4"/>`;
  }
  return art;
}
