**Kilo King v51 — playable feature modes and 25,000× overall maximum**

Built from local v50 checkpoint `19139a63c0aad03571ed81aa83e96a5ccb8f1e04`. This is a local source delivery. It has not been deployed or pushed; the private preview has not changed.

The four purchases now run complete generated rounds through the actual game director and Pixi stage. They are available from the normal feature purchase flow. The old `?featureLab=v50` remains a historical fixed-event study; it is not the implementation delivered here. No new control-bar or reel-layout redesign is included.

| Mode | Implemented rule | Purchase | Maximum payout |
| --- | --- | ---: | ---: |
| Base / Ante | Existing lines and two-scatter hook/respin, plus an occasional single collector gathering visible cargo once | 1× / 1.5× | 25,000× base bet |
| 3 scatters — Dockside Catch | 10 spins; collect-all loop; four-collector milestones award 10 spins at ×2, ×3 and ×10; one marked package survives exactly one additional spin | 100× | 25,000× base bet |
| 4 scatters — Yacht Stash | 15 spins; cargo locks into 12 holds; captain dispatches the whole load once; every two shipments raises future cargo floors from 2× to 5× to 10×; final cargo is dispatched | 200× | 18,000× base bet |
| 5 scatters — Chopper Route | 20 spins; pick up one column at a time; successful pickups raise the route multiplier to ×5; deliver and reset after the fifth column | 250× | 25,000× base bet |
| God Mode — The Getaway | Load three cases; three checkpoints each double a recorded case, including repeat selections; extract at ×2, ×4, ×8, ×12, ×20 or ×50 | 1,000× | 25,000× base bet |

All progression belongs to one paid round. Cargo, route progress, cases and collector milestones reset before the next independent bet. Yacht, Route and Getaway pay cargo awards rather than ordinary-symbol lines. Mystery remains unavailable; no purchase is implied.

**Maximum-win correction**

The obsolete LGC 5,000,000 currency ceiling is removed from newly generated rounds. The overall maximum is now **25,000 times the base bet**, not 25,000 times the purchase price. A 1,000 base bet therefore permits a 25,000,000 overall payout. The amount scales with the base bet.

Yacht's actual bound is 15 dispatches × 12 holds × 100× cargo = 18,000×. Its rules disclose this separate maximum rather than advertising an unreachable 25,000×. The other purchased modes can reach 25,000×. The Getaway can also return less than its purchase price; buying it does not guarantee the cap.

The legacy generator retains its historical cap solely for old-version regression comparisons. The normal play path exclusively calls the v3 generator. Saved historical outcomes and the accepted 48,000 collection recording are not rewritten.

The remaining 1,000,000 sandbox charge limit and local bet list are unchanged. They are local sandbox constraints, not statements of Stake Engine limits. A real integration must take supported bet levels and currency limits from RGS authentication.

**Presentation and accounting**

- Local win amounts now accrue over the winning connection. They use recorded line awards, a board-clamped anchor and a brief readable hold. The global WIN update follows the existing line-start callback, with no second credit.
- Marked cargo stays registered to its reel cell, retains its ID and printed value, and expires after one extra spin. The existing collector presentation handles any resulting collection.
- Yacht holds remain visible during reel motion. New cargo gathers into one shipment; pending cargo is separate from credited WIN.
- Route pickups use the active column, cable and cargo travel. Off-route cells recede while the pickup resolves. Money is credited only when the route delivers.
- Getaway uses a new six-pose case atlas for loading/opening, three board-registered cases and checkpoint/value updates. Extraction shows the raw amount and the credited cap separately, then transfers once to the readout.
- New bonus entry copy describes the actual mode. The Getaway is introduced as three cases and three checkpoints, not five free spins. Explicit entry state drives the overlay.
- New effects consume an immutable result record. They contain no outcome RNG and no wallet writes. A complete result is generated before the existing local debit. Settlement still credits the saved return once; replay does not re-credit.
- Routine fisherman motion retains the quieter v50 policy. Existing symbol artwork, sizes, control positions, reel geometry and hook functions remain unchanged.

The supplied Last Harvest recording around eight seconds informed the local connection focus and accruing number: dim inactive cells, identify the winning group, let the amount build at that group, then resolve. This is an original implementation using Kilo's existing art, not copied provider assets or a claim about a provider's internal technology.

**Math evidence**

Raising the maximum without changing the candidate weights would have increased Getaway's return above 100%. The candidate distribution was recalibrated, retaining all declared values, prices and mechanics.

`art/kilo-features-v51/feature-math-analysis.json` contains:

- Exhaustive enumeration of all 20,250 Getaway starting-value, checkpoint-target and extraction combinations, each checked against the production generator. The model gives 95.5% expected return and a 25,000× probability of about 1 in 43,751 buys. These are model calculations, not an operator certificate.
- An exact finite expected-value calculation for Yacht, including held-cargo count, dispatches, quality floors and final shipment: 95.5% for the current candidate.
- A Route expected-value calculation with a bound on the ordinary distribution's extremely small cap adjustment; the current candidate is effectively 95.5% to displayed precision.
- Yacht and Route each select a rare full-load outcome with probability 1 in 100,000 paid features. It follows the ordinary mechanics using the existing 100× packages. The standard outcome weights compensate for its contribution. This is a fixed outcome mixture; it does not depend on identity, balance, play history or animation timing.

