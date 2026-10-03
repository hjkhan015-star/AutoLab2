# Changelog

## 8.7.2 - Control-system refactor, Phase 7b2 (canvases and meters)
- Decision per canvas / meter (table in MONITOR-MAP.md, "Phase 7b2"): **trace** for time series, **row** for a plain number, **stage canvas** for a picture that is not a time series. No gauge was needed.
- Traces (Monitor): starting-system `speed` (engine rpm + starter rpm ÷ 12, 0–redline), electrical `wave` (3 phases + DC out, alternator mode only), lubrication `temps` (oil / bearing / wall, 20–500 °C, 4 Hz), mpfi `trimhist` (STFT / LTFT, ±20 %, 80 samples), cooling `temp` (55–125 °C, 180 samples). Samples are pushed from the existing update path; Reset sends `null`. Sample maths moved out of the draw functions unchanged (electrical: `waveSamples`, taken at fixed phase steps so the picture still shows 3 cycles).
- Rows: starting-system `amps` (starter current; the Battery meter was a duplicate of the `bat` row and is gone), mpfi `trim` (the trim-state word), cooling `surface` (Surface area ↔ Thermostat status).
- Stage canvases: gearbox (torque by gear), exhaustsystem (acoustic spectrum), ignition (spark advance vs rpm), crankshaft-piston (piston motion graph). New kit API `ui.stage.canvas({ id, label, width, height, corner, size })`, `ui.stage.caption(id, text)`, `ui.stage.remove(id)`: a card over the 3D stage, bottom corner, above the dock, no pointer events. Never in the dock or the info panel.
- `monitor.js`: new `rowLabels` channel in `update()` (a row's name may follow the module's mode); rows keep their key node.
- Removed: the dock widgets of gearbox (torque panel + its collapse chevron, gear / rpm / SHIFT header: duplicates of status and rows `in` / `out`; SHIFT is drawn in the chart), starting-system (key meters, strip chart, strip note), electrical (waveform panel + legend), exhaustsystem (sound panel + note), the panel canvases of ignition / crankshaft-piston / lubrication / mpfi (lubrication's graph block, mpfi's graph block), cooling's two `ui.monitor.root.appendChild` sites (graph SVG + surface bar). Their CSS went with them. `ui.panel.remeasure()` once where a panel lost a canvas.
- Fix found by the new test: mpfi's trace id must differ from its `trim` row (ids are unique across rows / traces / gauge): trace `trimhist`.
- Tests (`tests/monitor.test.mjs`, 42 groups): no `<canvas>` / svg chart in the nine pages, old charts / history buffers / CSS gone, nothing appends into the Monitor, stage canvases only through `ui.stage.canvas` and not in widgets, configs validate with fixed ranges, the electrical waveform equals the old canvas formula, sample maths unchanged, Reset clears each trace, `rowLabels`, `ui.stage` CSS tokens only. Cache `autolab-v8.7.2`.
- Lost on purpose (the Monitor trace is a plain line chart): lubrication's green / amber / red temperature zones, mpfi's ±2 % target band, cooling's temperature-coloured line + area fill and surface bar, starting-system's dashed starter line, the Monitor draws no axis labels (the range is in the trace caption: °C, %, rpm).
- Not verified (no browser): any drawing, the stage canvas position on a phone (bottom-left over the 3D view, `min(224 px, 60 vw)`), trace smoothness, light theme, reduced motion. The two new DOM tests were not run here (no jsdom); a scratch run against a hand-made DOM stub exercised `rowLabels` and the trace push / clear paths.

