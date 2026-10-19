export const MAX_BOAT_URL = '/kilo-v59/environment/getaway-super-symbol.webp';
export const MAX_STOP_MOVE_MS = [440, 420, 440, 460, 540] as const;
export const MAX_STOP_HOLD_MS = [440, 560, 700, 880, 520] as const;
/** Wind-up is a separate stationary beat, never hidden inside travel easing. */
export const MAX_ANTICIPATE_MS = [380, 380, 400, 440, 640] as const;
export const MAX_SETTLE_MS = [220, 220, 240, 260, 480] as const;
export const MAX_REST_MS = [100, 100, 120, 140, 220] as const;

export function maxBeatDuration(ms: number, speed: 'normal' | 'turbo' | 'super', minimum: number) {
  // The effect controller applies its shared pace after this floor is set.
  const factor = { normal: 1, turbo: .55, super: .32 }[speed];
  return Math.max(ms, minimum / factor);
}

/** Acceleration into a readable deceleration, always moving left to right. */
export function maxStripAdvance(t: number) {
  const u = Math.max(0, Math.min(1, t));
  return u*u*(3-2*u);
}
export function maxBoatPlacement(boardWidth:number,boardHeight:number,segments:number,textureRatio:number) {
  // Five recorded berths, framed inside the aperture. The old one-board-wide
  // sprite spent four beats clipped offscreen, hiding both driver and wake.
  // This is vessel staging only; fitReels and the recorded stops are untouched.
  const width=boardWidth*.62,height=Math.min(boardHeight*.8,width/textureRatio);
  const fittedWidth=height*textureRatio;
  const left=fittedWidth/2+boardWidth*.035,right=boardWidth-left;
  return { width:fittedWidth,height,x:left+(right-left)*segments/5,
    y:boardHeight*.44 };
}
