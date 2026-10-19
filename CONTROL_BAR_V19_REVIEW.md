# Kilo King — Stake Engine control-bar pass

Checkpoint: GitHub `main @ 9d83f8ee5d69ba34589c5746c849ac407b1824ea`, the merge of the v17 presentation rebuild. GitHub comparison with the v17 PR head returned no changed files. The matching local source checkpoint is `d8823fe09ce3625880c9765b048fc640f8cf1d95`.

This draft is saved without deployment. It follows the user's detailed control-bar brief, superseding the first styling sketch in this turn. The v18 animation assets remain in source as a separate prior draft; this pass restores the requested v17 fisherman, marina and symbol presentation at runtime. It does not combine the animation draft with the control-bar change.

## Implemented

- Desktop: Turbo, Menu, Balance, Win, Bet with chevron steppers, Auto, dominant Spin, circular crown Buy. One horizontal row; 100px complete vertical reservation including the charge caption. The Buy icon sits beyond the painted rail's right edge. No gap is reserved above Spin.
- Portrait: full-width readouts and a primary strip with a bet well, attached 44px chevron steppers, 76px Spin and circular Buy. One full-width utility row carries Turbo, Menu, Auto and explicit Ante Off/On. Total dock reservation is 160px. No target overlaps a spanning Spin.
- Short landscape: a 128px left column for the bet/readouts and a 96px right column for Auto / Spin / Turbo. The reel viewport is calculated from both columns, two 10px gaps and the 56px header. At 844×390 with standard stage insets, the reel host is 488×294; there is no 196px height cap. Very short viewports retain touch targets and may scroll vertically.
- A single geometry function, `createDockDesign`, supplies runtime HTML positions and decorative vector artwork. `fitGameLayout` has one branch per layout; feature state is not an input. The 5×3 cell fitting function, symbol scale factors and artwork remain unchanged.
- Navy `#071820`, restrained brass edges, teal accents, raised circular Spin and a circular crown Buy icon. Amounts use the existing Source Sans 3 tabular face, including purchase quotes and completion totals. Short labels use Barlow Condensed.
- Feature mode replaces the bet well with free spins remaining and removes Ante. The existing dark feature header, multiplier, collection display and hook behavior remain intact. The reel rectangle does not move when a feature begins.
- Turbo cycles existing Normal / Turbo / Super turbo preferences. Menu retains rules/paytable, settings and sound. Buy opens the existing feature selector and its existing explicit purchase confirmation; selecting a card never charges or changes the base Spin action.
- Auto requires confirmation for 10, 25 or 50 spins. It displays cost per spin and maximum total charge, calls the existing play/charge path sequentially, and stops on a feature, declined charge, presentation interruption, hidden tab, menu interruption or explicit Stop. The current round completes normally after Stop. No automatic purchases, infinite run, reload resume, wallet reservation or new settlement path is added.

## Verified without a browser

- `npm run typecheck:kilo`.
- `node scripts/verify-dock-v19.mjs`: 409 layouts, 3,580 target bounds/size checks, 13,916 target-pair overlap checks, 4,090 real-font amount checks and 17 finite Auto behavior assertions. Zero failures.
- `node scripts/verify-layout-fit.mjs`: 6,954 layout checks, including safe areas, review-header space, breakpoint boundaries and declared minimum-height scrolling.
- `node scripts/verify-controls.mjs`: exact-limit Free Spins at a 10,000 base bet and 1,000,000 balance is allowed; Chopper at 10,000 is genuinely over the 1,000,000 limit. Also checks insufficient balance, 1.5× Ante charge, preferences and feature groups.
- `npm run test:kilo`: 216 fixture/skip/speed presentation cases across 18 saved rounds. Recorded totals, caps, final boards, collector timing, remaining-spin timing and script immutability pass. Existing Node-only audio/negative-timeout warnings do not fail these presentation assertions.
- Protected runtime files are byte-identical to the checkpoint: engine, bank/wallet, fixtures, director, Pixi renderer, motion atlas, fisherman, marina and control-model charge/limit policy. Changes to `play.tsx` surround the existing charge/run path with the finite Auto scheduler; the charge and credit operations are preserved.
- Production build is packaged from this exact source version. Build output and source are delivered separately from the design frames.

## Required browser acceptance — still pending

The supported browser-control skill is unavailable in this managed workspace. The Sites skill explicitly says not to substitute another browser path, install a browser, or start an unsupported preview server. Therefore there are **no new browser screenshots**, no browser interaction acceptance and no claim of completed active-feature resize QA.

Every row below still needs capture and interaction verification from one built artifact at **360×800, 390×844, 844×390 and 1440×900**:

| Requested state | Source / non-browser evidence | Browser result |
|---|---|---|
| Base idle, no purchase selected | Four authored design frames; geometry/target checks | Pending |
| Ante Off and On | Existing charge policy and explicit labels; base mode toggle | Pending |
| Selected Free Spins and Chopper | Existing feature selection/confirmation path retained | Pending |
| Valid and genuinely over-limit purchase | Engine-backed quotes tested at exact 1,000,000 limit | Pending |
| Entry after fade | Existing renderer/director preserved; fixture tests | Pending |
| Collection | Existing renderer/director preserved; fixture tests | Pending |
| Retrigger | Existing threshold holds and sequence preserved; fixture tests | Pending |
| Completion with long amount | Existing renderer; tabular font retained; maximum known round cap is 5,000,000 | Pending |
| Resize during active feature and transfer | New layout has no feature-state input; existing resize path retained | **Pending; not simulated** |
| Auto confirmation, cancel, stop, feature stop | Finite scheduler behavior assertions | Pending |
| Keyboard, focus, touch, real browser text fit | Existing modal infrastructure plus ≥44px source targets | Pending |

“Armed” here means a feature selected in the existing confirmation dialog. It does not arm the main Spin button or bypass the existing purchase confirmation.

## Remaining defects / limitations

- Browser acceptance is incomplete. CSS cascade, exact text rasterization, touch/focus behavior, modal fit and resize during a running feature cannot be certified from the design frames.
- The checkpoint's audio pack is absent. Sound controls remain correctly disabled until the existing audio loader succeeds; this pass does not supply audio.
- The in-round entry/retrigger/completion skins are the checkpoint versions. They are not redesigned in this control-bar task.
- The phone uses a primary strip plus one utility row, as the brief permits. It is 16px taller than the prior 144px dock to retain the requested eight controls and attached 44px steppers.

## Artifacts

`public/kilo-dock-v19/index.html` shows four actual-size **authored design frames**, not screenshots: desktop 1440×900, portrait 360×800 and 390×844, landscape 844×390. The generator imports live layout/control geometry and the unchanged reel fitting code. Text is outlined from the shipped fonts. Static native rendering differs from browser CSS/Pixi shading and does not prove interaction behavior.

`public/kilo-dock-v19/validation.json` records geometry, font, scheduler and protected-file checks. `scripts/render-dock-v19-proofs.mjs` regenerates the frames. `npm run build` creates the complete static review build. No deployment or GitHub branch update is performed for this pass.
