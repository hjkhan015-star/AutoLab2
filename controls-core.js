/* ═══════════════════════════════════════════════════════════════════════
   controls-core.js — pure control logic. NO DOM, NO window, NO Three.js.
   Unit-tested with plain node (tests/controls.test.mjs).

   Conventions
   - axis     : normalised 0..1
   - dial     : normalised -1..1 (positive = clockwise = right turn) for a clamped
                wheel / knob (spec.range = total sweep in degrees, ±range/2);
                0..1 for a wrapping crank (spec.wrap = true, 0..range degrees)
   - Modules map normalised values to real units with a preset or
     min/max + format(). Values live in the registry, never in the DOM.
   ═══════════════════════════════════════════════════════════════════════ */

/* ── math helpers ─────────────────────────────────────────────────────── */
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** value in [min,max] -> 0..1 (clamped). Degenerate range -> 0. */
export function normalize(value, min, max) {
  if (!(max > min) || !Number.isFinite(value)) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}
/** 0..1 -> value in [min,max] (input clamped). */
export function denormalize(n, min, max) {
  return min + clamp(Number.isFinite(n) ? n : 0, 0, 1) * (max - min);
}
/** value in [-half,+half] -> -1..1 (clamped). For dials. */
export function normalizeSigned(value, half) {
  if (!(half > 0) || !Number.isFinite(value)) return 0;
  return clamp(value / half, -1, 1);
}
/** -1..1 -> value in [-half,+half]. */
export function denormalizeSigned(n, half) {
  return clamp(Number.isFinite(n) ? n : 0, -1, 1) * half;
}

/* ── presets ──────────────────────────────────────────────────────────── */
/* min/max/def are in DISPLAY units. `scale` converts a display value to the
   legacy raw unit an old module used (voltage: volts -> centivolts), so a
   module can migrate without changing its internals: raw = value * scale. */
export const PRESETS = Object.freeze({
  rpm:            Object.freeze({ min: 800,  max: 5000, def: 1800, step: 50,  unit: 'rpm',  decimals: 0, label: 'Engine speed', scale: 1 }),
  load:           Object.freeze({ min: 0,    max: 100,  def: 0,    step: 1,   unit: '%',    decimals: 0, label: 'Load',         scale: 1 }),
  ambient:        Object.freeze({ min: -10,  max: 45,   def: 20,   step: 1,   unit: '°C',   decimals: 0, label: 'Ambient',      scale: 1 }),
  'vehicle-speed':Object.freeze({ min: 0,    max: 160,  def: 0,    step: 1,   unit: 'km/h', decimals: 0, label: 'Vehicle speed',scale: 1 }),
  voltage:        Object.freeze({ min: 8,    max: 15,   def: 13.5, step: 0.1, unit: 'V',    decimals: 1, label: 'Voltage',      scale: 100 }),
  percent:        Object.freeze({ min: 0,    max: 100,  def: 0,    step: 1,   unit: '%',    decimals: 0, label: 'Value',        scale: 1 })
});

export function getPreset(name) {
  const p = PRESETS[name];
  if (!p) throw new Error(`controls-core: unknown preset "${name}"`);
  return p;
}
/** Resolve a control spec: preset defaults overridden by explicit fields. */
export function resolveSpec(spec) {
  const base = spec && spec.preset ? getPreset(spec.preset) : {};
  return Object.assign({}, base, spec);
}
/** Default normalised value of a spec (axis). */
export function defaultNormalized(spec) {
  const s = resolveSpec(spec);
  if (isDial(s)) return dialDefault(s);
  if (isChoice(s)) return choiceDefault(s);
  if (isToggle(s)) return toggleDefault(s);
  if (typeof s.min === 'number' && typeof s.max === 'number') {
    return normalize(typeof s.def === 'number' ? s.def : s.min, s.min, s.max);
  }
  return 0;
}

/* ── axis value mapping (display units <-> normalised, with step snapping) ──
   The registry stores normalised 0..1. The real value is min + idx*step, so
   1.00 stays 1.00 (no float creep) and `scale` gives the legacy raw unit. */
