import { cn } from '@/lib/utils'
import type { CryptoSymbol } from '@/lib/assets'
import type { Entry } from '@/lib/entries'
import { formatAmount, formatUsdc } from '@/lib/format'
import type { PriceStatus } from '@/lib/prices'

type Props = {
  entries: Entry[]
  prices: Partial<Record<CryptoSymbol, number>>
  status: PriceStatus
}

const SEGMENT_COLORS = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5']

export function CryptoWidget({ entries, prices, status }: Props) {
  const holdings = summarise(entries, prices)
  const total = holdings.reduce((sum, h) => sum + (h.value ?? 0), 0)
  const pricing = holdings.some((h) => h.value === undefined)
  const empty = holdings.length === 0

  return (
    <section className="rounded-xl border bg-card p-8 sm:p-10">
      <div className="flex items-center justify-between">
        <h2 className="text-sm text-muted-foreground">Crypto</h2>
        {!empty && <LiveDot status={status} />}
      </div>

      <div className="mt-10 flex items-baseline gap-3 font-mono tabular-nums">
        {empty ? (
          <span className="text-5xl font-light tracking-tight text-faint-foreground">—</span>
        ) : (
          <>
            <span
              className={cn(
                'text-4xl font-light tracking-tight transition-opacity sm:text-5xl',
                pricing && 'opacity-50',
              )}
            >
              {formatUsdc(total)}
            </span>
            <span className="text-sm text-muted-foreground">USDC</span>
          </>
        )}
      </div>

      {!empty && (
        <>
          <div className="mt-10 flex h-1 gap-0.5 overflow-hidden rounded-full">
            {holdings.map((h, i) => (
              <div
                key={h.asset}
                className={cn('h-full transition-[flex-grow] duration-700', SEGMENT_COLORS[i % 5])}
                style={{ flexGrow: total > 0 ? (h.value ?? 0) / total : 1 }}
              />
            ))}
          </div>

          <ul className="mt-6 grid gap-3 font-mono text-sm tabular-nums">
            {holdings.map((h, i) => (
              <li key={h.asset} className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
                <span className="flex w-16 items-center gap-2.5">
                  <span className={cn('size-1.5 rounded-full', SEGMENT_COLORS[i % 5])} />
                  {h.asset}
                </span>
                <span className="truncate text-muted-foreground">{formatAmount(h.amount)}</span>
                <span className="text-right">
                  {h.value === undefined ? <span className="text-faint-foreground">···</span> : formatUsdc(h.value)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function LiveDot({ status }: { status: PriceStatus }) {
  const live = status === 'live'
  return (
    <span className="relative flex size-2" title={live ? 'Live' : 'Reconnecting'}>
      {live && <span className="absolute inset-0 animate-ping rounded-full bg-brand opacity-40" />}
      <span className={cn('relative size-2 rounded-full', live ? 'bg-brand' : 'bg-faint-foreground')} />
    </span>
  )
}

function summarise(entries: Entry[], prices: Partial<Record<CryptoSymbol, number>>) {
  const amounts = new Map<CryptoSymbol, number>()
  for (const e of entries) amounts.set(e.asset, (amounts.get(e.asset) ?? 0) + Number(e.amount))
  return [...amounts]
    .map(([asset, amount]) => {
      const price = prices[asset]
      return { asset, amount: String(amount), value: price === undefined ? undefined : amount * price }
    })
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
}
