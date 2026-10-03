/* ═══════════════════════════════════════════════════════════════════════
   components.js — Auto Lab shared components (v2.0)

   ONE place for the parts every module used to copy-paste, so all modules
   look and behave the same.

   Exports
   ───────
   Parts                  Shared 3D parts: tubeBetween, coilSpring, additivePoints, DEG, TAU.
   createGeoKit(ctx)      Standard 3D helpers: mat, glass, glow, box, cyl, cylX,
                          cylZ, sph, tor, pipe, stream, V3, clamp, lerp, lc, put.
   Widgets                HTML builders for the side-panel tabs (overview, faults,
                          quiz), readout grid and legend + quiz click handling.
   runGuidedModule(CFG, build)
                          Complete "guided module" runtime (scene, panel, tabs,
                          slider, chip, labels, animation loop). A module is only
                          its CFG (text/quiz/readouts) and build(H) (the 3D parts).

   Use in a module:
     <link rel="stylesheet" href="app.css">
     <link rel="stylesheet" href="components.css">
     <script type="module">
       import { runGuidedModule } from './components.js';
       const CFG = {...};
       function build(H){ ...return { labels:[...], update(c){...} }; }
       runGuidedModule(CFG, build);
     </script>
   ═══════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import * as Base from './kit.js';
import { controls } from './controls.js';
export { controls };

/* ── 3D geometry kit ─────────────────────────────────────────────── */
export function createGeoKit({ root, lowEnd, ptex }) {
  const mat   = (c, m = 0.6, r = 0.4, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: m, roughness: r }, o));
  const glass = (c, op = 0.22) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.1, roughness: 0.2, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide });
  const glow  = (c, i = 1.2) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, metalness: 0, roughness: 0.5 });
  const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const lc = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), clamp(t));
  function put(o, x, y, z, p) { o.position.set(x || 0, y || 0, z || 0); o.castShadow = !lowEnd; (p || root).add(o); return o; }
  const box  = (w, h, d, m, x, y, z, p) => put(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z, p);
  const cyl  = (rt, rb, h, m, x, y, z, p, seg = 32, open = false) => put(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), m), x, y, z, p);
  const cylX = (rt, rb, h, m, x, y, z, p, seg, open) => { const o = cyl(rt, rb, h, m, x, y, z, p, seg, open); o.rotation.z = Math.PI / 2; return o; };
  const cylZ = (rt, rb, h, m, x, y, z, p, seg, open) => { const o = cyl(rt, rb, h, m, x, y, z, p, seg, open); o.rotation.x = Math.PI / 2; return o; };
  const sph  = (r, m, x, y, z, p) => put(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), m), x, y, z, p);
  const tor  = (R, r, m, x, y, z, p) => put(new THREE.Mesh(new THREE.TorusGeometry(R, r, 12, 44), m), x, y, z, p);
  function pipe(pts, r, m, p) {
    const c = new THREE.CatmullRomCurve3(pts.map(V3));
    const me = new THREE.Mesh(new THREE.TubeGeometry(c, Math.max(8, pts.length * 10), r, 10, false), m);
    (p || root).add(me); return me;
  }
  function stream(pts, n, color, size, closed) {
    const curve = new THREE.CatmullRomCurve3(pts.map(V3), !!closed);
    const pos = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color, size: size || 0.1, map: ptex, transparent: true, depthWrite: false, opacity: 0.9, blending: THREE.AdditiveBlending });
    const P = new THREE.Points(g, m);
    P.frustumCulled = false; root.add(P);
    const v = new THREE.Vector3();
    return {
      points: P, mat: m,
      update(time, speed, density) {
        const cnt = Math.round(n * clamp(density == null ? 1 : density));
        for (let i = 0; i < n; i++) {
          if (i >= cnt) { pos[i * 3] = pos[i * 3 + 1] = pos[i * 3 + 2] = 1e4; continue; }
          let u = ((i / n) + time * speed) % 1; if (u < 0) u += 1;
          curve.getPointAt(u, v);
          pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
        }
        g.attributes.position.needsUpdate = true;
      }
    };
  }
  return { THREE, root, lowEnd, mat, glass, glow, V3, clamp, lerp, lc, put, box, cyl, cylX, cylZ, sph, tor, pipe, stream, Parts, Base };
}


/* ── Shared 3D parts (v3.0) ──────────────────────────────────────────
   Canonical versions of parts that several modules used to define on
   their own. Geometry is identical to the originals they replace.      */