export function roundTo(v, decimals = 0) {
  if (!Number.isFinite(v)) return v;
  const f = Math.pow(10, decimals);
  const r = Math.round(v * f) / f;
  return r === 0 ? 0 : r;                                   /* no -0 */
}
/** Number of steps between min and max (>= 1). */
export function stepCount(spec) {
  const s = resolveSpec(spec);
  const step = s.step > 0 ? s.step : (s.max - s.min) / 100;
  return Math.max(1, Math.round((s.max - s.min) / step));
}
/** Snap a normalised value to the nearest step. */
export function snapNormalized(n, spec) {
  if (isDial(spec)) return snapDial(n, spec);
  if (isChoice(spec)) return clampChoice(n, spec.options.length);
  if (isToggle(spec)) return toggleValue(n);
  const c = stepCount(spec);
  return clamp(Math.round(clamp(Number.isFinite(n) ? n : 0, 0, 1) * c), 0, c) / c;
}
/** normalised -> real value in display units (step-snapped, decimals-rounded). */
export function realValue(n, spec) {
  const s = resolveSpec(spec);
  if (isDial(s)) return dialRealValue(n, s);
  if (isChoice(s)) return choiceId(n, s.options);            /* the option id */
  if (isToggle(s)) return !!n;                               /* boolean */
  const c = stepCount(s);
  const idx = clamp(Math.round(clamp(Number.isFinite(n) ? n : 0, 0, 1) * c), 0, c);
  const step = (s.max - s.min) / c;
  return roundTo(s.min + idx * step, s.decimals ?? 0);
}
/** normalised -> legacy raw units (display value * scale), e.g. volts -> centivolts. */
export function rawValue(n, spec) {
  const s = resolveSpec(spec);
  if (isChoice(s)) return clampChoice(n, s.options.length);     /* raw = the index */
  if (isToggle(s)) return toggleValue(n);                        /* raw = 0 | 1 */
  return roundTo(realValue(n, s) * (s.scale ?? 1), 6);
}
/** real value (display units) -> normalised, step-snapped. */
export function fromReal(value, spec) {
  const s = resolveSpec(spec);
  if (isDial(s)) return snapDial(degToDial(value, s), s);
  if (isChoice(s)) { const i = choiceIndex(value, s.options); return i < 0 ? choiceDefault(s) : i; }
  if (isToggle(s)) return toggleValue(value);
  return snapNormalized(normalize(value, s.min, s.max), s);
}

/* ── formatting ───────────────────────────────────────────────────────── */
/** Format a real value: format(13.5,{unit:'V',decimals:1}) -> "13.5 V" */
export function format(value, opts = {}) {
  const { unit = '', decimals = 0, space = true } = opts;
  if (!Number.isFinite(value)) return '—';
  let txt = value.toFixed(decimals);
  if (/^-0(\.0*)?$/.test(txt)) txt = txt.slice(1);          /* no "-0" */
  if (!unit) return txt;
  return unit === '%' || unit === '°' ? txt + unit : txt + (space ? ' ' : '') + unit;
}
/** Text for aria-valuetext of an axis (with unit). */
export function axisValueText(n, spec) {
  const s = resolveSpec(spec);
  const v = denormalize(n, s.min ?? 0, s.max ?? 1);
  return format(v, s);
}
/** Text for aria-valuetext of a dial: "12° right", "8° left", "centre"; a wrapping crank reads "123°". */
export function dialValueText(n, spec) {
  const s = resolveSpec(spec);
  if (s.wrap) return `${Math.round(dialToDeg(n, s))}°`;
  const half = (s.range ?? 360) / 2;
  const deg = Math.round(denormalizeSigned(n, half));
  if (deg === 0) return 'centre';
  return `${Math.abs(deg)}° ${deg > 0 ? 'right' : 'left'}`;
}

/* ── dial maths (Phase 5) — pure, degrees, 0° = up, clockwise positive ────
   Two flavours share one spec { type:'dial', range, wrap, def, step, spring, k }:
   - clamped (wheel / knob): registry −1..1, degrees = n · range/2, clamped at ±range/2
   - wrapping (crank)      : registry  0..1, degrees = n · range,   wraps at range      */
export const isDial = (spec) => !!spec && (spec.type === 'dial' || spec.kind === 'dial');
export const dialRange = (spec) => (spec && spec.range > 0 ? spec.range : DEFAULT_DIAL_RANGE);
export const dialWraps = (spec) => !!(spec && spec.wrap);
/** lowest registry value of a dial (−1 for a clamped wheel, 0 for a wrapping crank) */
export const dialMin = (spec) => (dialWraps(spec) ? 0 : -1);

