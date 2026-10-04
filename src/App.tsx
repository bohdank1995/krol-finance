import { useMemo, useState } from 'react'
import { BalanceChart, BalanceChartSkeleton } from '@/components/balance-chart'
import { EntriesTable, EntriesTableSkeleton } from '@/components/entries-table'
import { NET_WORTH, PortfolioCards, PortfolioCardsSkeleton } from '@/components/portfolio-cards'
import { SignIn } from '@/components/sign-in'
import { UserMenu } from '@/components/user-menu'
import { useSession } from '@/lib/auth'
import { useEntries, useLoaded, usePortfolios } from '@/lib/entries'
import { useDailyPrices } from '@/lib/history'
import { firstDay, series } from '@/lib/portfolio'
import { useLivePrices } from '@/lib/prices'

function App() {
  const session = useSession()
  if (session === undefined) return null
  if (!session) return <SignIn />
  return <Signed email={session.user.email ?? ''} />
}

function Signed({ email }: { email: string }) {
  const portfolios = usePortfolios()
  const entries = useEntries()
  const loaded = useLoaded()
  const [picked, setPicked] = useState(NET_WORTH)
  // A deleted portfolio falls back to Net worth.
  const selected = portfolios.some((p) => p.id === picked) ? picked : NET_WORTH
  const shown = useMemo(
    () => (selected === NET_WORTH ? entries : entries.filter((e) => e.portfolioId === selected)),
    [entries, selected],
  )

  const assets = useMemo(() => entries.map((e) => e.asset), [entries])
  const { prices, status } = useLivePrices(assets)
  const { prices: daily, ready: historyReady } = useDailyPrices(assets, firstDay(entries))
  const points = useMemo(() => series(shown, daily, prices), [shown, daily, prices])

  return (
    <div className="min-h-svh px-6 py-8 sm:py-14">
      <header className="flex items-center justify-end">
        <UserMenu email={email} />
      </header>
      <main className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-10 sm:mt-10">
        {!loaded ? (
          <>
            <PortfolioCardsSkeleton />
            <BalanceChartSkeleton />
            <EntriesTableSkeleton />
          </>
        ) : (
          <>
            <PortfolioCards
              portfolios={portfolios}
              entries={entries}
              prices={prices}
              status={status}
              selected={selected}
              onSelect={setPicked}
            />
            {historyReady ? <BalanceChart points={points} /> : <BalanceChartSkeleton />}
            <EntriesTable
              entries={shown}
              portfolios={portfolios}
              prices={prices}
              portfolioId={selected === NET_WORTH ? undefined : selected}
            />
          </>
        )}
      </main>
    </div>
  )
}

export default App
