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

## Phase 2 — Camber (`wa-camber.html`)

**Files:** `wa-camber.html`, `wa-camber-scene.js`, camber additions to `alignment-model.js`, `Camber` added to `WA_PAGES` (page switcher now Overview · Toe · Camber on all three pages).
- Faders: Axle mode shows front and rear camber (mean of the two wheels, left/right difference kept); Individual mode shows four wheel faders. Range ±3°, step 0.05°, centre detent 0.05°, spec band drawn from the hatchback preset.
- Each wheel pivots about its contact patch (`tiltAboutContact`), so the patch stays on the road and the centre moves sideways. The wheel-plane line (yellow) and plumb line (white) both start at the patch.
- Contact-patch heat-map: a flat plane under each tyre painted blue → green → red from `pressureProfile` (even at −0.5°, inner shoulder loaded for more negative camber). The Monitor shows the inner / outer load split.
- Load transfer in a turn: body roll follows `0.7 g · sin(0.9 t)`; the outside wheel's camber moves toward positive and the inside wheel's toward negative by `roll × (1 − gain)`. Gain: MacPherson 0.5, wishbone 0.75. The hatchback preset is MacPherson-style, so its gain is the lower one. Displayed values in the Monitor stay static camber; only the picture and the grip row's cornering figure use the dynamic value.
- Grip index: cornering best near −1.5° dynamic camber, braking best near 0°.
- Pull: reuses `lateralPull` (a car pulls toward its more positive camber side).
- Same limits as Phase 1: not rendered in a browser (offline sandbox); scene logic is covered by stub-three tests (tilt direction, patch pivot, exaggeration vs readouts, camera glide).

**Not done in Phase 2:** eccentric-bolt / shim adjustment inset, tread cross-section inset, braking-comparison panel, per-wheel brake-force vs camber chart, and the detailed strut/wishbone geometry (the picture still uses the Phase 0 simple car).

## Phase 3 — Caster (`wa-caster.html`)

**Files:** `wa-caster.html`, `wa-caster-scene.js`, caster additions to `alignment-model.js`, `Caster` added to `WA_PAGES` (switcher: Overview · Toe · Camber · Caster).
- Controls: left and right caster equalizer faders (−2° to +8°, step 0.1°, spec band +3…+6 drawn); steering = the shared `dial` (look `wheel`, ±360° of steering wheel, ratio 14:1 → ±25.7° road wheel, no spring). Toggles: Show kingpin axis, Show trail, Road test (pull), Caster-swing demo (±20°). Options: presets (Spec +4°, Low caster, Left/right mismatch), Visual × (1/2/3×, default 2×), camera (Side / Front / Top / Orbit). Action: Hands-off release.
- Geometry: the steering axis passes through the wheel centre and is tilted by the drawn caster; it meets the road ahead of the contact patch by `R·tan(caster)` (the trail, drawn as an arrow along the road from the patch to the intercept). Upper and lower ball-joint markers sit on the axis. Positive caster tilts the top rearward (−z; the car faces +z).
- Hands-off release: `releaseStep` integrates the self-centring torque with damping ζ≈0.8 scaled by the stiffness, so more caster settles sooner and overshoot stays small (tested). The simulation writes the steering dial every frame; touching the dial cancels it.
- Camber gain: `camberGainWheel` — positive caster makes the OUTSIDE wheel more negative and the INSIDE wheel more positive (left turn: left +, right −), magnitude `caster · sin(steer)`. This corrected a wrong sign comment in the Phase 0 model comment (the function `camberGain` itself is unchanged). The tilt is drawn on the real wheels, best seen from the Front camera.
- Pull: `lateralPull` — mismatch pulls toward the side with LESS caster. Road test scrolls the road, drifts the car and shows a pull arrow.
- Caster swing: `swingDelta` / `casterFromSwing` (±20°): the Monitor shows the camber change and the caster it recovers.
- Bug fixed from Phase 1: auto-drive drifted a right-pulling car to the left (+x). It now moves to the car's right (−x); a test covers both directions.

**Deviations from the prompt:** the camber-gain "front-view companion inset" is the Front camera preset on the real wheels, not a second viewport; "lean in the turn" is not drawn here (Phase 2 shows body roll). The measuring-concept inset is the swing demo plus its Monitor row, not a drawn camber-gauge picture. Trail has no dimension-line label in the scene (the Monitor and arrow carry it). Same verification limit as before: not rendered in a browser.

## Realistic car (all pages)

`alignment-parts.js` was rewritten; `buildCar` / `buildTyre` / `buildRim` keep their API, so the shell, Toe, Camber and Caster pages use it unchanged.
- **Body:** side-profile extrusions with bevels (lower body with true wheel-arch cut-outs, dark arch liners and flares), a greenhouse shell with inset glass windows, pillars, sloped windscreen and rear glass, mirrors, door shut lines and handles, headlamps and tail lamps (emissive), grille, bumpers, number plate, underbody and a soft contact shadow. Paint is a clear-coat physical material. Proportions come from a per-preset style table (hatchback blue, sports sedan red and low, SUV graphite and tall with more ground clearance); the hood line keeps at least 0.07 m above the arch.
- **Wheels:** tyre with sidewall bulge, rounded shoulders and three tread grooves (profile points are evenly spaced across the tread so the wear texture still maps cleanly); alloy rim with lips, ten twin spokes, centre cap and lug nuts; brake disc and hub, red caliper; knuckle, strut with coil spring, lower control arm and (front only) an orange tie rod. All of it sits in the wheel group, so toe, camber and steer move it together.
- `car.body` is now a Group at the ground origin: the shell page's ride-height slider lifts the whole shell and the Camber page's body roll rotates it about the road. A spoke rotation bug (spokes were skewed) was fixed on the way.
- Checked: the new geometry runs under the stub three.js tests and the side profile was plotted for all three presets to check proportions and arch clearance. **Not checked in a browser** (offline sandbox): please look at the three vehicle presets and tell me what to adjust.
