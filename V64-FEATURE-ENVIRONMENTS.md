# Kilo King v64 — feature environments

Local checkpoint: v63 `8d08c2b8ae10855bd9dc1948a4f7b78ae429726f`.
No deployment. This pass changes background presentation only.

## Restored environments

| Feature | Restored composition | Ambient movement |
| --- | --- | --- |
| 3-scatter / Dockside Catch | Existing night waterfront and stone dock, cleaned wide/portrait plates | Cloud drift, water reflections, fitted lamps, small birds, palm canopy movement, occasional distant jet ski |
| 4-scatter / Yacht Stash | Existing yacht deck and skyline, cleaned wide/portrait plates | Cloud drift, water reflections, palm canopy movement, birds and occasional distant jet ski |
| 5-scatter / Chopper Route | Existing waterfront helipad, cleaned wide/portrait plates | Cloud drift, water reflections, fitted helipad lights, birds and small distant palm movement |
| Max Spins / The Getaway | Existing v59 boathouse wide/portrait plates | Cloud drift, water reflections, fitted desktop wall lamps, birds and a small desktop palm canopy |

The v4 presentation branch explicitly forced feature environments to `base`.
The preloader repeated that override. Both now resolve the recorded feature's
artwork. The feature environment remains through v4 completion; exit returns
to base. Selected Max mode continues using its dedicated v59 boathouse.
Five-scatter uses the established `route → chopper` mapping; the legacy
`scatter-5` warehouse has not been substituted for Chopper Route.

No feature background is missing. Original Yacht sunset and Chopper dusk
colors remain, including the existing runtime color treatment. They have not
been replaced with invented night compositions.

## Clean plates and depth

The three original v43 feature masters contained an obsolete fisherman baked
into the pixels. Following authorization to rebuild the backgrounds, six
clean plate edits remove that static figure, his equipment and the baked
clouds, restoring the surrounding environment. Full compositions are now
available without the earlier character-avoidance crop. Max's existing clean
plates remain unchanged.

The current v63 animated fisherman stays mounted with the same camera, props,
position, size, deformation and reactions. Backgrounds render behind him and
behind the reels and UI. Foreground docks, railings, buildings and helipad
architecture remain fixed. Source-fitted masks keep clouds and birds behind
the skyline and roofs, and water traffic behind foreground railings.

Eight assets were prepared with the built-in image-generation tool: six clean
backgrounds, one transparent cloud bank and one transparent distant jet ski.
Generated originals and the exact prompt sets are in `art/kilo-v64/source/`.
Runtime WebP exports and SHA-256 provenance are in
`public/kilo-v64/environment/manifest.json`. Source dimensions match the
original background registrations. Original v43/v59 assets are retained.

## Motion design

- Noticeable, slow cloud-bank travel: two depth layers with different drift
  rates, inside fitted sky masks. No whole-background translation.
- Water/reflections move within water polygons, at no more than 1.7 source
  pixels, easing to stillness at the boundaries. Architecture stays anchored.
- Light pulses remain inside existing painted lamp interiors, at ≤12% opacity.
- Local palm-canopy deformation is bounded to 0.55–1.2 source pixels with zero
  displacement at patch edges. Trunks stay planted.
- Two small birds pass occasionally. They follow a continuous path and fade
  gently at its ends; they do not respond to spins or wins.
- Dockside and Yacht have one distant jet-ski pass per 96 seconds, lasting
  42 seconds. Its image is 21–22 source pixels wide on desktop and 12–13 on
  portrait, roughly 6–7 visible phone pixels. The narrow wake, small hull
  pitch and heave share its trajectory. No spray particles or sound.
- Chopper and Max do not get extra vehicle traffic.
- The complete atmosphere has a seamless 96-second cycle; water, lamps and
  palms use a 12-second period within it. The clock is independent of Normal,
  Turbo, Super Turbo and Skip, and entry does not reset it.
- Resize preserves phase. Hidden tabs, offscreen canvases and modal pauses
  suspend work without catch-up. Reduced motion shows a still environment.
- One opaque environmental canvas is bounded to 650,000 pixels and 20 paints
  per second. No game scaling or layout changes were made.

## Verification

Commands: `npm run test:kilo:features`, `npm run typecheck:kilo`,
`npm run build:review`. All pass. The build retains its existing >500 kB
bundle-size advisory.

`art/kilo-v64/verification.json` records 20 route states, eight original-image
byte comparisons, eight native-Canvas pixel-exact loop checks with shipped
alpha assets, 4,801 traffic samples, 5,808 palm samples, and the actual React
effect lifecycle harness (resize, pause, hidden, offscreen, reduced motion,
stale decoding and cleanup).

Source guards compare 38 protected files with v63 and compare the entire game
UI file after reversing only the explicit background routing/preload/prop
edits. All original background bytes match. Historical source guards normalize
only the count-asserted presentation changes; the new routing is separately
executed and checked.

The existing v63 checks also pass: 3,001 idle samples, 3,640 character reaction
samples, 1,728 VS cases (360 resizes / 180 interruptions), 216 boat cases
(108 resizes / 108 interruptions), 240 Max speed/Skip/resize cases, and 10,000
checkpoint-equivalent Max outcomes with identical RNG consumption.

Math, probabilities, payouts, wallet, settlement, charge calculations, feature
logic, purchase flow, controls, reel geometry, character performance, VS
presentation and Max boat behavior are unchanged.

## Offline proof clips

`art/kilo-v64/proofs/` contains four 12-second clips at **1440×900** and four at
**390×844**, plus stills and a camera/source manifest. Each clip's **0:00–0:12**
shows ambient time **18–30 seconds** within the 96-second cycle. That window
includes cloud and water motion, birds and the beginning of the distant
jet-ski pass where applicable.

The clips share the production background painter, shipped assets, source-derived
camera and unchanged v63 character painter. Solid reel/control areas are
neutral size and occlusion guides. These are **offline Canvas renders**, not
live browser screenshots or full-UI recordings.

## Remaining limitations

- Live browser/GPU and device performance have not been verified in this pass.
- Clean plates are generated edits of the existing compositions, not original
  layered illustration source. Original plates and generation prompts remain.
- Palms use bounded local image deformation, not individually articulated
  leaves. Birds are small procedural silhouettes, not frame-authored characters.
- Optional atmosphere sprite load failure leaves a usable background with its
  fitted water and lights; missing sprites are not replaced with unrelated art.
- No preview was published.
