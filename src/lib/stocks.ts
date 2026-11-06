import { useEffect, useState } from 'react'
import type { StockSymbol } from './assets'
import { api } from '../../convex/_generated/api'
import { call } from './entries'
import type { PriceStatus } from './prices'

/* Stock prices in USD, from Yahoo Finance via the `ibkr` server functions (Yahoo can't be called from
   the browser). There is no free tick-by-tick stream for stocks, so live prices are re-fetched
   every 15 seconds while the tab is visible, and right away when it becomes visible again. */

const EVERY = 15_000

export function useStockPrices(watchKey: string) {
  const [prices, setPrices] = useState<Partial<Record<StockSymbol, number>>>({})
  const [status, setStatus] = useState<Exclude<PriceStatus, 'idle'>>('connecting')

  useEffect(() => {
    if (!watchKey) return
    const assets = watchKey.split(',') as StockSymbol[]
    let closed = false
    let timer: number | undefined
    let busy = false

    const poll = async () => {
      if (busy) return
      busy = true
      window.clearTimeout(timer)
      try {
        const fresh = await call(api.ibkr.quotes, { assets }, 'Could not load stock prices.')
        if (closed) return
        setPrices((p) => ({ ...p, ...fresh }))
        setStatus('live')
      } catch {
        if (!closed) setStatus('offline')
      }
      busy = false
      if (!closed && document.visibilityState === 'visible') timer = window.setTimeout(poll, EVERY)
    }
    const onVisible = () => document.visibilityState === 'visible' && poll()

    poll()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      closed = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [watchKey])

  return { prices, status }
}

type Days = Record<string, number>

/** Stocks asked for in the same moment, per start day: they go to the server together, 10 per call. */
const waiting = new Map<string, Map<StockSymbol, ((days: Days) => void)[]>>()

async function send(sinceDay: string) {
  const batch = waiting.get(sinceDay)
  waiting.delete(sinceDay)
  if (!batch) return
  const assets = [...batch.keys()]
  const chunks = Array.from({ length: Math.ceil(assets.length / 10) }, (_, i) => assets.slice(i * 10, i * 10 + 10))
  await Promise.all(
    chunks.map(async (chunk) => {
      const found = await call(api.ibkr.history, { assets: chunk, since: sinceDay }, 'Could not load stock history.').catch(
        () => [],
      )
      const daysOf = new Map(found.map((r) => [r.asset, Object.fromEntries(r.days)]))
      for (const asset of chunk) for (const done of batch.get(asset) ?? []) done(daysOf.get(asset) ?? {})
    }),
  )
}

/** Daily closes in USD, "YYYY-MM-DD" → price, from `sinceDay` on. Empty if the request fails. */
export function fetchStockDaily(asset: StockSymbol, sinceDay: string) {
  return new Promise<Days>((done) => {
    let batch = waiting.get(sinceDay)
    if (!batch) {
      batch = new Map()
      waiting.set(sinceDay, batch)
      setTimeout(() => send(sinceDay))
    }
    batch.set(asset, [...(batch.get(asset) ?? []), done])
  })
}
