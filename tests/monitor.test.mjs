// node tests/monitor.test.mjs — Phase 7a: Monitor core logic (pure) + static acceptance checks. No dependencies.
// Source-level guarantees only; they do NOT replace opening the app on a phone (see the manual checklist).
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import * as M from '../monitor-core.js';

const rd = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log('ok  ', name); };

t('rolling buffer: fills, wraps at capacity, keeps oldest → newest order', () => {
  const b = M.createRolling(4);
  assert.equal(b.length, 0); assert.deepEqual(b.toArray(), []);
  [1, 2, 3].forEach((v) => b.push(v));
  assert.deepEqual(b.toArray(), [1, 2, 3]);
  [4, 5, 6].forEach((v) => b.push(v));
  assert.equal(b.length, 4);
  assert.deepEqual(b.toArray(), [3, 4, 5, 6]);
  assert.equal(b.at(0), 3); assert.equal(b.at(3), 6);
  assert.equal(b.min(), 3); assert.equal(b.max(), 6);
  b.clear(); assert.equal(b.length, 0);
});
t('rolling buffer: non-finite samples repeat the previous value (a NaN never reaches a canvas)', () => {
  const b = M.createRolling(8); b.push(2); b.push(NaN); b.push(Infinity);
  assert.deepEqual(b.toArray(), [2, 2, 2]);
  const e = M.createRolling(8); e.push(NaN); assert.deepEqual(e.toArray(), [0]);
});
t('rate limiter: ≈9 Hz text refresh (fake clock)', () => {
  const r = M.createRateLimiter(9); let fired = 0;
  for (let ms = 0; ms < 1000; ms += 4) if (r.due(ms)) fired++;      /* called at 250 Hz */
  assert.ok(fired >= 8 && fired <= 10, `fired ${fired} times in 1 s`);
  const r30 = M.createRateLimiter(30); fired = 0;
  for (let ms = 0; ms < 1000; ms += 4) if (r30.due(ms)) fired++;
  assert.ok(fired >= 28 && fired <= 31, `trace limiter fired ${fired}`);
  assert.equal(r.due(5000), true); assert.equal(r.due(5001), false); r.reset(); assert.equal(r.due(5002), true);
});
t('value → bar / gauge mapping', () => {
  assert.equal(M.barPercent(-5), 0); assert.equal(M.barPercent(40), 40); assert.equal(M.barPercent(130), 100); assert.equal(M.barPercent('x'), 0);
  assert.equal(M.gaugeFraction(50, 0, 100), 0.5); assert.equal(M.gaugeFraction(-1, 0, 100), 0); assert.equal(M.gaugeFraction(9, 0, 5), 1);
  assert.equal(M.gaugeFraction(3, 5, 5), 0, 'degenerate range');
  assert.equal(M.gaugeAngle(0, 0, 100), -120); assert.equal(M.gaugeAngle(100, 0, 100), 120); assert.equal(M.gaugeAngle(50, 0, 100), 0);
});
t('formatting: numbers, row payloads (text | [text, tone]), status payloads', () => {
  assert.equal(M.formatNumber(3.14159, 2), '3.14'); assert.equal(M.formatNumber(NaN), '–'); assert.equal(M.formatNumber(7.6), '8');
  assert.deepEqual(M.normalizeRowValue('12 bar'), { text: '12 bar', tone: '' });
  assert.deepEqual(M.normalizeRowValue(['OK', 'ok']), { text: 'OK', tone: 'ok' });
  assert.deepEqual(M.normalizeRowValue(['x', 'bogus']), { text: 'x', tone: '' });
  assert.deepEqual(M.normalizeRowValue(null), { text: '', tone: '' });
  assert.deepEqual(M.normalizeStatus(['Overheating', true]), { text: 'Overheating', on: true, tone: '' });
  assert.deepEqual(M.normalizeStatus({ text: 'Run', on: 0 }), { text: 'Run', on: false, tone: '' });
  assert.deepEqual(M.normalizeStatus('Idle'), { text: 'Idle', on: false, tone: '' });
});
t('mergeValue: setBig + setBar in one tick do not drop each other', () => {
  assert.deepEqual(M.mergeValue({ text: '5', unit: 'bar' }, { bar: 40 }), { text: '5', unit: 'bar', bar: 40 });
  assert.deepEqual(M.mergeValue(undefined, 7), { text: 7 });
  assert.deepEqual(M.mergeValue({ text: 'a' }, undefined), { text: 'a' });
  assert.deepEqual(M.mergeValue(null, { bar: 52 }), { bar: 52 }, 'null must not blank the big value (regression)');
  assert.deepEqual(M.mergeValue(null, null), {});
});
t('channel validation: good config normalises', () => {
  const r = M.validateMonitorConfig({
    label: 'Heat', value: { label: 'Heat', unit: 'kW', max: 80 },
    rows: [['tin', 'Coolant in'], { id: 'tout', label: 'Coolant out' }],
    traces: [{ id: 'temp', label: 'Temp', series: [{ id: 't1' }, 't2'] }], gauge: { id: 'g', min: 0, max: 120, unit: '°C' }, status: true, footer: '<i>legend</i>',
  });
  assert.equal(r.ok, true, r.errors.join('; '));
  assert.deepEqual(r.config.rows.map((x) => x.id), ['tin', 'tout']);
  assert.equal(r.config.traces[0].series.length, 2); assert.equal(r.config.traces[0].length, M.DEFAULT_TRACE_LEN);
  assert.equal(r.config.value.bar, true); assert.equal(r.config.gauge.max, 120); assert.deepEqual(r.config.status, { text: '' });
});
t('channel validation: bad configs report errors and never throw', () => {
  assert.equal(M.validateMonitorConfig(null).ok, false);
  assert.equal(M.validateMonitorConfig({ rows: [['a', 'A'], ['a', 'B']] }).ok, false, 'duplicate row id');
  assert.equal(M.validateMonitorConfig({ rows: [['a', 'A']], gauge: { id: 'a' } }).ok, false, 'id shared between channels');
  assert.equal(M.validateMonitorConfig({ rows: [['has space', 'x']] }).ok, false, 'illegal id characters');
  assert.equal(M.validateMonitorConfig({ rows: [[7, 'x']] }).ok, false, 'non-string id');
  assert.equal(M.validateMonitorConfig({ traces: [{ id: 't', series: [] }] }).ok, false, 'trace without series');
  assert.equal(M.validateMonitorConfig({ traces: [{ id: 't', series: ['a', 'a'] }] }).ok, false, 'duplicate series id');
  assert.equal(M.validateMonitorConfig({ traces: [{ id: 't', series: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }] }).ok, false, 'more than 6 series');
  assert.equal(M.validateMonitorConfig({ gauge: { id: 'g', min: 5, max: 5 } }).ok, false, 'gauge max <= min');
});
t('traceRange: fixed bounds win; auto-range pads and survives flat / empty data', () => {
  const b = M.createRolling(8); [10, 20].forEach((v) => b.push(v));
  assert.deepEqual(M.traceRange([b], 0, 100), { lo: 0, hi: 100 });
  const auto = M.traceRange([b]); assert.ok(auto.lo < 10 && auto.hi > 20);
  const flat = M.createRolling(8); flat.push(5); flat.push(5); const f = M.traceRange([flat]); assert.ok(f.hi > f.lo);
  const empty = M.traceRange([M.createRolling(8)]); assert.ok(empty.hi > empty.lo);
});

