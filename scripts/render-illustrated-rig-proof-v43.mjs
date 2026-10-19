/**
 * Native SVG/Sharp proof of the registered illustration rig, not a browser test.
 * Reads the same normalized polygons, registration and motion functions used by
 * IntegratedScene. It never edits a runtime asset or draws reels/controls.
 * Run: node scripts/render-illustrated-rig-proof-v43.mjs [--stills-only|--clouds-only]
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "art/kilo-scenes-v43/proofs");
const stillsOnly = process.argv.includes("--stills-only");
const cloudsOnly = process.argv.includes("--clouds-only");
let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  const runtimeRequire = createRequire(path.join(
    process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ||
      "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules",
    "package.json",
  ));
  sharp = runtimeRequire("sharp");
}
const modelPath = "src/components/kilo/integrated-scene-model.ts";
const modelSource = await fs.readFile(path.join(root, modelPath), "utf8");
const model = await import("data:text/javascript;base64," + Buffer.from(
  ts.transpile(modelSource, { target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext }),
).toString("base64"));
const { INTEGRATED_SCENES, integratedSceneMaster,
  integratedCharacterRegistration, integratedCharacterAngle,
  integratedBlinkOpacity } = model;
const definition = INTEGRATED_SCENES.base.desktopCharacter;
const blink = INTEGRATED_SCENES.base.desktopBlink;
if (!definition?.registered) throw new Error("Base desktop rig is not registered.");
if (!stillsOnly && !blink?.requiresCharacterLayer)
  throw new Error("Final clip waits for the registered actor-specific blink metadata.");
const publicFile = (url) => path.join(root, "public", url.replace(/^\//, ""));
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const assets = {};
for (const [id, url] of Object.entries({
  original: "/kilo-scenes-v43/base.webp",
  clean: definition.cleanUrl,
  actor: definition.actorUrl,
  ...(blink ? { blink: blink.url } : {}),
})) {
  const bytes = await fs.readFile(publicFile(url));
  const metadata = await sharp(bytes).metadata();
  assets[id] = { url, bytes, metadata,
    hash: sha256(bytes),
    data: "data:image/png;base64," + (await sharp(bytes).png().toBuffer()).toString("base64") };
}
for (const id of ["clean", "actor", ...(blink ? ["blink"] : [])]) {
  if (assets[id].metadata.width !== assets.original.metadata.width ||
      assets[id].metadata.height !== assets.original.metadata.height)
    throw new Error(`${id} dimensions do not match the original master.`);
}
const master = integratedSceneMaster(false, assets.original.metadata);
const registration = integratedCharacterRegistration(definition);
const placement = `translate(${registration.left * master.width} ${registration.top * master.height}) scale(${registration.scale})`;
const poly = (polygon) => polygon.map(([x, y]) =>
  `${x * master.width},${y * master.height}`).join(" ");
const cutouts = definition.staticCutouts ?? definition.bones.map(b => b.polygon);
const staticPath = `M0,0H${master.width}V${master.height}H0Z ` + cutouts.map(p =>
  `M${p.map(([x, y]) => `${x * master.width},${y * master.height}`).join("L")}Z`).join(" ");
const label = "Animation fit proof — not live browser";
const escape = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const image = (id, attrs = "") => `<image href="${assets[id].data}" width="${master.width}" height="${master.height}" preserveAspectRatio="none" ${attrs}/>`;
const rotate = (bone, angle) => `rotate(${angle} ${bone.pivot[0] * master.width} ${bone.pivot[1] * master.height})`;
const world = ([x, y]) => [
  (registration.left + x * registration.scale) * master.width,
  (registration.top + y * registration.scale) * master.height,
];
function character(angles = {}, blinkOpacity = 0, id = "proof") {
  const eyeMask = blink?.edgeFeather > 0;
  const clips = `<defs><clipPath id="${id}-static" clipPathUnits="userSpaceOnUse"><path d="${staticPath}" fill-rule="evenodd" clip-rule="evenodd"/></clipPath>${definition.bones.map(b => `<clipPath id="${id}-${b.id}" clipPathUnits="userSpaceOnUse"><polygon points="${poly(b.polygon)}"/></clipPath>`).join("")}${blink ? eyeMask ? `<filter id="${id}-feather" color-interpolation-filters="sRGB" x="-25%" y="-50%" width="150%" height="200%"><feGaussianBlur stdDeviation="${blink.edgeFeather * master.width}"/></filter><mask id="${id}-eyes" maskUnits="userSpaceOnUse" x="0" y="0" width="${master.width}" height="${master.height}" style="mask-type:alpha"><g fill="white" filter="url(#${id}-feather)">${blink.polygons.map(p => `<polygon points="${poly(p)}"/>`).join("")}</g></mask>` : `<clipPath id="${id}-eyes" clipPathUnits="userSpaceOnUse">${blink.polygons.map(p => `<polygon points="${poly(p)}"/>`).join("")}</clipPath>` : ""}</defs>`;
  const shadows = (definition.contactShadows ?? []).map(s =>
    `<ellipse cx="${s.center[0] * master.width}" cy="${s.center[1] * master.height}" rx="${s.radius[0] * master.width}" ry="${s.radius[1] * master.height}" fill="#10202a" opacity="${s.opacity ?? .16}"/>`).join("");
  const head = definition.bones.find(b => b.id === "head");
  return clips + shadows + `<g transform="${placement}">${image("actor", `clip-path="url(#${id}-static)"`)}${definition.bones.map(b => `<g transform="${rotate(b, angles[b.id] ?? 0)}">${image("actor", `clip-path="url(#${id}-${b.id})"`)}</g>`).join("")}${blink && blinkOpacity > 0 ? `<g opacity="${blinkOpacity}" transform="${head ? rotate(head, angles.head ?? 0) : ""}">${image("blink", `${eyeMask ? "mask" : "clip-path"}="url(#${id}-eyes)"`)}</g>` : ""}</g>`;
}
function svg(angles, { width = 1600, height = 900,
  viewBox = [0, 0, master.width, master.height],
  title = "Neutral registered rig", opacity = 0, annotate = true } = {}) {
  const [x, y, w, h] = viewBox;
  const textSize = Math.max(11, w / width * 14);
  const lx = x + w * .016, ly = y + h * .035;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox.join(" ")}"><title>${escape(title)} — ${label}</title>${image("clean")}${character(angles, opacity)}${annotate ? `<g font-family="sans-serif" fill="#c1c8ca"><rect x="${lx - 4}" y="${ly - textSize}" width="${Math.min(w - 12, textSize * 27.5)}" height="${textSize * 3.05}" rx="3" fill="#06131b" opacity=".91"/><text x="${lx}" y="${ly}" font-size="${textSize}">${label}</text><text x="${lx}" y="${ly + textSize * 1.5}" font-size="${textSize * .88}" fill="#91aaa9">${escape(title)}</text></g>` : ""}</svg>`;
}
await fs.mkdir(output, { recursive: true });
if (cloudsOnly) {
  await renderCloudContactProof();
  process.exit(process.exitCode ?? 0);
}
const states = [
  { id: "neutral", angles: {}, title: "Neutral registered illustration" },
  { id: "head-minus", angles: { head: -.6 }, title: "Head −0.6° fit extreme" },
  { id: "head-plus", angles: { head: .6 }, title: "Head +0.6° fit extreme" },
  { id: "arm-minus", angles: { reelArm: -1 }, title: "Forearm −1° fit extreme" },
  { id: "arm-plus", angles: { reelArm: 1 }, title: "Forearm +1° fit extreme" },
];
const frameBuffers = {};
for (const s of states) {
  const source = svg(s.angles, { title: s.title });
  frameBuffers[s.id] = await sharp(Buffer.from(source), { limitInputPixels: false }).png().toBuffer();
  if (s.id === "neutral")
    await fs.writeFile(path.join(output, `rig-${s.id}.png`), frameBuffers[s.id]);
}
const headPivot = world(definition.bones.find(b => b.id === "head").pivot);
const armPivot = world(definition.bones.find(b => b.id === "reelArm").pivot);
const contactSpecs = [
  { id: "neck", point: headPivot, region: [headPivot[0] - 70, headPivot[1] - 55, 140, 110], states: states.slice(0, 3) },
  { id: "elbow", point: armPivot, region: [armPivot[0] - 90, armPivot[1] - 70, 180, 140], states: [states[0], states[3], states[4]] },
];
const reports = [];
for (const spec of contactSpecs) {
  const images = [];
  for (const s of spec.states) {
    images.push(`<svg x="${images.length * 560}" y="76" width="560" height="440" viewBox="${spec.region.join(" ")}">${image("clean")}${character(s.angles, 0, `${spec.id}-${s.id}`)}</svg><text x="${images.length * 560 + 12}" y="57" fill="#b8cbca" font-size="18">${escape(s.title)}</text>`);
  }
  const contact = `<svg xmlns="http://www.w3.org/2000/svg" width="1680" height="552"><rect width="1680" height="552" fill="#071820"/><text x="12" y="25" fill="#c6cfce" font-family="sans-serif" font-size="19">${label} · ${spec.id} contact, enlarged</text>${images.join("")}</svg>`;
  await sharp(Buffer.from(contact), { limitInputPixels: false }).png().toFile(path.join(output, `rig-${spec.id}-contact.png`));
  reports.push({ joint: spec.id, pivot: spec.point, magnifiedViewBox: spec.region });
}
// Below every animated polygon, static actor pixels and the floor ink must be
// bit-identical at the fit extremes. This checks root/foot drift, not aesthetics.
const foot = { left: 1190, top: 650, width: 410, height: 180 };
const footHashes = {};
for (const s of states) footHashes[s.id] = sha256(await sharp(frameBuffers[s.id]).extract(foot).raw().toBuffer());
if (new Set(Object.values(footHashes)).size !== 1)
  throw new Error("Static feet/floor region changed between motion extremes.");
const fps = 24, seconds = 8;
const timeline = [];
if (!stillsOnly) {
  const sequence = path.join(output, ".rig-frames");
  await fs.mkdir(sequence, { recursive: true });
  for (let frame = 0; frame < fps * seconds; frame++) {
    const elapsed = frame * 1000 / fps;
    const cue = elapsed >= 5600 ? { pose: "slump", start: 5600 }
      : elapsed >= 2600 ? { pose: "cheer", start: 2600 }
      : elapsed >= 800 ? { pose: "cast", start: 800 }
      : { pose: "idle", start: 0 };
    const angles = Object.fromEntries(definition.bones.map(b => [b.id,
      Number(integratedCharacterAngle(b.id, elapsed, cue.pose, elapsed - cue.start, false).toFixed(4))]));
    const opacity = integratedBlinkOpacity(elapsed);
    timeline.push({ frame, elapsed, pose: cue.pose, angles, blinkOpacity: opacity });
    const source = svg(angles, { width: 600, height: 920,
      viewBox: [1320, 80, 600, 920], opacity,
      title: `Normal speed · ${cue.pose} · ${(elapsed / 1000).toFixed(2)}s` });
    await sharp(Buffer.from(source), { limitInputPixels: false }).png().toFile(
      path.join(sequence, `frame-${String(frame).padStart(4, "0")}.png`));
  }
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y",
    "-framerate", String(fps), "-i", path.join(sequence, "frame-%04d.png"),
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", path.join(output, "illustrated-rig-normal-speed.mp4")]);
  await fs.rm(sequence, { recursive: true, force: true });
}
if (blink) {
  const peak = timeline.length ? timeline.reduce((a, b) => b.blinkOpacity > a.blinkOpacity ? b : a) : {
    angles: Object.fromEntries(definition.bones.map(b => [b.id,
      integratedCharacterAngle(b.id, 4666.6667, "idle", Infinity, false)])),
    blinkOpacity: integratedBlinkOpacity(4666.6667),
  };
  await sharp(Buffer.from(svg(peak.angles, { title: "Registered blink peak", opacity: peak.blinkOpacity })), { limitInputPixels: false }).png().toFile(path.join(output, "rig-blink-peak.png"));
  const eyePoints = blink.polygons.flat().map(world);
  const minX = Math.min(...eyePoints.map(p => p[0])) - 12;
  const minY = Math.min(...eyePoints.map(p => p[1])) - 10;
  const eyeView = [minX, minY,
    Math.max(...eyePoints.map(p => p[0])) - minX + 12,
    Math.max(...eyePoints.map(p => p[1])) - minY + 10];
  const eyeProof = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="420"><rect width="1200" height="420" fill="#071820"/><text x="12" y="26" fill="#c6cfce" font-family="sans-serif" font-size="19">${label} · registered eyelid drawing</text><text x="12" y="59" fill="#b8cbca" font-size="18">Open · same head angle</text><text x="612" y="59" fill="#b8cbca" font-size="18">Closed · actual blink peak</text><svg x="0" y="76" width="600" height="320" viewBox="${eyeView.join(" ")}">${image("clean")}${character(peak.angles, 0, "eye-open")}</svg><svg x="600" y="76" width="600" height="320" viewBox="${eyeView.join(" ")}">${image("clean")}${character(peak.angles, peak.blinkOpacity, "eye-closed")}</svg></svg>`;
  await sharp(Buffer.from(eyeProof), { limitInputPixels: false }).png().toFile(path.join(output, "rig-eyes-contact.png"));
}
// Source script + final compact review outputs are retained. Embedded SVGs and
// individual fit-state crops from an earlier run are fully regenerable.
for (const s of states) {
  await fs.rm(path.join(output, `rig-${s.id}.svg`), { force: true });
  if (s.id !== "neutral") await fs.rm(path.join(output, `rig-${s.id}.png`), { force: true });
}
for (const spec of contactSpecs) {
  await fs.rm(path.join(output, `rig-${spec.id}-contact.svg`), { force: true });
  for (const s of spec.states)
    await fs.rm(path.join(output, `rig-${spec.id}-${s.id}.png`), { force: true });
}
const manifest = {
  kind: label, renderer: "Offline SVG + Sharp; actual runtime registration/polygons/motion functions",
  sourceHash: sha256(modelSource), source: modelPath, master, registration,
  assets: Object.fromEntries(Object.entries(assets).map(([id, a]) => [id,
    { url: a.url, width: a.metadata.width, height: a.metadata.height, sha256: a.hash }])),
  states, contacts: reports, footRegion: foot, footHashes,
  staticFootRegionIdentical: true, fps, seconds, frames: timeline.length,
  clip: stillsOnly ? null : "illustrated-rig-normal-speed.mp4",
  timeline,
  limitations: ["Not a browser screenshot or live playback test", "Water, reels and controls are deliberately excluded", "Contact appearance still requires visual review of proof images", "Programmed pose cues exercise the runtime functions; they are not a recorded paid round"],
};
await fs.writeFile(path.join(output, "rig-proof-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
await fs.writeFile(path.join(output, "RIG-PROOF.md"), `# Illustrated character animation fit proof\n\n${label}.\n\nThis proof reads the current registered desktop actor, clean plate, bone polygons, registration and actual angle/blink functions. The PNGs and native normal-speed clip do not represent a live browser capture. No runtime asset was edited.\n\n- Neutral and head ±0.6° / forearm ±1° extremes rendered.\n- Enlarged neck and elbow contacts provided for visual inspection.\n- Static feet/floor region is bit-identical across all five fit states.\n- ${stillsOnly ? "Stills only; final clip waits for blink metadata." : `${seconds}-second native clip at ${fps}fps, normal speed; idle/cast/cheer/slump cues and actual irregular blink opacity.`}\n\nReview the enlarged contact images for a gap, double ink, repeated collar or cuff edge. Raster equality at the feet does not certify natural motion or seamless joints. Full live interaction, resize and device performance remain separate checks.\n`);
console.log(JSON.stringify({ output, states: states.length,
  staticFootRegionIdentical: true, frames: timeline.length, clip: manifest.clip }));

async function renderCloudContactProof() {
  const review = [];
  for (const portrait of [false, true]) {
    const variant = portrait ? "portrait" : "desktop";
    const cloud = INTEGRATED_SCENES.base[portrait ? "portraitClouds" : "desktopClouds"];
    const actorDefinition = INTEGRATED_SCENES.base[portrait ? "portraitCharacter" : "desktopCharacter"];
    if (!cloud || !actorDefinition?.registered) throw new Error(`Missing ${variant} cloud/rig metadata.`);
    const files = {};
    for (const [id, url] of Object.entries({
      original: `/kilo-scenes-v43/base${portrait ? "-portrait" : ""}.webp`,
      sky: cloud.cleanUrl, clouds: cloud.url, actor: actorDefinition.actorUrl,
    })) {
      const bytes = await fs.readFile(publicFile(url));
      files[id] = { url, metadata: await sharp(bytes).metadata(), sha256: sha256(bytes),
        data: "data:image/png;base64," + (await sharp(bytes).png().toBuffer()).toString("base64") };
    }
    for (const id of ["sky", "clouds", "actor"])
      if (files[id].metadata.width !== files.original.metadata.width ||
          files[id].metadata.height !== files.original.metadata.height)
        throw new Error(`${variant} ${id} dimensions fail the live registered presentation-pack gate.`);
    const sceneMaster = integratedSceneMaster(portrait, files.original.metadata);
    const reg = integratedCharacterRegistration(actorDefinition);
    const points = p => p.map(([x, y]) => `${x * sceneMaster.width},${y * sceneMaster.height}`).join(" ");
    const img = (id, attrs = "") => `<image href="${files[id].data}" width="${sceneMaster.width}" height="${sceneMaster.height}" preserveAspectRatio="none" ${attrs}/>`;
    const omitted = actorDefinition.staticCutouts ?? actorDefinition.bones.map(b => b.polygon);
    const body = `M0,0H${sceneMaster.width}V${sceneMaster.height}H0Z ` + omitted.map(p =>
      `M${p.map(([x, y]) => `${x * sceneMaster.width},${y * sceneMaster.height}`).join("L")}Z`).join(" ");
    const defs = id => `<defs><radialGradient id="${id}-cloud-falloff"><stop offset="0%" stop-color="#fff" stop-opacity="1"/><stop offset="55%" stop-color="#fff" stop-opacity=".85"/><stop offset="85%" stop-color="#fff" stop-opacity=".25"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient><filter id="${id}-cloud-edge" x="-10%" y="-10%" width="120%" height="120%">${cloud.edgeInset ? `<feMorphology operator="erode" radius="${cloud.edgeInset * sceneMaster.width}"/>` : ""}<feGaussianBlur stdDeviation="${(cloud.edgeFeather ?? 0) * sceneMaster.width}"/></filter><mask id="${id}-cloud" maskUnits="userSpaceOnUse" x="0" y="0" width="${sceneMaster.width}" height="${sceneMaster.height}" style="mask-type:alpha"><g fill="#fff" ${!cloud.falloffEllipses && cloud.edgeFeather ? `filter="url(#${id}-cloud-edge)"` : ""}>${cloud.falloffEllipses ? cloud.falloffEllipses.map(e => `<ellipse cx="${e.center[0] * sceneMaster.width}" cy="${e.center[1] * sceneMaster.height}" rx="${e.radius[0] * sceneMaster.width}" ry="${e.radius[1] * sceneMaster.height}" fill="url(#${id}-cloud-falloff)"/>`).join("") : cloud.polygons.map(p => `<polygon points="${points(p)}"/>`).join("")}</g></mask><clipPath id="${id}-static" clipPathUnits="userSpaceOnUse"><path d="${body}" fill-rule="evenodd" clip-rule="evenodd"/></clipPath>${actorDefinition.bones.map(b => `<clipPath id="${id}-${b.id}" clipPathUnits="userSpaceOnUse"><polygon points="${points(b.polygon)}"/></clipPath>`).join("")}</defs>`;
    const rig = id => (actorDefinition.contactShadows ?? []).map(s => `<ellipse cx="${s.center[0] * sceneMaster.width}" cy="${s.center[1] * sceneMaster.height}" rx="${s.radius[0] * sceneMaster.width}" ry="${s.radius[1] * sceneMaster.height}" fill="#10202a" opacity="${s.opacity ?? .16}"/>`).join("") + `<g transform="translate(${reg.left * sceneMaster.width} ${reg.top * sceneMaster.height}) scale(${reg.scale})">${img("actor", `clip-path="url(#${id}-static)"`)}${actorDefinition.bones.map(b => img("actor", `clip-path="url(#${id}-${b.id})"`)).join("")}</g>`;
    const composition = (elapsed, id) => `${defs(id)}<defs><clipPath id="${id}-cloud-outer" clipPathUnits="userSpaceOnUse">${cloud.polygons.map(p => `<polygon points="${points(p)}"/>`).join("")}</clipPath></defs>${img("sky")}<g mask="url(#${id}-cloud)" clip-path="url(#${id}-cloud-outer)"><g transform="translate(${model.integratedCloudOffset(elapsed, cloud) * sceneMaster.width} 0)">${img("clouds")}</g></g>${rig(id)}`;
    const width = portrait ? 768 : 1600;
    const height = Math.round(width * sceneMaster.height / sceneMaster.width);
    const frames = [];
    for (const elapsed of [0, 30_000]) {
      const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${sceneMaster.width} ${sceneMaster.height}">${composition(elapsed, `${variant}-${elapsed}`)}</svg>`;
      frames.push(await sharp(Buffer.from(source), { limitInputPixels: false }).png().toBuffer());
    }
    const regions = portrait ? [
      { id: "city-water-floor-and-hero", left: 0, top: Math.round(height * .36), width, height: height - Math.round(height * .36) },
    ] : [
      { id: "right-city-and-hero", left: Math.round(width * .56), top: 0, width: width - Math.round(width * .56), height },
      { id: "water-and-floor", left: 0, top: Math.round(height * .4), width, height: height - Math.round(height * .4) },
      { id: "left-city", left: 0, top: Math.round(height * .115), width: Math.round(width * .14), height: Math.round(height * .285) },
    ];
    const fixedRegions = [];
    for (const region of regions) {
      const { id, ...rect } = region;
      const crops = await Promise.all(frames.map(bytes => sharp(bytes).extract(rect).ensureAlpha().raw().toBuffer()));
      const hashes = crops.map(sha256);
      let maxChannelDifference = 0, changedPixels = 0;
      for (let i = 0; i < crops[0].length; i += 4) {
        const delta = Math.max(...[0, 1, 2].map(c => Math.abs(crops[0][i + c] - crops[1][i + c])));
        if (delta) changedPixels++;
        maxChannelDifference = Math.max(maxChannelDifference, delta);
      }
      fixedRegions.push({ id, rect, sha256: hashes, identical: hashes[0] === hashes[1], changedPixels, maxChannelDifference });
    }
    const raw = await Promise.all(frames.map(bytes => sharp(bytes).ensureAlpha().raw().toBuffer()));
    let changedPixels = 0;
    for (let i = 0; i < raw[0].length; i += 4)
      if (raw[0][i] !== raw[1][i] || raw[0][i + 1] !== raw[1][i + 1] || raw[0][i + 2] !== raw[1][i + 2]) changedPixels++;
    if (!changedPixels) throw new Error(`${variant} clouds did not move in the native composition.`);
    const contact = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 2}" height="${height + 76}"><rect width="100%" height="100%" fill="#071820"/><text x="12" y="26" fill="#c6cfce" font-family="sans-serif" font-size="19">${label} · ${variant} cloud drift</text><text x="12" y="59" fill="#b8cbca" font-size="18">t = 0s · neutral rig, fixed camera</text><text x="${width + 12}" y="59" fill="#b8cbca" font-size="18">t = 30s · actual runtime cloud offset</text>${frames.map((bytes, index) => `<image x="${index * width}" y="76" width="${width}" height="${height}" href="data:image/png;base64,${bytes.toString("base64")}"/>`).join("")}</svg>`;
    await sharp(Buffer.from(contact), { limitInputPixels: false }).png().toFile(path.join(output, `cloud-${variant}-contact.png`));
    review.push({ variant, width, height, sourceMaster: sceneMaster, cloudDefinition: cloud,
      offsets: [0, 30_000].map(elapsed => ({ elapsed, normalizedX: model.integratedCloudOffset(elapsed, cloud) })),
      changedPixels, fixedRegions,
      assets: Object.fromEntries(Object.entries(files).map(([id, f]) => [id, { url: f.url, width: f.metadata.width, height: f.metadata.height, sha256: f.sha256 }])),
    });
  }
  await fs.writeFile(path.join(output, "cloud-proof-manifest.json"), JSON.stringify({
    kind: label, sourceHash: sha256(modelSource), renderer: "Native SVG + Sharp, actual fixed sky alpha mask and drift function", comparisons: review,
  }, null, 2) + "\n");
  const allFixed = review.every(r => r.fixedRegions.every(region => region.identical));
  await fs.writeFile(path.join(output, "CLOUD-PROOF.md"), `# Cloud composition fit proof\n\n${label}.\n\nNative source composition at t0 and t30 seconds, with the actual runtime cloud polygons, mask-edge feather, cloud offset function, sky-clean plate and neutral registered character. No reels or controls.\n\nBoth variants have nonzero changed sky pixels. Fixed region hashes ${allFixed ? "match exactly" : "DO NOT all match; see manifest differences"}: desktop right skyline/hero, left city and water/floor; portrait city/water/floor/hero. Those checks establish stationary architecture, not visual seam quality. The side-by-side images still require visual inspection for sky-mask seams and cloud alpha fringes. No live browser or device performance claim.\n`);
  console.log(JSON.stringify({ output, cloudComparisons: review.map(r => ({ variant: r.variant, changedPixels: r.changedPixels, fixedRegionsIdentical: r.fixedRegions.every(region => region.identical) })) }));
  if (!allFixed) process.exitCode = 1;
}
