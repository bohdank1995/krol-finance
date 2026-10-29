import { useState } from 'react'
import logo from '@/assets/koshel-logo.svg'
import { Button } from '@/components/ui/button'
import { useSignInWithGoogle } from '@/lib/auth'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.63 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.7 14.54 2.75 12 2.75 6.89 2.75 2.75 6.89 2.75 12S6.89 21.25 12 21.25c5.34 0 8.88-3.75 8.88-9.04 0-.61-.07-1.07-.15-1.53z" />
    </svg>
  )
}

const POINTS = [
  'Portfolios for every account: type entries by hand or sync them automatically.',
  'Live prices, a net worth graph and the passive income your investments earn.',
  'Private: bank tokens only read data and are stored encrypted. Delete your account any time.',
]

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
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-10 px-4 py-16">
      {/* The home page for visitors (and Google's app review): what Koshel is, then sign-in. */}
      <div className="flex flex-col gap-5">
        <span
          role="img"
          aria-label="Koshel"
          style={{ maskImage: `url(${logo})`, WebkitMaskImage: `url(${logo})` }}
          className="aspect-958/370 h-14 self-start bg-foreground mask-contain mask-no-repeat"
        />
        <h1 className="text-2xl font-medium text-foreground">All your money in one place</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Koshel is a personal finance tracker. Add your cash, crypto and stocks, connect Monobank cards and
          Interactive Brokers, and see your net worth and how it changes over time — in USD, EUR or UAH.
        </p>
        <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
          {POINTS.map((p) => (
            <li key={p} className="flex gap-3">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
              {p}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <Button onClick={google} disabled={busy} className="h-12 gap-2">
          <GoogleIcon />
          Continue with Google
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-center text-xs text-faint-foreground">
          By continuing you agree to the{' '}
          <a href="/terms" className="underline underline-offset-4 hover:text-foreground">
            Terms
          </a>{' '}
          and{' '}
          <a href="/privacy" className="underline underline-offset-4 hover:text-foreground">
            Privacy policy
          </a>
          .
        </p>
      </div>

      <footer className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-faint-foreground">
        <a href="/privacy" className="hover:text-foreground">
          Privacy
        </a>
        <a href="/terms" className="hover:text-foreground">
          Terms
        </a>
        <a href="mailto:hello@koshel.me" className="hover:text-foreground">
          hello@koshel.me
        </a>
      </footer>
    </main>
  )
}
