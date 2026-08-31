/* LinkM — label uses the .link-m typestyle; every color resolves through
   var(--token) (palette step → semantic alias → component). */
const LINKM_CSS = `
.lmsc-link{cursor:pointer;color:var(--link-label);text-decoration-color:var(--link-underline);transition:text-decoration-color 120ms ease}
.lmsc-link[data-state="hover"],.lmsc-link:not([data-state="disabled"]):hover{text-decoration-color:var(--link-underline-hover)}
.lmsc-link[data-state="disabled"]{color:var(--link-label-disabled);text-decoration-color:var(--link-underline-disabled);cursor:not-allowed;pointer-events:none}
`;

function ensureLinkMCss() {
  if (typeof document === 'undefined' || document.getElementById('lmsc-link-css')) return;
  const el = document.createElement('style');
  el.id = 'lmsc-link-css';
  el.textContent = LINKM_CSS;
  document.head.appendChild(el);
}

export function LinkM({ label = 'Link', href = '#', state = 'default', ...rest }) {
  ensureLinkMCss();
  const disabled = state === 'disabled';
  return (
    <a href={disabled ? undefined : href} aria-disabled={disabled || undefined} data-state={state} className="lmsc-link link-m inline-flex w-fit h-fit items-center" {...rest}>{label}</a>
  );
}
