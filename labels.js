/* ═══════════════════════════════════════════════════════════════════════
   labels.js — Auto Lab shared 3D label engine.

   Every module already calls   const labels = Base.createLabelSystem();
   and then                     labels.add(id, text[, tier]) / labels.project(...)
   kit.js re-exports THIS implementation, so all modules pick it up with
   zero per-file changes.

   What it does
   ────────────
   1. PRIORITY   Every label is PRIMARY (1), SECONDARY (2) or DETAIL (3).
                 Explicit tier wins; otherwise it is inferred (see rank()).
                 Density button cycles  All → Key parts → None:
                   All  = primary + secondary + detail
                   Key  = primary only
                   None = nothing
   2. COLOUR     Each label is colour-coded by what it IS (air, exhaust,
                 fuel, coolant, electrical, control, hot/combustion,
                 mechanical). Primary = solid pill, secondary = outlined,
                 detail = small & translucent.
   3. LINES      A leader line + anchor dot joins each label to the exact
                 3D point it names and follows it as the model orbits.
   4. STABLE     No more flicker: visibility is decided by a small state
                 machine (grace period + hysteresis), not by "did the
                 module call project() this exact frame".
   5. DECLUTTER  Overlapping labels are pushed apart in screen space;
                 if they still collide, the lower priority one yields.

   Public API (superset of the old one — nothing removed)
   ──────────────────────────────────────────────────────
     add(id, text, tier?|opts?)   opts: { tier, kind, color }
     project(id, worldVec3, camera, wrap)
     setText(id, text)            hide(id)   hideAll()   remove(id)
     setDensity(0|1|2)   getDensity()   cycleDensity()
     setTier(id, 1|2|3)  setKind(id, kind)
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

/* ── Priority inference ───────────────────────────────────────────────
   An explicit tier always wins. Otherwise a label is scored:
     +3  names a major assembly / principal component
     −2  is a readout, number, pin, sign or flow description
     −1  names a fastener / minor sub-part
   The best PRIMARY_CAP scorers (ties → order added) become PRIMARY, the
   next batch SECONDARY, the rest DETAIL. The cap keeps "Key parts" mode
   uncluttered even on modules with 20+ labels.                          */
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

/* ── The system ───────────────────────────────────────────────────────── */
const GRACE_MS   = 180;   // keep a label alive this long after the last project()
const FADE_IN_MS = 120;
const PAD        = 4;     // declutter padding (px)

