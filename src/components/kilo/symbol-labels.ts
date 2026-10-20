import { t } from "@/lib/kilo/copy";
/** Presentation names only. Recorded symbol IDs and payout tables stay intact. */
export const SYMBOL_LABELS = {
  "10": "10",
  J: "J",
  Q: "Q",
  K: "K",
  A: "A",
  cuffs: "Bobber",
  keys: t("symbol.cashRoll"),
  lamp: "Gold reel",
  duffel: "Tackle case",
  brick: "Contraband",
  bars: "KING scatter",
  splash: "Fisherman wild",
} as const;
