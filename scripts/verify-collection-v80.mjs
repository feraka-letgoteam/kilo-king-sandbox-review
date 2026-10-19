/** Actual production collector, instrumented Pixi and virtual clock. No browser claims. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createOfflineRuntime,walk} from './offline-runtime-v79.mjs';
import {sourceFingerprint} from './v79-source-fingerprint.mjs';
const fingerprint=sourceFingerprint(),results=[];
for(const [id,index] of [['tool-bazooka',15],['capped-ante',25]])
 for(const speed of ['normal','turbo','super'])
  for(const [action,phase,from,to] of [['resize','gather',[1440,900],[390,844]],['resize','transfer',[390,844],[1440,900]],['skip','gather',[390,844]],['skip','transfer',[1440,900]]]){
 const r=createOfflineRuntime(),round=r.load('src/lib/kilo/fixtures.json')[id].script,spin=round.free[index],before=JSON.stringify(spin);
 const fit=r.load('src/components/kilo/layout.ts').fitGameLayout;
 const layout=([w,h])=>{const p=w<900?12:24;return fit(w-p*2,h-p*2);};
 const l=layout(from),host=r.host(Math.round(l.reelWidth),Math.round(l.reelHeight)),scene=await r.load('src/components/kilo/pixiStage.ts').mountScene(host);
 scene.setStake(round.stake);scene.setPace(speed!=='normal',false,speed);scene.show(spin.grid);
 const cues=[];let acted=false,phaseFrames=0;
 host.addEventListener('kilo-collection',e=>{if(e.detail)cues.push({ms:r.clock,...e.detail});});
 await r.drive(scene.collect(spin),{step:16,onFrame(){
  walk(r.apps[0].stage,node=>{for(const p of [node.position,node.scale,node.pivot])assert(Number.isFinite(p.x)&&Number.isFinite(p.y),'finite placement after resize');});
  if(host.dataset.collectStep===phase)phaseFrames++;
  if(!acted&&phaseFrames>=3){acted=true;if(action==='skip')scene.show(spin.grid);else{const n=layout(to);r.resize(host,Math.round(n.reelWidth),Math.round(n.reelHeight));}}
 }});
 assert(acted,`${action} reached ${phase}`);assert.equal(JSON.stringify(spin),before);
 assert.equal(r.document.body.children.filter(e=>e.className==='kk-award-fly').length,0,'No stranded award');
 const bank=cues.filter(c=>c.phase==='bank');
 if(action==='skip')assert.equal(bank.length,0,'Renderer must not invent a second bank after director Skip');
 else{assert.equal(bank.length,1);assert.equal(bank[0].completed,spin.got);}
 scene.destroy();results.push({id,index,speed,action,phase,from,to,bank:bank[0]?.completed??null,passed:true});
}
fs.mkdirSync('art/kilo-v80',{recursive:true});assert.equal(sourceFingerprint(),fingerprint);
fs.writeFileSync('art/kilo-v80/collection-interruptions.json',JSON.stringify({method:'Production renderer and real show/cancel/ResizeObserver paths under instrumented Pixi; no browser or wallet integration claims.',sourceFingerprint:fingerprint,results},null,2)+'\n');
console.log(`PASS ${results.length} collection Skip and resize cases.`);
