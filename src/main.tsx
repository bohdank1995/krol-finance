import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { convex } from '@/lib/convex'
import './index.css'
import App from './App.tsx'
import { PublicPage } from '@/components/site'

const path = window.location.pathname.replace(/\/$/, '') || '/'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {path === '/' ? (
      <ConvexAuthProvider client={convex}>
        <App />
      </ConvexAuthProvider>
    ) : (
      <PublicPage path={path} />
    )}
  </StrictMode>,
)
