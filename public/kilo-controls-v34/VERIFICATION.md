# Kilo King v34 — Spin rim and Auto alignment

Checkpoint: `66f30ee02bfa29e550570301ed7a3844b1570103` (v33).

Spin's brass border is reduced from 8px to 3px. The extra gold inset is removed;
a dark 1px inset separates the face from its rim. The arrow stays approximately
the same visible size despite the larger inner face. Spin remains 100px on
desktop and 96px on both requested phones and short landscape. Disabled Spin
retains full opacity and the near-black face.

Auto's 44×44 hit target was centered independently of the visible joined plate.
The gap to Spin made its icon appear off-center inside that plate. The icon and
A now move together to the visible section's center: +3px horizontally on
desktop, −8px on portrait, and +4px vertically in landscape. The same alignment
applies to Stop during Auto. All target rectangles and module positions stay
unchanged, including the 160px portrait allocation.

## Verification

TypeScript and the production build pass. Sixteen server-rendered states (idle,
disabled, active Auto, feature) were inspected against the exact production CSS
at 1440×900, 390×844, 360×800 and 844×390. The resolved Spin border is 3px on every
side; opacity is 1 and the face is #020c12. Auto's icon center matches the exposed
panel's center at all four sizes, and the 24px icon remains inside its 44px target.

Only `SlotControls.tsx`, `controls.css` and the `spinRim` token changed in application
source. Other tokens, module/reel geometry, gameplay, wallet, settlement, audio,
collection sequencing and purchase/Auto scheduling are unchanged from v33.

No browser screenshots or live interaction checks were attempted. Source bounds
and compiled paint are verified; final rasterization still needs device review.
Detailed values and the production CSS hash are in `control-check.json`.
