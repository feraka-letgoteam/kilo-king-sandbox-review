# Kilo King v41 — scene system verification

Source checks, mocked decode lifecycle, production author CSS cascade and calculated layout. No browser screenshots or live-browser interaction claims.

- 16 synthetic phase/tier cases and 18 recorded fixtures pass. Extra-spin modifiers do not change the scatter environment. Mystery, God Mode and The Getaway remain visual previews; capped outcomes do not activate The Getaway.
- The decode cache retains at most eight image promises. Reuse, eviction, failed-load retry and optional ornament failure checks pass. The current decoded scene remains until replacement decoding completes.
- Ambient motion is capped at 24 frames/second and 680,000 canvas pixels, stops while hidden/offscreen/paused, and becomes static with reduced motion. No ambient CSS keyframes run independently of that lifecycle.
- The Gilded Yacht teak foreground is static and excluded from water refraction. Base boats have a fixed shore mooring and a hull-tracked rope endpoint; wake and reflection move with the hull. Free-floating lanterns are omitted pending authored mounting points.
- 13 engine, bank, presentation, reel, control and layout sources match checkpoint 16e9f4050bcbd6c162733129480f8287477a9c93 byte-for-byte.
- 16 calculated cases cover 360×800, 390×844, 844×390 and 1440×900, base/feature, with and without the review toolbar. Spin remains separate from every other target; targets remain at least 44×44; the portrait dock remains 160px.
- Portrait foreground remains 4px below the full control allocation and does not extend below the viewport. Reel size, shell height and Spin position remain identical between base and feature.
- 25 runtime environment assets verified; total 5.64 MiB across the complete catalogue. Only the active environment and likely next scenes are requested, not all states at first entry.

## Remaining visual verification

No browser screenshots or interaction automation were attempted. Artwork fit and source-level safety were reviewed separately; live transition timing, image decode speed on slow devices, fine layer alignment and actual device GPU/rendering behavior still require visual playback review. This report does not claim Stake Engine certification.

Production CSS: dist/assets/review-CXelWSLm.css
SHA-256: 6d726da0c9f51b9a9116f372c364eff474a47edbbc33df0279e3249f5d65f75c

Run: node --experimental-strip-types scripts/verify-scene-system-v41.mjs
