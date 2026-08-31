/* Breadcrumbs — a row of Link-m items separated by a 12px chevron-right icon
   in --on-surface-subtle. Spacing via Tailwind gap-1 (4px); no literal px. */
import { LinkM } from '../LinkM/LinkM.jsx';
import { Icon } from '../Icon/Icon.jsx';

export function Breadcrumbs({ items = [], ...rest }) {
  const last = items.length - 1;
  return (
    <nav aria-label="Breadcrumb" className="flex flex-row items-center gap-1 w-fit h-fit" {...rest}>
      {items.flatMap((item, i) => {
        const link = <LinkM key={'l' + i} label={item.label} href={item.href} state={item.state || (i === last ? 'disabled' : 'default')} />;
        return i < last ? [link, <Icon key={'s' + i} name="caret-right" size="xs" color="var(--on-surface-subtle)" />] : [link];
      })}
    </nav>
  );
}
