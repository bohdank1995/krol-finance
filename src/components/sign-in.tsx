import { useState } from 'react'
import { Landing } from '@/components/landing'
import { LANDING } from '@/content/landing'
import { trackGoogleButtonClicked } from '@/lib/analytics'
import { useSignInWithGoogle } from '@/lib/auth'
import { currentLanguage } from '@/lib/language'

export function SignIn() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const signInWithGoogle = useSignInWithGoogle()

  const google = async () => {
    setBusy(true)
    setError('')
    trackGoogleButtonClicked()
    // On success the browser leaves for Google, so only errors land here.
    try {
      await signInWithGoogle()
    } catch (e) {
      console.error(e)
      setBusy(false)
      setError(LANDING[currentLanguage()].signInFailed)
    }
  }

  return <Landing onGoogle={google} busy={busy} error={error} />
}
