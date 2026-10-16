# Kilo King presentation rebuild

Baseline: `bdb2e5b544a33b7c6a20e7a730e0d3813d7905d4` and the repository's `layout-v7` screenshots. Artwork comes from the checksum-verified `sandbox-20261016` release. This review changes the standalone presentation; it does not change engine outcomes, purchases, settlement, collection timing, hook behavior, or reel motion.

## Findings and changes

| Finding in the baseline                                                                                 | Change                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A large reel cabinet and a small detached desktop control column competed for attention.                | Controls and readouts now form a console below the reel frame on desktop. Short landscape retains a narrow side console.                                                     |
| Hiding bet and ante during a feature shortened the centered composition and moved the reels.            | One viewport calculation reserves fixed header, console, and readout dimensions. Feature state is not an input. A feature status replaces the idle controls.                 |
| Thousands of layered CSS declarations made breakpoint behavior difficult to reason about.               | Replaced the presentation stylesheet with one base system and explicit portrait, desktop, and landscape variants.                                                            |
| Phone controls and duplicated panels dominated the small reel window.                                   | Compact bet/buy grouping, a larger primary Spin target, one utility row, and a shorter totals plate. Touch controls stay at least 44px.                                      |
| Purchase amounts were crowded inside the gold Spin medallion.                                           | The medallion says BUY; the charge remains fully visible immediately below it. Its accessible name retains the full action and amount. Confirmation logic is unchanged.      |
| Profit summaries used a shallow banner with too little interior space for the result, cost, and button. | All feature summaries use the crown panel's larger safe area. Continue sits outside the decorative panel with its own 48px target. Neutral returns retain neutral treatment. |
| A short landscape screen selected the portrait loader artwork.                                          | Portrait loading artwork is now selected only for portrait orientation.                                                                                                      |
| Hidden carousel/drawer buttons could enter the dialog's focus list.                                     | Dialog focus cycling includes only enabled, visible controls.                                                                                                                |
| The Source link referred to a previous release.                                                         | It now opens the branch containing this revision.                                                                                                                            |

## Validation

- Kilo TypeScript check.
- Existing presentation suite: 72 fixture/skip cases over 18 saved rounds, with unchanged recorded results.
- Viewport geometry checks across 12 representative screens and 14,685 width/height combinations, including breakpoint transitions. They check horizontal containment, minimum reel dimensions, aspect ratio, and space for desktop controls.
- Standalone Vite production build.
- Game logic files, director, collection renderer, motion files, fixtures, and bank are unchanged.

Fresh browser screenshots and interaction checks are still pending: the supported browser QA capability is unavailable in this environment. Geometry tests do not prove visual fit, animation quality, or browser behavior.

## Review in the private build

1. Enter, then play at 390×844 and 1440×900.
2. Open Buy Feature; test the 10,000 base bet with Free Spins at 1,000,000 and disabled Chopper at 2,500,000.
3. Use Review → Two collectors — 48,000. Check the landing above BONUS WIN, and resize during collection and transfer.
4. Check entry, retrigger, completion, and the 5,000,000 capped return. Confirm the reel rectangle stays fixed between idle and feature.
5. Test 844×390 landscape and its More controls drawer. The shortest screens may scroll vertically instead of reducing touch targets.
6. Check keyboard focus, Skip, turbo, reduced motion, and refresh after a completed round.

## Remaining work

- Visual verification of this new build before treating the layout as final.
- The supplied release omits `public/kilo-audio/*`; sound remains unavailable. No substitute audio has been fabricated.
- Bonus entry, retrigger, and win ceremonies still use the existing presentation assets and timings. Their dedicated art/motion pass should follow confirmation of the new viewport and typography.
- The original GitHub repository omits most runtime art. For local review, use the release's `public/` assets with this branch, then `npm ci` and `npm run dev:review`.
