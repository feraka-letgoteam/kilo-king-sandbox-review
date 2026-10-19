import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createOfflineRuntime} from './offline-runtime-v79.mjs';
const r=createOfflineRuntime(),life=r.load('src/components/kilo/stage-character-life.ts'),arm=r.load('src/components/kilo/stage-character-arm.ts');
let samples=0,minBend=10,maxBend=-10,maxJump=0;
for(const kind of ['cast','throw','max-stop']){
 let previous;
 for(let i=0;i<=600;i++){
  const t=i/600,frame=life.stageKingFrameAt(18000+1100*t,kind==='max-stop'?1100*t:Infinity,false,kind==='max-stop'?kind:'win'),tool=kind==='max-stop'?null:{kind,progress:t},actual=life.kingToolFrame(frame,tool),p=arm.kingLeftArmPose(actual,tool);
  const length=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  assert(Math.abs(length(p.shoulder,p.elbow)-arm.KING_LEFT_ARM.upperLength)<1e-9);
  assert(Math.abs(length(p.elbow,p.wrist)-arm.KING_LEFT_ARM.forearmLength)<1e-9);
  const bend=p.lower-p.upper;minBend=Math.min(minBend,bend);maxBend=Math.max(maxBend,bend);
  assert(bend>0&&bend<Math.PI,'Elbow does not reverse or hyperextend');
  if(previous)maxJump=Math.max(maxJump,length(p.hand,previous.hand));
  for(const q of [p.shoulder,p.elbow,p.wrist,p.hand,arm.kingRightRodPose(actual,tool).tip]){
   assert(Number.isFinite(q.x)&&Number.isFinite(q.y));assert(q.x>=-arm.KING_STAGE_CANVAS.offsetX+4&&q.x<=arm.KING_STAGE_CANVAS.width-arm.KING_STAGE_CANVAS.offsetX-4);
   assert(q.y>=-arm.KING_STAGE_CANVAS.offsetY+4&&q.y<768);
  }
  if(kind==='throw')assert.equal(p.holdingDynamite,t<arm.KING_THROW_RELEASE);
  previous=p;samples++;
 }
}
const playback=life.createStageKingPlayback();playback.react('max-stop','max-stop');playback.advance(80);playback.react('bank','win');assert.equal(playback.advance(1).reaction,'max-stop','Generic paid amount must not clobber max reaction');
for(let i=0;i<20;i++)playback.advance(80);playback.react('next-win','win');assert.equal(playback.advance(1).reaction,'win');
const frozen=playback.advance(0);assert.equal(playback.advance(80,false,true),frozen,'Paused actor does not advance');
const still=life.stageKingFrameAt(12,30,true,'max-stop');assert.equal(arm.kingLeftArmPose(still,{kind:'throw',progress:.4},true).open,0,'Reduced motion has no throw');
// Test the actual one-sided limits at every authored change, independently of
// velocity (a fast throw is allowed; a discontinuity is not).
for(const kind of ['cast','throw','max-stop'])for(const t of [.12,.15,.26,.30,.36,.43,.48,.54,.58,.62,.64,.73,.81,.82,.92]){
 const point=u=>{const frame=life.stageKingFrameAt(18000+1100*u,kind==='max-stop'?1100*u:Infinity,false,kind==='max-stop'?kind:'win'),tool=kind==='max-stop'?null:{kind,progress:u};return arm.kingLeftArmPose(life.kingToolFrame(frame,tool),tool).hand;};
 const a=point(t-1e-6),b=point(t+1e-6);assert(Math.hypot(a.x-b.x,a.y-b.y)<.02,'Continuous joint path at authored key');
}
const result={pass:true,samples,minElbowBendDegrees:minBend*180/Math.PI,maxElbowBendDegrees:maxBend*180/Math.PI,maxJointStepAt600Samples:maxJump,leftHandOnly:true,constantBoneLengths:true,noElbowReversal:true,noClippedJoints:true,releaseProgress:arm.KING_THROW_RELEASE,priorityPauseReducedMotion:true,limitation:'2D articulated left arm and rigid right arm/rod over a torso mesh; not a full 3D character rig.'};
fs.writeFileSync('art/kilo-v81/character-actions-verification.json',JSON.stringify(result,null,2)+'\n');console.log(result);
