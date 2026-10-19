# Portrait spacing v28

Changes from checkpoint `79390adcb8a33bdb5a328e59510d193e51798260`. Originally prepared locally; subsequently authorized for private preview publication.

## Cause

The portrait layout expanded Bet into the available left-side width: 112px at 360×800 and 124px at 390×844. Spin and the secondary circles retained 8px separations. This met the old no-overlap check but made the groups visually crowded. The positions are absolute inline rectangles returned by `createControlLayout`; changing a parent CSS gap would not move them. No new material cascade fault was found.

## Changes

Bet now stops at 104×88px. Spin remains 96×96px and centered at the two requested viewports. Auto/Buy occupy the upper row of a single secondary grid, with Turbo/Menu directly below. Each secondary target is 44×44px, with 12px gaps in both directions. A 4px right inset reserves room for the outward badges.

Balance and Win retain their existing rectangles. The main group starts at y=56; the secondary grid ends at y=156, within the unchanged 160px dock. Feature mode retains the same Spin and readout rectangles and uses the same secondary columns for Turbo/Menu.

All coordinates below are CSS pixels relative to the control area, excluding the viewport's 12px stage inset on each side.

| Viewport | Control width | Bet bounds x/y/w/h | Spin bounds x/y/w/h | Bet–Spin gap | Spin–secondary gap | Secondary gap |
|---|---:|---|---|---:|---:|---:|
|360×800|336|0 /60 /104 /88|120 /56 /96 /96|16px|16px|12px|
|390×844|366|3 /60 /104 /88|135 /56 /96 /96|28px|28px|12px|

At 360×800, secondary columns start at x=232 and 288. At 390×844, they start at x=259 and 315. Both use y=56 and 112. The attached bet controls retain 44px minimum targets; the existing compact Ante label treatment fits the 60px amount/Ante column.

## Preservation and verification

Only the portrait branch of the reusable control layout and three portrait spacing tokens change application behavior. Desktop, landscape and compact control rectangles, Spin sizes, the engine, wallet, settlement, reel geometry, collection sequence, hook behavior, charge calculations and action handlers remain unchanged.

The stylesheet is unchanged. Its production cascade retains opaque near-black faces, 8px Spin and 2px secondary rims, warm numeric ink, 14px labels and full disabled opacity. The existing Spin reason and charge markup remain inside the circular action group.

Run `npm run typecheck:kilo`, `npm run build`, then `node scripts/verify-portrait-v28.mjs`. The verification derives layout from the application functions and resolves the production CSS; it is not browser `getComputedStyle`, screenshots or live interaction testing. No browser screenshots were attempted.

The 160px allocation leaves 4px below the lowest secondary target. The main viewport's spare height beneath the fixed-size game is unchanged; it is outside this portrait-control pass.
