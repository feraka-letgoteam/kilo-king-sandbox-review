import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import {
  ASSETS,
  RIG,
  drawFisherman,
  drawMarina,
  reactionAt,
} from "../public/kilo-motion-v18/motion.mjs";
const require = createRequire(import.meta.url);
const { createCanvas, loadImage } = require(
  require.resolve("@napi-rs/canvas", {
    paths: [process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || process.cwd()],
  }),
);
const out = path.resolve("public/kilo-motion-v18/proofs");
await fs.mkdir(out, { recursive: true });
const assets = Object.fromEntries(
  await Promise.all(
    Object.entries(ASSETS).map(async ([name, url]) => [
      name,
      await loadImage(path.resolve("public" + url)),
    ]),
  ),
);
assets.package = await loadImage(
  "public/kilo-contraband-v1/package-trophy.png",
);
assets.scatter = await loadImage("public/kilo-contraband-v1/scatter-king.png");
function figure(ctx, x, y, width, height, pose, elapsed, explode = 0) {
  const scale = Math.min(width / 1536, height / 2304);
  ctx.save();
  ctx.translate(
    x + (width - 1536 * scale) / 2,
    y + (height - 2304 * scale) / 2,
  );
  ctx.scale(scale, scale);
  drawFisherman(ctx, assets, { pose, elapsed, explode });
  ctx.restore();
}
function proof(time = 0) {
  const c = createCanvas(1440, 900),
    ctx = c.getContext("2d");
  ctx.fillStyle = "#06131e";
  ctx.fillRect(0, 0, 1440, 900);
  ctx.fillStyle = "#e7d9ac";
  ctx.font = "600 24px sans-serif";
  ctx.fillText("KILO KING / MOTION STUDY 18", 40, 48);
  ctx.fillStyle = "#8faebc";
  ctx.font = "14px sans-serif";
  ctx.fillText(
    "Authored asset render • jointed character • independent boats/reflections • symbol material reactions",
    40,
    76,
  );
  ctx.save();
  ctx.translate(590, 110);
  drawMarina(ctx, assets, 810, 455, time, false);
  ctx.restore();
  const phase = time % 6000,
    pose =
      phase < 1800
        ? "idle"
        : phase < 2900
          ? "cast"
          : phase < 4200
            ? "idle"
            : phase < 5200
              ? "cheer"
              : "idle";
  const poseTime =
    pose === "cast" ? phase - 1800 : pose === "cheer" ? phase - 4200 : time;
  figure(ctx, 0, 100, 570, 780, pose, poseTime);
  ctx.fillStyle = "#e7d9ac";
  ctx.font = "600 19px sans-serif";
  ctx.fillText(`FISHERMAN / ${pose.toUpperCase()}`, 38, 848);
  ctx.fillStyle = "#8faebc";
  ctx.font = "13px sans-serif";
  ctx.fillText(
    "Planted feet • shoulder / elbow / wrist • neck • blink",
    38,
    874,
  );
  for (const [i, kind] of ["collector", "package", "scatter"].entries()) {
    const x = 620 + i * 260,
      y = 610,
      size = 158,
      t = (time % 2200) - 300,
      rx = reactionAt(kind, t);
    ctx.fillStyle = "#102738";
    ctx.beginPath();
    ctx.roundRect(x - 10, y - 10, 178, 215, 12);
    ctx.fill();
    const im =
      kind === "collector" ? assets[`collector-${rx.frame}.png`] : assets[kind];
    ctx.drawImage(im, x, y, size, size);
    if (kind !== "collector" && rx.alpha) {
      ctx.save();
      ctx.globalAlpha = rx.alpha;
      const fx =
        assets[kind === "package" ? "foil-glint.webp" : "gem-glint.webp"];
      const w = size * (kind === "package" ? 0.22 : rx.scale);
      ctx.drawImage(fx, x + size * rx.x - w / 2, y + size * rx.y - w / 2, w, w);
      ctx.restore();
    }
    ctx.fillStyle = "#e7d9ac";
    ctx.font = "600 14px sans-serif";
    ctx.fillText(kind.toUpperCase(), x, y + 187);
  }
  ctx.fillStyle = "#8faebc";
  ctx.font = "13px sans-serif";
  ctx.fillText(
    "Static illustration render, not a browser recording. Normal motion timing.",
    620,
    866,
  );
  return c;
}
await fs.writeFile(
  path.join(out, "motion-board.png"),
  proof(2220).toBuffer("image/png"),
);
const sheet = createCanvas(1536, 1000),
  ctx = sheet.getContext("2d");
ctx.fillStyle = "#0c1e2a";
ctx.fillRect(0, 0, 1536, 1000);
for (const [i, [pose, time]] of [
  ["idle", 0],
  ["cast", 250],
  ["cast", 420],
  ["cast", 1100],
].entries())
  figure(ctx, i * 384, 0, 384, 900, pose, time);
ctx.fillStyle = "#e7d9ac";
ctx.font = "18px sans-serif";
["REST", "ANTICIPATION / 250ms", "RELEASE / 420ms", "SETTLE / 1100ms"].forEach(
  (s, i) => ctx.fillText(s, i * 384 + 20, 970),
);
await fs.writeFile(
  path.join(out, "cast-contact.png"),
  sheet.toBuffer("image/png"),
);
if (process.argv.includes("--video")) {
  const ff = spawn(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "rawvideo",
      "-pixel_format",
      "rgba",
      "-video_size",
      "1440x900",
      "-framerate",
      "24",
      "-i",
      "pipe:0",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      path.join(out, "motion-study.mp4"),
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  for (let frame = 0; frame < 144; frame++) {
    const data = Buffer.from(
      proof((frame / 24) * 1000)
        .getContext("2d")
        .getImageData(0, 0, 1440, 900).data,
    );
    if (!ff.stdin.write(data))
      await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end();
  await new Promise((resolve, reject) =>
    ff.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`)),
    ),
  );
}
console.log(out);
