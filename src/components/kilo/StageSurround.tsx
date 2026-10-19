import { stageArtPaint, FEATURE_MARK } from "./stage-art";

export function StageSurround({
  width,
  height,
  mode,
}: {
  width: number;
  height: number;
  mode: string;
}) {
  return (
    <svg
      className="kk-stage-surround"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: stageArtPaint(width, height, mode) }}
    />
  );
}
export function FeatureMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: FEATURE_MARK }}
    />
  );
}
