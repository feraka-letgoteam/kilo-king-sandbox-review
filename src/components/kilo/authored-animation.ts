/** Decorative, finite drawing sequences. Never supplies game events or money. */
export type AuthoredClip = {
  url: string;
  width: number;
  height: number;
  frames: readonly { x: number; y: number; w: number; h: number }[];
  /** Union of all frame alpha, measured in one frame's coordinate system. */
  bounds: readonly [number, number, number, number];
  /** Registration of the unchanged source pose. Articulation can extend beyond
   * this box within the existing symbol canvas without shrinking the object. */
  registrationBounds?: readonly [number, number, number, number];
  /** Static source registration; all frames share this one registration. */
  reference: { width: number; height: number; bounds: readonly [number, number, number, number] };
  sequence: readonly number[];
  durations?: readonly number[];
};

export function authoredFrameAt(clip: AuthoredClip, progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  if (clip.durations?.length === clip.sequence.length) {
    const total = clip.durations.reduce((a,b)=>a+b,0);
    let cursor = t * total;
    for (let i=0;i<clip.sequence.length;i++) {
      cursor -= clip.durations[i];
      if (cursor < 0) return clip.sequence[i];
    }
    return clip.sequence[clip.sequence.length-1] ?? 0;
  }
  return clip.sequence[Math.min(clip.sequence.length - 1, Math.floor(t * clip.sequence.length))] ?? 0;
}

export function authoredRegistration(clip: AuthoredClip, width: number, height: number) {
  const [l,t,r,b] = clip.registrationBounds ?? clip.bounds, ref = clip.reference;
  const [rl,rt,rr,rb] = ref.bounds;
  const base = Math.min(width / ref.width, height / ref.height);
  const scale = Math.min((rr-rl)*base/(r-l), (rb-rt)*base/(b-t));
  return {
    scale,
    x: (width-ref.width*base)/2 + (rl+rr)*base/2 - (l+r)*scale/2,
    y: (height-ref.height*base)/2 + (rt+rb)*base/2 - (t+b)*scale/2,
  };
}
