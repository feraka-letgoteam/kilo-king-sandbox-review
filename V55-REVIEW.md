# Kilo King v55 — art, articulated VS characters and logo fit

Checkpoint: `047908030d14c25349bc9d667be0fb01190356b3` (local v54).
Branch: `v55-art-performance`.
Status: implemented locally, source-tested and built. **Not deployed or pushed.** The private preview remains on its earlier version. The complete source archive includes v54 and this pass.

## Delivered work

| Area | Implemented |
|---|---|
| VS characters | Two newly illustrated upper-body rigs: seven separate body pieces, matching alternate heads and a King fishing rod. Parent-relative joints and independent paint order replace static portraits in the duel and persistent wild reel. |
| VS performance | King braces and draws the rod; Vice opens his palm into a stop gesture. The recorded winner settles into the full reel with the recorded multiplier. Rod angle is compensated at the wrist. Every action returns to a stable pose. |
| Pure VS behavior | Every landed VS remains wild, with the same winner and multiplier, for the remaining spins. No Big Bass collection was added. Outcome math and recorded-event ownership are unchanged. |
| Marina character | The base scene now uses the King rig under the same environment camera. Feet stay planted, contact shadows stay registered, and ordinary spins use a small glance. Drawing stops when the action settles. |
| Chopper | Eight newly drawn keys include bank, rotor changes, hatch opening, hook release/retraction and exit. The old procedural rotor strokes are removed. The complete rotor envelope is fitted inside the board. |
| Getaway boat | Eight newly drawn keys include driver, cargo, changing hull angle and integrated painted spray. The old generic wake is removed. The result seal sits above the driver. |
| Symbols | Nine restrained illustration refinements: bobber, cash roll, fishing reel, case, four cargo tiers and crown scatter. Original source canvases and symbol fit budgets remain. |
| Symbol reactions | New four-frame case and fishing-reel actions. Frame zero registers to the new idle art without a size jump. Older reactions for the other seven replaced drawings are disabled so they cannot flash an old painting. |
| Cabinet and marina | A cleaner illustrated teal/brass cabinet uses the same nine-slice geometry. Desktop/portrait clean plates have quieter stone and reflections. Existing registered clouds, water, birds and lighting remain. |
| Logo | One coordinated wide/stacked family replaces the old stage/loading/completion logos. Explicit boxes fit portrait and desktop. Short landscape keeps its existing HUD brand cell in feature mode. |

## Specific defects found and corrected

- An older portrait logo rule could override the feature logo height. The new brand component has its own selector and measured bounds.
- Cabinet artwork extends 22px outside the desktop reel box. Logo clearance now accounts for the painted frame, not just the canvas.
- The portrait title could crowd the status line. It now ends at y=64 in the reserved 104px header; the feature title ends at y=27, before the HUD starts at y=32.
- An actor positioned in source pixels would drift when the environment plane scaled. Rig placement now uses percentages of the same source master and the same camera.
- Repainting a settled character continuously would waste phone GPU/CPU work. The new actor stops requesting frames after it reaches rest.
- A texture crop per repaint would leak allocations. Rig crops are cached, and vehicle crop textures are released with their controller.
- Fitting a reaction's union bounds to the old static silhouette could shrink the symbol at reaction start. The two new reaction descriptors preserve the full source-canvas registration.
- Old symbol reactions would briefly reintroduce earlier artwork. Only matching new reactions are enabled for replaced symbols.

## Preserved behavior

Wallet, engine, settlement, purchase confirmation, charge math, feature math, director, reel-fit functions, hooks, protected collection sequencing and accepted controls were not changed. Source equality checks cover the relevant files/functions against v54. The 160px portrait allocation is unchanged. Royal symbols and the protected 3-scatter collector atlas remain untouched.

## Verification

| Check | Result |
|---|---|
| Production effect sequencing | 1,296 cases; 276 resizes and 276 interruptions; normal/turbo/super, reduced motion, four viewport geometries. |
| Feature entry/result and asset binding | 96 cases; entry clears within 1.1 seconds; correct new rig/vehicle assets; protected-source equality. |
| Protected collection | 96 exact/capped, speed, Skip, reduced-motion and resize cases, including collection and transfer. |
| Historical records | 216 saved-round speed/Skip cases passed. |
| UI/source checks | 79 checks and 12 responsive font-budget cases passed. |
| Logo and joints | Eight base/feature logo states across 1440×900, 390×844, 360×800 and 844×390; 808 joint samples; planted feet and stable end poses. |
| Asset registration | Alpha/dimensions/SHA, nine unchanged fit budgets, two matching reactions, 16 vehicle keys and transparent cabinet opening checked. |
| Packaging | Built v55 asset bytes match source. Existing eight audio resources and 32 cue ranges remain packaged. |
| Build | Kilo TypeScript and production review build pass. Existing large-chunk advisory remains. |

The sequence tests run production code against instrumented display objects. They do **not** establish live GPU rendering or browser layout correctness. No new probability calibration was needed or performed because outcome generation is unchanged.

The archive contains complete app source and runtime art, but no Git history. Protected-source comparison checks require a repository checkout with the earlier commits available.

Reproduce:

```sh
npm run typecheck:kilo
npm run test:kilo:art
npm run test:kilo:features
npm run test:kilo
npm run build
node scripts/verify-v55-assets.mjs --dist
node scripts/verify-audio-v54.mjs --dist
node scripts/render-art-v55-proofs.mjs
```

## Review material

- `art/kilo-v55/proofs/v55-animation-artwork.mp4`: three-second offline inspection of the production joint curves and vehicle frame timing.
- `art/kilo-v55/proofs/character-runtime-poses.png`: actual runtime joint poses.
- `art/kilo-v55/proofs/art-and-logo-*.png`: native art/geometry composites from the production fit functions. Dotted lines identify logo bounds. Portrait controls are explicitly shown as reserved space, not imitated UI.
- `art/kilo-v55/symbols/proofs/`: 56px before/after art and authored case/reel keys.
- Every generated asset family includes originals, exact prompts and packing/registration information.

These are **offline art proofs, not live screenshots or gameplay recordings**. Browser automation is unavailable in this managed environment, so no server/browser workaround was used.

## Remaining production gaps

1. Live desktop/phone playback still needs review: joint edges under GPU sampling, frame pacing, clearances after browser font resolution and cloud seams. Source bounds and offline composites cannot certify pixel-perfect live rendering.
2. The characters have articulated upper bodies, not full facial meshes, finger rigs, walk cycles or a Spine project. Their legs/hips are one planted drawing. The protected 3-scatter collector still uses its accepted atlas.
3. Vehicles have eight distinct keys each; case/reel have four. Minor trim, cargo and drawing variation remains. This is a finite authored animation pass, not dense frame-by-frame animation for every symbol or action.
4. Seven refined symbols retain transform acknowledgements rather than new drawing sequences. Royal art is unchanged. The marina change is material polish; it is not a complete redraw of every feature/loading/completion background.
5. The previous math candidate and its production approval status are unchanged. This visual pass does not certify Stake Engine acceptance or visual parity with a reference studio.

The remote Source button still opens the existing remote branch. Use the delivered v55 source archive for this local version until a push/deployment is requested.
