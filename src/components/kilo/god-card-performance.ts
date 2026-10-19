import { Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import type { Award, BinaryReels } from '@/lib/kilo/reel-feature-math';
import type { FeatureCueName } from '@/lib/kilo/sound';
import type { SpinSpeed } from './control-model';
import { GOD_CARD_CLOCK, godCardOffset, godCardOutcome, godCardPose, godCardResultScale,
  godCardTravel, type GodCardBeat } from './god-card-motion';
import { paintGodWater } from './god-water-performance';
import { paintImpact, clamp01 } from './impact-language';
import { articulateArt, restoreArticulation } from './articulation';

export const GOD_CARD_ASSETS = {
  scene: '/kilo-v79/god/card-scene.webp',
  hull: '/kilo-v79/god/boat-hull.webp',
  rider: '/kilo-v79/god/boat-rider.webp',
  wake: '/kilo-v79/god/wake.webp',
  maxTitle: '/kilo-v79/god/max-win-title.webp',
  lossTitle: '/kilo-v79/god/no-win-title.webp',
} as const;
export type GodCardTextures = Partial<Record<keyof typeof GOD_CARD_ASSETS, Texture>>;
export const GOD_RESULT_INK_FRAMES = {
  maxTitle: [11, 129, 2052, 486],
  lossTitle: [22, 104, 2140, 522],
} as const;
type Geometry = { gx: number; gy: number; cell: number; gap: number };
type GodCardAdapter = {
  parent: Container;
  host: HTMLElement;
  textures: () => GodCardTextures;
  geom: () => Geometry;
  pace: () => { speed: SpinSpeed; reduced: boolean };
  motion: (ms: number, paint: (progress: number) => void) => Promise<void>;
  hold: (ms: number) => Promise<void>;
  live: () => boolean;
  cue?: (name: FeatureCueName) => void;
  react: (kind: 'max' | 'max-stop' | 'max-loss') => void;
  readout: (label: string, value: string) => void;
  screen: (x: number, y: number) => { x: number; y: number };
  transfer: (award: Award, refresh: () => void, origin: () => { x: number; y: number }) => Promise<void>;
};
const GOLD = 0xf5ca79, WHITE = 0xfff8e9, TEAL = 0x9be2dc;
const money = (value: number) => Math.round(value).toLocaleString('en-US');
const boundedDuration = (ms: number, speed: SpinSpeed, floor: number) =>
  Math.max(ms, floor / { normal: 1, turbo: .55, super: .32 }[speed]);
const title = (value: string, size: number, fill: number) => {
  const node = new Text({ text: value, style: { fontFamily: 'Source Sans 3', fontSize: size,
    fontWeight: '800', fill, align: 'center', stroke: { color: 0x03141b, width: Math.max(2, size * .065), join: 'round' } } });
  node.anchor.set(.5);
  return node;
};

/** A real opaque illustration moves over a valid stopped board. No symbol is
 * cleared, manufactured, hidden with a global flag, or used to own an award. */
export function createGodCardView(parent: Container, textures: GodCardTextures) {
  const root = new Container(); root.label = 'god-full-window-card';
  const painting = new Container(); painting.label = 'god-card-illustration';
  const backing = new Graphics(); backing.label = 'god-card-opaque-backing';
  painting.addChild(backing);
  const scene = textures.scene ? new Sprite(textures.scene) : null;
  if (scene) { scene.label = 'god-card-dedicated-scene'; painting.addChild(scene); }
  const waterTextures: Texture[] = [];
  const waterStrips = textures.scene ? Array.from({length:20},(_,i)=>{
    const image=textures.scene!,y=Math.floor(image.height*(.40+i*.60/20));
    const bottom=Math.floor(image.height*(.40+(i+1)*.60/20));
    const texture=new Texture({source:image.source,frame:new Rectangle(0,y,image.width,bottom-y)});
    waterTextures.push(texture);
    const strip=new Sprite(texture);strip.label='god-card-reflected-water';painting.addChild(strip);return strip;
  }) : [];
  const contact = new Graphics(); contact.label = 'god-card-water-contact'; painting.addChild(contact);
  const wake = textures.wake ? new Sprite(textures.wake) : new Container();
  wake.label = 'god-card-responsive-wake'; painting.addChild(wake);
  if (wake instanceof Sprite) wake.anchor.set(.95, .70);
  const foam = new Graphics(); foam.label = 'god-card-thrust-foam'; painting.addChild(foam);
  const vessel = new Container(); vessel.label = 'god-card-vessel'; painting.addChild(vessel);
  const hull = new Container(); hull.label = 'god-card-pitching-hull'; vessel.addChild(hull);
  const hullArt = textures.hull ? new Sprite(textures.hull) : null;
  if (hullArt) hull.addChild(hullArt);
  const rider = new Container(); rider.label = 'god-card-seated-rider'; hull.addChild(rider);
  const riderArt = textures.rider ? new Sprite(textures.rider) : null;
  if (riderArt) rider.addChild(riderArt);
  // Rear seat is behind the driver; the near windshield and gunwale are in
  // front. This registered foreground occlusion keeps the seated body inside
  // the cockpit while its upper torso counter-leans independently.
  const gunwale = textures.hull ? new Sprite(textures.hull) : null;
  const gunwaleMask = new Graphics(); gunwaleMask.label = 'god-card-cockpit-occlusion';
  if (gunwale) {
    gunwale.label = 'god-card-front-gunwale'; hull.addChild(gunwale, gunwaleMask); gunwale.mask = gunwaleMask;
  }
  const bow = new Graphics(); bow.label = 'god-card-braking-water'; painting.addChild(bow);
  const rim = new Graphics(); rim.label = 'god-card-hard-frame'; painting.addChild(rim);
  root.addChild(painting);
  const entryPressure=new Graphics();entryPressure.label='god-visible-entry-pressure';root.addChild(entryPressure);
  const speedCuts=new Graphics();speedCuts.label='god-card-speed-cuts';painting.addChild(speedCuts);
  const result = new Container(); result.label = 'god-card-result';
  const headlineShadow = title('', 1, 0x705025), headline = title('', 1, GOLD);
  const amount = title('', 1, WHITE), caption = title('', 1, TEAL), contactFlash = new Graphics();
  // Frame the lettering's authored ink area, preserving the original raster
  // and aspect. Transparent margins/loose accents never shrink the headline.
  const titleTextures: Texture[] = [];
  const titleSprite = (kind: keyof typeof GOD_RESULT_INK_FRAMES) => {
    const original = textures[kind];
    if (!original) return null;
    const [x, y, w, h] = GOD_RESULT_INK_FRAMES[kind];
    const texture = new Texture({ source: original.source, frame: new Rectangle(x, y, w, h) });
    titleTextures.push(texture);
    return new Sprite(texture);
  };
  const maxTitle = titleSprite('maxTitle');
  const lossTitle = titleSprite('lossTitle');
  if (maxTitle) { maxTitle.anchor.set(.5); maxTitle.label = 'god-card-max-title-art'; }
  if (lossTitle) { lossTitle.anchor.set(.5); lossTitle.label = 'god-card-loss-title-art'; }
  headline.label = 'god-card-result-headline'; amount.label = 'god-card-result-amount';
  result.addChild(contactFlash, headlineShadow, headline, amount, caption);
  if (maxTitle) result.addChild(maxTitle);
  if (lossTitle) result.addChild(lossTitle);
  root.addChild(result); parent.addChild(root);
  let amountHidden = false, lastGeometry: Geometry = { gx: 0, gy: 0, cell: 1, gap: 0 };
  let flow=0,lastPaint:number|null=null;
  const metadata = { phase: 'rest' as GodCardBeat, segment: 0, offset: 0, pitch: 0, lean: 0, wake: 0, surge: 0,
    boardWidth: 0, boardHeight: 0, opaqueCard: true, won: false, settled: false,performanceStage:1,entryPressure:0 };
  Object.assign(root, { godCard: metadata });

  return {
    root,
    draw(g: Geometry, segment: number, beat: GodCardBeat, progress: number,
      outcome?: { won: boolean; amount: number; beforeCap: number; impact: number; fade?: number },
      performanceStage?:number,reduced=false) {
      lastGeometry = g;
      const width = g.cell * 5 + g.gap * 4, height = g.cell * 3;
      const stage=performanceStage??(beat==='anticipate'?Math.floor(segment)+1:Math.max(1,Math.ceil(segment)));
      const pose = godCardPose(beat, progress,stage), x = godCardOffset(width, segment);
      const now=performance.now(),dt=lastPaint===null?0:Math.max(0,Math.min(80,now-lastPaint))/1000;
      lastPaint=now;
      if(!reduced)flow+=dt*(.45+1.8*pose.spray);
      root.position.set(g.gx, g.gy);
      painting.position.set(x, 0);
      entryPressure.clear();speedCuts.clear();
      metadata.entryPressure=0;
      // At segment zero the illustration is entirely offscreen. The pressure
      // spill is aperture-local, so the FIRST stationary build is now visible.
      // No early translation, fabricated symbol, or extra progression state.
      if(!reduced&&((beat==='anticipate'&&segment<.01&&progress>.25)||(beat==='advance'&&stage===1&&progress<.24))){
        const pressure=beat==='anticipate'?clamp01((progress-.25)/.75):1-clamp01(progress/.24),reach=width*(.035+.21*pressure),water=height*.84;
        metadata.entryPressure=pressure;
        const lift=height*(.024+.13*pressure);
        // Connected water mass, curled white crest and a flat trailing base.
        // The old two triangles collapsed into a hairline at phone resolution.
        entryPressure.moveTo(0,water+lift*.28)
          .quadraticCurveTo(reach*.13,water-lift*.87,reach*.45,water-lift)
          .quadraticCurveTo(reach*.69,water-lift*1.08,reach*.77,water-lift*.42)
          .quadraticCurveTo(reach*.57,water-lift*.70,reach*.57,water-lift*.26)
          .quadraticCurveTo(reach*.70,water+lift*.08,reach,water+lift*.12)
          .lineTo(0,water+lift*.42).fill({color:0x298fa4,alpha:.92*pressure});
        entryPressure.moveTo(0,water-lift*.03)
          .quadraticCurveTo(reach*.16,water-lift*.96,reach*.45,water-lift)
          .quadraticCurveTo(reach*.68,water-lift*1.01,reach*.73,water-lift*.49)
          .stroke({color:0xe4fff0,width:Math.max(2.4,height*.018),alpha:pressure,cap:'round'});
        entryPressure.moveTo(0,water+lift*.32).lineTo(reach*.81,water+lift*.25)
          .stroke({color:0x79f0da,width:Math.max(2,height*.012),alpha:pressure*.82});
        entryPressure.moveTo(1,height*.46).lineTo(1,height*.91)
          .stroke({color:0xffcf60,width:2+pressure*3,alpha:pressure});
      }
      backing.clear().rect(0, 0, width, height).fill(0x051b26);
      if (scene) { scene.width = width; scene.height = height; }
      waterStrips.forEach((strip,i)=>{
        const depth=i/19,envelope=Math.sin(Math.PI*depth)**2;
        // Existing painted reflections react to propulsion under the hull.
        // The skyline stays rigid, and the water returns exactly to source.
        strip.position.set(reduced?0:Math.sin(flow*3.4-depth*9)*width*.004*envelope*pose.wake,
          height*(.40+i*.60/20));
        strip.width=width;strip.height=height*.60/20+.3;
        strip.visible=!reduced&&pose.wake>.001;
      });
      rim.clear().rect(1.5, 1.5, width - 3, height - 3).stroke({ color: 0xe3ba74, width: 3 });
      // Matching canvases share the exact registration. Rider rotates around
      // the cockpit waist and is drawn behind the near gunwale in authored art.
      const nativeW = textures.hull?.width || 1600, nativeH = textures.hull?.height || 960;
      const scale = width * .76 / nativeW;
      vessel.scale.set(scale); vessel.position.set(width * .52 + pose.surge * scale, height * .67);
      hull.pivot.set(nativeW * .52, nativeH * .74);
      hull.position.set(0, pose.heave); hull.rotation = pose.pitch;
      if (hullArt) { hullArt.width = nativeW; hullArt.height = nativeH; }
      rider.pivot.set(nativeW * .442, nativeH * .403);
      rider.position.set(nativeW * .442, nativeH * .403); rider.rotation = pose.lean;
      if (riderArt) {
        riderArt.width = nativeW * .58; riderArt.height = nativeH * .58;
        riderArt.position.set(nativeW * .1672, nativeH * .0252);
        const p=beat==='anticipate'?.19*clamp01((progress-.22)/.78):
          beat==='advance'?.19+.46*progress:beat==='settle'?.65+.35*progress:
          beat==='stall'?.19+.81*progress:beat==='overshoot'?.19+.46*Math.sin(Math.PI*progress):1;
        if(reduced)restoreArticulation(riderArt);
        else articulateArt(riderArt,'splash',p,'wild',1.4,[372,77,1233,689]);
      }
      if (gunwale) {
        gunwale.width = nativeW; gunwale.height = nativeH;
        gunwaleMask.clear().poly([nativeW * .20, nativeH * .41, nativeW * .66, nativeH * .355,
          nativeW * .75, nativeH * .44, nativeW * .99, nativeH * .77,
          nativeW * .99, nativeH, 0, nativeH, 0, nativeH * .42]).fill(0xffffff);
      }

      const waterY = height * .80;
      contact.clear().ellipse(width * .52, waterY, width * .31, height * .017).fill({ color: 0x00111c, alpha: .22 });
      // Project the authored stern contact through the hull's actual rotation.
      // The wake stays on the water plane and is never a detached ribbon below
      // the boat; its dense right-hand propwash meets the outboard's waterline.
      const sx = nativeW * (.133 - .52), sy = nativeH * (.535 - .74);
      const cosine = Math.cos(pose.pitch), sine = Math.sin(pose.pitch);
      const sternX = width * .52 + (sx * cosine - sy * sine + pose.surge) * scale;
      const sternY = height * .67 + (sx * sine + sy * cosine + pose.heave) * scale;
      wake.position.set(sternX, sternY);
      wake.width = width * .43 * pose.wakeLength;
      wake.height = height * .12 * (.75 + pose.spray * .55);
      wake.alpha = pose.wake;
      wake.visible = pose.wake > .001;
      // Bow-water contact is the lower tip of the authored hull, not the
      // upper deck. Registering to the deck makes the contour float above it.
      const bx = nativeW * (.918 - .52), by = nativeH * (.885 - .74);
      const prow = { x: width * .52 + (bx * cosine - by * sine + pose.surge) * scale,
        y: height * .67 + (bx * sine + by * cosine + pose.heave) * scale };
      // Integrate a continuous water clock. segment*3+progress previously
      // raced four ribbon cycles through a 430ms advance, producing chatter.
      paintGodWater(foam, bow, pose, { x: sternX, y: sternY }, prow, width, height, flow);
      if(!reduced&&(beat==='advance'||beat==='overshoot')){
        const energy=Math.sin(Math.PI*progress),drift=progress*width*.25;
        // Fixed hand-shaped speed cuts, confined to the sky/water margins.
        // None crosses the driver's face or competes with the final amount.
        for(let i=0;i<5;i++){
          const yy=height*(i<3?.10+i*.06:.86+(i-3)*.055),xx=width*(.25+i*.15)-drift;
          speedCuts.poly([xx,yy,xx+width*(.14+.05*energy),yy-height*.007,
            xx+width*.08,yy+height*.006]).fill({color:i%2?0x79f0da:0xffe2a0,alpha:energy*.47});
        }
      }
      result.visible = !!outcome;
      root.alpha = outcome?.fade === undefined ? 1 : 1 - outcome.fade;
      if (outcome) {
        // Result remains aligned to the aperture, including partial-card loss.
        const size = Math.min(height * .25, width * (outcome.won ? .105 : .125));
        headline.text = headlineShadow.text = outcome.won ? 'MAX WIN' : 'NO WIN';
        headline.style.fontSize = headlineShadow.style.fontSize = size;
        headline.style.fill = outcome.won ? GOLD : WHITE;
        headlineShadow.position.set(width / 2, height * .745 + Math.max(2, height * .012));
        headline.position.set(width / 2, height * .745);
        headline.scale.set(godCardResultScale(outcome.impact)); headlineShadow.scale.set(godCardResultScale(outcome.impact));
        const titleArt = outcome.won ? maxTitle : lossTitle;
        headline.visible = headlineShadow.visible = !titleArt;
        if (maxTitle) maxTitle.visible = outcome.won;
        if (lossTitle) lossTitle.visible = !outcome.won;
        if (titleArt) {
          const fit = Math.min(width * .54 / titleArt.texture.width, height * .215 / titleArt.texture.height);
          titleArt.position.set(width / 2, height * .745);
          titleArt.scale.set(fit * godCardResultScale(outcome.impact));
        }
        amount.text = outcome.won ? money(outcome.amount) : '';
        amount.style.fontSize = Math.min(height * .125, width * .067);
        amount.position.set(width / 2, height * .925); amount.visible = !amountHidden && outcome.won;
        amount.scale.set(1 + .06 * Math.sin(Math.PI * outcome.impact));
        caption.text = outcome.won && outcome.beforeCap > outcome.amount ? 'ROUND LIMIT REACHED' : '';
        caption.style.fontSize = Math.max(10, height * .045); caption.position.set(width / 2, height * .08);
        contactFlash.clear();
        paintImpact(contactFlash,width*.5,height*.745,width*.72,height*.55,
          outcome.impact,outcome.won?0xffcb55:0x79b9c4,outcome.won?1.5:.75,reduced,false);
        if (outcome.impact < .38) contactFlash.rect(2, 2, width - 4, height - 4)
          .stroke({ color: outcome.won ? GOLD : 0xe6b7a3, width: 2 + 6 * (1 - outcome.impact / .38), alpha: 1 - outcome.impact / .38 });
        if (outcome.impact > 0 && outcome.impact < 1) {
          const hit = Math.sin(Math.PI * outcome.impact), reach = width * (.05 + .12 * outcome.impact);
          for (const side of [-1, 1]) {
            const anchor = width / 2 + side * width * .30, y = height * .745;
            contactFlash.poly([anchor, y, anchor + side * reach, y - height * .012,
              anchor + side * reach * .68, y + height * .008])
              .fill({ color: outcome.won ? GOLD : WHITE, alpha: hit * .8 });
          }
        }
      }
      Object.assign(metadata, { phase: beat, segment, offset: x, pitch: pose.pitch, lean: pose.lean,
        wake: pose.wake, surge: pose.surge, boardWidth: width, boardHeight: height, won: outcome?.won ?? false,performanceStage:stage,
        settled: beat === 'result' || beat === 'rest' });
    },
    hideAmount() { amountHidden = true; amount.visible = false; },
    amountOrigin() { return { x: lastGeometry.gx + (lastGeometry.cell * 5 + lastGeometry.gap * 4) / 2,
      y: lastGeometry.gy + lastGeometry.cell * 3 * .925 }; },
    destroy() {
      if(riderArt)restoreArticulation(riderArt);
      if (!root.destroyed) root.destroy({ children: true });
      titleTextures.forEach(texture => texture.destroy(false));
      waterTextures.forEach(texture => texture.destroy(false));
    },
  };
}

/** No math, RNG, control, wallet or geometry mutation exists in this sequence. */
export async function runGodCardPresentation(record: BinaryReels, a: GodCardAdapter) {
  const outcome = godCardOutcome(record), view = createGodCardView(a.parent, a.textures());
  let segment = 0, beat: GodCardBeat = 'rest', progress = 1, impact: number | null = null,performanceStage=1;
  let fade = 0;
  const draw = () => {
    if (!a.live()) return;
    view.draw(a.geom(), segment, beat, progress, impact === null ? undefined : {
      won: record.won, amount: record.result.credited, beforeCap: record.result.beforeCap, impact, fade },performanceStage,a.pace().reduced);
    a.host.dataset.maxSegment = String(segment);
    a.host.dataset.maxPhase = beat;
  };
  const motion = async (ms: number, phase: GodCardBeat, paint?: (t: number) => void, floor = 0) => {
    beat = phase;
    await a.motion(boundedDuration(ms, a.pace().speed, floor), t => { progress = t; paint?.(t); draw(); });
  };
  try {
    a.react('max');
    draw();
    if (!a.pace().reduced) {
      for (let stage = 1; stage <= outcome.segments; stage++) {
        if (!a.live()) return;
        performanceStage=stage;
        // Every wind-up begins in a true stationary hold before pressure rises.
        await motion(GOD_CARD_CLOCK.anticipation[stage - 1]!, 'anticipate', undefined, 170);
        if (!a.live()) return;
        a.cue?.('boatThrust');
        const from = stage - 1;
        await motion(GOD_CARD_CLOCK.advance[stage - 1]!, 'advance', t => { segment = from + godCardTravel(t); }, 180);
        if (!a.live()) return;
        a.cue?.(stage === 5 ? 'boatBrake' : 'boatCoast');
        await motion(GOD_CARD_CLOCK.settle[stage - 1]!, 'settle', undefined, 110);
        if (!a.live()) return;
        segment = stage; beat = 'rest'; progress = 1; draw();
        await a.hold(Math.max(40, GOD_CARD_CLOCK.rest[stage - 1]! * { normal: 1, turbo: .55, super: .32 }[a.pace().speed]));
      }
      if (!a.live()) return;
      if (!record.won) {
        performanceStage=outcome.segments+1;
        await motion(outcome.overshoot ? 760 : 420, 'anticipate', undefined, 180);
        if (!a.live()) return;
        if (outcome.overshoot) {
          a.cue?.('boatPass');
          // Same loss record, a missed exact alignment: no stop/award at five.
          const from = segment;
          await motion(GOD_CARD_CLOCK.overshoot, 'overshoot', t => { segment = from + 2 * t * t; }, 280);
          if (!a.live()) return;
        }
        a.cue?.('boatBrake');
        await motion(GOD_CARD_CLOCK.stall, 'stall', undefined, 180);
      }
    } else {
      segment = record.won ? 5 : outcome.overshoot ? 6 : outcome.segments;
    }
    if (!a.live()) return;
    a.react(record.won ? 'max-stop' : 'max-loss');
    a.cue?.(record.won ? 'getawayWin' : 'getawayLoss');
    beat = 'result'; progress = 1; impact = 0;
    await a.motion(GOD_CARD_CLOCK.impact, t => { impact = t; draw(); });
    if (!a.live()) return;
    impact = 1; draw();
    await a.hold(a.pace().reduced ? 240 : Math.max(240, GOD_CARD_CLOCK.resultHold * { normal: 1, turbo: .55, super: .32 }[a.pace().speed]));
    if (!a.live()) return;
    if (record.won) await a.transfer(record.result, () => { view.hideAmount(); draw(); }, () => {
      const p = view.amountOrigin(); return a.screen(p.x, p.y);
    });
    if (!a.live()) return;
    await a.motion(GOD_CARD_CLOCK.release, t => { fade = t; draw(); });
  } finally {
    view.destroy();
    if (a.host.dataset) { delete a.host.dataset.maxSegment; delete a.host.dataset.maxPhase; }
  }
}
