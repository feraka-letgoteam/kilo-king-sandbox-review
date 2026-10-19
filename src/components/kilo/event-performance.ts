/** Visual curves only. The renderer's existing event/award clocks own time. */
const unit = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = unit(n); return t * t * (3 - 2 * t); };
function keys(t: number, values: readonly (readonly [number, number])[]) {
  t = unit(t);
  for (let i = 1; i < values.length; i++) {
    const a = values[i - 1]!, b = values[i]!;
    if (t <= b[0]) return a[1] + (b[1] - a[1]) * smooth((t - a[0]) / (b[0] - a[0]));
  }
  return values[values.length - 1]![1];
}

/** A compressed ready pose, contact and one recovery. The board never moves. */
export function featureArrivalAt(progress: number, reduced = false) {
  if (reduced) return { x: 1, y: 1, lift: 0, turn: 0 };
  return {
    x: keys(progress, [[0,.84],[.18,.81],[.57,1.025],[.82,.992],[1,1]]),
    y: keys(progress, [[0,.55],[.18,.51],[.57,1.10],[.82,.975],[1,1]]),
    lift: keys(progress, [[0,.23],[.18,.25],[.57,-.065],[.82,.012],[1,0]]),
    turn: keys(progress, [[0,-.18],[.18,-.21],[.57,.055],[.82,-.018],[1,0]]),
  };
}

export type WildArtPose = { x: number; y: number; lift: number; turn: number; progress?: number };
export const WILD_REST: WildArtPose = { x: 1, y: 1, lift: 0, turn: 0 };

/** Recoil stays inside the group's fixed frame; its rim and number never tilt. */
export function wildArtAt(progress: number, side: 'king' | 'vice', reduced = false): WildArtPose {
  if (reduced) return WILD_REST;
  const sign = side === 'king' ? -1 : 1;
  return {
    progress: unit(progress),
    x: keys(progress, [[0,1],[.18,1.035],[.44,1.075],[.78,1.018],[1,1]]),
    y: keys(progress, [[0,1],[.18,.935],[.44,1.055],[.78,.985],[1,1]]),
    lift: keys(progress, [[0,0],[.18,.031],[.44,-.029],[.78,.006],[1,0]]),
    turn: sign * keys(progress, [[0,0],[.18,-.020],[.44,.028],[.78,-.006],[1,0]]),
  };
}

export function connectionPerformanceAt(trace: number, reveal: number) {
  // Hit travels to the wild, the illustration responds, the numeral lands.
  return trace < 1 ? unit((trace - .35) / .65) * .44 : .44 + unit(reveal) * .56;
}
