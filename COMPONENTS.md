# Auto Lab v8.9.3 — Components and Control Reference

The building blocks. How to put them together: `GUIDE.md`.

## 1. Files and what they export

| File | Public API |
|---|---|
| `kit.js` | `buildScene`, `attachResize`, `createUIState`, `UI.create(cfg)`, `monitorRows`, `createMaterials`, geometry helpers (`halfCylShell`, `makeHelixSpring`, `tubeBetween`, `makeFlange`, `makeCog`, …), `createParticleTexture`, `createLabelSystem`, `getLabelDensity`, `setLabelDensity`, `THREE`, `OrbitControls`, `controls`, `DEG`, `TAU`. |
| `chrome.js` | `createHeader`, `createMenu({ hide })`, `chromeButton(doc, { cls, id, label, html, type, attrs })`, `nextDensity`, `isPhone`, `clampSpeed`. |
| `controls.js` | `controls` (registry API), `createAxis`, `createMomentary`, `createDial`, `createChoice`, `createToggle`, `createAction`, `quizOptionHTML`. |
| `dock.js` | `createDock`, `DOCK` constants, pure layout helpers. |
| `monitor.js` | `createMonitor`. |
| `components.js` | `Parts`, `createGeoKit`, `Widgets` (`overview`, `faults`, `quiz`, `legend`, `wireQuiz`), `guidedCtls`, `runGuidedModule`. |
| `labels.js` | `createLabelSystem`, `KINDS`, `DENSITY_INFO`, `getLabelDensity`, `setLabelDensity`. |

## 2. `UI.create(cfg)`

| Key | Value |
|---|---|
| `moduleId` | string; keys the dock's saved state. |
| `panel` | `{ kicker, title, tabs: [{ id, label, icon?, color? }], onTab(id), badge: { text, color } }`; the info panel (`ui.panel.body`, `.expand()`, `.collapse()`, `.selectTab(id)`, `.remeasure()`). |
| `monitor` | `{ config, initial }`; see section 5. |
| `toolbar` | `{ play, reset, speed: { label, min, max, step, value }, labels }`; play and reset go to the dock's transport. `extras` is retired: use `options`. |
| `axes` | list of axis / momentary / dial specs; primary zone of the dock. Each may carry `side: 'left' | 'right'` and `onChange(real, raw, norm)`. |
| `options` | list of choice / toggle / action specs; the dock's options row, or the primary zone with `primary: true`. |
| `widgets` | `{ bl, br }` compatibility slots, `{ html, caption, onMount }`; mounted in the dock's primary zone. |

Returns `ui` with `ui.controls`, `ui.axis(id)`, `ui.addOptions(list)`, `ui.panel`, `ui.monitor`, `ui.stage`, `ui.toolbar` (`.dock`), and `ui.wireBridge({ viewManager, state, onCommand, menuHide })`. `menuHide` hides the ⋯ menu rows a 2D page cannot use (`'density'`, `'wireframe'`, `'xray'`); inside the shell it is sent in the module's `ready` message and `createMenu(...).setHidden(list)` applies it.

## 3. Controls (specs)

Every spec needs an `id` (unique per page). `preset` fills defaults; explicit fields win. Values live in the registry as 0..1.

| Type | Spec fields | `value(id)` |
|---|---|---|
| `axis` (default) | `look: 'slider' \| 'pedal'`, `label`, `ariaLabel`, `preset`, `min`, `max`, `def`, `step`, `unit`, `decimals`, `scale`, `format(real)`, `hint`, `side`, `color`; pedal only: `spring: 'return'`, `k`, `keys: 'arrows'`, `ticks`, `ramp` | real number (step-snapped) |
| `momentary` | `label`, `ariaLabel`, `keys: 'arrows'` | 0 / 1 |
| `dial` | `look: 'wheel' \| 'crank' \| 'knob'`, `range` (360), `wrap`, `def` (degrees), `step`, `spring: 'return'`, `k`, `side`, `color`, `onGrab(active)` | degrees; positive = clockwise |
| `choice` | `layout: 'segmented' \| 'select' \| 'gate'`, `label`, `options: ['A', 'B'] \| [{ id, label, tone: 'normal' \| 'crit' }]`, `def` (id or index), `wrap`, `neutral` (gate), `primary`, `side`, `onChange(id, index)` | option id |
| `toggle` | `label`, `def: false`, `onChange(bool)` | boolean |
| `action` | `label`, `tone: 'normal' \| 'crit'`, `onAction()` | none (`controls.on(id, fn)` fires on click) |

Registry (`ui.controls` = `kit.controls`): `has(id)`, `spec(id)`, `get(id)` (0..1), `value(id)`, `raw(id)` (value × `scale`), `set(id, n)`, `on(id, fn)` (returns an unsubscribe), `resetAll()`.

Presets: `rpm`, `load`, `ambient`, `vehicle-speed`, `voltage`, `percent` (values in `GUIDE.md` §7).

## 4. Guided CFG (`runGuidedModule`)

| Field | Meaning |
|---|---|
| `moduleId`, `title`, `kicker`, `accent`, `badge` | identity and the info-panel header |
| `camPos`, `target`, `floorY` | camera and floor |
| `ctl: { label, val, caption }` | the main 0–100 % axis (id `ctl`, read as `k`); `ctl: null` for none |
| `ctls` | explicit axis specs (replaces `ctl`) |
| `options` | choice / toggle / action specs |
| `chipLabel` | name of the Monitor's big value |
| `rows`, `ro` | Monitor rows `[id, label]`; a row named like `chipLabel` is dropped |
| `traces` | Monitor traces (section 5) |
| `legend` | `[[colour, text]]`; shown as the Monitor footer. Colours are tokens (`'var(--c-cyan)'`) |
| `overview`, `faults`, `quiz` | panel content; `quiz` is `[question, [answers], correctIndex, explanation]` |
| `onReset()` | called on Reset, before `controls.resetAll()` |

