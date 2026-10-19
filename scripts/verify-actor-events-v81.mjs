/** Execute RiggedSceneActor effects and its real DOM event handlers.
 * Recorded finite canvas commands and DOM/image doubles, not pixel/GPU proof. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {imageMetadata} from './offline-image-metadata-v77.mjs';
import {createOfflineRuntime,createCanvas,Element} from './offline-runtime-v79.mjs';

const reports=[];
for(const portrait of [false,true]){
 const refs=[],effects=[];const react={useRef:v=>{const ref={current:v};refs.push(ref);return ref;},useEffect:fn=>effects.push(fn)};
 const calls=[];let paintCalls=0;const context=new Proxy({},{get:(_,key)=>(...args)=>{if(key==='drawImage')paintCalls++;for(const arg of args)if(typeof arg==='number')assert(Number.isFinite(arg));calls.push([key,args.map(v=>typeof v==='object'?v?.src??'image':v)]);if(calls.length>256)calls.shift();},set:()=>true});const drawn={getContext:()=>context,toBuffer:()=>Buffer.from(JSON.stringify(calls))};
 const runtime=createOfflineRuntime({moduleOverrides:{react}}),shell=new Element(),mounted=runtime.load('src/components/kilo/RiggedSceneActor.tsx');
 const master={width:portrait?768:1920,height:portrait?1708:1080},box=mounted.sceneActorBox(master,portrait),scale=portrait?390/768:1440/1920;
 const K=runtime.load('src/components/kilo/stage-character-arm.ts'),node={width:1008,height:1296,getContext:()=>drawn.getContext('2d'),closest:()=>shell,parentElement:null,getBoundingClientRect:()=>({left:(box.left-K.KING_STAGE_CANVAS.offsetX*box.width/512)*scale,top:(box.top-K.KING_STAGE_CANVAS.offsetY*box.height/768)*scale,width:box.width*K.KING_STAGE_CANVAS.width/512*scale,height:box.height*K.KING_STAGE_CANVAS.height/768*scale})};
 let loaded=0;
 globalThis.Image=class{set src(url){this.url=url;const meta=imageMetadata(url).source;this.complete=true;this.naturalWidth=meta.width;this.naturalHeight=meta.height;loaded++;queueMicrotask(()=>this.onload?.());}get src(){return this.url;}};
 const create=runtime.document.createElement;runtime.document.createElement=tag=>tag==='canvas'?{width:1024,height:1536,getContext:()=>context}:create(tag);
 mounted.RiggedSceneActor({master,portrait});refs[0].current=node;const cleanup=effects.map(fn=>fn());
 for(let i=0;i<25;i++){await new Promise(resolve=>setImmediate(resolve));await runtime.tick(16);globalThis.gc?.();}
 const detail={kind:'throw',progress:0};shell.dispatchEvent(new CustomEvent('kilo-stage-tool',{detail}));assert(detail.hand&&detail.releaseHand&&detail.rodTip,'Actual mounted actor returns attached effect anchors');
 const start=drawn.toBuffer('image/png'),hand0={...detail.hand};
 shell.dispatchEvent(new CustomEvent('kilo-stage-tool',{detail:{kind:'throw',progress:.3}}));const released=drawn.toBuffer('image/png');assert(!start.equals(released),'Actual actor canvas visibly changes at release');
 const rest={kind:'throw',progress:1};shell.dispatchEvent(new CustomEvent('kilo-stage-tool',{detail:rest}));assert(Math.hypot(rest.hand.x-hand0.x,rest.hand.y-hand0.y)<.01,'Tool completes back at same hand anchor without teleporting');
 shell.dispatchEvent(new CustomEvent('kilo-stage-action',{detail:{kind:'max-stop'}}));await runtime.tick(80);const playback=refs[1].current;playback.react('bank','win');assert.equal(playback.advance(0).reaction,'max-stop');
 const before=drawn.toBuffer('image/png');for(let i=0;i<6;i++){await runtime.tick(80);globalThis.gc?.();await new Promise(resolve=>setImmediate(resolve));}assert(!before.equals(drawn.toBuffer('image/png')),'Mounted max celebration paints movement');
 shell.dispatchEvent(new CustomEvent('kilo-stage-action',{detail:{kind:'settle'}}));
 reports.push({portrait,imageDecodeStubs:loaded,canvasCommands:paintCalls,leftHandStart:hand0,release:detail.releaseHand,handSize:detail.handSize,actualCanvasCommandChanges:true,actualEventAnchors:true});
 cleanup.forEach(fn=>fn?.());delete globalThis.Image;
}
fs.writeFileSync('art/kilo-v81/actor-event-verification.json',JSON.stringify({pass:true,method:'Real RiggedSceneActor React effect body, real event handlers and recorded finite Canvas commands; image, DOM and effect doubles; pixels separately proven by the production offline painter; not browser/WebGL.',reports},null,2)+'\n');console.log(reports);
