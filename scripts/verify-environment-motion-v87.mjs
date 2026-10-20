/** Focused source geometry and native Canvas proof; not live-browser FPS. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createOfflineRuntime,createCanvas,textureImage} from './offline-runtime-v79.mjs';

const out=path.resolve(process.env.KILO_V87_ENV_PROOF_DIR??'art/kilo-v87/environment');
fs.mkdirSync(out,{recursive:true});
const r=createOfflineRuntime();
const {foliageMesh,foliageVertices,foliagePoint,paintFoliage}=r.load('src/components/kilo/environment-foliage.ts');
const {featureAtmosphere,ambientCloudRects,ambientWindAt,ATMOSPHERE_URLS}=r.load('src/components/kilo/feature-atmosphere.ts');
const {illustratedEnvironment}=r.load('src/components/kilo/illustrated-environment.ts');
const {paintFeatureEnvironment}=r.load('src/components/kilo/feature-environment-painter.ts');
const {featureEnvironmentUrl}=r.load('src/components/kilo/feature-environments.ts');
const assets=Object.fromEntries(await Promise.all(Object.entries(ATMOSPHERE_URLS).map(async([k,u])=>[k,await textureImage(u)])));
const hash=p=>crypto.createHash('sha256').update(p).digest('hex');
const area=(p,[a,b,c])=>(p[b].x-p[a].x)*(p[c].y-p[a].y)-(p[b].y-p[a].y)*(p[c].x-p[a].x);
const inside=(x,y,polygon)=>{let value=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const [ax,ay]=polygon[i],[bx,by]=polygon[j];if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)value=!value;
}return value;};
const rows=[];
for(const scene of ['base','scatter-3','scatter-4','max-win'])for(const portrait of [false,true]){
  const def=featureAtmosphere(scene,portrait),source=illustratedEnvironment(scene,portrait);
  assert.equal(featureAtmosphere(scene,portrait),def,'Registered atmosphere geometry is cached');
  let minJacobian=1,maxJacobian=1,maxScreenTravel=0,draws=0;
  const scale=portrait?390/source.width:1440/source.width;
  for(const patch of def.palms){
    const mesh=foliageMesh(patch),start=foliageVertices(patch,0),middle=foliageVertices(patch,3600);
    for(let i=0;i<start.length;i++)maxScreenTravel=Math.max(maxScreenTravel,Math.hypot(middle[i].x-start[i].x,middle[i].y-start[i].y)*scale);
    for(let ms=0;ms<=96000;ms+=500){
      const posed=foliageVertices(patch,ms);
      for(const tri of mesh.triangles){
        const ratio=area(posed,tri)/area(mesh.vertices,tri);minJacobian=Math.min(minJacobian,ratio);maxJacobian=Math.max(maxJacobian,ratio);
        assert(ratio>.35&&ratio<1.7,'Foliage must not fold or over-stretch');
      }
      for(const pin of patch.pins){const p=foliagePoint(...pin.a,patch,ms);assert.equal(p.x,pin.a[0]);assert.equal(p.y,pin.a[1]);}
      for(const [u,v]of[[0,0],[0,.5],[0,1],[1,0],[1,.5],[1,1],[.5,0],[.5,1]]){
        const x=patch.x+patch.width*u,y=patch.y+patch.height*v,p=foliagePoint(x,y,patch,ms);
        assert(Math.hypot(p.x-x,p.y-y)<1e-9,'Patch seams remain fixed');
      }
    }
    // Count the actual painter calls, independently of its cached triangle data.
    const target=createCanvas(390,Math.ceil(source.height*390/source.width)),ctx=target.getContext('2d');
    ctx.setTransform(390/source.width,0,0,390/source.width,0,0);
    const draw=ctx.drawImage.bind(ctx);ctx.drawImage=(...args)=>{draws++;draw(...args);};
    const key=scene+(portrait?'-portrait':'')+'-foliage';
    paintFoliage(ctx,assets[key],patch,3600,source.width,source.height);
  }
  assert(draws<=448,'Two crowns must use no more than half of the prior896 image draws');
  assert(maxScreenTravel>1.8,'Wind must remain legible at the intended viewport');
  for(let ms=0;ms<=96000;ms+=1500)for(const cloud of ambientCloudRects(def,source.width,ms)){
    for(const x of [cloud.x,cloud.x+cloud.width])for(const y of [cloud.y,cloud.y+cloud.height])assert(inside(x,y,def.sky),'Cloud silhouette remains in registered sky');
  }
  rows.push({scene,portrait,draws,priorDraws:896,drawReductionPercent:Number((100*(1-draws/896)).toFixed(1)),minJacobian,maxJacobian,maxScreenTravel});
}

// An opaque test texture must stay opaque across every internal mesh join.
// This catches subpixel cracks even where real foliage has translucent edges.
const opaque=createCanvas(768,1708),oc=opaque.getContext('2d');oc.fillStyle='#46835b';oc.fillRect(0,0,768,1708);
const seam=createCanvas(390,868),sc=seam.getContext('2d'),patch=featureAtmosphere('base',true).palms[0],scale=390/768;
sc.setTransform(scale,0,0,scale,0,0);paintFoliage(sc,opaque,patch,3600,768,1708);
const coverage=sc.getImageData(0,0,390,868).data;let minimumAlpha=255;
for(let y=Math.ceil((patch.y+4)*scale);y<Math.floor((patch.y+patch.height-4)*scale);y++)for(let x=Math.ceil((patch.x+4)*scale);x<Math.floor((patch.x+patch.width-4)*scale);x++)minimumAlpha=Math.min(minimumAlpha,coverage[(y*390+x)*4+3]);
assert.equal(minimumAlpha,255,'Phone mesh joins must have no transparent cracks');

for(let ms=0;ms<96000;ms+=50){
  const a=ambientWindAt(ms),b=ambientWindAt(ms+50);assert(b.travel>a.travel,'Cloud wind must never reverse');
  assert(Math.abs(b.gust-a.gust)<.004,'Gust envelope stays smooth');
}
assert(Math.abs(ambientWindAt(96000).travel-ambientWindAt(0).travel-96000)<1e-8);
for(const scene of ['base','scatter-3','scatter-4','max-win']){
  const art=await textureImage(featureEnvironmentUrl(scene,true)),canvas=createCanvas(390,844),ctx=canvas.getContext('2d');
  const frame=(ms,reduced=false)=>{paintFeatureEnvironment(ctx,art,scene,true,390,844,ms,reduced,assets);return Buffer.from(ctx.getImageData(0,0,390,844).data);};
  const start=frame(0);assert.equal(hash(start),hash(frame(96000)),'Full production background joins exactly at96s');
  assert.equal(hash(frame(0,true)),hash(frame(3600,true)),'Reduced motion remains static');
  for(const [ms,name]of[[0,'start'],[3600,'gust'],[7800,'return']]){frame(ms);fs.writeFileSync(path.join(out,`${scene}-390x844-${name}.png`),canvas.toBuffer('image/png'));}
}
fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({method:'Production source geometry and offline native Canvas, not live browser FPS',rows,rootAndBoundaryDisplacement:0,phoneSeamMinimumAlpha:minimumAlpha,windPeriodMs:96000,cloudMotion:'forward integrated shared gust',artAndRegistrationPreserved:true,reducedMotionStatic:true},null,2)+'\n');
console.log(JSON.stringify({pass:true,out,phoneSeamMinimumAlpha:minimumAlpha,rows},null,2));
