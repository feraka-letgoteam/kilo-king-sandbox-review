# Kilo King v58 — inward character, VS reels and activated Max Spins

Checkpoint: `4e910c2382daba98f460dbea72d0ce4bbf632654` (published v57). This pass updates the existing owner-private preview. It does not publish a public site or change the engine's outcomes, prices or caps.

## What changed

### King at the stage

A new coherent full-body illustration matches the orange vest, navy beanie, dark fishing clothes and crown chain in the supplied screenshot. He stands on the right facing left toward the reels. His body is registered by its center and planted boot baseline, rather than by the protruding fishing rod.

The old disconnected upper-body rig is replaced for the base-stage character. A continuous Canvas deformation gives the chest a restrained breathing cycle while the legs, feet and ground contact stay fixed. Registered eyelid drawings and an occasional eyebrow reaction preserve the original face outline. Only an earned celebration can trigger a short nod; ordinary base spins do not restart or exaggerate the performance. The loop pauses for menus, offscreen/hidden states and reduced motion. This is coherent artwork with local deformation and authored facial states, not a complete articulated character rig or a frame-by-frame fishing sequence.

### Four-scatter Yacht Stash

New King and Vice challenge/winner illustrations replace the small cutout rigs on the reels. A landed VS expands into two large opposing portraits with the two recorded multipliers. A short strike and an opaque wipe reveal the recorded winner as a full-reel wild. The winner and its multiplier remain for every remaining spin, including spins with no payout. The settled illustration fills the upper portion of the reel, above a clear multiplier/WILD well. The wipe avoids double-exposed faces.

This remains the existing pure VS feature. No Big Bass cash collection is added. Existing additive wild multipliers, ×2–×10 candidates, free-spin count, odds and payout profile are unchanged. Legacy saved records remain supported.

### Max Spins — The Getaway

The reference video shows an activated paid-spin mode, not a free-spin feature with an entry and completion ceremony. The feature deck now offers Activate, followed by an explicit per-spin warning and confirmation. Activation and Exit do not charge or request an outcome. Each manual press of Spin uses the existing 1,000× charge, existing purchase limit and existing 0-or-25,000× outcome. The mode remains active between attempts and has a visible Exit control and per-spin cost. Autoplay is unavailable in this mode.

There is exactly one reel spin per attempt. The larger speedboat now travels left to right during that spin. A recorded maximum stops fully inside the board and presents the amount; a loss travels offscreen and returns directly to the next manual Spin. No free-spin header, bonus-entry ceremony or completion dialog interrupts this flow. The saved-round and credit paths remain intact.

### Full-screen feature deck

The feature takeover uses a quiet gray/blurred backdrop, large illustrated card heads, native Catch / VS / Max lettering, short descriptions, live prices and clear Buy / Activate actions. Ante is a separate Bonus chance banner. The hidden five-scatter Chopper feature is not offered for purchase.

Desktop uses three equal cards. Portrait uses two cards above a wide Max card. Short landscape places Bonus chance beside the cards. Existing base-bet controls remain at the bottom. The selected feature retains its explicit confirmation. Required disabled reasons wrap instead of clipping. The accepted game control bar and its 160px portrait allocation are unchanged.

## Reference evidence

- User screenshot: `Screenshot 2026-10-18 at 11.32.48 AM.png` — the supplied King appearance, palette and character proportions.
- User recording: `Screen Recording 2026-10-18 at 10.15.12 AM(2).mov` — Ganja Snail's illustrated feature deck and repeatable Max activation flow; inspected as extracted frames.
- User recording: `Screen Recording 2026-10-18 at 11.34.22 AM.mov` — existing Kilo behavior and composition.
- Hacksaw official Duel at Dawn: https://www.hacksawgaming.com/games/duel-at-dawn — opposing VS candidates, expanding winning reel and additive wild multipliers. Kilo retains its own sticky rule and math; no claim is made about matching Hacksaw's odds or implementation.
- Stake's Ganja Snail listing: https://stake.com/casino/games/donutgaming-ganja-snail — Max Spin mode. Kilo does not import the reference game's purchase price or maximum payout.

## Verification

All figures below refer to source or instrumented production checks, not live-browser claims.

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| Existing math / director | 1,603,775 invariants across 6,000 features; 108 Skip/speed sequences |
| Production reel-effect control flow | 1,296 sequences, 276 resizes, 276 interruptions across 1440×900, 390×844, 360×800 and 844×390 |
| Motion / artwork bounds | 1,764 assertions and 12 Max result/transfer resize cases |
| Feature artwork binding / protected source | 96 entry/result cases |
| Existing collection | 96 exact/capped cases, all speeds, reduced motion, bidirectional resize and Skip |
| Existing presentation | 216 recorded fixture/Skip/speed cases |
| Character | 3,001 sampled body states, actual React/Canvas effect lifecycle, fixed feet, no folded strips, four viewport registrations |
| Max activation and payment | Actual confirmation closure, activation/exit with wallet spies, two explicit paid spins, duplicate/invalid guards, 12 concurrent one-spin presentations |
| Feature deck | React markup, required copy, purchase eligibility and 12 font-based responsive budgets including phone safe areas |
| Audio | 8 resources, 32 cues, retry and reduced-motion behavior |

The new tests are wired into the package scripts. Detailed reports are under `art/kilo-v58/`. Engine, bank, charge calculation, reel geometry, collection implementation, hooks and accepted controls are compared with the checkpoint or their original protected declarations.

## Inspectable animation proofs

`art/kilo-v58/proofs/character-life.mp4` uses the exact production Canvas painter. The VS and Max videos use recorded production display lists rendered through a native Canvas adapter at 64px and 156px symbol sizes. Both Max outcomes are included. These files are offline animation proofs, not browser screenshots, WebGL captures or recordings of a live game.

The proof review caught two visual issues before release: empty space below the settled VS portrait and ghosted faces during the winner crossfade. The portrait crop was enlarged and the crossfade replaced with an opaque wipe.

## Remaining limits

Live browser automation is unavailable in this environment. Actual phone GPU rendering, browser font rasterization and end-to-end click/touch interaction still need visual review in the private preview. The source-derived phone budgets fit the requested viewports, but they are not a substitute for that review. The character is not a complete body rig. The VS artwork supplies separate challenge/winner poses, not a fully articulated combat sequence. The boat keeps the existing authored eight-frame art; this pass changes its size, timing and paid-spin behavior. Symbols, background assets and accepted controls were not overhauled in this pass. The build retains its existing advisory about a JavaScript chunk over 500 kB.
