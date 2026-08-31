/* TabsSidebar — widget wrapper around Tabs. Adds the surface background, an 8px
   radius (rounded-lg), 8px top padding (pt-2) and 16px bottom padding (pb-4);
   everything else — row height,
   indicator, colors — stays inside Tabs / TabItem. All props pass through to Tabs. */
import { Tabs } from '../../components/Tabs/Tabs.jsx';

export function TabsSidebar({ className = '', style, children, ...rest }) {
  return (
    <div
      className={'w-full h-fit rounded-lg pt-2 pb-4 ' + className}
      style={{ background: 'var(--surface)', ...style }}
    >
      <Tabs {...rest}>{children}</Tabs>
    </div>
  );
}
