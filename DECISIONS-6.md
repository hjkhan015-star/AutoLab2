# DECISIONS-6.md — Phase 6.5 polish decisions (full-autonomous run)

Build audited: `AutoLab2-phase6.zip` (cache `autolab-v8.6`). Output: `AutoLab2-phase6-final.zip` (cache `autolab-v8.6.1`).
Not verified: anything visual / WebGL / touch. jsdom was not installable here (no network), so every DOM test group was SKIPPED. Everything below rests on `npm test` (150 checks, exit 0), grep and code reading.

Honest correction first: my Phase 6 hand-over said `lighting` "had nothing to migrate". That was wrong. See D6-16.

## Step 1 — Audit

`npm test` before any change: exit 0, 146 checks. After the 6.5 fixes: exit 0, 150 checks.

| item | status | evidence | gap |
|---|---|---|---|
| controls-core: option normalisation, choiceIndex, stepChoice, gateKeyToIntent, choice clamping, toggle 0/1 | done | `tests/choice.test.mjs` pure group (9 tests) | none |
| controls.js: createChoice (segmented / select / gate), createToggle, createAction | done | static test + code; ONE `requestAnimationFrame(` call site (count = 1) | DOM behaviour never run (jsdom skipped) |
| `UI.create({options})`, `ui.addOptions`, `CFG.options`, `CFG.onReset` | done | `kit.js _buildOptions/addOptions`, `components.js` passes `CFG.options`, calls `CFG.onReset` before `controls.resetAll()` | not exercised in a browser |
| 10 guided panels (awd … radiator) | done | selects -> `choice`, buttons -> `action`, DPF force regen -> `toggle`; static test: no `<button`/`<select` and `CFG.onReset` present | panel select ids use `"` quotes (generated); inconsistent style only |
| Config switchers: carburetor, turbocharger, steering, braking, engine, exhaustsystem, starting-system, gearbox | done | each has a `config` choice; `cfg-prev/arrow/group` gone (test) | none |
| automatic, gearbox, starting-system, lubrication, exhaustsystem, electrical, differential, transmission, cooling, suspension, engine, mpfi, ecu, abs-esc, obd2 | done | mapping below | behaviour unverified |
| **lighting** | **not started** | dip switch is still `ctl:{label:'Dip switch', val:45, caption:'Off  Low  High'}` (lighting.html:42), a slider | see D6-16 |
| CSS: primitives tokens-only, 44 px, reduced motion, delete list | done | layout test (no hex, font >= 11 px); delete-list grep clean after D6-9 | portrait chips are 40 px by design (`--dock-options` 40–44) |
| Tests: choice / toggle / gate units | done | 14 + 4 new tests | DOM group skipped |
| check.mjs warn-only rule | done | WARNs on 4 bespoke modules only | exclusions now explicit (D6-8) |
| Report items: per-file mapping, greps, cache bump | partial | the Phase 6 chat report had a summary, not a per-file mapping; mapping + raw greps are below | closed here |

### Per-file mapping (control ids; c = choice, t = toggle, a = action)
```
abs-esc surface:c wss:t | automatic gear:c(primary) | braking config:c abs:t fail:t air:t | carburetor config:c
cooling mode:c fins:t | crankshaft-piston cyl:c block:t gas:t graph:c | differential traction:c locked:t autodrive:t section:t explode:t camera:c
ecu fault:c | electrical direction:c key:c | engine config:c view:c stroke:c slowmo:t | exhaustsystem sound:t muffler:c lambda:c config:c
gearbox gear:c(gate, primary) config:c | lubrication oil:t | mpfi cold:a egr:a trims:a | obd2 dtc:c clear:a
starting-system key:c config:c | steering config:c | suspension susp:c slowmo:t | transmission drive:c
turbocharger config:c rotorslow:t | valvetrain advance:a
awd catalytic commonrail dpf driveshaft egr fuelpump intercooler oilpump radiator: timeScale:c + their own fault/surface/type/cycle:c and
  actions (cool down, cold start, refuel, zero, bleed, clean, cool core); dpf force:t
lighting: NONE (gap)
```

