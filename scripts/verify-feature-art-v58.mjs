import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {Container,Graphics,Text,Sprite,Texture,Rectangle} from './reel-renderer-mocks-v52.mjs';
import {fitGameLayout} from '../src/components/kilo/layout.ts';

import {loadProduction} from './kilo-v56-test-loader.mjs';
const exports=loadProduction('src/components/kilo/reel-feature-effects.ts');
const vehicles={...JSON.parse(fs.readFileSync('public/kilo-v55/vehicles/manifest.json')),...JSON.parse(fs.readFileSync('public/kilo-v56/vehicles/manifest.json'))};
const v53=JSON.parse(fs.readFileSync('public/kilo-features-v53/manifest.json'));
const stage=fs.readFileSync('src/components/kilo/pixiStage.ts','utf8');
const tree=ts.createSourceFile('stage.ts',stage,ts.ScriptTarget.Latest,true);
const declaration=name=>{let found;function walk(n){if(ts.isFunctionDeclaration(n)&&n.name?.getText(tree)===name)found=n.getText(tree);ts.forEachChild(n,walk);}walk(tree);assert(found);return found;};
const fitReels=new Function(ts.transpile(['edgeFor','frameBorders','fitReels'].map(declaration).join('\n'),{target:ts.ScriptTarget.ES2022})+';return fitReels;')();
const sizes=[[1440,900],[390,844],[360,800],[844,390]];
const geometries=sizes.map(([w,h])=>{const pad=w<900?12:24,l=fitGameLayout(w-2*pad,h-2*pad);return fitReels(Math.round(l.reelWidth),Math.round(l.reelHeight));});
const rounds=JSON.parse(fs.readFileSync('art/kilo-features-v54/replay-examples.json'));
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
    show(){},readout(){},screen:(x,y)=>({x,y}),landing:()=>({x:150,y:300}),bankCue(){},collect:async()=>{},highlight:async(lines,cb)=>lines.forEach(cb),
    hold:async ms=>{time+=ms;inspect(world);},
    tween:async(ms,paint)=>{time+=ms;for(const t of [0,.16,.32,.5,.62,.81,1]){paint(t);inspect(world);if(t===.5){g=geometries[(size+1)%sizes.length];host.dispatchEvent(new Event('kilo-relayout'));inspect(world);}}afterMotion?.();},
  };
  const ctl=exports.createReelFeatureEffects(a);
  await ctl.intro(round);
  assert(time<=1100,'entry including all motion <= 1.1 seconds');
  const expected='/kilo-v56/features/'+(mode.startsWith('getaway')?'getaway':mode)+'.webp';
  assert(assets.has(expected),`${mode} has its own entry emblem`);
  assert.equal(world.children[0].children[1].children.length,0,'entry clears completely');
  const introMs=time;
  if(mode.startsWith('getaway')){
    const e=round.free[0].mechanic;ctl.set(e,'before');time=0;
    await ctl.step(e,{award:n=>paid+=n,state(){}});
    assert(assets.has(vehicles.boat.url),'Getaway uses the custom extraction boat');
    assert(sequences.has(e.reel.won?'getaway-extraction':'getaway-intercept'),'correct visual result');
    assert.equal(paid,e.credited,'presentation credits precisely the recorded result');
    assert(time<=3000,'one short result, not an extended feature');
    assert.equal(dom.length,0,'no transfer left over');
    assert.equal(world.children[0].children[1].children.length,0,'result clears completely');
  }
  if(mode==='yacht'){const e=round.free.find(s=>s.mechanic.reel.conversions.length)?.mechanic;assert(e);ctl.set(e,'before');await ctl.step(e,{award:n=>paid+=n,state(){}});assert(assets.has('/kilo-v58/vs/portraits.webp') && assets.has('/kilo-v58/vs/reel-strips.webp'),'pure VS has its custom opponent');assert(sequences.has('yacht-duel'),'duel presentation runs');assert(sequences.has('yacht-sticky-winner'),'winner settles on reel');assert.equal(paid,e.credited);}
  ctl.destroy();assert.equal(world.children.length,0);
  result.push({mode,speed,reduced,viewport:sizes[size],introMs,resultMs:mode.startsWith('getaway')?time:null});
}
// Presentation-only pass. The authoritative game and all accepted controls stay exact.
const protectedFiles=['src/lib/kilo/bank.ts','src/lib/kilo/engine.ts','src/lib/kilo/feature-math.ts','src/lib/kilo/reel-feature-math.ts','src/components/kilo/layout.ts','src/components/kilo/character-performance.ts','src/components/kilo/motion-atlas.ts','src/components/slot-controls/layout.ts','src/components/slot-controls/tokens.ts','src/components/slot-controls/controls.css','src/components/kilo/modular-controls.css','src/components/slot-controls/SlotControls.tsx'];
const {execFileSync}=await import('node:child_process');
for(const file of protectedFiles)assert.equal(fs.readFileSync(file,'utf8'),execFileSync('git',['show',`4e910c2:${file}`],{encoding:'utf8'}),`protected ${file}`);
const baselineStage=execFileSync('git',['show','4e910c2:src/components/kilo/pixiStage.ts'],{encoding:'utf8'});
function extract(text,name){const root=ts.createSourceFile('stage.ts',text,ts.ScriptTarget.Latest,true);let value;const walk=n=>{if((ts.isFunctionDeclaration(n)||ts.isMethodDeclaration(n))&&n.name?.getText(root)===name)value=n.getText(root);ts.forEachChild(n,walk);};walk(root);assert(value,name);return value;}
for(const name of ['collect','spinTo','highlight','fitReels','bonusLanding'])assert.equal(extract(stage,name),extract(baselineStage,name),`unchanged ${name}`);
for(const entry of [vehicles.boat,vehicles.chopper]){assert(fs.existsSync('public'+entry.url));assert(stage.includes(entry.url),'preloaded before play');}
fs.writeFileSync('art/kilo-v58/sequence-verification.json',JSON.stringify({method:'Production effect controller with instrumented display objects; not a browser/GPU render.',cases:result.length,protectedFiles,result},null,2)+'\n');
console.log(`PASS ${result.length} feature entry/result cases, pure VS custom-asset bindings, and protected collector/reel/layout/bank source equality.`);
