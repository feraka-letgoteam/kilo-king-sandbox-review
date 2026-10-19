import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {loadProduction} from './kilo-v56-test-loader.mjs';

const {stageKingFrameAt,stageKingSlice,createStageKingPlayback,STAGE_KING}=loadProduction('src/components/kilo/stage-character-life.ts');
const {createCharacterMotionLoop}=loadProduction('src/components/kilo/character-motion-loop.ts');
const {fitGameLayout}=loadProduction('src/components/kilo/layout.ts');
const {sceneActorBox}=loadProduction('src/components/kilo/RiggedSceneActor.tsx');
const {integratedSceneCamera}=loadProduction('src/components/kilo/integrated-scene-model.ts');
let samples=0,maximumLift=0;
for(let t=0;t<=60000;t+=20){
 const frame=stageKingFrameAt(t,t%6000-2000);
 let previous=-Infinity;
 for(let y=0;y<=768;y+=4){
  const p=stageKingSlice(y,frame);
  assert(Object.values(p).every(Number.isFinite));
  assert(p.y>previous,'adjacent strips never fold over');previous=p.y;
  assert(Math.abs(p.x)<.7&&Math.abs(p.y-y)<3.5,'motion stays within the artwork envelope');
  if(y>=500)assert.deepEqual(p,{x:0,y,scale:1},'legs and feet remain exactly planted');
  maximumLift=Math.max(maximumLift,Math.abs(p.y-y));
 }
 samples++;
}
assert.equal(stageKingFrameAt(3300).blink,'half');
assert.equal(stageKingFrameAt(3350).blink,'closed');
assert.equal(stageKingFrameAt(3420).blink,'half');
assert.equal(stageKingFrameAt(3460).blink,'open');
assert.equal(stageKingFrameAt(3350,300).blink,'brow');
assert.equal(stageKingFrameAt(9000,1100).nod,0,'earned reaction stops');
const playback=createStageKingPlayback();
for(let n=0;n<90;n++)playback.advance(1000/30);
const prior=structuredClone(playback.frame),clock=playback.elapsed;
for(let n=0;n<100;n++)assert.deepEqual(playback.advance(33,false,true),prior);
assert.equal(playback.elapsed,clock,'paused animation cannot catch up');
playback.react('earned:1');playback.advance(300);const reaction=structuredClone(playback.frame);
playback.react('earned:1');assert.deepEqual(playback.advance(0),reaction,'same event does not restart action');
const reduced=playback.advance(0,true);assert.equal(reduced.breath,0);assert.equal(reduced.nod,0);assert.equal(reduced.blink,'open');
const reducedClock=playback.elapsed;for(let i=0;i<100;i++)playback.advance(80,true);assert.equal(playback.elapsed,reducedClock);

// Exercise the real scheduling lifecycle, including permanent decorative inert.
let rafId=0,requests=new Map(),observers=[],mutations=[];
globalThis.document=new EventTarget();document.hidden=false;
globalThis.requestAnimationFrame=fn=>{const id=++rafId;requests.set(id,fn);return id;};
globalThis.cancelAnimationFrame=id=>requests.delete(id);
globalThis.IntersectionObserver=class{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){this.dead=true;}};
globalThis.MutationObserver=class{constructor(fn){this.fn=fn;mutations.push(this);}observe(){}disconnect(){this.dead=true;}};
const pump=now=>{const queue=[...requests.values()];requests.clear();for(const fn of queue)fn(now);};
let enabled=true,inert=false,dtTotal=0,paints=0;
const loop=createCharacterMotionLoop({closest:()=>({hasAttribute:()=>true}),parentElement:null},dt=>{dtTotal+=dt;paints++;},()=>enabled,{hasAttribute:()=>inert});
for(let n=0;n<=120;n++)pump(100+n*1000/60);
assert(paints>=58&&paints<=60);assert(Math.abs(dtTotal-2000)<40);
document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));assert.equal(requests.size,0);
const frozen=dtTotal;document.hidden=false;document.dispatchEvent(new Event('visibilitychange'));pump(900000);assert.equal(dtTotal,frozen);
inert=true;mutations[0].fn([]);assert.equal(requests.size,0);inert=false;mutations[0].fn([]);assert.equal(requests.size,1);
observers[0].fn([{isIntersecting:false}]);assert.equal(requests.size,0);observers[0].fn([{isIntersecting:true}]);assert.equal(requests.size,1);
enabled=false;loop.refresh();assert.equal(requests.size,0);loop.destroy();assert(observers[0].dead&&mutations[0].dead);

