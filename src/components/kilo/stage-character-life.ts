import definition from '../../../public/kilo-v79/characters/king-stage.json';
import { paintKingMesh, kingMeshPoint } from './stage-character-mesh';
import { KING_ARM_ASSETS, KING_STAGE_CANVAS, paintKingLeftArm, paintKingRightRod, type KingArmImages, type KingToolAction } from './stage-character-arm';

export const STAGE_KING = definition;
export const STAGE_KING_URLS = [definition.image, definition.blink.image, definition.reaction.image, ...Object.values(KING_ARM_ASSETS)] as const;
export type StageReaction = 'spin' | 'collect' | 'collect-bank' | 'entry' | 'retrigger' | 'vs' | 'vs-win' | 'vs-loss' | 'max' | 'max-stop' | 'max-loss' | 'win';
export const STAGE_REACTION_MS = { spin: 680, vs: 960, 'vs-win': 760, 'vs-loss': 700,
  max: 1040, 'max-stop': 1100, 'max-loss': 780, win: 1100,
  collect: 1140, 'collect-bank': 700, entry: 840, retrigger: 1000 } as const;
const REACTION_PRIORITY:Record<StageReaction,number>={spin:0,collect:1,'collect-bank':2,entry:2,retrigger:3,win:1,vs:2,max:2,'vs-win':3,'vs-loss':3,'max-stop':4,'max-loss':4};
export type StageKingFrame = { elapsed: number; breath: number; nod: number; sway:number;look:number;rod:number; brace:number; blink: 'open' | 'half' | 'closed' | 'brow';reaction?:StageReaction;reactionProgress?:number };
const clamp = (n:number) => Math.max(0,Math.min(1,n));

/** A continuous painted silhouette. The lower body, feet and contact shadows
 * never move; there are no independent cutout joints to separate. */
