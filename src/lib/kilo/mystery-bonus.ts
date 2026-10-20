import type { Rng } from './engine';

/** Local sandbox candidate. Odds are versioned with the outcome books, never
 * inferred from balance, play speed, history or the reveal animation. */
export const MYSTERY_PRICE = 200;
export const MYSTERY_WEIGHT_TOTAL = 1_000_000_000;
export const MYSTERY_BONUSES = [
  { feature: 'dock', weight: 500_000_000 },
  { feature: 'yacht', weight: 487016278 },
  { feature: 'yacht25', weight: 12983722 },
] as const;
export type MysteryFeature = (typeof MYSTERY_BONUSES)[number]['feature'];
export function selectMysteryBonus(rng: Rng): MysteryFeature {
  let draw = Math.min(MYSTERY_WEIGHT_TOTAL - 1, Math.floor(rng() * MYSTERY_WEIGHT_TOTAL));
  for (const option of MYSTERY_BONUSES) {
    if (draw < option.weight) return option.feature;
    draw -= option.weight;
  }
  return 'yacht25';
}
export const MYSTERY_ODDS_COPY = MYSTERY_BONUSES.map(option =>
  `${option.feature === 'dock' ? 'Dockside Catch' : option.feature === 'yacht' ? 'Yacht Stash' : 'Super Yacht Stash'} ${(option.weight / MYSTERY_WEIGHT_TOTAL * 100).toFixed(4)}%`
).join(' · ');
