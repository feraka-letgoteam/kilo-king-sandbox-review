import manifest from '../../../public/kilo-overhaul-v1/background/manifest-part.json';
import type { SceneId } from './scene-system';

/** Artwork coordinates only. No game state, stake, outcomes or wallet access. */
export const OVERHAUL_ART_ROOT = '/kilo-overhaul-v1/';
type Layer = {
  id: string; runtimeWebp: string; pivot: number[]; opacity: number; tint: string;
  blendMode: string; tileX: boolean;
  motion: { type: string; periodSeconds: number; amplitudeX: number; amplitudeY: number; rotationDegrees: number };
};
type Plane = {
  masterSize: number[]; viewport: number[]; layers: Layer[]; compositeWebp: string;
};
type LayerOverride = { opacity?: number; tint?: string; translateX?: number; translateY?: number };
type Mode = { tint: string; layerOverrides: Record<string, LayerOverride> };
type ArtManifest = { orientations: Record<'desktop'|'phone', Plane>; modes: Record<string, Mode> };
const art = manifest as unknown as ArtManifest;
export type OverhaulEnvironment = { definition: Plane; images: Readonly<Record<string, CanvasImageSource>>;
  tinted: Map<string, HTMLCanvasElement>; portrait: boolean };
/** Also used by the offline production renderer; it supplies decoded images
 * directly, without standing up a second or approximate animation system. */
export function createOverhaulEnvironment(portrait:boolean,images:Readonly<Record<string,CanvasImageSource>>):OverhaulEnvironment {
  return {definition:art.orientations[portrait?'phone':'desktop'],images,tinted:new Map(),portrait};
}
export const OVERHAUL_ENVIRONMENT_PLANES=art.orientations;
type Entry = { users: number; ready: Promise<OverhaulEnvironment> };
const cache = new Map<string, Entry>();
const url = (relative: string) => OVERHAUL_ART_ROOT + 'background/' + relative;
export const overhaulEnvironmentFallback = (portrait: boolean) => url(art.orientations[portrait?'phone':'desktop'].compositeWebp);

export function overhaulSceneMode(scene: SceneId) {
  return scene === 'scatter-3' ? 'scatter3' : scene === 'scatter-4' ? 'vs4'
    : scene === 'scatter-5' || scene === 'mystery' || scene === 'chopper' ? 'vs5'
    : scene === 'god-mode' || scene === 'max-win' ? 'max' : 'base';
}
function decode(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve,reject)=>{
    const image=new Image(); image.decoding='async';
    const timer=setTimeout(()=>{image.onload=null;image.onerror=null;reject(new Error('Environment artwork timed out'));},15000);
    const done=()=>{clearTimeout(timer);image.onload=null;image.onerror=null;};
    image.onload=()=>void (image.decode?.()??Promise.resolve()).catch(()=>{}).then(()=>{done();resolve(image);});
    image.onerror=()=>{done();reject(new Error('Environment artwork unavailable'));}; image.src=path;
  });
}
/** One decoded orientation is shared through a mode change. The previous
 * orientation is evicted after its last canvas lease ends. */
