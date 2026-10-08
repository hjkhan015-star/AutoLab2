/* alignment-parts.js — three.js builders for the Wheel Alignment module. Rendering only; every number comes from alignment-model.js.
   Scene units: 1 unit = 1 m. Car faces +Z, left side is +X (viewed from behind). Wheel groups spin about X and carry tyre, rim,
   brake disc, caliper, hub, knuckle, strut + spring, lower arm and (front) tie rod, so toe / camber / steer move all of it together. */
import { CORNERS, getPreset } from './alignment-model.js';

/* body proportions per preset (metres) */
const STYLES = {
  hatchback: { paint: 0x2b6cb0, ovF: 0.82, ovR: 0.72, belt: 1.0, nose: 0.78, tail: 1.0, roof: 1.52, roofF: 0.05, roofRo: 0.38, clear: 0.17, hatch: true },
  sports: { paint: 0xb91c1c, ovF: 0.95, ovR: 1.0, belt: 0.96, nose: 0.74, tail: 0.98, roof: 1.36, roofF: -0.12, roofRo: 1.4, clear: 0.14, hatch: false },
  suv: { paint: 0x374151, ovF: 0.9, ovR: 0.92, belt: 1.2, nose: 1.0, tail: 1.22, roof: 1.8, roofF: 0.18, roofRo: 0.2, clear: 0.24, hatch: true }
};
const styleOf = (id) => STYLES[id] || STYLES.hatchback;

/** Tyre: sidewall bulge, rounded shoulders, four circumferential tread ribs. Profile points are evenly spaced across the tread so the wear texture maps cleanly. */
export function buildTyre(THREE, radius, width, mats) {
  const w = width / 2, r = radius, rr = r * 0.62, pts = [], P = (rad, y) => pts.push(new THREE.Vector2(rad, y));
  P(rr, -w * 0.86); P(rr + (r - rr) * 0.25, -w); P(rr + (r - rr) * 0.62, -w * 0.97); P(r * 0.985, -w * 0.82); P(r * 0.997, -w * 0.62);
  const n = 16;
  for (let i = 0; i <= n; i++) P(r - (i === 4 || i === 8 || i === 12 ? 0.007 : 0), -w * 0.55 + (i / n) * w * 1.1);
  P(r * 0.997, w * 0.62); P(r * 0.985, w * 0.82); P(rr + (r - rr) * 0.62, w * 0.97); P(rr + (r - rr) * 0.25, w); P(rr, w * 0.86);
  const g = new THREE.LatheGeometry(pts, 64); g.rotateZ(Math.PI / 2);          /* axis along X */
  return new THREE.Mesh(g, mats.rubber);
}

/** Alloy wheel: barrel with lips, ten twin spokes, centre cap and five lug nuts. `sign` = +1 faces +X (left wheel), −1 faces −X. */
export function buildRim(THREE, radius, width, mats, spokes = 5, sign = 1) {
  const grp = new THREE.Group(), rr = radius * 0.62, W = width;
  const prof = [[0.90, -0.40], [1.0, -0.42], [1.0, -0.36], [0.93, -0.30], [0.93, 0.30], [1.0, 0.36], [1.0, 0.42], [0.90, 0.40]].map(([k, y]) => new THREE.Vector2(rr * k, y * W));
  const barrel = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), mats.rim); barrel.rotation.z = Math.PI / 2; grp.add(barrel);
  const x = sign * W * 0.2;
  const face = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.2, rr * 0.2, W * 0.14, 24), mats.rim); face.rotation.z = Math.PI / 2; face.position.x = x; grp.add(face);
  for (let i = 0; i < spokes; i++) {
    for (const off of [-0.11, 0.11]) {
      const a = (i / spokes) * Math.PI * 2 + off, sp = new THREE.Mesh(new THREE.BoxGeometry(W * 0.07, rr * 0.7, rr * 0.075), mats.rim);
      sp.position.set(x, Math.cos(a) * rr * 0.58, Math.sin(a) * rr * 0.58); sp.rotation.x = a; grp.add(sp);
    }
    const a2 = (i / spokes) * Math.PI * 2, nut = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.028, rr * 0.028, W * 0.06, 6), mats.steel);
    nut.rotation.z = Math.PI / 2; nut.position.set(x + sign * W * 0.05, Math.cos(a2) * rr * 0.17, Math.sin(a2) * rr * 0.17); grp.add(nut);
  }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.1, rr * 0.1, W * 0.04, 20), mats.cap); cap.rotation.z = Math.PI / 2; cap.position.x = x + sign * W * 0.08; grp.add(cap);
  return grp;
}

