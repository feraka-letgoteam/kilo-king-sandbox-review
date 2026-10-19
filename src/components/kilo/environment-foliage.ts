import type { SceneId } from './scene-system';

type Point = readonly [number, number];
type Frond = { root: Point; bend: Point; tip: Point; radius: number; stiffness: number; phase: number };
type Pin = { a: Point; b: Point; radius: number };
export type FoliagePatch = {
  id: string; x: number; y: number; width: number; height: number;
  fronds: readonly Frond[]; pins: readonly Pin[]; gain: number; phase: number;
};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
const canonical=(scene:SceneId)=>scene==='loading'||scene==='completion'?'base':scene==='scatter-5'||scene==='mystery'?'chopper':scene==='god-mode'?'max-win':scene;

/** Source-registered transparent crowns. Each branch has its own root, curved
 * spine, stiffness and delayed tip. The source sky, trunk and buildings are
 * separate fixed planes, never part of this deforming material. */
export function environmentFoliage(scene:SceneId,portrait:boolean,width:number,height:number):FoliagePatch[] {
  const id=canonical(scene),p=(v:Point):Point=>[v[0]*width,v[1]*height];
  const patches:FoliagePatch[]=[];
  const crown=(name:string,box:readonly[number,number,number,number],root:Point,
    tips:readonly Point[],radius:number,trunk:Point,gain=1,phase=0)=>{
    const r=p(root),end=p(trunk);
    patches.push({id:`${id}-${portrait?'phone':'desktop'}-${name}`,x:box[0]*width,y:box[1]*height,width:box[2]*width,height:box[3]*height,gain,phase,
      pins:[{a:r,b:end,radius:radius*width*.30}],
      fronds:tips.map((tip,i)=>({root:r,tip:p(tip),
        bend:p([root[0]+(tip[0]-root[0])*.73,root[1]+(tip[1]-root[1])*.18]),
        radius:radius*width,stiffness:.86+(i%3)*.14,phase:i*.52}))});
  };
  if(id==='base'){
    if(portrait){
      crown('near-left',[0,0,.39,.205],[.01,.025],[[.30,.063],[.24,.13],[.135,.165]],.065,[-.05,.21],1.1);
      crown('near-right',[.70,0,.30,.26],[.94,.064],[[.76,.115],[.80,.205],[.895,.225]],.056,[1.04,.28],1,.7);
    }else{
      crown('near-left',[.115,0,.24,.32],[.166,-.037],[[.192,.20],[.235,.272],[.31,.20],[.326,.11]],.036,[0,.34],1.15);
      crown('near-right',[.75,0,.25,.33],[.956,-.012],[[.798,.251],[.864,.281],[.923,.216]],.034,[1.04,.31],1,.65);
    }
  }else if(id==='scatter-3'){
    if(portrait){
      crown('moon-left',[0,0,.35,.20],[.065,.054],[[.005,.146],[.172,.16],[.213,.092]],.043,[-.04,.30],.95);
      crown('city-right',[.73,.12,.27,.25],[.978,.203],[[.78,.23],[.85,.29],[.93,.31]],.040,[1.04,.42],.92,.65);
    }else{
      crown('moon-left',[.015,0,.20,.24],[.127,.036],[[.048,.111],[.083,.20],[.171,.166],[.195,.08]],.030,[.073,.26],.95);
      crown('city-right',[.83,0,.17,.23],[.919,.043],[[.845,.145],[.895,.187],[.971,.154]],.025,[.97,.28],.9,.65);
    }
  }else if(id==='scatter-4'){
    if(portrait){
      crown('deck-left',[0,0,.34,.20],[.046,.061],[[.23,.085],[.23,.138],[.151,.18]],.043,[-.05,.28],.88);
      crown('shore-right',[.79,.12,.21,.235],[.99,.205],[[.829,.225],[.86,.29],[.95,.324]],.035,[1.05,.40],.85,.65);
    }else{
      crown('deck-left',[.212,.025,.12,.255],[.253,.134],[[.233,.198],[.299,.205],[.312,.109]],.019,[.228,.38],.95);
      crown('shore-right',[.907,.065,.093,.29],[.998,.201],[[.943,.203],[.952,.292],[.982,.319]],.019,[1.03,.46],.85,.65);
    }
  }else if(id==='chopper'){
    if(portrait){
      crown('port-left',[0,.375,.095,.145],[.015,.434],[[.069,.43],[.076,.478],[.038,.486]],.017,[-.02,.54],.85);
      crown('port-right',[.18,.397,.215,.13],[.319,.442],[[.228,.45],[.264,.49],[.36,.488]],.022,[.268,.555],.8,.65);
    }else{
      crown('port-left',[.016,.19,.13,.25],[.077,.296],[[.024,.338],[.105,.373],[.139,.305]],.022,[.052,.52],.9);
      crown('port-right',[.203,.265,.12,.24],[.273,.365],[[.219,.422],[.295,.464],[.311,.382]],.019,[.233,.51],.85,.65);
    }
  }else{
    if(portrait){
      crown('arch-left',[.025,0,.40,.19],[.11,.066],[[.36,.083],[.27,.145],[.177,.172]],.046,[-.025,.25],1);
      crown('arch-right',[.645,.08,.355,.255],[.975,.185],[[.731,.207],[.745,.29],[.89,.321]],.045,[1.07,.36],1,.65);
    }else{
      crown('arch-left',[.155,0,.20,.35],[.244,.10],[[.196,.175],[.247,.301],[.329,.193]],.026,[.153,.44],1.08);
      crown('arch-right',[.763,0,.235,.34],[.884,.097],[[.793,.175],[.818,.292],[.957,.221]],.029,[1.005,.445],1,.65);
    }
  }
  return patches;
}

