/** Offline asset proof using production timing, layout, and sprite registration.
 * This deliberately omits gameplay/UI and is not browser or GPU evidence. */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {loadProduction} from './kilo-v56-test-loader.mjs';

const req=createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules','package.json'));
const sharp=req('sharp');
const out='art/kilo-v56/proofs';fs.mkdirSync(out,{recursive:true});
const temp=fs.mkdtempSync('/workspace/scratch/6281bb86619d/v56-getaway-proof-');
const {getawayMotionAt,GETAWAY_REVEAL_MS}=loadProduction('src/components/kilo/feature-motion.ts');
const {fitGameLayout}=loadProduction('src/components/kilo/layout.ts');
const {timedPerformanceFrameAt}=loadProduction('src/components/kilo/rig-performance.ts');
const stage=fs.readFileSync('src/components/kilo/pixiStage.ts','utf8');
const fitSource=stage.slice(stage.indexOf('function edgeFor('),stage.indexOf('function geomFor('));
const fitReels=new Function(ts.transpile(fitSource,{target:ts.ScriptTarget.ESNext})+';return fitReels;')();
const manifest=JSON.parse(fs.readFileSync('public/kilo-v56/vehicles/manifest.json','utf8'));
const boat=manifest.boat,durations=boat.frames.map(f=>f.durationMs);
const sourceFile='public'+boat.url;
const images=await Promise.all(boat.frames.map(async f=>{
 const [left,top,width,height]=f.rect;
 return 'data:image/png;base64,'+(await sharp(sourceFile).extract({left,top,width,height}).png().toBuffer()).toString('base64');
}));
const layouts=[[390,844],[1440,900]].map(([W,H])=>{
 const pad=W<900?12:24,layout=fitGameLayout(W-pad*2,H-pad*2);
 const geometry=fitReels(Math.round(layout.reelWidth),Math.round(layout.reelHeight));
 return {viewport:[W,H],pad,layout,geometry};
});
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
const text=(s,x,y,size=16,color='#fff8e9',anchor='middle',family='sans-serif')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}" font-family="${family}">${esc(s)}</text>`;
const fmt=n=>n.toFixed(3);

function panel(sample,won,ms,row){
 const g=sample.geometry,w=g.cell*5+g.gap*4,t=Math.min(1,ms/GETAWAY_REVEAL_MS),beat=getawayMotionAt(t,won,false);
 const i=timedPerformanceFrameAt(beat.frameProgress,durations,false,boat.settleFrame);
 const column=won?0:1,x=(960-g.dw)/2+column*960,y=row===0?143:470;
 const spriteW=g.cell*boat.suggestedWidthCells,spriteH=spriteW/2;
 const cx=g.gx+w*beat.center,cy=g.gy+g.cell*1.3;
 const clip=`play-${row}-${column}`;
 let body=`<defs><clipPath id="${clip}"><rect x="${g.gx}" y="${g.gy}" width="${w}" height="${g.cell*3}"/></clipPath></defs>`;
 body+=`<rect width="${g.dw}" height="${g.dh}" fill="#0b2029" stroke="#48626c" stroke-width="1"/>`;
 body+=`<rect x="${g.cab.x}" y="${g.cab.y}" width="${g.cab.w}" height="${g.cab.h}" fill="none" stroke="#d8b66f" stroke-width="1"/>`;
 body+=`<rect x="${g.gx}" y="${g.gy}" width="${w}" height="${g.cell*3}" fill="#07131a"/>`;
 body+=`<g clip-path="url(#${clip})"><image href="${images[i]}" x="${cx-spriteW*boat.anchor[0]}" y="${cy-spriteH*boat.anchor[1]}" width="${spriteW}" height="${spriteH}"/></g>`;
 body+=`<rect x="${g.gx}" y="${g.gy}" width="${w}" height="${g.cell*3}" fill="none" stroke="#89e6d9" stroke-width="1" stroke-dasharray="3 5"/>`;
 // Motion state labels are inspection annotations, not substitute game UI.
 const state=won?(beat.stopped?'STOPPED · position held':'APPROACH → DECELERATE'):(t>=.92?'PASSED THROUGH · NO WIN':'TRAVELLING RIGHT');
 body+=text(state,g.gx+w/2,g.gy+g.cell*2.45,row===0?13:22,won?'#d8b66f':'#e99a85');
 body+=text(`key ${i+1}/8 · ${boat.frames[i].name}`,g.gx+w/2,g.gy+g.cell*2.79,row===0?11:16,'#b9c9c8');
 const sizeLabel=`${sample.viewport[0]}×${sample.viewport[1]} viewport · ${g.dw}×${g.dh} reel host · ${g.cell}px cells · 1:1 size`;
 return text(sizeLabel,480+column*960,y-36,row===0?15:17,'#b9c9c8')+
  text(`clock ${(ms/1000).toFixed(2)}s   t ${fmt(t)}   center ${fmt(beat.center)}`,480+column*960,y-13,13,'#89e6d9','middle','monospace')+
  `<g transform="translate(${x} ${y})">${body}</g>`;
}

