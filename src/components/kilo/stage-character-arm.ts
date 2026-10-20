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
  rightRod: '/kilo-v81/characters/king-body-left-socket.webp',
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
/** Outline pad added around each re-inked part (see SOURCE.md); upper arm also has a 25 px taller cap. */
const pad=(v:V,n:number,dy=0):V=>[v[0]+n,v[1]+n+dy];
export const KING_PARTS_RIG={
  rightShoulder:[548,418] as V,
  /** w Bo's fit: hips pivot at (690.2,828.5) turned -9.74 deg; legs +14.7 / +10.7 deg to the hips. */
  pelvis:[690.2,828.5] as V,hipsTilt:-9.74,rightLegTurn:14.7,leftLegTurn:10.7,
  rightUpper:{pivot:pad([58.299,32.983],5,25),end:pad([63.897,233.002],5,25)},
  rightForearm:{pivot:pad([97.64,37.775],4),end:pad([36.429,316.767],4)},
  rightHand:{pivot:pad([88.528,113.731],5),grip:pad([41.95,58.097],5)},
  /** Rod pivot moved ~80 px toward the tip (t ~ .77, like the v81 fist). */
  rod:{pivot:[338,518] as V,tip:[15.047,16.912] as V,butt:[436.37,664.739] as V,lineExit:[15.517,23.489] as V},
  hips:{pivot:pad([215.1,53.32],4),rightHip:pad([126.6,111.733],4),leftHip:pad([306.6,111.733],4)},
  rightLeg:{pivot:pad([286,61],4),ankle:pad([181.5,482.5],4)},
  leftLeg:{pivot:pad([106.93,62.355],4),ankle:pad([161.115,476.3],4)},
  dynamiteHand:{pivot:pad([122.25,172.59],4),grip:pad([69.954,117.721],4)},
  backswingHand:{pivot:pad([57.773,144.289],4),palm:pad([83.091,90.181],4),scale:.87},
  /** Wrist overlap: the hand seats 3 source px further up the forearm. */
  wristOverlap:3,
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

/** v81 rod arm: one registered drawing (sleeve, fist and rod) rotated about the
 * shoulder. It is the idle/rest arm; the jointed chain below cannot reach this
 * grip (it would need a ~157 deg elbow fold). */
export const KING_CAST_ROD=[[0,0],[.24,.45],[.33,-.30],[.6,-.18],[.9,.28],[1,0]] as const;
export function kingSocketRodPose(frame:StageKingFrame,tool:KingToolAction|null=null,reduced=false){
  const hip=kingHipShift(frame,reduced),pivot={x:274,y:219},mesh=kingMeshPoint(pivot.x,pivot.y,{...frame,rod:0}),shoulder=plus(mesh,hip);
  let angle=reduced?0:frame.rod*.013;
  if(tool?.kind==='cast'&&!reduced)angle+=curve(tool.progress,KING_CAST_ROD);
  const point=(p:Point)=>({x:shoulder.x+Math.cos(angle)*(p.x-pivot.x)-Math.sin(angle)*(p.y-pivot.y),y:shoulder.y+Math.sin(angle)*(p.x-pivot.x)+Math.cos(angle)*(p.y-pivot.y)});
  return{pivot,shoulder,angle,point,tip:point({x:14,y:12}),butt:point({x:278,y:323})};
}

/** The jointed chain is used only for the extended cast frames: from the snap
 * (.27) through the release and the held line, back to the v81 arm at .75
 * as the pull starts. Both swaps happen on fast motion, at similar rod angles. */
export const KING_CAST_CHAIN={from:.27,to:.75} as const;
export const kingCastChainActive=(tool:KingToolAction|null,reduced=false)=>
  !reduced&&tool?.kind==='cast'&&tool.progress>=KING_CAST_CHAIN.from&&tool.progress<KING_CAST_CHAIN.to;
/** Extended pose: forearm reaching forward-up, rod up-left. Angles are bone
 * directions in degrees (screen, y down); the beats are offsets from it. */
const ARM_REST={upper:95,forearm:-142,rod:-122};
const CAST_UPPER=[[.27,10],[.31,-4],[.36,-10],[.6,-6],[.75,0]] as const;
const CAST_FOREARM=[[.27,17],[.31,-8],[.36,-22],[.6,-12],[.75,0]] as const;
const CAST_WRIST=[[.27,-6],[.31,-26],[.36,-16],[.6,-8],[.75,-2]] as const;
/** Rod flex = the rod rotating against the fist: lags the wrist snap, whips through, settles. */
const CAST_FLEX=[[.27,0],[.29,10],[.31,-13],[.36,5],[.44,-2],[.6,0],[.75,4]] as const;
export function kingRightArmPose(frame:StageKingFrame,tool:KingToolAction|null=null,reduced=false){
  const R=KING_PARTS_RIG,hip=kingHipShift(frame,reduced),s=R.rightShoulder;
  const shoulder=plus(kingMeshPoint(s[0]/2,s[1]/2,{...frame,rod:0}),hip);
  let ua=ARM_REST.upper,fa=ARM_REST.forearm,wrist=0,flex=0;
  if(tool?.kind==='cast'&&!reduced){
    const t=clamp(tool.progress);
    ua+=curve(t,CAST_UPPER);fa+=curve(t,CAST_FOREARM);wrist+=curve(t,CAST_WRIST);flex+=curve(t,CAST_FLEX);
  }
  const a1=ua*deg-dirOf(R.rightUpper.pivot,R.rightUpper.end);
  const elbow=plus(shoulder,local(R.rightUpper.pivot,R.rightUpper.end,a1));
  const a2=fa*deg-dirOf(R.rightForearm.pivot,R.rightForearm.end);
  const wristPoint=plus(elbow,turn({x:Math.cos(fa*deg)*(lenOf(R.rightForearm.pivot,R.rightForearm.end)-R.wristOverlap/2),y:Math.sin(fa*deg)*(lenOf(R.rightForearm.pivot,R.rightForearm.end)-R.wristOverlap/2)},0));
  const handRest=ARM_REST.rod*deg-dirOf(R.rod.pivot,R.rod.tip);
  const a3=handRest+(fa-ARM_REST.forearm)*deg+wrist*deg;
  const grip=plus(wristPoint,local(R.rightHand.pivot,R.rightHand.grip,a3));
  const a4=a3+flex*deg;
  const rodPoint=(p:V)=>plus(grip,local(R.rod.pivot,p,a4));
  return{shoulder,elbow,wrist:wristPoint,grip,a1,a2,a3,a4,angle:a4-handRest,
    tip:rodPoint(R.rod.lineExit),butt:rodPoint(R.rod.butt)};
}
/** Line exit and rod angle of whichever arm is on screen. */
export function kingRightRodPose(frame:StageKingFrame,tool:KingToolAction|null=null,reduced=false){
  if(kingCastChainActive(tool,reduced)){const p=kingRightArmPose(frame,tool,reduced);return{...p,chain:true as const};}
  return{...kingSocketRodPose(frame,tool,reduced),chain:false as const};
}

/** Fixed bone lengths and one bend direction. A compact underarm wind-up
 * avoids fake extra arms, a head-crossing overarm redraw, and elbow flips. */
export function kingLeftArmPose(frame:StageKingFrame,tool:KingToolAction|null=null,reduced=false){
  const hip=kingHipShift(frame,reduced);
  const shoulder=plus(kingMeshPoint(KING_LEFT_ARM.shoulder.x,KING_LEFT_ARM.shoulder.y,frame),hip);
  // At rest the left hand holds the v81 rod butt; it lets go to the hip while
  // the jointed chain makes the extended cast (that rod butt sits by the fist).
  const rod=kingSocketRodPose(frame,tool,reduced),restGrip=rod.butt;
  const wristTarget={x:restGrip.x+24*Math.cos(rod.angle),y:restGrip.y+24*Math.sin(rod.angle)-3};
  if(tool?.kind==='cast'&&!reduced){
    const p=tool.progress,away=smooth((p-.17)/.10)*(1-smooth((p-.75)/.12));
    wristTarget.x+=(shoulder.x+18-wristTarget.x)*away;wristTarget.y+=(shoulder.y+186-wristTarget.y)*away;
  }
  if(!tool&&frame.reaction==='collect'&&!reduced){
    // Two small crank turns around the rod's lower grip.
    const p=frame.reactionProgress??1,effort=smooth((p-.10)/.12)*(1-smooth((p-.78)/.22));
    const turn=Math.PI*4*smooth((p-.10)/.78);
    wristTarget.x+=Math.sin(turn)*11*effort;
    wristTarget.y+=(1-Math.cos(turn))*6*effort;
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
/** Single-stick prop for the thrown dynamite (matches the stick in the lit-dynamite hand). */
export const KING_DYNAMITE_STICK=`${KING_PARTS}dynamite-stick.webp`;
export const KING_THROW_HANDS={reach:.04,backswing:.18,grip:.24,dynamite:KING_THROW_RELEASE,release:.85} as const;
export function kingLeftHandDrawing(tool:KingToolAction|null,open=0,reduced=false):'backswing'|'grip'|'dynamite'|'release'{
  if(tool?.kind!=='throw'||reduced)return open>.5?'release':'grip';
  const p=tool.progress,h=KING_THROW_HANDS;
  return p<h.reach?'grip':p<h.backswing?'backswing':p<h.grip?'grip':p<h.dynamite?'dynamite':p<h.release?'release':'grip';
}
function part(ctx:CanvasRenderingContext2D,image:CanvasImageSource,at:Point,angle:number,pivot:V,scale=1){
  ctx.save();ctx.translate(at.x,at.y);ctx.rotate(angle);ctx.scale(.5*scale,.5*scale);ctx.drawImage(image,-pivot[0],-pivot[1]);ctx.restore();
}
export function paintKingLeftArm(ctx:CanvasRenderingContext2D,images:KingArmImages,frame:StageKingFrame,tool:KingToolAction|null=null,reduced=false){
  const pose=kingLeftArmPose(frame,tool,reduced);
  bone(ctx,images.upper,pose.shoulder,pose.elbow,{x:180,y:59},{x:161,y:541});
  bone(ctx,images.forearm,pose.elbow,pose.wrist,{x:127,y:51},{x:119,y:552});
  const handTip=offset(pose.wrist,pose.handAngle,58);
  const hand=kingLeftHandDrawing(tool,pose.open,reduced);
  // Registered drawing changes on beats; never two translucent sets of fingers.
  if(hand==='backswing')part(ctx,images.backswingHand,pose.wrist,pose.handAngle-dirOf(KING_PARTS_RIG.backswingHand.pivot,KING_PARTS_RIG.backswingHand.palm),KING_PARTS_RIG.backswingHand.pivot,KING_PARTS_RIG.backswingHand.scale);
  else if(hand==='dynamite')part(ctx,images.dynamiteHand,pose.wrist,pose.handAngle-dirOf(KING_PARTS_RIG.dynamiteHand.pivot,KING_PARTS_RIG.dynamiteHand.grip),KING_PARTS_RIG.dynamiteHand.pivot);
  else if(hand==='release')bone(ctx,images.release,pose.wrist,handTip,{x:185,y:38},{x:171,y:454});
  else bone(ctx,images.grip,pose.wrist,handTip,{x:150,y:39},{x:135,y:399});
  return pose;
}

/** Right arm. Rest/idle: the v81 socket drawing (sleeve, fist, rod) through a
 * registered mask; the clean torso covers the shoulder seam. Extended cast
 * frames: the jointed v88 chain over the torso, drawn forearm, upper arm (over
 * the elbow cap), rod, then the fist over the wrist. */
export function paintKingRightRod(ctx:CanvasRenderingContext2D,images:KingArmImages,frame:StageKingFrame,tool:KingToolAction|null=null,reduced=false){
  if(kingCastChainActive(tool,reduced)){
    const p=kingRightArmPose(frame,tool,reduced),R=KING_PARTS_RIG;
    part(ctx,images.rightForearm,p.elbow,p.a2,R.rightForearm.pivot);
    part(ctx,images.rightUpper,p.shoulder,p.a1,R.rightUpper.pivot);
    part(ctx,images.rod,p.grip,p.a4,R.rod.pivot);
    part(ctx,images.rightHand,p.wrist,p.a3,R.rightHand.pivot);
    return;
  }
  const p=kingSocketRodPose(frame,tool,reduced);
  ctx.save();ctx.translate(p.shoulder.x,p.shoulder.y);ctx.rotate(p.angle);ctx.translate(-p.pivot.x,-p.pivot.y);
  ctx.beginPath();[[0,0],[60,0],[210,180],[280,185],[303,215],[298,271],[290,310],[291,348],[235,348],[180,342],[145,316],[132,265],[167,232],[3,38]].forEach(([x,y],i)=>i?ctx.lineTo(x!,y!):ctx.moveTo(x!,y!));ctx.closePath();ctx.clip();
  ctx.drawImage(images.rightRod,0,0,1024,1536,0,0,512,768);ctx.restore();
}

/** Hips and single-piece legs under the vest hem. The boots stay planted: each
 * leg turns about its hip joint and stretches a few percent along its own axis
 * so the ankle lands where it rests, which reads as a small knee give. */
export function paintKingLowerBody(ctx:CanvasRenderingContext2D,images:KingArmImages,frame:StageKingFrame,reduced=false){
  const R=KING_PARTS_RIG,hip=kingHipShift(frame,reduced),restTilt=R.hipsTilt*deg;
  const restPelvis={x:R.pelvis[0]/2,y:R.pelvis[1]/2},pelvis=plus(restPelvis,hip);
  const legs=[[images.leftLeg,R.leftLeg,R.hips.leftHip,R.leftLegTurn],[images.rightLeg,R.rightLeg,R.hips.rightHip,R.rightLegTurn]] as const;
  for(const[image,leg,joint,legTurn]of legs){
    const restLeg=restTilt+legTurn*deg;
    const restHip=plus(restPelvis,local(R.hips.pivot,joint,restTilt)),at=plus(pelvis,local(R.hips.pivot,joint,restTilt+hip.tilt));
    const ankle=plus(restHip,local(leg.pivot,leg.ankle,restLeg));
    const axis=dirOf(leg.pivot,leg.ankle)+restLeg,rest=lenOf(leg.pivot,leg.ankle);
    const now=Math.atan2(ankle.y-at.y,ankle.x-at.x),k=Math.hypot(ankle.x-at.x,ankle.y-at.y)/rest;
    ctx.save();ctx.translate(at.x,at.y);ctx.rotate(now);ctx.scale(k,1);ctx.rotate(-axis+restLeg);ctx.scale(.5,.5);
    ctx.drawImage(image,-leg.pivot[0],-leg.pivot[1]);ctx.restore();
  }
  part(ctx,images.hips,pelvis,restTilt+hip.tilt,R.hips.pivot);
  return hip;
}
