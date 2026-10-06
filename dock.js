/* ═══════════════════════════════════════════════════════════════════════
   dock.js — the control dock (R2 / R6), Phase 2 skeleton.

   ONE dock per module document, embedded AND standalone:

     handle      swipe up → options row · swipe down → slim 56 px bar
     transport   play / pause · reset                 (built once, R1)
     primary     1–3 slots · 2 = left/right thumb zones · 3+ = pages + dots
     options     wrapping grid of cells, label above control, 44 px (Flow, module options);
                 portrait: > 4 cells → first 3 + a "More" chip that opens a sheet. Never a sideways scroll.

   Phone portrait   bottom sheet, default 24 vh, hard ceiling 30 vh
   Phone landscape  two side rails, 140 px each
   Wide (>= 1024)   controls in a left rail (280 px, 320 from 1600), the Monitor docked as a right column,
                    the model between them; the handle folds the left rail to a 56 px strip
   Desktop          one auto-height bar at the bottom (721 - 1023 px wide)

   The first half of this file is PURE (no DOM, no globals) and unit-tested
   in node (tests/dock.test.mjs). The DOM half is deliberately thin: it only
   applies what the pure half computes.
   ═══════════════════════════════════════════════════════════════════════ */
import { isPhone } from './chrome.js';

/* ── pure: constants ──────────────────────────────────────────────────── */
export const DOCK = Object.freeze({
  defaultVh: 24,      /* default height, % of the viewport                    */
  maxVh: 30,          /* hard ceiling                                          */
  slimPx: 56,         /* slim bar                                              */
  handlePx: 20,       /* grab handle                                           */
  optionsPx: 44,      /* options row (40–44 px chips)                          */
  railPx: 140,        /* landscape-phone side rails                            */
  wideMinPx: 1024,    /* from this width (and not a phone) the dock is a left rail */
  wideRailPx: 280,    /* wide: left control rail, and the Monitor column on the right */
  wideRailTvPx: 320,  /* wide: from tvMinPx (TV / large desktop)               */
  tvMinPx: 1600,
  kbdDeltaPx: 120,    /* visual viewport shrink that counts as "keyboard open" */
  swipePx: 24         /* minimum vertical travel that counts as a swipe        */
});

/* order = bottom → top; "up" moves toward the end of the list */
export const STATES = Object.freeze(['slim', 'default', 'options']);
export const isState = (s) => STATES.includes(s);

/* ── pure: device tier (Phase 9a) ─────────────────────────────────────────
   ONE classification for 3D quality (kit.js detectQuality) and for the dock's paint effects.
   high = full glass · mid = lighter glass · low = solid fill. Layout and tap sizes never depend on the tier. */
export const TIERS = Object.freeze(['low', 'mid', 'high']);
export const isTier = (t) => TIERS.includes(t);
/** { cores, mem, dpr, isCoarse } → 'low' | 'mid' | 'high' (the thresholds kit.js has always used). */
export function classifyDevice({ cores = 4, mem = 4, dpr = 1, isCoarse = false } = {}) {
  if (cores <= 4 || mem <= 2) return 'low';
  if (cores <= 6 || mem <= 4 || (isCoarse && dpr >= 2.5)) return 'mid';
  return 'high';
}
/** The tier the dock paints with. Priority: ?ui= override → reduced transparency (forces low) → the device. */
export function uiTier({ device = 'mid', override = null, reduceTransparency = false } = {}) {
  if (isTier(override)) return override;
  if (reduceTransparency) return 'low';
  return isTier(device) ? device : 'mid';
}
/** One step toward "cheaper" (used by the live frame-time governor). low stays low. */
export function stepDownTier(t) {
  const i = TIERS.indexOf(t);
  return i <= 0 ? 'low' : TIERS[i - 1];
}
/** Reads `?ui=low|mid|high` from a query string; anything else → null. */
export function tierOverride(search) {
  const m = /[?&]ui=([a-z]+)/i.exec(String(search || ''));
  const v = m && m[1].toLowerCase();
  return isTier(v) ? v : null;
}

/* ── pure: options grid (Phase 9b) ────────────────────────────────────────
   Phone portrait shows at most `max` option cells in the dock. Above that: the first max−1 stay, the rest go
   behind a "More" chip (a sheet). Never loses or reorders a cell. */