export const Parts = {
  DEG: Base.DEG,
  TAU: Base.TAU,

  /* Straight cylinder joining points a and b (Vector3). */
  tubeBetween(a, b, r, mat, segments = 8) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, segments), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return m;
  },

  /* Helical coil spring as a tube.
     axis 'y' -> x=cos, z=sin, runs along Y      axis 'z' -> x=cos, y=sin, runs along Z
     centered -> spans -length/2..+length/2      otherwise 0..length
     samples  -> path points (default turns * samplesPerTurn)                          */
  coilSpring({ radius, length, turns, wire, mat, axis = 'y', centered = true, samplesPerTurn = 18, samples, radial = 6 }) {
    const N = samples || Math.round(turns * samplesPerTurn);
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, a = t * turns * Math.PI * 2;
      const along = (centered ? -length / 2 : 0) + t * length;
      pts.push(axis === 'z'
        ? new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, along)
        : new THREE.Vector3(Math.cos(a) * radius, along, Math.sin(a) * radius));
    }
    return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N, wire, radial, false), mat);
  },

  /* Additive glowing point cloud used by every flow / electron / oil stream.
     opts.color -> single material colour;  otherwise a per-point colour attribute is created. */
  additivePoints(tex, count, size, opacity, opts = {}) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const pm = { map: tex, size, sizeAttenuation: true, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending };
    if (opts.color !== undefined) pm.color = opts.color;
    else { geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3)); pm.vertexColors = true; }
    const mat = new THREE.PointsMaterial(pm);
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    if (opts.renderOrder !== undefined) points.renderOrder = opts.renderOrder;
    if (opts.parent) opts.parent.add(points);
    return { geo, mat, points, pts: points };
  }
};

/* ── Side-panel widgets ──────────────────────────────────────────── */
export const Widgets = {
  overview: (cfg) => cfg.overview,
  faults: (cfg) => '<div class="al-sec"><h4>Common faults</h4></div>' + cfg.faults.map(f =>
    `<div class="al-fault"><div class="t">${f[0]}</div><div class="s">${f[1]}</div><div class="c">Check: ${f[2]}</div></div>`).join(''),
  quiz: (cfg) => cfg.quiz.map((q, n) => `<div class="al-q" data-a="${q[2]}"><div class="q">${n + 1}. ${q[0]}</div>` +
    q[1].map(o => `<button class="al-opt">${o}</button>`).join('') + `<div class="al-exp">${q[3]}</div></div>`).join(''),
  readout: (cfg) => '<div class="al-read">' + cfg.ro.map(r =>
    `<span class="k">${r[1]}</span><span class="v${r[2] ? ' ' + r[2] : ''}" id="ro-${r[0]}"></span>`).join('') + '</div>',
  legend: (cfg) => '<div class="al-legend">' + cfg.legend.map(l => `<span><i style="background:${l[0]}"></i>${l[1]}</span>`).join('') + '</div>',
  /* one click handler for every .al-q self-check question inside `host` */
  wireQuiz(host) {
    host.addEventListener('click', (e) => {
      const btn = e.target.closest('.al-opt'); if (!btn) return;
      const q = btn.closest('.al-q'); if (!q || q.classList.contains('done')) return;
      const answer = Number(q.dataset.a);
      q.classList.add('done');
      q.querySelectorAll('.al-opt').forEach((o, i) => { o.disabled = true; if (i === answer) o.classList.add('ok'); else if (o === btn) o.classList.add('no'); });
    });
  }
};

/* Phase 3 — slider specs for a guided module.
   CFG.ctls[] is the list (each = controls.js axis spec + optional onChange(real, raw, norm)).
   CFG.ctl { label, val, caption } is kept as a shim and maps to ctls[0] = the module's main 0-100 % control
   (id 'ctl'; the simulation reads it as k = value / 100, and apply({ctl:'…'}) sets its readout text). */
export function guidedCtls(CFG) {
  if (Array.isArray(CFG.ctls) && CFG.ctls.length) return CFG.ctls;
  if (CFG.ctl === null) return [];                 /* no main slider: the module reads a choice instead (lighting) */
  const c = CFG.ctl || { label: 'Control', val: 0 };
  return [{ id: 'ctl', label: c.label, caption: c.caption, preset: 'percent', def: c.val, min: 0, max: 100, step: 1 }];
}

