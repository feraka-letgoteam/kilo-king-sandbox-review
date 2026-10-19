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