/** One corner: tyre + rim + brake + suspension hardware. */
function buildWheel(THREE, R, W, mats, sign, front) {
  const g = new THREE.Group(), rr = R * 0.62, add = (m, x, y, z) => { m.position.set(x, y, z); g.add(m); return m; };
  g.add(buildTyre(THREE, R, W, mats), buildRim(THREE, R, W, mats, 5, sign));
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.84, rr * 0.84, 0.026, 40), mats.disc); disc.rotation.z = Math.PI / 2; add(disc, -sign * W * 0.04, 0, 0);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.3, rr * 0.3, 0.05, 20), mats.disc); hat.rotation.z = Math.PI / 2; add(hat, -sign * W * 0.1, 0, 0);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.07, rr * 0.5, rr * 0.55), mats.caliper), -sign * W * 0.04, rr * 0.5, -rr * 0.1);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.05, R * 0.55, 0.06), mats.steel), -sign * W * 0.3, R * 0.02, 0);                                   /* knuckle */
  const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, R * 1.15, 12), mats.steel); add(strut, -sign * W * 0.34, R * 0.78, 0);
  for (let i = 0; i < 7; i++) { const c = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.008, 6, 20), mats.spring); c.rotation.x = Math.PI / 2; add(c, -sign * W * 0.34, R * (0.5 + i * 0.1), 0); }
  const arm = new THREE.Mesh(new THREE.BoxGeometry(W * 1.35, 0.022, 0.07), mats.steel); add(arm, -sign * W * 0.9, -R * 0.42, 0);              /* lower control arm */
  if (front) { const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, W * 1.3, 8), mats.tie); tr.rotation.z = Math.PI / 2; add(tr, -sign * W * 1.0, -R * 0.1, -R * 0.55); }   /* tie rod */
  return g;
}

