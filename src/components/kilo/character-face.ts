import kingBlink from '../../../public/kilo-v57/characters/king-blink.json';
import type { BlinkFrame } from './character-life';

/** Same head registration and alpha as the original; only eyelids differ. */
export const KING_BLINK = kingBlink;
export const CHARACTER_FACE_URLS = [kingBlink.atlas];
export function kingBlinkFrame(blink: BlinkFrame) {
  return blink === 'open' ? null : kingBlink.states[blink];
}
