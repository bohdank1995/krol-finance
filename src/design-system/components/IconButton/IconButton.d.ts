export interface IconButtonProps {
  /** Phosphor (Bold) icon name, rendered at --icon-size-s (16×16). */
  icon?: string;
  /**
   * primary → --primary bg / --icon-on-primary glyph.
   * tonal → --surface-container bg / --icon glyph; hover --surface-container-high
   * + --icon-strong, pressed --surface-container-highest + --shadow-inset-pressed.
   */
  variant?: 'primary' | 'tonal';
  /**
   * Forces a visual state. 'default' also reacts live to :hover / :active.
   * disabled → --surface-container-low bg + --icon-disabled glyph at 60% opacity
   * (identical across variants).
   */
  state?: 'default' | 'hover' | 'pressed' | 'disabled';
  /** Fixed 32×32 footprint (h-8 w-8); only one size for now. */
  size?: 'm';
  /** Accessible name — required in practice, the button has no visible label. */
  label?: string;
}

export declare function IconButton(props: IconButtonProps): JSX.Element;
