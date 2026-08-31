/* Menu — floating container for MenuItem rows. Rows stack in a flex column with
   a 2px gap (gap-0.5); the container carries 4px padding (p-1), an 8px radius
   (rounded-lg) and a 1px border (border). Every color, and the two-layer drop
   shadow, resolve through the --menu-* semantic aliases in tokens/colors.css
   (--menu-bg → --surface, --menu-border → --outline-variant,
   --menu-divider → --outline-variant, --menu-shadow → --shadow-overlay).
   An items entry of { type: 'divider' } renders a divider wrapper (px-2 py-0.5
   = 8px left/right, 2px top/bottom) around a 1px horizontal divider. */
import { MenuItem } from '../MenuItem/MenuItem.jsx';
const MENU_CSS = `
.lmsc-menu{background:var(--menu-bg);border-color:var(--menu-border);border-style:solid;box-shadow:var(--menu-shadow)}
.lmsc-menu__divider{background:var(--menu-divider)}
`;

function ensureMenuCss() {
  if (typeof document === 'undefined' || document.getElementById('lmsc-menu-css')) return;
  const el = document.createElement('style');
  el.id = 'lmsc-menu-css';
  el.textContent = MENU_CSS;
  document.head.appendChild(el);
}

export function MenuDivider(props) {
  ensureMenuCss();
  return (
    <div role="separator" className="w-full px-2 py-0.5" {...props}>
      <div aria-hidden="true" className="lmsc-menu__divider h-px w-full" />
    </div>
  );
}

export function Menu({ items, label = 'Menu', children, ...rest }) {
  ensureMenuCss();
  const rows = Array.isArray(items) && items.length
    ? items.map((item, i) => item && item.type === 'divider'
      ? <MenuDivider key={item.key ?? 'divider-' + i} />
      : <MenuItem key={item.key ?? item.label ?? i} {...item} />)
    : children;
  return (
    <div role="menu" aria-label={label} className="lmsc-menu flex w-full flex-col gap-0.5 rounded-lg border p-1" {...rest}>
      {rows}
    </div>
  );
}
