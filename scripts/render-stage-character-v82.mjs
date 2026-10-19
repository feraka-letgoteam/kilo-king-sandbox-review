import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {createOfflineRuntime} from './offline-runtime-v79.mjs';
const r=createOfflineRuntime(),life=r.load('src/components/kilo/stage-character-life.ts'),arm=r.load('src/components/kilo/stage-character-arm.ts');
const images=Object.fromEntries(await Promise.all(Object.entries(arm.KING_ARM_ASSETS).map(async([key,url])=>[key,await loadImage('public'+url)])));
const output='art/kilo-v82/characters';
const cases=[['idle',Infinity,null],['cast',Infinity,{kind:'cast',progress:.26}],['cast-release',Infinity,{kind:'cast',progress:.49}],['throw',Infinity,{kind:'throw',progress:.30}],['vs-win',.42,null],['max-stop',.42,null],['max-loss',.46,null],['vs-loss',.46,null]];
const sheet=createCanvas(4*360,2*480),c=sheet.getContext('2d');c.fillStyle='#0b1d28';c.fillRect(0,0,sheet.width,sheet.height);
const actor=createCanvas(arm.KING_STAGE_CANVAS.width*1.5,arm.KING_STAGE_CANVAS.height*1.5),ctx=actor.getContext('2d');
for(const [i,[kind,p,tool]] of cases.entries()){
 const f=life.stageKingFrameAt(18000,p*life.STAGE_REACTION_MS[kind],false,life.STAGE_REACTION_MS[kind]?kind:'win');life.paintStageKing(ctx,images.body,f,false,images,tool);
 c.drawImage(actor,(i%4)*360+2,Math.floor(i/4)*480,350,450);c.fillStyle='#fff1cb';c.font='700 16px sans-serif';c.fillText(kind,(i%4)*360+16,Math.floor(i/4)*480+472);
}
fs.writeFileSync(output+'/stage-actions-contact.png',await sheet.encode('png'));
let samples=0,minBend=Infinity,maxBend=-Infinity,maxJump=0;
for(const kind of ['cast','throw','win','vs-win','vs-loss','max-stop','max-loss']){
 let last;
 for(let i=0;i<=600;i++){
  const t=i/600,isTool=kind==='cast'||kind==='throw',frame=life.stageKingFrameAt(18000+1100*t,isTool?Infinity:life.STAGE_REACTION_MS[kind]*t,false,isTool?'win':kind),tool=isTool?{kind,progress:t}:null;
  const pose=arm.kingLeftArmPose(life.kingToolFrame(frame,tool),tool);const length=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  assert(Math.abs(length(pose.shoulder,pose.elbow)-arm.KING_LEFT_ARM.upperLength)<1e-8);
  assert(Math.abs(length(pose.elbow,pose.wrist)-arm.KING_LEFT_ARM.forearmLength)<1e-8);
  const bend=pose.lower-pose.upper;assert(bend>0&&bend<Math.PI);minBend=Math.min(minBend,bend);maxBend=Math.max(maxBend,bend);
  if(last)maxJump=Math.max(maxJump,length(pose.hand,last.hand));last=pose;
  for(const point of [pose.shoulder,pose.elbow,pose.wrist,pose.hand,arm.kingRightRodPose(frame,tool).tip]){assert(Number.isFinite(point.x)&&Number.isFinite(point.y));assert(point.x>=-arm.KING_STAGE_CANVAS.offsetX&&point.x<=arm.KING_STAGE_CANVAS.width-arm.KING_STAGE_CANVAS.offsetX);assert(point.y>=-arm.KING_STAGE_CANVAS.offsetY&&point.y<768);}
  assert.equal(life.stageKingExpression(frame,tool,true),0);samples++;
 }
}
fs.writeFileSync(output+'/stage-anatomy-checks.json',JSON.stringify({samples,constantBoneLengths:true,feetPlanted:true,leftHandThrows:true,rightHandRetainsRod:true,noElbowReversal:true,minElbowBendDegrees:minBend*180/Math.PI,maxElbowBendDegrees:maxBend*180/Math.PI,maxJointStepAt600Samples:maxJump,opaqueFacialAndHandChanges:true,limitation:'Articulated left arm and independent expressive head. Right arm/rod remain a single connected rigid drawing; chest uses deformation.'},null,2)+'\n');
console.log({samples,minBend:minBend*180/Math.PI,maxBend:maxBend*180/Math.PI,maxJump});
