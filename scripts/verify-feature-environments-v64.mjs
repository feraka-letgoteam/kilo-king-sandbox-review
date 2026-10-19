import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {loadProduction} from './kilo-v56-test-loader.mjs';
import {createCanvas,textureImage} from './offline-pixi-painter.mjs';
import {withoutV64BackgroundRouting} from './kilo-v64-source-guards.mjs';
const checkpoint='8d08c2b8ae10855bd9dc1948a4f7b78ae429726f';
const {FEATURE_ENVIRONMENTS,environmentForPresentation,featureArtworkTransform,featureEnvironmentUrl}=loadProduction('src/components/kilo/feature-environments.ts');
const {ATMOSPHERE_URLS,ATMOSPHERE_CYCLE_MS,featureAtmosphere,ambientTrafficAt,canopyPoint}=loadProduction('src/components/kilo/feature-atmosphere.ts');
const {paintFeatureEnvironment,featureAmbientDefinition,FEATURE_AMBIENT_LOOP_MS}=loadProduction('src/components/kilo/feature-environment-painter.ts');
const {integratedSceneUrl}=loadProduction('src/components/kilo/integrated-scene-model.ts');
const old=file=>execFileSync('git',['show',`${checkpoint}:${file}`]);
const play=fs.readFileSync('src/components/kilo/play.tsx','utf8');
assert.equal(withoutV64BackgroundRouting(play),old('src/components/kilo/play.tsx').toString(),'all game/purchase/wallet wiring except exact artwork edits unchanged');
const protectedFiles=execFileSync('git',['ls-tree','-r','--name-only',checkpoint,'src/lib/kilo','src/components/slot-controls'],{encoding:'utf8'}).trim().split('\n');
protectedFiles.push(...['layout.ts','integrated-scene-model.ts','RiggedSceneActor.tsx','stage-character-life.ts','stage-character-mesh.ts','character-motion-loop.ts','reel-feature-effects.ts','vs-encounter.ts','max-boat-performance.ts','max-boat-rig.ts','max-spin-motion.ts','pixiStage.ts','director.ts','reel-feature-director.ts','feature-effects.css','SceneScreens.tsx','feature-takeover.tsx'].filter(f=>fs.existsSync('src/components/kilo/'+f)).map(f=>'src/components/kilo/'+f));
for(const file of protectedFiles)assert(fs.readFileSync(file).equals(old(file)),'unchanged '+file);
const integrated=fs.readFileSync('src/components/kilo/IntegratedScene.tsx','utf8'),before=old('src/components/kilo/IntegratedScene.tsx').toString();
const actorTags=s=>[...s.matchAll(/<RiggedSceneActor[\s\S]*?\/>/g)].map(m=>m[0]);
assert.deepEqual(actorTags(integrated),actorTags(before),'all actor props/placements frozen');
assert(integrated.includes('load={preloadIntegratedScene} reduced={reducedMotion} paused={characterPaused}'),'entry does not pause background ambient clock');

let routes=0;
for(const [feature,scene]of Object.entries({dock:'scatter-3',yacht:'scatter-4',route:'chopper',getaway:'max-win'})){
 const round={version:4,feature,free:[{}],base:{scatters:feature==='dock'?3:feature==='yacht'?4:5},mode:'spin'};
 const initial={round,maxSpinMode:false,active:false,summary:false,busy:false,reviewing:false};
 for(const state of [{active:true,busy:true},{active:true,reviewing:true},{active:true},{summary:true}]){
  assert.equal(environmentForPresentation({...initial,...state}),scene);routes++;
 }
 assert.equal(environmentForPresentation({...initial,maxSpinMode:feature==='getaway'}),feature==='getaway'?'max-win':'base');routes++;
}
assert.equal(environmentForPresentation({round:null,maxSpinMode:false,active:false,summary:false,busy:false,reviewing:false}),'base');

