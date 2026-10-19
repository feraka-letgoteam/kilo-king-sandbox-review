# Kilo King v31 — reference correction verification

Checkpoint: `e3340a9529303295e56e123eef31babf4a51f866`.

This pass removes Ante from the control bar, makes Bet a compact price plate,
reduces the oversized numeric typography and joins an icon-only Spin to Auto.
It is prepared for the existing owner-only private preview.

## Visible changes

- Balance and Win remain on one card, with no visible LGC abbreviation.
- Bet has a left-aligned label/amount and two plain right-side chevrons.
  The visible plate is 64px high. Ante exists only on the Features page.
- Figures use Source Sans 3 Bold (700): 22px desktop; 20px portrait/landscape.
  Labels remain 14px. The preceding 900-weight 30–32px desktop figures were
  disproportionately large relative to the supplied reference.
- Spin is a large white curved arrow. Auto's dark rectangular plate joins it.
  There is no visible price or insufficient-balance text on the Spin face.
  Existing Skip/Stop icons remain while playing or running Auto.
- When Ante is active, Bet shows the host's actual per-spin wager. Base bet
  editing, multiplier, price calculations and restrictions are unchanged.
- Portrait Auto centers beside Spin. Buy/Menu form the next column; speed is
  accessible in Menu and shown on its badge. This avoids an extra control row.
- Solid dark bases, brass edges and the requested restrained clearcoat remain.

## Layout results

| Viewport | Bet plate | Spin | Bet-to-Spin target gap | Dock allocation |
|---|---|---|---|---|
| 1440×900 | 148×64px | 100×100px | Auto remains between them | 100px |
| 390×844 | 112×64px | 96×96px | 8px | 160px |
| 360×800 | 112×64px | 96×96px | 8px | 160px |
| 844×390 | 128×64px, left rail | 96×96px, right rail | Separate side rails | Existing host allocation |

All checked interactive targets are at least 44×44px, inside the dock and
non-overlapping. Portrait Spin-to-Auto target gap is 16px; Auto-to-Buy/Menu is
12px. The shared action plate intentionally extends behind both Auto and Spin;
it has no pointer events and touches no other module. Portrait base targets
leave 4px at the bottom of the 160px dock; feature mode leaves 8px.

The Bet plate became shorter without reducing the two 44px stepper targets.
Their invisible hit areas extend 12px above/below the plate, in otherwise clear
space. Their chevron ink remains inside the visible plate. Desktop and landscape
Spin, Auto, Buy, utility and readout rectangles are preserved. The feature counter
and win landing anchors are preserved. Reel layout and cabinet clearance are
unchanged.

## Verification performed

TypeScript check and production build pass. The verifier checks 40 combinations
across the four viewports, including Ante off/on, maximum Ante wager (15,000),
insufficient balance, busy/Skip, active Auto/Stop, feature controls, long amounts
and hidden/disabled jurisdiction controls. Five Features-page SSR states cover
Ante on/off, restricted Ante and the Ante-only page when feature purchases are
restricted.

The CSS audit resolves the actual built stylesheet against React SSR markup and
host ancestors. It checks rest/pressed/disabled material, opaque faces, hard rims,
white icons, the restrained clearcoat, 14px labels and smaller 700-weight figures.
The real bundled font's advances and comma bounds confirm 1,000 / 10,000 / 15,000
fit the Bet plate without shrinking or clipping. Spin retains an SVG in every
state; cost/reason are visually hidden accessible descriptions, not face text.

90 protected source files match the checkpoint, including engine, wallet,
settlement, reel renderer and collection code. AST checks also preserve host
runtime/effects, action callbacks and feature purchase handlers. No gameplay,
charge formula, limit, purchase confirmation or settlement behavior was changed.
The full evidence is in `reference-report.json`.

## Remaining limitations

No browser screenshots or live interaction tests were attempted. These are
source-derived layout/CSS checks, not a pixel comparison with the reference.
Actual font rasterization, glass appearance, modal scrolling and active feature
resize still need device review. Long Balance/Win values retain their full value
and font size but require horizontal text navigation when wider than the card.
Safe-area calculations assume zero device insets. The existing open background
below the top-anchored game remains because stage/reel geometry is preserved.

On touch devices, a disabled Spin keeps its arrow and does not display the reason
on its face, as requested. Its reason remains available to assistive technology
and as a native pointer tooltip. Ante state and its 1.5× cost remain explicit on
the Features page; the main Bet readout shows the current wager.
