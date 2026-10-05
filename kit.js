/* ═══════════════════════════════════════════════════════════════════════
   kit.js — Auto Lab shared runtime.
   Combines: module-base (scene + helpers) + module-ui (universal UI).

   Usage in a module:
     import * as Base from './kit.js';
     import { UI }     from './kit.js';

     const built = Base.buildScene({ ... });
     const ui    = UI.create({ ... });
   ═══════════════════════════════════════════════════════════════════════ */

import { createLabelSystem as _createLabelSystem, KINDS as LABEL_KINDS, DENSITY_INFO, getLabelDensity, setLabelDensity } from './labels.js';
import { createKeyRouter, installKeys } from './keys.js';
import { nextDensity, isPhone, createHeader, createMenu, clampSpeed, chromeButton } from './chrome.js';
import { createDock, modelShiftPx, classifyDevice, layoutMode } from './dock.js';
import { controls, createAxis, createMomentary, createDial, createChoice, createToggle, createAction } from './controls.js';
import { createMonitor } from './monitor.js';
export { controls };

/* three.js is the 3D half. A page marked <html data-no3d> (sensors) uses only the header, dock and Monitor, so it never loads it:
   first visit offline works, and the importmap is not needed there. Every other page gets the same objects as before. */
const NO3D = document.documentElement.hasAttribute('data-no3d');
const [THREE, OrbitControls] = NO3D ? [null, null] : await Promise.all([
  import('three'),
  import('three/addons/controls/OrbitControls.js').then((m) => m.OrbitControls)
]);

/* controls.css holds the header, ⋯ menu, dock and phone-sheet styles. Module pages link it; this is the
   safety net (resolved next to kit.js) so a page that forgot the <link> still gets a styled dock. */
