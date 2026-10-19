# Kilo King — modular controls v25

Local refinement of v24. Published sandbox checkpoint: v23, `4b21e2535fd1c10036b2ab487ddca8dd9b1daafc`. The restored v24 source checkpoint is `94d54a507045872fefe671339cc5539459e6ba1f` (identical to the delivered v24 source archive).

Nothing was deployed or pushed. The hosted private sandbox remains unchanged.

## Changes

- Spin uses a single 8px brass rim, up from 6px, with a stronger highlight, shallow brass underside and inset pressed state. Its outer diameter and location are unchanged: 100px desktop; 96px at the requested portrait and short-landscape sizes.
- Main labels increase from 12px to 14px and use the main text color. Amounts remain larger and tabular. Currency stays quieter. Landscape numeric wells gain 4px of height to accommodate the labels, within the same left control area. Reel placement and size do not change.
- Portrait now exposes separate 44px Turbo and Menu circles below Auto and Buy. Speed remains visible as 1 / 2 / 3. The bet panel remains 112×88px at 360×800 and 124×88px at 390×844. Spin stays central; the control group still fits the existing 160px allocation, with 12px below its last target.
- During a feature, Bet/Ante becomes the remaining-spins/multiplier well; Auto and Buy disappear. Turbo and Menu form a compact pair beside Spin. Balance, Win and Spin retain their positions. The existing bonus header is unchanged.
- Optional jurisdiction-disabled controls retain their rim and show a lock badge. Their explanation is attached to the control and can be exposed by hover, keyboard focus or touch. They remain focusable with `aria-disabled`; the action handler is guarded. Default jurisdiction behavior remains hiding restricted controls.
- Long charges put “Cost” above the full amount within Spin. Ordinary costs remain inline. This avoids the thicker rim touching purchase prices; no price is shortened and no charge calculation changes. Narrow fallback controls use the same fit rule. Insufficient balance and other existing short Spin explanations remain on the button, with cost visible.

## Reuse

`src/components/slot-controls/` owns the component, breakpoint geometry, spacing and edge tokens, typography, charge fitting and jurisdiction presentation. It has no engine, wallet, purchase math, background art or Kilo-specific decoration dependencies. Theme colors and icon nodes—including the restricted-state icon—are replaceable. Kilo's existing host adapter supplies behavior and its themed Buy icon.

## Verification completed on this source

- TypeScript: `npm run typecheck:kilo`.
- Control geometry and actual React server-rendered markup: 50 viewport layouts, 570 targets of at least 44×44px, 1,790 target-overlap comparisons, 400 numeric-fit cases, and 76 control-state renders across 360×800, 390×844, 844×390 and 1440×900.
- Charges: five amounts through 2,500,000 at all 50 layouts. The numeric line is checked against the circular Spin face, not only its rectangular allocation.
- Jurisdiction: 32 hide/disable cases across all four requested sizes, plus restricted settings markup. Alternate theme/icon rendering remains supported.
- Existing purchase and material checks: charge caps and balance boundaries, preference handling, speed profiles, panel content, sound-state markup and disabled reason associations.
- Four purchase cases include Free Spins at the valid 1,000,000 boundary and Chopper at a 10,000 base bet with sufficient balance but the genuine “Above the 1,000,000 purchase limit” restriction.
- Fourteen protected source files remain byte-identical to the published checkpoint, including engine, bank, fixtures, reel layout/renderer, director, collection motion, character, marina, charge model, auto policy, keyboard behavior and purchase panels. The host's credit/play/settlement block and purchase confirmation block are unchanged. Relative to v24, the only host adapter edit is its review-version marker.
- Production build checked with the Sites build helper. No runtime dependency was added.

These checks do not establish browser layout or interaction correctness.

## Review files and outstanding checks

`public/kilo-modular-v25/` contains six actual-size authored compositions, three module studies showing base / feature / insufficient balance / long purchase charge, coordinate manifests, validation output, and a self-contained HTML sheet using the actual React markup and production CSS. Its gameplay controls are inert; restricted-control explanations can be inspected with hover or keyboard focus.

The PNGs are **authored SVG/Sharp design frames, not browser screenshots**. Browser automation is unavailable here. The Sites skill instructs this environment to skip browser QA when `control-browser` is unavailable; no preview server or alternate browser was started.

| Requested live check                                | Status                                                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Base idle, Ante Off/On at all four sizes            | Geometry and control markup checked; live screenshots pending                                        |
| Armed Free Spins and Chopper                        | Charge rendering and confirmation source checked; live click flow pending                            |
| Valid purchase / genuinely over-limit purchase      | Existing quote and card markup checked; live interaction pending                                     |
| Feature entry after fade, collection and retrigger  | Control states checked; live animation and overlay captures pending                                  |
| Completion with a long amount                       | 5,000,000 control-state rendering checked; completion overlay capture pending                        |
| Resize during active collection and final transfer  | Protected layout, sequencing, hook and destination-anchor code unchanged; live continuity unverified |
| Restriction explanation on touch and keyboard focus | Markup, association and handler guards checked; real browser behavior unverified                     |

No defect was found in the completed source geometry and markup checks. Browser-only defects remain possible. Outside the requested viewports, very narrow compact popouts still reduce a ten-digit balance to 10–13px to retain the full value. Compact popouts retain their smaller labels and 4px Spin rim. This pass does not change audio availability or the animation assets.

## Reproduce

Use Node 24+ and the locked dependencies. Run:

```sh
npm run typecheck:kilo
node scripts/verify-modular-controls.mjs
node scripts/verify-controls.mjs
node scripts/verify-material-panels.mjs
node scripts/render-modular-controls-proofs.mjs
npm run build:review
```

The frame renderer additionally uses Python/fontTools/Brotli and Sharp. Use `npm run dev:review` and the existing `?review` recorded-fixture controls only in an environment with a supported browser workflow. The source archive includes the complete project, existing artwork and checkpoint SHA-256 digests so the source-integrity checks also work without private Git history; the design-frame archive contains standalone PNGs, review HTML, coordinate/validation JSON and these notes.
