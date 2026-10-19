# Kilo King — animation asset pass 18

Prepared against source checkpoint `d8823fe09ce3625880c9765b048fc640f8cf1d95`. Saved as a review draft; no publication or GitHub update is included in this pass.

## What changed

The fisherman now uses separate head, torso, lower body, upper-arm, forearm and rod/reel attachments, with a second head drawing for blinking. Source-space joint pivots and eased keyframes produce anticipation, release and follow-through. The existing pose/tick interface and cabinet/phone placement are retained.

The marina has a reconstructed boat-free plate, independently rocking boats and separately deformed reflection pools. Sky/shore remain a locked plate; the existing foreground stays fixed. All layers use one shared cover transform.

The collector's existing drawings have equal-sized frame registration and shorter eyelid timing. Cash packages receive a material-specific foil highlight without moving their printed value. Recorded standing scatters receive a short emerald highlight; passing symbols do not. These are decorative reactions, with no added awaited spin delay.

## What is preserved

Game math, wallet, settlement, director, recorded outcomes, hook behavior, purchases, control layout and symbol fit metadata are unchanged. Existing normal/turbo/Skip/reduced-motion control paths remain in use. The total collector and package acknowledgement durations remain 800ms and 420ms before the existing turbo factor.

## Deliverables

- `public/kilo-motion-v18/`: selected source art, optimized alpha attachments, collector atlas, manifest, prompts, authoring module, interactive review page and proof renders.
- `scripts/prepare-motion-v18.mjs`: reproducible technical atlas unpacking.
- `scripts/render-motion-v18.mjs`: authored PNG/MP4 renders.
- `scripts/verify-motion-v18.mjs`: asset, registration, timeline, viewport and footprint checks.
- `useMotionCanvas.ts`: capped decorative clocks with hidden/offscreen pause, responsive redraw, reduced-motion static rendering and image-failure fallback.

## Validation and limitations

TypeScript, control/pricing tests, the production build and the dedicated asset/motion checks pass. The detailed motion report is in `public/kilo-motion-v18/validation.json`. It includes fixed-foot pixel comparisons, collector timeline parity, reduced-motion marina checks at five viewport sizes and symbol highlight containment above the value-label zone.

The PNGs and MP4 are authored animation renders, not browser recordings. The supported browser skill is unavailable in this session. Browser interaction, live event synchronization, hardware performance and final visual parity remain pending. This is an assembled and reviewable first asset set; it is not a native Spine editor project or a finished studio animation package.

The collection-readability changes described in the older handoff remain separate and are not implemented here.