`build(H)` returns `{ labels: [[text, [x, y, z]]], update(c), showLabel?(i) }`. `update` receives `{ t, dt, k, sp }` and returns `{ big, unit, bar, rows, ro, status: [text, on, tone?], ctl, traces }`.

## 5. Monitor

`ui.monitor.set(config)` rebuilds; `ui.monitor.update(patch)` writes; `flush()`, `open(on)`, `isOpen`.

**config:**

| Field | Meaning |
|---|---|
| `label` | card title |
| `value` | `{ label, unit, max, bar: true }` the big number and its bar |
| `rows` | `[[id, label]]` |
| `traces` | `[{ id, label, min, max, length, series: [{ id, label, color }] }]`; `color` is a token such as `'var(--c-orange)'` |
| `gauge` | optional gauge config |
| `footer` | HTML; the legend (`.mon-legend`, swatches `<i style="background:var(--c-…)">`) |
| `status` | `{ text }` |

**update patch:** `label`, `value: { text, unit, bar, barColor, color }`, `rows: { id: text \| [text, tone] }`, `rowLabels: { id: text }`, `traces: { id: [v, …] \| null }` (one sample per series; `null` clears), `gauge`, `footer`, `status: [text, on, tone?]`. Tones: `ok`, `warn`, `crit`.

Choose a surface: **row** for a plain number, **trace** for a time series, **stage canvas** for a picture that is not a time series, **gauge** for a single bounded meter. Never write `ui.monitor.root`.

## 6. Stage canvases

`ui.stage.canvas({ id, label, width, height, corner: 'bl' | 'br', size })` returns the `<canvas>`; `ui.stage.caption(id, text)`; `ui.stage.remove(id)`; `ui.stage.root`.

## 7. Dock

Built by `UI.create`. States: `slim` (56 px), `default` (24 vh), `options` (44 px row added); ceiling 30 vh. Primary zone: 1–3 controls in thumb zones, 4 or more as pages with dots. Landscape phones: two 140 px side rails. Desktop: one bar. Extra API on `ui.toolbar.dock`: `addOption(node)`, `addPrimary({ id, side, node })`, `refresh()`.

### Hero layout (Phase 9b, phone portrait)
Dial, pedals and clutch are *compact* controls. With 1–2 of them (and at most one slider) the dock becomes `[transport | compact controls | slider + options]`: pedals are vertical, options are always on the right and scroll vertically. `heroPlan(kinds)` decides; module specs do not change (their `side:` is ignored here).

### Options grid and "More" (Phase 9b)
Phone portrait never scrolls the options sideways. `.al-dock-options` is a wrapping grid; every option is a **cell** (small label above, 44 px control below). Toggles / actions / Flow are compact chips side by side; the zone may scroll vertically, never horizontally.
- **More rule:** more than 4 cells → the first 3 stay, a 44 px **More** chip (`aria-expanded`, `aria-haspopup="dialog"`) opens a glass sheet (`role="dialog"`, `aria-label="More options"`, `--z-menu`) with the rest in the same grid. Esc, the scrim and **Done** close it; focus is trapped and returns to the chip. `splitOptionCells(cells, max = 4)` in dock.js is the single rule.
- **Choice with many items:** a segmented control with more than 4 segments wraps into rows of up to 4 (`segGrid(n)`; the last button fills its row); every item stays one tap away. A choice with 4+ segments, a `select` or a gate takes a full row; shorter ones share a row.
- Landscape phone rails and the desktop bar keep their layout (no chip). The wide (≥ 1024 px) left rail uses the same cells without a chip: a choice takes a full row, chips sit side by side, the rail scrolls vertically. Layout and tap sizes never depend on `data-ui-tier`.
- Spec authors change nothing: `options: [...]` and `addOptions` are as before.

## 8. Colour tokens

| Use | Tokens |
|---|---|
| Surfaces | `--bg`, `--bg-elev`, `--surface`, `--surface-2`, `--surface-3` |
| Text | `--text`, `--text-dim`, `--text-mute` |
| Borders | `--border`, `--border-hi` |
| State | `--ok`, `--warn`, `--crit`, `--accent`, `--info` |
| Categorical (legends, trace series) | `--c-red`, `--c-orange`, `--c-amber`, `--c-yellow`, `--c-lime`, `--c-green`, `--c-cyan`, `--c-sky`, `--c-blue`, `--c-violet`, `--c-pink`, `--c-slate` |
| Fixed neutrals | `--ink` (shadows, dark fills, text on an accent), `--paper` (highlights, text on a filled colour) |
| Per module | `--al-accent` (declared as a hex in the page; the only hex allowed) |

Alpha: `color-mix(in oklch, var(--c-red) 20%, transparent)`.

## 9. Side-panel widgets (`components.js` → `Widgets`)

`overview(cfg)`, `faults(cfg)`, `quiz(cfg)` (builds the self-check; answer buttons come from `controls.js` `quizOptionHTML`), `legend(cfg)` (the Monitor footer HTML), `wireQuiz(host)` (one click handler for every `.al-q` in `host`). Hand-written quiz markup is not allowed in a page; pass `{ quiz: [...] }` to `Widgets.quiz`.

## 10. 3D helpers (`createGeoKit(ctx)`)

`mat`, `glass`, `glow`, `box`, `cyl`, `cylX`, `cylZ`, `sph`, `tor`, `pipe`, `stream`, `V3`, `clamp`, `lerp`, `lc`, `put`; plus `Parts`: `tubeBetween`, `coilSpring`, `additivePoints`, `DEG`, `TAU`. 3D material colours stay in JS; everything in CSS is a token.
