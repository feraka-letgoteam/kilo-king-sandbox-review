/** Source and native decoded-art QA. Does not launch or claim a browser. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {ART,ART_ROOT,SYMBOL_ALPHA,TOOL_PIVOTS} from '../src/components/kilo/art-map.ts';
import {V8_ROOT,V8_META,CONTRABAND_ROOT,PACKAGE_META,SCATTER_KING} from '../src/components/kilo/fish-art.ts';
import {MOTION_ROOT,collectorAtlas} from '../src/components/kilo/motion-atlas.ts';
let sharp;try{sharp=(await import('sharp')).default;}catch{sharp=createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules','package.json'))('sharp');}
const checkpoint='c3c31d0ece5f51bca23db7518d4d862e7585d3d3';
const checks=[];
const read=p=>fs.readFileSync(p,'utf8');
const baseline=p=>execFileSync('git',['show',`${checkpoint}:${p}`],{maxBuffer:30e6});
const hash=x=>createHash('sha256').update(x).digest('hex');
function check(name,f){try{const detail=f();checks.push({name,passed:true,...(detail?{detail}:{})});}catch(e){checks.push({name,passed:false,detail:String(e.message||e)});}}
const exceptions=new Set(['art-map.ts','fish-art.ts','motion-atlas.ts','pixiStage.ts','play.tsx','feature-takeover.tsx','IntegratedScene.tsx','integrated-scene-model.ts','integrated-scene.css']);
const sources=execFileSync('git',['ls-tree','-r','--name-only',checkpoint,'src/components/kilo','src/components/slot-controls','src/lib/kilo'],{encoding:'utf8'}).trim().split('\n');
for(const file of sources.filter(p=>!exceptions.has(path.basename(p))))check(`Protected source unchanged: ${file}`,()=>assert.equal(hash(fs.readFileSync(file)),hash(baseline(file))));
for(const file of ['public/kilo-scene-v15/logo-stacked.webp','public/kilo-ui-v11/logo-kilo-king.webp','public/kilo-night-v3/logo-kilo-king.png'])check(`Original logo unchanged: ${file}`,()=>assert.equal(hash(fs.readFileSync(file)),hash(baseline(file))));
const printer=ts.createPrinter({removeComments:true});
const parse=(file,text)=>ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
const printed=(node,s)=>printer.printNode(ts.EmitHint.Unspecified,node,s);
function outside(s,ignored){return s.statements.filter(n=>!ts.isVariableStatement(n)||!n.declarationList.declarations.every(d=>ignored.includes(d.name.getText(s)))).map(n=>printed(n,s));}
function props(s,name,ignored=[]){let d;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(s)===name)d=n;ts.forEachChild(n,visit);}visit(s);assert(d?.initializer);let o=d.initializer;while(ts.isAsExpression(o)||ts.isSatisfiesExpression(o))o=o.expression;assert(ts.isObjectLiteralExpression(o));return Object.fromEntries(o.properties.filter(p=>!ignored.includes(p.name?.getText(s).replaceAll('"',''))).map(p=>[p.name?.getText(s),printed(p,s)]));}
function guard(file,ignored){const p=`src/components/kilo/${file}`,a=parse(p,read(p)),b=parse(p,baseline(p).toString());assert.deepEqual(outside(a,ignored),outside(b,ignored));return {a,b};}
check('art-map changes are artwork paths/alpha only; tool canvases and pivots retained',()=>{
 const {a,b}=guard('art-map.ts',['ART','SYMBOL_ALPHA','TOOL_PIVOTS']);
 const toolText=s=>JSON.stringify(props(s,'TOOL_PIVOTS')).replace(/(?:\.\.\/kilo-symbols-v44\/)?tool-(hook|dynamite|bazooka)\.(png|webp)/g,'tool-$1');
 assert.equal(toolText(a),toolText(b));
});
check('Package values, tiers, fit function, reaction motion and scatter budgets unchanged',()=>{
 const {a,b}=guard('fish-art.ts',['CONTRABAND_ROOT','V8_META','PACKAGE_META','SCATTER_KING']);
 assert.deepEqual(props(a,'V8_META',['sym-reel-v8','sym-case-v8']),props(b,'V8_META',['sym-reel-v8','sym-case-v8']));
 assert.deepEqual(props(a,'SCATTER_KING',['file','width','height','bounds']),props(b,'SCATTER_KING',['file','width','height','bounds']));
});
check('Collector frame rectangles, sequencing and reaction timings unchanged',()=>{
 const {a,b}=guard('motion-atlas.ts',['collectorAtlas']);
 assert.deepEqual(props(a,'collectorAtlas',['image']),props(b,'collectorAtlas',['image']));
});
for(const file of ['play.tsx','pixiStage.ts','feature-takeover.tsx'])check(`Only artwork references/camera prop changed in ${file}`,()=>{
 const p=`src/components/kilo/${file}`;
 function normalized(text){return text
 .replace(/\s+stageSize=\{\{ width: stageWidth, height: stageHeight \}\}/g,'')
 .replaceAll('/kilo-symbols-v44/collector-idle.png','/kilo-motion-v7/collector-idle.png')
 .replaceAll('/kilo-symbols-v44/scatter-king.webp','/kilo-contraband-v1/scatter-king.png')
 .replaceAll('/kilo-symbols-v44/sym-case-v8.webp','/kilo-symbols-v8/sym-case-v8.png');}
 assert.equal(printed(parse(p,normalized(read(p))),parse(p,normalized(read(p)))),printed(parse(p,baseline(p).toString()),parse(p,baseline(p).toString())));
});
const manifest=JSON.parse(read('public/kilo-symbols-v44/manifest.json'));
const assets=[];
const url=(root,file)=>path.posix.normalize(root+file);
for(const [sym,file]of Object.entries(ART))if(['10','J','Q','K','A','cuffs','keys'].includes(sym))assets.push({key:sym==='cuffs'?'sym-bobber':sym==='keys'?'sym-can':`sym-${sym.toLowerCase()}`,url:url(ART_ROOT,file),width:1024,height:1024,bounds:SYMBOL_ALPHA[sym]});
for(const [key,m]of Object.entries(PACKAGE_META))assets.push({key,url:url(CONTRABAND_ROOT,m.file),...m});
for(const key of ['sym-reel-v8','sym-case-v8'])assets.push({key,url:url(V8_ROOT,V8_META[key].file),...V8_META[key]});
assets.push({key:'scatter-king',url:url(CONTRABAND_ROOT,SCATTER_KING.file),...SCATTER_KING});
async function alphaBounds(bytes){const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});let l=info.width,t=info.height,r=-1,b=-1,clear=0;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const a=data[(y*info.width+x)*4+3];if(a===0)clear++;if(a>64){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}}return {bounds:[l,t,r+1,b+1],clear};}
for(const item of assets){try{
 assert(item.url.startsWith('/kilo-symbols-v44/'));
 const bytes=fs.readFileSync(`public${item.url}`),m=await sharp(bytes).metadata(),alpha=await alphaBounds(bytes);
 assert.equal(m.width,item.width);assert.equal(m.height,item.height);assert(m.hasAlpha&&alpha.clear>m.width*m.height*.05);
 assert.deepEqual(alpha.bounds,[...item.bounds]);assert.equal(manifest.assets[item.key].sha256,hash(bytes));
 checks.push({name:`Decoded registered artwork: ${item.key}`,passed:true,detail:{url:item.url,canvas:[m.width,m.height],bounds:alpha.bounds}});
}catch(e){checks.push({name:`Decoded registered artwork: ${item.key}`,passed:false,detail:String(e.message||e)});}}
check('All14 static reel identities are uniquely registered',()=>assert.equal(assets.length,14));
for(const [key,tool]of Object.entries(TOOL_PIVOTS)){try{
 const urlPath=url(ART_ROOT,tool.file),bytes=fs.readFileSync(`public${urlPath}`),m=await sharp(bytes).metadata(),a=await alphaBounds(bytes);
 assert(urlPath.startsWith('/kilo-symbols-v44/'));assert.deepEqual([m.width,m.height],[tool.width,tool.height]);assert(m.hasAlpha&&a.clear>m.width*m.height*.05);
 assert.equal(hash(bytes),manifest.assets[`tool-${key}`].sha256);
 const registration=manifest.assets[`tool-${key}`].registration;
 if(key==='hook'||key==='bazooka'){
  assert(registration,'Missing source-landmark registration');
  assert.deepEqual(registration.targetPivot,[tool.x,tool.y]);
  registration.resolvedPivot.forEach((v,i)=>assert(Math.abs(v-registration.targetPivot[i])<=.5,'Tool attachment drift exceeds half a source pixel'));
 }
 checks.push({name:`Decoded registered tool: ${key}`,passed:true});
}catch(e){checks.push({name:`Decoded registered tool: ${key}`,passed:false,detail:String(e.message||e)});}}
for(const [key,urlPath,canvas]of [['collector-idle','/kilo-symbols-v44/collector-idle.png',[444,444]],['collector-reaction-atlas',url(MOTION_ROOT,collectorAtlas.image),[1774,887]]]){try{
 const bytes=fs.readFileSync(`public${urlPath}`),m=await sharp(bytes).metadata(),a=await alphaBounds(bytes);
 assert(urlPath.startsWith('/kilo-symbols-v44/'));assert.deepEqual([m.width,m.height],canvas);assert(m.hasAlpha&&a.clear>m.width*m.height*.05);assert.equal(hash(bytes),manifest.assets[key].sha256);
 checks.push({name:`Decoded collector: ${key}`,passed:true});
}catch(e){checks.push({name:`Decoded collector: ${key}`,passed:false,detail:String(e.message||e)});}}
check('All visible collector portraits share one new asset',()=>{
 assert.equal(url(ART_ROOT,ART.splash),'/kilo-symbols-v44/collector-idle.png');
 for(const f of ['play.tsx','pixiStage.ts']){const text=read(`src/components/kilo/${f}`);assert(text.includes('/kilo-symbols-v44/collector-idle.png'));assert(!text.includes('/kilo-motion-v7/collector-idle.png'));}
});
check('Feature art uses current scatter and case',()=>{const t=read('src/components/kilo/feature-takeover.tsx');assert(t.includes('/kilo-symbols-v44/scatter-king.webp'));assert(t.includes('/kilo-symbols-v44/sym-case-v8.webp'));});
const failed=checks.filter(c=>!c.passed),report={checkpoint,verification:'Source, decoded-art and native proof only; live browser unverified',passed:checks.length-failed.length,total:checks.length,checks};
fs.writeFileSync('public/kilo-symbols-v44/verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total,failed},null,2));if(failed.length)process.exitCode=1;