/** wrap degrees into [0, range) — no -0, tolerant of huge values */
export function wrapDeg(deg, range = DEFAULT_DIAL_RANGE) {
  if (!Number.isFinite(deg) || !(range > 0)) return 0;
  const r = ((deg % range) + range) % range;
  return r === 0 ? 0 : r;
}
/** Shortest signed difference next − prev on a circle of `period` degrees, in (−period/2, +period/2].
    Drag across ±180° (pointer angles, period 360) and across the 720° crank seam (period 720). */
export function unwrapDelta(prev, next, period = 360) {
  if (!Number.isFinite(prev) || !Number.isFinite(next) || !(period > 0)) return 0;
  let d = (next - prev) % period;
  const half = period / 2;
  if (d > half) d -= period;
  else if (d <= -half) d += period;
  return d === 0 ? 0 : d;
}
/** Pointer angle around a centre: 0° = up, clockwise positive, result in (−180, 180]. */
export function angleFromPointer(cx, cy, x, y) {
  const dx = x - cx, dy = y - cy;
  if (dx === 0 && dy === 0) return 0;
  const a = Math.atan2(dx, -dy) * 180 / Math.PI;      /* screen y grows downwards */
  return a === -180 ? 180 : (a === 0 ? 0 : a);
}
/** registry value -> degrees (clockwise positive; crank 0..range) */
export function dialToDeg(n, spec) {
  const s = resolveSpec(spec);
  const r = dialRange(s);
  const v = clamp(Number.isFinite(n) ? n : 0, dialMin(s), 1);
  return v * (dialWraps(s) ? r : r / 2);
}
/** degrees -> registry value (clamped wheel: clamped at ±range/2; crank: wrapped into 0..range) */
export function degToDial(deg, spec) {
  const s = resolveSpec(spec);
  const r = dialRange(s);
  if (!Number.isFinite(deg)) return dialDefault(s);
  if (dialWraps(s)) return wrapDeg(deg, r) / r;
  return clamp(deg / (r / 2), -1, 1);
}
/** the spec's default (spec.def, in degrees) as a registry value */
export function dialDefault(spec) {
  const s = spec || {};
  return degToDial(typeof s.def === 'number' ? s.def : 0, s);
}
/** snap a registry value to the spec's degree step (default 1°) */
export function snapDial(n, spec) {
  const s = resolveSpec(spec);
  const step = s.step > 0 ? s.step : 1;
  const deg = Math.round(dialToDeg(n, s) / step) * step;
  const v = degToDial(deg, s);
  return dialWraps(s) ? v : clamp(v, -1, 1);
}
/** registry value -> real value for controls.value(): degrees, step-snapped (clockwise positive) */
export function dialRealValue(n, spec) {
  const s = resolveSpec(spec);
  const step = s.step > 0 ? s.step : 1;
  const deg = Math.round(dialToDeg(n, s) / step) * step;
  return roundTo(dialWraps(s) && deg >= dialRange(s) ? 0 : deg, 6);
}
/** Apply a drag / key delta (degrees, clockwise +) to a registry value: clamp (wheel) or wrap (crank). */
export function dialAddDelta(n, deltaDeg, spec) {
  const s = resolveSpec(spec);
  return degToDial(dialToDeg(n, s) + (Number.isFinite(deltaDeg) ? deltaDeg : 0), s);
}
/** One spring step toward the dial's default (frame-rate independent). A crank takes the shortest way round. */
export function dialSpringStep(n, dt, k, spec, eps = 0.05) {
  const s = resolveSpec(spec);
  const r = dialRange(s);
  const cur = dialToDeg(n, s);
  const target = dialToDeg(dialDefault(s), s);
  const diff = dialWraps(s) ? unwrapDelta(target, cur, r) : cur - target;
  const out = spring.step(diff, dt, k, eps);                       /* eps is in degrees here */
  return degToDial(target + out, s);
}

/* ── spring (frame-rate independent) ──────────────────────────────────── */
export const SPRING_EPS = 0.001;
export const spring = {
  /** Exponential decay toward 0: v *= exp(-k·dt). Snaps to 0 below eps. */
  step(v, dt, k, eps = SPRING_EPS) {
    if (!(dt > 0) || !(k > 0)) return v;
    const out = v * Math.exp(-k * dt);
    return Math.abs(out) < eps ? 0 : out;
  },
  /** Decay toward `target` instead of 0. */
  toward(v, target, dt, k, eps = SPRING_EPS) {
    return target + spring.step(v - target, dt, k, eps);
  }
};

