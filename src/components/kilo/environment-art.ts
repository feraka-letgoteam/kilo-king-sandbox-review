import type { SceneId } from './scene-system';

/** One art family shared by the live world, loading/entry/completion backdrops
 * and the offline renderer. Aliases express presentation identity only. */
export type EnvironmentArtId = 'base' | 'scatter-3' | 'scatter-4' | 'chopper' | 'max-win';
export const ENVIRONMENT_ART: Readonly<Record<SceneId, EnvironmentArtId>> = {
  loading: 'base', base: 'base', 'scatter-3': 'scatter-3', 'scatter-4': 'scatter-4',
  'scatter-5': 'chopper', chopper: 'chopper', mystery: 'chopper',
  'god-mode': 'max-win', 'max-win': 'max-win', completion: 'base',
};
export function environmentArtUrl(scene: SceneId, portrait = false) {
  return `/kilo-overhaul-v1/background/fallbacks/${ENVIRONMENT_ART[scene]}${portrait ? '-portrait' : ''}.webp`;
}
