import fs from 'node:fs';import assert from 'node:assert/strict';
import {createOfflineRuntime,createCanvas} from './offline-runtime-v79.mjs';
const r=createOfflineRuntime(),p=r.load('src/components/kilo/feature-environment-painter.ts');
const from=createCanvas(390,844),to=createCanvas(390,844),out=createCanvas(390,844);
from.getContext('2d').fillStyle='#163547';from.getContext('2d').fillRect(0,0,390,844);
to.getContext('2d').fillStyle='#315346';to.getContext('2d').fillRect(0,0,390,844);
const ctx=out.getContext('2d'),rows=[];
for(let ms=0;ms<=420;ms+=10){
 const blend=p.compositeEnvironmentFrames(ctx,from,to,390,844,ms),pixels=ctx.getImageData(0,0,390,844).data;
 for(let i=3;i<pixels.length;i+=4)assert.equal(pixels[i],255,'No transparent edge during background-only settle');
 assert(blend>=0&&blend<=1);if(rows.length)assert(blend>=rows.at(-1).blend);rows.push({ms,blend});
}
assert.deepEqual([...ctx.getImageData(0,0,390,844).data],[...to.getContext('2d').getImageData(0,0,390,844).data]);
assert.equal(p.sceneBlendAt(10,true),1);assert(p.sceneBlendAt(1)<1e-6);assert(1-p.sceneBlendAt(419)<1e-6);
fs.mkdirSync('art/kilo-v87/verification',{recursive:true});fs.writeFileSync('art/kilo-v87/verification/transitions.json',JSON.stringify({durationMs:420,opaque:true,exactDestination:true,reducedImmediate:true,rows,method:'Production compositor and native Canvas pixels. Not browser frame pacing.'},null,2)+'\n');
console.log('PASS43 opaque scene-transition samples; exact destination, minimum-jerk endpoints, reduced motion immediate.');
