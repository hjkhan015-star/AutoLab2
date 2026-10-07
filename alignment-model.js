/* ═══════════════════════════════════════════════════════════════════════
   alignment-model.js — pure wheel-alignment maths (no DOM, no three.js).
   Conventions: toe in degrees, + = toe-in; camber in degrees, − = top of the wheel leans in;
   caster in degrees, + = steering axis tilted rearward at the top. Lengths in millimetres unless named otherwise.
   Corners: FL, FR, RL, RR. Left/right difference = left − right.
   ═══════════════════════════════════════════════════════════════════════ */

export const CORNERS = ['FL', 'FR', 'RL', 'RR'];
const RAD = Math.PI / 180;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const round = (v, d = 2) => { const f = 10 ** d; const r = Math.round(v * f) / f; return r === 0 ? 0 : r; };

/* ── unit conversions ───────────────────────────────────────────────── */
export const degToArcmin = (deg) => deg * 60;
export const arcminToDeg = (am) => am / 60;
/** Toe angle (deg) of ONE wheel -> linear toe in mm measured across the tyre diameter (what a toe gauge reads for that wheel). */
export const toeDegToMm = (deg, tyreRadiusMm) => 2 * tyreRadiusMm * Math.tan(deg * RAD);
export const toeMmToDeg = (mm, tyreRadiusMm) => Math.atan(mm / (2 * tyreRadiusMm)) / RAD;

/* ── vehicle presets (illustrative, editable) ───────────────────────── */
const BASE_SPEC = {
  frontToe: [0.0, 0.15], rearToe: [0.05, 0.2],
  frontCamber: [-1.0, 0.0], rearCamber: [-1.5, -0.5],
  caster: [3, 6], maxCamberDiff: 0.5, maxCasterDiff: 0.5, thrust: [-0.15, 0.15]
};
export const PRESETS = {
  hatchback: { id: 'hatchback', label: 'Family hatchback (FWD)', drive: 'FWD', wheelbase: 2600, trackF: 1530, trackR: 1510, tyreRadius: 310, tyreWidth: 205, scrubRadius: 12, sai: 13, suspension: 'macpherson', spec: { ...BASE_SPEC } },
  sports:    { id: 'sports',    label: 'Sports sedan (RWD)',    drive: 'RWD', wheelbase: 2850, trackF: 1560, trackR: 1580, tyreRadius: 330, tyreWidth: 245, scrubRadius: 8,  sai: 12, suspension: 'wishbone',   spec: { ...BASE_SPEC, frontCamber: [-1.5, -0.5], rearCamber: [-2.0, -1.0], caster: [5, 8] } },
  suv:       { id: 'suv',       label: 'SUV / pickup',          drive: 'AWD', wheelbase: 2900, trackF: 1620, trackR: 1630, tyreRadius: 380, tyreWidth: 265, scrubRadius: 15, sai: 12, suspension: 'wishbone',   spec: { ...BASE_SPEC, frontCamber: [-0.5, 0.5], rearCamber: [-0.8, 0.2], caster: [2, 5] } }
};
export const PRESET_IDS = Object.keys(PRESETS);
export const getPreset = (id) => PRESETS[id] || PRESETS.hatchback;

/* ── state ──────────────────────────────────────────────────────────── */
export function specMid(range) { return (range[0] + range[1]) / 2; }
/** A car exactly at the middle of its spec bands. */
export function makeState(presetId = 'hatchback') {
  const p = getPreset(presetId), s = p.spec;
  const c = (toe, camber, caster) => ({ toe, camber, caster, rideHeight: 0 });
  const ft = specMid(s.frontToe), rt = specMid(s.rearToe), fc = specMid(s.frontCamber), rc = specMid(s.rearCamber), ca = specMid(s.caster);
  return { preset: p.id, FL: c(ft, fc, ca), FR: c(ft, fc, ca), RL: c(rt, rc, 0), RR: c(rt, rc, 0) };
}
export function cloneState(st) { return { preset: st.preset, FL: { ...st.FL }, FR: { ...st.FR }, RL: { ...st.RL }, RR: { ...st.RR } }; }

