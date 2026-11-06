import { memo, type ComponentType } from 'react'
import { EU, PL, US } from 'country-flag-icons/react/3x2'
import ada from 'cryptocurrency-icons/svg/color/ada.svg'
import avax from 'cryptocurrency-icons/svg/color/avax.svg'
import bnb from 'cryptocurrency-icons/svg/color/bnb.svg'
import btc from 'cryptocurrency-icons/svg/color/btc.svg'
import doge from 'cryptocurrency-icons/svg/color/doge.svg'
import eth from 'cryptocurrency-icons/svg/color/eth.svg'
import link from 'cryptocurrency-icons/svg/color/link.svg'
import sol from 'cryptocurrency-icons/svg/color/sol.svg'
import trx from 'cryptocurrency-icons/svg/color/trx.svg'
import xrp from 'cryptocurrency-icons/svg/color/xrp.svg'
import ton from '@/assets/ton.svg'
import { ASSETS, currencySign, type AssetSymbol } from '@/lib/assets'
import type { Currency } from '@/lib/preferences'

/** The currencies whose hryvnia rate the strip always shows, each with its flag. */
const RATES = ['USD', 'EUR', 'PLN'] as const
const FLAGS: Record<(typeof RATES)[number], ComponentType<{ className?: string }>> = { USD: US, EUR: EU, PLN: PL }
/** Coin logos (from the cryptocurrency-icons set; TON drawn here, as the set has none). */
const COINS: Partial<Record<AssetSymbol, string>> = { BTC: btc, ETH: eth, SOL: sol, BNB: bnb, XRP: xrp, TON: ton, ADA: ada, DOGE: doge, AVAX: avax, LINK: link, TRX: trx }
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
  const items: { label: string; value: string; sign: string; icon: React.ReactNode }[] = []
  for (const code of RATES) {
    const usd = code === 'USD' ? 1 : prices[code]
    const Flag = FLAGS[code]
    if (uah && usd)
      items.push({ label: code, value: formatPrice(usd / uah), sign: currencySign('UAH'), icon: <Flag className="h-2.5 w-auto rounded-[2px]" /> })
  }
  const held = new Set(assets)
  for (const a of ASSETS) {
    if (a.type !== 'crypto' || STABLE.has(a.symbol) || !held.has(a.symbol)) continue
    const usd = prices[a.symbol]
    const logo = COINS[a.symbol]
    if (usd && rate)
      items.push({
        label: a.symbol,
        value: formatPrice(usd / rate),
        sign: currencySign(currency),
        icon: logo ? <img src={logo} alt="" className="size-3.5" /> : null,
      })
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
                <span key={i.label} className="flex items-center gap-1.5">
                  {i.icon}
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
