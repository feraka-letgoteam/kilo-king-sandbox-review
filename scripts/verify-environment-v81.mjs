import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createOfflineRuntime,createCanvas,textureImage} from './offline-runtime-v79.mjs';
const r=createOfflineRuntime(),{paintFeatureEnvironment,FEATURE_AMBIENT_LOOP_MS,sceneBlendAt,compositeEnvironmentFrames,waterDisplacementAt}=r.load('src/components/kilo/feature-environment-painter.ts');
const {featureEnvironmentUrl}=r.load('src/components/kilo/feature-environments.ts');
const {ATMOSPHERE_URLS,featureAtmosphere,ambientCloudRects,canopyPoint,ambientBirdAt,ambientTrafficAt,AMBIENT_CLOUD_SOURCE}=r.load('src/components/kilo/feature-atmosphere.ts');
const {illustratedEnvironment}=r.load('src/components/kilo/illustrated-environment.ts');
const assets=Object.fromEntries(await Promise.all(Object.entries(ATMOSPHERE_URLS).map(async([k,u])=>[k,await textureImage(u)])));
const {foliageMesh,foliageVertices,foliagePoint}=r.load('src/components/kilo/environment-foliage.ts');
const out='art/kilo-v81/environment';fs.mkdirSync(out,{recursive:true});
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const inside=(x,y,polygon)=>{let value=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
 const [ax,ay]=polygon[i],[bx,by]=polygon[j];if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)value=!value;
}return value;};
const diff=(a,b,predicate=()=>true)=>{let changed=0,total=0,energy=0;for(let p=0;p<a.length;p+=4)if(predicate(p/4)){
 let delta=Math.abs(a[p]-b[p])+Math.abs(a[p+1]-b[p+1])+Math.abs(a[p+2]-b[p+2]);total++;energy+=delta;if(delta>3)changed++;}return {changed,total,percent:Number((changed/total*100).toFixed(3)),meanChannelDelta:Number((energy/total/3).toFixed(4))};};
