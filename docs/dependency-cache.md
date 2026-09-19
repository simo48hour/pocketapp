Dependency cache
================

Run `npm run prepare:dependencies` to generate `public/prebuilt/node_modules.tar.gz`,
`manifest.json` (SHA-256, size and dependency versions), and the companion lockfile.
The production build runs this command automatically. Generated binary assets are
ignored by Git; the generator, extractor, exact package manifest and lockfile are committed.

The canonical package manifest and lockfile are in `scripts/prebuilt/`.
To update dependencies, edit its package.json, regenerate its lockfile with
`npm install --package-lock-only --ignore-scripts`, then align the package.json and
package-lock.json entries in `app/utils/bundledTemplates.json` and rebuild the cache.
Never generate the archive from the host platform's application node_modules.
The locked esbuild and Rollup aliases use WASM implementations for portability.

Boot fetches the manifest, reads the archive from Cache Storage (or downloads it),
checks its SHA-256, writes it to WebContainer, and extracts it with the supplied
Node ustar extractor. This avoids depending on a native tar executable. The extractor
preserves npm CLI symlinks and verifies the esbuild and Rollup runtime imports.
Only then does the WebContainer promise resolve to the workbench.

Before either restored projects or generated projects start, the dependency gate
checks package versions and overrides. Compatible projects skip npm. Other projects,
including older starters with version ranges, run npm once per manifest in that
container. Missing/corrupt archives remove the partial tree and use the same fallback.
The archive is retained across page refreshes in Cache Storage; extracted files live
only for the current WebContainer session. No application records are cached here.

Serve all files under /prebuilt on the same origin (or configure a CDN with CORS).
Do not cache manifest.json indefinitely. Archive requests include the checksum as
a version query. The initial download is about 21 MB; download speed, WASM startup,
and extraction time still affect latency. Under-three-second browser startup has
not been verified. Cache Storage denial falls back to ordinary fetching.
