import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {loadProduction,cropCounts} from './kilo-v56-test-loader.mjs';
import {Container} from './reel-renderer-mocks-v52.mjs';

const {characterIdleAt,characterLifeAt,characterBlinkAt,createCharacterPlayback}=loadProduction('src/components/kilo/character-life.ts');
const {CHARACTER_RIGS,rigTransforms}=loadProduction('src/components/kilo/character-rig-model.ts');
const {createCharacterRig}=loadProduction('src/components/kilo/character-rig.ts');
const {createCharacterMotionLoop}=loadProduction('src/components/kilo/character-motion-loop.ts');
const {createReelFeatureEffects}=loadProduction('src/components/kilo/reel-feature-effects.ts');
const {fitGameLayout}=loadProduction('src/components/kilo/layout.ts');
const {sceneActorBox}=loadProduction('src/components/kilo/RiggedSceneActor.tsx');
const {integratedSceneCamera}=loadProduction('src/components/kilo/integrated-scene-model.ts');
let samples=0;const ranges={};
for(const actor of ['king','vice']){
 const def=CHARACTER_RIGS[actor],rest=rigTransforms(def,{});let min=Infinity,max=-Infinity;
 for(let t=0;t<=60000;t+=20){
  const frame=characterIdleAt(actor,t),j=rigTransforms(def,frame.pose);
  assert.deepEqual(j.hips,rest.hips,'feet and their contact registration remain fixed');
  for(const p of Object.values(j))assert(Object.values(p).every(Number.isFinite));
  assert(Math.abs(j.head.x-rest.head.x)<6,'head remains inside its reserved envelope');
  assert(Math.abs(j.head.y-rest.head.y)<3,'no whole-body vertical float');
  assert.deepEqual(j.head,j.headWin,'alternate face inherits the exact neck joint');
  min=Math.min(min,j.torso.y);max=Math.max(max,j.torso.y);samples++;
 }
 assert(max-min>1.7&&max-min<2,'visible bounded breathing');ranges[actor]={torsoRise:max-min};
 for(const action of ['rest','glance','challenge','victory','defeat']){
  assert.deepEqual(characterLifeAt(actor,7000,action,1).pose,characterIdleAt(actor,7000).pose,'each action rejoins the same idle phase');
 }
}
assert.equal(characterBlinkAt(3279),'open');assert.equal(characterBlinkAt(3300),'half');
assert.equal(characterBlinkAt(3350),'closed');assert.equal(characterBlinkAt(3420),'half');assert.equal(characterBlinkAt(3460),'open');
assert.equal(characterLifeAt('king',3350,'victory',.5).blink,'open','no blink patch on the alternate face');
assert.notDeepEqual(characterIdleAt('king',4000,0),characterIdleAt('king',4000,3),'reels do not breathe in unison');

const playback=createCharacterPlayback('king');playback.setAction('rest','idle:0');
for(let i=0;i<90;i++)playback.advance(1000/30);
const prior=structuredClone(playback.frame),time=playback.elapsed;
for(let i=0;i<100;i++)assert.deepEqual(playback.advance(30,false,true),prior,'pause freezes the current drawing');
assert.equal(playback.elapsed,time);
playback.setAction('glance','cast:1');assert.deepEqual(playback.advance(0).pose,prior.pose,'a reaction starts from the current pose');
for(let i=0;i<15;i++)playback.advance(1000/30);
const midway=structuredClone(playback.frame);playback.setAction('rest','idle:2');
assert.deepEqual(playback.advance(0).pose,midway.pose,'interruption blends without a snap');
playback.advance(30,true);assert.deepEqual(playback.frame,{pose:{},blink:'open',expressive:false});
const reducedTime=playback.elapsed;for(let i=0;i<100;i++)playback.advance(80,true);assert.equal(playback.elapsed,reducedTime);
assert.deepEqual(playback.advance(0).pose,{},'resume begins at neutral before blending back');

