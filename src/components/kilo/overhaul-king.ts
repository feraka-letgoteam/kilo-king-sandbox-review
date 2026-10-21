import definition from '../../../public/kilo-overhaul-v1/king/manifest-part.json';
import { kingToolFrame, type StageKingFrame } from './stage-character-life';
import { KING_STAGE_CANVAS, KING_THROW_RELEASE, curve, type KingToolAction } from './stage-character-arm';

type Point = {x:number;y:number};
type Pair = readonly number[];
type Part = {runtimeFile:string;offset:Pair;runtimeSize:Pair;pivot:Pair;childJoint?:Pair;grip?:Pair;gripPivot?:Pair;tip?:Pair;rodTip?:Pair;tipPoint?:Pair;releasePivot?:Pair;supportGripPivot?:Pair};
type Rig = {canvas:Pair;pivots:Record<string,Pair>;parts:Record<string,Part>};
const rig=definition as unknown as Rig;
export const OVERHAUL_KING_PARTS=rig.parts;
export type OverhaulKingImages=Readonly<Record<string,CanvasImageSource>>;
let decodedKing:Promise<Record<string,HTMLImageElement>>|null=null;
/** Shared decode, including the initial loading screen. No animation clock
 * starts while its drawing is still arriving from the network. */
export function preloadOverhaulKing(){
  if(decodedKing)return decodedKing;
  decodedKing=Promise.all(Object.entries(rig.parts).map(([key,part])=>new Promise<readonly[string,HTMLImageElement]>((resolve,reject)=>{
    const image=new Image();image.decoding='async';
    image.onload=()=>void image.decode().catch(()=>{}).then(()=>resolve([key,image]));
    image.onerror=()=>reject(new Error('King drawing unavailable'));image.src='/kilo-overhaul-v1/'+part.runtimeFile;
  }))).then(entries=>Object.fromEntries(entries));
  void decodedKing.catch(()=>{decodedKing=null;});
  return decodedKing;
}
const p=(a:Pair):Point=>({x:a[0]!,y:a[1]!});
const add=(a:Point,b:Point):Point=>({x:a.x+b.x,y:a.y+b.y});
const sub=(a:Point,b:Point):Point=>({x:a.x-b.x,y:a.y-b.y});
const rotate=(a:Point,t:number):Point=>({x:a.x*Math.cos(t)-a.y*Math.sin(t),y:a.x*Math.sin(t)+a.y*Math.cos(t)});
const angle=(a:Point,b:Point)=>Math.atan2(b.y-a.y,b.x-a.x);
const length=(a:Point,b:Point)=>Math.hypot(b.x-a.x,b.y-a.y);
const unit=(n:number)=>Math.max(0,Math.min(1,n));
const rad=Math.PI/180;
// Registration is about the same planted feet and body centre as the accepted
// stage actor. Its CSS box, camera and controls are never changed by this rig.
const SCALE=.475, REGISTER={x:76.5,y:47.25};
const logical=(a:Point):Point=>({x:REGISTER.x+a.x*SCALE,y:REGISTER.y+a.y*SCALE});

/** Fixed-length two-bone chain. Reach is clamped, never achieved by scaling a
 * limb; the authored shoulder/elbow and hip/knee underpaint covers rotation. */
export function solveOverhaulLimb(root:Point,target:Point,a:number,b:number,bend:number){
  const delta=sub(target,root),raw=Math.hypot(delta.x,delta.y);
  const reach=Math.max(Math.abs(a-b)+.01,Math.min(a+b-.01,raw));
  const direction=raw>1e-6?Math.atan2(delta.y,delta.x):Math.PI/2;
  const spread=Math.acos(Math.max(-1,Math.min(1,(a*a+reach*reach-b*b)/(2*a*reach))));
  const elbow=add(root,{x:Math.cos(direction+bend*spread)*a,y:Math.sin(direction+bend*spread)*a});
  const end=add(root,{x:Math.cos(direction)*reach,y:Math.sin(direction)*reach});
  return {root,elbow,end,a1:angle(root,elbow),a2:angle(elbow,end)};
}

