import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createOfflineRuntime,findAll,walk} from './offline-runtime-v79.mjs';
const seedRuntime=createOfflineRuntime(),engine=seedRuntime.load('src/lib/kilo/engine.ts'),{vsSeeded}=seedRuntime.load('src/lib/kilo/vs-progression.ts');
const fixtures={};
for(let seed=1;seed<100000&&Object.keys(fixtures).length<2;seed++){
 const round=engine.generateSplashCandidate(1000,'spin',vsSeeded(seed));
 if(round.base.catchRun)fixtures[round.base.catchRun.caught?'caught':'miss']??={seed,round};
}
assert.equal(Object.keys(fixtures).length,2);
const results=[];
for(const speed of ['normal','turbo','super'])for(const reduced of [false,true])for(const outcome of ['caught','miss'])for(const size of [[1440,900],[390,844]]){
 const r=createOfflineRuntime(),{round,seed}=fixtures[outcome],before=JSON.stringify(round),fit=r.load('src/components/kilo/layout.ts').fitGameLayout;
 const l=fit(size[0]-(size[0]<900?24:48),size[1]-48),host=r.host(Math.round(l.reelWidth),Math.round(l.reelHeight));
 const scene=await r.load('src/components/kilo/pixiStage.ts').mountScene(host),stage=r.apps[0].stage;
 let final,collections=0;const phases=new Set(),held=new Set();
 const original=scene.collect;scene.collect=async spin=>{collections++;assert.equal(spin.wilds,round.base.collect.collectors);await original(spin);};
 await r.drive(r.load('src/components/kilo/director.ts').presentScript(scene,round,{turbo:speed!=='normal',speed,reduced,skipped:()=>false,onHud:h=>final=h}),{maxMs:60000,step:16,onFrame(){
  if(host.dataset.catchPhase)phases.add(host.dataset.catchPhase);
  walk(stage,n=>{for(const p of[n.position,n.pivot,n.scale])assert(Number.isFinite(p.x)&&Number.isFinite(p.y));
   if(n.label?.startsWith('catch-held-'))held.add(n.label);
  });
 }});
 assert.equal(final.total,round.payout);assert.equal(collections,round.base.collect?.got?1:0);
 assert.equal(JSON.stringify(round),before);assert.equal(findAll(stage,'catch-respin').length,0);
 if(!reduced){assert.equal(held.size,round.base.catchRun.held.length,JSON.stringify({speed,reduced,outcome,size,phases:[...phases]}));assert.deepEqual([...phases],['cast','respin','settle']);}
 assert.equal(r.document.body.children.filter(n=>['kk-award-fly','kk-feature-transfer'].includes(n.className)).length,0);
 results.push({seed,speed,reduced,outcome,size,durationMs:r.clock,phases:[...phases],payout:final.total});scene.destroy();
}
for(const action of ['skip','resize'])for(const at of ['cast','respin','settle']){
 const r=createOfflineRuntime(),round=fixtures.caught.round,fit=r.load('src/components/kilo/layout.ts').fitGameLayout,l=fit(366,796),host=r.host(Math.round(l.reelWidth),Math.round(l.reelHeight));
 const scene=await r.load('src/components/kilo/pixiStage.ts').mountScene(host);let changed=false,skipped=false,final;
 await r.drive(r.load('src/components/kilo/director.ts').presentScript(scene,round,{turbo:false,speed:'normal',reduced:false,skipped:()=>skipped,onHud:h=>final=h}),{maxMs:60000,step:16,onFrame(){
  if(!changed&&host.dataset.catchPhase===at){changed=true;if(action==='skip'){skipped=true;scene.show(round.base.grid);}else{const g=fit(1392,852);r.resize(host,Math.round(g.reelWidth),Math.round(g.reelHeight));}}
 }});
 assert(changed);assert.equal(final.total,round.payout);assert.equal(findAll(r.apps[0].stage,'catch-respin').length,0);
 assert.equal(r.document.body.children.filter(n=>['kk-award-fly','kk-feature-transfer'].includes(n.className)).length,0);
 results.push({action,at,durationMs:r.clock,payout:final.total});scene.destroy();
}
// Exercise the real director's Dock intro path, not a direct isolated intro call.
{
 const r=createOfflineRuntime(),round=r.load('src/lib/kilo/engine.ts').generateSplashCandidate(1000,'buy',vsSeeded(170));
 const host=r.host(360,220),scene=await r.load('src/components/kilo/pixiStage.ts').mountScene(host);
 let entered=0,wrong=0,skip=false;const intro=scene.intro;
 scene.intro=async value=>{entered++;await intro(value);skip=true;};
 scene.featureIntro=async()=>{wrong++;};
 await r.drive(r.load('src/components/kilo/director.ts').presentScript(scene,round,{turbo:false,reduced:false,skipped:()=>skip}),{maxMs:60000});
 assert.equal(entered,1);assert.equal(wrong,0);scene.destroy();results.push({actualDockIntroRoute:true});
}
fs.mkdirSync('art/kilo-v83/verification',{recursive:true});fs.writeFileSync('art/kilo-v83/verification/catch-respin.json',JSON.stringify({method:'Actual production director and scene, instrumented Pixi; not browser/WebGL.',fixtures:Object.fromEntries(Object.entries(fixtures).map(([k,v])=>[k,v.seed])),results},null,2));
console.log(`PASS ${results.length} catch-respin / Dock route cases`);
