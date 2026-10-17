import { useEffect, useRef, useState } from "react";
import "./marina-backdrop.css";

const SCENE_SOURCE = "/kilo-scene-v14/marina-night.webp";
const SOURCE_WATERLINE = 0.3;
const FRAME_INTERVAL = 1000 / 24;
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
    const reflectionCanvas = document.createElement("canvas");
    const reflectionContext = reflectionCanvas.getContext("2d");
    const hazeCanvas = document.createElement("canvas");
    const hazeContext = hazeCanvas.getContext("2d");
    if (!context || !sourceContext || !reflectionContext || !hazeContext)
      return;

    // A small seamless noise veil, built once. Broad waves are broken up by
    // finer harmonics so the sky drifts as wisps rather than a moving glow blob.
    hazeCanvas.width = 768;
    hazeCanvas.height = 160;
    const haze = hazeContext.createImageData(
      hazeCanvas.width,
      hazeCanvas.height,
    );
    for (let y = 0; y < hazeCanvas.height; y++) {
      const ny = y / (hazeCanvas.height - 1);
      const edgeFade = Math.sin(ny * Math.PI) ** 2;
      for (let x = 0; x < hazeCanvas.width; x++) {
        const nx = (x / hazeCanvas.width) * Math.PI * 2;
        const wave =
          Math.sin(nx * 3 + Math.sin(ny * 8) * 1.5) +
          0.48 * Math.sin(nx * 7 - ny * 15) +
          0.22 * Math.sin(nx * 13 + ny * 27);
        const density = Math.max(0, Math.min(1, (wave + 0.4) / 1.8));
        const index = (y * hazeCanvas.width + x) * 4;
        haze.data[index] = 112;
        haze.data[index + 1] = 137;
        haze.data[index + 2] = 177;
        haze.data[index + 3] = Math.round(70 * density * edgeFade);
      }
    }
    hazeContext.putImageData(haze, 0, 0);

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
    const reflectionStrips: number[] = [];
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
      const stripe = Math.max(1, Math.round(3 * bitmapScale));
      const depthRange = Math.max(1, height - waterTop);
      const seconds = elapsed / 1000;

      // Sky-only wind drift. The base scene stays crisp and stationary; this
      // low-opacity layer is clipped above the waterfront and never touches it.
      context.save();
      context.beginPath();
      context.rect(
        0,
        0,
        width,
        Math.max(0, sceneCover.top + sceneCover.height * 0.19),
      );
      context.clip();
      const hazeWidth = sceneCover.width * 0.78;
      const hazeHeight = sceneCover.height * 0.14;
      const hazeDrift = (seconds * sceneCover.width * 0.008) % hazeWidth;
      context.globalAlpha = 0.32;
      for (let tile = -2; tile < 3; tile++) {
        context.drawImage(
          hazeCanvas,
          sceneCover.left + tile * hazeWidth + hazeDrift,
          sceneCover.top - sceneCover.height * 0.025,
          hazeWidth,
          hazeHeight,
        );
      }
      context.restore();
      context.save();
      if (waterClip) context.clip(waterClip);
      reflectionStrips.length = 0;
      for (let y = waterTop; y < height; y += stripe) {
        const stripHeight = Math.min(stripe, height - y);
        const depth = (y - waterTop) / depthRange;
        const screenY = y / bitmapScale;
        // Readable in the narrow water strips beside the cabinet: coherent
        // 3–5 second waves, up to 6.5 CSS px sideways and 1.4px vertically.
        const horizonFade = Math.min(1, depth * 16);
        const amplitude =
          (1.4 + 3.4 * Math.sqrt(depth)) * horizonFade * bitmapScale;
        const offset =
          amplitude *
          (Math.sin(seconds * 1.85 + screenY * 0.055) +
            0.35 * Math.sin(-seconds * 1.23 + screenY * 0.021));
        const vertical =
          1.4 *
          Math.sqrt(depth) *
          bitmapScale *
          Math.sin(seconds * 1.45 - screenY * 0.033);
        const sampleY = Math.max(
          waterTop,
          Math.min(height - stripHeight, y + vertical),
        );
        context.drawImage(
          sourceCanvas,
          0,
          sampleY,
          width,
          stripHeight,
          offset,
          y,
          width,
          stripHeight,
        );
        // The mask contains the artwork's actual bright reflections, not new
        // particle streaks. A travelling light swell changes their intensity.
        const lightSwell =
          0.5 + 0.5 * Math.sin(seconds * 1.65 - screenY * 0.028);
        reflectionStrips.push(
          sampleY,
          y,
          stripHeight,
          offset,
          0.06 + 0.26 * lightSwell,
        );
      }
      // Batch the highlight modulation after refraction. The original art is
      // already luminous; easing its highlights down and back up remains
      // visible without bleaching neon colors or repeatedly changing blend mode.
      for (let i = 0; i < reflectionStrips.length; i += 5) {
        context.globalAlpha = reflectionStrips[i + 4]!;
        context.drawImage(
          reflectionCanvas,
          0,
          reflectionStrips[i]!,
          width,
          reflectionStrips[i + 2]!,
          reflectionStrips[i + 3]!,
          reflectionStrips[i + 1]!,
          width,
          reflectionStrips[i + 2]!,
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
      // A capped 24fps timer, rather than a 60/120fps RAF loop that discards frames.
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
      reflectionCanvas.width = width;
      reflectionCanvas.height = height;
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
      // Cache a highlight-only copy on resize. Restricting alpha to existing
      // bright pixels preserves the shapes and colors of the neon reflections.
      const reflections = sourceContext.getImageData(0, 0, width, height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          const brightness =
            Math.max(
              reflections.data[index]!,
              reflections.data[index + 1]!,
              reflections.data[index + 2]!,
            ) / 255;
          reflections.data[index] = 0;
          reflections.data[index + 1] = 0;
          reflections.data[index + 2] = 0;
          reflections.data[index + 3] =
            y < waterTop
              ? 0
              : Math.round(Math.max(0, (brightness - 0.32) / 0.68) * 175);
        }
      }
      reflectionContext.putImageData(reflections, 0, 0);
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
      reflectionCanvas.width = reflectionCanvas.height = 0;
      hazeCanvas.width = hazeCanvas.height = 0;
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
