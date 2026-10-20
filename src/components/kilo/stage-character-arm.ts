import { kingMeshPoint } from './stage-character-mesh';
import type { StageKingFrame } from './stage-character-life';

/** Anatomical names, not screen-side names: LEFT throws; RIGHT retains the rod.
 * The source clean plate has no left arm. Exactly one joint chain is painted. */
const KING_PARTS='/kilo-v88/characters/king-parts/';
export const KING_ARM_ASSETS = {
  body: '/kilo-v82/characters/stage-headless.webp',
  heads: '/kilo-v82/characters/stage-heads.webp',
  upper: '/kilo-v81/characters/left-upper.webp',
  forearm: '/kilo-v81/characters/left-forearm.webp',
  grip: '/kilo-v81/characters/left-grip.webp',
  release: '/kilo-v81/characters/left-release.webp',
  /** v88 parts pack (pivots.json beside the files). Source-body pixels, drawn at 0.5. */
  torso: `${KING_PARTS}stage-upper.webp`,
  rightUpper: `${KING_PARTS}right-upper-arm.webp`,
  rightForearm: `${KING_PARTS}right-forearm.webp`,
  rightHand: `${KING_PARTS}right-hand-rod-grip.webp`,
  rod: `${KING_PARTS}fishing-rod.webp`,
  hips: `${KING_PARTS}hips.webp`,
  rightLeg: `${KING_PARTS}right-leg.webp`,
  leftLeg: `${KING_PARTS}left-leg.webp`,
  dynamiteHand: `${KING_PARTS}left-hand-dynamite.webp`,
  backswingHand: `${KING_PARTS}left-hand-backswing.webp`,
  headShocked: `${KING_PARTS}head-shocked.webp`,
  headShouting: `${KING_PARTS}head-shouting.webp`,
  headLaughing: `${KING_PARTS}head-laughing.webp`,
} as const;
export type KingArmImages = Record<keyof typeof KING_ARM_ASSETS, CanvasImageSource>;
export type KingToolAction = { kind:'cast'|'throw'; progress:number };
export type KingToolEvent = KingToolAction & { hand?:Point;rodTip?:Point;releaseHand?:Point; handSize?:number };
/** Logical 512x768 body plus room for the full rod: 240 left, 64 right, 200 above. */
export const KING_STAGE_CANVAS={width:816,height:968,offsetX:240,offsetY:200} as const;
type Point={x:number;y:number};
const clamp=(v:number)=>Math.min(1,Math.max(0,v));
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
export function curve(t:number,keys:readonly(readonly[number,number])[]){
  for(let i=1;i<keys.length;i++){const a=keys[i-1]!,b=keys[i]!;if(t<=b[0])return a[1]+(b[1]-a[1])*smooth((t-a[0])/(b[0]-a[0]));}
  return keys.at(-1)![1];
}
const offset=(p:Point,angle:number,length:number)=>({x:p.x+Math.cos(angle)*length,y:p.y+Math.sin(angle)*length});
export const KING_LEFT_ARM = {shoulder:{x:441,y:223},upperLength:100,forearmLength:143,handLength:31} as const;
/** Throw beats as fractions of the renderer's existing tool tween (600 ms
 * normal, 260 ms turbo): reach-back to .33, whip/release .33-.47 (snap at .40),
 * follow-through peak .62, recovery to rest by 1. Event length is unchanged. */
export const KING_THROW_RELEASE=.40;
type V=readonly[number,number];
/** pivots.json joints, source-body pixels (local to each PNG). */
export const KING_PARTS_RIG={
  rightShoulder:[548,438] as V,pelvis:[662+24,836] as V,
  rightUpper:{pivot:[58.299,32.983] as V,end:[63.897,233.002] as V},
  rightForearm:{pivot:[97.64,37.775] as V,end:[36.429,316.767] as V},
  rightHand:{pivot:[88.528,113.731] as V,grip:[41.95,58.097] as V},
  rod:{pivot:[380.883,584.876] as V,tip:[15.047,16.912] as V,butt:[436.37,664.739] as V,lineExit:[15.517,23.489] as V},
  hips:{pivot:[215.1,53.32] as V,rightHip:[126.6,111.733] as V,leftHip:[306.6,111.733] as V},
  rightLeg:{pivot:[286,61] as V,ankle:[181.5,482.5] as V},
  leftLeg:{pivot:[106.93,62.355] as V,ankle:[161.115,476.3] as V},
  dynamiteHand:{pivot:[122.25,172.59] as V,grip:[69.954,117.721] as V},
  backswingHand:{pivot:[57.773,144.289] as V,palm:[83.091,90.181] as V},
} as const;
const deg=Math.PI/180;
const dirOf=(a:V,b:V)=>Math.atan2(b[1]-a[1],b[0]-a[0]);
const lenOf=(a:V,b:V)=>Math.hypot(b[0]-a[0],b[1]-a[1])/2;
const turn=(v:Point,a:number)=>({x:v.x*Math.cos(a)-v.y*Math.sin(a),y:v.x*Math.sin(a)+v.y*Math.cos(a)});
const local=(from:V,to:V,a:number)=>turn({x:(to[0]-from[0])/2,y:(to[1]-from[1])/2},a);
const plus=(p:Point,v:Point)=>({x:p.x+v.x,y:p.y+v.y});

