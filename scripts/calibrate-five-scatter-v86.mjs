/** Reproducible local candidate calibration, never a certified Engine book.
 * Five-scatter carrier mass is unchanged. Only line-only seed weights absorb
 * its changed expectation; all other category masses and outcome math stay. */
import fs from 'node:fs';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {createOfflineRuntime} from './offline-runtime-v79.mjs';
const OUT='art/kilo-v86/math', TOTAL=1e9, STAKE=1000, TARGET=.955;
fs.mkdirSync(OUT,{recursive:true});
const runtime=createOfflineRuntime(),engine=runtime.load('src/lib/kilo/engine.ts');
const {vsSeeded}=runtime.load('src/lib/kilo/vs-progression.ts');
const {runReelFeatureCandidate}=runtime.load('src/lib/kilo/reel-feature-math.ts');
const {VS_OUTCOME_CATALOGUE:c}=runtime.load('src/lib/kilo/vs-outcome-catalogue.ts');
const sum=a=>a.reduce((a,b)=>a+b,0);
const rows=[];let previous=0;
for(let i=0;i<c.length;i+=2){
  const weight=c[i+1]-previous;previous=c[i+1];
  const r=runReelFeatureCandidate('yacht25',STAKE,vsSeeded(c[i]),25000*STAKE);
  assert.equal(r.free[0].mechanic.reel.conversions[0].reel,0);
  assert.equal(r.free[0].mechanic.reel.conversions[0].multiplier,25);
  rows.push([c[i],weight,r.total/STAKE]);
}
assert.equal(previous,TOTAL);
fs.writeFileSync(`${OUT}/super-vs-pool.json`,JSON.stringify({rows})+'\n');
const superMean=rows.reduce((s,[,w,p])=>s+w*p,0)/TOTAL;
const oldVs=JSON.parse(fs.readFileSync('art/kilo-v82/math/vs-catalogue-report.json'));
const buy=JSON.parse(zlib.gunzipSync(fs.readFileSync('art/kilo-v83/math/experience-buy-pool.json.gz')));
const dockMean=buy.rows.reduce((s,r,i)=>s+r.pay*buy.weights[i],0)/TOTAL;
const fiveWeight=Math.round((200*TARGET-.5*dockMean-.5*oldVs.meanPayout)/(superMean-oldVs.meanPayout)*TOTAL);
assert(fiveWeight>0&&fiveWeight<.5*TOTAL);
const mysteryFile='src/lib/kilo/mystery-bonus.ts';
let mystery=fs.readFileSync(mysteryFile,'utf8');
mystery=mystery.replace(/feature: 'yacht', weight: [\d_]+/,`feature: 'yacht', weight: ${TOTAL/2-fiveWeight}`)
  .replace(/feature: 'yacht25', weight: [\d_]+/,`feature: 'yacht25', weight: ${fiveWeight}`);
