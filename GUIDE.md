# Auto Lab v8.10.2 — Build Guide

How a module page is put together, how to add one, and the rules the tests enforce.
Reference tables (every control spec, every Monitor channel) are in `COMPONENTS.md`.
`npm test` fails on any rule marked **[test]**.

## 1. Files

| File | Owns |
|---|---|
| `index.html` | The shell: module cards, search, install, the header's ⋯ menu host, one iframe per open module. |
| `modules.js` | The module registry (id, title, file, domain). |
| `app.css` | Reset, **tokens** (colours, spacing, type, the `--c-*` categorical palette, `--ink` / `--paper`), base layout. |
| `controls.css` | Dock, header, stage inset, control and Monitor styles. Tokens only. |
| `components.css` | Side-panel widgets (overview, faults, self-check). |
| `kit.js` | `buildScene`, `UI.create`, `wireBridge`, materials, label re-exports, `monitorRows`. |
| `chrome.js` | Header (`createHeader`), the ⋯ menu (`createMenu`), `chromeButton` (the one place kit chrome buttons are built). |
| `controls.js` / `controls-core.js` | Every control primitive (axis, pedal, momentary, dial, choice, toggle, action) and the pure logic and registry behind them. |
| `dock.js` | The control dock: layout, states, pages, swipe. |
| `monitor.js` / `monitor-core.js` | The Monitor: value, rows, traces, gauge, status, footer. |
| `labels.js` | 3D label system and the one label density (`getLabelDensity` / `setLabelDensity`). |
| `keys.js` | The one keymap. |
| `components.js` | `createGeoKit`, `Widgets`, and `runGuidedModule` (the 18 guided pages). |
| `guard.js` | WebGL / import failure overlay; `<html data-no3d>` skips the WebGL check (sensors). |
| `sw.js` | Service worker. **One** `VERSION` constant and `CORE_ASSETS` (every file that exists). |

## 2. The rules **[test]**

