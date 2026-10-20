import type { SplashScript } from "@/lib/kilo/engine";
import { environmentArtUrl } from './environment-art';

/** Environment identity is presentation data, never an engine mode. */
export type SceneId =
  | "loading"
  | "base"
  | "scatter-3"
  | "scatter-4"
  | "scatter-5"
  | "chopper"
  | "mystery"
  | "god-mode"
  | "max-win"
  | "completion";
export type ScenePhase =
  "loading" | "base" | "entry" | "feature" | "complete" | "preview";
export type SceneAnchor = { x: number; y: number; width: number };
export type SceneBoat = SceneAnchor & {
  sprite?: "boat" | "getaway";
  motion?: "moored" | "getaway";
  /** Shore uses plate coordinates; the hull attachment uses sprite coordinates. */
  mooring?: {
    shore: readonly [number, number];
    hull: readonly [number, number];
  };
};
export type SceneFraming = {
  focusX: number;
  boat?: SceneBoat;
  helicopter?: SceneAnchor;
  waterline?: number;
  waterMask?: readonly (readonly [number, number])[];
  /** Separate windows of water around rigid foreground structures. */
  waterRegions?: readonly (readonly (readonly [number, number])[])[];
};
export type SceneDefinition = {
  id: SceneId;
  title: string;
  accent: string;
  plate: string;
  portrait: string;
  waterline: number;
  /** Normalized plate coordinates. Never refract buildings, piers or boats. */
  waterMask: readonly (readonly [number, number])[];
  desktop: SceneFraming;
  phone: SceneFraming;
  previewOnly?: boolean;
};

export const SCENE_PORTRAIT_MEDIA =
  "(max-width: 620px) and (orientation: portrait)";
export const ENVIRONMENT_FRAME_MS = 1000 / 24;
export const ENVIRONMENT_MAX_PIXELS = 680_000;
export const SCENE_SPRITES = {
  boat: "/kilo-scenes-v41/boat.webp",
  helicopter: "/kilo-scenes-v41/helicopter-body.webp",
  getaway: "/kilo-scenes-v41/getaway-boat.webp",
} as const;

// Keep a generous still-water margin around all waterfront architecture. Each
// plate may narrow this envelope after its art review, without touching reels.
const WATER_MASK = [
  [0.32, 0.48],
  [0.68, 0.48],
  [0.84, 0.58],
  [0.92, 0.76],
  [0.92, 1],
  [0.08, 1],
  [0.08, 0.76],
  [0.16, 0.58],
] as const;
const DOCK: SceneFraming = {
  focusX: 0.5,
  boat: {
    x: 0.21,
    y: 0.52,
    width: 0.17,
    motion: "moored",
    // The rope-wrap on the illustrated foreground bollard, not open water.
    mooring: { shore: [0.13, 0.375], hull: [0.13, 0.72] },
  },
};
const PHONE_DOCK: SceneFraming = {
  focusX: 0.5,
  boat: {
    x: 0.31,
    y: 0.5,
    width: 0.4,
    motion: "moored",
    mooring: { shore: [0.14, 0.38], hull: [0.13, 0.72] },
  },
};
function scene(
  id: SceneId,
  title: string,
  accent: string,
  desktop: SceneFraming = { focusX: 0.5 },
  phone: SceneFraming = { focusX: 0.5 },
  previewOnly = false,
): SceneDefinition {
  return {
    id,
    title,
    accent,
    plate: environmentArtUrl(id),
    portrait: environmentArtUrl(id, true),
    waterline: 0.35,
    waterMask: WATER_MASK,
    desktop,
    phone,
    ...(previewOnly ? { previewOnly: true } : {}),
  };
}

/** Each environment has a dedicated wide and portrait illustration. Masks and
 * physical anchor points were fitted to those finished plates, not reused from
 * the previous marina. Foreground quays, piles, yachts and the helipad stay rigid. */
