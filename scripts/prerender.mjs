import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { canonicalOf, PAGES, render, renderNotFound, SITE_URL, structuredData } from '../dist-ssr/entry-server.js'

/* Runs after `vite build`: writes each public page as real HTML (so Google reads it without running
   JavaScript), plus 404.html and the sitemap. The browser then starts the app on top as usual. */

// The styles go right into each page and the main font is requested early, so the first paint doesn't wait for them.
const font = readdirSync('dist/assets').find((f) => /^geist-latin-wght-normal-.*\.woff2$/.test(f))
const template = readFileSync('dist/index.html', 'utf8')
  .replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/, (_, href) => `<style>${readFileSync(join('dist', href), 'utf8')}</style>`)
  .replace('<!--seo-->', `<link rel="preload" href="/assets/${font}" as="font" type="font/woff2" crossorigin /><!--seo-->`)
const escape = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

function html(body, { title, description, head = '' }) {
  return template
    .replace(/<title>.*<\/title>/, `<title>${escape(title)}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*"/, `$1${escape(description)}"`)
    .replace('<!--seo-->', head)
    .replace('<div id="root"></div>', () => `<div id="root">${body}</div>`)
}

for (const page of PAGES) {
  const data = structuredData(page)
    .map((d) => `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, '\\u003c')}</script>`)
    .join('')
  const file = page.path === '/' ? 'dist/index.html' : join('dist', `${page.path}.html`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, html(render(page.path), { ...page, head: `<link rel="canonical" href="${canonicalOf(page)}" />${data}` }))
}

writeFileSync(
  'dist/404.html',
  html(renderNotFound(), { title: 'Page not found · Koshel', description: 'This page does not exist.', head: '<meta name="robots" content="noindex" />' }),
)

const urls = PAGES.map((p) => `  <url><loc>${canonicalOf(p)}</loc>${p.updated ? `<lastmod>${p.updated}</lastmod>` : ''}</url>`)
writeFileSync('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`)

rmSync('dist-ssr', { recursive: true })
console.log(`Prerendered ${PAGES.length} pages against ${SITE_URL}`)
