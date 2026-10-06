/* Phase 9b: options grid + "More" sheet. Pure helpers, CSS rules, and (when jsdom is available) the sheet's DOM behaviour. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { splitOptionCells, segGrid, heroPlan, scrollHint } from '../dock.js';

const rd = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log('ok  ', name); };
const css = rd('controls.css');
const block = css.slice(css.indexOf('PHASE 9b'), css.indexOf('PHASE 9c'));
const nine_c = css.slice(css.indexOf('PHASE 9c'));
const rules = (src) => [...src.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));

await t('splitOptionCells: 0, 3, 4 cells all stay; 5 → 3 + 2; 10 → 3 + 7; order kept, nothing lost', () => {
  const mk = (k) => Array.from({ length: k }, (_, i) => 'c' + i);
  assert.deepEqual(splitOptionCells(mk(0)), { shown: [], more: [] });
  assert.deepEqual(splitOptionCells(mk(3)), { shown: mk(3), more: [] });
  assert.deepEqual(splitOptionCells(mk(4)), { shown: mk(4), more: [] });
  const five = splitOptionCells(mk(5));
  assert.deepEqual(five.shown, ['c0', 'c1', 'c2']); assert.deepEqual(five.more, ['c3', 'c4']);
  const ten = splitOptionCells(mk(10));
  assert.equal(ten.shown.length, 3); assert.equal(ten.more.length, 7);
  assert.deepEqual([...ten.shown, ...ten.more], mk(10));
  assert.deepEqual(splitOptionCells(null), { shown: [], more: [] });
  assert.equal(splitOptionCells(mk(6), 6).more.length, 0);
});
await t('segGrid: ≤ 4 items stay one row; more wrap into balanced rows and the last button fills the row', () => {
  assert.deepEqual(segGrid(3), { cols: 3, span: 1 });
  assert.deepEqual(segGrid(4), { cols: 4, span: 1 });
  assert.deepEqual(segGrid(5), { cols: 3, span: 2 });
  assert.deepEqual(segGrid(6), { cols: 3, span: 1 });
  assert.deepEqual(segGrid(7), { cols: 4, span: 2 });
  assert.deepEqual(segGrid(8), { cols: 4, span: 1 });
});
await t('CSS: no portrait options rule scrolls sideways or uses nowrap', () => {
  for (const { sel, body } of rules(css)) {
    if (!/data-mode="portrait"\][^,]*\.al-dock-options|\.al-more-grid/.test(sel) && !/^\.al-dock-options\b/.test(sel)) continue;
    if (/:not\(\[data-mode="portrait"\]\)/.test(sel)) continue;
    assert.doesNotMatch(body, /overflow-x:\s*auto/, `overflow-x: auto in "${sel}"`);
    assert.doesNotMatch(body, /flex-wrap:\s*nowrap/, `nowrap in "${sel}"`);
  }
  assert.doesNotMatch(block, /flex-wrap:\s*nowrap/);
  assert.match(css, /\.al-dock\[data-mode="portrait"\] \.al-dock-options \{[^}]*overflow-x: hidden; overflow-y: auto/);
  assert.match(block, /flex-wrap: wrap/);
});
await t('CSS: the More sheet and its scrim use a scale z-index; tokens only; tiers paint only', () => {
  for (const m of block.matchAll(/z-index:\s*([^;}]+)[;}]/g)) assert.match(m[1], /^var\(--z-(menu|dock)\)$/);
  assert.match(block, /\.al-more \{[^}]*z-index: var\(--z-menu\)/);
  assert.doesNotMatch(block, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  for (const { sel, body } of rules(block)) {
    if (!/data-ui-tier/.test(sel)) continue;
    assert.doesNotMatch(body, /\b(width|height|min-height|min-width|padding|margin|flex|display|grid)[-\w]*:/, `tier rule changes layout: ${sel}`);
  }
  assert.doesNotMatch(block, /@keyframes|animation:|transition:/);
});
await t('CSS: every chip / control in the grid is ≥ 44 px (var(--ctl-tap)); labels are ≥ 11 px', () => {
  assert.match(css, /--ctl-tap:\s*44px/); assert.match(css, /--ctl-text:\s*11px/);
  const chip = rules(block).find((r) => /\.al-dock-more/.test(r.sel) && /min-height/.test(r.body));
  assert.ok(chip); assert.match(chip.body, /min-height:\s*var\(--ctl-tap\)/); assert.match(chip.body, /min-width:\s*var\(--ctl-tap\)/);
  assert.match(block, /\.ctl-seg-btn \{[^}]*min-height: var\(--ctl-tap\)/);
  assert.match(block, /\.ctl-choice > \.ctl-label \{[^}]*font-size: var\(--ctl-text\)[^}]*color: var\(--text-mute\)/);
  assert.doesNotMatch(css, /ctl-(seg-btn|switch|action-btn|select)\s*\{\s*min-height:\s*40px/);
});
await t('CSS: landscape rails, the wide rail and the desktop bar hide the chip and keep their own layout; dock.js has no tier logic in layout', () => {
  assert.match(block, /data-mode="landscape"\] \.al-dock-more, \.al-dock\[data-mode="desktop"\] \.al-dock-more, \.al-dock\[data-mode="wide"\] \.al-dock-more \{ display: none; \}/);
  assert.match(block, /data-mode="wide"\]\[data-has-options="false"\] \.al-dock-options \{ display: none; \}/);
  assert.match(block, /\.al-dock\[data-mode="wide"\] \.al-dock-options > \[data-cell="choice"\] \{ flex-basis: 100%; \}/);
  assert.match(css, /\.al-dock\[data-mode="landscape"\] \.al-dock-options \{[^}]*flex-direction: column/);
  const dock = rd('dock.js');
  assert.match(dock, /export function splitOptionCells/);
  assert.match(dock, /aria-expanded/); assert.match(dock, /role: 'dialog'/); assert.match(dock, /'aria-label': 'More options'/);
});

await t('heroPlan: 1–2 compact controls and ≤ 1 wide one → hero layout; compact ones are numbered left to right', () => {
  assert.equal(heroPlan(['compact']).hero, true);
  assert.equal(heroPlan(['compact', 'compact']).hero, true);
  assert.equal(heroPlan(['wide', 'compact']).hero, true);
  assert.deepEqual(heroPlan(['wide', 'compact', 'compact']).order.map((o) => o.heroIndex), [-1, 0, 1]);
  assert.equal(heroPlan(['wide']).hero, false);
  assert.equal(heroPlan(['wide', 'wide']).hero, false);
  assert.equal(heroPlan(['compact', 'wide', 'wide']).hero, false);
  assert.equal(heroPlan(['compact', 'compact', 'compact']).hero, false);
  assert.equal(heroPlan([]).hero, false); assert.equal(heroPlan(null).hero, false);
});
await t('CSS hero layout: portrait only, not slim; pedals stand up; options on the right; no sideways scroll; tokens only', () => {
  const hero = css.slice(css.indexOf('hero layout (phone portrait'));
  assert.match(hero, /\[data-hero="1"\]:not\(\[data-state="slim"\]\) \{\s*grid-template-columns: auto auto auto minmax\(0, 1fr\)/);
  assert.match(hero, /> \.al-dock-options \{[^}]*grid-row: 3; grid-column: 4; display: flex/);
  assert.match(hero, /\.ctl-pedal-pad \{[^}]*width: var\(--ctl-pad-w\)[^}]*min-height: 64px/);
  assert.match(hero, /\.ctl-pedal-fill \{[^}]*bottom: 0[^}]*height: calc\(var\(--p\) \* 100%\)/);
  assert.match(hero, /scrollbar-width: none; overflow: visible/);
  assert.doesNotMatch(hero, /overflow-x:\s*auto|nowrap|#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  for (const m of hero.matchAll(/\.al-dock\[[^{]*\{/g)) assert.match(m[0], /data-mode="portrait"|data-hero="1"/);
  assert.match(css, /--dock-primary-min: 120px/);
});

await t('scrollHint: fades only on the side that has more content', () => {
  assert.deepEqual(scrollHint(0, 100, 100), { top: false, bottom: false });
  assert.deepEqual(scrollHint(0, 100, 220), { top: false, bottom: true });
  assert.deepEqual(scrollHint(60, 100, 220), { top: true, bottom: true });
  assert.deepEqual(scrollHint(120, 100, 220), { top: true, bottom: false });
  assert.deepEqual(scrollHint(1, 100, 101), { top: false, bottom: false });   /* rounding slack */
  assert.deepEqual(scrollHint(undefined, 0, 0), { top: false, bottom: false });
});
await t('CSS 9c: tokens only; motion only under prefers-reduced-motion: no-preference; glow only in the high tier; low tier never animates', () => {
  assert.doesNotMatch(nine_c, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  const motionAt = (re) => [...nine_c.matchAll(re)].map((m) => m.index);
  const open = nine_c.indexOf('@media (prefers-reduced-motion: no-preference)');
  assert.ok(open > 0);
  for (const i of motionAt(/transition:|animation:|@keyframes/g)) assert.ok(i > open, 'motion outside the no-preference block');
  for (const m of nine_c.matchAll(/filter:\s*drop-shadow[^;]*;/g)) {
    const sel = nine_c.slice(nine_c.lastIndexOf('\n', nine_c.lastIndexOf('{', m.index)), m.index);
    assert.match(sel, /data-ui-tier="high"/);
  }
  assert.match(nine_c, /html\[data-ui-tier="low"\] \.al-more:not\(\[hidden\]\) \.al-more-sheet,[\s\S]*animation: none/);
  for (const { sel, body } of rules(nine_c)) if (/data-ui-tier/.test(sel)) assert.doesNotMatch(body, /\b(width|height|padding|margin|flex|display|grid)[-\w]*:/, sel);
});
await t('CSS 9c: edge fades use the scale tokens and cover portrait, wide and the sheet; pressed chips shrink a little', () => {
  assert.match(nine_c, /data-fade-b="1"\]:not\(\[data-fade-t="1"\]\)/);
  assert.match(nine_c, /\.al-more-sheet\[data-fade-t="1"\]\[data-fade-b="1"\]/);
  assert.match(nine_c, /:active[^{]*\{ transform: scale\(\.96\); \}/);
});

/* ── DOM (needs jsdom: set JSDOM_PATH to a dir that has it) ── */
let JSDOM = null;
try { const req = createRequire(process.env.JSDOM_PATH ? pathToFileURL(path.join(process.env.JSDOM_PATH, 'x.js')) : import.meta.url); JSDOM = req('jsdom').JSDOM; } catch (_) { /* optional */ }
if (!JSDOM) console.log('skip  options DOM tests (jsdom not available; set JSDOM_PATH to a dir with jsdom installed)');
else {
  const { createDock } = await import('../dock.js');
  const setup = (w, hgt, count) => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
    const win = dom.window; const doc = win.document;
    Object.defineProperty(win, 'innerWidth', { value: w, configurable: true });
    Object.defineProperty(win, 'innerHeight', { value: hgt, configurable: true });
    const dock = createDock({ doc, win, moduleId: 'x', storage: null });
    for (let i = 0; i < count; i++) {
      const el = doc.createElement('div'); el.className = 'ctl ctl-toggle'; el.id = 'o' + i;
      el.innerHTML = '<button type="button" class="ctl-switch" role="switch" aria-checked="false">T' + i + '</button>';
      dock.addOption(el);
    }
    return { win, doc, dock };
  };
  await t('DOM: portrait with 6 options → 3 in the zone, 3 in the sheet, chip visible; order is kept', () => {
    const { doc, dock } = setup(390, 780, 6);
    assert.equal(dock.moreBtn.hidden, false);
    assert.deepEqual([...dock.flow.children].map((e) => e.id), ['o0', 'o1', 'o2']);
    assert.deepEqual([...dock.moreSheet.querySelectorAll('.al-more-grid > .ctl')].map((e) => e.id), ['o3', 'o4', 'o5']);
    assert.equal(dock.moreBtn.getAttribute('aria-expanded'), 'false');
    assert.equal(dock.moreSheet.getAttribute('role'), 'dialog');
    assert.ok(dock.moreSheet.getAttribute('aria-label'));
    assert.ok(doc.querySelector('.al-more').hidden);
  });
  await t('DOM: 4 options → no chip; landscape and desktop keep every cell inline', () => {
    assert.equal(setup(390, 780, 4).dock.moreBtn.hidden, true);
    for (const [w, h] of [[800, 360], [900, 800], [1280, 800], [1920, 1080]]) {
      const { dock } = setup(w, h, 6);
      assert.equal(dock.moreBtn.hidden, true); assert.equal(dock.flow.children.length, 6);
    }
  });
  await t('DOM: rotating portrait → landscape → portrait returns the cells and splits again', () => {
    const { win, dock } = setup(390, 780, 6);
    Object.defineProperty(win, 'innerWidth', { value: 800, configurable: true }); Object.defineProperty(win, 'innerHeight', { value: 360, configurable: true });
    dock.refresh(); assert.equal(dock.flow.children.length, 6);
    Object.defineProperty(win, 'innerWidth', { value: 390, configurable: true }); Object.defineProperty(win, 'innerHeight', { value: 780, configurable: true });
    dock.refresh(); assert.equal(dock.flow.children.length, 3);
  });
  await t('DOM: chip opens the sheet (aria-expanded, focus inside), Esc closes and returns focus to the chip', () => {
    const { doc, dock } = setup(390, 780, 6);
    dock.moreBtn.focus(); dock.moreBtn.click();
    assert.equal(dock.moreBtn.getAttribute('aria-expanded'), 'true');
    assert.equal(doc.querySelector('.al-more').hidden, false);
    assert.ok(dock.moreSheet.contains(doc.activeElement));
    dock.moreSheet.dispatchEvent(new doc.defaultView.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(doc.querySelector('.al-more').hidden, true);
    assert.equal(dock.moreBtn.getAttribute('aria-expanded'), 'false');
    assert.equal(doc.activeElement, dock.moreBtn);
  });
  await t('DOM: scrim tap closes; Tab wraps inside the sheet (focus trap)', () => {
    const { doc, dock } = setup(390, 780, 6);
    dock.openMore();
    const f = [...dock.moreSheet.querySelectorAll('button')].filter((b) => b.tabIndex >= 0);
    f[f.length - 1].focus();
    const ev = new doc.defaultView.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    f[f.length - 1].dispatchEvent(ev);
    assert.ok(ev.defaultPrevented); assert.equal(doc.activeElement, f[0]);
    const back = new doc.defaultView.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    f[0].dispatchEvent(back); assert.equal(doc.activeElement, f[f.length - 1]);
    doc.querySelector('.al-more-scrim').click();
    assert.equal(dock.isMoreOpen(), false);
  });
  await t('DOM: a choice with 7 segments becomes a 4-column grid whose last button fills the row', () => {
    const { doc, dock } = setup(390, 780, 0);
    const el = doc.createElement('div'); el.className = 'ctl ctl-choice';
    el.innerHTML = '<span class="ctl-label">Mode</span><div class="ctl-seg">' + Array.from({ length: 7 }, (_, i) => '<button class="ctl-seg-btn">' + i + '</button>').join('') + '</div>';
    dock.addOption(el);
    const seg = el.querySelector('.ctl-seg'), b = seg.querySelectorAll('.ctl-seg-btn');
    assert.equal(seg.dataset.many, '1'); assert.match(seg.style.gridTemplateColumns, /repeat\(4,/);
    assert.equal(b[6].style.gridColumn, 'span 2'); assert.equal(el.dataset.span, 'full');
  });
  await t('DOM: a dial in portrait turns the hero layout on and its slot is flagged; a lone slider does not', () => {
    const { doc, dock } = setup(390, 780, 2);
    const mk = (cls) => { const w = doc.createElement('div'); w.innerHTML = '<div class="ctl ' + cls + '"></div>'; return w; };
    dock.addPrimary({ id: 'ax-crank', side: 'right', node: mk('ctl-dial') });
    assert.equal(dock.root.dataset.hero, '1');
    const slot = dock.root.querySelector('[data-slot="ax-crank"]');
    assert.equal(slot.dataset.kind, 'compact'); assert.equal(slot.dataset.heroI, '0');
    dock.addPrimary({ id: 'ax-rpm', side: 'left', node: mk('ctl-axis') });
    assert.equal(dock.root.dataset.hero, '1');
    assert.equal(dock.root.querySelector('[data-slot="ax-rpm"]').dataset.kind, 'wide');
    dock.addPrimary({ id: 'ax-load', side: 'left', node: mk('ctl-axis') });
    assert.equal(dock.root.dataset.hero, '0');
    const only = setup(390, 780, 0); only.dock.addPrimary({ id: 'ax-a', side: 'left', node: mk('ctl-axis') });
    assert.equal(only.dock.root.dataset.hero, '0');
    const land = setup(800, 360, 0); land.dock.addPrimary({ id: 'ax-c', side: 'right', node: mk('ctl-dial') });
    assert.equal(land.dock.root.dataset.hero, '0');
  });
}
console.log(`\n${n} options tests passed`);
