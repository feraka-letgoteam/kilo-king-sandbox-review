export function connectionAnchor(
  cells: readonly { reel: number; row: number }[],
  g: { gx: number; gy: number; cell: number; gap: number },
  width: number,
  height: number,
) {
  const count = Math.max(1, cells.length),
    boardWidth = g.cell * 5 + g.gap * 4;
  const x =
    cells.reduce(
      (n, p) => n + g.gx + (p.reel + 0.5) * g.cell + p.reel * g.gap,
      0,
    ) / count;
  const y =
    cells.reduce((n, p) => n + g.gy + (p.row + 0.5) * g.cell, 0) / count -
    g.cell * 0.2;
  return {
    x: Math.max(
      g.gx + width / 2 + 4,
      Math.min(g.gx + boardWidth - width / 2 - 4, x),
    ),
    y: Math.max(
      g.gy + height / 2 + 4,
      Math.min(g.gy + g.cell * 3 - height / 2 - 4, y),
    ),
  };
}
export const connectionValue = (award: number, progress: number) =>
  Math.round(
    Math.max(0, award) * (1 - (1 - Math.max(0, Math.min(1, progress))) ** 3),
  );
