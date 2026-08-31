import * as React from 'react';

export interface IconProps extends React.HTMLAttributes<HTMLElement> {
  /** Phosphor icon name without the `ph-` prefix, e.g. `arrow-right`. Always rendered in the Bold weight. */
  name?: string;
  /** Maps to --icon-size-xs | --icon-size-s | --icon-size-m | --icon-size-l */
  size?: 'xs' | 's' | 'm' | 'l';
  /** Any color token, defaults to var(--icon) */
  color?: string;
}

export declare function Icon(props: IconProps): JSX.Element;
