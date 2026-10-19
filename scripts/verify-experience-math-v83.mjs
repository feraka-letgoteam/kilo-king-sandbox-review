import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {createOfflineRuntime} from './offline-runtime-v79.mjs';
const current=createOfflineRuntime(),baseline=createOfflineRuntime({checkpoint:'3f9ca55'});
const engine=current.load('src/lib/kilo/engine.ts'),old=baseline.load('src/lib/kilo/engine.ts'),{vsSeeded}=current.load('src/lib/kilo/vs-progression.ts');
const {EXPERIENCE_CATALOGUES:catalogues,EXPERIENCE_WEIGHT_TOTAL:total}=current.load('src/lib/kilo/experience-outcome-catalogue.ts');
const report=JSON.parse(fs.readFileSync('art/kilo-v83/math/experience-calibration-report.json'));
for(const [file,hash]of Object.entries(report.sourceHashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hash,'Candidate source matches calibration snapshot');
let records=0,runtimeSelections=0,scaled=0,unchanged=0,legacy=0,catchCount=0,heldCount=0;
const returns={};
const sumLines=drop=>drop.lines.reduce((n,line)=>n+line.pay,0);
for(const mode of ['spin','ante','buy']){
 const catalogue=catalogues[mode],pool=JSON.parse(zlib.gunzipSync(fs.readFileSync(`art/kilo-v83/math/experience-${mode}-pool.json.gz`)));
 let previous=0,weighted=0;
 for(let i=0;i<catalogue.length;i+=2){
  const seed=catalogue[i],end=catalogue[i+1],weight=end-previous,row=pool.rows[i/2];
  assert(weight>0);assert.equal(seed,row.seed);assert.equal(weight,pool.weights[i/2]);
  const round=engine.generateSplashCandidate(1000,mode,vsSeeded(seed));
  assert.equal(round.payout/1000,row.pay);assert.equal(round.cost,engine.splashCost(1000,mode));
  const paid=sumLines(round.base)+round.base.scatterPay+(round.base.collect?.got??0)+round.free.reduce((n,s)=>n+sumLines(s)+s.got,0);
  assert.equal(paid,round.payout);assert(paid<=engine.splashRoundCap(1000,mode));
  if(round.base.catchRun){
   catchCount++;const b=round.base,r=b.catchRun;
   assert.equal(b.scatters,0);assert.equal(round.awarded,0);assert.equal(round.free.length,0);assert(!b.hook);assert(engine.PAYLINES.every(line=>!engine.lineHit(r.before,line)));
   assert(r.held.length>=2);assert(r.before.flat().every(c=>c.s!=='bars'&&c.s!=='splash'));
   for(const cargo of r.held){const c=b.grid[cargo.reel][cargo.row];assert.equal(c.id,cargo.id);assert.equal(c.v*1000,cargo.value);}
   assert.equal(r.caught,b.grid.flat().some(c=>c.s==='splash'));
   if(b.collect){const cargo=b.grid.flat().filter(c=>c.s==='brick').reduce((n,c)=>n+c.v*1000,0),count=b.grid.flat().filter(c=>c.s==='splash').length;assert.equal(b.collect.beforeCap,cargo*count);assert.equal(b.collect.collectors,count);assert(b.collect.got<=b.collect.beforeCap);}
  }
  if(round.feature==='dock'){
   let prior=[];
   for(const s of round.free){const e=s.mechanic;assert.deepEqual(e.heldBefore,prior);
    for(const h of e.heldBefore){heldCount++;assert.equal(s.grid[h.reel][h.row].id,h.id);assert.equal(s.grid[h.reel][h.row].v*1000,h.value);}
    if(e.heldAfter.length){assert.equal(s.wilds,0);assert.equal(e.heldAfter.length,1);assert(!e.heldBefore.some(h=>h.id===e.heldAfter[0].id));
     const eligible=s.grid.flat().filter(c=>c.s==='brick'&&!e.heldBefore.some(h=>h.id===c.id));assert.equal(e.heldAfter[0].value,Math.max(...eligible.map(c=>c.v*1000)));}
    prior=e.heldAfter;
   }
  }
  // Boundary / midpoint selection tests exercise the shipping binary search.
  if(i%200===0||i===catalogue.length-2){
   for(const choice of [previous,end-1]){let draws=0;const selected=engine.playSplash(1000,mode,()=>{draws++;return(choice+.25)/total;});assert.equal(draws,1);assert.equal(selected.catalogueSeed,seed);assert.equal(selected.generation,'experience-v83');delete selected.catalogueSeed;delete selected.generation;assert.deepEqual(selected,round);runtimeSelections++;}
   for(const stake of [100,500,5000]){const other=engine.generateSplashCandidate(stake,mode,vsSeeded(seed));assert(Math.abs(other.payout/stake-round.payout/1000)<1e-9);scaled++;}
  }
  weighted+=weight*round.payout/1000;previous=end;records++;
 }
 assert.equal(previous,total);returns[mode]=weighted/total/(engine.splashCost(1000,mode)/1000);assert(Math.abs(returns[mode]-.955)<1e-7);
 console.log(`${mode}: ${catalogue.length/2} exact recorded outcomes, weighted return ${returns[mode]}`);
}
for(const mode of ['yacht','getaway'])for(let seed=1;seed<=500;seed++){assert.deepEqual(engine.playSplash(1000,mode,vsSeeded(seed)),old.playSplash(1000,mode,vsSeeded(seed)));unchanged++;}
for(const mode of ['spin','ante','buy','chopper'])for(let seed=1;seed<=300;seed++){assert.deepEqual(engine.playLegacySplash(1000,mode,vsSeeded(seed)),old.playLegacySplash(1000,mode,vsSeeded(seed)));legacy++;}
assert(!engine.SPLASH_MODES.includes('chopper'));assert.throws(()=>engine.playSplash(1000,'chopper',vsSeeded(1)));
const protectedPaths=['src/lib/kilo/bank.ts','src/lib/kilo/vs-groups.ts','src/lib/kilo/reel-feature-math.ts','src/lib/kilo/vs-outcome-catalogue.ts','src/components/slot-controls','src/components/kilo/layout.ts','src/components/kilo/control-model.ts','src/components/kilo/god-card-performance.ts','src/components/kilo/god-card-motion.ts','src/lib/kilo/fixtures.json'];
for(const p of protectedPaths)assert.equal(execFileSync('git',['diff','3f9ca55','--',p],{encoding:'utf8'}),'',`Protected source ${p}`);
const result={checkpoint:'3f9ca55',records,runtimeSelections,scaled,unchangedYachtAndGetaway:unchanged,unchangedLegacy:legacy,catchCount,heldCount,returns,protectedPaths,limits:'Exact finite local catalogue return; not certified/published Stake Engine math. Existing recorded outcomes remain immutable.'};
fs.mkdirSync('art/kilo-v83/verification',{recursive:true});fs.writeFileSync('art/kilo-v83/verification/math.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
