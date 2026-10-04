// Monobank card sync (Supabase Edge Function, Deno).
//
// Actions (POST JSON { action, ... }):
//   cards   { token }               signed-in user: checks the token, keeps it, lists the cards.
//   connect { accountId, name }     signed-in user: creates a portfolio for a card with its last 31 days.
//   sync                            pg_cron (x-cron-secret header): refreshes the stalest card.
//
// Monobank's personal API allows one request per minute per endpoint, so every action makes
// at most one call to each endpoint. Amounts come in minor units (kopiyky / cents).

import { createClient } from 'npm:@supabase/supabase-js@2'

const MONO = 'https://api.monobank.ua'
const DAY = 86_400
/** ISO 4217 numeric codes of the currencies the app can price. */
const ASSETS: Record<number, string> = { 980: 'UAH', 840: 'USD', 978: 'EUR', 985: 'PLN' }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

type Account = {
  id: string
  balance: number
  creditLimit: number
  currencyCode: number
  type: string
  maskedPan?: string[]
  iban?: string
}
type Item = { id: string; time: number; description: string; amount: number; balance: number }

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
const decimal = (minor: number) => (minor / 100).toFixed(2)

async function check<T>(request: PromiseLike<{ data: T; error: unknown }>) {
  const { data, error } = await request
  if (error) throw error
  return data
}

async function mono<T>(token: string, path: string): Promise<T> {
  const res = await fetch(MONO + path, { headers: { 'X-Token': token } })
  if (res.status === 429) throw new Fail('Monobank allows one request per minute. Try again in a minute.', 429)
  if (res.status === 401 || res.status === 403)
    throw new Fail('Monobank did not accept this token. Create a new one at api.monobank.ua.', 401)
  if (!res.ok) throw new Fail(`Monobank is not responding (${res.status}). Try again later.`, 502)
  return res.json()
}

/** Transactions from `from` to `to` (unix seconds, at most 31 days apart), oldest first. */
async function statement(token: string, accountId: string, from: number, to: number) {
  const items = await mono<Item[]>(token, `/personal/statement/${accountId}/${from}/${to}`)
  return items.sort((a, b) => a.time - b.time)
}

async function stored(userId: string) {
  const row = await check(db.from('monobank_tokens').select('token, accounts').eq('user_id', userId).maybeSingle())
  if (!row) throw new Fail('Add your Monobank token first.')
  return row as { token: string; accounts: Account[] }
}

const entryRow = (userId: string, portfolioId: string, asset: string, item: Item) => ({
  user_id: userId,
  portfolio_id: portfolioId,
  asset,
  amount: decimal(item.amount),
  created_at: iso(item.time),
  note: item.description || null,
  external_id: item.id,
})

async function userOf(req: Request) {
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer /, '')
  const { data } = jwt ? await db.auth.getUser(jwt) : { data: { user: null } }
  if (!data.user) throw new Fail('Please sign in again.', 401)
  return data.user.id
}

async function cards(userId: string, token: string) {
  if (!token) throw new Fail('Paste your Monobank token.')
  const { accounts } = await mono<{ accounts: Account[] }>(token, '/personal/client-info')
  await check(db.from('monobank_tokens').upsert({ user_id: userId, token, accounts }))
  const linked = await check(
    db.from('portfolios').select('external_account_id').eq('user_id', userId).eq('source', 'monobank'),
  )
  const connected = new Set(linked.map((p) => p.external_account_id))
  return {
    cards: accounts.map((a) => ({
      id: a.id,
      type: a.type,
      last4: (a.maskedPan?.[0] ?? a.iban ?? '').slice(-4),
      asset: ASSETS[a.currencyCode] ?? null,
      balance: decimal(a.balance),
      connected: connected.has(a.id),
    })),
  }
}

