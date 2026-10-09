/* balancer-machine.js — the MANATEC DL-65 style wheel balancer: red cabinet, weight tray, display on a stalk, side-mounted shaft, wheel,
   and the black safety hood. Rendering only (the physics is in balancing-model.js).
   Scene units: 1 unit = 1 m. Floor is y = 0. The shaft axis is X; the wheel's outer face points +X.
   Wheel angles run clockwise from 12 o'clock as seen from the outer face. */
import { buildTyre, buildRim } from '../Wheel alignment/alignment-parts.js';
import { getWheel, RAD } from './balancing-model.js';

export const AXLE_Y = 0.66, AXLE_X = 0.28;                 /* shaft height; x of the wheel's mid-plane */
const IN = 0.0254;

function canvasTex(THREE, w, h) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const t = new THREE.CanvasTexture(cv); if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace; return { cv, t };
}
const SEG = { ok: '#4ade80', warn: '#fbbf24', crit: '#f87171' };

export function buildBalancer(THREE, root) {
  const owned = [], mk = (o) => { owned.push(o); return o; };
  const std = (color, rough, metal, extra) => mk(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
  const M = { red: std(0xd6281c, 0.45, 0.25), dark: std(0x1b1d22, 0.6, 0.3), steel: std(0x9aa3ad, 0.35, 0.8), rubber: std(0x15171b, 0.92, 0), rim: std(0xcfd6de, 0.28, 0.85), cap: std(0x1f2937, 0.4, 0.5),
    hood: std(0x0e0f12, 0.5, 0.2, { side: THREE.DoubleSide }), weight: std(0xb8bec6, 0.4, 0.8), mark: std(0xef4444, 0.5, 0, { emissive: 0xef4444, emissiveIntensity: 0.6, transparent: true, opacity: 0.8 }),
    chalk: new THREE.MeshBasicMaterial({ color: 0xfacc15 }), plate: std(0xe5e7eb, 0.5, 0.2) };
  mk(M.chalk);
  const g = new THREE.Group(); root.add(g);
  const box = (w, h, d, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(mk(new THREE.BoxGeometry(w, h, d)), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };

  /* cabinet (red, tapered base), dark side panel, weight tray, foot brake pedal */
  box(0.62, 0.86, 0.56, M.red, -0.42, 0.43, 0); box(0.66, 0.05, 0.6, M.dark, -0.42, 0.885, 0);
  box(0.02, 0.6, 0.3, M.dark, -0.1, 0.5, 0.12); box(0.18, 0.04, 0.1, M.dark, -0.2, 0.02, 0.34);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) box(0.1, 0.035, 0.1, M.plate, -0.6 + i * 0.12, 0.915, -0.15 + j * 0.13);
  /* display on a stalk */
  box(0.06, 0.28, 0.06, M.dark, -0.52, 1.04, -0.16);
  const scr = canvasTex(THREE, 512, 256); mk(scr.t);
  const disp = box(0.46, 0.25, 0.04, M.dark, -0.52, 1.28, -0.16); disp.rotation.x = -0.18;
  const face = new THREE.Mesh(mk(new THREE.PlaneGeometry(0.42, 0.21)), mk(new THREE.MeshBasicMaterial({ map: scr.t }))); face.position.z = 0.022; disp.add(face);
  /* shaft and cone */
  const shaft = new THREE.Mesh(mk(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 20)), M.steel); shaft.rotation.z = Math.PI / 2; shaft.position.set(0.05, AXLE_Y, 0); g.add(shaft);

  /* wheel group: spins about X. Built per wheel type. */
  const wheelG = new THREE.Group(); wheelG.position.set(AXLE_X, AXLE_Y, 0); g.add(wheelG);
  let built = null; const fitted = new THREE.Group(); wheelG.add(fitted);
  const spotGeo = mk(new THREE.SphereGeometry(1, 14, 10)), spots = {};
  function setWheel(id) {
    if (built === id) return;
    built = id; [...wheelG.children].filter((c) => c !== fitted).forEach((c) => { wheelG.remove(c); c.traverse((o) => o.geometry && o.geometry.dispose()); });
    const w = getWheel(id), rimR = w.diaIn * IN / 2, R = rimR / 0.62, W = w.widthIn * IN + 0.06;
    wheelG.add(new THREE.Mesh(buildTyre(THREE, R, W, M).geometry, M.rubber), buildRim(THREE, R, W, M, 5, 1));
    wheelG.userData = { rimR, W, R, gap: w.planeGapMm / 1000 };
    const markA = new THREE.Mesh(mk(new THREE.BoxGeometry(0.012, 0.05, 0.012)), M.chalk); markA.position.set(W * 0.5, R * 0.985, 0); wheelG.add(markA);   /* chalk mark on the tyre: "the wheel's 12 o'clock" */
    ['inner', 'outer'].forEach((p) => { const s = new THREE.Mesh(spotGeo, M.mark); s.visible = false; wheelG.add(s); spots[p] = s; });
    const hub = new THREE.Mesh(mk(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20)), M.steel); hub.rotation.z = Math.PI / 2; hub.position.x = -W * 0.5; wheelG.add(hub);
  }

  /* a wheel-fixed position for a given plane and angle (cw from 12 as seen from the outer face) */
  const planeX = (p) => { const u = wheelG.userData; return p === 'inner' ? -u.gap / 2 : u.gap / 2; };
  const place = (m, p, a, r) => m.position.set(planeX(p), Math.cos(a * RAD) * r, -Math.sin(a * RAD) * r);

  /* heavy-spot markers (red glow on the tyre inner face of the plane) and fitted weights (grey blocks on the rim) */
  function setSpots(wheel, show) {
    const u = wheelG.userData;
    for (const p of ['inner', 'outer']) {
      const s = spots[p], h = wheel[p]; s.visible = show && h.g > 0;
      if (s.visible) { const k = 0.02 + Math.sqrt(h.g) * 0.006; s.scale.set(k, k, k); place(s, p, h.a, u.R * 0.9); }
    }
  }
  let fitKey = '';
  function setFitted(list) {
    const key = JSON.stringify(list); if (key === fitKey) return; fitKey = key;
    [...fitted.children].forEach((c) => fitted.remove(c));
    const u = wheelG.userData;
    list.forEach((w) => { const m = new THREE.Mesh(mk(new THREE.BoxGeometry(0.03, 0.016, 0.016 + w.g * 0.0007)), M.weight); place(m, w.plane, w.a, u.rimR * 0.93); m.rotation.x = -w.a * RAD; fitted.add(m); });
  }

  /* hood: half shell over the wheel, hinged on the shaft axis; open = swung to the rear */
  const hoodPivot = new THREE.Group(); hoodPivot.position.set(AXLE_X, AXLE_Y, 0); g.add(hoodPivot);
  const hood = new THREE.Mesh(mk(new THREE.CylinderGeometry(0.5, 0.5, 0.42, 36, 1, true, -Math.PI * 0.45, Math.PI * 1.1)), M.hood); hood.rotation.set(0, 0, Math.PI / 2);
  hoodPivot.add(hood);
  const setHood = (open) => { hoodPivot.rotation.x = -open * 2.1; };

  /* display (canvas) */
  let shown = '';
  function show(lines, sub) {
    const key = JSON.stringify([lines, sub]); if (key === shown) return; shown = key;
    const c = scr.cv.getContext('2d'); c.fillStyle = '#0a1118'; c.fillRect(0, 0, 512, 256);
    c.fillStyle = '#b91c1c'; c.fillRect(0, 0, 512, 40); c.fillStyle = '#fff'; c.font = 'bold 22px sans-serif'; c.fillText('MANATEC', 14, 28); c.font = '16px monospace'; c.textAlign = 'right'; c.fillText('WHEEL BALANCER', 498, 27); c.textAlign = 'left';
    lines.slice(0, 3).forEach(([label, text, tone], i) => {
      const y = 92 + i * 58; c.fillStyle = '#94a3b8'; c.font = '17px monospace'; c.fillText(label, 16, y - 16);
      c.fillStyle = tone === 'dim' ? '#334155' : (SEG[tone] || '#f87171'); c.font = 'bold 44px monospace'; c.textAlign = 'right'; c.fillText(text, 496, y + 14); c.textAlign = 'left'; c.fillStyle = '#1e293b'; c.fillRect(16, y + 24, 480, 2);
    });
    c.fillStyle = '#94a3b8'; c.font = '15px monospace'; c.fillText(String(sub || '').slice(0, 52), 14, 246); scr.t.needsUpdate = true;
  }

  return {
    group: g, wheelG, setWheel, setSpots, setFitted, setHood, show,
    /** spin the wheel by cw degrees (visual) */ setRotation(deg) { wheelG.rotation.x = -deg * RAD; },
    dispose() { root.remove(g); g.traverse((o) => o.geometry && o.geometry.dispose()); owned.forEach((o) => o.dispose && o.dispose()); }
  };
}
