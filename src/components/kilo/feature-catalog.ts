import type { PurchaseMode } from "@/lib/kilo/engine";
import { MYSTERY_PRICE, MYSTERY_ODDS_COPY } from '@/lib/kilo/mystery-bonus';
import { t } from '@/lib/kilo/copy';
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
      "10 free spins. Fishermen collect every package at the current multiplier. Collectors advance the ×1 / ×2 / ×3 / ×10 ladder.",
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
    detail: t("feature.yachtDetail"),
  },
  {
    id: "scatter-5",
    kind: "trigger",
    title: "Super Yacht Stash",
    subtitle: t("card.scatter.superYacht"),
    tone: "gold",
    scatters: 5,
    spins: 15,
    multiplier: 25,
    art: "/kilo-v79/surfaces/yacht.webp",
    detail: t("feature.superYachtDetail"),
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
    detail: t("feature.getawayDetail"),
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
    detail: t("feature.mysteryDetail")(MYSTERY_ODDS_COPY),
  },
];

export const FEATURE_GROUPS = [
  { id: "buy", title: t("feature.groupBuy") },
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
