# Kilo King — shared marina UI, v22

Starts from v21, `4a90ec895eb53a5260bf1b481e641f988380c8ad`.

## Changes

- `material.ts` defines the palette, brass lighting, enamel, recessed well, teal selected finish and sparse surface grain. The HTML controls and vector dock use this same definition.
- Bar, settings, feature cards, purchase confirmation, bet selector and auto-spin dialog share the plated edge and recessed interior treatment. Primary prices receive more room; action restrictions use compact adjacent text.
- Spin has one heavy brass rim. The previous painted rings and extra CSS rings are no longer displayed. Its pressed state depresses the face and attached cost; hovering cannot override the pressed shading.
- The base readout always says WIN. Turbo badges and charge amounts use weighted tabular numerals with stronger contrast.
- Ante is nested inside the bet control, in the same well. On portrait phones the three secondary buttons sit below Spin; their targets remain separate. Desktop and phone reels retain their exact prior rectangles and symbol geometry. Compact popouts keep Ante in Menu.
- Settings selected options are filled teal. A session without loaded audio shows Muted and a reason, with the unavailable sliders omitted. This does not supply the missing audio pack.
- Disabled feature buttons retain the brass edge. The full reason stays visible alongside the disabled action and remains connected to it with `aria-describedby`. The footer shares the same plated material, and its numeric fields are recessed.

## Checks

- TypeScript check passed.
- Layout verification: 412 sizes, 3,633 targets, 14,382 overlap comparisons and 4,120 amount-fit cases. Ante lies within the bet well in every noncompact layout; active targets remain at least 44px. Charge labels fit through 2,500,000.
- Actual React server-render checks cover unavailable, enabled and muted audio; selected speed/motion states; valid purchases, insufficient balance, exact-limit purchases and over-limit purchases. Existing purchase, preference and panel checks passed after updating the old sound-copy assertion to the requested muted state.
- Engine, bank, outcome fixtures, director, Pixi stage, reel-layout function, animation files and purchase model are byte-identical to v21. Settlement code is unchanged. The v21 line-start WIN update remains intact.

## Visual evidence and limit

`public/kilo-material-v22/` contains six authored base compositions, a bar study, settings and feature-panel studies, and a narrow purchase-card study. They use the production palette, artwork, fonts and dock coordinates. They are **not browser screenshots**; CSS layout, wrapping, compositing and interactive states may differ. Their purpose is design review at the shown sizes.

Browser automation is still unavailable in this managed workspace. Live modal scrolling, keyboard/touch interaction, animation and active-feature resize require review in the published build. No browser-pass or Stake approval claim is made.
