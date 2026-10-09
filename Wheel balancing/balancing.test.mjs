// Wheel Balancing tests: node "Wheel balancing/balancing.test.mjs"
import assert from 'node:assert/strict';
import * as M from './balancing-model.js';
let n = 0; const t = (name, fn) => { fn(); n++; };
const near = (a, b, e = 0.01) => assert.ok(Math.abs(a - b) <= e, `${a} vs ${b}`);

t('vector round trip', () => { const v = M.fromVec(M.toVec(30, 120)); near(v.g, 30); near(v.a, 120); });
t('fresh wheel is balanced', () => assert.ok(M.isBalanced(M.makeWheel())));
t('weight goes opposite the heavy spot', () => { const w = M.makeWheel(); w.inner = { g: 20, a: 90 }; const c = M.correction(w); assert.equal(c.inner.g, 20); near(c.inner.a, 270); });
t('fitting the correction balances the wheel', () => { const w = M.applyFault(M.makeWheel(), 'mixed'); assert.ok(!M.isBalanced(w)); M.fitDynamic(w); assert.ok(M.isBalanced(w)); });
t('static weight cures static imbalance only', () => { const w = M.applyFault(M.makeWheel(), 'static'); M.fitStatic(w); assert.ok(M.isBalanced(w)); });
t('opposite spots: zero static, big couple', () => { const w = M.applyFault(M.makeWheel(), 'dynamic'); near(M.staticVec(w).g, 0); assert.ok(M.coupleMoment(w) > 1); });
t('static weight leaves the couple', () => { const w = M.applyFault(M.makeWheel(), 'dynamic'); M.fitStatic(w); assert.ok(M.coupleMoment(w) > 1); });
t('dynamic fix clears the couple', () => { const w = M.applyFault(M.makeWheel(), 'dynamic'); M.fitDynamic(w); assert.ok(M.coupleMoment(w) < 0.5); });
t('vibration rises with imbalance and peaks near the critical band', () => {
  const a = M.applyFault(M.makeWheel(), 'mixed'), b = M.applyFault(M.makeWheel(), 'big');
  assert.ok(M.vibration(b, 100).total > M.vibration(a, 100).total);
  assert.ok(M.vibration(b, 100).total > M.vibration(b, 40).total);
});
t('balanced wheel is smooth', () => assert.equal(M.feel(M.vibration(M.makeWheel(), 100).total), 'Smooth'));
t('wrong diameter typed gives the wrong weight', () => { const w = M.applyFault(M.makeWheel('alloy'), 'static'); assert.notEqual(M.displayedWeight(w, 'inner', 14).g, M.displayedWeight(w, 'inner', 16).g); });
t('turning to the mark puts the weight at 12 o\'clock', () => { const a = 130; near(M.offTop(a, M.rotToTop(a)), 0); });
t('spin-up approaches the target', () => { let r = 0; for (let i = 0; i < 200; i++) r = M.spinStep(r, 100, 0.02); assert.ok(r > 95 && r <= 100); });
t('wheel frequency', () => near(M.wheelHz(100, 310), 14.26, 0.1));
t('pages list', () => assert.deepEqual(M.WB_PAGES.map((p) => p.id), ['scene', 'static', 'dynamic', 'procedure', 'split']));
t('hidden zone is around each spoke', () => { assert.ok(M.isHidden(72)); assert.ok(M.isHidden(78)); assert.ok(!M.isHidden(36)); assert.ok(M.isHidden(358)); });
t('split weights add up (as vectors) to the single weight', () => {
  const [a, b] = M.splitWeight(40, 220, 190, 242), v = M.fromVec([M.toVec(a.g, a.a), M.toVec(b.g, b.a)].reduce((p, q) => [p[0] + q[0], p[1] + q[1]], [0, 0]));
  near(v.g, 40, 0.01); near(v.a, 220, 0.01); assert.ok(a.g + b.g > 40);
});
t('planWeights: single when clear, two when hidden', () => { assert.equal(M.planWeights(30, 36).length, 1); assert.equal(M.planWeights(30, 216).length, 2); assert.equal(M.planWeights(0, 216).length, 0); });


