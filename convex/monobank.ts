import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { action, internalAction, internalMutation, internalQuery, type ActionCtx } from './_generated/server'

/* Monobank card sync. The app calls `cards` (check the token, keep it, list the cards) and
   `connect` (create a portfolio for a card with its last 31 days); the hourly cron calls `sync`
   (refresh the stalest card). Tokens never leave the server.

   Monobank's personal API allows one request per minute per endpoint, so every action makes
   at most one call to each endpoint. Amounts come in minor units (kopiyky / cents). */

const MONO = 'https://api.monobank.ua'
const DAY = 86_400
/** ISO 4217 numeric codes of the currencies the app can price. */
const ASSETS: Record<number, string> = { 980: 'UAH', 840: 'USD', 978: 'EUR', 985: 'PLN' }

type Account = {
  id: string
  balance: number
  creditLimit: number
  currencyCode: number
  type: string
  maskedPan?: string[]
  iban?: string
}
/** A card as the app lists it. */
type Card = { id: string; type: string; last4: string; asset: string | null; balance: string; connected: boolean }
type Item = { id: string; time: number; description: string; amount: number; balance: number }

const now = () => Math.floor(Date.now() / 1000)
const iso = (seconds: number) => new Date(seconds * 1000).toISOString()
const decimal = (minor: number) => (minor / 100).toFixed(2)

/** Errors thrown as ConvexError show their message in the app. */
const fail = (message: string) => new ConvexError(message)

async function mono<T>(token: string, path: string): Promise<T> {
  const res = await fetch(MONO + path, { headers: { 'X-Token': token } })
  if (res.status === 429) throw fail('Monobank allows one request per minute. Try again in a minute.')
  if (res.status === 401 || res.status === 403)
    throw fail('Monobank did not accept this token. Create a new one at api.monobank.ua.')
  if (!res.ok) throw fail(`Monobank is not responding (${res.status}). Try again later.`)
  return res.json()
}

/** Transactions from `from` to `to` (unix seconds, at most 31 days apart), oldest first. */
async function statement(token: string, accountId: string, from: number, to: number) {
  const items = await mono<Item[]>(token, `/personal/statement/${accountId}/${from}/${to}`)
  return items.sort((a, b) => a.time - b.time)
}

const syncedEntry = v.object({
  id: v.string(),
  asset: v.string(),
  amount: v.string(),
  createdAt: v.string(),
  note: v.optional(v.string()),
  externalId: v.string(),
})

const entryOf = (asset: string, item: Item) => ({
  id: crypto.randomUUID(),
  asset,
  amount: decimal(item.amount),
  createdAt: iso(item.time),
  note: item.description || undefined,
  externalId: item.id,
})

export async function userOf(ctx: ActionCtx) {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw fail('Please sign in again.')
  return userId
}

/* ---------- Called by the app ---------- */

const cardsOf = (accounts: Account[], connected: Set<string>): Card[] =>
  accounts.map((a) => ({
    id: a.id,
    type: a.type,
    last4: (a.maskedPan?.[0] ?? a.iban ?? '').slice(-4),
    asset: ASSETS[a.currencyCode] ?? null,
    balance: decimal(a.balance),
    connected: connected.has(a.id),
  }))

/** Lists the cards. With a token: checks and keeps it. Without: uses the kept one (null if none),
    so the token is only ever pasted once. */
export const cards = action({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Card[] | null> => {
    const userId = await userOf(ctx)
    const given = args.token?.trim()
    const stored: Doc<'monobankTokens'> | null = await ctx.runQuery(internal.monobank.stored, { userId })
    if (args.token !== undefined && !given) throw fail('Paste your Monobank token.')
    const token = given || stored?.token
    if (!token) return null
    let accounts: Account[]
    try {
      accounts = (await mono<{ accounts: Account[] }>(token, '/personal/client-info')).accounts
    } catch (e) {
      // Monobank allows one request a minute: show the last known list instead of an error.
      if (!given && stored && e instanceof ConvexError && String(e.data).includes('one request')) {
        const linked = new Set<string>(await ctx.runMutation(internal.monobank.saveToken, { userId, token, accounts: stored.accounts }))
        return cardsOf(stored.accounts as Account[], linked)
      }
      throw e
    }
    const connected = new Set<string>(await ctx.runMutation(internal.monobank.saveToken, { userId, token, accounts }))
    return cardsOf(accounts, connected)
  },
})

