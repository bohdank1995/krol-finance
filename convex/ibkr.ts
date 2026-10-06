import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { action, internalAction, internalMutation, internalQuery, type QueryCtx } from './_generated/server'
import { userOf } from './monobank'

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

/** One stock from the Flex Query, summed across accounts. `price` is USD per share, null if it can't be priced. */
type Position = { asset: string; symbol: string; name: string; quantity: string; price: number | null }

/** A stock as the app lists it; `value` is the USD value of the shares held. */
type Listed = Omit<Position, 'price'> & { value: number | null; connected: boolean }
/** What the sync needs to know about a user. */
type SyncState = {
  token: { token: string; queryId: string } | null
  portfolios: { id: string; trackedAssets: string[] | null; shares: Record<string, number> }[]
}

const now = () => Math.floor(Date.now() / 1000)
const iso = (seconds: number) => new Date(seconds * 1000).toISOString()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** Share counts can be fractional: keep 8 decimals, no float noise ("0.30000000000000004" → "0.3"). */
const quantity = (n: number) => String(Number(n.toFixed(8)))
const tickerOf = (asset: string) => asset.slice('stock:'.length)
/** Errors thrown as ConvexError show their message in the app. */
const fail = (message: string) => new ConvexError(message)

/* ---------- IBKR Flex Web Service ---------- */

const FLEX_ERRORS: Record<string, string> = {
  '1011': 'Flex Web Service is off for this account. Turn it on in Flex Web Service Configuration.',
  '1012': 'This IBKR token has expired. Generate a new one in Flex Web Service Configuration.',
  '1013': 'This token only works from certain IP addresses. Remove the IP restriction in Flex Web Service Configuration.',
  '1014': 'IBKR doesn’t know this Query ID. Copy it again from the Flex Queries list.',
  '1015': 'IBKR did not accept this token. Check it, or generate a new one.',
  '1018': 'IBKR is limiting requests. Try again in a minute.',
}

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
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw fail(`IBKR is not responding (${res.status}). Try again later.`)
  return res.text()
}

function flexFail(xml: string): never {
  const code = tag(xml, 'ErrorCode') ?? ''
  throw fail(FLEX_ERRORS[code] ?? `IBKR says: ${tag(xml, 'ErrorMessage') ?? 'the report could not be made'}`)
}

/** Asks IBKR to run the query, then waits for the finished XML report. */
async function report(token: string, queryId: string) {
  const t = encodeURIComponent(token)
  const sent = await flexGet(`${FLEX}/SendRequest?t=${t}&q=${encodeURIComponent(queryId)}&v=3`)
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

const stockAssets = (assets: string[]) => assets.filter((a) => a.startsWith('stock:')).slice(0, 100)

/* ---------- Called by the app ---------- */

export const positions = action({
  args: { token: v.string(), queryId: v.string() },
  handler: async (ctx, args): Promise<Listed[]> => {
    const userId = await userOf(ctx)
    const token = args.token.trim()
    const queryId = args.queryId.trim()
    if (!token || !queryId) throw fail('Paste both the token and the Query ID.')
    if (!/^\d+$/.test(queryId)) throw fail('The Query ID is a number. Copy it from the Flex Queries list.')
    const list = parsePositions(await report(token, queryId))
    const priced: Position[] = await Promise.all(
      list.map(async (p) => ({ ...p, price: (await usdPrice(tickerOf(p.asset))) ?? null })),
    )
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
    return dailyUsd(tickerOf(asset), since)
  },
})

/* ---------- Called by the hourly cron ---------- */

export const sync = internalAction({
  args: {},
  handler: async (ctx): Promise<object> => {
    const userId: Id<'users'> | null = await ctx.runQuery(internal.ibkr.due)
    if (!userId) return { synced: null }
    const to = now()
    const state: SyncState = await ctx.runQuery(internal.ibkr.state, { userId })

    let held: Map<string, number>
    try {
      if (!state.token) throw new Error('No IBKR token')
      held = new Map(
        parsePositions(await report(state.token.token, state.token.queryId)).map((p) => [p.asset, Number(p.quantity)]),
      )
    } catch (e) {
      // An expired token or a changed query: move on to other users, try again tomorrow.
      await ctx.runMutation(internal.ibkr.record, { userId, syncedAt: to * 1000, entries: [] })
      throw e
    }

    const followed = new Set(state.portfolios.flatMap((p) => p.trackedAssets ?? []))
    const entries = []
    for (const p of state.portfolios) {
      const shares = new Map(Object.entries(p.shares))
      const assets = new Set(p.trackedAssets ?? shares.keys())
      // A "Select all" card picks up newly bought stocks, if they can be priced.
      if (p.trackedAssets === null)
        for (const asset of held.keys())
          if (!followed.has(asset) && !shares.has(asset) && (await usdPrice(tickerOf(asset))) !== undefined)
            assets.add(asset)

      for (const asset of assets) {
        const difference = Number(((held.get(asset) ?? 0) - (shares.get(asset) ?? 0)).toFixed(8))
        if (difference === 0) continue
        entries.push({
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
    await ctx.runMutation(internal.ibkr.record, { userId, syncedAt: to * 1000, entries })
    return { synced: userId, portfolios: state.portfolios.length, changed: entries.length }
  },
})

/* ---------- Database steps (server-only) ---------- */

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
          return { id: p.id, trackedAssets: p.trackedAssets ?? null, shares: Object.fromEntries(shares) }
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
      }),
    ),
  },
  handler: async (ctx, { userId, syncedAt, entries }) => {
    for (const e of entries) await ctx.db.insert('entries', { ...e, userId })
    const portfolios = await ctx.db
      .query('portfolios')
      .withIndex('by_user_source', (q) => q.eq('userId', userId).eq('source', 'ibkr'))
      .collect()
    for (const p of portfolios) await ctx.db.patch(p._id, { syncedAt })
  },
})
