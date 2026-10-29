import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { internalMutation, type ActionCtx } from './_generated/server'

/* Per-user limits on the stock price lookups, so one account can't flood Yahoo Finance and get
   Koshel blocked for everyone. Generous for normal use: the app asks for quotes every 30 s and for
   history once per stock when it opens. Counted per minute. */

const LIMITS = { quotes: 20, history: 200 } as const
type Kind = keyof typeof LIMITS

const MINUTE = 60_000

/** Counts one call; throws once the user is over the limit for this minute. */
export async function hit(ctx: ActionCtx, userId: Id<'users'>, kind: Kind) {
  const ok: boolean = await ctx.runMutation(internal.limits.count, { userId, kind })
  if (!ok) throw new ConvexError('Too many requests. Try again in a minute.')
}

export const count = internalMutation({
  args: { userId: v.id('users'), kind: v.union(v.literal('quotes'), v.literal('history')) },
  handler: async (ctx, { userId, kind }) => {
    const now = Date.now()
    const row = await ctx.db
      .query('rateLimits')
      .withIndex('by_user_kind', (q) => q.eq('userId', userId).eq('kind', kind))
      .unique()
    if (!row) {
      await ctx.db.insert('rateLimits', { userId, kind, windowStart: now, count: 1 })
      return true
    }
    if (now - row.windowStart >= MINUTE) {
      await ctx.db.patch(row._id, { windowStart: now, count: 1 })
      return true
    }
    if (row.count >= LIMITS[kind]) return false
    await ctx.db.patch(row._id, { count: row.count + 1 })
    return true
  },
})
