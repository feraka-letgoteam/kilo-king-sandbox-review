# Kilo King — control bar refinement, v21

17 October 2026. Starts from the published v20 source `bf206d678f0ef40a426e82505d6180a7cb4462fd`.

## Implemented

- Brighter Source Sans 3 labels, separate recessed readout wells and shared brass/enamel edges across the plate and circular controls. Live numbers retain the tabular face.
- Spin grows from 88 to 100px on desktop, 76 to 80px on portrait phones and 88 to 96px in landscape. Compact popouts retain 64px because their available space is constrained. Hover highlights the rim; pressing depresses the face. Reduced-motion preferences remain supported.
- Cost sits inside Spin, under its arrow, and is associated with the button for screen readers. It is display-only: clicking the cost uses Spin's existing hit area. Numeric fitting covers amounts through 2,500,000, including invalid purchase amounts shown in review modes.
- Desktop Bet has its own 44px Ante toggle beneath the amount, with an explicit Off/On pill. Portrait and landscape retain their separate Ante target. Compact popouts keep the state by Bet and the action in Menu.
- Feature prices have an inset well with a Purchase price label. Disabled reasons occupy a separate, wrapping row associated with the disabled action. The panel and cards share the bar's material palette. Confirmation and purchase arithmetic are unchanged.
- Pixi notifies the presentation director when a recorded payline becomes visible. The director publishes cumulative line amounts then, and the base WIN well uses that live presentation total. Line count-ups take at most 260ms in normal speed, with shorter turbo durations; reduced motion snaps. Wallet credit still occurs only through the existing settlement path.

## Verification

- `npm run typecheck:kilo`
- `node scripts/verify-bar-v21.mjs`: 412 layouts; 3,633 targets; 14,382 target-pair comparisons; 4,120 amount/font cases; charge fits at five amounts per layout; finite autoplay and keyboard guards.
- `node scripts/verify-line-win.mjs`: 15 cases across normal, turbo and super turbo. Verifies 0 → 200 → 400 at line start, capped display totals, feature line awards, duplicate notifications, skip and nonvisual scene fallback. Stored results are immutable.
- `npm run test:kilo`: 216 fixture/skip/speed cases across 18 saved rounds, plus collection, hook, retrigger and preview checks.
- `node scripts/verify-controls.mjs`: purchase limits, balance boundaries, settings and panel content.
- Byte comparisons protect the engine, bank, fixtures, layout, control model, scene animation files, the settlement path, and all collection/retrigger/replay code. Pixi changes only its highlight signature and line-start callback; decorative v20 frame additions remain unchanged.

The six PNG compositions and bar closeup in `public/kilo-bar-v21/` are authored static design frames, **not browser screenshots**. They reuse production geometry and artwork; their text baselines and compositing approximate the browser. They show base idle, not all live states.

## Remaining verification

Browser automation is unavailable in this managed workspace. Live CSS layout, touch/focus behavior, purchase-panel scrolling, frame timing and active-feature resize still need review in the published sandbox. The authored frames and source checks do not establish that those browser checks have passed. No new art, audio, gameplay, RGS integration or approval claim is part of this pass; the previously missing audio pack remains unresolved.
