/** Authored joint curves shared by the on-reel actors and registered marina actor.
 * Presentation only: no random values, timers, payouts or feature state. */
export type RigActor = 'king' | 'vice';
export type RigAction = 'rest' | 'challenge' | 'victory' | 'defeat' | 'glance';
export type JointPose = { rotation: number; x: number; y: number };
export type RigPose = Record<string, JointPose>;
export const CHARACTER_ACTION_MS = 1120;

const clamp = (n: number) => Math.min(1, Math.max(0, n));
const smooth = (n: number) => n * n * (3 - 2 * n);
function curve(t: number, keys: readonly (readonly [number, number])[]) {
  if (t <= keys[0]![0]) return keys[0]![1];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1]!, b = keys[i]!;
    if (t <= b[0]) return a[1] + (b[1] - a[1]) * smooth((t - a[0]) / (b[0] - a[0]));
  }
  return keys.at(-1)![1];
}

export function characterPoseAt(actor: RigActor, action: RigAction, progress: number): RigPose {
  const t = clamp(progress);
  const pose: RigPose = {};
  const set = (id: string, degrees: number, x = 0, y = 0) => {
    pose[id] = { rotation: degrees * Math.PI / 180, x, y };
  };
  // Both planted feet are one rigid drawing. Only real joints articulate;
  // the root never bobs or scales. Ambient life is layered separately.
  if (action === 'rest') return pose;
  if (action === 'glance') {
    const look = curve(t, [[0,0],[.26,-1],[.52,.35],[1,0]]);
    set('head', look * 3.5);
    set('forearmR', look * 2);
    return pose;
  }
  if (action === 'challenge') {
    const brace = curve(t, [[0,0],[.23,-.38],[.57,1],[.78,.78],[1,0]]);
    const follow = curve(t, [[0,0],[.28,-.25],[.66,1],[.86,.65],[1,0]]);
    // Within the inspected joint ranges: King braces and draws in the rod;
    // Vice opens the palm into a clear stop gesture rather than a tiny sway.
    set('torso', (actor === 'king' ? -3.5 : 2.86) * brace);
    set('head', (actor === 'king' ? 4.5 : -2.3) * follow);
    set('upperArmL', (actor === 'king' ? -10.3 : 10.3) * brace);
    set('forearmL', (actor === 'king' ? -14.3 : 37.2) * follow);
    set('upperArmR', 3.4 * brace);
    set('forearmR', -13.7 * follow);
    // The wrist keeps the rod pitched clear of the face while the elbow bends.
    if(actor==='king')pose.prop={rotation:-(pose.torso!.rotation+pose.upperArmL!.rotation+pose.forearmL!.rotation)+.07*brace,x:0,y:0};
    return pose;
  }
  const commit = curve(t, [[0,0],[.28,.8],[.55,1],[.8,.42],[1,0]]);
  if (action === 'victory') {
    set('head', (actor === 'king' ? -5 : 4) * commit);
    set('torso', (actor === 'king' ? -1.3 : 1) * commit);
    set('forearmR', (actor === 'king' ? -8 : -5) * commit);
  } else {
    set('head', (actor === 'king' ? 7 : -7) * commit);
    set('torso', (actor === 'king' ? 2 : -2) * commit);
    set('upperArmL', 4 * commit);
  }
  return pose;
}

/** Deterministic atlas timing. Reduced motion selects the stable result frame. */
export function performanceFrameAt(progress: number, frames: number, reduced = false, settle = frames - 1) {
  if (reduced) return Math.max(0, Math.min(frames - 1, settle));
  return Math.min(frames - 1, Math.floor(clamp(progress) * frames));
}

/** Frame dwell comes from the authored shot, including its cargo-release hold. */
export function timedPerformanceFrameAt(progress:number,durations:readonly number[],reduced=false,settle=durations.length-1){
  if(reduced)return Math.max(0,Math.min(durations.length-1,settle));
  let remaining=clamp(progress)*durations.reduce((sum,n)=>sum+n,0);
  for(let i=0;i<durations.length-1;i++){if(remaining<durations[i]!)return i;remaining-=durations[i]!;}
  return durations.length-1;
}