function motionFrameAt(elapsed:number,reactionElapsed=Infinity,reduced=false,kind:StageReaction='win'):StageKingFrame {
  if(reduced)return {elapsed,breath:0,nod:0,sway:0,look:0,rod:0,brace:0,blink:'open'};
  const phase=elapsed/3800*Math.PI*2,breath=(1-Math.cos(phase))/2;
  const reaction=clamp(reactionElapsed/STAGE_REACTION_MS[kind]);
  const active=reactionElapsed>=0&&reactionElapsed<STAGE_REACTION_MS[kind];
  // Quick preparation, deliberate effort, damped return. Idle time never resets.
  const effort=active?Math.sin(Math.PI*reaction)**2:0;
  const nod=active?Math.sin(reaction*Math.PI*2)*Math.sin(reaction*Math.PI)*(kind==='spin'?.38:kind==='win'?1:.6):0;
  const clock=elapsed%26000;
  let blink:StageKingFrame['blink']='open';
  for(const at of [3280,9410,16600,16890,23180]){
    const t=clock-at;
    if(t>=0&&t<160)blink=t<45||t>=115?'half':'closed';
  }
  if(kind!=='spin'&&reactionElapsed>=220&&reactionElapsed<500)blink='brow';
  const smooth=(n:number)=>{const u=clamp(n);return u*u*(3-2*u);};
  // Result performances load briefly, commit, hold their silhouette and then
  // recover. A single generic sine bob made success and defeat look alike.
  const resultKind=['vs-win','vs-loss','max-stop','max-loss','win'].includes(kind);
  const hit=active?(resultKind?smooth((reaction-.09)/.18)*(1-smooth((reaction-.55)/.45)):
    smooth(reaction/.20)*(1-smooth((reaction-.40)/.60))):0;
  const returnBeat=active?Math.sin(Math.PI*clamp((reaction-.42)/.58))*(1-reaction):0;
  if (['collect','collect-bank','entry','retrigger'].includes(kind)) {
    const haul=kind==='collect',bank=kind==='collect-bank',reward=kind==='retrigger';
    const pull=active?smooth((reaction-.12)/.22)*(1-smooth((reaction-.56)/.44)):0;
    const second=active?Math.sin(Math.PI*clamp((reaction-.48)/.52))*(1-reaction):0;
    return {elapsed,breath,blink,
      nod:(haul?-.75:bank?1.2:reward?-1.2:-.65)*pull+.38*second,
      sway:Math.sin(phase*.5)*.65,
      look:Math.sin(phase-.4)*.55+(haul?-1.25:bank?-.7:reward?-1.7:-1.9)*pull,
      rod:Math.sin(phase-.65)*.8+(haul?-2.4:bank?1.15:reward?2.5:-1.6)*pull-.55*second,
      brace:(haul?-2.15:bank?-.85:reward?-2.3:-1.5)*pull+.9*second};
  }
  if(kind==='vs-win'||kind==='vs-loss'||kind==='max-loss'){
    const success=kind==='vs-win',weight=kind==='max-loss'?1.15:1;
    return {elapsed,breath,blink,nod:(success?-1.3:1.75)*hit-.55*returnBeat,
      sway:Math.sin(phase*.5)*.65,
      look:Math.sin(phase-.4)*.55+(success?-2.1:2.0)*hit,
      rod:Math.sin(phase-.65)*.8+(success?3.4:-2.7)*hit+returnBeat,
      brace:((success?-3.8:3.0)*hit+(success?1.5:-1.25)*returnBeat)*weight};
  }
  // Feature-only load/contact/recovery. Routine base spins stay restrained.
  if(kind==='max'||kind==='max-stop'){
    const stop=kind==='max-stop';
    return {elapsed,breath,nod:(stop?-1.5*hit+1.1*returnBeat:nod*1.9)-returnBeat*.6,blink,
      sway:Math.sin(phase*.5)*.65,
      look:Math.sin(phase-.4)*.55+(stop?3.0:-3.8)*hit,
      rod:Math.sin(phase-.65)*.8+(stop?4.1:-4.0)*hit+returnBeat,
      brace:(stop?-3.7:-4.3)*hit+returnBeat*1.7};
  }
  return {elapsed,breath,nod,blink,
    sway:Math.sin(phase*.5)*.65,
    look:Math.sin(phase-.4)*.65+(kind==='vs'?-1.8:kind==='win'?-1:0)*hit,
    rod:Math.sin(phase-.65)*1.05+(kind==='spin'?-1.1:kind==='vs'?-2.2:kind==='win'?2.4:0)*hit+returnBeat*.4,
    brace:(kind==='vs'?-2.7:kind==='win'?-2.2:.25)*effort};
}

export function stageKingFrameAt(elapsed:number,reactionElapsed=Infinity,reduced=false,kind:StageReaction='win'):StageKingFrame {
  return {...motionFrameAt(elapsed,reactionElapsed,reduced,kind),reaction:kind,reactionProgress:clamp(reactionElapsed/STAGE_REACTION_MS[kind])};
}

/** Driven by the renderer's own tool progress, so Skip and speed cannot leave
 * the actor throwing after the effect has already landed. */
export function kingToolFrame(frame:StageKingFrame,tool:KingToolAction|null,reduced=false):StageKingFrame {
  if(!tool||reduced)return frame;
  const t=clamp(tool.progress),s=(v:number)=>{const n=clamp(v);return n*n*(3-2*n);};
  if(tool.kind==='cast'){
    const load=s(t/.26),release=s((t-.26)/.22),recover=s((t-.54)/.46);
    return {...frame,
      brace:frame.brace+1.3*load-2.1*release+.8*recover,nod:frame.nod-.45*load+.7*release-.25*recover};
  }
  const effort=Math.sin(Math.PI*t)**2;
  return {...frame,brace:frame.brace-.8*effort,nod:frame.nod-.45*effort,look:frame.look-.4*effort};
}

/** Six registered expressions: neutral, strain, joy, loss, half blink, blink.
 * Expression changes are opaque on authored beats; the independent head joint
 * supplies continuous motion, never a double-face opacity morph. */
