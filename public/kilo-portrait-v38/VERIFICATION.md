# Kilo King v38 — portrait speed and type

Checkpoint: 21bd604d522ca28a3e4d3af3fd5f79a872ca36e2

## Root cause and fix

The portrait layout deliberately returned a zero-sized Turbo rectangle, which enabled the Menu speed-badge fallback. Feature mode also suppressed Turbo. This was layout routing, not two overlapping buttons.

Speed now has its own 44×44 target at the top of the right utility column, above Buy and Menu. It cycles the host's existing Normal / Turbo / Super turbo preferences. Its 1 / 2 / 3 state badge belongs to Speed, never Menu. It stays available during a feature and respects disabledTurbo.

The shared Balance/Win card stops before Speed. Portrait amounts are fixed at 18px/21px, labels at 12px. The same Source Sans 3 numeric face and exact values remain. Bet, Spin, joined Auto, Buy and Menu do not move. The 160px allocation, 96px Spin and all 44px touch targets remain.

## Verification

- Production build and TypeScript checks passed.
- 80 real React states: three speeds, base/feature, menu open, disabled Spin, Ante, active Auto and restricted Turbo.
- 32 production CSS cascade checks confirm numeric sizes, label sizes, solid faces, 3px Spin rim, 2px utility rims and full opacity.
- Twelve viewport/toolbar combinations at 360×800, 390×844, 320×740, 844×390, 1440×900 and 1920×1080. No target or readout intersections; no target smaller than 44×44. Portrait still uses 160px.
- At 360/390, the readout card and Speed are separated by 12px, Speed/Buy by 12px, Bet/Spin by 8px and Spin/Auto targets by 16px. Long Balance 1,234,567,890 fits its 114px text area at 18px; maximum base bet 10,000 fits without reduced type.
- Desktop and landscape rectangles exactly match v37. Portrait Bet, Spin, Auto and Menu rectangles match v37. Base/feature reels use the unchanged host geometry.
- 17 source hashes match v37, including engine, wallet/bank, settlement host, renderer, collection director, reel layout, purchase guards, autoplay and the v37 Features polish.

## Limits

These are source, production CSS and rectangle checks, not live browser/device proof. Tiny compact popout mode retains its existing Menu fallback; this pass corrects portrait and preserves the accepted desktop/short-landscape system. Final font rasterization and tap behavior need live preview review.

Detailed dimensions and source hashes: check.json
CSS: dist/assets/review-FXkD-XZP.css
SHA-256: cddab5c0198c2424128de53c43bcd3d66bd44ee80c073b215f07ef6002ab55be
