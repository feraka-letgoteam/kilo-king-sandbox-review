# Kilo King v66 — Max boat performance

Local presentation pass on v65 (`f278e09`). No deployment.

## Changes

- Every recorded advance has a stationary hold, then increasing propwash and a bow-down preload before translation. The final anticipation is 640 ms, versus 380–440 ms for earlier advances.
- Thrust lifts the bow approximately 10 degrees and independently leans the rider back approximately 17 degrees. Braking reverses those poses, then both settle to the exact resting pose. The motor trim and water-plane wake move independently of the hull.
- The existing foam artwork is above the keel immersion layer. Previously that layer obscured the wake. Foam builds during preload, expands under thrust, and collapses during braking. There is no residual wake loop at rest.
- Losses accelerate out using a quadratic travel curve with sustained thrust, rider lean and a trailing wake. The entire vessel clears before NO WIN. The recorded number of successful stops does not increase during the exit.
- The fisherman receives an entry reaction and a separate full-stop reaction from the Max controller. Both use the existing continuous deformation mesh; vertices at and below the planted leg boundary remain fixed.
- The amount is presented after the final settle, then transfers to WIN once. The retained vessel is not duplicated by the award panel.

## Boat framing

The vessel is now 62% of the aperture width rather than 98%. All five recorded berths use a shorter on-screen path inside the same aperture. This deliberately replaces v65's literal one-reel-width translation, which left the rider and wake clipped outside the stage during early beats. The five recorded outcomes, their order and stopping rules are unchanged. No reel, control, background or character placement geometry changed.

## Verification

`npm run test:kilo:features` checks:

- 972 protected source/runtime asset files against v65, including all math, wallet, background art and ambient animation, controls, stage geometry and purchase flow.
- All effect-controller code outside the Max sequence is byte-identical, including VS, Chopper, collection and the transfer/award implementation.
- 10,000 unchanged Max outcomes and RNG consumption against the established math checkpoint.
- 540 Max presentation cases, including 180 resizes and 180 Skip interruptions, across four sizes, three speeds and reduced motion.
- An additional 240 segmented-result cases and 216 phase-specific physical cases.
- 5,418 non-Max character frames identical to v65; Max mesh samples have no inverted triangles and fixed feet. The mounted actor accepts both Max events.
- One vessel, no symbols, no MAX text on losses, no callbacks after cancellation, and at most one award after transfer cleanup.

TypeScript and the Vite production bundle are checked separately. The build verification reuses the protected public assets in place rather than duplicating them into its temporary output.

## Proof method

The proof clips use the actual TypeScript Max effect controller, actual recorded outcomes, shipped boat/character assets, production deformation and background painters, and source-derived viewport geometry. They are offline Canvas rasterizations of instrumented Pixi display lists, with a minimal WIN readout at the production landing position. They are not browser/WebGL recordings or complete control-bar screenshots.

No phase captions identify anticipation, thrust or braking in the picture. The accompanying JSON records their timestamps. The frame sequences retain chronological samples so hull, rider and wake changes can be compared directly. Fisherman reactions are driven by the emitted production events, rather than inserted solely for the proof.

The delivered set contains three complete 30 fps desktop clips and 23 native phone stills. The phone sequence samples every 100 ms through the final anticipation, thrust and braking, then shows the settled result and WIN. Its incomplete video encode was discarded. See `art/kilo-v66/proofs/PROOF-INDEX.md` for exact timestamps.

## Remaining limitations

- Hull, motor, rider poses and wake are sprite-based parts with transforms. There is no articulated 3D boat or fluid simulation. Rider art still uses three existing drawings.
- The fisherman remains a continuous deformation mesh, not a new articulated rig.
- Live browser/GPU behavior is not established by these offline proofs. A live-browser check is still needed before calling this production-final.
- Reduced motion intentionally bypasses the physical performance; Skip cancels it and preserves the established result/settlement handling.
