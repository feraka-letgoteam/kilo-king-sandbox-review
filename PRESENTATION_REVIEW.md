# Kilo King — scene, dock and bonus presentation

The earlier pass improved the illustrations but still put the title and character into a narrow header, split the controls from the readouts and presented bonuses as tall posters. This revision changes that structure. On a wide desktop, the title/cargo occupy the left side, the fisherman occupies the right, and the reels retain a reserved center column. A segmented dock sits beneath the scene. The six bonus illustrations now sit inside compact, consistently structured cards. Engine outcomes, wallet, settlement and collection choreography are unchanged.

## Implemented

- **Desktop scene:** At 1,100px of available stage width and above, the existing logo and cargo are on the left and the existing full-body fisherman is on the right. The art has allocated columns and cannot cover the canvas. The central header carries status or the existing bonus meter. Narrower layouts retain the compact header; phones do not inherit desktop side art. Feature state never changes the reel rectangle.
- **Dock:** The wide 110px allocation contains a Features medallion, a shared settings/balance/win plate, a dedicated bet plate, and Spin with 44px bet steppers. Those steppers use only the existing denominations. The portrait console integrates its readouts and controls in 144px. Short landscape uses a 172px side console; very short screens can scroll rather than shrinking touch targets.
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
- **Type and surfaces:** Source Sans 3 for controls, body copy and tabular amounts; Barlow Condensed for feature/dialog titles and Spin. Utility panels keep restrained surfaces. The feature gallery uses substantial illustrations, narrow accent borders and aligned action plates. Desktop dialogs are bounded; portrait utility panels remain content-sized bottom sheets while Features retains a bounded gallery with visible game around it.
- **Accessibility:** 44px minimum button targets, visible focus, slider keyboard input, disabled-fieldset filtering in the focus trap, Escape/backdrop dismissal and focus restoration. OS reduced motion is respected unless explicitly overridden.

## Verification

- `npm run typecheck:kilo`
- `npm run test:kilo`: 216 fixture/skip/speed cases across 18 saved rounds and three speed profiles; recorded payouts, caps, final boards, collector timing and script immutability remain intact. Existing isolated collection checks also run.
- `node scripts/verify-controls.mjs`: purchase/balance boundaries, persisted preferences and storage failure, distinct timings, rendered panel content, six unique present art files, preview types with no purchase mode/price, existing scatter awards, and engine-backed paytable coverage. These are non-browser checks; they do not simulate pointer or keyboard interaction.
- `node scripts/verify-layout-fit.mjs`: 12 representative devices and 14,685 viewport combinations; horizontal containment, renderer minimum/aspect ratio, reserved side-art columns and minimum desktop dock width.
- Standalone production build for the private review site.

Fresh browser screenshots and interaction QA are **pending**. The supported browser QA capability is unavailable in this environment. Geometry checks and static rendering do not prove visual fit, motion quality, focus behavior or charge behavior under actual browser interaction. Keep the PR in draft until that review is completed.

## Review the private build

Game preview: https://kilo-king-review.navymap4.chatgpt.site

Fixture review/tools: https://kilo-king-review.navymap4.chatgpt.site/?review

1. At 320×568, 390×844, 1440×900 and 844×390, inspect idle, feature and long balance values. On a wide desktop, check the left title/cargo, right character and center reels as one scene. Confirm no horizontal overflow and no reel movement when a feature begins.
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
Reference observations and their limits are recorded in `PROVIDER_UI_REVIEW.md`.

This work updates the separate owner-private preview and draft PR. It does not merge to main or deploy the live game.
