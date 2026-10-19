/** Connected 2D performances. The shipping atlases are baked from this
 * exact fixed-length arm rig, rather than opacity-blended whole-body poses.
 * All motion is finite. Sampling is driven by the encounter's normalized clock. */
export type VsActorSide = 'king' | 'vice';
export type VsActorOutcome = 'win' | 'loss';
type Point = { x:number; y:number };
export const VS_ACTOR_FRAME_SIZE=256;
export const VS_ACTOR_FRAME_COUNT=64;
export const VS_ACTOR_COLUMNS=8;
export const VS_ACTOR_ROWS=8;
export const VS_ACTOR_ATLASES={
  king:{win:'/kilo-v85/vs/king-win.webp',loss:'/kilo-v85/vs/king-loss.webp'},
  vice:{win:'/kilo-v85/vs/vice-win.webp',loss:'/kilo-v85/vs/vice-loss.webp'},
} as const;
export const VS_ACTOR_URLS=Object.values(VS_ACTOR_ATLASES).flatMap(item=>Object.values(item));
export function vsActorFrameIndex(progress:number,reduced=false){
  return reduced?VS_ACTOR_FRAME_COUNT-1:Math.round(Math.max(0,Math.min(1,progress))*(VS_ACTOR_FRAME_COUNT-1));
}
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
function curve(t:number,keys:readonly(readonly[number,number])[]){
  for(let i=1;i<keys.length;i++){const a=keys[i-1]!,b=keys[i]!;if(t<=b[0])return a[1]+(b[1]-a[1])*smooth((t-a[0])/(b[0]-a[0]));}
  return keys.at(-1)![1];
}
function rotate(p:Point,angle:number,center:Point):Point{const c=Math.cos(angle),s=Math.sin(angle),x=p.x-center.x,y=p.y-center.y;return{x:center.x+x*c-y*s,y:center.y+x*s+y*c};}
function arm(shoulder:Point,hand:Point,bend:number){
  const upperLength=96,forearmLength=122,dx=hand.x-shoulder.x,dy=hand.y-shoulder.y;
  const reach=Math.hypot(dx,dy),distance=Math.min(upperLength+forearmLength-.2,Math.max(Math.abs(upperLength-forearmLength)+.2,reach));
  const direction=Math.atan2(dy,dx),angle=direction+bend*Math.acos((upperLength**2+distance**2-forearmLength**2)/(2*upperLength*distance));
  const elbow={x:shoulder.x+Math.cos(angle)*upperLength,y:shoulder.y+Math.sin(angle)*upperLength};
  const target=distance===reach?hand:{x:shoulder.x+Math.cos(direction)*distance,y:shoulder.y+Math.sin(direction)*distance};
  return{shoulder,elbow,hand:target,upperLength,forearmLength,reach,clamped:distance!==reach};
}

export function vsActorPoseAt(side:VsActorSide,outcome:VsActorOutcome,progress:number){
  const t=clamp(progress),king=side==='king',won=outcome==='win',sign=king?1:-1;
  // Hold the loaded shape before committing. The drive and recoil change the
  // arms/head independently; silhouette change is not a whole-card scale.
  const load=curve(t,[[0,0],[.14,0],[.27,1],[.35,1],[.48,0],[1,0]]);
  const drive=curve(t,[[0,0],[.35,0],[.49,1],[.535,.88],[.63,0],[1,0]]);
  const recoil=curve(t,[[0,0],[.50,0],[.59,1],[.72,.15],[.86,0],[1,0]]);
  const result=curve(t,[[0,0],[.63,0],[.76,1],[.86,.92],[1,1]]);
  const torsoAngle=sign*(-.105*load+.155*drive+(won?-.065:-.17)*recoil+(won?-.04:.085)*result);
  const torsoOffset={x:sign*(-18*load+28*drive-(won?7:23)*recoil),y:15*load-13*drive+13*recoil+(won?-8:10)*result};
  const torsoPivot={x:256,y:450};
  const bodyPoint=(p:Point)=>{const q=rotate(p,torsoAngle,torsoPivot);return{x:q.x+torsoOffset.x,y:q.y+torsoOffset.y};};
  const shoulderA=bodyPoint({x:king?130:146,y:king?303:290}),shoulderB=bodyPoint({x:king?365:366,y:king?284:291});
  // Both props reach y=290 at the shared contact. The close-up uses one
  // horizontal confrontation space: retaining the old stacked-panel heights
  // made the rod pass below the cuffs instead of meeting them.
  const tool={x:256+sign*(-28*load+29*drive-24*recoil),y:(king?408:392)+(king?-36:-27)*load+(king?-118:-102)*drive+(king?-15:27)*recoil+(won?(king?-21:-20):18)*result,
    angle:sign*(-.18*load+.21*drive-(won?.045:.15)*recoil)+(won?sign*-.12:sign*.15)*result};
  const gripDistance=king?150:110;
  const handA=rotate({x:tool.x-gripDistance/2,y:tool.y},tool.angle,tool),handB=rotate({x:tool.x+gripDistance/2,y:tool.y},tool.angle,tool);
  const left=arm(shoulderA,handA,1),right=arm(shoulderB,handB,-1);
  const headBase=bodyPoint({x:king?282:258,y:228});
  const faceFollow=curve(t,[[0,0],[.59,0],[.73,1],[.84,.82],[1,.82]]);
  const head={x:headBase.x+sign*(won?3:-7)*faceFollow,
    y:headBase.y+4*load-9*drive+10*recoil+(won?-8:10)*faceFollow,
    angle:torsoAngle+sign*(.11*load-.16*drive+(won?-.09:.22)*recoil+(won?-.07:.11)*result+(won?-.12:.15)*faceFollow),
    expression:(t<.27?'ready':t<.57?'effort':won&&t>=.66?'win':!won?'loss':'effort') as 'ready'|'effort'|'win'|'loss'};
  return{side,outcome,progress:t,load,drive,recoil,result,torsoAngle,torsoOffset,torsoPivot,tool,left,right,head};
}

