# Kilo King v85 — verified source checkpoint

Source commit: `7e6105e6975e6a6a9128eb4f0f13d13d41bf3bab`.

This contains the complete buildable v85 source, all public runtime assets, verification reports and 19 audiovisual proof sequences. Every file and archive part is checksummed in `manifest.json`.

The one-time import workflow restores these files onto `main`, preserving the previous commits. It then removes itself and these transport parts from the working tree; this checkpoint remains in Git history. No deployment is performed.

Manual recovery from this commit:

```sh
python3 checkpoints/v85/restore.py --output restored
cd restored/Kilo-King-v85
npm ci
npm run build
python3 scripts/reassemble-v85-proofs.py
```

Earlier offline review archives and redundant v85 still frames remain in the private Sites source repository. All current application code, public assets, scripts and build configuration are included byte for byte.