export const connect = action({
  args: { accountId: v.string(), name: v.string() },
  handler: async (ctx, args): Promise<string> => {
    const userId = await userOf(ctx)
    const name = args.name.trim()
    if (!name) throw fail('Give the card a name.')
    const stored: Doc<'monobankTokens'> | null = await ctx.runQuery(internal.monobank.stored, { userId })
    if (!stored) throw fail('Add your Monobank token first.')
    const account = (stored.accounts as Account[]).find((a) => a.id === args.accountId)
    const asset = account && ASSETS[account.currencyCode]
    if (!account || !asset) throw fail('This card can’t be connected.')

    const to = now()
    const from = to - 31 * DAY
    const items = await statement(stored.token, account.id, from, to)

    // Start from the balance before the oldest transaction, so the entries add up to today's balance.
    // Monobank returns at most 500 transactions; if cut off, history starts at the oldest one returned.
    const oldest = items[0]
    const opening = oldest ? oldest.balance - oldest.amount : account.balance
    const openingAt = oldest && items.length >= 500 ? oldest.time - 1 : from
    const entries = items.map((item) => entryOf(asset, item))
    if (opening !== 0)
      entries.unshift({
        id: crypto.randomUUID(),
        asset,
        amount: decimal(opening),
        createdAt: iso(openingAt),
        note: 'Opening balance',
        externalId: 'opening',
      })

    const id = crypto.randomUUID()
    await ctx.runMutation(internal.monobank.create, {
      userId,
      id,
      name,
      accountId: account.id,
      syncedAt: to * 1000,
      entries,
    })
    await ensureWebhook(ctx, userId, stored.token)
    return id
  },
})

/* ---------- Real time: Monobank calls us when a transaction happens ---------- */

/** Tells Monobank to post every new transaction to our webhook, at a secret address only this
    user's token row knows. Best effort: if it fails, the hourly sync still catches up. */
