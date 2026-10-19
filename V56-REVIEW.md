# Kilo King v56 — feature presentation

Local checkpoint: v55 `1f605487b2bb7a1c626134c621fb3cca137c5c42`. Work branch: `v56-feature-presentation`. Not deployed or pushed. The private preview still shows its previously deployed version.

## What changed

- **Feature takeover:** three art-led purchase cards with individual Dockside, Yacht VS and Getaway illustrations. Ante is a separate compact banner. Live price and action share a purchase row; base bet and balance sit in the footer. The catalogue remains visible but inert behind a focused confirmation. There is no new illustrated scene behind the menu. Disabled reasons stay on the relevant action and retain their full copy.
- **Custom artwork:** four transparent 768×512 illustrations, including the hidden Chopper feature's entry/completion art. The standard purchase menu still excludes Chopper and the unbuilt Mystery feature. No additional purchase modes were invented.
- **Yacht VS:** a distinct warm/teal opponent split, framed VS badge, clearer challenge/resolve/lock timing, recessed multiplier cap and grounded wild foot plate. Recorded winning character and multiplier remain sticky through the final spin, including losing spins. Upper-body articulated rigs from v55 are retained.
- **Getaway:** eight new right-facing boat drawings include braking, diminishing wake, a brief victory gesture and a quiet stopped key. The boat travels left to right. A recorded maximum reaches the center at 64% of the 1,600 ms reveal and never exits. A loss continues out to the right. No random decision is made by the animation.
- **Max-win finish:** the boat stays stopped while the credited amount resolves and transfers once to the meter. It also remains on the board behind the completion rail until the round clears. Resize during the award transfer repaints the stopped boat and result against the new reel geometry.
- **Phone clearance:** the existing completion rail overlapped the retained boat by about 14 px at 360 px width. A Getaway-only compact result style provides source-derived clearances of 8.2 px at 360×800 and 16.5 px at 390×844, with the Continue target still at least 44 px tall. Other feature results and the control bar are unchanged.

## Reference interpretation

The supplied 28.30-second Ganja Snail recording shows a feature purchase takeover at 0–11 seconds and a large on-stage vehicle/MAX treatment later. The takeover structure and the relationship between vehicle and result informed this pass. It does not show a confirmed successful maximum; the rule that Kilo King's boat stops fully inside the stage on a max win comes from the user's explicit direction.

The reference's artwork, grid, odds and prices were not copied. Kilo King's existing one-spin binary 25,000×/zero outcome, 1,000× buy price, confirmation, limits and settlement remain unchanged. This is a presentation pass, not new math or a Stake Engine certification.

## Verification

| Check | Result |
| --- | --- |
| Kilo TypeScript and production build | Passed; existing >500 KB bundle advisory remains |
| Production effect controller | 1,296 sequences, including 276 resize and 276 interruption cases across all four viewport geometries |
| Feature entry/result asset bindings | 96 cases; on-reel entry remains at most 1.1 seconds |
| Takeover SSR and font budgets | 151 assertions, 12 layout cases including phone safe-area and over-limit states |
| New motion and stage bounds | 1,770 assertions and 12 targeted result/transfer resize cases |
| Protected collection | 96 exact/capped, speed, reduced-motion, Skip, collection-resize and transfer-resize cases |
| Existing event/director regressions | Existing 6,000-feature invariant suite and 216 saved-round presentation cases pass |
| Assets | Four new transparent heroes and eight distinct registered boat keys; dimensions, alpha padding, preloads and built bytes pass |
| Existing composition/audio | Logo geometry, joints, protected symbol registration and audio resources remain valid |

The UI budgets use the shipped font advances and CSS dimensions. They are **not computed browser layout**. Estimated catalogue heights without safe areas: 696 px on both phone widths, 366 px at 844×390 and 709 px at 1440×900. With 47 px top and 34 px bottom safe areas, the phone budget is 761 px.

No supported browser automation is available in this managed environment. No live screenshots or GPU playback were captured, and no alternate browser/server path was used. The build and instrumented tests establish source behavior, not pixel-perfect browser rendering.

## Preserved

Engine, wallet, settlement, charge math/limits, binary outcome probabilities, hook behavior, base and 3-scatter collection sequencing, symbol sizes/artwork, accepted logo/header geometry, reel geometry and controls are unchanged from v55. Protected-source comparisons enforce this. The 12,000 ×2 →24,000 per collector / 48,000 combined case and capped variants remain in the collection checks.

## Review artifacts

- `art/kilo-v56/proofs/getaway-motion.mp4`: normal-speed boat curve/atlas proof at actual phone and desktop reel sizes; max and loss shown side by side.
- `art/kilo-v56/proofs/vs-motion.mp4`: normal-speed production rig/timing proof with illustrative King/Vice outcomes.
- `art/kilo-v56/features/actual-size-proof.png`: new illustrations on dark/light surfaces and at 96 px.
- `art/kilo-v56/vehicles/getaway-stop-proof.jpg`: all eight authored boat keys.
- `art/kilo-v56/`: verification JSON, exact prompts, generated originals, packing scripts and limitations.

Both clips are explicitly labelled **offline art proofs, not browser playback or gameplay recordings**. They do not replace the requested live recorded-sequence capture. All art was generated with the built-in image-generation tool, then cropped/registered/exported for the app. The exact prompts are stored with each asset family.

## Remaining visual limits

- Live desktop/phone font resolution, focus behavior, GPU sampling, timing and resize need browser review. The source-derived spacing checks cannot certify the final render.
- The boat has eight authored keys, not a dense frame-by-frame or skeletal vehicle animation. Minor drawing detail variation remains between keys. The VS characters retain v55 upper-body rigs rather than new full facial/body rigs.
- The custom menu illustrations are static. The entry banners and renderer supply the finite motion; those images are not presented as animated characters.
- This pass does not redraw every environment, royal symbol, 3-scatter entry or background animation. It preserves the accepted symbol art and the collection system.

## Reproduce

```sh
npm run typecheck:kilo
npm run test:kilo:features
npm run test:kilo:art
npm run test:kilo
npm run build
node scripts/verify-v56-assets.mjs --dist
node scripts/verify-v55-assets.mjs --dist
node scripts/verify-audio-v54.mjs --dist
node scripts/render-getaway-v56-proof.mjs
node scripts/render-vs-v56-proof.mjs
```

The complete source archive contains app code, runtime art and production notes. Source-equality regression checks need a repository checkout containing the earlier commits; the download itself does not include Git history. The app's remote Source button still points to the previous remote branch; use the delivered v56 archive for this local pass.
