# Auto Lab — Shared Components (v5.0)

## Files
| File | Purpose |
|---|---|
| `components.js` | Shared 3D helpers (`createGeoKit`), panel widgets (`Widgets`) and the guided-module runtime (`runGuidedModule`) |
| `components.css` | Styles for readout grid, overview sections, faults, quiz, legend (`.al-*`); sliders, pedals, hold buttons and dials are styled in `controls.css` (`.ctl-axis`, `.ctl-pedal`, `.ctl-momentary`, `.ctl-dial`) |
| `kit.js` / `labels.js` / `app.css` | Unchanged base engine, labels, theme |

## Link a module (2 lines + 1)
```html
<link rel="stylesheet" href="app.css">
<link rel="stylesheet" href="components.css">
<script type="module">
  import { runGuidedModule } from './components.js';
  const CFG = { /* text, quiz, faults, readouts, legend, ctls[] (sliders) */ };
  function build(H) { const { box, cyl, mat, pipe, stream, THREE } = H; /* parts */ return { labels: [...], update(c) {...} }; }
  runGuidedModule(CFG, build);
</script>
```
Keep `:root { --al-accent: #hex; }` (and the light-theme line) in the module `<style>`.

`H` provides: `THREE root lowEnd mat glass glow V3 clamp lerp lc put box cyl cylX cylZ sph tor pipe stream Base`.
If `build()` uses a helper, destructure it from `H` (they are no longer module-level globals).

## Converted to shared components (18)
airfilter, awd, catalytic, coilplug, commonrail, dpf, driveshaft, egr, fuelpump, intercooler, lighting, oilfilter, oilpump, radiator, sparkplug, thermostat, tyres, wiring.
Each dropped from ~17 KB to ~5 KB; the geometry kit, panel UI, quiz, loop and 36 CSS rules now live once.

## Shared parts (`Parts`, also available as `H.Parts`)
| Part | Replaces | Used by |
|---|---|---|
| `Parts.tubeBetween(a,b,r,mat,segments)` | local `tubeBetween` | exhaustsystem, starting-system |
| `Parts.coilSpring({radius,length,turns,wire,mat,axis,centered,samplesPerTurn,samples,radial})` | `coilSpring`, `makeSpring`, `makeCoilSpring` | clutch, lubrication, suspension |
| `Parts.additivePoints(tex,count,size,opacity,{color,renderOrder,parent})` | point-cloud setup in 4 stream builders | mpfi, turbocharger, braking, electrical (and `H.stream` style modules) |
| `Parts.DEG` / `Parts.TAU` | local `DEG`/`TAU` constants | 11 modules now use `Base.DEG`/`Base.TAU` |
Geometry is identical to the old copies (checked vertex-by-vertex).

## Panel CSS / quiz (all 23 panel modules)
obd2, ecu, abs-esc, crankshaft-piston, valvetrain now link `components.css` and use `Widgets.wireQuiz()`. Only real differences stay local (`.al-w` min-width; `.al-pins` in obd2). `.al-sel` moved into components.css.

## Deliberately NOT merged (different look/behaviour — needs a visual check)
- Road wheels: suspension `makeWheel`, steering `makeRoadWheel`, differential `makeWheelAssembly` (different axes, tread, animation hooks). (`makeSimpleWheel` in steering is a steering wheel, not a road wheel.)
- Gears (differential bevel gears, starting-system teeth, steering gears), pulleys, fans/impellers, shock absorbers, hoses: each is built differently per module.
- Stream update logic (`updateStream`) differs per module; only the shared point-cloud setup was merged.
To merge one of these: add it to `Parts`, keep the old function as a thin wrapper, compare in a browser.

