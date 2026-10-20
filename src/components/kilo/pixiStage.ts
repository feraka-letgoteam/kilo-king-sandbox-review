import { MAX_RIG_URLS } from './max-boat-performance';
import { setMaxStageVisibility } from './max-stage-visibility';
import { paintMaxStageSurface } from './max-stage-surface';
import { MAX_BOAT_URL } from './max-spin-motion';
import { GOD_CARD_ASSETS } from './god-card-performance';
import { createFeatureEffects } from './feature-effects';
import { presentCatchRespin } from './catch-respin';
import { createReelFeatureEffects } from './reel-feature-effects';
import { CHARACTER_RIG_URLS } from './character-rig-model';
import { VS_ART_URLS } from './vs-art';
import { VS_GROUP_ART_URLS, VS_MULTIPLIER_FONT } from './vs-group-art';
import { VS_ACTOR_URLS } from './vs-actor-performance';
import { connectionAnchor } from './connection-win';
import { createWinNumeral, connectedNumberScale, WIN_TYPE } from './win-type';
import { paintWinConnection } from './win-connection-paint';
import { createConnectionAmounts, connectionTraceIndices } from './connection-amounts';
import { connectionClock } from './vs-choreography';
import { paintImpact, paintEventTicket, impactStamp } from './impact-language';
import { KING_THROW_RELEASE, type KingToolEvent } from './stage-character-arm';
import { featureArrivalAt } from './event-performance';
import { articulateArt, restoreArticulation } from './articulation';
import { FEATURE_NAMES } from '@/lib/kilo/feature-math';
import { SPIN_TIMING, type SpinSpeed } from "./control-model";
import { SYMBOL_LABELS } from "./symbol-labels";
import { anticipationAt, reelLockPose, reelTravelAt, symbolWinPose } from "./presentation-motion";
import { collectionHold, stageReadoutLayout, collectorAmountLabels, collectionType } from "./presentation-readout";
import { AUTHORED_CLIPS } from "./authored-clips";
import { authoredFrameAt, type AuthoredClip } from "./authored-animation";
// v20-art-begin
import { createMarinaFrame } from "./marina-frame";
import { CABINET_ART, SPOOL_ART } from "./stage-art";
// v20-art-end
import {
  Application,
  Assets,
  BlurFilter,
  Container,
  Graphics,
  Sprite,
  Text,
  Texture,
  Rectangle,
  TilingSprite,
} from "pixi.js";
import {
  collectMult,
  type SplashScript,
  type SplashCell,
  type SplashLine,
  type Sym,
} from "@/lib/kilo/engine";
import type { ReelScene } from "./director";
import { collectionShares, winningCells } from "./director";
import { scatterBuild, landStop, teaseBegin, teaseResolve, whirStart, whirStop, winSting, bonusEnter, setAudioTurbo, featureCue } from "@/lib/kilo/sound";
import {
  ART as ART_FILES,
  SYMBOL_ALPHA,
  TOOL_PIVOTS,
  artUrl,
} from "./art-map";
import {
  MOTION_ROOT,
  collectorAtlas,
  motionMs,
  reactionIndex,
} from "./motion-atlas";
import {
  CONTRABAND_ROOT,
  PACKAGE_META,
  SCATTER_KING,
  V8_META,
  V8_ROOT,
  fishReaction,
  fishTier,
  type PackageKey,
} from "./fish-art";

const ART: Record<Sym, string> = {
  "10": artUrl(ART_FILES["10"]),
  J: artUrl(ART_FILES.J),
  Q: artUrl(ART_FILES.Q),
  K: artUrl(ART_FILES.K),
  A: artUrl(ART_FILES.A),
  cuffs: artUrl(ART_FILES.cuffs),
  keys: artUrl(ART_FILES.keys),
  lamp: V8_ROOT + V8_META["sym-reel-v8"].file,
  duffel: V8_ROOT + V8_META["sym-case-v8"].file,
  brick: artUrl(ART_FILES.brick),
  bars: artUrl(ART_FILES.bars),
  splash: artUrl(ART_FILES.splash),
};

const PASS: Sym[] = [
  "10",
  "J",
  "Q",
  "K",
  "A",
  "cuffs",
  "keys",
  "lamp",
  "duffel",
  "brick",
  "Q",
  "A",
  "keys",
  "J",
];

type Geom = {
  dw: number;
  dh: number;
  bust: boolean;
  logo: { x: number; y: number; h: number };
  face: { x: number; y: number; h: number };
  cab: { x: number; y: number; w: number; h: number };
  cell: number;
  gap: number;
  gx: number;
  gy: number;
  statusY: number;
};

function money(n: number) {
  return Math.max(0, Math.round(n)).toLocaleString();
}

function passer(reel: number, index: number): SplashCell {
  // Crowns never ride the blur. A passing scatter would be a fake near-miss.
  // The only crown is the recorded cell, revealed as that reel locks.
  const s = PASS[(reel * 3 + index) % PASS.length]!;
  return s === "brick" ? { s, v: [2, 5, 10][index % 3], w: 1, h: 1 } : { s };
}

function edgeFor(w: number, h: number) {
  return Math.min(18, Math.max(10, Math.round(Math.min(w, h) * 0.035)));
}

function frameBorders(cab: { w: number; h: number }) {
  const edge = edgeFor(cab.w, cab.h);
  return { l: edge, r: edge, t: edge, b: edge };
}

/** Compact 5×3. Gutters stay bounded. Leftover host space sits outside the cabinet. */
function fitReels(hostW: number, hostH: number) {
  const gutter = Math.min(
    8,
    Math.max(3, Math.round(Math.min(hostW, hostH) * 0.015)),
  );
  let edge = edgeFor(hostW, hostH);
  let cell = 24;
  let cabW = hostW;
  let cabH = hostH;
  for (let pass = 0; pass < 3; pass++) {
    cell = Math.max(
      24,
      Math.floor(
        Math.min(
          (hostW - edge * 2 - gutter * 4) / 5,
          (hostH - edge * 2) / 3,
        ),
      ),
    );
    cabW = cell * 5 + gutter * 4 + edge * 2;
    cabH = cell * 3 + edge * 2;
    edge = edgeFor(cabW, cabH);
  }
  const cab = {
    x: Math.round((hostW - cabW) / 2),
    y: Math.round((hostH - cabH) / 2),
    w: cabW,
    h: cabH,
  };
  const borders = frameBorders(cab);
  return {
    cell,
    gap: gutter,
    gx: cab.x + borders.l,
    gy: cab.y + borders.t,
    statusY: cab.y + cab.h - borders.b / 2,
    cab,
    dw: hostW,
    dh: hostH,
  };
}
function geomFor(w: number, h: number): Geom {
  const dw = Math.max(280, Math.round(w));
  const dh = Math.max(160, Math.round(h));
  return {
    ...fitReels(dw, dh),
    bust: false,
    logo: { x: 0, y: 0, h: 0 },
    face: { x: 0, y: 0, h: 0 },
  };
}

