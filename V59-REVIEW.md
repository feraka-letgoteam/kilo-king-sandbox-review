# Kilo King v59 — character life, VS performance and segmented Max spin

Local source checkpoint: v58 commit `245e7fb0a6882a907348b928374ee6cff7e8ff44`.
This pass is not deployed. Accepted controls, reel geometry, symbols, wallet,
purchases, charge calculation, collection and hooks are preserved.

## Audit of the supplied recordings

The current-game recording showed ordinary vertical reels continuing beneath a
small travelling boat, the base marina remaining active, and barely perceptible
character movement. Source inspection found two concrete causes: every reel
feature forced the environment into `base`, and every reel feature paused the
character. The old breathing lift was only 1.4 logical pixels before display
scaling.

The supplied Ganja Snail clip ends at 28.3 seconds. Its Max attempts are visible
around 13–26 seconds. The relevant pattern is a dedicated purple interior and
one giant vehicle symbol arriving in discrete row-sized advances, with stable
pauses. A partial loss remains on the board until the next attempt. This clip
shows three losses; it does not show a maximum-winning outcome. The full-stop
winning treatment here follows Kilo's stated binary rule, not an unobserved
reference frame.

The implementation adapts that sequence left to right using original Miami
artwork. It does not copy the reference's graphics, price, maximum or odds.

## What changed

### Character

- Continuous 390-triangle weighted deformation of the coherent inward-facing
  drawing. Chest expansion/lift, neck/head orientation and rod/hand movement
  have independent bounded timing; feet and lower body stay exactly planted.
- Registered blink and earned-win facial changes remain. Ordinary spins do not
  trigger another large cast/fist-pump.
- Feature mode no longer freezes the actor. Modal, hidden-tab, offscreen and
  reduced-motion suspension still apply; resize does not restart his clock.
- Mesh draw calls crop to local source regions rather than drawing the entire
  master for each triangle. A 12-frame native-Canvas check averaged about
  2.6 ms per paint in this environment. That is not a mobile browser benchmark.

This is a continuous image deformation rig, not a fully articulated Spine rig
or extensively redrawn frame-by-frame performance.

### Max spins

- Separately composed desktop and portrait night-boathouse backgrounds, plus
  one new large transparent speedboat with the King at the helm and kilo cargo.
- Artwork is preloaded. Presentation waits for its scene preparation; Max mode
  and read-only Max review select the dedicated environment.
- New source-registered water regions replace incompatible old motion masks.
- No ordinary vertical `spinTo` runs for Max. The recorded giant strip advances
  one reel-width at a time, left to right, with progressively longer holds.
  Only reached columns are covered; unreached symbols remain still and visible.
- The partial boat remains at its recorded position on a loss. A full boat
  stops inside the existing rectangle. The maximum amount tallies and transfers
  once; no award is paid during the intermediate advances.
- Normal move durations are 380 / 340 / 370 / 400 / 460 ms; holds are
  440 / 560 / 700 / 880 / 520 ms. Turbo and Super Turbo shorten them; reduced
  motion shows the recorded stable result directly. Skip restores that result.
- A single original RNG draw now also records `reveal.segments` (1–5). It does
  not consume another draw or alter the existing 3.82% binary win decision.
  Four equal conditional gates map the same draw into the staged reveal.
  Historical records without this metadata show one segment on loss, never an
  invented late near-miss. Prices, probabilities and paid amounts are unchanged.

The retained local candidate is 1,000× cost and 25,000× maximum. No claim of
Stake Engine math certification or production approval is made.

### VS reels

- Eight authored action drawings: anticipation, strike/pull, recoil and winner
  for King and Vice. Stable registration and bounded timing replace a static
  portrait being dragged around.
- A recorded loser uses recoil; the winner uses the victory drawing. One opaque
  wipe hands over to the full-height illustrated winner reel.
