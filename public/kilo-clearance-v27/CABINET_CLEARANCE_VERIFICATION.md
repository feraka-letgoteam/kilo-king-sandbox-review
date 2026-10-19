# Cabinet clearance v27

Production CSS cascade plus source-derived layout and actual decorative-art outer bounds. No browser execution or live screenshot verification.

Checkpoint: 8e8c72b. 90 source files, including control interaction/layout/tokens, engine, wallet, reel layout and rendering, match the checkpoint byte for byte. Control paint is an allowed presentation change.

| Viewport | State | Layout | Minimum cabinet/control separation | Base status/cabinet separation |
|---|---|---|---:|---:|
| 360x800 | Base | portrait | 10.0px | 3.0px |
| 360x800 | Feature | portrait | 10.0px | Not asserted |
| 390x844 | Base | portrait | 10.0px | 3.0px |
| 390x844 | Feature | portrait | 10.0px | Not asserted |
| 844x390 | Base | landscape | 4.0px | 10.0px |
| 844x390 | Feature | landscape | 4.0px | Not asserted |
| 1440x900 | Base | wide | 10.0px | 4.0px |
| 1440x900 | Feature | wide | 10.0px | Not asserted |
| 320x568 | Base | portrait | 10.0px | 3.0px |
| 320x568 | Feature | portrait | 10.0px | Not asserted |
| 485x902 | Base | portrait | 10.0px | 3.0px |
| 485x902 | Feature | portrait | 10.0px | Not asserted |
| 1920x1080 | Base | wide | 10.0px | 4.0px |
| 1920x1080 | Feature | wide | 10.0px | Not asserted |
| 640x320 | Base | compact | 0.0px | Not asserted |
| 640x320 | Feature | compact | 0.0px | Not asserted |

## Result

All targeted source checks passed.

## Limits

- Safe-area expressions are evaluated with zero device insets; shipped env() declarations are preserved.
- Header checks cover base one-line statuses and feature-header vertical row budgets; they do not assert browser font rasterization or every possible localized string.
- Full artwork bounding envelopes are conservative; transparent pixels are not used to excuse collisions.
- Portrait viewport space below the fixed-size game still exists; background reframing changes its composition, not reel dimensions.
