# Kilo King v52 — reel feature overhaul

Historical v52 handoff. These changes are included in v53; see `V53-REVIEW.md` for the current presentation and verification record. Deployment statements below describe the original v52 handoff.

Local source checkpoint: v51 `3bfbb66162758baec1ebc4106b777da6b9f9ac02`.

**Implemented locally. Not deployed or pushed. Live browser screenshots and visual acceptance remain outstanding.**

## What changed

| Feature | Actual round behavior | Presentation |
| --- | --- | --- |
| Yacht Stash / four scatters | 15 free spins. An opening ×2 VS on one of the three rightmost reels; subsequent VS reels use ×2–×10. Each VS consumes its own cash once and remains a full-reel wild. Participating reel multipliers add on a winning payline. Ordinary fishermen collect non-VS cash using the existing collection renderer. Remaining locks pay at the end. | A short VS reveal, six-pose fisherman pull, local cash amount and a settled wild with its multiplier. Cash and wild state remain visible on the existing board. |
| Chopper Route / five scatters | Trigger-only; no purchase card or callable paid Chopper entry. 20 free spins with five-or-more orthogonal matching clusters. Cash locks survive spins and gravity. The first four drops establish locks; later drops add to those packages. Global and position multipliers grow, capped at ×128. Final cash uses the greater applicable multiplier. | Aircraft enters, drops cash, boosts state and exits. Winning symbols break, new symbols drop through clipped segments around locks, multiplier marks update after resolution. Local amounts precede win-meter updates. |
| God Mode / The Getaway | Existing 1,000× price. Exactly one result: 25,000× base bet or zero. No partial line win, free-spin sequence, secondary gamble or board-building stage. | One actual reel spin, short hold, clear on-reel max-win or no-win result. Purchase warning: “1 spin. Max win or nothing.” |

All three new paths emit immutable version-4 round records through the normal play flow. They are not fixed-event-only demonstrations. Saved version-3 rounds still use the original director. The review fixtures are additional reproducible examples of these real generators.

The entry banner lasts at most 1.1 seconds at normal speed. The existing board remains in place. A small completion panel sits inside its lower edge and reanchors on resize. Advanced-feature backgrounds use a dimmed, paused base environment rather than new illustrated replacement scenes.

The purchase gallery is now three cards on an opaque gray overlay, with existing cutout artwork, concise copy, live prices, explicit confirmation and full disabled reasons. Ante stays on this page. Chopper has only a five-scatter explanation. Portrait uses compact rows; desktop and short landscape use three columns.

## What stayed protected

The following files are byte-identical to the checkpoint: wallet bank module, stage layout, slot-control layout and tokens, slot-control CSS/component, and Kilo modular-control CSS. Automated source comparisons also preserve the charge function, stake validation, line-hit evaluator, award cap helper, hook respin, Dockside feature generator, reel sizing, original reel spin/tool/collector implementations, and final credit function.

The engine entry point was necessarily updated to select the three new recorded feature generators, reject a purchased Chopper, and avoid a bought trigger spin before Getaway. These are feature changes, not wallet or settlement changes. All money is still debited/credited through the existing host flow. Review replays do not settle.

Existing prices and limits remain: Dock 100×, Yacht 200×, Getaway 1,000×; maximum charge 1,000,000. The Yacht **purchase** retains its existing 18,000× payout ceiling. Natural Yacht remains inside its base/Ante round's 25,000× ceiling. The overall/Getaway maximum remains 25,000× base bet.

## Verification performed

| Check | Result | What this proves |
| --- | --- | --- |
| TypeScript and review build | Passed | Source compiles into the actual review bundle. |
| New feature math | 6,000 generated features; 1,336,483 assertions | Recorded awards, cash ownership, persistent state, cap accounting, connected wins and gravity invariants. |
| New director | 108 speed/Skip sequences | Monotonic display totals, exact final result, immutable records, and one actual Getaway spin. |
| Production effect controller | 1,152 instrumented sequences, 288 resizes, 288 interruptions | Same production controller, actual four viewport geometries, all speeds/reduced motion, cancellation and transfer cleanup. **Not GPU/browser rendering.** |
| Accepted collector | 96 cases | Exact 48,000 sequence and capped case, speeds, reduced motion, resize, Skip and protected source. |
| Purchase UI | 79 SSR/source checks; 12 font-budget cases | Three offers, correct price/disabled state, explicit warning/Ante state, gray scrim, and estimated height budgets using shipped font advances. **Not measured browser boxes.** |
| Asset packaging | 12 checks plus inspected light/dark composites | Alpha, frame registration, dimensions, pivots, finite timing and clean small-size silhouettes. |

