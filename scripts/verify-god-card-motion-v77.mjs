import assert from 'node:assert/strict';
import {loadProduction} from './kilo-v56-test-loader.mjs';
const {GOD_CARD_CLOCK,godCardOffset,godCardTravel,godCardOutcome,godCardPose,godCardResultScale}=loadProduction('src/components/kilo/god-card-motion.ts');
for(const width of [330,360,690,1100]) {
  const xs=Array.from({length:6},(_,n)=>godCardOffset(width,n));
  assert.equal(xs[0],-width);assert.equal(xs[5],0);
  for(let n=1;n<6;n++)assert(Math.abs(xs[n]-xs[n-1]-width/5)<1e-8,'literal reel-width increments');
}
for(const segments of [1,2,3,4,5])for(const won of [false,true]) {
  const r={won,reveal:{version:1,segments,total:5}},old=JSON.stringify(r),out=godCardOutcome(r);
  assert.equal(JSON.stringify(r),old,'record not mutated');
  assert.equal(out.won,won);assert.equal(out.overshoot,!won&&segments>=4);
  if(won)assert.equal(out.segments,5);
}
for(const pair of [['anticipate','advance'],['advance','settle'],['settle','rest'],['anticipate','overshoot'],['overshoot','stall'],['stall','rest']]) {
  for(const k of ['pitch','lean','heave','wake','wakeLength','spray'])
    assert(Math.abs(godCardPose(pair[0],1)[k]-godCardPose(pair[1],0)[k])<1e-8,`${pair.join('→')} ${k}`);
}
assert.deepEqual(godCardPose('anticipate',0),godCardPose('anticipate',.24),'true hold precedes pressure build');
assert(godCardPose('anticipate',.9).wake>.4);
assert(godCardPose('advance',.3).pitch<-.10,'visible bow rise');
assert(godCardPose('advance',.3).lean<-.20,'seated rider counters acceleration');
assert(godCardPose('advance',.3).wake>.8,'wake builds with thrust');
assert.equal(godCardPose('result',1).wake,0,'no result loop/wake');
assert(GOD_CARD_CLOCK.anticipation[4]>GOD_CARD_CLOCK.anticipation[3]);
let prev=-Infinity;
for(let i=0;i<=100;i++){const x=godCardTravel(i/100);assert(x>=prev);prev=x;}
assert.equal(godCardTravel(0),0);assert.equal(godCardTravel(1),1);
assert.equal(godCardResultScale(1),1);assert(godCardResultScale(.42)>1.1);
console.log('PASS v77 God card: literal reel steps, immutable outcomes, readable physical anticipation, continuous registered poses and finite result settle.');
