import type { AuthoredClip } from './authored-animation';
import materialSurfaces from '../../../public/kilo-v82/surfaces/manifest.json';

/** Four independently authored poses per crest. The existing host controls
 * 700ms entry, 560ms retrigger and 640ms completion clocks; this table never
 * creates timers or modifies feature events. One registration avoids jitter. */
const frames = [
  { x: 0, y: 0, w: 768, h: 512 }, { x: 768, y: 0, w: 768, h: 512 },
  { x: 0, y: 512, w: 768, h: 512 }, { x: 768, y: 512, w: 768, h: 512 },
] as const;
const clip = (name: string, durations: readonly number[]): AuthoredClip => ({
  url: `/kilo-v79/surfaces/${name}-sheet.webp`,
  width: 1536, height: 1024, frames,
  bounds: [0, 0, 768, 512],
  reference: { width: 768, height: 512, bounds: [0, 0, 768, 512] },
  sequence: [0, 1, 2, 3], durations,
});
const v82 = materialSurfaces.clips as unknown as Record<string, AuthoredClip>;
export const V82_SURFACE_CLIPS: Readonly<Record<string, AuthoredClip>> = {
  'entry-scatter-3': v82.dock,
  'entry-scatter-4': v82.yacht,
  'entry-god-mode': clip('getaway', [110, 110, 140, 160]),
  retrigger: { ...v82.completion, durations: [25, 90, 120, 120, 150, 55] },
  completion: v82.completion,
};

export const V79_ENTRY_ART: Readonly<Record<string, string>> = {
  'scatter-3': '/kilo-v79/surfaces/dock.webp',
  'scatter-4': '/kilo-v79/surfaces/yacht.webp',
  'god-mode': '/kilo-v79/surfaces/getaway.webp',
  mystery: '/kilo-v79/surfaces/completion.webp',
};
