import type { BinaryReels } from '@/lib/kilo/reel-feature-math';
import { recordedMaxSegments } from '@/lib/kilo/max-spin-reveal';

/** Presentation clocks only. The immutable binary record owns every outcome. */
export const GOD_CARD_CLOCK = {
  anticipation: [440, 460, 500, 560, 760],
  advance: [430, 430, 460, 490, 580],
  settle: [170, 170, 190, 210, 380],
  rest: [60, 60, 70, 80, 120],
  stall: 420,
  overshoot: 690,
  impact: 260,
  resultHold: 520,
  release: 160,
} as const;

export type GodCardBeat = 'rest' | 'anticipate' | 'advance' | 'settle' | 'stall' | 'overshoot' | 'result';
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, v: number) => a + (b - a) * clamp(v);

/** One complete illustrated card, moved in literal one-fifth-window steps. */
export function godCardOffset(boardWidth: number, segment: number) {
  return (segment - 5) * boardWidth / 5;
}

/** Smooth acceleration and firm braking; never snaps or teleports. */
export function godCardTravel(progress: number) {
  const t = clamp(progress);
  // Quicker commitment after the wind-up, then a longer water-resistance brake.
  // Integrate a continuous velocity profile; position and velocity never jump.
  const launch = .24, brake = .62, tail = 1 - brake;
  const peak = 1 / (launch / 2 + brake - launch + tail / 2);
  const integral = (u: number) => u ** 3 - .5 * u ** 4;
  if (t < launch) return peak * launch * integral(t / launch);
  if (t < brake) return peak * (launch / 2 + t - launch);
  const u = (t - brake) / tail;
  return peak * (launch / 2 + brake - launch + tail * (u - integral(u)));
}

/** No random draw and no new game state: late recorded losses miss alignment. */
export function godCardOutcome(record: Pick<BinaryReels, 'won' | 'reveal'>) {
  return { won: record.won, segments: recordedMaxSegments(record),
    overshoot: !record.won && recordedMaxSegments(record) === 4 };
}

/** Hull and seated rider rotate around separate registered pivots. Water never
 * rotates with them. Every beat ends at a stable, deterministic drawing. */
export function godCardPose(beat: GodCardBeat, progress: number, stage=1) {
  const t = clamp(progress);
  const intensity=[.9,.96,1.04,1.13,1.23][Math.max(0,Math.min(4,Math.round(stage)-1))]!;
  const preload = smooth((t - .25) / .75);
  let pitch = 0, lean = 0, heave = 0, wake = 0, wakeLength = 1, spray = 0, surge = 0;
  if (beat === 'anticipate') {
    const rev=Math.sin(t*Math.PI*12)*Math.sin(Math.PI*t)**2*preload;
    pitch = (.105 * preload+.009*rev)*intensity;
    lean = (.105 * preload-.015*rev)*intensity;
    heave = (19 * preload+2*rev)*intensity;
    surge = -12 * preload*intensity;
    wake = clamp(.70 * preload*intensity);
    wakeLength = 1 + .45 * preload*intensity;
    spray = clamp(.76 * preload*intensity);
  } else if (beat === 'advance' || beat === 'overshoot') {
    const thrust = smooth(t / .22) * (1 - smooth((t - (beat === 'overshoot' ? .60 : .46)) / (beat === 'overshoot' ? .40 : .36)));
    const braking = beat === 'overshoot' ? 0 : smooth((t - .68) / .32);
    const tail = 1 - smooth(t / .22);
    const lateSquat = beat === 'overshoot' ? smooth((t - .78) / .22) : 0;
    pitch = (.105 * (tail + lateSquat) - .235 * thrust + .13 * braking)*intensity;
    lean = (.105 * (tail + lateSquat) - .36 * thrust + .28 * braking)*intensity;
    heave = (19 * (tail + lateSquat) - 32 * thrust + 19 * braking)*intensity;
    surge = (-12 * (tail + lateSquat) + 23 * thrust - 16 * braking)*intensity;
    wake = clamp((.70 * (tail + lateSquat) + thrust + .49 * braking)*intensity);
    wakeLength = 1 + (.45 * (tail + lateSquat) + 1.10 * thrust - .25 * braking)*intensity;
    spray = clamp((.76 * (tail + lateSquat) + thrust + .46 * braking)*intensity);
  } else if (beat === 'settle') {
    const decay = (1 - t) ** 2;
    const recoil = Math.sin(t * Math.PI * 2) * decay;
    pitch = (.13 * decay - .17 * recoil)*intensity;
    lean = (.28 * decay - .29 * recoil)*intensity;
    heave = (19 * decay + 14 * recoil)*intensity;
    surge = (-16 * decay + 12 * recoil)*intensity;
    wake = .49 * decay*intensity;
    wakeLength = 1 - .25 * decay*intensity;
    spray = .46 * decay*intensity;
  } else if (beat === 'stall') {
    // Load into the stall, hold contact for 55 ms, then counter-rock once.
    const decay = (1 - t) ** 2;
    const contact = smooth(t / .12) * (1 - smooth((t - .25) / .48));
    const counter = Math.sin(Math.PI * clamp((t - .40) / .60)) * decay;
    pitch = (.105 * decay + .19 * contact - .14 * counter)*intensity;
    lean = (.105 * decay + .36 * contact - .22 * counter)*intensity;
    heave = (19 * decay + 28 * contact - 13 * counter)*intensity;
    surge = (-12 * decay - 33 * contact + 16 * counter)*intensity;
    wake = clamp(.70 * decay*intensity);
    wakeLength = 1 + .45 * decay*intensity;
    spray = clamp((.76 * decay + .65 * contact)*intensity);
  }
  return { pitch, lean, heave, surge, wake, wakeLength, spray,
    intensity, thrust: beat === 'advance' || beat === 'overshoot',
    highlight: beat === 'anticipate' ? preload : beat === 'advance' ? 1 - t : 0 };
}

/** One contact, small recoil, then a stable title. No result idle loop. */
export function godCardResultScale(progress: number) {
  const t = clamp(progress);
  if (t < .40) return mix(.72, 1.18, smooth(t / .40));
  if (t < .78) return mix(1.18, .98, smooth((t - .40) / .38));
  return mix(.98, 1, smooth((t - .78) / .22));
}
