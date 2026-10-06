# POLISH — open findings (not fixed)

Small things noticed so far. Nothing here blocks release. Add to this list while filling `QA.md`; delete a line when it is fixed.
Source: **code** = read in the source, **sandbox** = seen in a headless-Chromium run of `sensors.html` (the only page the sandbox could render), **assumed** = inferred, needs a device.

## Layout

1. **Sensors desktop gutter.** The page leaves a 232 px right gutter for the Monitor card even when the Monitor is collapsed to its orb. Could read the collapsed state.
2. **Sensors dock on desktop** puts two `select` controls in the primary row beside three sliders; at 1280 px the Monitor card and the dock both claim the top-right / bottom space. Check at 1024 px.
3. **Long Monitor row lists on a phone card** (carried over from 8.8): crankshaft-piston 17 rows, mpfi 11, lubrication 11, wiring now 9.
4. **Stage canvas vs. model** in gearbox, exhaustsystem, ignition, crankshaft-piston has never been checked at 360×640 (assumed).

## Controls and Monitor

5. **sparkplug / thermostat charts are now Monitor traces**, sampled once per update while playing; the old stage canvases drew at fixed windows (2.4 s and 20 s). Check the time scale looks right at 0.15× and 2.5× sim speed (assumed). The thermostat's "opens at" line is a second trace series, not a dashed line.
6. **wiring warnings** (wire above rating, glowing, fuse blown) are now only the Monitor status text; the old orange warning box had more room. Check the wording fits the status pill on a phone.
7. **tyres** has `ctl: null` and four axes in the primary zone (pages + dots on phones). Check the order Pressure → Load → Speed → Tread and that reset restores 32 psi / 400 kg / 0 / 7.5 mm.
8. **Action controls in the options row** (thermostat "Reset to cold", wiring "Fuse box view" / "Replace fuse") only appear when the dock is in the `options` state. The fuse box popup used to have a floating "Inspect Fuse Box" button that is gone; make sure people can still find it.
9. **`choice` `tone: 'crit'`** is used for thermostat "Closed" and wiring "Short"; confirm the segmented layout renders a crit tone on the selected segment.
10. **Legend swatches** now use the nearest `--c-*` token, not the exact colour of the 3D part (for example `#ff8a1f` became `--c-orange`). Hues match; saturation and lightness can differ slightly from the model.

## Colour conversion

11. The converter mapped each hex / rgba to a token by hue and property (see `CHANGELOG.md`). Spot-check badges, callouts and status flashes in both themes (QA.md, "Colour conversion"). 17 `html.light-theme` overrides were deleted as redundant; if one page looks wrong only in light, a rule may have been needed after all.
12. `--surface-3` is used for near-black swatches (for example the ignition "Ground" swatch); in the light theme it is light grey.

## Sensors

13. The scope is a content canvas (a waveform picture, not a time series), so it is not a stage canvas or a trace.

## Tooling

14. jsdom DOM tests are still skipped in the sandbox (no network to install it).
15. `QA.md` counts 42 module pages; earlier docs said 44 modules (44 is the page count including `index.html` and `404.html`).
16. **ignition: the 720° cycle bar and firing-order row are gone from the panel** (see CHANGELOG). If you want a cycle indicator back, build it as a stage canvas or a Monitor trace, not panel markup.
17. **Not seen rendered:** differential, thermostat, awd, catalytic, dpf, egr, fuelpump, ecu and ignition are your edits plus the Phase 8 token conversion; open each in both themes before release.

## Phase 9e (open)

18. **Sound fade and slide timing are untested on a phone.** Checked in headless Chromium only: Web Audio contexts fade out (~30 ms) and suspend on Back, resume on return. Listen to exhaustsystem, starting-system and lighting on a real device, and confirm iOS Safari resumes after reopening (it may need a tap).
19. **New modules now start loading after the 420 ms slide**, with a spinner meanwhile. If that feels slow on a fast phone, mount at ~60% of the slide instead (`afterSlide` in index.html).
20. **setInterval / setTimeout loops** in a hidden module are not paused by perf-guard (only `requestAnimationFrame` and audio are). Check the 2D modules for timer-driven simulations.
