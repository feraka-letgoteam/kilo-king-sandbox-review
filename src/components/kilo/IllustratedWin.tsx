import {useEffect,useRef} from 'react';

const ROOT='/kilo-overhaul-v1/';
const TITLE_KEYS=['nice-catch','big-haul','king-size'];
const FILES={coins:'effects/coin/atlas.webp',cash:'effects/cash/atlas.webp',
  ...Object.fromEntries(TITLE_KEYS.map(key=>[key,`titles/${key}/composite.webp`]))};
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const ease=(n:number)=>1-(1-clamp(n))**3;

/** An earned-award illustration only. It neither updates a balance nor waits
 * on the director. Starting another spin clears it immediately. */
export function IllustratedWin({stake,reduced}:{stake:number;reduced:boolean}){
  const canvas=useRef<HTMLCanvasElement>(null),settings=useRef({stake,reduced});
  settings.current={stake,reduced};
  useEffect(()=>{
    const node=canvas.current,ctx=node?.getContext('2d');if(!node||!ctx)return;
    const shell=node.closest('.kk-shell');let disposed=false,ready=false,raf=0,last=0,elapsed=0,painted=-Infinity;
    let award=0,tier=0,active=false;
    const images:Record<string,HTMLImageElement>={};
    const clear=()=>{active=false;cancelAnimationFrame(raf);raf=0;node.hidden=true;ctx.clearRect(0,0,node.width,node.height);};
    const resize=()=>{
      const r=node.getBoundingClientRect(),dpr=Math.min(1.5,devicePixelRatio||1,
        Math.sqrt(500000/Math.max(1,r.width*r.height)));
      node.width=Math.max(1,Math.round(r.width*dpr));node.height=Math.max(1,Math.round(r.height*dpr));
    };
    const paint=()=>{
      const w=node.width,h=node.height,p=clamp(elapsed/1200),still=settings.current.reduced;
      ctx.clearRect(0,0,w,h);if(!active)return;
      const hit=still?1:elapsed<150?.64+.44*ease(elapsed/150):1+.08*(1-ease((elapsed-150)/180));
      const fade=still?1:1-ease((elapsed-900)/300);
      ctx.globalAlpha=fade;
      // Short rays/coins stay within the reel window; no looping screen cloud.
      if(!still){
        for(let i=0;i<14;i++){
          const delay=i%4*.035,t=clamp((p-delay)/.82);if(t<=0||t>=1)continue;
          const side=i%2?1:-1,a=(.35+(i%7)*.27)*side;
          const x=w*.5+Math.sin(a)*w*.44*ease(t),y=h*.66-h*.55*Math.sin(Math.PI*t)+i%3*h*.025;
          const size=Math.min(w*.053,h*.105)*(i%3===0?1.15:.85),cash=i%4===0;
          const source=images[cash?'cash':'coins'],frames=cash?12:16,index=Math.floor(t*frames*1.6)%frames;
          ctx.save();ctx.globalAlpha=fade*Math.min(1,(1-t)*4);ctx.translate(x,y);ctx.rotate(side*t*1.8);
          ctx.drawImage(source,(index%4)*256,Math.floor(index/4)*256,256,256,-size/2,-size/2,size,size);ctx.restore();
        }
      }
      ctx.save();ctx.globalAlpha=fade;ctx.translate(w/2,h*.42);ctx.scale(hit,hit);
      const title=images[TITLE_KEYS[tier]!],tw=Math.min(w*.90,h*1.72),th=tw/3;
      ctx.drawImage(title,-tw/2,-th/2,tw,th);
      ctx.restore();
      const value=still?award:Math.round(award*ease(elapsed/720));
      const size=Math.min(w*.094,h*.18),text=value.toLocaleString('en-US');
      ctx.globalAlpha=fade;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font=`900 ${size}px "Source Sans 3"`;ctx.lineJoin='round';ctx.lineWidth=Math.max(2,size*.10);
      ctx.strokeStyle='#061821';ctx.strokeText(text,w/2,h*.67);ctx.fillStyle='#fff4cf';ctx.fillText(text,w/2,h*.67);
      ctx.globalAlpha=1;
    };
    const frame=(now:number)=>{
      raf=0;if(disposed||!active)return;
      if(!document.hidden){elapsed+=last?Math.min(80,now-last):0;if(now-painted>=1000/30-1){paint();painted=now;}}
      last=document.hidden?0:now;
      if(elapsed>=(settings.current.reduced?700:1200)){clear();return;}
      raf=requestAnimationFrame(frame);
    };
    const earned=(event:Event)=>{
      // The Getaway owns its own single result and amount on the boat card.
      if(shell?.getAttribute('data-feature-kind')==='getaway')return;
      const value=(event as CustomEvent<{visibleAward:number}>).detail?.visibleAward;
      if(!ready||active||!Number.isFinite(value)||value<settings.current.stake*25)return;
      award=value;tier=value>=settings.current.stake*250?2:value>=settings.current.stake*100?1:0;
      active=true;elapsed=0;last=0;painted=-Infinity;node.hidden=false;resize();paint();raf=requestAnimationFrame(frame);
    };
    const action=(event:Event)=>{if((event as CustomEvent).detail?.kind==='spin')clear();};
    void Promise.all(Object.entries(FILES).map(([key,file])=>new Promise<void>((resolve,reject)=>{
      const image=new Image();image.decoding='async';images[key]=image;
      image.onload=()=>void image.decode().catch(()=>{}).then(resolve);image.onerror=()=>reject(new Error('Win artwork unavailable'));image.src=ROOT+file;
    }))).then(()=>{if(!disposed)ready=true;},()=>{});
    shell?.addEventListener('kilo-earned-win',earned);shell?.addEventListener('kilo-stage-action',action);
    const observer=new ResizeObserver(()=>{if(active){resize();paint();}});observer.observe(node);
    return()=>{disposed=true;clear();observer.disconnect();shell?.removeEventListener('kilo-earned-win',earned);shell?.removeEventListener('kilo-stage-action',action);};
  },[]);
  return <canvas ref={canvas} hidden aria-hidden="true" data-win-illustration="kilo-overhaul-v1"
    style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:5}}/>;
}
