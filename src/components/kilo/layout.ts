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
  artLeft: number;
  artRight: number;
  dockGap: number;
};

export function fitGameLayout(width: number, height: number): GameLayout {
  const w = Math.max(280, Math.floor(width));
  const h = Math.max(200, Math.floor(height));
  const ratio = 1.66;
  const landscape =
    (w >= 740 && h < 660 && w / h > 1.4) ||
    (w >= 540 && h < 500 && w / h > 1.25);
  if (landscape) {
    const header = 56,
      strip = 0,
      side = 172,
      gap = 12;
    // The console also occupies the header height, keeping all four targets usable.
    // Only unusually short viewports scroll; no touch target is scaled down.
    const reelHeight = Math.max(
      210,
      Math.min(h - header - strip, (w - side - gap) / ratio),
    );
    const reelWidth = Math.floor(reelHeight * ratio);
    return {
      mode: "landscape",
      width: reelWidth + side + gap,
      height: header + reelHeight + strip,
      reelWidth,
      reelHeight,
      header,
      dock: header + reelHeight,
      strip,
      side,
      artLeft: 0,
      artRight: 0,
      dockGap: gap,
    };
  }
  const portrait = w < 900;
  // Wider displays reserve real space for the title and character. They never
  // overlap the reel canvas or become additional columns on a phone.
  const framed = !portrait && w >= 1180 && h >= 660;
  const artLeft = framed ? Math.min(250, Math.floor(w * 0.17)) : 0;
  const artRight = framed ? Math.min(290, Math.floor(w * 0.2)) : 0;
  const header = portrait ? 104 : framed ? 64 : 112;
  const dock = portrait ? 144 : 120;
  const dockGap = 12;
  const strip = 0;
  const overhead = header + dock + strip + dockGap;
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
    artLeft,
    artRight,
    dockGap,
  };
}
