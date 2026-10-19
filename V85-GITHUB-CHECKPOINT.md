# Kilo King v85

This branch contains the source and runtime assets for the deployed private v85 preview.

- Original source commit: `7e6105e6975e6a6a9128eb4f0f13d13d41bf3bab`
- Application, public assets, configuration and scripts are preserved byte for byte.
- Current proof clips, proof metadata and verification reports are included.
- Earlier offline art/proof archives and duplicate still frames remain in the private Sites source repository.
- `SOURCE-CHECKPOINT-V85.json` records every imported file and its SHA-256.

## Run

```sh
npm ci
npm run build
npm run dev:review
```

## Proof movies

```sh
python3 scripts/reassemble-v85-proofs.py
```

The 19 clips are stored as exact binary parts under `art/kilo-v85/proofs/`. Reassembly does not transcode. See `art/kilo-v85/README.md` for the change notes and verification limits. The movies are offline production-controller captures, not live browser/GPU evidence.

This import changes no game code, math, wallet, controls or layout. It does not deploy anything. The previous GitHub source remains available in this branch's history.
