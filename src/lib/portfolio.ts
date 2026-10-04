import { isDollar, type AssetSymbol } from './assets'
import type { DailyPrices } from './history'
import type { Entry } from './entries'

type Prices = Partial<Record<AssetSymbol, number>>

const dayOf = (iso: string) => iso.slice(0, 10) // UTC day, matching Binance candles

/** What the entries add up to, in USD. `pricing` is true while some asset has no price yet. */
export function balance(entries: Entry[], prices: Prices) {
  let total = 0
  let pricing = false
  for (const [asset, amount] of amountsByAsset(entries)) {
    const price = prices[asset]
    if (price === undefined) pricing = true
    else total += amount * price
  }
  return { total, pricing }
}

function amountsByAsset(entries: Entry[]) {
  const amounts = new Map<AssetSymbol, number>()
  for (const e of entries) amounts.set(e.asset, (amounts.get(e.asset) ?? 0) + Number(e.amount))
  return amounts
}

export function firstDay(entries: Entry[]) {
  return entries.length ? dayOf(entries.reduce((a, e) => (e.createdAt < a ? e.createdAt : a), entries[0].createdAt)) : undefined
}

/** One point per day from the first entry to today: the running amounts valued at that day's close. */
export function series(entries: Entry[], daily: DailyPrices, live: Prices) {
  const start = firstDay(entries)
  if (!start) return []
  const today = dayOf(new Date().toISOString())
  const sorted = [...entries].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))

  const amounts = new Map<AssetSymbol, number>()
  const lastPrice = new Map<AssetSymbol, number>()
  const points: { date: string; value: number }[] = []
  let next = 0

  for (let t = Date.parse(`${start}T00:00:00Z`); ; t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10)
    if (date > today) break
    while (next < sorted.length && dayOf(sorted[next].createdAt) <= date) {
      const e = sorted[next++]
      amounts.set(e.asset, (amounts.get(e.asset) ?? 0) + Number(e.amount))
    }
    let value = 0
    for (const [asset, amount] of amounts) {
      let price = 1
      if (!isDollar(asset)) {
        const close = date === today ? live[asset] : daily[asset]?.[date]
        if (close !== undefined) lastPrice.set(asset, close)
        else if (!lastPrice.has(asset)) {
          // Before the first known candle: use the earliest one available.
          const days = daily[asset]
          const first = days && Object.keys(days).sort()[0]
          if (first) lastPrice.set(asset, days[first])
        }
        price = lastPrice.get(asset) ?? 0
      }
      value += amount * price
    }
    points.push({ date, value })
  }

  // A lone point can't draw a line: show the balance rising from zero the day before.
  if (points.length === 1) {
    const before = new Date(Date.parse(`${start}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
    points.unshift({ date: before, value: 0 })
  }
  return points
}
