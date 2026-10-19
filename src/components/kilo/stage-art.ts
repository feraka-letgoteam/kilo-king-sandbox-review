/** Decorative art only. Nine slices preserve the painted corner proportions.
 * The center is never drawn; the reel geometry and canvas remain untouched. */
export const CABINET_ART = "/kilo-v80/cabinet-matte.webp";
export const SPOOL_ART = "/kilo-stage-v20/spool.webp";
// A brand-specific hook and crown. Kept as vector artwork for a crisp 24px icon.
export const FEATURE_MARK =
  '<path d="m5 5 3 2 4-5 4 5 3-2-2 7H7Z" fill="currentColor"/><path d="M12 14v4a4 4 0 0 1-8 0v-2l2 2m6-4a2 2 0 0 0 0-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';

export function stageArtLayout(width: number, height: number, mode: string) {
  // Expand away from the canvas, never into the symbols. Landscape keeps its
  // side controls clear; phone art stays within the viewport's existing inset.
  const out = mode === "wide" ? 22 : mode === "mini" ? 10 : mode === "landscape" ? 8 : 14;
  // The art's painted bounds, not just the canvas, must fit beside controls.
  const sideOut = mode === "wide" ? 22 : mode === "mini" ? 4 : mode === "landscape" ? 6 : 10;
  const corner = mode === "wide" ? 52 : mode === "mini" ? 22 : 30;
  const edge = Math.min(
    18,
    Math.max(10, Math.round(Math.min(width, height) * 0.035)),
  );
  const x = -sideOut,
    y = -out,
    w = width + sideOut * 2,
    h = height + out * 2;
  // A ring clip makes the whole playing area safe even if alpha changes later.
  const inset = edge - 3;
  return { x, y, w, h, corner, inset, width, height };
}
/** v47: one continuous enamel/brass frame. Corners retain their authored proportions. */
export function stageArtSlices(width: number, height: number, mode: string) {
  const { x, y, w, h, corner: c } = stageArtLayout(width, height, mode);
  const sx = [0, 208, 1328],
    sy = [0, 208, 816],
    sw = [208, 1120, 208],
    sh = [208, 608, 208];
  const dx = [x, x + c, x + w - c],
    dy = [y, y + c, y + h - c],
    dw = [c, w - 2 * c, c],
    dh = [c, h - 2 * c, c];
  type Slice = {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    x: number;
    y: number;
    w: number;
    h: number;
  };
  const pieces: Slice[] = [];
  const add = (
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => pieces.push({ sx, sy, sw, sh, x, y, w, h });
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++) {
      if (row === 1 && col === 1) continue;
      add(sx[col], sy[row], sw[col], sh[row], dx[col], dy[row], dw[col], dh[row]);
    }
  return pieces;
}
export function stageArtPaint(
  width: number,
  height: number,
  mode: string,
  prefix = "kk-stage-art",
) {
  const { x, y, w, h, inset } = stageArtLayout(width, height, mode);
  return `<defs><clipPath id="${prefix}"><path fill-rule="evenodd" clip-rule="evenodd" d="M${x} ${y}H${x + w}V${y + h}H${x}Z M${inset} ${inset}V${height - inset}H${width - inset}V${inset}Z"/></clipPath></defs><g clip-path="url(#${prefix})">${stageArtSlices(
    width,
    height,
    mode,
  )
    .map(
      (p) =>
        `<svg x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" viewBox="${p.sx} ${p.sy} ${p.sw} ${p.sh}" preserveAspectRatio="none" overflow="hidden"><image href="${CABINET_ART}" width="1536" height="1024"/></svg>`,
    )
    .join("")}</g>`;
}
