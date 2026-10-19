# Kilo King — marina stage and control bar, v20

Research and implementation: 17 October 2026. Starting point: the privately published v19 source at `22a1d3bb4df1f18c98c7ce331520b25b8ff14b1e`.

## What the references establish

The three supplied stills were inspected directly. They establish composition and visual hierarchy, not animation timings or a provider's underlying technology.

| Reference | Useful design evidence | Application to Kilo |
| --- | --- | --- |
| Tome of Hercules | The reel surround has a strong illustrated silhouette; title and character have separate territory. The readout bar is visually quiet. Spin is the largest control, with the provider/feature medallion separated. | Keep Kilo's side title and fisherman. Give the cabinet its own painted material and keep the data surfaces restrained. |
| Waylanders Forge | Tent supports, frame, character and foreground objects belong to one setting. Small controls use familiar shapes instead of competing with the illustration. | Use marina hardware, enamel, brass fittings and fishing line, with simple high-contrast control glyphs. |
| Salad Rush | The stage is a physical prop in the game's world. Controls inherit that prop's visual language, while amounts remain readable. | Treat the frame as marine equipment and Spin as a fishing-reel spool. Preserve Kilo's existing palette and symbols. |

These are design observations from the user-provided images. No provider artwork or logo is included in the implementation. Valkyrie's own [Waylanders Forge](https://valkyriestudio.gg/game/waylanders-forge) and [Tome of Hercules](https://valkyriestudio.gg/game/tome-of-hercules) pages identify both as its Stake Engine games. The actual rendered stills, rather than catalogue statistics, informed this pass.

## Published requirements versus visual convention

[Stake Engine's frontend guidance](https://stake-engine.com/docs/approval-guidelines/front-end-communication) calls for usable mobile and popout views, original assets, accurate balance and win presentation, accessible rules and a control guide. Bet levels must follow RGS authentication. Sound must be switchable, Spacebar must invoke the bet action, and autoplay requires confirmation. Fast presentation must remain legible. Rules need mode costs, RTP, maximum wins and payouts. Assets and fonts must be served from Engine's CDN in a production submission.

That guidance does not prescribe the exact black bar, dimensions, materials or icon art shown in the references. A custom marine design can follow the same functional requirements.

The [quality guidance](https://stake-engine.com/docs/approval-guidelines/game-quality-rankings) emphasizes cohesive artwork, originality, polished animation, device testing and loading performance. It explicitly identifies generic assets, basic gradients and border effects as insufficient substitutes for finished design. A reskin alone cannot establish production quality.

The [general documentation](https://stake-engine.com/docs) permits compatible custom frontends; the sample SDK is optional. This does not require migrating this React/Pixi presentation to Svelte.

[Bet Replay](https://stake-engine.com/docs/approval-guidelines/game-replay-requirements) is a separate required integration for new submissions. Local fixture review is useful for development but does not implement the public RGS replay contract.

## Changes implemented

- A painted petrol-teal cabinet with worn brass guards, controlled edge highlights, fishing-line wraps and a hook engraving.
- Twelve fitted artwork sections keep the hook, wraps and corner fittings in proportion during resizing. They share one layout definition across the renderer and outer SVG silhouette.
- Cabinet art inside the canvas sits below win routes, collection values, collector portraits and hook effects. The outside silhouette sits behind the canvas. The complete prior renderer remains byte-identical after removing four explicitly marked decorative insertions.
- A matching reel-spool Spin face, with an independent crisp arrow and accessible button text. Hover rotates the decorative face slightly; reduced-motion preferences disable that response.
- Quiet navy readout panels, a simpler Menu/Auto treatment, restrained brass endpoints and a separate crown-and-hook feature medallion. All amounts remain live text in the shipped tabular font.
- Existing canonical desktop order and four requested viewport geometries retained. Feature purchases still use the existing confirmation and charge path.
- A compact popout layout. Bet opens its existing selector; Auto, Ante and speed remain available through Menu. Spin, Menu, Buy, balance, win and bet stay visible in base play. Feature mode uses the bet well for remaining spins/multiplier and the side area for collector sockets. Base and feature use the same reel rectangle.
- Spacebar routes to the existing Spin/Skip/Stop button, ignoring dialogs, typing targets, held-key repeats and modifier shortcuts. A control guide is available in Rules & paytable.

## Size and verification evidence

| Viewport | Layout | Reel host | Control area |
| --- | --- | --- | --- |
| 1440×900 | Side title and fisherman | 888×534.94 | 888×100 underneath |
| 390×844 | Portrait | 366×220.48 | 366×160 underneath |
| 360×800 | Portrait | 336×202.41 | 336×160 underneath |
| 844×390 | Landscape flanks | 488×294 | 128 left / 96 right |
| 400×225 | Compact popout | 280×165 | 44px footer / 64px right |
| 480×270 | Compact popout | 348×210 | 44px footer / 64px right |

The new art totals approximately 253 KiB in WebP, served locally with the build. No additional runtime asset origins or fonts were introduced. Original generated alpha is retained. Corner and ornament fitting uses source regions, not whole-game scaling.

Source validation covers 412 layouts, 3,532 touch targets, 13,574 target-pair overlap checks, 4,120 long-amount/font checks, finite autoplay scheduling and keyboard guards. Renderer geometry, symbol sizing, collection sequence and hook code are unchanged. Engine, bank, outcome fixtures, director, motion atlas and control model retain checkpoint bytes. The existing presentation suite passed 216 fixture/skip/speed cases across 18 saved rounds. The existing purchase-limit checks also passed.

The six PNGs in `public/kilo-stage-v20/` are **authored static design renders, not browser screenshots**. They use the production layout functions and art. Text baselines, compositing and filter rendering can differ from a browser. They depict base idle only.

## Remaining verification and approval work

Browser automation is unavailable in this managed workspace. Actual interaction, focus, touch scrolling, modal fit, animation performance, active-feature resizing and collector landing during resizing remain unverified. The miniature feature HUD especially needs that browser check. Review tooling itself adds a 44px development toolbar; extremely short review windows may scroll even when the normal game fits.

This remains a review sandbox, not a Stake-approved release. Its local balance and bet list are deliberately preserved. Production RGS/authentication, RGS-provided bet levels, replay parameters, jurisdiction wording, mode RTP disclosures and Engine CDN delivery need their own integration/approval pass. No invented RTP values were added. The checkpoint's missing audio pack still leaves sound unavailable. The quality of full character animation, symbol reactions and feature-screen transitions was not overhauled here.

Next acceptance gate: test the same published build in idle, Ante Off/On, both purchase confirmations including over-limit states, feature entry, two-collector collection, retrigger, long completion and resize during an active collection. Repeat at the four original sizes plus 400×225 and 480×270. Inspect the live browser, not only the design renders.
