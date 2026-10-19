# Kilo King v26 — layout research and implementation decisions

Research date: 17 October 2026. Scope: presentation, responsive layout and UI communication in the private review sandbox. This memo does not establish Stake Engine approval or production RGS readiness.

## Requirements versus design choices

The official frontend guidelines require usable mobile UI and an undistorted mini-player board, rather than a prescribed control-bar design. They require bet adjustment, current balance, clear final wins, incremental payout updates across multiple winning actions, sound disable, spacebar betting and a UI-button guide. Autoplay requires confirmation before consecutive bets. Fast-play wins, combinations and popup information must remain readable. Rules must explain mode costs and actions, RTP and maximum win per mode, symbol payouts, special-symbol values and feature triggers. Images and fonts must be served from Engine's CDN for a submitted game. [1]

No standard 8px brass rim, 14px label, 44px touch target, fixed module order or exact stage position was found in the official requirements reviewed. Those are project design decisions. The 44px target and 160px portrait control allocation remain Kilo's explicit acceptance criteria. A finite autoplay count and the existing purchase-confirmation step are also project requirements; the retrieved official text explicitly requires autoplay confirmation but does not prescribe our exact purchase flow.

The official RGS requirements say the frontend must respect currency-specific authentication defaults, allowed increments and minimum/maximum bet values; both range endpoints must be selectable. English-only is permitted, but other language parameters must not corrupt the interface. Submitted builds are static and cannot load external resources. [2]

## Provider references actually inspected

The following official game-sheet pages were downloaded, rendered and visually inspected during this pass. They are design references, not templates to copy or evidence of Kilo's live appearance.

| Reference | Observed composition | Kilo application |
| --- | --- | --- |
| Nolimit City, *Home of the Brave*, page 6 [5] | Portrait centers a dominant Spin glyph, keeps BET and its steppers compact beside it, and groups smaller utilities below. Feature selection is bounded, has a clear close, artwork per option and prices immediately beneath; Bonus and Booster sections are distinct. | Let Spin and its charge lead. Keep Bet compact, utilities grouped and price/copy/action together. Preserve reel context around feature selection where space permits. |
| Nolimit City, *True Kult*, page 5 [6] | Reels dominate desktop, the title sits close above the cabinet, and readouts occupy a shallow area below it. Utilities occupy the edges; Win gains emphasis without a large enclosing card. | Raise the complete composition, tighten the cabinet/control relationship, center label/value groups and quiet the well frames. More brass alone will not fix hierarchy. |

Valkyrie's official *Loki's Vault* and *Waylanders Forge* pages identify Stake Engine implementations. Their live controls were not visually inspected in this pass. They support provider/platform attribution, not measured layout equivalence or claims about the provider's animation technology. [7][8]

## Concrete v26 decisions

- **Stage placement:** top-align the composition and remove the portrait crest's negative offset. Retain the reel-sizing implementation in `src/components/kilo/layout.ts`; do not stretch or globally scale the game to occupy unused space.
- **Desktop controls:** cap the desktop control group at 888px within the unchanged dock while retaining distinct modules. Center the calmer numeric wells; use a stronger Spin glyph and readable Auto/Buy captions. Reduce unnecessary visual weight around secondary information.
- **Portrait:** retain the compact bet/stepper/Ante grouping and dominant Spin. Balance and Win stay secondary. Preserve touch targets and the existing control allocation instead of adding rows that displace reels.
- **Safe areas and dialogs:** account for device insets; bound the complete modal to the viewport. Allow body content to scroll while close and confirmation actions remain reachable. Short landscape uses adaptive settings columns rather than forcing a tall portrait stack.
- **Feature cards:** reduce portrait illustration height, retain complete descriptive copy and prices, and give disabled reasons their own usable space. In short landscape, place art beside content where it saves height. Art cropping may change; required copy must not be cropped.
- **State communication:** retain the opaque Spin face, visible charge and associated disabled reason. Keep speed state explicit and preserve existing finite autoplay and purchase confirmations. Keep feature counters readable without moving the reel rectangle.

These decisions are the team's interpretation of the references and Kilo's constraints. They are not claims that the finished page is visually equivalent to a provider game.

## Integration boundaries and follow-up requirements

**Amounts and cost.** Official RGS money values use six-decimal integer representation; displayed currency may use prefixes, suffixes and differing precision. Very small wins can require three or four displayed decimals. The documented debit is base bet multiplied by the mode's cost multiplier. [3] Keep the current sandbox charge math and limits unchanged. A future RGS adapter must supply correctly formatted values to every well, price and completion total; a layout pass cannot certify that adapter.

**Jurisdiction.** The official SDK authentication example includes `disabledTurbo`, `disabledSuperTurbo`, `disabledAutoplay`, `disabledSlamstop`, `disabledSpacebar`, `disabledBuyFeature`, `disabledFullscreen`, additional display flags and `minimumRoundDuration`. [4] Kilo's current control interface covers Turbo, Autoplay and Buy restrictions plus its own Ante flag. Full authentication-driven coverage, keyboard/skip enforcement, required session readouts and timing constraints need a separate integration review. Hiding a button is not by itself complete enforcement.

**Rules, audio and assets.** Preserve the rules/paytable entry and sound controls. Verify actual mute behavior, all published mode descriptions, RTP/max-win disclosures, and exact symbol/value lists against the eventual approved game configuration. Local font files are already declared in the sandbox; serving them correctly from the final versioned Engine asset location remains a publication concern, separate from this private preview.

**Verification limits.** This pass's CSS, markup, geometry and build checks are source-derived. They do not substitute for live browser tests of resize during a feature, keyboard/touch interactions, modal focus, actual font rendering, mobile browser chrome, audio or asset loading. No live screenshots or visual-equivalence certification are claimed in this memo. Preserve the engine, wallet, settlement, collection sequence, hook continuity and existing purchase charge behavior.

## Primary sources

All sources were retrieved or inspected on **17 October 2026**. The pages and PDF game sheets below do not provide a reliable publication date in the retrieved material; retrieval dates are not publication dates.

1. Stake Engine, **Frontend and Communication** (official guideline; search-indexed content retrieved, direct page is client-rendered): https://stake-engine.com/docs/approval-guidelines/front-end-communication
2. Stake Engine's official `engineio/docs` repository, **RGS Requirements** source: https://github.com/engineio/docs/blob/main/src/routes/docs/approval/rgs-requirements/%2Bpage.svx
3. Stake Engine, **RGS Details** (official money, currency and mode-cost specification): https://stake-engine.com/docs/rgs
4. Stake Engine's official `engineio/web-sdk` repository, **Authenticate.svelte**: https://github.com/engineio/web-sdk/blob/main/packages/components-shared/src/components/Authenticate.svelte
5. Nolimit City, **Home of the Brave**, official game sheet, page 6: https://fan-cdn.nolimitcity.com/Nolimit_City_Game_sheet_Slots_Home_Of_The_Brave_09264_c6a7dd0a55.pdf
6. Nolimit City, **True Kult**, official game sheet, page 5: https://fan-cdn.nolimitcity.com/Nolimit_City_Game_sheet_Slots_True_Kult_b08592029b.pdf
7. Valkyrie Studio, **Loki's Vault**, official game page: https://valkyriestudio.gg/game/lokis-vault
8. Valkyrie Studio, **Waylanders Forge**, official game page: https://valkyriestudio.gg/game/waylanders-forge

The official guidelines and SDK are the authority for integration requirements. Provider screenshots inform composition. Neither a provider-inspired layout nor this memo constitutes Engine approval.
