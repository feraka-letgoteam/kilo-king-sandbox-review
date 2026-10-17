# Kilo King — scene, dock and bonus presentation

The 9:06 PM Kilo recording and 9:08 PM The Last Harvest reference showed an inconsistent composition: bright scenery competing with the game, unrelated cabinet/control materials, and a weak phone title treatment. This pass establishes desktop (1440×900) and phone (390×844) composition standards, with the user-requested Features button separated from the main rail. Existing artwork, reel geometry, symbol sizes, gameplay, wallet, settlement and collection choreography remain unchanged. Native vector cabinet decoration replaces the previous ornate frame treatment.

Actual-size static design proofs and their coordinate manifests are in `public/kilo-composition-v16/`. These are design renders assembled from the existing artwork and current geometry, not browser screenshots. Rendering differences and remaining visual QA are documented alongside them.

## Composition standard

| Element | Standard |
| --- | --- |
| Materials | Painted marine metal: top `#263b43`, body `#142830`, recess `#08151d`. Brass `#b69a62`, highlight `#e2c98c`. Keep large surfaces dark; use brass for edges, fasteners and action emphasis. |
| Lighting | Cool marina fill, warm dock accents. Foreground art retains its existing lighting. The environment alone is graded to 68% saturation / 80% brightness with a soft edge vignette. |
| Typography | Source Sans 3 semibold for tabular amounts, normally 22px Balance and 24px Win. Barlow Condensed semibold for 12px instrument labels and 13–15px button labels. Long amounts receive explicit narrow-screen exceptions; no truncation. |
| Desktop reference | 1440×900. 888×534.94 reel host; 164px cells. The rail sits beneath the reel column. Stacked title/cargo on the left, fisherman on the right, detached Features beside the rail. |
| Phone reference | 390×844. 366×220.48 reel host; 66px cells. Stacked title and upper-body fisherman share the header composition. The 56px Features button sits outside a 302px main rail with an 8px gap. |
| Artwork | Retain current symbol files, alpha fitting and scale factors. New art must match the existing perspective, rim-light direction and outline density; text and monetary values remain runtime text. |
| Motion | This pass changes composition only. Preserve the existing reel/collection choreography, event-driven fisherman poses and reduced-motion behavior. Full articulated character and bonus animation remain separate production work. |

## Implemented

