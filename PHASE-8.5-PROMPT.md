PHASE 8.5 — VERIFY IN A BROWSER, FIX WHAT QA AND POLISH FOUND
(paste AFTER the MASTER PROMPT, section 2 HARD RULES, 2A RESUME PROMPT + 2B STATUS and 2C DELIVERABLES from
AutoLab2-prompt-pack-after-phase7.md, and after the AI has replied "Ready")

INPUT ZIP: AutoLab2-phase8.zip (cache autolab-v8.9), plus the user's filled QA.md (every ☐ replaced by ✓ or ✗ <note>) and
POLISH.md. Check sw.js VERSION and run npm test first, as in 2A. Output zip: AutoLab2-phase8-5.zip, cache autolab-v8.9.1.

NOTES ON THE INPUT
- Phase 8 could render only sensors.html. The colour conversion (about 316 CSS colours, 85 legend colours, 17 removed
  light-theme overrides) and the rewritten sparkplug, thermostat, tyres and wiring were checked by syntax and static tests only.
- No numbered rule text (R1–R12) was available in Phase 8 beyond what the code cites; SELF-CHECK.md lists the deviations.
- Keep the user's hand edits (lighting, ignition, exhaustsystem, cooling, steering). Do not restore anything.

TASKS (do them in this order; one fix per ✗ in QA.md, nothing else)
1. Read QA.md and POLISH.md. For each ✗ write one line: module, viewport, mode, symptom, cause (read the code), fix. Fix only
   what the user marked. Add any fix that can be proved without a browser as a test in tests/phase8.test.mjs.
2. Known candidates (confirm against QA.md before touching): (a) landscape rail clips axis labels (`.ctl-axis { min-width: 140px }`
   vs a 122 px rail, controls.css); (b) sensors needs three.js for the UI (split the UI half of kit.js, or load three lazily);
   (c) shell ⋯ menu shows wireframe / x-ray / density for modules that cannot use them (add a capability flag in modules.js and
   postMessage); (d) the roughly 139 colour literals left outside <style> (inline style strings, cssText, canvas fillStyle,
   badge colours): convert the ones that style controls / readouts / legends, leave 3D and canvas-drawing colours, and extend
   check.mjs to fail on the converted classes; (e) package.json "type": "module" to silence MODULE_TYPELESS (only if the whole
   suite still passes); (f) Monitor row lists longer than 9 rows on a phone card.
3. Re-run npm test. Update CHANGELOG.md (8.9.1), the version strings (README, GUIDE, COMPONENTS, components.js, components.css,
   package.json) and sw.js VERSION together; check.mjs enforces it.
4. List every remaining deviation honestly. Do not mark a QA cell yourself; the user owns the manual cells.

ACCEPTANCE: npm test passes; every ✗ has a fix or an explicit "not fixed, because"; grep for the Phase 8 deletions stays clean.
DELIVERABLES: section 2C (whole zip, remaining prompt md for Phase 9 if any, GitHub update zip, self-check). Report, deliver, stop.
