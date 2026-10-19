# Kilo King v61 — one complete VS encounter

Local presentation pass from `e121a0a` (v60). No deployment or GitHub push.

## Completed sequence

The pure-VS branch now owns the whole encounter instead of ending at the sticky
reel and delegating directly to the generic payline highlighter.

1. The recorded King and Vice multipliers enter their reel. A new eight-drawing
   Kilo strip supplies brace, load, pull, recovery and winner poses. Drawings use
   a registered torso baseline; the opponent retains the existing action atlas.
2. Pull and contact cues occur at animation beat crossings. The recorded winner
   replaces the challenge, and the multiplier locks with a short metal latch.
   The original permanent winner reel remains still until the feature ends.
3. A weighted gold connection traces the actual winning cells. Participating
   wild reels receive a contained hard edge. Non-winning symbols recede.
4. The line award appears beside its connection, with the actual base amount
   and contributing multipliers. The count completes, then holds for reading.
5. That same amount leaves its displayed position, travels toward the existing
   WIN anchor, fades before touching the digits, and credits the presentation
   meter once. Transfer and landing have their own short sounds.

No RNG runs in this sequence. Credit always uses `line.pay` from the record.
Derived arithmetic is explanatory copy only. Capped awards show “ROUND LIMIT”
and the actual credited amount. No-win duels lock without inventing a payment.

## The complete recorded encounter

v60 generator seed **132**, free spin **9**, stake **1,000**, unchanged result:

| Item | Recorded value |
|---|---:|
| Existing sticky King reel | Reel 4, ×2 |
| New duel | Reel 5: King ×3 / Vice ×2 |
| Winner | King, ×3 |
| Winning connection | Five 10 symbols/wilds, middle row |
| Award | 5,000 × (2 + 3) = **25,000** |
| Feature WIN before / after | 2,000 → **27,000** |

Review menu: **VS — ×3 duel and 25,000 connection (spin 9)** plays the complete
recorded feature without changing the balance. The isolated proof fixture is
`art/kilo-v61/encounter.json`; it is checked against the generator, not manually
edited into a winning board.

## Desktop and phone evidence

Normal-speed, 60 fps clips with the shipped eight VS cues:

- `art/kilo-v61/proofs/vs-1440x900.mp4`
- `art/kilo-v61/proofs/vs-390x844.mp4`
- `art/kilo-v61/proofs/vs-360x800.mp4`

Each clip is about 4.23 seconds, including 400 ms before and 900 ms after the
sequence. The actual encounter is about 2.93 seconds. Actual reel cell sizes
are 162 px, 66 px and 60 px respectively. Nothing scales the whole game.

These are **offline native-Canvas rasterizations of the production Pixi effect
display lists**, using shipped artwork, fonts and source reel geometry. The
single WIN well is a minimal harness positioned using the production control
layout. It is not the full React dock or a live browser/WebGL capture. The clips
contain effects only, without the music bed. Audio is mixed from the shipped
sprite ranges at the exact cue times emitted by the controller, at the default
70% effects level. Source PNG keyframes and cue timelines accompany each clip.

## Verification

- 1,728 dedicated VS controller cases: both winners, equal candidate values,
  no win, multiple duels, persistent multiline wins, capped and long amounts;
  normal/turbo/super, reduced motion, all four requested viewport geometries.
- 420 phase-specific resizes and 180 interruptions during action, line or
  transfer. No late credit, duplicate cue or orphaned amount element.
- 14,894 recorded line expressions independently checked. The review fixture
  and clip fixture equal the unchanged v60 generator output.
- 1,296 broader renderer cases, including 276 resizes and 276 interruptions.
- Existing Max, React/UI and 96 collection-flow cases pass. Source guards keep
  engine/math, settlement, wallet, reel sizing, controls, director, collection,
  permanent wild appearance, Max and Chopper choreography unchanged.
- All 40 audio cues validate; old cue offsets and music beds are retained.
  Finite new sounds are synthesized without third-party samples. Decoded SFX
  peak is 0.7432; no clipping. Explicit mute and volume controls still apply.
- `npm run typecheck:kilo`, `npm run test:kilo:features` and `npm run build` pass.
  The existing >500 kB main-chunk advisory remains.

## Remaining limits

The new Kilo action is eight registered drawings, not a full articulated rig or
a continuous frame-by-frame studio animation. Vice retains four prior poses.
The permanent banners and the rest of the character/environment artwork are
unchanged. Live WebGL, actual DOM transfer alignment, mobile GPU performance
and headphone/phone-speaker listening still need a supported browser/device
session. No claim of live-browser verification or final studio quality is made.

## Source and reproduction

- Runtime: `src/components/kilo/reel-feature-effects.ts`, `vs-encounter.ts`,
  `vs-art.ts`, and `src/lib/kilo/sound.ts`.
- Artwork: `public/kilo-v61/vs/king-action.png`. Prompt/provenance:
  `art/kilo-v61/asset-provenance.json`.
- Sound rebuild: `python scripts/build-vs-audio-v61.py` (requires the frozen v60
  Git checkpoint, numpy/scipy and ffmpeg). Delivered audio works without rebuild.
- Proofs: `node scripts/render-vs-encounter-v61.mjs` (native Canvas and ffmpeg).
- Verification: `npm run test:kilo:features`.
