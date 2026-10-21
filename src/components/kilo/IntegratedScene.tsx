import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RiggedSceneActor } from './RiggedSceneActor';
import { preloadOverhaulKing } from './overhaul-king';
import {
  SCENE_PORTRAIT_MEDIA,
  type SceneId,
  type ScenePhase,
} from "./scene-system";
import {
  INTEGRATED_DISSOLVE_MS,
  INTEGRATED_MAX_WATER_PIXELS,
  INTEGRATED_SCENES,
  INTEGRATED_WATER_FRAME_MS,
  integratedSceneCamera,
  integratedSceneMaster,
  integratedBlinkOpacity,
  integratedCharacterAngle,
  integratedCharacterRegistration,
  integratedCloudOffset,
  type IntegratedCameraLayout,
  type IntegratedCharacterPose,
  type IntegratedCharacterBone,
  type IntegratedCharacterLayer,
  type IntegratedMaster,
  type IntegratedCloudLayer,
} from "./integrated-scene-model";
import {
  integratedBirdOutline,
  integratedBirdPose,
  integratedLightOpacity,
  integratedSceneAtmosphere,
  type SceneAtmosphere,
} from "./scene-atmosphere";
import "./integrated-scene.css";
import { AuthoredCharacter } from "./AuthoredCharacter";
import { FeatureEnvironmentCanvas, preloadFeatureAtmosphere } from './FeatureEnvironmentCanvas';
import { featureEnvironmentUrl, type FeatureEnvironmentId } from './feature-environments';

export type DecodedIntegratedScene = {
  scene: SceneId;
  portrait: boolean;
  url: string;
  image: HTMLImageElement;
};

type CharacterArtwork = {
  sourceUrl: string;
  clean: HTMLImageElement;
  actor: HTMLImageElement;
};
type CharacterAngles = Partial<Record<IntegratedCharacterBone["id"], number>>;
type CharacterSnapshot = {
  artwork: CharacterArtwork;
  definition: IntegratedCharacterLayer;
  master: IntegratedMaster;
  angles: CharacterAngles;
};
type CloudArtwork = {
  sourceUrl: string;
  clean: HTMLImageElement;
  clouds: HTMLImageElement;
};
type CloudSnapshot = {
  artwork: CloudArtwork;
  definition: IntegratedCloudLayer;
  master: IntegratedMaster;
  offset: number;
};
type AtmosphereSnapshot = {
  definition: SceneAtmosphere;
  master: IntegratedMaster;
  elapsed: number;
};

/** The birds and fitted lights are painted in the same source coordinate
 * system as the skyline. A scene change retains their last pose for the same
 * dissolve as the drawing; neither viewport movement nor game state drives it. */
function RegisteredAtmosphere({
  definition,
  master,
  elapsed,
  reducedMotion = false,
  birdRef,
  lightRef,
}: AtmosphereSnapshot & {
  reducedMotion?: boolean;
  birdRef?: (id: string, node: SVGGElement | null) => void;
  lightRef?: (id: string, node: SVGElement | null) => void;
}) {
  return (
    <svg
      className="kk-integrated-atmosphere"
      viewBox={`0 0 ${master.width} ${master.height}`}
      preserveAspectRatio="none"
      focusable="false"
    >
      {definition.lights.map((light) => {
        const shared = {
          fill: light.color,
          opacity: integratedLightOpacity(elapsed, light, reducedMotion),
          ref: lightRef ? (node: SVGElement | null) => lightRef(light.id, node) : undefined,
        };
        return light.polygon ? (
          <polygon
            key={light.id}
            {...shared}
            points={light.polygon.map(([x, y]) => `${x * master.width},${y * master.height}`).join(" ")}
          />
        ) : light.center && light.radius ? (
          <circle
            key={light.id}
            {...shared}
            cx={light.center[0] * master.width}
            cy={light.center[1] * master.height}
            r={light.radius * master.width}
          />
        ) : null;
      })}
      {definition.birds.map((bird) => {
        const pose = integratedBirdPose(elapsed, bird, reducedMotion);
        return (
          <g
            key={bird.id}
            ref={birdRef ? (node) => birdRef(bird.id, node) : undefined}
            opacity={pose.opacity}
            transform={`translate(${pose.x * master.width} ${pose.y * master.height}) scale(${(bird.span * master.width) / 24})`}
          >
            <path d={integratedBirdOutline(pose.flap)} fill="#9baac0" />
          </g>
        );
      })}
    </svg>
  );
}

