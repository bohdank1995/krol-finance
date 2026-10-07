import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { action, internalAction, internalMutation, internalQuery, mutation, type ActionCtx, type QueryCtx } from './_generated/server'
import { signedIn } from './data'

/* Interactive Brokers stocks + stock prices. The app calls `positions` (run the Flex Query, keep
   the token, list the stocks), `connect` (create a portfolio with one entry per picked stock),
   `quotes` (live USD prices) and `history` (daily USD closes); the hourly cron calls `sync`
   (refresh the stalest user's share counts). Tokens never leave the server.

   Holdings come from IBKR's Flex Web Service (read-only reports, as of the last business day).
   Prices come from Yahoo Finance's public chart data. A stock asset is "stock:<Yahoo ticker>",
   e.g. "stock:AAPL" or "stock:VWCE.DE", and is always valued in USD. */

const FLEX = 'https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService'
const YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart/'
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (krol-finance)' }
const DAY = 86_400
/** Bump to re-import every portfolio's trade history on its next sync. */
const TRADES_VERSION = 6

/** One stock from the Flex Query, summed across accounts. `price` is USD per share, null if it can't be priced. */
type Position = { asset: string; symbol: string; name: string; quantity: string; price: number | null }

/** A stock as the app lists it; `value` is the USD value of the shares held. */
type Listed = Omit<Position, 'price'> & { value: number | null; connected: boolean }
/** What the sync needs to know about a user. */
type SyncState = {
  token: { token: string; queryId: string } | null
  portfolios: { id: string; trackedAssets: string[] | null; removed: string[]; shares: Record<string, number>; history: boolean }[]
}

const now = () => Math.floor(Date.now() / 1000)
const iso = (seconds: number) => new Date(seconds * 1000).toISOString()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** Share counts can be fractional: keep 8 decimals, no float noise ("0.30000000000000004" → "0.3"). */
const quantity = (n: number) => String(Number(n.toFixed(8)))
const tickerOf = (asset: string) => asset.slice('stock:'.length)
/** Errors thrown as ConvexError show their message in the app. */
const fail = (message: string) => new ConvexError(message)

async function userOf(ctx: ActionCtx) {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw fail('Please sign in again.')
  return userId
}

/* ---------- IBKR Flex Web Service ---------- */

const FLEX_ERRORS: Record<string, string> = {
  '1011': 'Flex Web Service is off for this account. Turn it on in Flex Web Service Configuration.',
  '1012': 'This IBKR token has expired. Generate a new one in Flex Web Service Configuration.',
  '1013': 'This token only works from certain IP addresses. Remove the IP restriction in Flex Web Service Configuration.',
  '1014': 'IBKR doesn’t know this Query ID. Copy it again from the Flex Queries list.',
  '1015': 'IBKR did not accept this token. Check it, or generate a new one.',
  '1018': 'IBKR is limiting requests. Try again in a minute.',
}

/** Errors that mean the kept token or Query ID no longer works, so the app must ask for new ones. */
const credentialErrors = new Set(['1011', '1012', '1013', '1014', '1015'].map((code) => FLEX_ERRORS[code]))
const badCredentials = (e: unknown) => e instanceof ConvexError && credentialErrors.has(String(e.data))

const tag = (xml: string, name: string) => new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1]?.trim()

const unescape = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

function attributes(element: string) {
  const out: Record<string, string> = {}
  for (const m of element.matchAll(/(\w+)="([^"]*)"/g)) out[m[1]] = unescape(m[2])
  return out
}

async function flexGet(url: string) {
  // A hung request would eat the action's 10-minute limit.
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30_000) }).catch(() => {
    throw fail('IBKR is not responding. Try again later.')
  })
  if (!res.ok) throw fail(`IBKR is not responding (${res.status}). Try again later.`)
  return res.text()
}

function flexFail(xml: string): never {
  const code = tag(xml, 'ErrorCode') ?? ''
  throw fail(FLEX_ERRORS[code] ?? `IBKR says: ${tag(xml, 'ErrorMessage') ?? 'the report could not be made'}`)
}

/** Asks IBKR to run the query, then waits for the finished XML report. */
async function report(token: string, queryId: string, range?: { from: string; to: string }) {
  const t = encodeURIComponent(token)
  const sent = await flexGet(`${FLEX}/SendRequest?t=${t}&q=${encodeURIComponent(queryId)}&v=3${range ? `&fd=${range.from}&td=${range.to}` : ''}`)
  if (tag(sent, 'Status') !== 'Success') flexFail(sent)
  const reference = tag(sent, 'ReferenceCode')
  const url = tag(sent, 'Url') ?? `${FLEX}/GetStatement`

  for (let attempt = 0; attempt < 10; attempt++) {
    await sleep(attempt ? 3000 : 1500)
    const xml = await flexGet(`${url}?t=${t}&q=${reference}&v=3`)
    if (xml.includes('<FlexQueryResponse')) return xml
    if (!xml.includes('<FlexStatementResponse'))
      throw fail('Set the Flex Query’s format to XML (under Delivery Configuration), then try again.')
    const code = tag(xml, 'ErrorCode')
    // 1019: still being generated. 1009: IBKR is busy.
    if (code === '1019' || code === '1009') continue
    flexFail(xml)
  }
  throw fail('IBKR is still preparing the report. Try again in a minute.')
}

