import { Container, Text } from 'pixi.js';
import { createWinNumeral, connectedNumberScale } from './win-type';

type Spot={reel:number;row:number};
export type AmountHit={spots:readonly Spot[];pay:number};
type Geometry={gx:number;gy:number;cell:number;gap:number};
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
/** Find a contiguous clear lane. Averaging disjoint clear reels can put the
 * amount back over the intervening wild's face. A wide total instead uses
 * the lower connection lane, above the persistent multiplier baseline. */
export function connectionAmountAnchor(g:Geometry,spots:readonly Spot[],width:number,height:number,blocked:readonly number[]=[]){
  const boardWidth=5*g.cell+4*g.gap,mean=spots.reduce((n,p)=>n+g.gx+(p.reel+.5)*g.cell+p.reel*g.gap,0)/Math.max(1,spots.length);
  const runs:{start:number;end:number}[]=[];
  for(let i=0;i<5;i++){if(blocked.includes(i))continue;const start=i;while(i<4&&!blocked.includes(i+1))i++;runs.push({start,end:i});}
  const choices=runs.flatMap(run=>{const left=g.gx+run.start*(g.cell+g.gap)+4,right=g.gx+(run.end+1)*g.cell+run.end*g.gap-4;
    return right-left>=width?[{x:Math.max(left+width/2,Math.min(right-width/2,mean)),left,right}]:[];}).sort((a,b)=>Math.abs(a.x-mean)-Math.abs(b.x-mean));
  const clear=choices[0],row=spots.reduce((n,p)=>n+p.row,0)/Math.max(1,spots.length);
  return {x:clear?.x??Math.max(g.gx+width/2+4,Math.min(g.gx+boardWidth-width/2-4,mean)),
    y:clear?Math.max(g.gy+height/2+5,Math.min(g.gy+2.1*g.cell,g.gy+(row+.25)*g.cell)):g.gy+2.02*g.cell,clear:!!clear};
}

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
  // Components only when they differ from the total: a single row (or a
  // single line) would print the same amount twice ("10,000 / 10,000").
  const rowGroups=enabled&&hits.length>1?connectionAmountGroups(hits):[];
  const groups=rowGroups.length>1?rowGroups:[];
  const texts=groups.map(g=>{const n=createWinNumeral(g.value.toLocaleString('en-US'),20,0xfff1c6);
    n.label='connection-component-amount';root.addChild(n);return n;});
  return {
    paint(g:Geometry,trace:number,reveal:number,alpha:number,destination:{x:number;y:number},reduced=false,blockedReels:readonly number[]=[]){
      groups.forEach((hit,i)=>{
        const n=texts[i]!;if(n.destroyed)return;
        n.style.fontSize=Math.max(17,g.cell*.27);
        n.style.stroke={color:0x28130c,width:Math.max(1.4,g.cell*.018)};
        const clear=hit.spots.filter(p=>!blockedReels.includes(p.reel));
        if(blockedReels.length===5){n.alpha=0;return;}
        const points=clear.length?clear:hit.spots;
        const spot=connectionAmountAnchor(g,points,n.width+4,n.height,blockedReels);
        if(blockedReels.length&&!spot.clear){n.alpha=0;return;}
        const start={x:spot.x,y:g.gy+(hit.row+.31)*g.cell};
        const begin=.22+i/Math.max(1,groups.length-1)*.44;
        const punch=clamp((trace-begin)/.25),travel=clamp((reveal-.12)/.70);
        const u=travel*travel*(3-2*travel);
        n.position.set(start.x+(destination.x-start.x)*u,start.y+(destination.y-start.y)*u-(reduced?0:g.cell*.05*Math.sin(Math.PI*punch)));
        n.scale.set(connectedNumberScale(punch,reduced));
        n.alpha=trace<begin||reduced?0:alpha*clamp(punch*5)*clamp(1-travel*1.4);
      });
    },
  };
}
