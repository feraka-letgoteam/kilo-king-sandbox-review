import fs from 'node:fs';
import {createOfflineRuntime,createCanvas,textureImage} from './offline-runtime-v79.mjs';
const r=createOfflineRuntime(),{AUTHORED_CLIPS}=r.load('src/components/kilo/authored-clips.ts');
const {authoredFrameAt,authoredRegistration}=r.load('src/components/kilo/authored-animation.ts');
const rows=['entry-scatter-3','entry-scatter-4','entry-chopper','entry-god-mode','completion'];
const canvas=createCanvas(1440,1160),c=canvas.getContext('2d');c.fillStyle='#081b30';c.fillRect(0,0,1440,1160);
c.font='700 20px "Source Sans 3"';c.fillStyle='#fff1bd';c.fillText('Authored crest drawings · source registration · existing host clocks',24,28);
for(const[row,key]of rows.entries()){
 const clip=AUTHORED_CLIPS[key],image=await textureImage(clip.url);
 for(const[col,t]of [0,.3,.6,.9].entries()){
  const f=clip.frames[authoredFrameAt(clip,t)],at=authoredRegistration(clip,330,180),x=col*360+15,y=row*220+54;
  c.save();c.translate(x,y);c.drawImage(image,f.x,f.y,f.w,f.h,at.x,at.y,f.w*at.scale,f.h*at.scale);c.restore();
  c.font='600 15px "Source Sans 3"';c.fillStyle='#e6cf9f';c.fillText(`${key} · ${Math.round(t*100)}%`,x,y+195);
 }
}
fs.writeFileSync('art/kilo-v79/surfaces/authored-crest-sequences.webp',await canvas.encode('webp',93));
console.log('Saved source-registered four-drawing crest sequence review.');