export function overhaulKingPose(frame:StageKingFrame,tool:KingToolAction|null=null,reduced=false){
  const f=kingToolFrame(frame,tool,reduced),j=rig.pivots;
  const base=p(j.root!),breath=reduced?0:f.breath;
  // A sub-pixel stage compression leaves the nearly straight painted legs
  // enough knee travel for breathing without pulling either ankle off its boot.
  const hip=add(base,{x:reduced?0:f.sway*2+f.brace*1.4,y:.8+(reduced?0:Math.abs(f.brace)*.7)});
  const tilt=reduced?0:(f.brace*.58+f.sway*.14)*rad;
  const chest=(v:Pair)=>{
    const local=sub(p(v),base);
    return add(hip,rotate({x:local.x*(1+breath*.004),y:local.y*(1+breath*.008)},tilt));
  };
  const rs=chest(j.shoulderR!),ls=chest(j.shoulderL!);
  const ro=reduced?0:f.rod*1.3*rad;
  let wrist=add({x:450,y:580},{x:reduced?0:f.brace*2,y:-breath*3.8});
  let rodTurn=ro;
  if(tool?.kind==='cast'&&!reduced){
    wrist=add(wrist,{x:curve(tool.progress,[[0,0],[.24,190],[.34,-64],[.62,-30],[1,0]]),
      y:curve(tool.progress,[[0,0],[.24,-100],[.34,-60],[.62,-30],[1,0]])});
    rodTurn+=curve(tool.progress,[[0,0],[.24,43],[.34,-28],[.48,-20],[.73,10],[1,0]])*rad;
  }
  const rrest=[p(j.shoulderR!),p(j.elbowR!),p(j.wristR!)];
  const right=solveOverhaulLimb(rs,wrist,length(rrest[0]!,rrest[1]!),length(rrest[1]!,rrest[2]!),1);
  const rightHandKey=rig.parts['hand-r-grip']?'hand-r-grip':'hand-r';
  const rightHand=rig.parts[rightHandKey]!;
  const rightHandTurn=right.a2-angle(rrest[1]!,rrest[2]!)+(reduced?0:f.rod*.18*rad);
  const rightGripOffset=sub(p(rightHand.gripPivot??rightHand.grip??rightHand.pivot),p(rightHand.pivot));
  const rodGrip=add(right.end,rotate(rightGripOffset,rightHandTurn));
  const rodPart=rig.parts.rod,sourceGrip=p(rodPart?.gripPivot??rodPart?.grip??rodPart?.pivot??[0,0]);
  const sourceTip=p(rodPart?.tipPoint??rodPart?.rodTip??rodPart?.tip??[-655,-260]);
  const rodRotation=Math.atan2(-260,-655)+rodTurn-angle(sourceGrip,sourceTip);
  const support=rodPart?.supportGripPivot?p(rodPart.supportGripPivot):add(sourceGrip,{x:255,y:100});
  let leftTarget=add(rodGrip,rotate(sub(support,sourceGrip),rodRotation));
  const t=tool?.progress??1;
  if(tool?.kind==='throw'&&!reduced){
    leftTarget={x:curve(t,[[0,leftTarget.x],[.25,865],[.33,880],[.42,490],[.62,460],[1,leftTarget.x]]),
      y:curve(t,[[0,leftTarget.y],[.25,465],[.33,410],[.42,440],[.62,515],[1,leftTarget.y]])};
  }else if(!tool&&!reduced){
    const progress=f.reactionProgress??1;
    const hit=Math.sin(Math.PI*unit((progress-.07)/.86))**2;
    if(['max-stop','win','vs-win','collect-big','retrigger'].includes(f.reaction??'')){
      leftTarget={x:leftTarget.x+(745-leftTarget.x)*hit,y:leftTarget.y+(420-leftTarget.y)*hit};
    }else if(['vs-loss','max-loss','near-miss'].includes(f.reaction??'')){
      leftTarget=add(leftTarget,{x:100*hit,y:45*hit});
    }
  }
  const lrest=[p(j.shoulderL!),p(j.elbowL!),p(j.wristL!)];
  const throwing=tool?.kind==='throw'&&!reduced;
  const findPart=(keys:string[])=>keys.find(key=>!!rig.parts[key])??'hand-l';
  const leftHandKey=throwing?tool.progress<KING_THROW_RELEASE?
    findPart(['hand-l-dynamite-grip','hand-l-dynamite']):findPart(['hand-l-open-throw','hand-l-open']):findPart(['hand-l-grip','hand-l']);
  const leftHand=rig.parts[leftHandKey]!;
  const leftGripOffset=sub(p(leftHand.releasePivot??leftHand.gripPivot??leftHand.grip??leftHand.pivot),p(leftHand.pivot));
  let left=solveOverhaulLimb(ls,leftTarget,length(lrest[0]!,lrest[1]!),length(lrest[1]!,lrest[2]!),-1);
  let leftHandTurn=left.a2-angle(lrest[1]!,lrest[2]!);
  const supporting=!throwing&&!(f.reactionProgress!==undefined&&f.reactionProgress<1&&
    ['max-stop','win','vs-win','collect-big','retrigger','vs-loss','max-loss','near-miss'].includes(f.reaction??''));
  if(supporting){
    // Solve to the grip, rather than stretching the wrist toward the rod.
    // The hand is rigid with the forearm; its source grip offset extends that
    // second bone analytically, giving exact contact for both planted hands.
    const sourceForearm=sub(lrest[2]!,lrest[1]!),extended=add(sourceForearm,leftGripOffset);
    const gripChain=solveOverhaulLimb(ls,leftTarget,length(lrest[0]!,lrest[1]!),Math.hypot(extended.x,extended.y),-1);
    leftHandTurn=gripChain.a2-Math.atan2(extended.y,extended.x);
    const wristAt=add(gripChain.elbow,rotate(sourceForearm,leftHandTurn));
    left={...gripChain,end:wristAt,a2:angle(gripChain.elbow,wristAt)};
  }
  const releaseGrip=add(left.end,rotate(leftGripOffset,leftHandTurn));
  const actualTip=add(rodGrip,rotate(sub(sourceTip,sourceGrip),rodRotation));
  const hipPoint=(v:Pair)=>add(hip,rotate(sub(p(v),base),tilt*.35));
  const leg=(side:'R'|'L')=>{
    const a=p(j[`hip${side}`]!),b=p(j[`knee${side}`]!),c=p(j[`ankle${side}`]!);
    return solveOverhaulLimb(hipPoint(j[`hip${side}`]!),c,length(a,b),length(b,c),side==='R'?1:-1);
  };
  const neck=chest(j.neck!);
  const headTurn=tilt+(reduced?0:(f.look*.55+f.nod*.8)*rad);
  return {hip,tilt,breath,chest,right,left,rodGrip,rodTurn,rodRotation,sourceGrip,rightHandKey,rightHandTurn,leftHandKey,leftHandTurn,legs:{R:leg('R'),L:leg('L')},neck,headTurn,
    hand:logical(releaseGrip),rodTip:logical(actualTip)};
}

