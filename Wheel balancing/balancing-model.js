/* balancing-model.js — pure physics for the Wheel Balancing pages (no DOM, no three.js).
   Units: grams, millimetres, degrees, rpm. Angles are measured clockwise from 12 o'clock looking at the outer face.
   A wheel carries two heavy spots, one per correction plane (inner / outer). */
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const wrap = (a) => ((a % 360) + 360) % 360;
export const RAD = Math.PI / 180;

/* the DL-65 style machine: weights are shown in 5 g steps, "OK" below the threshold */
export const MACHINE = { name: 'MANATEC DL-65 Premium', stepG: 5, okG: 5, balanceRpm: 100, maxRpm: 200 };

export const WHEELS = {
  steel: { label: 'Steel 15 in', diaIn: 15, widthIn: 6.0, offsetMm: 120, tyreKg: 9.5, planeGapMm: 130 },
  alloy: { label: 'Alloy 16 in', diaIn: 16, widthIn: 6.5, offsetMm: 130, tyreKg: 10.5, planeGapMm: 150 },
  suv:   { label: 'SUV 17 in',   diaIn: 17, widthIn: 7.5, offsetMm: 150, tyreKg: 14.0, planeGapMm: 175 }
};
export const WHEEL_IDS = Object.keys(WHEELS);
export const getWheel = (id) => WHEELS[id] || WHEELS.alloy;

/** Fresh wheel: a heavy spot on each plane. */
export const makeWheel = (id = 'alloy') => ({ id, inner: { g: 0, a: 0 }, outer: { g: 0, a: 0 }, fitted: [] });

/* ── vectors ── */
export const toVec = (g, a) => [g * Math.sin(a * RAD), g * Math.cos(a * RAD)];                 /* x right, y up (12 o'clock) */
export const fromVec = ([x, y]) => ({ g: Math.hypot(x, y), a: wrap(Math.atan2(x, y) / RAD) });
const add = (u, v) => [u[0] + v[0], u[1] + v[1]];

/** Residual heavy spot of a plane after the clip-on weights are counted (a weight stuck at angle A cancels a heavy spot at A − 180). */
export function residual(wheel, plane) {
  let v = toVec(wheel[plane].g, wheel[plane].a);
  for (const w of wheel.fitted) if (w.plane === plane) v = add(v, toVec(w.g, w.a));
  return fromVec(v);
}
/** Static imbalance = both planes summed (what one single-plane weight could fix). */
export function staticVec(wheel) { return fromVec(add(toVec(...Object.values(residual(wheel, 'inner'))), toVec(...Object.values(residual(wheel, 'outer'))))); }
/** Dynamic (couple) imbalance = moment of the two spots about the middle: ½·gap·(outer − inner). */
export function coupleVec(wheel) {
  const i = residual(wheel, 'inner'), o = residual(wheel, 'outer');
  const v = add(toVec(o.g, o.a), toVec(-i.g, i.a));
  return fromVec(v);
}
export const coupleMoment = (wheel) => coupleVec(wheel).g / 2 * getWheel(wheel.id).planeGapMm / 1000;      /* g·m */

/** Correction the machine asks for: stick-on weight on each plane, opposite the heavy spot. Rounded to the display step. */
export function correction(wheel) {
  const out = {};
  for (const p of ['inner', 'outer']) {
    const r = residual(wheel, p), g = r.g < MACHINE.okG ? 0 : Math.round(r.g / MACHINE.stepG) * MACHINE.stepG;
    out[p] = { g, a: wrap(r.a + 180), raw: r.g };
  }
  return out;
}
export const isBalanced = (wheel) => ['inner', 'outer'].every((p) => residual(wheel, p).g < MACHINE.okG);

/** Add / remove a clip-on or stick-on weight. */
export function addWeight(wheel, plane, g, a) { wheel.fitted.push({ plane, g, a: wrap(a) }); return wheel; }
export const clearWeights = (wheel) => { wheel.fitted.length = 0; return wheel; };

/* ── vibration felt at the steering wheel / seat ── */
export const SPEEDS_KMH = [40, 60, 80, 100, 120];
const CRIT_KMH = 95;                                                                          /* the classic 80–110 km/h "wheel shimmy" band */
/** Wheel rotation frequency (Hz) for a given speed and tyre radius (mm). */
export const wheelHz = (kmh, tyreRadiusMm) => (kmh / 3.6) / (2 * Math.PI * tyreRadiusMm / 1000);
/** Vibration 0…100: static part (hop) + couple part (shimmy). Both rise with speed² and peak near the resonance. */
export function vibration(wheel, kmh, tyreRadiusMm = 310) {
  const f = (kmh / CRIT_KMH), res = 1 / (1 + 6 * (f - 1) * (f - 1)), s = f * f * (0.35 + 0.65 * res);
  const hop = staticVec(wheel).g / 25 * s * 100 / 4, shimmy = coupleMoment(wheel) / 8 * s * 100;
  return { hop: clamp(hop, 0, 100), shimmy: clamp(shimmy, 0, 100), total: clamp(hop + shimmy, 0, 100) };
}
export const feel = (v) => (v < 6 ? 'Smooth' : v < 20 ? 'Faint' : v < 45 ? 'Noticeable' : 'Strong shake');
export const tone = (v) => (v < 6 ? 'ok' : v < 20 ? 'warn' : 'crit');