## Step 2 — Acceptance greps (raw output, after the 6.5 fixes)
```
$ grep -Rn "springRelease\|cancelReturn\|__setPos\|wirePedal" *.html
(no output)

$ grep -Rn "window\.__" *.html
cooling.html:1505:    const _dens = window.__autolabDensity ?? 2;
index.html:929:    '  if (window.__autolabPerfGuard) return;',
index.html:930:    '  window.__autolabPerfGuard = true;',

$ grep -Rc "<button\|<select\|<input" *.html   (files with hits only)
abs-esc.html:9
crankshaft-piston.html:15
ecu.html:12
gearbox.html:1
index.html:7
obd2.html:9
sensors.html:6
valvetrain.html:9
wiring.html:2

$ grep -Rn "createElement([...button|select|input...])" *.html   (file:count)
index.html:2
sparkplug.html:5
thermostat.html:4
tyres.html:4
wiring.html:7

$ grep -n "MutationObserver" kit.js
810:    const mo = new MutationObserver(() => requestAnimationFrame(measure));

$ grep -Rn "<Phase 6 delete list>" *.html *.css
(no output)

$ grep -Rn "\.br-pedal\|\.at-pedal\|\.carb-pedal\|#accel-\|\.clutch-pedal" *.html *.css
(no output)

$ grep -Rn "steer-wheel\|crank-wheel\|steer-label\|Centre wheels" *.html
(no output)
```

### Authored-control grep: exclusions (every other hit is a gap)
| file | hits | why it is excluded |
|---|---|---|
| index.html | button, input | the shell (install button, module search); not a module |
| sensors.html | button, range inputs | standalone catalogue, never used the kit (`legacy.css`) |
| abs-esc, crankshaft-piston, ecu, obd2, valvetrain | `<button class="al-opt">` | quiz option buttons: content owned by `components.js Widgets.wireQuiz` |
| gearbox.html:866 | `<button class="tq-toggle">` | torque-chart collapse chevron, panel chrome. Revisit in 7b. |
| chrome.js, dock.js, controls.js, components.js | (not in `*.html`) | they ARE the control layer. monitor.js does not exist yet. |
| **wiring.html** (2 + 7 createElement) | `fb-back`, collapse / inspect / fab buttons | **GAP**: bespoke UI, never migrated. |
| **sparkplug, thermostat, tyres** (5 / 4 / 4 createElement) | collapse, fab, inputs | **GAP**: same. `check.mjs` WARNs on all four. |

Survivors worth a line:
- `grep MutationObserver kit.js` -> `kit.js:810` (`_wireAutoCollapse`). Phase 7a deletes it; not a Phase 6 item.
- `window.__` -> `cooling.html:1505` reads `window.__autolabDensity` (a config global set by `kit.js:1120`, read by `labels.js`), and `index.html` has the perf-guard flag. Neither is a Phase 6 hook (D6-7).

## Step 3 — Decisions

### D6-1 — Time scale
- Class: Auto-fix
- Context: pre-seeded. The old panel buttons are gone, but the id was `timescale`, not the pre-seeded `timeScale` (all 10 guided modules had `id: 'timescale'`).
- Options: A) keep `timescale`. B) rename to `timeScale` in the 10 modules. C) delete and rely on the menu Sim speed.
- Decision: B. Segmented 1× / 5× / 20×, label "Time scale", module-local, options row.
- Rationale: the user's decision is "verbatim": id `timeScale`. Whitelist allows fixing an id to match the pack. A 10-file mechanical rename exceeds the table's "<= 3 files", but the pre-seed overrides it and it is test-covered.
- Confidence: high. Cost: S (10 one-line edits + 1 test). Risk if wrong: nothing reads the id elsewhere (grep: no other reference).
- Reversibility: easy. Phase: 6 polish.
- Note: if the ⋯ menu is later extended to 20×, delete this control and map it to the global value.
- Veto window: `veto D6-1` -> revert the rename (sed `timeScale`->`timescale`) and drop the 6.5 test.

