# Kilo King v36 — control proportions and Features

Checkpoint: 13bae8f24c2f0c5a3b9d262e1693ffefa459a8fc

## What changed

- Wide desktop controls use 84% of the available stage width (maximum 1,536px), with a 128px Spin, 64px secondary controls, 88px wells and 28px figures. A short desktop retains the 100px dock if the taller version would exceed available height. Reels and symbols are unchanged.
- Features is a full-screen takeover with a centered bet selector, large close control, isolated Kilo artwork and a two-column/four-card layout. Ante and scatter information occupy the upper row; the two existing purchases occupy the lower row. The fourth card is informational, not a new purchasable mode.
- Cards use a flat dark fill, teal actions and gold purchase actions. No outer frame, category tabs or detached footer. Phone cards retain two columns, readable prices, full disabled reasons, 44px buttons and vertical scrolling when needed.
- Buying a card still opens a separate confirmation. No charge occurs on selection. Ante is only on Features. Spin remains arrow-only, joined to Auto.

## Checks

- Typecheck and production build passed.
- 22 purchase guard cases passed; exact-limit Free Spins at 1,000,000 remains valid, Chopper at 2,500,000 is unavailable. Duplicate confirmation does not submit twice. Locked/restricted purchases do not submit.
- 27 real React views checked, including all stakes, insufficient balance, Ante states, restrictions, previews and confirmation.
- Control targets checked at 1440×900, 390×844, 360×800, 844×390, 1920×1080 and 1180×660, both with and without the review toolbar. No target intersections or readout intersections. Portrait/landscape geometry matches v35 exactly; portrait allocation remains 160px.
- Built CSS resolves to full-screen Features and two-column grids; close and bet controls are separated. Disabled Spin retains its 3px rim, solid face and opacity 1.
- 12 protected sources hash-identical to v35, including engine, wallet, director, Pixi stage, reel geometry, quote model, autoplay and Info. Host runtime differs only in presentation integration.

## Reference and remaining gap

Compared the four supplied screenshots (8.04.26, 8.04.37, 8.05.16 and 8.05.42 PM). No video file was available to measure. Reference structure and proportions are adapted to the existing Kilo mechanics and artwork; this is not a claim of pixel identity. The reference has four paid offerings; Kilo has two bonus purchases plus Ante, so its fourth card opens scatter information.

No browser automation, live screenshots, live touch/resize testing or visual pixel comparison was performed. Typography wrapping and final perceived weight still need review in the private preview. Short landscape scrolls the two-row Features grid deliberately.

## Asset provenance

Image-generation background extraction from public/kilo-features-v12/chopper.webp. Prompt: isolate the existing black-and-brass helicopter and suspended wrapped cargo, retain style/materials/teal edge light, remove marina/sky/water/reflection, transparent alpha, complete silhouette, no text/frame/floor. Output: public/kilo-features-v36/chopper-cutout.png (1280×1280 RGBA). Existing Kilo crown and case art retained.

Built CSS: dist/assets/review-Blrp849J.css
SHA-256: 2acfdd4d5da1cbef52f8b4d5b68c242957c88a43ac9e0851bb00899ef0b566f9
Detailed rectangles and results: check.json
