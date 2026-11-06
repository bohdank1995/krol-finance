import { memo, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { ArrowDownUp } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { ASSETS, currencySign, type AssetSymbol } from '@/lib/assets'
import { useT } from '@/lib/i18n'
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

/** How long each group shows when they take turns, and how long the switch takes. */
const TURN = 6000
const SWITCH = 300

type Item = { label: string; value: string; sign: string; icon: ReactNode }

function Row({ items }: { items: Item[] }) {
  return (
    <span className="flex items-center gap-3.5 sm:gap-6">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1 sm:gap-1.5">
          {i.icon}
          <span className="text-faint-foreground">{i.label}</span>
          <span className="font-mono text-muted-foreground tabular-nums">{i.value}</span>
          <span className="text-faint-foreground">{i.sign}</span>
        </span>
      ))}
    </span>
  )
}

type Props = {
  /** Live prices in USD (as `useLivePrices` gives them). */
  prices: Partial<Record<AssetSymbol, number>>
  /** Every asset in the user's sources: the crypto among them gets a price here. */
  assets: AssetSymbol[]
  currency: Currency
}

/**
 * Thin strip pinned to the bottom of the screen: USD, EUR and PLN in hryvnias, then the crypto the user holds.
 * When both groups fit, they stand side by side. When they don't (phones), they take turns: one slides up and
 * out as the other comes in from below, every few seconds, or right away with the arrows button.
 */
export const Ticker = memo(function Ticker({ prices, assets, currency }: Props) {
  const t = useT()
  const uah = prices.UAH
  const rate = prices[currency]
  const rates: Item[] = []
  for (const code of RATES) {
    const usd = code === 'USD' ? 1 : prices[code]
    const Flag = FLAGS[code]
    if (uah && usd)
      rates.push({ label: code, value: formatPrice(usd / uah), sign: currencySign('UAH'), icon: <Flag className="h-2.5 w-auto rounded-[2px] opacity-60 grayscale" /> })
  }
  const coins: Item[] = []
  const held = new Set(assets)
  for (const a of ASSETS) {
    if (a.type !== 'crypto' || STABLE.has(a.symbol) || !held.has(a.symbol)) continue
    const usd = prices[a.symbol]
    const logo = COINS[a.symbol]
    if (usd && rate)
      coins.push({
        label: a.symbol,
        value: formatPrice(usd / rate),
        sign: currencySign(currency),
        icon: logo ? <img src={logo} alt="" className="size-3.5 opacity-60 grayscale" /> : null,
      })
  }
  const groups = [rates, coins].filter((g) => g.length > 0)

  // Whether both groups fit side by side: the hidden full row measured against the strip.
  const box = useRef<HTMLDivElement>(null)
  const full = useRef<HTMLDivElement>(null)
  const [fits, setFits] = useState(true)
  useLayoutEffect(() => {
    if (!box.current || !full.current) return
    const measure = () => {
      const { paddingLeft, paddingRight } = getComputedStyle(box.current!)
      setFits(full.current!.scrollWidth <= box.current!.clientWidth - parseFloat(paddingLeft) - parseFloat(paddingRight))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box.current)
    observer.observe(full.current)
    return () => observer.disconnect()
  }, [groups.length])

  const [shown, setShown] = useState(0)
  const [leaving, setLeaving] = useState<number>()
  const turns = !fits && groups.length > 1
  const current = shown % Math.max(groups.length, 1)
  const next = () => {
    setLeaving(current)
    setShown(current + 1)
  }
  // Takes turns on its own; a press on the arrows restarts the wait.
  useEffect(() => {
    if (!turns || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setTimeout(() => {
      setLeaving(current)
      setShown(current + 1)
    }, TURN)
    return () => window.clearTimeout(timer)
  }, [turns, current])
  useEffect(() => {
    if (leaving === undefined) return
    const timer = window.setTimeout(() => setLeaving(undefined), SWITCH)
    return () => window.clearTimeout(timer)
  }, [leaving])

  if (groups.length === 0) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <div ref={box} className="relative flex h-9 items-center overflow-hidden px-4 text-xs whitespace-nowrap sm:px-6">
        {/* Both groups in one row, invisible: only measured. */}
        <div ref={full} aria-hidden className="invisible absolute flex w-max gap-12">
          {groups.map((g, i) => (
            <Row key={i} items={g} />
          ))}
        </div>

        {!turns ? (
          <div className="flex w-full justify-center gap-12">
            {groups.map((g, i) => (
              <Row key={i} items={g} />
            ))}
          </div>
        ) : (
          <>
            <div className="relative flex h-full min-w-0 flex-1 items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {leaving !== undefined && leaving !== current && (
                <div key={`out-${leaving}`} aria-hidden className="absolute inset-y-0 left-0 flex animate-out items-center duration-300 fill-mode-forwards fade-out slide-out-to-top-3">
                  <Row items={groups[leaving]} />
                </div>
              )}
              <div key={`in-${current}`} className="flex animate-in items-center duration-300 fade-in slide-in-from-bottom-3">
                <Row items={groups[current]} />
              </div>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label={current === 0 ? t.showCrypto : t.showCurrencies} onClick={next} className="-mr-2 shrink-0 text-muted-foreground">
              <ArrowDownUp className="size-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
})
