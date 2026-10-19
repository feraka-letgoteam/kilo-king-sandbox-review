import type { Graphics } from 'pixi.js';

/** Finite illustrated effects. No RNG, blur, emitter, idle loop or credit. */
export const IMPACT_INK = 0x071018;
export const IMPACT_GOLD = 0xffcb55;
export const IMPACT_TEAL = 0x79f0da;
export const clamp01 = (n:number) => Math.max(0,Math.min(1,n));
export const smooth01 = (n:number) => {const t=clamp01(n);return t*t*(3-2*t);};

/** A held compression, fast strike, overshoot, counter-settle and exact rest. */
export function impactStamp(t:number,reduced=false) {
  if(reduced)return {x:1,y:1,turn:0,lift:0};
  t=clamp01(t);
  const keys=(v:number,values:readonly(readonly[number,number])[])=>{
    for(let i=1;i<values.length;i++){const a=values[i-1]!,b=values[i]!;if(v<=b[0])return a[1]+(b[1]-a[1])*smooth01((v-a[0])/(b[0]-a[0]));}
    return values.at(-1)![1];
  };
  return {x:keys(t,[[0,.76],[.12,.71],[.34,1.16],[.65,.975],[1,1]]),
    y:keys(t,[[0,.54],[.12,.49],[.34,1.23],[.65,.965],[1,1]]),
    turn:keys(t,[[0,-.12],[.12,-.15],[.34,.035],[.65,-.012],[1,0]]),
    lift:keys(t,[[0,.13],[.12,.15],[.34,-.06],[.65,.012],[1,0]])};
}

/** Bold eight-point, hand-shaped contact. Hollow centre leaves the artwork
 * and value readable. Shape count is fixed and every stroke retires. */
export function paintImpact(graphics:Graphics,x:number,y:number,width:number,height:number,
  progress:number,tone=IMPACT_GOLD,strength=1,reduced=false,clear=true) {
  if(clear)graphics.clear();
  const t=clamp01(progress);
  if(reduced||t<=0||t>=1)return;
  const launch=smooth01(t/.23),retire=1-smooth01((t-.23)/.77);
  const rx=width*(.28+.22*launch),ry=height*(.23+.22*launch);
  const angles=[-.95,-.59,-.14,.32,.84,1.3,1.94,2.6,3.1,3.6,4.1,4.72];
  for(let i=0;i<angles.length;i++){
    const angle=angles[i]!,variation=[1,.72,.91,.65][i%4]!,outer=1+strength*.10;
    const inner=.72+.26*launch,tip=outer*variation,side=.025+strength*.010;
    const px=Math.cos(angle),py=Math.sin(angle),nx=-py,ny=px;
    const coords=[x+px*rx*inner,y+py*ry*inner,
      x+px*rx*tip+nx*width*side,y+py*ry*tip+ny*height*side,
      x+px*rx*(tip+.25),y+py*ry*(tip+.25),
      x+px*rx*tip-nx*width*side*.4,y+py*ry*tip-ny*height*side*.4];
    graphics.poly(coords).fill({color:IMPACT_INK,alpha:retire});
    graphics.poly(coords.map((v,j)=>v+(j%2?-.7:.7))).fill({color:i%3? tone:0xfff8d9,alpha:retire*.92});
  }
}

/** Illustrated torn ticket. Deliberate corner cuts and hard offset underside;
 * it reads as the same object in every entry, retrigger and earned award. */
export function paintEventTicket(g:Graphics,x:number,y:number,w:number,h:number,tone=IMPACT_GOLD){
  const cut=Math.min(14,h*.17),shape=[x+cut,y,x+w-cut,y,x+w,y+cut,x+w-4,y+h*.48,
    x+w,y+h-cut,x+w-cut,y+h,x+cut*.7,y+h,x,y+h-cut,x+4,y+h*.46,x,y+cut];
  g.poly(shape.map((v,i)=>v+(i%2?5:0))).fill(0x020910);
  g.poly(shape).fill(0x102a31).stroke({color:IMPACT_INK,width:5,join:'bevel'});
  g.moveTo(x+cut+2,y+2).lineTo(x+w-cut-2,y+2).lineTo(x+w-3,y+cut)
    .stroke({color:tone,width:3,join:'bevel'});
  g.poly([x+3,y+h*.69,x+cut,y+h-3,x+w-cut,y+h-3,x+w-3,y+h-cut,x+w-cut-6,y+h-8,x+cut+2,y+h-8])
    .fill({color:tone,alpha:.45});
  for(const side of [-1,1]){
    const cx=side<0?x+9:x+w-9;
    g.poly([cx,y+h*.36,cx+side*5,y+h*.5,cx,y+h*.64,cx-side*3,y+h*.5]).fill(tone);
  }
}