export const SCENES: Readonly<Record<SceneId, SceneDefinition>> = {
  loading: scene("loading", "Welcome to Miami", "#d3b073"),
  base: scene("base", "Kilo’s marina", "#65cfc7", DOCK, PHONE_DOCK),
  "scatter-3": scene("scatter-3", "Midnight canal", "#57d9c7"),
  "scatter-4": {
    ...scene(
      "scatter-4",
      "The Gilded Yacht",
      "#e8bd72",
      {
        focusX: 0.5,
        waterline: 0.28,
        waterRegions: [
          [
            [0.01, 0.286],
            [0.315, 0.286],
            [0.31, 0.305],
            [0.01, 0.385],
          ],
          [
            [0.845, 0.286],
            [0.99, 0.286],
            [0.99, 0.355],
            [0.855, 0.312],
          ],
        ],
      },
      {
        focusX: 0.5,
        waterline: 0.19,
        waterRegions: [
          [
            [0.01, 0.195],
            [0.215, 0.195],
            [0.2, 0.225],
            [0.01, 0.274],
          ],
          [
            [0.81, 0.195],
            [0.99, 0.195],
            [0.99, 0.276],
            [0.815, 0.236],
          ],
        ],
      },
    ),
    // The foreground is a solid teak deck, not a water surface.
    waterMask: [],
  },
  "scatter-5": scene(
    "scatter-5",
    "Port of Miami",
    "#e09d8b",
    {
      focusX: 0.5,
      waterline: 0.47,
      waterMask: [
        [0.3, 0.5],
        [0.85, 0.5],
        [0.99, 0.58],
        [0.99, 1],
        [0.4, 1],
        [0.32, 0.84],
        [0.24, 0.71],
        [0.16, 0.6],
      ],
    },
    {
      focusX: 0.5,
      waterline: 0.35,
      waterMask: [
        [0.3, 0.39],
        [0.85, 0.39],
        [0.99, 0.46],
        [0.99, 0.99],
        [0.5, 0.99],
        [0.39, 0.82],
        [0.25, 0.66],
        [0.1, 0.56],
      ],
    },
  ),
  chopper: scene(
    "chopper",
    "Private heliport",
    "#a2dce9",
    {
      focusX: 0.5,
      waterline: 0.29,
      waterMask: [
        [0.32, 0.33],
        [0.7, 0.33],
        [0.7, 0.47],
        [0.98, 0.55],
        [0.98, 0.99],
        [0.02, 0.99],
        [0.02, 0.45],
        [0.28, 0.41],
      ],
      helicopter: { x: 0.86, y: 0.105, width: 0.16 },
    },
    {
      focusX: 0.5,
      waterline: 0.27,
      waterMask: [
        [0.32, 0.3],
        [0.65, 0.3],
        [0.65, 0.42],
        [0.98, 0.45],
        [0.98, 0.99],
        [0.02, 0.99],
        [0.02, 0.42],
        [0.28, 0.38],
      ],
      helicopter: { x: 0.82, y: 0.175, width: 0.32 },
    },
  ),
  mystery: scene(
    "mystery",
    "Veiled boatyard",
    "#c6a5ec",
    {
      focusX: 0.5,
      waterMask: [
        [0.3, 0.43],
        [0.7, 0.43],
        [0.88, 0.54],
        [0.89, 0.66],
        [0.78, 0.84],
        [0.65, 0.99],
        [0.02, 0.99],
        [0.02, 0.54],
      ],
    },
    {
      focusX: 0.5,
      waterMask: [
        [0.28, 0.4],
        [0.72, 0.4],
        [0.85, 0.54],
        [0.85, 0.65],
        [0.78, 0.78],
        [0.52, 0.99],
        [0.02, 0.99],
        [0.02, 0.52],
      ],
    },
    true,
  ),
  "god-mode": scene(
    "god-mode",
    "Crown estate",
    "#f2d99b",
    { focusX: 0.5 },
    { focusX: 0.5 },
    true,
  ),
  "max-win": scene(
    "max-win",
    "The Getaway",
    "#9bdce0",
    {
      focusX: 0.5,
      waterMask: [
        [0.28, 0.39],
        [0.89, 0.39],
        [0.89, 0.55],
        [0.99, 0.64],
        [0.99, 0.99],
        [0.35, 0.99],
        [0.24, 0.81],
        [0.15, 0.69],
        [0.065, 0.61],
      ],
      boat: {
        x: 0.55,
        y: 0.78,
        width: 0.32,
        sprite: "getaway",
        motion: "getaway",
      },
      helicopter: { x: 0.82, y: 0.13, width: 0.16 },
    },
    {
      focusX: 0.5,
      waterMask: [
        [0.28, 0.4],
        [0.86, 0.4],
        [0.86, 0.56],
        [0.99, 0.65],
        [0.99, 0.99],
        [0.49, 0.99],
        [0.28, 0.82],
        [0.15, 0.69],
      ],
      boat: {
        x: 0.58,
        y: 0.78,
        width: 0.5,
        sprite: "getaway",
        motion: "getaway",
      },
      helicopter: { x: 0.76, y: 0.15, width: 0.33 },
    },
    true,
  ),
  completion: scene("completion", "Return to Miami", "#e9c387"),
};

