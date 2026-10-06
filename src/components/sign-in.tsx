import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useSignInWithGoogle } from '@/lib/auth'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.63 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.7 14.54 2.75 12 2.75 6.89 2.75 2.75 6.89 2.75 12S6.89 21.25 12 21.25c5.34 0 8.88-3.75 8.88-9.04 0-.61-.07-1.07-.15-1.53z" />
    </svg>
  )
}

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

  return (
    <div className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-3 px-4">
      <Button onClick={google} disabled={busy} className="h-12 gap-2">
        <GoogleIcon />
        Continue with Google
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
