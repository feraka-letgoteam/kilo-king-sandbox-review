import fs from 'node:fs';
import {createOfflineRuntime,createCanvas,textureImage} from './offline-runtime-v79.mjs';
const r=createOfflineRuntime(),{paintFeatureEnvironment}=r.load('src/components/kilo/feature-environment-painter.ts');
const {featureEnvironmentUrl}=r.load('src/components/kilo/feature-environments.ts'),{ATMOSPHERE_URLS}=r.load('src/components/kilo/feature-atmosphere.ts');
const {fitGameLayout}=r.load('src/components/kilo/layout.ts'),{integratedSceneCamera}=r.load('src/components/kilo/integrated-scene-model.ts');
const {sceneActorBox}=r.load('src/components/kilo/RiggedSceneActor.tsx'),{STAGE_KING}=r.load('src/components/kilo/stage-character-life.ts');
const assets=Object.fromEntries(await Promise.all(Object.entries(ATMOSPHERE_URLS).map(async([k,u])=>[k,await textureImage(u)]))),king=await textureImage(STAGE_KING.image);
const out='art/kilo-v80/environment';
for(const[w,h]of[[1440,900],[390,844]]){
 const portrait=w<900,pad=portrait?12:24,l=fitGameLayout(w-pad*2,h-pad*2),shellX=(w-l.width)/2;
 const camera=integratedSceneCamera(l,{stageSize:{width:w-pad*2,height:h-pad*2},sourceSize:portrait?{width:1080,height:2400}:{width:1920,height:1080}}),box=sceneActorBox(camera.master,portrait);
 const bg=createCanvas(Math.round(camera.width),Math.round(camera.height)),bc=bg.getContext('2d'),canvas=createCanvas(w,h),c=canvas.getContext('2d');
 const tileW=portrait?260:640,tileH=Math.round(h*tileW/w),sheet=createCanvas(tileW*2,tileH*5),sc=sheet.getContext('2d');
 for(const[i,mode]of['base','scatter-3','scatter-4','chopper','max-win'].entries()){
  const image=await textureImage(featureEnvironmentUrl(mode,portrait));
  for(const[j,ms]of[0,3600].entries()){
   c.fillStyle='#06131b';c.fillRect(0,0,w,h);paintFeatureEnvironment(bc,image,mode,portrait,bg.width,bg.height,ms,false,assets);
   c.drawImage(bg,shellX+camera.left,camera.top,camera.width,camera.height);
   // Conservative masks: even the gaps between the real modular controls are
   // covered here. The colored guides are explicitly not game UI artwork.
   const rx=shellX+l.artLeft,ry=l.header;c.fillStyle='#102832';c.fillRect(rx,ry,l.reelWidth,l.reelHeight);
   c.strokeStyle='#537e86';c.lineWidth=2;c.strokeRect(rx,ry,l.reelWidth,l.reelHeight);
   c.fillStyle='#091920';c.fillRect(rx,ry+l.reelHeight,l.reelWidth,l.dock);
   c.fillStyle='#bad1cf';c.textAlign='center';c.textBaseline='middle';c.font=`600 ${portrait?13:18}px sans-serif`;
   c.fillText('REEL OCCLUSION GUIDE',rx+l.reelWidth/2,ry+l.reelHeight/2);c.font=`600 ${portrait?11:14}px sans-serif`;
   c.fillText('CONTROL ALLOCATION',rx+l.reelWidth/2,ry+l.reelHeight+l.dock/2);
   c.drawImage(king,shellX+camera.left+box.left*camera.scale,camera.top+box.top*camera.scale,box.width*camera.scale,box.height*camera.scale);
   c.fillStyle='#06131b';c.fillRect(0,h-25,w,25);c.fillStyle='#d2dfd7';c.font='12px sans-serif';c.fillText(`${mode} • ${ms/1000}s • offline environment + static occlusion guides`,w/2,h-12);
   fs.writeFileSync(`${out}/visible-margins-${mode}-${w}x${h}-${ms}ms.webp`,await canvas.encode('webp',84));sc.drawImage(canvas,j*tileW,i*tileH,tileW,tileH);
  }
 }
 fs.writeFileSync(`${out}/visible-margins-${w}x${h}-contact.webp`,await sheet.encode('webp',85));
}