/* ── pedal (Phase 4) ──────────────────────────────────────────────────────
   Old pedals decayed a fixed factor per animation frame (v *= 0.86 at 60 Hz).
   decayFactorToK turns that into a time constant so the release feels the same
   at any frame rate: k = -ln(factor) * hz  (0.86 -> 9.05 s^-1, 0.88 -> 7.67 s^-1). */
export const PEDAL_HZ = 60;
export function decayFactorToK(factor, hz = PEDAL_HZ) {
  if (!(factor > 0 && factor < 1)) throw new Error('controls-core: decay factor must be in (0,1)');
  return -Math.log(factor) * hz;
}
/** Exponential release of a normalised pedal value toward 0 (frame-rate independent). */
export function springStepAxis(v, dt, k, eps = SPRING_EPS) {
  return spring.step(v, dt, k, eps);
}
/** Shift-hold quick-press: press -> ramp to 1, release -> spring back. */
export const PEDAL_RAMP = 4;            /* normalised units / s while Shift is held (0 -> 1 in 0.25 s) */
export const DEFAULT_PEDAL_K = 9.05;
export function pedalIntent(ev) {
  if (!ev) return null;
  if (ev.key === 'Shift') return { pressed: true };
  return null;
}
export function pedalUpIntent(ev) {
  if (ev && ev.key === 'Shift') return { pressed: false };
  return null;
}
/**
 * Tiny pedal state machine, no DOM.
 *   press()/release()  Shift-hold (repeat events must be filtered by the caller via press(true))
 *   hold(v)            pointer/keyboard puts the pedal at v and cancels any ramp/release
 *   let go             release() with `held=false` lets the spring act
 *   step(dt)           advances; returns true while still moving
 *   value              current normalised value
 */
export function createPedalModel({ k = DEFAULT_PEDAL_K, ramp = PEDAL_RAMP, value = 0, rest = 0 } = {}) {
  const m = {
    k, ramp, rest,
    value,
    pressed: false,          /* Shift is held */
    held: false,             /* pointer / key holds the value */
    get target() { return m.pressed ? 1 : m.held ? m.value : m.rest; },
    /** Shift down. Auto-repeat (already pressed) is ignored. Returns true on a real edge. */
    press() { if (m.pressed) return false; m.pressed = true; return true; },
    /** Shift up -> spring back (unless something else holds the pedal). Returns true on a real edge. */
    release() { if (!m.pressed) return false; m.pressed = false; return true; },
    /** pointer/keyboard sets the value directly */
    hold(v) { m.value = clamp(Number.isFinite(v) ? v : 0, 0, 1); m.held = true; m.pressed = false; return m.value; },
    /** pointer/keyboard let go -> the spring takes over */
    letGo() { m.held = false; },
    /** is the model still moving (ramping or springing)? */
    active() { return m.pressed ? m.value < 1 : (!m.held && m.value !== m.rest); },
    step(dt) {
      if (m.pressed) {
        m.value = Math.min(1, m.value + m.ramp * dt);
      } else if (!m.held) {
        m.value = m.rest + springStepAxis(m.value - m.rest, dt, m.k);
      }
      return m.active();
    },
    reset() { m.pressed = false; m.held = false; m.value = m.rest; }
  };
  return m;
}


/* ── choice / toggle / action (Phase 6) — pure ────────────────────────────
   choice : registry stores the selected INDEX (0..n-1), not a normalised value
   toggle : registry stores 0 / 1
   action : no stored value (momentary click → onAction)
   Options are written  ['A','B']  or  [{id,label,tone}]  and normalised to {id,label,tone,index}. */
export const isChoice = (spec) => !!spec && (spec.type === 'choice' || spec.kind === 'choice');
export const isToggle = (spec) => !!spec && (spec.type === 'toggle' || spec.kind === 'toggle');
export const TONES = Object.freeze(['normal', 'crit']);

