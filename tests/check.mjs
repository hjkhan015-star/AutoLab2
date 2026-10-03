// Release smoke test: node tests/check.mjs  (no dependencies)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
let fails = 0;
const fail = (m) => { console.error('FAIL', m); fails++; };
const html = readdirSync(root).filter((f) => f.endsWith('.html'));
const sw = readFileSync(root + 'sw.js', 'utf8');
const tmp = mkdtempSync(join(tmpdir(), 'al-'));

for (const f of html) {
  const s = readFileSync(root + f, 'utf8');
  if (!/name="viewport"/.test(s)) fail(`${f}: no viewport`);
  if (/user-scalable=no|maximum-scale=1/.test(s)) fail(`${f}: blocks zoom`);
  if (f !== 'index.html' && f !== '404.html' && /type="importmap"/.test(s) && !/guard\.js/.test(s)) fail(`${f}: missing guard.js`);
  if (f !== '404.html' && !sw.includes(`'./${f}'`)) fail(`${f}: not precached in sw.js`);
  for (const r of s.matchAll(/(?:src|href)="(?!https?:|#|data:|mailto:)([^"?#]+)"/g))
    if (!existsSync(root + r[1])) fail(`${f}: missing ${r[1]}`);
  [...s.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].forEach((m, i) => {
    const p = join(tmp, `${f}.${i}.mjs`); writeFileSync(p, m[1]);
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
/* ── Phase 0 advisory rules: print WARN, never fail (become FAIL in Phase 8) ── */
let warns = 0;
const warn = (m) => { console.warn('WARN', m); warns++; };
const coreBlock = (sw.match(/const CORE_ASSETS = \[([\s\S]*?)\n\];/) || [, ''])[1];
const precached = new Set([...coreBlock.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]));
/* Phase 6.5 (D6-8): lines allowed to contain <button / <select / <input on a kit page, and why. Not controls — content. */
const AUTHORED_OK = [
  [/class="al-opt"|al-opt/, 'quiz option buttons (components.js Widgets.wireQuiz owns the behaviour)'],
  [/data-quiz|quiz/, 'quiz markup'],
  [/tq-toggle/, 'gearbox torque-chart collapse chevron (panel chrome, not a control); revisit in Phase 7b']
];
const hexCounts = [];
for (const f of html) {
  const s = readFileSync(root + f, 'utf8');
  /* (a) every local .js/.css referenced by an HTML page is precached */
  const refs = new Set();
  for (const r of s.matchAll(/(?:src|href)="(?!https?:|#|data:|mailto:)\.?\/?([^"?#]+\.(?:js|css))"/g)) refs.add(r[1]);
  for (const r of s.matchAll(/from\s+['"]\.\/([^'"]+\.js)['"]/g)) refs.add(r[1]);
  for (const r of refs) if (!precached.has(r)) warn(`${f}: ${r} is not in sw.js CORE_ASSETS`);
  /* (b) duplicate static id="…" inside one page */
  const seen = new Map();
  for (const m of s.matchAll(/\sid="([^"]+)"/g)) seen.set(m[1], (seen.get(m[1]) || 0) + 1);
  const dups = [...seen].filter(([, c]) => c > 1).map(([id]) => id);
  if (dups.length) warn(`${f}: duplicate id(s): ${dups.join(', ')}`);
  /* (c) module pages must not define the kit's own control ids */
  if (f !== 'index.html' && f !== '404.html')
    for (const id of ['btn-play', 'btn-reset', 'speed']) if (seen.has(id)) warn(`${f}: defines id="${id}" (owned by the kit/dock)`);
  /* (e) Phase 6 / 6.5: kit modules author NO interactive controls of their own — they use options:[choice|toggle|action].
         EXCLUSIONS (explicit, with reasons) live in AUTHORED_OK below; anything else on a kit page is a WARN. */
  if (/from\s+['"]\.\/(kit|components)\.js['"]/.test(s)) {
    const code = s.replace(/<style[\s\S]*?<\/style>/g, '');
    for (const l of code.split('\n')) {
      if (/^\s*(\/\/|\/\*|\*)/.test(l) || AUTHORED_OK.some(([re]) => re.test(l))) continue;
      if (/<(button|select|input)\b|createElement\(['"`](button|select|input)['"`]\)/.test(l)) { warn(`${f}: authors its own control (use options:[...]): ${l.trim().slice(0, 70)}`); break; }
    }
    if (/extras:\s*\[\s*\{/.test(code)) warn(`${f}: toolbar extras are retired — use options:[...]`);
    if (/window\.__\w*Sync\w*\s*=/.test(code)) warn(`${f}: window.__*Sync* hook (the kit syncs the play icons)`);
  }
  /* (d) hard-coded colours inside <style> (report only) */
  const styles = [...s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  const c = (styles.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) || []).length;
  if (c) hexCounts.push([f, c]);
}
if (hexCounts.length) {
  hexCounts.sort((a, b) => b[1] - a[1]);
  const total = hexCounts.reduce((a, [, c]) => a + c, 0);
  console.log(`INFO hard-coded hex/rgba in <style>: ${total} across ${hexCounts.length} pages; top: ` +
    hexCounts.slice(0, 5).map(([f, c]) => `${f}=${c}`).join(', '));
}
if (warns) console.warn(`${warns} advisory warning(s) (not failing yet)`);
console.log(fails ? `\n${fails} problem(s)` : `OK — ${html.length} pages, ${ids.length} modules checked`);
process.exit(fails ? 1 : 0);
