/** Offline art/performance proof. Uses production parts, registration and
 * playback curves; it is not a browser/GPU or gameplay recording. */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {loadProduction} from './kilo-v56-test-loader.mjs';
const require=createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'package.json'));
const sharp=require('sharp');
const {CHARACTER_RIGS,rigTransforms,visibleRigParts}=loadProduction('src/components/kilo/character-rig-model.ts');
const {createCharacterPlayback,characterIdleAt}=loadProduction('src/components/kilo/character-life.ts');
const face=JSON.parse(fs.readFileSync('public/kilo-v57/characters/king-blink.json'));
const out='art/kilo-v57/proofs',temp='/workspace/scratch/6281bb86619d/v57-life-frames';
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(temp,{recursive:true});
const parts={};
for(const actor of ['king','vice']){
 parts[actor]={};
 for(const [id,p]of Object.entries(CHARACTER_RIGS[actor].parts)){
  const f=p.frame,png=await sharp('public'+CHARACTER_RIGS[actor].atlas).extract({left:f.x,top:f.y,width:f.w,height:f.h}).png().toBuffer();
  parts[actor][id]='data:image/png;base64,'+png.toString('base64');
 }
}
for(const [id,f]of Object.entries(face.states)){
 const png=await sharp('public'+face.atlas).extract({left:f.x,top:f.y,width:f.w,height:f.h}).png().toBuffer();
 parts.king[id]='data:image/png;base64,'+png.toString('base64');
}
function rig(actor,frame){
 const def=CHARACTER_RIGS[actor],joints=rigTransforms(def,frame.pose);
 return visibleRigParts(def,frame.expressive).map(([id,p])=>{
  const t=joints[id],url=actor==='king'&&id==='head'&&frame.blink!=='open'?parts.king[frame.blink]:parts[actor][id];
  return `<g transform="translate(${t.x} ${t.y}) rotate(${t.rotation*180/Math.PI})"><image href="${url}" x="${-p.pivot[0]}" y="${-p.pivot[1]}" width="${p.frame.w}" height="${p.frame.h}"/></g>`;
 }).join('');
}
const text=(value,x,y,size=14,color='#b9c9cb')=>`<text x="${x}" y="${y}" fill="${color}" font-family="sans-serif" font-size="${size}" text-anchor="middle">${value}</text>`;
const king=createCharacterPlayback('king');king.setAction('rest','idle');
const FPS=30,DURATION=12000,W=1200,H=720;
for(let i=0;i<DURATION/1000*FPS;i++){
 const time=i/FPS*1000;
 if(i===135)king.setAction('glance','cast:1');
 if(i===240)king.setAction('victory','earned:1');
 const frame=king.advance(i?1000/FPS:0),vice=characterIdleAt('vice',time,2);
 const phase=time<4500?'Breathing + occasional blink':time<5220?'Small glance':time<8000?'Back to breathing':time<9120?'Earned reaction':'Return to the same idle phase';
 let content=text('CHARACTER LIFE · OFFLINE ART PROOF',W/2,34,21,'#fff8e9')+text('Production joints, authored eyelids and timing · not a live browser recording',W/2,58,13);
 content+=text('KILO · PLANTED IDLE',270,95,16,'#dfc18d')+text('VICE · INDEPENDENT RHYTHM',646,95,16,'#89e6d9');
 for(const [actor,f,x]of[['king',frame,270],['vice',vice,646]]){
  content+=`<ellipse cx="${x}" cy="623" rx="120" ry="9" fill="#030d13"/><g transform="translate(${x-192*.92} 115) scale(.92)">${rig(actor,f)}</g>`;
 }
 content+=text('PHONE REEL SIZE',1010,95,16,'#fff8e9');
 const cell=58,scale=Math.min(cell*.98/260,cell*2.4/552);
 for(const [actor,x,variant,mult]of[['king',928,0,8],['vice',1024,2,6]]){
  const edge=actor==='king'?'#dfc18d':'#89e6d9',y=180,h=cell*3;
  content+=`<rect x="${x+3}" y="${y+2}" width="${cell-6}" height="${h-4}" fill="${actor==='king'?'#241b15':'#0b2830'}" stroke="${edge}" stroke-width="2"/>`;
  content+=`<g transform="translate(${x+cell/2} ${y+cell*2.68}) scale(${scale}) translate(-192 -552)">${rig(actor,characterIdleAt(actor,time,variant))}</g>`;
  content+=text('×'+mult,x+cell/2,y+18,19,'#89e6d9')+text('WILD',x+cell/2,y+h-5,12,'#dfc18d');
 }
 // The same head at normal logical resolution, useful for blink registration.
 const head=frame.blink==='open'?parts.king.head:parts.king[frame.blink];
 content+=`<image href="${head}" x="943" y="400" width="137" height="151"/>`;
 content+=text('Original head registration',1010,581,13)+text('No root scaling or foot slide',1010,604,13);
 content+=text(phase,W/2,677,17,'#fff8e9')+text(`${time.toFixed(0)} ms · normal-speed character clock`,W/2,703,12);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#0a1b23"/><path d="M848 85V640" stroke="#26434b"/>${content}</svg>`;
 const file=`${temp}/${String(i).padStart(4,'0')}.png`;await sharp(Buffer.from(svg)).png().toFile(file);
 if([0,54,100,135,256,330].includes(i))fs.copyFileSync(file,`${out}/life-${i}.png`);
}
execFileSync('ffmpeg',['-v','error','-y','-framerate',String(FPS),'-i',`${temp}/%04d.png`,'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',`${out}/character-life.mp4`]);
fs.writeFileSync(`${out}/proof.json`,JSON.stringify({kind:'Offline SVG/Sharp art proof. Not browser, Pixi/GPU, gameplay or settlement evidence.',fps:FPS,durationMs:DURATION,size:[W,H],parts:'v55 articulated rigs + v57 registered eyelids',curves:'Production character-life.ts',phoneCell:58,events:[{ms:4500,action:'glance'},{ms:8000,action:'victory'}]},null,2)+'\n');
console.log('Wrote 12s character-life proof and six inspection frames.');
