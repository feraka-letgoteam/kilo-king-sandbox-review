/** Presentation regression: continuous physics, finite impacts and planted feet. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createOfflineRuntime} from './offline-runtime-v77.mjs';
import {sourceFingerprint} from './v77-source-fingerprint.mjs';
const runtime=createOfflineRuntime(),load=runtime.load;
const {godCardPose:pose,godCardTravel:travel,GOD_CARD_CLOCK}=load('src/components/kilo/god-card-motion.ts');
const {paintGodWater}=load('src/components/kilo/god-water-performance.ts');
const {vsPhysicalAt}=load('src/components/kilo/vs-encounter.ts');
const {vsMergeAt,vsMultiplierPunch,VS_MERGE_MS}=load('src/components/kilo/vs-merge-motion.ts');
const {vsConnectionMultiplierScale}=load('src/components/kilo/vs-group-art.ts');
const {stageKingFrameAt,STAGE_REACTION_MS}=load('src/components/kilo/stage-character-life.ts');
const {kingMeshPoint,KING_MESH_POINTS,KING_MESH_TRIANGLES}=load('src/components/kilo/stage-character-mesh.ts');
const checkpoint='01c5af4cba72d4f40d9af5e95d4384a0be05bb4b';
const changed=[...new Set([
  ...execFileSync('/usr/bin/git',['diff',checkpoint,'--name-only','--','src'],{encoding:'utf8'}).trim().split('\n'),
  ...execFileSync('/usr/bin/git',['ls-files','--others','--exclude-standard','--','src'],{encoding:'utf8'}).trim().split('\n'),
].filter(Boolean))].sort();
const allowed=['god-card-motion.ts','god-card-performance.ts','god-water-performance.ts','vs-merge-motion.ts','vs-group-art.ts','vs-encounter.ts','reel-feature-effects.ts','stage-character-life.ts','RiggedSceneActor.tsx'].map(n=>'src/components/kilo/'+n);
assert(changed.every(file=>allowed.includes(file)),'Only the approved animation files change');
// Exact guards include the already approved v77 group products, recorded
// outcomes, RNG, wallet, controls, geometry, backgrounds and every runtime asset.
for(const area of ['src/lib','src/components/slot-controls','public'])
  assert.equal(execFileSync('/usr/bin/git',['diff',checkpoint,'--name-only','--',area],{encoding:'utf8'}).trim(),'');
assert.deepEqual(GOD_CARD_CLOCK,{anticipation:[440,460,500,560,760],advance:[430,430,460,490,580],settle:[170,170,190,210,380],rest:[60,60,70,80,120],stall:420,overshoot:690,impact:260,resultHold:520,release:160});
assert.equal(VS_MERGE_MS,760);
let prior=-1;
for(let i=0;i<=1000;i++){const x=travel(i/1000);assert(x>=prior&&x>=0&&x<=1.0000001);prior=x;}
for(const t of [.24,.62]){const e=1e-5,left=(travel(t)-travel(t-e))/e,right=(travel(t+e)-travel(t))/e;assert(Math.abs(left-right)<.001,'No velocity snap');}
for(const [before,after] of [['anticipate','advance'],['advance','settle'],['settle','rest'],['anticipate','overshoot'],['overshoot','stall'],['stall','result']])
  for(const key of ['pitch','lean','heave','surge','wake','wakeLength','spray'])assert(Math.abs(pose(before,1)[key]-pose(after,0)[key])<1e-8,`${before}→${after}: ${key}`);
assert.deepEqual(pose('anticipate',0),pose('anticipate',.24),'Hold before build');
assert(pose('anticipate',.9).wake>.5);assert(pose('advance',.3).pitch<-.15);assert(pose('advance',.3).lean<-.26);
assert(pose('stall',.2).pitch>.16&&pose('stall',.2).surge< -25,'Decisive hull stall');
for(const t of [0,.1,.4,.9,1]){const foam=new runtime.pixi.Graphics(),bow=new runtime.pixi.Graphics();paintGodWater(foam,bow,pose('result',t),{x:100,y:200},{x:300,y:200},400,240,t);assert.equal(foam.ops.length,0);assert.equal(bow.ops.length,0);}
const contactA=vsPhysicalAt(.49),contactB=vsPhysicalAt(.52);
assert.equal(contactA.drive,1);assert.equal(contactB.drive,1);assert.equal(contactA.recoil,0);assert.equal(contactB.recoil,0);
assert(vsMultiplierPunch(.4)>=1.24);assert(vsMultiplierPunch(.1)<1);assert.equal(vsMultiplierPunch(1),1);
assert.equal(vsConnectionMultiplierScale(1,1),1);assert.equal(vsConnectionMultiplierScale(.9,.4,true),1);
assert(Math.abs(vsMergeAt(1).seam)<1e-12);assert.equal(vsMergeAt(.4,true).productScale,1);
let minimumJacobian=Infinity,maximumJacobian=-Infinity,reactionSamples=0,maximumUpperDisplacement=0;
for(const kind of ['max','max-stop','max-loss','vs-win','vs-loss'])for(let i=0;i<=100;i++){
  const ms=STAGE_REACTION_MS[kind]*i/100,frame=stageKingFrameAt(18000+ms,ms,false,kind);
  const points=KING_MESH_POINTS.map(p=>kingMeshPoint(p.x,p.y,frame));
  for(const [j,p]of KING_MESH_POINTS.entries()){
    assert(Number.isFinite(points[j].x)&&Number.isFinite(points[j].y));
    if(p.y>=500)assert.deepEqual(points[j],p,'Feet stay planted');
    maximumUpperDisplacement=Math.max(maximumUpperDisplacement,Math.hypot(points[j].x-p.x,points[j].y-p.y));
  }
  const area=(list,ids)=>{const[a,b,c]=ids.map(n=>list[n]);return(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);};
  for(const ids of KING_MESH_TRIANGLES){const ratio=area(points,ids)/area(KING_MESH_POINTS,ids);assert(ratio>.35&&ratio<1.75,'No flipped or torn character mesh');minimumJacobian=Math.min(minimumJacobian,ratio);maximumJacobian=Math.max(maximumJacobian,ratio);}
  reactionSamples++;
}
for(const kind of ['max-loss','vs-win','vs-loss']){
  const settled=stageKingFrameAt(5000,STAGE_REACTION_MS[kind],false,kind),idle=stageKingFrameAt(5000,Infinity);
  for(const key of Object.keys(idle))assert(settled[key]===idle[key],'Reaction settles back to uninterrupted idle');
  const still=stageKingFrameAt(5000,300,true,kind);for(const key of ['breath','nod','sway','look','rod','brace'])assert.equal(still[key],0);
}
const report={checkpoint,sourceFingerprint:sourceFingerprint(),method:'Actual source curve/mesh tests plus exact Git guards. Not browser evidence.',changed,unchangedAreas:['src/lib','src/components/slot-controls','public'],clocksUnchanged:true,anticipationHold:true,continuousTravelAndPoses:true,finiteWake:true,vsContactHold:true,multiplierSettle:true,reactionSamples,minimumJacobian,maximumJacobian,maximumUpperDisplacement};
fs.mkdirSync('art/kilo-v78',{recursive:true});fs.writeFileSync('art/kilo-v78/animation-verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:true,reactionSamples,minimumJacobian,maximumJacobian,maximumUpperDisplacement}));
