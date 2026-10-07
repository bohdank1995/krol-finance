import { useMemo, useState } from 'react'
import { BalanceChart, BalanceChartSkeleton, PassiveIncome } from '@/components/balance-chart'
import { EntriesTable, EntriesTableSkeleton } from '@/components/entries-table'
import { Header, PeriodFilter } from '@/components/header'
import { NET_WORTH, PortfolioCards, PortfolioCardsSkeleton } from '@/components/portfolio-cards'
import { SignIn } from '@/components/sign-in'
import { useConvexAuth, useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import { netWorthEntries, netWorthPortfolios, scaleEntries, scalePayouts, setInPassiveIncome, useEntries, useLoaded, usePayouts, usePortfolios } from '@/lib/entries'
import { fakeEntries, fakePayouts } from '@/lib/fake'
import { useDailyPrices } from '@/lib/history'
import { inRange, rangeOf, type Period } from '@/lib/period'
import { firstDay, growth, passiveIn, series, withPayouts } from '@/lib/portfolio'
import { usePreferences } from '@/lib/preferences'
import { useLivePrices } from '@/lib/prices'

function App() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const me = useQuery(api.users.me, isAuthenticated ? {} : 'skip')
  if (isLoading) return null
  if (!isAuthenticated) return <SignIn />
  return <Signed email={me?.email ?? ''} image={me?.image} />
}

function Signed({ email, image }: { email: string; image?: string }) {
  const portfolios = usePortfolios()
  const real = useEntries()
  const loaded = useLoaded()
  const { currency, fake, fakeSeed } = usePreferences()
  // Fake mode swaps the amounts before anything else sees them (and makes the app read-only).
  const realPayouts = usePayouts()
  const payouts = useMemo(() => (fake ? fakePayouts(realPayouts, fakeSeed) : realPayouts), [realPayouts, fake, fakeSeed])
  const entries = useMemo(() => (fake ? fakeEntries(real, fakeSeed) : real), [real, fake, fakeSeed])
  const [period, setPeriod] = useState<Period>('last-month')
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
  // Net worth's passive income leaves out the portfolios switched off in its list.
  const passive = useMemo(() => {
    const off = new Set(selected === NET_WORTH ? portfolios.filter((p) => !p.inPassiveIncome).map((p) => p.id) : [])
    return passiveIn(
      withPayouts(
        growth(valued.filter((e) => !off.has(e.portfolioId)), daily, prices, currency),
        scalePayouts(portfolios, payouts, selected === NET_WORTH ? 'netWorth' : 'card').filter(
          (r) => (selected === NET_WORTH || r.portfolioId === selected) && !off.has(r.portfolioId),
        ),
        prices[currency],
      ),
      range,
    )
  }, [valued, daily, prices, currency, range, portfolios, payouts, selected])
  // Net worth: where the passive income comes from, per portfolio (zeros left out unless switched off, losses kept).
  const parts = useMemo(() => {
    if (selected !== NET_WORTH) return undefined
    return netWorthPortfolios(portfolios)
      .map((h) => {
        const own = scaleEntries([h], entries.filter((e) => e.portfolioId === h.id), 'netWorth')
        const mine = scalePayouts([h], payouts.filter((r) => r.portfolioId === h.id), 'netWorth')
        const { total } = passiveIn(withPayouts(growth(own, daily, prices, currency), mine, prices[currency]), range)
        return { id: h.id, name: h.name, value: total, counted: h.inPassiveIncome }
      })
      .filter((p) => !p.counted || Math.abs(p.value) >= 0.005)
      .sort((a, b) => Number(b.counted) - Number(a.counted) || b.value - a.value)
  }, [selected, portfolios, entries, payouts, daily, prices, currency, range])
  const rows = useMemo(() => shown.filter((e) => inRange(e.createdAt, range)), [shown, range])

  return (
    <div className="min-h-svh px-6 pb-28 sm:pb-14">
      <Header email={email} image={image} />
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
            {historyReady ? (
              <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_1px_16rem] lg:gap-8">
                <BalanceChart points={points} currency={currency} />
                <div aria-hidden className="h-px bg-border lg:h-auto lg:w-px" />
                <PassiveIncome total={passive.total} parts={parts} currency={currency} onToggle={fake ? undefined : setInPassiveIncome} />
              </div>
            ) : (
              <BalanceChartSkeleton />
            )}
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
