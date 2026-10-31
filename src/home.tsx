import { ConvexAuthProvider } from '@convex-dev/auth/react'
import App from '@/App'
import { convex } from '@/lib/convex'

/* The home page with sign-in and the app. Loaded separately: the other public pages need neither. */

export function Home() {
  return (
    <ConvexAuthProvider client={convex}>
      <App />
    </ConvexAuthProvider>
  )
}
