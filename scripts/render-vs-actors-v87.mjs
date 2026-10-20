/** Bake the production actor rig. Pass an audit directory as argv[2].
 * Existing character parts are reused without image generation or repainting. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {createOfflineRuntime} from './offline-runtime-v79.mjs';

const directory=path.resolve(process.argv[2]??'/tmp/kilo-v87-vs');
fs.mkdirSync(directory,{recursive:true});
const runtime=createOfflineRuntime(),p=runtime.load('src/components/kilo/vs-actor-performance.ts');
const names=['torso','head-ready','head-effort','head-win','head-loss','upper','forearm-left','forearm-right','tool'];
const sides=['king','vice'],outcomes=['win','loss'];
const parts=Object.fromEntries(await Promise.all(sides.map(async side=>[side,Object.fromEntries(
  await Promise.all(names.map(async name=>[name,await loadImage(`public/kilo-v82/vs/${side}-${name}.webp`)])))])));
const length=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const rotate=(q,angle,c)=>({x:c.x+(q.x-c.x)*Math.cos(angle)-(q.y-c.y)*Math.sin(angle),
  y:c.y+(q.x-c.x)*Math.sin(angle)+(q.y-c.y)*Math.cos(angle)});
const phaseTimes=[0,.27,.49,.555,.60,.68,.79,.90,1];
const phaseNames=['ready','loaded','contact','recoil','counter','final push','follow','resolve','rest'];
let samples=0,clamped=0,maxGripError=0,maxBoneError=0,maxJointStep=0,minBend=Infinity,maxBend=-Infinity;
const result=[];
const phoneSize=129,phoneCell=145,phoneRow=165;
const phone=createCanvas(phaseTimes.length*phoneCell,4*phoneRow),phoneCtx=phone.getContext('2d');
phoneCtx.fillStyle='#11232d';phoneCtx.fillRect(0,0,phone.width,phone.height);
const large=createCanvas(phaseTimes.length*256,4*288),largeCtx=large.getContext('2d');
largeCtx.fillStyle='#11232d';largeCtx.fillRect(0,0,large.width,large.height);

for(const [sideIndex,side]of sides.entries())for(const [outcomeIndex,outcome]of outcomes.entries()){
  const row=sideIndex*2+outcomeIndex;
  let previous;
  for(let i=0;i<=1000;i++){
    const pose=p.vsActorPoseAt(side,outcome,i/1000),grip=side==='king'?150:110;
    const targets=[rotate({x:pose.tool.x-grip/2,y:pose.tool.y},pose.tool.angle,pose.tool),
      rotate({x:pose.tool.x+grip/2,y:pose.tool.y},pose.tool.angle,pose.tool)];
    for(const [index,arm]of [pose.left,pose.right].entries()){
      const boneError=Math.max(Math.abs(length(arm.shoulder,arm.elbow)-96),Math.abs(length(arm.elbow,arm.hand)-122));
      const gripError=length(arm.hand,targets[index]);
      maxBoneError=Math.max(maxBoneError,boneError);maxGripError=Math.max(maxGripError,gripError);
      assert(boneError<1e-8,'Both arm bones retain their authoring lengths');
      assert(gripError<1e-8,'Each hand remains on its original prop grip');
      assert(!arm.clamped,'The actual grip is reachable without an IK fallback');
      if(arm.clamped)clamped++;
      const upper=Math.atan2(arm.elbow.y-arm.shoulder.y,arm.elbow.x-arm.shoulder.x),
        lower=Math.atan2(arm.hand.y-arm.elbow.y,arm.hand.x-arm.elbow.x),bend=Math.acos(Math.cos(lower-upper));
      minBend=Math.min(minBend,bend);maxBend=Math.max(maxBend,bend);
    }
    if(previous)maxJointStep=Math.max(maxJointStep,length(pose.left.hand,previous.left.hand),length(pose.right.hand,previous.right.hand));
    previous=pose;samples++;
  }
  const atlas=createCanvas(p.VS_ACTOR_COLUMNS*p.VS_ACTOR_FRAME_SIZE,p.VS_ACTOR_ROWS*p.VS_ACTOR_FRAME_SIZE),ctx=atlas.getContext('2d');
  const frames=[];
  for(let i=0;i<p.VS_ACTOR_FRAME_COUNT;i++){
    // Every pose is rasterized in its own canvas. A sleeve or reel body that
    // extends below the authoring crop cannot contaminate a neighboring cell.
    const frame=createCanvas(p.VS_ACTOR_FRAME_SIZE,p.VS_ACTOR_FRAME_SIZE),c=frame.getContext('2d');
    c.scale(.5,.5);p.paintVsActor(c,parts[side],side,outcome,i/(p.VS_ACTOR_FRAME_COUNT-1));
    ctx.drawImage(frame,i%p.VS_ACTOR_COLUMNS*p.VS_ACTOR_FRAME_SIZE,Math.floor(i/p.VS_ACTOR_COLUMNS)*p.VS_ACTOR_FRAME_SIZE);
    frames.push(frame);
  }
  const output='public'+p.VS_ACTOR_ATLASES[side][outcome];fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,await atlas.encode('webp',90));
  const decoded=await loadImage(output);
  for(const [i,t]of phaseTimes.entries()){
    const index=p.vsActorFrameIndex(t),sx=index%8*256,sy=Math.floor(index/8)*256;
    phoneCtx.drawImage(decoded,sx,sy,256,256,i*phoneCell+8,row*phoneRow+6,phoneSize,phoneSize);
    phoneCtx.font='700 11px sans-serif';phoneCtx.fillStyle='#fff0cb';
    phoneCtx.fillText(`${side} ${outcome}`,i*phoneCell+8,row*phoneRow+146);
    phoneCtx.font='10px sans-serif';phoneCtx.fillText(`${phaseNames[i]} · ${t.toFixed(3)}`,i*phoneCell+8,row*phoneRow+160);
    largeCtx.drawImage(decoded,sx,sy,256,256,i*256,row*288,256,256);
    largeCtx.font='700 14px sans-serif';largeCtx.fillStyle='#fff0cb';largeCtx.fillText(`${side} ${outcome} · ${phaseNames[i]} ${t.toFixed(3)}`,i*256+8,row*288+276);
    const crop=createCanvas(phoneSize,phoneSize),cropCtx=crop.getContext('2d');cropCtx.drawImage(decoded,sx,sy,256,256,0,0,phoneSize,phoneSize);
    fs.writeFileSync(path.join(directory,`${side}-${outcome}-${phaseNames[i].replaceAll(' ','-')}-129px.png`),await crop.encode('png'));
  }
  const rawFrameHashes=frames.map(frame=>createHash('sha256').update(frame.getContext('2d').getImageData(0,0,256,256).data).digest('hex'));
  result.push({side,outcome,url:p.VS_ACTOR_ATLASES[side][outcome],bytes:fs.statSync(output).size,
    uniqueRasterFrames:new Set(rawFrameHashes).size,frameCount:p.VS_ACTOR_FRAME_COUNT});
}
fs.writeFileSync(path.join(directory,'vs-actors-phone-129px.png'),await phone.encode('png'));
fs.writeFileSync(path.join(directory,'vs-actors-phases-256px.png'),await large.encode('png'));
const checks={method:'Production pose helper and original part images; decoded shipping atlases shown at 129 px phone sprite width. No browser or audio claim.',
  frameCount:p.VS_ACTOR_FRAME_COUNT,frameSize:p.VS_ACTOR_FRAME_SIZE,samples,clamped,maxBoneError,maxGripError,maxJointStepAt1000Samples:maxJointStep,
  elbowBendDegrees:[minBend*180/Math.PI,maxBend*180/Math.PI],contactModel:'Extended tools at king(370,290), vice(134,290); restrained chest and head drive.',
  primaryContact:.49,counter:[.59,.61],decisivePush:.68,result:[.715,.94],atlases:result};
fs.writeFileSync(path.join(directory,'vs-actor-rig-checks.json'),JSON.stringify(checks,null,2)+'\n');
console.log(JSON.stringify(checks,null,2));
