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
t('THREE used outside build() is imported (wiring bug); inside build() it comes from H', () => {
  for (const f of pages) {
    const code = moduleCode(rd(f));
    const span = bodyOf(code, 'function build(H)');
    const outside = span ? code.slice(0, span[0]) + code.slice(span[1]) : code;
    if (/(?<![\w.])THREE\./.test(outside.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')))
      assert.match(code, /import\s+\*\s+as\s+THREE\s+from\s+['"]three['"]/, `${f}: THREE used outside build() without an import`);
  }
});
t('fuelpump declares its domLast throttle clock (typo bug)', () => {
  const code = moduleCode(rd('fuelpump.html'));
  assert.match(code, /\blet\s+domLast\b/);
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
console.log(`${n} phase 8 tests passed`);
