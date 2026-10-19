import { useEffect, useLayoutEffect, useRef } from "react";
import type { ReelScene } from "./director";

export type MountedScene = ReelScene & { destroy(): void };

export function ReelStage({ onReady, boatStage = false }: { onReady: (scene: MountedScene) => void; boatStage?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const liveScene = useRef<MountedScene | null>(null);
  useLayoutEffect(() => { liveScene.current?.setBoatStage?.(boatStage); }, [boatStage]);

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
      liveScene.current = mounted;
      mounted.setBoatStage?.(host.current?.dataset.boatStage === 'true');
      onReady(mounted);
    });
    return () => {
      dead = true;
      mounted?.destroy();
      liveScene.current = null;
    };
  }, [onReady]);

  return <div ref={host} data-boat-stage={boatStage} className="h-full w-full" />;
}