/** IBKR listing exchange → Yahoo ticker suffix. US exchanges (and anything unknown) have none. */
const SUFFIX: Record<string, string> = {
  IBIS: '.DE', IBIS2: '.DE', TGATE: '.DE', FWB: '.F', FWB2: '.F', SWB: '.SG', GETTEX: '.MU', GETTEX2: '.MU',
  LSE: '.L', LSEETF: '.L', AEB: '.AS', SBF: '.PA', 'ENEXT.BE': '.BR', BVL: '.LS', ISED: '.IR',
  BVME: '.MI', 'BVME.ETF': '.MI', EBS: '.SW', BM: '.MC', SFB: '.ST', CPH: '.CO', KFB: '.CO', OSE: '.OL',
  HEX: '.HE', WSE: '.WA', VSE: '.VI', PRA: '.PR', TSE: '.TO', VENTURE: '.V', ASX: '.AX', SEHK: '.HK',
  TSEJ: '.T', SGX: '.SI', NSE: '.NS', TASE: '.TA', MEXI: '.MX',
}

function yahooTicker(symbol: string, exchange = '') {
  // "BRK B" → "BRK-B"; London's "BP." → "BP"; Hong Kong's "700" → "0700".
  let s = symbol.trim().replace(/\.$/, '')
  if (exchange === 'SEHK') s = s.padStart(4, '0')
  return s.replace(/[ .]/g, '-') + (SUFFIX[exchange] ?? '')
}

/** Stocks and ETFs from the report's Open Positions section, summed per asset. */
function parsePositions(xml: string) {
  if (!xml.includes('<OpenPositions')) throw fail('Add the Open Positions section to the Flex Query, then try again.')
  const byAsset = new Map<string, { asset: string; symbol: string; name: string; quantity: number }>()
  for (const m of xml.matchAll(/<OpenPosition\s[^>]*>/g)) {
    const a = attributes(m[0])
    // Only stocks (ETFs count as stocks); with lots included, only the summary rows.
    if (a.assetCategory !== 'STK' || a.levelOfDetail === 'LOT') continue
    const count = Number(a.position)
    if (!count || !a.symbol) continue
    const asset = `stock:${yahooTicker(a.symbol, a.listingExchange)}`
    const previous = byAsset.get(asset)
    byAsset.set(asset, {
      asset,
      symbol: a.symbol.trim(),
      name: a.description ?? '',
      quantity: (previous?.quantity ?? 0) + count,
    })
  }
  return [...byAsset.values()]
    .map((p) => ({ ...p, quantity: quantity(p.quantity) }))
    .filter((p) => Number(p.quantity) !== 0)
    .sort((a, b) => a.symbol.localeCompare(b.symbol))
}

/** A dividend, interest or tax row from the report's Cash Transactions section. `asset` is unset for account-level interest. */
type Payment = { id: string; asset?: string; date: string; currency: string; amount: number; kind: string }

// Only real income: dividends, interest received, and the tax withheld on them.
const INCOME = ['dividends', 'payment in lieu of dividends', 'withholding tax', 'broker interest received', 'bond interest received']

/** Payments from the Cash Transactions section (none if the query doesn't have it). `known` maps a symbol to its asset. */
function parsePayments(xml: string, known: Map<string, string>) {
  const out: Payment[] = []
  for (const m of xml.matchAll(/<CashTransaction\s[^>]*>/g)) {
    const a = attributes(m[0])
    const kind = (a.type ?? '').toLowerCase()
    if (!INCOME.includes(kind) || a.levelOfDetail === 'SUMMARY') continue
    const date = /(\d{4})-?(\d{2})-?(\d{2})/.exec(a.dateTime || a.reportDate || a.settleDate || '')
    const amount = Number(a.amount)
    if (!date || !amount || !a.transactionID) continue
    const symbol = a.symbol?.trim()
    out.push({
      id: a.transactionID,
      asset: symbol ? (known.get(symbol) ?? `stock:${yahooTicker(symbol, a.listingExchange)}`) : undefined,
      date: `${date[1]}-${date[2]}-${date[3]}`,
      currency: (a.currency || 'USD').toUpperCase(),
      amount,
      kind,
    })
  }
  return out
}

/** What IBKR says you paid for the shares you hold now (cost basis, in the position's currency), summed across accounts. */
function parseCosts(xml: string, known: Map<string, string>) {
  const out = new Map<string, { money: number; currency: string }>()
  for (const m of xml.matchAll(/<OpenPosition\s[^>]*>/g)) {
    const a = attributes(m[0])
    if (a.assetCategory !== 'STK' || a.levelOfDetail === 'LOT' || !a.symbol) continue
    const money = Number(a.costBasisMoney)
    if (!(money > 0)) continue
    const asset = known.get(a.symbol.trim()) ?? `stock:${yahooTicker(a.symbol, a.listingExchange)}`
    const before = out.get(asset)
    out.set(asset, { money: (before?.money ?? 0) + money, currency: (a.currency || 'USD').toUpperCase() })
  }
  return out
}

