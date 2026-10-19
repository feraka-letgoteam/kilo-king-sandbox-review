import illustratedSymbols from '../../../public/kilo-v79/symbols/manifest.json';
import materialActions from '../../../public/kilo-v82/symbols/manifest.json';
import { V82_SURFACE_CLIPS } from './authored-surface-clips';
import type {AuthoredClip} from './authored-animation';

/** Current illustrated drawing packs. No legacy visual fallback is exported. */
export const AUTHORED_CLIPS: Readonly<Record<string, AuthoredClip>> = {
  ...illustratedSymbols.clips as unknown as Record<string, AuthoredClip>,
  ...materialActions.clips as unknown as Record<string, AuthoredClip>,
  ...V82_SURFACE_CLIPS,
};
