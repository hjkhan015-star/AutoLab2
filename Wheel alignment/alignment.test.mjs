/* Wheel Alignment — Phase 0: pure model, equalizer helpers, spec-bar helpers, registration. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from './alignment-model.js';
import { detentSnap, eqGeometry, eqKeyIntent, fromReal, realValue } from '../controls-core.js';
import { specBar, normalizeRowValue, validateMonitorConfig } from '../monitor-core.js';

const rd = (f) => readFileSync(new URL((/^(wa-|wheel-alignment|alignment-)/.test(f) ? './' : '../') + f, import.meta.url), 'utf8');   /* alignment files live in this folder, the shared ones one level up */
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  ', name); };
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, `${a} vs ${b}`);
const mono = (f, xs) => { for (let i = 1; i < xs.length; i++) assert.ok(f(xs[i]) >= f(xs[i - 1]) - 1e-12, `not monotonic at ${xs[i]}`); };

t('unit conversions: deg ↔ arc-min ↔ mm round-trip', () => {
  near(M.degToArcmin(0.1), 6); near(M.arcminToDeg(6), 0.1);
  near(M.toeMmToDeg(M.toeDegToMm(0.15, 310), 310), 0.15);
  assert.ok(Math.abs(M.toeDegToMm(0.1, 310) - 1.08) < 0.02, '0.1° ≈ 1 mm across a 620 mm tyre');
  near(M.toeDegToMm(-0.2, 310), -M.toeDegToMm(0.2, 310));
});
t('presets: three, each with a spec', () => {
  assert.deepEqual(M.PRESET_IDS, ['hatchback', 'sports', 'suv']);
  for (const id of M.PRESET_IDS) { const p = M.getPreset(id); assert.ok(p.spec.frontToe[0] < p.spec.frontToe[1] && p.tyreRadius > 250 && p.sai > 5); }
  assert.equal(M.getPreset('nope').id, 'hatchback');
});
t('makeState sits mid-spec; derive gives zero thrust and cross values', () => {
  const st = M.makeState('hatchback'), d = M.derive(st);
  near(d.totalToeF, 0.15); near(d.totalToeR, 0.25); near(d.thrust, 0); near(d.crossCamberF, 0); near(d.crossCaster, 0);
  assert.equal(M.specStatus(d.thrust, M.PRESETS.hatchback.spec.thrust), 'ok');
});
t('thrust angle, cross-camber, cross-caster, included angle', () => {
  const st = M.makeState('hatchback'); st.RL.toe = 0.3; st.RR.toe = 0.1;
  near(M.thrustAngle(st), 0.1); near(M.trackingOffsetMm(st, 10000), 10000 * Math.tan(0.1 * Math.PI / 180));
  st.FL.camber = -0.2; st.FR.camber = -0.9; near(M.crossCamber(st), 0.7);
  st.FL.caster = 5; st.FR.caster = 4.2; near(M.crossCaster(st), 0.8);
  near(M.includedAngle(13, -0.5), 12.5); near(M.setback(2600, 2590), 10);
});
t('mechanical trail = R·tan(caster)', () => {
  near(M.mechanicalTrail(310, 0), 0); near(M.mechanicalTrail(310, 4), 310 * Math.tan(4 * Math.PI / 180));
  mono((c) => M.mechanicalTrail(310, c), [-2, 0, 2, 4, 6, 8]);
});
t('specStatus: ok in band, warn within one band-width, crit beyond', () => {
  const r = [0, 0.15];
  assert.equal(M.specStatus(0.1, r), 'ok'); assert.equal(M.specStatus(0.15, r), 'ok');
  assert.equal(M.specStatus(0.25, r), 'warn'); assert.equal(M.specStatus(0.45, r), 'crit'); assert.equal(M.specStatus(-0.4, r), 'crit');
  near(M.specError(0.2, r), 0.05); near(M.specError(-0.1, r), -0.1); near(M.specError(0.1, r), 0);
});
t('wear map and feathering: zero at spec, monotonic at 0, ±limit, ±3× limit', () => {
  const w0 = M.wearMap(0, -0.5); near(w0.inner, 1); near(w0.outer, 1);
  mono((e) => M.wearMap(e, -0.5).inner + M.wearMap(e, -0.5).outer, [0, 0.15, 0.45]);
  mono((e) => M.wearMap(-e, -0.5).inner, [0, 0.15, 0.45]);
  mono((e) => Math.abs(M.feathering(e).value), [0, 0.15, 0.45]);
  assert.ok(M.feathering(0.45).value > 0 && M.feathering(-0.45).value < 0); assert.equal(M.feathering(0).value, 0);
  near(M.oneSidedWear(-0.5).value, 0);
  assert.ok(M.oneSidedWear(1.5).value > 0 && M.oneSidedWear(-2.5).value < 0);
  mono((c) => M.oneSidedWear(c).value, [-3, -1.5, -0.5, 0.5, 1.5, 3]);
  assert.ok(M.wearMap(0, 1.5).outer > M.wearMap(0, 1.5).inner);
});
t('tyre life: 100 % at perfect, monotonic falling, bounded', () => {
  near(M.tyreLifePct(0, 0, 0), 100);
  const f = (e) => -M.tyreLifePct(e, 0, 0); mono(f, [0, 0.15, 0.45, 5]);
  assert.ok(M.tyreLifePct(9, 9, 9) >= 5);
});
t('lateral pull: zero at spec, direction rules, monotonic', () => {
  const st = M.makeState('hatchback'); assert.equal(M.lateralPull(st).value, 0);
  st.FR.camber = st.FL.camber + 1; assert.ok(M.lateralPull(st).value > 0, 'more positive camber on the right pulls right');
  const s2 = M.makeState('hatchback'); s2.FL.caster += 1; assert.ok(M.lateralPull(s2).value > 0, 'less caster on the right pulls right');
  const s3 = M.makeState('hatchback'); s3.RL.toe += 0.2; assert.ok(M.lateralPull(s3).value > 0, 'positive thrust pushes right');
  const pull = (k) => { const s = M.makeState('hatchback'); s.RL.toe += k; return M.lateralPull(s).value; };
  mono(pull, [0, 0.15, 0.45, 1]);
  assert.ok(Math.abs(M.lateralPull(s3).value) < 1); near(M.driftCmPer100m(0.5), 60);
});
t('steering offset: zero when symmetric, sign follows asymmetry', () => {
  const st = M.makeState('hatchback'); assert.equal(M.steeringOffset(st).value, 0);
  st.FL.toe += 0.1; assert.ok(M.steeringOffset(st).value > 0); st.FL.toe -= 0.2; assert.ok(M.steeringOffset(st).value < 0);
});
t('stability vs turn-in, effort, camber gain, fuel penalty', () => {
  mono((x) => M.stabilityTurnIn(x, 4.5).value, [-0.4, 0, 0.15, 0.45, 1]);
  mono((c) => M.steeringEffort(c).value, [0, 2, 4, 8]); assert.ok(M.steeringEffort(8).value <= 1);
  near(M.camberGain(0, 20), 0); assert.ok(M.camberGain(6, 10) > M.camberGain(3, 10) && M.camberGain(4, -10) < 0);
  near(M.fuelPenaltyPct(0, 0), 0); mono((e) => M.fuelPenaltyPct(e, 0), [0, 0.15, 0.45, 2]); assert.ok(M.fuelPenaltyPct(9, 9) <= 2.5);
});
t('self-centring torque: monotonic in caster and steer angle, odd in steer', () => {
  mono((c) => M.selfCentringTorque(310, c, 12, 15), [0, 2, 4, 6, 8]);
  mono((a) => M.selfCentringTorque(310, 4, 12, a), [0, 10, 20, 40]);
  near(M.selfCentringTorque(310, 4, 12, -15), -M.selfCentringTorque(310, 4, 12, 15));
});

