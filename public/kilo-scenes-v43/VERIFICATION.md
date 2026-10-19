# Kilo King v43 art overhaul verification

Checkpoint: 2a36ec04a8aae5e5438811ba7fec70297dc01cdf.

Source/AST comparison, local image decoding and calculations from the real layout functions. No browser automation, screenshots, server or deployment.

- 80/80 checks pass.
- 60 protected files match the checkpoint byte for byte, including engine, wallet, director, reel renderer, collection/hooks, layout and the complete command-bar system.
- All three original Kilo logo files are protected by SHA-256.
- Complete SlotControls JSX, callbacks and props are compared as normalized syntax; host engine/bank/settlement/presentation calls are compared separately.
- Artwork registry edits are restricted to the authorized URLs and source bounds; functions, tier ladders and fit budgets remain unchanged.
- 42 runtime assets locally decoded, including the full 20 wide/portrait scene plates, four transparent entry crests, eight selected symbol WebPs and declared motion support. Total checked payload: 9.24 MiB.
- 16 calculated cases cover 360×800, 390×844, 844×390 and 1440×900, base/feature, with and without the review toolbar. Portrait control allocation remains 160px; tracked targets remain at least 44×44.
- 80 calculations preserve each decoded plate’s actual aspect ratio while keeping the same reel opening.
- The eight selected symbol URLs resolve from the actual artwork registries; canvas dimensions and measured alpha bounds match the runtime manifest.
- Entry is mounted outside the game HUD, passes pointer input through, derives awards from the recorded outcome and adds no phase timers.

## Required gates

- npm run typecheck:kilo: passed
- npm run test:kilo: passed

## Verification limits

- No live browser visual or interaction verification was performed.
- Image decode success does not prove illustration quality, character registration, clean animation seams or animation cadence on a device.
- Calculated bounds are not browser-computed layout; source CSS and accepted controls remain protected against the checkpoint.
- This report does not claim Stake Engine approval or certification.

Detailed source hashes, decoded asset dimensions, calculated rectangles and gate output: art-overhaul-verification.json.

Run: node --experimental-strip-types scripts/verify-art-overhaul-v43.mjs --run-gates

After an asset-only replacement, omit --run-gates to reuse the successful commands only when the exact checked source hash remains unchanged.
