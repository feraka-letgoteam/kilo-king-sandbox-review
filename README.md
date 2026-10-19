# Kilo King private review sandbox

This checkout contains the complete sandbox source and local art/font assets.
The current local pass is **v61: one complete VS encounter**. See
[V61-VS-ENCOUNTER.md](V61-VS-ENCOUNTER.md) for the eight-frame Kilo action,
multiplier lock, connected award, synchronized sound and single transfer to WIN.
Desktop and phone clips are in `art/kilo-v61/proofs`. They are offline production
effect renders with a minimal WIN harness, not live browser captures.
This pass is not deployed. The engine, wallet, control bar, reel geometry and
v60 feature distributions are unchanged. The pacing measurements remain in
[V60-PACING-REVIEW.md](V60-PACING-REVIEW.md).

The accepted control layout described below originated in **v34: thinner Spin rim and centered Auto**,
based on `66f30ee02bfa29e550570301ed7a3844b1570103`.
Prepared for the existing owner-only private preview.

Spin now has a 3px brass rim and a restrained dark inset. Its diameter stays the
same. Auto's icon and A are centered within the exposed part of the joined plate
on desktop, portrait and short landscape; its 44×44 hit target stays fixed.

Auto opens a full-screen selector with eight finite choices: 10, 25, 50, 75,
100, 250, 500 and 1,000. The two-row grid, automatic Stop on bonus status and
one Start action replace the larger charge breakdown and long instructions.
One small line retains the actual per-spin charge.

The command-bar Menu opens a 168px-wide Info / Music / Sound popup with 44px
rows and 17px text. Its placement clears the actual control wells, rims and
badges by at least 12px at the four target viewports. Volume sliders open beside
it on wider screens and expand inside it on phones. Info leads to rules/paytable;
Info → Game settings retains speed, reduced motion and compact fallback actions.

Balance and Win share one card without visible currency labels. Bet is a compact
64px-high price plate with plain chevrons. Ante is available only on the Features
page. The Bet readout displays the actual wager when Ante is active; editing still
uses the unchanged base-bet dialog and stake ladder.

Spin shows a large arrow, joined to Auto by a shared dark plate. Its cost and
disabled reason are assistive descriptions rather than visible face text. Native
disabling, Skip and Stop behavior stay intact. Portrait speed controls are in
Menu → Info → Game settings; the Menu badge still shows the current speed. Numeric type is 22px desktop and 20px
portrait/landscape, using Source Sans 3 Bold (700), with 14px labels.

The stage is top-aligned, the desktop control group is capped at 864px, and
mobile panels account for safe areas and scrollable content. Reel geometry,
engine, wallet, settlement, collection sequencing and purchase charges are
preserved.

## Build and source verification

```sh
npm ci
npm run typecheck:kilo
npm run build
```

`dist/` is the private preview's static build. The latest source-derived bounds
and production CSS inspection are in `public/kilo-controls-v34/`. They are not
browser screenshots or live interaction tests. Older versioned verification
scripts retain their original checkpoint expectations.

The research and the distinction between provider design references and actual
Stake Engine requirements are recorded in
[docs/STAKE_LAYOUT_RESEARCH_V26.md](docs/STAKE_LAYOUT_RESEARCH_V26.md).

The screenshot defects and corrections are recorded in
[docs/CABINET_CLEARANCE_V27.md](docs/CABINET_CLEARANCE_V27.md).

The current portrait geometry and its scope are recorded in
[docs/PORTRAIT_SPACING_V28.md](docs/PORTRAIT_SPACING_V28.md).

Current results and verification limits:
[Control verification](public/kilo-controls-v34/VERIFICATION.md).
