import { memo } from 'react'
import { ASSETS, currencySign, type AssetSymbol } from '@/lib/assets'
import type { Currency } from '@/lib/preferences'

/** The currencies whose hryvnia rate the strip always shows. */
const RATES = ['USD', 'EUR', 'PLN'] as const
/** Crypto worth a dollar: its price says nothing, so it's left out. */
const STABLE = new Set<AssetSymbol>(['USDC', 'USDT'])

const twoDecimals = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const small = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 })
const formatPrice = (n: number) => (n < 1 ? small.format(n) : twoDecimals.format(n))

type Props = {
  /** Live prices in USD (as `useLivePrices` gives them). */
  prices: Partial<Record<AssetSymbol, number>>
  /** Every asset in the user's sources: the crypto among them gets a price here. */
  assets: AssetSymbol[]
  currency: Currency
}

/** Thin strip pinned to the bottom of the screen: USD, EUR and PLN in hryvnias, then the crypto the user holds. */
export const Ticker = memo(function Ticker({ prices, assets, currency }: Props) {
  const uah = prices.UAH
  const rate = prices[currency]
  const items: { label: string; value: string; sign: string }[] = []
  for (const code of RATES) {
    const usd = code === 'USD' ? 1 : prices[code]
    if (uah && usd) items.push({ label: code, value: formatPrice(usd / uah), sign: currencySign('UAH') })
  }
  const held = new Set(assets)
  for (const a of ASSETS) {
    if (a.type !== 'crypto' || STABLE.has(a.symbol) || !held.has(a.symbol)) continue
    const usd = prices[a.symbol]
    if (usd && rate) items.push({ label: a.symbol, value: formatPrice(usd / rate), sign: currencySign(currency) })
  }
  if (items.length === 0) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      {/* Moves slowly to the left like a stock ticker, the list twice in a row so it loops without a jump.
          Hover pauses it; with reduced motion it stands still. */}
      <div className="flex h-9 items-center overflow-hidden text-xs whitespace-nowrap">
        <div
          className="flex w-max animate-ticker hover:[animation-play-state:paused]"
          style={{ '--ticker-time': `${items.length * 6}s` } as React.CSSProperties}
        >
          {[0, 1].map((copy) => (
            <span key={copy} aria-hidden={copy === 1} className="flex min-w-screen justify-around gap-6 px-6">
              {items.map((i) => (
                <span key={i.label} className="flex items-baseline gap-1.5">
                  <span className="text-faint-foreground">{i.label}</span>
                  <span className="font-mono text-muted-foreground tabular-nums">{i.value}</span>
                  <span className="text-faint-foreground">{i.sign}</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
})
