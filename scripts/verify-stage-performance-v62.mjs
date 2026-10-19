import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as P from './reel-renderer-mocks-v52.mjs';
process.env.KILO_STAGE_HARNESS_ONLY='1';
const H=await import('./render-collection-performance-v62.mjs');
const {factory,fit,fitGameLayout,fixtures}=H;
const sizes=[[1440,900],[390,844],[360,800],[844,390]];
const gs=sizes.map(([w,h])=>{const p=w<900?12:24,l=fitGameLayout(w-p*2,h-p*2);return fit(Math.round(l.reelWidth),Math.round(l.reelHeight));});
let count=0,awards=0,resizes=0,skips=0;
const results=[];
for(const kind of ['entry','retrigger','symbols'])for(let gi=0;gi<4;gi++)for(const speed of ['normal','turbo','super'])for(const reduced of [false,true])for(const mode of ['none','resize','skip']){
 let now=0,id=0,queue=new Map(),done=false,error,changed=false,award=0,awardAt=null,awardBeforeSkip=0;
 const schedule=(cb,delay)=>{const n=++id;queue.set(n,{cb,at:now+delay});return n;};
 const round=fixtures['tool-bazooka'].script,spin=round.free[15],h=factory({...P,...H,...H.art,...H.fish,...H.motion,...H.readouts,
  geom:gs[gi],stake:round.stake,spin,now:()=>now,raf:cb=>schedule(()=>cb(now),16),timer:schedule,cancel:n=>queue.delete(n),
  document:{hidden:false,body:{appendChild(){}},createElement:()=>({style:{},remove(){}})},
  screen:(x,y)=>({x,y}),landing:()=>null,socket:()=>null,readout(){},collectionCue(){},cue(){}});
 h.scene.setPace(speed!=='normal',reduced,speed);
 const run=kind==='entry'?h.scene.intro(round):kind==='retrigger'?h.scene.retrigger(10,3,()=>{award++;awardAt=now;}):h.burst({i:0,s:'J',n:3,pay:1000});
 run.then(()=>done=true).catch(e=>{error=e;done=true;});
 if(mode!=='none')schedule(()=>{if(done)return;changed=true;if(mode==='resize'){h.resize(gs[(gi+1)%4]);resizes++;}else{awardBeforeSkip=award;h.skip();skips++;}},80);
 const inspect=n=>{for(const p of [n.position,n.scale,n.pivot])assert(Number.isFinite(p.x)&&Number.isFinite(p.y));assert(!n.destroyed);for(const child of n.children)inspect(child);};
 for(let n=0;!done&&n<10000;n++){
  for(let i=0;i<15;i++)await Promise.resolve();inspect(h.world);
  const event=[...queue.entries()].sort((a,b)=>a[1].at-b[1].at)[0];if(event){queue.delete(event[0]);now=event[1].at;event[1].cb();}
 }
 if(error)throw error;assert(done,'stage clock stalled');
 if(kind==='retrigger'){
  assert.equal(award,mode==='skip'&&changed?awardBeforeSkip:1,'award exactly once after first hold');awards+=award;
  if(mode!=='skip'&&speed==='normal'&&!reduced)assert(awardAt>=700&&awardAt<=730,'original announcement award point preserved');
 }
 if(kind==='entry'&&mode!=='skip')assert(now<=1150,'entry ends within original 1.5-second maximum');
 assert.equal(h.world.children.at(-1).children.length,0,'transient overlay leak');
 if(mode!=='skip')assert.equal(h.snapshot().resizeFollow,false);
 results.push({kind,viewport:sizes[gi],speed,reduced,mode,ms:now,awardAt});count++;
}
fs.writeFileSync('art/kilo-v62/stage-performance-verification.json',JSON.stringify({method:'Actual production stage methods, sprites, registered textures and director dependencies with virtual clock; no browser.',count,awards,resizes,skips,results},null,2)+'\n');
console.log(`PASS ${count} entry/retrigger/symbol performances; ${resizes} resizes, ${skips} interruptions, ${awards} recorded retrigger callbacks.`);