/* ── Guided-module runtime ───────────────────────────────────────── */
export function runGuidedModule(CFG, build) {
const state = Base.createUIState();
const built = Base.buildScene({ fov: 42, camPos: CFG.camPos, target: CFG.target, floorY: CFG.floorY, fogDensity: 0.03 });
const { scene, camera, renderer, controls, wrap, viewManager, quality } = built;
Base.attachResize(camera, renderer, wrap, built.baseFov);
const lowEnd = quality.isLowEnd;
const root = new THREE.Group();
scene.add(root);
const ptex = Base.createParticleTexture();
const H = createGeoKit({ root, lowEnd, ptex });
const { V3 } = H;

const CTLS = guidedCtls(CFG);
const mod = build(H);

/* ── Labels ──────────────────────────────────────────────────────── */
const labels = Base.createLabelSystem();
mod.labels.forEach((l, i) => labels.add('l' + i, l[0]));
const lpos = mod.labels.map(l => V3(l[1]));

/* ── UI ──────────────────────────────────────────────────────────── */
const TABS = {
  overview: () => Widgets.overview(CFG),
  faults: () => Widgets.faults(CFG),
  quiz: () => Widgets.quiz(CFG)
};
/* Phase 7a — the old panel `ro-*` grid is now Monitor rows. A row whose label equals the big-value label (chipLabel)
   would print the same number twice, so it is dropped here (its id is simply ignored by apply()); chip rows that
   duplicate a `ro` id share the one row. See MONITOR-MAP.md. */
const _lbl = (t) => String(t || '').trim().toLowerCase();
const _roIds = new Set(CFG.ro.map((r) => r[0]));
const MON_ROWS = CFG.ro.filter((r) => _lbl(r[1]) !== _lbl(CFG.chipLabel)).map((r) => [r[0], r[1]]);
CFG.rows.forEach((r) => { if (!_roIds.has(r[0]) && _lbl(r[1]) !== _lbl(CFG.chipLabel)) MON_ROWS.push([r[0], r[1]]); });

const ui = Base.UI.create({
  moduleId: CFG.moduleId,
  panel: {
    kicker: CFG.kicker, title: CFG.title,
    tabs: [{ id: 'overview', label: 'Overview' }, { id: 'faults', label: 'Faults' }, { id: 'quiz', label: 'Self-check' }],
    onTab: renderTab,
    badge: { text: CFG.badge, color: CFG.accent }
  },
  monitor: {
    config: { label: CFG.chipLabel, value: { label: CFG.chipLabel, unit: '', max: 100, bar: true }, rows: MON_ROWS, traces: CFG.traces || [], status: { text: 'Running' } },
    initial: { value: { text: '', unit: '', barColor: 'var(--al-accent)' }, status: ['Running', false] }
  },
  toolbar: { play: true, reset: true, speed: { label: 'Sim speed', min: 0.15, max: 2.5, step: 0.05, value: 0.85 }, labels: true },
  axes: CTLS.map((c, i) => Object.assign({ side: i % 2 ? 'right' : 'left' }, c)),
  options: CFG.options || [],                      /* Phase 6: choice / toggle / action (dock options row) */
  widgets: {
    br: { html: Widgets.legend(CFG), caption: 'Legend' }
  }
});
const tabHost = document.createElement('div');
tabHost.className = 'al-tabs';
ui.panel.body.appendChild(tabHost);
Widgets.wireQuiz(tabHost);
function renderTab(id) { tabHost.innerHTML = (TABS[id] || TABS.overview)(); }
renderTab('overview');

const mainAxis = ui.axis('ctl');                  /* the 0-100 % control the simulation reads as k */
let k = mainAxis ? mainAxis.get() : 0;
if (mainAxis) mainAxis.on((n) => { k = n; refresh(0); });

let simT = 0;
function apply(o) {
  if (!o) return;
  const p = {};
  if (o.big != null || o.bar != null) {
    p.value = {};
    if (o.big != null) { p.value.text = String(o.big); p.value.unit = o.unit || ''; }
    if (o.bar != null) { p.value.bar = o.bar; p.value.barColor = 'var(--al-accent)'; }
  }
  if (o.rows || o.ro) {
    p.rows = {};
    if (o.rows) for (const id in o.rows) p.rows[id] = o.rows[id];
    if (o.ro) for (const id in o.ro) p.rows[id] = [o.ro[id][0], o.ro[id][1] || ''];
  }
  if (o.status) p.status = [o.status[0], o.status[1], o.status[2] || ''];
  ui.monitor.update(p);
  if (o.ctl != null && mainAxis) mainAxis.setText(o.ctl);
}
/* Phase 7a: `traces: { id: [v…] | null }` from mod.update() goes straight to the Monitor on every call (a sample is
   returned only when one is due; null clears the trace on Reset). Text rows stay on the ~8 Hz apply() cadence. */
function pushTraces(o) { if (o && o.traces) ui.monitor.update({ traces: o.traces }); }
function refresh(dt) { const o = mod.update({ t: simT, dt, k, sp: state.playing ? state.speedMul : 0 }); pushTraces(o); apply(o); }

const bridge = ui.wireBridge({
  viewManager, state,
  onCommand: (d) => {
    if (d.action === 'reset') { if (typeof CFG.onReset === 'function') CFG.onReset(); controls.resetAll(); k = mainAxis ? mainAxis.get() : 0; simT = 0; refresh(0); }
  }
});
bridge.ready();
bridge.setStatus(CFG.title + ' ready', CFG.accent);

/* ── Animation ───────────────────────────────────────────────────── */
let last = performance.now(), raf = 0, roClock = 1;
const tmp = new THREE.Vector3();
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const sp = state.playing ? state.speedMul : 0;
  simT += dt * sp;
  const o = mod.update({ t: simT, dt: dt * sp, k, sp });
  roClock += dt;
  pushTraces(o);
  if (roClock > 0.12) { roClock = 0; apply(o); }
  labels.hideAll();
  if (state.showLabels) lpos.forEach((p, i) => labels.project('l' + i, p, camera, wrap));
  controls.update();
  renderer.render(scene, camera);
}
if (reduced) { setInterval(() => { refresh(0); renderer.render(scene, camera); }, 120); }
else raf = requestAnimationFrame(frame);
document.addEventListener('visibilitychange', () => {
  if (reduced) return;
  if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  else if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
});
refresh(0);
}