export function splitOptionCells(cells, max = 4) {
  const list = Array.isArray(cells) ? cells.filter((c) => c != null) : [];
  const cap = Math.max(2, Math.floor(+max) || 4);
  if (list.length <= cap) return { shown: list, more: [] };
  return { shown: list.slice(0, cap - 1), more: list.slice(cap - 1) };
}
/** Cluster layout (phone portrait). Dial, pedals and sliders stand as COLUMNS on the left (sliders are vertical, like an
 *  equalizer); the options sit in a column on the right when there is room ('side'), otherwise below, behind the swipe ('full').
 *  kinds: 'dial' | 'pedal' | 'slider' | 'other' per primary item. Anything 'other', 0 or > 4 columns → the paged layout.
 *  width = viewport width; hasOptions = the module has option cells. */
export const CLUSTER = { colPx: { dial: 100, pedal: 64, slider: 64 }, slimSliderPx: 56, gapPx: 4, chromePx: 105, minOptionsPx: 124, maxCols: 4 };
/** 3 or more sliders get slimmer columns so the options still fit beside them */
export const sliderPx = (nSliders) => (nSliders >= 3 ? CLUSTER.slimSliderPx : CLUSTER.colPx.slider);
export function dockPlan(kinds, width = 390, hasOptions = true) {
  const list = Array.isArray(kinds) ? kinds : [];
  const isCol = (k) => CLUSTER.colPx[k] > 0;
  const isCell = (k) => k === 'choice' || k === 'gate';       /* a primary choice / gear gate: it joins the option cells */
  const paged = { plan: 'paged', cols: 0, order: list.map((k) => ({ kind: k, index: -1 })) };
  if (list.some((k) => !isCol(k) && !isCell(k))) return paged;
  const cols = list.filter(isCol);
  const cellish = list.length - cols.length;
  if (cols.length > CLUSTER.maxCols) return paged;
  const anyCells = !!hasOptions || cellish > 0;
  let ci = 0;
  const order = list.map((k) => ({ kind: k, index: isCol(k) ? ci++ : -1 }));
  if (!cols.length) return anyCells ? { plan: 'opts', cols: 0, order } : paged;      /* no sliders: the options fill the dock */
  const sPx = sliderPx(cols.filter((k) => k === 'slider').length);
  const cluster = cols.reduce((a, k) => a + (k === 'slider' ? sPx : CLUSTER.colPx[k]), 0) + CLUSTER.gapPx * (cols.length - 1);
  const usable = Math.max(0, (+width || 0) - CLUSTER.chromePx);      /* 2 × dock gap + 2 × padding + transport pill + its margin */
  const side = anyCells && usable - cluster >= CLUSTER.minOptionsPx;
  if (!side && cellish) return paged;                                 /* a gear selector must never hide behind the swipe */
  return { plan: side ? 'side' : 'full', cols: cols.length, order, sliderPx: sPx };
}
/** Phase 9c: does a scrolling zone have more content above / below? (drives the soft fade at its edges) */
export function scrollHint(scrollTop, clientHeight, scrollHeight, slack = 2) {
  const top = +scrollTop || 0, view = +clientHeight || 0, total = +scrollHeight || 0;
  return { top: top > slack, bottom: view > 0 && top + view < total - slack };
}
/** Segmented control with many items → a grid of rows. { cols, span } = columns and how far the last button stretches. */
export function segGrid(n, perRow = 4) {
  const count = Math.max(0, Math.floor(+n) || 0);
  if (count <= perRow) return { cols: Math.max(1, count), span: 1 };
  const rows = Math.ceil(count / perRow);
  const cols = Math.ceil(count / rows);
  const rem = count % cols;
  return { cols, span: rem ? cols - rem + 1 : 1 };
}

/* ── pure: layout mode ────────────────────────────────────────────────── */
/** 'wide' | 'desktop' | 'portrait' | 'landscape'. Phone = max-width 720 OR max-height 540 (R2). */
export function layoutMode(w, h) {
  if (!isPhone(w, h)) return w >= DOCK.wideMinPx ? 'wide' : 'desktop';
  return w > h ? 'landscape' : 'portrait';
}

/* ── pure: gestures + state machine ───────────────────────────────────── */
/** dy = endY − startY in px (screen coordinates, so up is negative). */
export function swipeDirection(dy, min = DOCK.swipePx) {
  if (!Number.isFinite(dy)) return null;
  if (dy <= -min) return 'up';
  if (dy >= min) return 'down';
  return null;
}

/**
 * slim ⇄ default ⇄ options. Swiping past either end stays put.
 * With no options to show, "up" from default is a no-op (there is nothing to reveal).
 */
