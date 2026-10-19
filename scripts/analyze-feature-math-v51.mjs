// Exact finite Getaway enumeration, Yacht expected value, and a Route bound.
// This analyzes the sandbox generator. It is not a Stake RGS book/weight export.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FEATURE_PROFILE as p, runCargoFeature } from '../src/lib/kilo/feature-math.ts';
import { SPLASH_MODE_MAX_MULT, splashCost } from '../src/lib/kilo/engine.ts';

const weightSum = table => table.reduce((s,[,w]) => s+w,0);
const mean = (table, floor=0) => table.reduce((s,[v,w])=>s+Math.max(v,floor)*w,0)/weightSum(table);
const choose = (n,k) => {let x=1;for(let i=1;i<=k;i++)x=x*(n-i+1)/i;return x;};
function drawFor(table,value) {
  let before=0;
  for(const [v,w] of table) { if(v===value)return (before+w/2)/weightSum(table);before+=w; }
  throw new Error('Missing weighted outcome');
}
function queued(values) {
  let i=0;
  return () => { assert(i<values.length,'No unmodeled random draw');return values[i++]; };
}

let probability=0, expected=0, maxProbability=0, rawMaximum=0, combinations=0;
for(const [a,wa] of p.caseValues)for(const [b,wb] of p.caseValues)for(const [c,wc] of p.caseValues)
for(let i=0;i<3;i++)for(let j=0;j<3;j++)for(let k=0;k<3;k++)for(const [m,wm] of p.extraction) {
  const values=[a,b,c];for(const t of [i,j,k])values[t]*=2;
  const raw=values.reduce((s,v)=>s+v,0)*m;
  const credit=Math.min(SPLASH_MODE_MAX_MULT.getaway,raw);
  const q=wa*wb*wc*wm/(weightSum(p.caseValues)**3*27*weightSum(p.extraction));
  probability+=q;expected+=credit*q;maxProbability+=(raw>=SPLASH_MODE_MAX_MULT.getaway)*q;
  rawMaximum=Math.max(rawMaximum,raw);combinations++;
  const draws=[];
  for(let step=0;step<5;step++) {
    draws.push(...Array(15).fill(0)); // cosmetic grid, then the mechanic draws
    if(step===0)draws.push(...[a,b,c].map(v=>drawFor(p.caseValues,v)));
    else if(step<4)draws.push(([i,j,k][step-1]+.5)/3);
    else draws.push(drawFor(p.extraction,m));
  }
  const record=runCargoFeature('getaway',100,queued(draws),100*SPLASH_MODE_MAX_MULT.getaway);
  assert.equal(record.total,credit*100);
  assert.equal(record.free.at(-1).mechanic.beforeCap,raw*100);
  assert.equal(record.capped,raw>=SPLASH_MODE_MAX_MULT.getaway);
}
assert(Math.abs(probability-1)<1e-10);
assert(Math.abs(expected/splashCost(1,'getaway')-.955)<1e-10);
assert(maxProbability>1/10_000_000,'Maximum has a non-negligible natural probability');

// Cargo value and held count are sufficient statistics for Yacht expected value.
// The advertised 18,000x bound is its uncapped theoretical maximum, so no EV
// approximation is introduced by skipping a distribution of accumulated wins.
let states=new Map([['0,0',{held:0,shipments:0,mass:1,value:0}]]), yachtExpected=0;
for(let turn=0;turn<15;turn++) {
  const next=new Map();
  const add=(held,shipments,mass,value)=>{
    const key=held+','+shipments, item=next.get(key)??{held,shipments,mass:0,value:0};
    item.mass+=mass;item.value+=value;next.set(key,item);
  };
  for(const s of states.values()) {
    const floor=[2,5,10][Math.min(2,Math.floor(s.shipments/2))];
    for(let n=0;n<=12-s.held;n++) {
      const chance=choose(12-s.held,n)*p.yachtCargoChance**n*(1-p.yachtCargoChance)**(12-s.held-n);
      const mass=s.mass*chance,value=s.value*chance+mass*n*mean(p.cargoValues,floor);
      const dispatch=turn===14?1:p.yachtDispatchChance;
      if(s.held+n>0) {
        yachtExpected+=value*dispatch;
        add(0,s.shipments+1,mass*dispatch,0);
        add(s.held+n,s.shipments,mass*(1-dispatch),value*(1-dispatch));
      } else add(0,s.shipments,mass,0);
    }
  }
  states=next;
}
const yachtRtp=(1-p.fullLoadChance)*yachtExpected/splashCost(1,'yacht')+p.fullLoadChance*SPLASH_MODE_MAX_MULT.yacht/splashCost(1,'yacht');
assert(Math.abs(yachtRtp-.955)<1e-10);

