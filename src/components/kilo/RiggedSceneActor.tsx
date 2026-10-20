import { useEffect, useRef } from 'react';
import { createCharacterMotionLoop } from './character-motion-loop';
import { STAGE_KING, paintStageKing, kingToolFrame, createStageKingPlayback, type StageKingFrame, type StageReaction } from './stage-character-life';
import { KING_ARM_ASSETS, KING_STAGE_CANVAS, KING_THROW_RELEASE, kingLeftArmPose, kingRightRodPose, type KingArmImages, type KingToolAction, type KingToolEvent } from './stage-character-arm';
import type { IntegratedCharacterPose, IntegratedMaster } from './integrated-scene-model';

/** Same world camera and planted foot position, with the new inward-facing
 * drawing registered by its body centre rather than the protruding rod. */
export function sceneActorBox(master:IntegratedMaster,portrait:boolean) {
  const height=master.height*(portrait?.31:.667),width=height*2/3;
  return {left:master.width*(portrait?.82:.89)-width*STAGE_KING.anchors.bodyCenter.x/512,
    top:master.height*(portrait?.87:.817)-height*STAGE_KING.anchors.footBaseline/768,width,height};
}

export function RiggedSceneActor({master,portrait,pose='idle',tick=0,reduced=false,paused=false}:{
  master:IntegratedMaster;portrait:boolean;pose?:IntegratedCharacterPose;tick?:number;reduced?:boolean;paused?:boolean;
}) {
  const canvas=useRef<HTMLCanvasElement>(null),playback=useRef(createStageKingPlayback());
  const settings=useRef({reduced,paused});
  const loop=useRef<ReturnType<typeof createCharacterMotionLoop>|null>(null);
  const draw=useRef<(delta:number)=>void>(()=>{});
  const box=sceneActorBox(master,portrait);
  useEffect(()=>{
    const node=canvas.current,ctx=node?.getContext('2d');if(!node||!ctx)return;
    let disposed=false,ready=false,lastFace='',tool:KingToolAction|null=null;
    const body=new Image(),eyes=new Image(),reaction=new Image(),surface=document.createElement('canvas');
    surface.width=1024;surface.height=1536;const paint=surface.getContext('2d');
    if(!paint)return;
    const arms=Object.fromEntries(Object.entries(KING_ARM_ASSETS).map(([key])=>[key,key==='body'?body:new Image()])) as Record<keyof typeof KING_ARM_ASSETS,HTMLImageElement>;
    node.width=KING_STAGE_CANVAS.width*1.5;node.height=KING_STAGE_CANVAS.height*1.5;
    function prepareFace(face:StageKingFrame['blink']){
      if(lastFace===face)return;
      lastFace=face;paint!.clearRect(0,0,1024,1536);paint!.drawImage(body,0,0);
      const facial=face==='brow'?reaction:eyes;
      if(!arms.heads&&face!=='open'&&facial.complete&&facial.naturalWidth){
        const f=face==='brow'?STAGE_KING.reaction.frame:STAGE_KING.blink.frames[face],to=STAGE_KING.blink.imageTarget;
        paint!.clearRect(to.x,to.y,to.width,to.height);
        paint!.drawImage(facial,f.x,f.y,f.width,f.height,to.x,to.y,to.width,to.height);
      }
    }
    function render(frame:StageKingFrame){
      if(!ready||disposed)return;
      prepareFace(frame.blink);
      paintStageKing(ctx!,surface,frame,settings.current.reduced,arms,tool);
    }
    draw.current=dt=>render(playback.current.advance(dt,settings.current.reduced,settings.current.paused));
    loop.current=createCharacterMotionLoop(node,dt=>draw.current(dt),()=>ready&&!settings.current.reduced&&!settings.current.paused,node.closest('.kk-shell'));
    const shell=node.closest('.kk-shell');let actionId=0;
    const action=(event:Event)=>{
      const kind=(event as CustomEvent<{kind:StageReaction|'settle'}>).detail?.kind;
      if(kind==='settle'||settings.current.reduced||settings.current.paused){playback.current.settle();tool=null;}
      else if(['spin','collect','collect-bank','entry','retrigger','vs','vs-win','vs-loss','max','max-stop','max-loss','win'].includes(kind))playback.current.react(`${kind}:${++actionId}`,kind as StageReaction);
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
      const frame=kingToolFrame(playback.current.frame,tool,settings.current.reduced);
      detail.hand=toScreen(kingLeftArmPose(frame,tool,settings.current.reduced).hand);
      detail.rodTip=toScreen(kingRightRodPose(frame,tool,settings.current.reduced).tip);
      const release={kind:'throw' as const,progress:KING_THROW_RELEASE};
      detail.releaseHand=toScreen(kingLeftArmPose(kingToolFrame(playback.current.frame,release),release).hand);
      detail.handSize=60*rect.width/KING_STAGE_CANVAS.width;
    };
    shell?.addEventListener('kilo-stage-tool',toolAction);
    const loaded=()=>{if(disposed)return;ready=Object.values(arms).every(img=>img.complete&&img.naturalWidth>0);lastFace='';draw.current(0);loop.current?.refresh();};
    for(const[key,img]of Object.entries(arms)){img.onload=loaded;img.src=KING_ARM_ASSETS[key as keyof typeof KING_ARM_ASSETS];}
    eyes.onload=loaded;reaction.onload=loaded;eyes.src=STAGE_KING.blink.image;reaction.src=STAGE_KING.reaction.image;
    return()=>{disposed=true;shell?.removeEventListener('kilo-stage-action',action);shell?.removeEventListener('kilo-stage-focus',focusAction);shell?.removeEventListener('kilo-stage-tool',toolAction);for(const img of Object.values(arms))img.onload=null;eyes.onload=null;reaction.onload=null;loop.current?.destroy();loop.current=null;draw.current=()=>{};};
  },[]);
  useEffect(()=>{
    settings.current={reduced,paused};
    // Spin/feature reactions come from the actual renderer beat, not mood swaps.
    if(reduced)playback.current.settle();
    else if(pose==='cheer'&&!paused)playback.current.react(`earned:${tick}`);
    draw.current(0);loop.current?.refresh();
  },[pose,tick,reduced,paused]);
  return <canvas ref={canvas} className="kk-rigged-scene-actor" data-character-art="v85-action-connected-performance" aria-hidden="true"
    style={{position:'absolute',left:`${(box.left-KING_STAGE_CANVAS.offsetX*box.width/512)/master.width*100}%`,top:`${(box.top-KING_STAGE_CANVAS.offsetY*box.height/768)/master.height*100}%`,
      width:`${box.width*KING_STAGE_CANVAS.width/512/master.width*100}%`,height:`${box.height*KING_STAGE_CANVAS.height/768/master.height*100}%`,maxWidth:'none',pointerEvents:'none',zIndex:2}}/>;
}