function ensureControlsCss() {
  if (document.querySelector('link[href*="controls.css"]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = new URL('./controls.css', import.meta.url).href;
  document.head.appendChild(l);
}

export { THREE, OrbitControls, LABEL_KINDS, DENSITY_INFO, getLabelDensity, setLabelDensity };
/* Phase 7b3: row sinks. A page whose update code writes `ro.x.textContent = '…'` and `ro.x.className = 'v warn'` (the old panel
   readout grid) gets the same two properties as Monitor rows instead: `const ro = monitorRows(ui, ['fl', 'fr'], ['speed'])`.
   `ids` are rows declared in the Monitor config; `drop` names are old readouts that repeated a row or the big value:
   writes to them are ignored. The tone comes from the className word (ok | warn | crit; anything else is neutral). */
export function monitorRows(ui, ids, drop = []) {
  const make = (id, live) => {
    let text = '—', tone = '';
    const push = () => { if (live) ui.monitor.update({ rows: { [id]: tone ? [text, tone] : text } }); };
    return {
      set textContent(v) { text = String(v); push(); },
      get textContent() { return text; },
      set className(c) { const m = /\b(ok|warn|crit)\b/.exec(String(c)); tone = m ? m[1] : ''; push(); },
      get className() { return tone; },
    };
  };
  const out = {};
  ids.forEach((id) => { out[id] = make(id, true); });
  drop.forEach((id) => { out[id] = make(id, false); });
  return out;
}
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
  const tier = classifyDevice({ cores, mem, dpr, isCoarse });   /* one classification, shared with the dock (Phase 9a) */
  const isLowEnd = tier === 'low';
  const isMidEnd = tier === 'mid';
  const isHighEnd = tier === 'high';
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
  const LIGHT_FLOOR = 0xcbd0d8;
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
        if (avg > 34) {
          calm = 0;
          if (++slow >= 2 && ratio > minR) { ratio = Math.max(minR, ratio - 0.25); slow = 0; renderer.setPixelRatio(ratio); }
          else if (slow >= 3 && ratio <= minR) { slow = 0; window.dispatchEvent(new Event('al-perf-slow')); }   /* resolution is at its floor: ask the dock to paint cheaper */
        }
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
    /* Phones (portrait): nudge the model into the upper/mid area of the stage (Phase 2). */
    const dy = modelShiftPx(w, h, window.innerWidth, window.innerHeight);
    if (dy) camera.setViewOffset(w, h, 0, dy, w, h); else camera.clearViewOffset();
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
  /* The stage changes size when the dock changes height (swipe, keyboard) and on rotation,
     none of which fire a window resize. */
  if (typeof ResizeObserver === 'function') new ResizeObserver(schedule).observe(wrap);
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

const HOME_URL = 'index.html';

class UIKit {
  constructor(cfg) {
    this.cfg = cfg || {};
    this.moduleId = cfg.moduleId || 'module';
    this._slots = {};
    this._monitor = null;
    this._axes = {};
    this._panelEls = {};
    this._embedded = !!(window.parent && window.parent !== window);
    if (this._embedded) document.body.classList.add('embedded', 'uses-ui-kit');   /* early: --stage-top is 0 when embedded */
    ensureControlsCss();

    /* Only the top slots remain (info panel + readout). Everything at the bottom lives in the dock. */
    this._ensureSlot('tl');
    this._ensureSlot('tr');

    this._dock = createDock({ moduleId: this.moduleId });
    if (!this._embedded) this._buildStandaloneHeader();

    if (cfg.panel)   this._buildPanel(cfg.panel);
    if (cfg.monitor) this._buildMonitor(cfg.monitor);              /* Phase 7a/7b1: the Monitor is the one readout surface */
    if (cfg.toolbar) this._buildToolbar(cfg.toolbar);
    if (cfg.axes)    this._buildAxes(cfg.axes);      /* Phase 3: axis controls first, so legend widgets come last */
    if (cfg.options) this._buildOptions(cfg.options);   /* Phase 6: choice / toggle / action (options row, or primary when primary:true) */
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
         wraps instead of overlapping — see #ui-top-stack in app.css.
         (On phones the stack dissolves: the panel is a bottom sheet, the chip a top strip.) */
      let stack = document.getElementById('ui-top-stack');
      if (!stack) {
        stack = document.createElement('div');
        stack.id = 'ui-top-stack';
        document.body.appendChild(stack);
      }
      stack.appendChild(el);
    }
    this._slots[name] = el;
    return el;
  }

  /* ── Standalone: the same chrome.js header the shell draws (back · title · ⓘ · ⋯) ── */
  _buildStandaloneHeader() {
    const fallbackTitle = (document.title || 'Auto Lab').replace(/\s*—\s*Auto Lab$/, '');
    const cssAccent = getComputedStyle(document.documentElement).getPropertyValue('--al-accent').trim();
    this._header = createHeader({
      doc: document,
      title: fallbackTitle,
      color: cssAccent || undefined,
      onBack: () => { location.href = HOME_URL; },
      onInfo: () => this.panel.toggle(),
      onMenu: (btn) => { if (this._menu) this._menu.toggle(btn); }
    });
    this._header.setInfoVisible(!!this.cfg.panel);
    document.body.insertBefore(this._header.root, document.body.firstChild);
    /* Title + colour come from modules.js (the registry), like the shell. */
    const apply = () => {
      const list = window.AUTO_MODULES || [];
      const file = location.pathname.split('/').pop();
      const m = list.find((x) => x.id === this.moduleId) || list.find((x) => x.file === file);
      if (m) { this._header.setTitle(m.title || m.label); this._header.setColor(m.color); }
    };
    if (window.AUTO_MODULES) apply();
    else {
      const sc = document.createElement('script');
      sc.src = new URL('./modules.js', import.meta.url).href;
      sc.onload = apply;
      document.head.appendChild(sc);
    }
  }

  /* Adds a small round toggle to `card` that shrinks it to a 44px orb
     pinned in its corner, and back again on tap. `icon` is inline SVG
     shown only while collapsed. */
  _makeCollapsible(card, icon) {
    const orbIcon = document.createElement('div');
    orbIcon.className = 'ui-orb-icon';
    orbIcon.innerHTML = icon || '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/></svg>';
    card.appendChild(orbIcon);

    const toggle = chromeButton(document, { cls: 'ui-orb-toggle', label: 'Minimize', html: '<svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14z"/></svg>' });
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
      </div>`;
    head.appendChild(chromeButton(document, { cls: 'ui-panel-toggle', id: 'panel-toggle', label: 'Toggle info', attrs: { 'aria-expanded': String(expanded) },
      html: '<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>' }));
    el.appendChild(head);

    this._panelTabs = {};
    if (p.tabs && p.tabs.length) {
      const tabsEl = document.createElement('div');
      tabsEl.id = 'panel-tabs';
      tabsEl.className = 'ui-panel-tabs';
      tabsEl.setAttribute('role', 'tablist');
      p.tabs.forEach((t, i) => {
        const btn = chromeButton(document, { cls: 'ui-tab' + (i === 0 ? ' active' : ''), html: (t.icon || '') + `<span>${t.label}</span>`,
          attrs: { role: 'tab', 'aria-selected': i === 0 ? 'true' : 'false' } });
        btn.dataset.tabId = t.id;
        if (t.color && i === 0) btn.style.background = t.color;
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
     AUTO-COLLAPSE (Phase 7a: measures on tab switch / ResizeObserver only) — every module's panel body is capped to a short,
     scrollable height by default (~a few lines past the badge/readout),
     with a "Show more / Show less" toggle appended automatically. This
     replaces long, uncappped tab content (Overview/Faults/Self-check —
     often 300px+ of text) with a compact "basic info" view; tapping the
     toggle reveals the full "advanced" content, still inside the panel's
     own scroll area. No per-module changes needed — it re-measures on tab switch,
     on a ResizeObserver, and on panel.remeasure() (modules that add panel content after UI.create() call it).
     ═════════════════════════════════════════════════════════════════════ */
  _wireAutoCollapse(body) {
    const CAP = 220; // px of content visible before "Show more" appears
    let btn = null, expanded = false, capped = false;

    const ensureBtn = () => {
      if (btn) return btn;
      btn = chromeButton(document, { cls: 'ui-panel-more' });
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

    /* Phase 7a: no DOM-mutation watching and no measuring on text writes (readouts live in the Monitor now).
       Measure only on: tab switch (_selectTab), a ResizeObserver on the body, window resize, panel.remeasure(). */
    let queued = 0;
    const later = () => { if (queued) return; queued = requestAnimationFrame(() => { queued = 0; measure(); }); };
    this._measurePanel = later;
    if (typeof ResizeObserver === 'function') new ResizeObserver(later).observe(body);
    window.addEventListener('resize', later);
    later();
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
    if (this._measurePanel) this._measurePanel();          /* tab content changed → re-measure once */
  }

  /* Phase 7a — the Monitor (monitor.js). `monitor` = { config, initial } | a plain config. Phones: one-line strip + card;
     desktop: card with the collapse orb. */
  _buildMonitor(m) {
    const config = m && m.config ? m.config : m, initial = (m && m.initial) || null;
    this._monitor = createMonitor({ mount: this._slots.tr, doc: document, moduleId: this.moduleId });
    this._monitor.set(config);
    if (initial) { this._monitor.update(initial); this._monitor.flush(); }
    /* Wide screens dock the Monitor as the right column (the stage is inset by it), so the page has a Monitor column. */
    document.documentElement.dataset.monitor = '1';
    this._dock.relayout();
    /* Phones show the readout as a strip (the card slides down on tap); the orb is a card-on-stage nicety (721 - 1023 px).
       In the wide column it never collapses: a card folded back to an orb would leave an empty column. */
    if (!isPhone(window.innerWidth, window.innerHeight)) {
      const orb = this._makeCollapsible(this._monitor.root, '<svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3zm4 0h2v-2H7zm4 0h2v-2h-2zm4 0h2v-2h-2zm4 0h2v-2h-2z"/></svg>');
      const unfold = () => { if (layoutMode(window.innerWidth, window.innerHeight) === 'wide') orb.set(false); };
      unfold();
      window.addEventListener('resize', unfold);
    }
    return this._monitor.root;
  }

  /* ── Toolbar → dock. play / reset go to the transport zone (built ONCE, embedded and standalone,
        R1/R6); module quantities are `axes` (see _buildAxes);
        Flow goes to the options row (`extras` are retired: use options:[…]). Sim speed / label density / Back are NOT built here:
        the ⋯ menu (shell, or standalone chrome.js) owns them. ── */
  _buildToolbar(t) {
    const dock = this._dock;
    const iconPlay  = `<svg id="icon-play" viewBox="0 0 24 24" style="display:none"><path d="M8 5v14l11-7z"/></svg>`;
    const iconPause = `<svg id="icon-pause" viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>`;
    const iconReset = `<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>`;
    const make = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };

    const refs = { root: dock.root };
    if (t.play !== false) {
      refs.play = chromeButton(document, { cls: 'ui-tb-btn', id: 'btn-play', label: 'Pause', html: iconPause + iconPlay });
      dock.addTransport(refs.play);
    }
    if (t.reset !== false) {
      refs.reset = chromeButton(document, { cls: 'ui-tb-btn', id: 'btn-reset', label: 'Reset', html: iconReset });
      dock.addTransport(refs.reset);
    }
    if (t.gas) {
      /* Decision 2: the Flow toggle lives in the dock options row (it is not one of the five ⋯ items). */
      const flow = make(`<label class="ui-tb-check"><input type="checkbox" id="chk-gas" checked> Flow</label>`);
      dock.addOption(flow);
      refs.gas = flow;
    }
    dock.refresh();
    this._toolbar = refs;
    return dock.root;
  }

  /* Phase 3 — `axes: [spec]`: one `axis` (slider look, controls.js) per module quantity, hosted in the dock's
     primary zone. spec = controls.js axis spec + optional { side:'left'|'right', onChange(real, raw, norm) }.
     Values live in the shared store: read them with ui.controls.get / .value / .raw (R4), never from the DOM. */
  _buildAxes(list) {
    list.forEach((spec, i) => {
      const ax = spec.type === 'momentary' ? createMomentary(spec)       /* Phase 4: momentary = hold button (clutch) */
        : spec.type === 'dial' ? createDial(spec)                     /* Phase 5: dial = wheel / crank / knob */
        : createAxis(spec);
      this._axes[spec.id] = ax;
      if (typeof spec.onChange === 'function') {
        ax.on((n) => spec.onChange(ax.value(), ax.raw(), n));
      }
      const wrap = document.createElement('div');
      wrap.className = 'ui-widget ui-widget-axis';
      wrap.id = 'ui-widget-ax-' + spec.id;
      const frame = document.createElement('div');
      frame.className = 'ui-widget-frame';
      frame.appendChild(ax.el);
      wrap.appendChild(frame);
      this._dock.addPrimary({ id: 'ax-' + spec.id, side: spec.side || (i % 2 ? 'right' : 'left'), node: wrap });
    });
  }
  /* Phase 6 — `options: [spec]`: choice / toggle / action. They go to the dock options row; `primary:true`
     puts one in the primary zone instead. spec = controls.js spec + { primary, side }. Read them with
     ui.controls.get / .value (option id | boolean) / .on. */
  _buildOptions(list) {
    list.forEach((spec, i) => {
      const make = spec.type === 'toggle' ? createToggle : spec.type === 'action' ? createAction : createChoice;
      const c = make(spec);
      this._axes[spec.id] = c;
      if (spec.primary) {
        const wrap = document.createElement('div');
        wrap.className = 'ui-widget ui-widget-axis';
        wrap.id = 'ui-widget-ax-' + spec.id;
        const frame = document.createElement('div');
        frame.className = 'ui-widget-frame';
        frame.appendChild(c.el);
        wrap.appendChild(frame);
        this._dock.addPrimary({ id: 'ax-' + spec.id, side: spec.side || (i % 2 ? 'right' : 'left'), node: wrap });
      } else {
        this._dock.addOption(c.el);
      }
    });
  }
  /* options whose definitions only exist after UI.create (a config list built later): same specs as `options` */
  addOptions(list) { this._buildOptions(list); return this; }
  get controls() { return controls; }
  axis(id) { return this._axes[id] || null; }

  /* bl → primary-left · br → primary-right (compat: UI.create keeps accepting widgets:{bl,br}) */
  _buildWidgets(w) {
    [['bl', 'left'], ['br', 'right']].forEach(([slotName, side]) => {
      const spec = w[slotName];
      if (!spec) return;
      const el = document.createElement('div');
      el.className = 'ui-widget';
      el.id = 'ui-widget-' + slotName;
      el.innerHTML = `
        <div class="ui-widget-frame">${spec.html || ''}</div>
        ${spec.caption ? `<div class="ui-widget-caption" id="ui-widget-${slotName}-cap">${spec.caption}</div>` : ''}`;
      this._dock.addPrimary({ id: slotName, side, node: el });
      if (typeof spec.onMount === 'function') spec.onMount(el, this);
    });
  }

  /* Info panel: bottom sheet on phones (closed by default, opened only by the header ⓘ),
     side panel on desktop. One code path for the ⓘ button, the panel's own toggle and toggleInfo. */
  _setPanelExpanded(on) {
    const { root, toggle } = this._panelEls;
    if (!root) return;
    on = !!on;
    root.classList.toggle('expanded', on);
    if (toggle) toggle.setAttribute('aria-expanded', String(on));
    this._syncSheetScrim();
  }
  _syncSheetScrim() {
    const root = this._panelEls.root;
    const open = !!root && root.classList.contains('expanded') && isPhone(window.innerWidth, window.innerHeight);
    document.body.classList.toggle('al-sheet-open', open);
    if (this._header) this._header.info.setAttribute('aria-pressed', String(!!root && root.classList.contains('expanded')));
  }
  _wirePanelToggle() {
    const { root, head, toggle } = this._panelEls;
    if (!root || !toggle) return;
    const scrim = document.createElement('div');
    scrim.className = 'al-sheet-scrim';
    scrim.addEventListener('click', () => this._setPanelExpanded(false));
    document.body.appendChild(scrim);
    window.addEventListener('resize', () => this._syncSheetScrim());
    toggle.addEventListener('click', e => { e.stopPropagation(); this._setPanelExpanded(!root.classList.contains('expanded')); });
    head.addEventListener('click', e => {
      if (e.target.closest('#panel-toggle')) return;
      if (document.body.classList.contains('embedded')) this._setPanelExpanded(!root.classList.contains('expanded'));
    });
    this._syncSheetScrim();
  }

  /* ---- Public API ---- */
  get panel() {
    const self = this;
    return {
      get root() { return self._panelEls.root; },
      get body() { return self._panelEls.body; },
      expand()  { self._setPanelExpanded(true); },
      collapse(){ self._setPanelExpanded(false); },
      toggle()  { const r = self._panelEls.root; if (r) self._setPanelExpanded(!r.classList.contains('expanded')); },
      get isOpen() { return !!self._panelEls.root?.classList.contains('expanded'); },
      selectTab(id) { self._selectTab(id); },
      remeasure() { if (self._measurePanel) self._measurePanel(); },     /* call after adding content to the panel body */
    };
  }

  /* Phase 7b2: stage canvases. A picture that is not a time series (a spectrum, an advance curve, a torque map) stays a canvas,
     but it lives over the 3D stage (bottom corner, above the dock), never in the dock or the info panel.
       const cv = ui.stage.canvas({ id, label, width, height, corner:'bl'|'br', size })  → the <canvas> (logical size width × height, CSS scales it)
       ui.stage.caption(id, text)   (a changing caption, e.g. the mode name)   ·   ui.stage.remove(id)
     The layer ignores pointer events (orbit controls keep working). Modules draw into the returned canvas as before. */
  get stage() {
    const self = this;
    return {
      canvas({ id, label = '', width = 320, height = 120, corner = 'bl', size = 0 } = {}) {
        if (!self._stageLayer) {
          self._stageLayer = document.createElement('div');
          self._stageLayer.id = 'ui-stage-layer'; self._stageLayer.className = 'ui-stage-layer';
          document.body.appendChild(self._stageLayer);
        }
        const wrap = document.createElement('div');
        wrap.className = 'ui-stage-cv ui-card'; wrap.dataset.corner = corner === 'br' ? 'br' : 'bl';
        if (id) wrap.dataset.stage = id;
        if (size) wrap.style.setProperty('--stage-cv-w', size + 'px');      /* CSS width in px (default 224; never wider than 60 vw) */
        if (label) { const cap = document.createElement('div'); cap.className = 'ui-stage-cap'; cap.textContent = label; wrap.appendChild(cap); }
        const cv = document.createElement('canvas');
        cv.width = width; cv.height = height; cv.style.aspectRatio = width + ' / ' + height;
        cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', label || 'Live chart');
        wrap.appendChild(cv);
        self._stageLayer.appendChild(wrap);
        return cv;
      },
      caption(id, text) { const n = self._stageLayer && self._stageLayer.querySelector('[data-stage="' + id + '"] .ui-stage-cap'); if (n && n.textContent !== text) n.textContent = text; },
      remove(id) { const n = self._stageLayer && self._stageLayer.querySelector('[data-stage="' + id + '"]'); if (n) n.remove(); },
      get root() { return self._stageLayer || null; },
    };
  }

  /* Phase 7a: the Monitor API. set(config) rebuilds the channels; update(patch) writes values (text ≤ 9 Hz, traces ≤ 30 Hz).
       set({ value:{label,unit,max}, rows:[[id,label]], traces:[{id,series:[…]}], gauge, status:true, footer })
       update({ label, value, rows:{id:text|[text,tone]}, rowLabels:{id:text}, footer:html, traces:{id:[v…]|null}, gauge, status:[text,on,tone?] })  — see monitor-core.js */
  get monitor() {
    const self = this, M = () => self._monitor;
    return {
      set(cfg) { if (!M()) self._buildMonitor(cfg); else M().set(cfg); },
      update(p) { if (M()) M().update(p); },
      flush() { if (M()) M().flush(); },
      open(on) { if (M()) M().open(on); },
      get isOpen() { return !!M() && M().isOpen; },
      get root() { return M() ? M().root : null; },
    };
  }

  get toolbar() {
    const self = this;
    return {
      get root() { return self._dock.root; },                 /* the dock is the toolbar now */
      get dock() { return self._dock; },
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
      setSpeed:     v => { if ('speedMul' in state) state.speedMul = clampSpeed(v); },
      setLabels:    v => { if ('showLabels' in state) state.showLabels = !!v; },          /* legacy boolean */
      setLabelDensity: () => {},                                                          /* wrapped below */
      toggleInfo:   () => { self.panel.toggle(); },
      setGas:       v => { if ('showGas'    in state) state.showGas    = !!v; },
      setTheme:     v => { viewManager?.setTheme?.(v); },
      setWireframe: v => { viewManager?.setWireframe?.(!!v); },
      setXRay:      v => { viewManager?.setXRay?.(!!v); },
    };

    /* ─── Auto-wire the toolbar controls the kit itself creates ─── */
    const _play  = document.getElementById('btn-play');
    const _reset = document.getElementById('btn-reset');
    const _lab   = document.getElementById('chk-labels');            /* legacy: not built by the kit any more */
    const _gas   = document.getElementById('chk-gas');               /* Flow toggle, dock options row */

    function _syncPlayIcons() {
      const ip  = document.getElementById('icon-play');
      const ipa = document.getElementById('icon-pause');
      const playing = state.playing !== false;
      if (ip)  ip.style.display  = playing ? 'none'  : 'block';
      if (ipa) ipa.style.display = playing ? 'block' : 'none';
      if (_play) _play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    }
    function _syncControls() {
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
    if (_lab)   _lab.addEventListener('change', () => { state.showLabels = _lab.checked; });

    /* 3-state label density (All → Key → None): the button lives in the ⋯ menu now (shell, or the
       standalone chrome.js menu below). This applies a level to labels.js + the module's own state. */
    let _densLevel = 2;
    function _applyLevel(level) {
      _densLevel = [0, 1, 2].includes(level) ? level : 2;
      setLabelDensity(_densLevel);            /* labels.js keeps the one density; modules with their own labels (cooling) read getLabelDensity() */
      if ('showLabels' in state) state.showLabels = _densLevel > 0;
    }

    /* ─── Keys: the ONE keymap lives in keys.js (R5). ───────────────────────
       Module-owned: Space play/pause · R reset · D label density.
       Shell-owned (L theme · W wireframe · X x-ray · Esc): forwarded to the shell when
       embedded; handled here when standalone (no shell above us). */
    function send(msg) {
      if (!embedded) return;
      try { window.parent.postMessage(Object.assign({ source: 'auto-module', moduleId }, msg), '*'); }
      catch (_) {}
    }
    const SHELL_KEYS = ['theme', 'wireframe', 'xray', 'close'];
    function handleKey(action) {
      if (action === 'togglePlay') {
        dispatch({ action: 'setPlaying', value: !(state.playing !== false) });   /* same path as a shell command */
        send({ type: 'state', playing: state.playing !== false });
      } else if (action === 'reset') {
        if (_reset) _reset.click(); else if (onCommand) onCommand({ action: 'reset' });
      } else if (action === 'labelDensity') {
        const next = nextDensity(getLabelDensity());
        dispatch({ action: 'setLabelDensity', value: next });
        send({ type: 'state', density: next });
      } else if (!embedded) {                               /* standalone owns the shell keys too */
        const vs = viewManager && viewManager.getState ? viewManager.getState() : null;
        if (action === 'theme' && vs)          viewManager.setTheme(vs.theme === 'light' ? 'dark' : 'light');
        else if (action === 'wireframe' && vs) viewManager.setWireframe(!vs.wireframe);
        else if (action === 'xray' && vs)      viewManager.setXRay(!vs.xray);
        else if (action === 'close') {                      /* Esc: close the menu / info sheet first, then leave */
          if (menu && menu.isOpen) menu.close();
          else if (self.panel.isOpen && isPhone(window.innerWidth, window.innerHeight)) self.panel.collapse();
          else if (self._header) self._header.back.click();
        }
        syncMenu();                                         /* D / L / W / X change state from outside the menu */
      }
    }
    const keyRouter = createKeyRouter({
      owns: (a) => !embedded || !SHELL_KEYS.includes(a),
      handle: handleKey,
      forward: (a) => send({ type: 'key', action: a })
    });
    installKeys(window, keyRouter);
    if (_gas)   _gas.addEventListener('change', () => { state.showGas    = _gas.checked; });

    /* Wrap defaultHandlers so incoming shell commands keep the visible
       controls in sync (no drift between shell and module). */
    const wrappedHandlers = {
      ...defaultHandlers,
      setPlaying: v => { defaultHandlers.setPlaying(v); _syncPlayIcons(); },
      setSpeed:   v => { defaultHandlers.setSpeed(v); },
      setLabels:  v => { _applyLevel(v ? 2 : 0);        if (_lab)   _lab.checked = state.showLabels; },  /* legacy boolean; shell now sends setLabelDensity */
      setLabelDensity: v => { _applyLevel(+v); if (_lab) _lab.checked = state.showLabels; },
      setGas:     v => { defaultHandlers.setGas(v);     if (_gas)   _gas.checked = state.showGas; },
    };

    /* One dispatch path for shell commands AND local key actions. */
    function dispatch(d) {
      const h = wrappedHandlers[d.action];
      if (h) h(d.value);
      if (onCommand) onCommand(d);
    }

    /* ─── Standalone ⋯ menu: the MODULE is the owner here (the shell owns it when embedded). ───
       onChange applies speed → state.speedMul, density → labels + state.showLabels,
       theme / wireframe / x-ray → viewManager (which keeps wireframe and x-ray exclusive).
       menu.update() never fires onChange, so syncMenu() is safe to call from anywhere. */
    let menu = null;
    function syncMenu() {
      if (!menu) return;
      const vs = viewManager && viewManager.getState ? viewManager.getState() : { theme: 'dark', wireframe: false, xray: false };
      menu.update({
        speed: state.speedMul,
        density: getLabelDensity(),
        theme: vs.theme, wireframe: vs.wireframe, xray: vs.xray
      });
    }
    if (!embedded) {
      const phone = isPhone(window.innerWidth, window.innerHeight);
      _applyLevel(phone ? 1 : 2);                            /* default label density: Key on phones */
      menu = createMenu({
        doc: document,
        hide: opts.menuHide,                                   /* a 2D page drops the rows it cannot use */
        state: { speed: state.speedMul, density: _densLevel },
        onToggle: (open) => { if (self._header) self._header.setMenuExpanded(open); },
        onChange: (key, v) => {
          if (key === 'speed')          dispatch({ action: 'setSpeed', value: v });
          else if (key === 'density')   dispatch({ action: 'setLabelDensity', value: v });
          else if (key === 'theme')     viewManager?.setTheme?.(v);
          else if (key === 'wireframe') viewManager?.setWireframe?.(!!v);
          else if (key === 'xray')      viewManager?.setXRay?.(!!v);
          syncMenu();
        }
      });
      self._menu = menu;
      syncMenu();
    }

    window.addEventListener('message', (e) => {
      const d = e.data;
      if (!d || d.source !== 'auto-shell') return;
      if (d.moduleId && d.moduleId !== moduleId) return;
      if (d.type !== 'command' && d.type !== 'query') return;
      if (d.action === 'key') { keyRouter.incoming(d.value); return; }   /* key forwarded by the shell */
      dispatch(d);
    });

    return {
      ready() { send({ type: 'ready', menuHide: opts.menuHide || [] }); },
      setStatus(text, color) { send({ type: 'state', status: { text, color } }); },
      /* Modules that change state directly can ask the kit to re-sync. */
      syncControls() { _syncPlayIcons(); _syncControls(); },
    };
  }
}
