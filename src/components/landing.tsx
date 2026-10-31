import dashboardSmall from '@/assets/landing-dashboard-768.webp'
import dashboardMedium from '@/assets/landing-dashboard-1440.webp'
import dashboard from '@/assets/landing-dashboard.webp'
import logo from '@/assets/koshel-logo.svg'
import { SiteFooter } from '@/components/site'
import { Button } from '@/components/ui/button'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.63 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.7 14.54 2.75 12 2.75 6.89 2.75 2.75 6.89 2.75 12S6.89 21.25 12 21.25c5.34 0 8.88-3.75 8.88-9.04 0-.61-.07-1.07-.15-1.53z" />
    </svg>
  )
}

/** The home page itself, without sign-in logic: it's also rendered ahead of time for search engines. */
export function Landing({ onGoogle, busy, error }: { onGoogle?: () => void; busy?: boolean; error?: string }) {
  return (
    <main className="flex min-h-svh flex-col items-center gap-14 overflow-x-clip px-4 pt-16 pb-10 sm:pt-24">
      {/* The home page for visitors (and Google's app review): what Koshel is for, sign-in, a look at the app. */}
      <div className="flex max-w-xl flex-col items-center gap-6 text-center">
        <span
          role="img"
          aria-label="Koshel"
          style={{ maskImage: `url(${logo})`, WebkitMaskImage: `url(${logo})` }}
          className="aspect-958/370 h-14 bg-foreground mask-contain mask-no-repeat"
        />
        <h1 className="text-3xl font-medium text-balance text-foreground sm:text-5xl">Make financial freedom real</h1>
        <p className="max-w-md text-base text-balance text-muted-foreground">
          A finance tracker designed to show your passive income — and encourage you to grow it.
        </p>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <Button onClick={onGoogle} disabled={busy} className="h-12 gap-2">
            <GoogleIcon />
            Continue with Google
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">
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
      </div>

      {/* The dashboard (fake numbers, neutral names), cut off below the graph and fading into the page. */}
      <div className="relative w-full max-w-5xl">
        <div className="overflow-hidden rounded-t-xl border border-b-0 border-border shadow-[0_24px_80px_-12px_rgb(0_0_0/0.7)]">
          <img
            src={dashboard}
            srcSet={`${dashboardSmall} 768w, ${dashboardMedium} 1440w, ${dashboard} 2880w`}
            sizes="(min-width: 1056px) 1024px, calc(100vw - 2rem)"
            width={2880}
            height={1236}
            fetchPriority="high"
            alt="The Koshel dashboard: portfolio cards, a net worth graph and passive income"
            className="h-auto w-full"
          />
        </div>
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-b from-transparent to-background" />
      </div>

      <SiteFooter />
    </main>
  )
}
