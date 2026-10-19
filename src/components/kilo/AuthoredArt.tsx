import { useEffect, useRef } from "react";
import { AUTHORED_CLIPS } from "./authored-clips";
import { authoredFrameAt, authoredRegistration } from "./authored-animation";
import { surfaceArtAt } from './surface-motion';

/** Plays once in the existing art rectangle. No input, game timer or callback. */
export function AuthoredArt({ clipKey, fallback, className = "", reduced = false,
  duration = 850, active = true, tick = 0,
}: { clipKey: string; fallback: string; className?: string; reduced?: boolean;
  duration?: number; active?: boolean; tick?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const still = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const clip = AUTHORED_CLIPS[clipKey], node = canvas.current, original = still.current;
    if (!clip || !node || !original || reduced || !active) return;
    let disposed = false, raf = 0, last = 0, elapsed = 0, ready = false;
    const image = new Image();
    const context = node.getContext("2d");
    const paint = () => {
      if (!ready || !context || disposed) return;
      const rect = node.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(rect.width*dpr)), h = Math.max(1, Math.round(rect.height*dpr));
      if (node.width!==w || node.height!==h) { node.width=w;node.height=h; }
      context.clearRect(0,0,w,h);
      const f = clip.frames[authoredFrameAt(clip,elapsed/duration)];
      if (!f) return;
      const at = authoredRegistration(clip,w,h);
      const pose = surfaceArtAt(clipKey, elapsed/duration);
      context.save();context.translate(w/2,h*.70+pose.lift*h);context.rotate(pose.turn);
      context.scale(pose.x,pose.y);context.translate(-w/2,-h*.70);
      context.drawImage(image,f.x,f.y,f.w,f.h,at.x,at.y,f.w*at.scale,f.h*at.scale);
      context.restore();
      // A short handover hides unavoidable source/pose boundaries, without
      // blending two animation drawings for the body of the action.
      const alpha = Math.min(1, elapsed/16, Math.max(0,(duration-elapsed)/16));
      node.style.opacity=String(alpha);original.style.opacity=String(1-alpha);
    };
    const frame = (now:number) => {
      raf=0;if(disposed||document.hidden)return;
      elapsed+=last?Math.min(64,now-last):0;last=now;
      paint();if(elapsed<duration)raf=requestAnimationFrame(frame);
      else { node.style.opacity="0";original.style.opacity="1"; }
    };
    const stop=()=>{cancelAnimationFrame(raf);raf=0;last=0;};
    const resume=()=>{if(ready&&!disposed&&!document.hidden&&elapsed<duration&&!raf)raf=requestAnimationFrame(frame);};
    const visibility=()=>document.hidden?stop():resume();
    // Decorative action starts when the drawing is decoded. Counting network
    // time as performance time silently skipped the whole clip on a cold load.
    // This clock has no award / entry callbacks and never delays the director.
    image.onload=()=>void image.decode().then(()=>{if(disposed)return;elapsed=0;last=0;ready=true;resume();},()=>{});
    image.src=clip.url;
    const resize=new ResizeObserver(paint);resize.observe(node);
    document.addEventListener("visibilitychange",visibility);
    return()=>{disposed=true;stop();resize.disconnect();image.onload=null;document.removeEventListener("visibilitychange",visibility);node.style.opacity="0";original.style.opacity="1";};
  },[clipKey,reduced,active,duration,tick]);
  return <span className={className} aria-hidden="true" style={{display:"block"}}>
    <img ref={still} src={fallback} alt="" draggable={false} style={{width:"100%",height:"100%",objectFit:"contain",display:"block"}} />
    <canvas ref={canvas} style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0,pointerEvents:"none"}} />
  </span>;
}
