# Kilo King illustrated asset overhaul

Checkpoint: `v88-b3` at `f4235990aaf40ffdefbc6f77e3256b00af8124a0`.

The runtime uses the new matte illustrated art, registered symbol clips, separate King parts and shared layered marina painter. The current control bar, geometry, feature outcomes, pricing and collection director remain unchanged.

## Asset package

The full authoring ZIP is retained in this private source checkout as verified binary pieces under `source-parts/` (concatenate in manifest order to restore `Kilo-King-Production-Assets.zip`): 664,013,927 bytes, SHA-256 `94c020f727d8316806219295a257ab316abadb644b638581f1b9c3026c4f4a1b`. It includes PNG-32/WebP masters, masks, frames, pivots, manifest, contact sheet and one-page asset list. The public runtime namespace contains only compact runtime textures. The large authoring ZIP is not part of the GitHub PR or browser download.

White/grey glow, shine and particle layers are intentionally tintable masks. Full-colour base drawings, gold coin and green cash variants are also supplied.

## Verification and proof limits

- TypeScript and production build pass.
- 47 protected source files are hash-identical, including math, wallet, controls and directors.
- Reel/actor geometry and the accepted collection sequence are byte-identical.
- 1,817 new rig samples retain fixed bone lengths, planted ankles and a bounded rod tip.
- 108 Max outcome, speed, reduced-motion, Skip and resize cases pass.
- Existing collection interruption and VS contact checks pass; the collection fixture credits 48,000 once.
- Desktop 1440×900 and phone 390×844 frame sequences cover base spins, feature entry, collection, multi-reel VS and Max win/early loss/late overshoot.

Proofs use production scene controllers and shared character/environment painters through an instrumented CPU Canvas renderer. They are not browser/WebGL screenshots, do not capture the complete React control bar and do not establish live device performance or audio synchronization. Before/after frames in the PR are labelled accordingly. Complete proof sequences are retained as `proof-parts/`; selected frames and the index are readable directly under this folder.

The King is a layered raster skeleton, not a Spine project. Symbol and crest clips deform registered new drawings; they are not independently hand-drawn on every frame. Palms are separate rooted planes, not frond-by-frond rigs. No PSD is supplied.
