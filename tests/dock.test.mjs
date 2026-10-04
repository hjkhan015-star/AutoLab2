// node tests/dock.test.mjs  (no dependencies) — Phase 2: dock logic, dock DOM (fake document), layout guards
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  DOCK, STATES, layoutMode, swipeDirection, nextState, tapState, dockHeightPx, dockLayout,
  assignSlots, clampPage, pageFromScroll, dockStorageKey, serializeDock, parseDock,
  keyboardOpen, modelShiftPx, createDock
} from '../dock.js';

const rd = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  ', name); };

/* ── layout mode ── */
t('phone = max-width 720 OR max-height 540; landscape phone when wider than tall', () => {
  assert.equal(layoutMode(360, 640), 'portrait');
  assert.equal(layoutMode(720, 1000), 'portrait');
  assert.equal(layoutMode(721, 1000), 'desktop');
  assert.equal(layoutMode(1280, 540), 'landscape');     /* short desktop window counts as a phone (R2) */
  assert.equal(layoutMode(1280, 541), 'desktop');
  assert.equal(layoutMode(844, 390), 'landscape');
  assert.equal(layoutMode(412, 915), 'portrait');
});

/* ── state machine ── */
t('dock: swipe up reveals options, swipe down folds to the slim bar; ends stay put', () => {
  assert.deepEqual(STATES, ['slim', 'default', 'options']);
  assert.equal(nextState('default', 'up'), 'options');
  assert.equal(nextState('options', 'up'), 'options');
  assert.equal(nextState('slim', 'up'), 'default');
  assert.equal(nextState('default', 'down'), 'slim');
  assert.equal(nextState('options', 'down'), 'default');
  assert.equal(nextState('slim', 'down'), 'slim');
  assert.equal(nextState('bogus', 'up'), 'options', 'unknown state counts as default');
  assert.equal(nextState('default', null), 'default');
});
t('dock: with no options row content, "up" from default does nothing', () => {
  assert.equal(nextState('default', 'up', { hasOptions: false }), 'default');
  assert.equal(nextState('slim', 'up', { hasOptions: false }), 'default');
});
t('dock: swipe gesture threshold + tap cycle', () => {
  assert.equal(swipeDirection(-30), 'up');
  assert.equal(swipeDirection(30), 'down');
  assert.equal(swipeDirection(-DOCK.swipePx + 1), null);
  assert.equal(swipeDirection(NaN), null);
  assert.equal(tapState('slim'), 'default');
  assert.equal(tapState('default'), 'options');
  assert.equal(tapState('options'), 'default');
});

/* ── height maths ── */
t('dock height: default 24 vh, options <= 30 vh, slim 56 px — never above 34 vh', () => {
  for (const [w, h] of [[360, 640], [390, 844], [412, 915], [320, 568], [430, 932]]) {
    const def = dockHeightPx('default', h, { w }), opt = dockHeightPx('options', h, { w }), slim = dockHeightPx('slim', h, { w });
    assert.equal(def, Math.round(h * 0.24), `${w}x${h} default`);
    assert.ok(opt <= Math.round(h * 0.30), `${w}x${h} options <= 30vh (${opt})`);
    assert.ok(opt >= def, 'options never smaller than default');
    assert.equal(slim, 56);
    for (const v of [def, opt]) assert.ok(v <= h * 0.34, `${w}x${h} <= 34vh`);
  }
  assert.equal(dockHeightPx('default', 640, { w: 360 }), 154);
  assert.equal(dockHeightPx('options', 640, { w: 360 }), 192);      /* capped at 30 vh */
  assert.equal(dockHeightPx('options', 915, { w: 412 }), 264);      /* 24 vh + one 44 px row */
});
t('dock height: the safe-area inset is part of the dock (slim = 56 + inset; others stay under the ceiling)', () => {
  assert.equal(dockHeightPx('slim', 844, { w: 390, safeB: 34 }), 90);
  assert.ok(dockHeightPx('options', 844, { w: 390, safeB: 34 }) <= Math.round(844 * 0.30));
});
t('dock height: landscape phone takes no height (two 140 px rails); desktop is auto', () => {
  assert.equal(dockHeightPx('default', 390, { w: 844 }), 0);
  assert.equal(dockHeightPx('default', 900, { w: 1280 }), null);
  assert.deepEqual(dockLayout('default', 844, 390), { mode: 'landscape', dockH: 0, railW: DOCK.railPx });
  assert.deepEqual(dockLayout('default', 1280, 800), { mode: 'desktop', dockH: null, railW: 0 });
  assert.equal(DOCK.railPx, 140);
});
t('the iframe subtlety: dock vh is measured from the iframe viewport (screen − 32 px header)', () => {
  const screen = 915, iframe = screen - 32;
  assert.equal(dockHeightPx('default', iframe, { w: 412 }), Math.round(iframe * 0.24));
  assert.ok(Math.abs(dockHeightPx('default', iframe, { w: 412 }) - dockHeightPx('default', screen, { w: 412 })) <= 8, 'difference is a few px');
});

