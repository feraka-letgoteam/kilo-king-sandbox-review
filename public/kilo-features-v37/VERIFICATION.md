# Kilo King v37 — measured type and Features polish

Checkpoint: 59601c744bbfa7cafe43925eecc6d99a00c1f2d1

## Screenshot measurements

Approximate visible bounds measured from the supplied screenshots, normalized to each image width. Different capture sizes make raw pixel comparison misleading.

| Element | Kilo screenshot (2048px wide) | Reference (1672px wide) | Decision |
|---|---:|---:|---|
| Full command group | 1702px / 83.1% | 1294px / 77.4% | Reduce desktop coverage from 84% to 78% of available stage width |
| Spin diameter | 164px / 8.0% | 134px / 8.0% | Keep 128px CSS Spin and its 3px rim |
| Balance/Win card | 865px / 42.2% | 534px / 31.9% | Take width out of the shared numeric card, preserving controls and spacing |

Features grid: approximately 847/2048px (41.4%) in Kilo versus 646/1674px (38.6%) in the earlier reference. Its maximum CSS width is reduced from 660px to 620px. The desktop card height is retained; the issue was width and text density, not uniformly oversized controls.

## Changes

- Wide desktop amount size 28 → 24px; labels stay 14px. Full command coverage 84% → 78%, maximum width 1536 → 1424px. At 1440×900 the group now spans about 76% of the viewport after outer insets. Spin, well heights, touch sizes and separation gaps remain unchanged.
- Features headings 28 → 22px, prices 32 → 28px, action labels 17 → 15px and top bet amount 24 → 22px. Phone headings are 18px and prices 23px; actions remain at least 44px high.
- The crown trio is restrained to a bounded art area. Chopper is fitted by its visible silhouette rather than its larger transparent margin. All existing artwork is retained.
- Quieter teal/brass fills, a subtle upper light catch on cards, and a lighter blurred marina backdrop separate the cards without a heavy enclosing frame.
- Ante uses a short action label plus a distinct Ante Off / Ante On state. Unavailable offers retain their full reason and visible price.

## Verification

- Typecheck and production build passed. The built stylesheet was used for the cascade checks, not a hand-authored mockup.
- 22 purchase guard cases passed and 27 React views checked. Selection still opens confirmation, not a charge. Repeated confirmation submits once. Exact-limit Free Spins remains allowed; over-limit Chopper remains unavailable.
- Targets and separation checked at 1440×900, 390×844, 360×800, 844×390, 1920×1080 and 1180×660, with and without the review toolbar. No intersections; at least 44×44 targets. Phone/landscape control geometry is identical to v36, including the 160px portrait allocation.
- 16 protected source hashes match v36, including the entire play host, engine, bank, director, Pixi renderer, reel geometry, autoplay, quote model and Info.
- Price/title/action sizes, two-column Features layout, scrollable overflow, close-button separation and full-opacity disabled Spin verified from production CSS.

## Limits

No browser automation or live screenshots were performed. Source and rectangle checks do not establish final live typography wrapping, touch behavior or perceived visual polish. Long disabled reasons may increase card height; the takeover scrolls vertically rather than clipping them. The fourth card remains scatter information because the game still has only two bonus purchases plus Ante.

CSS: dist/assets/review-XG3IDqe8.css
SHA-256: db2e9dad6e2615a6b42d7e88375b3a2341f0c756040710e76ec22f1e1803b8aa
Detailed dimensions: check.json
