/* ═══════════════════════════════════════════════════════════════════════
   kit.js — Auto Lab shared runtime.
   Combines: module-base (scene + helpers) + module-ui (universal UI).

   Usage in a module:
     import * as Base from './kit.js';
     import { UI }     from './kit.js';

     const built = Base.buildScene({ ... });
     const ui    = UI.create({ ... });
   ═══════════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createLabelSystem as _createLabelSystem, KINDS as LABEL_KINDS, DENSITY_INFO } from './labels.js';

export { THREE, OrbitControls, LABEL_KINDS, DENSITY_INFO };
export const DEG = Math.PI / 180;
export const TAU = Math.PI * 2;

/* ═══════════════════════════════════════════════════════════════════════
   BASE — scene bootstrap + geometry helpers
   ═══════════════════════════════════════════════════════════════════════ */

export function detectEmbed() {
  const embedded = window.parent && window.parent !== window;
  if (embedded) document.body.classList.add('embedded');
  return embedded;
}

function detectQuality() {
  const isCoarse = matchMedia('(pointer: coarse)').matches;
  const cores    = navigator.hardwareConcurrency || 4;
  const mem      = navigator.deviceMemory || 4;
  const dpr      = window.devicePixelRatio || 1;
  const isLowEnd = cores <= 4 || mem <= 2;
  const isMidEnd = !isLowEnd && (cores <= 6 || mem <= 4 || (isCoarse && dpr >= 2.5));
  const isHighEnd = !isLowEnd && !isMidEnd;
  const dprCap = isLowEnd ? 1.75 : isMidEnd ? 2 : 2.5;
  const look = isLowEnd
    ? { antialias: dpr < 2, shadows:false, shadowMapSize:0, rimLight:false,
        grid:false, floorSegments:32, fogDensityMul:1.15, toneMapping:true, exposure:1.1, enhance:false }
    : isMidEnd
    ? { antialias:true, shadows:true, shadowMapSize:2048, rimLight:true,
        grid:true, floorSegments:48, fogDensityMul:1.0, toneMapping:true, exposure:1.18, enhance:true }
    : { antialias:true, shadows:true, shadowMapSize:isCoarse ? 2048 : 4096, rimLight:true,
        grid:true, floorSegments:64, fogDensityMul:0.9, toneMapping:true, exposure:1.25, enhance:true };
  return { isCoarse, cores, mem, dpr, isLowEnd, isMidEnd, isHighEnd, dprCap, look };
}

function createViewManager(scene, renderer, camera) {
  const DARK_BG = 0x0b0e14, LIGHT_BG = 0xdde2ea;
  const DARK_FLOOR = 0x12161f, LIGHT_FLOOR = 0xcbd0d8;
  const state = { theme: 'dark', wireframe: false, xray: false };
  const originals = {
    bg: null, fog: null, hemi: null, hemiIntensity: 0.55,
    floor: null, floorColor: null, grid: null,
    meshMap: new Map(), matSet: new Set()
  };
  if (scene.background instanceof THREE.Color) originals.bg = scene.background.clone();
  if (scene.fog && scene.fog.color) originals.fog = scene.fog.color.clone();

  const wireCache = new Map();
  const xrayCache = new Map();

  function collectStatics() {
    scene.traverse(obj => {
      if (obj.isHemisphereLight && !originals.hemi) {
        originals.hemi = obj; originals.hemiIntensity = obj.intensity;
      }
      if (obj.userData) {
        if (obj.userData.__isFloor && obj.material && obj.material.color) {
          originals.floor = obj.material;
          originals.floorColor = obj.material.color.clone();
        }
        if (obj.userData.__isGrid) originals.grid = obj;
      }
    });
  }
  function collectNewMeshes() {
    scene.traverse(obj => {
      if (!(obj.isMesh || obj.isInstancedMesh)) return;
      if (originals.meshMap.has(obj)) return;
      const mat = obj.material;
      if (Array.isArray(mat)) {
        originals.meshMap.set(obj, mat.slice());
        mat.forEach(m => m && originals.matSet.add(m));
      } else if (mat && mat.color) {
        originals.meshMap.set(obj, mat);
        originals.matSet.add(mat);
      }
    });
  }
  function pickWireColor(mat) {
    if (!mat.color) return new THREE.Color(0x38bdf8);
    const c = mat.color;
    const max = Math.max(c.r, c.g, c.b), min = Math.min(c.r, c.g, c.b);
    const sat = max < 0.001 ? 0 : (max - min) / max;
    if (sat > 0.20) {
      const hsl = { h:0, s:0, l:0 };
      c.getHSL(hsl);
      return new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 1.25), 0.62);
    }
    if (typeof mat.metalness === 'number') {
      if (mat.metalness > 0.70) return new THREE.Color(0x38bdf8);
      if (mat.metalness > 0.35) return new THREE.Color(0x22c55e);
    }
    return new THREE.Color(0x94a3b8);
  }
  function makeWireMaterial(mat) {
    if (wireCache.has(mat.uuid)) return wireCache.get(mat.uuid);
    const wm = new THREE.MeshBasicMaterial({
      color: pickWireColor(mat), wireframe: true, transparent: true,
      opacity: 0.85, depthWrite: false, depthTest: true, fog: true
    });
    wireCache.set(mat.uuid, wm);
    return wm;
  }
  function makeXrayMaterial(mat) {
    if (xrayCache.has(mat.uuid)) return xrayCache.get(mat.uuid);
    let xm;
    try { xm = mat.clone(); }
    catch (_) { xm = new THREE.MeshBasicMaterial({ color: 0x94a3b8 }); }
    xm.transparent = true;
    xm.opacity = 0.24;
    xm.depthWrite = false;
    xm.side = mat.side || THREE.FrontSide;
    if ('emissiveIntensity' in xm) xm.emissiveIntensity = 0;
    xrayCache.set(mat.uuid, xm);
    return xm;
  }
  function applyMaterials() {
    originals.meshMap.forEach((orig, mesh) => {
      mesh.material = Array.isArray(orig) ? orig.slice() : orig;
    });
    collectNewMeshes();
    const { wireframe, xray } = state;
    if (!wireframe && !xray) return;
    originals.meshMap.forEach((orig, mesh) => {
      if (Array.isArray(orig)) {
        if (wireframe) mesh.material = orig.map(m => makeWireMaterial(m));
        else if (xray) mesh.material = orig.map(m => makeXrayMaterial(m));
      } else {
        if (wireframe) mesh.material = makeWireMaterial(orig);
        else if (xray) mesh.material = makeXrayMaterial(orig);
      }
    });
  }
  function applyTheme() {
    const isLight = state.theme === 'light';
    if (scene.background && scene.background.isColor)
      scene.background.setHex(isLight ? LIGHT_BG : DARK_BG);
    if (scene.fog && scene.fog.color)
      scene.fog.color.setHex(isLight ? LIGHT_BG : DARK_BG);
    if (originals.hemi)
      originals.hemi.intensity = isLight ? originals.hemiIntensity * 1.55 : originals.hemiIntensity;
    if (originals.floor) {
      originals.floor.color.copy(originals.floorColor);
      if (isLight) originals.floor.color.lerp(new THREE.Color(LIGHT_FLOOR), 0.85);
    }
    if (originals.grid && originals.grid.material) {
      const g = originals.grid.material;
      if (Array.isArray(g)) g.forEach(m => { m.opacity = isLight ? 0.35 : 1; m.transparent = true; });
      else { g.opacity = isLight ? 0.35 : 1; g.transparent = true; }
    }
    document.documentElement.classList.toggle('light-theme', isLight);
    document.body.classList.toggle('light-theme', isLight);
  }

  collectStatics();

  const vm = {
    setTheme(t) {
      if (t !== 'dark' && t !== 'light') return;
      if (state.theme === t) return;
      state.theme = t; applyTheme();
    },
    setWireframe(v) {
      v = !!v;
      if (state.wireframe === v) return;
      state.wireframe = v;
      if (v) state.xray = false;
      applyMaterials();
    },
    setXRay(v) {
      v = !!v;
      if (state.xray === v) return;
      state.xray = v;
      if (v) state.wireframe = false;
      applyMaterials();
    },
    restore() {
      state.theme = 'dark'; state.wireframe = false; state.xray = false;
      applyMaterials(); applyTheme();
    },
    refresh() { applyMaterials(); },
    getState() { return { ...state }; },
    /* ── Fix for "wireframe/xray stops working" in modules that swap a
       mesh's base material at runtime (e.g. a diode turning on/off, a
       valve glowing hot). Calling mesh.material = X directly bypasses
       the tracked "original" material, so the next render silently
       reverts that one mesh out of wireframe/x-ray mode. Modules should
       call viewManager.setMeshMaterial(mesh, newBaseMaterial) instead of
       assigning mesh.material directly whenever the mesh could be
       wireframed/x-rayed; this keeps the tracked original in sync and
       re-applies the current view mode to it immediately. */
    setMeshMaterial(mesh, newMat) {
      if (!mesh) return;
      originals.meshMap.set(mesh, newMat);
      if (newMat && newMat.color) originals.matSet.add(newMat);
      if (!state.wireframe && !state.xray) { mesh.material = newMat; return; }
      mesh.material = state.wireframe ? makeWireMaterial(newMat) : makeXrayMaterial(newMat);
    }
  };

  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.source !== 'auto-shell' || d.type !== 'command') return;
    switch (d.action) {
      case 'setTheme':     vm.setTheme(d.value === 'light' ? 'light' : 'dark'); break;
      case 'setWireframe': vm.setWireframe(!!d.value); break;
      case 'setXRay':      vm.setXRay(!!d.value); break;
    }
  });

  return vm;
}

