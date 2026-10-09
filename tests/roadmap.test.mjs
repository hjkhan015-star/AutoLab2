// Roadmap / registry test: node tests/roadmap.test.mjs  (no dependencies)
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
globalThis.window = globalThis;
new Function(readFileSync(root + 'modules.js', 'utf8'))();
const { AUTO_SYSTEMS: SYS, AUTO_MODULES: MODS, AUTO_ROADMAP: RM, AUTO_DOMAINS: DOM } = globalThis;
let n = 0;
const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error('FAIL', name, '-', e.message); process.exitCode = 1; } };
const ids = MODS.map((m) => m.id);

t('module ids are unique and every file exists', () => {
  assert.equal(new Set(ids).size, ids.length);
  MODS.forEach((m) => assert.ok(existsSync(root + m.file), m.file));
});
t('five domains and 18 systems, every system has a domain and at least one module', () => {
  assert.equal(DOM.length, 5); assert.equal(SYS.length, 18);
  SYS.forEach((s) => { assert.ok(DOM.includes(s.domain), s.id); assert.ok(s.modules.length > 0, s.id); });
});
t('every module belongs to exactly one system', () => {
  const all = SYS.flatMap((s) => s.modules);
  assert.equal(all.length, new Set(all).size); assert.deepEqual([...all].sort(), [...ids].sort());
});
t('related systems and flow links point at real ids', () => {
  const sys = new Set(SYS.map((s) => s.id));
  SYS.forEach((s) => {
    s.related.forEach((r) => assert.ok(sys.has(r), `${s.id} related ${r}`));
    s.flow.forEach((f) => { const p = f.split('|')[1]; if (p) assert.ok(ids.includes(p), `${s.id} flow ${p}`); });
  });
});
t('roadmap: every module is in exactly one stage, nothing unknown', () => {
  const all = RM.flatMap((s) => s.ids);
  assert.equal(all.length, new Set(all).size, 'a module is in two stages');
  assert.deepEqual([...all].sort(), [...ids].sort());
});
t('roadmap stages are complete (title, question, why, checkpoint)', () => {
  RM.forEach((s) => ['title', 'ask', 'why', 'check'].forEach((k) => assert.ok(s[k] && s[k].length > 8, `${s.id}.${k}`)));
  assert.equal(new Set(RM.map((s) => s.id)).size, RM.length);
});
t('roadmap teaches Basic modules before Advanced ones in each stage group start', () => {
  const lvl = (id) => MODS.find((m) => m.id === id).level;
  assert.equal(lvl(RM[0].ids[0]), 'Basic');
  assert.ok(RM[RM.length - 1].ids.every((i) => lvl(i) !== 'Basic'), 'last stage is the advanced level-up');
});
t('the shell has three views and the Systems toggle sits between Modules and Roadmap', () => {
  const html = readFileSync(root + 'index.html', 'utf8');
  const order = [...html.matchAll(/data-view="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ['modules', 'systems', 'roadmap']);
});
t('new pages use the shared runtime and no hand-built controls', () => {
  ['bodyframe', 'crumple', 'restraints', 'traction', 'accycle', 'hvacflow', 'headunit', 'gpsnav'].forEach((f) => {
    const s = readFileSync(root + f + '.html', 'utf8');
    assert.match(s, /runGuidedModule/); assert.doesNotMatch(s, /<button|type="range"|localStorage/);
    assert.match(s, /"quiz"/); assert.match(s, /"faults"/);
  });
});
console.log(process.exitCode ? 'roadmap tests FAILED' : `roadmap tests: ${n} groups ok`);
