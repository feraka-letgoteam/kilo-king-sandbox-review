import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ENVIRONMENT_FRAME_MS,
  ENVIRONMENT_MAX_PIXELS,
  SCENES,
  SCENE_PORTRAIT_MEDIA,
  preloadScene,
  prefersPortraitScene,
  type DecodedScene,
  type SceneAnchor,
  type SceneId,
  type ScenePhase,
} from "./scene-system";
import "./environment-scene.css";

export type EnvironmentSceneProps = {
  scene: SceneId;
  phase?: ScenePhase;
  reducedMotion: boolean;
  paused?: boolean;
  className?: string;
};

/** Decorative only. State changes never alter the game box or await gameplay. */
export function EnvironmentScene({
  scene,
  phase = "base",
  reducedMotion,
  paused = false,
  className = "",
}: EnvironmentSceneProps) {
  const [portrait, setPortrait] = useState(prefersPortraitScene);
  const [layers, setLayers] = useState<{
    current: DecodedScene | null;
    previous: DecodedScene | null;
  }>({
    current: null,
    previous: null,
  });
  const [failed, setFailed] = useState(false);
  const [appeared, setAppeared] = useState(false);
  const currentRef = useRef<DecodedScene | null>(null);
  const clocks = useRef(new Map<SceneId, number>());

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
    void preloadScene(scene, { portrait }).then(
      (next) => {
        if (cancelled) return;
        const previous = currentRef.current;
        if (previous?.url === next.url) return;
        currentRef.current = next;
        setAppeared(false);
        setLayers({ current: next, previous: reducedMotion ? null : previous });
      },
      () => {
        // A missing scene must never blank the existing environment or stop a spin.
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [scene, portrait, reducedMotion]);

  useEffect(() => {
    if (!layers.current) return;
    const frame = window.requestAnimationFrame(() => setAppeared(true));
    const clear = window.setTimeout(
      () => {
        setLayers((current) =>
          current.previous ? { ...current, previous: null } : current,
        );
      },
      reducedMotion ? 0 : 520,
    );
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(clear);
    };
  }, [layers.current, reducedMotion]);

  return (
    <div
      className={`kk-environment ${className}`.trim()}
      data-scene={layers.current?.id ?? scene}
      data-requested-scene={scene}
      data-phase={phase}
      data-reduced={reducedMotion ? "true" : "false"}
      data-ready={layers.current ? "true" : "false"}
      data-art-error={failed ? "true" : undefined}
      aria-hidden="true"
      inert
    >
      {layers.previous && (
        <ScenePlane
          key={layers.previous.url}
          decoded={layers.previous}
          animate={false}
          current={false}
          appeared
          clocks={clocks.current}
        />
      )}
      {layers.current && (
        <ScenePlane
          key={layers.current.url}
          decoded={layers.current}
          animate={!reducedMotion && !paused}
          current
          appeared={appeared || reducedMotion}
          clocks={clocks.current}
        />
      )}
      <div className="kk-environment-shade" />
    </div>
  );
}

