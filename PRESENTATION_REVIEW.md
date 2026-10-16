# Kilo King — illustrated bonus catalogue

The previous Features panel read as a utility form: small thumbnails, broad empty rows and little distinction between bonuses. This pass replaces it with six purpose-made illustrations and an art-led gallery, preserving the neon marina, fisherman, contraband cargo and navy/gold identity. It also enlarges the existing character/logo composition and constrains the desktop bet control. Engine outcomes, wallet, settlement and collection choreography are unchanged.

## Implemented

- **Stage and controls:** Features, Bet, Spin and Menu. The phone control and totals allocation is 148px, down from 264px. Balance and Win occupy one strip; a feature substitutes Bonus Win without moving the reel rectangle. Short landscape uses a 132px console that also occupies the header height. Very short screens can scroll rather than shrinking touch controls.
- **Bet panel:** denomination grid, plus/minus, exact per-spin cost and Apply. Closing discards the draft bet. No native select or duplicated bet readout.
- **Features:** Six illustrated cards in a three-column desktop gallery, two columns on medium screens, and a single-card swipe/arrow carousel on phones. Full 3:2 art compositions are preserved. Titles, awards, prices/trigger conditions and actions share consistent positions. One compact toolbar contains base bet and Ante; the 1.5× per-spin charge is visible. The modal is bounded, with internal scrolling on short viewports.
- **Bonus catalogue:** 3 Scatters uses the existing 100× Free Spins purchase. 4 and 5 Scatters show the existing natural 15/20-spin awards with no invented purchase price. Chopper retains the existing 250× purchase and ×2 start. Mystery Bonus and God Mode have distinct art and a clearly marked in-development preview; neither has a purchase mode, price, award or settlement callback.
- **Entry art compositions:** Each detailed view uses a reusable illustrated title/award composition. These are previews/confirmations; existing in-round Pixi entry and retrigger ceremonies have not been replaced in this pass.
- **Purchase confirmation:** Buy feature opens a confirmation inside the same panel. Only its Buy button starts the existing charge path. Closing or cancelling discards the selection; Spin always starts the current base-game/Ante spin. The submission ref and existing busy ref guard repeated activation.
- **Settings:** persisted Normal, Turbo and Super turbo; System/On/Off reduced motion; music/effects gain controls and master mute. Audio controls remain disabled while the audio pack is unavailable. No synthetic substitute score was added.
- **Speed:** three distinct reel timing profiles. Super turbo omits the extended anticipation crawl, but preserves every recorded outcome and uses the existing Turbo collection holds. The presentation director forwards the selected profile; engine, bank, settlement and fixture files are unchanged.
- **Rules and paytable:** symbol payouts and the ten line diagrams derive from the engine's existing constants. Rules retain feature and cap information, plus the current round breakdown.
- **Type and surfaces:** Source Sans 3 for controls, body copy and tabular amounts; Barlow Condensed for feature/dialog titles and Spin. Utility panels keep restrained surfaces. The feature gallery uses substantial illustrations, narrow accent borders and aligned action plates. Desktop dialogs are bounded; portrait utility panels remain content-sized bottom sheets while Features retains a bounded gallery with visible game around it.
- **Accessibility:** 44px minimum button targets, visible focus, slider keyboard input, disabled-fieldset filtering in the focus trap, Escape/backdrop dismissal and focus restoration. OS reduced motion is respected unless explicitly overridden.

## Verification

- `npm run typecheck:kilo`
- `npm run test:kilo`: 216 fixture/skip/speed cases across 18 saved rounds and three speed profiles; recorded payouts, caps, final boards, collector timing and script immutability remain intact. Existing isolated collection checks also run.
- `node scripts/verify-controls.mjs`: purchase/balance boundaries, persisted preferences and storage failure, distinct timings, rendered panel content, six unique present art files, preview types with no purchase mode/price, existing scatter awards, and engine-backed paytable coverage. These are non-browser checks; they do not simulate pointer or keyboard interaction.
- `node scripts/verify-layout-fit.mjs`: 12 representative devices and 14,685 viewport combinations; horizontal containment, renderer minimum and aspect ratio.
- Standalone production build for the private review site.

Fresh browser screenshots and interaction QA are **pending**. The supported browser QA capability is unavailable in this environment. Geometry checks and static rendering do not prove visual fit, motion quality, focus behavior or charge behavior under actual browser interaction. Keep the PR in draft until that review is completed.

## Review the private build

Preview: https://kilo-king-review.navymap4.chatgpt.site

1. At 320×568, 390×844, 1440×900 and 844×390, inspect idle, feature and long balance values. Confirm no horizontal overflow and no reel movement when a feature begins.
2. Open Bet, change the draft, close, and confirm the original bet remains. Apply another bet and verify the per-spin cost. Enable Ante inside Features and check the 1.5× cost; disable it and check the ordinary cost.
3. At a 10,000 base bet, verify 3 Scatters costs exactly 1,000,000 and Chopper shows its 1,000,000 purchase-limit reason. Test insufficient balance too.
4. Use View preview on 4 Scatters, 5 Scatters, Mystery Bonus and God Mode; verify no debit or armed Spin. Swipe/arrow through all six phone cards and rotate with a later card selected. Open a purchase, go back, and confirm no debit or armed Spin. Confirm once, including rapid repeated clicks, and verify one charge; Continue must not charge or credit again.
5. Check all three speeds, each motion preference, refresh persistence, tab order, focus return, Escape, backdrop close and orientation changes with a sheet open.
6. Use Review → Two collectors — 48,000. Check the award landing above Bonus Win, collector portraits, retriggers, Skip and resize. Check feature entry and the 5,000,000 completion.

## Follow-up after layout review

- Restore the missing `public/kilo-audio/*` pack before sound QA. Music/effects sliders are connected to independent gain buses but disabled until decoding succeeds.
- Integrate the approved entry art into the existing in-round entry renderer, then refine retrigger, completion and win ceremonies. Those in-round skins are still the previous assets. New bonus mechanics remain a separate task after art/layout approval.
- The source repository omits most runtime artwork. Local review still requires the release's `public/` assets, then `npm ci` and `npm run dev:review`.

Asset provenance and intended usage are recorded in `public/kilo-features-v12/ARTWORK.md`.

This work updates the separate owner-private preview and draft PR. It does not merge to main or deploy the live game.
