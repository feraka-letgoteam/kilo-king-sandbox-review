/** Compile source-registered foliage planes from the original artwork and
 * imagegen-authored removal plates. The imagegen plate supplies only newly
 * exposed sky: original buildings, trunks, water and foreground stay exact.
 * This is asset preparation, never per-frame pixel work. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {createOfflineRuntime} from './offline-runtime-v79.mjs';
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'package.json'):import.meta.url);
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const runtime=createOfflineRuntime(),{environmentFoliage}=runtime.load('src/components/kilo/environment-foliage.ts');
const {illustratedEnvironment}=runtime.load('src/components/kilo/illustrated-environment.ts');
const out='public/kilo-v82/environment',proof='art/kilo-v82/environment';
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(proof,{recursive:true});
const manifest=JSON.parse(fs.readFileSync('art/kilo-v82/environment/cleanup-inputs.json','utf8'));
const clamp=v=>Math.max(0,Math.min(1,v));
const inside=(x,y,p)=>{let value=false;for(let i=0,j=p.length-1;i<p.length;j=i++){
 const[ax,ay]=p[i],[bx,by]=p[j];if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)value=!value;
}return value;};
const rows=[];
for(const row of manifest.assets){
 const {mode,portrait,clean}=row,stem=mode+(portrait?'-portrait':'');
 const source=await loadImage(`public/kilo-v79/environment/${stem}.webp`),backing=await loadImage(clean);
 const w=source.width,h=source.height,src=createCanvas(w,h),sx=src.getContext('2d'),cleanCanvas=createCanvas(w,h),cx=cleanCanvas.getContext('2d');
 sx.drawImage(source,0,0);cx.drawImage(backing,0,0,w,h);
 const s=sx.getImageData(0,0,w,h),c=cx.getImageData(0,0,w,h),mask=new Uint8Array(w*h);
 const patches=environmentFoliage(mode,portrait,w,h);
 // Blue negative space is separated from the painted green/navy/gold foliage.
 // Generated cleanup is consulted only inside hand-registered canopy boxes.
 for(const patch of patches){
  const left=Math.max(0,Math.floor(patch.x)),right=Math.min(w,Math.ceil(patch.x+patch.width)),top=Math.max(0,Math.floor(patch.y)),bottom=Math.min(h,Math.ceil(patch.y+patch.height));
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
   const n=y*w+x,i=n*4,[r,g,b]=s.data.slice(i,i+3),[cr,cg,cb]=c.data.slice(i,i+3);
   const sourceSky=b>140&&b>g*1.39&&b>r*1.92;
   const backingSky=cb>65&&cb>cg*1.27&&cb>cr*1.72;
   const difference=Math.abs(r-cr)+Math.abs(g-cg)+Math.abs(b-cb);
   const moonBacking=mode==='scatter-3'&&cr>180&&cg>130&&cb<205&&cr+cg+cb>r+g+b+70;
   if(!sourceSky&&(backingSky||moonBacking)&&difference>60)mask[n]=255;
  }
 }
 // A single-pixel coverage fringe preserves hard antialiased leaf edges.
 const matte=new Uint8Array(mask);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const n=y*w+x;if(mask[n])continue;
  const neighbors=mask[n-1]+mask[n+1]+mask[n-w]+mask[n+w];
  if(neighbors>=510){const i=n*4,r=s.data[i],g=s.data[i+1],b=s.data[i+2];if(!(b>100&&b>g*1.7&&b>r*2.5))matte[n]=255;}
 }
 // Dark outline encloses occasional cool-blue interior highlights. Those
 // highlights belong to the same physical leaf, not to the distant sky.
 // Flood the external negative space; fill enclosed holes in each crown.
 for(const patch of patches){
  const l=Math.max(0,Math.floor(patch.x)),r=Math.min(w-1,Math.ceil(patch.x+patch.width)),t=Math.max(0,Math.floor(patch.y)),b=Math.min(h-1,Math.ceil(patch.y+patch.height));
  const visited=new Uint8Array(w*h),queue=new Int32Array((r-l+1)*(b-t+1));let head=0,tail=0;
  const push=(x,y)=>{const n=y*w+x;if(!matte[n]&&!visited[n]){visited[n]=1;queue[tail++]=n;}};
  for(let x=l;x<=r;x++){push(x,t);push(x,b);}for(let y=t;y<=b;y++){push(l,y);push(r,y);}
  while(head<tail){const n=queue[head++],x=n%w,y=Math.floor(n/w);if(x>l)push(x-1,y);if(x<r)push(x+1,y);if(y>t)push(x,y-1);if(y<b)push(x,y+1);}
  for(let y=t;y<=b;y++)for(let x=l;x<=r;x++){const n=y*w+x;if(!visited[n])matte[n]=255;}
 }
 const foliage=createCanvas(w,h),fc=foliage.getContext('2d'),layer=fc.createImageData(w,h);
 const fill=createCanvas(w,h),bc=fill.getContext('2d'),back=bc.createImageData(w,h);
 let pixels=0;
 for(let n=0;n<matte.length;n++)if(matte[n]){
  const i=n*4;pixels++;layer.data[i]=s.data[i];layer.data[i+1]=s.data[i+1];layer.data[i+2]=s.data[i+2];layer.data[i+3]=255;
  back.data[i]=c.data[i];back.data[i+1]=c.data[i+1];back.data[i+2]=c.data[i+2];back.data[i+3]=255;
 }
 fc.putImageData(layer,0,0);bc.putImageData(back,0,0);
 // Lossless alpha is required: canopy holes must expose the separate sky.
 const leafFile=`${out}/${stem}-foliage.webp`,backFile=`${out}/${stem}-backing.webp`;
 fs.writeFileSync(leafFile,await foliage.encode('webp',94));fs.writeFileSync(backFile,await fill.encode('webp',94));
 const reflections=createCanvas(w,h),rx=reflections.getContext('2d'),reflect=rx.createImageData(w,h),water=illustratedEnvironment(mode,portrait).water;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  if(!water.some(region=>inside(x,y,region.polygon)))continue;
  const i=(y*w+x)*4,r=s.data[i],g=s.data[i+1],b=s.data[i+2];
  // Preserve the exact warm/pink/cyan reflected drawing. Blue surface paint
  // is not on this material plane and cannot brighten into generic glitter.
  const colored=Math.max(r-b*.75,g-b*.78),alpha=clamp((Math.max(r,g)-108)/105)*clamp((colored-8)/48);
  if(alpha<=0)continue;reflect.data[i]=r;reflect.data[i+1]=g;reflect.data[i+2]=b;reflect.data[i+3]=Math.round(alpha*255);
 }
 rx.putImageData(reflect,0,0);const reflectionFile=`${out}/${stem}-reflections.webp`;fs.writeFileSync(reflectionFile,await reflections.encode('webp',90));
 const composite=createCanvas(w,h),cc=composite.getContext('2d');cc.drawImage(source,0,0);cc.drawImage(fill,0,0);cc.drawImage(foliage,0,0);
 fs.writeFileSync(`${proof}/${stem}-layer-registration.webp`,await composite.encode('webp',82));
 rows.push({mode,portrait,width:w,height:h,source:`/kilo-v79/environment/${stem}.webp`,cleanSource:clean,foliage:`/kilo-v82/environment/${stem}-foliage.webp`,backing:`/kilo-v82/environment/${stem}-backing.webp`,reflections:`/kilo-v82/environment/${stem}-reflections.webp`,separatedPixels:pixels,bytes:fs.statSync(leafFile).size+fs.statSync(backFile).size+fs.statSync(reflectionFile).size,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(`public/kilo-v79/environment/${stem}.webp`)).digest('hex')});
 console.log(`${stem}: ${pixels} independently articulated foliage pixels, ${Math.round(rows.at(-1).bytes/1024)} KiB`);
}
fs.writeFileSync(`${proof}/layer-assets.json`,JSON.stringify({method:'Imagegen-authored source cleanup plus original-pixel registered alpha planes; no regenerated architecture or painted foreground is shipped.',rows,totalBytes:rows.reduce((n,r)=>n+r.bytes,0)},null,2)+'\n');