function ScenePlane({
  decoded,
  animate,
  current,
  appeared,
  clocks,
}: {
  decoded: DecodedScene;
  animate: boolean;
  current: boolean;
  appeared: boolean;
  clocks: Map<SceneId, number>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const waterRef = useRef<HTMLCanvasElement>(null);
  const boatRef = useRef<HTMLDivElement>(null);
  const mooringRef = useRef<SVGSVGElement>(null);
  const ropeRef = useRef<SVGPathElement>(null);
  const ropeShadowRef = useRef<SVGPathElement>(null);
  const wakeRef = useRef<SVGSVGElement>(null);
  const helicopterRef = useRef<HTMLDivElement>(null);
  const rotorRef = useRef<HTMLSpanElement>(null);
  const searchlightRef = useRef<HTMLSpanElement>(null);
  const beaconRef = useRef<HTMLSpanElement>(null);
  const definition = SCENES[decoded.id];
  const framing = decoded.portrait ? definition.phone : definition.desktop;
  const waterMask = framing.waterMask ?? definition.waterMask;
  const waterRegions = useMemo(
    () =>
      [waterMask, ...(framing.waterRegions ?? [])].filter(
        (region) => region.length >= 3,
      ),
    [waterMask, framing.waterRegions],
  );
  const waterline = framing.waterline ?? definition.waterline;
  const boatImage = decoded.sprites[framing.boat?.sprite ?? "boat"];
  const getaway = framing.boat?.motion === "getaway";
  const animateRef = useRef(animate);
  animateRef.current = animate;
  const elapsedRef = useRef(clocks.get(decoded.id) ?? 0);
  const syncMotion = useRef<(() => void) | null>(null);
  const initialAnchor = (anchor: SceneAnchor): CSSProperties => ({
    left: `${anchor.x * 100}%`,
    top: `${anchor.y * 100}%`,
    width: `${anchor.width * 100}%`,
  });

  useLayoutEffect(() => {
    const host = hostRef.current;
    const canvas = waterRef.current;
    if (!host || !canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    const source = document.createElement("canvas");
    const sourceContext = source.getContext("2d", { alpha: false });
    if (!context || !sourceContext) return;
    let disposed = false;
    let inView = true;
    let timer: number | null = null;
    let previous = 0;
    let scale = 1;
    let width = 0;
    let height = 0;
    let cover = { left: 0, top: 0, width: 0, height: 0 };
    let clip: Path2D | null = null;
    let waterTop = 0;
    let waterBottom = 0;
    const stop = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      previous = 0;
    };
    const canAnimate = () =>
      animateRef.current &&
      !disposed &&
      inView &&
      !document.hidden &&
      width > 0 &&
      height > 0;

    const place = (
      node: HTMLElement | null,
      anchor: SceneAnchor | undefined,
    ) => {
      if (!node || !anchor) return;
      node.style.left = `${(cover.left + anchor.x * cover.width) / scale}px`;
      node.style.top = `${(cover.top + anchor.y * cover.height) / scale}px`;
      node.style.width = `${(anchor.width * cover.width) / scale}px`;
    };
    const pose = (seconds: number) => {
      const boat = boatRef.current;
      if (boat && framing.boat && boatImage) {
        const bob =
          Math.sin(seconds * (getaway ? 1.8 : 1.2)) * (getaway ? 0.8 : 1.5);
        const roll = Math.sin(seconds * 0.86) * (getaway ? 0.22 : 0.4);
        // The getaway drifts right without a loop boundary/teleport; its travel
        // asymptotically stays inside the authored safe area on a long preview.
        const drift = getaway
          ? (cover.width / scale) * 0.065 * (1 - Math.exp(-seconds / 45))
          : 0;
        // Hull, wash/wake and reflection share one transform and one waterline.
        boat.style.transform = `translate(calc(-50% + ${drift.toFixed(2)}px), calc(-95% + ${bob.toFixed(2)}px)) rotate(${roll.toFixed(2)}deg)`;
        if (wakeRef.current) {
          const swell = Math.sin(seconds * 1.35);
          wakeRef.current.style.transform = `scaleX(${(1 + swell * 0.025).toFixed(3)})`;
          wakeRef.current.style.opacity = String(
            getaway ? 0.11 + swell * 0.012 : 0.1 + swell * 0.012,
          );
        }
        const tether = framing.boat.mooring;
        if (tether && ropeRef.current) {
          const bw = (framing.boat.width * cover.width) / scale;
          const bh = (bw * boatImage.naturalHeight) / boatImage.naturalWidth;
          const angle = (roll * Math.PI) / 180;
          const hx = (tether.hull[0] - 0.5) * bw;
          const hy = (tether.hull[1] - 0.95) * bh;
          const bx =
            (cover.left + framing.boat.x * cover.width) / scale +
            drift +
            hx * Math.cos(angle) -
            hy * Math.sin(angle);
          const by =
            (cover.top + framing.boat.y * cover.height) / scale +
            bob +
            hx * Math.sin(angle) +
            hy * Math.cos(angle);
          const sx = (cover.left + tether.shore[0] * cover.width) / scale;
          const sy = (cover.top + tether.shore[1] * cover.height) / scale;
          const sag = Math.max(
            3,
            Math.min(12, Math.hypot(bx - sx, by - sy) * 0.07),
          );
          const path = `M${sx.toFixed(2)},${sy.toFixed(2)} Q${((sx + bx) / 2).toFixed(2)},${(Math.max(sy, by) + sag).toFixed(2)} ${bx.toFixed(2)},${by.toFixed(2)}`;
          ropeRef.current.setAttribute("d", path);
          ropeShadowRef.current?.setAttribute("d", path);
        }
      }
      const helicopter = helicopterRef.current;
      if (helicopter) {
        const bob = Math.sin(seconds * 1.08) * 2;
        const pitch = Math.sin(seconds * 0.64) * 0.35;
        helicopter.style.transform = `translate(-50%, ${bob.toFixed(2)}px) rotate(${pitch.toFixed(2)}deg)`;
      }
      if (rotorRef.current) {
        const width = 0.82 + Math.abs(Math.cos(seconds * 12)) * 0.18;
        rotorRef.current.style.transform = `translateX(-50%) scaleX(${width.toFixed(3)})`;
      }
      if (searchlightRef.current) {
        const sweep = Math.sin(seconds * 0.25) * 6;
        searchlightRef.current.style.transform = `translateX(-50%) rotate(${sweep.toFixed(2)}deg)`;
      }
      if (beaconRef.current) {
        // A small, slow change at the authored tail lamp, never a strobe.
        // The authored red tail navigation lamp breathes gently in place.
        beaconRef.current.style.opacity = String(
          0.25 + 0.08 * Math.sin(seconds * 0.65),
        );
      }
    };
    const draw = () => {
      context.clearRect(0, 0, width, height);
      const seconds = elapsedRef.current / 1000;
      if (waterRegions.length > 0) {
        context.save();
        if (clip) context.clip(clip);
        const strip = Math.max(2, Math.round(4 * scale));
        const depthRange = Math.max(1, waterBottom - waterTop);
        for (let y = waterTop; y < waterBottom; y += strip) {
          const sh = Math.min(strip, waterBottom - y);
          const depth = (y - waterTop) / depthRange;
          const offset =
            Math.min(1, depth * 7) *
            (0.55 + depth * 2.7) *
            scale *
            (Math.sin(seconds * 1.35 + (y / scale) * 0.052) +
              0.3 * Math.sin(seconds * -0.82 + (y / scale) * 0.025));
          const sy = Math.max(
            waterTop,
            Math.min(
              waterBottom - sh,
              y + Math.sin(seconds * 1.2 + depth * 14) * depth * scale,
            ),
          );
          context.drawImage(source, 0, sy, width, sh, offset, y, width, sh);
        }
        context.restore();
      }
      pose(seconds);
    };
    const tick = () => {
      timer = null;
      if (!canAnimate()) return;
      const now = performance.now();
      if (previous) elapsedRef.current += Math.min(100, now - previous);
      clocks.set(decoded.id, elapsedRef.current);
      previous = now;
      draw();
      timer = window.setTimeout(tick, ENVIRONMENT_FRAME_MS);
    };
    const resume = () => {
      if (canAnimate() && timer === null) tick();
    };
    syncMotion.current = () => (canAnimate() ? resume() : stop());
    const resize = () => {
      if (disposed) return;
      const cssWidth = host.clientWidth;
      const cssHeight = host.clientHeight;
      if (!cssWidth || !cssHeight) {
        width = height = 0;
        stop();
        return;
      }
      scale = Math.min(
        1,
        1280 / cssWidth,
        900 / cssHeight,
        Math.sqrt(ENVIRONMENT_MAX_PIXELS / (cssWidth * cssHeight)),
      );
      width = Math.max(1, Math.floor(cssWidth * scale));
      height = Math.max(1, Math.floor(cssHeight * scale));
      canvas.width = source.width = width;
      canvas.height = source.height = height;
      mooringRef.current?.setAttribute(
        "viewBox",
        `0 0 ${cssWidth} ${cssHeight}`,
      );
      const ratio = Math.max(
        width / decoded.image.naturalWidth,
        height / decoded.image.naturalHeight,
      );
      const imageWidth = decoded.image.naturalWidth * ratio;
      const imageHeight = decoded.image.naturalHeight * ratio;
      cover = {
        left: (width - imageWidth) * framing.focusX,
        top: (height - imageHeight) / 2,
        width: imageWidth,
        height: imageHeight,
      };
      sourceContext.drawImage(
        decoded.image,
        cover.left,
        cover.top,
        cover.width,
        cover.height,
      );
      clip = new Path2D();
      waterRegions.forEach((region) => {
        region.forEach(([x, y], index) => {
          const px = cover.left + x * cover.width;
          const py = cover.top + y * cover.height;
          if (index === 0) clip!.moveTo(px, py);
          else clip!.lineTo(px, py);
        });
        clip!.closePath();
      });
      waterTop = Math.max(
        0,
        Math.min(height, Math.floor(cover.top + cover.height * waterline)),
      );
      const lastWaterY = Math.max(
        0,
        ...waterRegions.flatMap((region) => region.map(([, y]) => y)),
      );
      waterBottom = Math.max(
        0,
        Math.min(height, Math.ceil(cover.top + cover.height * lastWaterY)),
      );
      place(boatRef.current, framing.boat);
      place(helicopterRef.current, framing.helicopter);
      draw();
      resume();
    };
    const visibility = () => {
      if (document.hidden) stop();
      else resume();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const intersection =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            inView = entry?.isIntersecting ?? false;
            if (inView) resume();
            else stop();
          });
    intersection?.observe(host);
    document.addEventListener("visibilitychange", visibility);
    resize();
    return () => {
      disposed = true;
      stop();
      observer.disconnect();
      intersection?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      source.width = source.height = 0;
      syncMotion.current = null;
    };
  }, [decoded, framing, waterRegions, waterline, boatImage, getaway, clocks]);
  useEffect(() => {
    syncMotion.current?.();
  }, [animate]);

  return (
    <div
      className="kk-environment-plane"
      ref={hostRef}
      data-current={current ? "true" : "false"}
      data-appeared={appeared ? "true" : "false"}
      style={
        {
          "--environment-accent": definition.accent,
          "--environment-focus": `${framing.focusX * 100}%`,
        } as CSSProperties
      }
    >
      <img
        className="kk-environment-plate"
        src={decoded.url}
        alt=""
        draggable={false}
        decoding="async"
      />
      <canvas className="kk-environment-water" ref={waterRef} />
      {framing.boat?.mooring && boatImage && (
        <svg
          className="kk-environment-mooring"
          ref={mooringRef}
          focusable="false"
        >
          <path className="kk-environment-rope-shadow" ref={ropeShadowRef} />
          <path className="kk-environment-rope" ref={ropeRef} />
        </svg>
      )}
      {framing.boat && boatImage && (
        <div
          className="kk-environment-boat"
          ref={boatRef}
          style={initialAnchor(framing.boat)}
          data-motion={getaway ? "getaway" : "moored"}
        >
          <svg
            className="kk-environment-wake"
            ref={wakeRef}
            viewBox="0 0 140 30"
            focusable="false"
          >
            {getaway ? (
              <>
                <path d="M90 4 Q65 12 30 17" />
                <path d="M88 8 Q64 18 38 23" />
              </>
            ) : (
              <>
                <path d="M10 8 Q70 19 130 8" />
                <path d="M2 16 Q70 28 138 16" />
              </>
            )}
          </svg>
          <img
            className="kk-environment-boat-hull"
            src={boatImage.src}
            alt=""
            draggable={false}
          />
          <img
            className="kk-environment-boat-reflection"
            src={boatImage.src}
            alt=""
            draggable={false}
          />
        </div>
      )}
      {framing.helicopter && decoded.sprites.helicopter && (
        <div
          className="kk-environment-helicopter"
          ref={helicopterRef}
          style={initialAnchor(framing.helicopter)}
        >
          <span className="kk-environment-searchlight" ref={searchlightRef} />
          <img src={decoded.sprites.helicopter.src} alt="" draggable={false} />
          <span className="kk-environment-rotor" ref={rotorRef} />
          {decoded.id === "max-win" && (
            <span className="kk-environment-beacon" ref={beaconRef} />
          )}
        </div>
      )}
    </div>
  );
}
