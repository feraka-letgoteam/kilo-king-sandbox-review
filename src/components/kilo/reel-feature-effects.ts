import { Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import type { Cargo, FeatureEvent } from '@/lib/kilo/feature-math';
import type { Award, Cascade, Grid, ReelWild, Spot, TumbleReels, VsConversion } from '@/lib/kilo/reel-feature-math';
import type { FeatureCueName } from '@/lib/kilo/sound';
import type { SplashCell, SplashLine, SplashScript } from '@/lib/kilo/engine';
import type { SpinSpeed } from './control-model';
import { FEATURE_NAMES } from '@/lib/kilo/feature-math';
import assetPack from '../../../public/kilo-features-v52/manifest.json';
import legacyVehiclePack from '../../../public/kilo-v55/vehicles/manifest.json';
const vehiclePack = { ...legacyVehiclePack, chopper: { ...legacyVehiclePack.chopper, url: '/kilo-v79/vehicles/chopper-action.webp' } };
import { createCharacterRig } from './character-rig';
import { createCharacterMotionLoop } from './character-motion-loop';
import { timedPerformanceFrameAt } from './rig-performance';
import { FEATURE_ART } from './feature-presentation';
import { vsMotionAt, VS_REVEAL_MS } from './feature-motion';
import { VS_PORTRAITS, VS_STRIPS, vsActionIndex, vsWinnerIndex } from './vs-art';
import { VS_BEATS, VS_WIN_TIMING, vsWinningBoard, vsPhysicalAt } from './vs-encounter';
import { vsGroupsFor, type VsGroup } from '@/lib/kilo/vs-groups';
import { createVsGroupArt, createVsMultiplierLabel, VS_GROUP_ART_URLS, vsGroupArtUrl, vsConnectionMultiplierScale, performVsGroupArt } from './vs-group-art';
import { featureArrivalAt, wildArtAt, connectionPerformanceAt } from './event-performance';
import { VS_MERGE_MS, vsMergeAt, vsMultiplierPunch } from './vs-merge-motion';
import { createWinNumeral, connectedNumberScale, WIN_TYPE } from './win-type';
import { paintWinConnection } from './win-connection-paint';
import { createConnectionAmounts, connectionTraceIndices } from './connection-amounts';
import { GOD_CARD_ASSETS, runGodCardPresentation, type GodCardTextures } from './god-card-performance';
import { VS_ACTOR_ATLASES, VS_ACTOR_FRAME_COUNT, VS_ACTOR_FRAME_SIZE, VS_ACTOR_COLUMNS, vsActorFrameIndex } from './vs-actor-performance';
import { AUTHORED_CLIPS } from './authored-clips';
import { authoredFrameAt } from './authored-animation';
import { paintImpact, paintEventTicket, clamp01, impactStamp } from './impact-language';

type Geometry = { gx: number; gy: number; cell: number; gap: number };
type Callbacks = { award: (value: number) => void; state: (e: FeatureEvent) => void; reelsSettled?: Promise<void> };
type Adapter = {
  host: HTMLElement; world: Container; under?: Container; geom: () => Geometry;
  cell: (c: SplashCell, size: number) => Container;
  show: (grid: Grid) => void;
  collect: (spin: { grid: Grid; got: number; mult: number; wilds: number }) => Promise<void>;
  highlight: (lines: SplashLine[], onLine: (line: SplashLine) => void) => Promise<void>;
  stake: () => number; pace: () => { speed: SpinSpeed; reduced: boolean };
  tween: (ms: number, frame: (t: number) => void) => Promise<void>;
  hold: (ms: number) => Promise<void>; live: () => boolean;
  readout: (label: string, value: string) => void;
  screen: (x: number, y: number) => { x: number; y: number };
  landing: (height: number) => { x: number; y: number } | null;
  bankCue: (value: number, capped: boolean) => void;
  cue?: (name: FeatureCueName) => void;
  focus?: (spots: Spot[] | null) => void;
  respond?: (spots: Spot[], progress: number | null) => void;
  conceal?: (reels: number[]) => void;
};
const GOLD = 0xd8b66f, TEAL = 0x89e6d9, WHITE = 0xfff8e9, INK = 0x07131a;
const money = (n: number) => Math.round(n).toLocaleString('en-US');
const ease = (t: number) => 1 - (1 - t) ** 3;
const clone = <T>(v: T): T => structuredClone(v);

/** Bounded, recorded on-reel actions. No timers or RNG own a payout. */
export function createReelFeatureEffects(a: Adapter) {
  const root = new Container(), held = new Container(), fx = new Container(), mask = new Graphics();
  root.addChild(held, fx, mask); root.mask = mask;
  const underIndex = a.under ? a.world.children.indexOf(a.under) : -1;
  if (underIndex >= 0) a.world.addChildAt(root, underIndex); else a.world.addChild(root);
  let generation = 0, disposed = false, current: FeatureEvent | null = null;
  let wilds: ReelWild[] = [], cargo: Cargo[] = [], marks: number[][] = [], global = 1;
  let repaint = () => {}, frames: Texture[] = [], chopper: Texture | null = null;
  let chopperFrames:Texture[]=[];
  let vsPortraits:Texture[]=[],vsStrips:Texture[]=[];
  const vsActors = new Map<string, Texture[]>();
  const vsGroupTextures = new Map<string, Texture>();
  let mergingReels = new Set<number>(), incomingVsReels = new Set<number>();
  const godCardTextures: GodCardTextures = {};
  const entryArt = new Map<string, Texture>();
  const entryFrames = new Map<string, Texture[]>();
  const flyers = new Set<HTMLElement>();
  let lifeElapsed=0;
  const restingActors:Array<{rig:ReturnType<typeof createCharacterRig>;reel:number}>=[];
  const lifeReduced=()=>{
    const page=a.host.closest?.('[data-reduced]');
    return page?page.getAttribute('data-reduced')==='1':a.pace().reduced;
  };
  const refreshMotion=()=>{
    for(const {rig,reel} of restingActors)rig.idle(lifeElapsed,reel,lifeReduced());
    lifeLoop.refresh();
  };
  const lifeLoop=createCharacterMotionLoop(a.host,delta=>{
    if(!lifeReduced())lifeElapsed+=Math.min(80,delta);
    for(const {rig,reel} of restingActors)rig.idle(lifeElapsed,reel,lifeReduced());
  },()=>!disposed&&restingActors.length>0&&!lifeReduced(),a.host.closest?.('.kk-shell'));
  const installFisherman = (sheet: Texture) => {
    if (disposed) return;
    frames = Array.from({ length: 6 }, (_, i) => new Texture({ source: sheet.source,
      frame: new Rectangle(i % 3 * 384, Math.floor(i / 3) * 576, 384, 576) }));
  };
  const fishermanUrl = '/kilo-features-v54/fisherman-reel-in.webp';
  const readyFisherman = Assets.get<Texture>(fishermanUrl);
  if (readyFisherman) installFisherman(readyFisherman);
  else void Assets.load<Texture>(fishermanUrl).then(installFisherman).catch(() => {});
  chopper = Assets.get<Texture>('/kilo-v79/vehicles/chopper-body.webp') ?? null;
  if (!chopper) void Assets.load<Texture>('/kilo-v79/vehicles/chopper-body.webp').then(t => { if (!disposed) chopper = t; }).catch(() => {});
  const install = (url: string, apply: (texture: Texture) => void) => {
    const texture = Assets.get<Texture>(url);
    if (texture) apply(texture);
    else void Assets.load<Texture>(url).then(t => { if (!disposed) apply(t); }).catch(() => {});
  };
  for (const [part, url] of Object.entries(GOD_CARD_ASSETS)) install(url, texture => { godCardTextures[part as keyof GodCardTextures] = texture; });
  const installAction=(definition:typeof vehiclePack.chopper|typeof vehiclePack.boat,apply:(frames:Texture[])=>void)=>
    install(definition.url,sheet=>apply(definition.frames.map(f=>new Texture({source:sheet.source,
      frame:new Rectangle(f.rect[0]!,f.rect[1]!,f.rect[2]!,f.rect[3]!)}))));
  installAction(vehiclePack.chopper,f=>{chopperFrames=f;});
  install(VS_PORTRAITS, sheet => { vsPortraits=Array.from({length:8},(_,i)=>new Texture({source:sheet.source,frame:new Rectangle(i%4*512,Math.floor(i/4)*512,512,512)})); });
  install(VS_STRIPS, sheet => { vsStrips=Array.from({length:2},(_,i)=>new Texture({source:sheet.source,frame:new Rectangle(i*384,0,384,1152)})); });
  for (const [side, outcomes] of Object.entries(VS_ACTOR_ATLASES)) for (const [outcome, url] of Object.entries(outcomes)) {
    install(url, sheet => vsActors.set(`${side}:${outcome}`, Array.from({length:VS_ACTOR_FRAME_COUNT}, (_,index) =>
      new Texture({source:sheet.source, frame:new Rectangle(index%VS_ACTOR_COLUMNS*VS_ACTOR_FRAME_SIZE,
        Math.floor(index/VS_ACTOR_COLUMNS)*VS_ACTOR_FRAME_SIZE,VS_ACTOR_FRAME_SIZE,VS_ACTOR_FRAME_SIZE)}))));
  }
  VS_GROUP_ART_URLS.forEach(url => install(url, texture => {
    vsGroupTextures.set(url, texture);
    if (!disposed && current?.reel?.type === 'vs') { paintHeld(); repaint(); }
  }));
  for (const [key, url] of Object.entries(FEATURE_ART)) install(url, t => entryArt.set(key, t));
  for (const [feature,key] of [['dock','entry-scatter-3'],['yacht','entry-scatter-4']] as const) {
    const clip=AUTHORED_CLIPS[key];
    if(clip)install(clip.url,sheet=>entryFrames.set(feature,clip.frames.map(frame=>new Texture({source:sheet.source,
      frame:new Rectangle(frame.x,frame.y,frame.w,frame.h)}))));
  }
  const clear = (c: Container) => c.removeChildren().forEach(x => x.destroy({ children: true }));
  const at = (p: Spot) => { const g = a.geom(); return { x: g.gx + p.reel * (g.cell + g.gap), y: g.gy + p.row * g.cell }; };
  const pace = (ms: number) => a.pace().reduced ? 0 : ms * { normal: 1, turbo: .55, super: .32 }[a.pace().speed];
  const readable = (ms: number) => a.hold(a.pace().reduced ? Math.min(ms, 280) : Math.max(180, pace(ms)));
  function label(value: string, size: number, color = WHITE) {
    const text = new Text({ text: value, style: { fontFamily: 'Source Sans 3', fontSize: size,
      fontWeight: '800', fill: color, align: 'center', stroke: { color: INK, width: 3 } } });
    text.anchor.set(.5); return text;
  }
  function drawMask() {
    const g = a.geom(); mask.clear().rect(g.gx, g.gy, g.cell * 5 + g.gap * 4, g.cell * 3).fill(0xffffff);
  }
  function actor(parent: Container, reel: number, pose = 5, amount = 1, duelist?: 'king' | 'vice') {
    const g = a.geom(), p = at({ reel, row: 0 });
    if(duelist){
      const rig=createCharacterRig(duelist);rig.root.pivot.set(192,552);
      rig.root.scale.set(Math.min(g.cell*.98/260,g.cell*2.4/552)*amount);
      rig.root.position.set(p.x+g.cell*.5,p.y+g.cell*2.68);parent.addChild(rig.root);
      rig.pose('rest');return rig;
    }
    if (frames.length) {
      const sprite = new Sprite(frames[pose]); sprite.anchor.set(.5, 552 / 576);
      const scale = Math.min(g.cell * .94 / 384, g.cell * 2.35 / 576) * amount;
      sprite.scale.set(scale); sprite.position.set(p.x + g.cell * .5, p.y + g.cell * 2.56);
      parent.addChild(sprite);
    } else {
      const art = a.cell({ s: 'splash' }, g.cell * .88); art.position.set(p.x + g.cell * .06, p.y + g.cell * 1.06); parent.addChild(art);
    }
  }
  function paintWild(parent: Container, wild: ReelWild, amount = 1, pose = 5) {
    const g = a.geom(), p = at({ reel: wild.reel, row: 0 }), h = g.cell * 3;
    if (wild.duelist) {
      const group: VsGroup = {id:`${wild.duelist}:${wild.reel}`, side:wild.duelist,
        start:wild.reel,end:wild.reel,width:1,reels:[wild.reel],multiplier:wild.multiplier,members:[wild]};
      parent.addChild(groupArt(group));
      return;
    }
    const inset = 3, y = p.y + h * (1 - amount) / 2;
    const edge = wild.duelist === 'vice' ? TEAL : GOLD;
    parent.addChild(new Graphics().rect(p.x + inset, y + 2, g.cell - inset * 2, (h - 4) * amount)
      .fill(wild.duelist === 'vice' ? 0x0b2830 : 0x241b15).stroke({ color: edge, width: 2 }));
    // Hard inset rails hold the character inside the reel instead of floating
    // a portrait above it. All decoration stays inside the existing rectangle.
    for (const x of [p.x + 7, p.x + g.cell - 7]) parent.addChild(new Graphics()
      .moveTo(x,y+8).lineTo(x,y+(h-12)*amount).stroke({color:edge,width:1,alpha:.38}));
    if (amount < .92) return;
    // Recessed multiplier cap and foot plate are part of the expanded reel.
    parent.addChild(new Graphics().poly([p.x+5,p.y+4,p.x+g.cell-5,p.y+4,p.x+g.cell-5,p.y+g.cell*.38,p.x+g.cell/2,p.y+g.cell*.47,p.x+5,p.y+g.cell*.38])
      .fill(0x031017).stroke({color:edge,width:1}));
    parent.addChild(new Graphics().rect(p.x+5,p.y+h-g.cell*.34,g.cell-10,g.cell*.28).fill(0x031017));
    const rig=actor(parent, wild.reel, pose, 1, wild.duelist);
    const mult = label(`×${wild.multiplier}`, Math.max(19, g.cell * .28), TEAL);
    mult.position.set(p.x + g.cell / 2, p.y + g.cell * .24); parent.addChild(mult);
    const name = label('WILD', Math.max(12, g.cell * .16), GOLD);
    name.position.set(p.x + g.cell / 2, p.y + h - g.cell * .18); parent.addChild(name);
    return rig;
  }
  const activeGroups = () => current?.reel?.type === 'vs'
    ? vsGroupsFor({...current.reel, before:wilds, after:wilds}) : [];
  function groupArt(group: VsGroup) {
    return createVsGroupArt(group, a.geom(), vsGroupTextures.get(vsGroupArtUrl(group)),
      group.width === 1 ? vsStrips[vsWinnerIndex(group.side)] : undefined);
  }
  const concealVs = () => a.conceal?.([...new Set([...wilds.map(w => w.reel), ...incomingVsReels])]);
  function paintHeld() {
    if (disposed) return; restingActors.length=0;clear(held); drawMask();
    const g = a.geom();
    const isPureVs = current?.reel?.type === 'vs' && current.reel.rules === 'pure-vs';
    if (isPureVs) {
      concealVs();
      for (const group of activeGroups()) if (!group.reels.some(reel => mergingReels.has(reel))) held.addChild(groupArt(group));
    }
    for (const wild of isPureVs ? [] : wilds) {
      const rig=paintWild(held,wild);
      if(rig){rig.idle(lifeElapsed,wild.reel,lifeReduced());restingActors.push({rig,reel:wild.reel});}
    }
    for (const p of cargo) {
      const pos = at(p); held.addChild(new Graphics().rect(pos.x + 1, pos.y + 1, g.cell - 2, g.cell - 2).fill(INK));
      const art = a.cell({ s: 'brick', v: p.value / a.stake(), id: p.id, w: 1, h: 1 }, g.cell);
      art.position.set(pos.x, pos.y); held.addChild(art);
      held.addChild(new Graphics().roundRect(pos.x + 3, pos.y + 3, g.cell - 6, g.cell - 6, 4).stroke({ color: TEAL, width: 1.5 }));
      // Compact lock clasp. It never floats, pulses, or obscures the printed value.
      held.addChild(new Graphics().roundRect(pos.x + 7, pos.y + 8, 9, 7, 1).fill(GOLD)
        .roundRect(pos.x + 9, pos.y + 4, 5, 7, 2).stroke({ color: GOLD, width: 1.5 }));
    }
    if (current?.reel?.type === 'tumble') for (let reel = 0; reel < 5; reel++) for (let row = 0; row < 3; row++) {
      const m = marks[reel]?.[row] ?? 1;
      const isCash = cargo.some(c => c.reel === reel && c.row === row);
      if (m === 1 && !isCash) continue;
      const p = at({ reel, row }), value = isCash ? Math.max(global, m) : m;
      const tag = label(`×${value}`, Math.max(11, g.cell * .12), TEAL);
      tag.anchor.set(1, 0); tag.position.set(p.x + g.cell - 5, p.y + 4); held.addChild(tag);
    }
    lifeLoop.refresh();
  }
  function set(e: FeatureEvent | null, phase: 'before' | 'after' = 'after') {
    current = e; wilds = []; marks = []; cargo = []; global = 1; mergingReels.clear(); incomingVsReels.clear();
    const r = e?.reel;
    if (e && r) {
      cargo = clone(phase === 'before' ? e.heldBefore : e.heldAfter);
      if (r.type === 'vs') wilds = clone(phase === 'before' ? r.before : r.after);
      if (r.type === 'tumble') {
        marks = clone(phase === 'before' ? r.marksBefore : r.marksAfter);
        global = phase === 'before' ? r.globalBefore : r.globalAfter;
      }
    }
    if (r?.type !== 'vs' || r.rules !== 'pure-vs') a.conceal?.([]);
    paintHeld();
  }
  function cancel() {
    generation++; repaint = () => {}; clear(fx);
    for (const art of held.children) performVsGroupArt(art, a.geom());
    mergingReels.clear(); incomingVsReels.clear();
    if(current?.reel?.type==='vs'&&current.reel.rules==='pure-vs') concealVs(); else a.conceal?.([]);
    a.focus?.(null);
    for (const flyer of flyers) flyer.remove(); flyers.clear();
  }
  const relayout = () => { paintHeld(); repaint(); };
  a.host.addEventListener('kilo-relayout', relayout);

  async function intro(round: SplashScript) {
    cancel(); const mine = generation; let reveal = 0, leaving = 0, artProgress = 0;
    const feature = round.feature!, accent = feature === 'route' ? TEAL : GOLD;
    const panel = new Container(); fx.addChild(panel);
    const draw = () => {
      if (mine !== generation || disposed) return; clear(panel);
      const g = a.geom(), width = g.cell * 5 + g.gap * 4, h = Math.min(88, g.cell * 1.12);
      const x = g.gx + 6, y = g.gy + g.cell * 1.32 - h / 2, w = width - 12;
      // Cut metal corners, not a full-screen panel. Each feature owns its
      // emblem; the surrounding reel symbols stay visible throughout entry.
      const contact=new Graphics();panel.addChild(contact);
      paintImpact(contact,x+w*.5,y+h*.5,w*.85,h*1.7,clamp01(reveal*.95),accent,1.1,a.pace().reduced);
      const ticket=new Graphics();paintEventTicket(ticket,x,y,w,h,accent);panel.addChild(ticket);
      // A hard diagonal colour cut belongs to the mode's illustration, rather
      // than another generic outlined information modal.
      panel.addChild(new Graphics().poly([x+13,y+5,x+h*.85,y+5,x+h*.63,y+h-8,x+13,y+h-8])
        .fill({color:accent,alpha:.12}));
      const artX=x+h*.56, artY=y+h*.51;
      const clip=AUTHORED_CLIPS[feature==='yacht'||feature==='yacht25'?'entry-scatter-4':'entry-scatter-3'];
      const animated=entryFrames.get(feature==='yacht25'?'yacht':feature);
      const texture=animated&&clip&&!a.pace().reduced?animated[authoredFrameAt(clip,artProgress)]:entryArt.get(feature);
      const arrival=featureArrivalAt(reveal,a.pace().reduced);
      if(texture){const sprite=new Sprite(texture);sprite.anchor.set(.5);const s=Math.min(h*1.05/texture.width,h*.90/texture.height);sprite.scale.set(s);sprite.rotation=arrival.turn;sprite.position.set(artX,artY);panel.addChild(sprite);}
      const copyX=x+h+(w-h)/2-3;
      const title=createWinNumeral(FEATURE_NAMES[feature].toUpperCase(),Math.max(19,g.cell*.26));
      if(title.width>w-h-16)title.style.fontSize=Number(title.style.fontSize)*(w-h-16)/title.width;
      title.position.set(copyX,y+h*.36);panel.addChild(title);
      const copy=label(feature==='getaway'?'1 SPIN · MAX WIN OR NOTHING':feature==='yacht25'?`${round.awarded} SPINS · REEL 1 STARTS ×25`:`${round.awarded} FREE SPINS`,Math.max(12,g.cell*.13),accent);
      if(copy.width>w-h-12)copy.style.fontSize=Number(copy.style.fontSize)*(w-h-12)/copy.width;
      copy.position.set(copyX,y+h*.73);panel.addChild(copy);
      panel.pivot.set(x+w/2,y+h/2);
      panel.position.set(x+w/2,y+h/2+(a.pace().reduced?0:h*arrival.lift-leaving*4));
      panel.scale.set(arrival.x,arrival.y);
      panel.alpha=1-leaving;
    };
    repaint = draw; draw();
    // Short contact, stable reading interval, then a finite release (1.1s).
    if(a.pace().reduced){reveal=1;draw();}
    else await a.tween(pace(180),t=>{reveal=t;artProgress=t*180/1100;draw();});
    if(mine!==generation || disposed) return;
    if(a.pace().reduced)await readable(800);
    else await a.tween(pace(800),t=>{artProgress=(180+t*800)/1100;draw();});
    if(mine!==generation || disposed)return;
    if(!a.pace().reduced)await a.tween(pace(120),t=>{leaving=t*t;artProgress=(980+t*120)/1100;draw();});
    if (mine === generation) { clear(fx); repaint = () => {}; }
  }

  async function duelReveal(v: VsConversion, motion: (ms: number, draw: (t: number) => void) => Promise<void>, live: () => boolean) {
    a.host.dispatchEvent(new CustomEvent('kilo-stage-action',{bubbles:true,detail:{kind:'vs'}}));
    const duel=v.duel!,action=new Container();action.label='yacht-duel';fx.addChild(action);
    let key='',ticket:Graphics,impact:Graphics,opponents:Container,challenge:Text,winner:Container,winnerClip:Graphics;
    let portraits:{kind:'king'|'vice';sprite:Sprite;body:Container;number:Text}[]=[];
    let reacted=false;const sounded=new Set<string>();
    const sound=(name:FeatureCueName)=>{if(!sounded.has(name)){sounded.add(name);a.cue?.(name);}};
    sound('vsReady');
    await motion(VS_REVEAL_MS,t=>{
      if(!a.pace().reduced){if(t>=VS_BEATS.pull)sound('vsPull');if(t>=VS_BEATS.contact)sound('vsImpact');}
      if(t>=VS_BEATS.lock){sound('vsLock');if(!reacted){reacted=true;
        a.host.dispatchEvent(new CustomEvent('kilo-stage-action',{bubbles:true,detail:{kind:duel.winner==='king'?'vs-win':'vs-loss'}}));}}
      const g=a.geom(),p=at({reel:v.reel,row:0}),h=g.cell*3,boardW=g.cell*5+g.gap*4;
      // The confrontation gets a readable close-up, not two postage stamps in
      // one thin reel. Its final wild still owns exactly the recorded one reel.
      const dw=g.cell*2.55,dx=Math.max(g.gx+2,Math.min(g.gx+boardW-dw-2,p.x+g.cell*.5-dw*.5)),dy=p.y+3;
      const k=`${g.gx}:${g.gy}:${g.cell}:${g.gap}`;
      if(key!==k){
        key=k;clear(action);portraits=[];
        ticket=new Graphics();ticket.label='vs-confrontation-ticket';action.addChild(ticket);
        opponents=new Container();opponents.label='vs-confrontation-closeup';action.addChild(opponents);
        const clip=new Graphics().poly([dx+7,dy+4,dx+dw-7,dy+4,dx+dw,dy+14,dx+dw-4,dy+h-12,dx+dw-14,dy+h-5,dx+8,dy+h-5,dx,dy+h-15,dx,dy+12]).fill(WHITE);
        action.addChild(clip);opponents.mask=clip;
        opponents.addChild(new Graphics().poly([dx,dy,dx+dw,dy,dx+dw,dy+h,dx,dy+h]).fill(0x0c1c28)
          .poly([dx,dy,dx+dw*.66,dy,dx+dw*.40,dy+h,dx,dy+h]).fill(0x71351e)
          .poly([dx+dw*.66,dy,dx+dw,dy,dx+dw,dy+h,dx+dw*.40,dy+h]).fill(0x17505b));
        const print=new Graphics();opponents.addChild(print);
        for(let i=0;i<5;i++){const yy=dy+h*(.12+i*.17);print.poly([dx,yy,dx+dw,yy-h*.18,dx+dw,yy-h*.14,dx,yy+h*.04])
          .fill({color:i%2?0x79f0da:0xffcb55,alpha:.09});}
        for(const kind of ['king','vice'] as const){
          const body=new Container();body.label=`vs-${kind}-body`;
          const performance=vsActors.get(`${kind}:${kind===duel.winner?'win':'loss'}`);
          const texture=performance?.[0]??vsPortraits[vsActionIndex(kind,0)];if(!texture)continue;
          const sprite=new Sprite(texture);sprite.label=`vs-${kind}-portrait`;sprite.anchor.set(.5,1);
          sprite.width=g.cell*2.15;sprite.height=g.cell*2.15;body.addChild(sprite);opponents.addChild(body);
          const number=createVsMultiplierLabel(`×${kind==='king'?duel.kingMultiplier:duel.viceMultiplier}`,g.cell*.43);
          number.label=`vs-${kind}-contender-multiplier`;opponents.addChild(number);
          portraits.push({kind,sprite,body,number});
        }
        challenge=createWinNumeral('VS',g.cell*.70);challenge.label='vs-clash-title';opponents.addChild(challenge);
        winner=new Container();winner.label='yacht-sticky-winner';paintWild(winner,v);action.addChild(winner);
        winnerClip=new Graphics();action.addChild(winnerClip);winner.mask=winnerClip;
        impact=new Graphics();impact.label='vs-contact-ink';action.addChild(impact);
      }
      const reduced=a.pace().reduced,beat=vsMotionAt(t,reduced),physical=vsPhysicalAt(t,reduced),resolve=physical.resolve;
      ticket.clear();paintEventTicket(ticket,dx,dy,dw,h-6,duel.winner==='king'?0xffcb55:0x79f0da);
      const arrival=1-ease(clamp01((t-.10)/.18));
      ticket.alpha=(1-resolve)*ease(clamp01(t/.12));
      opponents.alpha=(1-resolve)*ease(clamp01(t/.12));opponents.visible=resolve<1;
      for(const item of portraits){
        const isKing=item.kind==='king',direction=isKing?1:-1,losing=item.kind!==duel.winner;
        const performance=vsActors.get(`${item.kind}:${losing?'loss':'win'}`);
        if(performance)item.sprite.texture=performance[vsActorFrameIndex(t,reduced)]!;
        const home=dx+dw*(isKing?.28:.73);
        item.body.position.set(home+direction*g.cell*(-.23*arrival-.12*physical.ready+.15*physical.drive-(losing?.21:.08)*physical.recoil),
          dy+h*.84+g.cell*(.07*physical.ready-.06*physical.drive+(losing?.08:-.025)*physical.recoil));
        item.body.rotation=direction*(-.09*physical.ready+.105*physical.drive-(losing?.15:.05)*physical.recoil);
        item.body.scale.set(1+.025*physical.drive,1-.055*physical.ready+.035*physical.drive);
        item.number.position.set(dx+dw*(isKing?.24:.76),dy+g.cell*.31);
        item.number.alpha=1-clamp01((t-.38)/.16);
      }
      challenge.position.set(dx+dw*.5,dy+g.cell*.82);challenge.rotation=-.12;
      challenge.scale.set(reduced?1:.86+.14*(1-arrival));challenge.alpha=1-clamp01((t-.34)/.14);
      winner.visible=beat.winner&&resolve>0;winner.alpha=resolve;
      const pivotY=duel.winner==='king'?p.y+2:p.y+h-2;
      winner.pivot.set(p.x+g.cell/2,pivotY);winner.position.set(p.x+g.cell/2,pivotY);
      winner.scale.set(1,.78+.22*resolve+.015*physical.settle);
      for(const art of winner.children){const number=art.children.find(node=>node.label==='vs-group-multiplier');
        if(number)number.scale.set(reduced?1:vsMultiplierPunch((t-.74)/.26));}
      winnerClip.clear().rect(p.x+2,p.y+2,g.cell-4,h-4).fill(WHITE);
      impact.clear();
      if(t>=VS_BEATS.contact&&t<.71){const u=(t-VS_BEATS.contact)/(.71-VS_BEATS.contact),cx=dx+dw*.51,cy=dy+h*.51;
        Object.assign(impact,{vsContact:{x:cx,y:cy}});
        paintImpact(impact,cx,cy,dw*.8,h*.56,u,duel.winner==='king'?0xffcb55:0x79f0da,1.4,reduced,false);
        if(u<.45)impact.poly([dx+4,dy+h*.69,dx+dw-5,dy+h*.33,dx+dw-5,dy+h*.37,dx+4,dy+h*.73])
          .fill({color:0xfff2cb,alpha:1-u/.45});
      }
      if(beat.lock>0&&beat.lock<1)for(const x of[p.x+3,p.x+g.cell-3])impact.moveTo(x,p.y+4).lineTo(x,p.y+4+(h-8)*beat.lock)
        .stroke({color:duel.winner==='king'?0xffcb55:0x79f0da,width:3});
    });
    if(live()){clear(fx);repaint=()=>{};}
  }

  async function mergeGroup(previous: VsGroup[], next: VsGroup,
    motion: (ms: number, draw: (t: number) => void) => Promise<void>, live: () => boolean) {
    const layer = new Container(); layer.label = 'vs-group-merge'; fx.addChild(layer);
    let key = '', old: Container[] = [], incoming: Container, factors: Text[] = [], seams: Graphics, contact: Graphics;
    const mergeCues=new Set<string>();
    mergingReels = new Set(next.reels); paintHeld();
    try {
      // Super speed still gets a compact, readable merge. This minimum belongs
      // only to the new merge beat; existing encounter/award clocks are intact.
      const factor = {normal: 1, turbo: .55, super: .32}[a.pace().speed];
      const drawMerge = (t: number) => {
        if (!live()) return;
        const g = a.geom(), k = `${g.gx}:${g.gy}:${g.cell}:${g.gap}`;
        const x = g.gx + next.start * (g.cell + g.gap), width = next.width * g.cell + (next.width - 1) * g.gap;
        if (key !== k) {
          key = k; clear(layer); old = previous.map(unit => groupArt(unit));
          layer.addChild(...old); incoming = groupArt(next); layer.addChild(incoming);
          seams = new Graphics(); seams.label = 'vs-joining-seams'; layer.addChild(seams);
          contact=new Graphics();contact.label='vs-merge-contact';layer.addChild(contact);
          factors=previous.map(unit=>{const factor=createVsMultiplierLabel(`×${unit.multiplier}`,g.cell*.38);
            factor.label='vs-merge-factor';layer.addChild(factor);return factor;});
        }
        const beat = vsMergeAt(t, a.pace().reduced), center = x + width / 2;
        old.forEach((art, i) => {
          const unit = previous[i]!, home = g.gx + unit.start * (g.cell + g.gap);
          const unitCenter = home + (unit.width * g.cell + (unit.width - 1) * g.gap) / 2;
          const direction = Math.sign(center - unitCenter);
          art.position.set(home + direction * g.cell * (-.060 * beat.ready + .17 * beat.converge), g.gy);
          art.alpha = beat.oldAlpha;
          performVsGroupArt(art,g,a.pace().reduced?undefined:{x:1+.025*beat.ready,y:1-.045*beat.ready,lift:.018*beat.ready,turn:-direction*.018*beat.ready});
          const number = art.children.find(node => node.label === 'vs-group-multiplier');
          if (number) number.alpha = t < .18 ? 1 : 0;
        });
        incoming.alpha = beat.newAlpha;
        incoming.position.set(x, g.gy + g.cell * .018 * beat.settle);
        performVsGroupArt(incoming,g,wildArtAt(Math.max(0,(t-.30)/.70),next.side,a.pace().reduced));
        const product = incoming.children.find(node => node.label === 'vs-group-multiplier');
        if (product) { product.alpha = beat.productAlpha; product.scale.set(beat.productScale); }
        // Each visible factor is physically drawn into the new product. It is
        // still a presentation of the immutable members, never another award.
        factors.forEach((factor,i)=>{
          const unit=previous[i]!,home=g.gx+unit.start*(g.cell+g.gap)+(unit.width*g.cell+(unit.width-1)*g.gap)/2;
          const u=clamp01((t-.18)/.38),ease=u*u*(3-2*u);
          factor.position.set(home+(center-home)*ease,g.gy+g.cell*2.565-g.cell*.20*Math.sin(Math.PI*u));
          factor.scale.set(1-.25*ease);factor.alpha=beat.equationAlpha;
        });
        const tone=next.side==='king'?0xffcb55:0x79f0da;
        paintImpact(contact,center,g.gy+g.cell*2.52,width*.72,g.cell*.85,clamp01((t-.48)/.46),tone,Math.min(1.5,next.width*.32),a.pace().reduced);
        for(const [at,name] of [[.18,'vsPull'],[.48,'vsImpact'],[.70,'vsLock']] as const){
          if(t>=at&&!mergeCues.has(name)){mergeCues.add(name);a.cue?.(name);}
        }
        seams.clear();
        if(beat.seam>.001){
          const tone=next.side==='king'?GOLD:TEAL,h=g.cell*3;
          for(const unit of previous.slice(1)){
            const boundary=g.gx+unit.start*(g.cell+g.gap)-g.gap/2;
            const seamX=boundary+(center-boundary)*beat.converge*.24;
            const half=Math.max(1,g.cell*.025*beat.seam);
            seams.poly([seamX-half,g.gy+3,seamX+half,g.gy+3,seamX+half*.3,g.gy+h*.82,seamX-half*.3,g.gy+h*.82])
              .fill({color:tone,alpha:beat.seam*.80});
          }
          seams.moveTo(x+3,g.gy+3).lineTo(x+width-3,g.gy+3)
            .stroke({color:tone,width:2+3*beat.seam,alpha:beat.seam*.65});
        }
      };
      // Ownership changes synchronously: the held layer has just been cleared.
      // Paint the old compositions immediately, before the first tween RAF,
      // so there is never an empty reel-window frame during that handoff.
      drawMerge(a.pace().reduced ? 1 : 0);
      await motion(Math.max(VS_MERGE_MS, 390 / factor), drawMerge);
    } finally {
      mergingReels.clear();
      if (live()) { clear(fx); repaint = () => {}; paintHeld(); }
    }
  }

  async function step(e: FeatureEvent, callbacks: Callbacks) {
    cancel(); const mine = generation, live = () => !disposed && mine === generation && a.live();
    const r = e.reel!; current = e; let shownCascades = 0;
    const publish = () => {
      if (!live()) return;
      const state = clone(e); state.heldAfter = clone(cargo); state.pendingAfter = cargo.reduce((n, c) => n + c.value, 0);
      state.multiplier = r.type === 'tumble' ? global : Math.max(1, ...activeGroups().map(w => w.multiplier), ...wilds.map(w => w.multiplier));
      if (state.reel?.type === 'vs') { state.reel.after = clone(wilds); state.reel.groupsAfter = clone(activeGroups()); }
      if (state.reel?.type === 'tumble') {
        state.reel.globalAfter = global;
        state.reel.cascades = state.reel.cascades.slice(0, shownCascades);
      }
      callbacks.state(state);
    };
    const motion = async (ms: number, draw: (t: number) => void) => {
      let progress = 0;
      const paint = () => { if (live()) draw(progress); };
      repaint = paint;
      if (a.pace().reduced) { progress = 1; paint(); }
      else await a.tween(pace(ms), t => { progress = t; paint(); });
      if (live()) repaint = paint;
    };
    const transfer = async (award: Award, refresh?: () => void, origin?: () => { x: number; y: number }) => {
      if(!live() || award.credited<=0)return;
      if(!a.pace().reduced) {
        const el=document.createElement('div');el.className='kk-feature-transfer';el.textContent=money(award.credited);
        document.body.appendChild(el);flyers.add(el);
        try { await motion(340,t=>{
          refresh?.();
          const g=a.geom(),start=origin?.() ?? a.screen(g.gx+(5*g.cell+4*g.gap)/2,g.gy+2.6*g.cell);
          const end=a.landing(el.offsetHeight||28)??{x:start.x,y:start.y+24};
          el.style.left=`${start.x+(end.x-start.x)*ease(t)}px`;el.style.top=`${start.y+(end.y-start.y)*ease(t)}px`;
          el.style.opacity=String(t>.65?Math.max(0,(1-t)/.35):1);
        }); } finally {el.remove();flyers.delete(el);}
      }
      if(live()){a.bankCue(award.credited,award.beforeCap>award.credited);callbacks.award(award.credited);}
    };
    const cascadeWin = async (cascade: Cascade) => {
      const cells=cascade.clusters.flatMap(c=>c.cells);
      const group=new Container();group.label='cascade-connected-awards';fx.addChild(group);
      let key='',numbers: {node:Text;value:number}[]=[];
      a.focus?.(cells);
      await motion(250,t=>{
        const g=a.geom(),w=g.cell*5+g.gap*4,geometryKey=`${g.gx}:${g.gy}:${g.cell}:${g.gap}`;
        if(key!==geometryKey){key=geometryKey;clear(group);numbers=[];
          const occupied:{x:number;y:number;w:number;h:number}[]=[];
          for(const cluster of cascade.clusters){
            const corners=new Graphics();
            for(const p of cluster.cells){const pos=at(p),arm=g.cell*.12;
              for(const dx of [0,1])for(const dy of [0,1]){const x=pos.x+(dx?g.cell-4:4),y=pos.y+(dy?g.cell-4:4);
                corners.moveTo(x+(dx?-arm:arm),y).lineTo(x,y).lineTo(x,y+(dy?-arm:arm));}}
            corners.stroke({color:TEAL,width:Math.max(1.5,g.cell*.02)});group.addChild(corners);
            const node=label(money(cluster.credited),Math.max(20,g.cell*.32));
            const average={x:cluster.cells.reduce((n,p)=>n+at(p).x+g.cell/2,0)/cluster.cells.length,y:cluster.cells.reduce((n,p)=>n+at(p).y+g.cell/2,0)/cluster.cells.length};
            const candidates=[average,...cluster.cells.map(p=>({x:at(p).x+g.cell/2,y:at(p).y+g.cell/2}))];
            let selected=candidates[0]!;
            for(const p of candidates){const x=Math.max(g.gx+node.width/2+4,Math.min(g.gx+w-node.width/2-4,p.x));
              const y=Math.max(g.gy+node.height/2+4,Math.min(g.gy+3*g.cell-node.height/2-4,p.y));
              if(!occupied.some(o=>Math.abs(o.x-x)<(o.w+node.width)/2+8&&Math.abs(o.y-y)<(o.h+node.height)/2+6)){selected={x,y};break;}}
            node.position.set(selected.x,selected.y);group.addChild(node);numbers.push({node,value:cluster.credited});
            occupied.push({...selected,w:node.width,h:node.height});
          }
        }
        for(const item of numbers){item.node.text=money(Math.round(item.value*ease(t)));item.node.scale.set(1+Math.sin(Math.PI*t)*.06);}
      });
      if(!live())return;await readable(260);if(live()){clear(fx);repaint=()=>{};}
    };
    const pop = async (spots: Spot[], award: Award, caption: string, credit = true) => {
      if (!live()) return;
      const draw = () => {
        if (!live()) return; clear(fx);
        const g = a.geom(), w = g.cell * 5 + g.gap * 4;
        const centers = spots.length ? spots.map(p => ({ x: at(p).x + g.cell / 2, y: at(p).y + g.cell * .4 })) : [{ x: g.gx + w / 2, y: g.gy + g.cell * 1.5 }];
        const text = label(money(award.credited), Math.max(20, g.cell * .29));
        const head = label(caption, Math.max(11, g.cell * .12), TEAL);
        const width = Math.min(w - 12, Math.max(text.width + 20, head.width + 16, g.cell * 1.45)), height = Math.max(43, g.cell * .61);
        const cx = centers.reduce((n, p) => n + p.x, 0) / centers.length, cy = centers.reduce((n, p) => n + p.y, 0) / centers.length;
        const x = Math.max(g.gx + width / 2 + 6, Math.min(g.gx + w - width / 2 - 6, cx));
        const y = Math.max(g.gy + height / 2 + 6, Math.min(g.gy + g.cell * 3 - height / 2 - 6, cy));
        fx.addChild(new Graphics().roundRect(x - width / 2, y - height / 2, width, height, 4).fill(0x102d4c).stroke({ color: GOLD, width: 1.5 })
          .moveTo(x-width/2+5,y-height/2+3).lineTo(x+width/2-5,y-height/2+3).stroke({color:0x33778c,width:2})
          .moveTo(x-width/2+5,y+height/2-3).lineTo(x+width/2-5,y+height/2-3).stroke({color:0x06182e,width:3}));
        text.position.set(x, y + height * .14); fx.addChild(text);
        head.position.set(x, y - height * .25); fx.addChild(head);
      };
      repaint = draw; draw();
      a.readout(award.beforeCap > award.credited ? `Before cap ${money(award.beforeCap)} · credited` : caption, money(award.credited));
      await readable(460); if (!live()) return;
      clear(fx); repaint = () => {};
      if (credit && award.credited > 0) {
        // Land above the meter, fading before its existing number. The callback
        // changes only displayed totals; the host settles the round once.
        if (!a.pace().reduced) {
          const el = document.createElement('div'); el.className = 'kk-feature-transfer'; el.textContent = money(award.credited);
          document.body.appendChild(el); flyers.add(el);
          try {
            await motion(380, t => {
              const g = a.geom(), start = a.screen(g.gx + (5 * g.cell + 4 * g.gap) / 2, g.gy + 2.6 * g.cell);
              const end = a.landing(el.offsetHeight || 28) ?? { x: start.x, y: start.y + 24 };
              el.style.left = `${start.x + (end.x - start.x) * ease(t)}px`;
              el.style.top = `${start.y + (end.y - start.y) * ease(t)}px`;
              el.style.opacity = String(t > .65 ? Math.max(0, (1 - t) / .35) : 1);
            });
          } finally { el.remove(); flyers.delete(el); }
        }
        if (live()) { a.bankCue(award.credited, award.beforeCap > award.credited); callbacks.award(award.credited); }
      }
    };
    try {
      if (r.type === 'binary') {
        a.cue?.('getawayLaunch');
        a.show(r.finalGrid);
        await runGodCardPresentation(r, {
          parent: fx, host: a.host, textures: () => godCardTextures, geom: a.geom,
          pace: a.pace, motion, hold: a.hold, live, cue: a.cue,
          react: kind => a.host.dispatchEvent(new CustomEvent('kilo-stage-action', { bubbles: true, detail: { kind } })),
          readout: a.readout, screen: a.screen,
          transfer: (award, refresh, origin) => transfer(award, refresh, origin),
        });
        return;
      }
      if (r.type === 'vs') {
        if(r.rules==='pure-vs') {
          cargo=[];wilds=clone(r.before);paintHeld();
          for(const conversion of r.conversions) {
            if(!live())return;
            const beforeGroups = activeGroups();
            incomingVsReels.add(conversion.reel); concealVs();
            a.focus?.([{reel:conversion.reel,row:0},{reel:conversion.reel,row:1},{reel:conversion.reel,row:2}]);
            await duelReveal(conversion,motion,live);if(!live())return;
            wilds.push({reel:conversion.reel,multiplier:conversion.multiplier,duelist:conversion.duelist});
            incomingVsReels.delete(conversion.reel);
            const afterGroup = activeGroups().find(group => group.reels.includes(conversion.reel))!;
            if (afterGroup.width > 1) {
              const fresh: VsGroup = {id:`new:${conversion.reel}`,side:conversion.duelist ?? 'king',
                start:conversion.reel,end:conversion.reel,width:1,reels:[conversion.reel],multiplier:conversion.multiplier,
                members:[{reel:conversion.reel,multiplier:conversion.multiplier,duelist:conversion.duelist}]};
              const previous = [...beforeGroups.filter(group => group.reels.some(reel => afterGroup.reels.includes(reel))), fresh]
                .sort((left,right) => left.start-right.start);
              await mergeGroup(previous,afterGroup,motion,live);if(!live())return;
            }
            paintHeld();publish();a.focus?.(null);
          }
          a.show(r.finalGrid);
          for(const connection of vsWinningBoard(r,a.stake())){
            if(!live())return;
            const group=new Container();group.label='vs-winning-connection';fx.addChild(group);
            let key='',path:Graphics,contours:Graphics,source:Graphics,amount:Container,value:Text,components:ReturnType<typeof createConnectionAmounts>;
            let trace=0,reveal=0,amountAlpha=1,origin={x:0,y:0};
            a.focus?.(connection.spots);
            const draw=()=>{
              if(!live())return;
              const g=a.geom(),w=5*g.cell+4*g.gap,k=`${g.gx}:${g.gy}:${g.cell}:${g.gap}`;
              const centers=connection.spots.map(p=>({x:at(p).x+g.cell/2,y:at(p).y+g.cell/2}));
              if(key!==k){
                key=k;clear(group);path=new Graphics();contours=new Graphics();source=new Graphics();
                path.label='vs-connection-path';contours.label='vs-symbol-contours';
                group.addChild(path,contours,source);amount=new Container();amount.label='vs-line-award';group.addChild(amount);
                const capped=connection.credited<connection.beforeCap;
                components=createConnectionAmounts(group,connection.connections.map(hit=>({spots:hit.spots,pay:hit.credited})),!capped);
                value=createWinNumeral(money(connection.credited),Math.max(24,g.cell*.50));value.label='vs-award-amount';
                const pw=Math.min(w-12,Math.max(g.cell*1.1,value.width+12)),ph=Math.max(36,g.cell*.48);
                const wildReels=new Set(connection.groups.flatMap(unit=>unit.reels));
                const clearPoints=centers.filter((_,i)=>!wildReels.has(connection.spots[i]!.reel));
                const focus=clearPoints.length?clearPoints:centers;
                const mean=focus.reduce((n,p)=>n+p.y,0)/focus.length;
                origin={x:Math.max(g.gx+pw/2+6,Math.min(g.gx+w-pw/2-6,focus.reduce((n,p)=>n+p.x,0)/focus.length)),
                  y:clearPoints.length?Math.max(g.gy+ph/2+7,Math.min(g.gy+g.cell*2.20,mean-g.cell*.27)):g.gy+g.cell*.34};
                amount.position.set(origin.x,origin.y);amount.addChild(value);
                if(capped){const limit=createWinNumeral('LIMIT',Math.max(10,g.cell*.12),0xe2d3a8);
                  limit.label='vs-limit-note';limit.position.set(0,ph*.53);amount.addChild(limit);}
              }
              source.clear();
              const participatingReels = new Set(connection.groups.flatMap(unit => unit.reels));
              path.clear();contours.clear();
              connection.connections.forEach((hit,index)=>{
                if(!connectionTraceIndices(connection.connections.map(c=>({spots:c.spots,pay:c.credited}))).has(index))return;
                const points=hit.spots.map(p=>({x:at(p).x+g.cell/2,y:at(p).y+g.cell/2}));
                const wildIndices=new Set(hit.spots.flatMap((spot,i)=>participatingReels.has(spot.reel)?[i]:[]));
                // Lines form in a short ripple within a single board response.
                // They no longer each own a full hold and bank animation.
                const stagger=index/Math.max(1,connection.connections.length-1)*.30;
                const traced=a.pace().reduced?1:Math.max(0,Math.min(1,(trace-stagger)/(1-stagger)));
                paintWinConnection(path,contours,points,g.cell,traced,reveal,
                  {append:true,reduced:a.pace().reduced,wild:wildIndices,alpha:(amountAlpha?1:.32),intensity:connection.credited>=a.stake()*20?1.6:1});
              });
              a.respond?.(connection.spots,a.pace().reduced?1:trace<1?trace*.45:.45+reveal*.55);
              for (const art of held.children) {
                const unit = (art as Container & {vsGroup?: VsGroup}).vsGroup;
                if (!unit?.reels.some(reel => participatingReels.has(reel))) continue;
                performVsGroupArt(art,g,wildArtAt(connectionPerformanceAt(trace,reveal),unit.side,a.pace().reduced));
                const number = art.children.find(node => node.label === 'vs-group-multiplier');
                if (number) { number.scale.set(vsConnectionMultiplierScale(trace,reveal,a.pace().reduced)); number.alpha=1; }
              }
              // A finite seam accent ties each product to the connection. It
              // contracts to nothing instead of illuminating the whole frame.
              if(trace<1)for(const unit of connection.groups){const p=at({reel:unit.start,row:0}),width=unit.width*g.cell+(unit.width-1)*g.gap;
                const cy=centers.filter((_,i)=>unit.reels.includes(connection.spots[i]!.reel)).reduce((n,c)=>n+c.y,0)/Math.max(1,unit.reels.filter(reel=>reel<connection.line.n).length);
                const pressure=Math.sin(Math.PI*trace),reach=g.cell*.14*pressure;
                source.poly([p.x+3,cy,p.x+3+reach,cy-g.cell*.08*pressure,p.x+3+reach*.5,cy+g.cell*.08*pressure])
                  .fill({color:unit.side==='vice'?TEAL:GOLD,alpha:pressure*.8});}
              amount.visible=trace===1;amount.alpha=amountAlpha*(a.pace().reduced||connection.connections.length===1?1:Math.min(1,reveal*3));
              components.paint(g,trace,reveal,amountAlpha,origin,a.pace().reduced);
              amount.position.y=origin.y+(a.pace().reduced?0:g.cell*.055*(1-ease(reveal)));
              // Full credited value stamps in. Counting changing digits here
              // obscured the link between the known hit and its earned award.
              value.text=money(connection.credited);
              const stamped=impactStamp(reveal,a.pace().reduced);
              value.scale.set(stamped.x,stamped.y);value.rotation=stamped.turn*.5;
            };
            a.cue?.('vsConnect');
            await motion(VS_WIN_TIMING.connect+Math.min(220,(connection.connections.length-1)*24),t=>{trace=t;draw();});if(!live())return;
            a.cue?.('vsAmount');
            await motion(VS_WIN_TIMING.amount,t=>{reveal=t;draw();});if(!live())return;
            // The on-reel number owns the visible amount. Do not also open the
            // legacy detached DOM readout underneath the same award.
            a.host.setAttribute?.('aria-label',`Kilo King reels. ${connection.credited<connection.beforeCap?'Round limit · credited':'Line win'}: ${money(connection.credited)}`);
            await readable(VS_WIN_TIMING.hold);if(!live())return;
            // Same amount, same origin: the displayed line award leaves its own
            // connection and lands above WIN. Only that landing publishes credit.
            if(!a.pace().reduced){
              const el=document.createElement('div');el.className='kk-feature-transfer';el.textContent=money(connection.credited);
              el.style.fontVariantNumeric='tabular-nums';el.style.opacity='0';el.setAttribute?.('aria-hidden','true');document.body.appendChild(el);flyers.add(el);
              a.cue?.('vsTransfer');amountAlpha=0;let travelAlpha=1;
              try{await motion(VS_WIN_TIMING.transfer,t=>{
                draw();const start=a.screen(origin.x,origin.y);
                const end=a.landing(el.offsetHeight||28)??{x:start.x,y:start.y+24},u=ease(t);
                const g=a.geom(),fontSize=Math.max(24,g.cell*.50)*(1-.12*u),x=start.x+(end.x-start.x)*u,y=start.y+(end.y-start.y)*u;
                el.style.fontSize=`${fontSize}px`;
                el.style.fontFamily=WIN_TYPE.fontFamily;el.style.fontWeight=WIN_TYPE.fontWeight;
                el.style.color='#ffdc73';el.style.webkitTextStroke=`${Math.max(1,g.cell*.009)}px #28130c`;
                el.style.left=`${x}px`;el.style.top=`${y}px`;
                // Keep the locked product visible. If the earned number's
                // path would cross it, retire the traveller before the ink
                // overlaps instead of blinking the persistent multiplier off.
                const screenScale=Math.abs(a.screen(g.gx+g.cell,g.gy).x-a.screen(g.gx,g.gy).x)/g.cell;
                for(const art of held.children){const unit=(art as Container&{vsGroup?:VsGroup}).vsGroup;
                  if(!unit||!connection.groups.some(group=>group.reels.some(reel=>unit.reels.includes(reel))))continue;
                  const number=art.children.find(node=>node.label==='vs-group-multiplier') as Text|undefined;if(!number)continue;
                  const point=a.screen(art.x+number.x,art.y+number.y),halfWidth=(number.width+value.width)*screenScale*.5;
                  if(Math.abs(x-point.x)<=halfWidth){const clearance=point.y-y-(Number(number.style.fontSize)*screenScale+fontSize)*.5;
                    travelAlpha=Math.min(travelAlpha,Math.max(0,Math.min(1,clearance/Math.max(1,fontSize*.65))));}
                }
                el.style.opacity=String(Math.min(travelAlpha,t>.7?Math.max(0,(1-t)/.3):1));
              });}finally{el.remove();flyers.delete(el);draw();}
            }
            if(!live())return;
            a.cue?.('vsBank');a.bankCue(connection.credited,connection.credited<connection.beforeCap);callbacks.award(connection.credited);
            clear(fx);repaint=()=>{};
          }
          a.focus?.(null);
          return;
        }
        // Show every new lock, including cash consumed by the following VS action.
        cargo = e.heldBefore.map(clone);
        r.collectGrid.forEach((col, reel) => col.forEach((c, row) => {
          if (c.s === 'brick' && c.v != null && !cargo.some(p => p.id === c.id)) cargo.push({ id: c.id!, reel, row, value: Math.round(c.v * a.stake()) });
        }));
        for (const conversion of r.conversions) for (const p of conversion.sources) if (!cargo.some(c => c.id === p.id)) cargo.push(clone(p));
        paintHeld();
        for (const conversion of r.conversions) {
          if (!live()) return;
          const vs = new Container(); fx.addChild(vs);
          await motion(220, t => {
            clear(vs); const p = at({ reel: conversion.reel, row: 1 }), g = a.geom();
            const name = label('VS', Math.max(24, g.cell * .46), GOLD); name.position.set(p.x + g.cell / 2, p.y + g.cell / 2); vs.addChild(name);
          });
          if (!live()) return; clear(fx);
          const action = new Container(); fx.addChild(action);
          await motion(800, t => {
            clear(action); const g = a.geom();
            // Registered six-pose action: anticipation, pull, crank, settle.
            let ms = t * assetPack.fisherman.totalMs, pose = 0;
            while (pose < 5 && ms >= assetPack.fisherman.durationsMs[pose]!) { ms -= assetPack.fisherman.durationsMs[pose]!; pose++; }
            paintWild(action, conversion, Math.min(1, .35 + t * 3), pose);
            for (let i = 0; i < conversion.sources.length; i++) {
              const p = conversion.sources[i]!, pos = at(p), u = Math.max(0, Math.min(1, (t - .16 - i * .12) / .35));
              if (u <= 0 || u >= 1) continue;
              const art = a.cell({ s: 'brick', v: p.value / a.stake(), id: p.id }, g.cell * .52);
              art.position.set(pos.x + g.cell * .24, pos.y + (g.gy + g.cell * .82 - pos.y) * ease(u));
              art.alpha = u > .8 ? (1 - u) / .2 : 1; action.addChild(art);
              const line = new Graphics().moveTo(pos.x + g.cell * .5, g.gy + g.cell * .9).lineTo(pos.x + g.cell * .5, art.position.y + g.cell * .1).stroke({ color: GOLD, width: 1.5 });
              action.addChildAt(line, 0);
            }
          });
          if (!live()) return;
          cargo = cargo.filter(p => p.reel !== conversion.reel); wilds.push({ reel: conversion.reel, multiplier: conversion.multiplier });
          clear(fx); paintHeld(); publish();
          if (conversion.sources.length) await pop(conversion.sources, conversion, `REEL ×${conversion.multiplier}`);
        }
        if (!live()) return;
        if (r.collection.credited > 0) {
          // The accepted collector sequence, including its raw/credited split,
          // staggered values, threshold holds and final transfer stays intact.
          cargo = []; paintHeld();
          await a.collect({ grid: r.collectGrid, mult: 1, got: r.collection.credited, wilds: r.collectors });
          if (!live()) return; callbacks.award(r.collection.credited);
        }
        if (r.finalSources.length) { cargo = []; paintHeld(); await pop(r.finalSources, r.finalCash, 'FINAL CASH'); }
        if (!live()) return;
        a.show(r.finalGrid);
        if (r.lines.length) await a.highlight(r.lines, l => { if (live()) callbacks.award(l.pay); });
        return;
      }
      // Chopper: short flight across the board, one recorded drop, one boost,
      // then a full exit. Cash and position marks persist; the aircraft does not.
      const dropped = r.dropped[0]!;
      a.cue?.('chopperApproach');
      const aircraft = new Container(); aircraft.label = 'chopper-drop'; fx.addChild(aircraft);
      let aircraftKey = '', body: Sprite | null = null, parcel: Container, ground:Graphics;
      let droppedCue=false;
      await motion(1050, t => {
        const g = a.geom(), width = g.cell * 5 + g.gap * 4;
        const key = `${g.gx}:${g.gy}:${g.cell}:${g.gap}`;
        if (key !== aircraftKey) {
          aircraftKey = key; clear(aircraft);
          ground=new Graphics();aircraft.addChild(ground);
          const texture=chopperFrames[0]??chopper;
          body = texture ? new Sprite(texture) : null;
          if (body) { body.anchor.set(.5); body.width = g.cell * vehiclePack.chopper.suggestedWidthCells; body.height = body.width * 320 / 512; aircraft.addChild(body); }
          parcel = a.cell({ s: 'brick', v: dropped.value / a.stake(), id: dropped.id }, g.cell * .64); aircraft.addChild(parcel);
        }
        const target = at(dropped), startX = g.gx - g.cell, endX = g.gx + width + g.cell;
        const midX = target.x + g.cell / 2;
        const x = t < .35 ? startX + (midX - startX) * ease(t / .35) : t <= .75 ? midX : midX + (endX - midX) * ease((t - .75) / .25);
        // New rotor keys include their complete arc: keep that alpha envelope
        // inside the board mask instead of clipping the upper blade tips.
        const y = g.gy + g.cell * .67;
        if (body) {
          // Rotor, bank, hatch and hook are drawn into the registered keys.
          // Nothing spins over the illustration as an unrelated overlay.
          if(chopperFrames.length)body.texture=chopperFrames[timedPerformanceFrameAt(t,vehiclePack.chopper.frames.map(f=>f.durationMs),a.pace().reduced,2)]!;
          body.position.set(x, y);
        }
        parcel.visible = t > .47 && t < .75;
        if(t>=.47&&!droppedCue){droppedCue=true;a.cue?.('cargoDrop');}
        ground.clear();
        if (parcel.visible) {
          const u = (t - .47) / .28, scale = g.cell * vehiclePack.chopper.suggestedWidthCells / 512;
          const attachX = x + (vehiclePack.chopper.cargoDropPoint[0]! - 256) * scale - g.cell * .32;
          const attachY = y + (vehiclePack.chopper.cargoDropPoint[1]! - 160) * scale - g.cell * .32;
          // A short projected drop arc also reads for a target in the top row.
          parcel.position.set(attachX + (target.x + g.cell * .18 - attachX) * u,
            attachY + (target.y + g.cell * .18 - attachY) * u - Math.sin(Math.PI * u) * g.cell * .18);
          // The target shadow contracts as the package approaches the board.
          ground.ellipse(target.x+g.cell*.5,target.y+g.cell*.73,g.cell*(.20-.06*u),g.cell*.055).fill({color:0x000000,alpha:.22+.22*u});
          parcel.rotation=(1-u)*-.08;parcel.scale.set(1+.08*Math.sin(Math.PI*u));
        }
      });
      if (!live()) return; clear(fx); a.show(r.afterDrop);
      cargo = clone(e.heldAfter.length ? e.heldAfter : e.heldBefore);
      // The last spin still displays its pending packages until final payout.
      if (e.final) cargo = r.finalSources.map(({ multiplier: _m, ...p }) => p);
      if (!cargo.length) r.afterDrop.forEach((col, reel) => col.forEach((c, row) => { if (c.s === 'brick') cargo.push({ id: c.id!, reel, row, value: Math.round(c.v! * a.stake()) }); }));
      global = r.globalAfterDrop; marks = clone(r.marksAfterDrop); paintHeld(); publish();
      a.cue?.('cargoLock');
      const lockMark=new Container();lockMark.label='cash-locked-not-paid';fx.addChild(lockMark);
      await motion(260,t=>{clear(lockMark);const p=at(dropped),g=a.geom();
        lockMark.addChild(new Graphics().rect(p.x+3,p.y+3,g.cell-6,g.cell-6).stroke({color:TEAL,width:2.5,alpha:1-t*.65}));
        const tag=label('LOCKED',Math.max(10,g.cell*.13),TEAL);tag.position.set(p.x+g.cell/2,p.y+g.cell*.20);lockMark.addChild(tag);
      });
      if(!live())return;clear(fx);a.cue?.('multiplierBoost');
      for (const cascade of r.cascades) {
        if (!live()) return;
        await cascadeWin(cascade);if(!live())return;
        a.cue?.('cascadeBreak');
        await tumble(cascade, motion, live);
        if (!live()) return;
        a.focus?.(null);a.cue?.('cascadeLand');
        marks = clone(cascade.marksAfter); global = cascade.multiplierAfter; shownCascades++; paintHeld(); publish();
        const award={beforeCap:cascade.clusters.reduce((n,c)=>n+c.beforeCap,0),credited:cascade.clusters.reduce((n,c)=>n+c.credited,0)};
        a.readout('Cascade won · board multiplier',`×${global}`);
        await transfer(award);if(!live())return;
      }
      if (r.finalSources.length && live()) {
        let shownCredit = 0;
        for (const p of r.finalSources) {
          const beforeCap = p.value * p.multiplier;
          const credited = Math.min(beforeCap, Math.max(0, r.finalCash.credited - shownCredit));
          shownCredit += credited;
          await pop([p], { beforeCap, credited }, `CASH ×${p.multiplier}`, false);
          if (!live()) return;
        }
        cargo = []; paintHeld(); await pop(r.finalSources, r.finalCash, 'FINAL CASH');
      }
    } finally {
      if (mine === generation && !disposed) { clear(fx); repaint = () => {}; }
    }
  }
  async function tumble(c: Cascade, motion: (ms: number, draw: (t: number) => void) => Promise<void>, live: () => boolean) {
    const geometryKey = () => { const g = a.geom(); return `${g.gx}:${g.gy}:${g.cell}:${g.gap}`; };
    let key = '', fragments: { node: Container; art: Container; reel: number; row: number; part: number }[] = [];
    // Build the fragment display objects once. A resize rebuilds their local
    // geometry; ordinary animation frames only update transforms and alpha.
    await motion(180, t => {
      const g = a.geom();
      if (key !== geometryKey()) {
        key = geometryKey(); clear(fx); fragments = [];
        for (const cluster of c.clusters) for (const p of cluster.cells) {
          const pos = at(p); fx.addChild(new Graphics().rect(pos.x, pos.y, g.cell, g.cell).fill(INK));
          for (let part = 0; part < 4; part++) {
            const triangles=[[0,0,g.cell,0,g.cell/2,g.cell/2],[g.cell,0,g.cell,g.cell,g.cell/2,g.cell/2],
              [g.cell,g.cell,0,g.cell,g.cell/2,g.cell/2],[0,g.cell,0,0,g.cell/2,g.cell/2]];
            const node = new Container(), clip = new Graphics().poly(triangles[part]!).fill(0xffffff);
            node.pivot.set(g.cell/2);
            const art = a.cell(c.before[p.reel]![p.row]!, g.cell);
            node.addChild(art, clip); node.mask = clip; fx.addChild(node);
            fragments.push({ node, art, ...p, part });
          }
        }
      }
      for (const item of fragments) {
        const pos=at(item),direction=[[0,-1],[1,0],[0,1],[-1,0]][item.part]!;
        item.node.position.set(pos.x+g.cell/2+direction[0]!*t*g.cell*.10,pos.y+g.cell/2+direction[1]!*t*g.cell*.10+t*t*g.cell*.08);
        item.node.rotation=(item.part%2?1:-1)*t*.07;item.node.alpha=1-t;
      }
    });
    if (!live()) return;
    a.show(c.after); key = '';
    let falling: { art: Container; reel: number; row: number; from: number }[] = [];
    await motion(430, t => {
      const g = a.geom();
      if (key !== geometryKey()) {
        key = geometryKey(); clear(fx); falling = [];
        for (let reel = 0; reel < 5; reel++) {
          let segment = 0;
          for (let boundary = 0; boundary <= 3; boundary++) {
            if (boundary < 3 && c.before[reel]![boundary]!.s !== 'brick') continue;
            if (boundary > segment) {
              const p = at({ reel, row: segment }), height = (boundary - segment) * g.cell;
              const section = new Container(), clip = new Graphics().rect(p.x, p.y, g.cell, height).fill(0xffffff);
              section.addChild(new Graphics().rect(p.x, p.y, g.cell, height).fill(INK));
              for (let row = segment; row < boundary; row++) {
                const drop = c.drops.find(d => d.reel === reel && d.row === row);
                const art = a.cell(c.after[reel]![row]!, g.cell); section.addChild(art);
                falling.push({ art, reel, row, from: drop?.fromRow ?? row });
              }
              section.addChild(clip); section.mask = clip; fx.addChild(section);
            }
            segment = boundary + 1;
          }
        }
      }
      for (const item of falling) {
        if(item.from===item.row){item.art.position.set(at(item).x,g.gy+item.row*g.cell);continue;}
        const delay=item.reel*.018, u=Math.max(0,Math.min(1,(t-delay)/(1-delay)));
        const fall=u<.84?(u/.84)**2:1;
        const impact=u>.84?Math.sin((u-.84)/.16*Math.PI)*.018:0;
        item.art.position.set(at(item).x,g.gy+(item.from+(item.row-item.from)*fall+impact)*g.cell);
      }
    });
    if (live()) clear(fx);
  }
  return { set, step, intro, cancel, refreshMotion, destroy() { cancel(); disposed = true; lifeLoop.destroy();restingActors.length=0;a.host.removeEventListener('kilo-relayout', relayout); root.destroy({ children: true });
    [...frames,...chopperFrames,...vsPortraits,...vsStrips,...[...vsActors.values()].flat(),...[...entryFrames.values()].flat()].forEach(texture=>texture.destroy(false));
  } };
}