### D6-2 — Universal panel schema
- Class: Auto-doc
- Context: `CFG.options`, `CFG.ctls`, `CFG.onReset` already work. `mountPanel` would be a second rendering path that Phase 7a deletes (7a replaces the guided panels).
- Options: A) implement `mountPanel` as an alias. B) document only. C) retrofit the 10 modules.
- Decision: B. Proposed schema for 7a, no code: `CFG.panel = { primary: [ctl…], options: [choice|toggle|action…], timeScale: true|{options}, reset: fn }`, rendered by `mountPanel(CFG, ui)` in `components.js`; no `monitor` field until 7a. `CFG.ctls / CFG.options / CFG.onReset` stay as aliases.
- Rationale: pack scope limit — only implement if a pure alias; it would touch `components.js`, a test and every caller for no user-visible gain.
- Confidence: high. Cost: 0. Risk if wrong: 7a does it a phase later. Reversibility: easy. Phase: 7.
- Veto window: `veto D6-2` -> ask for the alias in 7a.

### D6-3 — Options-row overflow
- Class: Auto-flag
- Context: `controls.css` (Phase 6 block) makes `.al-dock-options` one non-wrapping line that scrolls horizontally with a mask fade (`controls.css:851–857`). Portrait chips are 40 px, landscape rails and desktop 44 px (`--ctl-tap`). The portrait and landscape rules sit earlier (`:337`, `:386`); landscape turns the mask off and stacks controls in the 140 px rail.
- Options: A) scroll + fade everywhere. B) overflow into a "More" select. C) wrap on desktop, scroll on phones.
- Decision: phone rule = ONE row, 40–44 px chips, scroll + fade (A, as built). Desktop rule = should WRAP (C), because a wide bar has the room and a hidden-by-scroll option is a worse failure than a taller bar. Not changed here: the desktop rule is a visual CSS change outside the whitelist. Recorded for Phase 8.
- Confidence: low (needs a real device; differential has 6 options + the global ones).
- Cost: S (CSS only). Risk if wrong: on a narrow desktop window an option can sit off-screen behind the fade. Reversibility: easy. Phase: 8.
- Veto window: `veto D6-3` -> keep scroll on desktop and drop the Phase 8 item.

### D6-4 — Reset policy per control type
- Class: Auto-flag
- Context: `controls.resetAll()` (`controls.js:75`) resets every registry-backed instance to its spec default and skips actions. `components.js:238` runs `CFG.onReset()` first, then `controls.resetAll()`.
- Policy (matches the code): choice -> `def` (id or index, else first option); toggle -> `def` (false unless `def:true`); action -> nothing to reset; pedal -> released to rest/0; dial -> `def` (0 / centre; crank 0). No `keepOnReset` exists; none is needed yet.
- Flag: before Phase 6 the old panel Reset buttons / `resetAll` reset only what each module coded. Now the dock Reset also returns every new choice and toggle to its default. By construction this matches the old behaviour for the 10 guided modules (their old reset wrote the select defaults), but it was NOT compared per module for braking (ABS / FAIL / AIR), engine (slow-mo, view, config), suspension (Susp/Rigid, slow-mo), differential (5 toggles, camera), electrical (direction, key), cooling (mode, fins). One real change: `config` choices now snap back to the module's default configuration on Reset (e.g. gearbox -> Manual).
- Confidence: medium. Cost: S if a module needs `keepOnReset`. Risk if wrong: a user's chosen configuration is lost on Reset. Reversibility: easy (add `keepOnReset:true` to the spec and skip it in `resetAll`). Phase: 8 / manual QA.
- Veto window: `veto D6-4` -> add `keepOnReset` for `config` choices.

### D6-5 — Fault-label escaping
- Class: Auto-doc
- Context: `controls.js:164` escapes `& < > "` for every label, aria-label and option text, so control labels render as plain text. Grep found no `&...;` entity in any control label or `FAULT_INFO` label; non-ASCII characters are written as JS `\u` escapes or literal characters (e.g. `O\u2082 open`, `Advance +10\u00b0`).
- Options: A) leave as is. B) add a test. C) allow entities. Decision: A (a `&amp;` typed into a label would show literally; none exist).
- Confidence: high. Cost: 0. Risk: none. Reversibility: easy. Phase: post.
- Veto window: `veto D6-5` -> add an entity-ban test.

### D6-6 — Soft-keyboard dock hide
- Class: Refused (cannot verify) / code read
- Context: `dock.js:162–168`: the dock hides (`root.hidden`) only while the active element is a `<select>` AND `layoutH - visualH >= DOCK.kbdDeltaPx` (120 px). Not gated by breakpoint: on desktop `visualViewport` does not shrink, so it never fires. It hides the dock instead of squashing the 3D view.
- Decision: log as manual check. Confidence: low (behaviour on iOS Safari / Android Chrome unverified). Phase: 8.5 visual matrix.
- Veto window: n/a.

