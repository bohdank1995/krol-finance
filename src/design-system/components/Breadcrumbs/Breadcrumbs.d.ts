import * as React from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  /** Overrides the derived state; the last item defaults to 'disabled'. */
  state?: 'default' | 'hover' | 'disabled';
}

export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  /** Trail order: root first, current page last (rendered disabled). */
  items?: BreadcrumbItem[];
}

export declare function Breadcrumbs(props: BreadcrumbsProps): JSX.Element;