// Controlled RAF/visibility environment exercises actual production scheduling.
let rafId=0,requests=new Map(),observers=[],mutations=[];
globalThis.document=new EventTarget();document.hidden=false;
globalThis.requestAnimationFrame=fn=>{const id=++rafId;requests.set(id,fn);return id;};
globalThis.cancelAnimationFrame=id=>requests.delete(id);
globalThis.IntersectionObserver=class{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){this.dead=true;}};
globalThis.MutationObserver=class{constructor(fn){this.fn=fn;mutations.push(this);}observe(){}disconnect(){this.dead=true;}};
const pump=now=>{const queue=[...requests.values()];requests.clear();for(const fn of queue)fn(now);};
let enabled=true,inert=false,dtTotal=0,paints=0;
const decorative={hasAttribute:()=>true};
const boundary={hasAttribute:()=>inert};
const target={closest:()=>decorative,parentElement:null};
const loop=createCharacterMotionLoop(target,dt=>{dtTotal+=dt;paints++;},()=>enabled,boundary);
for(let n=0;n<=120;n++)pump(100+n*1000/60);
assert(paints>=58&&paints<=60,'bounded 30 fps paint budget');assert(Math.abs(dtTotal-2000)<40);
assert(paints>0,'a permanently inert decorative wrapper does not freeze the actor');
document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));assert.equal(requests.size,0);
const frozen=dtTotal;document.hidden=false;document.dispatchEvent(new Event('visibilitychange'));pump(900000);assert.equal(dtTotal,frozen,'return from hidden does not catch up elapsed wall time');
inert=true;mutations[0].fn([]);assert.equal(requests.size,0,'menu stops ambient character work');
inert=false;mutations[0].fn([]);assert.equal(requests.size,1);
observers[0].fn([{isIntersecting:false}]);assert.equal(requests.size,0);
observers[0].fn([{isIntersecting:true}]);assert.equal(requests.size,1);
enabled=false;loop.refresh();assert.equal(requests.size,0);loop.destroy();
assert(observers[0].dead&&mutations[0].dead,'observers are disconnected on unmount');

// Actual persistent VS rigs, including dynamic preference changes and relayout.
const rounds=JSON.parse(fs.readFileSync('art/kilo-features-v54/replay-examples.json'));
const round=rounds.yacht,e=round.free.find(s=>s.mechanic.reel.after.length>0).mechanic;
const host=new EventTarget();let reduced=false,g={gx:5,gy:5,cell:100,gap:3};
host.closest=()=>null;host.parentElement=null;
const world=new Container(),ctl=createReelFeatureEffects({host,world,geom:()=>g,cell:()=>new Container(),stake:()=>1000,pace:()=>({speed:'normal',reduced}),live:()=>true,
 tween:async(_,fn)=>fn(1),hold:async()=>{},collect:async()=>{},highlight:async()=>{},show(){},readout(){},screen:(x,y)=>({x,y}),landing:()=>null,bankCue(){}});
ctl.set(e,'after');
const rigs=()=>{const out=[];const walk=n=>{if(n.label?.startsWith('rig-'))out.push(n);n.children.forEach(walk);};walk(world);return out;};
const torso=rig=>rig.children.find(n=>n.label==='joint-torso');
assert(rigs().length>0);const before=torso(rigs()[0]).position.y;
for(let i=0;i<65;i++)pump(1000000+i*1000/60);
assert.notEqual(torso(rigs()[0]).position.y,before,'settled VS actors actually animate');
const heldPose={...torso(rigs()[0]).position};g={gx:2,gy:2,cell:58,gap:2};host.dispatchEvent(new Event('kilo-relayout'));
assert.equal(torso(rigs()[0]).position.y,heldPose.y,'resize preserves the animation phase');
reduced=true;ctl.refreshMotion();assert.equal(requests.size,0);assert.equal(torso(rigs()[0]).position.y,331);
reduced=false;ctl.refreshMotion();assert.equal(requests.size,1);
const immutable=JSON.stringify(e);ctl.cancel();assert.equal(JSON.stringify(e),immutable,'Skip does not mutate the held outcome');
ctl.set(null);assert.equal(requests.size,0,'no loop remains after the feature clears');ctl.destroy();assert.equal(world.children.length,0);

const king=createCharacterRig('king');king.idle(3350);assert.equal(king.root.children.find(n=>n.label==='joint-head').texture.source.url,'/kilo-v57/characters/king-blink.webp');
king.idle(3350,0,true);assert.equal(king.root.children.find(n=>n.label==='joint-head').texture.source.url,CHARACTER_RIGS.king.atlas);king.dispose();
assert.equal(cropCounts.get('/kilo-v57/characters/king-blink.webp'),2,'blink crops are cached, never recreated per frame');
assert.equal(requests.size,0);