let _vm = null;

export function buildScene(opts = {}) {
  const wrap = document.getElementById('canvas-wrap');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0e14);

  const q = detectQuality();
  const { isCoarse, isLowEnd, isMidEnd, dprCap, look } = q;

  scene.fog = new THREE.FogExp2(0x0b0e14, (opts.fogDensity ?? 0.035) * look.fogDensityMul);

  const baseFov = opts.fov ?? 42;
  const camera = new THREE.PerspectiveCamera(baseFov, 1, 0.1, 100);
  const cp = opts.camPos || [5.6, 3.7, 7.4];
  camera.position.set(cp[0], cp[1], cp[2]);

  const renderer = new THREE.WebGLRenderer({
    antialias: look.antialias,
    powerPreference: 'high-performance',
    stencil: false, alpha: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap));
  /* Adaptive resolution (conservative): stay at full sharpness; only step down when the
     device is clearly struggling (<~30 fps for two consecutive windows), never below 80%
     of full resolution, and step back up as soon as there is headroom. */
  (function () {
    const maxR = Math.min(window.devicePixelRatio || 1, dprCap), minR = Math.max(1, maxR * 0.8);
    if (maxR <= minR) return;
    const origRender = renderer.render.bind(renderer);
    let ratio = maxR, last = 0, sum = 0, n = 0, slow = 0, calm = 0, warm = 0;
    renderer.render = function (scene, cam) {
      const t = performance.now();
      if (++warm > 150 && last) { const dt = t - last; if (dt < 200) { sum += dt; n++; } }
      last = t;
      if (n >= 60) {
        const avg = sum / n; sum = 0; n = 0;
        if (avg > 34) { calm = 0; if (++slow >= 2 && ratio > minR) { ratio = Math.max(minR, ratio - 0.25); slow = 0; renderer.setPixelRatio(ratio); } }
        else if (avg < 20) { slow = 0; if (++calm >= 2 && ratio < maxR) { ratio = Math.min(maxR, ratio + 0.25); calm = 0; renderer.setPixelRatio(ratio); } }
        else { slow = 0; calm = 0; }
      }
      return origRender(scene, cam);
    };
    document.addEventListener('visibilitychange', () => { last = 0; sum = 0; n = 0; warm = 0; });
  })();
  renderer.shadowMap.enabled = look.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (look.toneMapping) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = look.exposure;
  }
  if (look.enhance) renderer.domElement.style.filter = 'saturate(1.14) contrast(1.05)';
  wrap.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', (document.title || 'Auto Lab').replace(/\s*—\s*Auto Lab$/, '') + ' — interactive 3D model');
  let _leaving = false;
  window.addEventListener('pagehide', () => { _leaving = true; try { renderer.dispose(); renderer.forceContextLoss(); } catch (_) {} });
  /* Context-loss recovery: the browser evicts old WebGL contexts (esp. mobile).
     three.js restores on its own if the context comes back; if not within 1.2s, reload this module. */
  let _lostTimer = 0;
  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    if (_leaving) return;
    clearTimeout(_lostTimer);
    _lostTimer = setTimeout(() => { if (!_leaving) location.reload(); }, 1200);
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => clearTimeout(_lostTimer));

  const controls = new OrbitControls(camera, renderer.domElement);
  const tg = opts.target || [0, 1.9, 0];
  controls.target.set(tg[0], tg[1], tg[2]);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 3.5;
  controls.maxDistance = 16;
  controls.maxPolarAngle = Math.PI * 0.92;
  controls.rotateSpeed = isCoarse ? 0.6 : 0.9;
  controls.zoomSpeed   = isCoarse ? 0.7 : 1.0;

  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x2a2030, isLowEnd ? 0.75 : 0.7);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff4e6, isLowEnd ? 1.1 : (isMidEnd ? 1.4 : 1.55));
  key.position.set(4, 8, 5);
  if (look.shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(look.shadowMapSize, look.shadowMapSize);
    key.shadow.camera.near = 1; key.shadow.camera.far = 25;
    key.shadow.camera.left = -6; key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;   key.shadow.camera.bottom = -6;
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.02;
  }
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x88aaff, isLowEnd ? 0.5 : 0.4);
  fill.position.set(-5, 3, -3);
  scene.add(fill);

  if (look.rimLight) {
    const rimBlue = new THREE.DirectionalLight(0x6ba8ff, isMidEnd ? 0.35 : 0.45);
    rimBlue.position.set(-6, 3, -6);
    scene.add(rimBlue);
    const rimAmber = new THREE.DirectionalLight(0xffaa66, isMidEnd ? 0.25 : 0.35);
    rimAmber.position.set(5, 4, -6);
    scene.add(rimAmber);
  }

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(9, look.floorSegments),
    new THREE.MeshStandardMaterial({ color: 0x12161f, roughness: 0.92, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = opts.floorY ?? -2.15;
  floor.receiveShadow = look.shadows;
  floor.userData.__isFloor = true;
  floor.material.envMapIntensity = 0.25;   /* modules add their own environment map; keep floor colour stable while orbiting */
  scene.add(floor);

  if (look.grid) {
    const grid = new THREE.GridHelper(10, 20, 0x1e293b, 0x151a24);
    grid.position.y = (opts.floorY ?? -2.15) + 0.01;
    grid.material.transparent = true;
    grid.material.opacity = 0.7;
    grid.userData.__isGrid = true;
    scene.add(grid);
  }

  if (!isLowEnd) {
    const EW = 512, EH = 256;
    const envCanvas = document.createElement('canvas');
    envCanvas.width = EW; envCanvas.height = EH;
    const ctx = envCanvas.getContext('2d');
    const grd = ctx.createLinearGradient(0, 0, 0, EH);
    grd.addColorStop(0.00, '#dbe8ff');
    grd.addColorStop(0.28, '#7f9cc9');
    grd.addColorStop(0.47, '#3a4866');
    grd.addColorStop(0.53, '#232b3d');
    grd.addColorStop(0.75, '#10141d');
    grd.addColorStop(1.00, '#07090e');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, EW, EH);
    /* soft studio light boxes: cool key, warm fill, thin rim strips */
    const box = (cx, cy, rx, ry, c0, a0) => {
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, c0); g.addColorStop(0.55, c0.replace('1)', a0 + ')')); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    };
    box(EW * 0.18, EH * 0.22, 70, 40, 'rgba(255,255,255,1)', 0.55);
    box(EW * 0.62, EH * 0.18, 90, 40, 'rgba(255,236,210,1)', 0.5);
    box(EW * 0.88, EH * 0.32, 50, 26, 'rgba(140,190,255,1)', 0.45);
    box(EW * 0.40, EH * 0.46, 120, 10, 'rgba(255,255,255,1)', 0.35);
    const envTex = new THREE.CanvasTexture(envCanvas);
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    envTex.colorSpace = THREE.SRGBColorSpace;
    scene.environment = envTex;
  }

  _vm = createViewManager(scene, renderer, camera);
  return { scene, camera, renderer, controls, wrap, isCoarse, baseFov, quality: q, viewManager: _vm };
}

