/** Offline native art review. Uses shipped rigs, curves, fits and frame timing.
 * These are not browser screenshots or GPU acceptance evidence. */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {loadProduction} from './kilo-v55-test-loader.mjs';
const req=createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules','package.json'));
const sharp=req('sharp');
const out='art/kilo-v55/proofs';fs.mkdirSync(out,{recursive:true});
const {CHARACTER_RIGS,rigTransforms,visibleRigParts}=loadProduction('src/components/kilo/character-rig-model.ts');
const {characterPoseAt,timedPerformanceFrameAt}=loadProduction('src/components/kilo/rig-performance.ts');
const {fitGameLayout}=loadProduction('src/components/kilo/layout.ts');
const {gameBrandBox,KILO_BRAND}=loadProduction('src/components/kilo/brand-layout.ts');
const {integratedSceneCamera}=loadProduction('src/components/kilo/integrated-scene-model.ts');
const {sceneActorBox}=loadProduction('src/components/kilo/RiggedSceneActor.tsx');
const {stageArtPaint,CABINET_ART}=loadProduction('src/components/kilo/stage-art.ts');
const {placement,PACKAGE_META,V8_META,SCATTER_KING}=loadProduction('src/components/kilo/fish-art.ts');
const {ART,SYMBOL_ALPHA}=loadProduction('src/components/kilo/art-map.ts');
const stage=fs.readFileSync('src/components/kilo/pixiStage.ts','utf8');
const fitReels=new Function(ts.transpile(stage.slice(stage.indexOf('function edgeFor('),stage.indexOf('function geomFor(')),{target:ts.ScriptTarget.ESNext})+';return fitReels;')();
const vehicles=JSON.parse(fs.readFileSync('public/kilo-v55/vehicles/manifest.json'));
const uris=new Map();
async function uri(url,rect){const key=url+JSON.stringify(rect);if(!uris.has(key)){let image=sharp('public'+path.posix.normalize('/'+url));if(rect)image=image.extract({left:rect[0],top:rect[1],width:rect[2],height:rect[3]});uris.set(key,'data:image/png;base64,'+(await image.png().toBuffer()).toString('base64'));}return uris.get(key);}
const partImages={};
for(const actor of ['king','vice']){partImages[actor]={};for(const [id,p] of Object.entries(CHARACTER_RIGS[actor].parts)){const f=p.frame;partImages[actor][id]=await uri(CHARACTER_RIGS[actor].atlas,[f.x,f.y,f.w,f.h]);}}
function rig(actor,action='rest',progress=0){const def=CHARACTER_RIGS[actor],joints=rigTransforms(def,characterPoseAt(actor,action,progress));return visibleRigParts(def,action==='victory'&&progress>.25&&progress<.85).map(([id,p])=>{const t=joints[id],f=p.frame;return `<g transform="translate(${t.x} ${t.y}) rotate(${t.rotation*180/Math.PI})"><image href="${partImages[actor][id]}" x="${-p.pivot[0]}" y="${-p.pivot[1]}" width="${f.w}" height="${f.h}"/></g>`;}).join('');}
function text(value,x,y,size=14,color='#d3dfdc',anchor='middle'){return `<text x="${x}" y="${y}" font-size="${size}" font-family="sans-serif" fill="${color}" text-anchor="${anchor}">${value}</text>`;}
async function save(body,w,h,file){await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#061820"/>${body}</svg>`)).png().toFile(file);}
const poses=[['rest',0],['challenge',.23],['challenge',.57],['challenge',.78],['victory',.55],['defeat',.55],['rest',1]];
let body=text('Production joint curves · offline art proof',560,27,20);
for(const [ai,actor] of ['king','vice'].entries())for(let i=0;i<poses.length;i++){const [action,t]=poses[i];body+=`<g transform="translate(${i*160+16} ${58+ai*285}) scale(.333333)">${rig(actor,action,t)}</g>`+text(`${actor} · ${action}`,i*160+80,268+ai*285,12);}
await save(body,1120,580,`${out}/character-runtime-poses.png`);

const board=['A','package-small','K','duffel','10','cuffs','Q','lamp','J','bars','package-trophy','keys','package-king','package-medium','splash'];
for(const [W,H] of [[1440,900],[390,844],[360,800],[844,390]]){
 const pad=W<900?12:24,l=fitGameLayout(W-pad*2,H-pad*2),portrait=l.mode==='portrait',g=fitReels(Math.round(l.reelWidth),Math.round(l.reelHeight));
 const env=portrait?'/kilo-v55/environment/base-portrait-sky-clean.webp':'/kilo-v55/environment/base-desktop-sky-clean.webp';
 const sourceSize=portrait?{width:768,height:1708}:{width:1920,height:1080};
 const camera=integratedSceneCamera(l,{portrait,sourceSize,stageSize:{width:W-pad*2,height:H-pad*2}}),ab=sceneActorBox(camera.master,portrait),brand=gameBrandBox(l,false);
 let scene=`<image href="${await uri(env)}" x="${camera.left}" y="${camera.top}" width="${camera.width}" height="${camera.height}"/>`;
 scene+=`<g transform="translate(${camera.left+ab.left*camera.scale} ${camera.top+ab.top*camera.scale}) scale(${ab.width/384*camera.scale})"><ellipse cx="192" cy="558" rx="146" ry="10" fill="#07151b" opacity=".2"/><ellipse cx="116" cy="552" rx="49" ry="5" fill="#07151b" opacity=".28"/><ellipse cx="274" cy="552" rx="49" ry="5" fill="#07151b" opacity=".28"/>${rig('king')}</g>`;
 const reelLeft=l.mode==='landscape'?l.controlLeft+l.dockGap:l.artLeft;
 let reels=`<rect x="0" y="0" width="${l.reelWidth}" height="${l.reelHeight}" fill="#03121a"/>`;
 for(let i=0;i<board.length;i++){const key=board[i],x=g.gx+(i%5)*(g.cell+g.gap),y=g.gy+Math.floor(i/5)*g.cell;let file,meta,fit;
  if(key.startsWith('package-')){meta=PACKAGE_META[key];file='/kilo-v55/symbols/'+meta.file;const budgets={'package-small':[.64,.46],'package-medium':[.74,.56],'package-trophy':[.8,.7],'package-king':[.92,.72]};fit=placement(meta,g.cell,...budgets[key],.37);}
  else if(key==='lamp'||key==='duffel'){meta=V8_META[key==='lamp'?'sym-reel-v8':'sym-case-v8'];file='/kilo-symbols-v8/'+meta.file;fit=placement(meta,g.cell,.9,.9,.5);}
  else if(key==='bars'){meta=SCATTER_KING;file='/kilo-v55/symbols/'+meta.file;fit=placement(meta,g.cell,.82,.82,.5);}
  else if(key==='splash'){file='/kilo-symbols-v47/collector-idle.png';meta={width:444,height:444,bounds:[10,46,424,392]};fit=placement(meta,g.cell,.98,.8,.425);}
  else{file='/kilo-night-v3/'+ART[key];meta={width:1024,height:1024,bounds:SYMBOL_ALPHA[key]};const budget=['10','J','Q','K','A'].includes(key)?.66:.78;fit=placement(meta,g.cell,budget,budget,.5);}
  reels+=`<image href="${await uri(file)}" x="${x+fit.x}" y="${y+fit.y}" width="${fit.width}" height="${fit.height}"/>`;
  if(key.startsWith('package-'))reels+=`<rect x="${x+g.cell*.045}" y="${y+g.cell*.76}" width="${g.cell*.91}" height="${g.cell*.2}" rx="3" fill="#071f28"/>`+text({'package-small':'2,000','package-medium':'10,000','package-trophy':'50,000','package-king':'500,000'}[key],x+g.cell*.5,y+g.cell*.91,g.cell*.16,'#fff1d8');
 }
 reels+=stageArtPaint(l.reelWidth,l.reelHeight,l.mode).replaceAll(CABINET_ART,await uri(CABINET_ART));
 scene+=`<g transform="translate(${reelLeft} ${l.header})">${reels}</g>`;
 if(brand){scene+=`<rect x="${brand.x}" y="${brand.y}" width="${brand.width}" height="${brand.height}" fill="none" stroke="#89e6d9" stroke-dasharray="3 4" opacity=".5"/><image href="${await uri(KILO_BRAND[brand.variant])}" x="${brand.x}" y="${brand.y}" width="${brand.width}" height="${brand.height}" preserveAspectRatio="xMidYMid meet"/>`;}
 if(l.mode==='portrait')scene+=`<rect x="0" y="${l.header+l.reelHeight}" width="${l.reelWidth}" height="160" fill="#03121a" opacity=".72" stroke="#89e6d9" stroke-dasharray="3 4"/>`+text('Existing controls · 160px reserved',l.reelWidth/2,l.header+l.reelHeight+85,12);
 scene+=text('OFFLINE ART / GEOMETRY PROOF',l.width/2,Math.min(H-pad*2-12,l.height+25),W<400?10:13);
 await save(`<g transform="translate(${(W-l.width)/2} ${pad})">${scene}</g>`,W,H,`${out}/art-and-logo-${W}x${H}.png`);
}

// Short inspection film: finite production joint curves and authored atlas timing.
const frameDir='/workspace/scratch/6281bb86619d/v55-art-film-frames';fs.mkdirSync(frameDir,{recursive:true});
const assetFrames={};for(const key of ['chopper','boat'])assetFrames[key]=await Promise.all(vehicles[key].frames.map(f=>uri(vehicles[key].url,f.rect)));
const fps=24,total=72;
for(let frame=0;frame<total;frame++){
 const seconds=frame/fps,t=Math.max(0,Math.min(1,(seconds-.35)/1.12));
 let svg=text('KILO KING · v55 animation artwork',480,28,20)+text('Offline asset render · not browser playback',480,50,12,'#9aaea9');
 svg+=`<g transform="translate(45 100) scale(.46)">${rig('king','challenge',t)}</g><g transform="translate(270 100) scale(.46)">${rig('vice','challenge',t)}</g>`;
 for(const [i,key]of ['chopper','boat'].entries()){const f=timedPerformanceFrameAt(Math.max(0,Math.min(1,(seconds-.35)/1.05)),vehicles[key].frames.map(f=>f.durationMs));const W=key==='chopper'?360:420,H=W*vehicles[key].frame[1]/vehicles[key].frame[0];svg+=`<image href="${assetFrames[key][f]}" x="${480+(420-W)/2}" y="${i?310:75}" width="${W}" height="${H}"/>`;}
 svg+=text('Separate joints · planted feet · settles at rest',245,420,13)+text('Drawn rotor / hatch / hull / wake changes',690,515,13);
 await save(svg,960,540,`${frameDir}/${String(frame).padStart(4,'0')}.png`);
}
execFileSync('ffmpeg',['-loglevel','error','-y','-framerate',String(fps),'-i',`${frameDir}/%04d.png`,'-c:v','libx264','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',`${out}/v55-animation-artwork.mp4`]);
fs.writeFileSync(`${out}/README.md`,'# Offline art proofs\n\nThese PNGs and film use the shipped assets and production geometry/joint/frame-timing functions. They are not browser screenshots, GPU renders, live gameplay or acceptance captures. Dotted logo rectangles show reserved bounds. Portrait control placeholders identify the unchanged 160px allocation and intentionally do not imitate the live controls. Clouds/water effects are not rasterized in these static placement proofs.\n');
console.log('Wrote runtime-pose proof, four art/logo geometry proofs and a three-second offline animation inspection film.');
