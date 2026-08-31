/* ButtonGroup — Button + vertical divider + chevron IconButton inside one
   999px-radius wrapper. Geometry via Tailwind px classes (h-8, w-px,
   rounded-full); every color resolves through var(--token) — the divider
   through the semantic alias --button-group-divider (→ --primary-30). */
import { Button } from '../Button/Button.jsx';
import { IconButton } from '../IconButton/IconButton.jsx';
const BUTTON_GROUP_CSS = `
.lmsc-btngroup{background:transparent}
.lmsc-btngroup>.lmsc-btn,.lmsc-btngroup>.lmsc-iconbtn{border-radius:0}
.lmsc-btngroup__divider{background:var(--button-group-divider);align-self:stretch}
.lmsc-btngroup[data-state="disabled"] .lmsc-btngroup__divider{background:var(--button-group-divider-disabled)}
`;

function ensureButtonGroupCss() {
  if (typeof document === 'undefined' || document.getElementById('lmsc-btngroup-css')) return;
  const el = document.createElement('style');
  el.id = 'lmsc-btngroup-css';
  el.textContent = BUTTON_GROUP_CSS;
  document.head.appendChild(el);
}

export function ButtonGroup({
  label = 'Button',
  icon = 'caret-down',
  state = 'default',
  iconState,
  iconLabel = 'More options',
  onLabelClick,
  onIconClick,
  ...rest
}) {
  ensureButtonGroupCss();
  return (
    <div role="group" aria-label={label} data-state={state} className="lmsc-btngroup inline-flex h-8 w-fit items-stretch overflow-hidden rounded-full" {...rest}>
      <Button label={label} variant="primary" state={state} onClick={onLabelClick} />
      <span aria-hidden="true" className="lmsc-btngroup__divider w-px shrink-0" />
      <IconButton icon={icon} variant="primary" state={iconState || state} label={iconLabel} onClick={onIconClick} />
    </div>
  );
}
