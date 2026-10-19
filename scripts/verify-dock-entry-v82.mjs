import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createOfflineRuntime,findAll,walk} from './offline-runtime-v79.mjs';
import {sourceFingerprint} from './v79-source-fingerprint.mjs';
const fingerprint=sourceFingerprint(),results=[];
for(const speed of ['normal','turbo','super'])for(const reduced of [false,true])for(const action of ['resize','skip']){
 const r=createOfflineRuntime(),{vsSeeded}=r.load('src/lib/kilo/vs-progression.ts');
 const round=r.load('src/lib/kilo/engine.ts').playSplash(1000,'buy',vsSeeded(170));
 const before=JSON.stringify(round),fit=r.load('src/components/kilo/layout.ts').fitGameLayout,l=fit(366,820);
 const host=r.host(Math.round(l.reelWidth),Math.round(l.reelHeight));
 const scene=await r.load('src/components/kilo/pixiStage.ts').mountScene(host);
 scene.setPace(speed!=='normal',reduced,speed);scene.show(round.base.grid);
 const frames=new Set();let acted=false,visible=0;
 await r.drive(scene.intro(round),{step:16,onFrame(){
  const crests=findAll(r.apps[0].stage,'dock-entry-crest');
  crests.forEach(n=>frames.add(JSON.stringify(n.texture.frame)));if(crests.length)visible++;
  walk(r.apps[0].stage,n=>{assert(Number.isFinite(n.position.x)&&Number.isFinite(n.position.y));assert(Number.isFinite(n.scale.x)&&Number.isFinite(n.scale.y));});
  if(visible>=8&&!acted){acted=true;if(action==='skip')scene.show(round.base.grid);else{const to=fit(1392,852);r.resize(host,Math.round(to.reelWidth),Math.round(to.reelHeight));}}
 }});
 assert(acted);assert.equal(findAll(r.apps[0].stage,'dock-entry-banner').length,0);assert.equal(JSON.stringify(round),before);
 if(action==='resize'&&!reduced)assert(frames.size>=4,'Actual ceremony uses multiple authored drawings');
 if(reduced)assert.equal(frames.size,1,'Reduced motion shows one stable drawing');
 assert(r.clock<1400,'Existing bounded reading time is preserved');
 results.push({speed,reduced,action,authoredFrames:frames.size,durationMs:r.clock,passed:true});scene.destroy();
}
assert.equal(sourceFingerprint(),fingerprint);
fs.writeFileSync('art/kilo-v82/verification/dock-entry.json',JSON.stringify({sourceFingerprint:fingerprint,method:'Actual entry controller, instrumented Pixi; no browser-layout claim.',results},null,2)+'\n');
console.log(`PASS ${results.length} Dock entry art / reduced / Skip / resize cases`);
