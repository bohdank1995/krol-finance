/* Tabs — vertical stack of TabItem rows. Rows sit in a flex column with a 0px
   gap (gap-0); each TabItem owns its own 48px height and left indicator, so the
   container adds no padding, border, background or color of its own — every
   color still resolves through the --tab-item-* aliases inside TabItem.
   Exactly one row is always active: `active` seeds it (0 = first tab) and
   clicking a row moves it, unless `onChange` is supplied (then the parent owns
   the value). */
import * as React from 'react';
import { TabItem } from '../TabItem/TabItem.jsx';

export function Tabs({ items = [], active = 0, onChange, label = 'Tabs', children, ...rest }) {
  const controlled = typeof onChange === 'function';
  const [internal, setInternal] = React.useState(active);
  React.useEffect(() => { if (!controlled) setInternal(active); }, [active, controlled]);
  const current = controlled ? active : internal;

  const rows = Array.isArray(items) && items.length
    ? items.map((item, i) => {
        const { key, state, onClick, ...tabProps } = item || {};
        return (
          <TabItem
            key={key ?? item.label ?? i}
            {...tabProps}
            state={i === current ? 'active' : state || 'default'}
            onClick={(e) => {
              if (controlled) onChange(i, item);
              else setInternal(i);
              if (typeof onClick === 'function') onClick(e);
            }}
          />
        );
      })
    : children;

  return (
    <div role="tablist" aria-orientation="vertical" aria-label={label} className="flex flex-col gap-0" {...rest}>
      {rows}
    </div>
  );
}
