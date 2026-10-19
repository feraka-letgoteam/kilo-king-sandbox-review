/** Asset-stage proofs only. Executes the runtime AuthoredClip sampler and
 * registration; not a browser, full game, WebGL or audio capture. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {createOfflineRuntime} from './offline-runtime-v79.mjs';
const output='art/kilo-v82/symbols';fs.mkdirSync(output,{recursive:true});
const runtime=createOfflineRuntime();
const {AUTHORED_CLIPS}=runtime.load('src/components/kilo/authored-clips.ts');
const {authoredFrameAt,authoredRegistration}=runtime.load('src/components/kilo/authored-animation.ts');
const symbolKeys=['sym-cash-roll','sym-reel-v8','sym-case-v8','package-small','package-medium','package-trophy','package-king'];
const surfaceKeys=['entry-scatter-3','entry-scatter-4','retrigger','completion'];
const names={'sym-cash-roll':'Paper fan','sym-reel-v8':'Line tension','sym-case-v8':'Hinges + lure','package-small':'Bag crinkle','package-medium':'Tape response','package-trophy':'Stack weight','package-king':'Cargo settle','entry-scatter-3':'Dock entry','entry-scatter-4':'VS ready / recoil',retrigger:'Retrigger',completion:'Completion'};
const assets=new Map();
for(const key of [...symbolKeys,...surfaceKeys])assets.set(key,await loadImage('public'+AUTHORED_CLIPS[key].url));
const text=(c,s,x,y,size=16,color='#fff3d6')=>{c.font=`600 ${size}px sans-serif`;c.fillStyle=color;c.textAlign='center';c.textBaseline='middle';c.fillText(s,x,y);};
function draw(c,key,t,x,y,w,h){
 const clip=AUTHORED_CLIPS[key],f=clip.frames[authoredFrameAt(clip,t)],at=authoredRegistration(clip,w,h);
 c.drawImage(assets.get(key),f.x,f.y,f.w,f.h,x+at.x,y+at.y,f.w*at.scale,f.h*at.scale);
}
function background(c,w,h){c.fillStyle='#071820';c.fillRect(0,0,w,h);}
for(const[w,h]of[[1440,900],[390,844]]){
 const canvas=createCanvas(w,h),c=canvas.getContext('2d'),phone=w<500;
 background(c,w,h);text(c,'v82 · material action drawings',w/2,25,phone?16:24);
 if(phone){
   const times=[0,.2,.4,.6,.8,1],cell=56,left=26;
   symbolKeys.forEach((key,row)=>{const top=65+row*95;text(c,names[key],w/2,top-10,12,'#c9b78f');times.forEach((t,col)=>draw(c,key,t,left+col*cell,top,cell,cell));});
   text(c,'56px symbol canvases · source endpoints at both ends',w/2,760,10,'#a6b7bc');
 }else{
   const times=[0,.25,.5,.75,1],cw=180,ch=142,left=90;
   symbolKeys.forEach((key,col)=>{text(c,names[key],left+col*cw+cw/2,62,16,'#c9b78f');times.forEach((t,row)=>draw(c,key,t,left+col*cw+(cw-140)/2,85+row*ch,140,140));});
   text(c,'Same registry and registration as the production renderer · authored part changes, not universal icon pulses',w/2,835,16,'#a6b7bc');
 }
 text(c,'Offline asset-stage proof · not a live browser capture',w/2,h-24,phone?10:15,'#a6b7bc');
 fs.writeFileSync(`${output}/symbol-actions-${w}x${h}.png`,await canvas.encode('png'));
 // A short normal-speed pass at actual small icon size; no repeating idle motion.
 const ff=spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate','30','-i','pipe:0','-c:v','libx264','-threads','1','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',`${output}/material-actions-${w}x${h}.mp4`],{stdio:['pipe','inherit','inherit']});
 const done=once(ff,'exit');
 for(let frame=0;frame<90;frame++){
   background(c,w,h);text(c,'v82 · finite material performances',w/2,35,phone?17:25);
   const t=Math.min(1,Math.max(0,(frame/30-.55)/.56));
   if(phone){symbolKeys.forEach((key,i)=>{const col=i%3,row=Math.floor(i/3),x=30+col*112,y=105+row*125;draw(c,key,t,x,y,104,104);text(c,names[key],x+52,y+113,10,'#c9b78f');});surfaceKeys.slice(0,2).forEach((key,i)=>draw(c,key,t,45+i*150,550,150,100));}
   else{symbolKeys.forEach((key,i)=>{const x=70+i*185;draw(c,key,t,x,150,180,180);text(c,names[key],x+90,355,16,'#c9b78f');});surfaceKeys.forEach((key,i)=>{const x=55+i*345;draw(c,key,t,x,470,320,213);text(c,names[key],x+160,710,18,'#c9b78f');});}
   text(c,'Offline asset-stage proof · production clip sampler · no game events or awards',w/2,h-28,phone?9:15,'#a6b7bc');
   const png=await canvas.encode('png');if(!ff.stdin.write(png))await once(ff.stdin,'drain');
 }
 ff.stdin.end();const[code]=await done;assert.equal(code,0);
}
const checks=[];
for(const key of [...symbolKeys,...surfaceKeys]){
 const clip=AUTHORED_CLIPS[key];assert.equal(authoredFrameAt(clip,0),0);assert.equal(authoredFrameAt(clip,1),0);
 assert(clip.registrationBounds,'Every v82 action is source-registered');
 for(const[w,h]of[[56,56],[140,140],[320,213]]){
   const p=authoredRegistration(clip,w,h);assert(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.scale>0);
   for(let i=0;i<=120;i++)assert(clip.frames[authoredFrameAt(clip,i/120)]);
 }
 checks.push({key,frames:clip.frames.length,sequence:clip.sequence,exactSourceEndpoints:true,registrationBounds:clip.registrationBounds});
}
fs.writeFileSync(output+'/verification.json',JSON.stringify({scope:'Source-native asset-stage, not browser/WebGL/audio',checks,unchanged:'Static symbols, royals, cell dimensions, values, awards, controller clocks',runtimeSamplingCases:checks.length*3*121},null,2)+'\n');
console.log(JSON.stringify({clips:checks.length,proofs:4,registrationSamples:checks.length*3*121}));
