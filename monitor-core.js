/* ════════════════════════════════════════════════════
   monitor-core.js — Phase 7a. Pure logic for the Monitor (no DOM, unit-tested in tests/monitor.test.mjs).
   monitor.js builds the DOM from these helpers; modules never import this file directly.
   ════════════════════════════════════════════════════ */

export const TONES = ['ok', 'warn', 'crit', 'hi'];   /* 'hi' = accent highlight (the old ro `hi` class) */
export const TEXT_HZ = 9;                 /* text refresh target: 8–10 Hz */
export const TRACE_HZ = 30;               /* trace redraw target */
export const DEFAULT_TRACE_LEN = 240;     /* samples kept per series (≈ 8 s at 30 Hz) */

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ── value → bar / gauge ─────────────────────────────── */
/* bar: percent 0..100 (the guided modules already pass percent). */
export function barPercent(pct) {
  const n = Number(pct);
  return Number.isFinite(n) ? clamp(n, 0, 100) : 0;
}
/* gauge: value in [min,max] → 0..1 fraction → needle angle in degrees across an arc (default −120..+120). */
export function gaugeFraction(v, min = 0, max = 100) {
  const n = Number(v);
  if (!Number.isFinite(n) || !(max > min)) return 0;
  return clamp((n - min) / (max - min), 0, 1);
}
export function gaugeAngle(v, min = 0, max = 100, arc = 240) {
  return -arc / 2 + gaugeFraction(v, min, max) * arc;
}

/* ── formatting ──────────────────────────────────────── */
export function formatNumber(v, digits = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '–';
  return n.toFixed(clamp(Math.round(digits), 0, 6));
}
/* merge two value payloads (string | number | object) so setBig + setBar in one tick do not drop each other */
export function mergeValue(a, b) {
  const o = (v) => (v && typeof v === 'object' ? v : (v === undefined || v === null ? {} : { text: v }));
  return Object.assign({}, o(a), o(b));
}
/* normalise a row payload: 'text' | ['text', tone] → { text, tone } (unknown tones fall back to '') */
/** Segmented-spec geometry: band start / end and marker position as 0..1 fractions of the bar, plus whether the value is inside the band. */
export function specBar(spec, value) {
  const f = (v) => clamp((v - spec.min) / (spec.max - spec.min), 0, 1);
  const lo = Math.min(spec.lo, spec.hi), hi = Math.max(spec.lo, spec.hi);
  return { lo: f(lo), hi: f(hi), pos: f(value), inBand: value >= lo - 1e-9 && value <= hi + 1e-9 };
}
export function normalizeRowValue(v) {
  if (Array.isArray(v) && Number.isFinite(v[2])) return { text: v[0] == null ? '' : String(v[0]), tone: TONES.includes(v[1]) ? v[1] : '', num: v[2] };
  if (Array.isArray(v)) return { text: v[0] == null ? '' : String(v[0]), tone: TONES.includes(v[1]) ? v[1] : '' };
  return { text: v == null ? '' : String(v), tone: '' };
}
/* normalise a status payload: [text, on, tone?] | { text, on, tone? } → { text, on, tone }.
   tone: '' | 'warn' | 'crit' (a fault sentence is shown in the warn / crit colour instead of the green lamp) */
const STATUS_TONES = ['', 'warn', 'crit'];
export function normalizeStatus(s) {
  const tone = (t) => (STATUS_TONES.includes(t) ? t : '');
  if (Array.isArray(s)) return { text: s[0] == null ? '' : String(s[0]), on: !!s[1], tone: tone(s[2]) };
  if (s && typeof s === 'object') return { text: s.text == null ? '' : String(s.text), on: !!s.on, tone: tone(s.tone) };
  return { text: s == null ? '' : String(s), on: false, tone: '' };
}

/* ── rolling buffer (fixed capacity ring, oldest → newest) ── */
export function createRolling(capacity = DEFAULT_TRACE_LEN) {
  const cap = Math.max(2, Math.floor(capacity) || DEFAULT_TRACE_LEN);
  const buf = new Float32Array(cap);
  let head = 0, n = 0;
  return {
    capacity: cap,
    push(v) { buf[head] = Number.isFinite(v) ? v : (n ? buf[(head - 1 + cap) % cap] : 0); head = (head + 1) % cap; if (n < cap) n++; },
    get length() { return n; },
    at(i) { return n ? buf[(head - n + i + cap * 2) % cap] : 0; },     /* i = 0 oldest … length−1 newest */
    toArray() { const a = new Array(n); for (let i = 0; i < n; i++) a[i] = buf[(head - n + i + cap * 2) % cap]; return a; },
    clear() { head = 0; n = 0; },
    min() { let m = Infinity; for (let i = 0; i < n; i++) m = Math.min(m, buf[(head - n + i + cap * 2) % cap]); return n ? m : 0; },
    max() { let m = -Infinity; for (let i = 0; i < n; i++) m = Math.max(m, buf[(head - n + i + cap * 2) % cap]); return n ? m : 0; },
  };
}

/* ── rate limiter: `due(now)` is true at most `hz` times a second. Time is passed in (tests use fake clocks). ── */
export function createRateLimiter(hz = TEXT_HZ) {
  const gap = 1000 / Math.max(0.1, hz);
  let next = -Infinity;
  return {
    gap,
    due(nowMs) { if (nowMs >= next) { next = nowMs + gap; return true; } return false; },
    reset() { next = -Infinity; },
  };
}

