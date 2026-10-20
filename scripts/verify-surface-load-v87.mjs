/** Cold-decode regression: actual AuthoredArt hook / Canvas paint, virtual
 * visibility clock. Not browser CSS, GPU or a screenshot of the React app. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {loadImage,createCanvas} from '@napi-rs/canvas';
import {createOfflineRuntime} from './offline-runtime-v79.mjs';
const refs=[],effects=[],react={useRef(value){const r={current:value};refs.push(r);return r;},useEffect(fn){effects.push(fn);}};
const r=createOfflineRuntime({moduleOverrides:{react}}),art=r.load('src/components/kilo/AuthoredArt.tsx');
const clip=r.load('src/components/kilo/authored-clips.ts').AUTHORED_CLIPS.completion;
const image=await loadImage('public'+clip.url);image.decode=()=>Promise.resolve();
const native=createCanvas(144,104),ctx=native.getContext('2d'),painted=[];
const paint=new Proxy(ctx,{get(target,key){if(key==='drawImage')return(...args)=>{painted.push(r.clock);return target.drawImage(...args);};const value=target[key];return typeof value==='function'?value.bind(target):value;},set(target,key,value){target[key]=value;return true;}});
globalThis.Image=function(){return image;};
Object.defineProperty(image,'src',{set(){r.window.setTimeout(()=>image.onload?.(),1200);},configurable:true});
const node={style:{},get width(){return native.width;},set width(v){native.width=v;},get height(){return native.height;},set height(v){native.height=v;},getContext:()=>paint,getBoundingClientRect:()=>({width:144,height:104})};
art.AuthoredArt({clipKey:'completion',fallback:'/kilo-v79/surfaces/completion.webp',duration:640});
refs[0].current=node;refs[1].current={style:{}};const cleanups=effects.map(fn=>fn());
for(let i=0;i<64;i++)await r.tick(1000/30);
assert(painted.length>=18,'A late image still plays the whole authored clip');
assert(painted[0]>=1200&&painted[0]<1300,'Starts after decode, rather than expiring in the network wait');
assert.equal(node.style.opacity,'0');assert.equal(refs[1].current.style.opacity,'1');
cleanups.forEach(fn=>fn?.());delete globalThis.Image;
fs.mkdirSync('art/kilo-v87/verification',{recursive:true});
fs.writeFileSync('art/kilo-v87/verification/surface-cold-load.json',JSON.stringify({decodeDelay:1200,clipDuration:640,paintedFrames:painted.length,firstFrame:painted[0],lastFrame:painted.at(-1),restoredStatic:true,method:'Actual AuthoredArt effect and native Canvas drawing, simulated 1200ms decode. Not browser layout.'},null,2)+'\n');
console.log(`PASS cold-decode: ${painted.length} frames after1200ms delay, clean source handoff.`);
