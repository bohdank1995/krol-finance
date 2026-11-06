import { memo, useMemo } from 'react'
import { ASSETS, assetLabel, currencySign, isStock, type AssetSymbol } from '@/lib/assets'
import type { Entry, Payout } from '@/lib/entries'
import { changeTone, formatAmount, formatMoney } from '@/lib/format'
import type { DailyPrices } from '@/lib/history'
import { useT } from '@/lib/i18n'
import type { Range } from '@/lib/period'
import { balance, growth, passiveIn, series, valueOn } from '@/lib/portfolio'
import type { Currency } from '@/lib/preferences'
import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Props = {
  /** Every entry of the picked view (share-scaled, like the cards and the graph). */
  entries: Entry[]
  /** The part of them counted in passive income (money-only and switched-off sources left out). */
  earning: Entry[]
  /** Dividends and interest counted in passive income. */
  payouts: Payout[]
  /** Unset hides the passive income column (a view with no passive income). */
  showIncome: boolean
  prices: Partial<Record<AssetSymbol, number>>
  daily: DailyPrices
  currency: Currency
  range: Range
}

type Row = { asset: AssetSymbol; amount: number; value: number; income?: number }

const head = 'h-10 text-xs font-normal text-faint-foreground'
const enter = { animationDelay: '380ms' }
const dayOf = (iso: string) => iso.slice(0, 10)
const byAssetOf = (entries: Entry[]) => {
  const map = new Map<AssetSymbol, Entry[]>()
  for (const e of entries) {
    const list = map.get(e.asset)
    if (list) list.push(e)
    else map.set(e.asset, [e])
  }
  return map
}

/** "Bitcoin" for BTC, in the app's language where it has its own name; stocks show their ticker. */
const assetName = (a: AssetSymbol, names: Record<string, string>) =>
  names[a] ?? ASSETS.find((x) => x.symbol === a)?.name ?? assetLabel(a)

/**
 * What the picked view holds at the period's end, one row per asset, whenever it was bought, with what
 * each one earned during the period. The rows add up to the passive income number above.
 */
export const Holdings = memo(function Holdings({ entries, earning, payouts, showIncome, prices, daily, currency, range }: Props) {
  const t = useT()
  const today = new Date().toISOString().slice(0, 10)
  const rows = useMemo(() => {
    const byAsset = byAssetOf(entries)
    const earningByAsset = byAssetOf(earning)
    const list: Row[] = []
    for (const [asset, own] of byAsset) {
      const amount = own.filter((e) => dayOf(e.createdAt) <= range.to).reduce((sum, e) => sum + Number(e.amount), 0)
      // Up to today the live value; a period that ended earlier shows that day's close.
      const value = range.to >= today ? balance(own, prices, currency).total : valueOn(series(own, daily, prices, currency), range.to)
      const counted = earningByAsset.get(asset)
      const income = showIncome && counted ? passiveIn(growth(counted, daily, prices, currency), range).total : undefined
      // Sold before the period ended: still listed when it earned (or lost) something in it.
      if (Math.abs(amount) > 1e-9 || (income !== undefined && Math.abs(income) >= 0.005)) list.push({ asset, amount, value, income })
    }
    return list.sort((a, b) => b.value - a.value)
  }, [entries, earning, showIncome, prices, daily, currency, range, today])
  const rate = prices[currency]
  const paid = showIncome && rate
    ? payouts.filter((p) => (!range.from || p.date >= range.from) && p.date <= range.to).reduce((sum, p) => sum + p.usd, 0) / rate
    : 0

  if (rows.length === 0)
    return (
      <div className="animate-enter flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center" style={enter}>
        <p className="text-sm text-muted-foreground">{t.noAssets}</p>
      </div>
    )

  const income = (n: number | undefined) =>
    n === undefined ? (
      <span className="text-faint-foreground">—</span>
    ) : (
      <span className={changeTone(n)}>
        {n < 0 ? '−' : '+'}
        {formatMoney(Math.abs(n))}
      </span>
    )

  return (
    <Table className="animate-enter" style={enter}>
      <TableHeader className="max-sm:hidden">
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(head, 'pl-0')}>{t.asset}</TableHead>
          <TableHead className={cn(head, 'text-right')}>{t.amount}</TableHead>
          <TableHead className={cn(head, 'text-right')}>{t.value}, {currencySign(currency)}</TableHead>
          {showIncome && <TableHead className={cn(head, 'pr-0 text-right')}>{t.passiveIncome}, {currencySign(currency)}</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.asset}>
            {/* Phones: the asset and its amount on the left, its value and what it earned on the right. */}
            <TableCell className="w-full max-w-0 py-3 pl-0 sm:hidden">
              <span className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{assetName(r.asset, t.assetNames)}</span>
                  <span className="mt-0.5 block font-mono text-xs text-muted-foreground tabular-nums">
                    {formatAmount(String(r.amount))} {assetLabel(r.asset)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end font-mono tabular-nums">
                  <span>
                    {formatMoney(r.value)} <span className="text-muted-foreground">{currencySign(currency)}</span>
                  </span>
                  {showIncome && <span className="mt-0.5 text-xs">{income(r.income)}</span>}
                </span>
              </span>
            </TableCell>
            <TableCell className="hidden py-3.5 pl-0 sm:table-cell">
              <span className="inline-block min-w-[6ch] font-mono">{assetLabel(r.asset)}</span>
              {/* Stocks have no name of their own: the ticker alone. */}
              {!isStock(r.asset) && <span className="ml-3 text-muted-foreground">{assetName(r.asset, t.assetNames)}</span>}
            </TableCell>
            <TableCell className="hidden py-3.5 text-right font-mono text-muted-foreground tabular-nums sm:table-cell">
              {formatAmount(String(r.amount))}
            </TableCell>
            <TableCell className="hidden py-3.5 text-right font-mono tabular-nums sm:table-cell">{formatMoney(r.value)}</TableCell>
            {showIncome && (
              <TableCell className="hidden py-3.5 pr-0 text-right font-mono tabular-nums sm:table-cell">{income(r.income)}</TableCell>
            )}
          </TableRow>
        ))}
        {Math.abs(paid) >= 0.005 && (
          <TableRow>
            <TableCell className="w-full max-w-0 py-3 pl-0 sm:hidden">
              <span className="flex items-center justify-between gap-3">
                <span className="truncate">{t.payouts}</span>
                <span className="font-mono tabular-nums">{income(paid)}</span>
              </span>
            </TableCell>
            <TableCell colSpan={3} className="hidden py-3.5 pl-0 text-muted-foreground sm:table-cell">
              {t.payouts}
            </TableCell>
            <TableCell className="hidden py-3.5 pr-0 text-right font-mono tabular-nums sm:table-cell">{income(paid)}</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
})
