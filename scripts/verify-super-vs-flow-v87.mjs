import fs from 'node:fs';import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createOfflineRuntime,walk,findAll} from './offline-runtime-v79.mjs';
const results=[];
for(const route of ['natural','mystery'])for(const speed of ['normal','turbo','super'])for(const action of ['finish','reduced','skip','resize']){
 const r=createOfflineRuntime(),round=JSON.parse(fs.readFileSync(`public/kilo-v86/replays/super-yacht-${route}.json`)),frozen=JSON.stringify(round);
 const fit=r.load('src/components/kilo/layout.ts').fitGameLayout,l=fit(366,820),host=r.host(Math.round(l.reelWidth),Math.round(l.reelHeight));
 r.window.innerWidth=390;r.window.innerHeight=844;
 const scene=await r.load('src/components/kilo/pixiStage.ts').mountScene(host);
 const director=r.load('src/components/kilo/director.ts');let lastHud,skipped=false,changed=false,frames=0,firstLock=false;
 await r.drive(director.presentScript(scene,round,{speed,turbo:speed!=='normal',reduced:action==='reduced',skipped:()=>skipped,onHud:h=>{lastHud=h;}}),{
  step:1000/30,maxMs:240000,onFrame(){
   frames++;const groups=findAll(r.apps[0].stage,'vs-group-art');
   if(groups.some(g=>g.vsGroup.reels.includes(0)&&g.vsGroup.multiplier===25))firstLock=true;
   if(!changed&&firstLock&&(action==='skip'||action==='resize')){
    changed=true;if(action==='skip'){skipped=true;scene.show(round.free.at(-1).mechanic.reel.finalGrid);}else{
      const desktop=fit(1392,852);r.window.innerWidth=1440;r.window.innerHeight=900;r.resize(host,Math.round(desktop.reelWidth),Math.round(desktop.reelHeight));
    }
   }
   walk(r.apps[0].stage,n=>{assert(Number.isFinite(n.position.x)&&Number.isFinite(n.position.y));assert(Number.isFinite(n.scale.x)&&Number.isFinite(n.scale.y));});
  }
 });
 assert(firstLock,'×25 exists in actual production scene');assert.equal(lastHud.total,round.payout);assert.equal(lastHud.left,0);
 assert.equal(JSON.stringify(round),frozen);assert.equal(r.document.body.children.length,0,'no stranded award traveller');
 if(action==='skip'||action==='resize')assert(changed);
 results.push({route,speed,action,frames,durationMs:r.clock,total:lastHud.total,firstLock,changed});scene.destroy();
}
const source=fs.readFileSync('src/components/kilo/play.tsx','utf8'),old=execFileSync('git',['show','7e6105e:src/components/kilo/play.tsx'],{encoding:'utf8'});
for(const[start,end]of[['  function credit(', '  async function run('],['  async function run(', '  function continueFeature('],['  async function play(', '  function skip(']]){
 const part=s=>s.slice(s.indexOf(start),s.indexOf(end));assert.equal(part(source),part(old),'wallet and settlement path unchanged');
}
fs.writeFileSync('art/kilo-v87/verification/full-flow.json',JSON.stringify({method:'Whole production director + stage, instrumented offline runtime; not browser/WebGL.',results,chargeCreditAndCompletionBodiesUnchanged:true},null,2)+'\n');console.log(`PASS ${results.length} full-feature flow checks`);
