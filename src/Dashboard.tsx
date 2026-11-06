import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { DashboardSkeleton } from '@/components/app-shell'
import { BalanceChart, BalanceChartSkeleton, PassiveIncome } from '@/components/balance-chart'
import { EntriesTable } from '@/components/entries-table'
import { Header, PeriodFilter } from '@/components/header'
import { NET_WORTH, PortfolioCards } from '@/components/portfolio-cards'
import { Ticker } from '@/components/ticker'
import { TooltipProvider } from '@/components/ui/tooltip'
import { earnsPassiveIncome, membersOf, netWorthEntries, netWorthPortfolios, savePeriod, scaleEntries, scalePayouts, setInPassiveIncome, useEntries, useGroups, useLoaded, usePayouts, usePortfolios } from '@/lib/entries'
import { fakeEntries, fakePayouts } from '@/lib/fake'
import { useDailyPrices } from '@/lib/history'
import { inRange, rangeOf, type Period } from '@/lib/period'
import { balance, firstDay, growth, passiveIn, series, withPayouts } from '@/lib/portfolio'
import { CURRENCIES, usePreferences } from '@/lib/preferences'
import { useLivePrices } from '@/lib/prices'
import { useReveal } from '@/lib/reveal'
import { cn } from '@/lib/utils'

/* Everything a signed-in user sees. Loaded separately, so visitors to the home page don't download it. */

