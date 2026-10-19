/** Renderer-neutral attachments and authored motion. All positions are source pixels.
 * This is a small Canvas2D rig, not a Spine project or export. No game state lives here.
 */
export const ROOT = "/kilo-motion-v18/";
export const RIG = {
  canvas: [1536, 2304],
  feet: 2166,
  view: [160, 110, 1140, 2056],
  compactView: [160, 110, 1140, 1170],
  parts: {
    legs: { file: "legs.webp", rect: [250, 1110, 1000, 1056] },
    torso: {
      file: "torso.webp",
      rect: [438, 438, 620, 727],
      pivot: [760, 1130],
    },
    head: {
      file: "head-open.webp",
      blink: "head-closed.webp",
      rect: [550, 112, 440, 440],
      pivot: [745, 520],
    },
    leftUpper: {
      file: "arm-left-upper.webp",
      rect: [285, 530, 310, 407],
      pivot: [480, 560],
    },
    leftFore: {
      file: "arm-left-fore.webp",
      rect: [307, 875, 200, 412],
      pivot: [415, 918],
    },
    rightUpper: {
      file: "arm-right-upper.webp",
      rect: [825, 550, 278, 369],
      pivot: [931, 576],
    },
    rightFore: {
      file: "arm-right-fore.webp",
      rect: [987, 710, 303, 250],
      pivot: [1030, 895],
    },
    rod: {
      file: "rod.webp",
      rect: [1008, 492, 584, 574],
      pivot: [1235, 792],
      rest: -24,
    },
  },
};
export const ASSETS = Object.fromEntries(
  [
    ...new Set([
      ...Object.values(RIG.parts).flatMap((p) =>
        [p.file, p.blink].filter(Boolean),
      ),
      "marina-clean.webp",
      "boat-left.webp",
      "boat-right.webp",
      "reflection-left.webp",
      "reflection-right.webp",
      "foil-glint.webp",
      "gem-glint.webp",
      ...Array.from({ length: 8 }, (_, i) => `collector-${i}.png`),
    ]),
  ].map((file) => [file, ROOT + file]),
);
export const CLIPS = {
  idle: { duration: 4200, loop: true },
  cast: { duration: 1100, loop: false, events: [{ at: 370, name: "release" }] },
  cheer: { duration: 1000, loop: false },
  slump: { duration: 800, loop: false },
  collector: { duration: 800, loop: false },
  package: { duration: 420, loop: false },
  scatter: { duration: 420, loop: false },
};
const clamp = (x, min = 0, max = 1) => Math.max(min, Math.min(max, x));
const ease = (t) => t * t * (3 - 2 * t);
function track(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++)
    if (t <= keys[i][0]) {
      const a = keys[i - 1],
        b = keys[i];
      return a[1] + (b[1] - a[1]) * ease((t - a[0]) / (b[0] - a[0]));
    }
  return keys.at(-1)[1];
}
export function motionAt(pose = "idle", elapsed = 0, reduced = false) {
  const neutral = {
    body: 0,
    lift: 0,
    head: 0,
    leftUpper: 0,
    leftFore: 0,
    rightUpper: 0,
    rightFore: 0,
    rod: 0,
    blink: false,
  };
  if (reduced || !Number.isFinite(elapsed) || elapsed < 0) return neutral;
  const t = elapsed / 1000;
  if (pose === "idle" || elapsed >= (CLIPS[pose]?.duration ?? 0)) {
    const idleMs =
        pose === "idle" ? elapsed : elapsed - (CLIPS[pose]?.duration ?? 0),
      idleT = idleMs / 1000,
      fade = Math.min(1, idleT / 0.5),
      phase = (idleMs % 4200) / 4200;
    return {
      ...neutral,
      body: 0.32 * Math.sin(idleT * 1.49),
      lift: -3.5 * (1 - Math.cos(idleT * 1.49)),
      head: 0.65 * Math.sin(idleT * 1.49),
      leftFore: 0.7 * Math.sin(idleT * 1.49 + 0.8) * fade,
      rightFore: 0.55 * Math.sin(idleT * 1.49 + 0.6) * fade,
      rod: 0.6 * Math.sin(idleT * 1.49 + 1.2) * fade,
      blink: phase > 0.73 && phase < 0.762,
    };
  }
  if (pose === "cast")
    return {
      ...neutral,
      body: track(t, [
        [0, 0],
        [0.23, 2.2],
        [0.39, -1.8],
        [0.72, 0.4],
        [1.1, 0],
      ]),
      head: track(t, [
        [0, 0],
        [0.22, 2],
        [0.45, -3],
        [0.85, 0],
      ]),
      rightUpper: track(t, [
        [0, 0],
        [0.25, -10],
        [0.4, 10],
        [0.67, -2],
        [1.1, 0],
      ]),
      rightFore: track(t, [
        [0, 0],
        [0.26, -22],
        [0.42, 19],
        [0.72, -4],
        [1.1, 0],
      ]),
      rod: track(t, [
        [0, 0],
        [0.26, -13],
        [0.42, 14],
        [0.58, -7],
        [0.8, 3],
        [1.1, 0],
      ]),
      leftUpper: track(t, [
        [0, 0],
        [0.25, -2],
        [0.45, 5],
        [1.1, 0],
      ]),
      leftFore: track(t, [
        [0, 0],
        [0.4, -6],
        [1.1, 0],
      ]),
    };
  if (pose === "cheer")
    return {
      ...neutral,
      body: track(t, [
        [0, 0],
        [0.3, -1.5],
        [0.68, 0.3],
        [1, 0],
      ]),
      head: track(t, [
        [0, 0],
        [0.3, -4],
        [1, 0],
      ]),
      leftUpper: track(t, [
        [0, 0],
        [0.32, 12],
        [0.7, 8],
        [1, 0],
      ]),
      leftFore: track(t, [
        [0, 0],
        [0.32, -32],
        [0.7, -22],
        [1, 0],
      ]),
      rod: track(t, [
        [0, 0],
        [0.3, -4],
        [1, 0],
      ]),
      blink: t > 0.7 && t < 0.8,
    };
  return {
    ...neutral,
    head: track(t, [
      [0, 0],
      [0.3, 5],
      [0.8, 0],
    ]),
    body: track(t, [
      [0, 0],
      [0.3, 1],
      [0.8, 0],
    ]),
    blink: t > 0.25 && t < 0.38,
  };
}
function turn(ctx, deg, pivot) {
  ctx.translate(...pivot);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.translate(-pivot[0], -pivot[1]);
}
export function drawFisherman(
  ctx,
  assets,
  { pose = "idle", elapsed = 0, reduced = false, explode = 0 } = {},
) {
  const m = motionAt(pose, elapsed, reduced),
    p = RIG.parts;
  const paint = (name, file) => {
    const a = p[name],
      im = assets[file ?? a.file];
    if (im) ctx.drawImage(im, ...a.rect);
  };
  paint("legs");
  ctx.save();
  ctx.translate(0, m.lift);
  turn(ctx, m.body, p.torso.pivot);
  ctx.save();
  ctx.translate(-explode * 190, 0);
  turn(ctx, m.leftUpper, p.leftUpper.pivot);
  paint("leftUpper");
  ctx.save();
  turn(ctx, m.leftFore, p.leftFore.pivot);
  paint("leftFore");
  ctx.restore();
  ctx.restore();
  ctx.save();
  ctx.translate(explode * 220, 0);
  turn(ctx, m.rightUpper, p.rightUpper.pivot);
  paint("rightUpper");
  ctx.save();
  turn(ctx, m.rightFore, p.rightFore.pivot);
  ctx.save();
  turn(ctx, p.rod.rest + m.rod, p.rod.pivot);
  paint("rod");
  ctx.restore();
  paint("rightFore");
  ctx.restore();
  ctx.restore();
  paint("torso");
  ctx.save();
  ctx.translate(0, -explode * 200);
  turn(ctx, m.head, p.head.pivot);
  paint("head", m.blink ? p.head.blink : p.head.file);
  ctx.restore();
  ctx.restore();
}
export const MARINA = {
  size: [1672, 941],
  waterline: 276,
  boats: [
    {
      image: "boat-left.webp",
      reflection: "reflection-left.webp",
      rect: [112, 173, 222, 150],
      pivot: [214, 320],
      reflectionRect: [100, 323, 240, 490],
      period: 5.8,
      phase: 0.6,
    },
    {
      image: "boat-right.webp",
      reflection: "reflection-right.webp",
      rect: [1360, 158, 230, 157],
      pivot: [1470, 312],
      reflectionRect: [1355, 315, 235, 490],
      period: 7.1,
      phase: 2.4,
    },
  ],
};
export function drawMarina(
  ctx,
  assets,
  width,
  height,
  elapsed = 0,
  reduced = false,
) {
  const plate = assets["marina-clean.webp"];
  if (!plate) return;
  const s = Math.max(width / 1672, height / 941),
    x = (width - 1672 * s) / 2,
    y = (height - 941 * s) / 2,
    t = reduced ? 0 : elapsed / 1000;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.drawImage(plate, 0, 0, 1672, 941);
  // Water is a separate sampled layer, confined below pier occlusion. Sky and posts stay still.
  if (!reduced) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(120, 310);
    ctx.lineTo(1520, 310);
    ctx.lineTo(1672, 420);
    ctx.lineTo(1672, 941);
    ctx.lineTo(0, 941);
    ctx.lineTo(0, 420);
    ctx.closePath();
    ctx.clip();
    for (let row = 306; row < 941; row += 5) {
      const depth = (row - 276) / 665,
        dx = Math.sin(t * 1.6 + row * 0.035) * depth * 3.4;
      ctx.drawImage(plate, 0, row, 1672, 5, dx, row, 1672, 5);
    }
    ctx.restore();
  }
  for (const boat of MARINA.boats) {
    const r = assets[boat.reflection],
      b = assets[boat.image],
      phase = (t * 2 * Math.PI) / boat.period + boat.phase;
    if (r) {
      const [rx, ry, rw, rh] = boat.reflectionRect;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let line = 0; line < rh; line += 7) {
        const u = line / rh,
          sourceY = u * r.height,
          sourceH = Math.min(r.height - sourceY, (7 / rh) * r.height);
        ctx.globalAlpha =
          0.14 * (1 - u) * (0.85 + 0.15 * Math.sin(phase - 0.9 - u * 9));
        const dx = reduced ? 0 : Math.sin(phase - 1.1 + u * 15) * (2 + u * 6);
        ctx.drawImage(
          r,
          0,
          sourceY,
          r.width,
          sourceH,
          rx + dx,
          ry + line,
          rw,
          Math.min(7, rh - line),
        );
      }
      ctx.restore();
    }
    if (b) {
      ctx.save();
      ctx.translate(0, reduced ? 0 : Math.sin(phase) * 1.4);
      turn(ctx, reduced ? 0 : Math.sin(phase) * 0.85, boat.pivot);
      ctx.drawImage(b, ...boat.rect);
      ctx.restore();
    }
  }
  ctx.restore();
}
export function reactionAt(kind, elapsed, reduced = false) {
  const duration = kind === "collector" ? 800 : 420;
  if (
    reduced ||
    !Number.isFinite(elapsed) ||
    elapsed < 0 ||
    elapsed >= duration
  )
    return { frame: 0, alpha: 0, x: 0, y: 0, scale: 1 };
  const t = clamp(elapsed / duration);
  if (kind === "collector") {
    // Neutral → half blink → closed → reopen → restrained smile → neutral. Short eyelid exposure.
    const sequence = [0, 0, 1, 2, 1, 0, 3, 3, 6, 6, 6, 6, 6, 3, 3, 0];
    return {
      frame: sequence[Math.floor(elapsed / 50)] ?? 0,
      alpha: 0,
      x: 0,
      y: 0,
      scale: 1,
    };
  }
  return {
    frame: 0,
    alpha: Math.sin(Math.PI * t) ** 2 * (kind === "package" ? 0.4 : 0.7),
    x: kind === "package" ? 0.23 + 0.52 * t : 0.48,
    y: kind === "package" ? 0.29 + 0.08 * t : 0.25,
    scale: 0.08 + 0.08 * Math.sin(Math.PI * t),
  };
}
