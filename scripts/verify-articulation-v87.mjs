/** Production vertex fields + actual Pixi object/geometry ownership checks.
 * No browser, WebGL context, frame-rate or hardware/audio claims. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as pixi from 'pixi.js';
import {createOfflineRuntime,findAll,walk} from './offline-runtime-v79.mjs';
import {sourceFingerprint} from './v79-source-fingerprint.mjs';
const fingerprint=sourceFingerprint(),r=createOfflineRuntime(),motion=r.load('src/components/kilo/articulation.ts');
const symbols=['10','J','Q','K','A','brick','keys','duffel','lamp','cuffs','splash','bars'];
let triangles=0,maxDisplacement=0;
for(const symbol of symbols)for(const action of ['hit','land','haul','collector','wild'])for(let frame=0;frame<=100;frame++){
 const p=frame/100,grid=[];
 for(let row=0;row<8;row++)for(let col=0;col<8;col++){
  const x=col/7,y=row/7,q=motion.artVertexAt(x,y,symbol,p,action,1.55);grid.push(q);
  assert(Number.isFinite(q.x)&&Number.isFinite(q.y));
  maxDisplacement=Math.max(maxDisplacement,Math.hypot(q.x-x,q.y-y));
  if(frame===0||frame===100)assert.deepEqual(q,{x,y},'Exact source at both endpoints');
 }
 for(let row=0;row<7;row++)for(let col=0;col<7;col++)for(const ids of [[0,1,8],[1,9,8]]){
  const [a,b,c]=ids.map(i=>grid[row*8+col+i]);
  assert((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)>0,'No folded / inverted triangles');triangles++;
 }
}
assert(maxDisplacement<.15,'Contained within the illustration, not a reel-scale displacement');

// Exercise the real installed Pixi classes, not just the display-list doubles.
const actual=createOfflineRuntime({moduleOverrides:{'pixi.js':pixi}}).load('src/components/kilo/articulation.ts');
const root=new pixi.Container(),sprite=new pixi.Sprite(pixi.Texture.EMPTY),label=new pixi.Text({text:'10,000'});
sprite.anchor.set(.5,.6);sprite.position.set(20,30);sprite.scale.set(64);root.addChild(sprite,label);
const saved={x:label.x,y:label.y,scale:label.scale.x,text:label.text};
actual.articulateArt(sprite,'brick',.33,'haul');
const mesh=root.children.find(n=>n.label==='articulated-illustration');
assert(mesh instanceof pixi.MeshSimple);assert.equal(mesh.vertices.length,128);assert.equal(sprite.visible,false);
assert.equal(mesh.texture,sprite.texture);assert.deepEqual([mesh.x,mesh.y],[sprite.x,sprite.y]);
assert.equal(mesh.scale.x,sprite.scale.x);assert.equal(mesh.geometry.getBuffer('aPosition').data,mesh.vertices);
assert.deepEqual({x:label.x,y:label.y,scale:label.scale.x,text:label.text},saved,'Printed amount stays still');
let freed=0;const destroyGeometry=mesh.geometry.destroy.bind(mesh.geometry);mesh.geometry.destroy=()=>{freed++;destroyGeometry();};
actual.restoreArticulation(sprite);assert.equal(sprite.visible,true);assert.equal(freed,1);assert.equal(root.children.length,2);
actual.articulateArt(sprite,'brick',.3,'hit');const interrupted=root.children.find(n=>n.label==='articulated-illustration');
const dispose=interrupted.geometry.destroy.bind(interrupted.geometry);interrupted.geometry.destroy=()=>{freed++;dispose();};
root.destroy({children:true});assert.equal(freed,2,'Parent / resize destruction also releases owned GPU geometry');

// Actual collect method emits only the existing bank, with two small cranking
// performances and one final acknowledgement at that bank (not a new credit).
const rt=createOfflineRuntime(),round=rt.load('src/lib/kilo/fixtures.json')['tool-bazooka'].script,spin=round.free[15];
const host=rt.host(390,250),scene=await rt.load('src/components/kilo/pixiStage.ts').mountScene(host);
scene.setStake(round.stake);scene.show(spin.grid);const actions=[],banks=[];let meshFrames=0;
host.addEventListener('kilo-stage-action',e=>actions.push(e.detail.kind));
host.addEventListener('kilo-collection',e=>{if(e.detail?.phase==='bank')banks.push(e.detail.completed);});
await rt.drive(scene.collect(spin),{step:16,onFrame(){
 if(findAll(rt.apps[0].stage,'articulated-illustration').length)meshFrames++;
}});
assert.deepEqual(banks,[48000]);assert.deepEqual(actions,['collect','collect','collect-bank']);
assert(meshFrames>10,'The actual collector uses the continuous material field');
assert.equal(findAll(rt.apps[0].stage,'articulated-illustration').length,0,'No stranded mesh after collection');scene.destroy();

// Resize / Skip a normal landed hit: the source and the companion must both
// be removed, with no symbol duplicated or left invisible on the new board.
const interruptions=[];
for(const speed of ['normal','turbo','super'])for(const action of ['resize','skip']){
 const q=createOfflineRuntime(),host=q.host(390,250),sc=await q.load('src/components/kilo/pixiStage.ts').mountScene(host);
 const grid=Array.from({length:5},()=>[{s:'J'},{s:'brick',v:2},{s:'lamp'}]);sc.setPace(speed!=='normal',false,speed);sc.show(grid);
 let changed=false;
 await q.drive(sc.highlight([{i:0,s:'J',n:5,pay:4000}],()=>{}),{step:16,onFrame(){
  if(!changed&&findAll(q.apps[0].stage,'articulated-illustration').length){changed=true;action==='skip'?sc.show(grid):q.resize(host,1000,600);}
 }});
 assert(changed);assert.equal(findAll(q.apps[0].stage,'articulated-illustration').length,0);
 walk(q.apps[0].stage,n=>{for(const p of[n.position,n.scale,n.pivot])assert(Number.isFinite(p.x)&&Number.isFinite(p.y));});
 sc.destroy();interruptions.push({speed,action,passed:true});
}
assert.equal(sourceFingerprint(),fingerprint);
fs.mkdirSync('art/kilo-v87/verification',{recursive:true});
fs.writeFileSync('art/kilo-v87/verification/articulation.json',JSON.stringify({sourceFingerprint:fingerprint,triangles,maxDisplacement,actualPixiGeometry:true,printedAmountStationary:true,parentDisposal:true,collection:{bank:banks,actions,meshFrames},interruptions,method:'Pure production fields, actual installed Pixi object/geometry API, and instrumented production scene. Not browser/GPU rendering.'},null,2)+'\n');
console.log(`PASS ${triangles} nonfolding material triangles; real Pixi API / disposal; exact48,000 collection and6 hit interruptions.`);
