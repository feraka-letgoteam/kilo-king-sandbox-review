import fs from 'node:fs';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {createOfflineRuntime} from './offline-runtime-v79.mjs';
const OUT='art/kilo-v86/verification',checkpoint='7e6105e6975e6a6a9128eb4f0f13d13d41bf3bab';fs.mkdirSync(OUT,{recursive:true});
const r=createOfflineRuntime(),e=r.load('src/lib/kilo/engine.ts'),m=r.load('src/lib/kilo/reel-feature-math.ts');
const {vsSeeded,planSuperVsProgression}=r.load('src/lib/kilo/vs-progression.ts');
const old=createOfflineRuntime({checkpoint}).load('src/lib/kilo/engine.ts');
const {groupVsReels,vsLineMultiplier,VS_COMBINING_RULE}=r.load('src/lib/kilo/vs-groups.ts');
const {MYSTERY_BONUSES,MYSTERY_WEIGHT_TOTAL,selectMysteryBonus}=r.load('src/lib/kilo/mystery-bonus.ts');
const pool=JSON.parse(fs.readFileSync('art/kilo-v86/math/super-vs-pool.json')).rows;
let guaranteed=0,stickyChecks=0,oldComparisons=0;
const sides=new Set(), widths=new Set();
for(const [seed,weight,expected]of pool){
  assert(weight>0);const plan=planSuperVsProgression(vsSeeded(seed));
  assert.equal(plan[0].reel,0);assert.equal(plan[0].spin,0);assert.equal(plan[0].multiplier,25);
  assert.equal(new Set(plan.map(a=>a.reel)).size,plan.length);
  const record=m.runReelFeatureCandidate('yacht25',1000,vsSeeded(seed),25e6);
  assert.equal(record.total,Math.round(expected*1000));assert(record.total<=25e6);
  const first=record.free[0].mechanic.reel.conversions.find(c=>c.reel===0);
  assert.equal(first.multiplier,25);assert.equal(first.duel.winner,first.duelist);
  assert.equal(first.duelist==='king'?first.duel.kingMultiplier:first.duel.viceMultiplier,25);
  sides.add(first.duelist);guaranteed++;
  for(const spin of record.free){
    const event=spin.mechanic, reel=event.reel;
    const sticky=reel.after.find(w=>w.reel===0);assert.equal(sticky.multiplier,25);assert.equal(sticky.duelist,first.duelist);stickyChecks++;
    assert.equal(event.kind,'yacht25');assert.equal(event.credited,reel.lines.reduce((s,l)=>s+l.pay,0));
    assert.equal(reel.collection.credited,0);assert.equal(reel.collectors,0);
    assert.deepEqual(reel.groupsAfter,groupVsReels(reel.after));
    for(const group of reel.groupsAfter){widths.add(group.width);assert.equal(group.multiplier,group.reels.reduce((v,index)=>v*reel.after.find(w=>w.reel===index).multiplier,1));}
  }
}
assert.deepEqual([...sides].sort(),['king','vice']);
assert.equal(vsLineMultiplier([{reel:0,multiplier:25,duelist:'king'},{reel:1,multiplier:4,duelist:'king'}],3,VS_COMBINING_RULE),100);
assert.equal(vsLineMultiplier([{reel:0,multiplier:25,duelist:'king'},{reel:1,multiplier:4,duelist:'vice'}],3,VS_COMBINING_RULE),29);
for(const mode of ['buy','yacht','getaway'])for(let seed=1;seed<=300;seed++){
  assert.deepEqual(e.playSplash(1000,mode,vsSeeded(seed)),old.playSplash(1000,mode,vsSeeded(seed)),mode+' unchanged');oldComparisons++;
}
const catalogue=r.load('src/lib/kilo/experience-outcome-catalogue.ts').EXPERIENCE_CATALOGUES;
const baseChecks=[];
for(const mode of ['spin','ante']){
  const p=JSON.parse(zlib.gunzipSync(fs.readFileSync(`art/kilo-v83/math/experience-${mode}-pool.json.gz`)));
  let expected=0,prior=0,fives=0;
  for(let i=0;i<p.rows.length;i++){
    const row=p.rows[i],current=e.generateSplashCandidate(1000,mode,vsSeeded(row.seed));
    const weight=catalogue[mode][i*2+1]-prior;prior+=weight;assert(weight>0);assert.equal(catalogue[mode][i*2],row.seed);
    let pay=current.payout/1000;
    if(row.scatters===5){
      assert.equal(current.feature,'yacht25');const base=old.generateSplashCandidate(1000,mode,vsSeeded(row.seed)).base;
      assert.deepEqual(current.base,base,'five-scatter base trigger/hook/awards unchanged');
      const trigger=base.scatterPay+base.lines.reduce((s,l)=>s+l.pay,0);
      pay=trigger/1000+pool.reduce((s,[,w,v])=>s+w*Math.min(v,25000-trigger/1000),0)/1e9;fives++;
      // Force the existing base carrier interval, then three different real
      // inner-catalogue draws. Every natural outcome retains the guarantee.
      const carrier=(prior-weight/2)/1e9, outcomes=new Set();
      for(const second of [.001,.25,.75]){
        let n=0;const round=e.playSplash(1000,mode,()=>n++===0?carrier:second);
        assert.equal(round.base.scatters,5);assert.equal(round.feature,'yacht25');
        assert.equal(round.free[0].mechanic.reel.conversions[0].multiplier,25);
        outcomes.add(round.free[0].mechanic.reel.catalogueSeed);
      }
      assert.equal(outcomes.size,3,'natural five-scatter entries do not replay one fixed bonus');
    }else assert.equal(pay,row.pay,'non-five candidate award unchanged');
    expected+=pay*weight/1e9;
  }
  assert.equal(prior,1e9);assert(fives>0);assert(Math.abs(expected/(mode==='ante'?1.5:1)-.955)<1e-8);
  baseChecks.push({mode,outcomes:p.rows.length,expected,returnOverCost:expected/(mode==='ante'?1.5:1),naturalFiveCarriers:fives});
}
let cursor=0;const mysteryChecks=[];
for(const option of MYSTERY_BONUSES){
  assert.equal(selectMysteryBonus(()=>cursor/MYSTERY_WEIGHT_TOTAL),option.feature);
  assert.equal(selectMysteryBonus(()=>(cursor+option.weight-1)/MYSTERY_WEIGHT_TOTAL),option.feature);
  for(const stake of [100,1000,5000]){
    let n=0;const rng=vsSeeded(86),round=e.playSplash(stake,'mystery',()=>n++===0?(cursor+option.weight/2)/MYSTERY_WEIGHT_TOTAL:rng());
    assert.equal(round.mode,'mystery');assert.equal(round.feature,option.feature);assert.equal(round.mystery.selected,option.feature);
    assert.equal(round.cost,stake*200);assert.equal(round.base.scatterPay,0);assert.equal(round.base.lines.length,0);
    assert.equal(round.payout,round.free.reduce((s,f)=>s+f.got+f.lines.reduce((v,l)=>v+l.pay,0),0));
    const cap=option.feature==='yacht'?18000:25000;assert(round.payout<=stake*cap);
    mysteryChecks.push({feature:round.feature,stake,cost:round.cost,payout:round.payout});
  }
  cursor+=option.weight;
}
assert.equal(cursor,MYSTERY_WEIGHT_TOTAL);assert(e.splashStakeOk(5000,'mystery'));assert(!e.splashStakeOk(5001,'mystery'));
const quote=r.load('src/components/kilo/control-model.ts').purchaseQuote;
assert.equal(quote(1000,'mystery',199999).allowed,false);assert.equal(quote(1000,'mystery',200000).allowed,true);
assert.equal(quote(10000,'mystery',1e9).allowed,false);assert.throws(()=>e.playSplash(1000,'chopper'));
const protectedFiles=['src/lib/kilo/bank.ts','src/lib/kilo/vs-groups.ts','src/lib/kilo/vs-outcome-catalogue.ts','src/components/kilo/control-model.ts','src/components/kilo/layout.ts','src/components/slot-controls/layout.ts','src/components/kilo/director.ts','src/components/kilo/god-card-performance.ts','src/components/kilo/god-card-motion.ts','src/components/kilo/feature-environments.ts'];
for(const file of protectedFiles)assert.equal(fs.readFileSync(file,'utf8'),execFileSync('git',['show',checkpoint+':'+file],{encoding:'utf8',maxBuffer:32e6}),file);
const stage=fs.readFileSync('src/components/kilo/pixiStage.ts','utf8'),oldStage=execFileSync('git',['show',checkpoint+':src/components/kilo/pixiStage.ts'],{encoding:'utf8',maxBuffer:32e6});
const collect=s=>s.slice(s.indexOf('    async collect(spin) {'),s.indexOf('    async tool(spin) {'));assert.equal(collect(stage),collect(oldStage));
const report={checkpoint,guaranteed,stickyChecks,sides:[...sides],widths:[...widths].sort(),oldComparisons,baseChecks,mysteryChecks,protectedFiles,collectionChoreographyUnchanged:true};
fs.writeFileSync(`${OUT}/math-and-regressions.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
