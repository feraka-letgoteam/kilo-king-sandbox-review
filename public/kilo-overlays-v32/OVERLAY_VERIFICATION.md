# Kilo King v32 — Auto and quick settings

Checkpoint: `20d53593bbca961cbda8fe183790f1aab8338a3f`.

## Changes

Auto now takes over the viewport with a dark, blurred game backdrop, a centered
near-black card, large count tiles, a charge summary, automatic Stop on bonus
status and one Start button. The close X stays at the viewport edge. The existing
10 / 25 / 50 choices remain finite. Choosing a count still places no bet; Start
uses exactly the prior guarded callback and each spin is charged separately.

The command-bar Menu opens a small, undimmed Info / Music / Sound popup. Selecting
Music or Sound opens that channel's volume slider. Wider screens use a side
flyout; phones expand the slider inside the popup. Zero silences that channel.
The other channel's setting is preserved. The Menu icon becomes X while open.
Clicking outside closes the popup, Escape closes the slider and then the popup,
and keyboard focus returns to the trigger. The popup repositions after viewport,
scroll and control-anchor changes, including feature reflow.

Info opens the existing rules/paytable. Info → Game settings keeps Normal, Turbo,
Super turbo and reduced-motion preferences available, along with existing compact
Auto/Features fallback links. Ante remains exclusively on the Features page.

## Verification

`npm run typecheck:kilo`, the production build and
`node scripts/verify-overlays-v32.mjs` pass.

- 128 popup placement cases cover 1440×900, 390×844, 360×800 and 844×390,
  using corner/central anchors and collapsed/expanded sliders. Popup and side
  flyout rectangles remain inside the viewport. Additional checks cover an
  offset visual viewport and a tiny-height scroll fallback.
- 36 server-rendered states cover Auto counts and disabled starts, plus all
  three popup expansion states at the requested sizes. Resolved production CSS
  confirms full-viewport Auto, an opaque card, 12px background blur, portrait
  inline volume expansion and two-column short-landscape card content.
- Popup rows are 52px, volume input hit areas 44px, count tiles 60–68px, Start
  48–56px and close 52px. Both the takeover and the height-limited popup allow
  scrolling. Safe-center alignment keeps oversized takeover content reachable.
- UI callback checks verify independent music/effects updates, outside dismissal,
  Info navigation and prevention of audio expansion when assets are unavailable.
- The Auto start guard and its disabled eligibility expression match the prior
  build's AST. Existing spin, Auto, purchase and bet action callbacks are intact.
- 95 protected source files match the checkpoint, including the engine, wallet,
  settlement, Auto scheduler, sound engine, reels, collection/hook sequencing,
  stage geometry and control layout/CSS. Pre-render runtime comparison allows
  only the new menu reference and preferences-open state, plus adding that state
  to the existing shortcut block and Auto-pause predicates.

## Cascade correction

The legacy mobile dialog rules previously made Auto a bottom sheet. This takeover
has its own explicitly scoped full-viewport styles. A production CSS check also
caught the prefixed blur declaration displacing the standard declaration during
minification. Prefix ordering was corrected; the generated stylesheet now retains
the intended 12px blur instead of inheriting the old 3px modal blur.

## Limits

No browser screenshots or live interaction tests were attempted. These checks
verify source-derived bounds, markup, callbacks and compiled CSS, not final
rasterization or device gestures. Auto content has vertical overflow available
for unusual font sizing, device safe areas or very short windows. The popup uses
live trigger bounds in the application; actual resize/focus/slider gestures still
need device review. No game/artwork geometry or gameplay changed.

The report data is in `overlay-report.json`.
