import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {loadProduction} from './kilo-v56-test-loader.mjs';

export const PACING_CHECKPOINT='516f768';
export function seeded(seed){return()=>{seed|=0;seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function cloneRecord(value){
 if(value===null||typeof value!=='object')return value;
 if(Array.isArray(value)){const copy=new Array(value.length);for(let i=0;i<value.length;i++)copy[i]=cloneRecord(value[i]);return copy;}
 const copy={};for(const key of Object.keys(value))copy[key]=cloneRecord(value[key]);return copy;
}
function compileMath(source,copy=structuredClone){
 const exports={};
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports','structuredClone',js)(id=>loadProduction(path.join('src/lib/kilo',id)),exports,copy);
 return exports;
}
export function checkpointMath(copy=structuredClone){return compileMath(execFileSync('git',['show',`${PACING_CHECKPOINT}:src/lib/kilo/reel-feature-math.ts`],{encoding:'utf8'}),copy);}
export function measure(math,kind,samples,seed,stake=1000,capMultiple=kind==='yacht'?18000:25000){
 const rng=seeded(seed),payouts=[],actions=[],perSpin=Array.from({length:kind==='yacht'?15:20},()=>({spins:0,events:0,winningSpins:0,credited:0}));
 let sum=0,squares=0,spinCount=0,quiet=0,finalCash=0,onlyStarter=0,cap=0,zero=0,returnCost=0,mult=0,threePlus=0;
 const actionHistogram={},longestQuiet=[];
 for(let i=0;i<samples;i++){
  const result=math.runReelFeature(kind,stake,rng,capMultiple*stake);
  const payout=result.total/stake;payouts.push(payout);sum+=payout;squares+=payout*payout;cap+=result.capped;zero+=payout===0;returnCost+=payout>=200;
  let n=0,quietRun=0,longest=0;
  for(const [j,f]of result.free.entries()){
   const r=f.mechanic.reel,events=kind==='yacht'?r.conversions.length:r.cascades.length;
   n+=events;spinCount++;quiet+=events===0;finalCash+=r.finalCash.credited/stake;
   if(!events){quietRun++;longest=Math.max(longest,quietRun);}else quietRun=0;
   perSpin[j].spins++;perSpin[j].events+=events;perSpin[j].winningSpins+=f.got>0;perSpin[j].credited+=f.got/stake;
  }
  if(kind==='route')mult+=result.free.at(-1).mechanic.reel.globalAfter;
  onlyStarter+=n===1;threePlus+=n>=3;actions.push(n);actionHistogram[n]=(actionHistogram[n]??0)+1;longestQuiet.push(longest);
 }
 payouts.sort((a,b)=>a-b);longestQuiet.sort((a,b)=>a-b);
 const mean=sum/samples,se=Math.sqrt(Math.max(0,squares/samples-mean*mean)/samples);
 const q=a=>Object.fromEntries([.1,.5,.9,.99].map(p=>[`p${p*100}`,a[Math.min(a.length-1,Math.floor(p*a.length))]]));
 return{kind,samples,seed,stake,capMultiple,meanPayoutMultiple:mean,standardError:se,approximate95Interval:[mean-1.96*se,mean+1.96*se],
  ...(kind==='yacht'?{priceMultiple:200,estimatedReturnOverCost:mean/200,onlyOpeningVsRate:onlyStarter/samples,threePlusVsRate:threePlus/samples,atLeastPurchasePriceRate:returnCost/samples}:{}),
  meanActions:actions.reduce((a,b)=>a+b,0)/samples,zeroActionSpinRate:quiet/spinCount,
  finalCashPayoutShare:sum?finalCash/sum:0,cappedRate:cap/samples,zeroPayoutRate:zero/samples,
  meanFinalBoardMultiplier:kind==='route'?mult/samples:null,payoutQuantiles:q(payouts),longestQuietSpinRunQuantiles:q(longestQuiet),actionHistogram,perSpin};
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 const samples=Number(process.env.KILO_PACING_SAMPLES??5000),seed=Number(process.env.KILO_PACING_SEED??6018913);
 if(!Number.isSafeInteger(samples)||samples<1||!Number.isSafeInteger(seed))throw Error('Invalid sample count or seed');
 const production=loadProduction('src/lib/kilo/reel-feature-math.ts'),fast=process.env.KILO_PACING_FAST_CLONE==='1';
 const current=fast?compileMath(fs.readFileSync('src/lib/kilo/reel-feature-math.ts','utf8'),cloneRecord):production,baseline=checkpointMath(fast?cloneRecord:structuredClone);
 let cloneParityCases=0;
 if(fast){
  const originalBaseline=checkpointMath();
  for(const [test,reference]of[[current,production],[baseline,originalBaseline]])for(const kind of ['yacht','route','getaway'])for(let seed=1;seed<=100;seed++){
   const stake=[10,100,1000][seed%3],room=stake*(seed%3===0?123:kind==='yacht'?18000:25000);
   assert.deepEqual(test.runReelFeature(kind,stake,seeded(seed),room),reference.runReelFeature(kind,stake,seeded(seed),room),'record-copy optimization cannot alter any outcome field');cloneParityCases++;
  }
 }
 const modes=(process.env.KILO_PACING_MODES??'yacht,route').split(',');
 if(modes.some(m=>!['yacht','route'].includes(m)))throw Error('Invalid mode');
 const configurations=process.env.KILO_PACING_CONFIG?JSON.parse(fs.readFileSync(process.env.KILO_PACING_CONFIG,'utf8')):[{name:'baseline',baseline:true},{name:'candidate'}];
 const initial=structuredClone(current.REEL_FEATURE_PROFILE),initialPay=structuredClone(current.CLUSTER_PAY),rows=[];
 for(const configuration of configurations){
  Object.assign(current.REEL_FEATURE_PROFILE,initial,configuration.profile??{});
  Object.assign(current.CLUSTER_PAY,initialPay,configuration.pay??{});
  const math=configuration.baseline?baseline:current;
  for(const kind of modes){
   const row={name:configuration.name,profile:structuredClone(math.REEL_FEATURE_PROFILE),pay:structuredClone(math.CLUSTER_PAY),...measure(math,kind,samples,seed)};
   rows.push(row);const{perSpin,actionHistogram,profile,pay,...summary}=row;console.log(JSON.stringify(summary));
  }
 }
 const output=process.env.KILO_PACING_OUTPUT??'art/kilo-v60/pacing-analysis.json';
 fs.mkdirSync(path.dirname(output),{recursive:true});
 fs.writeFileSync(output,JSON.stringify({checkpoint:PACING_CHECKPOINT,method:'Seeded local production-generator simulations. Candidate distribution; not certified RTP. Final-cash share is aggregate payout share. Baseline and candidate use independent identical starting seeds.',recordCopy:fast?'Equivalent plain-data copy instead of native structuredClone; all RNG, rules, grids and ledger operations are the unmodified production function.':'Native structuredClone',cloneParityCases,rows},null,2)+'\n');
}
