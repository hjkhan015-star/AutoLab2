# DECISIONS-WA — Wheel Alignment module

## Phase 0 — recon, scaffold, shared widgets

**Repo findings**
- Flat repo: every page and shared script sits in the root; `tests/check.mjs` fails any stray root file or unprecached page/script. So the prompt's `wheel-alignment/` folder became root files: `alignment-model.js`, `alignment-parts.js`, `wheel-alignment.html`. `DECISIONS-WA.md` was added to the check's root allowlist.
- Modules register in one place: `modules.js` (system *chassis*, after Tyres, plus the system's flow strip). Precache: `sw.js` `CORE_ASSETS`. Version string lives in 7 files and is checked; bumped 8.9.4 → 8.10.0.
- Shell pattern: `runGuidedModule(CFG, build)` from `components.js` (used by tyres, steering…). It owns `buildScene`, `UI.create`, monitor, dock and bridge, so the module reuses them and builds no parallel UI.
- Controls available: axis (slider/pedal), momentary, dial, choice, toggle, action. Missing and added: equalizer slider and a segmented-spec monitor bar.

**Assumptions**
- Equalizer is `axis` with `look: 'equalizer'` (still one native range input, same registry, keyboard, aria). Extra spec fields: `band [lo,hi]`, `zero`, `detent`, `tickEvery`, `ends`, `zeroLabel`. Plain arrows move one step, Shift+arrow ten, Home centres, drag snaps inside the detent.
- Segmented-spec is a monitor row option: row `[id, label, { spec: { min, max, lo, hi } }]`, patched with `[text, tone, number]`. Existing rows are unaffected.
- Phase switcher (Toe · Camber · Caster · Platform) is deferred: with only the shell built, a one-option switcher or dead links would be placeholders. It is added when Phase 1 creates the second page.
- Phase 0 scene shows the reference car at mid-spec on a floor, with one real control (ride height) and a vehicle preset choice; the monitor shows live spec bars from the model.
- `alignment-fx.js` is not created yet (nothing would use it before Phase 1).
- Conventions: toe + = in; camber − = top in; thrust + = pushes right; L/R difference = left − right. Wear, pull and fuel curves use `tanh` saturation (smooth, monotonic), constants are illustrative.
- Hatchback spec bands: front camber −1.0…0.0 (−0.5 ± 0.5), rear −1.5…−0.5; sports and SUV presets shift these.
- Pre-existing: `tests/check.mjs` reports 9 dead-code failures in `differential.html` on the untouched upload. Left alone; Phase 0 adds none.

## Phase 1 — Toe (`wa-toe.html`)

**Files:** `wa-toe.html` (page and control glue), `wa-toe-scene.js` (three.js scene, reads the model), additions to `alignment-model.js`, a `[hidden]` rule for axes in `controls.css`, a page switcher (Overview · Toe) on both pages.
- Toe page is fixed to the *Family hatchback* preset (spec bands are drawn on the faders). The vehicle choice stays on the Overview page.
- Faders are generated once from one table. Total mode shows Front and Rear total; Individual hides those two and shows four wheel faders (`controls.setHidden`). Changing any fader rewrites the model, then every fader is synced from the model, so the values always agree.
- Effects use the error *outside* each wheel's spec band, so a car in spec reads 0. Zero toe on the rear is 0.05° below its band, so it shows a very small penalty; front 0° is in band and reads 0.
- Units (deg / mm / arc-min) change the fader text and the Monitor; mm is per-wheel across the tyre diameter.
- Exaggeration (1/4/8/20×, default 8) scales only the drawn angle. A test asserts the readouts do not move.
- Thrust line: + thrust draws to the car's right (−x; the scene's left side is +x).
- Auto-drive: the road grid scrolls and the car drifts sideways by the model's pull; the scrub arrows pulse.
- Camera presets Top / Axle / Patch glide for about 1.6 s, then hand back to the orbit controls.
- Tyre wear overlay: a canvas texture per tyre (heat across the width from the wear map, saw-tooth from feathering), repainted only when the state or a flag changes.

**Not done in Phase 1 (honest list):** angle arcs with labels on the projected lines; turnbuckle thread animation of the tie-rod sleeve; tread cross-section inset; animated steering-wheel icon; braking squat; tread blocks, brake disc, caliper, strut, rack and tie-rod geometry (the car is still the Phase 0 simple body with rims). Tyre wear "worn tie-rod" preset is front only.

**Verification limits:** the sandbox is offline, so the page was not rendered in a browser. Scene logic is tested with a stub three.js (line directions, drift, camera glide, payload); the equalizer widget was driven in Chromium in Phase 0. Control glue (mode hiding, unit repaint) is untested in a browser.