### D6-7 — Remaining `window.__*` hooks
- Class: Auto-doc
- Context: survivors are `cooling.html:1505` (read of `__autolabDensity`, written by `kit.js:1120`, also read by `labels.js`) and `index.html` `__autolabPerfGuard`. All Phase 6-era hooks (`__brakeSyncIcons`, `__carbSyncPlayIcons`, `__coolingSyncIcons`, `__wireShifterWidget`, `__wireTorqueWidget`) are gone.
- Decision: keep both, with reason: a documented config global and a shell flag. Revisit when the Monitor owns density (Phase 7). Confidence: high. Cost: 0. Reversibility: easy. Phase: 8.
- Veto window: `veto D6-7` -> replace with a `Base` accessor in Phase 8.

### D6-8 — check.mjs warn-only rule
- Class: Auto-fix
- Context: Phase 6's rule scanned kit pages with an inline regex exclusion. Hard to audit.
- Decision: the exclusion list is now one explicit table `AUTHORED_OK` in `tests/check.mjs` (quiz `.al-opt`, `tq-toggle`), with reasons, and `tests/choice.test.mjs` asserts the same: on kit pages the only `<button|<select|<input` lines are those. Scope: pages importing `kit.js` or `components.js`; lines that are comments are skipped; also WARNs on non-empty toolbar `extras` and `window.__*Sync*`. Four bespoke modules (sparkplug, thermostat, tyres, wiring) still WARN and are exempt in the test with a comment.
- Confidence: high. Cost: S (2 files). Risk if wrong: a new quiz-like markup needs a table row. Reversibility: easy. Phase: 6 polish.
- Veto window: `veto D6-8` -> restore the inline regex.

### D6-9 — Old CSS delete list
- Class: Auto-fix
- Context: the pack's delete-list grep is clean for every selector except `.al-sel` (components.css). Also `.al-w` (components.css, abs-esc, ecu, obd2) was dead. Both were proven unreferenced by a scan of every html / js file outside `<style>`.
- Decision: deleted `.al-sel` and `.al-w` (+ `label`, `b` variants) in `components.css`, `abs-esc.html`, `ecu.html`, `obd2.html`. KEPT `.al-fault` (live content cards, not buttons). A test keeps the whole delete list deleted.
- Confidence: high. Cost: S (4 files; whitelist). Risk: none seen. Reversibility: easy. Phase: 6 polish.
- Veto window: `veto D6-9` -> restore the four rule blocks from `AutoLab2-phase6.zip`.

### D6-10 — Gate keyboard map
- Class: Auto-doc
- Context: `gateKeyToIntent`: ↑ = shift up (+1), ↓ = shift down (−1), `N` = neutral, `Esc` / `Home` = neutral (the single reset path). Segmented choices use ← / →. Test-covered.
- Decision: matches the pack; no change. Flag: gearbox gate order is N, 1, 2, 3, 4, R, so ↑ from 4 lands on R. Acceptable for a first pass, but a real H-gate moves sideways between columns, so a visual pass may want ←/→ across columns. Confidence: medium. Phase: 8.
- Veto window: `veto D6-10` -> change the key map in `controls-core.js` and the test.

### D6-11 — Crit tone
- Class: Auto-doc
- Context: `tone:'crit'` is set in each module's spec: automatic R; gearbox R; electrical Start; starting-system Start; ecu "Crank no-signal" and "Knock event"; suspension Rigid; actions mpfi "Reset trims" and obd2 "Clear codes". Drawn by `controls.css` via `var(--crit)` (exists in `app.css:92,133`).
- Decision: the rule lives in the module (it is module knowledge); drawing lives in the shared CSS. No shared helper. Confidence: high. Phase: post.
- Veto window: `veto D6-11` -> list the intended crit options and edit specs.

