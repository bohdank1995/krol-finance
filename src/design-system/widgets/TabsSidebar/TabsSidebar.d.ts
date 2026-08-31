import * as React from 'react';
import type { TabsProps } from '../../components/Tabs/Tabs';

export interface TabsSidebarProps extends TabsProps {
  /** Extra classes on the sidebar shell (background / radius / pt-2 are fixed). */
  className?: string;
  /** Extra styles merged onto the shell, after the --surface background. */
  style?: React.CSSProperties;
}

export declare function TabsSidebar(props: TabsSidebarProps): JSX.Element;
