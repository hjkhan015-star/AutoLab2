/* ═══════════════════════════════════════════════════════════════════════
   keys.js — the ONE keymap (R5), shared by the shell and every module.

     Space  play / pause        R  reset            D  label density
     L      theme               W  wireframe        X  x-ray
     Esc    close menu / back
     ↑ ↓ ← → Shift              module-local (controls handle these themselves)

   Ownership (R6): each key has exactly one owner. The side that owns a key
   handles it; the other side FORWARDS it (postMessage, type:'key') and never
   handles it twice.

       shell-owned   : theme, wireframe, xray, close
       module-owned  : togglePlay, reset, labelDensity

   A standalone module (no shell above it) owns everything.

   Pure functions are unit-tested in node (tests/keys.test.mjs); the DOM
   installer at the bottom is a thin wrapper. No dependencies except
   controls-core.js.
   ═══════════════════════════════════════════════════════════════════════ */
import { globalKeyAction } from './controls-core.js';

export const SHELL_OWNED  = Object.freeze(['theme', 'wireframe', 'xray', 'close']);
export const MODULE_OWNED = Object.freeze(['togglePlay', 'reset', 'labelDensity']);

export function ownerOf(action) {
  if (SHELL_OWNED.includes(action)) return 'shell';
  if (MODULE_OWNED.includes(action)) return 'module';
  return null;
}

/* Targets where typing or native activation must win over a global key. */
const TYPING = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
/* Space on these means "activate me", not "play/pause" (focusable custom widgets handle their own keys). */
const ACTIVATABLE = 'button, a[href], summary, [role="button"], [role="slider"], [role="switch"], [role="radio"], [role="checkbox"], [role="menuitem"], [tabindex]:not([tabindex="-1"])';

function matches(target, sel) {
  try { return !!(target && typeof target.closest === 'function' && target.closest(sel)); }
  catch (_) { return false; }
}

/** Map a keyboard event to an action name, or null when it is not ours. */
export function resolveKey(ev) {
  if (!ev || ev.ctrlKey || ev.metaKey || ev.altKey) return null;   /* never steal browser shortcuts */
  if (ev.repeat) return null;                                      /* toggles must not auto-repeat  */
  const action = globalKeyAction(ev.key);
  if (!action) return null;
  if (matches(ev.target, TYPING)) return null;
  if (action === 'togglePlay' && matches(ev.target, ACTIVATABLE)) return null;
  return action;
}

/**
 * Router for one side of the shell/module boundary.
 *   owns(action)            → true when THIS side handles the action
 *   handle(action, event)   → performs it
 *   forward(action)         → sends it to the other side (only when !owns)
 * Returns the keydown listener. `incoming(action)` is for actions forwarded
 * FROM the other side: it handles them directly and never re-forwards.
 */
export function createKeyRouter({ owns, handle, forward }) {
  function onKeyDown(ev) {
    const action = resolveKey(ev);
    if (!action) return false;
    if (action === 'togglePlay' && typeof ev.preventDefault === 'function') ev.preventDefault(); /* no page scroll */
    if (owns(action)) handle(action, ev);
    else if (typeof forward === 'function') forward(action);
    return true;
  }
  function incoming(action) {
    if (!owns(action)) return false;       /* ignore anything not ours (no ping-pong) */
    handle(action, null);
    return true;
  }
  return { onKeyDown, incoming };
}

/** Attach the listener to a window. Returns an uninstall function. */
export function installKeys(win, router) {
  win.addEventListener('keydown', router.onKeyDown);
  return () => win.removeEventListener('keydown', router.onKeyDown);
}
