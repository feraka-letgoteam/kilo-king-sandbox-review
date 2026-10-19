import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require(
  require.resolve("sharp", {
    paths: [process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || process.cwd()],
  }),
);
const root = path.resolve("public/kilo-motion-v18");
await fs.mkdir(root, { recursive: true });
const sources = {
  "fisherman-parts-source.png": "exec-e3e670ef-9313-4031-924c-69d4003455de.png",
  "marina-clean-source.png": "exec-dbf8e1b2-9df4-45df-ab58-885e88a8a4f3.png",
  "boats-source.png": "exec-6a69e83e-af37-4cc3-ae95-caeeb6bfeec7.png",
  "reflections-source.png": "exec-70c382f4-b28c-4b9a-9257-0413debab154.png",
  "surface-fx-source.png": "exec-ee2a6da8-9ba6-4b83-8f5b-e3659da69f84.png",
};
// First run accepts the image-generation output folder. Later runs use retained sources.
if (process.argv[2])
  for (const [name, file] of Object.entries(sources))
    await fs.copyFile(path.join(process.argv[2], file), path.join(root, name));
const records = [];
async function extract(source, name, rect) {
  const [left, top, width, height] = rect;
  const cropped = await sharp(path.join(root, source))
    .extract({ left, top, width, height })
    .png()
    .toBuffer();
  const { data, info } = await sharp(cropped)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let x0 = width,
    y0 = height,
    x1 = 0,
    y1 = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 0) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  if (x0 >= width) throw new Error(`Empty attachment: ${name}`);
  const bounds = { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  // Atlas unpacking only: no retouching, alpha removal or background substitution.
  let output = sharp(cropped).extract(bounds);
  const maxWidth =
    name === "torso"
      ? 640
      : name.startsWith("boat-")
        ? 640
        : name.startsWith("reflection-")
          ? 512
          : name.endsWith("glint")
            ? 256
            : 0;
  if (maxWidth)
    output = output.resize({ width: maxWidth, withoutEnlargement: true });
  const runtime = await output
    .webp({ lossless: true })
    .toFile(path.join(root, name + ".webp"));
  const previous = records.findIndex((record) => record.name === name);
  if (previous >= 0) records.splice(previous, 1);
  records.push({
    name,
    source,
    extraction: rect,
    trim: bounds,
    channels: info.channels,
    runtimeSize: [runtime.width, runtime.height],
  });
}
const parts = {
  "head-open": [24, 4, 375, 401],
  "head-closed": [445, 4, 375, 401],
  torso: [838, 8, 407, 411],
  legs: [8, 423, 400, 395],
  "arm-left-upper": [484, 437, 264, 343],
  "arm-left-fore": [944, 433, 187, 370],
  "arm-right-upper": [65, 820, 282, 385],
  "arm-right-fore": [418, 850, 379, 308],
  rod: [814, 805, 431, 423],
};
for (const [name, rect] of Object.entries(parts))
  await extract("fisherman-parts-source.png", name, rect);
const cleanedTorso = await sharp(
  path.join(root, "torso-clean-source.png"),
).metadata();
await extract("torso-clean-source.png", "torso", [
  0,
  0,
  cleanedTorso.width,
  cleanedTorso.height,
]);
// Blink frames keep a common canvas; alpha trimming would shift the facial landmarks.
for (const [index, name] of ["head-open", "head-closed"].entries()) {
  await sharp(path.join(root, "fisherman-parts-source.png"))
    .extract({ left: index * 418, top: 0, width: 418, height: 418 })
    .webp({ lossless: true })
    .toFile(path.join(root, name + ".webp"));
  const record = records.find((record) => record.name === name);
  record.extraction = [index * 418, 0, 418, 418];
  record.trim = null;
  record.runtimeSize = [418, 418];
  record.frameRegistered = true;
}
for (const [source, leftName, rightName] of [
  ["boats-source.png", "boat-left", "boat-right"],
  ["reflections-source.png", "reflection-left", "reflection-right"],
  ["surface-fx-source.png", "foil-glint", "gem-glint"],
]) {
  const { width, height } = await sharp(path.join(root, source)).metadata();
  const mid = Math.floor(width / 2);
  await extract(source, leftName, [0, 0, mid, height]);
  await extract(source, rightName, [mid, 0, width - mid, height]);
}
await sharp(path.join(root, "marina-clean-source.png"))
  .webp({ quality: 94 })
  .toFile(path.join(root, "marina-clean.webp"));
// Existing approved facial drawings: normalize to equal 444px frames without changing their footprint.
const rects = [
  [0, 0, 444, 444],
  [444, 0, 443, 444],
  [887, 0, 443, 444],
  [1330, 0, 444, 444],
  [0, 444, 444, 443],
  [444, 444, 443, 443],
  [887, 444, 443, 443],
  [1330, 444, 444, 443],
];
const tiles = [];
for (const [i, [left, top, width, height]] of rects.entries()) {
  const data = await sharp("public/kilo-motion-v7/collector-reaction-atlas.png")
    .extract({ left, top, width, height })
    .extend({
      top: 0,
      left: 0,
      right: 444 - width,
      bottom: 444 - height,
      background: "#0000",
    })
    .png()
    .toBuffer();
  await fs.writeFile(path.join(root, `collector-${i}.png`), data);
  tiles.push({
    input: data,
    left: (i % 4) * 444,
    top: Math.floor(i / 4) * 444,
  });
}
await sharp({
  create: { width: 1776, height: 888, channels: 4, background: "#0000" },
})
  .composite(tiles)
  .png()
  .toFile(path.join(root, "collector-registered.png"));
await fs.writeFile(
  path.join(root, "extraction-manifest.json"),
  JSON.stringify(
    {
      version: 18,
      method: "Lossless atlas unpacking; original alpha retained",
      attachments: records,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Prepared ${records.length} separate attachments and registered collector drawings.`,
);
