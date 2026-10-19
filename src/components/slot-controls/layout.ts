import { CONTROL_TOKENS as T } from "./tokens.ts";

export type ControlRect = { x: number; y: number; w: number; h: number };
export type ControlViewport = {
  variant: "desktop" | "portrait" | "landscape" | "compact";
  width: number;
  height: number;
  /** Compact landscape uses the space below the reels for readouts. */
  footerWidth?: number;
};
const rect = (x: number, y: number, w: number, h: number): ControlRect => ({
  x,
  y,
  w,
  h,
});
const absent = () => rect(0, 0, 0, 0);

/** The only breakpoint definitions. No theme assets, game logic or feature state. */
export function createControlLayout(viewport: ControlViewport) {
  const { width: w, height: h, variant } = viewport;
  const { target: t, gap, moduleGap: mg, betPlateHeight: bh } = T;
  const betHitInset = (bh - t * 2) / 2;
  let turbo: ControlRect,
    menu: ControlRect,
    balance: ControlRect,
    win: ControlRect,
    bet: ControlRect,
    auto: ControlRect,
    spin: ControlRect,
    buy: ControlRect,
    betButton: ControlRect,
    minus: ControlRect,
    plus: ControlRect,
    ante: ControlRect;
  let counterY = 0;
  if (variant === "portrait") {
    // One full-width readout row, then Bet / Spin / a 2×2 secondary grid.
    // The grid owns both row/column spacing; no button is folded into Menu.
    const group = Math.min(w, T.portraitGroup),
      gx = (w - group) / 2,
      narrow = group < 320,
      diameter = narrow ? T.narrowSpin : T.mobileSpin,
      actionGap = narrow ? gap : T.portraitModuleGap,
      secondaryGap = narrow ? gap : mg,
      gridY = T.portraitReadout + (narrow ? gap : mg),
      gridHeight = t * 2 + secondaryGap,
      sy = gridY + (gridHeight - diameter) / 2,
      actionRight = w - gx - T.portraitBadgeInset,
      gridX = actionRight - t * 2 - secondaryGap,
      sx = Math.min(
        (w - diameter) / 2,
        narrow
          ? w - gx - diameter - t * 2 - gap * 2
          : gridX - actionGap - diameter,
      ),
      bw = narrow ? sx - gap - gx : Math.min(T.portraitBet, sx - gap - gx),
      ax = narrow ? sx + diameter + gap : gridX,
      rw = (group - gap) / 2;
    balance = rect(gx, 0, rw, T.portraitReadout);
    win = rect(gx + rw + gap, 0, rw, T.portraitReadout);
    spin = rect(sx, sy, diameter, diameter);
    bet = rect(gx, sy + (diameter - bh) / 2, bw, bh);
    counterY = bet.y;
    betButton = rect(0, 0, bw - t, bh);
    plus = rect(bw - t, betHitInset, t, t);
    minus = rect(bw - t, betHitInset + t, t, t);
    ante = absent();
    auto = rect(ax, gridY, t, t);
    buy = rect(ax + t + secondaryGap, gridY, t, t);
    turbo = rect(ax, gridY + t + secondaryGap, t, t);
    menu = rect(buy.x, turbo.y, t, t);
  } else if (variant === "landscape") {
    const left = 128,
      right = T.mobileSpin,
      rx = w - right,
      sy = (h - (t * 2 + right + gap * 2)) / 2;
    menu = rect(0, 0, t, t);
    buy = rect(left - t, 0, t, t);
    balance = rect(0, 52, left, 44);
    win = rect(0, 100, left, 44);
    bet = rect(0, 148 - betHitInset, left, bh);
    counterY = 148;
    betButton = rect(0, 0, left - t, bh);
    plus = rect(left - t, betHitInset, t, t);
    minus = rect(left - t, betHitInset + t, t, t);
    ante = absent();
    auto = rect(rx + (right - t) / 2, sy, t, t);
    // Reserve the same full gap above and below the 8px Spin rim.
    spin = rect(rx, sy + t + gap, right, right);
    turbo = rect(rx + (right - t) / 2, sy + t + gap + right + gap, t, t);
  } else if (variant === "compact") {
    const fw = viewport.footerWidth ?? w - 72,
      read = (fw - 88 - gap * 2) / 2;
    balance = rect(0, h - t, read, t);
    win = rect(read + gap, h - t, read, t);
    bet = rect(fw - 88, h - t, 88, t);
    counterY = bet.y;
    betButton = rect(0, 0, 88, t);
    menu = rect(w - 54, 0, t, t);
    spin = rect(w - T.compactSpin, 52, T.compactSpin, T.compactSpin);
    buy = rect(w - 54, 128, t, t);
    turbo = auto = minus = plus = ante = absent();
  } else if (w >= T.desktopWideThreshold && h >= T.desktopWideSpin) {
    // Reference-sized desktop system. Only controls grow; reel geometry is
    // supplied independently by the host. The existing compact layouts below
    // retain their measured touch targets and portrait allocation.
    const diameter = T.desktopWideSpin,
      secondary = T.desktopWideSecondary,
      well = T.desktopWideWell,
      bw = T.desktopWideBet,
      dg = T.desktopWideGap,
      sg = T.desktopWideSpinGap,
      utility = secondary * 2 + mg,
      group = Math.min(w * T.desktopWideCoverage, T.desktopWideGroup),
      rw =
        (group - utility - bw - secondary * 2 - diameter - dg * 4 - sg * 2) / 2,
      gx = (w - group) / 2,
      wy = (diameter - well) / 2,
      cy = (diameter - secondary) / 2,
      bx = gx + utility + dg,
      wx = bx + rw + dg,
      betX = wx + rw + dg,
      ax = betX + bw + dg,
      sx = ax + secondary + sg;
    turbo = rect(gx, cy, secondary, secondary);
    menu = rect(gx + secondary + mg, cy, secondary, secondary);
    balance = rect(bx, wy, rw, well);
    win = rect(wx, wy, rw, well);
    bet = rect(betX, wy, bw, well);
    betButton = rect(0, 0, bw - t, well);
    plus = rect(bw - t, 0, t, t);
    minus = rect(bw - t, t, t, t);
    ante = absent();
    auto = rect(ax, cy, secondary, secondary);
    spin = rect(sx, 0, diameter, diameter);
    buy = rect(sx + diameter + sg, cy, secondary, secondary);
    counterY = wy;
  } else {
    // Keep the existing well widths; tighten only the spaces between modules.
    const referenceWidth = Math.min(w, T.desktopGroup),
      originalActionWidth = t + gap + T.desktopSpin + gap + 52,
      rw = (referenceWidth - originalActionWidth - mg * 3 - 148 - 112) / 2,
      utilityWidth = t * 2 + gap,
      dg = T.desktopModuleGap,
      sg = T.desktopSpinGap,
      groupWidth =
        utilityWidth + rw * 2 + 148 + t + T.desktopSpin + 52 + dg * 4 + sg * 2,
      groupX = (w - groupWidth) / 2,
      balanceX = groupX + utilityWidth + dg,
      winX = balanceX + rw + dg,
      betX = winX + rw + dg,
      autoX = betX + 148 + dg,
      spinX = autoX + t + sg;
    turbo = rect(groupX, 28, t, t);
    menu = rect(groupX + t + gap, 28, t, t);
    balance = rect(balanceX, 18, rw, 64);
    win = rect(winX, 18, rw, 64);
    bet = rect(betX, 18, 148, bh);
    counterY = 4;
    betButton = rect(0, 0, 104, bh);
    // The 44px hit areas extend above/below the compact 64px plate. The
    // chevron ink stays inside it; these targets retain their old positions.
    plus = rect(104, betHitInset, t, t);
    minus = rect(104, betHitInset + t, t, t);
    ante = absent();
    auto = rect(autoX, 28, t, t);
    spin = rect(spinX, 0, T.desktopSpin, T.desktopSpin);
    buy = rect(spinX + T.desktopSpin + sg, 24, 52, 52);
  }
  const charge = rect(
    spin.x + spin.w * 0.08,
    spin.y + spin.h * (spin.w < 96 ? 0.58 : 0.64),
    spin.w * 0.84,
    variant === "compact" ? 14 : 18,
  );
  const counter = {
    ...bet,
    y: counterY,
    h: Math.min(bet.h, variant === "portrait" ? 64 : 60),
  };
  const featureTurbo =
    variant === "portrait"
      ? rect(auto.x, spin.y + (spin.h - t) / 2, t, t)
      : turbo;
  const featureMenu =
    variant === "portrait"
      ? rect(buy.x, spin.y + (spin.h - t) / 2, t, t)
      : menu;
  const actionJoin =
    variant === "landscape" ? "top" : variant === "portrait" ? "right" : "left";
  const plateHeight = variant === "desktop" ? bet.h : bh;
  const actionPlate =
    variant === "portrait" || !auto.w
      ? absent()
      : actionJoin === "top"
        ? rect(
            spin.x + (spin.w - bh) / 2,
            auto.y,
            bh,
            spin.y + spin.h / 2 - auto.y,
          )
        : actionJoin === "right"
          ? rect(
              spin.x + spin.w / 2,
              spin.y + (spin.h - bh) / 2,
              auto.x + auto.w - spin.x - spin.w / 2,
              bh,
            )
          : rect(
              auto.x,
              spin.y + (spin.h - plateHeight) / 2,
              spin.x + spin.w / 2 - auto.x,
              plateHeight,
            );
  return {
    ...viewport,
    balance,
    win,
    bet,
    betButton,
    minus,
    plus,
    ante,
    turbo,
    featureTurbo,
    menu,
    featureMenu,
    auto,
    spin,
    charge,
    buy,
    counter,
    actionPlate,
    actionJoin,
    drawer: { turbo: !turbo.w, auto: !auto.w, ante: false },
  };
}
export type ControlLayout = ReturnType<typeof createControlLayout>;
/** Long purchase prices use two lines inside the rim; ordinary costs stay inline. */
export function controlChargeLayout(d: ControlLayout, amount?: string) {
  const stacked =
    !!amount && (amount.length > 5 || d.spin.w < 96) && d.variant !== "compact";
  const bounds = stacked
    ? rect(
        d.spin.x + d.spin.w * 0.1,
        d.spin.y + d.spin.h * (d.spin.w < 96 ? 0.45 : 0.52),
        d.spin.w * 0.8,
        26,
      )
    : d.charge;
  return {
    ...bounds,
    stacked,
    amountSize: amount
      ? controlAmountSize(
          amount,
          bounds.w - (stacked || d.variant === "compact" ? 0 : 23),
          d.variant === "compact" || (stacked && d.spin.w < 96) ? 10 : 13,
        )
      : 12,
  };
}
export const controlPlacement = (r: ControlRect) => ({
  left: r.x,
  top: r.y,
  width: r.w,
  height: r.h,
});
/** Conservative tabular advances, checked against the shipped numeric face. */
export function controlAmountSize(
  value: string,
  width: number,
  preferred: number = T.amountSize,
) {
  const advance = [...value].reduce(
    (sum, ch) => sum + (ch === "," ? 0.26 : ch === " " ? 0.25 : 0.55),
    0,
  );
  return Math.min(
    preferred,
    Math.floor(Math.max(0, width) / Math.max(1, advance)),
  );
}
export function controlTargets(d: ControlLayout, feature = false) {
  const relative = (r: ControlRect) => ({
    ...r,
    x: d.bet.x + r.x,
    y: d.bet.y + r.y,
  });
  return Object.fromEntries(
    Object.entries({
      menu: feature ? d.featureMenu : d.menu,
      turbo: feature ? d.featureTurbo : d.turbo,
      spin: d.spin,
      ...(!feature
        ? {
            auto: d.auto,
            buy: d.buy,
            bet: relative(d.betButton),
            minus: relative(d.minus),
            plus: relative(d.plus),
            ante: relative(d.ante),
          }
        : {}),
    }).filter(([, r]) => r.w > 0),
  );
}
