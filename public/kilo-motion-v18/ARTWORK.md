# Kilo King — animation assets 18

This is the first assembled animation asset pass, built from the existing Kilo King identity. It is a working raster attachment rig with authored motion, not a Spine project and not a claim of final studio-level animation.

## Art direction and provenance

Keep the navy knit cap, bearded face, orange fishing vest, black hoodie, crown pendant and worn boots. Preserve cyan light from the viewer's right, magenta edge light from the left, warm gold and dark teal materials. The source references are the v3 fisherman, v14 marina, current KING scatter and current cash package.

New raster art was made with the built-in image-generation tool. The complete prompts are retained in [prompts.json](prompts.json). Selected source PNGs are retained at full output resolution. Technical preparation only unpacks atlas regions, trims transparent margins and makes smaller lossless WebP runtime attachments while retaining alpha.

The first head delivery included a second necklace. The selected corrected heads omit that necklace; the pendant belongs to the torso. A separate torso cleanup paints cloth behind the shoulder openings. Parts were fitted together and checked at rest, anticipation, release and settle.

## Deliverables

- Nine fisherman drawings: planted lower body, torso, open head, closed head, two upper arms, two forearms/hands, and rod/reel. The two heads are alternate drawings of one head attachment: eight attachment roles in the rig.
- Boat-free marina clean plate; two isolated yachts; two separate painted reflection pools. The existing pier foreground stays separate in the game.
- Two authored surface-light textures: a foil catch and an emerald/gold facet catch.
- Eight existing collector drawings registered into equal 444×444 frames. These drawings are retained from v7, not newly generated.
- Named joints, source-space pivots, clip durations, renderer source, extraction records and validation results.
- An interactive review page and a six-second normal-speed authored render.

The clean plate intentionally keeps sky and shore together. Water is a separately sampled region below the pier envelope. The boats and their reflections have independent geometry and timing. This is not yet a fully separated cloud/palm/environment rig.

## Motion design

The fisherman has a 4.2-second idle cycle with a short blink, a 1.1-second cast with anticipation/release/settle, a one-second acknowledgement and an 800ms settle. Shoulder, elbow, wrist and head use separate pivots; lower-body pixels stay fixed. The rod has delayed follow-through. Existing game mood events trigger the clips.

Boat motion is restrained: ±0.85 degrees and ±1.4 source pixels vertically, on independent 5.8/7.1-second cycles. Reflections use delayed ripple deformation and a separate opacity envelope, not rigid hull rotation.

Collector: 800ms, with shorter eyelid frames and a restrained smile. Package: a 420ms foil catch with stationary body and printed value. Scatter: a 420ms jewel catch only after recorded symbols stand on the final board. Turbo keeps the existing 45% reaction duration. No payout data is generated here.

## Review and integration

Open `/kilo-motion-v18/` in a running review build for pose controls, slow motion, attachment separation, reduced motion and 72px symbol previews. `motion.mjs` is the shared runtime/authoring source. `rig-manifest.json` describes registration and hierarchy; it is a vendor-neutral handoff, not a Spine import format.

Do not treat the MP4 or PNGs as browser captures. They are rendered through the same motion module using a native Canvas2D implementation. Browser rasterization, device performance, decoding behavior and event timing still need browser QA.

Before a future Spine conversion: retain these attachments and pivots; author a real editor project, skin/slot setup, mesh weights and deformation there; verify licensing and the intended runtime version at that point. No Spine dependency or license has been added in this pass.
