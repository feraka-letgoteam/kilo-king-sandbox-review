/** Regression and production-controller checks. No browser/GPU claims. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import {createOfflineRuntime,findAll,walk,textureImage} from './offline-runtime-v79.mjs';
import {sourceFingerprint} from './v79-source-fingerprint.mjs';
const checkpoint='d0a34dd',read=f=>fs.readFileSync(f,'utf8'),old=f=>execFileSync('/usr/bin/git',['show',checkpoint+':'+f],{encoding:'utf8',maxBuffer:16*1024*1024});
const output=process.env.KILO_VERIFICATION_OUTPUT??'art/kilo-v79';fs.mkdirSync(output,{recursive:true});
const initialFingerprint=sourceFingerprint();
const changed=execFileSync('/usr/bin/git',['diff',checkpoint,'--name-only','--','src','public'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
assert.equal(execFileSync('/usr/bin/git',['diff',checkpoint,'--name-only','--','src/lib'],{encoding:'utf8'}).trim(),'','All math, RNG, wallet and settlement source is byte-identical');
const protectedFiles=['src/components/kilo/director.ts','src/components/kilo/reel-feature-director.ts','src/components/kilo/feature-director.ts','src/components/kilo/layout.ts','src/components/kilo/feature-motion.ts','src/components/kilo/control-model.ts','src/components/slot-controls/SlotControls.tsx','src/components/slot-controls/layout.ts','src/components/slot-controls/tokens.ts'];
for(const file of protectedFiles)assert.equal(read(file),old(file),`Protected exact source: ${file}`);
function declaration(source,name){const tree=ts.createSourceFile('x.ts',source,ts.ScriptTarget.Latest,true);let result;const scan=n=>{if(ts.isFunctionDeclaration(n)&&n.name?.getText(tree)===name)result=n.getText(tree);ts.forEachChild(n,scan);};scan(tree);assert(result,name);return result;}
for(const name of ['edgeFor','frameBorders','fitReels','geomFor'])assert.equal(declaration(read('src/components/kilo/pixiStage.ts'),name),declaration(old('src/components/kilo/pixiStage.ts'),name),`Reel geometry unchanged: ${name}`);
const current=createOfflineRuntime(),baseline=createOfflineRuntime({checkpoint});
assert.deepEqual(current.load('src/components/kilo/god-card-motion.ts').GOD_CARD_CLOCK,baseline.load('src/components/kilo/god-card-motion.ts').GOD_CARD_CLOCK,'God progression clocks');
assert.equal(current.load('src/components/kilo/vs-merge-motion.ts').VS_MERGE_MS,baseline.load('src/components/kilo/vs-merge-motion.ts').VS_MERGE_MS,'VS merge clock');
const {runReelFeature}=current.load('src/lib/kilo/reel-feature-math.ts'),baseMath=baseline.load('src/lib/kilo/reel-feature-math.ts');
const art=current.load('src/components/kilo/fish-art.ts');assert.deepEqual(art.FISH_LADDER,baseline.load('src/components/kilo/fish-art.ts').FISH_LADDER);for(const value of [.5,1,2,5])assert.equal(art.fishTier(value).asset,'package-small');

const seeded=seed=>()=>{seed|=0;seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};
const {fitGameLayout}=current.load('src/components/kilo/layout.ts'),fit=new Function(ts.transpile(['edgeFor','frameBorders','fitReels'].map(name=>declaration(read('src/components/kilo/pixiStage.ts'),name)).join('\n'),{target:ts.ScriptTarget.ES2022})+';return fitReels;')();
const viewports=[[1440,900],[390,844],[360,800],[844,390]],geometries=viewports.map(([w,h])=>{const p=w<900?12:24,l=fitGameLayout(w-p*2,h-p*2);return fit(Math.round(l.reelWidth),Math.round(l.reelHeight));});
const legacyEvents=[];for(const seed of[132,2,1])for(const spin of baseMath.runReelFeature('yacht',1000,seeded(seed),18000000).free)if((spin.mechanic.reel.conversions.length||spin.got)&&legacyEvents.length<4)legacyEvents.push(spin.mechanic);
const round=runReelFeature('yacht',1000,seeded(1569831),18000000),fixtures={};
for(const[index,spin]of round.free.entries()){const r=spin.mechanic.reel;if(r.conversions.length){const largest=Math.max(0,...r.groupsAfter.map(g=>g.width));fixtures[`group${largest}`]??={index,event:spin.mechanic};}}
const naturalFive=fixtures.group5?.event;assert(naturalFive,'recorded natural five-reel group exists');
async function preload(runtime){const {VS_GROUP_ART_URLS}=runtime.load('src/components/kilo/vs-group-art.ts');const {GOD_CARD_ASSETS}=runtime.load('src/components/kilo/god-card-performance.ts');const urls=[...VS_GROUP_ART_URLS,...Object.values(GOD_CARD_ASSETS),'/kilo-features-v54/fisherman-reel-in.webp','/kilo-v58/vs/portraits.webp','/kilo-v59/vs/winner-reels.webp','/kilo-v61/vs/king-action.png'];for(const url of urls)await runtime.pixi.Assets.load(url);const scene=await runtime.load('src/components/kilo/pixiStage.ts').mountScene(runtime.host(1000,600));await runtime.tick(0);scene.destroy();return[...runtime.textures.keys()];}
const assets=await preload(current);await preload(baseline);
async function execute(runtime,event,{speed='normal',reduced=false,viewport=0,change='none',target=''}={}){
 // Global document belongs to the active runtime because production transfer
 // elements are genuine callbacks of this instrumented source execution.
 const active=runtime===baseline?createOfflineRuntime({checkpoint}):createOfflineRuntime();
 active.window.innerWidth=viewports[viewport][0];active.window.innerHeight=viewports[viewport][1];
 for(const[url,texture]of runtime.textures)active.textures.set(url,texture);
 const {createReelFeatureEffects}=active.load('src/components/kilo/reel-feature-effects.ts');
 const world=new active.pixi.Container(),host=active.host(1000,600);let g=geometries[viewport],ctl,live=true,elapsed=0,paid=0,phase='start',changed=false,hidden=[],observations=0,pulses=0;const cues=[],credits=[],banks=[],conceal=[],phases=[];
 const inspect=()=>{observations++;if(host.dataset.maxPhase)phase=host.dataset.maxPhase;
  else if(findAll(world,'vs-group-merge').length)phase='merge';
  walk(world,n=>{for(const p of[n.position,n.pivot,n.scale])assert(Number.isFinite(p.x)&&Number.isFinite(p.y),'finite transform');if(n instanceof active.pixi.Text)assert(!String(n.text).includes('NaN'),'finite text');});
  for(const group of findAll(world,'vs-group-art')){assert(group.vsGroup.reels.every(r=>hidden.includes(r)),'all group symbol strips concealed');assert(!group.children.some(n=>n.label==='vs-group-multiplier-plaque'),'no detached multiplier plaque');const composition=group.children.find(n=>n.label===`vs-${group.vsGroup.side}-${group.vsGroup.width}-composition`);assert(composition?.texture.source.url===active.load('src/components/kilo/vs-group-art.ts').vsGroupArtUrl(group.vsGroup),'dedicated composition loaded, not stretched fallback');for(const n of group.children.filter(n=>n.label==='vs-group-multiplier')){assert(n.style.fontFamily&&Number(n.style.fontWeight)>=600,'Readable bold multiplier');assert(n.width<=group.vsGroup.width*g.cell+(group.vsGroup.width-1)*g.gap+1,'product fits group');if(n.scale.x>1.01)pulses++;}}
  for(const el of active.document.body.children){if(el.className!=='kk-feature-transfer'||!el.style.left)continue;assert(Number.isFinite(parseFloat(el.style.left)));assert(Number.isFinite(parseFloat(el.style.top)));assert(Number(el.style.opacity??1)>=0&&Number(el.style.opacity??1)<=1);}
  if(!changed&&change!=='none'&&(phase===target||target==='any')){changed=true;if(change==='resize'){g=geometries[(viewport+1)%4];host.dispatchEvent(new Event('kilo-relayout'));}else{live=false;ctl.cancel();}}
 };
 const a={host,world,geom:()=>g,cell:()=>new active.pixi.Container(),stake:()=>1000,pace:()=>({speed,reduced}),live:()=>live,show(){},collect:async()=>{throw Error('Pure VS/God cannot collect');},highlight:async()=>{throw Error('Pure VS/God owns its win sequence');},readout(){},screen:(x,y)=>({x,y}),landing:()=>({x:g.dw/2,y:g.dh+35}),focus(){},conceal:indices=>{hidden=[...indices];conceal.push({ms:elapsed,reels:[...indices]});},cue:name=>{phase=({vsReady:'duel',vsLock:'lock',vsConnect:'connection',vsAmount:'amount',vsTransfer:'transfer'})[name]??phase;cues.push({name,ms:elapsed});},bankCue:(value,capped)=>{assert(live);assert.equal(active.document.body.children.length,0,'traveller removed before bank');banks.push({value,capped,ms:elapsed});},hold:async ms=>{elapsed+=ms;inspect();},tween:async(ms,paint)=>{const prior=elapsed;for(const t of[0,.07,.16,.25,.4,.55,.7,.85,.95,1]){elapsed=prior+ms*t;paint(t);inspect();}elapsed=prior+ms;}};
 ctl=createReelFeatureEffects(a);ctl.set(event,'before');const frozen=JSON.stringify(event);await ctl.step(event,{award:value=>{assert(live);paid+=value;credits.push({value,ms:elapsed});},state(){}});assert.equal(JSON.stringify(event),frozen,'record never mutated');assert.equal(active.document.body.children.length,0);
 if(live){assert.equal(paid,event.credited,'exact recorded credit');assert.equal(credits.length,banks.length,'one meter update per bank');assert.deepEqual(credits.map(c=>c.value),banks.map(c=>c.value));}
 if(change!=='none')assert(changed,`Expected ${change} at ${target}`);
 ctl.set(event,'after');host.dispatchEvent(new Event('kilo-relayout'));ctl.destroy();assert.equal(world.children.length,0);
 return{elapsed,paid,cues,credits,banks,observations,pulses,changed,concealCalls:conceal.length,phases};
}
const legacyComparisons=[];for(const[index,event]of legacyEvents.entries())for(const speed of['normal','turbo','super'])for(const reduced of[false,true]){const options={speed,reduced};const a=await execute(baseline,event,options),b=await execute(current,event,options);assert.deepEqual(b.cues,a.cues,'legacy cue timestamps identical');assert.deepEqual(b.credits,a.credits,'legacy amount/credit timing identical');assert.equal(b.elapsed,a.elapsed,'legacy duration identical');legacyComparisons.push({index,speed,reduced,credits:b.credits,equalToCheckpoint:checkpoint});}
const cases=[],interruptions=[];for(const[name,{event}]of Object.entries(fixtures))for(const speed of['normal','turbo','super'])for(const reduced of[false,true])for(let viewport=0;viewport<viewports.length;viewport++){const result=await execute(current,event,{speed,reduced,viewport});cases.push({name,speed,reduced,viewport:viewports[viewport],...result});}
for(const change of['resize','skip'])for(const target of['duel','merge','connection','amount','transfer'])for(const viewport of[0,1]){const result=await execute(current,naturalFive,{viewport,change,target});interruptions.push({change,target,viewport:viewports[viewport],...result});}
for(const[type,draw]of[['full',.01],['early',.8],['late',.06]]){const event=runReelFeature('getaway',1000,()=>draw,25000000).free[0].mechanic;for(const speed of['normal','turbo','super'])for(const reduced of[false,true])for(const viewport of[0,1]){cases.push({name:'god-'+type,speed,reduced,viewport:viewports[viewport],...await execute(current,event,{speed,reduced,viewport})});}for(const target of['anticipate','advance','settle','result',...(type==='full'?[]:type==='early'?['stall']:['overshoot','stall'])])for(const change of['resize','skip'])interruptions.push({name:'god-'+type,target,change,...await execute(current,event,{target,change})});}
const outcomeTimingComparisons=[];
for(const [name,event] of [['vs-five',naturalFive],...['full','early','late'].map((name,i)=>['god-'+name,runReelFeature('getaway',1000,()=>[.01,.8,.06][i],25000000).free[0].mechanic])])
 for(const speed of ['normal','turbo','super'])for(const reduced of [false,true]){
  const a=await execute(baseline,event,{speed,reduced}),b=await execute(current,event,{speed,reduced});
  assert.deepEqual(b.cues,a.cues,`${name}: cues/timing`);assert.deepEqual(b.credits,a.credits,`${name}: credits/timing`);assert.deepEqual(b.banks,a.banks,`${name}: bank/timing`);assert.equal(b.elapsed,a.elapsed,`${name}: total duration`);
  outcomeTimingComparisons.push({name,speed,reduced,elapsed:b.elapsed,credits:b.credits});
 }
// Execute the actual collection method on the existing acceptance fixture and a
// genuinely capped fixture. Presentation values/phase times remain identical.
const collectionFixtures=current.load('src/lib/kilo/fixtures.json');
async function collectTrace(checkpointValue,id,index,speed,reduced){
 const runtime=createOfflineRuntime({checkpoint:checkpointValue}),record=collectionFixtures[id].script,spin=record.free[index],layout=geometries[1],host=runtime.host(layout.dw,layout.dh),scene=await runtime.load('src/components/kilo/pixiStage.ts').mountScene(host);
 scene.setStake(record.stake);scene.setPace(speed!=='normal',reduced,speed);scene.show(spin.grid);
 const cues=[],phases=[];let previous='';host.addEventListener('kilo-collection',e=>cues.push({ms:runtime.clock,detail:e.detail}));
 await runtime.drive(scene.collect(spin),{step:16,onFrame(){const phase=host.dataset.collectStep??'none';if(phase!==previous){phases.push({ms:runtime.clock,phase});previous=phase;}}});
 const elapsed=runtime.clock;scene.destroy();return{elapsed,cues,phases};
}
const collectionTimingComparisons=[];
for(const [id,index] of [['tool-bazooka',15],['capped-ante',25]])for(const speed of ['normal','turbo','super'])for(const reduced of [false,true]){
 const a=await collectTrace(checkpoint,id,index,speed,reduced),b=await collectTrace(null,id,index,speed,reduced);
 assert.deepEqual(b,a,`${id}: collection amounts, sequence and phase timing unchanged`);
 const bank=b.cues.filter(c=>c.detail?.phase==='bank');assert.equal(bank.length,1);assert.equal(bank[0].detail.completed,collectionFixtures[id].script.free[index].got);
 collectionTimingComparisons.push({id,index,speed,reduced,...b});
}
assert.equal(sourceFingerprint(),initialFingerprint,'Production source/assets changed during verification; rerun after freeze.');
const report={checkpoint,sourceFingerprint:initialFingerprint,method:'Source guards, actual production controller + instrumented Pixi, source geometry and native font metrics. Not browser/GPU.',changedExistingSource:changed,protectedFiles,viewports,assets,legacyComparisons,outcomeTimingComparisons,collectionTimingComparisons,cases,interruptions};fs.writeFileSync(`${output}/verification.json`,JSON.stringify(report,null,2)+'\n');console.log(`PASS ${legacyComparisons.length} exact checkpoint timing comparisons, ${cases.length} production cases, ${interruptions.length} Skip/resize cases.`);
