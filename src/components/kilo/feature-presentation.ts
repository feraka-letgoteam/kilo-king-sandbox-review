import type { PurchaseMode } from '@/lib/kilo/engine';
import { MYSTERY_ODDS_COPY } from '@/lib/kilo/mystery-bonus';

/** Presentation only. Prices, outcomes and eligibility come from the engine. */
export const FEATURE_ART = {
  dock: '/kilo-v79/surfaces/dock.webp', yacht: '/kilo-v79/surfaces/yacht.webp',
  yacht25: '/kilo-v79/surfaces/yacht.webp',
  route: '/kilo-v79/surfaces/route.webp', getaway: '/kilo-v79/surfaces/getaway.webp',
} as const;
export const PURCHASE_PRESENTATION: Record<Exclude<PurchaseMode, 'chopper'>, {
  art: string; kicker: string; summary: string; confirmation: string; accent: string;
}> = {
  buy: { art: FEATURE_ART.dock, kicker: '3 SCATTERS',
    summary: '10 free spins. Collect cash and build your multiplier.',
    confirmation: 'One marked package stays for one extra spin. Collectors advance the ×1 / ×2 / ×3 / ×10 ladder.', accent: '#8ce3d0' },
  yacht: { art: FEATURE_ART.yacht, kicker: '4 SCATTERS · VS',
    summary: '15 free spins. VS wild reels lock at ×2–×10.',
    confirmation: 'Every VS stays wild through the final spin. Adjacent King reels merge with King; Cop reels merge with Cop. A merged group multiplies its individual values and applies that product once. No cash collection.', accent: '#ffcb62' },
  getaway: { art: FEATURE_ART.getaway, kicker: 'MAX SPINS',
    summary: '1 spin. Max win or nothing.',
    confirmation: 'Activate the mode, then press Spin for each attempt. Every spin costs 1,000× your base bet and returns either 25,000× or zero. Exit the mode at any time between spins.', accent: '#f5d679' },
  mystery: { art: '/kilo-features-v12/mystery.webp', kicker: '3 · 4 · 5 SCATTERS',
    summary: 'A random bonus. Chance at Super Yacht’s opening ×25 VS.',
    confirmation: `Super Yacht guarantees a winning ×25 on reel one of spin one. ${MYSTERY_ODDS_COPY}. One purchase; no additional charge for the selected bonus.`, accent: '#d4b5ff' },
};
export const FEATURE_ART_URLS = Object.values(FEATURE_ART);
