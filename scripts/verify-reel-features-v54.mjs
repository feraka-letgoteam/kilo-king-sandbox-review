// Production math and director verification. No browser/GPU claims.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {registerHooks} from 'node:module';
import {execFileSync} from 'node:child_process';
registerHooks({resolve(s,c,next){return next(s.startsWith('@/')?new URL(`../src/${s.slice(2)}.ts`,import.meta.url).href:s,c);}});
globalThis.window={setTimeout,matchMedia:()=>({matches:true})};
globalThis.fetch=async()=>({ok:true,json:async()=>({sprites:{}})});
const {playSplash,splashCost,splashRoundCap,PAYLINES,lineHit}=await import('../src/lib/kilo/engine.ts');
const {runReelFeature,connectedClusters,refillTumble,REEL_FEATURE_PROFILE}=await import('../src/lib/kilo/reel-feature-math.ts');
const {presentScript,finalHud}=await import('../src/components/kilo/director.ts');
export function seeded(seed){return()=>{seed|=0;seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};}
let assertions=0, generated=0, noWinVsLandings=0;
const outputDir=process.env.KILO_VERIFICATION_DIR??'art/kilo-features-v54';
fs.mkdirSync(outputDir,{recursive:true});
const check=(c,m)=>{assert(c,m);assertions++;};
const sum=a=>a.reduce((n,v)=>n+v,0), cash=g=>g.flatMap((col,reel)=>col.flatMap((c,row)=>c.s==='brick'?[{id:c.id,reel,row,value:Math.round(c.v*1000)}]:[]));
const equal=(a,b,m)=>{assert.deepEqual(a,b,m);assertions++;};
const examples={};
function inspect(kind,result,stake=1000,room=kind==='yacht'?18000*stake:25000*stake){
  let total=0,held=[],wilds=[],lastGlobal=1;
  for(const spin of result.free){const e=spin.mechanic,r=e.reel;
    equal(e.heldBefore,held,'persistent cash is exactly the previous record');
    let raw=0,paid=0;
    const award=a=>{check(a.beforeCap>=a.credited&&a.credited>=0,'separate raw/credited amounts');raw+=a.beforeCap;paid+=a.credited;};
    if(r.type==='vs'){
      equal(r.rules,'pure-vs','new Yacht records are pure VS');
      check(!spin.grid.flat().some(c=>c.s==='brick'),'no cargo symbols in VS mode');
      equal(e.heldBefore,[],'no held cash before VS spin');equal(e.heldAfter,[],'no held cash after VS spin');
      equal(r.collection,{beforeCap:0,credited:0},'no Big Bass collection');equal(r.finalCash,{beforeCap:0,credited:0},'no terminal cash payout');
      for(const old of wilds)equal(r.after.find(w=>w.reel===old.reel),old,'every VS persists with its multiplier and winner through every later spin');
      equal(r.before,wilds,'sticky wilds never reset inside the round');
      for(const v of r.conversions){
        check(!r.before.some(x=>x.reel===v.reel),'a reel converts only once');
        check(spin.grid[v.reel][1].duel,'recorded VS trigger appears on the landed reel');
        equal(r.after.find(w=>w.reel===v.reel),{reel:v.reel,multiplier:v.multiplier,duelist:v.duelist},'every newly landed VS immediately becomes a permanent wild reel');
        check(v.duel.winner===v.duelist,'recorded winner owns the reel');
        equal(v.multiplier,v.duel[v.duelist==='king'?'kingMultiplier':'viceMultiplier'],'locked multiplier is the recorded winning value');
        equal(v.sources,[],'VS is not a cargo collector');
        check(v.sources.every(c=>c.reel===v.reel),'VS only collects its own reel');
        check(v.beforeCap===sum(v.sources.map(c=>c.value))*v.multiplier,'VS multiplier arithmetic');award(v);
      }
      check(new Set(r.after.map(w=>w.reel)).size===r.after.length,'no duplicate wilds');
      for(const w of r.after)check(r.finalGrid[w.reel].every(c=>c.s==='splash'),'every sticky reel remains fully wild in the settled board');
      if(!e.credited)noWinVsLandings+=r.conversions.length;
      const parcels=r.collectGrid.flat().filter(c=>c.s==='brick');
      const collectors=r.collectGrid.flat().filter(c=>c.s==='splash').length;
      equal(collectors,r.collectors,'expanded wild reels are not ordinary collectors');
      check(r.collection.beforeCap===sum(parcels.map(c=>Math.round(c.v*stake)))*collectors,'each ordinary collector gets the remaining cash');award(r.collection);
      for(const c of r.conversions.flatMap(v=>v.sources))check(!parcels.some(p=>p.id===c.id),'VS cash cannot also pay in Big Bass collection');
      check(r.finalCash.beforeCap===sum(r.finalSources.map(p=>p.value)),'terminal cash only once');award(r.finalCash);
      let lineRaw=0;for(const [i,rows] of PAYLINES.entries()){const hit=lineHit(r.finalGrid,rows);if(!hit)continue;const m=Math.max(1,sum(r.after.filter(w=>w.reel<hit.n).map(w=>w.multiplier)));lineRaw+=Math.round(stake*hit.mult*m);}
      equal(lineRaw,r.lineBeforeCap,'paylines use additive VS multipliers');raw+=lineRaw;paid+=sum(r.lines.map(l=>l.pay));
      check(e.heldAfter.every(p=>!r.after.some(w=>w.reel===p.reel)),'no cash left inside a consumed VS reel');
      wilds=r.after;
    }else if(r.type==='tumble'){
      equal(r.globalBefore,lastGlobal,'board multiplier persists');
      equal(r.globalAfterDrop,Math.min(128,r.globalBefore+1),'Chopper boosts at spin start');
      for(const p of e.heldBefore){const cell=r.initial[p.reel][p.row];equal(cell.id,p.id,'locked cash stays on initial board');}
      const beforeCash=sum(e.heldBefore.map(p=>p.value)),afterCash=sum(r.afterDrop.flat().filter(c=>c.s==='brick').map(c=>Math.round(c.v*stake)));
      equal(afterCash,beforeCash+sum(r.dropped.map(p=>p.value)),'cash drop adds once, including top-ups');
      check(r.afterDrop.flat().filter(c=>c.s==='brick').length<=4,'four cash positions leave room for clusters');
      let board=r.afterDrop,global=r.globalAfterDrop;
      for(const cascade of r.cascades){
        equal(cascade.before,board,'cascade starts at previous board');
        const matches=connectedClusters(board);equal(matches,cascade.clusters.map(({symbol,cells})=>({symbol,cells})),'every connected win is recorded');
        for(const c of cascade.clusters){check(c.cells.length>=5,'minimum five connected');check(c.beforeCap===Math.round(stake*c.baseMultiple*c.multiple),'cluster payout');award(c);}
        for(let x=0;x<5;x++)for(let y=0;y<3;y++)if(board[x][y].s==='brick')equal(cascade.after[x][y],board[x][y],'cash does not move through tumble');
        for(const d of cascade.drops){check(d.fromRow<d.row,'gravity only moves down');if(!d.spawn)for(let row=Math.max(0,d.fromRow);row<d.row;row++)check(board[d.reel][row].s!=='brick','existing symbols cannot pass a lock');}
        equal(cascade.multiplierAfter,Math.min(128,global+1),'boost occurs after cascade');global=cascade.multiplierAfter;board=cascade.after;
      }
      equal(board,r.finalGrid,'final grid is final refill');
      if(!result.capped||!e.final)equal(connectedClusters(board).length,0,'non-capped tumble stops only on no wins');
      equal(r.finalCash.beforeCap,sum(r.finalSources.map(p=>p.value*p.multiplier)),'final cash uses final multiplier');award(r.finalCash);lastGlobal=r.globalAfter;
    }else{check(result.free.length===1,'Getaway exactly one result');check([0,25000*stake].includes(e.credited),'Getaway binary, no partial award');award(r.result);}
    equal(raw,e.beforeCap,'complete raw event ledger');equal(paid,e.credited,'complete credited event ledger');equal(spin.got,e.credited,'one spin credit');
    total+=paid;check(total<=room,'shared cap');held=e.heldAfter;
  }
  equal(total,result.total,'feature ledger equals payout');
}
for(const kind of ['yacht','route','getaway'])for(let seed=1;seed<=2000;seed++){
  const result=runReelFeature(kind,1000,seeded(seed),kind==='yacht'?18000000:25000000);generated++;inspect(kind,result);
  if(seed<5)equal(result,runReelFeature(kind,1000,seeded(seed),kind==='yacht'?18000000:25000000),'seeded replay is deterministic');
  const type=kind==='getaway'?(result.total?'getaway-max':'getaway-loss'):kind;
  if(!examples[type])examples[type]={seed,result};
  if(kind==='yacht'&&result.free.some(f=>f.mechanic.reel.conversions.length)&&result.free.some(f=>f.mechanic.reel.after.length>=2))examples['yacht-sticky-vs']??={seed,result};
  if(kind==='route'&&result.free.some(f=>f.mechanic.reel.cascades.length>=2))examples['route-multi-cascade']??={seed,result};
}
for(const kind of ['yacht','route']){const result=runReelFeature(kind,1000,()=>0,kind==='yacht'?18000000:25000000);inspect(kind,result);check(result.capped,'pathological repeated winners end at cap');examples[`${kind}-cap`]={seed:'constant-zero',result};}
check(noWinVsLandings>0,'VS persistence is exercised on non-winning spins, not only paid spins');
assert.throws(()=>playSplash(1000,'chopper',seeded(1)),/five scatters/);
check(runReelFeature('getaway',1000,()=>REEL_FEATURE_PROFILE.getawayWinChance,25000000).total===0,'binary threshold loss');
check(runReelFeature('getaway',1000,()=>REEL_FEATURE_PROFILE.getawayWinChance-1e-9,25000000).total===25000000,'binary threshold win');
let natural=null;
for(let seed=1;seed<=100000&&!natural;seed++){const round=playSplash(1000,'spin',seeded(seed));if(round.feature==='route')natural={seed,round};}
check(!!natural,'five-scatter feature is reachable from ordinary base generator');equal(natural.round.base.scatters,5,'exactly five scatters');
const rounds={};
for(const [name,{seed,result}] of Object.entries(examples)){
 const kind=name.startsWith('yacht')?'yacht':name.startsWith('route')?'route':'getaway';
 const mode=kind==='yacht'?'yacht':kind==='route'?'spin':'getaway';
 const empty=Array.from({length:5},()=>[{s:'J'},{s:'K'},{s:'A'}]);
 rounds[name]={version:4,feature:kind,mode,stake:1000,cost:splashCost(1000,mode),awarded:kind==='yacht'?15:kind==='route'?20:1,banked:0,payout:result.total,capped:result.capped,mods:[],base:{grid:empty,lines:[],scatters:kind==='route'?5:0,scatterPay:0},free:result.free};
}
rounds['natural-five-scatter']=natural.round;
let presentations=0;
for(const [name,round] of Object.entries(rounds))for(const speed of ['normal','turbo','super'])for(const skipAt of [Infinity,1,6,18]){
 let steps=0,last=0,spins=0,shown, hud;const before=JSON.stringify(round);
 const scene={setStake(){},setPace(){},setFeatureState(){},setMood(){},setCopy(){},setMeter(){},setTally(){},setLocks(){},finishPlate(){},intro:async()=>{},featureIntro:async()=>{steps++;},show:g=>shown=g,spinTo:async(g)=>{shown=g;spins++;steps++;},highlight:async(lines,cb)=>lines.forEach((l,i)=>cb?.(l,i)),reelFeatureStep:async(e,cb)=>{
   const r=e.reel;const award=a=>{if(steps<skipAt){cb.award(a);steps++;}};
   if(r.type==='vs'){r.conversions.forEach(c=>award(c.credited));award(r.collection.credited);award(r.finalCash.credited);r.lines.forEach(l=>award(l.pay));}
   if(r.type==='tumble'){r.cascades.forEach(c=>c.clusters.forEach(k=>award(k.credited)));award(r.finalCash.credited);}
   if(r.type==='binary')award(r.result.credited);
 }};
 await presentScript(scene,round,{turbo:speed!=='normal',speed,reduced:true,skipped:()=>steps>=skipAt,onHud:h=>{check(h.total>=last&&h.total<=round.payout,`${name} monotonic display credit`);last=h.total;hud=h;}});
 equal(hud.total,round.payout,'director final total');equal(shown,round.free.at(-1).mechanic.reel.finalGrid,'final/snap uses final tumble board');equal(JSON.stringify(round),before,'presentation cannot mutate result');
 if(name.startsWith('getaway')&&skipAt===Infinity)equal(spins,0,'Max uses one recorded horizontal strip and no ordinary vertical spin');presentations++;
}
const protectedFiles=['src/lib/kilo/bank.ts','src/components/kilo/layout.ts','src/components/slot-controls/layout.ts','src/components/slot-controls/tokens.ts','src/components/slot-controls/controls.css','src/components/kilo/modular-controls.css','src/components/slot-controls/SlotControls.tsx'];
for(const f of protectedFiles)equal(fs.readFileSync(f,'utf8'),execFileSync('git',['show',`3bfbb66:${f}`],{encoding:'utf8'}),`protected ${f}`);
fs.writeFileSync(`${outputDir}/replay-examples.json`,JSON.stringify(rounds,null,2)+'\n');
fs.mkdirSync('public/kilo-features-v54/replays',{recursive:true});
for(const name of ['yacht-sticky-vs','natural-five-scatter','route-multi-cascade','getaway-max','getaway-loss','route-cap']){
  fs.writeFileSync(`public/kilo-features-v54/replays/${name}.json`,JSON.stringify(rounds[name])+'\n');
}
fs.writeFileSync(`${outputDir}/logic-verification.json`,JSON.stringify({method:'Production math, event/director calls, source equality. No live browser or GPU rendering.',generated,assertions,presentations,noWinVsLandings,hiddenTriggerSeed:natural.seed,getawayExactRtp:.955,protectedFiles},null,2)+'\n');
console.log(`PASS ${assertions} logic invariants across ${generated} features; ${presentations} director/Skip/speed sequences; natural five-scatter seed ${natural.seed}.`);