/** Never infer the tier from awarded spins: a recorded modifier may add two. */
export function sceneForRound(round: SplashScript | null | undefined): SceneId {
  if (!round?.free.length) return "base";
  if((round.version===3||round.version===4)&&round.feature)return ({dock:"scatter-3",yacht:"scatter-4",yacht25:"scatter-4",route:"chopper",getaway:"max-win"} as const)[round.feature];
  if (round.mode === "chopper") return "chopper";
  if (round.mode === "buy") return "scatter-3";
  if (round.base.scatters >= 5) return "scatter-5";
  if (round.base.scatters >= 4) return "scatter-4";
  return "scatter-3";
}

/** Uses the existing director publication; adds no waits or presentation events. */
export function phaseForPresentation({
  booted,
  summary,
  hud,
  round,
}: {
  booted: boolean;
  summary: unknown;
  hud: { active: boolean; note: string; phase?: 'entry' } | null | undefined;
  round: SplashScript | null | undefined;
}): ScenePhase {
  if (!booted) return "loading";
  if (summary != null && summary !== false) return "complete";
  if (!hud?.active) return "base";
  if (hud.phase === 'entry') return 'entry';
  if (round && hud.note.startsWith(`${round.awarded} free spins · starts at ×`))
    return "entry";
  return "feature";
}

export type SceneAssetOptions = { portrait?: boolean; includeLayers?: boolean };
export function prefersPortraitScene(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(SCENE_PORTRAIT_MEDIA).matches
  );
}
export function sceneAssetUrls(
  id: SceneId,
  options: SceneAssetOptions = {},
): string[] {
  const portrait = options.portrait ?? prefersPortraitScene();
  const definition = SCENES[id];
  const framing = portrait ? definition.phone : definition.desktop;
  return [
    portrait ? definition.portrait : definition.plate,
    ...(options.includeLayers === false
      ? []
      : [
          ...(framing.boat
            ? [SCENE_SPRITES[framing.boat.sprite ?? "boat"]]
            : []),
          ...(framing.helicopter ? [SCENE_SPRITES.helicopter] : []),
        ]),
  ];
}

const decoded = new Map<string, Promise<HTMLImageElement>>();
/** Bounded decode cache; old layers retain their own image until fade completion. */
function decodeImage(url: string): Promise<HTMLImageElement> {
  const existing = decoded.get(url);
  if (existing) {
    decoded.delete(url);
    decoded.set(url, existing);
    return existing;
  }
  const result = new Promise<HTMLImageElement>((resolve, reject) => {
    if (typeof Image === "undefined") {
      reject(
        new Error("Scene image decoding is only available in the browser."),
      );
      return;
    }
    const image = new Image();
    image.decoding = "async";
    let settled = false;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      if (error) reject(error);
      else resolve(image);
    };
    const timeout = setTimeout(
      () => finish(new Error(`Environment artwork timed out: ${url}`)),
      15_000,
    );
    image.onload = () => {
      // Loading is not necessarily decoding. Keep the old scene until both finish.
      void image.decode().then(() => finish(), finish);
    };
    image.onerror = () =>
      finish(new Error(`Unable to load environment artwork: ${url}`));
    image.src = url;
  });
  decoded.set(url, result);
  while (decoded.size > 8) decoded.delete(decoded.keys().next().value!);
  void result.catch(() => {
    if (decoded.get(url) === result) decoded.delete(url);
  });
  return result;
}

export type DecodedScene = {
  id: SceneId;
  portrait: boolean;
  url: string;
  image: HTMLImageElement;
  /** An optional ornament failure never blocks the decoded environment plate. */
  sprites: Partial<Record<keyof typeof SCENE_SPRITES, HTMLImageElement>>;
};
export async function preloadScene(
  id: SceneId,
  options: SceneAssetOptions = {},
): Promise<DecodedScene> {
  const portrait = options.portrait ?? prefersPortraitScene();
  const urls = sceneAssetUrls(id, { ...options, portrait });
  const image = await decodeImage(urls[0]!);
  const sprites: DecodedScene["sprites"] = {};
  await Promise.all(
    urls.slice(1).map(async (url) => {
      try {
        const sprite = await decodeImage(url);
        const key = (
          Object.keys(SCENE_SPRITES) as (keyof typeof SCENE_SPRITES)[]
        ).find((name) => SCENE_SPRITES[name] === url);
        if (key) sprites[key] = sprite;
      } catch {
        // Static authored plate remains complete if optional decoration fails.
      }
    }),
  );
  return { id, portrait, url: urls[0]!, image, sprites };
}

/** Call for likely next environments, not the entire catalogue at first entry. */
export function preloadScenes(
  ids: readonly SceneId[],
  options: SceneAssetOptions = {},
) {
  return Promise.allSettled(ids.map((id) => preloadScene(id, options)));
}
