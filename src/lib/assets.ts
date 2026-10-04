/** Everything a user can hold besides stocks. `USD` is cash; the rest (other currencies too) are priced
    live from Binance. Each asset belongs to one entry type, which is how an entry's type is known. */
export const ASSETS = [
  { symbol: 'USD', name: 'US Dollar', type: 'money' },
  { symbol: 'EUR', name: 'Euro', type: 'money' },
  { symbol: 'UAH', name: 'Ukrainian Hryvnia', type: 'money' },
  { symbol: 'PLN', name: 'Polish Złoty', type: 'money' },
  { symbol: 'BTC', name: 'Bitcoin', type: 'crypto' },
  { symbol: 'ETH', name: 'Ethereum', type: 'crypto' },
  { symbol: 'USDC', name: 'USD Coin', type: 'crypto' },
  { symbol: 'USDT', name: 'Tether', type: 'crypto' },
  { symbol: 'SOL', name: 'Solana', type: 'crypto' },
  { symbol: 'BNB', name: 'BNB', type: 'crypto' },
  { symbol: 'XRP', name: 'XRP', type: 'crypto' },
  { symbol: 'TON', name: 'Toncoin', type: 'crypto' },
  { symbol: 'ADA', name: 'Cardano', type: 'crypto' },
  { symbol: 'DOGE', name: 'Dogecoin', type: 'crypto' },
  { symbol: 'AVAX', name: 'Avalanche', type: 'crypto' },
  { symbol: 'LINK', name: 'Chainlink', type: 'crypto' },
  { symbol: 'TRX', name: 'TRON', type: 'crypto' },
] as const

type KnownSymbol = (typeof ASSETS)[number]['symbol']

/** A stock is "stock:" + its Yahoo Finance ticker ("stock:AAPL", "stock:VWCE.DE"), so it can never
    clash with a crypto symbol. Stocks come from Interactive Brokers and are priced in `stocks.ts`. */
export type StockSymbol = `stock:${string}`

export type AssetSymbol = KnownSymbol | StockSymbol

/** The kinds of entry. Each type only offers its own assets. Names are in `i18n.ts` (`entryTypes`). */
export const ENTRY_TYPES = [{ value: 'money' }, { value: 'crypto' }, { value: 'stocks', soon: true }] as const

export type EntryType = (typeof ENTRY_TYPES)[number]['value']

/** The assets an entry of this type can use (stocks have no price feed yet). */
export function assetsFor(type: EntryType) {
  return ASSETS.filter((a) => a.type === type)
}

export const isStock = (a: AssetSymbol): a is StockSymbol => a.startsWith('stock:')

/** The entry type an asset belongs to. */
export const typeOf = (symbol: AssetSymbol): EntryType =>
  isStock(symbol) ? 'stocks' : ASSETS.find((a) => a.symbol === symbol)!.type

/** What to show for an asset: "AAPL" for stock:AAPL, "VWCE" for stock:VWCE.DE, "BTC" for BTC. */
export const assetLabel = (a: AssetSymbol) => (isStock(a) ? a.slice(6).replace(/\.[A-Z]+$/, '') : a)

/** Assets worth exactly one dollar, so they need no price feed. */
export const isDollar = (a: AssetSymbol) => a === 'USD' || a === 'USDC'
