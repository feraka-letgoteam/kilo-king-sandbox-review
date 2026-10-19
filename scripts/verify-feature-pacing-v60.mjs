import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import {loadProduction} from './kilo-v56-test-loader.mjs';
import {PACING_CHECKPOINT,checkpointMath,seeded} from './analyze-feature-pacing-v60.mjs';

const current=loadProduction('src/lib/kilo/reel-feature-math.ts'),old=checkpointMath();
const engine=loadProduction('src/lib/kilo/engine.ts');
const baselineEngine={};
new Function('require','exports',ts.transpileModule(execFileSync('git',['show',`${PACING_CHECKPOINT}:src/lib/kilo/engine.ts`],{encoding:'utf8'}),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(
 id=>id==='./reel-feature-math.ts'?old:loadProduction(path.join('src/lib/kilo',id)),baselineEngine);
let assertions=0,equivalentRounds=0,changedFeatures=0,capCases=0;
const equal=(a,b,message)=>{assert.deepEqual(a,b,message);assertions++;};
const check=(condition,message)=>{assert(condition,message);assertions++;};
const protectedFiles=[
 'src/lib/kilo/engine.ts','src/lib/kilo/bank.ts','src/lib/kilo/feature-math.ts','src/lib/kilo/max-spin-reveal.ts',
 'src/components/kilo/director.ts','src/components/kilo/reel-feature-director.ts','src/components/kilo/pixiStage.ts',
 'src/components/kilo/reel-feature-effects.ts','src/components/kilo/play.tsx','src/components/kilo/layout.ts',
 'src/components/kilo/art-map.ts','src/components/kilo/fish-art.ts','src/components/kilo/presentation-readout.ts',
 'src/components/kilo/brand-layout.ts','src/components/kilo/stage-character-life.ts',
 'src/components/slot-controls/SlotControls.tsx','src/components/slot-controls/controls.css',
 'src/components/slot-controls/layout.ts','src/components/slot-controls/tokens.ts',
];
for(const file of protectedFiles)equal(fs.readFileSync(file,'utf8'),execFileSync('git',['show',`${PACING_CHECKPOINT}:${file}`],{encoding:'utf8'}),`protected ${file}`);

// Exercise the real paid-round entry points. Natural trigger boards and costs
// must stay identical, even when the ensuing Yacht/Chopper record changes.
for(const mode of ['spin','ante','buy','getaway'])for(let seed=1;seed<=2500;seed++){
 const stake=[100,500,1000][seed%3],before=baselineEngine.playSplash(stake,mode,seeded(seed)),after=engine.playSplash(stake,mode,seeded(seed));
 equal(after.cost,before.cost,'charge unchanged');equal(after.base,before.base,'base board, hook, lines and scatter award unchanged');
 equal(after.feature,before.feature,'natural trigger unchanged');equal(after.awarded,before.awarded,'awarded spins unchanged');
 if(!['yacht','route'].includes(after.feature)){equal(after,before,'base/Dockside/Max outcome unchanged');equivalentRounds++;}
 else{equal(after.free[0].mechanic.reel.distribution,'pacing-v60','only new feature records get the new distribution');changedFeatures++;}
}

// Rare natural triggers get explicit coverage rather than relying on their
// appearance in the much smaller unchanged-round sample above.
const naturalSeeds={};
for(let seed=1;seed<=60000&&Object.keys(naturalSeeds).length<2;seed++){
 const after=engine.playSplash(1000,'spin',seeded(seed));
 if(!['yacht','route'].includes(after.feature)||naturalSeeds[after.feature])continue;
 const before=baselineEngine.playSplash(1000,'spin',seeded(seed));
 naturalSeeds[after.feature]=seed;
 equal(after.base,before.base,'rare natural entry board and hook unchanged');
 equal(after.cost,before.cost,'natural entry charge unchanged');
 equal(after.feature,before.feature,'rare natural trigger unchanged');
 equal(after.awarded,before.awarded,'natural awarded spins unchanged');
 equal(after.free[0].mechanic.reel.distribution,'pacing-v60','natural feature uses the new generator');
 equal(after.payout,after.base.lines.reduce((n,l)=>n+l.pay,0)+after.base.scatterPay+after.free.reduce((n,s)=>n+s.got,0),'natural base and feature share one ledger');
 changedFeatures++;
}
equal(Object.keys(naturalSeeds).sort(),['route','yacht'],'both natural entries exercised');

// New opportunities must happen on visible recorded boards, with persistent
// ownership, no future-state leak, and no secretly regenerated results.
const firstFollowups=new Set(),clusterSymbols=new Set();
for(const kind of ['yacht','route'])for(let seed=1;seed<=1000;seed++){
 const stake=[10,100,1000][seed%3],room=stake*(kind==='yacht'?18000:25000),result=current.runReelFeature(kind,stake,seeded(seed),room);
 equal(result,current.runReelFeature(kind,stake,seeded(seed),room),'new records replay deterministically');
 equal(result.total,result.free.reduce((n,s)=>n+s.got,0),'one complete payout ledger');
 check(result.total<=room,'existing cap');
 if(kind==='yacht'){
  const first=result.free[0].mechanic.reel;
  equal(first.conversions.length,1,'one opening duel, never a pile of opening duels');
  check([2,3,4].includes(first.conversions[0].reel),'opening is on the right');equal(first.conversions[0].multiplier,2,'opening remains x2');
  for(const [index,f]of result.free.entries()){
   const r=f.mechanic.reel;
   if(index>0&&index<4)equal(r.conversions.length,0,'documented opening phase');
   if(index>=4&&index<=8){
    if(r.conversions.length){equal(r.conversions.length,1,'one mid-feature follow-up');check([2,3,4].includes(r.conversions[0].reel),'follow-up uses another right reel');firstFollowups.add(index+1);}
   }
   check(r.after.every(w=>r.finalGrid[w.reel].every(c=>c.s==='splash')),'every landed VS stays fully wild');
   check(!f.grid.flat().some(c=>c.s==='brick'),'no collector/cash hybrid');
  }
 }else{
  for(const f of result.free){
   const r=f.mechanic.reel;
   for(const cargo of r.dropped)check(current.REEL_FEATURE_PROFILE.tumbleCargoValues.some(([v])=>Math.round(v*stake)===cargo.value),'drop value is in the published Chopper ladder');
   for(const cascade of r.cascades)for(const c of cascade.clusters){
    clusterSymbols.add(c.symbol);
    equal(c.baseMultiple,current.clusterBaseMultiple(c.symbol,c.cells.length),'published paytable matches new cluster');
    equal(c.beforeCap,Math.round(stake*c.baseMultiple*c.multiple),'visible symbol award matches recorded math');
   }
   equal(f.got,r.finalCash.credited+r.cascades.reduce((n,c)=>n+c.clusters.reduce((s,k)=>s+k.credited,0),0),'cascades and terminal cash credited exactly once');
  }
 }
}
equal([...firstFollowups].sort((a,b)=>a-b),[5,6,7,8,9],'all mid-feature positions reachable');
for(const rank of ['10','J','Q'])check(clusterSymbols.has(rank),'cluster lead rotation has visible variety');

// Tiny remaining budgets force partial credits. Ordinary scores remain raw;
// only credited amounts fit the cap, and no final sweep can pay them again.
for(const kind of ['yacht','route'])for(const stake of [10,1000])for(const remaining of [0,1,17,12345])for(const seed of [1,6,19,129]){
 const result=current.runReelFeature(kind,stake,seeded(seed),remaining);
 check(result.total<=remaining,'small remaining cap');
 equal(result.total,result.free.reduce((n,s)=>n+s.got,0),'capped ledger sum');
 for(const spin of result.free)check(spin.mechanic.beforeCap>=spin.mechanic.credited,'raw award survives truncation');
 capCases++;
}

// Retained v59 recorded grids/payouts are not regenerated under v60 math.
const legacy=JSON.parse(execFileSync('git',['show',`${PACING_CHECKPOINT}:art/kilo-features-v54/replay-examples.json`],{encoding:'utf8',maxBuffer:32*1024*1024}));
for(const round of Object.values(legacy)){
 const featureTotal=round.free.reduce((n,f)=>n+f.got,0);
 const trigger=round.base.lines.reduce((n,l)=>n+l.pay,0)+round.base.scatterPay;
 equal(featureTotal+trigger,round.payout,'historical record retains its own ledger');
}

const report={checkpoint:PACING_CHECKPOINT,assertions,equivalentRounds,changedFeatures,naturalSeeds,capCases,followupSpins:[...firstFollowups].sort((a,b)=>a-b),clusterSymbols:[...clusterSymbols],protectedFiles,
 method:'Production outcome generation, independent ledger/cap assertions, immutable historical records, and source equality. Not live browser verification.'};
fs.mkdirSync('art/kilo-v60',{recursive:true});fs.writeFileSync('art/kilo-v60/pacing-contracts.json',JSON.stringify(report,null,2)+'\n');
console.log(`PASS ${assertions} pacing/protection checks; ${equivalentRounds} unchanged paid rounds; ${capCases} small-cap cases.`);