async function render(ms,file){
 let body=text('GETAWAY · PRODUCTION MOTION / AUTHORED BOAT',960,32,22);
 body+=text('OFFLINE ART PROOF — not browser playback',960,57,17,'#e8c480');
 body+=text('MAX-WIN RECORDED OUTCOME',480,87,18,'#d8b66f')+text('LOSS RECORDED OUTCOME',1440,87,18,'#e99a85');
 body+=`<line x1="960" y1="72" x2="960" y2="1017" stroke="#28414b"/>`;
 for(let row=0;row<layouts.length;row++){body+=panel(layouts[row],true,ms,row)+panel(layouts[row],false,ms,row);}
 body+=text(`Normal speed: ${GETAWAY_REVEAL_MS}ms reveal + 600ms final hold. Max center stops at 64% and never exits.`,960,1033,16,'#b9c9c8');
 body+=text('Thin gold: cabinet bound · dotted teal: clipped play area · actual geometry, atlas anchor and production curves · no gameplay simulation',960,1060,14,'#8ea9af');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="100%" height="100%" fill="#020c12"/>${body}</svg>`;
 await sharp(Buffer.from(svg)).png().toFile(file);
}

const fps=30,totalMs=GETAWAY_REVEAL_MS+600,frames=Math.round(totalMs*fps/1000);
for(let i=0;i<frames;i++)await render(i*1000/fps,path.join(temp,`${String(i).padStart(4,'0')}.png`));
await render(GETAWAY_REVEAL_MS*.52,`${out}/getaway-decelerate.png`);
await render(GETAWAY_REVEAL_MS+300,`${out}/getaway-stopped.png`);
execFileSync('ffmpeg',['-loglevel','error','-y','-framerate',String(fps),'-i',`${temp}/%04d.png`,'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',`${out}/getaway-motion.mp4`]);
fs.writeFileSync(`${out}/getaway-proof.json`,JSON.stringify({
 evidence:'offline artwork render; not browser or GPU playback',fps,frames,durationMs:totalMs,revealMs:GETAWAY_REVEAL_MS,finalHoldMs:600,
 model:'src/components/kilo/feature-motion.ts#getawayMotionAt',modelSha256:createHash('sha256').update(fs.readFileSync('src/components/kilo/feature-motion.ts')).digest('hex'),
 layout:'src/components/kilo/layout.ts#fitGameLayout',geometry:'src/components/kilo/pixiStage.ts#fitReels',geometrySourceSha256:createHash('sha256').update(fitSource).digest('hex'),
 atlas:boat.url,anchor:boat.anchor,widthCells:boat.suggestedWidthCells,frameDurations:durations,frameNames:boat.frames.map(f=>f.name),layouts,
 samples:[0,.21,.52,.64,.84,1].map(t=>({t,max:getawayMotionAt(t,true,false),loss:getawayMotionAt(t,false,false),maxFrame:timedPerformanceFrameAt(getawayMotionAt(t,true,false).frameProgress,durations),lossFrame:timedPerformanceFrameAt(getawayMotionAt(t,false,false).frameProgress,durations)}))
},null,2)+'\n');
fs.rmSync(temp,{recursive:true,force:true});
console.log(`Wrote ${out}/getaway-motion.mp4 (${frames} frames, ${totalMs}ms), two representative PNGs and production geometry/timing metadata.`);
