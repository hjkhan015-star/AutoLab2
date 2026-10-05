/* ═══════════════════════════════════════════════════════════════════════
   chrome.js — shared header + ⋯ menu (R6).

   ONE builder, used by the shell (index.html) now and by standalone
   modules from Phase 2. Every control exists once, as one DOM node.

     createHeader({ title, color, onBack, onInfo })   32 px, one row
     createMenu({ state, onChange })                   sim speed · label
                     density · theme · wireframe · x-ray
        phone   (max-width:720px or max-height:540px) → bottom sheet ≤ 50 vh
        desktop                                       → anchored popover

   Nothing here knows about Three.js. Menu changes go out through
   onChange(key, value); the owner (shell or module) applies them.
   Styles live in controls.css (tokens only).

   The pure helpers below are unit-tested in node (tests/chrome.test.mjs).
   ═══════════════════════════════════════════════════════════════════════ */

/* ── pure helpers ───────────────────────────────────────────────────── */
export const SPEED = Object.freeze({ min: 0.15, max: 2.5, step: 0.05, def: 0.85 });
/* Label density levels match labels.js: 2 = all, 1 = key, 0 = none. */
export const DENSITY = Object.freeze([
  { level: 2, label: 'All' },
  { level: 1, label: 'Key' },
  { level: 0, label: 'None' }
]);

export function clampSpeed(v) {
  const x = Number(v);
  if (!Number.isFinite(x)) return SPEED.def;
  return Math.min(SPEED.max, Math.max(SPEED.min, x));
}
/** Sim speed is a time multiplier — never rpm, never km/h. */
export function formatSimSpeed(v) { return clampSpeed(v).toFixed(2) + '×'; }
/** All → Key → None → All */
export function nextDensity(level) {
  const i = DENSITY.findIndex((d) => d.level === level);
  return DENSITY[((i < 0 ? 0 : i) + 1) % DENSITY.length].level;   /* unknown level counts as All */
}
export function normDensity(level) {
  return DENSITY.some((d) => d.level === level) ? level : 2;
}
/** Phone = max-width 720 OR max-height 540 (R2). */
export function isPhone(w, h) { return w <= 720 || h <= 540; }
export function menuMode(w, h) { return isPhone(w, h) ? 'sheet' : 'popover'; }
/**
 * Popover placement: right-aligned under the anchor, clamped to the viewport.
 * anchor = {left,right,top,bottom}; size = {w,h}; vp = {w,h}
 */
export function popoverPosition(anchor, size, vp, margin = 8, gap = 6) {
  let left = anchor.right - size.w;
  left = Math.max(margin, Math.min(left, vp.w - size.w - margin));
  let top = anchor.bottom + gap;
  if (top + size.h > vp.h - margin) top = Math.max(margin, vp.h - size.h - margin);
  return { left: Math.round(left), top: Math.round(top) };
}

/* ── DOM helpers ────────────────────────────────────────────────────── */
const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  back: '<path d="M15 18l-6-6 6-6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.6" r=".9" fill="currentColor" stroke="none"/>',
  more: '<circle cx="5" cy="12" r="1.8" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.8" fill="currentColor" stroke="none"/>'
};
function icon(doc, name) {
  const s = doc.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.8');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  s.innerHTML = ICONS[name] || '';
  return s;
}
function el(doc, tag, cls, attrs) {
  const n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}
function iconButton(doc, name, label, act) {
  const b = el(doc, 'button', 'al-hdr-btn', { type: 'button', 'aria-label': label, 'data-act': act });
  b.appendChild(icon(doc, name));
  return b;
}

/* ═══════════════════════════════════════════════════════════════════════
   Header — back · title · info · ⋯
   ═══════════════════════════════════════════════════════════════════════ */
export function createHeader(opts = {}) {
  const doc = opts.doc || document;
  const root = el(doc, 'header', 'al-hdr', { role: 'banner' });
  const back = iconButton(doc, 'back', 'Back', 'back');
  const title = el(doc, 'h1', 'al-hdr-title');
  const dot = el(doc, 'span', 'al-hdr-dot', { 'aria-hidden': 'true' });
  const text = el(doc, 'span', 'al-hdr-text');
  title.appendChild(dot); title.appendChild(text);
  const info = iconButton(doc, 'info', 'Module info', 'info');
  const more = iconButton(doc, 'more', 'View options', 'more');
  more.setAttribute('aria-haspopup', 'dialog');
  more.setAttribute('aria-expanded', 'false');
  root.appendChild(back); root.appendChild(title); root.appendChild(info); root.appendChild(more);

  const api = {
    root, back, info, more,
    setTitle(t) { text.textContent = t || ''; },
    setColor(c) { if (c) root.style.setProperty('--al-accent', c); },
    setInfoVisible(v) { info.hidden = !v; },
    setMenuExpanded(v) { more.setAttribute('aria-expanded', v ? 'true' : 'false'); }
  };
  api.setTitle(opts.title);
  api.setColor(opts.color);
  if (opts.onBack) back.addEventListener('click', () => opts.onBack());
  if (opts.onInfo) info.addEventListener('click', () => opts.onInfo());
  if (opts.onMenu) more.addEventListener('click', () => opts.onMenu(more));
  return api;
}

