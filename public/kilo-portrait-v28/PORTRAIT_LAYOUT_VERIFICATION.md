# Portrait layout v28

Source-derived pixel rectangles, checkpoint comparisons, real React server-rendered markup, and production CSS cascade resolution. No browser execution or live screenshots.

Checkpoint: 79390ad. 94 protected source files unchanged. Only portrait control layout and new portrait spacing tokens changed. All existing tokens, control CSS, engine, wallet, settlement, reel sizing, collection, hook behavior, charge math and interaction markup match the checkpoint.

| Viewport | State | Bet → Spin | Spin → secondary | Smallest painted gap | Smallest target | Allocation |
|---|---|---:|---:|---:|---:|---:|
| 360x800 | base | 16px | 16px | 8px | 44px | 160px |
| 360x800 | feature | 16px | 16px | 8px | 44px | 160px |
| 390x844 | base | 28px | 28px | 8px | 44px | 160px |
| 390x844 | feature | 28px | 28px | 8px | 44px | 160px |
| 320x568 | base | 8px | 8px | 5px | 44px | 160px |
| 320x568 | feature | 8px | 8px | 5px | 44px | 160px |
| 344x800 | base | 16px | 16px | 8px | 44px | 160px |
| 344x800 | feature | 16px | 16px | 8px | 44px | 160px |
| 485x902 | base | 28px | 28px | 8px | 44px | 160px |
| 485x902 | feature | 28px | 28px | 8px | 44px | 160px |

No target or conservative painted module envelope overlaps. The primary 360/390 cases retain a 96px centered Spin and 104×88px compact Bet. The 2×2 secondary group uses 44px circles and 12px spacing. Badges remain within the dock.

72 desktop, landscape, and compact layout comparisons exactly match the checkpoint. Twenty real SSR state/viewport cases, each checked at rest and pressed, retain opaque #020c12 faces, 8px Spin / 2px secondary solid rims, 14px labels, opaque badges and ≥3px white icons. The disabled reason and cost remain children of the Spin group; the charge rectangle stays within the Spin bounds. Font rasterization inside the circular face is not browser-verified.

## Cause

The old portrait formula let the Bet well expand into unused width and anchored the secondary grid to Spin with the shared 8px gap. With an 8px Spin rim, its equal-width spacing made the three groups appear crowded. Geometry is inline from layout.ts; changing a host CSS gap cannot alter those absolute positions. This pass bounds the Bet well and reserves separate lanes and badge space. No material cascade override was changed or needed.

## Limits

- CSS resolution uses the repository cascade evaluator, not browser computedStyle.
- Geometry includes a conservative 3px badge overflow on all secondary controls; font rasterization and browser painting are not observed.
- Safe-area insets are zero in these source-derived viewport checks.
- Narrow fallback below 320px control width retains its earlier 8px spacing and 80px Spin. Desktop and landscape remain byte-equivalent in computed layout outputs.
