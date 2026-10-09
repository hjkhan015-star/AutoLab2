/* wb-page.js — page glue shared by the Wheel Balancing pages: session, common controls / options / Monitor rows.
   Controls are plain specs for the shared control system (no hand-built DOM). */
import { makeWheel, applyFault, randomFault, clearWeights, fitStatic, fitDynamic, addWeight, displayedWeight, planWeights, isHidden, correction, offTop, WHEELS, WHEEL_IDS, FAULTS, WB_PAGES, wrap } from './balancing-model.js';

export function makeSession(page, fault = 'mixed', wheelId = 'alloy') {
  const S = { wheel: makeWheel(wheelId), page, hood: 0, hoodGoal: 0, target: 100, rot: 0, rpmNow: 0, hasSpun: false, showSpots: true, cam: 'front', typedDia: WHEELS[wheelId].diaIn, kmh: 100, ver: 0, msg: '' };
  S.fault = fault; applyFault(S.wheel, fault); return S;
}
const bump = (S) => { S.ver++; };

/** Rows for the Monitor (id, label). Pages pick the ones they need. */
export const ROWS = {
  inner: ['inner', 'Inner weight (read-out)'], outer: ['outer', 'Outer weight (read-out)'], stat: ['stat', 'Static imbalance'], couple: ['couple', 'Couple (dynamic) moment'],
  hop: ['hopv', 'Hop (static) vibration'], shim: ['shim', 'Shimmy (couple) vibration'], rpm: ['rpm', 'Spindle speed'], feel: ['feelr', 'Feel at the wheel'],
  hI: ['heavyI', 'True heavy spot, inner'], hO: ['heavyO', 'True heavy spot, outer']
};

let lastDial = 0;
/** Common controls: hand-turn crank and road speed. */
export function commonCtls(S) {
  return [
    { id: 'turn', type: 'dial', look: 'crank', label: 'Turn wheel by hand', ariaLabel: 'Rotate the wheel on the shaft', range: 360, wrap: true, def: 0, step: 1,
      onChange: (deg) => { const d = ((deg - lastDial + 540) % 360) - 180; lastDial = deg; if (S.rpmNow === 0) S.rot = wrap(S.rot + d); } },
    { id: 'kmh', type: 'axis', look: 'slider', label: 'Road speed (vibration test)', min: 40, max: 120, step: 5, def: 100, unit: 'km/h', decimals: 0, onChange: (v) => { S.kmh = v; } }
  ];
}

/** Common dock options. `extra` options go before the page switcher. */
export function commonOptions(S, pageId, extra = []) {
  return [
    { id: 'hood', type: 'toggle', label: 'Lower hood (auto-spin)', def: false, onChange: (on) => { S.hoodGoal = on ? 1 : 0; } },
    { id: 'wheel', type: 'choice', layout: 'segmented', label: 'Wheel', def: S.wheel.id,
      onChange: (id) => { S.wheel.id = id; S.typedDia = WHEELS[id].diaIn; clearWeights(S.wheel); bump(S); },
      options: WHEEL_IDS.map((id) => ({ id, label: WHEELS[id].label })) },
    { id: 'fault', type: 'choice', layout: 'select', label: 'Imbalance', def: S.fault || 'mixed', onChange: (id) => { applyFault(S.wheel, id); bump(S); },
      options: FAULTS.map((f) => ({ id: f.id, label: f.label })) },
    { id: 'rand', type: 'action', label: 'Randomise imbalance', onAction: () => { randomFault(S.wheel); bump(S); } },
    { id: 'spots', type: 'toggle', label: 'Show true heavy spots', def: true, onChange: (on) => { S.showSpots = on; } },
    { id: 'cam', type: 'choice', layout: 'segmented', label: 'Camera', def: 'front', onChange: (id) => { S.cam = id; },
      options: [{ id: 'front', label: 'Front' }, { id: 'side', label: 'Side' }, { id: 'top', label: 'Top' }, { id: 'orbit', label: 'Orbit' }] },
    ...extra,
    { id: 'page', type: 'choice', layout: 'segmented', label: 'Page', def: pageId,
      onChange: (id) => { const pg = WB_PAGES.find((x) => x.id === id); if (pg && !location.pathname.endsWith(pg.file)) location.href = pg.file; },
      options: WB_PAGES.map((x) => ({ id: x.id, label: x.label })) }
  ];
}

export const actStatic = (S) => ({ id: 'fitStatic', type: 'action', label: 'Fit one static weight', onAction: () => { fitStatic(S.wheel); bump(S); } });
export const actDynamic = (S) => ({ id: 'fitDyn', type: 'action', label: 'Auto-balance (both planes)', onAction: () => { fitDynamic(S.wheel); bump(S); } });
export const actClear = (S) => ({ id: 'clr', type: 'action', label: 'Remove fitted weights', tone: 'crit', onAction: () => { clearWeights(S.wheel); bump(S); } });

/** Procedure step: stick a weight on `plane` at 12 o'clock. Returns a message. Fails (honestly) if the wheel is not turned to the mark or has not been read yet. */
export function fitAtTop(S, plane) {
  if (!S.hasSpun) return 'Spin the wheel first: no read-out yet';
  const c = correction(S.wheel)[plane], disp = displayedWeight(S.wheel, plane, S.typedDia);
  if (disp.g <= 0) return plane + ' plane already OK';
  if (Math.abs(offTop(c.a, S.rot)) > 6) return 'Turn the wheel until the mark is at 12 o\'clock';
  addWeight(S.wheel, plane, disp.g, c.a); bump(S); return disp.g + ' g fitted on the ' + plane + ' plane. Spin again to check.';
}

/** Phase 4: fit the plane's correction at its true angle; if that is behind a spoke, split it either side. */
export function fitSplit(S, plane) {
  if (!S.hasSpun) return 'Spin the wheel first: no read-out yet';
  const c = correction(S.wheel)[plane], disp = displayedWeight(S.wheel, plane, S.typedDia);
  if (disp.g <= 0) return plane + ' plane already OK';
  const list = planWeights(disp.g, c.a); list.forEach((w) => addWeight(S.wheel, plane, w.g, w.a)); bump(S);
  return list.length === 2 ? 'Behind a spoke: split into ' + list[0].g.toFixed(0) + ' g + ' + list[1].g.toFixed(0) + ' g. Spin again.' : disp.g + ' g fitted. Spin again to check.';
}
export const hiddenText = (S, plane) => { const a = correction(S.wheel)[plane].a; return isHidden(a) ? 'Behind a spoke' : 'Clear of spokes'; };