/* ── shared widgets ── */
const spec = { min: -0.5, max: 0.5, step: 0.01, decimals: 2, def: 0, detent: 0.01, band: [0, 0.15], tickEvery: 0.05 };
t('equalizer detent: snaps within ±0.01 of 0, not beyond', () => {
  const to = (v) => realValue(detentSnap(fromReal(v, { ...spec, detent: 0 }), spec), spec);
  assert.equal(to(0.01), 0); assert.equal(to(-0.01), 0); assert.equal(to(0.02), 0.02); assert.equal(to(-0.3), -0.3);
  assert.equal(detentSnap(0.7, { ...spec, detent: 0 }), 0.7);
});
t('equalizer geometry: zero mark, spec band, tick count', () => {
  const g = eqGeometry(spec); near(g.zero, 0.5); near(g.band[0], 0.5); near(g.band[1], 0.65); assert.equal(g.ticks, 20);
  assert.equal(eqGeometry({ min: 0, max: 1 }).band, null);
});
t('equalizer keys: Home = centre, Shift+arrow = ten steps, plain arrows native', () => {
  assert.deepEqual(eqKeyIntent({ key: 'Home' }), { to: 'zero' });
  assert.deepEqual(eqKeyIntent({ key: 'ArrowRight', shiftKey: true }), { steps: 10 });
  assert.deepEqual(eqKeyIntent({ key: 'ArrowLeft', shiftKey: true }), { steps: -10 });
  assert.equal(eqKeyIntent({ key: 'ArrowRight' }), null);
});
t('equalizer wiring: look in controls.js, aria and CSS present', () => {
  const js = rd('controls.js'), css = rd('controls.css');
  assert.match(js, /look === 'equalizer'/); assert.match(js, /spec\.ariaLabel \|\| label/); assert.match(js, /aria-valuetext/);
  for (const c of ['.ctl-eq-band', '.ctl-eq-zero', '.ctl-eq-ticks', '.ctl-eq-fill', '.ctl-eq-ends']) assert.ok(css.includes(c), c);
  assert.ok(!/#[0-9a-f]{3,6}\b/i.test(css.slice(css.indexOf("axis look:'equalizer'"))), 'equalizer CSS uses tokens only');
});
t('segmented-spec: geometry, band test, config validation, numeric marker', () => {
  const s = { min: -0.5, max: 0.5, lo: -0.15, hi: 0.15 };
  near(specBar(s, 0).pos, 0.5); near(specBar(s, 0).lo, 0.35); assert.ok(specBar(s, 0.1).inBand && !specBar(s, 0.3).inBand);
  near(specBar(s, 9).pos, 1);
  const ok = validateMonitorConfig({ rows: [['a', 'A', { spec: s }], ['b', 'B']] });
  assert.ok(ok.ok); assert.deepEqual(ok.config.rows[0].spec, s); assert.equal(ok.config.rows[1].spec, undefined);
  assert.ok(!validateMonitorConfig({ rows: [['a', 'A', { spec: { min: 1, max: 0, lo: 0, hi: 0 } }]] }).ok);
  assert.deepEqual(normalizeRowValue(['x', 'ok', 0.2]), { text: 'x', tone: 'ok', num: 0.2 });
  assert.deepEqual(normalizeRowValue(['x', 'ok']), { text: 'x', tone: 'ok' });
});
t('registration: module, page, precache and model are wired', () => {
  assert.match(rd('modules.js'), /"id": "wheel-alignment"[^\n]*"file": "Wheel alignment\/wheel-alignment\.html"/);
  const sw = rd('sw.js'); for (const f of ['wheel-alignment.html', 'alignment-model.js', 'alignment-parts.js', 'alignment-rack.js']) assert.ok(sw.includes(`'./Wheel alignment/${f}'`), f);
  assert.ok(!/from 'three'|document\.|window\./.test(rd('alignment-model.js')), 'model is pure');
});

/* ═══ Phase 1: toe ═══ */
t('toe: individual ↔ total mapping keeps the left/right difference', () => {
  const st = M.makeState('hatchback'); st.FL.toe = 0.2; st.FR.toe = 0.0;
  M.setAxleTotal(st, 'F', 0.5); near(st.FL.toe + st.FR.toe, 0.5); near(st.FL.toe - st.FR.toe, 0.2);
  M.setAxleTotal(st, 'R', 0); near(st.RL.toe, 0); near(st.RR.toe, 0);
  M.setWheelToe(st, 'FR', -0.1); near(st.FR.toe, -0.1);
  M.toeToZero(st); assert.ok(M.CORNERS.every((c) => st[c].toe === 0));
  M.toeToSpec(st); near(M.derive(st).totalToeF, 0.15);
});
t('toe: drawn angle scales only the picture; unit text', () => {
  near(M.drawnAngle(0.1, 8), 0.8); near(M.drawnAngle(0.1, 1), 0.1); near(M.drawnAngle(0.1, 0), 0.1);
  assert.deepEqual(M.EXAGGERATIONS, [1, 4, 8, 20]); assert.equal(M.DEFAULT_EXAGGERATION, 8);
  assert.equal(M.formatToe(0.15, 'deg', 310), '+0.15°'); assert.equal(M.formatToe(-0.1, 'arcmin', 310), '−6′');
  assert.equal(M.formatToe(0.1, 'mm', 310), '+1.1 mm'); assert.equal(M.formatToe(0, 'deg', 310), '+0.00°');
});
t('toe presets and random fault', () => {
  const st = M.makeState('hatchback');
  M.applyToePreset(st, 'in3'); near(M.derive(st).totalToeF, 0.6);
  M.applyToePreset(st, 'out3'); near(M.derive(st).totalToeF, -0.6);
  M.applyToePreset(st, 'worn'); assert.ok(Math.abs(M.steeringOffset(st).value) > 1);
  M.applyToePreset(st, 'perfect'); near(M.derive(st).totalToeF, 0.15);
  let k = 0; const rng = () => [0.9, 0.5, 0.1, 0.5][k++ % 4];
  M.randomToeFault(st, rng); assert.ok(M.CORNERS.every((c) => Math.abs(st[c].toe) <= 0.6));
  assert.deepEqual(M.TOE_PRESETS.map((p) => p.id), ['perfect', 'in3', 'out3', 'worn']);
});
t('toeReport: in spec reads zero everywhere; faults read worse; monotonic in error', () => {
  const r0 = M.toeReport(M.makeState('hatchback'));
  assert.equal(r0.pull.value, 0); assert.equal(r0.steer.value, 0); near(r0.life, 100); near(r0.fuel, 0); assert.equal(r0.stat.F, 'ok');
  assert.ok(M.CORNERS.every((c) => r0.status[c] === 'ok' && r0.feather[c].value === 0));
  const zero = M.toeToZero(M.makeState('hatchback')), rz = M.toeReport(zero);
  near(M.derive(zero).totalToeF, 0); assert.equal(rz.status.FL, 'ok'); near(rz.fuel, M.fuelPenaltyPct(0, 0.1));   /* rear 0° is 0.05° below its band */
  const life = (k) => { const s = M.makeState('hatchback'); M.setAxleTotal(s, 'F', 0.15 + k); return -M.toeReport(s).life; };
  mono(life, [0, 0.15, 0.45, 1]);
  const bad = M.makeState('hatchback'); M.applyToePreset(bad, 'in3'); const rb = M.toeReport(bad);
  assert.ok(rb.life < 100 && rb.fuel > 0 && rb.feather.FL.value > 0 && rb.wear.FL.outer > rb.wear.FL.inner); assert.match(rb.explain, /toe-in/i);
  const out = M.makeState('hatchback'); M.applyToePreset(out, 'out3'); assert.ok(M.toeReport(out).wear.FL.inner > M.toeReport(out).wear.FL.outer);
});

/* ── scene smoke test with a stub three.js: runs build + update, checks the geometry the picture is made of ── */
class Vec { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } lerp(v, k) { this.x += (v.x - this.x) * k; this.y += (v.y - this.y) * k; this.z += (v.z - this.z) * k; return this; } }
class Gen {
  constructor(...a) {
    this.position = new Vec(); this.rotation = new Vec(); this.scale = new Vec(1, 1, 1); this.children = []; this.visible = true;
    this.color = { setHex() {} }; this.emissive = { setHex() {} }; this.userData = {}; this.attributes = {};
    this.geometry = a[0] && a[0].setAttribute ? a[0] : { dispose() {}, attributes: {}, rotateZ() {}, setAttribute() {} };
  }
  setAttribute(k, v) { this.attributes[k] = v; } rotateZ() {} add(...c) { this.children.push(...c); } remove() {} traverse(f) { f(this); this.children.forEach((c) => c.traverse && c.traverse(f)); }
  dispose() {} setDirection() {} setLength() {} translate() {} rotateY() {} rotateX() {} moveTo() {} lineTo() {} absarc() {} closePath() {} clone() { return this; }
}
const THREE_STUB = new Proxy({}, { get: (_, k) => (k === 'Vector3' ? Vec : k === 'BufferAttribute' ? class { constructor(a) { this.array = a; } } : Gen) });
const ctxStub = new Proxy({}, { get: (_, k) => (k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctxStub }) };
const { buildToeScene, paintTread, CAMERAS } = await import('./wa-toe-scene.js');
const mkSession = () => ({ st: M.makeState('hatchback'), exag: 8, unit: 'deg', cam: 'top', ver: 0, flags: { lasers: true, ghost: true, wear: true, tint: true, auto: true } });
const mkH = () => ({ THREE: THREE_STUB, root: new Gen(), camera: { position: new Vec(0, 8, 0) }, orbit: { target: new Vec(), update() {} } });
const linesOf = (root) => root.children[root.children.length - 1].children.filter((c) => c.geometry && c.geometry.attributes.position && c.geometry.attributes.position.array.length === 6);
t('scene: builds, updates at 60 fps steps, returns the monitor payload', () => {
  const S = mkSession(), H = mkH(), sc = buildToeScene(H, S);
  let o; for (let i = 0; i < 120; i++) o = sc.update({ t: i / 60 });
  for (const k of ['toeFL', 'toeFR', 'toeRL', 'toeRR', 'dev', 'life', 'pull', 'steer', 'fuel']) assert.ok(Array.isArray(o.ro[k]), k);
  assert.equal(o.big, '+0.15°'); assert.equal(o.ro.dev[0], 'OK'); assert.equal(o.ro.toeFL.length, 3); assert.match(o.status[0], /in spec/);
  S.unit = 'mm'; S.ver++; o = sc.update({ t: 3 }); assert.match(o.big, /mm$/);
  sc.dispose();
});
t('scene: toe-in lines converge, toe-out lines diverge, spec lines are parallel', () => {
  const S = mkSession(), sc = buildToeScene(mkH(), S), H2 = mkH(); const sc2 = buildToeScene(H2, S);
  S.st.FL.toe = 0.3; S.st.FR.toe = 0.3; S.ver++; sc2.update({ t: 0 });
  const L = linesOf(H2.root), end = (l) => l.geometry.attributes.position.array;
  const fl = end(L[0]), fr = end(L[1]);
  assert.ok(fl[3] < fl[0] && fr[3] > fr[0], 'toe-in: lines point towards the centre');
  near(fl[3] - fl[0], -6 * Math.sin(0.3 * 8 * Math.PI / 180), 1e-4);
  S.st.FL.toe = -0.3; S.st.FR.toe = -0.3; S.ver++; sc2.update({ t: 0.02 });
  assert.ok(fl[3] > fl[0] && fr[3] < fr[0], 'toe-out: lines diverge');
  M.toeToSpec(S.st); S.st.FL.toe = 0; S.st.FR.toe = 0; S.ver++; sc2.update({ t: 0.04 });
  near(fl[3], fl[0]); near(fr[3], fr[0]);
  S.st.RL.toe = 0.3; S.st.RR.toe = 0.1; S.ver++; sc2.update({ t: 0.06 });
  assert.ok(end(L[4])[3] < 0, 'positive thrust leans to the car\'s right (−x)');
  assert.ok(end(L[5])[3] === 0, 'geometric centre line stays straight'); sc.dispose(); sc2.dispose();
});
t('scene: camera presets glide to their target; exaggeration changes the drawing only', () => {
  const S = mkSession(), H = mkH(), sc = buildToeScene(H, S);
  S.cam = 'axle'; for (let i = 0; i < 80; i++) sc.update({ t: i / 60 });
  near(H.camera.position.x, CAMERAS.axle.pos[0], 0.05);
  const a = sc.update({ t: 2 }).big; S.exag = 20; S.ver++; assert.equal(sc.update({ t: 2.02 }).big, a, 'readouts ignore the exaggeration');
});
t('tread painter: draws heat rows and saw teeth; feathering grows the teeth', () => {
  const calls = { fillRect: 0, lineTo: 0, ys: [] };
  const ctx = { fillRect: (x, y) => { calls.fillRect++; }, beginPath() {}, moveTo() {}, lineTo: (x, y) => { calls.lineTo++; calls.ys.push(y); }, closePath() {}, fill() {}, set fillStyle(v) {} };
  paintTread(ctx, 256, 64, { inner: 2, centre: 1, outer: 1 }, 0.5, true);
  assert.equal(calls.fillRect, 64); assert.equal(calls.lineTo, 84);
  const lo = calls.ys.slice(); calls.ys.length = 0; paintTread(ctx, 256, 64, { inner: 1, centre: 1, outer: 1 }, 1, true);
  assert.ok(Math.min(...calls.ys) < Math.min(...lo), 'more feathering = taller teeth');
});
t('toe page wiring: registered, precached, equalizer faders and no duplicate control ids', () => {
  const page = rd('wa-toe.html'), sw = rd('sw.js');
  for (const f of ['wa-toe.html', 'wa-toe-scene.js']) assert.ok(sw.includes(`'./Wheel alignment/${f}'`), f);
  assert.equal((page.match(/look: 'equalizer'/g) || []).length, 1, 'faders are generated once from one spec');
  const ids = [...page.matchAll(/\bid: '([a-zA-Z]+)'/g)].map((m) => m[1]); const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  assert.deepEqual(dup, [], 'no control id twice');
  assert.match(rd('wheel-alignment.html'), /id: 'page'/); assert.match(page, /id: 'page'/);
});

