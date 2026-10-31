import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { NotFound, PublicPage } from '@/components/site'

/* Used only while building: turns the public pages into HTML for `scripts/prerender.mjs`. */

export { canonicalOf, PAGES, SITE_URL, structuredData } from '@/lib/site'

export const render = (path: string) => renderToString(<StrictMode><PublicPage path={path} /></StrictMode>)
export const renderNotFound = () => renderToString(<StrictMode><NotFound /></StrictMode>)
