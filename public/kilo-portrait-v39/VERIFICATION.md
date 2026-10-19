# Kilo King v39 — local portrait regrouping

Checkpoint: de4abe70aa06d32feac8bdfa3c80be1c18ee016c. No source push or deployment.

## What caused the problem

The earlier overlap checks covered click targets. They missed the painted Auto backing plate extending from the Spin center into the adjacent module. Portrait also placed Speed beside the readouts and Buy/Menu in a column, so the four secondary controls did not share a group.

The new portrait-only layout removes that backing plate. Auto is an independent 44px circle. Auto/Buy form the first row; Turbo/Menu form the second, with 12px gaps in both directions. Spin remains centered and 96px. Balance and Win share the full-width upper well. During features, Turbo/Menu form a centered horizontal pair and the free-spin well replaces Bet.

The built CSS also exposed a cascade conflict: the later base-scene portrait rule kept the pier at bottom: -24px despite the initial host override. The placement rule now includes the stage scope, so its bottom: 0 and 160px height win without !important.

## Measured portrait bounds

Coordinates are local to the 160px control allocation, in CSS pixels; columns show x, y · width×height.

| Viewport | Bet | Spin | Auto | Buy | Turbo | Menu |
|---|---|---|---|---|---|---|
| 360×800 | 0, 74 · 112×64 | 120, 58 · 96×96 | 232, 56 · 44×44 | 288, 56 · 44×44 | 232, 112 · 44×44 | 288, 112 · 44×44 |
| 390×844 | 15, 74 · 112×64 | 135, 58 · 96×96 | 247, 56 · 44×44 | 303, 56 · 44×44 | 247, 112 · 44×44 | 303, 112 · 44×44 |

- Bet → Spin: 8px; Spin → secondary grid: 16px; internal secondary row/column gaps: 12px.
- Connected readout row: 336×44px. Secondary group: 100×100px. Four pixels remain below the last control, within the unchanged 160px allocation.
- Cabinet clearance is 16px: 14px of existing painted frame plus 2px clear. Previously it was 18px. Reel dimensions, header and reel position are unchanged.
- The portrait pier now ends with the allocation; its former 24px overhang is removed. The painted shelf below the last button shrinks from 28px to 4px.
- Portrait numbers remain 18px/21px and labels return to the requested 14px. All amounts retain the same tabular font and exact value. The existing icon-only Spin keeps its charge and disabled explanation linked accessibly; no new face copy is introduced.
- Solid near-black control faces, hard 3px Spin/2px secondary rims and full opacity. The portrait clearcoat pseudo-elements are disabled, so no gradients or blur remain on those controls. Desktop/landscape paint is unchanged.

## Verification

- TypeScript and production build passed.
- 83 real React states, 35 emitted CSS checks, and 12 viewport/toolbar combinations. Includes 360×800, 390×844, narrow fallback, desktop, short landscape, feature mode, all three speeds, disabled Spin, Ante, active Auto and jurisdiction flags.
- Both interactive rectangles and painted bounds checked, including numeric wells, Spin rim, secondary circles and badges. No intersections at the required phones; targets remain at least 44×44.
- Desktop, landscape and compact rectangles match v38 exactly, including an 18-case width sweep. Feature controls reuse the same reel and Spin geometry. All action callback bodies are unchanged.
- 18 protected source hashes match the checkpoint: engine, wallet/bank, settlement host, collection director, Pixi renderer, hook/reel geometry, purchase guards, autoplay, Info and Features.

## Remaining limits

No browser screenshots or live interaction checks were performed. CSS and geometry checks do not establish final font rasterization or device gesture behavior.

Unused viewport height still exists below the fixed-size game on tall phones. At these reel dimensions and a 160px dock, it cannot be removed while also keeping the stage near the top and avoiding scale changes. This pass removes the extra shelf inside the composition; it does not claim to fill the entire portrait viewport. Tiny compact popouts keep their existing fallback, as landscape/compact geometry is outside this pass.

CSS: dist/assets/review-cmzDFehm.css
SHA-256: ea3268dd8ae455ea6b955de1f0b2fa0334042b862534136aea95dc240e404c5b
Detailed resolved styles, dimensions and protected hashes: check.json