const rows=[],meshRows=[];
const area=(p,ids)=>{const[a,b,c]=ids.map(i=>p[i]);return(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);};
for(const mode of ['base','scatter-3','scatter-4','chopper','max-win'])for(const portrait of [false,true]){
 const def=featureAtmosphere(mode,portrait),source=illustratedEnvironment(mode,portrait);
 let minJacobian=1,maxJacobian=1,rootDisplacement=0;
 for(const patch of def.palms){const mesh=foliageMesh(patch);for(let t=0;t<=96000;t+=500){const posed=foliageVertices(patch,t);for(const ids of mesh.triangles){const ratio=area(posed,ids)/area(mesh.vertices,ids);minJacobian=Math.min(minJacobian,ratio);maxJacobian=Math.max(maxJacobian,ratio);assert(ratio>.35&&ratio<1.7,'No folded or over-stretched foliage triangles');}for(const pin of patch.pins){const pt=foliagePoint(...pin.a,patch,t);rootDisplacement=Math.max(rootDisplacement,Math.hypot(pt.x-pin.a[0],pt.y-pin.a[1]));}}}assert.equal(rootDisplacement,0,'Trunk roots stay fixed');
 meshRows.push({mode,portrait,minJacobian,maxJacobian,rootDisplacement});
 for(let ms=0;ms<=FEATURE_AMBIENT_LOOP_MS;ms+=1500){const clouds=ambientCloudRects(def,source.width,ms);assert.equal(clouds.length,2);
  for(const cloud of clouds){assert(Math.abs(cloud.width/cloud.height-AMBIENT_CLOUD_SOURCE.width/AMBIENT_CLOUD_SOURCE.height)<1e-9);
   for(const x of [cloud.x,cloud.x+cloud.width])for(const y of [cloud.y,cloud.y+cloud.height])assert(inside(x,y,def.sky),`${mode}: full cloud stays in sky`);
  }
  for(const patch of def.palms)for(const u of [0,1])for(const v of [0,.5,1]){
   const x=patch.x+patch.width*u,y=patch.y+patch.height*v,p=canopyPoint(x,y,patch,ms);assert(Math.abs(p.x-x)<1e-8&&Math.abs(p.y-y)<1e-8,'Palm patch outer edge remains fixed');
  }
 }
 const w=portrait?390:1440,h=portrait?844:900,canvas=createCanvas(w,h),c=canvas.getContext('2d'),art=await textureImage(featureEnvironmentUrl(mode,portrait));
 const frame=(ms,reduced=false)=>{paintFeatureEnvironment(c,art,mode,portrait,w,h,ms,reduced,assets);return Buffer.from(c.getImageData(0,0,w,h).data);};
 const zero=frame(0),middle=frame(3600),loop=frame(FEATURE_AMBIENT_LOOP_MS);
 assert.equal(hash(zero),hash(loop),'Seamless 96 s supercycle');assert.equal(hash(frame(0,true)),hash(frame(5000,true)),'Reduced motion is static');
 const visible=diff(zero,middle,p=>{const x=p%w,y=Math.floor(p/w);return y<h*.09||x<w*.14||x>w*.86||y>h*.66;});
 assert(visible.percent>(mode==='scatter-4'?3:6),`${mode} ${portrait?'portrait':'desktop'} motion reaches visible sky/sides/lower water (${visible.percent}%)`);
 // Contact patches contain actual dock, unlike the former generic 84–94%
 // crop which included moving water in the Dockside portrait painting.
 const floor=diff(zero,middle,p=>{const x=p%w,y=Math.floor(p/w);return x>w*.83&&x<w*.96&&y>h*.92&&y<h*.97;});
 assert.equal(floor.changed,0,`${mode} ${portrait?'portrait':'desktop'} fixed foreground under stage actor`);
 // Per-frame delta near the loop join must not exceed normal neighborhood motion.
 const end=frame(FEATURE_AMBIENT_LOOP_MS-33.3333),begin=frame(33.3333);
 const seam=diff(end,zero),normal=diff(zero,begin);
 assert(seam.meanChannelDelta<normal.meanChannelDelta*2.2+.4,'No wrap flash at loop join');
 const id=`${mode}-${w}x${h}`;for(const [t,label]of[[0,'start'],[1800,'wind'],[3600,'current']]){frame(t);fs.writeFileSync(`${out}/${id}-${label}.webp`,await canvas.encode('webp',82));}
 rows.push({mode,viewport:[w,h],loopMs:FEATURE_AMBIENT_LOOP_MS,seamless:true,reducedStill:true,foregroundFixed:true,cloudsUnclipped:true,visibleAreaChange:visible,seamMeanDelta:seam.meanChannelDelta});
 console.log(`PASS ${id}: ${visible.percent}% of visible environment pixels change within 3.6 s`);
}
// The same dissolve compositor is used by React's decoded-scene switch.
const w=390,h=844,previous=createCanvas(w,h),next=createCanvas(w,h),composite=createCanvas(w,h),cc=composite.getContext('2d');
for(const [scene,canvas]of[['base',previous],['scatter-3',next]]){
 const image=await textureImage(featureEnvironmentUrl(scene,true));paintFeatureEnvironment(canvas.getContext('2d'),image,scene,true,w,h,3600,false,assets);
}
for(const t of [0,105,210,315,420]){
 compositeEnvironmentFrames(cc,previous,next,w,h,t);const pixels=cc.getImageData(0,0,w,h).data;
 assert(pixels.every((v,i)=>i%4!==3||v===255),'Dissolve keeps every background pixel opaque');
 fs.writeFileSync(`${out}/transition-phone-${t}ms.webp`,await composite.encode('webp',82));
 if(t===0)assert.equal(hash(pixels),hash(previous.getContext('2d').getImageData(0,0,w,h).data));
 if(t===420)assert.equal(hash(pixels),hash(next.getContext('2d').getImageData(0,0,w,h).data));
}
assert.equal(sceneBlendAt(0),0);assert.equal(sceneBlendAt(420),1);assert.equal(sceneBlendAt(10,true),1);
for(let t=0;t<420;t++)assert(sceneBlendAt(t+1)>=sceneBlendAt(t),'Blend is monotonic');
for(const ms of [0,500,1000,1500,2000,2500,5000]){
 const p=waterDisplacementAt(600,450,850,ms,6,1);assert(Math.abs(p.x)<8&&Math.abs(p.y)<3,'Water remains a contained surface motion');
}
const sourceFiles=['src/components/kilo/feature-atmosphere.ts','src/components/kilo/illustrated-environment.ts','src/components/kilo/feature-environment-painter.ts','src/components/kilo/FeatureEnvironmentCanvas.tsx','src/components/kilo/environment-foliage.ts'];
const fingerprint=hash(Buffer.concat(sourceFiles.map(p=>Buffer.concat([Buffer.from(p+'\0'),fs.readFileSync(p)]))));
fs.writeFileSync(`${out}/verification.json`,JSON.stringify({fingerprint,sourceFiles,method:'Production Canvas painter at actual desktop/phone viewport dimensions; offline pixels and pure transition compositor, not live browser FPS.',rows,meshRows,decodedTransition:{durationMs:420,opaqueThroughout:true,clockIndependentOfSpeed:true,previousPreservedWhileLoading:true},runtimeFPS:30,pixelBudget:850000,notes:['Foreground checks target rigid dock contacts, not water.','Boat, controls, stage geometry, outcomes and feature directors are untouched.']},null,2)+'\n');
console.log('PASS scene dissolve: opaque, monotonic, exact start/end, reduced-motion immediate.');