- **Responsive composition:** Stage padding uses viewport/safe-area insets only, preventing the portrait/landscape measurement loop. A 12px gap is explicitly included between the reels and console. Oversized scenes use safe alignment so the top remains reachable when scrolling. Side framing requires at least 1,180 × 660 available pixels; other sizes use a dedicated title header. The header title persists during bonuses without moving the reels. Short landscape retains a small title within its bonus meter.
- **Desktop scene:** A stacked gold/teal title sits over a local dark vignette in the left column, with cargo below. The fisherman uses a registered body crop with hands and boots contained; only the decorative rod tip may leave it. The shared pier remains anchored to cabinet geometry. Reel width is bounded to leave breathing room around the composition. Phones compose the stacked title and the same fisherman together above the unchanged reels. Extra decorative height uses only measured spare vertical space; the active feature HUD still keeps the reel rectangle fixed.
- **Fisherman motion:** Existing idle/cast/cheer/slump illustrations are preloaded and decoded before switching. The existing game mood events drive the poses. A short cast, cheer or settle gesture is followed by continuing upper-body breathing; lower-body artwork and boot baseline remain fixed. Hidden tabs pause animation, and reduced motion removes movement. These are illustrated pose changes with small gestures, not a full skeletal character rig.
- **Ambient animation:** Water now has readable lateral/vertical refraction and changing neon/moon reflections, with soft drifting sky wisps and lamp halos. Boats, buildings and foreground stay rigid. Rendering is capped at 24fps and 680,000 pixels, with no device-pixel-ratio multiplication. Hidden/offscreen rendering pauses; reduced motion uses the static background. Background motion has no connection to outcomes or the game clock.
- **Reel cabinet:** Painted marine-metal rails, a restrained brass inner lip, structural corner fittings and recessed blue-green wells use the same palette as the control rail. All decoration stays within the existing frame budget. The previous ornate frame texture is no longer loaded. Cell geometry and symbol scale factors are unchanged.
- **Dock and detached Features:** Desktop controls align beneath the reels. Features is a separate button beside the rail, in the left art column when space exists. Header-framed desktop and phone compositions reserve explicit horizontal space for the detached button. Short landscape places it below the side rail. The rail uses painted metal, a machined brass Spin rim, clear spin/skip icons, tabular figures and condensed labels. Heights remain 120px desktop / 144px portrait; landscape retains its 266px minimum group. Long amounts receive targeted size adjustments only on narrow tracks. All action targets remain at least 44px.
- **Preview viewport:** The ordinary preview uses the full viewport without the development toolbar. `?review` retains Play, Review, Source and deterministic review fixtures.
- **Bet panel:** a compact 360px selector with a large value well, plus/minus, a centered 3+2 denomination grid, exact per-spin cost and Apply. Closing discards the draft bet. No native select or duplicated bet readout.
- **Features:** Six cards in three columns above 620px and a single-card swipe/arrow carousel on phones. Each card puts its name above a contained illustration, followed by award, price/trigger condition and aligned action. Original art files are unchanged; CSS masks soften their background edges within compact illustration wells. Scatter conditions show the game's actual scatter symbol. The gallery floats over the blurred game without an opaque enclosing box. Its footer contains balance and a shared bet stepper that updates all quotes. Ante is a separate illustrated feature tile with Activate/Deactivate and its 1.5× per-spin cost. The gallery is bounded to 900px and scrolls internally on short viewports.
- **Bonus catalogue:** 3 Scatters uses the existing 100× Free Spins purchase. 4 and 5 Scatters show the existing natural 15/20-spin awards with no invented purchase price. Chopper retains the existing 250× purchase and ×2 start. Mystery Bonus and God Mode have distinct art and a clearly marked in-development preview; neither has a purchase mode, price, award or settlement callback.
- **Card and modal motion:** Modal/scrim entrance (260/200ms), staggered card arrivals (35ms spacing), restrained illustration hover, button press feedback, keyed transitions into bonus details and a 160ms dismissal for Close, Escape and the backdrop. Dismissing panels become inert; repeat dismissal cannot queue callbacks. Reduced motion removes both delays and movement, and dismisses immediately. Phone confirmation keeps Back and Buy in one row where space permits.
- **Entry art compositions:** Each detailed view uses a reusable illustrated title/award composition. These are previews/confirmations; existing in-round Pixi entry and retrigger ceremonies have not been replaced in this pass.
- **Purchase confirmation:** Buy feature replaces the gallery with a compact 420px confirmation: selected art/name, spins and multiplier, prominent total cost, base bet/balance and Back/Buy. Only its Buy button starts the existing charge path. Closing or cancelling discards the selection; Spin always starts the current base-game/Ante spin. The submission ref and existing busy ref guard repeated activation.
- **Settings:** persisted Normal, Turbo and Super turbo; System/On/Off reduced motion; music/effects gain controls and master mute. Audio controls remain disabled while the audio pack is unavailable. No synthetic substitute score was added.
- **Speed:** three distinct reel timing profiles. Super turbo omits the extended anticipation crawl, but preserves every recorded outcome and uses the existing Turbo collection holds. The presentation director forwards the selected profile; engine, bank, settlement and fixture files are unchanged.
- **Rules and paytable:** symbol payouts and the ten line diagrams derive from the engine's existing constants. Rules retain feature and cap information, plus the current round breakdown.
- **Type and surfaces:** Source Sans 3 for body copy and tabular amounts; Barlow Condensed for compact instrument labels, feature/dialog titles and Spin. The marina alone receives a restrained saturation/brightness grade; foreground artwork and controls retain contrast. Utility panels keep restrained surfaces. The feature gallery uses substantial illustrations, narrow accent borders and aligned action plates. Desktop dialogs are bounded; portrait utility panels remain content-sized bottom sheets while Features retains a bounded gallery with visible game around it.
- **Accessibility:** 44px minimum button targets, visible focus, slider keyboard input, disabled-fieldset filtering in the focus trap, Escape/backdrop dismissal and focus restoration. OS reduced motion is respected unless explicitly overridden.