`simulation.json` records seeded Monte Carlo results for the final source, including uncertainty, return distribution, feature frequency and cap rate. Dockside Catch is tested over one million purchases; base and Ante over one million each; other purchases over 100,000 each. An additional 50,000 paired low/high-stake outcomes per mode checks exact bet scaling. Base and Ante remain high-variance estimates; these runs are not sufficient to certify their RTP or prove agreement to a narrow tolerance.

| Mode | Rounds | Estimated return | Approx. 95% interval |
| --- | ---: | ---: | ---: |
| spin | 1,000,000 | 93.518% | 86.230%–100.806% |
| ante | 1,000,000 | 97.145% | 89.184%–105.106% |
| buy | 1,000,000 | 95.562% | 94.704%–96.421% |
| yacht | 100,000 | 95.385% | 95.094%–95.675% |
| chopper | 100,000 | 95.634% | 95.275%–95.994% |
| getaway | 100,000 | 95.583% | 94.909%–96.257% |

The 300,000 paired outcomes had identical return multipliers at the tested low and high stakes. Sample intervals are approximate and especially unstable for rare extreme base outcomes. The base/Ante estimates do not establish production RTP compliance.

Stake Engine publication requires weighted outcome books and payout lookup tables, authoritative RGS outcomes and the corresponding configuration. This delivery is a functioning local sandbox generator and renderer, not an approved real-money integration. The Info page continues to identify unverified published RTP rather than presenting Monte Carlo estimates as certified values.

**Verification**

| Check | Result |
| --- | --- |
| TypeScript and production review build | Passed |
| Existing saved-round presentation regression | 216 fixture/speed/Skip cases passed |
| Accepted collector renderer control flow | 96 exact/capped cases passed, including two 24,000 subtotals, combined 48,000, transfer, retrigger thresholds, all speeds, reduced motion and resize in both directions |
| Line-start WIN accounting | 15 cases passed, including 0 → 200 → 400, duplicate focus and capped awards |
| Generated feature logic and accounting | 1,716,349 assertions; 18,000 generated rounds plus 12,000 low/high-stake comparison rounds; 456 director presentations |
| New production effects | 8,640 sequences; 1,836 injected resizes and 1,836 interruptions; maximum 50,000,000 raw / 25,000,000 credited extraction included |
| Viewports in effect geometry checks | 1440×900, 390×844, 360×800 and 844×390 |
| Purchase and rules markup | 12 actual SSR confirmation states, four entry modes, valid/insufficient/over-limit checks, jurisdiction-hidden purchases |
| Protected source | Bank, stage/control geometry, control CSS and accepted hook/collection functions checked against the checkpoint |

The effect and collection tests execute production code with instrumented Pixi display objects and a controlled clock. They check amounts, sequence, cancellation, cleanup and geometry. They do **not** render GPU pixels, measure actual frame rate or prove live font fitting. Node audio-context warnings are expected in this harness and are not audio playback verification.

Source checks ran on Node 24.19.0. Run `npm ci`, `npm run typecheck:kilo`, `npm run test:kilo`, `npm run test:kilo:features`, `npm run simulate:kilo:features`, and `npm run build:review` to reproduce the source checks and outputs.

**Remaining limitations**

The supported browser capability is unavailable in this environment. Following the Sites skill, no substitute browser was installed or used. The requested live normal-speed clip and real-device visual verification could not be produced. No claim of pixel-perfect animation is made.

The new case atlas is an authored six-pose action with a small amount of pose/perspective variation. It is not a continuous skeletal rig. Yacht loading and Chopper pickup are now event-driven stage effects, but the complete physical yacht/aircraft environment is not a newly authored cinematic rig. The existing scene plates and sound bed remain; a dedicated sound mix and GPU visual pass are still needed before claiming reference-game production quality.

The production build reports a roughly 544 kB main chunk. Browser loading, frame pacing, long-amount fitting and actual device performance remain unmeasured. Stake Engine RGS authentication/play/replay, weighted math-book publication and final approval remain outside this local sandbox delivery.

**Primary references**

- Stake Engine approval/stateless rounds: https://github.com/engineio/docs/blob/main/src/routes/docs/approval/%2Bpage.svx
- Stake Engine maximum per bet mode / Win Manager: https://stake-engine.com/docs/math/source-files/win-manager
- Stake Engine game format and authoritative outcome books: https://stake-engine.com/docs/math
- Stake Engine frontend/rules requirements: https://stake-engine.com/docs/approval-guidelines/front-end-communication
- Stake Engine RGS bet-level requirements: https://github.com/engineio/docs/blob/main/src/routes/docs/approval/rgs-requirements/%2Bpage.svx
- Pragmatic Play, Big Bass Splash: https://www.pragmaticplay.com/en/games/big-bass-splash/
- Pragmatic Play, Big Bass Blast: https://www.pragmaticplay.com/en/games/big-bass-blast/
- Valkyrie Studio, Waylanders Forge: https://valkyriestudio.gg/game/waylanders-forge
- NoLimit City, xWays Hoarder: https://nolimitcity.com/games/xways-hoarder

The earlier research and timestamped observations are retained in `art/kilo-design-v50/RESEARCH-AND-DESIGN.md`. The source package includes the new asset source, export script, atlas manifest and asset-only PNG/GIF proof. Those proofs are not gameplay recordings.
