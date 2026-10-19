# Kilo King — modular controls v24

Checkpoint: published v23, `4b21e2535fd1c10036b2ab487ddca8dd9b1daafc`.

This is a local source pass. Nothing was deployed or pushed. The private hosted sandbox remains v23.

## What changed

The shared control system now has a portrait composition that gives Spin the center of the reel frame. Balance and Win occupy two clear recessed wells above the main controls. BET, its amount, two chevron steppers and Ante Off/On fit inside one compact panel to the left. Auto and Buy are smaller circles beside Spin; Menu completes that close group. Auto opens the existing finite confirmation. Speed remains available through Menu and its lightning badge shows Normal / Turbo / Super turbo as 1 / 2 / 3.

At 360×800, the bet panel is 112×88px, down from 232×96px; Spin remains 96px and is centered. At 390×844, the bet panel is 124×88px, down from 262×96px. The readouts are now 164px / 176px wide, respectively. The whole arrangement fits the existing 160px control allocation, with 12px after its last control. The surrounding stage composition is retained; no whole-game scaling is used.

Feature mode replaces Bet/Ante with the remaining-spins/multiplier well. Auto and Buy disappear, and Menu moves to the compact anchor beside Spin. Balance, Win and Spin retain their coordinates. The existing quiet bonus header and reel rectangle are untouched.

Spin now carries its own short disabled explanation, including “Insufficient balance”, while keeping the charge visible. The detached paragraph below the dock is removed. The disabled button keeps its brass rim, and both charge and reason are associated with it for assistive technology. Loading and an unavailable bet use the same presentation path.

Desktop retains the canonical separate modules in a single row. Short landscape retains bet and readouts on the left and Auto / Spin / Turbo on the right. Their geometry is unchanged from v23.

## Standardized component

`src/components/slot-controls/` contains the React component, authoritative breakpoint geometry, shared spacing/rim/type tokens, fonts, CSS, theme and icon interfaces, and jurisdiction policy. It has no engine, wallet, artwork or Kilo-specific decoration dependencies. `src/components/kilo/control-theme.ts` and the existing action adapter supply the game's palette, Buy icon and behavior.

The v23 recessed dark material, brass bevels, heavier Spin rim, filled teal selections and tabular numeric face remain consistent across the modules. Hosts can reuse this system by providing their current state and existing actions, then swapping colors and icons. Optional jurisdiction flags retain their hide/disable behavior, including the guards in Settings and action entry points.

## Validation

| Check                                   | Result                                                                                                                                                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript and production build         | Passed                                                                                                                                                                                                          |
| Target sizes and geometry               | 50 layouts, 516 targets ≥44×44px, 1,520 non-overlap comparisons                                                                                                                                                 |
| Numeric fit                             | 400 Balance/Win cases using shipped font metrics; charges checked through 2,500,000                                                                                                                             |
| Disabled copy                           | Full current explanations fit their Spin face without crossing the charge at all checked sizes                                                                                                                  |
| Actual React server markup              | 60 state/viewport combinations at 360×800, 390×844, 844×390 and 1440×900                                                                                                                                        |
| States represented in the control sheet | Idle, Ante Off/On, new-spin zero, feature entry counter, collection counter, retrigger counter, long completion value, long balance, all speeds, finite auto, loading, unavailable bet and insufficient balance |
| Purchase boundaries                     | Free Spins and Chopper valid quotes; Free Spins exactly 1,000,000 allowed; Chopper at 2,500,000 disabled with the full purchase-limit reason                                                                    |
| Jurisdiction and theme interfaces       | Eight hide/disable cases, Settings restrictions and alternate palette/icon checks passed                                                                                                                        |
| Recorded presentation                   | 216 fixture/Skip/speed cases across 18 recorded rounds; totals, cap, collector timing, remaining spins and retrigger holds passed                                                                               |
| Protected code                          | 14 protected files byte-identical to v23, including engine, bank, fixtures, reel layout, director, Pixi stage, hook/motion sources, purchase model, finite auto, keyboard and purchase/settings panels          |
| Host behavior                           | Credit, presentation, play, replay and collection-preview functions unchanged; purchase confirmation unchanged                                                                                                  |

These checks exercise source, models and server-rendered markup. They do not establish browser layout or pointer/touch behavior.

## Evidence and remaining verification

`public/kilo-modular-v24/` contains six authored compositions, three control studies showing base / feature / insufficient balance, source-coordinate manifests, a validation report, and `control-state-review.html`. The state sheet uses the actual React component and production CSS with embedded fonts; its gameplay controls are inert.

The PNGs are **authored design frames, not browser screenshots**. Browser automation is unavailable in this workspace. The Sites skill requires skipping browser QA in this environment; no preview server or alternate browser was used.

| Requested live check                              | Remaining status                                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Base idle, Ante Off and Ante On at all four sizes | Source geometry and control markup passed; live screenshots pending                                |
| Armed Free Spins and Chopper                      | Confirmation source unchanged and purchase quotes checked; click flow/screenshots pending          |
| Valid purchase and genuinely over-limit purchase  | Quote/disabled markup passed; live purchase interaction pending                                    |
| Entry after fade, collection, retrigger           | Recorded timing checks passed; live visual capture pending                                         |
| Completion with a long amount                     | Control markup checked at 5,000,000; actual completion overlay capture pending                     |
| Resize during active feature and final transfer   | Reel/renderer source unchanged; live DOM destination, animation continuity and screenshots pending |

No new defect was detected in the checked geometry or markup. Browser-only defects remain possible until the above checks are completed. Outside the four requested sizes, very narrow compact popouts still reduce a ten-digit balance to 10–13px to retain the full value. This pass does not change the existing audio availability or produce an audio pack.

## Run and review

Use Node 24+ and install the locked dependencies. `npm run dev:review` serves the local game; `?review` exposes its existing recorded fixtures. Start a preview only in an environment that supports the browser workflow.

Checks: `npm run typecheck:kilo`, `node scripts/verify-modular-controls.mjs`, `node scripts/verify-controls.mjs`, `node scripts/verify-material-panels.mjs`, and `npm run test:kilo`. `node scripts/render-modular-controls-proofs.mjs` regenerates the design frames and additionally needs Python/fontTools/Brotli and Sharp. No runtime dependency was added.
