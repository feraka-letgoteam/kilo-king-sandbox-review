/** Actual source layout/markup rasterized offline. Native SVG omits embedded
 * WebP images, so their exact source positions are painted as Canvas sprites. */
import {createRequire} from 'node:module';
import path from 'node:path';
import {createCanvas,textureImage} from './offline-runtime-v79.mjs';
const require=createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'package.json'));
const {loadImage}=require('@napi-rs/canvas');
export async function createProofChrome(load,l,state){
 const {stageArtLayout,stageArtSlices,CABINET_ART}=load('src/components/kilo/stage-art.ts');
 const frame=await textureImage(CABINET_ART),mode=l.compact?'mini':l.mode,edge=stageArtLayout(l.reelWidth,l.reelHeight,mode),slices=stageArtSlices(l.reelWidth,l.reelHeight,mode);
 let header=null,box=null;
 if(state){
  const {docksideHeaderLayout,docksideHeaderPaint}=load('src/components/kilo/dockside-header-art.ts');box=docksideHeaderLayout(l.reelWidth,l.header,l.mode==='portrait');
  header=createCanvas(box.width,box.height);const c=header.getContext('2d');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${box.width}" height="${box.height}">${docksideHeaderPaint(state,box,'proof')}</svg>`;
  c.drawImage(await loadImage(Buffer.from(svg)),0,0);
  const face=await textureImage('/kilo-v79/characters/collector-idle.webp');
  for(const p of box.sockets.slice(0,state.filled)){const d=box.socket;c.save();c.beginPath();c.arc(p.x+d/2,p.y+d/2,d/2-3,0,Math.PI*2);c.clip();c.drawImage(face,p.x-d*.15,p.y+d*.02,d*1.3,d*1.3);c.restore();}
 }
 return(c,ox,oy)=>{
  c.save();c.translate(ox,oy);c.beginPath();c.rect(edge.x,edge.y,edge.w,edge.h);c.rect(edge.inset,edge.inset,l.reelWidth-edge.inset*2,l.reelHeight-edge.inset*2);c.clip('evenodd');
  for(const p of slices)c.drawImage(frame,p.sx,p.sy,p.sw,p.sh,p.x,p.y,p.w,p.h);c.restore();
  if(header)c.drawImage(header,ox+(l.reelWidth-box.width)/2,oy-l.header+box.top);
 };
}
