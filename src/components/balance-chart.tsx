import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

/** The big passive-income number; on Net worth also where it comes from, with an eye per portfolio
    to leave it out of the total (and bring it back). */
export function PassiveIncome({ total, parts, currency, onToggle }: { total: number; parts?: PassivePart[]; currency: Currency; onToggle?: (id: string, counted: boolean) => void }) {
  const t = useT()
  return (
    <div className="flex min-h-64 flex-col justify-between gap-4">
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
          <ul className="flex flex-col gap-0.5 font-sans text-xs text-muted-foreground">
            {parts.map((p) => (
              <li key={p.id} className={cn('flex items-center justify-between gap-3', !p.counted && 'text-faint-foreground')}>
                <span className="truncate">{p.name}</span>
                <span className="flex items-center gap-1">
                  <span className={cn('font-mono tabular-nums', !p.counted && 'line-through')}>
                    {p.value < 0 ? '−' : '+'}
                    {formatMoney(Math.abs(p.value))}
                  </span>
                  {onToggle && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={p.counted ? t.hideFromPassive(p.name) : t.showInPassive(p.name)}
                      title={p.counted ? t.hideFromPassive(p.name) : t.showInPassive(p.name)}
                      onClick={() => onToggle(p.id, !p.counted)}
                      className="-my-1 text-faint-foreground hover:text-foreground"
                    >
                      {p.counted ? <Eye /> : <EyeOff />}
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
