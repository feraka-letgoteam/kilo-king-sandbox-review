# Kilo King — composition pass 17

This pass responds to the 9:27 PM recording on October 16, 2026. It is saved for review without deployment. The published game remains v16.

## What the recording exposed

- The desktop rail spreads small figures across large empty tracks. Spin and Features lose emphasis beside the large reel artwork.
- Six equal feature cards reduce the illustrations to thumbnails and compete with the large Ante banner.
- The gallery animates into view before its images finish loading. The underlying game remains visible through the unfinished panel.

## Implemented

- Desktop Balance/Win now use 28/32px type in the wide rail, centered in their tracks. Spin is 100px. Compact desktop, phone and landscape have separate fit rules; full large amounts use targeted font exceptions.
- Features remains outside the rail, with a brass face and dark lettering. The reel, cabinet, title and character geometry are unchanged.
- The opaque feature dialog opens on two available purchases. Separate tabs expose the three scatter entries and two features in development. The latter have no purchasable engine mode or invented price.
- Feature artwork fills a 200px desktop hero area, or 190px on phone. The purchase price, reward and action have distinct hierarchy. Ante sits with the wallet and bet controls below the cards.
- Phones retain a single-card carousel; short viewports scroll inside the dialog. The close control stays outside the scrolling content. Arrow navigation moves focus to the displayed card; disabled offers focus the article instead of an offscreen purchase button.
- Existing artwork preloads and decodes during entry. Cached groups display immediately; uncached groups show one loading surface. Image failures produce a usable fallback. Purchase confirmation, limits, balance checks and the single-submit guard remain in place.

## Verification

- `npm run typecheck:kilo` passes.
- `node scripts/verify-controls.mjs` passes: pricing boundaries, group contents, preview-only data, artwork cache/failure handling, preferences, timing profiles and paytable coverage.
- `node scripts/verify-dock-fit.mjs` passes 1,188 derived rail configurations, 16,632 real-font amount checks and 16,632 readout-height checks. These use source CSS and shipped font metrics; they are not browser layout measurements.
- `npm run build` passes. Both changed stylesheets parse without warnings.
- Engine, wallet, settlement, fixtures, director, Pixi collection/reel behavior, layout geometry and source artwork are unchanged from the opening commit `48dafe626e48d2a3da527bcdbe046d146511187b`.

## Review artifacts and limits

`public/kilo-composition-v17/index.html` contains desktop and phone Base/Features design frames with actual-size viewing. The PNGs are self-contained; the SVGs reference repository artwork. v16 frames are retained.

These frames are static code renders, not runtime screenshots. They verify the intended composition only. Browser interaction, animation, visual CSS parity and device performance still require browser QA. The supported browser skill is unavailable in this session, and the Sites workflow prohibits substituting an unsupported browser path.

The unfinished collection-specific work from the earlier handoff was shelved before this composition pass. It is not included in this draft. No GitHub update or deployment was made.
