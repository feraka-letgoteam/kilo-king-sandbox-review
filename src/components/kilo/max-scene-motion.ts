import type { SceneMotionDefinition } from './scene-motion-v49';
/** Source-pixel registration for the v59 boathouse plates. Old v49 masks must
 * never be applied to this artwork: they would copy floor/sky into the water. */
export const maxSceneMotionDefinition=(portrait:boolean):SceneMotionDefinition=>portrait?{
  width:1080,height:2400,
  water:[{polygon:[[145,1175],[900,1175],[900,1295],[820,1330],[820,1440],[145,1440]],amplitude:.6,speed:.52}],
  lights:[],
}:{
  width:1920,height:1080,
  water:[{polygon:[[470,525],[1330,525],[1330,738],[470,738]],amplitude:.6,speed:.52}],
  lights:[],
};