/** One purchase (positive) or sale (negative) of a stock from the report's Trades section. */
type Trade = { id: string; asset: string; at: string; quantity: number; price?: number; currency: string }

/** Flex dates: "20250305", "20250305;093000" or "2025-03-05 09:30:00" → ISO. */
function flexTime(text: string | undefined) {
  const m = /(\d{4})-?(\d{2})-?(\d{2})(?:[;T ,]*(\d{2}):?(\d{2}):?(\d{2}))?/.exec(text ?? '')
  return m && `${m[1]}-${m[2]}-${m[3]}T${m[4] ?? '00'}:${m[5] ?? '00'}:${m[6] ?? '00'}.000Z`
}

/** Stock trades with real dates, and the day the report starts. `null` if the query has no Trades section. */
function parseTrades(xml: string, known: Map<string, string>) {
  if (!/<Trade\s/.test(xml)) return null // no section, or an empty one (e.g. a one-day period)
  const trades: Trade[] = []
  for (const m of xml.matchAll(/<Trade\s[^>]*>/g)) {
    const a = attributes(m[0])
    if (a.assetCategory !== 'STK' || (a.levelOfDetail && a.levelOfDetail !== 'EXECUTION')) continue
    const quantity = Number(a.quantity)
    const at = flexTime(a.dateTime || a.tradeDate)
    const id = a.transactionID || a.tradeID
    if (!quantity || !at || !id || !a.symbol) continue
    const symbol = a.symbol.trim()
    const price = Number(a.tradePrice)
    trades.push({
      id,
      asset: known.get(symbol) ?? `stock:${yahooTicker(symbol, a.listingExchange)}`,
      at,
      quantity,
      price: price > 0 ? price : undefined,
      currency: (a.currency || 'USD').toUpperCase(),
    })
  }
  if (!trades.length) {
    if (/<Trade\s/.test(xml) && !/<Trade\s[^>]*\squantity=/.test(xml))
      throw fail('Add the Quantity and Trade Price fields to the Flex Query’s Trades section (tick Select All there), then try again.')
    return null
  }
  const from = flexTime(/<FlexStatement\s[^>]*fromDate="([^"]*)"/.exec(xml)?.[1])
  return { trades, from: from ?? new Date().toISOString() }
}

/* ---------- Yahoo Finance prices ---------- */

type Chart = {
  meta: { currency?: string; regularMarketPrice?: number }
  timestamp?: number[]
  indicators?: { quote?: { close?: (number | null)[] }[] }
}

async function chart(ticker: string, query: string): Promise<Chart | undefined> {
  try {
    const res = await fetch(`${YAHOO}${encodeURIComponent(ticker)}?${query}`, { headers: HEADERS })
    if (!res.ok) return undefined
    const body = await res.json()
    return body?.chart?.result?.[0]
  } catch {
    return undefined
  }
}

/** Some markets quote in hundredths: London in pence, Johannesburg in cents, Tel Aviv in agorot. */
function unit(currency = 'USD') {
  if (currency === 'GBp') return { currency: 'GBP', scale: 0.01 }
  if (currency === 'ZAc') return { currency: 'ZAR', scale: 0.01 }
  if (currency === 'ILA') return { currency: 'ILS', scale: 0.01 }
  return { currency: currency.toUpperCase(), scale: 1 }
}

// Reuse recent answers while the server instance stays warm (every open tab polls).
const memo = new Map<string, { at: number; value: Promise<unknown> }>()
function remember<T>(key: string, seconds: number, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key)
  if (hit && now() - hit.at < seconds) return hit.value as Promise<T>
  const value = load()
  memo.set(key, { at: now(), value })
  return value
}

/** Latest price of one share in USD, or undefined if Yahoo doesn't know the ticker. */
function usdPrice(ticker: string): Promise<number | undefined> {
  return remember(`quote:${ticker}`, 15, async () => {
    const c = await chart(ticker, 'range=1d&interval=1d')
    const price = c?.meta.regularMarketPrice
    if (!price) return undefined
    const { currency, scale } = unit(c.meta.currency)
    const fx = currency === 'USD' ? 1 : await usdPrice(`${currency}USD=X`)
    return fx ? price * scale * fx : undefined
  })
}

/** Daily closes in USD, "YYYY-MM-DD" (UTC) → price, from a few days before `since` until today. */
function dailyUsd(ticker: string, since: string): Promise<Record<string, number>> {
  return remember(`daily:${ticker}:${since}`, 3600, async () => {
    const from = Math.floor(Date.parse(`${since}T00:00:00Z`) / 1000) - 7 * DAY
    const c = await chart(ticker, `period1=${from}&period2=${now()}&interval=1d`)
    const closes = c?.indicators?.quote?.[0]?.close ?? []
    const { currency, scale } = unit(c?.meta.currency)
    const fx = currency === 'USD' ? undefined : await dailyUsd(`${currency}USD=X`, since)
    const fxDays = fx ? Object.keys(fx).sort() : []

    const out: Record<string, number> = {}
    let f = 0
    let rate = fxDays.length ? fx![fxDays[0]] : 1
    for (const [i, t] of (c?.timestamp ?? []).entries()) {
      const close = closes[i]
      if (!close) continue
      const day = new Date(t * 1000).toISOString().slice(0, 10)
      // The exchange rate on that day, or the last one before it.
      while (f < fxDays.length && fxDays[f] <= day) rate = fx![fxDays[f++]]
      if (fx && !fxDays.length) continue
      out[day] = close * scale * rate
    }
    return out
  })
}

