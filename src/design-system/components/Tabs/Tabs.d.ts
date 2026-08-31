import type { TabItemProps } from '../TabItem/TabItem';

export interface TabsProps {
  /**
   * Rows to render. Each entry is passed straight to TabItem; `state` is
   * overridden to 'active' for the current index. Optional `key`
   * disambiguates rows with identical labels. Omit to compose TabItem
   * children yourself.
   */
  items?: (TabItemProps & { key?: string; onClick?: React.MouseEventHandler })[];
  /**
   * Index of the active row — one row is always active. Uncontrolled by
   * default (seeds the initial value; clicking a row moves it). Pass together
   * with `onChange` to control it from the parent. Default 0 (first tab).
   */
  active?: number;
  /** Called with (index, item) on click. Supplying it makes `active` controlled. */
  onChange?: (index: number, item: TabItemProps) => void;
  /** Accessible name for the tablist (aria-label) */
  label?: string;
  /** TabItem elements, used when `items` is not provided */
  children?: React.ReactNode;
}

export declare function Tabs(props: TabsProps): JSX.Element;
