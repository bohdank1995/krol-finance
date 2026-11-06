import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'

/* Portfolios (the cards) and entries (the rows) of the signed-in user. Every function here
   checks ownership itself — this is what Row Level Security did in Supabase. Entries of synced
   portfolios (Monobank, IBKR) are read-only: only the syncs in monobank.ts / ibkr.ts write them. */

export async function signedIn(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new ConvexError('Please sign in again.')
  return userId
}

/** The user's portfolio with this app id; throws if it's someone else's or gone. */
async function ownPortfolio(ctx: QueryCtx, userId: Id<'users'>, id: string) {
  const p = await ctx.db
    .query('portfolios')
    .withIndex('by_app_id', (q) => q.eq('id', id))
    .unique()
  if (!p || p.userId !== userId) throw new ConvexError('Portfolio not found.')
  return p
}

async function ownEntry(ctx: QueryCtx, userId: Id<'users'>, id: string) {
  const e = await ctx.db
    .query('entries')
    .withIndex('by_app_id', (q) => q.eq('id', id))
    .unique()
  if (!e || e.userId !== userId) throw new ConvexError('Entry not found.')
  return e
}

/** Throws if a text is longer than allowed (names, notes, amounts…), so nobody can store huge rows. */
function short(value: string | undefined, max: number, what: string) {
  if (value !== undefined && value.length > max) throw new ConvexError(`The ${what} is too long.`)
}

/** New rows bring their own app id: it must not be taken, or `.unique()` lookups of it would break. */
async function freshId(ctx: QueryCtx, table: 'portfolios' | 'entries' | 'groups', id: string) {
  short(id, 64, 'id')
  const taken = await ctx.db
    .query(table)
    .withIndex('by_app_id', (q) => q.eq('id', id))
    .first()
  if (taken) throw new ConvexError('This id is already used.')
}

/** Entries can only be typed into manual portfolios. */
async function manualPortfolio(ctx: QueryCtx, userId: Id<'users'>, id: string) {
  const p = await ownPortfolio(ctx, userId, id)
  if (p.source !== 'manual') throw new ConvexError('This portfolio is synced and read-only.')
  return p
}

type PortfolioView = Pick<
  Doc<'portfolios'>,
  'id' | 'name' | 'createdAt' | 'source' | 'position' | 'inNetWorth' | 'cardPercent' | 'netWorthPercent' | 'groupId'
> & { syncedAt?: string; inPassiveIncome: boolean; loadingHistory?: boolean }
type EntryView = Pick<Doc<'entries'>, 'id' | 'portfolioId' | 'asset' | 'amount' | 'createdAt' | 'note' | 'price'>

const portfolioView = (p: Doc<'portfolios'>): PortfolioView => ({
  id: p.id,
  name: p.name,
  createdAt: p.createdAt,
  source: p.source,
  syncedAt: p.syncedAt === undefined ? undefined : new Date(p.syncedAt).toISOString(),
  position: p.position,
  inNetWorth: p.inNetWorth,
  cardPercent: p.cardPercent,
  netWorthPercent: p.netWorthPercent,
  inPassiveIncome: p.inPassiveIncome ?? true,
  loadingHistory: p.loadingHistory,
  groupId: p.groupId,
})

const entryView = (e: Doc<'entries'>): EntryView => ({
  id: e.id,
  portfolioId: e.portfolioId,
  asset: e.asset,
  amount: e.amount,
  createdAt: e.createdAt,
  note: e.note,
  price: e.price,
})

/** Everything the app shows, live: re-sent whenever a portfolio or entry changes.
    null when signed out. */
export const everything = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const [portfolios, entries, payouts, groups] = await Promise.all([
      ctx.db.query('portfolios').withIndex('by_user', (q) => q.eq('userId', userId)).collect(),
      ctx.db.query('entries').withIndex('by_user', (q) => q.eq('userId', userId)).collect(),
      ctx.db.query('payouts').withIndex('by_user', (q) => q.eq('userId', userId)).collect(),
      ctx.db.query('groups').withIndex('by_user', (q) => q.eq('userId', userId)).collect(),
    ])
    return {
      portfolios: portfolios.map(portfolioView),
      groups: groups.map((g) => ({ id: g.id, name: g.name })),
      entries: entries.map(entryView),
      payouts: payouts.map((r) => ({ id: r.externalId, portfolioId: r.portfolioId, date: r.date, usd: r.usd })),
    }
  },
})

