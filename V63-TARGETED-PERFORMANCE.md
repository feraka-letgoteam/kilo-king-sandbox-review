# Kilo King v63 — targeted physical performance

Checkpoint: local v62, `794e8867e79b88b747c1fd1bd3d2c04063807981`. No deployment or remote push in this pass.

## Changes

**Stage fisherman.** The previous component only subscribed to earned-win reactions. A cast mood deliberately did nothing, and neither a VS encounter nor a Max entrance reached the component. The renderer now sends presentation-only spin, VS and Max events to the mounted actor. Skip/state restoration settles an unfinished reaction. Significant wins keep the existing earned-win threshold. Short reactions interrupt each other without restarting the breathing clock. Entry no longer freezes this actor; menu/hidden/off-screen and reduced-motion safeguards remain.

The existing continuous drawing now has a 3.8-second chest/shoulder breath, phase-offset head and rod motion, and separate bounded spin, brace, tracking and earned-win reactions. All points at or below the lower-body anchor remain exactly fixed. Facing, artwork, camera and actor dimensions are unchanged. No new rig or redraw.

**VS.** Both bodies now load, drive into the shared contact line and recoil within the existing windows. The VS badge clears before contact so it cannot obscure the action. The winner expands from its own challenge half and settles into the unchanged sticky reel. The previous top-down wipe is removed. A redundant hold after the completed lock is removed; the recorded winning connection follows immediately. Existing pull/contact/lock/amount/transfer cues remain tied to beat crossings. Losing/equal, multiple-conversion, no-line-win, capped and long-amount records keep their actual outcomes. A VS lock does not manufacture a win.

**Max boat.** The existing hull, three registered rider drawings, motors and wake remain separate. Hull pitch increases from roughly 1° to a bounded 2.7° thrust/1.8° brake response. The rider independently counter-leans around the waist. Braking starts during the last part of each recorded advance and continues smoothly into settle; the endpoint and starting pose match. Wake length, height, orientation and intensity respond to thrust, then reach zero at rest. Its broad end is registered to the stern, tapering left; it is no longer largely hidden behind the hull/off the board. Early and late losses accelerate out with the same independent responses. Full stop remains on the board through the existing result and single transfer.

## Frozen scope

No changes to generator, probabilities, payouts, sticky-wild state, feature rules, wallet, settlement, prices, purchase confirmation, control bar, reel/symbol dimensions, collection sequence or hook behavior. All public artwork is byte-unchanged. Max segment positions, move times, hold times and recorded stop count are unchanged. The entire reel stage matches v62 after removing the two new presentation-event dispatch lines. The entire game page matches v62 after removing the new character-only pause prop.

## Proofs

These are normal-speed **offline renders of production code**, not live browser/WebGL recordings. VS and Max use the actual production effect controller and display lists, real recorded events and reel geometry, and a minimal WIN harness. The character proof uses the actual production Canvas mesh, face registration and scene camera with a neutral reel-area guide; it is not a full React UI screenshot.

| Sequence | 1440×900 | 390×844 |
|---|---|---|
| Character idle + four reactions | `art/kilo-v63/proofs/character-1440x900.mp4` | `art/kilo-v63/proofs/character-390x844.mp4` |
| VS action → lock → amount → WIN | `art/kilo-v63/proofs/vs-1440x900.mp4` | `art/kilo-v63/proofs/vs-390x844.mp4` |
| Max full stop | `art/kilo-v63/proofs/max-full-stop-1440x900.mp4` | `art/kilo-v63/proofs/max-full-stop-390x844.mp4` |
| Max early loss | `art/kilo-v63/proofs/max-early-loss-1440x900.mp4` | `art/kilo-v63/proofs/max-early-loss-390x844.mp4` |
| Max late loss | `art/kilo-v63/proofs/max-late-loss-1440x900.mp4` | `art/kilo-v63/proofs/max-late-loss-390x844.mp4` |

Character: 0–4s idle, spin at 4s, VS at 6s, Max at 8s, earned win at 10s; each settles back into the uninterrupted idle phase. VS uses the unedited recorded v61 encounter: 25,000 line award, WIN 2,000 → 27,000, one transfer. Exact cue timestamps for all feature proofs are in their adjacent `*-timeline.json` files.

## Verification

- `npm run typecheck:kilo` and `npm run build` pass. Existing >500 kB main-bundle advisory remains.
- `npm run test:kilo:features` now invokes the v63 scoped regression suite.
- 3,001 body/lifecycle samples plus 3,640 reaction mesh samples: planted feet, no inverted triangles, retained facial registration; mounted React/Canvas effect harness verifies actual spin/VS/Max event delivery, reduced motion, suspension/resume and cleanup.
- 1,728 VS cases; 360 phase-specific resizes, 180 interruptions, 14,894 recorded line expressions. Credits follow flyer cleanup, no duplicate transfers, no mutation of recorded events, unchanged stable sticky state.
- 216 boat phase cases; 108 resizes and 108 interruptions. Additional 240 Max speed/reduced-motion/resize/Skip cases and 10,000 unchanged outcome/RNG comparisons. Loss never reveals an extra gate or MAX banner. Full stop has exactly zero residual motion/wake.
- Separate numerical checks confirm continuous advance→brake and rest→escape boundaries and frozen Max distances/timing.
- Reports and source fingerprints are in `art/kilo-v63/`. The Git-based source guards require the original checkpoint history; they are intended to run from the review checkout.

## Remaining limitations

The fisherman is still a deformed continuous illustration, not an articulated facial/hand rig. The VS artwork remains existing action frames and winner strips with transform choreography, not new authored in-between drawings. The rider still has three authored poses; his hands are not independently constrained to the wheel. Wake is existing 2D art, not simulated water. These clips and harnesses establish the presentation paths and timing offline; live browser/GPU performance and visual parity still need a browser check. This pass does not claim studio-level character animation or completed live verification.
