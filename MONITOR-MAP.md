# MONITOR-MAP.md — Phase 7a inventory

Generated from the Phase 5 zip (`AutoLab1-main.zip`, cache autolab-v8.5) by scanning every module page. "Value surfaces today" lists every place a number is printed before 7a.
Legend: **7a-1** = done in part 1; **7a-2** = done in part 2 (both in this zip) (Monitor core + guided apply). **7a-2** = remaining half of 7a (see `PHASE-7a-PART2.md`). **7b** = Phase 7b.

| Module | Kind | Value surfaces today | Duplicates (D10–D13 candidates) | 7a-1 (this zip) | 7a-2 | Phase |
|---|---|---|---|---|---|---|
| abs-esc | bespoke | chip; 5 ui.chip calls; 8 ro-* ids; 1 setRpmLabel; badge | - | chip → Monitor via wrapper (works, unchanged) | 7a done: speed row already shows km/h; static unit label deleted (duplicate removed) | 7a done |
| airfilter | guided | big+bar (Airflow); 2 chip rows; 5 ro rows (grid→rows); no canvas | big value = ro row flow (dropped from rows); chip rows share ro ids: dp,pw | 7a-1 done: big/bar/status/rows/ro → ui.monitor | - | 7a |
| automatic | bespoke | chip; 7 ui.chip calls; 1 setRpmLabel | - | chip → Monitor via wrapper (works, unchanged) | 7a done: row `speed` 'Vehicle speed' (km/h) | 7a done |
| awd | guided | big+bar (Rear torque); 2 chip rows; 11 ro rows (grid→rows); canvas #awd-graph; warn #awd-warn | chip rows share ro ids: fslip,rslip | 7a-1 done: big/bar/status/rows/ro → ui.monitor | 7a done: graph canvas → Monitor trace `hist` (two series, 0–100 % of the old axis ranges), warn → status (tone warn) | 7a done |
| braking | bespoke | chip; 6 ui.chip calls; badge | - | chip → Monitor via wrapper (works, unchanged) | - | 7b |
| carburetor | bespoke | chip; 3 ui.chip calls; 1 setRpmLabel; badge | - | chip → Monitor via wrapper (works, unchanged) | 7a done: row `rpm` 'Engine speed' | 7a done |
| catalytic | guided | big+bar (CO conversion); 2 chip rows; 9 ro rows (grid→rows); canvas #cat-graph; warn #cat-warn | chip rows share ro ids: hc,nox | 7a-1 done: big/bar/status/rows/ro → ui.monitor | 7a done: graph canvas → Monitor trace `hist` (two series, 0–100 % of the old axis ranges), warn → status (tone warn) | 7a done |
| clutch | bespoke | chip; 5 ui.chip calls; 1 setRpmLabel | - | chip → Monitor via wrapper (works, unchanged) | 7a done: row `rpm` 'Engine speed' | 7a done |
| coilplug | guided | big+bar (Engine speed); 2 chip rows; 5 ro rows (grid→rows); no canvas | big value = ro row rpm (dropped from rows); chip rows share ro ids: dwell,sps | 7a-1 done: big/bar/status/rows/ro → ui.monitor | - | 7a |
| commonrail | guided | big+bar (Rail pressure); 2 chip rows; 10 ro rows (grid→rows); canvas #cr-graph; warn #cr-warn | big value = ro row press (dropped from rows); chip rows share ro ids: qty | 7a-1 done: big/bar/status/rows/ro → ui.monitor | 7a done: graph canvas → Monitor trace `hist` (two series, 0–100 % of the old axis ranges), warn → status (tone warn) | 7a done |
| cooling | bespoke | chip; 8 ui.chip calls; 1 setRpmLabel; badge | - | chip → Monitor via wrapper (works, unchanged) | 7a done: row `rpm` 'Engine speed' | 7a done |
| crankshaft-piston | bespoke | chip; 5 ui.chip calls; 1 ro-* ids; canvas #cp-graph | - | chip → Monitor via wrapper (works, unchanged) | - | 7b |
| differential | bespoke | chip; 7 ui.chip calls; 1 setRpmLabel | - | chip → Monitor via wrapper (works, unchanged) | 7a done: row `rpm` 'Input speed' (L/R rows unchanged) | 7a done |
| dpf | guided | big+bar (Back pressure); 2 chip rows; 9 ro rows (grid→rows); canvas #dpf-graph; warn #dpf-warn | big value = ro row bp (dropped from rows); chip rows share ro ids: soot,regen | 7a-1 done: big/bar/status/rows/ro → ui.monitor | 7a done: graph canvas → Monitor trace `hist` (two series, 0–100 % of the old axis ranges), warn → status (tone warn) | 7a done |
| driveshaft | guided | big+bar (Speed swing); 2 chip rows; 11 ro rows (grid→rows); canvas #ds-graph; warn #ds-warn | big value = ro row swing (dropped from rows); chip rows share ro ids: ratio,rpm | 7a-1 done: big/bar/status/rows/ro → ui.monitor | 7a done: graph canvas → Monitor trace `hist` (two series, 0–100 % of the old axis ranges), warn → status (tone warn) | 7a done |
| ecu | bespoke | chip; 5 ui.chip calls; 9 ro-* ids; badge | - | chip → Monitor via wrapper (works, unchanged) | - | 7b |
| egr | guided | big+bar (NOx (ppm)); 2 chip rows; 9 ro rows (grid→rows); canvas #egr-graph; warn #egr-warn | chip rows share ro ids: lift,temp | 7a-1 done: big/bar/status/rows/ro → ui.monitor | 7a done: graph canvas → Monitor trace `hist` (two series, 0–100 % of the old axis ranges), warn → status (tone warn) | 7a done |
| electrical | bespoke | chip; 23 ui.chip calls; 1 setRpmLabel; canvas #waveform-canvas; badge | - | chip → Monitor via wrapper (works, unchanged) | 7a done: `eng` row already prints the same engine rpm; setRpmLabel deleted (duplicate removed) | 7a done (rpm label) + 7b (canvases/rows) |
| engine | bespoke | chip; 4 ui.chip calls; badge | - | chip → Monitor via wrapper (works, unchanged) | - | 7b |
| exhaustsystem | bespoke | chip; 19 ui.chip calls; 1 setRpmLabel; canvas #spectrum-strip; badge | - | chip → Monitor via wrapper (works, unchanged) | 7a done: `eng` row already prints the same rpm; setRpmLabel deleted (duplicate removed) | 7a done (rpm label) + 7b (canvases/rows) |
| fuelpump | guided | big+bar (Rail pressure); 2 chip rows; 8 ro rows (grid→rows); canvas #fp-graph; warn #fp-warn | big value = ro row press (dropped from rows); chip rows share ro ids: supply,cur | 7a-1 done: big/bar/status/rows/ro → ui.monitor | 7a done: graph canvas → Monitor trace `hist` (two series, 0–100 % of the old axis ranges), warn → status (tone warn) | 7a done |
| gearbox | bespoke | chip; 5 ui.chip calls; canvas #torque-canvas; badge | - | chip → Monitor via wrapper (works, unchanged) | - | 7b |
| ignition | bespoke | chip; 10 ui.chip calls; 1 setRpmLabel; canvas #adv-curve | - | chip → Monitor via wrapper (works, unchanged) | 7a done: `rpm` row + the dock RPM axis already show it; setRpmLabel deleted (duplicate removed) | 7a done (rpm label) + 7b (canvases/rows) |
| intercooler | guided | big+bar (Effectiveness); 2 chip rows; 10 ro rows (grid→rows); canvas #ic-graph; warn #ic-warn | big value = ro row eff (dropped from rows); chip rows share ro ids: tin,gain | 7a-1 done: big/bar/status/rows/ro → ui.monitor | 7a done: graph canvas → Monitor trace `hist` (two series, 0–100 % of the old axis ranges), warn → status (tone warn) | 7a done |
| lighting | guided | big+bar (-); 0 chip rows; 0 ro rows (grid→rows); no canvas | - | 7a-1 done: big/bar/status/rows/ro → ui.monitor | - | 7a |
| lubrication | bespoke | chip; 6 ui.chip calls; canvas #temp-graph | - | chip → Monitor via wrapper (works, unchanged) | - | 7b |
| mpfi | bespoke | chip; 6 ui.chip calls; 1 setRpmLabel; canvas #mp-graph; badge | - | chip → Monitor via wrapper (works, unchanged) | 7a done: row `rpm` 'Engine speed' | 7a done (rpm label) + 7b (canvases/rows) |
| obd2 | bespoke | chip; 5 ui.chip calls; 7 ro-* ids; badge | - | chip → Monitor via wrapper (works, unchanged) | - | 7b |
| oilfilter | guided | big+bar (Pressure drop); 2 chip rows; 5 ro rows (grid→rows); no canvas | big value = ro row dp (dropped from rows); chip rows share ro ids: thru | 7a-1 done: big/bar/status/rows/ro → ui.monitor | - | 7a |
| oilpump | guided | big+bar (Oil pressure); 2 chip rows; 9 ro rows (grid→rows); canvas #oilp-graph; warn #oilp-warn | big value = ro row press (dropped from rows); chip rows share ro ids: flow,relief | 7a-1 done: big/bar/status/rows/ro → ui.monitor | 7a done: graph canvas → Monitor trace `hist` (two series, 0–100 % of the old axis ranges), warn → status (tone warn) | 7a done |
| radiator | guided | big+bar (Heat rejected); 2 chip rows; 11 ro rows (grid→rows); canvas #rad-graph; warn #rad-warn | big value = ro row qout (dropped from rows); chip rows share ro ids: tin,tout | 7a-1 done: big/bar/status/rows/ro → ui.monitor | 7a done: graph canvas → Monitor trace `hist` (two series, 0–100 % of the old axis ranges), warn → status (tone warn) | 7a done |
| sensors | bespoke | canvas #sc | - | - | - | 7b |
| sparkplug | guided | big+bar (Required voltage); 2 chip rows; 7 ro rows (grid→rows); no canvas | big value = ro row req (dropped from rows); chip rows share ro ids: gap,burn | 7a-1 done: big/bar/status/rows/ro → ui.monitor | - | 7a |
| starting-system | bespoke | chip; 24 ui.chip calls; 1 setRpmLabel; canvas #rpm-strip; badge | - | chip → Monitor via wrapper (works, unchanged) | 7a done: row `rpm` 'Engine speed' (the big value shows A / starter rpm, so it is not a duplicate) | 7a done (rpm label) + 7b (canvases/rows) |
| steering | bespoke | chip; 5 ui.chip calls; badge | - | chip → Monitor via wrapper (works, unchanged) | - | 7b |
| suspension | bespoke | chip; 7 ui.chip calls; 2 setRpmLabel; badge | - | chip → Monitor via wrapper (works, unchanged) | 7a done: `speed` row already prints km/h; both setRpmLabel calls deleted (duplicate removed) | 7a done |
| thermostat | guided | big+bar (Coolant temp); 2 chip rows; 8 ro rows (grid→rows); no canvas | big value = ro row temp (dropped from rows); chip rows share ro ids: open,rad | 7a-1 done: big/bar/status/rows/ro → ui.monitor | - | 7a |
| transmission | bespoke | chip; 12 ui.chip calls | - | chip → Monitor via wrapper (works, unchanged) | - | 7b |
| turbocharger | bespoke | chip; 7 ui.chip calls; 1 setRpmLabel; badge | - | chip → Monitor via wrapper (works, unchanged) | 7a done: row `rpm` 'Engine speed' (the `drive` row is turbine rpm, a different quantity) | 7a done |
| tyres | guided | big+bar (Contact patch); 2 chip rows; 7 ro rows (grid→rows); no canvas | big value = ro row patch (dropped from rows); chip rows share ro ids: patch,wear | 7a-1 done: big/bar/status/rows/ro → ui.monitor | - | 7a |
| valvetrain | bespoke | chip; 5 ui.chip calls; 9 ro-* ids | - | chip → Monitor via wrapper (works, unchanged) | - | 7b |
| wiring | guided | big+bar (Current); 2 chip rows; 7 ro rows (grid→rows); no canvas | big value = ro row amps (dropped from rows); chip rows share ro ids: fuse,temp | 7a-1 done: big/bar/status/rows/ro → ui.monitor | - | 7a |

