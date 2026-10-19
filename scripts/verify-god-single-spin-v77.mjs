import assert from 'node:assert/strict';
import {loadProduction} from './kilo-v56-test-loader.mjs';
const {presentReelFeature}=loadProduction('src/components/kilo/reel-feature-director.ts');
const {runReelFeature}=loadProduction('src/lib/kilo/reel-feature-math.ts');
for(const draw of [.8,.06,.01])for(const speed of ['normal','turbo','super'])for(const reduced of [false,true]) {
  const feature=runReelFeature('getaway',1000,()=>draw,25000000);
  const round={version:4,feature:'getaway',stake:1000,mode:'buyGetaway',awarded:0,
    cost:955000,payout:feature.total,capped:feature.capped,
    base:{grid:feature.free[0].grid,lines:[],scatterPay:0},free:feature.free};
  const calls=[];
  const scene={setStake(){},setPace(){},setFeatureState(){},setCopy(){},setMeter(){},setTally(){},
    setLocks(){},setMood(){},show(){},finishPlate(){},
    async spinTo(grid){calls.push({type:'spin',grid});},
    async reelFeatureStep(event,callbacks){calls.push({type:'card'});if(event.credited)callbacks.award(event.credited);}};
  await presentReelFeature(scene,round,{turbo:speed!=='normal',speed,reduced,skipped:()=>false});
  assert.equal(calls.filter(c=>c.type==='spin').length,1,'exactly one ordinary paid God spin');
  assert.deepEqual(calls.map(c=>c.type),['spin','card'],'normal reels settle before the card starts');
  assert.deepEqual(calls[0].grid,feature.free[0].grid,'uses the immutable recorded grid');
}
console.log('PASS v77 God director: 18 outcome/speed/reduced cases, exactly one ordinary paid spin before card; no bought base trigger spin.');