export function nextState(state, dir, { hasOptions = true } = {}) {
  const s = isState(state) ? state : 'default';
  if (dir === 'up') {
    if (s === 'slim') return 'default';
    if (s === 'default') return hasOptions ? 'options' : 'default';
    return 'options';
  }
  if (dir === 'down') {
    if (s === 'options') return 'default';
    return 'slim';
  }
  return s;
}
/** Tap on the handle: reveal more, or fold back when already at the top. */
export function tapState(state, opts) {
  return state === 'options' ? nextState(state, 'down', opts) : nextState(state, 'up', opts);
}

/* ── pure: height maths ───────────────────────────────────────────────── */
/**
 * Dock height in px for a state.
 *   portrait  : slim = 56 · default = 24 vh · options = min(default + 44, 30 vh)
 *   landscape : 0 (the dock is two side rails, so it takes no height)
 *   wide      : 0 (a left rail, so no height either)
 *   desktop   : null (auto — the DOM measures the bar)
 * The safe-area inset is part of the dock (it pads the bottom), so the 30 vh ceiling includes it.
 * `vh` is the height of THIS document's viewport — inside the shell's iframe that is the
 * screen minus the 32 px shell header (see GUIDE.md).
 */
export function dockHeightPx(state, vh, { w = 0, safeB = 0 } = {}) {
  const mode = layoutMode(w, vh);          /* w omitted → treated as a narrow (portrait) phone */
  if (mode === 'desktop') return null;
  if (mode === 'landscape' || mode === 'wide') return 0;
  const s = isState(state) ? state : 'default';
  const def = Math.round(vh * DOCK.defaultVh / 100);
  const max = Math.round(vh * DOCK.maxVh / 100);
  if (s === 'slim') return DOCK.slimPx + safeB;
  return Math.min(max, s === 'options' ? def + DOCK.optionsPx : def);
}

/** Width of the wide left rail: 56 px strip when folded (state 'slim'), 280 px, 320 px from 1600. */
export function wideRailPx(state, w) {
  if (state === 'slim') return DOCK.slimPx;
  return w >= DOCK.tvMinPx ? DOCK.wideRailTvPx : DOCK.wideRailPx;
}
/** Wide handle: fold the rail or open it again (the portrait swipe states do not apply). */
export const wideToggle = (state) => (state === 'slim' ? 'default' : 'slim');

/** Everything the CSS needs, as plain values: { mode, dockH, railL, railR }.
 *  railL / railR are the stage insets left and right. `monitor: false` (a page without a Monitor) leaves the right side free. */
export function dockLayout(state, w, h, { safeB = 0, monitor = true } = {}) {
  const mode = layoutMode(w, h);
  return {
    mode,
    dockH: mode === 'portrait' ? dockHeightPx(state, h, { w, safeB }) : mode === 'desktop' ? null : 0,
    railL: mode === 'landscape' ? DOCK.railPx : mode === 'wide' ? wideRailPx(state, w) : 0,
    railR: mode === 'landscape' ? DOCK.railPx : mode === 'wide' && monitor ? wideRailPx('default', w) : 0
  };
}

/* ── pure: slot / page assignment ─────────────────────────────────────── */
/**
 * items = [{ id, side? }] where side is a preference ('left' | 'right').
 *   0      → mode 'none'
 *   1      → 'single'  · one centred slot
 *   2      → 'pair'    · left / right thumb zones (preferences honoured, order kept otherwise)
 *   3+     → 'pages'   · pages of two (left/right); an odd last page is centred; dots show
 */
export function assignSlots(items) {
  const list = (items || []).filter(Boolean);
  const n = list.length;
  if (n === 0) return { mode: 'none', pageCount: 0, pages: [] };
  if (n === 1) return { mode: 'single', pageCount: 1, pages: [[{ ...list[0], side: 'center' }]] };
  if (n === 2) {
    let [a, b] = list;
    if ((a.side === 'right' && b.side !== 'right') || (b.side === 'left' && a.side !== 'left')) [a, b] = [b, a];
    return { mode: 'pair', pageCount: 1, pages: [[{ ...a, side: 'left' }, { ...b, side: 'right' }]] };
  }
  const pages = [];
  for (let i = 0; i < n; i += 2) {
    const pair = list.slice(i, i + 2);
    pages.push(pair.length === 1
      ? [{ ...pair[0], side: 'center' }]
      : [{ ...pair[0], side: 'left' }, { ...pair[1], side: 'right' }]);
  }
  return { mode: 'pages', pageCount: pages.length, pages };
}
export function clampPage(page, count) {
  const p = Number.isFinite(+page) ? Math.floor(+page) : 0;
  return Math.max(0, Math.min(p, Math.max(0, count - 1)));
}
/** Page index from a horizontal scroll position (scroll-snap pages of equal width). */
export function pageFromScroll(scrollLeft, pageWidth, count) {
  if (!(pageWidth > 0)) return 0;
  return clampPage(Math.round(scrollLeft / pageWidth), count);
}