## Notes
- Guided modules: the panel `ro-*` grid is gone; its rows live in the Monitor. A ro row whose label equals the big-value label is dropped (same number); chip rows that share an id with a ro row are one row.
- Bespoke modules still call `ui.chip.*` / build their own panel grids; those calls now land in the Monitor through thin wrappers (deleted in 7b).
- `ui.toolbar.setRpmLabel` has no caller left in any page (7a-2); the kit keeps the definition until 7b deletes it.
- 7a-2 (this zip): the ten guided graph modules and all 13 rpm-label callers are done. Duplicates removed: abs-esc (static unit), electrical, exhaustsystem, ignition, suspension.
- Trace values are normalised to 0–100 % of each old axis range, so both series keep their old shape; the caption says "% of full scale".
- Duplicates for bespoke modules need a human read of each page (listed under 7b); this scan only flags where two surfaces exist.


## Phase 7b1 — chip → Monitor (the 23 bespoke pages)

Every page below now declares `monitor: { config, initial }` and writes through `ui.monitor.update(...)`. Same ids, labels, units and values as before; adjacent calls inside one straight-line block are merged into one update. `ui.chip.*`, the `chip:` config, `chipToMonitor()` and `ui.toolbar.setRpmLabel` are deleted from kit.js. Hard-coded colours were left as they were (token cleanup is Phase 8) and are listed here.

