/** Offline production background painter; actual camera and v63 actor.
 * Neutral reel/control silhouettes are scale/occlusion guides, NOT live UI. */
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createCanvas,textureImage} from './offline-pixi-painter.mjs';
import {loadProduction} from './kilo-v56-test-loader.mjs';
const {paintFeatureEnvironment,FEATURE_AMBIENT_LOOP_MS}=loadProduction('src/components/kilo/feature-environment-painter.ts');
const {FEATURE_ENVIRONMENTS,featureEnvironmentUrl}=loadProduction('src/components/kilo/feature-environments.ts');
const {ATMOSPHERE_URLS}=loadProduction('src/components/kilo/feature-atmosphere.ts');
const {fitGameLayout}=loadProduction('src/components/kilo/layout.ts');
const {integratedSceneCamera,integratedSceneUrl}=loadProduction('src/components/kilo/integrated-scene-model.ts');
const {sceneActorBox}=loadProduction('src/components/kilo/RiggedSceneActor.tsx');
const {STAGE_KING,stageKingFrameAt,paintStageKing}=loadProduction('src/components/kilo/stage-character-life.ts');
const output='art/kilo-v64/proofs';fs.mkdirSync(output,{recursive:true});
const body=await textureImage(STAGE_KING.image),actor=createCanvas(768,1152),ac=actor.getContext('2d');
const assets=Object.fromEntries(await Promise.all(Object.entries(ATMOSPHERE_URLS).map(async([key,url])=>[key,await textureImage(url)])));
const all=[];
for(const [W,H]of [[1440,900],[390,844]])for(const scene of Object.keys(FEATURE_ENVIRONMENTS)){
 const portrait=W<900,pad=portrait?12:24,l=fitGameLayout(W-pad*2,H-pad*2);
 const camera=integratedSceneCamera(l,{stageSize:{width:W-pad*2,height:H-pad*2},sourceSize:portrait?{width:1080,height:scene==='max-win'?2400:2402}:{width:1920,height:1080}});
 const box=sceneActorBox(camera.master,portrait),img=await textureImage(featureEnvironmentUrl(scene,portrait));
 const canvas=createCanvas(W,H),c=canvas.getContext('2d');
 const quality=Math.min(1,Math.sqrt(650000/(camera.width*camera.height)));
 const bg=createCanvas(Math.round(camera.width*quality),Math.round(camera.height*quality)),bc=bg.getContext('2d');
 const id=`${scene}-${W}x${H}`,stillsOnly=process.env.KILO_STILLS_ONLY==='1';
 const ff=stillsOnly?null:spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate','20','-i','pipe:0','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',`${output}/${id}.mp4`],{stdio:['pipe','inherit','inherit']});
 const finished=ff?once(ff,'exit'):null;
 for(let i=0;i<(stillsOnly?1:240);i++){
  const t=18000+i*50;paintFeatureEnvironment(bc,img,scene,portrait,bg.width,bg.height,t,false,assets);
  c.fillStyle='#06131b';c.fillRect(0,0,W,H);
  // Preserve the current live feature color treatment; no new grading.
  c.save();c.filter=scene==='scatter-4'?'brightness(.68) saturate(.72)':scene==='chopper'?'brightness(.60) saturate(.65) hue-rotate(8deg)':scene==='scatter-3'?'brightness(.62) saturate(.68)':'none';
  c.drawImage(bg,camera.left,camera.top,camera.width,camera.height);
  paintStageKing(ac,body,stageKingFrameAt(t),false);
  c.drawImage(actor,camera.left+box.left*camera.scale,camera.top+box.top*camera.scale,box.width*camera.scale,box.height*camera.scale);c.restore();
  const rx=(W-l.reelWidth)/2,ry=l.header;
  c.fillStyle='#061118';c.fillRect(rx,ry,l.reelWidth,l.reelHeight);c.strokeStyle='#947b4b';c.lineWidth=2;c.strokeRect(rx,ry,l.reelWidth,l.reelHeight);
  c.textAlign='center';c.fillStyle='#d8dfd9';c.font='700 15px "Source Sans 3"';c.fillText('UNCHANGED REEL AREA',W/2,ry+l.reelHeight/2);
  c.fillStyle='#030c12';c.fillRect(rx,ry+l.reelHeight,l.reelWidth,l.dock);c.fillStyle='#9db5b5';c.font='700 12px "Source Sans 3"';c.fillText('UNCHANGED CONTROL ALLOCATION',W/2,ry+l.reelHeight+l.dock/2);
  c.fillStyle='#061118';c.fillRect(0,H-49,W,49);c.fillStyle='#eddbb4';c.font='700 16px "Source Sans 3"';c.fillText(FEATURE_ENVIRONMENTS[scene].title+' · '+(t/1000).toFixed(1)+'s',W/2,H-28);
  c.fillStyle='#afc1c3';c.font='12px "Source Sans 3"';c.fillText('Offline painter · reel/control guides · '+W+' × '+H,W/2,H-10);
  const png=await canvas.encode('png');if(i===0)fs.writeFileSync(`${output}/${id}.png`,png);
  if(ff&&!ff.stdin.write(png))await once(ff.stdin,'drain');
 }
 if(ff){ff.stdin.end();const [code]=await finished;if(code!==0)throw Error('Encoder failed: '+id);}
 all.push({id,viewport:[W,H],scene,url:featureEnvironmentUrl(scene,portrait),crop:FEATURE_ENVIRONMENTS[scene][portrait?'portrait':'desktop'],camera,actor:box,durationMs:12000,ambientWindowMs:[18000,30000],loopMs:FEATURE_AMBIENT_LOOP_MS,fps:20});
 console.log(id);
}
fs.writeFileSync(`${output}/manifest.json`,JSON.stringify({method:'Offline shared production Canvas painter and source-derived camera; v63 character shown unchanged. Solid reel/control guides, not a live browser capture. Each 12-second clip samples ambient time 18–30s of a seamless 96-second cycle.',proofs:all},null,2)+'\n');