const assets=Object.fromEntries(await Promise.all(Object.entries(ATMOSPHERE_URLS).map(async([key,url])=>[key,await textureImage(url)])));
const frames=[],pixels=canvas=>canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
for(const scene of Object.keys(FEATURE_ENVIRONMENTS))for(const portrait of [false,true]){
 const original='public'+integratedSceneUrl(scene,portrait),url=featureEnvironmentUrl(scene,portrait),file='public'+url;
 assert(fs.readFileSync(original).equals(old(original)),'original image retained unchanged '+original);
 const img=await textureImage(url),def=featureAmbientDefinition(scene,portrait),crop=FEATURE_ENVIRONMENTS[scene][portrait?'portrait':'desktop'];
 assert.equal(img.width,def.width);assert.equal(img.height,def.height);
 assert(crop.x>=0&&crop.y>=0&&crop.x+crop.width<=img.width&&crop.y+crop.height<=img.height);
 const w=portrait?390:720,h=portrait?844:450,canvas=createCanvas(w,h),ctx=canvas.getContext('2d');
 const render=(t,reduced=false)=>{paintFeatureEnvironment(ctx,img,scene,portrait,w,h,t,reduced,assets);return Buffer.from(pixels(canvas));};
 const start=render(0),quarter=render(3000),loop=render(FEATURE_AMBIENT_LOOP_MS);
 assert(start.equals(loop),'pixel-exact 96s environment loop '+scene);
 assert(render(24000).equals(render(24000+FEATURE_AMBIENT_LOOP_MS)),'traffic and birds repeat without a seam');
 assert(!start.equals(quarter),'motion present '+scene);
 assert(render(0,true).equals(render(3000,true)),'reduced motion is still');
 let changed=0,maxAlphaLoss=0;for(let i=0;i<start.length;i+=4){if(start[i]!==quarter[i]||start[i+1]!==quarter[i+1]||start[i+2]!==quarter[i+2])changed++;maxAlphaLoss=Math.max(maxAlphaLoss,255-start[i+3]);}
 assert.equal(maxAlphaLoss,0,'opaque scene covers entire plane');assert(changed<w*h*.55,'motion is locally constrained');
 const transform=featureArtworkTransform(crop,w,h);assert(Number.isFinite(transform.scale)&&transform.scale>0);
 frames.push({scene,portrait,url,crop,viewport:[w,h],changedPixels:changed,fraction:changed/(w*h),seamPixels:0});
}

let trafficSamples=0,palmSamples=0;
for(let ms=0;ms<=ATMOSPHERE_CYCLE_MS;ms+=20){
 const pose=ambientTrafficAt(ms);assert(pose.opacity>=0&&pose.opacity<=.48);assert(Math.abs(pose.pitch)<=.009&&Math.abs(pose.heave)<=.35);
 if(pose.opacity>0)assert(pose.progress>=0&&pose.progress<=1);trafficSamples++;
}
assert.deepEqual(ambientTrafficAt(0),ambientTrafficAt(ATMOSPHERE_CYCLE_MS));
for(const scene of Object.keys(FEATURE_ENVIRONMENTS))for(const portrait of [false,true]){
 const def=featureAtmosphere(scene,portrait);
 if(scene==='max-win'||scene==='chopper')assert.equal(def.traffic,undefined,'quiet modes contain no jetski');
 if(def.traffic)assert(def.traffic.width<=(portrait?13:22),'distant background traffic only');
 for(const patch of def.palms)for(let ms=0;ms<=12000;ms+=100)for(const [u,v]of[[0,0],[1,0],[0,1],[1,1],[.5,.5],[.25,.75]]){
  const x=patch.x+patch.width*u,y=patch.y+patch.height*v,p=canopyPoint(x,y,patch,ms);
  if(u===0||u===1||v===0||v===1){assert(Math.abs(p.x-x)<1e-10);assert(Math.abs(p.y-y)<1e-10);}
  assert(Math.abs(p.x-x)<=1.2&&Math.abs(p.y-y)<=.27);palmSamples++;
 }
}

// Exercise the actual React/Canvas effect, including async scene changes,
// entry pause, reduced motion, tab visibility, offscreen and resize.
let next=0,requests=new Map(),resizeObservers=[],intersectionObservers=[],draws=0;
globalThis.document=new EventTarget();document.hidden=false;
globalThis.window={devicePixelRatio:1};
globalThis.requestAnimationFrame=fn=>{requests.set(++next,fn);return next;};
globalThis.cancelAnimationFrame=id=>requests.delete(id);
globalThis.ResizeObserver=class{constructor(fn){this.fn=fn;resizeObservers.push(this);}observe(){}disconnect(){this.dead=true;}};
globalThis.IntersectionObserver=class{constructor(fn){this.fn=fn;intersectionObservers.push(this);}observe(){}disconnect(){this.dead=true;}};
const hooks=[],pending=[];let cursor=0;
const hookRuntime={useRef(value){const i=cursor++;return hooks[i]??(hooks[i]={current:value});},
 useState(value){const i=cursor++;hooks[i]??={value};return[hooks[i].value,v=>{hooks[i].value=v;}];},
 useEffect(fn,deps){const i=cursor++,prev=hooks[i];if(!prev||deps.some((v,n)=>v!==prev.deps[n]))pending.push(()=>{prev?.cleanup?.();hooks[i]={deps,cleanup:fn()};});}};
