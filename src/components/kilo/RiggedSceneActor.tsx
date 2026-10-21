import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createCharacterMotionLoop } from './character-motion-loop';
import { STAGE_KING, STAGE_REACTIONS, createStageKingPlayback, type StageKingFrame, type StageReaction } from './stage-character-life';
import { KING_STAGE_CANVAS, KING_THROW_RELEASE, type KingToolAction, type KingToolEvent } from './stage-character-arm';
import { preloadOverhaulKing, overhaulKingPose, paintOverhaulKing, type OverhaulKingImages } from './overhaul-king';
import type { IntegratedCharacterPose, IntegratedMaster } from './integrated-scene-model';

/** Same world camera and planted foot position, with the new inward-facing
 * drawing registered by its body centre rather than the protruding rod. */
export function sceneActorBox(master:IntegratedMaster,portrait:boolean) {
  const height=master.height*(portrait?.31:.667),width=height*2/3;
  return {left:master.width*(portrait?.82:.89)-width*STAGE_KING.anchors.bodyCenter.x/512,
    top:master.height*(portrait?.87:.817)-height*STAGE_KING.anchors.footBaseline/768,width,height};
}

/** Phone fit (presentation only): in portrait the planted King may run past the
 * bottom of short screens. Limits are master units measured from the live page:
 * `bottom` = viewport bottom, `top` = lowest point the hat may rise to (just over
 * the control dock), `right` = viewport right. The whole 512x768 box (rod tip to
 * boots) is scaled down about the boots and lifted so it stays fully in frame. */
export type ActorFrameLimits={top:number;bottom:number;right:number};
export function fitActorBox(box:ReturnType<typeof sceneActorBox>,limits:ActorFrameLimits|null){
  if(!limits)return box;
  const boxBottom=box.top+box.height,cx=STAGE_KING.anchors.bodyCenter.x/512;
  if(boxBottom<=limits.bottom&&box.left+box.width<=limits.right)return box;
  const k=Math.max(.45,Math.min(1,(limits.bottom-limits.top)/box.height));
  const height=box.height*k,width=box.width*k,top=Math.min(boxBottom,limits.bottom)-height;
  const left=Math.min(box.left+box.width*cx-width*cx,limits.right-width);
  return {left,top,width,height};
}

