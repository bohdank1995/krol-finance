export interface LinkMProps {
  /** Text label, rendered with the link-m typestyle (label-m props + underline) */
  label?: string;
  href?: string;
  /**
   * Forces a visual state. 'default' also reacts live to :hover.
   * default → --link-label (--on-surface-variant) label + --link-underline (--neutral-80) underline.
   * hover → underline --link-underline-hover (--neutral-40).
   * disabled → label --on-surface-subtle, underline --neutral-80, no pointer events.
   */
  state?: 'default' | 'hover' | 'disabled';
}

export declare function LinkM(props: LinkMProps): JSX.Element;