function RegisteredClouds({
  artwork,
  definition,
  master,
  offset,
  clipId,
  driftRef,
}: CloudSnapshot & {
  clipId: string;
  driftRef?: (node: SVGGElement | null) => void;
}) {
  return (
    <svg
      className="kk-integrated-clouds"
      viewBox={`0 0 ${master.width} ${master.height}`}
      preserveAspectRatio="none"
      focusable="false"
    >
      <defs>
        <radialGradient id={`${clipId}-falloff`}>
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="85%" stopColor="#fff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${clipId}-outer`} clipPathUnits="userSpaceOnUse">
          {definition.polygons.map((polygon, index) => (
            <polygon
              key={index}
              points={polygon
                .map(([x, y]) => `${x * master.width},${y * master.height}`)
                .join(" ")}
            />
          ))}
        </clipPath>
        <filter
          id={`${clipId}-edge`}
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
        >
          {definition.edgeInset ? (
            <feMorphology
              operator="erode"
              radius={definition.edgeInset * master.width}
            />
          ) : null}
          <feGaussianBlur
            stdDeviation={(definition.edgeFeather ?? 0) * master.width}
          />
        </filter>
        <mask
          id={clipId}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={master.width}
          height={master.height}
          style={{ maskType: "alpha" }}
        >
          <g
            fill="#fff"
            filter={!definition.falloffEllipses && definition.edgeFeather ? `url(#${clipId}-edge)` : undefined}
          >
            {definition.falloffEllipses ? definition.falloffEllipses.map((ellipse, index) => (
              <ellipse
                key={index}
                cx={ellipse.center[0] * master.width}
                cy={ellipse.center[1] * master.height}
                rx={ellipse.radius[0] * master.width}
                ry={ellipse.radius[1] * master.height}
                fill={`url(#${clipId}-falloff)`}
              />
            )) : definition.polygons.map((polygon, index) => (
              <polygon
                key={index}
                points={polygon
                  .map(([x, y]) => `${x * master.width},${y * master.height}`)
                  .join(" ")}
              />
            ))}
          </g>
        </mask>
      </defs>
      <g mask={`url(#${clipId})`} clipPath={`url(#${clipId}-outer)`}>
        <g ref={driftRef} transform={`translate(${offset * master.width} 0)`}>
          <image
            href={artwork.clouds.src}
            width={master.width}
            height={master.height}
            preserveAspectRatio="none"
          />
        </g>
      </g>
    </svg>
  );
}

function RegisteredCharacter({
  artwork,
  definition,
  master,
  clipId,
  angles,
  boneRef,
  pose = "idle",
  tick = 0,
  reduced = false,
  paused = false,
  portrait = false,
}: CharacterSnapshot & {
  clipId: string;
  boneRef?: (
    id: IntegratedCharacterBone["id"],
    node: SVGGElement | null,
  ) => void;
  pose?: IntegratedCharacterPose; tick?: number; reduced?: boolean; paused?: boolean; portrait?: boolean;
}) {
  const original = useRef<SVGSVGElement>(null);
  const points = (polygon: readonly (readonly [number, number])[]) =>
    polygon
      .map(([x, y]) => `${x * master.width},${y * master.height}`)
      .join(" ");
  const cutouts =
    definition.staticCutouts ?? definition.bones.map((bone) => bone.polygon);
  const registration = integratedCharacterRegistration(definition);
  const placement = `translate(${registration.left * master.width} ${registration.top * master.height}) scale(${registration.scale})`;
  const bodyClip = `M0,0H${master.width}V${master.height}H0Z ${cutouts
    .map(
      (polygon) =>
        `M${polygon.map(([x, y]) => `${x * master.width},${y * master.height}`).join("L")}Z`,
    )
    .join(" ")}`;
  return (
    <div className="kk-integrated-character">
    <svg aria-hidden="true" viewBox={`0 0 ${master.width} ${master.height}`} preserveAspectRatio="none" style={{position:"absolute",inset:0,width:"100%",height:"100%"}}>
      {definition.contactShadows?.map((shadow,index)=>(
        <ellipse key={index} cx={shadow.center[0]*master.width} cy={shadow.center[1]*master.height} rx={shadow.radius[0]*master.width} ry={shadow.radius[1]*master.height} fill="#10202a" opacity={shadow.opacity??0.16}/>
      ))}
    </svg>
    <svg
      ref={original}
      style={{position:"absolute",inset:0,width:"100%",height:"100%"}}
      viewBox={`0 0 ${master.width} ${master.height}`}
      preserveAspectRatio="none"
      focusable="false"
    >
      <defs>
        <clipPath id={`${clipId}-static`} clipPathUnits="userSpaceOnUse">
          <path d={bodyClip} fillRule="evenodd" clipRule="evenodd" />
        </clipPath>
        {definition.bones.map((bone) => (
          <clipPath
            key={bone.id}
            id={`${clipId}-${bone.id}`}
            clipPathUnits="userSpaceOnUse"
          >
            <polygon points={points(bone.polygon)} />
          </clipPath>
        ))}
      </defs>
      <g transform={placement}>
        <image
          href={artwork.actor.src}
          width={master.width}
          height={master.height}
          preserveAspectRatio="none"
          clipPath={`url(#${clipId}-static)`}
        />
        {definition.bones.map((bone) => (
          <g
            key={bone.id}
            ref={boneRef ? (node) => boneRef(bone.id, node) : undefined}
            transform={`rotate(${angles[bone.id] ?? 0} ${bone.pivot[0] * master.width} ${bone.pivot[1] * master.height})`}
          >
            <image
              href={artwork.actor.src}
              width={master.width}
              height={master.height}
              preserveAspectRatio="none"
              clipPath={`url(#${clipId}-${bone.id})`}
            />
          </g>
        ))}
      </g>
    </svg>
    <AuthoredCharacter definition={definition} master={master} portrait={portrait} pose={pose} tick={tick} reduced={reduced} paused={paused} fallback={original}/>
    </div>
  );
}

const decodedCache = new Map<string, Promise<DecodedIntegratedScene>>();
const MAX_DECODED_SCENES = 8;
const drawingCache = new Map<string, Promise<HTMLImageElement | null>>();