/* ── slot / page assignment ── */
const ids = (pg) => pg.map((s) => s.id + ':' + s.side).join(',');
t('slots: 0 → none · 1 → single centred · 2 → left/right · 3+ → pages of two with dots', () => {
  assert.deepEqual(assignSlots([]), { mode: 'none', pageCount: 0, pages: [] });
  const one = assignSlots([{ id: 'a' }]);
  assert.equal(one.mode, 'single'); assert.equal(ids(one.pages[0]), 'a:center');
  const two = assignSlots([{ id: 'a' }, { id: 'b' }]);
  assert.equal(two.mode, 'pair'); assert.equal(two.pageCount, 1); assert.equal(ids(two.pages[0]), 'a:left,b:right');
  const three = assignSlots([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  assert.equal(three.mode, 'pages'); assert.equal(three.pageCount, 2);
  assert.equal(ids(three.pages[0]), 'a:left,b:right'); assert.equal(ids(three.pages[1]), 'c:center');
  const five = assignSlots(['a', 'b', 'c', 'd', 'e'].map((id) => ({ id })));
  assert.equal(five.pageCount, 3); assert.equal(ids(five.pages[2]), 'e:center');
});
t('slots: bl/br preferences are honoured for a pair, order kept otherwise', () => {
  assert.equal(ids(assignSlots([{ id: 'br', side: 'right' }, { id: 'bl', side: 'left' }]).pages[0]), 'bl:left,br:right');
  assert.equal(ids(assignSlots([{ id: 'br', side: 'right' }, { id: 'x', side: 'left' }]).pages[0]), 'x:left,br:right');
  assert.equal(ids(assignSlots([{ id: 'p' }, { id: 'q' }]).pages[0]), 'p:left,q:right');
});
t('pages: clamp + scroll-snap position → page', () => {
  assert.equal(clampPage(5, 2), 1); assert.equal(clampPage(-3, 2), 0); assert.equal(clampPage('x', 3), 0); assert.equal(clampPage(1, 0), 0);
  assert.equal(pageFromScroll(0, 300, 3), 0);
  assert.equal(pageFromScroll(310, 300, 3), 1);
  assert.equal(pageFromScroll(900, 300, 3), 2);
  assert.equal(pageFromScroll(100, 0, 3), 0);
});

/* ── persistence ── */
t('persistence: key per module, round-trip, garbage-proof', () => {
  assert.equal(dockStorageKey('engine'), 'autolab.dock.engine');
  assert.notEqual(dockStorageKey('engine'), dockStorageKey('mpfi'));
  assert.deepEqual(parseDock(serializeDock({ state: 'slim', page: 1 }), 3), { state: 'slim', page: 1 });
  assert.deepEqual(parseDock(serializeDock({ state: 'options', page: 9 }), 2), { state: 'options', page: 1 }, 'page clamped');
  for (const bad of [null, undefined, '', '{', '[]', '{"state":"weird"}', 42]) assert.deepEqual(parseDock(bad), { state: 'default', page: 0 });
  assert.equal(JSON.parse(serializeDock({ state: 'nope', page: 0 })).state, 'default');
});

/* ── soft keyboard ── */
t('keyboard: hide the dock only when a <select> is focused AND the visual viewport shrank', () => {
  assert.equal(keyboardOpen({ layoutH: 800, visualH: 500, activeTag: 'SELECT' }), true);
  assert.equal(keyboardOpen({ layoutH: 800, visualH: 500, activeTag: 'select' }), true);
  assert.equal(keyboardOpen({ layoutH: 800, visualH: 500, activeTag: 'BUTTON' }), false);
  assert.equal(keyboardOpen({ layoutH: 800, visualH: 760, activeTag: 'SELECT' }), false, 'small browser-chrome shrink is not a keyboard');
  assert.equal(keyboardOpen({ layoutH: 800, visualH: 800 - DOCK.kbdDeltaPx, activeTag: 'SELECT' }), true);
  assert.equal(keyboardOpen({ layoutH: 0, visualH: 0, activeTag: 'SELECT' }), false);
  assert.equal(keyboardOpen({ layoutH: 800, visualH: 500 }), false);
});

/* ── model placement ── */
t('model placement: nudged up on portrait phones only', () => {
  assert.equal(modelShiftPx(390, 600, 390, 844), 30);
  assert.equal(modelShiftPx(600, 250, 844, 390), 0);
  assert.equal(modelShiftPx(1000, 700, 1280, 800), 0);
  assert.equal(modelShiftPx(0, 0, 390, 844), 0);
});

/* ═══ dock DOM, against a tiny fake document ═══ */
class El {
  constructor(tag) { this.tagName = String(tag).toUpperCase(); this.children = []; this.attrs = {}; this.dataset = {}; this.listeners = {}; this.className = ''; this.hidden = false; this.parentNode = null; this.style = { props: {}, setProperty(k, v) { this.props[k] = v; } }; this.clientWidth = 300; this.scrollLeft = 0; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = String(v); if (k === 'class') this.className = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
  append(...cs) { cs.forEach((c) => this.appendChild(c)); }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; }
  set textContent(v) { this.children.forEach((c) => { c.parentNode = null; }); this.children = []; this._text = v; }
  get childElementCount() { return this.children.length; }
  addEventListener(ty, fn) { (this.listeners[ty] = this.listeners[ty] || []).push(fn); }
  fire(ty, ev = {}) { (this.listeners[ty] || []).forEach((f) => f(Object.assign({ preventDefault() {} }, ev))); }
  getBoundingClientRect() { return { height: 100, top: 0, left: 0, width: 300 }; }
  scrollTo({ left }) { this.scrollLeft = left; }
  setPointerCapture() {}
  all(pred, out = []) { this.children.forEach((c) => { if (pred(c)) out.push(c); c.all(pred, out); }); return out; }
  byClass(cn) { return this.all((e) => (' ' + e.className + ' ').includes(' ' + cn + ' ')); }
}
function fakeEnv({ w = 390, h = 844, store = {} } = {}) {
  const doc = {
    createElement: (tag) => new El(tag), documentElement: new El('html'), body: new El('body'), activeElement: null,
    listeners: {}, addEventListener(ty, fn) { (this.listeners[ty] = this.listeners[ty] || []).push(fn); }
  };
  const vvL = {};
  const win = {
    innerWidth: w, innerHeight: h, listeners: {},
    addEventListener(ty, fn) { (this.listeners[ty] = this.listeners[ty] || []).push(fn); },
    getComputedStyle: () => ({ getPropertyValue: () => '0', bottom: '0' }),
    requestAnimationFrame: (f) => f(),
    visualViewport: { height: h, addEventListener: (ty, fn) => { vvL[ty] = fn; } },
    sessionStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } }
  };
  return { doc, win, store, vvL };
}
const mkBtn = (doc, id) => { const b = doc.createElement('button'); b.setAttribute('id', id); return b; };

