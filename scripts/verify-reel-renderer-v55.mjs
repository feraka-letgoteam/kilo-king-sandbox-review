import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {Container,Graphics,Text,Sprite,Texture,Rectangle} from './reel-renderer-mocks-v52.mjs';
import {fitGameLayout} from '../src/components/kilo/layout.ts';
import {loadProduction} from './kilo-v55-test-loader.mjs';
const exports=loadProduction('src/components/kilo/reel-feature-effects.ts');
const stage=fs.readFileSync('src/components/kilo/pixiStage.ts','utf8');
function extract(name){const tree=ts.createSourceFile('stage.ts',stage,ts.ScriptTarget.Latest,true);let found;function walk(n){if(ts.isFunctionDeclaration(n)&&n.name?.getText(tree)===name)found=n.getText(tree);ts.forEachChild(n,walk);}walk(tree);assert(found);return found;}
const fitReels=new Function(ts.transpile(['edgeFor','frameBorders','fitReels'].map(extract).join('\n'),{target:ts.ScriptTarget.ES2022})+';return fitReels;')();
const viewports=[[1440,900],[390,844],[360,800],[844,390]],geometries=viewports.map(([w,h])=>{const pad=w<900?12:24,l=fitGameLayout(w-2*pad,h-2*pad);return{viewport:[w,h],...fitReels(Math.round(l.reelWidth),Math.round(l.reelHeight))};});
const rounds={...JSON.parse(fs.readFileSync('art/kilo-features-v52/replay-examples.json','utf8')),...JSON.parse(fs.readFileSync('art/kilo-features-v54/replay-examples.json','utf8'))};
const cases=[];
for(const [name,round] of Object.entries(rounds)){
 const free=round.free;
 const chosen=new Set([0,free.length-1]);
 const vs=free.findIndex(f=>f.mechanic.reel.type==='vs'&&f.mechanic.reel.conversions.length);if(vs>=0)chosen.add(vs);
 const tumble=free.findIndex(f=>f.mechanic.reel.type==='tumble'&&f.mechanic.reel.cascades.length>=2);if(tumble>=0)chosen.add(tumble);
 for(const index of chosen)cases.push({name:`${name}:${index}`,round,e:free[index].mechanic});
}
let runs=0,interruptions=0,resizes=0,transfers=0,fullSequence=0;const categories=new Set();
for(const speed of ['normal','turbo','super'])for(const reduced of [false,true])for(let gi=0;gi<geometries.length;gi++)for(const change of ['none','resize','skip'])for(const {name,round,e} of cases){
 let g={...geometries[gi]},live=true,calls=0,changed=false,paid=0,shown,dom=[];const world=new Container(),host=new EventTarget();let ctl;
 globalThis.document={body:{appendChild:n=>dom.push(n)},createElement:()=>({style:{},offsetHeight:28,remove(){dom=dom.filter(x=>x!==this);}})};
 const inspect=()=>{for(const el of dom){assert(Number.isFinite(parseFloat(el.style.left)));assert(Number.isFinite(parseFloat(el.style.top)));assert(parseFloat(el.style.opacity)>=0&&parseFloat(el.style.opacity)<=1);transfers++;}};
 const mutation=()=>{calls++;if(changed||calls<3)return;if(change==='resize'){g={...geometries[(gi+1)%geometries.length]};host.dispatchEvent(new Event('kilo-relayout'));changed=true;resizes++;}if(change==='skip'){live=false;ctl.cancel();changed=true;interruptions++;}};
 const a={host,world,geom:()=>g,cell:(c,size)=>{const n=new Container();n.width=size;n.height=size;return n;},stake:()=>round.stake,pace:()=>({speed,reduced}),live:()=>live,
 show:grid=>shown=grid,readout(){},screen:(x,y)=>({x,y}),landing:()=>({x:g.dw/2,y:g.dh+60}),
 bankCue:(value)=>{assert(value>0);assert.equal(dom.length,0,'transfer removed before readout credit');},
 collect:async()=>{mutation();},highlight:async(lines,cb)=>{for(const l of lines){if(live)cb(l);mutation();}},
 hold:async ms=>{assert(ms>=0&&ms<=1100);mutation();},
 tween:async(ms,paint)=>{assert(ms>=0&&ms<=1100);for(const t of [0,.25,.5,.75,1]){paint(t);inspect();mutation();}},
 };
 ctl=exports.createReelFeatureEffects(a);ctl.set(e,'before');
 const frozen=JSON.stringify(e);await ctl.step(e,{award:value=>{assert(live,'no late credit after interruption');paid+=value;assert(paid<=e.credited,'no duplicate presentation credit');},state:state=>{assert(state.multiplier>=1);if(state.reel.type==='vs')assert(state.reel.after.length<=e.reel.after.length);}});
 assert.equal(dom.length,0,'no orphan DOM flyer');assert.equal(JSON.stringify(e),frozen,'immutable event');
 if(live){assert.equal(paid,e.credited,`${name} credited amount`);fullSequence++;}
 ctl.set(e,'after');host.dispatchEvent(new Event('kilo-relayout'));ctl.set(null);assert.equal(world.children[0].children[0].children.length,0,'no persistent state crosses into next round');
 ctl.destroy();assert.equal(world.children.length,0,'destroy owns all its display objects');
 categories.add(e.reel.type);runs++;
}
// Entry maximum duration includes motion and hold, not just its pause.
for(const round of [rounds.yacht,rounds.route,rounds['getaway-loss']]){
 const world=new Container(),host=new EventTarget();let held=0;const ctl=exports.createReelFeatureEffects({host,world,geom:()=>geometries[1],cell:()=>new Container(),stake:()=>1000,pace:()=>({speed:'normal',reduced:false}),live:()=>true,hold:async ms=>held+=ms,tween:async(ms,fn)=>{held+=ms;fn(1);},show(){},collect:async()=>{},highlight:async()=>{},readout(){},screen:(x,y)=>({x,y}),landing:()=>null,bankCue(){}});
 await ctl.intro(round);assert(held<=1500);assert.equal(world.children[0].children[1].children.length,0,'entry banner clears');ctl.destroy();
}
fs.writeFileSync('art/kilo-v55/renderer-verification.json',JSON.stringify({method:'Production Pixi effect controller with instrumented display objects. Actual layout geometry, all speeds, reduced motion, resize and Skip. NOT browser/GPU/video proof.',runs,fullSequence,interruptions,resizes,transfers,viewports,categories:[...categories],entryMaxMs:1100},null,2)+'\n');
console.log(`PASS ${runs} production effect sequences, ${resizes} resizes and ${interruptions} interruptions, all four viewport geometries.`);
