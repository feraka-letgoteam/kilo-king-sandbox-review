# v86 — Five-scatter Super Yacht Stash

Checkpoint: `7e6105e6975e6a6a9128eb4f0f13d13d41bf3bab` (v85). Saved source only; no preview deployment.

## Playable feature

- Exactly three scatters still trigger Dockside Catch; exactly four still trigger Yacht Stash. Five now trigger **Super Yacht Stash**.
- Super Yacht awards 15 free spins, subject to the existing maximum-payout stop. Reel one of its **first spin** contains a VS encounter whose **winning multiplier is guaranteed ×25**. Either King or Cop can win that encounter. This is not a guaranteed 25× payout.
- The ×25 remains sticky. Adjacent same-side reels combine using their multiplier product once; opposite sides and non-adjacent reels retain the existing rules. Other VS arrivals, paylines and presentation use the Yacht implementation.
- Super Yacht is available through natural base/Ante scatters or Mystery Bonus. It has no separate direct-buy card. Chopper remains retired.
- Uses the accepted Yacht background, continuous VS art, multiplier typography and encounter choreography. New entry/HUD/rules identify the feature and its guarantee.

## Mystery Bonus candidate

The user did not specify a purchase price or selection odds. These are explicit, proposed sandbox defaults, not approved commercial math:

| Selection | Chance | Feature |
|---|---:|---|
| 3-scatter | 50% | Dockside Catch, 10 spins |
| 4-scatter | 48.7353573% | Yacht Stash, 15 spins |
| 5-scatter | 1.2646427% | Super Yacht Stash, 15 spins, opening reel-one ×25 |

Price: **200× base bet**. Odds appear in confirmation and rules. One confirmation charges once; selecting the awarded bonus never charges again. Existing balance/purchase-limit/jurisdiction guards cover Mystery. Getaway is outside the pool.

The measured Super Yacht mean is 3,966.7468178× base bet over the 12,831 supported weighted VS seeds. Mystery's resulting finite candidate return is approximately 95.5% of cost. Existing direct Dockside, Yacht and Max purchases are unchanged.

Natural five-scatter trigger probability is unchanged: 0.000323% in base and 0.000785% in Ante. A five-scatter carrier now independently chooses a complete Super VS record before the debit; it does not always replay the carrier's one old feature. The base seed and VS seed are recorded. Existing base/Ante carrier support is limited, but the conditional feature has 12,831 outcomes.

Adding ×25 without adjusting weights would have raised base/Ante candidate return to approximately 96.768% / 97.529%. Only the **line-only outcome weights** were rebalanced to retain the existing 95.5% target. Non-five candidate payouts, all other category masses, scatter frequency, collection frequency and Dockside progression are unchanged. These weight changes are intentional, not a claim that all math is unchanged.

Super Yacht is capped at 25,000× including any triggering base award. Mystery-selected regular Yacht retains its 18,000× purchase cap; Dockside retains 25,000×. All figures here describe the local candidate, not certified/published Stake Engine math. Production publication must flatten the conditional book and rerun the Engine acceptance work already identified in the audit.

## Evidence

- `verification/math-and-regressions.json`: all 12,831 Super outcomes checked; 191,333 sticky-state checks; both winners and widths 1–5; 80,002 base/Ante carrier records re-evaluated; 900 existing direct-purchase outcomes compared with v85.
- `verification/presentation.json`: 48 production VS controller cases across desktop/phone, all speeds, reduced motion, Skip and resize. Exact single bank per board award; symbols concealed beneath wilds; products fit their art.
- `verification/full-flow.json`: 24 complete natural/Mystery director paths, including speed, reduced motion, Skip and resize. Exact final payout and cleanup.
- `verification/menu.json`: 12 SSR/font-measured menu-model cases at 360×800, 390×844, 844×390 and 1440×900, including insufficient balance and over-limit prices. Four purchase cards, 44px minimum actions, explicit confirmation and jurisdiction hiding.
- TypeScript and `npm run build` pass. The existing large-bundle warning remains.
- `proof-index.json`: six verified offline clips: entry, opening ×25 encounter and ×25→×250 merge at 1440×900 and 390×844. Clips are silent; production cue timestamps are retained. Frames/manifests accompany them. They execute the production controller and scene in an instrumented CPU renderer with a WIN-target harness, **not a browser/GPU or the complete React UI**.
- Review scenes include “5 scatters — guaranteed opening ×25 on reel 1” and “Mystery Bonus — Super Yacht with ×25 combining.” These saved replays do not affect the balance.

## Preserved and remaining

Wallet debit/credit/settlement bodies, control layout, reel geometry, accepted collection choreography, existing direct-feature outcomes, VS group calculation, Max performance, backgrounds and sound are unchanged. No additional character or art overhaul was performed.

The four-card menu's actual browser layout still needs verification; the box model is not a substitute for a live browser. Mystery economics remain candidate defaults. Existing RGS/publication gaps from the v85 audit remain outside this feature pass.

Reproduce core checks with `node scripts/verify-five-scatter-v86.mjs`, `node scripts/verify-super-vs-renderer-v86.mjs`, `node scripts/verify-super-vs-flow-v86.mjs`, and `node scripts/verify-five-menu-v86.mjs`. Recalibration: `node scripts/calibrate-five-scatter-v86.mjs`. Capture cases use `scripts/render-five-scatter-v86.mjs` with `KILO_PROOF_CASE=entry-super`, `vs-super-opening`, or `vs-super-merge`.
