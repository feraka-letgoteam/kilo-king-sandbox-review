import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {createOfflineRuntime} from './offline-runtime-v79.mjs';
const r=createOfflineRuntime(),p=r.load('src/components/kilo/vs-actor-performance.ts');
const directory='art/kilo-v85/characters';fs.mkdirSync(directory,{recursive:true});
const names=['torso','head-ready','head-effort','head-win','head-loss','upper','forearm-left','forearm-right','tool'];
const parts=Object.fromEntries(await Promise.all(['king','vice'].map(async side=>[side,Object.fromEntries(await Promise.all(names.map(async name=>[name,await loadImage(`public/kilo-v82/vs/${side}-${name}.webp`)])))])));
let clamped=0,samples=0,maxJump=0,minBend=Infinity,maxBend=-Infinity;
for(const side of ['king','vice'])for(const outcome of ['win','loss']){
 let last;
 for(let i=0;i<=1000;i++){
  const q=p.vsActorPoseAt(side,outcome,i/1000);
  for(const a of [q.left,q.right]){
   const length=(v,w)=>Math.hypot(v.x-w.x,v.y-w.y);
   assert(Math.abs(length(a.shoulder,a.elbow)-a.upperLength)<1e-8);
   assert(Math.abs(length(a.elbow,a.hand)-a.forearmLength)<1e-8);
   const upper=Math.atan2(a.elbow.y-a.shoulder.y,a.elbow.x-a.shoulder.x),lower=Math.atan2(a.hand.y-a.elbow.y,a.hand.x-a.elbow.x),bend=Math.acos(Math.cos(lower-upper));
   minBend=Math.min(minBend,bend);maxBend=Math.max(maxBend,bend);
   if(a.clamped)clamped++;
   for(const point of [a.shoulder,a.elbow,a.hand])assert(Number.isFinite(point.x)&&Number.isFinite(point.y));
  }
  if(last)maxJump=Math.max(maxJump,Math.hypot(q.left.hand.x-last.left.hand.x,q.left.hand.y-last.left.hand.y),Math.hypot(q.right.hand.x-last.right.hand.x,q.right.hand.y-last.right.hand.y));
  last=q;samples++;
 }
 const atlas=createCanvas(p.VS_ACTOR_COLUMNS*p.VS_ACTOR_FRAME_SIZE,p.VS_ACTOR_ROWS*p.VS_ACTOR_FRAME_SIZE),ctx=atlas.getContext('2d');
 for(let i=0;i<p.VS_ACTOR_FRAME_COUNT;i++){
  ctx.save();ctx.translate((i%p.VS_ACTOR_COLUMNS)*p.VS_ACTOR_FRAME_SIZE,Math.floor(i/p.VS_ACTOR_COLUMNS)*p.VS_ACTOR_FRAME_SIZE);ctx.scale(.5,.5);
  p.paintVsActor(ctx,parts[side],side,outcome,i/(p.VS_ACTOR_FRAME_COUNT-1));ctx.restore();
 }
 fs.writeFileSync('public'+p.VS_ACTOR_ATLASES[side][outcome],await atlas.encode('webp',88));
}
const times=[0,.26,.35,.43,.49,.57,.68,.82,1];
const sheet=createCanvas(5*384,4*400),c=sheet.getContext('2d');c.fillStyle='#0c1b24';c.fillRect(0,0,sheet.width,sheet.height);
let row=0;
for(const side of ['king','vice'])for(const outcome of ['win','loss']){
 for(let i=0;i<5;i++){
  const t=[0,.30,.49,.61,.85][i];c.save();c.translate(i*384,row*400);c.scale(.75,.75);p.paintVsActor(c,parts[side],side,outcome,t);c.restore();
  c.font='700 16px sans-serif';c.fillStyle='#fff3db';c.fillText(`${side} ${outcome} ${(t*100).toFixed(0)}%`,i*384+12,row*400+390);
 }row++;
}
fs.writeFileSync(directory+'/vs-actors-contact.png',await sheet.encode('png'));
fs.writeFileSync(directory+'/vs-actor-rig-checks.json',JSON.stringify({samples,clamped,maxJointStepAt1000Samples:maxJump,minElbowBendDegrees:minBend*180/Math.PI,maxElbowBendDegrees:maxBend*180/Math.PI,constantBoneLengths:true,method:'Actual production authoring helper, fixed-length two-bone IK. Atlas has64 distinct sampled drawings; no crossfaded limbs. Local part rig, not full skeletal body or3D performance.',frameCount:p.VS_ACTOR_FRAME_COUNT,frameSize:p.VS_ACTOR_FRAME_SIZE},null,2)+'\n');
console.log({samples,clamped,maxJump,minBend:minBend*180/Math.PI,maxBend:maxBend*180/Math.PI});
