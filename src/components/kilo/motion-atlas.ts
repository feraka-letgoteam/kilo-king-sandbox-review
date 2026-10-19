/** Registered v44 collector drawings retain the existing motion rectangles. */
export type Rect = { x: number; y: number; w: number; h: number };

export const MOTION_ROOT = "/kilo-motion-v7/";

export const motionMs = Object.freeze({
  fishFlight: 500,
  awardFlight: 500,
  portraitFlight: 370,
  fullSetHold: 480,
  retriggerAnnouncement: 1400,
});

export const collectorAtlas = {
  image: "../kilo-v79/characters/collector-reaction-atlas.webp",
  frames: [
    { x: 0, y: 0, w: 444, h: 444 },
    { x: 444, y: 0, w: 443, h: 444 },
    { x: 887, y: 0, w: 443, h: 444 },
    { x: 1330, y: 0, w: 444, h: 444 },
    { x: 0, y: 444, w: 444, h: 443 },
    { x: 444, y: 444, w: 443, h: 443 },
    { x: 887, y: 444, w: 443, h: 443 },
    { x: 1330, y: 444, w: 444, h: 443 },
  ] satisfies Rect[],
  sequence: [0, 1, 2, 3, 4, 5, 6, 0],
  frameMs: 100,
};

export const bassAtlas = {
  image: "bass-reaction-atlas.png",
  frames: [
    { x: 0, y: 0, w: 512, h: 512 },
    { x: 512, y: 0, w: 512, h: 512 },
    { x: 1024, y: 0, w: 512, h: 512 },
    { x: 0, y: 512, w: 512, h: 512 },
    { x: 512, y: 512, w: 512, h: 512 },
    { x: 1024, y: 512, w: 512, h: 512 },
  ] satisfies Rect[],
  sequence: [0, 1, 2, 3, 4, 5, 4, 2, 1, 0],
  frameMs: 70,
};

export function reactionIndex(
  sequence: number[],
  frameMs: number,
  elapsedMs: number,
  reducedMotion = false,
) {
  if (
    reducedMotion ||
    !Number.isFinite(elapsedMs) ||
    elapsedMs < 0 ||
    elapsedMs >= sequence.length * frameMs
  )
    return 0;
  return sequence[Math.floor(elapsedMs / frameMs)] ?? 0;
}
