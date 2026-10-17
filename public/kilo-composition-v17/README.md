# Kilo King — composition v17

These are actual-size **static design proofs**, not browser screenshots or interaction QA. The desktop proof is 1440 × 900 px; the phone proof is 390 × 844 px. PNGs are standalone. SVGs reference existing repository artwork using relative paths.

The generator reads the live layout function, the exact reel fitting function and initial board, plus existing symbol alpha bounds and fit factors. It preserves the 5 × 3 grid and current symbol sizes. Source Sans 3 and Barlow Condensed are converted to vector outlines for deterministic typography. Coordinate JSON files record exact stage, reel, cabinet, title, character and dock boxes.

The proof depicts a fresh base game: balance 500,000 LGC, bet 1,000 LGC, win 0. Cabinet paint, controls and the environment grade are represented in SVG. Fine material shading, shadows, masks and browser text rasterization may differ from the implementation. This does not verify responsive interactions, animation, runtime performance or keyboard/touch behavior.

Regenerate from the repo root with:

```sh
node scripts/render-composition-proofs.mjs
```

See manifest.json for artwork hashes, geometry, typography and limitations.

The index.html review page provides Desktop/Phone, Base game/Features and Fit/Actual size controls. It does not run the game. Feature frames show the Buy features tab: two purchase cards on desktop and the first card on phone, with the pager and compact Ante utility. Desktop panel composition assumes an 8px thin scrollbar gutter; browser flex sizing and intrinsic text widths may differ slightly.

Dependencies: installed project TypeScript, Python 3 with fontTools and WOFF2/Brotli support, and Sharp available either in node_modules or CODEX_PRIMARY_RUNTIME_NODE_MODULES. The generator only reads existing artwork and uses lossless in-memory PNG decoding where the SVG rasterizer cannot decode WebP.
