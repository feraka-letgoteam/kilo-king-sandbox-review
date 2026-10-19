/** Actual production mesh, face registration, clock and measured scene placement.
 * Offline Canvas; the board/readouts are a neutral scale guide, not live UI. */
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createCanvas,textureImage} from './offline-pixi-painter.mjs';
import {loadProduction} from './kilo-v56-test-loader.mjs';
const {STAGE_KING,createStageKingPlayback,paintStageKing}=loadProduction('src/components/kilo/stage-character-life.ts');
const {fitGameLayout}=loadProduction('src/components/kilo/layout.ts');
const {sceneActorBox}=loadProduction('src/components/kilo/RiggedSceneActor.tsx');
const {integratedSceneCamera,INTEGRATED_SCENES}=loadProduction('src/components/kilo/integrated-scene-model.ts');
const out='art/kilo-v63/proofs',temp='/tmp/kilo-v63-character-frames';fs.mkdirSync(temp,{recursive:true});
const body=await textureImage(STAGE_KING.image),eyes=await textureImage(STAGE_KING.blink.image),brow=await textureImage(STAGE_KING.reaction.image);
const source=createCanvas(1024,1536),sc=source.getContext('2d'),actor=createCanvas(768,1152),ac=actor.getContext('2d');
for(const [W,H]of [[1440,900],[390,844]]){
 const id=`character-${W}x${H}`,pad=W<900?12:24,l=fitGameLayout(W-pad*2,H-pad*2);
 const camera=integratedSceneCamera(l,{stageSize:{width:W-pad*2,height:H-pad*2}}),box=sceneActorBox(camera.master,camera.portrait);
 const rect={x:camera.left+box.left*camera.scale,y:camera.top+box.top*camera.scale,width:box.width*camera.scale,height:box.height*camera.scale};
 const definition=INTEGRATED_SCENES.base[camera.portrait?'portraitCharacter':'desktopCharacter'];
 const bg=await textureImage(definition.cleanUrl),canvas=createCanvas(W,H),c=canvas.getContext('2d'),playback=createStageKingPlayback();
 const timeline=[{ms:4000,kind:'spin'},{ms:6000,kind:'vs'},{ms:8000,kind:'max'},{ms:10000,kind:'win'}];
 let lastFace='',eventIndex=0;
 for(let i=0;i<390;i++){
  const t=i*1000/30;
  if(eventIndex<timeline.length&&t>=timeline[eventIndex].ms){const event=timeline[eventIndex++];playback.react(`${event.kind}:${i}`,event.kind);}
  const f=playback.advance(i?1000/30:0);
  if(f.blink!==lastFace){lastFace=f.blink;sc.clearRect(0,0,1024,1536);sc.drawImage(body,0,0);
   if(f.blink!=='open'){const frame=f.blink==='brow'?STAGE_KING.reaction.frame:STAGE_KING.blink.frames[f.blink],to=STAGE_KING.blink.imageTarget;
    sc.clearRect(to.x,to.y,to.width,to.height);sc.drawImage(f.blink==='brow'?brow:eyes,frame.x,frame.y,frame.width,frame.height,to.x,to.y,to.width,to.height);}}
  paintStageKing(ac,source,f);
  c.fillStyle='#06131b';c.fillRect(0,0,W,H);
  c.drawImage(bg,camera.left,camera.top,camera.master.width*camera.scale,camera.master.height*camera.scale);
  // Fixed game rectangle is only a placement guide, not a replacement UI.
  const rw=l.reelWidth,rh=l.reelHeight,rx=(W-rw)/2,ry=l.header;
  c.fillStyle='#071820';c.fillRect(rx,ry,rw,rh);c.strokeStyle='#977e4c';c.lineWidth=2;c.strokeRect(rx,ry,rw,rh);
  c.textAlign='center';c.fillStyle='#adbbb9';c.font='700 15px "Source Sans 3"';c.fillText('REEL AREA · UNCHANGED',W/2,ry+rh/2);
  c.drawImage(actor,rect.x,rect.y,rect.width,rect.height);
  c.fillStyle='#071820';c.fillRect(0,H-43,W,43);c.fillStyle='#fff4dc';c.font='700 16px "Source Sans 3"';
  c.fillText(`${(t/1000).toFixed(1)}s · ${eventIndex?timeline[eventIndex-1].kind.toUpperCase()+' → IDLE':'BREATHING'}`,W/2,H-24);
  c.font='12px "Source Sans 3"';c.fillStyle='#a9bec1';c.fillText('Offline production painter · actual actor size',W/2,H-8);
  const filename=`${temp}/${id}-${String(i).padStart(4,'0')}.png`;fs.writeFileSync(filename,await canvas.encode('png'));
  if([0,57,129,189,249,309].includes(i))fs.copyFileSync(filename,`${out}/${id}-${i}.png`);
 }
 execFileSync('ffmpeg',['-v','error','-y','-framerate','30','-i',`${temp}/${id}-%04d.png`,'-c:v','libx264','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',`${out}/${id}.mp4`]);
 for(const f of fs.readdirSync(temp))if(f.startsWith(id+'-'))fs.unlinkSync(`${temp}/${f}`);
 fs.writeFileSync(`${out}/${id}-timeline.json`,JSON.stringify({method:'Offline actual production mesh and clock. Background and scene camera; neutral board guide, not live UI.',viewport:[W,H],actor:rect,fps:30,duration:13,timeline},null,2)+'\n');
 console.log(id+' 390 frames');
}
