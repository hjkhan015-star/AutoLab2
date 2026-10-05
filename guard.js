/* Auto Lab v4 — load guard (classic script, must run before module scripts).
   Shows a readable message instead of a blank canvas when WebGL is missing
   or the 3D library fails to load (offline first visit, blocked CDN). */
(function () {
  'use strict';
  var shown = false;
  function show(title, detail) {
    if (shown || !document.body) return;
    shown = true;
    var box = document.createElement('div');
    box.setAttribute('role', 'alert');
    box.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;background:#0a0d13;color:#e6edf6;font:16px/1.5 system-ui,sans-serif;text-align:center';
    var inner = document.createElement('div');
    inner.style.maxWidth = '420px';
    var h = document.createElement('h1'); h.textContent = title; h.style.cssText = 'font-size:20px;margin:0 0 8px';
    var p = document.createElement('p'); p.textContent = detail; p.style.cssText = 'margin:0 0 16px;opacity:.8';
    var b = document.createElement('button'); b.textContent = 'Try again';
    b.style.cssText = 'padding:10px 20px;border:0;border-radius:10px;background:#38bdf8;color:#0a0d13;font:600 15px system-ui;cursor:pointer';
    b.onclick = function () { location.reload(); };
    inner.appendChild(h); inner.appendChild(p); inner.appendChild(b);
    box.appendChild(inner); document.body.appendChild(box);
  }
  function hasWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (_) { return false; }
  }
  function check() {
    /* <html data-no3d>: a 2D page that only borrows the kit's chrome (sensors.html) does not need WebGL */
    if (document.documentElement.hasAttribute('data-no3d')) return;
    if (!hasWebGL()) show('3D not available', 'This module needs WebGL. Enable hardware acceleration or try another browser.');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', check); else check();
  window.addEventListener('error', function (e) {
    var m = String((e && e.message) || '');
    if (/Failed to (fetch|resolve)|dynamically imported|module script|Importing a module/i.test(m))
      show('Couldn\u2019t load 3D engine', 'Check your connection and try again. Once loaded, Auto Lab works offline.');
  });
  window.addEventListener('unhandledrejection', function (e) {
    var m = String((e && e.reason && e.reason.message) || e.reason || '');
    if (/Failed to fetch|dynamically imported|Importing a module/i.test(m))
      show('Couldn\u2019t load 3D engine', 'Check your connection and try again. Once loaded, Auto Lab works offline.');
  });
})();
