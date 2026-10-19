import { Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import { stageArtLayout, stageArtSlices } from "./stage-art";

/** Decorative plane below all win, collection and hook effects. The same
 * painted slices are used by the SVG outer silhouette; canvas clips its part. */
export function createMarinaFrame(texture: Texture) {
  const root = new Container();
  root.eventMode = "none";
  const mask = new Graphics();
  const sprites = stageArtSlices(1000, 600, "wide").map((p) => {
    const sprite = new Sprite(
      new Texture({
        source: texture.source,
        frame: new Rectangle(p.sx, p.sy, p.sw, p.sh),
      }),
    );
    root.addChild(sprite);
    return sprite;
  });
  root.addChild(mask);
  root.mask = mask;
  function place(width: number, height: number, mode: string) {
    const { x, inset: edge } = stageArtLayout(width, height, mode);
    const out = -x;
    stageArtSlices(width, height, mode).forEach((p, i) => {
      sprites[i].position.set(p.x, p.y);
      sprites[i].width = p.w;
      sprites[i].height = p.h;
    });
    mask
      .clear()
      .rect(-out, -out, width + 2 * out, edge + out)
      .rect(-out, height - edge, width + 2 * out, edge + out)
      .rect(-out, edge, edge + out, height - 2 * edge)
      .rect(width - edge, edge, edge + out, height - 2 * edge)
      .fill(0xffffff);
  }
  return { root, place };
}
