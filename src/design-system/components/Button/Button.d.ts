export interface ButtonProps {
  /** Text label, rendered with the label-m typestyle */
  label?: string;
  /**
   * primary → --primary bg / --on-primary label.
   * tonal → --surface-container bg, --on-surface-variant label; hover
   * --surface-container-high + --on-surface, pressed --surface-container-highest
   * + --on-surface + --shadow-inset-pressed. Same geometry & spacing as primary.
   */
  variant?: 'primary' | 'tonal';
  /**
   * Forces a visual state. 'default' also reacts live to :hover / :active.
   * hover → --primary-hover, pressed → --primary-pressed + --shadow-inset-pressed,
   * disabled → --surface-container-low bg + --on-surface-subtle label at 60% opacity (identical across variants).
   */
  state?: 'default' | 'hover' | 'pressed' | 'disabled';
  size?: 'm';
}

export declare function Button(props: ButtonProps): JSX.Element;
