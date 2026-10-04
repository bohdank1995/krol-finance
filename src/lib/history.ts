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

function fetchDaily(asset: AssetSymbol, sinceDay: string) {
  const key = `${asset}:${sinceDay}`
  let hit = cache.get(key)
  if (!hit) {
    hit = (isStock(asset) ? fetchStockDaily(asset, sinceDay) : fetchBinanceDaily(asset, sinceDay)).catch(() => {
      cache.delete(key) // let a later render retry
      return {}
    })
    cache.set(key, hit)
  }
  return hit
}

function fetchBinanceDaily(asset: AssetSymbol, sinceDay: string) {
  const { pair, invert } = pairFor(asset)
  const start = Date.parse(`${sinceDay}T00:00:00Z`)
  return fetch(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1d&startTime=${start}&limit=1000`)
    .then((r) => (r.ok ? r.json() : []))
    .then((rows: [number, string, string, string, string][]) => {
      const out: Record<string, number> = {}
      for (const row of rows) {
        const close = Number(row[4])
        if (close > 0) out[new Date(row[0]).toISOString().slice(0, 10)] = toUsd(close, invert)
      }
      return out
    })
}

export function useDailyPrices(assets: AssetSymbol[], sinceDay: string | undefined) {
  const assetKey = useMemo(
    () => [...new Set(assets)].filter((a) => !isDollar(a)).sort().join(','),
    [assets],
  )
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
  const ready = !assetKey || assetKey.split(',').every((a) => a in prices)
  return { prices, ready }
}