export function acquireOverhaulEnvironment(portrait: boolean) {
  const key=portrait?'phone':'desktop'; let entry=cache.get(key);
  if(!entry){
    const definition=art.orientations[key];
    entry={users:0,ready:Promise.all(definition.layers.map(async layer=>[layer.id,await decode(url(layer.runtimeWebp))] as const))
      .then(entries=>createOverhaulEnvironment(portrait,Object.fromEntries(entries)))};
    cache.set(key,entry);
    const current=entry;
    void entry.ready.catch(()=>{if(cache.get(key)===current)cache.delete(key);});
  }
  entry.users++; const retained=entry; let released=false;
  return {ready:entry.ready,release:()=>{
    if(released)return;released=true;retained.users--;
    if(cache.size>1)for(const [other,value] of cache)if(other!==key&&value.users===0)cache.delete(other);
  }};
}
/** Minimum-jerk periodic drive. Ambient clocks never follow spin speed. */
export function overhaulAmbientPose(layer: Layer, elapsed: number, reduced=false) {
  const motion=layer.motion,period=motion.periodSeconds*1000;
  if(reduced||!period)return{x:0,y:0,turn:0,alpha:1};
  const phase=elapsed/period*Math.PI*2;
  const wind=Math.sin(phase)*.8+Math.sin(phase*2-.35)*.2;
  return {
    x:motion.amplitudeX*Math.sin(phase),
    y:motion.amplitudeY*Math.sin(phase+(motion.type==='boat'?-.65:.4)),
    turn:motion.rotationDegrees*Math.PI/180*wind,
    alpha:motion.type==='light'?.83+.17*(.5+.5*Math.sin(phase))**2
      :motion.type==='reflect'?.83+.17*Math.sin(phase):1,
  };
}
function tintPlane(pack:OverhaulEnvironment,layer:Layer,color:string):CanvasImageSource {
  const source=pack.images[layer.id];
  if(!color||color.toLowerCase()==='#ffffff')return source;
  const key=layer.id+color; const cached=pack.tinted.get(key);if(cached)return cached;
  const image=source as HTMLImageElement,canvas=document.createElement('canvas');
  canvas.width=image.naturalWidth||image.width;canvas.height=image.naturalHeight||image.height;
  const context=canvas.getContext('2d');if(!context)return source;
  context.drawImage(image,0,0);context.globalCompositeOperation='multiply';context.fillStyle=color;
  context.fillRect(0,0,canvas.width,canvas.height);context.globalCompositeOperation='destination-in';context.drawImage(image,0,0);
  pack.tinted.set(key,canvas);
  // Tint variants are small in number and leased with this orientation.
  if(pack.tinted.size>12)pack.tinted.delete(pack.tinted.keys().next().value!);
  return canvas;
}
/** A new independent-plane compositor. It intentionally does not use the old
 * painting's hand-registered palm/water masks. Foreground and King stay fixed. */
export function paintOverhaulEnvironment(ctx:CanvasRenderingContext2D,pack:OverhaulEnvironment,
  scene:SceneId,width:number,height:number,elapsed:number,reduced=false) {
  const {definition}=pack,[mw,mh]=definition.masterSize,[vx,vy,vw,vh]=definition.viewport;
  const scale=Math.max(width/(mw*vw),height/(mh*vh));
  const left=(width-mw*vw*scale)/2-vx*mw*scale,top=height-(vy+vh)*mh*scale;
  const mode=art.modes[overhaulSceneMode(scene)]??art.modes.base;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,width,height);
  ctx.fillStyle='#081828';ctx.fillRect(0,0,width,height);ctx.translate(left,top);ctx.scale(scale,scale);
  for(const layer of definition.layers){
    if(!pack.images[layer.id])continue;
    const override=mode.layerOverrides[layer.id]??{},pose=overhaulAmbientPose(layer,elapsed,reduced);
    const source=tintPlane(pack,layer,override.tint??layer.tint),[px,py]=layer.pivot;
    ctx.save();ctx.globalAlpha=(override.opacity??layer.opacity)*pose.alpha;
    ctx.globalCompositeOperation=layer.blendMode==='add'?'lighter':'source-over';
    ctx.translate((pose.x+(override.translateX??0))*mw,(pose.y+(override.translateY??0))*mh);
    ctx.translate(px*mw,py*mh);ctx.rotate(pose.turn);ctx.translate(-px*mw,-py*mh);
    ctx.drawImage(source,0,0,mw,mh);
    if(layer.tileX&&Math.abs(pose.x)>0){ctx.drawImage(source,-mw,0,mw,mh);ctx.drawImage(source,mw,0,mw,mh);}
    ctx.restore();
  }
  // A small whole-scene colour response ties together the same physical world.
  // It never touches the separately rendered symbols, King or control bar.
  if(mode.tint&&mode.tint!=='#ffffff'){
    ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.20;ctx.fillStyle=mode.tint;
    ctx.fillRect(0,0,mw,mh);
  }
  ctx.restore();
}
