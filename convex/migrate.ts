import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction, internalMutation, type MutationCtx } from './_generated/server'
import { source } from './schema'

/* One-time copy of the Supabase data into Convex (see convex/README.md). Run after signing in
   to the Convex app once, so the user exists:

     npx convex env set SUPABASE_URL https://<ref>.supabase.co
     npx convex env set SUPABASE_SERVICE_ROLE_KEY <secret key>
     npx convex run migrate:fromSupabase '{"email":"you@example.com"}'

   Every Supabase row (whoever owned it) goes to the Convex user with that email. Rows keep
   their ids, so running it again skips what's already there. Remove the two env vars after. */

type Row = Record<string, unknown>

async function rows(table: string, select: string) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.')
  const out: Row[] = []
  for (let start = 0; ; start += 1000) {
    const res = await fetch(`${url}/rest/v1/${table}?select=${select}&order=created_at`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${start}-${start + 999}` },
    })
    if (!res.ok) throw new Error(`Supabase ${table}: ${res.status} ${await res.text()}`)
    const page: Row[] = await res.json()
    out.push(...page)
    if (page.length < 1000) return out
  }
}

const iso = (t: unknown) => new Date(String(t)).toISOString()
const optional = (s: unknown) => (s === null || s === undefined ? undefined : String(s))

export const fromSupabase = internalAction({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const [portfolios, entries, monobank, ibkr] = await Promise.all([
      rows('portfolios', '*,card_percent::text,net_worth_percent::text'),
      // Amounts as text, so they stay exact.
      rows('entries', 'id,portfolio_id,asset,amount::text,created_at,note,external_id'),
      rows('monobank_tokens', '*'),
      rows('ibkr_tokens', '*'),
    ])
    await ctx.runMutation(internal.migrate.save, {
      email,
      portfolios: portfolios.map((p) => ({
        id: String(p.id),
        name: String(p.name),
        createdAt: iso(p.created_at),
        source: p.source as 'manual' | 'monobank' | 'ibkr',
        externalAccountId: optional(p.external_account_id),
        syncedAt: p.synced_at ? Date.parse(String(p.synced_at)) : undefined,
        position: typeof p.position === 'number' ? p.position : undefined,
        inNetWorth: p.in_net_worth !== false,
        cardPercent: Number(p.card_percent ?? 100),
        netWorthPercent: Number(p.net_worth_percent ?? 100),
        trackedAssets: p.source === 'ibkr' ? ((p.tracked_assets as string[] | null) ?? null) : undefined,
      })),
      tokens: {
        monobank: monobank[0] ? { token: String(monobank[0].token), accounts: monobank[0].accounts } : undefined,
        ibkr: ibkr[0]
          ? { token: String(ibkr[0].token), queryId: String(ibkr[0].query_id), positions: ibkr[0].positions }
          : undefined,
      },
    })
    // Entries in batches, to stay well inside one mutation's limits.
    let added = 0
    for (let i = 0; i < entries.length; i += 500)
      added += await ctx.runMutation(internal.migrate.saveEntries, {
        email,
        entries: entries.slice(i, i + 500).map((e) => ({
          id: String(e.id),
          portfolioId: String(e.portfolio_id),
          asset: String(e.asset),
          amount: String(e.amount),
          createdAt: iso(e.created_at),
          note: optional(e.note),
          externalId: optional(e.external_id),
        })),
      })
    return { portfolios: portfolios.length, entries: entries.length, entriesAdded: added }
  },
})

async function userByEmail(ctx: MutationCtx, email: string) {
  const user = await ctx.db
    .query('users')
    .withIndex('email', (q) => q.eq('email', email))
    .first()
  if (!user) throw new Error(`No Convex user with ${email} yet: sign in to the app once first.`)
  return user._id
}

export const save = internalMutation({
  args: {
    email: v.string(),
    portfolios: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        createdAt: v.string(),
        source,
        externalAccountId: v.optional(v.string()),
        syncedAt: v.optional(v.number()),
        position: v.optional(v.number()),
        inNetWorth: v.boolean(),
        cardPercent: v.number(),
        netWorthPercent: v.number(),
        trackedAssets: v.optional(v.union(v.array(v.string()), v.null())),
      }),
    ),
    tokens: v.object({
      monobank: v.optional(v.object({ token: v.string(), accounts: v.any() })),
      ibkr: v.optional(v.object({ token: v.string(), queryId: v.string(), positions: v.any() })),
    }),
  },
  handler: async (ctx, { email, portfolios, tokens }) => {
    const userId = await userByEmail(ctx, email)
    for (const p of portfolios) {
      const seen = await ctx.db
        .query('portfolios')
        .withIndex('by_app_id', (q) => q.eq('id', p.id))
        .unique()
      if (!seen) await ctx.db.insert('portfolios', { ...p, userId })
    }
    const ownMonobank = await ctx.db
      .query('monobankTokens')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    if (tokens.monobank && !ownMonobank) await ctx.db.insert('monobankTokens', { ...tokens.monobank, userId })
    const ownIbkr = await ctx.db
      .query('ibkrTokens')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    if (tokens.ibkr && !ownIbkr) await ctx.db.insert('ibkrTokens', { ...tokens.ibkr, userId })
  },
})

export const saveEntries = internalMutation({
  args: {
    email: v.string(),
    entries: v.array(
      v.object({
        id: v.string(),
        portfolioId: v.string(),
        asset: v.string(),
        amount: v.string(),
        createdAt: v.string(),
        note: v.optional(v.string()),
        externalId: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { email, entries }) => {
    const userId = await userByEmail(ctx, email)
    let added = 0
    for (const e of entries) {
      const seen = await ctx.db
        .query('entries')
        .withIndex('by_app_id', (q) => q.eq('id', e.id))
        .unique()
      if (seen) continue
      await ctx.db.insert('entries', { ...e, userId })
      added++
    }
    return added
  },
})