export function stageKingExpression(frame:StageKingFrame,tool:KingToolAction|null=null,reduced=false){
  if(reduced)return 0;
  if(tool&&tool.progress>.13&&tool.progress<.72)return 1;
  const p=frame.reactionProgress??1;
  if(p>.16&&p<.82){
    if(['win','vs-win','max-stop','retrigger'].includes(frame.reaction??''))return 2;
    if(['vs-loss','max-loss'].includes(frame.reaction??''))return 3;
    if(['vs','max','collect','entry'].includes(frame.reaction??''))return 1;
  }
  return frame.blink==='closed'?5:frame.blink==='half'?4:0;
}
export function paintStageKingHead(ctx:CanvasRenderingContext2D,heads:CanvasImageSource,frame:StageKingFrame,tool:KingToolAction|null=null,reduced=false){
  const actual=kingToolFrame(frame,tool,reduced),base={x:361,y:190};
  const neck=kingMeshPoint(base.x,base.y,{...actual,nod:0,look:0,rod:0});
  const angle=reduced?0:actual.look*.029+actual.nod*.046;
  ctx.save();ctx.translate(neck.x,neck.y);ctx.rotate(angle);
  ctx.drawImage(heads,stageKingExpression(frame,tool,reduced)*256,0,256,256,-80,-123,128,128);ctx.restore();
}

/** Shared browser/offline Canvas painter. Source art is composited once per
 * facial change; this pass deforms a continuous weighted mesh of that coherent image. */
export function paintStageKing(ctx:CanvasRenderingContext2D,source:CanvasImageSource,frame:StageKingFrame,still=false,arms?:KingArmImages,tool:KingToolAction|null=null) {
  const padX=arms?KING_STAGE_CANVAS.offsetX:0,padY=arms?KING_STAGE_CANVAS.offsetY:0;
  ctx.setTransform(1.5,0,0,1.5,padX*1.5,padY*1.5);ctx.clearRect(-padX,-padY,arms?KING_STAGE_CANVAS.width:512,arms?KING_STAGE_CANVAS.height:768);
  ctx.fillStyle='rgba(4,14,20,.25)';ctx.beginPath();ctx.ellipse(333,756,171,7,0,0,Math.PI*2);ctx.fill();
  const actual=kingToolFrame(frame,tool,still);
  const torso=arms?.heads?arms.body:source;
  if(still)ctx.drawImage(torso,0,0,1024,1536,0,0,512,768);
  else paintKingMesh(ctx,torso,arms?{...actual,rod:0}:actual);
  if(arms)paintKingRightRod(ctx,arms,actual,tool,still);
  if(arms)paintKingLeftArm(ctx,arms,actual,tool,still);
  if(arms?.heads)paintStageKingHead(ctx,arms.heads,frame,tool,still);
  else if(arms&&frame.reaction==='max-stop'&&(frame.reactionProgress??1)<1){
    // Raised arm passes behind the head, never through the face. The same head
    // mesh is repainted through this authored silhouette mask, not a pose swap.
    ctx.save();ctx.beginPath();
    const points=[[302,80],[381,69],[412,104],[397,151],[378,173],[352,184],[311,165],[296,135]];
    points.forEach(([x,y],i)=>{const p=kingMeshPoint(x!,y!,actual);if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});ctx.closePath();ctx.clip();
    paintKingMesh(ctx,source,actual);ctx.restore();
  }
}

export function createStageKingPlayback(){
  let elapsed=0,reactionStart=-Infinity,lastReaction='',kind:StageReaction='win',frame=stageKingFrameAt(0);
  return {
    react(key:string,next:StageReaction='win'){
      // An earned-amount notification cannot cut off a still-active encounter
      // result. A real newer success/failure may replace its own anticipation.
      if(elapsed-reactionStart<STAGE_REACTION_MS[kind]&&REACTION_PRIORITY[next]<REACTION_PRIORITY[kind])return;
      if(key!==lastReaction){lastReaction=key;reactionStart=elapsed;kind=next;}
    },
    settle(){reactionStart=-Infinity;},
    advance(delta:number,reduced=false,paused=false){
      if(paused)return frame;
      if(!reduced)elapsed+=Math.max(0,Math.min(80,delta));
      frame=stageKingFrameAt(elapsed,elapsed-reactionStart,reduced,kind);return frame;
    },
    get frame(){return frame;}, get elapsed(){return elapsed;},
  };
}
