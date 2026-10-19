import { illustratedEnvironment } from './illustrated-environment';
import { FEATURE_ENVIRONMENTS, featureArtworkTransform, type FeatureEnvironmentId } from './feature-environments';
import { ATMOSPHERE_CYCLE_MS, paintFeatureAtmosphere, type AtmosphereImages } from './feature-atmosphere';
import { separatedEnvironmentLayers } from './environment-layers';

export const FEATURE_AMBIENT_LOOP_MS = ATMOSPHERE_CYCLE_MS;
export const FEATURE_ENVIRONMENT_BLEND_MS = 420;

/** The live canvas and offline transition proofs share this exact dissolve.
 * Scene entry is wall-time based and never consumes a game/director delay. */
export function sceneBlendAt(elapsed:number,reduced=false) {
  if(reduced)return 1;
  const t=Math.max(0,Math.min(1,elapsed/FEATURE_ENVIRONMENT_BLEND_MS));
  // Minimum-jerk handover: velocity AND acceleration finish at zero.
  return t*t*t*(10+t*(-15+6*t));
}
export function compositeEnvironmentFrames(ctx:CanvasRenderingContext2D,
  outgoing:CanvasImageSource|null,incoming:CanvasImageSource,width:number,height:number,elapsed:number,reduced=false) {
  const blend=outgoing?sceneBlendAt(elapsed,reduced):1;
  ctx.save();ctx.globalAlpha=1;ctx.clearRect(0,0,width,height);
  if(outgoing&&blend<1)ctx.drawImage(outgoing,0,0,width,height);
  const settle = outgoing && !reduced ? .012 * (1-blend) : 0;
  ctx.globalAlpha=blend;ctx.drawImage(incoming,-width*settle/2,-height*settle/2,width*(1+settle),height*(1+settle));ctx.restore();
  return blend;
}

/** Two-depth source refraction. The far surface moves tightly; nearer water
 * has slower, broader movement. Original reflection colors travel with it. */
export function waterDisplacementAt(y:number,top:number,bottom:number,elapsed:number,amplitude:number,speed=1) {
  const depth=(y-top)/Math.max(1,bottom-top),edge=Math.sin(Math.PI*depth)**2;
  const a=elapsed/8000*Math.PI*2*speed,b=elapsed/16000*Math.PI*2;
  return {
    x:(Math.sin(a+depth*12)*.68+Math.sin(b-depth*21)*.32)*amplitude*(.5+depth)*edge,
    y:Math.sin(elapsed/12000*Math.PI*2+depth*13)*Math.min(2.6,amplitude*.36)*edge,
  };
}

/** Reflected illumination is a separate alpha material, registered to the
 * source lights. It follows the same wave field with a small normal-response
 * lag; it is not an added light streak, particle or repeating foam stamp. */
export function reflectionResponseAt(y:number,top:number,bottom:number,elapsed:number) {
  const depth=Math.max(0,Math.min(1,(y-top)/Math.max(1,bottom-top)));
  const wave=Math.sin(elapsed/12000*Math.PI*2-depth*13);
  const ripple=Math.sin(elapsed/8000*Math.PI*2+depth*28);
  return {opacity:(.20+.12*wave+.035*ripple)*Math.sin(Math.PI*depth)**2,
    vertical:wave*(.35+depth*.9),spread:1+Math.sin(elapsed/16000*Math.PI*2-depth*11)*.004*depth};
}

/** Fitted to the current illustrated plates; never reuse older scene masks. */
export function featureAmbientDefinition(scene: FeatureEnvironmentId, portrait: boolean) {
  return illustratedEnvironment(scene, portrait);
}

/** One shared production/offline painter. Motion is source-registered, clipped
 * to existing water/light interiors, and periodic in wall time (never spin
 * speed). Fitted atmospheric layers stay behind the fixed foreground and actor. */
export function paintFeatureEnvironment(ctx: CanvasRenderingContext2D, image: CanvasImageSource,
  scene: FeatureEnvironmentId, portrait: boolean, width: number, height: number,
  elapsed: number, reduced = false, assets: AtmosphereImages = {}) {
  const definition = featureAmbientDefinition(scene, portrait);
  const crop = FEATURE_ENVIRONMENTS[scene][portrait ? 'portrait' : 'desktop'];
  const transform = featureArtworkTransform(crop, width, height);
  const clock = ((elapsed % FEATURE_AMBIENT_LOOP_MS) + FEATURE_AMBIENT_LOOP_MS) % FEATURE_AMBIENT_LOOP_MS;
  const path = (polygon: readonly (readonly [number, number])[]) => {
    ctx.beginPath(); polygon.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
  };
  ctx.save(); ctx.clearRect(0, 0, width, height);
  ctx.translate(transform.x, transform.y); ctx.scale(transform.scale, transform.scale);
  ctx.beginPath(); ctx.rect(crop.x, crop.y, crop.width, crop.height); ctx.clip();
  ctx.drawImage(image, 0, 0, definition.width, definition.height);
  const layers=separatedEnvironmentLayers(scene,portrait,assets);
  if(layers&&!reduced)ctx.drawImage(layers.backing,0,0,definition.width,definition.height);
  if (!reduced) {
    for (const region of definition.water) {
      ctx.save(); path(region.polygon); ctx.clip();
      const xs = region.polygon.map(p => p[0]), ys = region.polygon.map(p => p[1]);
      const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
      const strip = Math.max(1, 1 / transform.scale);
      for (let y = top; y < bottom; y += strip) {
        const h = Math.min(strip, bottom - y);
        const offset=waterDisplacementAt(y,top,bottom,clock,region.amplitude,region.speed);
        ctx.drawImage(image,left,y+offset.y,right-left,h,left+offset.x,y,right-left,h);
      }
      if(layers?.reflections)for(let y=top;y<bottom;y+=strip){
        const h=Math.min(strip,bottom-y),offset=waterDisplacementAt(y,top,bottom,clock,region.amplitude,region.speed),response=reflectionResponseAt(y,top,bottom,clock);
        const spread=(right-left)*response.spread;
        ctx.globalAlpha=response.opacity;
        ctx.drawImage(layers.reflections,left,y+offset.y*.55,right-left,h,
          left+offset.x*.82-(spread-(right-left))*.5,y+response.vertical,spread,h);
      }
      ctx.restore();
    }
    for(const beacon of definition.beacons) {
      const phase=(clock+beacon.phase)/beacon.period*Math.PI*2;
      const level=(.5+.5*Math.sin(phase))**3;
      ctx.globalAlpha=.50*level;ctx.fillStyle=beacon.color;ctx.beginPath();
      ctx.arc(beacon.x,beacon.y,beacon.radius,0,Math.PI*2);ctx.fill();
    }
    for (const light of definition.lights) {
      // Only original painted light interiors, never a bloom/glow outside them.
      const level = .5 + .5 * Math.sin(clock / light.period * Math.PI * 2 + light.phase / 12000 * Math.PI * 2);
      ctx.globalAlpha = Math.min(.20, light.opacity) * (.3 + .7 * level * level);
      ctx.fillStyle = light.color; path(light.polygon); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  paintFeatureAtmosphere(ctx, image, scene, portrait, definition.width, definition.height, clock, assets, reduced);
  ctx.restore();
}
