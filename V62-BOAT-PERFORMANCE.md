# Kilo King v62 — physical Max and presentation finish

Local presentation pass from `1d63732` (v61). **Not deployed or pushed.** The private preview is unchanged.

## Max performance

The flattened moving boat is replaced by a registered assembly: clean hull/cargo,
three driver drawings, independently pivoting outboards, and a finite propwash.
Hull pitch/heave and the driver's counterweight respond separately to thrust and
braking. Each settles to a fixed home pose; there is no idle float or particle loop.
The original boat footprint and reel rectangle are retained.

- **Early loss:** advances to the recorded first gate, pauses, then accelerates
  through and leaves the stage. The losing board returns and a short NO WIN
  treatment appears.
- **Late loss:** the same physical grammar follows four recorded gates and the
  existing anticipation holds, then departs. Departure cannot reveal gate five,
  show MAX WIN, or credit anything.
- **Full stop:** reaches gate five, braces, brakes and settles. The wake clears.
  The vessel stays inside the stage while the recorded award resolves and
  transfers once to the existing WIN target.

Four motor/coast/brake/pass cues replace the borrowed VS latch during Max.
Normal movement and hold totals remain 5.05 seconds for a complete landing;
the result and transfer keep the full encounter about 6.2 seconds. A losing
pass adds 680 ms. Reduced motion omits travel and displays the recorded result.
Turbo and super use the existing presentation pacing factors.

## Applied to the remaining presentation

- **Collection:** one continuous cubic haul replaces three separate ease-to-zero
  moves. Start/sink positions, protected printed values, per-collector subtotals,
  multiplier equation, readable holds, combined award, transfer clearance and
  bank callback are preserved. Everything outside the flight-path function is
  byte-compared with v61.
- **Symbols:** available authored reaction clips now play on small wins too.
  Decorative glints are removed. Each response restores its exact original
  texture and placement. Static fallback remains if optional animation art fails.
- **Entry:** a brief contact, stable reading hold and release. The on-reel banner
  follows resize; no white full-board flash. Existing legacy entry drawings use a
  shorter one-shot performance and translation instead of a scale pop.
- **Retrigger:** the existing art and threshold hold remain. The presentation
  follows the current stage on resize; its award copy now fits on one line with the next multiplier in a quiet inset. Its original award callback fires once,
  after the first readable hold. The crown's existing authored action is retained.
- **Completion:** one short weighted entrance, then a stationary final amount.
  No second count-up or delayed settlement. Reduced motion suppresses entrance
  motion. Both on-reel and legacy completion surfaces receive this treatment.

The exact recorded collection is still **2,000 + 10,000 = 12,000; ×2 = 24,000
per collector; 48,000 once**. Portrait delivery and the recorded retrigger follow.
The capped proof credits **4,770,000** while retaining raw-versus-credited copy.

## Verification

Run `npm run test:kilo:features`, `npm run typecheck:kilo`, and `npm run build`.

- 10,000 unchanged Max outcomes and RNG-consumption comparisons.
- 240 Max speed/reduced/resize/Skip cases; 12 activation and dedicated-strip cases.
- 216 phase-specific boat cases: 108 resizes and 108 interruptions, including
  advance, settle, departure and transfer. No MAX flash on loss, extra segment,
  asset fallback, late cue or duplicate credit.
- 1,728 preserved VS encounters, 420 phase-specific resizes, 180 interruptions;
  14,894 recorded winning expressions checked.
- 1,296 general reel-effect sequences, 276 resizes and 276 interruptions.
- 96 exact/capped collection cases across four viewport geometries, every speed,
  reduced motion, bidirectional gather/transfer resize and Skip.
- 216 entry/retrigger/symbol cases, 60 resizes, 60 interruptions and 48 single
  retrigger callbacks. Normal retrigger award timing remains approximately 700 ms.
- 118 React/source checks, 12 responsive text budgets, and audio resource/decode checks.

Math, wallet, settlement, recorded scripts, controls, reel sizing, hooks, collection
ordering and VS distributions remain unchanged. The test runner now targets v62;
older test versions remain archived with their original source-freeze assumptions.

## Evidence and limits

`art/kilo-v62/proofs/` contains normal-speed 60 fps Max clips at 1440×900,
390×844 and 360×800, plus exact/capped collection clips at desktop and phone size.
Collection clips execute the actual stage methods **and** the recorded collection
director, including portrait arrival and retrigger holds. Each has a timestamped
cue/amount log. Viewport verification also covers 844×390.

These are **offline native-Canvas renders of production animation display lists**,
with shipped artwork, fonts and source reel geometry. Header/meter surfaces are
labelled test harnesses. They are not browser screenshots, a full React UI capture,
or WebGL/mobile performance certification. Browser automation is unavailable in
this workspace. Live scene compositing, device GPU performance and the DOM
completion entrance still need a browser/device review before publication.

The boat uses three upper-body drawings with runtime articulation; it is not a
fully articulated facial/hand rig. This pass reuses the existing symbol and
collector drawing packs. It does not claim a new frame-by-frame pack for every
symbol. The build retains its existing >500 kB bundle advisory.

For offline proof regeneration outside the managed runtime, install
`@napi-rs/canvas` in the project and provide ffmpeg, Python/numpy/scipy and
fontTools. These tools are verification dependencies, not shipped game code.
