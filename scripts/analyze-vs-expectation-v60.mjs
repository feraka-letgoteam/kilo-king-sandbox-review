// Exact uncapped expectation via 32 sticky-reel states and multiplier moments.
// Independently checks the Monte Carlo budget; the finite-cap result is
// measured separately by the production generator. Not certified RTP.
import fs from 'node:fs';
import {loadProduction} from './kilo-v56-test-loader.mjs';
const {lineHit}=loadProduction('src/lib/kilo/engine.ts');
const {REEL_FEATURE_PROFILE:p}=loadProduction('src/lib/kilo/reel-feature-math.ts');
const symbols=['10','J','Q','K','A','cuffs','keys','lamp','duffel'];
const weights=[96,76,68,60,50,32,24,16,9],denom=weights.reduce((a,b)=>a+b,0);
const coefficients=[];
for(let mask=0;mask<32;mask++){
 const c=[0,0,0,0,0,0],grid=Array.from({length:5},()=>[{s:'10'}]);
 function walk(reel,probability){
  if(reel===5){
   const hit=lineHit(grid,[0,0,0,0,0]);if(!hit)return;
   const participating=[0,1,2,3,4].filter(x=>(mask&(1<<x))&&x<hit.n);
   if(!participating.length)c[0]+=probability*hit.mult*10;
   else for(const x of participating)c[x+1]+=probability*hit.mult*10;
   return;
  }
  if(mask&(1<<reel)){grid[reel][0]={s:'splash'};walk(reel+1,probability);}
  else for(let s=0;s<symbols.length;s++){grid[reel][0]={s:symbols[s]};walk(reel+1,probability*weights[s]/denom);}
 }
 walk(0,1);coefficients.push(c);
}
const meanMultiplier=p.vsMultipliers.reduce((n,[m,w])=>n+m*w,0)/p.vsMultipliers.reduce((n,[,w])=>n+w,0);
const zeros=()=>Array.from({length:32},()=>({prob:0,m:[0,0,0,0,0]}));
function expand(states,allowed,chance){
 const next=zeros();
 for(let mask=0;mask<32;mask++){
  const s=states[mask];if(!s.prob)continue;
  const free=allowed.filter(r=>!(mask&(1<<r)));
  for(let additions=0;additions<(1<<free.length);additions++){
   let dest=mask,q=1;
   for(let i=0;i<free.length;i++){if(additions&(1<<i)){dest|=1<<free[i];q*=chance;}else q*=1-chance;}
   if(!q)continue;
   next[dest].prob+=s.prob*q;
   for(let r=0;r<5;r++)next[dest].m[r]+=q*((dest&(1<<r))&&!(mask&(1<<r))?s.prob*meanMultiplier:s.m[r]);
  }
 }
 return next;
}
function expected(chance){
 const perSpin=Array(15).fill(0),finalCounts=Array(6).fill(0);
 for(const opening of [2,3,4]){
  const cases=[{probability:1-p.vsFollowupChance,reel:null,spin:null}];
  for(const reel of [2,3,4].filter(r=>r!==opening))for(let spin=p.vsFollowupFirstSpin;spin<=p.vsFollowupLastSpin;spin++)
   cases.push({probability:p.vsFollowupChance/(2*(p.vsFollowupLastSpin-p.vsFollowupFirstSpin+1)),reel,spin});
  for(const followup of cases){
   let states=zeros();states[1<<opening].prob=1;states[1<<opening].m[opening]=2;
   for(let spin=0;spin<15;spin++){
    if(spin===followup.spin)states=expand(states,[followup.reel],1);
    if(spin>=p.vsExtraFirstSpin)states=expand(states,[0,1,2,3,4],chance);
    let value=0;for(let mask=0;mask<32;mask++){const s=states[mask],c=coefficients[mask];value+=c[0]*s.prob+s.m.reduce((n,m,r)=>n+c[r+1]*m,0);}
    perSpin[spin]+=value*followup.probability/3;
   }
   for(let mask=0;mask<32;mask++)finalCounts[mask.toString(2).replaceAll('0','').length]+=states[mask].prob*followup.probability/3;
  }
 }
 const ev=perSpin.reduce((a,b)=>a+b,0);
 return{chance,uncappedMeanPayoutMultiple:ev,uncappedReturnOver200x:ev/200,perSpin,finalVsCountProbabilities:finalCounts};
}
const report={method:'Exact expectation from all symbol combinations on one payline, ten equal-marginal paylines, all sticky masks, and multiplier first moments. Excludes the payout cap and integer rounding at fractional stakes.',profile:p,coefficients,selected:expected(p.vsChance),sensitivity:[.006,.0061,.0062,.0063,.0064].map(expected)};
fs.mkdirSync('art/kilo-v60',{recursive:true});fs.writeFileSync('art/kilo-v60/vs-expectation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({selected:report.selected,sensitivity:report.sensitivity.map(({perSpin,finalVsCountProbabilities,...r})=>r)}));