export function createLabelSystem(options = {}) {
  const root = document.getElementById('labels-root') || document.body;

  /* SVG layer for leader lines — created once, shared by all systems on the page */
  let svg = root.querySelector(':scope > svg.label-lines');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'label-lines');
    svg.setAttribute('aria-hidden', 'true');
    root.insertBefore(svg, root.firstChild);
  }

  const L = new Map();        // id → label record
  let order = 0;
  let density = DENSITY.ALL;
  let dirtyRank = true;
  let raf = 0;
  const listeners = new Set();

  window.__autolabDensity = density;

  /* — record helpers — */
  function makeEl(text) {
    const el = document.createElement('div');
    el.className = 'label3d';
    el.setAttribute('role', 'note');
    const dot = document.createElement('i');
    dot.className = 'label3d-dot';
    const span = document.createElement('span');
    span.className = 'label3d-text';
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

  function rank() {
    /* Assign auto tiers to every label with no explicit tier. */
    const auto = [...L.values()].filter(r => r.explicitTier == null);
    const scored = auto
      .map(r => ({ r, s: scoreLabel(r.text), o: r.order }))
      .sort((a, b) => b.s - a.s || a.o - b.o);
    /* Modules with very few labels: everything that isn't clearly minor is primary */
    const total = L.size;
    const cap = total <= 4 ? total : Math.min(PRIMARY_CAP, Math.max(2, Math.ceil(total * 0.4)));
    let primaries = 0, secondaries = 0;
    /* explicit primaries count toward the cap so hand-tuned modules stay in control */
    for (const r of L.values()) if (r.explicitTier === 1) primaries++;
    for (const { r, s } of scored) {
      if (primaries < cap && (s > 0 || total <= 4 || primaries < 2)) { r.tier = 1; primaries++; }
      else if (secondaries < SECONDARY_CAP && s > -2) { r.tier = 2; secondaries++; }
      else { r.tier = 3; }
    }
    for (const r of L.values()) if (r.explicitTier != null) r.tier = r.explicitTier;
    dirtyRank = false;
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
      const lead = makeLine();
      const rec = {
        id, text, el, textEl: el.querySelector('.label3d-text'),
        lead, order: order++, explicitTier: tier, tier: tier || 2,
        kind, color: opts.color || KINDS[kind].color,
        /* screen-space state */
        ax: 0, ay: 0, x: 0, y: 0, w: 0, h: 0, ox: 0, oy: 0,
        /* -Infinity, not 0: a label that has never been project()-ed must
           never be mistaken for "recently seen" just because the page's
           clock (performance.now()) is itself still a small number early
           in its lifetime. */
        seen: -Infinity, shown: false, shownAt: 0, placed: false, behind: true, sized: false,
      };
      applyStyle(rec);
      L.set(id, rec);
      dirtyRank = true;
      ensureLoop();
    },
    remove(id) {
      const r = L.get(id); if (!r) return;
      r.el.remove(); r.lead.g.remove(); L.delete(id); dirtyRank = true;
    },
    setText(id, text) {
      const r = L.get(id); if (!r || r.text === text) return;
      r.text = text; r.textEl.textContent = text; r.sized = false;
      if (r.explicitTier == null) dirtyRank = true;
    },
    setTier(id, tier) { const r = L.get(id); if (r) { r.explicitTier = tier; dirtyRank = true; } },
    setKind(id, kind) {
      const r = L.get(id); if (!r || !KINDS[kind]) return;
      r.kind = kind; r.color = KINDS[kind].color; applyStyle(r);
    },
    setDensity(level) {
      level = Math.max(0, Math.min(2, level | 0));
      if (level === density) return;
      density = level; window.__autolabDensity = level;
      listeners.forEach(fn => { try { fn(level); } catch (_) {} });
    },
    getDensity() { return density; },
    cycleDensity() {
      const i = DENSITY_INFO.findIndex(d => d.level === density);
      const next = DENSITY_INFO[(i + 1) % DENSITY_INFO.length].level;
      api.setDensity(next);
      return next;
    },
    onDensity(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /* The old API needed hideAll() at the top of every frame. It is now advisory:
       labels fade out on their own if no longer projected, so this must NOT force
       an instant hide (that was the flicker). hideAll(true) forces it. */
    hideAll(force) { if (force) for (const r of L.values()) r.seen = 0; },
    hide(id) { const r = L.get(id); if (r) r.seen = 0; },
    project(id, world, camera, wrap) {
      const r = L.get(id); if (!r) return;
      const w = wrap.clientWidth, h = wrap.clientHeight;
      if (!w || !h) return;
      _v.copy(world).project(camera);
      r.behind = _v.z > 1 || _v.z < -1;
      if (r.behind) return;                       // not "seen" → grace timer then fade
      r.ax = (_v.x * 0.5 + 0.5) * w;
      r.ay = (-_v.y * 0.5 + 0.5) * h;
      r.seen = performance.now();
      r.w0 = w; r.h0 = h;
    },
    get labels() { return L; },
    kinds: KINDS,
  };

  /* three.js is imported by kit.js, not here; we only need a tiny vector shim
     with copy() and project(camera) — borrow the caller's world vector's class. */
  const _v = { x: 0, y: 0, z: 0,
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; this._ctor = v.constructor; return this; },
    project(camera) {
      const V = this._ctor; const t = new V(this.x, this.y, this.z).project(camera);
      this.x = t.x; this.y = t.y; this.z = t.z; return this;
    } };

  function applyStyle(r) {
    r.el.dataset.kind = r.kind;
    r.el.style.setProperty('--lc', r.color);
    r.lead.g.style.setProperty('--lc', r.color);
  }

  /* — layout loop (independent of the module's own animation loop) — */
  function ensureLoop() { if (!raf) raf = requestAnimationFrame(tick); }

  function tick(now) {
    raf = 0;
    if (dirtyRank) rank();
    const vis = [];
    const wrapW = root.clientWidth || innerWidth, wrapH = root.clientHeight || innerHeight;
    if (svg.getAttribute('width') !== String(wrapW)) {
      svg.setAttribute('width', wrapW); svg.setAttribute('height', wrapH);
      svg.setAttribute('viewBox', `0 0 ${wrapW} ${wrapH}`);
    }

    for (const r of L.values()) {
      const wanted = density > 0 && r.tier <= density && !r.behind && (now - r.seen) < GRACE_MS;
      r.want = wanted;
      if (wanted) {
        if (!r.sized) { const b = r.el.getBoundingClientRect(); r.w = b.width || 60; r.h = b.height || 22; r.sized = true; }
        vis.push(r);
      }
    }

    /* Place: default offset up-and-right of the anchor; primaries first */
    vis.sort((a, b) => a.tier - b.tier || a.order - b.order);
    const placed = [];
    for (const r of vis) {
      const home = homeOffset(r, wrapW, wrapH);
      let tx = r.ax + home.dx, ty = r.ay + home.dy;
      /* push away from already-placed labels (vertical first, then alternate side) */
      let tries = 0;
      while (tries < 8 && placed.some(p => overlap(p, tx, ty, r.w, r.h))) {
        const step = (tries % 2 === 0 ? 1 : -1) * (Math.floor(tries / 2) + 1) * (r.h + PAD);
        ty = r.ay + home.dy + step;
        if (tries >= 4) tx = r.ax - home.dx - r.w * 0.2;
        tries++;
      }
      const collide = placed.some(p => overlap(p, tx, ty, r.w, r.h));
      /* a lower-priority label that still collides yields; primaries never do */
      r.yield = collide && r.tier > 1;
      /* keep on screen */
      tx = Math.max(4, Math.min(wrapW - r.w - 4, tx));
      ty = Math.max(4, Math.min(wrapH - r.h - 4, ty));
      /* smooth the motion so labels glide rather than jitter */
      if (!r.placed) { r.x = tx; r.y = ty; r.placed = true; }
      else { const k = 0.35; r.x += (tx - r.x) * k; r.y += (ty - r.y) * k; }
      if (!r.yield) placed.push({ x: r.x, y: r.y, w: r.w, h: r.h });
    }

    /* Commit to DOM */
    for (const r of L.values()) {
      const show = r.want && !r.yield;
      if (show) {
        if (!r.shown) { r.shown = true; r.shownAt = now; r.el.classList.add('visible'); r.lead.g.classList.add('visible'); }
        r.el.style.transform = `translate3d(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px, 0)`;
        r.el.dataset.tier = r.tier;
        r.lead.g.dataset.tier = r.tier;
        /* leader: from the label's nearest edge midpoint to the anchor */
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        const ex = r.ax < r.x ? r.x : (r.ax > r.x + r.w ? r.x + r.w : Math.max(r.x + 8, Math.min(r.x + r.w - 8, r.ax)));
        const ey = r.ay < r.y ? r.y : (r.ay > r.y + r.h ? r.y + r.h : cy);
        const mx = (ex + r.ax) / 2;
        r.lead.line.setAttribute('points', `${ex.toFixed(1)},${ey.toFixed(1)} ${mx.toFixed(1)},${ey.toFixed(1)} ${r.ax.toFixed(1)},${r.ay.toFixed(1)}`);
        r.lead.pt.setAttribute('cx', r.ax.toFixed(1));
        r.lead.pt.setAttribute('cy', r.ay.toFixed(1));
      } else if (r.shown) {
        r.shown = false; r.placed = false;
        r.el.classList.remove('visible'); r.lead.g.classList.remove('visible');
      }
    }
    /* keep running while any label exists */
    if (L.size) ensureLoop();
  }

  function homeOffset(r, W, H) {
    /* labels in the right third flip to the left so they never hang off-screen */
    const flip = r.ax > W * 0.66;
    const base = r.tier === 1 ? 22 : 16;
    return { dx: flip ? -(r.w + base) : base, dy: -(r.h + base * 0.9) };
  }
  function overlap(p, x, y, w, h) {
    return x < p.x + p.w + PAD && x + w + PAD > p.x && y < p.y + p.h + PAD && y + h + PAD > p.y;
  }

  /* The toolbar button lives in kit.js; expose the legend for it */
  api.legendHTML = () =>
    `<div class="lab-legend"><b>Priority</b>
       <span class="lg-p1"><i></i>Primary</span><span class="lg-p2"><i></i>Secondary</span><span class="lg-p3"><i></i>Detail</span>
     </div>
     <div class="lab-legend"><b>Colour</b>${Object.values(KINDS).map(k => `<span style="--lc:${k.color}"><i></i>${k.name}</span>`).join('')}</div>`;

  window.__autolabLabels = api;
  return api;
}
