/** Bounded presentation curves. They cannot generate or change an outcome. */
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const easeOut = (n: number) => 1 - (1 - clamp(n)) ** 3;
export const GETAWAY_REVEAL_MS = 1600;
export const VS_REVEAL_MS = 1920;
/** v88: one duel per VS reel, left to right (the recorded order), about half a
 * second each at normal speed and a fifth of a second in turbo. Presentation
 * clock only; the recorded winner, multiplier and event order are unchanged. */
export const VS_DUEL_MS = { normal: 500, turbo: 200, super: 140 } as const;
/** Registered artwork envelope; the five-by-three game geometry is untouched. */
export const GETAWAY_ART = { widthCells: 5.75, centerYCells: 1.80, awardYCells: 2.32, awardHeightCells: .62 } as const;

export function getawayMotionAt(t: number, won: boolean, reduced = false) {
  t = reduced ? 1 : clamp(t);
  // Relative to the five-reel board. Both outcomes approach from the left.
  // A maximum reaches its final position at 64% and never resumes travelling.
  const arrived = clamp(t / .64);
  const center = won ? -.5 + easeOut(arrived) : -.5 + 2 * t;
  return { center, stopped: won && t >= .64, showResult: t >= .64,
    frameProgress: won ? t : Math.min(.21, t),
    reveal: easeOut((t - .64) / .16) };
}

export function vsMotionAt(t: number, reduced = false) {
  t = reduced ? 1 : clamp(t);
  return { expand: easeOut(t / .19), challenge: clamp((t - .18) / .48),
    resolve: clamp((t - .72) / .18), lock: easeOut((t - .90) / .10),
    candidates: t >= .10 && t < .90, winner: t >= .72 };
}
