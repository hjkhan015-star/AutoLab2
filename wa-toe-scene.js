/* wa-toe-scene.js — three.js scene for the Toe page. Reads the model, draws; owns no physics.
   S = shared session { st, exag, unit, cam, flags: { lasers, ghost, wear, tint, auto }, ver } (the page glue writes it). */
import { CORNERS, getPreset, makeState, drawnAngle, toeReport, formatToe, toeDegToMm, thrustAngle, clamp } from './alignment-model.js';
import { buildCar, buildTyre } from './alignment-parts.js';

export const CAMERAS = {
  top: { pos: [0, 8.5, 0.5], target: [0, 0, 0.1] },
  axle: { pos: [2.6, 1.1, 3.7], target: [0.7, 0.3, 1.3] },
  patch: { pos: [2.7, 0.14, 2.4], target: [0.8, 0.1, 1.3] },
  orbit: null
};
const HEAT = (rate) => { const k = clamp((rate - 1) / 2, 0, 1); return `rgb(${Math.round(32 + 200 * k)},${Math.round(36 + 70 * (1 - Math.abs(k - 0.4)))},${Math.round(43 * (1 - k))})`; };

/** Tread texture: heat across the width (inner → outer) and a saw-tooth pattern that grows with `feather` (−1…1). Pure canvas painter. */
export function paintTread(ctx, w, h, wear, feather, innerAtV0) {
  for (let y = 0; y < h; y++) {
    const v = 1 - y / (h - 1), pos = (innerAtV0 ? v : 1 - v) * 2 - 1;             /* −1 inner … +1 outer */
    const rate = pos < 0 ? wear.inner * -pos + wear.centre * (1 + pos) : wear.outer * pos + wear.centre * (1 - pos);
    ctx.fillStyle = HEAT(rate); ctx.fillRect(0, y, w, 1);
  }
  const amp = Math.abs(feather) * h * 0.12, teeth = 28;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  for (let i = 0; i < teeth; i++) {
    const x = (i / teeth) * w, tw = w / teeth;
    ctx.beginPath(); ctx.moveTo(x, h * 0.4); ctx.lineTo(x + tw, h * 0.4 - amp); ctx.lineTo(x + tw, h * 0.6 + amp); ctx.lineTo(x, h * 0.6); ctx.closePath(); ctx.fill();
  }
}

