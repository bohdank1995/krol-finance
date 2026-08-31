/* MenuItem — row used inside Menu. Three inline wrappers, top-aligned, 8px gap
   (gap-2), 6px corners (rounded-md). Geometry via Tailwind classes; every color
   resolves through the --menu-item-* semantic aliases in tokens/colors.css.
   Leading icon box 20×20 (w-5 h-5) with a 16×16 glyph (--icon-size-s);
   trailing check box 20×20, glyph hidden (not removed) when unselected. */
import { Icon } from '../Icon/Icon.jsx';

const MENU_ITEM_CSS = `
.lmsc-menu-item{background:var(--menu-item-bg);border:none;text-align:left;cursor:pointer;color:var(--menu-item-icon);transition:background-color 120ms ease,color 120ms ease}
.lmsc-menu-item .lmsc-mi-icon,.lmsc-menu-item .lmsc-mi-check{color:var(--menu-item-icon)}
.lmsc-menu-item .lmsc-mi-label{color:var(--menu-item-label)}
.lmsc-menu-item .lmsc-mi-desc{color:var(--menu-item-description)}
.lmsc-menu-item[data-selected="true"]{background:var(--menu-item-bg-selected)}
.lmsc-menu-item[data-state="hover"],.lmsc-menu-item[data-state="default"]:not(:disabled):hover{background:var(--menu-item-bg-hover);color:var(--menu-item-icon-hover)}
.lmsc-menu-item[data-state="hover"] .lmsc-mi-icon,.lmsc-menu-item[data-state="hover"] .lmsc-mi-check,.lmsc-menu-item[data-state="default"]:not(:disabled):hover .lmsc-mi-icon,.lmsc-menu-item[data-state="default"]:not(:disabled):hover .lmsc-mi-check{color:var(--menu-item-icon-hover)}
.lmsc-menu-item[data-state="hover"] .lmsc-mi-label,.lmsc-menu-item[data-state="default"]:not(:disabled):hover .lmsc-mi-label{color:var(--menu-item-label-hover)}
.lmsc-menu-item[data-state="hover"] .lmsc-mi-desc,.lmsc-menu-item[data-state="default"]:not(:disabled):hover .lmsc-mi-desc{color:var(--menu-item-description-hover)}
.lmsc-menu-item[data-state="disabled"]{cursor:not-allowed;color:var(--menu-item-icon-disabled)}
.lmsc-menu-item[data-state="disabled"] .lmsc-mi-icon,.lmsc-menu-item[data-state="disabled"] .lmsc-mi-check{color:var(--menu-item-icon-disabled)}
.lmsc-menu-item[data-state="disabled"] .lmsc-mi-label{color:var(--menu-item-label-disabled)}
.lmsc-menu-item[data-state="disabled"] .lmsc-mi-desc{color:var(--menu-item-description-disabled)}
`;

function ensureMenuItemCss() {
  if (typeof document === 'undefined' || document.getElementById('lmsc-menu-item-css')) return;
  const el = document.createElement('style');
  el.id = 'lmsc-menu-item-css';
  el.textContent = MENU_ITEM_CSS;
  document.head.appendChild(el);
}

export function MenuItem({ icon = 'user', label = 'Menu item', description = 'Supporting text', selected = false, state = 'default', ...rest }) {
  ensureMenuItemCss();
  const disabled = state === 'disabled';
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      disabled={disabled}
      data-state={state}
      data-selected={selected ? 'true' : 'false'}
      className={'lmsc-menu-item inline-flex w-full items-start gap-2 rounded-md px-2 py-1.5' + (disabled ? ' opacity-60' : '')}
      {...rest}
    >
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
        <Icon name={icon} size="s" color="currentColor" className={'ph-bold ph-' + icon + ' lmsc-mi-icon'} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="lmsc-mi-label label-m">{label}</span>
        <span className="lmsc-mi-desc body-s">{description}</span>
      </span>
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
        <span className={'inline-flex' + (selected ? '' : ' invisible')}>
          <Icon name="check" size="s" color="currentColor" className="ph-bold ph-check lmsc-mi-check" />
        </span>
      </span>
    </button>
  );
}