/** ['A','B'] | [{id,label,tone}] -> [{id,label,tone,index}]. Throws on empty / duplicate ids. */
export function normalizeOptions(options) {
  if (!Array.isArray(options) || options.length === 0) throw new Error('controls-core: choice needs a non-empty options array');
  const seen = new Set();
  return options.map((o, index) => {
    const raw = (o !== null && typeof o === 'object') ? o : { id: o };
    if (raw.id === undefined || raw.id === null || raw.id === '') throw new Error('controls-core: choice option needs an id');
    const id = String(raw.id);
    if (seen.has(id)) throw new Error(`controls-core: duplicate choice option "${id}"`);
    seen.add(id);
    const tone = TONES.includes(raw.tone) ? raw.tone : 'normal';
    const out = { id, label: raw.label == null ? id : String(raw.label), tone, index };
    if (raw.sub != null) out.sub = String(raw.sub);
    return out;
  });
}
/** index of an option id (or of an already-numeric index) in options; -1 when absent. */
export function choiceIndex(value, options) {
  const list = normalizeOptions(options);
  if (typeof value === 'number' && Number.isInteger(value)) return value >= 0 && value < list.length ? value : -1;
  const i = list.findIndex((o) => o.id === String(value));
  return i;
}
/** clamp an index into 0..n-1 (non-finite -> 0) */
export function clampChoice(index, n) {
  if (!(n > 0)) return 0;
  const i = Number.isFinite(index) ? Math.round(index) : 0;
  return i < 0 ? 0 : i > n - 1 ? n - 1 : i;
}
/** step an index by ±step across n options; wrap = loop round, otherwise clamp at the ends */
export function stepChoice(index, step, n, wrap = false) {
  if (!(n > 0)) return 0;
  const cur = clampChoice(index, n);
  const next = cur + (Number.isFinite(step) ? Math.trunc(step) : 0);
  if (wrap) return ((next % n) + n) % n;
  return clampChoice(next, n);
}
/** option id for a registry index (clamped) */
export function choiceId(index, options) {
  const list = normalizeOptions(options);
  return list[clampChoice(index, list.length)].id;
}
/** default index of a choice spec: spec.def as id or index, else 0 */
export function choiceDefault(spec) {
  const s = spec || {};
  if (!Array.isArray(s.options) || !s.options.length) return 0;
  if (s.def === undefined) return 0;
  const i = choiceIndex(s.def, s.options);
  return i < 0 ? 0 : i;
}
/** toggle default: spec.def truthy -> 1 */
export const toggleDefault = (spec) => (spec && spec.def ? 1 : 0);
/** Toggle value from anything boolean-ish -> 0 | 1 */
export const toggleValue = (v) => (v ? 1 : 0);
export const toggleFlip = (v) => (v ? 0 : 1);
/** Text for aria-valuetext / readout of a choice */
export function choiceText(index, options) {
  const list = normalizeOptions(options);
  return list[clampChoice(index, list.length)].label;
}

/**
 * The H-gate gearbox stick: ↑/↓ shift up / down through the gears, N = neutral, Esc / Home = neutral too
 * (the single reset path). `spec.neutral` = index of neutral (default 0). Returns
 *   { step:+1|-1 } | { to:index } | null
 */
export function gateKeyToIntent(ev, spec = {}) {
  const key = ev && ev.key;
  const neutral = Number.isInteger(spec.neutral) ? spec.neutral : 0;
  if (key === 'ArrowUp')   return { step: +1 };
  if (key === 'ArrowDown') return { step: -1 };
  if (key === 'n' || key === 'N') return { to: neutral };
  if (key === 'Escape' || key === 'Home') return { to: neutral };
  return null;
}

/* ── keyboard mapping ─────────────────────────────────────────────────── */
export const KEY_STEP_AXIS = 0.08;       /* per press, normalised 0..1      */
export const KEY_STEP_DIAL_DEG = 10;     /* per press, degrees              */
export const DEFAULT_DIAL_RANGE = 360;   /* total sweep in degrees          */

/**
 * Map a KeyboardEvent-like {key, shiftKey} to an intent for a control kind.
 * Returns null when the key is not handled by that kind.
 *   axis      -> { delta }            (normalised 0..1 units)
 *   dial      -> { delta } | { reset } (registry units; + = clockwise; Enter / Home = default)
 *   choice    -> { step }             (+1 / -1 index)
 *   momentary -> { pressed }          (Shift held)
 * `spec.range` (dial) is the total sweep in degrees (default 360), so one
 * press = KEY_STEP_DIAL_DEG / (range/2) in normalised units.
 */