export function RiggedSceneActor({master,portrait,pose='idle',tick=0,reduced=false,paused=false}:{
  master:IntegratedMaster;portrait:boolean;pose?:IntegratedCharacterPose;tick?:number;reduced?:boolean;paused?:boolean;
}) {
  const canvas=useRef<HTMLCanvasElement>(null),playback=useRef(createStageKingPlayback());
  const settings=useRef({reduced,paused});
  const loop=useRef<ReturnType<typeof createCharacterMotionLoop>|null>(null);
  const draw=useRef<(delta:number)=>void>(()=>{});
  const [limits,setLimits]=useState<ActorFrameLimits|null>(null);
  const box=fitActorBox(sceneActorBox(master,portrait),portrait?limits:null);
  useLayoutEffect(()=>{
    if(!portrait){setLimits(null);return;}
    const node=canvas.current,plane=node?.parentElement,shell=node?.closest('.kk-shell');
    if(!node||!plane)return;
    const measure=()=>{
      const p=plane.getBoundingClientRect();if(!p.height)return;
      // The game shell ends at the control dock; the frame is the viewport.
      const s=p.height/master.height,dock=shell?.querySelector('.kk-modular-controls')?.getBoundingClientRect();
      const bottom=innerHeight-4,right=innerWidth-2;
      const top=dock?dock.bottom-34:bottom-p.height;
      const next={top:(top-p.top)/s,bottom:(bottom-p.top)/s,right:(right-p.left)/s};
      setLimits(old=>old&&Math.abs(old.top-next.top)<.5&&Math.abs(old.bottom-next.bottom)<.5&&Math.abs(old.right-next.right)<.5?old:next);
    };
    measure();const ro=new ResizeObserver(measure);ro.observe(plane);if(shell)ro.observe(shell);
    addEventListener('resize',measure);
    return()=>{ro.disconnect();removeEventListener('resize',measure);};
  },[master,portrait]);
  useEffect(()=>{
    const node=canvas.current,ctx=node?.getContext('2d');if(!node||!ctx)return;
    let disposed=false,ready=false,tool:KingToolAction|null=null;
    let images:OverhaulKingImages={};
    const resizeBacking=()=>{
      const rect=node.getBoundingClientRect(),quality=Math.max(.25,Math.min(1.5,
        (window.devicePixelRatio||1)*rect.width/KING_STAGE_CANVAS.width,
        Math.sqrt(500000/(KING_STAGE_CANVAS.width*KING_STAGE_CANVAS.height))));
      const w=Math.round(KING_STAGE_CANVAS.width*quality),h=Math.round(KING_STAGE_CANVAS.height*quality);
      if(node.width!==w||node.height!==h){node.width=w;node.height=h;draw.current(0);}
    };
    resizeBacking();const pixelObserver=new ResizeObserver(resizeBacking);pixelObserver.observe(node);
    function render(frame:StageKingFrame){
      if(!ready||disposed)return;
      paintOverhaulKing(ctx!,images as OverhaulKingImages,frame,settings.current.reduced,tool);
    }
    draw.current=dt=>render(playback.current.advance(dt,settings.current.reduced,settings.current.paused));
    loop.current=createCharacterMotionLoop(node,dt=>draw.current(dt),()=>ready&&!settings.current.reduced&&!settings.current.paused,node.closest('.kk-shell'));
    const shell=node.closest('.kk-shell');let actionId=0;
    const action=(event:Event)=>{
      const detail=(event as CustomEvent<{kind:StageReaction|'settle';big?:boolean}>).detail;
      // A banked collection of >= 10 stakes (flagged by the renderer from the recorded bank) laughs.
      const kind=detail?.kind==='collect-bank'&&detail.big?'collect-big':detail?.kind;
      if(kind==='settle'||settings.current.reduced||settings.current.paused){playback.current.settle();tool=null;}
      else if(STAGE_REACTIONS.includes(kind as StageReaction))playback.current.react(`${kind}:${++actionId}`,kind as StageReaction);
      draw.current(0);loop.current?.refresh();
    };
    shell?.addEventListener('kilo-stage-action',action);
    const focusAction=(event:Event)=>{
      playback.current.focus(settings.current.reduced?null:(event as CustomEvent).detail??null);
      draw.current(0);
    };
    shell?.addEventListener('kilo-stage-focus',focusAction);
    const toolAction=(event:Event)=>{
      const detail=(event as CustomEvent<KingToolEvent>).detail;if(!detail)return;
      tool=detail.progress>=1||settings.current.reduced?null:{kind:detail.kind,progress:detail.progress};
      draw.current(0);
      if(!ready)return;
      const rect=node.getBoundingClientRect(),toScreen=(p:{x:number;y:number})=>({x:rect.left+(p.x+KING_STAGE_CANVAS.offsetX)*rect.width/KING_STAGE_CANVAS.width,y:rect.top+(p.y+KING_STAGE_CANVAS.offsetY)*rect.height/KING_STAGE_CANVAS.height});
      const actual=overhaulKingPose(playback.current.frame,tool,settings.current.reduced);
      detail.hand=toScreen(actual.hand);
      detail.rodTip=toScreen(actual.rodTip);
      const release={kind:'throw' as const,progress:KING_THROW_RELEASE};
      detail.releaseHand=toScreen(overhaulKingPose(playback.current.frame,release,settings.current.reduced).hand);
      detail.handSize=60*rect.width/KING_STAGE_CANVAS.width;
    };
    shell?.addEventListener('kilo-stage-tool',toolAction);
    void preloadOverhaulKing().then(decoded=>{if(disposed)return;images=decoded;ready=true;draw.current(0);loop.current?.refresh();},()=>{});
    return()=>{disposed=true;pixelObserver.disconnect();shell?.removeEventListener('kilo-stage-action',action);shell?.removeEventListener('kilo-stage-focus',focusAction);shell?.removeEventListener('kilo-stage-tool',toolAction);loop.current?.destroy();loop.current=null;draw.current=()=>{};};
  },[]);
  useEffect(()=>{
    settings.current={reduced,paused};
    // Spin/feature reactions come from the actual renderer beat, not mood swaps.
    if(reduced)playback.current.settle();
    else if(pose==='cheer'&&!paused)playback.current.react(`earned:${tick}`);
    draw.current(0);loop.current?.refresh();
  },[pose,tick,reduced,paused]);
  return <canvas ref={canvas} className="kk-rigged-scene-actor" data-character-art="kilo-overhaul-v1-jointed" aria-hidden="true"
    style={{position:'absolute',left:`${(box.left-KING_STAGE_CANVAS.offsetX*box.width/512)/master.width*100}%`,top:`${(box.top-KING_STAGE_CANVAS.offsetY*box.height/768)/master.height*100}%`,
      width:`${box.width*KING_STAGE_CANVAS.width/512/master.width*100}%`,height:`${box.height*KING_STAGE_CANVAS.height/768/master.height*100}%`,maxWidth:'none',pointerEvents:'none',zIndex:2}}/>;
}
