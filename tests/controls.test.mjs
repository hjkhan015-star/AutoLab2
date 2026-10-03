// node tests/controls.test.mjs  (no dependencies)
import assert from 'node:assert/strict';
import * as core from '../controls-core.js';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  ', name); };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b}`);

t('registry: duplicate id throws', () => {
  core.reset();
  core.register('throttle');
  assert.throws(() => core.register('throttle'), /duplicate/);
  core.reset();
  core.register('throttle');            /* reset() allows re-use */
  const r = core.createRegistry();
  r.register('a');
  assert.throws(() => r.register('a'), /duplicate/);
  assert.throws(() => r.register(''), /non-empty/);
});

t('registry: get/set/on, clamping, change-only events', () => {
  const r = core.createRegistry();
  r.register('axis1', { type: 'axis' });
  r.register('wheel', { type: 'dial' });
  let calls = 0; r.on('axis1', () => calls++);
  assert.equal(r.set('axis1', 2), 1);
  assert.equal(r.set('axis1', 1), 1);
  assert.equal(calls, 1);
  assert.equal(r.set('axis1', -5), 0);
  assert.equal(r.set('wheel', -5), -1);          /* dial allows negatives */
  assert.equal(r.set('wheel', NaN), 0);
  assert.throws(() => r.set('nope', 0), /unknown/);
});

t('normalise round-trip', () => {
  for (const [min, max] of [[0, 100], [800, 5000], [-10, 45], [8, 15]]) {
    for (const v of [min, (min + max) / 2, max, min + (max - min) * 0.37]) {
      near(core.denormalize(core.normalize(v, min, max), min, max), v, 1e-9, `${min}..${max}`);
    }
  }
  assert.equal(core.normalize(999, 0, 100), 1);            /* clamps */
  assert.equal(core.normalize(-5, 0, 100), 0);
  assert.equal(core.normalize(5, 10, 10), 0);              /* degenerate */
  assert.equal(core.normalize(NaN, 0, 1), 0);
  near(core.denormalizeSigned(core.normalizeSigned(90, 180), 180), 90, 1e-9);
  assert.equal(core.normalizeSigned(500, 180), 1);
  assert.equal(core.normalizeSigned(-500, 180), -1);
});

t('format helpers', () => {
  assert.equal(core.format(13.5, { unit: 'V', decimals: 1 }), '13.5 V');
  assert.equal(core.format(72, { unit: '%' }), '72%');
  assert.equal(core.format(1800, { unit: 'rpm' }), '1800 rpm');
  assert.equal(core.format(-0.04, { unit: '°C', decimals: 1 }), '0.0 °C');   /* no -0 */
  assert.equal(core.format(NaN, { unit: 'V' }), '—');
  assert.equal(core.axisValueText(0.5, { preset: 'load' }), '50%');
  assert.equal(core.axisValueText(1, { preset: 'voltage' }), '15.0 V');
  assert.equal(core.dialValueText(0, {}), 'centre');
  assert.equal(core.dialValueText(0.5, { range: 360 }), '90° right');
  assert.equal(core.dialValueText(-0.25, { range: 360 }), '45° left');
});

t('spring: frame-rate independent (60 Hz vs 144 Hz, 0.5 s)', () => {
  for (const k of [2, 4, 8]) {
    for (const v0 of [1, 0.6, -0.8]) {
      const run = (hz) => { let v = v0; const dt = 1 / hz; for (let i = 0; i < hz / 2; i++) v = core.spring.step(v, dt, k); return v; };
      const a = run(60), b = run(144);
      /* within 1 % of the starting amplitude */
      assert.ok(Math.abs(a - b) <= 0.01 * Math.abs(v0), `k=${k} v0=${v0}: ${a} vs ${b}`);
      near(a, v0 * Math.exp(-k * 0.5), 1e-9 + 0.001, 'matches closed form');
    }
  }
});

t('spring: snaps to exactly 0 below epsilon, and is inert on bad input', () => {
  let v = 0.5;
  for (let i = 0; i < 600; i++) v = core.spring.step(v, 1 / 60, 6);
  assert.equal(v, 0);
  assert.equal(core.spring.step(0.5, 0, 6), 0.5);
  assert.equal(core.spring.step(0.5, 0.016, 0), 0.5);
  assert.equal(core.spring.toward(0.9, 0.5, 100, 6), 0.5);
});

