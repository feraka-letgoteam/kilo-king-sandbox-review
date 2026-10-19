import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {loadProduction} from './kilo-v55-test-loader.mjs';
const req=createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules','package.json'));
const sharp=req('sharp');
const {AUTHORED_CLIPS}=loadProduction('src/components/kilo/authored-clips.ts');
const {authoredRegistration}=loadProduction('src/components/kilo/authored-animation.ts');
const {PACKAGE_META,V8_META,SCATTER_KING}=loadProduction('src/components/kilo/fish-art.ts');
const symbols=JSON.parse(fs.readFileSync('public/kilo-v55/symbols/manifest.json'));
const vehicles=JSON.parse(fs.readFileSync('public/kilo-v55/vehicles/manifest.json'));
const results=[];
for(const item of symbols.symbols){
  const file='public'+item.new,bytes=fs.readFileSync(file),meta=await sharp(bytes).metadata();
  assert(meta.hasAlpha);assert.deepEqual([meta.width,meta.height],item.canvas);assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);
  const baseline=item.name.startsWith('package-')?PACKAGE_META[item.name]:item.name==='scatter-king'?SCATTER_KING:V8_META[item.name];
  if(baseline)assert.deepEqual(baseline.bounds,item.preservedRuntimeBounds,'existing placement metadata');
  if(!symbols.reactions.some(r=>r.key===item.name))assert(!AUTHORED_CLIPS[item.name],'old illustration cannot flash during reaction');
  results.push({url:item.new,dimensions:item.canvas,alpha:true});
}
for(const clip of symbols.reactions){
  assert.deepEqual(AUTHORED_CLIPS[clip.key],clip);
  const fit=authoredRegistration(clip,1254,1254);assert(Math.abs(fit.scale-1254/512)<1e-9);assert(Math.abs(fit.x)<1e-9&&Math.abs(fit.y)<1e-9,'no art-size jump');
  for(const f of clip.frames)assert(f.x>=0&&f.y>=0&&f.x+f.w<=clip.width&&f.y+f.h<=clip.height);
}
const oldClips=JSON.parse(fs.readFileSync('art/kilo-animation-v49/runtime-clips.json'));
assert.deepEqual(AUTHORED_CLIPS.collector,oldClips.collector,'protected collector drawing sequence');
for(const key of ['chopper','boat']){const a=vehicles[key],meta=await sharp('public'+a.url).metadata();assert(meta.hasAlpha);assert.deepEqual([meta.width,meta.height],a.size);assert.equal(a.frames.length,8);for(const f of a.frames){const [x,y,w,h]=f.rect;assert(x>=0&&y>=0&&x+w<=meta.width&&y+h<=meta.height);}results.push({url:a.url,dimensions:a.size,alpha:true});}
const frame=await sharp('public/kilo-v55/frame/cabinet.webp').ensureAlpha().raw().toBuffer({resolveWithObject:true});
assert.deepEqual([frame.info.width,frame.info.height],[1536,1024]);assert.equal(frame.data[(512*1536+768)*4+3],0,'transparent cabinet opening');
if(process.argv.includes('--dist')){
  const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
  for(const file of walk('public/kilo-v55'))assert.deepEqual(fs.readFileSync(file),fs.readFileSync(file.replace(/^public/,'dist')),'built asset bytes '+file);
}
fs.writeFileSync('art/kilo-v55/asset-verification.json',JSON.stringify({method:'Decoded metadata, alpha, SHA and production registration functions; no live renderer claim.',results,matchingReactions:2,protectedCollector:true,dist:process.argv.includes('--dist')},null,2)+'\n');
console.log('PASS nine symbols, two registered reactions, both vehicle atlases, transparent cabinet and protected collector'+(process.argv.includes('--dist')?'; built asset bytes match.':'.'));
