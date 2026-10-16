import { SPIN_TIMING, type SpinSpeed } from "./control-model";
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
import { scatterBuild, landStop, teaseBegin, teaseResolve, whirStart, whirStop, winSting, bonusEnter, setAudioTurbo } from "@/lib/kilo/sound";
import {
  ART as ART_FILES,
  SOURCE_SLICES,
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

/**
 * Premium reel travel. Time is 0–1.
 * A short spool-up, a long constant cruise, then an ease into a flush lock.
 * Speed is zero at the line. There is no overshoot.
 */
function spinProgress(t: number) {
  const u = Math.max(0, Math.min(1, t));
  if (u < 0.1) return 0.069 * (u / 0.1) ** 2;
  if (u < 0.66) return 0.069 + 0.774 * ((u - 0.1) / 0.56);
  const s = (u - 0.66) / 0.34;
  return 0.843 + 0.157 * (1 - (1 - s) ** 3);
}

/** 1 during the cruise, 0 at the lock. Matches the derivative of spinProgress. */
function spinSpeed(t: number) {
  const u = Math.max(0, Math.min(1, t));
  if (u < 0.1) return u / 0.1;
  if (u < 0.66) return 1;
  const s = (u - 0.66) / 0.34;
  return (1 - s) ** 2;
}

/**
 * Anticipation travel. Brake out of the cruise, hold a readable creep,
 * then ease to the same flush lock. Never reverses.
 */
function crawlEase(t: number) {
  const u = Math.max(0, Math.min(1, t));
  if (u < 0.08) {
    const s = u / 0.08;
    return 0.18 * (1 - (1 - s) ** 2);
  }
  if (u < 0.82) return 0.18 + 0.68 * ((u - 0.08) / 0.74);
  const s = (u - 0.82) / 0.18;
  return 0.86 + 0.14 * (1 - (1 - s) ** 3);
}

function crawlSpeed(t: number) {
  const u = Math.max(0, Math.min(1, t));
  if (u < 0.08) return 1 - u / 0.08;
  if (u < 0.82) return 0.42;
  const s = (u - 0.82) / 0.18;
  return 0.42 * (1 - s) ** 2;
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
  app.canvas.style.display = "block";

  const urls = [
    ...new Set([
      ...Object.entries(ART)
        .filter(([sym]) => sym !== "brick" && sym !== "splash" && sym !== "bars")
        .map(([, url]) => url),
      artUrl("reel-well.png"),
      artUrl("reel-frame.png"),
      artUrl("modal-panel.png"),
      artUrl(TOOL_PIVOTS.hook.file),
      artUrl(TOOL_PIVOTS.dynamite.file),
      artUrl(TOOL_PIVOTS.bazooka.file),
      artUrl("fx-burst.png"),
      artUrl("fx-water-impact.png"),
      MOTION_ROOT + collectorAtlas.image,
      MOTION_ROOT + "retrigger-frame.svg",
      MOTION_ROOT + "value-plaque.svg",
      ...Object.values(PACKAGE_META).map((meta) => CONTRABAND_ROOT + meta.file),
      CONTRABAND_ROOT + SCATTER_KING.file,
      "/kilo-ui-v11/banner-entry.webp",
      "/kilo-ui-v11/banner-upgrade.webp",
    ]),
  ];
  await Promise.all(urls.map((url) => Assets.load(url)));
  const tex = (file: string) => Assets.get<Texture>(artUrl(file));
  const textures = Object.fromEntries(
    Object.entries(ART)
      .filter(([sym]) => sym !== "brick" && sym !== "splash" && sym !== "bars")
      .map(([sym, url]) => [sym, Assets.get<Texture>(url)]),
  ) as Record<Sym, Texture>;
  const wellTex = tex("reel-well.png");
  const frameTex = tex("reel-frame.png");
  const modalTex = tex("modal-panel.png");
  const entryTex =
    (Assets.get("/kilo-ui-v11/banner-entry.webp") as Texture | undefined) || modalTex;
  const upgradeTex =
    (Assets.get("/kilo-ui-v11/banner-upgrade.webp") as Texture | undefined) || modalTex;
  const hookTex = tex(TOOL_PIVOTS.hook.file);
  const dynamiteTex = tex(TOOL_PIVOTS.dynamite.file);
  const bazookaTex = tex(TOOL_PIVOTS.bazooka.file);
  const burstTex = tex("fx-burst.png");
  const impactTex = tex("fx-water-impact.png");
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
  const retriggerTex = motionTex("retrigger-frame.svg");
  const plaqueTex = motionTex("value-plaque.svg");

  const slice = (x: number, y: number, w: number, h: number) =>
    new Texture({
      source: frameTex.source,
      frame: new Rectangle(x, y, w, h),
    });
  const src = SOURCE_SLICES.reel;
  const frameTextures = [
    slice(0, 0, src.left, src.top),
    slice(src.left, 0, src.width - src.left - src.right, src.top),
    slice(src.width - src.right, 0, src.right, src.top),
    slice(0, src.top, src.left, src.height - src.top - src.bottom),
    slice(
      src.left,
      src.top,
      src.width - src.left - src.right,
      src.height - src.top - src.bottom,
    ),
    slice(
      src.width - src.right,
      src.top,
      src.right,
      src.height - src.top - src.bottom,
    ),
    slice(0, src.height - src.bottom, src.left, src.bottom),
    slice(
      src.left,
      src.height - src.bottom,
      src.width - src.left - src.right,
      src.bottom,
    ),
    slice(
      src.width - src.right,
      src.height - src.bottom,
      src.right,
      src.bottom,
    ),
  ];

  const world = new Container();
  app.stage.addChild(world);
  const well = new TilingSprite({ texture: wellTex, width: 10, height: 10 });
  const veil = new Graphics();
  const routes = new Graphics();
  const frame = frameTextures.map((texture) => new Sprite(texture));
  const transient = new Container();
  const fx = new Graphics();
  const lineArt = new Container();
  const locks = new Graphics();
  const reels: { root: Container; strip: Container; mask: Graphics }[] = [];
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
  world.addChild(well, veil, routes);
  for (const reel of reels) world.addChild(reel.root);
  for (const piece of frame) world.addChild(piece);
  frame[4]!.visible = false;
  world.addChild(fx, lineArt, locks, title, transient);

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

  function playFishAck(sprite: Sprite | null) {
    const mark = (sprite as Placed | null)?.kkPlace;
    if (!sprite || !mark?.asset.startsWith("package-")) return Promise.resolve();
    const ms = reduced ? 0 : turbo ? Math.round(420 * 0.45) : 420;
    return tween(ms, (t) => {
      if (sprite.destroyed) return;
      applyPlace(sprite, fishReaction(t * 420, reduced));
    }).then(() => {
      if (!sprite.destroyed) applyPlace(sprite, { scale: 1, rotation: 0 });
    });
  }

  function cellView(cell: SplashCell, size: number, decor = true, printed?: number) {
    const root = new Container();
    if (cell.s === "brick") {
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
    }
  }

  function placeFrame() {
    const { cab } = geom;
    const edge = frameBorders(cab);
    const cols = [edge.l, cab.w - edge.l - edge.r, edge.r];
    const rows = [edge.t, cab.h - edge.t - edge.b, edge.b];
    let i = 0;
    let y = cab.y;
    for (let r = 0; r < 3; r++) {
      let x = cab.x;
      for (let c = 0; c < 3; c++) {
        const piece = frame[i++]!;
        piece.position.set(x, y);
        piece.width = Math.max(1, cols[c]!);
        piece.height = Math.max(1, rows[r]!);
        x += cols[c]!;
      }
      y += rows[r]!;
    }
    // The nine-slice bands contain transparent padding. Extend the well
    // behind them so the marina never appears between the metal and reels.
    const openingY = cab.y + edge.t;
    const innerH = Math.max(1, cab.h - edge.t - edge.b);
    well.position.set(cab.x + 6, cab.y + 6);
    well.width = cab.w - 12;
    well.height = cab.h - 12;
    well.tint = 0x6b96a4;
    well.tileScale.set(Math.max(1.2, geom.cell / 110));
    veil.clear();
    veil
      .rect(well.x, well.y, well.width, well.height)
      .fill({ color: 0x03131c, alpha: 0.64 });
    for (let i = 1; i < 5; i++) {
      const x = geom.gx + i * (geom.cell + geom.gap) - geom.gap / 2;
      veil
        .moveTo(x, openingY)
        .lineTo(x, openingY + innerH)
        .stroke({ color: 0x74b6ba, alpha: 0.1, width: 1 });
    }
  }

  function drawCabinet() {
    const { cell, gap, gx, gy } = geom;
    placeFrame();
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
    if (animating && resizeFollow) {
      host.dispatchEvent(new CustomEvent("kilo-relayout"));
      return;
    }
    placeCopy();
  }

  function phaseTarget() {
    const target = host.closest("[data-testid='reel-host']") ?? host;
    return target instanceof HTMLElement ? target : host;
  }
  function restoreSymbols() {
    for (const reel of reels)
      for (const child of reel.strip.children)
        if (!child.destroyed) child.alpha = 1;
  }
  function clearPresentation() {
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
    sprite: Sprite | null,
    frames: Texture[],
    sequence: number[],
    frameMs: number,
  ) {
    if (!sprite) return Promise.resolve();
    const total = sequence.length * frameMs;
    const ms = reduced ? 0 : turbo ? Math.round(total * 0.45) : total;
    return tween(ms, (t) => {
      if (sprite.destroyed) return;
      showReaction(
        sprite,
        frames,
        reactionIndex(sequence, frameMs, t * total, reduced),
      );
    }).then(() => {
      if (!sprite.destroyed) showReaction(sprite, frames, 0);
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
    const number = root
      .querySelector("[data-testid=bonus-win]")
      ?.getBoundingClientRect();
    const block = root.querySelector(".kk-bonus-win")?.getBoundingClientRect();
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
      phase: "spin" | "crawl" | "done";
      crawlFrom: number;
      crawlTo: number;
      crawlMs: number;
      crawlT: number;
      frame: number;
      noted: boolean;
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
        crawlFrom: startY,
        crawlTo: endY,
        crawlMs: turbo ? 560 : 1400,
        crawlT: 0,
        frame: 0,
        noted: false,
      };
    });
    const scatterReels: number[] = [];
    let teaseLive = false;
    const target = phaseTarget();
    target.dataset.anticipation = "off";
    if (!reduced) whirStart();
    let tickAt = 0;
    let tickStep = 0;
    const pulses: { reel: number; at: number; scatter: boolean }[] = [];
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
    };
    const streakMax = Math.min(6.5, cell * (turbo ? 0.055 : 0.042));
    const noteLand = (spin: Spin, now: number) => {
      if (spin.noted) return;
      spin.noted = true;
      const isScatter = !!grid[spin.reel]?.some((c) => c.s === "bars");
      if (isScatter) {
        scatterReels.push(spin.reel);
        pulses.push({ reel: spin.reel, at: now, scatter: true });
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
        spin.phase = "done";
        spin.strip.position.y = spin.endY;
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
          if (spin.phase === "spin") {
            spin.progress = Math.min(1, spin.progress + spin.rate * dt);
            const p = spinProgress(spin.progress);
            spin.strip.position.y = spin.startY + (spin.endY - spin.startY) * p;
            if (spin.progress < 1) {
              setStreak(spin.reel, spinSpeed(spin.progress) * streakMax);
              pending = true;
              continue;
            }
            lockReel(spin, now);
            continue;
          } else if (spin.phase === "crawl") {
            spin.crawlT += dt;
            const u = Math.min(1, spin.crawlT / Math.max(1, spin.crawlMs));
            spin.strip.position.y =
              spin.crawlFrom + (spin.crawlTo - spin.crawlFrom) * crawlEase(u);
            spin.frame = Math.min(1, spin.frame + dt / 120);
            if (u < 1) {
              setStreak(spin.reel, crawlSpeed(u) * streakMax * 0.65);
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
          const pulse = 0.55 + 0.4 * Math.sin(now / 80);
          fx.roundRect(reelX - 5, geom.gy - 5, cell + 10, cell * 3 + 10, 12).fill({
            color: 0x12383a,
            alpha: 0.16 * spin.frame,
          });
          fx.roundRect(reelX - 4, geom.gy - 4, cell + 8, cell * 3 + 8, 10).stroke({
            width: 4,
            color: 0xffd56a,
            alpha: pulse * spin.frame,
          });
        }
        for (const pulse of pulses) {
          const age = (now - pulse.at) / (pulse.scatter ? 420 : 220);
          if (age >= 1) continue;
          const reelX = geom.gx + pulse.reel * (cell + geom.gap);
          fx.roundRect(reelX - 3, geom.gy - 3, cell + 6, cell * 3 + 6, 8).stroke({
            width: pulse.scatter ? 5 : 3,
            color: pulse.scatter ? 0xfff1b8 : 0xffd56a,
            alpha: (1 - age) * (pulse.scatter ? 1 : 0.8),
          });
        }
        if (building && !landedNow && now - tickAt > (turbo ? 120 : 160)) {
          scatterBuild(tickStep);
          tickStep += 1;
          tickAt = now;
        }
        if (pending) raf = requestAnimationFrame(run);
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

  async function burstWin(line: SplashLine, sound = true) {
    const cells = winningCells(line);
    const tier: 0 | 1 | 2 =
      line.pay >= stake * 15 ? 2 : line.pay >= stake * 4 ? 1 : 0;
    if (sound) winSting(tier);
    if (reduced || stopped || !cells.length) return;
    const bits: Graphics[] = [];
    const views: { view: Container; row: number; reel: number }[] = [];
    for (const spot of cells) {
      const view = reels[spot.reel]?.strip.children[spot.row] as Container | undefined;
      if (view && !view.destroyed) {
        const size = geom.cell;
        view.pivot.set(size / 2, size / 2);
        view.position.set(size / 2, spot.row * size + size / 2);
        views.push({ view, row: spot.row, reel: spot.reel });
      }
    }
    const count = 7 + tier * 5;
    const origins = cells.map((spot) => cellCenter(spot.reel, spot.row));
    for (let i = 0; i < count; i++) {
      const origin = origins[i % origins.length]!;
      const bit = new Graphics();
      lineArt.addChild(bit);
      bits.push(bit);
      (bit as Graphics & { kk?: { ang: number; dist: number; r: number; color: number; ox: number; oy: number } }).kk = {
        ang: (Math.PI * 2 * i) / count + (i % 2) * 0.2,
        dist: geom.cell * (0.28 + (i % 4) * 0.1) * (1 + tier * 0.22),
        r: 2.2 + (i % 3) + tier * 0.4,
        color: i % 3 === 0 ? 0xfff6dd : i % 3 === 1 ? 0xffd56a : 0x7ee7ff,
        ox: origin.x,
        oy: origin.y,
      };
    }
    const ms = turbo ? 200 : tier === 2 ? 620 : 440;
    await tween(ms, (t) => {
      const e = 1 - (1 - t) ** 2;
      const pop = Math.sin(Math.min(1, t * 1.4) * Math.PI);
      for (const item of views) {
        if (item.view.destroyed) continue;
        item.view.scale.set(1 + pop * (0.06 + tier * 0.03));
      }
      for (const bit of bits) {
        if (bit.destroyed) continue;
        const k = (bit as Graphics & { kk: { ang: number; dist: number; r: number; color: number; ox: number; oy: number } }).kk;
        const x = k.ox + Math.cos(k.ang) * k.dist * e;
        const y = k.oy + Math.sin(k.ang) * k.dist * e - t * geom.cell * 0.08;
        bit.clear().circle(x, y, k.r * (1 - t * 0.35)).fill({ color: k.color, alpha: 1 - t });
      }
    });
    for (const item of views) {
      if (item.view.destroyed) continue;
      const size = geom.cell;
      item.view.scale.set(1);
      item.view.pivot.set(0, 0);
      item.view.position.set(0, item.row * size);
    }
    for (const bit of bits) if (!bit.destroyed) bit.destroy();
  }

  const scene: ReelScene = {
    setStake(n) {
      stake = n;
    },
    setPace(nextTurbo, nextReduced, speed) {
      speedMode = speed ?? (nextTurbo ? "turbo" : "normal");
      turbo = speedMode !== "normal";
      reduced = nextReduced;
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
    show(grid) {
      collectionCue(null);
      job += 1;
      animating = false;
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
    async highlight(lines) {
      clearPresentation();
      if (!lines.length || stopped) return;
      mark("line");
      const { cell } = geom;
      const colors = [0xffd56a, 0x7ee7ff, 0xff9ad5, 0xc6f59a, 0xffb067];
      const target = phaseTarget();
      target.dataset.payline = lines
        .map((line) => {
          const cells = winningCells(line)
            .map((spot) => `${spot.reel}.${spot.row}`)
            .join("-");
          return `${line.n}x${line.s}=${line.pay}@${cells}`;
        })
        .join("|");
      const gridCenter =
        geom.gx + (cell * 5 + geom.gap * 4) / 2;
      const focus = (index: number) => {
        const line = lines[index];
        if (!line) return;
        fx.clear();
        routes.clear();
        lineArt.removeChildren().forEach((child) => child.destroy());
        const cells = winningCells(line);
        const win = new Set(cells.map((spot) => `${spot.reel}:${spot.row}`));
        reels.forEach((reel, ri) =>
          reel.strip.children.forEach((child, row) => {
            if (!child.destroyed) child.alpha = win.has(`${ri}:${row}`) ? 1 : 0.72;
          }),
        );
        // The route sits behind the reels, so the symbol art stays on top of the stroke.
        if (cells.length >= 2) {
          const pts = cells.map((spot) => cellCenter(spot.reel, spot.row));
          routes.moveTo(pts[0]!.x, pts[0]!.y);
          for (let i = 1; i < pts.length; i++) routes.lineTo(pts[i]!.x, pts[i]!.y);
          routes.stroke({
            width: Math.max(5, cell * 0.07),
            color: colors[index % colors.length]!,
            alpha: 0.95,
            cap: "round",
            join: "round",
          });
        }
        const shown = line.s === "brick" ? "package" : line.s;
        const text =
          lines.length > 1
            ? `Line ${index + 1} of ${lines.length} · ${line.n} × ${shown} · ${money(line.pay)}`
            : `${line.n} × ${shown} · ${money(line.pay)}`;
        const label = new Text({
          text,
          style: {
            fill: 0xfff6dd,
            fontFamily: "Source Sans 3",
            fontSize: Math.max(13, Math.min(18, Math.round(cell * 0.11))),
            fontWeight: "700",
          },
        });
        label.anchor.set(0.5, 0);
        const plateW = label.width + 20;
        const plateH = label.height + 8;
        const plate = new Graphics()
          .roundRect(-plateW / 2, 0, plateW, plateH, 8)
          .fill({ color: 0x071018, alpha: 0.92 });
        const edge = frameBorders(geom.cab);
        const belowSymbols = geom.gy + cell * 3 + 4;
        const inBezel =
          geom.cab.y + geom.cab.h - edge.b + Math.max(0, (edge.b - plateH) / 2);
        const y = Math.min(
          geom.dh - plateH - 2,
          Math.max(belowSymbols, inBezel),
        );
        plate.position.set(gridCenter, y);
        label.position.set(gridCenter, y + 4);
        lineArt.addChild(plate, label);
        target.dataset.paylineFocus = String(index);
      };
      if (lines.length < 2) {
        focus(0);
        await Promise.all([
          holdReadable(turbo ? 420 : 900),
          burstWin(lines[0]!),
        ]);
        return;
      }
      // Shared cells stack if every route is drawn at once. Cycle the recorded wins; pays stay as stored.
      for (let index = 0; index < lines.length; index++) {
        if (stopped) return;
        focus(index);
        await Promise.all([
          holdReadable(turbo ? 320 : 1100),
          burstWin(lines[index]!, index === 0),
        ]);
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
      let active: { reel: number; row: number } | null = null;
      const onLayout = () => {
        if (!live() || chip.destroyed) return;
        repaint();
        if (active) focus(active);
      };
      host.addEventListener("kilo-relayout", onLayout);
      const paintPlaque = (
        lines: { text: string; color: number; size: number }[],
        where:
          | { kind: "collector"; reel: number; row: number }
          | { kind: "total" },
      ) => {
        if (chip.destroyed) return { x: 0, y: 0, top: 0, height: 0, width: 0 };
        chip.removeChildren().forEach((child) => child.destroy());
        const nodes = lines.map((line) => {
          const node = new Text({
            text: line.text,
            style: {
              fill: line.color,
              fontFamily: "Source Sans 3",
              fontWeight: "700",
              fontSize: line.size,
              align: "center",
            },
          });
          node.anchor.set(0.5, 0);
          return node;
        });
        const metrics = () => {
          let width = 1;
          let height = 0;
          nodes.forEach((node, index) => {
            width = Math.max(width, node.width);
            height += node.height + (index ? 3 : 0);
          });
          return { width, height };
        };
        const cellNow = geom.cell;
        const edgeNow = frameBorders(geom.cab);
        // Inset from the canvas bottom so the award clears the footer seam.
        const seamPad = Math.max(8, Math.round(Math.min(14, cellNow * 0.08)));
        const bezelTop = geom.cab.y + geom.cab.h - edgeNow.b + 2;
        const bezelBot = Math.min(
          geom.dh - seamPad,
          geom.cab.y + geom.cab.h - seamPad,
        );
        const bezelH = Math.max(14, bezelBot - bezelTop);
        // Bottom of the bust is left open (the face uses the top 80%).
        const bandH = cellNow * 0.18;
        const maxW =
          where.kind === "total"
            ? Math.min(geom.cab.w * 0.7, cellNow * 4.4)
            : cellNow * 0.9;
        const maxH =
          where.kind === "total"
            ? Math.max(bezelH, Math.min(36, Math.round(cellNow * 0.32)))
            : bandH;
        const padX = Math.max(6, Math.round(cellNow * 0.03));
        const padY = where.kind === "total" ? 3 : 2;
        const limitW = Math.max(10, maxW - padX * 2);
        const limitH = Math.max(10, maxH - padY * 2);
        let box = metrics();
        for (let guard = 0; guard < 16; guard++) {
          let changed = false;
          for (const node of nodes) {
            if (node.width > limitW && Number(node.style.fontSize) > 9) {
              const fit = Math.min(0.88, (limitW / Math.max(1, node.width)) * 0.96);
              node.style.fontSize = Math.max(
                9,
                Math.floor(Number(node.style.fontSize) * fit),
              );
              changed = true;
            }
          }
          box = metrics();
          if (box.height > limitH) {
            const fit = Math.min(0.88, limitH / Math.max(1, box.height));
            nodes.forEach((node) => {
              node.style.fontSize = Math.max(
                9,
                Math.floor(Number(node.style.fontSize) * fit),
              );
            });
            changed = true;
            box = metrics();
          }
          if (!changed) break;
        }
        const boxW = box.width + padX * 2;
        const boxH = box.height + padY * 2;
        const back = new Graphics()
          .roundRect(-boxW / 2, 0, boxW, boxH, 8)
          .fill({ color: 0x071820, alpha: 0.94 })
          .stroke({ color: 0xe5c17a, width: 2 });
        chip.addChild(back);
        let cursor = padY;
        for (const node of nodes) {
          node.position.set(0, cursor);
          cursor += node.height + 2;
          chip.addChild(node);
        }
        if (where.kind === "total") {
          const centerX = geom.gx + (cellNow * 5 + geom.gap * 4) / 2;
          const frameTop = geom.cab.y + geom.cab.h - edgeNow.b;
          let y = bezelTop + Math.max(0, (bezelBot - bezelTop - boxH) / 2);
          if (y + boxH > bezelBot) y = bezelBot - boxH;
          // A short phone lip cannot hold the award. Sit it above the frame
          // instead of letting the clamp drop it onto the footer seam.
          if (y < bezelTop) y = frameTop - boxH - 2;
          const faceLimit = geom.gy + cellNow * 3 - cellNow * 0.28;
          if (y < faceLimit) y = faceLimit;
          chip.position.set(centerX, y);
        } else {
          const top = geom.gy + where.row * cellNow;
          const bandTop = top + cellNow * 0.8;
          const bandBot = top + cellNow - Math.max(3, cellNow * 0.02);
          const homeX =
            geom.gx + where.reel * (cellNow + geom.gap) + cellNow / 2;
          chip.position.set(homeX, Math.max(bandTop, bandBot - boxH));
        }
        return {
          x: chip.position.x,
          y: chip.position.y + boxH / 2,
          top: chip.position.y,
          height: boxH,
          width: boxW,
        };
      };
      const focus = (wild: { reel: number; row: number }) => {
        fx.clear();
        const hot = new Set([
          `${wild.reel}:${wild.row}`,
          ...fish.map((spot) => `${spot.reel}:${spot.row}`),
        ]);
        reels.forEach((reel, ri) =>
          reel.strip.children.forEach((child, row) => {
            if (!child.destroyed) child.alpha = hot.has(`${ri}:${row}`) ? 1 : 0.48;
          }),
        );
      };
      const showCollector = (
        lines: { text: string; color: number; size: number }[],
        wild: { reel: number; row: number },
      ) => {
        repaint = () =>
          paintPlaque(lines, {
            kind: "collector",
            reel: wild.reel,
            row: wild.row,
          });
        repaint();
      };
      const flyFish = async (
        spot: { reel: number; row: number },
        value: number,
        wild: { reel: number; row: number },
      ) => {
        const label = new Text({
          text: money(value),
          style: {
            fill: 0xffefbc,
            fontFamily: "Source Sans 3",
            fontWeight: "700",
            fontSize: Math.max(15, Math.round(geom.cell * 0.15)),
            stroke: { color: 0x031920, width: Math.max(3, geom.cell * 0.02) },
          },
        });
        label.anchor.set(0.5);
        label.alpha = 0;
        transient.addChild(label);
        const mix = (
          a: { x: number; y: number },
          b: { x: number; y: number },
          u: number,
        ) => {
          const e = u * u * (3 - 2 * u);
          return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
        };
        await tween(pace(500), (t) => {
          if (label.destroyed) return;
          const cellNow = geom.cell;
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
          let pos =
            t < 0.2
              ? mix(start, lifted, t / 0.2)
              : t < 0.58
                ? mix(lifted, crossed, (t - 0.2) / 0.38)
                : mix(crossed, sink, Math.min(1, (t - 0.58) / 0.42));
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
          const fadeIn = Math.min(1, t / 0.08);
          const fadeOut = t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.18);
          label.alpha = fadeIn * fadeOut;
        });
        if (!label.destroyed) label.destroy();
      };
      try {
        step("gather");
        for (const [wi, wild] of collectors.entries()) {
          if (!live()) break;
          active = wild;
          focus(wild);
          if (!chip.destroyed)
            chip.removeChildren().forEach((child) => child.destroy());
          const reactions = Promise.all([
            playReaction(
              symbolSprite(wild.reel, wild.row),
              collectorFrames,
              collectorAtlas.sequence,
              collectorAtlas.frameMs,
            ),
            ...fish.map((spot) => playFishAck(symbolSprite(spot.reel, spot.row))),
          ]);
          const share = (table[wi] ?? []).reduce((sum, value) => sum + value, 0);
          const beforeCap = printed * spin.mult;
          const credited = even ? beforeCap : share;
          const amountSize = Math.max(18, Math.round(geom.cell * 0.22));
          const eqSize = Math.max(16, Math.round(geom.cell * 0.17));
          let shown = 0;
          const publish = () =>
            collectionCue({
              index: wi + 1,
              count: collectors.length,
              mult: spin.mult,
              subtotal: shown,
              completed: 0,
              phase: "gather",
              capped,
            });
          if (reduced) {
            shown = credited;
            if (capped || credited !== beforeCap) {
              showCollector(
                [
                  { text: "BEFORE CAP", color: 0x9ef0e6, size: Math.max(11, geom.cell * 0.1) },
                  { text: money(beforeCap), color: 0xffefbc, size: eqSize },
                  { text: money(credited), color: 0xfff6dd, size: amountSize },
                ],
                wild,
              );
            } else showCollector([{ text: money(credited), color: 0xfff6dd, size: amountSize }], wild);
            publish();
          } else {
            for (let index = 0; index < fish.length && live(); index++) {
              const spot = fish[index]!;
              const value = faces[index] ?? 0;
              await flyFish(spot, value, wild);
              if (!live()) break;
              shown += value;
              showCollector([{ text: money(shown), color: 0xfff6dd, size: amountSize }], wild);
              publish();
              await sleep(pace(340));
            }
            if (live() && shown > 0 && spin.mult > 1) {
              showCollector(
                [{ text: `${money(shown)} ×${spin.mult}`, color: 0xffefbc, size: eqSize }],
                wild,
              );
              publish();
              await sleep(pace(720));
            }
            if (live() && (capped || credited !== beforeCap)) {
              showCollector(
                [
                  { text: "BEFORE CAP", color: 0x9ef0e6, size: Math.max(11, geom.cell * 0.1) },
                  { text: money(beforeCap), color: 0xffefbc, size: eqSize },
                ],
                wild,
              );
              publish();
              await sleep(pace(640));
            }
            if (live()) {
              showCollector(
                [{ text: money(credited), color: 0xfff6dd, size: amountSize }],
                wild,
              );
              shown = credited;
              publish();
              await sleep(pace(640));
            }
          }
          await reactions;
        }
        if (live()) {
          step("total");
          const totalSize = Math.max(26, Math.round(geom.cell * 0.28));
          const totalLines = capped
            ? [
                { text: "BEFORE CAP", color: 0x9ef0e6, size: Math.max(12, Math.round(geom.cell * 0.11)) },
                { text: money(illustrated), color: 0xffefbc, size: Math.max(14, Math.round(geom.cell * 0.14)) },
                { text: "MAX WIN REACHED", color: 0xffd56a, size: Math.max(12, Math.round(geom.cell * 0.11)) },
                { text: money(spin.got), color: 0xfff6dd, size: totalSize },
              ]
            : [{ text: money(spin.got), color: 0xfff6dd, size: totalSize }];
          let awardSpot: { x: number; y: number } | null = null;
          let showAward = true;
          repaint = () => {
            const spot = paintPlaque(totalLines, { kind: "total" });
            awardSpot = { x: spot.x, y: spot.y };
            if (!showAward && !chip.destroyed)
              chip.removeChildren().forEach((child) => child.destroy());
          };
          repaint();
          await sleep(pace(720));
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
              if (t > 0.68) alpha = Math.max(0, 1 - (t - 0.68) / 0.24);
              const clearance = numberTop - (y + half);
              if (clearance < 22) alpha = Math.min(alpha, Math.max(0, clearance / 22));
              placeFly(x, y, alpha, 1.04 - 0.06 * e);
            });
            el.remove();
            flyers.delete(el);
          }
          if (live()) {
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
          reels.forEach((reel) =>
            reel.strip.children.forEach((child) => {
              if (!child.destroyed) child.alpha = 1;
            }),
          );
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
        el.src = "/kilo-motion-v7/collector-idle.png";
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
        await tween(turbo ? 180 : 360, (t) => {
          if (!hook || hook.destroyed) return;
          const e = 1 - (1 - t) ** 3;
          const swing = Math.sin(t * Math.PI);
          hook.position.set(
            x + swing * cell * 0.14,
            approach + (eye - approach) * e,
          );
          hook.rotation = -0.25 * (1 - t);
          hook.scale.set(s * (1 + swing * 0.08));
          rope(2.5);
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
        await tween(turbo ? 260 : 600, (t) => {
          fx.clear();
          const bomb = spin.tool === "dynamite";
          const wind = bomb ? t < 0.32 : t < 0.28;
          const impact = wind
            ? 0
            : bomb
              ? (t - 0.32) / 0.68
              : (t - 0.28) / 0.72;
          if (!prop.destroyed) {
            if (bomb) {
              const shake = wind ? Math.sin(t * 70) * geom.cell * 0.035 : 0;
              prop.position.set(
                at.x + shake,
                at.y - (wind ? geom.cell * 0.08 : 0),
              );
              prop.rotation = wind ? Math.sin(t * 46) * 0.12 : (t - 0.32) * 0.6;
              prop.alpha = t < 0.74 ? 1 : 1 - (t - 0.74) / 0.26;
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
            fx.circle(p.x, p.y, geom.cell * (0.08 + 0.34 * impact)).stroke({
              color: bomb ? 0xffbb5b : 0x5eddd7,
              width: 4,
              alpha: Math.max(0, 1 - impact * 1.35),
            });
            fx.circle(p.x, p.y, geom.cell * (0.03 + 0.16 * impact)).stroke({
              color: 0xfff1c4,
              width: 2,
              alpha: Math.max(0, (1 - impact * 1.35) * 0.9),
            });
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
        if (!prop.destroyed) prop.destroy();
        if (!burst.destroyed) burst.destroy();
      }
      if (mine !== job) {
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
      const label = round.mode === "chopper" ? "Chopper" : "Free spins";
      bonusEnter(round.mode);
      if (!reduced && !stopped) {
        const flash = new Graphics();
        transient.addChild(flash);
        await tween(turbo ? 100 : 200, (t) => {
          if (flash.destroyed) return;
          const a = t < 0.42 ? t / 0.42 : 1 - (t - 0.42) / 0.58;
          flash.clear().rect(0, 0, geom.dw, geom.dh).fill({ color: 0xfff6dd, alpha: 0.34 * a });
        });
        if (!flash.destroyed) flash.destroy();
      }
      await ceremony(
        "entry",
        label,
        `${round.awarded} spins · Starts at ×${collectMult(round.banked)}`,
        round.mods.length
          ? round.mods.map((mod) => names[mod] ?? mod).join(" · ")
          : "",
        turbo ? 780 : 1500,
      );
    },
    async retrigger(extra, nextMult, onAward) {
      const mine = job;
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
          fontSize: Math.max(18, Math.min(48, w * 0.15)),
          align: "center",
        },
      });
      const free = new Text({
        text: "Free spins",
        style: {
          fill: 0xe3f0e7,
          fontFamily: DISPLAY,
          fontWeight: "600",
          fontSize: Math.max(14, Math.min(22, w * 0.052)),
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
      spins.position.set(x + w / 2, y + h * 0.43);
      free.position.set(x + w / 2, y + h * 0.64);
      next.position.set(x + w / 2, y + h * 0.82);
      content.addChild(spins, free, next);
      group.addChild(dim, modal, content);
      const fade = reduced ? 0 : turbo ? 90 : 160;
      const half = Math.max(0, motionMs.retriggerAnnouncement / 2 - fade);
      group.alpha = 0;
      try {
        await tween(fade, (t) => {
          if (!group.destroyed) group.alpha = t;
        });
        await holdReadable(turbo ? 200 : half);
        if (mine !== job || stopped) return;
        onAward?.();
        await holdReadable(turbo ? 200 : half);
        if (mine === job && !stopped && fade > 0)
          await tween(fade, (t) => {
            if (!group.destroyed) group.alpha = 1 - t;
          });
      } finally {
        if (!group.destroyed) group.destroy({ children: true });
        bonus?.classList.remove("is-awarding");
      }
    },
    symbolCompare() {
      const samples: { name: string; cell: SplashCell; reaction: boolean }[] = [
        { name: "Small package", cell: { s: "brick", v: 2, w: 1, h: 1 }, reaction: true },
        { name: "Medium package", cell: { s: "brick", v: 25, w: 1, h: 1 }, reaction: true },
        { name: "Trophy package", cell: { s: "brick", v: 200, w: 1, h: 1 }, reaction: true },
        { name: "King package", cell: { s: "brick", v: 5000, w: 1, h: 1 }, reaction: true },
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
            sample.name === "King package" ? 50_000_000 : undefined,
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
      if (destroyed) return;
      collectionCue(null);
      stopped = true;
      job += 1;
      cancelWaits();
      clearFlyers();
      destroyed = true;
      observer.disconnect();
      app.destroy(true, { children: true });
      host.replaceChildren();
    },
  } as ReelScene & { destroy(): void };
}
