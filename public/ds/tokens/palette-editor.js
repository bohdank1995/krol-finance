/* Shared palette editing runtime.
   - holds the canonical tonal ramps
   - stores user edits in localStorage and applies them as :root overrides
   - broadcasts changes so every card (ramps + semantic roles) stays in sync
   - renders an editable ramp with a hue-wheel / hex popover */
(function () {
  const KEY = 'lms-ds.color-overrides';

  const PALETTES = {
    primary: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 98, 99, 100].map((n, i) => [n, ['#441B00', '#823400', '#C04D00', '#DF5901', '#EF6001', '#FE6A08', '#FF802D', '#FF944C', '#FEA56A', '#FEC39C', '#FFD6C1', '#FFE6DA', '#FFF1E9', '#FFF9F6'][i]]),
    secondary: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 98, 99, 100].map((n, i) => [n, ['#180B43', '#311786', '#391B9D', '#411EB1', '#4E25D5', '#6C56F2', '#8977F7', '#9D8EF9', '#B4A7FB', '#CFC7FD', '#E4DFFE', '#ECE9FF', '#F3F1FF', '#FAF9FF'][i]]),
    neutral: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 98, 99, 100].map((n, i) => [n, ['#1B1A19', '#454342', '#524F4E', '#605B5A', '#7F7B7A', '#928C8B', '#B5B1B0', '#CECBCA', '#DAD8D7', '#E7E5E4', '#EBEBEA', '#F1F0EF', '#F9F9F9', '#FEFEFE'][i]]),
  };

  /* semantic role -> palette step it aliases */
  const SEMANTIC = {
    '--primary': ['primary', 40],
    '--on-primary': ['primary', 100],
    '--primary-container': ['primary', 90],
    '--on-primary-container': ['primary', 10],
    '--surface': ['neutral', 99],
    '--surface-container-lowest': ['neutral', 100],
    '--surface-container-low': ['neutral', 98],
    '--surface-container': ['neutral', 95],
    '--surface-container-high': ['neutral', 90],
    '--surface-container-highest': ['neutral', 80],
    '--on-surface': ['neutral', 0],
    '--on-surface-variant': ['neutral', 20],
    '--on-surface-subtle': ['neutral', 40],
    '--outline': ['neutral', 70],
    '--outline-variant': ['neutral', 90],
  };

  const DEFAULTS = {};
  for (const p in PALETTES) for (const [n, c] of PALETTES[p]) DEFAULTS['--' + p + '-' + n] = c;

  /* ---------- color math ---------- */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function norm(hex) {
    hex = String(hex || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(hex)) hex = hex.split('').map(c => c + c).join('');
    return /^[0-9a-f]{6}$/i.test(hex) ? '#' + hex.toUpperCase() : null;
  }
  function toRgb(hex) { const h = parseInt(norm(hex).slice(1), 16); return [h >> 16 & 255, h >> 8 & 255, h & 255]; }
  function toHex(r, g, b) { return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('').toUpperCase(); }
  function toHsl(hex) {
    let [r, g, b] = toRgb(hex).map(v => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function fromHsl(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    const t = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h / 60) % 6];
    return toHex((t[0] + m) * 255, (t[1] + m) * 255, (t[2] + m) * 255);
  }
  const lum = hex => { const [r, g, b] = toRgb(hex).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const readable = hex => (lum(hex) > 0.45 ? '#1B1A19' : '#FFFFFF');

  /* ---------- store ---------- */
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }

  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('lms-ds-colors') : null;
  const listeners = [];

  function apply() {
    const ov = load(), rs = document.documentElement.style;
    for (const v in DEFAULTS) {
      if (ov[v]) rs.setProperty(v, ov[v]); else rs.removeProperty(v);
    }
    listeners.forEach(fn => fn(resolved()));
  }
  function resolved() { const ov = load(), out = {}; for (const v in DEFAULTS) out[v] = ov[v] || DEFAULTS[v]; return out; }
  function value(palette, step) { return resolved()['--' + palette + '-' + step]; }

  function set(palette, step, hex) {
    hex = norm(hex); if (!hex) return;
    const ov = load(), v = '--' + palette + '-' + step;
    if (hex === DEFAULTS[v]) delete ov[v]; else ov[v] = hex;
    save(ov); apply();
    if (bc) bc.postMessage({ k: KEY });
  }
  function reset(palette) {
    const ov = load();
    for (const v in ov) if (!palette || v.startsWith('--' + palette + '-')) delete ov[v];
    save(ov); apply(); if (bc) bc.postMessage({ k: KEY });
  }

  window.addEventListener('storage', e => { if (e.key === KEY) apply(); });
  if (bc) bc.onmessage = e => { if (e.data && e.data.k === KEY) apply(); };

  /* roles a given step drives */
  function rolesFor(palette, step) {
    return Object.keys(SEMANTIC).filter(r => SEMANTIC[r][0] === palette && SEMANTIC[r][1] === step);
  }

  /* ---------- picker popover ---------- */
  const CSS = `
      .pe-pop{position:fixed;z-index:99;width:216px;padding:12px;border-radius:12px;background:#FEFEFE;border:1px solid #DAD8D7;box-shadow:0 12px 32px rgba(0,0,0,.18);font-family:var(--font-caption,system-ui);display:none;flex-direction:column;gap:10px}
      .pe-pop.open{display:flex}
      .pe-head{display:flex;align-items:center;justify-content:space-between}
      .pe-name{font-family:monospace;font-size:11px;color:#524F4E}
      .pe-x{border:none;background:none;font-size:16px;line-height:1;cursor:pointer;color:#7F7B7A;padding:0 2px}
      .pe-wheelwrap{display:flex;justify-content:center}
      .pe-wheel{position:relative;width:150px;height:150px;border-radius:50%;cursor:crosshair;background:radial-gradient(circle at 50% 50%,#fff 0%,rgba(255,255,255,0) 70%),conic-gradient(from 90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)}
      .pe-shade{position:absolute;inset:0;border-radius:50%;pointer-events:none}
      .pe-dot{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.45);pointer-events:none}
      .pe-l{width:100%;height:12px;-webkit-appearance:none;appearance:none;border-radius:6px;outline:none;border:1px solid #DAD8D7}
      .pe-l::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#fff;border:1px solid #605B5A;box-shadow:0 1px 3px rgba(0,0,0,.3);cursor:pointer}
      .pe-row{display:flex;align-items:center;gap:8px}
      .pe-chip{width:26px;height:26px;border-radius:6px;border:1px solid rgba(0,0,0,.15);flex:0 0 auto}
      .pe-hex{flex:1;min-width:0;font-family:monospace;font-size:12px;padding:6px 8px;border-radius:6px;border:1px solid #DAD8D7;background:#F9F9F9;color:#1B1A19;text-transform:uppercase}
      .pe-hex:focus{outline:2px solid var(--primary-40,#EF6001);outline-offset:-1px}
      .pe-sync{font-size:10px;line-height:1.5;color:#605B5A;font-family:monospace;display:none}
      .pe-sync.on{display:block}
      .pe-reset{border:1px solid #DAD8D7;background:#F9F9F9;border-radius:6px;padding:6px;font-size:11px;font-family:inherit;color:#524F4E;cursor:pointer}
      .pe-reset:hover{background:#EBEBEA}
      .pe-sw{cursor:pointer;position:relative}
      .pe-sw.sel{box-shadow:inset 0 0 0 2px rgba(255,255,255,.9),inset 0 0 0 3px rgba(0,0,0,.35)}
      .pe-link{font-style:normal;font-size:9px;letter-spacing:.04em;text-transform:uppercase;opacity:.9;border:1px solid currentColor;border-radius:99px;padding:1px 5px;font-family:var(--font-caption,system-ui)}`;

  let pop, cssDone;
  function injectCss() {
    if (cssDone) return; cssDone = true;
    const css = document.createElement('style');
    css.textContent = CSS;
    (document.head || document.documentElement).appendChild(css);
  }
  function buildPop() {
    if (pop) return pop;
    injectCss();
    pop = document.createElement('div');
    pop.className = 'pe-pop';
    pop.innerHTML = `
      <div class="pe-head"><span class="pe-name"></span><button class="pe-x" title="Close">&times;</button></div>
      <div class="pe-wheelwrap"><div class="pe-wheel"><div class="pe-shade"></div><div class="pe-dot"></div></div></div>
      <input class="pe-l" type="range" min="0" max="100" step="1"/>
      <div class="pe-row"><span class="pe-chip"></span><input class="pe-hex" spellcheck="false" maxlength="7"/></div>
      <div class="pe-sync"></div>
      <button class="pe-reset">Reset to default</button>`;
    document.body.appendChild(pop);

    const wheel = pop.querySelector('.pe-wheel'), shade = pop.querySelector('.pe-shade'), dot = pop.querySelector('.pe-dot');
    const lSl = pop.querySelector('.pe-l'), hexIn = pop.querySelector('.pe-hex'), chip = pop.querySelector('.pe-chip');

    pop.state = { h: 0, s: 1, l: 0.5, palette: null, step: null };

    function paint(hexOverride) {
      const st = pop.state;
      if (hexOverride && norm(hexOverride)) { const c = toHsl(hexOverride); if (c[1] > 0.001) { st.h = c[0]; st.s = c[1]; } else st.s = c[1]; st.l = c[2]; }
      const hex = hexOverride || fromHsl(st.h, st.s, st.l);
      shade.style.background = st.l < 0.5 ? 'rgba(0,0,0,' + (1 - st.l * 2).toFixed(3) + ')' : 'rgba(255,255,255,' + ((st.l - 0.5) * 2).toFixed(3) + ')';
      const r = 75 * clamp(st.s, 0, 1), a = (st.h - 90) * Math.PI / 180;
      dot.style.left = (75 + r * Math.cos(a)) + 'px';
      dot.style.top = (75 + r * Math.sin(a)) + 'px';
      dot.style.background = hex;
      chip.style.background = hex;
      lSl.value = Math.round(st.l * 100);
      lSl.style.background = 'linear-gradient(90deg,#000,' + fromHsl(st.h, st.s, 0.5) + ',#fff)';
      if (document.activeElement !== hexIn) hexIn.value = hex;
      return hex;
    }
    function commit(hex) { if (pop.state.palette) set(pop.state.palette, pop.state.step, hex); }

    let dragging = false;
    function pick(e) {
      const b = wheel.getBoundingClientRect(), x = e.clientX - b.left - 75, y = e.clientY - b.top - 75;
      pop.state.h = Math.atan2(y, x) * 180 / Math.PI + 90;
      pop.state.s = clamp(Math.hypot(x, y) / 75, 0, 1);
      commit(paint());
    }
    wheel.addEventListener('pointerdown', e => { dragging = true; wheel.setPointerCapture(e.pointerId); pick(e); });
    wheel.addEventListener('pointermove', e => { if (dragging) pick(e); });
    wheel.addEventListener('pointerup', () => { dragging = false; });
    lSl.addEventListener('input', () => { pop.state.l = +lSl.value / 100; commit(paint()); });
    hexIn.addEventListener('input', () => {
      const hex = norm(hexIn.value); if (!hex) return;
      const [h, s, l] = toHsl(hex); Object.assign(pop.state, { h, s, l }); paint(hex); commit(hex);
    });
    hexIn.addEventListener('blur', () => paint());
    pop.querySelector('.pe-x').addEventListener('click', close);
    pop.querySelector('.pe-reset').addEventListener('click', () => {
      const st = pop.state, def = DEFAULTS['--' + st.palette + '-' + st.step];
      set(st.palette, st.step, def);
      const [h, s, l] = toHsl(def); Object.assign(st, { h, s, l }); paint(def);
    });
    pop.paint = paint;
    document.addEventListener('pointerdown', e => { if (pop.classList.contains('open') && !pop.contains(e.target) && !e.target.closest('.pe-sw')) close(); }, true);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    return pop;
  }

  function close() { if (pop) { pop.classList.remove('open'); document.querySelectorAll('.pe-sw.sel').forEach(el => el.classList.remove('sel')); } }

  function open(anchor, palette, step) {
    const p = buildPop(), hex = value(palette, step);
    Object.assign(p.state, { palette, step });
    const [h, s, l] = toHsl(hex); Object.assign(p.state, { h, s, l });
    p.querySelector('.pe-name').textContent = '--' + palette + '-' + step;
    const roles = rolesFor(palette, step), sync = p.querySelector('.pe-sync');
    sync.classList.toggle('on', roles.length > 0);
    sync.textContent = roles.length ? 'syncs ' + roles.join(', ') : '';
    p.classList.add('open');
    p.paint(hex);
    document.querySelectorAll('.pe-sw.sel').forEach(el => el.classList.remove('sel'));
    anchor.classList.add('sel');
    const b = anchor.getBoundingClientRect(), pb = p.getBoundingClientRect();
    let left = b.right + 8;
    if (left + pb.width > innerWidth - 6) left = Math.max(6, b.left - pb.width - 8);
    if (left + pb.width > innerWidth - 6) left = Math.max(6, innerWidth - pb.width - 6);
    p.style.left = left + 'px';
    p.style.top = clamp(b.top + b.height / 2 - pb.height / 2, 6, Math.max(6, innerHeight - pb.height - 6)) + 'px';
  }

  /* ---------- ramp renderer ---------- */
  function renderRamp(host, palette) {
    host.innerHTML = PALETTES[palette].map(([n]) =>
      `<div class="sw pe-sw" data-step="${n}" title="Click to edit"><b>--${palette}-${n}</b><i class="pe-tag"></i><span></span></div>`).join('');
    const rows = [...host.querySelectorAll('.pe-sw')];
    rows.forEach(row => {
      const step = +row.dataset.step;
      row.addEventListener('click', () => open(row, palette, step));
      const roles = rolesFor(palette, step);
      if (roles.length) { const t = row.querySelector('.pe-tag'); t.className = 'pe-tag pe-link'; t.textContent = roles[0].replace(/^--/, ''); }
    });
    function refresh(vals) {
      rows.forEach(row => {
        const hex = vals['--' + palette + '-' + row.dataset.step];
        row.style.background = hex;
        row.style.color = readable(hex);
        row.querySelector('span').textContent = hex;
      });
      if (pop && pop.classList.contains('open') && pop.state.palette === palette) pop.paint(vals['--' + palette + '-' + pop.state.step]);
    }
    listeners.push(refresh);
    refresh(resolved());
  }

  function onChange(fn) { listeners.push(fn); fn(resolved()); }

  injectCss();
  apply();
  window.PaletteEditor = { PALETTES, SEMANTIC, DEFAULTS, renderRamp, onChange, value, set, reset, resolved, readable, norm };
})();
