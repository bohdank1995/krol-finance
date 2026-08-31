export interface TabItemProps {
  /** Phosphor (bold) icon name — renders 16×16 (--icon-size-s) */
  icon?: string;
  /** Tab text — label-m typestyle */
  label?: string;
  /** Layout axis. Only 'horizontal' is defined: 48px-tall row, indicator on the left edge. */
  orientation?: 'horizontal';
  /**
   * Visual state. 'default' also reacts live to :hover.
   * default → indicator hidden (space reserved), icon + label --tab-item-icon / --tab-item-label (--on-surface-variant).
   * hover → indicator hidden, icon + label --on-surface.
   * active → indicator visible (--primary), icon + label --on-surface.
   */
  state?: 'default' | 'hover' | 'active';
}

export declare function TabItem(props: TabItemProps): JSX.Element;