/* ── derived values ─────────────────────────────────────────────────── */
export const totalToe = (st, axle) => (axle === 'F' ? st.FL.toe + st.FR.toe : st.RL.toe + st.RR.toe);
/** Thrust angle (deg): direction the rear axle pushes, + = pushes the car to the right of the geometric centre line (the right wheel is toed in less than the left). */
export const thrustAngle = (st) => (st.RL.toe - st.RR.toe) / 2;
export const crossCamber = (st, axle = 'F') => (axle === 'F' ? st.FL.camber - st.FR.camber : st.RL.camber - st.RR.camber);
export const crossCaster = (st) => st.FL.caster - st.FR.caster;
export const includedAngle = (sai, camber) => sai + camber;
/** Mechanical trail in mm: R · tan(caster). */
export const mechanicalTrail = (tyreRadiusMm, casterDeg) => tyreRadiusMm * Math.tan(casterDeg * RAD);
/** Setback (mm): how far one front wheel sits behind the other, from the left/right wheelbase difference. */
export const setback = (wbLeft, wbRight) => wbLeft - wbRight;
/** Tracking: lateral offset (mm) of the rear axle centre-line from the geometric centre line after `distanceMm` of travel. */
export const trackingOffsetMm = (st, distanceMm) => distanceMm * Math.tan(thrustAngle(st) * RAD);
export function derive(st) {
  const p = getPreset(st.preset);
  return {
    totalToeF: totalToe(st, 'F'), totalToeR: totalToe(st, 'R'),
    totalToeFmm: toeDegToMm(totalToe(st, 'F'), p.tyreRadius), totalToeRmm: toeDegToMm(totalToe(st, 'R'), p.tyreRadius),
    thrust: thrustAngle(st), crossCamberF: crossCamber(st, 'F'), crossCamberR: crossCamber(st, 'R'), crossCaster: crossCaster(st),
    includedL: includedAngle(p.sai, st.FL.camber), includedR: includedAngle(p.sai, st.FR.camber),
    trailL: mechanicalTrail(p.tyreRadius, st.FL.caster), trailR: mechanicalTrail(p.tyreRadius, st.FR.caster), scrub: p.scrubRadius
  };
}

/* ── spec check ─────────────────────────────────────────────────────── */
/** 'ok' inside the band, 'warn' within one band-width outside it, else 'crit'. */
export function specStatus(value, range) {
  const [lo, hi] = range, w = Math.max(hi - lo, 0.05);
  if (value >= lo - 1e-9 && value <= hi + 1e-9) return 'ok';
  const out = value < lo ? lo - value : value - hi;
  return out <= w ? 'warn' : 'crit';
}
/** Signed distance outside the band (0 inside). */
export const specError = (value, range) => (value < range[0] ? value - range[0] : value > range[1] ? value - range[1] : 0);

/* ── effects engine ─────────────────────────────────────────────────────
   Every effect returns { value, text }: value is normalised −1…+1 (or a physical value where stated),
   text is a short human-readable explanation. All curves are smooth and monotonic in |input|:  sat(x) = tanh(x). */
const sat = (x) => Math.tanh(x);
const WEAR_SCALE_TOE = 0.45;     /* deg of toe error that gives tanh(1) of the maximum feathering */
const WEAR_SCALE_CAMBER = 1.5;   /* deg of camber away from the optimum that gives tanh(1) of one-sided wear */