fs.writeFileSync(mysteryFile,mystery);
const reports=[],catalogues={};
for(const mode of ['spin','ante']){
  const pool=JSON.parse(zlib.gunzipSync(fs.readFileSync(`art/kilo-v83/math/experience-${mode}-pool.json.gz`)));
  const weights=[...pool.weights],pay=pool.rows.map(r=>r.pay),changes=[];
  for(let i=0;i<pool.rows.length;i++)if(pool.rows[i].scatters===5){
    const round=engine.generateSplashCandidate(STAKE,mode,vsSeeded(pool.rows[i].seed));
    const trigger=round.base.scatterPay+sum(round.base.lines.map(l=>l.pay));
    assert.equal(round.feature,'yacht25');
    pay[i]=trigger/STAKE+rows.reduce((s,[,w,p])=>s+w*Math.min(p,25000-trigger/STAKE),0)/TOTAL;
    changes.push({seed:pool.rows[i].seed,weight:weights[i],oldExpected:pool.rows[i].pay,newExpected:pay[i],triggerMultiple:trigger/STAKE});
  }
  assert(changes.length>0);
  const indices=pool.rows.flatMap((r,i)=>r.category==='line-only/tail-body'?[i]:[]);
  const quota=sum(indices.map(i=>weights[i])),fixed=sum(pay.map((p,i)=>indices.includes(i)?0:p*weights[i]));
  const price=engine.splashCost(STAKE,mode)/STAKE,target=TARGET*price*TOTAL;
  const evaluate=lambda=>{
    const score=indices.map(i=>Math.log(weights[i])+lambda*pay[i]);
    const max=Math.max(...score),e=score.map(s=>Math.exp(s-max)),norm=sum(e);
    return e.map(v=>1+(quota-indices.length)*v/norm);
  };
  const expectation=lambda=>fixed+sum(evaluate(lambda).map((w,j)=>w*pay[indices[j]]));
  let low=-1,high=1;
  while(expectation(low)>target)low*=2;
  while(expectation(high)<target)high*=2;
  for(let i=0;i<80;i++){const mid=(low+high)/2;if(expectation(mid)<target)low=mid;else high=mid;}
  const floats=evaluate((low+high)/2);
  indices.forEach((i,j)=>weights[i]=Math.floor(floats[j]));
  const remainder=quota-sum(indices.map(i=>weights[i]));
  const ranked=indices.map((i,j)=>({i,f:floats[j]-weights[i]})).sort((a,b)=>b.f-a.f||a.i-b.i);
  for(let i=0;i<remainder;i++)weights[ranked[i].i]++;
  let residual=target-sum(pay.map((p,i)=>p*weights[i]));
  for(let pass=0;pass<8&&Math.abs(residual)>.05;pass++){
    const values=new Map();for(const i of indices)if(!values.has(pay[i])||weights[i]>weights[values.get(pay[i])])values.set(pay[i],i);
    const sorted=[...values].sort((a,b)=>a[0]-b[0]);
    for(let j=sorted.length-1;j>0;j--){
      const [lp,li]=sorted[j-1],[hp,hi]=sorted[j],delta=hp-lp,direction=Math.sign(residual);
      const donor=direction>0?li:hi,receiver=direction>0?hi:li;
      const n=Math.min(weights[donor]-1,Math.floor(Math.abs(residual)/delta));
      weights[donor]-=n;weights[receiver]+=n;residual-=direction*n*delta;
    }
  }
  assert.equal(sum(weights),TOTAL);assert(weights.every(w=>Number.isSafeInteger(w)&&w>0));
  assert.equal(sum(indices.map(i=>weights[i])),quota);
  for(let i=0;i<weights.length;i++)if(!indices.includes(i))assert.equal(weights[i],pool.weights[i]);
  const expected=sum(pay.map((p,i)=>p*weights[i]))/TOTAL,rtp=expected/price;
  assert(Math.abs(rtp-TARGET)<1e-8);
  let cumulative=0;catalogues[mode]=pool.rows.flatMap((r,i)=>[r.seed,cumulative+=weights[i]]);
  fs.writeFileSync(`${OUT}/experience-${mode}-catalogue.json`,JSON.stringify({version:'experience-v86',mode,totalWeight:TOTAL,entries:catalogues[mode]})+'\n');
  reports.push({mode,price,expected,returnOverCost:rtp,naturalFive:changes,fiveProbability:sum(changes.map(c=>c.weight))/TOTAL,
    originalUnrebalancedReturn:sum(pay.map((p,i)=>p*pool.weights[i]))/TOTAL/price,lineOnlyWeight:quota,
    changedLineSeeds:indices.filter(i=>weights[i]!==pool.weights[i]).length,allOtherWeightsUnchanged:true});
}
// Preserve the bought Dock catalogue byte-for-byte at the array level.
catalogues.buy=runtime.load('src/lib/kilo/experience-outcome-catalogue.ts').EXPERIENCE_CATALOGUES.buy;
fs.writeFileSync('src/lib/kilo/experience-outcome-catalogue.ts',`/** v86 local candidate; v83 Dock unchanged. Base/Ante five-scatter carriers
 * independently select the Super VS book before presentation. Reproduce with
 * scripts/calibrate-five-scatter-v86.mjs. Not certified Engine math. */
export const EXPERIENCE_WEIGHT_TOTAL = 1_000_000_000;
export const EXPERIENCE_CATALOGUES: {spin: readonly number[]; ante: readonly number[]; buy: readonly number[]} = {
${Object.entries(catalogues).map(([mode,values])=>mode+': '+JSON.stringify(values)).join(',\n')}
};\n`);
const mysteryReturn=(.5*dockMean+(TOTAL/2-fiveWeight)/TOTAL*oldVs.meanPayout+fiveWeight/TOTAL*superMean)/200;
const report={checkpoint:'7e6105e6975e6a6a9128eb4f0f13d13d41bf3bab',stake:STAKE,localCandidate:true,super:{outcomes:rows.length,meanMultiple:superMean,capMultiple:25000,capProbability:sum(rows.filter(r=>r[2]===25000).map(r=>r[1]))/TOTAL},mystery:{cost:200,weights:{dock:TOTAL/2,yacht:TOTAL/2-fiveWeight,yacht25:fiveWeight},totalWeight:TOTAL,returnOverCost:mysteryReturn},base:reports,caveats:['Local candidate, not certified or published Stake Engine math.','Mystery price and odds are proposed sandbox defaults, not an operator-approved commercial configuration.','Natural five-scatter rounds compose a recorded base carrier and independent weighted Super VS record; a production outcome book must flatten and publish that contract.']};
fs.writeFileSync(`${OUT}/calibration-report.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
