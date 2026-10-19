/** New drawing registration and mesh safety; no outcome or controller changes. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createOfflineRuntime} from './offline-runtime-v79.mjs';
const runtime=createOfflineRuntime();
const {STAGE_KING,stageKingFrameAt,STAGE_REACTION_MS}=runtime.load('src/components/kilo/stage-character-life.ts');
const {kingMeshPoint,KING_MESH_POINTS:source,KING_MESH_TRIANGLES:triangles}=runtime.load('src/components/kilo/stage-character-mesh.ts');
assert.deepEqual(STAGE_REACTION_MS,{spin:680,vs:960,'vs-win':760,'vs-loss':700,max:1040,'max-stop':1100,'max-loss':780,win:1100});
assert.deepEqual(STAGE_KING.anchors,{footBaseline:755.5,bodyCenter:{x:333,y:413},pelvis:{x:331,y:418},sternum:{x:353,y:229},neck:{x:357,y:176},headCenter:{x:354,y:127},rodGrip:{x:229,y:272}});
const area=(p,ids)=>{const[a,b,c]=ids.map(i=>p[i]);return(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);};
let min=Infinity,max=-Infinity,samples=0;
for(const kind of Object.keys(STAGE_REACTION_MS))for(let i=0;i<=100;i++){
 const ms=STAGE_REACTION_MS[kind]*i/100,frame=stageKingFrameAt(18000+ms,ms,false,kind);
 const points=source.map(p=>kingMeshPoint(p.x,p.y,frame));
 for(const [i,p]of source.entries()){
  assert(Number.isFinite(points[i].x)&&Number.isFinite(points[i].y));
  if(p.y>=500)assert.deepEqual(points[i],p,'Feet and lower body stay planted');
 }
 for(const ids of triangles){const ratio=area(points,ids)/area(source,ids);assert(ratio>.35&&ratio<1.75,'No fold or tear');min=Math.min(min,ratio);max=Math.max(max,ratio);}
 const reduced=stageKingFrameAt(18000+ms,ms,true,kind);
 for(const key of ['breath','nod','sway','look','rod','brace'])assert.equal(reduced[key],0);
 samples++;
}
const manifest=JSON.parse(fs.readFileSync('art/kilo-v79/characters/asset-manifest.json','utf8'));
for(const asset of manifest.assets)assert(fs.existsSync('public'+asset.url),asset.url);
assert.equal(manifest.assets.filter(a=>/\/(king|vice)-[1-5]\.webp$/.test(a.url)).length,10);
const report={pass:true,method:'Production mesh and asset registration, offline only',samples,minimumJacobian:min,maximumJacobian:max,unchangedReactionClocks:true,unchangedActorAnchors:true,plantedFeet:true,reducedMotionStill:true,independentWidthDrawings:10,totalAssetBytes:manifest.totalBytes};
fs.writeFileSync('art/kilo-v81/character-verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
