import { useMemo, useState } from 'react'
import { BalanceChart, BalanceChartSkeleton } from '@/components/balance-chart'
import { EntriesTable, EntriesTableSkeleton } from '@/components/entries-table'
import { Header, PeriodFilter } from '@/components/header'
import { NET_WORTH, PortfolioCards, PortfolioCardsSkeleton } from '@/components/portfolio-cards'
import { SignIn } from '@/components/sign-in'
import { useSession } from '@/lib/auth'
import { netWorthEntries, scaleEntries, useEntries, useLoaded, usePortfolios } from '@/lib/entries'
import { fakeEntries } from '@/lib/fake'
import { useDailyPrices } from '@/lib/history'
import { inRange, rangeOf, type Period } from '@/lib/period'
import { firstDay, series } from '@/lib/portfolio'
import { usePreferences } from '@/lib/preferences'
import { useLivePrices } from '@/lib/prices'

function App() {
  const session = useSession()
  if (session === undefined) return null
  if (!session) return <SignIn />
  return <Signed email={session.user.email ?? ''} />
}

function Signed({ email }: { email: string }) {
  const portfolios = usePortfolios()
  const real = useEntries()
  const loaded = useLoaded()
  const { currency, fake, fakeSeed } = usePreferences()
  // Fake mode swaps the amounts before anything else sees them (and makes the app read-only).
  const entries = useMemo(() => (fake ? fakeEntries(real, fakeSeed) : real), [real, fake, fakeSeed])
  const [period, setPeriod] = useState<Period>('all')
  const range = useMemo(() => rangeOf(period), [period])
  const [picked, setPicked] = useState(NET_WORTH)
  // A deleted portfolio falls back to Net worth.
  const selected = portfolios.some((p) => p.id === picked) ? picked : NET_WORTH
  const shown = useMemo(
    () => (selected === NET_WORTH ? netWorthEntries(portfolios, entries) : entries.filter((e) => e.portfolioId === selected)),
    [portfolios, entries, selected],
  )
  // The graph adds up the set percentages; the table keeps real amounts.
  const valued = useMemo(
    () => scaleEntries(portfolios, shown, selected === NET_WORTH ? 'netWorth' : 'card'),
    [portfolios, shown, selected],
  )

  // The display currency is priced too, to convert USD values into it.
  const assets = useMemo(() => [...entries.map((e) => e.asset), currency], [entries, currency])
  const { prices, status } = useLivePrices(assets)
  const { prices: daily, ready: historyReady } = useDailyPrices(assets, firstDay(entries))
  const points = useMemo(
    () => series(valued, daily, prices, currency).filter((p) => (!range.from || p.date >= range.from) && p.date <= range.to),
    [valued, daily, prices, currency, range],
  )
  const rows = useMemo(() => shown.filter((e) => inRange(e.createdAt, range)), [shown, range])

  return (
    <div className="min-h-svh px-6 pb-28 sm:pb-14">
      <Header email={email} />
      <main className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-10 sm:mt-6">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
          <PeriodFilter period={period} onChange={setPeriod} />
          {loaded ? (
            <PortfolioCards
              portfolios={portfolios}
              entries={entries}
              prices={prices}
              daily={daily}
              currency={currency}
              range={range}
              status={status}
              selected={selected}
              onSelect={setPicked}
              readOnly={fake}
            />
          ) : (
            <PortfolioCardsSkeleton />
          )}
        </div>
        {!loaded ? (
          <>
            <BalanceChartSkeleton />
            <EntriesTableSkeleton />
          </>
        ) : (
          <>
            {historyReady ? <BalanceChart points={points} currency={currency} /> : <BalanceChartSkeleton />}
            <EntriesTable
              entries={rows}
              portfolios={portfolios}
              prices={prices}
              portfolioId={selected === NET_WORTH ? undefined : selected}
              currency={currency}
              readOnly={fake}
              filtered={period !== 'all'}
            />
          </>
        )}
      </main>
    </div>
  )
}

export default App
