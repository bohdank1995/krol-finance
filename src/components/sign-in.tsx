import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { signInWithEmail } from '@/lib/auth'

export function SignIn() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      )}
    </div>
  )
}
