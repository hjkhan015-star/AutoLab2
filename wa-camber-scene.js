/* wa-camber-scene.js — front-view scene for the Camber page. Each wheel tilts about its CONTACT PATCH (not its centre).
   S = shared session { st, exag, cam, ver, flags: { plumb, heat, wear, tint, turn } }; the page glue writes it. */
import { CORNERS, getPreset, drawnAngle, camberReport, tiltAboutContact, rollAngle, dynamicCamber, clamp } from './alignment-model.js';
import { buildCar, buildTyre } from './alignment-parts.js';
import { paintTread } from './wa-toe-scene.js';

export const CAMBER_CAMERAS = {
  front: { pos: [0, 0.95, 6.4], target: [0, 0.45, 0] },
  close: { pos: [1.5, 0.55, 4.3], target: [0.8, 0.35, 1.3] },
  low: { pos: [0.9, 0.12, 4.6], target: [0.8, 0.3, 1.3] },
  orbit: null
};
const RAMP = (k) => { const t = clamp(k, 0, 1), a = t < 0.5 ? [40, 90, 220] : [60, 200, 90], b = t < 0.5 ? [60, 200, 90] : [230, 50, 40], u = t < 0.5 ? t * 2 : (t - 0.5) * 2; return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * u)).join(',')})`; };

/** Footprint heat-map: pressure bins from the inner to the outer shoulder, blue → red. innerAtU0 says which end of the texture is the inner side. */
export function paintFootprint(ctx, w, h, profile, innerAtU0) {
  const n = profile.length, peak = Math.max(...profile) * 1.15;
  for (let x = 0; x < w; x++) {
    const f = x / (w - 1), pos = (innerAtU0 ? f : 1 - f) * (n - 1), i = Math.min(n - 2, Math.floor(pos)), v = profile[i] + (profile[i + 1] - profile[i]) * (pos - i);
    ctx.fillStyle = RAMP(v / peak); ctx.fillRect(x, 0, 1, h);
  }
}

export function buildCamberScene(H, S) {
  const THREE = H.THREE, root = H.root, owned = [];
  const own = (o) => { owned.push(o); return o; };
  const mats = {
    rim: own(new THREE.MeshStandardMaterial({ color: 0xccd3db, metalness: 0.9, roughness: 0.3 })),
    body: own(new THREE.MeshStandardMaterial({ color: 0x2b6cb0, metalness: 0.4, roughness: 0.45 })),
    glass: own(new THREE.MeshStandardMaterial({ color: 0x9fb4c7, roughness: 0.15, transparent: true, opacity: 0.7 })),
    road: own(new THREE.MeshStandardMaterial({ color: 0x2d3139, roughness: 0.95 })),
    tyres: {}
  };
  const treadCv = {}, footCv = {}, footMat = {}, footMesh = {};
  CORNERS.forEach((c) => {
    treadCv[c] = document.createElement('canvas'); treadCv[c].width = 256; treadCv[c].height = 64;
    footCv[c] = document.createElement('canvas'); footCv[c].width = 128; footCv[c].height = 8;
    const tm = own(new THREE.CanvasTexture(treadCv[c])), fm = own(new THREE.CanvasTexture(footCv[c]));
    mats.tyres[c] = own(new THREE.MeshStandardMaterial({ color: 0x1c1f25, roughness: 0.92, map: null, emissive: 0x000000, emissiveIntensity: 0.35 }));
    mats.tyres[c].userData.map = tm;
    footMat[c] = own(new THREE.MeshBasicMaterial({ map: fm, transparent: true, opacity: 0.92 })); footMat[c].userData.map = fm;
  });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), mats.road); road.rotation.x = -Math.PI / 2; root.add(road);
  const grid = new THREE.GridHelper(14, 28, 0x5a6070, 0x3e4450); grid.position.y = 0.003; root.add(grid);

  const rig = new THREE.Group(); root.add(rig);
  let car = null, preset = null, version = -1, flagsKey = '', rep = null, camKey = '', goal = null, goalT = 0, lastT = null;
  const plumb = {}, plane = {};
  const mkLine = (hex) => { const g = own(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)); const l = new THREE.Line(g, own(new THREE.LineBasicMaterial({ color: hex }))); rig.add(l); return l; };
  const setLine = (l, ax, ay, az, bx, by, bz) => { const a = l.geometry.attributes.position.array; a[0] = ax; a[1] = ay; a[2] = az; a[3] = bx; a[4] = by; a[5] = bz; l.geometry.attributes.position.needsUpdate = true; };
  CORNERS.forEach((c) => { plumb[c] = mkLine(0xe5e7eb); plane[c] = mkLine(0xfacc15); });

  function mount() {
    if (car) { rig.remove(car.group); car.dispose(); Object.values(footMesh).forEach((m) => rig.remove(m)); }
    preset = S.st.preset; car = buildCar(THREE, preset, mats); rig.add(car.group);
    const W = getPreset(preset).tyreWidth / 1000;
    CORNERS.forEach((c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.3), footMat[c]); m.rotation.x = -Math.PI / 2; rig.add(m); footMesh[c] = m; });
    CORNERS.forEach((c) => { car.wheels[c].userData.x0 = car.wheels[c].position.x; });
  }
  mount();

  const poseWheel = (c, camberDeg) => {
    const R = car.R, left = c[1] === 'L', w = car.wheels[c], x0 = w.userData.x0, z = w.position.z;
    const phiDeg = (left ? -1 : 1) * drawnAngle(camberDeg, S.exag);                    /* negative camber = top toward the car */
    const { dx, dy } = tiltAboutContact(R, phiDeg), phi = phiDeg * Math.PI / 180;
    w.rotation.z = phi; w.position.set(x0 - dx, dy, z);                                /* the wheel pivots about its contact patch */
    setLine(plumb[c], x0, 0, z, x0, R * 2.3, z); setLine(plane[c], x0, 0, z, x0 - Math.sin(phi) * R * 2.3, Math.cos(phi) * R * 2.3, z);
    plumb[c].visible = plane[c].visible = S.flags.plumb;
  };
  const repaint = () => {
    CORNERS.forEach((c) => {
      const m = mats.tyres[c], inner0 = c[1] === 'R';
      if (S.flags.wear) { paintTread(treadCv[c].getContext('2d'), 256, 64, rep.wear[c], 0, inner0); m.userData.map.needsUpdate = true; m.map = m.userData.map; m.color.setHex(0xffffff); }
      else { m.map = null; m.color.setHex(0x1c1f25); }
      m.emissive.setHex(S.flags.tint ? { ok: 0x16a34a, warn: 0xd97706, crit: 0xdc2626 }[rep.status[c]] : 0x000000); m.needsUpdate = true;
      paintFootprint(footCv[c].getContext('2d'), 128, 8, rep.pressure[c], c[1] === 'L'); footMat[c].userData.map.needsUpdate = true;
      footMesh[c].visible = S.flags.heat;
    });
  };

  return {
    labels: [['Plumb vs wheel plane', [0, 1.5, 1.3]], ['Contact patch', [0, 0.1, 1.5]]],
    update(c) {
      const t = typeof c.t === 'number' ? c.t : 0, dt = clamp(t - (lastT == null ? t : lastT), 0, 0.05); lastT = t;
      if (preset !== S.st.preset) { mount(); version = -1; }
      const turning = S.flags.turn, latG = turning ? 0.7 * Math.sin(t * 0.9) : 0, fk = JSON.stringify(S.flags) + S.exag;
      if (version !== S.ver || fk !== flagsKey) { rep = camberReport(S.st); flagsKey = fk; repaint(); version = S.ver; }
      const p = getPreset(preset), roll = turning ? rollAngle(latG, p.suspension) : 0;        /* signed body roll (deg) */
      CORNERS.forEach((cn) => {
        const outside = latG > 0 ? cn[1] === 'R' : cn[1] === 'L';
        poseWheel(cn, turning ? dynamicCamber(S.st[cn].camber, roll, p.suspension, outside) : S.st[cn].camber);
        footMesh[cn].position.set(car.wheels[cn].userData.x0, 0.012, car.wheels[cn].position.z);
      });
      car.body.rotation.z = drawnAngle(roll, S.exag) * Math.PI / 180 * 0.5;
      if (camKey !== S.cam) { camKey = S.cam; const g = CAMBER_CAMERAS[S.cam]; goal = g ? { pos: new THREE.Vector3(...g.pos), target: new THREE.Vector3(...g.target) } : null; goalT = 0; }
      if (goal && H.camera && H.orbit) { goalT += dt; H.camera.position.lerp(goal.pos, 0.1); H.orbit.target.lerp(goal.target, 0.1); H.orbit.update(); if (goalT > 1.6) goal = null; }
      const r = rep, f2 = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2) + '°', fa = r.d.crossCamberF;
      const mean = (a, b) => (S.st[a].camber + S.st[b].camber) / 2;
      return {
        big: f2(mean('FL', 'FR')), unit: '', bar: clamp(50 + mean('FL', 'FR') / 3 * 50, 0, 100),
        ro: {
          camFL: [f2(S.st.FL.camber), r.status.FL, S.st.FL.camber], camFR: [f2(S.st.FR.camber), r.status.FR, S.st.FR.camber],
          camRL: [f2(S.st.RL.camber), r.status.RL, S.st.RL.camber], camRR: [f2(S.st.RR.camber), r.status.RR, S.st.RR.camber],
          cross: [f2(fa), r.ccStat, fa], incl: [f2(r.d.includedL) + ' / ' + f2(r.d.includedR), 'hi'],
          bias: [`${r.bias.FL.inner.toFixed(0)} / ${(100 - r.bias.FL.inner).toFixed(0)} %`, Math.abs(r.bias.FL.inner - 50) < 8 ? 'ok' : 'warn'],
          life: [r.life.toFixed(0) + ' %', r.life > 85 ? 'ok' : r.life > 60 ? 'warn' : 'crit'],
          pull: [(r.drift >= 0 ? '+' : '−') + Math.abs(r.drift).toFixed(0) + ' cm/100 m', Math.abs(r.drift) < 6 ? 'ok' : 'warn'],
          grip: [`${(r.corner * 100).toFixed(0)} % corner · ${(r.brake * 100).toFixed(0)} % brake`, r.corner > 0.85 && r.brake > 0.9 ? 'ok' : 'warn']
        },
        status: [r.explain, ['FL', 'FR', 'RL', 'RR'].some((k) => r.status[k] !== 'ok')]
      };
    },
    dispose() { owned.forEach((o) => o.dispose && o.dispose()); car.dispose(); }
  };
}
