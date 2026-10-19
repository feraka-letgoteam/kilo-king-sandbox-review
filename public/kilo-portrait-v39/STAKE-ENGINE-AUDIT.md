# Kilo King — tall-phone composition and Stake Engine audit

2026-10-18. Source: the latest local v39 portrait correction, based on `de4abe70aa06d32feac8bdfa3c80be1c18ee016c`. This is a source/layout audit, not Stake approval or live-device certification.

## Why there is background below the game

The phone layout is constrained by available width. Its height is 104px of header, the existing reel height, 16px of cabinet clearance, and the fixed 160px controls. A taller screen does not make the reel cells taller. The stage already uses the available dynamic viewport and safe-area insets; the animated marina fills it independently of the cabinet.

| Viewport | Reel dimensions | Complete game height | Background below game, normal preview | With 44px review toolbar |
|---|---|---|---|---|
| 360×800 | 336×202.4 | 482.4 | 305.6 | 261.6 |
| 390×844 | 366×220.5 | 500.5 | 331.5 | 287.5 |
| 412×915 | 388×233.7 | 513.7 | 389.3 | 345.3 |
| 430×932 | 406×244.6 | 524.6 | 395.4 | 351.4 |

CSS pixels; these rows assume zero device safe-area inset. The accompanying JSON also checks a 47px top and 34px bottom inset. Background below the game includes the bottom viewport padding.

There is only 4px of unused space inside the base control allocation. Moving Auto or adding dock padding cannot solve the much larger space outside the cabinet.

## Layout decision

Publish the verified v39 portrait regrouping. Keep the reels and controls together, with the existing top anchoring. Do not stretch the game, enlarge symbols, expand the dock, or move Spin down into a separate bottom rail merely to fill the screen.

For a fuller future tall-phone composition, make the **environment** responsive: author a portrait foreground/crop that uses the lower area as marina scenery. The current backdrop already uses `cover`, a portrait focal point, and viewport-sized animation. Additional portrait artwork is an art-direction task, not a missing CSS height setting. It has not been produced in this pass.

Removing every remaining pixel of background would require relaxing at least one accepted constraint: reel proportions, stage position, the compact connection between reels and controls, or the 160px dock. Full vertical centering would redistribute the space above the stage and reintroduce the large headroom previously rejected.

## Requirements and current evidence

The public frontend guidance requires an undistorted game frame, usable common mobile and mini-player layouts, clear rules/paytables and mode costs, sound controls, and confirmation before autoplay. It also calls for disclosed RTP and maximum win, supported bet levels/currencies, and consistent win presentation. The current indexed guidance says the game should fit its frame without scrolling and prevent double-tap zoom. I found no mandated portrait height, bar arrangement, 160px allocation, 44px target specification, or requirement to eliminate visible background. Our 160px/44px values are project design constraints. [Frontend guidance](https://stake-engine.com/docs/approval-guidelines/front-end-communication)

| Area | Evidence in this build | Remaining work before submission |
|---|---|---|
| Mobile fit | Width-based reels, dynamic viewport, safe-area padding. 28 tall-phone/toolbar/inset cases fit; base and feature share geometry. | Device/browser, mini-player, short-height and rotation checks in the operator frame. Source calculations do not establish actual browser rendering. |
| Controls | 160px portrait allocation, ≥44px targets; a separate Speed control; connected Balance/Win; finite Auto confirmation. | Real gesture/focus checks. Controls use `touch-action: manipulation`; whole-surface double-tap behavior remains unverified. |
| Rules and prices | Info includes paytable, feature triggers, mode costs and maximum payout; Ante remains on Features. Existing purchase guards are preserved. | Validate every displayed rule and amount against the production math and all supported bet levels. |
| RTP | Info explicitly says theoretical RTP is not verified. | Supply verified per-mode figures. Do not promote the sandbox estimates to theoretical RTP. |
| RGS and restrictions | Local test bank; control restriction flags are available as component inputs. | Connect authentication, server bet levels, balance, play/settlement, resume/error handling and returned jurisdiction settings. |
| Replay | A review route exists; it simply mounts the test game. | Implement RGS event replay, hide betting during replay, and provide review event IDs for every mode. |
| Currency/localization | Current amounts use sandbox credits and English formatting. | Validate production currencies, precision, translations and applicable social/jurisdiction rules. |
| Assets/performance | Static build; locally bundled fonts/artwork; viewport-sized marina animation with reduced-motion support. | Engine CDN packaging, loading/memory/audio checks on devices, and originality/licensing review. |

Engine's approval process separately covers math, frontend quality, RGS integration, jurisdiction compliance and replay. Passing this layout check does not satisfy the complete process. [Official approval documentation source](https://github.com/engineio/docs/blob/main/src/routes/docs/approval/%2Bpage.svx)

The official API defines authentication, play and end-round settlement plus replay retrieval. The current sandbox bank intentionally makes no network wallet calls, so this is a concrete integration gap rather than a styling issue. [Official API methods](https://github.com/engineio/docs/blob/main/src/routes/docs/api/%2Bpage.svx)

Bet replay is mandatory in the official replay documentation. It must reproduce the recorded result, work without a player session, and prevent new bets during playback. The present review route is not that implementation. [Official replay requirements](https://github.com/engineio/docs/blob/main/src/routes/docs/api/bet-replay/%2Bpage.svx)

The production rules must also cover the required game-operation disclosures. Existing sandbox language must be reviewed when an actual RGS is connected. [Game disclaimer](https://stake-engine.com/docs/approval-guidelines/general-disclaimer)

## Verification and publication scope

- Existing v39 checks: TypeScript/build passed; 83 rendered React states, 35 production CSS checks, painted bounds and click targets checked; desktop/landscape geometry unchanged.
- Added tall-phone checks: 360×800, 390×844, 393×852, 412×915, 430×932, 360×960 and 390×1200; review toolbar on/off; zero/notched safe-area scenarios. 28 combinations and 56 base/feature layouts pass. No calculated overlaps or viewport overflow in these cases.
- No new gameplay, wallet, settlement, charge, reel, hook or collection changes. No additional UI geometry change was made for this audit.
- No browser automation, screenshots or live interaction checks. The geometry results are calculated from production CSS and the real layout functions, not browser-computed bounds.
- The unused lower background remains visible. This publication includes the corrected control grouping and removal of the extra painted shelf; it does not claim a new full-height portrait art composition.

Reproduce the new check with `node --experimental-strip-types scripts/audit-tall-phone-v39.mjs` after the production build. Detailed dimensions: `tall-phone-check.json`. Existing control verification: `VERIFICATION.md` and `check.json`.

Public documentation was researched on 2026-10-18. Some documentation pages expose only a JavaScript shell to retrieval; indexed official text and the official documentation repository were used where available. Confirm the current submission checklist in the Engine dashboard before submission.
