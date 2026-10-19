import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import {loadProduction} from './kilo-v56-test-loader.mjs';
const {getawayMotionAt,vsMotionAt,GETAWAY_ART}=loadProduction('src/components/kilo/feature-motion.ts');
const {fitGameLayout}=loadProduction('src/components/kilo/layout.ts');
const stage=fs.readFileSync('src/components/kilo/pixiStage.ts','utf8');
const code=stage.slice(stage.indexOf('function edgeFor('),stage.indexOf('function geomFor('));
const fit=new Function(ts.transpile(code,{target:ts.ScriptTarget.ESNext})+';return fitReels;')();
const boat=JSON.parse(fs.readFileSync('public/kilo-v56/vehicles/manifest.json')).boat;
const {timedPerformanceFrameAt}=loadProduction('src/components/kilo/rig-performance.ts');
const {createReelFeatureEffects}=loadProduction('src/components/kilo/reel-feature-effects.ts');
const {Container}=await import('./reel-renderer-mocks-v52.mjs');
let checks=0;const check=(v,m)=>{assert(v,m);checks++;};const layouts=[];
for(const [W,H]of[[360,800],[390,844],[844,390],[1440,900]]){
 const pad=W<900?12:24,l=fitGameLayout(W-2*pad,H-2*pad),g=fit(Math.round(l.reelWidth),Math.round(l.reelHeight));
 const w=5*g.cell+4*g.gap,s=g.cell*GETAWAY_ART.widthCells/576;
 let previous=-Infinity;
 for(let i=0;i<=100;i++){
  const t=i/100,m=getawayMotionAt(t,true),loss=getawayMotionAt(t,false);
  check(m.center>=previous,'boat travels left to right only');previous=m.center;
  if(t>=.64){check(m.center===.5&&m.stopped,'winning boat stays stopped');
   const f=boat.frames[timedPerformanceFrameAt(t,boat.frames.map(f=>f.durationMs))],b=f.visibleBounds;
   const x=g.gx+w*m.center,y=g.gy+g.cell*GETAWAY_ART.centerYCells;
   check(x+(b[0]-288)*s>=g.gx&&x+(b[2]-288)*s<=g.gx+w,'whole visible boat within stage after stop');
   check(y+(b[1]-187)*s>=g.gy&&y+(b[3]-187)*s<=g.gy+g.cell*3,'boat vertical alpha inside stage');
  }
  check(!loss.stopped,'loss never implies a max-win stop');
  const vs=vsMotionAt(t);check(Object.values(vs).every(n=>typeof n==='boolean'||(Number.isFinite(n)&&n>=0&&n<=1)),'bounded VS phases');
 }
 const last=boat.frames[7].visibleBounds,bottom=g.gy+g.cell*GETAWAY_ART.centerYCells+(last[3]-187)*s;
 const awardTop=g.gy+g.cell*GETAWAY_ART.awardYCells,awardHeight=g.cell*GETAWAY_ART.awardHeightCells;
 const numberSize=Math.max(24,g.cell*.40),captionSize=Math.max(11,g.cell*.13);
 check(awardTop>bottom+3,'award plaque clears the stopped boat');
 check(awardHeight*(.82-.32)-(numberSize+captionSize)/2>=0,'award and max-win caption have distinct text lines');
 layouts.push({viewport:[W,H],boatBottom:bottom,awardTop,clearance:awardTop-bottom});
}
check(getawayMotionAt(0,true,true).center===.5,'reduced motion shows stable winning result');
check(getawayMotionAt(1,false).center===1.5,'loss exits on the right');
// Exercise production resize DURING the new stop/award/transfer, plus all speeds.
const rounds=JSON.parse(fs.readFileSync('art/kilo-features-v54/replay-examples.json'));
let runs=0;
for(const name of ['getaway-max','getaway-loss'])for(const speed of ['normal','turbo','super'])for(const reduced of [false,true]){
 const round=rounds[name],e=round.free[0].mechanic,world=new Container(),host=new EventTarget();let g=fit(336,202),paid=0,dom=[];
 globalThis.document={body:{appendChild:n=>dom.push(n)},createElement:()=>({style:{},offsetHeight:28,remove(){dom=dom.filter(n=>n!==this);}})};
 let stoppedNodes=0;
 const walk=n=>{if(n.label==='getaway-stopped-boat'){stoppedNodes++;check(Math.abs(n.position.x-(g.gx+(g.cell*5+g.gap*4)/2))<.001,'stopped boat relayout uses current center');}n.children.forEach(walk);};
 const ctl=createReelFeatureEffects({host,world,geom:()=>g,cell:()=>new Container(),show(){},stake:()=>round.stake,pace:()=>({speed,reduced}),live:()=>true,
 collect:async()=>{},highlight:async()=>{},readout(){},screen:(x,y)=>({x,y}),landing:()=>({x:180,y:300}),bankCue(){check(dom.length===0,'travelling award removed before meter commit');},
 hold:async()=>{host.dispatchEvent(new Event('kilo-relayout'));walk(world);},tween:async(ms,draw)=>{for(const t of [0,.25,.64,.85,1]){draw(t);g=t<.8?fit(366,220):fit(336,202);host.dispatchEvent(new Event('kilo-relayout'));walk(world);}}
 });
 ctl.set(e,'before');await ctl.step(e,{award:n=>paid+=n,state(){}});check(paid===e.credited,'exact recorded award');
 ctl.set(e,'after');host.dispatchEvent(new Event('kilo-relayout'));walk(world);
 check((stoppedNodes>0)===e.reel.won,'only recorded max retains boat');
 ctl.set(null);check(world.children[0].children[0].children.length===0,'stop image does not leak into next round');ctl.destroy();runs++;
}
const protectedFiles=['src/lib/kilo/bank.ts','src/lib/kilo/engine.ts','src/lib/kilo/feature-math.ts','src/lib/kilo/reel-feature-math.ts','src/components/kilo/layout.ts','src/components/kilo/brand-layout.ts','src/components/kilo/brand-v55.css','src/components/slot-controls/layout.ts','src/components/slot-controls/tokens.ts','src/components/slot-controls/controls.css','src/components/slot-controls/SlotControls.tsx','src/components/kilo/modular-controls.css','src/components/kilo/fish-art.ts','src/components/kilo/art-map.ts'];
for(const file of protectedFiles){assert.equal(fs.readFileSync(file,'utf8'),execFileSync('git',['show',`4e910c2:${file}`],{encoding:'utf8'}),file);checks++;}
fs.writeFileSync('art/kilo-v58/contract-verification.json',JSON.stringify({method:'Actual motion curves, alpha bounds, production controller resize checks and protected source equality. CSS dimensions are source-derived, not browser measurements.',checks,runs,layouts,protectedFiles},null,2)+'\n');
console.log(`PASS ${checks} motion/bounds/source assertions and ${runs} result/transfer resize cases.`);
