import {useEffect,useRef} from "react";
import type {SceneId} from "./scene-system";
import {sceneMotionDefinition} from "./scene-motion-v49";
import rotorDefinition from "../../../public/kilo-animation-v49/scenes/chopper-rotor-metadata.json";

/** Source-registered local motion, shared by stage and cinematic takeovers.
 * Only audited water and already-painted light interiors are touched. */
export function SceneMotionCanvas({scene,portrait,image,reduced=false,paused=false,cover=false}: {
 scene:SceneId;portrait:boolean;image:HTMLImageElement;reduced?:boolean;paused?:boolean;cover?:boolean;
}) {
 const ref=useRef<HTMLCanvasElement>(null),clock=useRef(0);
 useEffect(()=>{
  const canvas=ref.current,definition=sceneMotionDefinition(scene,portrait);
  if(!canvas||!definition)return;
  const ctx=canvas.getContext("2d");if(!ctx)return;
  let raf=0,last=0,painted=-Infinity,disposed=false,inView=true;
  const rotor=scene==='chopper'?rotorDefinition.orientations[portrait?'portrait':'desktop']:null;
  let rotorImages:{cleanup:HTMLImageElement;atlas:HTMLImageElement;hub:HTMLImageElement}|null=null;
  const paint=()=>{
   const rect=canvas.getBoundingClientRect(),quality=Math.min(1.5,window.devicePixelRatio||1,Math.sqrt(650000/Math.max(1,rect.width*rect.height)));
   const w=Math.max(1,Math.round(rect.width*quality)),h=Math.max(1,Math.round(rect.height*quality));
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
   ctx.clearRect(0,0,w,h);if(reduced)return;
   const scale=cover?Math.max(w/definition.width,h/definition.height):w/definition.width;
   const sy=cover?scale:h/definition.height,dx=cover?(w-definition.width*scale)/2:0,dy=cover?(h-definition.height*scale)/2:0;
   ctx.save();ctx.translate(dx,dy);ctx.scale(scale,sy);
   const path=(polygon:readonly (readonly [number,number])[])=>{ctx.beginPath();polygon.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();};
   for(const region of definition.water){
    ctx.save();path(region.polygon);ctx.clip();
    const xs=region.polygon.map(p=>p[0]),ys=region.polygon.map(p=>p[1]),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
    const strip=Math.max(2,Math.round(2/scale));
    for(let y=top;y<bottom;y+=strip){
     const height=Math.min(strip,bottom-y),depth=(y-top)/Math.max(1,bottom-top);
     const offset=Math.sin(clock.current*.001*region.speed+y*.045)*region.amplitude*(.25+.75*depth);
     ctx.drawImage(image,left,y,right-left,height,left+offset,y,right-left,height);
    }
    ctx.restore();
   }
   for(const light of definition.lights){
    const phase=(clock.current+light.phase)/light.period*Math.PI*2;
    const level=.5+.5*Math.sin(phase);
    ctx.globalAlpha=light.opacity*(.3+.7*level*level);ctx.fillStyle=light.color;path(light.polygon);ctx.fill();
   }
   if(rotor&&rotorImages){
    ctx.globalAlpha=1;ctx.drawImage(rotorImages.cleanup,0,0,definition.width,definition.height);
    const f=rotorDefinition.frames[Math.floor(clock.current%rotorDefinition.cycleMs/rotorDefinition.sourceFrameMs)];
    ctx.save();ctx.translate(rotor.hubPx[0],rotor.hubPx[1]);ctx.rotate(rotor.rotationDegrees*Math.PI/180);ctx.scale(rotor.scale[0],rotor.scale[1]);
    ctx.drawImage(rotorImages.atlas,f.rect[0],f.rect[1],f.rect[2],f.rect[3],-f.pivot[0],-f.pivot[1],f.rect[2],f.rect[3]);ctx.restore();
    ctx.drawImage(rotorImages.hub,0,0,definition.width,definition.height);
   }
   ctx.restore();
  };
  if(rotor&&!reduced){
   const load=(url:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const drawing=new Image();drawing.onload=()=>void drawing.decode().then(()=>resolve(drawing),reject);drawing.onerror=reject;drawing.src=url;});
   void Promise.all([load(rotor.cleanup),load(rotorDefinition.atlas),load(rotor.hubCap)]).then(([cleanup,atlas,hub])=>{if(!disposed){rotorImages={cleanup,atlas,hub};paint();}},()=>{/* Keep original integrated rotor if any layer is unavailable. */});
  }
  const canRun=()=>!disposed&&!reduced&&!paused&&!document.hidden&&inView;
  const stop=()=>{cancelAnimationFrame(raf);raf=0;last=0;};
  const frame=(now:number)=>{raf=0;if(!canRun())return;clock.current+=last?Math.min(80,now-last):0;last=now;if(now-painted>=50){paint();painted=now;}raf=requestAnimationFrame(frame);};
  const resume=()=>{if(canRun()&&!raf)raf=requestAnimationFrame(frame);};
  const visibility=()=>document.hidden?stop():resume();
  const resize=new ResizeObserver(paint);resize.observe(canvas);
  const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(([entry])=>{inView=entry?.isIntersecting??false;if(inView)resume();else stop();});observer?.observe(canvas);
  document.addEventListener('visibilitychange',visibility);paint();resume();
  return()=>{disposed=true;stop();resize.disconnect();observer?.disconnect();document.removeEventListener('visibilitychange',visibility);};
 },[scene,portrait,image,reduced,paused,cover]);
 return <canvas ref={ref} aria-hidden="true" className="kk-registered-scene-motion" style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:1}}/>;
}
