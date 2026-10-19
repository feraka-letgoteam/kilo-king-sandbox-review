import assert from "node:assert/strict";
import { anticipationAt, reelTravelAt, reelLockPose, symbolWinPose } from "../src/components/kilo/presentation-motion.ts";

const close = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);
const monotone = (curve) => {
  let previous = -1;
  for (let i = 0; i <= 5000; i++) {
    const t = i / 5000;
    const sample = curve(t);
    assert.ok(Number.isFinite(sample.progress) && Number.isFinite(sample.velocity));
    assert.ok(sample.progress >= previous - 1e-10 && sample.progress <= 1 + 1e-10);
    assert.ok(sample.velocity >= -1e-10);
    if (i > 0 && i < 5000) {
      const h = 1e-7;
      const derivative = (curve(t + h).progress - curve(t - h).progress) / (2 * h);
      close(derivative, sample.velocity, 1e-4);
    }
    previous = sample.progress;
  }
  close(curve(0).progress, 0);
  close(curve(1).progress, 1);
  close(curve(1).velocity, 0);
};

monotone(reelTravelAt);
for (const initial of [0, 0.1, 1, 4, 12, 50]) {
  const curve = (t) => anticipationAt(t, initial);
  monotone(curve);
  close(curve(0).velocity, initial);
  for (const join of [Math.min(0.16, 0.8 / Math.max(0.01, initial)), 0.78]) {
    close(curve(join - 1e-7).velocity, curve(join + 1e-7).velocity, 1e-5);
  }
}
for (const join of [0.1, 0.66]) {
  close(reelTravelAt(join - 1e-7).velocity, reelTravelAt(join + 1e-7).velocity, 1e-5);
}
for (let i = 0; i <= 1000; i++) {
  const t = i / 1000;
  const lock = reelLockPose(t);
  assert.ok(lock.x >= 1 && lock.x <= 1.009 && lock.y >= 0.965 && lock.y <= 1);
  for (const symbol of ["10", "J", "Q", "K", "A", "cuffs", "keys", "lamp", "duffel", "brick", "bars", "splash"]) {
    const pose = symbolWinPose(symbol, t, 2);
    assert.ok(pose.scale >= 1 && pose.scale < 1.04 && Math.abs(pose.rotation) < 0.035);
    if (t === 0 || t === 1) {
      close(pose.scale, 1);
      close(pose.rotation, 0);
    }
  }
}
console.log("PASS: normal and anticipation travel are monotone, velocity-continuous, and end exactly at the recorded stop; bounded art-only poses return to rest.");
