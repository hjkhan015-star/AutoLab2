// node tests/axis.test.mjs — Phase 3: one slider primitive. Static checks always run; the DOM check runs
// when jsdom is resolvable (it is NOT a project dependency: R11 — run `npm i jsdom` in a scratch dir and
// set JSDOM_PATH, or have it installed globally; otherwise that group is skipped and says so).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const pages = fs.readdirSync(root).filter((f) => f.endsWith('.html'));
let n = 0;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b}`);
const t = async (name, fn) => { await fn(); n++; console.log('ok  ', name); };

await t('no <input type="range"> in any page except sensors.html (Phase 8) — only controls.js / chrome.js build them', () => {
  const bad = pages.filter((f) => f !== 'sensors.html' && /type=\\?"range\\?"/.test(rd(f)));
  assert.deepEqual(bad, []);
  const js = fs.readdirSync(root).filter((f) => f.endsWith('.js') && !['controls.js', 'chrome.js'].includes(f));
  const badJs = js.filter((f) => /type=\\?"range\\?"|type\s*=\s*['"]range['"]/.test(rd(f)));
  assert.deepEqual(badJs, [], 'range inputs outside controls.js / chrome.js');
});

await t('legacy slider classes are gone (.al-range, .ui-tb-speed, data-phase1-temp, speed-module)', () => {
  for (const f of [...pages.filter((p) => p !== 'sensors.html'), 'app.css', 'components.css', 'controls.css', 'kit.js', 'components.js']) {
    const s = rd(f);
    assert.ok(!/al-range|ui-tb-speed|data-phase1-temp|speed-module|Widgets\.slider/.test(s), `${f} still references a removed slider`);
  }
});

await t('modules read slider values only through ui.controls / controls (no el.value reads of removed inputs)', () => {
  for (const f of ['awd','catalytic','commonrail','dpf','driveshaft','egr','fuelpump','intercooler','oilpump','radiator']) {
    const s = rd(f + '.html');
    assert.match(s, /ctls:\s*\[/, `${f}: no ctls[]`);
    assert.ok(!/getElementById\('ctl'\)|CFG\.ctl\b/.test(s), `${f}: still touches #ctl / CFG.ctl`);
    const ids = [...s.matchAll(/\{ id:'(\w+)'/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${f}: duplicate control ids ${ids}`);
    assert.ok(ids[0] === 'ctl', `${f}: ctls[0] must be the main 'ctl' control`);
  }
});

await t('fuelpump uses real volts (preset voltage), not centivolts', () => {
  const s = rd('fuelpump.html');
  assert.match(s, /preset:'voltage'/);
  assert.ok(!/1350|\/ 100\)/.test(s.split('\n').filter((l) => /volts/i.test(l)).join('\n')));
});

await t('D8/D16: cooling + abs-esc + ignition + mpfi have own axes; state.speedMul is not a quantity any more', () => {
  const need = { 'cooling.html': 'rpm', 'abs-esc.html': 'speed', 'ignition.html': 'rpm', 'mpfi.html': 'load' };
  for (const [f, id] of Object.entries(need)) {
    const s = rd(f);
    assert.match(s, new RegExp(`id: '${id}'`), `${f}: no '${id}' axis`);
  }
  const abs = rd('abs-esc.html').split('\n').filter((l) => /state\.speedMul/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l) && !/\/\/.*state\.speedMul/.test(l.split('state.speedMul')[0] + '//'));
  assert.ok(!/const v\s*=\s*state\.speedMul/.test(rd('abs-esc.html')));
  assert.ok(!/state\.speedMul \* |\* state\.speedMul|\(700 \+ 2100 \* state\.speedMul/.test(rd('cooling.html').replace(/state\.time \+= dt \* state\.speedMul/, '')),
    'cooling physics must use engLevel(), only the time step may use sim speed');
  void abs;
});

await t('controls.js + controls-core.js precached; cache version bumped', () => {
  const sw = rd('sw.js');
  assert.match(sw, /'\.\/controls\.js'/);
  assert.match(sw, /'\.\/controls-core\.js'/);
  assert.match(sw, /autolab-v8\.([3-9]|10)/);
});

await t('controls.css: axis is 44 px, tokens only, focus ring + reduced motion', () => {
  const css = rd('controls.css');
  const axis = css.slice(css.indexOf('PHASE 3'));
  assert.match(axis, /height: var\(--ctl-tap\)/);
  assert.match(axis, /focus-visible/);
  assert.match(axis, /prefers-reduced-motion/);
  assert.match(axis, /touch-action: none/);
  assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(axis), 'hard-coded colour in axis CSS (R3)');
});


/* ── Phase 4: pedal + momentary (static) ───────────────────────────────────── */
const PEDAL_MODULES = { 'braking.html': 'brake', 'automatic.html': 'throttle', 'carburetor.html': 'throttle', 'turbocharger.html': 'throttle', 'abs-esc.html': 'brake' };

await t('Phase 4: the five copy-pasted pedal implementations are gone (no springRelease / cancelReturn / __setPos / wirePedal / PedalSync)', () => {
  for (const f of pages) {
    const s = rd(f);
    assert.ok(!/springRelease|cancelReturn|cancelAccelReturn|__setPos|__cancelReturn|wirePedal|PedalSync/.test(s), `${f}: copy-pasted pedal code`);
  }
});

await t('Phase 4: no old pedal selectors anywhere, and no light-theme pedal override', () => {
  for (const f of [...pages, 'app.css', 'components.css', 'controls.css', 'kit.js', 'components.js']) {
    const s = rd(f);
    assert.ok(!/\.br-pedal|\.at-pedal|\.carb-pedal|#accel-|\.clutch-pedal|#clutch-pedal|\.pedal-plate|\.pedal-grip/.test(s), `${f}: old pedal selector`);
    assert.ok(!/html\.light-theme[^{]*pedal/i.test(s), `${f}: light-theme pedal override`);
  }
});

await t("Phase 4: no pedal keyboard handlers in modules (Space is play/pause only; ↑/↓ live in controls.js; gearbox's stick is Phase 6)", () => {
  for (const f of pages) {
    const s = rd(f);
    assert.ok(!/e\.code\s*===\s*'Space'|code\s*===\s*'Space'/.test(s), `${f}: Space handler`);
    if (f !== 'gearbox.html') assert.ok(!/'ArrowUp'|'ArrowDown'/.test(s), `${f}: per-module ↑/↓ handler`);
  }
});

await t('Phase 4: each pedal module declares its pedal axis (look:pedal, spring:return, k, keys:arrows) and reads ui.controls.get', () => {
  for (const [f, id] of Object.entries(PEDAL_MODULES)) {
    const s = rd(f);
    const m = s.match(new RegExp(`\\{[^{}]*id:\\s*'${id}'[^{}]*\\}`));
    assert.ok(m, `${f}: no '${id}' axis`);
    for (const need of [/look:\s*'pedal'/, /spring:\s*'return'/, /\bk:\s*\d/, /keys:\s*'arrows'/]) assert.match(m[0], need, `${f}: ${need}`);
    assert.match(s, new RegExp(`ui\\.controls\\.(get|value)\\('${id}'\\)`), `${f}: does not read the pedal from the store`);
    assert.match(s, /ui\.controls\.resetAll\(\)/, `${f}: Reset must release the pedal`);
  }
  const k = Object.fromEntries(Object.keys(PEDAL_MODULES).map((f) => [f, Number(rd(f).match(/look:\s*'pedal'[^}]*\bk:\s*([\d.]+)/)[1])]));
  assert.equal(k['braking.html'], 7.67); assert.equal(k['turbocharger.html'], 7.67);      /* old factor 0.88 */
  assert.equal(k['automatic.html'], 9.05); assert.equal(k['carburetor.html'], 9.05);       /* old factor 0.86 */
});

await t("Phase 4: clutch is a momentary ('clutch', 0/1); its eased engage stays in the module; no pedal state variables left", () => {
  const s = rd('clutch.html');
  assert.match(s, /type:\s*'momentary'[^}]*id:\s*'clutch'|id:\s*'clutch'[^}]*type:\s*'momentary'/);
  assert.match(s, /ui\.controls\.get\('clutch'\)/);
  assert.match(s, /PEDAL_TAU_IN/);                        /* the eased engage/disengage is untouched */
  assert.ok(!/clPedalTarget|clPedalHeld|pedalDown|pedalUp|clutchPedalEl|Hold to disengage<\//.test(s), 'old clutch pedal code');
  for (const f of ['braking.html', 'automatic.html', 'carburetor.html', 'turbocharger.html']) {
    assert.ok(!/\b(let|var)\s+(throttle|pedalPos|accelPos)\b/.test(rd(f)), `${f}: pedal state variable`);
  }
});

await t('Phase 4: no duplicate pedal caption beside the pedal ("Press & hold · 0%", "Hold · 0%")', () => {
  for (const f of Object.keys(PEDAL_MODULES).concat('clutch.html')) assert.ok(!/Press &amp; hold|Hold · <span|Hold to build|data-pedal-cap|data-throttle-cap/.test(rd(f)), `${f}: pedal caption`);
});

await t('Phase 4: pedal / momentary CSS — tokens only, 48–56 px phone bar, desktop 54×158, ≥ 44 px, focus ring, reduced motion', () => {
  const css = rd('controls.css');
  const p4 = css.slice(css.indexOf('PHASE 4'));
  assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(/.test(p4), 'hard-coded colour in pedal CSS (R3)');
  assert.match(p4, /--ctl-pad-w: 54px/); assert.match(p4, /--ctl-pad-h: 158px/);
  assert.match(p4, /max-width: 720px\), \(max-height: 540px/);
  const h = Number((p4.match(/\.ctl-pedal-pad \{ width: 100%; height: (\d+)px/) || [])[1]);
  assert.ok(h >= 48 && h <= 56, `phone bar height ${h}`);
  assert.match(p4, /touch-action: none/); assert.match(p4, /-webkit-touch-callout: none/); assert.match(p4, /user-select: none/);
  assert.match(p4, /focus-visible/); assert.match(p4, /prefers-reduced-motion/);
});

await t('Phase 4: controls.js owns ONE shared RAF loop (no per-pedal timers) and respects reduced motion', () => {
  const js = rd('controls.js');
  assert.equal((js.match(/requestAnimationFrame\(/g) || []).length, 1, 'exactly one requestAnimationFrame call site');
  assert.ok(!/setInterval\(/.test(js));
  assert.match(js, /prefers-reduced-motion/);
});

/* ── DOM (optional) ── */
let JSDOM = null;
try {
  const req = createRequire(process.env.JSDOM_PATH ? pathToFileURL(path.join(process.env.JSDOM_PATH, 'x.js')) : import.meta.url);
  JSDOM = req('jsdom').JSDOM;
} catch (_) { /* skipped below */ }

if (!JSDOM) {
  console.log('skip  axis DOM tests (jsdom not available; set JSDOM_PATH to a dir with jsdom installed)');
} else {
  const dom = new JSDOM('<!doctype html><body></body>');
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  const { controls, createAxis } = await import('../controls.js');
  const { registry } = await import('../controls-core.js');

  await t('DOM axis: one root node, role/aria, value text with unit, keyboard ↑/↓ steps', () => {
    registry.reset();
    const ax = createAxis({ id: 'rpm', preset: 'rpm', max: 5500, def: 2400, label: 'Engine speed' });
    document.body.appendChild(ax.el);
    assert.equal(document.querySelectorAll('[data-ctl="rpm"]').length, 1);
    assert.equal(ax.value(), 2400);
    assert.equal(ax.input.getAttribute('aria-valuetext'), '2400 rpm');
    assert.equal(ax.el.querySelector('.ctl-value').textContent, '2400 rpm');
    assert.equal(ax.input.getAttribute('aria-label'), 'Engine speed');
    ax.input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    assert.ok(ax.value() > 2400, 'ArrowUp raises the value');
    ax.input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    ax.input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    assert.ok(ax.value() < 2400);
  });

  await t('DOM axis: input -> store -> listeners (change-only); set()/reset()/raw()/setText()', () => {
    registry.reset();
    const ax = createAxis({ id: 'volts', preset: 'voltage' });
    let calls = 0, last = null;
    ax.on((v) => { calls++; last = v; });
    ax.input.value = String(Math.round(0.5 * Number(ax.input.max)));
    ax.input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    assert.equal(calls, 1);
    assert.equal(controls.get('volts'), last);
    assert.equal(ax.value(), 11.5);
    assert.equal(ax.raw(), 1150);
    ax.set(ax.get());                      /* no change -> no event */
    assert.equal(calls, 1);
    ax.reset();
    assert.equal(ax.value(), 13.5);
    ax.setText('Fuse blown');
    assert.equal(ax.el.querySelector('.ctl-value').textContent, 'Fuse blown');
    assert.equal(ax.input.getAttribute('aria-valuetext'), 'Fuse blown');
    ax.setText(null);
    assert.equal(ax.el.querySelector('.ctl-value').textContent, '13.5 V');
  });

  await t('DOM axis: duplicate id throws (R9); resetAll() restores every default; setDisabled', () => {
    registry.reset();
    const a = createAxis({ id: 'a', min: 0, max: 10, step: 1, def: 3 });
    const b = createAxis({ id: 'b', preset: 'percent', def: 40 });
    assert.throws(() => createAxis({ id: 'a', min: 0, max: 1 }), /duplicate/);
    a.set(1); b.set(1);
    controls.resetAll();
    assert.equal(a.value(), 3);
    assert.equal(b.value(), 40);
    controls.setDisabled('a', true);
    assert.equal(a.input.disabled, true);
  });

  await t('DOM axis: drag shows the bubble state; custom format (+/- degrees) is used in text', () => {
    registry.reset();
    const ax = createAxis({ id: 'adv', min: -20, max: 20, step: 1, def: 0, unit: '°', format: (v) => (v > 0 ? '+' : '') + v + '°' });
    ax.input.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
    assert.ok(ax.el.classList.contains('is-dragging'));
    ax.setValue(10);
    assert.equal(ax.el.querySelector('.ctl-bubble').textContent, '+10°');
    ax.input.dispatchEvent(new dom.window.Event('pointerup', { bubbles: true }));
    assert.ok(!ax.el.classList.contains('is-dragging'));
  });
  /* ── Phase 4 DOM: pedal + momentary ──────────────────────────────────────── */
  const { createMomentary, _pedalLoop } = await import('../controls.js');
  const W = dom.window;
  const kd = (key, extra = {}) => new W.KeyboardEvent('keydown', Object.assign({ key, bubbles: true, cancelable: true }, extra));
  const ku = (key) => new W.KeyboardEvent('keyup', { key, bubbles: true, cancelable: true });
  const ptr = (type, y, id = 1, x = 10) => { const e = new W.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }); Object.defineProperty(e, 'pointerId', { value: id }); return e; };
  const clean = () => { controls.instances().forEach((i) => i.destroy()); registry.reset(); };   /* destroy() also detaches the shared Shift listener target */
  const mkPedal = (extra = {}, opts = {}) => {
    clean();
    const p = createAxis(Object.assign({ id: 'throttle', look: 'pedal', preset: 'percent', label: 'Throttle', spring: 'return', k: 9.05, keys: 'arrows' }, extra), opts);
    document.body.appendChild(p.el);
    p.pad.getBoundingClientRect = () => ({ left: 0, top: 0, width: 54, height: 158, right: 54, bottom: 158 });
    p.pad.captured = null; p.pad.setPointerCapture = (id) => { p.pad.captured = id; };
    return p;
  };
  const settle = () => { for (let i = 0; i < 2000 && _pedalLoop.running(); i++) _pedalLoop.tick(1 / 60); };

  await t('DOM pedal: role=slider, aria-valuemin/max/now, aria-valuetext with unit, aria-label, one node, registry id', () => {
    const p = mkPedal();
    assert.equal(document.querySelectorAll('[data-ctl="throttle"]').length, 1);
    assert.equal(p.pad.getAttribute('role'), 'slider');
    assert.equal(p.pad.getAttribute('aria-valuemin'), '0'); assert.equal(p.pad.getAttribute('aria-valuemax'), '100');
    assert.equal(p.pad.getAttribute('aria-valuenow'), '0'); assert.equal(p.pad.getAttribute('aria-valuetext'), '0%');
    assert.equal(p.pad.getAttribute('aria-label'), 'Throttle');
    assert.equal(p.pad.tabIndex, 0);
    p.set(0.62);
    assert.equal(p.pad.getAttribute('aria-valuetext'), '62%'); assert.equal(p.pad.getAttribute('aria-valuenow'), '62');
    assert.equal(controls.get('throttle'), 0.62); assert.equal(controls.value('throttle'), 62);
    assert.throws(() => createAxis({ id: 'throttle', look: 'pedal', preset: 'percent' }), /duplicate/);
    assert.equal(createAxis({ id: 'x', look: 'pedal', preset: 'percent', ariaLabel: 'Brake pedal' }).pad.getAttribute('aria-label'), 'Brake pedal');
  });

  await t('DOM pedal: pointer capture on the pad, value follows the pointer (vertical), spring-back on release, shared loop stops', () => {
    const p = mkPedal();
    p.pad.dispatchEvent(ptr('pointerdown', 79));                       /* middle of a 158 px pedal */
    assert.equal(p.pad.captured, 1, 'pointer captured on the pad');
    near(controls.get('throttle'), 0.5, 0.011, 'half way');
    p.pad.dispatchEvent(ptr('pointermove', 0)); assert.equal(controls.get('throttle'), 1);
    _pedalLoop.tick(1); assert.equal(controls.get('throttle'), 1, 'held pedal does not spring');
    p.pad.dispatchEvent(ptr('pointerup', 0));
    assert.equal(controls.loopRunning(), true, 'release starts the shared loop');
    _pedalLoop.tick(1 / 60);
    near(controls.get('throttle'), 0.86, 0.011, 'one frame of the old 0.86 decay');
    settle();
    assert.equal(controls.get('throttle'), 0); assert.equal(controls.loopRunning(), false, 'loop stops when every pedal is at rest');
  });

  await t('DOM pedal: horizontal bar (phone) maps x, not y', () => {
    const p = mkPedal();
    p.pad.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 52, right: 300, bottom: 52 });
    p.pad.dispatchEvent(ptr('pointerdown', 20, 1, 150));
    near(controls.get('throttle'), 0.5, 0.011, 'x = half');
    p.pad.dispatchEvent(ptr('pointerup', 20, 1, 150)); settle();
  });

  await t('DOM pedal: ↑/↓ step by 8 % and stay; Space does nothing; context menu is blocked on the pad', () => {
    const p = mkPedal();
    p.pad.dispatchEvent(kd('ArrowUp')); near(controls.get('throttle'), 0.08, 0.011);
    p.pad.dispatchEvent(kd('ArrowUp')); near(controls.get('throttle'), 0.16, 0.011);
    p.pad.dispatchEvent(kd('ArrowDown')); near(controls.get('throttle'), 0.08, 0.011);
    const before = controls.get('throttle');
    const sp = kd(' '); p.pad.dispatchEvent(sp);
    p.pad.dispatchEvent(ku(' '));
    assert.equal(controls.get('throttle'), before, 'Space does not act on a pedal');
    assert.equal(sp.defaultPrevented, false, 'Space is left to play/pause');
    assert.equal(controls.loopRunning(), false);
    const cm = new W.Event('contextmenu', { bubbles: true, cancelable: true }); p.pad.dispatchEvent(cm);
    assert.equal(cm.defaultPrevented, true);
  });

  await t('DOM pedal: Shift-hold ramps to 1 (page body focused), release springs back, auto-repeat ignored', () => {
    const p = mkPedal();
    document.body.dispatchEvent(kd('Shift'));
    document.body.dispatchEvent(kd('Shift', { repeat: true })); document.body.dispatchEvent(kd('Shift', { repeat: true }));
    assert.equal(controls.loopRunning(), true);
    for (let i = 0; i < 20; i++) _pedalLoop.tick(1 / 60);
    assert.equal(controls.get('throttle'), 1, 'ramped to full');
    document.body.dispatchEvent(ku('Shift'));
    _pedalLoop.tick(1 / 60); assert.ok(controls.get('throttle') < 1);
    settle(); assert.equal(controls.get('throttle'), 0);
  });

  await t("DOM pedal: Shift is ignored unless the pedal is focused or the module declared keys:'arrows' with the body focused", () => {
    const p = mkPedal({ keys: undefined });
    document.body.dispatchEvent(kd('Shift'));
    assert.equal(controls.get('throttle'), 0); assert.equal(controls.loopRunning(), false);
    p.pad.dispatchEvent(kd('Shift'));                                  /* focused pedal: always */
    for (let i = 0; i < 20; i++) _pedalLoop.tick(1 / 60);
    assert.equal(controls.get('throttle'), 1);
    p.pad.dispatchEvent(ku('Shift')); settle();
    const q = mkPedal();                                               /* typing in an input never triggers it */
    const inp = document.createElement('input'); document.body.appendChild(inp);
    inp.dispatchEvent(kd('Shift')); assert.equal(controls.loopRunning(), false);
    q.reset(); inp.remove();
  });

  await t('DOM pedal: prefers-reduced-motion releases instantly (no loop); Reset releases and clears Shift state', () => {
    const p = mkPedal({}, { reducedMotion: () => true });
    p.pad.dispatchEvent(ptr('pointerdown', 0)); assert.equal(controls.get('throttle'), 1);
    p.pad.dispatchEvent(ptr('pointerup', 0));
    assert.equal(controls.get('throttle'), 0, 'instant');
    assert.equal(controls.loopRunning(), false, 'no animation loop at all');
    const r = mkPedal();
    document.body.dispatchEvent(kd('Shift')); for (let i = 0; i < 20; i++) _pedalLoop.tick(1 / 60);
    controls.resetAll();
    assert.equal(controls.get('throttle'), 0); assert.equal(controls.loopRunning(), false);
    assert.equal(r.model.pressed, false);
    r.pad.dispatchEvent(ku('Shift'));
  });

  await t('DOM pedal: programmatic set() (bridge command) stays put; setDisabled blocks Shift and focus', () => {
    const p = mkPedal();
    controls.set('throttle', 0.4); _pedalLoop.tick(1); near(controls.get('throttle'), 0.4, 1e-9);
    p.setDisabled(true);
    assert.equal(controls.get('throttle'), 0, 'disabling releases it'); assert.equal(p.pad.tabIndex, -1);
    document.body.dispatchEvent(kd('Shift')); assert.equal(controls.get('throttle'), 0);
    p.setDisabled(false);
  });

  const mkMomentary = (extra = {}) => {
    clean();
    const m = createMomentary(Object.assign({ id: 'clutch', label: 'Clutch', keys: 'arrows' }, extra));
    document.body.appendChild(m.el);
    m.pad.setPointerCapture = () => {};
    return m;
  };

  await t('DOM momentary: role=button + aria-pressed; pointer hold; value 0/1; on() fires on both edges only', () => {
    const m = mkMomentary();
    const edges = []; controls.on('clutch', (v) => edges.push(v));
    assert.equal(m.pad.getAttribute('role'), 'button'); assert.equal(m.pad.getAttribute('aria-pressed'), 'false');
    m.pad.dispatchEvent(ptr('pointerdown', 5));
    assert.equal(m.pad.getAttribute('aria-pressed'), 'true'); assert.equal(controls.get('clutch'), 1);
    m.pad.dispatchEvent(ptr('pointerdown', 5, 2));                      /* second pointer: no extra edge */
    m.pad.dispatchEvent(ptr('pointerup', 5));
    assert.equal(controls.get('clutch'), 0); assert.equal(m.pad.getAttribute('aria-pressed'), 'false');
    assert.deepEqual(edges, [1, 0]);
  });

  await t('DOM momentary: Enter / Space on the focused element hold, Shift holds (body focus), repeat ignored, blur releases', () => {
    const m = mkMomentary();
    const edges = []; controls.on('clutch', (v) => edges.push(v));
    const sp = kd(' '); m.pad.dispatchEvent(sp);
    assert.equal(sp.defaultPrevented, true, 'Space on the focused momentary does not scroll or play/pause');
    m.pad.dispatchEvent(kd(' ', { repeat: true })); assert.equal(controls.get('clutch'), 1);
    m.pad.dispatchEvent(ku(' ')); assert.equal(controls.get('clutch'), 0);
    m.pad.dispatchEvent(kd('Enter')); assert.equal(controls.get('clutch'), 1); m.pad.dispatchEvent(ku('Enter')); assert.equal(controls.get('clutch'), 0);
    document.body.dispatchEvent(kd('Shift')); assert.equal(controls.get('clutch'), 1);
    document.body.dispatchEvent(kd('Shift', { repeat: true }));
    document.body.dispatchEvent(ku('Shift')); assert.equal(controls.get('clutch'), 0);
    m.pad.dispatchEvent(kd('Enter')); m.pad.dispatchEvent(new W.Event('blur')); assert.equal(controls.get('clutch'), 0);
    assert.deepEqual(edges, [1, 0, 1, 0, 1, 0, 1, 0]);
  });

  await t('DOM momentary: Reset (resetAll) clears the pressed state and releases Shift; no pedal ↑/↓ side effects', () => {
    const m = mkMomentary();
    document.body.dispatchEvent(kd('Shift')); assert.equal(controls.get('clutch'), 1);
    controls.resetAll(); assert.equal(controls.get('clutch'), 0);
    m.pad.dispatchEvent(kd('ArrowUp')); assert.equal(controls.get('clutch'), 0);
    document.body.dispatchEvent(ku('Shift'));
  });
}

console.log(`\n${n} test groups passed`);
