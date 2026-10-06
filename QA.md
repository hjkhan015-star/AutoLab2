# QA matrix — Auto Lab v8.9.4

42 module pages (the registry in `modules.js`; the repo also has `index.html` and `404.html`, 44 pages in all) × 4 viewports × 2 modes.

**How to read a cell**
- `auto` — a test in `npm test` proves it for this page (listed below). Nothing to do.
- `☐` — manual. Open the page, check, and replace `☐` with `✓` (pass) or `✗ <note>` (fail; also add a line to `POLISH.md`).
- `n/a` — does not apply (an embedded module has no header of its own).

**What `auto` means, exactly**
| Column | Proved by |
|---|---|
| header 32 px | `controls.css` sets `--hdr-h: 32px` (28 px landscape) and the standalone header uses it (`tests/dock.test.mjs`). Embedded modules have no header. |
| dock ≤ 30 vh | `dockLayout` / `dockHeightPx` are pure and tested at phone sizes with the 30 vh ceiling; landscape uses two 140 px rails (`tests/dock.test.mjs`). The page's own controls are not measured. |
| no duplicate control | `tests/check.mjs` (duplicate `id`, module-owned ids, no hand-built controls) and the registry (a duplicate control id throws). |
| no duplicate value | `tests/monitor.test.mjs` (7b3: no readout grid, every repeat removed). Not claimed for `sensors` (new in Phase 8), `driveshaft` (its two rows repeat their sliders, kept on purpose), and `sparkplug`, `thermostat`, `tyres`, `wiring` (rewritten in Phase 8, never rendered in a browser here). |

Everything else needs a device, a browser and eyes: nothing in the sandbox could render a 3D page (three.js loads from a CDN).

**Columns:** header 32 px · dock ≤ 30 vh · model in upper/mid · controls reachable · no duplicate control · no duplicate value · keys · reduced motion · light theme · offline


## 360×640 — phone portrait — standalone

| module | header 32 px | dock ≤ 30 vh | model in upper/mid | controls reachable | no duplicate control | no duplicate value | keys | reduced motion | light theme | offline |
|---|---|---|---|---|---|---|---|---|---|---|
| engine | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| valvetrain | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| crankshaft-piston | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| airfilter | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| turbocharger | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| intercooler | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| fuelpump | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| carburetor | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| mpfi | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| commonrail | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| ignition | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| sparkplug | auto | auto | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| coilplug | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| lubrication | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| oilpump | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| oilfilter | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| cooling | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| thermostat | auto | auto | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| radiator | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| exhaustsystem | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| catalytic | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| egr | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| dpf | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| electrical | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| starting-system | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| lighting | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| wiring | auto | auto | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| sensors | auto | auto | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| ecu | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| obd2 | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| transmission | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| clutch | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| gearbox | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| automatic | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| differential | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| driveshaft | auto | auto | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| awd | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| steering | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| suspension | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| braking | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| abs-esc | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| tyres | auto | auto | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |

## 360×640 — phone portrait — embedded

| module | header 32 px | dock ≤ 30 vh | model in upper/mid | controls reachable | no duplicate control | no duplicate value | keys | reduced motion | light theme | offline |
|---|---|---|---|---|---|---|---|---|---|---|
| engine | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| valvetrain | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| crankshaft-piston | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| airfilter | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| turbocharger | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| intercooler | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| fuelpump | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| carburetor | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| mpfi | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| commonrail | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| ignition | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| sparkplug | n/a | auto | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| coilplug | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| lubrication | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| oilpump | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| oilfilter | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| cooling | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| thermostat | n/a | auto | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| radiator | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| exhaustsystem | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| catalytic | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| egr | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| dpf | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| electrical | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| starting-system | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| lighting | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| wiring | n/a | auto | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| sensors | n/a | auto | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| ecu | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| obd2 | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| transmission | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| clutch | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| gearbox | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| automatic | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| differential | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| driveshaft | n/a | auto | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| awd | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| steering | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| suspension | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| braking | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| abs-esc | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| tyres | n/a | auto | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |

## 412×915 — phone portrait, tall — standalone

| module | header 32 px | dock ≤ 30 vh | model in upper/mid | controls reachable | no duplicate control | no duplicate value | keys | reduced motion | light theme | offline |
|---|---|---|---|---|---|---|---|---|---|---|
| engine | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| valvetrain | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| crankshaft-piston | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| airfilter | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| turbocharger | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| intercooler | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| fuelpump | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| carburetor | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| mpfi | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| commonrail | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| ignition | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| sparkplug | auto | auto | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| coilplug | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| lubrication | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| oilpump | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| oilfilter | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| cooling | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| thermostat | auto | auto | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| radiator | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| exhaustsystem | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| catalytic | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| egr | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| dpf | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| electrical | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| starting-system | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| lighting | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| wiring | auto | auto | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| sensors | auto | auto | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| ecu | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| obd2 | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| transmission | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| clutch | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| gearbox | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| automatic | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| differential | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| driveshaft | auto | auto | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| awd | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| steering | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| suspension | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| braking | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| abs-esc | auto | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| tyres | auto | auto | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |

## 412×915 — phone portrait, tall — embedded

| module | header 32 px | dock ≤ 30 vh | model in upper/mid | controls reachable | no duplicate control | no duplicate value | keys | reduced motion | light theme | offline |
|---|---|---|---|---|---|---|---|---|---|---|
| engine | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| valvetrain | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| crankshaft-piston | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| airfilter | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| turbocharger | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| intercooler | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| fuelpump | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| carburetor | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| mpfi | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| commonrail | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| ignition | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| sparkplug | n/a | auto | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| coilplug | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| lubrication | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| oilpump | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| oilfilter | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| cooling | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| thermostat | n/a | auto | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| radiator | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| exhaustsystem | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| catalytic | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| egr | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| dpf | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| electrical | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| starting-system | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| lighting | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| wiring | n/a | auto | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| sensors | n/a | auto | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| ecu | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| obd2 | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| transmission | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| clutch | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| gearbox | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| automatic | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| differential | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| driveshaft | n/a | auto | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| awd | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| steering | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| suspension | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| braking | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| abs-esc | n/a | auto | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| tyres | n/a | auto | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |

## 844×390 — phone landscape — standalone

| module | header 32 px | dock ≤ 30 vh | model in upper/mid | controls reachable | no duplicate control | no duplicate value | keys | reduced motion | light theme | offline |
|---|---|---|---|---|---|---|---|---|---|---|
| engine | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| valvetrain | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| crankshaft-piston | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| airfilter | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| turbocharger | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| intercooler | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| fuelpump | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| carburetor | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| mpfi | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| commonrail | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| ignition | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| sparkplug | auto (28 px) | auto (rails) | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| coilplug | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| lubrication | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| oilpump | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| oilfilter | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| cooling | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| thermostat | auto (28 px) | auto (rails) | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| radiator | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| exhaustsystem | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| catalytic | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| egr | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| dpf | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| electrical | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| starting-system | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| lighting | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| wiring | auto (28 px) | auto (rails) | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| sensors | auto (28 px) | auto (rails) | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| ecu | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| obd2 | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| transmission | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| clutch | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| gearbox | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| automatic | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| differential | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| driveshaft | auto (28 px) | auto (rails) | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| awd | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| steering | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| suspension | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| braking | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| abs-esc | auto (28 px) | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| tyres | auto (28 px) | auto (rails) | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |

## 844×390 — phone landscape — embedded

| module | header 32 px | dock ≤ 30 vh | model in upper/mid | controls reachable | no duplicate control | no duplicate value | keys | reduced motion | light theme | offline |
|---|---|---|---|---|---|---|---|---|---|---|
| engine | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| valvetrain | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| crankshaft-piston | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| airfilter | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| turbocharger | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| intercooler | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| fuelpump | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| carburetor | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| mpfi | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| commonrail | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| ignition | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| sparkplug | n/a | auto (rails) | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| coilplug | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| lubrication | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| oilpump | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| oilfilter | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| cooling | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| thermostat | n/a | auto (rails) | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| radiator | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| exhaustsystem | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| catalytic | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| egr | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| dpf | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| electrical | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| starting-system | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| lighting | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| wiring | n/a | auto (rails) | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| sensors | n/a | auto (rails) | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| ecu | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| obd2 | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| transmission | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| clutch | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| gearbox | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| automatic | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| differential | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| driveshaft | n/a | auto (rails) | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| awd | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| steering | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| suspension | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| braking | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| abs-esc | n/a | auto (rails) | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| tyres | n/a | auto (rails) | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |

## desktop — 1280×800 or larger — standalone

From 1024 px wide the "dock" is the **left rail** (280 px, 320 px from 1600 px) and the Monitor is the **right column**; read the `dock ≤ 30 vh` column as "no bottom bar, the rails fit the page".

| module | header 32 px | dock ≤ 30 vh | model in upper/mid | controls reachable | no duplicate control | no duplicate value | keys | reduced motion | light theme | offline |
|---|---|---|---|---|---|---|---|---|---|---|
| engine | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| valvetrain | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| crankshaft-piston | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| airfilter | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| turbocharger | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| intercooler | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| fuelpump | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| carburetor | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| mpfi | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| commonrail | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| ignition | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| sparkplug | auto | ☐ | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| coilplug | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| lubrication | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| oilpump | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| oilfilter | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| cooling | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| thermostat | auto | ☐ | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| radiator | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| exhaustsystem | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| catalytic | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| egr | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| dpf | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| electrical | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| starting-system | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| lighting | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| wiring | auto | ☐ | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| sensors | auto | ☐ | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| ecu | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| obd2 | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| transmission | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| clutch | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| gearbox | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| automatic | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| differential | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| driveshaft | auto | ☐ | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| awd | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| steering | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| suspension | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| braking | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| abs-esc | auto | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| tyres | auto | ☐ | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |

## desktop — 1280×800 or larger — embedded

Same wide layout inside the shell (the rails start under the 32 px shell header).