## Sliders: `axis` (Phase 3)
One slider primitive for the whole project: `controls.js` builds it, `controls.css` styles it (`.ctl-axis`), `controls-core.js` holds the maths.
- **Guided modules:** list sliders in `CFG.ctls[]`. `ctls[0]` has id `ctl` (main 0-100 % control, read by `update({k})`; `apply({ctl:'…'})` sets its text). Each extra entry is an axis spec plus `onChange(real, raw, norm)`.
  `{ id:'rpm', preset:'rpm', max:5500, def:2400, label:'Engine speed', onChange:(v)=>{ S.rpm = v; } }`.
  `CFG.ctl { label, val, caption }` still works (shim -> `ctls[0]`).
- **`UI.create` modules:** `axes: [spec, …]` (hosted in the dock's primary zone). Read values with `ui.controls.get(id)` (0..1), `.value(id)` (real units), `.raw(id)` (value x `scale`, e.g. centivolts). Never read a slider's DOM value. Reset: `ui.controls.resetAll()`.
- **Presets:** `rpm` 800-5000 (def 1800) - `load` 0-100 % - `ambient` -10..45 °C (def 20) - `vehicle-speed` 0-160 km/h - `voltage` 8-15 V (def 13.5, `scale` 100) - `percent`. Override any field in the spec.
- **Sim speed is not a quantity.** `state.speedMul` is sim speed (⋯ menu) only; engine rpm / load / vehicle speed are their own axes.


## Pedals and momentary buttons (Phase 4)
One pedal primitive (`axis` with `look:'pedal'`) and one hold-button primitive (`momentary`), both built by `controls.js` and styled in `controls.css` (`.ctl-pedal`, `.ctl-momentary`). Used by `braking` (`brake`), `automatic`, `carburetor`, `turbocharger` (`throttle`), `abs-esc` (`brake`) and `clutch` (`clutch`, momentary).
- **Spec:** `axes:[{ id:'throttle', look:'pedal', label:'Throttle', preset:'percent', spring:'return', k:9.05, keys:'arrows', ticks:3, side:'right', color:'var(--crit)' }]`. `look:'pedal'` = pedal pad; `spring:'return'` = springs back to the default on release; `k` = spring rate in s⁻¹; `keys:'arrows'` = Shift-hold also works while the page body has focus; `ticks:n` = tick marks; `ramp` = Shift-hold speed (default 4 per second); `ariaLabel` overrides the label for screen readers.
- **Spring rate `k`:** time-based, so a release takes the same time at 30, 60 or 144 Hz. Convert an old per-frame factor with `decayFactorToK(factor)` = −ln(factor)·60 (0.86 → 9.05, 0.88 → 7.67). `prefers-reduced-motion` releases instantly.
- **Look:** desktop vertical 54×158 px; phone (`max-width:720px` or `max-height:540px`) a horizontal bar 52 px high. One shared animation loop in `controls.js`; it only runs while a pedal is moving.
- **Keys:** ↑/↓ step 8 % and stay; Shift (hold) = quick press, release springs back; **Space does nothing on a pedal** (it stays play/pause). Auto-repeat is ignored.
- **ARIA:** `role="slider"`, `aria-valuemin/max/now`, `aria-valuetext` with unit ("62%"), `aria-label`, `:focus-visible` ring.
- **Reading it:** `ui.controls.get('throttle')` (0..1), `.value('throttle')` (0–100). `ui.controls.set('throttle', n)` sets it and leaves it there (no spring). `ui.controls.resetAll()` releases it; call it from the module's Reset.
- **Momentary:** `axes:[{ id:'clutch', type:'momentary', label:'Clutch', keys:'arrows' }]`. `ui.controls.get('clutch')` is 0 or 1; `ui.controls.on('clutch', fn)` fires on both edges. Press with the pointer (captured), Shift, or Enter / Space on the focused element. The module keeps its own easing (the clutch's engage / disengage).
- **Do not** hand-build a pedal, keep a `throttle` / `pedalPos` variable, or add per-module key handlers for ↑/↓/Space/Shift.

## Dials: wheel, crank, knob (Phase 5)
One rotary primitive (`type:'dial'`), built by `controls.js` (`createDial`, `controls.dial(spec)`) and styled in `controls.css` (`.ctl-dial`). Used by `engine` (`crank`), `steering` (`wheel`), `differential` (`wheel`) and `awd` (`steer`).
- **Spec:** `axes:[{ id:'wheel', type:'dial', look:'wheel', label:'Steering', range:360, def:0, step:1, spring:'return', k:4.68, side:'right', onGrab:(on)=>{…} }]`. `look` = `'wheel' | 'crank' | 'knob'` (one inline SVG each); `range` = total sweep in degrees; `wrap:true` (default for `crank`) = wraps at `range` instead of clamping; `def` = default angle in degrees; `step` = degree step used by `value()`; `spring:'return'` + `k` (s⁻¹) = released dial returns to its default on the shared loop; `onGrab(active)` fires when the user starts / stops holding it (pointer or key). Guided modules put the same spec in `CFG.ctls[]`.
- **Registry:** a clamped wheel / knob stores −1..1 (± range/2); a wrapping crank stores 0..1 (0..range). Positive = clockwise = a right turn. `controls.get(id)` = that value (continuous); **`controls.value(id)` = degrees**, clockwise positive, snapped to `step`; `controls.set(id, n)` / `setValue(id, deg)` move it exactly (no spring, cancels a running spring). `controls.dragging(id)` is true while the user holds it.
- **Pointer:** drag anywhere on the dial (pointer capture); the angle comes from the pointer (0° = up, clockwise +), unwrapped across ±180°. **Keys:** ←/→ turn 10°, **→ is clockwise in every module**; `Enter` and `Home` = back to the default (the one reset path); Space stays play/pause. `role="slider"`, `aria-valuemin/max/now` in degrees, `aria-valuetext` ("12° right", "centre", crank "123°"), focus ring, `prefers-reduced-motion` = no spring animation.
- **Look:** 132 px on desktop, **96 px on phones**, never below 44 px; the angle is small text next to the name (shown once; no caption). Tokens only (no hex / rgba).
- **Simulation owns its own sign:** `steering` keeps `steerAngle > 0 = left` and reads `steerAngle = −dial · π`; `differential` keeps `steerAngle > 0 = clockwise`. Auto Drive turns the dial with `controls.set` (never springs). `engine` keeps its own `theta` and mirrors it into the dial every frame; user turns come back through `ui.controls.on('crank')`.
- **awd mapping:** `S.steering = |dial|` (0..1) — centre = 0 %, 90° either way = 50 %, full lock either way = 100 %; no spring.
- **Do not** hand-build a wheel / crank, keep a `steerAngle` drag state, or add ←/→/Enter handlers for it in a module.

## Options: choice, toggle, action (Phase 6)
`controls.js` exports `createChoice`, `createToggle`, `createAction` (also `controls.choice / toggle / action`). A choice registers its selected index, a toggle 0 / 1; `controls.value(id)` returns the option id or a boolean, an action has no value.
- `choice` layouts: `segmented` (radiogroup, ←/→), `select` (native, tokens), `gate` (SVG stick: ↑/↓, `N` / `Esc` / `Home` = neutral; options may carry `x,y`, spec may carry `rail:[[x1,y1,x2,y2],…]`).
- `toggle`: `role="switch"`; `action`: `onAction()`, `inst.trigger()`.
- Host: `UI.create({options:[…]})`, `ui.addOptions([…])`, `CFG.options` (guided); `primary:true` + `side` for the primary zone. `controls.setDisabled / setHidden(id, bool)`.
- Pure helpers in `controls-core.js`: `normalizeOptions`, `choiceIndex`, `stepChoice`, `gateKeyToIntent`, `toggleFlip`, …

## Monitor (Phase 7a) — `ui.monitor`
One readout surface per module. Modules never import `monitor.js`; they use the kit API.
```js
ui.monitor.set({ label, value:{label,unit,max,bar}, rows:[[id,label]], traces:[{id,label,series:[{id,color}],min,max}],
                 gauge:{id,label,min,max,unit}, status:true, footer:'<html>' });
ui.monitor.update({ value:{text,unit,bar,barColor,color,tone} | text, rows:{ id: 'text' | ['text','ok|warn|crit|hi'] },
                    traces:{ id:[v, …] }, gauge: v | [v,'text'], status:['text', on] });
```
Text writes are limited to ≈ 9 Hz (the latest value always lands); trace samples are buffered at once and drawn ≈ 30 Hz. Unknown row ids are ignored. `ui.chip.*` still works (thin wrappers) until Phase 7b removes it.
In `runGuidedModule`, keep returning `{ big, unit, bar, rows, ro, status, ctl }` from `mod.update()`; `ro` rows are Monitor rows.

**Guided modules (7a-2):** declare `CFG.traces = [{ id:'hist', label, min:0, max:100, length:150, series:[{ id, label, color:'var(--accent)' }, …] }]` and return `traces: { hist: [a, b] }` (one sample, only when due; `null` clears on Reset) plus `status: [text, on, 'warn'|'crit'|'']` from `mod.update()`. A warning sentence is the status (`status: [warn || state, true, warn ? 'warn' : '']`). Keep one history: the Monitor's. Series colours are tokens (`var(--accent)`, `var(--warn)`, …), never hex.
**Speed rows:** a module prints engine / vehicle speed as a Monitor row (`ui.monitor.update({ rows: { rpm: text } })`), never through `ui.toolbar.setRpmLabel`.


### Monitor, Phase 7b2 additions
- A canvas that shows a **time series** becomes a Monitor trace: `monitor: { config: { traces:[{ id, label, min, max, length, series:[{ id, label, color:'var(--accent)' }] }] } }`, then `ui.monitor.update({ traces:{ id:[v…] } })` from the existing update path (one sample per call; no second history buffer) and `traces:{ id:null }` on Reset. Keep real units and the old fixed `min` / `max`; put the unit in the trace `label`. Trace, row and gauge ids share one namespace (a trace may not reuse a row id).
- A number is a **row**; a bounded single quantity may be a **gauge**. `ui.monitor.update({ rowLabels:{ id:'New name' } })` renames a row when the module's mode changes (cooling: Surface area ↔ Thermostat status).
- A **picture that is not a time series** (a spectrum, an advance curve, a torque map, a curve over a 720° cycle) stays a canvas, on the stage: `const cv = ui.stage.canvas({ id, label, width, height, corner:'bl'|'br', size })` (logical size `width × height`, CSS width `size` px, never wider than 60 vw), `ui.stage.caption(id, text)` for a caption that changes with the mode. Draw into `cv` as before. The layer sits over the 3D stage above the dock, ignores pointer events and must not hold a control. Never put a canvas in the dock, the info panel or the Monitor.
- A mode-specific channel: call `ui.monitor.set(otherConfig)` on the mode change, then `ui.monitor.update` the current values (electrical's alternator waveform). `set()` clears every trace.

### Monitor, Phase 7b1 additions
- `ui.chip.*`, the `chip:` config and `ui.toolbar.setRpmLabel` no longer exist. Use `UI.create({ monitor: { config, initial } })` and `ui.monitor.update({ ... })`.
- `ui.monitor.update({ label })` changes the head label at runtime (the one label channel). `status` is `[text, on, tone?]`, tone `'' | 'warn' | 'crit'`.
- Every row has `data-row="<id>"`: a module may style one row from its own CSS (`#ui-monitor [data-row="phase"] .mon-row-v`). Do not query or append into the Monitor's DOM; if a module needs a graph, it is a trace.
- Merge the writes of one function into ONE `ui.monitor.update({ label, value, rows, status })`; call `ui.monitor.flush()` only when a user action must show at once.
