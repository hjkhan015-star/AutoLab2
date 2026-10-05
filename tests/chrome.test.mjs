// node tests/chrome.test.mjs  (no dependencies) — pure helpers + a fake-DOM run of the real builders
import assert from 'node:assert/strict';
import * as C from '../chrome.js';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  ', name); };

t('sim speed is a multiplier, never rpm', () => {
  assert.equal(C.formatSimSpeed(0.85), '0.85×');
  assert.equal(C.formatSimSpeed(2.5), '2.50×');
  assert.ok(!/rpm|km/i.test(C.formatSimSpeed(1)));
  assert.equal(C.clampSpeed(99), 2.5); assert.equal(C.clampSpeed(-1), 0.15); assert.equal(C.clampSpeed('x'), 0.85);
  assert.deepEqual({ ...C.SPEED }, { min: 0.15, max: 2.5, step: 0.05, def: 0.85 });
});

t('label density cycles All → Key → None → All (levels 2,1,0 as labels.js)', () => {
  assert.equal(C.nextDensity(2), 1); assert.equal(C.nextDensity(1), 0); assert.equal(C.nextDensity(0), 2);
  assert.equal(C.nextDensity(99), 1, 'unknown level starts from All');
  assert.equal(C.normDensity(7), 2); assert.equal(C.normDensity(0), 0);
  assert.deepEqual(C.DENSITY.map((d) => d.label), ['All', 'Key', 'None']);
});

t('phone = max-width 720 OR max-height 540 (R2)', () => {
  assert.equal(C.isPhone(360, 640), true);
  assert.equal(C.isPhone(412, 915), true);
  assert.equal(C.isPhone(844, 390), true, 'landscape phone');
  assert.equal(C.isPhone(1280, 800), false);
  assert.equal(C.isPhone(721, 541), false);
  assert.equal(C.menuMode(412, 915), 'sheet'); assert.equal(C.menuMode(1280, 800), 'popover');
});

t('popover is right-aligned under the anchor and clamped into the viewport', () => {
  const vp = { w: 1280, h: 800 }, size = { w: 300, h: 260 };
  let p = C.popoverPosition({ left: 1200, right: 1240, top: 0, bottom: 32 }, size, vp);
  assert.deepEqual(p, { left: 940, top: 38 });
  p = C.popoverPosition({ left: 0, right: 40, top: 0, bottom: 32 }, size, vp);
  assert.equal(p.left, 8, 'clamped to left margin');
  p = C.popoverPosition({ left: 1200, right: 1240, top: 700, bottom: 740 }, size, vp);
  assert.ok(p.top + size.h <= vp.h - 8, 'clamped to bottom');
});

/* ── minimal fake DOM, enough for createHeader / createMenu ── */
function makeDoc(w = 412, h = 915) {
  const win = { innerWidth: w, innerHeight: h, requestAnimationFrame: (f) => f(), setTimeout: (f) => f(), matchMedia: () => ({ matches: false }), addEventListener() {} };
  const doc = { defaultView: win, activeElement: null };
  class El {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.ls = {}; this.hidden = false; this.className = ''; this.textContent = ''; this.value = ''; this.tabIndex = 0; this.style = { setProperty(k, v) { this[k] = v; } }; this.parentElement = null; this.offsetWidth = 300; this.offsetHeight = 260; }
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'tabindex') this.tabIndex = +v; }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    appendChild(c) { c.parentElement = this; this.children.push(c); return c; }
    addEventListener(t, f) { (this.ls[t] = this.ls[t] || []).push(f); }
    fire(t, e = {}) { e.target = this; e.preventDefault = e.preventDefault || (() => {}); e.stopPropagation = e.stopPropagation || (() => {}); (this.ls[t] || []).forEach((f) => f(e)); }
    focus() { doc.activeElement = this; }
    getBoundingClientRect() { return { left: 360, right: 400, top: 0, bottom: 32 }; }
    get classList() { const s = this; return { add: (c) => { if (!s.className.split(' ').includes(c)) s.className = (s.className + ' ' + c).trim(); }, remove: (c) => { s.className = s.className.split(' ').filter((x) => x && x !== c).join(' '); }, contains: (c) => s.className.split(' ').includes(c) }; }
    all(pred, out = []) { this.children.forEach((c) => { if (pred(c)) out.push(c); c.all(pred, out); }); return out; }
    querySelectorAll(sel) { const tags = sel.split(',').map((s) => s.trim().toUpperCase()); return this.all((c) => tags.includes(c.tagName)); }
  }
  doc.createElement = (t) => new El(t);
  doc.createElementNS = (_, t) => new El(t);
  doc.body = new El('body');
  return { doc, win, El };
}

