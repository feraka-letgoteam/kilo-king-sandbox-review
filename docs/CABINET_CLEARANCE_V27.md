# v27 — corrections from the actual desktop and phone screenshots

Checkpoint: `8e8c72b6173a0f2ce463d57d4eaa1b94283941f3`.

The 5:09:42 PM desktop and 5:10:00 PM portrait screenshots showed defects that
v26's control-only checks missed. The cabinet's SVG paints outside the reel
canvas: 22px on desktop and 14px on portrait. The dock started at the canvas
boundary, so the lower rail and its shadow covered control content. A separate
portrait status strip intersected the title/character illustration.

Changes:

- Reserve a real 32px desktop / 24px portrait grid gap, including it in shell
  height. This leaves 10px of space after the cabinet's painted lower edge.
- Remove broad cabinet shadows and give the controls an explicit stacking layer.
- Constrain decorative side overhangs to the available phone/landscape insets.
  Tiny popouts retain the renderer's own frame without the overhanging SVG.
- Reserve separate portrait brand and status zones. Fit feature headers above
  the cabinet's painted upper edge without changing the reel rectangle.
- Use one continuous brass Spin rim; the previous four differently colored
  sides resembled a progress indicator. Keep the reason and cost inside Spin.
- Reframe the portrait marina toward its illuminated shore. The static scene
  and animated water read the same focal-point value.

No engine, bank, settlement, charge, control-action, reel-sizing, hook or
collection-sequencing source is changed. Controls retain their target sizes and
portrait allocation.

Verification includes the painted cabinet bounds, control/well bounds, viewport
edges and the header regions. The prior tests considered only controls against
other controls. This remains source verification; no live browser capture or
interaction test was available.

Remaining composition limitation: the fixed 5×3 reel proportions, unchanged
symbol sizes and 160px controls do not fill a tall phone. The reframed waterfront
makes that region visually intentional but does not eliminate spare height.
A different use of that area needs a separate composition decision, not a claim
that another border or padding adjustment fills the screen.
