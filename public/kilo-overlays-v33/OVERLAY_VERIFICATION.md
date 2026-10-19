# Kilo King v33 — simpler Auto and compact quick settings

Checkpoint: `cb17fa655817838ff197c512427aa0ceab8d4601` (v32).

## Changes

Auto keeps the full-viewport backdrop, with a smaller central card. Eight finite
choices (10, 25, 50, 75, 100, 250, 500, 1,000) occupy a four-column, two-row grid.
The cost breakdown, maximum-run total, base-bet/Ante row and long instructions
are removed. Stop on bonus is one fixed On status; Start autoplay is one action.
A short line below Start retains the actual per-spin charge. Selecting a count
places no bet. Disabled Start retains its reason immediately above it.

The reference's infinity option is intentionally omitted to preserve the
existing requirement for finite confirmed Auto. Automatic stop on bonus and
all other stop/charge guards are unchanged. Only the allowed finite count list
changed in the UI scheduler; the scheduler itself is byte-identical after that
list is excluded.

The Info / Music / Sound popup is 168×146px closed (previously 208×174px), with
17px labels, 22px icons and 44px row targets. Repeated Unavailable captions are
removed; unavailable audio stays disabled and has an accessible explanation and
native tooltip. The Sound icon shows its unavailable/muted state. Music and Sound
still change independent volume channels when the audio assets have loaded.

On pointer opening, focus enters the dialog container rather than highlighting
the entire Info row. Tab/Shift-Tab enter and wrap its controls; row focus remains
visible for keyboard users. Escape collapses the volume control, then closes the
menu. Outside dismissal and focus return remain intact.

## Root cause of overlap

v32 placed the popup relative only to Menu's 44px target. The readout card, Spin
rim, steppers and speed badge extend above or beyond that target. An 8px gap
above Menu could therefore still touch or overlap a different module.

v33 reads the actual control rectangles, including the shared readout card and
badges. It searches for clear placement with a 12px gap. Desktop/portrait place
it above the dock; short landscape places it beside the left rail. Expanded
sliders are included in the clearance check. A whole-dock bounding box is not
used for landscape because it would incorrectly treat the open reel area
between the rails as occupied by controls. Resize, scroll and feature reflow
recalculate the placement.

## Verification

TypeScript, production build and `node scripts/verify-overlays-v33.mjs` pass.
These are source-derived checks, not browser screenshots or live device tests.

| Viewport | Auto count target | Auto card height, disabled | Closed menu | Minimum control clearance, including sliders |
|---|---:|---:|---:|---:|
| 1440×900 | 129.5×56px | 415px | 168×146px | 30px |
| 390×844 | 75.5×56px | 395px | 168×146px | 12px |
| 360×800 | 68×56px | 395px | 168×146px | 12px |
| 844×390 | 123.5×48px | 351px | 168×146px | 12px |

- 76 server-rendered cases verify all eight Auto selections, enabled/disabled
  starts and the three quick-menu expansion states against the compiled CSS.
- 16 actual control-layout cases cover base/feature and collapsed/expanded menus
  at all four sizes. Popup/slider rectangles stay inside the viewport and clear
  the control boxes. Another 128 anchor-placement cases plus zoom/short-window
  cases exercise edge placement and scrolling fallback.
- Grid widths accommodate 1,000 without shrinking its type. All selectable
  targets are at least 44px. Both phone control allocations remain 160px.
- UI callback checks cover separate music/effects volumes, Info, dismissal and
  unavailable audio. Simulated 10, 75 and 1,000-round runs terminate at their
  finite counts; invalid and infinite counts are rejected.
- 96 protected source files match v32. Engine, wallet, settlement, reel geometry,
  collection/hook code, sound engine, control geometry/CSS and tokens are intact.
  Host Start eligibility, callbacks and all pre-render runtime also match v32.

## Remaining limits

No browser screenshots or live gestures were attempted, as requested. Actual
font rasterization, focus/resize gestures and device safe-area behavior still
need device review. Geometry above assumes default text sizing and zero safe-area
insets; unusually short/zoomed windows retain scrollable content. If there is no
clear rectangle in an extremely small viewport, the popup prioritizes on-screen
reachability and can overlap the controls; none of the four required sizes uses
that fallback.

Existing audio-asset loading failures are not repaired in this visual pass.
Unavailable channels remain non-functional until their assets load. Infinity
and an option to disable bonus-stop are not implemented.

Detailed production CSS hashes and per-state bounds: `overlay-report.json`.
