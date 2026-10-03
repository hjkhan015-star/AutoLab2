// node tests/layout.test.mjs  (no dependencies)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../controls.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const tok = {};
for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) tok[m[1]] = m[2].trim();

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  ', name); };
const px = (name) => { const m = /^(-?[\d.]+)px$/.exec(tok[name] || ''); assert.ok(m, `${name} must be a px value, got "${tok[name]}"`); return +m[1]; };
const vh = (name) => { const m = /^(-?[\d.]+)vh$/.exec(tok[name] || ''); assert.ok(m, `${name} must be a vh value, got "${tok[name]}"`); return +m[1]; };

t('header height <= 32px (landscape <= 28px)', () => {
  assert.ok(px('--hdr-h') <= 32);
  assert.ok(px('--hdr-h-land') <= 28);
});

t('dock: default 24vh, max 30vh, below soft-keyboard height (<= 34vh)', () => {
  assert.equal(vh('--dock-default'), 24);
  assert.ok(vh('--dock-max') <= 30);
  assert.ok(vh('--dock-max') <= 34, '--dock-max <= 34vh');
  assert.ok(vh('--dock-default') <= vh('--dock-max'));
  assert.ok(vh('--dock-kbd') <= 34 && vh('--dock-max') <= vh('--dock-kbd'));
  assert.ok(vh('--monitor-max') <= 40);
});

t('tap target >= 44px, text sizes >= 11px / 12px', () => {
  assert.ok(px('--ctl-tap') >= 44);
  assert.ok(px('--ctl-text') >= 11);
  assert.ok(px('--ctl-value-text') >= 12);
});

t('required control tokens exist', () => {
  for (const k of ['--ctl-radius', '--ctl-track', '--ctl-focus']) assert.ok(tok[k], `${k} missing`);
});

t('z-index scale matches R10', () => {
  const want = { '--z-stage': 0, '--z-labels': 2, '--z-monitor': 10, '--z-dock': 20, '--z-menu': 30, '--z-toast': 40, '--z-guard': 99999 };
  for (const [k, v] of Object.entries(want)) assert.equal(Number(tok[k]), v, k);
  const order = Object.keys(want).map((k) => Number(tok[k]));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'scale is strictly ascending');
});

t('tokens only: no hard-coded colours anywhere in controls.css (R3)', () => {
  assert.ok(!/#[0-9a-f]{3,8}\b/i.test(css), 'hex colour found');
  assert.ok(!/rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(/i.test(css), 'colour function with literal values found');
  assert.ok(!/:\s*(white|black|red|green|blue|gray|grey)\s*[;}]/i.test(css), 'named colour found');
});

t('chrome: header is 32px (28px landscape), taps are 44px, z-index only from the R10 scale', () => {
  assert.match(css, /\.al-hdr \{[^}]*height: var\(--al-hdr-h\)/);
  assert.match(css, /--al-hdr-h: var\(--hdr-h\)/);
  assert.match(css, /max-height: 540px\) \{ \.al-hdr \{ --al-hdr-h: var\(--hdr-h-land\)/);
  assert.match(css, /\.al-hdr-btn \{[^}]*width: var\(--ctl-tap\)/);
  assert.match(css, /\.al-hdr-btn::after \{ content: ""; position: absolute; inset: -8px 0/, 'vertical hit area grows to >= 44px');
  assert.match(css, /\.al-seg-btn \{[^}]*min-height: var\(--ctl-tap\)/);
  for (const m of css.matchAll(/z-index:\s*([^;]+);/g)) assert.match(m[1], /var\(--z-(stage|labels|monitor|dock|menu|toast|guard)\)/, `z-index "${m[1]}" is not from the scale`);
});

t('chrome: phone sheet <= 50vh, popover on desktop, reduced motion respected', () => {
  assert.match(css, /\.al-menu\[data-mode="sheet"\] \{[^}]*max-height: 50vh; max-height: 50dvh/);
  assert.match(css, /\.al-menu\[data-mode="popover"\] \{/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{[^}]*\.al-menu/);
  for (const m of css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) assert.ok(+m[1] >= 11, `font-size ${m[1]}px < 11px`);
});

t('Phase 2: dock tokens (default 24vh, max 30vh) and the stage insets', () => {
  assert.equal(vh('--dock-default'), 24); assert.equal(vh('--dock-max'), 30);
  assert.ok(px('--dock-slim') === 56 && px('--dock-options') <= 44 && px('--dock-options') >= 40 && px('--dock-rail-w') === 140);
  assert.match(css, /#canvas-wrap \{ inset: var\(--stage-top\) var\(--dock-rail\) var\(--dock-h\) var\(--dock-rail\); \}/);
  assert.match(css, /body\.embedded \{ --stage-top: 0px; \}/, 'embedded: top inset is 0');
  assert.match(css, /--stage-top: calc\(var\(--hdr-h\) \+ var\(--safe-t, 0px\)\)/, 'standalone: top inset is --hdr-h');
});
t('Phase 2: phone = max-width:720px or max-height:540px; the dock is <= 34vh in every mode', () => {
  assert.match(css, /@media \(max-height: 540px\) and \(min-aspect-ratio: 1\/1\)/);
  assert.match(css, /@media \(max-width: 720px\), \(max-height: 540px\)/);
  assert.ok(vh('--dock-max') <= 34);
});

console.log(`\n${n} test groups passed`);
