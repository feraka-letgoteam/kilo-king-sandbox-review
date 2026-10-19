// Loads production TS with instrumented Pixi objects. This does not render pixels.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as mocks from './reel-renderer-mocks-v52.mjs';
const nativeRequire=createRequire(import.meta.url),cache=new Map(),textures=new Map();
export const cropCounts=new Map();
class Texture extends mocks.Texture {
  constructor(options){super(options);const url=options.source?.url;cropCounts.set(url,(cropCounts.get(url)??0)+1);}
  get width(){return this.frame?.width??this.source?.width??1;}
  get height(){return this.frame?.height??this.source?.height??1;}
}
const packs=['kilo-features-v52','kilo-features-v53','kilo-features-v54','kilo-v55/vehicles','kilo-v56/vehicles'];
for(const pack of packs){const manifest=JSON.parse(fs.readFileSync(`public/${pack}/manifest.json`));for(const item of Object.values(manifest))if(item?.url&&item?.size)textures.set(item.url,{source:{url:item.url,width:item.size[0],height:item.size[1]},width:item.size[0],height:item.size[1]});}
for(const actor of ['king','vice']){const url=`/kilo-v55/characters/${actor}/parts.webp`;textures.set(url,{source:{url,width:768,height:768},width:768,height:768});}
{const face=JSON.parse(fs.readFileSync('public/kilo-v57/characters/king-blink.json'));textures.set(face.atlas,{source:{url:face.atlas,width:face.width,height:face.height},width:face.width,height:face.height});}
for(const key of ['dock','yacht','route','getaway']){const url=`/kilo-v56/features/${key}.webp`;textures.set(url,{source:{url,width:768,height:512},width:768,height:512});}
for(const [url,width,height] of [['/kilo-v58/vs/portraits.webp',1536,1536],['/kilo-v58/vs/reel-strips.webp',768,1920]])textures.set(url,{source:{url,width,height},width,height});
for(const [url,width,height] of [['/kilo-v59/environment/getaway-super-symbol.webp',1600,960],['/kilo-v59/vs/actions.webp',2048,1024],['/kilo-v59/vs/winner-reels.webp',768,1152]])textures.set(url,{source:{url,width,height},width,height});
textures.set('/kilo-v61/vs/king-action.png',{source:{url:'/kilo-v61/vs/king-action.png',width:1774,height:887},width:1774,height:887});
for(const [url,width,height] of [['/kilo-v62/max/hull.png',1619,971],['/kilo-v62/max/performance-parts.png',1536,1024]])textures.set(url,{source:{url,width,height},width,height});
export const pixi={...mocks,Texture,Assets:{get:url=>textures.get(url),load:async url=>{if(!textures.has(url))throw Error(`Missing instrumented texture ${url}`);return textures.get(url);}}};

export function loadProduction(filename){
  let full=path.resolve(filename);
  if(!fs.existsSync(full)){full=['.ts','.tsx','.json'].map(ext=>full+ext).find(f=>fs.existsSync(f));if(!full)throw Error(`Missing module ${filename}`);}
  if(cache.has(full))return cache.get(full);
  if(full.endsWith('.json'))return JSON.parse(fs.readFileSync(full,'utf8'));
  const result={};cache.set(full,result);
  const js=ts.transpileModule(fs.readFileSync(full,'utf8'),{fileName:full,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const require=id=>id==='pixi.js'?pixi:id.startsWith('@/')?loadProduction(path.join('src',id.slice(2))):id.startsWith('.')?loadProduction(path.join(path.dirname(full),id)):nativeRequire(id);
  new Function('require','exports',js)(require,result);return result;
}
