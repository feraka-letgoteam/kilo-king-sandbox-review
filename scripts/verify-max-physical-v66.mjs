import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import {loadProduction} from './kilo-v56-test-loader.mjs';
const {boatPerformance}=loadProduction('src/components/kilo/max-boat-performance.ts');
const {maxBoatPlacement}=loadProduction('src/components/kilo/max-spin-motion.ts');
const {createMaxBoatRig}=loadProduction('src/components/kilo/max-boat-rig.ts');
const {stageKingFrameAt}=loadProduction('src/components/kilo/stage-character-life.ts');
const {kingMeshPoint,KING_MESH_POINTS,KING_MESH_TRIANGLES}=loadProduction('src/components/kilo/stage-character-mesh.ts');
const prior={};
const old=execFileSync('git',['show','f278e09:src/components/kilo/stage-character-life.ts'],{encoding:'utf8'});
new Function('require','exports',ts.transpileModule(old,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>id.endsWith('.json')?{default:JSON.parse(fs.readFileSync('public/kilo-v58/characters/king-stage.json'))}:loadProduction('src/components/kilo/'+id.replace('./','')),prior);
let otherSamples=0;
for(const kind of ['spin','vs','win'])for(let elapsed=0;elapsed<=30000;elapsed+=100)for(const age of [0,200,500,900,1500,Infinity]){
 assert.deepEqual(stageKingFrameAt(elapsed,age,false,kind),prior.stageKingFrameAt(elapsed,age,false,kind));otherSamples++;
}
const hold=boatPerformance('anticipate',.2),load=boatPerformance('anticipate',1),thrust=boatPerformance('advance',.4),brake=boatPerformance('advance',1),rest=boatPerformance('rest',1);
assert.deepEqual(hold,rest,'first anticipation interval is an unpowered hold');
assert(load.wake>=.7&&load.pitch>=.05,'wake/hull visibly load before translation');
assert(thrust.pitch<-.15&&thrust.driverLean<-.26&&thrust.wake>.9,'bow and rider change independently under thrust');
assert(brake.pitch>.08&&brake.driverLean>.2,'braking pose visibly opposes thrust');
assert(rest.wake===0&&rest.pitch===0&&rest.driverLean===0,'no residual motion at full stop');
const exit=boatPerformance('escape',.42);assert(exit.thrust===1&&exit.wake===1&&exit.pitch<-.16,'full thrust and trailing wake while still on stage');
const rig=createMaxBoatRig({source:{}},{source:{}}),nodes=[];
const visit=n=>{nodes.push(n);n.children.forEach(visit);};visit(rig.root);
const hull=nodes.find(n=>n.label==='getaway-hull').parent,driver=nodes.find(n=>n.label==='getaway-driver'),wake=nodes.find(n=>n.label==='getaway-propwash');
rig.pose('anticipate',.2);assert.equal(hull.rotation,0);assert.equal(wake.visible,false);
rig.pose('anticipate',1);const loadPose={x:rig.root.position.x,rotation:hull.rotation,wake:wake.alpha};
rig.pose('advance',.4);assert.equal(rig.root.position.x,loadPose.x,'rig motion is independent of translation');assert(hull.rotation<-.15&&driver.rotation<-.26&&wake.alpha>loadPose.wake);
rig.pose('advance',1);assert(hull.rotation>.08&&driver.rotation>.2);
rig.pose('settle',1);assert.equal(hull.rotation,0);assert.equal(driver.rotation,0);assert.equal(wake.visible,false);
assert(rig.root.children.indexOf(wake)>rig.root.children.findIndex(n=>n.label==='getaway-hull-immersion'),'immersion cannot hide the wake');
const pixelEvidence=[];
for(const width of [342,842]){
 const p=maxBoatPlacement(width,width*3/5,2,1600/960),scale=p.width/1600;
 const bowRise=(Math.sin(brake.pitch)-Math.sin(thrust.pitch))*600*scale;
 const riderSwing=(Math.sin(brake.pitch+brake.driverLean)-Math.sin(thrust.pitch+thrust.driverLean))*300*scale;
 const wakeBuild=150*load.wakeHeight*scale;
 assert(bowRise>19&&riderSwing>25&&wakeBuild>29,'readable phone-native physical change, not subpixel motion');
 pixelEvidence.push({boardWidth:width,bowRise,riderSwing,wakeBuild});
}
let minJacobian=Infinity,maxJacobian=0,maximumReaction=0;
for(const kind of ['max','max-stop'])for(let age=0;age<=1200;age+=10){
 const frame=stageKingFrameAt(18000+age,age,false,kind),idle=stageKingFrameAt(18000+age),moved=KING_MESH_POINTS.map(p=>kingMeshPoint(p.x,p.y,frame));
 for(const [i,p]of KING_MESH_POINTS.entries()){
  if(p.y>=500)assert.deepEqual(moved[i],p,'feet remain exactly planted');
  const q=kingMeshPoint(p.x,p.y,idle);maximumReaction=Math.max(maximumReaction,Math.hypot(moved[i].x-q.x,moved[i].y-q.y));
 }
 for(const ids of KING_MESH_TRIANGLES){
  const area=points=>{const[a,b,c]=ids.map(i=>points[i]);return(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);};
  const j=area(moved)/area(KING_MESH_POINTS);minJacobian=Math.min(minJacobian,j);maxJacobian=Math.max(maxJacobian,j);
  assert(j>.45&&j<1.8,`Max reaction mesh ${kind} at ${age}ms: ${j}`);
 }
}
assert(maximumReaction>20,'Max reaction exceeds the old nearly invisible deformation');
fs.writeFileSync('art/kilo-v66/physical-verification.json',JSON.stringify({otherSamples,pixelEvidence,minJacobian,maxJacobian,maximumReaction,poses:{hold,load,thrust,brake,rest,exit}},null,2)+'\n');
console.log(`PASS ${otherSamples} unchanged non-Max character frames; visible physical amplitudes; planted Max reactions without mesh folding.`);
