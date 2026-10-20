/** Presentation only. Keeps equations out of the tiny collector portrait. */
export function stageReadoutLayout(g: {
  gx: number; gy: number; cell: number; gap: number; dw: number; dh: number;
}, kind: 'local' | 'summary' = 'local') {
  const width = g.cell * 5 + g.gap * 4;
  // Short landscape has no dock gap underneath; its 12px stage inset must
  // also contain the lip. Keep the same compact readout as a portrait phone.
  const compact = g.cell < 110;
  const height = compact ? 22 : 30;
  // On a phone the round's combined total (e.g. "Collected 48,000") sits on
  // the board between rows 2 and 3, not squeezed onto the frame's lower rail.
  if (compact && kind === 'summary') {
    const tall = Math.max(34, Math.round(g.cell * .5));
    return { x: g.gx + width * .16, y: g.gy + g.cell * 2 - tall / 2, width: width * .68, height: tall,
      labelSize: 12, amountSize: Math.max(18, Math.round(g.cell * .3)) };
  }
  return {
    x: g.gx, y: g.gy + g.cell * 3 + 2, width, height,
    labelSize: compact ? 12 : 14,
    amountSize: compact ? 15 : 20,
  };
}

/** Reduced motion removes travel, never the time needed to read the result. */
export function collectionHold(ms: number, speed: "normal" | "turbo" | "super", reduced: boolean) {
  if (reduced) return Math.max(360, Math.min(ms, 560));
  if (speed === "normal") return ms;
  return Math.max(300, Math.min(480, Math.round(ms * (speed === "super" ? 0.45 : 0.6))));
}

/** Exact alternatives, never rounded shorthand. The shared readout always has
 * the full amount; a narrow collector can use e.g. 2.385M instead of COLLECT. */
export function collectorAmountLabels(value: number, full: string): string[] {
  const amount = Math.max(0, Math.round(value));
  const candidates = [[1e9, "B"], [1e6, "M"], [1e3, "K"]] as const;
  return [full, ...candidates
    .filter(([unit]) => amount >= unit)
    .map(([unit, suffix]) => `${amount / unit}${suffix}`)
    .filter((text) => text.length < full.length)
    .sort((a, b) => a.length - b.length)];
}

/** Collection typography follows the current cell after every resize. */
export function collectionType(cell: number) {
  return {
    subtotal: Math.max(14, Math.min(28, Math.round(cell * 0.2))),
    travelling: Math.max(15, Math.round(cell * 0.15)),
    stroke: Math.max(3, cell * 0.02),
  };
}
