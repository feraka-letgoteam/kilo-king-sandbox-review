import type { GameLayout } from "./layout";
import type { SceneId } from "./scene-system";
import { environmentArtUrl } from './environment-art';

/** All coordinates belong to the authored composition, not the viewport. */
export type IntegratedMaster = {
  width: number;
  height: number;
  opening: { x: number; y: number; width: number; height: number };
};

export const INTEGRATED_MASTERS = {
  desktop: {
    width: 1920,
    height: 1080,
    opening: { x: 300, y: 120, width: 1050, height: 1050 / 1.66 },
  },
  portrait: {
    width: 1080,
    height: 2400,
    opening: { x: 60, y: 280, width: 960, height: 578 },
  },
} as const satisfies Record<string, IntegratedMaster>;

export type IntegratedCameraLayout = Pick<
  GameLayout,
  "mode" | "artLeft" | "reelWidth" | "header"
> &
  Partial<
    Pick<GameLayout, "controlLeft" | "dockGap" | "compact" | "width" | "height">
  >;

export type IntegratedSourceSize = { width: number; height: number };
export function integratedSceneMaster(
  portrait = false,
  sourceSize?: IntegratedSourceSize,
): IntegratedMaster {
  const template = INTEGRATED_MASTERS[portrait ? "portrait" : "desktop"];
  if (!sourceSize || sourceSize.width <= 0 || sourceSize.height <= 0)
    return template;
  return {
    ...template,
    height: (template.width * sourceSize.height) / sourceSize.width,
  };
}

/** The wide illustration is an entire environment, without a painted cabinet
 * opening. Frame that world independently of reel width: the old 1050px
 * virtual opening enlarged it and put Kilo beyond the right viewport edge.
 * Phone retains its accepted authored framing. Returned opening
 * metadata records the unchanged reel rectangle inside the resulting world;
 * it never moves, sizes or measures a reel or control. */
export function integratedSceneCamera(
  layout: IntegratedCameraLayout,
  {
    portrait = layout.mode === "portrait",
    sourceSize,
    stageSize,
  }: {
    portrait?: boolean;
    sourceSize?: IntegratedSourceSize;
    /** Existing host content-box measurement, excluding its CSS padding. */
    stageSize?: IntegratedSourceSize;
  } = {},
) {
  const master = integratedSceneMaster(portrait, sourceSize);
  // Landscape's existing left-side utility column precedes the reel. The
  // compact popout has no left column and keeps its original x=0 reel origin.
  const reelLeft =
    layout.mode === "landscape" && !layout.compact
      ? (layout.controlLeft ?? 0) + (layout.dockGap ?? 0)
      : layout.artLeft;
  if (!portrait && layout.mode !== "portrait") {
    const width = Math.max(
        1,
        stageSize?.width ?? layout.width ?? layout.reelWidth,
      ),
      height = Math.max(
        1,
        stageSize?.height ??
          layout.height ??
          layout.header + layout.reelWidth / 1.66 + 100,
      ),
      // Existing wide-stage insets are 16px top/side and 24px bottom; compact
      // popouts use 8px. Fill those too without changing shell/control geometry.
      inset = layout.compact ? 8 : 16,
      bottomInset = layout.compact ? 8 : 24,
      frameWidth = width + inset * 2,
      frameHeight = height + inset + bottomInset,
      scale = Math.max(frameWidth / master.width, frameHeight / master.height),
      right = ((layout.width ?? width) + width) / 2 + inset,
      left = right - master.width * scale,
      top = -inset - (master.height * scale - frameHeight) / 2;
    return {
      portrait,
      master: {
        ...master,
        opening: {
          x: (reelLeft - left) / scale,
          y: (layout.header - top) / scale,
          width: layout.reelWidth / scale,
          height: layout.reelWidth / 1.66 / scale,
        },
      },
      scale,
      left,
      top,
      width: master.width * scale,
      height: master.height * scale,
    };
  }
  const scale = layout.reelWidth / master.opening.width;
  return {
    portrait,
    master,
    scale,
    left: reelLeft - master.opening.x * scale,
    top: layout.header - master.opening.y * scale,
    width: master.width * scale,
    height: master.height * scale,
  };
}

export type IntegratedWaterRegion = {
  /** Normalized coordinates within the complete master. Fit only to open
   * water. The default is deliberately empty until the finished art is fitted. */
  polygon: readonly (readonly [number, number])[];
  amplitude?: number;
  speed?: number;
};

