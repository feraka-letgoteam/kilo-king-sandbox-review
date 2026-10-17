import { useEffect, useRef, useState } from "react";
import "./marina-backdrop.css";

const SCENE_SOURCE = "/kilo-scene-v14/marina-night.webp";
const SOURCE_WATERLINE = 0.3;
const FRAME_INTERVAL = 1000 / 20;
const MAX_PIXELS = 680_000;
const LAMPS = [
  { x: 0.022, y: 0.096, radius: 0.019, period: 9.2, phase: 0 },
  { x: 0.045, y: 0.2, radius: 0.012, period: 7.6, phase: 1.1 },
  { x: 0.269, y: 0.253, radius: 0.009, period: 10.3, phase: 2.7 },
  { x: 0.944, y: 0.225, radius: 0.013, period: 8.7, phase: 0.7 },
] as const;

/** Decorative only: the waterfront never participates in game or reel state. */
export function MarinaBackdrop({ reducedMotion }: { reducedMotion: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    if (reducedMotion) return;

    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    const sourceCanvas = document.createElement("canvas");
    const sourceContext = sourceCanvas.getContext("2d", { alpha: false });
    if (!context || !sourceContext) return;

    const scene = new Image();
    scene.decoding = "async";
    let disposed = false;
    let loaded = false;
    let visible = true;
    let timer: number | null = null;
    let width = 0;
    let height = 0;
    let bitmapScale = 1;
    let waterTop = 0;
    let waterClip: Path2D | null = null;
    let sceneCover = { left: 0, top: 0, width: 0, height: 0 };
    let elapsed = 0;
    let previousTime = 0;

    const stop = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      previousTime = 0;
    };
    const canAnimate = () =>
      !disposed &&
      loaded &&
      visible &&
      !document.hidden &&
      width > 0 &&
      height > 0;

    const draw = () => {
      // The source image is scaled/cropped just once on resize. Rendering from
      // this small backing canvas avoids repeatedly resampling the full artwork.
      // Keep the full-resolution CSS sky, buildings and boats visible. Only
      // refracted water and small translucent light halos enter this canvas.
      context.clearRect(0, 0, width, height);
      const stripe = Math.max(2, Math.round(5 * bitmapScale));
      const depthRange = Math.max(1, height - waterTop);
      const seconds = elapsed / 1000;
      context.save();
      if (waterClip) context.clip(waterClip);
      for (let y = waterTop; y < height; y += stripe) {
        const stripHeight = Math.min(stripe, height - y);
        const depth = (y - waterTop) / depthRange;
        const screenY = y / bitmapScale;
        // Fade the displacement in at the horizon. At the foreground its
        // combined amplitude stays below three CSS pixels, independent of DPR.
        const amplitude = 2 * Math.sqrt(depth) * bitmapScale;
        const offset =
          amplitude *
          (Math.sin(seconds * 0.72 + screenY * 0.075) +
            0.35 * Math.sin(-seconds * 0.49 + screenY * 0.029));
        context.drawImage(
          sourceCanvas,
          0,
          y,
          width,
          stripHeight,
          offset,
          y,
          width,
          stripHeight,
        );
      }
      context.restore();
      context.save();
      context.globalCompositeOperation = "screen";
      for (const lamp of LAMPS) {
        const x = sceneCover.left + lamp.x * sceneCover.width;
        const y = sceneCover.top + lamp.y * sceneCover.height;
        const radius = lamp.radius * sceneCover.width;
        const breath =
          0.5 +
          0.5 * Math.sin((seconds * Math.PI * 2) / lamp.period + lamp.phase);
        const glow = context.createRadialGradient(x, y, 0, x, y, radius);
        glow.addColorStop(0, `rgba(255, 199, 111, ${0.035 + breath * 0.035})`);
        glow.addColorStop(
          0.35,
          `rgba(255, 151, 58, ${0.018 + breath * 0.018})`,
        );
        glow.addColorStop(1, "rgba(255, 131, 37, 0)");
        context.fillStyle = glow;
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
      context.restore();
    };

    const tick = () => {
      timer = null;
      if (!canAnimate()) {
        previousTime = 0;
        return;
      }
      const now = performance.now();
      if (previousTime) elapsed += Math.min(100, now - previousTime);
      previousTime = now;
      draw();
      // A real 20fps timer, rather than a 60/120fps RAF loop that discards frames.
      timer = window.setTimeout(tick, FRAME_INTERVAL);
    };

    const resume = () => {
      if (canAnimate() && timer === null) tick();
    };

    const resize = () => {
      if (disposed || !loaded) return;
      const cssWidth = host.clientWidth;
      const cssHeight = host.clientHeight;
      if (!cssWidth || !cssHeight) {
        width = 0;
        height = 0;
        stop();
        return;
      }
      bitmapScale = Math.min(
        1,
        1280 / cssWidth,
        900 / cssHeight,
        Math.sqrt(MAX_PIXELS / (cssWidth * cssHeight)),
      );
      width = Math.max(1, Math.floor(cssWidth * bitmapScale));
      height = Math.max(1, Math.floor(cssHeight * bitmapScale));
      canvas.width = sourceCanvas.width = width;
      canvas.height = sourceCanvas.height = height;
      context.imageSmoothingEnabled =
        sourceContext.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = sourceContext.imageSmoothingQuality =
        "high";

      // Match CSS background-size: cover / background-position: center exactly.
      const cover = Math.max(
        width / scene.naturalWidth,
        height / scene.naturalHeight,
      );
      const imageWidth = scene.naturalWidth * cover;
      const imageHeight = scene.naturalHeight * cover;
      const imageLeft = (width - imageWidth) / 2;
      const imageTop = (height - imageHeight) / 2;
      sceneCover = {
        left: imageLeft,
        top: imageTop,
        width: imageWidth,
        height: imageHeight,
      };
      sourceContext.drawImage(
        scene,
        imageLeft,
        imageTop,
        imageWidth,
        imageHeight,
      );
      waterTop = Math.min(
        height,
        Math.max(0, Math.ceil(imageTop + imageHeight * SOURCE_WATERLINE)),
      );
      // A conservative water-only envelope leaves the boats and near-shore
      // pilings rigid. These points are normalized to this scene's artwork.
      waterClip = new Path2D();
      const waterOutline = [
        [0.37, SOURCE_WATERLINE],
        [0.75, SOURCE_WATERLINE],
        [0.9, 0.4],
        [1, 0.44],
        [1, 1],
        [0, 1],
        [0, 0.44],
        [0.08, 0.4],
      ];
      waterOutline.forEach(([x, y], index) => {
        const px = imageLeft + x! * imageWidth;
        const py = imageTop + y! * imageHeight;
        if (index === 0) waterClip!.moveTo(px, py);
        else waterClip!.lineTo(px, py);
      });
      waterClip.closePath();
      draw();
      setReady(true);
      resume();
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else resume();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    const intersectionObserver =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = entry?.isIntersecting ?? false;
            if (visible) resume();
            else stop();
          });
    intersectionObserver?.observe(host);
    document.addEventListener("visibilitychange", onVisibility);
    scene.onload = () => {
      if (disposed) return;
      loaded = true;
      resize();
    };
    scene.onerror = () => {
      loaded = false;
      stop();
      if (!disposed) setReady(false);
    };
    scene.src = SCENE_SOURCE;

    return () => {
      disposed = true;
      stop();
      scene.onload = null;
      scene.onerror = null;
      resizeObserver.disconnect();
      intersectionObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      sourceCanvas.width = sourceCanvas.height = 0;
    };
  }, [reducedMotion]);

  return (
    <div
      ref={hostRef}
      className="kk-marina-backdrop"
      data-animated={!reducedMotion && ready ? "true" : "false"}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
