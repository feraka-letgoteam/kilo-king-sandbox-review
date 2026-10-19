import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/package.json');
const {loadImage}=require('@napi-rs/canvas');
import {createOfflineRuntime,createCanvas,textureImage} from './offline-runtime-v79.mjs';
const r=createOfflineRuntime(),{docksideHeaderLayout,docksideHeaderPaint}=r.load('src/components/kilo/dockside-header-art.ts');
const {stageArtLayout,stageArtPaint}=r.load('src/components/kilo/stage-art.ts');
const {fitGameLayout}=r.load('src/components/kilo/layout.ts');
const out='art/kilo-v80/ui',checks=[];fs.mkdirSync(out,{recursive:true});
const imageCache=new Map();
const embed=async s=>{
 for(const url of [...new Set([...s.matchAll(/href="(\/[^"?#]+)"/g)].map(m=>m[1]))]){
  let data=imageCache.get(url);if(!data){const im=await textureImage(url),c=createCanvas(im.width,im.height);c.getContext('2d').drawImage(im,0,0);data='data:image/png;base64,'+c.toBuffer('image/png').toString('base64');imageCache.set(url,data);}
  s=s.split('href="'+url+'"').join('xlink:href="'+data+'"');
 }return s;
};
export async function svgImage(body,w,h){return loadImage(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${await embed(body)}</svg>`));}
for(const [vw,vh] of [[1440,900],[390,844],[360,800],[844,390]]){
 const l=fitGameLayout(vw-(vw<900?24:48),vh-(vw<900?24:48)),p=l.mode==='portrait';
 const b=docksideHeaderLayout(l.reelWidth,l.header,p),state={left:9,mult:2,filled:1,holding:false,maxed:false,nextSpins:10,nextMult:3};
 const c=createCanvas(vw,Math.ceil(l.header+85)),x=c.getContext('2d');x.fillStyle='#0a1c29';x.fillRect(0,0,c.width,c.height);
 const header=await svgImage(docksideHeaderPaint(state,b,'test'),b.width,b.height);x.drawImage(header,(vw-b.width)/2,b.top);
 const portrait=await textureImage('/kilo-v79/characters/collector-idle.webp');for(const p of b.sockets.slice(0,state.filled)){const sx=(vw-b.width)/2+p.x,sy=b.top+p.y,d=b.socket;x.save();x.beginPath();x.arc(sx+d/2,sy+d/2,d/2-3,0,Math.PI*2);x.clip();x.drawImage(portrait,sx-d*.15,sy+d*.02,d*1.3,d*1.3);x.restore();}
 const {stageArtSlices,CABINET_ART}=r.load('src/components/kilo/stage-art.ts'),edge=stageArtLayout(l.reelWidth,l.reelHeight,l.mode),art=await textureImage(CABINET_ART);
 x.save();x.translate((vw-l.reelWidth)/2,l.header);x.beginPath();x.rect(edge.x,edge.y,edge.w,edge.h);x.rect(edge.inset,edge.inset,l.reelWidth-edge.inset*2,l.reelHeight-edge.inset*2);x.clip('evenodd');
 for(const p of stageArtSlices(l.reelWidth,l.reelHeight,l.mode))x.drawImage(art,p.sx,p.sy,p.sw,p.sh,p.x,p.y,p.w,p.h);x.restore();
 x.font='600 12px "Source Sans 3"';x.fillStyle='#cbd4c3';x.fillText(`${vw}×${vh} · production SVG header and cabinet · offline`,12,c.height-12);
 fs.writeFileSync(`${out}/header-${vw}x${vh}.webp`,await c.encode('webp',94));
 assert(b.top>=0&&b.top+b.height<=l.header,'header fits original allocation');assert(b.sockets[0].x>b.statWidth,'tracker separate from left well');assert(b.sockets[3].x+b.socket<b.width-b.statWidth,'tracker separate from right well');
 checks.push({viewport:[vw,vh],mode:l.mode,headerAllocation:l.header,header: b,passed:true});
 x.font='700 28px "Source Sans 3"';assert(x.measureText('×10').width<b.statWidth-4,'maximum multiplier fits');
}
fs.writeFileSync(out+'/verification.json',JSON.stringify({method:'Source layout and native font bounds, not browser UI',checks},null,2)+'\n');
console.log('Four header layouts fit original allocations with no intersecting stat or socket boxes.');
