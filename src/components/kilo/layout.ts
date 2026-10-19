/** Viewport geometry only. Feature state never changes the reel rectangle. */
export type GameLayout = {
  mode: "portrait" | "wide" | "landscape";
  width: number;
  height: number;
  reelWidth: number;
  reelHeight: number;
  header: number;
  dock: number;
  strip: number;
  side: number;
  controlLeft: number;
  artLeft: number;
  artRight: number;
  dockGap: number;
  compact?: boolean;
};
export function fitGameLayout(width: number, height: number): GameLayout {
  const w = Math.max(280, Math.floor(width)),
    h = Math.max(200, Math.floor(height)),
    ratio = 1.66;
  // Popout: preserve square reel cells and fold secondary actions into Menu.
  // The same rectangle is used throughout base and feature playback.
  if (w >= 352 && w < 740 && h < 360 && w / h > 1.4) {
    const reelHeight = Math.max(160, Math.min(h - 44, (w - 72) / ratio));
    const reelWidth = Math.max(280, Math.floor(reelHeight * ratio));
    return {
      mode: "landscape",
      compact: true,
      width: reelWidth + 72,
      height: reelHeight + 44,
      reelWidth,
      reelHeight,
      header: 0,
      dock: reelHeight + 44,
      strip: 0,
      side: 64,
      controlLeft: 0,
      artLeft: 0,
      artRight: 0,
      dockGap: 8,
    };
  }
  const landscape =
    (w >= 740 && h < 660 && w / h > 1.4) ||
    (w >= 540 && h < 500 && w / h > 1.25);
  if (landscape) {
    const header = 56,
      controlLeft = 128,
      side = 96,
      gap = 10;
    const reelHeight = Math.max(
      280 / ratio,
      Math.min(h - header, (w - controlLeft - side - gap * 2) / ratio),
    );
    const reelWidth = Math.floor(reelHeight * ratio),
      totalHeight = Math.max(280, header + reelHeight);
    return {
      mode: "landscape",
      width: controlLeft + gap + reelWidth + gap + side,
      height: totalHeight,
      reelWidth,
      reelHeight,
      header,
      dock: totalHeight,
      strip: 0,
      side,
      controlLeft,
      artLeft: 0,
      artRight: 0,
      dockGap: gap,
    };
  }
  const portrait = w < 900,
    framed = !portrait && w >= 1180 && h >= 660;
  const artLeft = framed ? Math.min(250, Math.floor(w * 0.17)) : 0,
    artRight = framed ? Math.min(290, Math.floor(w * 0.2)) : 0;
  const header = portrait ? 104 : framed ? 64 : 112,
    dock = portrait ? 160 : 100,
    dockGap = 0,
    strip = 0;
  const overhead = header + dock;
  const reelWidth = Math.floor(
    Math.min(
      portrait ? 680 : framed ? 1040 : 1000,
      w - artLeft - artRight,
      Math.max(280, (h - overhead) * ratio),
    ),
  );
  const reelHeight = reelWidth / ratio;
  return {
    mode: portrait ? "portrait" : "wide",
    width: Math.max(portrait ? 0 : 800, reelWidth + artLeft + artRight),
    height: overhead + reelHeight,
    reelWidth,
    reelHeight,
    header,
    dock,
    strip,
    side: 0,
    controlLeft: 0,
    artLeft,
    artRight,
    dockGap,
  };
}