// Actual React effects, not a second implementation of the component.
const hooks=[],pending=[];let cursor=0,drawCount=0,menuLocked=false;
const hookRuntime={
 useRef(initial){const i=cursor++;return hooks[i]??(hooks[i]={current:initial});},
 useEffect(fn,deps){const i=cursor++,old=hooks[i];if(!old||deps.some((v,n)=>v!==old.deps[n]))pending.push(()=>{old?.cleanup?.();hooks[i]={deps,cleanup:fn()};});},
};
const shell={hasAttribute:()=>menuLocked,parentElement:null},decoration={hasAttribute:()=>true,parentElement:shell};
const context={setTransform(){},clearRect(){},beginPath(){},ellipse(){},fill(){},drawImage(){drawCount++;}};
const canvas={parentElement:decoration,closest:s=>s==='.kk-shell'?shell:decoration,getContext:()=>context};
document.createElement=()=>({getContext:()=>context});
globalThis.Image=class{set src(value){this.url=value;this.complete=true;this.naturalWidth=1024;queueMicrotask(()=>this.onload?.());}};
const component={};
const compiled=ts.transpileModule(fs.readFileSync('src/components/kilo/RiggedSceneActor.tsx','utf8'),{fileName:'RiggedSceneActor.tsx',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
new Function('require','exports',compiled)(id=>id==='react'?hookRuntime:id==='react/jsx-runtime'?{jsx:(_,props)=>props,jsxs:(_,props)=>props}:loadProduction('src/components/kilo/'+id.replace('./','')),component);
const render=props=>{cursor=0;const node=component.RiggedSceneActor({master:{width:1080,height:2400},portrait:true,...props});node.ref.current=canvas;pending.splice(0).forEach(fn=>fn());return node;};
render({});await Promise.resolve();const mounted=drawCount;
for(let i=0;i<60;i++)pump(2000000+i*1000/60);
assert(drawCount>mounted+2000,'production component continues rendering at 30 fps');
const live=hooks.find(h=>h?.current?.advance)?.current;assert(live);
const beforeResize=live.elapsed;
render({portrait:false,master:{width:1920,height:1080}});assert.equal(live.elapsed,beforeResize);
render({pose:'cast',tick:1});assert.equal(live.elapsed,beforeResize);assert.equal(live.frame.nod,0,'ordinary spins never trigger a body reaction');
render({pose:'cast',tick:1,paused:true});assert.equal(requests.size,0);
render({pose:'cast',tick:1,reduced:true});assert.equal(requests.size,0);assert.equal(live.frame.breath,0);
render({pose:'idle',tick:2});assert.equal(requests.size,1);
for(const hook of hooks)hook?.cleanup?.();assert.equal(requests.size,0);

const viewports=[];
for(const [W,H]of[[360,800],[390,844],[844,390],[1440,900]]){
 const pad=W<900?12:24,l=fitGameLayout(W-pad*2,H-pad*2),camera=integratedSceneCamera(l,{stageSize:{width:W-pad*2,height:H-pad*2}}),b=sceneActorBox(camera.master,camera.portrait);
 const actor={x:camera.left+b.left*camera.scale,y:camera.top+b.top*camera.scale,width:b.width*camera.scale,height:b.height*camera.scale};
 if(camera.portrait){assert.equal(l.dock,160);assert(actor.y>l.header+l.reelHeight+160,'portrait actor stays below the controls');}
 viewports.push({viewport:[W,H],mode:l.mode,actor,controlAllocation:l.dock});
}
const target=STAGE_KING.blink.imageTarget;
assert(target.x>=0&&target.x+target.width<=1024&&target.y>=0&&target.y+target.height<=1536);
for(const key of ['half','closed'])assert.equal(STAGE_KING.blink.frames[key].width,target.width);
fs.writeFileSync('art/kilo-v58/character-verification.json',JSON.stringify({method:'Production motion sampling and React/Canvas/RAF effect harness. Source-derived viewport registrations; not live browser screenshots.',samples,maximumLift,viewports,scheduling:{fps:30,hidden:true,offscreen:true,paused:true,reduced:true,menu:true,cleanup:true},registeredBlink:true},null,2)+'\n');
console.log(`PASS ${samples} coherent body samples, registered blink/reaction, real Canvas effects, lifecycle and ${viewports.length} viewport registrations.`);
