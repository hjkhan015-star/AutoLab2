/* ═══════════════════════════════════════════════════════════════════════
   labels.js — Auto Lab shared 3D label engine · v3 “docked callouts”

   Every module already calls   const labels = Base.createLabelSystem();
   and then                     labels.add(id, text[, tier|opts]) / labels.project(...)
   kit.js re-exports THIS implementation, so all modules pick it up with
   zero per-file changes.

   What it does
   ────────────
   1. DOCKED      Text lives in two stable gutters at the left / right
                  screen edges, docked vertically between the shell's UI
                  cards. It never sits over the model, and it never
                  chases the part — reading is effortless.
   2. LEADERS     An elbow connector + anchor dot tracks the 3D point
                  every frame. The line stretches; the text stays put.
   3. STABLE      Sub-pixel anchor noise is dead-banded; column side
                  flips use hysteresis + fade-teleport (never slides
                  across the model); slot order re-solves at most 4×/s
                  and only re-flows when parts genuinely reorder.
   4. PRIORITY    PRIMARY (1) / SECONDARY (2) / DETAIL (3) tiers, inferred
                  unless set explicitly. Density cycles All → Key → None.
                  If a column overflows its band, detail labels yield
                  first — primaries never do.
   5. COLOUR      Kind-coded (air, exhaust, fuel, coolant, electrical,
                  control, hot, mechanical) — unchanged.
   6. IDLE-SAFE   The rAF loop parks when nothing is shown; project(),
                  add(), setDensity() … re-arm it.

   Public API (superset of the old one — nothing removed)
   ──────────────────────────────────────────────────────
     add(id, text, tier?|opts?)   opts: { tier, kind, color }
     project(id, worldVec3, camera, wrap)
     setText(id, text)            hide(id)   hideAll(force?)   remove(id)
     setDensity(0|1|2)  getDensity()  cycleDensity()  onDensity(fn)
     setTier(id, 1|2|3)  setKind(id, kind)  relayout()  dispose()
     createLabelSystem({ margin, maxGap, graceMs, solveMs, band })
   ═══════════════════════════════════════════════════════════════════════ */

export const DENSITY = { NONE: 0, KEY: 1, ALL: 2 };
export const DENSITY_INFO = [
  { level: 2, name: 'All labels',  short: 'All',  hint: 'Every part is labelled' },
  { level: 1, name: 'Key parts',   short: 'Key',  hint: 'Only the primary parts' },
  { level: 0, name: 'Labels off',  short: 'Off',  hint: 'Clean view' },
];

/* ── Colour-coding by meaning ─────────────────────────────────────────── */
export const KINDS = {
  air:        { name: 'Air / intake',        color: '#38bdf8' },
  exhaust:    { name: 'Exhaust / gas',       color: '#fb923c' },
  fuel:       { name: 'Fuel / oil',          color: '#facc15' },
  coolant:    { name: 'Coolant / thermal',   color: '#2dd4bf' },
  electrical: { name: 'Electrical',          color: '#a78bfa' },
  control:    { name: 'Sensor / control',    color: '#4ade80' },
  hot:        { name: 'Combustion / heat',   color: '#f87171' },
  mechanical: { name: 'Mechanical',          color: '#94a3b8' },
};

/* First match wins. Order matters (specific → general). */
const KIND_RULES = [
  ['control',    /\b(ecu|ecm|pcm|sensor|o2|lambda|nox|maf|map|obd|dlc|scan|can[- ]?[hl]?|signal|controller|module|switch|solenoid valve|abs|esc|wss|tone ring|gauge|ammeter)\b/i],
  ['electrical', /\b(batter|alternator|starter|coil|spark|plug|ignition|fuse|wire|wiring|ground|gnd|terminal|positive|negative|diode|rectifier|regulator|brush|commutator|armature|field|stator|rotor|slip ring|distributor|relay|solenoid|lamp|headlamp|bulb|led|12 ?v|volt|charge|harness|electrolyte|cells?)\b|[+−]/i],
  ['coolant',    /\b(coolant|radiator|thermostat|water|antifreeze|cooling|heat exchanger|intercooler|fan|fins?|core)\b/i],
  ['fuel',       /\b(fuel|injector|rail|carburet|carb|jet|float|tank|diesel|petrol|gasoline|oil|sump|lubric|bearing|gallery|filter element|dust|soot)\b/i],
  ['exhaust',    /\b(exhaust|muffler|silencer|resonator|tailpipe|tail|catalytic|cat\b|honeycomb|dpf|egr|manifold out|raw exhaust|burnt|turbine|wastegate|pre-cat|post-cat|straight pipe|silenced)\b/i],
  ['air',        /\b(air|intake|inlet|throttle|venturi|choke|compressor|boost|blow-?off|bov|charge|snorkel|airbox|supercharger|bypass|impeller|fresh)\b/i],
  ['hot',        /\b(combustion|hot|flame|cylinder|piston|plug gap|power stroke|spark gap|tdc|bdc|liner|head gasket)\b/i],
];
export function inferKind(text) {
  const t = String(text || '');
  for (const [kind, re] of KIND_RULES) if (re.test(t)) return kind;
  return 'mechanical';
}