export default function Dashboard({ email, image, saved }: { email: string; image?: string; saved: Period }) {
  const portfolios = usePortfolios()
  const groups = useGroups()
  const real = useEntries()
  const loaded = useLoaded()
  const { currency: chosen, fake, fakeSeed } = usePreferences()
  // The menu's switch answers at once; the page recalculates right after, without holding it up.
  const currency = useDeferredValue(chosen)
  // Fake mode swaps the amounts before anything else sees them (and makes the app read-only).
  const realPayouts = usePayouts()
  const payouts = useMemo(() => (fake ? fakePayouts(realPayouts, fakeSeed) : realPayouts), [realPayouts, fake, fakeSeed])
  const entries = useMemo(() => (fake ? fakeEntries(real, fakeSeed) : real), [real, fake, fakeSeed])
  // Opens on the period picked last time (saved on the account).
  const [period, setPeriod] = useState<Period>(saved)
  const pick = useCallback((next: Period) => {
    setPeriod(next)
    savePeriod(next)
  }, [])
  const range = useMemo(() => rangeOf(period), [period])
  const [picked, setPicked] = useState(NET_WORTH)
  // The edit mode of the cards (reorder, group, delete): everything below them steps aside meanwhile.
  const [editing, setEditing] = useState(false)
  // The sources the picked card stands for: one source, or a group's sources. Gone ones fall back to Net worth.
  const scope = useMemo(() => (picked === NET_WORTH ? [] : membersOf(picked, portfolios)), [picked, portfolios])
  const selected = scope.length > 0 ? picked : NET_WORTH
  const isGroup = selected !== NET_WORTH && groups.some((g) => g.id === selected)
  const shown = useMemo(() => {
    if (selected === NET_WORTH) return netWorthEntries(portfolios, entries)
    const ids = new Set(scope.map((p) => p.id))
    return entries.filter((e) => ids.has(e.portfolioId))
  }, [portfolios, entries, selected, scope])
  // The graph adds up the set percentages; the table keeps real amounts.
  const valued = useMemo(
    () => scaleEntries(portfolios, shown, selected === NET_WORTH ? 'netWorth' : 'card'),
    [portfolios, shown, selected],
  )

  // The display currency is priced too, to convert USD values into it. Every currency is kept
  // priced, so switching needs no download.
  const assets = useMemo(() => [...entries.map((e) => e.asset), currency], [entries, currency])
  const live = useMemo(() => [...entries.map((e) => e.asset), ...CURRENCIES, 'PLN' as const], [entries])
  const { prices, status } = useLivePrices(live)
  const { prices: daily, ready: historyReady } = useDailyPrices(assets, firstDay(entries), CURRENCIES)
  const points = useMemo(
    () => series(valued, daily, prices, currency).filter((p) => (!range.from || p.date >= range.from) && p.date <= range.to),
    [valued, daily, prices, currency, range],
  )
  // Net worth's passive income leaves out the portfolios switched off in its list, and those holding only money (bank
  // cards included); a group leaves out its money-only ones.
  const passive = useMemo(() => {
    const off = new Set(
      selected === NET_WORTH
        ? portfolios.filter((p) => !p.inPassiveIncome || !earnsPassiveIncome(p, entries)).map((p) => p.id)
        : scope.filter((p) => !earnsPassiveIncome(p, entries)).map((p) => p.id),
    )
    const ids = new Set(scope.map((p) => p.id))
    return passiveIn(
      withPayouts(
        growth(valued.filter((e) => !off.has(e.portfolioId)), daily, prices, currency),
        scalePayouts(portfolios, payouts, selected === NET_WORTH ? 'netWorth' : 'card').filter(
          (r) => (selected === NET_WORTH || ids.has(r.portfolioId)) && !off.has(r.portfolioId),
        ),
        prices[currency],
      ),
      range,
    )
  }, [valued, daily, prices, currency, range, portfolios, entries, payouts, selected, scope])
  // Net worth: where the passive income comes from, per portfolio (zeros left out unless switched off, losses kept).
  // Sorted by value only, so hiding one doesn't make the rows jump around.
  const parts = useMemo(() => {
    if (selected !== NET_WORTH) return undefined
    return netWorthPortfolios(portfolios)
      .filter((h) => earnsPassiveIncome(h, entries))
      .map((h) => {
        const own = scaleEntries([h], entries.filter((e) => e.portfolioId === h.id), 'netWorth')
        const mine = scalePayouts([h], payouts.filter((r) => r.portfolioId === h.id), 'netWorth')
        const { total } = passiveIn(withPayouts(growth(own, daily, prices, currency), mine, prices[currency]), range)
        return { id: h.id, name: h.name, value: total, counted: h.inPassiveIncome }
      })
      .filter((p) => !p.counted || Math.abs(p.value) >= 0.005)
      .sort((a, b) => b.value - a.value)
  }, [selected, portfolios, entries, payouts, daily, prices, currency, range])
  const rows = useMemo(() => shown.filter((e) => inRange(e.createdAt, range)), [shown, range])
  const withPassive = selected === NET_WORTH || scope.some((p) => earnsPassiveIncome(p, entries))

  // Reveal the page once its numbers are real: data in, every asset priced, graph history in.
  const priced = loaded && !balance(entries, prices, currency).pricing
  const ready = useReveal(loaded, priced && historyReady)

  // A soft settle when the numbers change currency, instead of a hard jump.
  const mainRef = useRef<HTMLElement>(null)
  const lastCurrency = useRef(currency)
  useEffect(() => {
    if (lastCurrency.current === currency) return
    lastCurrency.current = currency
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    mainRef.current?.animate({ opacity: [0.5, 1] }, { duration: 220, easing: 'ease-out' })
  }, [currency])
  const toolbar = useMemo(() => <PeriodFilter period={period} onChange={pick} />, [period, pick])
  const startEditing = useCallback(() => setEditing(true), [])

  return (
    <TooltipProvider delay={150}>
      <div className="min-h-svh px-6 pb-40 sm:pb-24">
        <Header email={email} image={image} />
        <main ref={mainRef} className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-10 sm:mt-6">
          {!ready ? (
            <DashboardSkeleton toolbar={toolbar} />
          ) : (
            <>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
                <PortfolioCards
                  toolbar={toolbar}
                  editing={editing}
                  // Edit mode: reorder, group and delete sources. Not in Fake numbers (read-only).
                  onEdit={!fake && portfolios.length > 0 ? startEditing : undefined}
                  onEditingDone={() => setEditing(false)}
                  portfolios={portfolios}
                  groups={groups}
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
              </div>
              {/* Steps aside while the cards are being edited: fades out and folds up, then comes back. */}
              <div
                inert={editing}
                className={cn(
                  'grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out',
                  editing ? 'pointer-events-none -mt-10 grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr]',
                )}
              >
                <div className={cn('grid min-h-0 grid-cols-[minmax(0,1fr)] gap-10', editing && 'overflow-hidden')}>
                  {historyReady ? (
                    <div
                      className={cn(
                        'grid grid-cols-[minmax(0,1fr)] gap-6',
                        withPassive && 'lg:grid-cols-[minmax(0,1fr)_1px_16rem] lg:gap-8',
                      )}
                    >
                      <div className="animate-enter min-w-0" style={{ animationDelay: '200ms' }}>
                        <BalanceChart points={points} currency={currency} />
                      </div>
                      {withPassive && (
                        <>
                          {/* On phones passive income comes first, above the graph. */}
                          <div aria-hidden className="animate-enter h-px bg-border max-lg:-order-1 lg:h-auto lg:w-px" style={{ animationDelay: '260ms' }} />
                          <div className="animate-enter max-lg:-order-2" style={{ animationDelay: '300ms' }}>
                            <PassiveIncome total={passive.total} parts={parts} currency={currency} onToggle={fake ? undefined : setInPassiveIncome} />
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <BalanceChartSkeleton />
                  )}
                  <EntriesTable
                    entries={rows}
                    portfolios={selected === NET_WORTH ? portfolios : scope}
                    prices={prices}
                    portfolioId={selected === NET_WORTH || isGroup ? undefined : selected}
                    currency={currency}
                    readOnly={fake}
                    filtered={period !== 'all'}
                    view={`${selected}:${JSON.stringify(period)}`}
                  />
                </div>
              </div>
            </>
          )}
        </main>
        {ready && (
          <div inert={editing} className={cn('transition-opacity duration-300', editing && 'opacity-0')}>
            <Ticker prices={prices} assets={live} currency={currency} />
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