function prepareRegisteredDrawing(url: string) {
  const cached = drawingCache.get(url);
  if (cached) return cached;
  const pending: Promise<HTMLImageElement | null> =
    new Promise<HTMLImageElement | null>((resolve) => {
      const artwork = new Image();
      let finished = false;
      const finish = (result: HTMLImageElement | null) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        artwork.onload = null;
        artwork.onerror = null;
        resolve(result);
      };
      const timer = window.setTimeout(() => finish(null), 15_000);
      artwork.decoding = "async";
      artwork.onload = () =>
        void artwork.decode().then(
          () => finish(artwork),
          () =>
            finish(
              artwork.complete && artwork.naturalWidth > 0 ? artwork : null,
            ),
        );
      artwork.onerror = () => finish(null);
      artwork.src = url;
    }).then((result) => {
      if (!result && drawingCache.get(url) === pending)
        drawingCache.delete(url);
      return result;
    });
  drawingCache.set(url, pending);
  while (drawingCache.size > 6)
    drawingCache.delete(drawingCache.keys().next().value!);
  return pending;
}

/** Preparation is decorative only; callers gate Enter with base, never gate a
 * wager, award, settlement, Skip action or feature step with a network request. */
export function preloadIntegratedScene(
  scene: SceneId,
  { portrait = false }: { portrait?: boolean } = {},
): Promise<DecodedIntegratedScene> {
  void preloadFeatureAtmosphere(portrait);
  const url = featureEnvironmentUrl(scene, portrait);
  const cached = decodedCache.get(url);
  if (cached) {
    decodedCache.delete(url);
    decodedCache.set(url, cached);
    // Loading/base/completion intentionally share a painting, not a scene
    // identity. Reusing loading's metadata suppressed the stage actor in play.
    return cached.then(decoded => ({ ...decoded, scene, portrait }));
  }
  if (typeof Image === "undefined")
    return Promise.reject(new Error("Image decoding is unavailable."));
  const pending: Promise<DecodedIntegratedScene> =
    new Promise<DecodedIntegratedScene>((resolve, reject) => {
      const artwork = new Image();
      let finished = false;
      const timer = window.setTimeout(
        () => finish(new Error(`Scene preparation timed out: ${url}`)),
        20_000,
      );
      const finish = (error?: Error) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        artwork.onload = null;
        artwork.onerror = null;
        if (error) reject(error);
        else resolve({ scene, portrait, url, image: artwork });
      };
      artwork.decoding = "async";
      artwork.onload = () => {
        void artwork.decode().then(
          () => finish(),
          () =>
            finish(
              artwork.complete && artwork.naturalWidth > 0
                ? undefined
                : new Error(`Scene decoding failed: ${url}`),
            ),
        );
      };
      artwork.onerror = () => finish(new Error(`Scene loading failed: ${url}`));
      artwork.src = url;
    }).then(async decoded => {await preloadOverhaulKing();return decoded as DecodedIntegratedScene;}).catch((error: unknown) => {
      // Failed loads must be retryable through the host's existing retry action.
      if (decodedCache.get(url) === pending) decodedCache.delete(url);
      throw error;
    });
  decodedCache.set(url, pending);
  while (decodedCache.size > MAX_DECODED_SCENES)
    decodedCache.delete(decodedCache.keys().next().value!);
  return pending;
}

async function prepareIntegratedCharacter(current: DecodedIntegratedScene) {
  const definition =
    INTEGRATED_SCENES[current.scene][
      current.portrait ? "portraitCharacter" : "desktopCharacter"
    ];
  if (!definition?.registered) return { artwork: null, fitError: false };
  const [clean, actor] = await Promise.all([
    prepareRegisteredDrawing(definition.cleanUrl),
    prepareRegisteredDrawing(definition.actorUrl),
  ]);
  if (!clean || !actor) return { artwork: null, fitError: false };
  const match = [clean, actor].every(
    (image) =>
      image.naturalWidth === current.image.naturalWidth &&
      image.naturalHeight === current.image.naturalHeight,
  );
  return {
    artwork: match ? { sourceUrl: current.url, clean, actor } : null,
    fitError: !match,
  };
}

async function prepareIntegratedPresentation(current: DecodedIntegratedScene) {
  // The v79 world is a clean painting. The existing independent actor owns
  // its textures; never composite the v43 clean/sky plates over the new art.
  if (current.url.startsWith('/kilo-v79/')||current.url.startsWith('/kilo-overhaul-v1/')) return { artwork: null, fitError: false, clouds: null };
  const character = await prepareIntegratedCharacter(current);
  const definition =
    INTEGRATED_SCENES[current.scene][
      current.portrait ? "portraitClouds" : "desktopClouds"
    ];
  let clouds: CloudArtwork | null = null;
  if (definition && character.artwork) {
    const [clean, layer] = await Promise.all([
      prepareRegisteredDrawing(definition.cleanUrl),
      prepareRegisteredDrawing(definition.url),
    ]);
    if (
      clean &&
      layer &&
      [clean, layer].every(
        (image) =>
          image.naturalWidth === current.image.naturalWidth &&
          image.naturalHeight === current.image.naturalHeight,
      )
    )
      clouds = { sourceUrl: current.url, clean, clouds: layer };
  }
  return { ...character, clouds };
}

/** Boot-only essential presentation pack. A failed optional pair falls back
 * to the complete original illustration instead of leaving an empty scene. */
export async function preloadIntegratedBase(portrait = false) {
  const decoded = await preloadIntegratedScene("base", { portrait });
  await prepareIntegratedPresentation(decoded);
  return decoded;
}

