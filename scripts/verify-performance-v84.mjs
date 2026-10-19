import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createOfflineRuntime,findAll,walk} from './offline-runtime-v79.mjs';
import {sourceFingerprint} from './v79-source-fingerprint.mjs';
const checkpoint='c6e56c746909d2228a56c173548545a334f6133f',fingerprint=sourceFingerprint(),out='art/kilo-v84/verification';fs.mkdirSync(out,{recursive:true});
const protectedFiles=['src/lib/kilo/engine.ts','src/lib/kilo/feature-math.ts','src/lib/kilo/reel-feature-math.ts','src/lib/kilo/vs-groups.ts','src/lib/kilo/vs-progression.ts','src/lib/kilo/vs-outcome-catalogue.ts','src/lib/kilo/experience-outcome-catalogue.ts','src/lib/kilo/fixtures.json','src/components/kilo/director.ts','src/components/kilo/control-model.ts','src/components/kilo/layout.ts','src/components/kilo/play.tsx','src/components/slot-controls/layout.ts','src/components/kilo/feature-takeover.tsx','src/components/kilo/god-card-motion.ts'];
for(const p of protectedFiles.filter(p=>!p.endsWith('god-card-motion.ts')))assert.equal(fs.readFileSync(p,'utf8'),execFileSync('git',['show',checkpoint+':'+p],{encoding:'utf8',maxBuffer:32*1024*1024}),p+' remains byte identical');
const stagePath='src/components/kilo/pixiStage.ts',prior=execFileSync('git',['show',checkpoint+':'+stagePath],{encoding:'utf8',maxBuffer:32*1024*1024}),now=fs.readFileSync(stagePath,'utf8');
const collector=s=>s.slice(s.indexOf('    async collect(spin) {'),s.indexOf('    async tool(spin) {'));
assert.equal(collector(now),collector(prior),'Accepted exact collection choreography is untouched');
const r=createOfflineRuntime(),m=r.load('src/components/kilo/god-card-motion.ts'),old=createOfflineRuntime({checkpoint}).load('src/components/kilo/god-card-motion.ts');
assert.deepEqual(m.GOD_CARD_CLOCK,old.GOD_CARD_CLOCK,'Every established Max phase duration is unchanged');
for(let n=0;n<=500;n++){const t=n/100;assert.equal(m.godCardOffset(1000,t),old.godCardOffset(1000,t));}
const samples=[];
for(let stage=1;stage<=5;stage++){
 const ant=m.godCardPose('anticipate',1,stage),launch=m.godCardPose('advance',0,stage),brake=m.godCardPose('advance',1,stage),settle=m.godCardPose('settle',0,stage);
 for(const k of ['pitch','lean','heave','surge','wake','wakeLength','spray']){assert(Math.abs(ant[k]-launch[k])<1e-8,'Continuous wind-up / launch '+k);assert(Math.abs(brake[k]-settle[k])<1e-8,'Continuous brake / settle '+k);}
 for(const phase of ['anticipate','advance','settle','stall','overshoot','result'])for(let n=0;n<=200;n++){
  const p=m.godCardPose(phase,n/200,stage);for(const v of Object.values(p))if(typeof v==='number')assert(Number.isFinite(v));assert(p.wake>=0&&p.wake<=1);assert(p.spray>=0&&p.spray<=1);assert(Math.abs(p.lean)<.8&&Math.abs(p.pitch)<.6);
 }
 samples.push({stage,preload:ant,thrust:m.godCardPose('advance',.3,stage),brake,rest:m.godCardPose('settle',1,stage)});
}
const life=r.load('src/components/kilo/stage-character-life.ts'),arms=r.load('src/components/kilo/stage-character-arm.ts'),mesh=r.load('src/components/kilo/stage-character-mesh.ts');
let anatomicalSamples=0;
for(const kind of Object.keys(life.STAGE_REACTION_MS))for(let i=0;i<=100;i++){
 const frame=life.stageKingFrameAt(18000,i/100*life.STAGE_REACTION_MS[kind],false,kind),p=arms.kingLeftArmPose(frame);
 assert(Math.abs(Math.hypot(p.elbow.x-p.shoulder.x,p.elbow.y-p.shoulder.y)-100)<1e-8);assert(Math.abs(Math.hypot(p.wrist.x-p.elbow.x,p.wrist.y-p.elbow.y)-143)<1e-8);
 for(const point of [{x:250,y:650},{x:400,y:750}])assert.deepEqual(mesh.kingMeshPoint(point.x,point.y,frame),point,'Feet / lower body stay planted');anatomicalSamples++;
}
const playback=life.createStageKingPlayback();playback.react('max-win','max-stop');playback.advance(80);playback.react('generic','win');assert.equal(playback.advance(0).reaction,'max-stop');
playback.settle();playback.react('defeat','vs-loss');playback.react('generic-2','win');assert.equal(playback.advance(0).reaction,'vs-loss');
const seeded=seed=>()=>{seed|=0;seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};
const maths=r.load('src/lib/kilo/reel-feature-math.ts'),fixtures={};
for(let seed=1;seed<100000&&Object.keys(fixtures).length<3;seed++){
 const round=maths.runReelFeature('getaway',1000,seeded(seed),25000000),record=round.free[0].mechanic.reel;
 const key=record.won?'full':record.reveal.segments===2?'early':record.reveal.segments===4?'late':null;
 if(key&&!fixtures[key])fixtures[key]=record;
}
assert.equal(Object.keys(fixtures).length,3);
const results=[];
for(const [outcome,record] of Object.entries(fixtures))for(const speed of ['normal','turbo','super'])for(const reduced of [false,true])for(const phone of [false,true]){
 const rt=createOfflineRuntime(),p=rt.load('src/components/kilo/god-card-performance.ts'),world=new rt.pixi.Container(),host=rt.host(900,540);
 const expected=JSON.stringify(record),credits=[],reactions=[],observations=[];let g=phone?{gx:3,gy:4,cell:60,gap:3}:{gx:7,gy:8,cell:130,gap:4},clock=0;
 const inspect=()=>{const card=findAll(world,'god-full-window-card')[0];if(!card)return;observations.push({...card.godCard});walk(world,n=>{for(const q of[n.position,n.scale,n.pivot])assert(Number.isFinite(q.x)&&Number.isFinite(q.y));});};
 await p.runGodCardPresentation(record,{parent:world,host,textures:()=>({}),geom:()=>g,pace:()=>({speed,reduced}),live:()=>true,cue(){},react:k=>reactions.push(k),readout(){throw Error('No duplicate result readout');},screen:(x,y)=>({x,y}),hold:async ms=>{clock+=ms;inspect();},motion:async(ms,paint)=>{for(const t of reduced?[1]:[0,.1,.2,.35,.5,.65,.8,.95,1]){paint(t);inspect();}clock+=ms*({normal:1,turbo:.55,super:.32}[speed]);},transfer:async(award,refresh)=>{refresh();credits.push(award.credited);}});
 assert.equal(JSON.stringify(record),expected);assert.deepEqual(credits,record.won?[record.result.credited]:[]);assert.equal(world.children.length,0,'Finite cleanup');assert(reactions.includes(record.won?'max-stop':'max-loss'));
 if(!reduced){assert(observations.some(s=>s.phase==='anticipate'&&s.segment===0&&s.entryPressure>.5),'First anticipation is visible BEFORE translation');assert(observations.some(s=>s.phase==='advance'&&s.pitch<-.10&&s.lean<-.15&&s.wake>.7),'Independent readable physical action');}
 else assert(observations.every(s=>s.entryPressure===0&&s.pitch===0&&s.lean===0),'Reduced motion suppresses staging, pressure and physical displacement');
 results.push({outcome,speed,reduced,phone,paid:credits,observations:observations.length,clock});
}
for(const [outcome,record] of Object.entries(fixtures))for(const speed of ['normal','turbo','super'])for(const action of ['skip','resize'])for(const phase of ['anticipate','advance','settle','result']){
 const rt=createOfflineRuntime(),p=rt.load('src/components/kilo/god-card-performance.ts'),world=new rt.pixi.Container(),host=rt.host(900,540);let live=true,acted=false,g={gx:5,gy:5,cell:130,gap:4},paid=0;
 await p.runGodCardPresentation(record,{parent:world,host,textures:()=>({}),geom:()=>g,pace:()=>({speed,reduced:false}),live:()=>live,cue(){},react(){},readout(){throw Error('Duplicate readout');},screen:(x,y)=>({x,y}),hold:async()=>{},motion:async(ms,paint)=>{for(const t of[0,.2,.4,.6,.8,1]){if(!live)break;paint(t);const card=findAll(world,'god-full-window-card')[0];if(!acted&&card?.godCard.phase===phase&&t>=.2){acted=true;if(action==='skip')live=false;else g={gx:3,gy:3,cell:60,gap:3};}}},transfer:async(award,refresh)=>{if(live){refresh();paid+=award.credited;}}});
 assert(acted);assert.equal(world.children.length,0);assert.equal(paid,action==='skip'?0:record.result.credited);results.push({outcome,speed,action,phase,paid});
}
assert.equal(sourceFingerprint(),fingerprint,'Frozen source');
fs.writeFileSync(out+'/performance.json',JSON.stringify({checkpoint,sourceFingerprint:fingerprint,protectedFiles,collectionByteIdentical:true,anatomicalSamples,constantBoneLengths:true,reactionPriority:true,unchangedMaxClocks:true,samples,results,method:'Actual production controllers and transforms with instrumented Pixi, not browser/WebGL.'},null,2)+'\n');
console.log(`PASS ${results.length} Max outcome/speed/reduced/Skip/resize cases; ${anatomicalSamples} planted-foot / bone checks; preserved math, wallet, controls, collection and clocks.`);
