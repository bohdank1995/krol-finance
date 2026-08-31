/* Icon — Phosphor, Bold weight only.
   Size resolves through --icon-size-*, color through the --icon semantic
   aliases in tokens/colors.css. No literal sizes or hexes here.
   The Phosphor Bold face ships in tokens/icons.css; for bundle-only consumers
   the stylesheet is also ensured at runtime. */
const PHOSPHOR_BOLD_HREF = 'https://unpkg.com/@phosphor-icons/web@2.1.1/src/bold/style.css';

function ensurePhosphorBold() {
  if (typeof document === 'undefined' || document.getElementById('lmsc-phosphor-bold')) return;
  const el = document.createElement('link');
  el.id = 'lmsc-phosphor-bold';
  el.rel = 'stylesheet';
  el.href = PHOSPHOR_BOLD_HREF;
  document.head.appendChild(el);
}

export function Icon({ name = 'arrow-right', size = 'm', color = 'var(--icon)', ...rest }) {
  ensurePhosphorBold();
  return (
    <i
      aria-hidden="true"
      data-icon={name}
      data-size={size}
      className={'ph-bold ph-' + name}
      style={{ fontSize: 'var(--icon-size-' + size + ')', color, lineHeight: 1, display: 'inline-flex' }}
      {...rest}
    />
  );
}
