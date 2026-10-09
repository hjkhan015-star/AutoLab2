# vendor/

Third-party code that ships with Auto Lab so it runs with no CDN (offline, locked-down networks).

**three.js r160** goes in `vendor/three/` (not committed to this zip because the build sandbox had no internet).

One-time setup, from the project root:

    node vendor/fetch-three.mjs                     # downloads r160 from unpkg
    node vendor/fetch-three.mjs --from <folder>     # or copies from a local three@0.160.0 package (e.g. after `npm pack three@0.160.0`)
    node tests/check.mjs

It writes `vendor/three/three.module.js` and the four addons the app uses (OrbitControls, RoomEnvironment, BufferGeometryUtils), points every page's import map at them, adds them to the `sw.js` precache, removes unpkg.com from the CSP in `_headers` and the `<link>` hints in `index.html`, and bumps the minor version so installed copies refresh. Running it twice is harmless.