export type IntegratedSceneProps = {
  scene: SceneId;
  /** Restore the feature plate behind the existing v63 base actor/camera. */
  backgroundScene?: Exclude<FeatureEnvironmentId, 'max-win'>;
  layout: IntegratedCameraLayout;
  reducedMotion: boolean;
  phase?: ScenePhase;
  paused?: boolean;
  characterPaused?: boolean;
  className?: string;
  characterPose?: IntegratedCharacterPose;
  characterTick?: number;
  stageSize?: { width: number; height: number };
};

type Layers = {
  current: DecodedIntegratedScene | null;
  previous: DecodedIntegratedScene | null;
};

/** One registered painted world behind the unchanged game rectangle. The
 * character, nearby floor and cabinet share that world's perspective/light;
 * nothing here changes the game, starts a round or supplies a payout. */
export function IntegratedScene({
  scene,
  backgroundScene,
  layout,
  reducedMotion,
  phase = "base",
  paused = false,
  characterPaused = paused,
  className = "",
  characterPose = "idle",
  characterTick = 0,
  stageSize,
}: IntegratedSceneProps) {
  const camera = integratedSceneCamera(layout, { stageSize });
  const [layers, setLayers] = useState<Layers>({
    current: null,
    previous: null,
  });
  const [failed, setFailed] = useState(false);
  const [blinkArtwork, setBlinkArtwork] = useState<HTMLImageElement | null>(
    null,
  );
  const [characterArtwork, setCharacterArtwork] =
    useState<CharacterArtwork | null>(null);
  const [characterFitError, setCharacterFitError] = useState(false);
  const [cloudArtwork, setCloudArtwork] = useState<CloudArtwork | null>(null);
  const currentRef = useRef<DecodedIntegratedScene | null>(null);
  const currentPlane = useRef<HTMLDivElement>(null);
  const waterCanvas = useRef<HTMLCanvasElement>(null);
  const blinkFace = useRef<SVGSVGElement>(null);
  const blinkHead = useRef<SVGGElement>(null);
  const boneNodes = useRef(new Map<string, SVGGElement>());
  const characterAngles = useRef<CharacterAngles>({});
  const liveCharacter = useRef<CharacterSnapshot | null>(null);
  const outgoingCharacter = useRef<CharacterSnapshot | null>(null);
  const cloudDrift = useRef<SVGGElement>(null);
  const liveClouds = useRef<CloudSnapshot | null>(null);
  const outgoingClouds = useRef<CloudSnapshot | null>(null);
  const atmosphereBirds = useRef(new Map<string, SVGGElement>());
  const atmosphereLights = useRef(new Map<string, SVGElement>());
  const liveAtmosphere = useRef<AtmosphereSnapshot | null>(null);
  const outgoingAtmosphere = useRef<AtmosphereSnapshot | null>(null);
  const blinkClipId = `kk-integrated-eyelids-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const clocks = useRef(new Map<SceneId, number>());
  const dissolveClock = useRef({ url: "", elapsed: INTEGRATED_DISSOLVE_MS });
  const reactionClock = useRef<{
    pose: IntegratedCharacterPose;
    start: number;
  }>({
    pose: "idle",
    start: 0,
  });

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    void preloadIntegratedScene(scene, { portrait: camera.portrait }).then(
      async (next) => {
        if (cancelled) return;
        if (currentRef.current?.url === next.url) {
          currentRef.current = next;
          setLayers(prior => ({ ...prior, current: next }));
          return;
        }
        // Keep the existing decorative scene until the complete next
        // presentation is ready. Both states commit together on first paint;
        // engine phases and settlement never await this preparation.
        const prepared = await prepareIntegratedPresentation(next);
        if (cancelled) return;
        const previous = currentRef.current;
        const priorCharacter = liveCharacter.current;
        outgoingCharacter.current =
          previous && priorCharacter?.artwork.sourceUrl === previous.url
            ? { ...priorCharacter, angles: { ...priorCharacter.angles } }
            : null;
        currentRef.current = next;
        outgoingClouds.current =
          previous && liveClouds.current?.artwork.sourceUrl === previous.url
            ? { ...liveClouds.current }
            : null;
        outgoingAtmosphere.current = previous && liveAtmosphere.current
          ? { ...liveAtmosphere.current }
          : null;
        setCharacterArtwork(prepared.artwork);
        setCharacterFitError(prepared.fitError);
        setCloudArtwork(prepared.clouds);
        dissolveClock.current = {
          url: next.url,
          elapsed: previous && !reducedMotion ? 0 : INTEGRATED_DISSOLVE_MS,
        };
        setLayers({ current: next, previous: reducedMotion ? null : previous });
      },
      () => {
        // Keep the last fully decoded composition instead of blanking play.
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [scene, camera.portrait, reducedMotion]);

  const blinkDefinition = layers.current
    ? INTEGRATED_SCENES[layers.current.scene][
        layers.current.portrait ? "portraitBlink" : "desktopBlink"
      ]
    : undefined;
  const characterDefinition = layers.current
    ? INTEGRATED_SCENES[layers.current.scene][
        layers.current.portrait ? "portraitCharacter" : "desktopCharacter"
      ]
    : undefined;
  const characterActive = Boolean(
    characterDefinition?.registered &&
    characterArtwork?.sourceUrl === layers.current?.url,
  );
  const cloudDefinition = layers.current
    ? INTEGRATED_SCENES[layers.current.scene][
        layers.current.portrait ? "portraitClouds" : "desktopClouds"
      ]
    : undefined;
  const characterReady = useRef(false);
  characterReady.current = characterActive;
  const master = useMemo(
    () =>
      integratedSceneMaster(
        Boolean(layers.current?.portrait),
        layers.current
          ? {
              width: layers.current.image.naturalWidth,
              height: layers.current.image.naturalHeight,
            }
          : undefined,
      ),
    [layers.current],
  );
  const blinkActive = Boolean(
    layers.current?.scene !== 'base' &&
    blinkArtwork &&
    blinkDefinition &&
    (!blinkDefinition.requiresCharacterLayer || characterActive),
  );
  const cloudsActive = Boolean(
    cloudDefinition &&
    cloudArtwork &&
    characterActive &&
    cloudArtwork.sourceUrl === layers.current?.url,
  );
  liveClouds.current =
    cloudsActive && cloudArtwork && cloudDefinition
      ? {
          artwork: cloudArtwork,
          definition: cloudDefinition,
          master,
          offset: integratedCloudOffset(
            clocks.current.get(layers.current!.scene) ?? 0,
            cloudDefinition,
          ),
        }
      : null;
  liveCharacter.current =
    characterActive && characterArtwork && characterDefinition
      ? {
          artwork: characterArtwork,
          definition: characterDefinition,
          master,
          angles: characterAngles.current,
        }
      : null;
  // Source-fitted atmosphere now shares paintFeatureEnvironment with proofs.
  // The legacy base beacon/sky coordinates do not belong to the new drawing.
  const atmosphereDefinition: SceneAtmosphere | null = null;
  liveAtmosphere.current = atmosphereDefinition && layers.current
    ? {
        definition: atmosphereDefinition,
        master,
        elapsed: clocks.current.get(layers.current.scene) ?? 0,
      }
    : null;

  useLayoutEffect(() => {
    // A late optional asset load never starts a gesture after its game event.
    reactionClock.current = {
      pose: characterReady.current ? characterPose : "idle",
      start: clocks.current.get(layers.current?.scene ?? scene) ?? 0,
    };
  }, [characterPose, characterTick, layers.current?.url, scene]);

  useEffect(() => {
    let cancelled = false;
    setBlinkArtwork(null);
    if (!reducedMotion && blinkDefinition) {
      // This optional drawing is prepared after the complete plate. A missing
      // blink must never delay Enter or any game presentation phase.
      void prepareRegisteredDrawing(blinkDefinition.url).then((artwork) => {
        if (!cancelled) setBlinkArtwork(artwork);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [blinkDefinition, reducedMotion]);

  useLayoutEffect(() => {
    const plane = currentPlane.current;
    const current = layers.current;
    if (!plane || !current) return;
    const regions = current.scene !== "base" ? [] :
      INTEGRATED_SCENES[current.scene][
        current.portrait ? "portraitWater" : "desktopWater"
      ];
    const blink = blinkActive ? blinkFace.current : null;
    const activeCharacter =
      characterActive && characterArtwork && characterDefinition
        ? { artwork: characterArtwork, definition: characterDefinition }
        : null;
    const activeClouds =
      cloudsActive && cloudArtwork && cloudDefinition
        ? { artwork: cloudArtwork, definition: cloudDefinition }
        : null;
    const canvas = waterCanvas.current;
    const context = canvas?.getContext("2d", { alpha: true });
    const source = regions.length > 0 ? document.createElement("canvas") : null;
    const sourceContext = source?.getContext("2d", { alpha: false });
    let raf = 0;
    let last = 0;
    let lastWater = -Infinity;
    let inView = true;
    let disposed = false;
    let elapsed = clocks.current.get(current.scene) ?? 0;
    let dissolve =
      layers.previous && !reducedMotion
        ? dissolveClock.current.elapsed
        : INTEGRATED_DISSOLVE_MS;
    let canvasScale = 1;
    let pixelWidth = 0;
    let pixelHeight = 0;
    const clips: Path2D[] = [];

    const drawWater = () => {
      if (!context || !source || !sourceContext || !pixelWidth || !pixelHeight)
        return;
      context.clearRect(0, 0, pixelWidth, pixelHeight);
      const seconds = elapsed / 1000;
      regions.forEach((region, index) => {
        const top = Math.max(
          0,
          Math.floor(
            Math.min(...region.polygon.map(([, y]) => y)) * pixelHeight,
          ),
        );
        const bottom = Math.min(
          pixelHeight,
          Math.ceil(
            Math.max(...region.polygon.map(([, y]) => y)) * pixelHeight,
          ),
        );
        context.save();
        context.clip(clips[index]);
        const strip = Math.max(2, Math.round(3 * canvasScale));
        for (let y = top; y < bottom; y += strip) {
          const height = Math.min(strip, bottom - y);
          const depth = (y - top) / Math.max(1, bottom - top);
          const offset =
            Math.sin(seconds * (region.speed ?? 0.65) + y * 0.046) *
            (region.amplitude ?? 1.2) *
            canvasScale *
            depth;
          context.drawImage(
            source,
            0,
            y,
            pixelWidth,
            height,
            offset,
            y,
            pixelWidth,
            height,
          );
        }
        context.restore();
      });
    };

    const resizeWater = () => {
      if (!canvas || !context || !source || !sourceContext) return;
      const width = plane.clientWidth;
      const height = plane.clientHeight;
      if (!width || !height) return;
      canvasScale = Math.min(
        1,
        Math.sqrt(INTEGRATED_MAX_WATER_PIXELS / (width * height)),
      );
      pixelWidth = Math.max(1, Math.floor(width * canvasScale));
      pixelHeight = Math.max(1, Math.floor(height * canvasScale));
      canvas.width = source.width = pixelWidth;
      canvas.height = source.height = pixelHeight;
      sourceContext.drawImage(
        activeClouds?.artwork.clean ??
          activeCharacter?.artwork.clean ??
          current.image,
        0,
        0,
        pixelWidth,
        pixelHeight,
      );
      clips.length = 0;
      regions.forEach((region) => {
        const clip = new Path2D();
        region.polygon.forEach(([x, y], index) => {
          if (index === 0) clip.moveTo(x * pixelWidth, y * pixelHeight);
          else clip.lineTo(x * pixelWidth, y * pixelHeight);
        });
        clip.closePath();
        clips.push(clip);
      });
      if (!reducedMotion) drawWater();
    };

    const stop = () => {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    };
    const canRun = () => !disposed && !paused && !document.hidden && inView;
    const poseCharacter = () => {
      const bones = activeCharacter?.definition.bones ?? [];
      for (const bone of bones) {
        const angle = integratedCharacterAngle(
          bone.id,
          elapsed,
          reactionClock.current.pose,
          elapsed - reactionClock.current.start,
          reducedMotion,
        );
        const transform = `rotate(${angle.toFixed(4)} ${bone.pivot[0] * master.width} ${bone.pivot[1] * master.height})`;
        characterAngles.current[bone.id] = angle;
        boneNodes.current.get(bone.id)?.setAttribute("transform", transform);
        if (bone.id === "head")
          blinkHead.current?.setAttribute("transform", transform);
      }
    };
    const paintAtmosphere = () => { /* Fitted atmosphere is painted by FeatureEnvironmentCanvas. */ };
    const frame = (now: number) => {
      raf = 0;
      if (!canRun()) return;
      const delta = last ? Math.min(80, now - last) : 0;
      last = now;
      if (!reducedMotion) {
        elapsed += delta;
        clocks.current.set(current.scene, elapsed);
        dissolve = Math.min(INTEGRATED_DISSOLVE_MS, dissolve + delta);
      } else dissolve = INTEGRATED_DISSOLVE_MS;
      if (blink) blink.style.opacity = String(integratedBlinkOpacity(elapsed));
      if (activeClouds && cloudDrift.current) {
        const offset = integratedCloudOffset(elapsed, activeClouds.definition);
        cloudDrift.current.setAttribute(
          "transform",
          `translate(${offset * master.width} 0)`,
        );
        if (liveClouds.current) liveClouds.current.offset = offset;
      }
      poseCharacter();
      paintAtmosphere();
      dissolveClock.current = { url: current.url, elapsed: dissolve };
      const progress = dissolve / INTEGRATED_DISSOLVE_MS;
      plane.style.opacity = String(progress * progress * (3 - 2 * progress));
      if (progress >= 1 && layers.previous) {
        setLayers((value) =>
          value.current === current && value.previous
            ? { ...value, previous: null }
            : value,
        );
      }
      if (!reducedMotion && now - lastWater >= INTEGRATED_WATER_FRAME_MS) {
        drawWater();
        lastWater = now;
      }
      if (
        (!reducedMotion &&
          (regions.length > 0 || blink || activeCharacter || activeClouds || atmosphereDefinition)) ||
        progress < 1
      )
        raf = window.requestAnimationFrame(frame);
    };
    const resume = () => {
      if (canRun() && !raf) raf = window.requestAnimationFrame(frame);
    };
    const visibility = () => (document.hidden ? stop() : resume());
    const resize = regions.length > 0 ? new ResizeObserver(resizeWater) : null;
    resize?.observe(plane);
    const intersection =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            inView = entry?.isIntersecting ?? false;
            if (inView) resume();
            else stop();
          });
    intersection?.observe(plane);
    document.addEventListener("visibilitychange", visibility);
    const initialProgress = dissolve / INTEGRATED_DISSOLVE_MS;
    plane.style.opacity = String(
      initialProgress * initialProgress * (3 - 2 * initialProgress),
    );
    resizeWater();
    poseCharacter();
    paintAtmosphere();
    resume();
    return () => {
      disposed = true;
      stop();
      resize?.disconnect();
      intersection?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      if (source) source.width = source.height = 0;
    };
  }, [
    layers.current,
    layers.previous,
    reducedMotion,
    paused,
    blinkArtwork,
    blinkDefinition,
    blinkActive,
    characterArtwork,
    characterActive,
    characterDefinition,
    master,
    cloudsActive,
    cloudArtwork,
    cloudDefinition,
    atmosphereDefinition,
  ]);

  const waterRegions = layers.current
    ? INTEGRATED_SCENES[layers.current.scene][
        layers.current.portrait ? "portraitWater" : "desktopWater"
      ]
    : [];
  const planeStyle = (artwork: DecodedIntegratedScene) => {
    const framed = integratedSceneCamera(layout, {
      portrait: artwork.portrait,
      sourceSize: {
        width: artwork.image.naturalWidth,
        height: artwork.image.naturalHeight,
      },
      stageSize,
    });
    return {
      left: framed.left,
      top: framed.top,
      width: framed.width,
      height: framed.height,
    };
  };
  const points = (polygon: readonly (readonly [number, number])[]) =>
    polygon
      .map(([x, y]) => `${x * master.width},${y * master.height}`)
      .join(" ");
  const registration =
    characterActive && characterDefinition
      ? integratedCharacterRegistration(characterDefinition)
      : { scale: 1, left: 0, top: 0 };
  const characterPlacement = `translate(${registration.left * master.width} ${registration.top * master.height}) scale(${registration.scale})`;
  const retainedCharacter =
    layers.previous &&
    outgoingCharacter.current?.artwork.sourceUrl === layers.previous.url
      ? outgoingCharacter.current
      : null;
  const retainedClouds =
    layers.previous &&
    outgoingClouds.current?.artwork.sourceUrl === layers.previous.url
      ? outgoingClouds.current
      : null;
  const retainedAtmosphere = layers.previous ? outgoingAtmosphere.current : null;

  return (
    <div
      className={`kk-integrated-scene ${className}`.trim()}
      data-scene={backgroundScene ?? layers.current?.scene ?? scene}
      data-requested-scene={backgroundScene ?? scene}
      data-phase={phase}
      data-portrait={camera.portrait}
      data-ready={Boolean(layers.current)}
      data-art-error={failed || undefined}
      data-reduced={reducedMotion}
      data-character-layer={characterActive || undefined}
      data-character-fit-error={characterFitError || undefined}
      data-cloud-layer={cloudsActive || undefined}
      data-atmosphere-layer={Boolean(atmosphereDefinition) || undefined}
      aria-hidden="true"
      inert
    >
      {layers.previous && (
        <div
          key="retained-scene"
          className="kk-integrated-plane"
          data-outgoing="true"
          style={planeStyle(layers.previous)}
        >
          <img
            src={
              retainedClouds?.artwork.clean.src ??
              retainedCharacter?.artwork.clean.src ??
              layers.previous.url
            }
            alt=""
            draggable={false}
          />
          {retainedClouds && (
            <RegisteredClouds
              {...retainedClouds}
              clipId={`${blinkClipId}-clouds-outgoing`}
            />
          )}
          {retainedAtmosphere && (
            <RegisteredAtmosphere {...retainedAtmosphere} reducedMotion={reducedMotion} />
          )}
          {retainedCharacter && (
            layers.previous.scene==='base' ? <RiggedSceneActor master={retainedCharacter.master} portrait={layers.previous.portrait} reduced paused /> : <RegisteredCharacter
              {...retainedCharacter}
              clipId={`${blinkClipId}-outgoing`}
            />
          )}
        </div>
      )}
      {layers.current && (
        <div
          key="active-scene"
          className="kk-integrated-plane"
          ref={currentPlane}
          style={planeStyle(layers.current)}
        >
          <img
            src={
              cloudsActive
                ? cloudArtwork!.clean.src
                : characterActive
                  ? characterArtwork!.clean.src
                  : layers.current.url
            }
            alt=""
            draggable={false}
          />
          {cloudsActive && cloudArtwork && cloudDefinition && (
            <RegisteredClouds
              artwork={cloudArtwork}
              definition={cloudDefinition}
              master={master}
              offset={liveClouds.current?.offset ?? 0}
              clipId={`${blinkClipId}-clouds`}
              driftRef={(node) => {
                cloudDrift.current = node;
              }}
            />
          )}
          {liveAtmosphere.current && (
            <RegisteredAtmosphere
              {...liveAtmosphere.current}
              reducedMotion={reducedMotion}
              birdRef={(id, node) => {
                if (node) atmosphereBirds.current.set(id, node);
                else atmosphereBirds.current.delete(id);
              }}
              lightRef={(id, node) => {
                if (node) atmosphereLights.current.set(id, node);
                else atmosphereLights.current.delete(id);
              }}
            />
          )}
          {(
            <FeatureEnvironmentCanvas scene={backgroundScene ?? layers.current.scene} portrait={layers.current.portrait}
              load={preloadIntegratedScene} reduced={reducedMotion} paused={characterPaused} />
          )}
          {characterActive && characterDefinition && characterArtwork && (
            layers.current.scene==='base' ? <RiggedSceneActor master={master} portrait={layers.current.portrait}
              pose={characterPose} tick={characterTick} reduced={reducedMotion} paused={characterPaused} /> : <RegisteredCharacter
              artwork={characterArtwork}
              definition={characterDefinition}
              master={master}
              angles={characterAngles.current}
              clipId={blinkClipId}
              pose={characterPose}
              tick={characterTick}
              reduced={reducedMotion}
              paused={paused}
              portrait={layers.current.portrait}
              boneRef={(id, node) => {
                if (node) boneNodes.current.set(id, node);
                else boneNodes.current.delete(id);
              }}
            />
          )}
          {blinkDefinition && blinkArtwork && blinkActive && !reducedMotion && (
            <svg
              className="kk-integrated-blink"
              ref={blinkFace}
              viewBox={`0 0 ${master.width} ${master.height}`}
              preserveAspectRatio="none"
              focusable="false"
            >
              <defs>
                <filter
                  id={`${blinkClipId}-edge`}
                  colorInterpolationFilters="sRGB"
                  x="-25%"
                  y="-50%"
                  width="150%"
                  height="200%"
                >
                  <feGaussianBlur
                    stdDeviation={
                      (blinkDefinition.edgeFeather ?? 0) * master.width
                    }
                  />
                </filter>
                <mask
                  id={blinkClipId}
                  maskUnits="userSpaceOnUse"
                  x="0"
                  y="0"
                  width={master.width}
                  height={master.height}
                  style={{ maskType: "alpha" }}
                >
                  <g
                    fill="#fff"
                    filter={
                      blinkDefinition.edgeFeather
                        ? `url(#${blinkClipId}-edge)`
                        : undefined
                    }
                  >
                    {blinkDefinition.polygons.map((polygon, index) => (
                      <polygon key={index} points={points(polygon)} />
                    ))}
                  </g>
                </mask>
              </defs>
              <g transform={characterPlacement}>
                <g ref={blinkHead}>
                  <image
                    href={blinkArtwork.src}
                    x="0"
                    y="0"
                    width={master.width}
                    height={master.height}
                    preserveAspectRatio="none"
                    mask={`url(#${blinkClipId})`}
                  />
                </g>
              </g>
            </svg>
          )}
        </div>
      )}
      {layers.current && scene !== 'loading' && (
        <div className="kk-integrated-actor-plane" style={planeStyle(layers.current)} data-stage-actor={backgroundScene ?? scene}>
          <RiggedSceneActor master={master} portrait={layers.current.portrait}
            pose={characterPose} tick={characterTick} reduced={reducedMotion} paused={characterPaused} />
        </div>
      )}
    </div>
  );
}

