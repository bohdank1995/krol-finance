import { StrictMode, type ReactNode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import { PublicPage } from '@/components/site'

const path = window.location.pathname.replace(/\/$/, '') || '/'
const root = document.getElementById('root')!

/** Keeps the ready-made HTML on screen and brings it to life, so nothing is drawn twice. */
function show(page: ReactNode) {
  const ui = <StrictMode>{page}</StrictMode>
  if (root.hasChildNodes()) hydrateRoot(root, ui)
  else createRoot(root).render(ui)
}

if (path === '/') void import('./home').then(({ Home }) => show(<Home />))
else show(<PublicPage path={path} />)
