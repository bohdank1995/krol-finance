// Interactive Brokers stocks + stock prices (Supabase Edge Function, Deno).
//
// Actions (POST JSON { action, ... }):
//   positions { token, queryId }      signed-in user: runs the Flex Query, keeps the token, lists the stocks.
//   connect   { name, assets, all }   signed-in user: creates a portfolio with one entry per picked stock.
//   quotes    { assets }              signed-in user: live USD prices of stock assets.
//   history   { asset, since }        signed-in user: daily USD closes of a stock asset from a day on.
//   sync                              pg_cron (x-cron-secret header): refreshes the stalest IBKR user.
//
// Holdings come from IBKR's Flex Web Service (read-only reports, as of the last business day).
// Prices come from Yahoo Finance's public chart data. A stock asset is "stock:<Yahoo ticker>",
// e.g. "stock:AAPL" or "stock:VWCE.DE", and is always valued in USD.

import { createClient } from 'npm:@supabase/supabase-js@2'

const FLEX = 'https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService'
const YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart/'
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (krol-finance)' }
const DAY = 86_400

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

/** One stock from the Flex Query, summed across accounts. `price` is USD per share, null if it can't be priced. */
type Position = { asset: string; symbol: string; name: string; quantity: string; price: number | null }

/** An error whose message is safe to show in the app. */
class Fail extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const now = () => Math.floor(Date.now() / 1000)
const iso = (seconds: number) => new Date(seconds * 1000).toISOString()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** Share counts can be fractional: keep 8 decimals, no float noise ("0.30000000000000004" → "0.3"). */
const quantity = (n: number) => String(Number(n.toFixed(8)))
const tickerOf = (asset: string) => asset.slice('stock:'.length)

async function check<T>(request: PromiseLike<{ data: T; error: unknown }>) {
  const { data, error } = await request
  if (error) throw error
  return data
}

async function userOf(req: Request) {
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer /, '')
  const { data } = jwt ? await db.auth.getUser(jwt) : { data: { user: null } }
  if (!data.user) throw new Fail('Please sign in again.', 401)
  return data.user.id
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
  if (!res.ok) throw new Fail(`IBKR is not responding (${res.status}). Try again later.`, 502)
  return res.text()
}

function flexFail(xml: string): never {
  const code = tag(xml, 'ErrorCode') ?? ''
  const message = FLEX_ERRORS[code] ?? `IBKR says: ${tag(xml, 'ErrorMessage') ?? 'the report could not be made'}`
  throw new Fail(message, code === '1018' ? 429 : 400)
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
      throw new Fail('Set the Flex Query’s format to XML (under Delivery Configuration), then try again.')
    const code = tag(xml, 'ErrorCode')
    // 1019: still being generated. 1009: IBKR is busy.
    if (code === '1019' || code === '1009') continue
    flexFail(xml)
  }
  throw new Fail('IBKR is still preparing the report. Try again in a minute.', 504)
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
  if (!xml.includes('<OpenPositions'))
    throw new Fail('Add the Open Positions section to the Flex Query, then try again.')
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

// The function instance stays warm between calls: reuse recent answers (every viewer polls).
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

/* ---------- Actions ---------- */

async function stored(userId: string) {
  const row = await check(
    db.from('ibkr_tokens').select('token, query_id, positions').eq('user_id', userId).maybeSingle(),
  )
  if (!row) throw new Fail('Add your IBKR token first.')
  return row as { token: string; query_id: string; positions: Position[] }
}

/** Stocks already followed by the user's IBKR portfolios; 'all' if one of them follows everything. */
async function claimed(userId: string): Promise<Set<string> | 'all'> {
  const rows = await check(
    db.from('portfolios').select('tracked_assets').eq('user_id', userId).eq('source', 'ibkr'),
  )
  if (rows.some((r) => r.tracked_assets === null)) return 'all'
  return new Set(rows.flatMap((r) => r.tracked_assets as string[]))
}

async function positions(userId: string, token: string, queryId: string) {
  if (!token || !queryId) throw new Fail('Paste both the token and the Query ID.')
  if (!/^\d+$/.test(queryId)) throw new Fail('The Query ID is a number. Copy it from the Flex Queries list.')
  const list = parsePositions(await report(token, queryId))
  const priced: Position[] = await Promise.all(
    list.map(async (p) => ({ ...p, price: (await usdPrice(tickerOf(p.asset))) ?? null })),
  )
  await check(db.from('ibkr_tokens').upsert({ user_id: userId, token, query_id: queryId, positions: priced }))
  const taken = await claimed(userId)
  return {
    positions: priced.map((p) => ({
      asset: p.asset,
      symbol: p.symbol,
      name: p.name,
      quantity: p.quantity,
      value: p.price === null ? null : p.price * Number(p.quantity),
      connected: taken === 'all' || taken.has(p.asset),
    })),
  }
}

