# Modular slot controls

Standalone React presentation components, without engine, wallet, charge calculation
or game-specific artwork. Copy the directory into another React slot; the host
supplies formatted state and existing action callbacks. Theme colors and icon
nodes are the visual customization inputs. Dependencies: React and lucide-react.
Bundled font licenses are in `fonts/`.

## Current contract (v39 local)

- `SlotControls` renders utilities, one Balance/Win card, a compact Bet price
  plate and primary/secondary actions. Auto joins Spin on desktop/landscape;
  portrait uses an independent circle in its secondary group. There is no Ante
  control in the dock.
- `createControlLayout` owns the desktop, portrait, landscape and compact
  rectangles. It never scales or computes the reels.
- `CONTROL_TOKENS` defines target sizes, spacing and edges. Targets are at least
  44px. Spin is 128px wide desktop, 100px smaller desktop, 96px on the requested phones/landscape, 80px in
  narrower portrait fallbacks and 64px in compact popouts.
- `state.bet` is the formatted base bet. Optional `state.wager` is the host's
  already-calculated actual wager; it is displayed when supplied. No price math
  lives in this module. The Bet dialog still edits the base bet.
- `state.ante` identifies the current mode for accessible Bet descriptions.
  The host owns the Ante toggle on its Features page. There is no `actions.ante`.
- Spin has a large curved-arrow icon, or the existing Skip/Stop icon while busy
  or running Auto. `state.charge` and `state.spinDisabledReason` remain connected
  using `aria-describedby`, but are visually hidden. The disabled reason is also
  the button's native title. `state.spinDisabled` still prevents action.
- Auto opens the existing finite-count confirmation and stops existing Auto when
  already active. Portrait has neither the shared plate nor the shifted Auto ink.
- The readout face is Source Sans 3 Bold (700), fixed at 24px wide desktop,
  22px smaller desktop, 20px landscape and 18px portrait/compact. Amount length
  never reduces type. Labels are 14px on portrait/desktop/landscape.
- Oversized Balance/Win values use a read-only native text input retaining the
  full exact amount. Horizontal text navigation is needed when a number is wider
  than its fixed well. There are no abbreviations or ellipses.
- `ControlJurisdiction` supports `disabledTurbo`, `disabledAutoplay`,
  `disabledBuyFeature`, `disabledAnte` and optional `restrictedPresentation`.
  The default hides restricted actions. Disabled presentation keeps its edge and
  exposes a reason on focus/hover. Host handlers must enforce the same flags.

## Composition

Desktop retains Turbo → Menu → Balance/Win → Bet → Auto/Spin → Buy. Balance and
Win share a single recessed surface. Their original content rectangles and win
landing anchors are unchanged. Bet's visible plate is 88px high on wide desktop
and 64px in the smaller layout; its 44px chevron targets retain their positions.
On the 64px plate, the targets extend 12px above/below while the chevron ink
remains inside it.

Portrait retains the 160px allocation. Balance/Win occupy one full-width upper
card. The 112×64px Bet plate stays left of a centered 96px Spin. The four secondary
44px circles form a 2×2 group on the right: Auto/Buy, then Turbo/Menu. At 360×800
and 390×844, there are 8px between Bet and Spin, 16px between Spin and the group,
and 12px gaps between both columns and rows. Auto has its own near-black face and
2px rim; no plate connects it to Spin. The base controls end 4px before the dock
bottom. The host's 16px reel-to-dock clearance includes 14px of cabinet paint and
2px clear space. The pier ends with this allocation, without a lower overhang.

Short landscape retains readouts and Bet left, Auto/Spin/Turbo right. Auto joins
Spin vertically. Compact popouts keep Auto and Turbo in Menu. Ante always stays
on the host Features page.

Feature mode replaces Bet with the existing free-spin counter and hides Auto/Buy.
Portrait Turbo/Menu form one centered row beside Spin. Balance, Win and Spin
retain their base positions; the free-spin counter replaces Bet in its same well.
The host owns the bonus
header and all transitions. `spinRef` retains guarded keyboard shortcuts;
`bonusAnchorClassName` retains the win-flight destination after resize.

## Material

Opaque near-black faces, warm-white figures and a hard 3px Spin rim. Separate utility/Buy rims are 2px. Auto's shared plate supplies
its material on desktop/landscape. There its icon and A move together to the
center of the plate's exposed section without moving the hit target. Portrait
Auto centers both inside its independent circle. Ordinary icons use 3px strokes;
the large curved Spin arrow uses 5px. Skip/Stop use 3.5px. Disabled faces keep full
opacity and readable icons.

A contained clearcoat catches a little light above the opaque desktop/landscape base. The maximum
sheen alpha is approximately 7%, with sharp inset reflections at approximately
15%. It has no blur, input behavior or extra bounds. Theme properties
`glassHighlight` and `glassEdge` can retint or remove it. The strong edge remains
outside the subtle sheen. Hover/press feedback does not translate hit targets.
Portrait disables these pseudo-elements entirely: solid fills, no gradient or blur.

## Menu integration

Optional `menuRef` anchors the host popup to the real Menu target. `menuPopupId`
links the trigger to that popup; `state.menuOpen` switches the hamburger to X and
sets `aria-expanded`. None of these change the control rectangle. Kilo's host
renders the small Info / Music / Sound popup. Speed/motion live under Info → Game
settings. Auto opens the full-screen finite-count confirmation.

## Verification

Run `npm run typecheck:kilo`, `npm run build`, then
`node scripts/verify-portrait-v39.mjs`. The v39 inspection resolves production CSS
against server-rendered controls for each speed, disabled, active Auto and feature
states. It checks the 2×2 group, both hit and painted bounds (including badges),
18px amounts/14px labels, solid circles, cabinet clearance, trimmed pier and
unchanged 44px targets/160px allocation. Desktop/landscape dimensions are compared
with v38. See `public/kilo-portrait-v39/VERIFICATION.md` and `check.json`.

Older versioned verification scripts and reports describe their historical
checkpoints; their immutable-source expectations do not apply to later passes.
No browser screenshots or live interaction checks were attempted. Final
rasterization and device gestures remain for live review.
