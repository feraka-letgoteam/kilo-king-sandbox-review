import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createOfflineRuntime,walk} from './offline-runtime-v79.mjs';
const results=[];
for(const tool of ['hook','dynamite'])for(const speed of ['normal','turbo','super'])for(const reduced of [false,true])for(const change of ['none',...reduced?[]:['skip','resize']]){
 const r=createOfflineRuntime(),record=r.load('src/lib/kilo/fixtures.json')['tool-'+tool].script,spin=record.free.find(s=>s.tool===tool),original=JSON.stringify(spin),host=r.host(1000,600,24,80),scene=await r.load('src/components/kilo/pixiStage.ts').mountScene(host),events=[];let acted=false;
 host.addEventListener('kilo-stage-tool',e=>{const d=e.detail,rect=host.getBoundingClientRect();events.push({kind:d.kind,p:d.progress,ms:r.clock});d.hand={x:rect.right-20,y:rect.bottom};d.releaseHand={x:rect.right-60,y:rect.bottom-90};d.rodTip={x:rect.right-140,y:rect.top};d.handSize=30;});
 scene.setStake(record.stake);scene.setPace(speed!=='normal',reduced,speed);scene.show(spin.primed);
 await r.drive(scene.tool(spin),{step:16,onFrame(){
  for(const el of r.document.body.children)if(el.className==='kk-character-tool-flight')for(const key of ['left','top','width'])assert(Number.isFinite(parseFloat(el.style[key])));
  walk(r.apps[0].stage,node=>{for(const p of [node.position,node.scale,node.pivot])assert(Number.isFinite(p.x)&&Number.isFinite(p.y));});
  if(!acted&&change!=='none'&&events.at(-1)?.p>.48){acted=true;if(change==='skip')scene.show(spin.grid);else r.resize(host,366,248);}
 }});
 assert.equal(JSON.stringify(spin),original,'Recorded outcome untouched');assert.equal(r.document.body.children.filter(e=>e.className==='kk-character-tool-flight').length,0,'No stranded dynamite');assert.equal(events.at(-1)?.p,1,'Arm returns to settled pose on every exit');
 if(change!=='none')assert(acted);if(!reduced&&change==='none')assert(events.some(e=>e.p>0&&e.p<.3)&&events.some(e=>e.p>.3&&e.p<1),'Anticipation and release occur separately');
 const strips=r.apps[0].stage.children[0].children.filter(n=>n.mask&&n.children.length===2&&n.children[0]===n.mask).map(n=>n.children[1]);assert.equal(strips.length,5);for(const strip of strips){assert.equal(strip.children.length,3);assert.equal(strip.y,0);}
 results.push({tool,speed,reduced,change,elapsed:r.clock,events:events.length,passed:true});scene.destroy();
}
fs.writeFileSync('art/kilo-v81/tool-interruptions.json',JSON.stringify({method:'Production tool method, event callback and real show/Skip/ResizeObserver paths with instrumented Pixi. Hand anatomy and mounted callbacks verified separately. No browser claims.',results},null,2)+'\n');console.log(`PASS ${results.length} tool speed, Skip, resize and reduced-motion cases.`);
