/* wb-scene.js — shared three.js scene driver for every Wheel Balancing page. Reads the session S, draws, owns no physics.
   S = { wheel, hood (0 open … 1 closed), rpm, target, rot (deg cw, hand-turned), showSpots, cam, typedDia, mode, page, ver }.
   `S.page` selects what the machine display shows ('static' | 'dynamic' | 'procedure' | 'overview'). */
import { buildBalancer, AXLE_Y, AXLE_X } from './balancer-machine.js';
import { getWheel, staticVec, coupleMoment, correction, displayedWeight, isBalanced, vibration, feel, tone, spinStep, wrap, clamp } from './balancing-model.js';

export const CAMERAS = {
  front: { pos: [2.2, 1.2, 2.8], target: [0, 0.6, 0] },
  side: { pos: [4.0, 0.9, 0.2], target: [0, 0.6, 0] },
  top: { pos: [0.2, 4.0, 0.6], target: [0, 0.4, 0] },
  orbit: null
};
const g5 = (v) => (v < 5 ? 'OK' : v.toFixed(0));

export function buildBalanceScene(H, S) {
  const THREE = H.THREE, m = buildBalancer(THREE, H.root);
  let lastT = null, camKey = '', goal = null, goalT = 0, ver = -1, spin = 0;
  S.rpmNow = 0;
  const api = {
    labels: [['Balancer', [-0.42, 0.95, 0]], ['Shaft + cone', [0.0, AXLE_Y + 0.12, 0]], ['Wheel', [AXLE_X, AXLE_Y + 0.5, 0]], ['Weight tray', [-0.5, 0.95, 0.2]], ['Hood', [AXLE_X, AXLE_Y + 0.55, -0.3]]],
    update(c) {
      const t = typeof c.t === 'number' ? c.t : 0, dt = clamp(t - (lastT == null ? t : lastT), 0, 0.05); lastT = t;
      const w = S.wheel, wh = getWheel(w.id);
      if (ver !== S.ver) { S.hasSpun = S.rpmNow >= 90; ver = S.ver; }          /* new weights: the readings are stale until the next spin */
      m.setWheel(w.id);
      /* hood and spin: the machine only spins with the hood down; opening it brakes the wheel */
      S.hood += (S.hoodGoal - S.hood) * Math.min(1, dt * 6);
      m.setHood(1 - S.hood);
      const target = S.hood > 0.95 ? S.target : 0;
      S.rpmNow = spinStep(S.rpmNow, target, dt * (target ? 1 : 3)); if (S.rpmNow < 0.5) S.rpmNow = 0;
      if (S.rpmNow > 0) { spin = wrap(spin + S.rpmNow * 6 * dt); S.rot = spin; } else spin = S.rot;
      m.setRotation(S.rpmNow > 0 ? spin : S.rot);
      m.setSpots(w, S.showSpots); m.setFitted(w.fitted);
      /* readings */
      const cor = correction(w), disp = { inner: displayedWeight(w, 'inner', S.typedDia), outer: displayedWeight(w, 'outer', S.typedDia) };
      const sv = staticVec(w), mom = coupleMoment(w), spun = S.rpmNow >= 90 || S.hasSpun;
      if (S.rpmNow >= 90) S.hasSpun = true;
      const vib = vibration(w, S.kmh, wh.diaIn * 25.4 / 2 / 0.62);
      const bal = isBalanced(w), tn = (g) => (g < 5 ? 'ok' : g < 20 ? 'warn' : 'crit');
      const show = spun && S.page !== 'overview';
      const shown = (p) => (show ? [g5(disp[p].g), tn(disp[p].g)] : ['---', 'dim']);
      if (S.page === 'static') m.show([['STATIC  g', show ? g5(sv.g) : '---', show ? tn(sv.g) : 'dim'], ['HEAVY SPOT  °', show && sv.g >= 5 ? sv.a.toFixed(0) : '---', 'dim'], ['SPEED  rpm', S.rpmNow.toFixed(0), 'ok']], bal ? 'BALANCED' : (S.hood < 0.9 ? 'LOWER THE HOOD TO SPIN' : ''));
      else m.show([['INNER  g', ...shown('inner')], ['OUTER  g', ...shown('outer')], ['SPEED  rpm', S.rpmNow.toFixed(0), 'ok']], bal && spun ? 'BALANCED' : (S.hood < 0.9 ? 'LOWER THE HOOD TO SPIN' : ''));
      /* camera presets glide, then hand back to the orbit controls */
      if (camKey !== S.cam) { camKey = S.cam; const k = CAMERAS[S.cam]; goal = k ? { pos: new THREE.Vector3(...k.pos), target: new THREE.Vector3(...k.target) } : null; goalT = 0; }
      if (goal && H.camera && H.orbit) { goalT += dt; H.camera.position.lerp(goal.pos, 0.1); H.orbit.target.lerp(goal.target, 0.1); H.orbit.update(); if (goalT > 1.6) goal = null; }
      const heavy = (p) => (w[p].g < 1 ? '—' : w[p].g.toFixed(0) + ' g @ ' + w[p].a.toFixed(0) + '°');
      return {
        big: spun ? (bal ? 'OK' : Math.max(disp.inner.g, disp.outer.g).toFixed(0)) : '---', unit: spun ? 'g' : '', bar: clamp(vib.total, 0, 100),
        ro: {
          inner: [show ? (disp.inner.g < 5 ? 'OK' : disp.inner.g.toFixed(0) + ' g @ ' + cor.inner.a.toFixed(0) + '°') : '---', show ? tn(disp.inner.g) : 'hi'],
          outer: [show ? (disp.outer.g < 5 ? 'OK' : disp.outer.g.toFixed(0) + ' g @ ' + cor.outer.a.toFixed(0) + '°') : '---', show ? tn(disp.outer.g) : 'hi'],
          stat: [sv.g.toFixed(0) + ' g', tn(sv.g), sv.g],
          couple: [mom.toFixed(2) + ' g·m', mom < 0.5 ? 'ok' : mom < 1.5 ? 'warn' : 'crit', mom],
          hopv: [vib.hop.toFixed(0) + ' %', tone(vib.hop), vib.hop],
          shim: [vib.shimmy.toFixed(0) + ' %', tone(vib.shimmy), vib.shimmy],
          rpm: [S.rpmNow.toFixed(0) + ' rpm', S.rpmNow > 0 ? 'hi' : 'ok'],
          heavyI: [heavy('inner'), 'hi'], heavyO: [heavy('outer'), 'hi'],
          feelr: [feel(vib.total), tone(vib.total)]
        },
        status: [bal ? 'Wheel balanced: smooth at every speed' : (spun ? 'Unbalanced: fit the weights shown' : 'Lower the hood and spin the wheel'), !bal],
        ctl: S.hood > 0.95 ? 'Hood down' : 'Hood up'
      };
    },
    dispose() { m.dispose(); }
  };
  return api;
}