export function attachResize(camera, renderer, wrap, baseFov = 42) {
  function resize() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.fov = camera.aspect < 1
      ? Math.min(72, baseFov / Math.max(0.58, camera.aspect))
      : baseFov;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  let raf = 0;
  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; resize(); });
  };
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', () => setTimeout(schedule, 220));
  resize();
  return resize;
}

/* ---- Standard materials ---- */
export function createMaterials() {
  const matMetal     = new THREE.MeshStandardMaterial({ color: 0x8a93a5, metalness: 0.85, roughness: 0.28 });
  const matMetalDark = new THREE.MeshStandardMaterial({ color: 0x3d4555, metalness: 0.70, roughness: 0.40 });
  const matAlu       = new THREE.MeshStandardMaterial({ color: 0xc5ccd6, metalness: 0.75, roughness: 0.32 });
  const matIron      = new THREE.MeshStandardMaterial({ color: 0x4a5160, metalness: 0.55, roughness: 0.55 });
  const matIronDS    = matIron.clone(); matIronDS.side = THREE.DoubleSide;
  const matCut       = new THREE.MeshStandardMaterial({ color: 0xc45c2a, metalness: 0.15, roughness: 0.70, side: THREE.DoubleSide });
  const matPiston    = new THREE.MeshStandardMaterial({ color: 0xd4dbe6, metalness: 0.65, roughness: 0.35 });
  const matRing      = new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.90, roughness: 0.20 });
  const matValve     = new THREE.MeshStandardMaterial({ color: 0xb8c0cc, metalness: 0.80, roughness: 0.25 });
  const matSpring    = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.30 });
  const matInsulator = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.05, roughness: 0.40 });
  const matPortIn    = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.10, roughness: 0.30, side: THREE.DoubleSide, transparent: true, opacity: 0.16, depthWrite: false });
  const matPortEx    = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.10, roughness: 0.30, side: THREE.DoubleSide, transparent: true, opacity: 0.16, depthWrite: false });
  const matGas       = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, roughness: 1, metalness: 0 });
  const matFlash     = new THREE.MeshBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0 });
  const matSeat      = new THREE.MeshStandardMaterial({ color: 0xb08050, metalness: 0.65, roughness: 0.45 });
  const matGuide     = matMetalDark.clone(); matGuide.side = THREE.DoubleSide;
  const matFlangeGlass = new THREE.MeshStandardMaterial({ color: 0x8a93a5, metalness: 0.30, roughness: 0.40, side: THREE.DoubleSide, transparent: true, opacity: 0.35, depthWrite: false });
  return { matMetal, matMetalDark, matAlu, matIron, matIronDS, matCut, matPiston, matRing, matValve, matSpring, matInsulator, matPortIn, matPortEx, matGas, matFlash, matSeat, matGuide, matFlangeGlass };
}