/** Long, coherent breeze with branch lag and much smaller distal flutter.
 * Every harmonic closes at 96 seconds. Wind is never tied to spin speed. */
export function frondWindAt(elapsed:number,branch:number,depth:number,stiffness=1) {
  const t=elapsed/96000*Math.PI*2,lag=branch*.21+depth*.56;
  const gust=.62+.20*Math.sin(t*2-.6)+.18*Math.sin(t*3+.8);
  return (Math.sin(t*8-lag)*gust+.22*Math.sin(t*12-lag*.75))*.047/stiffness
    +Math.sin(t*24-lag*1.8)*.004*depth*depth;
}
function segment(x:number,y:number,a:Point,b:Point){
  const dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1));
  return {t,d:Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t)};
}
type Binding={branch:number;depth:number;weight:number};
type Vertex={x:number;y:number;bindings:Binding[]};
function bind(x:number,y:number,patch:FoliagePatch):Vertex{
  const margin=Math.min(patch.width,patch.height)*.18;
  let pin=smooth(Math.min(x-patch.x,patch.x+patch.width-x,y-patch.y,patch.y+patch.height-y)/margin);
  for(const trunk of patch.pins)pin*=smooth((segment(x,y,trunk.a,trunk.b).d-trunk.radius)/(trunk.radius*.8));
  const bindings:Binding[]=[];
  if(pin>0)patch.fronds.forEach((f,branch)=>{
    let distance=Infinity,depth=0,previous=f.root;
    for(let i=1;i<=10;i++){
      const u=i/10,v=1-u,next:Point=[v*v*f.root[0]+2*v*u*f.bend[0]+u*u*f.tip[0],v*v*f.root[1]+2*v*u*f.bend[1]+u*u*f.tip[1]];
      const s=segment(x,y,previous,next);if(s.d<distance){distance=s.d;depth=(i-1+s.t)/10;}previous=next;
    }
    const influence=1-smooth((distance-f.radius*.35)/(f.radius*1.2));
    const weight=influence*smooth((depth-.10)/.76)*pin;
    if(weight>.00001)bindings.push({branch,depth,weight});
  });
  const sum=bindings.reduce((s,b)=>s+b.weight,0);if(sum>1)for(const b of bindings)b.weight/=sum;
  return{x,y,bindings};
}
function deform(v:Vertex,patch:FoliagePatch,elapsed:number){
  let x=v.x,y=v.y;
  for(const b of v.bindings){
    const f=patch.fronds[b.branch]!,angle=frondWindAt(elapsed,f.phase+patch.phase,b.depth,f.stiffness)*patch.gain;
    const dx=v.x-f.root[0],dy=v.y-f.root[1],cos=Math.cos(angle),sin=Math.sin(angle);
    x+=(dx*cos-dy*sin-dx)*b.weight;y+=(dx*sin+dy*cos-dy)*b.weight;
  }
  return{x,y};
}
export const foliagePoint=(x:number,y:number,patch:FoliagePatch,elapsed:number)=>deform(bind(x,y,patch),patch,elapsed);
type Mesh={vertices:Vertex[];triangles:number[][]};
const meshes=new Map<string,Mesh>();
export function foliageMesh(patch:FoliagePatch):Mesh{
  const key=`${patch.id}-${patch.x}-${patch.y}-${patch.width}-${patch.height}`;
  const saved=meshes.get(key);if(saved)return saved;
  const nx=16,ny=14,vertices:Vertex[]=[],triangles:number[][]=[];
  for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++)vertices.push(bind(patch.x+x*patch.width/nx,patch.y+y*patch.height/ny,patch));
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const a=y*(nx+1)+x,b=a+1,c=a+nx+1,d=c+1;
    // Include pinned cells: the alpha layer contains static crown roots too.
    for(const ids of [[a,b,c],[b,d,c]])triangles.push(ids);
  }
  const mesh={vertices,triangles};meshes.set(key,mesh);return mesh;
}
export function foliageVertices(patch:FoliagePatch,elapsed:number){return foliageMesh(patch).vertices.map(v=>deform(v,patch,elapsed));}

