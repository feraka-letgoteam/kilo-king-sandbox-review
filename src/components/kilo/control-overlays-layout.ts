export type PopupRect = { x: number; y: number; width: number; height: number };
export const QUICK_MENU = {
  width: 168,
  row: 44,
  padding: 6,
  border: 1,
  sliderHeight: 56,
  flyoutWidth: 192,
  gap: 12,
  margin: 12,
} as const;

const right = (r: PopupRect) => r.x + r.width;
const bottom = (r: PopupRect) => r.y + r.height;
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(n, hi));

/** Avoid real control rectangles: their union would wrongly block the open
 * space between the left and right rails in short landscape. */
export function quickMenuLayout(
  viewport: PopupRect,
  anchor: PopupRect,
  expanded: boolean,
  controls: PopupRect[] = [],
  extraRows = 0,
) {
  const t = QUICK_MENU;
  const bounds = {
    x: viewport.x + t.margin,
    y: viewport.y + t.margin,
    width: viewport.width - t.margin * 2,
    height: viewport.height - t.margin * 2,
  };
  const obstacles = controls.length ? controls : [anchor];
  const width = Math.min(t.width, bounds.width);
  const fullHeight = t.row * (3 + extraRows) + t.padding * 2 + t.border * 2;
  const fits = (r: PopupRect) =>
    r.x >= bounds.x &&
    r.y >= bounds.y &&
    right(r) <= right(bounds) &&
    bottom(r) <= bottom(bounds) &&
    obstacles.every(
      (a) =>
        right(r) + t.gap <= a.x ||
        r.x >= right(a) + t.gap ||
        bottom(r) + t.gap <= a.y ||
        r.y >= bottom(a) + t.gap,
    );
  const modes =
    viewport.width <= 620 || bounds.height < fullHeight
      ? ["inline" as const]
      : ["right" as const, "left" as const, "inline" as const];
  for (const mode of modes) {
    const inline = mode === "inline";
    const contentHeight =
      fullHeight + (expanded && inline ? t.sliderHeight : 0);
    const height = Math.min(contentHeight, bounds.height);
    const x = clamp(anchor.x, bounds.x, right(bounds) - width);
    const preferredY = Math.min(...obstacles.map((r) => r.y)) - t.gap - height;
    const xs = [
      ...new Set([
        x,
        clamp(right(anchor) - width, bounds.x, right(bounds) - width),
        ...obstacles.flatMap((r) => [right(r) + t.gap, r.x - width - t.gap]),
        bounds.x,
        right(bounds) - width,
      ]),
    ];
    const ys = [
      ...new Set([
        preferredY,
        anchor.y - height - t.gap,
        bottom(anchor) + t.gap,
        clamp(anchor.y, bounds.y, bottom(bounds) - height),
        ...obstacles.flatMap((r) => [r.y - height - t.gap, bottom(r) + t.gap]),
        bounds.y,
        bottom(bounds) - height,
      ]),
    ];
    const candidates = xs
      .flatMap((cx) =>
        ys.map((cy) => ({
          x: cx,
          y: cy,
          width,
          height,
        })),
      )
      .sort((a, b) => {
        // An aligned popup above the whole dock wins when it fits. Otherwise
        // find the nearest clear space, usually beside the left landscape rail.
        const score = (r: PopupRect) =>
          Math.abs(r.x - x) +
          Math.abs(r.y - (anchor.y - height - t.gap)) +
          (r.y === preferredY && r.x === x ? -1000 : 0);
        return score(a) - score(b);
      });
    for (const r of candidates) {
      if (!fits(r)) continue;
      if (expanded && !inline) {
        // Reserve both audio-row flyouts so choosing Music or Sound doesn't
        // move the menu or collide with the controls.
        const flyout = {
          x: mode === "right" ? right(r) + t.gap : r.x - t.gap - t.flyoutWidth,
          y: r.y + t.padding + t.border + t.row + (t.row - t.sliderHeight) / 2,
          width: t.flyoutWidth,
          height: t.row + t.sliderHeight,
        };
        if (!fits(flyout)) continue;
      }
      return {
        ...r,
        inline,
        side: mode === "left" ? ("left" as const) : ("right" as const),
        scroll: contentHeight > height,
        clear: true,
        origin: r.y < anchor.y ? "bottom" : "top",
      };
    }
  }
  // Very small zoomed viewports may have no clear rectangle. Keep every item
  // reachable by scrolling rather than allowing the popup off-screen.
  const contentHeight = fullHeight + (expanded ? t.sliderHeight : 0);
  const height = Math.min(contentHeight, bounds.height);
  return {
    x: clamp(anchor.x, bounds.x, right(bounds) - width),
    y: clamp(anchor.y - t.gap - height, bounds.y, bottom(bounds) - height),
    width,
    height,
    inline: true,
    side: "right" as const,
    scroll: contentHeight > height,
    clear: false,
    origin: "bottom",
  };
}