/* ═══ Phase 2: camber ═══ */
t('camber: axle ↔ individual mapping keeps the left/right difference', () => {
  const st = M.makeState('hatchback'); st.FL.camber = -0.2; st.FR.camber = -1.0;
  M.setAxleCamber(st, 'F', -2); near(M.axleCamber(st, 'F'), -2); near(st.FL.camber - st.FR.camber, 0.8);
  M.setWheelCamber(st, 'RL', 0.3); near(st.RL.camber, 0.3);
  M.camberToZero(st); assert.ok(M.CORNERS.every((c) => st[c].camber === 0));
  M.camberToSpec(st); near(st.FL.camber, -0.5); near(st.RL.camber, -1.0);
});
t('camber: tilt about the contact patch', () => {
  near(M.tiltAboutContact(310, 0).dx, 0); near(M.tiltAboutContact(310, 0).dy, 310);
  const a = M.tiltAboutContact(310, 3); near(a.dx, 310 * Math.sin(3 * Math.PI / 180)); near(Math.hypot(a.dx, a.dy), 310);
  near(M.tiltAboutContact(310, -3).dx, -a.dx);
});
t('camber: pressure profile sums to 1, shifts toward the loaded shoulder, even at the optimum', () => {
  for (const c of [-3, -0.5, 0, 2]) near(M.pressureProfile(c).reduce((x, y) => x + y, 0), 1);
  near(M.pressureBias(-0.5).inner, 50);
  mono((c) => -M.pressureBias(c).inner, [-3, -2, -1, -0.5, 0, 1, 3]);
  assert.ok(M.pressureBias(-3).inner > 60 && M.pressureBias(3).inner < 40);
  const p = M.pressureProfile(-3); assert.ok(p[0] > p[8]);
});
t('camber: dynamic camber, roll and grip indices', () => {
  assert.ok(M.dynamicCamber(-1, 3, 'macpherson', true) > -1 && M.dynamicCamber(-1, 3, 'macpherson', false) < -1);
  assert.ok(M.dynamicCamber(-1, 3, 'wishbone', true) < M.dynamicCamber(-1, 3, 'macpherson', true), 'wishbone follows roll less');
  near(M.dynamicCamber(-1, 0, 'wishbone', true), -1); near(M.rollAngle(0, 'wishbone'), 0); assert.ok(M.rollAngle(1, 'macpherson') > M.rollAngle(1, 'wishbone'));
  assert.equal(M.corneringGrip(-1.5), 1); assert.equal(M.brakingGrip(0), 1);
  mono((c) => -M.corneringGrip(c), [-1.5, -1, 0, 1, 3]); mono((c) => -M.corneringGrip(c), [-1.5, -2, -3, -4]); mono((c) => -M.brakingGrip(Math.abs(c)), [0, 1, 2, 3]);
});
t('camberReport: in spec reads clean; presets and faults read worse; monotonic life', () => {
  const r0 = M.camberReport(M.makeState('hatchback'));
  assert.equal(r0.pull.value, 0); near(r0.life, 100); assert.equal(r0.ccStat, 'ok'); assert.ok(M.CORNERS.every((c) => r0.status[c] === 'ok')); assert.match(r0.explain, /in spec/);
  const race = M.applyCamberPreset(M.makeState('hatchback'), 'race'), rr = M.camberReport(race);
  assert.ok(rr.life < 100 && rr.bias.FL.inner > 60 && rr.wear.FL.inner > rr.wear.FL.outer); assert.match(rr.explain, /inner/i);
  const sag = M.camberReport(M.applyCamberPreset(M.makeState('hatchback'), 'sag')); assert.ok(sag.wear.FL.outer > sag.wear.FL.inner && sag.bias.FL.inner < 50);
  const bent = M.camberReport(M.applyCamberPreset(M.makeState('hatchback'), 'bent')); assert.ok(bent.pull.value > 0 && Math.abs(bent.drift) > 0, 'right wheel more positive: pulls right');
  const life = (k) => { const s2 = M.makeState('hatchback'); M.setAxleCamber(s2, 'F', -0.5 + k); return -M.camberReport(s2).life; };
  mono(life, [0, 0.5, 1, 2, 3]);
  let k2 = 0; const f = M.randomCamberFault(M.makeState('hatchback'), () => [0.9, 0.5, 0.1, 0.5][k2++ % 4]); assert.ok(M.CORNERS.every((c) => Math.abs(f[c].camber) <= M.CAMBER_LIMIT));
  assert.deepEqual(M.CAMBER_PRESETS.map((x) => x.id), ['spec', 'race', 'sag', 'bent']);
});
const { buildCamberScene, paintFootprint, CAMBER_CAMERAS } = await import('./wa-camber-scene.js');
const mkCam = () => ({ st: M.makeState('hatchback'), exag: 8, cam: 'front', ver: 0, flags: { plumb: true, heat: true, wear: true, tint: true, turn: false } });
t('camber scene: wheels pivot about the contact patch and tilt the right way', () => {
  const S = mkCam(), H = mkH(), sc = buildCamberScene(H, S);
  const rig = H.root.children[H.root.children.length - 1], ln = () => rig.children.filter((c) => c.geometry && c.geometry.attributes.position && c.geometry.attributes.position.array.length === 6);
  M.setAxleCamber(S.st, 'F', -2); S.ver++; const o = sc.update({ t: 0 });
  const L = ln(), arr = (i) => L[i].geometry.attributes.position.array;       /* order: plumb FL, plane FL, plumb FR, plane FR … */
  assert.ok(arr(1)[3] < arr(1)[0], 'left wheel, negative camber: top leans toward the car (−x)'); assert.ok(arr(3)[3] > arr(3)[0], 'right wheel: top leans toward +x');
  near(arr(0)[3], arr(0)[0]); near(arr(1)[0], arr(0)[0], 1e-9);                 /* both lines start at the contact patch */
  assert.equal(o.big, '−2.00°'); assert.equal(o.ro.camFL.length, 3); assert.ok(Array.isArray(o.ro.grip));
  S.exag = 20; S.ver++; assert.equal(sc.update({ t: 0.02 }).big, '−2.00°', 'readouts ignore the exaggeration');
  M.setAxleCamber(S.st, 'F', 0); S.ver++; sc.update({ t: 0.04 }); near(arr(1)[3], arr(1)[0]);
  sc.dispose();
});
t('camber scene: load transfer rolls the body and changes camber over time; cameras glide', () => {
  const S = mkCam(), H = mkH(), sc = buildCamberScene(H, S); S.flags.turn = true; S.cam = 'close';
  for (let i = 0; i < 200; i++) { sc.update({ t: i / 60 }); }
  const rig = H.root.children[H.root.children.length - 1]; assert.ok(rig.children.length > 8);
  near(H.camera.position.x, CAMBER_CAMERAS.close.pos[0], 0.1); sc.dispose();
});
t('footprint painter: one column per pixel; page wiring', () => {
  let n2 = 0; paintFootprint({ fillRect: () => { n2++; }, set fillStyle(v) {} }, 128, 8, M.pressureProfile(-2), true); assert.equal(n2, 128);
  const page = rd('wa-camber.html'), sw = rd('sw.js');
  for (const f of ['wa-camber.html', 'wa-camber-scene.js']) assert.ok(sw.includes(`'./Wheel alignment/${f}'`), f);
  assert.equal((page.match(/look: 'equalizer'/g) || []).length, 1);
  const ids = [...page.matchAll(/\bid: '([a-zA-Z]+)'/g)].map((m) => m[1]); assert.deepEqual(ids.filter((x, i) => ids.indexOf(x) !== i), []);
});