// Run the real React component's effects with a small hook/Canvas harness.
// This checks the actual wiring that pure joint tests cannot: permanent
// decorative inert, image readiness, prop updates, resize and cleanup.
const hooks=[],pending=[];let cursor=0,drawCount=0,menuLocked=false;
const hookRuntime={
 useRef(initial){const i=cursor++;return hooks[i]??(hooks[i]={current:initial});},
 useEffect(fn,deps){const i=cursor++,previous=hooks[i];if(!previous||deps.some((v,n)=>v!==previous.deps[n]))pending.push(()=>{previous?.cleanup?.();hooks[i]={deps,cleanup:fn()};});},
};
const shell={hasAttribute:()=>menuLocked,parentElement:null};
const decoration={hasAttribute:()=>true,parentElement:shell};
const context={setTransform(){},clearRect(){},beginPath(){},ellipse(){},fill(){},save(){},restore(){},translate(){},rotate(){},drawImage(){drawCount++;}};
const canvas={parentElement:decoration,closest:s=>s==='.kk-shell'?shell:decoration,getContext:()=>context};
globalThis.Image=class{set src(value){this.url=value;this.complete=true;queueMicrotask(()=>this.onload?.());}};
const componentModule={};
const compiled=ts.transpileModule(fs.readFileSync('src/components/kilo/RiggedSceneActor.tsx','utf8'),{fileName:'RiggedSceneActor.tsx',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const hookRequire=id=>id==='react'?hookRuntime:id==='react/jsx-runtime'?{jsx:(_,props)=>props,jsxs:(_,props)=>props}:loadProduction('src/components/kilo/'+id.replace('./',''));
new Function('require','exports',compiled)(hookRequire,componentModule);
const render=props=>{cursor=0;const node=componentModule.RiggedSceneActor({master:{width:1080,height:2400},portrait:true,...props});node.ref.current=canvas;pending.splice(0).forEach(fn=>fn());return node;};
render({});await Promise.resolve();const mounted=drawCount;
for(let i=0;i<60;i++)pump(2000000+i*1000/60);
assert(drawCount>mounted+100,'the real component keeps painting beyond initial mount');
const canvasClock=hooks.find(h=>h?.current?.advance)?.current;assert(canvasClock);
const beforeResize=canvasClock.elapsed;
render({portrait:false,master:{width:1920,height:1080}});assert.equal(canvasClock.elapsed,beforeResize,'viewport prop change keeps the character clock');
render({pose:'cast',tick:1});assert.equal(canvasClock.elapsed,beforeResize,'spin reactions do not reset idle time');
render({pose:'cast',tick:1,paused:true});assert.equal(requests.size,0);
render({pose:'cast',tick:1,reduced:true});assert.equal(requests.size,0);assert.deepEqual(canvasClock.frame.pose,{});
render({pose:'idle',tick:2});assert.equal(requests.size,1);
for(const hook of hooks)hook?.cleanup?.();assert.equal(requests.size,0,'component unmount removes its loop');

// Source-derived registration: animation never moves the actor canvas or controls.
const viewports=[];
for(const [W,H]of[[360,800],[390,844],[844,390],[1440,900]]){
 const pad=W<900?12:24,l=fitGameLayout(W-pad*2,H-pad*2),camera=integratedSceneCamera(l,{stageSize:{width:W-pad*2,height:H-pad*2}}),b=sceneActorBox(camera.master,camera.portrait);
 const actor={x:camera.left+b.left*camera.scale,y:camera.top+b.top*camera.scale,width:b.width*camera.scale,height:b.height*camera.scale};
 if(camera.portrait){assert.equal(l.dock,160);assert(actor.y>l.header+l.reelHeight+160,'phone actor lives below the complete control allocation');}
 viewports.push({viewport:[W,H],mode:l.mode,actor,controlAllocation:l.dock});
}
const files=['src/lib/kilo/engine.ts','src/lib/kilo/bank.ts','src/lib/kilo/feature-math.ts','src/lib/kilo/reel-feature-math.ts','src/components/kilo/director.ts','src/components/kilo/reel-feature-director.ts','src/components/kilo/layout.ts','src/components/kilo/brand-layout.ts','src/components/kilo/feature-motion.ts','src/components/slot-controls/controls.css','src/components/slot-controls/SlotControls.tsx','src/components/slot-controls/layout.ts','src/components/slot-controls/tokens.ts','src/components/kilo/modular-controls.css','src/components/kilo/character-performance.ts'];
for(const file of files)assert.equal(fs.readFileSync(file,'utf8'),execFileSync('git',['show',`b59b650:${file}`],{encoding:'utf8'}),file);
fs.mkdirSync('art/kilo-v57',{recursive:true});
const built=process.argv.includes('--dist');
if(built)for(const asset of ['kilo-v57/characters/king-blink.webp','kilo-v57/characters/king-blink.json'])assert.deepEqual(fs.readFileSync('public/'+asset),fs.readFileSync('dist/'+asset),'deployed face bytes match source');
fs.writeFileSync('art/kilo-v57/animation-verification.json',JSON.stringify({method:'Production motion sampling, instrumented Pixi/RAF lifecycle and actual React component effect harness. Source-derived viewport registration; not live browser/GPU evidence.',samples,ranges,canvasComponentEffects:true,built,scheduling:{fps:30,pause:true,hidden:true,offscreen:true,inert:true,reduced:true,unmount:true},viewports,protectedFiles:files},null,2)+'\n');
console.log(`PASS ${samples} idle poses, blink registration, reaction blending, visibility/pause/resize lifecycle, retained VS rigs and ${viewports.length} viewport registrations.`);