- Two original 1:3 banners integrate the character, marina setting, metal edge
  and recessed multiplier plaque. Runtime adds the exact recorded multiplier
  and WILD label inside the measured copy area. No second blank panel covers it.
- Settled banners stay still. Their multiplier and owner remain locked through
  all subsequent spins. The pure VS rules and payout calculation are unchanged.

The actors have four authored key poses each, not full articulated rigs. Their
transitions combine those drawings with short runtime movement.

### Ordinary spin finish

Motion blur is reduced to preserve symbol silhouettes. The large pulsing boxes
outside reel bounds are replaced by hard corner brackets inside the relevant
reel. Scatter landing edges are thinner and contained. Existing launch,
braking, stop cadence and landed-scatter anticipation logic remain intact.
No additional artificial scatter passers or result-dependent near misses were added.

## Verification

All of the following passed from this source:

- TypeScript and production build.
- 10,200 outcomes compared with the v58 checkpoint: exact same grids, awards,
  caps, event sequence and RNG consumption after excluding the new stop field.
- 1,603,781 logic invariants across 6,000 generated features; 108 director
  Skip/speed sequences.
- 1,296 production feature-controller sequences, 276 resizes and 276
  interruptions across 360×800, 390×844, 844×390 and 1440×900 geometry.
- 240 dedicated segmented-strip cases covering all five stops, all speeds,
  reduced motion, resize, Skip and capped payout; retained partial loss state.
- 12 actual Max director cases: one horizontal sequence, zero ordinary reel
  spins. Actual activation/paid-play functions tested with wallet spies: no
  activation/exit charge, one debit per explicit spin, duplicate confirm blocked.
- 3,001 character motion samples: positive mesh Jacobians, no folds, fixed feet;
  actual React/Canvas lifecycle for pause, visibility, reduced motion and resize.
- 96 feature-art cases; 119 React/UI checks and 12 responsive text budgets.
- 216 saved presentation/Skip/speed cases and 96 collection cases including
  capped outcomes, hook continuity and transfer resize.
- Protected source equality for controls, wallet/engine, collection, tools,
  payout functions and reel geometry.

Detailed machine-readable reports live under `art/kilo-v59/`, with existing
suite reports under their original version folders. The production build still
has the existing Vite advisory about a main chunk larger than 500 kB.

## Visual evidence and remaining limits

`art/kilo-v59/proofs/` contains normal-speed character, VS, full-Max, early-loss
and late-loss videos at 64px and 156px cell sizes. These use the production
character painter and actual feature display lists through an offline native
Canvas adapter. They are **not browser screenshots, WebGL captures or recordings
of the live private preview**. Desktop/portrait environment registration proofs
are under `art/kilo-v59/environment/`.

The new sequences were inspected as rendered frames. Boat ink fits within the
board and clears the result text; VS copy stays inside the plaque at phone size.
Browser automation is unavailable in this managed environment, so browser/GPU
rendering, real device frame rate, audio balance and the complete composited
page still require live review. This pass cannot establish pixel-perfect live
quality or AAA/studio-level performance.

## Sources

- Supplied current Kilo recording: `Screen Recording 2026-10-18 at 12.42.42 PM.mov`.
- Supplied Ganja Snail recording: `Screen Recording 2026-10-18 at 10.15.12 AM(3).mov`.
- [Hacksaw — Duel at Dawn](https://www.hacksawgaming.com/games/duel-at-dawn):
  opposing duel multipliers and full-reel wild presentation. Kilo's sticky
  persistence rule remains its existing rule.
- [Stake — Ganja Snail](https://stake.com/casino/games/donutgaming-ganja-snail).
- [Stake Engine front-end communication guidelines](https://stake-engine.com/docs/approval-guidelines/front-end-communication).
- [Stake Engine replay requirements](https://stake-engine.com/docs/approval-guidelines/game-replay-requirements).

Official guideline pages were checked, but their dynamic content was not fully
available through retrieval. This report is not a comprehensive compliance audit.
