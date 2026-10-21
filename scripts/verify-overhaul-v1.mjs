import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createOfflineRuntime} from './offline-runtime-v79.mjs';

const baseline=JSON.parse(fs.readFileSync('art/kilo-overhaul-v1/protected-baseline.json','utf8'));
const checked=[];
for(const[file,hash]of Object.entries(baseline.files)){
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hash,file+' unchanged');checked.push(file);
}
const prior=file=>execFileSync('git',['show',baseline.checkpoint+':'+file],{encoding:'utf8',maxBuffer:32*1024*1024});
const stage=fs.readFileSync('src/components/kilo/pixiStage.ts','utf8'),old=prior('src/components/kilo/pixiStage.ts');
const take=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
assert.equal(take(stage,'function fitReels(','export async function mountScene'),take(old,'function fitReels(','export async function mountScene'),'Reel geometry byte identical');
assert.equal(take(stage,'    async collect(spin) {','    async tool(spin) {'),take(old,'    async collect(spin) {','    async tool(spin) {'),'Exact accepted collection sequence unchanged');
const actor=fs.readFileSync('src/components/kilo/RiggedSceneActor.tsx','utf8'),oldActor=prior('src/components/kilo/RiggedSceneActor.tsx');
assert.equal(take(actor,'export function sceneActorBox','export function RiggedSceneActor'),take(oldActor,'export function sceneActorBox','export function RiggedSceneActor'),'Actor CSS placement and fit unchanged');
const r=createOfflineRuntime(),king=r.load('src/components/kilo/overhaul-king.ts'),life=r.load('src/components/kilo/stage-character-life.ts');
const rig=JSON.parse(fs.readFileSync('public/kilo-overhaul-v1/king/manifest-part.json','utf8'));
const point=a=>({x:a[0],y:a[1]}),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);let samples=0,maxBoneError=0;
const inspect=(f,tool,reduced)=>{
 const p=king.overhaulKingPose(f,tool,reduced);
 for(const [name,chain]of[['R',p.right],['L',p.left]]){
  const j=rig.pivots,upper=distance(point(j['shoulder'+name]),point(j['elbow'+name])),lower=distance(point(j['elbow'+name]),point(j['wrist'+name]));
  for(const error of[Math.abs(distance(chain.root,chain.elbow)-upper),Math.abs(distance(chain.elbow,chain.end)-lower)]){assert(error<1e-8,'No stretched arm');maxBoneError=Math.max(error,maxBoneError);}
 }
 for(const side of['R','L'])assert(distance(p.legs[side].end,point(rig.pivots['ankle'+side]))<1e-8,'Planted ankle');
 for(const at of[p.hand,p.rodTip,p.neck,p.hip])assert(Number.isFinite(at.x)&&Number.isFinite(at.y));
 assert(p.rodTip.x>=-240&&p.rodTip.x<=576&&p.rodTip.y>=-200&&p.rodTip.y<=768,'Rod tip inside padded actor canvas');samples++;
};
for(const kind of Object.keys(life.STAGE_REACTION_MS))for(let n=0;n<=100;n++)inspect(life.stageKingFrameAt(18000,n/100*life.STAGE_REACTION_MS[kind],false,kind),null,false);
for(const kind of['cast','throw'])for(let n=0;n<=200;n++)inspect(life.stageKingFrameAt(18000),{kind,progress:n/200},false);
inspect(life.stageKingFrameAt(0,Infinity,true),null,true);
const clips=JSON.parse(fs.readFileSync('public/kilo-overhaul-v1/symbols/runtime-manifest.json','utf8'));
assert.equal(Object.keys(clips.symbols).length,15);assert.equal(Object.keys(clips.clips).length,30);assert.equal(Object.keys(clips.desktopClips).length,30);
for(const collection of[clips.clips,clips.desktopClips])for(const[id,c]of Object.entries(collection)){
 assert.equal(c.frames.length,id.endsWith('-landing')?12:24);assert(c.width<=2048&&c.height<=2048);assert.equal(c.reference.width,1024);assert.equal(c.reference.height,1024);
}
const report={checkpoint:baseline.checkpoint,protectedFiles:checked,reelsUnchanged:true,controlsUnchanged:true,exactCollectionUnchanged:true,actorLayoutUnchanged:true,rigSamples:samples,maxBoneError,constantBoneLengths:true,plantedAnkles:true,symbols:15,clipsPerResolution:30,limitations:['Source/CPU controller and asset checks; browser GPU performance and complete UI interaction require live review.','Layered raster skeletal performance, not an exported Spine project.']};
fs.mkdirSync('art/kilo-overhaul-v1/verification',{recursive:true});fs.writeFileSync('art/kilo-overhaul-v1/verification/protected-and-rig.json',JSON.stringify(report,null,2)+'\n');
console.log(`PASS ${checked.length} protected files, reel/actor layout and collection sequence; ${samples} fixed-bone/foot/rod samples;15symbols/60clips.`);