## 8.7.1 - Control-system refactor, Phase 7b1 (chip -> Monitor)
- 23 bespoke pages (abs-esc, automatic, braking, carburetor, clutch, cooling, crankshaft-piston, differential, ecu, electrical, engine, exhaustsystem, gearbox, ignition, lubrication, mpfi, obd2, starting-system, steering, suspension, transmission, turbocharger, valvetrain) declare `monitor: { config, initial }` instead of `chip:` and call `ui.monitor.update(...)`; adjacent calls in one block are merged. Values, ids, labels and units unchanged.
- `kit.js`: removed the `ui.chip` getter, `chipToMonitor()`, the `chip:` fallback and `ui.toolbar.setRpmLabel`. `monitor.js`: new `label` channel in `update()`; every row carries `data-row="<id>"` (module CSS hook).
- cooling uses the Monitor status tone instead of status classes; engine flushes the stroke name immediately; exhaustsystem changes the head label through `update({ label })`; ecu's material key `chip` is now `pcbChip`.
- Tests (`tests/monitor.test.mjs`, 31 groups): no page uses `ui.chip` / `chip:` / old chip selectors, every converted page has a `monitor:` block, no adjacent unmerged updates, label channel and tone, optional jsdom group. Cache `autolab-v8.7.1`.

## 8.7.0 - Control-system refactor, Phase 7a complete (Monitor traces + rpm rows)
- Rebased onto the Phase 6 build (v8.6.2): Phase 7a part 1 was first built on Phase 5; it is now applied on top of Phase 6 and 6.5.
- The ten guided modules (awd, catalytic, commonrail, dpf, driveshaft, egr, fuelpump, intercooler, oilpump, radiator): the panel graph canvas, `drawGraph()`, the history buffer, the `*-warn` element and their CSS are gone. Each module declares `CFG.traces` (one trace `hist`, two series, token colours) and returns `traces: { hist: [a, b] | null }` and a status that carries the warning sentence (warn tone). Samples are normalised to 0-100 % of the old axis ranges. Simulation maths unchanged.
- `components.js`: `CFG.traces` -> the Monitor config; `traces` from `mod.update()` are forwarded every frame (`pushTraces`); `status` takes an optional third tone item.
- `monitor.js` / `monitor-core.js`: status tone (`warn` / `crit`), `traces: { id: null }` clears a trace (module Reset), series colours may be `var(--token)` (resolved for the canvas), a colour key per labelled series, and on phones the card shows the full fault sentence (aria-hidden copy; the strip stays the one live region).
- `setRpmLabel`: all 13 callers moved. Rows added: `speed` (automatic), `rpm` (carburetor, clutch, cooling, differential, mpfi, starting-system, turbocharger). Duplicates removed: abs-esc (static unit), electrical, exhaustsystem, ignition, suspension. `ui.toolbar.setRpmLabel` stays defined (no-op) until 7b.
- Tests: `tests/monitor.test.mjs` +7 groups (no graph code / `*-warn` / `<canvas>` in the ten modules, `CFG.traces`, no `setRpmLabel` caller, rpm rows, status tone, trace clear). Cache `autolab-v8.7`.
- Not verified (no browser): trace drawing and smoothness, the phone strip + card, nothing overlapping the dock, light theme, reduced motion.

## Phase 6 follow-up (v8.6.2)
- lighting: dip switch is a 3-stop `choice` (id `dip`, Off / Low beam / High beam, default Low) in the primary zone; no slider. `guidedCtls` returns `[]` for `CFG.ctl === null`. Tests +2. Cache `autolab-v8.6.2`.

