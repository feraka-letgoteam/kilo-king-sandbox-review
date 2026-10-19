import { dockPaint, type DockDesign } from "./dock-design";
/** Decorative vector metalwork; all labels, amounts and targets remain HTML. */
export function DockSkin({ design }: { design: DockDesign }) {
  return (
    <svg
      className="kk-dock-skin"
      width={design.width}
      height={design.height}
      viewBox={`0 0 ${design.width} ${design.height}`}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: dockPaint(design) }}
    />
  );
}