| Page | ui.chip calls before | ui.monitor.update calls now | Hard-coded colours kept in updates (Phase 8) | 7b1 |
|---|---|---|---|---|
| abs-esc | 5 | 1 | - | done |
| automatic | 7 | 3 | - | done |
| braking | 6 | 2 | - | done |
| carburetor | 3 | 3 | - | done |
| clutch | 5 | 1 | #22c55e, #ef4444, #f59e0b | done |
| cooling | 5 | 2 | - | done |
| crankshaft-piston | 5 | 1 | - | done |
| differential | 7 | 5 | #38bdf8 | done |
| ecu | 5 | 1 | - | done |
| electrical | 23 | 12 | #22c55e, #ef4444, #f59e0b | done |
| engine | 3 | 2 | - | done |
| exhaustsystem | 18 | 5 | #0ea5e9, #22c55e, #38bdf8, #f59e0b | done |
| gearbox | 5 | 1 | #22c55e, #38bdf8, #a855f7, #ef4444, #f59e0b | done |
| ignition | 10 | 6 | #f59e0b, #ff5566 | done |
| lubrication | 6 | 2 | - | done |
| mpfi | 6 | 3 | - | done |
| obd2 | 5 | 1 | - | done |
| starting-system | 24 | 5 | #22c55e, #38bdf8, #ef4444, #f59e0b | done |
| steering | 5 | 1 | #38bdf8, #a855f7 | done |
| suspension | 7 | 4 | #38bdf8, #ef4444 | done |
| transmission | 12 | 4 | #3b82f6, #a855f7 | done |
| turbocharger | 7 | 4 | - | done |
| valvetrain | 5 | 1 | - | done |