export const addPortfolio = mutation({
  args: { id: v.string(), name: v.string(), createdAt: v.string() },
  handler: async (ctx, { id, name, createdAt }) => {
    const userId = await signedIn(ctx)
    await freshId(ctx, 'portfolios', id)
    short(name, 100, 'name')
    checkDate(createdAt)
    await ctx.db.insert('portfolios', {
      id,
      userId,
      name,
      createdAt,
      source: 'manual',
      inNetWorth: true,
      cardPercent: 100,
      netWorthPercent: 100,
    })
  },
})

/** Renames, hides from Net worth or passive income, or sets percentages. */
export const updatePortfolio = mutation({
  args: {
    id: v.string(),
    name: v.optional(v.string()),
    inNetWorth: v.optional(v.boolean()),
    inPassiveIncome: v.optional(v.boolean()),
    cardPercent: v.optional(v.number()),
    netWorthPercent: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const userId = await signedIn(ctx)
    const p = await ownPortfolio(ctx, userId, id)
    short(patch.name, 100, 'name')
    const { cardPercent, netWorthPercent } = patch
    if (cardPercent !== undefined && !(cardPercent > 0 && cardPercent <= 100))
      throw new ConvexError('Card percent must be over 0 and at most 100.')
    if (netWorthPercent !== undefined && !(netWorthPercent >= 0 && netWorthPercent <= 100))
      throw new ConvexError('Net worth percent must be 0–100.')
    await ctx.db.patch(p._id, patch)
  },
})

/** Saves a new card order (`ids` in display order). */
export const reorderPortfolios = mutation({
  args: { ids: v.array(v.string()) },
  handler: async (ctx, { ids }) => {
    const userId = await signedIn(ctx)
    if (ids.length > 500) throw new ConvexError('Too many portfolios.')
    for (const [position, id] of ids.entries()) {
      const p = await ownPortfolio(ctx, userId, id)
      if (p.position !== position) await ctx.db.patch(p._id, { position })
    }
  },
})

/** Deleting a portfolio also deletes its entries. */
export const deletePortfolio = mutation({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const userId = await signedIn(ctx)
    const p = await ownPortfolio(ctx, userId, id)
    await deleteEntriesOf(ctx, p.id)
    await ctx.db.delete(p._id)
    await dropSmallGroups(ctx, userId)
  },
})

/** Saves the cards' edit mode in one go: `order` is every source in display order, `groups` the stacks.
    A group with fewer than 2 sources isn't kept, and groups left out are removed. */
export const saveLayout = mutation({
  args: {
    order: v.array(v.string()),
    groups: v.array(v.object({ id: v.string(), name: v.string(), portfolioIds: v.array(v.string()) })),
  },
  handler: async (ctx, { order, groups }) => {
    const userId = await signedIn(ctx)
    if (order.length > 500 || groups.length > 200) throw new ConvexError('Too many portfolios.')
    const existing = await ctx.db
      .query('groups')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()
    const memberOf = new Map<string, string>()
    const kept = new Set<string>()
    for (const g of groups) {
      if (g.portfolioIds.length < 2) continue
      short(g.name, 100, 'name')
      const own = existing.find((e) => e.id === g.id)
      if (own) {
        if (own.name !== g.name) await ctx.db.patch(own._id, { name: g.name })
      } else {
        await freshId(ctx, 'groups', g.id)
        await ctx.db.insert('groups', { id: g.id, userId, name: g.name })
      }
      kept.add(g.id)
      for (const id of g.portfolioIds) memberOf.set(id, g.id)
    }
    for (const [position, id] of order.entries()) {
      const p = await ownPortfolio(ctx, userId, id)
      const groupId = memberOf.get(id)
      if (p.position !== position || p.groupId !== groupId) await ctx.db.patch(p._id, { position, groupId })
    }
    for (const g of existing) if (!kept.has(g.id)) await ctx.db.delete(g._id)
  },
})

