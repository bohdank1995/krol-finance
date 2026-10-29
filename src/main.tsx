import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { convex } from '@/lib/convex'
import './index.css'
import App from './App.tsx'
import { Legal } from '@/components/legal'

const path = window.location.pathname.replace(/\/$/, '')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {path === '/privacy' || path === '/terms' ? (
      <Legal path={path} />
    ) : (
      <ConvexAuthProvider client={convex}>
        <App />
      </ConvexAuthProvider>
    )}
  </StrictMode>,
)
