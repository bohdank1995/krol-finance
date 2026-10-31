import { useEffect, useMemo, useState } from 'react'
import { isDollar, isStock, type AssetSymbol } from './assets'
import { pairFor, toUsd } from './prices'
import { fetchStockDaily } from './stocks'

/* Daily closing prices in USD from Binance's public candles, so the graph can value
   past entries at what they were worth on that day. One request per pair, cached
   for the session. Binance returns up to 1000 days from the start date; stocks come from
   Yahoo Finance via `stocks.ts`. */

/** day "YYYY-MM-DD" (UTC) → USD price */
export type DailyPrices = Partial<Record<AssetSymbol, Record<string, number>>>

const cache = new Map<string, Promise<Record<string, number>>>()

/** Asks a few times: one failed lookup would otherwise leave the asset without a history. */
async function loadDaily(asset: AssetSymbol, sinceDay: string, attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    const days: Record<string, number> = await (isStock(asset) ? fetchStockDaily(asset, sinceDay) : fetchBinanceDaily(asset, sinceDay)).catch(() => ({}))
    if (Object.keys(days).length || attempt === attempts) return days
    await new Promise((done) => setTimeout(done, 1000 * attempt))
  }
}

function fetchDaily(asset: AssetSymbol, sinceDay: string) {
  const key = `${asset}:${sinceDay}`
  let hit = cache.get(key)
  if (!hit) {
    hit = loadDaily(asset, sinceDay).then((days) => {
      if (!Object.keys(days).length) cache.delete(key) // let a later render retry
      return days
    })
    cache.set(key, hit)
  }
  return hit
}

/** Binance gives at most 1000 days per request: keep asking from the last day until today. */
async function fetchBinanceDaily(asset: AssetSymbol, sinceDay: string) {
  const { pair, invert } = pairFor(asset)
  const out: Record<string, number> = {}
  let start = Date.parse(`${sinceDay}T00:00:00Z`)
  for (let page = 0; page < 10 && start < Date.now(); page++) {
    const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1d&startTime=${start}&limit=1000`)
    const rows: [number, string, string, string, string][] = r.ok ? await r.json() : []
    for (const row of rows) {
      const close = Number(row[4])
      if (close > 0) out[new Date(row[0]).toISOString().slice(0, 10)] = toUsd(close, invert)
    }
    if (rows.length < 1000) break
    start = rows[rows.length - 1][0] + 86_400_000
  }
  return out
}

const keyOf = (assets: readonly AssetSymbol[]) => [...new Set(assets)].filter((a) => !isDollar(a)).sort().join(',')

/** `preload` is fetched too, but nothing waits for it: the histories a later switch will need. */
export function useDailyPrices(assets: AssetSymbol[], sinceDay: string | undefined, preload: readonly AssetSymbol[] = []) {
  const needed = useMemo(() => keyOf(assets), [assets])
  const assetKey = useMemo(() => keyOf([...assets, ...preload]), [assets, preload])
  const [prices, setPrices] = useState<DailyPrices>({})

  useEffect(() => {
    if (!assetKey || !sinceDay) return
    let stale = false
    for (const asset of assetKey.split(',') as AssetSymbol[]) {
      fetchDaily(asset, sinceDay).then((days) => {
        if (!stale) setPrices((p) => ({ ...p, [asset]: days }))
      })
    }
    return () => {
      stale = true
    }
  }, [assetKey, sinceDay])

  // Ready once every asset's history has arrived (an empty one counts: the request failed).
  // No entries means no history to wait for.
  const ready = !sinceDay || !needed || needed.split(',').every((a) => a in prices)
  return { prices, ready }
}
