// node tests/shell.test.mjs — Phase 1 acceptance, checked statically against the source (no dependencies).
// These are source-level guarantees; they do NOT replace opening the app on a phone (see the manual checklist).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rd = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  ', name); };

const index = rd('index.html'), kit = rd('kit.js'), chrome = rd('chrome.js'), appcss = rd('app.css'), sw = rd('sw.js');
const shellJs = index.slice(index.lastIndexOf('<script type="module">'));

t('index.html: no pill, no floating ⋯, no old sheet', () => {
  assert.ok(!/id="pill-|class="pill-|module-pill|btn-more|pill-more/.test(index), 'pill / btn-more left behind');
  assert.ok(!/sheet-backdrop|bottom-sheet|sheet-content|sheet-reset|extras-grid/.test(index), 'old bottom sheet left behind');
  assert.ok(!/<use href="#i-more"/.test(index), 'no static ⋯ icon in the shell markup');
  assert.ok(!/id="btn-back"/.test(index), 'back button now comes from chrome.js');
});

t('exactly one ⋯ button is ever built (chrome.js) and the shell builds one header + one menu', () => {
  assert.equal((chrome.match(/iconButton\(doc, 'more'/g) || []).length, 1);
  assert.equal((shellJs.match(/createHeader\(/g) || []).length, 1);
  assert.equal((shellJs.match(/createMenu\(/g) || []).length, 1);
});

t('index.html: no duplicate ids', () => {
  const ids = [...index.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  assert.deepEqual(dup, []);
});

t('shell: no 64 px reservations; frame host fills what is below the header', () => {
  assert.match(index, /#module-frame-host \{ position: relative; flex: 1 1 auto;/);
  assert.ok(!/#module-frame-host \{ position: absolute; inset: 0/.test(index));
  assert.ok(!/bottom: calc\(var\(--s-4\) \+ var\(--safe-b\)\)/.test(index), 'pill bottom offset gone');
});

t('one keydown path: no window keydown listeners left in shell or kit; both install the shared router', () => {
  assert.ok(!/window\.addEventListener\('keydown'/.test(strip(shellJs)), 'shell still has its own window keydown');
  assert.ok(!/window\.addEventListener\('keydown'/.test(strip(kit)), 'kit still has its own window keydown');
  assert.match(shellJs, /installKeys\(window, keyRouter\)/);
  assert.match(kit, /installKeys\(window, keyRouter\)/);
  assert.match(shellJs, /from '\.\/keys\.js'/); assert.match(kit, /from '\.\/keys\.js'/);
});

t('protocol: setLabelDensity + toggleInfo + key (both directions); setLabels kept for compatibility', () => {
  assert.match(shellJs, /action: 'setLabelDensity'/);
  assert.match(shellJs, /action: 'toggleInfo'/);
  assert.match(shellJs, /action: 'key'/);
  assert.match(shellJs, /d\.type === 'key'/);
  assert.match(kit, /setLabelDensity:/); assert.match(kit, /toggleInfo:/);
  assert.match(kit, /d\.action === 'key'/);
  assert.match(kit, /type: 'key', action: a/, 'module → shell key forwarding');
  assert.match(kit, /setLabels:\s+v =>/, 'legacy setLabels still handled');
});

t('theme: one path only — the shell no longer writes light-theme into the iframe', () => {
  const fix = index.slice(index.indexOf('function injectEmbedFix'), index.indexOf('var MAX_LIVE'));
  assert.ok(!/light-theme/.test(fix), 'injectEmbedFix still toggles light-theme');
  assert.match(fix, /classList\.add\('embedded'\)/, 'injectEmbedFix itself is kept until Phase 8');
});

t('R6/R7 (Phase 2 supersedes Phase 1): play / reset live in the dock in BOTH modes; density + sim speed only in the ⋯ menu', () => {
  for (const id of ['btn-play', 'btn-reset']) assert.equal(kit.split('\n').filter((l) => l.includes(`id="${id}"`)).length, 1, id);
  assert.ok(!/id="btn-density"/.test(kit) && !/id="speed"/.test(kit));
  assert.ok(!/t\.speed && t\.speed\.module/.test(kit), 'Phase 3: the temporary module-local slider is gone (axes replace it)');
  assert.ok(!/body\.embedded\.uses-ui-kit \.ui-toolbar #btn-play/.test(appcss), 'CSS does not hide dock nodes');
});

t('D8 (Phase 3): ignition + mpfi own a real axis and never read state.speedMul', () => {
  for (const [f, id] of [['ignition.html', 'rpm'], ['mpfi.html', 'load']]) {
    const s = rd(f);
    assert.match(s, new RegExp(`axes:\\s*\\[\\{ id: '${id}'`), `${f}: no '${id}' axis`);
    assert.ok(!/module: true|data-phase1-temp|speedInput/.test(strip(s)), `${f} still has the Phase 1 temporary slider`);
    const code = strip(s).split('\n').filter((l) => /state\.speedMul/.test(l));
    assert.deepEqual(code, [], `${f} still uses state.speedMul: ${code.join(' | ')}`);
  }
  assert.ok(!/data-phase1-temp|id="speed-module"/.test(kit), 'kit no longer builds the temporary slider');
});

t('Space is no longer a pedal in braking / clutch / turbocharger', () => {
  for (const f of ['braking.html', 'clutch.html', 'turbocharger.html']) {
    const s = strip(rd(f));
    assert.ok(!/e\.code === 'Space'/.test(s), `${f} still has a Space handler`);
  }
});

t('new files are precached and the SW version is bumped', () => {
  for (const a of ['chrome.js', 'keys.js', 'controls.css', 'controls-core.js']) assert.ok(sw.includes(`'./${a}'`), a);
  assert.match(sw, /const VERSION = 'autolab-v8\.[6-9](\.\d+)?'/);
  assert.match(index, /<link rel="stylesheet" href="controls\.css">/);
});

console.log(`\n${n} test groups passed`);
