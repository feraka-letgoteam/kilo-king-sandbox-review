# Kilo King v65 — pure Max boat stage

Checkpoint: local v64 `f0197e7`. Presentation only. No deployment.

## What changed

Max activation now excludes the symbol strips, reel wells, grid shading,
line artwork and locks from rendering. The board model remains intact for
exit and recorded-result recovery. A synchronous React layout-effect bridge
also covers activation while assets are loading. Repaint, Skip and resize
cannot turn those symbol parents visible. Leaving Max restores the existing
reel presentation without moving or resizing it.

A quiet, ungridded water surface occupies the existing stage aperture. This
is a performance surface, not a replacement background. The v64 Max marina,
its ambient clock, clouds, reflections, birds and foreground framing are
unchanged. The current right-side fisherman and his performance are unchanged.
The boat and all of its motion stay clipped to the original reel rectangle.

## Boat choreography

Five possible advances use the existing board-width/5 displacement. The
recorded segment count still decides where the boat succeeds or exits.

| Beat | Normal-speed timing | Behavior |
| --- | --- | --- |
| Anticipation | 280 / 300 / 340 / 400 / 560 ms | Stationary pause, hull loads downward, rider braces, propwash builds; short next-position reflection |
| Advance | 380 / 340 / 370 / 400 / 460 ms | Accelerates through one segment, then decelerates; independent hull pitch, rider lean and wake stretch |
| Settle | 170 / 170 / 180 / 190 / 340 ms | Braking recoil resolves into the exact resting pose; wake collapses |
| Rest | 100 / 100 / 120 / 140 / 220 ms | Stable position before the next wind-up |
| Loss departure | 320 ms anticipation + 760 ms exit | Loads again, accelerates fully off the right edge, trailing wake exits too |

Turbo and Super Turbo retain minimum readable durations: anticipation 140 ms,
travel 160 ms, settling 100 ms and resting 70 ms. Motion boundaries match
exactly; no pose jump is introduced between loading, thrust and braking.
Reduced motion resolves to the recorded stationary result. Skip cancels all
travelling effects and uses the existing director's recorded-result path.

The existing hull, outboards, rider drawings and wake are retained. They move
independently. A fixed waterline hides the submerged keel while the hull
pitches above it. The contact ripple stays in the water plane, rather than
rotating with the vessel. It dissipates after braking; no persistent spray or
new background animation was added.

## Result handling

A full stop retains one vessel while the recorded amount appears and
transfers once into WIN. The old award panel was painting a second boat;
that duplicate is removed. Only the existing presentation-credit callback
updates the meter, after the travelling amount is removed. The stationary
amount hides at handoff, and the flyer starts at that exact text position,
including on resize. Other features retain the original transfer origin.

A loss fully clears the boat and leaves `NO WIN` on the stage, including after
Skip and resize. It never shows a fifth successful stop or a maximum-win
banner. Capped amounts retain their original credited/before-cap distinction.
No payout is inferred from the choreography.

## Verification

- TypeScript check passes.
- The complete production review build (`npm run build:review`) passes,
  including the unchanged public runtime assets.
- 968 existing source/asset files match v64, including math, wallet,
  settlement, controls, purchases, all feature backgrounds and their animation,
  the fisherman and non-Max feature code. Shared files have narrow exact-edit
  guards; all other renderer and director code matches the checkpoint.
- 540 Max controller cases cover Normal/Turbo/Super, reduced motion, early
  loss, late loss, full stop, capped credit, four viewport geometries,
  180 resizes and 180 Skip interruptions.
- The actual React bridge is exercised for activation during asset loading,
  exit, re-entry, cleanup, and no renderer remount.
- 10,000 historical Max outcomes retain identical results and RNG consumption.
- Existing Max checks pass: 240 speed/Skip/resize cases and 216 physical
  boundary cases with 108 resizes and 108 interruptions.
- Anticipation → advance, advance → settle, settle → rest and anticipation →
  escape agree at their physical endpoints. Each advance travels exactly
  one fifth of the unchanged board width.
- Instrumented checks assert no symbol construction in the Max effects,
  one vessel at a time, no partial vessel after loss, no maximum banner on a
  losing record, no lingering transfer element and at most one award callback.

Run `npm run test:kilo:features` and `npm run typecheck:kilo`. Source guards
require the repository's existing checkpoint history.

## Offline proof clips

`art/kilo-v65/proofs/` contains early loss, late loss and full success at
1440×900 and 390×844, all at normal speed and 30 fps, with the existing sound
cues. Per-clip timeline JSON records every anticipation, advance, settle,
exit and transfer timestamp. The phone full-success clip has its final
anticipation at approximately 4.33–4.90 s, braking at 5.37–5.70 s, award at
5.93 s and transfer at 6.73–7.07 s.

These are offline native Canvas rasterizations of the production Pixi effect
controller with shipped assets, the unchanged v64 background painter and
current character painter. A minimal WIN landing/readout harness and border
guide show scale and transfer position. They are not live browser recordings
or full React control-bar captures.

## Remaining limitations

The vessel remains a layered sprite performance with three existing rider
poses and procedural transforms, not a newly articulated character rig,
frame-by-frame boat redraw or fluid simulation. The quiet stage water is a
flat performance material; the more detailed v64 marina stays around it.
Live browser/WebGL and device performance have not been verified here. The
existing large-bundle advisory remains. No deployment was made.
