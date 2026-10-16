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
        mode: "buy" | "chopper";
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
    title: "3 Scatters",
    subtitle: "Free spins",
    tone: "teal",
    scatters: 3,
    spins: 10,
    multiplier: 1,
    art: "/kilo-features-v12/scatter-3.webp",
    detail:
      "Land 3 scatters to trigger the feature, or buy direct entry. The recorded modifier may add spins or raise the starting multiplier.",
  },
  {
    id: "scatter-4",
    kind: "trigger",
    title: "4 Scatters",
    subtitle: "Free spins",
    tone: "amber",
    scatters: 4,
    spins: 15,
    multiplier: 1,
    art: "/kilo-features-v12/scatter-4.webp",
    detail:
      "Land 4 scatters in the base game to start with 15 free spins. The recorded modifier may increase the starting award. Direct purchase is not available.",
  },
  {
    id: "scatter-5",
    kind: "trigger",
    title: "5 Scatters",
    subtitle: "Free spins",
    tone: "crimson",
    scatters: 5,
    spins: 20,
    multiplier: 1,
    art: "/kilo-features-v12/scatter-5.webp",
    detail:
      "Land 5 scatters in the base game to start with 20 free spins. The recorded modifier may increase the starting award. Direct purchase is not available.",
  },
  {
    id: "chopper",
    kind: "purchase",
    mode: "chopper",
    multiple: 250,
    title: "Chopper",
    subtitle: "Bonus buy",
    tone: "ice",
    spins: 10,
    multiplier: 2,
    art: "/kilo-features-v12/chopper.webp",
    detail:
      "Direct entry with 10 free spins and a ×2 starting multiplier. The recorded modifier may add spins or raise the starting multiplier to ×3.",
  },
  {
    id: "mystery",
    kind: "preview",
    title: "Mystery Bonus",
    subtitle: "In development",
    tone: "violet",
    art: "/kilo-features-v12/mystery.webp",
    detail:
      "Artwork preview. Gameplay, awards and purchase terms are still being designed. This feature cannot be played or purchased yet.",
  },
  {
    id: "god-mode",
    kind: "preview",
    title: "God Mode",
    subtitle: "In development",
    tone: "gold",
    art: "/kilo-features-v12/god-mode.webp",
    detail:
      "Artwork preview. Gameplay, awards and purchase terms are still being designed. This feature cannot be played or purchased yet.",
  },
];
