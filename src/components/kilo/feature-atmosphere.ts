import type { FeatureEnvironmentId } from './feature-environments';
import { illustratedEnvironment } from './illustrated-environment';
import { paintFoliage, foliagePoint, type FoliagePatch } from './environment-foliage';
import { ENVIRONMENT_LAYER_URLS, separatedEnvironmentLayers } from './environment-layers';

type Point = readonly [number, number];
type Region = readonly Point[];
type Atmosphere = {
  sky: Region; cloudY: number; cloudHeight: number; cloudOpacity: number; cloudSpeed: number;
  bird: { from: Point; to: Point; span: number; opacity: number; delay: number };
  palms: readonly FoliagePatch[];
  traffic?: { from: Point; to: Point; width: number; water: Region };
};
export type AtmosphereImages = Record<string, CanvasImageSource | undefined> & { clouds?: CanvasImageSource; jetski?: CanvasImageSource };
export const ATMOSPHERE_URLS = { clouds: '/kilo-v82/environment/cloud-strata.webp', jetski: '/kilo-v79/environment/jetski.webp', ...ENVIRONMENT_LAYER_URLS } as const;
export const ATMOSPHERE_CYCLE_MS = 96000;
// Trim only transparent padding at draw time; the authored cloud silhouette
// keeps its original proportions and reaches the visible sky above the frame.
export const AMBIENT_CLOUD_SOURCE = {x:0,y:70,width:1536,height:280} as const;

/** Hand-fitted source regions share registration with the water painter. */
export function featureAtmosphere(scene: FeatureEnvironmentId, portrait: boolean): Atmosphere {
  return illustratedEnvironment(scene, portrait).atmosphere;
}
const smooth=(t:number)=>{const v=Math.max(0,Math.min(1,t));return v*v*(3-2*v);};
const fade=(u:number)=>smooth(u/.08)*smooth((1-u)/.08);
/** Keep whole cloud silhouettes inside the registered sky. Moving an oversized
 * strip through a hard sky mask cut a visible vertical edge into the drawing. */
export function ambientCloudRects(def:Atmosphere,sourceWidth:number,elapsed:number) {
  const phase=elapsed/48000*def.cloudSpeed;
  return [
    {y:def.cloudY,band:def.cloudHeight,fraction:.70,opacity:def.cloudOpacity,offset:.27,sourceY:def.cloudSpeed===1.5?690:70},
    {y:def.cloudY+def.cloudHeight*.38,band:def.cloudHeight*.74,fraction:.51,opacity:def.cloudOpacity*.62,offset:.73,sourceY:390},
  ].flatMap(layer=>{
    const top=layer.y,bottom=top+layer.band,epsilon=.001;
    const ys=[top+epsilon,bottom-epsilon,...def.sky.flatMap(([,y])=>y>top&&y<bottom?[y-epsilon,y+epsilon]:[])];
    let left=-Infinity,right=Infinity;
    for(const y of ys){
      const hits:number[]=[];
      def.sky.forEach(([ax,ay],i)=>{
        const [bx,by]=def.sky[(i+1)%def.sky.length]!;
        if((ay>y)!==(by>y))hits.push(ax+(bx-ax)*(y-ay)/(by-ay));
      });
      if(hits.length<2)return [];
      left=Math.max(left,Math.min(...hits));right=Math.min(right,Math.max(...hits));
    }
    const margin=sourceWidth*.012;left+=margin;right-=margin;
    const span=right-left;if(span<=0)return [];
    const ratio=AMBIENT_CLOUD_SOURCE.width/AMBIENT_CLOUD_SOURCE.height;
    const width=Math.min(span*layer.fraction,layer.band*ratio),height=width/ratio;
    const progress=((phase+layer.offset)%1+1)%1;
    // Consistent down-wind travel at two apparent depths; no ping-pong turn.
    // The silhouette dissolves at its safe sky margin before the seamless wrap.
    const visibility=smooth(progress/.14)*smooth((1-progress)/.14);
    return [{x:left+(span-width)*progress,y:top,width,height,opacity:layer.opacity*visibility,source:{...AMBIENT_CLOUD_SOURCE,y:layer.sourceY}}];
  });
}
/** Small distant traffic makes one deliberate pass every 32 seconds. */
export function ambientTrafficAt(elapsed:number) {
  const local=((elapsed%32000)+32000)%32000;
  const progress=(local-2000)/16000;
  return {progress,opacity:progress>=0&&progress<=1?fade(progress)*.66:0,
    pitch:Math.sin(local/1600*Math.PI*2)*.018,heave:Math.sin(local/3200*Math.PI*2)*.62};
}
/** Continuous wind with a long gust and a smaller tip lag. Every term closes
 * exactly within 96 s; hard foreground geometry is never displaced. */
