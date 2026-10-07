/* alignment-parts.js — three.js builders for the Wheel Alignment module. Rendering only; every number comes from alignment-model.js.
   Scene units: 1 unit = 1 m. Car faces +Z, left side is +X (viewed from behind). */
import { CORNERS, getPreset } from './alignment-model.js';

export function buildTyre(THREE, radius, width, mats) {
  const w = width / 2, r = radius, sh = r * 0.62;                       /* sidewall height proxy */
  const pts = [[r - sh, -w * 0.9], [r - sh * 0.55, -w], [r * 0.985, -w * 0.82], [r, -w * 0.5], [r, w * 0.5], [r * 0.985, w * 0.82], [r - sh * 0.55, w], [r - sh, w * 0.9]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(pts, 40); g.rotateZ(Math.PI / 2);   /* axis along X */
  return new THREE.Mesh(g, mats.rubber);
}
export function buildRim(THREE, radius, width, mats, spokes = 5) {
  const grp = new THREE.Group(), rr = radius * 0.62;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, width * 0.8, 32, 1, true), mats.rim); barrel.rotation.z = Math.PI / 2; grp.add(barrel);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.22, rr * 0.22, width * 0.5, 20), mats.rim); hub.rotation.z = Math.PI / 2; grp.add(hub);
  for (let i = 0; i < spokes; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(width * 0.14, rr * 0.8, rr * 0.16), mats.rim);
    const a = (i / spokes) * Math.PI * 2; sp.position.set(0, Math.cos(a) * rr * 0.5, Math.sin(a) * rr * 0.5); sp.rotation.x = -a; grp.add(sp);
  }
  return grp;
}
/** The reference car: simple body on four wheels. Returns { group, wheels: {FL..RR: Group}, body, dispose } — wheel groups sit at their contact-patch-up positions. */
export function buildCar(THREE, presetId, mats) {
  const p = getPreset(presetId), grp = new THREE.Group(), wheels = {};
  const R = p.tyreRadius / 1000, W = p.tyreWidth / 1000, wb = p.wheelbase / 1000;
  const body = new THREE.Mesh(new THREE.BoxGeometry(p.trackF / 1000 + 0.1, 0.5, wb + 0.9), mats.body); body.position.set(0, R + 0.42, 0); grp.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(p.trackF / 1000 - 0.2, 0.42, wb * 0.55), mats.glass); cabin.position.set(0, R + 0.88, -wb * 0.05); grp.add(cabin);
  const pos = { FL: [1, 1], FR: [-1, 1], RL: [1, -1], RR: [-1, -1] };
  CORNERS.forEach((c) => {
    const [sx, sz] = pos[c], half = (sz > 0 ? p.trackF : p.trackR) / 2000;
    const w = new THREE.Group(); w.position.set(sx * half, R, sz * wb / 2);
    w.add(buildTyre(THREE, R, W, mats.tyres && mats.tyres[c] ? { ...mats, rubber: mats.tyres[c] } : mats), buildRim(THREE, R, W, mats)); grp.add(w); wheels[c] = w;
  });
  const dispose = () => grp.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  return { group: grp, wheels, body, dispose, R };
}
