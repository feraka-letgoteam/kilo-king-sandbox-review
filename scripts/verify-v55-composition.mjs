import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadProduction,cropCounts} from './kilo-v55-test-loader.mjs';
const {fitGameLayout}=loadProduction('src/components/kilo/layout.ts');
const {gameBrandBox}=loadProduction('src/components/kilo/brand-layout.ts');
const {stageArtLayout}=loadProduction('src/components/kilo/stage-art.ts');
const {CHARACTER_RIGS,rigTransforms,visibleRigParts}=loadProduction('src/components/kilo/character-rig-model.ts');
const {characterPoseAt,timedPerformanceFrameAt}=loadProduction('src/components/kilo/rig-performance.ts');
const {createCharacterRig}=loadProduction('src/components/kilo/character-rig.ts');
const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const results=[];
for(const [w,h] of [[1440,900],[390,844],[360,800],[844,390]]){
  const pad=w<900?12:24,l=fitGameLayout(w-pad*2,h-pad*2),art=stageArtLayout(l.reelWidth,l.reelHeight,l.mode);
  const reelLeft=l.mode==='landscape'?l.controlLeft+l.dockGap:l.artLeft;
  const cabinet={x:reelLeft+art.x,y:l.header+art.y,width:art.w,height:art.h};
  for(const feature of [false,true]){
    const box=gameBrandBox(l,feature);
    if(box){
      assert(box.x>=0&&box.y>=0&&box.x+box.width<=l.width,'logo within shell');
      assert(!overlap(box,cabinet),'logo clears the actual outer cabinet');
      if(l.mode==='portrait')assert(box.y+box.height<=(feature?27:64),'portrait HUD/status clearance');
      if(l.artLeft===0&&l.mode==='wide')assert(box.y+box.height<=(feature?31:80),'unframed header clearance');
      if(l.mode==='landscape')assert(box.x+box.width<reelLeft+l.reelWidth*.48,'landscape status clearance');
    }else assert(l.mode==='landscape'&&feature,'landscape uses existing HUD logo cell');
    if(l.mode==='portrait')assert.equal(l.dock,160);
    results.push({viewport:[w,h],feature,logo:box,cabinet,header:l.header,dock:l.dock});
  }
}
let poses=0;
for(const actor of ['king','vice']){
  const def=CHARACTER_RIGS[actor],rest=rigTransforms(def,{});
  assert.equal(visibleRigParts(def).length,actor==='king'?8:7);
  for(const action of ['challenge','victory','defeat','glance'])for(let i=0;i<=100;i++){
    const pose=characterPoseAt(actor,action,i/100),joints=rigTransforms(def,pose);
    for(const t of Object.values(joints))assert(Object.values(t).every(Number.isFinite));
    assert.deepEqual(joints.hips,rest.hips,'planted feet do not drift');
    if(i===100)for(const id of Object.keys(rest))for(const key of ['x','y','rotation'])assert(Math.abs(joints[id][key]-rest[id][key])<1e-9,'every action returns to rest');
    if(actor==='king'&&action==='challenge')assert(joints.prop.rotation>.15&&joints.prop.rotation<.36,'rod stays pitched away from face');
    poses++;
  }
  for(let i=0;i<100;i++){const rig=createCharacterRig(actor);rig.pose('challenge',.57);rig.dispose();}
  assert.equal(cropCounts.get(def.atlas),Object.keys(def.parts).length,'part textures are reused, not allocated each frame');
}
const vehicles=JSON.parse(fs.readFileSync('public/kilo-v55/vehicles/manifest.json'));
for(const name of ['chopper','boat']){
  const frames=vehicles[name].frames,durations=frames.map(f=>f.durationMs),seen=new Set();
  for(let i=0;i<=1000;i++)seen.add(timedPerformanceFrameAt(i/1000,durations));
  assert.equal(seen.size,8);assert.equal(timedPerformanceFrameAt(1,durations),7);
  assert.equal(timedPerformanceFrameAt(.2,durations,true,3),3);
}
const css=fs.readFileSync('src/components/kilo/brand-v55.css','utf8');
assert(css.includes('object-fit: contain')&&css.includes('pointer-events: none'));
fs.writeFileSync('art/kilo-v55/composition-verification.json',JSON.stringify({method:'Production layout and joint functions; source-bound logo clearance, not browser CSS/GPU evidence.',results,poseSamples:poses,textureReuse:true,authoredVehicleFrames:16},null,2)+'\n');
console.log(`PASS ${results.length} logo/layout states, ${poses} joint samples, finite texture ownership and 16 vehicle keys.`);
