import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {loadProduction} from './kilo-v56-test-loader.mjs';
import {withoutV64BackgroundRouting} from './kilo-v64-source-guards.mjs';
const {boatPerformance}=loadProduction('src/components/kilo/max-boat-performance.ts');
const {vsPhysicalAt}=loadProduction('src/components/kilo/vs-encounter.ts');
const {stageKingFrameAt,STAGE_REACTION_MS}=loadProduction('src/components/kilo/stage-character-life.ts');
const {kingMeshPoint,KING_MESH_POINTS,KING_MESH_TRIANGLES}=loadProduction('src/components/kilo/stage-character-mesh.ts');
const from=boatPerformance('advance',1),to=boatPerformance('settle',0);
for(const key of Object.keys(from))assert(Math.abs(from[key]-to[key])<1e-10,`advance/brake continuous: ${key}`);
assert.deepEqual(boatPerformance('settle',1),boatPerformance('rest',1),'full stop has no residual drift/wake');
assert.deepEqual(boatPerformance('escape',0),boatPerformance('rest',1),'loss exit launches from rest without snapping');
let samples=0,minArea=Infinity,maxShift=0;
for(const kind of Object.keys(STAGE_REACTION_MS))for(let t=0;t<30000;t+=33){
 const f=stageKingFrameAt(t,t%2400, false,kind),moved=KING_MESH_POINTS.map(p=>kingMeshPoint(p.x,p.y,f));
 for(let i=0;i<moved.length;i++){const p=KING_MESH_POINTS[i],q=moved[i];if(p.y>=500)assert.deepEqual(q,p,'feet cannot move');maxShift=Math.max(maxShift,Math.hypot(p.x-q.x,p.y-q.y));}
 for(const [a,b,c] of KING_MESH_TRIANGLES){const area=points=>(points[b].x-points[a].x)*(points[c].y-points[a].y)-(points[b].y-points[a].y)*(points[c].x-points[a].x);const ratio=area(moved)/area(KING_MESH_POINTS);assert(ratio>.60&&ratio<1.5,'mesh cannot fold or tear');minArea=Math.min(minArea,ratio);}
 samples++;
}
for(const t of [0,.24,.36,.49,.60,.72,.82,.94,1])assert(Object.values(vsPhysicalAt(t)).every(Number.isFinite));
assert(vsPhysicalAt(.3).ready>.9);assert(vsPhysicalAt(.49).drive>.9);assert(vsPhysicalAt(.575).recoil>.9);assert(vsPhysicalAt(.83).resolve===1);
for(const [key,value]of Object.entries(vsPhysicalAt(1)))assert(Math.abs(value-(key==='resolve'?1:0))<1e-10,'VS settles exactly');
const oldFile=p=>execFileSync('git',['show',`794e886:${p}`],{encoding:'utf8'});
const motion='src/components/kilo/max-spin-motion.ts';assert.equal(fs.readFileSync(motion,'utf8'),oldFile(motion),'all segment distances and holds unchanged');
const effects=fs.readFileSync('src/components/kilo/reel-feature-effects.ts','utf8');
const spin='src/components/kilo/play.tsx';assert.equal(withoutV64BackgroundRouting(fs.readFileSync(spin,'utf8')).replace('            characterPaused={modalOpen || !booted}\n',''),oldFile(spin),'entire game UI and wallet flow frozen except allow-listed background wiring');
fs.writeFileSync('art/kilo-v63/physical-continuity.json',JSON.stringify({characterSamples:samples,minArea,maxShift,boat:['continuous advance to braking','continuous idle to escape','zero drift and wake after full stop'],vs:['ready','drive','recoil','lock','stable'],sourceGuards:['all Max distances/durations','entire play.tsx except character pause prop']},null,2)+'\n');
console.log(`PASS ${samples} character reaction samples, continuous boat phase boundaries, VS beat separation and protected game UI.`);
