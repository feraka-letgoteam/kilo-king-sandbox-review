# Kilo King v60 — VS and Chopper pacing

Checkpoint: `516f768` (local v59). **Local source only; not deployed.**

This pass changes the actual Yacht/Chopper outcome generators and their rules,
not just the review fixtures. It retains the current artwork, animation,
controls, reel geometry, collection sequence, hooks, wallet, settlement,
purchase confirmation, prices, payout limits and awarded-spin counts.
Base, Dockside Catch and Max mechanics are unchanged. Natural Yacht/Chopper
entries use the new feature distributions, so this is intentionally a math
change to those two bonuses. Overall base/Ante RTP is not claimed unchanged.

## Measured result

| Metric | v59 baseline | v60 |
| --- | ---: | ---: |
| VS bonuses with only their opening duel | 63.26% | 15.41% |
| Mean VS reels acquired per bonus | 1.432 | 1.940 |
| VS bonuses acquiring at least three reels | 6.04% | 9.07% |
| Median longest run without a new VS | 14 spins | 8 spins |
| Mean Chopper cascades per feature | 6.055 | 14.103 |
| Chopper spins with no cascade | 73.74% | 47.51% |
| Median longest run without a cascade | 7 spins | 3 spins |
| Final cash share of aggregate Chopper payout | 96.63% | 31.37% |

VS baseline: 200,000 production-generator runs, seed 6018913. Final VS
validation: 500,000 runs on withheld seed 98017341, after calibration on
6018913 and 73182061. Chopper: 50,000 runs per version on seed 73182061;
calibration used 6018913. These are simulated local outcomes, not player data.
"Without a new VS" does not mean a losing spin: existing wilds still pay.

## Yacht Stash

- The first spin still guarantees one x2 sticky VS on reel 3, 4 or 5.
- An 82% round-level draw schedules one further duel on a different right-side
  reel, uniformly during spins 5–9. It is not guaranteed. No extra VS appears
  during spins 2–4.
- During spins 10–15, each unlocked reel has a 0.635% conversion chance per
  spin. These later duels can affect any unlocked reel, including reels 1–2.
- All conversions use recorded winners and multipliers. A VS sticks through
  the final spin even when it does not immediately form a winning line.
- The existing x2–x10 multiplier distribution, additive multiplier rule,
  ten paylines, 15 spins, 200x purchase price and 18,000x purchase cap remain.
  Natural entries retain their enclosing round's 25,000x cap.

The late chance was recalibrated after the first large sample showed too low
a return. The final independent sample averages **192.051x base bet** at a
200x price: **96.03% estimated return**, approximate 95% interval
**95.27%–96.78%**. This is consistent with the retained local 95.5% target,
not a certified theoretical RTP. The separate 500,000-run calibration-seed
sample estimates 95.40%. An independent exact state/multiplier-moment model
gives 193.712x before the payout cap; that uncapped figure is not the game's RTP.

This redistributes some award value from rare extreme boards into more
developing bonuses. The median sample payout rises from 26x to 86.8x; the
99th percentile decreases from 3,037x to 1,952.6x. No payout is rescaled or
silently reduced after its symbols are generated.

## Chopper Route

- Each spin selects 10, J or Q as its leading low symbol with 40/40/20 weights.
  The leading weight is 64%; the remaining weights are 15/8/6/4/3, with the
  leading slot swapped into that rank. Refills use the same spin's palette.
  This creates more connected groups without making every spin favor 10.
- Clusters still require five orthogonally connected symbols. Every winning
  cluster pays; no winning board is discarded to hit a target budget.
- The cluster paytable is increased and published directly from the production
  table. Chopper gets its own cash ladder: 0.5x, 1x, 2x, 5x, 10x and 25x,
  weighted 44/48/7/0.8/0.18/0.02. Dockside's cash ladder is untouched.
- Four cash positions still lock. Later drops top them up. Cash cannot join a
  cluster or fall through a tumble, and pays once at feature completion.
- The 20 spins, board/position multiplier rules and x128 ceiling remain.
  Chopper remains available only through five scatters, with no purchase.

