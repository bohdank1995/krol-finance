import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDay, formatMoney } from '@/lib/format'
import { useT } from '@/lib/i18n'
import type { Currency } from '@/lib/preferences'


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
                <span className="font-mono tabular-nums">{formatMoney(Number(v))} {currency}</span>
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
