import type { MenuItemProps } from '../MenuItem/MenuItem';

/** Divider row: a wrapper with 8px left/right and 2px top/bottom padding around a 1px `--outline-variant` rule. */
export interface MenuDividerItem {
  type: 'divider';
  key?: string;
}

export interface MenuProps {
  /**
   * Rows to render. Each entry is passed straight to MenuItem, except
   * `{ type: 'divider' }`, which renders a divider wrapper. Optional `key`
   * disambiguates rows with identical labels. Omit to compose rows as children.
   */
  items?: ((MenuItemProps & { key?: string }) | MenuDividerItem)[];
  /** Accessible name for the menu (aria-label) */
  label?: string;
  /** MenuItem elements, used when `items` is not provided */
  children?: React.ReactNode;
}

export declare function Menu(props: MenuProps): JSX.Element;
export declare function MenuDivider(props: React.HTMLAttributes<HTMLDivElement>): JSX.Element;