/* ---- Geometry helpers ---- */
export function makeCutFace(w, h, mat) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}
export function halfCylShell(rOuter, rInner, height, mats, segs = 48) {
  const m = mats || {};
  const mIron = m.matIron || new THREE.MeshStandardMaterial({ color: 0x4a5160, metalness: 0.55, roughness: 0.55 });
  const mMetalDark = m.matMetalDark || new THREE.MeshStandardMaterial({ color: 0x3d4555, metalness: 0.70, roughness: 0.40 });
  const mCut = m.matCut || new THREE.MeshStandardMaterial({ color: 0xc45c2a, metalness: 0.15, roughness: 0.70, side: THREE.DoubleSide });
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(rOuter, rOuter, height, segs, 1, true, Math.PI / 2, Math.PI), mIron);
  outer.castShadow = true; g.add(outer);
  const innerMat = mMetalDark.clone(); innerMat.side = THREE.BackSide;
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(rInner, rInner, height, segs, 1, true, Math.PI / 2, Math.PI), innerMat));
  const faceW = rOuter - rInner;
  const f1 = makeCutFace(faceW, height, mCut); f1.position.set(-(rInner + rOuter) / 2, 0, 0); g.add(f1);
  const f2 = makeCutFace(faceW, height, mCut); f2.position.set((rInner + rOuter) / 2, 0, 0); g.add(f2);
  return g;
}
export function makeCoolingFins(r, count, spacing, thickness, matAlu, matCut) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const y = (i - (count - 1) / 2) * spacing;
    const fin = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.18, r + 0.18, thickness, 48, 1, true, Math.PI / 2, Math.PI), matAlu);
    fin.position.y = y; g.add(fin);
    const fe1 = makeCutFace(0.18, thickness, matCut); fe1.position.set(-(r + 0.09), y, 0); g.add(fe1);
    const fe2 = makeCutFace(0.18, thickness, matCut); fe2.position.set(r + 0.09, y, 0); g.add(fe2);
  }
  return g;
}
export function makeHelixSpring(radius, tubeR, turns, height, mat, segs = 80) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = t * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, t * height, Math.sin(a) * radius));
  }
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segs, tubeR, 8, false), mat);
}
export function tubeBetween(p0, p1, r0, r1, mat, openEnded = true) {
  const dir = new THREE.Vector3().subVectors(p1, p0);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 24, 1, openEnded), mat);
  mesh.position.copy(p0).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return mesh;
}
export function makeFlange(pos, dir, r, t, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, t, 24), mat);
  m.position.copy(pos);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return m;
}
export function makeCog(radius, thickness, teeth, toothLen, toothWid, mat, teethMat) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, thickness, 40), mat));
  const tm = teethMat || mat;
  const pitchR = radius + toothLen * 0.5;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const t = new THREE.Mesh(new THREE.BoxGeometry(toothLen, thickness * 1.05, toothWid), tm);
    t.position.set(Math.cos(a) * pitchR, 0, Math.sin(a) * pitchR);
    t.rotation.y = -a;
    g.add(t);
  }
  return g;
}
export function createParticleTexture() {
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = 64;
  const ctx = cnv.getContext('2d');
  const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0,   'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cnv);
}

/* Label system now lives in labels.js (priority tiers, colour-coding,
   leader lines, anti-flicker, auto-declutter). Re-exported here so every
   module's existing `Base.createLabelSystem()` call picks it up for free. */
export const createLabelSystem = _createLabelSystem;

export function createBridge(moduleId, onCommand) {
  const embedded = detectEmbed();
  function send(msg) {
    if (!embedded) return;
    try { window.parent.postMessage(Object.assign({ source: 'auto-module', moduleId }, msg), '*'); }
    catch (_) {}
  }
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.source !== 'auto-shell') return;
    if (d.moduleId && d.moduleId !== moduleId) return;
    if (typeof onCommand === 'function') onCommand(d);
  });
  return {
    embedded,
    ready() { send({ type: 'ready' }); },
    setStatus(text, color) { send({ type: 'state', status: { text, color } }); }
  };
}

export function createUIState() {
  const isCoarse = matchMedia('(pointer: coarse)').matches;
  return { playing: true, speedMul: 0.85, showLabels: true, showGas: true, isCoarse };
}

/* ═══════════════════════════════════════════════════════════════════════
   UI — universal UI builder
   ═══════════════════════════════════════════════════════════════════════ */
export const UI = {
  create(cfg) { return new UIKit(cfg); }
};

class UIKit {
  constructor(cfg) {
    this.cfg = cfg || {};
    this.moduleId = cfg.moduleId || 'module';
    this._slots = {};
    this._chipEls = {};
    this._chipRows = {};
    this._panelEls = {};

    this._ensureSlot('tl');
    this._ensureSlot('tr');
    this._ensureSlot('bl');
    this._ensureSlot('br');
    this._ensureSlot('bc');

    if (cfg.panel)   this._buildPanel(cfg.panel);
    if (cfg.chip)    this._buildChip(cfg.chip);
    if (cfg.toolbar) this._buildToolbar(cfg.toolbar);
    if (cfg.widgets) this._buildWidgets(cfg.widgets);

    this._wirePanelToggle();
  }

