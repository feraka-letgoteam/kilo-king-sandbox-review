import { useEffect, useRef, useState } from 'react';
import type { SceneId } from './scene-system';
import { paintFeatureEnvironment, compositeEnvironmentFrames, FEATURE_ENVIRONMENT_BLEND_MS } from './feature-environment-painter';
import { type AtmosphereImages } from './feature-atmosphere';
import { createEnvironmentAssetCache } from './environment-asset-cache';

const atmosphereCache=createEnvironmentAssetCache(url=>new Promise<HTMLImageElement|undefined>(resolve=>{
  if(typeof Image==='undefined'){resolve(undefined);return;}
  const image=new Image();image.decoding='async';
  image.onload=()=>void(image.decode?.()??Promise.resolve()).then(()=>resolve(image),()=>resolve(image));
  image.onerror=()=>resolve(undefined);image.src=url;
}));
export function preloadFeatureAtmosphere(): Promise<AtmosphereImages> {
  return atmosphereCache.preloadShared();
}

type Artwork = { image: HTMLImageElement; url: string };
type Displayed = { art: Artwork; scene: SceneId; portrait: boolean; assets: AtmosphereImages; clock: number };
export const FEATURE_ENVIRONMENT_FRAME_MS = 1000 / 30;
export const FEATURE_ENVIRONMENT_PIXEL_BUDGET = 850000;

export function FeatureEnvironmentCanvas({ scene, portrait, load, reduced, paused }: {
  scene: SceneId; portrait: boolean;
  load: (scene: SceneId, options: { portrait: boolean }) => Promise<Artwork>;
  reduced: boolean; paused: boolean;
}) {
  const canvas=useRef<HTMLCanvasElement>(null),clock=useRef(0),displayed=useRef<Displayed|null>(null);
  const controls=useRef({reduced,paused}),wake=useRef<(()=>void)|null>(null);
  controls.current={reduced,paused};
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
  useEffect(()=>{
    const node=canvas.current,ctx=node?.getContext('2d');
    if(!node||!ctx)return;
    const incoming=document.createElement('canvas'),incomingContext=incoming.getContext('2d');
    if(!incomingContext)return;
    let disposed=false,art:Artwork|null=null,assets:AtmosphereImages={},raf=0,last=0,painted=-Infinity,visible=true;
    let outgoing:HTMLCanvasElement|null=null,blendElapsed=FEATURE_ENVIRONMENT_BLEND_MS;
    const dimensions=()=>{
      const rect=node.getBoundingClientRect();
      const quality=Math.min(1.5,window.devicePixelRatio||1,
        Math.sqrt(FEATURE_ENVIRONMENT_PIXEL_BUDGET/Math.max(1,rect.width*rect.height)));
      return {w:Math.max(1,Math.round(rect.width*quality)),h:Math.max(1,Math.round(rect.height*quality))};
    };
    const paint=()=>{
      if(disposed)return;
      const previous=displayed.current,active=art?{art,scene,portrait,assets,clock:clock.current}:previous;
      // Keep the decoded previous composition while a feature painting loads.
      // A failed load never exposes an empty canvas or flashes the base scene.
      if(!active)return;
      const {w,h}=dimensions();
      if(node.width!==w||node.height!==h){node.width=w;node.height=h;}
      if(incoming.width!==w||incoming.height!==h){incoming.width=w;incoming.height=h;}
      paintFeatureEnvironment(incomingContext,active.art.image,active.scene,active.portrait,w,h,
        active.clock,controls.current.reduced,active.assets);
      const blend=compositeEnvironmentFrames(ctx,outgoing,incoming,w,h,blendElapsed,controls.current.reduced);
      if(blend>=1)outgoing=null;
      if(art)displayed.current=active;
    };
    const canRun=()=>!disposed&&!!art&&!document.hidden&&visible&&
      (!!outgoing||(!controls.current.paused&&!controls.current.reduced));
    const stop=()=>{cancelAnimationFrame(raf);raf=0;last=0;};
    const frame=(now:number)=>{
      raf=0;if(!canRun())return;
      const delta=last?Math.min(80,now-last):0;last=now;
      if(!controls.current.paused&&!controls.current.reduced)clock.current+=delta;
      blendElapsed=Math.min(FEATURE_ENVIRONMENT_BLEND_MS,blendElapsed+delta);
      if(now-painted>=FEATURE_ENVIRONMENT_FRAME_MS-1){paint();painted=now;}
      raf=requestAnimationFrame(frame);
    };
    const resume=()=>{if(canRun()&&!raf)raf=requestAnimationFrame(frame);};
    const visibility=()=>document.hidden?stop():resume();
    const wakeCurrent=()=>{paint();if(canRun())resume();else stop();};wake.current=wakeCurrent;
    const resize=new ResizeObserver(paint);resize.observe(node);
    const intersection=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(([entry])=>{
      visible=entry?.isIntersecting??false;if(visible)resume();else stop();
    });
    intersection?.observe(node);document.addEventListener('visibilitychange',visibility);
    setStatus('loading');
    const atmosphereLease=atmosphereCache.acquire(scene,portrait);
    // Decode scene and its registered planes atomically. The outgoing canvas
    // and displayed snapshot retain their own images until the incoming frame
    // is ready, including when a portrait/desktop resize interrupts loading.
    void Promise.all([load(scene,{portrait}),atmosphereLease.ready]).then(([decoded,loaded])=>{
      if(disposed)return;
      assets=loaded;
      const previous=displayed.current;
      if(previous&&(previous.scene!==scene||previous.portrait!==portrait)&&!controls.current.reduced){
        // Freeze the currently visible composition once. Only the incoming
        // world keeps animating during the 420 ms dissolve (no double painter).
        outgoing=document.createElement('canvas');outgoing.width=node.width;outgoing.height=node.height;
        outgoing.getContext('2d')?.drawImage(node,0,0);blendElapsed=0;
      }
      art=decoded;paint();setStatus('ready');resume();
    },()=>{if(!disposed){paint();setStatus('error');}});
    return()=>{disposed=true;atmosphereLease.release();stop();resize.disconnect();intersection?.disconnect();
      document.removeEventListener('visibilitychange',visibility);if(wake.current===wakeCurrent)wake.current=null;};
  },[scene,portrait,load]);
  useEffect(()=>{wake.current?.();},[reduced,paused]);
  return <canvas ref={canvas} data-feature-environment={scene} data-environment-status={status}
    data-environment-fps="30" aria-hidden="true" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:1}}/>;
}