/* ── pure: persistence (sessionStorage, per module) ───────────────────── */
export const dockStorageKey = (moduleId) => 'autolab.dock.' + (moduleId || 'module');
export function serializeDock({ state, page }) {
  return JSON.stringify({ state: isState(state) ? state : 'default', page: clampPage(page, 99) });
}
/** Never throws; anything malformed falls back to { default, page 0 }. */
export function parseDock(raw, pageCount = 1) {
  const out = { state: 'default', page: 0 };
  if (typeof raw !== 'string' || !raw) return out;
  try {
    const o = JSON.parse(raw);
    if (o && isState(o.state)) out.state = o.state;
    if (o) out.page = clampPage(o.page, pageCount);
  } catch (_) { /* keep defaults */ }
  return out;
}

/* ── pure: soft keyboard ──────────────────────────────────────────────── */
/**
 * Hide the dock while a <select>'s soft keyboard / picker has shrunk the visual viewport.
 * layoutH = window.innerHeight, visualH = visualViewport.height.
 */
export function keyboardOpen({ layoutH, visualH, activeTag }) {
  if (String(activeTag || '').toUpperCase() !== 'SELECT') return false;
  if (!(layoutH > 0) || !(visualH > 0)) return false;
  return layoutH - visualH >= DOCK.kbdDeltaPx;
}

/* ═══════════════════════════════════════════════════════════════════════
   DOM — thin. Everything below only applies the pure results above.
   ═══════════════════════════════════════════════════════════════════════ */
function h(doc, tag, cls, attrs) {
  const n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}