/** Stock splits after a day: how many of today's shares one share bought then became (1 if none, or unknown). */
function splitsSince(ticker: string, since: string): Promise<(at: string) => number> {
  return remember(`splits:${ticker}:${since}`, 3600, async () => {
    const from = Math.floor(Date.parse(`${since}T00:00:00Z`) / 1000) - DAY
    const c = (await chart(ticker, `period1=${from}&period2=${now()}&interval=1mo&events=split`)) as
      | (Chart & { events?: { splits?: Record<string, { date: number; numerator: number; denominator: number }> } })
      | undefined
    // Real splits are small whole ratios (3:1, 1:8, 1:25). Yahoo also lists spin-offs as odd "splits"
    // (IBM 1046:1000 for Kyndryl, T 1324:1000 for WBD) that changed no share counts: skip those.
    const whole = (n: number) => Number.isInteger(n) && n > 0 && n <= 50
    const splits = Object.values(c?.events?.splits ?? {}).filter((x) => whole(x.numerator) && whole(x.denominator))
    return (at: string) => {
      const t = Date.parse(at) / 1000
      return splits.reduce((f, x) => (x.date > t ? (f * x.numerator) / x.denominator : f), 1)
    }
  })
}

/** Trades in today's share terms: Yahoo's past prices are split-adjusted, so the shares bought then must be too. */
async function splitAdjusted(trades: Trade[]) {
  const since = new Map<string, string>()
  for (const t of trades) if (!since.has(t.asset) || t.at < since.get(t.asset)!) since.set(t.asset, t.at.slice(0, 10))
  const factor = new Map(await Promise.all([...since].map(async ([a, d]) => [a, await splitsSince(tickerOf(a), d)] as const)))
  return trades.map((t) => {
    const f = factor.get(t.asset)?.(t.at) ?? 1
    return f === 1 ? t : { ...t, quantity: t.quantity * f, price: t.price === undefined ? undefined : t.price / f }
  })
}

const stockAssets = (assets: string[]) => assets.filter((a) => a.startsWith('stock:')).slice(0, 100)

/* ---------- Called by the app ---------- */

