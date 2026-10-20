import { kingMeshPoint } from './stage-character-mesh';
import type { StageKingFrame } from './stage-character-life';

/** Anatomical names, not screen-side names: LEFT throws; RIGHT retains the rod.
 * The source clean plate has no left arm. Exactly one joint chain is painted. */
export const KING_ARM_ASSETS = {
  body: '/kilo-v82/characters/stage-headless.webp',
  heads: '/kilo-v82/characters/stage-heads.webp',
  rightRod: '/kilo-v81/characters/king-body-left-socket.webp',
  upper: '/kilo-v81/characters/left-upper.webp',
  forearm: '/kilo-v81/characters/left-forearm.webp',
  grip: '/kilo-v81/characters/left-grip.webp',
  release: '/kilo-v81/characters/left-release.webp',
} as const;
export type KingArmImages = Record<keyof typeof KING_ARM_ASSETS, CanvasImageSource>;
export type KingToolAction = { kind:'cast'|'throw'; progress:number };
export type KingToolEvent = KingToolAction & { hand?:Point;rodTip?:Point;releaseHand?:Point; handSize?:number };
export const KING_STAGE_CANVAS={width:672,height:864,offsetX:96,offsetY:96} as const;
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
/** Hook cast beats, across the descent (0-.6) and pull (.6-1) tweens:
 * rod back (load), snap forward, hold on the line, pull back with the reel. */
export const KING_CAST_ROD=[[0,0],[.24,.45],[.33,-.30],[.6,-.18],[.9,.28],[1,0]] as const;
export function kingRightRodPose(frame:StageKingFrame,tool:KingToolAction|null=null,reduced=false){
  const pivot={x:274,y:219},shoulder=kingMeshPoint(pivot.x,pivot.y,{...frame,rod:0});
  let angle=reduced?0:frame.rod*.013;
  if(tool?.kind==='cast'&&!reduced)angle+=curve(tool.progress,KING_CAST_ROD);
  const point=(p:Point)=>({x:shoulder.x+Math.cos(angle)*(p.x-pivot.x)-Math.sin(angle)*(p.y-pivot.y),y:shoulder.y+Math.sin(angle)*(p.x-pivot.x)+Math.cos(angle)*(p.y-pivot.y)});
  return{pivot,shoulder,angle,point,tip:point({x:14,y:12}),butt:point({x:278,y:323})};
}

/** Fixed bone lengths and one bend direction. A compact underarm wind-up
 * avoids fake extra arms, a head-crossing overarm redraw, and elbow flips. */
export function kingLeftArmPose(frame:StageKingFrame,tool:KingToolAction|null=null,reduced=false){
  const shoulder=kingMeshPoint(KING_LEFT_ARM.shoulder.x,KING_LEFT_ARM.shoulder.y,frame);
  const rod=kingRightRodPose(frame,tool,reduced),restGrip=rod.butt,wristTarget={x:restGrip.x+24*Math.cos(rod.angle),y:restGrip.y+24*Math.sin(rod.angle)-3};
  if(!tool&&frame.reaction==='collect'&&!reduced){
    // Two small crank turns around the rod's existing lower grip. The right
    // arm keeps the rod; a constant-length left chain follows the handle.
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
    holdingDynamite:tool?.kind==='throw'&&tool.progress<KING_THROW_RELEASE&&!reduced};
}

function bone(ctx:CanvasRenderingContext2D,image:CanvasImageSource,start:Point,end:Point,pivot:Point,tip:Point){
  const sourceAngle=Math.atan2(tip.y-pivot.y,tip.x-pivot.x),targetAngle=Math.atan2(end.y-start.y,end.x-start.x);
  const scale=Math.hypot(end.x-start.x,end.y-start.y)/Math.hypot(tip.x-pivot.x,tip.y-pivot.y);
  ctx.save();ctx.translate(start.x,start.y);ctx.rotate(targetAngle-sourceAngle);ctx.scale(scale,scale);ctx.drawImage(image,-pivot.x,-pivot.y);ctx.restore();
}
export function paintKingLeftArm(ctx:CanvasRenderingContext2D,images:KingArmImages,frame:StageKingFrame,tool:KingToolAction|null=null,reduced=false){
  const pose=kingLeftArmPose(frame,tool,reduced);
  bone(ctx,images.upper,pose.shoulder,pose.elbow,{x:180,y:59},{x:161,y:541});
  bone(ctx,images.forearm,pose.elbow,pose.wrist,{x:127,y:51},{x:119,y:552});
  const handTip=offset(pose.wrist,pose.handAngle,58);
  const release=tool?.kind==='throw'?tool.progress>=KING_THROW_RELEASE&&tool.progress<.85:pose.open>.5;
  // Registered drawing change at release; never two translucent sets of fingers.
  if(release)bone(ctx,images.release,pose.wrist,handTip,{x:185,y:38},{x:171,y:454});
  else bone(ctx,images.grip,pose.wrist,handTip,{x:150,y:39},{x:135,y:399});
  return pose;
}

/** A source-registered mask keeps the accepted right hand, sleeve and rod as
 * one rigid drawing. The clean torso covers the shoulder seam. No redraw swap. */
export function paintKingRightRod(ctx:CanvasRenderingContext2D,images:KingArmImages,frame:StageKingFrame,tool:KingToolAction|null=null,reduced=false){
  const p=kingRightRodPose(frame,tool,reduced);
  ctx.save();ctx.translate(p.shoulder.x,p.shoulder.y);ctx.rotate(p.angle);ctx.translate(-p.pivot.x,-p.pivot.y);
  ctx.beginPath();[[0,0],[60,0],[210,180],[280,185],[303,215],[298,271],[290,310],[291,348],[235,348],[180,342],[145,316],[132,265],[167,232],[3,38]].forEach(([x,y],i)=>i?ctx.lineTo(x!,y!):ctx.moveTo(x!,y!));ctx.closePath();ctx.clip();
  ctx.drawImage(images.rightRod,0,0,1024,1536,0,0,512,768);ctx.restore();
}
