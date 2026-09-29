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
for (const f of ['kit.js', 'labels.js', 'components.js', 'modules.js', 'guard.js', 'sw.js']) {
  try { execFileSync('node', ['--check', root + f], { stdio: 'pipe' }); } catch (e) { fail(`${f}: syntax error`); }
}
JSON.parse(readFileSync(root + 'manifest.webmanifest', 'utf8'));
const reg = readFileSync(root + 'modules.js', 'utf8');
for (const m of reg.matchAll(/"file": "([^"]+)"/g)) if (!existsSync(root + m[1])) fail(`modules.js: missing ${m[1]}`);
const ids = [...reg.matchAll(/"id": "([^"]+)", "label"/g)].map((m) => m[1]);
if (new Set(ids).size !== ids.length) fail('duplicate module ids');
console.log(fails ? `\n${fails} problem(s)` : `OK — ${html.length} pages, ${ids.length} modules checked`);
process.exit(fails ? 1 : 0);
