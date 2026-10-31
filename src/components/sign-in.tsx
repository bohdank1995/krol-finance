import { useState } from 'react'
import { Landing } from '@/components/landing'
import { useSignInWithGoogle } from '@/lib/auth'

export function SignIn() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const signInWithGoogle = useSignInWithGoogle()

  const google = async () => {
    setBusy(true)
    setError('')
    // On success the browser leaves for Google, so only errors land here.
    try {
      await signInWithGoogle()
    } catch (e) {
      console.error(e)
      setBusy(false)
      setError('Could not sign in with Google. Try again.')
    }
  }

  return <Landing onGoogle={google} busy={busy} error={error} />
}
