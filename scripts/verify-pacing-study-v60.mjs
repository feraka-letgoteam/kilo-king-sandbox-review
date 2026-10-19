import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {loadProduction} from './kilo-v56-test-loader.mjs';
const read=f=>JSON.parse(fs.readFileSync(`art/kilo-v60/${f}`,'utf8'));
const {REEL_FEATURE_PROFILE,CLUSTER_PAY}=loadProduction('src/lib/kilo/reel-feature-math.ts');
const oldVs=read('calibration/vs-calibration.json').rows.find(r=>r.name==='baseline');
const vs=read('vs-independent-validation.json').rows.find(r=>r.name==='candidate');
const chopper=read('chopper-validation.json');
const oldRoute=chopper.rows.find(r=>r.name==='baseline'),route=chopper.rows.find(r=>r.name==='candidate');
const expectation=read('vs-expectation.json');
for(const row of [vs,route]){
 assert.deepEqual(row.profile,REEL_FEATURE_PROFILE,'validation uses the shipping profile');
 assert.deepEqual(row.pay,CLUSTER_PAY,'validation uses the shipping paytable');
}
assert(vs.samples>=500000&&route.samples>=50000,'holdout study sample counts');
assert(![6018913,73182061].includes(vs.seed),'VS final holdout seed differs from every calibration seed');
assert(route.seed!==read('calibration/route-calibration.json').rows[0].seed,'Chopper holdout seed differs from calibration');
assert(vs.onlyOpeningVsRate<=.20&&vs.onlyOpeningVsRate<oldVs.onlyOpeningVsRate/2);
assert(vs.meanActions>=1.8&&vs.threePlusVsRate>oldVs.threePlusVsRate);
assert(vs.longestQuietSpinRunQuantiles.p50<=8);
assert(vs.estimatedReturnOverCost>=.945&&vs.estimatedReturnOverCost<=.965,'local VS return remains near the retained 95.5% target');
assert(route.zeroActionSpinRate<=.55&&route.meanActions>=12);
assert(route.finalCashPayoutShare<=.4&&route.longestQuietSpinRunQuantiles.p50<=4);
assert(Math.abs(route.meanPayoutMultiple/oldRoute.meanPayoutMultiple-1)<=.02,'conditional Chopper award budget stays within 2% of baseline');
assert(Math.abs(expectation.selected.finalVsCountProbabilities.reduce((a,b)=>a+b,0)-1)<1e-10);
assert(Math.abs(vs.onlyOpeningVsRate-expectation.selected.finalVsCountProbabilities[1])<.005,'independent state model agrees with sampled event frequency');
const comparisons={
 vs:{before:oldVs,after:vs},chopper:{before:oldRoute,after:route},
};
const report={checkpoint:'516f768',mathSourceSha256:createHash('sha256').update(fs.readFileSync('src/lib/kilo/reel-feature-math.ts')).digest('hex'),
 status:'passed',method:'Independent holdout simulations of the production generator; exact uncapped VS expectation cross-check. Local candidate, not approved math or certified RTP.',
 criteria:{vsOnlyOpeningMaximum:.20,vsAverageDuelsMinimum:1.8,vsMedianQuietRunMaximum:8,vsEstimatedReturnRange:[.945,.965],chopperNoCascadeSpinMaximum:.55,chopperAverageCascadesMinimum:12,chopperFinalCashShareMaximum:.4,chopperMedianQuietRunMaximum:4,chopperMeanPayoutTolerance:.02},comparisons,
 remaining:['Live browser and device pacing review is outstanding.','Overall base/Ante RTP and approved production outcome books are outside this local feature calibration.','Art, character animation and the repeated Chopper flight treatment were not changed.']};
fs.writeFileSync('art/kilo-v60/pacing-acceptance.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS holdout pacing and payout-budget gates; shipping profile/paytable match both validation reports.');