export type IntegratedBlink = {
  url: string;
  /** Actor-only alternates must wait for the registered clean/alpha pair. */
  requiresCharacterLayer?: boolean;
  /** Alpha-mask boundary feather as a fraction of source width. The actual
   * drawing remains sharp; only this subpixel edge blends into original skin. */
  edgeFeather?: number;
  /** Two tightly fitted eyelid regions from the registered closed-eye drawing.
   * Never replace a whole face, beard, hat or the rest of the master. */
  polygons: readonly (readonly (readonly [number, number])[])[];
};

export type IntegratedCharacterPose = "idle" | "cast" | "cheer" | "slump";
export type IntegratedCharacterBone = {
  id: "head" | "reelArm";
  polygon: readonly (readonly [number, number])[];
  pivot: readonly [number, number];
};
export type IntegratedCharacterLayer = {
  /** Enable only after comparing extraction/clean plate to the original. */
  registered: true;
  cleanUrl: string;
  actorUrl: string;
  /** Fixed illustration registration, never animated. All bones/eyelids share
   * this placement so their coordinates remain in the actor source canvas. */
  placement?: {
    scale: number;
    anchor?: readonly [number, number];
    offset?: readonly [number, number];
  };
  bones: readonly IntegratedCharacterBone[];
  /** Fixed floor ink in master/world coordinates, before actor placement. */
  contactShadows?: readonly {
    center: readonly [number, number];
    radius: readonly [number, number];
    opacity?: number;
  }[];
  /** Smaller joint cutouts can leave the collar/sleeve under moving parts. */
  staticCutouts?: readonly (readonly (readonly [number, number])[])[];
};

export type IntegratedCloudLayer = {
  url: string;
  cleanUrl: string;
  requiresCharacterLayer: true;
  polygons: readonly (readonly (readonly [number, number])[])[];
  driftRange: number;
  driftPeriodMs: number;
  /** Broad elliptical alpha falloff follows cloud banks rather than the
   * rectangular game safe area. Every ellipse stays inside clear sky. */
  falloffEllipses?: readonly {
    center: readonly [number, number];
    radius: readonly [number, number];
  }[];
  /** Pull the solid mask inward before feathering so a cloud never ends at
   * a rectangular safe-area boundary or bleeds onto the fixed skyline. */
  edgeInset?: number;
  edgeFeather?: number;
};

type IntegratedSceneDefinition = {
  desktopWater: readonly IntegratedWaterRegion[];
  portraitWater: readonly IntegratedWaterRegion[];
  desktopBlink?: IntegratedBlink;
  portraitBlink?: IntegratedBlink;
  desktopCharacter?: IntegratedCharacterLayer;
  portraitCharacter?: IntegratedCharacterLayer;
  desktopClouds?: IntegratedCloudLayer;
  portraitClouds?: IntegratedCloudLayer;
};
const STILL: IntegratedSceneDefinition = {
  desktopWater: [],
  portraitWater: [],
};

/** No detached character, boat, pier, wake, reflection or helicopter layers.
 * Near architecture and character share the master composition's camera and
 * lighting. Regions can be enabled only after reviewing that exact artwork. */
export const INTEGRATED_SCENES: Readonly<
  Record<SceneId, IntegratedSceneDefinition>
