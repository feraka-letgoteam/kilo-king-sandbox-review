import { AUTHORED_CLIPS } from './authored-clips';
const prepared = new Map<string,HTMLImageElement>();
/** Optional animation art is warmed alongside loading; failure never blocks Enter. */
export function preloadAuthoredArt() {
  if(typeof Image==='undefined')return;
  // Pixi owns symbol textures. Do not also retain a second decoded DOM copy
  // of every symbol sheet on phones.
  for(const [key,clip] of Object.entries(AUTHORED_CLIPS)) {
    if(!key.startsWith('entry-')&&!key.startsWith('actor')&&key!=='completion')continue;
    if(prepared.has(clip.url))continue;
    const image=new Image();image.decoding='async';prepared.set(clip.url,image);
    image.onload=()=>void image.decode().catch(()=>{});
    image.onerror=()=>prepared.delete(clip.url);
    image.src=clip.url;
  }
}
