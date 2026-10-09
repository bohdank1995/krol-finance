import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { currencySign } from '@/lib/assets'
import { formatDay, formatMoney } from '@/lib/format'
import { useT } from '@/lib/i18n'
import type { Currency } from '@/lib/preferences'
import { cn } from '@/lib/utils'


const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

/** Same height as the graph, so nothing jumps when it arrives. */
export function BalanceChartSkeleton() {
  const t = useT()
  return <Skeleton aria-busy="true" aria-label={t.loadingGraph} className="h-64 w-full rounded-xl" />
}

export function BalanceChart({ points, currency }: { points: { date: string; value: number }[]; currency: Currency }) {
  // Also re-renders the month names when the language changes.
  const t = useT()
  const config = { value: { label: t.value, color: 'var(--chart-1)' } } satisfies ChartConfig
  if (points.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center font-mono text-5xl font-light text-faint-foreground">
        —
      </div>
    )
  }
  // Room on the right for the last date label; grows with the text size.
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full font-mono tabular-nums">
      <LineChart data={points} margin={{ top: 8, right: rem, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.4} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={48}
          tickFormatter={(d: string) => formatDay(d).slice(0, 6)}
        />
        <YAxis
          width="auto"
          tickLine={false}
          axisLine={false}
          domain={['auto', 'auto']}
          tickFormatter={(v: number) => compact.format(v)}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideIndicator
              labelFormatter={(_, p) => formatDay(p[0]?.payload.date ?? '')}
              formatter={(v) => (
                <span className="font-mono tabular-nums">{formatMoney(Number(v))} {currencySign(currency)}</span>
              )}
            />
          }
        />
        <Line
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  )
}

export type PassivePart = { id: string; name: string; value: number; counted: boolean }

/** The big passive-income number; on Net worth also where it comes from. Each row toggles that portfolio
    in or out of the total: the row fades and gets struck through right away, the total follows once the
    animation is done (recomputing it is the slow part). */
export function PassiveIncome({ total, parts, currency, onToggle }: { total: number; parts?: PassivePart[]; currency: Currency; onToggle?: (id: string, counted: boolean) => void }) {
  const t = useT()
  // Clicked rows, shown in their new state until the change is saved.
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const toggle = (id: string, counted: boolean) => {
    setPending((all) => ({ ...all, [id]: counted }))
    setTimeout(() => {
      onToggle?.(id, counted)
      setPending((all) => {
        const rest = { ...all }
        delete rest[id]
        return rest
      })
    }, 300)
  }
  return (
    <div className="flex flex-col gap-1 lg:min-h-64 lg:justify-between lg:gap-4">
      <span className="text-sm text-muted-foreground">{t.passiveIncome}</span>
      <div className="flex flex-col gap-3 font-mono tabular-nums">
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-3xl">
            {total < 0 ? '−' : '+'}
            {formatMoney(Math.abs(total))}
          </span>
          <span className="text-xs text-muted-foreground">{currencySign(currency)}</span>
        </span>
        {parts && parts.length > 0 && (
          <ul className="-mx-2 flex flex-col font-sans text-sm text-muted-foreground">
            {parts.map((p) => {
              const counted = pending[p.id] ?? p.counted
              const row = (
                <>
                  <span className="truncate">{p.name}</span>
                  <span className="flex items-center gap-2">
                    {onToggle && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity duration-200 group-hover/row:opacity-100 group-focus-visible/row:opacity-100">
                        {counted ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        {counted ? t.hide : t.show}
                      </span>
                    )}
                    <span className="relative font-mono tabular-nums">
                      {p.value < 0 ? '−' : '+'}
                      {formatMoney(Math.abs(p.value))}
                      {/* Strike-through that draws in from the left. */}
                      <span
                        aria-hidden
                        className={cn(
                          'absolute inset-x-0 top-1/2 h-px origin-left bg-current transition-transform duration-300 ease-out',
                          counted ? 'scale-x-0' : 'scale-x-100',
                        )}
                      />
                    </span>
                  </span>
                </>
              )
              const look = cn(
                'flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition-colors duration-300',
                !counted && 'text-faint-foreground',
              )
              return (
                <li key={p.id}>
                  {onToggle ? (
                    <button
                      type="button"
                      aria-pressed={counted}
                      aria-label={counted ? t.hideFromPassive(p.name) : t.showInPassive(p.name)}
                      title={counted ? t.hideFromPassive(p.name) : t.showInPassive(p.name)}
                      onClick={() => toggle(p.id, !counted)}
                      className={cn(look, 'group/row cursor-pointer outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50')}
                    >
                      {row}
                    </button>
                  ) : (
                    <div className={look}>{row}</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
