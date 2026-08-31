/* TabItem — horizontal tab row. 48px tall (h-12), two inline wrappers, middle
   aligned, 24px gap (gap-6). Wrapper 1: 3px × 32px indicator (h-8) with 999px
   radius on the right edge (rounded-r-full), --tab-item-indicator; hidden (not
   removed) unless active. Wrapper 2: 16×16 icon + label-m text, 4px gap (gap-1).
   Geometry via Tailwind classes; every color resolves through --tab-item-* aliases. */
import { Icon } from '../Icon/Icon.jsx';

const TAB_ITEM_CSS = `
.lmsc-tab-item{background:transparent;border:none;text-align:left;cursor:pointer;color:var(--tab-item-icon);transition:color 120ms ease}
.lmsc-tab-item .lmsc-ti-icon{color:var(--tab-item-icon)}
.lmsc-tab-item .lmsc-ti-label{color:var(--tab-item-label)}
.lmsc-tab-item .lmsc-ti-indicator{background:var(--tab-item-indicator)}
.lmsc-tab-item[data-state="hover"],.lmsc-tab-item[data-state="default"]:hover{color:var(--tab-item-icon-hover)}
.lmsc-tab-item[data-state="hover"] .lmsc-ti-icon,.lmsc-tab-item[data-state="default"]:hover .lmsc-ti-icon{color:var(--tab-item-icon-hover)}
.lmsc-tab-item[data-state="hover"] .lmsc-ti-label,.lmsc-tab-item[data-state="default"]:hover .lmsc-ti-label{color:var(--tab-item-label-hover)}
.lmsc-tab-item[data-state="active"]{color:var(--tab-item-icon-active)}
.lmsc-tab-item[data-state="active"] .lmsc-ti-icon{color:var(--tab-item-icon-active)}
.lmsc-tab-item[data-state="active"] .lmsc-ti-label{color:var(--tab-item-label-active)}
`;

function ensureTabItemCss() {
  if (typeof document === 'undefined' || document.getElementById('lmsc-tab-item-css')) return;
  const el = document.createElement('style');
  el.id = 'lmsc-tab-item-css';
  el.textContent = TAB_ITEM_CSS;
  document.head.appendChild(el);
}

export function TabItem({ icon = 'squares-four', label = 'Tab item', orientation = 'horizontal', state = 'default', ...rest }) {
  ensureTabItemCss();
  const active = state === 'active';
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-state={state}
      data-orientation={orientation}
      className="lmsc-tab-item inline-flex h-12 items-center gap-6"
      {...rest}
    >
      <span className="inline-flex shrink-0 items-center">
        <span className={'lmsc-ti-indicator h-8 w-[3px] rounded-r-full' + (active ? '' : ' invisible')} />
      </span>
      <span className="inline-flex min-w-0 items-center gap-1">
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
          <Icon name={icon} size="s" color="currentColor" className={'ph-bold ph-' + icon + ' lmsc-ti-icon'} />
        </span>
        <span className="lmsc-ti-label label-m truncate">{label}</span>
      </span>
    </button>
  );
}