t('key mapping: axis, dial, choice, momentary', () => {
  assert.deepEqual(core.keyToIntent('axis', { key: 'ArrowUp' }), { delta: 0.08 });
  assert.deepEqual(core.keyToIntent('axis', { key: 'ArrowDown' }), { delta: -0.08 });
  assert.equal(core.keyToIntent('axis', { key: 'ArrowLeft' }), null);
  assert.equal(core.keyToIntent('axis', { key: ' ' }), null);         /* Space is play/pause now */
  const d = core.keyToIntent('dial', { key: 'ArrowRight' }, { range: 360 });
  near(d.delta, 10 / 180, 1e-12);                                     /* 10° of a ±180° sweep */
  near(core.keyToIntent('dial', { key: 'ArrowLeft' }, { range: 720 }).delta, -10 / 360, 1e-12);
  assert.equal(core.keyToIntent('dial', { key: 'ArrowUp' }), null);
  assert.deepEqual(core.keyToIntent('choice', { key: 'ArrowRight' }), { step: 1 });
  assert.deepEqual(core.keyToIntent('choice', { key: 'ArrowLeft' }), { step: -1 });
  assert.deepEqual(core.keyToIntent('momentary', { key: 'Shift' }), { pressed: true });
  assert.deepEqual(core.keyUpToIntent('momentary', { key: 'Shift' }), { pressed: false });
  assert.equal(core.keyToIntent('momentary', { key: ' ' }), null);
  assert.equal(core.keyToIntent('bogus', { key: 'ArrowUp' }), null);
});

t('global keymap (R5)', () => {
  const want = { ' ': 'togglePlay', r: 'reset', d: 'labelDensity', l: 'theme', w: 'wireframe', x: 'xray', Escape: 'close' };
  for (const [k, a] of Object.entries(want)) assert.equal(core.globalKeyAction(k), a, k);
  assert.equal(core.globalKeyAction('R'), 'reset');
  assert.equal(core.globalKeyAction('q'), null);
  assert.equal(core.globalKeyAction('toString'), null);               /* no prototype leaks */
});

t('presets sane', () => {
  const { PRESETS } = core;
  assert.deepEqual(Object.keys(PRESETS).sort(), ['ambient', 'load', 'percent', 'rpm', 'vehicle-speed', 'voltage']);
  for (const [name, p] of Object.entries(PRESETS)) {
    assert.ok(p.min < p.max, `${name}: min<max`);
    assert.ok(p.def >= p.min && p.def <= p.max, `${name}: def in range`);
    assert.ok(p.step > 0 && p.step < (p.max - p.min), `${name}: step`);
    assert.ok(typeof p.unit === 'string' && p.unit, `${name}: unit`);
    assert.ok(p.scale > 0, `${name}: scale`);
  }
  assert.deepEqual([PRESETS.rpm.min, PRESETS.rpm.max, PRESETS.rpm.def], [800, 5000, 1800]);
  assert.deepEqual([PRESETS.load.min, PRESETS.load.max], [0, 100]);
  assert.deepEqual([PRESETS.ambient.min, PRESETS.ambient.max, PRESETS.ambient.def], [-10, 45, 20]);
  assert.deepEqual([PRESETS['vehicle-speed'].min, PRESETS['vehicle-speed'].max], [0, 160]);
  /* voltage is in VOLTS; scale 100 reproduces fuelpump's old centivolt slider (800..1500) */
  assert.equal(PRESETS.voltage.unit, 'V');
  assert.equal(PRESETS.voltage.min * PRESETS.voltage.scale, 800);
  assert.equal(PRESETS.voltage.max * PRESETS.voltage.scale, 1500);
  assert.equal(PRESETS.voltage.def * PRESETS.voltage.scale, 1350);
  assert.throws(() => { PRESETS.rpm.max = 1; core.getPreset('nope'); }, /unknown preset|read only|Cannot assign/);
  assert.equal(core.getPreset('rpm').max, 5000);                     /* frozen: unchanged */
});

t('resolveSpec / defaultNormalized', () => {
  const s = core.resolveSpec({ preset: 'rpm', label: 'Speed', max: 6000 });
  assert.equal(s.min, 800); assert.equal(s.max, 6000); assert.equal(s.label, 'Speed');
  near(core.defaultNormalized({ preset: 'rpm' }), (1800 - 800) / 4200, 1e-12);
  near(core.defaultNormalized({ preset: 'voltage' }), (13.5 - 8) / 7, 1e-12);
  assert.equal(core.defaultNormalized({}), 0);
  const r = core.createRegistry(); r.register('rpm', { preset: 'rpm' });
  near(r.get('rpm'), 1000 / 4200, 1e-12);
});

