import { copyFileSync, cpSync, rmSync } from "node:fs";
// Preserve the standalone review build; package a root entry for Sites.
rmSync("dist", { recursive: true, force: true });
cpSync("dist-review", "dist", { recursive: true });
copyFileSync("dist/review.html", "dist/index.html");
// Archived control-layout proofs are source references, not runtime assets.
// Keep them in the repository but outside the host's 256 MiB static bundle.
// The standalone v18 motion proof has no incoming reference from the built
// application or other shipped pages. Keep its originals in public/source,
// while leaving room in the static bundle for the new feature artwork.
// v79 replaces every exported v49 authored clip. The production JS, CSS and
// shipped HTML contain no incoming v49 URL; original drawings stay in source.
// v85 replaces the four v84 actor atlases. The v77 boat / wide-VS paintings
// also have no incoming reference in source, public pages or built assets;
// v79 owns those runtime illustrations. Retain both older packs in source.
for (const directory of ["kilo-bar-v21", "kilo-modular-v23", "kilo-modular-v24", "kilo-modular-v25", "kilo-motion-v18", "kilo-animation-v49", "kilo-v77", "kilo-v84"]) {
  rmSync(`dist/${directory}`, { recursive: true, force: true });
}
