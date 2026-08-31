import * as React from 'react';
import type { BreadcrumbItem } from '../../components/Breadcrumbs/Breadcrumbs';
import type { MenuProps } from '../../components/Menu/Menu';

export interface AppBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Page title, rendered with the `.h5` typestyle. */
  title?: string;
  /** Breadcrumb trail; last item renders disabled. */
  breadcrumbs?: BreadcrumbItem[];
  /** Phosphor glyph name for the leading IconButton. */
  backIcon?: string;
  backLabel?: string;
  onBack?: React.MouseEventHandler<HTMLButtonElement>;
  /** Right-hand primary action label. */
  primaryLabel?: string;
  /** Left-hand tonal action label. */
  tonalLabel?: string;
  onPrimary?: React.MouseEventHandler<HTMLButtonElement>;
  onTonal?: React.MouseEventHandler<HTMLButtonElement>;
  /** Rows for the Menu opened by the ButtonGroup chevron. Defaults to the four save actions. */
  menuItems?: MenuProps['items'];
  /** Fired when a menu row is chosen; receives the item and its index. */
  onMenuSelect?: (item: NonNullable<MenuProps['items']>[number], index: number) => void;
}

export declare function AppBar(props: AppBarProps): JSX.Element;
