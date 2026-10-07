import { isDollar, type AssetSymbol } from './assets'
import type { DailyPrices } from './history'
import type { Entry, Payout } from './entries'

type Prices = Partial<Record<AssetSymbol, number>>

const dayOf = (iso: string) => iso.slice(0, 10) // UTC day, matching Binance candles

/** What the entries add up to, in `currency`. `pricing` is true while some asset (or the currency) has no price yet. */
export function balance(entries: Entry[], prices: Prices, currency: AssetSymbol = 'USD') {
  let total = 0
  let pricing = false
  for (const [asset, amount] of amountsByAsset(entries)) {
    const price = prices[asset]
    if (price === undefined) pricing = true
    else total += amount * price
  }
  const rate = prices[currency]
  if (rate === undefined) return { total: 0, pricing: true }
  return { total: total / rate, pricing }
}

function amountsByAsset(entries: Entry[]) {
  const amounts = new Map<AssetSymbol, number>()
  for (const e of entries) amounts.set(e.asset, (amounts.get(e.asset) ?? 0) + Number(e.amount))
  return amounts
}

export function firstDay(entries: Entry[]) {
  return entries.length ? dayOf(entries.reduce((a, e) => (e.createdAt < a ? e.createdAt : a), entries[0].createdAt)) : undefined
}

type Day = {
  date: string
  /** Amounts held at the start of the day, before its entries. */
  before: Map<AssetSymbol, number>
  /** The entries made that day. */
  added: Entry[]
  /** Amounts held at the end of the day. */
  amounts: Map<AssetSymbol, number>
  /** USD price of an asset that day (live today, the daily close before). */
  priceOn: (asset: AssetSymbol) => number
}

/** Walks every day from the first entry to today, applying the entries as it goes. */
function* days(entries: Entry[], daily: DailyPrices, live: Prices): Generator<Day> {
  const start = firstDay(entries)
  if (!start) return
  const today = dayOf(new Date().toISOString())
  const sorted = [...entries].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))

  const amounts = new Map<AssetSymbol, number>()
  const lastPrice = new Map<AssetSymbol, number>()
  let next = 0

  for (let t = Date.parse(`${start}T00:00:00Z`); ; t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10)
    if (date > today) break
    const before = new Map(amounts)
    const added: Entry[] = []
    while (next < sorted.length && dayOf(sorted[next].createdAt) <= date) {
      const e = sorted[next++]
      added.push(e)
      amounts.set(e.asset, (amounts.get(e.asset) ?? 0) + Number(e.amount))
    }
    const priceOn = (asset: AssetSymbol) => {
      if (isDollar(asset)) return 1
      const close = date === today ? live[asset] : daily[asset]?.[date]
      if (close !== undefined) lastPrice.set(asset, close)
      else if (!lastPrice.has(asset)) {
        // Before the first known candle: use the earliest one available.
        const days = daily[asset]
        const first = days && Object.keys(days).sort()[0]
        if (first) lastPrice.set(asset, days[first])
      }
      return lastPrice.get(asset) ?? 0
    }
    yield { date, before, added, amounts, priceOn }
  }
}

/** One point per day from the first entry to today: the running amounts valued at that day's close, in `currency`. */
export function series(entries: Entry[], daily: DailyPrices, live: Prices, currency: AssetSymbol = 'USD') {
  const points: { date: string; value: number }[] = []
  for (const { date, amounts, priceOn } of days(entries, daily, live)) {
    let value = 0
    for (const [asset, amount] of amounts) value += amount * priceOn(asset)
    const rate = priceOn(currency)
    points.push({ date, value: rate ? value / rate : 0 })
  }

  // A lone point can't draw a line: show the balance rising from zero the day before.
  if (points.length === 1) {
    const before = new Date(Date.parse(`${points[0].date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
    points.unshift({ date: before, value: 0 })
  }
  return points
}

/** Passive income: running total of what the holdings earned just by changing in price, in `currency`.
 *  Each day counts what was held the day before times the price change, so deposits and withdrawals add nothing. */
export function growth(entries: Entry[], daily: DailyPrices, live: Prices, currency: AssetSymbol = 'USD') {
  const points: { date: string; value: number }[] = []
  const previous = new Map<AssetSymbol, number>()
  let total = 0
  for (const { date, before, added, amounts, priceOn } of days(entries, daily, live)) {
    const rate = priceOn(currency)
    let gained = 0
    for (const [asset, amount] of before) {
      const was = previous.get(asset)
      if (was !== undefined) gained += amount * (priceOn(asset) - was)
    }
    // A purchase with a known price earns from what was paid, even on the day it was made.
    for (const e of added) if (e.price !== undefined && Number(e.amount) > 0) gained += Number(e.amount) * (priceOn(e.asset) - e.price)
    for (const asset of amounts.keys()) previous.set(asset, priceOn(asset))
    if (rate) total += gained / rate
    points.push({ date, value: total })
  }
  return points
}

/** The value on a day: the last point on or before it (0 before the first entry). */
export function valueOn(points: { date: string; value: number }[], day: string) {
  let value = 0
  for (const p of points) {
    if (p.date > day) break
    value = p.value
  }
  return value
}

/** Adds dividends and interest to the running price growth. `rate` is USD per unit of the display currency.
 *  Payouts from before the first point are folded into it. */
export function withPayouts(points: { date: string; value: number }[], payouts: Pick<Payout, 'date' | 'usd'>[], rate: number | undefined) {
  if (!points.length || !payouts.length || !rate) return points
  const sorted = [...payouts].sort((a, b) => (a.date < b.date ? -1 : 1))
  let next = 0
  let sum = 0
  return points.map((p) => {
    while (next < sorted.length && sorted[next].date <= p.date) sum += sorted[next++].usd
    return { date: p.date, value: p.value + sum / rate }
  })
}

/** Passive income within a range: the total earned in it, and the running total inside it for a trend line. */
export function passiveIn(points: { date: string; value: number }[], { from, to }: { from?: string; to: string }) {
  const base = from ? valueOn(points, new Date(Date.parse(`${from}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)) : 0
  const line = points.filter((p) => (!from || p.date >= from) && p.date <= to).map((p) => ({ date: p.date, value: p.value - base }))
  return { total: line.length ? line[line.length - 1].value : 0, line }
}
