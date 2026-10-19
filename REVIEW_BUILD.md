# Kilo King review hosting

Upstream: https://github.com/feraka-letgoteam/kilo-king-sandbox-review

Upstream commit: `bdb2e5b544a33b7c6a20e7a730e0d3813d7905d4`

Artwork: `sandbox-20261016/kilo-sandbox-source.zip`, SHA-256 `4a3a7c561a4b8181b3426ba8723428bce127a5780be22eed8e9425505ed0ff3a`. Source files match this release.

The hosted root uses the existing standalone `review.html` entry point. Add `?review` to open the saved scene selector. The build script runs only `build:review`, copies its HTML to the root, and does not run migrations. The Source link points to the supplied release archive because its former local ZIP was absent. Gameplay, layout, assets, and settlement logic are unchanged.
