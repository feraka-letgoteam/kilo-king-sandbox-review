/** Verify the actual painted prop lines and actual scene transforms meet at
 * the impact. This catches a physically false clash despite valid arm lengths. */
import fs from 'node:fs';import assert from 'node:assert/strict';
import {createOfflineRuntime,findAll} from './offline-runtime-v79.mjs';
import {sourceFingerprint} from './v79-source-fingerprint.mjs';
const fingerprint=sourceFingerprint(),bootstrap=createOfflineRuntime(),math=bootstrap.load('src/lib/kilo/reel-feature-math.ts'),seeded=bootstrap.load('src/lib/kilo/vs-progression.ts').vsSeeded;
const fixtures={};
for(let seed=1;seed<2000&&Object.keys(fixtures).length<2;seed++){
 const round=math.runReelFeatureCandidate('yacht',1000,seeded(seed),18000000);
 for(const spin of round.free)for(const conversion of spin.mechanic.reel.conversions){if(conversion.duel&&!fixtures[conversion.duel.winner])fixtures[conversion.duel.winner]=spin.mechanic;}
}
assert.equal(Object.keys(fixtures).length,2);
const s=await bootstrap.load('src/components/kilo/pixiStage.ts').mountScene(bootstrap.host(1000,600));s.destroy();
function transform(point,node){let p={...point};for(let n=node;n;n=n.parent){const x=(p.x-n.pivot.x)*n.scale.x,y=(p.y-n.pivot.y)*n.scale.y;p={x:n.position.x+x*Math.cos(n.rotation)-y*Math.sin(n.rotation),y:n.position.y+x*Math.sin(n.rotation)+y*Math.cos(n.rotation)};}return p;}
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const results=[];
for(const [winner,event] of Object.entries(fixtures))for(const cell of [60,130]){
 const r=createOfflineRuntime();for(const [url,t]of bootstrap.textures)r.textures.set(url,t);
 const actors=r.load('src/components/kilo/vs-actor-performance.ts'),world=new r.pixi.Container(),host=r.host(1000,600),g={gx:5,gy:6,cell,gap:3};
 let phase='',paid=0;
 const inspect=()=>{
  const impact=findAll(world,'vs-contact-ink')[0];if(!impact?.vsContact)return;
  const bodies=['king','vice'].map(side=>findAll(world,`vs-${side}-body`)[0]);if(bodies.some(n=>!n))return;
  const lines=bodies.map((body,i)=>{
   const side=i?'vice':'king',sprite=body.children[0],frame=actors.vsActorFrameIndex(.49),p=actors.vsActorPoseAt(side,winner===side?'win':'loss',frame/(actors.VS_ACTOR_FRAME_COUNT-1));
   assert.equal(sprite.texture.frame.x,frame%8*256,'The actual sprite displays the inspected baked pose');
   const source={x:p.tool.x,y:p.tool.y},radius=i?126:142;
   return[-1,1].map(sign=>{const q={x:source.x+sign*radius*Math.cos(p.tool.angle),y:source.y+sign*radius*Math.sin(p.tool.angle)};return transform({x:(q.x/512-.5)*sprite.width,y:(q.y/512-1)*sprite.height},body);});
  });
  const [a,b]=lines[0],[c,d]=lines[1],ab={x:b.x-a.x,y:b.y-a.y},cd={x:d.x-c.x,y:d.y-c.y},ac={x:c.x-a.x,y:c.y-a.y},den=cross(ab,cd);
  assert(Math.abs(den)>1e-6,'Distinct crossing prop directions');
  const u=cross(ac,cd)/den,v=cross(ac,ab)/den;
  assert(u>=0&&u<=1&&v>=0&&v<=1,'The finite rod and cuffs actually intersect, not just their infinite directions');
  const contact={x:a.x+u*ab.x,y:a.y+u*ab.y},ink=transform(impact.vsContact,impact.parent),distance=Math.hypot(contact.x-ink.x,contact.y-ink.y);
  assert(distance<cell*.12,'Ink impact is at physical prop contact');
  results.push({winner,cell,phase,intersection:contact,ink,distanceInCells:distance/cell,u,v});
 };
 const a={host,world,geom:()=>g,cell:()=>new r.pixi.Container(),stake:()=>1000,pace:()=>({speed:'normal',reduced:false}),live:()=>true,show(){},collect:async()=>{},highlight:async()=>{},readout(){},screen:(x,y)=>({x,y}),landing:()=>({x:200,y:500}),focus(){},conceal(){},bankCue(){},cue:name=>{phase=name;},hold:async()=>{},tween:async(ms,paint)=>{for(const t of[0,.24,.36,.49,.60,.82,1]){paint(t);if(ms===1920&&t===.49)inspect();}}};
 const ctl=r.load('src/components/kilo/reel-feature-effects.ts').createReelFeatureEffects(a);ctl.set(event,'before');await ctl.step(event,{award:v=>paid+=v,state(){}});assert.equal(paid,event.credited);ctl.destroy();
}
assert(results.length>=4);assert.equal(sourceFingerprint(),fingerprint);
fs.writeFileSync('art/kilo-v87/verification/vs-physical-contact.json',JSON.stringify({sourceFingerprint:fingerprint,method:'Actual controller, displayed baked frame, parent matrices and finite prop segments. Not browser/GPU.',results},null,2)+'\n');console.log(`PASS ${results.length} real rod/cuff intersections and registered impact contacts at desktop and phone scale.`);
