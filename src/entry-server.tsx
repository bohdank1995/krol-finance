import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { AppShell } from '@/components/app-shell'
import { NotFound, PublicPage } from '@/components/site'

/* Used only while building: turns the public pages and the loading screen into HTML for `scripts/prerender.mjs`. */

export { canonicalOf, PAGES, SITE_URL, structuredData } from '@/lib/site'

export const render = (path: string) => renderToString(<StrictMode><PublicPage path={path} /></StrictMode>)
export const renderNotFound = () => renderToString(<StrictMode><NotFound /></StrictMode>)
export const renderLoading = () => renderToString(<AppShell sinceOpen={0} />)
