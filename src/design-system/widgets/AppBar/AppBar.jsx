/* AppBar — widget composed of IconButton + Breadcrumbs + tonal Button + ButtonGroup.
   The ButtonGroup's chevron IconButton toggles a Menu anchored under the group.
   Geometry via Tailwind px classes (pt-16, gap-4, pt-2 pb-6); every color
   resolves through var(--token). */
import * as React from 'react';
import { IconButton } from '../../components/IconButton/IconButton.jsx';
import { Breadcrumbs } from '../../components/Breadcrumbs/Breadcrumbs.jsx';
import { Button } from '../../components/Button/Button.jsx';
import { ButtonGroup } from '../../components/ButtonGroup/ButtonGroup.jsx';
import { Menu } from '../../components/Menu/Menu.jsx';

const DEFAULT_MENU_ITEMS = [
  { icon: 'eye', label: 'Save and view', description: 'Save and open the resource in view mode' },
  { icon: 'floppy-disk', label: 'Save', description: 'Save and stay on this page' },
  { type: 'divider' },
  { icon: 'clipboard-text', label: 'Save and create a task', description: 'Save, publish, and create a task based on this content' }
];

export function AppBar({
  title = 'Page title',
  breadcrumbs = [{ label: 'Courses', href: '#' }, { label: 'Onboarding' }],
  backIcon = 'arrow-left',
  backLabel = 'Back',
  onBack,
  primaryLabel = 'Publish',
  tonalLabel = 'Preview',
  onPrimary,
  onTonal,
  menuItems = DEFAULT_MENU_ITEMS,
  onMenuSelect,
  ...rest
}) {
  const [open, setOpen] = React.useState(false);
  const anchorRef = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (anchorRef.current && !anchorRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const rows = (menuItems || []).map((item, i) => item && item.type === 'divider'
    ? item
    : { ...item, onClick: (e) => { setOpen(false); if (item.onClick) item.onClick(e); if (onMenuSelect) onMenuSelect(item, i); } });
  return (
    <div className="relative w-full h-fit px-6 pt-16 rounded-lg" style={{ background: 'var(--surface)' }} {...rest}>
      <div className="absolute top-0 left-0 right-0 inline-flex flex-row items-center px-6 py-4">
        <div className="inline-flex w-full flex-row items-center gap-4">
          <IconButton icon={backIcon} label={backLabel} variant="tonal" onClick={onBack} />
          <Breadcrumbs items={breadcrumbs} />
        </div>
        <div className="inline-flex shrink-0 flex-row items-center gap-2">
          <Button label={tonalLabel} variant="tonal" onClick={onTonal} />
          <div ref={anchorRef} className="relative inline-flex">
            <ButtonGroup
              label={primaryLabel}
              onLabelClick={onPrimary}
              onIconClick={() => setOpen((v) => !v)}
              iconState={open ? 'hover' : undefined}
              aria-expanded={open}
            />
            {open ? (
              <div className="absolute right-0 top-full z-20 mt-2 w-80">
                <Menu items={rows} label={primaryLabel + ' options'} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="pt-2 pb-6">
        <h1 className="h5 m-0">{title}</h1>
      </div>
    </div>
  );
}
