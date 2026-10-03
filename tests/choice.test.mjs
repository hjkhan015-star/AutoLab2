// node tests/choice.test.mjs — Phase 6: choice / toggle / action (pure logic + static module checks).
// DOM group needs jsdom (not a project dependency): set JSDOM_PATH to a dir with it installed, else it prints "skip".
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
const t = async (name, fn) => { await fn(); n++; console.log('ok  ', name); };

/* ── pure ─────────────────────────────────────────────────────────────── */
await t('normalizeOptions: strings and objects, tone defaults to normal, errors on empty / duplicate / id-less', () => {
  const o = core.normalizeOptions(['A', { id: 'B', label: 'Bee', tone: 'crit' }, { id: 'C', tone: 'weird' }]);
  assert.deepEqual(o.map((x) => [x.id, x.label, x.tone, x.index]), [['A', 'A', 'normal', 0], ['B', 'Bee', 'crit', 1], ['C', 'C', 'normal', 2]]);
  assert.throws(() => core.normalizeOptions([]));
  assert.throws(() => core.normalizeOptions(['A', 'A']));
  assert.throws(() => core.normalizeOptions([{ label: 'x' }]));
});
await t('choice index maths: clamp, step (clamped and wrapping), lookup by id or index', () => {
  assert.equal(core.clampChoice(-3, 4), 0); assert.equal(core.clampChoice(9, 4), 3); assert.equal(core.clampChoice(NaN, 4), 0);
  assert.equal(core.stepChoice(3, 1, 4, false), 3); assert.equal(core.stepChoice(3, 1, 4, true), 0);
  assert.equal(core.stepChoice(0, -1, 4, true), 3); assert.equal(core.stepChoice(0, -1, 4, false), 0);
  assert.equal(core.choiceIndex('b', ['a', 'b']), 1); assert.equal(core.choiceIndex(1, ['a', 'b']), 1);
  assert.equal(core.choiceIndex('zz', ['a', 'b']), -1); assert.equal(core.choiceId(9, ['a', 'b']), 'b');
});
await t('choice / toggle defaults (def by id or index; toggle def truthy -> 1)', () => {
  assert.equal(core.choiceDefault({ options: ['a', 'b', 'c'] }), 0);
  assert.equal(core.choiceDefault({ options: ['a', 'b', 'c'], def: 'c' }), 2);
  assert.equal(core.choiceDefault({ options: ['a', 'b', 'c'], def: 1 }), 1);
  assert.equal(core.choiceDefault({ options: ['a', 'b'], def: 'nope' }), 0);
  assert.equal(core.toggleDefault({}), 0); assert.equal(core.toggleDefault({ def: true }), 1);
});
await t('registry: choice stores a clamped INDEX, toggle stores 0 / 1; reset returns to def; duplicates throw (R9)', () => {
  const reg = core.createRegistry();
  reg.register('c', { type: 'choice', options: ['a', 'b', 'c'], def: 'b' });
  reg.register('t', { type: 'toggle', def: true });
  assert.equal(reg.get('c'), 1); assert.equal(reg.get('t'), 1);
  reg.set('c', 99); assert.equal(reg.get('c'), 2);
  reg.set('c', -5); assert.equal(reg.get('c'), 0);
  reg.set('t', 0); assert.equal(reg.get('t'), 0); reg.set('t', 'yes'); assert.equal(reg.get('t'), 1);
  assert.throws(() => reg.register('c', { type: 'choice', options: ['x'] }));
  reg.set('c', core.defaultNormalized(reg.spec('c'))); reg.set('t', core.defaultNormalized(reg.spec('t')));
  assert.equal(reg.get('c'), 1); assert.equal(reg.get('t'), 1);            /* a control's reset = its spec default */
  reg.reset(); assert.equal(reg.has('c'), false);                           /* registry.reset() clears (tests / module reset) */
});
await t('registry: listeners fire only on a real change', () => {
  const reg = core.createRegistry(); const seen = [];
  reg.register('c', { type: 'choice', options: ['a', 'b'] }); reg.on('c', (v) => seen.push(v));
  reg.set('c', 1); reg.set('c', 1); reg.set('c', 0);
  assert.deepEqual(seen, [1, 0]);
});
await t('realValue / fromReal: choice <-> option id, toggle <-> boolean', () => {
  const c = { type: 'choice', options: ['x', 'y', 'z'] };
  assert.equal(core.realValue(2, c), 'z'); assert.equal(core.fromReal('y', c), 1); assert.equal(core.fromReal('nope', c), 0);
  assert.equal(core.realValue(1, { type: 'toggle' }), true); assert.equal(core.fromReal(false, { type: 'toggle' }), 0);
});
await t('keyToIntent: segmented ← → step (not ↑ ↓ swallowed globally), toggle Enter / Space flips', () => {
  const k = core.keyToIntent;
  assert.deepEqual(k('choice', { key: 'ArrowRight' }, {}), { step: 1 }); assert.deepEqual(k('choice', { key: 'ArrowLeft' }, {}), { step: -1 });
  assert.deepEqual(k('toggle', { key: ' ' }, {}), { flip: true }); assert.deepEqual(k('toggle', { key: 'Enter' }, {}), { flip: true });
  assert.equal(k('toggle', { key: 'a' }, {}), null);
});
await t('gate keys: ↑ / ↓ shift up / down, N / Esc / Home = neutral (the single reset path)', () => {
  const g = core.gateKeyToIntent;
  assert.deepEqual(g({ key: 'ArrowUp' }), { step: 1 }); assert.deepEqual(g({ key: 'ArrowDown' }), { step: -1 });
  assert.deepEqual(g({ key: 'n' }), { to: 0 }); assert.deepEqual(g({ key: 'Escape' }, { neutral: 3 }), { to: 3 });
  assert.equal(g({ key: 'x' }), null);
});

