import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {Container,Graphics,Text,Sprite,Texture,Rectangle} from './reel-renderer-mocks-v52.mjs';
import {fitGameLayout} from '../src/components/kilo/layout.ts';

const source=fs.readFileSync('src/components/kilo/reel-feature-effects.ts','utf8');
const v52=JSON.parse(fs.readFileSync('public/kilo-features-v52/manifest.json'));
const v53=JSON.parse(fs.readFileSync('public/kilo-features-v53/manifest.json'));
const textures=new Map([v52.chopper,v52.fisherman,v53.boat,v53.case].map(a=>[a.url,{source:{url:a.url},width:a.size[0],height:a.size[1]}]));
const exports={};
new Function('require','exports',ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}))(id=>{
  if(id==='pixi.js')return{Container,Graphics,Text,Sprite,Texture,Rectangle,Assets:{get:url=>textures.get(url),load:async url=>textures.get(url)}};
  if(id.includes('kilo-features-v53'))return v53;
  if(id.endsWith('manifest.json'))return v52;
  if(id.includes('feature-math'))return{FEATURE_NAMES:{yacht:'Yacht Stash',route:'Chopper Route',getaway:'The Getaway'}};
  assert.fail(id);
},exports);
const stage=fs.readFileSync('src/components/kilo/pixiStage.ts','utf8');
const tree=ts.createSourceFile('stage.ts',stage,ts.ScriptTarget.Latest,true);
const declaration=name=>{let found;function walk(n){if(ts.isFunctionDeclaration(n)&&n.name?.getText(tree)===name)found=n.getText(tree);ts.forEachChild(n,walk);}walk(tree);assert(found);return found;};
const fitReels=new Function(ts.transpile(['edgeFor','frameBorders','fitReels'].map(declaration).join('\n'),{target:ts.ScriptTarget.ES2022})+';return fitReels;')();
const sizes=[[1440,900],[390,844],[360,800],[844,390]];
const geometries=sizes.map(([w,h])=>{const pad=w<900?12:24,l=fitGameLayout(w-2*pad,h-2*pad);return fitReels(Math.round(l.reelWidth),Math.round(l.reelHeight));});
const rounds=JSON.parse(fs.readFileSync('art/kilo-features-v52/replay-examples.json'));
const result=[];
for(const speed of ['normal','turbo','super'])for(const reduced of [false,true])for(let size=0;size<sizes.length;size++)for(const mode of ['yacht','route','getaway-loss','getaway-max']){
  const round=rounds[mode];assert(round,mode);
  const world=new Container(),host=new EventTarget();let g=geometries[size],time=0,paid=0,dom=[];
  const assets=new Set(),sequences=new Set();
  const inspect=node=>{
    for(const p of [node.position,node.scale,node.pivot])assert(Number.isFinite(p.x)&&Number.isFinite(p.y),'finite transforms');
    if(node instanceof Sprite){assert(node.texture,'sprite has a texture');if(node.texture.source.url)assets.add(node.texture.source.url);}
    if(node.label)sequences.add(node.label);
    node.children.forEach(inspect);
  };
  globalThis.document={body:{appendChild:n=>dom.push(n)},createElement:()=>({style:{},offsetHeight:28,remove(){dom=dom.filter(x=>x!==this);}})};
  let afterMotion;
  const a={host,world,geom:()=>g,cell:()=>new Container(),stake:()=>round.stake,pace:()=>({speed,reduced}),live:()=>true,
    show(){},readout(){},screen:(x,y)=>({x,y}),landing:()=>({x:150,y:300}),bankCue(){},collect:async()=>{},highlight:async()=>{},
    hold:async ms=>{time+=ms;inspect(world);},
    tween:async(ms,paint)=>{time+=ms;for(const t of [0,.16,.32,.5,.62,.81,1]){paint(t);inspect(world);if(t===.5){g=geometries[(size+1)%sizes.length];host.dispatchEvent(new Event('kilo-relayout'));inspect(world);}}afterMotion?.();},
  };
  const ctl=exports.createReelFeatureEffects(a);
  await ctl.intro(round);
  assert(time<=1100,'entry including all motion <= 1.1 seconds');
  const expected=mode==='yacht'?v52.fisherman.url:mode==='route'?v52.chopper.url:v53.case.url;
  assert(assets.has(expected),`${mode} has its own entry emblem`);
  assert.equal(world.children[0].children[1].children.length,0,'entry clears completely');
  const introMs=time;
  if(mode.startsWith('getaway')){
    const e=round.free[0].mechanic;ctl.set(e,'before');time=0;
    await ctl.step(e,{award:n=>paid+=n,state(){}});
    assert(assets.has(v53.boat.url),'Getaway uses the custom extraction boat');
    assert(sequences.has(e.reel.won?'getaway-extraction':'getaway-intercept'),'correct visual result');
    assert.equal(paid,e.credited,'presentation credits precisely the recorded result');
    assert(time<=2400,'one short result, not an extended feature');
    assert.equal(dom.length,0,'no transfer left over');
    assert.equal(world.children[0].children[1].children.length,0,'result clears completely');
  }
  ctl.destroy();assert.equal(world.children.length,0);
  result.push({mode,speed,reduced,viewport:sizes[size],introMs,resultMs:mode.startsWith('getaway')?time:null});
}
// Check the art pass does not alter outcome generation or accepted sequences.
const baseline=JSON.parse(fs.readFileSync('art/kilo-features-v53/protected-v52.json'));
const protectedFiles=Object.keys(baseline.files);
for(const file of protectedFiles)assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),baseline.files[file],`unchanged v52 ${file}`);
for(const entry of [v53.boat,v53.case]){assert(fs.existsSync('public'+entry.url));assert(stage.includes(entry.url),'preloaded before play');}
fs.writeFileSync('art/kilo-features-v53/sequence-verification.json',JSON.stringify({method:'Production effect code with instrumented display objects; asset bindings, timing, finite transforms, resize and recorded credit. Not a browser render.',cases:result.length,protectedFiles,result},null,2)+'\n');
console.log(`PASS ${result.length} custom feature entry/result cases; v52 math, bank, layout and director unchanged.`);