t('header: one row with back · title · info · ⋯ (exactly one ⋯ button)', () => {
  const { doc } = makeDoc();
  const calls = [];
  const h = C.createHeader({ doc, title: 'Braking', color: 'tomato', onBack: () => calls.push('back'), onInfo: () => calls.push('info'), onMenu: () => calls.push('menu') });
  const btns = h.root.all((c) => c.tagName === 'BUTTON');
  assert.deepEqual(btns.map((b) => b.getAttribute('data-act')), ['back', 'info', 'more']);
  for (const b of btns) assert.ok(b.getAttribute('aria-label'), 'every button is labelled');
  assert.equal(h.more.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(h.more.getAttribute('aria-expanded'), 'false');
  h.setMenuExpanded(true); assert.equal(h.more.getAttribute('aria-expanded'), 'true');
  h.back.fire('click'); h.info.fire('click'); h.more.fire('click');
  assert.deepEqual(calls, ['back', 'info', 'menu']);
  const text = h.root.all((c) => c.className === 'al-hdr-text')[0];
  assert.equal(text.textContent, 'Braking');
  h.setTitle('Clutch'); assert.equal(text.textContent, 'Clutch');
  assert.equal(h.root.style['--al-accent'], 'tomato');
});

function menuParts(m) {
  const r = m.root;
  return {
    ranges: r.all((c) => c.tagName === 'INPUT'),
    radios: r.all((c) => c.getAttribute('role') === 'radio'),
    switches: r.all((c) => c.getAttribute('role') === 'switch'),
    output: r.all((c) => c.tagName === 'OUTPUT')[0],
    seg: r.all((c) => c.getAttribute('role') === 'radiogroup')[0]
  };
}

t('menu: sim speed · label density · theme · wireframe · x-ray — each exactly once, nothing else', () => {
  const { doc } = makeDoc();
  const m = C.createMenu({ doc, host: doc.body });
  const p = menuParts(m);
  assert.equal(p.ranges.length, 1, 'one slider');
  assert.equal(p.radios.length, 3, 'three density options');
  assert.deepEqual(p.switches.map((s) => s.getAttribute('data-key')), ['theme', 'wireframe', 'xray']);
  const labels = m.root.all((c) => c.textContent).map((c) => c.textContent).join('|');
  assert.ok(!/reset|flow|play/i.test(labels), `unexpected item in menu: ${labels}`);
  assert.equal(p.output.textContent, '0.85×');
});

t('menu: user actions fire onChange; update() syncs without firing', () => {
  const { doc } = makeDoc();
  const log = [];
  const m = C.createMenu({ doc, host: doc.body, onChange: (k, v) => log.push([k, v]) });
  const p = menuParts(m);
  p.ranges[0].value = '1.5'; p.ranges[0].fire('input');
  assert.deepEqual(log.pop(), ['speed', 1.5]); assert.equal(p.output.textContent, '1.50×');
  p.ranges[0].value = '9'; p.ranges[0].fire('input');
  assert.deepEqual(log.pop(), ['speed', 2.5], 'clamped');
  p.radios[2].fire('click');
  assert.deepEqual(log.pop(), ['density', 0]);
  assert.deepEqual(p.radios.map((r) => r.getAttribute('aria-checked')), ['false', 'false', 'true']);
  p.seg.fire('keydown', { key: 'ArrowRight' });                       /* None → All (wraps) */
  assert.deepEqual(log.pop(), ['density', 2]);
  p.switches[0].fire('click'); assert.deepEqual(log.pop(), ['theme', 'light']);
  assert.equal(p.switches[0].getAttribute('aria-checked'), 'true');
  /* wireframe / x-ray: the owner decides (mutual exclusion) → menu asks, does not flip itself */
  p.switches[1].fire('click'); assert.deepEqual(log.pop(), ['wireframe', true]);
  assert.equal(p.switches[1].getAttribute('aria-checked'), 'false');
  m.update({ wireframe: true, xray: false, density: 1, speed: 0.4, theme: 'dark' });
  assert.equal(log.length, 0, 'update() never fires onChange');
  assert.equal(p.switches[1].getAttribute('aria-checked'), 'true');
  assert.equal(p.switches[2].getAttribute('aria-checked'), 'false');
  assert.equal(p.switches[0].getAttribute('aria-checked'), 'false');
  assert.equal(p.radios[1].getAttribute('aria-checked'), 'true');
  assert.equal(p.output.textContent, '0.40×');
  assert.match(p.ranges[0].getAttribute('aria-valuetext'), /0\.40× simulation speed/);
});

t('menu: phone → bottom sheet, desktop → popover; open/close bookkeeping', () => {
  for (const [w, h, mode] of [[412, 915, 'sheet'], [844, 390, 'sheet'], [1280, 800, 'popover']]) {
    const { doc } = makeDoc(w, h);
    const toggles = [];
    const m = C.createMenu({ doc, host: doc.body, onToggle: (o) => toggles.push(o) });
    const anchor = doc.createElement('button'); doc.body.appendChild(anchor);
    assert.equal(m.root.hidden, true); assert.equal(m.isOpen, false);
    m.open(anchor);
    assert.equal(m.isOpen, true); assert.equal(m.root.hidden, false);
    assert.equal(m.root.getAttribute('data-mode'), mode, `${w}x${h}`);
    assert.ok(m.root.classList.contains('is-open'));
    if (mode === 'popover') assert.match(m.root.style.left, /px$/);
    assert.equal(doc.activeElement.tagName, 'INPUT', 'focus moves into the menu');
    m.root.fire('keydown', { key: 'Escape' });
    assert.equal(m.isOpen, false); assert.equal(m.root.hidden, true);
    assert.equal(doc.activeElement, anchor, 'focus returns to the ⋯ button');
    assert.deepEqual(toggles, [true, false]);
    m.toggle(anchor); assert.equal(m.isOpen, true); m.toggle(anchor); assert.equal(m.isOpen, false);
  }
});

t('menu: rows a module cannot use are hidden, not removed; setHidden() changes them at run time and focus skips them', () => {
  const { doc } = makeDoc();
  const m = C.createMenu({ doc, host: doc.body, hide: ['density', 'wireframe', 'xray'] });
  const sw = (k) => m.root.all((c) => c.getAttribute('data-key') === k)[0];
  const dens = () => m.root.all((c) => c.getAttribute('role') === 'radiogroup')[0].parentElement;
  assert.ok(sw('wireframe') && sw('xray') && dens(), 'rows exist so they can come back');
  assert.equal(sw('wireframe').hidden, true); assert.equal(sw('xray').hidden, true); assert.equal(dens().hidden, true);
  assert.equal(sw('theme').hidden, false, 'the theme row is always there');
  assert.equal(m.isHidden('xray'), true); assert.equal(m.isHidden('theme'), false);
  m.open();
  m.root.fire('keydown', { key: 'Tab', shiftKey: true });                 /* from the first control to the last one that can take focus */
  assert.equal(doc.activeElement, sw('theme'), 'the focus trap ends at the theme switch, not in a hidden row');
  m.close();
  m.setHidden([]);
  assert.equal(sw('wireframe').hidden, false); assert.equal(sw('xray').hidden, false); assert.equal(dens().hidden, false);
  m.setHidden(['xray']);
  assert.equal(sw('xray').hidden, true); assert.equal(sw('wireframe').hidden, false);
});

t('menu is a single node: host receives exactly one backdrop + one dialog', () => {
  const { doc } = makeDoc();
  C.createMenu({ doc, host: doc.body });
  assert.equal(doc.body.children.length, 2);
  assert.equal(doc.body.all((c) => c.getAttribute('role') === 'dialog').length, 1);
});

console.log(`\n${n} test groups passed`);
