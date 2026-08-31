# LMS Collaborato Design System

Tokens live in `tokens/` and are exposed through `styles.css` (colors, typography, fonts).

## Token sync — non-negotiable rule

Nothing in this system hardcodes a font family or a hex value. Every value
travels one path:

`base token` (`--primary-40`, `--font-plain`) → `semantic / typestyle token`
(`--primary`, `--label-m-font-family`) → `component` (`.label-m`,
`var(--primary)`)

So editing a base token retypes and recolors every component that consumed it.

Two runtimes make edits live:

- `tokens/token-sync.js` — the shared applier. Reads token overrides from
  localStorage, writes them onto `:root`, and re-applies instantly when any
  other card changes a token (BroadcastChannel + storage events). It also owns
  the typeface store (`TokenSync.fonts/setFont/resetFonts/onChange`).
- `tokens/palette-editor.js` — the color ramp UI (wheel + hex + semantic
  role sync). Its edits are picked up by `token-sync.js` everywhere else.

**Every card, component preview and template must load `token-sync.js` in its
`<head>`, right after `styles.css`.** A page that skips it will show stale
tokens. Consumers of the compiled bundle should load it too.

Anti-patterns: `font-family: Roboto`, `color: #EF6001`, per-card copies of the
sync logic, a typestyle that names a family instead of `var(--font-plain)`.

## Typestyles

- `.label-s` — 12px / 16px, medium
- `.label-m` — 14px / 20px, medium
- `.label-l` — 16px / 24px, medium
- `.link-m` — `.label-m` props + underline (6% thickness, 25% offset, skip ink on,
  color `--link-underline` → `--neutral-80`)

## Components

- Button — primary / tonal, states default / hover / pressed / disabled, size m
  (label uses `.label-m` → `--font-plain`)
- IconButton — icon-only, fixed 32×32 (`h-8 w-8 rounded-full`). primary / tonal,
  same four states as Button. Glyph is a Phosphor Bold icon at `--icon-size-s` (16×16),
  colored via `--icon-on-primary` / `--icon` / `--icon-strong` / `--icon-disabled`.
- ButtonGroup — a primary Button and a chevron IconButton inside one
  `rounded-full overflow-hidden` wrapper (`h-8`), split by a `w-px` full-height
  divider in `--button-group-divider` (`--primary-30`); disabled group switches the
  divider to `--button-group-divider-disabled`. `state` drives both halves,
  `iconState` can force just the icon half (e.g. menu open).
- LinkM — text link with the `.link-m` typestyle. States default / hover / disabled:
  label `--link-label` (`--on-surface-variant`), disabled label `--link-label-disabled` (`--on-surface-subtle`);
  underline `--link-underline` (`--neutral-80`), hover `--link-underline-hover`
  (`--neutral-40`), disabled `--link-underline-disabled` (`--neutral-80`).
- Breadcrumbs — a `flex-row` trail of LinkM items separated by a 12px
  `caret-right` Icon (`--icon-size-xs`) in `--on-surface-subtle`; `gap-1` (4px)
  between all elements, last item rendered disabled.
- MenuItem — menu row (for the future Menu). Three top-aligned inline wrappers at
  `gap-2` inside a `rounded-md` (6px) `px-2 py-1.5` button: 20×20 icon box with a 16×16 glyph,
  a `flex-col gap-1` pair of `.label-m` texts (label `--menu-item-label`,
  description `--menu-item-description`), and a reserved 20×20 `check` box.
  States default / hover / disabled (`--menu-item-*-hover` → `--on-surface`,
  `--menu-item-*-disabled` → `--on-surface-subtle` + `opacity-60`); conditions
  unselected (check hidden) / selected (check visible, bg `--menu-item-bg-selected`).
- Menu — floating container for MenuItem rows: `flex-col gap-0.5` (2px), `p-1` (4px),
  `rounded-lg` (8px), 1px `--menu-border` (`--outline-variant`), `--menu-bg`
  (`--surface`) and the two-layer `--menu-shadow` (`--shadow-overlay`). An items
  entry of `{ type: 'divider' }` renders MenuDivider — a wrapper at `px-2 py-0.5`
  (8px sides, 2px top/bottom) around an `h-px` rule in `--menu-divider`
  (`--outline-variant`).
- TabItem — horizontal tab row, `h-12` (48px). Two middle-aligned inline wrappers at
  `gap-6` (24px): a 3px × `h-8` (32px) indicator with `rounded-r-full` in
  `--tab-item-indicator` (`--primary`), then an `items-center gap-1` (4px) pair of a
  16×16 icon (`--icon-size-s`) and `.label-m` text. States default / hover / active —
  default and hover keep the indicator hidden (space reserved) while hover and active
  raise icon + label to `--on-surface` via `--tab-item-icon-hover|active` and
  `--tab-item-label-hover|active`; only active shows the indicator. `orientation` is
  `'horizontal'`.
- Tabs — vertical stack of TabItem rows in a `flex flex-col gap-0` tablist. No padding,
  border, background or color of its own; each row keeps its own `h-12` height and
  `--tab-item-*` colors. Exactly one row is always active: `active` seeds the index
  (`0` = first tab) and clicking a row moves it; pass `onChange` to control it from the
  parent. Rows come from `items` (each entry is TabItem props) or from children.
- AppBar — Widget. `--surface` box with `pt-16`; an absolutely-positioned top row
  (IconButton + Breadcrumbs at `gap-4`, full width, and a right-hand action pair:
  tonal Button then a ButtonGroup) over a `pt-2 pb-6` page title in `.h5`. The
  ButtonGroup chevron toggles a Menu (`w-80`, anchored `top-full mt-2 right-0`)
  of the three save actions with a divider before the last; closes on outside
  click or Escape. Rows come from `menuItems`, selection from `onMenuSelect`.
- TabsSidebar — Widget. Thin wrapper around Tabs: a `--surface` shell with
  `rounded-lg` (8px), `pt-2` (8px top padding) and `pb-4` (16px bottom padding), full width, height by content.
  It adds no colors or spacing of its own beyond that; all props (`items`,
  `active`, `onChange`, `label`, children) pass straight through to Tabs.
- Icon — Phosphor, Bold weight only. Size via `--icon-size-xs|s|m|l`, color via
  `--icon` / `--icon-subtle` / `--icon-accent`. The face is loaded in
  `tokens/icons.css`; components never name the family.
