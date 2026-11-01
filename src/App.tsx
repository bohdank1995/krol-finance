import { lazy, Suspense, useEffect } from 'react'
import { useConvexAuth, useQuery } from 'convex/react'
import { SignIn } from '@/components/sign-in'
import { trackSignedIn } from '@/lib/analytics'
import { mayBeSignedIn } from '@/lib/auth'
import { api } from '../convex/_generated/api'

const loadDashboard = () => import('./Dashboard')
const Dashboard = lazy(loadDashboard)

// Returning users start downloading it right away.
if (mayBeSignedIn()) void loadDashboard()

function App() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const me = useQuery(api.users.me, isAuthenticated ? {} : 'skip')
  useEffect(() => {
    if (me) trackSignedIn(me.createdAt)
  }, [me])
  // Visitors keep seeing the home page while this loads; returning users see nothing yet, as before.
  if (isLoading) return mayBeSignedIn() ? null : <SignIn />
  if (!isAuthenticated) return <SignIn />
  return (
    <Suspense fallback={null}>
      <Dashboard email={me?.email ?? ''} image={me?.image} />
    </Suspense>
  )
}

export default App
