import overhaulSurfaces from '../../../public/kilo-overhaul-v1/surfaces/manifest-part.json';
import type { AuthoredClip } from './authored-animation';

/** Twelve registered material frames per new crest. The existing host controls
 * 700ms entry, 560ms retrigger and 640ms completion clocks; this table never
 * creates timers or modifies feature events. One registration avoids jitter. */
const v82 = overhaulSurfaces.clips as unknown as Record<string, AuthoredClip>;
export const V82_SURFACE_CLIPS: Readonly<Record<string, AuthoredClip>> = {
  'entry-scatter-3': v82.dock,
  'entry-scatter-4': v82.yacht,
  'entry-god-mode': v82.getaway,
  retrigger: v82.completion,
  completion: v82.completion,
};

export const V79_ENTRY_ART: Readonly<Record<string, string>> = {
  'scatter-3': '/kilo-overhaul-v1/surfaces/dock.webp',
  'scatter-4': '/kilo-overhaul-v1/surfaces/yacht.webp',
  'god-mode': '/kilo-overhaul-v1/surfaces/getaway.webp',
  mystery: '/kilo-overhaul-v1/surfaces/completion.webp',
};