export const positions = action({
  // Without a token the kept one is used; null comes back when none is kept yet.
  args: { token: v.optional(v.string()), queryId: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Listed[] | null> => {
    const userId = await userOf(ctx)
    const given = args.token !== undefined || args.queryId !== undefined
    const stored: { token: string; queryId: string; positions: Position[] } | null = await ctx.runQuery(
      internal.ibkr.stored,
      { userId },
    )
    const token = given ? (args.token ?? '').trim() : stored?.token
    const queryId = given ? (args.queryId ?? '').trim() : stored?.queryId
    if (!token || !queryId) {
      if (given) throw fail('Paste both the token and the Query ID.')
      return null
    }
    if (!/^\d+$/.test(queryId)) throw fail('The Query ID is a number. Copy it from the Flex Queries list.')

    let priced: Position[]
    try {
      const list = parsePositions(await report(token, queryId))
      priced = await Promise.all(list.map(async (p) => ({ ...p, price: (await usdPrice(tickerOf(p.asset))) ?? null })))
    } catch (e) {
      // IBKR is busy, limiting or refusing requests for now: show the last known list instead of an error.
      // (A bad or expired token still fails, so the app asks for a new one.)
      if (!given && stored && !badCredentials(e)) priced = stored.positions
      else throw e
    }
    const taken: string[] | 'all' = await ctx.runMutation(internal.ibkr.saveToken, { userId, token, queryId, positions: priced })
    return priced.map((p) => ({
      asset: p.asset,
      symbol: p.symbol,
      name: p.name,
      quantity: p.quantity,
      value: p.price === null ? null : p.price * Number(p.quantity),
      connected: taken === 'all' || taken.includes(p.asset),
    }))
  },
})

export const connect = action({
  args: { name: v.string(), assets: v.array(v.string()), all: v.boolean() },
  handler: async (ctx, args): Promise<string> => {
    const userId = await userOf(ctx)
    const name = args.name.trim()
    if (!name) throw fail('Give the portfolio a name.')
    const id = crypto.randomUUID()
    await ctx.runMutation(internal.ibkr.create, {
      userId,
      id,
      name,
      assets: stockAssets(args.assets),
      all: args.all,
      ids: Array.from({ length: 100 }, () => crypto.randomUUID()),
    })
    return id
  },
})

export const quotes = action({
  args: { assets: v.array(v.string()) },
  handler: async (ctx, args) => {
    await userOf(ctx)
    const prices: Record<string, number> = {}
    await Promise.all(
      stockAssets(args.assets).map(async (asset) => {
        const price = await usdPrice(tickerOf(asset))
        if (price) prices[asset] = price
      }),
    )
    return prices
  },
})

export const history = action({
  args: { asset: v.string(), since: v.string() },
  handler: async (ctx, { asset, since }) => {
    await userOf(ctx)
    if (!asset.startsWith('stock:') || !/^\d{4}-\d{2}-\d{2}$/.test(since)) throw fail('Unknown stock or day.')
    // [day, price] pairs: a Convex object can't hold more than 1024 days (about four years).
    return Object.entries(await dailyUsd(tickerOf(asset), since))
  },
})

/* ---------- Called by the hourly cron ---------- */

export const sync = internalAction({
  args: {},
  handler: async (ctx): Promise<object> => {
    const userId: Id<'users'> | null = await ctx.runQuery(internal.ibkr.due)
    if (!userId) return { synced: null }
    return syncUser(ctx, userId)
  },
})

/** "Sync now": the signed-in user's IBKR cards, on demand. IBKR limits requests, so not more than once a minute. */
export const refresh = action({
  args: {},
  handler: async (ctx): Promise<number> => {
    const userId = await userOf(ctx)
    const last: number | null = await ctx.runQuery(internal.ibkr.lastSync, { userId })
    if (last !== null && Date.now() - last < 60_000) throw fail('Just synced. Try again in a minute.')
    const result = (await syncUser(ctx, userId)) as { changed: number }
    return result.changed
  },
})

const dayText = (t: number) => new Date(t).toISOString().slice(0, 10).replace(/-/g, '')

/** IBKR reports cover at most a year at a time: walk back one-year windows from `before` (YYYYMMDD) for older trades
 *  and payments. Stops after four empty years, twelve windows, or at the account's start. `complete` is false if IBKR
 *  failed partway. IBKR answers "Statement is not available" for some years (seen for a middle year with no activity,
 *  and before the account opened): that counts as an empty year, not a failure. */
async function olderReports(token: string, queryId: string, known: Map<string, string>, before: string) {
  const out = { trades: [] as Trade[], payments: [] as Payment[], from: before, complete: true }
  let end = Date.parse(`${before.slice(0, 4)}-${before.slice(4, 6)}-${before.slice(6, 8)}T00:00:00Z`) - 86_400_000
  let empty = 0
  for (let window = 0; window < 12 && empty < 4; window++) {
    const start = end - 364 * 86_400_000
    let xml: string | undefined
    for (let attempt = 0; attempt < 3 && xml === undefined; attempt++) {
      try {
        xml = await report(token, queryId, { from: dayText(start), to: dayText(end) })
      } catch (e) {
        if (e instanceof ConvexError && /not available/i.test(String(e.data))) xml = ''
        else await sleep(20_000)
      }
    }
    // Nothing for this year after older trades were already found: the account didn't exist yet.
    if (xml === '' && out.trades.length) break
    if (xml === undefined) {
      out.complete = false
      break
    }
    const trades = parseTrades(xml, known)?.trades ?? []
    const payments = parsePayments(xml, known)
    out.trades.push(...trades)
    out.payments.push(...payments)
    out.from = new Date(start).toISOString()
    empty = trades.length || payments.length ? 0 : empty + 1
    end = start - 86_400_000
    await sleep(8000)
  }
  return out
}

/** Reads the IBKR report and adds a new row for every stock whose share count changed (a purchase or a sale). */
async function syncUser(ctx: ActionCtx, userId: Id<'users'>): Promise<object> {
    const to = now()
    const state: SyncState = await ctx.runQuery(internal.ibkr.state, { userId })

    let held: Map<string, number>
    let payments: Payment[]
    let history: ReturnType<typeof parseTrades>
    let costs: ReturnType<typeof parseCosts>
    let known: Map<string, string>
    let statementFrom = ''
    try {
      if (!state.token) throw new Error('No IBKR token')
      const xml = await report(state.token.token, state.token.queryId)
      const positions = parsePositions(xml)
      held = new Map(positions.map((p) => [p.asset, Number(p.quantity)]))
      const bySymbol = new Map(positions.map((p) => [p.symbol, p.asset]))
      known = bySymbol
      statementFrom = /<FlexStatement\s[^>]*fromDate="(\d{8})"/.exec(xml)?.[1] ?? ''
      payments = parsePayments(xml, bySymbol)
      history = parseTrades(xml, bySymbol)
      costs = parseCosts(xml, bySymbol)
    } catch (e) {
      // An expired token or a changed query: move on to other users, try again tomorrow.
      await ctx.runMutation(internal.ibkr.record, { userId, syncedAt: to * 1000, entries: [] })
      throw e
    }

    // The first time (or after a version bump) also read the years before this report.
    if (state.token && statementFrom && state.portfolios.some((p) => !p.history)) {
      const older = await olderReports(state.token.token, state.token.queryId, known, statementFrom)
      payments = [...payments, ...older.payments]
      history = older.complete
        ? { trades: [...(history?.trades ?? []), ...older.trades], from: older.from }
        : null // a gap in the history would give wrong opening positions: try again next sync
    }

    if (history) history = { ...history, trades: await splitAdjusted(history.trades) }

    const followed = new Set(state.portfolios.flatMap((p) => p.trackedAssets ?? []))
    const convert = history ? await usdConverter(history.trades.map((t) => ({ currency: t.currency, date: t.at.slice(0, 10) }))) : undefined
    const today = new Date().toISOString().slice(0, 10)
    const costUsd = await usdConverter([...costs].map(([, c]) => ({ currency: c.currency, date: today })))
    /** Average price paid per share (USD) of the shares held now, from IBKR's cost basis. */
    const costPerShare = (asset: string) => {
      const c = costs.get(asset)
      const n = held.get(asset)
      const money = c && costUsd(c.currency, today, c.money)
      return money !== undefined && n ? money / n : undefined
    }
    const priced: { portfolioId: string; asset: string; price: number }[] = []
    const entries: {
      id: string; portfolioId: string; asset: string; amount: string; createdAt: string; note: string; externalId: string; price?: number
    }[] = []
    const rebuild: { portfolioId: string; assets: string[] }[] = []
    for (const p of state.portfolios) {
      const shares = new Map(Object.entries(p.shares))
      const assets = new Set(p.trackedAssets ?? shares.keys())
      for (const asset of p.removed) assets.delete(asset)

      // First time the Trades are available: swap the placeholder opening position for the real history.
      if (history && !p.history) {
        const replaced: string[] = []
        for (const asset of assets) {
          const mine = history.trades.filter((t) => t.asset === asset)
          const now = held.get(asset) ?? 0
          // Held all along (no trades in any report): dated at the start of the history, not the sync day.
          if (!mine.length && !now) continue
          const opening = Number((now - mine.reduce((sum, t) => sum + t.quantity, 0)).toFixed(8))
          replaced.push(asset)
          // What the shares held before the report period cost: the total cost basis minus the purchases in it.
          const bought = mine.filter((t) => t.quantity > 0)
          const boughtUsd = bought.map((t) => t.price !== undefined && convert ? convert(t.currency, t.at.slice(0, 10), t.price) : undefined)
          const per = costPerShare(asset)
          const openingCost = per !== undefined && boughtUsd.every((x) => x !== undefined)
            ? per * now - bought.reduce((sum, t, i) => sum + t.quantity * boughtUsd[i]!, 0)
            : undefined
          if (opening !== 0)
            entries.push({
              id: crypto.randomUUID(), portfolioId: p.id, asset, amount: quantity(opening),
              createdAt: history.from, note: 'Opening position', externalId: `open-${asset}`,
              price: opening > 0 && openingCost !== undefined && openingCost > 0 ? openingCost / opening : undefined,
            })
          for (const t of mine)
            entries.push({
              id: crypto.randomUUID(), portfolioId: p.id, asset, amount: quantity(t.quantity),
              createdAt: t.at, note: t.quantity > 0 ? 'Bought' : 'Sold', externalId: `trade-${t.id}`,
              price: t.quantity > 0 && t.price !== undefined ? convert?.(t.currency, t.at.slice(0, 10), t.price) : undefined,
            })
          shares.set(asset, now)
        }
        if (replaced.length) rebuild.push({ portfolioId: p.id, assets: replaced })
      }
      // A "Select all" card picks up newly bought stocks, if they can be priced.
      if (p.trackedAssets === null)
        for (const asset of held.keys())
          if (!followed.has(asset) && !shares.has(asset) && !p.removed.includes(asset) && (await usdPrice(tickerOf(asset))) !== undefined)
            assets.add(asset)

      for (const asset of assets) {
        const difference = Number(((held.get(asset) ?? 0) - (shares.get(asset) ?? 0)).toFixed(8))
        if (difference === 0) continue
        const price = difference > 0 ? await usdPrice(tickerOf(asset)) : undefined
        entries.push({
          price,
          id: crypto.randomUUID(),
          portfolioId: p.id,
          asset,
          amount: quantity(difference),
          createdAt: iso(to),
          note: shares.has(asset) ? 'Position change' : 'Opening position',
          externalId: `change-${asset}-${to}`,
        })
      }
    }
    // Opening positions without a known price get IBKR's average cost.
    const rebuilt = new Set(rebuild.flatMap((r) => r.assets.map((a) => `${r.portfolioId}|${a}`)))
    for (const p of state.portfolios)
      for (const asset of p.trackedAssets ?? Object.keys(p.shares)) {
        const price = costPerShare(asset)
        if (price !== undefined && !rebuilt.has(`${p.id}|${asset}`)) priced.push({ portfolioId: p.id, asset, price })
      }
    const payouts = await toPayouts(payments, state.portfolios)
    await ctx.runMutation(internal.ibkr.record, { userId, syncedAt: to * 1000, entries, payouts, rebuild, priced, history: history ? state.portfolios.map((p) => p.id) : [] })
    return { synced: userId, portfolios: state.portfolios.length, changed: entries.length }
}

/** Turns amounts in another currency into USD at the rate of their day (or the nearest earlier one). */
async function usdConverter(rows: { currency: string; date: string }[]) {
  const since = rows.reduce((a, r) => (r.date < a ? r.date : a), '9999-12-31')
  const rates = new Map<string, Record<string, number>>()
  for (const c of new Set(rows.map((r) => r.currency)))
    if (c !== 'USD') rates.set(c, await dailyUsd(`${c}USD=X`, since))
  return (currency: string, date: string, amount: number) => {
    if (currency === 'USD') return amount
    const days = rates.get(currency) ?? {}
    const day = Object.keys(days).sort().filter((d) => d <= date).pop() ?? Object.keys(days).sort()[0]
    return day ? amount * days[day] : undefined
  }
}

/** Payments in USD, one per IBKR portfolio that holds (or followed) the stock. Interest with no stock goes to the first portfolio. */
async function toPayouts(payments: Payment[], portfolios: SyncState['portfolios']) {
  if (!portfolios.length) return []
  const convert = await usdConverter(payments)
  const usdOn = (p: Payment) => convert(p.currency, p.date, p.amount)
  const out = []
  for (const p of payments) {
    const usd = usdOn(p)
    if (usd === undefined) continue
    const owners = p.asset
      ? portfolios.filter((h) => (h.trackedAssets ?? Object.keys(h.shares)).includes(p.asset!))
      : portfolios.slice(0, 1)
    for (const h of owners)
      out.push({ portfolioId: h.id, asset: p.asset, date: p.date, usd: Number(usd.toFixed(4)), kind: p.kind, externalId: `${h.id}-${p.id}` })
  }
  return out
}

/* ---------- Database steps (server-only) ---------- */

/** The user's kept token, Query ID and last stock list. */
export const stored = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const row = await ctx.db
      .query('ibkrTokens')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    return row && { token: row.token, queryId: row.queryId, positions: row.positions as Position[] }
  },
})

