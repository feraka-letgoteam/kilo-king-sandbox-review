/** Finite UI scheduling only. Every round uses the existing play/charge path. */
export const AUTO_COUNTS = [10, 25, 50, 75, 100, 250, 500, 1000] as const;
export function createAutoSpins(
  onChange: (remaining: number) => void,
  delay = () => new Promise<void>((resolve) => setTimeout(resolve, 400)),
) {
  let generation = 0,
    remaining = 0;
  const stop = () => {
    generation++;
    remaining = 0;
    onChange(0);
  };
  const start = (
    count: number,
    play: () => Promise<{ feature: boolean } | undefined>,
  ) => {
    if (remaining || !AUTO_COUNTS.some((n) => n === count)) return false;
    const ticket = ++generation;
    remaining = count;
    onChange(remaining);
    void (async () => {
      try {
        while (ticket === generation && remaining > 0) {
          const outcome = await play();
          if (ticket !== generation) return;
          remaining--;
          onChange(remaining);
          // A recorded feature, rejected charge, or interrupted call ends this run.
          if (!outcome || outcome.feature || remaining === 0) break;
          await delay();
        }
      } finally {
        if (ticket === generation) {
          remaining = 0;
          onChange(0);
        }
      }
    })().catch(() => {
      if (ticket === generation) stop();
    });
    return true;
  };
  return {
    start,
    stop,
    get remaining() {
      return remaining;
    },
  };
}