/** Weight shift: hips and torso slide together over planted boots. Idle sway
 * is a few logical pixels; reactions borrow the existing brace channel. */
export function kingHipShift(frame:StageKingFrame,reduced=false){
  if(reduced)return{x:0,y:0,tilt:0};
  const x=Math.max(-7,Math.min(7,frame.sway*4+frame.brace*.9));
  const y=Math.min(4,Math.abs(frame.brace)*.6);
  return{x,y,tilt:-x*.4*deg};
}

/** Rest pose: arm hangs from the shoulder, forearm carries the rod butt forward,
 * the rod angles up-left. Angles are bone directions in degrees (screen, y down). */
const ARM_REST={upper:95,forearm:-142,rod:-122};
/** Cast beats across the descent (0-.6) and pull (.6-1) tweens: wind-up (rod
 * back over the shoulder), wrist snap, release on the line, pull with the reel.
 * Rod flex is the rod rotating against the hand: it lags the snap, then whips. */
const CAST_UPPER=[[0,0],[.24,32],[.30,-4],[.36,-10],[.6,-6],[.9,14],[1,0]] as const;
const CAST_FOREARM=[[0,0],[.24,46],[.30,-6],[.36,-22],[.6,-12],[.9,14],[1,0]] as const;
const CAST_WRIST=[[0,0],[.24,24],[.29,-26],[.36,-16],[.6,-8],[.9,4],[1,0]] as const;
const CAST_FLEX=[[0,0],[.20,5],[.27,14],[.31,-13],[.36,5],[.44,-2],[.6,0],[.75,5],[.9,7],[1,0]] as const;
export const KING_CAST_ROD=CAST_FOREARM;
export function kingRightArmPose(frame:StageKingFrame,tool:KingToolAction|null=null,reduced=false){
  const R=KING_PARTS_RIG,hip=kingHipShift(frame,reduced),s=R.rightShoulder;
  const shoulder=plus(kingMeshPoint(s[0]/2,s[1]/2,{...frame,rod:0}),hip);
  const idle=reduced?0:frame.rod*.75;
  let ua=ARM_REST.upper,fa=ARM_REST.forearm+idle*.4,wrist=idle*.6,flex=0;
  if(!tool&&frame.reaction==='collect'&&!reduced){
    // Two short hauls on the rod: forearm lifts, the rod loads and recovers.
    const p=frame.reactionProgress??1,haul=Math.sin(Math.PI*2*Math.min(1,Math.max(0,(p-.08)/.8)))**2*(1-smooth((p-.7)/.3));
    fa+=18*haul;flex+=7*haul;
  }
  if(tool?.kind==='cast'&&!reduced){
    const t=clamp(tool.progress);
    ua+=curve(t,CAST_UPPER);fa+=curve(t,CAST_FOREARM);wrist+=curve(t,CAST_WRIST);flex+=curve(t,CAST_FLEX);
  }
  const a1=ua*deg-dirOf(R.rightUpper.pivot,R.rightUpper.end);
  const elbow=plus(shoulder,local(R.rightUpper.pivot,R.rightUpper.end,a1));
  const a2=fa*deg-dirOf(R.rightForearm.pivot,R.rightForearm.end);
  const wristPoint=plus(elbow,local(R.rightForearm.pivot,R.rightForearm.end,a2));
  const handRest=ARM_REST.rod*deg-dirOf(R.rod.pivot,R.rod.tip);
  const a3=handRest+(fa-ARM_REST.forearm)*deg+wrist*deg;
  const grip=plus(wristPoint,local(R.rightHand.pivot,R.rightHand.grip,a3));
  const a4=a3+flex*deg;
  const rodPoint=(p:V)=>plus(grip,local(R.rod.pivot,p,a4));
  return{shoulder,elbow,wrist:wristPoint,grip,a1,a2,a3,a4,angle:a4-handRest,
    tip:rodPoint(R.rod.lineExit),butt:rodPoint(R.rod.butt)};
}
/** Kept for callers that only need the line exit and the rod angle. */
export function kingRightRodPose(frame:StageKingFrame,tool:KingToolAction|null=null,reduced=false){
  return kingRightArmPose(frame,tool,reduced);
}

