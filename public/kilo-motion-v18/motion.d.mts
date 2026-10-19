export const ROOT: string;
export const ASSETS: Record<string, string>;
export const RIG: {
  canvas: number[];
  feet: number;
  view: number[];
  compactView: number[];
  parts: Record<
    string,
    {
      file: string;
      blink?: string;
      rect: number[];
      pivot?: number[];
      rest?: number;
    }
  >;
};
export const CLIPS: Record<
  string,
  { duration: number; loop: boolean; events?: { at: number; name: string }[] }
>;
export const MARINA: { size: number[]; waterline: number; boats: unknown[] };
export function motionAt(
  pose?: string,
  elapsed?: number,
  reduced?: boolean,
): Record<string, number | boolean>;
export function reactionAt(
  kind: string,
  elapsed: number,
  reduced?: boolean,
): { frame: number; alpha: number; x: number; y: number; scale: number };
export function drawFisherman(
  ctx: CanvasRenderingContext2D,
  assets: Record<string, HTMLImageElement>,
  options?: {
    pose?: string;
    elapsed?: number;
    reduced?: boolean;
    explode?: number;
  },
): void;
export function drawMarina(
  ctx: CanvasRenderingContext2D,
  assets: Record<string, HTMLImageElement>,
  width: number,
  height: number,
  elapsed?: number,
  reduced?: boolean,
): void;
