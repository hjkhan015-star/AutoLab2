// node tests/keys.test.mjs  (no dependencies)
import assert from 'node:assert/strict';
import * as K from '../keys.js';
import { GLOBAL_KEYS } from '../controls-core.js';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  ', name); };

/* fake element: closest(sel) is true when sel lists one of the selectors the element satisfies */
const fake = (...satisfies) => ({
  closest(sel) { return sel.split(',').map((s) => s.trim()).some((p) => satisfies.includes(p)) ? this : null; }
});
const ev = (key, extra = {}) => Object.assign({ key, ctrlKey: false, metaKey: false, altKey: false, repeat: false, target: fake(), preventDefault() { this.prevented = true; } }, extra);

t('every action in the shared keymap has exactly one owner', () => {
  for (const a of new Set(Object.values(GLOBAL_KEYS))) assert.ok(K.ownerOf(a), `no owner for "${a}"`);
  for (const a of K.SHELL_OWNED) assert.ok(!K.MODULE_OWNED.includes(a), `${a} owned twice`);
  assert.deepEqual([...K.SHELL_OWNED].sort(), ['close', 'theme', 'wireframe', 'xray']);
  assert.deepEqual([...K.MODULE_OWNED].sort(), ['labelDensity', 'reset', 'togglePlay']);
});

t('R5 keys resolve (case-insensitive letters, Space)', () => {
  const want = { ' ': 'togglePlay', r: 'reset', R: 'reset', d: 'labelDensity', D: 'labelDensity', l: 'theme', L: 'theme', w: 'wireframe', W: 'wireframe', x: 'xray', X: 'xray', Escape: 'close' };
  for (const [k, a] of Object.entries(want)) assert.equal(K.resolveKey(ev(k)), a, k);
  assert.equal(K.resolveKey(ev('p')), null, 'P is no longer a shortcut');
  assert.equal(K.resolveKey(ev('q')), null);
});

t('modifiers, auto-repeat and typing targets are never hijacked', () => {
  assert.equal(K.resolveKey(ev('r', { ctrlKey: true })), null);
  assert.equal(K.resolveKey(ev('r', { metaKey: true })), null);
  assert.equal(K.resolveKey(ev('l', { altKey: true })), null);
  assert.equal(K.resolveKey(ev(' ', { repeat: true })), null);
  for (const sel of ['input', 'textarea', 'select']) assert.equal(K.resolveKey(ev('r', { target: fake(sel) })), null, sel);
  assert.equal(K.resolveKey(null), null);
});

t('Space activates focused widgets instead of toggling play; letters still work there', () => {
  for (const sel of ['button', '[role="slider"]', '[role="switch"]', 'a[href]', '[tabindex]:not([tabindex="-1"])'])
    assert.equal(K.resolveKey(ev(' ', { target: fake(sel) })), null, `Space on ${sel}`);
  assert.equal(K.resolveKey(ev('r', { target: fake('button') })), 'reset');
  assert.equal(K.resolveKey(ev(' ', { target: fake() })), 'togglePlay', 'canvas / body');
});

function side(ownedSet) {
  const log = { handled: [], forwarded: [] };
  const router = K.createKeyRouter({
    owns: (a) => ownedSet.includes(a),
    handle: (a) => log.handled.push(a),
    forward: (a) => log.forwarded.push(a)
  });
  return { log, router };
}

t('shell side: handles L/W/X/Esc, forwards Space/R/D', () => {
  const s = side(K.SHELL_OWNED);
  for (const k of ['l', 'w', 'x', 'Escape', ' ', 'r', 'd']) s.router.onKeyDown(ev(k));
  assert.deepEqual(s.log.handled, ['theme', 'wireframe', 'xray', 'close']);
  assert.deepEqual(s.log.forwarded, ['togglePlay', 'reset', 'labelDensity']);
});

t('embedded module side: the mirror image', () => {
  const m = side(K.MODULE_OWNED);
  for (const k of ['l', 'w', 'x', 'Escape', ' ', 'r', 'd']) m.router.onKeyDown(ev(k));
  assert.deepEqual(m.log.handled, ['togglePlay', 'reset', 'labelDensity']);
  assert.deepEqual(m.log.forwarded, ['theme', 'wireframe', 'xray', 'close']);
});

t('standalone module owns everything and forwards nothing', () => {
  const m = side([...K.SHELL_OWNED, ...K.MODULE_OWNED]);
  for (const k of ['l', ' ', 'Escape']) m.router.onKeyDown(ev(k));
  assert.equal(m.log.forwarded.length, 0);
  assert.equal(m.log.handled.length, 3);
});

t('forwarded keys are handled once and never bounce back (no ping-pong)', () => {
  const s = side(K.SHELL_OWNED);
  assert.equal(s.router.incoming('theme'), true);
  assert.equal(s.router.incoming('togglePlay'), false, 'not ours → ignored, not re-forwarded');
  assert.deepEqual(s.log.handled, ['theme']);
  assert.deepEqual(s.log.forwarded, []);
});

t('Space is preventDefault-ed (no page scroll); letters are left alone', () => {
  const s = side(K.SHELL_OWNED);
  const sp = ev(' '); s.router.onKeyDown(sp); assert.equal(sp.prevented, true);
  const r = ev('r'); s.router.onKeyDown(r); assert.equal(r.prevented, undefined);
});

t('installKeys attaches and removes one listener', () => {
  const calls = []; const win = { addEventListener: (n, f) => calls.push(['add', n, f]), removeEventListener: (n, f) => calls.push(['rm', n, f]) };
  const s = side([]); const off = K.installKeys(win, s.router); off();
  assert.equal(calls[0][1], 'keydown'); assert.equal(calls[1][0], 'rm'); assert.equal(calls[0][2], calls[1][2]);
});

console.log(`\n${n} test groups passed`);
