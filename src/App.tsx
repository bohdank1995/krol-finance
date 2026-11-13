import { lazy, Suspense, useEffect } from 'react'
import { useConvexAuth, useQuery } from 'convex/react'
import { AppShell } from '@/components/app-shell'
import { SignIn } from '@/components/sign-in'
import { identifyUser, trackSignedIn } from '@/lib/analytics'
import { mayBeSignedIn } from '@/lib/auth'
import { reloadOnce } from '@/lib/chunks'
import { periodOf } from '@/lib/period'
import { api } from '../convex/_generated/api'

const loadDashboard = () => import('./Dashboard').catch(reloadOnce)
const Dashboard = lazy(loadDashboard)

// Returning users start downloading it right away.
if (mayBeSignedIn()) void loadDashboard()

function App() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const me = useQuery(api.users.me, isAuthenticated ? {} : 'skip')
  useEffect(() => {
    if (!me) return
    identifyUser(me.id)
    trackSignedIn(me.createdAt)
  }, [me])
  // Visitors keep seeing the home page while this loads; returning users see the loading screen.
  if (isLoading) return mayBeSignedIn() ? <AppShell /> : <SignIn />
  if (!isAuthenticated) return <SignIn />
  // The account (with the saved period) comes first, so the dashboard opens on the right period.
  if (me === undefined) return <AppShell />
  return (
    <Suspense fallback={<AppShell />}>
      <Dashboard email={me?.email ?? ''} image={me?.image} saved={periodOf(me?.period)} />
    </Suspense>
  )
}

export default App
