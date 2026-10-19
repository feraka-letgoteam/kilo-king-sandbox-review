export type KingMotion = { breath:number; nod:number; sway:number; look:number; rod:number; brace?:number };
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(n:number)=>{const t=clamp(n);return t*t*(3-2*t);};
const gaussian=(x:number,y:number,cx:number,cy:number,rx:number,ry:number)=>Math.exp(-(((x-cx)/rx)**2+((y-cy)/ry)**2));

/** One continuous drawing, weighted to chest, neck and the rod-grip joint.
 * Neighbouring triangles share vertices; there are no independent body pieces
 * that can separate. The lower body and boots are an undeformed anchor. */
export function kingMeshPoint(x:number,y:number,f:KingMotion) {
  if(y>=500)return{x,y};
  const upper=1-smooth((y-370)/130);
  const chest=gaussian(x,y,347,270,148,165)*upper;
  const shoulders=gaussian(x,y,345,210,125,72)*upper,brace=f.brace??0;
  const head=(1-smooth((y-155)/49))*smooth((x-266)/42);
  // Inked head planes make this modest independent neck articulation readable
  // at phone size. Reaction clocks still come from the existing performance.
  const theta=f.look*.032+f.nod*.041;
  const hx=x-357,hy=y-180,cos=Math.cos(theta),sin=Math.sin(theta);
  // Rod, gripping right hand and right sleeve share one rigid rotation region.
  // The old narrow diagonal weight bent the rod into visible kinks.
  const rigidEdge=Math.min(280,24+y*1.16);
  const rodWeight=(1-smooth((y-345)/110))*(1-smooth((x-rigidEdge)/96));
  const rt=f.rod*.023,rx=x-274,ry=y-219;
  return {
    x:x+(x-347)*f.breath*.031*chest+f.sway*2.5*upper+brace*4*upper
      +(hx*cos-hy*sin-hx)*head+(rx*Math.cos(rt)-ry*Math.sin(rt)-rx)*rodWeight,
    y:y-f.breath*14*chest-f.breath*2.8*shoulders+brace*2*shoulders+f.nod*4.5*head
      +(hx*sin+hy*cos-hy)*head+(rx*Math.sin(rt)+ry*Math.cos(rt)-ry)*rodWeight-f.breath*2.5*rodWeight,
  };
}
const XS=[0,96,176,224,256,280,304,328,352,376,400,432,472,512];
const YS=[0,48,80,104,128,152,176,200,224,256,288,320,360,400,440,500];
export const KING_MESH_POINTS=YS.flatMap(y=>XS.map(x=>({x,y})));
export const KING_MESH_TRIANGLES=YS.slice(1).flatMap((_,row)=>XS.slice(1).flatMap((_,col)=>{
  const a=row*XS.length+col,b=a+1,c=a+XS.length,d=c+1;return[[a,b,c],[b,d,c]];
}));

export function paintKingMesh(ctx:CanvasRenderingContext2D,source:CanvasImageSource,frame:KingMotion) {
  const moved=KING_MESH_POINTS.map(p=>kingMeshPoint(p.x,p.y,frame));
  for(const ids of KING_MESH_TRIANGLES){
    const [s0,s1,s2]=ids.map(i=>KING_MESH_POINTS[i]!),[d0,d1,d2]=ids.map(i=>moved[i]!);
    const sx1=s1!.x-s0!.x,sy1=s1!.y-s0!.y,sx2=s2!.x-s0!.x,sy2=s2!.y-s0!.y;
    const dx1=d1!.x-d0!.x,dy1=d1!.y-d0!.y,dx2=d2!.x-d0!.x,dy2=d2!.y-d0!.y,det=sx1*sy2-sx2*sy1;
    const a=(dx1*sy2-dx2*sy1)/det,b=(dy1*sy2-dy2*sy1)/det,c=(sx1*dx2-sx2*dx1)/det,d=(sx1*dy2-sx2*dy1)/det;
    const e=d0!.x-a*s0!.x-c*s0!.y,f=d0!.y-b*s0!.x-d*s0!.y;
    // Fractional overlap prevents antialias pinholes along shared mesh edges.
    const cx=(d0!.x+d1!.x+d2!.x)/3,cy=(d0!.y+d1!.y+d2!.y)/3;
    ctx.save();ctx.beginPath();
    [d0!,d1!,d2!].forEach((p,i)=>{const radius=Math.hypot(p.x-cx,p.y-cy)||1,x=p.x+(p.x-cx)*.28/radius,y=p.y+(p.y-cy)*.28/radius;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});
    ctx.closePath();ctx.clip();ctx.transform(a,b,c,d,e,f);
    const left=Math.max(0,Math.min(s0!.x,s1!.x,s2!.x)-1),top=Math.max(0,Math.min(s0!.y,s1!.y,s2!.y)-1);
    const width=Math.min(512,Math.max(s0!.x,s1!.x,s2!.x)+1)-left,height=Math.min(768,Math.max(s0!.y,s1!.y,s2!.y)+1)-top;
    ctx.drawImage(source,left*2,top*2,width*2,height*2,left,top,width,height);ctx.restore();
  }
  ctx.drawImage(source,0,1000,1024,536,0,500,512,268);
}