export type VsActorParts=Record<'torso'|'head-ready'|'head-effort'|'head-win'|'head-loss'|'upper'|'forearm-left'|'forearm-right'|'tool',CanvasImageSource>;
function bone(ctx:CanvasRenderingContext2D,img:CanvasImageSource,start:Point,end:Point,sourceA:Point,sourceB:Point,thickness=1){
  const a=Math.atan2(end.y-start.y,end.x-start.x)-Math.atan2(sourceB.y-sourceA.y,sourceB.x-sourceA.x);
  const scale=Math.hypot(end.x-start.x,end.y-start.y)/Math.hypot(sourceB.x-sourceA.x,sourceB.y-sourceA.y);
  ctx.save();ctx.translate(start.x,start.y);ctx.rotate(Math.atan2(end.y-start.y,end.x-start.x));ctx.scale(scale,scale*thickness);ctx.rotate(-Math.atan2(sourceB.y-sourceA.y,sourceB.x-sourceA.x));ctx.drawImage(img,-sourceA.x,-sourceA.y);ctx.restore();
}
/** Fixed 512×512 authoring space. No opacity blending of arms, hands or faces. */
export function paintVsActor(ctx:CanvasRenderingContext2D,parts:VsActorParts,side:VsActorSide,outcome:VsActorOutcome,progress:number){
  const p=vsActorPoseAt(side,outcome,progress),king=side==='king';
  const upperA=king?{x:90,y:43}:{x:104,y:44},upperB=king?{x:145,y:277}:{x:150,y:269};
  
  ctx.save();ctx.translate(p.torsoOffset.x,p.torsoOffset.y);ctx.translate(p.torsoPivot.x,p.torsoPivot.y);ctx.rotate(p.torsoAngle);ctx.translate(-p.torsoPivot.x,-p.torsoPivot.y);
  ctx.drawImage(parts.torso,king?88:78,king?211:216,king?328:350,king?259:303);ctx.restore();
  for(const a of [p.left,p.right])bone(ctx,parts.upper,a.shoulder,a.elbow,upperA,upperB,king?1.4:1.3);
  // Prop is behind the fingers: two hands remain connected to one held object.
  ctx.save();ctx.translate(p.tool.x,p.tool.y);ctx.rotate(p.tool.angle);
  if(king)ctx.drawImage(parts.tool,-142,-17,284,122);
  else ctx.drawImage(parts.tool,-126,-23,252,103);
  ctx.restore();
  bone(ctx,parts['forearm-left'],p.left.elbow,p.left.hand,{x:65,y:33},{x:240,y:225});
  bone(ctx,parts['forearm-right'],p.right.elbow,p.right.hand,{x:253,y:33},{x:81,y:225});
  ctx.save();ctx.translate(p.head.x,p.head.y);ctx.rotate(p.head.angle);
  ctx.drawImage(parts[`head-${p.head.expression}`],king?-132:-117,king?-206:-209,king?229:220,king?217:246);ctx.restore();
  return p;
}
