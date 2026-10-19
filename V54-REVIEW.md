# Kilo King v54 — pure VS and feature presentation

Local branch: `v54-feature-performance`
Starting checkpoint: `9414c58f7b5bbb67e98f55eeb9f64ac950d511a9`
Status: implemented and source-tested; **not deployed**. The private preview has not been updated by this pass.

## What the audit found

The main gap was not the control bar. Several unrelated events used the same generic amount popup, stored cash looked too much like an immediate payout, and the features lacked distinct timing and focus. The character performance was also limited by a six-pose atlas rather than an articulated rig. Darkening the same background heavily for every advanced feature made them feel like overlays.

There was a concrete delivery defect as well: the v53 source, build and deployment archive contained none of the eight audio resources referenced by the sound module. Source-level animation checks had not caught that packaging problem.

Reference clips were reviewed for source-position awards, quiet surrounding symbols, persistent reel state and short actions that settle. The newly supplied reference recordings did not contain audio tracks, so no listening comparison against them was possible. Provider pages used for mechanics research were [Duel at Dawn](https://www.hacksawgaming.com/games/duel-at-dawn) and [Miami Mayhem](https://www.hacksawgaming.com/games/miami-mayhem). [Stake Engine's quality guidance](https://github.com/engineio/docs/blob/main/src/routes/docs/approval/quality/%2Bpage.svx) describes a quality review, not a guarantee that passing code checks establishes studio-level presentation.

## Yacht Stash is now pure VS

- Fifteen free spins; the existing opening ×2 reel remains.
- Every new VS expands into a full wild reel immediately, even when the spin has no payline win.
- The recorded winner and awarded multiplier stay unchanged through every remaining spin. A locked reel cannot reroll or be replaced.
- Kilo King faces an original Miami harbor-police opponent. Both candidate values and the winner come from the recorded outcome, not animation randomness.
- The reveal expands, shows the duel, dismisses the loser and settles into a stable character reel with a visible multiplier. There is no idle symbol loop.
- Wins use the existing ten paylines. Multipliers on participating wild reels add together.
- New Yacht rounds have no cash symbols, no fisherman collection, no held packages and no final cash sweep. Old saved hybrid records remain replayable without changing their recorded results.

The exact activation and persistence rule above is Kilo King's rule, following the user's clarification; it is not presented as an exact copy of either reference game's rules.

## Other feature work

| Area | Change |
|---|---|
| Chopper | Short approach, bank, package drop and exit; package landing shadow; a lock marker distinguishes stored cargo from paid wins. |
| Cascades | Simultaneous amounts at the winning clusters, quieter nonwinning cells, brief symbol fragments and weighted drops. One combined credited transfer follows each cascade. |
| Getaway | Existing custom boat/case art gains a finite wake and contact shadow. Dedicated maximum-win and intercepted result treatments replace the generic popup. Still exactly one spin and a binary recorded result. |
| Entry | Short on-reel banners; normal-speed entry is at most 1.1 seconds. The reel rectangle stays fixed. |
| Background | Controlled, feature-specific color/contrast treatments replace the single heavy dimmer. No new competing illustrated scene. |
| Audio | Original 112 BPM F-minor beds and 32 finite cues. All eight referenced resources are now packaged. Failed loads can retry, and a natural Chopper trigger selects the correct bed. |

New runtime character art is in `public/kilo-features-v54/`. Editable source PNGs, exact image-generation prompts, registration notes and limitations are in `art/kilo-features-v54/`. Audio source generation and verification are reproducible with the scripts listed below.

## Protected behavior

The accepted control layout, reel sizing, header, hook behavior, wallet and settlement code are unchanged. Base and Dockside collection runtime is unchanged. The exact two-collector example still presents 12,000 ×2 →24,000 per collector and 48,000 combined; capped credit remains separate from the raw award. The verification also covers Skip, all three speeds, reduced motion, and resize during collection and transfer.

Yacht outcome generation was intentionally changed to remove the Big Bass component. Its existing 200× purchase charge and limits are unchanged. Removing cash while retaining the previous VS frequency produced a much lower candidate return, so the VS frequency was recalibrated. An independent 300,000-round sample of the final candidate estimated a 95.95% return over the buy price, with an approximate 95% interval of 94.34–97.55%. This is a Monte Carlo estimate, **not certified RTP or an approved Stake Engine outcome book**. Full-game math approval remains outstanding, including the effect on naturally triggered Yacht rounds. Chopper and Getaway outcome math is unchanged.

## Verification

| Check | Result |
|---|---|
| Generated feature records | 6,000 rounds; sticky winner/multiplier, line arithmetic, locks, cap and event-ledger invariants passed. Includes 1,552 VS landings on no-payout spins. |
| Director | 108 speed/Skip sequences passed. |
| Production effect controller | 1,296 sequences, including 276 resizes and 276 interruptions, passed using instrumented display objects and actual layout geometry. |
| Viewports | 1440×900, 390×844, 360×800 and 844×390 represented in the controller checks. |
| Protected collection | 96 exact/capped, speed, reduced-motion, resize and Skip cases passed. |
| Entry/result and asset bindings | 96 cases passed, plus protected source comparisons. |
| UI/source checks | 79 checks and 12 responsive font-budget cases passed. |
| Historical rounds | 216 saved-round cases passed. |
| TypeScript and build | Kilo typecheck and production review build passed. The build still reports its existing large-chunk advisory. |
| Audio/package | All eight resources present; 32 sprite ranges validated; decoded files retain headroom; built bytes match source. |

The effect-controller tests run production sequencing against instrumented display objects. They are **not live browser, GPU, screenshot or video evidence**. Verification JSON and build logs are included under `art/kilo-features-v54/`.

Reproduce with:

```sh
npm run test:kilo:features
npm run test:kilo:art
npm run test:kilo
npm run typecheck:kilo
npm run build
node scripts/verify-audio-v54.mjs --dist
```

Use the game's Review scenes to play `Yacht — pure VS, permanent multiplier reels`, natural five-scatter Chopper, multiple cascades, Getaway maximum/loss and the capped Chopper record. These replays do not alter the balance. The new records are under `public/kilo-features-v54/replays/`.

## Remaining gaps

1. Live desktop/phone playback, visible overlap checks, frame pacing and listening review remain outstanding. This environment has no supported browser automation capability. No normal-speed acceptance clip or live screenshots were produced.
2. The fisherman still has six authored poses with minor drawing variation. The new officer has one pose with runtime choreography. Neither is a fully articulated character rig; this pass does not establish the requested studio-level character performance.
3. Chopper and boat use existing custom cutout art plus bounded runtime motion. They are not comprehensively redrawn frame-by-frame sequences. A wider symbol, environment and character animation overhaul remains additional production work.
4. The original synthesized audio was decoded and numerically checked, but it needs review on phone speakers and headphones, including simultaneous playback levels.
5. The local probability candidate is for sandbox evaluation. An approved outcome book and complete math review are still required before a production release.

No claim of pixel-perfect rendering, production approval or visual parity with the reference studios is made from these tests.
