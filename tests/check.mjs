// Release smoke test: node tests/check.mjs  (no dependencies)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
let fails = 0;
const fail = (m) => { console.error('FAIL', m); fails++; };
/* module families that live in their own folder (checked exactly like the root files; paths are relative to the repo root) */
const SUBDIRS = ['Wheel alignment'];
const inSub = (re) => SUBDIRS.flatMap((d) => readdirSync(root + d).filter((f) => re.test(f)).map((f) => d + '/' + f));
const html = readdirSync(root).filter((f) => f.endsWith('.html')).concat(inSub(/\.html$/));
const sw = readFileSync(root + 'sw.js', 'utf8');
const tmp = mkdtempSync(join(tmpdir(), 'al-'));

for (const f of html) {
  const s = readFileSync(root + f, 'utf8');
  if (!/name="viewport"/.test(s)) fail(`${f}: no viewport`);
  if (/user-scalable=no|maximum-scale=1/.test(s)) fail(`${f}: blocks zoom`);
  if (f !== 'index.html' && f !== '404.html' && /type="importmap"/.test(s) && !/guard\.js/.test(s)) fail(`${f}: missing guard.js`);
  if (f !== '404.html' && !sw.includes(`'./${f}'`)) fail(`${f}: not precached in sw.js`);
  for (const r of s.matchAll(/(?:src|href)="(?!https?:|#|data:|mailto:)([^"?#]+)"/g))
    if (!existsSync(join(root, dirname(f), r[1]))) fail(`${f}: missing ${r[1]}`);
  [...s.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].forEach((m, i) => {
    const p = join(tmp, `${f.replace(/\//g, "__")}.${i}.mjs`); writeFileSync(p, m[1]);
    try { execFileSync('node', ['--check', p], { stdio: 'pipe' }); } catch (e) { fail(`${f}: syntax error in module script ${i}`); }
  });
}
for (const f of ['kit.js', 'labels.js', 'components.js', 'modules.js', 'guard.js', 'sw.js', 'controls-core.js', 'chrome.js', 'keys.js', 'dock.js', 'monitor-core.js', 'monitor.js']) {
  try { execFileSync('node', ['--check', root + f], { stdio: 'pipe' }); } catch (e) { fail(`${f}: syntax error`); }
}
JSON.parse(readFileSync(root + 'manifest.webmanifest', 'utf8'));
const reg = readFileSync(root + 'modules.js', 'utf8');
for (const m of reg.matchAll(/"file": "([^"]+)"/g)) if (!existsSync(root + m[1])) fail(`modules.js: missing ${m[1]}`);
const ids = [...reg.matchAll(/"id": "([^"]+)", "label"/g)].map((m) => m[1]);
if (new Set(ids).size !== ids.length) fail('duplicate module ids');
/* ── Phase 8: the Phase 0 advisory rules are now FAIL rules (R-numbers refer to the hard rules in the prompt pack) ── */
const coreBlock = (sw.match(/const CORE_ASSETS = \[([\s\S]*?)\n\];/) || [, ''])[1];
const precached = new Set([...coreBlock.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]));
const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
/* Files allowed to build <button> / <select> / <input type=range> markup, and why (everything else must use a controls.js spec). */
const CONTROL_OWNERS = new Set(['controls.js', 'chrome.js', 'dock.js', 'monitor.js']);
const CONTROL_OK = [
  [/^guard\.js$/, 'guard.js is a standalone script (no modules, no kit): its WebGL-error overlay has one Retry button'],
  [/^(index|404)\.html$/, 'the shell (index.html) owns the module cards, search and install UI; 404.html is a standalone page']
];
const CONTROL_RE = /<(button|select)\b|type\s*=\s*["']range["']|type\s*=\s*['"]?range|createElement\(\s*['"`](button|select)['"`]\s*\)|createElement\(\s*['"`]input['"`]\s*\)/;
/* (0) every file that exists is precached (task 4) */
for (const f of readdirSync(root).concat(inSub(/\.(js|css|html)$/))) {
  if (!/\.(js|css|html)$/.test(f) || f === 'sw.js' || f === '404.html') continue;
  if (!precached.has(f)) fail(`${f}: exists but is not listed in sw.js CORE_ASSETS`);
}
for (const f of precached) if (f && !existsSync(root + f)) fail(`sw.js CORE_ASSETS lists ${f} but it does not exist`);
if ((sw.match(/\bconst VERSION\s*=/g) || []).length !== 1) fail('sw.js must define exactly one VERSION constant');
/* (v) one version everywhere: README, GUIDE, COMPONENTS and the components.js / components.css headers carry the sw.js VERSION number */
const verNum = (sw.match(/const VERSION\s*=\s*'autolab-v([\d.]+)'/) || [, ''])[1];
if (!verNum) fail('sw.js: VERSION is not autolab-v<number>');
for (const [f, re] of [['README.md', /^# AutoLab2 \(Auto Lab v([\d.]+)\)/m], ['GUIDE.md', /Auto Lab v([\d.]+)/], ['COMPONENTS.md', /Auto Lab v([\d.]+)/], ['components.js', /\(v([\d.]+)\)/], ['components.css', /\(v([\d.]+)\)/]]) {
  const m = readFileSync(root + f, 'utf8').match(re);
  if (!m) fail(`${f}: no version string (expected "v${verNum}")`); else if (m[1] !== verNum) fail(`${f}: says v${m[1]} but sw.js is v${verNum}`);
}
const hexCounts = [];
const jsFiles = readdirSync(root).filter((f) => f.endsWith('.js') && f !== 'sw.js').concat(inSub(/\.js$/));
for (const f of html) {
  const s = readFileSync(root + f, 'utf8');
  const code = stripComments(s.replace(/<style[\s\S]*?<\/style>/g, ''));
  /* (a) every local .js/.css referenced by an HTML page is precached */
  const refs = new Set();
  for (const r of s.matchAll(/(?:src|href)="(?!https?:|#|data:|mailto:)([^"?#]+\.(?:js|css))"/g)) refs.add(join(dirname(f), r[1]));      /* relative to the page's own folder */
  for (const r of s.matchAll(/from\s+['"](\.{1,2}\/[^'"]+\.js)['"]/g)) refs.add(join(dirname(f), r[1]));
  for (const r of refs) if (!precached.has(r)) fail(`${f}: ${r} is not in sw.js CORE_ASSETS`);
  /* (b) duplicate static id="…" inside one page */
  const seen = new Map();
  for (const m of s.matchAll(/\sid="([^"]+)"/g)) seen.set(m[1], (seen.get(m[1]) || 0) + 1);
  const dups = [...seen].filter(([, c]) => c > 1).map(([id]) => id);
  if (dups.length) fail(`${f}: duplicate id(s): ${dups.join(', ')}`);
  /* (c) module pages must not define the kit's own control ids */
  if (f !== 'index.html' && f !== '404.html') {
    for (const id of ['btn-play', 'btn-reset', 'speed', 'toolbar-extras']) if (seen.has(id)) fail(`${f}: defines id="${id}" (owned by the kit/dock)`);
    if (/getElementById\(\s*['"]toolbar-extras['"]\s*\)|#toolbar-extras/.test(code)) fail(`${f}: writes into #toolbar-extras (retired: use options:[...])`);
  }
  /* (e) no hand-built controls: range / select / button markup or createElement outside controls.js / chrome.js / dock.js / monitor.js */
  if (!CONTROL_OK.some(([re]) => re.test(f))) {
    for (const l of code.split('\n')) {
      if (CONTROL_RE.test(l)) { fail(`${f}: builds its own control (use options:[...] / axes): ${l.trim().slice(0, 80)}`); break; }
    }
  }
  if (/from\s+['"]\.\/(kit|components)\.js['"]/.test(s)) {
    if (/extras:\s*\[\s*\{/.test(code)) fail(`${f}: toolbar extras are retired — use options:[...]`);
    if (/window\.__\w*Sync\w*\s*=/.test(code)) fail(`${f}: window.__*Sync* hook (the kit syncs the play icons)`);
    if (/window\.__\w+/.test(code)) fail(`${f}: window.__* global (Phase 8 removed every hook)`);
    /* global: a chart (canvas / svg) never lives inside a widgets / readout / panel template string */
    for (const m of code.matchAll(/(?:overview|faults|quiz|widgets|readout|panel)[\w.]*\s*[:=]\s*(?:\(\)\s*=>\s*)?`([\s\S]*?)`/g))
      if (/<canvas\b|<svg\b/.test(m[1])) fail(`${f}: <canvas>/<svg> chart inside a panel/widget template (use ui.stage.canvas or a Monitor trace)`);
    /* global: nobody writes the Monitor root (rows / traces / footer go through ui.monitor.set / update) */
    if (/monitor\.root\s*(\.(innerHTML|textContent|style|classList|append\w*|insert\w*|replace\w*|remove\w*)|\s*=[^=])/.test(code)) fail(`${f}: writes ui.monitor.root (use ui.monitor.set / update)`);
    /* global: ui.stage canvases never sit in the dock, panel or Monitor */
    if (/(?:dock|panel|monitor)[\w.]*\.(?:appendChild|append|prepend)\(\s*[\w.]*stage[\w.]*canvas/.test(code)) fail(`${f}: a ui.stage canvas is appended into the dock / panel / Monitor`);
  }
  /* (d) hard-coded colours inside <style> are FAIL outside tokens; --al-accent declarations are the per-module accent and are allowed.
         404.html is a standalone page that loads no stylesheet, so it cannot use tokens. */
  if (f !== '404.html') {
    const styles = [...s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
    for (const l of styles.split('\n')) {
      if (/--al-accent\s*:/.test(l)) continue;
      if (/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(l.replace(/#[a-zA-Z_][\w-]*\s*[{,.:\[>]/g, ''))) { hexCounts.push(f); fail(`${f}: hard-coded colour in <style> (use a token): ${l.trim().slice(0, 80)}`); break; }
    }
  }
}
/* the same control rule for the shared scripts: only the four owners may build controls */
for (const f of jsFiles) {
  if (CONTROL_OWNERS.has(f) || CONTROL_OK.some(([re]) => re.test(f))) continue;
  const code = stripComments(readFileSync(root + f, 'utf8'));
  for (const l of code.split('\n')) if (CONTROL_RE.test(l)) { fail(`${f}: builds its own control outside controls.js / chrome.js / dock.js / monitor.js: ${l.trim().slice(0, 80)}`); break; }
  if (/window\.__\w+/.test(code)) fail(`${f}: window.__* global`);
}
/* ── Phase 8.5: keep the tree clean ─────────────────────────────────────────────────────────────
   (1) no stray files: only the allowlisted names may sit in the root, tests/ and icons/
   (2) no console.log / debug / info and no debugger statement in shipped code (console.warn / error are real diagnostics)
   (3) no dead code: a top-level function / const that is declared and never referenced again in its own script */
const ROOT_FILES = new Set(['404.html', '_headers', 'robots.txt', 'manifest.webmanifest', 'package.json', 'sw.js', 'README.md', 'GUIDE.md', 'COMPONENTS.md', 'CHANGELOG.md', 'MONITOR-MAP.md', 'QA.md', 'POLISH.md']);
for (const f of readdirSync(root, { withFileTypes: true })) {
  if (f.name.startsWith('.') || f.name === 'node_modules') continue;
  if (f.isDirectory()) { if (!['tests', 'icons', ...SUBDIRS].includes(f.name)) fail(`stray directory: ${f.name}/`); continue; }
  if (!/\.(html|js|css)$/.test(f.name) && !ROOT_FILES.has(f.name)) fail(`stray file in the root: ${f.name} (logs, scratch and process notes do not ship)`);
}
for (const f of readdirSync(root + 'tests')) if (!/\.(test\.)?mjs$/.test(f)) fail(`stray file in tests/: ${f}`);
for (const f of readdirSync(root + 'icons')) if (!/\.(png|svg)$/.test(f)) fail(`stray file in icons/: ${f}`);
const shipped = [...jsFiles.filter((f) => f !== 'sw.js').map((f) => [f, readFileSync(root + f, 'utf8')]),
  ...html.map((f) => [f, [...readFileSync(root + f, 'utf8').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n')])];
for (const [f, src] of shipped) {
  const code = stripComments(src);
  if (/\bconsole\.(log|debug|info|trace|dir)\s*\(/.test(code)) fail(`${f}: console.log/debug/info left in shipped code`);
  if (/\bdebugger\b\s*;?/.test(code)) fail(`${f}: debugger statement`);
  const names = new Set();
  for (const m of code.matchAll(/(?:^|[\s;{(])(?:function\s*\*?\s+([A-Za-z_$][\w$]*)\s*\(|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=)/g)) names.add(m[1] || m[2]);
  for (const n of names) {
    const refs = code.match(new RegExp('(?<![\\w$])' + n.replace(/\$/g, '\\$') + '(?![\\w$])', 'g')) || [];
    if (refs.length === 1 && !new RegExp('export\\s+(?:async\\s+)?(?:function|const|let)\\s+' + n.replace(/\$/g, '\\$') + '\\b').test(code)) fail(`${f}: dead code — \`${n}\` is declared and never used`);
  }
}
console.log(fails ? `\n${fails} problem(s)` : `OK — ${html.length} pages, ${ids.length} modules checked`);
process.exit(fails ? 1 : 0);
