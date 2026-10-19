import { ENVIRONMENT_ART } from './environment-art';
import type { SceneId } from './scene-system';

/** Runtime planes keep the exact source registration. Clean backing only
 * reconstructs pixels exposed by a moving crown; it never replaces a scene.
 * Chopper remains on the existing renderer while that mode is retired. */
const scenes = ['base', 'scatter-3', 'scatter-4', 'max-win'] as const;
export const ENVIRONMENT_LAYER_URLS: Readonly<Record<string,string>> = Object.fromEntries(
  scenes.flatMap(scene => [false,true].flatMap(portrait => {
    const id=scene+(portrait?'-portrait':'');
    return ['foliage','backing','reflections'].map(layer=>[`${id}-${layer}`,`/kilo-v82/environment/${id}-${layer}.webp`]);
  })),
);

export function environmentLayerKeys(scene:SceneId,portrait:boolean) {
  const id=ENVIRONMENT_ART[scene]+(portrait?'-portrait':'');
  return {foliage:`${id}-foliage`,backing:`${id}-backing`,reflections:`${id}-reflections`};
}

export function separatedEnvironmentLayers(scene:SceneId,portrait:boolean,assets:Record<string,CanvasImageSource|undefined>) {
  const key=environmentLayerKeys(scene,portrait),foliage=assets[key.foliage],backing=assets[key.backing];
  // Both planes must be decoded together. A partial fetch never removes the
  // tree or doubles it; the original static painting is the safe fallback.
  return foliage&&backing?{foliage,backing,reflections:assets[key.reflections]}:null;
}
