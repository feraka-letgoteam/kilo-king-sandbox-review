# Kilo King — v25 material finish

Checkpoint: `1ec507a91638fdbd7cd31ec3f1e6307bdeecf421`, the v25 material correction. This pass is local only; nothing was pushed or deployed. The attached Valkyrie bar was inspected directly. No browser automation or screenshots were attempted.

## Finish

- Spin and secondary controls have flat, opaque dark faces. Selected controls have a flat teal face. There are no surface gradients or blurred shadows in the shared control stylesheet.
- Spin keeps its existing 8px rim. Brass now paints as a solid border, separated from the face by a hard inner seam, with a one-pixel upper highlight and a hard underside. Secondary rims remain 2px.
- Balance, Win and Bet use a flat recessed `#020c12` fill, a subdued 3px edge and hard inset shading. The edge no longer competes with the figures.
- Numeric and icon ink is warm white, `#fff8e8`. Labels stay 14px in quieter `#b6c6be`. All amounts retain the same tabular numeric face.
- Secondary icon strokes are 3px and Spin is 3.5px. A shared rule also overrides thinner SVG path presentation attributes, including the themed Buy hook. The speed badge stays opaque and uses bright, bold numeric ink.
- Disabled controls keep `opacity: 1` and `filter: none`. The face and rim retain their original paint. Disabled icons use readable muted ink.
- Readout glyphs grow by up to 2px within their original line boxes. The existing width fitter still handles long values. Cost and the disabled reason keep their existing positioning inside the Spin group and their `aria-describedby` links.

## Geometry and spacing

Every `CONTROL_TOKENS` value and all 62 CSS rules containing layout/typographic geometry are unchanged, excluding the explicitly permitted icon stroke weight. The control layout, host placement, reel rectangle and 160px portrait dock allocation are unchanged. One-pixel hard outer edges reduce the visible open space slightly; the actual 8px/12px gap tokens and module positions remain fixed.

Regular readout sizes below use the tested base state (Balance 500,000; Win 0; Bet 1,000). Line boxes are identical to the checkpoint.

| Viewport | Balance / Win type | Original line box | Bet type | Original line box |
| -------- | ------------------ | ----------------- | -------- | ----------------- |
| 1440×900 | 30px               | 28px              | 28px     | 26px              |
| 390×844  | 24px               | 22px              | 24px     | 22px              |
| 360×800  | 24px               | 22px              | 24px     | 22px              |
| 844×390  | 22px               | 20px              | 24px     | 22px              |

## Verification

CSS values were resolved for the default palette, Kilo palette, a legacy palette without optional fields and an alternate theme, then parsed with Lightning CSS. These are source checks, not observed browser pixels.

| Check                                  | Result                                                                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Flat opaque face / badge / pill cases  | 44 passed                                                                                                                              |
| Rim colors                             | Opaque; Spin border remains 8px at the requested sizes                                                                                 |
| Hard edge shadows                      | Zero blur radius on control and well edges                                                                                             |
| Disabled Spin and secondary controls   | Full opacity; no dimming filter                                                                                                        |
| Control tokens and layout declarations | Unchanged                                                                                                                              |
| Layouts / touch targets                | 50 layouts; 570 targets at least 44×44                                                                                                 |
| Target overlap comparisons             | 1,790 passed                                                                                                                           |
| Balance/Win fitting                    | 400 cases, using the shipped font's advance widths and ink bounds                                                                      |
| Bet fitting                            | Checked against its amount area and the attached steppers                                                                              |
| Actual React markup                    | 76 states across the four requested viewports                                                                                          |
| Spin reason and cost                   | Same face group; both associated with Spin by `aria-describedby`                                                                       |
| Jurisdiction restrictions              | 32 hide/disable cases across the four viewports, plus Settings                                                                         |
| Protected files                        | 18 byte-identical files, including engine, wallet/bank, host, reel layout/renderer, director, motion, charge model and purchase panels |
| Control component                      | Structure and behavior match the checkpoint after excluding only the two readout text styles and their typography imports              |
| TypeScript / production build          | Passed                                                                                                                                 |

Calculated Kilo color contrast:

| Pair                                               | Ratio   |
| -------------------------------------------------- | ------- |
| Numbers on the well                                | 18.65:1 |
| Previous regular numbers on the lightest well stop | 13.81:1 |
| Previous Win ink on the lightest well stop         | 11.36:1 |
| Labels on the well                                 | 11.10:1 |
| Icons / disabled reason / cost digits on the face  | 17.10:1 |
| Active icons on selected teal                      | 6.60:1  |
| Disabled icons on the dark face                    | 10.18:1 |
| Disabled icons on selected teal                    | 3.93:1  |
| Brass rim against the dark face                    | 5.82:1  |

Machine-readable results are in `public/kilo-material-finish-v25/material-validation.json` and `validation.json`. `control-state-review.html` uses production CSS, actual server-rendered controls, the Kilo theme and themed Buy icon; its gameplay controls are inert. It is not a screenshot or a live gameplay test.

## Remaining visual differences identifiable from source

- The reference uses a broad filled-arrow silhouette. Spin still uses the existing vector arrow with a stronger stroke; its icon box and circular control size are unchanged.
- Actual module positions and gaps are fixed. The one-pixel paint treatment is the extent of spacing refinement in this pass.
- Very long amounts can remain smaller than the regular sizes above so the full number fits. Compact popouts outside the requested viewports retain their existing smaller labels and 4px Spin rim.
- This finish applies to the modular controls. The settings and feature panels retain their existing material treatment.

Exact browser rasterization and a live side-by-side match are not claimed. No source-level geometry, opacity, contrast or copy-fit failures remain in the checked cases.

## Reproduce

```sh
npm run typecheck:kilo
node scripts/verify-control-materials.mjs
node scripts/verify-modular-controls.mjs
npm run build
```

Runtime edits are confined to the shared controls' CSS, theme, readout text styles and Kilo theme input. Engine behavior, wallet, settlement, charge math/limits, purchase confirmation, reel sizing, collection sequencing and hook behavior are unchanged.
