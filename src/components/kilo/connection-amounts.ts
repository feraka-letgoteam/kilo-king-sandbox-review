import { Container, Text } from 'pixi.js';
import { createWinNumeral, connectedNumberScale } from './win-type';

type Spot={reel:number;row:number};
export type AmountHit={spots:readonly Spot[];pay:number};
type Geometry={gx:number;gy:number;cell:number;gap:number};
const clamp=(n:number)=>Math.max(0,Math.min(1,n));

/** Simultaneous hits gather into at most three readable row amounts. These are
 * components of one recorded award, never extra credits. Ten lines no longer
 * mean ten serial counters or ten overlapping numbers. */
export function connectionAmountGroups(hits:readonly AmountHit[]) {
  const buckets=new Map<number,{row:number;value:number;spots:Spot[];first:number}>();
  hits.forEach((hit,index)=>{
    if(!hit.spots.length||hit.pay<=0)return;
    const row=Math.round(hit.spots.reduce((n,p)=>n+p.row,0)/hit.spots.length);
    const bucket=buckets.get(row)??{row,value:0,spots:[],first:index};
    bucket.value+=hit.pay;bucket.spots.push(...hit.spots);buckets.set(row,bucket);
  });
  return [...buckets.values()].sort((a,b)=>a.row-b.row);
}

/** At most one strongest path per row. All recorded lines still contribute
 * to the amount and symbol response; their traces no longer form a fine web. */
export function connectionTraceIndices(hits:readonly AmountHit[]) {
  const rows=new Map<number,number>();
  hits.forEach((hit,i)=>{if(!hit.spots.length)return;
    const row=Math.round(hit.spots.reduce((n,p)=>n+p.row,0)/hit.spots.length),old=rows.get(row);
    if(old===undefined||hit.pay>hits[old]!.pay)rows.set(row,i);
  });
  return new Set(rows.values());
}

export function createConnectionAmounts(parent:Container,hits:readonly AmountHit[],enabled=true) {
  const root=new Container();root.label='connection-component-amounts';parent.addChild(root);
  const groups=enabled&&hits.length>1?connectionAmountGroups(hits):[];
  const texts=groups.map(g=>{const n=createWinNumeral(g.value.toLocaleString('en-US'),20,0xfff1c6);
    n.label='connection-component-amount';root.addChild(n);return n;});
  return {
    paint(g:Geometry,trace:number,reveal:number,alpha:number,destination:{x:number;y:number},reduced=false){
      const w=g.cell*5+g.gap*4;
      groups.forEach((hit,i)=>{
        const n=texts[i]!;if(n.destroyed)return;
        n.style.fontSize=Math.max(16,g.cell*.29);
        n.style.stroke={color:0x28130c,width:Math.max(1.4,g.cell*.018)};
        const x=g.gx+hit.spots.reduce((sum,p)=>sum+(p.reel+.5)*g.cell+p.reel*g.gap,0)/hit.spots.length;
        const start={x:Math.max(g.gx+n.width/2+4,Math.min(g.gx+w-n.width/2-4,x)),y:g.gy+(hit.row+.31)*g.cell};
        const begin=.34+hit.first/Math.max(1,hits.length-1)*.28;
        const punch=clamp((trace-begin)/.27),travel=clamp(reveal/.55);
        const u=travel*travel*(3-2*travel);
        n.position.set(start.x+(destination.x-start.x)*u,start.y+(destination.y-start.y)*u-(reduced?0:g.cell*.05*Math.sin(Math.PI*punch)));
        n.scale.set(connectedNumberScale(punch,reduced));
        n.alpha=trace<begin||reduced?0:alpha*clamp(punch*5)*clamp(1-travel*1.75);
      });
    },
  };
}
