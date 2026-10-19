# Kilo King — modular controls v23

Checkpoint: published v22, `fdf4887d510b0028e97c561b051a674edaf6a540`.

This is a local source pass. Nothing was deployed or pushed. The published sandbox remains v22.

## Implementation

The continuous dock skin is no longer mounted. Separate utility circles, Balance and Win wells, Bet/Ante well, and action circles expose the background between modules. Spin has a heavier single brass rim and an attached charge. WIN retains its existing zero reset at the start of a round.

`src/components/slot-controls/` contains the independent component, geometry, spacing/rim/type tokens, color/icon interface, jurisdiction policy, CSS and licensed fonts. No Kilo art, engine, wallet or purchase-price imports occur in that folder. `control-theme.ts` and the host callback adapter provide the Kilo skin and behavior. The alternate-palette/icon check uses the same component and geometry.

Desktop follows the canonical left-to-right order. Portrait puts the readouts and bet left of the dominant Spin; Menu and Buy are below Spin, and Turbo/finite Auto are in Menu. Landscape keeps readouts/bet left and Auto/Spin/Turbo right. The existing viewport function calculates reel space, including the full reserved control areas; it is byte-identical to the checkpoint.

Feature mode replaces Bet/Ante with a compact spins/multiplier well, hides Auto/Buy, and retains the same reel rectangle. The existing quiet feature header, collector sequence, hook animation and live BONUS WIN landing selectors remain intact.

Optional trusted-host flags cover Turbo, Autoplay, Buy Feature and Ante. The default is to hide restricted controls; disable mode preserves their edge and reason. The same flags gate Settings/menu entry points, force normal effective speed when Turbo is restricted, and block restricted action entry before any charge. Existing in-flight outcomes and settlement remain authoritative.

## Validation from this source

| Check                           | Result                                                                                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript                      | Passed                                                                                                                                                                                         |
| Production build                | Passed                                                                                                                                                                                         |
| Control bounds and targets      | 50 layouts; 489 targets ≥44px; 1,331 pair comparisons without overlap                                                                                                                          |
| Numeric fit                     | 400 Balance/Win cases plus charge fit through 2,500,000 using shipped font metrics                                                                                                             |
| Requested viewport/state markup | 48 actual React server renders across 360×800, 390×844, 844×390 and 1440×900                                                                                                                   |
| States covered in markup        | Idle, Ante Off/On, new-spin zero, feature counter at entry/collection/retrigger/completion, 5,000,000 win, long balance, all speeds, finite auto running                                       |
| Purchase boundaries             | Free Spins and Chopper valid charges; exactly 1,000,000 accepted; Chopper 2,500,000 genuinely disabled with full limit reason                                                                  |
| Jurisdiction policy             | Eight hide/disable cases, settings restriction, alternate theme/icon checks                                                                                                                    |
| Recorded presentation           | 216 fixture/Skip/speed cases across 18 recorded rounds; collector threshold/retrigger holds passed                                                                                             |
| Protected source                | Engine, bank, fixtures, reel layout, director, Pixi stage, ReelStage, collection/hook/motion assets, purchase model, finite-auto scheduler and keyboard guard are byte-identical to checkpoint |
| Settlement and purchase confirm | Existing credit/run/continue path preserved apart from effective-speed selection; purchase confirm block unchanged                                                                             |

## Evidence and remaining limits

- `public/kilo-modular-v23/` contains six authored base compositions and three base/feature control studies. These are **design frames, not browser screenshots**.
- `control-state-review.html` is a self-contained static sheet using the real React component and production CSS, with viewport/state filters. Its game controls are inert.
- Browser automation is unavailable. The Sites skill requires skipping browser QA in this environment; no alternate browser or preview server was used. Consequently the requested browser screenshots, armed-purchase click flows, entry after fade, live collection/retrigger/completion, modal scrolling, focus/touch and active-feature/final-transfer resize remain **unverified**. Source geometry and markup checks are not substitutes for those live checks.
- At the four requested sizes, tested long amounts retain at least 14px type and touch controls retain 44px targets. Outside that matrix, very narrow/short layouts can reduce a ten-digit balance to 10–13px to avoid truncation. That remains a readability limitation.
- This pass does not add the previously missing audio pack.

## Run locally

Use Node 24+, install dependencies, then run `npm run dev:review`. `?review` exposes the existing recorded fixtures. Run `npm run typecheck:kilo`, `node scripts/verify-modular-controls.mjs`, `node scripts/verify-controls.mjs`, and `npm run test:kilo` for the non-browser checks. The frame renderer additionally needs Python/fontTools/Brotli and Sharp. No new runtime dependency was added.
