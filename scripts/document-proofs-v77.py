"""Write reproducible timing notes from the verified production captures."""
from pathlib import Path
import json

root = Path('art/kilo-v77/proofs')
final = json.loads((root / 'final-manifest.json').read_text())
rows = []
for clip in final['clips']:
    data = json.loads((root / (clip['id'] + '.json')).read_text())
    frames = data['telemetry']
    if clip['id'].startswith('god'):
        result = next(r['ms'] for r in frames if r.get('card') and r['card']['phase'] == 'result')
        last = 5 if 'full' in clip['id'] else 4 if 'late' in clip['id'] else 2
        anticipation = [r['ms'] for r in frames if r.get('card') and r['card']['phase'] == 'anticipate' and abs(r['card']['segment']-(last-1)) < .001]
        thrust = [r['ms'] for r in frames if r.get('card') and r['card']['phase'] == 'advance' and last-1 < r['card']['segment'] <= last]
        event = f"final hold/build {min(anticipation)/1000:.2f}–{max(anticipation)/1000:.2f}s; thrust {min(thrust)/1000:.2f}–{max(thrust)/1000:.2f}s; result {result/1000:.2f}s"
    else:
        cues = {c['name']: c['ms']/1000 for c in data['cues']}
        event = f"contact {cues['vsImpact']:.2f}s; lock {cues['vsLock']:.2f}s; connection {cues['vsConnect']:.2f}s; amount {cues['vsAmount']:.2f}s"
    credit = ', '.join(f"{c['value']:,} at {c['ms']/1000:.2f}s" for c in data['credits']) or 'None'
    rows.append(f"| [{clip['id']}]({clip['id']}.mp4) | {clip['duration']:.2f}s / {clip['frames']} | {event} | {credit} |")

