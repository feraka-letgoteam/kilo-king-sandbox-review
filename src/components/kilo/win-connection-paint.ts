import type { Graphics } from 'pixi.js';
import { paintImpact } from './impact-language';

type Point = { x: number; y: number };
const unit = (n: number) => Math.max(0, Math.min(1, n));
const smoothResponse = (n: number) => { const t=unit(n); return t*t*(3-2*t); };

/** Source-local light, not a screen overlay or particle emitter. The outside
 * stroke carries warmth, the bright core tells the eye where the hit travels.
 * Every arc has a finite contact/recovery; nothing keeps pulsing after a win. */
export function paintWinConnection(path: Graphics, accents: Graphics, points: Point[], cell: number,
  trace: number, response: number, { alpha = 1, reduced = false, wild = new Set<number>(), append = false, intensity = 1 }:
  { alpha?: number; reduced?: boolean; wild?: Set<number>; append?: boolean; intensity?:number } = {}) {
  if (!append) { path.clear(); accents.clear(); }
  const progress = unit(trace), energy = reduced ? .35 : .62 + .38 * Math.sin(Math.PI * unit(response));
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]!, to = points[i + 1]!, u = unit(progress * (points.length - 1) - i);
    // A connection enters the wild's edge; it never draws a bright wire
    // through the character's face or across a continuous combined painting.
    if (wild.has(i) && wild.has(i + 1)) continue;
    const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy)||1;
    const inset=Math.min(cell*.48,length*.42);
    const a=wild.has(i)?{x:from.x+dx/length*inset,y:from.y+dy/length*inset}:from;
    const b=wild.has(i+1)?{x:to.x-dx/length*inset,y:to.y-dy/length*inset}:to;
    if (u <= 0) continue;
    const end = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
    for (const [width, color, opacity] of [[.080, 0x21140e, .96], [.050, 0xf6a43a, 1], [.024, 0xffe89b, 1], [.009, 0xfffbed, 1]]) {
      path.moveTo(a.x, a.y).lineTo(end.x, end.y).stroke({ width: Math.max(1, cell * width!),
        color, alpha: opacity! * alpha * energy * (1 - .77 * smoothResponse(response)), cap: 'round', join: 'round' });
    }
    if (u < 1 && !reduced) {
      const r = cell * .055;
      accents.poly([end.x-r*1.6,end.y,end.x,end.y-r*.7,end.x+r*1.6,end.y,end.x,end.y+r*.7])
        .fill({color:0xfff6c2,alpha});
    }
  }
  for (const [i, p] of points.entries()) {
    const reached = progress * Math.max(1, points.length - 1) - i;
    if (reached < -.001 || wild.has(i)) continue;
    const pulse = reduced ? 0 : Math.sin(Math.PI * unit((reached + response * .7) * .8));
    const radius = cell * (.34 + .045 * pulse), opacity = alpha * (.6 + .4 * pulse);
    // Hard opposed corner strikes leave the illustration open. There is no
    // circular halo around every symbol and no persistent glitter layer.
    for(const side of [-1,1]){
      const x=p.x+side*radius*.82,y=p.y+side*radius*.78,span=cell*(.12+.035*pulse);
      accents.moveTo(x-side*span,y).lineTo(x,y).lineTo(x,y-side*span)
        .stroke({color:0x21140e,width:Math.max(2,cell*.052),alpha:opacity,join:'bevel'});
      accents.moveTo(x-side*span,y-1).lineTo(x,y-1).lineTo(x,y-side*span)
        .stroke({color:0xffd15e,width:Math.max(1.3,cell*.026),alpha:opacity,join:'bevel'});
    }
    if(intensity>=1.3&&!reduced)paintImpact(accents,p.x,p.y,cell*.68,cell*.65,
      unit((reached+response*.8)*.75),0xffd15e,intensity,false,false);
  }
}
