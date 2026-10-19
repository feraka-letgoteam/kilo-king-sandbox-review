# Composition v29

Source geometry and production CSS cascade against real React SSR markup; no browser screenshots.

Checkpoint: 414a271097eceee6148a022d96c6f50c904569f0. 91 protected source files unchanged; engine, wallet, reel sizing, collection, hook behavior, charge math and action markup retained.

## Geometry

| Viewport | Occupied width before | Occupied width after | Spin-to-secondary gap |
|---|---:|---:|---:|
| 360x800 | 332px | 332px | 16px |
| 390x844 | 356px | 332px | 16px |
| 1440x900 | 888px | 864px | 6px |

Desktop: Menu-to-Balance 16→8px; well/module gaps 12→8px; Auto-to-Spin and Spin-to-Buy 8→6px. Control and well dimensions are unchanged. Landscape at 844×390 retains every position and size.

Portrait: 160px allocation, 96px centered Spin, 104×88px Bet, 44px minimum targets, 12px secondary grid gaps. Cabinet-to-controls clearance is 6px (previously 10px). No overlaps in base or feature layouts at all four requested viewports. Landscape/compact outputs match the checkpoint in 66 cases.

## Material

Production CSS confirms #020c12 circular faces, darker #01070b wells, warm-white #fff8e8 numbers, 14px labels, solid 8px Spin and 2px secondary borders, full disabled opacity, no gradients or blur. Icons remain white with at least 3px strokes. Cost and disabled reason retain their unchanged placement in the Spin group.

## Cause

Desktop's mixed 12–16px module gaps and portrait's 360px group cap spread the controls apart. Inline layout coordinates, not a CSS cascade override, caused that spacing. The shared well/face color and gold WIN override reduced numeric consistency; the well is now darker and WIN uses the same warm-white ink. Existing hard rims were already resolving correctly and were preserved.

## Remaining limitation

- No browser rasterization or interaction verification.
- Safe-area insets modeled as zero.
- Portrait spare viewport space is not reduced: moving a fixed-height control dock upward by 4px increases the background beneath it by 4px. The requested tighter attachment is achieved, but eliminating that background requires relaxing composition or sizing constraints.
