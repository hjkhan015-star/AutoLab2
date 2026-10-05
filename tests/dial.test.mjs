// node tests/dial.test.mjs — Phase 5: ONE rotary primitive (wheel / crank / knob).
// Pure maths + static module checks always run; the DOM group runs when jsdom is resolvable
// (NOT a project dependency: `npm i jsdom` in a scratch dir and set JSDOM_PATH; otherwise it prints "skip").
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import * as core from '../controls-core.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const pages = fs.readdirSync(root).filter((f) => f.endsWith('.html'));
let n = 0;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b}`);
const t = async (name, fn) => { await fn(); n++; console.log('ok  ', name); };

const WHEEL = { type: 'dial', range: 360 };                            /* steering: ±180° -> -1..1 */
const CRANK = { type: 'dial', range: 720, wrap: true };                /* crank: 0..720° -> 0..1, wraps */
const DIFF = { type: 'dial', range: 2 * (Math.PI * 0.72) * 180 / Math.PI };   /* differential: ±129.6° */

/* ── pure ─────────────────────────────────────────────────────────────── */
await t('mapping: steering ±180° <-> -1..1 (clamped), crank 0–720° <-> 0..1 (wraps)', () => {
  near(core.dialToDeg(1, WHEEL), 180, 1e-9); near(core.dialToDeg(-1, WHEEL), -180, 1e-9); near(core.dialToDeg(0.5, WHEEL), 90, 1e-9);
  near(core.degToDial(90, WHEEL), 0.5, 1e-12); near(core.degToDial(-180, WHEEL), -1, 1e-12);
  assert.equal(core.degToDial(250, WHEEL), 1, 'clamped, not wrapped'); assert.equal(core.degToDial(-999, WHEEL), -1);
  near(core.dialToDeg(0.5, CRANK), 360, 1e-9); near(core.dialToDeg(1, CRANK), 720, 1e-9);
  near(core.degToDial(360, CRANK), 0.5, 1e-12);
  assert.equal(core.degToDial(720, CRANK), 0, 'the 720° seam wraps to 0');
  near(core.degToDial(725, CRANK), 5 / 720, 1e-12); near(core.degToDial(-10, CRANK), 710 / 720, 1e-12);
  near(core.dialToDeg(core.degToDial(77, DIFF), DIFF), 77, 1e-9);
  near(core.dialToDeg(1, DIFF), 129.6, 1e-9);
  for (const d of [-180, -77.5, 0, 12, 180]) near(core.dialToDeg(core.degToDial(d, WHEEL), WHEEL), d, 1e-9);
  assert.equal(core.wrapDeg(-1, 720), 719); assert.equal(core.wrapDeg(1440, 720), 0); assert.ok(!Object.is(core.wrapDeg(-0, 720), -0));
});

await t('angleFromPointer: 0° = up, clockwise positive, (−180, 180]', () => {
  assert.equal(core.angleFromPointer(50, 50, 50, 0), 0);        /* up */
  assert.equal(core.angleFromPointer(50, 50, 100, 50), 90);     /* right */
  assert.equal(core.angleFromPointer(50, 50, 50, 100), 180);    /* down */
  assert.equal(core.angleFromPointer(50, 50, 0, 50), -90);      /* left */
  near(core.angleFromPointer(0, 0, 10, -10), 45, 1e-9);         /* up-right */
  near(core.angleFromPointer(0, 0, -10, 10), -135, 1e-9);       /* down-left */
  assert.equal(core.angleFromPointer(5, 5, 5, 5), 0, 'on the centre: no NaN');
});

await t('unwrapDelta: shortest way across ±180° (pointer) and across the 720° crank seam', () => {
  assert.equal(core.unwrapDelta(179, -179), 2);
  assert.equal(core.unwrapDelta(-179, 179), -2);
  assert.equal(core.unwrapDelta(10, 40), 30);
  assert.equal(core.unwrapDelta(40, 10), -30);
  assert.equal(core.unwrapDelta(0, 0), 0);
  assert.equal(core.unwrapDelta(718, 2, 720), 4);
  assert.equal(core.unwrapDelta(2, 718, 720), -4);
  assert.equal(core.unwrapDelta(NaN, 3), 0);
  /* drag the pointer round a circle in 1° steps: every delta is +1 across the ±180° seam */
  let prev = 0, sum = 0;
  for (let a = 1; a <= 720; a++) {
    const cur = core.angleFromPointer(0, 0, Math.sin(a * Math.PI / 180), -Math.cos(a * Math.PI / 180));
    const d = core.unwrapDelta(prev, cur); near(d, 1, 1e-6, `step ${a}`); sum += d; prev = cur;
  }
  near(sum, 720, 1e-6);
});

await t('dialAddDelta: wheel clamps at ±range/2, crank wraps (two turns of the pointer = back to 0°)', () => {
  assert.equal(core.dialAddDelta(0.99, 10, WHEEL), 1);
  assert.equal(core.dialAddDelta(-0.99, -10, WHEEL), -1);
  near(core.dialAddDelta(718 / 720, 5, CRANK), 3 / 720, 1e-12);
  near(core.dialAddDelta(2 / 720, -5, CRANK), 717 / 720, 1e-12);
  let v = 0;
  for (let i = 0; i < 720; i++) v = core.dialAddDelta(v, 1, CRANK);
  near(v, 0, 1e-9, 'crank back at 0 after 720° of drag');
  v = 0;
  for (let i = 0; i < 400; i++) v = core.dialAddDelta(v, 1, WHEEL);
  assert.equal(v, 1, 'wheel stays at full lock');
});

await t('key direction: → ALWAYS increases (clockwise), ← decreases, 10° per press, Enter / Home = default', () => {
  for (const spec of [WHEEL, CRANK, DIFF, { type: 'dial', range: 270 }, {}]) {
    const r = core.keyToIntent('dial', { key: 'ArrowRight' }, spec), l = core.keyToIntent('dial', { key: 'ArrowLeft' }, spec);
    assert.ok(r.delta > 0 && l.delta < 0 && r.delta === -l.delta, 'ArrowRight is clockwise');
    /* applying the intent moves the dial by exactly 10° */
    const half = (spec.range ?? 360) / (spec.wrap ? 1 : 2);
    near(r.delta * half, 10, 1e-9);
    near(core.dialToDeg(core.dialAddDelta(0, r.delta * half, spec), spec), 10, 1e-9);
  }
  assert.deepEqual(core.keyToIntent('dial', { key: 'Enter' }, WHEEL), { reset: true });
  assert.deepEqual(core.keyToIntent('dial', { key: 'Home' }, CRANK), { reset: true });
  assert.equal(core.keyToIntent('dial', { key: 'ArrowUp' }, WHEEL), null);
  assert.equal(core.keyToIntent('dial', { key: ' ' }, WHEEL), null, 'Space stays play / pause');
});

await t('controls.value for dials: degrees (clockwise +), step-snapped; fromReal / defaults / registry clamp', () => {
  assert.equal(core.realValue(0.5, WHEEL), 90); assert.equal(core.realValue(-0.25, WHEEL), -45); assert.equal(core.realValue(0, WHEEL), 0);
  assert.ok(!Object.is(core.realValue(-0.0001, WHEEL), -0), 'no -0');
  assert.equal(core.realValue(0.25, CRANK), 180); assert.equal(core.realValue(1, CRANK), 0, 'the seam reads 0°');
  assert.equal(core.realValue(0.5 + 0.001, { type: 'dial', range: 360, step: 5 }), 90, 'step snapping');
  assert.equal(core.rawValue(0.5, Object.assign({ scale: 2 }, WHEEL)), 180);
  near(core.fromReal(90, WHEEL), 0.5, 1e-12); near(core.fromReal(-45, WHEEL), -0.25, 1e-12);
  near(core.fromReal(360, CRANK), 0.5, 1e-12); assert.equal(core.fromReal(720, CRANK), 0);
  assert.equal(core.defaultNormalized(WHEEL), 0);
  near(core.defaultNormalized({ type: 'dial', range: 360, def: 90 }), 0.5, 1e-12);
  const r = core.createRegistry();
  r.register('wheel', Object.assign({}, WHEEL)); r.register('crank', Object.assign({}, CRANK));
  assert.equal(r.set('wheel', -5), -1); assert.equal(r.set('wheel', 5), 1);
  assert.equal(r.set('crank', -5), 0, 'a wrapping crank is 0..1'); assert.equal(r.set('crank', 5), 1);
  assert.equal(r.get('crank'), 1);
  assert.equal(r.register('d', { type: 'dial', range: 360, def: 90 }) && r.get('d'), 0.5, 'registry starts at the spec default');
});

await t('dialValueText: "centre", "12° right", "8° left"; crank reads plain degrees', () => {
  assert.equal(core.dialValueText(0, WHEEL), 'centre');
  assert.equal(core.dialValueText(12 / 180, WHEEL), '12° right');
  assert.equal(core.dialValueText(-8 / 180, WHEEL), '8° left');
  assert.equal(core.dialValueText(0.5, WHEEL), '90° right');
  assert.equal(core.dialValueText(0.2 / 180, WHEEL), 'centre', 'rounds to 0° -> centre');
  assert.equal(core.dialValueText(123 / 720, CRANK), '123°');
  assert.equal(core.dialValueText(0, CRANK), '0°');
});

await t('spring-to-centre equals the old per-frame easing at 60 Hz and is frame-rate independent', () => {
  /* steering: STEER_RETURN_RATE 4.5 per second applied as a = a·(1 − dt·4.5) each frame (dt = 1/60) */
  const kSteer = core.decayFactorToK(1 - 4.5 / 60), kDiff = core.decayFactorToK(1 - 4 / 60);
  near(kSteer, 4.68, 0.005); near(kDiff, 4.14, 0.005);              /* the constants the modules declare */
  let old = 0.8, nw = 0.8;
  for (let i = 0; i < 90; i++) {
    old += (0 - old) * Math.min(1, (1 / 60) * 4.5);
    nw = core.dialSpringStep(nw, 1 / 60, kSteer, WHEEL, 0);
    near(nw, old, 1e-12, `frame ${i}`);
  }
  /* the declared constant (4.68) stays within 0.5 % of the old curve over the first second */
  let a = 0.8, b = 0.8;
  for (let i = 0; i < 60; i++) { a += (0 - a) * (4.5 / 60); b = core.dialSpringStep(b, 1 / 60, 4.68, WHEEL, 0); }
  near(a, b, 0.005 * 0.8, 'k=4.68 vs old @1 s');
  /* frame-rate independence: 1 s at 30 / 60 / 144 Hz lands on the same angle */
  const run = (hz) => { let v = 0.9; for (let i = 0; i < hz; i++) v = core.dialSpringStep(v, 1 / hz, 4.68, WHEEL, 0); return v; };
  near(run(30), run(60), 1e-9); near(run(144), run(60), 1e-9);
  /* it settles exactly on the default and says so (the loop stops) */
  let v = 0.3, steps = 0;
  while (v !== 0 && steps < 1000) { v = core.dialSpringStep(v, 1 / 60, 4.68, WHEEL); steps++; }
  assert.equal(v, 0); assert.ok(steps < 300, `settled in ${steps} frames`);
  /* crank takes the shortest way round: from 700° it moves UP through the seam, not 700° down */
  assert.ok(core.dialSpringStep(700 / 720, 0.1, 4, Object.assign({ spring: 'return' }, CRANK)) > 700 / 720);
  assert.ok(core.dialSpringStep(20 / 720, 0.1, 4, CRANK) < 20 / 720);
  /* a spring toward a non-zero default */
  const off = { type: 'dial', range: 360, def: 90 };
  near(core.dialToDeg(core.dialSpringStep(1, 10, 4, off), off), 90, 0.06);
});

await t('awd mapping: S.steering = |dial| (0 / 50 / 100 % ↔ centre / 90° / 180° either way)', () => {
  const steering = (deg) => Math.abs(core.degToDial(deg, WHEEL));
  assert.equal(steering(0), 0); near(steering(90), 0.5, 1e-12); near(steering(-90), 0.5, 1e-12);
  assert.equal(steering(180), 1); assert.equal(steering(-180), 1);
  near(steering(126), 0.7, 1e-12);                                   /* the "70 %" example in the awd overview text */
});

/* ── static: the four migrated modules ────────────────────────────────── */
await t('acceptance grep: no steer-wheel / crank-wheel / steer-label / "Centre wheels" anywhere', () => {
  const files = fs.readdirSync(root).filter((f) => /\.(html|js|css)$/.test(f));
  for (const f of files) assert.ok(!/steer-wheel|crank-wheel|steer-label|Centre wheels/.test(rd(f)), `${f} still has an old steering / crank widget`);
});

await t('engine / steering / awd each declare ONE dial and read it through ui.controls', () => {
  assert.match(rd('engine.html'), /id: 'crank', type: 'dial', look: 'crank'[\s\S]*?range: 720, wrap: true/);
  assert.match(rd('steering.html'), /id: 'wheel', type: 'dial', look: 'wheel'[\s\S]*?range: 360[\s\S]*?spring: 'return'/);
  assert.match(rd('awd.html'), /id:'steer', type:'dial', look:'wheel'/);
  assert.match(rd('awd.html'), /S\.steering = Math\.abs\(n\)/, 'awd keeps S.steering = magnitude 0..1');
  assert.match(rd('steering.html'), /steerAngle = -ui\.controls\.get\('wheel'\) \* WHEEL_MAX_ANGLE/, 'steering: clockwise = right = steerAngle < 0');
  assert.match(rd('engine.html'), /ui\.controls\.on\('crank'/);
  for (const f of ['engine.html', 'steering.html', 'awd.html']) {
    const s = rd(f);
    assert.ok(!/setPointerCapture|pointerdown|'ArrowLeft'|'ArrowRight'/.test(s), `${f}: no hand-written rotary pointer / key handlers`);
    assert.ok(!/\.sw-(rim|spoke|hub|marker)|\.crank-(ring|spoke|hub|marker|handle)/.test(s), `${f}: old wheel / crank skin CSS is gone`);
  }
});

await t('engine: the crank angle is shown ONCE (the dial) — not in the badge, the panel row or the chip', () => {
  const s = rd('engine.html');
  assert.ok(!/engine-crank-deg|crank-deg|mech-crank-deg|mechCrankDeg|crankDegText|wireCrankWidget|__updateCrank/.test(s));
  assert.ok(!/id: 'crank', label: 'Crank'/.test(s), 'no chip row for the crank angle');
  assert.ok(!/chip\.set\('crank'/.test(s));
  assert.match(s, /crankDial\.set\(theta \/ TAU2\)/, 'the sim mirrors theta into the dial');
});

await t('steering: no centre button, no duplicate wheel markup, Reset goes through the dial; differential is a guided module with a plain Steering axis', () => {
  const st = rd('steering.html'), df = rd('differential.html');
  assert.ok(!/steer-center|steer-reset-btn/.test(st));
  assert.match(st, /case 'reset': ui\.controls\.resetAll\(\)/);
  assert.ok(!/steerDragging|steerWheelEl|steerRotorEl|clampSteer|STEER_RETURN_RATE/.test(df + st), 'old drag / spring state is gone');
  assert.ok(!/type: ?'dial'/.test(df) && /id: 'turn', label: 'Steering'/.test(df), 'differential steers with an axis, not a dial');
});

await t('controls.css dial: tokens only, 44 px minimum, ≤ 96 px on phones, focus ring', () => {
  const css = rd('controls.css');
  const block = css.slice(css.indexOf('PHASE 5 — dial'), css.indexOf('Phase 6 — choice'));   /* Phase 6 has its own block */
  assert.ok(block.length > 500, 'dial block present');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(block), 'no hex / rgba in the dial CSS');
  assert.match(block, /min-width: var\(--ctl-tap\)/); assert.match(block, /min-height: var\(--ctl-tap\)/);
  assert.match(block, /--ctl-dial-size: 96px/); assert.match(block, /\.ctl-dial-pad:focus-visible/);
  assert.match(block, /touch-action: none/);
  assert.ok(!/transition/.test(block), 'nothing animates in CSS (the shared loop does the spring)');
});

await t('controls.js: createDial uses the SHARED loop (still exactly one requestAnimationFrame call site)', () => {
  const js = rd('controls.js');
  assert.equal((js.match(/requestAnimationFrame\(/g) || []).length, 1);
  assert.ok(!/setInterval\(/.test(js));
  assert.match(js, /export function createDial/); assert.match(js, /loop\.add\(tick\)/);
  assert.match(js, /role="slider"/); assert.match(js, /prefers-reduced-motion|reduced\(\)/);
  assert.match(rd('kit.js'), /spec\.type === 'dial' \? createDial\(spec\)/, 'UI.create({axes}) hosts dials');
  const dials = Object.fromEntries(pages.map((f) => [f, (rd(f).match(/type: ?'dial'/g) || []).length]).filter(([, c]) => c));
  assert.deepEqual(dials, { 'awd.html': 1, 'engine.html': 1, 'steering.html': 1 }, 'exactly one dial per migrated module, none elsewhere');
});

/* ── DOM (optional) ───────────────────────────────────────────────────── */
let JSDOM = null;
try {
  const req = createRequire(process.env.JSDOM_PATH ? pathToFileURL(path.join(process.env.JSDOM_PATH, 'x.js')) : import.meta.url);
  JSDOM = req('jsdom').JSDOM;
} catch (_) { /* skipped below */ }

if (!JSDOM) {
  console.log('skip  dial DOM tests (jsdom not available; set JSDOM_PATH to a dir with jsdom installed)');
} else {
  const dom = new JSDOM('<!doctype html><body></body>');
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  const W = dom.window;
  const { controls, createDial, _pedalLoop } = await import('../controls.js');
  const { registry } = await import('../controls-core.js');
  const kd = (key, extra = {}) => new W.KeyboardEvent('keydown', Object.assign({ key, bubbles: true, cancelable: true }, extra));
  const ku = (key) => new W.KeyboardEvent('keyup', { key, bubbles: true, cancelable: true });
  const ptr = (type, x, y, id = 1) => { const e = new W.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }); Object.defineProperty(e, 'pointerId', { value: id }); return e; };
  const clean = () => { controls.instances().forEach((i) => i.destroy()); registry.reset(); };
  const mk = (extra = {}, opts = {}) => {
    clean();
    const d = createDial(Object.assign({ id: 'wheel', look: 'wheel', label: 'Steering', range: 360, spring: 'return', k: 4.68 }, extra), opts);
    document.body.appendChild(d.el);
    d.pad.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 });
    d.pad.setPointerCapture = () => {};
    return d;
  };
  /* pointer positions on a 100×100 dial centred at (50, 50): up / right / down / left */
  const UP = [50, 0], RIGHT = [100, 50], DOWN = [50, 100], LEFT = [0, 50];

  await t('DOM dial: ONE root node, role=slider, degree aria values, small angle text (no caption), 3 looks', () => {
    const d = mk();
    assert.equal(document.querySelectorAll('[data-ctl="wheel"]').length, 1);
    assert.equal(d.pad.getAttribute('role'), 'slider'); assert.equal(d.pad.tabIndex, 0);
    assert.equal(d.pad.getAttribute('aria-valuemin'), '-180'); assert.equal(d.pad.getAttribute('aria-valuemax'), '180');
    assert.equal(d.pad.getAttribute('aria-valuenow'), '0'); assert.equal(d.pad.getAttribute('aria-valuetext'), 'centre');
    assert.equal(d.pad.getAttribute('aria-label'), 'Steering');
    assert.equal(d.el.querySelector('.ctl-value').textContent, 'centre');
    assert.equal(d.el.querySelectorAll('svg').length, 1, 'one inline SVG per look');
    assert.equal(d.el.querySelectorAll('button, input, select').length, 0, 'no native controls inside the dial');
    for (const look of ['wheel', 'crank', 'knob']) { const k = mk({ id: 'k_' + look, look }); assert.ok(k.el.classList.contains('ctl-dial-' + look)); assert.ok(k.el.querySelector('.ctl-dial-rotor')); }
    const c = mk({ id: 'crank', look: 'crank', range: 720, wrap: true, spring: undefined });
    assert.equal(c.pad.getAttribute('aria-valuemin'), '0'); assert.equal(c.pad.getAttribute('aria-valuemax'), '720');
    assert.throws(() => createDial({ id: 'x', look: 'nope' }), /unknown dial look/);
  });

  await t('DOM dial: ←/→ turn 10° (→ clockwise = right), Enter / Home = default, Space ignored, valuetext + rotor follow', () => {
    const d = mk({ spring: undefined });
    const r = kd('ArrowRight'); d.pad.dispatchEvent(r);
    assert.equal(r.defaultPrevented, true); assert.equal(d.value(), 10);
    assert.equal(d.pad.getAttribute('aria-valuetext'), '10° right'); assert.equal(d.pad.getAttribute('aria-valuenow'), '10');
    assert.equal(d.el.querySelector('.ctl-dial-rotor').getAttribute('transform'), 'rotate(10.00)', 'rotor turns clockwise');
    d.pad.dispatchEvent(kd('ArrowLeft')); d.pad.dispatchEvent(kd('ArrowLeft')); assert.equal(d.value(), -10);
    assert.equal(d.pad.getAttribute('aria-valuetext'), '10° left');
    d.pad.dispatchEvent(kd('Enter')); assert.equal(d.value(), 0); assert.equal(d.pad.getAttribute('aria-valuetext'), 'centre');
    d.pad.dispatchEvent(kd('ArrowRight', { repeat: true })); d.pad.dispatchEvent(kd('Home')); assert.equal(d.value(), 0);
    const sp = kd(' '); d.pad.dispatchEvent(sp); assert.equal(sp.defaultPrevented, false, 'Space is left to play / pause');
    for (let i = 0; i < 30; i++) d.pad.dispatchEvent(kd('ArrowRight')); assert.equal(d.value(), 180, 'clamped at full lock');
  });

  await t('DOM dial: pointer drag follows the pointer angle (up → right = +90°), clamps, unwraps across ±180°', () => {
    const d = mk({ spring: undefined });
    d.pad.dispatchEvent(ptr('pointerdown', ...UP));
    assert.equal(d.dragging, true);
    d.pad.dispatchEvent(ptr('pointermove', 75, 7)); assert.ok(d.value() > 0, 'clockwise drag = positive');
    d.pad.dispatchEvent(ptr('pointermove', ...RIGHT)); near(d.value(), 90, 1.5);
    d.pad.dispatchEvent(ptr('pointermove', ...DOWN)); near(d.value(), 180, 1e-9);
    d.pad.dispatchEvent(ptr('pointermove', 25, 93)); assert.equal(d.value(), 180, 'beyond lock stays clamped (no jump across ±180°)');
    d.pad.dispatchEvent(ptr('pointerup', ...DOWN));
    assert.equal(d.dragging, false);
    /* a second pointer is ignored; moves with another id do nothing */
    d.set(0);
    d.pad.dispatchEvent(ptr('pointerdown', ...UP, 7)); d.pad.dispatchEvent(ptr('pointerdown', ...RIGHT, 8));
    d.pad.dispatchEvent(ptr('pointermove', ...LEFT, 8)); assert.equal(d.value(), 0);
    d.pad.dispatchEvent(ptr('pointermove', ...LEFT, 7)); near(d.value(), -90, 1.5, 'counter-clockwise = left = negative');
    d.pad.dispatchEvent(ptr('pointercancel', ...LEFT, 7));
  });

  await t('DOM crank: drags past the 720° seam and wraps; programmatic set() wraps too', () => {
    const c = mk({ id: 'crank', look: 'crank', range: 720, wrap: true, spring: undefined });
    c.set(718 / 720); assert.equal(c.value(), 718);
    c.pad.dispatchEvent(ptr('pointerdown', ...UP));
    /* pointer circles clockwise: +90° per quarter turn */
    c.pad.dispatchEvent(ptr('pointermove', ...RIGHT)); near(c.value(), 718 + 90 - 720, 1.5, 'wrapped through 720°');
    c.pad.dispatchEvent(ptr('pointerup', ...RIGHT));
    c.set(1.25); near(c.get(), 0.25, 1e-12); c.set(1); assert.equal(c.get(), 0); c.setValue(360); near(c.get(), 0.5, 1e-12);
    assert.equal(c.pad.getAttribute('aria-valuetext'), '360°');
  });

  await t('DOM dial: release springs to centre on the ONE shared loop; the loop stops at rest', () => {
    const d = mk(); const wasRunning = controls.loopRunning();
    d.pad.dispatchEvent(ptr('pointerdown', ...UP)); d.pad.dispatchEvent(ptr('pointermove', ...RIGHT));
    assert.ok(d.value() > 80); assert.equal(controls.loopRunning(), false, 'no loop while the pointer holds it');
    d.pad.dispatchEvent(ptr('pointerup', ...RIGHT));
    assert.equal(controls.loopRunning(), true);
    const v0 = d.get(); _pedalLoop.tick(1 / 60); assert.ok(d.get() < v0 && d.get() > 0);
    for (let i = 0; i < 400; i++) _pedalLoop.tick(1 / 60);
    assert.equal(d.get(), 0); assert.equal(controls.loopRunning(), false); assert.equal(d.pad.getAttribute('aria-valuetext'), 'centre');
    assert.equal(wasRunning, false);
  });

  await t('DOM dial: key presses spring back too (old steering behaviour); programmatic set() never springs and cancels a spring', () => {
    const d = mk();
    d.pad.dispatchEvent(kd('ArrowRight')); assert.equal(d.value(), 10); assert.equal(controls.loopRunning(), false, 'held key: no spring yet');
    d.pad.dispatchEvent(ku('ArrowRight')); assert.equal(controls.loopRunning(), true);
    for (let i = 0; i < 400; i++) _pedalLoop.tick(1 / 60); assert.equal(d.get(), 0);
    /* a simulation (differential Auto Drive) drives the dial */
    d.pad.dispatchEvent(kd('ArrowRight')); d.pad.dispatchEvent(ku('ArrowRight'));
    d.set(0.5); assert.equal(controls.loopRunning(), false, 'set() cancels the spring'); near(d.get(), 0.5, 1e-12);
    _pedalLoop.tick(1); near(d.get(), 0.5, 1e-12, 'and it stays where the module put it');
    controls.set('wheel', -0.25); near(controls.get('wheel'), -0.25, 1e-12); assert.equal(controls.value('wheel'), -45);
  });

  await t('DOM dial: prefers-reduced-motion = no spring animation (instant centre, no loop)', () => {
    const d = mk({}, { reducedMotion: () => true });
    d.pad.dispatchEvent(ptr('pointerdown', ...UP)); d.pad.dispatchEvent(ptr('pointermove', ...RIGHT)); assert.ok(d.value() > 80);
    d.pad.dispatchEvent(ptr('pointerup', ...RIGHT));
    assert.equal(d.get(), 0, 'instant'); assert.equal(controls.loopRunning(), false);
  });

  await t('DOM dial: onGrab fires once on grab and once on release (pointer + keys combine); controls.dragging()', () => {
    const calls = [];
    const d = mk({ spring: undefined, onGrab: (on) => calls.push(on) });
    d.pad.dispatchEvent(ptr('pointerdown', ...UP)); assert.equal(controls.dragging('wheel'), true);
    d.pad.dispatchEvent(kd('ArrowRight')); d.pad.dispatchEvent(kd('ArrowRight', { repeat: true }));
    d.pad.dispatchEvent(ptr('pointerup', ...UP)); assert.deepEqual(calls, [true], 'still held by the key');
    d.pad.dispatchEvent(ku('ArrowRight')); assert.deepEqual(calls, [true, false]); assert.equal(controls.dragging('wheel'), false);
    d.pad.dispatchEvent(kd('ArrowLeft')); d.pad.dispatchEvent(new W.Event('blur')); assert.deepEqual(calls, [true, false, true, false], 'blur releases');
    assert.equal(controls.dragging('nope'), false);
  });

  await t('DOM dial: resetAll() restores the default, ends a drag, stops the spring; setDisabled blocks input; duplicate id throws (R9)', () => {
    const d = mk({ def: 0 });
    d.pad.dispatchEvent(ptr('pointerdown', ...UP)); d.pad.dispatchEvent(ptr('pointermove', ...RIGHT));
    controls.resetAll(); assert.equal(d.get(), 0); assert.equal(d.dragging, false);
    d.pad.dispatchEvent(ptr('pointermove', ...DOWN)); assert.equal(d.get(), 0, 'a stale pointer id no longer moves it');
    d.setDisabled(true); assert.equal(d.pad.tabIndex, -1); d.pad.dispatchEvent(ptr('pointerdown', ...UP)); d.pad.dispatchEvent(ptr('pointermove', ...RIGHT));
    assert.equal(d.get(), 0); d.setDisabled(false);
    assert.throws(() => createDial({ id: 'wheel' }), /duplicate/);
    const e = mk({ id: 'rod', def: 90, spring: undefined }); near(e.get(), 0.5, 1e-12); e.set(-1); controls.resetAll(); near(e.get(), 0.5, 1e-12, 'default can be non-zero');
    const seen = []; e.on((v) => seen.push(v)); e.set(0.25); e.set(0.25); assert.equal(seen.length, 1, 'change-only events');
  });

  await t('DOM dial: setText overrides the readout; format() override; a module drives the dial each frame without echo loops', () => {
    const d = mk({ spring: undefined });
    d.setText('Auto'); assert.equal(d.el.querySelector('.ctl-value').textContent, 'Auto'); d.setText(null); assert.equal(d.el.querySelector('.ctl-value').textContent, 'centre');
    /* engine pattern: mirror theta into the dial, listen for user input, ignore the echo */
    clean();
    const TAU2 = Math.PI * 4; let theta = 1.234;
    const c = createDial({ id: 'crank', look: 'crank', range: 720, wrap: true }); document.body.appendChild(c.el);
    controls.on('crank', (v) => { const th = v * TAU2; if (Math.abs(th - theta) > 1e-6) theta = th; });
    for (let i = 0; i < 5; i++) { theta += 0.1; c.set(theta / TAU2); }
    near(theta, 1.734, 1e-9, 'the echo never rewrites theta');
    c.pad.dispatchEvent(kd('Home')); near(theta, 0, 1e-9, 'user input (Home) reaches the simulation');
  });
}

console.log(`\n${n} test groups passed`);
