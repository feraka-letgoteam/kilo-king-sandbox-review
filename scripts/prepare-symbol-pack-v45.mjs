/** Deterministic production fitting only; drawings are authored by image generation.
 * Run: node scripts/prepare-symbol-pack-v45.mjs /absolute/selected-inputs.json
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const runtimeRequire = createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules', 'package.json'));
let sharp; try { sharp=(await import('sharp')).default; } catch { sharp=runtimeRequire('sharp'); }
const inputFile=process.argv[2];
if (!inputFile) throw Error('Pass the selected-inputs.json path.');
const selected=JSON.parse(fs.readFileSync(inputFile,'utf8'));
const output='public/kilo-symbols-v45';
const originals='art/kilo-symbols-v45/originals';
fs.mkdirSync(output,{recursive:true});fs.mkdirSync(originals,{recursive:true});
const definitions={
 'sym-10':{canvas:[1024,1024],box:[82,200,942,823]},
 'sym-j':{canvas:[1024,1024],box:[117,82,907,942]},
 'sym-q':{canvas:[1024,1024],box:[82,109,942,915]},
 'sym-k':{canvas:[1024,1024],box:[82,161,942,863]},
 'sym-a':{canvas:[1024,1024],box:[82,150,942,874]},
 'sym-bobber':{canvas:[1024,1024],box:[128,65,909,965]},
 'sym-cash-roll':{canvas:[1024,1024],box:[169,66,841,967]},
 'sym-reel-v8':{canvas:[1254,1254],box:[31,244,1226,1078]},
 'sym-case-v8':{canvas:[1254,1254],box:[44,56,1234,1209]},
 'package-small':{canvas:[1254,1254],box:[47,331,1222,1021]},
 'package-medium':{canvas:[1254,1254],box:[16,289,1242,1026]},
 'package-trophy':{canvas:[1254,1254],box:[14,200,1240,1117]},
 'package-king':{canvas:[1254,1254],box:[6,148,1245,1096]},
 'scatter-king':{canvas:[1254,1254],box:[29,24,1226,1222]},
};
async function bounds(bytes,threshold=64){
 const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let l=info.width,t=info.height,r=-1,b=-1,n=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>threshold){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);n++;}
 if(r<0)throw Error('Empty alpha drawing');
 return {box:[l,t,r+1,b+1],opaquePixels:n,totalPixels:info.width*info.height};
}
const hash=x=>createHash('sha256').update(x).digest('hex');
const manifest={version:45,status:'selected-runtime-art',style:'Clean illustrated cartoon volume; shaped material lighting and refined edges',alphaThreshold:64,assets:{}};
const reproducibleInputs={};
for(const [name,def] of Object.entries(definitions)){
 const src=selected[name];if(!src)throw Error(`Missing selected drawing ${name}`);
 const bytes=fs.readFileSync(src), sourceMeta=await sharp(bytes).metadata();
 if(!sourceMeta.hasAlpha)throw Error(`${name} requires real transparency`);
 const ext=path.extname(src);
 if(path.resolve(src)!==path.resolve(`${originals}/${name}${ext}`))fs.copyFileSync(src,`${originals}/${name}${ext}`);
 reproducibleInputs[name]=`${originals}/${name}${ext}`;
 const meaningful=await bounds(bytes,64);
 const l=Math.max(0,meaningful.box[0]-2),t=Math.max(0,meaningful.box[1]-2);
 const r=Math.min(sourceMeta.width,meaningful.box[2]+2),b=Math.min(sourceMeta.height,meaningful.box[3]+2);
 const [x0,y0,x1,y1]=def.box;
 let maxWidth=x1-x0,maxHeight=y1-y0;
 if(def.landmark){
  const [ax,ay]=def.landmark,[px,py]=def.pivot;
  const scale=Math.min(maxWidth/(r-l),maxHeight/(b-t),px/Math.max(1,ax-l),(def.canvas[0]-px)/Math.max(1,r-ax),py/Math.max(1,ay-t),(def.canvas[1]-py)/Math.max(1,b-ay));
  maxWidth=Math.round((r-l)*scale);maxHeight=Math.round((b-t)*scale);
 }
 const fitted=await sharp(bytes).extract({left:l,top:t,width:r-l,height:b-t}).resize({width:maxWidth,height:maxHeight,fit:'inside',kernel:'lanczos3'}).png().toBuffer();
 const fittedMeta=await sharp(fitted).metadata();
 const left=def.landmark?Math.round(def.pivot[0]-(def.landmark[0]-l)*fittedMeta.width/(r-l)):Math.round((x0+x1-fittedMeta.width)/2);
 const top=def.landmark?Math.round(def.pivot[1]-(def.landmark[1]-t)*fittedMeta.height/(b-t)):Math.round((y0+y1-fittedMeta.height)/2);
 const final=await sharp({create:{width:def.canvas[0],height:def.canvas[1],channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:fitted,left,top}]).webp({lossless:true}).toBuffer();
 fs.writeFileSync(`${output}/${name}.webp`,final);
 const actual=await bounds(final);
 manifest.assets[name]={file:`${name}.webp`,width:def.canvas[0],height:def.canvas[1],bounds:actual.box,previousFitBox:def.box,sourceCropAlphaThreshold:64,sourceCropPadding:2,sha256:hash(final),sourceFile:`${originals}/${name}${ext}`,sourceSha256:hash(bytes),...(def.landmark?{registration:{sourceLandmark:def.landmark,targetPivot:def.pivot,resolvedPivot:[left+(def.landmark[0]-l)*fittedMeta.width/(r-l),top+(def.landmark[1]-t)*fittedMeta.height/(b-t)]}}:{})};
}
for(const name of ['collector-idle','collector-reaction-atlas']){
 if(!selected[name])throw Error(`Missing ${name}`);
 const bytes=fs.readFileSync(selected[name]);const meta=await sharp(bytes).metadata();
 if(!meta.hasAlpha)throw Error(`${name} requires alpha`);
 const canvas=name.endsWith('atlas')?[1774,887]:[444,444];
 if(meta.width!==canvas[0]||meta.height!==canvas[1])throw Error(`Wrong registered canvas ${name}`);
 fs.copyFileSync(selected[name],`${output}/${name}.png`);
 if(path.resolve(selected[name])!==path.resolve(`${originals}/${name}.png`))fs.copyFileSync(selected[name],`${originals}/${name}.png`);
 reproducibleInputs[name]=`${originals}/${name}.png`;
 manifest.assets[name]={file:`${name}.png`,width:meta.width,height:meta.height,sha256:hash(bytes),bounds:(await bounds(bytes)).box};
}
fs.writeFileSync(`${output}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync('art/kilo-symbols-v45/selected-inputs.json',JSON.stringify(reproducibleInputs,null,2)+'\n');
console.log(JSON.stringify({output,assets:Object.keys(manifest.assets).length}));
