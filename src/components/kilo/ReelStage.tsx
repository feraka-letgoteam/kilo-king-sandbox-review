import { useEffect, useRef } from "react";
import type { ReelScene } from "./director";

export type MountedScene = ReelScene & { destroy(): void };

export function ReelStage({ onReady }: { onReady: (scene: MountedScene) => void }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let dead = false;
    let mounted: MountedScene | null = null;
    const node = host.current;
    if (!node) return;
    void import("./pixiStage").then(async ({ mountScene }) => {
      if (dead || !host.current) return;
      mounted = (await mountScene(host.current)) as MountedScene;
      if (dead) {
        mounted.destroy();
        return;
      }
      onReady(mounted);
    });
    return () => {
      dead = true;
      mounted?.destroy();
    };
  }, [onReady]);

  return <div ref={host} className="h-full w-full" />;
}