/** Fixed bone lengths and one bend direction. A compact underarm wind-up
 * avoids fake extra arms, a head-crossing overarm redraw, and elbow flips. */
export function kingLeftArmPose(frame:StageKingFrame,tool:KingToolAction|null=null,reduced=false){
  const hip=kingHipShift(frame,reduced);
  const shoulder=plus(kingMeshPoint(KING_LEFT_ARM.shoulder.x,KING_LEFT_ARM.shoulder.y,frame),hip);
  // The jointed rod arm holds the rod alone; the free left hand rests by the hip.
  const wristTarget={x:shoulder.x+18,y:shoulder.y+186};
  if(!tool&&frame.reaction==='collect'&&!reduced){
    // Hauls with the rod arm; the left fist pumps twice in time.
    const p=frame.reactionProgress??1,effort=smooth((p-.10)/.12)*(1-smooth((p-.78)/.22));
    wristTarget.y-=Math.abs(Math.sin(Math.PI*2*smooth((p-.10)/.78)))*26*effort;
  }
  const dx=wristTarget.x-shoulder.x,dy=wristTarget.y-shoulder.y,d=Math.hypot(dx,dy);
  const l=KING_LEFT_ARM.upperLength,f=KING_LEFT_ARM.forearmLength;
  let upper=Math.atan2(dy,dx)-Math.acos(Math.max(-1,Math.min(1,(l*l+d*d-f*f)/(2*l*d))));
  const restElbow=offset(shoulder,upper,l);
  let lower=Math.atan2(wristTarget.y-restElbow.y,wristTarget.x-restElbow.x);
  if(lower<upper)lower+=Math.PI*2;
  let open=0,handAngle=lower;
  if(tool?.kind==='throw'&&!reduced){
    const p=clamp(tool.progress),u0=upper,l0=lower;
    // Underarm lob: reach back past the hip, whip through, follow up high, recover.
    upper=curve(p,[[0,u0],[.08,u0+.06],[.33,.78],[.40,2.45],[.47,2.78],[.62,3.02],[.82,2.30],[1,u0]]);
    lower=curve(p,[[0,l0],[.08,l0+.04],[.33,1.30],[.40,3.45],[.47,3.82],[.62,4.06],[.82,3.20],[1,l0]]);
    handAngle=lower+curve(p,[[0,0],[.33,.35],[.40,-.08],[.62,-.25],[.85,-.08],[1,0]]);
    open=smooth((p-KING_THROW_RELEASE)/.035)*(1-smooth((p-.80)/.15));
  }else if(!tool&&['max-stop','win','vs-win','retrigger'].includes(frame.reaction??'')&&!reduced){
    const full=frame.reaction!=='win';
    const p=frame.reactionProgress??1,weight=curve(p,[[0,0],[.12,-.06],[.32,1],[.43,1.035],[.64,.97],[.84,.27],[1,0]]);
    upper+=((full?3.88:2.2)-upper)*weight;lower+=((full?5.38:3.75)-lower)*weight;handAngle=lower;
  }else if(!tool&&['vs-loss','max-loss'].includes(frame.reaction??'')&&!reduced){
    const p=frame.reactionProgress??1,weight=curve(p,[[0,0],[.18,.08],[.36,1],[.61,.88],[1,0]]);
    upper+=.25*weight;lower+=.21*weight;handAngle=lower-.12*weight;open=.9*weight;
  }
  const elbow=offset(shoulder,upper,l),wrist=offset(elbow,lower,f),hand=offset(wrist,handAngle,KING_LEFT_ARM.handLength);
  return {shoulder,elbow,wrist,hand,upper,lower,handAngle,open,
    holdingDynamite:kingLeftHandDrawing(tool,0,reduced)==='dynamite'};
}

function bone(ctx:CanvasRenderingContext2D,image:CanvasImageSource,start:Point,end:Point,pivot:Point,tip:Point){
  const sourceAngle=Math.atan2(tip.y-pivot.y,tip.x-pivot.x),targetAngle=Math.atan2(end.y-start.y,end.x-start.x);
  const scale=Math.hypot(end.x-start.x,end.y-start.y)/Math.hypot(tip.x-pivot.x,tip.y-pivot.y);
  ctx.save();ctx.translate(start.x,start.y);ctx.rotate(targetAngle-sourceAngle);ctx.scale(scale,scale);ctx.drawImage(image,-pivot.x,-pivot.y);ctx.restore();
}
/** Throw hand order: open backswing hand on the reach back, the existing grip as
 * it takes the stick, the lit-dynamite hand through the whip, the existing
 * release hand, then the grip again for the recovery. */