export async function mountScene(host: HTMLElement): Promise<ReelScene> {
  host.setAttribute("role", "img");
  host.setAttribute("aria-label", "Kilo King reels");
  const app = new Application();
  await app.init({
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(2, window.devicePixelRatio || 1),
    resizeTo: host,
  });
  host.appendChild(app.canvas);
  app.canvas.style.width = "100%";
  app.canvas.style.height = "100%";
  // One readout on the cabinet lip. Exact values never have to compete with
  // the collector face or the fixed values printed on the packages.
  const readout = document.createElement("output");
  readout.className = "kk-stage-readout";
  readout.hidden = true;
  let readoutActive = false;
  const readoutLabel = document.createElement("span");
  const readoutValue = document.createElement("strong");
  readout.append(readoutLabel, readoutValue);
  host.appendChild(readout);
  app.canvas.style.display = "block";

  const urls = [
    ...new Set([
      ...Object.entries(ART)
        .filter(([sym]) => sym !== "brick" && sym !== "splash" && sym !== "bars")
        .map(([, url]) => url),
      "/kilo-v79/surfaces/reel-well.webp",
      "/kilo-v79/surfaces/modal-panel.webp",
      artUrl(TOOL_PIVOTS.hook.file),
      artUrl(TOOL_PIVOTS.dynamite.file),
      artUrl(TOOL_PIVOTS.bazooka.file),
      "/kilo-v79/fx/fx-burst.webp",
      "/kilo-v79/fx/fx-water-impact.webp",
      MOTION_ROOT + collectorAtlas.image,
      MOTION_ROOT + "retrigger-frame.svg",
      MOTION_ROOT + "value-plaque.svg",
      ...Object.values(PACKAGE_META).map((meta) => CONTRABAND_ROOT + meta.file),
      CONTRABAND_ROOT + SCATTER_KING.file,
      "/kilo-v79/surfaces/banner.webp",
      "/kilo-v79/surfaces/banner.webp",
      "/kilo-features-v52/fisherman-reel-in.webp",
      "/kilo-features-v54/fisherman-reel-in.webp",
      "/kilo-features-v54/vice-officer.webp",
      "/kilo-features-v52/chopper-body.webp",
      "/kilo-features-v53/getaway-speedboat.webp",
      "/kilo-features-v53/getaway-hardcase.webp",
      ...CHARACTER_RIG_URLS,
      ...VS_ART_URLS,
      ...VS_GROUP_ART_URLS,
      ...VS_ACTOR_URLS,
      AUTHORED_CLIPS['entry-scatter-3'].url,
      MAX_BOAT_URL, ...MAX_RIG_URLS,
      ...Object.values(GOD_CARD_ASSETS),
      "/kilo-v79/vehicles/chopper-action.webp",
      "/kilo-v55/vehicles/getaway-action.webp",
      "/kilo-v56/vehicles/getaway-stop.webp",
      "/kilo-v79/surfaces/dock.webp",
      "/kilo-v79/surfaces/yacht.webp",
      "/kilo-v79/surfaces/route.webp",
      "/kilo-v79/surfaces/getaway.webp",
    ]),
  ];
  await Promise.all(urls.map((url) => Assets.load(url)));
  // v20-art-begin
  await Promise.all([CABINET_ART, SPOOL_ART].map((url) => Assets.load(url)));
  const marinaFrame = createMarinaFrame(Assets.get<Texture>(CABINET_ART));
  // v20-art-end
  const tex = (file: string) => Assets.get<Texture>(artUrl(file));
  const textures = Object.fromEntries(
    Object.entries(ART)
      .filter(([sym]) => sym !== "brick" && sym !== "splash" && sym !== "bars")
      .map(([sym, url]) => [sym, Assets.get<Texture>(url)]),
  ) as Record<Sym, Texture>;
  const wellTex = Assets.get<Texture>("/kilo-v79/surfaces/reel-well.webp");
  const modalTex = Assets.get<Texture>("/kilo-v79/surfaces/modal-panel.webp");
  const entryTex =
    (Assets.get("/kilo-v79/surfaces/banner.webp") as Texture | undefined) || modalTex;
  const upgradeTex =
    (Assets.get("/kilo-v79/surfaces/banner.webp") as Texture | undefined) || modalTex;
  const hookTex = tex(TOOL_PIVOTS.hook.file);
  const dynamiteTex = tex(TOOL_PIVOTS.dynamite.file);
  const bazookaTex = tex(TOOL_PIVOTS.bazooka.file);
  const burstTex = Assets.get<Texture>("/kilo-v79/fx/fx-burst.webp");
  const impactTex = Assets.get<Texture>("/kilo-v79/fx/fx-water-impact.webp");
  const motionTex = (file: string) => Assets.get<Texture>(MOTION_ROOT + file);
  const framesFrom = (
    file: string,
    frames: { x: number; y: number; w: number; h: number }[],
  ) => {
    const source = motionTex(file).source;
    return frames.map(
      (frame) =>
        new Texture({
          source,
          frame: new Rectangle(frame.x, frame.y, frame.w, frame.h),
        }),
    );
  };
  const collectorFrames = framesFrom(collectorAtlas.image, collectorAtlas.frames);
  const packageTextures = Object.fromEntries(
    (Object.keys(PACKAGE_META) as PackageKey[]).map((key) => [
      key,
      Assets.get<Texture>(CONTRABAND_ROOT + PACKAGE_META[key].file),
    ]),
  ) as Record<PackageKey, Texture>;
  const scatterTex = Assets.get<Texture>(CONTRABAND_ROOT + SCATTER_KING.file);
  const authoredTextures = new Map<string, { clip: AuthoredClip; frames: Texture[] }>();
  // Dock entry uses the standard ceremony, not the version-4 feature director.
  // Decode its crest with the stage so the first entry has its authored art.
  const dockEntryClip=AUTHORED_CLIPS['entry-scatter-3'];
  const dockEntrySheet=Assets.get<Texture>(dockEntryClip.url);
  authoredTextures.set('entry-scatter-3',{clip:dockEntryClip,frames:dockEntryClip.frames.map(f=>new Texture({
    source:dockEntrySheet.source,frame:new Rectangle(f.x,f.y,f.w,f.h),
  }))});
  // Optional drawing packs never delay a recorded outcome or a collection.
  // Missing packs retain the existing animation. Ready packs are used at the
  // next reaction boundary, never injected half way through one.
  void Promise.all(Object.entries(AUTHORED_CLIPS).filter(([key]) =>
    !key.startsWith("entry-") && !key.startsWith("actor") && key !== "completion",
  ).map(async ([key, clip]) => {
    try {
      const sheet = await Assets.load<Texture>(clip.url);
      if (destroyed) return;
      authoredTextures.set(key, { clip, frames: clip.frames.map(f => new Texture({
        source: sheet.source, frame: new Rectangle(f.x,f.y,f.w,f.h),
      })) });
    } catch { /* Existing static artwork/reactions remain the fallback. */ }
  }));
  const retriggerTex = motionTex("retrigger-frame.svg");
  const plaqueTex = motionTex("value-plaque.svg");

  /** Decorative crown action in the banner's existing left medallion.
   * Its clock cannot award spins or extend the retrigger ceremony. */
  function playRetriggerArt(group: Container,x:number,y:number,w:number,h:number) {
    const asset=authoredTextures.get("retrigger");
    if(reduced||!asset)return ()=>{};
    const art=new Sprite(asset.frames[0]),[l,t,r,b]=asset.clip.bounds;
    const scale=Math.min(w*.19/(r-l),h*.66/(b-t));
    art.anchor.set((l+r)/2/asset.clip.frames[0].w,(t+b)/2/asset.clip.frames[0].h);
    art.scale.set(scale);art.position.set(x+w*.18,y+h*.52);group.addChild(art);
    let raf=0,last=0,elapsed=0,closed=false;
    const paint=(now:number)=>{
      raf=0;if(closed||group.destroyed||art.destroyed)return;
      if(!document.hidden){elapsed+=last?Math.min(64,now-last):0;art.texture=asset.frames[authoredFrameAt(asset.clip,elapsed/560)];}
      last=document.hidden?0:now;
      if(elapsed<560)raf=requestAnimationFrame(paint);
    };
    raf=requestAnimationFrame(paint);
    return()=>{closed=true;cancelAnimationFrame(raf);};
  }

  const world = new Container();
  app.stage.addChild(world);
  const cabinet = new Graphics();
  const well = new TilingSprite({ texture: wellTex, width: 10, height: 10 });
  const veil = new Graphics();
  const routes = new Graphics();
  const frame = new Graphics();
  const transient = new Container();
  const fx = new Graphics();
  const lineArt = new Container();
  const locks = new Graphics();
  const reels: { root: Container; strip: Container; mask: Graphics }[] = [];
  let hiddenVsReels = new Set<number>();
  for (let i = 0; i < 5; i++) {
    const root = new Container();
    const mask = new Graphics();
    const strip = new Container();
    root.mask = mask;
    root.addChild(mask, strip);
    reels.push({ root, strip, mask });
  }
  const motionBlur = reels.map(() => {
    const blur = new BlurFilter({ strength: 0, quality: 1 });
    blur.strengthX = 0;
    return blur;
  });
  const setStreak = (reel: number, amount: number) => {
    const strip = reels[reel]?.strip;
    const blur = motionBlur[reel];
    if (!strip || !blur || strip.destroyed) return;
    if (amount < 0.4) {
      if (strip.filters) strip.filters = [];
      return;
    }
    blur.strengthX = 0;
    blur.strengthY = amount;
    const current = strip.filters;
    const first = Array.isArray(current) ? current[0] : current;
    if (first !== blur) strip.filters = [blur];
  };
  const clearStreak = () => {
    for (let reel = 0; reel < reels.length; reel++) setStreak(reel, 0);
  };
  const DISPLAY = "Barlow Condensed";
  const TEXT = "Source Sans 3";
  const ensureType = async () => {
    if (typeof document === "undefined" || !document.fonts) return;
    await Promise.all([
      document.fonts.load(`600 22px "${DISPLAY}"`),
      document.fonts.load(`400 16px "${TEXT}"`),
      document.fonts.load(`600 16px "${TEXT}"`),
      document.fonts.load(`700 28px "${TEXT}"`),
      document.fonts.load(`700 32px "${VS_MULTIPLIER_FONT}"`),
    ]);
    await document.fonts.ready;
  };
  void ensureType();

  const title = new Text({
    text: "Base game",
    style: {
      fill: 0xfff6dd,
      fontFamily: "Source Sans 3",
      fontSize: 18,
      fontWeight: "700",
      stroke: { color: 0x140e06, width: 4 },
    },
  });
  title.anchor.set(0.5);
  world.addChild(cabinet, well, veil, routes);
  for (const reel of reels) world.addChild(reel.root);
  world.addChild(frame);
  // v20-art-begin
  world.addChild(marinaFrame.root);
  // v20-art-end
  world.addChild(fx, lineArt, locks, title, transient);

  // Max covers the board with an illustrated card; it never blanks the strips.
  // Retain the legacy water object only as an inert cached drawing.
  const reelInterior = [cabinet, well, veil, routes, ...reels.map(r => r.root), fx, lineArt, locks];
  const maxWater = new Graphics();maxWater.label = 'getaway-stage-water';
  world.addChildAt(maxWater, world.children.indexOf(frame));
  setMaxStageVisibility(reelInterior, false);
  maxWater.visible = false;

  let meterWilds = 0;
  let stake = 1000;
  let turbo = false;
  let speedMode: SpinSpeed = "normal";
  let reduced = false;
  let geom = geomFor(host.clientWidth || 1100, host.clientHeight || 640);
  let board: SplashCell[][] = [
    [{ s: "A" }, { s: "cuffs" }, { s: "10" }],
    [{ s: "brick", v: 5, w: 1, h: 1 }, { s: "Q" }, { s: "keys" }],
    [{ s: "K" }, { s: "lamp" }, { s: "bars" }],
    [{ s: "duffel" }, { s: "J" }, { s: "brick", v: 10, w: 1, h: 1 }],
    [{ s: "10" }, { s: "bars" }, { s: "splash" }],
  ];
  let stopped = false;
  let job = 0;
  let animating = false;
  let destroyed = false;
  let pendingLayout = false;
  let resizeFollow = false;
  const waits = new Set<() => void>();

  type PlaceMark = {
    asset: PackageKey | "scatter-king" | "sym-reel-v8" | "sym-case-v8";
    size: number;
    boxW: number;
    boxH: number;
    cx: number;
    cy: number;
  };
  type Placed = Sprite & { kkPlace?: PlaceMark };

  function applyPlace(sprite: Sprite, reaction = { scale: 1, rotation: 0 }) {
    const mark = (sprite as Placed).kkPlace;
    if (!mark) return;
    const asset = mark.asset;
    const meta =
      asset === "scatter-king"
        ? SCATTER_KING
        : asset === "package-small" ||
            asset === "package-medium" ||
            asset === "package-trophy" ||
            asset === "package-king"
          ? PACKAGE_META[asset]
          : V8_META[asset];
    const [x0, y0, x1, y1] = meta.bounds;
    const fit = Math.min(
      (mark.size * mark.boxW) / (x1 - x0),
      (mark.size * mark.boxH) / (y1 - y0),
    );
    if (
      asset === "package-small" ||
      asset === "package-medium" ||
      asset === "package-trophy" ||
      asset === "package-king"
    ) {
      sprite.texture = packageTextures[asset];
    } else if (asset === "scatter-king") {
      sprite.texture = scatterTex;
    } else if (mark.asset === "sym-reel-v8") {
      sprite.texture = textures.lamp;
    } else if (mark.asset === "sym-case-v8") {
      sprite.texture = textures.duffel;
    }
    sprite.anchor.set((x0 + x1) / 2 / meta.width, (y0 + y1) / 2 / meta.height);
    sprite.scale.set(fit * reaction.scale);
    sprite.rotation = reaction.rotation;
    sprite.position.set(mark.size * mark.cx, mark.size * mark.cy);
  }

  // Resizing rebuilds standing sprites. Rebind to the same cell and restore
  // the current reaction phase before the next rendered frame.
  const reactionRefresh = new Set<() => void>();
  function playFishAck(resolveSprite: () => Sprite | null) {
    const mine = job;
    let phase = 0;
    const initial = resolveSprite() as Placed | null;
    const clip = initial?.kkPlace ? authoredTextures.get(initial.kkPlace.asset) : undefined;
    const paint = () => {
      const sprite = resolveSprite() as Placed | null;
      if (mine !== job || stopped || !sprite || sprite.destroyed ||
          !sprite.kkPlace?.asset.startsWith("package-")) return;
      if (clip && !reduced) paintAuthored(sprite, clip, phase);
      else applyPlace(sprite, fishReaction(phase * 420, reduced));
      if (!reduced) articulateArt(sprite, 'brick', phase, 'haul', 1, clip?.clip.registrationBounds ?? clip?.clip.bounds);
    };
    const ms = reduced ? 0 : turbo ? Math.round(420 * 0.45) : 420;
    reactionRefresh.add(paint);
    return tween(ms, (t) => {
      phase = t;
      paint();
    }).finally(() => {
      reactionRefresh.delete(paint);
      const sprite = resolveSprite();
      if (mine === job && !stopped && sprite && !sprite.destroyed) {
        restoreAuthored(sprite);
        applyPlace(sprite, { scale: 1, rotation: 0 });
      }
    });
  }

  function cellView(cell: SplashCell, size: number, decor = true, printed?: number) {
    const root = new Container();
    if (cell.duel) {
      root.label = 'duel-trigger';
      const edge = size * .12, mid = size / 2;
      root.addChild(new Graphics().poly([mid,edge,size-edge,size*.30,size-edge,size*.70,mid,size-edge,edge,size*.70,edge,size*.30])
        .fill(0x07131a).stroke({color:0xd8b66f,width:Math.max(2,size*.035)}));
      root.addChild(new Graphics().moveTo(mid+size*.08,size*.24).lineTo(mid-size*.08,size*.76).stroke({color:0x89e6d9,width:Math.max(2,size*.025)}));
      const vs = new Text({text:'VS',style:{fontFamily:'Source Sans 3',fontWeight:'900',fontSize:size*.39,fill:0xfff8e9,stroke:{color:0x07131a,width:3}}});
      vs.anchor.set(.5);vs.position.set(mid,mid);root.addChild(vs);
      (root as Container & { kkSym?: string }).kkSym = cell.s;
      return root;
    } else if (cell.s === "brick") {
      const value = cell.v;
      let tier: ReturnType<typeof fishTier> | null = null;
      if (typeof value === "number") {
        try {
          tier = fishTier(value);
        } catch (error) {
          console.error(error);
        }
      } else {
        console.error(`Unknown recorded package value: ${String(value)}`);
      }
      if (tier) {
        const sprite = new Sprite(packageTextures[tier.asset]) as Placed;
        sprite.kkPlace = {
          asset: tier.asset,
          size,
          boxW: tier.width,
          boxH: tier.height,
          cx: 0.5,
          cy: tier.centerY,
        };
        applyPlace(sprite);
        root.addChild(sprite);
      }
    } else if (cell.s === "bars") {
      const sprite = new Sprite(scatterTex) as Placed;
      sprite.kkPlace = {
        asset: "scatter-king",
        size,
        boxW: SCATTER_KING.boxW,
        boxH: SCATTER_KING.boxH,
        cx: SCATTER_KING.cx,
        cy: SCATTER_KING.cy,
      };
      applyPlace(sprite);
      root.addChild(sprite);
    } else if (cell.s === "lamp" || cell.s === "duffel") {
      const sprite = new Sprite(textures[cell.s]) as Placed;
      sprite.kkPlace = {
        asset: cell.s === "lamp" ? "sym-reel-v8" : "sym-case-v8",
        size,
        boxW: 0.9,
        boxH: 0.9,
        cx: 0.5,
        cy: 0.5,
      };
      applyPlace(sprite);
      root.addChild(sprite);
    } else {
      const sprite = new Sprite(
        cell.s === "splash" ? collectorFrames[0] : textures[cell.s],
      );
      sprite.anchor.set(0.5);
      const box = SYMBOL_ALPHA[cell.s];
      const target =
        box &&
        (cell.s === "10" ||
          cell.s === "J" ||
          cell.s === "Q" ||
          cell.s === "K" ||
          cell.s === "A")
          ? 0.66
          : 0.78;
      if (cell.s === "splash") {
        // Visible bust inside the 444 frame. Bottom of the cell stays open
        // for the collector subtotal, so the face is not shrunk to make room.
        const vx0 = 10;
        const vy0 = 46;
        const vx1 = 424;
        const vy1 = 392;
        const fit = Math.min(
          (size * 0.98) / (vx1 - vx0),
          (size * 0.8) / (vy1 - vy0),
        );
        const bust = {
          ax: (vx0 + vx1) / 2 / 444,
          ay: (vy0 + vy1) / 2 / 444,
          scale: fit,
          x: size * 0.5,
          y: size * 0.425,
        };
        sprite.anchor.set(bust.ax, bust.ay);
        sprite.scale.set(bust.scale);
        sprite.position.set(bust.x, bust.y);
        (sprite as Sprite & { kkBust?: typeof bust }).kkBust = bust;
      } else {
        const longer = box ? Math.max(box[2] - box[0], box[3] - box[1]) : 1024;
        const display = size * target * (1024 / longer);
        sprite.scale.set(
          display / Math.max(sprite.texture.width, sprite.texture.height),
        );
        sprite.position.set(size / 2, size / 2);
        if (box) {
          sprite.x += (512 - (box[0] + box[2]) / 2) * sprite.scale.x;
          sprite.y += (512 - (box[1] + box[3]) / 2) * sprite.scale.y;
        }
      }
      root.addChild(sprite);
    }
    const hasValue = decor && cell.s === "brick" && cell.v != null;
    if (hasValue && cell.v != null) {
      const text = money(printed ?? stake * cell.v);
      const maxW = size * 0.84;
      let fontSize = Math.max(8, Math.floor(size * 0.16));
      const label = new Text({
        text,
        style: {
          fill: 0xf5ead1,
          fontFamily: "Source Sans 3",
          fontSize,
          fontWeight: "700",
        },
      });
      while (label.width > maxW && fontSize > 7) {
        fontSize -= 1;
        label.style.fontSize = fontSize;
      }
      if (label.width > maxW) label.scale.set(maxW / label.width);
      const plaque = new Sprite(plaqueTex);
      plaque.anchor.set(0.5, 0);
      plaque.width = size * 0.91;
      plaque.height = size * 0.2;
      plaque.position.set(size / 2, size * 0.76);
      label.anchor.set(0.5);
      label.position.set(size / 2, size * 0.86);
      root.addChild(plaque, label);
    }
    if (decor && cell.s === "splash") {
      const tagW = size * 0.36;
      const tagH = Math.max(12, size * 0.07);
      const tagY = size * 0.7;
      const back = new Graphics()
        .roundRect((size - tagW) / 2, tagY, tagW, tagH, tagH / 2)
        .fill({ color: 0x10262c, alpha: 0.94 })
        .stroke({ color: 0xe7c56a, width: Math.max(1, size * 0.008) });
      const tag = new Text({
        text: "WILD",
        style: {
          fill: 0xffe7b0,
          fontFamily: "Source Sans 3",
          fontSize: Math.max(9, size * 0.046),
          fontWeight: "700",
        },
      });
      tag.anchor.set(0.5);
      tag.position.set(size / 2, tagY + tagH / 2);
      root.addChild(back, tag);
      back.label = "collector-tag";
      tag.label = "collector-tag";
    }
    (root as Container & { kkSym?: string }).kkSym = cell.s;
    return root;
  }

  function paintStanding() {
    if (destroyed) return;
    const { cell } = geom;
    for (let reel = 0; reel < 5; reel++) {
      const strip = reels[reel]!.strip;
      strip.filters = [];
      strip
        .removeChildren()
        .forEach((child) => child.destroy({ children: true }));
      for (let row = 0; row < 3; row++) {
        const view = cellView(board[reel]![row]!, cell);
        view.y = row * cell;
        strip.addChild(view);
      }
      strip.position.set(0, 0);
      strip.visible = !hiddenVsReels.has(reel);
    }
  }

  function placeFrame() {
    // v20-art-begin
    marinaFrame.place(geom.dw, geom.dh, host.closest(".kk-shell")?.getAttribute("data-compact") === "true" ? "mini" : host.closest(".kk-shell")?.getAttribute("data-layout") ?? "wide");
    // v20-art-end
    const { cab, cell, gap, gx, gy } = geom;
    const edge = frameBorders(cab);
    const gridW = cell * 5 + gap * 4;
    const gridH = cell * 3;
    const x = cab.x;
    const y = cab.y;
    const deep = 0x08151d;

    // Painted marine hardware, fitted entirely to the existing edge budget.
    // The cell rectangle and collection landing coordinates do not change.
    cabinet.clear();
    cabinet
      .roundRect(x + 1, y + 1, cab.w - 2, cab.h - 2, 5)
      .fill(deep)
      .stroke({ color: 0x020a10, width: 2 });
    cabinet
      .rect(gx - 2, gy - 2, gridW + 4, gridH + 4)
      .fill(0x030c12);

    // One authored frame owns the hardware; this only seals the reel aperture.
    // It replaces the competing vector rails, raster border and CSS rim.
    frame.clear();
    frame.rect(gx - 1.5, gy - 1.5, gridW + 3, gridH + 3)
      .stroke({ color: 0x02090e, width: 3 });

    // The texture is only an underlying material grain. A calm blue-green
    // field keeps the illustrated symbols brighter than their surroundings.
    well.position.set(gx, gy);
    well.width = gridW;
    well.height = gridH;
    well.tint = 0x3d747d;
    well.tileScale.set(Math.max(1.2, geom.cell / 110));
    veil.clear();
    veil
      .rect(gx, gy, gridW, gridH)
      .fill({ color: 0x04151d, alpha: 0.86 });

    // Recess shading is behind symbols and win routes. Non-overlapping bands
    // approximate broad soft gradients without extra render filters.
    const sideDepth = Math.min(24, cell * 0.12);
    const endDepth = Math.min(48, cell * 0.24);
    const steps = 12;
    for (let reel = 0; reel < 5; reel++) {
      const reelX = gx + reel * (cell + gap);
      veil
        .rect(reelX, gy, cell, gridH)
        .fill({ color: 0x24474d, alpha: 0.12 });
      for (let step = 0; step < steps; step++) {
        const falloff = (1 - (step + 0.5) / steps) ** 2;
        const sx = (sideDepth * step) / steps;
        const sw = sideDepth / steps;
        const sy = (endDepth * step) / steps;
        const sh = endDepth / steps;
        veil
          .rect(reelX + sx, gy, sw, gridH)
          .rect(reelX + cell - sx - sw, gy, sw, gridH)
          .fill({ color: 0x020b11, alpha: 0.38 * falloff });
        veil
          .rect(reelX, gy + sy, cell, sh)
          .fill({ color: 0x01070c, alpha: 0.66 * falloff });
        veil
          .rect(reelX, gy + gridH - sy - sh, cell, sh)
          .fill({ color: 0x01070c, alpha: 0.42 * falloff });
      }
      if (reel < 4) {
        const seam = reelX + cell + gap / 2;
        veil
          .rect(reelX + cell, gy, gap, gridH)
          .fill({ color: 0x040e15, alpha: 0.78 });
        veil
          .moveTo(seam + 0.5, gy)
          .lineTo(seam + 0.5, gy + gridH)
          .stroke({ color: 0x6d8d91, alpha: 0.16, width: 1 });
      }
    }
  }

  function drawCabinet() {
    const { cell, gap, gx, gy } = geom;
    placeFrame();
    paintMaxStageSurface(maxWater, geom);
    for (let reel = 0; reel < 5; reel++) {
      const x = gx + reel * (cell + gap);
      const slot = reels[reel]!;
      slot.root.position.set(x, gy);
      slot.mask.clear();
      slot.mask.rect(0, 0, cell, cell * 3).fill(0xffffff);
    }
  }

  function placeCopy() {
    if (destroyed) return;
    title.visible = false;
  }
  function layout() {
    if (destroyed) return;
    const w = host.clientWidth || 1100,
      h = host.clientHeight || 640;
    if (animating && !resizeFollow) {
      pendingLayout = true;
      const scale = Math.min(w / geom.dw, h / geom.dh);
      world.scale.set(scale);
      world.position.set((w - geom.dw * scale) / 2, (h - geom.dh * scale) / 2);
      return; // Never destroy a moving reel strip on ResizeObserver.
    }
    geom = geomFor(w, h);
    const scale = Math.min(w / geom.dw, h / geom.dh);
    world.scale.set(scale);
    world.position.set((w - geom.dw * scale) / 2, (h - geom.dh * scale) / 2);
    pendingLayout = false;
    drawCabinet();
    paintStanding();
    for (const paint of reactionRefresh) paint();
    placeReadout();
    if (animating && resizeFollow) {
      host.dispatchEvent(new CustomEvent("kilo-relayout"));
      return;
    }
    placeCopy();
    host.dispatchEvent(new CustomEvent("kilo-relayout"));
  }

  function phaseTarget() {
    const target = host.closest("[data-testid='reel-host']") ?? host;
    return target instanceof HTMLElement ? target : host;
  }
  function restoreSymbols() {
    for (const reel of reels)
      for (const child of reel.strip.children)
        if (!child.destroyed) {
          child.alpha = 1;
          for (const item of [...child.children]) {
            if (item instanceof Sprite) restoreAuthored(item);
            if (item.label === "collector-tag") item.visible = true;
          }
        }
  }
  function placeReadout() {
    // Tiny popouts already use the immediate footer for Balance/Win/Bet.
    // Keep that footer clear; its WIN and the collector plaque retain values.
    const tiny = host.closest(".kk-shell")?.getAttribute("data-compact") === "true";
    readout.hidden = !readoutActive || tiny;
    const b = stageReadoutLayout(geom);
    const scale = world.scale.x;
    Object.assign(readout.style, {
      left: `${world.x + b.x * scale}px`, top: `${world.y + b.y * scale}px`,
      width: `${b.width * scale}px`, height: `${b.height * scale}px`,
      fontSize: `${b.labelSize * scale}px`,
    });
    readoutValue.style.fontSize = `${b.amountSize * scale}px`;
  }
  function showReadout(label: string, value: string, kind: 'local' | 'summary' = 'summary') {
    readoutLabel.textContent = label;
    readoutValue.textContent = value;
    readout.dataset.kind = kind;
    readoutActive = true;
    host.setAttribute("aria-label", `Kilo King reels. ${label}: ${value}`);
    placeReadout();
  }
  function clearPresentation() {
    readoutActive = false;
    readout.hidden = true;
    fx.clear();
    routes.clear();
    lineArt.removeChildren().forEach((child) => child.destroy());
    delete phaseTarget().dataset.payline;
    delete phaseTarget().dataset.paylineFocus;
    restoreSymbols();
  }

  function cancelWaits() {
    for (const fn of waits) fn();
    waits.clear();
  }

  function sleep(ms: number) {
    if (stopped || reduced || ms <= 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => {
        waits.delete(done);
        resolve();
      }, ms);
      const done = () => {
        window.clearTimeout(timer);
        resolve();
      };
      waits.add(done);
    });
  }

  function tween(ms: number, step: (t: number) => void) {
    if (stopped || reduced || ms <= 0) {
      step(1);
      return Promise.resolve();
    }
    const t0 = performance.now();
    return new Promise<void>((resolve) => {
      let raf = 0;
      const done = () => {
        cancelAnimationFrame(raf);
        step(1);
        resolve();
      };
      waits.add(done);
      const frame = (now: number) => {
        if (stopped) return;
        const t = Math.min(1, (now - t0) / ms);
        step(t);
        if (t < 1) raf = requestAnimationFrame(frame);
        else {
          waits.delete(done);
          resolve();
        }
      };
      raf = requestAnimationFrame(frame);
    });
  }

  function symbolSprite(reel: number, row: number) {
    const view = reels[reel]?.strip.children[row];
    const sprite = view?.children.find((child) => child instanceof Sprite);
    return sprite instanceof Sprite ? sprite : null;
  }

  type AuthoredHome = { texture: Texture; ax: number; ay: number; sx: number; sy: number; x: number; y: number; rotation: number };
  const authoredHomes = new WeakMap<Sprite, AuthoredHome>();
  function restoreAuthored(sprite: Sprite) {
    restoreArticulation(sprite);
    const home = authoredHomes.get(sprite);
    if (!home || sprite.destroyed) return;
    sprite.texture=home.texture;sprite.anchor.set(home.ax,home.ay);
    sprite.scale.set(home.sx,home.sy);sprite.position.set(home.x,home.y);sprite.rotation=home.rotation;
    authoredHomes.delete(sprite);
  }
  function paintAuthored(sprite: Sprite, asset: { clip: AuthoredClip; frames: Texture[] }, progress: number) {
    let home=authoredHomes.get(sprite);
    if(!home) {
      home={texture:sprite.texture,ax:sprite.anchor.x,ay:sprite.anchor.y,sx:sprite.scale.x,sy:sprite.scale.y,x:sprite.x,y:sprite.y,rotation:sprite.rotation};
      authoredHomes.set(sprite,home);
    }
    const {clip}=asset,[l,t,r,b]=clip.registrationBounds ?? clip.bounds,[rl,rt,rr,rb]=clip.reference.bounds;
    const physicalX=home.x+((rl+rr)/2-home.ax*clip.reference.width)*home.sx;
    const physicalY=home.y+((rt+rb)/2-home.ay*clip.reference.height)*home.sy;
    const scale=Math.min((rr-rl)*home.sx/(r-l),(rb-rt)*home.sy/(b-t));
    const index=authoredFrameAt(clip,progress),frame=clip.frames[index];
    if(!frame)return;
    sprite.texture=asset.frames[index]!;
    sprite.anchor.set((l+r)/2/frame.w,(t+b)/2/frame.h);
    sprite.position.set(physicalX,physicalY);sprite.scale.set(scale);sprite.rotation=home.rotation;
  }
  function authoredSymbolKey(cell: SplashCell | undefined) {
    if(!cell)return "";
    if(cell.s==="brick"&&cell.v!=null)return fishTier(cell.v).asset;
    const keys:Record<string,string>={"10":"sym-10",J:"sym-j",Q:"sym-q",K:"sym-k",A:"sym-a",cuffs:"sym-bobber",keys:"sym-cash-roll",lamp:"sym-reel-v8",duffel:"sym-case-v8",bars:"scatter-king",splash:"collector"};
    return keys[cell.s]??"";
  }

  function showReaction(sprite: Sprite, frames: Texture[], index: number) {
    const bust = (sprite as Sprite & {
      kkBust?: { ax: number; ay: number; scale: number; x: number; y: number };
    }).kkBust;
    sprite.texture = frames[index] ?? frames[0]!;
    if (bust) {
      sprite.anchor.set(bust.ax, bust.ay);
      sprite.scale.set(bust.scale);
      sprite.position.set(bust.x, bust.y);
      return;
    }
    const dest = (sprite as Sprite & { kkDest?: number }).kkDest;
    if (!dest) return;
    sprite.anchor.set(0.5);
    sprite.width = dest;
    sprite.height = dest;
  }

  function playReaction(
    resolveSprite: () => Sprite | null,
    frames: Texture[],
    sequence: number[],
    frameMs: number,
  ) {
    const mine = job;
    let phase = 0;
    const clip = authoredTextures.get("collector");
    const total = sequence.length * frameMs;
    const paint = () => {
      const sprite = resolveSprite();
      if (mine !== job || stopped || !sprite || sprite.destroyed) return;
      if (clip && !reduced) paintAuthored(sprite, clip, phase);
      else showReaction(sprite, frames, reactionIndex(sequence, frameMs, phase * total, reduced));
      if (!reduced) articulateArt(sprite, 'splash', phase, 'collector', 1, clip?.clip.registrationBounds ?? clip?.clip.bounds);
    };
    const ms = reduced ? 0 : turbo ? Math.round(total * 0.45) : total;
    reactionRefresh.add(paint);
    return tween(ms, (t) => {
      phase = t;
      paint();
    }).finally(() => {
      reactionRefresh.delete(paint);
      const sprite = resolveSprite();
      if (mine === job && !stopped && sprite && !sprite.destroyed) {
        restoreAuthored(sprite);
        showReaction(sprite, frames, 0);
      }
    });
  }

  const flyers = new Set<HTMLElement>();
  function clearFlyers() {
    for (const el of flyers) el.remove();
    flyers.clear();
  }
  function screenOf(x: number, y: number) {
    const global = world.toGlobal({ x, y });
    const rect = app.canvas.getBoundingClientRect();
    const sx = rect.width / Math.max(1, app.screen.width);
    const sy = rect.height / Math.max(1, app.screen.height);
    return { x: rect.left + global.x * sx, y: rect.top + global.y * sy };
  }
  function domCenter(selector: string) {
    const root = host.closest(".kk-app") ?? document;
    const rect = root.querySelector(selector)?.getBoundingClientRect();
    if (!rect || rect.width < 1 || rect.height < 1) return null;
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  function bonusLanding(flyerHeight: number) {
    const root = host.closest(".kk-app") ?? document;
    // Feature rounds land on BONUS WIN; base-game collections land on WIN.
    const numberEl =
      root.querySelector("[data-testid=bonus-win]") ??
      root.querySelector("[data-testid=last-win]");
    const number = numberEl?.getBoundingClientRect();
    const block = (
      root.querySelector(".kk-bonus-win") ?? numberEl?.closest(".sc-well")
    )?.getBoundingClientRect();
    const half = Math.max(18, flyerHeight / 2);
    const numberTop =
      number && number.height > 1
        ? number.top
        : block && block.height > 1
          ? block.bottom
          : null;
    if (numberTop == null) return null;
    return {
      x:
        block && block.width > 1
          ? block.left + block.width / 2
          : number && number.width > 1
            ? number.left + number.width / 2
            : 0,
      // Center the flyer so its bottom stays clear of the digits.
      y: numberTop - half - 16,
      numberTop,
    };
  }
  function splashAt(x: number, y: number, scale: number) {
    if (reduced || stopped) return;
    const splash = new Sprite(impactTex);
    splash.anchor.set(0.5);
    splash.position.set(x, y);
    splash.scale.set(scale * 0.65);
    splash.alpha = 0.95;
    transient.addChild(splash);
    void tween(turbo ? 180 : 320, (t) => {
      if (splash.destroyed) return;
      splash.alpha = 0.95 * (1 - t);
      splash.scale.set(scale * (0.65 + t * 0.7));
      splash.rotation = t * 0.35;
    }).then(() => {
      if (!splash.destroyed) splash.destroy();
    });
  }
  function collectionCue(
    detail: {
      index: number;
      count: number;
      mult: number;
      subtotal: number;
      completed: number;
      phase: "gather" | "bank";
      capped?: boolean;
    } | null,
  ) {
    host.dispatchEvent(
      new CustomEvent("kilo-collection", { bubbles: true, detail }),
    );
    // Presentation only: acknowledge the existing gather / transfer beats.
    // This event never owns credit, changes a hold, or touches the ledger.
    if (detail && detail.index > 0 && !stopped && !reduced) {
      if (detail.phase === 'gather' && detail.subtotal === 0)
        host.dispatchEvent(new CustomEvent('kilo-stage-action', { bubbles: true, detail: { kind: 'collect' } }));
      else if (detail.phase === 'bank' && detail.completed > 0)
        host.dispatchEvent(new CustomEvent('kilo-stage-action', { bubbles: true, detail: { kind: 'collect-bank' } }));
    }
  }
  function endMotion() {
    animating = false;
    if (pendingLayout) layout();
  }
  function mark(phase: string) {
    const target = phaseTarget();
    target.dataset.phase = phase;
    const prev = target.dataset.phaseLog ?? "";
    target.dataset.phaseLog = prev ? `${prev}|${phase}` : phase;
  }
  function portions(weights: number[], got: number, collectors: number) {
    return collectionShares(weights, got, collectors);
  }
  function hookSprite(x: number, tension: number, drop: number) {
    const hook = new Sprite(hookTex);
    const pivot = TOOL_PIVOTS.hook;
    hook.anchor.set(pivot.x / pivot.width, pivot.y / pivot.height);
    const s = Math.max(0.28, geom.cell / 430);
    hook.scale.set(s);
    hook.position.set(
      x + (1 - tension) * geom.cell * 0.08,
      geom.gy - 2 + drop * 6,
    );
    hook.rotation = (1 - tension) * 0.08;
    return hook;
  }

  async function holdReadable(ms: number) {
    if (stopped) return;
    const wait = turbo ? Math.min(ms, 480) : reduced ? Math.min(ms, 560) : ms;
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => {
        waits.delete(done);
        resolve();
      }, wait);
      const done = () => {
        window.clearTimeout(timer);
        resolve();
      };
      waits.add(done);
    });
  }

  async function ceremony(
    phase: string,
    eyebrow: string,
    value: string,
    detail: string,
    duration: number,
  ) {
    await ensureType();
    const mine = job;
    animating = true;
    mark(phase);
    if (phase === "entry") {
      resizeFollow=true;
      const banner=new Container();banner.label='dock-entry-banner';transient.addChild(banner);
      const crest=authoredTextures.get('entry-scatter-3')!;
      let arrival=0,departure=0,artProgress=0;
      const paint=()=>{
        if(banner.destroyed||mine!==job)return;
        banner.removeChildren().forEach(n=>n.destroy({children:true}));
        const width=geom.cell*5+geom.gap*4,w=width-12,artWell=Math.min(98,w*.25);
        const parts=[eyebrow,value,detail].filter(Boolean);
        const sizes=[Math.max(19,Math.min(27,geom.cell*.23)),Math.max(15,Math.min(24,geom.cell*.20)),14];
        const lines=parts.map((text,i)=>{const n=new Text({text,style:{fontFamily:i===0?DISPLAY:TEXT,fontSize:sizes[i],fontWeight:'700',fill:i===0?0xffe09b:i===1?0xfff8e9:0xa6e3d7,align:'center',wordWrap:true,wordWrapWidth:w-artWell-24}});n.anchor.set(.5,0);return n;});
        const h=Math.max(74,lines.reduce((a,n)=>a+n.height,0)+24+(lines.length-1)*5);
        const x=geom.gx+6,y=geom.gy+(geom.cell*3-h)/2;
        const impact=new Graphics();banner.addChild(impact);
        paintImpact(impact,x+w*.5,y+h*.5,w*.83,h*1.55,arrival*.96,0xffcb55,1.1,reduced);
        const ticket=new Graphics();paintEventTicket(ticket,x,y,w,h,0xffcb55);banner.addChild(ticket);
        const drawing=crest.frames[authoredFrameAt(crest.clip,reduced?1:artProgress)];
        const art=new Sprite(drawing);art.label='dock-entry-crest';art.anchor.set(.5);
        art.scale.set(Math.min((artWell-3)/drawing.width,(h+7)/drawing.height));
        art.position.set(x+artWell/2+4,y+h/2);banner.addChild(art);
        let cy=y+12;for(const n of lines){n.position.set(x+artWell+(w-artWell)/2,cy);cy+=n.height+5;banner.addChild(n);}
        const pose=featureArrivalAt(arrival,reduced);
        banner.pivot.set(x+w/2,y+h/2);
        banner.position.set(x+w/2,y+h/2+(reduced?0:h*pose.lift-departure*4));
        banner.scale.set(pose.x,pose.y);banner.alpha=1-departure;
      };
      host.addEventListener('kilo-relayout',paint);paint();
      const entrance=reduced?0:turbo?90:180,exit=reduced?0:turbo?80:120;
      const rawReading=Math.max(0,duration-entrance-exit);
      const reading=turbo?Math.min(rawReading,480):reduced?Math.min(rawReading,560):rawReading;
      const resolvedDuration=entrance+reading+exit||1;
      try {
        await tween(entrance,t=>{arrival=t;artProgress=t*entrance/resolvedDuration;paint();});
        if(mine!==job||stopped)return;
        await Promise.all([holdReadable(reading),tween(reduced?0:reading,t=>{artProgress=(entrance+t*reading)/resolvedDuration;paint();})]);
        if(mine!==job||stopped)return;
        await tween(exit,t=>{departure=t*t;artProgress=1-exit/resolvedDuration*(1-t);paint();});
      } finally {
        host.removeEventListener('kilo-relayout',paint);
        if(mine===job)resizeFollow=false;
        if(!banner.destroyed)banner.destroy({children:true});
        if(mine===job)endMotion();
      }
      return;
    }
    const group = new Container();
    transient.addChild(group);
    const { cab } = geom;
    const dim = new Graphics();
    dim.rect(0, 0, geom.dw, geom.dh).fill({ color: 0x02060c, alpha: 0.55 });
    const skin =
      phase === "entry" ? entryTex : phase === "upgrade" ? upgradeTex : modalTex;
    const modal = new Sprite(skin);
    const sc = Math.min((cab.w * 0.92) / skin.width, (cab.h * 0.72) / skin.height);
    modal.scale.set(sc);
    modal.anchor.set(0);
    modal.position.set(
      cab.x + (cab.w - skin.width * sc) / 2,
      cab.y + (cab.h - skin.height * sc) / 2,
    );
    const panelWidth = skin.width * sc;
    const panelHeight = skin.height * sc;
    const entry = phase === "entry";
    const portraitBoard = entry && geom.cab.w < 680;
    if (portraitBoard) {
      modal.destroy();
      const parts = [eyebrow, ...value.split(" · "), detail].filter((line) => line.length > 0);
      const panelW = Math.min(geom.cab.w * 0.9, 320);
      const wrap = panelW - 28;
      const sizes = [22, 26, 18, 15];
      const colors = [0xffe09b, 0xfff6dd, 0xfff6dd, 0xd7ecf2];
      const nodes = parts.map((text, index) => {
        const node = new Text({
          text,
          style: {
            fill: colors[index] ?? 0xd7ecf2,
            fontFamily: index === 0 ? DISPLAY : TEXT,
            fontSize: sizes[index] ?? 15,
            fontWeight: index === 0 ? "600" : "700",
            align: "center",
            wordWrap: true,
            wordWrapWidth: wrap,
          },
        });
        node.anchor.set(0.5, 0);
        return node;
      });
      const gap = 6;
      const contentH =
        nodes.reduce((sum, item) => sum + item.height, 0) + gap * Math.max(0, nodes.length - 1);
      const panelH = Math.min(geom.cab.h * 0.92, contentH + 32);
      const bx = geom.cab.x + (geom.cab.w - panelW) / 2;
      const by = geom.cab.y + (geom.cab.h - panelH) / 2;
      const board = new Graphics()
        .roundRect(bx, by, panelW, panelH, 12)
        .fill({ color: 0x071820, alpha: 0.94 })
        .stroke({ color: 0xc9a15a, width: 2 });
      const content = new Container();
      let textY = by + Math.max(14, (panelH - contentH) / 2);
      for (const node of nodes) {
        node.position.set(bx + panelW / 2, textY);
        textY += node.height + gap;
        content.addChild(node);
      }
      group.addChild(dim, board, content);
      title.visible = false;
      board.alpha = 0;
      content.alpha = 0;
      const fadeIn = reduced ? 0 : 220;
      const fadeOut = reduced ? 0 : 180;
      await tween(fadeIn, (t) => {
        if (dim.destroyed) return;
        dim
          .clear()
          .rect(0, 0, geom.dw, geom.dh)
          .fill({ color: 0x02060c, alpha: 0.35 + 0.25 * t });
        board.alpha = t;
        content.alpha = t;
      });
      if (!stopped) await holdReadable(Math.max(0, duration - fadeIn - fadeOut));
      if (!stopped && fadeOut > 0 && !group.destroyed)
        await tween(fadeOut, (t) => {
          if (group.destroyed) return;
          const a = 1 - t;
          dim.alpha = a;
          board.alpha = a;
          content.alpha = a;
        });
      title.visible = false;
      if (!group.destroyed) group.destroy({ children: true });
      if (mine === job) endMotion();
      return;
    }
    const wrap = panelWidth * (entry ? 0.48 : 0.7);
    const content = new Container();
    content.position.copyFrom(modal.position);
    const label = (text: string, fontSize: number, color: number, family = TEXT) => {
      const node = new Text({
        text,
        style: {
          fill: color,
          fontFamily: family,
          fontSize,
          fontWeight: family === DISPLAY ? "600" : "700",
          align: "center",
          wordWrap: true,
          wordWrapWidth: wrap,
        },
      });
      node.anchor.set(0.5, 0);
      return node;
    };
    const headline = label(
      eyebrow,
      Math.max(14, Math.min(entry ? 22 : 26, panelWidth * (entry ? 0.03 : 0.045))),
      0xffe09b,
      DISPLAY,
    );
    const valueText = label(
      value,
      Math.max(16, Math.min(entry ? 30 : 42, panelWidth * (entry ? 0.046 : 0.074))),
      0xfff6dd,
    );
    const detailText = detail.trim()
      ? label(
          detail,
          Math.max(14, Math.min(entry ? 16 : 19, panelWidth * (entry ? 0.026 : 0.035))),
          0xd7ecf2,
        )
      : null;
    const gap = Math.max(4, Math.min(10, panelHeight * (entry ? 0.018 : 0.032)));
    const labels = [headline, valueText, detailText].filter((item) => item != null);
    const wellTop = panelHeight * (entry ? 0.36 : 0.34);
    const wellBottom = panelHeight * (entry ? 0.64 : 0.78);
    const wellH = wellBottom - wellTop;
    let guard = 0;
    while (
      labels.reduce((n, item) => n + item.height, 0) + gap * 2 > wellH &&
      guard < 14
    ) {
      guard += 1;
      for (const item of labels) {
        const size = Number(item.style.fontSize);
        item.style.fontSize = Math.max(13, size - 1);
      }
    }
    const totalHeight =
      labels.reduce((n, item) => n + item.height, 0) + gap * 2;
    let textY = wellTop + Math.max(0, wellH - totalHeight) / 2;
    for (const item of labels) {
      item.position.set(panelWidth / 2, textY);
      textY += item.height + gap;
      content.addChild(item);
    }
    group.addChild(dim, modal, content);
    title.visible = false;
    modal.alpha = 0;
    content.alpha = 0;
    const fadeIn = reduced ? 0 : 220;
    const fadeOut = reduced ? 0 : 180;
    await tween(fadeIn, (t) => {
      if (dim.destroyed) return;
      dim
        .clear()
        .rect(0, 0, geom.dw, geom.dh)
        .fill({ color: 0x02060c, alpha: 0.35 + 0.25 * t });
      modal.alpha = t;
      content.alpha = t;
    });
    if (!stopped) await holdReadable(Math.max(0, duration - fadeIn - fadeOut));
    if (!stopped && fadeOut > 0 && !group.destroyed)
      await tween(fadeOut, (t) => {
        if (group.destroyed) return;
        const a = 1 - t;
        dim.alpha = a;
        modal.alpha = a;
        content.alpha = a;
      });
    title.visible = false;
    if (!group.destroyed) group.destroy({ children: true });
    if (mine === job) endMotion();
  }

  async function spinTo(
    grid: SplashCell[][],
    only: number[] | null,
    pace: "ordinary" | "landed" = "ordinary",
  ) {
    const mine = ++job;
    clearPresentation();
    clearFlyers();
    transient
      .removeChildren()
      .forEach((child) => child.destroy({ children: true }));
    animating = true;
    if(!only)host.dispatchEvent(new CustomEvent('kilo-stage-action',{bubbles:true,detail:{kind:'spin'}}));
    if (!only) locks.clear();
    const active = only ?? [0, 1, 2, 3, 4];
    if (reduced || stopped) {
      if (mine !== job) return;
      board = grid.map((col) => col.map((cell) => ({ ...cell })));
      animating = false;
      paintStanding();
      return;
    }
    const { cell } = geom;
    // Presentation only. Two visible scatters in the first four reels extend
    // every reel that is still spinning. Extra symbols are inserted above the
    // window so the strip never reverses. A partial respin (locked crowns)
    // keeps the short cycle and only moves the free reels.
    const timing = SPIN_TIMING[speedMode];
    const anticipate = timing.anticipation && pace === "landed" && !reduced && only == null;
    const activeSet = new Set(active);
    let lockedEarly = 0;
    for (let reel = 0; reel < 4; reel++) {
      if (!activeSet.has(reel) && board[reel]?.some((c) => c.s === "bars")) lockedEarly += 1;
    }
    type Spin = {
      reel: number;
      strip: Container;
      pad: number;
      startY: number;
      endY: number;
      delay: number;
      rate: number;
      progress: number;
      phase: "spin" | "crawl" | "settle" | "done";
      velocity: number;
      cruiseVelocity: number;
      crawlFrom: number;
      crawlTo: number;
      crawlMs: number;
      crawlT: number;
      crawlInitialVelocity: number;
      frame: number;
      noted: boolean;
      landedAt: number;
      landedArt: { sprite: Sprite; x: number; y: number; sym: string }[];
    };
    const spins: Spin[] = active.map((reel, order) => {
      const travel = timing.travel + order;
      const pad = 3;
      const strip = reels[reel]!.strip;
      const seq: SplashCell[] = [];
      for (let i = 0; i < pad; i++) seq.push(passer(reel, i));
      for (let row = 0; row < 3; row++) seq.push(grid[reel]![row]!);
      for (let i = 0; i < travel; i++) seq.push(passer(reel, pad + i));
      for (let row = 0; row < 3; row++) seq.push(board[reel]![row]!);
      for (let i = 0; i < pad; i++) seq.push(passer(reel, 100 + i));
      strip
        .removeChildren()
        .forEach((child) => child.destroy({ children: true }));
      seq.forEach((cellData, index) => {
        const view = cellView(cellData, cell);
        view.pivot.set(cell / 2, cell / 2);
        view.position.set(cell / 2, index * cell + cell / 2);
        strip.addChild(view);
      });
      const endIndex = pad;
      const startIndex = pad + 3 + travel;
      const startY = -startIndex * cell;
      const endY = -endIndex * cell;
      strip.position.set(0, startY);
      const ordinary = timing.duration + order * timing.stagger;
      return {
        reel,
        strip,
        pad,
        startY,
        endY,
        delay: order * timing.delay,
        rate: 1 / ordinary,
        progress: 0,
        phase: "spin",
        velocity: 0,
        cruiseVelocity: ((endY - startY) / ordinary) * reelTravelAt(0.4).velocity,
        crawlFrom: startY,
        crawlTo: endY,
        crawlMs: turbo ? 560 : 1400,
        crawlT: 0,
        crawlInitialVelocity: 0,
        frame: 0,
        noted: false,
        landedAt: 0,
        landedArt: [],
      };
    });
    const scatterReels: number[] = [];
    let teaseLive = false;
    const target = phaseTarget();
    target.dataset.anticipation = "off";
    if (!reduced) whirStart();
    let tickAt = 0;
    let tickStep = 0;
    const pulses: { reel: number; at: number; scatter: boolean; authored?: {clip: AuthoredClip; frames: Texture[]} }[] = [];
    let audioClosed = false;
    let lockFlash = only ? 1 : 0;
    const earlyCount = () =>
      lockedEarly + scatterReels.filter((reel) => reel < 4).length;
    const closeAudio = () => {
      if (audioClosed) return;
      audioClosed = true;
      const hit = lockedEarly + scatterReels.length >= 3;
      if (teaseLive) {
        target.dataset.anticipation = hit ? "hit" : "miss";
        teaseResolve(hit);
      }
      whirStop();
    };
    const placeStrip = (spin: Spin) => {
      const kids = spin.strip.children;
      for (let i = 0; i < kids.length; i++) {
        kids[i]!.position.set(cell / 2, i * cell + cell / 2);
      }
    };
    const armCrawl = (spin: Spin, slot: number) => {
      const top = -spin.strip.position.y / cell;
      const cellsLeft = top - spin.pad;
      const extraCells = turbo ? 6 : 10;
      const budget = (turbo ? 560 : 1400) + slot * (turbo ? 80 : 150);
      if (cellsLeft > extraCells * 0.45) {
        const insertAt = Math.max(spin.pad + 3, Math.floor(top));
        if (top - insertAt > 0.2) {
          for (let i = 0; i < extraCells; i++) {
            const view = cellView(passer(spin.reel, 400 + slot * 16 + i), cell);
            view.pivot.set(cell / 2, cell / 2);
            spin.strip.addChildAt(view, insertAt);
          }
          placeStrip(spin);
          spin.strip.position.y -= extraCells * cell;
          spin.startY = Math.min(spin.startY, spin.strip.position.y);
        }
      } else {
        // Already at the result. Keep scrolling forward through fresh passers,
        // then land a copy of the same result. Never rewind.
        const shift = 3 + extraCells;
        for (let i = 0; i < extraCells; i++) {
          const view = cellView(passer(spin.reel, 500 + slot * 16 + i), cell);
          view.pivot.set(cell / 2, cell / 2);
          spin.strip.addChildAt(view, 0);
        }
        const column = grid[spin.reel] ?? [];
        for (let row = 2; row >= 0; row--) {
          const view = cellView(column[row] ?? { s: "10" }, cell);
          view.pivot.set(cell / 2, cell / 2);
          spin.strip.addChildAt(view, 0);
        }
        placeStrip(spin);
        spin.strip.position.y -= shift * cell;
        spin.pad = 0;
        spin.endY = 0;
        spin.startY = Math.min(spin.startY, spin.strip.position.y);
      }
      spin.phase = "crawl";
      spin.crawlFrom = spin.strip.position.y;
      spin.crawlTo = spin.endY;
      spin.crawlMs = budget;
      spin.crawlT = 0;
      spin.crawlInitialVelocity =
        (spin.velocity * budget) / Math.max(1, spin.crawlTo - spin.crawlFrom);
    };
    const streakMax = Math.min(3.5, cell * (turbo ? 0.032 : 0.025));
    const lockMs = speedMode === "super" ? 70 : turbo ? 110 : 170;
    const scatterTailMs = speedMode === "super" ? 100 : turbo ? 180 : 300;
    const noteLand = (spin: Spin, now: number) => {
      if (spin.noted) return;
      spin.noted = true;
      const isScatter = !!grid[spin.reel]?.some((c) => c.s === "bars");
      if (isScatter) {
        scatterReels.push(spin.reel);
        pulses.push({ reel: spin.reel, at: now, scatter: true, authored: authoredTextures.get("scatter-king") });
      }
      landStop(isScatter);
      const early = earlyCount();
      if (isScatter && anticipate && spin.reel < 4 && early === 2 && !teaseLive) {
        teaseLive = true;
        target.dataset.anticipation = "build";
        teaseBegin();
        let slot = 0;
        for (const other of spins) {
          if (other.phase !== "spin") continue;
          armCrawl(other, slot);
          slot += 1;
        }
      }
      if (lockedEarly + scatterReels.length >= 3 && teaseLive)
        target.dataset.anticipation = "hit";
    };
    await new Promise<void>((resolve) => {
      let raf = 0;
      const finish = () => {
        cancelAnimationFrame(raf);
        waits.delete(finish);
        for (const spin of spins) {
          for (const art of spin.landedArt) {
            if (!art.sprite.destroyed) { restoreAuthored(art.sprite);art.sprite.scale.set(art.x, art.y); }
          }
        }
        clearStreak();
        closeAudio();
        resolve();
      };
      waits.add(finish);
      const clock = new Map<Spin, number>();
      const dtOf = (spin: Spin, now: number) => {
        const prev = clock.get(spin) ?? now;
        clock.set(spin, now);
        return Math.max(0, now - prev);
      };
      let landedNow = false;
      const lockReel = (spin: Spin, now: number) => {
        spin.phase = "settle";
        spin.landedAt = now;
        spin.velocity = 0;
        spin.strip.position.y = spin.endY;
        // The recorded three cells are already at their exact stopping point.
        // Only their illustration compresses; labels and containers stay fixed.
        spin.landedArt = [0, 1, 2].flatMap((row) => {
          const view = spin.strip.children[spin.pad + row];
          const sprite = view?.children.find((child) => child instanceof Sprite);
          return sprite instanceof Sprite
            ? [{ sprite, x: sprite.scale.x, y: sprite.scale.y, sym: grid[spin.reel]?.[row]?.s ?? '' }]
            : [];
        });
        setStreak(spin.reel, 0);
        noteLand(spin, now);
        landedNow = true;
      };
      const t0 = performance.now();
      const run = (now: number) => {
        if (stopped || mine !== job) {
          finish();
          return;
        }
        let pending = false;
        let building = false;
        landedNow = false;
        try {
        for (const spin of spins) {
          if (now < t0 + spin.delay) {
            pending = true;
            continue;
          }
          if (spin.phase === "done") continue;
          const dt = dtOf(spin, now);
          if (spin.phase === "settle") {
            const t = Math.min(1, (now - spin.landedAt) / lockMs);
            const pose = reelLockPose(t);
            if (spin.frame > 0) spin.frame = Math.max(0, 1 - t);
            for (const art of spin.landedArt) {
              if (!art.sprite.destroyed) {
                art.sprite.scale.set(art.x * pose.x, art.y * pose.y);
                articulateArt(art.sprite, art.sym, t, 'land');
              }
            }
            if (t >= 1) spin.phase = "done";
            else pending = true;
            continue;
          }
          if (spin.phase === "spin") {
            spin.progress = Math.min(1, spin.progress + spin.rate * dt);
            const profile = reelTravelAt(spin.progress);
            spin.strip.position.y = spin.startY + (spin.endY - spin.startY) * profile.progress;
            spin.velocity = (spin.endY - spin.startY) * profile.velocity * spin.rate;
            if (spin.progress < 1) {
              setStreak(spin.reel, profile.speed * streakMax);
              pending = true;
              continue;
            }
            lockReel(spin, now);
            continue;
          } else if (spin.phase === "crawl") {
            spin.crawlT += dt;
            const u = Math.min(1, spin.crawlT / Math.max(1, spin.crawlMs));
            const profile = anticipationAt(u, spin.crawlInitialVelocity);
            spin.strip.position.y =
              spin.crawlFrom + (spin.crawlTo - spin.crawlFrom) * profile.progress;
            spin.velocity =
              ((spin.crawlTo - spin.crawlFrom) / Math.max(1, spin.crawlMs)) * profile.velocity;
            spin.frame = Math.min(1, spin.frame + dt / 120);
            if (u < 1) {
              setStreak(spin.reel, Math.min(1, spin.velocity / spin.cruiseVelocity) * streakMax);
              pending = true;
              building = true;
              continue;
            }
            lockReel(spin, now);
            continue;
          }
        }
        } catch (error) {
          console.error("spin-loop", error);
          finish();
          return;
        }
        if (lockFlash > 0) {
          lockFlash = Math.max(0, lockFlash - 16 / 200);
          locks.alpha = 0.35 + 0.65 * (1 - lockFlash);
        }
        const teasing = spins.some((spin) => spin.phase === "crawl" || spin.frame > 0.02);
        for (let reel = 0; reel < reels.length; reel++) {
          const spin = spins.find((item) => item.reel === reel);
          const scatterHere =
            !!grid[reel]?.some((c) => c.s === "bars") && !!spin && spin.phase !== "spin" && spin.phase !== "crawl";
          const bright = !teasing || !spin || spin.phase === "crawl" || spin.frame > 0.2 || scatterHere;
          reels[reel]!.strip.alpha = bright ? 1 : 0.82;
        }
        fx.clear();
        for (const spin of spins) {
          if (spin.frame <= 0.02) continue;
          const reelX = geom.gx + spin.reel * (cell + geom.gap);
          const arm = Math.min(18, cell * .22);
          // Real landed scatters arm this treatment. Crisp corner brackets
          // stay inside the reel; no pulsing box spills over adjacent columns.
          for (const dx of [0, 1]) for (const dy of [0, 1]) {
            const x=reelX+(dx?cell-2:2),y=geom.gy+(dy?cell*3-2:2);
            fx.moveTo(x+(dx?-arm:arm),y).lineTo(x,y).lineTo(x,y+(dy?-arm:arm));
          }
          fx.stroke({width:2,color:0xffe3a0,alpha:spin.frame});
        }
        for (const pulse of pulses) {
          const age = (now - pulse.at) / (pulse.scatter ? scatterTailMs : lockMs);
          if(pulse.authored) {
            const landed=spins.find(s=>s.reel===pulse.reel)?.landedArt??[];
            grid[pulse.reel]?.forEach((c,row)=>{
              const art=landed[row];
              if(c.s!=="bars"||!art||art.sprite.destroyed)return;
              if(age>=1)restoreAuthored(art.sprite);
              else { art.sprite.scale.set(art.x,art.y);paintAuthored(art.sprite,pulse.authored!,age); }
            });
          }
          if (age >= 1) continue;
          const reelX = geom.gx + pulse.reel * (cell + geom.gap);
          fx.rect(reelX + 2, geom.gy + 2, cell - 4, cell * 3 - 4).stroke({
            width: pulse.scatter ? 2.5 : 1.5,
            color: pulse.scatter ? 0xfff1b8 : 0xffd56a,
            alpha: (1 - age) * (pulse.scatter ? 1 : 0.8),
          });
        }
        if (building && !landedNow && now - tickAt > (turbo ? 120 : 160)) {
          scatterBuild(tickStep);
          tickStep += 1;
          tickAt = now;
        }
        // Stop the motor at the final lock, but let the art and crown edge
        // finish their short landing response before the next presentation.
        if (!spins.some((spin) => spin.phase === "spin" || spin.phase === "crawl")) closeAudio();
        const landing = spins.some((spin) => spin.phase === "settle");
        const tail = pulses.some((pulse) => now - pulse.at < (pulse.scatter ? scatterTailMs : lockMs));
        if (pending || landing || tail) raf = requestAnimationFrame(run);
        else finish();
      };
      raf = requestAnimationFrame(run);
    });
    if (mine !== job) return;
    for (const reel of reels) reel.strip.alpha = 1;
    locks.alpha = 1;
    board = grid.map((col) => col.map((cellData) => ({ ...cellData })));
    animating = false;
    if (pendingLayout) layout();
    else paintStanding();
    fx.clear();
  }

  function cellCenter(reel: number, row: number) {
    const { cell, gap, gx, gy } = geom;
    return {
      x: gx + reel * (cell + gap) + cell / 2,
      y: gy + row * cell + cell / 2,
    };
  }

  async function burstWin(line: SplashLine, sound = true, extraLines: SplashLine[] = [], preloaded = false) {
    const cells = [...new Map([line,...extraLines].flatMap(winningCells).map(p=>[`${p.reel}:${p.row}`,p])).values()];
    const tier: 0 | 1 | 2 =
      line.pay >= stake * 15 ? 2 : line.pay >= stake * 4 ? 1 : 0;
    if (sound) winSting(tier);
    if (reduced || stopped || !cells.length) return;
    const views: {
      sprite: Sprite;
      row: number;
      reel: number;
      sym: string;
      x: number;
      y: number;
      rotation: number;
      authored?: { clip: AuthoredClip; frames: Texture[] };
    }[] = [];
    for (const spot of cells) {
      const sprite = symbolSprite(spot.reel, spot.row);
      if (sprite && !sprite.destroyed) {
        views.push({
          sprite,
          row: spot.row,
          reel: spot.reel,
          sym: board[spot.reel]?.[spot.row]?.s ?? line.s,
          x: sprite.scale.x,
          y: sprite.scale.y,
          rotation: sprite.rotation,
          authored: authoredTextures.get(authoredSymbolKey(board[spot.reel]?.[spot.row])),
        });
      }
    }
    // One authored response, then restore the exact home texture/placement.
    // Values and the enclosing cell never take part in the reaction.
    const ms = speedMode === "super" ? 130 : turbo ? 220 : tier === 2 ? 560 : tier === 1 ? 420 : 360;
    try {
      await tween(ms, (t) => {
        for (const item of views) {
          // A resize may repaint the standing cells. Rebind to their artwork,
          // retaining the new layout's home scale instead of a stale transform.
          if (item.sprite.destroyed) {
            const sprite = symbolSprite(item.reel, item.row);
            if (!sprite || sprite.destroyed) continue;
            item.sprite = sprite;
            item.x = sprite.scale.x;
            item.y = sprite.scale.y;
            item.rotation = sprite.rotation;
          }
          const delay = item.reel / 4 * .16;
          const phase = Math.max(0, Math.min(1, (t - delay) / (1 - delay)));
          const p = preloaded ? .19 + phase * .81 : phase;
          if(item.authored) paintAuthored(item.sprite,item.authored,p);
          else {
            const pose = symbolWinPose(item.sym, p, tier);
            item.sprite.scale.set(item.x * pose.scale, item.y * pose.scale);
            item.sprite.rotation = item.rotation + pose.rotation;
          }
          articulateArt(item.sprite, item.sym, p, 'hit', 1 + tier * .1,
            item.authored?.clip.registrationBounds ?? item.authored?.clip.bounds);
        }
      });
    } finally {
      for (const item of views) {
        if (item.sprite.destroyed) continue;
        restoreAuthored(item.sprite);
        item.sprite.scale.set(item.x, item.y);
        item.sprite.rotation = item.rotation;
      }
    }
  }

  const featureEffects = createFeatureEffects({
    host, world, geom:()=>geom, cell:cellView, stake:()=>stake,
    pace:()=>({speed:speedMode,reduced}), tween, hold:holdReadable,
    live:()=>!stopped&&!destroyed, readout:showReadout, screen:screenOf, landing:bonusLanding,
    bankCue:(value,capped)=>{collectionCue({phase:'bank',index:0,count:1,mult:1,subtotal:value,completed:value,capped});host.dispatchEvent(new CustomEvent('kilo-earned-win',{bubbles:true,detail:{visibleAward:value}}));},
  });
  const featureResponseHomes = new Map<Sprite, {x:number;y:number;rotation:number}>();
  const restoreFeatureResponse = () => {
    for (const [sprite,home] of featureResponseHomes) if (!sprite.destroyed) {
      restoreAuthored(sprite); sprite.scale.set(home.x,home.y); sprite.rotation=home.rotation;
    }
    featureResponseHomes.clear();
  };
  const reelFeatureEffects = createReelFeatureEffects({
    host, world, under: lineArt, geom: () => geom, cell: cellView, stake: () => stake,
    pace: () => ({ speed: speedMode, reduced }), tween, hold: holdReadable,
    live: () => !stopped && !destroyed, readout: showReadout, screen: screenOf, landing: bonusLanding,
    show: grid => { board = grid.map(col => col.map(c => ({ ...c }))); paintStanding(); },
    collect: spin => scene.collect(spin), highlight: (lines, onLine) => scene.highlight(lines, onLine),
    cue: featureCue,
    respond: (spots, progress) => {
      if (progress === null || progress >= 1 || reduced) { restoreFeatureResponse(); return; }
      for (const spot of spots) {
        if (hiddenVsReels.has(spot.reel)) continue;
        const sprite=symbolSprite(spot.reel,spot.row); if (!sprite || sprite.destroyed) continue;
        if (!featureResponseHomes.has(sprite)) featureResponseHomes.set(sprite,{x:sprite.scale.x,y:sprite.scale.y,rotation:sprite.rotation});
        const home=featureResponseHomes.get(sprite)!,cell=board[spot.reel]?.[spot.row],authored=authoredTextures.get(authoredSymbolKey(cell));
        if (authored) paintAuthored(sprite,authored,progress);
        else { const pose=symbolWinPose(cell?.s??'',progress,1);sprite.scale.set(home.x*pose.scale,home.y*pose.scale);sprite.rotation=home.rotation+pose.rotation; }
        articulateArt(sprite,cell?.s??'',progress,'hit',1.1,authored?.clip.registrationBounds??authored?.clip.bounds);
      }
    },
    conceal: indices => {
      hiddenVsReels = new Set(indices);
      reels.forEach((reel, index) => { reel.strip.visible = !hiddenVsReels.has(index); });
    },
    focus: spots => {
      if (!spots) restoreFeatureResponse();
      const active = new Set(spots?.map(p => `${p.reel}:${p.row}`));
      reels.forEach((reel,ri) => reel.strip.children.forEach((child,row) => {
        if (!child.destroyed) child.alpha = !spots || active.has(`${ri}:${row}`) ? 1 : .45;
      }));
    },
    bankCue: (value, capped) => {
      collectionCue({ phase: 'bank', index: 0, count: 1, mult: 1, subtotal: value, completed: value, capped });
      host.dispatchEvent(new CustomEvent('kilo-earned-win', { bubbles: true, detail: { visibleAward: value } }));
    },
  });
  const scene: ReelScene = {
    setBoatStage(active) {
      // The illustrated card owns coverage. Keep the valid underlying strips
      // and their original geometry visible everywhere outside that card.
      setMaxStageVisibility(reelInterior, false);
      maxWater.visible = false;
      host.setAttribute('aria-label', active ? 'Kilo King Getaway reel card' : 'Kilo King reels');
    },
    setFeatureState(event, phase) {
      featureEffects.set(event?.reel ? null : event, phase);
      reelFeatureEffects.set(event?.reel ? event : null, phase);
    },
    async reelFeatureStep(event, callbacks) {
      if (event.reel?.type === 'binary') {
        // The director has just stopped the one recorded reel spin. The
        // horizontal card now presents its outcome without starting a second spin.
        stopped = false; job += 1; clearPresentation(); clearFlyers();
      }
      const mine = job; animating = true; resizeFollow = true; mark('feature');
      try { await reelFeatureEffects.step(event, callbacks); }
      finally { if (mine === job) { restoreSymbols(); resizeFollow = false; endMotion(); } }
    },
    async featureStep(event) {
      const mine=job;animating=true;resizeFollow=true;mark('feature');
      const focus=()=>{if(event.kind==='route')reels.forEach((reel,index)=>reel.strip.children.forEach(child=>child.alpha=index===event.route?1:.42));};
      focus();host.addEventListener('kilo-relayout',focus);
      try{await featureEffects.step(event);}finally{host.removeEventListener('kilo-relayout',focus);if(mine===job){restoreSymbols();resizeFollow=false;endMotion();}}
    },
    async featureIntro(round) {
      bonusEnter(round.mode, round.feature);
      host.dispatchEvent(new CustomEvent('kilo-stage-action',{bubbles:true,detail:{kind:'entry'}}));
      if (round.version === 4) { await reelFeatureEffects.intro(round); return; }
      const names={dock:'One marked package survives one more spin',yacht:'Lock cargo · dispatch shipments · improve cargo quality',yacht25:'Reel one starts with a winning ×25 VS',route:'One column per spin · deliver every five pickups',getaway:'Load three cases · clear three checkpoints · extract'};
      await ceremony('entry',FEATURE_NAMES[round.feature!],round.feature==='getaway'?'3 cases · 3 checkpoints':`${round.awarded} free spins`,names[round.feature!],turbo?1100:2200);
    },
    setStake(n) {
      stake = n;
    },
    setPace(nextTurbo, nextReduced, speed) {
      speedMode = speed ?? (nextTurbo ? "turbo" : "normal");
      turbo = speedMode !== "normal";
      reduced = nextReduced;
      reelFeatureEffects.refreshMotion();
      setAudioTurbo(nextTurbo);
    },
    setMood(next) {
      host.dispatchEvent(
        new CustomEvent("kilo-mood", {
          bubbles: true,
          detail: { mood: next },
        }),
      );
    },
    setCopy(next) {
      title.text = next;
      host.dataset.event = next;
      host.setAttribute("aria-label", `Kilo King reels. ${next}`);
      placeCopy();
    },
    armPreview(kind) {
      const target = phaseTarget();
      target.dataset.preview = kind;
      target.dataset.phase = "board";
    },
    // The single HTML HUD owns round totals and collector progress.
    setTally() {},
    setMeter(wilds) {
      meterWilds = wilds;
    },
    setLocks(reelsToLock) {
      locks.clear();
      const { cell, gap, gx, gy } = geom;
      for (const reel of reelsToLock) {
        const x = gx + reel * (cell + gap);
        locks.roundRect(x - 4, gy - 4, cell + 8, cell * 3 + 8, 10).fill({
          color: 0x59d8d4,
          alpha: 0.1,
        });
        locks.roundRect(x - 4, gy - 4, cell + 8, cell * 3 + 8, 10).stroke({
          width: 3,
          color: 0x7ee7ff,
          alpha: 0.92,
        });
      }
    },
    async spinTo(grid, only, pace) {
      stopped = false;
      await spinTo(grid, only, pace);
    },
    async catchRespin(run,grid) {
      let cancelled=false;
      const cancel=()=>{cancelled=true;};
      const startJob=job;
      animating=true;resizeFollow=true;
      // Skip invokes show(), which increments job. A respin increments it once
      // itself; capture that expected generation so a restored board cannot
      // accidentally resume the pending animation.
      let expectedJob=startJob;
      try {
        await presentCatchRespin({host,world,geom:()=>geom,cell:cellView,
          pace:()=>({speed:speedMode,reduced}),tween,
          live:()=>!cancelled&&!destroyed&&!stopped&&job===expectedJob,
          cue:name=>featureCue(name==='hookCast'?'reelPull':name==='hookCatch'?'vsLatch':'boatCoast'),
          spin:async result=>{expectedJob=job+1;await spinTo(result,null,'ordinary');},
        },run,grid);
      } finally {cancel();resizeFollow=false;endMotion();}
    },
    show(grid) {
      host.dispatchEvent(new CustomEvent('kilo-stage-action',{bubbles:true,detail:{kind:'settle'}}));
      featureEffects.cancel();
      reelFeatureEffects.cancel();
      collectionCue(null);
      job += 1;
      animating = false;
      resizeFollow = false;
      stopped = true;
      cancelWaits();
      board = grid.map((col) => col.map((cell) => ({ ...cell })));
      paintStanding();
      clearPresentation();
      locks.clear();
      clearFlyers();
      transient.removeChildren().forEach((c) => c.destroy({ children: true }));
      if (pendingLayout) layout();
      stopped = false;
    },
    async highlight(lines, onLineStart) {
      clearPresentation();
      if (!lines.length || stopped) return;
      mark("line");animating=true;resizeFollow=true;
      const target=phaseTarget(),total=lines.reduce((sum,line)=>sum+line.pay,0);
      target.dataset.payline=lines.map(line=>`${line.n}x${line.s}=${line.pay}@${winningCells(line).map(p=>`${p.reel}.${p.row}`).join("-")}`).join("|");
      const cells=[...new Map(lines.flatMap(winningCells).map(p=>[`${p.reel}:${p.row}`,p])).values()];
      const localWin=createWinNumeral(money(total),Math.max(23,geom.cell*.50));
      localWin.anchor.set(.5);transient.addChild(localWin);
      const amountsRoot=new Container();transient.addChild(amountsRoot);
      const components=createConnectionAmounts(amountsRoot,lines.map(line=>({pay:line.pay,spots:winningCells(line)})));
      let trace=0,response=0,alpha=1,credited=false;
      const publish=()=>{
        if(credited||stopped)return;credited=true;
        lines.forEach((line,index)=>onLineStart?.(line,index));
        host.dispatchEvent(new CustomEvent('kilo-earned-win',{bubbles:true,detail:{visibleAward:total}}));
      };
      const paint=()=>{
        if(stopped||localWin.destroyed)return;
        localWin.style.fontSize=Math.max(23,geom.cell*.50);
        localWin.style.stroke={color:WIN_TYPE.ink,width:Math.max(2,Number(localWin.style.fontSize)*.055)};
        const anchor=connectionAnchor(cells,geom,localWin.width,localWin.height);
        localWin.position.set(anchor.x,anchor.y);localWin.alpha=trace>=1?alpha*(reduced||lines.length===1?1:Math.max(0,Math.min(1,(response-.27)/.48))):0;
        const stamped=impactStamp(response,reduced);
        localWin.scale.set(stamped.x,stamped.y);localWin.rotation=stamped.turn*.5;
        components.paint(geom,trace,response,alpha,anchor,reduced);
        routes.clear();fx.clear();
        lines.forEach((line,index)=>{
          if(!connectionTraceIndices(lines.map(item=>({pay:item.pay,spots:winningCells(item)}))).has(index))return;
          const points=winningCells(line).map(p=>cellCenter(p.reel,p.row));
          const stagger=index/Math.max(1,lines.length-1)*.28;
          paintWinConnection(routes,fx,points,geom.cell,reduced?1:Math.max(0,Math.min(1,(trace-stagger)/(1-stagger))),response,
            {append:true,alpha,reduced,intensity:total>=stake*10?1.4:.7});
        });
        const winning=new Set(cells.map(p=>`${p.reel}:${p.row}`));
        reels.forEach((reel,ri)=>reel.strip.children.forEach((child,row)=>{
          if(!child.destroyed)child.alpha=winning.has(`${ri}:${row}`)?1:.62;
        }));
        if (!reduced && trace < 1) for (const spot of cells) {
          const sprite = symbolSprite(spot.reel, spot.row);
          if (!sprite || sprite.destroyed) continue;
          // The connection loads each drawing as it reaches that reel. The
          // existing reveal/bank clocks stay unchanged; contact releases this
          // exact ready pose instead of starting another isolated animation.
          const arrived = Math.max(0, Math.min(1, trace * 5 - spot.reel));
          articulateArt(sprite, board[spot.reel]?.[spot.row]?.s ?? '', arrived * .19);
        }
      };
      const onLayout=()=>paint();host.addEventListener('kilo-relayout',onLayout);
      try {
        // The on-board amount owns the result. A second detached caption was
        // competing with the same number and obscuring the source-to-WIN flow.
        host.setAttribute('aria-label',`Kilo King reels. ${lines.length} winning connections: ${money(total)}`);
        target.dataset.paylineFocus='board';paint();
        const clock=connectionClock(lines.length,total>=stake*5);
        await tween(reduced?0:turbo?160:clock.trace,t=>{trace=t;paint();});
        if(stopped)return;trace=1;publish();
        if(clock.read&&!reduced)await holdReadable(turbo?90:clock.read);
        if(stopped)return;
        await Promise.all([
          burstWin({...lines[0]!,pay:total},true,lines.slice(1),true),
          (async()=>{
            await tween(reduced?0:turbo?120:clock.reveal,t=>{response=t;paint();});
            if(stopped)return;response=1;paint();
            await holdReadable(reduced?240:turbo?170:total>=stake*5?400:240);
            if(!stopped)await tween(reduced?0:turbo?80:140,t=>{alpha=1-t;paint();});
          })(),
        ]);
      } finally {
        host.removeEventListener('kilo-relayout',onLayout);
        if(!localWin.destroyed)localWin.destroy();if(!amountsRoot.destroyed)amountsRoot.destroy({children:true});resizeFollow=false;endMotion();
      }
    },
    async collect(spin) {
      const mine = job;
      clearPresentation();
      animating = true;
      resizeFollow = true;
      mark("collect");
      const fish: { reel: number; row: number; v: number }[] = [];
      const collectors: { reel: number; row: number }[] = [];
      spin.grid.forEach((col, reel) =>
        col.forEach((c, row) => {
          if (c.s === "brick" && !c.part && c.v != null)
            fish.push({ reel, row, v: c.v });
          if (c.s === "splash") collectors.push({ reel, row });
        }),
      );
      const step = (name: string | null) => {
        const target = phaseTarget();
        if (name) target.dataset.collectStep = name;
        else delete target.dataset.collectStep;
      };
      if (!fish.length || !collectors.length || spin.got <= 0) {
        resizeFollow = false;
        step(null);
        endMotion();
        return;
      }
      const faces = fish.map((spot) => Math.max(0, Math.round(stake * spot.v)));
      const printed = faces.reduce((sum, value) => sum + value, 0);
      const illustrated = printed * spin.mult * collectors.length;
      const capped = illustrated > spin.got;
      const table = portions(faces, spin.got, collectors.length);
      const even =
        !capped && printed * spin.mult * collectors.length === spin.got;
      const live = () => mine === job && !stopped;
      const pace = (ms: number) =>
        reduced ? 0 : turbo ? Math.max(80, Math.round(ms * 0.4)) : ms;
      const chip = new Container();
      transient.addChild(chip);
      let repaint: () => void = () => {};
      let repaintFlight: (() => void) | null = null;
      let active: { reel: number; row: number } | null = null;
      const onLayout = () => {
        if (!live() || chip.destroyed) return;
        repaint();
        repaintFlight?.();
        if (active) focus(active);
      };
      host.addEventListener("kilo-relayout", onLayout);
      const paintPlaque = (amount: number, where: { reel: number; row: number }) => {
        if (chip.destroyed) return;
        chip.removeChildren().forEach((child) => child.destroy());
        const cell = geom.cell;
        const node = createWinNumeral(money(amount),collectionType(cell).subtotal);
        node.label='collector-subtotal';
        const maxW = cell * 0.86 - 8;
        // Prefer the exact full number at the larger size. Only long totals
        // use exact shorthand, with the full value retained in the readout.
        for (const text of collectorAmountLabels(amount, money(amount))) {
          node.text = text;
          node.style.fontSize = collectionType(cell).subtotal;
          while (node.width > maxW && Number(node.style.fontSize) > 12)
            node.style.fontSize = Number(node.style.fontSize) - 1;
          if (node.width <= maxW) break;
        }
        // Extremely small popouts still keep an exact number inside the cell.
        if (node.width > maxW) node.style.fontSize = Number(node.style.fontSize) * maxW / node.width;
        node.anchor.set(0.5, 0.5);
        const width = Math.min(cell * 0.94, node.width + 8);
        const height = Math.max(18, node.height + 4);
        // A small painted underline anchors the value to the collector's
        // reserved lower area. There is no freestanding opaque UI box.
        const back = new Graphics().moveTo(-width*.30,height-1).lineTo(width*.30,height-1)
          .stroke({color:0x85b4a6,width:1.5});
        node.position.set(0, height / 2);
        chip.addChild(back, node);
        chip.position.set(
          geom.gx + where.reel * (cell + geom.gap) + cell / 2,
          geom.gy + (where.row + 1) * cell - height - 2,
        );
      };
      const focus = (wild: { reel: number; row: number }) => {
        fx.clear();
        const hot = new Set([
          `${wild.reel}:${wild.row}`,
          ...fish.map((spot) => `${spot.reel}:${spot.row}`),
        ]);
        reels.forEach((reel, ri) =>
          reel.strip.children.forEach((child, row) => {
            if (!child.destroyed) {
              child.alpha = hot.has(`${ri}:${row}`) ? 1 : 0.48;
              for (const item of child.children)
                if (item.label === "collector-tag") item.visible = !(ri === wild.reel && row === wild.row);
            }
          }),
        );
      };
      const showCollector = (amount: number, wild: { reel: number; row: number }) => {
        repaint = () => paintPlaque(amount, wild);
        repaint();
      };
      const flyFish = async (
        spot: { reel: number; row: number },
        value: number,
        wild: { reel: number; row: number },
      ) => {
        const label = createWinNumeral(money(value),collectionType(geom.cell).travelling);
        const trace = new Graphics();
        label.anchor.set(0.5);
        label.alpha = 0;
        transient.addChild(trace,label);
        let progress = 0;
        const paintFlight = () => {
          if (label.destroyed) return;
          const t = progress;
          const cellNow = geom.cell;
          const type = collectionType(cellNow);
          if (label.style.fontSize !== type.travelling) {
            label.style.fontSize = type.travelling;
            label.style.stroke = { color: 0x031920, width: type.stroke };
          }
          const gap = geom.gap;
          const at = (reel: number, row: number, fx: number, fy: number) => ({
            x: geom.gx + reel * (cellNow + gap) + cellNow * fx,
            y: geom.gy + row * cellNow + cellNow * fy,
          });
          // Born on the fish body, well above the stationary value plaque (0.76).
          const start = at(spot.reel, spot.row, 0.5, 0.3);
          const laneY = Math.max(
            geom.cab.y + label.height / 2 + 2,
            geom.gy + spot.row * cellNow - cellNow * 0.04,
          );
          const lifted = { x: start.x, y: laneY };
          const crossed = { x: at(wild.reel, wild.row, 0.5, 0).x, y: laneY };
          // Dissolve at the top of the collector, before the face and the plaque.
          const sink = at(wild.reel, wild.row, 0.5, 0.28);
          // One continuous haul, not three separate ease-to-zero moves.
          // Cubic tangents carry the value through the overhead lane; the
          // stationary cash plaques below remain protected by the bounds test.
          const u=t*t*(3-2*t),v=1-u;
          let pos = {
            x:v*v*v*start.x+3*v*v*u*lifted.x+3*v*u*u*crossed.x+u*u*u*sink.x,
            y:v*v*v*start.y+3*v*v*u*lifted.y+3*v*u*u*crossed.y+u*u*u*sink.y,
          };
          const halfW = label.width / 2 + 6;
          const halfH = label.height / 2 + 4;
          for (const other of fish) {
            const left =
              geom.gx + other.reel * (cellNow + gap) + cellNow * 0.02;
            const right = left + cellNow * 0.96;
            const top = geom.gy + other.row * cellNow + cellNow * 0.72;
            const bot = top + cellNow * 0.26;
            if (
              pos.x + halfW > left &&
              pos.x - halfW < right &&
              pos.y + halfH > top &&
              pos.y - halfH < bot
            ) {
              pos = { x: pos.x, y: top - halfH - 2 };
            }
          }
          if (!chip.destroyed && chip.children.length > 0) {
            const plaqueTop = chip.position.y;
            const near =
              Math.abs(pos.x - chip.position.x) <
              Math.max(chip.width, label.width) * 0.55;
            if (near && pos.y + halfH > plaqueTop - 6) {
              pos = { x: pos.x, y: plaqueTop - halfH - 8 };
            }
          }
          label.position.set(pos.x, pos.y);
          label.scale.set(t<.24?connectedNumberScale(t/.24,reduced):1);
          // One short water-coloured tether follows the active value. It
          // forms at the package and contracts into the collector, then ends.
          trace.clear();
          const tail=Math.max(0,t-.13),tu=tail*tail*(3-2*tail),tv=1-tu;
          const tailPos={x:tv*tv*tv*start.x+3*tv*tv*tu*lifted.x+3*tv*tu*tu*crossed.x+tu*tu*tu*sink.x,
            y:tv*tv*tv*start.y+3*tv*tv*tu*lifted.y+3*tv*tu*tu*crossed.y+tu*tu*tu*sink.y};
          if(t>.08&&t<.77)trace.moveTo(tailPos.x,tailPos.y).lineTo(pos.x,pos.y)
            .stroke({color:0x86c9b9,width:Math.max(1.5,cellNow*.016),alpha:.65*Math.sin(Math.PI*t),cap:'round'});
          const fadeIn = Math.min(1, t / 0.08);
          const fadeOut = t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.18);
          label.alpha = fadeIn * fadeOut;
        };
        repaintFlight = paintFlight;
        try {
          await tween(pace(500), (t) => {
            progress = t;
            paintFlight();
          });
        } finally {
          repaintFlight = null;
          if (!label.destroyed) label.destroy();
          if (!trace.destroyed) trace.destroy();
        }
      };
      // Display only: the WIN subtotal steps up as each collector banks its
      // share and reaches the recorded award when the flyer lands.
      let bankedShown = 0;
      const showSubtotal = (amount: number) => {
        if (!live()) return;
        bankedShown = Math.max(bankedShown, Math.min(spin.got, amount));
        spin.onSubtotal?.(bankedShown);
      };
      try {
        step("gather");
        for (const [wi, wild] of collectors.entries()) {
          if (!live()) break;
          active = wild;
          focus(wild);
          if (!chip.destroyed)
            chip.removeChildren().forEach((child) => child.destroy());
          const reaction = playReaction(
              () => symbolSprite(wild.reel, wild.row),
              collectorFrames,
              collectorAtlas.sequence,
              collectorAtlas.frameMs,
            );
          const share = (table[wi] ?? []).reduce((sum, value) => sum + value, 0);
          const beforeCap = printed * spin.mult;
          const credited = even ? beforeCap : share;
          let shown = 0;
          const collectorLabel = `Collector ${wi + 1}/${collectors.length}`;
          const publish = () => collectionCue({
            index: wi + 1, count: collectors.length, mult: spin.mult,
            subtotal: shown, completed: 0, phase: "gather", capped,
          });
          const readable = (ms: number) => holdReadable(collectionHold(ms, speedMode, reduced));
          // Reset all three displays together before the next fish takes off.
          // This also replaces the resize closure for the previous collector.
          showCollector(0, wild);
          showReadout(collectorLabel, money(0), 'local');
          publish();
          for (let index = 0; index < fish.length && live(); index++) {
            const spot = fish[index]!;
            const value = faces[index] ?? 0;
            if (!reduced) await Promise.all([
              flyFish(spot, value, wild),
              playFishAck(() => symbolSprite(spot.reel, spot.row)),
            ]);
            if (!live()) break;
            shown += value;
            showCollector(shown, wild);
            showReadout(collectorLabel, money(shown), 'local');
            publish();
            await Promise.all([readable(340),tween(pace(260),t=>{
              const number=chip.children.find(child=>child.label==='collector-subtotal');
              if(number&&!number.destroyed)number.scale.set(reduced?1:1+Math.sin(Math.PI*t)*.08);
            })]);
          }
          if (live() && shown > 0 && spin.mult > 1) {
            showReadout(`${money(shown)} ×${spin.mult} →`, money(beforeCap));
            await readable(720);
          }
          if (live() && (capped || credited !== beforeCap)) {
            showReadout("BEFORE CAP", money(beforeCap));
            await readable(640);
          }
          if (live()) {
            shown = credited;
            showCollector(credited, wild);
            showReadout(capped ? `${collectorLabel} · credited` : collectorLabel, money(credited), capped ? 'summary' : 'local');
            publish();
            // The last collector's share is carried by the flyer into WIN.
            if (wi < collectors.length - 1) showSubtotal(bankedShown + credited);
            await readable(640);
          }
          await reaction;
        }
        if (live()) {
          step("total");
          active = null;
          repaint = () => {};
          chip.removeChildren().forEach((child) => child.destroy());
          restoreSymbols();
          if (capped) {
            showReadout("Combined before cap", money(illustrated));
            await holdReadable(collectionHold(720, speedMode, reduced));
          }
          let awardSpot: { x: number; y: number } | null = null;
          let showAward = true;
          repaint = () => {
            const b = stageReadoutLayout(geom);
            awardSpot = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
            if (showAward) showReadout(capped ? "MAX WIN REACHED" : "Collected", money(spin.got));
          };
          repaint();
          await holdReadable(collectionHold(720, speedMode, reduced));
          if (live() && !reduced && spin.got > 0) {
            step("transfer");
            const el = document.createElement("div");
            el.className = "kk-award-fly";
            el.textContent = money(spin.got);
            document.body.appendChild(el);
            flyers.add(el);
            const placeFly = (x: number, y: number, alpha: number, scale: number) => {
              el.style.left = `${x}px`;
              el.style.top = `${y}px`;
              el.style.opacity = String(Math.max(0, Math.min(1, alpha)));
              el.style.transform = `translate(-50%, -50%) scale(${scale})`;
            };
            const origin = () => {
              if (awardSpot) return screenOf(awardSpot.x, awardSpot.y);
              const cellNow = geom.cell;
              const edge = frameBorders(geom.cab);
              const centerX = geom.gx + (cellNow * 5 + geom.gap * 4) / 2;
              return screenOf(centerX, geom.cab.y + geom.cab.h - edge.b / 2);
            };
            const start0 = origin();
            placeFly(start0.x, start0.y, 1, 1);
            showAward = false;
            readoutActive = false;
            readout.hidden = true;
            if (!chip.destroyed)
              chip.removeChildren().forEach((child) => child.destroy());
            await tween(pace(780), (t) => {
              const start = origin();
              const half = (el.offsetHeight || 40) / 2;
              const dest = bonusLanding(el.offsetHeight || 40);
              const landX = dest ? dest.x : start.x;
              const landY = dest ? dest.y : start.y - 36;
              const numberTop = dest?.numberTop ?? landY + half + 16;
              const e = 1 - (1 - Math.min(1, t)) ** 2;
              const x = start.x + (landX - start.x) * e;
              // Rise off the plaque, then settle toward BONUS WIN.
              let y = start.y + (landY - start.y) * e + Math.sin(Math.PI * e) * -28;
              const limit = numberTop - half - 10;
              if (y > limit) y = limit;
              let alpha = 1;
              // The flyer is ~85% of the way onto WIN here: start the WIN roll
              // now so it reaches the recorded award before the round settles.
              if (t >= 0.6) showSubtotal(spin.got);
              if (t > 0.68) alpha = Math.max(0, 1 - (t - 0.68) / 0.24);
              const clearance = numberTop - (y + half);
              if (clearance < 22) alpha = Math.min(alpha, Math.max(0, clearance / 22));
              placeFly(x, y, alpha, 1.04 - 0.06 * e);
            });
            el.remove();
            flyers.delete(el);
          }
          if (live()) {
            showSubtotal(spin.got);
            collectionCue({
              index: collectors.length,
              count: collectors.length,
              mult: spin.mult,
              subtotal: spin.got,
              completed: spin.got,
              phase: "bank",
              capped,
            });
          }
        }
      } finally {
        host.removeEventListener("kilo-relayout", onLayout);
        resizeFollow = false;
        if (mine === job) step(null);
        if (mine === job) {
          if (!chip.destroyed) chip.destroy({ children: true });
          restoreSymbols();
          readoutActive = false;
          readout.hidden = true;
          fx.clear();
          collectionCue(null);
          endMotion();
        } else if (!chip.destroyed) {
          chip.destroy({ children: true });
        }
      }
    },
    async deliverCollectors(count, onLand) {
      const mine = job;
      animating = true;
      mark("meter");
      const spots: { reel: number; row: number }[] = [];
      board.forEach((col, reel) =>
        col.forEach((c, row) => {
          if (c.s === "splash") spots.push({ reel, row });
        }),
      );
      const n = Math.min(count, spots.length);
      const start = meterWilds;
      if (n <= 0) {
        if (mine === job) endMotion();
        return;
      }
      for (let i = 0; i < n; i++) {
        if (mine !== job || stopped) break;
        const at = start + i;
        if (at >= 12) break;
        const slot = at % 4;
        const spot = spots[i]!;
        const completesSet = (at + 1) % 4 === 0 && at < 12;
        const origin = cellCenter(spot.reel, spot.row);
        const el = document.createElement("img");
        el.className = completesSet
          ? "kk-fly-portrait is-source"
          : "kk-fly-portrait";
        el.alt = "";
        el.src = "/kilo-v79/characters/collector-idle.webp";
        document.body.appendChild(el);
        flyers.add(el);
        await tween(reduced ? 0 : turbo ? 160 : motionMs.portraitFlight, (t) => {
          const start = screenOf(origin.x, origin.y);
          const dest = domCenter(`[data-socket="${slot}"]`) ?? start;
          const e = 1 - (1 - t) ** 2;
          el.style.left = `${start.x + (dest.x - start.x) * e}px`;
          el.style.top = `${start.y + (dest.y - start.y) * e - Math.sin(Math.PI * e) * 28}px`;
          el.style.opacity = String(
            t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 1,
          );
          el.style.transform = `translate(-50%, -50%) scale(${1.2 - 0.45 * e}) rotate(${(1 - e) * -12}deg)`;
        });
        el.remove();
        flyers.delete(el);
        if (completesSet) fx.clear();
        if (mine !== job || stopped) break;
        if (onLand) await onLand(i);
      }
      if (mine === job) endMotion();
    },
    async tool(spin) {
      if (!spin.tool) return;
      const mine = job;
      const actorTool=(kind:'cast'|'throw',progress:number)=>{
        const detail:KingToolEvent={kind,progress};
        host.dispatchEvent(new CustomEvent('kilo-stage-tool',{bubbles:true,detail}));return detail;
      };
      clearPresentation();
      animating = true;
      mark(spin.tool === "hook" ? "hook" : spin.tool);
      const changed: { reel: number; row: number }[] = [];
      spin.grid.forEach((col, reel) =>
        col.forEach((c, row) => {
          if (JSON.stringify(c) !== JSON.stringify(board[reel]![row]))
            changed.push({ reel, row });
        }),
      );
      let hook: Sprite | null = null;
      let revealed = false;
      const commitBoard = () => {
        if (revealed || mine !== job) return;
        revealed = true;
        board = spin.grid.map((col) => col.map((c) => ({ ...c })));
        paintStanding();
      };
      if (spin.tool === "hook" && spin.toolReel != null) {
        const reel = spin.toolReel;
        const strip = reels[reel]!.strip;
        const cell = geom.cell;
        const up = spin.toolShift === "up";
        // The recorded shift brings the collector in at one end. Up enters
        // on the bottom row; down enters on the top row. It is not a package.
        const incoming = cellView(
          up ? spin.grid[reel]![2]! : spin.grid[reel]![0]!,
          cell,
        );
        incoming.y = up ? cell * 3 : -cell;
        strip.addChild(incoming);
        const x = cellCenter(reel, 1).x;
        const eye = geom.gy - cell * 0.46;
        const approach = geom.gy - cell * 1.15;
        hook = new Sprite(hookTex);
        const pivot = TOOL_PIVOTS.hook;
        hook.anchor.set(pivot.x / pivot.width, pivot.y / pivot.height);
        const s = Math.max(0.12, cell / 920);
        hook.scale.set(s);
        hook.position.set(x, approach);
        transient.addChild(hook);
        const reelX = geom.gx + reel * (cell + geom.gap);
        const rope = (width = 3) => {
          if (!hook || hook.destroyed) return;
          fx.clear();
          const top = Math.max(0, geom.cab.y - 8);
          const droop = Math.min(
            cell * 0.55,
            Math.abs(hook.position.y - top) * 0.35,
          );
          const mx = (x + hook.position.x) / 2 - cell * 0.08;
          const my = (top + hook.position.y) / 2 + droop;
          fx.moveTo(x, top)
            .quadraticCurveTo(mx, my, hook.position.x, hook.position.y)
            .stroke({ width, color: 0xf3e2b4, alpha: 0.95 });
          fx.moveTo(x + 3, top)
            .quadraticCurveTo(
              mx + 6,
              my + 4,
              hook.position.x + 2,
              hook.position.y,
            )
            .stroke({
              width: Math.max(1.5, width * 0.45),
              color: 0x6b4420,
              alpha: 0.85,
            });
          fx.roundRect(
            reelX - 4,
            geom.gy - 4,
            cell + 8,
            cell * 3 + 8,
            8,
          ).stroke({
            width: 3 + Math.min(3, width * 0.2),
            color: 0xf0d48a,
            alpha: 0.9,
          });
        };
        hook.rotation = -0.25;
        hook.alpha=0;
        actorTool('cast',0);
        await tween(turbo ? 180 : 360, (t) => {
          if (!hook || hook.destroyed) return;
          actorTool('cast',t);
          // The rod loads and casts before the hook begins its original descent.
          const descend=Math.max(0,(t-.45)/.55);
          const e = 1 - (1 - descend) ** 3;
          const swing = Math.sin(descend * Math.PI);
          hook.alpha=descend>0?1:0;
          hook.position.set(
            x + swing * cell * 0.14,
            approach + (eye - approach) * e,
          );
          hook.rotation = -0.25 * (1 - descend);
          hook.scale.set(s * (1 + swing * 0.08));
          if(descend>0)rope(2.5);else fx.clear();
        });
        if (mine === job && !stopped) await sleep(turbo ? 40 : 90);
        if (mine === job && !stopped)
          await tween(turbo ? 280 : 520, (t) => {
            if (!hook || hook.destroyed) return;
            const e = t * t * (3 - 2 * t);
            const pull = (up ? -1 : 1) * cell * e;
            strip.y = pull;
            hook.position.set(x, eye + pull * 0.28);
            hook.rotation = 0;
            rope(3);
          });
        strip.scale.set(1);
        if (mine === job) {
          const kids = strip.children.slice();
          if (
            kids.length >= 4 &&
            (spin.toolShift === "up" || spin.toolShift === "down")
          ) {
            const visible = up
              ? [kids[1]!, kids[2]!, kids[3]!]
              : [kids[3]!, kids[0]!, kids[1]!];
            const drop = up ? [kids[0]!] : [kids[2]!];
            for (const gone of drop) {
              if (gone.parent === strip) strip.removeChild(gone);
              gone.destroy({ children: true });
            }
            visible.forEach((view, row) => {
              view.position.set(0, row * cell);
              view.scale.set(1);
              view.alpha = 1;
              // Child index is the row. Later win presentation addresses
              // strip.children[row], so the seated order has to match.
              strip.addChild(view);
            });
            strip.position.set(0, 0);
            board = spin.grid.map((col) => col.map((c) => ({ ...c })));
            revealed = true;
          } else commitBoard();
          mark("hook-landed");
        }
        if (mine === job && !stopped && hook && !hook.destroyed) {
          const releaseY = hook.y;
          await tween(turbo ? 140 : 260, (t) => {
            if (!hook || hook.destroyed) return;
            const e = 1 - (1 - t) ** 2;
            hook.position.set(
              x + Math.sin(t * Math.PI) * cell * 0.22,
              releaseY + (approach - releaseY) * e,
            );
            hook.rotation = -0.25 * t;
            hook.alpha = 1 - t * t;
            rope(Math.max(1, 4 * (1 - t)));
          });
        }
      } else {
        const prop =
          spin.tool === "dynamite"
            ? new Sprite(dynamiteTex)
            : new Sprite(bazookaTex);
        const pivot =
          spin.tool === "dynamite" ? TOOL_PIVOTS.dynamite : TOOL_PIVOTS.bazooka;
        prop.anchor.set(pivot.x / pivot.width, pivot.y / pivot.height);
        const spot = changed[0] ?? {
          reel: spin.toolReel ?? 2,
          row: 1,
        };
        const at = cellCenter(spot.reel, spot.row);
        const s = geom.cell / (spin.tool === "bazooka" ? 460 : 340);
        prop.scale.set(s);
        const changedCenter = changed.reduce(
          (sum, hit) => {
            const p = cellCenter(hit.reel, hit.row);
            return { x: sum.x + p.x, y: sum.y + p.y };
          },
          { x: 0, y: 0 },
        );
        const aim = changed.length
          ? {
              x: changedCenter.x / changed.length,
              y: changedCenter.y / changed.length,
            }
          : at;
        const tail =
          spin.tool === "bazooka" ? (pivot.x / pivot.width) * 768 * s : 0;
        const muzzleX = Math.max(geom.cab.x + tail + 8, Math.min(aim.x, geom.cab.x + geom.cab.w - 24));
        prop.position.set(
          spin.tool === "bazooka" ? muzzleX - geom.cell * 0.45 : at.x,
          spin.tool === "bazooka" ? aim.y : at.y,
        );
        transient.addChild(prop);
        const burst = new Sprite(burstTex);
        burst.anchor.set(0.5);
        burst.position.set(spin.tool === "bazooka" ? aim.x : at.x, spin.tool === "bazooka" ? aim.y : at.y);
        burst.scale.set(0.2);
        burst.alpha = 0;
        transient.addChild(burst);
        let thrown:HTMLImageElement|null=null;
        if(spin.tool==='dynamite'&&!reduced&&!stopped){
          const start=actorTool('throw',0);
          if(start.hand){
            thrown=document.createElement('img');thrown.src=TOOL_PIVOTS.dynamite.file;
            thrown.className='kk-character-tool-flight';thrown.setAttribute('aria-hidden','true');
            Object.assign(thrown.style,{position:'fixed',pointerEvents:'none',zIndex:'16',width:`${start.handSize??28}px`,height:'auto',left:`${start.hand.x}px`,top:`${start.hand.y}px`,transform:'translate(-50%,-50%)'});
            document.body.appendChild(thrown);flyers.add(thrown);prop.alpha=0;
          }
        }
        await tween(turbo ? 260 : 600, (t) => {
          fx.clear();
          const bomb = spin.tool === "dynamite";
          const actor=bomb?actorTool('throw',t):null;
          const bombImpact=thrown ? .64 : .32;
          const wind = bomb ? t < bombImpact : t < 0.28;
          const impact = wind
            ? 0
            : bomb
              ? (t - bombImpact) / (1-bombImpact)
              : (t - 0.28) / 0.72;
          if (!prop.destroyed) {
            if (bomb) {
              if(thrown&&actor?.hand&&actor.releaseHand){
                const flight=Math.max(0,Math.min(1,(t-KING_THROW_RELEASE)/(.64-KING_THROW_RELEASE)));
                const start=actor.releaseHand,end=screenOf(at.x,at.y),arc=Math.min(100,Math.hypot(end.x-start.x,end.y-start.y)*.24);
                const point=t<KING_THROW_RELEASE?actor.hand:{x:start.x+(end.x-start.x)*flight,y:start.y+(end.y-start.y)*flight-Math.sin(Math.PI*flight)*arc};
                Object.assign(thrown.style,{left:`${point.x}px`,top:`${point.y}px`,width:`${(actor.handSize??28)*(1+flight*.22)}px`,transform:`translate(-50%,-50%) rotate(${t<KING_THROW_RELEASE?-12:flight*220}deg)`,opacity:t<.64?'1':'0'});
                prop.alpha=0;
              }else{
              const shake = wind ? Math.sin(t * 70) * geom.cell * 0.035 : 0;
              prop.position.set(
                at.x + shake,
                at.y - (wind ? geom.cell * 0.08 : 0),
              );
              prop.rotation = wind ? Math.sin(t * 46) * 0.12 : (t - 0.32) * 0.6;
              prop.alpha = t < 0.74 ? 1 : 1 - (t - 0.74) / 0.26;
              }
            } else {
              const travel = Math.min(1, t / 0.34);
              const e = 1 - (1 - travel) ** 3;
              const fromX = muzzleX - geom.cell * 0.45;
              prop.position.set(fromX + (muzzleX - fromX) * e, aim.y);
              prop.rotation = -0.12 * (1 - e);
              prop.alpha = t < 0.82 ? 1 : 1 - (t - 0.82) / 0.18;
              if (t < 0.5)
                fx.moveTo(
                  Math.max(geom.cab.x + 10, prop.position.x - geom.cell * 1.2),
                  prop.position.y,
                )
                  .lineTo(prop.position.x, prop.position.y)
                  .stroke({ width: 4, color: 0xc8fff8, alpha: 0.85 });
            }
          }
          for (const hit of changed) {
            if (impact <= 0) continue;
            const p = cellCenter(hit.reel, hit.row);
            paintImpact(fx,p.x,p.y,geom.cell*.67,geom.cell*.62,impact,
              bomb?0xffbd48:0x79f0da,bomb?1.3:1,reduced,false);
          }
          if (!burst.destroyed) {
            burst.alpha =
              impact <= 0
                ? 0
                : impact < 0.18
                  ? impact / 0.18
                  : 1 - (impact - 0.18) / 0.82;
            burst.scale.set(0.15 + impact * (geom.cell / 140));
            burst.rotation = impact * 0.8;
          }
          if (impact > 0.08) {
            commitBoard();
            const pop = Math.min(1, (impact - 0.08) / 0.3);
            const cell = geom.cell;
            for (const hit of changed) {
              const view = reels[hit.reel]?.strip.children[hit.row];
              if (!view || view.destroyed) continue;
              const s = 0.8 + 0.2 * pop;
              view.scale.set(s);
              view.position.set(
                (cell * (1 - s)) / 2,
                hit.row * cell + (cell * (1 - s)) / 2,
              );
            }
          }
        });
        if(thrown){thrown.remove();flyers.delete(thrown);}
        if(spin.tool==='dynamite')actorTool('throw',1);
        if (!prop.destroyed) prop.destroy();
        if (!burst.destroyed) burst.destroy();
      }
      if (mine !== job) {
        actorTool(spin.tool==='hook'?'cast':'throw',1);
        if (hook && !hook.destroyed) hook.destroy();
        return;
      }
      if (!revealed) commitBoard();
      else {
        const cell = geom.cell;
        for (const hit of changed) {
          const view = reels[hit.reel]?.strip.children[hit.row];
          if (!view || view.destroyed) continue;
          view.scale.set(1);
          view.position.set(0, hit.row * cell);
        }
      }
      fx.clear();
      if (spin.tool === "hook" && spin.toolReel != null && !stopped) {
        const row = spin.toolShift === "up" ? 2 : 0;
        const land = cellCenter(spin.toolReel, row);
        const cell = geom.cell;
        const box = new Graphics();
        transient.addChild(box);
        const draw = (alpha: number) => {
          box.clear().roundRect(
            land.x - cell * 0.46,
            land.y - cell * 0.46,
            cell * 0.92,
            cell * 0.92,
            8,
          ).stroke({ color: 0xffd884, width: 4, alpha });
        };
        draw(1);
        splashAt(land.x, land.y + cell * 0.25, Math.max(0.15, cell / 380));
        await tween(turbo ? 160 : 280, (t) => draw(1 - t * t));
        if (!box.destroyed) box.destroy();
      }
      if (hook && !hook.destroyed) hook.destroy();
      if(spin.tool==='hook')actorTool('cast',1);
      if (mine === job) endMotion();
    },
    async intro(round) {
      const names: Record<string, string> = {
        moreFish: "More packages",
        moreWilds: "More fishermen",
        moreTools: "More tools",
        extraSpins: "+2 spins",
        level2: "Starts one level higher",
      };
      const label = round.mode === "chopper" ? "Chopper" : "Dockside Catch";
      bonusEnter(round.mode);
      host.dispatchEvent(new CustomEvent('kilo-stage-action',{bubbles:true,detail:{kind:'entry'}}));
      await ceremony(
        "entry",
        label,
        `${round.awarded} spins · Starts at ×${collectMult(round.banked)}`,
        round.mods.length
          ? round.mods.map((mod) => names[mod] ?? mod).join(" · ")
          : "",
        turbo ? 780 : 1100,
      );
    },
    async retrigger(extra, nextMult, onAward) {
      const mine = job;
      animating=true;resizeFollow=true;
      mark("upgrade");
      await ensureType();
      const root = host.closest(".kk-app") ?? document.body;
      const bonus = root.querySelector(".kk-bonus");
      bonus?.classList.add("is-awarding");
      const group = new Container();
      transient.addChild(group);
      const gridW = geom.cell * 5 + geom.gap * 4;
      const gridH = geom.cell * 3;
      const skin = upgradeTex;
      const w = Math.min(gridW * 0.92, 560);
      const h = w * (skin.height / skin.width);
      const x = geom.gx + (gridW - w) / 2;
      const y = geom.gy + (gridH - h) / 2;
      const dim = new Graphics()
        .rect(geom.gx, geom.gy, gridW, gridH)
        .fill({ color: 0x010c12, alpha: 0.4 });
      const modal = new Sprite(skin);
      modal.width = w;
      modal.height = h;
      modal.position.set(x, y);
      const content = new Container();
      const spins = new Text({
        text: `+${extra}`,
        style: {
          fill: 0xffe2a0,
          fontFamily: TEXT,
          fontWeight: "700",
          fontSize: Math.max(21, Math.min(34, w * 0.068)),
          align: "center",
        },
      });
      const free = new Text({
        text: "Free spins",
        style: {
          fill: 0xe3f0e7,
          fontFamily: DISPLAY,
          fontWeight: "600",
          fontSize: Math.max(14, Math.min(20, w * 0.042)),
          align: "center",
        },
      });
      const next = new Text({
        text: nextMult >= 10 ? "Max level" : `Next ×${nextMult}`,
        style: {
          fill: 0x99e8cd,
          fontFamily: TEXT,
          fontWeight: "700",
          fontSize: Math.max(13, Math.min(18, w * 0.034)),
          align: "center",
        },
      });
      spins.anchor.set(0.5);
      free.anchor.set(0.5);
      next.anchor.set(0.5);
      while (next.width > w * 0.78 && Number(next.style.fontSize) > 10) {
        next.style.fontSize = Number(next.style.fontSize) - 1;
      }
      // One award line fits the banner's shallow central recess. A separate
      // quiet inset carries the next multiplier without touching that line.
      const copyGap=6;
      spins.position.set(x+w/2-(free.width+copyGap)/2,y+h*.51);
      free.position.set(x+w/2+(spins.width+copyGap)/2,y+h*.51);
      next.position.set(x+w/2,y+h*.88);
      const nextBack=new Graphics().roundRect(x+w/2-next.width/2-8,y+h*.88-next.height/2-3,next.width+16,next.height+6,3)
        .fill(0x07131a).stroke({color:0x719b92,width:1});
      content.addChild(spins, free, nextBack, next);
      const presentation=new Container();presentation.addChild(modal,content);
      const contactArt=new Graphics();contactArt.label='retrigger-threshold-impact';
      group.addChild(dim,contactArt,presentation);
      const stopAuthoredArt = playRetriggerArt(presentation,x,y,w,h);
      let contact=0;
      const follow=()=>{
        if(group.destroyed)return;
        const gw=geom.cell*5+geom.gap*4,gh=geom.cell*3;
        const nw=Math.min(gw*.92,560),scale=nw/w,nh=h*scale,pose=featureArrivalAt(contact,reduced);
        dim.clear().rect(geom.gx,geom.gy,gw,gh).fill({color:0x010c12,alpha:.4});
        presentation.pivot.set(x+w/2,y+h/2);
        presentation.scale.set(scale*pose.x,scale*pose.y);
        presentation.position.set(geom.gx+gw/2,geom.gy+gh/2+nh*pose.lift);
        paintImpact(contactArt,geom.gx+gw/2,geom.gy+gh/2,gw*.78,gh*.58,contact*.96,0xffcb55,1.3,reduced);
      };
      host.addEventListener('kilo-relayout',follow);follow();
      const fade = reduced ? 0 : turbo ? 90 : 160;
      const half = Math.max(0, motionMs.retriggerAnnouncement / 2 - fade);
      group.alpha = 0;
      try {
        await tween(fade, (t) => {
          if (!group.destroyed) { group.alpha = t;contact=t;follow(); }
        });
        await holdReadable(turbo ? 200 : half);
        if (mine !== job || stopped) return;
        onAward?.();
        host.dispatchEvent(new CustomEvent('kilo-stage-action',{bubbles:true,detail:{kind:'retrigger'}}));
        // The grant still happens at the original threshold. The number's
        // contact/recovery fits inside the existing post-award reading hold.
        await Promise.all([holdReadable(turbo ? 200 : half),tween(reduced?0:Math.min(200,turbo?200:half),t=>{
          if (!group.destroyed) spins.scale.set(connectedNumberScale(t,reduced));
        })]);
        if (mine === job && !stopped && fade > 0)
          await tween(fade, (t) => {
            if (!group.destroyed) group.alpha = 1 - t;
          });
      } finally {
        host.removeEventListener('kilo-relayout',follow);
        stopAuthoredArt();
        if (!group.destroyed) group.destroy({ children: true });
        bonus?.classList.remove("is-awarding");
        if(mine===job){resizeFollow=false;endMotion();}
      }
    },
    symbolCompare() {
      const samples: { name: string; cell: SplashCell; reaction: boolean }[] = [
        { name: "Dime bag", cell: { s: "brick", v: 2, w: 1, h: 1 }, reaction: true },
        { name: "Kilo brick", cell: { s: "brick", v: 25, w: 1, h: 1 }, reaction: true },
        { name: "Kilo bundle", cell: { s: "brick", v: 200, w: 1, h: 1 }, reaction: true },
        { name: "Bulk kilos", cell: { s: "brick", v: 5000, w: 1, h: 1 }, reaction: true },
        { name: "KING scatter", cell: { s: "bars" }, reaction: false },
        { name: "Fisherman", cell: { s: "splash" }, reaction: true },
        { name: "Reel", cell: { s: "lamp" }, reaction: false },
        { name: "Case", cell: { s: "duffel" }, reaction: false },
        { name: "Royal K", cell: { s: "K" }, reaction: false },
      ];
      const pad = 16;
      const alphaCut = 12;
      const measure = (
        cell: SplashCell,
        size: number,
        state: "idle" | "peak" | "turn",
        reactionFrame = 4,
      ) => {
        const view = cellView(cell, size, false);
        const sprite = view.children.find((child) => child instanceof Sprite);
        if (sprite instanceof Sprite) {
          if (cell.s === "brick" && state === "peak") applyPlace(sprite, fishReaction(210));
          else if (cell.s === "brick" && state === "turn") applyPlace(sprite, fishReaction(128));
          else if (cell.s === "splash" && state === "peak") {
            showReaction(sprite, collectorFrames, reactionFrame);
          }
        }
        const frame = new Rectangle(-pad, -pad, size + pad * 2, size + pad * 2);
        const shot = app.renderer.extract.pixels({
          target: view,
          frame,
          resolution: 1,
          antialias: false,
          clearColor: [0, 0, 0, 0],
        });
        let minX = shot.width;
        let minY = shot.height;
        let maxX = -1;
        let maxY = -1;
        const data = shot.pixels;
        for (let y = 0; y < shot.height; y++) {
          for (let x = 0; x < shot.width; x++) {
            const alpha = data[(y * shot.width + x) * 4 + 3] ?? 0;
            if (alpha <= alphaCut) continue;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
        const source = sprite instanceof Sprite ? sprite.texture.source : null;
        const left = (minX - pad) / size;
        const top = (minY - pad) / size;
        const right = (maxX + 1 - pad) / size;
        const bottom = (maxY + 1 - pad) / size;
        const row = {
          name: "",
          cell: size,
          state,
          source: source?.label ?? "",
          sourceWidth: source?.width ?? 0,
          sourceHeight: source?.height ?? 0,
          frameWidth: sprite instanceof Sprite ? sprite.texture.width : 0,
          frameHeight: sprite instanceof Sprite ? sprite.texture.height : 0,
          left,
          top,
          right,
          bottom,
          width: right - left,
          height: bottom - top,
          insideCell:
            minX >= pad && minY >= pad && maxX < pad + size && maxY < pad + size,
          clearsPlaque: cell.s !== "brick" || bottom <= 0.76,
        };
        view.destroy({ children: true });
        return row;
      };
      const rows = samples.flatMap((sample) => {
        const states: ("idle" | "peak" | "turn")[] =
          sample.cell.s === "brick"
            ? ["idle", "peak", "turn"]
            : ["idle", "peak"];
        return [72, 158].flatMap((size) =>
          states.map((state) => ({
            ...measure(sample.cell, size, state),
            name: sample.name,
          })),
        );
      });
      const fisherFrames = [72, 158].flatMap((size) =>
        collectorFrames.map((_, index) => ({
          ...measure({ s: "splash" }, size, index === 0 ? "idle" : "peak", index),
          name: "Fisherman",
          frame: index,
        })),
      );
      const sheet = new Container();
      const sheetW = 620;
      const rowH = 172;
      const sheetH = 36 + samples.length * rowH + 8;
      sheet.addChild(new Graphics().rect(0, 0, sheetW, sheetH).fill({ color: 0x04121c }));
      const header = new Text({
        text: "72 idle      72 peak           158 idle           158 peak",
        style: { fill: 0xf0ddb4, fontFamily: "Source Sans 3", fontSize: 13, fontWeight: "700" },
      });
      header.position.set(112, 8);
      sheet.addChild(header);
      samples.forEach((sample, index) => {
        const y = 36 + index * rowH;
        const label = new Text({
          text: sample.name,
          style: { fill: 0xd7ecf2, fontFamily: "Source Sans 3", fontSize: 14, fontWeight: "700" },
        });
        label.position.set(8, y + 8);
        sheet.addChild(label);
        const slots = [
          { size: 72, state: "idle" as const, x: 112 },
          { size: 72, state: "peak" as const, x: 192 },
          { size: 158, state: "idle" as const, x: 280 },
          { size: 158, state: "peak" as const, x: 446 },
        ];
        for (const slot of slots) {
          const view = cellView(
            sample.cell,
            slot.size,
            true,
            sample.name === "Bulk kilos" ? 50_000_000 : undefined,
          );
          const sprite = view.children.find((child) => child instanceof Sprite);
          if (sprite instanceof Sprite && sample.cell.s === "brick" && slot.state === "peak") {
            applyPlace(sprite, fishReaction(210));
          } else if (sprite instanceof Sprite && sample.cell.s === "splash" && slot.state === "peak") {
            showReaction(sprite, collectorFrames, 4);
          }
          view.addChild(
            new Graphics()
              .rect(0, 0, slot.size, slot.size)
              .stroke({ color: 0x6d8c96, width: 1, alpha: 0.9 }),
          );
          view.position.set(slot.x, y + (164 - slot.size) / 2);
          sheet.addChild(view);
        }
      });
      const canvas = app.renderer.extract.canvas({
        target: sheet,
        resolution: 1,
        antialias: true,
        clearColor: [4, 18, 28, 255],
      }) as HTMLCanvasElement;
      sheet.destroy({ children: true });
      return { canvas, report: { rows, fisherFrames } };
    },
    finishPlate(text) {
      title.text = text;
      host.dataset.event = text;
      host.setAttribute("aria-label", `Kilo King reels. ${text}`);
      placeCopy();
    },
  };

  layout();
  scene.setTally({ line: 0, collect: 0, mult: 1, total: 0 });
  scene.setMeter(0, false, null, "Base game");
  const observer = new ResizeObserver(() => layout());
  observer.observe(host);

  return {
    ...Object.fromEntries(
      Object.entries(scene).map(([name, method]) => [
        name,
        (...args: unknown[]) => {
          if (destroyed) return;
          return (method as (...args: unknown[]) => unknown)(...args);
        },
      ]),
    ),
    destroy() {
      featureEffects.destroy();
      reelFeatureEffects.destroy();
      if (destroyed) return;
      collectionCue(null);
      stopped = true;
      job += 1;
      cancelWaits();
      clearFlyers();
      destroyed = true;
      observer.disconnect();
      app.destroy(true, { children: true });
      for (const asset of authoredTextures.values()) for (const texture of asset.frames) texture.destroy(false);
      authoredTextures.clear();
      host.replaceChildren();
    },
  } as ReelScene & { destroy(): void };
}
