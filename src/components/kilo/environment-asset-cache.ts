import type { SceneId } from './scene-system';
import { ATMOSPHERE_URLS, type AtmosphereImages } from './feature-atmosphere';
import { environmentLayerKeys } from './environment-layers';

type Decode=(url:string)=>Promise<CanvasImageSource|undefined>;
type Entry={users:number;ready:Promise<AtmosphereImages>};

/** Keep only shared atmospheric art resident globally. Sparse world-sized
 * alpha planes are leased by scene/orientation so their decoded dimensions do
 * not accumulate across all modes. Each mounted canvas owns its own lease. */
export function createEnvironmentAssetCache(decode:Decode) {
  let shared:Promise<AtmosphereImages>|undefined;
  const entries=new Map<string,Entry>();
  const preloadShared=()=>shared??=Promise.all(['clouds','jetski'].map(async key=>
    [key,await decode(ATMOSPHERE_URLS[key as 'clouds'|'jetski'])] as const,
  )).then(items=>Object.fromEntries(items));
  const acquire=(scene:SceneId,portrait:boolean)=>{
    const urls=ATMOSPHERE_URLS as Readonly<Record<string,string>>;
    const keys=Object.values(environmentLayerKeys(scene,portrait)).filter(key=>!!urls[key]);
    if(!keys.length)return{ready:preloadShared(),release:()=>{}};
    const id=keys.join('|');let entry=entries.get(id);
    if(!entry){
      entry={users:0,ready:Promise.all([preloadShared(),Promise.all(keys.map(async key=>
        [key,await decode(urls[key]!)] as const,
      ))]).then(([common,planes])=>({...common,...Object.fromEntries(planes)}))};
      entries.set(id,entry);
    }
    entry.users++;const retained=entry;let released=false;
    return {ready:entry.ready,release:()=>{
      if(released)return;released=true;retained.users--;
      if(retained.users===0&&entries.get(id)===retained)entries.delete(id);
    }};
  };
  return{preloadShared,acquire};
}
