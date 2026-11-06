import logo from '@/assets/koshel-logo.svg'
import type { ReactNode } from 'react'
import { Scrambling } from '@/components/scramble'
import { Skeleton } from '@/components/ui/skeleton'
import { SLOW } from '@/lib/reveal'

/* What a returning user sees while the app starts: the top bar at once, then placeholders laid out like
   the dashboard if loading takes longer than SLOW. It is also written into index.html at build time
   (`scripts/prerender.mjs`), so it shows before any JavaScript has arrived. No texts: the language
   isn't known yet. */

/** Delays a placeholder's fade-in until SLOW after the page opened, wherever it is drawn first, so
    swapping one placeholder for the next never restarts the fade. */
export const slowFade = (sinceOpen = performance.now()) => ({ animationDelay: `${SLOW - sinceOpen}ms` })

/** The Koshel logo. The file is used as a mask so it takes the theme's text color. */
export function Logo() {
  return (
    <span
      role="img"
      aria-label="Koshel"
      style={{ maskImage: `url(${logo})`, WebkitMaskImage: `url(${logo})` }}
      className="aspect-958/370 h-10 bg-foreground mask-contain mask-no-repeat"
    />
  )
}

/** Top bar, pinned while scrolling: the logo on the left, `account` on the right. */
export function Bar({ account }: { account: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 -mx-6 flex items-center justify-between gap-3 bg-background/85 px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-md">
      <Logo />
      {account}
    </header>
  )
}

/** Placeholders for the cards, graph and table. `toolbar` replaces the period placeholder once it can be drawn. */
export function DashboardSkeleton({ toolbar, sinceOpen }: { toolbar?: ReactNode; sinceOpen?: number }) {
  return (
    <div aria-busy="true" style={slowFade(sinceOpen)} className="animate-slow-in grid grid-cols-[minmax(0,1fr)] gap-10">
      <div className="grid gap-3">
        {toolbar ?? <Skeleton className="h-12 w-40 rounded-full" />}
        <div className="-mx-6 flex gap-2 overflow-hidden px-6 pb-2 sm:gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex min-h-30 w-[calc(100vw-3rem)] shrink-0 flex-col justify-between rounded-xl border bg-card p-5 sm:min-h-26 sm:w-62"
            >
              <Skeleton className="h-3.5 w-20" />
              <Scrambling length={8} className="mt-4 block font-mono text-2xl text-faint-foreground tabular-nums sm:text-xl" />
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <div className="grid">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-6 border-b py-4">
            <Skeleton className="hidden h-4 w-24 sm:block" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className={i % 2 ? 'hidden h-4 w-16 sm:block' : 'hidden h-4 w-32 sm:block'} />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** The whole loading screen. `sinceOpen` is 0 in the HTML written at build time. */
export function AppShell({ sinceOpen }: { sinceOpen?: number }) {
  return (
    <div className="min-h-svh px-6 pb-40 sm:pb-24">
      <Bar account={<div className="size-12 shrink-0 rounded-full border bg-input/30" />} />
      <main className="mt-4 sm:mt-6">
        <DashboardSkeleton sinceOpen={sinceOpen} />
      </main>
    </div>
  )
}
