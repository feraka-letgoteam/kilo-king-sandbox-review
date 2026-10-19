import fs from "node:fs";
import assert from "node:assert/strict";
import {
  playSplash,
  splashCost,
  splashStakeOk,
  splashRoundCap,
} from "../src/lib/kilo/engine.ts";
import { FEATURE_PROFILE } from "../src/lib/kilo/feature-math.ts";
function seeded(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const result = [];
for (const stake of [1000])
  for (const mode of ["spin", "ante", "buy", "yacht", "chopper", "getaway"]) {
    if (!splashStakeOk(stake, mode)) continue;
    const n = ["spin", "ante", "buy"].includes(mode) ? 1_000_000 : 100_000,
      rng = seeded(3290481);
    let total = 0,
      squares = 0,
      hits = 0,
      profit = 0,
      cap = 0,
      free = 0,
      trigger = 0;
    const pays = [];
    for (let i = 0; i < n; i++) {
      const s = playSplash(stake, mode, rng),
        x = s.payout / s.cost;
      total += x;
      squares += x * x;
      hits += s.payout > 0;
      profit += s.payout > s.cost;
      cap += s.capped;
      trigger += s.free.length > 0;
      free += s.free.length;
      pays.push(x);
    }
    pays.sort((a, b) => a - b);
    const rtp = total / n,
      se = Math.sqrt((squares / n - rtp ** 2) / n);
    const row = {
      stake,
      mode,
      charge: splashCost(stake, mode),
      maximum: splashRoundCap(stake,mode),
      rounds: n,
      estimatedRtp: rtp,
      standardError: se,
      approx95Interval: [rtp - 1.96 * se, rtp + 1.96 * se],
      anyReturnRate: hits / n,
      profitRate: profit / n,
      capRate: cap / n,
      featureRate: trigger / n,
      meanFeatureSteps: free / n,
      returnOverCostQuantiles: {
        p10: pays[Math.floor(n * 0.1)],
        p50: pays[Math.floor(n * 0.5)],
        p90: pays[Math.floor(n * 0.9)],
        p99: pays[Math.floor(n * 0.99)],
      },
    };
    result.push(row);
    console.log(JSON.stringify(row));
  }
const stakeScaling = [];
for (const mode of ["spin", "ante", "buy", "yacht", "chopper", "getaway"]) {
  const lowStake = 100;
  const highStake = Math.min(100_000, Math.floor(1_000_000 / splashCost(1, mode)));
  const n = 50_000, lowRng = seeded(3290481), highRng = seeded(3290481);
  let lowTotal = 0, highTotal = 0, aboveFormerCeiling = 0, maxObserved = 0;
  for (let i = 0; i < n; i++) {
    const low = playSplash(lowStake, mode, lowRng), high = playSplash(highStake, mode, highRng);
    assert.equal(low.payout * highStake, high.payout * lowStake);
    assert.equal(low.capped, high.capped);
    assert.equal(low.free.length, high.free.length);
    lowTotal += low.payout; highTotal += high.payout;
    aboveFormerCeiling += high.payout > 5_000_000;
    maxObserved = Math.max(maxObserved, high.payout);
  }
  const row = {mode, pairs:n, lowStake, highStake,
    lowEstimatedRtp:lowTotal/(n*splashCost(lowStake,mode)),
    highEstimatedRtp:highTotal/(n*splashCost(highStake,mode)),
    exactRoundMultiplierMatches:n, aboveFormerCeiling, maxObserved,
    maximum:splashRoundCap(highStake,mode)};
  stakeScaling.push(row);
  console.log(JSON.stringify(row));
}
fs.writeFileSync(
  "art/kilo-features-v51/simulation.json",
  JSON.stringify(
    {
      method:
        "Seeded Monte Carlo of the exact sandbox generator. Estimates, not theoretical RTP or certification. Overall maximum payout is 25,000 times base bet, with no fixed currency ceiling. Separate paired runs verify identical payout multipliers at low and high legal stakes.",
      seed: 3290481,
      profile: FEATURE_PROFILE,
      result,
      stakeScaling,
    },
    null,
    2,
  ) + "\n",
);
