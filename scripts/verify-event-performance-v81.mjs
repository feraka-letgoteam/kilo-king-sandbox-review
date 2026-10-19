/** Real entry/retrigger methods: timing, interruption and exact settled paint. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createOfflineRuntime,walk} from './offline-runtime-v79.mjs';
import {sourceFingerprint} from './v79-source-fingerprint.mjs';
const fingerprint=sourceFingerprint(),checkpoint='7fc3e57',reports=[];
const seeded=seed=>()=>{seed|=0;seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};
async function execute(version,kind,speed,reduced,change='none'){
 const r=createOfflineRuntime({checkpoint:version}),host=r.host(900,540),scene=await r.load('src/components/kilo/pixiStage.ts').mountScene(host),round=r.load('src/lib/kilo/engine.ts').playSplash(1000,kind==='vs-entry'?'yacht':'buy',seeded(170));
 const grants=[],reactions=[];let changed=false,paintFrames=0;
 host.addEventListener('kilo-stage-action',e=>reactions.push({kind:e.detail.kind,ms:r.clock}));
 scene.setStake(1000);scene.setPace(speed!=='normal',reduced,speed);scene.show(round.base.grid);
 const start=r.clock,run=kind==='retrigger'?scene.retrigger(10,3,()=>grants.push(r.clock-start)):kind==='vs-entry'?scene.featureIntro(round):scene.intro(round);
 await r.drive(run,{step:16,onFrame(){paintFrames++;walk(r.apps[0].stage,n=>{for(const p of[n.position,n.scale,n.pivot])assert(Number.isFinite(p.x)&&Number.isFinite(p.y));});
  if(!changed&&change!=='none'&&r.clock-start>=96){changed=true;if(change==='resize')r.resize(host,366,245);else scene.show(round.base.grid);}
 }});
 const elapsed=r.clock-start;
 if(change!=='none')assert(changed);if(kind==='retrigger')assert.equal(grants.length,change==='skip'?0:1);
 assert.equal(r.document.body.children.filter(e=>e.className==='kk-feature-transfer').length,0);
 scene.destroy();return{elapsed,grants,reactions,paintFrames};
}
for(const kind of['dock-entry','vs-entry','retrigger'])for(const speed of['normal','turbo','super'])for(const reduced of[false,true]){
 const before=await execute(checkpoint,kind,speed,reduced),after=await execute(null,kind,speed,reduced);
 assert.equal(after.elapsed,before.elapsed,`${kind}/${speed}: no added duration`);assert.deepEqual(after.grants,before.grants,'Grant clocks unchanged');
 reports.push({kind,speed,reduced,...after});
}
for(const kind of['dock-entry','vs-entry','retrigger'])for(const speed of['normal','turbo','super'])for(const change of['skip','resize'])reports.push({kind,speed,change,...await execute(null,kind,speed,false,change)});
const r=createOfflineRuntime(),motion=r.load('src/components/kilo/event-performance.ts');
assert.deepEqual(motion.featureArrivalAt(1),{x:1,y:1,lift:0,turn:0});
for(const side of['king','vice'])for(const[key,value]of Object.entries(motion.wildArtAt(1,side)))assert(Math.abs(value-motion.WILD_REST[key])<1e-12,'Exact resting transform');
assert.equal(sourceFingerprint(),fingerprint,'Source frozen throughout verification');
fs.writeFileSync('art/kilo-v81/event-performance-verification.json',JSON.stringify({method:'Production entry/retrigger source under instrumented Pixi; exact v80 duration and grant comparisons. No browser claim.',sourceFingerprint:fingerprint,reports},null,2)+'\n');
console.log(`PASS ${reports.length} entry/retrigger timing and interruption cases.`);
