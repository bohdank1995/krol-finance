import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDay, formatUsd } from '@/lib/format'

const config = { value: { label: 'Value', color: 'var(--chart-1)' } } satisfies ChartConfig

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

/** Same height as the graph, so nothing jumps when it arrives. */
export function BalanceChartSkeleton() {
  return <Skeleton aria-busy="true" aria-label="Loading graph" className="h-64 w-full rounded-xl" />
}

export function BalanceChart({ points }: { points: { date: string; value: number }[] }) {
  if (points.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center font-mono text-5xl font-light text-faint-foreground">
        —
      </div>
    )
  }
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full font-mono tabular-nums">
      <LineChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
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
          width={44}
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
                <span className="font-mono tabular-nums">{formatUsd(Number(v))} USD</span>
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