t('dock DOM: transport holds exactly one play + one reset; primary pair → left/right', () => {
  const { doc, win } = fakeEnv();
  const dock = createDock({ doc, win, moduleId: 'm' });
  dock.addTransport(mkBtn(doc, 'btn-play')); dock.addTransport(mkBtn(doc, 'btn-reset'));
  dock.addPrimary({ id: 'bl', side: 'left', node: doc.createElement('div') });
  dock.addPrimary({ id: 'br', side: 'right', node: doc.createElement('div') });
  const all = dock.root.all(() => true);
  assert.equal(all.filter((e) => e.id === 'btn-play').length, 1);
  assert.equal(all.filter((e) => e.id === 'btn-reset').length, 1);
  assert.equal(dock.getLayout().mode, 'pair');
  assert.deepEqual(dock.root.byClass('al-dock-slot').map((e) => e.dataset ? e.getAttribute('data-side') : ''), ['left', 'right']);
  assert.equal(dock.root.dataset.mode, 'portrait');
  assert.equal(doc.documentElement.style.props['--dock-h'], '203px', '24 vh of 844');
  assert.equal(doc.body.children.includes(dock.root), true, 'mounted once in <body>');
});
t('dock DOM: 3 controls → 2 pages + dots; re-adding a control id does not duplicate it', () => {
  const { doc, win } = fakeEnv();
  const dock = createDock({ doc, win, moduleId: 'm' });
  ['a', 'b', 'c'].forEach((id) => dock.addPrimary({ id, node: doc.createElement('div') }));
  assert.equal(dock.getLayout().pageCount, 2);
  assert.equal(dock.root.byClass('al-dock-dot').length, 2);
  assert.equal(dock.primary.children[1].hidden, false, 'dots visible');
  dock.addPrimary({ id: 'c', node: doc.createElement('div') });
  assert.equal(dock.root.byClass('al-dock-slot').length, 3);
});
t('dock DOM: swipe up / down on the handle + persistence per module (sessionStorage)', () => {
  const { doc, win, store } = fakeEnv();
  const dock = createDock({ doc, win, moduleId: 'engine' });
  dock.extras.appendChild(doc.createElement('button'));               /* something to reveal */
  dock.handle.fire('pointerdown', { clientY: 500, pointerId: 1 });
  dock.handle.fire('pointerup', { clientY: 440 });
  assert.equal(dock.getState(), 'options');
  assert.equal(doc.documentElement.style.props['--dock-h'], Math.min(Math.round(844 * .30), Math.round(844 * .24) + 44) + 'px');
  dock.handle.fire('pointerdown', { clientY: 400, pointerId: 1 });
  dock.handle.fire('pointerup', { clientY: 470 });
  dock.handle.fire('pointerdown', { clientY: 400, pointerId: 1 });
  dock.handle.fire('pointerup', { clientY: 470 });
  assert.equal(dock.getState(), 'slim');
  assert.equal(doc.documentElement.style.props['--dock-h'], '56px');
  assert.deepEqual(Object.keys(store), ['autolab.dock.engine']);
  const again = fakeEnv({ store });                                   /* reload: same module restores … */
  assert.equal(createDock({ doc: again.doc, win: again.win, moduleId: 'engine' }).getState(), 'slim');
  const other = fakeEnv({ store });                                   /* … another module does not */
  assert.equal(createDock({ doc: other.doc, win: other.win, moduleId: 'mpfi' }).getState(), 'default');
});
t('dock DOM: page index is saved and restored', () => {
  const { doc, win, store } = fakeEnv();
  const dock = createDock({ doc, win, moduleId: 'p' });
  ['a', 'b', 'c'].forEach((id) => dock.addPrimary({ id, node: doc.createElement('div') }));
  dock.setPage(1, true);
  assert.equal(JSON.parse(store['autolab.dock.p']).page, 1);
  const e2 = fakeEnv({ store });
  const d2 = createDock({ doc: e2.doc, win: e2.win, moduleId: 'p' });
  ['a', 'b', 'c'].forEach((id) => d2.addPrimary({ id, node: e2.doc.createElement('div') }));
  assert.equal(d2.getPage(), 1);
});
t('dock DOM: an open <select> keyboard hides the dock (and it comes back)', () => {
  const { doc, win, vvL } = fakeEnv();
  const dock = createDock({ doc, win, moduleId: 'k' });
  doc.activeElement = { tagName: 'SELECT' };
  win.visualViewport.height = 500; vvL.resize();
  assert.equal(dock.root.hidden, true);
  assert.equal(doc.documentElement.style.props['--dock-h'], '0px');
  win.visualViewport.height = 844; doc.activeElement = { tagName: 'BODY' }; vvL.resize();
  assert.equal(dock.root.hidden, false);
  assert.equal(doc.documentElement.style.props['--dock-h'], '203px');
});
t('dock DOM: landscape phone → rails (no bottom height), desktop → measured bar', () => {
  const l = fakeEnv({ w: 844, h: 390 });
  const dl = createDock({ doc: l.doc, win: l.win, moduleId: 'l' });
  assert.equal(dl.root.dataset.mode, 'landscape');
  assert.equal(l.doc.documentElement.style.props['--dock-h'], '0px');
  assert.equal(l.doc.documentElement.style.props['--dock-rail'], '140px');
  const d = fakeEnv({ w: 1280, h: 800 });
  const dd = createDock({ doc: d.doc, win: d.win, moduleId: 'd' });
  assert.equal(dd.root.dataset.mode, 'desktop');
  assert.equal(d.doc.documentElement.style.props['--dock-h'], '100px', 'auto height is measured, not computed');
});