/* ── channel config validation ──────────────────────────
   cfg = { value?:{label,unit,max,bar}, rows?:[[id,label]|{id,label}], traces?:[{id,label,series:[{id,color,label}], min,max}],
           gauge?:{id,label,min,max,unit}, status?:true|{text}, footer?:html, label?:string }
   Returns { ok, errors, config } where config is normalised; never throws. Duplicate ids (across rows/traces/gauge) are errors. */
export function validateMonitorConfig(cfg) {
  const errors = [];
  const out = { label: '', value: null, rows: [], traces: [], gauge: null, status: null, footer: '' };
  if (!cfg || typeof cfg !== 'object') return { ok: false, errors: ['config must be an object'], config: out };
  const seen = new Set();
  const claim = (id, where) => {
    if (typeof id !== 'string' || !id) { errors.push(`${where}: id must be a non-empty string`); return false; }
    if (!/^[A-Za-z0-9_-]+$/.test(id)) { errors.push(`${where}: id "${id}" may only contain letters, digits, _ and -`); return false; }
    if (seen.has(id)) { errors.push(`${where}: duplicate id "${id}"`); return false; }
    seen.add(id); return true;
  };
  out.label = cfg.label == null ? '' : String(cfg.label);
  if (cfg.value) {
    const v = cfg.value;
    if (typeof v !== 'object') errors.push('value: must be an object');
    else out.value = { label: v.label == null ? '' : String(v.label), unit: v.unit == null ? '' : String(v.unit), max: Number.isFinite(v.max) ? v.max : 100, bar: v.bar !== false };
  }
  (cfg.rows || []).forEach((r, i) => {
    const id = Array.isArray(r) ? r[0] : r && r.id, label = Array.isArray(r) ? r[1] : r && r.label;
    if (!claim(id, `rows[${i}]`)) return;
    const row = { id, label: label == null ? id : String(label) };
    const sp = Array.isArray(r) ? r[2] && r[2].spec : r && r.spec;      /* segmented-spec bar: value vs the green band */
    if (sp) {
      if (![sp.min, sp.max, sp.lo, sp.hi].every(Number.isFinite) || !(sp.max > sp.min)) errors.push(`rows[${i}]: spec needs finite min < max, lo, hi`);
      else row.spec = { min: sp.min, max: sp.max, lo: sp.lo, hi: sp.hi };
    }
    out.rows.push(row);
  });
  (cfg.traces || []).forEach((t, i) => {
    if (!t || !claim(t.id, `traces[${i}]`)) { if (!t) errors.push(`traces[${i}]: must be an object`); return; }
    const series = (t.series || []).map((s, j) => (typeof s === 'string' ? { id: s, label: s } : s));
    if (!series.length) { errors.push(`traces[${i}]: needs at least one series`); return; }
    if (series.length > 6) errors.push(`traces[${i}]: at most 6 series`);
    const sIds = new Set();
    series.forEach((s, j) => {
      if (!s || typeof s.id !== 'string' || !s.id) errors.push(`traces[${i}].series[${j}]: id required`);
      else if (sIds.has(s.id)) errors.push(`traces[${i}].series[${j}]: duplicate series id "${s.id}"`);
      else sIds.add(s.id);
    });
    out.traces.push({ id: t.id, label: t.label == null ? '' : String(t.label), series: series.slice(0, 6), min: Number.isFinite(t.min) ? t.min : null, max: Number.isFinite(t.max) ? t.max : null, length: Number.isFinite(t.length) ? Math.max(8, t.length | 0) : DEFAULT_TRACE_LEN });
  });
  if (cfg.gauge) {
    const g = cfg.gauge;
    if (claim(g.id, 'gauge')) {
      const min = Number.isFinite(g.min) ? g.min : 0, max = Number.isFinite(g.max) ? g.max : 100;
      if (!(max > min)) errors.push('gauge: max must be greater than min');
      else out.gauge = { id: g.id, label: g.label == null ? '' : String(g.label), unit: g.unit == null ? '' : String(g.unit), min, max };
    }
  }
  if (cfg.status) out.status = { text: typeof cfg.status === 'object' && cfg.status.text != null ? String(cfg.status.text) : '' };
  if (cfg.footer != null) out.footer = String(cfg.footer);
  return { ok: errors.length === 0, errors, config: out };
}

/* ── trace scaling: y range for a set of buffers (fixed when min/max given, else padded auto-range) ── */
export function traceRange(buffers, min = null, max = null) {
  let lo = min, hi = max;
  if (lo == null || hi == null) {
    let a = Infinity, b = -Infinity;
    for (const buf of buffers) { if (!buf.length) continue; a = Math.min(a, buf.min()); b = Math.max(b, buf.max()); }
    if (!Number.isFinite(a)) { a = 0; b = 1; }
    if (b - a < 1e-9) { a -= 0.5; b += 0.5; }
    const pad = (b - a) * 0.08;
    if (lo == null) lo = a - pad;
    if (hi == null) hi = b + pad;
  }
  return { lo, hi };
}
