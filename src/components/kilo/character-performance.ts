/** Presentation thresholds only. Never generates an outcome or changes an award. */
export const CHARACTER_WIN_THRESHOLD = 10;
export type RoutineMood = "idle" | "cast" | "cheer" | "slump";
export function routineCharacterPose(
  mood: RoutineMood,
): "idle" | "cast" | null {
  // Generic cheer used to fire before every line and again at settlement.
  // Meaningful, already-revealed wins now have their own event.
  if (mood === "cheer") return null;
  return mood === "cast" ? "cast" : "idle";
}
export function earnedCharacterCelebration(
  visibleAward: number,
  stake: number,
  charge: number,
  played: boolean,
  skipped: boolean,
) {
  return (
    !played &&
    !skipped &&
    Number.isFinite(visibleAward) &&
    stake > 0 &&
    visibleAward >= stake * CHARACTER_WIN_THRESHOLD &&
    visibleAward > charge
  );
}
