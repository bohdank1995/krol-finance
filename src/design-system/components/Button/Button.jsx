/* Button — all values resolve through var(--token); state colors come from the
   semantic aliases in tokens/colors.css (palette step → semantic token → component).
   The state CSS ships with the component (injected once) so the states render
   anywhere the bundle is loaded, not only where styles.css is linked. */
const BUTTON_CSS = `
.lmsc-btn{border:none;cursor:pointer;box-shadow:none;transition:background 120ms ease,box-shadow 120ms ease}
.lmsc-btn[data-variant="primary"]{background:var(--primary)}
.lmsc-btn[data-variant="primary"] .lmsc-btn__label{color:var(--on-primary)}
.lmsc-btn[data-variant="primary"][data-state="hover"],.lmsc-btn[data-variant="primary"]:not([data-state="disabled"]):not(:disabled):hover{background:var(--primary-hover)}
.lmsc-btn[data-variant="primary"][data-state="pressed"],.lmsc-btn[data-variant="primary"]:not([data-state="disabled"]):not(:disabled):active{background:var(--primary-pressed);box-shadow:var(--shadow-inset-pressed)}
.lmsc-btn[data-variant="tonal"]{background:var(--surface-container)}
.lmsc-btn[data-variant="tonal"] .lmsc-btn__label{color:var(--on-surface-variant)}
.lmsc-btn[data-variant="tonal"][data-state="hover"],.lmsc-btn[data-variant="tonal"]:not([data-state="disabled"]):not(:disabled):hover{background:var(--surface-container-high)}
.lmsc-btn[data-variant="tonal"][data-state="hover"] .lmsc-btn__label,.lmsc-btn[data-variant="tonal"]:not([data-state="disabled"]):not(:disabled):hover .lmsc-btn__label{color:var(--on-surface)}
.lmsc-btn[data-variant="tonal"][data-state="pressed"],.lmsc-btn[data-variant="tonal"]:not([data-state="disabled"]):not(:disabled):active{background:var(--surface-container-highest);box-shadow:var(--shadow-inset-pressed)}
.lmsc-btn[data-variant="tonal"][data-state="pressed"] .lmsc-btn__label,.lmsc-btn[data-variant="tonal"]:not([data-state="disabled"]):not(:disabled):active .lmsc-btn__label{color:var(--on-surface)}
.lmsc-btn[data-state="disabled"],.lmsc-btn:disabled{background:var(--surface-container-low);box-shadow:none;cursor:not-allowed}
.lmsc-btn[data-state="disabled"] .lmsc-btn__label,.lmsc-btn:disabled .lmsc-btn__label{color:var(--on-surface-subtle);opacity:.6}
.lmsc-btn__label{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
`;

function ensureButtonCss() {
  if (typeof document === 'undefined' || document.getElementById('lmsc-btn-css')) return;
  const el = document.createElement('style');
  el.id = 'lmsc-btn-css';
  el.textContent = BUTTON_CSS;
  document.head.appendChild(el);
}

export function Button({ label = 'Button', variant = 'primary', state = 'default', size = 'm', ...rest }) {
  ensureButtonCss();
  const disabled = state === 'disabled';
  return (
    <button type="button" disabled={disabled} data-variant={variant} data-state={state} data-size={size} className="lmsc-btn inline-flex h-8 w-fit max-w-full items-center justify-center p-2 rounded-full" {...rest}>
      <span className={'lmsc-btn__label label-m w-fit max-w-full h-fit px-1' + (disabled ? ' opacity-60' : '')}>{label}</span>
    </button>
  );
}