The independent sample's mean conditional award is **2,057.750x**, versus
**2,047.983x** before: **+0.48%**, within the 2% budget tolerance set for this
pass. Approximate 95% intervals are 2,049.055x–2,066.445x and
2,043.345x–2,052.620x respectively. Cascades now provide **68.63%** of aggregate
payout. This is a conditional feature-award comparison, not a Chopper buy RTP.

The distribution is broader: the sampled 10th percentile changes from 1,495x
to 886.9x and the 99th percentile from 3,842x to 4,870.4x. The average budget is
similar, but individual awards are not promised to match the old distribution.

## Verification

- TypeScript and the complete static build pass.
- 162,219 pacing/protection assertions, including 10,000 unchanged paid rounds,
  explicit natural Yacht/Chopper entries, and 64 small remaining-cap cases.
- 1,914,501 ledger and mechanic assertions over 6,000 generated features;
  108 director/Skip/speed sequences.
- 1,296 production effect-controller sequences across all four viewport
  geometries; 276 resizes and 276 interruptions.
- 10,000 unchanged Max outcomes/RNG counts, 240 Max strip cases and 12 paid-mode
  director cases. Activation, duplicate confirmation and charges remain intact.
- 96 production collection cases, including the 48,000 two-collector example,
  capped awards, Skip, all speeds, reduced motion and resize during gather/transfer.
- Actual React rules/purchase checks and 12 source-derived responsive text budgets.
- New outcomes carry `distribution: "pacing-v60"`. Existing recorded rounds
  keep their own grids, base multiples and awards; playback never rerolls them.
  Review fixtures are refreshed to demonstrate the new production distribution.

Large final studies use the identical production function with a faster
plain-data record-copy operation. All grids, RNG and ledger work are unchanged;
600 full-record parity cases compare that copy path with native structuredClone
across old/new profiles, all modes, stakes and caps. Native-copy Chopper results
match the accelerated run exactly. Acceptance gates check that study profile
and paytable match the source, and include the math source SHA-256.

Historical test gates were updated explicitly: v59 exact-outcome equivalence
continues for Max, while Yacht/Chopper use new pacing/accounting checks. The
collection tests retain the original protected function comparisons and use
the accepted v59 source for unrelated-file protection.

## Reproduce

Run in the retained repository (historical protection tests require its Git
checkpoints):

```sh
npm run typecheck:kilo
npm run test:kilo:features
node scripts/analyze-vs-expectation-v60.mjs
node scripts/verify-pacing-study-v60.mjs
npm run build
```

To regenerate the independent VS study:

```sh
KILO_PACING_SAMPLES=500000 KILO_PACING_MODES=yacht KILO_PACING_SEED=98017341 KILO_PACING_FAST_CLONE=1 KILO_PACING_CONFIG=art/kilo-v60/calibration/candidate-only.json KILO_PACING_OUTPUT=art/kilo-v60/vs-independent-validation.json npm run simulate:kilo:pacing
```

For Chopper, use 50000 samples, mode `route`, seed `73182061`, config
`art/kilo-v60/calibration/selected.json` and output
`art/kilo-v60/chopper-validation.json`. Omit `KILO_PACING_FAST_CLONE=1` to use
native structuredClone. Calibration sweeps and rejected candidates are retained
under `art/kilo-v60/calibration/`.

## Remaining limits

This resolves the measured event-frequency and reward-allocation gaps. It does
not finish the character rigs, VS acting, Max boat performance, art consistency
or sound direction. The repeated Chopper flight treatment is unchanged.

No browser automation is available in this managed environment. The playback
checks use production controllers with instrumented display objects, not live
browser/GPU captures. Real-device pacing, total feature duration and audio still
need review. A higher cascade count can lengthen a feature; this pass does not
claim that its current presentation is faster or visually approved.

Production outcome books, complete base/Ante RTP calibration and Stake Engine
approval remain separate work. The existing build advisory about a main chunk
larger than 500 kB remains. No deployment was performed.