/* ── Priority inference (unchanged from v2) ──────────────────────────── */
const MAJOR = /\b(engine|piston|crank(shaft)?|cam(shaft)?|valve(s)?|turbo(charger)?|compressor|turbine|supercharger|intercooler|radiator|thermostat|water pump|oil pump|pump|filter|ecu|battery|alternator|starter|solenoid|flywheel|clutch|gearbox|transmission|differential|crown wheel|pinion|propeller shaft|axle|half shaft|wheel|tyre|tire|brake|caliper|disc|rotor|drum|abs|steering (wheel|column)|rack|damper|shock|spring|coil spring|leaf|catalytic|converter|muffler|dpf|egr|injector|fuel rail|rail|carburet|venturi|float|jet|throttle|spark plug|ignition coil|distributor|planet|sun gear|ring gear|carrier|impeller|stator|sump|bulb|reflector|headlamp|lens|mass air|maf|dlc|scan tool|manifold|input shaft|output shaft|countershaft|tank)\b/i;
const MINOR = /\b(bolt|nut|washer|seal|gasket|clip|ring(s)?\b(?!\s*gear)|seat|retainer|bucket|shim|bush(ing)?|journal|counterweight|throw|pin\b|brush(es)?|commutator|slip|hub|idler|shackle|u-bolt|hanger|tone|terminal|electrode|insulator|pleat|tread|inlet holes|base plate)\b/i;
const READOUT = /(\d|[:×·]\s*\d|^[+−\-]$|^\s*$)/;
const FLOWISH = /\b(in|out)\b\s*$|\b(hot|cold|cooled|fresh|clean|raw|dense|compressed|burnt|mixture|charge|flow)\b/i;

const PRIMARY_CAP = 6;
const SECONDARY_CAP = 14;

function scoreLabel(text) {
  let s = 0;
  if (MAJOR.test(text)) s += 3;
  if (MINOR.test(text)) s -= 1;
  if (READOUT.test(text)) s -= 2;
  if (FLOWISH.test(text) && !MAJOR.test(text)) s -= 1;
  return s;
}

/* ── Docking constants ────────────────────────────────────────────────── */
const GRACE_MS  = 220;   // keep a label alive this long after the last project()
const SOLVE_MS  = 250;   // re-solve column order / slots at most 4×/second
const DEADBAND  = 0.35;  // px of anchor movement ignored (kills sub-pixel jitter)
const SIDE_ON   = 0.55;  // anchor past 55 % of width  → joins the right column
const SIDE_OFF  = 0.45;  // anchor back under 45 %     → rejoins the left column
const SWAP_MS   = 320;   // fade-out → teleport → fade-in on a column change
const MAX_GAP   = 64;    // vertical breathing room between docked labels
const MIN_GAP   = 4;
const ELBOW     = 16;    // horizontal leader stub before the diagonal
const MAX_W     = 200;   // label max width before wrapping

/* ── Scratch vector — allocates exactly once, never per call ──────────── */
let _vec = null;
const _v = {
  x: 0, y: 0, z: 0,
  copy(v) {
    this.x = v.x; this.y = v.y; this.z = v.z;
    if (!_vec && typeof v.clone === 'function') _vec = v.clone();
    return this;
  },
  project(camera) {
    if (!_vec) return this;
    _vec.set(this.x, this.y, this.z).project(camera);
    this.x = _vec.x; this.y = _vec.y; this.z = _vec.z;
    return this;
  },
};

/* Phase 8: the one place the label density (and the live label system) is kept. Replaces the old window globals;
   kit.js and any module that draws its own labels (cooling) read it through these functions. */