/* ═══ Phase 3: caster ═══ */
t('caster: trail, presets, setters, steering-ratio round trip', () => {
  const st = M.makeState('hatchback'); M.applyCasterPreset(st, 'mismatch'); near(M.crossCaster(st), 1.8);
  M.applyCasterPreset(st, 'low'); near(st.FL.caster, 1); M.applyCasterPreset(st, 'spec'); near(st.FR.caster, 4);
  M.setCaster(st, 'L', 20); near(st.FL.caster, M.CASTER_MAX); M.setCaster(st, 'R', -9); near(st.FR.caster, M.CASTER_MIN);
  near(M.derive(M.applyCasterPreset(M.makeState('hatchback'), 'spec')).trailL, 310 * Math.tan(4 * Math.PI / 180));
  assert.ok(M.mechanicalTrail(310, -2) < 0, 'negative caster gives negative trail');
  near(M.steerFromDial(M.dialFromSteer(12)), 12); near(M.steerFromDial(-140), 10, 1e-9); assert.equal(M.steerFromDial(0), 0);
  assert.deepEqual(M.CASTER_PRESETS.map((x) => x.id), ['spec', 'low', 'mismatch']);
});
t('caster: camber gain sign (outside negative, inside positive) and magnitude', () => {
  const g = M.camberGainWheel(4, 10, 'L'); near(g, 4 * Math.sin(10 * Math.PI / 180));
  assert.ok(M.camberGainWheel(4, 10, 'L') > 0 && M.camberGainWheel(4, 10, 'R') < 0, 'left turn: left wheel is inside (+), right wheel outside (−)');
  assert.ok(M.camberGainWheel(4, -10, 'L') < 0 && M.camberGainWheel(4, -10, 'R') > 0, 'right turn mirrors it');
  near(M.camberGainWheel(0, 20, 'L'), 0); near(M.camberGainWheel(4, 0, 'R'), 0);
  assert.ok(Math.abs(M.camberGainWheel(8, 10, 'L')) > Math.abs(M.camberGainWheel(4, 10, 'L')));
  mono((a) => M.camberGainWheel(4, a, 'L'), [0, 5, 10, 20, 30]);
});
t('caster swing method recovers the caster', () => {
  for (const c of [0, 2, 4, 6, 8]) near(M.casterFromSwing(M.swingDelta(c)), c, 1e-9);
  assert.ok(M.swingDelta(6) > M.swingDelta(3));
});
t('caster: restoring torque monotonic; release settles faster with more caster', () => {
  const T = (c) => M.selfCentringTorque(310, c, 12, 10); mono(T, [0, 1, 2, 4, 8]); assert.ok(T(8) < 4 * T(4) + 1);
  const p = (c) => ({ tyreRadius: 310, casterDeg: c, scrub: 12 });
  let s = { theta: 15, omega: 0 }, prev = 15;
  for (let i = 0; i < 400; i++) { s = M.releaseStep(s, 0.005, p(4)); if (i > 20) assert.ok(Math.abs(s.theta) <= Math.abs(prev) + 1.5, 'no wild oscillation'); prev = s.theta; }
  assert.ok(Math.abs(s.theta) < 1, 'returns to centre');
  assert.ok(M.settleTime(p(6)) < M.settleTime(p(2)), 'more caster settles sooner'); assert.ok(M.settleTime(p(4), -15) > 0);
  assert.ok(M.settleTime(p(4), 5) <= M.settleTime(p(4), 25) + 0.5);
});
t('casterReport: spec reads clean; mismatch pulls toward the LOWER caster; low caster is light', () => {
  const r0 = M.casterReport(M.applyCasterPreset(M.makeState('hatchback'), 'spec'));
  assert.equal(r0.status.L, 'ok'); assert.equal(r0.ccStat, 'ok'); assert.equal(r0.pull.value, 0); assert.ok(r0.atRef && r0.torque > 0); near(r0.swingCaster, 4);
  const mm = M.casterReport(M.applyCasterPreset(M.makeState('hatchback'), 'mismatch'));
  assert.ok(mm.pull.value > 0 && mm.drift > 0, 'left 5°, right 3.2°: less caster on the right pulls right'); assert.equal(mm.ccStat, 'crit'); assert.match(mm.explain, /less caster/);
  const mr = M.applyCasterPreset(M.makeState('hatchback'), 'mismatch'); [mr.FL.caster, mr.FR.caster] = [3.2, 5]; assert.ok(M.casterReport(mr).pull.value < 0, 'mirrored mismatch pulls left');
  const low = M.casterReport(M.applyCasterPreset(M.makeState('hatchback'), 'low')); assert.ok(low.effort.value < r0.effort.value && low.torque < r0.torque); assert.match(low.explain, /Low caster/);
  assert.ok(M.casterReport(M.makeState('hatchback'), 12).atRef === false);
  mono((k) => M.casterReport(((x) => { M.setCaster(x, 'L', 2 + k); M.setCaster(x, 'R', 2 + k); return x; })(M.makeState('hatchback'))).torque, [0, 1, 2, 4, 6]);
});
const { buildCasterScene, CASTER_CAMERAS } = await import('./wa-caster-scene.js');
const mkCas = () => { const S = { st: M.makeState('hatchback'), exag: 2, cam: 'side', ver: 0, steer: 0, mode: null, rel: { theta: 0, omega: 0 }, flags: { axis: true, trail: true, drive: false, swing: false }, pushed: [] }; S.pushSteer = (d) => S.pushed.push(d); return S; };
t('caster scene: steering axis tilts rearward at the top; trail follows the angle', () => {
  const S = mkCas(), H = mkH(), sc = buildCasterScene(H, S); M.applyCasterPreset(S.st, 'spec'); S.ver++; const o = sc.update({ t: 0 });
  const rig = H.root.children[H.root.children.length - 1], ln = rig.children.filter((c) => c.geometry && c.geometry.attributes.position && c.geometry.attributes.position.array.length === 6);
  const a = ln[0].geometry.attributes.position.array;                       /* left axis: [ground x,y,z, top x,y,z] */
  assert.ok(a[5] < a[2], 'top is further back (−z) than the ground intercept: positive caster'); near(a[4], 0.31 + 0.55, 0.3); near(a[0], a[3]);
  const k = Math.tan(4 * 2 * Math.PI / 180); near(a[2] - 1.3, 0.31 * k, 1e-3);
  assert.equal(o.big, '+4.0°'); assert.equal(o.ro.casL.length, 3); assert.match(o.ro.swing[0], /→/);
  S.exag = 3; S.ver++; assert.equal(sc.update({ t: 0.02 }).big, '+4.0°', 'readouts ignore the exaggeration');
  M.setCaster(S.st, 'L', 0); S.ver++; sc.update({ t: 0.04 }); near(a[2], a[5] + 0.55 * 0 + 0, 1e-6);
  sc.dispose();
});
t('caster scene: hands-off release returns to zero and drives the dial; swing demo sweeps ±20°; pull drifts the car the right way', () => {
  const S = mkCas(), H = mkH(), sc = buildCasterScene(H, S);
  S.steer = 15; S.rel = { theta: 15, omega: 0 }; S.mode = 'release'; let t0 = 0; for (let i = 0; i < 600 && S.mode; i++) { t0 += 1 / 60; sc.update({ t: t0 }); }
  assert.equal(S.mode, null, 'release finished'); assert.equal(S.steer, 0); assert.ok(S.pushed.length > 5 && S.pushed.some((d) => d > 1) && S.pushed.at(-1) === 0);
  S.pushed.length = 0; S.flags.swing = true; let hi = -99, lo = 99; for (let i = 0; i < 300; i++) { sc.update({ t: 10 + i / 60 }); hi = Math.max(hi, S.steer); lo = Math.min(lo, S.steer); }
  assert.ok(hi > 19 && lo < -19 && hi <= 20.001, 'sweeps ±20°');
  S.flags.swing = false; S.steer = 0; M.applyCasterPreset(S.st, 'mismatch'); S.flags.drive = true; S.ver++;
  for (let i = 0; i < 120; i++) sc.update({ t: 20 + i / 60 });
  const rig = H.root.children[H.root.children.length - 1]; assert.ok(rig.position.x < 0, 'pull to the right moves the car to −x (its right)');
  S.cam = 'front'; for (let i = 0; i < 90; i++) sc.update({ t: 30 + i / 60 }); near(H.camera.position.z, CASTER_CAMERAS.front.pos[2], 0.2); sc.dispose();
});
t('caster page wiring: dial steering, equalizer per side, registered', () => {
  const page = rd('wa-caster.html'), sw = rd('sw.js');
  for (const f of ['wa-caster.html', 'wa-caster-scene.js']) assert.ok(sw.includes(`'./Wheel alignment/${f}'`), f);
  assert.equal((page.match(/look: 'equalizer'/g) || []).length, 1); assert.match(page, /type: 'dial', look: 'wheel'/);
  const ids = [...page.matchAll(/\bid: '([a-zA-Z]+)'/g)].map((m) => m[1]); assert.deepEqual(ids.filter((x, i) => ids.indexOf(x) !== i), []);
  assert.deepEqual(M.WA_PAGES.map((x) => x.id), ['scene', 'toe', 'camber', 'caster']);
});
t('toe scene: auto-drive moves a right-pulling car to its right (−x), a left-pulling one to +x', () => {
  for (const [toe, sign] of [[0.5, -1], [-0.5, 1]]) {
    const S = mkSession(), H = mkH(), sc = buildToeScene(H, S); S.st.RL.toe = 0.2 + toe; S.st.RR.toe = 0.2 - toe; S.ver++;
    for (let i = 0; i < 120; i++) sc.update({ t: i / 60 });
    assert.ok(H.root.children[H.root.children.length - 1].position.x * sign > 0, `toe ${toe}`); sc.dispose();
  }
});
console.log(`${n} alignment tests passed`);