/** The reference car. Returns { group, wheels: {FL..RR}, body (Group: rolls and lifts with ride height), dispose, R }. */
export function buildCar(THREE, presetId, mats) {
  const p = getPreset(presetId), st = styleOf(presetId), grp = new THREE.Group(), wheels = {}, ownMats = [], body = new THREE.Group();
  const R = p.tyreRadius / 1000, W = p.tyreWidth / 1000, wb = p.wheelbase / 1000, bw = Math.max(p.trackF, p.trackR) / 1000 + 0.13;      /* body width */
  const mk = (o) => { ownMats.push(o); return o; };
  const std = (color, rough, metal, extra) => mk(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
  const M = {
    rubber: mats.rubber || std(0x1c1f25, 0.92, 0), rim: mk(new THREE.MeshStandardMaterial({ color: 0xcfd6de, metalness: 0.85, roughness: 0.28, side: THREE.DoubleSide })),
    steel: std(0x8b939c, 0.45, 0.7), cap: std(0x1f2937, 0.4, 0.5), disc: std(0x6b7280, 0.5, 0.75), caliper: std(0xb91c1c, 0.4, 0.3), spring: std(0xd1a35a, 0.4, 0.6), tie: std(0xd97706, 0.5, 0.4),
    paint: mk(new THREE.MeshPhysicalMaterial({ color: st.paint, metalness: 0.45, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 })),
    glass: std(0x0b1118, 0.06, 0.1), plastic: std(0x14171c, 0.7, 0.1), chrome: std(0xd8dde3, 0.15, 1),
    lamp: std(0xfff7dd, 0.2, 0, { emissive: 0xfff3c4, emissiveIntensity: 0.9 }), tail: std(0xb91c1c, 0.3, 0, { emissive: 0xdc2626, emissiveIntensity: 0.7 }),
    liner: mk(new THREE.MeshStandardMaterial({ color: 0x0d0f12, roughness: 0.95, side: THREE.DoubleSide }))
  };
  const put = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); body.add(m); return m; };
  const box = (w, h, d, mat, x, y, z) => put(new THREE.BoxGeometry(w, h, d), mat, x, y, z);

  /* ── side-profile slab (x → car z, y → height), extruded across the car ── */
  const slab = (pts, width, bevel, mat) => {
    const sh = new THREE.Shape(); pts.forEach(([z, y], i) => (i ? sh.lineTo(z, y) : sh.moveTo(z, y))); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: width - 2 * bevel, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 28 });
    geo.translate(0, 0, -(width - 2 * bevel) / 2); geo.rotateY(-Math.PI / 2);
    return put(geo, mat, 0, 0, 0);
  };
  const zf = wb / 2 + st.ovF, zr = -(wb / 2 + st.ovR), c0 = st.clear, BEV = 0.04, ra = R + 0.1, eff = ra - BEV, zCowl = st.roofF + 0.55 + (st.belt - 0.9) * 0.3;
  const roofR = zr + st.roofRo, zDeck = st.hatch ? zr + 0.12 : roofR - 0.5;
  /* lower body with wheel arches cut into the bottom edge (rear arch first: the outline runs rear → front along the sill) */
  const arch = (zc) => (sh) => {
    const dx = Math.sqrt(ra * ra - (R - c0) * (R - c0)), phi = Math.atan2(R - c0, dx);
    sh.lineTo(zc - dx, c0); sh.absarc(zc, R, ra, Math.PI + phi, -phi, true); sh.lineTo(zc + dx, c0);
  };
  const outline = [[zr + 0.06, c0 + 0.04], [zr, c0 + 0.16], [zr, st.tail - 0.22], [zr + 0.04, st.tail], [zDeck, st.tail], [zCowl - 0.2, st.belt], [zCowl, st.belt - 0.03],
    [zf - 0.55, st.nose + 0.05], [zf - 0.05, st.nose], [zf, st.nose - 0.18], [zf, c0 + 0.16], [zf - 0.06, c0 + 0.04]];
  const lower = new THREE.Shape(); lower.moveTo(outline[0][0], outline[0][1]);
  arch(-wb / 2)(lower); arch(wb / 2)(lower);
  for (let i = outline.length - 1; i >= 1; i--) lower.lineTo(outline[i][0], outline[i][1]);
  lower.closePath();
  const lowerGeo = new THREE.ExtrudeGeometry(lower, { depth: bw - 2 * BEV, bevelEnabled: true, bevelSize: BEV, bevelThickness: BEV, bevelSegments: 4, curveSegments: 28 });
  lowerGeo.translate(0, 0, -(bw - 2 * BEV) / 2); lowerGeo.rotateY(-Math.PI / 2); put(lowerGeo, M.paint, 0, 0, 0);
  for (const zc of [-wb / 2, wb / 2]) {                                                                      /* arch liners + flares */
    const liner = new THREE.Mesh(new THREE.CylinderGeometry(eff - 0.012, eff - 0.012, bw - 0.1, 28, 1, true, 0, Math.PI), M.liner); liner.rotation.z = Math.PI / 2; liner.position.set(0, R, zc); body.add(liner);
    for (const sx of [1, -1]) { const fl = new THREE.Mesh(new THREE.TorusGeometry(eff + 0.014, 0.02, 8, 32, Math.PI), M.plastic); fl.rotation.y = Math.PI / 2; fl.position.set(sx * (bw / 2 - 0.005), R, zc); body.add(fl); }
  }

  /* ── greenhouse: paint shell, inset glass, pillars, roof ── */
  const cw = bw - 0.2, zE = (y, z0, y0, z1, y1) => z0 + ((y - y0) / (y1 - y0)) * (z1 - z0), yb = st.belt - 0.02, yt = st.roof;
  const cab = [[zCowl, yb], [st.roofF, yt], [roofR, yt], [zDeck, st.hatch ? st.tail : yb]];
  slab(cab, cw, 0.03, M.paint);
  const yLo = yb + 0.03, yHi = yt - 0.07, fr = (y) => zE(y, zCowl, yb, st.roofF, yt), rr2 = (y) => zE(y, zDeck, cab[3][1], roofR, yt), zMid = (st.roofF + roofR) / 2 + 0.02;
  const win = (zl, zrr) => { const s = new THREE.Shape(); s.moveTo(zl(yLo), yLo); s.lineTo(zrr(yLo), yLo); s.lineTo(zrr(yHi), yHi); s.lineTo(zl(yHi), yHi); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: cw + 0.01, bevelEnabled: false }); geo.translate(0, 0, -(cw + 0.01) / 2); geo.rotateY(-Math.PI / 2); put(geo, M.glass, 0, 0, 0); };
  win(() => zMid + 0.05, (y) => fr(y) - 0.08);                   /* front door window  (returns z of left/right bound at height y) */
  win((y) => rr2(y) + 0.08, () => zMid - 0.05);                  /* rear window */
  const slantBox = (z0, y0, z1, y1, mat, thick, width, off) => {                                           /* windscreen / tailgate glass on the slope */
    const L = Math.hypot(z1 - z0, y1 - y0), a = Math.atan2(y1 - y0, z1 - z0), m = new THREE.Mesh(new THREE.BoxGeometry(width, thick, L), mat);
    m.position.set(0, (y0 + y1) / 2 + Math.cos(a) * off, (z0 + z1) / 2 - Math.sin(a) * off); m.rotation.x = -a; body.add(m);
  };
  slantBox(zCowl - 0.02, yb + 0.02, st.roofF - 0.01, yt - 0.04, M.glass, 0.012, cw - 0.16, 0.012);
  slantBox(zDeck + 0.01, cab[3][1] + 0.02, roofR + 0.01, yt - 0.04, M.glass, 0.012, cw - 0.16, 0.012);
  for (const sx of [1, -1]) {
    box(0.03, 0.025, 0.35, M.plastic, sx * (bw / 2 - 0.01), c0 + 0.07, 0);                                   /* sill trim */
    for (const zz of [zMid, zCowl - 0.5, rr2(yb) + 0.4]) box(0.006, 0.55, 0.008, M.plastic, sx * (bw / 2 + 0.003), st.belt - 0.35, zz);          /* door shut lines */
    box(0.03, 0.02, 0.12, M.chrome, sx * (bw / 2 + 0.008), st.belt - 0.12, zMid + 0.24);                    /* handles */
    box(0.03, 0.02, 0.12, M.chrome, sx * (bw / 2 + 0.008), st.belt - 0.12, zMid - 0.28);
    box(0.012, 0.012, 0.1, M.plastic, sx * (cw / 2 + 0.06), st.belt + 0.04, zCowl - 0.05);                  /* mirror stalk */
    box(0.08, 0.06, 0.13, M.paint, sx * (cw / 2 + 0.11), st.belt + 0.08, zCowl - 0.05);
    box(0.34, 0.1, 0.03, M.lamp, sx * (bw / 2 - 0.3), st.nose - 0.08, zf - 0.03);                           /* headlamps */
    box(0.3, 0.1, 0.03, M.tail, sx * (bw / 2 - 0.28), st.tail - 0.16, zr + 0.01);                           /* tail lamps */
  }
  box(bw - 0.9, 0.12, 0.03, M.plastic, 0, st.nose - 0.17, zf - 0.02); box(bw - 0.95, 0.025, 0.035, M.chrome, 0, st.nose - 0.13, zf - 0.015);      /* grille */
  box(bw - 0.12, 0.17, 0.1, M.plastic, 0, c0 + 0.17, zf - 0.04); box(bw - 0.12, 0.15, 0.1, M.plastic, 0, c0 + 0.16, zr + 0.04);                      /* bumpers */
  box(0.5, 0.11, 0.015, M.chrome, 0, st.tail - 0.4, zr - 0.005);                                                                                      /* number plate */
  box(bw - 0.3, 0.06, wb + 0.6, M.plastic, 0, c0 + 0.02, 0);                                                                                           /* underbody */
  grp.add(body);

  /* soft contact shadow */
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const cx = cv.getContext('2d'), gr = cx.createRadialGradient(32, 32, 4, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
  const tex = mk(new THREE.CanvasTexture(cv)), sh = new THREE.Mesh(new THREE.PlaneGeometry(bw + 0.7, zf - zr + 0.7), mk(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })));
  sh.rotation.x = -Math.PI / 2; sh.position.set(0, 0.004, (zf + zr) / 2); grp.add(sh);

  const pos = { FL: [1, 1], FR: [-1, 1], RL: [1, -1], RR: [-1, -1] };
  CORNERS.forEach((c) => {
    const [sx, sz] = pos[c], half = (sz > 0 ? p.trackF : p.trackR) / 2000;
    const w = buildWheel(THREE, R, W, mats.tyres && mats.tyres[c] ? { ...M, rubber: mats.tyres[c] } : M, sx, sz > 0);
    w.position.set(sx * half, R, sz * wb / 2); grp.add(w); wheels[c] = w;
  });
  const dispose = () => { grp.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); ownMats.forEach((m) => m.dispose && m.dispose()); };
  return { group: grp, wheels, body, dispose, R };
}
