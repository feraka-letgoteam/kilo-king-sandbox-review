/** Physical performance only. The recorded segment count still owns the result. */
export const MAX_RIG_URLS = ['/kilo-v62/max/hull.png', '/kilo-v62/max/performance-parts.png'] as const;
export const MAX_ESCAPE_MS = 900;
export type BoatBeat = 'anticipate' | 'advance' | 'settle' | 'escape' | 'rest';
const clamp = (t:number) => Math.max(0,Math.min(1,t));
const smooth = (t:number) => { const v=clamp(t); return v*v*(3-2*v); };
export function boatPerformance(beat:BoatBeat,progress:number) {
  const t=clamp(progress),pressure=Math.sin(Math.PI*t);
  // First 28% is a genuine stationary, unpowered hold. Then the stern
  // squats and the propwash builds BEFORE the root begins moving.
  const preload=beat==='anticipate'?smooth((t-.28)/.72):
    beat==='advance'||beat==='escape'?1-smooth(t/.24):0;
  // The last quarter of travel is already braking. The following settle starts
  // at exactly that pitch/lean/wake, so a segment never snaps to a new pose.
  const thrust=beat==='advance'?Math.sin(Math.PI*Math.min(1,t/.84))**2:beat==='escape'?smooth(t/.42):0;
  const brake=beat==='advance'?smooth((t-.66)/.34):beat==='settle'?(1-t)**2:0;
  const settle=beat==='settle'?Math.sin(t*Math.PI*2)*(1-t)**2:0;
  const wake=clamp(.72*preload+(beat==='advance'?.82*pressure+.38*t:beat==='escape'?thrust:beat==='settle'?.38*(1-t)**2:0));
  return {
    pitch:.055*preload-.17*thrust+.09*brake-.055*settle,
    heave:9*preload-18*thrust+8*brake+9*settle,
    motor:.06*preload+.19*thrust-.09*brake,
    driverLean:-.09*preload-.30*thrust+.22*brake-.08*settle,
    thrust,brake,wake,
    wakeLength:1+.15*preload+.75*thrust-.2*brake,
    wakeHeight:1+.55*preload+.85*thrust-.3*brake,
    wakeTrail:95*thrust,
  };
}
