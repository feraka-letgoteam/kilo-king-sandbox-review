import { characterPoseAt, type RigAction, type RigActor, type RigPose } from './rig-performance';

/** Character performance only. Its clock never drives reels, outcomes or awards. */
export type BlinkFrame = 'open' | 'half' | 'closed';
export type CharacterLifeFrame = { pose: RigPose; blink: BlinkFrame; expressive: boolean };
export const CHARACTER_LIFE_FPS = 30;
export const CHARACTER_BLEND_MS = 180;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const phase = (time: number, duration: number) => ((time % duration) + duration) % duration / duration;
function keys(t: number, points: readonly (readonly [number, number])[]) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!;
    if (t <= b[0]) return a[1] + (b[1] - a[1]) * smooth((t - a[0]) / (b[0] - a[0]));
  }
  return points.at(-1)![1];
}
const breathKeys = [[0, 0], [.35, 1], [.46, .98], [.90, 0], [1, 0]] as const;
const lookKeys = [[0, 0], [.13, .3], [.33, 1], [.53, .82], [.84, 0], [1, 0]] as const;

/** Unequal intervals and an occasional double blink, with a short closed hold.
 * No random calls: a resize or a new spin cannot restart or reroll the face. */
export function characterBlinkAt(time: number): BlinkFrame {
  const t = ((time % 26000) + 26000) % 26000;
  for (const at of [3280, 9410, 16600, 16890, 23180]) {
    const age = t - at;
    if (age >= 0 && age < 50) return 'half';
    if (age >= 50 && age < 115) return 'closed';
    if (age >= 115 && age < 180) return 'half';
  }
  return 'open';
}

/** Layered, planted idle: asymmetrical breathing, neck counter-motion and
 * delayed wrists. There is no root translation, scaling, float or foot slide. */
export function characterIdleAt(actor: RigActor, elapsed: number, variant = 0): CharacterLifeFrame {
  const time = Math.max(0, elapsed) + variant * 1739;
  const period = actor === 'king' ? 4900 : 5630;
  const breath = keys(phase(time, period), breathKeys);
  const follow = keys(phase(time - 230, period), breathKeys);
  const weight = Math.sin(time / (actor === 'king' ? 17300 : 19700) * Math.PI * 2);
  // A brief check of the reels, separated by long quiet holds.
  const glanceAge = phase(time + (actor === 'vice' ? 4300 : 0), 18400) * 18400 - 11200;
  const glance = glanceAge >= 0 && glanceAge <= 2400 ? keys(glanceAge / 2400, lookKeys) : 0;
  const pose: RigPose = {};
  const set = (id: string, degrees: number, x = 0, y = 0) => {
    pose[id] = { rotation: degrees * Math.PI / 180, x, y };
  };
  set('torso', weight * (actor === 'king' ? .43 : .31), weight * .55, -1.85 * breath);
  set('head', -.34 * weight + (actor === 'king' ? -1.5 : 1.2) * glance, 0, .45 * follow);
  set('upperArmL', -.48 * breath + .26 * weight);
  set('upperArmR', .45 * follow - .18 * weight);
  set('forearmL', .62 * follow + (actor === 'king' ? -1.15 : .45) * glance);
  set('forearmR', -.55 * follow - .35 * glance);
  // Grip and rod follow the wrist without sweeping across the face or values.
  if (actor === 'king') pose.prop = {
    rotation: -(pose.torso!.rotation + pose.upperArmL!.rotation + pose.forearmL!.rotation) + .004 * follow,
    x: 0, y: 0,
  };
  return { pose, blink: actor === 'king' ? characterBlinkAt(time) : 'open', expressive: false };
}

export function blendCharacterPoses(from: RigPose, to: RigPose, amount: number): RigPose {
  const result: RigPose = {}, t = clamp(amount);
  if (t === 0) return { ...from };
  if (t === 1) return { ...to };
  for (const id of new Set([...Object.keys(from), ...Object.keys(to)])) {
    const a = from[id] ?? { rotation: 0, x: 0, y: 0 }, b = to[id] ?? { rotation: 0, x: 0, y: 0 };
    result[id] = { rotation: a.rotation + (b.rotation - a.rotation) * t,
      x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  return result;
}

export function characterLifeAt(actor: RigActor, elapsed: number, action: RigAction = 'rest', progress = 1, variant = 0): CharacterLifeFrame {
  const idle = characterIdleAt(actor, elapsed, variant);
  if (action === 'rest' || progress >= 1) return idle;
  const t = clamp(progress), reaction = characterPoseAt(actor, action, t);
  // The action takes precedence at its peak; the same idle phase remains under it.
  const ambient = 1 - .82 * Math.sin(t * Math.PI);
  const pose = blendCharacterPoses({}, idle.pose, ambient);
  for (const [id, p] of Object.entries(reaction)) {
    const base = pose[id] ?? { rotation: 0, x: 0, y: 0 };
    pose[id] = { rotation: base.rotation + p.rotation, x: base.x + p.x, y: base.y + p.y };
  }
  const expressive = action === 'victory' && t > .25 && t < .85;
  return { pose, expressive, blink: expressive || (t > .1 && t < .88) ? 'open' : idle.blink };
}

/** Retained across React updates and viewport changes. A new reaction blends
 * from the current drawing; pausing never advances either performance clock. */
export function createCharacterPlayback(actor: RigActor, variant = 0) {
  let elapsed = 0, actionElapsed = 1120, action: RigAction = 'rest', key = '';
  let transition = CHARACTER_BLEND_MS, from: RigPose = {}, frame: CharacterLifeFrame = { pose: {}, blink: 'open', expressive: false };
  let wasReduced = false;
  return {
    setAction(next: RigAction, nextKey: string) {
      if (key === nextKey) return;
      key = nextKey; action = next; actionElapsed = 0; transition = 0; from = frame.pose;
    },
    advance(delta: number, reduced = false, paused = false): CharacterLifeFrame {
      if (reduced) { wasReduced = true; return frame = { pose: {}, blink: 'open', expressive: false }; }
      if (paused) return frame;
      if (wasReduced) { wasReduced = false; from = {}; transition = 0; action = 'rest'; }
      const dt = Math.min(80, Math.max(0, Number.isFinite(delta) ? delta : 0));
      elapsed += dt; actionElapsed += dt; transition += dt;
      const duration = action === 'glance' ? 720 : 1120;
      const sampled = characterLifeAt(actor, elapsed, action, clamp(actionElapsed / duration), variant);
      frame = { ...sampled, pose: blendCharacterPoses(from, sampled.pose, smooth(transition / CHARACTER_BLEND_MS)) };
      return frame;
    },
    get elapsed() { return elapsed; },
    get frame() { return frame; },
  };
}