The actual commands and JSON results live in `scripts/verify-reel-*-v52.mjs` and `art/kilo-features-v52/`. `npm run test:kilo:features` runs the new feature suite and the protected collector suite. `npm run test:kilo` retains the historical saved-round regression tests. `npm run simulate:kilo:features` runs the distributions separately from functional tests.

The build emits an existing large-chunk warning. Node-only tests emit the expected missing AudioContext warning; they do not establish audio quality or synchronization.

## Math status

The initial VS configuration over-returned at the unchanged 200× price and was rejected. The final additional-VS chance is 0.00215 per eligible reel/spin, with the guaranteed opening ×2 unchanged.

- Yacht: 50,000 purchased rounds, estimated return **95.18%**, approximate 95% interval **93.28–97.07%**.
- Getaway: exact local probability **3.82% max win / 96.18% zero**, giving **95.5%** return at the existing 1,000× charge.
- Chopper: 20,000 triggered features, mean **6.07 cascades** and **2,050.34×** payout. It has no buy RTP because it cannot be purchased.
- The unchanged Dock buy sample returns approximately **95.36%** over 300,000 rounds.
- Base/Ante samples remain statistically noisy: their measured returns are about **106.62% / 105.20%**, with wide approximate intervals. These do **not** validate an acceptable overall RTP. Their existing trigger/charge rules were not retuned in this pass.

These are local generator checks. There is no approved outcome book, certified overall RTP, proven production max-win frequency or completed Stake RGS approval in this handoff. Math publication remains a separate unresolved gate.

## Requested capture matrix

Use the same built source at 1440×900, 390×844, 360×800 and 844×390. Open the existing **Review scenes** panel for deterministic cases. All review controls explicitly avoid balance changes.

| Requested state | Reproducible path | Current evidence |
| --- | --- | --- |
| Base idle | Normal entry | Protected existing source; live capture pending. |
| Feature selection / valid and disabled offers | Buy control; low balance and over-limit base bet | React/source/font-budget checks; live capture pending. |
| Armed purchase | Select Dock, Yacht or Getaway; explicit confirmation before debit | Confirmation SSR checks; live interaction capture pending. |
| Yacht entry, sticky VS, multiplied cash, collection | “Yacht — sticky VS reels and cash” | Recorded production outcome + director/effect tests; live capture pending. |
| Chopper entry, cash drop, multiplier boost and tumble | “Chopper — natural five-scatter round” and “Chopper — multiple cascades” | Actual natural seed 51020 plus production feature records; live capture pending. |
| Getaway entry and both results | “Getaway — 25,000× result” / “Getaway — no win” | Binary math, one-spin director and effect tests; live capture pending. |
| Long completion / capped collection | “Chopper — capped long-amount completion” | 25,000,000 outcome and capped presentation test; live capture pending. |
| Resize during active feature | Resize while any replay runs | Instrumented bidirectional geometry/cleanup tests; actual browser capture pending. |

The supported browser controller is unavailable in this managed environment. The Sites skill disallows substituting an unsupported browser harness here. No preview server was started and no browser screenshots or gameplay video were fabricated. The asset PNG/GIF proofs are labeled as asset proofs, not game captures.

## Remaining visual and acceptance gaps

1. Live mobile overflow, modal text wrapping, focus behavior, on-board amount collisions and sustained GPU frame pacing still require actual browser/device review. Source budgets are not a substitute for this.
2. The six fisherman drawings have small face, costume and boot-width differences. Fixed sole registration and one uniform scale prevent sliding/stretching, but this is not a continuous skeletal rig or a claim of pixel-perfect animation.
3. Chopper's body is illustrated once; its rotors, cargo, flight and exit are independently animated. The rest of the symbol pack is retained; this pass is not another all-symbol repaint.
4. Overall math and Engine approval are not complete, as described above. Do not treat the local build as production-approved.

Reference findings and primary links are in `art/kilo-features-v52/RESEARCH.md`. Asset authoring inputs, registration metadata and inspection proofs are in the same directory. Nothing in this handoff changes the currently deployed private preview.