| module | header 32 px | dock ≤ 30 vh | model in upper/mid | controls reachable | no duplicate control | no duplicate value | keys | reduced motion | light theme | offline |
|---|---|---|---|---|---|---|---|---|---|---|
| engine | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| valvetrain | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| crankshaft-piston | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| airfilter | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| turbocharger | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| intercooler | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| fuelpump | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| carburetor | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| mpfi | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| commonrail | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| ignition | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| sparkplug | n/a | ☐ | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| coilplug | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| lubrication | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| oilpump | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| oilfilter | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| cooling | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| thermostat | n/a | ☐ | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| radiator | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| exhaustsystem | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| catalytic | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| egr | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| dpf | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| electrical | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| starting-system | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| lighting | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| wiring | n/a | ☐ | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| sensors | n/a | ☐ | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| ecu | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| obd2 | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| transmission | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| clutch | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| gearbox | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| automatic | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| differential | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| driveshaft | n/a | ☐ | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |
| awd | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| steering | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| suspension | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| braking | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| abs-esc | n/a | ☐ | ☐ | ☐ | auto | auto | ☐ | ☐ | ☐ | ☐ |
| tyres | n/a | ☐ | ☐ | ☐ | auto | ☐ | ☐ | ☐ | ☐ | ☐ |

## Extra checks (manual)

**Stage canvas is visible and does not cover the model.** Look at it in all four viewports, standalone and embedded. The canvas sits in a bottom corner above the dock and ignores pointer events (orbit must still work through it).

| module | canvas | 360×640 | 412×915 | 844×390 | desktop |
|---|---|---|---|---|---|
| gearbox | torque by gear | ☐ | ☐ | ☐ | ☐ |
| exhaustsystem | acoustic spectrum | ☐ | ☐ | ☐ | ☐ |
| ignition | spark advance vs rpm | ☐ | ☐ | ☐ | ☐ |
| crankshaft-piston | piston motion graph | ☐ | ☐ | ☐ | ☐ |

**Wide layout (1024 px and up).** Open one module of each kind at 1024×768, 1280×800, 1920×1080 and on a TV (3840×2160) and check:

| check | 1024×768 | 1280×800 | 1920×1080 | 3840×2160 |
|---|---|---|---|---|
| controls in the left rail, no bottom bar, nothing cut at either rail edge | ☐ | ☐ | ☐ | ☐ |
| the ‹ handle folds the rail to a strip; the model grows to fill; ‹ opens it again | ☐ | ☐ | ☐ | ☐ |
| Monitor is the right column and scrolls when its rows are long (crankshaft-piston, awd, catalytic) | ☐ | ☐ | ☐ | ☐ |
| pedal / dial / gate controls are centred and tappable in the rail (automatic, braking, engine) | ☐ | ☐ | ☐ | ☐ |
| rail scrolls when a module has many controls (awd, thermostat) | ☐ | ☐ | ☐ | ☐ |
| window resized across 1024 px: layout switches between the bottom bar and the rails without a reload | ☐ | ☐ | ☐ | ☐ |
| sensors: document and Monitor column do not overlap | ☐ | ☐ | ☐ | ☐ |

**Mode switch refills the Monitor.** Switch every mode; rows, trace and footer legend must follow at once, with no stale label and no empty first frame.

| module | modes to switch | rows follow | legend follows | trace clears | 360×640 | desktop |
|---|---|---|---|---|---|---|
| electrical | battery / alternator / charging | ☐ | ☐ | ☐ | ☐ | ☐ |
| starting-system | circuit / starter / mesh / crank | ☐ | ☐ | ☐ | ☐ | ☐ |
| exhaustsystem | 4 configurations | ☐ | ☐ | ☐ | ☐ | ☐ |
| cooling | Air Cooling / Radiator (Liquid) Cooling (and any other mode in the page) | ☐ | ☐ | ☐ | ☐ | ☐ |

**Pages rewritten in Phase 8 (check first).** Their panel was replaced by dock controls and Monitor rows / traces; none was rendered in a browser here.

| module | what to look at |
|---|---|
| sensors | dock sliders and the two selects; Monitor strip does not cover the title; scope redraws; theme from ⋯; works without WebGL |
| sparkplug | Heat / Electrode / View / Condition choices rebuild the scene; RPM and Load axes; "Secondary kV" trace; Reset clears it |
| thermostat | View / Rating / Failure / Flow; "Reset to cold" action; temperature trace with the opening-temperature line |
| tyres | Pressure / Load / Speed / Tread axes and the Surface choice; the old main slider is now Pressure |
| wiring | gauge / fuse / fault choices; "Fuse box view" opens the popup; "Replace fuse"; Loop resistance and Ampacity rows; warnings in the Monitor status |

**Colour conversion (Phase 8).** About 316 CSS colours and 85 legend colours became tokens. In both themes, check legend swatches against the 3D parts they name, and badges, callouts and status flashes for contrast: gearbox, wiring, differential, thermostat, sparkplug, tyres, suspension, electrical, lubrication, exhaustsystem, mpfi, transmission, cooling, index.

**Three baseline bugs fixed in Phase 8** (confirm in a browser): fuelpump runs without a console error (`domLast`); oilpump builds (Base import); wiring's heat colours work (THREE import).
