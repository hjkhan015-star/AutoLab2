/* Phase 9a: device tier + glass dock surface. Pure functions and CSS rules; no DOM needed. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifyDevice, uiTier, stepDownTier, tierOverride, TIERS } from '../dock.js';

const rd = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  ', name); };

t('classifyDevice keeps the thresholds kit.js always used', () => {
  assert.equal(classifyDevice({ cores: 4, mem: 8 }), 'low');
  assert.equal(classifyDevice({ cores: 8, mem: 2 }), 'low');
  assert.equal(classifyDevice({ cores: 6, mem: 8 }), 'mid');
  assert.equal(classifyDevice({ cores: 8, mem: 8, dpr: 3, isCoarse: true }), 'mid');
  assert.equal(classifyDevice({ cores: 8, mem: 8, dpr: 3, isCoarse: false }), 'high');
  assert.equal(classifyDevice({ cores: 8, mem: 8 }), 'high');
});
t('uiTier: ?ui= override wins, reduced transparency forces low, bad input falls back to mid', () => {
  assert.equal(uiTier({ device: 'low', override: 'high' }), 'high');
  assert.equal(uiTier({ device: 'high', reduceTransparency: true }), 'low');
  assert.equal(uiTier({ device: 'high' }), 'high');
  assert.equal(uiTier({ device: 'nope' }), 'mid');
  assert.equal(uiTier(), 'mid');
});
t('stepDownTier walks high → mid → low and stops', () => {
  assert.equal(stepDownTier('high'), 'mid');
  assert.equal(stepDownTier('mid'), 'low');
  assert.equal(stepDownTier('low'), 'low');
  assert.deepEqual([...TIERS], ['low', 'mid', 'high']);
});
t('tierOverride reads ?ui= only', () => {
  assert.equal(tierOverride('?ui=high'), 'high');
  assert.equal(tierOverride('?a=1&ui=LOW'), 'low');
  assert.equal(tierOverride('?ui=ultra'), null);
  assert.equal(tierOverride(''), null);
  assert.equal(tierOverride(undefined), null);
});
t('kit.js shares the classification and asks for a cheaper dock when resolution is already at its floor', () => {
  const kit = rd('kit.js');
  assert.match(kit, /classifyDevice\(\{ cores, mem, dpr, isCoarse \}\)/);
  assert.match(kit, /dispatchEvent\(new Event\('al-perf-slow'\)\)/);
  assert.match(rd('dock.js'), /addEventListener\('al-perf-slow'/);
});
t('controls.css Phase 9a block: tokens only, tier hooks, low tier has no blur, floating portrait panel keeps its --dock-h box', () => {
  const css = rd('controls.css'); const b = css.slice(css.indexOf('Phase 9a'));
  assert.ok(b.length > 1500);
  assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(/.test(b), 'colour literal in the glass block');
  for (const tier of ['high', 'mid', 'low']) assert.match(b, new RegExp(`html\\[data-ui-tier="${tier}"\\]`));
  assert.match(b, /data-ui-tier="low"\]\s+\{ --dock-blur: 0px/);
  assert.match(b, /height:\s+calc\(var\(--dock-h\) - var\(--dock-gap\) - var\(--safe-b, 0px\)\)/);
  for (const m of b.matchAll(/z-index:\s*([^;}]+)[;}]/g)) assert.match(m[1], /^var\(--z-(stage|labels|monitor|dock|menu|toast|guard)\)$/);
  assert.match(b, /prefers-reduced-motion: reduce/);
});
t('app.css defines the glass tokens in both themes', () => {
  const css = rd('app.css');
  for (const k of ['--glass-fill', '--glass-hi', '--glass-lo', '--glass-edge', '--glass-shadow']) assert.equal(css.split(k + ':').length - 1, 2, k);
});
console.log(`\n${n} glass tests passed`);