async function ensureWebhook(ctx: ActionCtx, userId: Id<'users'>, token: string) {
  try {
    const site = process.env.CONVEX_SITE_URL
    if (!site) return
    const row: Doc<'monobankTokens'> | null = await ctx.runQuery(internal.monobank.stored, { userId })
    if (row?.webhookSecret) return
    const secret = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('')
    await ctx.runMutation(internal.monobank.setWebhookSecret, { userId, secret })
    const res = await fetch(MONO + '/personal/webhook', {
      method: 'POST',
      headers: { 'X-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ webHookUrl: `${site}/monobank/webhook/${secret}` }),
    })
    // Monobank checks the address with a GET first; if it refused, forget the secret to retry later.
    if (!res.ok) await ctx.runMutation(internal.monobank.setWebhookSecret, { userId, secret: undefined })
  } catch {
    /* ignored on purpose */
  }
}

/** Handles one webhook call from Monobank (see `http.ts`). */
export const receive = internalMutation({
  args: { secret: v.string(), accountId: v.string(), item: v.any() },
  handler: async (ctx, { secret, accountId, item }) => {
    const row = await ctx.db
      .query('monobankTokens')
      .withIndex('by_webhook_secret', (q) => q.eq('webhookSecret', secret))
      .unique()
    if (!row) return false
    const p = (
      await ctx.db
        .query('portfolios')
        .withIndex('by_user_source', (q) => q.eq('userId', row.userId).eq('source', 'monobank'))
        .collect()
    ).find((x) => x.externalAccountId === accountId)
    const account = (row.accounts as Account[]).find((a) => a.id === accountId)
    const asset = account && ASSETS[account.currencyCode]
    if (!p || !asset) return false
    const tx = item as Item
    const seen = await ctx.db
      .query('entries')
      .withIndex('by_portfolio_external', (q) => q.eq('portfolioId', p.id).eq('externalId', tx.id))
      .first()
    if (!seen) await ctx.db.insert('entries', { ...entryOf(asset, tx), userId: p.userId, portfolioId: p.id })
    // `balance` is the card balance right after this transaction: add an adjustment if we differ.
    const all = await ctx.db
      .query('entries')
      .withIndex('by_portfolio_external', (q) => q.eq('portfolioId', p.id))
      .collect()
    const total = all.reduce((sum, e) => sum + Math.round(Number(e.amount) * 100), 0)
    const difference = tx.balance - total
    if (difference !== 0) {
      await ctx.db.insert('entries', {
        id: crypto.randomUUID(),
        userId: p.userId,
        portfolioId: p.id,
        asset,
        amount: decimal(difference),
        createdAt: iso(tx.time),
        note: 'Balance adjustment',
        externalId: `adjustment-${tx.time}-${tx.id}`,
      })
    }
    await ctx.db.patch(p._id, { syncedAt: Date.now() })
    return true
  },
})

export const setWebhookSecret = internalMutation({
  args: { userId: v.id('users'), secret: v.optional(v.string()) },
  handler: async (ctx, { userId, secret }) => {
    const row = await ctx.db
      .query('monobankTokens')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    if (row) await ctx.db.patch(row._id, { webhookSecret: secret })
  },
})

/* ---------- Called by the hourly cron (a safety net behind the webhook) ---------- */

export const sync = internalAction({
  args: {},
  handler: async (ctx): Promise<object> => {
    const portfolio: Doc<'portfolios'> | null = await ctx.runQuery(internal.monobank.due)
    if (!portfolio) return { synced: null }
    const stored: Doc<'monobankTokens'> | null = await ctx.runQuery(internal.monobank.stored, {
      userId: portfolio.userId,
    })
    if (!stored) throw new Error(`No Monobank token for portfolio ${portfolio.id}`)

    // Balance first, then only transactions up to that moment, so the two always agree.
    const { accounts } = await mono<{ accounts: Account[] }>(stored.token, '/personal/client-info')
    const to = now()
    await ctx.runMutation(internal.monobank.saveToken, { userId: portfolio.userId, token: stored.token, accounts })
    await ensureWebhook(ctx, portfolio.userId, stored.token)
    const account = accounts.find((a) => a.id === portfolio.externalAccountId)
    const asset = account && ASSETS[account.currencyCode]
    if (!account || !asset) {
      // The card is closed or changed currency: leave the portfolio as it is.
      await ctx.runMutation(internal.monobank.applySync, { portfolioId: portfolio.id, syncedAt: to * 1000, entries: [] })
      return { synced: portfolio.id, skipped: true }
    }

    const last = portfolio.syncedAt ? Math.floor(portfolio.syncedAt / 1000) : 0
    const from = Math.max(last - DAY, to - 31 * DAY)
    const items = await statement(stored.token, account.id, from, to)
    const adjusted: boolean = await ctx.runMutation(internal.monobank.applySync, {
      portfolioId: portfolio.id,
      syncedAt: to * 1000,
      entries: items.map((item) => entryOf(asset, item)),
      balance: { asset, minor: account.balance, adjustmentId: crypto.randomUUID() },
    })
    return { synced: portfolio.id, added: items.length, adjusted }
  },
})

/* ---------- Database steps (server-only) ---------- */

export const stored = internalQuery({
  args: { userId: v.id('users') },
  handler: (ctx, { userId }) =>
    ctx.db
      .query('monobankTokens')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique(),
})

/** Keeps the token and card list; returns the ids of cards that already have a portfolio. */
export const saveToken = internalMutation({
  args: { userId: v.id('users'), token: v.string(), accounts: v.any() },
  handler: async (ctx, { userId, token, accounts }) => {
    const existing = await ctx.db
      .query('monobankTokens')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    if (existing) await ctx.db.patch(existing._id, { token, accounts })
    else await ctx.db.insert('monobankTokens', { userId, token, accounts })
    const linked = await ctx.db
      .query('portfolios')
      .withIndex('by_user_source', (q) => q.eq('userId', userId).eq('source', 'monobank'))
      .collect()
    return linked.flatMap((p) => (p.externalAccountId ? [p.externalAccountId] : []))
  },
})

export const create = internalMutation({
  args: {
    userId: v.id('users'),
    id: v.string(),
    name: v.string(),
    accountId: v.string(),
    syncedAt: v.number(),
    entries: v.array(syncedEntry),
  },
  handler: async (ctx, { userId, id, name, accountId, syncedAt, entries }) => {
    await ctx.db.insert('portfolios', {
      id,
      userId,
      name,
      createdAt: new Date(syncedAt).toISOString(),
      source: 'monobank',
      externalAccountId: accountId,
      syncedAt,
      inNetWorth: true,
      cardPercent: 100,
      netWorthPercent: 100,
    })
    for (const e of entries) await ctx.db.insert('entries', { ...e, userId, portfolioId: id })
  },
})

/** The Monobank portfolio that has gone longest without a sync, if over 20 hours. */
export const due = internalQuery({
  args: {},
  handler: async (ctx) => {
    const p = await ctx.db
      .query('portfolios')
      .withIndex('by_source_synced', (q) => q.eq('source', 'monobank'))
      .first()
    if (!p || (p.syncedAt !== undefined && p.syncedAt > Date.now() - 20 * 3600_000)) return null
    return p
  },
})

/** Adds the new transactions (skipping ones already there), then — if `balance` is given — a
    "Balance adjustment" for any difference left (cashback, settled holds, a changed credit
    limit), so the card always matches Monobank. Returns whether it adjusted. */
export const applySync = internalMutation({
  args: {
    portfolioId: v.string(),
    syncedAt: v.number(),
    entries: v.array(syncedEntry),
    balance: v.optional(v.object({ asset: v.string(), minor: v.number(), adjustmentId: v.string() })),
  },
  handler: async (ctx, { portfolioId, syncedAt, entries, balance }) => {
    const p = await ctx.db
      .query('portfolios')
      .withIndex('by_app_id', (q) => q.eq('id', portfolioId))
      .unique()
    if (!p) return false
    const userId: Id<'users'> = p.userId
    for (const e of entries) {
      const seen = await ctx.db
        .query('entries')
        .withIndex('by_portfolio_external', (q) => q.eq('portfolioId', portfolioId).eq('externalId', e.externalId))
        .first()
      if (!seen) await ctx.db.insert('entries', { ...e, userId, portfolioId })
    }

    let adjusted = false
    if (balance) {
      const all = await ctx.db
        .query('entries')
        .withIndex('by_portfolio_external', (q) => q.eq('portfolioId', portfolioId))
        .collect()
      const total = all.reduce((sum, e) => sum + Math.round(Number(e.amount) * 100), 0)
      const difference = balance.minor - total
      if (difference !== 0) {
        const at = Math.floor(syncedAt / 1000)
        await ctx.db.insert('entries', {
          id: balance.adjustmentId,
          userId,
          portfolioId,
          asset: balance.asset,
          amount: decimal(difference),
          createdAt: iso(at),
          note: 'Balance adjustment',
          externalId: `adjustment-${at}`,
        })
        adjusted = true
      }
    }
    await ctx.db.patch(p._id, { syncedAt })
    return adjusted
  },
})