/** Tread wear rate across the width: inner / centre / outer, each >= 0, 1 = nominal even wear. Toe error wears both shoulders; camber shifts wear to one side. */
export function wearMap(toeErrDeg, camberDeg, optimumCamber = -0.5) {
  const toe = Math.abs(toeErrDeg) / WEAR_SCALE_TOE, camErr = (camberDeg - optimumCamber) / WEAR_SCALE_CAMBER;
  const inner = 1 + 1.6 * toe * (toeErrDeg < 0 ? 1.0 : 0.6) + 1.8 * Math.max(0, -camErr);
  const outer = 1 + 1.6 * toe * (toeErrDeg > 0 ? 1.0 : 0.6) + 1.8 * Math.max(0, camErr);
  const centre = Math.max(0.2, 1 - 0.1 * toe);
  return { inner, centre, outer };
}
/** Feathering (saw-tooth) severity 0…1 from toe error; the sign says which way the ribs are sharp (+ = toe-in error). */
export function feathering(toeErrDeg) {
  const v = sat(Math.abs(toeErrDeg) / WEAR_SCALE_TOE) * Math.sign(toeErrDeg);
  const a = Math.abs(v);
  return { value: v, text: a < 0.05 ? 'No feathering: toe is within spec.' : `${a < 0.4 ? 'Light' : a < 0.75 ? 'Moderate' : 'Heavy'} feathering — ${v > 0 ? 'too much toe-in scrubs the outer shoulders' : 'too much toe-out scrubs the inner shoulders'}.` };
}
/** One-sided wear −1 (inner) … +1 (outer) from camber relative to the optimum. */
export function oneSidedWear(camberDeg, optimumCamber = -0.5) {
  const v = sat((camberDeg - optimumCamber) / WEAR_SCALE_CAMBER);
  const a = Math.abs(v);
  return { value: v, text: a < 0.05 ? 'Even wear across the tread.' : `Wear shifts to the ${v > 0 ? 'outer' : 'inner'} shoulder (${v > 0 ? 'positive' : 'too much negative'} camber).` };
}
/** Tyre life remaining, % relative to a perfectly aligned car (1 axle pair). Monotonic in |error|. */
export function tyreLifePct(toeErrFrontDeg, toeErrRearDeg, camberErrDeg = 0) {
  const load = Math.abs(toeErrFrontDeg) / WEAR_SCALE_TOE + Math.abs(toeErrRearDeg) / WEAR_SCALE_TOE + Math.abs(camberErrDeg) / WEAR_SCALE_CAMBER;
  return clamp(100 / (1 + 1.2 * load), 5, 100);
}
/** Lateral pull −1 (left) … +1 (right) from cross-camber, cross-caster and thrust angle. Positive thrust pushes right; the car also pulls toward the side with more positive camber and LESS caster. */
export function lateralPull(st) {
  const raw = -crossCamber(st, 'F') * 0.6 + crossCaster(st) * 0.5 + thrustAngle(st) * 3;   /* each term ≈ 0.3–0.45 at its spec limit */
  const v = sat(raw);
  const a = Math.abs(v);
  return { value: v, text: a < 0.05 ? 'Tracks straight.' : `Pulls ${v > 0 ? 'right' : 'left'} (${a < 0.4 ? 'slightly' : a < 0.75 ? 'noticeably' : 'strongly'}).` };
}
/** Drift in cm per 100 m (positive = to the right) from the normalised pull. */
export const driftCmPer100m = (pull) => pull * 120;
/** Steering-wheel off-centre in degrees (+ = wheel turned clockwise to drive straight): toe asymmetry on the front axle. */
export function steeringOffset(st) {
  const asym = st.FL.toe - st.FR.toe;           /* left more toe-in than right: rack sits right of centre when tracking straight */
  const deg = asym * 2 * 14;                    /* steering ratio ~14:1, asymmetry = 2 × individual offset */
  return { value: deg, text: Math.abs(deg) < 0.5 ? 'Steering wheel is centred.' : `Steering wheel sits ${Math.abs(deg).toFixed(1)}° ${deg > 0 ? 'clockwise' : 'anticlockwise'} when driving straight.` };
}
/** Stability vs turn-in response: −1 = darty / sharp turn-in (toe-out, low caster) … +1 = very stable / lazy turn-in. */
export function stabilityTurnIn(totalToeFrontDeg, casterAvgDeg) {
  const v = sat(totalToeFrontDeg / 0.4 * 0.6 + (casterAvgDeg - 4.5) / 3 * 0.4);
  return { value: v, text: v > 0.2 ? 'Stable on the straight, slower to turn in.' : v < -0.2 ? 'Darty on the straight, eager to turn in.' : 'Balanced stability and turn-in.' };
}
/** Self-centring torque (N·m) at a steer angle: ∝ (mechanical trail + scrub-based term) · sin(steer). Monotonic in caster for 0 < steer < 90°. */
export function selfCentringTorque(tyreRadiusMm, casterDeg, scrubMm, steerDeg, loadN = 4000) {
  const trailM = (mechanicalTrail(tyreRadiusMm, casterDeg) + Math.abs(scrubMm) * 0.5) / 1000;
  return loadN * 0.25 * trailM * Math.sin(Math.abs(steerDeg) * RAD) * Math.sign(steerDeg);
}
/** Steering effort index 0…1 rising with caster (0 deg ≈ 0.15, 8 deg ≈ 0.9). */
export function steeringEffort(casterDeg) {
  const v = clamp(0.15 + 0.75 * sat(Math.max(0, casterDeg) / 6) / sat(8 / 6), 0, 1);
  return { value: v, text: v > 0.7 ? 'Heavy steering, strong self-centring.' : v < 0.35 ? 'Light, vague steering.' : 'Moderate steering effort.' };
}
/** Camber gain (deg) at a steer angle: caster tilts the wheel top; the outside wheel gains negative camber. Small-angle form: Δcamber = caster · sin(steer), sign by steer direction (+ steer = left turn: left wheel camber −, right wheel camber +). */
export function camberGain(casterDeg, steerDeg) {
  return casterDeg * Math.sin(steerDeg * RAD);
}
/** Rolling-resistance / fuel penalty in % from toe error of both axles (indicative). */
export function fuelPenaltyPct(totalToeErrFrontDeg, totalToeErrRearDeg) {
  const e = (Math.abs(totalToeErrFrontDeg) + Math.abs(totalToeErrRearDeg)) / 0.3;
  return clamp(2.5 * sat(e), 0, 2.5);
}

