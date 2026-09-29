# Changelog

## 6.1.0
- Fixed label wobble in all modules except cooling. Causes: (1) a CSS `transition` on label `transform` stacked on top of JS smoothing; (2) the JS eased the label's absolute screen position, so it lagged behind moving anchors; (3) collision avoidance re-ran every frame and flipped labels between slots.
- Fix, modelled on cooling's callouts: label = anchor + stored offset (rigid, no lag); offsets are solved at most 4x/second with a sticky preferred slot; flip-side hysteresis; sub-pixel anchor deadband; whole-pixel transforms.
- Added `tests/labels.test.mjs` (in `npm test`).

## 6.0.0
- Smoothness: adaptive render resolution in `kit.js` (drops pixel ratio when frames run slow, restores it when there is headroom); `content-visibility` on cards, press feedback, GPU-isolated module frame, contained scrolling. All respect reduced-motion.
- Progress: "Explored X of N" card, checkmark on explored modules, stored locally (`autolab.visited`).
- Updates: service worker no longer swaps itself in mid-session; users get a "New version available - Reload" prompt. Hourly update check. Cache `autolab-v6.0`.

## AutoLab2 repo
- Added `.gitignore`, `.gitattributes`, `.nojekyll`, GitHub Actions CI (`npm test`) and GitHub Pages deploy workflow. App code is unchanged from v5.0.

## 5.0.0
- Added `tests/check.mjs` + `package.json` (`npm test`): syntax, viewport/zoom, guard.js, precache coverage, broken refs, registry ids.
- Added `404.html` (precached, noindex) and `robots.txt`.
- `index.html`: Open Graph/Twitter meta, `<noscript>` message.
- `_headers`: added `frame-ancestors 'self'`, `upgrade-insecure-requests`, noindex on 404.
- Service worker cache renamed `autolab-v5.0`.

## 4.0.0
- Accessibility: removed `maximum-scale=1, user-scalable=no` from 19 pages (pinch-zoom allowed).
- New `guard.js`: friendly recoverable message on missing WebGL or failed 3D-library load (previously a blank screen). Added to all 42 Three.js modules.
- Service worker: cache renamed `autolab-v4.0`; precaches `guard.js` and maskable icon.
- Manifest: added stable `id`.
- Added `_headers` (CSP, nosniff, referrer/permissions policy, cache rules), `README.md`, this changelog.
- Docs updated to v4.0.
