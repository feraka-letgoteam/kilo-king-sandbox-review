import { Graphics } from 'pixi.js';

/** A quiet water surface inside the existing aperture, not a replacement
 * environment. No grid, symbols, timers or changes to the v64 marina canvas. */
export const MAX_STAGE_WATER = 0x071923;
export function paintMaxStageSurface(node: Graphics, g: { gx: number; gy: number; cell: number; gap: number }) {
  node.clear().rect(g.gx,g.gy,g.cell*5+g.gap*4,g.cell*3).fill(MAX_STAGE_WATER);
}
