# Synced from Claude Design

Source project: **LMS Collaborato Design System**
Project ID: `72f1ad68-b894-4cea-b870-e2336fc2fe87`
Pulled: 2026-08-31

## What lives here

- `tokens/` — colors, typography, fonts, icon sizes. The single source of truth.
- `styles.css` — the CSS entry point. Imported once from `src/index.css`.
- `components/` — 10 primitives (Button, Icon, IconButton, ButtonGroup, LinkM,
  Breadcrumbs, MenuItem, Menu, TabItem, Tabs).
- `widgets/` — 2 composed views (AppBar, TabsSidebar).
- `index.js` — barrel export so app code can `import { Button } from './design-system'`.
- `readme.md` — the design system's own readme, rendered on the Design System page.

## Local deviations from the Claude Design source

Kept deliberately minimal. Three changes, all required to run under Vite:

1. `Tabs.jsx` and `AppBar.jsx` call `React.useState` / `React.useEffect`.
   Claude Design's preview supplies `React` as a global; Vite does not, so
   `import * as React from 'react'` was added to both.
2. `IconButton`, `MenuItem` and `TabItem` looked the `Icon` component up off a
   `window.LMSCollaboratoDesignSystem_72f1ad` global, with an inline `<i>`
   fallback. Both branches render identical markup, so these now import `Icon`
   directly instead.
3. `tokens/fonts.css` and `tokens/icons.css` each pulled a remote stylesheet
   with `@import url(...)`. Once bundled, those land after other rules and the
   browser ignores them — so Roboto and the Phosphor icon font silently failed
   to load in a production build. The two stylesheets are now `<link>`ed from
   `index.html` and the `@import` lines were removed.

## The Design System page — public/ds/

`/` renders `src/DesignSystemPage.tsx`, a local copy of the Design System
browser Claude Design shows for this project. It is driven by
`public/ds/_ds_manifest.json` and renders the **real** `.card.html` previews in
iframes — same markup, same token runtime, same Phosphor/Tailwind/React CDN
scripts Claude Design uses. Nothing on that page re-implements a component, so
it cannot drift from the cards in the design system.

`public/ds/` therefore holds a second, browser-standalone copy of the system:

- `guidelines/*.card.html`, `components/**/*.html`, `widgets/**/*.html` — the 26
  preview cards, verbatim.
- `tokens/*.css` + `styles.css` — same tokens, except `fonts.css` and
  `icons.css` **keep** their remote `@import url(...)`. The cards are standalone
  documents with no index.html to link the webfonts from, so deviation 3 above
  applies to `src/design-system/` only.
- `tokens/token-sync.js`, `tokens/palette-editor.js` — the live token runtime.
  These make a colour edit in one card repaint every other card, which is the
  behaviour the page exists to show.
- `_ds_bundle.js` — **generated, do not edit.** Built from `src/design-system/`
  by `npm run build:ds` (see `vite.ds-bundle.config.ts`), so the cards render
  this project's components rather than a stale copy of Claude Design's build.
  `npm run build` runs it first. Re-run it after changing anything in
  `src/design-system/`.

Not pulled: `uploads/` (reference screenshots) and `.thumbnail` /
`thumbnail.html`. `_ds_manifest.json` is reproduced with only the fields the
page consumes (`namespace`, `components`, `cards`, `globalCssPaths`); the
upstream file also carries a large captured inventory of the source Figma
library that nothing here reads.

The page's own chrome (`src/design-system-page.css`) deliberately uses literal
colours instead of DS tokens: if it consumed them, editing `--neutral` in a
colour card would repaint the page you are judging the ramp from. Claude
Design's product controls around the header — Published, "Currently org
default", "New design" — are not reproduced; they are Claude Design features,
not part of the design system.

## Re-syncing

Ask Claude to pull the design system again. The three deviations above must be
re-applied to any newly pulled copy of those seven files, and both copies —
`src/design-system/` and `public/ds/` — must be updated together. After any
change to `src/design-system/`, run `npm run build:ds` so the cards pick it up.

A component added upstream needs: its `.jsx`/`.d.ts` in `src/design-system/`,
its `.html` card in `public/ds/`, an entry in `public/ds/_ds_manifest.json`, and
exports in both `index.js` and `index.d.ts`.