/* ── Phase 3: axis value mapping (slider look) ───────────────────────── */
t('axis: realValue / fromReal round-trip on every preset (step-snapped, no float creep)', () => {
  for (const name of Object.keys(core.PRESETS)) {
    const s = core.resolveSpec({ preset: name });
    for (const f of [0, 0.25, 0.5, 1]) {
      const v = core.realValue(f, s);
      assert.ok(v >= s.min && v <= s.max, `${name} ${v}`);
      near(core.realValue(core.fromReal(v, s), s), v, 1e-9, name);
    }
    assert.equal(core.realValue(0, s), s.min);
    assert.equal(core.realValue(1, s), s.max);
  }
});
t('axis: preset defaults land exactly (rpm 1800, ambient 20, voltage 13.5)', () => {
  assert.equal(core.realValue(core.defaultNormalized({ preset: 'rpm' }), core.resolveSpec({ preset: 'rpm' })), 1800);
  assert.equal(core.realValue(core.defaultNormalized({ preset: 'ambient' }), core.resolveSpec({ preset: 'ambient' })), 20);
  assert.equal(core.realValue(core.defaultNormalized({ preset: 'voltage' }), core.resolveSpec({ preset: 'voltage' })), 13.5);
});
t('axis: voltage uses real volts; scale gives the legacy centivolt value fuelpump used (13.5 V -> 1350)', () => {
  const v = { preset: 'voltage' };
  assert.equal(core.rawValue(core.fromReal(13.5, v), v), 1350);
  assert.equal(core.rawValue(0, v), 800);
  assert.equal(core.rawValue(1, v), 1500);
  assert.equal(core.realValue(core.fromReal(12.3, v), v), 12.3);
});
t('axis: overrides win over the preset (rpm max 5500, lambda 0.88..1.12 / 0.01, rod ratio 0.05 steps)', () => {
  const rpm = { preset: 'rpm', max: 5500, def: 2400 };
  assert.equal(core.realValue(1, rpm), 5500);
  assert.equal(core.realValue(core.defaultNormalized(rpm), rpm), 2400);
  const lam = { min: 0.88, max: 1.12, step: 0.01, def: 1, decimals: 2 };
  assert.equal(core.stepCount(lam), 24);
  assert.equal(core.realValue(core.fromReal(1, lam), lam), 1);
  assert.equal(core.realValue(core.fromReal(0.934, lam), lam), 0.93);
  const rr = { min: 1.4, max: 2.2, step: 0.05, def: 1.7, decimals: 2 };
  assert.equal(core.realValue(core.fromReal(1.7, rr), rr), 1.7);
});
t('axis: snapNormalized clamps and snaps; NaN -> 0; no -0', () => {
  const s = { min: 0, max: 10, step: 1 };
  assert.equal(core.snapNormalized(0.46, s), 0.5);
  assert.equal(core.snapNormalized(2, s), 1);
  assert.equal(core.snapNormalized(NaN, s), 0);
  assert.ok(Object.is(core.roundTo(-0.0001, 2), 0));
});
t('axis: format text carries the unit (aria-valuetext source)', () => {
  assert.equal(core.axisValueText(0.5, { preset: 'ambient', min: -10, max: 45 }), '18 °C'.replace('18', String(Math.round(-10 + 55 * 0.5))));
  assert.equal(core.axisValueText(core.fromReal(13.5, { preset: 'voltage' }), { preset: 'voltage' }), '13.5 V');
});