- **One place (R1).** Every control is one node, built by `controls.js`. A module never writes `<button>`, `<select>`, `type="range"` or `createElement('button')`; it declares a spec. Allowed to build controls: `controls.js`, `chrome.js`, `dock.js`, `monitor.js` (plus the shell `index.html`, `404.html`, and `guard.js`'s single Retry button).
- **One dock, one Monitor (R2).** Controls live in the dock, numbers live in the Monitor. A number is printed once. The dock is 24 vh by default and never above 30 vh; the info sheet is at most 50 vh.
- **Tokens only (R3).** No hex / `rgb()` / `rgba()` in any `<style>` or stylesheet except the per-module `--al-accent` declaration. Use `var(--text)`, `var(--c-cyan)`, `color-mix(in oklch, var(--c-red) 20%, transparent)`, `var(--ink)` / `var(--paper)`. A token adapts to the light theme, so a module needs no `html.light-theme` colour overrides. (3D materials in JS are not CSS and keep their own colours. `404.html` loads no stylesheet and is exempt.)
- **One registry (R4).** Control values live in the shared registry as 0..1. Read with `ui.controls.get / value / on`; never read a slider's DOM value.
- **One keymap (R5, R6).** `keys.js`. Each key has one owner; the other side forwards.
- **Touch (R8).** `touch-action: none` and `contextmenu` blocking only on a control's drag surface.
- **Unique ids (R9).** A duplicate control id throws; a duplicate `id="…"` in a page fails the check; a page may not define `btn-play`, `btn-reset`, `speed` or `toolbar-extras`.
- **Layering (R10).** `z-index` only from the scale in `controls.css`.
- **No globals.** No `window.__*` anywhere. Shared state lives in a module (`labels.js` for label density).
- **No charts in panels.** No `<canvas>` or `<svg>` chart inside a panel / widget template; no writes to `ui.monitor.root`; a `ui.stage` canvas is never appended to the dock, panel or Monitor.
- **Precache.** Every `.js` / `.css` / `.html` file that exists is in `CORE_ASSETS`, and every local file a page references is too.
- **One version.** `sw.js` `VERSION`, `README.md`, `GUIDE.md`, `COMPONENTS.md`, `components.js` and `components.css` carry the same number.

## 3. Add a guided module (the usual case)

1. Copy a small page (`airfilter.html`) to `mymodule.html`.
2. Fill `CFG` (fields in `COMPONENTS.md`, "Guided CFG"): `moduleId`, `title`, `kicker`, `accent`, `badge`, `camPos`, `target`, `floorY`, `chipLabel` (the Monitor's big value), `rows` / `ro` (Monitor rows), `legend` (colour tokens), `overview`, `faults`, `quiz`.
3. Controls: `ctl: { label, val, caption }` gives one 0–100 % axis (id `ctl`, read as `k`). For more, set `CFG.ctls = [axis specs]` (use presets) and `CFG.options = [choice | toggle | action specs]`. Use `onChange` to write to a variable your `build()` reads.
4. Write `function build(H)` returning `{ labels, update(c) }`. `update({ t, dt, k, sp })` returns what to show: `{ big, unit, bar, rows, ro, status: [text, on], ctl, traces }`. A time series is a Monitor trace: `CFG.traces = [{ id, label, min, max, length, series: [{ id, label, color: 'var(--c-cyan)' }] }]`, and `update` returns `traces: { id: [v…] }` (a sample only when one is due; `null` clears it on Reset).
5. End the script with `runGuidedModule(CFG, build)`.
6. Register it: add the file to `modules.js` and to `CORE_ASSETS` in `sw.js`; bump `VERSION`; run `npm test`.

## 4. Add a custom module (own scene and update loop)

```js
import * as Base from './kit.js';
const state = Base.createUIState();
const { scene, camera, renderer, controls, viewManager } = Base.buildScene({ camPos: [4, 2, 6] });
const ui = Base.UI.create({
  moduleId: 'mymodule',
  panel:   { kicker: 'Engine', title: 'My module', tabs: [{ id: 'overview', label: 'Overview' }], badge: { text: 'Badge' } },
  monitor: { config: { label: 'Boost', value: { label: 'Boost', unit: ' kPa', max: 200, bar: true },
                       rows: [['rpm', 'Speed'], ['temp', 'Temp']], traces: [], status: { text: 'Running' } },
             initial: { value: { text: '0', unit: ' kPa', bar: 0 }, status: ['Running', false] } },
  toolbar: { play: true, reset: true, speed: { label: 'Sim speed', min: 0.15, max: 2.5, step: 0.05, value: 0.85 }, labels: true },
  axes:    [{ id: 'rpm', preset: 'rpm', side: 'left' }, { id: 'load', preset: 'load', side: 'right' }],
  options: [{ id: 'mode', type: 'choice', layout: 'segmented', label: 'Mode', def: 'a', options: ['a', 'b'] }]
});
const bridge = ui.wireBridge({ viewManager, state, onCommand: (d) => { if (d.action === 'reset') ui.controls.resetAll(); } });
bridge.ready();
// each frame
ui.monitor.update({ value: { text: '120', unit: ' kPa', bar: 60 }, rows: { rpm: '2800 rpm', temp: ['96 °C', 'warn'] }, status: ['Running', true] });
const rpm = ui.controls.value('rpm');           // real value, step-snapped
const mode = ui.controls.value('mode');         // option id
```

- **The dock** is configured through `UI.create({ toolbar, axes, options, widgets })`; later additions go through `ui.addOptions([...])` or, for a node you built, `ui.toolbar.dock.addOption(node)` / `addPrimary({ id, side, node })` then `ui.toolbar.dock.refresh()`. There is no `ui.dock.set`. Read controls with `ui.controls.get(id)` (0..1), `.value(id)`, `.on(id, fn)`, `.set(id, n)`, `.resetAll()`; `ui.axis(id)` returns the instance.
- **The Monitor** is `ui.monitor.set(config)` (rebuilds rows / traces / footer, e.g. on a mode switch) and `ui.monitor.update(patch)` (values: `rows`, `rowLabels`, `traces`, `gauge`, `footer`, `status`). Text is written at ≤ 9 Hz, traces drawn at ≤ 30 Hz, so call `update` every frame.
- **`monitorRows(ui, ids, drop)`** lets old code that writes `ro.x.textContent = …` / `ro.x.className = 'v warn'` write Monitor rows instead.
- **A picture that is not a time series** (spectrum, advance curve, torque map): `const cv = ui.stage.canvas({ id, label, width, height, corner: 'bl' | 'br', size })`, draw into `cv`, change its caption with `ui.stage.caption(id, text)`, remove with `ui.stage.remove(id)`. It floats over the stage, above the dock, with no pointer events.
- **A 2D page** (no 3D scene): add `data-no3d` to `<html>`, link `app.css` and `controls.css`, set `body { padding: var(--stage-top) var(--dock-rail) calc(var(--dock-h) + var(--safe-b)) }`, and give the ⋯ menu `menuHide: ['density', 'wireframe', 'xray']` in `wireBridge`. `data-no3d` also makes `kit.js` skip three.js, so such a page needs no import map and loads offline on a first visit. Inside the shell the module reports `menuHide` in its `ready` message and the shell hides those rows (and ignores W / X) while that module is open. `sensors.html` is the example.

## 5. Keymap **[test]**

| Key | Action | Owner |
|---|---|---|
| Space | play / pause | module (the shell forwards it) |
| R | reset | module |
| D | label density | module |
| L | theme | shell |
| W | wireframe | shell |
| X | x-ray | shell |
| Esc | close the ⋯ menu / go back | shell |
| ← → ↑ ↓ and Shift | adjust the focused control; Shift-hold drives a pedal | the control |

Keys are ignored while typing in an input / select, with Ctrl / Meta / Alt held, and Space on a focused button, link or slider means "activate".

## 6. Mobile budget

- Header: one row, **32 px** (28 px on a landscape phone). Standalone only; embedded modules have no header of their own.
- Dock: default **24 vh**, hard ceiling **30 vh**; slim state 56 px; options row 44 px; landscape phones use two 140 px side rails. Tap targets are at least `--ctl-tap` (44 px).
- Wide screens (**1024 px and up**, not a phone): no bottom bar. Controls live in a **left rail** (280 px, 320 px from 1600 px, scrolls if long), the Monitor is the **right column**, and the model uses the middle at full height. The ‹ handle folds the rail to a 56 px strip (saved per module). 721 - 1023 px keeps the one-row bottom bar.
- Info panel: a bottom sheet of at most 50 vh on phones (closed by default, opened by ⓘ); a side panel on desktop.
- Monitor: a 28 px strip under the header on phones, a card at the top right from 721 px, the right column from 1024 px (never folded to an orb there). Keep the row list short enough to read at a glance (the longest today are crankshaft-piston with 17 and mpfi / lubrication with 11; QA.md tracks them).
- The model sits in the upper / middle of the stage (`--stage-top` to `--dock-h`). A stage canvas must not cover it.
- Motion respects `prefers-reduced-motion`.
- Offline: after the first visit everything (including three.js) is served from the cache.

## 7. Presets

`rpm` (800–5000, 1800), `load` (0–100 %), `ambient` (−10–45 °C), `vehicle-speed` (0–160 km/h), `voltage` (8–15 V), `percent` (0–100). Any field can be overridden: `{ preset: 'rpm', min: 0, max: 7000, def: 0 }`.

## 8. Release checklist

1. `npm test` passes.
2. Bump `VERSION` in `sw.js`; update the version in README, GUIDE, COMPONENTS and the `components.js` / `components.css` headers.
3. New files are in `CORE_ASSETS`; a new module is in `modules.js`.
4. Fill the manual cells of `QA.md`; put small findings in `POLISH.md`.

## 9. Where an improvement goes (extension points)

| To change | Edit | Notes |
|---|---|---|
| Look of every control (size, radius, track, thumb, focus) | the `--ctl-*` tokens at the top of `controls.css`; per-control values (`--ctl-thumb-size`, `--ctl-pad-w`, `--ctl-dial-size`) sit in that control's block | Tokens only (R3). Landscape rails lower the axis floor with `--ctl-axis-min`. |
| Colours, light theme | `app.css` tokens (`--c-*`, `--ink`, `--paper`) | One edit reaches every page and both themes. |
| Dock layout per viewport (portrait sheet, landscape rails, wide left rail, desktop bar) | `dock.js` (`layoutMode`, `dockLayout`, `wideRailPx` are pure and tested) and the `.al-dock[data-mode=…]` blocks in `controls.css` | Add the test beside the change in `tests/dock.test.mjs`. Widths of the wide rails: `--dock-wide-w` / `--dock-wide-slim` (keep them equal to `DOCK.wideRailPx` / `slimPx`; `layout.test.mjs` checks). |
| Wide-screen look of the rail or Monitor column (more width, a different order, a second column on a TV) | the `data-mode="wide"` and `html[data-dock="wide"]` blocks in `controls.css` | Everything is tokens and the two inset variables `--dock-rail-l` / `--dock-rail-r`; the stage, labels and stage canvases already follow them. |
| A new control kind | `controls-core.js` (logic) + `controls.js` (node) + its block in `controls.css` + a row in `COMPONENTS.md` section 3 | Modules only declare a spec. |
| Monitor: a new row, trace or gauge look | `monitor.js` / `monitor-core.js` | Modules only declare channels in their config. |
| A ⋯ menu row | `chrome.js` `createMenu` (rows in the `hideable` map can be hidden per module) | A new view option also needs a shell command in `index.html` and `kit.js` `dispatch`. |
| Shared 3D parts and guided panels | `components.js` / `components.css`, `COMPONENTS.md` | Fix a part once and every module that links it follows. |
| Improving one module | its own `.html` only | Keep controls as specs and numbers as Monitor rows; `npm test` says when a rule is broken. |
