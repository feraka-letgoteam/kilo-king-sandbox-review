/** Five positions on one horizontal super-symbol strip. The original binary
 * outcome draw also selects its stop; presentation never manufactures a stop.
 * Four equal conditional advances preserve the existing maximum-win chance. */
export type MaxReveal = { version: 1; segments: 1 | 2 | 3 | 4 | 5; total: 5 };
export function maxRevealFromDraw(draw: number, maximumChance: number): MaxReveal {
  let segments = 1;
  for (let gate = 1; gate <= 4; gate++) {
    if (draw < Math.pow(maximumChance, gate / 4)) segments++;
    else break;
  }
  return { version: 1, segments: segments as MaxReveal['segments'], total: 5 };
}

/** Older saved binary records have no intermediate stops. Do not invent a
 * late near-miss for those records: reveal one segment or the complete boat. */
export function recordedMaxSegments(record: { won: boolean; reveal?: MaxReveal }) {
  return record.won ? 5 : Math.max(1, Math.min(4, record.reveal?.segments ?? 1));
}
