# Kilo King — audit implementation

The two design audits called for a clearer stage, fewer permanent controls, consistent utility panels and typography, and a purchase flow that makes the charge explicit. This pass implements those changes using the existing marina, fisherman, symbols, logo and Spin artwork. It does not replace the art style.

## Implemented

- **Stage and controls:** Features, Bet, Spin and Menu. The phone control and totals allocation is 148px, down from 264px. Balance and Win occupy one strip; a feature substitutes Bonus Win without moving the reel rectangle. Short landscape uses a 132px console that also occupies the header height. Very short screens can scroll rather than shrinking touch controls.
- **Bet panel:** denomination grid, plus/minus, exact per-spin cost and Apply. Closing discards the draft bet. No native select or duplicated bet readout.
- **Features:** Ante has its own toggle inside Features, with the 1.5× per-spin charge. Free Spins and Chopper have compact illustrated rows, prices and full unavailable reasons. One shared base-bet editor updates both quotes.
- **Purchase confirmation:** Review opens a confirmation inside the same panel. Only its Buy button starts the existing charge path. Closing or cancelling discards the selection; Spin always starts the current base-game/Ante spin. The submission ref and existing busy ref guard repeated activation.
- **Settings:** persisted Normal, Turbo and Super turbo; System/On/Off reduced motion; music/effects gain controls and master mute. Audio controls remain disabled while the audio pack is unavailable. No synthetic substitute score was added.
- **Speed:** three distinct reel timing profiles. Super turbo omits the extended anticipation crawl, but preserves every recorded outcome and uses the existing Turbo collection holds. The presentation director forwards the selected profile; engine, bank, settlement and fixture files are unchanged.
- **Rules and paytable:** symbol payouts and the ten line diagrams derive from the engine's existing constants. Rules retain feature and cap information, plus the current round breakdown.
- **Type and surfaces:** Source Sans 3 for controls, body copy and tabular amounts; Barlow Condensed for feature/dialog titles and Spin. Restrained utility surfaces replace repeated illustrated plaques. Desktop dialogs are bounded; portrait utility panels are content-sized bottom sheets with internal scrolling and fixed action footers.
- **Accessibility:** 44px minimum button targets, visible focus, slider keyboard input, disabled-fieldset filtering in the focus trap, Escape/backdrop dismissal and focus restoration. OS reduced motion is respected unless explicitly overridden.

## Verification

- `npm run typecheck:kilo`
- `npm run test:kilo`: 216 fixture/skip/speed cases across 18 saved rounds and three speed profiles; recorded payouts, caps, final boards, collector timing and script immutability remain intact. Existing isolated collection checks also run.
- `node scripts/verify-controls.mjs`: purchase/balance boundaries, persisted preferences and storage failure, distinct timings, rendered panel content, and engine-backed paytable coverage. These are non-browser checks; they do not simulate pointer or keyboard interaction.
- `node scripts/verify-layout-fit.mjs`: 12 representative devices and 14,685 viewport combinations; horizontal containment, renderer minimum and aspect ratio.
- Standalone production build for the private review site.

Fresh browser screenshots and interaction QA are **pending**. The supported browser QA capability is unavailable in this environment. Geometry checks and static rendering do not prove visual fit, motion quality, focus behavior or charge behavior under actual browser interaction. Keep the PR in draft until that review is completed.

## Review the private build

Preview: https://kilo-king-review.navymap4.chatgpt.site

1. At 320×568, 390×844, 1440×900 and 844×390, inspect idle, feature and long balance values. Confirm no horizontal overflow and no reel movement when a feature begins.
2. Open Bet, change the draft, close, and confirm the original bet remains. Apply another bet and verify the per-spin cost. Enable Ante inside Features and check the 1.5× cost; disable it and check the ordinary cost.
3. At a 10,000 base bet, verify Free Spins costs exactly 1,000,000 and Chopper shows its 1,000,000 purchase-limit reason. Test insufficient balance too.
4. Review a purchase, cancel, and confirm no debit or armed Spin. Confirm once, including rapid repeated clicks, and verify one charge; Continue must not charge or credit again.
5. Check all three speeds, each motion preference, refresh persistence, tab order, focus return, Escape, backdrop close and orientation changes with a sheet open.
6. Use Review → Two collectors — 48,000. Check the award landing above Bonus Win, collector portraits, retriggers, Skip and resize. Check feature entry and the 5,000,000 completion.

## Follow-up after layout review

- Restore the missing `public/kilo-audio/*` pack before sound QA. Music/effects sliders are connected to independent gain buses but disabled until decoding succeeds.
- Refine the existing entry, retrigger and win ceremonies in a separate art/motion pass. Those skins are still the previous assets.
- The source repository omits most runtime artwork. Local review still requires the release's `public/` assets, then `npm ci` and `npm run dev:review`.

This work updates the separate owner-private preview and draft PR. It does not merge to main or deploy the live game.
