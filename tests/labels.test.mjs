const mk = () => { const e = { style: { setProperty(){} }, dataset: {}, children: [], classList: { add(){}, remove(){} }, _a: {},
  setAttribute(k, v) { this._a[k] = v; }, getAttribute(k) { return this._a[k]; },
  append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; },
  insertBefore(c) { this.children.push(c); }, remove(){}, querySelector() { return { textContent: '' }; },
  getBoundingClientRect() { return { width: 80, height: 22 }; }, clientWidth: 800, clientHeight: 600 }; return e; };
const root = mk();
let rafQ = [];
globalThis.window = globalThis;
globalThis.document = { getElementById: () => root, body: root, createElement: mk, createElementNS: mk };
root.querySelector = () => null;
globalThis.innerWidth = 800; globalThis.innerHeight = 600;
globalThis.requestAnimationFrame = (f) => { rafQ.push(f); return rafQ.length; };
let T = 0; globalThis.performance = { now: () => T };
const { createLabelSystem } = await import(new URL('../labels.js', import.meta.url).href);
class V { constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;} project(cam){ return this; } }
const L = createLabelSystem();
L.add('a', 'Radiator', 1); L.add('b', 'Water pump', 1); L.add('c', 'Hose', 2);
const wrap = { clientWidth: 800, clientHeight: 600 };
const pos = (id) => { const r = L.labels.get(id); return [r.x, r.y]; };
const frame = (ax) => { T += 16;
  // fake camera: project() returns NDC directly from world coords
  [['a', ax, 0.1], ['b', ax + 0.02, 0.1], ['c', -0.3, -0.2]].forEach(([id, x, y]) => L.project(id, new V(x, y, 0.5), {}, wrap));
  const q = rafQ; rafQ = []; q.forEach(f => f(T)); };
for (let i = 0; i < 30; i++) frame(0.2);
// 1. still model, jittering sub-pixel noise -> label must not move
const still = []; for (let i = 0; i < 120; i++) { frame(0.2 + (i % 2 ? 0.0004 : -0.0004)); still.push(pos('a')); }
const jitter = Math.max(...still.map(p => Math.abs(p[0] - still[0][0])), ...still.map(p => Math.abs(p[1] - still[0][1])));
console.log('still-model jitter (px):', jitter.toFixed(3));
// 2. moving anchor: label delta must equal anchor delta (rigid, no lag)
const a0 = L.labels.get('a').ax, p0 = pos('a')[0];
for (let i = 0; i < 20; i++) frame(0.2 + i * 0.002);
const r = L.labels.get('a'); const dA = r.ax - a0, dL = pos('a')[0] - p0;
console.log('anchor moved', dA.toFixed(1), 'px; label moved', dL.toFixed(1), 'px; lag', (dA - dL).toFixed(2));

if (jitter > 0.5 || Math.abs(dA - dL) > 0.5) { console.error('FAIL labels wobble'); process.exit(1); }
console.log('labels OK');