export function ambientWindAt(elapsed:number,phase=0) {
  const slow=elapsed/12000*Math.PI*2,fast=elapsed/8000*Math.PI*2;
  const gust=.72+.28*Math.sin(elapsed/24000*Math.PI*2+phase);
  return { sway:Math.sin(slow+phase)*gust, flutter:Math.sin(fast+phase*.7)*.2 };
}
export function ambientBirdAt(elapsed:number,bird:Atmosphere['bird'],index:number) {
  const local=((elapsed+bird.delay-index*750)%16000+16000)%16000;
  const progress=(local-800)/11200;
  const wingPhase=elapsed/(index?1920:1600)*Math.PI*2;
  // A short pair of wing beats, then a readable glide, rather than perpetual
  // identical flapping. Light/dark wing planes share the same silhouette.
  const beat=smooth(Math.sin(elapsed/4800*Math.PI*2+index)*.7+.3);
  return {progress,opacity:progress>=0&&progress<=1?fade(progress)*bird.opacity:0,
    flap:Math.sin(wingPhase)*beat,bank:Math.sin(progress*Math.PI*2)*.15};
}
function polygon(ctx:CanvasRenderingContext2D,points:Region) {
  ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
}

/** Kept as a pure source-space query for proof tooling. The old uniform
 * rectangular ripple has been replaced by individually bound palm fronds. */
export const canopyPoint=foliagePoint;

export function paintFeatureAtmosphere(ctx:CanvasRenderingContext2D,image:CanvasImageSource,scene:FeatureEnvironmentId,
  portrait:boolean,width:number,height:number,elapsed:number,assets:AtmosphereImages,reduced=false) {
  const def=featureAtmosphere(scene,portrait),clock=reduced?0:elapsed;
  const layers=separatedEnvironmentLayers(scene,portrait,assets);
  ctx.save();polygon(ctx,def.sky);ctx.clip();
  if(assets.clouds){
    for(const cloud of ambientCloudRects(def,width,clock)){
      ctx.globalAlpha=cloud.opacity;
      const source=cloud.source;
      ctx.drawImage(assets.clouds,source.x,source.y,source.width,source.height,cloud.x,cloud.y,cloud.width,cloud.height);
    }
  }
  if(!reduced)for(let bird=0;bird<3;bird++) {
    const b=def.bird,pose=ambientBirdAt(clock,b,bird),u=pose.progress;
    if(pose.opacity<=0)continue;
    const x=b.from[0]+(b.to[0]-b.from[0])*u-bird*9,
      y=b.from[1]+(b.to[1]-b.from[1])*u-Math.sin(u*Math.PI)*9+bird*5;
    const span=b.span*(bird? .72 : 1),flap=pose.flap;
    ctx.save();ctx.translate(x,y);ctx.rotate(pose.bank);
    ctx.globalAlpha=pose.opacity;ctx.fillStyle='#90b6cf';ctx.beginPath();
    ctx.moveTo(-span*.5,-flap*span*.3);ctx.quadraticCurveTo(-span*.25,-span*.13,0,0);
    ctx.quadraticCurveTo(span*.25,-span*.13,span*.5,-flap*span*.3);
    ctx.lineTo(span*.18,span*.08);ctx.lineTo(0,span*.17);ctx.lineTo(-span*.18,span*.08);ctx.closePath();ctx.fill();
    ctx.fillStyle='#284461';ctx.beginPath();ctx.moveTo(-span*.15,span*.025);ctx.lineTo(0,span*.2);ctx.lineTo(span*.16,span*.025);ctx.closePath();ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  // Near crowns are a true alpha plane in front of sky motion. Their empty
  // spaces expose the decoded clean backing, rather than stretching sky.
  if(layers&&!reduced)for(const patch of def.palms)paintFoliage(ctx,layers.foliage,patch,clock,width,height);
  if(reduced)return;
  const traffic=def.traffic,pose=ambientTrafficAt(clock);
  if(!traffic||!assets.jetski||pose.opacity<=0)return;
  ctx.save();polygon(ctx,traffic.water);ctx.clip();
  const x=traffic.from[0]+(traffic.to[0]-traffic.from[0])*pose.progress,y=traffic.from[1]+(traffic.to[1]-traffic.from[1])*pose.progress;
  // Two fine diverging foam trails, tapered in space; no spray particles.
  for(let tail=0;tail<8;tail++) {
    const distance=tail*traffic.width*.22;
    ctx.strokeStyle='#c8d7db';ctx.globalAlpha=pose.opacity*.30*(1-tail/8);ctx.lineWidth=.75;
    for(const sign of [-1,1]){ctx.beginPath();ctx.moveTo(x-distance,y+sign*distance*.06);ctx.lineTo(x-distance-traffic.width*.3,y+sign*(distance+traffic.width*.3)*.06);ctx.stroke();}
  }
  ctx.globalAlpha=pose.opacity;ctx.translate(x,y+pose.heave);ctx.rotate(pose.pitch);
  ctx.drawImage(assets.jetski,-traffic.width*.5,-traffic.width*.42,traffic.width,traffic.width*.5);ctx.restore();
}