> = {
  loading: STILL,
  base: {
    desktopClouds: {
      url: "/kilo-scenes-v43/base-clouds.webp",
      cleanUrl: "/kilo-v55/environment/base-desktop-sky-clean.webp",
      requiresCharacterLayer: true,
      polygons: [
        [
          [0, 0],
          [0.54, 0],
          [0.54, 0.04],
          [0.5, 0.04],
          [0.5, 0.27],
          [0.47, 0.27],
          [0.47, 0.3],
          [0.15, 0.3],
          [0.15, 0.1],
          [0, 0.1],
        ],
      ],
      driftRange: 0.04,
      driftPeriodMs: 300_000,
      falloffEllipses: [
        { center: [0.33, 0.06], radius: [0.17, 0.24] },
        { center: [0.06, -0.06], radius: [0.13, 0.14] },
      ],
      edgeInset: 45 / 1920,
      edgeFeather: 15 / 1920,
    },
    portraitClouds: {
      url: "/kilo-scenes-v43/base-portrait-clouds.webp",
      cleanUrl: "/kilo-v55/environment/base-portrait-sky-clean.webp",
      requiresCharacterLayer: true,
      polygons: [
        [
          [0, 0],
          [1, 0],
          [1, 0.18],
          [0.55, 0.18],
          [0.55, 0.32],
          [0.15, 0.32],
          [0.15, 0.18],
          [0, 0.18],
        ],
      ],
      driftRange: 0.04,
      driftPeriodMs: 80_000,
      falloffEllipses: [
        { center: [0.36, 0.07], radius: [0.185, 0.25] },
        { center: [0.15, -0.04], radius: [0.4, 0.22] },
        { center: [0.79, -0.05], radius: [0.3, 0.23] },
      ],
      edgeInset: 40 / 1080,
      edgeFeather: 13 / 1080,
    },
    desktopWater: [
      {
        // Fitted to the illustrated original (1672×941). Above the left
        // balustrade and inside the open middle basin only: no yachts, shore,
        // Kilo, lamps, marble floor or railing can enter this moving region.
        polygon: [
          [0.005, 0.45],
          [0.7, 0.45],
          [0.7, 0.66],
          [0.25, 0.66],
          [0.25, 0.502],
          [0.005, 0.502],
        ],
        amplitude: 0.65,
        speed: 0.65,
      },
    ],
    portraitWater: [
      {
        polygon: [
          [0.025, 0.47],
          [0.9, 0.47],
          [0.9, 0.59],
          [0.65, 0.59],
          [0.65, 0.63],
          [0.33, 0.63],
          [0.33, 0.55],
          [0.025, 0.55],
        ],
        amplitude: 0.65,
      },
    ],
    desktopBlink: {
      url: "/kilo-scenes-v43/base-actor-blink.webp",
      requiresCharacterLayer: true,
      edgeFeather: 0.75 / 1672,
      polygons: [
        [
          [1461 / 1672, 178.8 / 941],
          [1472 / 1672, 180.5 / 941],
          [1477 / 1672, 184.5 / 941],
          [1472 / 1672, 188.7 / 941],
          [1463 / 1672, 186.5 / 941],
          [1460 / 1672, 182 / 941],
        ],
        [
          [1492 / 1672, 189.5 / 941],
          [1502 / 1672, 191 / 941],
          [1504 / 1672, 194 / 941],
          [1500 / 1672, 198.5 / 941],
          [1494 / 1672, 196 / 941],
        ],
      ],
    },
    portraitBlink: {
      url: "/kilo-scenes-v43/base-portrait-actor-blink.webp",
      requiresCharacterLayer: true,
      edgeFeather: 0.65 / 841,
      polygons: [
        [
          [612 / 841, 1093 / 1870],
          [623 / 841, 1095 / 1870],
          [632 / 841, 1099 / 1870],
          [627 / 841, 1105 / 1870],
          [616 / 841, 1102 / 1870],
          [610 / 841, 1098 / 1870],
        ],
        [
          [645 / 841, 1104 / 1870],
          [657 / 841, 1106 / 1870],
          [660 / 841, 1110 / 1870],
          [654 / 841, 1115 / 1870],
          [646 / 841, 1111 / 1870],
        ],
      ],
    },
    desktopCharacter: {
      registered: true,
      cleanUrl: "/kilo-scenes-v43/base-clean.webp",
      actorUrl: "/kilo-scenes-v43/base-actor.webp",
      placement: { scale: 0.9, anchor: [1, 0], offset: [0, 35 / 941] },
      contactShadows: [
        {
          center: [1378 / 1672, 769.8 / 941],
          radius: [58 / 1672, 2.5 / 941],
          opacity: 0.16,
        },
        {
          center: [1595 / 1672, 769.8 / 941],
          radius: [45 / 1672, 2 / 941],
          opacity: 0.14,
        },
      ],
      bones: [
        {
          id: "head",
          pivot: [1464 / 1672, 265 / 941],
          polygon: [
            [1410 / 1672, 125 / 941],
            [1519 / 1672, 125 / 941],
            [1538 / 1672, 204 / 941],
            [1513 / 1672, 267 / 941],
            [1453 / 1672, 276 / 941],
            [1404 / 1672, 245 / 941],
            [1394 / 1672, 202 / 941],
          ],
        },
        {
          id: "reelArm",
          pivot: [1444 / 1672, 331 / 941],
          polygon: [
            [1434 / 1672, 296 / 941],
            [1530 / 1672, 279 / 941],
            [1548 / 1672, 283 / 941],
            [1657 / 1672, 158 / 941],
            [1671 / 1672, 158 / 941],
            [1671 / 1672, 377 / 941],
            [1600 / 1672, 378 / 941],
            [1572 / 1672, 353 / 941],
            [1510 / 1672, 363 / 941],
            [1431 / 1672, 370 / 941],
          ],
        },
      ],
      staticCutouts: [
        [
          [1405 / 1672, 122 / 941],
          [1523 / 1672, 122 / 941],
          [1538 / 1672, 204 / 941],
          [1510 / 1672, 255 / 941],
          [1455 / 1672, 263 / 941],
          [1407 / 1672, 240 / 941],
          [1394 / 1672, 202 / 941],
        ],
        [
          [1443 / 1672, 300 / 941],
          [1530 / 1672, 283 / 941],
          [1548 / 1672, 283 / 941],
          [1657 / 1672, 158 / 941],
          [1671 / 1672, 158 / 941],
          [1671 / 1672, 377 / 941],
          [1600 / 1672, 378 / 941],
          [1572 / 1672, 350 / 941],
          [1510 / 1672, 358 / 941],
          [1443 / 1672, 360 / 941],
        ],
      ],
    },
    portraitCharacter: {
      registered: true,
      cleanUrl: "/kilo-scenes-v43/base-portrait-clean.webp",
      actorUrl: "/kilo-scenes-v43/base-portrait-actor.webp",
      placement: { scale: 0.66, anchor: [1, 0], offset: [0, 450 / 1870] },
      contactShadows: [
        {
          center: [607 / 841, 1631 / 1870],
          radius: [37 / 841, 2 / 1870],
          opacity: 0.16,
        },
        {
          center: [772 / 841, 1622 / 1870],
          radius: [39 / 841, 2 / 1870],
          opacity: 0.14,
        },
      ],
      bones: [
        {
          id: "head",
          pivot: [620 / 841, 1182 / 1870],
          polygon: [
            [554 / 841, 1034 / 1870],
            [674 / 841, 1034 / 1870],
            [692 / 841, 1100 / 1870],
            [675 / 841, 1170 / 1870],
            [641 / 841, 1200 / 1870],
            [587 / 841, 1181 / 1870],
            [551 / 841, 1136 / 1870],
          ],
        },
        {
          id: "reelArm",
          pivot: [597 / 841, 1271 / 1870],
          polygon: [
            [578 / 841, 1228 / 1870],
            [692 / 841, 1228 / 1870],
            [725 / 841, 1217 / 1870],
            [831 / 841, 1080 / 1870],
            [840 / 841, 1080 / 1870],
            [840 / 841, 1332 / 1870],
            [780 / 841, 1335 / 1870],
            [749 / 841, 1301 / 1870],
            [660 / 841, 1328 / 1870],
            [577 / 841, 1319 / 1870],
          ],
        },
      ],
      staticCutouts: [
        [
          [554 / 841, 1034 / 1870],
          [674 / 841, 1034 / 1870],
          [692 / 841, 1100 / 1870],
          [671 / 841, 1167 / 1870],
          [641 / 841, 1182 / 1870],
          [590 / 841, 1174 / 1870],
          [551 / 841, 1136 / 1870],
        ],
        [
          [590 / 841, 1232 / 1870],
          [692 / 841, 1228 / 1870],
          [725 / 841, 1217 / 1870],
          [831 / 841, 1080 / 1870],
          [840 / 841, 1080 / 1870],
          [840 / 841, 1332 / 1870],
          [780 / 841, 1335 / 1870],
          [749 / 841, 1299 / 1870],
          [660 / 841, 1318 / 1870],
          [590 / 841, 1308 / 1870],
        ],
      ],
    },
  },
  "scatter-3": {
    desktopWater: [
      {
        polygon: [
          [0.14, 0.47],
          [0.72, 0.47],
          [0.72, 0.73],
          [0.17, 0.73],
          [0.17, 0.61],
          [0.14, 0.61],
        ],
        amplitude: 0.8,
      },
    ],
    portraitWater: [
      {
        polygon: [
          [0.14, 0.52],
          [0.65, 0.52],
          [0.65, 0.68],
          [0.14, 0.68],
        ],
        amplitude: 0.65,
      },
    ],
  },
  "scatter-4": {
    desktopWater: [
      {
        polygon: [
          [0.02, 0.47],
          [0.68, 0.47],
          [0.68, 0.67],
          [0.02, 0.67],
        ],
        amplitude: 0.65,
      },
    ],
    portraitWater: [
      {
        polygon: [
          [0.07, 0.48],
          [0.64, 0.48],
          [0.64, 0.605],
          [0.07, 0.605],
        ],
        amplitude: 0.6,
      },
    ],
  },
  "scatter-5": {
    desktopWater: [
      {
        polygon: [
          [0.22, 0.452],
          [0.555, 0.452],
          [0.555, 0.495],
          [0.22, 0.495],
        ],
        amplitude: 0.35,
      },
    ],
    portraitWater: [
      {
        polygon: [
          [0.12, 0.45],
          [0.85, 0.45],
          [0.85, 0.51],
          [0.12, 0.51],
        ],
        amplitude: 0.4,
      },
    ],
  },
  chopper: STILL,
  mystery: STILL,
  "god-mode": STILL,
  "max-win": STILL,
  completion: STILL,
};