export function buildToeScene(H, S) {
  const THREE = H.THREE, root = H.root;
  const dispose = [];
  const own = (o) => { dispose.push(o); return o; };
  const mats = {
    rim: own(new THREE.MeshStandardMaterial({ color: 0xccd3db, metalness: 0.9, roughness: 0.3 })),
    body: own(new THREE.MeshStandardMaterial({ color: 0x2b6cb0, metalness: 0.4, roughness: 0.45 })),
    glass: own(new THREE.MeshStandardMaterial({ color: 0x9fb4c7, roughness: 0.15, transparent: true, opacity: 0.7 })),
    road: own(new THREE.MeshStandardMaterial({ color: 0x2d3139, roughness: 0.95 })),
    ghost: own(new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.28, depthWrite: false })),
    tyres: {}
  };
  const canvases = {};
  CORNERS.forEach((c) => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; canvases[c] = cv;
    const map = own(new THREE.CanvasTexture(cv));
    mats.tyres[c] = own(new THREE.MeshStandardMaterial({ color: 0x1c1f25, roughness: 0.92, map: null, emissive: 0x000000, emissiveIntensity: 0.35 }));
    mats.tyres[c].userData.map = map;
  });

  const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), mats.road); road.rotation.x = -Math.PI / 2; root.add(road);
  const grid = new THREE.GridHelper(14, 28, 0x5a6070, 0x3e4450); grid.position.y = 0.003; root.add(grid);

  const rig = new THREE.Group(); root.add(rig);                 /* car, lines, ghosts and arrows drift together */
  let car = null, preset = null, lastT = null;
  const lines = {}, arrows = {}, ghosts = {};
  const lineMat = (hex) => own(new THREE.LineBasicMaterial({ color: hex }));
  const mkLine = (hex) => { const g = own(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)); const l = new THREE.Line(g, lineMat(hex)); rig.add(l); return l; };
  CORNERS.forEach((c) => { lines[c] = mkLine(0xfacc15); });
  lines.thrust = mkLine(0xf43f5e); lines.centre = mkLine(0x38bdf8);
  const setLine = (l, ax, az, bx, bz) => { const a = l.geometry.attributes.position.array; a[0] = ax; a[1] = 0.02; a[2] = az; a[3] = bx; a[4] = 0.02; a[5] = bz; l.geometry.attributes.position.needsUpdate = true; };
  CORNERS.forEach((c) => { arrows[c] = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.3, 0xf97316, 0.1, 0.07); rig.add(arrows[c]); });

  function mount() {
    if (car) { rig.remove(car.group); car.dispose(); Object.values(ghosts).forEach((g) => rig.remove(g)); }
    preset = S.st.preset; car = buildCar(THREE, preset, mats); rig.add(car.group);
    const p = getPreset(preset), R = p.tyreRadius / 1000, W = p.tyreWidth / 1000;
    CORNERS.forEach((c) => { const g = new THREE.Group(); g.add(buildTyre(THREE, R, W, { rubber: mats.ghost })); rig.add(g); ghosts[c] = g; });
  }
  mount();

  let version = -1, flagsKey = '', camKey = '', goal = null, goalT = 0, driftX = 0, rep = null;
  const wheelPos = (c) => { const w = car.wheels[c]; return [w.position.x, w.position.z]; };

  function repaintTyres() {
    CORNERS.forEach((c) => {
      const m = mats.tyres[c], map = m.userData.map;
      if (S.flags.wear) {
        const ctx = canvases[c].getContext('2d'); paintTread(ctx, 256, 64, rep.wear[c], rep.feather[c].value, c[1] === 'R');
        map.needsUpdate = true; m.map = map; m.color.setHex(0xffffff);
      } else { m.map = null; m.color.setHex(0x1c1f25); }
      const tint = { ok: 0x16a34a, warn: 0xd97706, crit: 0xdc2626 }[rep.status[c]];
      m.emissive.setHex(S.flags.tint ? tint : 0x000000); m.needsUpdate = true;
    });
  }

  return {
    labels: [['Front axle', [0, 0.4, 1.5]], ['Rear axle', [0, 0.4, -1.5]]],
    update(c) {
      const t = typeof c.t === 'number' ? c.t : 0, dt = clamp(t - (lastT == null ? t : lastT), 0, 0.05); lastT = t;
      if (preset !== S.st.preset) { mount(); version = -1; }
      const fk = JSON.stringify(S.flags) + S.exag;
      if (version !== S.ver || fk !== flagsKey) {
        rep = toeReport(S.st); flagsKey = fk;
        const p = getPreset(preset), wb = p.wheelbase / 1000;
        CORNERS.forEach((cn) => {
          const left = cn[1] === 'L', toe = drawnAngle(S.st[cn].toe, S.exag) * Math.PI / 180;
          const yaw = left ? -toe : toe;
          car.wheels[cn].rotation.y = yaw;
          const [x, z] = [car.wheels[cn].position.x, car.wheels[cn].position.z];
          setLine(lines[cn], x, z, x + 6 * Math.sin(yaw), z + 6 * Math.cos(yaw)); lines[cn].visible = S.flags.lasers;
          const ref = makeState(preset)[cn], gy = drawnAngle(ref.toe, S.exag) * Math.PI / 180;
          ghosts[cn].position.set(x, car.R, z); ghosts[cn].rotation.y = left ? -gy : gy; ghosts[cn].visible = S.flags.ghost;
        });
        const th = drawnAngle(thrustAngle(S.st), S.exag) * Math.PI / 180;
        setLine(lines.thrust, 0, -wb / 2, -6 * Math.sin(th), -wb / 2 + 6 * Math.cos(th))   /* + thrust = to the car's right = −x */; setLine(lines.centre, 0, -wb / 2, 0, 6);
        lines.thrust.visible = lines.centre.visible = S.flags.lasers;
        repaintTyres(); version = S.ver;
      }
      /* scrub arrows pulse with the road speed */
      const pulse = S.flags.auto ? 0.75 + 0.25 * Math.sin(t * 8) : 1;
      CORNERS.forEach((cn) => {
        const e = rep.err(cn), a = arrows[cn], left = cn[1] === 'L', [x, z] = wheelPos(cn);
        a.visible = Math.abs(e) > 0.005;
        if (a.visible) { a.position.set(x, 0.04, z); a.setDirection(new THREE.Vector3((left ? -1 : 1) * Math.sign(e), 0, 0)); a.setLength(Math.max(0.12, Math.min(0.7, Math.abs(e) * 1.6)) * pulse, 0.1, 0.07); }
      });
      /* auto-drive: the road scrolls, the car drifts sideways by the pull */
      if (S.flags.auto) {
        grid.position.z = (grid.position.z - dt * 3) % 0.5;
        driftX -= rep.pull.value * dt * 0.25;      /* + pull = to the car's right = −x */ if (Math.abs(driftX) > 1.2) driftX = 0;
      } else driftX = 0;
      rig.position.x = driftX;
      /* camera presets glide, then hand back to the orbit controls */
      if (camKey !== S.cam) {
        camKey = S.cam; const g = CAMERAS[S.cam]; goal = g ? { pos: new THREE.Vector3(...g.pos), target: new THREE.Vector3(...g.target) } : null; goalT = 0;
      }
      if (goal && H.camera && H.orbit) {
        goalT += dt; H.camera.position.lerp(goal.pos, 0.1); H.orbit.target.lerp(goal.target, 0.1); H.orbit.update();
        if (goalT > 1.6) goal = null;
      }
      const p = getPreset(preset), r = rep, unit = S.unit, R = p.tyreRadius, dev = ['F', 'R'].map((a) => r.stat[a]).concat(CORNERS.map((cn) => r.status[cn]));
      const worst = dev.includes('crit') ? 'crit' : dev.includes('warn') ? 'warn' : 'ok';
      const f = (deg) => formatToe(deg, unit, R);
      const tot = r.d.totalToeF;
      return {
        big: formatToe(tot, unit, R), unit: '', bar: clamp(50 + tot / 0.6 * 50, 0, 100),
        ro: {
          toeFL: [f(S.st.FL.toe), r.status.FL, S.st.FL.toe], toeFR: [f(S.st.FR.toe), r.status.FR, S.st.FR.toe],
          toeRL: [f(S.st.RL.toe), r.status.RL, S.st.RL.toe], toeRR: [f(S.st.RR.toe), r.status.RR, S.st.RR.toe],
          dev: [worst === 'ok' ? 'OK' : worst === 'warn' ? 'Warning' : 'Out of spec', worst],
          life: [r.life.toFixed(0) + ' %', r.life > 85 ? 'ok' : r.life > 60 ? 'warn' : 'crit'],
          pull: [(r.drift >= 0 ? '+' : '−') + Math.abs(r.drift).toFixed(0) + ' cm/100 m', Math.abs(r.drift) < 6 ? 'ok' : 'warn'],
          steer: [(r.steer.value >= 0 ? '+' : '−') + Math.abs(r.steer.value).toFixed(1) + '°', Math.abs(r.steer.value) < 1 ? 'ok' : 'warn'],
          fuel: ['+' + r.fuel.toFixed(1) + ' %', r.fuel < 0.3 ? 'ok' : 'warn']
        },
        status: [r.explain, worst !== 'ok'],
        ctl: toeDegToMm(tot, R).toFixed(1) + ' mm'
      };
    },
    dispose() { dispose.forEach((o) => o.dispose && o.dispose()); car.dispose(); }
  };
}