async function connect(userId: string, accountId: string, name: string) {
  if (!name) throw new Fail('Give the card a name.')
  const { token, accounts } = await stored(userId)
  const account = accounts.find((a) => a.id === accountId)
  const asset = account && ASSETS[account.currencyCode]
  if (!account || !asset) throw new Fail('This card can’t be connected.')

  const to = now()
  const from = to - 31 * DAY
  const items = await statement(token, accountId, from, to)

  // Start from the balance before the oldest transaction, so the entries add up to today's balance.
  // Monobank returns at most 500 transactions; if cut off, history starts at the oldest one returned.
  const oldest = items[0]
  const opening = oldest ? oldest.balance - oldest.amount : account.balance
  const openingAt = oldest && items.length >= 500 ? oldest.time - 1 : from

  const portfolio = await check(
    db
      .from('portfolios')
      .insert({
        user_id: userId,
        name,
        source: 'monobank',
        external_account_id: accountId,
        synced_at: iso(to),
      })
      .select('id')
      .single(),
  )
  const rows = items.map((item) => entryRow(userId, portfolio.id, asset, item))
  if (opening !== 0)
    rows.unshift({
      user_id: userId,
      portfolio_id: portfolio.id,
      asset,
      amount: decimal(opening),
      created_at: iso(openingAt),
      note: 'Opening balance',
      external_id: 'opening',
    })
  const { error } = await db.from('entries').insert(rows)
  if (error) {
    await db.from('portfolios').delete().eq('id', portfolio.id)
    throw error
  }
  return { portfolioId: portfolio.id }
}

/** Sum of a portfolio's entries in minor units (paged: the API returns at most 1000 rows at a time). */
async function totalOf(portfolioId: string) {
  let total = 0
  for (let start = 0; ; start += 1000) {
    const rows = await check(
      db.from('entries').select('amount').eq('portfolio_id', portfolioId).order('id').range(start, start + 999),
    )
    for (const r of rows) total += Math.round(Number(r.amount) * 100)
    if (rows.length < 1000) return total
  }
}

async function sync() {
  const stale = iso(now() - 20 * 3600)
  const portfolio = await check(
    db
      .from('portfolios')
      .select('id, user_id, external_account_id, synced_at')
      .eq('source', 'monobank')
      .or(`synced_at.is.null,synced_at.lt.${stale}`)
      .order('synced_at', { ascending: true, nullsFirst: true })
      .limit(1)
      .maybeSingle(),
  )
  if (!portfolio) return { synced: null }

  const { id, user_id: userId, external_account_id: accountId } = portfolio
  const { token } = await stored(userId)
  // Balance first, then only transactions up to that moment, so the two always agree.
  const { accounts } = await mono<{ accounts: Account[] }>(token, '/personal/client-info')
  const to = now()
  await db.from('monobank_tokens').update({ accounts }).eq('user_id', userId)
  const account = accounts.find((a) => a.id === accountId)
  const asset = account && ASSETS[account.currencyCode]
  if (!account || !asset) {
    // The card is closed or changed currency: leave the portfolio as it is.
    await check(db.from('portfolios').update({ synced_at: iso(to) }).eq('id', id))
    return { synced: id, skipped: true }
  }

  const last = portfolio.synced_at ? Math.floor(Date.parse(portfolio.synced_at) / 1000) : 0
  const from = Math.max(last - DAY, to - 31 * DAY)
  const items = await statement(token, accountId, from, to)
  if (items.length)
    await check(
      db
        .from('entries')
        .upsert(
          items.map((item) => entryRow(userId, id, asset, item)),
          { onConflict: 'portfolio_id,external_id', ignoreDuplicates: true },
        ),
    )

  // Cashback, settled holds or a changed credit limit move the balance without a transaction:
  // record the difference so the card always matches Monobank.
  const difference = account.balance - (await totalOf(id))
  if (difference !== 0)
    await check(
      db.from('entries').insert({
        user_id: userId,
        portfolio_id: id,
        asset,
        amount: decimal(difference),
        created_at: iso(to),
        note: 'Balance adjustment',
        external_id: `adjustment-${to}`,
      }),
    )

  await check(db.from('portfolios').update({ synced_at: iso(to) }).eq('id', id))
  return { synced: id, added: items.length, adjusted: difference !== 0 }
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
    if (body.action === 'cards') return json(await cards(userId, String(body.token ?? '').trim()))
    if (body.action === 'connect')
      return json(await connect(userId, String(body.accountId ?? ''), String(body.name ?? '').trim()))
    throw new Fail('Unknown action.')
  } catch (e) {
    if (e instanceof Fail) return json({ error: e.message }, e.status)
    console.error(e)
    return json({ error: 'Something went wrong. Try again.' }, 500)
  }
})