/* ── Phase 4: pedal logic (pure) ─────────────────────────────────────────── */
t('pedal: decayFactorToK turns the old per-frame factor into a time constant (0.86 -> 9.05, 0.88 -> 7.67)', () => {
  near(core.decayFactorToK(0.86), 9.05, 0.01, 'k(0.86)');
  near(core.decayFactorToK(0.88), 7.67, 0.01, 'k(0.88)');
  near(core.decayFactorToK(0.5, 30), -Math.log(0.5) * 30, 1e-12, 'custom hz');
  assert.throws(() => core.decayFactorToK(1), /decay factor/);
  assert.throws(() => core.decayFactorToK(0), /decay factor/);
});
t('pedal: springStepAxis over 1/60 s equals the old v*0.86 / v*0.88 frame step (within 1e-6 with the exact k)', () => {
  for (const f of [0.86, 0.88]) {
    const k = core.decayFactorToK(f);
    for (const v of [1, 0.62, 0.3]) near(core.springStepAxis(v, 1 / 60, k), v * f, 1e-6, `f=${f} v=${v}`);
  }
  /* the rounded constants used in the modules (9.05 / 7.67) are within 1e-5 of the exact frame step */
  near(core.springStepAxis(1, 1 / 60, 9.05), 0.86, 1e-5, 'k=9.05');
  near(core.springStepAxis(1, 1 / 60, 7.67), 0.88, 1e-5, 'k=7.67');
});
t('pedal: release is frame-rate independent (1 s at 30 Hz, 60 Hz and 144 Hz agree within 1e-3)', () => {
  const run = (hz) => { let v = 1; for (let i = 0; i < hz; i++) v = core.springStepAxis(v, 1 / hz, 9.05, 0); return v; };
  const a = run(30), b = run(60), c = run(144);
  near(a, b, 1e-3, '30 vs 60'); near(b, c, 1e-3, '60 vs 144');
  near(b, Math.exp(-9.05), 1e-3, 'closed form');
});
t('pedal: springStepAxis snaps to 0 below SPRING_EPS and never goes negative; no-op for bad dt/k', () => {
  assert.equal(core.springStepAxis(0.0009, 1 / 60, 9.05), 0);
  assert.equal(core.springStepAxis(0.5, 0, 9.05), 0.5);
  assert.equal(core.springStepAxis(0.5, 1 / 60, 0), 0.5);
  let v = 1; for (let i = 0; i < 600; i++) v = core.springStepAxis(v, 1 / 60, 7.67);
  assert.equal(v, 0);
});
t('pedal: Shift intents (press -> pressed, release -> not pressed, other keys ignored)', () => {
  assert.deepEqual(core.pedalIntent({ key: 'Shift' }), { pressed: true });
  assert.equal(core.pedalIntent({ key: ' ' }), null);
  assert.equal(core.pedalIntent({ key: 'ArrowUp' }), null);
  assert.deepEqual(core.pedalUpIntent({ key: 'Shift' }), { pressed: false });
  assert.equal(core.pedalUpIntent({ key: 'Enter' }), null);
});
t('pedal model: Shift-hold ramps to 1, release springs back, repeat events are ignored', () => {
  const m = core.createPedalModel({ k: 9.05, ramp: 4 });
  assert.equal(m.press(), true);
  assert.equal(m.press(), false, 'auto-repeat must not re-enter');
  assert.equal(m.press(), false);
  for (let i = 0; i < 6; i++) m.step(1 / 60);
  near(m.value, 6 * 4 / 60, 1e-9, 'ramp rate');
  for (let i = 0; i < 60; i++) m.step(1 / 60);
  assert.equal(m.value, 1, 'ramp clamps at 1');
  assert.equal(m.active(), false, 'at the top, nothing moves');
  assert.equal(m.release(), true);
  assert.equal(m.release(), false);
  const before = m.value;
  m.step(1 / 60);
  assert.ok(m.value < before, 'decays after release');
  for (let i = 0; i < 400; i++) m.step(1 / 60);
  assert.equal(m.value, 0);
  assert.equal(m.active(), false);
});
t('pedal model: pointer hold cancels the spring; letGo springs; reset clears Shift state', () => {
  const m = core.createPedalModel({ k: 7.67 });
  m.hold(0.6);
  m.step(1); assert.equal(m.value, 0.6, 'held pedal does not decay');
  m.letGo();
  m.step(1 / 60); near(m.value, 0.6 * Math.exp(-7.67 / 60), 1e-9);
  m.press(); m.hold(0.2);
  assert.equal(m.pressed, false, 'a pointer takes over from Shift');
  m.press(); m.reset();
  assert.equal(m.pressed, false); assert.equal(m.held, false); assert.equal(m.value, 0);
  assert.equal(m.hold(7), 1); assert.equal(m.hold(NaN), 0);
});
t('pedal model: springs to a non-zero rest value (default) and stops there', () => {
  const m = core.createPedalModel({ k: 9.05, value: 1, rest: 0.4 });
  for (let i = 0; i < 400; i++) m.step(1 / 60);
  near(m.value, 0.4, 0.001); /* within eps of the rest value */
});
t('momentary registry: stores 0/1, change-only events on both edges', () => {
  const r = core.createRegistry();
  r.register('clutch', { type: 'momentary', min: 0, max: 1, step: 1 });
  const edges = []; r.on('clutch', (v) => edges.push(v));
  assert.equal(r.get('clutch'), 0);
  r.set('clutch', 1); r.set('clutch', 1); r.set('clutch', 0);
  assert.deepEqual(edges, [1, 0]);
  assert.equal(r.set('clutch', 5), 1);
});
console.log(`\n${n} test groups passed`);