/* ── scene smoke test with a stub three.js (the sandbox is offline; the real one loads from a CDN) ── */
class Vec { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } lerp(v, k) { this.x += (v.x - this.x) * k; this.y += (v.y - this.y) * k; this.z += (v.z - this.z) * k; return this; } }
class Gen {
  constructor(...a) { this.position = new Vec(); this.rotation = new Vec(); this.scale = new Vec(1, 1, 1); this.children = []; this.visible = true; this.userData = {}; this.geometry = a[0] && a[0].dispose ? a[0] : { dispose() {}, rotateZ() {}, rotateY() {} }; }
  rotateZ() {} rotateY() {} rotateX() {} translate() {} add(...c) { this.children.push(...c); } remove(c) { this.children = this.children.filter((x) => x !== c); } traverse(f) { f(this); this.children.forEach((c) => c.traverse && c.traverse(f)); } dispose() {}
}
const THREE_STUB = new Proxy({}, { get: (_, k) => (k === 'Vector3' ? Vec : Gen) });
const ctxStub = new Proxy({}, { get: () => () => {}, set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctxStub }) };
const { buildBalanceScene } = await import('./wb-scene.js');
const P = await import('./wb-page.js');
const mkH = () => ({ THREE: THREE_STUB, root: new Gen(), camera: { position: new Vec() }, orbit: { target: new Vec(), update() {} } });
t('scene: hood up reads ---, hood down spins and reads out the weights', () => {
  const S = P.makeSession('procedure', 'mixed'), sc = buildBalanceScene(mkH(), S);
  let o = sc.update({ t: 0 }); assert.equal(o.ro.inner[0], '---'); assert.equal(S.rpmNow, 0);
  S.hoodGoal = 1; for (let i = 0; i < 300; i++) o = sc.update({ t: (i + 1) / 60 });
  assert.ok(S.rpmNow > 90, 'spun up'); assert.match(o.ro.inner[0], / g @ /); assert.match(o.status[0], /Unbalanced/);
  S.hoodGoal = 0; for (let i = 0; i < 300; i++) o = sc.update({ t: 5 + (i + 1) / 60 }); assert.equal(S.rpmNow, 0, 'opening the hood brakes the wheel');
  sc.dispose();
});
t('procedure: must read first, must turn to the mark, then the weight is fitted and re-spin shows balanced', () => {
  const S = P.makeSession('procedure', 'mixed'), sc = buildBalanceScene(mkH(), S);
  assert.match(P.fitAtTop(S, 'inner'), /Spin the wheel first/);
  S.hoodGoal = 1; let tt = 0; for (let i = 0; i < 300; i++) sc.update({ t: (tt += 1 / 60) });
  S.hoodGoal = 0; for (let i = 0; i < 300; i++) sc.update({ t: (tt += 1 / 60) });
  for (const plane of ['inner', 'outer']) {
    S.rot = 90; assert.match(P.fitAtTop(S, plane), /Turn the wheel/);
    S.rot = M.rotToTop(M.correction(S.wheel)[plane].a); assert.match(P.fitAtTop(S, plane), /fitted/);
  }
  assert.ok(M.isBalanced(S.wheel));
  let o = sc.update({ t: (tt += 1 / 60) }); assert.equal(o.ro.inner[0], '---', 'stale until the next spin');
  S.hoodGoal = 1; for (let i = 0; i < 300; i++) o = sc.update({ t: (tt += 1 / 60) });
  assert.equal(o.big, 'OK'); assert.match(o.status[0], /balanced/); assert.equal(o.ro.feelr[0], 'Smooth');
});
t('procedure: a wrong typed diameter leaves the wheel out of balance', () => {
  const S = P.makeSession('procedure', 'big', 'alloy'); S.typedDia = 13; S.hasSpun = true;
  for (const plane of ['inner', 'outer']) { S.rot = M.rotToTop(M.correction(S.wheel)[plane].a); P.fitAtTop(S, plane); }
  assert.ok(!M.isBalanced(S.wheel));
});
t('hidden page: a spoke-hidden correction is split and the wheel ends up (nearly) balanced', () => {
  const S = P.makeSession('split', 'mixed'), sc = buildBalanceScene(mkH(), S); let tt = 0;
  S.hoodGoal = 1; for (let i = 0; i < 300; i++) sc.update({ t: (tt += 1 / 60) });
  assert.equal(P.hiddenText(S, 'inner'), 'Behind a spoke');
  assert.match(P.fitSplit(S, 'inner'), /split into/); assert.equal(S.wheel.fitted.length, 2);
  P.fitSplit(S, 'outer'); assert.ok(M.residual(S.wheel, 'inner').g < 6, 'inner left ' + M.residual(S.wheel, 'inner').g);
});
console.log(`OK — ${n} balancing test groups`);