## 8.6.0 - Control-system refactor, Phase 6 (`choice` / `toggle` / `action`)
- `controls.js`: three new primitives. `choice` (`layout:'segmented'` = ARIA radiogroup with roving tabindex and ←/→; `'select'` = a token-styled native `<select>`; `'gate'` = the H-pattern stick drawn as SVG, ↑/↓ shift, `N` / `Esc` / `Home` = neutral, optional per-option `x,y` and `rail` segments), `toggle` (`role="switch"`, Enter / Space on the focused element only) and `action` (momentary click, no stored value, `onAction`). The registry stores the selected INDEX for a choice and 0 / 1 for a toggle; `controls.value(id)` = option id / boolean. Options are `['A','B']` or `[{id,label,tone:'crit'}]`. `controls.setHidden(id, bool)` hides a mode-dependent control without losing its value. Still exactly one `requestAnimationFrame` call site.
- `controls-core.js` (pure, tested): `normalizeOptions`, `choiceIndex`, `choiceId`, `choiceDefault`, `clampChoice`, `stepChoice` (clamp or wrap), `toggleDefault` / `toggleValue` / `toggleFlip`, `gateKeyToIntent`, `isChoice` / `isToggle` / `isAction`; `realValue` / `fromReal` / `snapNormalized` / `defaultNormalized` / `keyToIntent` understand them.
- `UI.create({options:[…]})` and `ui.addOptions([…])` put them in the dock options row (`primary:true` puts one in the primary zone). `runGuidedModule` passes `CFG.options` through and runs `CFG.onReset` before `controls.resetAll()` on the dock Reset. The options row is a single scrollable line with fade edges; chips are 40–44 px in portrait.
- Migrated 31 modules. Guided (awd, catalytic, commonrail, dpf, driveshaft, egr, fuelpump, intercooler, oilpump, radiator): fault / surface / type / cycle selects -> `choice`, Cool down / Cold start / Refuel / Zero / Bleed / Clean / Cool core -> `action`, DPF Force regen -> `toggle`; the panel fold + Reset buttons and the panel markup / CSS for them are deleted. The panel's 1× / 5× / 20× is the module's own thermal time-compression, so it stays as a `timescale` choice (separate from the menu's Sim speed). Others: the ‹ › configuration switchers (braking, carburetor, steering, turbocharger, engine, gearbox, starting-system, exhaustsystem, cooling) -> a `config` choice; toolbar extras (engine slow-mo, turbocharger rotor slow, suspension Susp/Rigid + slow-mo, ecu fault, abs-esc WSS fault, obd2 clear, crankshaft-piston CYL / BLK / GAS, valvetrain ADV +10°) -> dock controls; braking ABS / FAIL / AIR, lubrication oil, differential traction + four toggles + camera, electrical battery direction + ignition, transmission drivetrain, mpfi actions, exhaustsystem sound / muffler / mixture, starting-system ignition, automatic P R N D (primary zone), gearbox H-stick -> `gate`.
- Removed: `window.__brakeSyncIcons`, `__carbSyncPlayIcons`, `__coolingSyncIcons` (the kit syncs the play icons), the `.cfg-*` / `.br-toggle` / `.cam-btn` / `.drive-btn` / `.al-fault-btn` / `.at-gearsel` / `.key-btn` etc. CSS, and the SVG H-shifter widget in gearbox.
- Behaviour notes: actions have no lit state (mpfi Cold start); the gearbox gate steps through N, 1–4, R in order; dock Reset now also resets the new toggles / choices; engine's stroke buttons are one `stroke` choice that follows the simulation and jumps `theta` when the user picks.
- Left on purpose: sparkplug, thermostat, tyres, wiring author their own bespoke UI and never used the kit (`check.mjs` WARNs on them); the gearbox torque-chart chevron and the quiz option buttons are content, not controls.
- Tests: `tests/choice.test.mjs` (option / index maths, registry index + 0/1 storage, listeners on change only, key intents, gate keys, static module checks, optional jsdom group); `tests/check.mjs` gained an advisory WARN for kit modules that author their own controls, retired toolbar extras or `window.__*Sync*` hooks. Existing `dock` / `dial` / `shell` tests adjusted for the removed sync hooks, the new CSS block and the new cache. Cache `autolab-v8.6`.

## 8.6.0 - Control-system refactor, Phase 7a part 1 (Monitor core + guided-module `apply()`)
- New `monitor-core.js` (pure, unit-tested: channel validation, rolling buffer, rate limiter, value → bar / gauge mapping, formatting, trace range) and `monitor.js` (channels: value + bar, rows with ok / warn / crit / hi tones, gauge, trace, status with the ONE polite `aria-live`, footer). Phone: one-line strip (`--monitor-strip-h`) with the primary value + status; tap opens a card (max `--monitor-max`). Desktop: a card with the collapse orb. Text refresh ≈ 9 Hz (trailing flush so the last value always lands), traces ≈ 30 Hz, no layout measuring on text writes.
- `kit.js`: `ui.monitor.set / update / flush / open`; `UI.create({ monitor })`; legacy `chip:` configs are translated (`chipToMonitor`); `ui.chip.*` are thin wrappers over the Monitor (deleted in 7b). `_wireAutoCollapse` no longer watches DOM mutations: it measures on tab switch, a `ResizeObserver` and `ui.panel.remeasure()`.
- `runGuidedModule`: `apply()` writes only through `ui.monitor.update`; the panel `ro-*` grid moved into Monitor rows (a ro row equal to the big-value label is dropped, chip rows sharing a ro id are one row). `mod.update()` return shape unchanged.
- Styles: Monitor block in `controls.css` (tokens only, reduced-motion safe). `sw.js` precaches both new files; cache `autolab-v8.6`.
- Tests: `tests/monitor.test.mjs` (rolling buffer, rate limiter, mapping, validation, merge regression, static acceptance). `check.mjs` syntax-checks the new files; version pins in `dock` / `shell` tests relaxed to `v8.[5-9]`; the dial CSS test now ends at the Monitor block.
- Remaining 7a work (graph canvases → traces, `*-warn` → status, `setRpmLabel` → rows): see `PHASE-7a-PART2.md`. `MONITOR-MAP.md` is the inventory.

## 8.5.0 - Control-system refactor, Phase 5 (`dial`: wheel / crank / knob)
- `controls.js`: new `dial` primitive (`createDial`, `controls.dial`, `controls.dragging`). `look:'wheel'|'crank'|'knob'`; drag anywhere with pointer capture (angle from the pointer, unwrapped across ±180°); `range` degrees, `wrap:true` (crank) or clamped (wheel); optional `spring:'return'` on the SHARED animation loop (still exactly one `requestAnimationFrame` call site); ←/→ 10° (→ = clockwise = right), `Enter` / `Home` = default, `role="slider"` with degree `aria-*`; `onGrab(active)`; reduced motion = no spring. `UI.create({axes})` and `CFG.ctls[]` host dials.
- `controls-core.js` (pure, tested): `angleFromPointer`, `unwrapDelta`, `wrapDeg`, `dialToDeg`, `degToDial`, `dialDefault`, `snapDial`, `dialRealValue`, `dialAddDelta`, `dialSpringStep`, `isDial`; `realValue` / `fromReal` / `snapNormalized` / `defaultNormalized` understand dial specs (`controls.value(id)` = degrees); `dialValueText` reads a crank as plain degrees; `keyToIntent('dial')` handles wrapping dials and `Enter` / `Home` (`{reset:true}`); the registry clamps a wrapping dial to 0..1.
- Migrated `engine` (`crank`, 0–720°, wraps; the crank angle is gone from the badge, the panel row and the chip), `steering` (`wheel`, ±180°, springs to centre; "Centre wheels" and the on-screen label removed), `differential` (`wheel`, ±129.6° = ±`MAX_STEER_ANGLE`; Auto Drive drives the dial and any touch disengages it as before), `awd` (`steer`: the interim 0–100 % slider is now a ±180° wheel, `S.steering = |dial|`, so 0 / 50 / 100 % = centre / 90° / full lock).
- Deleted the copy-pasted `steer-*` / `crank-*` / `sw-*` markup, CSS and pointer / key handlers. Arrow-key signs unified: → is clockwise (the old steering and differential handlers already agreed visually; their internal variables just used opposite signs). Space no longer centres the wheel (it stays play / pause); Enter / Home do.
- Tests: `tests/dial.test.mjs` (angle ↔ normalised mapping, 720° wrap, unwrap across the seam, key direction, spring equivalence + frame-rate independence, `dialValueText`, `controls.value`, static module checks, optional jsdom DOM group). Cache `autolab-v8.5`.

## 8.4.0 - Control-system refactor, Phase 4 (`axis` pedal look + `momentary`)
- `controls.js`: `axis` takes `look:'pedal'` (vertical 54×158 on desktop, 52 px horizontal bar on phones; pointer capture; `spring:'return'` + `k`; ticks; ARIA slider; ↑/↓; Shift-hold quick press; Space does nothing) and a new `momentary` primitive (clutch: pointer, Shift, Enter/Space on the focused element; registry 0/1; events on both edges). ONE shared animation loop for every pedal (starts on first release, stops when all are at rest); `prefers-reduced-motion` releases instantly. `UI.create({axes})` also hosts `type:'momentary'`.
- `controls-core.js` (pure, tested): `decayFactorToK`, `springStepAxis`, `pedalIntent` / `pedalUpIntent`, `createPedalModel`, `PEDAL_RAMP`.
- Migrated `braking` (`brake`, k 7.67), `automatic` (`throttle`, 9.05; P R N D untouched), `carburetor` (`throttle`, 9.05), `turbocharger` (`throttle`, 7.67), `abs-esc` (interim slider -> pedal, id `brake`, 7.67), `clutch` (momentary `clutch`). Deleted the five copy-pasted pedal widgets (`wirePedal`, `springRelease`, `cancelReturn`, `__setPos`, …) and their CSS (`.br-pedal-*`, `.at-pedal-*`, `.carb-pedal-*`, `#accel-*`, `.clutch-pedal-*`, the turbocharger light-theme override). Pedal captions ("Press & hold · 0%", "Hold to disengage") removed: the pedal shows its value once. Each module's Reset calls `ui.controls.resetAll()`.
- `abs-esc`: a pedal springs back to 0, so the old resting default of 40 % brake is gone.
- Tests: pedal maths, frame-rate independence, Shift-hold model, momentary edges (`tests/controls.test.mjs`); static greps + optional jsdom DOM tests (`tests/axis.test.mjs`). Cache `autolab-v8.4`.

## 8.3.0 - Control-system refactor, Phase 3 (`axis` slider + single-quantity fixes)
- New `controls.js` (`axis`, slider look) + `.ctl-axis` styles in `controls.css`: 44 px target, value bubble while dragging, unit + `aria-valuetext`, focus ring, reduced-motion safe, ↑/↓ keys. One shared store (`ui.controls.get/value/raw/set/on/resetAll`); duplicate ids throw. `controls-core.js` gained step-snapped real-value helpers (`realValue`, `rawValue`, `fromReal`, `snapNormalized`).
- `runGuidedModule` takes `CFG.ctls[]` (`CFG.ctl` kept as a shim). The 10 multi-slider guided modules (awd, catalytic, commonrail, dpf, driveshaft, egr, fuelpump, intercooler, oilpump, radiator) moved their hand-written sliders into the dock; the single-slider guided modules use the shim. `UI.create` takes `axes:[…]`.
- `ecu` (load), `valvetrain` (cam advance), `crankshaft-piston` (rod ratio), `abs-esc` (brake %, as a slider for now) use axes. fuelpump uses real volts (preset `voltage`, `scale` 100).
- D8/D16: `ignition` (engine rpm), `mpfi` (engine load), `abs-esc` (vehicle speed), `cooling` (engine rpm) have their own axes and no longer read `state.speedMul` as a physical quantity. The Phase 1 temporary slider (`data-phase1-temp`, `#speed-module`) is gone.
- Removed `.al-range`, `.ui-tb-speed*`, `Widgets.slider`. `awd` "Steering input" is an axis for now (becomes a dial in Phase 5). A module's Reset now also resets its axes.
- New `tests/axis.test.mjs`; axis mapping tests in `tests/controls.test.mjs`. Cache `autolab-v8.3`.


## 8.2.0 - Control-system refactor, Phase 2 (stage layout & dock)
- New `dock.js`: one control dock per module document (embedded AND standalone) - handle (swipe up = options row, down = 56 px slim bar), transport (play/pause, reset - one node each), primary zone (1 = centred, 2 = left/right thumb zones, 3+ = pages with dots), options row (Flow + module extras). Default 24 vh, max 30 vh; landscape phones get two 140 px side rails; desktop is one auto-height bar. State persists per module in `sessionStorage` (`autolab.dock.<moduleId>`); the dock hides while a `<select>` soft keyboard is open. Pure logic is unit-tested (`tests/dock.test.mjs`).
- Stage: `#canvas-wrap` (and `#labels-root`, so labels never draw over the dock) is inset by `--stage-top` (0 embedded, header height standalone) and `--dock-h`. `kit.js` adds a `ResizeObserver` on the stage; the camera view is nudged up on portrait phones.
- `UI.create` keeps `widgets:{bl,br}`, `toolbar`, `extras` but mounts them inside the dock. Bottom slots `bl`/`br`/`bc` are removed. Info panel is a bottom sheet (<= 50 vh, closed by default) opened by the header i on phones and a side panel on desktop; the readout chip is a one-line strip on phones.
- Standalone modules draw the same `chrome.js` header + menu as the shell (owner = module; D/L/W/X keep the menu in sync). Standalone Back button removed. Default label density is Key on phones.
- Flow toggle restored (dock options row). Play/reset restored for embedded modules.
- Fixed double click-wiring of play/reset in `automatic`, `braking`, `carburetor`, `cooling`.
- z-index limited to the R10 scale in `app.css`/`index.html`; `100vh` -> `100dvh` in `wiring.html`/`404.html`; Phase 1 leftovers removed from `app.css`. The `!important` LEGACY block moved to `legacy.css` (loaded by `sensors.html` only, until Phase 8).
- Cache `autolab-v8.2`.

## 8.1.0 - Control-system refactor, Phase 1 (shell & chrome)
- New `chrome.js` (32 px header + single ⋯ menu), `keys.js` (one keymap), chrome styles in `controls.css`.
- Shell: removed the floating pill, the floating back/⋯ buttons and the old settings sheet. The menu now holds only sim speed, label density, theme, wireframe, x-ray. Sim speed is shown as a multiplier (it used to be labelled in rpm).
- Protocol: `setLabelDensity`, `toggleInfo`, `key` (both directions), module→shell `state {playing|density}`.
- Kit: embedded modules no longer build play / reset / sim-speed / Flow / density nodes. One keydown path; Space is no longer a pedal in braking, clutch, turbocharger.
- `ignition` (engine rpm) and `mpfi` (engine load) keep their own visible slider and no longer read `state.speedMul` (temporary, `data-phase1-temp`).
- Cache `autolab-v8.1`.

## 7.0.0 - Sharper, richer visuals
- Sharpness: v6.0's adaptive resolution was too eager and dropped pixel ratio on ordinary frame dips. It now starts at full resolution, waits out the warm-up, only steps down after two windows below ~30 fps, never goes under 80% of full, and recovers quickly. Removed `backface-visibility` on the module frame (could soften compositing).
- Higher pixel-ratio caps (low 1.75, mid 2, high 2.5); antialiasing on low-end screens under 2x DPR; 4096 shadow map on desktop high-end.
- Colour: studio environment map (512x256 with soft cool/warm light boxes) replaces the dark 64px gradient, so metals reflect properly; brighter key/hemisphere lights; higher tone-mapping exposure; tone mapping now on for low-end too; +14% saturation / +5% contrast on the canvas (skipped on low-end).
- Cache `autolab-v7.0`.


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
