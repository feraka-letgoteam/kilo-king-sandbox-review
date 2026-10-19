import type { SceneId } from "./scene-system";

/** Fitted to the v43 base illustrations. Every coordinate is normalized to
 * that illustration's canvas, so atmosphere follows its camera and dissolve.
 * These are background details, never game events, rewards or phase timers. */
export type SceneBird = {
  id: string;
  from: readonly [number, number];
  to: readonly [number, number];
  arc: number;
  /** Full wingspan as a fraction of the master width. */
  span: number;
  delayMs: number;
  flightMs: number;
  cycleMs: number;
  flapMs: number;
  maxOpacity: number;
};

export type SceneLight = {
  id: string;
  /** Source-pixel positions are divided by the exact source dimensions below.
   * Only existing beacon bulbs and the inner glass of existing lamps are used. */
  polygon?: readonly (readonly [number, number])[];
  center?: readonly [number, number];
  radius?: number;
  kind: "beacon" | "lamp";
  color: string;
  periodMs: number;
  phaseMs: number;
  maxOpacity: number;
};

export type SceneAtmosphere = {
  birds: readonly SceneBird[];
  lights: readonly SceneLight[];
};

const desktopPoint = (x: number, y: number) =>
  [x / 1920, y / 1080] as const;
const phonePoint = (x: number, y: number) =>
  [x / 768, y / 1708] as const;

const DESKTOP: SceneAtmosphere = {
  birds: [
    {
      id: "gull-lead",
      from: [-0.025, 0.076],
      to: [0.48, 0.058],
      arc: -0.012,
      span: 0.0088,
      delayMs: 1600,
      flightMs: 21_000,
      cycleMs: 39_000,
      flapMs: 1050,
      maxOpacity: 0.84,
    },
    {
      id: "gull-follow",
      from: [-0.025, 0.087],
      to: [0.48, 0.069],
      arc: -0.012,
      span: 0.0068,
      delayMs: 2900,
      flightMs: 21_000,
      cycleMs: 39_000,
      flapMs: 1190,
      maxOpacity: 0.72,
    },
  ],
  lights: [
    {
      id: "north-tower-beacon",
      center: desktopPoint(1302, 12),
      radius: 2.1 / 1920,
      kind: "beacon",
      color: "#ff6b71",
      periodMs: 8400,
      phaseMs: 1700,
      maxOpacity: 0.8,
    },
    {
      id: "canal-tower-beacon",
      center: desktopPoint(1086, 53),
      radius: 1.9 / 1920,
      kind: "beacon",
      color: "#ff7180",
      periodMs: 10_300,
      phaseMs: 5600,
      maxOpacity: 0.76,
    },
    {
      id: "left-balustrade-lamp",
      polygon: [desktopPoint(215, 613), desktopPoint(233, 612), desktopPoint(233, 666), desktopPoint(215, 670)],
      kind: "lamp",
      color: "#fff2bf",
      periodMs: 7300,
      phaseMs: 800,
      maxOpacity: 0.12,
    },
    {
      id: "right-balustrade-lamp",
      polygon: [desktopPoint(1414, 626), desktopPoint(1432, 625), desktopPoint(1432, 668), desktopPoint(1415, 666)],
      kind: "lamp",
      color: "#fff2bf",
      periodMs: 9100,
      phaseMs: 3300,
      maxOpacity: 0.1,
    },
  ],
};

