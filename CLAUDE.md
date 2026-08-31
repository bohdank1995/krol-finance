# claude-design-experiment

React 19 + TypeScript + Tailwind 4 on Vite. `npm run dev` (port 5173),
`npm run build`, `npm run lint` (oxlint).

## Design system

Two mirrored copies of the same system, both **generated content from Claude Design**,
neither hand-authored here. Read `src/design-system/SYNC.md` before touching either.

- `src/design-system/` — the components the app imports.
- `public/ds/` — the standalone preview cards, token runtime, and the generated
  `_ds_bundle.js`, used by the Design System page at `/`.

They must be kept in step. After any change to `src/design-system/`, run
`npm run build:ds` to rebuild `public/ds/_ds_bundle.js`, or the cards will keep
rendering the previous version.

- Source project: **LMS Collaborato Design System**
- Project ID: `72f1ad68-b894-4cea-b870-e2336fc2fe87`
- Access: the `DesignSync` tool. Authorization is already granted on this machine.

Import components from the barrel, never by deep path:

```js
import { Button, AppBar, Tabs } from './design-system'
```

### Editing rules

Do **not** fix bugs or restyle by editing files in `src/design-system/`. Those edits are
lost on the next sync and cause drift from the design source. A change that belongs to the
design system belongs in Claude Design; tell the user that rather than patching locally.
The only local edits that are legitimate are the compatibility deviations listed in
SYNC.md — and each one must be recorded there.

Never hardcode a hex color, font family, or font size in app code. Every value resolves
through a token (`var(--primary)`, `.label-m`, `var(--icon-size-s)`). Retheming happens by
editing a token in Claude Design, so a literal silently opts out of the whole system.

## Syncing the design system from Claude Design

When the user asks to sync, pull, or update the design system:

1. `DesignSync` `list_files` on the project ID above to see the current file list.
2. `get_file` each source file that matters — `tokens/*.css`, `styles.css`,
   `components/**/*.{jsx,d.ts}`, `widgets/**/*.{jsx,d.ts}`, `readme.md`, plus everything
   the Design System page renders: `guidelines/*.card.html`, `components/**/*.html`,
   `widgets/**/*.html`, `_ds_manifest.json`, `tokens/token-sync.js`,
   `tokens/palette-editor.js`. Skip `_ds_bundle.js` (rebuilt locally — see below),
   `uploads/`, and `thumbnail.html`.
3. Compare against the local copy and write only what actually changed. Report the diff
   to the user in plain language — which components changed, which tokens moved.
4. **Re-apply every deviation in SYNC.md** to any file that was overwritten. As of the
   last sync: `import * as React from 'react'` in `Tabs.jsx` and `AppBar.jsx`; direct
   `Icon` imports in `IconButton.jsx`, `MenuItem.jsx`, `TabItem.jsx`; no remote
   `@import url(...)` in `tokens/fonts.css` or `tokens/icons.css` (those stylesheets are
   `<link>`ed from `index.html` instead).
5. If a **new** component appeared, add it to both `index.js` and `index.d.ts`, add its
   card to `public/ds/`, and add a `cards` entry to `public/ds/_ds_manifest.json`.
   If one was deleted upstream, remove it from all four and grep the app for usages first.
6. Run `npm run build:ds` so the preview cards pick up the new components.
7. Verify before reporting success: `npm run build` must pass with no CSS-ordering
   warnings, then load the dev server. A clean typecheck is not enough — the font/icon
   `@import` bug built cleanly and still broke the page. Check the Design System page
   actually renders: every card is an iframe, so a broken bundle shows as blank frames
   rather than a build error. Verify via the DOM (each iframe's `#root` has children)
   rather than trusting a screenshot — the Browser pane returns blank captures when
   hidden, which looks exactly like a rendering failure but is not one.
8. Update the "Pulled" date in SYNC.md.

The user is a designer, not an engineer. Report what changed visually and what it means
for their app — not a file-by-file changelog.
