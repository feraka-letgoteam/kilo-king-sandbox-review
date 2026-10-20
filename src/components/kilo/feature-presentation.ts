import type { PurchaseMode } from '@/lib/kilo/engine';
import { MYSTERY_ODDS_COPY } from '@/lib/kilo/mystery-bonus';
import { t } from '@/lib/kilo/copy';

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
    summary: t('takeover.dockSummary'),
    confirmation: 'One marked package stays for one extra spin. Collectors advance the ×1 / ×2 / ×3 / ×10 ladder.', accent: '#8ce3d0' },
  yacht: { art: FEATURE_ART.yacht, kicker: '4 SCATTERS · VS',
    summary: '15 free spins. VS wild reels lock at ×2–×10.',
    confirmation: t('takeover.yachtConfirmation'), accent: '#ffcb62' },
  getaway: { art: FEATURE_ART.getaway, kicker: 'MAX SPINS',
    summary: '1 spin. Max win or nothing.',
    confirmation: t('takeover.getawayConfirmation'), accent: '#f5d679' },
  mystery: { art: '/kilo-features-v12/mystery.webp', kicker: '3 · 4 · 5 SCATTERS',
    summary: 'A random bonus. Chance at Super Yacht’s opening ×25 VS.',
    confirmation: t('takeover.mysteryConfirmation')(MYSTERY_ODDS_COPY), accent: '#d4b5ff' },
};
export const FEATURE_ART_URLS = Object.values(FEATURE_ART);