/** Shared vertices plus a fractional overdraw close antialias cracks. Input
 * must be an isolated alpha canopy, never the flattened environment plate. */
export function paintFoliage(ctx:CanvasRenderingContext2D,image:CanvasImageSource,patch:FoliagePatch,elapsed:number,sourceWidth:number,sourceHeight:number){
  const mesh=foliageMesh(patch),dest=foliageVertices(patch,elapsed);
  for(const ids of mesh.triangles){
    const [s0,s1,s2]=ids.map(i=>mesh.vertices[i]!),[d0,d1,d2]=ids.map(i=>dest[i]!);
    const sx1=s1!.x-s0!.x,sy1=s1!.y-s0!.y,sx2=s2!.x-s0!.x,sy2=s2!.y-s0!.y,det=sx1*sy2-sx2*sy1;
    const dx1=d1!.x-d0!.x,dy1=d1!.y-d0!.y,dx2=d2!.x-d0!.x,dy2=d2!.y-d0!.y;
    const a=(dx1*sy2-dx2*sy1)/det,b=(dy1*sy2-dy2*sy1)/det,c=(sx1*dx2-sx2*dx1)/det,d=(sx1*dy2-sx2*dy1)/det;
    const cx=(d0!.x+d1!.x+d2!.x)/3,cy=(d0!.y+d1!.y+d2!.y)/3;
    ctx.save();ctx.beginPath();[d0!,d1!,d2!].forEach((p,i)=>{
      const length=Math.hypot(p.x-cx,p.y-cy)||1,x=p.x+(p.x-cx)*.35/length,y=p.y+(p.y-cy)*.35/length;
      if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);
    });ctx.closePath();ctx.clip();
    ctx.transform(a,b,c,d,d0!.x-a*s0!.x-c*s0!.y,d0!.y-b*s0!.x-d*s0!.y);
    const left=Math.max(0,s0!.x<s1!.x?Math.min(s0!.x,s2!.x)-2:Math.min(s1!.x,s2!.x)-2),top=Math.max(0,Math.min(s0!.y,s1!.y,s2!.y)-2);
    const w=Math.min(sourceWidth,Math.max(s0!.x,s1!.x,s2!.x)+2)-left,h=Math.min(sourceHeight,Math.max(s0!.y,s1!.y,s2!.y)+2)-top;
    ctx.drawImage(image,left,top,w,h,left,top,w,h);ctx.restore();
  }
}