/* ── practice presets / faults ── */
export const FAULTS = [
  { id: 'none', label: 'Balanced', make: () => [[0, 0], [0, 0]] },
  { id: 'static', label: 'Static: one heavy spot', make: () => [[20, 90], [20, 90]] },
  { id: 'dynamic', label: 'Dynamic: opposite spots', make: () => [[25, 0], [25, 180]] },
  { id: 'mixed', label: 'Mixed (real world)', make: () => [[30, 40], [15, 250]] },
  { id: 'big', label: 'Large (worn tyre, mud)', make: () => [[45, 130], [35, 300]] }
];
export function applyFault(wheel, id) {
  const f = FAULTS.find((x) => x.id === id) || FAULTS[0], [i, o] = f.make();
  wheel.inner = { g: i[0], a: i[1] }; wheel.outer = { g: o[0], a: o[1] }; clearWeights(wheel); return wheel;
}
export function randomFault(wheel, rng = Math.random) {
  wheel.inner = { g: 10 + Math.round(rng() * 25), a: Math.round(rng() * 359) }; wheel.outer = { g: 10 + Math.round(rng() * 25), a: Math.round(rng() * 359) };
  return clearWeights(wheel);
}

/* ── the balancing procedure (Phase 3) ── */
export const STEPS = ['Clean wheel, remove old weights', 'Mount on shaft, centre with cone, tighten nut', 'Enter width, diameter and offset', 'Lower the hood to spin', 'Read the two weights', 'Turn wheel to the 12 o\'clock mark, fit weight', 'Spin again to check'];
/** Spin-up: speed rises with a first-order lag toward the target. */
export const spinStep = (rpm, target, dt) => rpm + (target - rpm) * (1 - Math.exp(-dt * 2.2));
/** Rim-weight offset used by the machine: dimensions typed in correct the readout when wrong. 5 mm of diameter error ≈ this much weight error. */
export const dimensionError = (typedDiaIn, wheel) => Math.abs(typedDiaIn - getWheel(wheel.id).diaIn);
export function displayedWeight(wheel, plane, typedDiaIn) {
  const c = correction(wheel)[plane], k = getWheel(wheel.id).diaIn / typedDiaIn;
  const g = c.raw < MACHINE.okG ? 0 : Math.round(c.raw * k / MACHINE.stepG) * MACHINE.stepG;
  return { g, a: c.a };
}

/* ── pages ── */
export const WB_PAGES = [
  { id: 'scene', label: 'Overview', file: 'wheel-balancing.html' },
  { id: 'static', label: 'Static', file: 'wb-static.html' },
  { id: 'dynamic', label: 'Dynamic', file: 'wb-dynamic.html' },
  { id: 'procedure', label: 'Procedure', file: 'wb-procedure.html' },
  { id: 'split', label: 'Hidden', file: 'wb-split.html' }
];
/** Single-plane (static) weight: one weight at the middle of the wheel, opposite the combined heavy spot; split over both planes. */
export function fitStatic(wheel) {
  const s = staticVec(wheel); if (s.g < MACHINE.okG) return wheel;
  const half = Math.round(s.g / 2 / MACHINE.stepG) * MACHINE.stepG; if (half <= 0) return wheel;
  addWeight(wheel, 'inner', half, wrap(s.a + 180)); addWeight(wheel, 'outer', half, wrap(s.a + 180)); return wheel;
}
/** Dynamic balance: the two-plane correction the machine reads out. */
export function fitDynamic(wheel) {
  const c = correction(wheel);
  for (const p of ['inner', 'outer']) if (c[p].g > 0) addWeight(wheel, p, c[p].g, c[p].a);
  return wheel;
}
/** Wheel rotation (deg cw) that brings a weight at wheel-angle `a` to 12 o'clock. */
export const rotToTop = (a) => wrap(-a);
/** How far (deg, signed) a wheel-angle sits from 12 o'clock at the given wheel rotation. */
export const offTop = (a, rot) => { const d = wrap(a + rot); return d > 180 ? d - 360 : d; };

/* ── Phase 4: hidden weight (split behind a spoke) ── */
export const SPOKES = 5, SPOKE_STEP = 360 / SPOKES, HIDDEN_HALF_WIDTH = 12, SPLIT_OFFSET = 26;     /* deg */
/** Nearest spoke angle (deg cw) and the signed distance to it. */
export function nearestSpoke(a) { const k = Math.round(wrap(a) / SPOKE_STEP), s = wrap(k * SPOKE_STEP); let d = wrap(a) - s; if (d > 180) d -= 360; if (d < -180) d += 360; return { spoke: s, d }; }
export const isHidden = (a) => Math.abs(nearestSpoke(a).d) < HIDDEN_HALF_WIDTH;
/** Split weight g at angle a into two weights at b1 and b2 whose vector sum equals the original (sine rule). */
export function splitWeight(g, a, b1, b2) {
  const s = Math.sin((b2 - b1) * RAD);
  return [{ g: g * Math.sin((b2 - a) * RAD) / s, a: wrap(b1) }, { g: g * Math.sin((a - b1) * RAD) / s, a: wrap(b2) }];
}
/** Weights to stick for one plane: one weight, or two either side of the spoke when the spot is hidden. Rounded to the display step. */
export function planWeights(g, a) {
  if (g <= 0) return [];
  if (!isHidden(a)) return [{ g, a: wrap(a) }];
  const { spoke } = nearestSpoke(a), b1 = spoke - SPLIT_OFFSET, b2 = spoke + SPLIT_OFFSET, rel = (x) => { let d = wrap(x) - spoke; return d > 180 ? d - 360 : d; };
  const [w1, w2] = splitWeight(g, spoke + rel(a), b1, b2);
  return [w1, w2].map((w) => ({ g: Math.max(MACHINE.stepG, Math.round(w.g / MACHINE.stepG) * MACHINE.stepG), a: w.a }));
}
