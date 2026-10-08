/* wa-caster-scene.js — side-view scene for the Caster page: steering axis, trail, hands-off release, caster swing, pull.
   S = shared session { st, exag, cam, ver, steer (road-wheel deg, left +), mode: null | 'release', rel: {theta, omega},
   flags: { axis, trail, drive, swing }, pushSteer(deg) }. */
import { CORNERS, getPreset, drawnAngle, casterReport, tiltAboutContact, releaseStep, camberGainWheel, clamp, SWING_DEG } from './alignment-model.js';
import { buildCar } from './alignment-parts.js';

export const CASTER_CAMERAS = {
  side: { pos: [4.6, 0.6, 1.3], target: [0.8, 0.45, 1.3] },
  front: { pos: [0, 0.85, 6.2], target: [0, 0.45, 0] },
  top: { pos: [0, 8, 0.5], target: [0, 0, 0.1] },
  orbit: null
};
const FRONT = ['FL', 'FR'];

export function buildCasterScene(H, S) {
  const THREE = H.THREE, root = H.root, owned = [];
  const own = (o) => { owned.push(o); return o; };
  const mats = {
    rubber: own(new THREE.MeshStandardMaterial({ color: 0x1c1f25, roughness: 0.92 })),
    rim: own(new THREE.MeshStandardMaterial({ color: 0xccd3db, metalness: 0.9, roughness: 0.3 })),
    body: own(new THREE.MeshStandardMaterial({ color: 0x2b6cb0, metalness: 0.4, roughness: 0.45 })),
    glass: own(new THREE.MeshStandardMaterial({ color: 0x9fb4c7, roughness: 0.15, transparent: true, opacity: 0.7 })),
    road: own(new THREE.MeshStandardMaterial({ color: 0x2d3139, roughness: 0.95 })),
    joint: own(new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 }))
  };
  const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), mats.road); road.rotation.x = -Math.PI / 2; root.add(road);
  const grid = new THREE.GridHelper(14, 28, 0x5a6070, 0x3e4450); grid.position.y = 0.003; root.add(grid);
  const rig = new THREE.Group(); root.add(rig);

  let car = null, preset = null, version = -1, flagsKey = '', rep = null, camKey = '', goal = null, goalT = 0, lastT = null, driftX = 0;
  const axisLine = {}, trailArrow = {}, joints = {}, pullArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.5, 0xf43f5e, 0.12, 0.08);
  rig.add(pullArrow);
  const mkLine = (hex) => { const g = own(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)); const l = new THREE.Line(g, own(new THREE.LineBasicMaterial({ color: hex }))); rig.add(l); return l; };
  const setLine = (l, ax, ay, az, bx, by, bz) => { const a = l.geometry.attributes.position.array; a[0] = ax; a[1] = ay; a[2] = az; a[3] = bx; a[4] = by; a[5] = bz; l.geometry.attributes.position.needsUpdate = true; };
  FRONT.forEach((c) => {
    axisLine[c] = mkLine(c === 'FL' ? 0x2dd4bf : 0xfb923c);
    trailArrow[c] = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 0.2, c === 'FL' ? 0x2dd4bf : 0xfb923c, 0.07, 0.05); rig.add(trailArrow[c]);
    joints[c] = [new THREE.Mesh(own(new THREE.SphereGeometry(0.035, 12, 8)), mats.joint), new THREE.Mesh(own(new THREE.SphereGeometry(0.035, 12, 8)), mats.joint)];
    joints[c].forEach((j) => rig.add(j));
  });

  function mount() {
    if (car) { rig.remove(car.group); car.dispose(); }
    preset = S.st.preset; car = buildCar(THREE, preset, mats); rig.add(car.group);
    CORNERS.forEach((c) => { car.wheels[c].userData.x0 = car.wheels[c].position.x; car.wheels[c].userData.z0 = car.wheels[c].position.z; car.wheels[c].rotation.order = 'YZX'; });
  }
  mount();

  /* steering axis through the wheel centre, tilted by the DRAWN caster; the trail arrow runs along the road from the contact patch to the axis intercept */
  function drawAxis() {
    const R = car.R;
    FRONT.forEach((c) => {
      const w = car.wheels[c], x = w.userData.x0, z0 = w.userData.z0, k = Math.tan(drawnAngle(S.st[c].caster, S.exag) * Math.PI / 180);
      const top = R + 0.55, zInt = z0 + R * k, zTop = z0 - (top - R) * k;
      setLine(axisLine[c], x, 0, zInt, x, top, zTop);
      joints[c][0].position.set(x, top, zTop); joints[c][1].position.set(x, R - 0.3, z0 + 0.3 * k);
      const a = trailArrow[c], len = Math.abs(R * k);
      a.position.set(x + (c === 'FL' ? 0.04 : -0.04), 0.03, z0); a.setDirection(new THREE.Vector3(0, 0, k >= 0 ? 1 : -1)); a.setLength(Math.max(0.02, len), Math.min(0.1, len * 0.6 + 0.02), 0.05);
      axisLine[c].visible = joints[c][0].visible = joints[c][1].visible = S.flags.axis; a.visible = S.flags.trail;
    });
  }
  function poseWheels(steer) {
    const R = car.R, yaw = steer * Math.PI / 180;
    CORNERS.forEach((c) => {
      const w = car.wheels[c], left = c[1] === 'L', front = c[0] === 'F';
      const cam = S.st[c].camber + (front ? camberGainWheel(S.st[c].caster, steer, c[1]) : 0);
      const phiDeg = (left ? -1 : 1) * drawnAngle(cam, S.exag), { dx, dy } = tiltAboutContact(R, phiDeg), yw = front ? yaw : 0;
      w.rotation.y = yw; w.rotation.z = phiDeg * Math.PI / 180;
      w.position.set(w.userData.x0 - dx * Math.cos(yw), dy, w.userData.z0 + dx * Math.sin(yw));
    });
  }

  return {
    labels: [['Steering axis', [0.9, 1.15, 1.3]], ['Trail', [0.9, 0.1, 1.55]]],
    update(c) {
      const t = typeof c.t === 'number' ? c.t : 0, dt = clamp(t - (lastT == null ? t : lastT), 0, 0.05); lastT = t;
      if (preset !== S.st.preset) { mount(); version = -1; }
      const fk = JSON.stringify(S.flags) + S.exag;
      if (version !== S.ver || fk !== flagsKey) { flagsKey = fk; drawAxis(); version = S.ver; }
      const p = getPreset(preset), avg = (S.st.FL.caster + S.st.FR.caster) / 2;
      if (S.flags.swing) { S.steer = SWING_DEG * Math.sin(t * 1.4); S.pushSteer(S.steer); }
      else if (S.mode === 'release') {
        S.rel = releaseStep(S.rel, dt, { tyreRadius: p.tyreRadius, casterDeg: avg, scrub: p.scrubRadius });
        S.steer = S.rel.theta; S.pushSteer(S.steer);
        if (Math.abs(S.rel.theta) < 0.1 && Math.abs(S.rel.omega) < 1) { S.mode = null; S.steer = 0; S.pushSteer(0); }
      }
      rep = casterReport(S.st, S.steer); poseWheels(S.steer);
      if (S.flags.drive) { grid.position.z = (grid.position.z - dt * 3) % 0.5; driftX -= rep.pull.value * dt * 0.25; if (Math.abs(driftX) > 1.2) driftX = 0; } else driftX = 0;
      rig.position.x = driftX;
      pullArrow.visible = S.flags.drive && Math.abs(rep.pull.value) > 0.05;
      if (pullArrow.visible) { pullArrow.position.set(0, 0.9, p.wheelbase / 2000 + 1.1); pullArrow.setDirection(new THREE.Vector3(rep.pull.value > 0 ? -1 : 1, 0, 0)); pullArrow.setLength(0.3 + Math.abs(rep.pull.value) * 0.9, 0.12, 0.08); }
      if (camKey !== S.cam) { camKey = S.cam; const g = CASTER_CAMERAS[S.cam]; goal = g ? { pos: new THREE.Vector3(...g.pos), target: new THREE.Vector3(...g.target) } : null; goalT = 0; }
      if (goal && H.camera && H.orbit) { goalT += dt; H.camera.position.lerp(goal.pos, 0.1); H.orbit.target.lerp(goal.target, 0.1); H.orbit.update(); if (goalT > 1.6) goal = null; }
      const r = rep, f1 = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + '°', f2 = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2) + '°';
      return {
        big: f1(r.avg), unit: '', bar: clamp((r.avg + 2) / 10 * 100, 0, 100),
        ro: {
          casL: [f1(S.st.FL.caster), r.status.L, S.st.FL.caster], casR: [f1(S.st.FR.caster), r.status.R, S.st.FR.caster],
          cross: [f1(r.d.crossCaster), r.ccStat, r.d.crossCaster],
          trail: [`${r.trailL.toFixed(0)} / ${r.trailR.toFixed(0)} mm`, 'hi'],
          torque: [`${r.torque.toFixed(1)} N·m${r.atRef ? ' @10°' : ''}`, r.torque > 4 ? 'ok' : 'warn'],
          effort: [(r.effort.value * 100).toFixed(0) + ' %', r.effort.value > 0.8 ? 'warn' : r.effort.value < 0.3 ? 'warn' : 'ok'],
          pull: [(r.drift >= 0 ? '+' : '−') + Math.abs(r.drift).toFixed(0) + ' cm/100 m', Math.abs(r.drift) < 6 ? 'ok' : 'warn'],
          gain: [f2(r.gain10) + ' / 10°', 'hi'],
          swing: [`${f2(r.swing)} → ${f1(r.swingCaster)}`, 'hi']
        },
        status: [r.explain, r.status.L !== 'ok' || r.status.R !== 'ok' || r.ccStat !== 'ok']
      };
    },
    dispose() { owned.forEach((o) => o.dispose && o.dispose()); car.dispose(); }
  };
}
