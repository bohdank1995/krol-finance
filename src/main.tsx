import { StrictMode, type ReactNode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import { PublicPage } from '@/components/site'
import { startAnalytics } from '@/lib/analytics'
import { reloadOnce } from '@/lib/chunks'

const path = window.location.pathname.replace(/\/$/, '') || '/'
const root = document.getElementById('root')!
/** Set by index.html for returning users: the loading screen is up instead of the home page. */
const returning = 'loading' in root.dataset

/** Keeps the ready-made HTML on screen and brings it to life, so nothing is drawn twice. The loading
    screen is just replaced. */
function show(page: ReactNode) {
  const ui = <StrictMode>{page}</StrictMode>
  if (root.hasChildNodes() && !returning) hydrateRoot(root, ui)
  else createRoot(root).render(ui)
}

if (path === '/') {
  // Returning users need the dashboard too: download it alongside the home page, not after it.
  if (returning) void import('./Dashboard').catch(() => {})
  void import('./home').catch(reloadOnce).then(({ Home }) => show(<Home />))
} else show(<PublicPage path={path} />)

startAnalytics()