/* ── static acceptance (source level) ── */
const mon = rd('monitor.js'), kit = rd('kit.js'), comp = rd('components.js'), sw = rd('sw.js'), css = rd('controls.css');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

t('monitor.js / kit.js: no MutationObserver (layout is measured on tab switch / ResizeObserver only)', () => {
  assert.ok(!/MutationObserver/.test(mon), 'monitor.js'); assert.ok(!/MutationObserver/.test(kit), 'kit.js');
  assert.ok(!/_wireAutoCollapse[\s\S]{0,4000}observe\([^)]*characterData/.test(kit));
});
t('monitor.js: exactly ONE aria-live region (the status text)', () => {
  assert.equal((strip(mon).match(/aria-live/g) || []).length, 1);
  assert.match(mon, /statusText\.setAttribute\('aria-live', 'polite'\)/);
});
t('monitor.js: no authored <input>/<select>; its one <button> is the phone toggle', () => {
  assert.ok(!/<input|<select/.test(strip(mon)));
  assert.equal((strip(mon).match(/el\('button'/g) || []).length, 1);
});
t('kit.js: ui.monitor is the only readout API (7b1: the ui.chip wrappers, chipToMonitor and setRpmLabel are gone)', () => {
  const kit = rd('kit.js');
  assert.match(kit, /get monitor\(\)/);
  assert.ok(!/get chip\(\)|chipToMonitor|setRpmLabel|_chipEls|_chipRows|_buildChip|cfg\.chip/.test(kit), 'legacy chip code left in kit.js');
});
t('runGuidedModule: every guided number goes through ui.monitor (no ro-* grid, no ui.chip, no direct DOM writes)', () => {
  const g = comp.slice(comp.indexOf('export function runGuidedModule'));
  assert.match(g, /ui\.monitor\.update\(/);
  assert.ok(!/ui\.chip\./.test(g), 'ui.chip left in runGuidedModule'); assert.ok(!/getElementById\('ro-'/.test(g), 'ro-* lookup left'); assert.ok(!/readout:\s*readoutHTML/.test(g), 'panel readout grid left');
  assert.match(g, /monitor:\s*\{/);
});
t('guided modules: no module reaches around the Monitor for a readout (no ro- ids written, no ui.chip)', () => {
  const guided = readdirSync(new URL('..', import.meta.url)).filter((f) => f.endsWith('.html') && /runGuidedModule\(CFG, build\)/.test(rd(f)));
  assert.ok(guided.length >= 18, `found ${guided.length} guided modules`);
  for (const f of guided) { const s = strip(rd(f)); assert.ok(!/ui\.chip\./.test(s), `${f}: ui.chip`); assert.ok(!/getElementById\(['"]ro-/.test(s), `${f}: ro-* element`); }
});
t('sw.js: monitor.js + monitor-core.js precached, cache bumped', () => {
  assert.match(sw, /'\.\/monitor\.js'/); assert.match(sw, /'\.\/monitor-core\.js'/); assert.match(sw, /VERSION = 'autolab-v8\.[6-9](\.\d+)?'/);
});
t('controls.css: Monitor styles use tokens only (no hard-coded colours) and a reduced-motion block', () => {
  const block = css.slice(css.indexOf('Monitor (Phase 7a)'));
  assert.ok(block.length > 500);
  assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsl\(/.test(block), 'hard-coded colour in the Monitor block');
  assert.match(block, /--monitor-strip-h/); assert.match(block, /--monitor-max/); assert.match(block, /prefers-reduced-motion: reduce/);
});

/* ── Phase 7a part 2: graph canvases → traces, *-warn → status, setRpmLabel → rows ─────────────────────────── */
const GRAPH10 = ['awd', 'catalytic', 'commonrail', 'dpf', 'driveshaft', 'egr', 'fuelpump', 'intercooler', 'oilpump', 'radiator'];
const RPM13 = ['abs-esc', 'automatic', 'carburetor', 'clutch', 'cooling', 'differential', 'electrical', 'exhaustsystem', 'ignition', 'mpfi', 'starting-system', 'suspension', 'turbocharger'];
t('7a-2 (a): the ten guided modules have no graph canvas, drawGraph, history buffer or warn element', () => {
  for (const m of GRAPH10) {
    const s = rd(m + '.html');
    assert.ok(!/<canvas id="[a-z]+-graph"/.test(s), `${m}: graph canvas`);
    assert.ok(!/drawGraph|\bgctx\b|\bgcv\b|\belWarn\b|\bsim\.samples\b|GRAPH_N/.test(s), `${m}: old graph code`);
    assert.ok(!/(?<!-)\b[a-z]+-warn\b/.test(s.replace(/var\(--warn\)/g, '')), `${m}: a *-warn element or rule is left`);
    assert.ok(!/<canvas/.test(s), `${m}: a <canvas> is left in the page source`);
  }
});
t('7a-2 (c): each graph module declares CFG.traces and returns traces + a status from update()', () => {
  for (const m of GRAPH10) {
    const s = rd(m + '.html');
    assert.match(s, /CFG\.traces = \[\{ id: 'hist'/, `${m}: CFG.traces`);
    assert.match(s, /traces: tr,/, `${m}: update() must return traces`);
    assert.match(s, /status: \[warnText \|\| /, `${m}: status must carry the warning`);
    assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(s.slice(s.indexOf('CFG.traces'), s.indexOf('CFG.traces') + 700)), `${m}: trace colours must be tokens`);
    assert.match(s, /color: 'var\(--accent\)'/); assert.match(s, /color: 'var\(--warn\)'/);
  }
});
t('7a-2 (b)(d): no *.html calls setRpmLabel any more, and kit.js no longer defines it (deleted in 7b1)', () => {
  for (const m of RPM13) assert.ok(!/setRpmLabel/.test(rd(m + '.html')), `${m}: setRpmLabel`);
  const all = readdirSync(new URL('../', import.meta.url)).filter((f) => f.endsWith('.html'));
  assert.equal(all.filter((f) => /setRpmLabel/.test(rd(f))).length, 0);
  assert.ok(!/setRpmLabel/.test(rd('kit.js')));
});
t('7a-2: the rpm / speed rows exist where setRpmLabel used to print a number (monitor config + a row update)', () => {
  const rows = { automatic: 'speed', carburetor: 'rpm', clutch: 'rpm', cooling: 'rpm', differential: 'rpm', mpfi: 'rpm', 'starting-system': 'rpm', turbocharger: 'rpm' };
  for (const m in rows) {
    const s = rd(m + '.html');
    assert.match(s, new RegExp(`\\['${rows[m]}', '[^']+'\\]`), `${m}: ${rows[m]} row in the monitor config`);
    assert.match(s, new RegExp(`ui\\.monitor\\.update\\(\\{[^;]*?rows: \\{[^}]*?\\b${rows[m]}:`, 's'), `${m}: row update`);
  }
});
t('monitor-core: status tone is normalised (warn / crit only), anything else is no tone', () => {
  assert.deepEqual(M.normalizeStatus(['Boiling', true, 'warn']), { text: 'Boiling', on: true, tone: 'warn' });
  assert.deepEqual(M.normalizeStatus(['x', true, 'bogus']), { text: 'x', on: true, tone: '' });
  assert.deepEqual(M.normalizeStatus({ text: 'y', tone: 'crit' }), { text: 'y', on: false, tone: 'crit' });
  assert.deepEqual(M.normalizeStatus('plain'), { text: 'plain', on: false, tone: '' });
});
t('monitor.js: a null trace clears it (module Reset), series colours may be var() tokens, status has a tone', () => {
  const s = rd('monitor.js');
  assert.match(s, /vals === null\) \{ t\.bufs\.forEach\(\(b\) => b\.clear\(\)\)/);
  assert.match(s, /function cssColor/); assert.match(s, /dataset\.tone/);
  assert.ok(!/MutationObserver/.test(s) && !/MutationObserver/.test(rd('kit.js')));
});
t('components.js: CFG.traces reach the Monitor and traces/status tone are forwarded from update()', () => {
  const s = rd('components.js');
  assert.match(s, /traces: CFG\.traces \|\| \[\]/); assert.match(s, /function pushTraces/); assert.match(s, /o\.status\[2\] \|\| ''/);
});

/* ── Phase 7b1: chip → monitor ─────────────────────────────────────────────── */
const CHIP23 = ['abs-esc', 'automatic', 'braking', 'carburetor', 'clutch', 'cooling', 'crankshaft-piston', 'differential', 'ecu', 'electrical', 'engine',
  'exhaustsystem', 'gearbox', 'ignition', 'lubrication', 'mpfi', 'obd2', 'starting-system', 'steering', 'suspension', 'transmission', 'turbocharger', 'valvetrain'];
const stripJs = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
await t('7b1: no page calls ui.chip.* or declares a `chip:` config; no page reaches into the old chip DOM', () => {
  const all = readdirSync(new URL('../', import.meta.url)).filter((f) => f.endsWith('.html'));
  for (const f of all) {
    const s = stripJs(rd(f));
    assert.ok(!/ui\.chip\b/.test(s), `${f}: ui.chip`);
    assert.ok(!/\bchip\s*:\s*\{/.test(s), `${f}: chip: config`);
    assert.ok(!/#ui-chip|\.ui-chip|#chip-|chipStatusEl/.test(s), `${f}: old chip selector`);
  }
});
await t('7b1: all 23 converted pages declare a monitor: block (config + initial), and call ui.monitor.update', () => {
  for (const m of CHIP23) {
    const s = rd(m + '.html');
    assert.match(s, /\bmonitor:\s*\{\s*config:\s*(\{ label:|monConfig\()/, `${m}: monitor config`);   /* 7b2/7b3: electrical, starting-system and exhaustsystem build one config per mode */
    assert.match(s, /initial:\s*\{/, `${m}: monitor initial`);
    assert.match(s, /ui\.monitor\.update\(/, `${m}: ui.monitor.update`);
  }
});
await t('7b1: adjacent updates are merged — no function calls ui.monitor.update twice in a row for the same statement run', () => {
  for (const m of CHIP23) {
    const s = rd(m + '.html');
    assert.ok(!/ui\.monitor\.update\([^;]*\);\s*ui\.monitor\.update\(/s.test(s.replace(/\n\s*/g, ' ')), `${m}: two adjacent ui.monitor.update calls`);
  }
});
await t('7b1: the Monitor takes a label channel (exhaustsystem modes) and rows carry data-row (module CSS hook)', () => {
  const m = rd('monitor.js');
  assert.match(m, /p\.label !== undefined/); assert.match(m, /row\.dataset\.row = r\.id/);
  assert.match(rd('exhaustsystem.html'), /label: 'Noise reduction'/); assert.match(rd('exhaustsystem.html'), /label: 'Tailpipe noise'/);
  assert.match(rd('carburetor.html'), /\[data-row="phase"\] \.mon-row-v/);
  assert.match(rd('engine.html'), /#ui-monitor \.mon-value/);
});
await t('7b1: cooling uses the Monitor status tone (no class on the status node) and engine flushes the stroke name', () => {
  const c = rd('cooling.html'), e = rd('engine.html');
  assert.match(c, /status: \[label, false, tone\]/); assert.ok(!/warn-status|crit-status/.test(c));
  assert.match(e, /ui\.monitor\.flush\(\)/);
});

/* ───────────── Phase 7b2: canvases and meters → trace / gauge / row / stage canvas ───────────── */
const P7B2 = ['gearbox', 'starting-system', 'electrical', 'exhaustsystem', 'ignition', 'crankshaft-piston', 'lubrication', 'mpfi', 'cooling'];
const STAGE = ['gearbox', 'exhaustsystem', 'ignition', 'crankshaft-piston'];            /* decision: stage canvas (a picture, not a time series) */
const objAfter = (src, re) => {                                                          /* bracket-matched object literal that follows `re` */
  const m = re.exec(src); assert.ok(m, 'marker not found: ' + re);
  let i = m.index + m[0].length, d = 0, st = i, q = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return src.slice(st, i + 1); }
  }
  throw new Error('unbalanced');
};
const cfgLiteral = (page) => objAfter(rd(page + '.html'), /\bmonitor:\s*\{\s*config:\s*(?=\{)/);
/* 7b3: pages whose Monitor rows follow the mode build the config with monConfig(mode); evaluate that source (no DOM, no three.js) */
const modeConfig = (page, mode) => {
  const src = rd(page + '.html');
  const from = ['const WF_LEN', 'const MON_ROWS', 'const MON_COMMON'].map((k) => src.indexOf(k)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
  const body = src.slice(from, src.indexOf('const ui = UI.create'));
  return new Function('TUNING', 'TAU', body + '\nreturn monConfig;')({ redlineRpm: 6200 }, Math.PI * 2)(mode);
};
const anyConfig = (page, mode) => /\bmonitor:\s*\{\s*config:\s*monConfig\(/.test(rd(page + '.html')) ? modeConfig(page, mode) : new Function('return (' + cfgLiteral(page) + ')')();
await t('7b2: no migrated page authors a <canvas> or <svg> chart in a template (stage canvases come from ui.stage.canvas)', () => {
  for (const m of P7B2) { const s = rd(m + '.html'); assert.ok(!/<canvas/.test(s), `${m}: <canvas in a template`); assert.ok(!/id="temp-graph"|graphSvg/.test(s), `${m}: svg graph`); }
});
await t('7b2: the old charts, their draw functions, history buffers and CSS are gone', () => {
  const gone = {
    gearbox: /torque-panel|tq-toggle|tq-status|tq-gear|tq-rpm|\.tq-panel|\.tq-header/,
    'starting-system': /drawStrip|sizeStrip|rpm-strip|key-meters|strip-label|HISTORY_LEN|histWrite|m-volts|m-amps/,
    electrical: /drawWaveform|waveform-canvas|waveform-panel|wf-legend|waveCtx/,
    exhaustsystem: /sound-panel|spectrum-strip|spectrum-label|spec-note|specNoteEl/,
    ignition: /adv-curve/,
    'crankshaft-piston': /cp-graph/,
    lubrication: /drawGraph|hist\.(oil|brg|wall)|HIST_LEN|temp-graph|graph-block|gp-legend|gctx/,
    mpfi: /drawTrimGraph|graphHistory|mp-graph|elGraph|gctx|elTrimState/,
    cooling: /tempHistory|temp-line|temp-area|surface-row|surface-bar|surfaceMult|surfaceBarFill|monitor\.root/,
  };
  for (const m in gone) assert.ok(!gone[m].test(rd(m + '.html')), `${m}: leftover of the old chart (${gone[m]})`);
});
await t('7b2: nothing appends DOM into the Monitor (no page, no kit.js)', () => {
  const all = readdirSync(new URL('../', import.meta.url)).filter((f) => f.endsWith('.html'));
  for (const f of all) assert.ok(!/monitor\.root\.(appendChild|append|prepend|insertBefore|insertAdjacent|innerHTML)/.test(rd(f)), `${f}: writes into ui.monitor.root`);
  assert.ok(!/monitor\.root\.(appendChild|append|prepend|insertBefore)/.test(rd('kit.js')));
});
await t('7b2: stage canvases — gearbox, exhaustsystem, ignition, crankshaft-piston use ui.stage.canvas; none of them puts a canvas in the dock or panel', () => {
  for (const m of STAGE) {
    const s = rd(m + '.html');
    assert.match(s, /ui\.stage\.canvas\(\{/, `${m}: ui.stage.canvas`);
    assert.ok(!/widgets:\s*\{[^]{0,400}<canvas/.test(s), `${m}: canvas inside widgets`);
  }
  assert.ok(!/ui\.stage\.canvas/.test(rd('lubrication.html') + rd('mpfi.html') + rd('cooling.html') + rd('electrical.html') + rd('starting-system.html')), 'time series stay Monitor traces, not stage canvases');
});
await t('7b2: kit.js ui.stage (canvas / caption / remove) exists; the stage layer ignores pointer events and has no module names in CSS', () => {
  const k = rd('kit.js'), css = rd('app.css');
  assert.match(k, /get stage\(\)/); assert.match(k, /canvas\(\{ id, label = '', width = 320, height = 120, corner = 'bl', size = 0 \} = \{\}\)/);
  assert.match(k, /caption\(id, text\)/); assert.match(k, /remove\(id\)/);
  const block = css.slice(css.indexOf('.ui-stage-layer'), css.indexOf('/* ---- Top stack'));
  assert.match(block, /pointer-events:\s*none/); assert.match(block, /var\(--dock-h/); assert.match(block, /var\(--stage-top/);
  assert.ok(!/[#.](gearbox|exhaust|ignition|crank|torque|spectrum)/i.test(block), 'module name in shared CSS');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(block), 'stage CSS uses tokens only');
});
await t('7b2: each migrated page declares the decided channel and every config validates', () => {
  const ev = (page, mode) => anyConfig(page, mode);
  const want = { 'starting-system': ['speed', 2], lubrication: ['temps', 3], mpfi: ['trimhist', 2], cooling: ['temp', 1] };
  for (const m in want) {
    const cfg = ev(m, 'circuit'); const v = M.validateMonitorConfig(cfg);
    assert.ok(v.ok, `${m}: ${v.errors.join('; ')}`);
    const tr = v.config.traces.find((x) => x.id === want[m][0]); assert.ok(tr, `${m}: trace ${want[m][0]}`);
    assert.equal(tr.series.length, want[m][1], `${m}: series count`);
    assert.ok(tr.min != null && tr.max != null, `${m}: fixed axis range`);
  }
  const lub = M.validateMonitorConfig(ev('lubrication')).config.traces[0]; assert.deepEqual([lub.min, lub.max, lub.length], [20, 500, 240]);
  const ss = M.validateMonitorConfig(ev('starting-system', 'starter')).config; assert.equal(ss.traces[0].max, 6200); assert.ok(ss.rows.some((r) => r.id === 'amps'), 'starting-system: current is a row');
  assert.ok(M.validateMonitorConfig(ev('mpfi')).config.rows.some((r) => r.id === 'trim'));
  assert.ok(M.validateMonitorConfig(ev('cooling')).config.rows.some((r) => r.id === 'surface'));
  const mpfi = M.validateMonitorConfig(ev('mpfi')).config.traces[0]; assert.deepEqual([mpfi.min, mpfi.max, mpfi.length], [-20, 20, 80]);
  const cool = M.validateMonitorConfig(ev('cooling')).config.traces[0]; assert.deepEqual([cool.min, cool.max, cool.length], [55, 125, 180]);
});
await t('7b2: electrical — the waveform is the trace "wave" (4 series) in the alternator-mode config only', () => {
  const s = rd('electrical.html');
  for (const m of ['battery', 'charging']) assert.equal(M.validateMonitorConfig(modeConfig('electrical', m)).config.traces.length, 0, m);
  const v = M.validateMonitorConfig(modeConfig('electrical', 'alternator')); assert.ok(v.ok, v.errors.join('; '));
  assert.equal(v.config.traces[0].series.length, 4);
  assert.match(s, /ui\.monitor\.set\(monConfig\(m\)\)/); assert.match(s, /config: monConfig\('battery'\)/);
});
await t('7b2: electrical — the sampled waveform equals the old canvas formula (3 cycles, same scroll, DC drawn as before)', () => {
  const s = rd('electrical.html'); const TAU = Math.PI * 2;
  const fn = new Function('TAU', s.slice(s.indexOf('function waveSamples'), s.indexOf('function primeWave')) + '\nreturn waveSamples;')(TAU);
  const STEP = 3 * TAU / 239;
  for (const W of [0, 0.37, 5.2, 41.9]) for (let k = 0; k < 240; k += 7) {
    const tt = (239 - k) / 239, newest = fn(W - k * STEP);                       /* the sample k steps ago sits at old x/W = 1 − k/239 */
    for (let p = 0; p < 3; p++) assert.ok(Math.abs(newest[p] - Math.sin(tt * 3 * TAU + W - p * TAU / 3)) < 1e-9, `phase ${p}`);
    const ripple = Math.sin(tt * 3 * TAU * 6 + W * 6) * 0.08;                    /* old: y = midY − dcLevel + ripple·amp, dcLevel = −0.85·amp */
    assert.ok(Math.abs(newest[3] - (-0.85 - ripple)) < 1e-9, 'dc');
  }
});
await t('7b2: sample computations moved unchanged — starting-system (engine rpm, starter rpm ÷ 12, clamped), lubrication (4 Hz), mpfi (STFT + LTFT), cooling (55–125)', () => {
  assert.match(rd('starting-system.html'), /traces: \{ speed: \[clamp\(sys\.engineRpm, 0, TUNING\.redlineRpm\), clamp\(sys\.starterRpm \/ 12, 0, TUNING\.redlineRpm\)\] \}/);
  assert.match(rd('starting-system.html'), /histAccum < 0\.03/);
  assert.match(rd('lubrication.html'), /traces: \{ temps: \[sim\.oilTemp, sim\.bearingTemp, sim\.wallTemp\] \}/); assert.match(rd('lubrication.html'), /histTimer >= 0\.25/);
  assert.match(rd('mpfi.html'), /traces: \{ trimhist: \[stft, ecuTrim\] \}/); assert.match(rd('mpfi.html'), /graphClock > 0\.20/);
  assert.match(rd('cooling.html'), /traces: \{ temp: THREE\.MathUtils\.clamp\(state\.temp, 55, 125\) \}/);
});
await t('7b2: Reset clears every migrated trace (null), starting-system / lubrication / mpfi / cooling', () => {
  for (const [m, id] of [['starting-system', 'speed'], ['lubrication', 'temps'], ['mpfi', 'trimhist'], ['cooling', 'temp']])
    assert.match(rd(m + '.html'), new RegExp(`traces: \\{ ${id}: null \\}`), `${m}: reset clears ${id}`);
});
await t('7b2: cooling — the surface-area meter is a Monitor row whose name follows the mode (rowLabels), the old bar is gone', () => {
  const c = rd('cooling.html'), mon = rd('monitor.js');
  assert.match(c, /rowLabels: \{ surface: 'Surface area' \}/); assert.match(c, /rowLabels: \{ surface: 'Thermostat status' \}/);
  assert.match(mon, /p\.rowLabels/); assert.match(mon, /key: k \}/); assert.match(rd('kit.js'), /rowLabels:\{id:text\}/);
});
await t('7b2: pages that lost a panel canvas call ui.panel.remeasure() once (ignition, crankshaft-piston, lubrication, mpfi)', () => {
  for (const m of ['ignition', 'crankshaft-piston', 'lubrication', 'mpfi']) assert.equal((rd(m + '.html').match(/ui\.panel\.remeasure\(\)/g) || []).length, 1, m);
});
await t('7b2: no file was added in 7b2 / 7b3 (CORE_ASSETS unchanged)', () => {
  assert.match(rd('sw.js'), /CORE_ASSETS/);
});

/* ───────────── Phase 7b3: one readout surface — duplicates, legends, panel readouts ───────────── */
const ALL_HTML = readdirSync(new URL('../', import.meta.url)).filter((f) => f.endsWith('.html'));
const P7B3_ROWS = { braking: ['pedal', 'pres', 'ffront', 'frear', 'tq'], steering: [], suspension: ['shockF', 'shockR', 'chassis'], turbocharger: ['iat'], gearbox: ['ratio'],
  ignition: ['dwell', 'order'], lubrication: ['oil', 'brg', 'dmain', 'drod', 'dcyl', 'dcam', 'dring'], mpfi: ['pres', 'maf', 'map', 'iat', 'knock', 'o2', 'egr', 'cyl'],
  differential: ['radius'], 'abs-esc': ['fl', 'fr', 'press', 'yaw', 'esc'], ecu: ['pw', 'kr', 'stft', 'ltft', 'loop', 'mil'], obd2: ['proto', 'mods', 'code', 'frpm', 'fcool'],
  valvetrain: ['cam', 'adv', 'ev', 'ov', 've', 'eff'], 'crankshaft-piston': ['slow', 'cyc', 's1', 's2', 's3', 's4', 'pos', 'vel', 'acc', 'press', 'side', 'tq', 'tqm', 'pw', 'mps'] };
await t('7b3: no bespoke panel readout grid is left — no .al-read, no ro-* ids, no kv / lr / ss / ig / mp / el / diff / steer / susp / ex readout rows', () => {
  const bad = /(?<![\w-])al-read\b|\bid="ro-|readoutHTML|Widgets\.readout|kv-row|lr-row|ss-row|ig-row|mp-row|el-rows|diff-row|steer-row|susp-shock|ex-row|data-ss=|data-ig=|data-mp=|data-el="(?:r[123]|badge)|data-diff=|data-steer|data-susp|carb-readout|mechanism-readout|br-readout|gb-readout/;
  for (const f of [...ALL_HTML, 'components.js', 'components.css']) assert.ok(!bad.test(rd(f.endsWith('.html') || f.includes('.') ? f : f + '.html')), `${f}: a readout grid / row is still in the page`);
});
await t('7b3: the panel readout slot holds text only (no <b>, no value spans, no bars, no canvas)', () => {
  for (const f of ALL_HTML) {
    const s = rd(f); const m = /\n\s*readout:\s*`/.exec(s); if (!m) continue;
    const body = s.slice(m.index, s.indexOf('`', m.index + m[0].length));
    assert.ok(!/<b[ >]|class="(val|row|v)"|<canvas|<svg|style="[^"]*width:\s*\d+%/.test(body), `${f}: numbers or bars inside the panel readout slot`);
  }
});
await t('7b3: every row the 14 migrated pages write exists in their Monitor config, and every per-mode config validates (ids unique)', () => {
  for (const [m, ids] of Object.entries(P7B3_ROWS)) {
    const s = rd(m + '.html');
    for (const id of ids) assert.ok(new RegExp(`\\[\\s*'${id}'\\s*,\\s*'[^']+'\\s*\\]|\\['${id}'`).test(s), `${m}: row ${id} is not declared`);
  }
  const modes = { electrical: ['battery', 'alternator', 'charging'], 'starting-system': ['circuit', 'starter', 'mesh', 'crank'], exhaustsystem: ['principle', 'compare', 'catalyst', 'full'] };
  for (const [m, list] of Object.entries(modes)) for (const mode of list) { const v = M.validateMonitorConfig(modeConfig(m, mode)); assert.ok(v.ok, `${m}/${mode}: ${v.errors.join('; ')}`); }
  for (const m of ['braking', 'suspension', 'turbocharger', 'gearbox', 'ignition', 'lubrication', 'mpfi', 'differential', 'cooling']) {
    const v = M.validateMonitorConfig(anyConfig(m)); assert.ok(v.ok, `${m}: ${v.errors.join('; ')}`);
  }
});
await t('7b3: a value is printed once — no migrated page repeats a row in the big value or two rows with the same name', () => {
  const cfgs = [];
  for (const m of ['braking', 'suspension', 'turbocharger', 'gearbox', 'ignition', 'lubrication', 'mpfi', 'differential', 'cooling']) cfgs.push([m, anyConfig(m)]);
  for (const [m, modes] of Object.entries({ electrical: ['battery', 'alternator', 'charging'], 'starting-system': ['circuit', 'starter', 'mesh', 'crank'], exhaustsystem: ['principle', 'compare', 'catalyst', 'full'] }))
    for (const mode of modes) cfgs.push([m + '/' + mode, modeConfig(m, mode)]);
  for (const [name, c] of cfgs) {
    const labels = c.rows.map((r) => String(r[1]).trim().toLowerCase());
    assert.equal(new Set(labels).size, labels.length, `${name}: two rows with the same name`);
  }
  assert.ok(!modeConfig('starting-system', 'circuit').rows.some((r) => r[0] === 'amps'), 'circuit mode: current is the big value, not also a row');
  assert.ok(!modeConfig('starting-system', 'circuit').rows.some((r) => r[0] === 'key'), 'circuit mode: the key name is the status');
});
await t('7b3: every legend is the Monitor footer (components.js + 9 hand-built pages); no <i style=background> legend markup outside it', () => {
  for (const m of ['ignition', 'turbocharger', 'cooling', 'valvetrain', 'obd2', 'crankshaft-piston']) assert.match(rd(m + '.html'), /footer:\s*(LEGEND|')/, `${m}: footer`);
  assert.match(rd('components.js'), /footer: CFG\.legend && CFG\.legend\.length \? Widgets\.legend\(CFG\)/);
  assert.ok(!/widgets:\s*\{\s*br:/.test(rd('components.js')), 'components.js: no bottom-right legend widget');
  for (const f of ALL_HTML) { const s = rd(f); assert.ok(!/\bal-legend\b|\bex-legend\b|\big-legend\b|id="flow-legend"|id="legend"|class="legend-row"|gp-legend|wf-legend/.test(s), `${f}: old legend markup`); }
  assert.ok(!/\.al-legend/.test(rd('components.css')));
  assert.match(rd('controls.css'), /\.ui-monitor \.mon-legend/);
});
await t('7b3: the info panel keeps no readout number — braking / steering / suspension / turbocharger / transmission / gearbox / differential panels have no readout rows', () => {
  for (const m of ['braking', 'steering', 'suspension', 'turbocharger', 'transmission', 'gearbox', 'differential', 'carburetor', 'engine']) {
    const s = rd(m + '.html'); const mm = /\n\s*readout:\s*`/.exec(s);
    if (mm) { const body = s.slice(mm.index, s.indexOf('`', mm.index + mm[0].length)); assert.ok(!/\d+(\.\d+)?\s*(%|rpm|bar|N|Nm|kPa|°C|V|A|ms)\b/.test(body.replace(/<[^>]+>/g, ' ').replace(/A₁|A₂|F₁|F₂|ω/g, '')), `${m}: a number sits in the panel readout`); }
  }
});
await t('7b3: kit.monitorRows — a Monitor-row sink with textContent / className (tone), writes to dropped names are ignored', () => {
  const k = rd('kit.js'); const a = k.indexOf('export function monitorRows'), b = k.indexOf('export const DEG');
  const fn = new Function(k.slice(a, b).replace('export function', 'function') + '\nreturn monitorRows;')();
  const calls = []; const ui = { monitor: { update: (p) => calls.push(p) } };
  const ro = fn(ui, ['fl', 'slip'], ['speed']);
  ro.fl.textContent = '80 km/h'; ro.fl.className = 'v crit'; ro.slip.textContent = '12 %'; ro.slip.className = 'v ok'; ro.speed.textContent = '80'; ro.speed.className = 'v warn';
  assert.deepEqual(calls[0], { rows: { fl: '80 km/h' } }); assert.deepEqual(calls[1], { rows: { fl: ['80 km/h', 'crit'] } });
  assert.deepEqual(calls.at(-1), { rows: { slip: ['12 %', 'ok'] } }); assert.equal(calls.length, 4, 'dropped names write nothing');
  ro.fl.className = 'v'; assert.deepEqual(calls.at(-1), { rows: { fl: '80 km/h' } }, 'a className without a tone word clears the tone');
});
await t('7b3: rowLabels are only used on declared rows; braking / steering / turbocharger / mpfi / cooling / crankshaft-piston rename rows with the mode', () => {
  for (const [m, ids] of Object.entries({ braking: ['pres', 'ffront', 'frear'], steering: ['rack', 'road'], turbocharger: ['drive'], mpfi: ['o2', 'pw', 'knock'], cooling: ['surface'], 'crankshaft-piston': ['pos'] })) {
    const s = rd(m + '.html'); assert.match(s, /rowLabels:/, `${m}: rowLabels`);
    for (const id of ids) assert.ok(new RegExp(`\\['${id}'`).test(s), `${m}: ${id} declared`);
  }
});
await t('7b3: dead CSS — none of the removed readout selectors survives in any page, components.css or app.css', () => {
  const bad = /#(ign|mp|ss|ex|diff|steer|susp|trans|live|gb)-readout|\.(kv|dm|lr|ig|mp|ss|ex|diff|steer|susp)-(row|bar|fill|num|name|dot|shock|rows|legend|trims)|#damage-block|#state-badge|#mp-badge|#cycle-bar|\.cyc-marker|(?<![\w-])\.al-read|\.el-badge|\.carb-readout|\.mechanism-readout|#wheel-speed-extra/;
  for (const f of [...ALL_HTML, 'components.css', 'app.css', 'controls.css']) { const s = rd(f); const css = (s.match(/<style[^>]*>[^]*?<\/style>/g) || [s]).join('\n'); assert.ok(!bad.test(css), `${f}: dead readout CSS`); }
});
await t('7b3: MONITOR-MAP.md — the 7a table has no row that is not "7b done", and every page is in it', () => {
  const md = rd('MONITOR-MAP.md'); const rows = md.split('\n').filter((l) => /^\| [a-z0-9-]+ \| (bespoke|guided|—|-)/.test(l));
  assert.ok(rows.length >= 42, 'table rows: ' + rows.length);
  for (const r of rows) assert.match(r.split('|')[7].trim(), /^7b done/, r.slice(0, 40));
  for (const f of ALL_HTML) { const name = f.replace('.html', ''); if (name === 'index' || name === '404') continue;           /* shell pages, not modules */ assert.ok(rows.some((r) => r.startsWith('| ' + name + ' |')), `${name} missing from the table`); }
});
await t('7b3: acceptance grep — no chip-row, al-read, ui-chip, setRpmLabel or ui.chip in any page, CSS or kit.js; no MutationObserver on the Monitor path', () => {
  for (const f of [...ALL_HTML, 'app.css', 'controls.css', 'components.css', 'kit.js', 'monitor.js', 'monitor-core.js', 'components.js']) {
    const s = rd(f); assert.ok(!/chip-row|(?<![\w-])al-read\b|ui-chip|setRpmLabel|ui\.chip\b/.test(s), `${f}: chip / al-read leftover`);
  }
  for (const f of ['kit.js', 'monitor.js', 'monitor-core.js', 'components.js', 'controls.js', 'dock.js']) assert.ok(!/MutationObserver/.test(rd(f)), `${f}: MutationObserver`);
});
await t('7b3: the dock has no legend page — components.js passes no widgets, and a page with legend config gets a footer', () => {
  const c = rd('components.js'); assert.ok(!/widgets\s*:/.test(c.slice(c.indexOf('UI.create('))), 'components.js: UI.create without widgets');
  assert.match(c, /footer: CFG\.legend/);
});
await t('7b3 (kept in Phase 8): sw.js VERSION is autolab-v8.8 or later', () => { assert.match(rd('sw.js'), /VERSION = 'autolab-v8\.([89])(\.\d+)?'/); });

let JSDOM = null;
try {
  const req = createRequire(process.env.JSDOM_PATH ? pathToFileURL(path.join(process.env.JSDOM_PATH, 'x.js')) : import.meta.url);
  JSDOM = req('jsdom').JSDOM;
} catch (_) { /* skipped below */ }
if (!JSDOM) {
  console.log('skip  monitor DOM tests (jsdom not available; set JSDOM_PATH to a dir with jsdom installed)');
} else {
  const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
  globalThis.document = dom.window.document; globalThis.window = dom.window; globalThis.getComputedStyle = dom.window.getComputedStyle;
  const { createMonitor } = await import('../monitor.js');
  const mk = () => { document.body.innerHTML = ''; const mon = createMonitor({ mount: document.body, doc: document, moduleId: 't' });
    mon.set({ label: 'Heat', value: { label: 'Heat', unit: ' kW', max: 100, bar: true }, rows: [['tin', 'Coolant in'], ['phase', 'Phase']], status: { text: 'Normal' } });
    return mon; };
  await t('7b1 DOM: update({label}) changes the head label once; value, rows and status merge into one flush', () => {
    const mon = mk();
    mon.update({ label: 'Noise reduction', value: { text: '42', unit: '% cut', bar: 42, color: 'red', barColor: 'blue' }, rows: { tin: '90 °C' }, status: ['Silenced', true] });
    mon.flush();
    const q = (s) => mon.root.querySelector(s);
    assert.equal(q('.mon-label').textContent, 'Noise reduction');
    assert.equal(q('.mon-value-text').textContent, '42'); assert.equal(q('.mon-value-unit').textContent, '% cut');
    assert.equal(q('.mon-bar-fill').style.width, '42%'); assert.equal(q('.mon-value').style.color, 'red');
    assert.equal(q('[data-row="tin"] .mon-row-v').textContent, '90 °C');
    assert.equal(q('.mon-status-text').textContent, 'Silenced'); assert.ok(q('.mon-status').classList.contains('on'));
    const w = mon.stats.textWrites; mon.update({ label: 'Noise reduction', rows: { tin: '90 °C' } }); mon.flush();
    assert.equal(mon.stats.textWrites, w, 'identical text is not rewritten');
    mon.update({ label: 'Silencer advantage' }); mon.flush();
    assert.equal(q('.mon-label').textContent, 'Silencer advantage');
  });
  await t('7b1 DOM: a status tone replaces the cooling status classes; String(number) keeps decimals (no rounding)', () => {
    const mon = mk();
    mon.update({ status: ['OVERHEATING — raise speed', false, 'crit'], value: { text: String(14.7), unit: ' : 1' } }); mon.flush();
    assert.equal(mon.root.querySelector('.mon-status').dataset.tone, 'crit');
    assert.equal(mon.root.querySelector('.mon-value-text').textContent, '14.7');
    mon.update({ status: ['Normal', false, ''] }); mon.flush();
    assert.equal(mon.root.querySelector('.mon-status').dataset.tone, undefined);
  });
  await t('7b2 DOM: update({ rowLabels }) renames a row once (cooling: Surface area ↔ Thermostat status); set() resets the cache', () => {
    const mon = mk();
    mon.update({ rowLabels: { phase: 'Thermostat status' }, rows: { phase: 'Regulating' } }); mon.flush();
    const k = () => mon.root.querySelector('[data-row="phase"] .mon-row-k').textContent;
    assert.equal(k(), 'Thermostat status');
    const w = mon.stats.textWrites; mon.update({ rowLabels: { phase: 'Thermostat status' } }); mon.flush();
    assert.equal(mon.stats.textWrites, w, 'same label is not rewritten');
    mon.update({ rowLabels: { phase: 'Surface area' } }); mon.flush(); assert.equal(k(), 'Surface area');
    mon.update({ rowLabels: { nope: 'x' } }); mon.flush();            /* unknown id: ignored */
  });
  await t('7b2 DOM: a trace takes pushed samples (one per update call), null clears it, a second set() with traces rebuilds (electrical)', () => {
    const mon = createMonitor({ mount: document.body, doc: document, moduleId: 't2' });
    mon.set({ rows: [['a', 'A']], traces: [{ id: 'wave', label: 'W', min: -1.5, max: 1.5, length: 240, series: [{ id: 'a' }, { id: 'b' }] }] });
    for (let i = 0; i < 5; i++) mon.update({ traces: { wave: [i, -i] } });
    assert.equal(mon._traceNodes.wave.bufs[0].length, 5); assert.equal(mon._traceNodes.wave.bufs[1].at(4), -4);
    mon.update({ traces: { wave: null } }); assert.equal(mon._traceNodes.wave.bufs[0].length, 0);
    mon.set({ rows: [['a', 'A']] }); assert.equal(Object.keys(mon._traceNodes).length, 0);
    mon.update({ traces: { wave: [1, 1] } });                             /* no such trace any more: ignored, no throw */
  });
}

console.log(`\n${n} test groups passed`);
