import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createOfflineRuntime,createCanvas,textureImage} from './offline-runtime-v79.mjs';
import {sourceFingerprint} from './v79-source-fingerprint.mjs';
const r=createOfflineRuntime(),{paintFeatureEnvironment,FEATURE_AMBIENT_LOOP_MS}=r.load('src/components/kilo/feature-environment-painter.ts');
const {featureEnvironmentUrl}=r.load('src/components/kilo/feature-environments.ts');
const {ATMOSPHERE_URLS,featureAtmosphere,ambientCloudRects}=r.load('src/components/kilo/feature-atmosphere.ts');
const {illustratedEnvironment}=r.load('src/components/kilo/illustrated-environment.ts');
const assets=Object.fromEntries(await Promise.all(Object.entries(ATMOSPHERE_URLS).map(async([k,u])=>[k,await textureImage(u)])));
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const rows=[];
const inside=(x,y,polygon)=>{let value=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
 const [ax,ay]=polygon[i],[bx,by]=polygon[j];if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)value=!value;
}return value;};
for(const mode of ['base','scatter-3','scatter-4','chopper','max-win'])for(const portrait of [false,true]){
 const def=featureAtmosphere(mode,portrait),source=illustratedEnvironment(mode,portrait);
 for(let ms=0;ms<=FEATURE_AMBIENT_LOOP_MS;ms+=3000){const clouds=ambientCloudRects(def,source.width,ms);assert.equal(clouds.length,2);
  for(const cloud of clouds){assert(Math.abs(cloud.width/cloud.height-3)<1e-9,'Cloud drawing keeps its authored aspect ratio');
   for(const x of [cloud.x,cloud.x+cloud.width])for(const y of [cloud.y,cloud.y+cloud.height])assert(inside(x,y,def.sky),`${mode}: complete cloud stays inside sky instead of clipping at its edge`);
  }
 }
 const w=portrait?180:640,h=portrait?400:360,canvas=createCanvas(w,h),c=canvas.getContext('2d'),art=await textureImage(featureEnvironmentUrl(mode,portrait));
 const frame=(ms,reduced=false)=>{paintFeatureEnvironment(c,art,mode,portrait,w,h,ms,reduced,assets);return Buffer.from(c.getImageData(0,0,w,h).data);};
 const zero=frame(0),middle=frame(6000),loop=frame(FEATURE_AMBIENT_LOOP_MS);
 assert.equal(hash(zero),hash(loop),'seamless environment loop');assert.notEqual(hash(zero),hash(middle),'visible environmental motion');
 assert.equal(hash(frame(0,true)),hash(frame(6000,true)),'reduced motion still');
 const contact=(data)=>{const bytes=[];for(let y=Math.round(h*.84);y<Math.round(h*.94);y++)for(let x=Math.round(w*.80);x<Math.round(w*.97);x++){const at=(y*w+x)*4;bytes.push(...data.subarray(at,at+4));}return hash(Buffer.from(bytes));};
 assert.equal(contact(zero),contact(middle),`${mode} ${portrait?'portrait':'desktop'} foreground under boots remains rigid`);
 rows.push({mode,portrait,loopMs:FEATURE_AMBIENT_LOOP_MS,seamless:true,motionVisible:true,reducedStill:true,foregroundFixed:true,wholeCloudSilhouettes:true});
}
const {godCardPose}=r.load('src/components/kilo/god-card-motion.ts');
for(const[a,b]of[['anticipate','advance'],['anticipate','stall'],['advance','settle'],['overshoot','stall']]){
 const from=godCardPose(a,1),to=godCardPose(b,0);for(const key of ['pitch','lean','heave','surge','wake','wakeLength','spray'])assert(Math.abs(from[key]-to[key])<1e-8,`${a} to ${b}: ${key}`);
}
for(const beat of ['settle','stall','result']){const p=godCardPose(beat,1);for(const key of ['pitch','lean','heave','surge','wake','spray'])assert(Math.abs(p[key])<1e-10,`${beat} ends stable`);}
const report={sourceFingerprint:sourceFingerprint(),method:'Production environment painter at both source aspect ratios; pixel comparison, not browser performance.',rows,boatPoseJoinsContinuous:true,boatEndsStable:true};
fs.writeFileSync('art/kilo-v79/ambient-verification.json',JSON.stringify(report,null,2)+'\n');console.log('PASS 10 ambient loops, foreground grounding, reduced motion and continuous boat pose joins.');
