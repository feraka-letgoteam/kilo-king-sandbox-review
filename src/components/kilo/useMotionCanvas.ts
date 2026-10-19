import { useEffect, useRef, useState } from "react";
import { ASSETS } from "../../../public/kilo-motion-v18/motion.mjs";

type Images = Record<string, HTMLImageElement>;
const images = new Map<string, Promise<HTMLImageElement>>();
function loadImage(name: string) {
  let promise = images.get(name);
  if (!promise) {
    promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        void image
          .decode()
          .catch(() => undefined)
          .then(() => resolve(image));
      };
      image.onerror = () =>
        reject(new Error("Animation image unavailable: " + name));
      image.src = ASSETS[name]!;
    });
    images.set(name, promise);
    void promise.catch(() => images.delete(name));
  }
  return promise;
}
type Painter = (
  ctx: CanvasRenderingContext2D,
  assets: Images,
  width: number,
  height: number,
  elapsed: number,
) => void;

/** Decorative clock: hidden/offscreen pause, one draw for reduced motion,
 * same pose after resize. This never participates in round settlement. */
export function useMotionCanvas(
  names: readonly string[],
  paint: Painter,
  reduced: boolean,
  clockKey: string,
  maxPixels: number,
) {
  const hostRef = useRef<HTMLDivElement>(null),
    canvasRef = useRef<HTMLCanvasElement>(null);
  const paintRef = useRef(paint);
  paintRef.current = paint;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const host = hostRef.current,
      canvas = canvasRef.current,
      ctx = canvas?.getContext("2d");
    if (!host || !canvas || !ctx) return;
    let disposed = false,
      visible = true,
      timer: number | undefined,
      previous = 0,
      elapsed = 0,
      width = 0,
      height = 0,
      loaded: Images | null = null;
    const stop = () => {
      window.clearTimeout(timer);
      timer = undefined;
      previous = 0;
    };
    const draw = () => {
      if (!loaded || width < 1 || height < 1) return;
      ctx.clearRect(0, 0, width, height);
      paintRef.current(ctx, loaded, width, height, reduced ? 0 : elapsed);
    };
    const tick = () => {
      timer = undefined;
      if (disposed || !visible || document.hidden || !loaded) return;
      const now = performance.now();
      if (previous) elapsed += Math.min(100, now - previous);
      previous = now;
      draw();
      if (!reduced) timer = window.setTimeout(tick, 1000 / 24);
    };
    const resume = () => {
      if (timer === undefined && visible && !document.hidden && loaded) tick();
    };
    const resize = () => {
      const w = host.clientWidth,
        h = host.clientHeight;
      if (!w || !h) {
        stop();
        return;
      }
      const scale = Math.min(
        window.devicePixelRatio || 1,
        2,
        Math.sqrt(maxPixels / (w * h)),
      );
      width = canvas.width = Math.max(1, Math.round(w * scale));
      height = canvas.height = Math.max(1, Math.round(h * scale));
      draw();
      resume();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const intersection =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = entry?.isIntersecting ?? false;
            if (visible) resume();
            else stop();
          });
    intersection?.observe(host);
    const visibility = () => {
      if (document.hidden) stop();
      else resume();
    };
    document.addEventListener("visibilitychange", visibility);
    void Promise.all(
      names.map(async (name) => [name, await loadImage(name)] as const),
    )
      .then((entries) => {
        if (disposed) return;
        loaded = Object.fromEntries(entries);
        resize();
        setReady(true);
      })
      .catch(() => {
        if (!disposed) {
          stop();
          setReady(false);
        }
      });
    return () => {
      disposed = true;
      stop();
      observer.disconnect();
      intersection?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [names, reduced, clockKey, maxPixels]);
  return { hostRef, canvasRef, ready };
}
