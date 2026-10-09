// vendor/fetch-three.mjs — make Auto Lab self-contained (no CDN).
//   node vendor/fetch-three.mjs                 downloads three.js r160 from unpkg (needs internet, once)
//   node vendor/fetch-three.mjs --from <dir>    copies from a local three@0.160.0 package folder (the one that holds build/ and examples/)
// It then (1) writes vendor/three/…, (2) points every page's import map at it, (3) adds the files to the sw.js precache,
// (4) removes unpkg.com from the CSP in _headers, (5) bumps the minor version everywhere so installed apps refresh. Safe to run twice.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
const root = new URL('..', import.meta.url).pathname, V = '0.160.0', CDN = `https://unpkg.com/three@${V}/`;
const FILES = [['build/three.module.js', 'three.module.js'], ['examples/jsm/controls/OrbitControls.js', 'addons/controls/OrbitControls.js'],
  ['examples/jsm/environments/RoomEnvironment.js', 'addons/environments/RoomEnvironment.js'], ['examples/jsm/utils/BufferGeometryUtils.js', 'addons/utils/BufferGeometryUtils.js']];
const from = process.argv.includes('--from') ? process.argv[process.argv.indexOf('--from') + 1] : null;

for (const [src, dst] of FILES) {
  const out = join(root, 'vendor/three', dst); mkdirSync(dirname(out), { recursive: true });
  if (from) { if (!existsSync(join(from, src))) throw new Error('missing ' + join(from, src)); copyFileSync(join(from, src), out); continue; }
  const res = await fetch(CDN + src); if (!res.ok) throw new Error(`${CDN + src}: HTTP ${res.status}`);
  const txt = await res.text(); if (!/export/.test(txt)) throw new Error(src + ': not a module'); writeFileSync(out, txt);
}
console.log('vendor/three written');

/* every page: import map -> local files (path depends on the folder depth) */
const pages = [];
const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (e.name === 'node_modules' || e.name.startsWith('.')) continue; const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.html')) pages.push(p); } };
walk(root);
let n = 0;
for (const p of pages) {
  const s = readFileSync(p, 'utf8'); if (!s.includes('unpkg.com')) continue;
  const up = relative(dirname(p), root) || '.', pre = up === '.' ? './' : up + '/';
  const t = s.replace(/https:\/\/unpkg\.com\/three@[\d.]+\/build\/three\.module\.js/g, pre + 'vendor/three/three.module.js').replace(/https:\/\/unpkg\.com\/three@[\d.]+\/examples\/jsm\//g, pre + 'vendor/three/addons/');
  writeFileSync(p, t.replace(/<link rel="(?:preconnect|dns-prefetch)" href="https:\/\/unpkg\.com"[^>]*>\n?/g, '')); n++;
}
console.log(n + ' pages now use vendor/three');

/* sw.js: precache the vendor files, bump the version */
let sw = readFileSync(join(root, 'sw.js'), 'utf8');
const add = FILES.map(([, d]) => `  './vendor/three/${d}'`).filter((l) => !sw.includes(l.trim()));
if (add.length) sw = sw.replace(/(const CORE_ASSETS = \[[\s\S]*?)(\n\];)/, (_, a, b) => a + ',\n' + add.join(',\n') + b);
const old = (sw.match(/const VERSION = 'autolab-v(\d+)\.(\d+)\.(\d+)'/) || []).slice(1).map(Number);
if (add.length && old.length) {
  const cur = old.join('.'), next = `${old[0]}.${old[1] + 1}.0`;
  const touch = (f, from2, to) => { const p = join(root, f); writeFileSync(p, readFileSync(p, 'utf8').replace(from2, to)); };
  sw = sw.replace(`autolab-v${cur}`, `autolab-v${next}`);
  touch('package.json', `"version": "${cur}"`, `"version": "${next}"`);
  for (const f of ['README.md', 'GUIDE.md', 'COMPONENTS.md', 'components.js', 'components.css']) touch(f, `v${cur}`, `v${next}`);
  console.log(`version ${cur} -> ${next}`);
}
writeFileSync(join(root, 'sw.js'), sw);

/* CSP: nothing external any more */
const hp = join(root, '_headers');
if (existsSync(hp)) writeFileSync(hp, readFileSync(hp, 'utf8').replace(/ https:\/\/unpkg\.com/g, ''));
console.log('done. Run: node tests/check.mjs');