/* ── static: controls.js / css ────────────────────────────────────────── */
await t('controls.js: choice (3 layouts) + toggle + action, ARIA roles, still ONE requestAnimationFrame call site', () => {
  const js = rd('controls.js');
  for (const k of ['createChoice', 'createToggle', 'createAction', 'role="radiogroup"', 'role="radio"', 'role="switch"', 'aria-checked', 'setHidden'])
    assert.ok(js.includes(k), k);
  assert.equal((js.match(/requestAnimationFrame\(/g) || []).length, 1);
});
await t('controls.css Phase 6 block: tokens only, 44 px targets, 11 px text, nothing animates under reduced motion', () => {
  const css = rd('controls.css'); const b = css.slice(css.indexOf('Phase 6 — choice'), css.indexOf('Monitor (Phase 7a)') > 0 ? css.indexOf('Monitor (Phase 7a)') : undefined);   /* the Monitor block has its own checks */
  assert.ok(b.length > 800); assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(b));
  assert.match(b, /min-height: var\(--ctl-tap\)/);
  assert.ok(!/transition/.test(b.replace(/@media \(prefers-reduced-motion: no-preference\)[^\n]*/g, '')), 'transitions only inside no-preference');
});
await t('kit.js: UI.create(options) + addOptions; components.js passes CFG.options and runs CFG.onReset', () => {
  const kit = rd('kit.js'), comp = rd('components.js');
  assert.match(kit, /_buildOptions/); assert.match(kit, /addOptions\(/);
  assert.match(comp, /options: CFG\.options/); assert.match(comp, /CFG\.onReset/);
});

/* ── static: modules ──────────────────────────────────────────────────── */
const MIGRATED = ['awd', 'catalytic', 'commonrail', 'dpf', 'driveshaft', 'egr', 'fuelpump', 'intercooler', 'oilpump', 'radiator',
  'automatic', 'gearbox', 'starting-system', 'lubrication', 'exhaustsystem', 'electrical', 'differential', 'transmission', 'cooling',
  'suspension', 'mpfi', 'ecu', 'abs-esc', 'obd2', 'braking', 'carburetor', 'steering', 'turbocharger', 'engine', 'crankshaft-piston', 'valvetrain', 'lighting'];
await t('migrated modules: declare options:[…], no toolbar extras, no window.__*Sync hook, no .cfg-arrow / ‹ › switcher', () => {
  for (const f of MIGRATED) {
    const s = rd(f + '.html');
    assert.match(s, /options\s*[:=]\s*\[|addOptions\(/, `${f}: no options`);
    assert.ok(!/extras:\s*\[\s*\{/.test(s), `${f}: toolbar extras remain`);
    assert.ok(!/window\.__\w*Sync\w*\s*=/.test(s), `${f}: __*Sync hook`);
    assert.ok(!/cfg-prev|cfg-arrow|cfg-group/.test(s), `${f}: old config switcher`);
  }
});
await t('migrated modules: every control id is unique inside its page (R9)', () => {
  for (const f of MIGRATED) {
    const s = rd(f + '.html');
    const ids = [...s.matchAll(/\{\s*id:\s*['"]([\w-]+)['"]\s*,\s*type:\s*'(?:choice|toggle|action)'/g)].map((m) => m[1]);   /* both quote styles (guided specs use ") */
    assert.equal(new Set(ids).size, ids.length, `${f}: duplicate control ids ${ids}`);
  }
});
await t('lighting: the dip switch is a 3-stop choice (id dip, default Low), no slider, and the sim reads it', () => {
  const s = rd('lighting.html');
  assert.match(s, /id:\s*'dip'\s*,\s*type:\s*'choice'/, 'no dip choice');
  assert.match(s, /def:\s*'low'/, 'dip default must be Low');
  assert.match(s, /ctl:\s*null/, 'lighting must not declare a main slider');
  assert.ok(!/val:\s*45/.test(s), 'old slider value left behind');
  assert.match(s, /const m\s*=\s*dipMode/, 'sim must read dipMode, not c.k');
  assert.ok(!/c\.k\b/.test(s), 'sim still reads the slider value');
  const labels = [...s.matchAll(/\{\s*id:\s*'(off|low|high)'\s*,\s*label:/g)].map((m) => m[1]);
  assert.deepEqual(labels, ['off', 'low', 'high']);
});
await t('components.js: CFG.ctl === null builds a guided module without a main slider', () => {
  const s = rd('components.js');
  assert.match(s, /if \(CFG\.ctl === null\) return \[\]/);
});
await t('no module hand-wires the dock transport, and no guided module keeps a panel fold / reset button', () => {
  for (const f of ['awd', 'catalytic', 'commonrail', 'dpf', 'driveshaft', 'egr', 'fuelpump', 'intercooler', 'oilpump', 'radiator']) {
    const s = rd(f + '.html');
    assert.ok(!/-fold'|-reset'|<button|<select/.test(s.replace(/<style[\s\S]*?<\/style>/g, '')), `${f}: panel control remains`);
    assert.match(s, /CFG\.onReset/);
  }
});

await t('6.5: guided modules use the pre-seeded id `timeScale` (label \"Time scale\", 1/5/20, segmented, module-local) — no `timescale`', () => {
  for (const f of ['awd', 'catalytic', 'commonrail', 'dpf', 'driveshaft', 'egr', 'fuelpump', 'intercooler', 'oilpump', 'radiator']) {
    const s = rd(f + '.html');
    assert.match(s, /id: 'timeScale', type: 'choice', layout: 'segmented', label: 'Time scale'/, f);
    assert.ok(!/'timescale'/.test(s), `${f}: old id`);
  }
});
await t('6.5: on kit pages the only <button / <select / <input are the documented exclusions (quiz .al-opt, gearbox .tq-toggle)', () => {
  const BESPOKE = ['sparkplug.html', 'thermostat.html', 'tyres.html', 'wiring.html'];   /* own bespoke UI, never migrated: known gap D6-15, check.mjs WARNs */
  for (const f of pages) {
    if (BESPOKE.includes(f)) continue;
    const s = rd(f);
    if (!/from\s+['"]\.\/(kit|components)\.js['"]/.test(s)) continue;
    const code = s.replace(/<style[\s\S]*?<\/style>/g, '');
    for (const l of code.split('\n')) {
      if (!/<(button|select|input)\b/.test(l)) continue;
      assert.ok(/al-opt|quiz|tq-toggle/.test(l), `${f}: unexpected authored control: ${l.trim().slice(0, 80)}`);
    }
  }
});
await t('6.5: dead selectors stay deleted (.al-w, .al-sel in components.css; the Phase 6 delete list in css + html)', () => {
  const css = rd('components.css');
  assert.ok(!/\.al-w[\s{.]|\.al-sel/.test(css));
  const dead = /\.dt-btn|\.muf-btn|\.drive-btn|\.ms-btn|\.key-btn|\.at-gearsel-btn|\.al-fault-btn|#oil-switch-btn|\.awd-btns|\.cat-btns|\.al-fault-row|\.cfg-arrow/;
  for (const f of [...pages, 'components.css', 'controls.css', 'app.css']) assert.ok(!dead.test(rd(f)), `${f}: deleted selector is back`);
});
await t('6.5: sw.js cache is autolab-v8.6.x', () => assert.match(rd('sw.js'), /const VERSION = 'autolab-v8\.[6-9](\.\d+)?'/));

/* ── DOM (needs jsdom) ────────────────────────────────────────────────── */
let JSDOM = null;
try { const req = createRequire(process.env.JSDOM_PATH ? pathToFileURL(path.join(process.env.JSDOM_PATH, 'x.js')) : import.meta.url); JSDOM = req('jsdom').JSDOM; } catch (_) { /* optional */ }
if (!JSDOM) console.log('skip  choice DOM tests (jsdom not available; set JSDOM_PATH to a dir with jsdom installed)');
else {
  const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
  const { createChoice, createToggle, createAction, controls } = await import('../controls.js');
  await t('DOM: segmented radiogroup — roving tabindex, arrows step, aria-checked follows the registry', () => {
    const c = createChoice({ id: 'seg', options: ['a', 'b', 'c'] }); document.body.appendChild(c.el);
    const radios = [...c.el.querySelectorAll('[role=radio]')];
    assert.equal(radios.filter((r) => r.getAttribute('aria-checked') === 'true').length, 1);
    assert.equal(radios.filter((r) => r.tabIndex === 0).length, 1);
    radios[0].dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    assert.equal(c.value(), 'b'); radios[2].click(); assert.equal(c.value(), 'c'); c.reset(); assert.equal(c.value(), 'a'); c.destroy();
  });
  await t('DOM: toggle — role=switch, click flips, value is boolean; action fires onAction only on click', () => {
    let hits = 0, seen = null;
    const tg = createToggle({ id: 'tg', onChange: (v) => { seen = v; } }); const ac = createAction({ id: 'ac', onAction: () => { hits++; } });
    document.body.append(tg.el, ac.el);
    const sw = tg.el.querySelector('[role=switch]'); assert.equal(sw.getAttribute('aria-checked'), 'false');
    sw.click(); assert.equal(tg.value(), true); assert.equal(seen, true); assert.equal(sw.getAttribute('aria-checked'), 'true');
    ac.el.querySelector('button').click(); assert.equal(hits, 1); assert.equal(ac.value(), undefined);
    assert.throws(() => createToggle({ id: 'tg' })); controls.resetAll(); assert.equal(tg.value(), false);
  });
}
console.log(`\n${n} choice tests passed`);
