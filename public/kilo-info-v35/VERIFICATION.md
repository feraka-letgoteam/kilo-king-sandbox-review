# Kilo King v35 — full-screen Info

Checkpoint: v34, `ac3e25bb9b2eeaa9c4c193764a7e9d9944d45431`.

## Delivered

The old 770px rules dialog and dense paytable rows are replaced by a viewport takeover. It follows the supplied reference's full-screen darkened/blurred game backdrop, centered uppercase section headings, thin dividers, unboxed symbol artwork, gold combination counts, white payouts, visual paylines, and illustrated feature rows. The close button occupies a persistent top region, outside the scrolling content.

All six supplied screenshots were inspected: the first two showed the existing Kilo dialog; the remaining four established the paytable, paylines, feature explanations and Info treatment. Kilo retains its own artwork, 5×3 reels, ten actual paylines and game rules. The reference game's 5×4 geometry, features and RTP were not copied.

Info now includes all ten paying symbols and thirty line payouts; scatter awards; all thirteen obtainable cash-package values; 3/4/5-scatter triggers; fisherman substitution and collection; every multiplier, retrigger and modifier; hook, dynamite and bazooka behavior; all four playable modes and their prices; per-mode current payout limits; maximum charge; and a button guide. Mystery Bonus and God Mode are explicitly unavailable artwork previews.

The meter explanation corrects an old omission: fishermen advance the meter even when no cash package is collected. Collection uses the multiplier already reached, and newly earned multipliers start on the next spin. This is a copy correction to match the existing engine, not a gameplay change.

## Verification

TypeScript and the production build pass. `scripts/verify-info-v35.mjs` checks the real server-rendered component against the built stylesheet. It verifies the complete paytable and ten 5×3 diagrams against engine constants, every mode's displayed cost/cap across all five selectable bets, local artwork existence, and responsive authored box dimensions. The generated evidence is in `info-check.json` beside this report.

| Viewport | Content width | Symbol columns / cell width | Symbol art | Scroll region | Close target | Close-to-content gap |
| --- | ---: | --- | ---: | --- | --- | ---: |
| 1440×900 | 1096px | 3 / 344px | 188px | y=76, height=824px | 52×52px | 12px |
| 390×844 | 350px | 2 / 167px | 128px | y=64, height=780px | 44×44px | 8px |
| 360×800 | 320px | 2 / 152px | 128px | y=64, height=736px | 44×44px | 8px |
| 844×390 | 780px | 3 / 238.67px | 140px | y=60, height=330px | 44×44px | 8px |
| 320×568 | 280px | 2 / 132px | 128px | y=64, height=504px | 44×44px | 8px |

Body text is 18px desktop / 16px phone. Section headings are 32px / 26px. Amounts use Source Sans 3 with tabular numerals. Phone feature explanations use a single column. Safe-area arithmetic also checks a 44px top inset. No individual rule or amount is deliberately truncated or line-clamped.

The legacy `.kk-dialog` width, gradient and portrait bottom-sheet rules were the source of the old constrained Info treatment. The new `#kilo-info-takeover` scope overrides those rules in the production cascade: fixed root, zero insets/padding, 100% panel width/height, no panel maximum, no rounded sheet edge, and a separate vertical scroller.

Source comparison confirms the game runtime outside the Info branch is byte-for-byte unchanged after removing the replaced import/obsolete scatter-copy flag. The engine, local wallet, settlement, reel renderer, director/collection sequence, hook behavior, control geometry, purchase panel and autoplay runner match the checkpoint. The existing Dialog still owns Escape, focus containment, focus return and dismissal timing. No browser screenshots or browser automation were attempted. These checks establish source/cascade/box properties, not actual browser text shaping, touch interaction, scrolling or pixel equivalence.

## Stake Engine requirements and remaining blockers

Official frontend guidance requires reachable rules, mode prices and purchased actions, RTP and maximum win for each mode, symbol payouts, all special-symbol values, feature triggers, a UI guide and usable mobile scaling. The corresponding content is now present except verified RTP. The current design is not an approval certificate. [1]

1. **Verified theoretical RTP per mode is missing.** `src/lib/kilo/baseline.json` contains sampled estimates, while an engine comment describes an approximate target. Neither establishes an approved theoretical RTP. Info explicitly says “Not verified” for Base, Ante, Free Spins Buy and Chopper. Supply verified math/configuration for the actual production modes before submission. No guessed percentage is displayed.
2. **Production operation cannot be asserted by this local sandbox.** The official disclaimer must communicate server-authoritative settlement and recovery after interruption. [2] This preview has a local test balance and no Stake Engine RGS adapter. Its Info page states that truth. Finalize the production operational notice and verify it against the RGS integration before submission. RGS authentication must also supply supported bets and currencies; this visual pass does not implement that adapter. [3]
3. **Live visual/interaction QA remains open.** Browser verification was unavailable. Check real devices for scroll behavior, fixed close, focus restoration, artwork/font loading and visual similarity before treating the page as production-ready.

Suggested production operational notice, to use only when those behaviors exist: A stable connection is needed. After an interruption, reload to restore an unfinished round. The server response determines settlement; animation never determines awards. Returns are statistical over many plays, and the displayed machinery is illustrative. A malfunction invalidates the affected play and its associated award.

## Official sources reviewed

Retrieved 17 October 2026; the public documentation's search-indexed text was available, while direct pages were client-rendered.

1. Stake Engine, Frontend and Communication: https://stake-engine.com/docs/approval-guidelines/front-end-communication
2. Stake Engine, General Game Disclaimer: https://stake-engine.com/docs/approval-guidelines/general-disclaimer
3. Official `engineio/docs` RGS Requirements source: https://github.com/engineio/docs/blob/main/src/routes/docs/approval/rgs-requirements/%2Bpage.svx
