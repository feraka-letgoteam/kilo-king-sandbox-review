/** Pure presentation curves. These never choose a symbol or change an award. */
const unit = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (t: number) => t * t * (3 - 2 * t);
const smoothIntegral = (t: number) => t * t * t - 0.5 * t ** 4;

/** Distance and its derivative share the same curve, including at the joins. */
export function reelTravelAt(time: number) {
  const t = unit(time);
  const launch = 0.1;
  const brakeAt = 0.66;
  const brake = 1 - brakeAt;
  const cruise = 1 / (launch / 2 + brakeAt - launch + brake / 3);
  if (t < launch) {
    return {
      progress: (cruise * t * t) / (2 * launch),
      velocity: (cruise * t) / launch,
      speed: t / launch,
    };
  }
  const launchDistance = (cruise * launch) / 2;
  if (t < brakeAt) {
    return {
      progress: launchDistance + cruise * (t - launch),
      velocity: cruise,
      speed: 1,
    };
  }
  const u = (t - brakeAt) / brake;
  return {
    progress:
      launchDistance +
      cruise * (brakeAt - launch) +
      cruise * brake * (u - u * u + (u * u * u) / 3),
    velocity: cruise * (1 - u) ** 2,
    speed: (1 - u) ** 2,
  };
}

/**
 * Start at the strip's measured velocity, brake into a quiet crawl, and stop.
 * Integrating the velocity gives an exact unit distance without a second
 * acceleration kick. An unusually fast handoff shortens only the brake phase.
 */
export function anticipationAt(time: number, initialVelocity: number) {
  const t = unit(time);
  const initial = Math.max(0, initialVelocity);
  const brake = Math.min(0.16, 0.8 / Math.max(0.01, initial));
  const settle = 0.22;
  const settleAt = 1 - settle;
  const crawl = (1 - (brake * initial) / 2) / (1 - (brake + settle) / 2);
  const brakeDistance = (brake * (initial + crawl)) / 2;
  if (t < brake) {
    const u = t / brake;
    return {
      progress: brake * (initial * u + (crawl - initial) * smoothIntegral(u)),
      velocity: initial + (crawl - initial) * smooth(u),
    };
  }
  if (t < settleAt) {
    return { progress: brakeDistance + crawl * (t - brake), velocity: crawl };
  }
  const u = (t - settleAt) / settle;
  return {
    progress:
      brakeDistance + crawl * (settleAt - brake) + crawl * settle * (u - smoothIntegral(u)),
    velocity: crawl * (1 - smooth(u)),
  };
}

/** A short pressure/release in the artwork; labels and reel masks stay still. */
export function reelLockPose(time: number) {
  const pressure = Math.sin(Math.PI * unit(time)) ** 2;
  return { x: 1 + pressure * 0.009, y: 1 - pressure * 0.035 };
}

/** Pressure, release and damped return, fitted inside the existing win clock.
 * Values stay stationary and every drawing returns to its exact home pose. */
export function symbolWinPose(symbol: string, time: number, tier: number) {
  const t = unit(time);
  const rank = ["10", "J", "Q", "K", "A"].includes(symbol);
  const pressure = t < .18 ? -.035 * Math.sin(Math.PI * t / .36) : 0;
  const release = t < .18 ? 0 : Math.sin(Math.PI * unit((t - .18) / .82)) * Math.exp(-2.1 * (t - .18));
  const settle = t < .55 ? 0 : Math.sin(Math.PI * 2 * (t - .55) / .45) * (1 - t) * .028;
  const amplitude = rank ? .09 : symbol === "splash" ? .025 : symbol === "brick" ? .055 : .075;
  const turn = rank ? .025 : symbol === "cuffs" ? .06 : symbol === "lamp" ? .05 : .025;
  return {
    scale: 1 + pressure + release * amplitude * (1 + Math.min(2, Math.max(0, tier)) * .08) + settle,
    rotation: turn * Math.sin(Math.PI * 2 * t) * Math.sin(Math.PI * t) * (1 - t),
  };
}
