# Offline proof index

These are frame sequences from the production controllers and the shared environment/King painters, not browser screenshots. The WIN readout is a test harness; the complete React control bar is not captured.

Both 1440×900 and 390×844 are captured under `proofs/after/`:

| Sequence | Recorded outcome |
| --- | --- |
| base-spin | One 1,000 credit |
| entry-dock | Feature entry; no credit |
| collection | One 48,000 credit |
| vs-wide | One 688,000 credit, combined ×64 wild |
| god-full | One 25,000,000 credit |
| god-early-loss | No credit |
| god-late-overshoot | No credit |

Each JSON records phase timestamps, frame filenames, cue timestamps, source/harness fingerprints and credit events. Frames include anticipation, action, settle and transfer, rather than only final poses. `review/` contains selected before/after and feature frames for the PR. Live browser/WebGL, complete UI and audio synchronization remain unverified.