export type IntegratedBackdropProps = {
  scene: SceneId;
  reducedMotion: boolean;
  phase?: ScenePhase;
  paused?: boolean;
  className?: string;
};

/** Cinematic pages have no reel opening to register. They show the complete
 * location as their own backdrop; the measured playing stage uses the shared
 * camera above instead. No separate character or vehicle is mounted here. */
export function IntegratedBackdrop({
  scene,
  reducedMotion,
  phase = "preview",
  paused = false,
  className = "",
}: IntegratedBackdropProps) {
  const [portrait, setPortrait] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(SCENE_PORTRAIT_MEDIA).matches,
  );
  const [layers, setLayers] = useState<Layers>({
    current: null,
    previous: null,
  });
  const [failed, setFailed] = useState(false);
  const current = useRef<DecodedIntegratedScene | null>(null);
  const face = useRef<HTMLDivElement>(null);
  const fade = useRef({ url: "", elapsed: INTEGRATED_DISSOLVE_MS });

  useEffect(() => {
    const media = window.matchMedia(SCENE_PORTRAIT_MEDIA);
    const change = () => setPortrait(media.matches);
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    void preloadIntegratedScene(scene, { portrait }).then(
      (next) => {
        if (cancelled || current.current?.url === next.url) return;
        const previous = current.current;
        current.current = next;
        fade.current = {
          url: next.url,
          elapsed: previous && !reducedMotion ? 0 : INTEGRATED_DISSOLVE_MS,
        };
        setLayers({ current: next, previous: reducedMotion ? null : previous });
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [scene, portrait, reducedMotion]);

  useLayoutEffect(() => {
    const plane = face.current;
    if (!plane || !layers.current) return;
    let raf = 0;
    let last = 0;
    let disposed = false;
    let elapsed =
      layers.previous && !reducedMotion
        ? fade.current.elapsed
        : INTEGRATED_DISSOLVE_MS;
    const paint = () => {
      const progress = Math.min(1, elapsed / INTEGRATED_DISSOLVE_MS);
      plane.style.opacity = String(progress * progress * (3 - 2 * progress));
      return progress;
    };
    const stop = () => {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    };
    const frame = (now: number) => {
      raf = 0;
      if (disposed || paused || document.hidden) return;
      elapsed = reducedMotion
        ? INTEGRATED_DISSOLVE_MS
        : Math.min(
            INTEGRATED_DISSOLVE_MS,
            elapsed + (last ? Math.min(80, now - last) : 0),
          );
      last = now;
      fade.current.elapsed = elapsed;
      if (paint() < 1) raf = window.requestAnimationFrame(frame);
      else if (layers.previous)
        setLayers((value) =>
          value.current === layers.current
            ? { ...value, previous: null }
            : value,
        );
    };
    const resume = () => {
      if (!disposed && !paused && !document.hidden && !raf)
        raf = window.requestAnimationFrame(frame);
    };
    const visibility = () => (document.hidden ? stop() : resume());
    paint();
    resume();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      stop();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [layers.current, layers.previous, paused, reducedMotion]);

  return (
    <div
      className={`kk-integrated-backdrop ${className}`.trim()}
      data-scene={layers.current?.scene ?? scene}
      data-requested-scene={scene}
      data-phase={phase}
      data-ready={Boolean(layers.current)}
      data-art-error={failed || undefined}
      data-reduced={reducedMotion}
      aria-hidden="true"
      inert
    >
      {layers.previous && (
        <div className="kk-integrated-backdrop-plane" data-outgoing="true">
          <img src={layers.previous.url} alt="" draggable={false} />
        </div>
      )}
      {layers.current && (
        <div className="kk-integrated-backdrop-plane" ref={face}>
          <img src={layers.current.url} alt="" draggable={false} />
          <FeatureEnvironmentCanvas scene={layers.current.scene} portrait={layers.current.portrait}
            load={preloadIntegratedScene} reduced={reducedMotion} paused={paused} />
        </div>
      )}
    </div>
  );
}
