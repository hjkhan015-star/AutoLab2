# AutoLab2 (Auto Lab v7.0)

Interactive 3D automotive learning lab (44 modules, installable offline PWA). Static site — no build step.

## Publish on GitHub
1. Create a new repo named `AutoLab2` and push this folder to `main`.
2. Repo **Settings → Pages → Source: GitHub Actions**. The `Deploy to GitHub Pages` workflow tests and publishes on every push; the site appears at `https://<user>.github.io/AutoLab2/`.
3. `CI` runs `npm test` on every push and pull request.
4. GitHub Pages ignores `_headers`. To get the CSP and other headers, host on Netlify or Cloudflare Pages instead.
5. No license file is included — add one (e.g. MIT) before making the repo public if you want others to reuse it.

## Deploy
Upload the folder root to any static host (Netlify, Cloudflare Pages, GitHub Pages, S3+CDN). Must be served over **HTTPS** for the service worker and install prompt.
`_headers` (Netlify / Cloudflare Pages format) sets a CSP, nosniff, referrer and permissions policy, and no-cache on `sw.js` / `index.html`. On other hosts, replicate those headers.

## Test
`npm test` (or `node tests/check.mjs`) checks syntax, viewport, guard.js, precache list, local refs and the module registry. Run before every release.

## Local test
`python3 -m http.server 8080` then open http://localhost:8080 (service workers work on localhost).

## Release checklist
0. Run `npm test`.
1. Bump `VERSION` in `sw.js` on every release so clients refresh their cache.
2. Add new module HTML to `CORE_ASSETS` in `sw.js` and to `modules.js`.
3. Module pages using Three.js must include `<script src="guard.js"></script>` before the import map.

## Known dependency
Three.js 0.160.0 loads from unpkg (cached by the service worker after first visit). For a fully self-hosted build, download `three.module.js` and `examples/jsm/` into `/vendor/three/` and change the import map URLs (`three`, `three/addons/`) in each module, plus the `modulepreload` links and CSP/`sw.js` host rule in `index.html`.

See `GUIDE.md` and `COMPONENTS.md` for module authoring.