  _ensureSlot(name) {
    if (this._slots[name]) return this._slots[name];
    let el = document.getElementById('ui-slot-' + name);
    if (!el) {
      el = document.createElement('div');
      el.id = 'ui-slot-' + name;
      el.className = 'ui-slot ui-slot-' + name;
      /* tl (info panel) + tr (readout chip) share one responsive row that
         wraps instead of overlapping — see #ui-top-stack in app.css. */
      if (name === 'tl' || name === 'tr') {
        let stack = document.getElementById('ui-top-stack');
        if (!stack) {
          stack = document.createElement('div');
          stack.id = 'ui-top-stack';
          document.body.appendChild(stack);
        }
        stack.appendChild(el);
      } else {
        document.body.appendChild(el);
      }
    }
    this._slots[name] = el;
    return el;
  }

  /* Adds a small round toggle to `card` that shrinks it to a 44px orb
     pinned in its corner, and back again on tap. `icon` is inline SVG
     shown only while collapsed. */
  _makeCollapsible(card, icon) {
    const orbIcon = document.createElement('div');
    orbIcon.className = 'ui-orb-icon';
    orbIcon.innerHTML = icon || '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/></svg>';
    card.appendChild(orbIcon);

    const toggle = document.createElement('button');
    toggle.className = 'ui-orb-toggle';
    toggle.setAttribute('aria-label', 'Minimize');
    toggle.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14z"/></svg>';
    card.appendChild(toggle);

    const key = 'autolab.orb.' + this.moduleId + '.' + (card.id || 'card');
    function set(collapsed) {
      card.classList.toggle('is-orb', collapsed);
      toggle.setAttribute('aria-label', collapsed ? 'Expand' : 'Minimize');
      card.setAttribute('role', collapsed ? 'button' : '');
      card.tabIndex = collapsed ? 0 : -1;
      try { sessionStorage.setItem(key, collapsed ? '1' : '0'); } catch (_) {}
    }
    card.addEventListener('keydown', (e) => {
      if (card.classList.contains('is-orb') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); set(false); }
    });
    try { if (sessionStorage.getItem(key) === '1') set(true); } catch (_) {}
    toggle.addEventListener('click', (e) => { e.stopPropagation(); set(!card.classList.contains('is-orb')); });
    card.addEventListener('click', () => { if (card.classList.contains('is-orb')) set(false); });
    return { set };
  }

  _buildPanel(p) {
    const slot = this._slots.tl;
    const el = document.createElement('div');
    el.id = 'edu-panel';
    el.className = 'ui-panel ui-card';
    const isSmall = window.innerWidth <= 720 || window.innerHeight <= 540;
    const expanded = p.expanded ?? !isSmall;
    el.classList.toggle('expanded', expanded);

    const head = document.createElement('div');
    head.id = 'panel-head';
    head.className = 'ui-panel-head';
    head.innerHTML = `
      <div>
        <div class="ui-panel-kicker" id="module-kicker">${p.kicker || ''}</div>
        <div class="ui-panel-title"  id="module-title">${p.title || ''}</div>
      </div>
      <button class="ui-panel-toggle" id="panel-toggle" aria-label="Toggle info"
              aria-expanded="${expanded}">
        <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
      </button>`;
    el.appendChild(head);

    this._panelTabs = {};
    if (p.tabs && p.tabs.length) {
      const tabsEl = document.createElement('div');
      tabsEl.id = 'panel-tabs';
      tabsEl.className = 'ui-panel-tabs';
      tabsEl.setAttribute('role', 'tablist');
      p.tabs.forEach((t, i) => {
        const btn = document.createElement('button');
        btn.className = 'ui-tab' + (i === 0 ? ' active' : '');
        btn.dataset.tabId = t.id;
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
        if (t.color && i === 0) btn.style.background = t.color;
        btn.innerHTML = (t.icon || '') + `<span>${t.label}</span>`;
        btn.addEventListener('click', () => this._selectTab(t.id));
        tabsEl.appendChild(btn);
        this._panelTabs[t.id] = t;
      });
      el.appendChild(tabsEl);
    }
    this._onTab = p.onTab || null;

    const body = document.createElement('div');
    body.id = 'panel-body';
    body.className = 'ui-panel-body';
    body.innerHTML = `
      ${p.badge ? `<div class="ui-badge" id="stroke-badge"
        style="background:color-mix(in oklch, ${p.badge.color} 18%, transparent);color:${p.badge.color}">
        <span class="dot"></span><span id="badge-text">${p.badge.text || ''}</span>
      </div>` : ''}
      ${p.readout ? `<div id="panel-readout">${p.readout}</div>` : ''}
      ${p.desc ? `<div class="ui-desc" id="stroke-desc">${p.desc}</div>` : ''}
      ${p.hint ? `<div class="ui-desc-hint">${p.hint}</div>` : ''}`;
    el.appendChild(body);

    slot.appendChild(el);
    this._panelEls = { root: el, head, body, toggle: head.querySelector('#panel-toggle') };
    this._wireAutoCollapse(body);
    return el;
  }

  /* ═════════════════════════════════════════════════════════════════════
     AUTO-COLLAPSE — every module's panel body is capped to a short,
     scrollable height by default (~a few lines past the badge/readout),
     with a "Show more / Show less" toggle appended automatically. This
     replaces long, uncappped tab content (Overview/Faults/Self-check —
     often 300px+ of text) with a compact "basic info" view; tapping the
     toggle reveals the full "advanced" content, still inside the panel's
     own scroll area. No per-module changes needed — it watches the body
     for content the module adds later (tabs render after UI.create()
     returns) and re-measures automatically.
     ═════════════════════════════════════════════════════════════════════ */
  _wireAutoCollapse(body) {
    const CAP = 220; // px of content visible before "Show more" appears
    let btn = null, expanded = false, capped = false;

    const ensureBtn = () => {
      if (btn) return btn;
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ui-panel-more';
      btn.addEventListener('click', () => {
        expanded = !expanded;
        body.classList.toggle('is-expanded', expanded);
        btn.textContent = expanded ? 'Show less ▲' : 'Show more ▼';
      });
      return btn;
    };

    const measure = () => {
      /* Measure natural height without the cap so we know whether to cap at all. */
      const wasCapped = body.classList.contains('has-more');
      if (wasCapped) body.classList.remove('has-more');
      const full = body.scrollHeight;
      const needsCap = full > CAP + 40 && !expanded;
      if (needsCap) {
        if (!capped) {
          capped = true;
          body.classList.add('has-more');
          const b = ensureBtn();
          b.textContent = 'Show more ▼';
          if (b.parentNode !== body) body.appendChild(b);
        } else {
          body.classList.add('has-more');
        }
        body.style.setProperty('--cap-h', CAP + 'px');
      } else if (capped && !expanded) {
        /* content shrank below the threshold */
        capped = false;
        body.classList.remove('has-more');
        if (btn) btn.remove();
      } else if (expanded) {
        body.classList.add('has-more'); // keeps the button visible, but is-expanded lifts the cap
      }
    };

    const mo = new MutationObserver(() => requestAnimationFrame(measure));
    mo.observe(body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', () => requestAnimationFrame(measure));
    requestAnimationFrame(measure);
  }

  _selectTab(id) {
    const root = this._panelEls.root;
    if (!root) return;
    root.querySelectorAll('.ui-tab').forEach(btn => {
      const on = btn.dataset.tabId === id;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      const c = this._panelTabs?.[btn.dataset.tabId]?.color;
      btn.style.background = on ? (c || '') : '';
    });
    if (this._onTab) this._onTab(id);
  }

  _buildChip(c) {
    const slot = this._slots.tr;
    const el = document.createElement('div');
    el.className = 'ui-chip ui-card';
    el.id = 'ui-chip';

    let html = `<div class="ui-chip-label">${c.label || ''}</div>`;
    if (c.value !== undefined) {
      html += `<div class="ui-chip-value" id="chip-value">${c.value}<span>${c.unit || ''}</span></div>`;
    }
    if (c.bar) html += `<div class="ui-chip-bar"><div class="ui-chip-fill" id="chip-fill"></div></div>`;
    if (c.rows) c.rows.forEach(r => {
      html += `<div class="ui-chip-row"><span>${r.label}</span><b id="chip-row-${r.id}">${r.value ?? ''}</b></div>`;
    });
    if (c.status) {
      html += `<div class="ui-chip-status" id="chip-status"><i></i><span id="chip-status-text" role="status" aria-live="polite">${c.status.text || ''}</span></div>`;
    }
    el.innerHTML = html;
    slot.appendChild(el);
    this._makeCollapsible(el, '<svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3zm4 0h2v-2H7zm4 0h2v-2h-2zm4 0h2v-2h-2zm4 0h2v-2h-2z"/></svg>');

    this._chipEls = {
      root: el,
      value: el.querySelector('#chip-value'),
      fill: el.querySelector('#chip-fill'),
      status: el.querySelector('#chip-status'),
      statusText: el.querySelector('#chip-status-text'),
    };
    if (c.rows) c.rows.forEach(r => {
      this._chipRows[r.id] = el.querySelector('#chip-row-' + r.id);
    });
    return el;
  }

  _buildToolbar(t) {
    const slot = this._slots.bc;
    const el = document.createElement('div');
    el.id = 'module-controls';
    el.className = 'ui-toolbar ui-card';

    const iconPlay  = `<svg id="icon-play" viewBox="0 0 24 24" style="display:none"><path d="M8 5v14l11-7z"/></svg>`;
    const iconPause = `<svg id="icon-pause" viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>`;
    const iconReset = `<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>`;

    let html = '';
    /* Standalone (not in the shell): Back button so every module can return to the hub */
    if (!(window.parent && window.parent !== window))
      html += `<a class="ui-tb-btn" id="btn-home" href="index.html" aria-label="Back to Auto Lab" title="Back (Esc)"><svg viewBox="0 0 24 24"><path d="M15.4 6 14 4.6 6.6 12 14 19.4 15.4 18 9.4 12z"/></svg></a>`;
    if (t.play !== false)  html += `<button class="ui-tb-btn" id="btn-play" aria-label="Pause">${iconPause}${iconPlay}</button>`;
    if (t.reset !== false) html += `<button class="ui-tb-btn" id="btn-reset" aria-label="Reset">${iconReset}</button>`;
    if (t.speed) {
      html += `<div class="ui-tb-divider"></div>
        <div class="ui-tb-speed">
          <span>${t.speed.label || 'Speed'}</span>
          <input type="range" id="speed"
            min="${t.speed.min ?? 0.15}" max="${t.speed.max ?? 2.5}"
            step="${t.speed.step ?? 0.05}" value="${t.speed.value ?? 0.85}"
            aria-label="${t.speed.label || 'Speed'}">
          <span id="rpm-label"></span>
        </div>`;
    }
    if (t.labels) html += `<button class="ui-tb-btn active keep-in-embed" id="btn-density" aria-label="Label density: all" title="Labels: All">
      <svg viewBox="0 0 24 24"><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/></svg>
    </button>`;
    if (t.gas)    html += `<label class="ui-tb-check"><input type="checkbox" id="chk-gas" checked> Flow</label>`;
    html += `<div class="ui-tb-extras" id="toolbar-extras"></div>`;

    el.innerHTML = html;
    slot.appendChild(el);

    const extras = el.querySelector('#toolbar-extras');
    (t.extras || []).forEach(x => {
      const btn = document.createElement('button');
      btn.className = 'ui-tb-btn keep-in-embed';
      if (x.id) btn.id = x.id;
      btn.innerHTML = x.icon || (x.label ? `<span style="font-size:10px;font-weight:800">${x.label}</span>` : '');
      if (x.title) btn.title = x.title;
      if (x.onClick) btn.addEventListener('click', x.onClick);
      extras.appendChild(btn);
    });

    this._toolbar = { root: el, rpmLabel: el.querySelector('#rpm-label') };
    return el;
  }

  _buildWidgets(w) {
    ['bl', 'br'].forEach(slotName => {
      const spec = w[slotName];
      if (!spec) return;
      const slot = this._slots[slotName];
      const el = document.createElement('div');
      el.className = 'ui-widget';
      el.id = 'ui-widget-' + slotName;
      el.innerHTML = `
        <div class="ui-widget-frame">${spec.html || ''}</div>
        ${spec.caption ? `<div class="ui-widget-caption" id="ui-widget-${slotName}-cap">${spec.caption}</div>` : ''}`;
      slot.appendChild(el);
      if (typeof spec.onMount === 'function') spec.onMount(el, this);
    });
  }

  _wirePanelToggle() {
    const { root, head, toggle } = this._panelEls;
    if (!root || !toggle) return;
    const flip = () => {
      const expanded = root.classList.toggle('expanded');
      toggle.setAttribute('aria-expanded', String(expanded));
    };
    toggle.addEventListener('click', e => { e.stopPropagation(); flip(); });
    head.addEventListener('click', e => {
      if (e.target.closest('#panel-toggle')) return;
      if (document.body.classList.contains('embedded')) flip();
    });
  }

  /* ---- Public API ---- */
  get panel() {
    const self = this;
    return {
      get root() { return self._panelEls.root; },
      get body() { return self._panelEls.body; },
      expand()  { self._panelEls.root?.classList.add('expanded');  self._panelEls.toggle?.setAttribute('aria-expanded', 'true'); },
      collapse(){ self._panelEls.root?.classList.remove('expanded'); self._panelEls.toggle?.setAttribute('aria-expanded', 'false'); },
      toggle()  {
        const r = self._panelEls.root; if (!r) return;
        const on = r.classList.toggle('expanded');
        self._panelEls.toggle?.setAttribute('aria-expanded', String(on));
      },
      selectTab(id) { self._selectTab(id); },
    };
  }

  get chip() {
    const self = this;
    return {
      set(id, value) { const r = self._chipRows[id]; if (r) r.textContent = value; },
      setBig(value, unit) {
        const v = self._chipEls.value;
        if (!v) return;
        v.innerHTML = `${value}<span>${unit ?? ''}</span>`;
      },
      setColor(color) { if (self._chipEls.value) self._chipEls.value.style.color = color; },
      setBar(pct, color) {
        const f = self._chipEls.fill;
        if (!f) return;
        f.style.width = Math.max(0, Math.min(100, pct)) + '%';
        if (color) f.style.background = color;
      },
      setStatus(text, on) {
        if (!self._chipEls.status) return;
        self._chipEls.statusText.textContent = text;
        self._chipEls.status.classList.toggle('on', !!on);
      },
      get root() { return self._chipEls.root; },
    };
  }

  get toolbar() {
    const self = this;
    return {
      setRpmLabel(text) { if (self._toolbar?.rpmLabel) self._toolbar.rpmLabel.textContent = text; },
      get root() { return self._toolbar?.root; },
      get speedInput() { return self._toolbar?.root?.querySelector('#speed'); },
    };
  }

  /* ═════════════════════════════════════════════════════════════════════
     WIRE BRIDGE — connects the shell + auto-wires the kit's own toolbar.

     After this runs:
       • Play / reset / speed / labels / gas respond to clicks/taps.
       • `state.playing`, `state.speedMul`, `state.showLabels`, `state.showGas`
         update instantly.
       • Shell commands (`setPlaying`, `setSpeed`, …) update `state` AND
         the visible controls — no drift.
     ═════════════════════════════════════════════════════════════════════ */
  wireBridge(opts = {}) {
    const moduleId = this.moduleId;
    const self = this;
    const embedded = window.parent && window.parent !== window;
    if (embedded) {
      document.body.classList.add('embedded', 'uses-ui-kit');
    }

    const viewManager = opts.viewManager || null;
    const onCommand   = opts.onCommand   || null;
    const state       = opts.state       || {};

    const defaultHandlers = {
      setPlaying:   v => { if ('playing'    in state) state.playing    = !!v; },
      setSpeed:     v => { if ('speedMul' in state) { let x = +v; if (_speed) x = Math.max(+_speed.min, Math.min(+_speed.max, x)); state.speedMul = x; } },
      setLabels:    v => { if ('showLabels' in state) state.showLabels = !!v; },
      setGas:       v => { if ('showGas'    in state) state.showGas    = !!v; },
      setTheme:     v => { viewManager?.setTheme?.(v); },
      setWireframe: v => { viewManager?.setWireframe?.(!!v); },
      setXRay:      v => { viewManager?.setXRay?.(!!v); },
    };

    /* ─── Auto-wire the toolbar controls the kit itself creates ─── */
    const _play  = document.getElementById('btn-play');
    const _reset = document.getElementById('btn-reset');
    const _speed = document.getElementById('speed');
    const _lab   = document.getElementById('chk-labels');
    const _gas   = document.getElementById('chk-gas');

    function _syncPlayIcons() {
      const ip  = document.getElementById('icon-play');
      const ipa = document.getElementById('icon-pause');
      const playing = state.playing !== false;
      if (ip)  ip.style.display  = playing ? 'none'  : 'block';
      if (ipa) ipa.style.display = playing ? 'block' : 'none';
      if (_play) _play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    }
    function _syncControls() {
      if (_speed && 'speedMul' in state) _speed.value = state.speedMul;
      if (_lab   && 'showLabels' in state) _lab.checked = !!state.showLabels;
      if (_gas   && 'showGas' in state)    _gas.checked = !!state.showGas;
    }
    if ('playing' in state) _syncPlayIcons();
    _syncControls();

    if (_play)  _play.addEventListener('click', () => {
      state.playing = !state.playing;
      _syncPlayIcons();
    });
    if (_reset) _reset.addEventListener('click', () => {
      if (onCommand) onCommand({ action: 'reset' });
    });
    if (_speed) _speed.addEventListener('input', () => {
      state.speedMul = parseFloat(_speed.value);
    });
    if (_lab)   _lab.addEventListener('change', () => { state.showLabels = _lab.checked; });

    /* 3-state label density: All -> Key -> None -> All ... */
    const _dens = document.getElementById('btn-density');
    const DENS = [
      { level: 2, name: 'All',  dots: 3 },
      { level: 1, name: 'Key',  dots: 2 },
      { level: 0, name: 'None', dots: 0 },
    ];
    let _densIdx = 0;
    function _applyDensity(idx) {
      _densIdx = idx;
      const d = DENS[idx];
      window.__autolabLabels?.setDensity(d.level);
      window.__autolabDensity = d.level;   /* modules with their own labels (cooling) read this */
      if ('showLabels' in state) state.showLabels = d.level > 0;
      if (_dens) {
        _dens.classList.toggle('active', d.level > 0);
        _dens.title = 'Labels: ' + d.name;
        _dens.setAttribute('aria-label', 'Label density: ' + d.name);
        _dens.innerHTML = '<svg viewBox="0 0 24 24">' +
          (d.dots >= 1 ? '<path d="M3 6h18v2H3z"/>' : '') +
          (d.dots >= 3 ? '<path d="M3 11h18v2H3z"/>' : '') +
          (d.dots >= 2 ? '<path d="M3 16h18v2H3z"/>' : '') +
          (d.dots === 0 ? '<path d="M4 4l16 16-1.4 1.4L2.6 5.4z"/><path d="M3 11h18v2H3z" opacity=".35"/>' : '') +
          '</svg>';
      }
    }
    if (_dens) _dens.addEventListener('click', () => _applyDensity((_densIdx + 1) % DENS.length));

    /* Shared shortcuts (same in every module): P play/pause · R reset · D label density · Esc back (standalone).
       Space is NOT used here — braking, clutch and turbocharger use it as the pedal. */
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
      const k = e.key.toLowerCase();
      if      (k === 'p' && _play)  { _play.click(); }
      else if (k === 'r' && _reset) { _reset.click(); }
      else if (k === 'd' && _dens)  { _dens.click(); }
      else if (e.key === 'Escape' && !embedded) { const h = document.getElementById('btn-home'); if (h) location.href = h.href; }
    });
    if (_gas)   _gas.addEventListener('change', () => { state.showGas    = _gas.checked; });

    /* Wrap defaultHandlers so incoming shell commands keep the visible
       controls in sync (no drift between shell and module). */
    const wrappedHandlers = {
      ...defaultHandlers,
      setPlaying: v => { defaultHandlers.setPlaying(v); _syncPlayIcons(); },
      setSpeed:   v => { defaultHandlers.setSpeed(v);   if (_speed) _speed.value = state.speedMul; },
      setLabels:  v => { _applyDensity(v ? 0 : 2);      if (_lab)   _lab.checked = state.showLabels; },  /* keeps density button in sync with shell */
      setGas:     v => { defaultHandlers.setGas(v);     if (_gas)   _gas.checked = state.showGas; },
    };

    function send(msg) {
      if (!embedded) return;
      try { window.parent.postMessage(Object.assign({ source: 'auto-module', moduleId }, msg), '*'); }
      catch (_) {}
    }

    window.addEventListener('message', (e) => {
      const d = e.data;
      if (!d || d.source !== 'auto-shell') return;
      if (d.moduleId && d.moduleId !== moduleId) return;
      if (d.type !== 'command' && d.type !== 'query') return;
      const h = wrappedHandlers[d.action];
      if (h) h(d.value);
      if (onCommand) onCommand(d);
    });

    return {
      ready() { send({ type: 'ready' }); },
      setStatus(text, color) { send({ type: 'state', status: { text, color } }); },
      /* Modules that change state directly can ask the kit to re-sync. */
      syncControls() { _syncPlayIcons(); _syncControls(); },
    };
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   LEGACY — delete when every module is migrated to UI.create()
   ═══════════════════════════════════════════════════════════════════════ */
