import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createOfflineRuntime} from './offline-runtime-v79.mjs';
const current=createOfflineRuntime(),baseline=createOfflineRuntime({checkpoint:'f50afc1'});
const engine=current.load('src/lib/kilo/engine.ts'),old=baseline.load('src/lib/kilo/engine.ts');
const math=current.load('src/lib/kilo/reel-feature-math.ts'),{vsSeeded}=current.load('src/lib/kilo/vs-progression.ts');
const {VS_OUTCOME_CATALOGUE:catalogue,VS_CATALOGUE_TOTAL_WEIGHT:weight}=current.load('src/lib/kilo/vs-outcome-catalogue.ts');
const {groupVsReels,vsLineMultiplier}=current.load('src/lib/kilo/vs-groups.ts');
let unchanged=0,changedVs=0,retired=0;
for(const mode of ['spin','ante','buy','getaway'])for(let seed=1;seed<=1500;seed++){
 const stake=[100,500,1000][seed%3],a=engine.playSplash(stake,mode,vsSeeded(seed)),b=old.playSplash(stake,mode,vsSeeded(seed));
 assert.equal(a.cost,b.cost);assert.deepEqual(a.base,b.base);
 if(b.feature==='yacht'){changedVs++;assert.equal(a.feature,'yacht');}
 else if(b.feature==='route'){retired++;assert.equal(a.feature,'yacht');}
 else{assert.deepEqual(a,b);unchanged++;}
}
assert(!engine.SPLASH_MODES.includes('chopper'));assert.throws(()=>engine.playSplash(1000,'chopper',vsSeeded(1)));
const routing=[];
for(const count of [4,5]){
 const recordedInput=()=>{let call=0;const tail=vsSeeded(8205);return()=>call<15?(call++%3===0&&Math.floor((call-1)/3)<count?.99999:0):tail();};
 const round=engine.playSplash(1000,'spin',recordedInput()),prior=old.playSplash(1000,'spin',recordedInput());
 assert.equal(round.base.scatters,count);assert.equal(round.feature,'yacht');assert.deepEqual(round.base,prior.base);assert.equal(round.cost,prior.cost);
 routing.push({scatters:count,was:prior.feature,now:round.feature,baseAwardUnchanged:true});
}
let previous=0,weightedPay=0,verified=0,maxGroup=0;
const weights=JSON.parse(fs.readFileSync('art/kilo-v82/math/vs-weighted-candidates.json'));
for(let i=0;i<catalogue.length;i+=2){
 const seed=catalogue[i],cumulative=catalogue[i+1],w=cumulative-previous;assert(w>0);previous=cumulative;
 const r=math.runReelFeatureCandidate('yacht',1000,vsSeeded(seed),18000000);
 assert.equal(r.total,r.free.reduce((sum,s)=>sum+s.got,0));
 assert.equal(r.total/1000,weights[verified].pay);assert.equal(w,weights[verified].weight);
 weightedPay+=w*r.total/1000;
 let oldReels=[];
 for(const s of r.free){const e=s.mechanic,v=e.reel;
  assert.deepEqual(v.before,oldReels);oldReels=v.after;
  assert.equal(v.lines.reduce((sum,l)=>sum+l.pay,0),s.got);
  assert.equal(v.collection.credited+v.finalCash.credited,0);
  assert.deepEqual(v.groupsAfter,groupVsReels(v.after));
  for(const g of v.groupsAfter){maxGroup=Math.max(maxGroup,g.width);assert.equal(g.multiplier,g.members.reduce((n,m)=>n*m.multiplier,1));assert(g.members.every(m=>m.duelist===g.side));assert(g.reels.every((n,i)=>n===g.start+i));for(const reel of g.reels)assert(v.finalGrid[reel].every(cell=>cell.s==='splash'));}
  for(const line of v.lines){const hit=engine.lineHit(v.finalGrid,engine.PAYLINES[line.i]);assert(line.pay<=Math.round(1000*hit.mult*vsLineMultiplier(v.after,line.n,v.combining)));}
 }
 verified++;
 if(verified%3000===0)console.log(`Verified ${verified} catalogue records`);
}
assert.equal(previous,weight);assert.equal(maxGroup,5);assert(Math.abs(weightedPay/weight/200-.955)<.00001);
const runtime=[];
for(let seed=1;seed<=300;seed++){
 const pick=vsSeeded(seed),selected=math.runReelFeature('yacht',1000,pick,18000000),id=selected.free[0].mechanic.reel.catalogueSeed;
 const direct=math.runReelFeatureCandidate('yacht',1000,vsSeeded(id),18000000);for(const f of selected.free)delete f.mechanic.reel.catalogueSeed;assert.deepEqual(selected,direct);
 for(const stake of [10,100,10000]){const scaled=math.runReelFeatureCandidate('yacht',stake,vsSeeded(id),stake*18000);assert.equal(scaled.total/stake,direct.total/1000);}
 runtime.push(id);
}
const unchangedPaths=['src/components/kilo/layout.ts','src/components/slot-controls','src/components/kilo/control-model.ts','src/lib/kilo/bank.ts','src/lib/kilo/vs-groups.ts','src/components/kilo/god-card-motion.ts','src/components/kilo/god-card-performance.ts'];
for(const p of unchangedPaths){assert(fs.existsSync(p),`Protected path exists: ${p}`);assert.equal(execFileSync('git',['diff','f50afc1','--',p],{encoding:'utf8'}),'',`Protected ${p}`);}
const report={checkpoint:'f50afc1',unmodifiedNonVsRounds:unchanged,revisedVsRounds:changedVs,retiredChopperTriggers:retired,routingFixtures:routing,verifiedCatalogueRecords:verified,weightTotal:weight,exactWeightedPurchaseReturn:weightedPay/weight/200,deterministicReplayCases:runtime.length,stakeScaleCases:runtime.length*3,maxGroup,protectedPaths:unchangedPaths,limits:'Local candidate catalogue, not certified RTP. Full base-game RTP is not inferred from VS buy return.'};
fs.mkdirSync('art/kilo-v82/verification',{recursive:true});fs.writeFileSync('art/kilo-v82/verification/math.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