/** Stocks already followed by the user's IBKR portfolios; 'all' if one of them follows everything. */
async function claimed(ctx: QueryCtx, userId: Id<'users'>) {
  const rows = await ctx.db
    .query('portfolios')
    .withIndex('by_user_source', (q) => q.eq('userId', userId).eq('source', 'ibkr'))
    .collect()
  if (rows.some((r) => r.trackedAssets === null)) return 'all' as const
  return rows.flatMap((r) => r.trackedAssets ?? [])
}

/** Keeps the token and stock list; returns the stocks already connected. */
export const saveToken = internalMutation({
  args: { userId: v.id('users'), token: v.string(), queryId: v.string(), positions: v.any() },
  handler: async (ctx, { userId, token, queryId, positions }) => {
    const existing = await ctx.db
      .query('ibkrTokens')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    if (existing) await ctx.db.patch(existing._id, { token, queryId, positions })
    else await ctx.db.insert('ibkrTokens', { userId, token, queryId, positions })
    return claimed(ctx, userId)
  },
})

/** Creates the portfolio with an "Opening position" per picked stock (from the last stock list). */
export const create = internalMutation({
  args: {
    userId: v.id('users'),
    id: v.string(),
    name: v.string(),
    assets: v.array(v.string()),
    all: v.boolean(),
    /** Fresh entry ids (mutations can't make random ones). */
    ids: v.array(v.string()),
  },
  handler: async (ctx, { userId, id, name, assets, all, ids }) => {
    const stored = await ctx.db
      .query('ibkrTokens')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    if (!stored) throw fail('Add your IBKR token first.')
    const taken = await claimed(ctx, userId)
    if (taken === 'all') throw fail('All your IBKR stocks are already connected.')
    const picked = (stored.positions as Position[]).filter(
      (p) => p.price !== null && !taken.includes(p.asset) && (all || assets.includes(p.asset)),
    )
    if (!picked.length) throw fail('Pick at least one stock.')

    const at = Date.now()
    await ctx.db.insert('portfolios', {
      id,
      userId,
      name,
      createdAt: new Date(at).toISOString(),
      source: 'ibkr',
      // "Select all" also follows stocks bought later, unless another card already holds some.
      trackedAssets: all && taken.length === 0 ? null : picked.map((p) => p.asset),
      syncedAt: at,
      inNetWorth: true,
      cardPercent: 100,
      netWorthPercent: 100,
    })
    for (const [i, p] of picked.entries())
      await ctx.db.insert('entries', {
        id: ids[i] ?? crypto.randomUUID(),
        userId,
        portfolioId: id,
        asset: p.asset,
        amount: p.quantity,
        createdAt: new Date(at).toISOString(),
        note: 'Opening position',
        externalId: `opening-${p.asset}`,
      })
  },
})