const shared = { density: 2, system: null };
export const getLabelDensity = () => shared.density;
export function setLabelDensity(level) {
  const n = [0, 1, 2].includes(level) ? level : 2;
  if (shared.system) shared.system.setDensity(n); else shared.density = n;
  return shared.density;
}

export function createLabelSystem(options = {}) {
  const root = document.getElementById('labels-root') || document.body;
  const MARGIN  = options.margin  ?? 10;
  const MAXGAP  = options.maxGap  ?? MAX_GAP;
  const graceMs = options.graceMs ?? GRACE_MS;
  const solveMs = options.solveMs ?? SOLVE_MS;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* SVG layer for leader lines — created once, shared by all systems */
  let svg = root.querySelector(':scope > svg.label-lines');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'label-lines');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.pointerEvents = 'none';
    root.insertBefore(svg, root.firstChild);
  }

  const L = new Map();          // id → label record
  let order = 0;
  /* a level already chosen before the label system existed (kit.js: Key on phones) is kept */
  let density = [0, 1, 2].includes(options.density) ? options.density
              : [0, 1, 2].includes(shared.density) ? shared.density : DENSITY.ALL;
  let dirtyRank = true;
  let raf = 0, lastNow = 0;
  let lastSig = '', lastSolve = -Infinity;
  const listeners = new Set();

  shared.density = density;

  /* — DOM builders — */
  function makeEl(text) {
    const el = document.createElement('div');
    el.className = 'label3d';
    el.setAttribute('aria-hidden', 'true');   // the info panel carries the same content as text
    el.style.pointerEvents = 'none';          // never block orbit drags
    el.style.maxWidth = MAX_W + 'px';
    const dot = document.createElement('i');   dot.className = 'label3d-dot';
    const span = document.createElement('span'); span.className = 'label3d-text';
    span.textContent = text;
    el.append(dot, span);
    return el;
  }
  function makeLine() {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'label-lead');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    const pt = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    pt.setAttribute('r', '3');
    g.append(line, pt);
    svg.appendChild(g);
    return { g, line, pt };
  }
  function applyStyle(r) {
    r.el.dataset.kind = r.kind;
    r.el.style.setProperty('--lc', r.color);
    r.lead.g.style.setProperty('--lc', r.color);
  }

  /* — priority ranking (unchanged) — */
  function rank() {
    const auto = [...L.values()].filter(r => r.explicitTier == null);
    const scored = auto
      .map(r => ({ r, s: scoreLabel(r.text), o: r.order }))
      .sort((a, b) => b.s - a.s || a.o - b.o);
    const total = L.size;
    const cap = total <= 4 ? total : Math.min(PRIMARY_CAP, Math.max(2, Math.ceil(total * 0.4)));
    let primaries = 0, secondaries = 0;
    for (const r of L.values()) if (r.explicitTier === 1) primaries++;
    for (const { r, s } of scored) {
      if (primaries < cap && (s > 0 || total <= 4 || primaries < 2)) { r.tier = 1; primaries++; }
      else if (secondaries < SECONDARY_CAP && s > -2) { r.tier = 2; secondaries++; }
      else { r.tier = 3; }
    }
    for (const r of L.values()) if (r.explicitTier != null) r.tier = r.explicitTier;
    dirtyRank = false;
  }

  /* — wrap→root offset: project() works in canvas coords, labels live in
       #labels-root. Probed at 4 Hz — they normally coincide. — */
  let offX = 0, offY = 0, offWrap = null, offAt = -1e9;
  function refreshWrapOffset(wrap) {
    const t = performance.now();
    if (wrap === offWrap && t - offAt < 250) return;
    offWrap = wrap; offAt = t;
    const wr = wrap.getBoundingClientRect(), rr = root.getBoundingClientRect();
    offX = wr.left - rr.left; offY = wr.top - rr.top;
  }

  /* — dock band: the vertical span between the shell's UI cards, probed 4 Hz — */
  let bandCache = [8, Math.max(200, innerHeight - 8)], bandH = -1, bandAt = -1e9;
  function measureBand(H) {
    const t = performance.now();
    if (t - bandAt < 250 && bandH === H) return bandCache;
    bandAt = t; bandH = H;
    let top = 8, bottom = H - 8;
    /* #labels-root is clipped to the stage (below the header, above the dock), so measure in ITS coordinates */
    const oy = root.getBoundingClientRect().top || 0;
    const bumpTop = id => { const el = document.getElementById(id); if (!el) return;
      const r = el.getBoundingClientRect(); if (r.height > 4) top = Math.max(top, r.bottom - oy + 10); };
    const bumpBot = id => { const el = document.getElementById(id); if (!el) return;
      const r = el.getBoundingClientRect(); if (r.height > 4) bottom = Math.min(bottom, r.top - oy - 10); };
    if (Array.isArray(options.band)) { top = options.band[0]; bottom = options.band[1]; }
    else {
      bumpTop('ui-top-stack'); bumpTop('ui-slot-tl'); bumpTop('ui-slot-tr');
      bumpBot('ui-slot-bl'); bumpBot('ui-slot-br'); bumpBot('ui-slot-bc'); bumpBot('module-controls');
    }
    if (bottom - top < 150) { top = 8; bottom = H - 8; }   // degenerate → ignore UI
    bandCache = [top, bottom];
    return bandCache;
  }

  /* — column side with hysteresis (no oscillation at the mid-line) — */
  function sideOf(r, W) {
    if (r.side < 0) return r.ax > W * SIDE_ON  ? 1 : -1;
    if (r.side > 0) return r.ax < W * SIDE_OFF ? -1 : 1;
    return r.ax < W * 0.5 ? -1 : 1;
  }

  /* — slot layout for one column. Ordering by anchor height keeps leader
       lines monotone → they never cross each other within a column. — */
  function layoutCol(list, band) {
    if (!list.length) return;
    list.sort((a, b) => a.ay - b.ay || a.order - b.order);
    for (const r of list) if (!r.w) { r.w = 110; r.h = 24; }    // provisional until measured
    const [top, bottom] = band, room = bottom - top;

    /* overflow: detail labels yield first, then secondary — never primary */
    let members = list;
    for (const t of [3, 2]) {
      const need = members.reduce((s, r) => s + r.h, 0) + MIN_GAP * (members.length - 1);
      if (need > room && members.some(r => r.tier >= t)) {
        const keep = members.filter(r => r.tier < t);
        if (keep.length) members = keep; else break;
      }
    }
    for (const r of list) r.drop = !members.includes(r);

    const sum = members.reduce((s, r) => s + r.h, 0);
    const n = members.length;
    const gap = n > 1 ? Math.min(MAXGAP, Math.max(MIN_GAP, (room - sum) / (n - 1))) : 0;
    const total = sum + gap * (n - 1);
    let y = top + Math.max(0, (room - total) / 2);               // centre the stack
    for (const r of members) { r.slotY = y + r.h / 2; y += r.h + gap; }
  }

  function solve(now, W, band) {
    const left = [], right = [];
    for (const r of L.values()) {
      if (!r.want) { r.drop = false; continue; }
      const s = sideOf(r, W);
      if (r.side !== 0 && s !== r.side) { r.swapAt = now; r.swapped = false; }   // fade-teleport, never slide
      r.side = s;
      (s < 0 ? left : right).push(r);
    }
    layoutCol(left, band);
    layoutCol(right, band);
  }

  /* — public API — */
  const api = {
    add(id, text, arg) {
      if (L.has(id)) api.remove(id);
      const opts = (arg && typeof arg === 'object') ? arg : { tier: arg };
      const tier = (opts.tier === 1 || opts.tier === 2 || opts.tier === 3) ? opts.tier : null;
      const kind = opts.kind && KINDS[opts.kind] ? opts.kind : inferKind(text);
      const el = makeEl(text);
      root.appendChild(el);
      const rec = {
        id, text, el, textEl: el.querySelector('.label3d-text'),
        lead: makeLine(), order: order++,
        explicitTier: tier, tier: tier || 2, kind,
        color: opts.color || KINDS[kind].color,
        /* anchor (screen space) */
        ax: 0, ay: 0, seenValid: false, behind: true,
        /* dock state */
        side: 0, swapAt: 0, swapped: false, slotY: 0,
        w: 0, h: 0, x: 0, y: 0, alpha: 0, placed: false,
        /* lifecycle */
        seen: -Infinity, shown: false, sized: false, want: false, drop: false,
        /* DOM diff keys */
        lastT: '', lastTier: 0, lastA: '',
      };
      applyStyle(rec);
      L.set(id, rec);
      dirtyRank = true;
      ensureLoop();
    },
    remove(id) {
      const r = L.get(id); if (!r) return;
      r.el.remove(); r.lead.g.remove(); L.delete(id);
      dirtyRank = true; lastSig = '';
      ensureLoop();
    },
    setText(id, text) {
      const r = L.get(id); if (!r || r.text === text) return;
      r.text = text; r.textEl.textContent = text; r.sized = false;
      if (r.explicitTier == null) dirtyRank = true;
      lastSig = '';
      ensureLoop();
    },
    setTier(id, tier) { const r = L.get(id); if (r) { r.explicitTier = tier; dirtyRank = true; lastSig = ''; ensureLoop(); } },
    setKind(id, kind) {
      const r = L.get(id); if (!r || !KINDS[kind]) return;
      r.kind = kind; r.color = KINDS[kind].color; applyStyle(r); ensureLoop();
    },
    setDensity(level) {
      level = Math.max(0, Math.min(2, level | 0));
      if (level === density) return;
      density = level; shared.density = level;
      listeners.forEach(fn => { try { fn(level); } catch (_) {} });
      ensureLoop();
    },
    getDensity() { return density; },
    cycleDensity() {
      const i = DENSITY_INFO.findIndex(d => d.level === density);
      const next = DENSITY_INFO[(i + 1) % DENSITY_INFO.length].level;
      api.setDensity(next);
      return next;
    },
    onDensity(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /* Advisory no-op (old per-frame pattern); hideAll(true) forces a hide. */
    hideAll(force) { if (force) { for (const r of L.values()) r.seen = 0; ensureLoop(); } },
    hide(id) { const r = L.get(id); if (r) { r.seen = 0; ensureLoop(); } },
    project(id, world, camera, wrap) {
      const r = L.get(id); if (!r) return;
      if (density === 0 || !wrap) return;
      const w = wrap.clientWidth, h = wrap.clientHeight;
      if (!w || !h) return;
      refreshWrapOffset(wrap);
      _v.copy(world).project(camera);
      r.behind = _v.z > 1 || _v.z < -1;
      r.seen = performance.now();          // still "seen" while behind → stays docked, just dimmed
      if (r.behind) { ensureLoop(); return; }
      const nx = (_v.x * 0.5 + 0.5) * w + offX;
      const ny = (-_v.y * 0.5 + 0.5) * h + offY;
      /* deadband: ignore sub-pixel noise so a still model gives still lines */
      if (!r.seenValid || Math.abs(nx - r.ax) > DEADBAND || Math.abs(ny - r.ay) > DEADBAND) {
        r.ax = nx; r.ay = ny; r.seenValid = true;
      }
      ensureLoop();
    },
    /* Force a re-measure of the dock band + slots (call after UI changes). */
    relayout() { bandAt = -1e9; lastSig = ''; ensureLoop(); },
    dispose() {
      for (const id of [...L.keys()]) api.remove(id);
      listeners.clear();
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (shared.system === api) shared.system = null;
    },
    get labels() { return L; },
    kinds: KINDS,
  };

  /* ── layout loop (independent of the module's animation loop) ───────── */
  function ensureLoop() { if (!raf) raf = requestAnimationFrame(tick); }

  function tick(now) {
    raf = 0;
    const dt = Math.min(0.1, Math.max(0.001, (now - lastNow) / 1000));
    lastNow = now;
    if (dirtyRank) rank();

    const W = root.clientWidth || innerWidth;
    const H = root.clientHeight || innerHeight;
    const ws = String(W), hs = String(H);
    if (svg.getAttribute('width') !== ws || svg.getAttribute('height') !== hs) {
      svg.setAttribute('width', ws); svg.setAttribute('height', hs);
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    }

    /* visibility pass */
    let anyWant = false, anyShown = false;
    for (const r of L.values()) {
      r.want = density > 0 && r.tier <= density && (now - r.seen) < graceMs;
      if (r.want) anyWant = true;
      if (r.shown) anyShown = true;
    }

    /* solve pass — structural changes solve instantly; order drift at ≤ 4 Hz */
    const band = measureBand(H);
    let sig = density + '|' + (band[0] | 0) + ':' + (band[1] | 0) + '|' + W + '|';
    for (const r of L.values()) if (r.want) sig += r.id + r.tier + ',';
    if (sig !== lastSig || now - lastSolve >= solveMs) {
      lastSig = sig; lastSolve = now;
      solve(now, W, band);
    }

    /* commit pass — eased, frame-rate independent, diffed writes */
    const kY = reduced ? 1 : 1 - Math.pow(0.82, dt * 60);   // ≈ 0.18 / 60 Hz frame
    const kA = reduced ? 1 : Math.min(1, dt * 9);

    for (const r of L.values()) {
      const show = r.want && !r.drop;
      if (!show) {
        if (r.shown) {
          r.shown = false; r.placed = false; r.alpha = 0;
          r.el.classList.remove('visible'); r.lead.g.classList.remove('visible');
          /* clear inline opacity so the CSS hide-transition can run */
          r.el.style.opacity = ''; r.lead.g.style.opacity = '';
          r.lastA = '';
        }
        continue;
      }
      if (!r.shown) {
        r.shown = true; r.sized = false;
        r.el.classList.add('visible'); r.lead.g.classList.add('visible');
      }
      if (!r.sized) {
        const b = r.el.getBoundingClientRect();
        if (b.width > 1) { r.w = b.width; r.h = b.height; r.sized = true; }
      }

      const tx = r.side < 0 ? MARGIN : W - MARGIN - r.w;   // gutter x (left coord)
      const ty = r.slotY - r.h / 2;                          // slot centre → top-left

      /* column swap: fade out at the old slot, teleport, fade in — the
         label never glides across the middle of the model */
      let aT = r.behind ? 0.32 : 1;
      if (r.swapAt) {
        const e = now - r.swapAt;
        if (e < SWAP_MS * 0.45) aT = 0;
        else if (!r.swapped) { r.x = tx; r.y = ty; r.swapped = true; }
        if (e >= SWAP_MS) r.swapAt = 0;
      }
      if (!r.swapAt) {                                       // normal easing (frozen mid-swap)
        if (!r.placed) { r.x = tx; r.y = ty; r.placed = true; }
        else { r.x += (tx - r.x) * kY; r.y += (ty - r.y) * kY; }
      }
      r.alpha += (aT - r.alpha) * kA;

      r.x = Math.max(2, Math.min(W - r.w - 2, r.x));
      r.y = Math.max(2, Math.min(H - r.h - 2, r.y));

      const t = `translate3d(${Math.round(r.x)}px,${Math.round(r.y)}px,0)`;
      if (t !== r.lastT) { r.el.style.transform = t; r.lastT = t; }
      const a = Math.round(r.alpha * 100) / 100;
      const aKey = (r.behind ? 'b' : 'l') + a;
      if (aKey !== r.lastA) {
        r.el.style.opacity = a;
        r.lead.g.style.opacity = r.behind ? '0' : String(a);
        r.lastA = aKey;
      }
      if (r.tier !== r.lastTier) {
        r.el.dataset.tier = r.tier; r.lead.g.dataset.tier = r.tier;
        r.lastTier = r.tier;
      }

      /* elbow leader: label edge → short horizontal stub → anchor */
      const ly = r.y + r.h / 2;
      const lx = r.side < 0 ? r.x + r.w : r.x;
      const ex = r.side < 0 ? lx + ELBOW : lx - ELBOW;
      const useElbow = r.side < 0 ? r.ax > ex : r.ax < ex;
      const pts = (useElbow
        ? `${lx.toFixed(1)},${ly.toFixed(1)} ${ex.toFixed(1)},${ly.toFixed(1)} ${r.ax.toFixed(1)},${r.ay.toFixed(1)}`
        : `${lx.toFixed(1)},${ly.toFixed(1)} ${r.ax.toFixed(1)},${r.ay.toFixed(1)}`);
      r.lead.line.setAttribute('points', pts);
      r.lead.pt.setAttribute('cx', r.ax.toFixed(1));
      r.lead.pt.setAttribute('cy', r.ay.toFixed(1));
    }

    /* idle stop: park when nothing is shown or pending; mutators re-arm */
    if (anyWant || anyShown) ensureLoop();
  }

  /* The toolbar button lives in kit.js; expose the legend for it */
  api.legendHTML = () =>
    `<div class="lab-legend"><b>Priority</b>
       <span class="lg-p1"><i></i>Primary</span><span class="lg-p2"><i></i>Secondary</span><span class="lg-p3"><i></i>Detail</span>
     </div>
     <div class="lab-legend"><b>Colour</b>${Object.values(KINDS).map(k => `<span style="--lc:${k.color}"><i></i>${k.name}</span>`).join('')}</div>`;

  shared.system = api;
  return api;
}