export function wireCommonUI(state, { onReset, onSpeed } = {}) {
  const btnPlay  = document.getElementById('btn-play');
  const iconPlay = document.getElementById('icon-play');
  const iconPause= document.getElementById('icon-pause');
  const btnReset = document.getElementById('btn-reset');
  const speed    = document.getElementById('speed');
  const rpmLabel = document.getElementById('rpm-label');
  const chkLabels= document.getElementById('chk-labels');
  const chkGas   = document.getElementById('chk-gas');

  function updateRpmLabel() {
    if (rpmLabel) rpmLabel.textContent = '~' + Math.round(400 + state.speedMul * 900) + ' rpm';
  }
  function updatePlayIcon() {
    if (iconPlay)  iconPlay.style.display  = state.playing ? 'none'  : 'block';
    if (iconPause) iconPause.style.display = state.playing ? 'block' : 'none';
  }
  if (btnPlay)  btnPlay.addEventListener('click', () => { state.playing = !state.playing; updatePlayIcon(); });
  if (btnReset) btnReset.addEventListener('click', () => { if (onReset) onReset(); });
  if (speed)    speed.addEventListener('input', () => {
    state.speedMul = parseFloat(speed.value);
    updateRpmLabel();
    if (onSpeed) onSpeed(state.speedMul);
  });
  if (chkLabels) chkLabels.addEventListener('change', () => { state.showLabels = chkLabels.checked; });
  if (chkGas)    chkGas.addEventListener('change',    () => { state.showGas    = chkGas.checked; });

  updateRpmLabel();
  updatePlayIcon();
  return { updatePlayIcon, updateRpmLabel, viewManager: _vm };
}

export function wirePanelToggle() {
  const eduPanel = document.getElementById('edu-panel');
  const btn = document.getElementById('panel-toggle');
  if (!eduPanel || !btn) return;
  if (eduPanel.classList.contains('ui-panel')) return;
  let userSet = false;
  btn.addEventListener('click', () => {
    userSet = true;
    eduPanel.classList.toggle('collapsed');
    btn.setAttribute('aria-expanded', String(!eduPanel.classList.contains('collapsed')));
  });
  function autoState() {
    if (userSet) return;
    const small = window.innerWidth <= 720 || window.innerHeight <= 540;
    eduPanel.classList.toggle('collapsed', small);
    btn.setAttribute('aria-expanded', String(!small));
  }
  autoState();
  window.addEventListener('resize', autoState);
}
