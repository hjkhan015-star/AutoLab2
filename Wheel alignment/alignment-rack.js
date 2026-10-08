/* alignment-rack.js — the alignment PLATFORM (drive-on rack: runways, approach ramps, front turn plates, rear slip plates, wheel stops)
   and the HJK 3D ALIGNER (cabinet, monitor, camera beam, wheel targets) for the Wheel Alignment pages. Rendering only.
   Scene units: 1 unit = 1 m. The rack top is y = 0 (where the tyres touch, so the car code is unchanged); the shared kit floor is
   sunk to y = −RACK_H, so the ground, grid, fog and theme colours are the same as every other module. */
import { getPreset } from './alignment-model.js';

export const RACK_H = 0.3;                 /* runway height above the shop floor (m) */
const RW = 0.64;                           /* runway width */
const TONE = { ok: '#4ade80', warn: '#fbbf24', crit: '#f87171', hi: '#22d3ee' };

function canvasTex(THREE, w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildRack(THREE, root) {
  const owned = [], mk = (o) => { owned.push(o); return o; };
  const std = (color, rough, metal, extra) => mk(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));

  /* textures: diamond tread plate, turn-plate degree scale, slip-plate rollers */
  const diamond = canvasTex(THREE, 128, 128, (g, w, h) => {
    g.fillStyle = '#4a4f58'; g.fillRect(0, 0, w, h); g.strokeStyle = '#6a717c'; g.lineWidth = 3;
    for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x + 4, y + 16); g.lineTo(x + 28, y + 16); g.moveTo(x + 16, y + 4); g.lineTo(x + 16, y + 28); g.stroke(); }
  }); mk(diamond);
  if (diamond.wrapS !== undefined) { diamond.wrapS = diamond.wrapT = THREE.RepeatWrapping; diamond.repeat && diamond.repeat.set(2, 14); }
  const turnTex = mk(canvasTex(THREE, 256, 256, (g, w, h) => {
    g.fillStyle = '#aab2bc'; g.fillRect(0, 0, w, h); g.translate(w / 2, h / 2); g.strokeStyle = '#1f2937'; g.fillStyle = '#1f2937';
    for (let a = -30; a <= 30; a += 5) { const r = (a * Math.PI) / 180 - Math.PI / 2, L = a % 10 === 0 ? 22 : 12; g.lineWidth = a === 0 ? 4 : 2; g.beginPath(); g.moveTo(Math.cos(r) * 104, Math.sin(r) * 104); g.lineTo(Math.cos(r) * (104 - L), Math.sin(r) * (104 - L)); g.stroke(); }
    g.font = 'bold 18px monospace'; g.textAlign = 'center'; g.fillText('0', 0, -66); g.fillText('20', -62, -50); g.fillText('20', 62, -50);
    g.beginPath(); g.arc(0, 0, 12, 0, 7); g.stroke();
  }));
  const slipTex = mk(canvasTex(THREE, 128, 128, (g, w, h) => {
    g.fillStyle = '#9aa3ad'; g.fillRect(0, 0, w, h); g.fillStyle = '#6b7380'; for (let y = 8; y < h; y += 16) g.fillRect(6, y, w - 12, 5);
  }));
  const M = {
    top: std(0xffffff, 0.75, 0.35, { map: diamond }), steel: std(0x59616c, 0.5, 0.65), dark: std(0x1a1e25, 0.8, 0.3), hazard: std(0xf5b301, 0.6, 0.1),
    turn: std(0xffffff, 0.35, 0.7, { map: turnTex }), slip: std(0xffffff, 0.4, 0.6, { map: slipTex }), pin: std(0xdc2626, 0.5, 0.3),
    case: std(0x2a2f38, 0.5, 0.4), trim: std(0x14b8a6, 0.4, 0.3, { emissive: 0x0b4f48, emissiveIntensity: 0.7 }), key: std(0x11151b, 0.7, 0.2),
    led: new THREE.MeshBasicMaterial({ color: 0x22d3ee }), led2: new THREE.MeshBasicMaterial({ color: 0x22c55e })
  }; mk(M.led); mk(M.led2);

  const rackG = new THREE.Group(), machineG = new THREE.Group(); root.add(rackG); root.add(machineG);
  let cur = null;
  const shade = (o, cast) => { if (o.traverse) o.traverse((c) => { if (c.isMesh) { c.receiveShadow = true; c.castShadow = !!cast; } }); return o; };

  /* ── platform: rebuilt when the vehicle preset changes (wheelbase / track move the plates) ── */
  function setPreset(id) {
    curId = id;
    if (cur) { rackG.remove(cur); cur.traverse && cur.traverse((c) => c.geometry && c.geometry.dispose()); }
    const p = getPreset(id), wb = p.wheelbase / 1000, tF = p.trackF / 1000, tR = p.trackR / 1000, track = (tF + tR) / 2;
    const zMax = wb / 2 + 1.0, zMin = -wb / 2 - 1.3, len = zMax - zMin, cz = (zMax + zMin) / 2, g = new THREE.Group(), TOP = -0.003;
    const put = (geo, mat, x, y, z, cast) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    const wedge = (sx) => {                                                    /* approach ramp (rear): side profile extruded across the runway */
      const L = 0.95, s = new THREE.Shape(); s.moveTo(0, TOP); s.lineTo(-L, -RACK_H); s.lineTo(0, -RACK_H); s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth: RW, bevelEnabled: false }); geo.translate(0, 0, -RW / 2); geo.rotateY(-Math.PI / 2);
      return put(geo, M.top, sx * track / 2, 0, zMin);
    };
    [1, -1].forEach((sx) => {
      const x = sx * track / 2;
      put(new THREE.BoxGeometry(RW, RACK_H, len), M.top, x, TOP - RACK_H / 2, cz);                                       /* runway */
      put(new THREE.BoxGeometry(0.03, 0.006, len), M.hazard, x + sx * (RW / 2 - 0.02), TOP + 0.003, cz);                /* hazard edge line */
      put(new THREE.BoxGeometry(0.03, 0.006, len), M.hazard, x - sx * (RW / 2 - 0.02), TOP + 0.003, cz);
      put(new THREE.BoxGeometry(RW, 0.05, 0.06), M.hazard, x, 0.022, zMax - 0.12);                                      /* wheel stop */
      wedge(sx);
      put(new THREE.BoxGeometry(RW, 0.03, 0.05), M.steel, x, TOP - 0.015, zMin - 0.02);                                 /* ramp hinge */
      /* front turn plate (centred under the front wheel) and rear slip plate */
      put(new THREE.CylinderGeometry(0.27, 0.27, 0.012, 40), M.turn, sx * tF / 2, -0.0015 - 0.006, wb / 2);
      put(new THREE.TorusGeometry(0.27, 0.01, 8, 40), M.steel, sx * tF / 2, -0.0015, wb / 2).rotation.x = Math.PI / 2;
      put(new THREE.BoxGeometry(0.03, 0.02, 0.05), M.pin, sx * tF / 2 + sx * 0.3, -0.004, wb / 2);                       /* locking pin */
      put(new THREE.BoxGeometry(0.5, 0.012, 0.6), M.slip, sx * tR / 2, -0.0015 - 0.006, -wb / 2);
    });
    [zMin + 0.35, zMax - 0.45].forEach((z) => put(new THREE.BoxGeometry(track - RW + 0.02, RACK_H * 0.5, 0.18), M.steel, 0, -RACK_H * 0.75, z));   /* cross-members */
    put(new THREE.BoxGeometry(track - RW + 0.02, 0.03, 0.4), M.dark, 0, -RACK_H + 0.015, cz);                            /* centre pan */
    cur = shade(g, false); rackG.add(cur);
  }

  /* ── HJK 3D aligner console (after the reference unit): cabinet on casters with a drawer and a graphic panel, keyboard tray,
        monitor, aluminium column with a camera beam and two camera pods. Stands on the shop floor in front of the rack. ── */
  const scr = document.createElement('canvas'); scr.width = 512; scr.height = 288;
  const scrTex = mk(new THREE.CanvasTexture(scr)); if (THREE.SRGBColorSpace) scrTex.colorSpace = THREE.SRGBColorSpace;
  const panelTex = mk(canvasTex(THREE, 512, 512, (g, w, h) => {                       /* orange panel: tyre, stripes, brand */
    g.fillStyle = '#e4491f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#111'; for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(300 + i * 30, 0); g.lineTo(330 + i * 30, 0); g.lineTo(130 + i * 30, h); g.lineTo(100 + i * 30, h); g.fill(); }
    g.fillStyle = '#1b1b1b'; g.beginPath(); g.ellipse(70, 270, 120, 230, 0, 0, 7); g.fill();
    g.strokeStyle = '#3a3a3a'; g.lineWidth = 6; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(20, 80 + i * 40); g.lineTo(160, 60 + i * 40); g.stroke(); }
    g.fillStyle = '#fff'; for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if ((x * 7 + y * 13 + x * y) % 3 === 0) g.fillRect(330 + x * 9, 60 + y * 9, 8, 8);
    g.fillStyle = '#fff'; g.font = 'bold italic 84px sans-serif'; g.textAlign = 'center'; g.fillText('HJK', 380, 360);
    g.font = 'bold 26px sans-serif'; g.fillText('3D Wheel Alignment', 380, 400);
    g.fillStyle = '#111'; g.fillRect(0, 456, w, 56); g.fillStyle = '#fff'; g.font = 'bold 24px sans-serif'; g.fillText('Garage Equipments & Tools', w / 2, 492);
  }));
  const logoTex = mk(canvasTex(THREE, 256, 160, (g, w, h) => {
    g.fillStyle = '#0b0b0d'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold italic 92px sans-serif'; g.textAlign = 'center'; g.fillText('HJK', w / 2, 100);
    g.fillStyle = '#e4491f'; g.fillRect(w / 2 - 70, 112, 140, 5); g.fillStyle = '#9ca3af'; g.font = '16px sans-serif'; g.fillText('3D WHEEL ALIGNER', w / 2, 142);
  }));
  const beamTex = mk(canvasTex(THREE, 512, 32, (g, w, h) => { g.fillStyle = '#cfd5db'; g.fillRect(0, 0, w, h); g.fillStyle = '#e4491f'; g.font = 'bold italic 22px sans-serif'; g.textAlign = 'center'; g.fillText('HJK', w / 2, 24); }));
  const AL = std(0xc4cbd2, 0.35, 0.85), ORG = std(0xe4491f, 0.45, 0.2), BLK = std(0x15171b, 0.55, 0.35), GLOSS = std(0x0a0b0e, 0.15, 0.6);
  const panelMat = std(0xffffff, 0.5, 0.15, { map: panelTex }), logoMat = new THREE.MeshBasicMaterial({ map: logoTex }), beamMat = std(0xffffff, 0.35, 0.6, { map: beamTex });
  mk(logoMat);
  {
    const g = new THREE.Group(), add = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; }, B = THREE.BoxGeometry;
    add(g, new B(0.62, 0.07, 0.56), BLK, 0, 0.14, 0);                                                                   /* base frame */
    [[-0.27, -0.24], [0.27, -0.24], [-0.27, 0.24], [0.27, 0.24]].forEach(([x, z]) => {                                  /* orange casters */
      add(g, new B(0.04, 0.06, 0.06), BLK, x, 0.1, z); const w = add(g, new THREE.CylinderGeometry(0.05, 0.05, 0.035, 14), ORG, x, 0.055, z); w.rotation.z = Math.PI / 2; });
    add(g, new B(0.6, 0.9, 0.5), BLK, 0, 0.64, 0);                                                                      /* cabinet */
    add(g, new B(0.5, 0.27, 0.012), ORG, 0, 0.9, 0.256);                                                                /* drawer panel */
    add(g, new B(0.16, 0.014, 0.025), AL, 0, 0.97, 0.27);                                                               /* drawer handle */
    add(g, new THREE.PlaneGeometry(0.5, 0.5), panelMat, 0, 0.5, 0.2625);                                                /* graphic panel */
    add(g, new B(0.64, 0.03, 0.54), BLK, 0, 1.105, 0);                                                                  /* keyboard tray */
    add(g, new B(0.44, 0.018, 0.15), std(0x0c0d10, 0.7, 0.2), 0, 1.13, 0.14);                                           /* keyboard */
    add(g, new B(0.16, 1.0, 0.1), AL, 0, 1.62, -0.17);                                                                  /* aluminium column */
    add(g, new B(0.06, 0.1, 0.14), BLK, 0, 1.36, -0.07);                                                                /* monitor arm */
    const mon = new THREE.Group(); mon.position.set(0, 1.38, 0.02); mon.rotation.x = -0.06; g.add(mon);
    add(mon, new B(0.46, 0.29, 0.035), BLK, 0, 0, 0); add(mon, new THREE.PlaneGeometry(0.42, 0.25), mk(new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false })), 0, 0, 0.0185);
    const head = add(g, new B(0.28, 0.2, 0.14), BLK, 0, 2.1, -0.17); add(head, new THREE.PlaneGeometry(0.24, 0.15), logoMat, 0, 0, 0.0715);      /* brand head */
    add(g, new B(0.4, 0.1, 0.09), AL, 0, 1.86, -0.17);                                                                   /* beam carrier */
    [-1, 1].forEach((sx) => {                                                                                            /* camera beam: two telescoping rails */
      add(g, new B(0.84, 0.08, 0.07), beamMat, sx * 0.62, 1.86, -0.17); add(g, new B(0.05, 0.1, 0.075), BLK, sx * 0.2, 1.86, -0.17);
      const pod = new THREE.Group(); pod.position.set(sx * 1.08, 1.86, -0.2); pod.rotation.y = -sx * 0.45 + Math.PI; g.add(pod);               /* camera pod looks at the car (−z) */
      const body = add(pod, new THREE.SphereGeometry(1, 20, 12), GLOSS, 0, 0, 0); body.scale.set(0.17, 0.085, 0.07);
      add(pod, new B(0.1, 0.1, 0.012), std(0x1c2a3a, 0.1, 0.8), 0, 0, 0.066);
      add(pod, new THREE.CylinderGeometry(0.03, 0.03, 0.014, 16), std(0x05080c, 0.05, 0.9), 0, 0, 0.072).rotation.x = Math.PI / 2;
      add(pod, new THREE.SphereGeometry(0.008, 6, 5), M.led, 0.1, 0.05, 0.062);
    });
    [[-1, 0.95], [-1, 0.55], [1, 0.95], [1, 0.55]].forEach(([sx, y]) => {                                               /* empty clamp holders on the cabinet sides (targets are on the car) */
      add(g, new THREE.CylinderGeometry(0.014, 0.014, 0.12, 8), AL, sx * 0.36, y, 0).rotation.z = Math.PI / 2; add(g, new B(0.03, 0.12, 0.05), AL, sx * 0.43, y, 0); });
    g.position.set(2.0, -RACK_H, 3.2); g.rotation.y = 0.45; machineG.add(shade(g, true));
  }

  /* ── wheel targets: clamp ring + dot-grid board on each wheel's outer face (they follow toe / camber / steer with the wheel) ── */
  const dots = mk(canvasTex(THREE, 256, 256, (g, w, h) => {
    g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, w, h); g.fillStyle = '#111';
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) { g.beginPath(); g.arc(28 + x * 40, 28 + y * 40, y === 2 && x === 3 ? 10 : 15, 0, 7); g.fill(); }
  }));
  const dotMat = mk(new THREE.MeshBasicMaterial({ map: dots })), tgtBack = std(0x15171b, 0.6, 0.3), tgtAl = std(0xaeb6bf, 0.4, 0.8);
  let tgtGeos = [], mounted = [], curId = 'hatchback';
  function mountTargets(car) {
    mounted.forEach(([w, o]) => w.remove(o)); mounted = []; tgtGeos.forEach((x) => x.dispose()); tgtGeos = [];
    const p = getPreset(curId), R = p.tyreRadius / 1000, Wd = p.tyreWidth / 1000, rr = R * 0.62, keep = (x) => { tgtGeos.push(x); return x; };
    ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
      const w = car.wheels[c], sign = c[1] === 'L' ? 1 : -1, g = new THREE.Group(), xo = sign * (Wd / 2 + 0.01);
      const put = (geo, mat, x, y, z) => { const m = new THREE.Mesh(keep(geo), mat); m.position.set(x, y, z); g.add(m); return m; };
      put(new THREE.TorusGeometry(rr * 0.96, 0.012, 8, 28), tgtAl, xo, 0, 0).rotation.y = Math.PI / 2;                    /* clamp ring on the rim lip */
      [0, 2.1, 4.2].forEach((a) => put(new THREE.BoxGeometry(0.02, 0.02, rr * 0.9), tgtAl, xo, 0, 0).rotation.x = a);      /* three clamp arms to the hub */
      put(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 10), tgtAl, sign * (Wd / 2 + 0.06), 0, 0).rotation.z = Math.PI / 2;  /* stem */
      put(new THREE.BoxGeometry(0.012, 0.32, 0.32), tgtBack, sign * (Wd / 2 + 0.115), 0, 0);                              /* target board */
      const face = put(new THREE.PlaneGeometry(0.3, 0.3), dotMat, sign * (Wd / 2 + 0.1215), 0, 0); face.rotation.y = sign * Math.PI / 2;
      w.add(g); mounted.push([w, g]);
    });
  }
  let shown = '';
  function show(title, pairs, status) {                      /* the monitor: HJK header + four live readings, tone-coloured */
    const key = title + '|' + JSON.stringify(pairs) + '|' + status; if (key === shown) return; shown = key;
    const g = scr.getContext('2d'); g.fillStyle = '#06141a'; g.fillRect(0, 0, 512, 288);
    g.fillStyle = '#0f766e'; g.fillRect(0, 0, 512, 44); g.fillStyle = '#fff'; g.font = 'bold italic 28px sans-serif'; g.textAlign = 'left'; g.fillText('HJK', 14, 32);
    g.font = 'bold 20px monospace'; g.fillStyle = '#e6fffb'; g.fillText('3D ALIGN', 84, 31); g.textAlign = 'right'; g.fillText(title, 498, 31);
    pairs.slice(0, 4).forEach(([label, v], i) => {
      const txt = Array.isArray(v) ? v[0] : String(v), tone = Array.isArray(v) ? v[1] : '', y = 88 + i * 44;
      g.fillStyle = '#7dd3c8'; g.font = '21px monospace'; g.textAlign = 'left'; g.fillText(label, 20, y);
      g.fillStyle = TONE[tone] || '#e2e8f0'; g.font = 'bold 27px monospace'; g.textAlign = 'right'; g.fillText(txt, 492, y);
      g.fillStyle = '#12313a'; g.fillRect(16, y + 9, 480, 2);
    });
    g.fillStyle = '#94a3b8'; g.font = '15px monospace'; g.textAlign = 'left'; g.fillText(String(status || '').slice(0, 52), 16, 276);
    scrTex.needsUpdate = true;
  }

  /* road-test mode (auto-drive): the rack and console step aside and the shared floor rises to the tyres */
  const scene = root.parent, kids = (scene && Array.isArray(scene.children)) ? scene.children : [];
  const floor = kids.find((o) => o.userData && o.userData.__isFloor), grid = kids.find((o) => o.userData && o.userData.__isGrid);
  function setRoad(on) {
    rackG.visible = machineG.visible = !on;
    if (floor) floor.position.y = on ? 0 : -RACK_H;
    if (grid) grid.position.y = (on ? 0 : -RACK_H) + 0.01;
  }
  function dispose() {
    [rackG, machineG].forEach((gr) => { root.remove(gr); gr.traverse && gr.traverse((c) => c.geometry && c.geometry.dispose()); });
    mounted.forEach(([w, o]) => w.remove(o)); tgtGeos.forEach((x) => x.dispose());
    owned.forEach((o) => o.dispose && o.dispose());
    setRoad(false);
  }
  return { rackG, machineG, setPreset, mountTargets, show, setRoad, dispose };
}
