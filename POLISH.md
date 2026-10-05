# POLISH — findings collected during Phase 8 (not fixed)

Small things noticed while doing Phase 8. Nothing here blocks release. Add to this list while filling `QA.md`.
Source: **code** = read in the source, **sandbox** = seen in a headless-Chromium run of `sensors.html` (the only page the sandbox could render), **assumed** = inferred, needs a device.

## Layout

1. **Landscape-phone rail clips axis labels** (sandbox, sensors at 844×390). `.ctl-axis { min-width: 140px }` is wider than the 122 px usable rail width, so the left axis label ("ENGINE SPEED", "COOLANT TEMP") loses its first letters and the value reads "0 rp". Probably affects every module with 2+ axes in landscape. Fix in `controls.css` (let the label wrap or drop the min-width inside the rail).
2. **Sensors desktop gutter.** The page leaves a 232 px right gutter for the Monitor card even when the Monitor is collapsed to its orb. Could read the collapsed state.
3. **Sensors dock on desktop** puts two `select` controls in the primary row beside three sliders; at 1280 px the Monitor card and the dock both claim the top-right / bottom space. Check at 1024 px.
4. **Long Monitor row lists on a phone card** (carried over from 8.8): crankshaft-piston 17 rows, mpfi 11, lubrication 11, wiring now 9.
5. **Stage canvas vs. model** in gearbox, exhaustsystem, ignition, crankshaft-piston has never been checked at 360×640 (assumed).

## Controls and Monitor

6. **sparkplug / thermostat charts are now Monitor traces**, sampled once per update while playing; the old stage canvases drew at fixed windows (2.4 s and 20 s). Check the time scale looks right at 0.15× and 2.5× sim speed (assumed). The thermostat's "opens at" line is a second trace series, not a dashed line.
7. **wiring warnings** (wire above rating, glowing, fuse blown) are now only the Monitor status text; the old orange warning box had more room. Check the wording fits the status pill on a phone.
8. **tyres** has `ctl: null` and four axes in the primary zone (pages + dots on phones). Check the order Pressure → Load → Speed → Tread and that reset restores 32 psi / 400 kg / 0 / 7.5 mm.
9. **Action controls in the options row** (thermostat "Reset to cold", wiring "Fuse box view" / "Replace fuse") only appear when the dock is in the `options` state. The fuse box popup used to have a floating "Inspect Fuse Box" button that is gone; make sure people can still find it.
10. **`choice` `tone: 'crit'`** is used for thermostat "Closed" and wiring "Short"; confirm the segmented layout renders a crit tone on the selected segment.
11. **Legend swatches** now use the nearest `--c-*` token, not the exact colour of the 3D part (for example `#ff8a1f` became `--c-orange`). Hues match; saturation and lightness can differ slightly from the model.

## Colour conversion

12. The converter mapped each hex / rgba to a token by hue and property (see `CHANGELOG.md`). Spot-check badges, callouts and status flashes in both themes (QA.md, "Colour conversion"). 17 `html.light-theme` overrides were deleted as redundant; if one page looks wrong only in light, a rule may have been needed after all.
13. `--surface-3` is used for near-black swatches (for example the ignition "Ground" swatch); in the light theme it is light grey.

## Sensors

14. **Needs three.js to load.** `sensors.html` imports `kit.js`, which imports three.js, only for the header / dock / Monitor. First visit offline fails with the guard overlay skipped (`data-no3d`) but a module-load error. Splitting the UI half of `kit.js` from the 3D half would fix it.
15. **Shell ⋯ menu** (in `index.html`) still lists wireframe and x-ray for sensors; they do nothing. The shell would need a per-module capability flag.
16. The scope is a content canvas (a waveform picture, not a time series), so it is not a stage canvas or a trace.

## Tooling

17. `package.json` has no `"type": "module"`, so every `node` run of a root `.js` file prints a `MODULE_TYPELESS_PACKAGE_JSON` warning. Adding the field is safe in principle (the browser ignores it) but was not tried against the whole suite.
18. jsdom DOM tests are still skipped in the sandbox (no network to install it).
19. `QA.md` counts 42 module pages; earlier docs said 44 modules (44 is the page count including `index.html` and `404.html`).