export function integratedSceneUrl(scene: SceneId, portrait = false) {
  return environmentArtUrl(scene, portrait);
}

export const INTEGRATED_DISSOLVE_MS = 440;
export const INTEGRATED_WATER_FRAME_MS = 1000 / 30;
export const INTEGRATED_MAX_WATER_PIXELS = 680_000;

/** Bounded negative drift uses the existing left/right master overscan. */
export function integratedCloudOffset(
  elapsed: number,
  clouds: IntegratedCloudLayer,
) {
  return (
    -clouds.driftRange *
    0.5 *
    (1 + Math.sin((Math.max(0, elapsed) * Math.PI * 2) / clouds.driftPeriodMs))
  );
}

/** Quiet irregular blink cadence. This drives an actual alternate eyelid
 * drawing: 72ms closing, 90ms closed, 72ms opening, with 4.8–6.9s intervals. */
export function integratedBlinkOpacity(elapsed: number) {
  const periods = [4800, 6100, 5400, 6900, 5700, 6500];
  const total = periods.reduce((sum, period) => sum + period, 0);
  let local = Math.max(0, elapsed) % total;
  let period = periods[0];
  for (const next of periods) {
    period = next;
    if (local < period) break;
    local -= period;
  }
  const phase = local - (period - 234);
  if (phase < 0) return 0;
  if (phase < 72) {
    const progress = phase / 72;
    return progress * progress * (3 - 2 * progress);
  }
  if (phase < 162) return 1;
  const progress = Math.min(1, (phase - 162) / 72);
  return 1 - progress * progress * (3 - 2 * progress);
}

