import { useEffect, useMemo, useState } from 'react'
import { isDollar, type AssetSymbol } from './assets'

/* Live prices in USD (USDC pairs) from Binance's public market data: one REST snapshot so
   values appear immediately, then a WebSocket stream for tick-by-tick updates. */

export type PriceStatus = 'idle' | 'connecting' | 'live' | 'offline'

/** Binance pair to watch for each asset, and how to turn its price into USDC. */
export function pairFor(asset: AssetSymbol) {
  if (asset === 'USDT') return { pair: 'USDCUSDT', invert: true }
  return { pair: `${asset}USDC`, invert: false }
}

export const toUsd = (price: number, invert: boolean) => (invert ? 1 / price : price)

export function useLivePrices(assets: AssetSymbol[]) {
  const watched = useMemo(
    () => [...new Set(assets)].filter((a) => !isDollar(a)).sort(),
    [assets],
  )
  const watchKey = watched.join(',')
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

    const apply = (pair: string, raw: string) => {
      const asset = byPair.get(pair)
      const price = Number(raw)
      if (!asset || !Number.isFinite(price) || price <= 0) return
      setPrices((p) => ({ ...p, [asset]: toUsd(price, pairFor(asset).invert) }))
    }

    const symbols = encodeURIComponent(JSON.stringify([...byPair.keys()]))
    fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${symbols}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { symbol: string; price: string }[]) => {
        if (!closed) rows.forEach((r) => apply(r.symbol, r.price))
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
      socket?.close()
    }
  }, [watchKey])

  const usd: Partial<Record<AssetSymbol, number>> = { ...prices, USD: 1, USDC: 1 }
  return { prices: usd, status: watchKey ? status : ('idle' as PriceStatus) }
}