## Verification

- `npm run typecheck:kilo`
- `npm run test:kilo`: 216 fixture/skip/speed cases across 18 saved rounds and three speed profiles; recorded payouts, caps, final boards, collector timing and script immutability remain intact. Existing isolated collection checks also run.
- `node scripts/verify-controls.mjs`: purchase/balance boundaries, persisted preferences and storage failure, distinct timings, rendered panel content, six unique present art files, preview types with no purchase mode/price, existing scatter awards, and engine-backed paytable coverage. These are non-browser checks; they do not simulate pointer or keyboard interaction.
- `node scripts/verify-layout-fit.mjs`: 6,954 geometry checks across normal/review headers, actual stage insets, safe areas and breakpoint boundaries; horizontal containment, justified minimum-height scrolling, complete dock/gap accounting and regression guards against layout-dependent padding. These checks do not render the browser.
- Standalone production build for the private review site.

Fresh browser screenshots and interaction QA are **pending**. The supported browser QA capability is unavailable in this environment. Geometry checks and static rendering do not prove visual fit, motion quality, focus behavior or charge behavior under actual browser interaction. Keep the PR in draft until that review is completed.

## Review the private build

Game preview: https://kilo-king-review.navymap4.chatgpt.site

Fixture review/tools: https://kilo-king-review.navymap4.chatgpt.site/?review

1. At 320×568, 390×844, 768×1024, 824×640, 1440×900 and 844×390, inspect idle, feature and long balance values. Check the persistent title, contained character, footer clearance, tablet rail and short-landscape scroll origin. Confirm no horizontal overflow or layout oscillation and no reel movement when a feature begins. Watch the exposed water, reflections and sky, then enable reduced motion and switch away/back to verify static and pause/resume paths. On a side-framed desktop, inspect casting, revealed-win reactions and continuing breathing after a round.
2. Open Bet, change the draft, close, and confirm the original bet remains. Apply another bet and verify the per-spin cost. Enable Ante inside Features and check the 1.5× cost; disable it and check the ordinary cost.
3. At a 10,000 base bet, verify 3 Scatters costs exactly 1,000,000 and Chopper shows its 1,000,000 purchase-limit reason. Test insufficient balance too.
4. Use View preview on 4 Scatters, 5 Scatters, Mystery Bonus and God Mode; verify no debit or armed Spin. Swipe/arrow through all six phone cards and rotate with a later card selected. Open a purchase, go back, and confirm no debit or armed Spin. Confirm once, including rapid repeated clicks, and verify one charge; Continue must not charge or credit again.
5. Check all three speeds, each motion preference, refresh persistence, tab order, focus return after dismissal, rapid repeated Escape, backdrop close and orientation changes with a sheet open.
6. Use Review → Two collectors — 48,000. Check the award landing above Bonus Win, collector portraits, retriggers, Skip and resize. Check feature entry and the 5,000,000 completion.

## Follow-up after layout review

- Restore the missing `public/kilo-audio/*` pack before sound QA. Music/effects sliders are connected to independent gain buses but disabled until decoding succeeds.
- Integrate the approved entry art into the existing in-round entry renderer, then refine retrigger, completion and win ceremonies. Those in-round skins are still the previous assets. New bonus mechanics remain a separate task after art/layout approval.
- The source repository omits most runtime artwork. Local review still requires the release's `public/` assets, then `npm ci` and `npm run dev:review`.

Asset provenance and intended usage are recorded in `public/kilo-features-v12/ARTWORK.md`.
The new marina and foreground prompts are recorded in `public/kilo-scene-v14/ARTWORK.md`.
The stacked title prompt is recorded in `public/kilo-scene-v15/ARTWORK.md`.
Reference observations and their limits are recorded in `PROVIDER_UI_REVIEW.md`.

This work updates the separate owner-private preview. GitHub synchronization is pending explicit payload/destination approval after automatic approval review blocked the previous upload; the draft PR still contains the earlier source. It does not merge to main or deploy the live game.
