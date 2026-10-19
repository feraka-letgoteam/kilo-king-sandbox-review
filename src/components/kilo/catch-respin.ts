import { Container, Graphics, Text } from 'pixi.js';
import type { SplashCell, SplashDrop } from '@/lib/kilo/engine';
import type { SpinSpeed } from './control-model';
import type { KingToolEvent } from './stage-character-arm';

type CatchRun = NonNullable<SplashDrop['catchRun']>;
type Geometry = {gx:number;gy:number;cell:number;gap:number};
type Adapter = {
  host:HTMLElement; world:Container; geom:()=>Geometry;
  cell:(cell:SplashCell,size:number)=>Container;
  pace:()=>{speed:SpinSpeed;reduced:boolean};
  tween:(ms:number,draw:(t:number)=>void)=>Promise<void>;
  spin:(grid:SplashCell[][])=>Promise<void>;
  live:()=>boolean;
  cue:(name:'hookCast'|'hookCatch'|'hookRelease')=>void;
};

/** One recorded, no-charge recovery spin. The visible cargo is the exact
 * pre-spin cargo, not a rerolled prize or an overlay selected by the renderer. */
export async function presentCatchRespin(a:Adapter,run:CatchRun,grid:SplashCell[][]) {
  const root=new Container();root.label='catch-respin';a.world.addChild(root);
  const cargo=new Container(),rope=new Graphics(),label=new Text({text:'ONE CATCH RESPIN',style:{
    fontFamily:'Source Sans 3',fontWeight:'700',fontSize:14,fill:0xffe6a0,
    stroke:{color:0x04141e,width:3},align:'center'}});
  label.anchor.set(.5);root.addChild(cargo,rope,label);
  let build=0,release=0,phase:'cast'|'respin'|'settle'='cast',geometry='';
  const pace=a.pace(),duration=(ms:number)=>pace.reduced?0:ms*{normal:1,turbo:.55,super:.34}[pace.speed];
  const actor=(progress:number)=>a.host.dispatchEvent(new CustomEvent<KingToolEvent>('kilo-stage-tool',{
    bubbles:true,detail:{kind:'cast',progress}}));
  const paint=()=>{
    if(root.destroyed||!a.live())return;
    const g=a.geom(),w=g.cell*5+g.gap*4,key=`${g.gx}:${g.gy}:${g.cell}:${g.gap}`;
    if(key!==geometry){
      geometry=key;cargo.removeChildren().forEach(n=>n.destroy({children:true}));
      for(const p of run.held){
        const x=g.gx+p.reel*(g.cell+g.gap),y=g.gy+p.row*g.cell;
        cargo.addChild(new Graphics().rect(x,y,g.cell,g.cell).fill(0x06151d));
        const art=a.cell(run.before[p.reel]![p.row]!,g.cell);art.position.set(x,y);
        art.label=`catch-held-${p.id}`;cargo.addChild(art);
      }
    }
    rope.clear();
    for(const p of run.held){
      const x=g.gx+p.reel*(g.cell+g.gap),y=g.gy+p.row*g.cell;
      const inset=g.cell*.075,tension=phase==='cast'?build:1,reach=g.cell*(.16+.05*tension),alpha=1-release;
      // Four cut rope clamps leave the parcel and its printed value clear.
      for(const[sx,sy]of [[1,1],[-1,1],[1,-1],[-1,-1]]){
        const cx=x+(sx===1?inset:g.cell-inset),cy=y+(sy===1?inset:g.cell-inset);
        rope.moveTo(cx,cy+sy*reach).lineTo(cx,cy).lineTo(cx+sx*reach,cy)
          .stroke({color:0x08262c,width:Math.max(4,g.cell*.055),alpha});
        rope.moveTo(cx,cy+sy*reach).lineTo(cx,cy).lineTo(cx+sx*reach,cy)
          .stroke({color:0x9debdc,width:Math.max(2,g.cell*.025),alpha});
      }
      if(phase==='cast'&&!pace.reduced){
        const endX=x+g.cell*.5,endY=y+inset,headX=g.gx+w*.93,headY=g.gy+4;
        const t=Math.min(1,build*1.5),ex=headX+(endX-headX)*t,ey=headY+(endY-headY)*t;
        rope.moveTo(headX,headY).quadraticCurveTo((headX+ex)/2,Math.min(headY,ey)-g.cell*.06*(1-tension),ex,ey)
          .stroke({color:0xf6d584,width:Math.max(1.4,g.cell*.015),alpha:.85});
      }
    }
    label.style.fontSize=Math.max(12,Math.min(17,g.cell*.17));
    label.position.set(g.gx+w/2,g.gy+g.cell*3-label.height/2-4);
    label.alpha=phase==='cast'?Math.min(1,build*4):phase==='settle'?1-release:1;
    cargo.alpha=1; // Printed cargo labels never travel or fade during the spin.
    a.host.dataset.catchPhase=phase;
  };
  a.host.addEventListener('kilo-relayout',paint);
  try {
    paint();a.cue('hookCast');
    await a.tween(duration(640),t=>{build=t;actor(t*.88);paint();});
    if(!a.live())return;
    actor(1);phase='respin';paint();
    await a.spin(grid);
    if(!a.live())return;
    phase='settle';label.text=run.caught?'CATCH LANDED':'CARGO RELEASED';
    a.cue(run.caught?'hookCatch':'hookRelease');
    await a.tween(duration(220),t=>{release=t*t;paint();});
  } finally {
    actor(1);a.host.removeEventListener('kilo-relayout',paint);
    delete a.host.dataset.catchPhase;
    if(!root.destroyed)root.destroy({children:true});
  }
}
