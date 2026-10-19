import type { SplashScript } from '@/lib/kilo/engine';
import { sceneForRound, type SceneId } from './scene-system';
import { environmentArtUrl } from './environment-art';

export type FeatureEnvironmentId = SceneId;
export type ArtworkCrop = { x: number; y: number; width: number; height: number };

/** New illustrated v79 plates retain the original world canvas dimensions.
 * The actor camera, game rectangles and gameplay clocks remain independent. */
export const FEATURE_ENVIRONMENTS = {
  base: { title: 'Kilo’s Marina', desktop: { x: 0, y: 0, width: 1920, height: 1080 }, portrait: { x: 0, y: 0, width: 768, height: 1708 } },
  loading: { title: 'Welcome to Miami', desktop: { x: 0, y: 0, width: 1920, height: 1080 }, portrait: { x: 0, y: 0, width: 768, height: 1708 } },
  completion: { title: 'Back at the Marina', desktop: { x: 0, y: 0, width: 1920, height: 1080 }, portrait: { x: 0, y: 0, width: 768, height: 1708 } },
  'scatter-3': { title: 'Dockside Catch', desktop: { x: 0, y: 0, width: 1600, height: 900 }, portrait: { x: 0, y: 0, width: 768, height: 1708 } },
  'scatter-4': { title: 'Yacht Stash', desktop: { x: 0, y: 0, width: 1600, height: 900 }, portrait: { x: 0, y: 0, width: 768, height: 1708 } },
  'chopper': { title: 'Chopper Route', desktop: { x: 0, y: 0, width: 1600, height: 900 }, portrait: { x: 0, y: 0, width: 768, height: 1800 } },
  'max-win': { title: 'The Getaway', desktop: { x: 0, y: 0, width: 1920, height: 1080 }, portrait: { x: 0, y: 0, width: 1080, height: 2400 } },
  'scatter-5': { title: 'Chopper Route', desktop: { x: 0, y: 0, width: 1600, height: 900 }, portrait: { x: 0, y: 0, width: 768, height: 1800 } },
  mystery: { title: 'Chopper Route', desktop: { x: 0, y: 0, width: 1600, height: 900 }, portrait: { x: 0, y: 0, width: 768, height: 1800 } },
  'god-mode': { title: 'The Getaway', desktop: { x: 0, y: 0, width: 1920, height: 1080 }, portrait: { x: 0, y: 0, width: 1080, height: 2400 } },
} as const;

export function isFeatureEnvironment(scene: SceneId): scene is FeatureEnvironmentId {
  return scene === 'scatter-3' || scene === 'scatter-4' || scene === 'chopper' || scene === 'max-win';
}

export function featureEnvironmentUrl(scene: SceneId, portrait: boolean) {
  return environmentArtUrl(scene, portrait);
}

/** This selects only artwork. Entry, collection, awards and completion still
 * come from the existing director/HUD; no outcomes or modes are created here. */
export function environmentForPresentation({ round, maxSpinMode, active, summary, busy, reviewing }: {
  round: SplashScript | null; maxSpinMode: boolean; active: boolean;
  summary: boolean; busy: boolean; reviewing: boolean;
}): SceneId {
  if (maxSpinMode || ((busy || reviewing) && round?.version === 4 && round.feature === 'getaway')) return 'max-win';
  if (active || (summary && round?.version === 4)) return sceneForRound(round);
  return summary ? 'completion' : 'base';
}

/** Bottom-aligned cover of a safe source rectangle, without stretching art.
 * This affects only the backdrop; no reel, control or actor geometry is read. */
export function featureArtworkTransform(crop: ArtworkCrop, width: number, height: number) {
  const scale = Math.max(width / crop.width, height / crop.height);
  return { scale, x: (width - crop.width * scale) / 2 - crop.x * scale,
    y: height - (crop.y + crop.height) * scale };
}