const effect={};const compiled=ts.transpileModule(fs.readFileSync('src/components/kilo/FeatureEnvironmentCanvas.tsx','utf8'),{fileName:'component.tsx',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
new Function('require','exports',compiled)(id=>id==='react'?hookRuntime:id==='react/jsx-runtime'?{jsx:(_,props)=>props}:id.includes('feature-atmosphere')?{ATMOSPHERE_URLS}:{paintFeatureEnvironment:()=>draws++},effect);
const node={width:0,height:0,getContext:()=>({}),getBoundingClientRect:()=>({width:390,height:844})};
const image=await textureImage(integratedSceneUrl('scatter-3',true)),loads=[];
const load=(scene,{portrait})=>new Promise(resolve=>loads.push(()=>resolve({image,url:integratedSceneUrl(scene,portrait)})));
const render=props=>{cursor=0;const v=effect.FeatureEnvironmentCanvas({scene:'scatter-3',portrait:true,load,reduced:false,paused:false,...props});v.ref.current=node;pending.splice(0).forEach(f=>f());return v;};
const pump=t=>{const queue=[...requests.values()];requests.clear();queue.forEach(fn=>fn(t));};
render({});assert.equal(requests.size,0);loads.shift()();await Promise.resolve();assert.equal(requests.size,1);
for(let i=0;i<240;i++)pump(100+i*1000/60);
const clock=hooks[1],elapsed=clock.current;assert(elapsed>3900&&elapsed<4000);assert(draws>=65&&draws<=82);
const drawsBefore=draws;render({});assert.equal(loads.length,0,'Turbo/Skip with unchanged environment props cannot restart canvas');assert.equal(clock.current,elapsed);
resizeObservers.at(-1).fn();assert(draws>drawsBefore);assert.equal(clock.current,elapsed,'resize never resets phase');
document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));assert.equal(requests.size,0);
document.hidden=false;document.dispatchEvent(new Event('visibilitychange'));pump(900000);assert.equal(clock.current,elapsed,'resume cannot catch up');
intersectionObservers.at(-1).fn([{isIntersecting:false}]);assert.equal(requests.size,0);intersectionObservers.at(-1).fn([{isIntersecting:true}]);assert.equal(requests.size,1);
render({paused:true});loads.shift()();await Promise.resolve();assert.equal(requests.size,0);assert.equal(clock.current,elapsed);
render({reduced:true});loads.shift()();await Promise.resolve();assert.equal(requests.size,0);
render({scene:'scatter-4',portrait:false});const stale=loads.shift();render({scene:'chopper',portrait:false});stale();await Promise.resolve();assert.equal(requests.size,0,'stale decode cannot restart old scene');loads.shift()();await Promise.resolve();assert.equal(requests.size,1);assert.equal(clock.current,elapsed);
for(const h of hooks)h?.cleanup?.();assert.equal(requests.size,0);assert(resizeObservers.every(o=>o.dead)&&intersectionObservers.every(o=>o.dead));
const report={checkpoint,method:'Original asset retention; whole-file protected-system guards; executable scene routing; native Canvas pixel loops with shipped alpha assets; actual React effect lifecycle harness. Not live browser/GPU.',routes,protectedFiles,frames,trafficSamples,palmSamples,lifecycle:{frames:draws,resize:true,hidden:true,offscreen:true,paused:true,reduced:true,staleDecode:true,cleanup:true},limitations:['User-authorized clean plates are generated edits, not original layered illustration source; scene identity and framing retained.','Palm motion is bounded local artwork deformation, not individually rigged leaves.','Original Yacht sunset and Chopper dusk colors retained.']};
fs.mkdirSync('art/kilo-v64',{recursive:true});fs.writeFileSync('art/kilo-v64/verification.json',JSON.stringify(report,null,2)+'\n');
console.log(`PASS ${routes} routing states, ${protectedFiles.length} frozen files, eight source/loop pairs and Canvas lifecycle.`);
