/* ═══════════════════════════════════════════════════════════════════════
   dock.js — the control dock (R2 / R6), Phase 2 skeleton.

   ONE dock per module document, embedded AND standalone:

     handle      swipe up → options row · swipe down → slim 56 px bar
     transport   play / pause · reset                 (built once, R1)
     primary     1–3 slots · 2 = left/right thumb zones · 3+ = pages + dots
     options     horizontal chips (Flow, module extras) 40–44 px

   Phone portrait   bottom sheet, default 24 vh, hard ceiling 30 vh
   Phone landscape  two side rails, 140 px each
   Desktop          one auto-height bar at the bottom

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
  kbdDeltaPx: 120,    /* visual viewport shrink that counts as "keyboard open" */
  swipePx: 24         /* minimum vertical travel that counts as a swipe        */
});

/* order = bottom → top; "up" moves toward the end of the list */
export const STATES = Object.freeze(['slim', 'default', 'options']);
export const isState = (s) => STATES.includes(s);

/* ── pure: layout mode ────────────────────────────────────────────────── */
/** 'desktop' | 'portrait' | 'landscape'. Phone = max-width 720 OR max-height 540 (R2). */
export function layoutMode(w, h) {
  if (!isPhone(w, h)) return 'desktop';
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
 *   desktop   : null (auto — the DOM measures the bar)
 * The safe-area inset is part of the dock (it pads the bottom), so the 30 vh ceiling includes it.
 * `vh` is the height of THIS document's viewport — inside the shell's iframe that is the
 * screen minus the 32 px shell header (see GUIDE.md).
 */
export function dockHeightPx(state, vh, { w = 0, safeB = 0 } = {}) {
  const mode = layoutMode(w, vh);          /* w omitted → treated as a narrow (portrait) phone */
  if (mode === 'desktop') return null;
  if (mode === 'landscape') return 0;
  const s = isState(state) ? state : 'default';
  const def = Math.round(vh * DOCK.defaultVh / 100);
  const max = Math.round(vh * DOCK.maxVh / 100);
  if (s === 'slim') return DOCK.slimPx + safeB;
  return Math.min(max, s === 'options' ? def + DOCK.optionsPx : def);
}

/** Everything the CSS needs, as plain values: { mode, dockH, railW }. */
export function dockLayout(state, w, h, { safeB = 0 } = {}) {
  const mode = layoutMode(w, h);
  return {
    mode,
    dockH: mode === 'portrait' ? dockHeightPx(state, h, { w, safeB }) : mode === 'landscape' ? 0 : null,
    railW: mode === 'landscape' ? DOCK.railPx : 0
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
  options.append(flowHost, extras);
  primary.append(pagesEl, dots);
  root.append(handle, transport, primary, options);

  const store = storage === undefined ? (() => { try { return win.sessionStorage; } catch (_) { return null; } })() : storage;
  const key = dockStorageKey(moduleId);
  const items = [];               /* { id, side, node } — primary controls, in mount order */
  let layout = assignSlots([]);
  let saved = parseDock(store && (() => { try { return store.getItem(key); } catch (_) { return null; } })(), 99);
  let state = saved.state, page = saved.page;
  let wantPage = saved.page;      /* the page the user last chose; controls mount one by one, so `page` is derived from it */
  let kbdHidden = false;

  const hasOptions = () => !!flowHost.childElementCount || !!extras.childElementCount;
  const save = () => { try { store && store.setItem(key, serializeDock({ state, page })); } catch (_) {} };

  function applyLayout() {
    const w = win.innerWidth, hgt = win.innerHeight;
    const safeB = parseFloat(win.getComputedStyle(doc.documentElement).getPropertyValue('--safe-b')) || 0;
    const L = dockLayout(state, w, hgt, { safeB });
    root.dataset.mode = L.mode;
    root.dataset.state = state;
    root.dataset.pages = String(layout.pageCount);
    root.dataset.hasOptions = String(hasOptions());
    handle.setAttribute('aria-expanded', String(state === 'options'));
    const st = doc.documentElement.style;
    st.setProperty('--dock-rail', L.railW + 'px');
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

  function renderPages() {
    layout = assignSlots(items.map(({ id, side }) => ({ id, side })));
    pagesEl.textContent = '';
    dots.textContent = '';
    const byId = new Map(items.map((it) => [it.id, it]));
    layout.pages.forEach((pg, i) => {
      const pe = h(doc, 'div', 'al-dock-page', { 'data-page': String(i) });
      pg.forEach((slot) => {
        const se = h(doc, 'div', 'al-dock-slot', { 'data-side': slot.side, 'data-slot': slot.id });
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
    setState(tapState(state, { hasOptions: hasOptions() }));
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

  (host || doc.body).appendChild(root);
  renderPages();
  applyLayout();

  return {
    root, handle, transport, options, extras, flow: flowHost, primary,
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
    hasOptions
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