Special cases:
- **cooling**: status colour classes (`warn-status` / `crit-status`) and the `#chip-status` CSS are gone; the Monitor status tone (`warn` / `crit`) carries it. The bespoke temp graph and surface-area row are still appended to `ui.monitor.root` (7b2 moves them to a trace / meter).
- **engine**: the big value is the stroke name; `#ui-chip #chip-value` CSS became `#ui-monitor .mon-value`; the stroke click calls `ui.monitor.flush()` so the name changes at once.
- **carburetor**: `#ui-chip #chip-row-phase` became `#ui-monitor [data-row="phase"] .mon-row-v` (rows now carry `data-row`).
- **exhaustsystem**: the head label changes with the mode, now `ui.monitor.update({ label })` (new Monitor label channel).
- **ecu**: the `chip:` key of the 3D material table was renamed `pcbChip` (it was only a grep hit).

## Phase 7b2 — canvases and meters (nine pages)
Rule: time series → trace · a number → row (or gauge for one bounded quantity) · a picture that is not a time series → stage canvas (`ui.stage.canvas`, over the 3D stage, never in the dock or panel). Ranges are the old fixed ranges.

| page | was | decision | now |
|---|---|---|---|
| gearbox | torque-by-gear canvas in the dock, with gear / rpm / SHIFT header and a collapse chevron | **stage canvas** (curves vs output speed + live dot: not a time series) | `torque` stage canvas, SHIFT drawn in it; header text was a duplicate of status and rows `in` / `out`; chevron gone |
| starting-system | rpm strip chart (engine + starter ÷ 12) | **trace** `speed`, 0–redline rpm, 240 | same sample spacing (33 Hz) |
| starting-system | Battery V meter | duplicate of row `bat` | removed |
| starting-system | Current A meter | **row** `amps` | circuit mode's big value is also current (7b3: one value, one place) |
| starting-system | strip note (idle / cranking / armed) | duplicate of status | removed |
| electrical | 3-phase waveform canvas (alternator mode) | **trace** `wave`, 4 series, ±1.5625 amplitudes, 240 | second config `MON_ALT` via `ui.monitor.set` in alternator mode only; sampled at fixed phase steps (3 cycles always visible) |
| exhaustsystem | spectrum canvas + sound-mode note | **stage canvas** (frequency bars) | `spectrum`; the mode name is the canvas caption |
| ignition | advance-curve canvas in the panel | **stage canvas** (advance vs rpm + live dot) | `advance` |
| crankshaft-piston | motion graph canvas in the Motion tab | **stage canvas** (curve over the 720° cycle) | `motion`, drawn with the readouts (was only while the tab was open); cylinder name in the corner |
| lubrication | oil / bearing / wall temperature canvas in the panel | **trace** `temps`, 20–500 °C, 240, 4 Hz | zones and legend gone (series labels are the key) |
| mpfi | STFT / LTFT canvas + trim-state word | **trace** `trimhist` ±20 %, 80, 5 Hz + **row** `trim` | target band gone |
| cooling | temperature SVG + surface-area bar, both appended into `ui.monitor.root` | **trace** `temp` 55–125 °C, 180 + **row** `surface` | row name follows the mode (`rowLabels`); bar, temperature colour and area fill gone |
| steering, braking | none (no canvas or meter) | nothing to migrate | their panel readout grids are 7b3 |

Not touched (7b3): the other duplicates in info panels (rows `al-read`, mpfi's four trim bars, panel `r1..r3` rows), module legends, the guided-module panels.
