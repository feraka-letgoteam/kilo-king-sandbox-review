/** A finite ownership handoff: old units -> equation -> new product. */
export const VS_MERGE_MS = 760;
const unit = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => {const t = unit(n); return t*t*(3-2*t);};
/** One loaded compression, sharp arrival, undershoot and exact resting scale. */
export function vsMultiplierPunch(progress: number) {
  const t = unit(progress), mix = (a: number, b: number, p: number) => a + (b - a) * smooth(p);
  if (t < .16) return mix(.85, .76, t / .16);
  if (t < .37) return mix(.76, 1.38, (t - .16) / .21);
  if (t < .72) return mix(1.38, .955, (t - .37) / .35);
  return mix(.955, 1, (t - .72) / .28);
}
export function vsMergeAt(t: number, reduced = false) {
  if (reduced) return {ready: 0, converge: 1, oldAlpha: 0, newAlpha: 1,
    equationAlpha: 0, productAlpha: 1, productScale: 1, settle: 0, seam: 0};
  const ready = smooth(t / .10) * (1 - smooth((t - .18) / .12));
  const converge = smooth((t - .18) / .24);
  const handoff = smooth((t - .30) / .25);
  const equationAlpha = smooth((t - .18) / .12) * (1 - smooth((t - .60) / .08));
  const productAlpha = smooth((t - .68) / .08);
  return {ready, converge, oldAlpha: 1 - handoff, newAlpha: handoff,
    equationAlpha, productAlpha, productScale: vsMultiplierPunch((t - .66) / .34),
    seam: Math.sin(Math.PI * unit((t - .28) / .44)),
    settle: Math.sin(Math.PI * 2 * unit((t - .74) / .26)) * (1 - unit((t - .74) / .26)) ** 2};
}
