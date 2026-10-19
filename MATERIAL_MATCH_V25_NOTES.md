# Kilo King — v25 material correction

Checkpoint: published v25, `3a27dc206eefda28c0a4b4da1667b7aeb2706ea1`.

This patch is local only. Nothing was deployed or pushed. The hosted sandbox still has the preceding v25 source.

## Cause and repair

The shared stylesheet declared `--sc-face` as a gradient, while the inline theme declared the same variable as the solid color `#071820`. The inline color won. The first layer of the circular controls' layered background therefore received a color where a background image was required. This affected ordinary Turbo, Menu, Auto, Buy and Spin backgrounds. The authored SVG frames did not execute this CSS, so they did not reveal the defect.

The gradient now has its own name, `--sc-face-fill`. `--sc-face` stays a color. The face and metal image layers remain opaque, with an additional solid background-color fallback. This applies to circular controls, Spin and restricted-control explanations. Recessed wells and the Bet backing also have solid fallbacks.

The palette now supplies the enamel midtone and brass return highlight already used by the v25 frame artwork. Secondary rims and well edges use those frame stops. Spin retains its existing 8px rim, stronger highlight, 3px brass underside and inset shadows. No border dimensions changed.

Disabled controls no longer dim/desaturate the whole button. The rim and face remain at full opacity. Disabled icons use the readable muted text color at full opacity. The speed badge keeps its opaque fill and tabular type.

The component markup and control geometry are unchanged. “Insufficient balance” and “Cost 1,000” keep their existing positions inside Spin and their existing `aria-describedby` association. Labels remain 14px in the main text color at all four requested sizes. Charge values, wrapping rules and purchase confirmation are unchanged.

## Scope

Runtime changes are confined to:

- `src/components/slot-controls/controls.css`
- `src/components/slot-controls/tokens.ts` — two optional theme color fields and their defaults; geometry tokens unchanged
- `src/components/kilo/control-theme.ts` — supplies those existing palette colors

No geometry, layout, engine, wallet, settlement, charge math, limits, reel sizing, collection sequence, hook behavior or animation changes.

## Completed checks

- TypeScript check and production build.
- 44 CSS paint cases: default palette, Kilo palette, a theme omitting the new optional colors and an alternate palette. The resolved CSS is parsed with Lightning CSS; face/rim gradient layers and their stops are opaque, with solid fallback colors. Badge and Ante pill fills are opaque.
- Regression check reproduces the old color/image collision and rejects that missing face layer.
- All 62 CSS rules containing geometry/typography declarations are identical to v25. Every control spacing/size token is unchanged.
- Nineteen protected files are byte-identical to v25, including the control component, control layout, host adapter, placement CSS, main stylesheet, engine, bank, reel geometry/renderer, director, motion, charge model, purchase panels, auto policy and keyboard behavior.
- Existing checks pass for 50 layouts, 570 touch targets, 1,790 overlap comparisons, 400 numeric-fit cases, 76 actual React server-rendered control states, jurisdiction policies and purchase boundaries.

These are CSS, source, model and markup checks. They are not live browser rendering or interaction tests.

## Live screenshot request: not completed

`control-browser` is unavailable in this environment. The Sites skill explicitly says to skip managed browser QA in that situation and not start a preview server, install a browser or improvise another browser path. No live screenshots were captured, and no new authored frames are being presented as substitutes.

| Requested state      | 1440×900     | 390×844      | 360×800      | 844×390      |
| -------------------- | ------------ | ------------ | ------------ | ------------ |
| Base idle            | Not captured | Not captured | Not captured | Not captured |
| Ante on              | Not captured | Not captured | Not captured | Not captured |
| Ante off             | Not captured | Not captured | Not captured | Not captured |
| Insufficient balance | Not captured | Not captured | Not captured | Not captured |
| Feature entry        | Not captured | Not captured | Not captured | Not captured |

The remaining visual gap is **unverified live equivalence to the frames**: browser compositing, actual disabled-reason placement and icon contrast still need inspection at those sizes. The known material-token defect is corrected in source, but a pixel-perfect/live match is not claimed.

`public/kilo-material-match-v25/` contains CSS validation output, the unchanged-geometry/control markup results and a self-contained HTML sheet using the corrected production CSS and actual React markup. Its game controls are inert; it is not a live screenshot set.

## Reproduce source checks

```sh
npm run typecheck:kilo
node scripts/verify-control-materials.mjs
CONTROL_REVIEW_OUTPUT=public/kilo-material-match-v25 node scripts/verify-modular-controls.mjs
npm run build:review
```

The checkpoint digests and geometry snapshots are included so verification works from the complete source archive without private Git history. No new runtime dependency was added.