export const KING_THROW_HANDS={reach:.04,backswing:.18,grip:.24,dynamite:KING_THROW_RELEASE,release:.85} as const;
export function kingLeftHandDrawing(tool:KingToolAction|null,open=0,reduced=false):'backswing'|'grip'|'dynamite'|'release'{
  if(tool?.kind!=='throw'||reduced)return open>.5?'release':'grip';
  const p=tool.progress,h=KING_THROW_HANDS;
  return p<h.reach?'grip':p<h.backswing?'backswing':p<h.grip?'grip':p<h.dynamite?'dynamite':p<h.release?'release':'grip';
}
function part(ctx:CanvasRenderingContext2D,image:CanvasImageSource,at:Point,angle:number,pivot:V){
  ctx.save();ctx.translate(at.x,at.y);ctx.rotate(angle);ctx.scale(.5,.5);ctx.drawImage(image,-pivot[0],-pivot[1]);ctx.restore();
}
export function paintKingLeftArm(ctx:CanvasRenderingContext2D,images:KingArmImages,frame:StageKingFrame,tool:KingToolAction|null=null,reduced=false){
  const pose=kingLeftArmPose(frame,tool,reduced);
  bone(ctx,images.upper,pose.shoulder,pose.elbow,{x:180,y:59},{x:161,y:541});
  bone(ctx,images.forearm,pose.elbow,pose.wrist,{x:127,y:51},{x:119,y:552});
  const handTip=offset(pose.wrist,pose.handAngle,58);
  const hand=kingLeftHandDrawing(tool,pose.open,reduced);
  // Registered drawing changes on beats; never two translucent sets of fingers.
  if(hand==='backswing')part(ctx,images.backswingHand,pose.wrist,pose.handAngle-dirOf(KING_PARTS_RIG.backswingHand.pivot,KING_PARTS_RIG.backswingHand.palm),KING_PARTS_RIG.backswingHand.pivot);
  else if(hand==='dynamite')part(ctx,images.dynamiteHand,pose.wrist,pose.handAngle-dirOf(KING_PARTS_RIG.dynamiteHand.pivot,KING_PARTS_RIG.dynamiteHand.grip),KING_PARTS_RIG.dynamiteHand.pivot);
  else if(hand==='release')bone(ctx,images.release,pose.wrist,handTip,{x:185,y:38},{x:171,y:454});
  else bone(ctx,images.grip,pose.wrist,handTip,{x:150,y:39},{x:135,y:399});
  return pose;
}

/** Jointed rod arm from the v88 parts: upper arm over the vest armhole,
 * forearm, rod (behind the fist), then the gripping hand. */
export function paintKingRightRod(ctx:CanvasRenderingContext2D,images:KingArmImages,frame:StageKingFrame,tool:KingToolAction|null=null,reduced=false){
  const p=kingRightArmPose(frame,tool,reduced),R=KING_PARTS_RIG;
  part(ctx,images.rightUpper,p.shoulder,p.a1,R.rightUpper.pivot);
  part(ctx,images.rightForearm,p.elbow,p.a2,R.rightForearm.pivot);
  part(ctx,images.rod,p.grip,p.a4,R.rod.pivot);
  part(ctx,images.rightHand,p.wrist,p.a3,R.rightHand.pivot);
  return p;
}

/** Hips and single-piece legs under the vest hem. The boots stay planted: each
 * leg turns about its hip joint and stretches a few percent along its own axis
 * so the ankle lands where it rests, which reads as a small knee give. */
export function paintKingLowerBody(ctx:CanvasRenderingContext2D,images:KingArmImages,frame:StageKingFrame,reduced=false){
  const R=KING_PARTS_RIG,hip=kingHipShift(frame,reduced);
  const restPelvis={x:R.pelvis[0]/2,y:R.pelvis[1]/2},pelvis=plus(restPelvis,hip);
  const legs=[[images.leftLeg,R.leftLeg,R.hips.leftHip],[images.rightLeg,R.rightLeg,R.hips.rightHip]] as const;
  for(const[image,leg,joint]of legs){
    const restHip=plus(restPelvis,local(R.hips.pivot,joint,0)),at=plus(pelvis,local(R.hips.pivot,joint,hip.tilt));
    const ankle=plus(restHip,local(leg.pivot,leg.ankle,0));
    const axis=dirOf(leg.pivot,leg.ankle),rest=lenOf(leg.pivot,leg.ankle);
    const now=Math.atan2(ankle.y-at.y,ankle.x-at.x),k=Math.hypot(ankle.x-at.x,ankle.y-at.y)/rest;
    ctx.save();ctx.translate(at.x,at.y);ctx.rotate(now);ctx.scale(k,1);ctx.rotate(-axis);ctx.scale(.5,.5);
    ctx.drawImage(image,-leg.pivot[0],-leg.pivot[1]);ctx.restore();
  }
  part(ctx,images.hips,pelvis,hip.tilt,R.hips.pivot);
  return hip;
}
