import type { Rng } from './engine.ts';

/** A complete feature plan is selected before playback; it never crosses a paid round. */
export type VsArrival = { spin: number; reel: number; side: 'king' | 'vice'; multiplier: number; rival: number };
export function vsSeeded(seed: number): Rng {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(items: readonly T[], rng: Rng) => items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!;
export function planVsProgression(rng: Rng): VsArrival[] {
  const count = pick([3, 3, 3, 3, 3, 3, 4, 4, 5], rng);
  // Routes begin in different places. Opening pairs of full left-hand wilds
  // are deliberately uncommon, but any contiguous width is possible.
  const route = [...pick([[4, 3, 2, 1, 0], [3, 4, 2, 1, 0], [2, 3, 4, 1, 0],
    [4, 2, 3, 0, 1], [3, 1, 4, 2, 0], [2, 4, 0, 3, 1], [0, 4, 2, 3, 1]], rng)];
  const opening = rng() < .5 ? 'king' : 'vice';
  const united = rng() < .42;
  return route.slice(0, count).map((reel, index) => ({
    spin: index === 0 ? Math.floor(rng() * 2) : Math.min(14, Math.round(index * 12 / (count - 1)) + Math.floor(rng() * 2)),
    reel,
    side: united || rng() < .62 ? opening : opening === 'king' ? 'vice' : 'king',
    multiplier: index === 0 ? 2 : pick([2, 2, 2, 2, 3, 3, 4, 5, 6, 8, 10], rng),
    rival: pick([2, 2, 3, 3, 4, 5, 6, 8, 10], rng),
  }));
}

/** Five-scatter upgrade: the first actual encounter wins at ×25 on reel one,
 * spin one. Swap reel identities so no later arrival can overwrite it. The
 * remaining arrival count, timing and same-side rules retain the VS rhythm. */
export function planSuperVsProgression(rng: Rng): VsArrival[] {
  const plan = planVsProgression(rng);
  const openingReel = plan[0]!.reel;
  return plan.map((arrival, index) => ({
    ...arrival,
    reel: arrival.reel === openingReel ? 0 : arrival.reel === 0 ? openingReel : arrival.reel,
    ...(index === 0 ? { spin: 0, multiplier: 25 } : {}),
  }));
}
