import type { PurchaseMode } from "@/lib/kilo/engine";
import { MYSTERY_PRICE, MYSTERY_ODDS_COPY } from '@/lib/kilo/mystery-bonus';
/** Presentation catalogue. A preview deliberately has no purchasable engine mode. */
type FeatureBase = {
  id: string;
  title: string;
  subtitle: string;
  art: string;
  tone: "teal" | "amber" | "crimson" | "violet" | "gold" | "ice";
  detail: string;
};

export type BonusFeature = FeatureBase &
  (
    | {
        kind: "purchase";
        mode: PurchaseMode;
        multiple: number;
        spins: number;
        multiplier: number;
        scatters?: number;
      }
    | { kind: "trigger"; scatters: number; spins: number; multiplier: number }
    | { kind: "preview" }
  );

export const FEATURES: readonly BonusFeature[] = [
  {
    id: "scatter-3",
    kind: "purchase",
    mode: "buy",
    multiple: 100,
    title: "Dockside Catch",
    subtitle: "3 scatters",
    tone: "teal",
    scatters: 3,
    spins: 10,
    multiplier: 1,
    art: "/kilo-v79/surfaces/dock.webp",
    detail:
      "10 free spins. Fishermen collect every package at the current multiplier. A marked package stays for exactly one additional spin. Collectors advance the ×1 / ×2 / ×3 / ×10 ladder.",
  },
  {
    id: "scatter-4",
    kind: "purchase",
    mode: "yacht",
    multiple: 200,
    title: "Yacht Stash",
    subtitle: "4 scatters",
    tone: "amber",
    scatters: 4,
    spins: 15,
    multiplier: 1,
    art: "/kilo-v79/surfaces/yacht.webp",
    detail:
      "15 free spins. VS encounters develop across the opening, middle and closing spins. Each winning ×2–×10 reel stays locked. Adjacent reels of the same side merge into one larger wild and their multipliers multiply. Separate participating groups add; each group product is counted once. No cash collection.",
  },
  {
    id: "scatter-5",
    kind: "trigger",
    title: "Super Yacht Stash",
    subtitle: "5 scatters · guaranteed ×25",
    tone: "gold",
    scatters: 5,
    spins: 15,
    multiplier: 25,
    art: "/kilo-v79/surfaces/yacht.webp",
    detail: "15 free spins with a guaranteed winning ×25 VS on reel one of the first spin. It stays sticky, and adjacent same-side reels merge using their multiplier product. All other Yacht Stash rules apply. Trigger with five scatters or receive it from Mystery Bonus. No direct purchase.",
  },
  {
    id: "god-mode",
    kind: "purchase",
    mode: "getaway",
    multiple: 1000,
    title: "The Getaway",
    subtitle: "God Mode",
    tone: "gold",
    spins: 1,
    multiplier: 1,
    art: "/kilo-v79/surfaces/getaway.webp",
    detail:
      "Activate Max spins, then press Spin for each attempt. Every spin costs 1,000× the base bet and pays either 25,000× or zero. No free spins, secondary gamble or partial award. Activation itself is free; exit between spins.",
  },
  {
    id: "mystery",
    kind: "purchase",
    mode: "mystery",
    multiple: MYSTERY_PRICE,
    spins: 0,
    multiplier: 1,
    title: "Mystery Bonus",
    subtitle: "3, 4 or 5-scatter bonus",
    tone: "violet",
    art: "/kilo-features-v12/mystery.webp",
    detail: `Awards Dockside Catch, Yacht Stash or Super Yacht Stash. One charge, then the selected bonus plays at the current base bet. Super Yacht Stash guarantees a winning ×25 VS on reel one of spin one. ${MYSTERY_ODDS_COPY}.`,
  },
];

export const FEATURE_GROUPS = [
  { id: "buy", title: "Buy features" },
  { id: "scatter", title: "Scatter bonuses" },
  { id: "development", title: "In development" },
] as const;

export type FeatureGroup = (typeof FEATURE_GROUPS)[number]["id"];

/** Grouping changes presentation only; scatter previews never purchase a mode. */
export function featuresForGroup(group: FeatureGroup): BonusFeature[] {
  if (group === "buy")
    return FEATURES.filter((feature) => feature.kind === "purchase");
  if (group === "development")
    return FEATURES.filter((feature) => feature.kind === "preview");
  return FEATURES.flatMap((feature): BonusFeature[] => {
    if (feature.kind === "preview" || !feature.scatters) return [];
    return [
      {
        id: feature.id,
        title: feature.title,
        subtitle: feature.subtitle,
        art: feature.art,
        tone: feature.tone,
        detail: feature.detail,
        kind: "trigger",
        scatters: feature.scatters,
        spins: feature.spins,
        multiplier: feature.multiplier,
      },
    ];
  });
}
