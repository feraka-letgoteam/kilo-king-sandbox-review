/** Ignore native keyboard controls so Space never triggers two actions. */
export function acceptsSpinShortcut(
  event: {
    code: string;
    repeat: boolean;
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
  },
  blocked: boolean,
  interactiveTarget: boolean,
) {
  return (
    event.code === "Space" &&
    !event.repeat &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !blocked &&
    !interactiveTarget
  );
}

/** Main game control bar; Space there is the spin key, not "press the focused button". */
export const GAME_CONTROLS_SELECTOR = "[data-control-system]";
const TEXT_ENTRY = "input, textarea, select, [contenteditable]:not([contenteditable=false])";

/**
 * True when Space on this target should be routed to the spin button even
 * though a control-bar button holds focus (Stake: Space maps to spin).
 * Text entry, anything inside a dialog and anything outside the control bar
 * keep their native keyboard behaviour.
 */
export function isGameControlSpaceTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (target.closest(TEXT_ENTRY)) return false;
  if (target.closest("[role=dialog], dialog")) return false;
  return !!target.closest(GAME_CONTROLS_SELECTOR);
}
