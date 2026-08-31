import { defineConfig } from 'vite'

/* Builds public/ds/_ds_bundle.js — the global bundle the Design System preview
 * cards load. Cards are standalone HTML documents that pull React 18 UMD from a
 * CDN and then expect the components on window.LMSCollaboratoDesignSystem_72f1ad,
 * exactly as Claude Design serves them.
 *
 * Two consequences shape this config:
 *   - React is external and resolved from the global `React` the CDN sets up.
 *   - JSX therefore compiles with the classic transform; jsxInject supplies the
 *     factory under an alias so it cannot collide with the `import * as React`
 *     that Tabs.jsx and AppBar.jsx already declare.
 *
 * Run via `npm run build:ds` after any change to src/design-system.
 */
export default defineConfig({
  // The lib build emits into public/; it must not also try to copy public/ in.
  publicDir: false,
  esbuild: {
    jsx: 'transform',
    jsxFactory: '__dsReact.createElement',
    jsxFragment: '__dsReact.Fragment',
    jsxInject: "import * as __dsReact from 'react'",
  },
  build: {
    outDir: 'public/ds',
    emptyOutDir: false,
    lib: {
      entry: 'src/design-system/index.js',
      name: 'LMSCollaboratoDesignSystem_72f1ad',
      formats: ['iife'],
      fileName: () => '_ds_bundle.js',
    },
    rollupOptions: {
      external: ['react'],
      output: { globals: { react: 'React' } },
    },
  },
})
