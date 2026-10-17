import { useEffect, useId, useState } from "react";
import "./fisherman-scene.css";

export type FishermanPose = "idle" | "cast" | "cheer" | "slump";

const POSES: readonly FishermanPose[] = ["idle", "cast", "cheer", "slump"];
const sourceFor = (pose: FishermanPose) => `/kilo-night-v3/hero-${pose}.png`;

/** Registered full-body artwork; pose timing belongs to the existing game events. */
export function FishermanScene({
  pose,
  tick,
  reducedMotion,
  compact = false,
}: {
  pose: FishermanPose;
  tick: number;
  reducedMotion: boolean;
  compact?: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const upperClip = `kk-fisher-upper-${id}`;
  const lowerClip = `kk-fisher-lower-${id}`;
  const [ready, setReady] = useState<Partial<Record<FishermanPose, boolean>>>(
    {},
  );
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let disposed = false;
    const images = POSES.map((nextPose) => {
      const image = new Image();
      image.decoding = "async";
      let settling = false;
      const decoded = async () => {
        if (settling) return;
        settling = true;
        try {
          await image.decode();
        } catch {
          // A completed usable image is also a safe fallback on older decoders.
        }
        if (!disposed && image.complete && image.naturalWidth > 0)
          setReady((previous) => ({ ...previous, [nextPose]: true }));
      };
      image.onload = () => void decoded();
      image.src = sourceFor(nextPose);
      if (image.complete && image.naturalWidth > 0) void decoded();
      return image;
    });
    const onVisibility = () => setHidden(document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      for (const image of images) image.onload = null;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const displayedPose = ready[pose] ? pose : "idle";
  const source = sourceFor(displayedPose);

  return (
    <div
      className="kk-fisherman-scene"
      data-pose={displayedPose}
      data-compact={compact ? "true" : "false"}
      data-reduced={reducedMotion ? "true" : "false"}
      data-hidden={hidden ? "true" : "false"}
      aria-hidden="true"
    >
      <svg
        viewBox={compact ? "160 110 1140 1170" : "160 110 1140 2056"}
        preserveAspectRatio="xMidYMax meet"
        focusable="false"
      >
        {/* The body crop spans x160–1300: the raised fist begins at x173,
            and the widest opaque boot ends at x1250 across all four poses.
            Only decorative rod/reel extents may leave this reserved column. */}
        <defs>
          <clipPath id={upperClip} clipPathUnits="userSpaceOnUse">
            <rect x="0" y="0" width="1536" height="1200" />
          </clipPath>
          <clipPath id={lowerClip} clipPathUnits="userSpaceOnUse">
            <rect x="0" y="1200" width="1536" height="1104" />
          </clipPath>
        </defs>
        {/* All four poses share the same opaque boot baseline at y≈2166.
            Fixed lower-body artwork keeps both feet planted on the pier. */}
        <image
          href={source}
          x="0"
          y="0"
          width="1536"
          height="2304"
          clipPath={`url(#${lowerClip})`}
        />
        {/* The split crosses the dark trousers, below the vest. A hard clip
            avoids a translucent seam or doubled people from pose crossfades. */}
        <g clipPath={`url(#${upperClip})`}>
          <image
            key={`${displayedPose}-${tick}`}
            className="kk-fisherman-upper"
            href={source}
            x="0"
            y="0"
            width="1536"
            height="2304"
          />
        </g>
      </svg>
    </div>
  );
}
