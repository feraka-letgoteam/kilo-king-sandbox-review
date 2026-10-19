# Kilo King v25 — contrast and control separation

Checkpoint: `ce639140f65ba7e48e5c7ade7e3effc0ea18f533` (local v25 material finish).
This change is local only. No deployment or remote push. No screenshots or browser automation were attempted.

## Changes

- Spin and secondary circles now use the same opaque near-black face, `#020c12`. Spin has an 8px solid brass border at all four requested sizes; secondary borders are 2px. Highlights are hard inset edges, with no gradient or blur.
- White icon ink is a separate optional theme input, `iconInk`. It remains white when disabled. Secondary SVG strokes resolve to 3px, including the supplied Buy icon's path-level stroke; Spin resolves to 3.5px. Speed badges remain opaque.
- Wells use `#020c12`, warm-white `#fff8e8` figures, and quiet one-pixel inset edges. Their original border boxes and text insets are preserved. Labels stay 14px. The existing amount fitting is unchanged.
- Focus outlines and shadows stay inside their controls. Pressing changes the inset edge without moving or dimming the button. Hover changes the rim color, preserving the teal rim of selected controls.
- Short landscape uses the existing 8px spacing token above Spin, replacing a hard-coded 4px gap. Spin, its attached cost, and Turbo move down 4px. No control or well changes size. Desktop and portrait positions are unchanged; portrait still occupies 160px.
- The disabled reason and charge remain in the original Spin face group, associated with the button through `aria-describedby`. The component's markup and callbacks are byte-for-byte unchanged from the checkpoint.

## What caused the discrepancy

The earlier verification parsed the component CSS but did not resolve the complete built stylesheet or include focus outlines, shadows and pressed movement in its overlap checks.

| Source finding at the checkpoint | Effect | Correction |
|---|---|---|
| Auto–Spin gap was 4px in landscape | Auto's external edge and Spin's external edge left only 1px of painted separation at rest | Gap is 8px; all rim/highlight paint is internal |
| Focus outline was 2px, offset outward by 3px | A focused Auto extended 5px beyond its target, crossing the adjacent Spin paint in landscape | Focus outline offset is now −3px |
| Pressed controls translated down 2px | A pressed Auto could cross Spin's outer paint; adjacent Bet/Ante and stepper targets overlapped by 2px when pressed | Targets remain stationary |
| Component hover/active filters and global button filters | Brightness changed across hover/pressed and touch-hover conditions | A scoped rule outranks host button defaults; every audited state resolves to `filter: none` |
| Disabled icon color changed to muted ink | The face stayed opaque, but icons lost contrast | Disabled icon ink stays white |
| Teal face and outward secondary edges | Selected and unselected surfaces had different visual weight | Faces remain near-black; teal is retained on selected rims, badges and Ante On |

The old color/image variable collision is **not present** in this checkpoint. The built idle faces were already flat, and the old global `button:disabled { opacity: .48 }` was already overridden. Likewise, `.kk-app .kk-shell { filter: none }` beats the older shell drop shadow. No surviving higher-specificity gradient or icon-stroke override was found. These were checked rather than assumed to be the cause.

An idle desktop Spin overlap could not be reproduced from this checkpoint's source geometry. The demonstrated overlaps were state-dependent and most acute in short landscape. A claim that the previous live raster exactly matched—or differed from—these calculations would require browser inspection.

## Verification

The production build and `typecheck:kilo` pass. The production cascade check uses the CSS file referenced by `dist/index.html`, actual server-rendered controls, the Kilo inline theme, and the host ancestor classes and material variables. It applies selector specificity, author layers, source order, inline values, inheritance and interaction states. It then calculates absolute border boxes and conservative painted bounds, including badges, outlines and shadows.

| Viewport | Spin diameter | Bet well | Portrait allocation | Minimum separation between painted modules* | Overlaps |
|---|---:|---|---:|---:|---:|
| 1440×900 | 100px | 148×92px | — | 5px | 0 |
| 390×844 | 96px | 124×88px | 160px | 5px | 0 |
| 360×800 | 96px | 112×88px | 160px | 5px | 0 |
| 844×390 | 96px | 128×128px | — | 4px | 0 |

\* Conservative bounds include the small speed badge. Landscape's 4px minimum is between the left-side wells; Auto–Spin is 8px. The attached Bet steppers and Ante share a well intentionally; their hit targets do not overlap.

The matrix includes 76 actual component states: idle, Ante On/Off, armed Free Spins/Chopper, long costs, insufficient balance, feature entry, collection, retrigger, completion, long balance, loading and speed/auto states. Each enabled target is checked at rest, hover, keyboard focus and pressed focus, under both hover-capable and touch-style media conditions. All geometry tokens and 44px minimum targets remain unchanged. Existing checks also cover 32 jurisdiction hide/disable cases and purchase boundaries.

The engine, wallet, settlement, reel geometry, collection sequencing, hook implementation, purchase confirmation, charge model, host layout and host styles are unchanged. Source hashes are included in the machine-readable report.

Files in `public/kilo-contrast-v25/`:

- `resolved-css-layout.json`: production CSS hash, winning selectors, resolved values, bounds and state matrix.
- `resolved-controls.css`: readable resolved paint declarations for the normal desktop controls.
- `material-validation.json`: theme/contrast and retained geometry checks.
- `validation.json`: markup, font-fit, purchase and restriction checks.
- `cascade-cases.json`: exact server-rendered inputs used for the cascade audit.
- `control-state-review.html`: inert component review sheet, **not** a browser screenshot.

Reproduce with:

```sh
npm ci
npm run typecheck:kilo
npm run build
CONTROL_REVIEW_OUTPUT=public/kilo-contrast-v25 node scripts/verify-control-materials.mjs
CONTROL_REVIEW_OUTPUT=public/kilo-contrast-v25 node scripts/verify-modular-controls.mjs
node scripts/verify-control-contrast.mjs
```

The source checks require Python with `lxml` and `fontTools`, in addition to the lockfile's Node dependencies.

## Remaining limits

This is source-derived CSS and layout verification, not browser `getComputedStyle`, live interaction or a pixel comparison with the Valkyrie reference. No live visual match is claimed. Feature states are passed to the existing component; no gameplay or settlement is executed.

The existing compact-popout fallback, outside the four requested viewports, retains its 64px Spin and 4px rim to preserve its existing content fit. Its rim does not meet the 8px target. Restriction explanation tooltips are intentional overlays and are excluded from module-separation checks; their trigger controls and lock badges are included in the existing markup checks.
