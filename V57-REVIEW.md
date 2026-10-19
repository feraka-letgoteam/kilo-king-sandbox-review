# Kilo King v57 — character life and animation polish

Checkpoint: `b59b650` (local v56). This release includes the previous v54–v56 source and artwork along with this pass. The user explicitly requested publication to the existing owner-private preview.

## Changed

- The marina King now breathes between spins. The torso, shoulders, head and wrists use separate, bounded curves. His feet and ground registration remain fixed; the whole actor is never scaled or floated.
- King and Vice on sticky VS reels retain quiet idle motion after the duel settles. Different reel phases and character rhythms avoid synchronized movement. Idle timing is independent of spin speed.
- Two custom, registered eyelid drawings add a brief half/closed/half blink. Original hat, beard, mouth, silhouette, alpha and pivot are unchanged. No eyelid overlay is applied to the alternate victory face or in reduced motion.
- Reaction changes blend from the currently displayed pose over 180 ms. Their idle clock survives React updates and viewport changes. Routine casts remain the small glance; the existing earned-win threshold is unchanged.
- Alternate expression art now inherits the head joint. Previously, the alternate face retained its neutral neck angle while the normal head rotated.
- Stable keys keep the active scene component mounted while an outgoing background fades. A single 30 fps loop serves the visible VS actor group. The canvas actor uses a retained 30 fps clock; neither loop causes React renders.
- Hidden, off-screen and menu-covered actors pause. Reduced motion selects the neutral pose and open eyes. Unmount and feature clear remove the animation loop and observers.

The previous scene actor stopped requesting frames when its finite reaction ended, making it look frozen. Its effect also restarted local time on each pose/tick update. Those two causes are removed. Decorative scene wrappers are permanently `inert` for accessibility, so the new loop specifically watches the interactive game shell's modal lock rather than mistaking decorative `inert` for a pause request.

## New art and source

- Runtime face atlas: `public/kilo-v57/characters/king-blink.webp` — 288×160, 50,470 bytes.
- Registration: `public/kilo-v57/characters/king-blink.json` — two 137×151 heads; pivot `[68,140]` retained.
- Built-in image generation supplied the eyelid drawings. Prompts, generated originals, eye-only registration, packing script and decoded-pixel verification: `art/kilo-v57/characters/`.
- Production timing: `src/components/kilo/character-life.ts`.
- Lifecycle: `src/components/kilo/character-motion-loop.ts`.
- Integration: `RiggedSceneActor.tsx`, `character-rig.ts`, `character-rig-model.ts`, `reel-feature-effects.ts` and the presentation preference refresh in `pixiStage.ts`.
- Offline normal-speed performance proof: `art/kilo-v57/proofs/character-life.mp4` (12 seconds, 30 fps). This is a rendered art proof using production parts and curves, not a live gameplay or browser recording.

## Verification

- Typecheck and production build pass. Built face atlas/manifest bytes match source.
- 6,002 sampled idle poses verify planted feet, bounded head motion, identical alternate-head joint registration, independent rhythms and finite numeric transforms.
- The actual React component's effect harness verifies image readiness, ongoing drawing beneath a decorative inert wrapper, reaction changes, viewport prop changes, pause, reduced motion and cleanup.
- Instrumented production Pixi rigs verify persistent VS animation, phase retention on resize, face texture swaps, reduced-motion neutral pose, finite texture ownership and feature cleanup.
- Scheduling checks cover hidden tabs, off-screen actors, modal locks, resume without wall-time catch-up and removal of observers/RAF callbacks.
- Source-derived registration at 360×800, 390×844, 844×390 and 1440×900. Phone actor canvases begin below the complete control allocation; portrait control height remains 160 px. Reel/control geometry and logo placement are unchanged.
- Existing regression suites pass: 6,000 generated features; 1,296 effect sequences, including 276 resizes and 276 interruptions; 96 exact/capped collection cases across speeds, reduced motion, Skip and resize; 216 recorded presentation cases; art/asset checks and audio resource checks.
- Protected engine, wallet, settlement, feature math, directors, control layout, charge math, collection choreography and hook behavior remain unchanged. The collection case with 2,000 + 10,000, two collectors and ×2 still credits 48,000 total.

## Limits

Live browser automation was unavailable; no browser screenshots, live GPU playback, touch interaction or browser performance certification is claimed. The visual proof uses SVG/Sharp rendering of the production rig and timing.

This is an articulated upper-body performance with fixed legs and two authored eyelid states, not a full facial mesh, hand rig or walk cycle. Existing backgrounds, collector expression atlas, symbol art and the authored boat/chopper frame counts remain as in v56. The build retains its existing advisory about a JavaScript chunk larger than 500 kB.
