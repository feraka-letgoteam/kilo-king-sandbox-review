# Kilo King v53 — custom feature presentation

This version includes the complete v52 on-reel feature overhaul plus the v53 art and sequence finish. The last published source checkpoint was `3bfbb66162758baec1ebc4106b777da6b9f9ac02`. The recovered v52 source ZIP is the baseline for the protected math and director hashes in `art/kilo-features-v53/protected-v52.json`.

## Feature-specific artwork and sequences

| Feature | Custom assets | Visual sequence |
| --- | --- | --- |
| Dockside Catch / three scatters | Retained fisherman, package family, reaction artwork, collection plates and hook assets | The accepted collector sequence and multiplier ladder remain intact, including the exact 48,000 case and capped award presentation. |
| Yacht Stash / four scatters | Registered six-pose fisherman action atlas, hard brass wild-reel frame, local reel multiplier | Short VS cue → fisherman pulls the reel's cash → multiplied amount → stable sticky wild. Other fishermen use the protected collection renderer. Entry uses this same fisherman artwork and a VS emblem. |
| Chopper Route / five scatters | Dedicated aircraft body with registered main/tail rotor pivots and cargo attachment, locked cash clasps, position multiplier marks | Flight → projected cash drop → boost → exit → connected amounts → clipped symbol breakup/drop → settled multiplier state. Aircraft display objects are retained through each flight rather than recreated every frame. Entry uses the aircraft. |
| The Getaway / God Mode | New cream/teal/brass loaded speedboat and crown hardcase, hard result seal | Exactly one recorded reel spin, then a short extraction or interception vignette on the board. Extraction exits the board before the local 25,000× amount transfers; loss stops at a contained barrier and clearly says no win. No loading stages or partial awards. |

All three advanced entry banners use their own art inside a small cut-corner plate. They last at most 1.1 seconds including motion. The underlying board stays in place. Completion uses the corresponding emblem and stays anchored inside the board on resize. The existing purchase-card art is preserved; Getaway's confirmation uses its new case. There is no illustrated scene behind the gray purchase gallery.

Two new runtime WebPs total 141,162 bytes. The original generated PNGs, exact prompts, normalized anchors, light/dark proof, and export metadata are retained in `art/kilo-features-v53`. The proof is an asset contact sheet, **not** a live game screenshot. New assets are preloaded with the stage assets before play.

## Verification

- 6,000 generated features and 1,336,483 feature-logic invariants passed.
- 108 director/Skip/speed sequences passed; Getaway still calls the reel spin exactly once.
- 1,152 production effect-controller sequences passed at the four requested viewport geometries, including 324 resize cases and 324 interruptions.
- 96 additional v53 custom-entry/result cases passed across normal/turbo/super speed, reduced motion and all four geometries. These check actual asset bindings, finite transforms, entry/result durations, resize, cleanup and exact presentation credit.
- 96 protected collection cases passed: exact 48,000 and capped outcomes, speed, reduced motion, both resize directions and Skip.
- Historical saved-round regressions and 15 line-start display cases passed.
- 79 React/source checks and 12 responsive font-budget cases passed. Purchase confirmation, disabled reasons, Ante and the hidden five-scatter mode are preserved.
- The v53 pass leaves the v52 feature math, bank, engine, layout and feature director byte-identical. Existing protected-source checks also preserve charge, settlement, reel geometry, collector and hook implementations and control modules.

The executable regression commands are `npm run test:kilo:features`, `npm run test:kilo:art`, `npm run test:kilo`, and `node scripts/verify-line-win.mjs`. Type checking and the Sites build are required again when packaging the publication.

## Remaining acceptance limits

There is no supported browser controller in this environment. No live screenshots, GPU frame-time measurements, mobile-device acceptance or normal-speed gameplay clip were produced. Instrumented effect tests and font budgets do not prove the live visual result is stunning or pixel-perfect. The preview still needs actual-device visual review, especially amount collisions, modal wrapping, focus behavior, flight/drop depth and frame pacing.

The fisherman atlas has six authored poses, with small face/costume variation; it is not a continuous skeletal rig. The aircraft and speedboat have painted bodies with runtime movement. These are custom finite animations, not a claim that every surface is independently rigged. The boat's small fittings are secondary at phone size.

This is an owner-private sandbox update. It is not production/Stake approval: the overall RTP/outcome-book/RGS work described in `V52-IMPLEMENTATION.md` remains unresolved. No math tuning or control-bar redesign was added in v53.

## Review in the preview

Open **Review scenes · v53** to run Yacht sticky VS cash, the natural five-scatter Chopper round, multiple cascades, Getaway's max and loss, or the capped long-amount completion. Replays do not change the local bank. The existing reset-local-bank control remains available.