/* ── Phase 1: toe ───────────────────────────────────────────────────── */
export const EXAGGERATIONS = [1, 4, 8, 20];
export const DEFAULT_EXAGGERATION = 8;
export const TOE_SNAP = 0.01;                              /* deg: the fader's centre detent */
export const WA_PAGES = [
  { id: 'scene', label: 'Overview', file: 'wheel-alignment.html' },
  { id: 'toe', label: 'Toe', file: 'wa-toe.html' }
];
/** Angle that is DRAWN (deg). Only the picture is exaggerated, never a readout. */
export const drawnAngle = (deg, exaggeration) => deg * (exaggeration > 0 ? exaggeration : 1);
/** Set the axle's total toe, keeping the current left/right difference. */
export function setAxleTotal(st, axle, total) {
  const [l, r] = axle === 'F' ? ['FL', 'FR'] : ['RL', 'RR'], d = st[l].toe - st[r].toe;
  st[l].toe = total / 2 + d / 2; st[r].toe = total / 2 - d / 2; return st;
}
export function setWheelToe(st, corner, deg) { st[corner].toe = deg; return st; }
/** Reset every toe value to the middle of the preset's spec bands. */
export function toeToSpec(st) {
  const m = makeState(st.preset);
  CORNERS.forEach((c) => { st[c].toe = m[c].toe; });
  return st;
}
export function toeToZero(st) { CORNERS.forEach((c) => { st[c].toe = 0; }); return st; }
export const TOE_PRESETS = [
  { id: 'perfect', label: 'Perfect' }, { id: 'in3', label: 'Toe-in 0.3°' }, { id: 'out3', label: 'Toe-out 0.3°' }, { id: 'worn', label: 'Worn tie-rod' }
];
/** Front-axle practice presets (rear stays as it is). */
export function applyToePreset(st, id) {
  const m = makeState(st.preset);
  if (id === 'perfect') { st.FL.toe = m.FL.toe; st.FR.toe = m.FR.toe; st.RL.toe = m.RL.toe; st.RR.toe = m.RR.toe; }
  else if (id === 'in3') { st.FL.toe = 0.3; st.FR.toe = 0.3; }
  else if (id === 'out3') { st.FL.toe = -0.3; st.FR.toe = -0.3; }
  else if (id === 'worn') { st.FL.toe = 0.4; st.FR.toe = -0.05; }
  return st;
}
/** A practice fault: each toe moves by a random amount of 0.15–0.45° (either way). rng() must return 0…1. */
export function randomToeFault(st, rng = Math.random) {
  CORNERS.forEach((c) => { const sign = rng() < 0.5 ? -1 : 1; st[c].toe = clamp(st[c].toe + sign * (0.15 + 0.3 * rng()), -0.6, 0.6); });
  return st;
}
/** Toe as text in deg, mm (one wheel, across the tyre) or arc-minutes. */
export function formatToe(deg, unit, tyreRadiusMm) {
  const sg = (v, d) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
  if (unit === 'mm') return sg(toeDegToMm(deg, tyreRadiusMm), 1) + ' mm';
  if (unit === 'arcmin') return sg(degToArcmin(deg), 0) + '′';
  return sg(deg, 2) + '°';
}
/** Everything the toe page shows, from the state. Effects use the error outside each wheel's spec band, so a car in spec reads 0. */
export function toeReport(st) {
  const p = getPreset(st.preset), s = p.spec, d = derive(st);
  const err = (c) => specError(st[c].toe, c[0] === 'F' ? s.frontToe : s.rearToe);
  const ef = (err('FL') + err('FR')) / 2, er = (err('RL') + err('RR')) / 2;
  const feather = { FL: feathering(err('FL')), FR: feathering(err('FR')), RL: feathering(err('RL')), RR: feathering(err('RR')) };
  const wear = {}; CORNERS.forEach((c) => { wear[c] = wearMap(err(c), (c[0] === 'F' ? s.frontCamber : s.rearCamber).reduce((a, b) => a + b) / 2); });
  const pull = lateralPull(st), steer = steeringOffset(st), fuel = fuelPenaltyPct(Math.abs(err('FL')) + Math.abs(err('FR')), Math.abs(err('RL')) + Math.abs(err('RR')));
  const status = {}; CORNERS.forEach((c) => { status[c] = specStatus(st[c].toe, c[0] === 'F' ? s.frontToe : s.rearToe); });
  const stat = { F: specStatus(d.totalToeF, [s.frontToe[0] * 2, s.frontToe[1] * 2]), R: specStatus(d.totalToeR, [s.rearToe[0] * 2, s.rearToe[1] * 2]) };
  const life = tyreLifePct(ef, er, 0);
  return { d, err, feather, wear, pull, drift: driftCmPer100m(pull.value), steer, fuel, life, status, stat, explain: explainToe(st, ef, er, pull, steer) };
}
/** One-line "what is happening" sentence. */
export function explainToe(st, ef, er, pull, steer) {
  const parts = [];
  if (Math.abs(ef) < 0.005 && Math.abs(er) < 0.005) parts.push('Toe is in spec: the tyres roll straight and wear evenly.');
  else {
    if (Math.abs(ef) >= 0.005) parts.push(ef > 0 ? 'Front toe-in is too large: tyres scrub their outer edges and turn-in feels lazy.' : 'Front toe is too far out: inner edges scrub and the car feels darty.');
    if (Math.abs(er) >= 0.005) parts.push(er > 0 ? 'Rear toe-in is high: extra drag and a stable but heavy feel.' : 'Rear toe is too low: the tail feels loose.');
  }
  if (Math.abs(pull.value) >= 0.05) parts.push(pull.text);
  if (Math.abs(steer.value) >= 0.5) parts.push(steer.text);
  return parts.join(' ');
}