const PORTRAIT: SceneAtmosphere = {
  birds: [
    {
      id: "gull-lead",
      from: [-0.04, 0.096],
      to: [0.84, 0.061],
      arc: -0.012,
      span: 0.018,
      delayMs: 1400,
      flightMs: 16_500,
      cycleMs: 33_000,
      flapMs: 1050,
      maxOpacity: 0.84,
    },
    {
      id: "gull-follow",
      from: [-0.04, 0.104],
      to: [0.84, 0.069],
      arc: -0.012,
      span: 0.014,
      delayMs: 2650,
      flightMs: 16_500,
      cycleMs: 33_000,
      flapMs: 1190,
      maxOpacity: 0.72,
    },
  ],
  lights: [
    {
      id: "north-tower-beacon",
      center: phonePoint(677, 356),
      radius: 1.8 / 768,
      kind: "beacon",
      color: "#ff6b71",
      periodMs: 8400,
      phaseMs: 1700,
      maxOpacity: 0.8,
    },
    {
      id: "canal-tower-beacon",
      center: phonePoint(521, 452),
      radius: 1.6 / 768,
      kind: "beacon",
      color: "#ff7180",
      periodMs: 10_300,
      phaseMs: 5600,
      maxOpacity: 0.76,
    },
    {
      id: "left-balustrade-lamp",
      polygon: [phonePoint(72, 1003), phonePoint(86, 1004), phonePoint(86, 1059), phonePoint(72, 1060)],
      kind: "lamp",
      color: "#fff2bf",
      periodMs: 7300,
      phaseMs: 800,
      maxOpacity: 0.12,
    },
    {
      id: "middle-balustrade-lamp",
      polygon: [phonePoint(213, 1016), phonePoint(226, 1015), phonePoint(226, 1064), phonePoint(213, 1065)],
      kind: "lamp",
      color: "#fff2bf",
      periodMs: 9100,
      phaseMs: 3300,
      maxOpacity: 0.1,
    },
  ],
};

/** Locations are deliberately opt-in. No generic particles or floating lights
 * are stamped onto artwork that has not been inspected and fitted. */
export function integratedSceneAtmosphere(scene: SceneId, portrait: boolean) {
  return scene === "base" ? (portrait ? PORTRAIT : DESKTOP) : null;
}

export function integratedBirdPose(
  elapsed: number,
  bird: SceneBird,
  reducedMotion = false,
) {
  const cycle = ((Math.max(0, elapsed) - bird.delayMs) % bird.cycleMs + bird.cycleMs) % bird.cycleMs;
  const progress = Math.min(1, cycle / bird.flightMs);
  const travel = progress * (3 - 2 * progress) * progress;
  // Fade only while outside the skyline corridor. No visible wrap or restart.
  const envelope = Math.min(1, progress / 0.08, (1 - progress) / 0.08);
  return {
    x: bird.from[0] + (bird.to[0] - bird.from[0]) * travel,
    y: bird.from[1] + (bird.to[1] - bird.from[1]) * travel + Math.sin(progress * Math.PI) * bird.arc,
    flap: Math.sin((Math.max(0, elapsed) * Math.PI * 2) / bird.flapMs),
    opacity: reducedMotion || cycle >= bird.flightMs ? 0 : Math.max(0, envelope) * bird.maxOpacity,
  };
}

/** A small inked silhouette with articulated wing tips, not a translated still
 * photo. Coordinates are local; the SVG group supplies registered world scale. */
export function integratedBirdOutline(flap: number) {
  const tip = (-1.5 + Math.max(-1, Math.min(1, flap)) * 4.5).toFixed(3);
  const elbow = (-1.2 + Number(tip) * 0.34).toFixed(3);
  const lowerTip = (Number(tip) + 1.25).toFixed(3);
  return `M-12,${tip} Q-6,${elbow} -0.9,-0.65 L0,-2.2 L0.9,-0.65 Q6,${elbow} 12,${tip} L9.3,${lowerTip} Q4.6,0.2 1.1,0.65 L0.4,2.1 L-0.4,2.1 L-1.1,0.65 Q-4.6,0.2 -9.3,${lowerTip} Z`;
}

/** No rapid strobe: roof beacons brighten once per 8.4/10.3 seconds; warm
 * architectural lamps only breathe by ten to twelve percent of the drawing. */
export function integratedLightOpacity(
  elapsed: number,
  light: SceneLight,
  reducedMotion = false,
) {
  if (reducedMotion) return 0;
  const phase = ((Math.max(0, elapsed) + light.phaseMs) * Math.PI * 2) / light.periodMs;
  const wave = (1 + Math.cos(phase)) / 2;
  return light.maxOpacity * (light.kind === "beacon" ? Math.pow(wave, 14) : wave);
}