export function createDock({ doc = document, win = window, moduleId = 'module', host, storage, onChange } = {}) {
  const root = h(doc, 'div', 'al-dock', { id: 'al-dock', role: 'region', 'aria-label': 'Controls' });
  const handle = h(doc, 'button', 'al-dock-handle', { type: 'button', 'aria-label': 'Resize controls', 'aria-expanded': 'false' });
  handle.appendChild(h(doc, 'span'));
  const transport = h(doc, 'div', 'al-dock-transport', { 'data-zone': 'transport' });
  const primary = h(doc, 'div', 'al-dock-primary', { 'data-zone': 'primary' });
  const pagesEl = h(doc, 'div', 'al-dock-pages');
  const dots = h(doc, 'div', 'al-dock-dots', { role: 'tablist', 'aria-label': 'Control pages' });
  const options = h(doc, 'div', 'al-dock-options', { 'data-zone': 'options' });
  const flowHost = h(doc, 'div', 'al-dock-flow');
  const extras = h(doc, 'div', 'ui-tb-extras al-dock-extras', { id: 'toolbar-extras' });
  const moreBtn = h(doc, 'button', 'al-dock-more', { type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': 'al-more-sheet', hidden: '' });
  moreBtn.innerHTML = '<span>More</span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 10l5 5 5-5z"/></svg>';
  options.append(flowHost, extras, moreBtn);
  /* the "More" sheet: scrim + dialog, same family as the info sheet. Cells beyond the budget live in its grid. */
  const sheetRoot = h(doc, 'div', 'al-more', { hidden: '' });
  const sheetScrim = h(doc, 'div', 'al-more-scrim');
  const sheet = h(doc, 'div', 'al-sheet al-more-sheet', { id: 'al-more-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'More options' });
  const sheetHead = h(doc, 'div', 'al-more-head');
  const sheetTitle = h(doc, 'span', 'al-more-title');
  sheetTitle.textContent = 'More options';
  const sheetClose = h(doc, 'button', 'al-more-close', { type: 'button', 'aria-label': 'Close more options' });
  sheetClose.textContent = 'Done';
  const sheetGrid = h(doc, 'div', 'al-more-grid');
  sheetHead.append(sheetTitle, sheetClose);
  sheet.append(sheetHead, sheetGrid);
  sheetRoot.append(sheetScrim, sheet);
  primary.append(pagesEl, dots);
  root.append(handle, transport, primary, options);

  const store = storage === undefined ? (() => { try { return win.sessionStorage; } catch (_) { return null; } })() : storage;
  const key = dockStorageKey(moduleId);
  const items = [];               /* { id, side, node } — primary controls, in mount order */
  let layout = assignSlots([]);
  const rawSaved = store ? (() => { try { return store.getItem(key); } catch (_) { return null; } })() : null;
  const hadSaved = rawSaved != null;      /* a first visit may open the options by itself (see maybeAutoOpen) */
  let saved = parseDock(rawSaved, 99);
  let state = saved.state, page = saved.page;
  let wantPage = saved.page;      /* the page the user last chose; controls mount one by one, so `page` is derived from it */
  let kbdHidden = false;

  const hasOptions = () => !!flowHost.childElementCount || !!extras.childElementCount || !!sheetGrid.childElementCount;
  const save = () => { try { store && store.setItem(key, serializeDock({ state, page })); } catch (_) {} };

  /* ── options grid (Phase 9b) ── */
  const cells = [];                 /* every option cell, in order */
  const homeOf = new Map();         /* cell → flowHost | extras (where it is built) */
  function syncCells() {
    [flowHost, extras].forEach((host) => [...host.children].forEach((n) => {
      if (!homeOf.has(n)) { homeOf.set(n, host); cells.push(n); }
    }));
  }
  function tagCell(n) {
    const cls = n.classList;
    if (!cls || typeof n.querySelector !== 'function' || !n.dataset) return;   /* not a real element (unit-test doubles) */
    const inner = cls.contains('ctl') ? n : (n.querySelector('.ctl') || n);       /* a primary choice arrives wrapped in .ui-widget */
    const ic = inner.classList;
    n.dataset.cell = ic.contains('ctl-choice') ? 'choice' : ic.contains('ctl-action') ? 'action' : 'toggle';
    const seg = n.querySelector('.ctl-seg');
    const btns = seg ? seg.querySelectorAll('.ctl-seg-btn') : [];
    const wide = btns.length >= 4 || !!n.querySelector('.ctl-select, .ctl-gate-pad');
    if (n.dataset.cell === 'choice') n.dataset.span = n.querySelector('.ctl-gate-pad') ? 'gate' : wide ? 'full' : 'half'; else delete n.dataset.span;
    if (seg) {                       /* many items: rows of ≤ 4, never a sideways strip */
      const g = segGrid(btns.length);
      if (btns.length > 4) {
        seg.dataset.many = '1';
        seg.style.gridTemplateColumns = 'repeat(' + g.cols + ', minmax(0, 1fr))';
        btns.forEach((b, i) => { b.style.gridColumn = i === btns.length - 1 && g.span > 1 ? 'span ' + g.span : ''; });
      } else { delete seg.dataset.many; seg.style.gridTemplateColumns = ''; btns.forEach((b) => { b.style.gridColumn = ''; }); }
    }
  }
  /* primary choices (gear gate, lighting switches) live in the options column when the dock is a cluster; back in their slot otherwise */
  function placePrimaryCells(on) {
    kinds.forEach((k) => {
      if (k.kind !== 'choice' && k.kind !== 'gate') return;
      const it = items.find((x) => x.id === k.id), se = slotEls.get(k.id);
      if (!it || !it.node || !se) return;
      const at = cells.indexOf(it.node);
      if (on) {
        if (at < 0) { cells.unshift(it.node); homeOf.set(it.node, flowHost); }
      } else if (at >= 0) {
        cells.splice(at, 1); homeOf.delete(it.node);
        if (it.node.parentNode !== se) se.appendChild(it.node);
      }
    });
  }
  function layoutOptions(portrait) {
    syncCells();
    const { shown, more } = portrait ? splitOptionCells(cells) : { shown: cells, more: [] };
    shown.forEach((n) => { const home = homeOf.get(n); if (n.parentNode !== home) home.appendChild(n); });
    [flowHost, extras].forEach((host) => {                       /* keep cell order (a cell that came back from the sheet) without moving what is already right */
      const want = shown.filter((n) => homeOf.get(n) === host);
      const have = [...host.children].filter((n) => want.includes(n));
      if (want.some((n, i) => have[i] !== n)) want.forEach((n) => host.appendChild(n));
    });
    more.forEach((n) => { if (n.parentNode !== sheetGrid) sheetGrid.appendChild(n); });
    cells.forEach(tagCell);
    moreBtn.hidden = !more.length;
    root.dataset.more = String(more.length);
    if (!more.length && !sheetRoot.hidden) closeSheet(false);
  }
  /* Phase 9c: soft fade on the edge of a vertically scrolling zone that has more to show */
  function paintFade(el) {
    if (!el || !el.dataset || typeof el.scrollHeight !== 'number') return;
    const f = scrollHint(el.scrollTop, el.clientHeight, el.scrollHeight);
    el.dataset.fadeT = f.top ? '1' : '0';
    el.dataset.fadeB = f.bottom ? '1' : '0';
  }
  const paintFades = () => { paintFade(options); paintFade(sheet); };
  options.addEventListener('scroll', () => paintFade(options), { passive: true });
  sheet.addEventListener('scroll', () => paintFade(sheet), { passive: true });
  const sheetFocusables = () => [...sheet.querySelectorAll('button, select, input, [tabindex]')]
    .filter((el) => el.tabIndex >= 0 && !el.disabled && !el.closest('[hidden]'));
  function openSheet() {
    if (!sheetRoot.hidden) return;
    sheetRoot.hidden = false;
    paintFade(sheet);
    moreBtn.setAttribute('aria-expanded', 'true');
    const f = sheetFocusables();
    (f[0] || sheetClose).focus();
  }
  function closeSheet(restore = true) {
    if (sheetRoot.hidden) return;
    sheetRoot.hidden = true;
    moreBtn.setAttribute('aria-expanded', 'false');
    if (restore && !moreBtn.hidden) moreBtn.focus();
  }
  moreBtn.addEventListener('click', () => (sheetRoot.hidden ? openSheet() : closeSheet()));
  sheetScrim.addEventListener('click', () => closeSheet());
  sheetClose.addEventListener('click', () => closeSheet());
  sheetRoot.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSheet(); return; }
    if (e.key !== 'Tab') return;
    const f = sheetFocusables();
    if (!f.length) { e.preventDefault(); return; }
    const first = f[0], last = f[f.length - 1], a = doc.activeElement;
    if (e.shiftKey && (a === first || !sheet.contains(a))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (a === last || !sheet.contains(a))) { e.preventDefault(); first.focus(); }
  });

  /* First visit, phone portrait, "full" plan (3–4 columns leave no room beside them): open at the options height so the toggles
     are visible without a swipe. Once only; a saved state or any later swipe wins. */
  let autoTimer = null;
  function maybeAutoOpen() {
    if (hadSaved || state !== 'default') return;
    if (root.dataset.mode === 'portrait' && root.dataset.plan === 'full' && hasOptions()) setState('options', false);
  }
  function applyLayout() {
    const w = win.innerWidth, hgt = win.innerHeight;
    const safeB = parseFloat(win.getComputedStyle(doc.documentElement).getPropertyValue('--safe-b')) || 0;
    const L = dockLayout(state, w, hgt, { safeB, monitor: 'monitor' in doc.documentElement.dataset });
    root.dataset.mode = L.mode;
    root.dataset.state = state;
    root.dataset.pages = String(layout.pageCount);
    const P = dockPlan(kinds.map((k) => k.kind), w, hasOptions());
    root.dataset.plan = L.mode === 'portrait' ? P.plan : 'paged';
    if (root.style && typeof root.style.setProperty === 'function') {
      root.style.setProperty('--eq-cols', String(P.cols || 1));
      root.style.setProperty('--eq-col', (P.sliderPx || CLUSTER.colPx.slider) + 'px');
    }
    kinds.forEach((k, i) => {
      const se = slotEls.get(k.id);
      if (!se || !se.dataset) return;
      se.dataset.kind = k.kind;
      if (P.order[i] && P.order[i].index >= 0) se.dataset.heroI = String(P.order[i].index); else delete se.dataset.heroI;
    });
    placePrimaryCells(L.mode === 'portrait' && (P.plan === 'side' || P.plan === 'opts'));
    layoutOptions(L.mode === 'portrait');
    root.dataset.hasOptions = String(hasOptions());
    paintFades();
    if (!autoTimer && !hadSaved) autoTimer = (win.setTimeout || setTimeout)(maybeAutoOpen, 0);
    if (L.mode === 'wide') {
      handle.setAttribute('aria-expanded', String(state !== 'slim'));
      handle.setAttribute('aria-label', state === 'slim' ? 'Show controls' : 'Hide controls');
    } else {
      handle.setAttribute('aria-expanded', String(state === 'options'));
      handle.setAttribute('aria-label', 'Resize controls');
    }
    const st = doc.documentElement.style;
    st.setProperty('--dock-rail-l', L.railL + 'px');
    st.setProperty('--dock-rail-r', L.railR + 'px');
    if (L.dockH != null && !kbdHidden) st.setProperty('--dock-h', L.dockH + 'px');
    if (kbdHidden) st.setProperty('--dock-h', '0px');
    if (L.mode === 'desktop' && !kbdHidden) measure();
    doc.documentElement.dataset.dock = kbdHidden ? 'hidden' : L.mode;
  }
  function measure() {                /* desktop: the bar is auto-height */
    if (root.dataset.mode !== 'desktop') return;
    const r = root.getBoundingClientRect();
    doc.documentElement.style.setProperty('--dock-h', Math.ceil(r.height + (parseFloat(win.getComputedStyle(root).bottom) || 0)) + 'px');
  }

  let kinds = [];                    /* [{ id, kind }] per primary item, in order */
  const slotEls = new Map();         /* id → its slot element */
  function renderPages() {
    layout = assignSlots(items.map(({ id, side }) => ({ id, side })));
    pagesEl.textContent = '';
    dots.textContent = '';
    const byId = new Map(items.map((it) => [it.id, it]));
    const kindOf = (n) => {
      if (!n || typeof n.querySelector !== 'function') return 'other';
      if (n.querySelector('.ctl-dial')) return 'dial';
      if (n.querySelector('.ctl-pedal, .ctl-momentary')) return 'pedal';
      if (n.querySelector('.ctl-axis')) return 'slider';
      if (n.querySelector('.ctl-gate-pad')) return 'gate';
      if (n.querySelector('.ctl-choice')) return 'choice';
      return 'other';
    };
    kinds = items.map((it) => ({ id: it.id, kind: kindOf(it.node) }));
    slotEls.clear();
    layout.pages.forEach((pg, i) => {
      const pe = h(doc, 'div', 'al-dock-page', { 'data-page': String(i) });
      pg.forEach((slot) => {
        const se = h(doc, 'div', 'al-dock-slot', { 'data-side': slot.side, 'data-slot': slot.id });
        slotEls.set(slot.id, se);
        se.appendChild(byId.get(slot.id).node);
        pe.appendChild(se);
      });
      pagesEl.appendChild(pe);
      const d = h(doc, 'button', 'al-dock-dot', { type: 'button', role: 'tab', 'aria-label': 'Controls page ' + (i + 1) });
      d.addEventListener('click', () => setPage(i, true));
      dots.appendChild(d);
    });
    root.dataset.pages = String(layout.pageCount);
    dots.hidden = layout.pageCount < 2;
    if (layout.pageCount > 0) page = clampPage(wantPage, layout.pageCount);   /* re-derived on every mount */
    paintDots();
  }
  function paintDots() {
    [...dots.children].forEach((d, i) => d.setAttribute('aria-selected', String(i === page)));
  }
  function setPage(p, scroll) {
    page = clampPage(p, layout.pageCount);
    wantPage = page;
    paintDots();
    if (scroll && pagesEl.clientWidth) pagesEl.scrollTo({ left: page * pagesEl.clientWidth, behavior: 'smooth' });
    save();
    if (onChange) onChange({ state, page });
  }
  let scrollT = 0;
  pagesEl.addEventListener('scroll', () => {
    clearTimeout(scrollT);
    scrollT = setTimeout(() => {
      const p = pageFromScroll(pagesEl.scrollLeft, pagesEl.clientWidth, layout.pageCount);
      if (p !== page) { page = wantPage = p; paintDots(); save(); if (onChange) onChange({ state, page }); }
    }, 90);
  }, { passive: true });

  function setState(next, persist = true) {
    if (!isState(next)) return;
    state = next;
    applyLayout();
    if (persist) save();
    if (onChange) onChange({ state, page });
    if (root.dataset.mode === 'wide' && typeof win.dispatchEvent === 'function' && typeof win.Event === 'function') win.dispatchEvent(new win.Event('resize'));   /* the stage just changed width: renderer, labels */
  }

  /* handle: swipe (pointer events) + tap + arrow keys */
  let y0 = null;
  handle.addEventListener('pointerdown', (e) => { y0 = e.clientY; try { handle.setPointerCapture(e.pointerId); } catch (_) {} });
  handle.addEventListener('pointerup', (e) => {
    if (y0 == null) return;
    const dir = swipeDirection(e.clientY - y0);
    y0 = null;
    if (dir) { e.preventDefault(); handle.dataset.swiped = '1'; setState(nextState(state, dir, { hasOptions: hasOptions() })); }
  });
  handle.addEventListener('pointercancel', () => { y0 = null; });
  handle.addEventListener('click', () => {
    if (handle.dataset.swiped) { delete handle.dataset.swiped; return; }
    setState(root.dataset.mode === 'wide' ? wideToggle(state) : tapState(state, { hasOptions: hasOptions() }));
  });
  handle.addEventListener('keydown', (e) => {
    const dir = e.key === 'ArrowUp' ? 'up' : e.key === 'ArrowDown' ? 'down' : null;
    if (dir) { e.preventDefault(); setState(nextState(state, dir, { hasOptions: hasOptions() })); }
  });

  /* soft keyboard: hide the dock instead of squashing the 3D view */
  function checkKeyboard() {
    const vv = win.visualViewport;
    const next = keyboardOpen({ layoutH: win.innerHeight, visualH: vv ? vv.height : win.innerHeight, activeTag: doc.activeElement && doc.activeElement.tagName });
    if (next === kbdHidden) return;
    kbdHidden = next;
    root.hidden = next;
    applyLayout();
  }
  if (win.visualViewport) win.visualViewport.addEventListener('resize', checkKeyboard);
  doc.addEventListener('focusin', () => setTimeout(checkKeyboard, 60));
  doc.addEventListener('focusout', () => setTimeout(checkKeyboard, 60));

  win.addEventListener('resize', applyLayout);
  win.addEventListener('orientationchange', () => setTimeout(applyLayout, 220));
  if (typeof win.ResizeObserver === 'function') new win.ResizeObserver(measure).observe(root);

  /* Phase 9a: paint tier on <html data-ui-tier>. Embedded pages also honour ?ui= on the shell URL. */
  const tierState = { base: 'mid', now: 'mid', locked: false };
  function detectTier() {
    const mm = (q) => { try { return !!(win.matchMedia && win.matchMedia(q).matches); } catch (_) { return false; } };
    const nav = win.navigator || {};
    let override = tierOverride(win.location && win.location.search);
    if (!override) { try { override = tierOverride(win.parent !== win && win.parent.location.search); } catch (_) { /* cross-origin parent */ } }
    tierState.locked = !!override;
    tierState.base = uiTier({
      device: classifyDevice({ cores: nav.hardwareConcurrency || 4, mem: nav.deviceMemory || 4, dpr: win.devicePixelRatio || 1, isCoarse: mm('(pointer: coarse)') }),
      override,
      reduceTransparency: mm('(prefers-reduced-transparency: reduce)')
    });
    tierState.now = tierState.base;
  }
  function paintTier() { doc.documentElement.dataset.uiTier = tierState.now; }
  detectTier();
  paintTier();
  /* kit.js fires this when the frame-time governor is already at its lowest resolution and frames are still slow */
  win.addEventListener('al-perf-slow', () => {
    if (tierState.locked) return;
    const next = stepDownTier(tierState.now);
    if (next !== tierState.now) { tierState.now = next; paintTier(); }
  });

  (host || doc.body).appendChild(root);
  (host || doc.body).appendChild(sheetRoot);
  renderPages();
  applyLayout();

  return {
    root, handle, transport, options, extras, flow: flowHost, primary, moreBtn, moreSheet: sheet,
    openMore: openSheet, closeMore: () => closeSheet(), isMoreOpen: () => !sheetRoot.hidden,
    /* placement */
    addTransport(node) { transport.appendChild(node); },
    addOption(node) { flowHost.appendChild(node); applyLayout(); },
    addPrimary({ id, side, node }) {
      const at = items.findIndex((it) => it.id === id);
      if (at >= 0) items.splice(at, 1);
      items.push({ id, side, node });
      renderPages();
      applyLayout();
      const x = () => { if (page && pagesEl.clientWidth) pagesEl.scrollLeft = page * pagesEl.clientWidth; };
      (win.requestAnimationFrame || setTimeout)(x);
    },
    refresh() { renderPages(); applyLayout(); },
    /* state */
    setState, getState: () => state,
    setPage, getPage: () => page,
    getLayout: () => layout,
    hasOptions,
    relayout: applyLayout,
    getTier: () => tierState.now
  };
}

/* ── pure: model placement ────────────────────────────────────────────── */
/**
 * Vertical shift (px) applied to the camera's view window so the model sits in the upper/mid
 * part of the stage on portrait phones. 0 on desktop and in landscape.
 * stageW/stageH = size of #canvas-wrap · vw/vh = the document viewport.
 */
export function modelShiftPx(stageW, stageH, vw, vh) {
  if (layoutMode(vw, vh) !== 'portrait') return 0;
  if (!(stageW > 0) || !(stageH > 0)) return 0;
  return Math.round(stageH * 0.05);
}