### D6-12 — Shared factories
- Class: Auto-doc
- Context: the `timeScale` choice is the same spec in 10 modules; the fault/type select built from `FAULT_INFO` repeats in 4+ guided modules.
- Threshold: promote a per-module pattern when 3 or more modules carry an identical spec (or the same `onChange` body).
- Decision: `timeScale` meets it -> candidate `timeScaleChoice({ onChange })` in `components.js`; not implemented now (10-file change, and 7a rewrites these panels). Confidence: medium. Cost: M. Phase: 7.
- Veto window: `veto D6-12` -> schedule it for 7a instead.

### D6-13 — Cache bump
- Class: Auto-fix
- Context: Phase 6 shipped `autolab-v8.6`. `check.mjs` passes the precache check (no new files in Phase 6 or 6.5; `controls.js` / `controls.css` already in CORE_ASSETS).
- Decision: bumped to `autolab-v8.6.1`; the version assertions in `dock.test.mjs` / `shell.test.mjs` / `choice.test.mjs` accept `v8.6` or `v8.6.N`. Confidence: high. Cost: S. Reversibility: easy. Phase: 6 polish.
- Veto window: `veto D6-13` -> set VERSION back to `autolab-v8.6`.

### D6-14 — Manual QA checklist (Phase 6)
Auto-proved (unit / static): option and index maths, registry clamping and 0/1 storage, listener-on-change-only, gate and segmented key intents, unique control ids per page, no authored controls on kit pages, delete lists, one RAF site, tokens-only CSS, 11 px text, cache version.
Must be done by hand (nothing here was run in a browser):
1. Segmented choice: tap, ←/→, Tab lands on the selected radio only.
2. Select layout in the options row on a real phone: the dock hides while the picker is open and returns after.
3. Gate on gearbox: tap each stop, ↑/↓, N / Esc / Home; gear changes in the sim and the knob follows when the gear changes from elsewhere.
4. Toggles: Space / Enter on the focused switch flips it; Space elsewhere is still play/pause.
5. Dock Reset: every new control returns to its default (D6-4 list) and no stray flash ("OIL RESTORED").
6. engine: stroke choice follows the sim and jumps `theta` when picked; view and slow-mo work; Reset does not throw.
7. electrical / cooling / mpfi: mode-dependent controls hide and show (`setHidden`); mpfi EGR pulse only in CRDI.
8. Guided modules: timeScale 1/5/20 changes the thermal rate; dpf Force regen releases when regen starts.
9. 360×640 portrait: options row scrolls, fade edges, nothing under the handle; landscape rail; light theme.
10. Reduced motion: toggle / gate transitions off.

### D6-15 — Phase-boundary leaks
- Class: Auto-doc
- Phase 7 / 8 work already done: none. No Monitor, no readout move, no colour clean-up.
- Phase 6 items that must move or stay open: (a) `lighting` dip switch (D6-16); (b) sparkplug, thermostat, tyres, wiring bespoke UIs (not on the Phase 6 list; user decision, not done); (c) gearbox `tq-toggle` chevron -> 7b; (d) `ui.toolbar.setRpmLabel` untouched (7a/7b); (e) `kit.js` MutationObserver -> 7a; (f) desktop options-row wrap -> 8 (D6-3).
- Also kept per the hard rules: the three baseline bugs (fuelpump `domLast` vs `lastDom`, oilpump `Base`, wiring `THREE`) are still exactly as received — verified by grep, untouched.
- Veto window: n/a (a list).

### D6-16 — `lighting` dip switch is still a slider (found in this audit)
- Class: Auto-flag
- Context: open item #2 in the pack says Phase 6 makes the dip switch a 3-stop `choice`. `lighting.html:42` still declares `ctl: { label: 'Dip switch', val: 45, caption: 'Off  Low  High' }` and the apply function derives `m` (0 off / 1 low / 2 high) from that 0–100 value. My Phase 6 report wrongly said "nothing to migrate".
- Options: A) migrate now (`options:[{id:'dip', type:'choice', layout:'segmented', options:[Off, Low beam, High beam]}]`, map to `m`). B) leave and document. C) make it a primary-zone gate.
- Decision: B. It changes module behaviour (slider -> 3 stops, the apply maths reads a different input), so it is outside the Auto-fix whitelist. Recommended implementation is A with the id `dip` and def `Low`; the existing sim value 45 sits in the Low band.
- Rationale: pack rule "behaviour changes are not auto-fixable".
- Confidence: low on the exact mapping (a ctl-value to `m` conversion I have not read in full). Cost: S (1 file + test). Risk if wrong: none now; the slider still works. Reversibility: easy. Phase: 6 polish (needs your go-ahead).
- Veto window: `veto D6-16` -> tell me to do option A now and I will migrate it as a Phase 6 completion.