/* Phase 8: the ONE place a plain <button> is built for kit chrome (panel toggle / tabs / show-more, orb, play / reset).
   opts: { cls, id, label (aria-label), html (inner), type, attrs }.  Module controls are controls.js specs, never this. */
export function chromeButton(doc, opts = {}) {
  const b = doc.createElement('button');
  b.type = opts.type || 'button';
  if (opts.cls) b.className = opts.cls;
  if (opts.id) b.id = opts.id;
  if (opts.label) b.setAttribute('aria-label', opts.label);
  if (opts.html != null) b.innerHTML = opts.html;
  Object.entries(opts.attrs || {}).forEach(([k, v]) => b.setAttribute(k, v));
  return b;
}

/* ═══════════════════════════════════════════════════════════════════════
   ⋯ menu — one sheet/popover node, built once, re-synced with update()
   state: { speed, density, theme:'dark'|'light', wireframe, xray }
   ═══════════════════════════════════════════════════════════════════════ */
let _uid = 0;
export function createMenu(opts = {}) {
  const doc = opts.doc || document;
  const win = doc.defaultView || window;
  const onChange = opts.onChange || function () {};
  /* opts.hide: rows a 2D module has no use for ('density' | 'wireframe' | 'xray'); they are never added to the sheet */
  const skipRows = new Set(opts.hide || []);
  const uid = 'al-menu-' + (++_uid);
  const st = {
    speed: clampSpeed(opts.state && opts.state.speed != null ? opts.state.speed : SPEED.def),
    density: normDensity(opts.state && opts.state.density != null ? opts.state.density : 2),
    theme: opts.state && opts.state.theme === 'light' ? 'light' : 'dark',
    wireframe: !!(opts.state && opts.state.wireframe),
    xray: !!(opts.state && opts.state.xray)
  };

  const backdrop = el(doc, 'div', 'al-menu-backdrop');
  backdrop.hidden = true;
  const menu = el(doc, 'div', 'al-menu', { role: 'dialog', 'aria-label': 'View options', 'aria-modal': 'true', tabindex: '-1' });
  menu.hidden = true;

  const grab = el(doc, 'div', 'al-menu-grab', { 'aria-hidden': 'true' });
  grab.appendChild(el(doc, 'span'));
  menu.appendChild(grab);

  /* sim speed */
  const rowSpeed = el(doc, 'div', 'al-menu-row');
  const lblSpeed = el(doc, 'label', 'al-menu-label', { for: uid + '-speed' });
  lblSpeed.textContent = 'Sim speed';
  const outSpeed = el(doc, 'output', 'al-menu-value', { for: uid + '-speed' });
  const range = el(doc, 'input', 'al-menu-range', {
    type: 'range', id: uid + '-speed', min: String(SPEED.min), max: String(SPEED.max), step: String(SPEED.step)
  });
  rowSpeed.appendChild(lblSpeed); rowSpeed.appendChild(outSpeed); rowSpeed.appendChild(range);
  menu.appendChild(rowSpeed);

  /* label density — 3-state radio group */
  const rowDens = el(doc, 'div', 'al-menu-row');
  const lblDens = el(doc, 'span', 'al-menu-label', { id: uid + '-dens' });
  lblDens.textContent = 'Labels';
  const seg = el(doc, 'div', 'al-seg', { role: 'radiogroup', 'aria-labelledby': uid + '-dens' });
  const segBtns = DENSITY.map((d) => {
    const b = el(doc, 'button', 'al-seg-btn', { type: 'button', role: 'radio', 'data-level': String(d.level) });
    b.textContent = d.label;
    seg.appendChild(b);
    return b;
  });
  rowDens.appendChild(lblDens); rowDens.appendChild(seg);
  if (!skipRows.has('density')) menu.appendChild(rowDens);

  /* switches */
  function switchRow(key, label) {
    const b = el(doc, 'button', 'al-menu-row al-switch', { type: 'button', role: 'switch', 'data-key': key });
    const t = el(doc, 'span', 'al-menu-label'); t.textContent = label;
    const knob = el(doc, 'span', 'al-switch-knob', { 'aria-hidden': 'true' });
    b.appendChild(t); b.appendChild(knob);
    if (!skipRows.has(key)) menu.appendChild(b);
    return b;
  }
  const swTheme = switchRow('theme', 'Light theme');
  const swWire  = switchRow('wireframe', 'Wireframe');
  const swXray  = switchRow('xray', 'X-ray');

  /* host: the caller's container, or <body> */
  const host = opts.host || doc.body;
  host.appendChild(backdrop);
  host.appendChild(menu);

  /* ── sync UI from state (no events fired) ── */
  function render() {
    range.value = String(st.speed);
    range.setAttribute('aria-valuetext', formatSimSpeed(st.speed) + ' simulation speed');
    outSpeed.textContent = formatSimSpeed(st.speed);
    segBtns.forEach((b) => {
      const on = Number(b.getAttribute('data-level')) === st.density;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    swTheme.setAttribute('aria-checked', st.theme === 'light' ? 'true' : 'false');
    swWire.setAttribute('aria-checked', st.wireframe ? 'true' : 'false');
    swXray.setAttribute('aria-checked', st.xray ? 'true' : 'false');
  }
  render();

  /* ── events ── */
  range.addEventListener('input', () => {
    st.speed = clampSpeed(range.value); render(); onChange('speed', st.speed);
  });
  segBtns.forEach((b) => b.addEventListener('click', () => {
    st.density = Number(b.getAttribute('data-level')); render(); onChange('density', st.density);
  }));
  seg.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = DENSITY.findIndex((d) => d.level === st.density);
    const n = (i + (e.key === 'ArrowRight' ? 1 : DENSITY.length - 1)) % DENSITY.length;
    st.density = DENSITY[n].level; render(); segBtns[n].focus(); onChange('density', st.density);
  });
  swTheme.addEventListener('click', () => { st.theme = st.theme === 'light' ? 'dark' : 'light'; render(); onChange('theme', st.theme); });
  swWire.addEventListener('click', () => { onChange('wireframe', !st.wireframe); });
  swXray.addEventListener('click', () => { onChange('xray', !st.xray); });
  /* wireframe / x-ray are mutually exclusive: the owner decides and calls update(). */

  /* ── open / close ── */
  let open = false, anchor = null, returnFocus = null;
  const vp = () => ({ w: win.innerWidth, h: win.innerHeight });

  function place() {
    const mode = menuMode(vp().w, vp().h);
    menu.setAttribute('data-mode', mode);
    backdrop.setAttribute('data-mode', mode);
    if (mode === 'popover' && anchor) {
      const r = anchor.getBoundingClientRect();
      const p = popoverPosition(r, { w: menu.offsetWidth || 300, h: menu.offsetHeight || 260 }, vp());
      menu.style.left = p.left + 'px'; menu.style.top = p.top + 'px';
    } else {
      menu.style.left = ''; menu.style.top = '';
    }
  }
  function focusables() { return Array.from(menu.querySelectorAll('input, button')).filter((n) => !n.disabled && n.tabIndex !== -1); }

  function show(a) {
    if (open) return;
    open = true; anchor = a || null; returnFocus = doc.activeElement;
    backdrop.hidden = false; menu.hidden = false;
    place();
    /* next frame so the transition runs */
    win.requestAnimationFrame(() => { menu.classList.add('is-open'); backdrop.classList.add('is-open'); });
    if (opts.onToggle) opts.onToggle(true);
    const f = focusables(); (f[0] || menu).focus({ preventScroll: true });
  }
  function hide(restore = true) {
    if (!open) return;
    open = false;
    menu.classList.remove('is-open'); backdrop.classList.remove('is-open');
    menu.style.transform = '';
    const done = () => { if (!open) { menu.hidden = true; backdrop.hidden = true; } };
    const reduce = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) done(); else win.setTimeout(done, 220);
    if (opts.onToggle) opts.onToggle(false);
    if (restore) {
      const t = anchor || returnFocus;
      if (t && typeof t.focus === 'function') t.focus({ preventScroll: true });
    }
    anchor = null;
  }
  backdrop.addEventListener('click', () => hide());
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hide(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables(); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  win.addEventListener('resize', () => { if (open) place(); });

  /* swipe-down to dismiss — on the grabber only, so the range slider keeps its drag */
  (function () {
    let y0 = 0, dy = 0, drag = false;
    grab.addEventListener('pointerdown', (e) => {
      if (menu.getAttribute('data-mode') !== 'sheet') return;
      drag = true; y0 = e.clientY; dy = 0;
      menu.style.transition = 'none';
      try { grab.setPointerCapture(e.pointerId); } catch (_) {}
    });
    grab.addEventListener('pointermove', (e) => {
      if (!drag) return;
      dy = Math.max(0, e.clientY - y0);
      menu.style.transform = 'translateY(' + dy + 'px)';
    });
    const end = () => {
      if (!drag) return;
      drag = false; menu.style.transition = '';
      if (dy > 80) hide(); else menu.style.transform = '';
    };
    grab.addEventListener('pointerup', end);
    grab.addEventListener('pointercancel', end);
  })();

  return {
    root: menu, backdrop,
    get isOpen() { return open; },
    open(a) { show(a); },
    close(restore) { hide(restore !== false); },
    toggle(a) { if (open) hide(); else show(a); },
    /* owner pushes new state in; never fires onChange */
    update(patch) {
      if (!patch) return;
      if (patch.speed != null) st.speed = clampSpeed(patch.speed);
      if (patch.density != null) st.density = normDensity(patch.density);
      if (patch.theme != null) st.theme = patch.theme === 'light' ? 'light' : 'dark';
      if (patch.wireframe != null) st.wireframe = !!patch.wireframe;
      if (patch.xray != null) st.xray = !!patch.xray;
      render();
    },
    getState() { return Object.assign({}, st); }
  };
}
