# Kilo King v40 — portrait marina framing

Checkpoint: 16e9f4050bcbd6c162733129480f8287477a9c93. Local source only; no push or deployment.

## Added artwork

The new transparent foreground continues the existing wet timber dock into perspective, with a low rope-wrapped mooring post, cleat and rope coil. Open upper and side edges retain the existing marina water. The art is cropped proportionally from the bottom and extends to the viewport bottom, including the noninteractive safe-area region. It is not a tiled filler strip.

The runtime artwork is a lossless WebP conversion of the generated square PNG. The PNG, final generation prompt and provenance are in art/kilo-portrait-v40/.

## Placement

The artwork is the phone-portrait shell's absolutely positioned ::after element. It begins 4px below the complete 160px control allocation. overflow: clip and contain: paint keep all pixels inside that rectangle; pointer-events: none prevents interference with controls. No DOM node, tab stop, ResizeObserver or game state was added.

| Viewport | Review toolbar | Allocation bottom | Foreground top | Foreground height | Gap below lowest base control |
|---|---:|---:|---:|---:|---:|
| 360×800 | 0px | 494.4px | 498.4px | 301.6px | 8.0px |
| 360×800 | 44px | 538.4px | 542.4px | 257.6px | 8.0px |
| 390×844 | 0px | 512.5px | 516.5px | 327.5px | 8.0px |
| 390×844 | 44px | 556.5px | 560.5px | 283.5px | 8.0px |

Base controls clear the new frame by 8px; feature controls clear it by 10px at the two required sizes. The 160px allocation and 44px targets are unchanged. At short heights with no remaining area the decorative plane collapses to zero height and is clamped to the viewport edge; it adds no new scrollable height.

## Verification

- 112 calculated cases: 360×800, 390×844, 393×852, 412×915, 430×932, 360×960, 390×1200, short phones, the 620/621px boundary, 844×390 landscape and 1440×900 desktop. Includes base/feature, review toolbar on/off and zero/notched safe-area insets.
- Every tracked source file except the single stylesheet import matches the checkpoint byte for byte (105 protected source files). This includes the complete control component/CSS/tokens/layout, reel sizing, game host, engine, wallet, collection director, hooks and settlement.
- The sole new selector targets the decorative pseudo-element in phone portrait. Desktop, landscape, controls and real shell elements receive no new declarations.
- No framing/control intersection found. No extra vertical overflow from the artwork. The frame, reel and allocation rectangles are identical before/after entering a feature.
- No browser automation, screenshots or live interaction checks were attempted. Bounds come from the production CSS cascade and real layout functions; visual seam quality, font rasterization and device rendering remain unverified in a browser.

## Remaining limits

On unusually tall or very short screens the foreground is cropped to preserve its aspect ratio; side props can move outside the visible crop. At widths above 620px the existing background remains unchanged. On viewports already too short for the fixed game the existing overflow behavior is preserved and the new art is zero-height. No framing element was found to overlap a control or alter reel geometry in the checked cases.

CSS: dist/assets/review-ChD3KuNL.css
SHA-256: ff79c51528148c1e1e085e211d37cf4f5a9b474f698a198f41c5c520fe0d6116
Detailed resolved paint, frame coordinates and protected source hashes: layout-check.json

Run: node --experimental-strip-types scripts/verify-portrait-framing-v40.mjs
