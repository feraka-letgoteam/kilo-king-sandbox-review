/** Native registered-art framing proof. Never opens or simulates a browser. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { fitGameLayout } from "../src/components/kilo/layout.ts";
import {
  createControlLayout,
  controlTargets,
} from "../src/components/slot-controls/layout.ts";
import {
  INTEGRATED_MASTERS,
  INTEGRATED_SCENES,
  integratedSceneCamera,
  integratedSceneMaster,
  integratedCharacterRegistration,
  integratedCloudOffset,
} from "../src/components/kilo/integrated-scene-model.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "art/kilo-scenes-v43/proofs/framing-v44");
const require = createRequire(
  path.join(
    process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ||
      "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules",
    "package.json",
  ),
);
const sharp = require("sharp");
const sources = new Map();
const urlFile = (url) => path.join(root, "public", url.replace(/^\//, ""));
async function asset(url) {
  if (!sources.has(url)) {
    const bytes = await fs.readFile(urlFile(url));
    const metadata = await sharp(bytes).metadata();
    sources.set(url, {
      metadata,
      data:
        "data:image/png;base64," +
        (await sharp(bytes).png().toBuffer()).toString("base64"),
      bytes,
    });
  }
  return sources.get(url);
}
const image = (file, master, attrs = "") =>
  `<image href="${file.data}" width="${master.width}" height="${master.height}" preserveAspectRatio="none" ${attrs}/>`;
const poly = (polygon, master) =>
  polygon.map(([x, y]) => `${x * master.width},${y * master.height}`).join(" ");
const bounds = async (file, threshold = 2) => {
  const { data, info } = await sharp(file.bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const box = [info.width, info.height, -1, -1];
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++)
      if (data[(y * info.width + x) * 4 + 3] > threshold) {
        box[0] = Math.min(box[0], x);
        box[1] = Math.min(box[1], y);
        box[2] = Math.max(box[2], x);
        box[3] = Math.max(box[3], y);
      }
  return box;
};
function oldCamera(layout, portrait, sourceSize) {
  const master = integratedSceneMaster(portrait, sourceSize);
  const template = INTEGRATED_MASTERS[portrait ? "portrait" : "desktop"];
  const scale = layout.reelWidth / template.opening.width;
  const reelLeft =
    layout.mode === "landscape" && !layout.compact
      ? layout.controlLeft + layout.dockGap
      : layout.artLeft;
  return {
    master,
    scale,
    left: reelLeft - template.opening.x * scale,
    top: layout.header - template.opening.y * scale,
    width: master.width * scale,
    height: master.height * scale,
  };
}
function crop(camera, shell, viewport) {
  return {
    left: Math.max(0, -(shell.x + camera.left) / camera.scale),
    top: Math.max(0, -(shell.y + camera.top) / camera.scale),
    right: Math.min(
      camera.master.width,
      (viewport[0] - shell.x - camera.left) / camera.scale,
    ),
    bottom: Math.min(
      camera.master.height,
      (viewport[1] - shell.y - camera.top) / camera.scale,
    ),
  };
}
function projected(bounds, camera, shell) {
  return {
    left: shell.x + camera.left + bounds[0] * camera.scale,
    top: shell.y + camera.top + bounds[1] * camera.scale,
    right: shell.x + camera.left + bounds[2] * camera.scale,
    bottom: shell.y + camera.top + bounds[3] * camera.scale,
  };
}
function clipped(box, viewport) {
  return {
    left: Math.max(0, -box.left),
    top: Math.max(0, -box.top),
    right: Math.max(0, box.right - viewport[0]),
    bottom: Math.max(0, box.bottom - viewport[1]),
  };
}
async function world(portrait) {
  const definition =
    INTEGRATED_SCENES.base[portrait ? "portraitCharacter" : "desktopCharacter"];
  const cloud =
    INTEGRATED_SCENES.base[portrait ? "portraitClouds" : "desktopClouds"];
  const actor = await asset(definition.actorUrl);
  const sky = await asset(cloud.cleanUrl);
  const cloudArt = await asset(cloud.url);
  const master = integratedSceneMaster(portrait, sky.metadata);
  const registration = integratedCharacterRegistration(definition);
  const actorBox = await bounds(actor);
  const actorMasterBounds = [
    (registration.left +
      (actorBox[0] / actor.metadata.width) * registration.scale) *
      master.width,
    (registration.top +
      (actorBox[1] / actor.metadata.height) * registration.scale) *
      master.height,
    (registration.left +
      (actorBox[2] / actor.metadata.width) * registration.scale) *
      master.width,
    (registration.top +
      (actorBox[3] / actor.metadata.height) * registration.scale) *
      master.height,
  ];
  const id = portrait ? "portrait" : "desktop";
  const ellipses = (cloud.falloffEllipses ?? [])
    .map(
      (ellipse, i) =>
        `<radialGradient id="${id}-fade-${i}"><stop offset="0%" stop-color="white"/><stop offset="55%" stop-color="white" stop-opacity=".85"/><stop offset="85%" stop-color="white" stop-opacity=".25"/><stop offset="100%" stop-color="white" stop-opacity="0"/></radialGradient>`,
    )
    .join("");
  const cloudMask = (cloud.falloffEllipses ?? [])
    .map(
      (e, i) =>
        `<ellipse cx="${e.center[0] * master.width}" cy="${e.center[1] * master.height}" rx="${e.radius[0] * master.width}" ry="${e.radius[1] * master.height}" fill="url(#${id}-fade-${i})"/>`,
    )
    .join("");
  const shadow = (definition.contactShadows ?? [])
    .map(
      (s) =>
        `<ellipse cx="${s.center[0] * master.width}" cy="${s.center[1] * master.height}" rx="${s.radius[0] * master.width}" ry="${s.radius[1] * master.height}" opacity="${s.opacity ?? 0.16}" fill="#10202a"/>`,
    )
    .join("");
  const markup = `<defs>${ellipses}<mask id="${id}-cloud-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${master.width}" height="${master.height}" style="mask-type:alpha">${cloudMask}</mask><clipPath id="${id}-cloud-safe">${cloud.polygons.map((p) => `<polygon points="${poly(p, master)}"/>`).join("")}</clipPath></defs>${image(sky, master)}<g clip-path="url(#${id}-cloud-safe)"><g mask="url(#${id}-cloud-mask)"><g transform="translate(${integratedCloudOffset(0, cloud) * master.width} 0)">${image(cloudArt, master)}</g></g></g>${shadow}<g transform="translate(${registration.left * master.width} ${registration.top * master.height}) scale(${registration.scale})">${image(actor, master)}</g>`;
  return {
    markup,
    master,
    metadata: sky.metadata,
    actorMasterBounds,
    registration,
  };
}

await fs.mkdir(output, { recursive: true });
const variants = { desktop: await world(false), portrait: await world(true) };
const cases = [];
for (const viewport of [
  [1440, 900],
  [390, 844],
  [360, 800],
  [844, 390],
]) {
  for (const review of [false, true]) {
    const [width, height] = viewport;
    const padding =
      width <= 620
        ? { top: 12, side: 12, bottom: 20 }
        : { top: 16, side: 16, bottom: 24 };
    const stageSize = {
      width: width - padding.side * 2,
      height: height - (review ? 44 : 0) - padding.top - padding.bottom,
    };
    const layout = fitGameLayout(stageSize.width, stageSize.height);
    const protectedLayout = structuredClone(layout);
    const portrait = layout.mode === "portrait";
    const drawing = variants[portrait ? "portrait" : "desktop"];
    const camera = integratedSceneCamera(layout, {
      portrait,
      sourceSize: drawing.metadata,
      stageSize,
    });
    const previous = oldCamera(layout, portrait, drawing.metadata);
    const shell = {
      x: padding.side + (stageSize.width - layout.width) / 2,
      y: (review ? 44 : 0) + padding.top,
    };
    const oldActor = projected(drawing.actorMasterBounds, previous, shell);
    const newActor = projected(drawing.actorMasterBounds, camera, shell);
    assert.deepEqual(layout, protectedLayout);
    assert.ok(
      Math.abs(
        camera.width / camera.height -
          drawing.master.width / drawing.master.height,
      ) < 1e-12,
    );
    if (layout.mode !== "portrait") {
      assert.equal(
        clipped(newActor, viewport).right,
        0,
        "Kilo is cropped at the right edge.",
      );
      assert.equal(clipped(newActor, viewport).top, 0);
      assert.equal(clipped(newActor, viewport).bottom, 0);
    } else assert.deepEqual(camera, { portrait, ...previous });
    const dock = createControlLayout({
      variant: layout.compact
        ? "compact"
        : portrait
          ? "portrait"
          : layout.mode === "landscape"
            ? "landscape"
            : "desktop",
      width:
        layout.mode === "landscape"
          ? layout.width
          : portrait
            ? layout.reelWidth
            : layout.artLeft
              ? stageSize.width
              : layout.width,
      height:
        layout.mode === "wide" &&
        layout.width >= 1100 &&
        layout.height + 60 <= stageSize.height
          ? 128
          : layout.dock,
      footerWidth: layout.reelWidth,
    });
    const controls = controlTargets(dock, false);
    for (const box of Object.values(controls))
      assert.ok(box.w >= 44 && box.h >= 44);
    const row = {
      viewport,
      review,
      stageSize,
      layout,
      shell,
      camera,
      previous,
      worldScaleChangePercent: (camera.scale / previous.scale - 1) * 100,
      sourceCrop: {
        before: crop(previous, shell, viewport),
        after: crop(camera, shell, viewport),
      },
      actor: {
        sourceMaster: drawing.actorMasterBounds,
        before: oldActor,
        after: newActor,
        croppedBefore: clipped(oldActor, viewport),
        croppedAfter: clipped(newActor, viewport),
      },
      controlsPreserved: true,
    };
    cases.push(row);
    if (review) continue;
    const reelX =
      layout.mode === "landscape" && !layout.compact
        ? layout.controlLeft + layout.dockGap
        : layout.artLeft;
    const controlOrigin =
      layout.mode === "landscape"
        ? { x: 0, y: 0 }
        : {
            x: (layout.width - dock.width) / 2,
            y: layout.header + layout.reelHeight + (portrait ? 16 : 32),
          };
    function panel(cam, label) {
      const guide = Object.entries(controls)
        .map(([name, b]) => {
          const x = controlOrigin.x + b.x,
            y = controlOrigin.y + b.y;
          const circular = ["spin", "auto", "turbo", "menu", "buy"].includes(
            name,
          );
          return `${circular ? `<ellipse cx="${x + b.w / 2}" cy="${y + b.h / 2}" rx="${b.w / 2}" ry="${b.h / 2}"` : `<rect x="${x}" y="${y}" width="${b.w}" height="${b.h}" rx="5"`} fill="#020c12" stroke="#ae9462" stroke-width="1"/><text x="${x + b.w / 2}" y="${y + b.h / 2 + 4}" text-anchor="middle" fill="#d9d5c5" font-family="sans-serif" font-size="${name === "spin" ? 13 : 9}">${name}</text>`;
        })
        .join("");
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#030d16"/><g transform="translate(${shell.x} ${shell.y})"><svg x="${cam.left}" y="${cam.top}" width="${cam.width}" height="${cam.height}" viewBox="0 0 ${drawing.master.width} ${drawing.master.height}">${drawing.markup}</svg><rect x="${reelX}" y="${layout.header}" width="${layout.reelWidth}" height="${layout.reelHeight}" rx="5" fill="#04141c" stroke="#bc9e65" stroke-width="3"/><text x="${reelX + layout.reelWidth / 2}" y="${layout.header + layout.reelHeight / 2}" text-anchor="middle" fill="#9ab0ad" font-family="sans-serif" font-size="14">Unchanged reel rectangle</text>${guide}</g><rect x="0" y="0" width="100%" height="32" fill="#031018" fill-opacity=".94"/><text x="10" y="20" fill="#d8d6c5" font-family="sans-serif" font-size="${width < 500 ? 10 : 13}">${label} · Native art/layout guides, not browser capture</text></svg>`;
    }
    const before = await sharp(Buffer.from(panel(previous, "Before")), {
      limitInputPixels: false,
    })
      .png()
      .toBuffer();
    const after = await sharp(Buffer.from(panel(camera, "After")), {
      limitInputPixels: false,
    })
      .png()
      .toBuffer();
    await fs.writeFile(
      path.join(output, `framing-${width}x${height}.png`),
      after,
    );
    if (layout.mode === "wide")
      await sharp({
        create: {
          width: width * 2,
          height,
          channels: 4,
          background: "#030d16",
        },
      })
        .composite([
          { input: before, left: 0, top: 0 },
          { input: after, left: width, top: 0 },
        ])
        .png()
        .toFile(path.join(output, `framing-${width}x${height}-comparison.png`));
  }
}
const report = {
  kind: "Native SVG/Sharp art framing and calculated unchanged UI guides; not a live browser capture",
  cases,
  limitations: [
    "Controls are calculated geometry guides, not a browser render or recreation of their final materials.",
    "Zero safe-area insets; unusual device safe areas remain a live-device check.",
    "Portrait camera/character framing is intentionally unchanged.",
    "Existing symbols and original logo are omitted so this proof isolates environment framing.",
  ],
};
await fs.writeFile(
  path.join(output, "framing-verification.json"),
  JSON.stringify(report, null, 2) + "\n",
);
await fs.writeFile(
  path.join(output, "FRAMING.md"),
  `# Registered world framing correction\n\n${report.kind}.\n\nThe old desktop world was enlarged from a virtual 1050px reel opening and extended beyond the right viewport edge. The complete illustration does not contain a painted cabinet opening. Its new wide camera uses the existing host stage dimensions and fills the stage at its original aspect, anchored at the right edge. The reel/control layout is not used to set world zoom, and no reel/control coordinates change. All registered clean plate, actor joints, eyes, water, clouds and atmospheric layers keep the same source coordinates and share this one camera.\n\n- Eight calculated cases cover the four requested viewports with/without the review toolbar.\n- Kilo’s complete measured alpha bounds fit inside desktop and short-landscape viewports after the correction.\n- Portrait returns byte-equivalent camera results.\n- Accepted control targets remain at least 44px.\n\nSee framing-verification.json for source crops, scales, projected actor bounds and old crop amounts. PNGs are native art proofs with UI geometry guides; they are not live browser screenshots.\n`,
);
console.log(
  JSON.stringify({
    output,
    cases: cases.length,
    desktop: cases
      .filter((row) => row.layout.mode === "wide")
      .map((row) => ({
        viewport: row.viewport,
        review: row.review,
        scaleChangePercent: row.worldScaleChangePercent,
        before: row.actor.croppedBefore,
        after: row.actor.croppedAfter,
      })),
  }),
);
