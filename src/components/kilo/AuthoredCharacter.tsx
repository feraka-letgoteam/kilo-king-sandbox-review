import {useEffect,useRef,type RefObject} from "react";
import {AUTHORED_CLIPS} from "./authored-clips";
import {authoredFrameAt,authoredRegistration} from "./authored-animation";
import {integratedCharacterRegistration,type IntegratedCharacterLayer,type IntegratedCharacterPose,type IntegratedMaster} from "./integrated-scene-model";

/** Authored whole-body actions share the existing actor's camera/floor anchor.
 * The old cutout rig stays available for idle, reduced motion and load failure. */
export function AuthoredCharacter({definition,master,portrait,pose,tick,reduced,paused,fallback}: {
 definition:IntegratedCharacterLayer;master:IntegratedMaster;portrait:boolean;pose:IntegratedCharacterPose;tick:number;reduced:boolean;paused:boolean;fallback:RefObject<SVGSVGElement|null>;
}) {
 const canvas=useRef<HTMLCanvasElement>(null);
 const playback=useRef({key:'',elapsed:0});
 useEffect(()=>{
  const key=`${pose}:${tick}`;
  if(playback.current.key!==key)playback.current={key,elapsed:0};
  const clip=AUTHORED_CLIPS[portrait?"actor-portrait":"actor"],node=canvas.current,original=fallback.current;
  // Routine casts stay on the subtle existing elbow rig. No whole-body atlas
  // replacement on ordinary spins or losses.
  if(!clip||!node||!original||reduced||paused||pose!=='cheer')return;
  const ctx=node.getContext('2d');if(!ctx)return;
  const sequence=[0,3,4,4,3,0];
  const action={...clip,sequence,durations:undefined},duration=680;
  const blink=original.closest('.kk-integrated-plane')?.querySelector<SVGSVGElement>('.kk-integrated-blink');
  const started=performance.now(),resumeAt=playback.current.elapsed;
  let elapsed=resumeAt,last=0,raf=0,ready=false,disposed=false;
  const image=new Image();
  const paint=()=>{
   if(!ready||disposed)return;
   const rect=node.getBoundingClientRect(),quality=Math.min(1.5,window.devicePixelRatio||1);
   const w=Math.max(1,Math.round(rect.width*quality)),h=Math.max(1,Math.round(rect.height*quality));
   if(node.width!==w||node.height!==h){node.width=w;node.height=h;}
   ctx.clearRect(0,0,w,h);ctx.save();ctx.scale(w/master.width,h/master.height);
   const place=integratedCharacterRegistration(definition);ctx.translate(place.left*master.width,place.top*master.height);ctx.scale(place.scale,place.scale);
   const f=clip.frames[authoredFrameAt(action,elapsed/duration)],at=authoredRegistration(clip,master.width,master.height);
   if(f)ctx.drawImage(image,f.x,f.y,f.w,f.h,at.x,at.y,f.w*at.scale,f.h*at.scale);
   ctx.restore();
   const alpha=Math.min(1,elapsed/65,Math.max(0,(duration-elapsed)/65));node.style.opacity=String(alpha);original.style.opacity=String(1-alpha);
   if(blink)blink.style.visibility=alpha>0?'hidden':'';
  };
  const stop=()=>{cancelAnimationFrame(raf);raf=0;last=0;};
  const frame=(now:number)=>{raf=0;if(disposed||document.hidden)return;elapsed+=last?Math.min(64,now-last):0;playback.current.elapsed=elapsed;last=now;paint();if(elapsed<duration)raf=requestAnimationFrame(frame);else{node.style.opacity='0';original.style.opacity='1';if(blink)blink.style.visibility='';}};
  const resume=()=>{if(ready&&!disposed&&!document.hidden&&!raf&&elapsed<duration)raf=requestAnimationFrame(frame);};
  const visibility=()=>document.hidden?stop():resume();
  image.onload=()=>void image.decode().then(()=>{if(disposed)return;elapsed=resumeAt+performance.now()-started;playback.current.elapsed=elapsed;ready=true;resume();},()=>{});image.src=clip.url;
  const resize=new ResizeObserver(paint);resize.observe(node);document.addEventListener('visibilitychange',visibility);
  return()=>{disposed=true;stop();resize.disconnect();image.onload=null;document.removeEventListener('visibilitychange',visibility);node.style.opacity='0';original.style.opacity='1';if(blink)blink.style.visibility='';};
 },[definition,master,portrait,pose,tick,reduced,paused,fallback]);
 return <canvas ref={canvas} aria-hidden="true" style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:0,pointerEvents:'none',zIndex:2}}/>;
}