## Step 4 — Not decided here
- Monitor channels for module readouts and the chip / panel rows — 7a / 7b.
- Legend move into the Monitor footer — 7b.
- Replacing the guided-module panels (graph canvases, `*-warn`) — 7a.
- Deleting the `kit.js` MutationObserver and `ui.toolbar.setRpmLabel` — 7a / 7b.
- README / GUIDE / COMPONENTS rewrite — 8.
- Hard-coded colour clean-up (~650 hex/rgba in `<style>`) — 8.
- Desktop options-row wrap, soft-keyboard behaviour, full visual matrix — 8 / 8.5.

## Veto log
Every decision is reversible via the listed route. Reply with `veto D6-<n>` to overturn any decision.
- D6-1: revert the `timeScale` rename (10 one-line edits) — `AutoLab2-phase6.zip` has the old id.
- D6-2: ask for `mountPanel` in 7a.
- D6-3: keep scroll on desktop, drop the Phase 8 wrap item.
- D6-4: add `keepOnReset` to `config` choices.
- D6-5: add an entity-ban test.
- D6-6: n/a (manual check).
- D6-7: replace the density global with an accessor in Phase 8.
- D6-8: restore the inline regex in `check.mjs`.
- D6-9: restore the 4 CSS rule blocks from the Phase 6 zip.
- D6-10: change the gate key map.
- D6-11: re-list the crit options.
- D6-12: schedule `timeScaleChoice()` for 7a.
- D6-13: set VERSION back to `autolab-v8.6`.
- D6-14: n/a (checklist).
- D6-15: n/a (list).
- D6-16: say "do D6-16 option A" and I migrate `lighting`.

Auto-flag (user should read first):
- D6-16: `lighting` dip switch was NOT migrated in Phase 6 (my report was wrong); left as a slider because migrating changes behaviour.
- D6-3: desktop options row should wrap rather than scroll; left unchanged, needs a device.
- D6-4: Reset now also restores `config` choices and toggles in ~6 modules; not compared module by module.

## Re-packaged files
| path | reason | test status |
|---|---|---|
| awd.html, catalytic.html, commonrail.html, dpf.html, driveshaft.html, egr.html, fuelpump.html, intercooler.html, oilpump.html, radiator.html | D6-1 id `timeScale` | `npm test` green |
| components.css | D6-9 dead `.al-w`, `.al-sel` | green |
| abs-esc.html, ecu.html, obd2.html | D6-9 dead `.al-w` | green |
| tests/check.mjs | D6-8 explicit exclusion table | green |
| tests/choice.test.mjs | D6-1, D6-8, D6-9, D6-13 tests; id regex accepts both quote styles | green (4 new groups; DOM group skipped) |
| tests/dock.test.mjs, tests/shell.test.mjs | D6-13 accept `autolab-v8.6.N` | green |
| sw.js | D6-13 `autolab-v8.6.1` | green |
| DECISIONS-6.md | this file | n/a |

Final `npm test`: exit 0, 150 checks. Not run: any DOM or visual check.

## Follow-up — D6-16 done (veto route used: "do D6-16 option A")
- `lighting.html`: the dip switch is now a primary-zone segmented `choice`, id `dip`, options Off / Low beam / High beam, default Low (the old slider value 45 sat in the Low band, so the start state is unchanged). `onChange` sets a module-local `dipMode` (0/1/2) that the sim reads instead of `c.k`; the Overview "Try this" text was reworded (no more "drag").
- `components.js`: `guidedCtls` returns `[]` when `CFG.ctl === null`, so a guided module can have no main slider (one line; all other modules unchanged).
- Tests: `lighting` added to the migrated list; two new static tests (dip choice, default Low, no slider, sim reads `dipMode`; `ctl === null` guard). `npm test` exit 0, 152 checks.
- Cache: `autolab-v8.6.2`.
- Not verified (no browser): Reset returns the switch to Low; the stalk and beam follow the choice; the layout at 360x640 with the legend in the primary-right slot.