/** New parts, one fixed rig, and one clock shared with the recorded event.
 * Transparent masters are trimmed only for runtime memory; registration comes
 * from their global shared-canvas pivots, never from their trim rectangles. */
export function paintOverhaulKing(ctx:CanvasRenderingContext2D,images:OverhaulKingImages,
  frame:StageKingFrame,reduced=false,tool:KingToolAction|null=null){
  const pose=overhaulKingPose(frame,tool,reduced);
  const draw=(key:string,where?:Point,turn=0,pivot?:Point,stretch:Pair=[1,1])=>{
    const part=rig.parts[key],image=images[key];if(!part||!image)return;
    const at=pivot??p(part.pivot),to=where??at;
    ctx.save();ctx.translate(to.x,to.y);ctx.rotate(turn);ctx.scale(stretch[0]!,stretch[1]!);ctx.translate(-at.x,-at.y);
    ctx.drawImage(image,part.offset[0]!*2,part.offset[1]!*2,part.runtimeSize[0]!*2,part.runtimeSize[1]!*2);ctx.restore();
  };
  const bone=(key:string,from:Point,to:Point)=>{
    const part=rig.parts[key];if(!part?.childJoint)return;
    draw(key,from,angle(from,to)-angle(p(part.pivot),p(part.childJoint)));
  };
  const quality=ctx.canvas.width/KING_STAGE_CANVAS.width;
  ctx.setTransform(quality,0,0,quality,KING_STAGE_CANVAS.offsetX*quality,KING_STAGE_CANVAS.offsetY*quality);
  ctx.clearRect(-KING_STAGE_CANVAS.offsetX,-KING_STAGE_CANVAS.offsetY,KING_STAGE_CANVAS.width,KING_STAGE_CANVAS.height);
  ctx.fillStyle='rgba(4,14,20,.24)';ctx.beginPath();ctx.ellipse(333,756,171,7,0,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.translate(REGISTER.x,REGISTER.y);ctx.scale(SCALE,SCALE);
  for(const side of ['L','R'] as const){
    const chain=pose.legs[side],suffix=side.toLowerCase();
    // Distal caps tuck under the next proximal drawing at the joint.
    // Boots stay at the same registered contact, independently of hip shift.
    draw(`boot-${suffix}`);
    bone(`shin-${suffix}`,chain.elbow,chain.end);bone(`thigh-${suffix}`,chain.root,chain.elbow);
  }
  draw('pelvis',pose.hip,pose.tilt*.35);
  // Upper sleeves are behind the torso, and extend under its shoulder caps.
  bone('upper-arm-l',pose.left.root,pose.left.elbow);
  bone('upper-arm-r',pose.right.root,pose.right.elbow);
  draw('torso',pose.hip,pose.tilt,p(rig.pivots.root!),[1+pose.breath*.004,1+pose.breath*.008]);
  draw('pendant',pose.chest(rig.parts.pendant?.pivot??rig.pivots.neck!),pose.tilt*.7);
  bone('forearm-r',pose.right.elbow,pose.right.end);
  draw(pose.rightHandKey,pose.right.end,pose.rightHandTurn);
  if(rig.parts.rod)draw('rod',pose.rodGrip,pose.rodRotation,pose.sourceGrip);
  bone('forearm-l',pose.left.elbow,pose.left.end);
  draw(pose.leftHandKey,pose.left.end,pose.leftHandTurn);
  const expression=frame.reactionProgress??1;
  const active=expression>.1&&expression<.85&&!reduced;
  const happy=active&&['win','vs-win','max-stop','collect-big','retrigger'].includes(frame.reaction??'');
  const tense=active&&['vs','max','near-miss'].includes(frame.reaction??'');
  // Complete registered heads avoid a second mouth or a visible skin patch.
  // Each expression excludes the separate hat; both follow the same neck joint.
  const headKey=frame.blink==='closed'?'head-blink':happy?'head-grin':tense?'head-shout':'head-neutral';
  draw(images[headKey]?headKey:'head',pose.neck,pose.headTurn,p(rig.pivots.neck!));
  draw('hat',pose.neck,pose.headTurn,p(rig.pivots.neck!));
  ctx.restore();
  return pose;
}