/** Stacks these sources into a new group (connecting several Monobank cards at once). */
export const createGroup = mutation({
  args: { id: v.string(), name: v.string(), portfolioIds: v.array(v.string()) },
  handler: async (ctx, { id, name, portfolioIds }) => {
    const userId = await signedIn(ctx)
    if (portfolioIds.length < 2 || portfolioIds.length > 500) throw new ConvexError('A group needs 2 or more sources.')
    short(name, 100, 'name')
    await freshId(ctx, 'groups', id)
    const members = await Promise.all(portfolioIds.map((p) => ownPortfolio(ctx, userId, p)))
    await ctx.db.insert('groups', { id, userId, name })
    for (const p of members) await ctx.db.patch(p._id, { groupId: id })
  },
})

/** After a source is deleted: a group with fewer than 2 sources left is undone. */
async function dropSmallGroups(ctx: MutationCtx, userId: Id<'users'>) {
  const groups = await ctx.db
    .query('groups')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect()
  if (groups.length === 0) return
  const portfolios = await ctx.db
    .query('portfolios')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect()
  for (const g of groups) {
    const members = portfolios.filter((p) => p.groupId === g.id)
    if (members.length >= 2) continue
    for (const p of members) await ctx.db.patch(p._id, { groupId: undefined })
    await ctx.db.delete(g._id)
  }
}

export async function deleteEntriesOf(ctx: MutationCtx, portfolioId: string) {
  const entries = await ctx.db
    .query('entries')
    .withIndex('by_portfolio_external', (q) => q.eq('portfolioId', portfolioId))
    .collect()
  for (const e of entries) await ctx.db.delete(e._id)
  const payouts = await ctx.db
    .query('payouts')
    .withIndex('by_portfolio_external', (q) => q.eq('portfolioId', portfolioId))
    .collect()
  for (const r of payouts) await ctx.db.delete(r._id)
}

/** Throws unless the text is an ISO date ("2026-11-06T12:00:00.000Z"), the way the app sends it. */
function checkDate(value: string) {
  short(value, 40, 'date')
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || Number.isNaN(Date.parse(value)))
    throw new ConvexError('The date is not valid.')
}

/** Entry texts: asset like "BTC" or "stock:VWCE.DE", amount a non-zero decimal ("-12.5"), date ISO. */
function checkEntry(e: { asset: string; amount: string; createdAt: string; note?: string }) {
  short(e.asset, 40, 'asset')
  short(e.amount, 40, 'amount')
  if (!/^-?\d+(\.\d+)?$/.test(e.amount) || Number(e.amount) === 0)
    throw new ConvexError('The amount must be a number other than 0.')
  checkDate(e.createdAt)
  short(e.note, 500, 'note')
}

const entryFields = {
  portfolioId: v.string(),
  asset: v.string(),
  amount: v.string(),
  createdAt: v.string(),
  note: v.optional(v.string()),
}

export const addEntry = mutation({
  args: { id: v.string(), ...entryFields },
  handler: async (ctx, entry) => {
    const userId = await signedIn(ctx)
    await freshId(ctx, 'entries', entry.id)
    checkEntry(entry)
    await manualPortfolio(ctx, userId, entry.portfolioId)
    await ctx.db.insert('entries', { ...entry, userId })
  },
})

export const updateEntry = mutation({
  args: { id: v.string(), ...entryFields },
  handler: async (ctx, { id, ...patch }) => {
    const userId = await signedIn(ctx)
    const e = await ownEntry(ctx, userId, id)
    checkEntry(patch)
    await manualPortfolio(ctx, userId, e.portfolioId)
    await manualPortfolio(ctx, userId, patch.portfolioId)
    await ctx.db.replace(e._id, { ...patch, id, userId })
  },
})

export const deleteEntry = mutation({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const userId = await signedIn(ctx)
    const e = await ownEntry(ctx, userId, id)
    await manualPortfolio(ctx, userId, e.portfolioId)
    await ctx.db.delete(e._id)
  },
})