/** Modest articulated motion around authored neck/elbow pivots. No root
 * translation, foot/chair movement, full-body bob or squash is supplied. */
export function integratedCharacterAngle(
  bone: IntegratedCharacterBone["id"],
  elapsed: number,
  pose: IntegratedCharacterPose = "idle",
  reactionAge = Infinity,
  reducedMotion = false,
) {
  if (reducedMotion) return 0;
  const seconds = Math.max(0, elapsed) / 1000;
  const idle = bone === "head" ? Math.sin(seconds * 0.82) * 0.14 : 0;
  const duration = pose === "cast" ? 720 : pose === "cheer" ? 880 : 620;
  const progress = Math.max(0, reactionAge) / duration;
  let reaction = 0;
  if (pose !== "idle" && progress < 1) {
    const envelope = Math.sin(Math.PI * progress);
    if (bone === "head") {
      const amplitude = pose === "cast" ? 0.3 : pose === "cheer" ? -0.46 : 0.38;
      reaction = envelope * amplitude;
    } else if (pose === "cast") {
      reaction = -Math.sin(progress * Math.PI * 2) * envelope;
    } else if (pose === "cheer") reaction = envelope * -0.72;
  }
  const limit = bone === "head" ? 0.6 : 1;
  return Math.max(-limit, Math.min(limit, idle + reaction));
}

export function integratedCharacterRegistration(
  layer: IntegratedCharacterLayer,
) {
  const placement = layer.placement;
  const scale = placement?.scale ?? 1;
  const anchor = placement?.anchor ?? [0, 0];
  const offset = placement?.offset ?? [0, 0];
  return {
    scale,
    left: (1 - scale) * anchor[0] + offset[0],
    top: (1 - scale) * anchor[1] + offset[1],
  };
}