/** Removes a stock from one of the user's IBKR portfolios: its rows and payouts go, and syncs skip it from now on. */
export const removeStock = mutation({
  args: { portfolioId: v.string(), asset: v.string() },
  handler: async (ctx, { portfolioId, asset }) => {
    const userId = await signedIn(ctx)
    const p = await ctx.db
      .query('portfolios')
      .withIndex('by_app_id', (q) => q.eq('id', portfolioId))
      .unique()
    if (!p || p.userId !== userId || p.source !== 'ibkr') throw fail('Portfolio not found.')
    const entries = await ctx.db
      .query('entries')
      .withIndex('by_portfolio_external', (q) => q.eq('portfolioId', portfolioId))
      .collect()
    for (const e of entries) if (e.asset === asset) await ctx.db.delete(e._id)
    const payouts = await ctx.db
      .query('payouts')
      .withIndex('by_portfolio_external', (q) => q.eq('portfolioId', portfolioId))
      .collect()
    for (const r of payouts) if (r.asset === asset) await ctx.db.delete(r._id)
    await ctx.db.patch(p._id, {
      // A picked list simply loses it (another card may connect it); "Select all" remembers it as removed.
      trackedAssets: p.trackedAssets ? p.trackedAssets.filter((a) => a !== asset) : p.trackedAssets,
      removedAssets: [...new Set([...(p.removedAssets ?? []), asset])],
    })
  },
})