export function keyToIntent(kind, ev, spec = {}) {
  const key = ev && ev.key;
  switch (kind) {
    case 'axis':
      if (key === 'ArrowUp')   return { delta: +KEY_STEP_AXIS };
      if (key === 'ArrowDown') return { delta: -KEY_STEP_AXIS };
      return null;
    case 'dial': {
      /* clamped wheel: registry −1..1 spans ±range/2; wrapping crank: 0..1 spans range */
      const span = (spec.range ?? DEFAULT_DIAL_RANGE) / (spec.wrap ? 1 : 2);
      const d = KEY_STEP_DIAL_DEG / span;
      if (key === 'ArrowRight') return { delta: +d };          /* → = clockwise = right, in every module */
      if (key === 'ArrowLeft')  return { delta: -d };
      if (key === 'Enter' || key === 'Home') return { reset: true };   /* the single reset path */
      return null;
    }
    case 'choice':
      if (key === 'ArrowRight') return { step: +1 };
      if (key === 'ArrowLeft')  return { step: -1 };
      return null;
    case 'toggle':
      if (key === 'Enter' || key === ' ' || key === 'Spacebar') return { flip: true };
      return null;
    case 'momentary':
      if (key === 'Shift') return { pressed: true };
      return null;
    default:
      return null;
  }
}
/** keyup counterpart for momentary (Shift released). */
export function keyUpToIntent(kind, ev) {
  if (kind === 'momentary' && ev && ev.key === 'Shift') return { pressed: false };
  return null;
}

/** Global (shell-owned / module-owned) keymap, R5. Returns action or null. */
export const GLOBAL_KEYS = Object.freeze({
  ' ': 'togglePlay', Spacebar: 'togglePlay',
  r: 'reset', R: 'reset',
  d: 'labelDensity', D: 'labelDensity',
  l: 'theme', L: 'theme',
  w: 'wireframe', W: 'wireframe',
  x: 'xray', X: 'xray',
  Escape: 'close'
});
export function globalKeyAction(key) {
  return Object.prototype.hasOwnProperty.call(GLOBAL_KEYS, key) ? GLOBAL_KEYS[key] : null;
}

/* ── registry (unique ids, single value store) ────────────────────────── */
export function createRegistry() {
  const items = new Map();       /* id -> { spec, value }  */
  const listeners = new Map();   /* id -> Set<fn>          */
  return {
    /** Register a control id. Throws if already registered (R9). */
    register(id, spec = {}) {
      if (typeof id !== 'string' || !id) throw new Error('controls-core: id must be a non-empty string');
      if (items.has(id)) throw new Error(`controls-core: duplicate control id "${id}"`);
      items.set(id, { spec, value: defaultNormalized(spec) });
      return id;
    },
    has: (id) => items.has(id),
    ids: () => [...items.keys()],
    spec: (id) => (items.get(id) || {}).spec,
    get(id) {
      const it = items.get(id);
      return it ? it.value : undefined;
    },
    /** Set a normalised value; fires listeners only on change. */
    set(id, value) {
      const it = items.get(id);
      if (!it) throw new Error(`controls-core: unknown control id "${id}"`);
      const s = it.spec || {};
      let v;
      if (isChoice(s)) v = clampChoice(value, Array.isArray(s.options) ? s.options.length : 1);     /* index */
      else if (isToggle(s)) v = toggleValue(value);                                                  /* 0 | 1 */
      else v = clamp(Number.isFinite(value) ? value : 0, isDial(s) ? dialMin(s) : 0, 1);
      if (v === it.value) return v;
      it.value = v;
      (listeners.get(id) || []).forEach((fn) => fn(v, id));
      return v;
    },
    on(id, fn) {
      if (!listeners.has(id)) listeners.set(id, new Set());
      listeners.get(id).add(fn);
      return () => listeners.get(id).delete(fn);
    },
    unregister(id) { items.delete(id); listeners.delete(id); },
    /** Clear everything (tests / module reset). */
    reset() { items.clear(); listeners.clear(); }
  };
}

/* Shared default registry — API surface required by the phase brief:
   register(id) throws on duplicates, reset() clears for tests. */
const defaultRegistry = createRegistry();
export const register = (id, spec) => defaultRegistry.register(id, spec);
export const reset = () => defaultRegistry.reset();
export const registry = defaultRegistry;
