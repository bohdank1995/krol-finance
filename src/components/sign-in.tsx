import { useState } from 'react'
import { ArrowLeft, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { signInWithEmail, signInWithGoogle } from '@/lib/auth'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.63 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.7 14.54 2.75 12 2.75 6.89 2.75 2.75 6.89 2.75 12S6.89 21.25 12 21.25c5.34 0 8.88-3.75 8.88-9.04 0-.61-.07-1.07-.15-1.53z" />
    </svg>
  )
}

export function SignIn() {
  const [mode, setMode] = useState<'choose' | 'email'>('choose')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const google = async () => {
    setBusy(true)
    setError('')
    // On success the browser leaves for Google, so only errors land here.
    const { error } = await signInWithGoogle()
    if (error) {
      setBusy(false)
      setError(error.message)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await signInWithEmail(email.trim())
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-6 px-4">
      {sent ? (
        <p className="text-sm text-muted-foreground">
          Check <span className="text-foreground">{email}</span> for your sign-in link.
        </p>
      ) : mode === 'choose' ? (
        <div className="grid gap-3">
          <Button onClick={google} disabled={busy} className="h-12 gap-2">
            <GoogleIcon />
            Continue with Google
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setError('')
              setMode('email')
            }}
            disabled={busy}
            className="h-12 gap-2"
          >
            <Mail />
            Continue with Magic Link
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-3">
          <Input
            autoFocus
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12"
          />
          <Button type="submit" disabled={busy || !email} className="h-12">
            Send link
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setError('')
              setMode('choose')
            }}
            className="h-10 gap-2 text-muted-foreground"
          >
            <ArrowLeft />
            Other options
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      )}
    </div>
  )
}
