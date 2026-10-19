import fs from 'node:fs';
import { playSplash, splashCost, splashRoundCap } from '../src/lib/kilo/engine.ts';
import { runReelFeature, REEL_FEATURE_PROFILE } from '../src/lib/kilo/reel-feature-math.ts';

function seeded(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const stake = 1000, seed = Number(process.env.KILO_SIMULATION_SEED || 7919401);
if (!Number.isSafeInteger(seed)) throw new Error("Integer simulation seed required");
const samples = Number(process.env.KILO_FEATURE_SAMPLES || 50000);
const baseSamples = Number(process.env.KILO_BASE_SAMPLES || 300000);
if (![samples, baseSamples].every(n => Number.isSafeInteger(n) && n > 0)) throw new Error('Positive integer sample counts required');
const modes = (process.env.KILO_SIMULATION_MODES || 'yacht,route,getaway,spin,ante,buy').split(',');
if (modes.some(mode => !['yacht', 'route', 'getaway', 'spin', 'ante', 'buy'].includes(mode))) throw new Error('Unknown simulation mode');
const result = [];
for (const mode of modes) {
  const rng = seeded(seed), n = ['spin', 'ante', 'buy'].includes(mode) ? baseSamples : samples;
  const charge = mode === 'route' ? null : splashCost(stake, mode);
  const cap = mode === 'route' ? 25000 * stake : splashRoundCap(stake, mode);
  let total = 0, squares = 0, positive = 0, capped = 0, cascades = 0;
  const triggers = { dock: 0, yacht: 0, route: 0, getaway: 0 }, values = [];
  for (let i = 0; i < n; i++) {
    const s = mode === 'route' ? runReelFeature('route', stake, rng, cap) : playSplash(stake, mode, rng);
    const payout = mode === 'route' ? s.total : s.payout, multiple = payout / stake;
    total += multiple; squares += multiple * multiple; positive += payout > 0; capped += s.capped;
    if (s.feature) triggers[s.feature]++;
    for (const spin of s.free) if (spin.mechanic?.reel?.type === 'tumble') cascades += spin.mechanic.reel.cascades.length;
    values.push(multiple);
  }
  values.sort((a, b) => a - b);
  const mean = total / n, se = Math.sqrt(Math.max(0, squares / n - mean ** 2) / n);
  const row = { mode, profile: REEL_FEATURE_PROFILE, samples: n, stake, charge, maximum: cap, meanPayoutMultiple: mean,
    standardErrorMultiple: se, approximate95IntervalMultiple: [mean - 1.96 * se, mean + 1.96 * se],
    ...(charge ? { estimatedReturnOverCost: mean / (charge / stake) } : { access: 'five scatters only; no purchase price or buy RTP' }),
    positiveRate: positive / n, cappedRate: capped / n, triggers, meanCascades: cascades / n,
    payoutMultipleQuantiles: Object.fromEntries([.1, .5, .9, .99].map(p => [`p${p * 100}`, values[Math.floor(n * p)]])) };
  result.push(row); console.log(JSON.stringify(row));
}
fs.writeFileSync(process.env.KILO_SIMULATION_OUTPUT || 'art/kilo-features-v54/simulation.json', JSON.stringify({
  method: 'Seeded Monte Carlo of the exact local generator, including natural feature triggers. Estimates and approximate intervals, not a certified RTP or an approved outcome book.',
  seed, profile: REEL_FEATURE_PROFILE, result,
  getawayExact: { priceMultiple: 1000, maximumMultiple: 25000, winProbability: REEL_FEATURE_PROFILE.getawayWinChance,
    lossProbability: 1 - REEL_FEATURE_PROFILE.getawayWinChance, returnOverCost: 25000 * REEL_FEATURE_PROFILE.getawayWinChance / 1000 },
}, null, 2) + '\n');
