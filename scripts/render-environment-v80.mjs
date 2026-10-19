/** Production background painter, native offline Canvas. This is background
 * motion evidence, not a live browser recording or a full UI layout proof. */
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createOfflineRuntime,createCanvas,textureImage} from './offline-runtime-v79.mjs';
const r=createOfflineRuntime(),{paintFeatureEnvironment,compositeEnvironmentFrames}=r.load('src/components/kilo/feature-environment-painter.ts');
const {featureEnvironmentUrl}=r.load('src/components/kilo/feature-environments.ts');
const {ATMOSPHERE_URLS}=r.load('src/components/kilo/feature-atmosphere.ts');
const assets=Object.fromEntries(await Promise.all(Object.entries(ATMOSPHERE_URLS).map(async([k,u])=>[k,await textureImage(u)])));
const out='art/kilo-v80/environment';fs.mkdirSync(out,{recursive:true});
const only=process.env.KILO_ENV_MODE,size=process.env.KILO_ENV_SIZE,fps=30,seconds=6,rows=[];
const encoder=(id,w,h)=>{const ff=spawn('ffmpeg',['-v','error','-y','-f','rawvideo','-pix_fmt','rgba','-s',`${w}x${h}`,'-r',String(fps),'-i','pipe:0','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',`${out}/${id}.mp4`],{stdio:['pipe','inherit','inherit']});return {ff,finished:once(ff,'exit')};};
const write=async(ff,c,w,h)=>{const bytes=c.getImageData(0,0,w,h).data;if(!ff.stdin.write(Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength)))await once(ff.stdin,'drain');};
for(const [w,h]of[[1440,900],[390,844]])for(const scene of ['base','scatter-3','scatter-4','chopper','max-win']){
 if(only&&scene!==only||size&&`${w}x${h}`!==size)continue;
 const portrait=w<900,image=await textureImage(featureEnvironmentUrl(scene,portrait)),canvas=createCanvas(w,h),c=canvas.getContext('2d');
 const id=`${scene}-${w}x${h}`,{ff,finished}=encoder(id,w,h);
 for(let frame=0;frame<seconds*fps;frame++){
  paintFeatureEnvironment(c,image,scene,portrait,w,h,frame*1000/fps,false,assets);await write(ff,c,w,h);
 }
 ff.stdin.end();const[code]=await finished;if(code!==0)throw Error(`ffmpeg: ${id}`);
 rows.push({id,scene,viewport:[w,h],fps,durationMs:seconds*1000,fromClockMs:0,kind:'Production environment painter, background only'});
 console.log(`Rendered ${id}`);
}
if(!only&&!size){
 for(const[w,h]of[[1440,900],[390,844]]){
  const portrait=w<900,scenes=['base','scatter-3','scatter-4','chopper','max-win','base'];
  const images=await Promise.all(scenes.map(s=>textureImage(featureEnvironmentUrl(s,portrait))));
  const canvas=createCanvas(w,h),c=canvas.getContext('2d'),from=createCanvas(w,h),fc=from.getContext('2d'),to=createCanvas(w,h),tc=to.getContext('2d');
  const id=`state-dissolves-${w}x${h}`,{ff,finished}=encoder(id,w,h);let global=12000;
  for(let i=1;i<scenes.length;i++){
   paintFeatureEnvironment(fc,images[i-1],scenes[i-1],portrait,w,h,global,false,assets);
   for(let frame=0;frame<fps;frame++){
    const t=frame*1000/fps;paintFeatureEnvironment(tc,images[i],scenes[i],portrait,w,h,global+t,false,assets);
    compositeEnvironmentFrames(c,from,to,w,h,t);await write(ff,c,w,h);
   }global+=1000;
  }
  ff.stdin.end();const[code]=await finished;if(code!==0)throw Error(`ffmpeg: ${id}`);
  rows.push({id,viewport:[w,h],fps,durationMs:5000,kind:'Production scene dissolve compositor; all feature destinations and return to base'});console.log(`Rendered ${id}`);
 }
 fs.writeFileSync(`${out}/clips.json`,JSON.stringify({method:'Offline native Canvas rendering of the production environment painter and 420ms scene dissolve. No fake particles, guide animation, DOM or browser claims.',clips:rows},null,2)+'\n');
}
