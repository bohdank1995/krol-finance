import { useEffect, useMemo, useState } from 'react'
import { isDollar, isStock, type AssetSymbol } from './assets'
import { useStockPrices } from './stocks'

/* Live prices in USD (USDC pairs) from Binance's public market data: one REST snapshot so
   values appear immediately, then a WebSocket stream for tick-by-tick updates.
   Stocks are priced separately (`stocks.ts`) and merged in. */

export type PriceStatus = 'idle' | 'connecting' | 'live' | 'offline'

/** Binance pair to watch for each asset, and how to turn its price into USDC. */
export function pairFor(asset: AssetSymbol) {
  if (asset === 'USDT') return { pair: 'USDCUSDT', invert: true }
  // Binance quotes these as "how many per dollar", so flip them.
  if (asset === 'UAH') return { pair: 'USDTUAH', invert: true }
  if (asset === 'PLN') return { pair: 'USDCPLN', invert: true }
  return { pair: `${asset}USDC`, invert: false }
}

export const toUsd = (price: number, invert: boolean) => (invert ? 1 / price : price)

/** Every pair ticks about once a second: collect them into one update, so the page recalculates once. */
const TICK_EVERY = 1000

export function useLivePrices(assets: AssetSymbol[]) {
  const watched = useMemo(
    () => [...new Set(assets)].filter((a) => !isDollar(a)).sort(),
    [assets],
  )
  const watchKey = watched.filter((a) => !isStock(a)).join(',')
  const stocks = useStockPrices(watched.filter(isStock).join(','))
  const [prices, setPrices] = useState<Partial<Record<AssetSymbol, number>>>({})
  const [status, setStatus] = useState<Exclude<PriceStatus, 'idle'>>('connecting')

  useEffect(() => {
    if (!watchKey) return
    const list = watchKey.split(',') as AssetSymbol[]
    const byPair = new Map(list.map((a) => [pairFor(a).pair, a]))
    let socket: WebSocket | undefined
    let retry: number | undefined
    let attempt = 0
    let closed = false
    let pending: Partial<Record<AssetSymbol, number>> = {}
    let tick: number | undefined

    const apply = (pair: string, raw: string) => {
      const asset = byPair.get(pair)
      const price = Number(raw)
      if (!asset || !Number.isFinite(price) || price <= 0) return
      pending[asset] = toUsd(price, pairFor(asset).invert)
    }
    const flush = () => {
      const fresh = pending
      pending = {}
      tick = undefined
      setPrices((p) => ({ ...p, ...fresh }))
    }

    const symbols = encodeURIComponent(JSON.stringify([...byPair.keys()]))
    fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${symbols}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { symbol: string; price: string }[]) => {
        if (closed) return
        rows.forEach((r) => apply(r.symbol, r.price))
        flush()
      })
      .catch(() => {})

    const connect = () => {
      const streams = [...byPair.keys()].map((p) => `${p.toLowerCase()}@miniTicker`).join('/')
      socket = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`)
      socket.onopen = () => {
        attempt = 0
        setStatus('live')
      }
      socket.onmessage = (e) => {
        const msg = JSON.parse(e.data) as { data?: { s: string; c: string } }
        if (msg.data) apply(msg.data.s, msg.data.c)
        tick ??= window.setTimeout(flush, TICK_EVERY)
      }
      socket.onclose = () => {
        if (closed) return
        setStatus('offline')
        retry = window.setTimeout(connect, Math.min(30_000, 1_000 * 2 ** attempt++))
      }
    }
    connect()

    return () => {
      closed = true
      window.clearTimeout(retry)
      window.clearTimeout(tick)
      socket?.close()
    }
  }, [watchKey])

  // The same object until a price changes, so calculations built on it aren't redone for nothing.
  const usd = useMemo<Partial<Record<AssetSymbol, number>>>(
    () => ({ ...prices, ...stocks.prices, USD: 1, USDC: 1 }),
    [prices, stocks.prices],
  )
  // Both feeds in use: live only when both are, reconnecting if either dropped.
  const feeds = [watchKey && status, watched.some(isStock) && stocks.status].filter(Boolean) as PriceStatus[]
  const combined: PriceStatus = !feeds.length
    ? 'idle'
    : feeds.includes('offline')
      ? 'offline'
      : feeds.includes('connecting')
        ? 'connecting'
        : 'live'
  return { prices: usd, status: combined }
}
