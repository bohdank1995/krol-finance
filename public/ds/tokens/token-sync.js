/* LMS Collaborato — shared token runtime.
   ONE applier for every card, component preview and template:
     - reads user token overrides from localStorage
     - writes them as :root custom properties on this document
     - re-applies live when any other card changes a token
       (BroadcastChannel + storage events)
   Every token consumer (typestyles, components, widgets) resolves through
   var(--token), so applying the override here updates the whole system.
   Load this in the <head> of every card. Colors keep their own editor UI
   (tokens/palette-editor.js); this file owns the typeface store. */
(function () {
  const FONT_KEY = 'lms-ds.font-overrides';
  const COLOR_KEY = 'lms-ds.color-overrides';
  const LEGACY_FONT_KEY = 'lmsc-typeface-tokens';

  const FALLBACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif';
  const FAMILIES = ['Roboto', 'Inter', 'Manrope', 'IBM Plex Sans', 'Space Grotesk', 'Source Serif 4'];
  const ROLES = ['brand', 'plain'];
  const FONT_DEFAULTS = { brand: 'Roboto', plain: 'Roboto' };

  const read = k => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } };
  const write = (k, o) => { try { localStorage.setItem(k, JSON.stringify(o)); } catch (e) {} };

  /* one-time migration from the old per-card font store */
  (function migrate() {
    if (localStorage.getItem(FONT_KEY)) return;
    const old = read(LEGACY_FONT_KEY), out = {};
    for (const r of ROLES) if (old[r] && old[r] !== FONT_DEFAULTS[r]) out[r] = old[r];
    if (Object.keys(out).length) write(FONT_KEY, out);
  })();

  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('lms-ds-tokens') : null;
  const colorBc = 'BroadcastChannel' in window ? new BroadcastChannel('lms-ds-colors') : null;
  const listeners = [];
  let applied = [];

  function fonts() {
    const ov = read(FONT_KEY), out = {};
    for (const r of ROLES) out[r] = FAMILIES.includes(ov[r]) ? ov[r] : FONT_DEFAULTS[r];
    return out;
  }
  function colors() { return read(COLOR_KEY); }

  function vars() {
    const map = {}, f = fonts(), ov = read(FONT_KEY);
    for (const r of ROLES) if (ov[r] && f[r] !== FONT_DEFAULTS[r]) map['--font-' + r] = '"' + f[r] + '", ' + FALLBACK;
    const c = colors();
    for (const v in c) if (/^--[\w-]+$/.test(v)) map[v] = c[v];
    return map;
  }

  function apply() {
    const map = vars(), rs = document.documentElement.style;
    for (const v of applied) if (!(v in map)) rs.removeProperty(v);
    for (const v in map) rs.setProperty(v, map[v]);
    applied = Object.keys(map);
    const snap = { fonts: fonts(), colors: colors(), vars: map };
    listeners.forEach(fn => { try { fn(snap); } catch (e) {} });
  }

  function broadcast() { if (bc) bc.postMessage({ k: FONT_KEY }); }

  function setFont(role, family) {
    if (!ROLES.includes(role) || !FAMILIES.includes(family)) return;
    const ov = read(FONT_KEY);
    if (family === FONT_DEFAULTS[role]) delete ov[role]; else ov[role] = family;
    write(FONT_KEY, ov); apply(); broadcast();
  }
  function resetFonts() { write(FONT_KEY, {}); apply(); broadcast(); }

  window.addEventListener('storage', e => { if (!e.key || e.key === FONT_KEY || e.key === COLOR_KEY) apply(); });
  if (bc) bc.onmessage = apply;
  if (colorBc) colorBc.onmessage = apply;

  function onChange(fn) { listeners.push(fn); fn({ fonts: fonts(), colors: colors(), vars: vars() }); }

  apply();
  window.TokenSync = { FAMILIES, ROLES, FALLBACK, FONT_DEFAULTS, fonts, colors, setFont, resetFonts, onChange, apply };
})();
