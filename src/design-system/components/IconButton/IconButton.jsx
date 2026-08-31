/* IconButton — 32×32 icon-only button. Geometry via Tailwind px classes
   (h-8 w-8 rounded-full); every color/shadow resolves through var(--token),
   state colors come from the semantic aliases in tokens/colors.css.
   Glyph is 16×16 (--icon-size-s). */
import { Icon } from '../Icon/Icon.jsx';

const ICON_BUTTON_CSS = `
.lmsc-iconbtn{border:none;cursor:pointer;box-shadow:none;transition:background 120ms ease,box-shadow 120ms ease,color 120ms ease}
.lmsc-iconbtn[data-variant="primary"]{background:var(--primary);color:var(--icon-on-primary)}
.lmsc-iconbtn[data-variant="primary"][data-state="hover"],.lmsc-iconbtn[data-variant="primary"]:not([data-state="disabled"]):not(:disabled):hover{background:var(--primary-hover)}
.lmsc-iconbtn[data-variant="primary"][data-state="pressed"],.lmsc-iconbtn[data-variant="primary"]:not([data-state="disabled"]):not(:disabled):active{background:var(--primary-pressed);box-shadow:var(--shadow-inset-pressed)}
.lmsc-iconbtn[data-variant="tonal"]{background:var(--surface-container);color:var(--icon)}
.lmsc-iconbtn[data-variant="tonal"][data-state="hover"],.lmsc-iconbtn[data-variant="tonal"]:not([data-state="disabled"]):not(:disabled):hover{background:var(--surface-container-high);color:var(--icon-strong)}
.lmsc-iconbtn[data-variant="tonal"][data-state="pressed"],.lmsc-iconbtn[data-variant="tonal"]:not([data-state="disabled"]):not(:disabled):active{background:var(--surface-container-highest);color:var(--icon-strong);box-shadow:var(--shadow-inset-pressed)}
.lmsc-iconbtn[data-state="disabled"],.lmsc-iconbtn:disabled{background:var(--surface-container-low);color:var(--icon-disabled);box-shadow:none;cursor:not-allowed}
`;

function ensureIconButtonCss() {
  if (typeof document === 'undefined' || document.getElementById('lmsc-iconbtn-css')) return;
  const el = document.createElement('style');
  el.id = 'lmsc-iconbtn-css';
  el.textContent = ICON_BUTTON_CSS;
  document.head.appendChild(el);
}

export function IconButton({ icon = 'arrow-left', variant = 'primary', state = 'default', size = 'm', label = 'Back', ...rest }) {
  ensureIconButtonCss();
  const disabled = state === 'disabled';
  return (
    <button type="button" aria-label={label} disabled={disabled} data-variant={variant} data-state={state} data-size={size} className={'lmsc-iconbtn inline-flex h-8 w-8 shrink-0 items-center justify-center p-1.5 rounded-full' + (disabled ? ' opacity-60' : '')} {...rest}>
      <Icon name={icon} size="s" color="currentColor" />
    </button>
  );
}
