# Auto Lab — Continuation Guide

This documents what was changed in this pass, and exactly how to carry the
same treatment to the rest of the modules.

## What's already done (applies to ALL 44 modules automatically)

These live in the shared files, so every module picked them up with **zero
per-file edits**:

- **`labels.js`** (new file) — the label engine. Every label is auto-scored
  into a priority tier (Primary / Secondary / Detail) based on what it
  names, or you can force a tier explicitly. Labels are colour-coded by
  system (air/fuel/exhaust/coolant/electrical/control/hot/mechanical),
  get a leader line to their exact 3D point, and no longer flicker
  (grace-period + hysteresis instead of hide-then-reshow every frame).
- **`kit.js`** — now imports `labels.js` as `createLabelSystem`; added
  `viewManager.setMeshMaterial(mesh, newMat)` (fixes wireframe/x-ray
  breaking when a module swaps a mesh's material at runtime); added
  `_wireAutoCollapse()`, which auto-caps any panel body taller than
  ~220px and appends a "Show more ▼ / Show less ▲" toggle — only when
  content actually overflows.
- **`app.css`** — new styles for tiered/colour-coded labels + leader
  lines, the auto-collapse panel cap, and a slightly shorter overall
  panel max-height.
- **Three modules patched** for the wireframe/x-ray bug specifically:
  `abs-esc.html`, `electrical.html`, `mpfi.html` — they used to assign
  `mesh.material = X` directly at runtime (a diode blinking, a valve
  glowing hot), which silently reverted that one mesh out of
  wireframe/x-ray mode. They now route through `viewManager.setMeshMaterial()`.
- **`valvetrain.html`** — given an actual simulation upgrade (see below)
  as a worked example of how to do the same to another module.

## Who owns which control (Phase 1 of the control-system refactor)

Every control exists once. The **shell** (`index.html`) draws the 32 px header — back, module title,
info ⓘ, and a single ⋯ — through `chrome.js`. The ⋯ menu (bottom sheet on phones, popover on desktop)
holds exactly: **sim speed, label density (All / Key / None), theme, wireframe, x-ray**. Nothing else.
The old floating pill and the old settings sheet are gone. Title and accent colour come from `modules.js`.

- **Sim speed only ever means sim speed** (shown as `0.85×`). A module quantity such as engine rpm or
  load is the module's own control — never read it from `state.speedMul`. (`ignition`, `mpfi`, `abs-esc`, `cooling` all do this now.)
- **Embedded modules build less, they don't hide.** When the kit detects it is inside the shell it does not
  create play / reset / sim-speed / Flow / label-density nodes. Standalone pages still build them until Phase 2.
- **One keymap** in `keys.js`: Space play/pause · R reset · D label density · L theme · W wireframe ·
  X x-ray · Esc close menu / back. Shell owns L/W/X/Esc, the module owns Space/R/D; each side forwards the
  keys it doesn't own (`postMessage` `type:'key'`). Pedals no longer use Space.
- **Protocol additions** — shell→module commands `setLabelDensity` (0|1|2), `toggleInfo`, `key`;
  module→shell `{type:'key', action}` and `{type:'state', playing | density}`. `setLabels` is kept for compatibility.
- **Theme has one path:** the shell sends `setTheme`; it no longer writes `light-theme` into the iframe.

## The dock and the standalone header (Phase 2)
- **Dock** (`dock.js`, styles in `controls.css`): every module document has one. Bottom sheet on phones (24 vh, max 30 vh), two 140 px rails on landscape phones, one bar on desktop. Phone = `max-width:720px` or `max-height:540px`.
- **Put controls in it through `UI.create`**: `toolbar` (play/reset/Flow/`extras`), `widgets.bl` (primary-left), `widgets.br` (primary-right). Do not add `position:fixed` elements at the bottom of a module.
- **Height inside the shell:** `vh` in an iframe is the iframe height (screen minus the 32 px shell header), so the dock is a few px shorter than 24 % of the screen when embedded.
- **Standalone header:** opened directly, a module draws the same `chrome.js` header (back, title, i, ...) and menu as the shell; title and colour come from `modules.js`. Embedded, the shell draws it and the module reserves no top space (`--stage-top: 0`).
- **Info:** header i opens the info sheet (phones, closed by default) or the side panel (desktop).

## Sliders (Phase 3)
Every slider is an `axis` (`controls.js`): 44 px target, value bubble while dragging, `aria-valuetext` with unit, ↑/↓ keys, focus ring. Values live in one store; modules read `ui.controls.get/value/raw(id)`. Guided modules list them in `CFG.ctls[]`, other modules pass `axes:[…]` to `UI.create`. Engine rpm / load / vehicle speed are their own axes in `ignition`, `mpfi`, `cooling`, `abs-esc` — the ⋯ menu's Sim speed can no longer change them. See COMPONENTS.md for specs and presets.

## Pedals (Phase 4)
Brake, accelerator and clutch are `controls.js` primitives: an `axis` with `look:'pedal'` (spring-back, ↑/↓, Shift-hold) and a `momentary` (clutch). Phones get a 52 px horizontal bar; desktop a vertical 54×158 pedal. Read them with `ui.controls.get('throttle' | 'brake' | 'clutch')`; Space is only play/pause. Modules must not keep their own pedal variable or key handlers. See COMPONENTS.md.

## Dials (Phase 5)
The steering wheel and the engine crank are `controls.js` primitives: `type:'dial'` with `look:'wheel' | 'crank' | 'knob'`. Drag anywhere on it, ←/→ turn 10° (→ = clockwise = right in every module), Enter / Home = default; it is 96 px on phones and shows its angle once, as small text. Read it with `ui.controls.get('wheel')` (−1..1, clockwise +) or `ui.controls.value('wheel')` (degrees). `steering`, `differential` and `awd` use a `wheel`; `engine` uses a wrapping 0–720° `crank`. See COMPONENTS.md.

## Options: choice / toggle / action (Phase 6)
A module never authors a `<button>`, `<select>` or `<input>`. Declare `options: [spec]` in `UI.create` (or `CFG.options` for `runGuidedModule`; `ui.addOptions([...])` if the list is built later):
- `{ id, type:'choice', layout:'segmented'|'select'|'gate', label, options:['A','B'] | [{id,label,tone:'crit'}], def, onChange(id, index) }` — 2–4 short options = segmented, longer lists = select, a gearbox stick = gate.
- `{ id, type:'toggle', label, def:false, onChange(bool) }`
- `{ id, type:'action', label, tone, onAction() }` (no state; a reset is an action only for module-specific extras — the dock Reset already exists).
Read with `ui.controls.value(id)` (option id / boolean), follow the simulation with `ui.controls.set(id, indexOrBool)`, hide mode-dependent ones with `ui.controls.setHidden(id, true)`. Use `primary:true` only for something the user holds or flicks mid-run (a gear selector). Put module-specific resets in `CFG.onReset` (guided) or the bridge's `onCommand` — the dock Reset also calls `controls.resetAll()`. Control ids must be unique per page.

## What's NOT done yet: simulation depth for the other 43 modules

The valvetrain module previously had a cam-advance slider that only
moved a valve *visually* with no consequence. I added a volumetric-
efficiency model so advancing/retarding the cam now visibly shifts a
simulated torque curve, with two new live readouts ("Volumetric eff.",
"Torque effect"). This is the pattern to repeat: **find every module
where a control changes state but nothing else in the simulation reacts
to it, and give it a real, physically-motivated consequence.**

### How to do it for another module

1. Open the module file and find `updateReadouts()` (or the equivalent
   per-frame readout function — every module has one).
2. Find the control(s) — the sliders/buttons in the `bl`/`br` widgets —
   and note what `state.*` field they write to.
3. Ask: "in a real engine, what else changes when this control moves?"
   Examples worth doing, roughly in priority order of teaching value:
   - **turbocharger.html** — boost pressure control currently doesn't
     visibly affect power/efficiency; tie it to a simple power curve and
     an "overboost risk" warning past a threshold.
   - **mpfi.html** / **carburetor.html** (if present) — air-fuel ratio
     control should show a simulated "rich/lean" combustion-quality
     readout, not just a number.
   - **cooling** module(s) — thermostat/fan controls should show a
     simulated engine temperature trending toward a target over time,
     not just an instant on/off state.
   - **abs-esc.html** — wheel-slip control should show simulated stopping
     distance or traction change, not just valve state.
   - **electrical.html** — load (headlights/fan/etc. on) should visibly
     move a simulated battery voltage/charge readout over time.
4. Write a small, named model function near the top of the `<script
   type="module">` block (see `volumetricEfficiency()` in
   `valvetrain.html` for the pattern: a couple of named constants, one
   pure function, a comment explaining the real-world direction of the
   effect and that it's simplified, not a dyno lookup table).
5. Add 1–2 new rows to the module's `readoutHTML()` template with fresh
   `id`s, register them in the `ro = { ... }` object, and set their text
   + a CSS class (`ok`/`warn`/plain) inside `updateReadouts()`.
6. Unit-test the model function in isolation with `node -e '...'` (copy
   just the function, feed it a range of inputs, assert it stays in a
   sane band and moves in the right direction) — see the Node snippet
   used for `valvetrain.html`'s VE model as a template. Don't skip this;
   it's the cheapest way to catch a sign error before it's live.
7. Load the module in a browser and confirm the readout updates live as
   you drag the control, and that nothing else broke (check the browser
   console for errors).

### Optional label/priority tuning per module

The auto-tiering in `labels.js` (`scoreLabel()` / `MAJOR` / `MINOR`
regexes) is a general-purpose heuristic and works out of the box for all
modules, but if a specific module's Key-parts view looks off, you can
override any individual label's tier without touching the shared file —
just pass a tier when adding it:

```js
labels.add('flywheel', 'Flywheel', 1);   // 1 = force Primary
labels.add('ring-gear-tooth', 'Ring gear tooth', 3); // 3 = force Detail
```

or pass an options object to also force its colour category:

```js
labels.add('sensor-x', 'Knock sensor', { tier: 1, kind: 'control' });
```

### Testing note

This sandbox had no network access, so the WebGL scenes couldn't be
rendered end-to-end here — the shared engine/panel logic was unit-tested
directly (DOM + a fake camera, no three.js needed), and the `valvetrain.html`
changes were verified as pure math with no three.js dependency. Before
shipping further changes, do a real visual pass in a browser with network
access (three.js loads from the CDN via the import map in each module).