// For one five-column Route, conditioning on a paid package makes its column
// nonempty. The other four columns independently have q chance of a pickup.
const q=1-(1-p.routeCargoChance)**3;
let routeMultiplierMean=0;
for(let b=0;b<=4;b++)routeMultiplierMean+=Math.min(5,2+b)*choose(4,b)*q**b*(1-q)**(4-b);
const routeUncapped=4*5*3*p.routeCargoChance*mean(p.cargoValues)*routeMultiplierMean;
// To exceed 25,000x at at most x5 requires >5,000x raw cargo across at most
// 60 picked packages. Even valuing every other package at 50x, >=41 must be
// 100x. Bound this with Binomial(60,P(100)), ignoring the pickup probability.
const rare=p.cargoValues.find(([v])=>v===100)[1]/weightSum(p.cargoValues);
let routeCapProbabilityUpperBound=0;
for(let n=41;n<=60;n++)routeCapProbabilityUpperBound+=choose(60,n)*rare**n*(1-rare)**(60-n);
const routeRtpLossUpperBound=(1-p.fullLoadChance)*5000*routeCapProbabilityUpperBound/splashCost(1,'chopper');
const routeRtpUpperBound=(1-p.fullLoadChance)*routeUncapped/250+p.fullLoadChance*SPLASH_MODE_MAX_MULT.chopper/250;
assert(Math.abs(routeRtpUpperBound-.955)<1e-10);

const yachtDraws=[0,...Array.from({length:15},()=>[
  ...Array(15).fill(0),...Array.from({length:12},()=>[0,.999999]).flat(),0,0,
]).flat()];
const yachtMax=runCargoFeature('yacht',100,queued(yachtDraws),SPLASH_MODE_MAX_MULT.yacht*100);
assert.equal(yachtMax.total,18_000*100);
const routeDraws=[0,...Array.from({length:20},()=>[
  ...Array(15).fill(0),...Array.from({length:15},()=>[0,.999999]).flat(),
]).flat()];
const routeMax=runCargoFeature('route',100,queued(routeDraws),SPLASH_MODE_MAX_MULT.chopper*100);
assert.equal(routeMax.total,25_000*100);
assert.equal(routeMax.free.at(-1).mechanic.beforeCap,7500*100);
assert.equal(routeMax.free.at(-1).mechanic.credited,2500*100);

// Large live-size awards for the real effect-controller verification.
const maximumExamples={
  yacht:{stake:1000,...runCargoFeature('yacht',1000,queued(yachtDraws),SPLASH_MODE_MAX_MULT.yacht*1000)},
  chopper:{stake:1000,...runCargoFeature('route',1000,queued(routeDraws),SPLASH_MODE_MAX_MULT.chopper*1000)},
  getaway:{stake:1000,...runCargoFeature('getaway',1000,()=>.999999,SPLASH_MODE_MAX_MULT.getaway*1000)},
};
fs.writeFileSync('art/kilo-features-v51/maximum-feature-examples.json',JSON.stringify(maximumExamples,null,2)+'\n');

const report={
  method:'Exact enumeration of all Getaway value/target/extraction combinations, tested through production generator; exact Yacht expected-value recursion; analytical Route expectation with rigorous cap-loss bound. Floating point arithmetic, not certified RGS math files.',
  getaway:{combinations,probability,expectedBaseBetMultiplier:expected,rtp:expected/1000,maximum:SPLASH_MODE_MAX_MULT.getaway,rawMaximum,maxProbability,oneIn:1/maxProbability},
  yacht:{standardExpectedBaseBetMultiplier:yachtExpected,rtp:yachtRtp,maximum:SPLASH_MODE_MAX_MULT.yacht,productionMaximumVerified:true,maxProbabilityAtLeast:p.fullLoadChance},
  chopper:{standardUncappedExpectedBaseBetMultiplier:routeUncapped,rtpUpperBound:routeRtpUpperBound,rtpLossUpperBound:routeRtpLossUpperBound,maximum:SPLASH_MODE_MAX_MULT.chopper,productionMaximumVerified:true,maxProbabilityAtLeast:p.fullLoadChance,standardCapProbabilityUpperBound:routeCapProbabilityUpperBound},
  fullLoadDistribution:'Yacht and Route independently select a full-load paid-round outcome with probability 1 in 100,000. It follows ordinary pickup/dispatch rules using the existing 100x packages. Selection does not depend on player, balance, past results or presentation. Standard distribution weights compensate its contribution.',
  remaining:'Dock/base/ante RTP is estimated by Monte Carlo. Exported weighted outcome books and RGS integration are still required; no Stake Engine approval is claimed.',
};
fs.writeFileSync('art/kilo-features-v51/feature-math-analysis.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
