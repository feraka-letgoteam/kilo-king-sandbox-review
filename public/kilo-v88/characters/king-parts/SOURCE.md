# King animation parts (v88)

Source: Feraka's parts pack `Kilo-King-Current-King-Animation-Parts/`
(README dated 20 October 2026; pivots.json `sourceCheckpoint` 54ac58e0c9aabe7259eb037b3f77826fa5fe9933),
copied from /workspace/kilo/king-parts/ on the build box.

All files are at source-body pixel scale (1024x1536 body), drawn at 0.5 on the 512x768 logical canvas.
`pivots.json` is the pack's file, unchanged.

| file | from | change |
|---|---|---|
| right-upper-arm.webp | parts/right-upper-arm.png | lossless WebP, same pixels |
| right-forearm.webp | parts/right-forearm.png | lossless WebP |
| right-hand-rod-grip.webp | parts/right-hand-rod-grip.png | lossless WebP |
| fishing-rod.webp | parts/fishing-rod.png | lossless WebP |
| hips.webp | parts/hips.png | lossless WebP |
| right-leg.webp | parts/right-leg.png | lossless WebP |
| left-leg.webp | parts/left-leg.png | lossless WebP |
| left-hand-dynamite.webp | parts/left-hand-dynamite.png | lossless WebP |
| left-hand-backswing.webp | parts/left-hand-backswing.png | lossless WebP |
| head-shocked.webp | parts/heads/shocked/complete.png | lossless WebP (complete sprite, not base) |
| head-shouting.webp | parts/heads/shouting/complete.png | lossless WebP |
| head-laughing.webp | parts/heads/laughing/complete.png | lossless WebP |
| stage-upper.webp | /kilo-v82/characters/stage-headless.webp | derived: everything below the vest hem removed (legs come from the parts above). Mask = rows above y=800 plus the vest hem traced per column, +10 px for its outline, 1.2 px feather. |

Not used: the base/eyes/mouth face layers and assembled.png (complete.png carries the same drawing).

## Fit follow-up (w Bo's FIT_REPORT.md, /workspace/kilo/king-parts-review/)

Re-inked from the pack PNGs to match the current King's line weight: a dark (16,11,14) outer outline
added outside the silhouette (4x supersampled dilation), canvases padded so pivots shift by the pad:

| file | added outline (source px) | pad |
|---|---|---|
| right-upper-arm.webp | 2.5 (+ cap above the pivot stretched 25 px taller, to cover the armhole on the swing) | 5 (+25 y) |
| right-forearm.webp | 2.0 (2.5 -> ~4.5) | 4 |
| right-hand-rod-grip.webp | 2.25 (2.0 -> ~4.25) | 5 |
| hips.webp, right-leg.webp, left-leg.webp | 2.0 (4 -> ~6) | 4 |
| left-hand-dynamite.webp, left-hand-backswing.webp | 1.7 (2 -> ~3.7) | 4 |
| head-shocked/shouting.webp | 1.5 (3 -> ~4.5) | none (kept 256x256 registration) |
| head-laughing.webp | 1.0 (3.5 -> ~4.5) | none |

fishing-rod.webp is unchanged (its pivot is moved in code to (338,518)).
dynamite-stick.webp: new procedural single stick (27 px body, 3.7 px outline, fuse and spark), drawn for the
thrown prop so the hand's single stick does not become the 3-stick bundle at release.