/* ═══ source / CSS guards ═══ */
const kit = strip(rd('kit.js')), ctl = strip(rd('controls.css')), app = strip(rd('app.css'));

t('one node each: kit builds btn-play / btn-reset exactly once, in BOTH modes (no !embedded guard)', () => {
  for (const id of ['btn-play', 'btn-reset']) {
    const hits = kit.split('\n').filter((l) => l.includes(`id="${id}"`));
    assert.equal(hits.length, 1, `${id} built ${hits.length}×`);
    assert.ok(!/embedded/.test(hits[0]), `${id} must not depend on embedded`);
  }
  assert.equal(kit.split('\n').filter((l) => l.includes('id="chk-gas"')).length, 1, 'Flow built once (options row)');
  assert.match(kit, /dock\.addOption\(flow\)/);
  assert.ok(!/id="btn-home"/.test(kit), 'standalone Back button removed from the toolbar');
  assert.ok(!/id="btn-density"/.test(kit) && !/id="speed"/.test(kit), 'density button + sim-speed slider live in the ⋯ menu only');
  assert.ok(!/_ensureSlot\('(bl|br|bc)'\)/.test(kit), 'bl / br / bc slots are gone');
});
t('UI.create still accepts widgets:{bl,br}, toolbar and extras, mounted inside the dock', () => {
  assert.match(kit, /\[\['bl', 'left'\], \['br', 'right'\]\]/);
  assert.match(kit, /this\._dock\.addPrimary\(\{ id: slotName, side, node: el \}\)/);
  assert.match(kit, /dock\.extras\.appendChild\(btn\)/);
  assert.match(kit, /this\._dock\.addPrimary\(\{ id: 'ax-' \+ spec\.id/, 'Phase 3: axes go to the primary zone');
  assert.match(kit, /id="toolbar-extras"|toolbar-extras/.test(rd('dock.js')) ? /./ : /toolbar-extras/);
  assert.match(rd('dock.js'), /id: 'toolbar-extras'/, 'modules that append to #toolbar-extras keep working');
});
t('stage: canvas-wrap inset is var(--stage-top): 0 when embedded, --hdr-h when standalone (28 px landscape)', () => {
  assert.match(ctl, /--stage-top: calc\(var\(--hdr-h\) \+ var\(--safe-t, 0px\)\)/);
  assert.match(ctl, /max-height: 540px\) \{ :root \{ --stage-top: calc\(var\(--hdr-h-land\)/);
  assert.match(ctl, /body\.embedded \{ --stage-top: 0px; \}/);
  assert.match(ctl, /#canvas-wrap \{ inset: var\(--stage-top\) var\(--dock-rail\) var\(--dock-h\) var\(--dock-rail\); \}/);
  assert.match(ctl, /#labels-root \{[^}]*inset: var\(--stage-top\) var\(--dock-rail\) var\(--dock-h\) var\(--dock-rail\);[^}]*overflow: hidden/, 'labels clipped to the stage');
});
t('stage: tokens keep --dock-default 24vh / --dock-max 30vh; the dock never exceeds --dock-max', () => {
  assert.match(ctl, /--dock-default: 24vh;/); assert.match(ctl, /--dock-max: 30vh;/);
  assert.match(ctl, /\.al-dock\[data-mode="portrait"\] \{[^}]*height: var\(--dock-h\);[^}]*max-height: var\(--dock-max\)/);
});
t('phone media queries all use max-width:720px / max-height:540px (R2)', () => {
  for (const m of ctl.matchAll(/@media\s*\(([^)]*)\)(?:\s*,\s*\(([^)]*)\))?/g)) {
    const q = m[0];
    if (/prefers-reduced|min-width: 721px|min-aspect/.test(q) && !/max-/.test(q)) continue;
    assert.ok(/max-width: 720px|max-height: 540px|min-width: 721px/.test(q), `unexpected breakpoint: ${q}`);
  }
});
t('info: bottom sheet <= 50 vh on phones, closed by default; desktop keeps the side panel', () => {
  assert.match(ctl, /\.ui-panel \{[^}]*position: fixed;[^}]*max-height: 50vh; max-height: 50dvh;/);
  assert.match(ctl, /\.ui-panel \{[^}]*transform: translateY\(105%\);[^}]*visibility: hidden/);
  assert.match(ctl, /\.ui-panel\.expanded \{ transform: translateY\(0\); visibility: visible;/);
  assert.match(kit, /const expanded = p\.expanded \?\? !isSmall;/, 'closed by default on phones');
  assert.match(kit, /toggleInfo:\s+\(\) => \{ self\.panel\.toggle\(\); \}/, 'toggleInfo opens/closes the sheet or panel');
  assert.match(kit, /onInfo: \(\) => this\.panel\.toggle\(\)/, 'standalone header ⓘ');
});
t('monitor: readout is a one-line strip on phones (28 px), unchanged card on desktop', () => {
  assert.match(ctl, /\.ui-monitor \{[^}]*height: var\(--monitor-strip-h\)/);   /* 7b3: the old .ui-chip rule is gone; the Monitor owns the strip */
  assert.match(ctl, /--monitor-strip-h: 28px/);
});
t('standalone: chrome.js header + menu, owner = module; keys D/L/W/X call menu.update()', () => {
  assert.match(kit, /createHeader\(\{/); assert.match(kit, /menu = createMenu\(\{/);
  assert.match(kit, /if \(key === 'speed'\)\s+dispatch\(\{ action: 'setSpeed'/);
  assert.match(kit, /key === 'density'\)\s+dispatch\(\{ action: 'setLabelDensity'/);
  assert.match(kit, /key === 'wireframe'\) viewManager\?\.setWireframe/);
  assert.match(kit, /syncMenu\(\);\s*\}\s*\}\s*const keyRouter/, 'handleKey ends by re-syncing the menu');
  assert.match(kit, /window\.AUTO_MODULES/, 'title + colour come from modules.js');
  assert.match(kit, /_header\.back\.click\(\)/, 'Esc goes through the header back button');
});
t('kit: a ResizeObserver on the stage re-fits the renderer (window listeners kept)', () => {
  assert.match(kit, /new ResizeObserver\(schedule\)\.observe\(wrap\)/);
  assert.match(kit, /window\.addEventListener\('resize', schedule\)/);
  assert.match(kit, /camera\.setViewOffset\(w, h, 0, dy, w, h\)/);
});
t('labels: default density Key on phones (shell + standalone); labels.js keeps a pre-chosen level', () => {
  assert.match(rd('index.html'), /density: isPhone\(window\.innerWidth, window\.innerHeight\) \? 1 : 2/);
  assert.match(kit, /_applyLevel\(phone \? 1 : 2\)/);
  assert.match(rd('labels.js'), /window\.__autolabDensity\) \? window\.__autolabDensity/);
});
t('R10: app.css + index.html use only the z-index scale; controls.css too', () => {
  for (const [name, src] of [['app.css', app], ['index.html', strip(rd('index.html'))], ['controls.css', ctl]])
    for (const m of src.matchAll(/z-index:\s*([^;}]+)[;}]/g))
      assert.match(m[1], /var\(--z-(stage|labels|monitor|dock|menu|toast|guard)\b/, `${name}: z-index "${m[1].trim()}"`);
});
t('app.css: Phase 1 leftovers gone (shell tokens, 80px/84px bottoms, bl/br offsets, LEGACY block)', () => {
  assert.ok(!/--shell-header-h|--shell-pill-h/.test(app));
  assert.ok(!/80px|84px/.test(app), 'no pill-era offsets');
  assert.ok(!/ui-slot-(bl|br|bc)/.test(app));
  assert.ok(!/:not\(\.uses-ui-kit\)/.test(app), 'legacy selectors moved out');
  assert.ok(!/100vh/.test(app));
});
t('legacy.css: exists, marked, loaded by sensors.html ONLY, precached', () => {
  assert.match(rd('legacy.css'), /Loaded ONLY by sensors\.html/);
  const users = readdirSync(new URL('../', import.meta.url)).filter((f) => f.endsWith('.html') && /legacy\.css/.test(rd(f)));
  assert.deepEqual(users, ['sensors.html']);
  assert.ok(rd('sw.js').includes("'./legacy.css'") && rd('sw.js').includes("'./dock.js'"));
  assert.match(rd('sw.js'), /const VERSION = 'autolab-v8\.[6-9](\.\d+)?'/);
});
t('100vh replaced by 100dvh in wiring.html and 404.html', () => {
  for (const f of ['wiring.html', '404.html']) { assert.ok(!/100vh/.test(rd(f)), f); assert.match(rd(f), /100dvh/); }
});
t('every module page links controls.css (dock + header styles)', () => {
  for (const f of readdirSync(new URL('../', import.meta.url)).filter((x) => x.endsWith('.html') && !['index.html', '404.html', 'sensors.html'].includes(x)))
    assert.match(rd(f), /<link rel="stylesheet" href="controls\.css">/, f);
});
t('double wiring removed: no module attaches its own click handler to #btn-play / #btn-reset', () => {
  for (const f of ['automatic', 'braking', 'carburetor', 'cooling']) {
    const s = strip(rd(f + '.html'));
    assert.ok(!/playBtn|resetBtn|btn-play|btn-reset/.test(s), `${f}.html still touches the transport buttons`);
  }
  /* Phase 6 removed the __*SyncIcons globals from migrated modules */
  assert.doesNotMatch(rd('braking.html'), /window\.__brakeSyncIcons/);
  assert.doesNotMatch(rd('carburetor.html'), /window\.__carbSyncPlayIcons/);
});
t('fixed-position audit: no module page adds a fixed element beyond the documented exceptions', () => {
  /* dock / header / monitor strip / info sheet / 3D stage live in controls.css + app.css (checked above).
     These are MODULE-LOCAL panels, listed honestly; each is a Phase 3+ item (see the Phase 2 report). */
  const allowed = { 'awd.html': 1, 'catalytic.html': 1, 'commonrail.html': 1, 'cooling.html': 6, 'differential.html': 4, 'dpf.html': 1, 'driveshaft.html': 1,
    'egr.html': 1, 'fuelpump.html': 1, 'intercooler.html': 1, 'lubrication.html': 1, 'oilpump.html': 1, 'radiator.html': 1, 'sparkplug.html': 2,
    'suspension.html': 3, 'thermostat.html': 2, 'tyres.html': 2, 'wiring.html': 4 };
  for (const f of readdirSync(new URL('../', import.meta.url)).filter((x) => x.endsWith('.html') && !['index.html', '404.html'].includes(x))) {
    const c = (rd(f).match(/position:\s*fixed/g) || []).length;
    assert.ok(c <= (allowed[f] || 0), `${f}: ${c} fixed element(s), documented: ${allowed[f] || 0}`);
  }
});

console.log(`\n${n} test groups passed`);
