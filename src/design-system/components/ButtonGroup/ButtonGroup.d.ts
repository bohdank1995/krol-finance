export interface ButtonGroupProps {
  /** Label of the primary Button on the left. Also the group's accessible name. */
  label?: string;
  /** Phosphor (Bold) icon for the right-hand IconButton — a chevron by default. */
  icon?: string;
  /** Visual state applied to both halves. 'default' reacts live to :hover / :active. */
  state?: 'default' | 'hover' | 'pressed' | 'disabled';
  /** Optional override so only the icon half shows a state (e.g. menu open → 'pressed'). */
  iconState?: 'default' | 'hover' | 'pressed' | 'disabled';
  /** Accessible name for the icon half. */
  iconLabel?: string;
  onLabelClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onIconClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export declare function ButtonGroup(props: ButtonGroupProps): JSX.Element;
