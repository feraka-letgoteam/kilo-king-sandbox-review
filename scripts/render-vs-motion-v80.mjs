/** Targeted production-stage review. Same code, geometry and recorded event;
 * minimal WIN harness, not the full React page/browser/WebGL. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createOfflineRuntime,createCanvas,drawNode,allMasks,findAll} from './offline-runtime-v79.mjs';
const output='art/kilo-v80/vs';fs.mkdirSync(output,{recursive:true});
const owned=['src/components/kilo/reel-feature-effects.ts','src/components/kilo/vs-encounter.ts','src/components/kilo/vs-group-art.ts','src/components/kilo/vs-merge-motion.ts','src/components/kilo/win-type.ts'];
const ownedHash=()=>crypto.createHash('sha256').update(owned.map(file=>file+'\n'+fs.readFileSync(file,'utf8')).join('\n')).digest('hex');
const fingerprint=ownedHash();
const seeded=seed=>()=>{seed|=0;seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};
for(const[vw,vh]of[[1440,900],[390,844]]){
 const r=createOfflineRuntime();r.window.innerWidth=vw;r.window.innerHeight=vh;
 const round=r.load('src/lib/kilo/reel-feature-math.ts').runReelFeature('yacht',1000,seeded(16),18000000),spin=round.free[5],event=spin.mechanic;
 const {fitGameLayout}=r.load('src/components/kilo/layout.ts'),p=vw<900?12:24,l=fitGameLayout(vw-p*2,vh-p*2),ox=(vw-l.reelWidth)/2,oy=l.header;
 const win={x:vw/2-66,y:oy+l.reelHeight+16,w:132,h:56},host=r.host(Math.round(l.reelWidth),Math.round(l.reelHeight),ox,oy,win);
 const cues=[];let phase='held',paid=0;const sound=r.load('src/lib/kilo/sound.ts');sound.featureCue=name=>{phase=name;cues.push({name,ms:r.clock});};
 const scene=await r.load('src/components/kilo/pixiStage.ts').mountScene(host),stage=r.apps[0].stage;
 const canvas=createCanvas(vw,vh),c=canvas.getContext('2d'),id=`vs-encounter-${vw}x${vh}`,snapshots=[];let frame=0;
 const ff=spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate','24','-i','pipe:0','-c:v','libx264','-threads','2','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',`${output}/${id}.mp4`],{stdio:['pipe','inherit','inherit']}),done=once(ff,'exit');
 const text=(s,x,y,size,color='#fff1bb')=>{c.font=`700 ${size}px "Source Sans 3"`;c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';c.strokeStyle='#07131a';c.lineWidth=Math.max(1.5,size*.06);c.strokeText(String(s),x,y);c.fillStyle=color;c.fillText(String(s),x,y);};
 async function capture(){
  c.globalAlpha=1;c.fillStyle='#0b1922';c.fillRect(0,0,vw,vh);c.save();c.translate(ox,oy);await drawNode(c,stage,allMasks(stage));c.restore();
  c.fillStyle='#030b10';c.fillRect(win.x,win.y,win.w,win.h);text('WIN',vw/2,win.y+12,12,'#c3ccc8');text(paid.toLocaleString('en-US'),vw/2,win.y+36,24);
  for(const el of r.document.body.children.filter(e=>e.className==='kk-feature-transfer')){if(!el.style.left)continue;c.globalAlpha=Number(el.style.opacity??1);text(el.textContent,parseFloat(el.style.left),parseFloat(el.style.top),parseFloat(el.style.fontSize)||24);c.globalAlpha=1;}
  text('v80 · VS encounter · '+vw+'×'+vh,vw/2,vh-45,vw<900?13:16);text('Offline production stage · WIN harness · not browser',vw/2,vh-23,vw<900?10:12,'#aabdbd');
  const duel=findAll(stage,'yacht-duel'),merge=findAll(stage,'vs-group-merge'),current=merge.length?'merge':phase;
  if(frame%3===0){const file=`${id}-${String(frame).padStart(4,'0')}.webp`;fs.writeFileSync(`${output}/${file}`,await canvas.encode('webp',90));snapshots.push({file,ms:r.clock,phase:current});}
  const png=await canvas.encode('png');if(!ff.stdin.write(png))await once(ff.stdin,'drain');frame++;
  if(frame%6===0){await new Promise(resolve=>setImmediate(resolve));globalThis.gc?.();}
 }
 scene.setStake(1000);scene.setPace(false,false,'normal');scene.show(spin.grid);scene.setFeatureState(event,'before');
 for(let i=0;i<8;i++){await capture();await r.tick(1000/24);}
 await r.drive(scene.reelFeatureStep(event,{award:n=>paid+=n,state(){}}),{step:1000/24,onFrame:capture});
 scene.setFeatureState(event,'after');for(let i=0;i<8;i++){await r.tick(1000/24);await capture();}
 ff.stdin.end();const[code]=await done;if(code!==0)throw Error('ffmpeg failed');
 if(paid!==event.credited)throw Error('Wrong credit');if(ownedHash()!==fingerprint)throw Error('Owned VS source changed during capture');
 fs.writeFileSync(`${output}/${id}.json`,JSON.stringify({method:'Targeted offline review of production mountScene, VS controller, native geometry and shipped art. Minimal WIN harness, not complete React/browser/WebGL.',viewport:[vw,vh],ownedPresentationFingerprint:fingerprint,seed:16,index:5,paid,recorded:event.credited,cues,snapshots,frames:frame},null,2)+'\n');
 scene.destroy();console.log(`${id}: ${frame} frames; ${paid} credited once.`);
}
