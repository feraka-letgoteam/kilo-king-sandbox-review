# Typography, portrait anchoring and glass finish — v30

Source-derived geometry, production CSS cascade on actual React SSR markup, and shipped font advances/ink bounds. No browser screenshots or live execution.

Presentation-only changes, prepared for the private preview. Checkpoint: d1d5664890eacb1228ea8c40188f0584a0396188.

| Viewport | Balance / Win size | Bet size | Weight | Label size |
|---|---:|---:|---:|---:|
| 360x800 | 26px | 22px | 900 | 14px |
| 390x844 | 26px | 22px | 900 | 14px |
| 1440x900 | 32px | 30px | 900 | 14px |
| 844x390 | 26px | 26px | 900 | 14px |

## Layout

Portrait: 160px allocation, 96px centered Spin, 112×88px compact Bet, 8px Bet-to-Spin and 16px Spin-to-secondary gaps, 12px secondary grid gaps. All action targets are at least 44×44px. Cabinet-to-controls clearance is 4px, reduced from 6px. Source-derived rectangles have no overlaps at all four requested sizes, in base or feature mode. 72 desktop, landscape and compact layout outputs match the checkpoint exactly.

## Type

Numbers use the shipped Source Sans 3 Black font at weight 900; all 10 digits have equal advances. Sizes stay fixed regardless of amount length. The maximum 10,000 Bet fits at all four target sizes. Numeric line boxes accommodate the comma descenders, using explicit font metrics and 23px readout lines on phones/landscape. Long Balance/Win values use a native read-only text field retaining the exact full value and fixed type size. No abbreviations or ellipses are inserted, but horizontal navigation is required when the amount exceeds its well. The existing Spin cost and disabled-reason subtree is byte-for-byte unchanged.

## Glass and material

Resolved production CSS retains opaque #020c12 circular faces, #01070b wells, hard 8px Spin and 2px secondary rims, warm-white numeric ink and full disabled opacity. The latest requested glass polish is a separate, contained reflection layer: a neutral sheen with approximately 7% maximum alpha and crisp inset edge reflections of approximately 15% alpha. Its gradient does not replace the opaque base. It is behind text and icons, cannot receive input, has no blur, and stays inside the existing bounds. Theme options glassHighlight and glassEdge allow the neutral reflection to be retinted or removed. No geometry or hit area is added by the finish.

## Supplied reference changes

Balance and Win now share one opaque card. Balance aligns left and Win right on desktop and portrait; short landscape stacks both in the existing left rail. Visible LGC labels are removed. The two underlying number rectangles and collection destination remain in their previous positions. The shared card's bounds contain both readouts and do not overlap any action target.

Bet uses a left-aligned label and amount with plain chevrons on the right, without separate arrow compartments or divider shadows. Ante remains a compact attached pill. Padding adapts to the available text width, while the font size stays fixed; the maximum bet fits. The new reference styling changes no target rectangles or callbacks.

## Preservation and cause

90 protected source files, including engine, wallet, settlement, reel renderer and collection code, are unchanged. All existing action callbacks and disabled guards are unchanged.

The former amount-width fitter reduced type size for long strings, so hierarchy varied with the amount. It now uses fixed sizes and an actual heavier font. Portrait Bet needed 8px more width for the unshrunk maximum bet; it remains separated from Spin. The previous line box was also too short for larger figures containing commas. The bonus-win host selector's spacing was aligned with the other readouts. No overriding material rule was found in the production cascade.

## Remaining limitations

- Native navigation within oversized read-only amount fields is not browser-tested. These preserve exact text and fixed size; the entire number is not simultaneously visible when wider than the fixed well.
- The 160px portrait dock retains 4px below its targets. Pulling it 2px upward increases the background below the game by 2px. Reducing that remaining viewport area is incompatible with the retained reel sizes and top anchoring.
- Device safe-area insets are modeled as zero. The glass finish and final font rasterization have not been assessed in a live browser.
