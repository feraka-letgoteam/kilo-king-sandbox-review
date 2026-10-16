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
};

export function fitGameLayout(width: number, height: number): GameLayout {
  const w = Math.max(280, Math.floor(width));
  const h = Math.max(200, Math.floor(height));
  const ratio = 1.66;
  const landscape = w >= 540 && h < 600 && w / h > 1.25;
  if (landscape) {
    const header = 42,
      strip = 44,
      side = 132,
      gap = 8;
    // The console also occupies the header height, keeping all four targets usable.
    // Only unusually short viewports scroll; no touch target is scaled down.
    const reelHeight = Math.max(
      170,
      Math.min(h - header - strip - 8, (w - side - gap) / ratio),
    );
    const reelWidth = Math.floor(reelHeight * ratio);
    return {
      mode: "landscape",
      width: reelWidth + side + gap,
      height: header + reelHeight + strip + 8,
      reelWidth,
      reelHeight,
      header,
      dock: header + reelHeight,
      strip,
      side,
    };
  }
  const portrait = w < 900;
  const header = portrait ? 80 : 68;
  const dock = portrait ? 96 : 104;
  const strip = portrait ? 52 : 56;
  const overhead = header + dock + strip + 8;
  const reelWidth = Math.floor(
    Math.min(portrait ? 680 : 1160, w, Math.max(280, (h - overhead) * ratio)),
  );
  const reelHeight = reelWidth / ratio;
  return {
    mode: portrait ? "portrait" : "wide",
    width: reelWidth,
    height: overhead + reelHeight,
    reelWidth,
    reelHeight,
    header,
    dock,
    strip,
    side: 0,
  };
}
