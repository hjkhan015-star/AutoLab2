// Phase 8 guards: the three baseline bugs (proved by static scans) + no hand-built controls / globals left behind.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const rd = (f) => readFileSync(new URL(f, root), 'utf8');
const pages = readdirSync(root).filter((f) => f.endsWith('.html') && !['index.html', '404.html'].includes(f));
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  ', name); };
const moduleCode = (s) => [...s.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
const bodyOf = (code, header) => {                       /* text of a top-level function body, by brace matching */
  const i = code.indexOf(header); if (i < 0) return null;
  let d = 0, j = code.indexOf('{', i);
  for (let k = j; k < code.length; k++) { if (code[k] === '{') d++; else if (code[k] === '}' && --d === 0) return [i, k + 1]; }
  return null;
};

t('every page that calls Base.* imports Base from kit.js (oilpump bug)', () => {
  for (const f of pages) {
    const code = moduleCode(rd(f));
    if (/(?<![\w.])Base\./.test(code)) assert.match(code, /import\s+\*\s+as\s+Base\s+from\s+['"]\.\/kit\.js['"]/, `${f}: uses Base without importing it`);
  }
});
t('THREE used outside build() is imported (wiring bug); inside build() it comes from H, and a helper that takes THREE as a parameter owns its own', () => {
  for (const f of pages) {
    let code = moduleCode(rd(f));
    /* cut out every function whose parameter list names THREE (it shadows the import) plus build(H) */
    for (const header of [...code.matchAll(/function\s+\w+\(\s*(?:\w+\s*,\s*)*THREE\b[^)]*\)/g)].map((m) => m[0]).concat(['function build(H)'])) {
      const span = bodyOf(code, header);
      if (span) code = code.slice(0, span[0]) + code.slice(span[1]);
    }
    if (/(?<![\w.])THREE\./.test(code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')))
      assert.match(moduleCode(rd(f)), /import\s+\*\s+as\s+THREE\s+from\s+['"]three['"]/, `${f}: THREE used outside build() without an import`);
  }
});
t('fuelpump declares its domLast throttle clock (typo bug)', () => {
  const code = moduleCode(rd('fuelpump.html'));
  assert.match(code, /\blet\s+(?:[^;\n]*,\s*)?domLast\b/);
  assert.ok(/domLast\s*=\s*now/.test(code));
});
t('no page assigns or reads a free variable named like a throttle clock without declaring it', () => {
  for (const f of pages) {
    const code = moduleCode(rd(f)).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    for (const m of code.matchAll(/\b(\w*Last)\s*=\s*(?:now|performance\.now\(\))/g))
      assert.match(code, new RegExp(`\\b(?:let|var|const)\\s+(?:[^;\\n]*,\\s*)?${m[1]}\\b`), `${f}: ${m[1]} is never declared`);
  }
});
t('Phase 8 deletions stay deleted: legacy.css, injectEmbedFix, window.__*, wireCommonUI / wirePanelToggle', () => {
  assert.ok(!existsSync(new URL('legacy.css', root)));
  const all = readdirSync(root).filter((f) => /\.(js|html|css)$/.test(f)).map((f) => [f, rd(f)]);
  for (const [f, s] of all) {
    assert.ok(!/injectEmbedFix/.test(s), `${f}: injectEmbedFix`);
    assert.ok(!/(?<!\w)(wireCommonUI|wirePanelToggle)/.test(s), `${f}: legacy export`);
    assert.ok(!/window\.__\w+/.test(s), `${f}: window.__ hook`);
  }
});
t('sensors.html is a kit page: header + dock + Monitor from the kit, no legacy chrome', () => {
  const s = rd('sensors.html');
  assert.match(s, /<html[^>]*data-no3d/);
  assert.match(s, /Base\.UI\.create\(/);
  assert.match(s, /moduleId:\s*'sensors'/);
  assert.match(s, /wireBridge\(/);
  assert.ok(!/legacy\.css|class="chips"|id="fl"|type="range"/.test(s));
  assert.match(rd('guard.js'), /data-no3d/);
});
t('the four former WARN pages author no panel of their own', () => {
  for (const f of ['sparkplug', 'thermostat', 'tyres', 'wiring']) {
    const s = rd(f + '.html');
    assert.ok(!/id\s*=\s*['"](sp|th|ty|wh)-ui['"]|\.id\s*=\s*['"](sp|th|ty|wh)-ui/.test(s), `${f}: floating panel`);
    assert.ok(!/collapseBtn|-ui-toggle/.test(s), `${f}: own collapse button`);
  }
});
t('createMenu hide option exists (2D pages drop wireframe / x-ray / density rows)', () => {
  assert.match(rd('chrome.js'), /opts\.hide/);
  assert.match(rd('kit.js'), /menuHide/);
});
t('clean tree: check.mjs fails on stray files, console.log / debugger and dead code; package.json is type=module (no Node warning on every run)', () => {
  const chk = rd('tests/check.mjs');
  assert.match(chk, /stray file in the root/); assert.match(chk, /console\\\.\(log\|debug\|info/); assert.match(chk, /dead code/);
  assert.equal(JSON.parse(rd('package.json')).type, 'module');
  assert.ok(!existsSync(new URL('DECISIONS-6.md', root)) && !existsSync(new URL('SELF-CHECK.md', root)), 'process notes do not ship in the tree');
});
t('guided differential / thermostat: no dial, no panel of their own; ignition keeps its readout in the Monitor (cycle bar not in the panel)', () => {
  for (const f of ['differential.html', 'thermostat.html', 'ignition.html']) assert.ok(!/type: ?'dial'/.test(rd(f)), f);
  assert.ok(!/id=\"cycle-bar\"|class=\"ig-row\"/.test(rd('ignition.html')));
});
t('8.9.1 landscape rail: the axis and select floors give way inside the 140 px rails, and a long axis name is cut with an ellipsis', () => {
  const css = rd('controls.css');
  assert.match(css, /\.ctl-axis \{[^}]*min-width: var\(--ctl-axis-min, 140px\)/);
  assert.match(css, /\.al-dock\[data-mode="landscape"\] \{ --ctl-axis-min: 0px; \}/);
  assert.match(css, /\.al-dock\[data-mode="landscape"\] \.ctl-sel \{ min-width: 0; \}/);
  assert.match(css, /\.al-dock\[data-mode="landscape"\] \.ctl-axis \.ctl-name \{[^}]*text-overflow: ellipsis/);
  assert.match(css, /\.al-dock\[data-mode="landscape"\] \.ui-widget \{ align-items: stretch; \}/);
  assert.match(css, /\.al-dock\[data-mode="landscape"\] \.ui-widget-frame \{ min-width: 0; \}/);
  assert.match(css, /\.al-menu-row\[hidden\] \{ display: none; \}/);
});
t('8.9.1 kit.js loads three.js only for a 3D page: data-no3d skips it, sensors has no importmap', () => {
  const k = rd('kit.js');
  assert.ok(!/^import[^\n]*from 'three/m.test(k), 'no static three import in kit.js');
  assert.match(k, /hasAttribute\('data-no3d'\)/);
  assert.match(k, /await Promise\.all\(\[\s*import\('three'\),\s*import\('three\/addons\/controls\/OrbitControls\.js'\)/);
  assert.ok(!/importmap/.test(rd('sensors.html')), 'sensors needs no import map');
  for (const f of pages.filter((p) => p !== 'sensors.html')) assert.match(rd(f), /type="importmap"/, `${f}: a 3D page keeps its import map`);
});
t('8.9.1 shell ⋯ menu: the module reports the rows it cannot use, the shell hides them per module and ignores W / X for them', () => {
  assert.match(rd('kit.js'), /send\(\{ type: 'ready', menuHide: opts\.menuHide \|\| \[\] \}\)/);
  const ix = rd('index.html');
  assert.match(ix, /menuHidden\[d\.moduleId\] = Array\.isArray\(d\.menuHide\)/);
  assert.match(ix, /menu\.setHidden\(menuHidden\[id\] \|\| \[\]\)/);
  assert.match(ix, /if \(!menu\.isHidden\('wireframe'\)\) setWireframe/);
  assert.match(ix, /if \(!menu\.isHidden\('xray'\)\) setXRay/);
  assert.match(rd('sensors.html'), /menuHide:\['density','wireframe','xray'\]/);
});
t('8.10 wide screens: left control rail, Monitor right column, the stage insets by both, no bottom bar', () => {
  const css = rd('controls.css');
  assert.match(css, /\.al-dock\[data-mode="wide"\] \{[^}]*top: var\(--stage-top\); left: 0; bottom: 0;[^}]*width: var\(--dock-rail-l\)/);
  assert.match(css, /\.al-dock\[data-mode="wide"\]\[data-state="slim"\] \.al-dock-slot,\s*\.al-dock\[data-mode="wide"\]\[data-state="slim"\] \.al-dock-options \{ display: none; \}/, 'folded = transport only');
  assert.match(css, /html\[data-dock="wide"\] #ui-top-stack > #ui-slot-tr \{[^}]*position: fixed; top: var\(--stage-top\); right: 0; bottom: 0;[^}]*width: var\(--dock-rail-r\)/);
  assert.match(css, /html\[data-dock="wide"\]:not\(\[data-monitor\]\) #ui-top-stack > #ui-slot-tr \{ display: none; \}/);
  assert.match(css, /\.al-dock\[data-mode="wide"\] \.ui-widget:has\(\.ctl-axis\) \{ align-items: stretch; \}/, 'sliders use the whole rail');
  const k = rd('kit.js');
  assert.match(k, /dataset\.monitor = '1'/); assert.match(k, /layoutMode\(window\.innerWidth, window\.innerHeight\) === 'wide'\) orb\.set\(false\)/, 'the Monitor never sits folded in its column');
  assert.ok(!/--dock-rail\b(?!-)/.test(css + rd('app.css') + rd('sensors.html')), 'the single --dock-rail is gone: --dock-rail-l / --dock-rail-r');
  assert.match(rd('sensors.html'), /@media \(min-width: 721px\) and \(max-width: 1023px\) and \(min-height: 541px\) \{ body \{ padding-right: 232px; \} \}/, 'the 232 px gutter is only for the floating card');
});
console.log(`${n} phase 8 tests passed`);
