export interface MenuItemProps {
  /** Phosphor (bold) icon name for the leading 20×20 box; glyph renders 16×16 */
  icon?: string;
  /** Top text — label-m, --menu-item-label (--on-surface-variant) */
  label?: string;
  /** Bottom text — label-m, --menu-item-description (--on-surface-subtle) */
  description?: string;
  /**
   * Condition. false → trailing check hidden (box still reserves 20×20 space).
   * true → check visible and row background --menu-item-bg-selected (--surface-container).
   */
  selected?: boolean;
  /**
   * Forces a visual state. 'default' also reacts live to :hover.
   * default → transparent bg, icon + label --on-surface-variant, description --on-surface-subtle.
   * hover → bg --surface-container, every element --on-surface.
   * disabled → every element --on-surface-subtle, opacity-60, no pointer events.
   */
  state?: 'default' | 'hover' | 'disabled';
}

export declare function MenuItem(props: MenuItemProps): JSX.Element;