text = """# Kilo King v77 — offline production proofs

Unzip the package and open `index.html` to play the eight native clips. Each clip is 30fps at its exact stated viewport. These are silent CPU Canvas captures of the actual production Pixi scene, feature controllers, source geometry, environment painter and character painter, with a minimal WIN target. They are not browser/WebGL recordings of the complete React control UI.

## What to inspect

The God clips begin with one actual ordinary reel spin. The full-window illustrated card then enters in reel-width increments. Each step has a stationary hold, pressure build, thrust, counter-lean and braking. The winning card aligns with the frame, settles, then the MAX WIN artwork appears and WIN receives one credit. Early loss stalls at its recorded stop; the late loss overshoots the exact winning alignment. Populated reels remain underneath and return after release.

The VS clip uses a naturally generated paying feature event (seed 1569831, free-spin index 12). A fresh King result bridges existing King groups into a continuous five-reel wild. The member multipliers form ×384. The source credits 14,826,000 once, bringing the previous 3,174,000 WIN to the capped 18,000,000 total. The strips below active VS art are actually hidden. The new number converges and punches with the connection rather than sitting in a detached black plate.

Each `*-sequence.webp` contains six exact frames extracted from its MP4, with source frame number and timestamp. The individual JSON includes every frame's transforms, group membership, strip visibility, actor state, cue times and credit times. The 20-entry `VS-art-gallery.json` and associated WebP images demonstrate both King/Cop compositions at all five widths and both sizes; their illustrative products test typesetting and are not paying-event fixtures.

## Timing from the captured production controllers

| Native clip | Duration / frames | Key sequence times | WIN credit |
| --- | --- | --- | --- |
""" + '\n'.join(rows) + """

## Integrity and checks

Production source/asset fingerprint: `""" + final['sourceFingerprint'] + """`.

`final-manifest.json` records each native clip's SHA-256, byte count, frame count, duration and credits. The finalizer verifies actual ffprobe dimensions and 30fps, source fingerprint, five populated source reel strips, one ordinary God spin, visible physical response telemetry, result settling, VS concealment, product and single credit. `verification.json` contains 24 exact v66 legacy timing comparisons, 132 production-controller cases, and 40 Skip/resize interruptions across normal, turbo, super turbo and reduced motion. The project math suite separately passes 200,975 assertions.

Earlier captures predated a cue-hook instrumentation correction. Their labels were repaired only after a second production replay exactly matched every captured frame's transforms, amounts, strip state, actor state, travelling values and credit timestamps. The `metadataReplay` field makes this explicit; the native MP4 pixels were not changed or re-encoded.

God Mode probability, binary outcomes, RNG consumption, pricing and payout are unchanged. Wallet, settlement, controls, reel geometry, collection, hooks, non-VS features, and existing backgrounds/ambient motion are unchanged. The requested VS multiplication rule is the reconstruction's sole gameplay payout-rule change. The proof capture itself does not deploy the game.

## Remaining limitations

- At an early second-reel stop, only the leading card area and boat bow have entered the aperture. The centered rider and stern wake are still clipped offscreen. The proof therefore demonstrates bow preload/thrust and a decisive stall; it does not demonstrate visible rider or wake on that early stop. The approved full-window card path and centered boat composition are preserved.
- The boat uses authored layered sprites with independent hull/rider/wake motion. The stage character uses authored artwork and deformation, not a fully articulated character rig or simulated water.
- VS art is dedicated to each width with finite choreography and crossfades. The existing Yacht background retains its original warmer light while the new wide art has night lighting.
- Live browser/WebGL, sound and full React UI review remain separate verification. These proofs make no claim to that coverage.

## Reproduce from the complete source

```sh
npm ci
npm run test:kilo:features
KILO_PROOF_CASE=god-full KILO_PROOF_SIZE=1440x900 node --expose-gc scripts/render-feature-proofs-v77.mjs
KILO_PROOF_CASE=vs-five KILO_PROOF_SIZE=390x844 node --expose-gc scripts/render-feature-proofs-v77.mjs
```

Capture one case and viewport per fresh Node process, serially, using the two selection variables above. Repeat for god-full, god-early-loss, god-late-overshoot and vs-five at 1440x900 and 390x844. This releases native image caches between clips. The harness defaults to per-frame explicit GC with an event-loop turn for native finalizers; this affects offline memory management, not production source or frame poses. Use `KILO_PROOF_METADATA_ONLY=1` only when the exact corresponding clip and manifest already exist.

After captures, run `node --expose-gc scripts/render-vs-art-gallery-v77.mjs`, `python scripts/assemble-feature-proofs-v77.py`, `python scripts/finalize-proofs-v77.py`, `python scripts/build-proof-index-v77.py`, and `python scripts/document-proofs-v77.py`.
"""
(root / 'README.md').write_text(text)
tracked = """# v77 proof index

The final offline proof package contains eight 30fps MP4s at 1440×900 and 390×844: God full win, early loss, late overshoot, and the natural five-reel VS bridge. Each includes a timing/credit manifest and a six-frame sequence sheet. It also includes twenty actual production VS typesetting/art coverage images (both sides, widths 1–5, both sizes), verification, hashes, timing notes and an offline `index.html` player.

Production source/asset fingerprint: `""" + final['sourceFingerprint'] + """`.

These are silent offline production-controller/CPU Canvas proofs with a minimal WIN target, not browser/WebGL or complete React UI recordings. Early second-reel loss reveals only the bow/front of the centered full-window card; rider and stern wake are clipped until more of the card enters. The layered boat and deformation-based character are not full articulated rigs. Existing Yacht environment light remains warmer than the new night VS artwork. The proof capture itself does not deploy the game.

See `V77-DELIVERY.md` for source, changes and preserved systems. To reproduce clips after `npm ci`, select each required case and viewport using `KILO_PROOF_CASE` and `KILO_PROOF_SIZE`, and run `node --expose-gc scripts/render-feature-proofs-v77.mjs` in a fresh process for each clip, serially. Then run the gallery, assembly, finalizer, index and notes scripts listed in the proof package README. The saved proof archive's durable recovery reference is recorded in the final source delivery manifest.
"""
Path('art/kilo-v77/PROOF-INDEX.md').write_text(tracked)
print(root / 'README.md')
print('art/kilo-v77/PROOF-INDEX.md')