async function connect(userId: string, name: string, assets: string[], all: boolean) {
  if (!name) throw new Fail('Give the portfolio a name.')
  const { positions } = await stored(userId)
  const taken = await claimed(userId)
  if (taken === 'all') throw new Fail('All your IBKR stocks are already connected.')
  const picked = positions.filter((p) => p.price !== null && !taken.has(p.asset) && (all || assets.includes(p.asset)))
  if (!picked.length) throw new Fail('Pick at least one stock.')

  const at = iso(now())
  const portfolio = await check(
    db
      .from('portfolios')
      .insert({
        user_id: userId,
        name,
        source: 'ibkr',
        // "Select all" also follows stocks bought later, unless another card already holds some.
        tracked_assets: all && taken.size === 0 ? null : picked.map((p) => p.asset),
        synced_at: at,
      })
      .select('id')
      .single(),
  )
  const { error } = await db.from('entries').insert(
    picked.map((p) => ({
      user_id: userId,
      portfolio_id: portfolio.id,
      asset: p.asset,
      amount: p.quantity,
      created_at: at,
      note: 'Opening position',
      external_id: `opening-${p.asset}`,
    })),
  )
  if (error) {
    await db.from('portfolios').delete().eq('id', portfolio.id)
    throw error
  }
  return { portfolioId: portfolio.id }
}

function stockAssets(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((a): a is string => typeof a === 'string' && a.startsWith('stock:')).slice(0, 100)
}

async function quotes(assets: string[]) {
  const prices: Record<string, number> = {}
  await Promise.all(
    assets.map(async (asset) => {
      const price = await usdPrice(tickerOf(asset))
      if (price) prices[asset] = price
    }),
  )
  return { prices }
}

/** Shares per asset in a portfolio (paged: the API returns at most 1000 rows at a time). */
async function sharesOf(portfolioId: string) {
  const totals = new Map<string, number>()
  for (let start = 0; ; start += 1000) {
    const rows = await check(
      db.from('entries').select('asset, amount').eq('portfolio_id', portfolioId).order('id').range(start, start + 999),
    )
    for (const r of rows) totals.set(r.asset, (totals.get(r.asset) ?? 0) + Number(r.amount))
    if (rows.length < 1000) return totals
  }
}

async function sync() {
  const stale = iso(now() - 20 * 3600)
  const due = await check(
    db
      .from('portfolios')
      .select('user_id')
      .eq('source', 'ibkr')
      .or(`synced_at.is.null,synced_at.lt.${stale}`)
      .order('synced_at', { ascending: true, nullsFirst: true })
      .limit(1)
      .maybeSingle(),
  )
  if (!due) return { synced: null }

  const userId = due.user_id as string
  const to = now()
  const portfolios = await check(
    db.from('portfolios').select('id, tracked_assets').eq('user_id', userId).eq('source', 'ibkr'),
  )
  let held: Map<string, number>
  try {
    const { token, query_id } = await stored(userId)
    held = new Map(parsePositions(await report(token, query_id)).map((p) => [p.asset, Number(p.quantity)]))
  } catch (e) {
    // An expired token or a changed query: move on to other users, try again tomorrow.
    await db.from('portfolios').update({ synced_at: iso(to) }).eq('user_id', userId).eq('source', 'ibkr')
    throw e
  }

  const followed = new Set(portfolios.flatMap((p) => (p.tracked_assets as string[] | null) ?? []))
  let changed = 0
  for (const p of portfolios) {
    const shares = await sharesOf(p.id)
    const tracked = p.tracked_assets as string[] | null
    const assets = new Set(tracked ?? shares.keys())
    // A "Select all" card picks up newly bought stocks, if they can be priced.
    if (tracked === null)
      for (const asset of held.keys())
        if (!followed.has(asset) && !shares.has(asset) && (await usdPrice(tickerOf(asset))) !== undefined)
          assets.add(asset)

    const rows = []
    for (const asset of assets) {
      const difference = Number(((held.get(asset) ?? 0) - (shares.get(asset) ?? 0)).toFixed(8))
      if (difference === 0) continue
      rows.push({
        user_id: userId,
        portfolio_id: p.id,
        asset,
        amount: quantity(difference),
        created_at: iso(to),
        note: shares.has(asset) ? 'Position change' : 'Opening position',
        external_id: `change-${asset}-${to}`,
      })
    }
    if (rows.length) await check(db.from('entries').insert(rows))
    changed += rows.length
    await check(db.from('portfolios').update({ synced_at: iso(to) }).eq('id', p.id))
  }
  return { synced: userId, portfolios: portfolios.length, changed }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json().catch(() => ({}))
    if (body.action === 'sync') {
      const secret = Deno.env.get('CRON_SECRET')
      if (!secret || req.headers.get('x-cron-secret') !== secret) throw new Fail('Not allowed.', 401)
      return json(await sync())
    }
    const userId = await userOf(req)
    if (body.action === 'positions')
      return json(await positions(userId, String(body.token ?? '').trim(), String(body.queryId ?? '').trim()))
    if (body.action === 'connect')
      return json(await connect(userId, String(body.name ?? '').trim(), stockAssets(body.assets), body.all === true))
    if (body.action === 'quotes') return json(await quotes(stockAssets(body.assets)))
    if (body.action === 'history') {
      const [asset] = stockAssets([body.asset])
      const since = String(body.since ?? '')
      if (!asset || !/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new Fail('Unknown stock or day.')
      return json({ days: await dailyUsd(tickerOf(asset), since) })
    }
    throw new Fail('Unknown action.')
  } catch (e) {
    if (e instanceof Fail) return json({ error: e.message }, e.status)
    console.error(e)
    return json({ error: 'Something went wrong. Try again.' }, 500)
  }
})