/** The user whose IBKR portfolios have gone longest without a sync, if over 20 hours. */
export const due = internalQuery({
  args: {},
  handler: async (ctx) => {
    const p = await ctx.db
      .query('portfolios')
      .withIndex('by_source_synced', (q) => q.eq('source', 'ibkr'))
      .first()
    if (!p || (p.syncedAt !== undefined && p.syncedAt > Date.now() - 20 * 3600_000)) return null
    return p.userId
  },
})

/** When the user's IBKR cards were last synced (ms), or null if never. */
export const lastSync = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query('portfolios')
      .withIndex('by_user_source', (q) => q.eq('userId', userId).eq('source', 'ibkr'))
      .collect()
    const times = rows.map((r) => r.syncedAt).filter((t): t is number => t !== undefined)
    return times.length ? Math.max(...times) : null
  },
})

/** The user's token and IBKR portfolios with their current shares per stock. */
export const state = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }): Promise<SyncState> => {
    const token = await ctx.db
      .query('ibkrTokens')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    const portfolios = await ctx.db
      .query('portfolios')
      .withIndex('by_user_source', (q) => q.eq('userId', userId).eq('source', 'ibkr'))
      .collect()
    return {
      token: token && { token: token.token, queryId: token.queryId },
      portfolios: await Promise.all(
        portfolios.map(async (p) => {
          const entries = await ctx.db
            .query('entries')
            .withIndex('by_portfolio_external', (q) => q.eq('portfolioId', p.id))
            .collect()
          const shares = new Map<string, number>()
          for (const e of entries) shares.set(e.asset, (shares.get(e.asset) ?? 0) + Number(e.amount))
          return { id: p.id, trackedAssets: p.trackedAssets ?? null, removed: p.removedAssets ?? [], shares: Object.fromEntries(shares), history: (p.tradesVersion ?? 0) >= TRADES_VERSION }
        }),
      ),
    }
  },
})

/** Adds the share changes and marks all the user's IBKR portfolios as synced. */
export const record = internalMutation({
  args: {
    userId: v.id('users'),
    syncedAt: v.number(),
    entries: v.array(
      v.object({
        id: v.string(),
        portfolioId: v.string(),
        asset: v.string(),
        amount: v.string(),
        createdAt: v.string(),
        note: v.string(),
        externalId: v.string(),
        price: v.optional(v.number()),
      }),
    ),
    /** Assets whose old entries are replaced by `entries` (the real history). */
    rebuild: v.optional(v.array(v.object({ portfolioId: v.string(), assets: v.array(v.string()) }))),
    /** Average cost (USD per share) for opening positions that have no price yet. */
    priced: v.optional(v.array(v.object({ portfolioId: v.string(), asset: v.string(), price: v.number() }))),
    /** Portfolios that now have their real history. */
    history: v.optional(v.array(v.string())),
    payouts: v.optional(
      v.array(
        v.object({
          portfolioId: v.string(),
          asset: v.optional(v.string()),
          date: v.string(),
          usd: v.number(),
          kind: v.string(),
          externalId: v.string(),
        }),
      ),
    ),
  },
  handler: async (ctx, { userId, syncedAt, entries, payouts, rebuild, priced, history }) => {
    for (const r of rebuild ?? []) {
      const old = await ctx.db
        .query('entries')
        .withIndex('by_portfolio_external', (q) => q.eq('portfolioId', r.portfolioId))
        .collect()
      for (const e of old) if (r.assets.includes(e.asset)) await ctx.db.delete(e._id)
    }
    for (const e of entries) await ctx.db.insert('entries', { ...e, userId })
    for (const r of priced ?? []) {
      const rows = await ctx.db
        .query('entries')
        .withIndex('by_portfolio_external', (q) => q.eq('portfolioId', r.portfolioId))
        .collect()
      for (const e of rows)
        if (e.asset === r.asset && e.note === 'Opening position' && e.price === undefined && Number(e.amount) > 0)
          await ctx.db.patch(e._id, { price: Number(r.price.toFixed(6)) })
    }
    for (const r of payouts ?? []) {
      const known = await ctx.db
        .query('payouts')
        .withIndex('by_portfolio_external', (q) => q.eq('portfolioId', r.portfolioId).eq('externalId', r.externalId))
        .first()
      if (!known) await ctx.db.insert('payouts', { ...r, userId })
    }
    const portfolios = await ctx.db
      .query('portfolios')
      .withIndex('by_user_source', (q) => q.eq('userId', userId).eq('source', 'ibkr'))
      .collect()
    for (const p of portfolios) await ctx.db.patch(p._id, { syncedAt, ...(history?.includes(p.id) ? { tradesVersion: TRADES_VERSION } : {}) })
  },
})


/** Debug only (temporary): run one user's sync from the CLI. */
export const syncFor = internalAction({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }): Promise<object> => syncUser(ctx, userId),
})
