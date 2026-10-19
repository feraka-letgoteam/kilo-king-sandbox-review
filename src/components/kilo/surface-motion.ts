const unit = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = unit(n); return t * t * (3 - 2 * t); };

/** One ready / release / recovery inside the existing surface-art rectangle.
 * This is decorative only: no countdown, credit, callbacks or scene delay. */
export function surfaceArtAt(key: string, progress: number, reduced = false) {
  const t = unit(progress);
  if (reduced || t === 0 || t === 1) return { x: 1, y: 1, turn: 0, lift: 0 };
  const load = smooth(t / .16) * (1 - smooth((t - .18) / .13));
  const drive = smooth((t - .19) / .17) * (1 - smooth((t - .40) / .30));
  const recover = Math.sin(Math.PI * unit((t - .60) / .40)) * (1 - smooth((t - .60) / .40));
  const caseArt = key === 'completion' || key === 'retrigger';
  return {
    x: 1 - .024 * load - .014 * drive,
    y: 1 - .052 * load - .018 * recover,
    turn: (caseArt ? .028 : -.035) * load + (caseArt ? -.024 : .022) * drive + .008 * recover,
    lift: .010 * load - .018 * drive + .004 * recover,
  };
}
